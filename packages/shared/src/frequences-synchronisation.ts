/* Fréquence de synchronisation (ADR 0100, lot F1 ; décision du RSSI du 19/11/2026) : réglable par source de la veille et par
   instance de connecteur, en listes fermées. Les paquets installés sur une machine changent peu, une CVE sort très souvent :
   Tenable une fois par jour par défaut, la veille toutes les deux heures. Les listes sont recopiées par la migration 090
   (contraintes CHECK) ; concordance vérifiée par apps/api/test/vulnerabilites-frequences.test.ts. Fonctions pures : la
   planification (tic de l'API) et l'affichage (prochaine échéance, avertissement) partagent la même règle. */
import { z } from 'zod';
import type { IntegrationType } from './integrations.js';
import type { SourceVeille } from './veille-vulnerabilites.js';

const HEURE_MS = 3_600_000;
/** Une semaine, en heures (plus longue fréquence d'un connecteur). */
export const HEURES_SEMAINE = 168;

/** Fréquences admises par source de la veille, en heures. NVD : deux heures au moins (demande de la source, plancher non
    contournable) ; EPSS : une fois par jour, fixe (scores publiés une fois par jour). */
export const FREQUENCES_VEILLE: Readonly<Record<SourceVeille, readonly number[]>> = {
  'cisa-kev': [1, 2, 4, 12, 24],
  nvd: [2, 4, 12, 24],
  epss: [24],
  'cert-fr': [1, 2, 4, 12, 24],
  'cert-sante': [1, 2, 4, 12, 24],
};
export const FREQUENCE_VEILLE_DEFAUT: Readonly<Record<SourceVeille, number>> = {
  'cisa-kev': 2,
  nvd: 2,
  epss: 24,
  'cert-fr': 2,
  'cert-sante': 2,
};

/** Fréquences admises par type de connecteur, en heures (sept jours = 168). */
export const FREQUENCES_CONNECTEUR: Readonly<Record<IntegrationType, readonly number[]>> = {
  tenable: [6, 12, 24, HEURES_SEMAINE],
  algolighthouse: [12, 24, HEURES_SEMAINE],
  // Lot N1 : import de fichier, aucune synchronisation automatique (la base n'admet que NULL pour ce type, migration 090).
  'nessus-fichier': [],
  // Lot SI1 : import du rapport Silène, aucune synchronisation automatique (même règle que l'import Nessus).
  'silene-fichier': [],
};
export const FREQUENCE_CONNECTEUR_DEFAUT = 24;

/** Une source dont la liste n'a qu'une valeur (EPSS) n'est pas réglable. */
export const frequenceVeilleModifiable = (source: SourceVeille) => FREQUENCES_VEILLE[source].length > 1;
export const frequenceVeilleAdmise = (source: SourceVeille, heures: number) =>
  FREQUENCES_VEILLE[source].includes(heures);
export const frequenceConnecteurAdmise = (type: IntegrationType, heures: number) =>
  FREQUENCES_CONNECTEUR[type].includes(heures);

/** Fréquence effective : réglée, sinon la valeur par défaut (base : NULL). */
export const frequenceVeille = (source: SourceVeille, reglee: number | null | undefined) =>
  reglee ?? FREQUENCE_VEILLE_DEFAUT[source];
export const frequenceConnecteur = (reglee: number | null | undefined) => reglee ?? FREQUENCE_CONNECTEUR_DEFAUT;
/** Le type a-t-il une synchronisation automatique (liste de fréquences non vide) ? L'import de fichier n'en a pas. */
export const frequenceConnecteurReglable = (type: IntegrationType) => FREQUENCES_CONNECTEUR[type].length > 0;

/** Corps du réglage (route de la veille, et champ de la modification d'une instance) : un nombre entier d'heures ; la liste
    de la source ou du type est contrôlée par le serveur (422 hors liste). */
export const FrequenceHeures = z.number().int().min(1).max(HEURES_SEMAINE);
export const FrequenceVeilleBody = z.object({ frequenceHeures: FrequenceHeures }).strict();
export type FrequenceVeilleBody = z.infer<typeof FrequenceVeilleBody>;

/** Libellé d'une fréquence (« Toutes les 2 heures », « Une fois par jour »…). */
export function libelleFrequence(heures: number): string {
  if (heures === 1) return 'Toutes les heures';
  if (heures === 24) return 'Une fois par jour';
  if (heures === HEURES_SEMAINE) return 'Une fois par semaine';
  if (heures % 24 === 0) return `Tous les ${heures / 24} jours`;
  return `Toutes les ${heures} heures`;
}

