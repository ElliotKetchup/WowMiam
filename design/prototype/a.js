/* Style A — Marché: templates and choreography. */
'use strict';

const STYLE_A = (() => {
  const SPRING = 'cubic-bezier(.2,1.45,.4,1)';
  const SNAP = 'cubic-bezier(.7,0,.25,1)';
  const TILE_COLORS = ['brique', 'pistache', 'tile', 'safran'];
  const FOLDER_COLORS = ['safran', 'brique', 'pistache', 'tile', 'ink'];

  const dishImg = (r, cls = 'dish') => (r.img
    ? `<img class="${cls}" src="${IMG(r.img)}" alt="">`
    : `<span class="nophoto display">${esc(r.name[0])}</span>`);

  function tileHTML(r, i) {
    const slot = i === 0 ? 'w' : i === 1 ? 't' : 'n';
    const color = TILE_COLORS[i % TILE_COLORS.length];
    return `<article class="tile ${slot} c-${color} brut" data-act="openRecipe" data-id="${r.id}" data-color="${color}" data-press>
      ${slot !== 'n' ? `<div class="when">${r.added}</div>` : ''}
      <h3 class="display">${esc(r.name)}</h3>
      ${slot === 'w' ? `<p class="deck">${esc(r.note)}</p>` : ''}
      <div class="meta"><span class="chip">${r.type}</span>${slot !== 'n' && r.diets[0] ? `<span class="chip">${r.diets[0]}</span>` : ''}${slot === 'w' ? `<span class="chip"><i class="ms">timer</i>${r.time} min</span>` : ''}</div>
      ${dishImg(r)}
    </article>`;
  }

  function queryHTML(p) {
    const parts = [];
    for (const [kind, g] of Object.entries(p.state.groups)) {
      if (!g.on.length) continue;
      const chips = g.on.map((l) => `<button class="chip k-${kind}" data-act="toggleTag" data-kind="${kind}" data-label="${l}" data-press>${l}<i class="ms">close</i></button>`);
      const inner = chips.join(`<button class="op" data-act="toggleOp" data-kind="${kind}" data-press>${g.op}</button>`);
      parts.push(g.on.length > 1 ? `<span class="group">${inner}</span>` : inner);
    }
    return parts.join('<span class="op and">ET</span>') || '<span class="none">Aucun filtre : toutes tes recettes</span>';
  }

  function filterPanelHTML(p) {
    const groups = Object.entries(CATALOG).map(([kind, labels]) => `<div class="fgroup"><p>${KIND_LABEL[kind]}</p><div>${labels.map((l) => `<button class="fchip${p.state.groups[kind].on.includes(l) ? ' on' : ''}" data-act="toggleTag" data-kind="${kind}" data-label="${l}" data-press>${l}</button>`).join('')}</div></div>`).join('');
    return `<div class="scrim" data-act="closeFilter"></div>
      <div class="fpanel brut"><h3 class="display">Filtrer</h3>${groups}
      <button class="fgo" data-act="closeFilter" data-press>Voir <span data-fcount>${p.results().length}</span> recettes</button></div>`;
  }

  function folderTileHTML(p, f, i) {
    const slot = i === 0 ? 'w' : i === 1 ? 't' : 'n';
    const color = FOLDER_COLORS[i % FOLDER_COLORS.length];
    const dishes = f.ids.map((id) => p.recipe(id)).filter((r) => r && r.img).slice(0, slot === 'w' ? 2 : 1);
    return `<article class="folder ${slot} c-${color} brut" data-act="openFolder" data-id="${f.id}" data-color="${color}" data-press>
      <h2 class="display">${esc(f.name)}</h2><div class="n"><b>${f.ids.length}</b>recette${f.ids.length > 1 ? 's' : ''}</div>
      ${dishes.map((r) => `<img class="dish" src="${IMG(r.img)}" alt="">`).join('')}
    </article>`;
  }

  function foldersHTML(p) {
    return `<header class="fh"><div><h1 class="display">Dossiers</h1><p>${p.state.folders.length} dossiers rangés à la main</p></div>
      <span class="newf brut" data-press><i class="ms">add</i>Nouveau</span></header>
      <main class="fbento">${p.state.folders.map((f, i) => folderTileHTML(p, f, i)).join('')}
      <article class="folder add" data-press><i class="ms">create_new_folder</i>Nouveau dossier</article></main><div class="pad"></div>`;
  }

  function stepCard(r, i) {
    const [text, min] = r.steps[i];
    return `<article class="scard" data-card><div class="sn display">Étape ${i + 1}</div><p class="st">${esc(text)}</p>
      ${min ? `<button class="timer brut" data-act="timer" data-min="${min}" data-press><i class="ms">timer</i><span data-left>${min}:00</span></button>` : ''}</article>`;
  }

  async function moveIndicator(p, name, animate = true) {
    const L = p.stack[0];
    const ind = L.querySelector('.navbar .ind');
    const tab = L.querySelector(`.navbar [data-tab="${name}"] .pill`);
    const nav = p.rect(L.querySelector('.navbar'));
    const x = p.rect(tab).x - nav.x;
    const from = ind.style.left || `${x}px`;
    ind.style.left = `${x}px`;
    if (animate) await anim(ind, [{ left: from, width: '60px' }, { width: '84px', offset: 0.45 }, { left: `${x}px`, width: '60px' }], { duration: 420, easing: SPRING });
  }

  function popIn(els, delay = 0) {
    return stagger(els, [{ opacity: 0, transform: 'translateY(16px) scale(.9) rotate(-2deg)' }, { opacity: 1, transform: 'none' }], { step: 55, delay, duration: 420, easing: SPRING });
  }

  return {
    rootClass: 'pa',
    cutoutOptions: { badge: 'Plat détouré' },

    screens: {
      tabs(p) {
        const L = h(`<div class="tabs">
          <section class="view" data-view="home"><div class="scroll">
            <header class="top"><div class="wordmark display">Wez<span>F</span>ood</div><div class="avatar">E</div></header>
            <div class="search"><div class="field brut"><i class="ms">search</i>Recette, ingrédient, ustensile…</div>
              <button class="tune brut" data-act="openFilter" data-press aria-label="Filtres"><i class="ms">tune</i><span class="badge" data-badge>3</span></button></div>
            <div class="query" data-query></div>
            <div class="section"><div><h2 class="display" data-heading>Derniers ajouts</h2><p class="count"><span data-count>3</span> recettes</p></div>
              <div class="seg"><i class="thumb"></i><button data-act="sort" data-sort="recent" class="on">Récents</button><button data-act="sort" data-sort="az">A–Z</button></div></div>
            <main class="bento" data-results></main><div class="pad"></div>
          </div><div data-filter hidden></div></section>
          <section class="view" data-view="folders" hidden><div class="scroll" data-folders></div></section>
          <nav class="navbar"><i class="ind"></i>
            <button class="tab on" data-act="tab" data-tab="home" data-press><span class="pill"><i class="ms">home</i></span>Accueil</button>
            <button class="create brut" data-act="openCreate" data-press aria-label="Nouvelle recette"><i class="ms">add</i></button>
            <button class="tab" data-act="tab" data-tab="folders" data-press><span class="pill"><i class="ms">folder</i></span>Dossiers</button>
          </nav></div>`);
        requestAnimationFrame(() => moveIndicator(p, 'home', false));
        return L;
      },

      recipe(p, { id, src }) {
        const r = p.recipe(id);
        const color = (src && src.dataset.color) || 'pistache';
        const f = p.servesOf(r) / r.serves;
        return h(`<div class="recipe"><div class="scroll">
          <header class="rbar"><button class="sq brut" data-act="back" data-press aria-label="Retour"><i class="ms">arrow_back</i></button><span class="sq brut" data-press><i class="ms">more_horiz</i></span></header>
          <section class="hero brut c-${color}"><div class="kick">${r.added}</div><h1 class="display">${esc(r.name)}</h1>${dishImg(r)}</section>
          <div class="rchips rise"><span class="chip">${r.type}</span>${r.diets.map((d) => `<span class="chip">${d}</span>`).join('')}<span class="chip"><i class="ms">timer</i>${r.time} min</span></div>
          <p class="note rise">${esc(r.note)}</p>
          <section class="block rise"><div class="bh"><h2 class="display">Ingrédients</h2>
            <div class="stepper brut"><button data-act="serves" data-id="${r.id}" data-d="-1" data-press aria-label="Moins">−</button><b><span data-serves>${p.servesOf(r)}</span> pers.</b><button data-act="serves" data-id="${r.id}" data-d="1" data-press aria-label="Plus">+</button></div></div>
            <ul class="ings">${r.ingredients.map(([n, u, l]) => `<li data-act="check" data-press><i class="box"><i class="ms">check</i></i><b data-q>${qtyText(n, u, f)}</b><span>${esc(l)}</span></li>`).join('')}</ul></section>
          <section class="block rise"><h2 class="display">Ustensiles</h2><div class="rchips" style="margin:0">${r.tools.map((t) => `<span class="chip">${t}</span>`).join('')}</div></section>
          <section class="block rise"><h2 class="display">Étapes</h2><ol class="steps">${r.steps.map(([s], i) => `<li><b class="num display">${i + 1}</b><p>${esc(s)}</p></li>`).join('')}</ol></section>
          <div class="pad"></div></div>
          <div class="cookbar"><button class="cookbtn brut" data-act="cook" data-id="${r.id}" data-press><i class="ms fill">play_arrow</i>Cuisiner</button></div></div>`);
      },

      cook(p, { id }) {
        const r = p.recipe(id);
        const L = h(`<div class="cook" data-dark="1">
          <header class="cbar"><button class="sq light" data-act="back" data-press aria-label="Fermer"><i class="ms">close</i></button>
            <div class="prog">${r.steps.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"><b></b></i>`).join('')}</div>
            <span class="cnt"><span data-stepn>1</span>/${r.steps.length}</span></header>
          <div class="stage" data-stage>${stepCard(r, 0)}</div>
          <div class="cfoot"><button class="next brut" data-act="nextStep" data-press><span data-nextlabel>Étape suivante</span><i class="ms">arrow_forward</i></button></div></div>`);
        return L;
      },

      folder(p, { id, src }) {
        const f = p.folder(id);
        const color = (src && src.dataset.color) || 'safran';
        const recipes = f.ids.map((rid) => p.recipe(rid)).filter(Boolean);
        const cover = recipes.find((r) => r.img);
        return h(`<div class="folderpage"><div class="scroll">
          <header class="rbar"><button class="sq brut" data-act="back" data-press aria-label="Retour"><i class="ms">arrow_back</i></button></header>
          <section class="fhead brut c-${color}"><h1 class="display">${esc(f.name)}</h1><p>${recipes.length} recette${recipes.length > 1 ? 's' : ''}</p>${cover ? `<img class="dish" src="${IMG(cover.img)}" alt="">` : ''}</section>
          <div class="flist">${recipes.map((r) => `<article class="frow brut c-tile" data-act="openRecipe" data-id="${r.id}" data-color="tile" data-press>${dishImg(r)}<div><h3 class="display">${esc(r.name)}</h3><div class="meta"><span class="chip">${r.type}</span><span class="chip">${r.time} min</span></div></div><i class="ms">chevron_right</i></article>`).join('')}
            <div class="frow add" data-press><i class="ms">add</i>Ajouter une recette</div></div><div class="pad"></div></div></div>`);
      },

      create() {
        const pick = (key, values, multi) => values.map((v) => `<button class="chip" data-act="pick" data-pick="${key}" data-value="${v}" ${multi ? 'data-multi="1"' : ''} data-press>${v}</button>`).join('');
        return h(`<div class="newrec"><div class="scroll">
          <header class="rbar"><button class="sq brut" data-act="back" data-press aria-label="Fermer"><i class="ms">close</i></button><span class="lbl">Nouvelle recette</span><button class="save" data-act="save" data-press>Enregistrer</button></header>
          <button class="photo brut" data-act="addPhoto" data-press><span class="ph-empty"><i class="ms">add_a_photo</i>Ajouter une photo</span></button>
          <input class="title display" data-title placeholder="Nom de la recette" autocomplete="off" aria-label="Nom de la recette">
          <p class="hint" data-hint>Seul le nom est obligatoire.</p>
          <div class="ptype">${CATALOG.type.map((t) => `<button class="brut" data-act="pick" data-pick="type" data-value="${t}" data-press><i class="ms">check_circle</i>${t}</button>`).join('')}</div>
          <div class="props">
            <div class="prop"><span class="k"><i class="ms">eco</i>Régime</span><span class="v">${pick('diet', CATALOG.diet, true)}</span></div>
            <div class="prop"><span class="k"><i class="ms">soup_kitchen</i>Ustensiles</span><span class="v">${pick('tool', CATALOG.tool, true)}</span></div>
            <div class="prop"><span class="k"><i class="ms">folder</i>Dossier</span><span class="v"><span class="chip">Salades d’été</span></span></div>
          </div>
          <section class="ing"><h2 class="display">Ingrédients</h2><div class="rows" data-ingredients></div><p class="ehint">Ajoute-les avec le bloc Ingrédient, en bas.</p></section>
          <div class="pad"></div></div>
          <footer class="blocks"><p>Ajouter un bloc</p><div class="grid">
            <button class="blk b1 brut" data-act="addIngredient" data-press><i class="ms">grocery</i>Ingrédient</button>
            <button class="blk b2 brut" data-press><i class="ms">format_list_numbered</i>Étape</button>
            <button class="blk b3 brut" data-press><i class="ms">sticky_note_2</i>Note</button>
            <button class="blk b4 brut" data-act="photoBlock" data-press><i class="ms">add_a_photo</i>Photo</button></div></footer></div>`);
      },
    },

    actions: {
      openFilter() {
        return this.run(async () => {
          const box = this.stack[0].querySelector('[data-filter]');
          box.innerHTML = filterPanelHTML(this);
          box.hidden = false;
          const panel = box.querySelector('.fpanel');
          anim(box.querySelector('.scrim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
          await anim(panel, [{ opacity: 0, transform: 'translateY(-18px) scale(.9) rotate(1.5deg)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: SPRING });
          stagger(panel.querySelectorAll('.fchip'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { step: 22, duration: 300, easing: SPRING });
        });
      },
      closeFilter() {
        return this.run(async () => {
          const box = this.stack[0].querySelector('[data-filter]');
          await Promise.all([
            anim(box.querySelector('.fpanel'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px) scale(.94)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }),
            anim(box.querySelector('.scrim'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }),
          ]);
          box.hidden = true;
          box.innerHTML = '';
        });
      },
      photoBlock() { return this.act('addPhoto', this.top.querySelector('.photo')); },
    },

    async renderResults(p, { animate = false, added = null } = {}) {
      const L = p.stack[0];
      const box = L.querySelector('[data-results]');
      const list = p.results();
      L.querySelector('[data-query]').innerHTML = queryHTML(p);
      const tags = p.activeTags().length;
      const heading = p.state.sort === 'az' ? 'De A à Z' : 'Derniers ajouts';
      const seg = L.querySelector('.seg');
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.sort === p.state.sort));
      const thumb = seg.querySelector('.thumb');
      const tx = p.state.sort === 'az' ? '100%' : '0%';
      if (animate) {
        anim(thumb, [{ transform: thumb.style.transform || 'translateX(0%)' }, { transform: `translateX(${tx})` }], { duration: 360, easing: SPRING });
        roll(L.querySelector('[data-count]'), String(list.length));
        roll(L.querySelector('[data-badge]'), String(tags));
        roll(L.querySelector('[data-heading]'), heading);
      } else {
        L.querySelector('[data-count]').textContent = list.length;
        L.querySelector('[data-badge]').textContent = tags;
        L.querySelector('[data-heading]').textContent = heading;
      }
      thumb.style.transform = `translateX(${tx})`;
      L.querySelector('[data-folders]').innerHTML = foldersHTML(p);

      if (animate && box.children.length) {
        await stagger([...box.children], [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.88) rotate(-2deg)' }], { step: 30, duration: 150, easing: 'ease-in', fill: 'forwards' });
      }
      box.innerHTML = list.length
        ? list.map(tileHTML).join('')
        : '<div class="empty"><b>Aucune recette</b>Aucune recette ne coche toutes ces cases. Passe un ET en OU, ou retire un filtre.</div>';
      if (!animate) return;
      const tiles = [...box.children];
      const enter = popIn(tiles);
      stagger(box.querySelectorAll('.dish'), [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { step: 55, delay: 120, duration: 520, easing: SPRING });
      if (added) {
        const t = box.querySelector(`[data-id="${added}"]`);
        if (t) anim(t, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) rotate(-4deg)', offset: 0.3 }, { transform: 'scale(.98) rotate(2deg)', offset: 0.65 }, { transform: 'none' }], { duration: 700, delay: 380, easing: 'ease-out' });
      }
      await enter;
    },

    async filterChanged(p, { kind, label, added, el, op }) {
      const L = p.stack[0];
      const box = L.querySelector('[data-filter]');
      if (!box.hidden) {
        box.querySelectorAll(`.fchip[data-kind="${kind}"]`).forEach((c) => c.classList.toggle('on', p.state.groups[kind].on.includes(c.dataset.label)));
        roll(box.querySelector('[data-fcount]'), String(p.results().length));
      }
      if (op === undefined && !added && el.closest('[data-query]')) {
        await anim(el, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.2)', opacity: 0 }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
      }
      const pending = this.renderResults(p, { animate: true });
      const q = L.querySelector('[data-query]');
      if (op) {
        const pill = q.querySelector(`.op[data-kind="${kind}"]`);
        anim(pill, [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }], { duration: 380, easing: SPRING });
      } else if (added) {
        const chip = q.querySelector(`[data-label="${label}"]`);
        anim(chip, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'ease-out' });
      }
      await pending;
    },

    async tabSwitch(p, from, to, name) {
      const dir = name === 'folders' ? 1 : -1;
      to.hidden = false;
      moveIndicator(p, name);
      await Promise.all([
        anim(from, [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-35 * dir}%)`, opacity: 0 }], { duration: 230, easing: SNAP, fill: 'forwards' }),
        anim(to, [{ transform: `translateX(${55 * dir}%)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.15,.35,1)' }),
      ]);
      from.hidden = true;
      clearAnims(from);
      if (name === 'folders') popIn(to.querySelectorAll('.folder'));
    },

    push: {
      async default(p, from, to) {
        await anim(to, [{ transform: 'translateX(100%) rotate(3deg)' }, { transform: 'none' }], { duration: 440, easing: 'cubic-bezier(.2,1.1,.35,1)' });
      },
      async recipe(p, from, to, { src }) {
        const fromDish = src && src.querySelector('.dish');
        const hero = to.querySelector('.hero .dish');
        to.style.opacity = '0';
        const rises = to.querySelectorAll('.rise, .cookbar');
        if (src) {
          const bg = getComputedStyle(src).backgroundColor;
          const flight = p.fly(fromDish, hero, { duration: 560 });
          const ex = await p.expand(src, { background: bg, border: '2px solid #23152A', duration: 400 });
          to.style.opacity = '';
          stagger(rises, [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { step: 60, duration: 420, easing: SPRING });
          await anim(ex, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
          ex.remove();
          await flight;
        } else {
          to.style.opacity = '';
          await this.push.default(p, from, to);
        }
      },
      async cook(p, from, to) {
        await anim(to, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,1.2,.35,1)' });
        anim(to.querySelector('.prog i.on b'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 400, easing: SPRING });
      },
      async folder(p, from, to, { src }) {
        to.style.opacity = '0';
        const bg = getComputedStyle(src).backgroundColor;
        const flight = p.fly(src.querySelector('.dish'), to.querySelector('.fhead .dish'), { duration: 520 });
        const ex = await p.expand(src, { background: bg, radius: '4px 20px 20px 20px', border: '2px solid #23152A', duration: 380 });
        to.style.opacity = '';
        popIn(to.querySelectorAll('.frow'), 60);
        await anim(ex, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
        ex.remove();
        await flight;
      },
      async create(p, from, to) {
        const plus = p.stack[0].querySelector('.navbar .create');
        plus.style.transform = 'rotate(135deg) scale(1.15)';
        anim(plus, [{ transform: 'none' }, { transform: 'rotate(135deg) scale(1.15)' }], { duration: 360, easing: SPRING });
        await anim(to, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 540, easing: 'cubic-bezier(.2,1.15,.35,1)' });
        popIn(to.querySelectorAll('.photo, .title, .ptype button, .prop, .blk'));
      },
    },

    pop: {
      async default(p, from, to) {
        clearAnims(to);
        await anim(from, [{ transform: 'none' }, { transform: 'translateX(100%) rotate(3deg)' }], { duration: 300, easing: 'cubic-bezier(.5,-.25,.7,.5)', fill: 'forwards' });
      },
      async recipe(p, from, to) {
        clearAnims(to);
        await Promise.all([
          anim(from, [{ transform: 'none' }, { transform: 'translateY(105%) rotate(4deg)' }], { duration: 380, easing: 'cubic-bezier(.5,-.3,.7,.5)', fill: 'forwards' }),
          anim(to, [{ transform: 'scale(.96)' }, { transform: 'none' }], { duration: 420, delay: 120, easing: SPRING }),
        ]);
      },
      async cook(p, from) {
        await anim(from, [{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' });
      },
      async create(p, from, to, info) {
        const plus = p.stack[0].querySelector('.navbar .create');
        plus.style.transform = '';
        anim(plus, [{ transform: 'rotate(135deg) scale(1.15)' }, { transform: 'none' }], { duration: 420, easing: SPRING });
        const stamp = p.fx.querySelector('.stamp');
        const ease = info.saved ? 'cubic-bezier(.5,-.3,.7,.5)' : 'ease-in';
        await Promise.all([
          anim(from, [{ transform: 'none' }, { transform: info.saved ? 'translateY(110%) rotate(-5deg)' : 'translateY(100%)' }], { duration: info.saved ? 420 : 320, easing: ease, fill: 'forwards' }),
          stamp && anim(stamp, [{ transform: 'none' }, { transform: 'translateY(560px) rotate(-12deg)' }], { duration: 420, easing: ease, fill: 'forwards' }),
        ]);
        if (stamp) stamp.remove();
      },
    },

    async showStep(p, r, i) {
      const L = p.top;
      const stage = L.querySelector('[data-stage]');
      const old = stage.querySelector('[data-card]');
      const card = h(stepCard(r, i));
      stage.append(card);
      roll(L.querySelector('[data-stepn]'), String(i + 1));
      const seg = L.querySelectorAll('.prog i')[i];
      seg.classList.add('on');
      anim(seg.querySelector('b'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 420, easing: SPRING });
      if (i === r.steps.length - 1) roll(L.querySelector('[data-nextlabel]'), 'Terminer');
      await Promise.all([
        anim(old, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-115%) rotate(-12deg)', opacity: 0.4 }], { duration: 360, easing: SNAP, fill: 'forwards' }),
        anim(card, [{ transform: 'translateX(70%) rotate(8deg) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 80, easing: 'cubic-bezier(.2,1.25,.35,1)' }),
      ]);
      old.remove();
    },

    async showDone(p, r) {
      const L = p.top;
      const stage = L.querySelector('[data-stage]');
      const old = stage.querySelector('[data-card]');
      const card = h(`<article class="scard done" data-card><div class="sn display">C’est prêt</div><h2 class="display">Bon appétit !</h2>${r.img ? `<img class="dish" src="${IMG(r.img)}" alt="">` : ''}</article>`);
      stage.append(card);
      const btn = L.querySelector('.next');
      btn.dataset.act = 'back';
      roll(L.querySelector('[data-nextlabel]'), 'Fermer');
      await Promise.all([
        anim(old, [{ transform: 'none' }, { transform: 'translateY(-120%) rotate(-8deg)' }], { duration: 360, easing: SNAP, fill: 'forwards' }),
        anim(card, [{ transform: 'scale(.6) rotate(-6deg)', opacity: 0 }, { transform: 'scale(1.05) rotate(1deg)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 560, delay: 100, easing: 'ease-out' }),
      ]);
      old.remove();
      anim(card.querySelector('.dish'), [{ transform: 'translateY(60px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: SPRING });
    },

    ingredientRow([n, u]) {
      return h(`<div class="row"><span class="dot"></span><b>${qtyText(n, u, 1)}</b><span data-label></span></div>`);
    },
    rowIn(p, row) {
      return anim(row, [{ opacity: 0, transform: 'translateX(-24px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: SPRING });
    },

    async invalid(p, title) {
      const hint = p.top.querySelector('[data-hint]');
      hint.classList.add('err');
      roll(hint, 'Donne un nom à ta recette pour l’enregistrer.');
      await p.shake(title);
    },

    async saved(p) {
      const stamp = h('<div class="stamp display">Enregistré !</div>');
      p.fx.append(stamp);
      await anim(stamp, [{ transform: 'scale(2.6) rotate(-24deg)', opacity: 0 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.5,0,.75,0)' });
      anim(p.top, [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }], { duration: 260 });
      await p.wait(650).catch(() => {});
    },

    async demo(p) {
      p.say('Accueil : tes derniers ajouts, filtrés en « Végé ET (Entrée OU Plat) ».');
      await p.wait(1800);
      p.say('Tri A–Z : la grille se recompose.');
      await p.tap('[data-sort="az"]', { after: 1100 });
      await p.tap('[data-sort="recent"]', { after: 900 });
      p.say('Une touche sur un filtre le retire.');
      await p.tap('[data-query] [data-label="Entrée"]', { after: 1100 });
      p.say('Le bouton réglages ouvre tous les critères.');
      await p.tap('[data-act="openFilter"]', { after: 500 });
      await p.tap('.fpanel [data-label="Entrée"]', { after: 500 });
      await p.tap('.fpanel [data-label="Four"]', { after: 700 });
      await p.tap('.fgo', { after: 700 });
      p.say('Touche OU pour le passer en ET : plus aucun plat n’est à la fois entrée et plat.');
      await p.tap('[data-query] .op[data-kind="type"]', { after: 1500 });
      await p.tap('[data-query] .op[data-kind="type"]', { after: 1000 });
      p.say('Une recette s’ouvre en plein écran, la photo s’envole avec.');
      await p.tap('.tile[data-id="pizza"]', { after: 1100 });
      p.say('Portions : les quantités se recalculent.');
      await p.tap('[data-act="serves"][data-d="1"]', { after: 450 });
      await p.tap('[data-act="serves"][data-d="1"]', { after: 800 });
      p.say('On coche ce qu’on a déjà sorti.');
      await p.tap('.ings li:nth-child(1)', { after: 350 });
      await p.tap('.ings li:nth-child(3)', { after: 700 });
      p.say('Mode cuisine : une étape à la fois, en grand.');
      await p.tap('[data-act="cook"]', { after: 900 });
      await p.tap('[data-act="nextStep"]', { after: 700 });
      await p.tap('[data-act="nextStep"]', { after: 700 });
      await p.tap('[data-act="nextStep"]', { after: 700 });
      p.say('Un minuteur se lance d’une touche.');
      await p.tap('[data-act="timer"]', { after: 2600 });
      await p.tap('[data-act="nextStep"]', { after: 1600 });
      await p.tap('.next', { after: 600 });
      await p.tap('[data-act="back"]', { after: 800 });
      p.say('Dossiers : chaque dossier s’ouvre comme une chemise.');
      await p.tap('[data-tab="folders"]', { after: 900 });
      await p.tap('[data-act="openFolder"][data-id="soirs"]', { after: 1300 });
      await p.tap('[data-act="back"]', { after: 600 });
      await p.tap('[data-tab="home"]', { after: 700 });
      p.say('Le + ouvre une page vierge, façon Notion.');
      await p.tap('[data-act="openCreate"]', { after: 800 });
      p.say('Ajoute une photo : le plat est détouré automatiquement.');
      await p.tap('.photo', { after: 700 });
      await p.type('[data-title]', 'Salade de courgettes');
      await p.tap('[data-pick="type"][data-value="Entrée"]', { after: 400 });
      await p.tap('[data-pick="diet"][data-value="Végé"]', { after: 250 });
      await p.tap('[data-pick="diet"][data-value="Sans gluten"]', { after: 250 });
      await p.tap('[data-pick="tool"][data-value="Four"]', { after: 500 });
      p.say('Les gros blocs colorés ajoutent du contenu.');
      await p.tap('[data-act="addIngredient"]', { after: 200 });
      await p.tap('[data-act="addIngredient"]', { after: 200 });
      await p.tap('[data-act="addIngredient"]', { after: 600 });
      p.say('Enregistrer : la recette arrive en tête de l’accueil.');
      await p.tap('[data-act="save"]', { after: 2400 });
    },
  };
})();
