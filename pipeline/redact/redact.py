"""Redact personal details from a transcript before it leaves for the classifier (founder 2026-10-24).

Reads {"text": "..."} on stdin and writes {"text": "...", "counts": {...}} on stdout. Three steps:

1. Patterns: emails, URLs, phone numbers, Medicare/NDIS/AHPRA/provider numbers, and names that sit
   in a fixed frame ("Dr Omar Saleh", "my counsellor Jodie", "I'm Karen Mitchell"). These never
   reach any model.
2. A model on Amazon Bedrock in Sydney points at the names, street addresses, dates of birth and
   named organisations the patterns missed. It only lists spans; code replaces them, so it can
   never drop or reword clinical text.
3. Guards throw out spans that are not identifiers: places (matching needs suburb, city and state),
   ages, and clinical or provider words from the vocabulary (disciplines/mvp.yaml).

The model is REDACT_MODEL, a comma-separated chain (default Claude Haiku 5.5, then Haiku 4.5, then
Sonnet 4.6, all on the `au.` profile, then Amazon Nova Pro in Sydney). Never put a `global.` or `apac.` profile in
it: those can process outside Australia. REDACT_PASSES=2 asks the model twice
and takes the union. Credentials: AWS_BEARER_TOKEN_BEDROCK or any standard AWS credential;
AWS_REGION defaults to Sydney. Any failure exits non-zero and the caller sends nothing (fail closed).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.config import Config

# A chain, tried in order: the next model is used only when a model refuses access (not granted on
# the account, or the Anthropic use-case form not yet submitted). Every model here stays in
# Australia: `au.` profiles route only between Sydney and Melbourne (checked with
# GetInferenceProfile, 2026-10-24); Nova Pro runs in Sydney only.
MODEL = os.environ.get("REDACT_MODEL", "").strip() or "au.anthropic.claude-haiku-5-5,au.anthropic.claude-haiku-4-5-20251001-v1:0,au.anthropic.claude-sonnet-4-6,amazon.nova-pro-v1:0"
REGION = os.environ.get("AWS_REGION", "").strip() or "ap-southeast-2"
PASSES = max(1, int(os.environ.get("REDACT_PASSES", "1") or 1))
ROOT = Path(__file__).resolve().parents[2]

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")),
    # Clinician identifiers: AHPRA registration (MED0001234567) and Medicare provider numbers (2345671A).
    ("ID", re.compile(r"\b[A-Z]{3}\d{10}\b")),
    ("ID", re.compile(r"\b\d{6}[0-9A-Z][A-HJ-NP-Y]\b")),
    ("URL", re.compile(r"\bhttps?://\S+|\bwww\.\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|au|io|health)\b(?:/\S*)?", re.I)),
    # Australian phones: +61 / 04xx / (0x) landlines, with spaces, dots or dashes.
    ("PHONE", re.compile(r"(?:\+?61[\s.-]?|\(?\b0)[2-478]\)?(?:[\s.-]?\d){8}\b")),
    # Medicare (10-11 digits), IHI (16), NDIS (9) and other long runs of digits read as an identifier.
    ("ID", re.compile(r"\b\d(?:[\s-]?\d){8,15}\b")),
]

# Covers O'Brien, McKenzie, Smith-Jones and D'Arcy, not just Smith.
NAME_WORD = r"[A-Z](?:[a-z]+|['’][A-Z][a-z]+)(?:[A-Z][a-z]+)?(?:-[A-Z][a-z]+)?"
NAME = rf"{NAME_WORD}(?:\s+{NAME_WORD})?"
# A name is the word(s) after one of these frames. The frame stays; only the name is replaced.
NAME_FRAMES = [
    re.compile(rf"\b(?:Dr|Doctor|Prof|Professor|Mr|Mrs|Ms|Miss|Mx)\.?\s+({NAME})"),
    re.compile(rf"(?i:\b(?:son|daughter|grandson|granddaughter|child|boy|girl|mum|mom|mother|dad|father|partner|husband|wife|boyfriend|girlfriend|brother|sister|counsellor|counselor|psychologist|psychiatrist|paediatrician|pediatrician|gp|teacher|nurse|friend|boss|carer|client|patient|student|referring|seeing)\s+)({NAME})"),
    re.compile(rf"(?i:\b(?:i'm|i’m|i am|my name is|my name's|my name’s|this is|it's|it’s|it is|name:)\s+(?:dr\.?\s+)?)({NAME})"),
    # Speech-to-text often comes back lowercase; only the explicit "my name is" frame is trusted there.
    re.compile(r"(?i:\bmy name(?: is|'s|’s)\s+)((?!and\b|i\b|i'm\b)[a-z]+(?:\s+(?!and\b|i\b|i'm\b|from\b)[a-z]+)?)\b"),
]

STOP = {"dr", "doctor", "prof", "professor", "mr", "mrs", "ms", "miss", "mx", "aboriginal", "torres", "strait", "islander", "indigenous", "australian", "adhd", "odd", "asd", "gp", "year",
        "here", "calling", "not", "just", "so", "really", "also", "still", "on", "in", "at", "from", "the", "a", "an"}
STATES = {"nsw", "new south wales", "vic", "victoria", "qld", "queensland", "wa", "western australia", "sa", "south australia",
          "tas", "tasmania", "act", "nt", "northern territory", "australia"}
REGIONS = {"gold coast", "sunshine coast", "central coast", "western sydney", "south east queensland", "north queensland",
           "far north queensland", "inner west", "northern beaches", "hills district", "the hills", "top end", "red centre"}
PROFESSIONS = {"ams", "accho", "camhs", "cds", "phn", "ndis", "headspace", "student", "school", "uni", "university", "college", "year", "grade", "gp", "doctor", "psychiatrist", "psychologist", "paediatrician", "pediatrician", "paediatrics", "pediatrics", "paeds",
               "occupational", "therapist", "therapy", "ot", "speech", "pathology", "pathologist", "counsellor", "counselor", "coach",
               "nurse", "dietitian", "physio", "physiotherapist", "neuroaffirming", "neurodiversity", "affirming", "telehealth",
               "bulk", "billed", "billing", "clinic", "clinician", "specialist", "female", "male", "assessment", "practitioner"}

BRIEF = """You find personal identifiers in a health transcript so code can remove them. List every span, \
copied exactly as it appears (same spelling, case and spacing):
- NAME: any person's name, even a first name alone, even in lowercase (patient, family, friends, the clinician \
speaking or writing, any other clinician)
- ADDRESS: a street address or unit number (a house number with a street name)
- DOB: a full date of birth
- ORG: a named school, university (including abbreviations), employer, workplace, clinic or hospital practice
- ID: any phone, email, Medicare, NDIS, registration or other identifying number
Never list: ages, sex, conditions, symptoms, medicines, doses, costs, wait times, professions or provider types, \
or places (suburbs, cities, regions, states). Text already in square brackets is done; skip it."""

LABELS = ("NAME", "ADDRESS", "DOB", "ORG", "ID")

TOOL = {
    "toolSpec": {
        "name": "identifiers",
        "description": "Every personal identifier in the transcript, each copied verbatim with its type.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "spans": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"text": {"type": "string"}, "type": {"type": "string", "enum": list(LABELS)}},
                            "required": ["text", "type"],
                        },
                    }
                },
                "required": ["spans"],
            }
        },
    }
}

JSON_ASK = '\n\nReply with JSON only, no prose: {"spans": [{"text": "...", "type": "NAME|ADDRESS|DOB|ORG|ID"}]}'


CITIES = {"brisbane", "sydney", "melbourne", "perth", "adelaide", "hobart", "darwin", "canberra"}


@lru_cache(maxsize=1)
def places() -> frozenset[str]:
    """Every suburb, city, region and state: used to keep pattern frames off place names."""
    rows = json.loads((ROOT / "data" / "geo" / "au-postcodes.json").read_text())["rows"]
    return frozenset({str(r[0]).lower() for r in rows} | STATES | REGIONS | CITIES)


@lru_cache(maxsize=1)
def vocabulary() -> tuple[frozenset[str], frozenset[str]]:
    """Clinical words and phrases from disciplines/*.yaml. A multi-word cue stays a phrase: splitting
    "will listen" would make "Will" a word that is never redacted."""
    import yaml

    words: set[str] = set(PROFESSIONS)
    phrases: set[str] = set()

    def walk(node: object, key: str = "") -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, str(k))
        elif isinstance(node, list):
            for v in node:
                walk(v, key)
        elif isinstance(node, str) and key in {"cues", "synonyms"}:
            low = node.lower().strip()
            (words if re.fullmatch(r"[a-z]{3,}", low) else phrases).add(low)
        elif isinstance(node, str) and key in {"label", "id"}:
            words.update(w for w in re.findall(r"[a-z]+", node.lower()) if len(w) > 3)

    for path in (ROOT / "disciplines").glob("*.yaml"):
        walk(yaml.safe_load(path.read_text()))
    return frozenset(words), frozenset(phrases)


def clinical_words() -> frozenset[str]:
    return vocabulary()[0]


def not_a_name(candidate: str) -> bool:
    low = candidate.lower()
    return low in places() or all(w in STOP or w in clinical_words() for w in low.split())


def by_pattern(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for label, pattern in PATTERNS:
        text, n = pattern.subn(f"[{label}]", text)
        if n:
            counts[label] = counts.get(label, 0) + n
    for frame in NAME_FRAMES:
        def swap(m: re.Match[str]) -> str:
            name = m.group(1)
            # Keep the second word if it is not part of the name ("Liam is" never reaches here; "Jess Turner" does).
            if not_a_name(name.split()[0]):
                return m.group(0)
            counts["NAME"] = counts.get("NAME", 0) + 1
            return m.group(0)[: m.start(1) - m.start(0)] + "[NAME]"
        text = frame.sub(swap, text)
    return text, counts


def _parse_json(text: str) -> list[dict[str, str]]:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise RuntimeError("model returned no JSON")
    return list(json.loads(m.group(0)).get("spans", []))


def find_spans(text: str, model: str = MODEL) -> list[dict[str, str]]:
    """The model only points at spans; it never rewrites the transcript."""
    client = boto3.client("bedrock-runtime", region_name=REGION, config=Config(retries={"mode": "adaptive", "max_attempts": 8}))
    base = {"modelId": model, "system": [{"text": BRIEF}], "inferenceConfig": {"maxTokens": 4000}}
    raw: list[dict[str, str]] | None = None
    for choice in ({"tool": {"name": "identifiers"}}, {"any": {}}, {"auto": {}}):
        try:
            res = client.converse(**base, messages=[{"role": "user", "content": [{"text": text}]}], toolConfig={"tools": [TOOL], "toolChoice": choice})
        except client.exceptions.ValidationException as e:
            if "tool" in str(e).lower():
                continue  # this choice, or tool use at all, is not supported by the model
            raise
        blocks = res["output"]["message"]["content"]
        uses = [b["toolUse"]["input"] for b in blocks if "toolUse" in b]
        if uses:
            raw = list(uses[0].get("spans", []))
        else:
            raw = _parse_json("".join(b.get("text", "") for b in blocks))
        break
    if raw is None:  # no tool use on this model: ask for JSON in the reply
        res = client.converse(**base, messages=[{"role": "user", "content": [{"text": text + JSON_ASK}]}])
        raw = _parse_json("".join(b.get("text", "") for b in res["output"]["message"]["content"]))
    return [s for s in raw if isinstance(s, dict) and s.get("type") in LABELS and str(s.get("text", "")).strip()]


def is_date(text: str) -> bool:
    months = r"jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
    return bool(re.search(r"\d", text) and (re.search(r"[/.-]", text) or re.search(months, text, re.I) or re.search(r"\b(19|20)\d\d\b", text)))


def keep_span(span: dict[str, str]) -> bool:
    """False for spans the model flagged that are not identifiers (the guards)."""
    text, kind = span["text"].strip(), span["type"]
    low = text.lower()
    if not text or (text.startswith("[") and text.endswith("]")):
        return False
    if re.fullmatch(r"\d{1,3}", text):  # an age, a dose, a count
        return False
    if kind == "DOB" and not is_date(text):
        return False
    if kind == "ADDRESS" and not re.search(r"\d", text):  # a suburb, city or state, never a street address
        return False
    # Only the big places: many suburbs share a name with a university or school (Monash, Kelvin Grove).
    if kind in {"ORG", "ADDRESS"} and low in STATES | REGIONS | CITIES:
        return False
    if kind == "ID" and not re.search(r"\d", text):  # identifying numbers have digits; "Strattera" is a medicine
        return False
    if kind == "NAME" and re.search(r"\d", text):  # names have no digits ("Year 9 student")
        return False
    words = re.findall(r"[a-z]+", low)
    if kind != "ID" and (low in vocabulary()[1] or (words and all(w in clinical_words() or w in STOP for w in words))):
        return False
    return not (kind != "NAME" and low in STATES)


def trim(span: dict[str, str]) -> dict[str, str]:
    """An ORG keeps only its proper-noun part ("Macquarie speech pathology" → "Macquarie"); an ADDRESS
    only its street ("7/18 Beach Road, Glenelg SA 5045" → "7/18 Beach Road"), so suburb and state stay."""
    if span["type"] == "ADDRESS" and "," in span["text"]:
        parts = [p.strip() for p in span["text"].split(",")]
        street = next((p for p in parts if re.search(r"\d", p) and re.search(r"[A-Za-z]{3}", p)), parts[0])
        return {**span, "text": street}
    if span["type"] != "ORG":
        return span
    words = span["text"].split()
    # Trailing lowercase words and a trailing city or state are not the name: "… Hospital Melbourne".
    while len(words) > 1 and (words[-1][:1].islower() or words[-1].lower().strip(",.") in STATES | CITIES):
        words.pop()
    return {**span, "text": " ".join(words)}


def apply_spans(text: str, spans: list[dict[str, str]]) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    spans = [trim(s) for s in spans if keep_span(s)]
    # Longest first, so "Dr Sarah Nguyen" goes before "Sarah". Whole words only, so "Mia" leaves "Miami".
    for s in sorted(spans, key=lambda s: -len(s["text"])):
        needle = s["text"].strip()
        text, n = re.subn(rf"(?<![\w\[]){re.escape(needle)}(?![\w\]])", f"[{s['type']}]", text)
        if n:
            counts[s["type"]] = counts.get(s["type"], 0) + n
    return text, counts


def log(original: str, result: dict[str, object], ms: int) -> None:
    """Debug log (REDACT_LOG=path, JSONL): the redacted text, counts and a hash of the input; never the input itself."""
    path = os.environ.get("REDACT_LOG", "").strip()
    if not path:
        return
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    row = {"at": datetime.now(timezone.utc).isoformat(), "inputSha256": hashlib.sha256(original.encode()).hexdigest(), "length": len(original), "ms": ms, **result}
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def spans_from_chain(text: str, chain: str, passes: int) -> tuple[list[dict[str, str]], str]:
    refused = []
    for model in [m.strip() for m in chain.split(",") if m.strip()]:
        try:
            with ThreadPoolExecutor(max_workers=passes) as pool:
                return [s for spans in pool.map(lambda _: find_spans(text, model), range(passes)) for s in spans], model
        except Exception as e:
            # Not granted, form not submitted, or still throttled after retries: the next model takes it.
            if type(e).__name__ not in {"AccessDeniedException", "ResourceNotFoundException", "ThrottlingException"}:
                raise
            refused.append(model)
    raise RuntimeError(f"no model in the chain is available: {', '.join(refused)}")


def redact(text: str, model: str = MODEL, passes: int = PASSES) -> dict[str, object]:
    started = time.monotonic()
    original = text
    text, counts = by_pattern(text)
    found, model = spans_from_chain(text, model, passes)
    text, more = apply_spans(text, found)
    for k, v in more.items():
        counts[k] = counts.get(k, 0) + v
    result: dict[str, object] = {"text": text, "counts": counts, "model": model, "passes": passes}
    log(original, result, int((time.monotonic() - started) * 1000))
    return result


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        json.dump(redact(str(payload["text"])), sys.stdout)
    except Exception as e:  # the message only, never the transcript
        print(f"redaction failed: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
        sys.exit(1)
