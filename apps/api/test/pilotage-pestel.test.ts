/* PESTEL (ISO 9001:2015, 4.1) : regroupement des enjeux externes existants par facteur de la nomenclature ; les enjeux
   internes restent hors PESTEL. Aucun nouvel objet : le facteur est rangé dans la fiche de périmètre. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PESTEL_PAR_DEFAUT } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;
const url = `/api/grc/${DEFAULT_SMSI}/pilotage/pestel`;
const refDe = (
  vue: { parFacteur: { enjeux: { ref: string; label: string }[] }[]; nonClasses: { ref: string; label: string }[] },
  label: string,
) => [...vue.nonClasses, ...vue.parFacteur.flatMap((f) => f.enjeux)].find((e) => e.label === label)!.ref;

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'pst_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'pst_ro', 'ro'));
  await t.svc.db.tx(async (c) => {
    await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
    const st = (await t.svc.legacy.recompose(c))!;
    st.data.objectives = [
      {
        id: 'OBJ1',
        name: 'Objectif fictif',
        processes: [],
        enjeux: ['Menace cyber : attaques ciblées', 'Évolution de la législation fictive', 'Compétences internes'],
      },
    ];
    await t.svc.legacy.nativeWrite(c, st.data, { username: 'test' } as never, st.version);
  }, 'test');
});
afterAll(() => t.close());

describe('PESTEL des enjeux externes', () => {
  it('propose les six facteurs par défaut, classe les enjeux externes à part des internes', async () => {
    const r = await a.get(url);
    expect(r.statusCode, r.body).toBe(200);
    const vue = r.json();
    expect(vue.facteurs.map((f: { id: string }) => f.id)).toEqual(PESTEL_PAR_DEFAUT.map((f) => f.id));
    expect(vue.nonClasses.map((e: { label: string }) => e.label).sort()).toEqual(
      ['Menace cyber', 'Évolution de la législation fictive'].sort(),
    );
    expect(vue.internes.map((e: { label: string }) => e.label)).toEqual(['Compétences internes']);
    expect((await ro.get(url)).statusCode).toBe(200);
  });
  it('affecte un facteur, sans créer d’objet, et le retire', async () => {
    const vue = (await a.get(url)).json();
    const menace = refDe(vue, 'Menace cyber');
    const avant = (await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM grc_objects'))!.n;
    expect((await ro.put(url, { assignments: { [menace]: 'technologique' } })).statusCode).toBe(403);
    const r = await a.put(url, { assignments: { [menace]: 'technologique' } });
    expect(r.statusCode, r.body).toBe(200);
    const apres = (await a.get(url)).json();
    expect(
      apres.parFacteur.find((f: { facteur: { id: string } }) => f.facteur.id === 'technologique').enjeux,
    ).toHaveLength(1);
    expect(apres.nonClasses.map((e: { label: string }) => e.label)).toEqual(['Évolution de la législation fictive']);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM grc_objects'))!.n).toBe(avant);
    expect((await a.put(url, { assignments: { [menace]: '' } })).statusCode).toBe(200);
    expect((await a.get(url)).json().nonClasses).toHaveLength(2);
  });
  it('refuse un facteur inconnu, un enjeu interne et un enjeu inexistant', async () => {
    const vue = (await a.get(url)).json();
    const menace = refDe(vue, 'Menace cyber');
    expect((await a.put(url, { assignments: { [menace]: 'inconnu' } })).statusCode).toBe(422);
    expect((await a.put(url, { assignments: { [vue.internes[0].ref]: 'social' } })).statusCode).toBe(422);
    expect((await a.put(url, { assignments: { 'issue:zzzz': 'social' } })).statusCode).toBe(422);
    expect((await a.put(url, { assignments: 'x' })).statusCode).toBe(422);
  });
  it('reste cohérent quand un facteur disparaît de la nomenclature : l’enjeu redevient non classé', async () => {
    const vue = (await a.get(url)).json();
    const menace = refDe(vue, 'Menace cyber');
    await a.put(url, { assignments: { [menace]: 'legal' } });
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      (st.data.scope as Record<string, unknown>).issueFactors = { [menace]: 'facteur_supprime' };
      await t.svc.legacy.nativeWrite(c, st.data, { username: 'test' } as never, st.version);
    }, 'test');
    expect((await a.get(url)).json().nonClasses.map((e: { label: string }) => e.label)).toContain('Menace cyber');
  });
});
