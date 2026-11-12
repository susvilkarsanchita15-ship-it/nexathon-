# INKLOOM AI — Automated Visual Brand Checking Methodology

**Version:** 2.1.0-cv-pixel  
**Architecture:** Deterministic Pixel-Grounded Computer Vision + Optional Gemini AI Corroboration  
**Scope:** Verifiable, reproducible brand compliance auditing derived directly from decoded image buffers.

---

## 1. Executive Summary & Design Principles

The INKLOOM AI Automated Visual Brand Check transforms prototype mockups into an authentic, mathematically sound computer vision pipeline. The engine adheres to four core engineering principles:

1. **Pixel-Grounded Determinism:** Every confidence score, aspect ratio, color distance ($\Delta E$), bounding box, and margin measurement is computed from raw RGB pixel buffers. Zero hardcoded results, zero canned outputs.
2. **Offline-First Resilience:** The system runs 100% deterministically without requiring an active external AI API or internet connection.
3. **CIE Color Science Standard:** Color distances are evaluated using the official ISO/CIE **Delta E 2000** ($\Delta E_{00}$) formula, mirroring human perceptual vision rather than flawed Euclidean RGB distances.
4. **Human-in-the-Loop Authority:** Automated checks surface explainable evidence with exact coordinate bounding boxes and mathematical formulas, but never auto-approve or auto-reject submissions. Final decision authority rests with human brand reviewers.

---

## 2. Stage-by-Stage Vision Pipeline

```
[Uploaded Image Buffer]
       │
       ▼
1. Validation Gate (Magic Bytes: PNG/JPEG/WebP, <=10MB, 200-8000px, decompression bomb protection)
       │
       ▼
2. Normalization & Decoding (EXIF orientation, alpha flattening on white, downscale <=1024px, SHA-256)
       │
       ▼
3. Color Engine (5-bit spatial bucketing, CIE L*a*b* conversion, CIE Delta E 2000, confidence formula)
       │
       ▼
4. Logo & Geometry Engine (Multi-scale template matching, 64x64 binary mask IoU, aspect ratio stretch factor)
       │
       ▼
5. Layout & Accessibility Engine (25% clear space margins, relative canvas height >=4%, WCAG AA contrast >=3:1)
       │
       ▼
6. AI Corroboration (Optional Gemini 2.5 Flash second opinion with strict JSON schema & geometry validation)
       │
       ▼
7. Fusion & Deduplication (IoU-based spatial deduplication, deterministic-first precedence, timing telemetry)
       │
       ▼
[Persistent Visual Check Report + Append-Only Audit Log]
```

---

## 3. Mathematical Foundations

### 3.1 CIE L\*a\*b\* Color Space Conversion

Images are decoded from sRGB space into linear RGB, converted to standard CIE 1931 XYZ with standard D65 illuminant white point ($X_n = 95.047, Y_n = 100.000, Z_n = 108.883$), and transformed into perceptual $L^*a^*b^*$:

#### Step 1: sRGB Linearization
$$V_{\text{linear}} = \begin{cases} \frac{V}{12.92} & \text{if } V \le 0.04045 \\ \left(\frac{V + 0.055}{1.055}\right)^{2.4} & \text{if } V > 0.04045 \end{cases}$$

#### Step 2: Linear RGB to CIE XYZ
$$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \begin{bmatrix} 0.4124564 & 0.3575761 & 0.1804375 \\ 0.2126729 & 0.7151522 & 0.0721750 \\ 0.0193339 & 0.1191920 & 0.9503041 \end{bmatrix} \begin{bmatrix} R_{\text{linear}} \times 100 \\ G_{\text{linear}} \times 100 \\ B_{\text{linear}} \times 100 \end{bmatrix}$$

#### Step 3: XYZ to CIE L\*a\*b\*
$$f(t) = \begin{cases} t^{1/3} & \text{if } t > \left(\frac{6}{29}\right)^3 \\ \frac{1}{3}\left(\frac{29}{6}\right)^2 t + \frac{4}{29} & \text{otherwise} \end{cases}$$

$$L^* = 116 \cdot f\left(\frac{Y}{Y_n}\right) - 16, \quad a^* = 500 \left[f\left(\frac{X}{X_n}\right) - f\left(\frac{Y}{Y_n}\right)\right], \quad b^* = 200 \left[f\left(\frac{Y}{Y_n}\right) - f\left(\frac{Z}{Z_n}\right)\right]$$

---

### 3.2 CIE Delta E 2000 ($\Delta E_{00}$) Formula

The CIEDE2000 formula corrects perceptual non-uniformities in earlier $\Delta E$ metrics (particularly in the blue region and low-chroma neutrals):

