/* WezFood prototype engine.
   Shared by the three art directions: recipe data, filter logic (ET / OU),
   a navigation stack of screen layers, motion helpers, and the scripted
   demo with a visible finger. Each style supplies templates and choreography. */
'use strict';

const IMG = (name) => `img/stickers/${name}.webp`;
const RAW = (name) => `img/dishes/${name}.webp`;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ABORT = Symbol('demo-abort');

/* ------------------------------------------------------------------ data */

const LIBRARY = [
  {
    id: 'pizza', name: 'Pizza wrap', img: 'pizza-wrap', type: 'Plat', diets: ['Végé'], tools: ['Four', 'Plaque'],
    time: 15, serves: 2, added: 'Hier soir',
    note: 'La pâte à pizza remplacée par des galettes de fajitas.',
    ingredients: [[2, '', 'galettes de fajitas'], [15, 'cl', 'sauce tomate'], [150, 'g', 'champignons de Paris'], [120, 'g', 'mozzarella râpée'], [1, 'c. à c.', 'origan']],
    steps: [['Préchauffe le four à 220 °C.', 0], ['Étale la sauce tomate sur les galettes.', 0], ['Ajoute les champignons émincés, la mozzarella et l’origan.', 0], ['Enfourne jusqu’à ce que les bords dorent.', 9]],
  },
  {
    id: 'endives', name: 'Salade d’endives aux pommes', img: 'salade-endives', type: 'Entrée', diets: ['Végé', 'Vegan', 'Sans gluten'], tools: ['Saladier'],
    time: 10, serves: 2, added: 'Jeudi',
    note: 'Endives croquantes, dés de pomme et vinaigrette à la moutarde de Dijon.',
    ingredients: [[3, '', 'endives'], [2, '', 'pommes'], [30, 'g', 'cerneaux de noix'], [1, 'c. à s.', 'moutarde de Dijon'], [3, 'c. à s.', 'huile de colza'], [1, 'c. à s.', 'vinaigre de cidre']],
    steps: [['Émince les endives, retire le cœur amer.', 0], ['Coupe les pommes en dés.', 0], ['Fouette moutarde, vinaigre et huile.', 0], ['Mélange le tout avec les noix juste avant de servir.', 0]],
  },
  {
    id: 'aubergines', name: 'Aubergines façon pizza', img: 'aubergines-pizza', type: 'Plat', diets: ['Végé', 'Sans gluten'], tools: ['Four'],
    time: 40, serves: 2, added: 'Mardi',
    note: 'Des aubergines rôties, garnies comme une pizza et servies avec du riz.',
    ingredients: [[1, '', 'grosse aubergine'], [10, 'cl', 'sauce tomate'], [100, 'g', 'tofu fumé'], [80, 'g', 'emmental râpé'], [10, '', 'olives vertes'], [150, 'g', 'riz']],
    steps: [['Coupe l’aubergine en deux dans la longueur et quadrille la chair.', 0], ['Rôtis-la au four à 200 °C avec un filet d’huile.', 20], ['Garnis de sauce tomate, de tofu, d’olives et de fromage.', 0], ['Gratine, puis sers avec le riz.', 10]],
  },
  {
    id: 'pates', name: 'Pâtes, carottes et nuggets', img: 'pates-carottes', type: 'Plat', diets: [], tools: ['Casserole', 'Poêle'],
    time: 25, serves: 2, added: 'Lundi',
    note: 'Le plat du midi qui plaît à tout le monde, avec des carottes poêlées à la ciboulette.',
    ingredients: [[200, 'g', 'fusilli'], [3, '', 'carottes'], [6, '', 'nuggets'], [40, 'g', 'emmental râpé'], [1, 'c. à s.', 'ciboulette']],
    steps: [['Cuis les pâtes dans l’eau salée.', 10], ['Poêle les carottes en rondelles avec la ciboulette.', 12], ['Dore les nuggets à la poêle.', 0], ['Sers avec le fromage râpé.', 0]],
  },
  {
    id: 'composee', name: 'Salade composée', img: 'salade-verte', type: 'Entrée', diets: ['Végé', 'Sans gluten'], tools: ['Casserole'],
    time: 15, serves: 2, added: 'Dimanche',
    note: 'La salade du soir quand le frigo est presque vide.',
    ingredients: [[1, '', 'laitue'], [2, '', 'œufs'], [2, '', 'tomates'], [8, '', 'olives vertes'], [2, 'c. à s.', 'vinaigrette']],
    steps: [['Cuis les œufs dans l’eau bouillante.', 10], ['Lave et essore la salade.', 0], ['Coupe les tomates, écale les œufs.', 0], ['Assemble et assaisonne au dernier moment.', 0]],
  },
];

