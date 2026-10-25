"""Copy the local decisions store into the database (2026-10-25).

    python3 -I pipeline/load/push_decisions.py            # dry run: counts only
    python3 -I pipeline/load/push_decisions.py --write    # upsert into public.decision_docs

Reads data/decisions/.local/store.json (the file backend in src/decisions/store.ts) and upserts every
document into decision_docs on (collection, id), the same shape store.ts writes. Uses
NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; the table has RLS on and no policies, so only
the service role can write it. Case studies stay out of git; this moves them between private stores.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "data" / "decisions" / ".local" / "store.json"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--write", action="store_true")
    a = p.parse_args()
    store = json.loads(STORE.read_text())
    rows = [{"collection": c, "id": d["id"], "data": d} for c, docs in store.items() for d in docs.values()]
    print({c: len(docs) for c, docs in store.items()}, f"{len(rows)} documents")
    if not a.write:
        return 0
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        sys.exit("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    for i in range(0, len(rows), 200):
        req = urllib.request.Request(
            f"{url}/rest/v1/decision_docs?on_conflict=collection,id",
            data=json.dumps(rows[i : i + 200]).encode(),
            method="POST",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"rows {i + 1}-{min(i + 200, len(rows))}: HTTP {r.status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
