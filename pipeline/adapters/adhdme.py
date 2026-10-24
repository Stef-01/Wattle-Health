"""ADHDme network → Wattle. The whole clinician base, not a hand-copied subset.

The base of record lives in the ADHDme site repo as a Python literal:
`CLINICIANS` in revamped-adhd.me/scripts/build-profiles.py, the same list that writes every
profile page and the cards on The Network. This adapter reads it, snapshots it verbatim, and
derives the two research files Wattle's loader already reads (src/data/published.ts), so the
roster is the ADHDme network rather than a transcription of it that drifts.

    python -I pipeline/adapters/adhdme.py --source ../revamped-adhd.me   # refresh from the site repo
    python -I pipeline/adapters/adhdme.py                                 # rebuild from the snapshot
    python -I pipeline/adapters/adhdme.py --check                         # exit 1 if anything on disk differs

Writes
  data/adhdme/clinicians.json                        the base, verbatim, with a provenance header
  data/enriched/personal/research-adhdme.json        prescribers (GPs, psychiatrists)
  data/enriched/personal/research-adhdme-allied.json psychology, OT, allied health and coaching

Reads (hand-owned, never written here)
  data/adhdme/personal.json   the researched split of each clinician's own words into
                              philosophy / lived experience / quotes. Mechanical derivation is the
                              fallback; where a human has read the page, that reading wins.

LEGAL BASIS. ADHDme is the founder's own site and the clinicians on it published these words
there. Facts and the clinician's own published description, short quotations attributed, portraits
served from adhdme.au rather than copied. Same basis the first two sweeps recorded.

This adapter makes no model calls. Kept from CLAUDE.md: no paraphrase of a review, every fact carries its
source and date, "not declared" is a rendered value and never a blank.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "data" / "adhdme" / "clinicians.json"
OVERLAY = ROOT / "data" / "adhdme" / "personal.json"
RESEARCH = ROOT / "data" / "enriched" / "personal"
GAZETTEER = ROOT / "data" / "geo" / "au-postcodes.json"
VOCABULARY = ROOT / "disciplines" / "mvp.yaml"

SITE = "https://www.adhdme.au"
LEGAL_BASIS = (
    "facts and the clinician's own published description on the ADHDme network page "
    "(founder's site); short quotations attributed; portrait served from ADHDme"
)

STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]

# ADHDme category → the Wattle contract's `Specialty` (src/matching/types.ts). Coaches,
# dietitians, physios, exercise physiologists, social workers and counsellors are all
# `allied-health`; the record's `profession` carries the title the person actually uses.
SPECIALTY = {
    "gp": "general-practice",
    "psychiatrist": "psychiatry",
    "psychologist": "psychology",
    "occupational-therapy": "occupational-therapy",
    "allied": "allied-health",
    "coach": "allied-health",
    "physiotherapy": "allied-health",
    "exercise-physiology": "allied-health",
}
PRESCRIBERS = {"gp", "psychiatrist"}
AGES = {"children": "child", "teens": "adolescent", "adults": "adult"}
GENDER = {"he/him": "man", "she/her": "woman", "they/them": "non-binary"}

# A first-person sentence that reports living with ADHD (or being late-diagnosed) is lived
# experience; everything else from the same page is a quote. Presence is the signal, never the words.
LIVED = re.compile(
    r"\b(i(?:'| a|’a)?m? (?:a |an )?(?:late[- ]diagnosed|diagnosed|also)|i have adhd|i live with adhd|"
    r"i(?:'|’)?ve been living with|my own adhd|as someone with adhd|my adhd)\b",
    re.I,
)


# ---------------------------------------------------------------- the base


def read_site_repo(source: Path) -> list[dict]:
    """`CLINICIANS` out of revamped-adhd.me/scripts/build-profiles.py."""
    build = source / "scripts" / "build-profiles.py"
    if not build.exists():
        raise SystemExit(f"adhdme: no clinician base at {build}")
    spec = importlib.util.spec_from_file_location("adhdme_build_profiles", build)
    if spec is None or spec.loader is None:
        raise SystemExit(f"adhdme: cannot load {build}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    clinicians = list(module.CLINICIANS)
    last = getattr(module, "LAST", set())
    for c in clinicians:
        # `LAST` is ADHDme's own call (owner, 2026-10-07): the evidence base for this kind of care
        # is unclear, so the card sits last and the care navigator leaves it out. Carried, not re-judged.
        c["evidence_unclear"] = c["id"] in last
    return clinicians


def write_snapshot(clinicians: list[dict], source: Path | None) -> str:
    payload = {
        "source": "ADHDme network (revamped-adhd.me/scripts/build-profiles.py, CLINICIANS)",
        "source_repo": "https://github.com/Stef-01/revamped-adhd.me",
        "site": SITE,
        "legal_basis": LEGAL_BASIS,
        "observed_at": dt.date.today().isoformat() if source else snapshot_date(),
        "count": len(clinicians),
        "clinicians": clinicians,
    }
    return json.dumps(payload, ensure_ascii=False, indent=1) + "\n"


def snapshot_date() -> str:
    if SNAPSHOT.exists():
        return json.loads(SNAPSHOT.read_text("utf-8")).get("observed_at", dt.date.today().isoformat())
    return dt.date.today().isoformat()


def read_snapshot() -> list[dict]:
    if not SNAPSHOT.exists():
        raise SystemExit("adhdme: no snapshot; run once with --source <path to revamped-adhd.me>")
    return json.loads(SNAPSHOT.read_text("utf-8"))["clinicians"]


# ---------------------------------------------------------------- vocabulary and geography


def conditions_vocabulary() -> list[tuple[str, list[str]]]:
    """(condition id, cues) from disciplines/mvp.yaml, the founder's vocabulary."""
    import yaml  # noqa: PLC0415 — maintenance tool, not the request path

    doc = yaml.safe_load(VOCABULARY.read_text("utf-8"))
    return [(c["id"], [str(q).lower() for q in c.get("cues", [])]) for c in doc.get("conditions", [])]


