import { describe, expect, it } from 'vitest';
import { computeSynthese, DEFAULT_PREFERENCES, Preferences } from '../src/index.js';

/* Données fictives (aucune donnée réelle). */
const ETAT = {
  nextDate: '2027-03-10',
  nextYear: 2027,
  yearLabels: { '2027': 'Audit de surveillance' },
  internalDate: '2027-01-15',
  items: [{ ref: 'A' }, { ref: 'A' }, { ref: 'ISO' }, { ref: 'HDS' }],
  plan: {
    status: 'Validé',
    days: [{ id: 'j1', label: 'Jour 1', date: '2027-03-10' }],
    slots: [{ day: 'j1' }, { day: 'j1' }, { day: 'autre' }],
  },
};
const opts = (lisible: (k: string) => boolean = () => true) => ({
  organisation: 'Organisation fictive',
  aujourdHui: new Date('2026-10-07T10:00:00Z'),
  lisible,
});

describe('synthèse du tableau de bord', () => {
  it('prochain audit, plan, mesures ; les sections des fiches de registre sont ajoutées par le serveur', () => {
    const s = computeSynthese(ETAT, opts());
    expect(s.ecarts).toBeNull();
    expect(s.echeances).toEqual([]);
    expect(s.actions).toBeNull();
    expect(s.prochainAudit).toEqual({ date: '2027-03-10', annee: 2027, libelle: 'Audit de surveillance' });
    expect(s.auditInterne).toBe('2027-01-15');
    expect(s.plan).toEqual({ statut: 'Validé', jours: [{ label: 'Jour 1', date: '2027-03-10', creneaux: 2 }] });
    expect(s.mesures).toEqual({ total: 4, parReferentiel: { A: 2, ISO: 1, HDS: 1 } });
  });

  it('modules non lisibles : rien n’est exposé', () => {
    const s = computeSynthese(
      ETAT,
      opts(() => false),
    );
    expect(s.plan).toBeNull();
    expect(s.mesures).toBeNull();
    expect(s.prochainAudit).toBeNull();
    expect(s.auditInterne).toBeNull();
  });

  it('état vide : synthèse vide sans erreur', () => {
    const s = computeSynthese({}, opts());
    expect(s.mesures).toEqual({ total: 0, parReferentiel: {} });
    expect(s.prochainAudit).toBeNull();
  });
});

describe('préférences', () => {
  it('valeurs par défaut et bornes', () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      taille: 'auto',
      densite: 'organisation',
      theme: 'organisation',
      colonnes: {},
      cartographie: {},
    });
    expect(Preferences.safeParse({ taille: '200' }).success).toBe(false);
    expect(Preferences.safeParse({ cartographie: { viewport: { context: { x: 0, y: 0, k: 9 } } } }).success).toBe(
      false,
    );
    expect(Preferences.parse({ cartographie: { viewport: { process: { x: 1, y: 2, k: 1 } } } }).cartographie).toEqual({
      viewport: { process: { x: 1, y: 2, k: 1 } },
    });
    expect(Preferences.safeParse({ colonnes: { 'Pas valide!': [] } }).success).toBe(false);
  });
});
