/* Tableau de bord du style « Verre » (dessin validé, décision du RSSI du 27/11/2026) : détail des dalles que la synthèse
   ne portait pas (grille des risques selon la méthode d'appréciation paramétrée, actions une par une), et calculs purs
   partagés par le serveur et l'interface. Les valeurs viennent des fiches lisibles par la personne (porte de lecture,
   ADR 0083) ; rien n'est déduit ni inventé. */
import { z } from 'zod';

const n = z.number().int().min(0);

/** Nombre de noms de risques gardés par case de la grille (le nombre total de la case reste exact). */
export const NOMS_PAR_CASE = 6;
/** Nombre d'actions détaillées renvoyées, les plus urgentes d'abord (le décompte par état reste exact). */
export const ACTIONS_DETAILLEES = 60;

/** Risque placé dans une case : de quoi le nommer et ouvrir sa fiche dans son périmètre. */
export const RisqueGrille = z.object({ id: z.string(), perimetre: z.string(), nom: z.string(), code: z.string() });
export type RisqueGrille = z.infer<typeof RisqueGrille>;

/** Grille vraisemblance × gravité de la méthode à calcul matriciel la plus utilisée par les risques lisibles : colonnes =
    niveaux de la dimension de la matrice (gravité, croissants), lignes = niveaux de vraisemblance (croissants), niveau de
    risque de chaque case tel que publié dans la méthode (indice dans `niveaux`, du plus faible au plus fort). */
export const GrilleRisques = z.object({
  methode: z.string(),
  base: z.enum(['gross', 'residual']),
  /** Libellé de la dimension portée en colonnes (« Gravité » le plus souvent). */
  axe: z.string(),
  colonnes: z.array(z.string()),
  lignes: z.array(z.string()),
  niveaux: z.array(z.string()),
  cases: z.array(
    z.object({
      colonne: n,
      ligne: n,
      niveau: z.number().int().min(0).nullable(),
      n,
      /** Les `NOMS_PAR_CASE` premiers risques de la case, par code puis par nom. */
      risques: z.array(RisqueGrille),
    }),
  ),
  /** Risques placés dans la grille. */
  places: n,
  /** Risques appréciés mais hors de la grille (autre méthode, cotation absente de la matrice). */
  horsGrille: n,
});
export type GrilleRisques = z.infer<typeof GrilleRisques>;

/** Détail de la dalle « Niveau de risque ». */
export const DetailRisques = z.object({
  /** Risques sans aucune appréciation. */
  aApprecier: n,
  /** Risques des cases au niveau le plus fort de la méthode ; null sans grille. */
  critiques: n.nullable(),
  grille: GrilleRisques.nullable(),
});
export type DetailRisques = z.infer<typeof DetailRisques>;

export const ETATS_ACTION_TDB = ['retard', 'mois', 'ouverte', 'close'] as const;
export type EtatActionTdb = (typeof ETATS_ACTION_TDB)[number];
export const LIBELLES_ETAT_ACTION_TDB: Record<EtatActionTdb, string> = {
  retard: 'En retard',
  mois: 'À échéance ce mois-ci',
  ouverte: 'Ouverte',
  close: 'Close',
};

/** Détail de la dalle « Plan d'action » : actions autonomes (hors occurrences de tâches récurrentes), décomptées par état,
    et les `ACTIONS_DETAILLEES` plus urgentes (en retard, à échéance ce mois-ci, autres ouvertes, closes). */
export const PlanActions = z.object({
  total: n,
  enRetard: n,
  ceMois: n,
  /** Ouvertes, ni en retard ni à échéance ce mois-ci. */
  autresOuvertes: n,
  closes: n,
  items: z.array(
    z.object({
      id: z.string(),
      perimetre: z.string(),
      nom: z.string(),
      echeance: z.string().nullable(),
      etat: z.enum(ETATS_ACTION_TDB),
    }),
  ),
});
export type PlanActions = z.infer<typeof PlanActions>;

/** État d'une action pour le tableau de bord, au jour civil `jour` (AAAA-MM-JJ, Paris) : close (statut terminal), en
    retard (échéance passée), à échéance ce mois-ci (échéance d'ici la fin du mois en cours), sinon ouverte. */
