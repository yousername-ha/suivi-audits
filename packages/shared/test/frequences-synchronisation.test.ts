/* Lot F1 (ADR 0100) : fréquence de synchronisation par source de la veille et par type de connecteur. Listes fermées du
   tableau du RSSI (19/11/2026), valeurs par défaut, prochaine échéance, référence rangée (sans décalage cumulé ni rafale),
   avertissements, schémas. */
import { describe, expect, it } from 'vitest';
import {
  AVERTISSEMENT_ALH,
  AVERTISSEMENT_EPSS,
  AVERTISSEMENT_NVD,
  AVERTISSEMENT_TENABLE,
  avertissementConnecteur,
  avertissementVeille,
  echeanceAtteinte,
  FREQUENCE_CONNECTEUR_DEFAUT,
  FREQUENCE_VEILLE_DEFAUT,
  FREQUENCES_CONNECTEUR,
  FREQUENCES_VEILLE,
  FrequenceVeilleBody,
  frequenceConnecteur,
  frequenceConnecteurAdmise,
  frequenceConnecteurReglable,
  frequenceVeille,
  frequenceVeilleAdmise,
  frequenceVeilleModifiable,
  IntegrationModification,
  libelleFrequence,
  prochaineAffichee,
  prochaineEcheance,
  referenceApresDemande,
  SOURCES_VEILLE,
} from '../src/index.js';

const T0 = new Date('2026-11-16T09:00:00Z');
const plus = (minutes: number, d = T0) => new Date(d.getTime() + minutes * 60_000);

describe('listes fermées (tableau du RSSI)', () => {
  it('veille : 1 à 24 h pour KEV et les CERT, NVD 2 h au moins, EPSS 24 h fixe ; deux heures par défaut', () => {
    expect(FREQUENCES_VEILLE).toEqual({
      'cisa-kev': [1, 2, 4, 12, 24],
      nvd: [2, 4, 12, 24],
      epss: [24],
      'cert-fr': [1, 2, 4, 12, 24],
      'cert-sante': [1, 2, 4, 12, 24],
    });
    expect(FREQUENCE_VEILLE_DEFAUT).toEqual({ 'cisa-kev': 2, nvd: 2, epss: 24, 'cert-fr': 2, 'cert-sante': 2 });
    for (const s of SOURCES_VEILLE) {
      expect(frequenceVeilleAdmise(s, FREQUENCE_VEILLE_DEFAUT[s])).toBe(true);
      expect(frequenceVeille(s, null)).toBe(FREQUENCE_VEILLE_DEFAUT[s]);
    }
    expect(frequenceVeilleAdmise('nvd', 1)).toBe(false);
    expect(frequenceVeilleAdmise('epss', 2)).toBe(false);
    expect(frequenceVeilleAdmise('cisa-kev', 3)).toBe(false);
    expect(frequenceVeilleModifiable('epss')).toBe(false);
    expect(SOURCES_VEILLE.filter(frequenceVeilleModifiable)).toEqual(['cisa-kev', 'nvd', 'cert-fr', 'cert-sante']);
    expect(frequenceVeille('nvd', 12)).toBe(12);
  });

  it('connecteurs : Tenable 6 h à 7 jours, AlgoLightHouse 12 h à 7 jours ; 24 h par défaut ; imports Nessus et Silène sans synchronisation', () => {
    expect(FREQUENCES_CONNECTEUR).toEqual({
      tenable: [6, 12, 24, 168],
      algolighthouse: [12, 24, 168],
      'nessus-fichier': [],
      'silene-fichier': [],
    });
    expect(frequenceConnecteurReglable('silene-fichier')).toBe(false);
    expect(frequenceConnecteurReglable('tenable')).toBe(true);
    expect(frequenceConnecteurReglable('nessus-fichier')).toBe(false);
    expect(frequenceConnecteurAdmise('nessus-fichier', 24)).toBe(false);
    expect(FREQUENCE_CONNECTEUR_DEFAUT).toBe(24);
    expect(frequenceConnecteur(null)).toBe(24);
    expect(frequenceConnecteur(6)).toBe(6);
    expect(frequenceConnecteurAdmise('tenable', 6)).toBe(true);
    expect(frequenceConnecteurAdmise('algolighthouse', 6)).toBe(false);
    expect(frequenceConnecteurAdmise('tenable', 48)).toBe(false);
  });

  it('libellés', () => {
    expect([1, 2, 4, 6, 12, 24, 168].map(libelleFrequence)).toEqual([
      'Toutes les heures',
      'Toutes les 2 heures',
      'Toutes les 4 heures',
      'Toutes les 6 heures',
      'Toutes les 12 heures',
      'Une fois par jour',
      'Une fois par semaine',
    ]);
    expect(libelleFrequence(48)).toBe('Tous les 2 jours');
  });

  it('schémas : un nombre entier d’heures, sept jours au plus ; la liste est contrôlée par le serveur', () => {
    expect(FrequenceVeilleBody.safeParse({ frequenceHeures: 4 }).success).toBe(true);
    for (const v of [0, 1.5, 169, '4', null])
      expect(FrequenceVeilleBody.safeParse({ frequenceHeures: v }).success, String(v)).toBe(false);
    expect(FrequenceVeilleBody.safeParse({ frequenceHeures: 4, autre: 1 }).success).toBe(false);
    expect(IntegrationModification.safeParse({ frequenceHeures: 6 }).success).toBe(true);
    expect(IntegrationModification.safeParse({ frequenceHeures: 0 }).success).toBe(false);
  });
});

