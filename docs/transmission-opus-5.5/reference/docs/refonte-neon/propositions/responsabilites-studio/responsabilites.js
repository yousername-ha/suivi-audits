/* global window, document, matchMedia, innerWidth, innerHeight */
/* Maquette uniquement : jeu fictif figé, modifications en mémoire et aucun appel API. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s),
    data = structuredClone(window.RESPONSABILITES_STUDIO);
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
  const value = (o, key) => (typeof o.data[key] === 'string' ? o.data[key] : '');
  const filled = (o, key) => !!value(o, key).trim();
  const txt = (o, key) => value(o, key) || 'Non renseigné';
  const paths = {
    open: '<path d="M6 18 18 6M6 6h12v12"/>',
    roles:
      '<rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M4 17v-5h16v5"/><circle cx="4" cy="20" r="2.5"/><circle cx="12" cy="20" r="2.5"/><circle cx="20" cy="20" r="2.5"/>',
    person: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    mission: '<path d="M8 5h13M8 12h13M8 19h13m-18-2 2 2 3-4M3 5h.01M3 12h.01"/>',
    resources: '<path d="m12 2 10 6-10 6L2 8zM2 12l10 6 10-6M2 16l10 6 10-6"/>',
    delegation: '<path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    play: '<path d="m7 4 14 8-14 8z"/>',
  };
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.roles}</svg>`;
  const state = {
    view: 'cards',
    expanded: null,
    readonly: false,
    paused: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  let popup = null,
    lastTrigger = null,
    timer;
  function hydrate() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
      el.removeAttribute('data-icon');
    });
  }
  function notify(message) {
    $('#notice').textContent = message;
    $('#notice').hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => ($('#notice').hidden = true), 3000);
  }
  const show = (o, key) => `<strong${filled(o, key) ? '' : ' class="rr-unfilled"'}>${E(txt(o, key))}</strong>`;
  function card(o) {
    const expanded = state.expanded === o.id;
    return `<article class="rr-card" data-id="${E(o.id)}" data-expanded="${expanded}"><button type="button" class="rr-card-open" data-read="${E(o.id)}"><span class="rr-card-left"><span class="rr-card-head"><span class="rr-card-glyph">${icon('person')}</span><span>FICHE DE RÔLE · ${E(o.id)}</span><span aria-hidden="true">${icon('open')}</span></span><span class="rr-card-identity"><strong>${E(o.name)}</strong>${value(o, 'role') && flat(value(o, 'role')) !== flat(o.name) ? `<small>${E(value(o, 'role'))}</small>` : ''}</span><span class="rr-assignment"><span><small>Titulaire</small>${show(o, 'holder')}</span><span><small>Suppléant</small>${show(o, 'deputy')}</span></span></span><span class="rr-card-details"><span class="rr-mission"><span class="rr-field-label">${icon('mission')}Responsabilités</span><span${filled(o, 'responsibilities') ? '' : ' class="rr-unfilled"'}>${E(txt(o, 'responsibilities'))}</span></span><span class="rr-secondary"><span><small>${icon('resources')}Ressources et compétences</small>${show(o, 'resources')}</span><span><small>${icon('delegation')}Engagement et délégation</small>${show(o, 'commitment')}</span></span>${expanded ? `<span class="rr-contact-strip" id="contacts-${E(o.id)}"><span><small>Adresse de contact</small>${show(o, 'email')}</span><span><small>Téléphone</small>${show(o, 'phone')}</span></span>` : ''}</span></button><div class="rr-card-footer"><button type="button" class="rr-expand" data-expand="${E(o.id)}" aria-label="${expanded ? 'Replier' : 'Déplier'} ${E(o.name)}" aria-expanded="${expanded}"${expanded ? ` aria-controls="contacts-${E(o.id)}"` : ''}>${expanded ? '−' : '+'}</button></div></article>`;
  }
  function rows(items) {
    return `<div class="rr-list"><div class="rr-list-head" aria-hidden="true"><span>Rôle</span><span>Titulaire</span><span>Suppléant</span><span>Responsabilités</span><span>Engagement</span><span></span></div>${items.map((o) => `<button type="button" class="rr-row" data-read="${E(o.id)}"><span><strong>${E(o.name)}</strong><small>${E(o.id)} · ${E(value(o, 'role') || 'Rôle non renseigné')}</small></span><span${filled(o, 'holder') ? '' : ' class="rr-unfilled"'}>${E(txt(o, 'holder'))}</span><span${filled(o, 'deputy') ? '' : ' class="rr-unfilled"'}>${E(txt(o, 'deputy'))}</span><span class="rr-row-mission">${E(txt(o, 'responsibilities'))}</span><span class="rr-mini-state" data-filled="${filled(o, 'commitment')}">${filled(o, 'commitment') ? 'Renseigné' : 'Non renseigné'}</span><span aria-hidden="true">${icon('open')}</span></button>`).join('')}</div>`;
  }
  function filtered() {
    const q = flat($('#query').value),
      role = $('#role-filter').value,
      holder = $('#holder-filter').value,
      engagement = $('#commitment-filter').value;
    return data.items.filter(
      (o) =>
        (!q || flat([o.id, o.name, ...Object.values(o.data)].join(' ')).includes(q)) &&
        (!role || value(o, 'role') === role) &&
        (!holder || filled(o, 'holder') === (holder === 'filled')) &&
        (!engagement || filled(o, 'commitment') === (engagement === 'filled')),
    );
  }
  function render() {
    const items = filtered();
    const ordered = state.expanded
      ? [...items.filter((o) => o.id === state.expanded), ...items.filter((o) => o.id !== state.expanded)]
      : items;
    $('#content').innerHTML = items.length
      ? state.view === 'cards'
        ? `<div class="rr-grid">${ordered.map(card).join('')}</div>`
        : rows(items)
      : `<div class="rr-empty"><h2>Aucun rôle dans cette vue</h2><p>Adaptez les critères pour retrouver les fiches du périmètre.</p><button type="button" class="button" data-reset>Réinitialiser les filtres</button></div>`;
    $('#result').textContent =
      `${items.length} rôle${items.length > 1 ? 's' : ''} affiché${items.length > 1 ? 's' : ''} sur ${data.items.length}`;
    $('#summary').innerHTML =
      `<span><b>${data.items.length}</b> rôles</span><span><b>${data.items.filter((o) => filled(o, 'holder')).length}</b> titulaires renseignés</span><span><b>${data.items.filter((o) => filled(o, 'commitment')).length}</b> engagement${data.items.filter((o) => filled(o, 'commitment')).length > 1 ? 's' : ''} renseigné${data.items.filter((o) => filled(o, 'commitment')).length > 1 ? 's' : ''}</span>`;
    const fields = [
      ['query', 'Recherche : ' + $('#query').value],
      ['role-filter', $('#role-filter').selectedOptions[0].textContent],
      ['holder-filter', 'Titulaire : ' + $('#holder-filter').selectedOptions[0].textContent],
      ['commitment-filter', 'Engagement : ' + $('#commitment-filter').selectedOptions[0].textContent],
    ].filter(([id]) => $('#' + id).value);
    $('#chips').hidden = !fields.length;
    $('#chips').innerHTML =
      fields
        .map(
          ([id, label]) =>
            `<button type="button" data-remove="${id}" aria-label="Retirer ${E(label)}">${E(label)} ×</button>`,
        )
        .join('') + (fields.length ? '<button type="button" data-reset>Tout effacer</button>' : '');
    $('#filter-count').hidden = !fields.length;
    $('#filter-count').textContent = fields.length;
    document
      .querySelectorAll('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('#view-label').textContent = state.view === 'cards' ? 'Synthèse des rôles' : 'Liste compacte';
    $('#create').hidden = state.readonly;
  }
  function reset() {
    const trigger = document.activeElement;
    ['query', 'role-filter', 'holder-filter', 'commitment-filter'].forEach((id) => ($('#' + id).value = ''));
    render();
    if (!trigger?.isConnected) $('#filter-toggle').focus({ preventScroll: true });
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
    if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
  }
  function read(id, trigger) {
    const o = data.items.find((o) => o.id === id);
    if (!o) return;
    const panel = (key, label, symbol) =>
      `<section class="rr-detail-panel"><h3>${icon(symbol)}${label}</h3><p${filled(o, key) ? '' : ' class="rr-unfilled"'}>${E(txt(o, key))}</p></section>`;
    openDialog(
      `<header class="rr-detail-head"><div><span class="rr-kicker">Fiche de rôle · ${E(o.id)}</span><h2 id="detail-title">${E(o.name)}</h2><p>Rôle métier : ${E(value(o, 'role') || 'Non renseigné')}</p></div><button type="button" class="rr-tool" data-close-dialog aria-label="Fermer la fiche">×</button></header><div class="rr-detail-body"><section class="rr-detail-panel" data-panel="assignment"><h3>${icon('person')}Attribution et contact</h3><dl>${[
        ['holder', 'Titulaire'],
        ['deputy', 'Suppléant'],
        ['email', 'Adresse de contact'],
        ['phone', 'Téléphone'],
      ]
        .map(
          ([key, label]) =>
            `<div><dt>${label}</dt><dd${filled(o, key) ? '' : ' class="rr-unfilled"'}>${E(txt(o, key))}</dd></div>`,
        )
        .join(
          '',
        )}</dl></section>${panel('responsibilities', 'Responsabilités', 'mission')}${panel('resources', 'Ressources et compétences', 'resources')}${panel('commitment', 'Engagement et délégation', 'delegation')}</div><footer class="rr-detail-footer"><span>Consultation · Données fictives</span><div><button type="button" class="button" data-close-dialog>Fermer</button>${state.readonly ? '' : `<button type="button" class="button primary" data-edit="${E(id)}">Modifier la fiche</button>`}</div></footer>`,
      trigger,
    );
  }
  function editor(id = '', trigger) {
    if (state.readonly) return;
    const o = data.items.find((o) => o.id === id) || { id: '', name: '', data: {} };
    const field = (key, label, type = 'text', wide = false) =>
      `<label${wide ? ' class="wide"' : ''}>${label}${type === 'textarea' ? `<textarea name="${key}">${E(value(o, key))}</textarea>` : `<input name="${key}" type="${type}" value="${E(value(o, key))}">`}</label>`;
    openDialog(
      `<header class="rr-detail-head"><div><span class="rr-kicker">${id ? 'Modification' : 'Création'} · Maquette</span><h2 id="detail-title">${id ? 'Modifier la fiche' : 'Nouveau rôle'}</h2></div><button type="button" class="rr-tool" data-close-dialog aria-label="Fermer la fiche">×</button></header><form class="rr-form" id="edit-form" data-id="${E(id)}"><label class="wide">Intitulé<input name="name" required value="${E(o.name)}"></label>${field('role', 'Rôle métier', 'text', true)}${field('holder', 'Titulaire')}${field('deputy', 'Suppléant')}${field('email', 'Adresse de contact', 'email')}${field('phone', 'Téléphone', 'tel')}${field('responsibilities', 'Responsabilités', 'textarea', true)}${field('resources', 'Ressources et compétences', 'textarea')}${field('commitment', 'Engagement et délégation', 'textarea')}<footer class="rr-detail-footer"><span>Modifications limitées à cet aperçu</span><div><button type="button" class="button" ${id ? `data-read="${E(id)}"` : 'data-close-dialog'}>Annuler</button><button type="submit" class="button primary">Enregistrer l’aperçu</button></div></footer></form>`,
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
      state.expanded = state.expanded === id ? null : id;
      render();
      [...document.querySelectorAll('[data-expand]')]
        .find((x) => x.dataset.expand === id)
        ?.focus({ preventScroll: true });
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
  ['role-filter', 'holder-filter', 'commitment-filter'].forEach((id) => $('#' + id).addEventListener('change', render));
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
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'edit-form') return;
    e.preventDefault();
    if (state.readonly) return;
    const form = e.target,
      id = form.dataset.id,
      values = Object.fromEntries(new FormData(form)),
      name = values.name?.trim();
    if (!name) return;
    delete values.name;
    let o = data.items.find((o) => o.id === id);
    if (o) {
      o.name = name;
      Object.assign(o.data, values);
    } else {
      o = { id: 'RL-DEMO-' + (data.items.length + 1), ref: 'maquette:roles:' + data.items.length, name, data: values };
      data.items.push(o);
    }
    const savedId = o.id;
    closeDialog();
    populate();
    render();
    (
      [...document.querySelectorAll('.rr-card-open,.rr-row')].find((x) => x.dataset.read === savedId) ||
      $('#filter-toggle')
    ).focus({ preventScroll: true });
    notify('Aperçu mis à jour dans cette maquette.');
  });
  function populate() {
    const el = $('#role-filter'),
      current = el.value;
    el.querySelectorAll('option:not(:first-child)').forEach((x) => x.remove());
    [...new Set(data.items.map((o) => value(o, 'role')).filter(Boolean))]
      .sort()
      .forEach((v) =>
        el.insertAdjacentHTML(
          'beforeend',
          `<option value="${E(v)}"${v === current ? ' selected' : ''}>${E(v)}</option>`,
        ),
      );
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
  window.RESPONSABILITES_APERCU = {
    snapshot: () => structuredClone(data),
    setData: (value) => {
      Object.assign(data, structuredClone(value));
      state.expanded = null;
      populate();
      render();
    },
    setReadonly: (value) => {
      state.readonly = !!value;
      render();
    },
  };
})();
