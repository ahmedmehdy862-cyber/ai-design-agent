"""Unit tests for the visual QA engine (spec §19) — synthetic images via ImageMagick."""
import os, subprocess, sys, tempfile, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from app.quality import qa  # noqa: E402

MAGICK = qa.MAGICK


def make(path, size, color, extra=None):
    args = [MAGICK, "-size", size, f"xc:{color}"]
    if extra:
        args += extra
    args.append(path)
    subprocess.run(args, check=True, capture_output=True)
    return path


class QATest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="qa-test-")

    def test_contrast_ratio_black_white_is_21(self):
        self.assertAlmostEqual(qa.contrast_ratio("#000000", "#FFFFFF"), 21.0, places=1)

    def test_hue_detection(self):
        self.assertTrue(35 <= (qa.hue_of("#F4A417") or 0) <= 50)  # orange
        self.assertIsNone(qa.hue_of("#808080"))                    # grey -> None

    def test_blank_image_fails(self):
        p = make(os.path.join(self.tmp, "blank.png"), "100x100", "white")
        r = qa.analyze(p)
        self.assertTrue(r.failed)
        self.assertIn("blank", [i["id"] for i in r.issues])

    def test_size_mismatch_fails(self):
        p = make(os.path.join(self.tmp, "size.png"), "100x100", "white",
                 extra=["-fill", "black", "-draw", "rectangle 10,10 90,90"])
        r = qa.analyze(p, expect=(1080, 1350))
        self.assertFalse(r.expect_ok)
        self.assertIn("size", [i["id"] for i in r.issues])

    def test_good_flat_design_passes(self):
        p = make(os.path.join(self.tmp, "good.png"), "1080x1350", "#0B3D5C",
                 extra=["-fill", "#F4A417", "-draw", "rectangle 0,0 1079,300",
                        "-fill", "white", "-draw", "rectangle 180,850 900,985"])
        r = qa.analyze(p, expect=(1080, 1350))
        self.assertFalse(r.failed, [i["id"] for i in r.issues])
        self.assertGreater(r.blankness, 8)
        self.assertLessEqual(r.ink_ratio, 0.65)
        self.assertGreaterEqual(r.max_contrast, 4.5)
        self.assertLessEqual(r.dominant_hues, 3)

    def test_half_half_triggers_focal_ambiguity(self):
        p = make(os.path.join(self.tmp, "split.png"), "100x100", "white",
                 extra=["-fill", "black", "-draw", "rectangle 0,0 49,99"])
        r = qa.analyze(p)
        self.assertIn("focal-ambiguity", [i["id"] for i in r.issues])

    def test_tiny_image_is_ink_dense_and_spills(self):
        # gradient (many colours) fills the entire canvas: ink ratio ~1.0 + edge spill
        p = make(os.path.join(self.tmp, "dense.png"), "100x100", "#111111",
                 extra=["-size", "100x100", "gradient:#111111-#EEEEEE", "-composite"])
        r = qa.analyze(p)
        ids = [i["id"] for i in r.issues]
        self.assertGreater(r.blankness, 8, ids)
        self.assertTrue("edge-spill" in ids or "clutter" in ids, ids)


if __name__ == "__main__":
    unittest.main(verbosity=2)