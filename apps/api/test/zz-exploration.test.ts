import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { afterAll, beforeAll, it } from 'vitest';
import { chargerJeuDeTest } from '../src/jeu-de-test.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';
let t: TestApp, a: Agent;
beforeAll(async () => { t = await createTestApp(); a = await login(t, await makeUser(t, 'jdt_admin', 'admin')); });
afterAll(() => t.close());
it('explore', { timeout: 180_000 }, async () => {
  const b = await chargerJeuDeTest(t.svc, t.app, 'jdt_admin', { publicUrl: 'https://suivi.test' });
  require('node:fs').appendFileSync('/tmp/claude-0/ex.txt', 'BILAN ' + JSON.stringify(b.complements) + '\n');
  const S = DEFAULT_SMSI;
  for (const u of ['/api/plans', '/api/audit-suivi', '/api/evaluations-clausier', '/api/grc/smsis', '/api/carto/maps', '/api/carto/objects',
    `/api/grc/${S}/objects?kind=task_series`, `/api/grc/${S}/objects?kind=action`, `/api/grc/${S}/objects?kind=control`, `/api/grc/${S}/objects?kind=evidence`,
    `/api/grc/${S}/objects?kind=treatment`, `/api/grc/${S}/objects?kind=continuity`, `/api/grc/${S}/objects?kind=exercise`, `/api/grc/${S}/objects?kind=measure`, `/api/grc/${S}/objects?kind=document`,
    '/api/registres?archives=false', '/api/documents', `/api/grc/${S}/suppliers`, '/api/grc/perimetres/synthese', '/api/retex/candidats']) {
    const r = await a.get(u);
    require('node:fs').appendFileSync('/tmp/claude-0/ex.txt', '===== ' + u + ' ' + r.statusCode + ' ' + r.body.slice(0, 2500) + '\n');
  }
});
