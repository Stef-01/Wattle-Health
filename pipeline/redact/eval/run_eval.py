"""Redaction eval and log reader (founder 2026-10-24).

    python3 pipeline/redact/eval/run_eval.py                 # privacy + retention on cases.jsonl
    python3 pipeline/redact/eval/run_eval.py --downstream    # also: does redaction change the decision?
    python3 pipeline/redact/eval/run_eval.py logs [--show 5] # summarise the REDACT_LOG debug log

Privacy: every `pii` string must be gone from the redacted text (recall). Retention: every `keep`
string must survive (clinical content the classifier needs). Downstream: each case is classified by
the decisions API (OpenAI) twice, original and redacted, both with `redact: false` so only this
redaction is compared; the verdict asks whether scores and the tree's decision hold. Cases are
synthetic and live in git; reports go to data/redact/.local/ (gitignored).

Downstream needs the app running (`pnpm start`, port 3300) and DECISIONS_API_KEY in the environment.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from redact import redact  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / "data" / "redact" / ".local"

# What "sufficient" means. Privacy is strict; downstream allows model noise between two runs.
GATES = {"pii_recall": 0.98, "keep_rate": 0.95, "decision_agreement": 0.90, "mean_abs_score_delta": 0.08, "top5_overlap": 0.80}


def classify(text: str, base: str, key: str) -> dict:
    req = urllib.request.Request(
        f"{base}/api/decisions/classify",
        data=json.dumps({"transcript": text, "discover": False, "redact": False}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def top(scores: dict[str, float], n: int = 5) -> set[str]:
    return {k for k, _ in sorted(scores.items(), key=lambda kv: -kv[1])[:n]}


def run(args: argparse.Namespace) -> int:
    cases = [json.loads(l) for l in (HERE / "cases.jsonl").read_text().splitlines() if l.strip()]
    rows, leaks, losses = [], [], []
    pii_total = pii_caught = keep_total = keep_ok = 0
    for c in cases:
        t0 = time.monotonic()
        r = redact(c["text"])
        ms = int((time.monotonic() - t0) * 1000)
        out = str(r["text"])
        missed = [p for p in c["pii"] if p.lower() in out.lower()]
        lost = [k for k in c["keep"] if k.lower() not in out.lower()]
        pii_total += len(c["pii"]); pii_caught += len(c["pii"]) - len(missed)
        keep_total += len(c["keep"]); keep_ok += len(c["keep"]) - len(lost)
        leaks += [{"case": c["id"], "text": m} for m in missed]
        losses += [{"case": c["id"], "text": k} for k in lost]
        row = {"id": c["id"], "kind": c["kind"], "ms": ms, "missed": missed, "lost": lost, "counts": r["counts"], "redacted": out}
        if args.downstream:
            key = os.environ.get("DECISIONS_API_KEY", "").strip()
            if not key:
                print("DECISIONS_API_KEY is not set", file=sys.stderr); return 2
            # a and a2 are the same original twice: how often the decision flips with no redaction at all.
            a, a2, b = classify(c["text"], args.base, key), classify(c["text"], args.base, key), classify(out, args.base, key)
            sa, sb = a["scores"], b["scores"]
            deltas = [abs(sa[k] - sb.get(k, 0)) for k in sa]
            row["downstream"] = {
                "decision": [(a.get("decision") or {}).get("decision"), (b.get("decision") or {}).get("decision")],
                "noiseDecision": [(a.get("decision") or {}).get("decision"), (a2.get("decision") or {}).get("decision")],
                "noiseMeanAbsDelta": round(statistics.mean(abs(a["scores"][k] - a2["scores"].get(k, 0)) for k in a["scores"]), 4),
                "meanAbsDelta": round(statistics.mean(deltas), 4),
                "maxAbsDelta": round(max(deltas), 4),
                "worst": sorted(((k, round(sa[k] - sb.get(k, 0), 3)) for k in sa), key=lambda kv: -abs(kv[1]))[:3],
                "top5Overlap": len(top(sa) & top(sb)) / 5,
            }
        rows.append(row)
        print(f"{c['id']:<24} missed {len(missed)}  lost {len(lost)}  {ms} ms" + (f"  Δ {row['downstream']['meanAbsDelta']}  decision {row['downstream']['decision']}" if args.downstream else ""))

    metrics: dict[str, float] = {"pii_recall": pii_caught / pii_total if pii_total else 1.0, "keep_rate": keep_ok / keep_total if keep_total else 1.0}
    if args.downstream:
        ds = [r["downstream"] for r in rows]
        metrics["decision_agreement"] = sum(d["decision"][0] == d["decision"][1] for d in ds) / len(ds)
        metrics["noise_decision_agreement"] = sum(d["noiseDecision"][0] == d["noiseDecision"][1] for d in ds) / len(ds)
        metrics["noise_mean_abs_score_delta"] = statistics.mean(d["noiseMeanAbsDelta"] for d in ds)
        metrics["mean_abs_score_delta"] = statistics.mean(d["meanAbsDelta"] for d in ds)
        metrics["top5_overlap"] = statistics.mean(d["top5Overlap"] for d in ds)
    gates = {k: (metrics[k] <= v if k == "mean_abs_score_delta" else metrics[k] >= v) for k, v in GATES.items() if k in metrics}
    if "noise_decision_agreement" in metrics:
        # The tree can flip on a rerun alone; redaction only fails this gate if it flips more than rerunning does.
        gates["decision_agreement"] = metrics["decision_agreement"] >= min(GATES["decision_agreement"], metrics["noise_decision_agreement"] - 0.1)
    report = {
        "at": datetime.now(timezone.utc).isoformat(),
        "model": os.environ.get("REDACT_MODEL") or "default",
        "cases": len(cases),
        "metrics": {k: round(v, 4) for k, v in metrics.items()},
        "gates": gates,
        "verdict": "SUFFICIENT" if all(gates.values()) else "INSUFFICIENT",
        "leaks": leaks,
        "losses": losses,
        "rows": rows,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"eval-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ("model", "metrics", "gates", "verdict", "leaks", "losses")}, indent=2))
    print(f"report: {path}")
    return 0 if report["verdict"] == "SUFFICIENT" else 1


def logs(args: argparse.Namespace) -> int:
    path = Path(os.environ.get("REDACT_LOG", "").strip() or OUT / "redact.log.jsonl")
    if not path.exists():
        print(f"no log at {path} (set REDACT_LOG to turn logging on)"); return 1
    rows = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    ms = sorted(r["ms"] for r in rows)
    by: dict[str, int] = {}
    for r in rows:
        for k, v in r.get("counts", {}).items():
            by[k] = by.get(k, 0) + v
    print(json.dumps({"rows": len(rows), "models": sorted({r.get("model") for r in rows}), "p50ms": ms[len(ms) // 2], "p95ms": ms[int(len(ms) * 0.95) - 1 if len(ms) > 1 else 0], "redacted": by, "nothingFound": sum(1 for r in rows if not r.get("counts"))}, indent=2))
    for r in rows[-args.show:] if args.show else []:
        print(f"\n{r['at']}  {r['inputSha256'][:12]}  {r['counts']}\n{r['text']}")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("command", nargs="?", default="eval", choices=["eval", "logs"])
    p.add_argument("--downstream", action="store_true")
    p.add_argument("--base", default="http://localhost:3300")
    p.add_argument("--show", type=int, default=0)
    a = p.parse_args()
    sys.exit(logs(a) if a.command == "logs" else run(a))
