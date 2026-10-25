"""Run a cohort's load files against the database, in manifest order (2026-10-25).

    python3 -I pipeline/load/apply.py                 # data/load/all_manifest.json
    python3 -I pipeline/load/apply.py --cohort qld    # data/load/qld_manifest.json

Needs `psql` and SUPABASE_DB_URL (the adhd-me project's session-pooler URI; .env.local locally, a
repository secret in CI). Every file is an upsert, so a rerun only changes what the records changed.
Stops at the first failing file. Refreshes the `coverage` materialized view at the end and prints the
row counts so they can be checked against the manifest.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COUNTS = """select 'sources', count(*) from sources union all select 'practitioners', count(*) from practitioners
union all select 'locations', count(*) from locations union all select 'roles', count(*) from practitioner_roles
union all select 'observations', count(*) from observations union all select 'focus', count(*) from provider_clinical_focus;"""


def psql() -> str:
    for candidate in (os.environ.get("PSQL"), shutil.which("psql"), "/opt/homebrew/opt/libpq/bin/psql"):
        if candidate and Path(candidate).exists():
            return candidate
    sys.exit("psql not found: brew install libpq, or set PSQL")


def run(url: str, *args: str) -> str:
    out = subprocess.run([psql(), url, "-v", "ON_ERROR_STOP=1", "-X", "-q", *args], capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr.strip()[-2000:])
    return out.stdout


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--cohort", default="all")
    p.add_argument("--dir", default=str(ROOT / "data" / "load"))
    a = p.parse_args()
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        sys.exit("SUPABASE_DB_URL is not set")
    folder = Path(a.dir)
    manifest = json.loads((folder / f"{a.cohort}_manifest.json").read_text())
    for i, f in enumerate(manifest["files"], 1):
        run(url, "-f", str(folder / f["file"]))
        print(f"{i:>3}/{len(manifest['files'])}  {f['file']}  {f['rows']} rows", flush=True)
    run(url, "-c", "refresh materialized view coverage;")
    print("database now:")
    print(run(url, "-A", "-t", "-F", "\t", "-c", COUNTS))
    print("manifest:", json.dumps(manifest["counts"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
