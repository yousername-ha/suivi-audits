/* Matrice RACI d'un fournisseur (ADR 0113 ; décision du RSSI du 23/11/2026) : activités en lignes, acteurs en colonnes,
   une lettre au plus par case (R, A, C ou I ; case vide : non concerné). La colonne du fournisseur est présente d'office :
   elle porte l'identifiant réservé « fournisseur », se libelle du nom du fournisseur et n'est ni renommable ni
   supprimable ; les autres colonnes sont des fonctions de l'établissement. Une seule matrice par fournisseur, absente tant
   qu'on ne l'a pas créée (à partir du modèle ci-dessous, entièrement modifiable ensuite).
   Règle : chaque activité a exactement un A et au moins un R. Elle est contrôlée à l'enregistrement et affichée, sans
   bloquer : une matrice qui ne la respecte pas s'enregistre quand même (controleRaci, réutilisée par l'écran). */
import { z } from 'zod';

export const RACI_LETTRES = ['R', 'A', 'C', 'I'] as const;
export type LettreRaci = (typeof RACI_LETTRES)[number];
/** Légende de la maquette soumise au RSSI. */
export const RACI_LETTRES_LIBELLES: Record<LettreRaci, string> = {
  R: 'Réalise',
  A: 'Approuve, rend des comptes (un seul par activité)',
  C: 'Consulté avant',
  I: 'Informé après',
};
/** Bornes de la matrice : 60 activités, 15 fonctions de l'établissement (plus la colonne du fournisseur), libellés de 1 à
    200 caractères sans caractère de contrôle. Les mêmes bornes sont contrôlées par la base (migration 106). */
export const RACI_BORNES = { activites: 60, acteurs: 15, libelle: 200, identifiant: 40 } as const;
export const RACI_CASES_MAX = RACI_BORNES.activites * (RACI_BORNES.acteurs + 1);
/** Identifiant réservé de la colonne du fournisseur. */
export const RACI_ACTEUR_FOURNISSEUR = 'fournisseur';

export interface ElementRaci {
  id: string;
  libelle: string;
}
/** Modèle de départ (décision du RSSI du 23/11/2026) : activités et fonctions proposées à la création, renommables,
    supprimables et réordonnables ensuite. */
export const RACI_MODELE_ACTIVITES: readonly ElementRaci[] = [
  { id: 'correctifs', libelle: 'Application des correctifs de sécurité' },
  { id: 'sauvegardes', libelle: 'Sauvegardes et restauration' },
  { id: 'acces', libelle: 'Gestion des accès et des comptes' },
  { id: 'supervision', libelle: 'Surveillance et supervision' },
  { id: 'incidents', libelle: 'Gestion des incidents de sécurité' },
  { id: 'changements', libelle: 'Gestion des changements' },
  { id: 'reversibilite', libelle: 'Réversibilité et fin de contrat' },
];
export const RACI_MODELE_ACTEURS: readonly ElementRaci[] = [
  { id: 'rssi', libelle: 'RSSI' },
  { id: 'dsi', libelle: 'DSI' },
  { id: 'referent-metier', libelle: 'Référent métier' },
];

/** Libellé d'une ligne ou d'une colonne : caractères de contrôle remplacés, espaces superflus retirés. */
export function nettoyerLibelleRaci(s: string): string {
  return (
    s
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
const IDENTIFIANT = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,39}$/,
    'Identifiant attendu : lettres minuscules, chiffres et tirets, 40 caractères au plus.',
  );
const LIBELLE = z
  .string()
  .max(2000)
  .transform(nettoyerLibelleRaci)
  .pipe(
    z.string().min(1, 'Libellé vide.').max(RACI_BORNES.libelle, `Libellé limité à ${RACI_BORNES.libelle} caractères.`),
  );
export const RaciActivite = z.object({ id: IDENTIFIANT, libelle: LIBELLE }).strict();
export const RaciActeur = z
  .object({
    id: IDENTIFIANT.refine((v) => v !== RACI_ACTEUR_FOURNISSEUR, 'Identifiant réservé à la colonne du fournisseur.'),
    libelle: LIBELLE,
  })
  .strict();
export const RaciCase = z.object({ activite: IDENTIFIANT, acteur: IDENTIFIANT, lettre: z.enum(RACI_LETTRES) }).strict();
export type RaciCase = z.infer<typeof RaciCase>;

/** Contenu d'une matrice, tel qu'il s'enregistre (PUT /api/suppliers/:id/raci, avec If-Match). Les acteurs sont les
    fonctions de l'établissement : la colonne du fournisseur n'y figure pas, ses cases portent l'acteur « fournisseur ».
    Une case vide n'est pas transmise. */
