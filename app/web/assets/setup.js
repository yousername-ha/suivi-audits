(function () {
  'use strict';
  const { $, $$, api, me, showErr, toast } = window.UI;
  (async () => {
    const m = await me();
    $('#pwHint').textContent = `Au moins ${m.passwordMinLength} caractères et 3 types parmi minuscules, majuscules, chiffres, symboles.`;
  })();

  /* Commandes copiables (sans script en ligne : gestionnaires attachés ici). */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const txt = b.dataset.copy;
    try { await navigator.clipboard.writeText(txt); toast('Commande copiée.'); }
    catch (e) {
      const code = b.parentElement.querySelector('code');
      const r = document.createRange(); r.selectNodeContents(code);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast('Copie impossible : commande sélectionnée, utilisez Ctrl+C.');
    }
  }));

  /* Jeton : mise en forme XXXXX-XXXXX-XXXXX-XXXXX pendant la saisie. */
  const SIG = /[A-Z0-9]/;
  const raw = (v) => v.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const fmt = (r) => r.slice(0, 20).replace(/(.{5})(?=.)/g, '$1-');
  const tok = $('#token');
  tok.addEventListener('input', () => {
    const pos = tok.selectionStart == null ? tok.value.length : tok.selectionStart;
    const keep = raw(tok.value.slice(0, pos)).length;
    tok.value = fmt(raw(tok.value));
    let i = 0, n = 0;
    while (i < tok.value.length && n < keep) { if (SIG.test(tok.value[i])) n++; i++; }
    tok.setSelectionRange(i, i);
  });
  // Retour arrière juste après un tiret : supprimer le caractère qui le précède.
  tok.addEventListener('keydown', (e) => {
    const p = tok.selectionStart;
    if (e.key === 'Backspace' && p === tok.selectionEnd && p > 0 && tok.value[p - 1] === '-') tok.setSelectionRange(p - 1, p - 1);
  });
  function tokenProblem(v) {
    const r = raw(v);
    if (/[01ILO]/.test(r)) return 'Le jeton ne contient jamais les caractères 0, 1, I, L ni O. Vérifiez la saisie.';
    if (r.length !== 20) return `Le jeton comporte 20 caractères (4 groupes de 5) ; ${r.length} saisi(s).`;
    return null;
  }

  const f = $('#f-setup');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = f.querySelector('.alert.err'); err.hidden = true;
    const d = Object.fromEntries(new FormData(f));
    const tp = tokenProblem(d.token);
    if (tp) { showErr(err, new Error(tp)); tok.focus(); return; }
    if (d.password !== d.confirm) return showErr(err, new Error('Les deux saisies du mot de passe ne correspondent pas.'));
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    try {
      await api('POST', '/api/setup', { token: d.token, username: d.username.trim(), displayName: d.displayName, email: d.email, password: d.password }, { noRedirect: true });
      location.replace('/login');
    } catch (x) {
      showErr(err, x);
      if (x.data && ['invalid', 'expired', 'used', 'none'].includes(x.data.reason)) tok.focus();
    } finally { btn.disabled = false; }
  });
})();
