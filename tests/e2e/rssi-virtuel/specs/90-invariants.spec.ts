/* Invariants du SMSI sur l'état laissé par le parcours du RSSI (et par l'agent, s'il a travaillé sur la même pile) : une
   violation bloquante fait échouer le test, un avertissement est joint au rapport comme annotation. */
import { expect, test } from '@playwright/test';
import { sessionAdmin } from '../../helpers';
import { lireInstantane, REGLES } from '../invariants';

for (const [id, r] of Object.entries(REGLES)) {
  test(`${id} — ${r.titre} (${r.source})`, async ({ browser }) => {
    const { state } = await sessionAdmin(browser);
    const ctx = await browser.newContext({ storageState: state });
    try {
      const violations = r.regle(await lireInstantane(ctx.request));
      for (const v of violations.filter((x) => x.gravite === 'avertissement'))
        test.info().annotations.push({ type: 'avertissement', description: `${v.regle} : ${v.detail}` });
      expect(
        violations.filter((x) => x.gravite === 'bloquant').map((x) => x.detail),
        `${id} : violations bloquantes`,
      ).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}

test('chaque modification de la DdA faite par le RSSI figure au journal d’audit', async ({ browser }) => {
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  try {
    const r = await ctx.request.get('/api/admin/audit?limit=500');
    expect(r.ok()).toBe(true);
    const journal = (await r.json()) as { username: string; action: string; target: string }[];
    const tracees = new Set(journal.filter((e) => e.action === 'dda.updated').map((e) => e.target));
    const { dda } = await lireInstantane(ctx.request);
    const modifiees = Object.entries(dda.A.dda)
      .filter(([, l]) => l.app || l.level || l.just)
      .map(([id]) => `legacy:dda:${id}`);
    expect(modifiees.length).toBeGreaterThan(0);
    expect(modifiees.filter((m) => !tracees.has(m))).toEqual([]);
    expect(journal.filter((e) => e.action === 'dda.updated').every((e) => e.username === 'rssi')).toBe(true);
  } finally {
    await ctx.close();
  }
});
