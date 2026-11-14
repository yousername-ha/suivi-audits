/* Libellés français des valeurs techniques de l'appréciation des risques (acceptabilité, option de traitement, état de
   l'appréciation), pour qu'aucun code (`conditional`, `reduce`, `draft`…) ne s'affiche à l'écran ni dans un rapport (BUG-059).
   Une valeur inconnue est rendue telle quelle : jamais de libellé inventé. */
const ACCEPTABILITE: Record<string, string> = {
  acceptable: 'Acceptable',
  conditional: 'Acceptable sous condition',
  unacceptable: 'Inacceptable',
};
const OPTION_TRAITEMENT: Record<string, string> = {
  reduce: 'Réduire',
  accept: 'Accepter',
  transfer: 'Transférer',
  avoid: 'Éviter',
  treated: 'Traité',
};
const ETAT_APPRECIATION: Record<string, string> = {
  draft: 'Brouillon',
  approved: 'Approuvée',
  validated: 'Validée',
  rejected: 'Rejetée',
};
const CALCUL: Record<string, string> = {
  judgement: 'jugement qualitatif',
  matrix: 'matrice',
  lookup: 'table de correspondance',
};
const libelle = (t: Record<string, string>, v: unknown) => (typeof v === 'string' ? (t[v] ?? v) : '');
export const libelleAcceptabilite = (v: unknown) => libelle(ACCEPTABILITE, v);
export const libelleOptionTraitement = (v: unknown) => libelle(OPTION_TRAITEMENT, v);
export const libelleEtatAppreciation = (v: unknown) => libelle(ETAT_APPRECIATION, v);
export const libelleModeCalcul = (v: unknown) => libelle(CALCUL, v);
