(function () {
  'use strict';
  const { $, $$, api, me, esc, toast, showErr, fmtDate, ROLE_L, header, confirmBox, secretBox } = window.UI;
  let users = [], editing = null, auditRows = [];

  /* ---------- Onglets ---------- */
  function tab(t) {
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t));
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== t));
    ({ users: loadUsers, sessions: loadSessions, audit: () => loadAudit(true), versions: loadVersions, system: loadSystem })[t]();
    history.replaceState(null, '', '#' + t);
  }
  $$('.tab').forEach((b) => (b.onclick = () => tab(b.dataset.tab)));

  /* ---------- Comptes ---------- */
  async function loadUsers() {
    users = await api('GET', '/api/admin/users');
    const me = UI.ME.user.id;
    $('#users').innerHTML = users.map((u) => {
      const locked = u.locked_until && new Date(u.locked_until) > new Date();
      const st = u.disabled ? '<span class="chip bad">désactivé</span>' : locked ? '<span class="chip warn">verrouillé</span>' : '<span class="chip ok">actif</span>';
      return `<tr><td><b>${esc(u.display_name || u.username)}</b><div class="small muted">${esc(u.username)}${u.email ? ' · ' + esc(u.email) : ''}${u.id === me ? ' · vous' : ''}</div></td>
        <td><span class="role ${esc(u.role)}">${esc(ROLE_L[u.role])}</span></td>
        <td>${st}${u.must_change_password ? ' <span class="chip">mdp temporaire</span>' : ''}</td>
        <td class="hide-sm">${u.totp_enabled ? '<span class="chip ok">activée</span>' : '<span class="chip warn">à configurer</span>'}</td>
        <td class="hide-sm small">${fmtDate(u.last_login_at) || '—'}</td>
        <td><div class="row">
          <button class="btn sm" data-a="edit" data-id="${u.id}">Modifier</button>
          <button class="btn sm" data-a="pw" data-id="${u.id}">Mot de passe</button>
          ${u.totp_enabled ? `<button class="btn sm" data-a="mfa" data-id="${u.id}">Réinit. MFA</button>` : ''}
          ${locked ? `<button class="btn sm" data-a="unlock" data-id="${u.id}">Déverrouiller</button>` : ''}
          <button class="btn sm" data-a="toggle" data-id="${u.id}">${u.disabled ? 'Réactiver' : 'Désactiver'}</button>
          ${u.id !== me ? `<button class="btn sm danger" data-a="del" data-id="${u.id}">Supprimer</button>` : ''}
        </div></td></tr>`;
    }).join('');
  }
  $('#users').onclick = async (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const u = users.find((x) => x.id === b.dataset.id); const name = u.display_name || u.username;
    try {
      switch (b.dataset.a) {
        case 'edit': openUser(u); return;
        case 'pw': if (await confirmBox(`Générer un mot de passe temporaire pour ${name} ? Ses sessions seront fermées.`)) { const r = await api('POST', `/api/admin/users/${u.id}/reset-password`); secretBox('Mot de passe temporaire', `Compte ${u.username}`, r.temporaryPassword); } break;
        case 'mfa': if (await confirmBox(`Réinitialiser la double authentification de ${name} ? Il devra la reconfigurer à la prochaine connexion.`)) { await api('POST', `/api/admin/users/${u.id}/reset-mfa`); toast('Double authentification réinitialisée.'); } break;
        case 'unlock': await api('PATCH', `/api/admin/users/${u.id}`, { unlock: true }); toast('Compte déverrouillé.'); break;
        case 'toggle': if (u.disabled || await confirmBox(`Désactiver ${name} ? Ses sessions seront fermées.`)) { await api('PATCH', `/api/admin/users/${u.id}`, { disabled: !u.disabled }); } break;
        case 'del': if (await confirmBox(`Supprimer définitivement le compte ${u.username} ? Les traces du journal d'audit sont conservées.`, { yes: 'Supprimer', danger: true })) { await api('DELETE', `/api/admin/users/${u.id}`); toast('Compte supprimé.'); } break;
      }
      loadUsers();
    } catch (x) { toast(x.message); }
  };
  function openUser(u) {
    editing = u || null;
    const f = $('#f-user'); f.reset(); f.querySelector('.alert').hidden = true;
    $('#dlgUserT').textContent = u ? `Modifier ${u.username}` : 'Nouveau compte';
    f.username.value = u ? u.username : ''; f.username.disabled = !!u;
    f.displayName.value = u ? u.display_name : ''; f.email.value = u ? u.email : ''; f.role.value = u ? u.role : 'rw';
    $('#dlgUser').showModal();
  }
  $('#newUser').onclick = () => openUser(null);
  $('#dlgUser [data-close]').onclick = () => $('#dlgUser').close();
  $('#f-user').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const err = f.querySelector('.alert'); err.hidden = true;
    const d = Object.fromEntries(new FormData(f));
    try {
      if (editing) { await api('PATCH', `/api/admin/users/${editing.id}`, { displayName: d.displayName, email: d.email, role: d.role }); toast('Compte modifié.'); }
      else { const r = await api('POST', '/api/admin/users', d); secretBox('Compte créé', `Mot de passe temporaire de ${d.username} :`, r.temporaryPassword); }
      $('#dlgUser').close(); loadUsers();
    } catch (x) { showErr(err, x); }
  });

  /* ---------- Sessions ---------- */
  async function loadSessions() {
    const s = await api('GET', '/api/admin/sessions');
    $('#sessions').innerHTML = s.map((x) => `<tr><td>${esc(x.username)}${x.current ? ' <span class="chip ok">vous</span>' : ''}${x.mfa_ok ? '' : ' <span class="chip warn">auth. incomplète</span>'}</td><td>${fmtDate(x.created_at)}</td><td>${fmtDate(x.last_seen_at)}</td><td class="mono">${esc(x.ip || '')}</td><td class="hide-sm small muted">${esc(x.user_agent.slice(0, 80))}</td>
      <td>${x.current ? '' : `<button class="btn sm" data-id="${x.id}">Fermer</button>`}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune session.</td></tr>';
  }
  $('#sessions').onclick = async (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; await api('DELETE', `/api/admin/sessions/${b.dataset.id}`); toast('Session fermée.'); loadSessions(); };

  /* ---------- Journal ---------- */
  const ACTION_L = { 'auth.login': 'Connexion', 'auth.password_ok': 'Mot de passe validé', 'auth.login_failed': 'Échec de connexion', 'auth.mfa_failed': 'Échec double auth.', 'auth.logout': 'Déconnexion', 'auth.rate_limited': 'Trop de tentatives',
    'state.write': 'Données enregistrées', 'document.create': 'Document ajouté', 'document.version': 'Nouvelle version', 'document.download': 'Document consulté', 'document.update': 'Document modifié', 'document.delete': 'Document à la corbeille', 'document.purge': 'Document supprimé', 'document.restore': 'Document restauré', 'document.malware_blocked': 'Fichier malveillant bloqué',
    'link.create': 'Lien ajouté', 'link.update': 'Lien modifié', 'link.delete': 'Lien supprimé', 'setup.admin_created': 'Administrateur créé', 'setup.token_issued': "Jeton d'installation émis" };
  async function loadAudit(reset) {
    if (reset) auditRows = [];
    const p = new URLSearchParams({ limit: '200' });
    if ($('#auditQ').value.trim()) p.set('q', $('#auditQ').value.trim());
    if (!reset && auditRows.length) p.set('before', auditRows[auditRows.length - 1].id);
    const r = await api('GET', '/api/admin/audit?' + p);
    auditRows = auditRows.concat(r);
    $('#auditMore').hidden = r.length < 200;
    $('#audit').innerHTML = auditRows.map((x) => `<tr><td class="small">${fmtDate(x.ts)}</td><td>${esc(x.username || '—')}</td><td>${esc(ACTION_L[x.action] || x.action)}<div class="small muted mono">${esc(x.action)}</div></td>
      <td class="small mono">${esc(x.target)}</td><td class="hide-sm mono">${esc(x.ip || '')}</td><td class="hide-sm small muted mono">${esc(JSON.stringify(x.details) === '{}' ? '' : JSON.stringify(x.details).slice(0, 160))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune entrée.</td></tr>';
  }
  let qT; $('#auditQ').oninput = () => { clearTimeout(qT); qT = setTimeout(() => loadAudit(true), 300); };
  $('#auditMore').onclick = () => loadAudit(false);
  $('#auditCsv').onclick = () => {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = '﻿' + ['date;compte;action;cible;ip;details', ...auditRows.map((x) => [x.ts, x.username, x.action, x.target, x.ip, JSON.stringify(x.details)].map(q).join(';'))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  /* ---------- Versions ---------- */
  async function loadVersions() {
    const v = await api('GET', '/api/admin/versions');
    $('#versions').innerHTML = v.map((x, i) => `<tr><td><b>v${x.version}</b>${i === 0 ? ' <span class="chip ok">actuelle</span>' : ''}</td><td>${fmtDate(x.updated_at)}</td><td>${esc(x.updated_by)}</td><td class="num">${x.items}</td><td class="num">${x.findings}</td><td class="hide-sm small">${esc(x.note)}</td>
      <td><div class="row"><a class="btn sm" href="/api/admin/versions/${x.version}">JSON</a>${i === 0 ? '' : `<button class="btn sm" data-v="${x.version}">Restaurer</button>`}</div></td></tr>`).join('');
  }
  $('#versions').onclick = async (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    if (!(await confirmBox(`Restaurer la version ${b.dataset.v} ? Elle deviendra la version courante pour tous les utilisateurs (la version actuelle reste dans l'historique).`, { yes: 'Restaurer' }))) return;
    try { const r = await api('POST', `/api/admin/versions/${b.dataset.v}/restore`); toast(`Version ${b.dataset.v} restaurée (nouvelle version v${r.version}).`); loadVersions(); } catch (x) { toast(x.message); }
  };

  /* ---------- Système ---------- */
  async function loadSystem() {
    const s = await api('GET', '/api/admin/info');
    $('#stats').innerHTML = [['Comptes', s.counts.users], ['Documents', s.counts.documents], ['Liens', s.counts.links], ['Versions des données', s.counts.versions], ["Entrées d'audit", s.counts.audit], ['Taille de la base', s.dbSize]]
      .map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
    const kv = { Application: 'v' + s.app, 'Node.js': s.node, PostgreSQL: s.postgres, 'Données (version courante)': s.state ? `v${s.state.version} · ${fmtDate(s.state.updated_at)} · ${s.state.updated_by}` : '—',
      'Clé de chiffrement des documents': s.keyId, 'Antivirus (ClamAV)': s.clamav, 'Double authentification': s.mfaRequired ? 'obligatoire' : 'facultative',
      Sessions: `inactivité ${s.session.idleMinutes} min · durée max ${s.session.maxHours} h`, 'Taille max. des fichiers': s.maxUploadMb + ' Mo' };
    $('#sysKv').innerHTML = Object.entries(kv).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }

  (async () => { await me(); if (UI.ME.stage !== 'ok') { location.href = '/login'; return; } header('admin'); const t0 = location.hash.slice(1); tab(['users', 'sessions', 'audit', 'versions', 'system'].includes(t0) ? t0 : 'users'); })();
})();