def conditions_in(text: str, vocabulary: list[tuple[str, list[str]]]) -> list[str]:
    """Closed condition ids a page's own words reach. Word boundaries; cues under four characters
    are skipped, because "add" and "ice" fire on ordinary English (src/matching/known-fps.ts)."""
    hay = f" {text.lower()} "
    out: list[str] = []
    for cid, cues in vocabulary:
        for cue in cues:
            if len(cue) < 4:
                continue
            if re.search(rf"(^|[^a-z]){re.escape(cue)}([^a-z]|$)", hay):
                out.append(cid)
                break
    return out


def gazetteer() -> dict[tuple[str, str], tuple[str, float, float]]:
    """(suburb, state) → (postcode, lat, lon) from the GeoNames export the app already ships."""
    rows = json.loads(GAZETTEER.read_text("utf-8"))["rows"]
    out: dict[tuple[str, str], tuple[str, float, float]] = {}
    for suburb, postcode, state, lat, lon in rows:
        out.setdefault((suburb.lower(), state), (postcode, lat, lon))
    return out


# ---------------------------------------------------------------- per-clinician mapping


def text_of(c: dict) -> str:
    parts = [c.get("description", ""), c.get("role", ""), c.get("descriptor") or "", c.get("quote") or ""]
    parts += list(c.get("chips", [])) + list(c.get("experience", [])) + list(c.get("about", []))
    parts += [v for _, v in c.get("details", [])]
    return " ".join(p for p in parts if p)


# An organisational post is not a profession: "Clinical Psychologist, Founder and Director" is a
# clinical psychologist who also runs the place. Only these trailing clauses come off; a title that
# genuinely contains "and" ("Educational and Developmental Psychologist", "Therapy Assistant and
# Support Worker", "ADHD Coach and Mentor") is kept whole.
POST = re.compile(r"[,\s]+(?:and\s+)?(?:founder|co[- ]?founder|owner|principal\s+)?(?:clinic\s+)?director\b.*$|,\s*founder\b.*$", re.I)


def profession_of(c: dict) -> str:
    """The title the person uses. `role` is ADHDme's full professional title; `descriptor` is the
    short card label and sometimes carries a status instead ("Psychologist, on maternity leave"),
    so the title comes from `role`."""
    raw = POST.sub("", (c.get("role") or c.get("descriptor") or "").strip()).strip(" ,")
    if not raw:
        return ""
    # Sentence case, because every other profession in the roster is written that way. Initialisms
    # (ADHD, GP) are all-uppercase tokens and keep their case wherever they sit.
    words = raw.split()
    out = [words[0] if words[0].isupper() else words[0][:1].upper() + words[0][1:].lower()]
    out += [w if w.isupper() else w.lower() for w in words[1:]]
    return " ".join(out)


