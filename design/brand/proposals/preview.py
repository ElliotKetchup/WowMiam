"""Quick PNG contact sheet of the five proposals."""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from marks5 import proposals

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def main(out: Path) -> None:
    cells = "".join(f"<figure>{p.svg}<figcaption>{i}. {p.name}</figcaption></figure>" for i, p in enumerate(proposals(), 1))
    html = ("<style>body{margin:0;background:#ccc;display:grid;grid-template-columns:repeat(5,220px);gap:14px;padding:14px;"
            "font:600 13px sans-serif}figure{margin:0}svg{width:220px;height:220px;display:block}</style>" + cells)
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME)
        page = b.new_page(viewport={"width": 1200, "height": 280})
        page.set_content(html)
        page.screenshot(path=str(out))
        b.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
