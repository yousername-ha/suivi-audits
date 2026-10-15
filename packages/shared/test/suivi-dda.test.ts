/* Déclaration d'applicabilité : indicateurs, incohérences et filtres de l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  DdaModification,
  codeMesure,
  ecartsOuvertsMesure,
  filtrerMesures,
  incoherente,
  lienDocument,
  lireDda,
  lireEcartDda,
  lireMesureDda,
  statsDda,
} from '../src/index.js';

const mesures = [
  { id: 'A-5.1', ref: 'A', num: '5.1', title: 'Politiques' },
  { id: 'A-5.2', ref: 'A', num: '5.2', title: 'Rôles' },
  { id: 'A-5.3', ref: 'A', num: '5.3', title: 'Séparation' },
  { id: 'A-5.4', ref: 'A', num: '5.4', title: 'Direction' },
  { id: 'HDS-1', ref: 'HDS', num: '1', title: 'HDS' },
].map((m) => lireMesureDda(m)!);
const dda = {
  'A-5.1': lireDda({ app: 'oui', level: 'Total' }),
  'A-5.2': lireDda({ app: 'oui', level: 'Partiel' }),
  'A-5.3': lireDda({ app: 'non', just: 'Hors périmètre' }),
};
const ecarts = [
  { id: 'NC-1', type: 'NC mineure', status: 'Ouvert', source: 'Audit', items: ['A-5.1'] },
  { id: 'VE-1', type: 'NC', status: 'Ouvert', source: 'Veille', items: ['A-5.2'] },
  { id: 'OBS-1', type: 'PS', status: 'Clos', source: 'Audit', items: ['A-5.2'] },
].map((e) => lireEcartDda(e)!);

describe('indicateurs', () => {
  it('mesures exclues hors du total ; non renseignées comptées à part ; pourcentage en mise en œuvre totale', () => {
    const s = statsDda(mesures, dda, 'A');
    expect(s).toEqual({ total: 4, app: 3, na: 1, c: { Total: 1, Partiel: 1, Insuffisant: 0, '': 1 }, pct: 33 });
    expect(statsDda(mesures, dda, 'HDS')).toMatchObject({ total: 1, app: 1, pct: 0 });
    expect(statsDda([], {}, 'ISO').pct).toBe(0);
  });
  it('codes de mesure', () => {
    expect(codeMesure({ ref: 'A', num: '5.1' })).toBe('A.5.1');
    expect(codeMesure({ ref: 'HDS', num: '3' })).toBe('HDS 3');
    expect(codeMesure({ ref: 'ISO', num: '6.1' })).toBe('6.1');
  });
});

describe('incohérences et filtres', () => {
  it('« Total » avec écart ouvert NC ou PS hors veille', () => {
    expect(incoherente(mesures[0]!, dda, ecarts)).toBe(true);
    expect(incoherente(mesures[1]!, dda, ecarts)).toBe(false); // niveau partiel, et écart de veille
    expect(ecartsOuvertsMesure('A-5.2', ecarts).map((e) => e.id)).toEqual(['VE-1']);
  });
  it('filtres : niveau, non renseignées, exclues, incohérentes', () => {
    const ids = (f: Parameters<typeof filtrerMesures>[4]) =>
      filtrerMesures(mesures, dda, ecarts, 'A', f).map((m) => m.id);
    expect(ids('all')).toEqual(['A-5.1', 'A-5.2', 'A-5.3', 'A-5.4']);
    expect(ids('Total')).toEqual(['A-5.1']);
    expect(ids('Partiel')).toEqual(['A-5.2']);
    expect(ids('none')).toEqual(['A-5.4']);
    expect(ids('na')).toEqual(['A-5.3']);
    expect(ids('inc')).toEqual(['A-5.1']);
  });
});

describe('document et validation', () => {
  it('liens de documents', () => {
    expect(lienDocument('https://exemple.test/a.pdf')).toBe('https://exemple.test/a.pdf');
    expect(lienDocument('\\\\serveur\\partage\\a.pdf')).toBe('file://serveur/partage/a.pdf');
    expect(lienDocument('C:\\docs\\a.pdf')).toBe('file:///C:/docs/a.pdf');
    expect(lienDocument('www.exemple.test')).toBe('https://www.exemple.test');
    expect(lienDocument('  ')).toBe('');
  });
  it('refuse une applicabilité ou un niveau inconnus et les champs inattendus', () => {
    expect(DdaModification.safeParse({ app: 'peut-être' }).success).toBe(false);
    expect(DdaModification.safeParse({ level: 'Faible' }).success).toBe(false);
    expect(DdaModification.safeParse({ inconnu: 1 }).success).toBe(false);
    expect(DdaModification.safeParse({ app: 'oui', level: 'Total', url: 'https://x.test' }).success).toBe(true);
  });
});
