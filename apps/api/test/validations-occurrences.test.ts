/* Validation des occurrences de tâches récurrentes (migration 030) : OK, KO, NA, journal immuable, idempotence par requestId,
   réouverture motivée, droits (contributeur valide, gestionnaire rouvre, lecteur ne fait rien). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const deposer = (a: Agent, nom: string) =>
  a.req('POST', '/api/documents', {
    body: PDF,
    headers: { 'x-file-name': encodeURIComponent(nom), 'x-meta': encodeURIComponent('{}') },
  });
const serie = {
  kind: 'task_series',
  name: 'Revue trimestrielle des accès',
  data: {
    description: 'Contrôle périodique',
    ownerId: null,
    category: 'action',
    priority: 'normal',
    refs: [],
    recurrence: {
      start: '2026-10-01',
      time: '09:00',
      timezone: 'Europe/Paris',
      unit: 'month',
      interval: 1,
      until: null,
      count: 3,
      reminderDays: 7,
      active: true,
    },
  },
};

describe('validation des occurrences', () => {
  let t: TestApp;
  let admin: Agent, contributeur: Agent, lecteur: Agent;
  let A: string, registre: string, occurrences: string[], serieId: string, preuve: string;
  const rid = () => crypto.randomUUID();
  const valider = (a: Agent, id: string, data: Record<string, unknown>) =>
    a.post(`/api/grc/${A}/objects/${id}/validations`, data);

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'val_admin', 'admin'));
    const c = await makeUser(t, 'val_contrib', 'ro');
    contributeur = await login(t, c);
    const l = await makeUser(t, 'val_lecteur', null);
    lecteur = await login(t, l);
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre V', scope: 'V', timezone: 'Europe/Paris' })).json().id;
    const doc = await deposer(admin, 'Compte rendu de revue.pdf');
    expect(doc.statusCode, doc.body).toBe(201);
    preuve = `document:${doc.json().id}:1`;
    const s = await admin.post(`/api/grc/${A}/objects`, serie);
    expect(s.statusCode, s.body).toBe(200);
    registre = s.json().registreId;
    serieId = s.json().id;
    await t.svc.grc.tasks.tick(new Date('2026-12-15T00:00:00Z'));
    occurrences = (
      await t.svc.db.q<{ id: string }>(
        "SELECT id FROM grc_objects WHERE data->>'seriesId'=$1 ORDER BY data->>'dueAt'",
        [s.json().id],
      )
    ).rows.map((r) => r.id);
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(
      (
        await admin.put(`/api/droits/registre/${registre}`, {
          subjectType: 'utilisateur',
          subjectId: c.id,
          role: 'contributeur',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await admin.put(`/api/droits/registre/${registre}`, {
          subjectType: 'utilisateur',
          subjectId: l.id,
          role: 'lecteur',
        })
      ).statusCode,
    ).toBe(200);
  });
  afterAll(async () => t.close());

  it('une occurrence jamais validée est ouverte ; un OK s’enregistre avec auteur et heure du serveur', async () => {
    const avant = (await admin.get(`/api/grc/${A}/objects/${occurrences[0]}/validations`)).json();
    expect(avant).toEqual({ etat: 'ouverte', items: [] });
    const requestId = rid();
    const r = await valider(contributeur, occurrences[0]!, {
      requestId,
      result: 'ok',
      proofRef: preuve,
      createdBy: 'usurpateur', // ignoré : champ inconnu refusé
    });
    expect(r.statusCode).toBe(422);
    // Une preuve inconnue ou mal formée est refusée ; une référence résolue est acceptée.
    for (const [proofRef, statut] of [
      ['document:abc', 422],
      ['object:00000000-0000-4000-8000-0000000000aa', 404],
      // Une fiche qui n'est pas une preuve (ici la série elle-même) n'est pas acceptée comme preuve.
      ['object:' + serieId, 422],
    ] as const)
      expect(
        (await valider(contributeur, occurrences[0]!, { requestId: rid(), result: 'ok', proofRef })).statusCode,
      ).toBe(statut);
    const ok = await valider(contributeur, occurrences[0]!, { requestId, result: 'ok', proofRef: preuve });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json()).toMatchObject({ etat: 'validee', rejoue: false });
    expect(ok.json().validation).toMatchObject({ seq: 1, kind: 'validation', result: 'ok', createdBy: 'val_contrib' });
    expect(ok.json().validation.proofRef).toBe(preuve);
    // Le journal restitue l'intitulé de la preuve à qui peut la lire, la seule référence à qui ne le peut pas.
    const lu = (await contributeur.get(`/api/grc/${A}/objects/${occurrences[0]}/validations`)).json();
    expect(lu.items[0].proofName).toMatch(/Compte rendu de revue/);
    const sansDroit = (await lecteur.get(`/api/grc/${A}/objects/${occurrences[0]}/validations`)).json();
    expect(sansDroit.items[0]).toMatchObject({ proofRef: preuve, proofName: null });
    expect(Date.now() - Date.parse(ok.json().validation.createdAt)).toBeLessThan(60_000);
  });

  it('rejouer la commande renvoie le même enregistrement sans en créer un second', async () => {
    const id = occurrences[1]!;
    const requestId = rid();
    const un = await valider(contributeur, id, {
      requestId,
      result: 'na',
      comment: 'Périmètre sans objet ce trimestre.',
    });
    const deux = await valider(contributeur, id, {
      requestId,
      result: 'na',
      comment: 'Périmètre sans objet ce trimestre.',
    });
    expect(un.statusCode).toBe(201);
    expect(deux.statusCode).toBe(201);
    expect(deux.json().rejoue).toBe(true);
    expect(deux.json().validation.id).toBe(un.json().validation.id);
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int n FROM occurrence_validations WHERE objet_id=$1',
      [id],
    );
    expect(n!.n).toBe(1);
    // Le même identifiant ne peut pas servir à une autre commande.
    const detourne = await admin.post(`/api/grc/${A}/objects/${id}/validations/reouverture`, {
      requestId,
      reason: 'Tentative de détournement de requête.',
    });
    expect(detourne.statusCode).toBe(409);
  });

  it('un KO et un NA se justifient ; une occurrence validée ne se valide pas une seconde fois', async () => {
    const id = occurrences[0]!; // déjà validée (OK)
    const encore = await valider(contributeur, id, { requestId: rid(), result: 'ok' });
    expect(encore.statusCode).toBe(409);
    expect(encore.json().error).toMatch(/réouverture/);
    const sansMotif = await valider(admin, occurrences[2] ?? occurrences[1]!, { requestId: rid(), result: 'ko' });
    expect(sansMotif.statusCode).toBe(422);
  });

  it('le journal est immuable, y compris pour le propriétaire de la base applicative', async () => {
    const id = occurrences[0]!;
    await expect(
      t.svc.db.q('UPDATE occurrence_validations SET result=$2 WHERE objet_id=$1', [id, 'ko']),
    ).rejects.toThrow();
    await expect(t.svc.db.q('DELETE FROM occurrence_validations WHERE objet_id=$1', [id])).rejects.toThrow();
  });

  it('la réouverture est motivée, réservée aux gestionnaires, journalisée ; une nouvelle validation suit', async () => {
    const id = occurrences[0]!;
    const motif = { requestId: rid(), reason: 'Preuve jointe invalide, à refaire.' };
    // Un contributeur ne rouvre pas (il lit et contribue, sans gérer).
    expect((await contributeur.post(`/api/grc/${A}/objects/${id}/validations/reouverture`, motif)).statusCode).toBe(
      403,
    );
    // Motif trop court refusé.
    expect(
      (await admin.post(`/api/grc/${A}/objects/${id}/validations/reouverture`, { requestId: rid(), reason: 'court' }))
        .statusCode,
    ).toBe(422);
    const r = await admin.post(`/api/grc/${A}/objects/${id}/validations/reouverture`, motif);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ etat: 'rouverte' });
    expect(r.json().validation).toMatchObject({ seq: 2, kind: 'reouverture', result: null, createdBy: 'val_admin' });
    // Une occurrence non validée ne se rouvre pas.
    expect(
      (
        await admin.post(`/api/grc/${A}/objects/${id}/validations/reouverture`, {
          requestId: rid(),
          reason: 'Deuxième tentative.',
        })
      ).statusCode,
    ).toBe(409);
    // Nouvelle validation après réouverture : le journal garde tout.
    const ko = await valider(contributeur, id, { requestId: rid(), result: 'ko', comment: 'Preuve toujours absente.' });
    expect(ko.statusCode).toBe(201);
    const h = (await admin.get(`/api/grc/${A}/objects/${id}/validations`)).json();
    expect(h.etat).toBe('validee');
    expect(h.items.map((x: { seq: number; kind: string; result: string | null }) => [x.seq, x.kind, x.result])).toEqual(
      [
        [1, 'validation', 'ok'],
        [2, 'reouverture', null],
        [3, 'validation', 'ko'],
      ],
    );
    // Chaque écriture est au journal d'audit.
    const audits = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE target=$1 AND action LIKE 'occurrence.%' ORDER BY id",
      [id],
    );
    expect(audits.rows.map((r) => r.action)).toEqual([
      'occurrence.validee',
      'occurrence.rouverte',
      'occurrence.validee',
    ]);
  });

  it('un lecteur consulte le journal sans pouvoir valider ; hors série ou hors accès, la réponse est neutre', async () => {
    const id = occurrences[1]!;
    expect((await lecteur.get(`/api/grc/${A}/objects/${id}/validations`)).statusCode).toBe(200);
    expect((await valider(lecteur, id, { requestId: rid(), result: 'ok' })).statusCode).toBe(403);
    // Une action qui n'est pas une occurrence est refusée.
    const simple = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'action',
      name: 'Action isolée',
      data: {
        description: '',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: null,
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
    expect((await valider(admin, simple.json().id, { requestId: rid(), result: 'ok' })).statusCode).toBe(422);
    // Un identifiant inconnu ne révèle rien.
    expect(
      (await valider(admin, '00000000-0000-4000-8000-0000000000aa', { requestId: rid(), result: 'ok' })).statusCode,
    ).toBe(404);
  });

  it('l’occurrence suivante se cherche dans la liste courante, toutes séries confondues, sans rien valider', async () => {
    const autre = await admin.post(`/api/grc/${A}/objects`, {
      ...serie,
      name: 'Seconde série de la liste',
      data: { ...serie.data, recurrence: { ...serie.data.recurrence, count: 2 } },
    });
    expect(autre.statusCode, autre.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date('2026-12-15T00:00:00Z'));
    const b = (
      await t.svc.db.q<{ id: string }>(
        "SELECT id FROM grc_objects WHERE data->>'seriesId'=$1 ORDER BY data->>'dueAt'",
        [autre.json().id],
      )
    ).rows.map((r) => r.id);
    expect(b.length).toBeGreaterThanOrEqual(1);
    const a = occurrences;
    // Liste de la personne : une occurrence de la première série, une de la seconde, une autre de la première.
    const liste = [a[0]!, b[0]!, a[a.length - 1]!];
    const suivante = async (apres: string, ids = liste) =>
      (await admin.get(`/api/grc/${A}/occurrences/prochaine?apres=${apres}&liste=${ids.join(',')}`)).json();
    // La suivante est celle de l'autre série, pas la suivante de la même série.
    expect((await suivante(a[0]!)).occurrence.actionId).toBe(b[0]);
    // Une occurrence déjà validée est sautée ; en fin de liste, il n'y en a plus.
    const etatAvant = (await admin.get(`/api/grc/${A}/objects/${b[0]}/validations`)).json().etat;
    expect(etatAvant).toBe('ouverte');
    await valider(admin, b[0]!, { requestId: rid(), result: 'ok' });
    const apres = await suivante(a[0]!);
    expect(apres.occurrence.actionId).toBe(a[a.length - 1]);
    expect((await suivante(a[a.length - 1]!)).occurrence).toBeNull();
    // Consulter la suivante ne valide rien.
    expect((await admin.get(`/api/grc/${A}/objects/${a[a.length - 1]}/validations`)).json().etat).toBe('ouverte');
    // Une liste mal formée est refusée ; un identifiant d'une occurrence illisible est ignoré sans fuite.
    expect((await admin.get(`/api/grc/${A}/occurrences/prochaine?apres=${a[0]}&liste=pas-un-id`)).statusCode).toBe(422);
  });
});
