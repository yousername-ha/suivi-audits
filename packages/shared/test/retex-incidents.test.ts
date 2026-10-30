/* RETEX d'un incident : lecture et tri de la chronologie, identifiants, durées, points de la courbe (gravité reportée)
   et indicateurs (durée totale, délais de confinement et de rétablissement), validation de la saisie. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  EvenementRetexModification,
  EvenementRetexSaisie,
  chronologieRetex,
  dateHeureRetex,
  dureeRetex,
  identifiantEvenementRetex,
  indicateursRetex,
  lireEvenementsRetex,
  lireIncident,
  minutesRetex,
} from '../src/index.js';

const brut = [
  { id: 'EV-003', ts: '2026-10-12T10:30', type: 'Confinement', titre: 'Isolement du poste', gravite: '' },
  { id: 'EV-001', ts: '2026-10-12T08:45', type: 'Détection', titre: 'Alerte EDR', gravite: 'Modérée', inconnu: 1 },
  { id: 'EV-002', ts: '2026-10-12T09:00', type: 'Analyse', titre: 'Analyse SOC', gravite: 'Élevée' },
  { id: 'EV-004', ts: '2026-10-14T11:45', type: 'Rétablissement', titre: 'Remise en service', gravite: 'Faible' },
  { id: 'EV-005', ts: '2026-02-31T10:00', type: 'Autre', titre: 'Date inexistante' },
  { id: '', ts: '2026-10-12T08:00', type: 'Autre', titre: 'Sans identifiant' },
  'texte',
];

describe('RETEX : chronologie', () => {
  it('lit, filtre et trie les événements ; type et gravité inconnus ramenés aux valeurs par défaut', () => {
    const l = lireEvenementsRetex([...brut, { id: 'EV-009', ts: '2026-10-12T08:45', type: 'X', gravite: 'Y' }]);
    expect(l.map((e) => e.id)).toEqual(['EV-001', 'EV-009', 'EV-002', 'EV-003', 'EV-004']);
    expect(l[1]).toMatchObject({ type: 'Autre', gravite: '', titre: '' });
    expect(lireEvenementsRetex(null)).toEqual([]);
  });
  it('rattache la chronologie à l’incident lu', () => {
    expect(lireIncident({ id: 'INC-1', timeline: brut })!.timeline).toHaveLength(4);
    expect(lireIncident({ id: 'INC-2' })!.timeline).toEqual([]);
  });
  it('attribue un identifiant jamais réutilisé', () => {
    expect(identifiantEvenementRetex([])).toBe('EV-001');
    expect(identifiantEvenementRetex(['EV-001', 'EV-007', 'autre'])).toBe('EV-008');
    expect(identifiantEvenementRetex(['EV-001'], 4)).toBe('EV-005');
    expect(identifiantEvenementRetex(['EV-006'], 4)).toBe('EV-007');
  });
  it('valide les horodatages sans fuseau et formate durées et dates', () => {
    expect(minutesRetex('2026-10-12T09:00') - minutesRetex('2026-10-12T08:45')).toBe(15);
    expect(minutesRetex('2026-02-29T10:00')).toBeNaN();
    expect(minutesRetex('2026-10-12 09:00')).toBeNaN();
    expect([0, 45, 125, 1140, 1440, 1500, 3000].map(dureeRetex)).toEqual([
      '0 min',
      '45 min',
      '2 h 05',
      '19 h',
      '1 j',
      '1 j 1 h',
      '2 j 2 h',
    ]);
    expect(dateHeureRetex('2026-10-12T08:45')).toBe('12/10/2026 08:45');
  });
  it('calcule les points de la courbe : écarts, T+ et gravité reportée', () => {
    const p = chronologieRetex(lireEvenementsRetex(brut));
    expect(p.map((x) => [x.rang, x.niveau, x.niveauReporte, x.depuisPrecedent, x.depuisDebut])).toEqual([
      [0, 2, false, null, 0],
      [1, 3, false, 15, 15],
      [2, 3, true, 90, 105],
      [3, 1, false, 2955, 3060],
    ]);
    expect(chronologieRetex(lireEvenementsRetex([{ id: 'EV-1', ts: '2026-10-12T08:00' }]))[0]!.niveau).toBe(1);
  });
  it('calcule les indicateurs depuis la détection', () => {
    expect(indicateursRetex(lireEvenementsRetex(brut))).toEqual({
      evenements: 4,
      dureeTotale: 3060,
      avantConfinement: 105,
      avantRetablissement: 3060,
      graviteMax: 'Élevée',
    });
    expect(indicateursRetex([])).toEqual({
      evenements: 0,
      dureeTotale: null,
      avantConfinement: null,
      avantRetablissement: null,
      graviteMax: '',
    });
  });
  it('valide la saisie et la modification d’un événement', () => {
    expect(EvenementRetexSaisie.safeParse({ ts: '2026-10-12T08:45', type: 'Détection', titre: 'A' }).success).toBe(
      true,
    );
    expect(EvenementRetexSaisie.safeParse({ ts: '2026-10-12T08:45', type: 'Détection', titre: ' ' }).success).toBe(
      false,
    );
    expect(EvenementRetexSaisie.safeParse({ ts: '2026-13-12T08:45', type: 'Détection', titre: 'A' }).success).toBe(
      false,
    );
    expect(
      EvenementRetexSaisie.safeParse({ ts: '2026-10-12T08:45', type: 'Détection', titre: 'A', id: 'EV-9' }).success,
    ).toBe(false);
    expect(EvenementRetexModification.safeParse({ gravite: '' }).success).toBe(true);
    expect(EvenementRetexModification.safeParse({ gravite: 'Extrême' }).success).toBe(false);
  });
});
