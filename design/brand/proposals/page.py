"""Build the 'pick a logo' page from the five proposals."""
from __future__ import annotations

import sys
from pathlib import Path

from marks5 import Proposal, proposals

HEAD = """<title>Logos Wow Miam</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Onest:wght@400;600&display=swap">
<style>
/* Layout: one column of numbered cards (the number is what you answer with); each shows the mark big, small and in the app header. */
:root { --bg:#EDE6EC; --fg:#2A1530; --muted:#6A5C6E; --card:#FFFFFF; --line:#2A1530; --paper:#F4EFF3; --pink:#D63B88;
  --display:"Bricolage Grotesque","Arial Black",system-ui,sans-serif; --body:"Onest",system-ui,-apple-system,"Segoe UI",sans-serif }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#1C1020; --fg:#F4EFF3; --muted:#B9AABD; --card:#2A1B2E; --line:#F4EFF3; color-scheme:dark } }
:root[data-theme="dark"] { --bg:#1C1020; --fg:#F4EFF3; --muted:#B9AABD; --card:#2A1B2E; --line:#F4EFF3; color-scheme:dark }
* { box-sizing:border-box }
body { background:var(--bg); color:var(--fg); font-family:var(--body); padding:20px 16px 40px; margin:0 }
.wrap { max-width:720px; margin:0 auto; display:grid; gap:18px }
h1 { font-family:var(--display); font-size:30px; line-height:1.05; letter-spacing:-.6px; margin:0; text-wrap:balance }
.lede { margin:6px 0 0; color:var(--muted); line-height:1.45; max-width:60ch }
.card { background:var(--card); border:2px solid var(--line); border-radius:22px; box-shadow:4px 4px 0 var(--line); padding:16px;
  display:grid; grid-template-columns:168px minmax(0,1fr); gap:16px; align-items:center }
.big svg { width:168px; height:168px; display:block }
.num { font-family:var(--display); font-size:15px; color:var(--pink) }
.card h2 { font-family:var(--display); font-size:24px; margin:2px 0 4px; letter-spacing:-.4px }
.card p { margin:0; color:var(--muted); line-height:1.4; font-size:14px }
.sizes { display:flex; align-items:flex-end; gap:12px; margin-top:12px; flex-wrap:wrap }
.sizes svg { display:block }
.s56 svg { width:56px; height:56px } .s32 svg { width:32px; height:32px }
.lockup { display:flex; align-items:center; gap:10px; background:var(--paper); color:#2A1530; border-radius:12px; padding:8px 12px; border:2px solid #2A1530 }
.lockup svg { width:34px; height:34px; border-radius:9px }
.lockup b { font-family:var(--display); font-size:21px; letter-spacing:-.4px; font-weight:800 } .lockup b i { font-style:normal; color:#D63B88 }
@media (max-width:520px) { .card { grid-template-columns:1fr } .big svg { width:100%; height:auto; max-width:240px } }
</style>"""


def card(i: int, p: Proposal) -> str:
    return f"""<article class="card" id="{p.key}">
  <div class="big">{p.svg}</div>
  <div>
    <div class="num">Logo {i}</div>
    <h2>{p.name}</h2>
    <p>{p.idea}</p>
    <div class="sizes">
      <div class="s56" title="Icône sur l’écran d’accueil">{p.svg}</div>
      <div class="s32" title="Petite taille">{p.svg}</div>
      <div class="lockup">{p.svg}<b>Wow Miam<i> !</i></b></div>
    </div>
  </div>
</article>"""


def build(out: Path) -> Path:
    # Each SVG appears several times on the page, so make its ids unique per copy.
    cards = []
    for i, p in enumerate(proposals(), 1):
        html = card(i, p)
        for n, ident in enumerate(("holo", "peel", "bite")):
            html = _uniquify(html, ident, f"{p.key}")
        cards.append(html)
    body = ("<div class=\"wrap\"><header><h1>Cinq logos pour Wow Miam !</h1>"
            "<p class=\"lede\">Toujours le W et le M, dessinés gras et arrondis comme tes références. "
            "Chaque logo est montré en grand, en icône et à côté du nom. Réponds avec le numéro qui te plaît, "
            "ou avec un mélange (« la forme du 3, les couleurs du 1 »).</p></header>"
            + "".join(cards) + "</div>")
    out.write_text(HEAD + body)
    return out


def _uniquify(html: str, ident: str, prefix: str) -> str:
    parts = html.split(f'id="{ident}"')
    if len(parts) == 1:
        return html
    rebuilt = parts[0]
    for k, part in enumerate(parts[1:]):
        new = f"{prefix}-{ident}-{k}"
        part = part.replace(f"url(#{ident})", f"url(#{new})")
        rebuilt += f'id="{new}"' + part
    return rebuilt


if __name__ == "__main__":
    print(build(Path(sys.argv[1])))
