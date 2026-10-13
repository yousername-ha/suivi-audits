/* Entrées de la revue de direction (ISO 9.3.2) : faits tirés des données, jamais interprétés ; l'adéquation des ressources
   reste à saisir. Données fictives. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENTREES_REVUE } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;
const racine = `/api/grc/${DEFAULT_SMSI}`;
const entrees = async (agent = a) =>
  (await agent.get(`${racine}/pilotage/revue/entrees`)).json() as {
    precedente: { id: string; date: string } | null;
    entrees: { id: string; faits: string[]; aSaisir: boolean }[];
  };
const faitsDe = (r: Awaited<ReturnType<typeof entrees>>, id: string) =>
  r.entrees.find((e) => e.id === id)!.faits.join(' | ');

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'rev_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'rev_ro', 'ro'));
});
afterAll(() => t.close());

describe('entrées de la revue de direction', () => {
  it('annonce l’absence de donnée plutôt que de l’inventer', async () => {
    const r = await entrees();
    expect(r.entrees.map((e) => e.id)).toEqual(ENTREES_REVUE.map((e) => e.id));
    expect(r.precedente).toBeNull();
    expect(faitsDe(r, 'a')).toMatch(/Aucune revue de direction précédente/);
    expect(faitsDe(r, 'c1')).toMatch(/Aucun indicateur de satisfaction/);
    expect(faitsDe(r, 'c3')).toMatch(/Aucun processus relié/);
    expect(r.entrees.find((e) => e.id === 'd')!.aSaisir).toBe(true);
    expect(r.entrees.filter((e) => e.aSaisir)).toHaveLength(1);
  });
  it('prépare des faits chiffrés à partir de l’état, des actions de la revue précédente et des registres', async () => {
    const action = (
      await a.post(`${racine}/objects`, {
        kind: 'action',
        name: 'Action décidée en revue',
        data: {
          description: '',
          status: 'todo',
          ownerId: null,
          startAt: null,
          dueAt: '2020-01-01T09:00:00Z',
          priority: 'normal',
          category: 'action',
          justification: '',
          reminderDays: 7,
          dependencies: [],
        },
      })
    ).json();
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      Object.assign(st.data, {
        reviews: [{ id: 'R1', title: 'Revue fictive', date: '2026-01-15' }],
        interested: [
          { id: 'P1', name: 'Client fictif', addressed: 'Oui', reviewed: '2026-09-01' },
          { id: 'P2', name: 'Autorité fictive' },
        ],
        processes: [{ id: 'PR1', name: 'Accueil' }],
        objectives: [{ id: 'OBJ1', name: 'Satisfaire', processes: ['PR1'] }],
        indicators: [
          {
            id: 'IND1',
            obj: 'OBJ1',
            name: 'Satisfaction',
            category: 'satisfaction',
            dir: '≥',
            target: 0.8,
            values: [{ date: '2026-06-01', v: 0.9 }],
          },
          { id: 'IND2', obj: 'OBJ1', name: 'Délai', dir: '≤', target: 5, values: [{ date: '2026-06-01', v: 9 }] },
          { id: 'IND3', obj: 'OBJ1', name: 'Non mesuré', dir: '≤', target: 5, values: [] },
        ],
        findings: [
          {
            id: 'F1',
            text: 'Écart ouvert en retard',
            status: 'Ouvert',
            due: '2020-02-01',
            type: 'NC min',
            source: 'Interne',
          },
          { id: 'F2', text: 'Écart clos', status: 'Clos', type: 'NC min', source: 'Interne' },
          { id: 'F3', text: 'Observation', status: 'Ouvert', type: 'Observation', source: 'Interne' },
        ],
      });
      await t.svc.legacy.legacyWrite(c, st.data, { username: 'test' } as never, st.version);
      await c.query(
        `INSERT INTO pilotage_decisions(smsi_id,source_ref,source_version,operation,step,result,performed_on,note,refs,snapshot,generated_refs,request_id,intent_hash,created_by,terms)
         VALUES($1,'legacy:reviews:R1',1,'action_create','','completed','2026-01-15','Décision fictive de recette',$2,'{}'::jsonb,$3,$4,'x','test','[]'::jsonb)`,
        [DEFAULT_SMSI, '[]', JSON.stringify(['object:' + action.id]), randomUUID()],
      );
    }, 'test');
    const r = await entrees();
    expect(r.precedente).toEqual({ id: 'R1', date: '2026-01-15' });
    expect(faitsDe(r, 'a')).toMatch(
      /Revue du 15\/01\/2026 : 1 action décidée, 0 terminée\(s\), 1 ouverte\(s\) dont 1 en retard/,
    );
    expect(faitsDe(r, 'b')).toMatch(/2 parties intéressées enregistrée\(s\), 1 non revue/);
    expect(faitsDe(r, 'c1')).toMatch(/IND1 Satisfaction : 90 % \(cible ≥ 80 %\)/);
    expect(faitsDe(r, 'c2')).toMatch(/1\/3 indicateur\(s\) atteint\(s\), 1 non atteint\(s\), 1 non mesuré/);
    expect(faitsDe(r, 'c2')).toMatch(/Objectif OBJ1 Satisfaire : IND2 non atteint/);
    expect(faitsDe(r, 'c3')).toMatch(/Processus PR1 Accueil : 1 atteint\(s\), 1 non atteint\(s\), 1 à mesurer/);
    expect(faitsDe(r, 'c4')).toMatch(/3 constats enregistrés, 2 ouvert\(s\) dont 1 en retard/);
    expect(faitsDe(r, 'c5')).toMatch(/1 indicateur non mesuré : IND3/);
    expect(faitsDe(r, 'c7')).toMatch(/0 fournisseur : 0 évalué/);
    expect(faitsDe(r, 'f')).toMatch(/1 constat de type observation/);
  });
  it('est accessible en lecture seule et reste dans le pilotage commun', async () => {
    expect((await ro.get(`${racine}/pilotage/revue/entrees`)).statusCode).toBe(200);
    const autre = (
      await a.post('/api/grc/smsis', { name: 'Autre périmètre', scope: 'x', timezone: 'Europe/Paris' })
    ).json();
    expect((await a.get(`/api/grc/${autre.id}/pilotage/revue/entrees`)).statusCode).toBe(404);
  });
});
