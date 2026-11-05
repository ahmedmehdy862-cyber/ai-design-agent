"""Unit tests for the design planner (Phase 6 §13) — rules only, no rendering."""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from app.planner.planner import Brief, plan, contrast, readable_ink, luminance  # noqa: E402


class PlannerTest(unittest.TestCase):
    def setUp(self):
        self.p = plan(Brief(headline="عنوان", subhead="ثانوي", cta="اطلب"))

    def test_contrast_helpers(self):
        self.assertAlmostEqual(contrast("#000000", "#FFFFFF"), 21.0, places=1)
        self.assertGreater(luminance("#FFFFFF"), luminance("#000000"))
        self.assertEqual(readable_ink("#FFFFFF"), "#111111")   # light bg -> dark ink
        self.assertEqual(readable_ink("#0B3D5C"), "#FFFFFF")   # dark bg -> light ink

    def test_canvas_and_margin(self):
        self.assertEqual(self.p.canvas, (1080, 1350))
        m = self.p.grid["margin"]
        self.assertTrue(48 <= m <= 96, m)  # 6-8% of short side, snapped

    def test_max_three_type_sizes(self):
        self.assertLessEqual(len(self.p.type_scale), 3)

    def test_headline_meets_wcag(self):
        bg = self.p.palette["bg"]
        he = next(e for e in self.p.elements if e["role"] == "headline")
        self.assertGreaterEqual(contrast(he["color"], bg), 4.5)

    def test_rtl_right_anchor(self):
        for e in self.p.elements:
            if e["kind"] == "type" and e["role"] in ("headline", "subhead"):
                self.assertEqual(e["align"], "right")
                self.assertEqual(e["x"], 1080 - self.p.grid["margin"])

    def test_focal_above_centre(self):
        self.assertLess(self.p.focal["y"], 1350 * 0.5)
        self.assertGreaterEqual(self.p.focal["y"], 1350 * 0.38)

    def test_exactly_one_background_by_palette(self):
        # bg defined once; accent reserved for band/deco/cta only
        accent_roles = [e["role"] for e in self.p.elements if e.get("fill") == self.p.palette["accent"]]
        self.assertTrue(set(accent_roles) <= {"accent-band", "focal-deco", "cta-chip"})

    def test_light_style_still_contrast_compliant(self):
        p = plan(Brief(headline="x", subhead="y", style="light"))
        bg = p.palette["bg"]
        he = next(e for e in p.elements if e["role"] == "headline")
        self.assertGreaterEqual(contrast(he["color"], bg), 4.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
