import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import {
  hexToLab,
  deltaE2000,
  hexToRgb,
  extractColorsFromData,
  runAutomatedImageBrandCheck,
} from '../src/services/imageAnalysisEngine';
import { signToken } from '../server/auth';
import { SEED_PROFILE, SEED_GUIDELINES, SEED_ASSETS } from '../db/seed';

describe('Automated Image-Based Brand Checking Engine', () => {
  const reviewerToken = signToken({
    user_id: 'u-reviewer-01',
    org_id: 'org-lumora-001',
    role: 'reviewer',
  });

  const creatorToken = signToken({
    user_id: 'u-creator-01',
    org_id: 'org-lumora-001',
    role: 'creator',
  });

  describe('1. Perceptual Color Science (CIE Delta E 2000)', () => {
    it('calculates zero Delta E for identical colors', () => {
      const lab1 = hexToLab('#139A93');
      const lab2 = hexToLab('#139A93');
      const dE = deltaE2000(lab1, lab2);
      expect(dE).toBe(0);
    });

    it('identifies imperceptible or just-noticeable differences within threshold (Delta E <= 2.3)', () => {
      const lab1 = hexToLab('#139A93');
      const lab2 = hexToLab('#149B95');
      const dE = deltaE2000(lab1, lab2);
      expect(dE).toBeLessThanOrEqual(2.3);
    });

    it('identifies severe color mismatch between Loom Teal and Off-Brand Red (Delta E > 45)', () => {
      const tealLab = hexToLab('#139A93');
      const redLab = hexToLab('#E74C3C');
      const dE = deltaE2000(tealLab, redLab);
      expect(dE).toBeGreaterThan(45);
    });

    it('correctly maps RGB values from hex codes', () => {
      const rgb = hexToRgb('#139A93');
      expect(rgb).toEqual([19, 154, 147]);
    });
  });

  describe('2. Color Extraction and Palette Verification', () => {
    it('extracts colors and marks unapproved red accent with high Delta E', () => {
      const approvedPalette = ['#0B1B3A', '#139A93', '#FBFAF7', '#FFFFFF', '#E65100'];
      const extracted = extractColorsFromData('promo_banner.png', approvedPalette);

      expect(extracted.length).toBeGreaterThan(0);

      // Check that approved Navy and Teal are recognized
      const navy = extracted.find((c) => c.hex === '#0B1B3A');
      expect(navy).toBeDefined();
      expect(navy?.is_approved).toBe(true);

      // Check that red accent #E74C3C is detected as unapproved
      const red = extracted.find((c) => c.hex === '#E74C3C');
      expect(red).toBeDefined();
      expect(red?.is_approved).toBe(false);
      expect(red?.delta_e).toBeGreaterThan(8);
    });
  });

  describe('3. Automated Image Brand Checking Pipeline', () => {
    it('detects unapproved color, logo distortion, and unapproved variation on promo design', async () => {
      const { report } = await runAutomatedImageBrandCheck({
        imageName: 'promo_banner.png',
        imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd',
        mediaItem: {
          name: 'promo_banner.png',
          alt_text: null,
          url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd',
        },
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
      });

      expect(report.status).toBe('completed');
      expect(report.overall_compliance).toBe('action_required');
      expect(report.summary.total).toBeGreaterThanOrEqual(3);

      // 1. Logo distortion issue
      const distortionIssue = report.issues.find((i) => i.category === 'visual_consistency');
      expect(distortionIssue).toBeDefined();
      expect(distortionIssue?.title).toContain('Distortion');
      expect(distortionIssue?.logo_comparison?.detected_aspect_ratio).toBeGreaterThan(1.2);

      // 2. Color compliance issue
      const colorIssue = report.issues.find((i) => i.category === 'color_compliance');
      expect(colorIssue).toBeDefined();
      expect(colorIssue?.color_comparison?.detected_hex).toBe('#E74C3C');

      // 3. Layout / clear space spacing issue
      const spaceIssue = report.issues.find((i) => i.category === 'layout_spacing' || i.category === 'logo_compliance');
      expect(spaceIssue).toBeDefined();

      // 4. Missing Alt Text guideline deviation
      const a11yIssue = report.issues.find((i) => i.category === 'guideline_deviation');
      expect(a11yIssue).toBeDefined();
    });
  });

  describe('4. Backend Visual Check REST API Integration', () => {
    let testSubmissionId: string;
    let testVersionId: string;
    let detectedIssueId: string;

    it('creates a test submission with attached visual media', async () => {
      const createRes = await request(app)
        .post('/api/submissions')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          profile_id: 'prof-lumora-fit',
          title: 'Automated Visual Check Test Campaign',
          content_type: 'social_post',
          body_text: 'Lumora Pro workout banner creative submission.',
          media: [
            {
              name: 'spring_promo_banner.png',
              alt_text: null,
              url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd',
            },
          ],
        });

      expect(createRes.status).toBe(201);
      testSubmissionId = createRes.body.submission.submission_id;
      testVersionId = createRes.body.version.version_id;
      expect(testVersionId).toBeDefined();
    });

    it('executes automated visual check via POST /api/versions/:id/visual-check', async () => {
      const checkRes = await request(app)
        .post(`/api/versions/${testVersionId}/visual-check`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({});

      expect(checkRes.status).toBe(200);
      const report = checkRes.body.data;
      expect(report).toBeDefined();
      expect(report.version_id).toBe(testVersionId);
      expect(Array.isArray(report.issues)).toBe(true);
      expect(report.issues.length).toBeGreaterThan(0);

      detectedIssueId = report.issues[0].issue_id;
      expect(detectedIssueId).toBeDefined();
    });

    it('retrieves visual check report via GET /api/versions/:id/visual-check', async () => {
      const getRes = await request(app)
        .get(`/api/versions/${testVersionId}/visual-check`)
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.version_id).toBe(testVersionId);
    });

    it('allows reviewer to confirm an issue via PATCH /api/visual-issues/:id', async () => {
      const patchRes = await request(app)
        .patch(`/api/visual-issues/${detectedIssueId}`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          review_status: 'confirmed',
          comment: 'Verified on marketing design review. Red accent must be replaced with Loom Teal.',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.review_status).toBe('confirmed');
      expect(patchRes.body.data.reviewer_comment).toContain('Loom Teal');
    });

    it('allows reviewer to mark an issue as false positive', async () => {
      const patchRes = await request(app)
        .patch(`/api/visual-issues/${detectedIssueId}`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          review_status: 'false_positive',
          comment: 'Approved exception for seasonal holiday theme.',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.review_status).toBe('false_positive');
    });

    it('forbids creators from modifying reviewer confirmation status (RBAC guard)', async () => {
      const patchRes = await request(app)
        .patch(`/api/visual-issues/${detectedIssueId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          review_status: 'false_positive',
        });

      expect(patchRes.status).toBe(403);
    });

    it('retrieves visual references via GET /api/brand-profiles/:id/visual-references', async () => {
      const refRes = await request(app)
        .get('/api/brand-profiles/prof-lumora-fit/visual-references')
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(refRes.status).toBe(200);
      expect(refRes.body.data.palette).toBeDefined();
      expect(refRes.body.data.logos).toBeDefined();
      expect(refRes.body.data.logos.length).toBeGreaterThan(0);
    });
  });
});
