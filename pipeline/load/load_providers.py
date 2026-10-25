"""Emit idempotent SQL batches that load data/providers/*.jsonl into the Wattle Health Supabase schema.

Python 3.13 standard library only. Reads the merged provider records and pipeline/sources.yaml, writes
data/load/<cohort>_<nn>_<table>.sql with at most --batch rows per statement (default 500). The files are
then executed in filename order (Supabase MCP execute_sql, psql, or the SQL editor). Every statement is an
upsert on a natural key, so a re-run only updates what changed.

Natural keys
  sources               id = the raw source string in the record ('ranzcog_find', 'ramsay', ...)
  practitioners         source_key = merged record id ('psychiatry:jane-smith'); id = uuid5(source_key)
  locations             id = uuid5(normalised name|address|suburb|state|postcode)
  practitioner_roles    (practitioner_id, location_id)
  observations          (entity_type, entity_id, field, source_id, observed_at) via insert ... where not exists
  provider_clinical_focus (practitioner_id, condition_id)

Usage
  python -I pipeline/load/load_providers.py --state QLD      # Queensland cohort only (any location in QLD)
  python -I pipeline/load/load_providers.py                   # everything
  python -I pipeline/load/load_providers.py --skip-state QLD  # everything except the cohort already loaded
  python -I pipeline/load/load_providers.py --batch 250 --out data/load
"""
from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import re
import sys
import uuid
from collections import Counter, OrderedDict
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROVIDERS_GLOB = os.path.join(ROOT, "data", "providers", "*.jsonl")
SOURCES_YAML = os.path.join(ROOT, "pipeline", "sources.yaml")
NAMESPACE = uuid.UUID("6f3c2d7e-1a4b-4c5d-9e8f-0a1b2c3d4e5f")  # fixed: ids are stable across runs

STATES = {"NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"}
TITLE_RE = re.compile(
    r"^(?:(?:dr|prof|professor|a/prof|assoc(?:iate)?|clinical|adjunct|emeritus|mr|mrs|ms|miss|mx)\.?\s+)+",
    re.IGNORECASE,
)
EXPIRES = {"capacity": 90, "wait_time": 90, "phone": 365, "website": 365}  # days; others never expire

# The seeded conditions (adhd.me supabase/migrations/0016_wattle_mvp_tables.sql, table focus_conditions). Kept
# here so the loader needs no DB round trip; the insert still resolves ids through focus_conditions by slug, so a
# reseed cannot desync it.
CONDITIONS = {
    "endometriosis": ["endo", "endometriosis", "adenomyosis", "painful periods", "period pain"],
    "pcos": ["pcos", "polycystic ovary", "polycystic ovarian syndrome", "irregular periods"],
    "postpartum-mental-health": ["postnatal depression", "postpartum depression", "pnd", "perinatal anxiety",
                                 "perinatal depression", "postpartum anxiety", "baby blues"],
    "pelvic-pain": ["pelvic pain", "chronic pelvic pain", "vulvodynia", "painful sex", "dyspareunia", "pelvic floor pain"],
    "menopause": ["menopause", "perimenopause", "hot flushes", "hrt", "mht", "hormone therapy"],
    "adhd": ["adhd", "add", "attention deficit", "attention deficit hyperactivity disorder", "adult adhd", "adhd assessment"],
    "depression": ["depression", "low mood", "major depressive disorder", "mdd", "treatment resistant depression"],
    "anxiety": ["anxiety", "panic attacks", "panic disorder", "gad", "generalised anxiety", "social anxiety", "ocd"],
    "complex-psychiatric": ["bipolar", "schizophrenia", "psychosis", "borderline personality", "bpd", "complex ptsd",
                            "cptsd", "eating disorder", "complex mental health"],
    "persistent-pain": ["chronic pain", "persistent pain", "long term pain", "pain management", "neuropathic pain", "back pain"],
    "me-cfs": ["chronic fatigue", "cfs", "me/cfs", "me cfs", "myalgic encephalomyelitis", "post exertional malaise", "pem"],
    "fibromyalgia": ["fibromyalgia", "fibro", "widespread pain"],
    "long-covid": ["long covid", "post covid", "post-covid condition", "pasc", "post acute covid"],
    "pots-dysautonomia": ["pots", "postural orthostatic tachycardia", "dysautonomia", "autonomic dysfunction", "orthostatic intolerance"],
    "fnd": ["fnd", "functional neurological disorder", "functional seizures", "non-epileptic seizures", "conversion disorder"],
    "hypermobility-eds": ["eds", "ehlers danlos", "ehlers-danlos", "hypermobility", "hsd", "hypermobile", "joint hypermobility"],
    "ibs": ["ibs", "irritable bowel", "gut-brain", "functional gut disorder", "bloating"],
}


