/* Délais de correction et exceptions à échéance (ADR 0100, lot S1) : présentation sans état ni appel réseau (testée à part).
   Le serveur calcule l'échéance et l'état de chaque délai, les mêmes pour tout le monde ; l'écran les affiche avec leur
   libellé exact (jamais la couleur seule). */
import {
  type DelaiCorrection,
  type DelaiFailleDto,
  type DelaisCorrection,
  DELAI_CORRECTION_MAX,
  ETAT_DELAI_LIBELLES,
  ETATS_DELAI,
  type EtatDelai,
  libelleAge,
  libelleDelai,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  PERIODES_MESURE,
  STATUT_EXCEPTION_LIBELLES,
  type StatutException,
  type TriFailles,
  type UniteDelai,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export const CLE_DELAIS = ['vulnerabilites', 'delais'] as const;
export const ADRESSE_DELAIS = '/vulnerabilites/delais';
export const urlDelais = (periode: number) => `/api/vulnerabilites/delais?periode=${periode}`;
export const OPTIONS_PERIODE = PERIODES_MESURE.map((p) => ({
  value: String(p),
  label: p === 365 ? '12 derniers mois' : `${p} derniers jours`,
}));

/** Sens de la puce d'un état de délai (couleurs de la charte) : le libellé porte toujours le sens. */
export const ETAT_DELAI_PUCE: Record<EtatDelai, Etat> = {
  en_depassement: 'erreur',
  echeance_proche: 'attention',
  dans_les_delais: 'succes',
  sans_delai: 'neutre',
  sous_exception: 'info',
  non_rapportee: 'neutre',
  close: 'neutre',
};
export const STATUT_EXCEPTION_PUCE: Record<StatutException, Etat> = {
  en_cours: 'info',
  bientot_echue: 'attention',
  echue: 'erreur',
  sans_echeance: 'attention',
};
export const libelleEtatDelai = (e: EtatDelai) => ETAT_DELAI_LIBELLES[e];
export const libelleStatutException = (s: StatutException) => STATUT_EXCEPTION_LIBELLES[s];

/** Choix du filtre « Délai » des listes (vide : tous). */
export const OPTIONS_FILTRE_DELAI: { value: EtatDelai; label: string }[] = ETATS_DELAI.map((e) => ({
  value: e,
  label: ETAT_DELAI_LIBELLES[e],
}));
export const OPTIONS_TRI: { value: TriFailles; label: string }[] = [
  { value: 'priorite', label: 'Priorité' },
  { value: 'echeance', label: 'Échéance de correction' },
];

/** Date civile (AAAA-MM-JJ) en clair, sans fuseau : JJ/MM/AAAA. */
export const fmtJourCivil = (d: string | null) => (d ? d.split('-').reverse().join('/') : '');

/** Lignes du délai d'une faille : âge depuis la première présence, échéance calculée, délai et priorité. */
export function lignesDelai(
  d: DelaiFailleDto,
  maintenant: Date,
): { age: string; echeance: string | null; regle: string } {
  return {
    age: `Âge : ${libelleAge(d.premiere, maintenant)}`,
    echeance: d.echeance
      ? new Date(d.echeance).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
      : null,
    regle: `Délai ${d.priorite} : ${libelleDelai(d.delai)}`,
  };
}

/* ------------------------------------------------------------------ Saisie des délais (réglage) */
export type SaisieDelai = { actif: boolean; duree: number | string; unite: UniteDelai };
export type SaisieDelais = Record<NiveauPriorite, SaisieDelai>;

export function versSaisie(d: DelaisCorrection): SaisieDelais {
  const un = (x: DelaiCorrection): SaisieDelai =>
    x ? { actif: true, duree: x.duree, unite: x.unite } : { actif: false, duree: '', unite: 'jours' };
  return { P1: un(d.P1), P2: un(d.P2), P3: un(d.P3), P4: un(d.P4) };
}

/** Délais saisis, ou le motif du refus (durée entière, d'une heure à un an). */
export function depuisSaisie(s: SaisieDelais): { delais: DelaisCorrection | null; erreur: string | null } {
  const out = {} as DelaisCorrection;
  for (const p of NIVEAUX_PRIORITE) {
    const x = s[p];
    if (!x.actif) {
      out[p] = null;
      continue;
    }
    const n = typeof x.duree === 'number' ? x.duree : Number(String(x.duree).replace(',', '.'));
    if (!Number.isInteger(n) || n < 1 || n > DELAI_CORRECTION_MAX[x.unite])
      return {
        delais: null,
        erreur: `${p} : durée entière de 1 à ${DELAI_CORRECTION_MAX[x.unite].toLocaleString('fr-FR')} ${x.unite}.`,
      };
    out[p] = { duree: n, unite: x.unite };
  }
  return { delais: out, erreur: null };
}
