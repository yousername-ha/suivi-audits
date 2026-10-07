(function () {
  'use strict';
  const { $, api, me, esc, toast, showErr, fmtDate, ROLE_L, header, confirmBox } = window.UI;
  let M;
  async function load() {
    M = await me();
    if (M.stage !== 'ok') { location.href = '/login'; return; }
    const u = M.user;
    $('#who').textContent = `${u.displayName || u.username} · ${u.username} · ${ROLE_L[u.role]}`;
    $('#pwInfo').textContent = `Au moins ${M.passwordMinLength} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles. Le changement ferme vos autres sessions.`;
    $('#mfaInfo').textContent = u.totpEnabled ? 'Activée. Un code de votre application est demandé à chaque connexion.' : 'Non activée.';
    $('#mfaOff').hidden = !u.totpEnabled || M.mfaRequired;
    $('#mfaRenew').textContent = u.totpEnabled ? "Changer d'appareil" : 'Activer';
    const s = await api('GET', '/api/account/sessions');
    $('#sessions').innerHTML = s.map((x) => `<tr><td>${fmtDate(x.created_at)}${x.current ? ' <span class="chip ok">cette session</span>' : ''}</td><td>${fmtDate(x.last_seen_at)}</td><td class="mono">${esc(x.ip || '')}</td><td class="hide-sm small muted">${esc(x.user_agent.slice(0, 90))}</td></tr>`).join('');
  }
  $('#f-pw').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const err = f.querySelector('.alert'); err.hidden = true;
    const d = Object.fromEntries(new FormData(f));
    if (d.next !== d.confirm) return showErr(err, new Error('Les deux saisies ne correspondent pas.'));
    try { await api('POST', '/api/account/password', { current: d.current, next: d.next }); f.reset(); toast('Mot de passe modifié.'); load(); } catch (x) { showErr(err, x); }
  });
  $('#mfaRenew').onclick = async () => {
    let body = {};
    if (M.user.totpEnabled) {
      const pw = await askPassword(); if (pw == null) return; body = { password: pw };
    }
    try {
      const r = await api('POST', '/api/account/totp/begin', body);
      const qr = window.qrcode(0, 'M'); qr.addData(r.uri); qr.make();
      const img = new Image(); img.alt = 'QR code'; img.src = qr.createDataURL(6, 2); $('#qr').replaceChildren(img);
      $('#totpSecret').textContent = r.secret.replace(/(.{4})/g, '$1 ').trim();
      $('#mfaEnroll').hidden = false; $('#f-mfa input').focus();
    } catch (x) { toast(x.message); }
  };
  $('#mfaCancel').onclick = () => { $('#mfaEnroll').hidden = true; };
  $('#f-mfa').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const err = f.querySelector('.alert'); err.hidden = true;
    try { await api('POST', '/api/account/totp/confirm', { code: new FormData(f).get('code') }); f.reset(); $('#mfaEnroll').hidden = true; toast('Double authentification activée sur le nouvel appareil.'); load(); } catch (x) { showErr(err, x); }
  });
  $('#mfaOff').onclick = async () => { const pw = await askPassword(); if (pw == null) return; try { await api('POST', '/api/account/totp/disable', { password: pw }); toast('Double authentification désactivée.'); load(); } catch (x) { toast(x.message); } };
  $('#revokeOthers').onclick = async () => { if (await confirmBox('Fermer toutes vos autres sessions ?')) { await api('POST', '/api/account/sessions/revoke-others'); toast('Autres sessions fermées.'); load(); } };

  function askPassword() {
    return new Promise((res) => {
      const d = document.createElement('dialog');
      d.innerHTML = `<form method="dialog"><div class="dlg-h"><h2>Confirmer votre identité</h2></div><div class="dlg-b"><label class="fld">Mot de passe<input type="password" name="pw" required autocomplete="current-password"></label></div>
        <div class="dlg-f"><button class="btn" value="0" formnovalidate>Annuler</button><button class="btn primary" value="1">Continuer</button></div></form>`;
      document.body.appendChild(d);
      d.onclose = () => { const v = d.returnValue === '1' ? d.querySelector('input').value : null; d.remove(); res(v); };
      d.showModal();
    });
  }
  (async () => { await me(); if (UI.ME.stage !== 'ok') { location.href = '/login'; return; } header('account'); load(); })();
})();
