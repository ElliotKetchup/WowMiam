"""Render every mockup in design/mockups/*.html to a phone-resolution PNG.

Usage:
    python design/render.py            # all screens
    python design/render.py a-home     # only the screens whose stem matches
"""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

from playwright.async_api import Browser, async_playwright

DESIGN_DIR: Path = Path(__file__).resolve().parent
MOCKUPS_DIR: Path = DESIGN_DIR / "mockups"
EXPORTS_DIR: Path = DESIGN_DIR / "exports"
CHROMIUM_PATH: str = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


@dataclass(frozen=True)
class Viewport:
    """An Android phone viewport in dp, rendered at `scale` px per dp."""

    width: int = 412
    height: int = 915
    scale: float = 2.0


async def render_one(browser: Browser, html: Path, viewport: Viewport) -> Path:
    """Screenshot a single mockup once its web fonts and images have loaded."""
    page = await browser.new_page(
        viewport={"width": viewport.width, "height": viewport.height},
        device_scale_factor=viewport.scale,
    )
    await page.goto(html.as_uri(), wait_until="networkidle")
    await page.evaluate("document.fonts.ready")
    out = EXPORTS_DIR / f"{html.stem}.png"
    await page.screenshot(path=str(out), full_page=False)
    await page.close()
    return out


def select_mockups(filters: list[str]) -> list[Path]:
    """Return mockup files, optionally narrowed to stems containing a filter."""
    files = sorted(MOCKUPS_DIR.glob("*.html"))
    if not filters:
        return files
    return [f for f in files if any(token in f.stem for token in filters)]


async def render_all(filters: list[str], viewport: Viewport = Viewport()) -> list[Path]:
    """Render the selected mockups sequentially in one headless Chromium."""
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        executable = CHROMIUM_PATH if Path(CHROMIUM_PATH).exists() else None
        browser = await pw.chromium.launch(executable_path=executable)
        outputs = [await render_one(browser, f, viewport) for f in select_mockups(filters)]
        await browser.close()
    return outputs


def main() -> None:
    for path in asyncio.run(render_all(sys.argv[1:])):
        print(f"rendered {path.relative_to(DESIGN_DIR)}")


if __name__ == "__main__":
    main()
