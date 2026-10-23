# Before/after contact sheet for the Apple pass: pairs qa/apple/before/<name>.png with after/<name>.png.
import sys
from pathlib import Path
from PIL import Image, ImageDraw
names = sys.argv[2:]
out = sys.argv[1]
W, H = 262, 440  # each phone shot scaled from 786x1318-ish
cols = 4  # two pairs per row
rows = (len(names) + 1) // 2
sheet = Image.new("RGB", (cols * (W + 12) + 12, rows * (H + 40) + 12), "#1b1b1b")
d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    r, c = divmod(i, 2)
    for k, side in enumerate(["before", "after"]):
        p = Path("qa/apple") / side / f"{n}.png"
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        im = im.resize((W, int(im.height * W / im.width)))
        im = im.crop((0, 0, W, H))
        x = 12 + (c * 2 + k) * (W + 12)
        y = 12 + r * (H + 40)
        sheet.paste(im, (x, y + 24))
        d.text((x, y + 4), f"{n} · {side}", fill="#ffffff")
sheet.save(out)
print(out, sheet.size)
