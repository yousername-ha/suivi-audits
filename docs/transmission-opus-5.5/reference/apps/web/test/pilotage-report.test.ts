import { expect, it } from 'vitest';
import { pilotageReport } from '../src/pilotage/report';

it('produit un plan imprimable avec les décisions exactes et protège les contenus saisis', () => {
  const html = pilotageReport({
    kind: 'continuity_plan',
    generatedAt: '2026-10-10',
    note: 'Export borné',
    objects: [
      {
        id: 'P1',
        name: '<script>alert(1)</script>',
        version: 3,
        data: { planType: 'pra', procedures: 'Restaurer puis vérifier', refs: ['document:D1:2'] },
      },
    ],
    decisions: [
      {
        source_ref: 'object:P1',
        operation: 'approval',
        result: 'accepted',
        source_version: 2,
        performed_on: '2026-10-09',
        created_by: 'Direction',
        note: '<img src=x onerror=alert(1)>',
        refs: ['document:D1:1'],
      },
    ],
  });
  expect(html).toContain('PRA — reprise informatique');
  expect(html).toContain('Restaurer puis vérifier');
  expect(html).toContain('Version 2');
  expect(html).toContain('document:D1:1');
  expect(html).toContain('document:D1:2');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('<img');
});
