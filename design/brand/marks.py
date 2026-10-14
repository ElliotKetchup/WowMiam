"""Hand-drawn W and M letterforms (fat, soft, ball/teardrop terminals) as reusable SVG fragments."""
from __future__ import annotations


def letter_w(color: str) -> str:
    """One continuous fat stroke that ends in a teardrop, in a 512 box, top half."""
    return f"""
  <g transform="translate(6 -22)" fill="none" stroke="{color}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M104 116 C 110 176 126 236 162 240 C 196 244 198 176 216 168 C 234 162 236 232 272 238 C 306 244 316 196 338 176" stroke-width="64"/>
  </g>
  <ellipse cx="388" cy="154" rx="72" ry="60" transform="rotate(-24 382 176)" fill="{color}"/>"""


def letter_m(color: str) -> str:
    """One fat stroke, round tops and joins, flat feet, leaning right; in a 512 box, bottom half."""
    return f"""
  <g transform="translate(0 452) skewX(-13) translate(0 -452)" fill="none" stroke="{color}" stroke-linejoin="round" stroke-linecap="butt">
    <path d="M146 452 L146 318 L244 430 L342 318 L342 452" stroke-width="68"/>
    <circle cx="146" cy="318" r="34" fill="{color}" stroke="none"/>
    <circle cx="342" cy="318" r="34" fill="{color}" stroke="none"/>
  </g>"""


def mark(bg: str, w: str, m: str, radius: int = 112) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="{radius}" fill="{bg}"/>{letter_w(w)}{letter_m(m)}
</svg>"""
