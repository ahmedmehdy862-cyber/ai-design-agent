# Design Principles — Working Reference (Phase 4)

These are the rules the planning engine (§13) and the Visual QA stage (§15) evaluate against.
Everything stated here must be *measurable* where possible so QA can check it mechanically.

## 1. Hierarchy (visual weight drives reading order)
- Exactly **one dominant element** per composition (the focal point). Its visual weight =
  size × contrast × isolation. Weight ratio dominant : secondary : tertiary ≈ 5 : 3 : 1.
- Reading order test: squint/blur the image — the first shape you can read must be the main message.
- Type scale (ratio 1.25–1.5, modular): at 1080×1350 social post: headline 72–110 pt ·
  subhead 36–48 pt · body 24–30 pt · caption 18–22 pt. Never more than **3 sizes** in one design.

## 2. Contrast
- Text/background contrast ≥ 4.5:1 (WCAG AA) for body, ≥ 3:1 for large text (≥ 36 px).
  Compute: relative luminance L = 0.2126R + 0.7152G + 0.0722B (linearized), ratio = (L1+0.05)/(L2+0.05).
- Contrast is created by: value (light/dark), saturation (grey vs color), size, and isolation.
  Do not stack two "loud" contrast types (huge type AND saturated bg AND shadow).

## 3. Alignment, grid & spacing
- Nothing floats: every element aligns to a grid line or a shared edge. Preferred margins:
  6–8% of the short side (1080 → 66–86 px); safe area for text: inner 90% of canvas.
- Baseline grid for text (multiples of a fixed step, e.g. 12 px).
- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px — gaps come from this list only.
- Optical centre: place the focal point slightly **above** the geometric centre (y ≈ 0.38–0.45 H).

## 4. Balance & negative space
- Balance = distribution of visual weight (not symmetry). Centre-of-mass of non-background
  pixels should sit within ±8% of the intended focal region.
- Negative space is a component: 35–55% of a social post should stay empty. Empty ≠ unfinished;
  clutter (ink > 65%) is a defect. One breathing zone per design minimum.

## 5. Colour
- Palette recipe: 1 **dominant** (~60%) + 1 **secondary** (~30%) + 1 **accent** (~10%);
  or neutral base + single accent. Max 3 hues unless the brief names a brand palette.
- Harmony: analogous (adjacent hues), complementary (opposite; use 80/20 ratio, not 50/50),
  split-complementary, triadic, or monochrome.
- Accent colour is reserved for the focal point / CTA — never spread evenly.
- 60-30-10 must survive quantization of the exported PNG.

## 6. Typography
- Pair by **contrast of role**: one display face + one text face, or one family with weight contrast.
- Track (letter-spacing): display small caps/short lines get +2–5%; long Arabic text: default.
- Line-height 1.25–1.5 (display) / 1.5–1.75 (body); paragraph measure 45–75 characters.
- Rag always faces toward the content, never away. Keep at least 12 px between text and any
  shape edge unless the shape is a chip/plate (then ≥ 0.5 × cap height padding).

## 7. Arabic-specific (this project's default language, RTL)
- RTL text aligns to its natural start (right for horizontal RTL): use `align:"right"`/`"right"`
  justification in layouts unless centring is a deliberate choice (headlines, costumes).
- Arabic needs **larger line-height** (combining marks, dots): +10% vs Latin's recommendation.
- Never mix undotted display faces at small sizes; ≥ 24 px minimum shaped size.
- Numerals (Western/Arabic-Indic) stay LTR inside RTL lines — leave visual space after direction changes.
- Arabic display faces pair with simple Latin faces (or same-family Latin cut), not a second ornate face.

## 8. Composition patterns (pick ONE per design)
- Rule-of-thirds grid · central symmetry (ceremonial) · Z-pattern · F-pattern/stack-in RTL ·
  golden-triangle diagonal. The plan must state which and why (§13 concept + rationale).

## 9. Consistency / identity
- Define once and reuse: brand colors, type scale, corner radius, icon weight, illustration style,
  photography treatment. Any deviation must be in the approved brief.

## 10. What QA must catch mechanically (mapped to metrics)
| Defect | Metric | Threshold |
|---|---|---|
| Blank/flat output | unique-colours count after resize | < 8 unique → FAIL |
| Off-size export | width×height | equals brief |
| Text unreadable | WCAG ratio of text-luma vs local bg | ≥ 4.5 (≥3 large) |
| Misaligned/floating | margin histogram of ink vs grid | deviations > 4 px → WARN |
| Unbalanced | ink centre of mass vs intended focus | > 8% W/H → WARN |
| Cluttered | ink ratio | > 0.65 → WARN, > 0.78 → FAIL |
| Edge spill | ink touching/overflowing outer 4% | → WARN (bleed) off-margin texts |
| Palette creep | count of dominant hues after quantize | > 3 → WARN |
| Focal ambiguity | top-2 saliency blob weights | ratio < 1.3 → WARN |
| Repetitive regeneration | loop counter | stop at `max_retries` (default 3) |

Subjective review (hierarchy, harmony, taste) is a **separate** human/agent pass — never
reported as an objective score (§15).

## 10. Correction loop contract (§15)
1. produce → 2. measure (this file) → 3. rank issues by severity (FAIL > WARN) →
4. apply targeted fix → 5. re-measure → 6. stop when no FAIL and WARNs unimprovable or `max_retries`.
Each correction must cite the issue id it fixes; no blind regeneration.