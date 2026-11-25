/* Parties d'une fiche longue : règles pures (intitulés, pied de fenêtre), séparées du composant qui mesure l'écran pour
   être vérifiées sans navigateur. */

/** Repère rencontré dans la fiche, dans l'ordre du document. `explicite` : section déclarée par le formulaire
    (attribut data-fiche-section) ; `enTete` : le titre ouvre sa partie (rien d'important avant lui). */
export interface RepereDePartie {
  page: number;
  titre: string;
  explicite: boolean;
  enTete: boolean;
}

export const PREMIERE_PARTIE = 'Informations';
const LONGUEUR_MAX = 30;

/** Intitulé d'onglet tiré d'un titre de section : sans la parenthèse d'explication finale, borné en longueur. */
export function titreCourt(texte: string): string {
  const t = texte
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  return t.length > LONGUEUR_MAX ? `${t.slice(0, LONGUEUR_MAX - 1)}…` : t;
}

/** Un intitulé par partie, jamais générique ni répété.
    - Une section déclarée par le formulaire nomme la partie qu'elle ouvre.
    - À défaut, un titre placé en tête de partie la nomme.
    - Sinon la partie prolonge la section en cours : son nom si aucune partie ne le porte encore (section ouverte au
      milieu de la partie précédente), puis « Analyse (suite) ».
    - Un formulaire sans section (« Informations ») ou une section qui s'étend sur plus de deux parties : la partie
      porte le libellé de son premier champ, suivi de points de suspension (« Échéance… »), quand le composant le
      fournit dans `champs` ; à défaut « … (suite 2) ». */
export function nommerParties(total: number, reperes: RepereDePartie[], champs: (string | undefined)[] = []): string[] {
  const parties: { base: string; suite: boolean }[] = [];
  let enCours = PREMIERE_PARTIE;
  for (let p = 0; p < total; p++) {
    const surPage = reperes.filter((r) => r.page === p && r.titre);
    const tete = surPage.find((r) => r.explicite) ?? (p > 0 ? surPage.find((r) => r.enTete) : undefined);
    parties.push({ base: tete ? tete.titre : enCours, suite: !tete && p > 0 });
    // La section en cours à la fin de la partie est la dernière ouverte sur celle-ci.
    enCours = surPage.at(-1)?.titre ?? parties[p]!.base;
  }
  const rencontres = new Map<string, number>();
  const pris = new Set<string>();
  return parties.map(({ base, suite }, p) => {
    // Une section ouverte au milieu de la partie précédente et qui se poursuit ici donne son nom à cette partie, sans
    // « (suite) » : aucune partie ne porte encore ce nom.
    const rang = Math.max((rencontres.get(base) ?? 0) + 1, suite && base === PREMIERE_PARTIE ? 2 : 1);
    rencontres.set(base, rang);
    let nom = rang === 1 ? base : rang === 2 ? `${base} (suite)` : `${base} (suite ${rang - 1})`;
    const champ = titreCourt(champs[p] ?? '');
    if (champ && rang >= (base === PREMIERE_PARTIE ? 2 : 3)) {
      const parChamp = champ.endsWith('…') ? champ : `${champ}…`;
      if (!pris.has(parChamp)) nom = parChamp;
    }
    pris.add(nom);
    return nom;
  });
}

const ENVELOPPES = 'form, fieldset, .mantine-Stack-root, .mantine-Box-root';
const PROFONDEUR_MAX = 5;

/** Pied de la fenêtre : la rangée d'actions déclarée (.fenetre-actions), sinon le dernier groupe de boutons en bout de
    formulaire, y compris quand il est enveloppé dans un formulaire ou une pile. Aucun pied reconnu : les boutons
    restent à leur place, dans la dernière partie. */
export function trouverPied(corps: HTMLElement, visible: (e: Element) => boolean = () => true): HTMLElement | null {
  const declares = [...corps.querySelectorAll<HTMLElement>('.fenetre-actions')].filter(visible);
  if (declares.length) return declares.at(-1)!;
  let courant: Element = corps;
  for (let i = 0; i < PROFONDEUR_MAX; i++) {
    const dernier = [...courant.children].reverse().find((c) => c instanceof HTMLElement && visible(c));
    if (!(dernier instanceof HTMLElement)) return null;
    if (dernier.matches('.mantine-Group-root') && dernier.querySelector(':scope > .mantine-Button-root'))
      return dernier;
    if (!dernier.matches(ENVELOPPES)) return null;
    courant = dernier;
  }
  return null;
}

/** Issue d'un calcul de la fiche : découpée en parties, ou défilement habituel. */
export type IssueFiche = 'decoupee' | 'defilement';
/** Suivi des issues successives obtenues sans changement du contenu, de l'écran ni des préférences d'affichage. */
export interface SuiviIssues {
  derniere: IssueFiche | null;
  bascules: number;
}
export const SUIVI_INITIAL: SuiviIssues = { derniere: null, bascules: 0 };
/** Bascules (découpée puis défilement, ou l'inverse) au-delà desquelles le découpage est jugé instable. */
export const BASCULES_MAX = 2;

/** Note l'issue d'un calcul. Une fiche peut changer de taille selon sa mise en page (largeur du contenu, retours à la
    ligne) : découpée, elle repasse au défilement habituel ; au défilement, elle redevient découpable, et chaque issue
    relance l'autre par l'observateur de taille. Ce va-et-vient occupait le navigateur tant que la fenêtre restait
    ouverte (fenêtre « Sauvegardes et restauration », 24/11/2026). */
export function noterIssue(suivi: SuiviIssues, issue: IssueFiche): SuiviIssues {
  return {
    derniere: issue,
    bascules: suivi.derniere !== null && suivi.derniere !== issue ? suivi.bascules + 1 : suivi.bascules,
  };
}

/** Découpage instable : la fiche garde son défilement habituel jusqu'au prochain changement du contenu, de l'écran ou
    des préférences d'affichage. */
export const decoupageInstable = (suivi: SuiviIssues) => suivi.bascules >= BASCULES_MAX;
