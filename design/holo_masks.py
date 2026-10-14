"""Build the holographic-foil masks for the app's stickers.

A mask is an alpha-only PNG in the sticker's own canvas: the white die-cut border is fully foiled,
the dish itself only faintly, so the food stays readable under the shimmer.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DISHES = ROOT / "design" / "assets" / "dishes"
DESIGN_STICKERS = ROOT / "design" / "assets" / "stickers"
APP_STICKERS = ROOT / "app" / "assets" / "stickers"
OUT = APP_STICKERS / "holo"

FOOD_ALPHA = 0.2
MASK_WIDTH = 320


@dataclass(frozen=True)
class Box:
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0


def die_cut_box(img: Image.Image) -> Box:
    alpha = np.asarray(img.getchannel("A"))
    box = Image.fromarray(((alpha > 200) * 255).astype(np.uint8)).getbbox()
    assert box is not None
    return Box(*box)


def pad_for(dish: Image.Image) -> int:
    """Same padding cutout.sticker() used around the dish."""
    return max(6, round(max(dish.size) * 0.03)) + 6


def holo_mask(key: str) -> Image.Image:
    app = Image.open(APP_STICKERS / f"{key}.webp").convert("RGBA")
    design = Image.open(DESIGN_STICKERS / f"{key}.webp").convert("RGBA")
    dish = Image.open(DISHES / f"{key}.webp").convert("RGBA")

    # Map design-sticker coordinates onto the app sticker (it was rescaled and padded for its shadow).
    a, d = die_cut_box(app), die_cut_box(design)
    scale = a.width / d.width
    ox, oy = a.x0 - d.x0 * scale, a.y0 - d.y0 * scale

    food = Image.new("L", app.size, 0)
    dish_alpha = dish.getchannel("A").resize((round(dish.width * scale), round(dish.height * scale)), Image.LANCZOS)
    pad = pad_for(dish)
    food.paste(dish_alpha, (round(ox + pad * scale), round(oy + pad * scale)))

    cut = np.asarray(app.getchannel("A")).astype(np.float32) / 255
    cut = np.where(cut > 0.78, cut, 0)  # the die-cut sticker, not its soft shadow
    food_f = np.asarray(food.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
    alpha = cut * (1 - food_f * (1 - FOOD_ALPHA))
    mask = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    height = round(app.height * MASK_WIDTH / app.width)
    out = Image.new("RGBA", (MASK_WIDTH, height), (0, 0, 0, 0))
    out.putalpha(mask.resize((MASK_WIDTH, height), Image.LANCZOS))
    return out


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for path in sorted(APP_STICKERS.glob("*.webp")):
        dest = OUT / f"{path.stem}.png"
        holo_mask(path.stem).save(dest, optimize=True)
        print(dest.relative_to(ROOT), dest.stat().st_size)


if __name__ == "__main__":
    main()
