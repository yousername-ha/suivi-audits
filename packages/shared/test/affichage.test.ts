import { describe, expect, it } from 'vitest';
import { computeSynthese, DEFAULT_PREFERENCES, Preferences } from '../src/index.js';

/* Données fictives (aucune donnée réelle). */
const ETAT = {
  nextDate: '2027-03-10',
  nextYear: 2027,
  yearLabels: { '2027': 'Audit de surveillance' },
  internalDate: '2027-01-15',
  findings: [
    { id: 'E1', text: 'Écart fictif A', status: 'Ouvert', type: 'NC mineure', due: '2026-09-01', owner: 'Pilote 1' },
    { id: 'E2', text: 'Écart fictif B', status: 'En cours', type: 'Observation', due: '2026-10-20', owner: 'Pilote 2' },
    { id: 'E3', text: 'Écart fictif C', status: 'Clos', type: 'NC mineure', due: '2026-08-01', owner: 'Pilote 1' },
    { id: 'E4', text: 'Écart fictif D', status: 'Ouvert', type: 'Observation', due: '2027-06-01', owner: '' },
  ],
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
  joursEcheance: 30,
  lisible,
});

describe('synthèse du tableau de bord', () => {
  it('chiffres des écarts, échéances triées, plan, mesures', () => {
    const s = computeSynthese(ETAT, opts());
    expect(s.ecarts).toMatchObject({ total: 4, ouverts: 3, enRetard: 1, aEcheance: 1 });
    expect(s.ecarts?.parStatut).toEqual({ Ouvert: 2, 'En cours': 1, Clos: 1 });
    expect(s.echeances.map((e) => [e.id, e.enRetard])).toEqual([
      ['E1', true],
      ['E2', false],
    ]);
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
    expect(s.ecarts).toBeNull();
    expect(s.echeances).toEqual([]);
    expect(s.plan).toBeNull();
    expect(s.mesures).toBeNull();
    expect(s.prochainAudit).toBeNull();
    expect(s.auditInterne).toBeNull();
  });

  it('état vide : synthèse vide sans erreur', () => {
    const s = computeSynthese({}, opts());
    expect(s.ecarts).toMatchObject({ total: 0, ouverts: 0 });
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
    });
    expect(Preferences.safeParse({ taille: '200' }).success).toBe(false);
    expect(Preferences.safeParse({ colonnes: { 'Pas valide!': [] } }).success).toBe(false);
  });
});
