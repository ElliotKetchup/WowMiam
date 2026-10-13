"""Inline downsized sticker images into the folder-pocket experiment page."""
from __future__ import annotations

import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
STICKERS = HERE.parents[2] / "app" / "assets" / "stickers"


def data_uri(path: Path, size: int = 280) -> str:
    img = Image.open(path)
    img.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=82, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def build(out: Path) -> Path:
    images = {p.stem: data_uri(p) for p in sorted(STICKERS.glob("*.webp"))}
    html = (HERE / "template.html").read_text().replace("__STICKERS__", json.dumps(images))
    out.write_text(html)
    return out


if __name__ == "__main__":
    print(build(Path(sys.argv[1])))
