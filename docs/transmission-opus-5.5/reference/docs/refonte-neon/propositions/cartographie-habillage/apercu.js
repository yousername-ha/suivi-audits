/* global document, window */
/* Aperçu figé : aucun moteur applicatif embarqué, aucune requête ou écriture. */
(() => {
  const root = document.documentElement;
  document.querySelectorAll('[data-skin]').forEach((button) =>
    button.addEventListener('click', () => {
      root.dataset.habillage = button.dataset.skin;
      document.querySelectorAll('[data-skin]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    }),
  );
  document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
    const dark = root.dataset.mantineColorScheme !== 'dark';
    root.dataset.mantineColorScheme = dark ? 'dark' : 'light';
    document.querySelector('[data-theme-toggle]').textContent = dark ? 'Mode clair' : 'Mode sombre';
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.preview-switch')) return;
    const button = e.target.closest('.carte-vues button');
    if (button) {
      window.location.href = button.textContent.includes('processus') ? 'index.html' : 'contexte.html';
      return;
    }
    if (e.target.closest('button,a,input,select')) e.preventDefault();
  });
})();
