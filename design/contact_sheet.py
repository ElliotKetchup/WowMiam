"""Lay rendered screens side by side for review.

Usage:
    python design/contact_sheet.py a- out.png   # every export whose stem contains "a-"
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

EXPORTS_DIR: Path = Path(__file__).resolve().parent / "exports"


def build_sheet(paths: list[Path], height: int = 1100, gap: int = 24) -> Image.Image:
    """Scale every screen to `height` px tall and place them in one row."""
    screens = [Image.open(p).convert("RGB") for p in paths]
    scaled = [s.resize((round(s.width * height / s.height), height)) for s in screens]
    width = sum(s.width for s in scaled) + gap * (len(scaled) + 1)
    sheet = Image.new("RGB", (width, height + 2 * gap), (120, 120, 120))
    x = gap
    for screen in scaled:
        sheet.paste(screen, (x, gap))
        x += screen.width + gap
    return sheet


def main() -> None:
    token, out = sys.argv[1], Path(sys.argv[2])
    paths = sorted(p for p in EXPORTS_DIR.glob("*.png") if token in p.stem)
    build_sheet(paths).save(out)
    print(f"{len(paths)} screens -> {out}")


if __name__ == "__main__":
    main()
