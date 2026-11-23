/* Préparation de la revue de direction (7.6.1, bug relevé par le RSSI le 23/11/2026) : la page rangeait les entrées par les
   identifiants de l'ISO 9001 (c1 à c7) alors que l'API rend ceux de l'ISO/IEC 27001:2022 (a à g, d1 à d4) ; six entrées
   sur dix n'apparaissaient pas. Chaque entrée se range désormais par la lettre de son point, et aucune n'est masquée. */
import { ENTREES_REVUE } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { TEMPS, tempsDe, titreCourt } from '../src/pilotage/PreparationRevue';

describe('revue de direction : trois temps de lecture', () => {
  it('les dix entrées de 9.3.2 se rangent toutes, dans l’ordre de la norme', () => {
    expect(ENTREES_REVUE.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd1', 'd2', 'd3', 'd4', 'e', 'f', 'g']);
    const ranges = TEMPS.map((_, n) => ENTREES_REVUE.filter((e) => tempsDe(e.id) === n).map((e) => e.id));
    expect(ranges).toEqual([
      ['a', 'b', 'c'],
      ['d1', 'd2', 'd3', 'd4'],
      ['e', 'f', 'g'],
    ]);
    expect(ranges.flat()).toHaveLength(ENTREES_REVUE.length);
  });
  it('une entrée inconnue reste visible, dans le dernier temps', () => {
    expect(tempsDe('z')).toBe(TEMPS.length - 1);
  });
  it('dans la colonne « Performance de sécurité », le titre ne répète pas le nom de la colonne', () => {
    expect(titreCourt('Performance de sécurité : résultats d’audit')).toBe('Résultats d’audit');
    expect(titreCourt('Retours des parties intéressées')).toBe('Retours des parties intéressées');
  });
});
