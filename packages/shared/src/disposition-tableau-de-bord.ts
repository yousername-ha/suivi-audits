/* Disposition du tableau de bord de l'accueil (ADR 0078) : ordre, largeur et état masqué des dalles (lot 2a), seuils,
   cible et visualisation de chacune (lot 2c). Tableau de bord unique (ADR 0108) : les cartes de la vue analytique Neon
   rejoignent le catalogue, une dalle peut figurer plusieurs fois (chaque copie a sa clé) et sa hauteur se règle ; la
   disposition standard est celle de la vue analytique. Une disposition ne contient aucune donnée : les valeurs viennent
   toujours de la synthèse filtrée selon les droits de la personne qui regarde. Fonctions pures, testées
   (packages/shared/test/disposition-tableau-de-bord.test.ts). */
import { z } from 'zod';

/** Catalogue des dalles : celles du tableau personnalisable (ADR 0069, lot 1), puis les cartes de la vue analytique Neon
    (ADR 0093), qui forment la disposition standard (ADR 0108, `DALLES_STANDARD`). */
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
  'bandeau',
  'conformite',
  'applicabilite',
  'niveau-risque',
  'incidents',
  'constats',
  'plan-action',
  'maturite',
  'actions-etats',
  'journal',
  'vue-consolidee',
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
  bandeau: 3,
  conformite: 3,
  applicabilite: 3,
  'niveau-risque': 3,
  incidents: 3,
  constats: 3,
  'plan-action': 3,
  maturite: 3,
  'actions-etats': 3,
  journal: 3,
  'vue-consolidee': 3,
};

/** Disposition standard (ADR 0108) : les cartes de la vue analytique Neon, dans son ordre. Les autres dalles du catalogue
    y sont masquées : on les ajoute depuis le catalogue du mode modification. */
export const DALLES_STANDARD: readonly IdDalle[] = [
  'bandeau',
  'conformite',
  'applicabilite',
  'niveau-risque',
  'incidents',
  'constats',
  'plan-action',
  'maturite',
  'actions-etats',
  'journal',
  'vue-consolidee',
];

/** Hauteurs proposées, en lignes de la grille (ADR 0108) : quatre lignes font une rangée, la hauteur minimale d'une
    carte de la vue analytique. */
export const HAUTEURS_DALLE = [2, 3, 4, 5, 6, 8, 10, 12] as const;
export type HauteurDisposee = (typeof HAUTEURS_DALLE)[number];
export const LIBELLES_HAUTEUR: Record<HauteurDisposee, string> = {
  2: 'Une demi-rangée',
  3: 'Trois quarts de rangée',
  4: 'Une rangée',
  5: 'Une rangée et quart',
  6: 'Une rangée et demie',
  8: 'Deux rangées',
  10: 'Deux rangées et demie',
  12: 'Trois rangées',
};

/** Hauteur standard de chaque dalle : une rangée. La hauteur est un minimum : une dalle ne descend jamais sous son
    contenu, qui reste entièrement visible. */
export const HAUTEUR_STANDARD: Record<IdDalle, HauteurDisposee> = {
  phare: 4,
  ecarts: 4,
  'actions-retard': 4,
  'conformite-referentiels': 4,
  indicateurs: 4,
  'actions-ecarts': 4,
  'mise-en-oeuvre': 4,
  'ecarts-type': 4,
  echeances: 4,
  'risques-continuite': 4,
  recurrences: 4,
  plans: 4,
  mesures: 4,
  'plan-audit': 4,
  'ecarts-statut': 4,
  'ecarts-classification': 4,
  'ecarts-source': 4,
  bandeau: 4,
  conformite: 4,
  applicabilite: 4,
  'niveau-risque': 4,
  incidents: 4,
  constats: 4,
  'plan-action': 4,
  maturite: 4,
  'actions-etats': 4,
  journal: 4,
  'vue-consolidee': 4,
};

/** Nombre maximal de dalles d'une disposition, copies comprises. */
export const MAX_DALLES = 64;

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
    /** Copie d'une dalle déjà présente (ADR 0108) : « id~n », n à partir de 2. Absente pour la première. */
    cle: z
      .string()
      .regex(/^[a-z-]+~[1-9][0-9]{0,2}$/)
      .optional(),
    largeur: z.union([z.literal(3), z.literal(4), z.literal(6), z.literal(8), z.literal(12)]),
    /** Hauteur en lignes de la grille (ADR 0108) ; absente : la hauteur standard de la dalle. */
    hauteur: z
      .union([
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(8),
        z.literal(10),
        z.literal(12),
      ])
      .optional(),
    masquee: z.boolean(),
    reglages: ReglagesDalle.optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.cle !== undefined && !d.cle.startsWith(`${d.id}~`))
      ctx.addIssue({
        code: 'custom',
        path: ['cle'],
        message: `La clé « ${d.cle} » ne désigne pas la dalle « ${d.id} ».`,
      });
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
  .object({ dalles: z.array(DalleDisposee).max(MAX_DALLES) })
  .strict()
  .refine((d) => new Set(d.dalles.map(cleDalle)).size === d.dalles.length, 'Une dalle figure deux fois.');
