"""Visual QA engine (Phase 5 §14–§15) — deterministic metrics over ImageMagick.

Metrics map 1:1 to the defect table in docs/DESIGN_PRINCIPLES.md §10.
Subjective review (hierarchy/harmony) stays with the agent pass; never scored here.
"""
from __future__ import annotations
import json, os, re, shutil, subprocess, sys
from dataclasses import dataclass, field, asdict
from typing import Optional

MAGICK = (os.environ.get("MAGICK")
          or shutil.which("magick")
          or r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe")


def _run(args: list[str], timeout: int = 120) -> str:
    r = subprocess.run([MAGICK, *args], capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"magick failed: {r.stderr.strip()[:300]}")
    return r.stdout


def _lin(c: float) -> float:  # sRGB linearization
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast_ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hue_of(hex_color: str) -> Optional[float]:  # None when near-grey
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == 0:
        return None
    sat = (mx - mn) / mx
    if sat < 0.18:
        return None
    if mx == r:
        d = g - b
        hue = (d / (mx - mn)) % 6
    elif mx == g:
        hue = (d := (b - r)) / (mx - mn) + 2
    else:
        hue = (r - g) / (mx - mn) + 4
    return hue * 60


def _hex(name: str) -> Optional[str]:  # "srgb(244,164,23)" / "#F4A417" -> #RRGGBB
    name = name.strip().lower()
    if name.startswith("#"):
        return name[:7].upper()
    m = re.match(r"srgb\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", name)
    if m:
        return "#{:02X}{:02X}{:02X}".format(*(int(g) for g in m.groups()))
    return None


@dataclass
class Issue:
    id: str
    severity: str  # FAIL | WARN
    message: str
    suggestion: str
    auto_fixable: bool = False


@dataclass
class Report:
    file: str
    width: int = 0
    height: int = 0
    expect_ok: bool = True
    expect_w: int = 0            # brief size on mismatch (0 = not compared)
    expect_h: int = 0
    blankness: int = 0
    ink_ratio: float = 0.0
    center_of_mass: tuple = (0.0, 0.0)
    palette: list = field(default_factory=list)   # [(hex, share)]
    dominant_hues: int = 0
    max_contrast: float = 0.0
    text_color: Optional[str] = None
    margin_violations: list = field(default_factory=list)
    issues: list = field(default_factory=list)

    @property
    def failed(self) -> bool:
        return any(i["severity"] == "FAIL" for i in self.issues)


def _histogram(img_args: list[str]) -> list[tuple[str, int]]:
    out = _run([*img_args, "-format", "%c", "histogram:info:-"])
    pairs = []
    # quantized output emits float RGB like (10.8819,60.924,91.9705) — accept both
    num = r"(\d+(?:\.\d+)?)"
    for m in re.finditer(r"(\d+):\s*\(\s*" + num + r"\s*,\s*" + num + r"\s*,\s*" + num + r"\s*\)", out):
        cnt = int(m.group(1))
        r_, g_, b_ = (int(round(float(m.group(i)))) for i in (2, 3, 4))
        pairs.append((f"#{r_:02X}{g_:02X}{b_:02X}", cnt))
    if not pairs:
        for m in re.finditer(r"(\d+):\s+(#[0-9A-Fa-f]{6})", out):
            pairs.append((m.group(2).upper(), int(m.group(1))))
    pairs.sort(key=lambda p: -p[1])
    return pairs


def analyze(path: str, expect: Optional[tuple[int, int]] = None,
            margin_pct: float = 4.0, max_ink: float = 0.65) -> Report:
    rep = Report(file=path)
    w, h = (int(x) for x in _run([path, "-format", "%w %h", "info:"]).split())
    rep.width, rep.height = w, h
    if expect and (w, h) != tuple(expect):
        rep.expect_ok = False
        rep.issues.append(Issue("size", "FAIL",
            f"export is {w}x{h}, brief requires {expect[0]}x{expect[1]}",
            "re-export with the brief's exact pixel dimensions"))

    # palette + blankness (small analysis copy keeps it fast).
    # blankness uses the RAW colour count; palette/contrast/hues use a
    # quantized copy so anti-aliased text pixels group into one ink bucket
    # (otherwise thin Arabic strokes never reach a measurable share).
    small = [path, "-resize", "96x96!", "-depth", "8"]
    raw_hist = _histogram(small)
    rep.blankness = len(raw_hist)
    if len(raw_hist) < 8:
        rep.issues.append(Issue("blank", "FAIL",
            f"only {len(raw_hist)} distinct colours — output looks blank/flat",
            "content failed to render: verify layers/visibility and re-export"))

    hist = _histogram([*small, "-colors", "24"])
    total = sum(c for _, c in hist) or 1
    rep.palette = [(k, round(c / total, 4)) for k, c in hist[:6]]
    bg_hex, bg_share = rep.palette[0] if rep.palette else ("#FFFFFF", 1.0)

    hues = [hue_of(k) for k, _ in hist[:6]]
    rep.dominant_hues = len({round(hh / 30) for hh in hues if hh is not None})
    if rep.dominant_hues > 3:
        rep.issues.append(Issue("palette-creep", "WARN",
            f"{rep.dominant_hues} dominant hues (>3)",
            "reduce to a dominant+secondary+accent palette"))

    # ink metrics on 128px-wide sample: pixels far from the background colour
    sample = [path, "-resize", "128x"]
    rows = _run([*sample, "-depth", "8", "txt:-"])
    bg = tuple(int(bg_hex[i:i + 2], 16) for i in (1, 3, 5))
    coords = []
    for m in re.finditer(r"(\d+),(\d+):\s*\(\s*(\d+)(?:\s*,\s*(\d+)\s*,\s*(\d+))?", rows):
        x, y, c1 = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if m.group(4) is not None:  # sRGB triple
            r, g, b = c1, int(m.group(4)), int(m.group(5))
        else:  # single channel (grayscale image)
            r = g = b = c1
        coords.append((x, y, r, g, b))
    sw = max((c[0] for c in coords), default=0) + 1
    sh = max((c[1] for c in coords), default=0) + 1
    m_edge = int(min(w, h) * margin_pct / 100 * 128 / min(w, h)) or 1
    ink = xs = ys = 0.0
    total_px = float(len(coords))
    margin_hits = []
    ink_pixels = []  # (luminance, #RRGGBB) for every ink pixel
    for x, y, r, g, b in coords:
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 60:
            ink += 1
            xs += x
            ys += y
            ink_pixels.append((0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b),
                               f"#{r:02X}{g:02X}{b:02X}"))
            if x < m_edge or y < m_edge or x > sw - m_edge or y > sh - m_edge:
                margin_hits.append((x, y))
    if total_px:
        rep.ink_ratio = round(ink / total_px, 4)
        if ink:
            rep.center_of_mass = (round(xs / ink / max(sw, 1), 4), round(ys / ink / max(sh, 1), 4))
    if rep.ink_ratio > max_ink + 0.13:
        rep.issues.append(Issue("clutter", "FAIL", f"ink covers {rep.ink_ratio:.0%} of canvas (>78%)",
            "remove elements or enlarge the canvas — clutter reads amateur"))
    elif rep.ink_ratio > max_ink:
        rep.issues.append(Issue("clutter", "WARN", f"ink covers {rep.ink_ratio:.0%} (>65%)",
            "increase negative space"))
    if margin_hits:
        rep.margin_violations = margin_hits[:10]
        rep.issues.append(Issue("edge-spill", "WARN",
            f"{len(margin_hits)} ink pixels within the outer {margin_pct:.0f}% margin",
            "pull elements into the safe area (margin ≥ 6% of the short side)"))

    # contrast: text is a thin-ink signal — a histogram share never reaches thin
    # Arabic strokes, so take the extreme ink-luminance percentiles (2nd/98th)
    # of the measured ink pixels and use whichever contrasts most with the bg.
    if ink_pixels:
        ink_pixels.sort(key=lambda p: p[0])
        n = len(ink_pixels)

        def _pick(q: float) -> str:
            return ink_pixels[min(n - 1, max(0, round(q * (n - 1))))][1]

        candidates = [_pick(0.02), _pick(0.98)]
        ink_hex = max(candidates, key=lambda k: contrast_ratio(bg_hex, k))
        rep.max_contrast = round(contrast_ratio(bg_hex, ink_hex), 2)
        rep.text_color = ink_hex
    else:
        rep.max_contrast = 0.0
        rep.text_color = None
    if rep.text_color and rep.max_contrast < 4.5:
        rep.issues.append(Issue("low-contrast", "WARN",
            f"bg {bg_hex} vs ink {rep.text_color} = {rep.max_contrast}:1 (<4.5:1)",
            "darken text or lighten its surface; WCAG AA needs 4.5:1 (3:1 for large text)"))

    # focus ambiguity: dominant colour share too evenly split with runner-up
    if len(rep.palette) >= 2:
        s1, s2 = rep.palette[0][1], rep.palette[1][1]
        if 0 < s1 / max(s2, 1e-6) < 1.15:
            rep.issues.append(Issue("focal-ambiguity", "WARN",
                f"top two colours nearly equal share ({s1:.0%} vs {s2:.0%})",
                "let one colour dominate (~60%) so the eye has a clear entry point"))

    rep.issues = [asdict(i) for i in rep.issues]
    return rep


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    expect = None
    if "--expect" in argv:
        i = argv.index("--expect")
        expect = (int(argv[i + 1]), int(argv[i + 2]))
    rep = analyze(argv[1], expect=expect)
    print(json.dumps(asdict(rep), indent=2, ensure_ascii=False))
    return 1 if rep.failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))