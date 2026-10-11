"""Cut dishes out of real photos into transparent images for the mockups.

IS-Net (via rembg) gives a saliency mask; plates and bowls are then re-fitted
as ellipses so the food inside stays opaque and neighbouring objects
(forks, a second bowl, a phone) drop out. Free-form dishes keep the model's
silhouette with its interior holes filled.

Usage:
    U2NET_HOME=/path/to/models python design/cutout.py /path/to/photos
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image
from rembg import new_session, remove

ASSETS_DIR: Path = Path(__file__).resolve().parent / "assets" / "dishes"
MAX_SIDE: int = 900

Mask = NDArray[np.uint8]
Ellipse = tuple[tuple[float, float], tuple[float, float], float]


@dataclass(frozen=True)
class Circle:
    """Rough position of a round vessel in source pixels."""

    cx: float
    cy: float
    r: float


@dataclass(frozen=True)
class DishSpec:
    name: str
    source: str
    mode: Literal["ellipse", "free"]
    guess: Circle | None = None
    occluders: tuple[Circle, ...] = field(default_factory=tuple)


DISHES: tuple[DishSpec, ...] = (
    DishSpec("pizza-wrap", "fa34e6fc-image.jpg", "ellipse", Circle(933, 1115, 530)),
    DishSpec(
        "salade-courgettes", "4fb18ba3-image.jpg", "ellipse", Circle(616, 828, 476),
    ),
    DishSpec(
        "salade-verte",
        "4fb18ba3-image.jpg",
        "ellipse",
        Circle(1192, 1588, 542),
        occluders=(Circle(616, 828, 476),),
    ),
    DishSpec("aubergines-pizza", "a29c58ca-image.jpg", "free"),
)


@cache
def saliency_mask(path: Path) -> Mask:
    """Return the IS-Net foreground mask (0-255) for a photo, computed once."""
    session = new_session("isnet-general-use")
    mask = remove(Image.open(path).convert("RGB"), session=session, only_mask=True)
    return np.asarray(mask, dtype=np.uint8)


def fit_rim(mask: Mask, guess: Circle, others: tuple[Circle, ...]) -> Ellipse:
    """Fit an ellipse to the mask's edge points lying near the guessed rim."""
    edges = cv2.Canny((mask > 128).astype(np.uint8) * 255, 50, 150)
    ys, xs = np.nonzero(edges)
    dist = np.hypot(xs - guess.cx, ys - guess.cy)
    keep = np.abs(dist - guess.r) < guess.r * 0.08
    for other in others:
        keep &= np.hypot(xs - other.cx, ys - other.cy) > other.r * 1.02
    points = np.column_stack([xs[keep], ys[keep]]).astype(np.float32)
    return cv2.fitEllipse(points)


def ellipse_alpha(shape: tuple[int, int], ellipse: Ellipse) -> Mask:
    """Rasterise an anti-aliased filled ellipse."""
    alpha = np.zeros(shape, dtype=np.uint8)
    cv2.ellipse(alpha, ellipse, 255, thickness=-1, lineType=cv2.LINE_AA)
    return alpha


def restore_occluded(rgb: NDArray[np.uint8], alpha: Mask, occluders: tuple[Circle, ...]) -> NDArray[np.uint8]:
    """Repaint the part of the vessel hidden under another one, from its surroundings."""
    hidden = np.zeros(alpha.shape, dtype=np.uint8)
    for occ in occluders:
        cv2.circle(hidden, (round(occ.cx), round(occ.cy)), round(occ.r * 1.03), 255, thickness=-1)
    hidden &= (alpha > 0).astype(np.uint8) * 255
    return cv2.inpaint(rgb, hidden, inpaintRadius=25, flags=cv2.INPAINT_TELEA)


def free_alpha(mask: Mask) -> Mask:
    """Keep the largest foreground blob and fill its interior holes."""
    binary = (mask > 128).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    blob = (labels == largest).astype(np.uint8) * 255
    contours, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(blob)
    cv2.drawContours(filled, contours, -1, 255, thickness=-1)
    # keep the model's soft edge on the outline, solid inside
    return np.where(filled > 0, np.maximum(mask, cv2.erode(filled, np.ones((9, 9), np.uint8))), 0).astype(np.uint8)


def crop_rgba(rgb: NDArray[np.uint8], alpha: Mask, pad: int = 12) -> Image.Image:
    """Combine colour and alpha, trim to the visible bounds, cap the long side."""
    ys, xs = np.nonzero(alpha > 8)
    top, bottom = max(ys.min() - pad, 0), min(ys.max() + pad, alpha.shape[0])
    left, right = max(xs.min() - pad, 0), min(xs.max() + pad, alpha.shape[1])
    rgba = np.dstack([rgb, alpha])[top:bottom, left:right]
    image = Image.fromarray(rgba, mode="RGBA")
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    return image


def cut(spec: DishSpec, photos_dir: Path) -> Path:
    source = photos_dir / spec.source
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.uint8)
    mask = saliency_mask(source)
    if spec.mode == "ellipse":
        assert spec.guess is not None, f"{spec.name} needs a rim guess"
        rim = fit_rim(mask, spec.guess, spec.occluders)
        alpha = ellipse_alpha(mask.shape, rim)
        if spec.occluders:
            rgb = restore_occluded(rgb, alpha, spec.occluders)
    else:
        alpha = free_alpha(mask)
    out = ASSETS_DIR / f"{spec.name}.webp"
    crop_rgba(rgb, alpha).save(out, quality=90, method=6)
    return out


def main() -> None:
    photos_dir = Path(sys.argv[1])
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    for spec in DISHES:
        print(f"cut {cut(spec, photos_dir).relative_to(ASSETS_DIR.parent.parent)}")


if __name__ == "__main__":
    main()
