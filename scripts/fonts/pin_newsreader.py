"""Newsreader with its optical-size axis pinned, weight kept variable.

The Fontsource latin file carries both axes (opsz 6..72, wght 200..800) and weighs 132 KB; on a 1.6 Mbps
mobile link it shares the first seconds with Inter, whose arrival is the LCP on every text page. Newsreader
is only ever set at 20 px (text-quote), 22 px (title2), 40 px (text-hero) and the monograms, so one optical
size near those covers every use and the file drops to about 58 KB. Run from the repo root:

    python scripts/fonts/pin_newsreader.py

Writes app/fonts/newsreader-latin-opsz24-wght.woff2 (committed; the build does not run this).
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2"
OUT = ROOT / "app/fonts/newsreader-latin-opsz24-wght.woff2"
OPSZ = float(sys.argv[1]) if len(sys.argv) > 1 else 24.0


def main() -> None:
    font = TTFont(str(SRC))
    axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes}
    print("axes before:", axes)
    pinned = instancer.instantiateVariableFont(font, {"opsz": OPSZ}, inplace=False, optimize=True, updateFontNames=False)
    pinned.flavor = "woff2"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    pinned.save(buf)
    OUT.write_bytes(buf.getvalue())
    after = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in pinned["fvar"].axes}
    print("axes after:", after)
    print(f"{SRC.stat().st_size:,} -> {OUT.stat().st_size:,} bytes at opsz {OPSZ:g}: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
