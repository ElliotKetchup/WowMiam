"""Play a style's demo headless, collect console errors and periodic screenshots.

Usage:
    python design/prototype/check.py a [interval_ms]
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from playwright.async_api import ConsoleMessage, async_playwright

HERE: Path = Path(__file__).resolve().parent
PAGE: Path = HERE / "dist" / "wowmiam.html"
SHOTS: Path = HERE / "dist" / "_shots"
CHROMIUM: str = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


async def check(style: str, interval_ms: int = 1500, limit_s: int = 150) -> list[str]:
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob(f"{style}-*.png"):
        old.unlink()
    errors: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path=CHROMIUM)
        page = await browser.new_page(viewport={"width": 1100, "height": 1000}, device_scale_factor=1)

        def on_console(msg: ConsoleMessage) -> None:
            if msg.type in ("error", "warning"):
                errors.append(f"{msg.type}: {msg.text}")

        page.on("console", on_console)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        await page.goto(f"{PAGE.as_uri()}#{style}", wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        await page.click("#play")
        device = page.locator("#device")
        elapsed, n = 0, 0
        while elapsed < limit_s * 1000:
            await page.wait_for_timeout(interval_ms)
            elapsed += interval_ms
            n += 1
            await device.screenshot(path=str(SHOTS / f"{style}-{n:03d}.png"))
            caption = await page.inner_text("#caption")
            if caption.startswith("Fin de la démo") or "souci" in caption:
                errors.append(f"caption: {caption}")
                break
        await browser.close()
    return errors


def main() -> None:
    style = sys.argv[1]
    interval = int(sys.argv[2]) if len(sys.argv) > 2 else 1500
    for line in asyncio.run(check(style, interval)):
        print(line)


if __name__ == "__main__":
    main()
