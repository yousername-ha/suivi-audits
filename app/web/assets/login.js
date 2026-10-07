(function () {
  'use strict';
  const { $, $$, api, me, showErr } = window.UI;
  const next = (() => { const n = new URLSearchParams(location.search).get('next') || '/'; return /^\/(?!\/)/.test(n) ? n : '/'; })();

  async function go(stage) {
    if (!stage) stage = (await me()).stage;
    if (stage === 'ok') { location.replace(next); return; }
    $$('section[id^="st-"]').forEach((s) => (s.hidden = s.id !== 'st-' + stage));
    $$('.alert.err').forEach((a) => (a.hidden = true));
    const steps = $('#steps');
    steps.hidden = stage === 'anon';
    const order = { mfa: 2, enroll: 2, password: 3 };
    $$('#steps i').forEach((i, k) => i.classList.toggle('on', k < (order[stage] || 1)));
    if (stage === 'enroll') await enroll();
    const f = $(`#st-${stage} input:not([hidden])`); if (f) f.focus();
  }

  async function enroll() {
    const r = await api('POST', '/api/account/totp/begin', {});
    $('#totpSecret').textContent = r.secret.replace(/(.{4})/g, '$1 ').trim();
    const qr = window.qrcode(0, 'M'); qr.addData(r.uri); qr.make();
    const img = new Image(); img.alt = 'QR code de configuration'; img.src = qr.createDataURL(6, 2);
    $('#qr').replaceChildren(img);
  }

  function bind(id, fn) {
    const f = $(id);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = f.querySelector('.alert.err'); err.hidden = true;
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      try { const r = await fn(Object.fromEntries(new FormData(f))); await me(); await go(r && r.stage); }
      catch (x) { showErr(err, x); f.querySelectorAll('input[type="password"],.otp').forEach((i) => { if (i.name !== 'username') i.value = ''; }); }
      finally { btn.disabled = false; }
    });
  }
  bind('#f-login', (d) => api('POST', '/api/auth/login', { username: d.username, password: d.password }, { noRedirect: true }));
  bind('#f-mfa', (d) => api('POST', '/api/auth/mfa', { code: d.code }, { noRedirect: true }));
  bind('#f-enroll', (d) => api('POST', '/api/account/totp/confirm', { code: d.code }, { noRedirect: true }));
  bind('#f-password', (d) => {
    if (d.next !== d.confirm) throw new Error('Les deux saisies ne correspondent pas.');
    return api('POST', '/api/account/password', { current: d.current, next: d.next }, { noRedirect: true });
  });
  $$('[data-logout]').forEach((b) => (b.onclick = async () => { try { await api('POST', '/api/auth/logout', undefined, { noRedirect: true }); } catch (e) {} await me(); go('anon'); }));

  (async () => {
    const m = await me();
    $('#appName').textContent = m.appName;
    $('#foot').textContent = `${m.orgName} · v${m.version}`;
    $('#pwHint').textContent = `Au moins ${m.passwordMinLength} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles.`;
    if (m.stage === 'anon') { try { const s = await api('GET', '/api/setup', undefined, { noRedirect: true }); if (s.needed && !s.adminExists) { location.replace('/setup'); return; } } catch (e) {} }
    go(m.stage);
  })();
})();
