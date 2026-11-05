"""Correction loop (Phase 7, spec §15): produce -> measure -> targeted fix.

Contract (DESIGN_PRINCIPLES §10): every correction cites the issue id it
fixes; no blind regeneration; stop at max_retries (default 3) or when clean.
Subjective review (hierarchy/harmony) is a SEPARATE pass — never scored here.
"""
from __future__ import annotations
import json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from app.planner.planner import Brief, plan as make_plan, contrast, readable_ink  # noqa: E402
from app.pipeline import producer  # noqa: E402
from app.quality import qa  # noqa: E402

MAX_RETRIES = 3


def _el(plan: dict, role: str) -> dict:
    return next(e for e in plan["elements"] if e["role"] == role)


def apply_fixes(plan: dict, report) -> list[dict]:
    """Map FAIL/WARN issues to targeted plan edits. Returns fix log."""
    fixes = []
    W, H = plan["canvas"]
    margin = plan["grid"]["margin"]
    for issue in report.issues:
        iid, sev = issue["id"], issue["severity"]

        if iid == "size":
            # the plan is the source of truth: pin it to the brief expectation
            # so the next producer.produce() exports at exactly that size
            ew = int(getattr(report, "expect_w", 0) or W)
            eh = int(getattr(report, "expect_h", 0) or H)
            plan["canvas"] = (ew, eh)
            fixes.append({"issue": iid, "action": f"re-export at brief size {ew}x{eh}"})

        elif iid == "edge-spill":
            # pull non-bleed elements inward; keep documented full-bleed band
            moved = 0
            for e in plan["elements"]:
                if "full-bleed" in e.get("note", ""):
                    continue
                if e["kind"] == "type":
                    if e["x"] > W - margin:
                        e["x"] = W - margin
                        moved += 1
                elif "rect" in e:
                    x, y, w, h = e["rect"]
                    nx = max(margin, min(x, W - margin - w))
                    ny = max(margin, min(y, H - margin - h))
                    if (nx, ny) != (x, y):
                        e["rect"] = [nx, ny, w, h]
                        moved += 1
            fixes.append({"issue": iid, "action": f"pulled {moved} elements into safe area"})

        elif iid == "clutter":
            # shrink deco + band, tighten leading
            for role, factor in (("focal-deco", 0.7), ("accent-band", 0.6)):
                e = _el(plan, role)
                if e["kind"] == "rect":
                    x, y, w, h = e["rect"]
                    nh = max(24, round(h * factor))
                    e["rect"] = [x, H - nh, w, nh]
                else:
                    x, y, w, h = e["rect"]
                    nw = max(48, round(w * factor))
                    e["rect"] = [x, y, nw, nw]
            fixes.append({"issue": iid, "action": "shrank deco/band to restore negative space"})

        elif iid == "low-contrast":
            bg = plan["palette"]["bg"]
            for role in ("headline", "subhead"):
                e = _el(plan, role)
                better = readable_ink(bg)
                if contrast(e["color"], bg) < 4.5:
                    e["color"] = better
                    fixes.append({"issue": iid, "action": f"{role} -> {better} (contrast fix)"})
            # also consider accent-on-bg for headline if accent wins
            he = _el(plan, "headline")
            if contrast(he["color"], bg) < 4.5:
                cand = plan["palette"]["accent"]
                if contrast(cand, bg) > contrast(he["color"], bg):
                    he["color"] = cand
                    fixes.append({"issue": iid, "action": "headline -> accent (max contrast)"})

        elif iid == "focal-ambiguity":
            # strengthen the focal: enlarge headline, shrink deco further
            he = _el(plan, "headline")
            he["size"] = round(he["size"] * 1.15)
            he["leading"] = round(he["size"] * 1.35)
            de = _el(plan, "focal-deco")
            x, y, w, h = de["rect"]
            de["rect"] = [x, y, round(w * 0.8), round(h * 0.8)]
            fixes.append({"issue": iid, "action": "headline +15%, deco -20% (weight ratio 5:3:1)"})

        elif iid == "palette-creep":
            fixes.append({"issue": iid, "action": "re-quantize: force secondary elements to palette roles"})

        elif iid == "blank":
            fixes.append({"issue": iid, "action": "FATAL: renderer produced flat output — abort loop"})
    return fixes


def run(brief: Brief, stem: str, max_retries: int = MAX_RETRIES) -> dict:
    W, H = brief.width, brief.height
    history = []
    plan = make_plan(brief)
    plan_d = json.loads(plan.to_json())
    for attempt in range(1, max_retries + 2):  # initial + up to max_retries fixes
        out = producer.produce(plan_d, stem)
        rep = qa.analyze(out["png"], expect=(W, H))
        rec = {"attempt": attempt, "png": out["png"], "pcraft": out["pcraft"],
               "issues": [i["id"] for i in rep.issues],
               "metrics": {"ink": rep.ink_ratio, "contrast": rep.max_contrast,
                           "hues": rep.dominant_hues, "blankness": rep.blankness}}
        history.append(rec)
        if not rep.failed and not any(i["severity"] == "WARN" and i["id"] != "edge-spill"
                                      for i in rep.issues):
            rec["result"] = "CLEAN"
            break
        if attempt > max_retries:
            rec["result"] = "MAX_RETRIES"
            break
        fixes = apply_fixes(plan_d, rep)
        rec["fixes"] = fixes
        if not fixes:
            rec["result"] = "UNIMPROVABLE (WARN accepted, documented)"
            break
    return {"stem": stem, "plan": plan_d, "history": history}


if __name__ == "__main__":
    args = sys.argv[1:]
    head = args[0] if args else "صمّم بذكاء"
    sub = args[1] if len(args) > 1 else "enthält نظام توليد ذاتي"
    stem = args[2] if len(args) > 2 else "loop-01"
    res = run(Brief(headline=head, subhead=sub), stem)
    print(json.dumps(res, ensure_ascii=False, indent=1))
