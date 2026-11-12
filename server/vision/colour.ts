/**
 * INKLOOM AI - Color Compliance & Perceptual Color Science (server/vision/colour.ts)
 * Decodes pixels into CIELab, quantizes color clusters, computes exact CIE Delta E 2000,
 * extracts spatial cluster regions, and calculates deterministic confidence scores.
 */

import { DecodedImage } from './decode';
import {
  ExtractedColorItem,
  VisualBrandIssue,
  DetectedRegion,
} from '../../src/types/inkloom';

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

// -------------------------------------------------------------
// COLOR CONVERSIONS (sRGB -> Linear -> XYZ -> CIELab)
// -------------------------------------------------------------

export function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(v * 255)));
}

export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rL = srgbToLinear(r);
  const gL = srgbToLinear(g);
  const bL = srgbToLinear(b);

  // sRGB D65 transformation matrix
  const x = rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375;
  const y = rL * 0.2126729 + gL * 0.7151522 + bL * 0.072175;
  const z = rL * 0.0193339 + gL * 0.119192 + bL * 0.9503041;

  return [x * 100, y * 100, z * 100];
}

export function xyzToLab(x: number, y: number, z: number): LabColor {
  // D65 reference white
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let xR = x / refX;
  let yR = y / refY;
  let zR = z / refZ;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fX = f(xR);
  const fY = f(yR);
  const fZ = f(zR);

  return {
    L: Math.max(0, 116 * fY - 16),
    a: 500 * (fX - fY),
    b: 200 * (fY - fZ),
  };
}

