/* Matrice « Qui décide quoi » des rôles et responsabilités (ADR 0115) : passage entre le contrat de l'API (décisions,
   cases { decision, role, lettre }, colonnes issues du registre) et la matrice en cours de saisie de la grille commune
   (raci.ts : lignes = décisions, colonnes = rôles, désignés par leur référence). Fonctions pures, sans requête ni
   composant. La règle est celle du paquet partagé (controleDecisionsRaci), la même que celle du serveur : seules comptent
   les lettres des rôles présents au registre. */
import {
  RACI_DECISIONS_BORNES,
  controleDecisionsRaci,
  nettoyerLibelleRaci,
  type ColonneRoleRaci,
  type ControleActiviteRaci,
  type MatriceDecisions,
  type MatriceDecisionsBody,
} from '@suivi/shared';
import { ajouterLigne, type ColonneGrilleRaci, type ContenuRaci } from './raci';

/** Matrice saisie : décisions en lignes, rôles présents au registre en colonnes (`acteurs`), cases de tous les rôles,
    retirés compris (leurs lettres restent jusqu'à leur effacement). */
export function contenuDecisions(
  m: Pick<MatriceDecisions, 'decisions' | 'cases'> | null,
  roles: readonly ColonneRoleRaci[],
): ContenuRaci {
  return {
    activites: (m?.decisions ?? []).map((d) => ({ ...d })),
    acteurs: roles.filter((r) => !r.retire).map((r) => ({ id: r.ref, libelle: r.libelle })),
    cases: (m?.cases ?? []).map((k) => ({ activite: k.decision, acteur: k.role, lettre: k.lettre })),
  };
}
/** Corps de l'enregistrement (PUT, avec If-Match) : libellés nettoyés, cases vides absentes. */
export function corpsDecisions(c: ContenuRaci): MatriceDecisionsBody {
  return {
    decisions: c.activites.map((d) => ({ id: d.id, libelle: nettoyerLibelleRaci(d.libelle) })),
    cases: c.cases.map((k) => ({ decision: k.activite, role: k.acteur, lettre: k.lettre })),
  };
}
/** Colonnes de la grille : les rôles du registre (ni renommables ni retirables ici : ils se gèrent dans le registre), puis
    les rôles retirés qui portent encore une lettre dans la saisie (« Rôle retiré », lettres effaçables). */
export function colonnesDecisions(roles: readonly ColonneRoleRaci[], c: ContenuRaci): ColonneGrilleRaci[] {
  return roles
    .filter((r) => !r.retire || c.cases.some((k) => k.acteur === r.ref))
    .map((r) => ({ id: r.ref, libelle: r.libelle, renommable: false, retirable: r.retire, retiree: r.retire }));
}
/** Contrôle de la saisie, dans la forme de la grille commune (`activite` = identifiant de la décision). */
export function controleSaisieDecisions(c: ContenuRaci): ControleActiviteRaci[] {
  return controleDecisionsRaci(
    corpsDecisions(c),
    c.acteurs.map((a) => a.id),
  ).map(({ decision, ...reste }) => ({ activite: decision, ...reste }));
}
/** Rôles retirés qui portent encore une lettre dans la saisie. */
export const rolesRetiresAvecLettres = (roles: readonly ColonneRoleRaci[], c: ContenuRaci) =>
  roles.filter((r) => r.retire && c.cases.some((k) => k.acteur === r.ref));

export const peutAjouterDecision = (c: ContenuRaci) => c.activites.length < RACI_DECISIONS_BORNES.decisions;
export function ajouterDecision(c: ContenuRaci, libelle = 'Nouvelle décision'): ContenuRaci {
  return peutAjouterDecision(c) ? ajouterLigne(c, 'decision', libelle) : c;
}
/** Décisions sans nom après nettoyage : le serveur refuse l'enregistrement, l'écran le dit avant. */
export const decisionsSansNom = (c: ContenuRaci) => c.activites.some((d) => !nettoyerLibelleRaci(d.libelle));
