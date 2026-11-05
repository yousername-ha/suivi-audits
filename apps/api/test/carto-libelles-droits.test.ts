/* Les noms d'objets copiés dans une disposition de carte ne sortent que pour qui peut lire le module source : liste, carte,
   version figée, réponse de création, et clé historique « maps » de l'état du suivi. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MapLayout } from '@suivi/shared/carto';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, sansFournisseurs: Agent, sansPilotage: Agent;
let carte = '';
let version = '';

const LAYOUT: MapLayout = {
  nodes: {
    'sup:S1': { x: 0, y: 0, w: 200, h: 96, label: 'Fournisseur fictif' },
    'process:P1': { x: 0, y: 200, w: 200, h: 96, label: 'Processus fictif' },
  },
  edges: [],
  hide: {},
  ignored: {},
};

type CarteOut = {
  layout: { nodes: Record<string, { label: string }> };
  settings: { issues?: { label: string }[] };
};
const etiquettes = (c: CarteOut) => ({
  sup: c.layout.nodes['sup:S1']?.label,
  process: c.layout.nodes['process:P1']?.label,
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cl_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_carto_pilotage', 'Carto et pilotage', '{cartographie:lire,pilotage:lire}'), ('r_carto_seule', 'Carto seule', '{cartographie:lire}')",
  );
  sansFournisseurs = await login(t, await makeUser(t, 'cl_sans_four', 'r_carto_pilotage'));
  sansPilotage = await login(t, await makeUser(t, 'cl_sans_pilotage', 'r_carto_seule'));
  const c = await admin.post('/api/carto/maps', { view: 'context', layout: LAYOUT });
  expect(c.statusCode, c.body).toBe(201);
  carte = c.json().id;
  const v = await admin.post(`/api/carto/maps/${carte}/versions`, { label: 'Version figée fictive' });
  expect(v.statusCode, v.body).toBe(201);
  version = v.json().id;
  await t.svc.db.q('UPDATE maps SET settings = $2::jsonb WHERE id = $1', [
    carte,
    JSON.stringify({ issues: [{ label: 'Enjeu fictif', kind: 'ext' }] }),
  ]);
});
afterAll(() => t.close());

describe('cartes : libellés selon les droits du lecteur', () => {
  it('témoin : l’administrateur reçoit tous les libellés et les enjeux', async () => {
    const c = (await admin.get(`/api/carto/maps/${carte}`)).json() as CarteOut;
    expect(etiquettes(c)).toEqual({ sup: 'Fournisseur fictif', process: 'Processus fictif' });
    expect(c.settings.issues).toHaveLength(1);
  });

  it('sans fournisseurs:lire, le nom du fournisseur est vidé partout, le reste est conservé', async () => {
    const liste = (await sansFournisseurs.get('/api/carto/maps')).json() as CarteOut[];
    expect(etiquettes(liste[0]!)).toEqual({ sup: '', process: 'Processus fictif' });
    const une = (await sansFournisseurs.get(`/api/carto/maps/${carte}`)).json() as CarteOut;
    expect(etiquettes(une)).toEqual({ sup: '', process: 'Processus fictif' });
    const v = await sansFournisseurs.get(`/api/carto/maps/${carte}/versions/${version}`);
    expect(v.statusCode, v.body).toBe(200);
    expect(etiquettes(v.json() as CarteOut)).toEqual({ sup: '', process: 'Processus fictif' });
    expect(v.body).not.toContain('Fournisseur fictif');
    // La structure (clés, position) reste : seules les valeurs copiées sont vidées.
    expect(Object.keys(une.layout.nodes)).toEqual(['sup:S1', 'process:P1']);
  });

  it('sans pilotage:lire, les enjeux sont vidés et les noms de processus aussi', async () => {
    const c = (await sansPilotage.get(`/api/carto/maps/${carte}`)).json() as CarteOut;
    expect(c.settings.issues).toEqual([]);
    expect(etiquettes(c).process).toBe('');
    expect(JSON.stringify(c)).not.toContain('Enjeu fictif');
  });

  it('clé historique « maps » de l’état du suivi : mêmes règles, versions figées comprises', async () => {
    const lire = async (a: Agent) => {
      const r = await a.get('/api/suivi/etat');
      expect(r.statusCode, r.body).toBe(200);
      return r;
    };
    const adm = (await lire(admin)).body;
    expect(adm).toContain('Fournisseur fictif');
    const r1 = await lire(sansFournisseurs);
    expect(r1.body).not.toContain('Fournisseur fictif');
    expect(r1.body).toContain('Processus fictif');
    const r2 = await lire(sansPilotage);
    expect(r2.body).not.toContain('Enjeu fictif');
    expect(r2.body).not.toContain('Processus fictif');
  });
});
