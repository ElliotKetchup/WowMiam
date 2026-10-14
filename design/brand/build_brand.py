"""Render the Wow Miam ! W/M mark into the app's icon, adaptive icon layers, splash and favicon."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from marks import letter_m, letter_w

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
OUT = Path(__file__).resolve().parents[2] / "app" / "assets" / "brand"

INK, PAPER, AMBER = "#2A1530", "#F4EFF3", "#E0962A"


@dataclass(frozen=True)
class Asset:
    name: str
    size: int
    svg: str


def letters(w: str, m: str, scale: float = 1.0) -> str:
    """Both letters, scaled about the centre of the 512 box."""
    t = 256 * (1 - scale)
    return f'<g transform="translate({t} {t}) scale({scale})">{letter_w(w)}{letter_m(m)}</g>'


def svg(body: str, bg: str | None = None, radius: int = 0) -> str:
    rect = f'<rect width="512" height="512" rx="{radius}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{rect}{body}</svg>'


ASSETS: list[Asset] = [
    Asset("icon.png", 1024, svg(letters(PAPER, AMBER, 0.92), INK, 0)),
    # Android adaptive layers: the launcher masks a 108dp canvas down to ~66 %, so the letters sit in the middle.
    Asset("adaptive-foreground.png", 1024, svg(letters(PAPER, AMBER, 0.62))),
    Asset("adaptive-monochrome.png", 1024, svg(letters("#FFFFFF", "#FFFFFF", 0.62))),
    Asset("splash.png", 1024, svg(letters(INK, AMBER, 0.9))),
    Asset("favicon.png", 96, svg(letters(PAPER, AMBER, 0.95), INK, 112)),
]


def shoot(page: Page, asset: Asset) -> Path:
    page.set_viewport_size({"width": asset.size, "height": asset.size})
    page.set_content(f'<style>html,body{{margin:0;background:transparent}}svg{{width:{asset.size}px;height:{asset.size}px;display:block}}</style>{asset.svg}')
    out = OUT / asset.name
    page.screenshot(path=str(out), omit_background=True)
    return out


def main() -> None:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME)
        page = browser.new_page()
        for asset in ASSETS:
            print(shoot(page, asset).relative_to(OUT.parents[2]))
        browser.close()


if __name__ == "__main__":
    main()
