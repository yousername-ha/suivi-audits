(function () {
  'use strict';
  const { $, $$, api, me, esc, toast, showErr, fmtDate, fmtDay, fmtSize, header, confirmBox, tagInput } = window.UI;
  const TYPES = 'PDF, Word, Excel, PowerPoint, OpenDocument, images, texte, CSV, e-mails (.msg, .eml), ZIP';
  const CL = { public: 'Public', interne: 'Interne', restreint: 'Restreint', confidentiel: 'Confidentiel' };
  let RW = false, REFS = [], tabName = 'docs', docs = [], links = [], cur = null, curLink = null;
  let upRefs, docRefs, linkRefs, upFiles = [];
  const params = new URLSearchParams(location.search);
  const tagsOf = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const refLabel = (r) => { const x = REFS.find((y) => y.ref === r); return x ? `${r} — ${x.label}` : r; };
  const refChips = (a) => (a || []).map((r) => `<span class="chip ref" title="${esc(refLabel(r))}">${esc(r)}</span>`).join('');
  const linkHref = (u) => (/^\\\\/.test(u) ? 'file:' + u.replace(/\\/g, '/') : /^[a-z]:\\/i.test(u) ? 'file:///' + u.replace(/\\/g, '/') : u);
  const internalUrl = (id) => `${location.origin}/d/${id}`;

  /* ---------------- Chargement ---------------- */
  async function load() {
    const p = new URLSearchParams();
    if ($('#q').value.trim()) p.set('q', $('#q').value.trim());
    if ($('#fRef').value) p.set('ref', $('#fRef').value);
    if ($('#fCat').value) p.set('category', $('#fCat').value);
    if (tabName === 'links') { links = await api('GET', '/api/links?' + p); $('#nLinks').textContent = links.length; renderLinks(); }
    else { if (tabName === 'trash') p.set('trash', '1'); docs = await api('GET', '/api/documents?' + p); if (tabName === 'docs') $('#nDocs').textContent = docs.length; renderDocs(); }
  }
  async function loadCats() {
    const c = await api('GET', '/api/documents/categories');
    const v = $('#fCat').value;
    $('#fCat').innerHTML = '<option value="">Toutes les catégories</option>' + c.map((x) => `<option>${esc(x)}</option>`).join('');
    $('#fCat').value = v;
    $('#cats').innerHTML = [...new Set(['Preuve', 'Procédure', 'Politique', "Rapport d'audit", 'Compte rendu', 'Contrat', 'Attestation', 'Plan d\'action', ...c])].map((x) => `<option value="${esc(x)}">`).join('');
  }
  function renderDocs() {
    const trash = tabName === 'trash';
    if (!docs.length) { $('#listWrap').innerHTML = `<div class="empty">${trash ? 'La corbeille est vide.' : 'Aucun document. ' + (RW ? 'Utilisez « Déposer des documents ».' : '')}</div>`; return; }
    $('#listWrap').innerHTML = `<table class="tbl"><thead><tr><th>Document</th><th>Rattachements</th><th class="hide-sm">Catégorie</th><th class="hide-sm">Mis à jour</th><th class="num hide-sm">Taille</th><th></th></tr></thead><tbody>${docs.map((d) => `
      <tr class="click" data-id="${d.id}"><td><b>${esc(d.title)}</b><div class="small muted">${esc(d.filename || '')}${d.current_version > 1 ? ` · v${d.current_version}` : ''}
        ${d.classification !== 'interne' ? ` <span class="chip c-${esc(d.classification)}">${esc(CL[d.classification])}</span>` : ''}${d.scan_status === 'sain' ? '' : ''}</div></td>
      <td>${refChips(d.refs)}</td><td class="hide-sm">${esc(d.category)}</td><td class="hide-sm small">${trash ? 'supprimé ' + fmtDay(d.deleted_at) + ' · ' + esc(d.deleted_by) : fmtDay(d.updated_at) + ' · ' + esc(d.updated_by)}</td>
      <td class="num hide-sm small">${fmtSize(d.size)}</td>
      <td><div class="row">${trash ? (RW ? `<button class="btn sm" data-a="restore">Restaurer</button>` : '') + (UI.ME.user.role === 'admin' ? `<button class="btn sm danger" data-a="purge">Supprimer définitivement</button>` : '')
        : `<a class="btn sm" href="/api/documents/${d.id}/download" data-a="dl">Télécharger</a>`}</div></td></tr>`).join('')}</tbody></table>`;
  }
  function renderLinks() {
    if (!links.length) { $('#listWrap').innerHTML = `<div class="empty">Aucun lien. ${RW ? 'Utilisez « Ajouter un lien ».' : ''}</div>`; return; }
    $('#listWrap').innerHTML = `<table class="tbl"><thead><tr><th>Lien</th><th>Rattachements</th><th class="hide-sm">Catégorie</th><th class="hide-sm">Mis à jour</th><th></th></tr></thead><tbody>${links.map((l) => `
      <tr class="click" data-id="${l.id}"><td><b>${esc(l.title)}</b><div class="small muted mono">${esc(l.url.length > 80 ? l.url.slice(0, 77) + '…' : l.url)}</div></td>
      <td>${refChips(l.refs)}</td><td class="hide-sm">${esc(l.category)}</td><td class="hide-sm small">${fmtDay(l.updated_at)} · ${esc(l.updated_by)}</td>
      <td><a class="btn sm" href="${esc(linkHref(l.url))}" target="_blank" rel="noopener noreferrer" data-a="open">Ouvrir</a></td></tr>`).join('')}</tbody></table>`;
  }
  $('#listWrap').onclick = async (e) => {
    const a = e.target.closest('[data-a]'); const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (a && (a.dataset.a === 'dl' || a.dataset.a === 'open')) return;
    const id = tr.dataset.id;
    if (a && a.dataset.a === 'restore') { await api('POST', `/api/documents/${id}/restore`); toast('Document restauré.'); return load(); }
    if (a && a.dataset.a === 'purge') { if (await confirmBox('Supprimer définitivement ce document et toutes ses versions ? Cette action est irréversible.', { yes: 'Supprimer', danger: true })) { await api('DELETE', `/api/documents/${id}?purge=1`); toast('Document supprimé.'); load(); } return; }
    if (tabName === 'links') openLink(links.find((l) => l.id === id)); else openDoc(id);
  };

  /* ---------------- Dépôt ---------------- */
  function openUpload() {
    upFiles = []; renderUp(); $('#f-up').reset(); $('#f-up .alert').hidden = true;
    upRefs = tagInput($('#upRefs'), params.get('ref') ? [params.get('ref')] : [], REFS, 'A.5.15, 26-DHA-84, PRM02…');
    $('#dlgUp').showModal();
  }
  function renderUp() {
    $('#upList').innerHTML = upFiles.map((f, i) => `<li><span>${esc(f.file.name)}</span><span class="small muted">${fmtSize(f.file.size)}</span>
      <span class="st ${f.st === 'ok' ? 'chip ok' : f.st === 'err' ? 'chip bad' : f.st === 'up' ? 'chip warn' : ''}">${esc(f.msg || '')}</span>
      ${f.st ? '' : `<button class="btn sm ghost" type="button" data-i="${i}" aria-label="Retirer">×</button>`}</li>`).join('');
    $('#upGo').disabled = !upFiles.some((f) => !f.st);
  }
  $('#upList').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b) { upFiles.splice(+b.dataset.i, 1); renderUp(); } };
  const addFiles = (fl) => { for (const f of fl) upFiles.push({ file: f }); renderUp(); };
  $('#files').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  const drop = $('#drop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
  $('#f-up').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const d = Object.fromEntries(new FormData(f));
    const meta = { refs: upRefs.get(), category: d.category, classification: d.classification, tags: tagsOf(d.tags), description: d.description };
    $('#upGo').disabled = true;
    for (const it of upFiles.filter((x) => !x.st)) {
      it.st = 'up'; it.msg = 'envoi…'; renderUp();
      try {
        await api('POST', '/api/documents', it.file, { headers: { 'X-File-Name': encodeURIComponent(it.file.name), 'X-Meta': encodeURIComponent(JSON.stringify(meta)) } });
        it.st = 'ok'; it.msg = 'déposé';
      } catch (x) { it.st = 'err'; it.msg = x.message; }
      renderUp();
    }
    const ok = upFiles.filter((x) => x.st === 'ok').length;
    toast(`${ok} document${ok > 1 ? 's' : ''} déposé${ok > 1 ? 's' : ''}.`);
    loadCats(); load();
  });

  /* ---------------- Fiche document ---------------- */
  async function openDoc(id) {
    cur = await api('GET', `/api/documents/${id}`);
    const f = $('#f-doc'); f.querySelector('.alert').hidden = true;
    $('#docT').textContent = cur.title;
    f.title.value = cur.title; f.category.value = cur.category; f.classification.value = cur.classification; f.tags.value = cur.tags.join(', '); f.description.value = cur.description;
    docRefs = tagInput($('#docRefs'), cur.refs, REFS);
    const del = !!cur.deleted_at;
    $('#docActions').innerHTML = `${del ? '' : `<a class="btn" href="/api/documents/${cur.id}/download">Télécharger</a>`}
      ${/^(application\/pdf|image\/|text\/plain)/.test(cur.mime || '') && !del ? `<a class="btn" href="/api/documents/${cur.id}/download?inline=1" target="_blank" rel="noopener">Ouvrir</a>` : ''}
      <button class="btn" type="button" id="copyLink">Copier le lien interne</button>
      <span class="small muted">Lien à coller dans un champ « Lien vers le document » de l'outil de suivi.</span>`;
    $('#copyLink').onclick = () => navigator.clipboard.writeText(internalUrl(cur.id)).then(() => toast('Lien copié : ' + internalUrl(cur.id)));
    $('#docVers').innerHTML = cur.versions.map((v) => `<tr><td>v${v.version}${v.version === cur.current_version ? ' <span class="chip ok">courante</span>' : ''}${v.comment ? `<div class="small muted">${esc(v.comment)}</div>` : ''}</td>
      <td>${esc(v.filename)}<div class="small muted">${fmtSize(+v.size)} · ${v.scan_status === 'sain' ? 'analysé, sain' : esc(v.scan_status)}</div></td>
      <td class="hide-sm small">${fmtDate(v.uploaded_at)}<div class="muted">${esc(v.uploaded_by)}</div></td><td class="hide-sm mono small" title="${esc(v.sha256)}">${esc(v.sha256.slice(0, 16))}…</td>
      <td><a class="btn sm" href="/api/documents/${cur.id}/download?v=${v.version}">Télécharger</a></td></tr>`).join('');
    $$('#dlgDoc [data-rw]').forEach((x) => (x.hidden = !RW || del));
    $('#dlgDoc').showModal();
  }
  $('#f-doc').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const d = Object.fromEntries(new FormData(f));
    try { await api('PATCH', `/api/documents/${cur.id}`, { title: d.title, category: d.category, classification: d.classification, tags: tagsOf(d.tags), description: d.description, refs: docRefs.get() }); toast('Document enregistré.'); $('#dlgDoc').close(); loadCats(); load(); }
    catch (x) { showErr(f.querySelector('.alert'), x); }
  });
  $('#verAdd').onclick = () => $('#verFile').click();
  $('#verFile').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      await api('POST', `/api/documents/${cur.id}/versions`, file, { headers: { 'X-File-Name': encodeURIComponent(file.name), 'X-Comment': encodeURIComponent($('#verComment').value) } });
      $('#verComment').value = ''; toast('Nouvelle version déposée.'); openDoc(cur.id); load();
    } catch (x) { showErr($('#f-doc .alert'), x); }
  };
  $('#docDel').onclick = async () => { if (await confirmBox(`Mettre « ${cur.title} » à la corbeille ?`)) { await api('DELETE', `/api/documents/${cur.id}`); $('#dlgDoc').close(); toast('Document mis à la corbeille.'); load(); } };

  /* ---------------- Liens ---------------- */
  function openLink(l) {
    curLink = l || null;
    const f = $('#f-link'); f.reset(); f.querySelector('.alert').hidden = true;
    $('#linkT').textContent = l ? 'Lien' : 'Ajouter un lien';
    if (l) { f.url.value = l.url; f.title.value = l.title; f.category.value = l.category; f.tags.value = l.tags.join(', '); f.description.value = l.description; }
    linkRefs = tagInput($('#linkRefs'), l ? l.refs : params.get('ref') ? [params.get('ref')] : [], REFS);
    $('#linkDel').hidden = !l || !RW;
    $$('#f-link input, #f-link textarea').forEach((x) => (x.readOnly = !RW));
    $('#dlgLink').showModal();
  }
  $('#f-link').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const d = Object.fromEntries(new FormData(f));
    const body = { url: d.url.trim(), title: d.title, category: d.category, tags: tagsOf(d.tags), description: d.description, refs: linkRefs.get() };
    try { if (curLink) await api('PATCH', `/api/links/${curLink.id}`, body); else await api('POST', '/api/links', body); $('#dlgLink').close(); toast('Lien enregistré.'); loadCats(); if (tabName !== 'links') tab('links'); else load(); }
    catch (x) { showErr(f.querySelector('.alert'), x); }
  });
  $('#linkDel').onclick = async () => { if (await confirmBox('Supprimer ce lien ?', { danger: true, yes: 'Supprimer' })) { await api('DELETE', `/api/links/${curLink.id}`); $('#dlgLink').close(); load(); } };

  /* ---------------- Général ---------------- */
  function tab(t) { tabName = t; $$('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t)); load(); }
  $$('.tab').forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
  $$('dialog [data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
  let qT; $('#q').oninput = () => { clearTimeout(qT); qT = setTimeout(load, 250); };
  $('#fRef').onchange = load; $('#fCat').onchange = load;
  $('#addDoc').onclick = openUpload; $('#addLink').onclick = () => openLink(null);

  (async () => {
    await me(); if (UI.ME.stage !== 'ok') { location.href = '/login'; return; }
    header('documents');
    RW = ['rw', 'admin'].includes(UI.ME.user.role);
    $$('[data-rw]').forEach((x) => (x.hidden = !RW));
    $('#upTypes').textContent = TYPES;
    REFS = await api('GET', '/api/refs').catch(() => []);
    $('#fRef').innerHTML = '<option value="">Tous les rattachements</option>' + REFS.map((r) => `<option value="${esc(r.ref)}">${esc(r.ref)} — ${esc(r.label.slice(0, 60))}</option>`).join('');
    if (params.get('ref')) $('#fRef').value = params.get('ref');
    if (params.get('q')) $('#q').value = params.get('q');
    await loadCats();
    api('GET', '/api/links').then((l) => ($('#nLinks').textContent = l.length)).catch(() => {});
    tab(params.get('tab') === 'links' ? 'links' : 'docs');
  })();
})();
