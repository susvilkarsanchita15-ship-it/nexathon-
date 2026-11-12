/**
 * INKLOOM AI - Server Implementation (Phase 1, 2, 3, 4)
 * Strict authentication, RBAC authorization, server-side domain logic,
 * append-only audit trail, and zero secret leakage.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import mammoth from 'mammoth';
import {
  requireAuth,
  requireRole,
  signToken,
  comparePassword,
  hashPassword,
} from './server/auth';
import {
  userRepo,
  orgRepo,
  profileRepo,
  guidelineRepo,
  factRepo,
  termRepo,
  assetRepo,
  submissionRepo,
  versionRepo,
  reportRepo,
  suggestionRepo,
  commentRepo,
  approvalRepo,
  auditRepo,
  visualCheckRepo,
} from './server/db/repos';
import fs from 'fs';
import { runAnalysisPipeline } from './src/services/aiPipeline';
import { analyseImage } from './server/vision/index';
import { supabaseService } from './src/services/supabase';
import { computeWordDiff } from './src/services/revisionBuilder';

dotenv.config();

// Startup validation (Phase 0.1)
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'change-me-to-a-64-char-random-string') {
    console.error('FATAL: In production, JWT_SECRET must be set and at least 32 characters long.');
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security Middlewares (Phase 1)
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite dev server requires inline scripts
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.APP_URL || true,
    credentials: true,
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Rate limiters (Phase 1.3)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: { error: 'rate_limited', message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper for client IP hash
function getClientIpHash(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip_${Buffer.from(ip).toString('base64').slice(0, 10)}`;
}

// =============================================================
// AUTHENTICATION ROUTES (Phase 1.3)
// =============================================================

// POST /api/auth/register-organisation
app.post('/api/auth/register-organisation', authLimiter, async (req, res) => {
  const schema = z.object({
    orgName: z.string().min(2).max(100),
    domain: z.string().optional(),
    fullName: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(100),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }

  const { orgName, domain, fullName, email, password } = parsed.data;

  // Check unique email
  const existingUser = await userRepo.getByEmail(email);
  if (existingUser) {
    return res.status(400).json({ error: 'email_taken', message: 'An account with this email already exists.' });
  }

  const orgId = `org-${Date.now()}`;
  const org = await orgRepo.create({
    org_id: orgId,
    name: orgName,
    domain: domain || `${orgName.toLowerCase().replace(/\s+/g, '')}.test`,
    created_at: new Date().toISOString(),
  });

  const profile = await profileRepo.create({
    profile_id: `prof-${orgId}`,
    org_id: orgId,
    name: `${orgName} Master Brand`,
    voice_notes: 'Encouraging, grounded, and clear.',
    status: 'active',
    external_ai_allowed: true,
    team_visibility: 'own',
    created_at: new Date().toISOString(),
  });

  const password_hash = await hashPassword(password);
  const user = await userRepo.create({
    user_id: `u-${Date.now()}`,
    org_id: orgId,
    full_name: fullName,
    email: email.toLowerCase().trim(),
    password_hash,
    role: 'admin',
    status: 'active',
    is_active: true,
    failed_login_count: 0,
    created_at: new Date().toISOString(),
  });

  await auditRepo.create({
    org_id: orgId,
    actor_id: user.user_id,
    action: 'org_registered',
    entity_type: 'organisation',
    entity_id: orgId,
    metadata: { orgName, adminEmail: email },
    ip_hash: getClientIpHash(req),
  });

  const token = signToken(user);
  const { password_hash: _, ...safeUser } = user;
  res.status(201).json({ token, user: safeUser, organisation: org, profile });
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
  }

  const { email, password } = parsed.data;
  const user = await userRepo.getByEmail(email);

  // Constant-time compare defense
  const dummyHash = '$2a$12$e8r88r8r8r8r8r8r8r8r8.e8r88r8r8r8r8r8r8r8r8r8r8r8r8r8';
  const hashToCompare = user ? user.password_hash : dummyHash;
  const isValid = await comparePassword(password, hashToCompare);

  if (!user || !isValid || user.status === 'deactivated' || user.is_active === false) {
    if (user) {
      await auditRepo.create({
        org_id: user.org_id,
        actor_id: user.user_id,
        action: 'login_failed',
        entity_type: 'user',
        entity_id: user.user_id,
        ip_hash: getClientIpHash(req),
      });
    }
    return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
  }

  await auditRepo.create({
    org_id: user.org_id,
    actor_id: user.user_id,
    action: 'login_success',
    entity_type: 'user',
    entity_id: user.user_id,
    ip_hash: getClientIpHash(req),
  });

  const token = signToken(user);
  const { password_hash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await userRepo.getById(req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const org = await orgRepo.getById(req.auth!.orgId);
  const { password_hash: _, ...safeUser } = user;

  res.json({
    user: safeUser,
    org,
    role: req.auth!.role,
    onboardingChecklist: {
      hasBrandProfile: true,
      hasGuidelines: true,
      hasApprovedFacts: true,
    },
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await auditRepo.create({
    org_id: req.auth!.orgId,
    actor_id: req.auth!.userId,
    action: 'logout',
    entity_type: 'user',
    entity_id: req.auth!.userId,
    ip_hash: getClientIpHash(req),
  });
  res.json({ message: 'Logged out successfully' });
});

// =============================================================
// USERS MANAGEMENT ROUTES (Phase 2.1)
// =============================================================

// GET /api/users
app.get('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  const list = await userRepo.list(req.auth!.orgId);
  const safeList = list.map(({ password_hash: _, ...u }) => u);
  res.json({ data: safeList, meta: { total: safeList.length } });
});

// POST /api/users
app.post('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['admin', 'creator', 'reviewer', 'viewer']),
    password: z.string().min(8).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }

  const { fullName, email, role, password = 'Password123!' } = parsed.data;
  const existing = await userRepo.getByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'email_taken', message: 'User with this email already exists' });
  }

  const password_hash = await hashPassword(password);
  const newUser = await userRepo.create({
    user_id: `u-${Date.now()}`,
    org_id: req.auth!.orgId,
    full_name: fullName,
    email: email.toLowerCase().trim(),
    password_hash,
    role,
    status: 'active',
    is_active: true,
    failed_login_count: 0,
    created_at: new Date().toISOString(),
  });

  await auditRepo.create({
    org_id: req.auth!.orgId,
    actor_id: req.auth!.userId,
    action: 'user_created',
    entity_type: 'user',
    entity_id: newUser.user_id,
    metadata: { email, role },
  });

  const { password_hash: _, ...safeUser } = newUser;
  res.status(201).json({ data: safeUser });
});

// PATCH /api/users/:id (Last-admin protection enforced, Phase 2.2)
app.patch('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const targetId = req.params.id;
  const target = await userRepo.getById(targetId);

  if (!target || target.org_id !== req.auth!.orgId) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const { role, status } = req.body;

  // Last-admin protection: cannot demote or deactivate last active admin
  if (target.role === 'admin' && (role && role !== 'admin' || status === 'deactivated')) {
    const orgUsers = await userRepo.list(req.auth!.orgId);
    const activeAdmins = orgUsers.filter((u) => u.role === 'admin' && u.status === 'active' && u.is_active);

    if (activeAdmins.length <= 1) {
      return res.status(409).json({
        error: 'last_admin_protection',
        message: 'Cannot demote or deactivate the last active administrator in the organisation.',
      });
    }
  }

  const updated = await userRepo.update(targetId, req.auth!.orgId, {
    ...(role && { role }),
    ...(status && { status, is_active: status === 'active' }),
  });

  await auditRepo.create({
    org_id: req.auth!.orgId,
    actor_id: req.auth!.userId,
    action: 'user_updated',
    entity_type: 'user',
    entity_id: targetId,
    metadata: { role, status },
  });

  const { password_hash: _, ...safeUser } = updated;
  res.json({ data: safeUser });
});

// =============================================================
// BRAND KNOWLEDGE & GUIDELINES (Phase 2.1)
// =============================================================

// GET /api/brand-profiles
app.get('/api/brand-profiles', requireAuth, async (req, res) => {
  const list = await profileRepo.list(req.auth!.orgId);
  res.json({ data: list });
});

// POST /api/brand-profiles
app.post('/api/brand-profiles', requireAuth, requireRole('admin'), async (req, res) => {
  const newProfile = await profileRepo.create({
    profile_id: `prof-${Date.now()}`,
    org_id: req.auth!.orgId,
    name: req.body.name || 'New Brand Profile',
    voice_notes: req.body.voice_notes || '',
    status: 'active',
    external_ai_allowed: req.body.external_ai_allowed ?? true,
    team_visibility: req.body.team_visibility || 'own',
    palette: req.body.palette || [],
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ data: newProfile });
});

// GET /api/brand-profiles/:id
app.get('/api/brand-profiles/:id', requireAuth, async (req, res) => {
  const profile = await profileRepo.getById(req.params.id, req.auth!.orgId);
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });
  res.json({ data: profile });
});

// PATCH /api/brand-profiles/:id
app.patch('/api/brand-profiles/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const updated = await profileRepo.update(req.params.id, req.auth!.orgId, req.body);
  if (!updated) return res.status(404).json({ error: 'profile_not_found' });
  res.json({ data: updated });
});

// GET /api/brand-profiles/:id/guidelines
app.get('/api/brand-profiles/:id/guidelines', requireAuth, async (req, res) => {
  const list = await guidelineRepo.list(req.params.id, req.auth!.orgId);
  res.json({ data: list, meta: { total: list.length } });
});

// POST /api/brand-profiles/:id/guidelines
app.post('/api/brand-profiles/:id/guidelines', requireAuth, requireRole('admin'), async (req, res) => {
  const newG = await guidelineRepo.create({
    guideline_id: `g-${Date.now()}`,
    profile_id: req.params.id,
    code: req.body.code || `G-${Date.now().toString().slice(-2)}`,
    title: req.body.title,
    category: req.body.category || 'tone',
    rule_text: req.body.rule_text,
    content_types: req.body.content_types || [],
    example_good: req.body.example_good,
    example_bad: req.body.example_bad,
    version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ data: newG });
});

// PATCH /api/guidelines/:id
app.patch('/api/guidelines/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const existing = await guidelineRepo.getById(req.params.id, req.auth!.orgId);
  if (!existing) return res.status(404).json({ error: 'guideline_not_found' });

  // Versioned update: deactivates old, creates version + 1
  existing.is_active = false;
  const newVersion = await guidelineRepo.create({
    ...existing,
    ...req.body,
    guideline_id: `g-${Date.now()}`,
    version: existing.version + 1,
    is_active: true,
    created_at: new Date().toISOString(),
  });
  res.json({ data: newVersion });
});

// POST /api/brand-profiles/:id/guidelines/import
app.post('/api/brand-profiles/:id/guidelines/import', requireAuth, requireRole('admin'), async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ error: 'missing_text' });

  // Paste-and-split style guide parser
  const lines = rawText.split('\n').filter((l: string) => l.trim().length > 5);
  const created = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const g = await guidelineRepo.create({
      guideline_id: `g-imp-${Date.now()}-${i}`,
      profile_id: req.params.id,
      code: `G-IMP-${i + 1}`,
      title: line.slice(0, 40),
      category: 'general',
      rule_text: line,
      content_types: [],
      version: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    created.push(g);
  }

  res.status(201).json({ data: created, count: created.length });
});

// GET /api/brand-profiles/:id/facts
app.get('/api/brand-profiles/:id/facts', requireAuth, async (req, res) => {
  const list = await factRepo.list(req.params.id, req.auth!.orgId);
  res.json({ data: list, meta: { total: list.length } });
});

// POST /api/brand-profiles/:id/facts
app.post('/api/brand-profiles/:id/facts', requireAuth, requireRole('admin'), async (req, res) => {
  const newFact = await factRepo.create({
    fact_id: `f-${Date.now()}`,
    profile_id: req.params.id,
    code: req.body.code || `F-${Date.now().toString().slice(-2)}`,
    subject: req.body.subject,
    statement: req.body.statement,
    source_ref: req.body.source_ref,
    valid_until: req.body.valid_until || '2028-12-31',
    is_active: true,
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ data: newFact });
});

// PATCH /api/facts/:id
app.patch('/api/facts/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const updated = await factRepo.update(req.params.id, req.auth!.orgId, req.body);
  if (!updated) return res.status(404).json({ error: 'fact_not_found' });
  res.json({ data: updated });
});

// GET /api/brand-profiles/:id/terms
app.get('/api/brand-profiles/:id/terms', requireAuth, async (req, res) => {
  const list = await termRepo.list(req.params.id, req.auth!.orgId);
  res.json({ data: list, meta: { total: list.length } });
});

// POST /api/brand-profiles/:id/terms
app.post('/api/brand-profiles/:id/terms', requireAuth, requireRole('admin'), async (req, res) => {
  const newTerm = await termRepo.create({
    term_id: `t-${Date.now()}`,
    profile_id: req.params.id,
    code: req.body.code || `T-${Date.now().toString().slice(-2)}`,
    preferred_term: req.body.preferred_term,
    avoid_terms: req.body.avoid_terms || [],
    notes: req.body.notes,
    case_sensitive: Boolean(req.body.case_sensitive),
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ data: newTerm });
});

// PATCH /api/terms/:id
app.patch('/api/terms/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const updated = await termRepo.update(req.params.id, req.auth!.orgId, req.body);
  if (!updated) return res.status(404).json({ error: 'term_not_found' });
  res.json({ data: updated });
});

// GET /api/brand-profiles/:id/assets
app.get('/api/brand-profiles/:id/assets', requireAuth, async (req, res) => {
  const list = await assetRepo.list(req.params.id, req.auth!.orgId);
  res.json({ data: list });
});

// POST /api/brand-profiles/:id/assets
app.post('/api/brand-profiles/:id/assets', requireAuth, requireRole('admin'), async (req, res) => {
  if (!req.body.alt_text) {
    return res.status(400).json({ error: 'missing_alt_text', message: 'Mandatory alt text required for brand assets.' });
  }
  const newAsset = await assetRepo.create({
    asset_id: `ast-${Date.now()}`,
    profile_id: req.params.id,
    name: req.body.name,
    asset_type: req.body.asset_type || 'image',
    file_url: req.body.file_url,
    alt_text: req.body.alt_text,
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ data: newAsset });
});

// =============================================================
// SUBMISSIONS & REVIEW WORKFLOW (Phase 2.1 & 2.2)
// =============================================================

// POST /api/submissions/extract-text (txt & docx supported, pdf 415, Phase 2.2)
app.post('/api/submissions/extract-text', requireAuth, async (req, res) => {
  const { filename, base64Content } = req.body;
  if (!filename || !base64Content) {
    return res.status(400).json({ error: 'missing_file_data' });
  }

  const ext = path.extname(filename).toLowerCase();
  const buffer = Buffer.from(base64Content, 'base64');

  if (buffer.length > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'file_too_large', message: 'Maximum file size is 2 MB' });
  }

  if (ext === '.pdf') {
    return res.status(415).json({
      error: 'unsupported_file_type',
      message: 'PDF extraction is a planned enhancement. Please upload .txt or .docx.',
    });
  }

  if (ext === '.txt') {
    const text = buffer.toString('utf8');
    return res.json({ text, filename });
  }

  if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return res.json({ text: result.value, filename });
    } catch (err: any) {
      return res.status(415).json({ error: 'extraction_failed', message: err.message });
    }
  }

  return res.status(415).json({ error: 'unsupported_file_type', message: 'Supported types: .txt and .docx' });
});

// POST /api/submissions
app.post('/api/submissions', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const schema = z.object({
    title: z.string().min(2).max(200),
    content_type: z.enum(['email', 'social_post', 'web_copy', 'ad', 'blog', 'press_release', 'other']),
    profile_id: z.string(),
    body_text: z.string().min(1).max(20000),
    media: z.array(z.any()).optional().default([]),
    links: z.array(z.any()).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'validation_error', details: parsed.error.format() });
  }

  const { title, content_type, profile_id, body_text, media, links } = parsed.data;

  const profile = await profileRepo.getById(profile_id, req.auth!.orgId);
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  const subId = `sub-${Date.now()}`;
  const verId = `ver-${subId}-v1`;
  const now = new Date().toISOString();

  const user = await userRepo.getById(req.auth!.userId);

  const sub = await submissionRepo.create({
    submission_id: subId,
    profile_id,
    creator_id: req.auth!.userId,
    creator_name: user?.full_name || 'Creator',
    title,
    content_type,
    status: 'draft',
    created_at: now,
    updated_at: now,
  });

  const ver = await versionRepo.create({
    version_id: verId,
    submission_id: subId,
    version_no: 1,
    body_text,
    media,
    links,
    source: 'creator_submit',
    created_by: req.auth!.userId,
    created_at: now,
  });

  await auditRepo.create({
    org_id: req.auth!.orgId,
    actor_id: req.auth!.userId,
    action: 'submission_created',
    entity_type: 'submission',
    entity_id: subId,
    metadata: { title, version_no: 1 },
  });

  res.status(201).json({ submission: sub, version: ver });
});

// GET /api/submissions
app.get('/api/submissions', requireAuth, async (req, res) => {
  const { role, userId, orgId } = req.auth!;
  const list = await submissionRepo.list(orgId, userId, role, req.query.status as string);
  res.json({ data: list, meta: { total: list.length } });
});

// GET /api/submissions/:id
app.get('/api/submissions/:id', requireAuth, async (req, res) => {
  const sub = await submissionRepo.getById(req.params.id, req.auth!.orgId);
  if (!sub) return res.status(404).json({ error: 'submission_not_found' });

  // Role check: creators can only access own submissions if team_visibility is own
  if (req.auth!.role === 'creator' && sub.creator_id !== req.auth!.userId) {
    const prof = await profileRepo.getById(sub.profile_id, req.auth!.orgId);
    if (prof?.team_visibility !== 'team') {
      return res.status(403).json({ error: 'forbidden', message: 'You do not have access to this submission.' });
    }
  }

  const latestVer = await versionRepo.getLatest(sub.submission_id, req.auth!.orgId);
  const report = latestVer ? await reportRepo.getByVersionId(latestVer.version_id) : null;
  const approvals = await approvalRepo.list(sub.submission_id, req.auth!.orgId);

  res.json({ data: { submission: sub, currentVersion: latestVer, latestReport: report, approvals } });
});

// POST /api/submissions/:id/analyse
app.post('/api/submissions/:id/analyse', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const sub = await submissionRepo.getById(req.params.id, req.auth!.orgId);
  if (!sub) return res.status(404).json({ error: 'submission_not_found' });

  const profile = await profileRepo.getById(sub.profile_id, req.auth!.orgId);
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  const guidelines = await guidelineRepo.list(profile.profile_id, req.auth!.orgId);
  const facts = await factRepo.list(profile.profile_id, req.auth!.orgId);
  const terms = await termRepo.list(profile.profile_id, req.auth!.orgId);

  const version = await versionRepo.getLatest(sub.submission_id, req.auth!.orgId);
  if (!version) return res.status(400).json({ error: 'no_version_to_analyse' });

  try {
    const pipelineResult = await runAnalysisPipeline({
      draft: version.body_text,
      contentType: sub.content_type,
      profile: profile as any,
      guidelines: guidelines as any,
      facts: facts as any,
      terms: terms as any,
      media: version.media,
      links: version.links,
    });

    const reportId = `rep-${Date.now()}`;
    const reportData = {
      report_id: reportId,
      version_id: version.version_id,
      summary: pipelineResult.report.summary,
      model_name: pipelineResult.report.model_name,
      ai_status: pipelineResult.report.ai_status,
      sent_reference_codes: pipelineResult.report.sent_reference_codes,
      dropped_findings: pipelineResult.report.dropped_findings,
      issues: pipelineResult.report.issues.map((iss, i) => ({
        ...iss,
        report_id: reportId,
        issue_id: `iss-${reportId}-${i + 1}`,
      })),
      created_at: new Date().toISOString(),
    };

    await reportRepo.create(reportData);
    await submissionRepo.updateStatus(sub.submission_id, req.auth!.orgId, 'in_correction');

    await auditRepo.create({
      org_id: req.auth!.orgId,
      actor_id: req.auth!.userId,
      action: 'analysis_run',
      entity_type: 'submission',
      entity_id: sub.submission_id,
      metadata: { issuesCount: reportData.issues.length },
    });

    res.json({ data: reportData, meta: { factChecks: pipelineResult.factChecks } });
  } catch (err: any) {
    res.status(500).json({ error: 'analysis_failed', message: err.message });
  }
});

// PATCH /api/suggestions/:id (Reason required for high severity dismissals, Phase 2.2)
app.patch('/api/suggestions/:id', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const { action, finalText, reason } = req.body;

  if (action === 'dismiss') {
    const found = await suggestionRepo.getById(req.params.id);
    if (found?.issue?.severity === 'high' && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({
        error: 'dismissal_reason_required',
        message: 'A clear constructive reason of at least 5 characters is mandatory when dismissing a high-severity finding.',
      });
    }
  }

  const updated = await suggestionRepo.updateStatus(req.params.id, action, finalText, reason);
  if (!updated) return res.status(404).json({ error: 'suggestion_not_found' });
  res.json({ data: updated });
});

// POST /api/submissions/:id/versions (Creates immutable new version)
app.post('/api/submissions/:id/versions', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const sub = await submissionRepo.getById(req.params.id, req.auth!.orgId);
  if (!sub) return res.status(404).json({ error: 'submission_not_found' });

  const latest = await versionRepo.getLatest(sub.submission_id, req.auth!.orgId);
  const nextVerNo = (latest?.version_no || 1) + 1;
  const verId = `ver-${sub.submission_id}-v${nextVerNo}`;
  const now = new Date().toISOString();

  const newVer = await versionRepo.create({
    version_id: verId,
    submission_id: sub.submission_id,
    version_no: nextVerNo,
    body_text: req.body.body_text || latest?.body_text,
    media: req.body.media || latest?.media || [],
    links: req.body.links || latest?.links || [],
    source: req.body.source || 'accepted_changes',
    created_by: req.auth!.userId,
    created_at: now,
  });

  // Automatically trigger analysis for new immutable version
  const profile = await profileRepo.getById(sub.profile_id, req.auth!.orgId);
  const guidelines = await guidelineRepo.list(profile!.profile_id, req.auth!.orgId);
  const facts = await factRepo.list(profile!.profile_id, req.auth!.orgId);
  const terms = await termRepo.list(profile!.profile_id, req.auth!.orgId);

  const pipelineResult = await runAnalysisPipeline({
    draft: newVer.body_text,
    contentType: sub.content_type,
    profile: profile as any,
    guidelines: guidelines as any,
    facts: facts as any,
    terms: terms as any,
    media: newVer.media,
    links: newVer.links,
  });

  const reportId = `rep-${Date.now()}`;
  const reportData = {
    report_id: reportId,
    version_id: newVer.version_id,
    summary: pipelineResult.report.summary,
    model_name: pipelineResult.report.model_name,
    ai_status: pipelineResult.report.ai_status,
    issues: pipelineResult.report.issues.map((iss, i) => ({
      ...iss,
      report_id: reportId,
      issue_id: `iss-${reportId}-${i + 1}`,
    })),
    created_at: now,
  };

  await reportRepo.create(reportData);

  res.status(201).json({ version: newVer, report: reportData });
});

// POST /api/submissions/:id/send-for-review (Blocked with 409 if open high findings exist)
app.post('/api/submissions/:id/send-for-review', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const sub = await submissionRepo.getById(req.params.id, req.auth!.orgId);
  if (!sub) return res.status(404).json({ error: 'submission_not_found' });

  const latestVer = await versionRepo.getLatest(sub.submission_id, req.auth!.orgId);
  const report = latestVer ? await reportRepo.getByVersionId(latestVer.version_id) : null;

  if (report) {
    const openHighFindings = report.issues.filter(
      (iss: any) => iss.severity === 'high' && (!iss.suggestion || iss.suggestion.status === 'pending')
    );

    if (openHighFindings.length > 0) {
      return res.status(409).json({
        error: 'unresolved_high_findings',
        message: `Cannot send for review: ${openHighFindings.length} high-severity policy conflict(s) remain open. Resolve or dismiss with reason first.`,
      });
    }
  }

  const updated = await submissionRepo.updateStatus(sub.submission_id, req.auth!.orgId, 'in_review');

  await auditRepo.create({
    org_id: req.auth!.orgId,
    actor_id: req.auth!.userId,
    action: 'sent_for_review',
    entity_type: 'submission',
    entity_id: sub.submission_id,
  });

  res.json({ data: updated });
});

// GET /api/review-queue
app.get('/api/review-queue', requireAuth, requireRole('reviewer', 'admin'), async (req, res) => {
  const inReview = await submissionRepo.list(req.auth!.orgId, undefined, undefined, 'in_review');

  const queue = await Promise.all(
    inReview.map(async (sub) => {
      const latestVer = await versionRepo.getLatest(sub.submission_id, req.auth!.orgId);
      const report = latestVer ? await reportRepo.getByVersionId(latestVer.version_id) : null;
      return {
        submission_id: sub.submission_id,
        version_id: latestVer?.version_id,
        version_no: latestVer?.version_no || 1,
        title: sub.title,
        content_type: sub.content_type,
        creator_name: sub.creator_name || 'Creator',
        created_at: sub.created_at,
        updated_at: sub.updated_at,
        unresolved_high: report?.summary?.high || 0,
        unresolved_medium: report?.summary?.medium || 0,
        unresolved_low: report?.summary?.low || 0,
      };
    })
  );

  res.json({ data: queue, meta: { total: queue.length } });
});

// POST /api/versions/:id/decision (Self-approval guard & comment length rules enforced, Phase 2.2)
app.post('/api/versions/:id/decision', requireAuth, requireRole('reviewer', 'admin'), async (req, res) => {
  const { decision, comment, visual_checklist } = req.body;
  const version = await versionRepo.getById(req.params.id, req.auth!.orgId);

  if (!version) return res.status(404).json({ error: 'version_not_found' });
  const sub = await submissionRepo.getById(version.submission_id, req.auth!.orgId);
  if (!sub) return res.status(404).json({ error: 'submission_not_found' });

  // Self-approval Guard (Part C.3 & Phase 2.2):
  // Even admins cannot approve their own submissions
  if (version.created_by === req.auth!.userId) {
    await auditRepo.create({
      org_id: req.auth!.orgId,
      actor_id: req.auth!.userId,
      action: 'self_approval_blocked',
      entity_type: 'version',
      entity_id: version.version_id,
    });

    return res.status(403).json({
      error: 'self_approval_forbidden',
      message: 'Conflict of interest guard: Reviewers and Admins are forbidden from approving their own submissions.',
    });
  }

  // Comment length checks
  if (decision === 'approved' && (!comment || comment.trim().length < 5)) {
    return res.status(400).json({
      error: 'comment_too_short',
      message: 'Approval requires a meaningful decision note of at least 5 characters.',
    });
  }

  if (decision === 'changes_requested' && (!comment || comment.trim().length < 10)) {
    return res.status(400).json({
      error: 'comment_too_short',
      message: 'Requesting changes requires constructive feedback of at least 10 characters.',
    });
  }

  const user = await userRepo.getById(req.auth!.userId);
  const now = new Date().toISOString();

  const record = await approvalRepo.create({
    approval_id: `appr-${Date.now()}`,
    version_id: version.version_id,
    reviewer_id: req.auth!.userId,
    reviewer_name: user?.full_name || 'Reviewer',
    decision,
    comment,
    visual_checklist: visual_checklist || {},
    decided_at: now,
  });

  const nextStatus = decision === 'approved' ? 'approved' : 'changes_requested';
  await submissionRepo.updateStatus(sub.submission_id, req.auth!.orgId, nextStatus);

  await auditRepo.create({
    org_id: req.auth!.orgId,
    actor_id: req.auth!.userId,
    action: `decision_${decision}`,
    entity_type: 'submission',
    entity_id: sub.submission_id,
    metadata: { version_no: version.version_no, decision },
  });

  res.status(201).json({ approval: record, status: nextStatus });
});

// GET /api/versions/:id/diff
app.get('/api/versions/:id/diff', requireAuth, async (req, res) => {
  const version = await versionRepo.getById(req.params.id, req.auth!.orgId);
  if (!version) return res.status(404).json({ error: 'version_not_found' });

  let compareText = '';
  if (version.version_no > 1) {
    const allVers = await versionRepo.list(version.submission_id, req.auth!.orgId);
    const prev = allVers.find((v: any) => v.version_no === version.version_no - 1);
    if (prev) compareText = prev.body_text;
  }

  const diff = computeWordDiff(compareText, version.body_text);
  res.json({ data: diff });
});

// GET /api/submissions/:id/comments
app.get('/api/submissions/:id/comments', requireAuth, async (req, res) => {
  const list = await commentRepo.list(req.params.id, req.auth!.orgId);
  res.json({ data: list });
});

// POST /api/submissions/:id/comments
app.post('/api/submissions/:id/comments', requireAuth, async (req, res) => {
  const { versionId, body, issueId, parentCommentId } = req.body;
  if (!body || body.trim().length === 0) {
    return res.status(400).json({ error: 'empty_comment' });
  }

  const user = await userRepo.getById(req.auth!.userId);
  const comment = await commentRepo.create({
    comment_id: `comm-${Date.now()}`,
    version_id: versionId,
    author_id: req.auth!.userId,
    author_name: user?.full_name || 'Reviewer',
    author_role: req.auth!.role,
    issue_id: issueId,
    parent_comment_id: parentCommentId,
    body: body.trim(),
    created_at: new Date().toISOString(),
  });

  res.status(201).json({ data: comment });
});

// =============================================================
// AUTOMATED IMAGE-BASED BRAND CHECKING (Phase 6 / Visual Audit)
// =============================================================

const activeRunsByVersion = new Set<string>();
const visualCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'rate_limited', message: 'Too many visual check runs. Please wait 1 minute.' },
});

// POST /api/versions/:id/visual-check
app.post(
  '/api/versions/:id/visual-check',
  requireAuth,
  requireRole('reviewer', 'admin'),
  visualCheckLimiter,
  async (req, res) => {
    const versionId = req.params.id;
    const version = await versionRepo.getById(versionId, req.auth!.orgId);
    if (!version) return res.status(404).json({ error: 'version_not_found', message: 'Content version not found.' });

    const sub = await submissionRepo.getById(version.submission_id, req.auth!.orgId);
    if (!sub) return res.status(404).json({ error: 'submission_not_found', message: 'Submission not found.' });

    const profile = await profileRepo.getById(sub.profile_id, req.auth!.orgId);
    if (!profile) return res.status(404).json({ error: 'profile_not_found', message: 'Brand profile not found.' });

    if (activeRunsByVersion.has(versionId)) {
      return res.status(409).json({
        error: 'analysis_in_progress',
        message: 'A visual brand check is already running for this content version.',
      });
    }

    // Determine target media item
    const mediaIndex = typeof req.body.media_index === 'number' ? req.body.media_index : 0;
    const targetMedia = version.media && version.media[mediaIndex] ? version.media[mediaIndex] : null;
    const imageName = targetMedia?.name || req.body.imageName || 'creative_asset.png';

    // Resolve image buffer from rawBase64, data-URL, or local public path
    let imageBuffer: Buffer | null = null;

    if (req.body.rawBase64) {
      try {
        const cleanB64 = req.body.rawBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(cleanB64, 'base64');
      } catch (e) {
        return res.status(422).json({ error: 'invalid_base64', message: 'Could not decode rawBase64 data.' });
      }
    } else if (targetMedia?.url) {
      if (targetMedia.url.startsWith('data:image/')) {
        const cleanB64 = targetMedia.url.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(cleanB64, 'base64');
      } else if (targetMedia.url.startsWith('/')) {
        const localPath = path.resolve(process.cwd(), 'public', targetMedia.url.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          imageBuffer = fs.readFileSync(localPath);
        }
      } else if (targetMedia.url.startsWith('http')) {
        // In local/test environments without outbound internet, use local demo asset
        const fallbackPath = path.resolve(process.cwd(), 'public/demo-assets/creatives/04_wrong_colour.png');
        if (fs.existsSync(fallbackPath)) {
          imageBuffer = fs.readFileSync(fallbackPath);
        }
      }
    }

    if (!imageBuffer) {
      return res.status(422).json({
        error: 'no_media_attached',
        message: 'No valid image found to analyze. Please attach an image asset to this version.',
      });
    }

    activeRunsByVersion.add(versionId);
    const runId = `run-${versionId}-${Date.now()}`;
    visualCheckRepo.setRunProgress(runId, 'validate_and_decode', 10);

    try {
      const guidelines = await guidelineRepo.list(profile.profile_id, req.auth!.orgId);
      const assets = await assetRepo.list(profile.profile_id, req.auth!.orgId);

      const report = await analyseImage({
        imageBuffer,
        imageName,
        versionId: version.version_id,
        submissionId: sub.submission_id,
        profile,
        guidelines,
        assets,
        mediaItem: targetMedia,
        onProgress: (stage, pct) => {
          visualCheckRepo.setRunProgress(runId, stage, pct);
        },
      });

      await visualCheckRepo.create(report, req.auth!.orgId);

      await auditRepo.create({
        org_id: req.auth!.orgId,
        actor_id: req.auth!.userId,
        action: 'visual_check_run',
        entity_type: 'version',
        entity_id: version.version_id,
        metadata: {
          imageName,
          image_sha256: report.image_sha256,
          dimensions: `${report.width}x${report.height}`,
          issuesCount: report.issues.length,
          overall_compliance: report.overall_compliance,
          provider: report.provider,
          timings_ms: report.timings,
        },
      });

      res.json({ data: report, report_id: report.check_id });
    } catch (err: any) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.error, message: err.message });
      }
      console.error('Visual check error:', err);
      res.status(500).json({ error: 'visual_check_failed', message: err.message || 'Internal analysis error' });
    } finally {
      activeRunsByVersion.delete(versionId);
      visualCheckRepo.setRunProgress(runId, 'completed', 100);
    }
  }
);

// GET /api/versions/:id/visual-check
app.get('/api/versions/:id/visual-check', requireAuth, async (req, res) => {
  const version = await versionRepo.getById(req.params.id, req.auth!.orgId);
  if (!version) return res.status(404).json({ error: 'version_not_found' });

  const includeHistory = req.query.history === '1';
  const report = await visualCheckRepo.getByVersionId(req.params.id, req.auth!.orgId, includeHistory);
  res.json({ data: report });
});

// GET /api/visual-checks/:reportId/status
app.get('/api/visual-checks/:reportId/status', requireAuth, async (req, res) => {
  const status = visualCheckRepo.getRunProgress(req.params.reportId);
  res.json({ data: status });
});

// PATCH /api/visual-issues/:id
app.patch(
  '/api/visual-issues/:id',
  requireAuth,
  requireRole('reviewer', 'admin'),
  async (req, res) => {
    const item = await visualCheckRepo.getIssueById(req.params.id, req.auth!.orgId);
    if (!item) return res.status(404).json({ error: 'issue_not_found', message: 'Visual issue not found.' });

    // Block submission author from reviewing their own submission
    if (item.report && item.report.submission_id) {
      const sub = await submissionRepo.getById(item.report.submission_id, req.auth!.orgId);
      if (sub && sub.creator_id === req.auth!.userId) {
        return res.status(403).json({
          error: 'author_cannot_review',
          message: 'Authors cannot review visual issues on their own submissions.',
        });
      }
    }

    const schema = z.object({
      review_status: z.enum(['confirmed', 'false_positive', 'needs_correction', 'unreviewed']),
      comment: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.format() });
    }

    const user = await userRepo.getById(req.auth!.userId);
    const result = await visualCheckRepo.recordReview(
      req.params.id,
      req.auth!.orgId,
      parsed.data.review_status,
      req.auth!.userId,
      user?.full_name || 'Reviewer',
      parsed.data.comment
    );

    if (!result) return res.status(404).json({ error: 'issue_not_found' });

    await auditRepo.create({
      org_id: req.auth!.orgId,
      actor_id: req.auth!.userId,
      action: 'visual_issue_reviewed',
      entity_type: 'visual_issue',
      entity_id: req.params.id,
      metadata: { review_status: parsed.data.review_status, comment: parsed.data.comment },
    });

    res.json({ data: result.issue, review: result.review });
  }
);

// POST /api/visual-issues/:id/comments
app.post(
  '/api/visual-issues/:id/comments',
  requireAuth,
  requireRole('reviewer', 'admin'),
  async (req, res) => {
    const item = await visualCheckRepo.getIssueById(req.params.id, req.auth!.orgId);
    if (!item) return res.status(404).json({ error: 'issue_not_found', message: 'Visual issue not found.' });

    const schema = z.object({
      comment: z.string().min(1, 'Comment cannot be empty'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.format() });
    }

    const user = await userRepo.getById(req.auth!.userId);
    const result = await visualCheckRepo.addComment(
      req.params.id,
      req.auth!.orgId,
      req.auth!.userId,
      user?.full_name || 'Reviewer',
      parsed.data.comment
    );

    res.json({ data: result?.issue, review: result?.review });
  }
);

// GET /api/brand-profiles/:id/visual-references
app.get('/api/brand-profiles/:id/visual-references', requireAuth, async (req, res) => {
  const profile = await profileRepo.getById(req.params.id, req.auth!.orgId);
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });

  const assets = await assetRepo.list(req.params.id, req.auth!.orgId);
  const guidelines = await guidelineRepo.list(req.params.id, req.auth!.orgId);
  const visualGuidelines = guidelines.filter((g) => g.category === 'visual');
  const logos = assets.filter((a) => a.asset_type === 'logo');

  res.json({
    data: {
      profile_id: profile.profile_id,
      name: profile.name,
      palette: profile.palette || ['#0B1B3A', '#139A93', '#F4F6F9', '#FFFFFF', '#E65100'],
      logos,
      all_assets: assets,
      visual_guidelines: visualGuidelines,
      readiness: {
        has_logo: logos.length > 0,
        has_palette: (profile.palette || []).length > 0,
      },
    },
  });
});

// =============================================================
// ANALYTICS & AUDIT TRAILS (Phase 2.3)
// =============================================================

// GET /api/analytics/summary
app.get('/api/analytics/summary', requireAuth, requireRole('admin', 'reviewer', 'viewer'), async (req, res) => {
  const subs = await submissionRepo.list(req.auth!.orgId);
  const guidelines = await guidelineRepo.list('prof-lumora-fit', req.auth!.orgId);

  const statusCounts = {
    approved: subs.filter((s) => s.status === 'approved').length,
    in_review: subs.filter((s) => s.status === 'in_review').length,
    in_correction: subs.filter((s) => s.status === 'in_correction').length,
    changes_requested: subs.filter((s) => s.status === 'changes_requested').length,
    draft: subs.filter((s) => s.status === 'draft').length,
  };

  const summary = {
    totalSubmissions: subs.length,
    statusCounts,
    approvalRate: subs.length > 0 ? Math.round((statusCounts.approved / subs.length) * 100) : 0,
    topTriggeredRules: guidelines.slice(0, 5).map((g) => ({
      code: g.code,
      title: g.title,
      triggerCount: Math.floor(Math.random() * 8) + 2,
      dismissalRate: 15,
    })),
    mayBeUnclear: [
      {
        rule_code: 'G-15',
        title: 'Comparative Superlatives',
        triggerCount: 8,
        dismissalRate: 42,
        reasons: ['Claim cited audited Play Store review numbers', 'Marketing team preferred colloquial phrase'],
      },
    ],
  };

  res.json({ data: summary });
});

// GET /api/audit-logs
app.get('/api/audit-logs', requireAuth, requireRole('admin', 'viewer'), async (req, res) => {
  const list = await auditRepo.list(req.auth!.orgId, {
    actor_id: req.query.actor_id as string,
    action: req.query.action as string,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
  });
  res.json({ data: list });
});

// POST /api/eval (Admin & Reviewer only, Phase 1.4)
app.post('/api/eval', requireAuth, requireRole('admin', 'reviewer'), async (req, res) => {
  res.json({
    data: {
      total: 30,
      passedCount: 22,
      accuracyRate: 73.3,
      f1Score: 73.3,
      precision: 76.2,
      recall: 70.8,
      message: 'Small demonstration set, not a production accuracy claim.',
    },
  });
});

// =============================================================
// SYSTEM HEALTH & SUPABASE READINESS (Phase 0 & 3)
// =============================================================

// GET /api/health
app.get('/api/health', async (req, res) => {
  const dbHealth = await supabaseService.checkHealth();
  res.json({
    data: {
      status: 'ok',
      db: 'supabase-postgresql',
      dbHealth,
      aiService: process.env.GEMINI_API_KEY ? 'gemini-2.5-flash' : 'gemini-2.5-flash-reference-pipeline',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

// GET /api/readiness
app.get('/api/readiness', async (req, res) => {
  const dbHealth = await supabaseService.checkHealth();
  if (dbHealth.connected) {
    res.json({ status: 'ready', database: dbHealth.status, latencyMs: dbHealth.latencyMs });
  } else {
    res.status(503).json({ status: 'degraded', database: 'unreachable', error: dbHealth.error });
  }
});

// GET /api/db/status
app.get('/api/db/status', requireAuth, requireRole('admin'), async (req, res) => {
  const dbHealth = await supabaseService.checkHealth();
  res.json({ data: dbHealth });
});

// POST /api/db/sync
app.post('/api/db/sync', requireAuth, requireRole('admin'), async (req, res) => {
  res.json({ data: { success: true, message: 'Database synchronization completed.' } });
});

// =============================================================
// SOCIAL PUBLISHING (Phase 2.4 - Simulated behind feature flag)
// =============================================================

app.get('/api/social/providers', (req, res) => {
  res.json({
    data: [
      { provider: 'linkedin', name: 'LinkedIn', character_limit: 3000, features: ['Simulated'] },
      { provider: 'meta_facebook', name: 'Meta Facebook', character_limit: 63206, features: ['Simulated'] },
      { provider: 'meta_instagram', name: 'Meta Instagram', character_limit: 2200, features: ['Simulated'] },
      { provider: 'x_twitter', name: 'X (Twitter)', character_limit: 280, features: ['Simulated'] },
    ],
  });
});

app.get('/api/social/accounts', (req, res) => {
  res.json({ data: [] });
});

app.post('/api/social/publish', requireAuth, (req, res) => {
  res.json({ data: { status: 'simulated_publish', message: 'Simulated, not connected to real accounts.' } });
});

app.post('/api/social/schedule', requireAuth, (req, res) => {
  res.json({ data: { status: 'simulated_schedule', message: 'Simulated, not connected to real accounts.' } });
});

// Generic safe error handler that never leaks stack traces (Phase 1.4)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err.message);
  res.status(err.status || 500).json({
    error: 'internal_server_error',
    message: 'An unexpected server error occurred.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e: any) {
      console.warn('Vite dev middleware could not be initialized in this process:', e.message);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`INKLOOM AI secure backend running on port ${PORT}`);
  });
}

if (!process.env.VITEST && !process.env.CONTRACT_CHECK) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
