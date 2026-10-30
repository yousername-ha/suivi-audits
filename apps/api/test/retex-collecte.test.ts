/* Collecte du RETEX d'un incident : ouverture par le pilote, invitation de contributeurs sans droit de module, propositions
   cloisonnées (chaque contributeur ne voit que les siennes), file à valider, import en lot, clôture et diffusion en lecture
   seule, notifications « retex_contribution », journal d'audit. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, pilote: Agent, lecteur: Agent, a: Agent, b: Agent, intrus: Agent;
let ua: TestUser, ub: TestUser, uIntrus: TestUser;
const ID = 'INC-2026-101';
const base = `/api/incidents/${ID}/retex`;
const etat = async () => (await pilote.get('/api/suivi/etat')).json();
const incident = async () => (await etat()).incidents.find((x: { id: string }) => x.id === ID);

beforeAll(async () => {
  t = await createTestApp();
  pilote = await login(t, await makeUser(t, 'rx_pilote', 'admin'));
  lecteur = await login(t, await makeUser(t, 'rx_lecteur', 'ro'));
  ua = await makeUser(t, 'rx_pole_a', null);
  ub = await makeUser(t, 'rx_pole_b', null);
  uIntrus = await makeUser(t, 'rx_intrus', null);
  a = await login(t, ua);
  b = await login(t, ub);
  intrus = await login(t, uIntrus);
  const s = (await pilote.get('/api/suivi/etat')).json();
  s.incidents = [
    {
      id: ID,
      title: 'Incident fictif',
      kind: 'Incident de sécurité',
      status: 'Résolu',
      detectedAt: '2026-10-12T08:45',
      resolvedAt: '2026-10-14T11:45',
      retex: 'Enseignements historiques conservés',
      inconnu: 'garder',
    },
    { id: 'INC-2026-102', title: 'Autre incident fictif', kind: 'Incident', status: 'Nouveau' },
  ];
  await seedState(t, s);
});
afterAll(() => t.close());

describe('RETEX : collecte', () => {
  it('ouvre le RETEX (pilote) sans toucher au texte historique « retex »', async () => {
    expect((await lecteur.post(`${base}/ouverture`, {})).statusCode).toBe(403);
    const r = await pilote.post(`${base}/ouverture`, { consigne: 'Ajoutez vos actions.', echeance: '2026-11-15' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      retex: 'Enseignements historiques conservés',
      collecte: { statut: 'ouverte', piloteNom: 'Nom rx_pilote', consigne: 'Ajoutez vos actions.' },
    });
    expect((await pilote.post(`${base}/ouverture`, {})).statusCode).toBe(409);
    expect((await pilote.post(`${base}/ouverture`, { echeance: '2026-02-30' })).statusCode).toBe(422);
    expect(await incident()).toMatchObject({ inconnu: 'garder', retex: 'Enseignements historiques conservés' });
  });

  it('propose les comptes actifs et invite des contributeurs, avec notification', async () => {
    const c = await pilote.get('/api/retex/candidats');
    expect(c.statusCode).toBe(200);
    expect(c.json().map((x: { nom: string }) => x.nom)).toEqual(
      expect.arrayContaining(['Nom rx_pole_a', 'Nom rx_pole_b']),
    );
    expect((await lecteur.get('/api/retex/candidats')).statusCode).toBe(403);
    expect(
      (await pilote.post(`${base}/invitations`, { utilisateurs: ['00000000-0000-4000-8000-000000000000'] })).statusCode,
    ).toBe(422);
    const r = await pilote.post(`${base}/invitations`, { utilisateurs: [ua.id, ub.id] });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().collecte.contributeurs.map((x: { nom: string }) => x.nom)).toEqual([
      'Nom rx_pole_a',
      'Nom rx_pole_b',
    ]);
    const n = await t.svc.db.q<{ user_id: string; title: string }>(
      "SELECT user_id::text, title FROM grc_notifications WHERE kind = 'retex_contribution' ORDER BY created_at",
    );
    expect(n.rows.map((x) => x.user_id).sort()).toEqual([ua.id, ub.id].sort());
    // Aucune donnée métier dans le titre (repris dans le courriel).
    expect(n.rows[0]!.title).not.toContain('fictif');
    // Une seconde invitation de la même personne est ignorée.
    const again = await pilote.post(`${base}/invitations`, { utilisateurs: [ua.id] });
    expect(again.json().collecte.contributeurs).toHaveLength(2);
  });

  it('cloisonne les contributeurs : invitation visible, rien d’autre de l’incident', async () => {
    expect((await a.get('/api/incidents')).statusCode).toBe(403);
    const inv = await a.get('/api/retex/invitations');
    expect(inv.statusCode).toBe(200);
    expect(inv.json()).toEqual([
      expect.objectContaining({
        incidentId: ID,
        titre: 'Incident fictif',
        consigne: 'Ajoutez vos actions.',
        statut: 'ouverte',
      }),
    ]);
    expect((await intrus.get('/api/retex/invitations')).json()).toEqual([]);
    expect((await intrus.get(`/api/retex/${ID}`)).statusCode).toBe(404);
    expect((await a.get('/api/retex/INC-2026-102')).statusCode).toBe(404);
    const v = (await a.get(`/api/retex/${ID}`)).json();
    expect(Object.keys(v).sort()).toEqual(['chronologie', 'invitation', 'propositions']);
    expect(v.chronologie).toBeNull();
    expect(JSON.stringify(v)).not.toContain('Enseignements');
    // La lecture marque les notifications de ce RETEX comme lues.
    const lues = await t.svc.db.q<{ n: number }>(
      "SELECT count(*)::int AS n FROM grc_notifications WHERE kind = 'retex_contribution' AND user_id = $1 AND read_at IS NOT NULL",
      [ua.id],
    );
    expect(lues.rows[0]!.n).toBe(1);
  });

  it('chaque contributeur propose, modifie et retire ses seules propositions', async () => {
    const p1 = await a.post(`/api/retex/${ID}/propositions`, {
      ts: '2026-10-12T10:30',
      type: 'Confinement',
      titre: 'Isolement fictif',
      gravite: 'Critique',
    });
    expect(p1.statusCode, p1.body).toBe(201);
    expect(p1.json().propositions).toEqual([expect.objectContaining({ id: 'PR-001', statut: 'en_attente' })]);
    const p2 = await b.post(`/api/retex/${ID}/propositions`, {
      ts: '2026-10-12T14:00',
      type: 'Communication',
      titre: 'Message fictif',
    });
    expect(p2.json().propositions.map((x: { id: string }) => x.id)).toEqual(['PR-002']);
    const p3 = await b.post(`/api/retex/${ID}/propositions`, {
      ts: '2026-10-12T10:31',
      type: 'Analyse',
      titre: 'Doublon fictif',
    });
    expect(p3.json().propositions).toHaveLength(2);
    expect((await b.post(`/api/retex/${ID}/propositions`, { ts: 'x', type: 'Analyse', titre: 'y' })).statusCode).toBe(
      422,
    );
    expect(
      (await intrus.post(`/api/retex/${ID}/propositions`, { ts: '2026-10-12T10:30', type: 'Analyse', titre: 'z' }))
        .statusCode,
    ).toBe(404);
    // B ne voit ni ne touche la proposition de A.
    expect(JSON.stringify((await b.get(`/api/retex/${ID}`)).json())).not.toContain('Isolement fictif');
    expect((await b.patch(`/api/retex/${ID}/propositions/PR-001`, { titre: 'piraté' })).statusCode).toBe(404);
    expect((await b.del(`/api/retex/${ID}/propositions/PR-001`)).statusCode).toBe(404);
    const m = await a.patch(`/api/retex/${ID}/propositions/PR-001`, { description: 'Coupure du VLAN fictif' });
    expect(m.json().propositions[0]).toMatchObject({ description: 'Coupure du VLAN fictif' });
    const tmp = await a.post(`/api/retex/${ID}/propositions`, {
      ts: '2026-10-13T09:00',
      type: 'Autre',
      titre: 'À retirer',
    });
    const pid = tmp.json().propositions.find((x: { titre: string }) => x.titre === 'À retirer').id;
    expect((await a.del(`/api/retex/${ID}/propositions/${pid}`)).statusCode).toBe(200);
    // Le numéro retiré n'est pas réattribué.
    const p5 = await a.post(`/api/retex/${ID}/propositions`, {
      ts: '2026-10-13T10:00',
      type: 'Autre',
      titre: 'Après retrait',
    });
    expect(p5.json().propositions.map((x: { id: string }) => x.id)).toEqual(['PR-001', 'PR-005']);
    expect((await a.del(`/api/retex/${ID}/propositions/PR-005`)).statusCode).toBe(200);
  });

  it('le pilote importe en lot, sans doublon de source', async () => {
    const lot = {
      evenements: [
        { ts: '2026-10-12T08:45', type: 'Détection', titre: 'Détection fictive', source: 'incident:detection' },
        { ts: '2026-10-12T10:30', type: 'Décision', titre: 'Décision fictive', source: 'crise:CEL-1:0' },
      ],
    };
    expect((await lecteur.post(`${base}/import`, lot)).statusCode).toBe(403);
    const r = await pilote.post(`${base}/import`, lot);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().importes).toBe(2);
    expect(r.json().timeline.map((e: { id: string; source: string }) => [e.id, e.source])).toEqual([
      ['EV-001', 'incident:detection'],
      ['EV-002', 'crise:CEL-1:0'],
    ]);
    expect((await pilote.post(`${base}/import`, lot)).json().importes).toBe(0);
  });

  it('le pilote traite la file : accepter corrigée, doublon, rejet motivé', async () => {
    const d = (pid: string, corps: unknown) => pilote.post(`${base}/propositions/${pid}/decision`, corps);
    expect((await lecteur.post(`${base}/propositions/PR-001/decision`, { decision: 'accepter' })).statusCode).toBe(403);
    expect((await a.post(`${base}/propositions/PR-001/decision`, { decision: 'accepter' })).statusCode).toBe(403);
    const ok = await d('PR-001', { decision: 'accepter', corrections: { titre: 'Isolement réseau fictif' } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().timeline.find((e: { id: string }) => e.id === 'EV-003')).toMatchObject({
      titre: 'Isolement réseau fictif',
      gravite: 'Critique',
      source: 'proposition:PR-001',
      apport: 'Nom rx_pole_a',
    });
    expect((await d('PR-001', { decision: 'accepter' })).statusCode).toBe(409);
    expect((await d('PR-003', { decision: 'doublon', evenementId: 'EV-404' })).statusCode).toBe(422);
    expect((await d('PR-003', { decision: 'doublon', evenementId: 'EV-003' })).json().collecte.propositions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'PR-003', statut: 'doublon', evenementId: 'EV-003' })]),
    );
    expect((await d('PR-002', { decision: 'rejeter' })).statusCode).toBe(422);
    expect((await d('PR-002', { decision: 'rejeter', motif: 'Hors périmètre fictif' })).statusCode).toBe(200);
    // Le contributeur voit l'issue de ses propositions, sans pouvoir les modifier.
    const vb = (await b.get(`/api/retex/${ID}`)).json();
    expect(vb.propositions.map((x: { statut: string; motif: string }) => [x.statut, x.motif])).toEqual([
      ['doublon', ''],
      ['rejetee', 'Hors périmètre fictif'],
    ]);
    expect((await b.patch(`/api/retex/${ID}/propositions/PR-002`, { titre: 'x' })).statusCode).toBe(409);
  });

  it('relance, contribution terminée, clôture, diffusion en lecture seule', async () => {
    expect((await a.put(`/api/retex/${ID}/terminee`, { terminee: true })).statusCode).toBe(200);
    const rel = await pilote.post(`${base}/relances`, {});
    expect(rel.statusCode, rel.body).toBe(200);
    const relances = await t.svc.db.q<{ user_id: string }>(
      "SELECT user_id::text FROM grc_notifications WHERE kind = 'retex_contribution' AND due_key = $1",
      [`${ID}:2`],
    );
    expect(relances.rows.map((x) => x.user_id)).toEqual([ub.id]);
    await b.post(`/api/retex/${ID}/propositions`, {
      ts: '2026-10-14T11:45',
      type: 'Rétablissement',
      titre: 'Retour fictif',
    });
    expect((await pilote.post(`${base}/cloture`)).statusCode).toBe(409);
    expect((await pilote.put(`${base}/diffusion`, { diffusee: true })).statusCode).toBe(409);
    await pilote.post(`${base}/propositions/PR-006/decision`, { decision: 'accepter' });
    const clos = await pilote.post(`${base}/cloture`);
    expect(clos.statusCode, clos.body).toBe(200);
    expect(clos.json().collecte.statut).toBe('cloturee');
    expect(
      (await a.post(`/api/retex/${ID}/propositions`, { ts: '2026-10-15T09:00', type: 'Autre', titre: 'Trop tard' }))
        .statusCode,
    ).toBe(409);
    expect((await a.get(`/api/retex/${ID}`)).json().chronologie).toBeNull();
    expect((await pilote.put(`${base}/diffusion`, { diffusee: true })).statusCode).toBe(200);
    const vue = (await a.get(`/api/retex/${ID}`)).json();
    expect(vue.chronologie.map((e: { titre: string }) => e.titre)).toEqual([
      'Détection fictive',
      'Décision fictive',
      'Isolement réseau fictif',
      'Retour fictif',
    ]);
    // La diffusion ne donne aucun droit d'écriture ni accès au registre.
    expect((await a.get('/api/incidents')).statusCode).toBe(403);
    expect((await intrus.get(`/api/retex/${ID}`)).statusCode).toBe(404);
    // Rouvrir retire la diffusion.
    expect((await pilote.post(`${base}/reouverture`)).json().collecte).toMatchObject({
      statut: 'ouverte',
      diffusee: false,
    });
    expect((await a.get(`/api/retex/${ID}`)).json().chronologie).toBeNull();
  });

  it('retire un contributeur : il perd l’accès, ses éléments intégrés restent', async () => {
    const r = await pilote.del(`${base}/contributeurs/${ua.id}`);
    expect(r.statusCode, r.body).toBe(200);
    expect((await a.get(`/api/retex/${ID}`)).statusCode).toBe(404);
    expect(r.json().timeline.some((e: { apport: string }) => e.apport === 'Nom rx_pole_a')).toBe(true);
  });

  it('journalise toutes les étapes', async () => {
    const rows = await t.svc.db.q<{ action: string }>(
      "SELECT DISTINCT action FROM audit_log WHERE action LIKE 'retex.%'",
    );
    const vues = new Set(rows.rows.map((x) => x.action));
    for (const n of [
      'retex.opened',
      'retex.invited',
      'retex.proposal-added',
      'retex.proposal-updated',
      'retex.proposal-withdrawn',
      'retex.proposal-accepter',
      'retex.proposal-doublon',
      'retex.proposal-rejeter',
      'retex.imported',
      'retex.reminded',
      'retex.contribution-done',
      'retex.closed',
      'retex.shared',
      'retex.reopened',
      'retex.contributor-removed',
    ])
      expect(vues.has(n), n).toBe(true);
  });
});
