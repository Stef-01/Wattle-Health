"""Redaction eval, model sweep and log reader (founder 2026-10-24).

    python3 pipeline/redact/eval/run_eval.py                        # privacy + retention, tuning set
    python3 pipeline/redact/eval/run_eval.py --set holdout          # the held-out set (never tuned against)
    python3 pipeline/redact/eval/run_eval.py --downstream           # also: does redaction change the decision?
    python3 pipeline/redact/eval/run_eval.py sweep                  # every cheap in-region model, privacy + retention
    python3 pipeline/redact/eval/run_eval.py logs [--show 5]        # summarise the REDACT_LOG debug log

Options: --model ID, --passes N (ask the model N times, union), --repeats N (downstream runs per side).

Privacy: every `pii` string must be gone from the redacted text (recall). Retention: every `keep`
string must survive (clinical content and places the classifier and matching need). Downstream:
each case is classified by the decisions API (OpenAI) N times as given and N times redacted, all with
`redact: false` so only this redaction is compared. Redaction passes when original-vs-redacted runs
agree on the decision about as often as original-vs-original runs do (the tree flips on reruns alone).

cases.jsonl is the tuning set. Each holdoutN.jsonl was written before the run that scored it; once
its failures were studied and fixed it counts as tuning data. The newest one is the clean held-out
set: score it, never tune against it, and write the next one before studying its failures. Both are synthetic and live in git; reports go to data/redact/.local/ (gitignored).
Downstream needs the app running (`pnpm start`, port 3300) and DECISIONS_API_KEY in the environment.
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import statistics
import sys
import time
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import redact as R  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / "data" / "redact" / ".local"

# What "sufficient" means. Privacy is strict; downstream is judged against rerun noise.
GATES = {"pii_recall": 0.98, "keep_rate": 0.95, "mean_abs_score_delta": 0.05, "top5_overlap": 0.80}
NOISE_MARGIN = 0.10  # redaction may cost at most this much decision agreement beyond rerun noise

# Cheap text models the account can call on demand in Sydney (ap-southeast-2), so data stays in
# Australia. `global.`/`apac.` profiles are left out: they can process elsewhere. Anthropic models
# (au.anthropic.*) need the use-case form; they are tried and reported if they refuse.
SWEEP = [
    "amazon.nova-micro-v1:0", "amazon.nova-lite-v1:0", "amazon.nova-pro-v1:0",
    "openai.gpt-oss-20b-1:0", "openai.gpt-oss-120b-1:0",
    "google.gemma-3-4b-it", "google.gemma-3-12b-it", "google.gemma-3-27b-it",
    "mistral.ministral-3-3b-instruct", "mistral.ministral-3-8b-instruct", "mistral.ministral-3-14b-instruct",
    "nvidia.nemotron-nano-9b-v2", "nvidia.nemotron-nano-12b-v2", "nvidia.nemotron-nano-3-30b",
    "qwen.qwen3-32b-v1:0", "qwen.qwen3-next-80b-a3b", "zai.glm-4.7-flash", "mistral.magistral-small-2509",
    "au.anthropic.claude-haiku-4-5-20251001-v1:0", "au.anthropic.claude-haiku-5-5",
]


def load(which: str) -> list[dict]:
    files = {"tune": ["cases.jsonl"], "holdout": ["holdout.jsonl"], "holdout2": ["holdout2.jsonl"], "holdout3": ["holdout3.jsonl"], "all": ["cases.jsonl", "holdout.jsonl", "holdout2.jsonl", "holdout3.jsonl"]}[which]
    return [json.loads(l) for f in files for l in (HERE / f).read_text().splitlines() if l.strip()]


def score_case(c: dict, model: str, passes: int) -> dict:
    t0 = time.monotonic()
    try:
        r = R.redact(c["text"], model=model, passes=passes)
    except Exception as e:  # a failed case counts as leaking everything: redaction fails closed in the app
        return {"id": c["id"], "kind": c["kind"], "error": f"{type(e).__name__}: {str(e)[:160]}", "missed": c["pii"], "lost": [], "ms": int((time.monotonic() - t0) * 1000)}
    out = str(r["text"])
    return {
        "id": c["id"], "kind": c["kind"], "ms": int((time.monotonic() - t0) * 1000),
        "missed": [p for p in c["pii"] if p.lower() in out.lower()],
        "lost": [k for k in c["keep"] if k.lower() not in out.lower()],
        "counts": r["counts"], "redacted": out, "model": r["model"],
    }


def privacy(cases: list[dict], model: str, passes: int, workers: int = 2) -> tuple[list[dict], dict[str, float]]:
    with ThreadPoolExecutor(max_workers=workers) as pool:
        rows = list(pool.map(lambda c: score_case(c, model, passes), cases))
    pii = sum(len(c["pii"]) for c in cases)
    keep = sum(len(c["keep"]) for c in cases)
    metrics = {
        "pii_recall": 1 - sum(len(r["missed"]) for r in rows) / pii if pii else 1.0,
        "keep_rate": 1 - sum(len(r["lost"]) for r in rows) / keep if keep else 1.0,
        "errors": sum(1 for r in rows if "error" in r),
        "p50_ms": statistics.median(r["ms"] for r in rows),
    }
    used = Counter(r.get("model") for r in rows if r.get("model"))
    if used:
        print("models used:", dict(used))
    return rows, metrics


def classify(text: str, base: str, key: str) -> dict:
    req = urllib.request.Request(
        f"{base}/api/decisions/classify",
        data=json.dumps({"transcript": text, "discover": False, "redact": False}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def mean_scores(runs: list[dict]) -> dict[str, float]:
    keys = runs[0]["scores"].keys()
    return {k: statistics.mean(r["scores"].get(k, 0) for r in runs) for k in keys}


def top(scores: dict[str, float], n: int = 5) -> set[str]:
    return {k for k, _ in sorted(scores.items(), key=lambda kv: -kv[1])[:n]}


def downstream(cases: list[dict], rows: list[dict], repeats: int, base: str, key: str) -> dict[str, float]:
    jobs = [(i, side, text) for i, (c, r) in enumerate(zip(cases, rows)) if "error" not in r for side, text in (("a", c["text"]), ("b", r["redacted"])) for _ in range(repeats)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda j: (j[0], j[1], classify(j[2], base, key)), jobs))
    within, across, deltas, overlaps = [], [], [], []
    for i, r in enumerate(rows):
        a = [x for (j, s, x) in results if j == i and s == "a"]
        b = [x for (j, s, x) in results if j == i and s == "b"]
        if not a or not b:
            continue
        da = [(x.get("decision") or {}).get("decision") for x in a]
        db = [(x.get("decision") or {}).get("decision") for x in b]
        w = [x == y for x, y in itertools.combinations(da, 2)]
        x_ = [x == y for x in da for y in db]
        within += w
        across += x_
        ma, mb = mean_scores(a), mean_scores(b)
        delta = statistics.mean(abs(ma[k] - mb.get(k, 0)) for k in ma)
        deltas.append(delta)
        overlaps.append(len(top(ma) & top(mb)) / 5)
        r["downstream"] = {
            "original": Counter(da).most_common(), "redacted": Counter(db).most_common(),
            "meanAbsDelta": round(delta, 4),
            "worst": sorted(((k, round(ma[k] - mb.get(k, 0), 3)) for k in ma), key=lambda kv: -abs(kv[1]))[:3],
        }
    return {
        "decision_agreement": statistics.mean(across),
        "noise_decision_agreement": statistics.mean(within) if within else 1.0,
        "mean_abs_score_delta": statistics.mean(deltas),
        "top5_overlap": statistics.mean(overlaps),
    }


def verdict(metrics: dict[str, float]) -> tuple[dict[str, bool], str]:
    gates = {k: (metrics[k] <= v if k == "mean_abs_score_delta" else metrics[k] >= v) for k, v in GATES.items() if k in metrics}
    if "decision_agreement" in metrics:
        gates["decision_agreement"] = metrics["decision_agreement"] >= metrics["noise_decision_agreement"] - NOISE_MARGIN
    if metrics.get("errors"):
        gates["no_errors"] = False
    return gates, "SUFFICIENT" if all(gates.values()) else "INSUFFICIENT"


def save(name: str, report: dict) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(report, indent=2))
    return path


def run(args: argparse.Namespace) -> int:
    cases = load(args.set)
    rows, metrics = privacy(cases, args.model, args.passes)
    for r in rows:
        print(f"{r['id']:<24} missed {r['missed']}  lost {r['lost']}  {r['ms']} ms" + (f"  ERROR {r['error']}" if "error" in r else ""))
    if args.downstream:
        key = os.environ.get("DECISIONS_API_KEY", "").strip()
        if not key:
            print("DECISIONS_API_KEY is not set", file=sys.stderr)
            return 2
        metrics.update(downstream(cases, rows, args.repeats, args.base, key))
    gates, v = verdict(metrics)
    report = {
        "at": datetime.now(timezone.utc).isoformat(), "set": args.set, "model": args.model, "passes": args.passes,
        "repeats": args.repeats if args.downstream else None, "cases": len(cases),
        "metrics": {k: round(x, 4) for k, x in metrics.items()}, "gates": gates, "verdict": v,
        "leaks": [{"case": r["id"], "text": m} for r in rows for m in r["missed"]],
        "losses": [{"case": r["id"], "text": k} for r in rows for k in r["lost"]],
        "rows": rows,
    }
    path = save("eval", report)
    print(json.dumps({k: report[k] for k in ("set", "model", "passes", "metrics", "gates", "verdict", "leaks", "losses")}, indent=2))
    print(f"report: {path}")
    return 0 if v == "SUFFICIENT" else 1


def sweep(args: argparse.Namespace) -> int:
    cases = load(args.set)
    table = []
    for model in args.models or SWEEP:
        rows, m = privacy(cases, model, args.passes)
        errs = [r["error"] for r in rows if "error" in r]
        table.append({"model": model, **{k: round(v, 4) for k, v in m.items()}, "firstError": errs[0] if errs else None,
                      "leaks": [f"{r['id']}:{x}" for r in rows for x in r["missed"]][:8], "losses": [f"{r['id']}:{x}" for r in rows for x in r["lost"]][:8]})
        t = table[-1]
        print(f"{model:<46} recall {t['pii_recall']:.3f}  keep {t['keep_rate']:.3f}  errors {t['errors']:>2}  p50 {t['p50_ms']:>6.0f} ms" + (f"  {errs[0][:70]}" if errs else ""))
    path = save("sweep", {"at": datetime.now(timezone.utc).isoformat(), "set": args.set, "passes": args.passes, "table": table})
    print(f"report: {path}")
    return 0


def logs(args: argparse.Namespace) -> int:
    path = Path(os.environ.get("REDACT_LOG", "").strip() or OUT / "redact.log.jsonl")
    if not path.exists():
        print(f"no log at {path} (set REDACT_LOG to turn logging on)")
        return 1
    rows = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    ms = sorted(r["ms"] for r in rows)
    by: Counter[str] = Counter()
    for r in rows:
        by.update(r.get("counts", {}))
    print(json.dumps({"rows": len(rows), "models": sorted({str(r.get("model")) for r in rows}), "p50ms": ms[len(ms) // 2],
                      "p95ms": ms[min(len(ms) - 1, int(len(ms) * 0.95))], "redacted": dict(by), "nothingFound": sum(1 for r in rows if not r.get("counts"))}, indent=2))
    for r in rows[-args.show:] if args.show else []:
        print(f"\n{r['at']}  {r['inputSha256'][:12]}  {r.get('model')}  {r['counts']}\n{r['text']}")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("command", nargs="?", default="eval", choices=["eval", "sweep", "logs"])
    p.add_argument("--set", default="tune", choices=["tune", "holdout", "holdout2", "holdout3", "all"])
    p.add_argument("--model", default=R.MODEL)
    p.add_argument("--models", nargs="*")
    p.add_argument("--passes", type=int, default=R.PASSES)
    p.add_argument("--downstream", action="store_true")
    p.add_argument("--repeats", type=int, default=3)
    p.add_argument("--base", default="http://localhost:3300")
    p.add_argument("--show", type=int, default=0)
    a = p.parse_args()
    sys.exit({"logs": logs, "sweep": sweep}.get(a.command, run)(a))
