/* Utilitaires communs aux pages (connexion, compte, administration, documents). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let ME = null;

  async function api(method, url, body, opts = {}) {
    const h = { Accept: 'application/json' };
    if (ME && ME.csrf) h['X-CSRF-Token'] = ME.csrf;
    let payload;
    if (body instanceof Blob || body instanceof ArrayBuffer) { payload = body; h['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    Object.assign(h, opts.headers || {});
    const r = await fetch(url, { method, headers: h, body: payload, credentials: 'same-origin', cache: 'no-store' });
    if (r.status === 204) return null;
    let data = null;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 401 && !opts.noRedirect && location.pathname !== '/login') { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); }
      const e = new Error((data && data.error) || `Erreur ${r.status}`); e.status = r.status; e.data = data; throw e;
    }
    return data;
  }
  async function me() { ME = await api('GET', '/api/auth/me', undefined, { noRedirect: true }); return ME; }

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), Math.max(3000, msg.length * 50));
  }
  function showErr(el, e) { el.textContent = e && e.message ? e.message : String(e); el.hidden = false; }

  const fmtDate = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
  const fmtSize = (n) => (n == null ? '' : n < 1024 ? n + ' o' : n < 1048576 ? (n / 1024).toFixed(0) + ' Ko' : (n / 1048576).toFixed(1) + ' Mo');
  const ROLE_L = { admin: 'Administrateur', rw: 'Lecture et écriture', ro: 'Lecture seule' };

  /** Barre supérieure commune. */
  function header(active) {
    const u = ME.user;
    const el = document.createElement('header');
    el.className = 'top';
    el.innerHTML = `<div class="top-in">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">S</span><span>${esc(ME.appName)}</span></a>
      <nav class="nav" aria-label="Navigation principale">
        <a href="/${u.role === 'ro' ? '?lecture' : ''}">Suivi</a>
        <a href="/documents" class="${active === 'documents' ? 'on' : ''}">Documents et liens</a>
        ${u.role === 'admin' ? `<a href="/admin" class="${active === 'admin' ? 'on' : ''}">Administration</a>` : ''}
        <a href="/account" class="${active === 'account' ? 'on' : ''}">Mon compte</a>
      </nav>
      <div class="who"><span class="name">${esc(u.displayName || u.username)}</span><span class="role ${esc(u.role)}">${esc(ROLE_L[u.role])}</span>
      <button class="btn sm" id="logoutBtn" type="button">Déconnexion</button></div></div>`;
    document.body.prepend(el);
    $('#logoutBtn').onclick = logout;
  }
  async function logout() { try { await api('POST', '/api/auth/logout'); } catch (e) {} location.href = '/login'; }

  /** Ouvre une boîte de confirmation. */
  function confirmBox(msg, { yes = 'Confirmer', danger = false } = {}) {
    return new Promise((res) => {
      const d = document.createElement('dialog');
      d.innerHTML = `<div class="dlg-b"><p></p></div><div class="dlg-f"><button class="btn" value="0">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" value="1">${esc(yes)}</button></div>`;
      d.querySelector('p').textContent = msg;
      document.body.appendChild(d);
      d.querySelectorAll('button').forEach((b) => (b.onclick = () => { d.close(); res(b.value === '1'); }));
      d.onclose = () => { d.remove(); res(false); };
      d.showModal();
    });
  }

  /** Affiche une fois un secret (mot de passe temporaire…). */
  function secretBox(title, intro, secret) {
    const d = document.createElement('dialog');
    d.innerHTML = `<div class="dlg-h"><h2></h2></div><div class="dlg-b"><p class="muted"></p><div class="secret"></div>
      <div class="alert warn">Ce mot de passe n'est affiché qu'une fois. Transmettez-le par un canal séparé ; il devra être changé à la première connexion.</div></div>
      <div class="dlg-f"><button class="btn" data-copy>Copier</button><button class="btn primary" data-close>Fermer</button></div>`;
    d.querySelector('h2').textContent = title; d.querySelector('p').textContent = intro; d.querySelector('.secret').textContent = secret;
    document.body.appendChild(d);
    d.querySelector('[data-copy]').onclick = () => navigator.clipboard.writeText(secret).then(() => toast('Copié.'));
    d.querySelector('[data-close]').onclick = () => d.close();
    d.onclose = () => d.remove();
    d.showModal();
  }

  /** Champ de saisie de rattachements (mesures, écarts, processus…) avec suggestions. */
  function tagInput(container, values, suggestions, placeholder) {
    let vals = [...(values || [])];
    container.classList.add('tagbox');
    const render = () => {
      container.innerHTML = vals.map((v, i) => `<span class="chip ref">${esc(v)}<button type="button" data-i="${i}" aria-label="Retirer ${esc(v)}">×</button></span>`).join('') +
        `<input type="text" placeholder="${esc(placeholder || 'Ajouter…')}" autocomplete="off"><ul class="sugg" hidden></ul>`;
      const inp = container.querySelector('input'); const ul = container.querySelector('.sugg');
      let idx = -1, list = [];
      const add = (v) => { v = String(v || '').trim(); if (v && !vals.includes(v)) vals.push(v); render(); container.querySelector('input').focus(); };
      const show = () => {
        const q = inp.value.trim().toLowerCase();
        list = q ? (suggestions || []).filter((s) => !vals.includes(s.ref) && (s.ref.toLowerCase().includes(q) || (s.label || '').toLowerCase().includes(q))).slice(0, 30) : [];
        idx = list.length ? 0 : -1;
        ul.innerHTML = list.map((s, i) => `<li data-i="${i}" class="${i === idx ? 'on' : ''}"><b>${esc(s.ref)}</b>${esc((s.label || '').slice(0, 90))}<span>${esc(s.kind || '')}</span></li>`).join('');
        ul.hidden = !list.length;
      };
      inp.oninput = show;
      inp.onkeydown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!list.length) return; idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length; [...ul.children].forEach((li, i) => li.classList.toggle('on', i === idx)); }
        else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(idx >= 0 && list[idx] ? list[idx].ref : inp.value); }
        else if (e.key === 'Backspace' && !inp.value && vals.length) { vals.pop(); render(); container.querySelector('input').focus(); }
      };
      inp.onblur = () => setTimeout(() => { if (inp.value.trim()) add(inp.value); else ul.hidden = true; }, 150);
      ul.onmousedown = (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); add(list[+li.dataset.i].ref); } };
      container.querySelectorAll('.chip button').forEach((b) => (b.onclick = () => { vals.splice(+b.dataset.i, 1); render(); }));
    };
    render();
    return { get: () => { const i = container.querySelector('input'); if (i && i.value.trim()) { vals.push(i.value.trim()); i.value = ''; } return [...new Set(vals)]; } };
  }

  window.UI = { $, $$, esc, api, me, get ME() { return ME; }, toast, showErr, fmtDate, fmtDay, fmtSize, ROLE_L, header, logout, confirmBox, secretBox, tagInput };
})();
