/* Contacts de crise issus des comptes (ADR 0105, migration 089) : l'administrateur marque un compte (rôle de crise,
   téléphones, disponibilité, contact clé, périmètres) ; la personne ne modifie que ses téléphones et sa disponibilité ;
   GET /api/crise ne montre que les comptes actifs du périmètre lu ; la suppression du compte supprime sa fiche ; le journal
   nomme les champs modifiés, jamais les numéros. Comptes et numéros fictifs (plage réservée à la fiction). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp, type TestUser } from './helpers.js';

const TEL = '01 99 00 00 01';
const TEL2 = '01 99 00 00 02';
const TEL_PERSO = '01 99 00 00 03';
const INCONNU = '11111111-1111-4111-8111-111111111111';

let t: TestApp, admin: Agent;
let enfant: string, autrePerimetre: string, parent: string;
const c: Record<string, TestUser> = {};
const a: Record<string, Agent> = {};

const url = (u: TestUser) => `/api/admin/users/${u.id}/contact-crise`;
const marquer = async (u: TestUser, corps: Record<string, unknown>, version = 0) => {
  const r = await admin.put(url(u), { actif: true, ...corps }, { 'if-match': `"${version}"` });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as { version: number };
};
const comptes = async (ag: Agent, smsi?: string) => {
  const r = await ag.get(smsi ? `/api/crise?smsi=${smsi}` : '/api/crise');
  expect(r.statusCode, r.body).toBe(200);
  return r.json().contactsComptes as {
    userId: string;
    nom: string;
    courriel: string;
    role: string;
    phone: string;
    phone2: string;
    avail: string;
    key: boolean;
  }[];
};
const ids = (l: { userId: string }[]) => l.map((x) => x.userId);

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cc_admin', 'admin'));
  const s = (await admin.get('/api/suivi/etat')).json();
  s.crisis = { contacts: [], scenarios: [], cells: [] };
  await seedState(t, s);
  const creer = async (name: string, parentId?: string) => {
    const r = await admin.post('/api/grc/smsis', { name, scope: 'X', timezone: 'Europe/Paris', parentId });
    expect(r.statusCode, r.body).toBeLessThan(300);
    return r.json().id as string;
  };
  parent = await creer('Parent fictif des contacts');
  enfant = await creer('Enfant fictif des contacts', parent);
  autrePerimetre = await creer('Autre périmètre fictif des contacts');

  // Lecteurs des incidents : rattachés à un seul périmètre, au parent, au périmètre commun ou à aucun.
  c.lecteurEnfant = await makeUser(t, 'cc_lecteur_enfant', 'rw', { rattache: false });
  c.lecteurAutre = await makeUser(t, 'cc_lecteur_autre', 'rw', { rattache: false });
  c.lecteurParent = await makeUser(t, 'cc_lecteur_parent', 'rw', { rattache: false });
  c.sansRattachement = await makeUser(t, 'cc_sans_rattachement', 'rw', { rattache: false });
  for (const [u, smsi] of [
    [c.lecteurEnfant, enfant],
    [c.lecteurAutre, autrePerimetre],
    [c.lecteurParent, parent],
  ] as const)
    expect((await admin.put(`/api/grc/${smsi}/members`, { userId: u.id, write: false })).statusCode).toBe(204);
  // Droits sans incidents:lire, et lecture seule de l'administration.
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_cc_audit', 'Audit seul fictif', '{audit:lire}')",
  );
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_cc_admin_lire', 'Lecture de l’administration fictive', '{administration:lire}')",
  );
  c.sansIncidents = await makeUser(t, 'cc_sans_incidents', 'r_cc_audit');
  c.adminLecture = await makeUser(t, 'cc_admin_lecture', 'r_cc_admin_lire');

  // Comptes contacts de crise.
  c.tous = await makeUser(t, 'cc_contact_tous', 'ro');
  c.enfant = await makeUser(t, 'cc_contact_enfant', 'ro', { rattache: false });
  c.autre = await makeUser(t, 'cc_contact_autre', 'ro');
  c.desactive = await makeUser(t, 'cc_contact_desactive', 'ro');
  c.expire = await makeUser(t, 'cc_contact_expire', 'ro', { expiresAt: new Date(Date.now() - 86_400_000) });
  c.supprime = await makeUser(t, 'cc_contact_supprime', 'ro');
  c.simple = await makeUser(t, 'cc_compte_simple', 'ro');
  await t.svc.db.q("UPDATE users SET email = 'contact.tous@exemple.invalid' WHERE id = $1", [c.tous!.id]);
  expect((await admin.put(`/api/grc/${enfant}/members`, { userId: c.enfant!.id, write: false })).statusCode).toBe(204);

  for (const k of [
    'lecteurEnfant',
    'lecteurAutre',
    'lecteurParent',
    'sansRattachement',
    'sansIncidents',
    'adminLecture',
  ])
    a[k] = await login(t, c[k]!);
});
afterAll(() => t.close());

describe('fiche de contact de crise d’un compte (administrateur)', () => {
  it('se crée, se relit, se modifie avec la version lue, refuse un périmètre inconnu et se retire', async () => {
    const vide = await admin.get(url(c.simple!));
    expect(vide.statusCode).toBe(200);
    expect(vide.headers.etag).toBe('"0"');
    expect(vide.json()).toMatchObject({ actif: false, version: 0, tousPerimetres: true, perimetres: [] });
    expect((await admin.put(url(c.simple!), { actif: true })).statusCode).toBe(428);

    const cree = await marquer(c.simple!, { role: 'Coordination fictive', telephone: TEL, cle: true });
    expect(cree).toMatchObject({ actif: true, role: 'Coordination fictive', telephone: TEL, cle: true, version: 1 });
    expect((await admin.get(url(c.simple!))).headers.etag).toBe('"1"');
    // Version périmée : 412, sans rien écrire.
    expect((await admin.put(url(c.simple!), { actif: true, role: 'Détourné' }, { 'if-match': '"0"' })).statusCode).toBe(
      412,
    );
    // Périmètre inconnu : 400 ; liste choisie vide : refusée par le schéma.
    expect(
      (
        await admin.put(
          url(c.simple!),
          { actif: true, tousPerimetres: false, perimetres: [INCONNU] },
          { 'if-match': '"1"' },
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await admin.put(url(c.simple!), { actif: true, tousPerimetres: false, perimetres: [] }, { 'if-match': '"1"' }))
        .statusCode,
    ).toBe(422);
    const modifie = await marquer(
      c.simple!,
      {
        role: 'Coordination fictive',
        telephone: TEL,
        telephone2: TEL2,
        cle: true,
        tousPerimetres: false,
        perimetres: [enfant],
      },
      1,
    );
    expect(modifie).toMatchObject({ telephone2: TEL2, tousPerimetres: false, perimetres: [enfant], version: 2 });
    expect((await admin.get(url(c.simple!))).json().role).toBe('Coordination fictive');

    const retire = await admin.put(url(c.simple!), { actif: false }, { 'if-match': '"2"' });
    expect(retire.statusCode, retire.body).toBe(200);
    expect(retire.json()).toMatchObject({ actif: false, version: 0 });
    expect((await t.svc.db.q('SELECT 1 FROM contacts_crise_comptes WHERE user_id = $1', [c.simple!.id])).rowCount).toBe(
      0,
    );
    expect((await admin.get(`/api/admin/users/00000000-0000-4000-8000-000000000000/contact-crise`)).statusCode).toBe(
      404,
    );
  });

  it('est refusée sans administration:administrer (lecture seule avec administration:lire)', async () => {
    expect((await a.lecteurEnfant!.get(url(c.simple!))).statusCode).toBe(403);
    expect((await a.lecteurEnfant!.put(url(c.simple!), { actif: true }, { 'if-match': '"0"' })).statusCode).toBe(403);
    expect((await a.adminLecture!.get(url(c.simple!))).statusCode).toBe(200);
    expect((await a.adminLecture!.put(url(c.simple!), { actif: true }, { 'if-match': '"0"' })).statusCode).toBe(403);
    expect((await t.svc.db.q('SELECT 1 FROM contacts_crise_comptes WHERE user_id = $1', [c.simple!.id])).rowCount).toBe(
      0,
    );
  });
});

describe('contacts de crise lus dans GET /api/crise', () => {
  beforeAll(async () => {
    await marquer(c.tous!, { role: 'Direction fictive', telephone: TEL, disponibilite: 'Heures ouvrées' });
    await marquer(c.enfant!, {
      role: 'Astreinte fictive',
      telephone: TEL2,
      cle: true,
      tousPerimetres: false,
      perimetres: [enfant],
    });
    await marquer(c.autre!, { role: 'Support fictif', tousPerimetres: false, perimetres: [autrePerimetre] });
    await marquer(c.desactive!, { role: 'Désactivé fictif' });
    await marquer(c.expire!, { role: 'Expiré fictif' });
    await t.svc.db.q('UPDATE users SET disabled = true WHERE id = $1', [c.desactive!.id]);
  });

  it('montre les comptes du périmètre affiché, contacts clés en premier, avec nom, courriel et téléphones', async () => {
    const l = await comptes(a.lecteurEnfant!, enfant);
    expect(ids(l)).toEqual([c.enfant!.id, c.tous!.id]);
    expect(l[0]).toMatchObject({ nom: 'Nom cc_contact_enfant', role: 'Astreinte fictive', phone: TEL2, key: true });
    expect(l[1]).toMatchObject({
      nom: 'Nom cc_contact_tous',
      courriel: 'contact.tous@exemple.invalid',
      phone: TEL,
      avail: 'Heures ouvrées',
      key: false,
    });
    // Le parent lit l'enfant (pyramide des périmètres, ADR 0092).
    expect(ids(await comptes(a.lecteurParent!, enfant))).toEqual([c.enfant!.id, c.tous!.id]);
  });

  it('sans périmètre choisi : les comptes qui couvrent un périmètre lisible ou tous ; rien sans rattachement', async () => {
    expect(ids(await comptes(a.lecteurEnfant!))).toEqual([c.enfant!.id, c.tous!.id]);
    expect(ids(await comptes(a.lecteurAutre!))).toEqual([c.autre!.id, c.tous!.id]);
    expect(ids(await comptes(a.lecteurAutre!))).not.toContain(c.enfant!.id);
    expect(await comptes(a.sansRattachement!)).toEqual([]);
  });

  it('refuse un périmètre illisible (404) et une personne sans incidents:lire (403)', async () => {
    expect((await a.lecteurAutre!.get(`/api/crise?smsi=${enfant}`)).statusCode).toBe(404);
    expect((await a.sansIncidents!.get('/api/crise')).statusCode).toBe(403);
  });

  it('un compte désactivé ou expiré n’apparaît pas, même pour l’administrateur', async () => {
    const vus = ids(await comptes(admin));
    expect(vus).toEqual(expect.arrayContaining([c.tous!.id, c.enfant!.id, c.autre!.id]));
    expect(vus).not.toContain(c.desactive!.id);
    expect(vus).not.toContain(c.expire!.id);
  });
});

describe('Mon compte : la personne contact de crise', () => {
  it('réponse vide si elle n’est pas contact de crise, 404 à l’écriture', async () => {
    const simple = await login(t, c.simple!);
    const lu = await simple.get('/api/account/contact-crise');
    expect(lu.statusCode, lu.body).toBe(200);
    expect(lu.json()).toBeNull();
    expect(
      (await simple.patch('/api/account/contact-crise', { telephone: TEL }, { 'if-match': '"0"' })).statusCode,
    ).toBe(404);
  });

  it('modifie ses téléphones et sa disponibilité, rien d’autre ; voit son rôle et ses seuls périmètres lisibles', async () => {
    const moi = await login(t, c.enfant!);
    const lu = await moi.get('/api/account/contact-crise');
    expect(lu.statusCode, lu.body).toBe(200);
    expect(lu.json()).toMatchObject({
      role: 'Astreinte fictive',
      cle: true,
      tousPerimetres: false,
      perimetres: [{ id: enfant, nom: 'Enfant fictif des contacts' }],
      perimetresNonLisibles: 0,
    });
    const v = lu.json().version as number;
    expect((await moi.patch('/api/account/contact-crise', { telephone: TEL_PERSO })).statusCode).toBe(428);
    for (const interdit of [{ role: 'Détourné' }, { cle: false }, { tousPerimetres: true }, { perimetres: [] }])
      expect(
        (await moi.patch('/api/account/contact-crise', interdit, { 'if-match': `"${v}"` })).statusCode,
        JSON.stringify(interdit),
      ).toBe(422);
    const ok = await moi.patch(
      '/api/account/contact-crise',
      { telephone: TEL_PERSO, disponibilite: 'Nuits et week-ends' },
      { 'if-match': `"${v}"` },
    );
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({
      telephone: TEL_PERSO,
      telephone2: '',
      disponibilite: 'Nuits et week-ends',
      role: 'Astreinte fictive',
      cle: true,
      version: v + 1,
    });
    expect(
      (await moi.patch('/api/account/contact-crise', { telephone: TEL }, { 'if-match': `"${v}"` })).statusCode,
    ).toBe(412);
    // L'administration voit la mise à jour ; le rôle, la case clé et les périmètres n'ont pas bougé.
    expect((await admin.get(url(c.enfant!))).json()).toMatchObject({
      telephone: TEL_PERSO,
      role: 'Astreinte fictive',
      cle: true,
      tousPerimetres: false,
      perimetres: [enfant],
    });
  });

  it('un périmètre qu’elle ne lit pas est compté, sans son nom', async () => {
    const lu = (await admin.get(url(c.enfant!))).json();
    await marquer(
      c.enfant!,
      {
        role: lu.role,
        telephone: lu.telephone,
        telephone2: lu.telephone2,
        disponibilite: lu.disponibilite,
        cle: true,
        tousPerimetres: false,
        perimetres: [enfant, autrePerimetre],
      },
      lu.version,
    );
    const moi = await login(t, c.enfant!);
    const r = (await moi.get('/api/account/contact-crise')).json();
    expect(r.perimetres).toEqual([{ id: enfant, nom: 'Enfant fictif des contacts' }]);
    expect(r.perimetresNonLisibles).toBe(1);
    expect(JSON.stringify(r)).not.toContain('Autre périmètre fictif');
  });
});

describe('suppression du compte et journal', () => {
  it('la suppression du compte supprime sa fiche de contact de crise', async () => {
    await marquer(c.supprime!, { role: 'Éphémère fictif', telephone: TEL });
    expect((await admin.del(`/api/admin/users/${c.supprime!.id}`)).statusCode).toBe(204);
    expect(
      (await t.svc.db.q('SELECT 1 FROM contacts_crise_comptes WHERE user_id = $1', [c.supprime!.id])).rowCount,
    ).toBe(0);
  });

  it('le journal nomme qui a modifié quels champs, jamais les numéros', async () => {
    const { rows } = await t.svc.db.q<{ username: string; action: string; target: string; details: unknown }>(
      "SELECT username, action, target, details FROM audit_log WHERE action IN ('admin.user_crisis_contact', 'account.crisis_contact_update') ORDER BY id",
    );
    const texte = JSON.stringify(rows);
    for (const n of [TEL, TEL2, TEL_PERSO, TEL.replace(/\s/g, '')]) expect(texte).not.toContain(n);
    expect(rows).toContainEqual(
      expect.objectContaining({
        username: 'cc_admin',
        action: 'admin.user_crisis_contact',
        target: 'cc_compte_simple',
        details: expect.objectContaining({ operation: 'creation', changes: ['role', 'telephone', 'cle'] }),
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        action: 'admin.user_crisis_contact',
        target: 'cc_compte_simple',
        details: { operation: 'retrait' },
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        username: 'cc_contact_enfant',
        action: 'account.crisis_contact_update',
        target: 'cc_contact_enfant',
        details: expect.objectContaining({ changes: ['telephone', 'disponibilite'] }),
      }),
    );
  });
});
