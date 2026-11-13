/* Le rapport de pilotage remis au comité n'affiche aucun code anglais ni horodatage technique (BUG-059). */
import { describe, expect, it } from 'vitest';
import { committeeReport } from '../src/grc/report';

describe('rapport de pilotage et audit', () => {
  it('traduit acceptabilité, traitement et état, et formate la date', () => {
    const html = committeeReport({
      smsi: { name: 'Périmètre fictif', scope: 'S' },
      policy: { version: 1 },
      sections: {
        risks: {
          total: 1,
          items: [
            {
              name: 'Risque fictif',
              data: { code: 'R-01', strategy: 'reduce', methodVersion: 1, reviewAt: '2027-03-01' },
              method: { name: 'Méthode' },
              assessment: {
                revision: 1,
                decision: 'draft',
                created_by: 'rssi',
                created_at: '2026-11-12T20:10:38.070636+00:00',
                result: { gross: { label: 'Élevé' }, residual: { label: 'Modéré', acceptability: 'conditional' } },
              },
            },
          ],
        },
      },
    });
    expect(html).toContain('Acceptable sous condition');
    expect(html).toContain('Réduire');
    expect(html).toContain('Brouillon');
    expect(html).toContain('12/11/2026 20:10');
    for (const code of ['conditional', 'unacceptable', '>reduce<', '>draft<', '+00:00'])
      expect(html).not.toContain(code);
  });
});
