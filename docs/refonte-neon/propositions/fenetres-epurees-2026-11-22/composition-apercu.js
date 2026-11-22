/* Outil de proposition uniquement : ne pas importer dans l'application.
   Les descriptions conservent leur DOM et identifiant ; aucun champ ou formulaire n'est déplacé. */
(() => {
  if (window.__propositionFicheEpuree) return;
  window.__propositionFicheEpuree = true;
  const preparer = () => {
    if (
      document.documentElement.dataset.propositionFenetres !== 'maintenance' ||
      document.documentElement.dataset.mantineColorScheme !== 'light'
    )
      return;
    for (const racine of document.querySelectorAll('.mantine-Modal-body .mantine-InputWrapper-root')) {
      if (racine.hasAttribute('data-aide-contextuelle')) continue;
      const aide = racine.querySelector(':scope > .mantine-InputWrapper-description');
      const label = racine.querySelector('.mantine-InputWrapper-label');
      if (!aide?.id || !label) continue;
      racine.setAttribute('data-aide-contextuelle', '');
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'fiche-aide-bouton';
      bouton.setAttribute('aria-label', `Aide : ${label.textContent.replace('*', '').trim()}`);
      bouton.setAttribute('aria-controls', aide.id);
      bouton.setAttribute('aria-expanded', 'false');
      bouton.innerHTML =
        '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7v1"/></svg>';
      bouton.addEventListener('click', () => {
        const ouvert = racine.toggleAttribute('data-aide-ouverte');
        bouton.setAttribute('aria-expanded', String(ouvert));
      });
      racine.append(bouton);
    }
    for (const fenetre of document.querySelectorAll('.mantine-Modal-content')) {
      if (fenetre.querySelector('.fiche-annuler-proposition')) continue;
      const pied = fenetre.querySelector('.mantine-Modal-body > .mantine-Stack-root > .mantine-Group-root:last-child');
      if (!pied?.querySelector('.mantine-Button-root')) continue;
      const annuler = document.createElement('button');
      annuler.type = 'button';
      annuler.className = 'fiche-annuler-proposition';
      annuler.textContent = 'Annuler';
      annuler.addEventListener('click', () => fenetre.querySelector('.mantine-Modal-close')?.click());
      pied.prepend(annuler);
    }
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const boutons = document.querySelectorAll('.fiche-aide-bouton[aria-expanded="true"]');
      if (!boutons.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      for (const bouton of boutons) {
        bouton.closest('[data-aide-contextuelle]')?.removeAttribute('data-aide-ouverte');
        bouton.setAttribute('aria-expanded', 'false');
      }
      boutons[0]?.focus();
    },
    true,
  );
  new MutationObserver(preparer).observe(document.documentElement, { childList: true, subtree: true });
  preparer();
})();
