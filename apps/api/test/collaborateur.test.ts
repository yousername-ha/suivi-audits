/* Collaborateur (022-03, ADR 0043) : contribution bornée à un commentaire, une preuve lisible et la réalisation. Le rôle de
   contributeur suffit ; un droit attribué sur une seule action ne donne accès qu'à cette action, un droit de registre à tout le
   registre. Aucune création, modification, suppression ni changement de périmètre. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const action = (name: string) => ({
  kind: 'action',
  name,
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

describe('collaborateur : contributions bornées', () => {
  let t: TestApp;
  let admin: Agent, parAction: Agent, deGroupe: Agent, lecteur: Agent, inconnu: Agent, sansDocuments: Agent;
  let A: string, registre: string, a1: string, a2: string, preuve: string, serieId: string;
  const rid = () => crypto.randomUUID();
  const commenter = (u: Agent, id: string, comment = 'Revue faite, rien à signaler.', requestId = rid()) =>
    u.post(`/api/grc/${A}/objects/${id}/contributions/commentaire`, { requestId, comment });
  const joindre = (u: Agent, id: string, proofRef: string, requestId = rid()) =>
    u.post(`/api/grc/${A}/objects/${id}/contributions/preuve`, { requestId, proofRef, comment: 'Compte rendu signé' });
  const refuse = (statut: number) => expect([403, 404]).toContain(statut);

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'col_admin', 'admin'));
    const p = await makeUser(t, 'col_par_action', 'ro');
    parAction = await login(t, p);
    const g = await makeUser(t, 'col_groupe', 'ro');
    deGroupe = await login(t, g);
    const l = await makeUser(t, 'col_lecteur', null);
    lecteur = await login(t, l);
    inconnu = await login(t, await makeUser(t, 'col_inconnu', null));
    const sd = await makeUser(t, 'col_sans_documents', null);
    sansDocuments = await login(t, sd);
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre C', scope: 'C', timezone: 'Europe/Paris' })).json().id;
    const reg = await admin.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan collaborateurs',
      referenceId: A,
    });
    registre = reg.json().id;
    a1 = (await admin.post(`/api/grc/${A}/objects`, { ...action('Action une'), registreId: registre })).json().id;
    a2 = (await admin.post(`/api/grc/${A}/objects`, { ...action('Action deux'), registreId: registre })).json().id;
    const groupe = (await t.svc.db.one<{ id: string }>(
      "INSERT INTO groups(name) VALUES ('Collaborateurs C') RETURNING id",
    ))!.id;
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [g.id, groupe]);
    const droit = (type: string, id: string, subjectType: string, subjectId: string, role: string) =>
      admin.put(`/api/droits/${type}/${id}`, { subjectType, subjectId, role });
    expect((await droit('objet', a1, 'utilisateur', p.id, 'contributeur')).statusCode).toBe(200);
    expect((await droit('registre', registre, 'groupe', groupe, 'contributeur')).statusCode).toBe(200);
    expect((await droit('registre', registre, 'utilisateur', l.id, 'lecteur')).statusCode).toBe(200);
    expect((await droit('registre', registre, 'utilisateur', sd.id, 'contributeur')).statusCode).toBe(200);
    const doc = await admin.req('POST', '/api/documents', {
      body: PDF,
      headers: { 'x-file-name': encodeURIComponent('Compte rendu.pdf'), 'x-meta': encodeURIComponent('{}') },
    });
    expect(doc.statusCode, doc.body).toBe(201);
    preuve = `document:${doc.json().id}:1`;
    const serie = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série C',
      data: {
        description: '',
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
    });
    serieId = serie.json().id;
  });
  afterAll(async () => t.close());

  it('droit attribué sur une action : commentaire et preuve sur cette action seulement', async () => {
    const c = await commenter(parAction, a1);
    expect(c.statusCode, c.body).toBe(201);
    expect(c.json().contribution).toMatchObject({ seq: 1, kind: 'commentaire', createdBy: 'col_par_action' });
    const p = await joindre(parAction, a1, preuve);
    expect(p.statusCode, p.body).toBe(201);
    expect(p.json().contribution).toMatchObject({ seq: 2, kind: 'preuve', proofRef: preuve });
    // L'autre action du même registre lui reste invisible : ni lecture, ni commentaire, ni preuve.
    expect((await commenter(parAction, a2)).statusCode).toBe(404);
    expect((await joindre(parAction, a2, preuve)).statusCode).toBe(404);
    expect((await parAction.get(`/api/grc/${A}/objects/${a2}/contributions`)).statusCode).toBe(404);
    // La réalisation (avancement) suit la même borne : permise sur l'action attribuée, introuvable sur l'autre.
    const lue = await parAction.get(`/api/grc/${A}/objects/${a1}`);
    const fait = await parAction.req('POST', `/api/grc/${A}/objects/${a1}/contribution`, {
      json: { status: 'progress' },
      headers: { 'if-match': String(lue.headers.etag) },
    });
    expect(fait.statusCode, fait.body).toBe(200);
    const autre = await parAction.req('POST', `/api/grc/${A}/objects/${a2}/contribution`, {
      json: { status: 'progress' },
      headers: { 'if-match': '"1"' },
    });
    expect(autre.statusCode).toBe(404);
  });

  it('droit de registre via un groupe : toutes les actions du registre', async () => {
    expect((await commenter(deGroupe, a1, 'Vu par le groupe.')).statusCode).toBe(201);
    expect((await commenter(deGroupe, a2, 'Vu par le groupe.')).statusCode).toBe(201);
    expect((await joindre(deGroupe, a2, preuve)).statusCode).toBe(201);
    // Le journal est commun à tous ceux qui lisent l'action, dans l'ordre.
    const journal = (await deGroupe.get(`/api/grc/${A}/objects/${a1}/contributions`)).json().items;
    expect(journal.map((x: { seq: number }) => x.seq)).toEqual([1, 2, 3]);
    expect(journal[1].proofName).toMatch(/Compte rendu/);
  });

  it('commande idempotente : rejouer avec le même identifiant ne crée rien', async () => {
    const requestId = rid();
    const premier = await commenter(parAction, a1, 'Une seule fois.', requestId);
    const rejeu = await commenter(parAction, a1, 'Une seule fois.', requestId);
    expect(premier.json().rejoue).toBe(false);
    expect(rejeu.statusCode).toBe(201);
    expect(rejeu.json()).toMatchObject({ rejoue: true, contribution: { id: premier.json().contribution.id } });
    // Le même identifiant pour une autre commande est refusé.
    expect((await joindre(parAction, a1, preuve, requestId)).statusCode).toBe(409);
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int n FROM contributions_elements WHERE request_id=$1',
      [requestId],
    );
    expect(n!.n).toBe(1);
  });

  it('preuve : version de document ou fiche de preuve lisible, jamais un texte libre ni un autre objet', async () => {
    for (const [proofRef, statut] of [
      ['document:abc', 422],
      ['un texte libre', 422],
      ['document:00000000-0000-4000-8000-0000000000aa:1', 404],
      // Une fiche lisible qui n'est pas une preuve (ici une autre action) n'est pas acceptée.
      [`object:${a2}`, 422],
    ] as const)
      expect((await joindre(deGroupe, a1, proofRef)).statusCode, proofRef).toBe(statut);
    // Un commentaire vide est refusé.
    expect((await commenter(deGroupe, a1, '   ')).statusCode).toBe(422);
  });

  it('sans droit de lecture des documents, un collaborateur commente mais ne peut pas joindre de preuve', async () => {
    expect((await commenter(sansDocuments, a1, 'Fait, preuve à venir.')).statusCode).toBe(201);
    const refus = await joindre(sansDocuments, a1, preuve);
    expect(refus.statusCode).toBe(403);
    expect(refus.json().error).toMatch(/documents:lire/);
  });

  it('le collaborateur ne crée, ne modifie, ne supprime rien et ne touche pas aux droits ni aux périmètres', async () => {
    const lecture = await deGroupe.get(`/api/grc/${A}/objects/${a1}`);
    expect(lecture.statusCode).toBe(200);
    const objet = lecture.json();
    // Création d'action, de série et d'écart dans le registre.
    refuse(
      (await deGroupe.post(`/api/grc/${A}/objects`, { ...action('Création interdite'), registreId: registre }))
        .statusCode,
    );
    refuse((await parAction.post(`/api/grc/${A}/objects`, action('Création interdite'))).statusCode);
    refuse(
      (
        await deGroupe.post(`/api/grc/${A}/objects`, {
          kind: 'nonconformity',
          name: 'Écart interdit',
          data: { cause: 'c' },
        })
      ).statusCode,
    );
    // Modification de la définition et suppression.
    refuse(
      (
        await deGroupe.req('PUT', `/api/grc/${A}/objects/${a1}`, {
          json: { kind: 'action', name: 'Renommée', data: objet.data },
          headers: { 'if-match': `"${objet.version}"` },
        })
      ).statusCode,
    );
    refuse(
      (await deGroupe.req('DELETE', `/api/grc/${A}/objects/${a1}`, { headers: { 'if-match': `"${objet.version}"` } }))
        .statusCode,
    );
    // Droits, périmètres, archivage du registre.
    refuse(
      (
        await deGroupe.put(`/api/droits/registre/${registre}`, {
          subjectType: 'utilisateur',
          subjectId: crypto.randomUUID(),
          role: 'lecteur',
        })
      ).statusCode,
    );
    refuse(
      (
        await deGroupe.put(`/api/droits/objet/${a1}`, {
          subjectType: 'groupe',
          subjectId: crypto.randomUUID(),
          role: 'lecteur',
        })
      ).statusCode,
    );
    refuse(
      (
        await deGroupe.put(`/api/registres/${registre}/perimetres`, {
          perimetres: [A],
          apercu: true,
        })
      ).statusCode,
    );
    refuse(
      (
        await parAction.put(`/api/registres/${registre}/perimetres`, {
          perimetres: [A],
          apercu: true,
        })
      ).statusCode,
    );
    // Les contributions n'ont rien modifié : même version, même nom.
    const apres = (await admin.get(`/api/grc/${A}/objects/${a1}`)).json();
    expect(apres.version).toBe(objet.version);
    expect(apres.name).toBe('Action une');
  });

  it('lecteur : consulte le journal, ne contribue pas ; sans droit : 404 partout', async () => {
    expect((await lecteur.get(`/api/grc/${A}/objects/${a1}/contributions`)).statusCode).toBe(200);
    expect((await commenter(lecteur, a1)).statusCode).toBe(403);
    expect((await joindre(lecteur, a1, preuve)).statusCode).toBe(403);
    expect((await inconnu.get(`/api/grc/${A}/objects/${a1}/contributions`)).statusCode).toBe(404);
    expect((await commenter(inconnu, a1)).statusCode).toBe(404);
    expect((await joindre(inconnu, a1, preuve)).statusCode).toBe(404);
  });

  it('seules les actions reçoivent des contributions ; une action archivée est refusée', async () => {
    // La série est un élément du registre de tâches récurrentes : un administrateur y contribue, mais la cible n'est pas une action.
    expect((await commenter(admin, serieId)).statusCode).toBe(422);
    const archivee = (
      await admin.post(`/api/grc/${A}/objects`, { ...action('À archiver'), registreId: registre })
    ).json();
    expect(
      (
        await admin.req('DELETE', `/api/grc/${A}/objects/${archivee.id}`, {
          headers: { 'if-match': `"${archivee.version}"` },
        })
      ).statusCode,
    ).toBeLessThan(300);
    expect([404, 409]).toContain((await commenter(admin, archivee.id)).statusCode);
  });

  it('le journal est immuable : ni modification ni suppression, même en base', async () => {
    await expect(t.svc.db.q("UPDATE contributions_elements SET comment='altéré'")).rejects.toThrow(/ajout seul/);
    await expect(t.svc.db.q('DELETE FROM contributions_elements')).rejects.toThrow(/ajout seul/);
    const audit = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int n FROM audit_log WHERE action IN ('element.commentaire','element.preuve')",
    );
    expect(audit!.n).toBeGreaterThanOrEqual(5);
  });
});
