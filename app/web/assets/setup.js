(function () {
  'use strict';
  const { $, api, me, showErr } = window.UI;
  (async () => {
    const m = await me();
    $('#pwHint').textContent = `Au moins ${m.passwordMinLength} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles.`;
  })();
  const f = $('#f-setup');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = f.querySelector('.alert.err'); err.hidden = true;
    const d = Object.fromEntries(new FormData(f));
    if (d.password !== d.confirm) return showErr(err, new Error('Les deux saisies du mot de passe ne correspondent pas.'));
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await api('POST', '/api/setup', { token: d.token.trim(), username: d.username.trim(), displayName: d.displayName, email: d.email, password: d.password }, { noRedirect: true });
      location.replace('/login');
    } catch (x) { showErr(err, x); } finally { btn.disabled = false; }
  });
})();
