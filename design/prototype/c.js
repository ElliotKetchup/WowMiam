/* Style C — Émail: templates and choreography. */
'use strict';

const STYLE_C = (() => {
  const EMPH = 'cubic-bezier(.2,0,0,1)';
  const DECEL = 'cubic-bezier(.05,.7,.1,1)';
  const ACCEL = 'cubic-bezier(.3,0,.8,.15)';
  const SOFT = 'cubic-bezier(.3,1.25,.5,1)';
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const WIZ_STEPS = 5;
  let suggestTab = 'tool';

  const dish = (r) => (r.img ? `<img class="dish" src="${IMG(r.img)}" alt="">` : `<span class="nophoto">${esc(r.name[0])}</span>`);
  const meta = (r) => [r.type, ...r.diets.slice(0, 1), `${r.time} min`].join(', ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const fadeIn = (els, delay = 0) => stagger(els, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { step: 40, delay, duration: 360, easing: DECEL });

  function summaryText(p) {
    const parts = Object.entries(p.state.groups).filter(([, g]) => g.on.length).map(([, g]) => g.on.join(g.op === 'OU' ? ' ou ' : ' et ').toLowerCase());
    return parts.length ? `Filtré : ${parts.join(', ')}` : 'Aucun filtre';
  }

  function groupsHTML(p) {
    const rows = Object.entries(p.state.groups).filter(([, g]) => g.on.length).map(([kind, g]) => {
      const chips = g.on.map((l) => `<button class="chip navy" data-act="toggleTag" data-kind="${kind}" data-label="${l}" data-press>${l}<i class="ms">close</i></button>`);
      return `<div class="grow"><span>${KIND_LABEL[kind]}</span><div>${chips.join(`<button class="gop" data-act="toggleOp" data-kind="${kind}" data-press><span>${g.op}</span></button>`)}</div></div>`;
    });
    return rows.length ? rows.join('<p class="gand">et</p>') : '<p class="none">Aucun filtre. Choisis ci-dessous ce que tu veux.</p>';
  }

  function suggHTML(p) {
    const left = CATALOG[suggestTab].filter((l) => !p.state.groups[suggestTab].on.includes(l));
    return left.length
      ? left.map((l) => `<button class="chip out" data-act="toggleTag" data-kind="${suggestTab}" data-label="${l}" data-press><i class="ms">add</i>${l}</button>`).join('')
      : '<p class="done">Tout est déjà dans tes filtres.</p>';
  }

  function sheetHTML(p) {
    const n = p.results().length;
    return `<div class="scrim" data-act="closeSheet"></div>
      <section class="sheet"><div class="handle"></div>
        <div class="sh"><h2 class="display">Filtrer</h2><button data-act="clearAll" data-press>Tout effacer</button></div>
        <div class="groups" data-groups>${groupsHTML(p)}</div>
        <div class="sugg"><div class="stabs">${Object.keys(CATALOG).map((k) => `<button class="${k === suggestTab ? 'on' : ''}" data-act="suggTab" data-kind="${k}">${KIND_LABEL[k]}</button>`).join('')}<i class="ul"></i></div>
          <div class="schips" data-sugg>${suggHTML(p)}</div></div>
        <button class="go speckled st${n ? '' : ' zero'}" data-act="closeSheet" data-press><span data-gocount>${goText(n)}</span></button>
      </section>`;
  }
  const goText = (n) => (n ? `Voir ${n} recette${n > 1 ? 's' : ''}` : 'Aucune recette');

  function moveStabLine(sheet, animate) {
    const on = sheet.querySelector('.stabs button.on');
    const ul = sheet.querySelector('.stabs .ul');
    const to = { left: `${on.offsetLeft}px`, width: `${on.offsetWidth}px` };
    const from = { left: ul.style.left || to.left, width: ul.style.width || to.width };
    Object.assign(ul.style, to);
    if (animate) anim(ul, [from, to], { duration: 380, easing: EMPH });
  }

  function railHTML(list) {
    const shades = ['c0', 'c1', 'speckled'];
    return list.slice(0, 4).map((r, i) => `<article class="card st ${shades[i % 3]}" data-act="openRecipe" data-id="${r.id}" data-press>${dish(r)}<b>${esc(r.name)}</b></article>`).join('')
      || '<p class="empty">Aucune recette ne correspond. Ouvre les filtres pour élargir.</p>';
  }
  const rowHTML = (r) => `<li class="st" data-act="openRecipe" data-id="${r.id}" data-press><span class="plate sm">${dish(r)}</span><span class="txt"><b>${esc(r.name)}</b><small>${meta(r)}</small></span><i class="ms">chevron_right</i></li>`;

  function foldersHTML(p) {
    const looks = ['', 'well-butter', 'rim-speck', 'speckled', 'rim-butter'];
    return `<header class="fh"><div><h1 class="display">Mes dossiers</h1><p>Chaque dossier est une assiette</p></div><span class="fnew st" data-press><i class="ms">add</i></span></header>
      <main class="shelf">${p.state.folders.map((f, i) => {
        const ds = f.ids.map((id) => p.recipe(id)).filter((r) => r && r.img).slice(0, 2);
        return `<div class="folder" data-act="openFolder" data-id="${f.id}" data-press><div class="plate ${looks[i % looks.length]}">${ds.map((r) => `<img class="dish" src="${IMG(r.img)}" alt="">`).join('')}</div><b>${esc(f.name)}</b><small>${f.ids.length} recette${f.ids.length > 1 ? 's' : ''}</small></div>`;
      }).join('')}<div class="folder add" data-press><div class="plate"><i class="ms">add</i></div><b>Nouveau dossier</b><small>&nbsp;</small></div></main><div class="pad"></div>`;
  }

  function stepHTML(r, i) {
    const [text, min] = r.steps[i];
    return `<div class="sstep" data-card><small>Étape ${i + 1} sur ${r.steps.length}</small><p>${esc(text)}</p>
      ${min ? `<button class="ring" data-act="timer" data-min="${min}" data-press><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="54"/><circle class="prog" cx="60" cy="60" r="54" pathLength="100"/></svg><b data-left>${min}:00</b><small>Touche pour lancer</small></button>` : ''}</div>`;
  }

  /* container transform: a box morphs from the source into the full screen, changing colour */
  async function morph(p, src, { from, to = '#FFFFFF', radius = '30px', duration = 450 } = {}) {
    const a = p.rect(src);
    const o = h('<div class="expander"></div>');
    p.fx.append(o);
    await anim(o, [
      { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`, borderRadius: radius, backgroundColor: from },
      { left: '0px', top: '0px', width: '412px', height: '915px', borderRadius: '0px', backgroundColor: to },
    ], { duration, easing: EMPH, fill: 'forwards' });
    return o;
  }
  const fadeOut = async (el, duration = 160) => { await anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }); el.remove(); };

  function wizSet(p, L, step, dir) {
    L.dataset.step = String(step);
    L.querySelectorAll('.wprog i').forEach((seg, i) => { seg.className = i < step ? 'done' : i === step ? 'now' : ''; });
    roll(L.querySelector('[data-wn]'), String(step + 1), { dir });
    roll(L.querySelector('[data-cta]'), step === WIZ_STEPS - 1 ? 'Enregistrer' : 'Continuer', { dir });
    L.querySelector('.wfoot .cta').dataset.act = step === WIZ_STEPS - 1 ? 'save' : 'wizNext';
    L.querySelector('[data-wback]').style.visibility = step ? 'visible' : 'hidden';
  }

  async function wizGo(p, L, step, dir) {
    const steps = L.querySelectorAll('.wstep');
    const out = steps[Number(L.dataset.step)];
    const inn = steps[step];
    wizSet(p, L, step, dir);
    await anim(out, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-40 * dir}px)` }], { duration: 160, easing: ACCEL, fill: 'forwards' });
    out.hidden = true;
    clearAnims(out);
    inn.hidden = false;
    await anim(inn, [{ opacity: 0, transform: `translateX(${40 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 300, easing: DECEL });
  }

  return {
    rootClass: 'pc',
    cutoutOptions: { badge: 'Plat détouré' },

    screens: {
      tabs(p) {
        return h(`<div class="tabs">
          <section class="view" data-view="home"><div class="scroll">
            <header class="top"><span class="wm">wez<i>food</i></span><span class="av">E</span></header>
            <h1 class="hello display">Qu’est-ce qu’on mange ce soir ?</h1>
            <div class="search"><i class="ms">search</i>Chercher<button class="f speckled st" data-act="openSheet" data-press><i class="ms">tune</i>Filtres<b data-badge>3</b></button></div>
            <p class="summary" data-summary></p>
            <div class="lab"><span>Derniers ajouts</span><small>Glisse</small></div>
            <div class="rail" data-rail></div>
            <div class="lab"><span>Toutes les recettes</span><span class="seg"><i></i><button data-act="sort" data-sort="recent" class="on">Récents</button><button data-act="sort" data-sort="az">A–Z</button></span></div>
            <ul class="list" data-list></ul><div class="pad"></div>
          </div><div data-sheetbox hidden></div></section>
          <section class="view" data-view="folders" hidden><div class="scroll" data-folders></div></section>
          <nav class="navbar">
            <button class="tab on" data-act="tab" data-tab="home" data-press><span class="pill"><i class="ms">home</i></span>Accueil</button>
            <button class="create speckled" data-act="openCreate" data-press aria-label="Nouvelle recette"><i class="ms">add</i></button>
            <button class="tab" data-act="tab" data-tab="folders" data-press><span class="pill"><i class="ms">folder</i></span>Dossiers</button>
          </nav></div>`);
      },

      recipe(p, { id }) {
        const r = p.recipe(id);
        const f = p.servesOf(r) / r.serves;
        return h(`<div class="recipe"><div class="scroll">
          <header class="rbar"><button class="circ st" data-act="back" data-press aria-label="Retour"><i class="ms">arrow_back</i></button><span class="circ st" data-press><i class="ms">more_horiz</i></span></header>
          <div class="rhero"><span class="plate">${dish(r)}</span></div>
          <h1 class="rtitle display ft">${esc(r.name)}</h1>
          <div class="rtags ft">${[r.type, ...r.diets, `${r.time} min`].map((t) => `<span class="chip soft">${t}</span>`).join('')}</div>
          <p class="rnote ft">${esc(r.note)}</p>
          <div class="rtabs ft"><button class="on" data-act="rtab" data-tab="ing">Ingrédients</button><button data-act="rtab" data-tab="steps">Étapes</button><i></i></div>
          <section class="panel ft" data-panel="ing">
            <div class="servesrow"><span>Pour</span><span class="stepper"><button class="st" data-act="serves" data-id="${r.id}" data-d="-1" data-press aria-label="Moins"><i class="ms">remove</i></button><b><span data-serves>${p.servesOf(r)}</span> pers.</b><button class="st" data-act="serves" data-id="${r.id}" data-d="1" data-press aria-label="Plus"><i class="ms">add</i></button></span></div>
            <ul class="ings">${r.ingredients.map(([n, u, l]) => `<li class="st" data-act="check" data-press><span class="ck">${CHECK}</span><b data-q>${qtyText(n, u, f)}</b><span>${esc(l)}</span></li>`).join('')}</ul>
          </section>
          <section class="panel" data-panel="steps" hidden><ol class="steps">${r.steps.map(([s], i) => `<li><span class="num">${i + 1}</span><p>${esc(s)}</p></li>`).join('')}</ol></section>
          <div class="pad"></div></div>
          <div class="cookbar"><button class="cookbtn st" data-act="cook" data-id="${r.id}" data-press><i class="ms fill">skillet</i>Commencer à cuisiner</button></div></div>`);
      },

      cook(p, { id }) {
        const r = p.recipe(id);
        return h(`<div class="cook speckled" data-dark="1">
          <header class="cbar"><button class="circ st" data-act="back" data-press aria-label="Fermer"><i class="ms">close</i></button>
            <div class="dots">${r.steps.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"><b></b></i>`).join('')}</div></header>
          <div class="stage" data-stage>${stepHTML(r, 0)}</div>
          <div class="cfoot"><span>${esc(r.name)}</span><button class="next st" data-act="nextStep" data-press><span data-nextlabel>Suivant</span><i class="ms">arrow_forward</i></button></div></div>`);
      },

      folder(p, { id }) {
        const f = p.folder(id);
        const recipes = f.ids.map((rid) => p.recipe(rid)).filter(Boolean);
        const lead = recipes.find((r) => r.img);
        return h(`<div class="folderpage"><div class="scroll">
          <header class="rbar"><button class="circ st" data-act="back" data-press aria-label="Retour"><i class="ms">arrow_back</i></button></header>
          <div class="fhero"><span class="plate">${lead ? `<img class="dish" src="${IMG(lead.img)}" alt="">` : ''}</span></div>
          <h1 class="ftitle display ft">${esc(f.name)}</h1><p class="fcount ft">${recipes.length} recette${recipes.length > 1 ? 's' : ''}</p>
          <ul class="list ft">${recipes.map(rowHTML).join('')}</ul><div class="pad"></div></div></div>`);
      },

      create() {
        const pick = (key, values) => values.map((v) => `<button class="st" data-act="pick" data-pick="${key}" data-value="${v}" data-multi="1" data-press><i class="ms">check</i>${v}</button>`).join('');
        const opt = (t, inner) => `<button class="opt st" data-act="pick" data-pick="type" data-value="${t}" data-press><span class="radio"><i class="ms">check</i></span><b>${t}</b>${inner}</button>`;
        return h(`<div class="wiz" data-step="0">
          <header class="bar"><button class="circ st" data-act="back" data-press aria-label="Fermer"><i class="ms">close</i></button>
            <div class="wprog">${Array.from({ length: WIZ_STEPS }, (_, i) => `<i class="${i === 0 ? 'now' : ''}"><b></b></i>`).join('')}</div><span class="n"><span data-wn>1</span>/${WIZ_STEPS}</span></header>
          <section class="wstep"><p class="k">Étape 1</p><h1 class="display">Commence par une photo</h1><p class="sub">Elle sera détourée pour que ton plat ressorte.</p>
            <button class="photoplate" data-act="addPhoto" data-press><span class="ph-empty"><i class="ms">add_a_photo</i>Ajouter une photo</span></button></section>
          <section class="wstep" hidden><p class="k">Étape 2</p><h1 class="display">Comment s’appelle-t-elle ?</h1>
            <div class="tline"><input data-title placeholder="Nom de la recette" autocomplete="off" aria-label="Nom de la recette"></div><p class="whint" data-hint>Un nom que tu reconnaîtras dans six mois.</p></section>
          <section class="wstep" hidden><p class="k">Étape 3</p><h1 class="display">C’est quel type de plat ?</h1>
            <div class="opts">${opt('Entrée', `<img class="dish" src="${IMG('salade-verte')}" alt="">`)}${opt('Plat', `<img class="dish" src="${IMG('aubergines-pizza')}" alt="">`)}${opt('Dessert', '<span class="nodish"><i class="ms">cake</i></span>')}</div></section>
          <section class="wstep" hidden><p class="k">Étape 4</p><h1 class="display">Pour qui, et avec quoi ?</h1>
            <div class="pickgroup"><p>Régime</p><div>${pick('diet', CATALOG.diet)}</div></div>
            <div class="pickgroup"><p>Ustensiles</p><div>${pick('tool', CATALOG.tool)}</div></div></section>
          <section class="wstep" hidden><p class="k">Étape 5</p><h1 class="display">Les ingrédients</h1><p class="sub">Tu pourras ajouter les étapes plus tard.</p>
            <div class="irows" data-ingredients></div><button class="addrow st" data-act="addIngredient" data-press><i class="ms">add</i>Ajouter un ingrédient</button></section>
          <footer class="wfoot"><button class="ghost-btn" data-act="wizBack" data-wback style="visibility:hidden">Retour</button>
            <button class="cta st" data-act="wizNext" data-press><span data-cta>Continuer</span><i class="ms">arrow_forward</i></button></footer></div>`);
      },
    },

    actions: {
      openSheet() {
        return this.run(async () => {
          const box = this.stack[0].querySelector('[data-sheetbox]');
          box.innerHTML = sheetHTML(this);
          box.hidden = false;
          moveStabLine(box, false);
          anim(box.querySelector('.scrim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
          await anim(box.querySelector('.sheet'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 520, easing: SOFT });
        });
      },
      closeSheet() {
        return this.run(async () => {
          const box = this.stack[0].querySelector('[data-sheetbox]');
          await Promise.all([
            anim(box.querySelector('.sheet'), [{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 260, easing: ACCEL, fill: 'forwards' }),
            anim(box.querySelector('.scrim'), [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }),
          ]);
          box.hidden = true;
          box.innerHTML = '';
        });
      },
      suggTab(el) {
        suggestTab = el.dataset.kind;
        const sheet = this.stack[0].querySelector('.sheet');
        sheet.querySelectorAll('.stabs button').forEach((b) => b.classList.toggle('on', b === el));
        moveStabLine(sheet, true);
        const box = sheet.querySelector('[data-sugg]');
        box.innerHTML = suggHTML(this);
        fadeIn(box.children);
      },
      clearAll() {
        Object.values(this.state.groups).forEach((g) => { g.on = []; g.op = 'OU'; });
        return this.run(() => STYLE_C.filterChanged(this, { cleared: true }));
      },
      rtab(el) {
        const L = this.top;
        if (el.classList.contains('on')) return undefined;
        return this.run(async () => {
          const toSteps = el.dataset.tab === 'steps';
          L.querySelectorAll('.rtabs button').forEach((b) => b.classList.toggle('on', b === el));
          const ind = L.querySelector('.rtabs i');
          anim(ind, [{ transform: `translateX(${toSteps ? 0 : 100}%)` }, { transform: `translateX(${toSteps ? 100 : 0}%)` }], { duration: 380, easing: EMPH });
          ind.style.transform = `translateX(${toSteps ? 100 : 0}%)`;
          const out = L.querySelector(`[data-panel="${toSteps ? 'ing' : 'steps'}"]`);
          const inn = L.querySelector(`[data-panel="${toSteps ? 'steps' : 'ing'}"]`);
          const dir = toSteps ? 1 : -1;
          await anim(out, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-30 * dir}px)` }], { duration: 140, easing: ACCEL, fill: 'forwards' });
          out.hidden = true;
          clearAnims(out);
          inn.hidden = false;
          await anim(inn, [{ opacity: 0, transform: `translateX(${30 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 280, easing: DECEL });
        });
      },
      wizNext() {
        const L = this.top;
        const step = Number(L.dataset.step);
        if (step === 1 && !L.querySelector('[data-title]').value.trim()) return this.run(() => STYLE_C.invalid(this, L.querySelector('[data-title]')));
        return this.run(() => wizGo(this, L, step + 1, 1));
      },
      wizBack() {
        const L = this.top;
        return this.run(() => wizGo(this, L, Number(L.dataset.step) - 1, -1));
      },
    },

    timerTick(p, el, left, total) {
      el.querySelector('.prog').style.strokeDashoffset = String(100 * (1 - left / total));
    },

    async renderResults(p, { animate = false, added = null } = {}) {
      const L = p.stack[0];
      const list = p.results();
      const rail = L.querySelector('[data-rail]');
      const ul = L.querySelector('[data-list]');
      const tags = p.activeTags().length;
      const seg = L.querySelector('.seg');
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.sort === p.state.sort));
      const thumb = seg.querySelector('i');
      const tx = p.state.sort === 'az' ? '100%' : '0%';
      if (animate) anim(thumb, [{ transform: thumb.style.transform || 'translateX(0%)' }, { transform: `translateX(${tx})` }], { duration: 320, easing: EMPH });
      thumb.style.transform = `translateX(${tx})`;
      const sum = L.querySelector('[data-summary]');
      if (animate) {
        roll(L.querySelector('[data-badge]'), String(tags));
        anim(sum, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).then(() => { sum.textContent = summaryText(p); clearAnims(sum); anim(sum, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); });
      } else {
        L.querySelector('[data-badge]').textContent = tags;
        sum.textContent = summaryText(p);
      }
      L.querySelector('[data-folders]').innerHTML = foldersHTML(p);
      const recent = [...list];
      if (p.state.sort === 'az') recent.sort((a, b) => p.state.recipes.indexOf(a) - p.state.recipes.indexOf(b));
      if (animate) {
        await Promise.all([
          stagger(rail.children, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { step: 20, duration: 110, easing: ACCEL, fill: 'forwards' }),
          anim(ul, [{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' }),
        ]);
      }
      rail.innerHTML = railHTML(recent);
      ul.innerHTML = list.map(rowHTML).join('');
      clearAnims(ul);
      if (!animate) return;
      if (added) {
        const card = rail.querySelector(`[data-id="${added}"]`);
        rail.scrollTo({ left: 0 });
        anim(card, [{ width: '0px', flexBasis: '0px', opacity: 0, transform: 'scale(.6)' }, { width: '156px', flexBasis: '156px', opacity: 1, transform: 'none' }], { duration: 560, delay: 100, easing: EMPH });
        fadeIn([...rail.children].filter((c) => c !== card), 160);
      } else {
        stagger(rail.children, [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { step: 50, duration: 300, easing: DECEL });
      }
      await fadeIn(ul.children, 80);
    },

    async filterChanged(p, { kind, label, added, el, op, cleared }) {
      const L = p.stack[0];
      const sheet = L.querySelector('.sheet');
      let ghost = null;
      if (sheet) {
        const groups = sheet.querySelector('[data-groups]');
        if (op) {
          await roll(el.querySelector('span'), op);
        } else if (added && el) {
          const r = p.rect(el);
          ghost = el.cloneNode(true);
          ghost.className = 'chip navy';
          ghost.innerHTML = `${label}<i class="ms">close</i>`;
          Object.assign(ghost.style, { position: 'absolute', left: `${r.x}px`, top: `${r.y}px`, margin: '0', zIndex: '6' });
          p.fx.append(ghost);
          el.style.visibility = 'hidden';
        } else if (!cleared && el) {
          await anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 160, easing: ACCEL, fill: 'forwards' });
        }
        groups.innerHTML = groupsHTML(p);
        const sugg = sheet.querySelector('[data-sugg]');
        sugg.innerHTML = suggHTML(p);
        if (ghost) {
          const target = groups.querySelector(`[data-kind="${kind}"][data-label="${label}"]`);
          const a = { x: parseFloat(ghost.style.left), y: parseFloat(ghost.style.top) };
          const b = p.rect(target);
          target.style.visibility = 'hidden';
          await anim(ghost, [{ transform: 'translate(0,0)' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)` }], { duration: 440, easing: EMPH, fill: 'forwards' });
          target.style.visibility = '';
          ghost.remove();
        } else if (!op) {
          fadeIn(groups.children);
        }
        const n = p.results().length;
        const go = sheet.querySelector('.go');
        go.classList.toggle('zero', !n);
        roll(go.querySelector('[data-gocount]'), goText(n));
      }
      await this.renderResults(p, { animate: true });
    },

    async tabSwitch(p, from, to) {
      await anim(from, [{ opacity: 1 }, { opacity: 0 }], { duration: 90, easing: ACCEL, fill: 'forwards' });
      from.hidden = true;
      clearAnims(from);
      to.hidden = false;
      await anim(to, [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: DECEL });
      if (to.dataset.view === 'folders') stagger(to.querySelectorAll('.folder .dish'), [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { step: 45, duration: 420, easing: SOFT });
    },

    push: {
      async default(p, from, to) {
        await anim(to, [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: DECEL });
      },
      async recipe(p, from, to, { src }) {
        to.style.opacity = '0';
        const fromDish = src && src.querySelector('.dish');
        const heroDish = to.querySelector('.rhero .dish');
        const bg = src ? getComputedStyle(src).backgroundColor : '#FFFFFF';
        const radius = src ? getComputedStyle(src).borderRadius : '30px';
        const flight = fromDish ? p.fly(fromDish, heroDish, { duration: 560, easing: EMPH }) : Promise.resolve();
        const o = await morph(p, src, { from: bg, radius, duration: 440 });
        to.style.opacity = '';
        const plate = to.querySelector('.rhero .plate');
        anim(plate, [{ transform: 'scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: SOFT });
        fadeIn(to.querySelectorAll('.ft, .cookbar'), 60);
        await Promise.all([fadeOut(o, 200), flight]);
      },
      async cook(p, from, to, { src }) {
        to.style.opacity = '0';
        const o = await morph(p, src, { from: '#F4D97B', to: '#1D2E6B', radius: '30px', duration: 460 });
        to.style.opacity = '';
        await fadeOut(o, 180);
        fadeIn(to.querySelectorAll('.sstep > *'), 0);
        to.querySelector('.dots i.on b').style.transform = '';
      },
      async folder(p, from, to, { src }) {
        to.style.opacity = '0';
        const plate = src.querySelector('.plate');
        const fromDish = plate.querySelector('.dish');
        const flight = fromDish ? p.fly(fromDish, to.querySelector('.fhero .dish'), { duration: 520, easing: EMPH }) : Promise.resolve();
        const o = await morph(p, plate, { from: '#FFFFFF', radius: '50%', duration: 460 });
        to.style.opacity = '';
        fadeIn(to.querySelectorAll('.ft, .list li'), 60);
        await Promise.all([fadeOut(o, 200), flight]);
      },
      async create(p, from, to, { src }) {
        to.style.opacity = '0';
        const o = await morph(p, src, { from: '#1D2E6B', radius: '50%', duration: 480 });
        to.style.opacity = '';
        await fadeOut(o, 220);
        fadeIn(to.querySelectorAll('.wstep:not([hidden]) > *, .wfoot'));
      },
    },

    pop: {
      async default(p, from, to) {
        clearAnims(to);
        await anim(from, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 220, easing: ACCEL, fill: 'forwards' });
      },
      async cook(p, from) {
        await anim(from, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40px)' }], { duration: 240, easing: ACCEL, fill: 'forwards' });
      },
      async create(p, from) {
        await anim(from, [{ opacity: 1, transform: 'none', borderRadius: '0px' }, { opacity: 0, transform: 'scale(.15) translateY(1500px)', borderRadius: '400px' }], { duration: 420, easing: ACCEL, fill: 'forwards' });
      },
    },

    async showStep(p, r, i) {
      const L = p.top;
      const stage = L.querySelector('[data-stage]');
      const old = stage.querySelector('[data-card]');
      L.querySelectorAll('.dots i')[i].classList.add('on');
      if (i === r.steps.length - 1) roll(L.querySelector('[data-nextlabel]'), 'Terminer');
      await anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 160, easing: ACCEL, fill: 'forwards' });
      old.remove();
      const card = h(stepHTML(r, i));
      stage.append(card);
      await anim(card, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: DECEL });
    },

    async showDone(p, r) {
      const L = p.top;
      const stage = L.querySelector('[data-stage]');
      const old = stage.querySelector('[data-card]');
      await anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      old.remove();
      const card = h(`<div class="sstep" data-card><small>C’est prêt</small><p>Bon appétit !</p><span class="plate doneplate">${dish(r)}</span></div>`);
      stage.append(card);
      L.querySelector('.next').dataset.act = 'back';
      roll(L.querySelector('[data-nextlabel]'), 'Fermer');
      fadeIn(card.querySelectorAll('small, p'));
      const plate = card.querySelector('.plate');
      await anim(plate, [{ transform: 'translateY(80px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 640, delay: 120, easing: SOFT });
    },

    ingredientRow([n, u]) {
      return h(`<div class="row"><b>${qtyText(n, u, 1)}</b><span data-label></span></div>`);
    },
    rowIn(p, row) {
      return anim(row, [{ opacity: 0, transform: 'translateY(-8px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: DECEL });
    },

    async invalid(p, title) {
      const L = p.top;
      if (L.dataset.step !== '1') await wizGo(p, L, 1, -1);
      const hint = L.querySelector('[data-hint]');
      hint.classList.add('err');
      roll(hint, 'Il faut un nom pour continuer.');
      await p.shake(title.parentElement);
    },

    async saved(p) {
      const L = p.top;
      const ok = h(`<div class="okay"><span class="bubble"><svg viewBox="0 0 64 64"><path d="M16 33l11 11 22-24"/></svg></span><h2 class="display">Recette enregistrée</h2></div>`);
      L.append(ok);
      await anim(ok, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      anim(ok.querySelector('.bubble'), [{ transform: 'scale(.4)' }, { transform: 'none' }], { duration: 480, easing: SOFT });
      await anim(ok.querySelector('path'), [{ strokeDashoffset: 60 }, { strokeDashoffset: 0 }], { duration: 420, delay: 160, easing: EMPH, fill: 'forwards' });
      await sleep(550);
    },

    async afterSave(p, rec) {
      const snack = h(`<div class="snack"><span>Rangée dans « Salades d’été »</span><b>Voir</b></div>`);
      p.stack[0].append(snack);
      await anim(snack, [{ transform: 'translateY(140px)' }, { transform: 'none' }], { duration: 420, easing: DECEL });
      setTimeout(() => anim(snack, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(20px)' }], { duration: 250, fill: 'forwards' }).then(() => snack.remove()), 2600);
      return rec;
    },

    async demo(p) {
      p.say('Accueil : calme d’abord. Les filtres actifs tiennent en une ligne.');
      await p.wait(1800);
      p.say('« Filtres » ouvre une feuille qui monte en douceur.');
      await p.tap('[data-act="openSheet"]', { after: 700 });
      p.say('Une suggestion touchée file dans son groupe.');
      await p.tap('[data-sugg] [data-label="Four"]', { after: 900 });
      await p.tap('.stabs [data-kind="type"]', { after: 500 });
      await p.tap('[data-groups] [data-label="Entrée"]', { after: 900 });
      await p.tap('[data-sugg] [data-label="Entrée"]', { after: 900 });
      p.say('Dans un groupe, OU devient ET d’une touche. Le bouton annonce le résultat.');
      await p.tap('[data-groups] .gop[data-kind="type"]', { after: 1300 });
      await p.tap('[data-groups] .gop[data-kind="type"]', { after: 900 });
      await p.tap('.go', { after: 900 });
      p.say('La carte grandit jusqu’à devenir la fiche, le plat suit.');
      await p.tap('.card[data-id="pizza"]', { after: 1100 });
      await p.tap('[data-act="serves"][data-d="1"]', { after: 450 });
      await p.tap('[data-act="serves"][data-d="1"]', { after: 700 });
      await p.tap('.ings li:nth-child(1)', { after: 300 });
      await p.tap('.ings li:nth-child(2)', { after: 700 });
      p.say('Ingrédients et étapes sont deux onglets : on ne voit que ce qui sert.');
      await p.tap('[data-act="rtab"][data-tab="steps"]', { after: 1100 });
      await p.tap('[data-act="rtab"][data-tab="ing"]', { after: 700 });
      p.say('Mode cuisine : le bouton se déplie en plein écran.');
      await p.tap('[data-act="cook"]', { after: 900 });
      await p.tap('[data-act="nextStep"]', { after: 700 });
      await p.tap('[data-act="nextStep"]', { after: 700 });
      await p.tap('[data-act="nextStep"]', { after: 700 });
      p.say('Le minuteur se dessine en cercle.');
      await p.tap('[data-act="timer"]', { after: 3000 });
      await p.tap('[data-act="nextStep"]', { after: 1500 });
      await p.tap('.next', { after: 600 });
      await p.tap('[data-act="back"]', { after: 800 });
      p.say('Dossiers : l’assiette s’ouvre en page.');
      await p.tap('[data-tab="folders"]', { after: 900 });
      await p.tap('.folder[data-id="soirs"]', { after: 1200 });
      await p.tap('[data-act="back"]', { after: 600 });
      await p.tap('[data-tab="home"]', { after: 700 });
      p.say('Le + rond se déplie en assistant : une question par écran.');
      await p.tap('[data-act="openCreate"]', { after: 800 });
      await p.tap('.photoplate', { after: 800 });
      await p.tap('.wfoot .cta', { after: 500 });
      await p.type('[data-title]', 'Salade de courgettes');
      await p.tap('.wfoot .cta', { after: 500 });
      await p.tap('.opt[data-value="Entrée"]', { after: 600 });
      await p.tap('.wfoot .cta', { after: 500 });
      await p.tap('[data-pick="diet"][data-value="Végé"]', { after: 250 });
      await p.tap('[data-pick="diet"][data-value="Sans gluten"]', { after: 250 });
      await p.tap('[data-pick="tool"][data-value="Four"]', { after: 500 });
      await p.tap('.wfoot .cta', { after: 500 });
      await p.tap('[data-act="addIngredient"]', { after: 200 });
      await p.tap('[data-act="addIngredient"]', { after: 200 });
      await p.tap('[data-act="addIngredient"]', { after: 600 });
      p.say('Enregistrer : une coche se dessine, la recette arrive en tête.');
      await p.tap('.wfoot .cta', { after: 3200 });
    },
  };
})();
