/* Registre des incidents et cellule de crise : règles de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  ActionScenarioModification,
  EcheanceCreation,
  IncidentCreation,
  IncidentModification,
  avancementChecklist,
  celluleActive,
  ecartMainCourante,
  filtrerIncidents,
  formaterDureeCrise,
  identifiantActionIncident,
  identifiantIncident,
  incidentOuvert,
  lireEtatCrise,
  lireIncident,
  obligationsIncident,
  prioriteIncident,
  qualifierIncident,
  resteEcheance,
  syntheseIncidents,
  syntheseRetex,
} from '../src/index.js';

describe('qualification', () => {
  it('atteinte à la confidentialité, l’intégrité ou la disponibilité : incident de sécurité', () => {
    expect(qualifierIncident({ cia: 'oui', service: 'non' }).kind).toBe('Incident de sécurité');
  });
  it('service dégradé : incident, ou incident de sécurité si une règle est enfreinte', () => {
    expect(qualifierIncident({ service: 'oui' }).kind).toBe('Incident');
    expect(qualifierIncident({ service: 'oui', politique: 'oui' }).kind).toBe('Incident de sécurité');
  });
  it('règle enfreinte sans conséquence : événement de sécurité ; demande ; sinon événement', () => {
    expect(qualifierIncident({ politique: 'oui' }).kind).toBe('Événement de sécurité');
    expect(qualifierIncident({ demande: 'oui' }).kind).toBe('Demande');
    expect(qualifierIncident({}).kind).toBe('Événement');
  });
  it('« je ne sais pas » vaut « non »', () => {
    expect(qualifierIncident({ cia: 'nsp', service: 'nsp' }).kind).toBe('Événement');
  });
});

describe('obligations', () => {
  it('uniquement pour un incident de sécurité : réponse, RGPD, santé et NIS 2 selon les réponses', () => {
    expect(obligationsIncident({}, 'Incident', '')).toEqual([]);
    const base = obligationsIncident({}, 'Incident de sécurité', '');
    expect(base.map((o) => o[0])).toEqual(['Qualification et réponse', 'NIS 2']);
    expect(base[1]![1]).toContain('Catégorie du GCS : à confirmer.');
    const tout = obligationsIncident({ dcp: 'oui', sante: 'oui' }, 'Incident de sécurité', 'importante');
    expect(tout.map((o) => o[0])).toEqual(['Qualification et réponse', 'RGPD', 'Santé et HDS', 'NIS 2']);
    expect(tout[3]![1]).toContain('Catégorie du GCS : importante.');
  });
});

describe('priorité et états', () => {
  it('matrice impact × urgence', () => {
    expect(prioriteIncident('Élevé', 'Élevé')).toBe('P1 Critique');
    expect(prioriteIncident('Élevé', 'Moyen')).toBe('P2 Haute');
    expect(prioriteIncident('Faible', 'Faible')).toBe('P5 Planifiée');
    expect(prioriteIncident('', 'Faible')).toBe('');
  });
  it('registre : ouverts, synthèse et filtres triés par détection décroissante', () => {
    const l = [
      lireIncident({ id: 'A', detectedAt: '2026-10-01T10:00', kind: 'Incident de sécurité', status: 'En cours' }),
      lireIncident({ id: 'B', detectedAt: '2026-10-03T10:00', kind: 'Incident', status: 'Clos' }),
      lireIncident({ id: 'C', detectedAt: '2026-10-02T10:00', kind: 'Demande', status: 'Nouveau' }),
    ].map((x) => x!);
    expect(incidentOuvert(l[1]!)).toBe(false);
    expect(syntheseIncidents(l)).toEqual({ ouverts: 2, securiteOuverts: 1, clos: 1, total: 3 });
    expect(filtrerIncidents(l, 'all').map((x) => x.id)).toEqual(['B', 'C', 'A']);
    expect(filtrerIncidents(l, 'open').map((x) => x.id)).toEqual(['C', 'A']);
    expect(filtrerIncidents(l, 'sec').map((x) => x.id)).toEqual(['A']);
    expect(filtrerIncidents(l, 'Demande').map((x) => x.id)).toEqual(['C']);
  });
  it('lecture avec valeurs par défaut et identifiants', () => {
    expect(lireIncident({ id: 'X' })).toMatchObject({ kind: 'Incident', cat: 'Autre', status: 'Nouveau', answers: {} });
    expect(lireIncident({ title: 'sans id' })).toBeNull();
    expect(identifiantIncident(['INC-2026-001', 'INC-2026-003'], 2026)).toBe('INC-2026-002');
    expect(identifiantIncident(['INC-2025-001'], 2026)).toBe('INC-2026-001');
    expect(identifiantActionIncident(['INC-AC-01', 'INC-AC-03'])).toBe('INC-AC-02');
  });
  it('validation des écritures', () => {
    expect(IncidentModification.safeParse({ status: 'Autre' }).success).toBe(false);
    expect(IncidentModification.safeParse({ detectedAt: '14/10/2026' }).success).toBe(false);
    expect(
      IncidentModification.safeParse({ impact: '', urgency: 'Moyen', detectedAt: '2026-10-14T08:30' }).success,
    ).toBe(true);
    expect(IncidentCreation.safeParse({ answers: { cia: 'peut-être' } }).success).toBe(false);
    expect(IncidentCreation.safeParse({ answers: { cia: 'oui' }, title: 'Titre fictif' }).success).toBe(true);
  });
});

describe('cellule de crise', () => {
  const etat = lireEtatCrise({
    scenarios: [
      {
        id: 'SCN-1',
        title: 'Rançongiciel',
        items: [{ phase: 'Alerte', t: 'Alerter' }, { t: 'Isoler' }, { phase: 'Gestion', t: 'Restaurer' }],
      },
    ],
    cells: [
      {
        id: 'C1',
        title: 'Exercice',
        mode: 'Exercice',
        scenario: 'SCN-1',
        start: '2026-10-14T08:00:00.000Z',
        status: 'Clôturée',
        end: '2026-10-14T09:05:09.000Z',
        log: [{ ts: '2026-10-14T08:00:00.000Z', type: 'Information', text: 'Ouverture' }],
        checks: { '0': { done: true, ts: 'x' }, '1': { done: false } },
      },
      {
        id: 'C2',
        title: 'Crise',
        mode: 'Réel',
        status: 'Active',
        start: '2026-10-14T10:00:00.000Z',
        log: [],
        deadlines: [{ label: 'CNIL', due: '2026-10-17T10:00:00.000Z' }],
      },
    ],
    contacts: [{ name: 'Contact fictif', key: 1 }],
  });
  it('lecture : phase par défaut, cases cochées seulement, cellule active', () => {
    expect(etat.scenarios[0]!.items[1]!.phase).toBe('Gestion');
    expect(etat.cells[0]!.checks).toEqual({ '0': { done: true, ts: 'x' } });
    expect(celluleActive(etat)!.id).toBe('C2');
    expect(etat.contacts[0]).toMatchObject({ name: 'Contact fictif', key: true, phone: '' });
    expect(lireEtatCrise(undefined)).toEqual({ contacts: [], scenarios: [], cells: [] });
  });
  it('durées et avancement', () => {
    expect(formaterDureeCrise(0)).toBe('00 min 00 s');
    expect(formaterDureeCrise(3909000)).toBe('1 h 05 min 09 s');
    expect(formaterDureeCrise(-5)).toBe('00 min 00 s');
    expect(ecartMainCourante('2026-10-14T09:05:09.000Z', '2026-10-14T08:00:00.000Z')).toBe('1 h 05 min');
    expect(avancementChecklist(etat.cells[0]!, etat.scenarios[0])).toEqual({ faits: 1, total: 3 });
    expect(avancementChecklist(etat.cells[1]!, undefined)).toEqual({ faits: 0, total: 0 });
    expect(resteEcheance(etat.cells[1]!.deadlines[0]!, Date.parse('2026-10-16T10:00:00.000Z'))).toBe(864e5);
    expect(syntheseRetex(etat.cells[0]!, '2026-10-14T09:05:09.000Z')).toBe(
      'Main courante : 1 entrées, durée 1 h 05 min 09 s.',
    );
  });
  it('validation des écritures', () => {
    expect(EcheanceCreation.safeParse({ label: 'x', heures: 0 }).success).toBe(false);
    expect(EcheanceCreation.safeParse({ label: 'CNIL', heures: 72 }).success).toBe(true);
    expect(ActionScenarioModification.safeParse({ phase: 'Autre' }).success).toBe(false);
  });
});
