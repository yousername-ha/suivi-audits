/* Tableau de bord : sections issues des fiches de registre (écarts, actions, récurrences, risques, continuité), périmètre
   de lecture de la personne, registres restreints, droits et écran mural. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const action = (name: string, dueAt: string | null, registreId?: string) => ({
  kind: 'action',
  name,
  registreId,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: dueAt ? dueAt + 'T09:00:00Z' : null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
  },
});
const ecart = (name: string, data: Record<string, unknown> = {}, registreId?: string) => ({
  kind: 'nonconformity',
  name,
  registreId,
  data: { cause: 'cause', ...data },
});

describe('tableau de bord natif', () => {
  let t: TestApp;
  let admin: Agent, membre: Agent;
  let membreUser: Awaited<ReturnType<typeof makeUser>>;
  let A: string, B: string, regRestreint: string;
  const synthese = async (a: Agent) => (await a.get('/api/mur/synthese')).json();

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'tdb_admin', 'admin'));
    membreUser = await makeUser(t, 'tdb_membre', 'ro');
    const p = async (n: string) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris' })).json().id as string;
    A = await p('Périmètre tableau A');
    B = await p('Périmètre tableau B');
    for (const id of [A, B]) await admin.put(`/api/grc/${id}/members`, { userId: membreUser.id, write: false });
    // Écarts : deux dans A (dont un en retard), un dans B, un clos.
    await admin.post(
      `/api/grc/${A}/objects`,
      ecart('Écart A majeur en retard', { classification: 'majeure', source: 'AFNOR', dueAt: jour(-10) }),
    );
    await admin.post(
      `/api/grc/${A}/objects`,
      ecart('Écart A mineur à échéance', { classification: 'mineure', source: 'Interne', dueAt: jour(5) }),
    );
    await admin.post(`/api/grc/${B}/objects`, ecart('Écart B observation', { findingType: 'observation' }));
    const clos = (
      await admin.post(`/api/grc/${B}/objects`, ecart('Écart B clos', { classification: 'mineure' }))
    ).json();
    await t.svc.db.q(`UPDATE grc_objects SET data=jsonb_set(data,'{status}',$2::jsonb) WHERE id=$1`, [
      clos.id,
      JSON.stringify('closed'),
    ]);
    // Actions : une en retard, une à venir, une dans un registre partagé A/B (comptée une seule fois).
    await admin.post(`/api/grc/${A}/objects`, action('Action en retard', jour(-3)));
    const partage = (
      await admin.post('/api/registres', { kind: 'plan_actions', name: 'Plan A/B', referenceId: A, perimetres: [B] })
    ).json().id as string;
    await admin.post(`/api/grc/${A}/objects`, action('Action partagée', jour(8), partage));
    // Registre restreint : un écart et une action que le membre ne lit pas.
    regRestreint = (
      await admin.post('/api/registres', { kind: 'ecarts', name: 'Écarts secrets', referenceId: A, restreint: true })
    ).json().id;
    await admin.post(`/api/grc/${A}/objects`, ecart('Écart secret', { dueAt: jour(-1) }, regRestreint));
    await t.svc.db.q(
      `INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by)
       VALUES ($1,'risk','pilotage','Risque fictif','{}','test','test')`,
      [A],
    );
    await admin.post(`/api/grc/${A}/objects`, { kind: 'bia', name: 'BIA fictif', data: {} });
    membre = await login(t, membreUser);
  });
  afterAll(() => t.close());

  it('compte les écarts de tous les périmètres lisibles, par statut, classification et audit d’origine', async () => {
    const s = await synthese(admin);
    // 5 écarts dont 1 clos : l'écart secret est lisible par l'administrateur.
    expect(s.ecarts).toMatchObject({ total: 5, ouverts: 4, enRetard: 2, aEcheance: 1 });
    expect(s.ecarts.parStatut).toMatchObject({ Ouvert: 4, Clos: 1 });
    expect(s.ecarts.parType).toMatchObject({
      'Non-conformité majeure': 1,
      'Non-conformité mineure': 2,
      'Constat ou opportunité': 1,
      'Non classé': 1,
    });
    expect(s.ecarts.parSource).toMatchObject({ 'Audit de certification': 1, 'Audit interne': 1 });
    const codes = Object.fromEntries(s.ecartsOuverts.parType.map((x: { type: string; n: number }) => [x.type, x.n]));
    expect(codes).toMatchObject({ 'NC maj': 1, 'NC min': 1, Remarque: 2 });
  });

  it('un élément d’un registre partagé entre deux périmètres n’est compté qu’une fois', async () => {
    const s = await synthese(admin);
    // Action en retard + action à venir (partagée A/B) : 2 ouvertes, 1 en retard.
    expect(s.actions).toMatchObject({ ouvertes: 2, enRetard: 1, terminees: 0 });
  });

  it('masque les éléments d’un registre restreint à qui ne peut pas le lire', async () => {
    const s = await synthese(membre);
    expect(s.ecarts).toMatchObject({ total: 4, ouverts: 3, enRetard: 1 });
    expect(s.echeances.map((e: { texte: string }) => e.texte)).not.toContain('Écart secret');
  });

  it('liste les échéances d’écarts et d’actions avec leur type et leur périmètre, du plus ancien au plus proche', async () => {
    const s = await synthese(admin);
    const l = s.echeances as { texte: string; type: string; perimetre: string; enRetard: boolean }[];
    expect(l.map((e) => e.texte)).toEqual([
      'Écart A majeur en retard',
      'Action en retard',
      'Écart secret',
      'Écart A mineur à échéance',
      'Action partagée',
    ]);
    expect(l[0]).toMatchObject({ type: 'Écart', perimetre: 'Périmètre tableau A', enRetard: true });
    expect(l.find((e) => e.texte === 'Action partagée')).toMatchObject({ type: 'Action', enRetard: false });
  });

  it('risques et continuité', async () => {
    const s = await synthese(admin);
    expect(s.risques).toMatchObject({ total: 1, sansDecision: 1 });
    expect(s.continuite).toEqual({ bia: 1, plans: 0 });
    expect(s.pilotage).toMatchObject({ constatsOuverts: 4, risques: 1, actionsEnRetard: 1 });
  });

  it('sans droit de lecture d’un module, le bloc est nul', async () => {
    const seulAudit = await login(t, await makeUser(t, 'tdb_audit', 'ro', { modules: ['audit'] }));
    const s = await synthese(seulAudit);
    expect(s.ecarts).toBeNull();
    expect(s.echeances).toEqual([]);
    expect([s.actions, s.recurrences, s.risques, s.continuite, s.pilotage]).toEqual([null, null, null, null, null]);
  });

  it('l’écran mural ne compte que le périmètre commun et les registres non restreints', async () => {
    await admin.post(`/api/grc/${DEFAULT_SMSI}/objects`, ecart('Écart commun', { dueAt: jour(2) }));
    const { code } = (await admin.post('/api/admin/murs', { nom: 'Salle tableau', modules: ['ecarts'] })).json();
    const ecran = new Agent(t);
    await ecran.post('/api/mur/activer', { code });
    const s = await synthese(ecran);
    expect(s.ecarts).toMatchObject({ total: 1, ouverts: 1 });
    expect(s.echeances.map((e: { texte: string }) => e.texte)).toEqual(['Écart commun']);
    expect(s.risques).toBeNull();
  });
});
