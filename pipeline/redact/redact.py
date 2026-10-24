"""Redact personal details from a transcript before it leaves for the classifier (founder 2026-10-24).

Reads {"text": "..."} on stdin and writes {"text": "...", "counts": {...}} on stdout. Two passes:
patterns first (emails, phone numbers, Medicare and other long ID numbers, URLs), so those never
reach any model, then a model on Amazon Bedrock in Sydney (ap-southeast-2; default Amazon Nova Lite, in-region only.
Claude Haiku 4.5 via REDACT_MODEL=au.anthropic.claude-haiku-4-5-20251001-v1:0 once the account has
submitted the Anthropic use-case form) for what patterns
miss: people's names, street addresses, dates of birth, and named schools or workplaces. Clinical
content (ages, conditions, medicines, doses, symptoms, states and cities) is kept, because the
classifier scores on it.

Credentials come from the environment: AWS_BEARER_TOKEN_BEDROCK (a Bedrock API key) or any
standard AWS credential. REDACT_MODEL overrides the model; AWS_REGION defaults to Sydney.
Any failure exits non-zero, and the caller then refuses to send the transcript (fail closed).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import boto3

MODEL = os.environ.get("REDACT_MODEL", "").strip() or "amazon.nova-lite-v1:0"
REGION = os.environ.get("AWS_REGION", "").strip() or "ap-southeast-2"

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")),
    # Clinician identifiers: AHPRA registration (MED0001234567) and Medicare provider numbers (2345671A).
    ("ID", re.compile(r"\b[A-Z]{3}\d{10}\b")),
    ("ID", re.compile(r"\b\d{6}[0-9A-Z][A-HJ-NP-Y]\b")),
    ("URL", re.compile(r"\bhttps?://\S+|\bwww\.\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|au|io|health)\b(?:/\S*)?", re.I)),
    # Australian phones: +61 / 04xx / (0x) landlines, with spaces, dots or dashes.
    ("PHONE", re.compile(r"(?:\+?61[\s.-]?|\b0)[2-478](?:[\s.-]?\d){8}\b")),
    # Medicare (10-11 digits), IHI (16), and other long runs of digits read as an identifier.
    ("ID", re.compile(r"\b\d(?:[\s-]?\d){9,15}\b")),
]

BRIEF = """You find personal identifiers in a health transcript so code can remove them. Call the \
`identifiers` tool with every span, copied exactly as it appears (same spelling, case and spacing):
- NAME: a person's name (patient, family member, the clinician speaking or writing, any other clinician), with any title such as Dr
- ADDRESS: a street address or unit number (a house number with a street name), never a suburb, city or state on its own
- DOB: a full date of birth
- ORG: a named school, university (including abbreviations such as UQ), employer, workplace or clinic
- ID: any phone, email, Medicare, NDIS or other identifying number not already in square brackets
Never list clinical details or places used for matching: ages, sex, conditions, symptoms, medicines, \
doses, costs, wait times, suburbs, cities, regions or states (Brisbane, Gold Coast, Logan, QLD, WA...). If there are none, call the tool with an empty list."""

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


def by_pattern(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for label, pattern in PATTERNS:
        text, n = pattern.subn(f"[{label}]", text)
        if n:
            counts[label] = n
    return text, counts


def find_spans(text: str) -> list[dict[str, str]]:
    """The model only points at spans; it never rewrites the transcript, so it cannot drop or alter clinical text."""
    client = boto3.client("bedrock-runtime", region_name=REGION)
    res = client.converse(
        modelId=MODEL,
        system=[{"text": BRIEF}],
        messages=[{"role": "user", "content": [{"text": text}]}],
        toolConfig={"tools": [TOOL], "toolChoice": {"tool": {"name": "identifiers"}}},
        inferenceConfig={"maxTokens": 4000},
    )
    for block in res["output"]["message"]["content"]:
        if "toolUse" in block:
            return [s for s in block["toolUse"]["input"].get("spans", []) if s.get("type") in LABELS and str(s.get("text", "")).strip()]
    raise RuntimeError(f"no identifiers returned (stopReason {res.get('stopReason')})")


# Places stay: matching needs them. The model sometimes tags a city or state as an address anyway.
STATES = {"nsw", "new south wales", "vic", "victoria", "qld", "queensland", "wa", "western australia", "sa", "south australia", "tas", "tasmania", "act", "nt", "northern territory", "australia"}


def keeps_place(span: dict[str, str]) -> bool:
    text = span["text"].strip().lower()
    return text in STATES or (span["type"] == "ADDRESS" and not re.search(r"\d", text))


def apply_spans(text: str, spans: list[dict[str, str]]) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    spans = [s for s in spans if not keeps_place(s)]
    # Longest first, so "Dr Sarah Nguyen" goes before "Sarah"; spans already in brackets are skipped.
    for s in sorted(spans, key=lambda s: -len(s["text"])):
        needle = s["text"].strip()
        if needle.startswith("[") and needle.endswith("]"):
            continue
        text, n = re.subn(re.escape(needle), f"[{s['type']}]", text)
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


def redact(text: str) -> dict[str, object]:
    started = time.monotonic()
    original = text
    text, counts = by_pattern(text)
    text, more = apply_spans(text, find_spans(text))
    for k, v in more.items():
        counts[k] = counts.get(k, 0) + v
    result: dict[str, object] = {"text": text, "counts": counts, "model": MODEL}
    log(original, result, int((time.monotonic() - started) * 1000))
    return result


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        json.dump(redact(str(payload["text"])), sys.stdout)
    except Exception as e:  # the message only, never the transcript
        print(f"redaction failed: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
        sys.exit(1)
