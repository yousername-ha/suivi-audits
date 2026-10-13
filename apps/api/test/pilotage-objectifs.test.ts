/* Objectifs, indicateurs et processus du Pilotage : création, modification, mesures et suppression dans l'état de
   l'outil de suivi (sans copie), avec les mêmes règles que l'outil historique. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;
const base = `/api/grc/${DEFAULT_SMSI}/pilotage/objectifs`;
const etat = async () => (await t.svc.legacy.recompose())!.data as Record<string, Record<string, unknown>[]>;

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'obj_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'obj_ro', 'ro'));
});
afterAll(() => t.close());

describe('objectifs et indicateurs', () => {
  it('refuse la lecture seule et un périmètre qui n’est pas le pilotage commun', async () => {
    expect((await ro.post(`${base}/processes`, { name: 'Refusé' })).statusCode).toBe(403);
    const autre = await a.post('/api/grc/smsis', {
      name: 'Autre périmètre fictif',
      scope: 'x',
      timezone: 'Europe/Paris',
    });
    expect((await a.post(`/api/grc/${autre.json().id}/pilotage/objectifs/processes`, { name: 'Non' })).statusCode).toBe(
      404,
    );
  });
  it('crée un processus, un objectif lié, puis un indicateur, avec les identifiants de l’outil historique', async () => {
    const p = await a.post(`${base}/processes`, { name: 'Gestion des accès', owner: 'RSSI', family: 'Support' });
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json().id).toBe('PR1');
    // Un indicateur exige un objectif.
    expect((await a.post(`${base}/indicators`, { name: 'Sans objectif' })).statusCode).toBe(422);
    const o = await a.post(`${base}/objectives`, {
      name: 'Maîtriser les accès',
      due: '2027-06-30',
      owner: 'RSSI',
      processes: ['PR1'],
    });
    expect(o.json().id).toBe('OBJ1');
    expect((await a.post(`${base}/objectives`, { name: 'x', processes: ['PR99'] })).statusCode).toBe(422);
    const i = await a.post(`${base}/indicators`, { name: 'Part de comptes revus', obj: 'OBJ1', dir: '≥', target: 0.9 });
    expect(i.json().id).toBe('IND1');
    const e = await etat();
    expect(e.processes![0]).toMatchObject({ id: 'PR1', owner: 'RSSI', family: 'Support' });
    expect(e.objectives![0]).toMatchObject({ id: 'OBJ1', processes: ['PR1'], due: '2027-06-30' });
    expect(e.indicators![0]).toMatchObject({ id: 'IND1', obj: 'OBJ1', dir: '≥', target: 0.9, values: [] });
  });
  it('enregistre le détail de la fiche processus (ISO 9001, 4.4.1) et de l’indicateur (9.1.1), vides par défaut', async () => {
    const e0 = await etat();
    expect(e0.processes![0]).not.toHaveProperty('inputs');
    const r = await a.patch(`${base}/processes/PR1`, {
      inputs: 'Demandes d’accès',
      outputs: 'Droits attribués',
      sequence: 'Après le recrutement',
      resources: 'Annuaire',
      evaluation: 'Revue annuelle',
    });
    expect(r.statusCode, r.body).toBe(200);
    const i = await a.patch(`${base}/indicators/IND1`, {
      monitored: 'Comptes revus',
      method: 'Extraction de l’annuaire',
      monitorWhen: 'Chaque trimestre',
      analyzeWhen: 'Revue de direction',
      category: 'satisfaction',
      processes: ['PR1'],
    });
    expect(i.statusCode, i.body).toBe(200);
    const e = await etat();
    expect(e.processes![0]).toMatchObject({ inputs: 'Demandes d’accès', outputs: 'Droits attribués' });
    expect(e.indicators![0]).toMatchObject({
      monitored: 'Comptes revus',
      category: 'satisfaction',
      processes: ['PR1'],
    });
    expect((await a.patch(`${base}/indicators/IND1`, { inconnu: 1 })).statusCode).toBe(422);
    expect((await a.patch(`${base}/indicators/IND1`, {})).statusCode).toBe(422);
    expect((await a.patch(`${base}/indicators/IND9`, { name: 'x' })).statusCode).toBe(404);
  });
  it('ajoute des mesures comme l’outil historique : taux en pourcentage ramené à 0-1, calcul de l’état et de la tendance', async () => {
    expect((await a.post(`${base}/indicators/IND1/values`, { date: '2026-04-01', value: '80 %' })).statusCode).toBe(
      200,
    );
    expect(
      (await a.post(`${base}/indicators/IND1/values`, { date: '2026-07-01', value: '92', note: 'T2' })).statusCode,
    ).toBe(200);
    expect((await a.post(`${base}/indicators/IND1/values`, { date: 'hier', value: '1' })).statusCode).toBe(422);
    const ligne = (await etat()).indicators![0]!;
    expect((ligne.values as { v: number }[]).map((v) => v.v)).toEqual([0.8, 0.92]);
    // Valeur historique : conservée mais hors valeur courante.
    expect(
      (await a.post(`${base}/indicators/IND1/values`, { date: '2025-12-31', value: '70', hist: '2025-2026' }))
        .statusCode,
    ).toBe(200);
    const apres = (await etat()).indicators![0]!;
    expect((apres.values as unknown[]).length).toBe(3);
    // Suppression d'une mesure par rang.
    expect((await a.del(`${base}/indicators/IND1/values/2`)).statusCode).toBe(200);
    expect(((await etat()).indicators![0]!.values as unknown[]).length).toBe(2);
    expect((await a.del(`${base}/indicators/IND1/values/9`)).statusCode).toBe(404);
  });
  it('refuse la saisie manuelle d’un indicateur calculé automatiquement', async () => {
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      (st.data.indicators as Record<string, unknown>[]).push({
        id: 'IND-AUTO',
        name: 'Calculé',
        obj: 'OBJ1',
        calc: 'saasMfa',
        target: 0.9,
        dir: '≥',
        values: [],
      });
      await t.svc.legacy.legacyWrite(c, st.data, { username: 'test' } as never, st.version);
    }, 'test');
    expect((await a.post(`${base}/indicators/IND-AUTO/values`, { date: '2026-01-01', value: '50' })).statusCode).toBe(
      422,
    );
  });
  it('supprime un indicateur, puis un objectif avec ses indicateurs, puis retire un processus des objectifs', async () => {
    expect((await a.del(`${base}/indicators/IND1`)).statusCode).toBe(422); // confirmation requise
    expect((await a.del(`${base}/indicators/IND1?confirm=SUPPRIMER`)).statusCode).toBe(200);
    await a.post(`${base}/indicators`, { name: 'À supprimer avec l’objectif', obj: 'OBJ1' });
    const o = await a.del(`${base}/objectives/OBJ1?confirm=SUPPRIMER`);
    expect(o.statusCode, o.body).toBe(200);
    expect(o.json().indicateursSupprimes).toBeGreaterThanOrEqual(1);
    const e = await etat();
    expect(e.objectives).toHaveLength(0);
    expect(e.indicators!.filter((i) => i.obj === 'OBJ1')).toHaveLength(0);
    await a.post(`${base}/objectives`, { name: 'Autre', processes: ['PR1'] });
    expect((await a.del(`${base}/processes/PR1?confirm=SUPPRIMER`)).statusCode).toBe(200);
    expect((await etat()).objectives![0]!.processes).toEqual([]);
  });
  it('garde la fiche native cohérente avec les écritures dédiées (la copie `pilotage` ne masque pas la nouvelle valeur)', async () => {
    const c = await a.post(`${base}/processes`, { name: 'Processus mixte' });
    const id = c.json().id as string;
    const fiche = (await a.get(`/api/grc/${DEFAULT_SMSI}/pilotage/legacy/processes/${id}`)).json();
    const maj = await a.put(
      `/api/grc/${DEFAULT_SMSI}/pilotage/legacy/processes/${id}`,
      {
        name: fiche.name,
        sourceSha: fiche.data.sourceSha,
        data: { description: '', refs: [], ownerId: null, mission: 'Mission native', owner: 'Ancien pilote' },
      },
      { 'if-match': `"${fiche.version}"` },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    expect((await a.patch(`${base}/processes/${id}`, { owner: 'Nouveau pilote' })).statusCode).toBe(200);
    const relue = (await a.get(`/api/grc/${DEFAULT_SMSI}/pilotage/legacy/processes/${id}`)).json();
    expect(relue.data.owner).toBe('Nouveau pilote');
    expect(relue.data.mission).toBe('Mission native');
  });
});

describe('boîtes de pilotage par processus', () => {
  it('compte ce qui est rattaché à chaque processus et donne la prochaine échéance récurrente', async () => {
    const racine = `/api/grc/${DEFAULT_SMSI}`;
    const p = (await a.post(`${base}/processes`, { name: 'Processus de la boîte' })).json().id as string;
    const autre = (await a.post(`${base}/processes`, { name: 'Processus sans rattachement' })).json().id as string;
    const ref = `legacy:processes:${p}`;
    const action = {
      kind: 'action',
      name: 'Action liée au processus',
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
    };
    const ouverte = await a.post(`${racine}/objects`, action);
    expect(ouverte.statusCode, ouverte.body).toBe(200);
    const lien = await a.post(`${racine}/links`, {
      source: 'object:' + ouverte.json().id,
      target: ref,
      type: 'related_to',
      note: 'Action rattachée au processus',
    });
    expect(lien.statusCode, lien.body).toBe(200);
    const futur = new Date(Date.now() + 40 * 86400e3).toISOString().slice(0, 10);
    const serie = await a.post(`${racine}/objects`, {
      kind: 'task_series',
      name: 'Revue du processus',
      data: {
        description: '',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [ref],
        recurrence: {
          start: futur,
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'month',
          interval: 3,
          until: null,
          count: null,
          reminderDays: 7,
          active: true,
        },
      },
    });
    expect(serie.statusCode, serie.body).toBe(200);
    const r = await a.get(`${racine}/pilotage/boites`);
    expect(r.statusCode, r.body).toBe(200);
    const boites = r.json() as {
      ref: string;
      actionsOuvertes: number;
      actionsEnRetard: number;
      series: number;
      prochaineEcheance: string | null;
      risques: number;
    }[];
    expect(boites.find((b) => b.ref === ref)).toMatchObject({
      actionsOuvertes: 1,
      actionsEnRetard: 1,
      series: 1,
      risques: 0,
      prochaineEcheance: futur,
    });
    expect(boites.find((b) => b.ref === `legacy:processes:${autre}`)).toMatchObject({
      actionsOuvertes: 0,
      series: 0,
      prochaineEcheance: null,
    });
    expect((await ro.get(`${racine}/pilotage/boites`)).statusCode).toBe(200);
  });
});
