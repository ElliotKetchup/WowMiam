"""Assemble the prototype page into one self-contained HTML file plus its images.

Usage:
    python design/prototype/build.py            # -> design/prototype/dist/
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from urllib.parse import quote

from PIL import Image

HERE: Path = Path(__file__).resolve().parent
DESIGN: Path = HERE.parent
DIST: Path = HERE / "dist"
OUTPUT_NAME: str = "wezfood-maquettes.html"

CSS_FILES: tuple[str, ...] = ("page.css", "device.css", "a.css", "b.css", "c.css")
JS_FILES: tuple[str, ...] = ("engine.js", "a.js", "b.js", "c.js", "page.js")
ICON_PATTERN = re.compile(r'class=\\?"ms[^"\\]*\\?">([a-z0-9_]+)<')
ICON_FONT = (
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:"
    "opsz,wght,FILL,GRAD@20..48,300..700,0..1,0&icon_names={names}&display=block"
)


def read_existing(names: tuple[str, ...]) -> list[tuple[str, str]]:
    """Return (name, text) for each source file that exists yet."""
    return [(n, (HERE / n).read_text(encoding="utf-8")) for n in names if (HERE / n).exists()]


def icon_font_url(sources: list[str]) -> str:
    """Request only the Material Symbols glyphs the prototypes use."""
    names = sorted({m for text in sources for m in ICON_PATTERN.findall(text)})
    return ICON_FONT.format(names=quote(",".join(names), safe=","))


def copy_images() -> int:
    """Copy dish cut-outs and rendered mockups next to the page."""
    img = DIST / "img"
    (img / "dishes").mkdir(parents=True, exist_ok=True)
    count = 0
    for src in (DESIGN / "assets" / "dishes").glob("*.webp"):
        shutil.copy2(src, img / "dishes" / src.name)
        count += 1
    for src in (DESIGN / "exports").glob("*.png"):
        Image.open(src).convert("RGB").save(img / f"{src.stem}.webp", quality=88, method=6)
        count += 1
    return count


def build() -> Path:
    shell = (HERE / "shell.html").read_text(encoding="utf-8")
    css = read_existing(CSS_FILES)
    js = read_existing(JS_FILES)
    page = (
        shell.replace("/*__CSS__*/", "\n".join(text for _, text in css))
        .replace("/*__JS__*/", "\n".join(text for _, text in js))
        .replace("__ICON_FONT_URL__", icon_font_url([shell, *(t for _, t in js)]))
    )
    DIST.mkdir(exist_ok=True)
    out = DIST / OUTPUT_NAME
    out.write_text(page, encoding="utf-8")
    images = copy_images()
    print(f"{out.relative_to(DESIGN)}: {len(page) // 1024} KB, {len(css)} css, {len(js)} js, {images} images")
    return out


if __name__ == "__main__":
    build()
