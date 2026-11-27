/* Matrice « Qui décide quoi » des rôles et responsabilités (ADR 0115 ; décision du RSSI du 27/11/2026) : une matrice par
   périmètre, décisions de l'organisation en lignes (saisies librement, aucune au départ), rôles du registre « Rôles et
   responsabilités » du périmètre en colonnes, une lettre au plus par case (R, A, C ou I ; case vide : non concerné).
   Mêmes lettres, même grille et même règle que la matrice RACI des fournisseurs (ADR 0113, raci-fournisseurs.ts) :
   chaque décision a exactement un A et au moins un R, contrôlé et affiché sans bloquer l'enregistrement.
   Les colonnes ne sont pas saisies : ce sont les fiches du registre, désignées par leur référence (« object:<uuid> »
   pour une fiche du Pilotage, « legacy:roles:<id> » pour un rôle de l'outil de suivi au périmètre commun) et libellées de
   leur nom à la lecture (aucune copie du libellé n'est enregistrée, ADR 0083). Un rôle retiré du registre garde ses
   lettres : sa colonne s'affiche « Rôle retiré », ses lettres ne comptent plus dans le contrôle et peuvent être effacées. */
import { z } from 'zod';
import {
  IdentifiantRaci,
  RACI_LETTRES,
  RaciActivite,
  regleRaci,
  RACI_ECARTS,
  type LettreRaci,
} from './raci-fournisseurs.js';

/** Bornes : 60 décisions, 3 000 cases (60 décisions × 50 rôles), référence d'un rôle de 220 caractères au plus. Les
    mêmes bornes sont contrôlées par la base (migration 108). */
export const RACI_DECISIONS_BORNES = { decisions: 60, cases: 3000, role: 220 } as const;
/** Légende courte de l'écran (décision du RSSI du 27/11/2026) : « R réalise · A approuve · C consulté · I informé ». */
export const RACI_DECISIONS_LETTRES_LIBELLES: Record<LettreRaci, string> = {
  R: 'réalise',
  A: 'approuve',
  C: 'consulté',
  I: 'informé',
};
/** Libellé d'une colonne dont le rôle a quitté le registre. */
export const RACI_ROLE_RETIRE = 'Rôle retiré';

/** Référence d'un rôle du registre : fiche du Pilotage ou rôle de l'outil de suivi (périmètre commun). */
export const RefRoleRaci = z
  .string()
  .max(RACI_DECISIONS_BORNES.role)
  .regex(
    /^(object:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|legacy:roles:[^\p{Cc}]{1,200})$/u,
    'Référence de rôle attendue : fiche du registre « Rôles et responsabilités ».',
  );
export const RaciCaseDecision = z
  .object({ decision: IdentifiantRaci, role: RefRoleRaci, lettre: z.enum(RACI_LETTRES) })
  .strict();
export type RaciCaseDecision = z.infer<typeof RaciCaseDecision>;

/** Contenu enregistré (PUT /api/grc/:smsi/pilotage/responsabilites/raci, avec If-Match) : les décisions et les cases
    remplies. Les rôles d'une case doivent être des rôles du registre du périmètre, ou des rôles retirés qui portaient déjà
    une lettre (contrôle de l'API). Une case vide n'est pas transmise. */
export const MatriceDecisionsBody = z
  .object({
    decisions: z
      .array(RaciActivite)
      .max(
        RACI_DECISIONS_BORNES.decisions,
        `Une matrice « Qui décide quoi » compte au plus ${RACI_DECISIONS_BORNES.decisions} décisions.`,
      ),
    cases: z.array(RaciCaseDecision).max(RACI_DECISIONS_BORNES.cases),
  })
  .strict()
  .superRefine((v, c) => {
    const decisions = new Set(v.decisions.map((d) => d.id));
    if (decisions.size !== v.decisions.length)
      c.addIssue({ code: 'custom', path: ['decisions'], message: 'Identifiants de décisions dupliqués.' });
    const vues = new Set<string>();
    v.cases.forEach((k, i) => {
      if (!decisions.has(k.decision))
        c.addIssue({ code: 'custom', path: ['cases', i, 'decision'], message: 'Décision inconnue de la matrice.' });
      const cle = `${k.decision}\n${k.role}`;
      if (vues.has(cle))
        c.addIssue({ code: 'custom', path: ['cases', i], message: 'Une case ne porte qu’une seule lettre.' });
      vues.add(cle);
    });
  });
export type MatriceDecisionsBody = z.infer<typeof MatriceDecisionsBody>;

/** Matrice enregistrée du périmètre. */
export const MatriceDecisions = z.object({
  smsiId: z.string(),
  decisions: z.array(RaciActivite),
  cases: z.array(RaciCaseDecision),
  version: z.number().int().positive(),
  misAJourLe: z.string(),
  misAJourPar: z.string(),
});
export type MatriceDecisions = z.infer<typeof MatriceDecisions>;
/** Colonne de la matrice : un rôle du registre (libellé de son nom, lu avec les droits du lecteur), ou un rôle retiré qui
    porte encore des lettres (« Rôle retiré »). */
export const ColonneRoleRaci = z.object({ ref: z.string(), libelle: z.string(), retire: z.boolean() });
export type ColonneRoleRaci = z.infer<typeof ColonneRoleRaci>;
export const ControleDecisionRaci = z.object({
  decision: z.string(),
  libelle: z.string(),
  a: z.number().int(),
  r: z.number().int(),
  ecarts: z.array(z.enum(RACI_ECARTS)),
});
export type ControleDecisionRaci = z.infer<typeof ControleDecisionRaci>;
/** Réponse de GET et PUT : la matrice (null tant que rien n'a été enregistré), les colonnes et le contrôle de chaque
    décision, à titre d'avertissement. */
export const MatriceDecisionsReponse = z.object({
  matrice: MatriceDecisions.nullable(),
  roles: z.array(ColonneRoleRaci),
  controle: z.array(ControleDecisionRaci),
});
export type MatriceDecisionsReponse = z.infer<typeof MatriceDecisionsReponse>;

/** Colonnes : les rôles du registre, dans l'ordre donné, puis un « Rôle retiré » par rôle absent du registre qui porte
    encore une lettre (numérotés s'il y en a plusieurs, dans l'ordre des cases). */
export function colonnesRolesRaci(
  roles: readonly { ref: string; libelle: string }[],
  cases: readonly Pick<RaciCaseDecision, 'role'>[],
): ColonneRoleRaci[] {
  const presents = new Set(roles.map((r) => r.ref));
  const retires = [...new Set(cases.map((k) => k.role).filter((r) => !presents.has(r)))];
  return [
    ...roles.map((r) => ({ ref: r.ref, libelle: r.libelle, retire: false })),
    ...retires.map((ref, i) => ({
      ref,
      libelle: retires.length > 1 ? `${RACI_ROLE_RETIRE} ${i + 1}` : RACI_ROLE_RETIRE,
      retire: true,
    })),
  ];
}

/** Règle RACI, décision par décision, dans l'ordre des lignes. Seules comptent les lettres des rôles présents au registre
    (`roles`) : celles d'un rôle retiré sont conservées mais ignorées, comme controleRaci ignore un acteur absent. */
export function controleDecisionsRaci(
  m: Pick<MatriceDecisionsBody, 'decisions' | 'cases'>,
  roles: Iterable<string>,
): ControleDecisionRaci[] {
  const presents = new Set(roles);
  return m.decisions.map((d) => ({
    decision: d.id,
    libelle: d.libelle,
    ...regleRaci(m.cases.filter((k) => k.decision === d.id && presents.has(k.role)).map((k) => k.lettre)),
  }));
}
