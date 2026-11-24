/* Fiche du fournisseur : section « Groupes de machines maintenus » (maquette validée par le RSSI le 23/11/2026). */
import { describe, expect, it } from 'vitest';
import { lienParcDuGroupe, libelleMachinesLues, urlGroupesDuFournisseur } from '../src/pilotage/GroupesDuFournisseur';

describe('groupes de machines du fournisseur', () => {
  it('appelle la route du lot GRP-MACHINES et mène au parc filtré sur le groupe', () => {
    expect(urlGroupesDuFournisseur('SUP-001')).toBe('/api/vulnerabilites/fournisseurs/SUP-001/groupes');
    expect(urlGroupesDuFournisseur('a b')).toBe('/api/vulnerabilites/fournisseurs/a%20b/groupes');
    expect(lienParcDuGroupe('6f1c0f3e-0000-4000-8000-000000000001')).toBe(
      '/vulnerabilites/machines?groupe=6f1c0f3e-0000-4000-8000-000000000001',
    );
  });

  it('dit le nombre de machines lues et signale, sans nombre, celles hors de la lecture', () => {
    expect(libelleMachinesLues(0, false)).toBe('0 machine');
    expect(libelleMachinesLues(1, false)).toBe('1 machine');
    expect(libelleMachinesLues(12, false)).toBe('12 machines');
    expect(libelleMachinesLues(3, true)).toBe('3 machines (d’autres hors de votre lecture)');
  });
});
