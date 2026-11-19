/* Suivi d'une faille (ADR 0100, point 10 ; lot V4b) : présentation sans état ni appel réseau (testée à part). Le serveur
   reste seul juge des droits (module, machines touchées, module des actions, périmètre de l'action) ; l'écran n'affiche
   que ce qu'il reçoit. Lot S1 : un risque accepté est une exception (justification, mesure compensatoire, échéance), que seul
   le rôle RSSI accorde, prolonge ou lève ; son statut s'affiche dans les marques. */
import {
  ETAT_SUIVI_LIBELLES,
  ETATS_SUIVI,
  ETATS_SUIVI_CHOISIS,
  EVENEMENT_SUIVI_LIBELLES,
  type EntreeHistoriqueSuiviDto,
  type EtatSuiviFaille,
  type FiltreSuivi,
  noteObligatoire,
  STATUT_EXCEPTION_LIBELLES,
  type SuiviResumeDto,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import { STATUT_EXCEPTION_PUCE } from './delais';

/** Sens de la puce d'état (couleurs de la charte). */
export const ETAT_SUIVI_PUCE: Record<EtatSuiviFaille, Etat> = {
  nouvelle: 'info',
  a_traiter: 'attention',
  en_cours: 'info',
  corrigee: 'succes',
  risque_accepte: 'neutre',
  non_concernee: 'neutre',
};

/** Choix du filtre de suivi : vide (failles encore à traiter), chaque état, « à clore », « tous ». */
export const OPTIONS_FILTRE_SUIVI: { value: FiltreSuivi; label: string }[] = [
  { value: 'a_clore', label: 'À clore (corrigée selon la source, à confirmer)' },
  ...ETATS_SUIVI.map((e) => ({ value: e, label: ETAT_SUIVI_LIBELLES[e] })),
  { value: 'tous', label: 'Tous les états' },
];

/** Marques du suivi d'une faille dans une liste, dans l'ordre d'affichage. `source` : « Tenable » ou « la veille ». */
export function marquesSuivi(s: SuiviResumeDto, present: boolean, source: string) {
  const out: { libelle: string; etat: Etat }[] = [
    { libelle: ETAT_SUIVI_LIBELLES[s.etat], etat: ETAT_SUIVI_PUCE[s.etat] },
  ];
  if (s.proposition === 'a_confirmer')
    out.push({ libelle: `Corrigée selon ${source}, à confirmer`, etat: 'attention' });
  else if (!present) out.push({ libelle: `Plus rapportée par ${source}`, etat: 'neutre' });
  if (s.proposition === 'refusee') out.push({ libelle: 'Proposition « corrigée » refusée', etat: 'neutre' });
  if (s.exceptionStatut)
    out.push({
      libelle: `Exception ${STATUT_EXCEPTION_LIBELLES[s.exceptionStatut].toLowerCase()}`,
      etat: STATUT_EXCEPTION_PUCE[s.exceptionStatut],
    });
  if (s.nombreActions)
    out.push({
      libelle: `${s.nombreActions} action${s.nombreActions > 1 ? 's' : ''} liée${s.nombreActions > 1 ? 's' : ''}`,
      etat: 'neutre',
    });
  return out;
}

/** États proposés dans le formulaire : ceux qu'une personne peut choisir, sauf l'état courant (le risque accepté peut être
    renouvelé). Lot S1 : sans le rôle RSSI (`exception` faux), le risque accepté n'est pas proposé, et une faille sous
    exception ne peut pas en sortir (rien n'est proposé). */
export const etatsChoisissables = (courant: EtatSuiviFaille, exception = true) =>
  exception || courant !== 'risque_accepte'
    ? ETATS_SUIVI_CHOISIS.filter(
        (e) => (e !== courant || e === 'risque_accepte') && (exception || e !== 'risque_accepte'),
      ).map((e) => ({
        value: e,
        label: ETAT_SUIVI_LIBELLES[e],
      }))
    : [];

/** Corps du changement d'état. Un risque accepté (exception, lot S1) porte une justification (la note), une mesure
    compensatoire et une échéance, toutes obligatoires ; message pour le premier champ manquant. */
export function corpsChangementEtat(
  etat: EtatSuiviFaille,
  note: string,
  revueLe: string,
  mesure = '',
): {
  corps: { etat: EtatSuiviFaille; note: string; revueLe?: string | null; mesure?: string };
  erreur: string | null;
} {
  const n = note.trim();
  const m = mesure.trim();
  const exception = etat === 'risque_accepte';
  return {
    corps: { etat, note: n, ...(exception ? { revueLe: revueLe || null, mesure: m } : {}) },
    erreur: exception
      ? !n
        ? 'Une justification est obligatoire pour accepter un risque.'
        : !m
          ? 'Une mesure compensatoire est obligatoire pour accepter un risque.'
          : !revueLe
            ? 'Une date d’échéance est obligatoire pour accepter un risque.'
            : null
      : noteObligatoire(etat) && !n
        ? `Une note est obligatoire pour l’état « ${ETAT_SUIVI_LIBELLES[etat]} ».`
        : null,
  };
}

/** Ligne d'historique en clair : événement, transition d'état. */
export function libelleHistorique(h: EntreeHistoriqueSuiviDto): string {
  const evenement = EVENEMENT_SUIVI_LIBELLES[h.evenement];
  if (h.etatAvant && h.etatAvant !== h.etatApres)
    return `${evenement} : ${ETAT_SUIVI_LIBELLES[h.etatAvant]} → ${ETAT_SUIVI_LIBELLES[h.etatApres]}`;
  return `${evenement} (${ETAT_SUIVI_LIBELLES[h.etatApres]})`;
}

/** Adresse du suivi d'un objet. */
export const urlSuivi = (nature: 'constat' | 'declaree', id: string, suite = '') =>
  `/api/vulnerabilites/suivis/${nature}/${id}${suite}`;
