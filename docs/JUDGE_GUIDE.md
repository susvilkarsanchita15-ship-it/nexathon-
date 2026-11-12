# INKLOOM AI — Judge & Evaluator Demonstration Guide

**Applet Version:** 2.1.0-cv-pixel  
**Target Flow:** Automated Brand Visual Check Verification (Judge-Ready)  
**Estimated Walkthrough Time:** 3 minutes

---

## 1. Fast 3-Minute Demo Walkthrough

### Minute 1: The Brand Hub & Visual Ground Truth
1. In the navigation bar, click **Brand Hub**.
2. Examine the **Visual Identity & Color Palette**:
   - Official Primary: **Lumora Navy** (`#0B1B3A`) and **Lumora Teal** (`#139A93`).
   - Approved Accents: `#F4F6F9`, `#FFFFFF`, `#E65100`.
3. View **Approved Logos**:
   - Master Logo (Teal on White): `ast-01` (Canonical 1:1 aspect ratio).
   - Reversed Logo (White on Navy): `ast-03`.
4. View **Active Visual Guidelines**:
   - `G-16`: Logo Clear Space (minimum 25%) & Aspect Ratio (strict 1:1).
   - `G-17`: Approved Logo Color Variations (Teal on Light or White on Dark).
   - `G-18`: Logo Requirement on All Marketing Creatives.

---

### Minute 2: Submissions & Automated Visual Brand Check
1. In the navigation bar, click **Review Queue** (logged in as Reviewer `Sarah Lin`).
2. Select any submission with visual media (e.g. `sub-demo-01` or `sub-demo-11`).
3. Click the **"Automated Visual Check"** tab.
4. Click **"Run Automated Check"**:
   - Watch the 5-stage progress indicator:
     `Validating media bytes` ➔ `Decoding pixels & SHA-256` ➔ `CIE L*a*b* ΔE 2000 color clustering` ➔ `64×64 binary mask IoU logo detection` ➔ `Layout & Clear Space verification`.
5. Examine the **Interactive Canvas & Bounding Boxes**:
   - Hover or click on the detected bounding boxes overlaid on the creative.
   - Inspect the **Color Stop Swatches** showing detected vs. closest approved HEX and calculated $\Delta E$.
   - Inspect the **Logo Proportion Comparison** showing detected vs. canonical aspect ratio.

---

### Minute 3: Reviewer Sign-Off & Engine Trace Verification
1. Click on a detected issue in the findings list:
   - Click **"Confirm Violation"**: enter an optional review note (e.g. *"Confirmed on marketing review. Replace red accent with Loom Teal."*).
   - Notice the status immediately updates to `Confirmed` and the badge turns amber.
   - Click **"Mark as False Positive"**: enters a review exception.
2. Open the **"How this was computed"** Engine Trace Disclosure at the bottom:
   - View the calculated `image_sha256` hash.
   - View the exact runtime timings: `validate_ms`, `decode_ms`, `colour_ms`, `logo_ms`, `layout_ms`, `total_ms`.
   - View the mathematical formula used for confidence score calculation.
3. Switch to the **"Manual Comparison"** tab:
   - Drag the **Overlay Blend Slider (0% - 100%)** to visually superimpose the approved vector mark over the detected creative logo to manually verify proportions.

---

## 2. Testing Ground-Truth Scenarios (1-Click Presets)

In **New Submission** (`/submit`), select any preset from the **"Demo Visual Creative"** dropdown:

| Preset Scenario | Test Creative | Expected Outcome | What the Engine Derives |
|---|---|---|---|
| **Compliant Banner** | `01_compliant_banner.png` | `compliant` (0 violations) | $\Delta E = 0.0$ on Teal/Navy, 1:1 aspect ratio, margin $\ge 25\%$. |
| **Compliant Story** | `02_compliant_story.png` | `compliant` (0 violations) | Reversed white mark on navy, 1:1 ratio, 0 violations. |
| **Unapproved Red** | `04_wrong_colour.png` | `action_required` (1 violation) | `#E74C3C` detected with $\Delta E = 35.4$, 22% coverage, 91% confidence. |
| **Stretched Logo** | `05_stretched_logo.png` | `action_required` (1 violation) | Detected aspect ratio $1.50:1$ vs $1.0:1$ ($50\%$ horizontal stretch). |
| **Gradient/Shadow** | `06_gradient_shadow_logo.png` | `action_required` (1 violation) | Non-certified gradient/shadow mark flagged with $\Delta E > 40$. |
| **Unapproved Partner** | `07_unapproved_partner_logo.png` | `action_required` (1 violation) | Foreign starburst emblem with $\text{IoU} < 40\%$ against Brand Hub. |
| **Missing Logo** | `08_missing_logo.png` | `action_required` (1 violation) | Zero approved logo matches across canvas, violating guideline `G-18`. |
| **Undersized Logo** | `09_low_visibility_logo.png` | `concerns_detected` (1 violation) | Logo height is only $3.2\%$ of canvas height ($< 4\%$ threshold). |
| **Edge Crowding** | `10_clear_space_violation.png` | `concerns_detected` (1 violation) | Top/left margin is $3\text{ px}$ vs $18\text{ px}$ required clear space ($25\%$). |
| **Triple Violation** | `11_multi_violation_showpiece.png` | `action_required` (3 violations) | Flagged for Off-brand Red + Stretched Mark + Edge Crowding. |

---

## 3. How to Verify Nothing is "Canned" (Anti-Cheat Proofs)

Judges can verify that this is a genuine computer-vision engine in three ways:

1. **The File-Renaming Invariance Test:**
   - Take `01_compliant_banner.png` and rename it to `my_random_ad_xyz.png`.
   - Upload it via the submission form.
   - The engine produces identical findings, exact SHA-256 hash, and clean pass verdict.
2. **Custom Image Upload:**
   - Upload any arbitrary JPEG, PNG, or WebP image from your computer.
   - Watch the engine extract the real dominant colors and compute real $\Delta E$ perceptual distances against the Lumora palette.
3. **Inspect the Benchmark CLI:**
   - Run `npx tsx scripts/demo-check.ts` in the terminal.
   - The script iterates through the test suite, prints the raw timing breakdown, and outputs precision, recall, and F1 metrics to `docs/VISUAL_EVAL_RESULTS.md`.