export function rgbToLab(r: number, g: number, b: number): LabColor {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function hexToLab(hex: string): LabColor {
  const [r, g, b] = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function getChroma(lab: LabColor): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

// -------------------------------------------------------------
// CIE DELTA E 2000 (Exact ISO/CIE Standard)
// -------------------------------------------------------------

export function deltaE2000(c1: LabColor, c2: LabColor): number {
  const L1 = c1.L;
  const a1 = c1.a;
  const b1 = c1.b;

  const L2 = c2.L;
  const a2 = c2.a;
  const b2 = c2.b;

  const avgL = (L1 + L2) / 2;
  const c1Star = Math.sqrt(a1 * a1 + b1 * b1);
  const c2Star = Math.sqrt(a2 * a2 + b2 * b2);
  const avgCStar = (c1Star + c2Star) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgCStar, 7) / (Math.pow(avgCStar, 7) + Math.pow(25, 7))));

  const a1Prime = (1 + G) * a1;
  const a2Prime = (1 + G) * a2;

  const c1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const c2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const h1Prime =
    Math.atan2(b1, a1Prime) >= 0
      ? (Math.atan2(b1, a1Prime) * 180) / Math.PI
      : (Math.atan2(b1, a1Prime) * 180) / Math.PI + 360;

  const h2Prime =
    Math.atan2(b2, a2Prime) >= 0
      ? (Math.atan2(b2, a2Prime) * 180) / Math.PI
      : (Math.atan2(b2, a2Prime) * 180) / Math.PI + 360;

  const deltaLPrime = L2 - L1;
  const deltaCPrime = c2Prime - c1Prime;

  let deltahPrime = 0;
  if (c1Prime * c2Prime !== 0) {
    if (Math.abs(h2Prime - h1Prime) <= 180) {
      deltahPrime = h2Prime - h1Prime;
    } else if (h2Prime - h1Prime > 180) {
      deltahPrime = h2Prime - h1Prime - 360;
    } else {
      deltahPrime = h2Prime - h1Prime + 360;
    }
  }

  const deltaHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin((deltahPrime * Math.PI) / 360);

  const avgLPrime = (L1 + L2) / 2;
  const avgCPrime = (c1Prime + c2Prime) / 2;

  let avghPrime = 0;
  if (c1Prime * c2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      avghPrime = (h1Prime + h2Prime) / 2;
    } else if (h1Prime + h2Prime < 360) {
      avghPrime = (h1Prime + h2Prime + 360) / 2;
    } else {
      avghPrime = (h1Prime + h2Prime - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(((avghPrime - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * avghPrime) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avghPrime + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avghPrime - 63) * Math.PI) / 180);

  const deltaTheta = 30 * Math.exp(-Math.pow((avghPrime - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(avgCPrime, 7) / (Math.pow(avgCPrime, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(avgLPrime - 50, 2)) / Math.sqrt(20 + Math.pow(avgLPrime - 50, 2));
  const SC = 1 + 0.045 * avgCPrime;
  const SH = 1 + 0.015 * avgCPrime * T;
  const RT = -Math.sin((2 * deltaTheta * Math.PI) / 180) * RC;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const termL = deltaLPrime / (kL * SL);
  const termC = deltaCPrime / (kC * SC);
  const termH = deltaHPrime / (kH * SH);

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}

// -------------------------------------------------------------
// PIXEL QUANTIZATION & CLUSTERING
// -------------------------------------------------------------

interface RawBucket {
  count: number;
  rSum: number;
  gSum: number;
  bSum: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PixelCluster {
  hex: string;
  rgb: [number, number, number];
  lab: LabColor;
  chroma: number;
  pixelCount: number;
  coverage: number;
  region: DetectedRegion;
}

/**
 * Quantizes image pixels into 5-bit color buckets and merges near clusters.
 */
export function extractPixelClusters(decoded: DecodedImage): PixelCluster[] {
  const { width, height, rawBuffer } = decoded;
  const totalPixels = width * height;
  const buckets = new Map<number, RawBucket>();

  // Use stride = 1 for accurate color analysis
  const step = totalPixels > 500000 ? 2 : 1;
  let sampledPixels = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 3;
      const r = rawBuffer[idx];
      const g = rawBuffer[idx + 1];
      const b = rawBuffer[idx + 2];
      sampledPixels++;

      // 5-bit quantize (32 levels per channel)
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
        existing.rSum += r;
        existing.gSum += g;
        existing.bSum += b;
        if (x < existing.minX) existing.minX = x;
        if (y < existing.minY) existing.minY = y;
        if (x > existing.maxX) existing.maxX = x;
        if (y > existing.maxY) existing.maxY = y;
      } else {
        buckets.set(key, {
          count: 1,
          rSum: r,
          gSum: g,
          bSum: b,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
        });
      }
    }
  }

  // Convert buckets to initial clusters
  const initialClusters: PixelCluster[] = [];
  for (const bucket of buckets.values()) {
    const rMean = Math.round(bucket.rSum / bucket.count);
    const gMean = Math.round(bucket.gSum / bucket.count);
    const bMean = Math.round(bucket.bSum / bucket.count);
    const hex = rgbToHex(rMean, gMean, bMean);
    const lab = rgbToLab(rMean, gMean, bMean);
    const coverage = (bucket.count / sampledPixels) * 100;

    // Convert pixel coordinates to percentage 0-100
    const xPct = Math.round((bucket.minX / width) * 100);
    const yPct = Math.round((bucket.minY / height) * 100);
    const wPct = Math.max(2, Math.round(((bucket.maxX - bucket.minX) / width) * 100));
    const hPct = Math.max(2, Math.round(((bucket.maxY - bucket.minY) / height) * 100));

    initialClusters.push({
      hex,
      rgb: [rMean, gMean, bMean],
      lab,
      chroma: getChroma(lab),
      pixelCount: bucket.count,
      coverage,
      region: { x: xPct, y: yPct, width: wPct, height: hPct },
    });
  }

  // Sort by count descending
  initialClusters.sort((a, b) => b.pixelCount - a.pixelCount);

  // Merge clusters whose Delta E < 4.0 (perceptually equivalent)
  const merged: PixelCluster[] = [];
  for (const c of initialClusters) {
    let match = merged.find((m) => deltaE2000(m.lab, c.lab) < 4.0);
    if (match) {
      // Merge into match
      const totalCount = match.pixelCount + c.pixelCount;
      const r = Math.round((match.rgb[0] * match.pixelCount + c.rgb[0] * c.pixelCount) / totalCount);
      const g = Math.round((match.rgb[1] * match.pixelCount + c.rgb[1] * c.pixelCount) / totalCount);
      const b = Math.round((match.rgb[2] * match.pixelCount + c.rgb[2] * c.pixelCount) / totalCount);

      match.pixelCount = totalCount;
      match.coverage = (totalCount / sampledPixels) * 100;
      match.rgb = [r, g, b];
      match.hex = rgbToHex(r, g, b);
      match.lab = rgbToLab(r, g, b);
      match.chroma = getChroma(match.lab);

      // Expand bounding box
      const minX = Math.min(match.region.x, c.region.x);
      const minY = Math.min(match.region.y, c.region.y);
      const maxX = Math.max(match.region.x + match.region.width, c.region.x + c.region.width);
      const maxY = Math.max(match.region.y + match.region.height, c.region.y + c.region.height);
      match.region = {
        x: minX,
        y: minY,
        width: Math.min(100 - minX, maxX - minX),
        height: Math.min(100 - minY, maxY - minY),
      };
    } else {
      merged.push({ ...c });
    }
  }

  // Filter out microscopic anti-aliasing (< 0.5% coverage)
  return merged.filter((m) => m.coverage >= 0.5).slice(0, 16);
}

// -------------------------------------------------------------
// COLOR COMPLIANCE AUDITING
// -------------------------------------------------------------

export interface ColorAuditResult {
  extractedColors: ExtractedColorItem[];
  colorIssues: VisualBrandIssue[];
}

/**
 * Computes deterministic confidence for color violation.
 * Formula: 0.5 + 0.25*min(1, (ΔE-12)/30) + 0.15*min(1, cov/20) + 0.09*min(1, (C*-25)/40)
 * Clamped to 0.50 .. 0.99
 */
export function computeColorConfidence(deltaE: number, coverage: number, chroma: number): number {
  const dScore = 0.25 * Math.min(1, Math.max(0, (deltaE - 12) / 30));
  const covScore = 0.15 * Math.min(1, Math.max(0, coverage / 20));
  const chromaScore = 0.09 * Math.min(1, Math.max(0, (chroma - 25) / 40));
  const total = 0.5 + dScore + covScore + chromaScore;
  return Math.min(0.99, Math.max(0.5, Math.round(total * 100) / 100));
}

export function auditColorsAgainstPalette(
  clusters: PixelCluster[],
  approvedPalette: string[],
  imageName: string
): ColorAuditResult {
  const paletteLabs = approvedPalette.map((hex) => ({
    hex,
    lab: hexToLab(hex),
  }));

  const extractedColors: ExtractedColorItem[] = [];
  const colorIssues: VisualBrandIssue[] = [];

  for (const cluster of clusters) {
    // Find closest approved palette color
    let minDeltaE = Infinity;
    let closestHex = approvedPalette[0] || '#0B1B3A';

    for (const p of paletteLabs) {
      const dE = deltaE2000(cluster.lab, p.lab);
      if (dE < minDeltaE) {
        minDeltaE = dE;
        closestHex = p.hex;
      }
    }

    const roundedDE = Math.round(minDeltaE * 10) / 10;
    const isApproved = roundedDE <= 5.0;

    extractedColors.push({
      hex: cluster.hex,
      rgb: cluster.rgb,
      percentage: Math.round(cluster.coverage * 10) / 10,
      is_approved: isApproved,
      closest_approved_hex: closestHex,
      delta_e: roundedDE,
    });

    // Check for violations vs near-misses
    // Neutrals (chroma C* < 12) like white, light gray, black are not flagged
    if (cluster.chroma < 12) {
      continue;
    }

    // Violation condition: Delta E > 8.0, coverage >= 3%, and chroma C* >= 20 (saturated off-palette)
    if (roundedDE > 8.0 && cluster.coverage >= 3.0 && cluster.chroma >= 20.0) {
      const confidence = computeColorConfidence(roundedDE, cluster.coverage, cluster.chroma);
      const isHighSeverity = cluster.coverage >= 15.0 || cluster.region.y < 35; // Hero or CTA area

      colorIssues.push({
        issue_id: `vis-col-${Math.random().toString(36).substring(2, 9)}`,
        image_name: imageName,
        title: `Incorrect Brand Colour (${cluster.hex})`,
        category: 'color_compliance',
        severity: isHighSeverity ? 'high' : 'medium',
        confidence: Math.round(confidence * 100),
        confidence_basis: {
          delta_e: roundedDE,
          coverage_pct: Math.round(cluster.coverage * 10) / 10,
          chroma: Math.round(cluster.chroma * 10) / 10,
          formula: '0.50 + 0.25*min(1,(ΔE-12)/30) + 0.15*min(1,cov/20) + 0.09*min(1,(C*-25)/40)',
        },
        description: `Detected prominent unapproved color ${cluster.hex} with ${cluster.coverage.toFixed(1)}% canvas coverage. Perceptual distance ΔE = ${roundedDE} from closest approved brand color ${closestHex}.`,
        expected_rule: `Use approved brand palette colors (Closest: ${closestHex}). Saturated off-palette colors violate visual guidelines.`,
        detected_result: `Detected off-palette color ${cluster.hex} (ΔE = ${roundedDE}, Chroma = ${cluster.chroma.toFixed(1)}).`,
        recommendation: `Replace ${cluster.hex} with approved brand color ${closestHex} or certified secondary accent.`,
        region: cluster.region,
        color_comparison: {
          expected_hex: closestHex,
          detected_hex: cluster.hex,
          delta_e: roundedDE,
          coverage_percentage: Math.round(cluster.coverage * 10) / 10,
        },
        review_status: 'unreviewed',
      });
    } else if (roundedDE > 4.5 && roundedDE <= 8.0 && cluster.coverage >= 3.0 && cluster.chroma >= 15.0) {
      // Near miss (possible concern, Low severity)
      const confidence = 0.65;
      colorIssues.push({
        issue_id: `vis-col-near-${Math.random().toString(36).substring(2, 9)}`,
        image_name: imageName,
        title: `Minor Colour Variance (${cluster.hex})`,
        category: 'color_compliance',
        severity: 'low',
        confidence: Math.round(confidence * 100),
        confidence_basis: {
          delta_e: roundedDE,
          coverage_pct: Math.round(cluster.coverage * 10) / 10,
          chroma: Math.round(cluster.chroma * 10) / 10,
          formula: 'Near-miss threshold (5 < ΔE ≤ 12)',
        },
        description: `Color ${cluster.hex} is slightly off-palette (ΔE = ${roundedDE} from ${closestHex}). May be an uncalibrated export profile or tint variation.`,
        expected_rule: `Ensure exact HEX match for ${closestHex} (ΔE ≤ 5.0).`,
        detected_result: `Detected slight color shift (${cluster.hex}, ΔE = ${roundedDE}).`,
        recommendation: `Verify export color profile (sRGB) to avoid unintentional tint shifting.`,
        region: cluster.region,
        color_comparison: {
          expected_hex: closestHex,
          detected_hex: cluster.hex,
          delta_e: roundedDE,
          coverage_percentage: Math.round(cluster.coverage * 10) / 10,
        },
        review_status: 'unreviewed',
      });
    }
  }

  return {
    extractedColors,
    colorIssues,
  };
}
