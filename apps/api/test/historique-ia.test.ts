/* Reprise de la conformité IA de l'outil de suivi (clé `ai`) : registre des usages, évaluation des scénarios, plan et
   politiques, lecture et écriture natives sous verrou, sans copie, champs inconnus conservés. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, reader: Agent, writer: Agent;
const etat = async () => (await admin.get('/api/legacy/state')).json();
const poser = async (m: (s: Record<string, unknown>) => void) => {
  const cur = await admin.get('/api/legacy/state');
  const s = cur.json();
  m(s);
  await seedState(t, s);
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ia_admin', 'admin'));
  reader = await login(t, await makeUser(t, 'ia_reader', 'ro'));
  writer = await login(t, await makeUser(t, 'ia_writer', 'rw'));
});
afterAll(() => t.close());

describe('sans donnée IA (état initial vide)', () => {
  it('rien n’est créé par défaut', async () => {
    const r = await reader.get('/api/ia');
    expect(r.statusCode).toBe(200);
    expect(r.json().ia).toMatchObject({ register: [], evals: [], plan: [], policies: [] });
    const sans = await login(t, await makeUser(t, 'ia_sans', null));
    expect((await sans.get('/api/ia')).statusCode).toBe(403);
  });
  it('le premier usage s’ajoute à un registre vide, sans scénario, étape ni politique', async () => {
    expect((await reader.post('/api/ia/usages')).statusCode).toBe(403);
    const r = await writer.post('/api/ia/usages');
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().id).toBe('EXT-IA-01');
    const ai = (await etat()).ai;
    expect(ai).toMatchObject({ evals: [], plan: [], policies: [] });
    expect(ai.register[0]).toMatchObject({
      id: 'EXT-IA-01',
      aiPresence: 'À vérifier',
      category: 'Service IA web externe',
      authz: 'En qualification',
      owner: 'À confirmer',
    });
  });
});

describe('registre des usages', () => {
  it('modifie un usage ; listes fermées ; conserve les champs non affichés', async () => {
    const r = await writer.patch('/api/ia/usages/EXT-IA-01', {
      aiPresence: 'Oui',
      provider: 'Fournisseur fictif — Service fictif',
      usecase: 'Cas fictif',
      dscp: 'Non',
      authz: 'Autorisé sous conditions',
      storage: 'France',
    });
    expect(r.statusCode, r.body).toBe(200);
    const u = (await reader.get('/api/ia')).json().ia.register[0];
    expect(u).toMatchObject({ aiPresence: 'Oui', authz: 'Autorisé sous conditions', storage: 'France' });
    expect((await etat()).ai.register[0]).toMatchObject({
      role: 'Utilisateur / déployeur',
      type: 'IA générative',
      aipd: 'À qualifier',
    });
    expect((await writer.patch('/api/ia/usages/EXT-IA-01', { authz: 'Peut-être' })).statusCode).toBe(422);
    expect((await writer.patch('/api/ia/usages/EXT-IA-99', { aiPresence: 'Non' })).statusCode).toBe(404);
    expect((await reader.patch('/api/ia/usages/EXT-IA-01', { aiPresence: 'Non' })).statusCode).toBe(403);
  });
  it('ajoute puis supprime un usage', async () => {
    expect((await writer.post('/api/ia/usages')).json().id).toBe('EXT-IA-02');
    expect((await writer.del('/api/ia/usages/EXT-IA-02')).statusCode).toBe(200);
    expect((await writer.del('/api/ia/usages/EXT-IA-02')).statusCode).toBe(404);
    expect((await reader.get('/api/ia')).json().ia.register.map((u: { id: string }) => u.id)).toEqual(['EXT-IA-01']);
  });
});

describe('scénarios, plan et politiques existants', () => {
  beforeAll(async () => {
    await poser((s) => {
      const ai = s.ai as Record<string, unknown>;
      ai.start = '2026-01-01';
      ai.evals = [
        {
          id: 'E01',
          domain: 'Domaine fictif',
          scenario: 'Scénario fictif',
          app: 'Applicable',
          scope: 'Tous les usages externes',
          c: 3,
          i: 2,
          a: 1,
          audit: 0,
          patient: 4,
          prob: 3,
          maturity: 2,
          effort: 5,
          dscp: 'Oui',
          inconnu: { garder: true },
        },
      ];
      ai.plan = [
        {
          id: 'AP-001',
          step: '1',
          phase: 'Phase fictive',
          action: 'Étape fictive',
          status: 'En cours',
          progress: 25,
          jStart: 0,
          jEnd: 30,
        },
        {
          step: '2',
          phase: 'Phase fictive',
          action: 'Étape sans identifiant',
          status: 'À faire',
          progress: 0,
          jStart: 0,
          jEnd: 60,
        },
      ];
      ai.policies = [{ policy: 'Politique fictive', status: 'À faire' }];
    });
  });
  it('lit les scénarios, étapes et politiques', async () => {
    const ia = (await reader.get('/api/ia')).json().ia;
    expect(ia.evals[0]).toMatchObject({ id: 'E01', prob: 3, maturity: 2 });
    expect(ia.plan.map((p: { cle: string }) => p.cle)).toEqual(['AP-001', '@1']);
    expect(ia.policies[0].cle).toBe('@0');
    expect(ia.start).toBe('2026-01-01');
  });
  it('modifie périmètre, probabilité et maturité d’un scénario ; refuse hors bornes', async () => {
    expect(
      (await writer.patch('/api/ia/evaluations/E01', { prob: 4, maturity: 3, scope: 'Future IA interne' })).statusCode,
    ).toBe(200);
    expect((await etat()).ai.evals[0]).toMatchObject({
      prob: 4,
      maturity: 3,
      scope: 'Future IA interne',
      inconnu: { garder: true },
    });
    expect((await writer.patch('/api/ia/evaluations/E01', { prob: 6 })).statusCode).toBe(422);
    expect((await writer.patch('/api/ia/evaluations/E99', { prob: 1 })).statusCode).toBe(404);
  });
  it('statut et avancement d’une étape ; « Terminé » porte l’avancement à 100 ; étape sans identifiant par rang', async () => {
    expect((await writer.patch('/api/ia/plan/etapes/AP-001', { progress: 50 })).statusCode).toBe(200);
    expect((await etat()).ai.plan[0]).toMatchObject({ progress: 50, status: 'En cours' });
    expect((await writer.patch('/api/ia/plan/etapes/AP-001', { status: 'Terminé' })).statusCode).toBe(200);
    expect((await etat()).ai.plan[0]).toMatchObject({ progress: 100, status: 'Terminé' });
    expect((await writer.patch('/api/ia/plan/etapes/@1', { status: 'En validation', progress: 75 })).statusCode).toBe(
      200,
    );
    expect((await etat()).ai.plan[1]).toMatchObject({
      status: 'En validation',
      progress: 75,
      action: 'Étape sans identifiant',
    });
    expect((await writer.patch('/api/ia/plan/etapes/AP-001', { progress: 60 })).statusCode).toBe(422);
    expect((await writer.patch('/api/ia/plan/etapes/@9', { status: 'En cours' })).statusCode).toBe(404);
  });
  it('statut d’une politique et date de début du plan', async () => {
    expect((await writer.patch('/api/ia/politiques/@0', { status: 'En cours' })).statusCode).toBe(200);
    expect((await etat()).ai.policies[0].status).toBe('En cours');
    expect((await writer.patch('/api/ia/plan', { start: '2026-03-01', startValidated: false })).statusCode).toBe(200);
    expect((await etat()).ai).toMatchObject({ start: '2026-03-01', startValidated: false });
    expect((await writer.patch('/api/ia/plan', { start: '01/03/2026' })).statusCode).toBe(422);
  });
  it('journalise les modifications', async () => {
    const rows = await t.svc.db.q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'ai.%'");
    const a = new Set(rows.rows.map((x) => x.action));
    for (const x of [
      'ai.usage.created',
      'ai.usage.updated',
      'ai.usage.deleted',
      'ai.evaluation.updated',
      'ai.step.updated',
      'ai.policy.updated',
      'ai.plan.updated',
    ])
      expect(a.has(x), x).toBe(true);
  });
});