def reach_of(c: dict) -> dict:
    """Where this person can actually see somebody.

    `schema.area == "Australia"` is ADHDme's own declaration that the practice works by telehealth
    Australia-wide; it is set on no prescriber, which is right: an ADHD prescriber's authority to
    treat sits with the state they practise in, so a GP or psychiatrist reaches their own state
    and the page never claims otherwise.
    """
    schema = c.get("schema", {})
    works_for = schema.get("works_for") or {}
    home = works_for.get("state") or schema.get("state")
    national = (schema.get("area") or "") == "Australia"
    in_person = c.get("in_person") is not False and not re.match(r"^telehealth", (c.get("place") or ""), re.I)
    telehealth = bool(c.get("telehealth"))
    out = {
        "home_state": home,
        "in_person_states": [home] if (in_person and home) else [],
        "telehealth_states": (STATES if national else ([home] if (telehealth and home) else [])),
        "national_telehealth": national,
    }
    if c["category"] in PRESCRIBERS and telehealth and not national:
        out["note"] = (
            f"Prescribing is authorised state by state, so {c['short']} sees people in "
            f"{home} — in the rooms or by telehealth."
        )
    elif national and not in_person:
        out["note"] = "Telehealth Australia-wide."
    elif national:
        out["note"] = f"In person in {works_for.get('locality') or home}, and telehealth Australia-wide."
    out["states"] = sorted(set(out["in_person_states"] + out["telehealth_states"]), key=STATES.index)
    return out


def fees_of(c: dict) -> dict:
    f = c.get("fees") or {}
    return {
        "heading": f.get("heading") or "What it costs",
        "figures": [{"amount": a, "label": b} for a, b in f.get("figures", [])],
        "notes": list(f.get("notes", [])),
    }


def initial_fee_dollars(c: dict) -> int | None:
    for amount, label in (c.get("fees") or {}).get("figures", []):
        m = re.fullmatch(r"\$(\d[\d,]*)", amount.strip())
        if m and re.search(r"initial|first|consultation|assessment|session", label, re.I):
            value = int(m.group(1).replace(",", ""))
            return value or None
    return None


def accepting(c: dict) -> bool | None:
    for key, value in c.get("details", []):
        if key == "Currently":
            if re.search(r"waitlist|closed|not taking|full\b", value, re.I):
                return False
            if re.search(r"accept|taking|open\b|availab", value, re.I):
                return True
    return None


def personal_of(c: dict, overlay: dict) -> dict:
    """The clinician's own words, split. A researched split wins; otherwise derive one."""
    hand = overlay.get(c["id"])
    if hand:
        return hand
    about = [p.strip() for p in c.get("about", []) if p and p.strip()]
    sentences = [s.strip() for p in about for s in re.split(r"(?<=[.!?])\s+", p) if len(s.strip()) > 25]
    lived = next((s for s in sentences if LIVED.search(s)), None)
    quote = (c.get("quote") or "").strip() or None
    quotes: list[dict] = []
    if quote:
        quotes.append({"text": quote, "about": "approach"})
    if lived:
        quotes.append({"text": lived, "about": "lived"})
    for s in sentences:
        if len(quotes) >= 4:
            break
        if s != lived and s != quote and len(s) <= 300:
            quotes.append({"text": s, "about": "other"})
    return {
        "philosophy_of_care": quote,
        "why_medicine": None,
        "communication_approach": None,
        "communication": [],
        "lived_experience": lived,
        "hobbies": None,
        "outside_medicine": None,
        "quotes": quotes,
    }


