/* Verrouillage de compte (L7, ADR 0070) : réponse de connexion uniforme (aucune différence observable entre un compte inconnu,
   un mauvais mot de passe et un compte verrouillé) et alerte par courriel à la TRANSITION vers l'état verrouillé, adressée au
   contact technique et aux administrateurs actifs, non désactivable par les réglages personnels, avec plafond horaire. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMANDEUR_ALERTE } from '../src/alertes-exploitation.js';
import { Agent, createTestApp, login, makeUser, nextCode, PASSWORD, type TestApp, type TestUser } from './helpers.js';

const CONTACT = 'securite-technique@exemple.test';
const MESSAGE = 'Identifiant ou mot de passe incorrect, ou compte temporairement verrouillé après plusieurs échecs.';
let t: TestApp, admin: Agent;
let n = 0;

const regler = async (v: Record<string, unknown>) => {
  const g = await admin.get('/api/settings/courriel');
  const r = await admin.put(
    '/api/settings/courriel',
    { ...g.json().values, ...v },
    { 'if-match': g.headers.etag as string },
  );
  expect(r.statusCode, r.body).toBe(200);
};
const configurer = (v: Record<string, unknown> = {}) =>
  regler({
    actif: true,
    hote: 'smtp.exemple.test',
    expediteur: 'suivi@exemple.test',
    contactTechnique: CONTACT,
    ...v,
  });
const remettreAZero = () => {
  for (const l of [
    t.svc.limits.loginByIp,
    t.svc.limits.loginByUser,
    t.svc.limits.mfaBySession,
    t.svc.limits.mfaByUser,
    t.svc.limits.motDePasseByUser,
  ])
    l.reset();
};
const alertes = async () =>
  (
    await t.svc.db.q<{ to_address: string; subject: string; body: string }>(
      'SELECT to_address, subject, body FROM courriel_jobs WHERE requested_by = $1 ORDER BY created_at, to_address',
      [DEMANDEUR_ALERTE],
    )
  ).rows;
const adresses = async () => (await alertes()).map((a) => a.to_address).sort();
const avecCourriel = async (nom: string, role: string | null, email: string, o: { disabled?: boolean } = {}) => {
  const u = await makeUser(t, nom, role);
  await t.svc.db.q('UPDATE users SET email = $2, disabled = $3 WHERE id = $1', [u.id, email, !!o.disabled]);
  return u;
};
const compte = (role = 'rw') => makeUser(t, `verrou-${++n}`, role);
/** Cinq mots de passe faux : le compte est verrouillé au cinquième. */
const verrouillerParMotDePasse = async (u: TestUser) => {
  const a = new Agent(t);
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) {
    remettreAZero();
    codes.push((await a.post('/api/auth/login', { username: u.username, password: 'mauvais' })).statusCode);
  }
  return codes;
};

beforeAll(async () => {
  t = await createTestApp({ PUBLIC_URL: 'https://suivi.test' });
  admin = await login(t, await makeUser(t, 'verrou-admin-session', 'admin'));
});
afterAll(() => t.close());
beforeEach(async () => {
  remettreAZero();
  await t.svc.db.q('DELETE FROM courriel_jobs');
  await t.svc.db.q("UPDATE users SET email = ''"); // les destinataires de chaque test sont posés par le test
  await configurer();
});

