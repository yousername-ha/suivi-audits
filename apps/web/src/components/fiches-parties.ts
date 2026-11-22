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
    - Sinon la partie prolonge la section en cours : « Analyse (suite) », puis « Analyse (suite 2) ». */
export function nommerParties(total: number, reperes: RepereDePartie[]): string[] {
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
  return parties.map(({ base, suite }) => {
    const rang = Math.max((rencontres.get(base) ?? 0) + 1, suite ? 2 : 1);
    rencontres.set(base, rang);
    return rang === 1 ? base : rang === 2 ? `${base} (suite)` : `${base} (suite ${rang - 1})`;
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
