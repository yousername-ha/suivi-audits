/* Disposition du tableau de bord de l'accueil (ADR 0078) : ordre, largeur et état masqué des dalles (lot 2a), seuils,
   cible et visualisation de chacune (lot 2c). Une disposition ne contient aucune donnée : les valeurs viennent toujours
   de la synthèse filtrée selon les droits de la personne qui regarde. Fonctions pures, testées (packages/shared/test/disposition-tableau-de-bord.test.ts). */
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

/** Visualisations proposées (lot 2c) ; chaque dalle n'en accepte que certaines (`REGLAGES_DALLE`). */
export const VISUALISATIONS = ['barres', 'anneau', 'histogramme', 'tableau', 'empilees', 'jauge', 'chiffre'] as const;
export type Visualisation = (typeof VISUALISATIONS)[number];
export const LIBELLES_VISUALISATION: Record<Visualisation, string> = {
  barres: 'Barres horizontales',
  anneau: 'Anneau',
  histogramme: 'Histogramme',
  tableau: 'Tableau',
  empilees: 'Barres empilées',
  jauge: 'Jauge',
  chiffre: 'Chiffre clé',
};

/** Réglages possibles de chaque dalle (lot 2c) : seuils de couleur d'un taux (orange et vert à partir de…), seuils de
    jours (carte phare : jours avant l'audit), cible facultative (trait) et visualisations compatibles, la première étant
    la visualisation standard. Une dalle absente n'a aucun réglage. */
export const REGLAGES_DALLE: Partial<
  Record<IdDalle, { seuils?: true; seuilsJours?: true; cible?: true; visualisations?: readonly Visualisation[] }>
> = {
  phare: { seuils: true, seuilsJours: true },
  'conformite-referentiels': { seuils: true, cible: true, visualisations: ['barres', 'tableau'] },
  indicateurs: { seuils: true, cible: true, visualisations: ['jauge', 'chiffre'] },
  'actions-ecarts': { seuils: true, cible: true, visualisations: ['jauge', 'chiffre'] },
  'mise-en-oeuvre': { visualisations: ['empilees', 'tableau'] },
  'ecarts-type': { visualisations: ['anneau', 'barres', 'histogramme'] },
  mesures: { visualisations: ['barres', 'anneau', 'histogramme'] },
  'ecarts-statut': { visualisations: ['barres', 'anneau', 'histogramme'] },
  'ecarts-classification': { visualisations: ['barres', 'anneau', 'histogramme'] },
  'ecarts-source': { visualisations: ['barres', 'anneau', 'histogramme'] },
};

/** Seuils standard (ADR 0069) : taux rouge sous 60 %, orange de 60 à 80 %, vert à partir de 80 % ; jours avant
    l'audit rouge sous 30, orange de 30 à 60, vert à partir de 60. */
export const SEUILS_STANDARD = { orange: 60, vert: 80 } as const;
export const SEUILS_JOURS_STANDARD = { orange: 30, vert: 60 } as const;

const paliers = (max: number) =>
  z
    .object({ orange: z.number().int().min(0).max(max), vert: z.number().int().min(0).max(max) })
    .strict()
    .refine((x) => x.orange <= x.vert, 'Le seuil orange ne peut pas dépasser le seuil vert.');
export const ReglagesDalle = z
  .object({
    seuils: paliers(100).optional(),
    seuilsJours: paliers(365).optional(),
    cible: z.number().int().min(0).max(100).optional(),
    visualisation: z.enum(VISUALISATIONS).optional(),
  })
  .strict();
export type ReglagesDalle = z.infer<typeof ReglagesDalle>;

export const DalleDisposee = z
  .object({
    id: z.enum(DALLES_TABLEAU_DE_BORD),
    largeur: z.union([z.literal(3), z.literal(4), z.literal(6), z.literal(8), z.literal(12)]),
    masquee: z.boolean(),
    reglages: ReglagesDalle.optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    for (const m of reglagesRefuses(d)) ctx.addIssue({ code: 'custom', path: ['reglages'], message: m });
  });
export type DalleDisposee = z.infer<typeof DalleDisposee>;

/** Réglages qu'une dalle n'accepte pas (seuils, cible ou visualisation hors de `REGLAGES_DALLE`). */
function reglagesRefuses(d: { id: IdDalle; reglages?: ReglagesDalle }): string[] {
  const r = d.reglages;
  if (!r) return [];
  const permis = REGLAGES_DALLE[d.id] ?? {};
  const refus: string[] = [];
  if (r.seuils && !permis.seuils) refus.push(`La dalle « ${d.id} » n’a pas de seuils de taux.`);
  if (r.seuilsJours && !permis.seuilsJours) refus.push(`La dalle « ${d.id} » n’a pas de seuils de jours.`);
  if (r.cible !== undefined && !permis.cible) refus.push(`La dalle « ${d.id} » n’a pas de cible.`);
  if (r.visualisation && !permis.visualisations?.includes(r.visualisation))
    refus.push(`Visualisation « ${r.visualisation} » impossible pour la dalle « ${d.id} ».`);
  return refus;
}

export const Disposition = z
  .object({ dalles: z.array(DalleDisposee).max(DALLES_TABLEAU_DE_BORD.length) })
  .strict()
  .refine((d) => new Set(d.dalles.map((x) => x.id)).size === d.dalles.length, 'Une dalle figure deux fois.');