# ---------------------------------------------------------------- SQL literal helpers
def q(v) -> str:
    """Quote a scalar as a SQL literal."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def qarr(items) -> str:
    items = [i for i in (items or []) if i]
    if not items:
        return "'{}'::text[]"
    return "array[" + ",".join(q(i) for i in items) + "]::text[]"


def qjson(v, typed: bool = True) -> str:
    return cast(q(json.dumps(v, ensure_ascii=False, separators=(",", ":"))), "jsonb", typed)


def quuid(u: uuid.UUID, typed: bool = True) -> str:
    return f"'{u}'::uuid" if typed else f"'{u}'"


def cast(lit: str, typ: str, typed: bool) -> str:
    """VALUES lists resolve column types from the first row, so later rows carry no casts (smaller batches)."""
    return f"{lit}::{typ}" if typed else lit


def u5(*parts: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, "|".join(parts))


# ---------------------------------------------------------------- inputs
def read_sources_yaml(path: str) -> dict[str, dict]:
    """Minimal reader for the flat list in pipeline/sources.yaml (no yaml module in the stdlib)."""
    out, cur = {}, None
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            m = re.match(r"^\s*-\s+id:\s*(.+?)\s*$", line)
            if m:
                cur = {"id": m.group(1)}
                out[cur["id"]] = cur
                continue
            m = re.match(r"^\s{4}(\w+):\s*(.*?)\s*$", line)
            if m and cur is not None:
                val = m.group(2)
                if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                    val = val[1:-1]
                cur[m.group(1)] = val
    return out


def read_records(pattern: str, state: str | None, skip_state: str | None = None) -> list[dict]:
    recs = []
    for path in sorted(glob.glob(pattern)):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                states = {(l.get("state") or "").upper() for l in r.get("locations", [])}
                if state and state not in states:
                    continue
                if skip_state and skip_state in states:
                    continue
                recs.append(r)
    return recs


# ---------------------------------------------------------------- shaping
def split_name(name: str) -> tuple[str | None, str | None]:
    base = TITLE_RE.sub("", (name or "").strip()).split(",")[0].strip()
    parts = [p for p in base.split() if p]
    if not parts:
        return None, None
    if len(parts) == 1:
        return None, parts[0]
    return parts[0], parts[-1]


def norm(s) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def location_key(l: dict) -> str | None:
    fields = [norm(l.get(k)) for k in ("name", "address", "suburb", "state", "postcode")]
    if not any(fields):
        return None
    return "|".join(fields)


def valid_state(s) -> str | None:
    s = (s or "").upper().strip()
    return s if s in STATES else None


def valid_postcode(p) -> str | None:
    p = str(p or "").strip()
    return p if re.fullmatch(r"[0-9]{4}", p) else None


def primary_source(r: dict) -> dict:
    srcs = r.get("sources") or []
    return srcs[0] if srcs else {"source": "unknown", "source_url": None, "observed_at": None, "legal_basis": None}


def observed_at(src: dict, fallback: str) -> str:
    return src.get("observed_at") or fallback


def expires(field: str, observed: str) -> str | None:
    days = EXPIRES.get(field)
    if not days:
        return None
    base = dt.datetime.fromisoformat(observed.replace("Z", "+00:00"))
    return (base + dt.timedelta(days=days)).isoformat()


def match_conditions(tags: list[str]) -> set[str]:
    """Case-insensitive substring match of condition synonyms against the record's tags.
    Synonyms shorter than five characters ('add', 'eds', 'pem', 'gad', ...) are matched on word boundaries so
    'Addiction' does not become ADHD and 'Comprehensive' does not become EDS."""
    text = " || ".join(norm(t) for t in tags if t)
    if not text:
        return set()
    hits = set()
    for slug, syns in CONDITIONS.items():
        for s in syns:
            if len(s) < 5:
                if re.search(r"(?<![a-z0-9])" + re.escape(s) + r"(?![a-z0-9])", text):
                    hits.add(slug)
                    break
            elif s in text:
                hits.add(slug)
                break
    return hits


def source_meta(source: str, yaml_sources: dict, first_url: str | None, legal_basis: str | None, count: int) -> dict:
    yk = source if source in yaml_sources else source.replace("-", "_")
    y = yaml_sources.get(yk, {})
    url = y.get("url")
    if not url or url.startswith("n/a"):
        url = None
        if first_url:
            sp = urlsplit(first_url)
            url = f"{sp.scheme}://{sp.netloc}/"
    return {
        "id": source,
        "name": y.get("name") or source.replace("_", " ").replace("-", " ").title() + " directory",
        "url": url,
        "kind": "scrape",  # every merged provider record today comes from a public directory page
        "legal_basis": legal_basis or y.get("legal_basis") or "Facts from a public page; see pipeline/sources.yaml",
        "cadence": y.get("cadence"),
        "record_count": count,
    }


# ---------------------------------------------------------------- SQL emitters (each returns one statement for <= batch rows)
def sql_sources(rows: list[dict]) -> str:
    vals = ",\n".join(
        f"({q(r['id'])},{q(r['name'])},{q(r['url'])},{q(r['kind'])},{q(r['legal_basis'])},{q(r['cadence'])},{r['record_count']})"
        for r in rows
    )
    return (
        "insert into sources (id, name, url, kind, legal_basis, cadence, record_count) values\n" + vals +
        "\non conflict (id) do update set name = excluded.name, url = coalesce(excluded.url, sources.url), "
        "legal_basis = excluded.legal_basis, cadence = coalesce(excluded.cadence, sources.cadence), "
        "record_count = excluded.record_count, last_run_at = now();"
    )


def sql_practitioners(rows: list[dict]) -> str:
    vals = ",\n".join(
        f"({quuid(r['id'], i == 0)},{q(r['source_key'])},{q(r['given'])},{q(r['family'])},{q(r['display'])},'medical',{qarr([r['specialty']])})"
        for i, r in enumerate(rows)
    )
    return (
        "insert into practitioners (id, source_key, given_name, family_name, display_name, profession, specialties) values\n" + vals +
        "\non conflict (source_key) do update set given_name = excluded.given_name, family_name = excluded.family_name, "
        "display_name = excluded.display_name, specialties = excluded.specialties, updated_at = now();"
    )


def sql_locations(rows: list[dict]) -> str:
    def geo(r):
        if r["lat"] is None or r["lng"] is None:
            return "null::geography"
        return f"st_setsrid(st_makepoint({float(r['lng'])!r},{float(r['lat'])!r}),4326)::geography"
    vals = ",\n".join(
        f"({quuid(r['id'], i == 0)},{q(r['name'])},{q(r['address'])},{q(r['suburb'])},{q(r['state'])},{q(r['postcode'])},{geo(r)})"
        for i, r in enumerate(rows)
    )
    return (
        "insert into locations (id, name, address_line, suburb, state, postcode, geo) values\n" + vals +
        "\non conflict (id) do update set name = excluded.name, address_line = excluded.address_line, suburb = excluded.suburb, "
        "state = excluded.state, postcode = excluded.postcode, geo = coalesce(excluded.geo, locations.geo), updated_at = now();"
    )


def sql_roles(rows: list[dict]) -> str:
    vals = ",\n".join(
        f"({quuid(r['id'], i == 0)},{quuid(r['practitioner_id'], i == 0)},{quuid(r['location_id'], i == 0)},{q(r['primary'])},"
        f"{qjson(r['booking'], i == 0) if r['booking'] else cast('null', 'jsonb', i == 0)})"
        for i, r in enumerate(rows)
    )
    return (
        "insert into practitioner_roles (id, practitioner_id, location_id, \"primary\", booking) values\n" + vals +
        "\non conflict (practitioner_id, location_id) do update set \"primary\" = excluded.\"primary\", "
        "booking = coalesce(excluded.booking, practitioner_roles.booking);"
    )


def sql_observations(rows: list[dict]) -> str:
    vals = ",\n".join(
        f"({q(r['entity_type'])},{quuid(r['entity_id'], i == 0)},{q(r['field'])},{qjson(r['value'], i == 0)},'found',{q(r['source_id'])},"
        f"{q(r['source_url'])},{cast(q(r['observed_at']), 'timestamptz', i == 0)},{cast(q(r['expires_at']), 'timestamptz', i == 0)})"
        for i, r in enumerate(rows)
    )
    return (
        "insert into observations (entity_type, entity_id, field, value, tier, source_id, source_url, observed_at, expires_at)\n"
        "select v.* from (values\n" + vals + "\n) as v(entity_type, entity_id, field, value, tier, source_id, source_url, observed_at, expires_at)\n"
        "where not exists (select 1 from observations o where o.entity_type = v.entity_type and o.entity_id = v.entity_id "
        "and o.field = v.field and o.source_id = v.source_id and o.observed_at = v.observed_at);"
    )


def sql_focus(rows: list[dict]) -> str:
    vals = ",\n".join(
        f"({quuid(r['practitioner_id'], i == 0)},{q(r['slug'])},{q(r['source_id'])},{q(r['source_url'])},{cast(q(r['observed_at']), 'timestamptz', i == 0)})"
        for i, r in enumerate(rows)
    )
    return (
        "insert into provider_clinical_focus (practitioner_id, condition_id, strength, tier, source_id, source_url, observed_at)\n"
        "select v.practitioner_id, c.id, 'secondary', 'found', v.source_id, v.source_url, v.observed_at\n"
        "from (values\n" + vals + "\n) as v(practitioner_id, slug, source_id, source_url, observed_at)\n"
        "join focus_conditions c on c.slug = v.slug\n"
        "on conflict (practitioner_id, condition_id) do update set strength = excluded.strength, tier = excluded.tier, "
        "source_id = excluded.source_id, source_url = excluded.source_url, observed_at = excluded.observed_at;"
    )


# ---------------------------------------------------------------- build
def build(records: list[dict], yaml_sources: dict, run_stamp: str) -> dict[str, list[dict]]:
    sources_seen: OrderedDict[str, dict] = OrderedDict()
    source_counts: Counter = Counter()
    practitioners, locations, roles, observations, focus = [], OrderedDict(), [], [], []
    loc_obs_seen: set[tuple] = set()
    role_seen: set[uuid.UUID] = set()

    for r in records:
        src = primary_source(r)
        for s in r.get("sources") or []:
            sid = s.get("source") or "unknown"
            source_counts[sid] += 1
            if sid not in sources_seen:
                sources_seen[sid] = {"first_url": s.get("source_url"), "legal_basis": s.get("legal_basis")}
        obs_at = observed_at(src, run_stamp)
        src_id = src.get("source") or "unknown"
        src_url = src.get("source_url")

        pid = u5("practitioner", r["id"])
        given, family = split_name(r.get("name"))
        practitioners.append({
            "id": pid, "source_key": r["id"], "given": given, "family": family,
            "display": (r.get("name") or "").strip() or r["id"], "specialty": r.get("specialty") or "unknown",
        })

        def obs(entity_type, entity_id, field, value, at=obs_at, sid=src_id, surl=src_url):
            observations.append({
                "entity_type": entity_type, "entity_id": entity_id, "field": field, "value": value,
                "source_id": sid, "source_url": surl, "observed_at": at, "expires_at": expires(field, at),
            })

        tags = [t for t in (r.get("tags") or []) if t]
        if tags:
            obs("practitioner", pid, "clinical_tags", tags)
        if r.get("languages"):
            obs("practitioner", pid, "languages", r["languages"])
        if r.get("telehealth") is not None:
            obs("practitioner", pid, "telehealth", bool(r["telehealth"]))
        if r.get("wait_time"):
            obs("practitioner", pid, "wait_time", r["wait_time"])
        if r.get("taking_new_patients") is not None:
            obs("practitioner", pid, "capacity", "yes" if r["taking_new_patients"] else "no")

        for i, l in enumerate(r.get("locations") or []):
            key = location_key(l)
            if key is None:
                continue
            lid = u5("location", key)
            if lid not in locations:
                locations[lid] = {
                    "id": lid, "name": l.get("name"), "address": l.get("address"), "suburb": l.get("suburb"),
                    "state": valid_state(l.get("state")), "postcode": valid_postcode(l.get("postcode")),
                    "lat": l.get("lat"), "lng": l.get("lng"),
                }
            else:  # keep the first geo we saw; fill a missing one
                cur = locations[lid]
                if cur["lat"] is None and l.get("lat") is not None:
                    cur["lat"], cur["lng"] = l.get("lat"), l.get("lng")
            booking = {"via": "phone", "phone": l["phone"]} if l.get("phone") else None
            if l.get("website"):
                booking = dict(booking or {"via": "website"}, url=l["website"])
            role_id = u5("role", str(pid), str(lid))
            if role_id not in role_seen:  # a record can list one place twice (e.g. with and without a phone)
                role_seen.add(role_id)
                roles.append({"id": role_id, "practitioner_id": pid, "location_id": lid,
                              "primary": i == 0, "booking": booking})
            for field in ("phone", "website"):
                if l.get(field) and (lid, field, l[field]) not in loc_obs_seen:
                    loc_obs_seen.add((lid, field, l[field]))
                    obs("location", lid, field, l[field])

        for slug in sorted(match_conditions(tags)):
            focus.append({"practitioner_id": pid, "slug": slug, "source_id": src_id, "source_url": src_url, "observed_at": obs_at})

    sources = [source_meta(sid, yaml_sources, meta["first_url"], meta["legal_basis"], source_counts[sid])
               for sid, meta in sources_seen.items()]
    return {"sources": sources, "practitioners": practitioners, "locations": list(locations.values()),
            "roles": roles, "observations": observations, "focus": focus}


EMITTERS = [  # load order respects foreign keys
    ("sources", sql_sources), ("practitioners", sql_practitioners), ("locations", sql_locations),
    ("roles", sql_roles), ("observations", sql_observations), ("focus", sql_focus),
]


def write_batches(data: dict, out_dir: str, cohort: str, batch: int) -> list[tuple[str, int]]:
    os.makedirs(out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(out_dir, f"{cohort}_*.sql")):
        os.remove(old)
    written, n = [], 0
    for table, emit in EMITTERS:
        rows = data[table]
        for start in range(0, len(rows), batch):
            chunk = rows[start:start + batch]
            n += 1
            path = os.path.join(out_dir, f"{cohort}_{n:03d}_{table}.sql")
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(f"-- {cohort}: {table} rows {start + 1}-{start + len(chunk)} of {len(rows)}; generated by pipeline/load/load_providers.py\n")
                fh.write(emit(chunk))
                fh.write("\n")
            written.append((path, len(chunk)))
    manifest = os.path.join(out_dir, f"{cohort}_manifest.json")
    with open(manifest, "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"cohort": cohort, "batch": batch, "counts": {t: len(data[t]) for t, _ in EMITTERS},
                   "files": [{"file": os.path.basename(p), "rows": c} for p, c in written]}, fh, indent=2)
    return written


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--state", help="only records with at least one location in this state (e.g. QLD)")
    ap.add_argument("--skip-state", help="drop records with any location in this state (e.g. QLD after a --state QLD run)")
    ap.add_argument("--batch", type=int, default=500, help="max rows per statement (default 500)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "load"), help="output directory (default data/load)")
    ap.add_argument("--providers", default=PROVIDERS_GLOB, help="glob of merged provider jsonl files")
    args = ap.parse_args(argv)

    state = args.state.upper() if args.state else None
    if state and state not in STATES:
        ap.error(f"--state must be one of {sorted(STATES)}")
    skip = args.skip_state.upper() if args.skip_state else None
    if skip and skip not in STATES:
        ap.error(f"--skip-state must be one of {sorted(STATES)}")
    cohort = state.lower() if state else ("all_minus_" + skip.lower() if skip else "all")
    run_stamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()

    records = read_records(args.providers, state, skip)
    if not records:
        print("no records matched", file=sys.stderr)
        return 1
    data = build(records, read_sources_yaml(SOURCES_YAML), run_stamp)
    written = write_batches(data, args.out, cohort, args.batch)

    print(f"cohort={cohort} records={len(records)}")
    for table, _ in EMITTERS:
        print(f"  {table:14s} {len(data[table])}")
    print(f"  files          {len(written)} -> {args.out}")
    by_spec = Counter(p["specialty"] for p in data["practitioners"])
    for spec, c in sorted(by_spec.items()):
        print(f"  {spec:28s} {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
