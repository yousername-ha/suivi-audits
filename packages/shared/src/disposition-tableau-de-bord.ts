/* Disposition du tableau de bord de l'accueil (ADR 0078, lot 2a) : ordre, largeur et état masqué des dalles. Une
   disposition ne contient aucune donnée : les valeurs viennent toujours de la synthèse filtrée selon les droits de la
   personne qui regarde. Fonctions pures, testées (packages/shared/test/disposition-tableau-de-bord.test.ts). */
import { z } from 'zod';

/** Catalogue des dalles, dans l'ordre de la disposition standard (ADR 0069, lot 1). */
export const DALLES_TABLEAU_DE_BORD = [
  'phare',
  'ecarts',
  'actions-retard',
  'conformite-referentiels',
  'indicateurs',
  'actions-ecarts',
  'mise-en-oeuvre',
  'ecarts-type',
  'echeances',
  'risques-continuite',
  'recurrences',
  'plans',
  'mesures',
  'plan-audit',
  'ecarts-statut',
  'ecarts-classification',
  'ecarts-source',
] as const;
export type IdDalle = (typeof DALLES_TABLEAU_DE_BORD)[number];

/** Largeurs proposées, en colonnes sur 12 aux grands écrans. */
export const LARGEURS_DALLE = [3, 4, 6, 8, 12] as const;
export type LargeurDisposee = (typeof LARGEURS_DALLE)[number];
export const LIBELLES_LARGEUR: Record<LargeurDisposee, string> = {
  3: 'Un quart',
  4: 'Un tiers',
  6: 'La moitié',
  8: 'Deux tiers',
  12: 'Toute la largeur',
};

/** Largeur standard de chaque dalle (lot 1). Les deux jauges y partagent une demi-rangée quand les deux s'affichent. */
export const LARGEUR_STANDARD: Record<IdDalle, LargeurDisposee> = {
  phare: 6,
  ecarts: 3,
  'actions-retard': 3,
  'conformite-referentiels': 6,
  indicateurs: 3,
  'actions-ecarts': 3,
  'mise-en-oeuvre': 6,
  'ecarts-type': 6,
  echeances: 6,
  'risques-continuite': 3,
  recurrences: 3,
  plans: 4,
  mesures: 4,
  'plan-audit': 4,
  'ecarts-statut': 4,
  'ecarts-classification': 4,
  'ecarts-source': 4,
};

export const DalleDisposee = z
  .object({
    id: z.enum(DALLES_TABLEAU_DE_BORD),
    largeur: z.union([z.literal(3), z.literal(4), z.literal(6), z.literal(8), z.literal(12)]),
    masquee: z.boolean(),
  })
  .strict();
export type DalleDisposee = z.infer<typeof DalleDisposee>;

export const Disposition = z
  .object({ dalles: z.array(DalleDisposee).max(DALLES_TABLEAU_DE_BORD.length) })
  .strict()
  .refine((d) => new Set(d.dalles.map((x) => x.id)).size === d.dalles.length, 'Une dalle figure deux fois.');
export type Disposition = z.infer<typeof Disposition>;

export const DispositionBody = z.object({ disposition: Disposition }).strict();

export const DispositionEnregistree = z.object({
  disposition: Disposition,
  version: z.number().int().min(1),
  modifieePar: z.string(),
  modifieeLe: z.string(),
});
export type DispositionEnregistree = z.infer<typeof DispositionEnregistree>;

/** Disposition personnelle et disposition par défaut de l'organisation (chacune absente si non enregistrée). */
export const DispositionsOut = z.object({
  personnelle: DispositionEnregistree.nullable(),
  organisation: DispositionEnregistree.nullable(),
});
export type DispositionsOut = z.infer<typeof DispositionsOut>;

const connue = (id: unknown): id is IdDalle => (DALLES_TABLEAU_DE_BORD as readonly unknown[]).includes(id);

/** Lecture tolérante d'une disposition enregistrée : une dalle retirée du catalogue, en double ou mal formée est
    ignorée, au lieu de rendre le tableau de bord illisible après une mise à jour. */