const NEW_RECIPE = {
  id: 'courgettes', name: 'Salade de courgettes', img: 'salade-courgettes', raw: 'salade-courgettes-photo',
  type: 'Entrée', diets: ['Végé', 'Sans gluten'], tools: ['Four'], time: 35, serves: 2, added: 'À l’instant',
  note: 'Courgettes rôties, servies froides avec de la feta.',
  ingredients: [[2, '', 'courgettes'], [2, '', 'pommes de terre'], [100, 'g', 'feta'], [1, 'botte', 'coriandre']],
  steps: [['Coupe les légumes en dés.', 0], ['Rôtis-les au four à 200 °C.', 25], ['Laisse refroidir complètement.', 0], ['Ajoute la feta émiettée et la coriandre.', 0]],
};

const FOLDERS = [
  { id: 'soirs', name: 'Soirs de semaine', ids: ['pizza', 'pates', 'aubergines'] },
  { id: 'salades', name: 'Salades d’été', ids: ['endives', 'composee'] },
  { id: 'mamie', name: 'Recettes de Mamie', ids: ['aubergines'] },
  { id: 'recevoir', name: 'Pour recevoir', ids: ['pizza', 'endives', 'composee'] },
  { id: 'batch', name: 'Batch cooking', ids: ['pates', 'aubergines'] },
];

const CATALOG = {
  type: ['Entrée', 'Plat', 'Dessert'],
  diet: ['Végé', 'Vegan', 'Sans gluten'],
  tool: ['Four', 'Plaque', 'Poêle', 'Casserole', 'Saladier'],
};
const KIND_LABEL = { type: 'Type', diet: 'Régime', tool: 'Ustensiles' };

function initialState() {
  return {
    recipes: LIBRARY.map((r) => ({ ...r })),
    folders: FOLDERS.map((f) => ({ ...f, ids: [...f.ids] })),
    sort: 'recent',
    tab: 'home',
    groups: {
      diet: { op: 'OU', on: ['Végé'] },
      type: { op: 'OU', on: ['Entrée', 'Plat'] },
      tool: { op: 'OU', on: [] },
    },
    serves: {},
    cook: null,
    made: 0,
  };
}

function tagsOf(recipe, kind) {
  return kind === 'type' ? [recipe.type] : kind === 'diet' ? recipe.diets : recipe.tools;
}

function matches(recipe, groups) {
  return Object.entries(groups).every(([kind, g]) => {
    if (!g.on.length) return true;
    const tags = tagsOf(recipe, kind);
    return g.op === 'OU' ? g.on.some((t) => tags.includes(t)) : g.on.every((t) => tags.includes(t));
  });
}

