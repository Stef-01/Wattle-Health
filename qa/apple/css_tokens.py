# Static extraction of design tokens from shipped CSS (read-only; never executes the target).
import re, sys, json, collections, pathlib
files = [pathlib.Path(p) for p in sys.argv[1:]]
css = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in files)
out = {}
# custom property definitions
defs = re.findall(r'(--[\w-]+)\s*:\s*([^;}{]+)', css)
c = collections.defaultdict(collections.Counter)
for k, v in defs: c[k][v.strip()] += 1
out["custom_props"] = len(c)
def top(prop, n=25):
    vals = re.findall(rf'(?<![\w-]){prop}\s*:\s*([^;}}]+)', css)
    return collections.Counter(v.strip() for v in vals).most_common(n)
for p in ["font-size", "font-weight", "letter-spacing", "line-height", "border-radius", "padding", "margin", "transition", "transition-timing-function", "box-shadow", "backdrop-filter", "-webkit-backdrop-filter", "border-bottom", "border-top", "border"]:
    out[p] = top(p)
colors = re.findall(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|hsla?\([^)]*\)', css)
out["colors_distinct"] = len(set(x.lower() for x in colors))
out["colors_top"] = collections.Counter(x.lower() for x in colors).most_common(30)
out["media"] = collections.Counter(re.findall(r'@media([^{]+)\{', css)).most_common(15)
out["props_sample"] = {k: dict(v.most_common(3)) for k, v in list(c.items())}
print(json.dumps(out, indent=1))