$$\Delta E_{00} = \sqrt{\left(\frac{\Delta L'}{k_L S_L}\right)^2 + \left(\frac{\Delta C'}{k_C S_C}\right)^2 + \left(\frac{\Delta H'}{k_H S_H}\right)^2 + R_T \left(\frac{\Delta C'}{k_C S_C}\right) \left(\frac{\Delta H'}{k_H S_H}\right)}$$

Where:
- $S_L = 1 + \frac{0.015(\bar{L}' - 50)^2}{\sqrt{20 + (\bar{L}' - 50)^2}}$
- $S_C = 1 + 0.045 \bar{C}'$
- $S_H = 1 + 0.015 \bar{C}' T$
- $R_T = -\sin(2\Delta\theta) R_C$ (rotation function resolving blue region non-linearity)
- Parametric weighting factors: $k_L = 1, k_C = 1, k_H = 1$.

#### Interpretation Thresholds:
- $\Delta E_{00} \le 2.3$: JND (Just Noticeable Difference), visually indistinguishable.
- $2.3 < \Delta E_{00} \le 5.0$: Perceptible display/print variation (acceptable tolerance).
- $5.0 < \Delta E_{00} \le 8.0$: Near-miss warning / tint shift (Low severity).
- $\Delta E_{00} > 8.0$: Clear off-brand hue violation (High/Critical severity if saturated).

---

### 3.3 Deterministic Color Violation Confidence

Instead of arbitrary confidence scores, color violations compute confidence via a bounded, continuous formula:

$$\text{Confidence} = 0.50 + 0.25 \times \min\left(1, \frac{\Delta E - 12}{30}\right) + 0.15 \times \min\left(1, \frac{\text{cov}}{20}\right) + 0.09 \times \min\left(1, \frac{C^* - 25}{40}\right)$$

Clamped to $[0.50, 0.99]$.
- **$\Delta E$ distance:** Higher perceptual distance increases certainty.
- **Coverage ($\text{cov}\%$):** Larger pixel clusters carry higher statistical significance.
- **Chroma ($C^* = \sqrt{a^{*2} + b^{*2}}$):** Highly saturated non-palette accents carry higher visual impact than neutral tones.

---

### 3.4 Multi-Scale 64×64 Binary Mask Template Matching & IoU

To verify logo marks without heavy GPU deep-learning models, the engine uses multi-scale 64×64 normalized binary mask Intersection-over-Union (IoU):

$$\text{IoU}(M_{\text{candidate}}, M_{\text{reference}}) = \frac{\sum_{i=0}^{4095} (M_{\text{cand}}[i] \land M_{\text{ref}}[i])}{\sum_{i=0}^{4095} (M_{\text{cand}}[i] \lor M_{\text{ref}}[i])}$$

- Scales evaluated: $h \in \{40, 60, 75, 80, 100, 120, 140\}\text{ px}$.
- Aspect stretches evaluated: $a \in \{1.0, 1.25, 1.5, 1.7\}$.
- Sliding window step: $\le 12\text{ px}$.
- Match threshold: $\text{IoU} \ge 0.40$.

---

### 3.5 Aspect Ratio & Distortion Factor

The canonical Lumora mark has a strict **1:1 aspect ratio** ($AR_{\text{approved}} = 1.0$).
Detected aspect ratio is computed as:

$$AR_{\text{detected}} = \frac{W_{\text{mark}}}{H_{\text{mark}}}$$
$$\text{Distortion Factor} = \frac{AR_{\text{detected}}}{AR_{\text{approved}}}$$

- **Tolerance:** 8% ($| \text{Distortion Factor} - 1.0 | \le 0.08$).
- **Violation:** If $| \text{Distortion Factor} - 1.0 | > 0.08$, an issue of category `visual_consistency` is flagged with the exact stretch percentage $\text{Stretch}\% = | \text{Distortion Factor} - 1.0 | \times 100$.

---

### 3.6 Clear Space & Layout Spacing

Guideline **G-16** mandates minimum **25% clear space** around brand marks:

$$\text{Required Margin} = 0.25 \times H_{\text{logo}}$$
$$\text{Detected Margin} = \min(\text{margin}_{\text{left}}, \text{margin}_{\text{top}}, \text{margin}_{\text{right}}, \text{margin}_{\text{bottom}})$$

If $\text{Detected Margin} < \text{Required Margin}$, an issue of category `layout_spacing` is recorded with precise pixel measurements.

---

### 3.7 WCAG AA Contrast Ratio

Text and logo legibility against adjacent backgrounds is verified using standard WCAG 2.1 relative luminance:

$$L = 0.2126 R_{\text{linear}} + 0.7152 G_{\text{linear}} + 0.0722 B_{\text{linear}}$$
$$\text{Contrast Ratio} = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05}$$

- Minimum ratio for graphical objects and large elements: **3.0:1**.

---

## 4. Human-in-the-Loop Review State Machine

```
              ┌───────────────┐
              │  unreviewed   │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  ┌───────────┐ ┌───────────┐ ┌──────────────────┐
  │ confirmed │ │ false_pos │ │ needs_correction │
  └─────┬─────┘ └───────────┘ └──────────────────┘
        │
   (Rerun check)
        ▼
  Carried-forward status preserved with review history
```

All status changes and comments are stored in the append-only `visual_issue_reviews` table with actor attribution (`user_id`, `role`, timestamp) to maintain an audit trail.

---

## 5. File-Renaming Invariance (Anti-Cheating Assurance)

The engine never inspects filenames to infer compliance. All inferences are derived from:
- `sha256` of decoded pixel bytes.
- Direct color quantization of image raster data.
- Normalized 64×64 binary mask matching against Brand Hub assets.
- Explicit margin calculations against image bounds.

Renaming `01_compliant_banner.png` to `arbitrary_campaign_final.png` yields byte-for-byte identical findings, timings, and compliance verdicts.
