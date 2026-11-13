/* global document, MutationObserver */
(() => {
  'use strict';
  const root = document.documentElement;
  const button = document.getElementById('glass-compare');
  button.addEventListener('click', () => {
    const retained = root.dataset.menuGlass !== 'off';
    root.dataset.menuGlass = retained ? 'off' : 'on';
    button.textContent = retained ? 'Revenir à l’essai transparent' : 'Comparer au bleu retenu';
  });
  const update = () => {
    button.disabled = root.dataset.theme !== 'light';
  };
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  update();
})();
