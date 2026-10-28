/* Droits par ressource : l'attribution et le passage en « restreint » exigent le droit d'administrer le module ou le rôle
   de gestionnaire de la ressource ; on ne modifie pas ses propres droits ; une relation exige la gestion de l'élément
   source. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

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

describe('attribution des droits par ressource', () => {
  let t: TestApp;
  let admin: Agent, contrib: Agent, rssi: Agent, gestionnaire: Agent, lecteurRestreint: Agent;
  let contribId: string, rssiId: string, gestId: string, tiersId: string, lecteurId: string;
  let A: string, parDefaut: string, registre: string, restreint: string, element: string;
  let groupeRssi: string;
  const version = async (id: string) =>
    (await t.svc.db.one<{ version: number }>('SELECT version FROM registres WHERE id=$1', [id]))!.version;
  const ifMatch = async (id: string) => ({ 'if-match': `"${await version(id)}"` });
  const droit = (a: Agent, reg: string, subjectId: string, role: string, extra: Record<string, unknown> = {}) =>
    a.put(`/api/droits/registre/${reg}`, { subjectType: 'utilisateur', subjectId, role, ...extra });
  const nbDroits = async (reg: string, subjectId: string) =>
    (await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM droits_ressources WHERE resource_type='registre' AND resource_id=$1 AND subject_id=$2",
      [reg, subjectId],
    ))!.n;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'att_admin', 'admin'));
    const c = await makeUser(t, 'att_contrib', 'rw');
    contribId = c.id;
    const r = await makeUser(t, 'att_rssi', 'rssi');
    rssiId = r.id;
    const g = await makeUser(t, 'att_gestionnaire', 'ro');
    gestId = g.id;
    tiersId = (await makeUser(t, 'att_tiers', 'ro')).id;
    const l = await makeUser(t, 'att_lecteur', 'rw');
    lecteurId = l.id;
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre A', scope: 'A', timezone: 'Europe/Paris' })).json().id;
    for (const id of [contribId, rssiId, lecteurId])
      expect((await admin.put(`/api/grc/${A}/members`, { userId: id, write: true })).statusCode).toBe(204);
    contrib = await login(t, c);
    rssi = await login(t, r);
    gestionnaire = await login(t, g);
    lecteurRestreint = await login(t, l);
    // Le registre par défaut d'un périmètre est créé à la première création d'un élément.
    await admin.post(`/api/grc/${A}/objects`, action('Élément du registre par défaut'));
    parDefaut = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM registres WHERE reference_smsi_id=$1 AND kind=$2 AND par_defaut',
      [A, 'plan_actions'],
    ))!.id;
    registre = (
      await admin.post('/api/registres', {
        kind: 'plan_actions',
        name: 'Plan de délégation',
        referenceId: A,
        perimetres: [],
      })
    ).json().id;
    restreint = (
      await admin.post('/api/registres', {
        kind: 'plan_actions',
        name: 'Plan restreint',
        referenceId: A,
        perimetres: [],
        restreint: true,
      })
    ).json().id;
    element = (
      await admin.post(`/api/grc/${A}/objects`, { ...action('Élément du plan restreint'), registreId: restreint })
    ).json().id;
    groupeRssi = (await t.svc.db.one<{ id: string }>(
      "INSERT INTO groups(name) VALUES ('Groupe du RSSI') RETURNING id",
    ))!.id;
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [rssiId, groupeRssi]);
  });
  afterAll(async () => t.close());

  it('un contributeur du périmètre ne s’attribue aucun rôle, ni à un tiers, ni en aperçu', async () => {
    expect((await droit(contrib, parDefaut, contribId, 'gestionnaire')).statusCode).toBe(403);
    expect((await droit(contrib, parDefaut, tiersId, 'gestionnaire')).statusCode).toBe(403);
    expect((await droit(contrib, parDefaut, tiersId, 'lecteur', { apercu: true })).statusCode).toBe(403);
    expect(await nbDroits(parDefaut, contribId)).toBe(0);
    expect(await nbDroits(parDefaut, tiersId)).toBe(0);
  });

  it('un contributeur du périmètre ne retire pas un droit attribué', async () => {
    const posé = await droit(admin, registre, tiersId, 'lecteur');
    expect(posé.statusCode).toBe(200);
    expect((await contrib.del(`/api/droits/registre/${registre}/${posé.json().id}`)).statusCode).toBe(403);
    expect(await nbDroits(registre, tiersId)).toBe(1);
  });

  it('le passage en « restreint » exige le droit d’administrer ; un simple renommage reste permis', async () => {
    const corps = { name: 'Plan de délégation', description: '', restreint: true };
    expect((await contrib.patch(`/api/registres/${registre}`, corps, await ifMatch(registre))).statusCode).toBe(403);
    const renomme = await contrib.patch(
      `/api/registres/${registre}`,
      { name: 'Plan de délégation (renommé)', description: '', restreint: false },
      await ifMatch(registre),
    );
    expect(renomme.statusCode, renomme.body).toBe(200);
    // Le RSSI (droit d'administrer le module) peut restreindre ; un registre restreint se masque aux non-administrateurs,
    // l'administrateur le rouvre.
    expect(
      (
        await rssi.patch(
          `/api/registres/${registre}`,
          { ...corps, name: 'Plan de délégation (renommé)' },
          await ifMatch(registre),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await admin.patch(
          `/api/registres/${registre}`,
          { name: 'Plan de délégation (renommé)', description: '', restreint: false },
          await ifMatch(registre),
        )
      ).statusCode,
    ).toBe(200);
  });

  it('un droit d’administrer le module attribue à un tiers mais pas à soi-même, ni par un groupe dont on est membre', async () => {
    expect((await droit(rssi, registre, tiersId, 'contributeur')).statusCode).toBe(200);
    expect((await droit(rssi, registre, rssiId, 'gestionnaire')).statusCode).toBe(403);
    const parGroupe = await rssi.put(`/api/droits/registre/${registre}`, {
      subjectType: 'groupe',
      subjectId: groupeRssi,
      role: 'gestionnaire',
    });
    expect(parGroupe.statusCode).toBe(403);
    expect(await nbDroits(registre, rssiId)).toBe(0);
  });

  it('un gestionnaire attribué délègue à un tiers, sans modifier ni retirer son propre droit', async () => {
    const posé = await droit(admin, registre, gestId, 'gestionnaire');
    expect(posé.statusCode).toBe(200);
    expect((await droit(gestionnaire, registre, tiersId, 'contributeur')).statusCode).toBe(200);
    expect((await droit(gestionnaire, registre, gestId, 'lecteur')).statusCode).toBe(403);
    expect((await gestionnaire.del(`/api/droits/registre/${registre}/${posé.json().id}`)).statusCode).toBe(403);
    const tiers = await t.svc.db.one<{ id: string }>(
      "SELECT id FROM droits_ressources WHERE resource_type='registre' AND resource_id=$1 AND subject_id=$2",
      [registre, tiersId],
    );
    expect((await gestionnaire.del(`/api/droits/registre/${registre}/${tiers!.id}`)).statusCode).toBe(204);
  });

  it('un administrateur garde la main, y compris sur ses propres droits', async () => {
    const adminId = (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username='att_admin'"))!.id;
    expect((await droit(admin, registre, adminId, 'gestionnaire')).statusCode).toBe(200);
  });

  it('le serveur indique qui peut attribuer', async () => {
    const lire = async (a: Agent, reg: string) => (await a.get(`/api/registres/${reg}`)).json().peutAttribuer;
    expect(await lire(admin, registre)).toBe(true);
    expect(await lire(rssi, registre)).toBe(true);
    expect(await lire(gestionnaire, registre)).toBe(true);
    expect(await lire(contrib, parDefaut)).toBe(false);
  });

  it('une relation depuis un élément d’un registre restreint exige un rôle de gestion sur cet élément', async () => {
    expect((await droit(admin, restreint, lecteurId, 'lecteur')).statusCode).toBe(200);
    const cible = (
      await admin.post(`/api/grc/${A}/objects`, { ...action('Cible de la relation'), registreId: parDefaut })
    ).json().id;
    const corps = { source: `object:${element}`, target: `object:${cible}`, type: 'related_to', note: '' };
    expect((await lecteurRestreint.post(`/api/grc/${A}/links`, corps)).statusCode).toBe(403);
    const lien = await admin.post(`/api/grc/${A}/links`, corps);
    expect(lien.statusCode, lien.body).toBeLessThan(300);
    expect((await lecteurRestreint.del(`/api/grc/${A}/links/${lien.json().id}`)).statusCode).toBe(403);
    expect((await admin.del(`/api/grc/${A}/links/${lien.json().id}`)).statusCode).toBeLessThan(300);
  });
});
