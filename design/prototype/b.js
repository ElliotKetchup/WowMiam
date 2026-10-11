/* Style B — Carnet: templates and choreography. */
'use strict';

const STYLE_B = (() => {
  const EXPO = 'cubic-bezier(.16,1,.3,1)';
  const WIPE = 'cubic-bezier(.7,0,.2,1)';
  const PREP = { Four: 'au', Plaque: 'à la', Poêle: 'à la', Casserole: 'à la' };
  const ARTICLE = { Four: 'un four', Plaque: 'une plaque', Poêle: 'une poêle', Casserole: 'une casserole' };
  const NUMBER = ['Aucun', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf'];

  const words = (text) => esc(text).split(' ').map((w) => `<span class="wm"><span>${w}</span></span>`).join(' ');
  const rise = (root, delay = 0) => stagger(root.querySelectorAll('.wm > span'), [{ transform: 'translateY(105%)' }, { transform: 'none' }], { step: 45, delay, duration: 620, easing: EXPO });
  const fadeUp = (els, delay = 0) => stagger(els, [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { step: 55, delay, duration: 520, easing: EXPO });
  const dishImg = (r) => (r.img ? `<img class="dish" src="${IMG(r.img)}" alt="">` : `<span class="nophoto">${esc(r.name[0])}</span>`);
  const addedText = (r) => (r.added === 'À l’instant' ? 'Ajoutée à l’instant' : `Ajoutée ${r.added.toLowerCase()}`);
  const letter = (name) => name[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

  function askHTML(p, trayOpen) {
    const g = p.state.groups;
    const tok = (kind, l) => `<button class="w w-${kind}" data-act="toggleTag" data-kind="${kind}" data-label="${l}" data-press><span>${l.toLowerCase()}</span></button>`;
    const op = (kind) => ` <button class="op" data-act="toggleOp" data-kind="${kind}" data-press><span>${g[kind].op.toLowerCase()}</span></button> `;
    let s = 'Je veux ';
    s += g.diet.on.length ? `du ${g.diet.on.map((l) => tok('diet', l)).join(op('diet'))}` : 'de tout';
    if (g.type.on.length) s += `, ${g.type.on.map((l) => `en ${tok('type', l)}`).join(op('type'))}`;
    if (g.tool.on.length) s += `, ${g.tool.on.map((l) => `${PREP[l]} ${tok('tool', l)}`).join(op('tool'))}`;
    return `${s} <button class="plus${trayOpen ? ' open' : ''}" data-act="toggleTray" data-press aria-label="Ajouter un mot"><i class="ms">add</i></button>`;
  }

  function trayHTML(p) {
    return Object.entries(CATALOG).map(([kind, labels]) => `<p class="k">${KIND_LABEL[kind]}</p><div class="words">${labels.map((l) => `<button class="${p.state.groups[kind].on.includes(l) ? 'on' : ''}" data-act="toggleTag" data-kind="${kind}" data-label="${l}" data-press>${l.toLowerCase()}</button>`).join('')}</div>`).join('');
  }

  function resultsHTML(p) {
    const list = p.results();
    if (!list.length) {
      return '<div class="index flat"><p class="noresult">Rien ne correspond.<small>Touche un mot de la phrase pour le retirer, ou change un « et » en « ou ».</small></p></div>';
    }
    const [first, ...rest] = list;
    const size = first.name.length > 14 ? 44 : 60;
    const feature = `<article class="feature" data-act="openRecipe" data-id="${first.id}" data-press>
      <div class="block"></div><span class="kicker">${addedText(first)}</span>
      <div class="tags"><span class="tag">${first.type}</span>${first.diets[0] ? `<span class="tag">${first.diets[0]}</span>` : ''}<span class="tag">${first.time} min</span></div>
      <p class="deck">${esc(first.note)}</p>${dishImg(first)}
      <h2 class="serif" style="font-size:${size}px">${words(first.name)}</h2></article>`;
    if (!rest.length) return feature;
    const row = (r) => `<li class="ink" data-act="openRecipe" data-id="${r.id}" data-press><b>${esc(r.name)}</b><span>${p.state.sort === 'az' ? r.type : r.added}</span></li>`;
    if (p.state.sort !== 'az') return `${feature}<div class="index flat"><ul>${rest.map(row).join('')}</ul></div>`;
    const groups = new Map();
    rest.forEach((r) => groups.set(letter(r.name), [...(groups.get(letter(r.name)) || []), r]));
    return `${feature}<div class="index">${[...groups].map(([L, rs]) => `<div class="L">${L}</div><ul>${rs.map(row).join('')}</ul>`).join('')}</div>`;
  }

  function foldersHTML(p) {
    const fs = p.state.folders;
    const count = (f) => `${f.ids.length} recette${f.ids.length > 1 ? 's' : ''}`;
    const dishes = (f, n) => f.ids.map((id) => p.recipe(id)).filter((r) => r && r.img).slice(0, n).map((r) => `<img class="dish" src="${IMG(r.img)}" alt="">`).join('');
    const [c, a, b, ...rest] = fs;
    return `<header class="fh"><div><h1 class="serif">Dossiers</h1><p>${NUMBER[fs.length] || fs.length} dossiers, rangés à la main</p></div><span class="fnew ink" data-press><i class="ms">create_new_folder</i></span></header>
      <button class="cover" data-act="openFolder" data-id="${c.id}" data-color="olive" data-press><div class="kicker">Le plus ouvert cette semaine</div><h2 class="serif">${esc(c.name)}</h2><div class="n">${count(c)}</div>${dishes(c, 2)}</button>
      <div class="pair">${[a, b].map((f, i) => `<button class="mag m${i + 1}" data-act="openFolder" data-id="${f.id}" data-color="${i ? 'paper' : 'crevette'}" data-press><h3 class="serif">${esc(f.name)}</h3><div class="n">${count(f)}</div>${dishes(f, 1)}</button>`).join('')}</div>
      <ul class="toc">${rest.map((f) => `<li class="ink" data-act="openFolder" data-id="${f.id}" data-color="paper" data-press><b>${esc(f.name)}</b><i class="fill"></i><span>${f.ids.length}</span></li>`).join('')}</ul><div class="pad"></div>`;
  }

  function stepHTML(r, i) {
    const [text, min] = r.steps[i];
    return `<div class="sstep" data-card><p class="stext">${words(text)}</p>
      ${min ? `<button class="timer inv" data-act="timer" data-min="${min}" data-press><i class="ms">timer</i>Minuteur <b data-left>${min}:00</b></button>` : ''}</div>`;
  }

  function moveLine(p, name, animate = true) {
    const L = p.stack[0];
    const line = L.querySelector('.navbar .nline');
    const nav = p.rect(L.querySelector('.navbar'));
    const t = p.rect(L.querySelector(`.navbar [data-tab="${name}"]`));
    const to = { left: `${t.x - nav.x}px`, width: `${t.w}px` };
    const from = { left: line.style.left || to.left, width: line.style.width || to.width };
    Object.assign(line.style, to);
    if (animate) anim(line, [from, to], { duration: 520, easing: EXPO });
  }

  function moveSortLine(L, animate) {
    const sorts = L.querySelector('.sorts');
    const on = sorts.querySelector('button.on');
    const line = sorts.querySelector('.uline');
    const to = { left: `${on.offsetLeft}px`, width: `${on.offsetWidth}px` };
    const from = { left: line.style.left || to.left, width: line.style.width || to.width };
    Object.assign(line.style, to);
    if (animate) anim(line, [from, to], { duration: 460, easing: EXPO });
  }

  async function cover(p, color, fromRight = true) {
    const w = h(`<div class="wipe" style="background:${color}"></div>`);
    p.fx.append(w);
    await anim(w, [{ clipPath: fromRight ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 320, easing: WIPE, fill: 'forwards' });
    return w;
  }
  async function uncover(w, toLeft = true) {
    await anim(w, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: toLeft ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }], { duration: 380, easing: WIPE, fill: 'forwards' });
    w.remove();
  }

  return {
    rootClass: 'pb',
    cutoutOptions: { badge: 'Photo détourée' },

    screens: {
      tabs(p) {
        const L = h(`<div class="tabs">
          <section class="view" data-view="home"><div class="scroll">
            <div class="mast serif">WezFood</div>
            <div class="issue"><span>Le carnet d’Elliot</span><span><span data-total>3</span> recettes</span></div>
            <p class="ask serif" data-ask></p>
            <div class="tray" data-tray hidden></div>
            <div class="sortline"><span class="found"><span data-count>3</span> recettes trouvées</span>
              <span class="sorts"><button data-act="sort" data-sort="recent" class="on" data-press>Récents</button><button data-act="sort" data-sort="az" data-press>A–Z</button><i class="uline"></i></span></div>
            <div data-results></div><div class="pad"></div>
          </div></section>
          <section class="view" data-view="folders" hidden><div class="scroll" data-folders></div></section>
          <nav class="navbar"><button class="tab on" data-act="tab" data-tab="home" data-press>Accueil</button>
            <button class="create" data-act="openCreate" data-press><i class="ms">add</i>Créer</button>
            <button class="tab" data-act="tab" data-tab="folders" data-press>Dossiers</button><i class="nline"></i></nav></div>`);
        requestAnimationFrame(() => { moveLine(p, 'home', false); moveSortLine(L, false); });
        return L;
      },

      recipe(p, { id }) {
        const r = p.recipe(id);
        const f = p.servesOf(r) / r.serves;
        const tools = r.tools.map((t) => ARTICLE[t] || t.toLowerCase());
        return h(`<div class="recipe"><div class="scroll">
          <header class="rbar"><button class="back ink" data-act="back" data-press><i class="ms">arrow_back</i>Retour</button><span class="rlabel">Le carnet</span></header>
          <div class="kick fade">${r.type}, ${r.diets.map((d) => d.toLowerCase()).join(', ')}, ${r.time} min</div>
          <h1 class="rtitle serif">${words(r.name)}</h1>
          <p class="rdeck fade">${esc(r.note)}</p>
          <section class="rhero"><div class="block"></div>${dishImg(r)}</section>
          <div class="serves fade">Pour <span class="sv"><button data-act="serves" data-id="${r.id}" data-d="-1" data-press aria-label="Moins">−</button><b data-serves>${p.servesOf(r)}</b><button data-act="serves" data-id="${r.id}" data-d="1" data-press aria-label="Plus">+</button></span> personnes</div>
          <p class="lab fade">Ingrédients</p>
          <ul class="ings fade">${r.ingredients.map(([n, u, l]) => `<li class="ink" data-act="check" data-press><b data-q>${qtyText(n, u, f)}</b><span>${esc(l)}</span></li>`).join('')}</ul>
          <p class="lab fade">Il faut</p><p class="tools fade">${tools.join(', ')}.</p>
          <p class="lab fade">Étapes</p>
          <ol class="steps fade">${r.steps.map(([s], i) => `<li><b class="num">${i + 1}</b><p>${esc(s)}</p></li>`).join('')}</ol>
          <div class="pad"></div></div>
          <div class="cookbar"><button class="cookbtn inv" data-act="cook" data-id="${r.id}" data-press>Cuisiner<i class="ms">arrow_forward</i></button></div></div>`);
      },

      cook(p, { id }) {
        const r = p.recipe(id);
        return h(`<div class="cook">
          <header class="cbar"><button class="back ink" data-act="back" data-press><i class="ms">close</i>Quitter</button><span class="cnt">Étape <span data-stepn>1</span> sur ${r.steps.length}</span></header>
          <div class="rule"><b style="transform:scaleX(${1 / r.steps.length})"></b></div>
          <div class="numeral"><span data-numeral>1</span></div>
          <div class="stage" data-stage>${stepHTML(r, 0)}</div>
          <div class="cfoot"><button class="next inv" data-act="nextStep" data-press><span data-nextlabel>Étape suivante</span><i class="ms">arrow_forward</i></button></div></div>`);
      },

      folder(p, { id }) {
        const f = p.folder(id);
        const recipes = f.ids.map((rid) => p.recipe(rid)).filter(Boolean);
        const lead = recipes.find((r) => r.img);
        return h(`<div class="folderpage"><div class="scroll">
          <header class="rbar"><button class="back ink" data-act="back" data-press><i class="ms">arrow_back</i>Dossiers</button></header>
          <section class="fcover"><div class="kicker">Dossier</div><h1 class="serif">${words(f.name)}</h1><p>${recipes.length} recette${recipes.length > 1 ? 's' : ''}</p>${lead ? `<img class="dish" src="${IMG(lead.img)}" alt="">` : ''}</section>
          <ul class="flist">${recipes.map((r) => `<li class="ink" data-act="openRecipe" data-id="${r.id}" data-press><span class="thumb">${dishImg(r)}</span><span><b>${esc(r.name)}</b><small>${r.type}, ${r.time} min</small></span><i class="ms">arrow_forward</i></li>`).join('')}</ul>
          <div class="pad"></div></div></div>`);
      },

      create() {
        const pills = (key, values) => values.map((v) => `<button data-act="pick" data-pick="${key}" data-value="${v}" data-multi="1" data-press><i class="ms">check</i>${v}</button>`).join('');
        return h(`<div class="newrec"><div class="scroll">
          <header class="rbar"><button class="back ink" data-act="back" data-press>Annuler</button><button class="save inv" data-act="save" data-press>Enregistrer</button></header>
          <input class="title" data-title placeholder="Titre" autocomplete="off" aria-label="Titre de la recette">
          <div class="titleline"></div>
          <p class="hint" data-hint>Le titre suffit pour enregistrer. Le reste peut attendre.</p>
          <div class="prow"><button class="photo" data-act="addPhoto" data-press><span class="ph-empty"><i class="ms">add_a_photo</i>Une photo ?</span></button>
            <p class="pcap"><b>Photo détourée</b>Le plat est découpé tout seul.</p></div>
          <p class="lbl2">C’est un</p>
          <div class="ptype">${CATALOG.type.map((t) => `<button data-act="pick" data-pick="type" data-value="${t}" data-press>${t}</button>`).join('')}</div>
          <p class="lbl2">Convient aux régimes</p><div class="words">${pills('diet', CATALOG.diet)}</div>
          <p class="lbl2">Il faut</p><div class="words">${pills('tool', CATALOG.tool)}</div>
          <p class="lbl2">Ingrédients</p><div class="irows" data-ingredients></div>
          <div class="pad"></div></div>
          <footer class="blocks"><p>Continuer la page</p><div class="grid">
            <button class="blk k1 ink" data-act="addIngredient" data-press><i class="ms">grocery</i>Ingrédients</button>
            <button class="blk k2 ink" data-press><i class="ms">format_list_numbered</i>Étapes</button>
            <button class="blk k3 ink" data-press><i class="ms">edit_note</i>Note</button></div></footer></div>`);
      },
    },

    actions: {
      toggleTray() {
        return this.run(async () => {
          const L = this.stack[0];
          const tray = L.querySelector('[data-tray]');
          const plus = L.querySelector('[data-ask] .plus');
          if (tray.hidden) {
            tray.innerHTML = trayHTML(this);
            tray.hidden = false;
            plus.classList.add('open');
            await anim(tray, [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 440, easing: WIPE });
            fadeUp(tray.querySelectorAll('button'));
          } else {
            plus.classList.remove('open');
            await anim(tray, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 300, easing: WIPE, fill: 'forwards' });
            tray.hidden = true;
            clearAnims(tray);
          }
        });
      },
    },

    async renderResults(p, { animate = false } = {}) {
      const L = p.stack[0];
      const box = L.querySelector('[data-results]');
      const list = p.results();
      const tray = L.querySelector('[data-tray]');
      L.querySelector('[data-ask]').innerHTML = askHTML(p, !tray.hidden);
      if (!tray.hidden) tray.querySelectorAll('button').forEach((b) => b.classList.toggle('on', p.state.groups[b.dataset.kind].on.includes(b.dataset.label)));
      L.querySelectorAll('.sorts button').forEach((b) => b.classList.toggle('on', b.dataset.sort === p.state.sort));
      if (animate) {
        roll(L.querySelector('[data-count]'), String(list.length));
        roll(L.querySelector('[data-total]'), String(p.state.recipes.length));
      } else {
        L.querySelector('[data-count]').textContent = list.length;
        L.querySelector('[data-total]').textContent = p.state.recipes.length;
      }
      if (box.isConnected && L.querySelector('.sorts').offsetWidth) moveSortLine(L, animate);
      L.querySelector('[data-folders]').innerHTML = foldersHTML(p);

      if (animate && box.firstElementChild) {
        await anim(box, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-16px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      }
      box.innerHTML = resultsHTML(p);
      clearAnims(box);
      if (!animate) return;
      const feat = box.querySelector('.feature');
      if (feat) {
        anim(feat.querySelector('.block'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 560, easing: WIPE });
        anim(feat.querySelector('.dish'), [{ transform: 'translateX(90px) rotate(24deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 760, delay: 160, easing: EXPO });
        fadeUp(feat.querySelectorAll('.kicker, .tags, .deck'), 120);
        rise(feat.querySelector('h2'), 220);
      }
      await stagger(box.querySelectorAll('.index li, .index .L, .noresult'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { step: 70, delay: 240, duration: 480, easing: WIPE });
    },

    async filterChanged(p, { kind, label, added, el, op }) {
      if (op) {
        await roll(el.querySelector('span'), op.toLowerCase(), { duration: 180 });
      } else if (!added && el.closest('[data-ask]')) {
        el.classList.add('struck');
        await sleep(300);
        await anim(el, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-30%)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
      }
      await this.renderResults(p, { animate: true });
      if (added) {
        const tok = p.stack[0].querySelector(`[data-ask] .w[data-label="${label}"]`);
        if (tok) {
          anim(tok, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 420, easing: WIPE });
          anim(tok.querySelector('span'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 520, delay: 120, easing: EXPO });
        }
      }
    },

    async tabSwitch(p, from, to, name) {
      moveLine(p, name);
      await anim(from, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-28px)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      from.hidden = true;
      clearAnims(from);
      to.hidden = false;
      const head = to.querySelector('.mast, .fh h1');
      anim(head, [{ clipPath: 'inset(100% 0 0 0)', transform: 'translateY(50px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: 680, easing: EXPO });
      await fadeUp(to.querySelectorAll('.issue, .ask, .sortline, .feature, .index li, .fh p, .cover, .mag, .toc li'), 120);
    },

    push: {
      async default(p, from, to) {
        to.style.boxShadow = '-18px 0 40px rgba(0,0,0,.18)';
        await Promise.all([
          anim(to, [{ transform: 'translateX(100%)' }, { transform: 'none' }], { duration: 560, easing: EXPO }),
          from && anim(from, [{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translateX(-25%)', filter: 'brightness(.85)' }], { duration: 560, easing: EXPO, fill: 'forwards' }),
        ]);
        to.style.boxShadow = '';
      },
      async recipe(p, from, to, { src }) {
        to.style.opacity = '0';
        const fromDish = src && src.querySelector('.dish');
        const flight = fromDish ? p.fly(fromDish, to.querySelector('.rhero .dish'), { duration: 700, easing: EXPO }) : Promise.resolve();
        const w = await cover(p, '#F2B5A0');
        to.style.opacity = '';
        const out = uncover(w);
        rise(to.querySelector('.rtitle'), 120);
        fadeUp(to.querySelectorAll('.fade, .cookbar'), 260);
        anim(to.querySelector('.rhero .block'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 600, delay: 160, easing: WIPE });
        await Promise.all([out, flight]);
      },
      async cook(p, from, to) {
        await anim(to, [{ transform: 'translateY(100%) rotate(3deg)', boxShadow: '0 -20px 50px rgba(0,0,0,.25)' }, { transform: 'none', boxShadow: '0 0 0 rgba(0,0,0,0)' }], { duration: 640, easing: EXPO });
        anim(to.querySelector('[data-numeral]'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 700, easing: EXPO });
        rise(to.querySelector('.stext'), 100);
      },
      async folder(p, from, to, { src }) {
        to.style.opacity = '0';
        const bg = src ? getComputedStyle(src).backgroundColor : '#A5A83C';
        const w = await cover(p, bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#FAFAF8');
        to.style.opacity = '';
        const out = uncover(w);
        rise(to.querySelector('.fcover h1'), 100);
        fadeUp(to.querySelectorAll('.fcover .kicker, .fcover p, .fcover .dish, .flist li'), 200);
        await out;
      },
      async create(p, from, to) {
        await anim(to, [{ transform: 'translateY(100%) rotate(-3deg)' }, { transform: 'none' }], { duration: 620, easing: EXPO });
        anim(to.querySelector('.titleline'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, easing: EXPO });
        fadeUp(to.querySelectorAll('.prow, .lbl2, .ptype, .words, .blk'), 120);
      },
    },

    pop: {
      async default(p, from, to) {
        clearAnims(to);
        from.style.boxShadow = '-18px 0 40px rgba(0,0,0,.18)';
        await Promise.all([
          anim(from, [{ transform: 'none' }, { transform: 'translateX(100%)' }], { duration: 440, easing: WIPE, fill: 'forwards' }),
          anim(to, [{ transform: 'translateX(-25%)', filter: 'brightness(.85)' }, { transform: 'none', filter: 'brightness(1)' }], { duration: 440, easing: WIPE }),
        ]);
      },
      async cook(p, from) {
        await anim(from, [{ transform: 'none' }, { transform: 'translateY(100%) rotate(2deg)' }], { duration: 420, easing: WIPE, fill: 'forwards' });
      },
      async create(p, from, to, info) {
        const stamp = p.fx.querySelector('.stamp');
        await Promise.all([
          anim(from, [{ transform: 'none' }, { transform: info.saved ? 'translateY(105%) rotate(4deg)' : 'translateY(100%)' }], { duration: 460, easing: WIPE, fill: 'forwards' }),
          stamp && anim(stamp, [{ opacity: 0.95, transform: 'none' }, { opacity: 0, transform: 'translateY(380px) rotate(4deg)' }], { duration: 460, easing: WIPE, fill: 'forwards' }),
        ]);
        if (stamp) stamp.remove();
      },
    },

    async showStep(p, r, i) {
      const L = p.top;
      const n = r.steps.length;
      const stage = L.querySelector('[data-stage]');
      const old = stage.querySelector('[data-card]');
      roll(L.querySelector('[data-stepn]'), String(i + 1));
      const num = L.querySelector('[data-numeral]');
      const rule = L.querySelector('.rule b');
      anim(rule, [{ transform: `scaleX(${i / n})` }, { transform: `scaleX(${(i + 1) / n})` }], { duration: 600, easing: EXPO });
      rule.style.transform = `scaleX(${(i + 1) / n})`;
      if (i === n - 1) roll(L.querySelector('[data-nextlabel]'), 'Terminer');
      await Promise.all([
        stagger(old.querySelectorAll('.wm > span'), [{ transform: 'none' }, { transform: 'translateY(-105%)' }], { step: 18, duration: 260, easing: 'ease-in', fill: 'forwards' }),
        anim(old.querySelector('.timer'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }),
        anim(num, [{ transform: 'none' }, { transform: 'translateY(-100%)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' }),
      ]);
      num.textContent = String(i + 1);
      clearAnims(num);
      old.remove();
      const card = h(stepHTML(r, i));
      stage.append(card);
      anim(num, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 700, easing: EXPO });
      fadeUp(card.querySelectorAll('.timer'), 300);
      await rise(card);
    },

    async showDone(p, r) {
      const L = p.top;
      const stage = L.querySelector('[data-stage]');
      const old = stage.querySelector('[data-card]');
      const num = L.querySelector('.numeral');
      await Promise.all([
        stagger(old.querySelectorAll('.wm > span'), [{ transform: 'none' }, { transform: 'translateY(-105%)' }], { step: 18, duration: 260, easing: 'ease-in', fill: 'forwards' }),
        anim(num, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }),
      ]);
      old.remove();
      stage.style.top = '170px';
      const done = h(`<div class="done" data-card><h2 class="serif">${words('Bon appétit.')}</h2>${r.img ? `<img class="dish" src="${IMG(r.img)}" alt="">` : ''}</div>`);
      stage.append(done);
      L.querySelector('.next').dataset.act = 'back';
      roll(L.querySelector('[data-nextlabel]'), 'Fermer le carnet');
      rise(done);
      await anim(done.querySelector('.dish'), [{ transform: 'translateX(120%) rotate(30deg)' }, { transform: 'none' }], { duration: 900, delay: 200, easing: EXPO });
    },

    servesText: (n) => String(n),

    ingredientRow([n, u]) {
      return h(`<div class="row"><b>${qtyText(n, u, 1)}</b><span data-label></span></div>`);
    },
    rowIn(p, row) {
      return anim(row, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 420, easing: WIPE });
    },

    async invalid(p, title) {
      const L = p.top;
      L.querySelector('.titleline').classList.add('err');
      const hint = L.querySelector('[data-hint]');
      hint.classList.add('err');
      roll(hint, 'Il manque un titre.');
      await p.shake(title);
    },

    async saved(p) {
      const stamp = h('<div class="stamp"><div>Enregistrée<small>LE CARNET</small></div></div>');
      p.fx.append(stamp);
      await anim(stamp, [{ transform: 'scale(1.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.95 }], { duration: 260, easing: 'cubic-bezier(.5,0,.75,0)' });
      anim(p.top, [{ transform: 'scale(1)' }, { transform: 'scale(.985)' }, { transform: 'none' }], { duration: 220 });
      await sleep(750);
    },

    async demo(p) {
      p.say('Accueil : une couverture de magazine. La recherche s’écrit comme une phrase.');
      await p.wait(1900);
      p.say('A–Z : la liste devient un index à lettrines.');
      await p.tap('[data-sort="az"]', { after: 1300 });
      await p.tap('[data-sort="recent"]', { after: 900 });
      p.say('Touche un mot de la phrase : il est barré, puis retiré.');
      await p.tap('[data-ask] .w[data-label="Entrée"]', { after: 1200 });
      p.say('Le + déplie tous les mots disponibles.');
      await p.tap('[data-ask] .plus', { after: 500 });
      await p.tap('[data-tray] [data-label="Entrée"]', { after: 800 });
      await p.tap('[data-tray] [data-label="Four"]', { after: 900 });
      await p.tap('[data-ask] .plus', { after: 600 });
      p.say('Touche « ou » pour le changer en « et ».');
      await p.tap('[data-ask] .op[data-kind="type"]', { after: 1500 });
      await p.tap('[data-ask] .op[data-kind="type"]', { after: 1100 });
      p.say('La recette à la une s’ouvre : la page se tourne, la photo glisse dessus.');
      await p.tap('.feature', { after: 1300 });
      p.say('Les portions sont dans la phrase. Les quantités suivent.');
      await p.tap('[data-act="serves"][data-d="1"]', { after: 450 });
      await p.tap('[data-act="serves"][data-d="1"]', { after: 800 });
      await p.tap('.ings li:nth-child(1)', { after: 350 });
      await p.tap('.ings li:nth-child(2)', { after: 700 });
      p.say('Mode cuisine : chaque étape est une page.');
      await p.tap('[data-act="cook"]', { after: 1000 });
      await p.tap('[data-act="nextStep"]', { after: 900 });
      await p.tap('[data-act="nextStep"]', { after: 900 });
      await p.tap('[data-act="nextStep"]', { after: 800 });
      await p.tap('[data-act="timer"]', { after: 2400 });
      await p.tap('[data-act="nextStep"]', { after: 1700 });
      await p.tap('.next', { after: 700 });
      await p.tap('[data-act="back"]', { after: 900 });
      p.say('Dossiers : les favoris en couverture, le reste en sommaire.');
      await p.tap('[data-tab="folders"]', { after: 1100 });
      await p.tap('.cover', { after: 1300 });
      await p.tap('[data-act="back"]', { after: 700 });
      await p.tap('[data-tab="home"]', { after: 900 });
      p.say('« Créer » : une feuille blanche glisse depuis le bas.');
      await p.tap('[data-act="openCreate"]', { after: 900 });
      p.say('La photo est détourée automatiquement.');
      await p.tap('.photo', { after: 700 });
      await p.type('[data-title]', 'Salade de courgettes');
      await p.tap('[data-pick="type"][data-value="Entrée"]', { after: 400 });
      await p.tap('[data-pick="diet"][data-value="Végé"]', { after: 250 });
      await p.tap('[data-pick="diet"][data-value="Sans gluten"]', { after: 250 });
      await p.tap('[data-pick="tool"][data-value="Four"]', { after: 500 });
      await p.tap('[data-act="addIngredient"]', { after: 200 });
      await p.tap('[data-act="addIngredient"]', { after: 200 });
      await p.tap('[data-act="addIngredient"]', { after: 600 });
      p.say('Enregistrer : un coup de tampon, et la recette passe à la une.');
      await p.tap('[data-act="save"]', { after: 2600 });
    },
  };
})();