export function etatActionTdb(echeance: string | null, terminee: boolean, jour: string): EtatActionTdb {
  if (terminee) return 'close';
  const e = echeance && /^\d{4}-\d{2}-\d{2}$/.test(echeance) ? echeance : null;
  if (!e) return 'ouverte';
  if (e < jour) return 'retard';
  return e.slice(0, 7) === jour.slice(0, 7) ? 'mois' : 'ouverte';
}

/** Méthode d'appréciation, réduite à ce que la grille lit. */
export interface MethodeGrille {
  name: string;
  display?: { defaultBasis?: 'gross' | 'residual' };
  dimensions: { id: string; label: string; levels: { id: string; label: string; value: number }[] }[];
  likelihood: { id: string; label: string; value: number }[];
  levels: { id: string; label: string }[];
  calculation:
    | { kind: 'matrix'; dimension: string; cells: { impact: string; likelihood: string; level: string }[] }
    | { kind: string };
}

/** Risque apprécié selon la méthode de la grille : cotations de sa dernière appréciation (validée d'abord). */
export interface RisqueApprecie extends RisqueGrille {
  ratings: unknown;
}

const texte = (v: unknown) => (typeof v === 'string' ? v : '');

/** Répartition des risques dans la grille de la méthode : chaque risque va dans la case de ses cotations (base par
    défaut de la méthode : brut ou résiduel). Une méthode sans matrice ne donne pas de grille (null). Fonction pure. */
export function repartirGrilleRisques(
  methode: MethodeGrille,
  risques: readonly RisqueApprecie[],
): GrilleRisques | null {
  const calc = methode.calculation;
  if (calc.kind !== 'matrix' || !('dimension' in calc)) return null;
  const dimension = methode.dimensions.find((d) => d.id === calc.dimension);
  if (!dimension || !dimension.levels.length || !methode.likelihood.length) return null;
  const base = methode.display?.defaultBasis === 'gross' ? 'gross' : 'residual';
  const colonnes = [...dimension.levels].sort((a, b) => a.value - b.value);
  const lignes = [...methode.likelihood].sort((a, b) => a.value - b.value);
  const indiceNiveau = new Map(methode.levels.map((l, i) => [l.id, i]));
  const cases = lignes.flatMap((l, ligne) =>
    colonnes.map((c, colonne) => {
      const cellule = calc.cells.find((x) => x.impact === c.id && x.likelihood === l.id);
      return {
        colonne,
        ligne,
        niveau: cellule ? (indiceNiveau.get(cellule.level) ?? null) : null,
        tous: [] as RisqueGrille[],
      };
    }),
  );
  const colonneDe = new Map(colonnes.map((c, i) => [c.id, i]));
  const ligneDe = new Map(lignes.map((l, i) => [l.id, i]));
  let horsGrille = 0;
  for (const r of risques) {
    const cot = (r.ratings && typeof r.ratings === 'object' ? (r.ratings as Record<string, unknown>)[base] : null) as
      { dimensions?: Record<string, unknown>; likelihood?: unknown } | null | undefined;
    const colonne = colonneDe.get(texte(cot?.dimensions?.[dimension.id]));
    const ligne = ligneDe.get(texte(cot?.likelihood));
    if (colonne === undefined || ligne === undefined) {
      horsGrille++;
      continue;
    }
    cases[ligne * colonnes.length + colonne]!.tous.push({ id: r.id, perimetre: r.perimetre, nom: r.nom, code: r.code });
  }
  const ordre = (a: RisqueGrille, b: RisqueGrille) =>
    (a.code || a.nom).localeCompare(b.code || b.nom, 'fr', { numeric: true }) || a.nom.localeCompare(b.nom, 'fr');
  return {
    methode: methode.name,
    base,
    axe: dimension.label,
    colonnes: colonnes.map((c) => c.label),
    lignes: lignes.map((l) => l.label),
    niveaux: methode.levels.map((l) => l.label),
    cases: cases.map(({ tous, ...c }) => ({
      ...c,
      n: tous.length,
      risques: [...tous].sort(ordre).slice(0, NOMS_PAR_CASE),
    })),
    places: risques.length - horsGrille,
    horsGrille,
  };
}

/** Risques des cases au niveau le plus fort de l'échelle de la méthode. */
export function risquesCritiques(g: GrilleRisques): number {
  const haut = g.niveaux.length - 1;
  return g.cases.filter((c) => c.niveau === haut).reduce((s, c) => s + c.n, 0);
}
