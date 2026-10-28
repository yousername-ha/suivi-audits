/* Alerte de verrouillage dans l'application (L7, ADR 0074) : chaque administrateur actif reçoit une notification non lue, même
   quand le courriel n'est pas configuré ; elle ne contient ni adresse IP ni code ; seul son destinataire la lit et la marque lue ;
   un même évènement ne crée jamais de doublon ; elle n'apparaît pas dans les rappels rattachés à un SMSI. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

const IP = '203.0.113.77';
let t: TestApp, admin: Agent, adminUser: TestUser;
let n = 0;

const evenement = (userId: string, jusqua = new Date(Date.now() + 15 * 60_000)) => ({
  userId,
  motif: 'mot_de_passe' as const,
  echecs: 5,
  jusqua,
  ip: IP,
});
const notifications = async (userId: string) =>
  (
    await t.svc.db.q<{
      id: string;
      title: string;
      message: string;
      kind: string;
      smsi_id: string | null;
      read_at: Date | null;
    }>(
      "SELECT id, title, message, kind, smsi_id, read_at FROM grc_notifications WHERE user_id = $1 AND kind = 'alerte_securite' ORDER BY created_at",
      [userId],
    )
  ).rows;

beforeAll(async () => {
  t = await createTestApp({ PUBLIC_URL: 'https://suivi.test' });
  adminUser = await makeUser(t, 'appl-admin', 'admin');
  admin = await login(t, adminUser);
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.svc.db.q("DELETE FROM grc_notifications WHERE kind = 'alerte_securite'");
  await t.svc.db.q('DELETE FROM courriel_jobs');
});

describe('alerte de verrouillage dans l’application', () => {
  it('crée une notification non lue pour chaque administrateur actif, sans courriel configuré, sans IP ni code', async () => {
    const autre = await makeUser(t, `appl-admin-${++n}`, 'admin');
    const desactive = await makeUser(t, `appl-admin-${++n}`, 'admin');
    await t.svc.db.q('UPDATE users SET disabled = true WHERE id = $1', [desactive.id]);
    const simple = await makeUser(t, `appl-rw-${++n}`, 'rw');
    const verrouille = await makeUser(t, `appl-cible-${++n}`, 'rw');
    await t.svc.alertesSecurite.verrouillage(evenement(verrouille.id));

    for (const dest of [adminUser, autre]) {
      const l = await notifications(dest.id);
      expect(l).toHaveLength(1);
      expect(l[0]).toMatchObject({ kind: 'alerte_securite', smsi_id: null, read_at: null });
      expect(l[0]!.title).toBe(`Compte verrouillé : ${verrouille.username}`);
      expect(l[0]!.message).toContain('échecs de mot de passe (5 échecs)');
      expect(l[0]!.message).not.toContain(IP);
    }
    expect(await notifications(desactive.id)).toHaveLength(0);
    expect(await notifications(simple.id)).toHaveLength(0);
    // Le courriel n'est pas configuré : l'alerte dans l'application existe quand même, sans courriel.
    const jobs = await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM courriel_jobs');
    expect(jobs!.n).toBe(0);
  });

  it('un même évènement ne crée pas de doublon ; un nouveau verrou du même compte crée une nouvelle alerte', async () => {
    const cible = await makeUser(t, `appl-cible-${++n}`, 'rw');
    const e = evenement(cible.id);
    await t.svc.alertesSecurite.verrouillage(e);
    await t.svc.alertesSecurite.verrouillage(e);
    expect(await notifications(adminUser.id)).toHaveLength(1);
    await t.svc.alertesSecurite.verrouillage(evenement(cible.id, new Date(e.jusqua.getTime() + 3_600_000)));
    expect(await notifications(adminUser.id)).toHaveLength(2);
  });

  it('la liste et le marquage « lu » sont réservés à l’administrateur destinataire', async () => {
    const cible = await makeUser(t, `appl-cible-${++n}`, 'rw');
    await t.svc.alertesSecurite.verrouillage(evenement(cible.id));
    const liste = await admin.get('/api/account/alertes-securite');
    expect(liste.statusCode).toBe(200);
    const alertes = liste.json() as { id: string; title: string; message: string }[];
    expect(alertes).toHaveLength(1);
    expect(JSON.stringify(alertes)).not.toContain(IP);

    // Un compte sans le droit d'administrer ne voit rien et ne peut rien marquer.
    const simple = await login(t, await makeUser(t, `appl-rw-${++n}`, 'rw'));
    expect((await simple.get('/api/account/alertes-securite')).statusCode).toBe(403);
    expect((await simple.put(`/api/account/alertes-securite/${alertes[0]!.id}/read`, {})).statusCode).toBe(403);
    // Un autre administrateur ne peut pas marquer l'alerte d'autrui.
    const second = await login(t, await makeUser(t, `appl-admin-${++n}`, 'admin'));
    expect((await second.put(`/api/account/alertes-securite/${alertes[0]!.id}/read`, {})).statusCode).toBe(404);
    expect(((await admin.get('/api/account/alertes-securite')).json() as unknown[]).length).toBe(1);

    expect((await admin.put(`/api/account/alertes-securite/${alertes[0]!.id}/read`, {})).statusCode).toBe(200);
    expect((await admin.get('/api/account/alertes-securite')).json()).toEqual([]);
    expect((await notifications(adminUser.id))[0]!.read_at).not.toBeNull();
  });

  it('n’apparaît pas dans les rappels rattachés à un SMSI et ne les perturbe pas', async () => {
    const cible = await makeUser(t, `appl-cible-${++n}`, 'rw');
    await t.svc.alertesSecurite.verrouillage(evenement(cible.id));
    const r = await admin.get('/api/grc/notifications');
    expect(r.statusCode, r.body).toBe(200);
    expect(JSON.stringify(r.json())).not.toContain('alerte_securite');
  });

  it('la base refuse un rappel sans SMSI ni objet hors alerte de sécurité', async () => {
    await expect(
      t.svc.db.q(
        "INSERT INTO grc_notifications(smsi_id, object_id, user_id, kind, due_key, title, message) VALUES (NULL, NULL, $1, 'task_due', 'x', 't', 'm')",
        [adminUser.id],
      ),
    ).rejects.toThrow(/grc_notifications_portee/);
  });
});