export function lireDisposition(v: unknown): Disposition {
  const brut =
    v && typeof v === 'object' && Array.isArray((v as { dalles?: unknown }).dalles)
      ? (v as { dalles: unknown[] }).dalles
      : [];
  const vues = new Set<IdDalle>();
  const dalles: DalleDisposee[] = [];
  for (const x of brut) {
    const r = DalleDisposee.safeParse(x);
    if (r.success && connue(r.data.id) && !vues.has(r.data.id)) {
      vues.add(r.data.id);
      dalles.push(r.data);
    }
  }
  return { dalles };
}

/** Disposition complète : toutes les dalles du catalogue, une fois chacune. Celles de `d` gardent leur ordre, leur
    largeur et leur état ; les autres (dalle ajoutée depuis, ou pas de disposition) suivent, affichées, à la largeur
    donnée par `largeurs` (largeur actuellement affichée) ou à leur largeur standard. */
export function completerDisposition(
  d: Disposition | null,
  largeurs: Partial<Record<IdDalle, LargeurDisposee>> = {},
): Disposition {
  const dalles = (d?.dalles ?? []).filter((x) => connue(x.id));
  const presentes = new Set(dalles.map((x) => x.id));
  for (const id of DALLES_TABLEAU_DE_BORD)
    if (!presentes.has(id)) dalles.push({ id, largeur: largeurs[id] ?? LARGEUR_STANDARD[id], masquee: false });
  return { dalles };
}

/** Dalles à afficher, dans l'ordre : présentes dans la disposition, non masquées et ayant des données (`disponibles`). */
export function dallesAffichees(d: Disposition, disponibles: ReadonlySet<IdDalle>): DalleDisposee[] {
  return d.dalles.filter((x) => !x.masquee && disponibles.has(x.id));
}

/** Déplace la dalle `id` juste avant (ou juste après) la dalle `cible`. Sans effet si l'une manque ou si c'est la même. */
export function deplacerDalle(d: Disposition, id: IdDalle, cible: IdDalle, apres = false): Disposition {
  if (id === cible) return d;
  const x = d.dalles.find((y) => y.id === id);
  if (!x || !d.dalles.some((y) => y.id === cible)) return d;
  const reste = d.dalles.filter((y) => y.id !== id);
  const i = reste.findIndex((y) => y.id === cible) + (apres ? 1 : 0);
  return { dalles: [...reste.slice(0, i), x, ...reste.slice(i)] };
}

/** Déplacement au clavier, parmi les dalles affichées : d'un rang (`-1`, `+1`), en premier (`'debut'`) ou en dernier
    (`'fin'`). Les dalles masquées ou sans données gardent leur place relative. Renvoie la disposition et le nouveau rang
    (à partir de 1) parmi les dalles affichées. */
export function deplacerDalleAuClavier(
  d: Disposition,
  id: IdDalle,
  sens: -1 | 1 | 'debut' | 'fin',
  disponibles: ReadonlySet<IdDalle>,
): { disposition: Disposition; rang: number; total: number } {
  const vues = dallesAffichees(d, disponibles).map((x) => x.id);
  const i = vues.indexOf(id);
  let suivante = d;
  if (i >= 0 && vues.length > 1) {
    if (sens === 'debut' && i > 0) suivante = deplacerDalle(d, id, vues[0]!);
    else if (sens === 'fin' && i < vues.length - 1) suivante = deplacerDalle(d, id, vues[vues.length - 1]!, true);
    else if (sens === -1 && i > 0) suivante = deplacerDalle(d, id, vues[i - 1]!);
    else if (sens === 1 && i < vues.length - 1) suivante = deplacerDalle(d, id, vues[i + 1]!, true);
  }
  const apres = dallesAffichees(suivante, disponibles).map((x) => x.id);
  return { disposition: suivante, rang: apres.indexOf(id) + 1, total: apres.length };
}

/** Change la largeur ou l'état masqué d'une dalle. */
export function modifierDalle(d: Disposition, id: IdDalle, champs: Partial<Omit<DalleDisposee, 'id'>>): Disposition {
  return { dalles: d.dalles.map((x) => (x.id === id ? { ...x, ...champs } : x)) };
}

/** Deux dispositions identiques (ordre, largeurs, états) : rien à enregistrer. */
export const memesDispositions = (a: Disposition, b: Disposition) =>
  a.dalles.length === b.dalles.length &&
  a.dalles.every((x, i) => {
    const y = b.dalles[i]!;
    return x.id === y.id && x.largeur === y.largeur && x.masquee === y.masquee;
  });