export type Disposition = z.infer<typeof Disposition>;

/** Annuaire des destinataires possibles (droit tableau_de_bord:modifier) : comptes actifs et groupes, sans courriel. */
export const AnnuaireTableauDeBord = z.object({
  utilisateurs: z.array(z.object({ id: z.uuid(), nom: z.string(), identifiant: z.string() })),
  groupes: z.array(z.object({ id: z.uuid(), nom: z.string(), membres: z.number().int() })),
  /** Rôles, prédéfinis et personnalisés (destinataires d'un tableau, ADR 0109). */
  roles: z.array(z.object({ id: z.string(), nom: z.string() })),
});
export type AnnuaireTableauDeBord = z.infer<typeof AnnuaireTableauDeBord>;

/** Clé d'une dalle dans la disposition : son identifiant, ou la clé de sa copie (ADR 0108). */
export function cleDalle(x: { id: IdDalle; cle?: string }): string {
  return x.cle ?? x.id;
}

/** Hauteur retenue pour une dalle : la sienne, sinon sa hauteur standard. */
export function hauteurDalle(x: { id: IdDalle; hauteur?: HauteurDisposee }): HauteurDisposee {
  return x.hauteur ?? HAUTEUR_STANDARD[x.id];
}

const connue = (id: unknown): id is IdDalle => (DALLES_TABLEAU_DE_BORD as readonly unknown[]).includes(id);

/** Lecture tolérante d'une disposition enregistrée : une dalle retirée du catalogue, en double ou mal formée est
    ignorée, au lieu de rendre le tableau de bord illisible après une mise à jour. */