const fmtQty = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
const qtyText = (q, unit, factor) => `${fmtQty(q * factor)}${unit ? ' ' + unit : ''}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* -------------------------------------------------------------- helpers */

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function anim(el, frames, opts = {}) {
  if (!el) return Promise.resolve(null);
  const options = { duration: 300, easing: 'ease', fill: 'backwards', ...opts };
  if (REDUCED) { options.duration = 1; options.delay = 0; }
  const a = el.animate(frames, options);
  return a.finished.then(() => a, () => a);
}

function clearAnims(el) {
  el.getAnimations().forEach((a) => a.cancel());
}

async function roll(el, text, { dir = 1, duration = 140 } = {}) {
  if (!el || el.textContent === String(text)) return;
  await anim(el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-60 * dir}%)`, opacity: 0 }], { duration, easing: 'ease-in', fill: 'forwards' });
  el.textContent = text;
  clearAnims(el);
  await anim(el, [{ transform: `translateY(${60 * dir}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: duration + 60, easing: 'cubic-bezier(.2,1.4,.4,1)' });
}

function stagger(els, frames, { step = 50, ...opts } = {}) {
  return Promise.all([...els].map((el, i) => anim(el, frames, { delay: i * step, ...opts })));
}

/* --------------------------------------------------------------- engine */

class Proto {
  constructor(root, style, hooks = {}) {
    this.root = root;
    this.style = style;
    this.hooks = hooks;
    this.layersEl = root.querySelector('.layers');
    this.fx = root.querySelector('.fx');
    this.finger = root.querySelector('.finger');
    this.stack = [];
    this.busy = false;
    this.timers = new Set();
    this.demoing = false;
    this.aborted = false;
    this.pressed = null;
    root.classList.add(style.rootClass);
    this.bind();
    this.reset();
  }

  /* geometry: the device is scaled with a CSS transform, so measure in phone dp */
  get scale() { return this.root.getBoundingClientRect().width / 412; }
  rect(el) {
    const r = el.getBoundingClientRect();
    const o = this.root.getBoundingClientRect();
    const s = this.scale;
    return { x: (r.left - o.left) / s, y: (r.top - o.top) / s, w: r.width / s, h: r.height / s };
  }
  plainRect(el) {
    const prev = el.style.rotate;
    el.style.rotate = '0deg';
    const r = this.rect(el);
    el.style.rotate = prev;
    return r;
  }

  get top() { return this.stack[this.stack.length - 1]; }
  find(sel) { return (this.top && this.top.querySelector(sel)) || this.root.querySelector(sel); }
  recipe(id) { return this.state.recipes.find((r) => r.id === id); }
  folder(id) { return this.state.folders.find((f) => f.id === id); }
  servesOf(r) { return this.state.serves[r.id] ?? r.serves; }

  results() {
    const list = this.state.recipes.filter((r) => matches(r, this.state.groups));
    if (this.state.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return list;
  }
  activeTags() {
    return Object.entries(this.state.groups).flatMap(([kind, g]) => g.on.map((label) => ({ kind, label })));
  }

  /* --------------------------------------------------------- input */
  bind() {
    this.root.addEventListener('pointerdown', (e) => {
      if (e.isTrusted && this.demoing) this.stopDemo('Démo arrêtée. À toi de jouer.');
      const t = e.target.closest('[data-press]');
      if (!t || !this.root.contains(t)) return;
      this.pressed = { el: t, at: performance.now() };
      t.classList.add('is-pressed');
    });
    const release = () => {
      if (!this.pressed) return;
      const { el, at } = this.pressed;
      this.pressed = null;
      const left = Math.max(0, 110 - (performance.now() - at));
      setTimeout(() => el.classList.remove('is-pressed'), left);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || !this.root.contains(t) || this.busy) return;
      if (t.tagName === 'INPUT') return;
      this.act(t.dataset.act, t);
    });
  }

  act(name, el) {
    const fn = (this.style.actions && this.style.actions[name]) || this.actions[name];
    if (fn) return fn.call(this, el);
    return undefined;
  }

  async run(task) {
    this.busy = true;
    try { await task(); } finally { this.busy = false; }
  }

  /* ---------------------------------------------------- navigation */
  mount(layer, name) {
    layer.classList.add('layer');
    layer.dataset.screen = name;
    this.layersEl.append(layer);
    return layer;
  }

  push(name, params = {}, src = null) {
    return this.run(async () => {
      const from = this.top;
      const to = this.mount(this.style.screens[name](this, { ...params, src }), name);
      this.stack.push(to);
      this.syncStatus();
      const fx = (this.style.push && this.style.push[name]) || this.style.push.default;
      await fx.call(this.style, this, from, to, { src, ...params });
      if (from) from.inert = true;
    });
  }

  pop(info = {}) {
    if (this.stack.length < 2) return Promise.resolve();
    return this.run(async () => {
      const from = this.stack.pop();
      const to = this.top;
      to.inert = false;
      this.syncStatus();
      this.stopTimers();
      const fx = (this.style.pop && this.style.pop[from.dataset.screen]) || this.style.pop.default;
      await fx.call(this.style, this, from, to, info);
      from.remove();
      clearAnims(to);
    });
  }

  syncStatus() {
    this.root.classList.toggle('status-light', !!(this.top && this.top.dataset.dark));
  }

  reset() {
    this.stopDemo();
    this.stopTimers();
    this.layersEl.innerHTML = '';
    this.fx.innerHTML = '';
    this.finger.hidden = true;
    this.fpos = null;
    this.state = initialState();
    this.stack = [this.mount(this.style.screens.tabs(this), 'tabs')];
    this.style.renderResults(this, {});
    this.syncStatus();
  }

  /* --------------------------------------------------- motion helpers */
  async fly(from, to, { duration = 520, easing = 'cubic-bezier(.3,.9,.3,1.05)' } = {}) {
    if (!from || !to) return;
    const a = this.plainRect(from);
    const b = this.plainRect(to);
    const ra = parseFloat(getComputedStyle(from).rotate) || 0;
    const rb = parseFloat(getComputedStyle(to).rotate) || 0;
    const g = from.cloneNode(true);
    g.classList.add('ghost');
    Object.assign(g.style, {
      position: 'absolute', left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`,
      right: 'auto', bottom: 'auto', margin: '0', rotate: '0deg', zIndex: '5', visibility: 'visible',
    });
    this.fx.append(g);
    from.style.visibility = 'hidden';
    to.style.visibility = 'hidden';
    const dx = b.x + b.w / 2 - (a.x + a.w / 2);
    const dy = b.y + b.h / 2 - (a.y + a.h / 2);
    await anim(g, [
      { transform: `translate(0px, 0px) rotate(${ra}deg) scale(1)` },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rb}deg) scale(${b.w / a.w})` },
    ], { duration, easing, fill: 'forwards' });
    to.style.visibility = '';
    from.style.visibility = '';
    g.remove();
  }

  /* a coloured block grows from an element's box to the full screen */
  async expand(fromEl, { background, radius = '20px', border = 'none', duration = 420, easing = 'cubic-bezier(.2,.9,.25,1)' } = {}) {
    const a = this.rect(fromEl);
    const o = h('<div class="expander"></div>');
    Object.assign(o.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`, background, borderRadius: radius, border });
    this.fx.append(o);
    await anim(o, [
      { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`, borderRadius: radius },
      { left: '0px', top: '0px', width: '412px', height: '915px', borderRadius: '0px' },
    ], { duration, easing, fill: 'forwards' });
    return o;
  }

  /* photo → automatic cut-out, the signature moment of the create flow */
  async cutout(slot, recipe, { badge = 'Plat détouré' } = {}) {
    slot.classList.add('has-photo');
    const raw = h(`<img class="raw" src="${RAW(recipe.raw)}" alt="">`);
    slot.append(raw);
    await anim(raw, [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    const scan = h('<div class="scan"></div>');
    slot.append(scan);
    await anim(scan, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(100%)' }], { duration: 950, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' });
    scan.remove();
    const cut = h(`<img class="dish cut" src="${IMG(recipe.img)}" alt="">`);
    slot.append(cut);
    await Promise.all([
      anim(raw, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }),
      anim(cut, [{ opacity: 0, transform: 'scale(1.35) rotate(9deg)' }, { opacity: 1, transform: 'scale(.94) rotate(-1deg)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], { duration: 560, easing: 'cubic-bezier(.3,0,.4,1)' }),
    ]);
    raw.remove();
    const b = h(`<span class="cut-badge"><i class="ms fill">auto_awesome</i>${badge}</span>`);
    slot.append(b);
    await anim(b, [{ opacity: 0, transform: 'translateY(8px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }

  async typeText(el, text, speed = 55) {
    el.classList.add('typing');
    const isInput = el.tagName === 'INPUT';
    for (let i = 1; i <= text.length; i += 1) {
      if (isInput) el.value = text.slice(0, i); else el.textContent = text.slice(0, i);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await this.wait(speed);
    }
    el.classList.remove('typing');
  }

  /* scroll the nearest in-screen scroller (never the host page) so el sits above the bottom bar */
  reveal(el, margin = 150) {
    const sc = el.closest('.scroll');
    if (!sc) return;
    const r = this.rect(el);
    const s = this.rect(sc);
    const overflow = r.y + r.h - (s.y + s.h - margin);
    if (overflow > 0) sc.scrollTo({ top: sc.scrollTop + overflow, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  shake(el) {
    return anim(el, [
      { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' },
      { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
    ], { duration: 360, easing: 'ease-out' });
  }

  every(ms, fn) {
    const id = setInterval(fn, ms);
    this.timers.add(id);
    return id;
  }
  stopTimers() {
    this.timers.forEach((id) => clearInterval(id));
    this.timers.clear();
  }

  /* -------------------------------------------------------- actions */
  get actions() {
    return {
      back() { return this.pop(); },
      tab(el) { return this.switchTab(el.dataset.tab); },
      openRecipe(el) { return this.push('recipe', { id: el.dataset.id }, el); },
      openFolder(el) { return this.push('folder', { id: el.dataset.id }, el); },
      openCreate(el) { return this.push('create', {}, el); },
      cook(el) {
        this.state.cook = { id: el.dataset.id, i: 0 };
        return this.push('cook', { id: el.dataset.id }, el);
      },
      sort(el) {
        if (this.state.sort === el.dataset.sort) return undefined;
        this.state.sort = el.dataset.sort;
        return this.run(() => this.style.renderResults(this, { animate: true, reason: 'sort' }));
      },
      toggleTag(el) {
        const { kind, label } = el.dataset;
        const g = this.state.groups[kind];
        const added = !g.on.includes(label);
        g.on = added ? [...g.on, label] : g.on.filter((t) => t !== label);
        return this.run(() => this.style.filterChanged(this, { kind, label, added, el }));
      },
      toggleOp(el) {
        const g = this.state.groups[el.dataset.kind];
        g.op = g.op === 'OU' ? 'ET' : 'OU';
        return this.run(() => this.style.filterChanged(this, { kind: el.dataset.kind, op: g.op, el }));
      },
      serves(el) {
        const r = this.recipe(el.dataset.id);
        const next = Math.min(12, Math.max(1, this.servesOf(r) + Number(el.dataset.d)));
        this.state.serves[r.id] = next;
        const factor = next / r.serves;
        const dir = Number(el.dataset.d) > 0 ? 1 : -1;
        const layer = this.top;
        roll(layer.querySelector('[data-serves]'), this.style.servesText ? this.style.servesText(next) : String(next), { dir });
        layer.querySelectorAll('[data-q]').forEach((q, i) => {
          const [n, unit] = r.ingredients[i];
          setTimeout(() => roll(q, qtyText(n, unit, factor), { dir }), i * 35);
        });
        return undefined;
      },
      check(el) { el.classList.toggle('done'); },
      pick(el) {
        if (el.dataset.multi) { el.classList.toggle('on'); return; }
        el.parentElement.querySelectorAll('[data-act="pick"]').forEach((b) => b.classList.toggle('on', b === el));
      },
      nextStep() {
        const c = this.state.cook;
        const r = this.recipe(c.id);
        this.stopTimers();
        if (c.i < r.steps.length - 1) {
          c.i += 1;
          return this.run(() => this.style.showStep(this, r, c.i, 1));
        }
        return this.run(() => this.style.showDone(this, r));
      },
      timer(el) {
        if (el.classList.contains('running')) { this.stopTimers(); el.classList.remove('running'); return; }
        let left = Number(el.dataset.min) * 60;
        const out = el.querySelector('[data-left]');
        el.classList.add('running');
        const tick = () => {
          left -= 1;
          const m = Math.floor(left / 60), s = left % 60;
          out.textContent = `${m}:${String(s).padStart(2, '0')}`;
          this.style.timerTick && this.style.timerTick(this, el, left, Number(el.dataset.min) * 60);
          if (left <= 0) this.stopTimers();
        };
        tick();
        this.every(1000, tick);
      },
      addPhoto(el) {
        if (el.classList.contains('has-photo')) return undefined;
        this.top.dataset.photo = '1';
        return this.run(() => this.cutout(el, NEW_RECIPE, this.style.cutoutOptions || {}));
      },
      addIngredient() {
        const list = this.top.querySelector('[data-ingredients]');
        const n = list.querySelectorAll('[data-row]').length;
        const item = NEW_RECIPE.ingredients[n];
        if (!item) return this.shake(list);
        const row = this.style.ingredientRow(item);
        row.dataset.row = '';
        list.append(row);
        this.reveal(row);
        return this.run(async () => {
          await this.style.rowIn(this, row);
          await this.typeText(row.querySelector('[data-label]'), item[2], 28);
        });
      },
      save() { return this.save(); },
    };
  }

  switchTab(name) {
    if (this.state.tab === name) return undefined;
    const layer = this.stack[0];
    const from = layer.querySelector(`[data-view="${this.state.tab}"]`);
    const to = layer.querySelector(`[data-view="${name}"]`);
    this.state.tab = name;
    layer.querySelectorAll('[data-act="tab"]').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
    return this.run(() => this.style.tabSwitch(this, from, to, name));
  }

  async save() {
    const layer = this.top;
    const title = layer.querySelector('[data-title]');
    const name = title.value.trim();
    if (!name) {
      await this.run(() => this.style.invalid(this, title));
      return;
    }
    const picked = (key) => [...layer.querySelectorAll(`[data-pick="${key}"].on`)].map((b) => b.dataset.value);
    this.state.made += 1;
    const rec = {
      ...NEW_RECIPE,
      id: `new${this.state.made}`,
      name,
      type: picked('type')[0] || NEW_RECIPE.type,
      diets: picked('diet'),
      tools: picked('tool'),
      img: layer.dataset.photo ? NEW_RECIPE.img : null,
    };
    this.state.recipes.unshift(rec);
    this.folder('salades').ids.unshift(rec.id);
    await this.run(() => this.style.saved(this, rec));
    await this.pop({ saved: rec });
    if (this.state.tab !== 'home') await this.switchTab('home');
    await this.run(() => this.style.renderResults(this, { animate: true, added: rec.id, reason: 'saved' }));
    this.style.afterSave && (await this.style.afterSave(this, rec));
  }

  /* ----------------------------------------------------------- demo */
  guard() { if (this.aborted) throw ABORT; }
  async wait(ms) { await sleep(ms); this.guard(); }
  async idle() { while (this.busy) { await sleep(40); this.guard(); } }
  say(text) { this.hooks.say && this.hooks.say(text); }

  async fingerTo(x, y, duration = 520) {
    const f = this.finger;
    const start = this.fpos || { x: 330, y: 980 };
    if (f.hidden) {
      f.hidden = false;
      anim(f, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    await anim(f, [
      { transform: `translate(${start.x}px, ${start.y}px)` },
      { transform: `translate(${x}px, ${y}px)` },
    ], { duration, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    this.fpos = { x, y };
  }

  async tap(target, { after = 0 } = {}) {
    await this.idle();
    const el = typeof target === 'string' ? this.find(target) : target;
    if (!el) throw new Error(`demo: nothing matches ${target}`);
    const sc = el.closest('.scroll');
    if (sc) {
      const r = this.rect(el), s = this.rect(sc);
      if (r.y < s.y + 24 || r.y + r.h > s.y + s.h - 24) {
        sc.scrollTo({ top: sc.scrollTop + (r.y - s.y) - s.h * 0.35, behavior: REDUCED ? 'auto' : 'smooth' });
        await this.wait(650);
      }
    }
    const r = this.rect(el);
    await this.fingerTo(r.x + r.w / 2, r.y + r.h / 2);
    this.guard();
    this.finger.classList.add('down');
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await this.wait(150);
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    this.finger.classList.remove('down');
    el.click();
    await this.wait(after);
  }

  async scrollBy(dy, sel = '.scroll') {
    const sc = this.find(sel);
    if (!sc) return;
    sc.scrollTo({ top: sc.scrollTop + dy, behavior: REDUCED ? 'auto' : 'smooth' });
    await this.wait(700);
  }

  async type(sel, text) {
    await this.idle();
    const el = this.find(sel);
    const r = this.rect(el);
    await this.fingerTo(r.x + Math.min(r.w / 2, 120), r.y + r.h / 2);
    this.finger.classList.add('down');
    await this.wait(120);
    this.finger.classList.remove('down');
    await this.typeText(el, text);
  }

  async playDemo() {
    this.reset();
    this.demoing = true;
    this.aborted = false;
    this.hooks.demoState && this.hooks.demoState(true);
    try {
      await this.wait(500);
      await this.style.demo(this);
      this.say('Fin de la démo. Touche l’écran pour essayer toi-même.');
    } catch (err) {
      if (err !== ABORT) { console.error(err); this.say('La démo a rencontré un souci.'); }
    } finally {
      this.demoing = false;
      this.hooks.demoState && this.hooks.demoState(false);
      if (this.fpos) {
        anim(this.finger, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).then(() => {
          this.finger.hidden = true;
          clearAnims(this.finger);
          this.fpos = null;
        });
      }
    }
  }

  stopDemo(message) {
    if (!this.demoing) return;
    this.aborted = true;
    if (message) this.say(message);
  }
}
