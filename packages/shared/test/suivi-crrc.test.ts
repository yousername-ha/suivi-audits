/* Gestion CRRC : calculs de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  AlerteCreation,
  EtablissementModification,
  RestaurationCreation,
  derniereSauvegarde,
  evolutionVolume,
  formaterDuree,
  formaterVolume,
  identifiantEtablissement,
  lireEtatCrrc,
  niveauCrrc,
  activiteParDepartement,
  departementFiness,
  rapportMensuelCrrc,
  sommetVolume,
  statistiquesCrrc,
  statutEtablissement,
  statutRessource,
  volumeProtege,
} from '../src/index.js';

const MAINTENANT = Date.parse('2026-10-14T12:00');
const etat = lireEtatCrrc({
  establishments: [
    { id: 'E1', name: 'Établissement fictif', finess: '140000000', status: 'Actif' },
    { id: 'E2', name: 'Autre établissement', finess: '990000000', status: 'Déploiement' },
  ],
  resources: [
    { id: 'R1', est: 'E1', name: 'NAS fictif', tech: 's3' },
    { id: 'R2', est: 'E1', name: 'Serveur fictif', tech: 'windows' },
  ],
  runs: [
    { id: 'A', res: 'R1', date: '2026-10-01 02:00', type: 'Complète', status: 'Réussie', volumeGb: 100 },
    { id: 'B', res: 'R1', date: '2026-10-10T02:00', type: 'Incrémentale', status: 'Réussie', volumeGb: 10 },
    { id: 'C', res: 'R1', date: '2026-10-12T02:00', type: 'Incrémentale', status: 'Échec', volumeGb: 99 },
    { id: 'D', res: 'R1', date: '2026-09-20T02:00', type: 'Complète', status: 'Réussie', volumeGb: 50 },
    { id: 'F', res: 'R2', date: '2026-10-13T02:00', type: 'Incrémentale', status: 'Réussie', volumeGb: 5 },
  ],
  restores: [{ id: 'S1', date: '2026-10-05T10:00', est: 'E1', res: 'R1', status: 'Demandée' }],
  alerts: [
    {
      id: 'L1',
      date: '2026-10-12T03:00',
      severity: 'Haute',
      est: 'E1',
      res: 'R1',
      message: 'Échec',
      status: 'Ouverte',
    },
    {
      id: 'L2',
      date: '2026-09-12T03:00',
      severity: 'Info',
      est: 'E1',
      res: 'R2',
      message: 'Ancienne',
      status: 'Résolue',
    },
  ],
});

describe('lecture', () => {
  it('ajoute l’offre de sauvegarde et normalise les horodatages', () => {
    expect(etat.offers.map((o) => o.id)).toEqual(['backup']);
    expect(etat.offers[0]!.perimeters).toHaveLength(5);
    expect(etat.runs[0]!.date).toBe('2026-10-01T02:00');
    expect(lireEtatCrrc(null).establishments).toEqual([]);
  });
});

describe('volume protégé et statuts', () => {
  it('dernière sauvegarde complète et incrémentales suivantes, échecs exclus', () => {
    expect(volumeProtege(etat.runs.filter((r) => r.res === 'R1'))).toBe(110);
    expect(
      volumeProtege(
        etat.runs.filter((r) => r.res === 'R1'),
        '2026-09-30',
      ),
    ).toBe(50);
    expect(volumeProtege([])).toBe(0);
  });
  it('statut de ressource : alerte ouverte, échec, réussie, non configuré', () => {
    const [r1, r2] = etat.resources;
    expect(derniereSauvegarde(etat, 'R1')!.id).toBe('C');
    expect(statutRessource(etat, r1!)).toEqual(['Échec', 'bad']);
    expect(statutRessource(etat, r2!)).toEqual(['Réussie', 'ok']);
    expect(statutRessource(etat, { ...r2!, id: 'R9' })).toEqual(['Non configuré', 'na']);
  });
  it('statut d’établissement', () => {
    expect(statutEtablissement(etat, etat.establishments[0]!)).toEqual(['Alerte', 'mid']);
    expect(statutEtablissement(etat, etat.establishments[1]!)).toEqual(['Non configuré', 'na']);
  });
  it('niveaux d’affichage', () => {
    expect(['Actif', 'Échec', 'Ouverte', 'Inconnu'].map(niveauCrrc)).toEqual(['ok', 'bad', 'bad', 'na']);
  });
});

describe('statistiques', () => {
  it('taux de succès sur la période et variation avec la période précédente', () => {
    const s = statistiquesCrrc(etat, '7j', MAINTENANT);
    expect(s.sauvegardes).toBe(3); // B (10/10), C (12/10), F (13/10)
    expect(s.taux).toBeCloseTo(2 / 3);
    expect(s.variation).toBeCloseTo(2 / 3 - 1); // période précédente : A (01/10) seule, réussie… hors fenêtre
    expect(s.volume).toBe(115);
    expect(s.alertes.map((a) => a.id)).toEqual(['L1']);
    expect(s.actifs).toBe(1);
  });
  it('sans sauvegarde : taux indéfini', () => {
    expect(statistiquesCrrc(lireEtatCrrc({}), '7j', MAINTENANT).taux).toBeNull();
  });
});

describe('évolution et axe', () => {
  it('un point par jour sur 7 jours, avec le volume protégé par technologie', () => {
    const e = evolutionVolume(etat, '7j', MAINTENANT);
    expect(e).toHaveLength(7);
    expect(e[6]!.valeurs).toEqual({ s3: 110, windows: 5 });
    expect(e[0]!.valeurs.s3).toBe(100); // au 8 octobre : complète du 1er, la sauvegarde du 10 n'existe pas encore
  });
  it('douze points mensuels sur 12 mois', () => {
    expect(evolutionVolume(etat, '12m', MAINTENANT)).toHaveLength(12);
  });
  it('sommet de l’axe arrondi, en Go puis en To', () => {
    expect(sommetVolume(110)).toEqual({ sommet: 150, unite: 1 });
    expect(sommetVolume(5000).unite).toBe(1000);
    expect(sommetVolume(0).sommet).toBeGreaterThan(0);
  });
});

describe('rapport et carte', () => {
  it('rapport du mois par établissement', () => {
    const [a] = rapportMensuelCrrc(etat, '2026-10');
    expect(a).toMatchObject({ sauvegardes: 4, alertes: 1, restaurations: 1, volume: 115 });
    expect(a!.taux).toBe(75);
    expect(rapportMensuelCrrc(etat, '2026-08')[0]!.taux).toBeNull();
  });
  it('activité par département : département tiré du FINESS, « ? » si le FINESS est vide', () => {
    expect(departementFiness('140000100')).toBe('14');
    expect(departementFiness('2A0000100')).toBe('2A');
    expect(departementFiness('')).toBe('?');
    const groupes = activiteParDepartement(etat);
    expect(groupes.flatMap((g) => g.etablissements)).toHaveLength(2);
    expect(groupes.map((g) => g.departement)).toEqual(
      groupes.map((g) => g.departement).sort((a, b) => a.localeCompare(b)),
    );
    for (const g of groupes)
      for (const x of g.etablissements)
        expect(departementFiness(etat.establishments.find((e) => e.id === x.id)!.finess)).toBe(g.departement);
  });
});

describe('formats et identifiants', () => {
  it('volumes et durées', () => {
    expect(formaterVolume(512)).toBe('512 Go');
    expect(formaterVolume(2048)).toBe('2 To');
    expect(formaterDuree(45)).toBe('45 min');
    expect(formaterDuree(125)).toBe('2 h 05');
    expect(identifiantEtablissement(2, 1_700_000_000_000)).toMatch(/^CRRC-003-[0-9A-Z]{3}$/);
  });
});

describe('validation', () => {
  it('refuse les valeurs hors liste, dates mal formées et champs inattendus', () => {
    expect(EtablissementModification.safeParse({ status: 'Autre' }).success).toBe(false);
    expect(EtablissementModification.safeParse({ signed: '1/1/2026' }).success).toBe(false);
    expect(EtablissementModification.safeParse({ scopes: { inconnu: true } }).success).toBe(false);
    expect(EtablissementModification.safeParse({ scopes: { s3: true }, capacityGb: 12.5 }).success).toBe(true);
    expect(AlerteCreation.safeParse({ severity: 'Basse', res: 'R1', message: '' }).success).toBe(false);
    expect(
      RestaurationCreation.safeParse({
        res: 'R1',
        point: '2026-10-01T02:00',
        scope: '',
        type: 'Incident',
        owner: '',
        dest: 'Emplacement d’origine',
        path: '',
        conflict: 'Renommer',
      }).success,
    ).toBe(true);
  });
});