export function lireDisposition(v: unknown): Disposition {
  const brut =
    v && typeof v === 'object' && Array.isArray((v as { dalles?: unknown }).dalles)
      ? (v as { dalles: unknown[] }).dalles
      : [];
  const vues = new Set<string>();
  const dalles: DalleDisposee[] = [];
  for (const x of brut) {
    if (dalles.length >= MAX_DALLES) break;
    // Des réglages devenus invalides (visualisation retirée, par exemple) sont abandonnés, la dalle reste.
    let r = DalleDisposee.safeParse(x);
    if (!r.success && x && typeof x === 'object' && 'reglages' in x) {
      const { reglages: _ignores, ...sans } = x as Record<string, unknown>;
      r = DalleDisposee.safeParse(sans);
    }
    if (r.success && connue(r.data.id) && !vues.has(cleDalle(r.data))) {
      vues.add(cleDalle(r.data));
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

/** Disposition standard (ADR 0108) : les cartes de la vue analytique, affichées dans son ordre, puis les autres dalles
    du catalogue, masquées, à leur largeur standard. */
export function dispositionStandard(): Disposition {
  const standard = new Set(DALLES_STANDARD);
  return {
    dalles: [
      ...DALLES_STANDARD.map((id) => ({ id, largeur: LARGEUR_STANDARD[id], masquee: false })),
      ...DALLES_TABLEAU_DE_BORD.filter((id) => !standard.has(id)).map((id) => ({
        id,
        largeur: LARGEUR_STANDARD[id],
        masquee: true,
      })),
    ],
  };
}

/** Ajoute une dalle du catalogue en fin de grille (ADR 0108) : une dalle masquée de ce type est réaffichée ; sinon une
    copie est ajoutée, avec sa propre clé, à sa largeur standard. Renvoie la disposition et la clé de la dalle ajoutée
    (inchangée si la disposition est pleine). */
export function ajouterDalle(d: Disposition, id: IdDalle): { disposition: Disposition; cle: string | null } {
  const masquee = d.dalles.find((x) => x.id === id && x.masquee);
  if (masquee)
    return {
      disposition: { dalles: [...d.dalles.filter((x) => x !== masquee), { ...masquee, masquee: false }] },
      cle: cleDalle(masquee),
    };
  if (d.dalles.length >= MAX_DALLES) return { disposition: d, cle: null };
  const prises = new Set(d.dalles.map(cleDalle));
  let cle: string = id;
  for (let n = 2; prises.has(cle); n++) cle = `${id}~${n}`;
  const x: DalleDisposee = { id, ...(cle === id ? {} : { cle }), largeur: LARGEUR_STANDARD[id], masquee: false };
  return { disposition: { dalles: [...d.dalles, x] }, cle };
}

/** Retire une dalle de la grille : une copie disparaît, la première de son type est masquée (elle reste au catalogue
    avec ses réglages). */
export function retirerDalle(d: Disposition, cle: string): Disposition {
  const x = d.dalles.find((y) => cleDalle(y) === cle);
  if (!x) return d;
  return x.cle ? { dalles: d.dalles.filter((y) => y !== x) } : modifierDalle(d, cle, { masquee: true });
}

/** Dalles à afficher, dans l'ordre : présentes dans la disposition, non masquées et ayant des données (`disponibles`). */
export function dallesAffichees(d: Disposition, disponibles: ReadonlySet<IdDalle>): DalleDisposee[] {
  return d.dalles.filter((x) => !x.masquee && disponibles.has(x.id));
}

/** Déplace la dalle de clé `id` juste avant (ou juste après) la dalle de clé `cible`. Sans effet si l'une manque ou si
    c'est la même. */
export function deplacerDalle(d: Disposition, id: string, cible: string, apres = false): Disposition {
  if (id === cible) return d;
  const x = d.dalles.find((y) => cleDalle(y) === id);
  if (!x || !d.dalles.some((y) => cleDalle(y) === cible)) return d;
  const reste = d.dalles.filter((y) => cleDalle(y) !== id);
  const i = reste.findIndex((y) => cleDalle(y) === cible) + (apres ? 1 : 0);
  return { dalles: [...reste.slice(0, i), x, ...reste.slice(i)] };
}

/** Déplacement au clavier, parmi les dalles affichées : d'un rang (`-1`, `+1`), en premier (`'debut'`) ou en dernier
    (`'fin'`). Les dalles masquées ou sans données gardent leur place relative. Renvoie la disposition et le nouveau rang
    (à partir de 1) parmi les dalles affichées. */
export function deplacerDalleAuClavier(
  d: Disposition,
  id: string,
  sens: -1 | 1 | 'debut' | 'fin',
  disponibles: ReadonlySet<IdDalle>,
): { disposition: Disposition; rang: number; total: number } {
  const vues = dallesAffichees(d, disponibles).map(cleDalle);
  const i = vues.indexOf(id);
  let suivante = d;
  if (i >= 0 && vues.length > 1) {
    if (sens === 'debut' && i > 0) suivante = deplacerDalle(d, id, vues[0]!);
    else if (sens === 'fin' && i < vues.length - 1) suivante = deplacerDalle(d, id, vues[vues.length - 1]!, true);
    else if (sens === -1 && i > 0) suivante = deplacerDalle(d, id, vues[i - 1]!);
    else if (sens === 1 && i < vues.length - 1) suivante = deplacerDalle(d, id, vues[i + 1]!, true);
  }
  const apres = dallesAffichees(suivante, disponibles).map(cleDalle);
  return { disposition: suivante, rang: apres.indexOf(id) + 1, total: apres.length };
}

/** Colonnes de la grille aux grands écrans : les largeurs s'y entendent. */
export const COLONNES_TABLEAU_DE_BORD = 12;

/** Grille d'occupation de 12 colonnes, à la manière du placement automatique de CSS Grid (mode « sparse ») : chaque
    dalle se place à la première position libre à partir du curseur, qui avance après elle. */
class Occupation {
  private lignes: boolean[][] = [];
  private libre(l: number, c: number, largeur: number, hauteur: number) {
    for (let i = l; i < l + hauteur; i++) for (let j = c; j < c + largeur; j++) if (this.lignes[i]?.[j]) return false;
    return true;
  }
  /** Position où la dalle se placerait à partir du curseur. */
  position(largeur: number, hauteur: number, curseur: { l: number; c: number }) {
    const w = Math.min(largeur, COLONNES_TABLEAU_DE_BORD);
    for (let l = curseur.l; ; l++)
      for (let c = l === curseur.l ? curseur.c : 0; c + w <= COLONNES_TABLEAU_DE_BORD; c++)
        if (this.libre(l, c, w, hauteur)) return { l, c };
  }
  occuper(p: { l: number; c: number }, largeur: number, hauteur: number) {
    for (let i = p.l; i < p.l + hauteur; i++) {
      const ligne = (this.lignes[i] ??= Array<boolean>(COLONNES_TABLEAU_DE_BORD).fill(false));
      for (let j = p.c; j < p.c + Math.min(largeur, COLONNES_TABLEAU_DE_BORD); j++) ligne[j] = true;
    }
  }
}
const avant = (a: { l: number; c: number }, b: { l: number; c: number }) => a.l < b.l || (a.l === b.l && a.c < b.c);

/** Placement magnétique, en largeur et en hauteur (ADR 0078, ADR 0108) : sur 12 colonnes, une place restée libre (fin de
    rangée, creux à côté d'une dalle haute) est comblée par la première dalle suivante qui s'y loge plus tôt que la dalle
    attendue, avancée à cette place ; les autres gardent leur ordre. À hauteurs égales, c'est le comblement des fins de
    rangée. La dalle `figee` (clé de celle qu'on vient de poser) n'est jamais avancée : elle reste où on l'a mise. Les
    dalles masquées ou sans données gardent leur rang dans la disposition. */
export function compacterDisposition(d: Disposition, disponibles: ReadonlySet<IdDalle>, figee?: string): Disposition {
  const vues = dallesAffichees(d, disponibles);
  const file = [...vues];
  const ordre: DalleDisposee[] = [];
  const grille = new Occupation();
  let curseur = { l: 0, c: 0 };
  const position = (x: DalleDisposee) => grille.position(x.largeur, hauteurDalle(x), curseur)!;
  while (file.length) {
    const attendue = position(file[0]!);
    let i = 0;
    let p = attendue;
    for (let k = 1; k < file.length; k++) {
      if (cleDalle(file[k]!) === figee) continue;
      const q = position(file[k]!);
      if (avant(q, attendue)) {
        i = k;
        p = q;
        break;
      }
    }
    const [x] = file.splice(i, 1);
    grille.occuper(p, x!.largeur, hauteurDalle(x!));
    curseur = { l: p.l, c: p.c + x!.largeur };
    ordre.push(x!);
  }
  // Les dalles affichées reprennent, dans le nouvel ordre, les rangs qu'elles occupaient ; les autres ne bougent pas.
  const affichees = new Set(vues.map(cleDalle));
  let k = 0;
  return { dalles: d.dalles.map((x) => (affichees.has(cleDalle(x)) ? ordre[k++]! : x)) };
}

/** Largeur proposée la plus proche d'un nombre de colonnes (redimensionnement au glisser, aimanté sur ¼, ⅓, ½, ⅔, 1). */
export function largeurAimantee(colonnes: number): LargeurDisposee {
  let meilleure: LargeurDisposee = LARGEURS_DALLE[0];
  for (const l of LARGEURS_DALLE) if (Math.abs(l - colonnes) < Math.abs(meilleure - colonnes)) meilleure = l;
  return meilleure;
}

/** Hauteur proposée la plus proche d'un nombre de lignes (redimensionnement au glisser, ADR 0108). */
export function hauteurAimantee(lignes: number): HauteurDisposee {
  let meilleure: HauteurDisposee = HAUTEURS_DALLE[0];
  for (const h of HAUTEURS_DALLE) if (Math.abs(h - lignes) < Math.abs(meilleure - lignes)) meilleure = h;
  return meilleure;
}

/** Change la largeur, la hauteur, l'état masqué ou les réglages de la dalle de clé `id` (des réglages vides sont retirés ;
    une hauteur égale à la hauteur standard n'est pas enregistrée). */
export function modifierDalle(
  d: Disposition,
  id: string,
  champs: Partial<Omit<DalleDisposee, 'id' | 'cle'>>,
): Disposition {
  return {
    dalles: d.dalles.map((x) => {
      if (cleDalle(x) !== id) return x;
      const y = { ...x, ...champs };
      if (y.hauteur === undefined || y.hauteur === HAUTEUR_STANDARD[y.id]) delete y.hauteur;
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
    return (
      x.id === y.id &&
      x.cle === y.cle &&
      x.largeur === y.largeur &&
      x.hauteur === y.hauteur &&
      x.masquee === y.masquee &&
      memesReglages(x.reglages, y.reglages)
    );
  });

/** Visualisation retenue pour une dalle : la sienne si elle est permise, sinon la standard (null : sans choix). */
export function visualisationDalle(id: IdDalle, r?: ReglagesDalle): Visualisation | null {
  const permises = REGLAGES_DALLE[id]?.visualisations;
  if (!permises) return null;
  return r?.visualisation && permises.includes(r.visualisation) ? r.visualisation : permises[0]!;
}
