"""Capture still screens from the built prototype by tapping through it.

Usage:
    python design/prototype/build.py && python design/prototype/capture.py && python design/prototype/build.py
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from pathlib import Path

from playwright.async_api import Page, async_playwright

HERE: Path = Path(__file__).resolve().parent
PAGE: Path = HERE / "dist" / "wowmiam.html"
OUT: Path = HERE.parent / "screens"
CHROMIUM: str = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

Step = Callable[[Page], Awaitable[None]]


async def tap(page: Page, selector: str, wait_ms: int = 900) -> None:
    """Tap the first visible match inside the phone, then let its animation settle."""
    await page.locator(f"#device {selector}").first.click()
    await page.wait_for_timeout(wait_ms)


async def fresh(page: Page) -> None:
    await page.goto(PAGE.as_uri(), wait_until="networkidle")
    await page.evaluate("document.fonts.ready")
    await page.wait_for_timeout(1200)


async def recipe(page: Page) -> None:
    await fresh(page)
    await tap(page, '.tile[data-id="pizza"]', 1500)
    await tap(page, '[data-act="serves"][data-d="1"]', 600)
    await tap(page, ".ings li:nth-child(1)", 600)


async def cook(page: Page) -> None:
    await tap(page, '[data-act="cook"]', 1000)
    for _ in range(3):
        await tap(page, '[data-act="nextStep"]', 900)
    await tap(page, '[data-act="timer"]', 2300)


async def folders(page: Page) -> None:
    await fresh(page)
    await tap(page, '[data-tab="folders"]', 1400)


async def create(page: Page) -> None:
    await fresh(page)
    await tap(page, '[data-act="openCreate"]', 1100)
    await tap(page, ".photo", 2800)
    await page.locator("#device [data-title]").fill("Salade de courgettes")
    for sel in ('[data-pick="type"][data-value="Entrée"]', '[data-pick="diet"][data-value="Végé"]',
                '[data-pick="diet"][data-value="Sans gluten"]', '[data-pick="tool"][data-value="Four"]'):
        await tap(page, sel, 350)
    for _ in range(2):
        await tap(page, '[data-act="addIngredient"]', 1400)
    await page.evaluate("document.querySelector('#device .layer:last-child .scroll').scrollTo(0, 0)")
    await page.wait_for_timeout(500)


SCREENS: list[tuple[str, Step]] = [
    ("1-accueil", fresh),
    ("2-filtres", lambda p: tap(p, '[data-act="openFilter"]', 1000)),
    ("3-recette", recipe),
    ("4-cuisine", cook),
    ("5-dossiers", folders),
    ("6-dossier", lambda p: tap(p, '[data-act="openFolder"][data-id="soirs"]', 1500)),
    ("7-creation", create),
    ("8-enregistre", lambda p: tap(p, '[data-act="save"]', 3200)),
]


async def capture() -> list[Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=CHROMIUM)
        page = await browser.new_page(viewport={"width": 1100, "height": 1050}, device_scale_factor=2)
        for name, step in SCREENS:
            await step(page)
            out = OUT / f"{name}.png"
            await page.locator("#device .screen").screenshot(path=str(out))
            saved.append(out)
        await browser.close()
    return saved


def main() -> None:
    for path in asyncio.run(capture()):
        print(f"captured {path.name}")


if __name__ == "__main__":
    main()
