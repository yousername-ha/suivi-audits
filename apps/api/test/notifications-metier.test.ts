/* Notifications métier (décision 012-10, ADR 0058, migration 044) : réglage tri-état par groupe, rôle et utilisateur, résolution
   (le réglage personnel l'emporte), canal courriel déposé dans la file de l'exécutant seulement si le courriel est configuré,
   idempotence, droits, concurrence et journal sans adresse. Données fictives : adresses en « .test ». */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const URL_REGLAGES = (kind: string, id: string) => `/api/admin/notifications/reglages/${kind}/${id}`;
const bientot = () => new Date(Date.now() + 2 * 86_400_000).toISOString();
const donnees = (extra: Record<string, unknown> = {}) => ({
  description: '',
  status: 'todo',
  ownerId: null,
  startAt: null,
  dueAt: bientot(),
  priority: 'normal',
  category: 'action',
  justification: '',
  reminderDays: 7,
  dependencies: [],
  ...extra,
});

describe('notifications métier', () => {
  let t: TestApp;
  let admin: Agent, lecteur: Agent, agentA: Agent;
  let S: string, groupe: string;
  let userA: Awaited<ReturnType<typeof makeUser>>;
  const ids: Record<string, string> = {};
  const mail = (nom: string) => `${nom.toLowerCase()}@exemple.test`;

  const creerAction = async (nom: string, ownerId: string) => {
    const r = await admin.post(`/api/grc/${S}/objects`, {
      kind: 'action',
      name: `Action secrète ${nom}`,
      data: donnees({ ownerId }),
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json().id as string;
  };
  const jobs = async () =>
    (
      await t.svc.db.q<{
        user_id: string;
        status: string;
        subject: string;
        body: string;
        to_address: string;
        notification_id: string;
      }>(
        "SELECT user_id, status, subject, body, to_address, notification_id FROM courriel_jobs WHERE kind='notification' ORDER BY created_at",
      )
    ).rows;
  const nom = (id: string) => Object.entries(ids).find(([, v]) => v === id)?.[0];
  const destinataires = async () => (await jobs()).map((j) => nom(j.user_id)).sort();
  const configurerCourriel = async (actif: boolean) => {
    const g = await admin.get('/api/settings/courriel');
    const r = await admin.put(
      '/api/settings/courriel',
      { ...g.json().values, actif, hote: 'smtp.exemple.test', port: 587, expediteur: 'suivi@exemple.test' },
      { 'if-match': g.headers.etag as string },
    );
    expect(r.statusCode, r.body).toBe(200);
  };
  const regler = async (kind: string, id: string, changements: unknown[], agent = admin) => {
    const g = await agent.get(URL_REGLAGES(kind, id));
    return agent.put(
      URL_REGLAGES(kind, id),
      { changements },
      { 'if-match': (g.headers.etag as string | undefined) ?? '"0"' },
    );
  };

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'notif_admin', 'admin'));
    lecteur = await login(t, await makeUser(t, 'notif_lecteur', 'ro'));
    for (const n of ['A', 'B', 'C', 'D']) {
      const u = await makeUser(t, 'notif_' + n.toLowerCase(), 'rw');
      ids[n] = u.id;
      // D n'a pas d'adresse : le canal courriel ne peut rien lui envoyer.
      if (n !== 'D') await t.svc.db.q('UPDATE users SET email=$2 WHERE id=$1', [u.id, mail(n)]);
      if (n === 'A') userA = u;
    }
    S = (
      await admin.post('/api/grc/smsis', { name: 'Périmètre notifications', scope: 'N', timezone: 'Europe/Paris' })
    ).json().id;
    for (const u of Object.values(ids))
      expect((await admin.put(`/api/grc/${S}/members`, { userId: u, write: true })).statusCode).toBe(204);
    groupe = (
      await admin.post('/api/admin/groups', {
        name: 'Équipe notifications',
        description: '',
        roles: [],
        members: [ids.A, ids.B, ids.C],
      })
    ).json().id;
    expect(groupe).toBeTruthy();
    agentA = await login(t, userA);
  });
  afterAll(async () => t.close());

  describe('droits et validation', () => {
    it('un lecteur ne voit ni ne modifie les réglages d’administration', async () => {
      expect((await lecteur.get('/api/admin/notifications/portees')).statusCode).toBe(403);
      expect((await lecteur.get(URL_REGLAGES('groupe', groupe))).statusCode).toBe(403);
      expect((await lecteur.get('/api/admin/notifications/apercu?type=task_due&canal=courriel')).statusCode).toBe(403);
      const r = await lecteur.put(
        URL_REGLAGES('groupe', groupe),
        { changements: [{ type: 'task_due', canal: 'courriel', valeur: true }] },
        { 'if-match': '"0"' },
      );
      expect(r.statusCode).toBe(403);
      expect(
        (
          await lecteur.put(
            URL_REGLAGES('utilisateur', ids.A!),
            { changements: [{ type: 'task_due', canal: 'courriel', valeur: true }] },
            { 'if-match': '"0"' },
          )
        ).statusCode,
      ).toBe(403);
    });
    it('sans session : refusé', async () => {
      const anonyme = new (admin.constructor as new (t: TestApp) => Agent)(t);
      expect((await anonyme.get('/api/account/notifications')).statusCode).toBe(401);
    });
    it('chaque personne lit et modifie ses propres réglages, pas ceux d’un autre', async () => {
      const g = await lecteur.get('/api/account/notifications');
      expect(g.statusCode).toBe(200);
      expect(g.json().portee.kind).toBe('utilisateur');
      expect(g.json().reglages).toHaveLength(6);
      const r = await lecteur.put(
        '/api/account/notifications',
        { changements: [{ type: 'task_due', canal: 'application', valeur: false }] },
        { 'if-match': g.headers.etag as string },
      );
      expect(r.statusCode, r.body).toBe(200);
      expect(
        r
          .json()
          .effectifs.find((e: { type: string; canal: string }) => e.type === 'task_due' && e.canal === 'application'),
      ).toMatchObject({ actif: false, origine: 'utilisateur' });
      // L'identifiant de la cible ne se choisit pas dans la route « compte » : le corps ne porte que des réglages.
      const autre = await lecteur.put(
        '/api/account/notifications',
        { changements: [{ type: 'task_due', canal: 'application', valeur: null }], userId: ids.A },
        { 'if-match': r.headers.etag as string },
      );
      expect(autre.statusCode).toBe(422);
      expect(
        (
          await lecteur.put(
            '/api/account/notifications',
            { changements: [{ type: 'task_due', canal: 'application', valeur: null }] },
            { 'if-match': r.headers.etag as string },
          )
        ).statusCode,
      ).toBe(200);
    });
    it('refuse les types et canaux inconnus, les portées inconnues et les doublons', async () => {
      const ok = { type: 'task_due', canal: 'courriel', valeur: true };
      expect((await regler('groupe', groupe, [{ ...ok, type: 'retard' }])).statusCode).toBe(422);
      expect((await regler('groupe', groupe, [{ ...ok, canal: 'sms' }])).statusCode).toBe(422);
      expect((await regler('groupe', groupe, [ok, { ...ok, valeur: false }])).statusCode).toBe(422);
      expect((await regler('groupe', '00000000-0000-4000-8000-0000000000aa', [ok])).statusCode).toBe(404);
      expect((await regler('role', 'role_inconnu', [ok])).statusCode).toBe(404);
      expect((await regler('equipe', groupe, [ok])).statusCode).toBe(422);
    });
    it('concurrence : If-Match obligatoire, version périmée refusée avec l’état courant', async () => {
      const g = await admin.get(URL_REGLAGES('role', 'lecteur'));
      const corps = { changements: [{ type: 'rapprochement', canal: 'application', valeur: false }] };
      expect((await admin.put(URL_REGLAGES('role', 'lecteur'), corps)).statusCode).toBe(428);
      const v = g.json().version as number;
      const r1 = await admin.put(URL_REGLAGES('role', 'lecteur'), corps, { 'if-match': String(v) });
      expect(r1.statusCode, r1.body).toBe(200);
      expect(r1.json().version).toBe(v + 1);
      const perime = await admin.put(
        URL_REGLAGES('role', 'lecteur'),
        { changements: [{ type: 'rapprochement', canal: 'application', valeur: null }] },
        { 'if-match': String(v) },
      );
      expect(perime.statusCode).toBe(412);
      // Rien n'a changé : pas de nouvelle version, et on remet l'état d'origine.
      const inchange = await admin.put(URL_REGLAGES('role', 'lecteur'), corps, { 'if-match': String(v + 1) });
      expect(inchange.json().version).toBe(v + 1);
      expect(
        (
          await admin.put(
            URL_REGLAGES('role', 'lecteur'),
            { changements: [{ type: 'rapprochement', canal: 'application', valeur: null }] },
            { 'if-match': String(v + 1) },
          )
        ).statusCode,
      ).toBe(200);
    });
  });

  describe('courriel non configuré : rien n’est déposé', () => {
    it('l’application reste notifiée, aucune demande n’est mise en file, l’interface le dit', async () => {
      // Le groupe coche le courriel : le réglage s'enregistre bien que rien ne puisse partir.
      const g = await regler('groupe', groupe, [{ type: 'task_due', canal: 'courriel', valeur: true }]);
      expect(g.statusCode, g.body).toBe(200);
      expect(g.json().courriel).toMatchObject({ actif: false });
      expect(g.json().courriel.message).toContain('rien n’est envoyé');
      const a = await creerAction('sans courriel', ids.B!);
      await t.svc.grc.tasks.tick(new Date());
      const n = await t.svc.db.q('SELECT canal_application FROM grc_notifications WHERE object_id=$1', [a]);
      expect(n.rows).toEqual([{ canal_application: true }]);
      expect(await jobs()).toEqual([]);
    });
    it('même avec le courriel activé mais incomplet (sans hôte), rien n’est déposé', async () => {
      const g = await admin.get('/api/settings/courriel');
      const r = await admin.put(
        '/api/settings/courriel',
        { ...g.json().values, actif: true, hote: '', expediteur: '' },
        { 'if-match': g.headers.etag as string },
      );
      expect(r.statusCode, r.body).toBe(200);
      const a = await creerAction('hôte absent', ids.C!);
      await t.svc.grc.tasks.tick(new Date());
      expect((await t.svc.db.q('SELECT 1 FROM grc_notifications WHERE object_id=$1', [a])).rowCount).toBe(1);
      expect(await jobs()).toEqual([]);
    });
  });

  describe('cas de la décision : A, B et C dans un groupe avec le courriel coché, A l’a retiré dans son profil', () => {
    let actions: Record<string, string>;
    it('seuls B et C reçoivent un courriel ; A garde l’application', async () => {
      await configurerCourriel(true);
      // A retire le courriel dans SON profil (route « compte »).
      const mien = await agentA.get('/api/account/notifications');
      const r = await agentA.put(
        '/api/account/notifications',
        { changements: [{ type: 'task_due', canal: 'courriel', valeur: false }] },
        { 'if-match': mien.headers.etag as string },
      );
      expect(r.statusCode, r.body).toBe(200);
      expect(
        r
          .json()
          .effectifs.find((e: { type: string; canal: string }) => e.type === 'task_due' && e.canal === 'courriel'),
      ).toMatchObject({ actif: false, origine: 'utilisateur', exclu: true });

      actions = {};
      for (const n of ['A', 'B', 'C', 'D']) actions[n] = await creerAction('cas ' + n, ids[n]!);
      await t.svc.grc.tasks.tick(new Date());
      expect(await destinataires()).toEqual(['B', 'C']);
      // Les quatre ont leur notification dans l'application.
      for (const n of ['A', 'B', 'C', 'D']) {
        const v = await t.svc.db.one<{ canal_application: boolean }>(
          'SELECT canal_application FROM grc_notifications WHERE object_id=$1 AND user_id=$2',
          [actions[n], ids[n]],
        );
        expect(v, n).toEqual({ canal_application: true });
      }
    });
    it('D, sans adresse courriel, ne reçoit rien même si son groupe… (D n’est pas dans le groupe : défaut)', async () => {
      expect((await jobs()).some((j) => j.user_id === ids.D)).toBe(false);
    });
    it('la demande déposée ne contient aucune donnée métier : titre court, lien relatif, texte brut', async () => {
      const j = (await jobs())[0]!;
      expect(j.subject).toContain('Échéance d’une action');
      expect(`${j.subject}\n${j.body}`).not.toContain('secrète');
      expect(j.body).toContain('/pilotage/rappels');
      expect(j.body).not.toMatch(/<[a-z]/i);
      expect(j.subject).not.toMatch(/[\r\n]/);
      expect(j.subject.length).toBeLessThan(120);
      expect(['reussie', 'echec', 'en_attente']).toContain(j.status);
    });
    it('idempotence : un nouveau passage ne duplique ni la notification ni la demande ; diffuser deux fois non plus', async () => {
      const avant = (await jobs()).length;
      await t.svc.grc.tasks.tick(new Date());
      expect((await jobs()).length).toBe(avant);
      const notifs = await t.svc.db.q<{ id: string; user_id: string }>(
        'SELECT id, user_id FROM grc_notifications WHERE object_id=$1',
        [actions.B],
      );
      await t.svc.db.tx(async (c) => {
        await t.svc.notificationsMetier.diffuser(c, [
          { id: notifs.rows[0]!.id, userId: notifs.rows[0]!.user_id, kind: 'task_due' },
        ]);
      });
      expect((await jobs()).length).toBe(avant);
    });
    it('l’aperçu liste les destinataires avec leur origine et A comme exclu par son réglage personnel', async () => {
      const r = await admin.get('/api/admin/notifications/apercu?type=task_due&canal=courriel');
      expect(r.statusCode, r.body).toBe(200);
      const j = r.json();
      const noms = (l: { username: string }[]) =>
        l
          .map((x) => x.username)
          .filter((u) => u.startsWith('notif_') && u.length === 7)
          .sort();
      expect(noms(j.destinataires)).toEqual(['notif_b', 'notif_c']);
      expect(j.destinataires.find((d: { username: string }) => d.username === 'notif_b')).toMatchObject({
        origine: 'groupe',
        sources: [{ kind: 'groupe', nom: 'Équipe notifications' }],
      });
      expect(noms(j.exclus)).toEqual(['notif_a']);
      expect(j.courriel.actif).toBe(true);
      expect(JSON.stringify(j)).not.toContain('@exemple.test');
    });
    it('la fiche administrateur de A montre son réglage personnel et le résultat effectif ; B hérite du groupe', async () => {
      const a = (await admin.get(URL_REGLAGES('utilisateur', ids.A!))).json();
      expect(
        a.reglages.find((e: { type: string; canal: string }) => e.type === 'task_due' && e.canal === 'courriel').valeur,
      ).toBe(false);
      const b = (await admin.get(URL_REGLAGES('utilisateur', ids.B!))).json();
      expect(
        b.reglages.find((e: { type: string; canal: string }) => e.type === 'task_due' && e.canal === 'courriel').valeur,
      ).toBeNull();
      expect(
        b.effectifs.find((e: { type: string; canal: string }) => e.type === 'task_due' && e.canal === 'courriel'),
      ).toMatchObject({ actif: true, origine: 'groupe' });
      expect((await admin.get(URL_REGLAGES('utilisateur', ids.D!))).json().sansAdresse).toBe(true);
    });
    it('l’administrateur peut aussi retirer le courriel d’un utilisateur depuis sa fiche : seul C le reçoit ensuite', async () => {
      expect(
        (await regler('utilisateur', ids.B!, [{ type: 'task_due', canal: 'courriel', valeur: false }])).statusCode,
      ).toBe(200);
      const x = await creerAction('suite', ids.B!);
      const y = await creerAction('suite C', ids.C!);
      const avant = (await jobs()).length;
      await t.svc.grc.tasks.tick(new Date());
      const nouveaux = (await jobs()).slice(avant);
      expect(nouveaux.map((j) => nom(j.user_id))).toEqual(['C']);
      expect(x && y).toBeTruthy();
      // Remise à l'état « hérite » pour les tests suivants.
      expect(
        (await regler('utilisateur', ids.B!, [{ type: 'task_due', canal: 'courriel', valeur: null }])).statusCode,
      ).toBe(200);
    });
  });

  describe('rôle, application et défauts', () => {
    it('un réglage de rôle s’applique aux titulaires du rôle, l’origine est le rôle', async () => {
      const r = await regler('role', 'contributeur', [{ type: 'risk_review', canal: 'courriel', valeur: true }]);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().membres).toBeGreaterThanOrEqual(4);
      const d = (await admin.get(URL_REGLAGES('utilisateur', ids.C!))).json();
      expect(
        d.effectifs.find((e: { type: string; canal: string }) => e.type === 'risk_review' && e.canal === 'courriel'),
      ).toMatchObject({ actif: true, origine: 'role', sources: [{ kind: 'role', id: 'contributeur' }] });
    });
    it('diffusion d’un autre type que l’échéance : réévaluation d’un risque envoyée par le rôle', async () => {
      const objet = (await t.svc.db.one<{ id: string }>('SELECT id FROM grc_objects WHERE smsi_id=$1 LIMIT 1', [S]))!
        .id;
      const n = await t.svc.db.one<{ id: string }>(
        `INSERT INTO grc_notifications(smsi_id,object_id,user_id,kind,due_key,title,message)
         VALUES($1,$2,$3,'risk_review','test','Réévaluation d’un risque','Détail confidentiel du risque') RETURNING id`,
        [S, objet, ids.C],
      );
      const avant = (await jobs()).length;
      await t.svc.db.tx((c) =>
        t.svc.notificationsMetier.diffuser(c, [{ id: n!.id, userId: ids.C!, kind: 'risk_review' }]),
      );
      const nouveau = (await jobs()).slice(avant);
      expect(nouveau).toHaveLength(1);
      expect(nouveau[0]!.subject).toContain('Réévaluation d’un risque');
      expect(nouveau[0]!.body).not.toContain('confidentiel');
    });
    it('application désactivée pour une personne : la notification existe mais n’apparaît pas dans Rappels', async () => {
      expect(
        (await regler('utilisateur', ids.C!, [{ type: 'task_due', canal: 'application', valeur: false }])).statusCode,
      ).toBe(200);
      const a = await creerAction('masquée', ids.C!);
      await t.svc.grc.tasks.tick(new Date());
      const ligne = await t.svc.db.one<{ canal_application: boolean }>(
        'SELECT canal_application FROM grc_notifications WHERE object_id=$1',
        [a],
      );
      expect(ligne).toEqual({ canal_application: false });
      const c = await login(t, { id: ids.C!, username: 'notif_c', role: 'rw', key: await keyOf(ids.C!) });
      const liste = (await c.get('/api/grc/notifications')).json() as { objectId: string }[];
      expect(liste.some((x) => x.objectId === a)).toBe(false);
      expect(liste.length).toBeGreaterThan(0); // les notifications antérieures restent visibles
    });
    it('un groupe qui désactive explicitement l’application est suivi, sauf si un autre groupe ou rôle l’active', async () => {
      expect(
        (await regler('groupe', groupe, [{ type: 'rapprochement', canal: 'application', valeur: false }])).statusCode,
      ).toBe(200);
      const b = (await admin.get(URL_REGLAGES('utilisateur', ids.B!))).json();
      expect(
        b.effectifs.find(
          (e: { type: string; canal: string }) => e.type === 'rapprochement' && e.canal === 'application',
        ),
      ).toMatchObject({ actif: false, origine: 'groupe' });
      expect(
        (await regler('role', 'contributeur', [{ type: 'rapprochement', canal: 'application', valeur: true }]))
          .statusCode,
      ).toBe(200);
      const b2 = (await admin.get(URL_REGLAGES('utilisateur', ids.B!))).json();
      expect(
        b2.effectifs.find(
          (e: { type: string; canal: string }) => e.type === 'rapprochement' && e.canal === 'application',
        ),
      ).toMatchObject({ actif: true, origine: 'role' });
    });
    it('supprimer le groupe emporte ses réglages', async () => {
      const jetable = (
        await admin.post('/api/admin/groups', { name: 'Éphémère', description: '', roles: [], members: [] })
      ).json().id;
      expect(
        (await regler('groupe', jetable, [{ type: 'task_due', canal: 'courriel', valeur: true }])).statusCode,
      ).toBe(200);
      const d = await admin.del(`/api/admin/groups/${jetable}`);
      expect(d.statusCode, d.body).toBe(204);
      expect((await t.svc.db.q('SELECT 1 FROM notification_reglages WHERE portee_id=$1', [jetable])).rowCount).toBe(0);
    });
  });

  describe('file de courriel et exécutant', () => {
    it('réclame une notification avec son objet et son corps, l’adresse est relue, puis la clôt sans conserver l’adresse', async () => {
      await t.svc.db.q("UPDATE courriel_jobs SET status='echec', finished_at=now() WHERE status='en_attente'");
      const a = await creerAction('envoi', ids.B!);
      await t.svc.grc.tasks.tick(new Date());
      expect(a).toBeTruthy();
      const cfg = (await t.svc.settings.read('courriel')).values as never;
      const job = (await t.svc.courriel.reclamer(cfg)) as Record<string, string>;
      expect(job).toMatchObject({ kind: 'notification', to: mail('B'), from: 'suivi@exemple.test' });
      expect(job.subject).toContain('Échéance');
      expect(job.body).toContain('/pilotage/rappels');
      await t.svc.courriel.terminer(job.id!, {
        ok: true,
        steps: [{ step: 'Message accepté', ok: true, detail: 'ok' }],
        error: null,
      });
      const fin = await t.svc.db.one<{ status: string; to_address: string }>(
        'SELECT status, to_address FROM courriel_jobs WHERE id=$1',
        [job.id],
      );
      expect(fin).toEqual({ status: 'reussie', to_address: '' });
    });
    it('un message de test passe avant les notifications et n’est pas bloqué par elles', async () => {
      const a = await creerAction('priorité', ids.C!);
      await t.svc.grc.tasks.tick(new Date());
      expect(a).toBeTruthy();
      const g = await admin.get('/api/settings/courriel');
      await admin.put(
        '/api/settings/courriel',
        { ...g.json().values, contactTechnique: 'technique@exemple.test' },
        { 'if-match': g.headers.etag as string },
      );
      await t.svc.backups.heartbeat(true);
      t.svc.limits.courrielTest.reset();
      const test = await admin.post('/api/settings/courriel/test');
      expect(test.statusCode, test.body).toBe(202);
      const cfg = (await t.svc.settings.read('courriel')).values as never;
      const premier = (await t.svc.courriel.reclamer(cfg)) as Record<string, string>;
      expect(premier.kind).toBe('test');
      await t.svc.courriel.terminer(premier.id!, { ok: true, steps: [], error: null });
      // La dernière demande de test affichée n'est jamais une notification.
      expect((await admin.get('/api/settings/courriel/test')).json().id).toBe(premier.id);
    });
    it('destinataire désactivé ou sans adresse au moment de l’envoi : demande close sans envoi, suivante réclamée', async () => {
      await t.svc.db.q(
        "UPDATE courriel_jobs SET status='echec', finished_at=now() WHERE status IN ('en_attente','en_cours')",
      );
      const a = await creerAction('désactivé', ids.B!);
      const b = await creerAction('actif', ids.C!);
      await t.svc.grc.tasks.tick(new Date());
      expect(a && b).toBeTruthy();
      await t.svc.db.q('UPDATE users SET disabled=true WHERE id=$1', [ids.B]);
      const cfg = (await t.svc.settings.read('courriel')).values as never;
      const job = (await t.svc.courriel.reclamer(cfg)) as Record<string, string>;
      expect(job.to).toBe(mail('C'));
      await t.svc.courriel.terminer(job.id!, { ok: true, steps: [], error: null });
      const close = await t.svc.db.one<{ status: string; result: { error: string } }>(
        "SELECT status, result FROM courriel_jobs WHERE user_id=$1 AND status='echec' ORDER BY created_at DESC LIMIT 1",
        [ids.B],
      );
      expect(close!.result.error).toContain('rien n’a été envoyé');
      await t.svc.db.q('UPDATE users SET disabled=false WHERE id=$1', [ids.B]);
    });
    it('une demande en attente depuis trop longtemps expire ; un échec n’affecte pas la notification dans l’application', async () => {
      const a = await creerAction('expirée', ids.C!);
      await t.svc.grc.tasks.tick(new Date());
      await t.svc.db.q("UPDATE courriel_jobs SET created_at = now() - interval '10 days' WHERE status='en_attente'");
      const cfg = (await t.svc.settings.read('courriel')).values as never;
      expect(await t.svc.courriel.reclamer(cfg)).toBeNull();
      const j = await t.svc.db.one<{ status: string }>(
        'SELECT status FROM courriel_jobs WHERE notification_id IN (SELECT id FROM grc_notifications WHERE object_id=$1)',
        [a],
      );
      expect(j).toEqual({ status: 'echec' });
      const n = await t.svc.db.one<{ canal_application: boolean }>(
        'SELECT canal_application FROM grc_notifications WHERE object_id=$1',
        [a],
      );
      expect(n).toBeTruthy();
    });
    it('l’état des envois est lisible par l’administration, sans adresse', async () => {
      const r = await admin.get('/api/admin/notifications/etat');
      expect(r.statusCode).toBe(200);
      expect(r.json().envois.echecs).toBeGreaterThan(0);
      expect(r.body).not.toContain('@exemple.test');
      expect((await lecteur.get('/api/admin/notifications/etat')).statusCode).toBe(403);
    });
  });

  describe('journal d’audit', () => {
    it('trace qui a changé quoi pour qui, sans jamais écrire une adresse courriel', async () => {
      const lignes = await t.svc.db.q<{ username: string; action: string; target: string; details: unknown }>(
        "SELECT username, action, target, details FROM audit_log WHERE action LIKE 'notifications.%' ORDER BY id",
      );
      expect(lignes.rowCount).toBeGreaterThan(5);
      const texte = JSON.stringify(lignes.rows);
      expect(texte).not.toContain('@');
      const perso = lignes.rows.find(
        (l) => l.action === 'notifications.reglages_personnels' && l.username === 'notif_a',
      );
      expect(perso).toMatchObject({ target: 'notif_a' });
      expect(perso!.details).toMatchObject({
        portee: 'utilisateur',
        changements: [{ type: 'task_due', canal: 'courriel', avant: null, apres: false }],
      });
      const parAdmin = lignes.rows.find(
        (l) => l.action === 'notifications.reglages' && l.target === 'Équipe notifications',
      );
      expect(parAdmin).toMatchObject({ username: 'notif_admin' });
    });
  });

  describe('migration 044', () => {
    it('est additive : les colonnes et index attendus existent, la colonne application vaut true par défaut', async () => {
      const c = await t.svc.db.one<{ column_default: string }>(
        "SELECT column_default FROM information_schema.columns WHERE table_name='grc_notifications' AND column_name='canal_application'",
      );
      expect(c!.column_default).toBe('true');
      const i = await t.svc.db.one<{ indexdef: string }>(
        "SELECT indexdef FROM pg_indexes WHERE indexname='courriel_jobs_notification_unique'",
      );
      expect(i!.indexdef).toMatch(/UNIQUE/);
    });
    it('le rejeu du fichier SQL ne casse rien (idempotente)', async () => {
      const { readFileSync } = await import('node:fs');
      const path = await import('node:path');
      const sql = readFileSync(path.join(__dirname, '../migrations/044_notifications_metier.sql'), 'utf8');
      await t.svc.db.q(sql);
      await t.svc.db.q(sql);
      expect((await t.svc.db.q('SELECT 1 FROM notification_reglages')).rowCount).toBeGreaterThan(0);
    });
  });

  async function keyOf(id: string) {
    // La clé TOTP est scellée en base : on la remplace par une clé connue pour pouvoir ouvrir une session de test.
    const crypto = await import('node:crypto');
    const key = crypto.randomBytes(20);
    await t.svc.db.q('UPDATE users SET totp_secret=$2, totp_enabled=true, totp_last_step=0 WHERE id=$1', [
      id,
      t.svc.vault.sealSmall(key, 'totp:' + id),
    ]);
    return key;
  }
});