export const MatriceRaciBody = z
  .object({
    activites: z
      .array(RaciActivite)
      .max(RACI_BORNES.activites, `Une matrice compte au plus ${RACI_BORNES.activites} activités.`),
    acteurs: z
      .array(RaciActeur)
      .max(RACI_BORNES.acteurs, `Une matrice compte au plus ${RACI_BORNES.acteurs} acteurs en plus du fournisseur.`),
    cases: z.array(RaciCase).max(RACI_CASES_MAX),
  })
  .strict()
  .superRefine((v, c) => {
    const activites = new Set(v.activites.map((a) => a.id));
    const acteurs = new Set(v.acteurs.map((a) => a.id));
    if (activites.size !== v.activites.length)
      c.addIssue({ code: 'custom', path: ['activites'], message: 'Identifiants d’activités dupliqués.' });
    if (acteurs.size !== v.acteurs.length)
      c.addIssue({ code: 'custom', path: ['acteurs'], message: 'Identifiants d’acteurs dupliqués.' });
    const vues = new Set<string>();
    v.cases.forEach((k, i) => {
      if (!activites.has(k.activite))
        c.addIssue({ code: 'custom', path: ['cases', i, 'activite'], message: 'Activité inconnue de la matrice.' });
      if (k.acteur !== RACI_ACTEUR_FOURNISSEUR && !acteurs.has(k.acteur))
        c.addIssue({ code: 'custom', path: ['cases', i, 'acteur'], message: 'Acteur inconnu de la matrice.' });
      const cle = `${k.activite}\n${k.acteur}`;
      if (vues.has(cle))
        c.addIssue({ code: 'custom', path: ['cases', i], message: 'Une case ne porte qu’une seule lettre.' });
      vues.add(cle);
    });
  });
export type MatriceRaciBody = z.infer<typeof MatriceRaciBody>;

/** Matrice enregistrée, telle que l'API la rend. */
export const MatriceRaci = z.object({
  fournisseurId: z.string(),
  activites: z.array(RaciActivite),
  acteurs: z.array(RaciActeur),
  cases: z.array(RaciCase),
  version: z.number().int().positive(),
  misAJourLe: z.string(),
  misAJourPar: z.string(),
});
export type MatriceRaci = z.infer<typeof MatriceRaci>;
/** Écarts à la règle « exactement un A, au moins un R » ; une activité sans écart est conforme. */
export const RACI_ECARTS = ['aucun_a', 'plusieurs_a', 'aucun_r'] as const;
export type EcartRaci = (typeof RACI_ECARTS)[number];
/** Contrôle d'une activité par la règle (voir controleRaci). */
export const ControleActiviteRaci = z.object({
  activite: z.string(),
  libelle: z.string(),
  a: z.number().int(),
  r: z.number().int(),
  ecarts: z.array(z.enum(RACI_ECARTS)),
});
/** Réponse de GET et PUT : la matrice (null tant qu'elle n'a pas été créée) et le contrôle de chaque activité, rendu à
    titre d'avertissement (l'enregistrement n'est jamais refusé pour la règle). */
export const MatriceRaciReponse = z.object({
  matrice: MatriceRaci.nullable(),
  controle: z.array(ControleActiviteRaci),
});
export type MatriceRaciReponse = z.infer<typeof MatriceRaciReponse>;

/** Matrice de départ : le modèle, sans aucune lettre. */
export function matriceRaciModele(): MatriceRaciBody {
  return {
    activites: RACI_MODELE_ACTIVITES.map((a) => ({ ...a })),
    acteurs: RACI_MODELE_ACTEURS.map((a) => ({ ...a })),
    cases: [],
  };
}

export const RACI_ECARTS_LIBELLES: Record<EcartRaci, string> = {
  aucun_a: 'Aucun A',
  plusieurs_a: 'Plusieurs A',
  aucun_r: 'Aucun R',
};
export type ControleActiviteRaci = z.infer<typeof ControleActiviteRaci>;
/** Règle RACI, ligne par ligne, dans l'ordre des activités. Les cases d'une activité ou d'un acteur absents sont ignorées. */
export function controleRaci(m: Pick<MatriceRaciBody, 'activites' | 'acteurs' | 'cases'>): ControleActiviteRaci[] {
  const acteurs = new Set([RACI_ACTEUR_FOURNISSEUR, ...m.acteurs.map((a) => a.id)]);
  return m.activites.map((act) => {
    const lettres = m.cases.filter((k) => k.activite === act.id && acteurs.has(k.acteur)).map((k) => k.lettre);
    const a = lettres.filter((l) => l === 'A').length;
    const r = lettres.filter((l) => l === 'R').length;
    const ecarts: EcartRaci[] = [];
    if (a === 0) ecarts.push('aucun_a');
    if (a > 1) ecarts.push('plusieurs_a');
    if (r === 0) ecarts.push('aucun_r');
    return { activite: act.id, libelle: act.libelle, a, r, ecarts };
  });
}
/** Texte du contrôle d'une activité : « Conforme », ou ses écarts (« Aucun A, Aucun R »). */
export function libelleControleRaci(c: Pick<ControleActiviteRaci, 'ecarts'>): string {
  return c.ecarts.length ? c.ecarts.map((e) => RACI_ECARTS_LIBELLES[e]).join(', ') : 'Conforme';
}
/** Activités qui ne respectent pas la règle. */
export const activitesARevoirRaci = (controles: readonly ControleActiviteRaci[]) =>
  controles.filter((c) => c.ecarts.length > 0);
