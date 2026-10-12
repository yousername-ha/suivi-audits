/* Performance aux volumes de référence (cas TEST-043) : un périmètre de 10 000 risques fictifs, lectures répétées des
   écrans qui agrègent le registre (carte, liste paginée, registre filtré, tableau de bord) puis rafale parallèle.
   Les seuils sont des budgets de recette PROPOSÉS (docs/05_RECETTE/RECETTE_AUTOMATISEE.md), mesurés sur un exécuteur partagé de
   CI : ils détectent une régression nette, ils ne constituent ni un engagement de niveau de service ni une mesure
   sur le serveur réel. Données fictives. Si PERF_OUT est défini, les mesures y sont écrites en JSON. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { methodTemplate } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const VOLUME_RISQUES = 10_000;
const REPETITIONS = 15;
const SEUIL_P95_MS = 800;
const SEUIL_RAFALE_MS = 3000;
const RAFALE = 40;

let t: TestApp, a: Agent, scope: string;
const mesures: Record<string, unknown>[] = [];
const root = () => `/api/grc/${scope}`;

const percentile = (valeurs: number[], p: number) => {
  const tri = [...valeurs].sort((x, y) => x - y);
  return tri[Math.min(tri.length - 1, Math.ceil((p / 100) * tri.length) - 1)]!;
};

async function mesurer(nom: string, chemin: string, attendu: (corps: unknown) => void) {
  const durees: number[] = [];
  for (let i = 0; i < REPETITIONS; i++) {
    const debut = performance.now();
    const r = await a.get(chemin);
    durees.push(performance.now() - debut);
    expect(r.statusCode, `${nom} : ${r.body.slice(0, 200)}`).toBe(200);
    if (i === 0) attendu(r.json());
  }
  const m = {
    nom,
    chemin,
    repetitions: REPETITIONS,
    medianeMs: Math.round(percentile(durees, 50)),
    p95Ms: Math.round(percentile(durees, 95)),
    maxMs: Math.round(Math.max(...durees)),
  };
  mesures.push(m);
  return m;
}

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'perf_admin', 'admin'));
  scope = (
    await a.post('/api/grc/smsis', { name: 'Volumes', scope: 'Recette de performance', timezone: 'Europe/Paris' })
  ).json().id;
  const methodId = crypto.randomUUID();
  await t.svc.db.q(
    'INSERT INTO grc_method_versions(method_id,smsi_id,version,definition,reason,created_by) VALUES($1,$2,1,$3,$4,$5)',
    [methodId, scope, methodTemplate('custom'), 'Fixture de performance', 'recette'],
  );
  await t.svc.db.q(
    `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by)
     SELECT $1,'risk','pilotage','Risque volume '||i,
       jsonb_build_object('methodId',$2::text,'methodVersion',1,'domain','information','entity','Entité '||(i%20),
         'scope','Recette','strategy',(ARRAY['reduce','accept','transfer','avoid'])[1+i%4],'reviewAt','2027-01-01','stages','{}'::jsonb),
       'recette','recette'
     FROM generate_series(1,${VOLUME_RISQUES}) i`,
    [scope, methodId],
  );
  await t.svc.db.q('ANALYZE grc_objects');
}, 120_000);
afterAll(async () => {
  if (process.env.PERF_OUT) {
    fs.mkdirSync(process.env.PERF_OUT.replace(/[^/]+$/, '') || '.', { recursive: true });
    fs.writeFileSync(
      process.env.PERF_OUT,
      JSON.stringify(
        { date: new Date().toISOString(), risques: VOLUME_RISQUES, seuilP95Ms: SEUIL_P95_MS, mesures },
        null,
        2,
      ) + '\n',
    );
  }
  console.info(
    'Performance (ms)\n' +
      mesures.map((m) => `${String(m.nom).padEnd(38)} p50 ${m.medianeMs}  p95 ${m.p95Ms}  max ${m.maxMs}`).join('\n'),
  );
  await t.close();
});

describe(`registre de ${VOLUME_RISQUES} risques : p95 sous ${SEUIL_P95_MS} ms`, () => {
  it('carte des risques bornée', async () => {
    const m = await mesurer('carte des risques (50)', root() + '/risk-map?limit=50', (c) => {
      const corps = c as { total: number; items: unknown[] };
      expect(corps.total).toBe(VOLUME_RISQUES);
      expect(corps.items).toHaveLength(50);
    });
    expect(m.p95Ms).toBeLessThan(SEUIL_P95_MS);
  });
  it('liste paginée des objets', async () => {
    const m = await mesurer('liste paginée des risques', root() + '/objects?kind=risk', (c) => {
      expect((c as { total: number }).total).toBe(VOLUME_RISQUES);
    });
    expect(m.p95Ms).toBeLessThan(SEUIL_P95_MS);
  });
  it('registre des risques, avec et sans filtre', async () => {
    const sans = await mesurer('registre des risques', root() + '/risks/register', () => undefined);
    const filtre = await mesurer(
      'registre filtré (option, recherche)',
      root() + '/risks/register?strategie=reduce&recherche=volume%2099',
      () => undefined,
    );
    expect(sans.p95Ms).toBeLessThan(SEUIL_P95_MS);
    expect(filtre.p95Ms).toBeLessThan(SEUIL_P95_MS);
  });
  it('tableau de bord du périmètre', async () => {
    const m = await mesurer('tableau de bord SMSI', root() + '/dashboard', () => undefined);
    expect(m.p95Ms).toBeLessThan(SEUIL_P95_MS);
  });
  it(`rafale de ${RAFALE} lectures simultanées`, async () => {
    const chemins = [
      root() + '/risk-map?limit=50',
      root() + '/objects?kind=risk',
      root() + '/risks/register',
      root() + '/dashboard',
    ];
    const debut = performance.now();
    const reponses = await Promise.all(Array.from({ length: RAFALE }, (_, i) => a.get(chemins[i % chemins.length]!)));
    const duree = Math.round(performance.now() - debut);
    mesures.push({ nom: `rafale de ${RAFALE} lectures`, repetitions: 1, medianeMs: duree, p95Ms: duree, maxMs: duree });
    expect(reponses.filter((r) => r.statusCode !== 200).map((r) => r.statusCode)).toEqual([]);
    expect(duree).toBeLessThan(SEUIL_RAFALE_MS);
  });
});
