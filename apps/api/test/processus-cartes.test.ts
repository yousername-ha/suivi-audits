/* Processus en cartes : lecture agrégée des rattachements (objectifs, indicateurs, SWOT, risques, fournisseurs), à la source
   des données, avec les droits de lecture de chaque module. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProcessusCartes } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { Agent, createTestApp, login, makeUser, seedState, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent, risque: string;
const racine = `/api/grc/${DEFAULT_SMSI}`;
const lire = async (a = admin) => (await a.get(`${racine}/pilotage/processus-cartes`)).json() as ProcessusCartes;
const carte = (r: ProcessusCartes, id: string) => r.processus.find((p) => p.id === id)!;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'pc_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'pc_lecteur', 'ro'));
  await seedState(t, {
    processes: [
      { id: 'PR1', name: 'Gouvernance', owner: 'Direction', family: 'Management', purpose: 'Piloter' },
      { id: 'PR2', name: 'Accueil', owner: 'Accueil', family: 'Réalisation' },
      { id: 'PR2.1', name: 'Admission', owner: '', family: 'Réalisation', parent: 'PR2' },
    ],
    objectives: [
      { id: 'OBJ1', name: 'Réduire les délais', processes: ['PR2'] },
      { id: 'OBJ2', name: 'Former les équipes', processes: ['PR1', 'PR2'] },
    ],
    indicators: [{ id: 'IND1', name: 'Délai moyen', obj: 'OBJ1', values: [] }],
    swots: [{ id: 'SW1', process: 'PR2', date: '2026-09-01', S: [], W: [], O: [], T: [] }],
    suppliers: [{ id: 'F1', name: 'Hébergeur fictif' }],
  });
  risque = (await t.svc.db.one<{ id: string }>(
    `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by)
       VALUES ($1,'risk','risques','Indisponibilité du SI',$2,'test','test') RETURNING id`,
    [DEFAULT_SMSI, { refs: ['legacy:processes:PR2'] }],
  ))!.id;
});
afterAll(() => t.close());

describe('processus en cartes', () => {
  it('liste les types du registre et les processus avec leur parent', async () => {
    const r = await lire();
    expect(r.types.map((x) => x.code)).toEqual(['Management', 'Réalisation', 'Support']);
    expect(r.processus.map((p) => [p.id, p.family, p.parent])).toEqual([
      ['PR1', 'Management', ''],
      ['PR2', 'Réalisation', ''],
      ['PR2.1', 'Réalisation', 'PR2'],
    ]);
  });

  it('rattache objectifs, indicateurs de ces objectifs, SWOT et risque cité dans sa fiche', async () => {
    const pr2 = carte(await lire(), 'PR2').rattaches;
    expect(pr2.objectifs!.map((x) => x.id)).toEqual(['OBJ1', 'OBJ2']);
    expect(pr2.indicateurs!.map((x) => [x.id, x.via])).toEqual([['IND1', 'objectif']]);
    expect(pr2.swots!.map((x) => [x.id, x.via])).toEqual([['SW1', 'fiche']]);
    expect(pr2.risques!.map((x) => [x.name, x.via, x.lienId])).toEqual([['Indisponibilité du SI', 'fiche', null]]);
    expect(carte(await lire(), 'PR1').rattaches.objectifs!.map((x) => x.id)).toEqual(['OBJ2']);
  });

  it('un lien transverse rattache un fournisseur ou un indicateur, détachable, sans doublon', async () => {
    const f = await admin.post(`${racine}/links`, {
      source: 'legacy:suppliers:F1',
      target: 'legacy:processes:PR1',
      type: 'supports',
      note: '',
    });
    expect(f.statusCode, f.body).toBe(200);
    const i = await admin.post(`${racine}/links`, {
      source: 'legacy:indicators:IND1',
      target: 'legacy:processes:PR1',
      type: 'demonstrates',
      note: '',
    });
    expect(i.statusCode, i.body).toBe(200);
    const pr1 = carte(await lire(), 'PR1').rattaches;
    expect(pr1.fournisseurs!.map((x) => [x.id, x.via])).toEqual([['F1', 'lien']]);
    expect(pr1.indicateurs!.map((x) => [x.id, x.via])).toEqual([['IND1', 'lien']]);
    const lienId = pr1.fournisseurs![0]!.lienId!;
    expect((await admin.del(`${racine}/links/${lienId}`)).statusCode).toBe(204);
    expect(carte(await lire(), 'PR1').rattaches.fournisseurs).toEqual([]);
  });

  it('propose les éléments rattachables de chaque nature', async () => {
    const c = (await lire()).candidats;
    expect(c.objectifs!.map((x) => x.id)).toEqual(['OBJ1', 'OBJ2']);
    expect(c.indicateurs!.map((x) => x.id)).toEqual(['IND1']);
    expect(c.swots!.map((x) => x.id)).toEqual(['SW1']);
    expect(c.risques!.map((x) => x.id)).toEqual([risque]);
    expect(c.fournisseurs!.map((x) => x.id)).toEqual(['F1']);
  });

  it('refuse sans session, hors du pilotage commun, et masque les fournisseurs sans le droit de les lire', async () => {
    const anonyme = new Agent(t);
    expect((await anonyme.get(`${racine}/pilotage/processus-cartes`)).statusCode).toBe(401);
    const ailleurs = await admin.post('/api/grc/smsis', {
      name: 'Autre périmètre',
      scope: 'x',
      timezone: 'Europe/Paris',
    });
    expect((await admin.get(`/api/grc/${ailleurs.json().id}/pilotage/processus-cartes`)).statusCode).toBe(404);
    const r = await lire(lecteur);
    expect(r.processus).toHaveLength(3);
  });

  it('réciprocité : un processus créé sur la carte apparaît dans la cartographie, et inversement', async () => {
    const depuisCarte = await admin.post(`${racine}/pilotage/objectifs/processes`, {
      name: 'Processus créé sur une carte',
      family: 'Support',
      owner: 'DSI',
    });
    expect(depuisCarte.statusCode, depuisCarte.body).toBe(200);
    const objets = async () =>
      ((await admin.get('/api/carto/objects')).json() as { objects: { ref: string; name: string; family?: string }[] })
        .objects;
    const vueCarto = (await objets()).find((o) => o.ref === 'process:' + depuisCarte.json().id);
    expect(vueCarto, 'le processus de la carte figure dans la cartographie').toMatchObject({
      name: 'Processus créé sur une carte',
      family: 'Support',
    });
    const depuisCartographie = await admin.post('/api/carto/objects', {
      type: 'process',
      name: 'Processus dessiné dans la cartographie',
      family: 'Réalisation',
    });
    expect(depuisCartographie.statusCode, depuisCartographie.body).toBe(201);
    const carteCreee = (await lire()).processus.find((p) => p.name === 'Processus dessiné dans la cartographie');
    expect(carteCreee, 'le processus de la cartographie figure en carte').toMatchObject({ family: 'Réalisation' });
  });
});