const date = (d: Date | string) => (typeof d === 'string' ? new Date(d) : d);

/** Prochaine échéance d'une demande automatique : une période après la référence de la dernière ; tout de suite s'il n'y en
    a jamais eu. */
export function prochaineEcheance(derniere: Date | string | null, frequenceHeures: number, maintenant: Date): Date {
  return derniere ? new Date(date(derniere).getTime() + frequenceHeures * HEURE_MS) : maintenant;
}

/** La demande automatique est-elle due ? */
export const echeanceAtteinte = (derniere: Date | string | null, frequenceHeures: number, maintenant: Date) =>
  maintenant.getTime() >= prochaineEcheance(derniere, frequenceHeures, maintenant).getTime();

/** Référence à ranger quand une demande automatique est faite : l'échéance théorique tant que le retard est inférieur à une
    période (le tic d'une minute n'accumule aucun décalage), sinon l'instant présent (aucun rattrapage, aucune rafale : après
    une panne, ou quand la fréquence vient d'être raccourcie, une seule demande, puis une par période). */
export function referenceApresDemande(derniere: Date | string | null, frequenceHeures: number, maintenant: Date): Date {
  const e = prochaineEcheance(derniere, frequenceHeures, maintenant);
  return !derniere || maintenant.getTime() - e.getTime() >= frequenceHeures * HEURE_MS ? maintenant : e;
}

/** Prochaine demande automatique à afficher : l'échéance, ou l'instant présent si elle est passée (demande au prochain tic). */
export const prochaineAffichee = (derniere: Date | string | null, frequenceHeures: number, maintenant: Date): Date => {
  const e = prochaineEcheance(derniere, frequenceHeures, maintenant);
  return e.getTime() < maintenant.getTime() ? maintenant : e;
};

/* ------------------------------------------------------------------ Lot PRIO-1 : quatre réglages (décision du 20/11/2026) */
/** Plancher de NVD, en heures : vaut pour la planification ET pour « Collecter maintenant » (aucune lecture de NVD moins de
    deux heures après la précédente demande, manuelle ou automatique). */
export const PLANCHER_NVD_HEURES = Math.min(...FREQUENCES_VEILLE.nvd);
/** Une source de la veille passe « En retard » après ce nombre de périodes sans collecte réussie (au lieu de 36 h fixes). */
export const PERIODES_AVANT_RETARD = 3;
/** Journal des collectes de la veille et des exécutions des connecteurs : purgé au-delà de ce nombre de jours. */
export const JOURNAUX_CONSERVATION_JOURS = 90;

/** La source est-elle en retard : aucune collecte réussie, ou la dernière date de plus de trois périodes ? */
export function sourceEnRetard(
  derniereReussite: Date | string | null,
  frequenceHeures: number,
  maintenant: Date,
): boolean {
  if (!derniereReussite) return true;
  return maintenant.getTime() - date(derniereReussite).getTime() > PERIODES_AVANT_RETARD * frequenceHeures * HEURE_MS;
}

/* ------------------------------------------------------------------ Avertissements (tableau du RSSI) */
export const AVERTISSEMENT_NVD =
  'NVD demande de ne pas être lu automatiquement plus d’une fois toutes les deux heures : c’est le plancher, il ne peut pas être abaissé.';
export const AVERTISSEMENT_EPSS = 'Les scores EPSS ne sont publiés qu’une fois par jour : la fréquence est fixe.';
export const AVERTISSEMENT_TENABLE =
  'En dessous de 24 heures : charge supplémentaire sur Security Center, pour un inventaire qui change peu.';
export const AVERTISSEMENT_ALH = 'En dessous de 24 heures : la limite d’appels de l’éditeur n’est pas connue.';

/** Avertissement d'une source de la veille : NVD (plancher) et EPSS (fixe), toujours ; aucun pour les autres. */
export function avertissementVeille(source: SourceVeille): string | null {
  if (source === 'nvd') return AVERTISSEMENT_NVD;
  if (source === 'epss') return AVERTISSEMENT_EPSS;
  return null;
}

/** Avertissement d'un connecteur : seulement en dessous de 24 heures. Ce n'est pas un refus. */
export function avertissementConnecteur(type: IntegrationType, frequenceHeures: number): string | null {
  if (frequenceHeures >= 24) return null;
  return type === 'tenable' ? AVERTISSEMENT_TENABLE : AVERTISSEMENT_ALH;
}
