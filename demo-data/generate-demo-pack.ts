/**
 * INKLOOM AI - Demo Data Pack Generator (demo-data/generate-demo-pack.ts)
 * Programmatically generates real PNG images with genuine pixels for testing,
 * golden verification, and judge demos.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DEMO_DIR = path.resolve(process.cwd(), 'demo-data');
const PUBLIC_DEMO_DIR = path.resolve(process.cwd(), 'public/demo-assets');
const LOGOS_DIR = path.join(PUBLIC_DEMO_DIR, 'logos');
const CREATIVES_DIR = path.join(PUBLIC_DEMO_DIR, 'creatives');

// Helper to create SVG for Lumora spiral logo mark
function createLogoSvg(fgHex: string, bgHex?: string, width = 200, height = 200, scaleX = 1.0, scaleY = 1.0): string {
  const scaledW = Math.round(width * scaleX);
  const scaledH = Math.round(height * scaleY);
  const strokeW = Math.round(24 * Math.min(scaleX, scaleY));

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${bgHex ? `<rect width="${width}" height="${height}" fill="${bgHex}"/>` : ''}
      <g transform="translate(${(width - scaledW) / 2}, ${(height - scaledH) / 2}) scale(${scaleX}, ${scaleY})">
        <circle cx="100" cy="100" r="75" fill="none" stroke="${fgHex}" stroke-width="${strokeW}"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="${fgHex}" stroke-width="${strokeW}" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="${fgHex}"/>
      </g>
    </svg>
  `;
}

// Helper to create Foreign/Partner Logo SVG
function createPartnerLogoSvg(width = 140, height = 140): string {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="70,10 88,48 130,54 100,84 107,126 70,106 33,126 40,84 10,54 52,48" fill="#F39C12" stroke="#D35400" stroke-width="4"/>
      <circle cx="70" cy="70" r="18" fill="#8E44AD"/>
    </svg>
  `;
}

export async function generateDemoPack() {
  console.log('Generating INKLOOM AI Demo Assets with real pixel rendering...');

  // Ensure directories exist
  [DEMO_DIR, PUBLIC_DEMO_DIR, LOGOS_DIR, CREATIVES_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  // 1. Approved Brand Hub Logos
  console.log('Rendering approved Brand Hub logos...');
  const tealLogoSvg = createLogoSvg('#139A93', '#FFFFFF', 200, 200);
  const tealLogoBuffer = await sharp(Buffer.from(tealLogoSvg)).png().toBuffer();
  fs.writeFileSync(path.join(LOGOS_DIR, 'lumora_logo_teal.png'), tealLogoBuffer);

  const whiteLogoSvg = createLogoSvg('#FFFFFF', '#0B1B3A', 200, 200);
  const whiteLogoBuffer = await sharp(Buffer.from(whiteLogoSvg)).png().toBuffer();
  fs.writeFileSync(path.join(LOGOS_DIR, 'lumora_logo_white.png'), whiteLogoBuffer);

  // 2. Demo Creatives (11 visual cases)
  console.log('Rendering test creatives...');

  // Case 01: Compliant Banner (Navy/Teal/White, 1:1 Logo)
  const c01Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F4F6F9"/>
      <!-- Header Bar -->
      <rect x="0" y="0" width="800" height="100" fill="#0B1B3A"/>
      <!-- Approved Logo (at x=40, y=20, 60x60) -->
      <g transform="translate(40, 20) scale(0.3)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#139A93" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#139A93" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#139A93"/>
      </g>
      <text x="120" y="60" font-family="sans-serif" font-size="28" font-weight="bold" fill="#FFFFFF">LUMORA FITNESS</text>
      <!-- Hero Body -->
      <rect x="50" y="140" width="700" height="240" rx="12" fill="#FFFFFF"/>
      <text x="90" y="210" font-family="sans-serif" font-size="32" font-weight="bold" fill="#0B1B3A">Move with Intention</text>
      <text x="90" y="250" font-family="sans-serif" font-size="18" fill="#0B1B3A">Grounded mobility routines designed for sustainable daily vitality.</text>
      <!-- Approved Teal CTA Button -->
      <rect x="90" y="280" width="220" height="50" rx="8" fill="#139A93"/>
      <text x="135" y="312" font-family="sans-serif" font-size="18" font-weight="bold" fill="#FFFFFF">Start Free Trial</text>
    </svg>
  `;
  await sharp(Buffer.from(c01Svg)).png().toFile(path.join(CREATIVES_DIR, '01_compliant_banner.png'));

  // Case 02: Compliant Story (Vertical format, Reversed White on Navy)
  const c02Svg = `
    <svg width="600" height="1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="1000" fill="#0B1B3A"/>
      <!-- Approved White Logo -->
      <g transform="translate(240, 120) scale(0.6)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#FFFFFF" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#FFFFFF"/>
      </g>
      <text x="170" y="320" font-family="sans-serif" font-size="36" font-weight="bold" fill="#FFFFFF">Lumora Pro</text>
      <text x="140" y="370" font-family="sans-serif" font-size="20" fill="#F4F6F9">Premium coaching &amp; recovery.</text>
      <rect x="150" y="440" width="300" height="60" rx="30" fill="#139A93"/>
      <text x="215" y="478" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF">Explore Programs</text>
    </svg>
  `;
  await sharp(Buffer.from(c02Svg)).png().toFile(path.join(CREATIVES_DIR, '02_compliant_story.png'));

  // Case 03: Compliant Reversed Light Background
  const c03Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#FFFFFF"/>
      <g transform="translate(60, 60) scale(0.4)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#139A93" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#139A93" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#139A93"/>
      </g>
      <text x="160" y="110" font-family="sans-serif" font-size="26" font-weight="bold" fill="#0B1B3A">Holiday Mobility Guide</text>
      <rect x="60" y="160" width="680" height="260" rx="8" fill="#F4F6F9"/>
      <text x="100" y="240" font-family="sans-serif" font-size="22" fill="#0B1B3A">Gentle 15-minute sequences to keep joints supple while traveling.</text>
    </svg>
  `;
  await sharp(Buffer.from(c03Svg)).png().toFile(path.join(CREATIVES_DIR, '03_compliant_reversed.png'));

  // Case 04: Wrong Colour (Saturated Red #E74C3C CTA & Banner, coverage ~20%)
  const c04Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F4F6F9"/>
      <!-- Saturated Off-Palette Red Header #E74C3C -->
      <rect x="0" y="0" width="800" height="130" fill="#E74C3C"/>
      <g transform="translate(40, 35) scale(0.3)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#FFFFFF" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#FFFFFF"/>
      </g>
      <text x="120" y="75" font-family="sans-serif" font-size="32" font-weight="bold" fill="#FFFFFF">MEGA FLASH SALE</text>
      <!-- Saturated Red Accent Panel -->
      <rect x="60" y="180" width="680" height="180" rx="8" fill="#FFFFFF" stroke="#E74C3C" stroke-width="4"/>
      <rect x="90" y="270" width="240" height="60" rx="6" fill="#E74C3C"/>
      <text x="135" y="307" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF">CLAIM 50% OFF</text>
    </svg>
  `;
  await sharp(Buffer.from(c04Svg)).png().toFile(path.join(CREATIVES_DIR, '04_wrong_colour.png'));

  // Case 05: Stretched Logo (Horizontally stretched 1.50:1 aspect ratio)
  const c05Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F4F6F9"/>
      <rect x="0" y="0" width="800" height="80" fill="#0B1B3A"/>
      <!-- Stretched Lumora Logo (150px wide x 100px tall => 1.5:1 ratio) -->
      <g transform="translate(40, 110) scale(0.75, 0.50)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#139A93" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#139A93" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#139A93"/>
      </g>
      <text x="250" y="170" font-family="sans-serif" font-size="30" font-weight="bold" fill="#0B1B3A">Spring Movement Sprint</text>
    </svg>
  `;
  await sharp(Buffer.from(c05Svg)).png().toFile(path.join(CREATIVES_DIR, '05_stretched_logo.png'));

  // Case 06: Gradient/Shadow Logo Variant (Red-Orange gradient spiral with drop shadow)
  const c06Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="unapprovedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E65100"/>
          <stop offset="100%" stop-color="#E74C3C"/>
        </linearGradient>
        <filter id="heavyShadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="8" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <rect width="800" height="500" fill="#FFFFFF"/>
      <!-- Gradient & Shadowed Logo Mark -->
      <g transform="translate(80, 80) scale(0.6)" filter="url(#heavyShadow)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="url(#unapprovedGrad)" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="url(#unapprovedGrad)" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="url(#unapprovedGrad)"/>
      </g>
      <text x="240" y="150" font-family="sans-serif" font-size="32" font-weight="bold" fill="#0B1B3A">Custom Campaign Edition</text>
    </svg>
  `;
  await sharp(Buffer.from(c06Svg)).png().toFile(path.join(CREATIVES_DIR, '06_gradient_shadow_logo.png'));

  // Case 07: Unapproved Partner Logo Next to Approved One
  const c07Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F4F6F9"/>
      <!-- Approved Logo -->
      <g transform="translate(50, 40) scale(0.35)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#139A93" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#139A93" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#139A93"/>
      </g>
      <text x="140" y="85" font-family="sans-serif" font-size="24" font-weight="bold" fill="#0B1B3A">Lumora Fitness</text>
      <!-- Unauthorized Partner Emblem at bottom right -->
      <g transform="translate(580, 320)">
        <polygon points="70,10 88,48 130,54 100,84 107,126 70,106 33,126 40,84 10,54 52,48" fill="#F39C12" stroke="#D35400" stroke-width="4"/>
        <circle cx="70" cy="70" r="18" fill="#8E44AD"/>
      </g>
      <text x="540" y="470" font-family="sans-serif" font-size="14" fill="#555555">Co-Presented by Apex Energy</text>
    </svg>
  `;
  await sharp(Buffer.from(c07Svg)).png().toFile(path.join(CREATIVES_DIR, '07_unapproved_partner_logo.png'));

  // Case 08: Missing Logo (Zero logo marks on ad creative)
  const c08Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F4F6F9"/>
      <rect x="80" y="100" width="640" height="300" rx="16" fill="#0B1B3A"/>
      <text x="140" y="200" font-family="sans-serif" font-size="38" font-weight="bold" fill="#FFFFFF">Unleash Your Daily Movement</text>
      <text x="140" y="250" font-family="sans-serif" font-size="20" fill="#139A93">Stream 200+ guided coach sessions anytime.</text>
      <rect x="140" y="290" width="220" height="55" rx="8" fill="#139A93"/>
      <text x="180" y="325" font-family="sans-serif" font-size="18" font-weight="bold" fill="#FFFFFF">Join Free Today</text>
    </svg>
  `;
  await sharp(Buffer.from(c08Svg)).png().toFile(path.join(CREATIVES_DIR, '08_missing_logo.png'));

  // Case 09: Low Visibility Logo (Tiny logo 16px high, < 3% of canvas)
  const c09Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#F4F6F9"/>
      <!-- Microscopic Logo (16px x 16px, 3.2% height) -->
      <g transform="translate(60, 40) scale(0.08)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#139A93" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#139A93" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#139A93"/>
      </g>
      <text x="90" y="52" font-family="sans-serif" font-size="12" fill="#0B1B3A">Lumora</text>
      <text x="120" y="260" font-family="sans-serif" font-size="34" font-weight="bold" fill="#0B1B3A">Minimalist Poster Design</text>
    </svg>
  `;
  await sharp(Buffer.from(c09Svg)).png().toFile(path.join(CREATIVES_DIR, '09_low_visibility_logo.png'));

  // Case 10: Clear Space Violation (Logo flush to canvas edge, 3px margin)
  const c10Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#FFFFFF"/>
      <!-- Logo jammed against top-left edge (x=3, y=3) -->
      <g transform="translate(3, 3) scale(0.35)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#139A93" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#139A93" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#139A93"/>
      </g>
      <text x="120" y="200" font-family="sans-serif" font-size="30" font-weight="bold" fill="#0B1B3A">Edge Crowding Demonstration</text>
    </svg>
  `;
  await sharp(Buffer.from(c10Svg)).png().toFile(path.join(CREATIVES_DIR, '10_clear_space_violation.png'));

  // Case 11: Multi-Violation Showpiece (Wrong Red Color + Stretched Logo + Edge Crowding)
  const c11Svg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="500" fill="#E74C3C"/>
      <!-- Stretched logo right on the top margin -->
      <g transform="translate(4, 4) scale(0.45, 0.30)">
        <circle cx="100" cy="100" r="75" fill="none" stroke="#FFFFFF" stroke-width="24"/>
        <path d="M 100 40 A 60 60 0 0 1 160 100 A 30 30 0 0 1 130 100" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="14" fill="#FFFFFF"/>
      </g>
      <text x="120" y="240" font-family="sans-serif" font-size="36" font-weight="bold" fill="#FFFFFF">TRIPLE VIOLATION SHOWPIECE</text>
      <text x="120" y="290" font-family="sans-serif" font-size="18" fill="#FFFFFF">Off-Brand Red Background + Stretched Mark + No Clear Space</text>
    </svg>
  `;
  await sharp(Buffer.from(c11Svg)).png().toFile(path.join(CREATIVES_DIR, '11_multi_violation_showpiece.png'));

  // Edge Cases (413, 415, 422)
  console.log('Rendering edge cases...');

  // Corrupted PNG (Magic bytes valid, body corrupted)
  const corruptHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const corruptBody = Buffer.alloc(500, 0xff);
  fs.writeFileSync(path.join(CREATIVES_DIR, '12_corrupted.png'), Buffer.concat([corruptHeader, corruptBody]));

  // TIFF Format (valid TIFF, rejected with 415)
  const tiffBuffer = await sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 19, g: 154, b: 147 } },
  }).tiff().toBuffer();
  fs.writeFileSync(path.join(CREATIVES_DIR, '13_unsupported.tif'), tiffBuffer);

  // PDF Renamed .png (magic bytes %PDF-1.7, rejected with 415)
  const fakePdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  fs.writeFileSync(path.join(CREATIVES_DIR, '14_pdf_renamed.png'), fakePdf);

  // Also copy to demo-data/ folder
  const demoCreativesDir = path.join(DEMO_DIR, 'creatives');
  const demoLogosDir = path.join(DEMO_DIR, 'logos');
  if (!fs.existsSync(demoCreativesDir)) fs.mkdirSync(demoCreativesDir, { recursive: true });
  if (!fs.existsSync(demoLogosDir)) fs.mkdirSync(demoLogosDir, { recursive: true });

  fs.readdirSync(CREATIVES_DIR).forEach((file) => {
    fs.copyFileSync(path.join(CREATIVES_DIR, file), path.join(demoCreativesDir, file));
  });
  fs.readdirSync(LOGOS_DIR).forEach((file) => {
    fs.copyFileSync(path.join(LOGOS_DIR, file), path.join(demoLogosDir, file));
  });

  // Write manifest.json
  const manifest = {
    version: '2.1.0',
    generated_at: new Date().toISOString(),
    benchmark_note: 'Ground-truth test set for pixel-level visual brand checking.',
    cases: [
      {
        id: 'case-01',
        filename: '01_compliant_banner.png',
        title: 'Compliant Showcase Banner',
        expected_status: 'compliant',
        expected_violations_count: 0,
        expected_findings: [],
      },
      {
        id: 'case-02',
        filename: '02_compliant_story.png',
        title: 'Compliant Vertical Story (White on Navy)',
        expected_status: 'compliant',
        expected_violations_count: 0,
        expected_findings: [],
      },
      {
        id: 'case-03',
        filename: '03_compliant_reversed.png',
        title: 'Compliant White Background Guide',
        expected_status: 'compliant',
        expected_violations_count: 0,
        expected_findings: [],
      },
      {
        id: 'case-04',
        filename: '04_wrong_colour.png',
        title: 'Unapproved Saturated Red Campaign',
        expected_status: 'action_required',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'color_compliance', severity: 'high', detected_hex: '#E74C3C' },
        ],
      },
      {
        id: 'case-05',
        filename: '05_stretched_logo.png',
        title: 'Stretched Logo Mark (1.5:1 Stretch)',
        expected_status: 'action_required',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'visual_consistency', severity: 'high', title_contains: 'Distortion' },
        ],
      },
      {
        id: 'case-06',
        filename: '06_gradient_shadow_logo.png',
        title: 'Gradient & Shadow Logo Variant',
        expected_status: 'action_required',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'logo_compliance', severity: 'critical', title_contains: 'Variation' },
        ],
      },
      {
        id: 'case-07',
        filename: '07_unapproved_partner_logo.png',
        title: 'Unapproved Partner Logo Mark',
        expected_status: 'action_required',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'logo_compliance', severity: 'critical', title_contains: 'Unapproved' },
        ],
      },
      {
        id: 'case-08',
        filename: '08_missing_logo.png',
        title: 'Missing Mandatory Brand Logo (G-18)',
        expected_status: 'action_required',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'logo_compliance', severity: 'high', title_contains: 'Missing' },
        ],
      },
      {
        id: 'case-09',
        filename: '09_low_visibility_logo.png',
        title: 'Undersized Micro Logo (< 4% Canvas)',
        expected_status: 'concerns_detected',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'visual_consistency', severity: 'medium', title_contains: 'Visibility' },
        ],
      },
      {
        id: 'case-10',
        filename: '10_clear_space_violation.png',
        title: 'Clear Space Margin Violation',
        expected_status: 'concerns_detected',
        expected_violations_count: 1,
        expected_findings: [
          { category: 'layout_spacing', severity: 'medium', title_contains: 'Clear Space' },
        ],
      },
      {
        id: 'case-11',
        filename: '11_multi_violation_showpiece.png',
        title: 'Triple Violation Showpiece (Color + Distortion + Margin)',
        expected_status: 'action_required',
        expected_violations_count: 2,
        expected_findings: [
          { category: 'color_compliance' },
          { category: 'visual_consistency' },
        ],
      },
    ],
  };

  fs.writeFileSync(path.join(DEMO_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Demo pack generated successfully in demo-data/ and public/demo-assets/!');
}

if (process.argv[1]?.endsWith('generate-demo-pack.ts')) {
  generateDemoPack().catch(console.error);
}