def researched(c: dict, vocabulary, places, overlay: dict) -> dict:
    schema = c.get("schema", {})
    works_for = schema.get("works_for") or {}
    suburb = works_for.get("locality") or (schema.get("areas") or [None])[0]
    state = works_for.get("state") or schema.get("state")
    postcode = lat = lng = None
    if suburb and state:
        hit = places.get((suburb.lower(), state))
        if hit:
            postcode, lat, lng = hit
    name = c["name"]
    bare = re.sub(r"^(Dr|Prof|A/Prof|Mr|Ms|Mrs)\.?\s+", "", name).split()
    conditions = sorted(set(["adhd", *conditions_in(text_of(c), vocabulary)]))
    lived_tag = c.get("lived")
    record = {
        "name": name,
        "given": bare[0] if bare else name,
        "family": bare[-1] if len(bare) > 1 else "",
        "specialty": SPECIALTY[c["category"]],
        "profession": profession_of(c),
        "gender": GENDER.get((c.get("pronouns") or "").strip().lower()),
        "practice": {
            "name": c.get("practice") or "",
            "address": None,
            "suburb": suburb,
            "state": state,
            "postcode": postcode,
            "phone": works_for.get("telephone"),
            "website": works_for.get("url"),
            "lat": lat,
            "lng": lng,
        },
        "telehealth": "only" if c.get("in_person") is False else ("some" if c.get("telehealth") else "none"),
        "referral_required": c["category"] == "psychiatrist",
        "fee_initial_dollars": initial_fee_dollars(c),
        "taking_new_patients": accepting(c),
        "languages": list(c.get("languages") or []) or ["English"],
        "years_in_specialty": None,
        "conditions": conditions,
        "populations": [AGES[a] for a in c.get("ages", []) if a in AGES] or ["adult"],
        "focus_tags": ([lived_tag] if lived_tag else []) + list(c.get("chips", [])),
        "personal": personal_of(c, overlay),
        "source": {
            "url": f"{SITE}/{c['slug']}.html",
            "page_title": name,
            "observed_at": snapshot_date(),
            "legal_basis": LEGAL_BASIS,
        },
        "photo_url": f"{SITE}/assets/clinicians/{c['id']}-640.webp",
        "reach": reach_of(c),
        # The whole ADHDme card, so the profile can show what the network page shows: what it
        # costs, how the pathway runs, who they work with, and where to book.
        "adhdme": {
            "id": c["id"],
            "slug": c["slug"],
            "category": c["category"],
            "role": c.get("role") or "",
            "descriptor": c.get("descriptor"),
            "summary": c.get("description") or "",
            "chips": list(c.get("chips", [])),
            "qualifications": c.get("qualifications") or None,
            "experience": list(c.get("experience", [])),
            "pathway": [{"step": a, "detail": b} for a, b in c.get("pathway", [])],
            "works_with": list(c.get("works_with", [])),
            "fees": fees_of(c),
            "booking": ({"url": c["book_href"], "hint": c.get("book_hint")} if c.get("book_href") else None),
            "links": [{"kind": k, "label": label, "url": url} for k, label, url in c.get("links", [])],
            "details": [{"label": k, "value": v} for k, v in c.get("details", [])],
            "disclosure": c.get("disclosure") or None,
            "ages": list(c.get("ages", [])),
            "assesses": c.get("assesses", True),
            "bulk_billed": bool(c.get("bulk_billed")),
            "evidence_unclear": bool(c.get("evidence_unclear")),
            "profile_url": f"{SITE}/{c['slug']}.html",
        },
    }
    return record


# ---------------------------------------------------------------- output


def research_file(category: str, doctors: list[dict]) -> str:
    return json.dumps(
        {
            "category": category,
            "researched_at": snapshot_date(),
            "generated_by": "pipeline/adapters/adhdme.py — edit the ADHDme base or data/adhdme/personal.json, not this file",
            "doctors": doctors,
        },
        ensure_ascii=False,
        indent=1,
    ) + "\n"


def build(clinicians: list[dict], source: Path | None) -> dict[Path, str]:
    vocabulary = conditions_vocabulary()
    places = gazetteer()
    overlay = json.loads(OVERLAY.read_text("utf-8")).get("personal", {}) if OVERLAY.exists() else {}
    rows = [researched(c, vocabulary, places, overlay) for c in clinicians]
    rows.sort(key=lambda r: (r["family"] or r["name"], r["given"]))
    prescribers = [r for r in rows if r["specialty"] in ("general-practice", "psychiatry")]
    allied = [r for r in rows if r["specialty"] not in ("general-practice", "psychiatry")]
    return {
        SNAPSHOT: write_snapshot(clinicians, source),
        RESEARCH / "research-adhdme.json": research_file("ADHDme prescribers (GPs and psychiatrists)", prescribers),
        RESEARCH / "research-adhdme-allied.json": research_file("ADHDme psychology, occupational therapy, allied health and coaching", allied),
    }


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, help="path to a revamped-adhd.me checkout; omit to rebuild from the snapshot")
    ap.add_argument("--check", action="store_true", help="exit 1 if any output differs from what would be written")
    args = ap.parse_args(argv)
    clinicians = read_site_repo(args.source) if args.source else read_snapshot()
    out = build(clinicians, args.source)
    stale = [p for p, text in out.items() if not p.exists() or p.read_text("utf-8") != text]
    if args.check:
        for p in stale:
            print(f"out of date: {p.relative_to(ROOT)}")
        print("adhdme: up to date" if not stale else f"adhdme: {len(stale)} file(s) differ; run python -I pipeline/adapters/adhdme.py")
        return 1 if stale else 0
    for p, text in out.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        print(("wrote  " if p in stale else "same   ") + str(p.relative_to(ROOT)))
    print(f"adhdme: {len(clinicians)} clinicians")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
