/* Applicabilité (lot U2) : la déclaration d'applicabilité historique (`items` + `dda`) se consulte et se modifie
   depuis le Pilotage, sans copie : seule l'entrée `dda[<exigence>]` est réécrite, champs inconnus conservés. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;
const base = `/api/grc/${DEFAULT_SMSI}/pilotage/legacy/dda`;
const clean = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([k]) => !['legacy', 'sourceSha', 'ownerLabel'].includes(k)));

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'dda_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'dda_ro', 'ro'));
});
afterAll(() => t.close());

describe('déclaration d’applicabilité historique dans le Pilotage', () => {
  it('liste les exigences ISO 27001, Annexe A et HDS de l’outil de suivi', async () => {
    const r = await a.get(base + '?search=A-5.1');
    expect(r.statusCode, r.body).toBe(200);
    const fiche = r.json().items.find((x: { id: string }) => x.id === 'legacy:dda:A-5.1');
    expect(fiche).toMatchObject({ kind: 'soa', data: { applicable: true } });
    expect(fiche.name).toMatch(/^A-5\.1 — /);
    expect((await a.get(base)).json().total).toBeGreaterThan(100);
  });

  it('modifie seulement dda[A-5.1], conserve les champs inconnus et les autres exigences', async () => {
    // Champ inconnu de l'outil historique, à conserver.
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      st.data.dda = {
        ...((st.data.dda as object) ?? {}),
        'A-5.1': { app: 'oui', level: 'Partiel', obj: 'OBJ-FICTIF' },
      };
      await t.svc.legacy.nativeWrite(c, st.data, { username: 'test' } as never, st.version);
    }, 'test');
    const fiche = (await a.get(base + '/A-5.1')).json();
    expect(fiche.data.level).toBe('Partiel');
    const r = await a.put(
      base + '/A-5.1',
      {
        name: fiche.name,
        sourceSha: fiche.data.sourceSha,
        data: { ...clean(fiche.data), applicable: false, reason: 'Hors du périmètre fictif', level: 'Total' },
      },
      { 'if-match': `"${fiche.version}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
    const st = (await t.svc.legacy.recompose())!;
    const dda = st.data.dda as Record<string, Record<string, unknown>>;
    expect(dda['A-5.1']).toMatchObject({
      app: 'non',
      just: 'Hors du périmètre fictif',
      level: 'Total',
      obj: 'OBJ-FICTIF',
    });
    expect(dda['A-5.1']).not.toHaveProperty('title');
    expect(dda['A-5.1']).not.toHaveProperty('pilotage');
    // L'intitulé de l'exigence n'est pas modifiable depuis la DdA.
    const items = st.data.items as { id: string; title: string }[];
    expect(items.find((i) => i.id === 'A-5.1')!.title).not.toContain('—');
    // Une version périmée est refusée.
    expect(
      (
        await a.put(
          base + '/A-5.1',
          { name: fiche.name, sourceSha: fiche.data.sourceSha, data: clean(fiche.data) },
          { 'if-match': `"${fiche.version}"` },
        )
      ).statusCode,
    ).toBe(412);
  });

  it('enregistrer la fiche d’une mesure jamais examinée ne la déclare pas applicable (BUG-040)', async () => {
    const fiche = (await a.get(base + '/A-5.4')).json();
    expect(fiche.data.examinee).toBe(false);
    const enregistrer = (data: Record<string, unknown>) =>
      a.put(
        base + '/A-5.4',
        { name: fiche.name, sourceSha: fiche.data.sourceSha, data },
        { 'if-match': `"${fiche.version}"` },
      );
    const r = await enregistrer(clean(fiche.data));
    expect(r.statusCode, r.body).toBe(200);
    const dda = (await t.svc.legacy.recompose())!.data.dda as Record<string, Record<string, unknown>> | undefined;
    expect(dda?.['A-5.4']?.app ?? '').toBe('');
    // Le niveau n'est pas non plus accepté sans décision d'applicabilité (BUG-065).
    const sansDecision = await a.put(
      base + '/A-5.4',
      {
        name: fiche.name,
        sourceSha: (await a.get(base + '/A-5.4')).json().data.sourceSha,
        data: { ...clean(fiche.data), level: 'Total' },
      },
      { 'if-match': `"${(await a.get(base + '/A-5.4')).json().version}"` },
    );
    expect(sansDecision.statusCode, sansDecision.body).toBe(422);
    // Décider : cocher « Applicabilité examinée » (applicable) écrit « oui ».
    const frais = (await a.get(base + '/A-5.4')).json();
    const decide = await a.put(
      base + '/A-5.4',
      {
        name: frais.name,
        sourceSha: frais.data.sourceSha,
        data: { ...clean(frais.data), examinee: true, applicable: true },
      },
      { 'if-match': `"${frais.version}"` },
    );
    expect(decide.statusCode, decide.body).toBe(200);
    expect(((await t.svc.legacy.recompose())!.data.dda as Record<string, Record<string, unknown>>)['A-5.4']!.app).toBe(
      'oui',
    );
  });

  it('lecture seule pour un lecteur ; écriture refusée', async () => {
    const fiche = (await ro.get(base + '/A-5.2')).json();
    expect(fiche.kind).toBe('soa');
    const r = await ro.put(
      base + '/A-5.2',
      { name: fiche.name, sourceSha: fiche.data.sourceSha, data: clean(fiche.data) },
      { 'if-match': `"${fiche.version}"` },
    );
    expect(r.statusCode).toBe(403);
  });
});
