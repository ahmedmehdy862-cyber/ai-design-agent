"""Producer (Phase 7): executes a Plan through photocraft-cli headless.

One process call: `photocraft-cli run --new <json> --cmd ... --out <file>`.
Keeps the editable .pcraft (working/) and exports the PNG (exports/).
Returns per-command JSON results for the record.
"""
from __future__ import annotations
import json, subprocess, sys, os
from typing import Any

CLI = r"C:\Program Files\PhotoCraft\photocraft-cli.exe"
ROOT = r"C:\Users\Power tech\Documents\Default Project\ai-design-agent\workspace"


def _shape_params(el: dict) -> dict:
    x, y, w, h = el["rect"]
    p: dict[str, Any] = {"kind": el["kind"], "rect": [x, y, w, h], "fill": el["fill"]}
    if "radii" in el:
        p["radii"] = el["radii"]
    return p


def _type_params(el: dict) -> dict:
    return {"x": el["x"], "y": el["y"], "text": el["text"],
            "align": el.get("align", "right"), "font": el["font"],
            "size": el["size"], "color": el["color"],
            "leading": el.get("leading", "auto"), "weight": el.get("weight", 400),
            "name": el["role"]}


def build_args(plan: dict, pcraft_path: str, png_path: str | None) -> list[str]:
    W, H = plan["canvas"]
    args = [CLI, "run", "--new",
            json.dumps({"width": W, "height": H, "mode": "rgb", "depth": 8,
                        "background": plan["palette"]["bg"],
                        "name": os.path.basename(pcraft_path)}, ensure_ascii=False)]
    for el in plan["elements"]:
        if el["kind"] == "type":
            args += ["--cmd", "type.create", "--params",
                     json.dumps(_type_params(el), ensure_ascii=False)]
        else:
            args += ["--cmd", "shape.create", "--params",
                     json.dumps(_shape_params(el), ensure_ascii=False)]
    args += ["--out", pcraft_path]
    return args


def produce(plan: dict, stem: str) -> dict:
    working = os.path.join(ROOT, "working", f"{stem}.pcraft")
    exports = os.path.join(ROOT, "exports", f"{stem}.png")
    args = build_args(plan, working, exports)
    r = subprocess.run(args, capture_output=True, text=True, timeout=600,
                       encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"photocraft-cli failed ({r.returncode}): {r.stderr.strip()[:500]}")
    results = [json.loads(line) for line in r.stdout.splitlines() if line.strip()]
    # export PNG from the saved .pcraft (separate convert keeps sources clean)
    c = subprocess.run([CLI, "convert", working, exports],
                       capture_output=True, text=True, timeout=600,
                       encoding="utf-8", errors="replace")
    if c.returncode != 0:
        raise RuntimeError(f"png export failed: {c.stderr.strip()[:300]}")
    return {"pcraft": working, "png": exports, "commands": results}


if __name__ == "__main__":
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
    from app.planner.planner import Brief, plan as make_plan  # noqa: E402
    b = Brief(headline=sys.argv[1] if len(sys.argv) > 1 else "عنوان تجريبي",
              subhead=sys.argv[2] if len(sys.argv) > 2 else "نص ثانوي")
    p = make_plan(b)
    out = produce(json.loads(p.to_json()), "produced-01")
    print(json.dumps({"png": out["png"], "cmds": len(out["commands"])}, ensure_ascii=False))