describe('échéance', () => {
  it('jamais demandée : due tout de suite ; sinon une période après la référence', () => {
    expect(prochaineEcheance(null, 2, T0)).toEqual(T0);
    expect(echeanceAtteinte(null, 2, T0)).toBe(true);
    expect(prochaineEcheance(T0, 2, plus(10))).toEqual(plus(120));
    expect(prochaineEcheance(T0.toISOString(), 168, T0)).toEqual(plus(168 * 60));
    expect(echeanceAtteinte(T0, 2, plus(119))).toBe(false);
    expect(echeanceAtteinte(T0, 2, plus(120))).toBe(true);
    expect(echeanceAtteinte(T0, 24, plus(23 * 60 + 59))).toBe(false);
  });

  it('référence rangée : l’échéance théorique (aucun décalage cumulé), l’instant présent après un long arrêt (aucune rafale)', () => {
    expect(referenceApresDemande(null, 2, T0)).toEqual(T0);
    // Tic en retard de 40 secondes : la référence reste l'échéance.
    const tic = new Date(plus(120).getTime() + 40_000);
    expect(referenceApresDemande(T0, 2, tic)).toEqual(plus(120));
    // Retard d'une période ou plus (panne, fréquence raccourcie) : on repart de maintenant, une seule demande.
    expect(referenceApresDemande(T0, 2, plus(240))).toEqual(plus(240));
    expect(referenceApresDemande(T0, 1, plus(5 * 60))).toEqual(plus(5 * 60));
    // Après cette demande, la suivante n'est due qu'une période plus tard.
    expect(echeanceAtteinte(plus(5 * 60), 1, plus(5 * 60 + 59))).toBe(false);
  });

  it('affichage : jamais dans le passé', () => {
    expect(prochaineAffichee(T0, 2, plus(30))).toEqual(plus(120));
    expect(prochaineAffichee(T0, 2, plus(300))).toEqual(plus(300));
    expect(prochaineAffichee(null, 2, T0)).toEqual(T0);
  });
});

describe('avertissements', () => {
  it('veille : NVD (plancher) et EPSS (fixe), toujours ; aucun pour les autres sources', () => {
    expect(avertissementVeille('nvd')).toBe(AVERTISSEMENT_NVD);
    expect(AVERTISSEMENT_NVD).toMatch(/deux heures/);
    expect(avertissementVeille('epss')).toBe(AVERTISSEMENT_EPSS);
    expect(AVERTISSEMENT_EPSS).toMatch(/une fois par jour/);
    for (const s of ['cisa-kev', 'cert-fr', 'cert-sante'] as const) expect(avertissementVeille(s)).toBeNull();
  });

  it('connecteurs : seulement en dessous de 24 heures', () => {
    expect(avertissementConnecteur('tenable', 6)).toBe(AVERTISSEMENT_TENABLE);
    expect(avertissementConnecteur('tenable', 12)).toBe(AVERTISSEMENT_TENABLE);
    expect(avertissementConnecteur('tenable', 24)).toBeNull();
    expect(avertissementConnecteur('tenable', 168)).toBeNull();
    expect(avertissementConnecteur('algolighthouse', 12)).toBe(AVERTISSEMENT_ALH);
    expect(avertissementConnecteur('algolighthouse', 24)).toBeNull();
  });
});
