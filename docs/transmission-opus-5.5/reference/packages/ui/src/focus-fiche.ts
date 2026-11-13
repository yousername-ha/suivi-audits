let origine: { element: WeakRef<HTMLElement>; id: string; adresse: string } | undefined;

/** Les fenêtres montées directement ouvertes n'ont pas toujours un élément de retour dans Mantine. */
export function retenirFocusFiche(element: HTMLElement) {
  origine = { element: new WeakRef(element), id: element.id, adresse: window.location.href };
}

export function rendreFocusFiche() {
  if (!origine) return;
  const ancien = origine.element.deref();
  const element = ancien?.isConnected ? ancien : origine.id ? document.getElementById(origine.id) : null;
  if (!element?.isConnected || origine.adresse !== window.location.href) {
    origine = undefined;
    return;
  }
  // Une nouvelle fiche existe dès son entrée à opacité zéro : l'ancienne ne doit pas alors
  // consommer le déclencheur partagé. Le retour se fait après retrait du dernier dialogue.
  const fenetreOuverte = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(
    (d) => d.getClientRects().length,
  );
  if (fenetreOuverte) return;
  // Mantine peut déjà avoir rendu le focus à un ancien déclencheur : celui de cette ouverture reste prioritaire.
  element.focus({ preventScroll: true });
  origine = undefined;
}
