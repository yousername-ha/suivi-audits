/* Fournisseurs de l'organisation (refonte Neon, lot 5, ADR 0093) : types de présentation existants de `GET /api/suppliers`,
   extraits de Fournisseurs.tsx sans changer leur contrat, et fonctions pures du registre compact (teintes, filtres,
   repères d'attention). Aucune requête ni aucun composant React ici. */
import { resumeCriteresRattaches, type CritereRattache, type EtatSuivi, type ResumeControles } from '@suivi/shared';

export type { CritereRattache } from '@suivi/shared';

export interface EvaluationCourante {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  nextReviewAt: string | null;
  items: number;
  meets: number;
  notMeets: number;
  notAssessed: number;
}
export interface CertificatFournisseur {
  type: string;
  validUntil?: string;
  received?: string;
  scope?: string;
  location?: string;
}
export interface ControleFournisseur {
  id?: string;
  t: string;
  ref?: string;
  freq?: number;
  last?: string;
  result?: string;
  comment?: string;
}
export interface Fournisseur {
  id: string;
  name: string;
  saas: boolean;
  rattachement: string;
  contact: string;
  notes: string;
  sso: string;
  mfa: string;
  critical: string;
  hds: string;
  certs: CertificatFournisseur[];
  controls: ControleFournisseur[];
  certificateState: EtatSuivi;
  controlSummary: ResumeControles;
  current: EvaluationCourante | null;
  toReview: boolean;
  scopes: string[];
  /** Critères rattachés (ADR 0098), retirés compris, avec la dernière réponse donnée pour chacun. */
  criteria: CritereRattache[];
}

export type ChampFournisseur = 'sso' | 'mfa' | 'critical' | 'hds';
export type TonFournisseur = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

/** Teinte d'une valeur de suivi : SSO et MFA « Oui » vert, « Non » rouge, « En cours » ambre ; une criticité « Oui » est
    une attention, pas un succès ; « Hébergeur HDS : Oui » reste une déclaration (bleu), pas une certification vérifiée.
    Non renseigné et N/A restent neutres. */
export function tonChamp(champ: ChampFournisseur, valeur: string): TonFournisseur {
  if (champ === 'critical') return valeur === 'Oui' ? 'warn' : 'neutral';
  if (champ === 'hds') return valeur === 'Oui' ? 'info' : 'neutral';
  return valeur === 'Oui' ? 'good' : valeur === 'Non' ? 'bad' : valeur === 'En cours' ? 'warn' : 'neutral';
}

/** Teinte de l'état des certificats, calculé par le serveur (ok, mid, bad ou vide). */
export function tonCertificats(niveau: string): TonFournisseur {
  return niveau === 'ok' ? 'good' : niveau === 'mid' ? 'warn' : niveau === 'bad' ? 'bad' : 'neutral';
}

/** Une ligne demande l'attention si un contrôle est en retard, à réaliser ou non conforme, si un certificat est à traiter
    ou si une réévaluation est due. */
export function attentionFournisseur(f: Pick<Fournisseur, 'toReview' | 'controlSummary' | 'certificateState'>) {
  const c = f.controlSummary;
  return !!(
    f.toReview ||
    c.enRetard ||
    c.nonConformes ||
    c.aRealiser ||
    ['bad', 'mid'].includes(f.certificateState[1])
  );
}

/** Date AAAA-MM-JJ affichée JJ/MM/AAAA ; « – » si absente ou mal formée. */
export const jourFr = (d: string | null | undefined) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–';

/** Texte sans accents ni majuscules, pour une recherche tolérante. */
export const sansAccents = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr');

/** Filtres du registre (situation, type), mêmes règles que l'outil de suivi ; recherche dans le nom, l'identifiant, le
    rattachement, le contact et les notes (refonte Verre, 27/11/2026). */
export function filtrerFournisseurs<
  T extends Pick<
    Fournisseur,
    | 'id'
    | 'name'
    | 'rattachement'
    | 'contact'
    | 'notes'
    | 'mfa'
    | 'saas'
    | 'critical'
    | 'controlSummary'
    | 'certificateState'
  >,
>(liste: readonly T[], filtre: string, type: string, recherche: string): T[] {
  const q = sansAccents(recherche.trim());
  return liste.filter(
    (f) =>
      (filtre === 'all' ||
        (filtre === 'nomfa' && f.mfa !== 'Oui') ||
        (filtre === 'ctl' &&
          f.controlSummary.enRetard + f.controlSummary.aRealiser + f.controlSummary.nonConformes > 0) ||
        (filtre === 'cert' && ['bad', 'mid'].includes(f.certificateState[1])) ||
        (filtre === 'crit' && f.critical === 'Oui')) &&
      (type === 'all' || (type === 'saas' ? f.saas : !f.saas)) &&
      (!q || [f.name, f.id, f.rattachement, f.contact, f.notes].some((t) => !!t && sansAccents(t).includes(q))),
  );
}

/** Dernière réponse d'un critère rattaché : « Oui », « Non » ou « Non évalué » (jamais évalué, ou évalué sans réponse). */
export function libelleReponse(k: Pick<CritereRattache, 'answer'>) {
  return k.answer?.meets === true ? 'Oui' : k.answer?.meets === false ? 'Non' : 'Non évalué';
}
export function tonReponse(k: Pick<CritereRattache, 'answer'>): TonFournisseur {
  return k.answer?.meets === true ? 'good' : k.answer?.meets === false ? 'bad' : 'neutral';
}
/** Résumé compact des critères rattachés d'une ligne, par exemple « 3/5 critères remplis · 1 non · 1 non évalué » ;
    teinte : rouge si un critère n'est pas rempli, vert si tous le sont, neutre sinon. Aucune note, aucun seuil. */
export function resumeCriteresLigne(criteres: readonly Pick<CritereRattache, 'answer'>[]): {
  texte: string;
  ton: TonFournisseur;
} {
  const r = resumeCriteresRattaches(criteres);
  if (!r.total) return { texte: 'Aucun critère rattaché', ton: 'neutral' };
  const parties = [`${r.remplis}/${r.total} critère${r.total > 1 ? 's' : ''} rempli${r.total > 1 ? 's' : ''}`];
  if (r.non) parties.push(`${r.non} non`);
  if (r.nonEvalues) parties.push(`${r.nonEvalues} non évalué${r.nonEvalues > 1 ? 's' : ''}`);
  return { texte: parties.join(' · '), ton: r.non ? 'bad' : r.remplis === r.total ? 'good' : 'neutral' };
}
/** Une ligne de détail par critère rattaché : libellé, réponse et date (JJ/MM/AAAA). */
export function detailCritere(k: CritereRattache) {
  return `${k.label}${k.archived ? ' (retiré)' : ''} : ${libelleReponse(k)}${k.answer ? ` le ${jourFr(k.answer.evaluatedAt)}` : ''}`;
}

/** Recherche par nom, sans accents ni majuscules. */
export function filtrerParNom<T extends Pick<Fournisseur, 'name'>>(liste: readonly T[], recherche: string): T[] {
  const q = sansAccents(recherche.trim());
  return q ? liste.filter((f) => sansAccents(f.name).includes(q)) : [...liste];
}
/** Écart entre les fournisseurs lus et ceux cochés : à rattacher, à détacher (ordre stable). */
export function ecartRattachements(initial: ReadonlySet<string>, coches: ReadonlySet<string>) {
  return {
    attach: [...coches].filter((id) => !initial.has(id)).sort(),
    detach: [...initial].filter((id) => !coches.has(id)).sort(),
  };
}
