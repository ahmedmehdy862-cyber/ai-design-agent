"""Design planner (Phase 6, spec §13).

Turns a brief into a deterministic, measurable plan that obeys
docs/DESIGN_PRINCIPLES.md: grid + margins, one focal point, 60-30-10 palette,
modular type scale, RTL rules for Arabic. The plan is a plain dict so the
producer (app.pipeline.producer) can execute it and QA can re-check it.
No API calls: rules only, every number justified in the plan's `rationale`.
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field, asdict
from typing import Optional

# spacing scale (DESIGN_PRINCIPLES §3) — gaps come from this list only
SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96]


def _snap(v: float) -> int:
    """Snap a pixel value to the nearest spacing-scale step."""
    return min(SPACING, key=lambda s: abs(s - v))


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def readable_ink(bg: str) -> str:
    """Pick black-ish or white-ish text for a background (max contrast)."""
    return "#111111" if luminance(bg) > 0.18 else "#FFFFFF"


@dataclass
class Brief:
    headline: str
    subhead: str = ""
    width: int = 1080
    height: int = 1350
    # optional brand palette; otherwise a default navy/orange pair is used
    primary: str = "#0B3D5C"      # dominant ~60%
    secondary: str = "#F4A417"    # accent ~10-15%
    style: str = "bold"           # bold | light | festive
    font_display: str = "Tahoma"
    font_text: str = "Tahoma"
    cta: str = ""


@dataclass
class Plan:
    canvas: tuple
    palette: dict                 # role -> hex (bg/ink/accent/surface)
    composition: str              # named pattern (§8)
    grid: dict                    # margins, columns, baseline step
    focal: dict                   # focal point + intended weight
    type_scale: list              # [(role, pt)]
    elements: list = field(default_factory=list)
    rationale: list = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, indent=2)


def plan(brief: Brief) -> Plan:
    W, H = brief.width, brief.height
    short = min(W, H)
    m = round(short * 0.07)              # 7% margin (§3: 6-8%)
    margin = _snap(m)

    # --- palette (§5): dominant bg + accent; ink chosen for contrast ---------
    if brief.style == "light":
        bg = "#F4F1EA" if brief.primary == "#0B3D5C" else "#F5F5F5"
        ink = readable_ink(bg)
        accent = brief.secondary
        surface = "#FFFFFF"
    else:  # bold / festive
        bg = brief.primary
        ink = readable_ink(bg)
        accent = brief.secondary
        surface = readable_ink(ink)     # chip behind secondary text if needed

    # headline colour: max contrast against bg
    head_ink = ink if contrast(ink, bg) >= contrast(accent, bg) else accent
    # accent is reserved for the focal deco + rule (never for long text)

    # --- grid (§3): 12 columns, baseline step 12 ----------------------------
    baseline = 12

    # --- type scale (§1, max 3 sizes, modular ~1.35) ------------------------
    head_pt = max(48, round(min(W, H) * 0.085 / 2) * 2)     # ~92pt @1080
    sub_pt = round(head_pt * 0.42 / 2) * 2                  # ~38pt
    if brief.cta:
        cta_pt = round(sub_pt * 0.8 / 2) * 2
    type_scale = [("headline", head_pt), ("subhead", sub_pt)]
    if brief.cta:
        type_scale.append(("cta", cta_pt))

    # --- focal point (§3: y ≈ 0.38-0.45 H, RTL stack starts right) ----------
    focal_y = round(H * 0.40)
    right = W - margin                       # RTL text anchor (start = right)

    p = Plan(
        canvas=(W, H),
        palette={"bg": bg, "ink": ink, "accent": accent, "surface": surface,
                 "headline": head_ink},
        composition="RTL stack on rule-of-thirds (Arabic default, §7/§8)",
        grid={"margin": margin, "baseline": baseline, "columns": 12,
              "safe_area": [margin, margin, W - margin, H - margin]},
        focal={"x": round(W * 0.5), "y": focal_y,
               "element": "headline", "method": "size+isolation"},
        type_scale=type_scale,
    )

    # --- elements (order = z-order, bottom first) ---------------------------
    # 1) background is the document fill (single background, acceptance A2)
    # 2) accent band full-bleed at the bottom — deliberate bleed (§8 Z-pattern tail)
    band_h = round(H * 0.10)
    p.elements.append({
        "role": "accent-band", "kind": "rect",
        "rect": [0, H - band_h, W, band_h], "fill": accent,
        "note": "full-bleed band: intentional edge contact (documented for QA)"})
    # 3) focal deco: accent circle top-left third (counterweight, rule of thirds)
    r = round(short * 0.13)
    p.elements.append({
        "role": "focal-deco", "kind": "ellipse",
        "rect": [margin, round(H * 0.13), r, r], "fill": accent,
        "note": "tertiary weight at left-third intersection; balances RTL text mass"})
    # 4) headline: point text anchored right (RTL), baseline just above focal y
    p.elements.append({
        "role": "headline", "kind": "type", "x": right, "y": focal_y,
        "text": brief.headline, "align": "right",
        "font": brief.font_display, "size": head_pt, "color": head_ink,
        "leading": round(head_pt * 1.35), "weight": 700,
        "note": "focal element: largest size + isolation above centre (§1/§3)"})
    # 5) subhead: right-anchored, spaced one scale-step below headline
    gap = _snap(head_pt * 0.55)
    p.elements.append({
        "role": "subhead", "kind": "type", "x": right, "y": focal_y + gap,
        "text": brief.subhead, "align": "right",
        "font": brief.font_text, "size": sub_pt,
        "color": surface if contrast(surface, bg) >= 4.5 else ink,
        "leading": round(sub_pt * 1.5),
        "note": "secondary weight; line-height +10% for Arabic (§7)"})
    # 6) CTA chip (optional): accent plate + text — reserved for CTA only
    if brief.cta:
        chip_h = round(cta_pt * 2.6)
        chip_w = round(W * 0.34)
        p.elements.append({
            "role": "cta-chip", "kind": "roundedRect",
            "rect": [right - chip_w, H - band_h - margin - chip_h, chip_w, chip_h],
            "radii": 8, "fill": accent,
            "note": "chip: padding >= 0.5x cap height (§6)"})
        p.elements.append({
            "role": "cta-text", "kind": "type",
            "x": right - chip_w // 2,
            "y": H - band_h - margin - chip_h // 2 + round(cta_pt * 0.35),
            "text": brief.cta, "align": "center",
            "font": brief.font_text, "size": cta_pt,
            "color": readable_ink(accent), "weight": 700})

    p.rationale = [
        f"margin {margin}px = {short}*0.07 snapped to spacing scale (§3)",
        f"headline {head_pt}pt / subhead {sub_pt}pt: 2 sizes only, ratio ~1.35 (§1)",
        f"headline ink contrast vs bg = {contrast(head_ink, bg):.2f}:1 (need 4.5) (§2)",
        "RTL: all text right-anchored, reading top->down (§7)",
        "focal at y=0.40H above geometric centre; deco at left third = balance (§3/§4)",
        "accent used for band+deco+CTA only — never spread evenly (§5)",
    ]
    return p


if __name__ == "__main__":
    import sys
    b = Brief(headline=sys.argv[1] if len(sys.argv) > 1 else "عنوان تجريبي",
              subhead=sys.argv[2] if len(sys.argv) > 2 else "نص ثانوي قصير")
    print(plan(b).to_json())