describe('réponse de connexion uniforme (S-09)', () => {
  it('un compte inconnu, un mauvais mot de passe et un compte verrouillé reçoivent le même statut et le même corps', async () => {
    const u = await compte();
    const a = new Agent(t);
    const inconnu = await a.post('/api/auth/login', { username: 'personne-ici', password: 'mauvais' });
    remettreAZero();
    const faux = await a.post('/api/auth/login', { username: u.username, password: 'mauvais' });
    remettreAZero();
    await verrouillerParMotDePasse(u);
    remettreAZero();
    const verrouille = await a.post('/api/auth/login', { username: u.username, password: PASSWORD });
    expect(inconnu.statusCode).toBe(401);
    expect(faux.statusCode).toBe(401);
    expect(verrouille.statusCode).toBe(401);
    expect(inconnu.json()).toEqual(faux.json());
    expect(verrouille.json()).toEqual(inconnu.json());
    expect(inconnu.json().error).toBe(MESSAGE);
  });

  it('le motif exact reste au journal d’audit', async () => {
    const u = await compte();
    await verrouillerParMotDePasse(u);
    remettreAZero();
    await new Agent(t).post('/api/auth/login', { username: u.username, password: PASSWORD });
    const motifs = (
      await t.svc.db.q<{ reason: string }>(
        "SELECT details->>'reason' AS reason FROM audit_log WHERE action='auth.login_failed' AND username=$1 ORDER BY id",
        [u.username],
      )
    ).rows.map((r) => r.reason);
    expect(motifs).toEqual(['bad_password', 'bad_password', 'bad_password', 'bad_password', 'locked_now', 'locked']);
  });

  it('un compte verrouillé qui présente un code après sa connexion reçoit la même réponse et perd sa session', async () => {
    const u = await compte();
    remettreAZero();
    const a = new Agent(t);
    expect((await a.post('/api/auth/login', { username: u.username, password: PASSWORD })).statusCode).toBe(200);
    await a.me();
    await t.svc.db.q("UPDATE users SET locked_until = now() + interval '10 minutes' WHERE id=$1", [u.id]);
    const r = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toBe(MESSAGE);
    const restantes = await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM sessions WHERE user_id=$1', [
      u.id,
    ]);
    expect(restantes!.n).toBe(0);
  });
});

