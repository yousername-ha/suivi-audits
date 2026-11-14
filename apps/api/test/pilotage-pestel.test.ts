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

describe('PESTEL des fiches saisies à l’écran (BUG-053)', () => {
  it('reprend les menaces et opportunités des SWOT et les lignes des contextes, classables, dans leur périmètre', async () => {
    const creer = async (smsi: string, kind: string, name: string, data: Record<string, unknown>) => {
      const r = await a.post(`/api/grc/${smsi}/objects`, { kind, name, data });
      expect(r.statusCode, r.body).toBe(200);
    };
    const sous = (
      await a.post('/api/grc/smsis', { name: 'Sous-périmètre PESTEL', scope: 'x', timezone: 'Europe/Paris' })
    ).json().id as string;
    await creer(DEFAULT_SMSI, 'swot', 'SWOT fictif', {
      threats: 'Menace fictive PESTEL\nAutre menace fictive',
      opportunities: 'Opportunité fictive PESTEL',
      strengths: 'Force interne fictive',
    });
    await creer(DEFAULT_SMSI, 'context', 'Contexte fictif', {
      issues: 'Externes : obligation réglementaire fictive\nInternes : compétence fictive',
    });
    await creer(sous, 'swot', 'SWOT du sous-périmètre', { threats: 'Menace du sous-périmètre fictive' });
    const vue = (await a.get(url)).json();
    const externes = [...vue.nonClasses, ...vue.parFacteur.flatMap((f: { enjeux: unknown[] }) => f.enjeux)] as {
      ref: string;
      label: string;
    }[];
    const libelles = externes.map((e) => e.label);
    expect(libelles).toEqual(
      expect.arrayContaining([
        'Menace fictive PESTEL',
        'Autre menace fictive',
        'Opportunité fictive PESTEL',
        'obligation réglementaire fictive',
      ]),
    );
    expect(libelles).not.toContain('Force interne fictive');
    expect(libelles).not.toContain('Menace du sous-périmètre fictive');
    expect(vue.internes.map((e: { label: string }) => e.label)).toContain('compétence fictive');
    // Classement d'une menace saisie à l'écran, conservé et propre au périmètre.
    const menace = externes.find((e) => e.label === 'Menace fictive PESTEL')!;
    const facteur = vue.facteurs[0].id as string;
    const put = await a.put(url, { assignments: { [menace.ref]: facteur } });
    expect(put.statusCode, put.body).toBe(200);
    const apres = (await a.get(url)).json();
    expect(apres.parFacteur[0].enjeux.map((e: { label: string }) => e.label)).toContain('Menace fictive PESTEL');
    const enfant = (await a.get(`/api/grc/${sous}/pilotage/pestel`)).json();
    expect(JSON.stringify(enfant)).toContain('Menace du sous-périmètre fictive');
    expect(JSON.stringify(enfant)).not.toContain('Menace fictive PESTEL');
  });
});
