"""Five W/M logo directions, each as a 512×512 SVG string."""
from __future__ import annotations

from dataclasses import dataclass

INK, PAPER, PINK, AMBER, TEAL, PLUM, OLIVE, CORAL = (
    "#2A1530", "#F4EFF3", "#D63B88", "#E0962A", "#007D72", "#8B4279", "#8FA14B", "#E55B3C",
)


@dataclass(frozen=True)
class Proposal:
    key: str
    name: str
    idea: str
    svg: str


def frame(body: str, bg: str, defs: str = "") -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>{defs}</defs>'
            f'<rect width="512" height="512" rx="112" fill="{bg}"/>{body}</svg>')


def fluid_w(color: str) -> str:
    return (f'<path d="M110 94 C 116 154 132 214 168 218 C 202 222 204 154 222 146 C 240 140 242 210 278 216 '
            f'C 312 222 322 174 344 154" fill="none" stroke="{color}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<ellipse cx="388" cy="154" rx="72" ry="60" transform="rotate(-24 388 154)" fill="{color}"/>')


def leaning_m(color: str) -> str:
    return (f'<g transform="translate(0 452) skewX(-13) translate(0 -452)">'
            f'<path d="M146 452 L146 318 L244 430 L342 318 L342 452" fill="none" stroke="{color}" stroke-width="68" stroke-linejoin="round"/>'
            f'<circle cx="146" cy="318" r="34" fill="{color}"/><circle cx="342" cy="318" r="34" fill="{color}"/></g>')


def goutte() -> Proposal:
    return Proposal("goutte", "Goutte", "Le W coule et finit en goutte, le M penché le rattrape. Version actuelle, resserrée.",
                    frame(fluid_w(PAPER) + leaning_m(AMBER), INK))


def vague() -> Proposal:
    """W and M share a stroke: one continuous line, like a single pen gesture."""
    d = "M92 228 L132 360 L178 250 L224 360 L276 152 L324 276 L372 152 L420 360"
    body = f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="66" stroke-linecap="round" stroke-linejoin="round"/>'
    return Proposal("vague", "Vague", "W et M écrits d’un seul trait : le dernier jambage du W devient le premier du M.",
                    frame(body, AMBER))


def miroir_letters(w: str = PINK, m: str = AMBER) -> str:
    """The M is the fluid W turned upside down (the chosen Wow Miam ! mark)."""
    place = "translate(-2 26) scale(.92) translate(22 0)"
    return (f'<g transform="{place}">{fluid_w(w)}</g>'
            f'<g transform="rotate(180 256 256) {place}">{fluid_w(m)}</g>')


def miroir() -> Proposal:
    return Proposal("miroir", "Miroir", "Le M, c’est le W retourné : un seul dessin qui se répond, comme deux cuillères.",
                    frame(miroir_letters(), INK))


def bouchee() -> Proposal:
    """A plate with a bite out of it, letters knocked out."""
    bite = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="black"/>' for x, y, r in ((430, 118, 62), (468, 186, 50), (372, 78, 48)))
    defs = (f'<mask id="bite"><rect width="512" height="512" fill="white"/>{bite}</mask>')
    letters = (f'<g transform="translate(256 262) scale(.7) translate(-256 -262)">{fluid_w(INK)}{leaning_m(INK)}</g>')
    body = f'<g mask="url(#bite)"><circle cx="256" cy="262" r="196" fill="{AMBER}"/>{letters}</g>'
    return Proposal("bouchee", "Bouchée", "Une assiette ronde avec une bouchée en moins, le WM gravé dedans.",
                    frame(body, TEAL, defs))


def sticker() -> Proposal:
    """The WM on a holographic die-cut sticker, its corner lifting off the tile."""
    defs = ('<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="#FFB3E1"/><stop offset=".25" stop-color="#FFF1A8"/><stop offset=".5" stop-color="#B5F5D8"/>'
            '<stop offset=".75" stop-color="#A8DCFF"/><stop offset="1" stop-color="#D7B8FF"/></linearGradient>'
            '<clipPath id="peel"><path d="M0 0 H512 V330 L421 330 L335 421 L335 512 H0 Z"/></clipPath>')
    letters = f'<g transform="translate(256 256) scale(.56) translate(-256 -262)">{fluid_w(PAPER)}{leaning_m(PAPER)}</g>'
    sheet = (f'<g clip-path="url(#peel)">'
             f'<rect x="91" y="91" width="330" height="330" rx="64" fill="url(#holo)"/>'
             f'<rect x="111" y="111" width="290" height="290" rx="48" fill="{PINK}"/>{letters}</g>')
    flap = (f'<path d="M421 330 L335 421 L330 335 Z" fill="#EDE7EE" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
            f'<path d="M421 330 L335 421" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>')
    shadow = '<path d="M421 330 L335 421 L346 438 L438 344 Z" fill="rgba(0,0,0,.18)"/>'
    body = f'<g transform="rotate(-8 256 256)">{shadow}{sheet}{flap}</g>'
    return Proposal("sticker", "Sticker holo", "Le WM sur un sticker holographique dont un coin se décolle.",
                    frame(body, TEAL, defs))


def proposals() -> list[Proposal]:
    return [goutte(), vague(), miroir(), bouchee(), sticker()]
