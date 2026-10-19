# Checks every quote and healthspan.evidence in a research-*.json file appears verbatim on the cited page.
# Usage: python -I scripts/verify_quotes.py data/enriched/personal/research-healthspan.json
import json, re, sys, html, urllib.request
p = sys.argv[1]
d = json.load(open(p, encoding="utf8"))
def norm(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-").replace("\xa0", " ")
    s = re.sub(r"[\"'‘’“”�`]", "", s)  # quote marks vary in spacing and form across pages
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    return re.sub(r"\s+", " ", s).strip().lower()
pages = {}
for doc in d["doctors"]:
    urls = [doc["source"]["url"]] + ([doc["source"]["secondary_url"]] if doc["source"].get("secondary_url") else [])
    text = ""
    for u in urls:
        if u not in pages:
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Wattle verification)"})
                pages[u] = norm(urllib.request.urlopen(req, timeout=20).read().decode("utf8", "ignore"))
            except Exception as e:
                pages[u] = ""
        text += " " + pages[u]
    items = [("evidence", (doc.get("healthspan") or {}).get("evidence"))] + [("quote", q["text"]) for q in doc["personal"].get("quotes") or []]
    for kind, t in items:
        if not t: continue
        ok = norm(t).strip('"') in text if text.strip() else None
        print(f"{'OK ' if ok else ('NOFETCH' if ok is None else 'MISS')}\t{doc['name']}\t{kind}\t{t[:90]}")
