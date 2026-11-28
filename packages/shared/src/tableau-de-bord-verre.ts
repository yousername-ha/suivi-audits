/* Tableau de bord du style « Verre » (dessin validé, décisions du RSSI du 27 et du 28/11/2026) : détail des dalles que la
   synthèse ne portait pas (grilles des risques selon les méthodes d'appréciation paramétrées, actions une par une avec
   leur état, leur retard et leur priorité), et calculs purs partagés par le serveur et l'interface. Les valeurs viennent
   des fiches lisibles par la personne (porte de lecture, ADR 0083) ; rien n'est déduit ni inventé. */
import { z } from 'zod';

const n = z.number().int().min(0);

/** Nombre de noms de risques gardés par case de la grille (le nombre total de la case reste exact). */
export const NOMS_PAR_CASE = 6;
/** Nombre d'actions détaillées renvoyées, les plus urgentes d'abord (les décomptes restent exacts). */
export const ACTIONS_DETAILLEES = 60;

/** Risque placé dans une case : de quoi le nommer et ouvrir sa fiche dans son périmètre. */
export const RisqueGrille = z.object({ id: z.string(), perimetre: z.string(), nom: z.string(), code: z.string() });
export type RisqueGrille = z.infer<typeof RisqueGrille>;

/** Grille vraisemblance × gravité d'une méthode à calcul matriciel utilisée par les risques lisibles : colonnes =
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
  /** Risques appréciés selon la méthode mais hors de sa grille (cotation absente de la matrice, autre base). */
  horsGrille: n,
});
export type GrilleRisques = z.infer<typeof GrilleRisques>;

/** Détail de la dalle « Niveau de risque ». */
export const DetailRisques = z.object({
  /** Risques sans aucune appréciation. */
  aApprecier: n,
  /** Risques des cases au niveau le plus fort de la méthode de `grille` ; null sans grille. */
  critiques: n.nullable(),
  /** Grille de la méthode la plus utilisée : première de `grilles` (compatibilité). */
  grille: GrilleRisques.nullable(),
  /** Une grille par méthode à calcul matriciel utilisée par les risques lisibles (28/11/2026), du plus grand nombre de
      risques appréciés au plus petit, puis par nom de méthode ; `horsGrille` n'y compte que les risques de la méthode
      hors de sa matrice. Absent d'une synthèse antérieure. */
  grilles: z.array(GrilleRisques).optional(),
});
export type DetailRisques = z.infer<typeof DetailRisques>;

/** État d'une action au tableau de bord (décision du RSSI du 28/11/2026) : à faire (statut initial de la politique),
    en cours (autre statut non terminal), planifiée (statut initial et début postérieur au jour), terminée (statut
    terminal). Le retard et la priorité haute sont deux marquages à part. */
export const ETATS_ACTION_TDB = ['a_faire', 'en_cours', 'planifiee', 'terminee'] as const;
export type EtatActionTdb = (typeof ETATS_ACTION_TDB)[number];
export const LIBELLES_ETAT_ACTION_TDB: Record<EtatActionTdb, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  planifiee: 'Planifiée',
  terminee: 'Terminée',
};
/** Priorités d'une action marquées « prioritaire » au tableau de bord. */
export const PRIORITES_HAUTES = ['high', 'urgent'] as const;

/** Détail de la dalle « Plan d'action » : actions autonomes (hors occurrences de tâches récurrentes), décomptées par état
    et par marquage (en retard et prioritaires parmi les non terminées), et les `ACTIONS_DETAILLEES` premières dans l'ordre
    de `rangActionTdb` (en retard, prioritaires, à faire ou en cours par échéance, planifiées, terminées). */
export const PlanActions = z.object({
  total: n,
  aFaire: n,
  enCours: n,
  planifiees: n,
  terminees: n,
  enRetard: n,
  prioritaires: n,
  items: z.array(
    z.object({
      id: z.string(),
      perimetre: z.string(),
      nom: z.string(),
      echeance: z.string().nullable(),
      etat: z.enum(ETATS_ACTION_TDB),
      retard: z.boolean(),
      prioritaire: z.boolean(),
    }),
  ),
});
export type PlanActions = z.infer<typeof PlanActions>;

/** Jour civil (AAAA-MM-JJ) d'une date de fiche (jour seul ou instant ISO), sinon null. */
export function jourCivil(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const j = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : null;
}

/** Ce que l'état d'une action au tableau de bord lit de sa fiche et de la politique métier de son périmètre. */
export interface ActionPourTdb {
  /** Statut terminal de la politique. */
  terminee: boolean;
  /** Statut initial : le premier de la politique (non démarré, `todo` par défaut). */
  initiale: boolean;
  /** Début (`startAt`) et échéance (`dueAt`) : jour seul ou instant ISO, lus au jour civil. */
  debut: unknown;
  echeance: unknown;
  priorite: unknown;
}
export interface EtatAction {
  etat: EtatActionTdb;
  retard: boolean;
  prioritaire: boolean;
}

/** État et marquages d'une action au jour civil `jour` (AAAA-MM-JJ, Paris). Terminée : statut terminal ; planifiée :
    statut initial et début strictement postérieur au jour ; à faire : statut initial sans début futur ; en cours : tout
    autre statut non terminal. En retard : non terminée et échéance antérieure au jour. Prioritaire : non terminée et
    priorité haute ou urgente (décision du RSSI du 28/11/2026 : pas de contour or sur une action terminée). Même règle que la requête du serveur. Fonction pure. */
export function etatActionTdb(a: ActionPourTdb, jour: string): EtatAction {
  const debut = jourCivil(a.debut),
    echeance = jourCivil(a.echeance);
  const etat: EtatActionTdb = a.terminee
    ? 'terminee'
    : a.initiale
      ? debut && debut > jour
        ? 'planifiee'
        : 'a_faire'
      : 'en_cours';
  return {
    etat,
    retard: !a.terminee && !!echeance && echeance < jour,
    prioritaire: !a.terminee && (PRIORITES_HAUTES as readonly unknown[]).includes(a.priorite),
  };
}

/** Rang d'une action dans la dalle, du plus urgent au moins urgent : 0 en retard, 1 prioritaire, 2 à faire ou en cours,
    3 planifiée, 4 terminée. À rang égal : échéance la plus proche d'abord (sans échéance à la fin), puis intitulé. */
export function rangActionTdb(a: EtatAction): number {
  if (a.etat === 'terminee') return 4;
  if (a.retard) return 0;
  if (a.prioritaire) return 1;
  return a.etat === 'planifiee' ? 3 : 2;
}

/** Comparaison de deux actions selon `rangActionTdb`, puis l'échéance, l'intitulé et l'identifiant. */
export function comparerActionsTdb(
  a: EtatAction & { echeance: string | null; nom: string; id: string },
  b: EtatAction & { echeance: string | null; nom: string; id: string },
): number {
  const ea = jourCivil(a.echeance),
    eb = jourCivil(b.echeance);
  return (
    rangActionTdb(a) - rangActionTdb(b) ||
    (ea === eb ? 0 : ea === null ? 1 : eb === null ? -1 : ea < eb ? -1 : 1) ||
    (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
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
