/* Matrice RACI d'un fournisseur (ADR 0113) : opérations pures sur la matrice en cours de saisie (ajout, renommage, retrait
   et ordre des lignes et des colonnes, lettre d'une case). Aucune requête ni aucun composant React ici. La règle « un A,
   au moins un R » est celle du paquet partagé (controleRaci), la même que celle du serveur. */
import {
  RACI_ACTEUR_FOURNISSEUR,
  RACI_BORNES,
  nettoyerLibelleRaci,
  type ElementRaci,
  type LettreRaci,
  type RaciCase,
} from '@suivi/shared';

export interface ContenuRaci {
  activites: ElementRaci[];
  acteurs: ElementRaci[];
  cases: RaciCase[];
}
/** Colonne affichée : le fournisseur d'abord (libellé de son nom, ni renommable ni supprimable), puis les fonctions. */
export interface ColonneRaci extends ElementRaci {
  fournisseur: boolean;
}

export const colonnesRaci = (c: Pick<ContenuRaci, 'acteurs'>, nomFournisseur: string): ColonneRaci[] => [
  { id: RACI_ACTEUR_FOURNISSEUR, libelle: nomFournisseur, fournisseur: true },
  ...c.acteurs.map((a) => ({ ...a, fournisseur: false })),
];
/** Nom accessible d'une case : « <activité> – <acteur> ». */
export const nomCaseRaci = (activite: string, acteur: string) => `${activite} – ${acteur}`;

export const lettreRaci = (c: ContenuRaci, activite: string, acteur: string): LettreRaci | null =>
  c.cases.find((k) => k.activite === activite && k.acteur === acteur)?.lettre ?? null;

/** Pose (ou efface, avec null) la lettre d'une case : une seule lettre par case. */
export function avecLettre(c: ContenuRaci, activite: string, acteur: string, lettre: LettreRaci | null): ContenuRaci {
  const autres = c.cases.filter((k) => !(k.activite === activite && k.acteur === acteur));
  return { ...c, cases: lettre ? [...autres, { activite, acteur, lettre }] : autres };
}

/** Identifiant libre « <préfixe>-<n> », jamais « fournisseur ». */
export function identifiantLibre(prefixe: 'activite' | 'acteur', pris: readonly string[]): string {
  const vus = new Set(pris);
  let n = 1;
  while (vus.has(`${prefixe}-${n}`)) n++;
  return `${prefixe}-${n}`;
}

export const peutAjouterActivite = (c: ContenuRaci) => c.activites.length < RACI_BORNES.activites;
export const peutAjouterActeur = (c: ContenuRaci) => c.acteurs.length < RACI_BORNES.acteurs;

export function ajouterActivite(c: ContenuRaci, libelle = 'Nouvelle activité'): ContenuRaci {
  if (!peutAjouterActivite(c)) return c;
  const id = identifiantLibre(
    'activite',
    c.activites.map((a) => a.id),
  );
  return { ...c, activites: [...c.activites, { id, libelle }] };
}
export function ajouterActeur(c: ContenuRaci, libelle = 'Nouvel acteur'): ContenuRaci {
  if (!peutAjouterActeur(c)) return c;
  const id = identifiantLibre(
    'acteur',
    c.acteurs.map((a) => a.id),
  );
  return { ...c, acteurs: [...c.acteurs, { id, libelle }] };
}
/** Renomme une ligne ou une colonne ; le libellé est gardé tel que saisi, le serveur le nettoie. */
export function renommer(c: ContenuRaci, liste: 'activites' | 'acteurs', id: string, libelle: string): ContenuRaci {
  return { ...c, [liste]: c[liste].map((e) => (e.id === id ? { ...e, libelle } : e)) };
}
/** Retire une activité et ses cases. */
export function retirerActivite(c: ContenuRaci, id: string): ContenuRaci {
  return {
    ...c,
    activites: c.activites.filter((a) => a.id !== id),
    cases: c.cases.filter((k) => k.activite !== id),
  };
}
/** Retire une fonction de l'établissement et ses cases (la colonne du fournisseur ne se retire pas). */
export function retirerActeur(c: ContenuRaci, id: string): ContenuRaci {
  if (id === RACI_ACTEUR_FOURNISSEUR) return c;
  return { ...c, acteurs: c.acteurs.filter((a) => a.id !== id), cases: c.cases.filter((k) => k.acteur !== id) };
}
/** Déplace une activité d'un rang vers le haut (-1) ou vers le bas (+1). */
export function deplacerActivite(c: ContenuRaci, id: string, sens: -1 | 1): ContenuRaci {
  const i = c.activites.findIndex((a) => a.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= c.activites.length) return c;
  const activites = [...c.activites];
  [activites[i], activites[j]] = [activites[j]!, activites[i]!];
  return { ...c, activites };
}
/** Libellés vides après nettoyage : l'enregistrement est refusé par le serveur, l'écran le dit avant. */
export const libellesVides = (c: ContenuRaci) =>
  [...c.activites, ...c.acteurs].some((e) => !nettoyerLibelleRaci(e.libelle));
