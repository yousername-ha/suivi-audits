/* Focus après un enregistrement refusé (WCAG 3.3.1 et 2.4.3) : un lecteur d'écran lit l'erreur d'un champ quand le focus
   l'atteint. Après une action refusée, le focus va donc au premier champ invalide (aria-invalid, posé par la prop
   `error` de Mantine) ou, à défaut, au message d'erreur de la fenêtre (ErrorAlert, attribut data-alerte-erreur), qui
   tient lieu de récapitulatif.
   Mécanisme commun, sans modifier les formulaires : un seul écouteur délégué au document. Une action (bouton ou envoi
   de formulaire) dans une fenêtre, un panneau ou un formulaire ouvre une attente ; si une erreur nouvelle y apparaît
   pendant cette attente alors que le focus est resté sur le déclencheur (ou a été perdu, bouton désactivé pendant
   l'envoi), le focus la rejoint. Sinon rien ne bouge : une saisie en cours n'est jamais interrompue, et la validation
   native d'un formulaire (qui focalise déjà le premier champ invalide) reste seule à agir.
   Fiches découpées en parties (FichesSansDefilement, apps/web) : la partie qui contient l'élément focalisé s'affiche. */

/** Champ en erreur : Mantine pose aria-invalid="true" sur le champ qui porte une erreur. */
export const CHAMP_INVALIDE = '[aria-invalid="true"]';
/** Message d'erreur d'une action (ErrorAlert, ou alerte marquée à la main par l'attribut). */
export const ALERTE_ERREUR = '[data-alerte-erreur]';
/** Cibles possibles du focus après un refus. */
export const CIBLES_ERREUR = `${CHAMP_INVALIDE}, ${ALERTE_ERREUR}`;
/** Conteneurs suivis : fenêtres et panneaux (hors menu de navigation), sinon formulaire de la page. */
const CADRES = '.mantine-Modal-content, .mantine-Drawer-content:not(.nav-tiroir)';
/** Commandes qui montrent ou déplient sans rien enregistrer : onglets, menus, listes, parties d'une fiche. */
const SANS_ENVOI =
  '[role="tab"], [aria-expanded], [aria-haspopup], summary, .fiche-mini-menu button, [data-sans-focus-erreur]';
/** Commandes qui lancent une action. */
const COMMANDES = 'button, [role="button"], input[type="submit"]';
/** Champs de saisie : une action lancée depuis l'un d'eux (Entrée) ne donne le focus qu'à un champ invalide. */
const CHAMPS = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
/** Durée de l'attente après l'action : une réponse du serveur plus tardive ne déplace plus le focus. */
export const ATTENTE_MS = 15_000;

const visible = (e: Element) => e.getClientRects().length > 0;
const actif = (e: Element) => !(e as HTMLInputElement).disabled && e.getAttribute('aria-disabled') !== 'true';

/** Premier champ invalide visible et actif de la racine, sinon premier message d'erreur visible (ordre du document). */
export function premiereErreur(racine: ParentNode, champsSeulement = false): HTMLElement | null {
  const champ = [...racine.querySelectorAll<HTMLElement>(CHAMP_INVALIDE)].find((e) => visible(e) && actif(e));
  if (champ || champsSeulement) return champ ?? null;
  return [...racine.querySelectorAll<HTMLElement>(ALERTE_ERREUR)].find(visible) ?? null;
}

/** Focalise la première erreur de la racine ; un message d'erreur devient focalisable par programme (tabindex -1).
    Rend l'élément focalisé, ou null. */
export function focaliserPremiereErreur(racine: ParentNode, champsSeulement = false): HTMLElement | null {
  const cible = premiereErreur(racine, champsSeulement);
  if (!cible) return null;
  if (cible.matches(ALERTE_ERREUR) && !cible.hasAttribute('tabindex')) cible.tabIndex = -1;
  cible.focus();
  return cible;
}

interface Attente {
  racine: HTMLElement;
  declencheur: HTMLElement;
  /** Élément qui avait le focus au moment de l'action (le champ d'où Entrée a envoyé le formulaire, par exemple). */
  depart: Element | null;
  /** Action lancée depuis un champ (Entrée) : seul un champ invalide reçoit le focus, le message d'erreur est annoncé
      par son rôle « alert » sans déplacer la saisie. */
  depuisChamp: boolean;
  avant: Set<Element>;
  observateur: MutationObserver;
  minuteur: ReturnType<typeof setTimeout>;
}

/** Installe la surveillance sur le document ; rend la fonction qui la retire. */
export function surveillerRefus(doc: Document = document): () => void {
  let attente: Attente | null = null;
  let demande = 0;
  const erreurs = (racine: ParentNode) => [...racine.querySelectorAll(CIBLES_ERREUR)];
  const arreter = () => {
    if (attente) {
      attente.observateur.disconnect();
      clearTimeout(attente.minuteur);
    }
    attente = null;
    if (demande) cancelAnimationFrame(demande);
    demande = 0;
  };
  const verifier = () => {
    demande = 0;
    if (!attente) return;
    const { racine, declencheur, depart, depuisChamp, avant } = attente;
    if (!racine.isConnected) return arreter();
    if (!erreurs(racine).some((e) => !avant.has(e) && visible(e))) return;
    // Le focus n'a pas bougé depuis l'action, ou il a été perdu (bouton désactivé ou retiré pendant l'envoi).
    const focus = doc.activeElement;
    const libre = !focus || focus === doc.body || !focus.isConnected || focus === declencheur || focus === depart;
    arreter();
    if (libre) focaliserPremiereErreur(racine, depuisChamp);
  };
  const commencer = (declencheur: HTMLElement) => {
    const racine = declencheur.closest<HTMLElement>(CADRES) ?? declencheur.closest<HTMLElement>('form');
    if (!racine) return;
    arreter();
    const depart = doc.activeElement;
    const depuisChamp = !!depart && depart !== declencheur && racine.contains(depart) && depart.matches(CHAMPS);
    const observateur = new MutationObserver(() => {
      if (!demande) demande = requestAnimationFrame(verifier);
    });
    observateur.observe(racine, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-invalid', 'hidden', 'style', 'class'],
    });
    const minuteur = setTimeout(arreter, ATTENTE_MS);
    attente = { racine, declencheur, depart, depuisChamp, avant: new Set(erreurs(racine)), observateur, minuteur };
  };
  const clic = (e: Event) => {
    const cible = e.target instanceof Element ? e.target : null;
    const bouton = cible?.closest<HTMLElement>(COMMANDES);
    if (!bouton || !actif(bouton) || bouton.matches(SANS_ENVOI)) return;
    commencer(bouton);
  };
  const envoi = (e: Event) => {
    if (!(e.target instanceof HTMLFormElement)) return;
    const auteur = (e as SubmitEvent).submitter;
    // Le clic sur le bouton d'envoi (y compris celui que le navigateur simule quand Entrée est pressée dans un champ) a
    // déjà ouvert l'attente ; un formulaire sans bouton d'envoi l'ouvre ici.
    if (auteur && attente?.declencheur === auteur) return;
    commencer(e.target);
  };
  doc.addEventListener('click', clic, true);
  doc.addEventListener('submit', envoi, true);
  return () => {
    arreter();
    doc.removeEventListener('click', clic, true);
    doc.removeEventListener('submit', envoi, true);
  };
}
