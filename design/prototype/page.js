/* Page wiring: style switcher, device scaling, demo controls, mockup lightbox. */
'use strict';

(() => {
  const STYLES = {
    a: typeof STYLE_A !== 'undefined' ? STYLE_A : null,
    b: typeof STYLE_B !== 'undefined' ? STYLE_B : null,
    c: typeof STYLE_C !== 'undefined' ? STYLE_C : null,
  };
  const HINTS = {
    a: ['Appuie sur un bouton : il s’enfonce dans son ombre.', 'Touche une tuile : elle s’ouvre en plein écran et la photo suit.', 'Touche « OU » dans les filtres pour le passer en « ET ».', 'Dans une recette : change les portions, coche les ingrédients, lance « Cuisiner ».', 'Le gros + jaune ouvre la création ; essaie d’enregistrer sans nom.'],
    b: ['Touche un mot de la phrase pour le retirer, et « + » pour en ajouter.', 'Touche « ou » pour le changer en « et ».', 'Ouvre la recette à la une : la page se tourne.', 'Mode cuisine : les étapes défilent comme des pages.', '« Créer » ouvre une feuille blanche ; enregistre pour voir le tampon.'],
    c: ['« Filtres » ouvre une feuille : touche une suggestion, elle file dans son groupe.', 'Touche une carte : elle grandit jusqu’à devenir la fiche.', 'Dans la fiche, passe d’Ingrédients à Étapes.', 'Le minuteur du mode cuisine se dessine en cercle.', 'Le + rond se déplie en assistant, une question par écran.'],
  };
  const INTRO = {
    a: 'Marché : tout est physique et rapide. Touche, ou lance la démo.',
    b: 'Carnet : les écrans se tournent comme des pages. Touche, ou lance la démo.',
    c: 'Émail : des mouvements doux, rien ne surprend. Touche, ou lance la démo.',
  };

  const device = document.getElementById('device');
  const caption = document.getElementById('caption');
  const hints = document.getElementById('hints');
  const play = document.getElementById('play');
  const reset = document.getElementById('reset');
  const tabs = [...document.querySelectorAll('.switch [data-style]')];
  let proto = null;
  let screen = null;
  let current = null;

  const say = (text) => { caption.textContent = text; };

  function fit() {
    if (!screen) return;
    const avail = Math.min(device.parentElement.clientWidth - 16, 412);
    let s = avail / 412;
    const maxH = window.innerHeight - 32;
    if (915 * s > maxH && maxH > 560) s = maxH / 915;
    device.style.width = `${412 * s}px`;
    device.style.height = `${915 * s}px`;
    screen.style.transform = `scale(${s})`;
  }

  function demoState(on) {
    play.innerHTML = on ? '<span aria-hidden="true">■</span> Arrêter la démo' : '<span aria-hidden="true">▶</span> Regarder la démo';
  }

  function mount(key) {
    if (!STYLES[key]) return;
    if (proto) proto.stopDemo();
    current = key;
    device.innerHTML = '';
    screen = document.createElement('div');
    screen.className = 'screen';
    screen.innerHTML = '<div class="layers"></div><div class="fx"></div>'
      + '<div class="sbar"><span>14:32</span><span class="icons"><i class="ms">signal_cellular_alt</i><i class="ms">wifi</i><i class="ms">battery_5_bar</i></span></div>'
      + '<div class="gbar"></div><div class="finger" hidden></div>';
    device.append(screen);
    fit();
    proto = new Proto(screen, STYLES[key], { say, demoState });
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.style === key)));
    hints.innerHTML = HINTS[key].map((t) => `<li>${t}</li>`).join('');
    say(INTRO[key]);
    demoState(false);
    try { localStorage.setItem('wezfood-style', key); } catch (e) { /* storage unavailable */ }
  }

  tabs.forEach((t) => {
    if (!STYLES[t.dataset.style]) t.disabled = true;
    t.addEventListener('click', () => mount(t.dataset.style));
  });
  play.addEventListener('click', () => {
    if (proto.demoing) proto.stopDemo('Démo arrêtée.');
    else proto.playDemo();
  });
  reset.addEventListener('click', () => { proto.reset(); say(INTRO[current]); });
  window.addEventListener('resize', fit);

  let first = 'a';
  try { first = localStorage.getItem('wezfood-style') || 'a'; } catch (e) { /* storage unavailable */ }
  const requested = (location.hash || '').replace('#', '');
  if (STYLES[requested]) first = requested;
  mount(STYLES[first] ? first : 'a');

  /* mockup lightbox */
  const lb = document.getElementById('lb');
  const lbImg = document.getElementById('lb-img');
  const lbLabel = document.getElementById('lb-label');
  const close = () => { lb.hidden = true; };
  document.querySelectorAll('figure button').forEach((btn) => {
    btn.addEventListener('click', () => {
      lbImg.src = btn.dataset.full;
      lbImg.alt = btn.dataset.label;
      lbLabel.textContent = btn.dataset.label;
      lb.hidden = false;
      document.getElementById('lb-close').focus();
    });
  });
  lb.addEventListener('click', (e) => { if (e.target !== lbImg) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
