"""Smoke-run every planner style through produce + QA (no loop)."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from app.planner.planner import Brief, plan
from app.pipeline import producer
from app.quality import qa

CASES = [
    ("loop-light", Brief(headline="هدوء بصري", subhead="مساحة بيضاء مقصودة", style="light")),
    ("loop-cta",   Brief(headline="عرض محدود", subhead="خصم حتى 50%", cta="اطلب الآن")),
]

if __name__ == "__main__":
    for name, b in CASES:
        p = plan(b)
        out = producer.produce(json.loads(p.to_json()), name)
        r = qa.analyze(out["png"], expect=(b.width, b.height))
        ids = [i["id"] for i in r.issues]
        print(f"{name}: issues={ids} ink={r.ink_ratio} contrast={r.max_contrast} hues={r.dominant_hues}")