describe('alerte de verrouillage', () => {
  it('avertit le contact technique et chaque administrateur actif à la transition, sans doublon', async () => {
    const a1 = await avecCourriel('verrou-adm-1', 'admin', 'adm1@exemple.test');
    const a2 = await avecCourriel('verrou-adm-2', 'admin', 'adm2@exemple.test');
    const cible = await compte();
    const codes = await verrouillerParMotDePasse(cible);
    expect(codes).toEqual([401, 401, 401, 401, 401]);
    expect(
      (await t.svc.db.one<{ locked_until: Date | null }>('SELECT locked_until FROM users WHERE id=$1', [cible.id]))!
        .locked_until,
    ).not.toBeNull();
    expect(await adresses()).toEqual([CONTACT, 'adm1@exemple.test', 'adm2@exemple.test'].sort());
    // Échecs sur un compte déjà verrouillé : aucun envoi de plus.
    remettreAZero();
    await new Agent(t).post('/api/auth/login', { username: cible.username, password: 'mauvais' });
    await new Agent(t).post('/api/auth/login', { username: cible.username, password: PASSWORD });
    expect(await alertes()).toHaveLength(3);
    expect([a1.id, a2.id]).toHaveLength(2);
  });

  it('couvre le second facteur et nomme le motif, le compte et la fin du verrou, sans adresse IP ni code', async () => {
    await avecCourriel('verrou-adm-3', 'admin', 'adm3@exemple.test');
    const cible = await compte();
    remettreAZero();
    const a = new Agent(t);
    expect((await a.post('/api/auth/login', { username: cible.username, password: PASSWORD })).statusCode).toBe(200);
    await a.me();
    for (let i = 0; i < 5; i++) {
      t.svc.limits.mfaByUser.reset();
      expect((await a.post('/api/auth/mfa', { code: '123456' })).statusCode).toBe(401);
    }
    const envois = await alertes();
    expect(envois.map((e) => e.to_address).sort()).toEqual([CONTACT, 'adm3@exemple.test'].sort());
    const { subject, body } = envois[0]!;
    expect(subject).toContain('Compte verrouillé');
    expect(subject).toContain(cible.username);
    expect(body).toContain(cible.username);
    expect(body).toContain(`Nom ${cible.username}`);
    expect(body).toMatch(/second facteur/i);
    expect(body).toMatch(/5/);
    expect(body).toMatch(/incident de sécurité/);
    expect(body).toContain('https://suivi.test/');
    expect(body).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // aucune adresse IP
    expect(body).not.toContain('123456'); // aucun code saisi
    expect(subject + body).not.toMatch(/[\r]/);
    const audit = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='auth.account_locked' AND target=$1",
      [cible.username],
    );
    expect(audit!.n).toBe(1);
  });

  it('couvre la vérification du mot de passe actuel (changement de mot de passe, S-07)', async () => {
    const cible = await compte();
    const a = await login(t, cible);
    for (let i = 0; i < 5; i++) {
      t.svc.limits.motDePasseByUser.reset();
      await a.post('/api/account/password', { current: 'mauvais', next: 'Nouveau-mot-de-passe-2026!' });
    }
    expect(await adresses()).toContain(CONTACT);
  });

  it('ignore les administrateurs désactivés et les réglages personnels de courriel', async () => {
    const actif = await avecCourriel('verrou-adm-actif', 'admin', 'actif@exemple.test');
    await avecCourriel('verrou-adm-off', 'admin', 'desactive@exemple.test', { disabled: true });
    await t.svc.db.q(
      "INSERT INTO notification_reglages(portee_kind, portee_id, type, canal, valeur, updated_by) SELECT 'utilisateur', $1, t, 'courriel', false, 'test' FROM unnest(ARRAY['task_due','risk_review','rapprochement','compte_verrouille']) t",
      [actif.id],
    );
    await verrouillerParMotDePasse(await compte());
    const envois = await adresses();
    expect(envois).toContain('actif@exemple.test');
    expect(envois).not.toContain('desactive@exemple.test');
  });

  it('prévient quand même l’administrateur verrouillé, et n’atteint pas les comptes qui ne sont pas administrateurs', async () => {
    const seul = await avecCourriel('verrou-adm-seul', 'admin', 'seul@exemple.test');
    await avecCourriel('verrou-contrib', 'rw', 'contrib@exemple.test');
    await verrouillerParMotDePasse(seul);
    const envois = await adresses();
    expect(envois).toContain('seul@exemple.test');
    expect(envois).toContain(CONTACT);
    expect(envois).not.toContain('contrib@exemple.test');
  });

  it('atteint les administrateurs par un groupe', async () => {
    const membre = await avecCourriel('verrou-adm-groupe', null, 'groupe@exemple.test');
    const g = await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Admins L7') RETURNING id");
    await t.svc.db.q('INSERT INTO group_roles(group_id, role_id) VALUES ($1, $2)', [g!.id, 'administrateur']);
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [membre.id, g!.id]);
    await verrouillerParMotDePasse(await compte());
    expect(await adresses()).toContain('groupe@exemple.test');
  });

  it('ne met rien en file si le courriel n’est pas configuré, mais le journal garde l’événement', async () => {
    await configurer({ actif: false });
    const cible = await compte();
    await verrouillerParMotDePasse(cible);
    expect(await alertes()).toHaveLength(0);
    const audit = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='auth.account_locked' AND target=$1",
      [cible.username],
    );
    expect(audit!.n).toBe(1);
  });

  it('un échec d’envoi ne casse pas la réponse de connexion', async () => {
    const reel = t.svc.alertesSecurite.verrouillage.bind(t.svc.alertesSecurite);
    t.svc.alertesSecurite.verrouillage = () => Promise.reject(new Error('panne simulée'));
    try {
      const codes = await verrouillerParMotDePasse(await compte());
      expect(codes).toEqual([401, 401, 401, 401, 401]);
    } finally {
      t.svc.alertesSecurite.verrouillage = reel;
    }
  });
});
