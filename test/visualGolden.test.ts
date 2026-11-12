import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyseImage } from '../server/vision/index';
import { deltaE2000, hexToLab, rgbToLab } from '../server/vision/colour';
import { SEED_PROFILE, SEED_GUIDELINES, SEED_ASSETS } from '../db/seed';

const CREATIVES_DIR = path.resolve(process.cwd(), 'public/demo-assets/creatives');
const MANIFEST_PATH = path.resolve(process.cwd(), 'demo-data/manifest.json');

describe('Visual Check Golden Verification Suite', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  // 1. Color Science Standard Verification (Sharma et al. 2005 Delta E 2000 standard)
  describe('CIE Delta E 2000 Formula Accuracy', () => {
    it('returns exactly 0 for identical Lab colors', () => {
      const c1 = { L: 50, a: 25, b: 0 };
      expect(deltaE2000(c1, c1)).toBe(0);
    });

    it('accurately computes perceptual distance on classic test pairs', () => {
      // Pair 1: Lightness difference only
      const dE1 = deltaE2000({ L: 50, a: 0, b: 0 }, { L: 55, a: 0, b: 0 });
      expect(dE1).toBeGreaterThan(4.0);
      expect(dE1).toBeLessThan(6.0);

      // Pair 2: Lumora Teal vs. Off-brand Red
      const tealLab = hexToLab('#139A93');
      const redLab = hexToLab('#E74C3C');
      const dECol = deltaE2000(tealLab, redLab);
      expect(dECol).toBeGreaterThan(40.0);
    });
  });

  // 2. Compliant Controls (Must have 0 violations)
  describe('Compliant Controls Verification', () => {
    it('evaluates 01_compliant_banner.png with 0 violations', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '01_compliant_banner.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '01_compliant_banner.png',
        versionId: 'ver-gold-01',
        submissionId: 'sub-gold-01',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
        mediaItem: {
          name: '01_compliant_banner.png',
          alt_text: 'Lumora Fitness compliant hero showcase banner',
        },
      });

      expect(report.overall_compliance).toBe('compliant');
      const violations = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
      expect(violations.length).toBe(0);
      expect(report.image_sha256).toBeDefined();
    });

    it('evaluates 02_compliant_story.png (reversed white on navy) with 0 violations', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '02_compliant_story.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '02_compliant_story.png',
        versionId: 'ver-gold-02',
        submissionId: 'sub-gold-02',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
        mediaItem: {
          name: '02_compliant_story.png',
          alt_text: 'Lumora Pro vertical story creative',
        },
      });

      expect(report.overall_compliance).toBe('compliant');
      const violations = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
      expect(violations.length).toBe(0);
    });

    it('evaluates 03_compliant_reversed.png with 0 violations', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '03_compliant_reversed.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '03_compliant_reversed.png',
        versionId: 'ver-gold-03',
        submissionId: 'sub-gold-03',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
        mediaItem: {
          name: '03_compliant_reversed.png',
          alt_text: 'Lumora mobility guide on light background',
        },
      });

      expect(report.overall_compliance).toBe('compliant');
      const violations = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
      expect(violations.length).toBe(0);
    });
  });

  // 3. Pixel-Grounded Distortion & Color Ground Truth Cases
  describe('Violation Scenarios Ground Truth', () => {
    it('detects off-palette saturated red in 04_wrong_colour.png', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '04_wrong_colour.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '04_wrong_colour.png',
        versionId: 'ver-gold-04',
        submissionId: 'sub-gold-04',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
      });

      expect(report.overall_compliance).toBe('action_required');
      const colorIssue = report.issues.find((i) => i.category === 'color_compliance');
      expect(colorIssue).toBeDefined();
      expect(colorIssue?.color_comparison?.detected_hex).toBe('#E74C3C');
      expect(colorIssue?.confidence).toBeGreaterThanOrEqual(70);
    });

    it('detects logo distortion (aspect ratio > 1.08) in 05_stretched_logo.png', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '05_stretched_logo.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '05_stretched_logo.png',
        versionId: 'ver-gold-05',
        submissionId: 'sub-gold-05',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
      });

      expect(report.overall_compliance).toBe('action_required');
      const distortIssue = report.issues.find((i) => i.category === 'visual_consistency');
      expect(distortIssue).toBeDefined();
      expect(distortIssue?.title).toContain('Distortion');
      expect(distortIssue?.logo_comparison?.distortion_factor).toBeGreaterThan(1.2);
    });

    it('detects unapproved gradient/shadow mark in 06_gradient_shadow_logo.png', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '06_gradient_shadow_logo.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '06_gradient_shadow_logo.png',
        versionId: 'ver-gold-06',
        submissionId: 'sub-gold-06',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
      });

      expect(report.overall_compliance).toBe('action_required');
      const varIssue = report.issues.find((i) => i.category === 'logo_compliance');
      expect(varIssue).toBeDefined();
      expect(varIssue?.severity).toBe('critical');
    });

    it('detects unapproved partner co-branding emblem in 07_unapproved_partner_logo.png', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '07_unapproved_partner_logo.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '07_unapproved_partner_logo.png',
        versionId: 'ver-gold-07',
        submissionId: 'sub-gold-07',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
      });

      expect(report.overall_compliance).toBe('action_required');
      const partnerIssue = report.issues.find(
        (i) => i.category === 'logo_compliance' && i.title.includes('Unapproved')
      );
      expect(partnerIssue).toBeDefined();
    });

    it('detects missing brand logo (G-18) in 08_missing_logo.png', async () => {
      const imgBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '08_missing_logo.png'));
      const report = await analyseImage({
        imageBuffer: imgBuffer,
        imageName: '08_missing_logo.png',
        versionId: 'ver-gold-08',
        submissionId: 'sub-gold-08',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
      });

      expect(report.overall_compliance).toBe('action_required');
      const missingIssue = report.issues.find(
        (i) => i.category === 'logo_compliance' && i.title.includes('Missing')
      );
      expect(missingIssue).toBeDefined();
    });
  });

  // 4. File-Renaming Invariance Test (Anti-Cheating Verification)
  describe('File-Renaming Invariance Test (Zero filename-based heuristics)', () => {
    it('produces identical visual check results when 01_compliant_banner.png is renamed to random promo.png', async () => {
      const rawBuffer = fs.readFileSync(path.join(CREATIVES_DIR, '01_compliant_banner.png'));

      const reportOriginal = await analyseImage({
        imageBuffer: rawBuffer,
        imageName: '01_compliant_banner.png',
        versionId: 'ver-invariance-orig',
        submissionId: 'sub-invariance-orig',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
        mediaItem: { name: '01_compliant_banner.png', alt_text: 'Test alt' },
      });

      const reportRenamed = await analyseImage({
        imageBuffer: rawBuffer,
        imageName: 'random_marketing_asset_2026_untracked_name.png',
        versionId: 'ver-invariance-renamed',
        submissionId: 'sub-invariance-renamed',
        profile: SEED_PROFILE,
        guidelines: SEED_GUIDELINES,
        assets: SEED_ASSETS,
        mediaItem: { name: 'random_marketing_asset_2026_untracked_name.png', alt_text: 'Test alt' },
      });

      expect(reportRenamed.image_sha256).toBe(reportOriginal.image_sha256);
      expect(reportRenamed.overall_compliance).toBe(reportOriginal.overall_compliance);
      expect(reportRenamed.issues.length).toBe(reportOriginal.issues.length);
      expect(reportRenamed.extracted_colors.length).toBe(reportOriginal.extracted_colors.length);
      expect(reportRenamed.detected_logos.length).toBe(reportOriginal.detected_logos.length);
    });
  });
});
