/* Objectifs et indicateurs (refonte Neon, lot 3) : la flèche décrit la variation numérique, l'état la comparaison à la
   cible selon son opérateur. Une baisse vers un maximum reste « Atteint » ; une hausse sous un minimum reste « Non
   atteint ». Données fictives de l'outil de suivi. */
import { describe, expect, it } from 'vitest';
import { objectifsPilotage } from '@suivi/shared';
import {
  compterParEtat,
  FILTRES_ETAT,
  jour,
  LIBELLES_ETAT,
  pireEtat,
  sensTendance,
} from '../src/pilotage/objectifs-presentation';

const etat = (indicateurs: Record<string, unknown>[]) => ({
  objectives: [{ id: 'OBJ1', name: 'Objectif fictif', due: '2027-06-30', owner: 'Mon organisation', processes: [] }],
  indicators: indicateurs.map((i, n) => ({ id: `IND${n + 1}`, name: `Indicateur ${n + 1}`, obj: 'OBJ1', ...i })),
});
const indicateurs = (donnees: ReturnType<typeof etat>) => objectifsPilotage(donnees)[0]!.indicateurs;
const mesures = (...v: number[]) => v.map((x, i) => ({ date: `2026-0${i + 1}-15`, v: x }));

describe('flèche et état sont deux lectures distinctes', () => {
  it('une baisse vers un maximum (≤) est une flèche descendante, mais l’indicateur reste atteint', () => {
    const [i] = indicateurs(etat([{ dir: '≤', target: 5, values: mesures(8, 3) }]));
    expect(sensTendance(i!.tendance)).toBe('baisse');
    expect(i!.etat).toBe('ok');
    expect(LIBELLES_ETAT[i!.etat]).toBe('Atteint');
  });

  it('une hausse sous un minimum (≥) est une flèche montante, mais l’indicateur reste non atteint', () => {
    const [i] = indicateurs(etat([{ dir: '≥', target: 0.9, values: mesures(0.7, 0.85) }]));
    expect(sensTendance(i!.tendance)).toBe('hausse');
    expect(i!.etat).toBe('ko');
  });

  it('une baisse sous un minimum est non atteinte ; une valeur stable garde une flèche neutre', () => {
    const [baisse, stable] = indicateurs(
      etat([
        { dir: '≥', target: 0.9, values: mesures(0.95, 0.85) },
        { dir: '≤', target: 10, values: mesures(4, 4) },
      ]),
    );
    expect([sensTendance(baisse!.tendance), baisse!.etat]).toEqual(['baisse', 'ko']);
    expect([sensTendance(stable!.tendance), stable!.etat]).toEqual(['stable', 'ok']);
  });

  it('sans deux mesures, aucune flèche n’est ajoutée ; sans cible, l’état est « Cible à définir »', () => {
    const [une, sansCible] = indicateurs(
      etat([
        { dir: '≤', target: 5, values: mesures(3) },
        { dir: '', target: '', values: mesures(1, 2) },
      ]),
    );
    expect(sensTendance(une!.tendance)).toBeNull();
    expect(sansCible!.etat).toBe('undef');
  });
});

describe('regroupements', () => {
  it('l’état d’un ensemble est le plus défavorable de ses indicateurs', () => {
    expect(pireEtat([])).toBeUndefined();
    expect(pireEtat([{ etat: 'ok' }, { etat: 'na' }])).toBe('na');
    expect(pireEtat([{ etat: 'na' }, { etat: 'undef' }, { etat: 'ok' }])).toBe('undef');
    expect(pireEtat([{ etat: 'undef' }, { etat: 'ko' }])).toBe('ko');
  });

  it('compteurs des raccourcis de filtre : un par état, « Tous » pour l’ensemble', () => {
    const c = compterParEtat([{ etat: 'ok' }, { etat: 'ko' }, { etat: 'ko' }, { etat: 'na' }]);
    expect(c).toEqual({ all: 4, ok: 1, ko: 2, na: 1, undef: 0 });
    expect(FILTRES_ETAT.map(([cle]) => cle)).toEqual(['all', 'ok', 'ko', 'na', 'undef']);
  });

  it('dates affichées au format français, tiret si absente', () => {
    expect(jour('2026-11-14')).toBe('14/11/2026');
    expect(jour('')).toBe('–');
  });
});
