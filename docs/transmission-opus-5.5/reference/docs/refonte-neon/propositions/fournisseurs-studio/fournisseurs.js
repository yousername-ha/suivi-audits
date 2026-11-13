/* global window, document, innerWidth, innerHeight */
/* Consultation autonome : données fictives figées, aucune requête ni écriture. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s),
    data = structuredClone(window.FOURNISSEURS_STUDIO);
  let density = 'compact',
    popup = null,
    returnTo = null;
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
  const paths = {
    list: '<path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01"/>',
    detail: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    box: '<path d="m12 2 10 6v10l-10 5-10-5V8zM2 8l10 5 10-5M12 13v10M7 5l10 5"/>',
    cloud: '<path d="M6 18a5 5 0 1 1 0-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 0 9z"/>',
    shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM7 12l3 3 7-7"/>',
    key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 3-3m-6 0 3-3"/>',
    open: '<path d="M6 18 18 6M6 6h12v12"/>',
  };
  const icon = (n) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n] || paths.box}</svg>`;
  const chip = (text, tone = 'neutral') =>
    `<span class="fs-chip" data-tone="${tone}">${E(text || 'Non renseigné')}</span>`;
  const yes = (v) => chip(v || '—', v === 'Oui' ? 'good' : v === 'Non' ? 'bad' : v === 'En cours' ? 'warn' : 'neutral');
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : 'Non renseigné');
  const ctl = (f) => f.controlSummary || { enRetard: 0, aRealiser: 0, nonConformes: 0, total: 0, prochain: null };
  const attention = (f) =>
    ctl(f).enRetard + ctl(f).aRealiser + ctl(f).nonConformes > 0 ||
    ['bad', 'mid'].includes(f.certificateState?.[1]) ||
    f.toReview;
  const matches = (f) => {
    const situation = $('#situation').value,
      type = $('#type').value;
    return (
      (!$('#query').value.trim() || flat(f.name).includes(flat($('#query').value.trim()))) &&
      (type === 'all' || (type === 'saas' ? f.saas : !f.saas)) &&
      (situation === 'all' ||
        (situation === 'nomfa' && f.mfa !== 'Oui') ||
        (situation === 'ctl' && ctl(f).enRetard + ctl(f).aRealiser + ctl(f).nonConformes > 0) ||
        (situation === 'cert' && ['bad', 'mid'].includes(f.certificateState?.[1])) ||
        (situation === 'crit' && f.critical === 'Oui'))
    );
  };
  function controls(f) {
    const c = ctl(f);
    return (
      [
        c.enRetard ? chip(c.enRetard + ' en retard', 'bad') : '',
        c.nonConformes ? chip(c.nonConformes + ' non conforme', 'bad') : '',
        c.aRealiser ? chip(c.aRealiser + ' à réaliser', 'warn') : '',
      ]
        .filter(Boolean)
        .join('') || (c.total ? chip('À jour', 'good') : chip('Aucun contrôle'))
    );
  }
  function row(f) {
    const c = ctl(f),
      e = f.current;
    return `<button type="button" class="fs-grid fs-row" data-id="${E(f.id)}" data-attention="${attention(f)}"><span class="fs-identity"><span class="fs-glyph">${icon(f.saas ? 'cloud' : 'box')}</span><span><strong>${E(f.name)}</strong><small>${E(f.id)} · ${f.saas ? 'Service SaaS' : 'Hors SaaS'}${f.rattachement ? ' · ' + E(f.rattachement) : ''}</small><small class="fs-context">${E(f.notes || 'Aucune note renseignée')}</small></span></span><span class="fs-cell"><span class="fs-pair"><span>SSO</span>${yes(f.sso)}</span><span class="fs-pair"><span>MFA</span>${yes(f.mfa)}</span></span><span class="fs-cell">${chip(f.critical === 'Oui' ? 'Critique' : f.critical === 'Non' ? 'Non critique' : 'Criticité : ' + (f.critical || '—'), f.critical === 'Oui' ? 'warn' : 'neutral')}<small>HDS déclaré : ${E(f.hds || '—')}</small></span><span class="fs-cell">${chip(f.certificateState?.[0] || 'Non renseigné', { ok: 'good', mid: 'warn', bad: 'bad' }[f.certificateState?.[1]] || 'neutral')}<small>${f.certs?.length || 0} certificat${f.certs?.length > 1 ? 's' : ''}</small></span><span class="fs-cell">${controls(f)}<small>${c.prochain ? 'Échéance ' + date(c.prochain) : 'Échéance non renseignée'}</small></span><span class="fs-cell">${e ? `<span class="fs-score"><span data-tone="good">✓ ${e.meets}</span><span data-tone="bad">× ${e.notMeets}</span><span>— ${e.notAssessed}</span></span><small>Répond · Ne répond pas · Non évalué</small><small>${date(e.evaluatedAt)}</small>${f.toReview ? chip('À réévaluer', 'bad') : ''}` : chip('Non évalué')}<small class="fs-context">${f.scopes?.length || 0} périmètre${f.scopes?.length > 1 ? 's' : ''} rattaché${f.scopes?.length > 1 ? 's' : ''}</small></span>${icon('open')}</button>`;
  }
  function render() {
    const items = data.filter(matches),
      saas = data.filter((f) => f.saas),
      ratio = (field) =>
        saas.length ? Math.round((saas.filter((f) => f[field] === 'Oui').length / saas.length) * 100) + ' %' : '—';
    $('#summary').innerHTML = [
      ['Répertoire', data.length + '', 'fournisseurs dans l’organisation', 'box', 'cyan'],
      ['Services SaaS', saas.length + '', 'services déclarés', 'cloud', 'blue'],
      [
        'MFA confirmée',
        ratio('mfa'),
        saas.filter((f) => f.mfa === 'Oui').length + ' / ' + saas.length + ' services SaaS',
        'shield',
        'green',
      ],
      [
        'SSO confirmé',
        ratio('sso'),
        saas.filter((f) => f.sso === 'Oui').length + ' / ' + saas.length + ' services SaaS',
        'key',
        'blue',
      ],
    ]
      .map(
        ([l, v, sub, i, tone]) =>
          `<div class="fs-stat" data-tone="${tone}"><small>${l}</small><strong>${v}</strong><span>${sub}</span>${icon(i)}</div>`,
      )
      .join('');
    $('#content').dataset.density = density;
    $('#content').innerHTML =
      `<div class="fs-grid fs-list-head" aria-hidden="true"><span>Fournisseur / application</span><span>Accès</span><span>Criticité / HDS</span><span>Certificats</span><span>Contrôles périodiques</span><span>Évaluation courante</span><span></span></div>${items.map(row).join('') || '<p class="fs-empty">Aucun fournisseur ne correspond aux critères.</p>'}`;
    $('#result').textContent = items.length + ' fournisseurs affichés sur ' + data.length;
    document.querySelectorAll('[data-density]').forEach((b) => {
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.density === density));
    });
    $('#view-label').textContent = density === 'compact' ? 'Registre compact' : 'Registre détaillé';
    const criteria = [
      $('#query').value.trim() && 'Recherche : ' + $('#query').value.trim(),
      $('#situation').value !== 'all' ? $('#situation').selectedOptions[0].textContent : '',
      $('#type').value !== 'all' ? $('#type').selectedOptions[0].textContent : '',
    ].filter(Boolean);
    $('#criteria').hidden = !criteria.length;
    $('#criteria-text').textContent = criteria.join(' · ');
  }
  function open(id, trigger) {
    const f = data.find((x) => x.id === id);
    if (!f) return;
    returnTo = trigger;
    closePopup();
    const field = (l, v) => `<div><dt>${E(l)}</dt><dd>${E(v || 'Non renseigné')}</dd></div>`;
    const e = f.current;
    $('#detail-content').innerHTML =
      `<header class="rr-detail-head"><div><span class="rr-kicker">Fournisseur · ${E(f.id)}</span><h2 id="detail-title">${E(f.name)}</h2><p>${f.saas ? 'Service SaaS' : 'Hors SaaS'} · ${E(f.rattachement || 'Rattachement non renseigné')}</p></div><button type="button" class="rr-tool" data-close-dialog aria-label="Fermer la fiche">×</button></header><div class="fs-detail-body"><section><h3>Identité et accès</h3><dl>${field('Contact', f.contact)}${field('Rattachement', f.rattachement)}${field('SSO', f.sso)}${field('MFA', f.mfa)}${field('Critique', f.critical)}${field('Hébergeur HDS déclaré', f.hds)}</dl></section><section><h3>Évaluation courante</h3>${e ? `<div class="fs-evaluation">${chip(e.meets + ' répond', 'good')}${chip(e.notMeets + ' ne répond pas', e.notMeets ? 'bad' : 'neutral')}${chip(e.notAssessed + ' non évalué')}</div><dl>${field('Date', date(e.evaluatedAt))}${field('Évaluateur', e.evaluator)}${field('Réévaluation', date(e.nextReviewAt))}${field('État de réévaluation', f.toReview ? 'À réévaluer' : 'Pas de réévaluation signalée dans l’export')}</dl>` : '<p class="fs-muted">Aucune évaluation enregistrée.</p>'}</section><section><h3>Certificats</h3>${f.certs?.length ? f.certs.map((c) => `<article><strong>${E(c.type)}</strong><dl>${field('Validité', date(c.validUntil))}${field('Reçu le', date(c.received))}${field('Périmètre du certificat', c.scope)}${field('Emplacement', c.location)}</dl></article>`).join('') : '<p class="fs-muted">Aucun certificat renseigné.</p>'}</section><section><h3>Contrôles périodiques</h3>${f.controls?.length ? f.controls.map((c) => `<article><strong>${E(c.t)}</strong><dl>${field('Fréquence', c.freq ? c.freq + ' mois' : '')}${field('Dernier contrôle', date(c.last))}${field('Résultat', c.result)}${field('Référence', c.ref)}${field('Commentaire', c.comment)}</dl></article>`).join('') : '<p class="fs-muted">Aucun contrôle renseigné.</p>'}</section><section class="fs-wide"><h3>Notes et périmètres</h3><p>${E(f.notes || 'Aucune note renseignée.')}</p><p class="fs-muted">${f.scopes?.length ? E(f.scopes.join(', ')) : 'Aucun périmètre rattaché.'}</p></section></div><footer class="rr-detail-footer"><span>Consultation · États de l’export fictif</span><div><button type="button" class="button" data-close-dialog>Fermer</button></div></footer>`;
    $('#detail').showModal();
    $('#detail').querySelector('button').focus();
  }
  function closeDialog() {
    $('#detail').close();
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    else $('#search-toggle').focus({ preventScroll: true });
  }
  function positionPopup() {
    if (!popup) return;
    const r = $('#' + (popup.id === 'search-box' ? 'search-toggle' : 'filter-toggle')).getBoundingClientRect();
    popup.style.left = Math.max(12, Math.min(innerWidth - popup.offsetWidth - 12, r.right - popup.offsetWidth)) + 'px';
    popup.style.top = Math.max(12, Math.min(innerHeight - popup.offsetHeight - 12, r.bottom + 8)) + 'px';
  }
  function closePopup(focus = false) {
    if (!popup) return;
    const b = $('#' + (popup.id === 'search-box' ? 'search-toggle' : 'filter-toggle'));
    popup.hidden = true;
    b.setAttribute('aria-expanded', 'false');
    popup = null;
    if (focus) b.focus({ preventScroll: true });
  }
  function togglePopup(id) {
    if (popup?.id === id) return closePopup(true);
    closePopup();
    popup = $('#' + id);
    popup.hidden = false;
    $('#' + (id === 'search-box' ? 'search-toggle' : 'filter-toggle')).setAttribute('aria-expanded', 'true');
    positionPopup();
    popup.querySelector('input,select,button').focus();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.id) open(b.dataset.id, b);
    else if (b.dataset.density) {
      density = b.dataset.density;
      render();
    } else if (b.hasAttribute('data-close-dialog')) closeDialog();
    else if (b.hasAttribute('data-close-popup')) closePopup(true);
  });
  $('#search-toggle').onclick = () => togglePopup('search-box');
  $('#filter-toggle').onclick = () => togglePopup('filter-box');
  $('#query').addEventListener('input', render);
  ['situation', 'type'].forEach((id) => $('#' + id).addEventListener('change', render));
  $('#reset').onclick = () => {
    ['query', 'situation', 'type'].forEach((id) => ($('#' + id).value = id === 'query' ? '' : 'all'));
    render();
    $('#filter-toggle').focus({ preventScroll: true });
  };
  $('#theme').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme').textContent = dark ? 'Mode clair' : 'Mode sombre';
  };
  $('#detail').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup) {
      e.preventDefault();
      closePopup(true);
    } else if (e.key === '/' && !e.target.closest('input,select,textarea') && !$('#detail').open) {
      e.preventDefault();
      if (popup?.id !== 'search-box') togglePopup('search-box');
      $('#query').focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (popup && !popup.contains(e.target) && !e.target.closest('#search-toggle,#filter-toggle')) closePopup();
  });
  window.addEventListener('resize', positionPopup);
  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  if (new URLSearchParams(window.location.search).get('theme') === 'light')
    document.documentElement.dataset.theme = 'light';
  $('#theme').textContent = document.documentElement.dataset.theme === 'dark' ? 'Mode clair' : 'Mode sombre';
  render();
  window.FOURNISSEURS_APERCU = {
    snapshot: () => structuredClone(data),
    setData: (items) => {
      data.splice(0, data.length, ...structuredClone(items));
      render();
    },
  };
})();
