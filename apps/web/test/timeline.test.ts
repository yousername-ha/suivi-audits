/* Timeline des actions : bornes de la période et placement, sans inventer de dates. */
import type { GrcObject } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { calculerFrise } from '../src/grc/Timeline';

const JOUR = 86_400_000;
const action = (id: string, startAt: string | null, dueAt: string | null) =>
  ({ id, name: id, kind: 'action', data: { startAt, dueAt, status: 'todo' } }) as unknown as GrcObject;
const AUJ = Date.parse('2026-10-20T10:00:00Z');

describe('calculerFrise', () => {
  it('place les actions datées du début à l’échéance et met de côté celles sans date', () => {
    const f = calculerFrise(
      [
        action('b', '2026-11-10T08:00:00Z', '2026-12-01T08:00:00Z'),
        action('a', '2026-10-01T08:00:00Z', '2026-10-15T08:00:00Z'),
        action('c', null, null),
        action('d', null, '2026-11-30T08:00:00Z'),
      ],
      AUJ,
    );
    expect(f.placees.map((p) => p.objet.id)).toEqual(['a', 'b', 'd']);
    expect(f.sansDate.map((o) => o.id)).toEqual(['c']);
    // Une action qui n'a qu'une échéance devient une barre d'un jour.
    const d = f.placees.find((p) => p.objet.id === 'd')!;
    expect(d.de).toBe(d.a);
  });
  it('couvre toutes les dates avec une semaine de marge, aujourd’hui compris', () => {
    const f = calculerFrise([action('a', '2026-10-01T00:00:00Z', '2026-10-15T00:00:00Z')], AUJ);
    const premier = Date.parse('2026-10-01T00:00:00Z');
    expect(f.debut).toBe(premier - 7 * JOUR);
    // 1er octobre − 7 jours → 22 octobre (aujourd'hui, 20/10, est dans la période ; la fin est celle de la marge)
    expect(f.debut + (f.jours - 1) * JOUR).toBeGreaterThanOrEqual(Date.parse('2026-10-22T00:00:00Z'));
  });
  it('sans aucune action, la période entoure aujourd’hui', () => {
    const f = calculerFrise([], AUJ);
    expect(f.placees).toEqual([]);
    expect(f.jours).toBe(15);
  });
  it('borne la période à deux ans', () => {
    const f = calculerFrise([action('a', '2020-01-01T00:00:00Z', '2030-01-01T00:00:00Z')], AUJ);
    expect(f.jours).toBeLessThanOrEqual(731);
  });
});
