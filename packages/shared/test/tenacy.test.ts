import { describe, expect, it } from 'vitest';
import {
  actionTenacy,
  codeMesureTenacy,
  codesMesuresTenacy,
  dateTenacy,
  lireGaps,
  texteTenacy,
} from '../src/tenacy.js';

const ENTETE = [
  'Id',
  'Name FR',
  'Name EN',
  'Description FR',
  'Description EN',
  'Recommandation FR',
  'Recommendation EN',
  'Perimeter',
  'Measure',
  'Status',
  'Resolution status',
  'Deadline',
  'Manager',
  'Group',
  'Criticality',
  'Requirements',
  'Actions',
  'Source',
];
const ligne = (o: Record<string, string>) => ENTETE.map((h) => o[h] ?? '');

describe('lecture de l’onglet Gaps de Tenacy (données fictives)', () => {
  it('lit un écart de certification : statut, groupe, échéance, mesures, actions', () => {
    const r = lireGaps([
      ENTETE,
      ligne({
        Id: '25-DHA-001',
        'Name FR': 'Revue des accès incomplète',
        'Description FR': "Description de l'écart : Les revues d'accès ne couvrent pas tous les outils.",
        'Recommandation FR': 'Compléter la revue des accès :\n- Inventorier les outils\n- Planifier la revue annuelle',
        Perimeter: 'Établissement fictif',
        Status: 'IN_PROGRESS',
        Deadline: '31/12/2026',
        Manager: 'Pilote fictif',
        Group: 'NCMin',
        Criticality: 'Haute',
        Requirements: 'ISO-01-22 9.1, DDA-NES 5.15',
        Measure: 'HDS-2.0 EXI04',
      }),
    ]);
    expect(r.erreurs).toEqual([]);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0]).toMatchObject({
      id: '25-DHA-001',
      nom: 'Revue des accès incomplète',
      description: 'Les revues d’accès ne couvrent pas tous les outils.'.replace('’', "'"),
      action: 'Compléter la revue des accès',
      taches: ['Inventorier les outils', 'Planifier la revue annuelle'],
      statut: 'progress',
      echeance: '2026-12-31',
      classification: 'mineure',
      nature: 'nonconformity',
      mesures: ['ISO-9.1', 'A-5.15', 'HDS-04'],
      source: 'AFNOR',
      annee: 2025,
    });
  });

  it('statuts, résolution, groupes et statuts inconnus', () => {
    const r = lireGaps([
      ENTETE,
      ligne({ Id: 'A', Status: 'TO_BE_CONFIRMED', Group: 'PP' }),
      ligne({ Id: 'B', Status: 'OPEN', 'Resolution status': 'RESOLVED', Group: 'NCMaj' }),
      ligne({ Id: 'C', Status: 'EN COURS', Group: 'PS' }),
      ligne({ Id: 'D', Status: 'CLOSE', Group: 'Autre' }),
    ]);
    expect(r.lignes.map((l) => [l.id, l.statut, l.classification, l.nature])).toEqual([
      ['A', 'open', '', 'opportunity'],
      ['B', 'closed', 'majeure', 'nonconformity'],
      ['C', 'progress', 'point_sensible', 'nonconformity'],
      ['D', 'closed', '', 'observation'],
    ]);
    expect(r.statutsInconnus).toEqual(['EN COURS']);
  });

  it('une ligne sans identifiant est ignorée, un doublon est une erreur, un onglet vide est signalé', () => {
    const r = lireGaps([ENTETE, ligne({ Id: 'X' }), ligne({ 'Name FR': 'sans identifiant' }), ligne({ Id: 'X' })]);
    expect(r.lignes.map((l) => l.id)).toEqual(['X']);
    expect(r.erreurs).toEqual([{ ligne: 4, message: 'Identifiant en double : X.' }]);
    expect(lireGaps([ENTETE]).vide).toBe(true);
    expect(lireGaps([ENTETE, ligne({})]).vide).toBe(true);
    expect(lireGaps([['Nom'], ['x']]).erreurs[0]!.message).toMatch(/Id/);
  });

  it('nom à défaut : première phrase de la description', () => {
    const [l] = lireGaps([ENTETE, ligne({ Id: 'N', 'Description FR': 'Première phrase. Seconde phrase.' })]).lignes;
    expect(l!.nom).toBe('Première phrase.');
  });
});

describe('règles de lecture', () => {
  it('codes de mesures', () => {
    expect(codeMesureTenacy('ISO-01-22 4.3')).toBe('ISO-4.3');
    expect(codeMesureTenacy('HDS-2.0 EXI12')).toBe('HDS-12');
    expect(codeMesureTenacy('DDA-NES 8.24')).toBe('A-8.24');
    expect(codeMesureTenacy('A.5.9')).toBe('A-5.9');
    expect(codeMesureTenacy('6.1.2')).toBe('ISO-6.1.2');
    expect(codeMesureTenacy('n’importe quoi')).toBeNull();
    expect(codesMesuresTenacy('ISO-01-22 4.3; 4.3, DDA-NES 5.1')).toEqual(['ISO-4.3', 'ISO-4.3', 'A-5.1']);
  });
  it('dates', () => {
    expect(dateTenacy('2026-10-20T00:00:00')).toBe('2026-10-20');
    expect(dateTenacy('05/03/26')).toBe('2026-03-05');
    expect(dateTenacy(46022)).toBe('2025-12-31');
    expect(dateTenacy('31/02/2026')).toBe('');
    expect(dateTenacy('demain')).toBe('');
    expect(dateTenacy(null)).toBe('');
  });
  it('texte et actions', () => {
    expect(texteTenacy('**Gras** et \\- échappé\n  - sous-puce\n* puce')).toBe('Gras et - échappé ; sous-puce\n- puce');
    expect(actionTenacy('Seule action')).toEqual({ action: 'Seule action', taches: ['Seule action'] });
    expect(actionTenacy('Titre :\n- a\n– b')).toEqual({ action: 'Titre', taches: ['a', 'b'] });
    expect(actionTenacy('')).toEqual({ action: '', taches: [] });
  });
});