export type Disposition = z.infer<typeof Disposition>;

export const DispositionBody = z.object({ disposition: Disposition }).strict();

export const DispositionEnregistree = z.object({
  id: z.uuid(),
  disposition: Disposition,
  version: z.number().int().min(1),
  modifieePar: z.string(),
  modifieeLe: z.string(),
});
export type DispositionEnregistree = z.infer<typeof DispositionEnregistree>;

/** Tableau de bord partagé avec la personne (lot 2b) : la disposition seule et le nom de son auteur. */
export const TableauPartage = DispositionEnregistree.extend({ auteur: z.string() });
export type TableauPartage = z.infer<typeof TableauPartage>;

/** Disposition personnelle, disposition par défaut de l'organisation (chacune absente si non enregistrée), tableaux
    partagés avec la personne et tableau qu'elle a choisi d'afficher (null : le sien, sinon celui de l'organisation). */
export const DispositionsOut = z.object({
  personnelle: DispositionEnregistree.nullable(),
  organisation: DispositionEnregistree.nullable(),
  partages: z.array(TableauPartage),
  choix: z.uuid().nullable(),
});
export type DispositionsOut = z.infer<typeof DispositionsOut>;

/** Tableau affiché à l'accueil : un tableau visible par la personne, ou null pour le choix automatique. */
export const ChoixTableauBody = z.object({ tableau: z.uuid().nullable() }).strict();

/** Destinataire d'un partage : un compte ou un groupe. */
export const DestinatairePartage = z.object({ type: z.enum(['utilisateur', 'groupe']), id: z.uuid() }).strict();
export type DestinatairePartage = z.infer<typeof DestinatairePartage>;
export const MAX_DESTINATAIRES = 200;
export const PartageBody = z
  .object({ destinataires: z.array(DestinatairePartage).max(MAX_DESTINATAIRES) })
  .strict()
  .refine(
    (b) => new Set(b.destinataires.map((d) => `${d.type}:${d.id}`)).size === b.destinataires.length,
    'Un destinataire figure deux fois.',
  );
export const PartageOut = z.object({
  destinataires: z.array(DestinatairePartage.extend({ nom: z.string() })),
  /** Version du tableau personnel (0 : pas encore enregistré, donc pas encore partageable). */
  version: z.number().int().min(0),
});
export type PartageOut = z.infer<typeof PartageOut>;

/** Annuaire des destinataires possibles (droit tableau_de_bord:modifier) : comptes actifs et groupes, sans courriel. */
export const AnnuaireTableauDeBord = z.object({
  utilisateurs: z.array(z.object({ id: z.uuid(), nom: z.string(), identifiant: z.string() })),
  groupes: z.array(z.object({ id: z.uuid(), nom: z.string(), membres: z.number().int() })),
});
export type AnnuaireTableauDeBord = z.infer<typeof AnnuaireTableauDeBord>;

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
    // Des réglages devenus invalides (visualisation retirée, par exemple) sont abandonnés, la dalle reste.
    let r = DalleDisposee.safeParse(x);
    if (!r.success && x && typeof x === 'object' && 'reglages' in x) {
      const { reglages: _ignores, ...sans } = x as Record<string, unknown>;
      r = DalleDisposee.safeParse(sans);
    }
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

/** Change la largeur, l'état masqué ou les réglages d'une dalle (des réglages vides sont retirés). */
export function modifierDalle(d: Disposition, id: IdDalle, champs: Partial<Omit<DalleDisposee, 'id'>>): Disposition {
  return {
    dalles: d.dalles.map((x) => {
      if (x.id !== id) return x;
      const y = { ...x, ...champs };
      const r = y.reglages && Object.fromEntries(Object.entries(y.reglages).filter(([, v]) => v !== undefined));
      if (r && Object.keys(r).length) return { ...y, reglages: r };
      const { reglages: _vides, ...sans } = y;
      return sans;
    }),
  };
}

const memesReglages = (a?: ReglagesDalle, b?: ReglagesDalle) =>
  a?.seuils?.orange === b?.seuils?.orange &&
  a?.seuils?.vert === b?.seuils?.vert &&
  a?.seuilsJours?.orange === b?.seuilsJours?.orange &&
  a?.seuilsJours?.vert === b?.seuilsJours?.vert &&
  a?.cible === b?.cible &&
  a?.visualisation === b?.visualisation;

/** Deux dispositions identiques (ordre, largeurs, états, réglages) : rien à enregistrer. */
export const memesDispositions = (a: Disposition, b: Disposition) =>
  a.dalles.length === b.dalles.length &&
  a.dalles.every((x, i) => {
    const y = b.dalles[i]!;
    return x.id === y.id && x.largeur === y.largeur && x.masquee === y.masquee && memesReglages(x.reglages, y.reglages);
  });

/** Visualisation retenue pour une dalle : la sienne si elle est permise, sinon la standard (null : sans choix). */
export function visualisationDalle(id: IdDalle, r?: ReglagesDalle): Visualisation | null {
  const permises = REGLAGES_DALLE[id]?.visualisations;
  if (!permises) return null;
  return r?.visualisation && permises.includes(r.visualisation) ? r.visualisation : permises[0]!;
}
