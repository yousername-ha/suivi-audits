/* Placement des sous-actions de l'arbre : jamais sur un libellé, un cercle, un titre ou hors du dessin (024-UI-PLUS-02). */
import { RACCOURCIS_PARCOURS, sousActionsDuRaccourci } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import {
  placerEnfants,
  POINTS,
  rectDeEnfant,
  rectsFixes,
  recouvre,
  LARGEUR,
  HAUTEUR,
} from '../src/parcours-iso/geometrie';

describe('arbre du parcours : placement des sous-actions', () => {
  for (const hds of [true, false])
    for (const r of RACCOURCIS_PARCOURS) {
      if (!hds && POINTS[r.id]!.branche === 'hds') continue;
      it(`${r.id} (HDS ${hds ? 'affiché' : 'masqué'}) : espace libre pour chaque sous-action`, () => {
        const enfants = placerEnfants(r.id, hds);
        expect(enfants.map((e) => e.id)).toEqual(sousActionsDuRaccourci(r).map((s) => s.id));
        const fixes = rectsFixes(hds);
        for (const e of enfants) {
          const q = rectDeEnfant(e);
          expect(q.x).toBeGreaterThanOrEqual(0);
          expect(q.x + q.l).toBeLessThanOrEqual(LARGEUR);
          expect(q.y).toBeGreaterThanOrEqual(0);
          expect(q.y + q.h).toBeLessThanOrEqual(HAUTEUR);
          expect(
            fixes.some((f) => recouvre(q, f)),
            `${e.id} recouvre un élément fixe`,
          ).toBe(false);
        }
        // Les sous-actions d'un même raccourci ne se recouvrent pas entre elles.
        for (let i = 0; i < enfants.length; i++)
          for (let j = i + 1; j < enfants.length; j++)
            expect(recouvre(rectDeEnfant(enfants[i]!), rectDeEnfant(enfants[j]!))).toBe(false);
      });
    }
});
