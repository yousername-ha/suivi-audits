/* global window, document, matchMedia, innerWidth, innerHeight */
/* Maquette en mémoire : aucune requête API, aucune écriture hors de ce document. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const data = structuredClone(window.PROCESSUS_STUDIO);
  const labels = {
    objectifs: 'Objectifs',
    indicateurs: 'Indicateurs',
    swots: 'SWOT',
    risques: 'Risques',
    fournisseurs: 'Fournisseurs',
  };
  const E = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const flat = (v) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  const icons = {
    tree: '<rect x="9" y="2" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    play: '<path d="m7 4 14 8-14 8z"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    cycle: '<path d="M3 10a9 9 0 0 1 16-5M21 14a9 9 0 0 1-16 5M19 1v5h-5M5 23v-5h5"/>',
  };
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || icons.tree}</svg>`;
  const state = {
    view: 'cards',
    open: new Set(),
    selected: null,
    relation: 'objectifs',
    readonly: false,
    paused: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  let popup = null,
    lastTrigger = null,
    timer;
  function notify(message) {
    $('#notice').textContent = message;
    $('#notice').hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => ($('#notice').hidden = true), 3000);
  }
  const typeOf = (p) => data.types.find((t) => t.code === p.family);
  const typeLabel = (p) => typeOf(p)?.label || p.family || 'Sans type';
  const children = (p) => data.processus.filter((c) => c.parent === p.id);
  const choices = (value, label, current) =>
    `<option value="${E(value)}"${value === current ? ' selected' : ''}>${E(label)}</option>`;
  function hydrate() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
      el.removeAttribute('data-icon');
    });
  }
  function counters(p) {
    return `<span class="pr-counts">${Object.entries(labels)
      .map(([key, label]) => {
        const list = p.rattaches[key];
        return `<span data-filled="${!!list?.length}" title="${E(label)}${list === null ? ' : accès non disponible' : ''}">${E(label)} <b>${list === null ? '—' : (list?.length ?? 0)}</b></span>`;
      })
      .join('')}</span>`;
  }
  function card(p) {
    const expanded = state.open.has(p.id),
      kids = children(p);
    return `<article class="pr-card" data-id="${E(p.id)}"><button type="button" class="pr-card-open" data-read="${E(p.id)}"><span class="pr-card-header"><span class="pr-card-glyph">${icon('cycle')}</span><span class="pr-code">${E(p.id)}</span><span>${kids.length ? `${kids.length} sous-processus` : p.parent ? 'Sous-processus' : 'Processus'}</span></span><strong>${E(p.name)}</strong><span class="pr-pilot">${icon('user')}${E(p.owner || 'Pilote non renseigné')}</span>${counters(p)}</button>${expanded ? `<div class="pr-inline" id="inline-${E(p.id)}"><p>${E(p.purpose || 'Finalité non renseignée')}</p>${p.parent ? `<small>Parent : ${E(data.processus.find((x) => x.id === p.parent)?.name || p.parent)}</small>` : ''}${kids.length ? `<div class="pr-children">${kids.map((k) => `<button type="button" class="pr-child" data-read="${E(k.id)}"><span>${E(k.id)}</span>${E(k.name)}</button>`).join('')}</div>` : '<small>Aucun sous-processus enregistré.</small>'}</div>` : ''}<div class="pr-card-foot"><button type="button" class="pr-expand" data-expand="${E(p.id)}" aria-expanded="${expanded}" aria-label="${expanded ? 'Replier' : 'Déplier'} ${E(p.name)}" ${expanded ? `aria-controls="inline-${E(p.id)}"` : ''}>${expanded ? '−' : '+'}</button></div></article>`;
  }
  const rows = (items) =>
    `<div class="pr-list"><div class="pr-list-head" aria-hidden="true"><span>Processus</span><span>Type</span><span>Pilote</span><span>Rattachements</span><span></span></div>${items.map((p) => `<button type="button" class="pr-row" data-read="${E(p.id)}" data-tone="${E(typeOf(p)?.tint || 'bleu')}"><span><strong>${E(p.name)}</strong><small>${E(p.id)}${p.parent ? ' · sous-processus' : ''}</small></span><span>${E(typeLabel(p))}</span><span>${E(p.owner || 'Non renseigné')}</span>${counters(p)}<span aria-hidden="true">↗</span></button>`).join('')}</div>`;
  function filtered() {
    const q = flat($('#query').value),
      family = $('#family').value,
      owner = $('#owner').value,
      relation = $('#relation').value;
    return data.processus.filter(
      (p) =>
        (!q || flat([p.id, p.name, p.owner, p.purpose, typeLabel(p)].join(' ')).includes(q)) &&
        (!family || (p.family || '__sans_type__') === family) &&
        (!owner || p.owner === owner) &&
        (!relation || p.rattaches[relation]?.length),
    );
  }
  function render() {
    const items = filtered();
    const roots = items.filter((p) => !p.parent || !items.some((x) => x.id === p.parent));
    const groups = [...new Set([...data.types.map((t) => t.code), ...roots.map((p) => p.family)])]
      .map((code) => ({
        code,
        type: data.types.find((t) => t.code === code),
        items: roots.filter((p) => p.family === code),
      }))
      .filter((g) => g.items.length);
    $('#content').innerHTML = !items.length
      ? '<div class="pr-empty"><h2>Aucun processus dans cette vue</h2><p>Adaptez les critères pour retrouver les activités du périmètre.</p><button type="button" class="button" data-reset>Réinitialiser les filtres</button></div>'
      : state.view === 'list'
        ? rows(items)
        : `<div class="pr-board">${groups.map((g) => `<section class="pr-lane" data-tone="${E(g.type?.tint || 'bleu')}" aria-labelledby="type-${E(g.code || 'sans-type')}"><header class="pr-lane-header">${icon('tree')}<h2 id="type-${E(g.code || 'sans-type')}">${E(g.type?.label || g.code || 'Sans type')}${g.type?.archived ? ' · archivé' : ''}</h2><span>${g.items.length}</span></header><p class="pr-lane-description">${E(g.type?.description || 'Processus de ce type')}</p><div class="pr-cards">${g.items.map(card).join('')}</div></section>`).join('')}</div>`;
    $('#result').textContent =
      `${items.length} processus affiché${items.length > 1 ? 's' : ''} sur ${data.processus.length}`;
    const fields = [
      ['query', 'Recherche : ' + $('#query').value],
      ['family', $('#family').selectedOptions[0].textContent],
      ['owner', $('#owner').selectedOptions[0].textContent],
      ['relation', $('#relation').selectedOptions[0].textContent],
    ].filter(([id]) => $('#' + id).value);
    $('#chips').hidden = !fields.length;
    $('#chips').innerHTML =
      fields
        .map(
          ([id, label]) =>
            `<button type="button" data-remove="${id}" aria-label="Retirer ${E(label)}">${E(label)} <span aria-hidden="true">×</span></button>`,
        )
        .join('') + (fields.length ? '<button type="button" data-reset>Tout effacer</button>' : '');
    $('#filter-count').hidden = !fields.length;
    $('#filter-count').textContent = fields.length;
    document
      .querySelectorAll('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('#view-label').textContent = state.view === 'cards' ? 'Vue par type' : 'Liste compacte';
    $('#summary').innerHTML =
      `<span><b>${data.processus.length}</b> processus</span><span><b>${new Set(data.processus.map((p) => p.family).filter(Boolean)).size}</b> types utilisés</span><span><b>${data.processus.filter((p) => p.owner).length}</b> pilotes renseignés</span>`;
    $('#create').hidden = state.readonly;
  }
  function reset() {
    ['query', 'family', 'owner', 'relation'].forEach((id) => ($('#' + id).value = ''));
    render();
  }
  function positionPopup() {
    if (!popup) return;
    const trigger = $('#' + (popup.id === 'search-box' ? 'search-toggle' : 'filter-toggle')),
      r = trigger.getBoundingClientRect();
    popup.style.left = Math.max(14, Math.min(innerWidth - popup.offsetWidth - 14, r.right - popup.offsetWidth)) + 'px';
    popup.style.top = Math.max(14, Math.min(innerHeight - popup.offsetHeight - 14, r.bottom + 8)) + 'px';
  }
  function closePopup(focus = false) {
    if (!popup) return;
    const trigger = $('#' + (popup.id === 'search-box' ? 'search-toggle' : 'filter-toggle'));
    popup.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    popup = null;
    if (focus) trigger.focus({ preventScroll: true });
  }
  function togglePopup(id) {
    if (popup?.id === id) return closePopup(true);
    closePopup();
    popup = $('#' + id);
    popup.hidden = false;
    $('#' + (id === 'search-box' ? 'search-toggle' : 'filter-toggle')).setAttribute('aria-expanded', 'true');
    positionPopup();
    popup.querySelector('input,select,button')?.focus();
  }
  function openDialog(html, trigger) {
    closePopup();
    if (trigger) lastTrigger = trigger;
    $('#detail-content').innerHTML = html;
    if (!$('#detail').open) $('#detail').showModal();
    $('#detail').querySelector('button,input')?.focus();
  }
  function closeDialog() {
    $('#detail').close();
    state.selected = null;
    if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
  }
  function read(id, trigger) {
    const p = data.processus.find((x) => x.id === id);
    if (!p) return;
    state.selected = id;
    const list = p.rattaches[state.relation],
      parent = data.processus.find((x) => x.id === p.parent),
      kids = children(p);
    openDialog(
      `<header class="pr-detail-head"><div><span class="pr-kicker">Fiche processus · ${E(p.id)}</span><h2 id="detail-title">${E(p.name)}</h2><p>${E(typeLabel(p))}${typeOf(p)?.archived ? ' · type archivé' : ''}</p></div><button type="button" class="pr-tool" data-close-dialog aria-label="Fermer la fiche">×</button></header><div class="pr-detail-body"><section class="pr-detail-identity" aria-labelledby="identity-title"><h3 id="identity-title">Finalité du processus</h3><p>${E(p.purpose || 'Finalité non renseignée')}</p><dl><div><dt>Pilote</dt><dd>${E(p.owner || 'Non renseigné')}</dd></div><div><dt>Rattachement hiérarchique</dt><dd>${E(parent?.name || p.parent || 'Processus de premier niveau')}</dd></div><div><dt>Sous-processus</dt><dd>${kids.length ? kids.map((k) => E(k.name)).join(' · ') : 'Aucun enregistré'}</dd></div></dl></section><section class="pr-detail-relations" aria-labelledby="relations-title"><h3 id="relations-title">Éléments rattachés</h3><div class="pr-relation-tabs" role="group" aria-label="Nature des rattachements">${Object.entries(
        labels,
      )
        .map(
          ([key, label]) =>
            `<button type="button" data-relation="${key}" aria-pressed="${state.relation === key}">${label} ${p.rattaches[key] === null ? '—' : (p.rattaches[key]?.length ?? 0)}</button>`,
        )
        .join(
          '',
        )}</div>${list === null ? '<p class="pr-rel-empty">Accès à cette catégorie non disponible.</p>' : list?.length ? list.map((r) => `<article class="pr-related"><strong>${E(r.name)}</strong><small>${E(r.id)} · ${r.via === 'objectif' ? 'Depuis un objectif' : r.via === 'fiche' ? 'Depuis la fiche d’origine' : 'Lien transverse'}${r.via === 'lien' ? '' : ' · gestion dans sa source'}</small></article>`).join('') : `<p class="pr-rel-empty">Aucun élément rattaché dans cette catégorie.</p>`}</section></div><footer class="pr-detail-footer"><span>Consultation · Données fictives</span><div><button type="button" class="button" data-close-dialog>Fermer</button>${state.readonly ? '' : `<button type="button" class="button primary" data-edit="${E(id)}">Modifier le processus</button>`}</div></footer>`,
      trigger,
    );
  }
  function editor(id = '', trigger) {
    if (state.readonly) return;
    const p = data.processus.find((x) => x.id === id) || {
      id: '',
      name: '',
      family: data.types.find((t) => !t.archived)?.code || '',
      parent: '',
      owner: '',
      purpose: '',
    };
    const descendant = (candidate) => {
      const seen = new Set([candidate.id]);
      let parent = candidate.parent;
      while (parent) {
        if (parent === id) return true;
        if (seen.has(parent)) return true;
        seen.add(parent);
        parent = data.processus.find((x) => x.id === parent)?.parent;
      }
      return false;
    };
    openDialog(
      `<header class="pr-detail-head"><div><span class="pr-kicker">${id ? 'Modification' : 'Création'} · Maquette</span><h2 id="detail-title">${id ? 'Modifier le processus' : 'Nouveau processus'}</h2></div><button type="button" class="pr-tool" data-close-dialog aria-label="Fermer la fiche">×</button></header><form class="pr-form" id="edit-form" data-id="${E(id)}"><label class="wide">Intitulé<input name="name" required value="${E(p.name)}"></label><label>Type<select name="family">${choices('', 'Sans type', p.family)}${data.types
        .filter((t) => !t.archived || t.code === p.family)
        .map((t) => choices(t.code, t.label + (t.archived ? ' · archivé' : ''), p.family))
        .join(
          '',
        )}</select></label><label>Processus parent<select name="parent">${choices('', 'Premier niveau', p.parent)}${data.processus
        .filter((x) => x.id !== id && !descendant(x))
        .map((x) => choices(x.id, x.name, p.parent))
        .join(
          '',
        )}</select></label><label class="wide">Pilote<input name="owner" value="${E(p.owner)}"></label><label class="wide">Finalité<textarea name="purpose">${E(p.purpose)}</textarea></label><footer class="pr-detail-footer"><span>Modifications limitées à cet aperçu</span><div><button type="button" class="button" ${id ? `data-read="${E(id)}"` : 'data-close-dialog'}>Annuler</button><button type="submit" class="button primary">Enregistrer l’aperçu</button></div></footer></form>`,
      trigger,
    );
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.view) {
      state.view = b.dataset.view;
      render();
    } else if (b.dataset.read) {
      const s = window.getSelection();
      if (s?.toString().trim() && b.contains(s.anchorNode)) return;
      read(b.dataset.read, $('#detail').open ? null : b);
    } else if (b.dataset.edit) editor(b.dataset.edit);
    else if (b.dataset.expand) {
      const id = b.dataset.expand;
      if (state.open.has(id)) state.open.delete(id);
      else state.open.add(id);
      render();
      document.querySelector(`[data-expand="${id}"]`)?.focus({ preventScroll: true });
    } else if (b.dataset.relation) {
      state.relation = b.dataset.relation;
      read(state.selected);
      document.querySelector(`[data-relation="${state.relation}"]`)?.focus({ preventScroll: true });
    } else if (b.hasAttribute('data-close-dialog')) closeDialog();
    else if (b.hasAttribute('data-close-popup')) closePopup(true);
    else if (b.hasAttribute('data-reset')) reset();
    else if (b.dataset.remove) {
      $('#' + b.dataset.remove).value = '';
      render();
      $('#filter-toggle').focus();
    }
  });
  $('#search-toggle').onclick = () => togglePopup('search-box');
  $('#filter-toggle').onclick = () => togglePopup('filter-box');
  $('#query').addEventListener('input', render);
  ['family', 'owner', 'relation'].forEach((id) => $('#' + id).addEventListener('change', render));
  $('#create').onclick = (e) => editor('', e.currentTarget);
  $('#theme').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme').textContent = dark ? 'Mode clair' : 'Mode sombre';
  };
  function motion() {
    document.documentElement.dataset.motion = state.paused ? 'off' : 'on';
    $('#motion-toggle').innerHTML = icon(state.paused ? 'play' : 'pause');
    $('#motion-toggle').setAttribute('aria-label', state.paused ? 'Reprendre les animations' : 'Pause animations');
    $('#motion-toggle').title = state.paused ? 'Reprendre les animations' : 'Pause animations';
  }
  $('#motion-toggle').onclick = () => {
    state.paused = !state.paused;
    motion();
  };
  $('#detail').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog();
  });
  $('#detail').addEventListener('click', (e) => {
    if (e.target === $('#detail')) {
      const b = $('#detail').getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) closeDialog();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (popup && !popup.contains(e.target) && !e.target.closest('#search-toggle,#filter-toggle')) closePopup();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup) {
      e.preventDefault();
      e.stopPropagation();
      closePopup(true);
    } else if (e.key === '/' && !e.target.closest('input,textarea,select') && !$('#detail').open) {
      e.preventDefault();
      if (popup?.id !== 'search-box') togglePopup('search-box');
      $('#query').focus();
    }
  });
  $('#edit-form')?.addEventListener('submit', (e) => e.preventDefault());
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'edit-form') return;
    e.preventDefault();
    if (state.readonly) return;
    const form = e.target,
      id = form.dataset.id,
      p = data.processus.find((x) => x.id === id),
      values = Object.fromEntries(new FormData(form));
    if (!values.name?.trim()) return;
    if (p) Object.assign(p, values);
    else
      data.processus.push({
        id: 'PR-DEMO-' + (data.processus.length + 1),
        ref: 'maquette:processus:' + data.processus.length,
        ...values,
        rattaches: Object.fromEntries(Object.keys(labels).map((k) => [k, []])),
      });
    const savedId = p?.id || data.processus.at(-1).id;
    closeDialog();
    populate();
    render();
    [...document.querySelectorAll('.pr-card-open,.pr-row')]
      .find((button) => button.dataset.read === savedId)
      ?.focus({ preventScroll: true });
    notify('Aperçu mis à jour dans cette maquette.');
  });
  function populate() {
    for (const [id, items] of [
      [
        'family',
        [
          ...data.types.map((t) => [t.code, t.label + (t.archived ? ' · archivé' : '')]),
          ['__sans_type__', 'Sans type'],
        ],
      ],
      ['owner', [...new Set(data.processus.map((p) => p.owner).filter(Boolean))].sort().map((v) => [v, v])],
      ['relation', Object.entries(labels)],
    ]) {
      const select = $('#' + id),
        value = select.value;
      select.querySelectorAll('option:not(:first-child)').forEach((el) => el.remove());
      select.insertAdjacentHTML('beforeend', items.map(([v, l]) => choices(v, l, value)).join(''));
    }
  }
  window.addEventListener('resize', positionPopup);
  const params = new URLSearchParams(window.location.search);
  if (params.get('theme') === 'light') document.documentElement.dataset.theme = 'light';
  $('#theme').textContent = document.documentElement.dataset.theme === 'dark' ? 'Mode clair' : 'Mode sombre';
  if (params.get('lecture') === '1') state.readonly = true;
  $('#scope-name').textContent = data.scope;
  hydrate();
  populate();
  render();
  motion();
  window.PROCESSUS_APERCU = {
    snapshot: () => structuredClone(data),
    setReadonly: (value) => {
      state.readonly = !!value;
      render();
    },
    setData: (value) => {
      Object.assign(data, structuredClone(value));
      populate();
      render();
    },
  };
})();
