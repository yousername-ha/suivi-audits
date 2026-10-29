/* Authentification : essais du second facteur et vérifications du mot de passe limités par compte, comptés dans le
   verrouillage progressif existant (colonnes failed_logins et locked_until) ; sessions incomplètes plafonnées. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Agent, createTestApp, login, makeUser, nextCode, PASSWORD, type TestApp, type TestUser } from './helpers.js';

let t: TestApp;
let n = 0;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => {
  t.svc.limits.loginByIp.reset();
  t.svc.limits.loginByUser.reset();
  t.svc.limits.mfaBySession.reset();
  t.svc.limits.mfaByUser.reset();
  t.svc.limits.motDePasseByUser.reset();
});

const compte = (role = 'rw', o: { totp?: boolean } = {}) => makeUser(t, `limite-${++n}`, role, o);
const etat = (u: TestUser) =>
  t.svc.db.one<{ failed_logins: number; locked_until: Date | null }>(
    'SELECT failed_logins, locked_until FROM users WHERE id=$1',
    [u.id],
  );
const remettreAZero = () => {
  t.svc.limits.loginByIp.reset();
  t.svc.limits.loginByUser.reset();
};
/** Connexion par mot de passe seul : session à l'étape du second facteur. */
const ouvrir = async (u: TestUser) => {
  remettreAZero();
  const a = new Agent(t);
  const r = await a.post('/api/auth/login', { username: u.username, password: PASSWORD });
  expect(r.statusCode, r.body).toBe(200);
  await a.me();
  return a;
};
const effacerEchecs = (u: TestUser) =>
  t.svc.db.q('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1', [u.id]);

describe('second facteur : essais limités par compte', () => {
  it('refuse le onzième essai en 15 minutes pour un même compte, même avec un code juste et une session neuve', async () => {
    const u = await compte();
    for (let i = 0; i < 10; i++) {
      await effacerEchecs(u); // isole le limiteur du compteur persistant
      const a = await ouvrir(u);
      expect((await a.post('/api/auth/mfa', { code: '000000' })).statusCode).toBe(401);
    }
    await effacerEchecs(u);
    const a = await ouvrir(u);
    const r = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
    expect(r.statusCode).toBe(429);
  });

  it('compte les codes refusés dans le verrouillage et verrouille au seuil', async () => {
    const u = await compte();
    const a = await ouvrir(u);
    for (let i = 0; i < 5; i++) {
      t.svc.limits.mfaByUser.reset();
      expect((await a.post('/api/auth/mfa', { code: '000000' })).statusCode).toBe(401);
    }
    expect((await etat(u))!.failed_logins).toBe(5);
    expect((await etat(u))!.locked_until).not.toBeNull();
    // Connexion par mot de passe refusée.
    remettreAZero();
    const b = new Agent(t);
    expect((await b.post('/api/auth/login', { username: u.username, password: PASSWORD })).statusCode).toBe(401);
    // Session ouverte avant le verrou : refusée et détruite, même avec un code juste.
    t.svc.limits.mfaByUser.reset();
    const r = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
    expect(r.statusCode).toBe(401);
    const restantes = await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM sessions WHERE user_id=$1', [
      u.id,
    ]);
    expect(restantes!.n).toBe(0);
  });

  it('remet les échecs à zéro au succès du second facteur', async () => {
    const u = await compte();
    const a = await ouvrir(u);
    expect((await a.post('/api/auth/mfa', { code: '000000' })).statusCode).toBe(401);
    expect((await a.post('/api/auth/mfa', { code: '111111' })).statusCode).toBe(401);
    expect((await etat(u))!.failed_logins).toBe(2);
    const r = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
    expect(r.statusCode, r.body).toBe(200);
    expect((await etat(u))!.failed_logins).toBe(0);
  });

  it('un mot de passe correct ne remet pas les échecs à zéro quand le second facteur est actif', async () => {
    const u = await compte();
    await t.svc.db.q('UPDATE users SET failed_logins=3 WHERE id=$1', [u.id]);
    await ouvrir(u);
    expect((await etat(u))!.failed_logins).toBe(3);
  });

  it('un mot de passe correct remet les échecs à zéro pour un compte sans second facteur actif', async () => {
    const u = await compte('rw', { totp: false });
    await t.svc.db.q('UPDATE users SET failed_logins=3 WHERE id=$1', [u.id]);
    await ouvrir(u);
    expect((await etat(u))!.failed_logins).toBe(0);
  });

  it('plafonne à trois les sessions incomplètes d’un compte', async () => {
    const u = await compte();
    for (let i = 0; i < 5; i++) await ouvrir(u);
    const r = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int AS n FROM sessions WHERE user_id=$1 AND mfa_ok=false',
      [u.id],
    );
    expect(r!.n).toBe(3);
  });

  it('ne gêne pas une connexion complète depuis deux onglets', async () => {
    const u = await compte();
    const a = await ouvrir(u);
    const b = await ouvrir(u);
    expect((await a.post('/api/auth/mfa', { code: await nextCode(t, u) })).statusCode).toBe(200);
    t.svc.limits.mfaByUser.reset();
    expect((await b.post('/api/auth/mfa', { code: await nextCode(t, u) })).statusCode).toBe(200);
  });
});

describe('verrouillage : compteur atomique', () => {
  it('compte chaque mot de passe faux, y compris pour des essais simultanés', async () => {
    const u = await compte();
    remettreAZero();
    const agents = Array.from({ length: 5 }, () => new Agent(t));
    await Promise.all(
      agents.map((a) => a.post('/api/auth/login', { username: u.username, password: 'mauvais-mot-de-passe' })),
    );
    expect((await etat(u))!.failed_logins).toBe(5);
  });
});

describe('vérification du mot de passe actuel : essais limités par compte', () => {
  it('limite le changement de mot de passe, compte les échecs et les journalise', async () => {
    const u = await compte();
    const a = await login(t, u);
    t.svc.limits.motDePasseByUser.reset();
    let dernier = 0;
    for (let i = 0; i < 6; i++)
      dernier = (await a.post('/api/account/password', { current: 'faux', next: 'Un-Autre-Mot-De-Passe-2026!' }))
        .statusCode;
    expect(dernier).toBe(429);
    expect((await etat(u))!.failed_logins).toBe(5);
    const j = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='account.password_failed' AND username=$1",
      [u.username],
    );
    expect(j!.n).toBe(5);
  });

  it('limite le début d’enrôlement du second facteur', async () => {
    const u = await compte();
    const a = await login(t, u);
    t.svc.limits.motDePasseByUser.reset();
    let dernier = 0;
    for (let i = 0; i < 6; i++) dernier = (await a.post('/api/account/totp/begin', { password: 'faux' })).statusCode;
    expect(dernier).toBe(429);
    expect((await etat(u))!.failed_logins).toBe(5);
    const j = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='account.password_failed' AND username=$1",
      [u.username],
    );
    expect(j!.n).toBe(5);
  });
});

describe('désactivation du second facteur : mot de passe limité par compte', () => {
  let t2: TestApp;
  beforeAll(async () => {
    t2 = await createTestApp({ MFA_REQUIRED: 'false' });
  });
  afterAll(() => t2.close());

  it('limite, compte et journalise les mots de passe faux', async () => {
    const u = await makeUser(t2, 'desactiver', 'rw');
    const a = await login(t2, u);
    t2.svc.limits.motDePasseByUser.reset();
    let dernier = 0;
    for (let i = 0; i < 6; i++) dernier = (await a.post('/api/account/totp/disable', { password: 'faux' })).statusCode;
    expect(dernier).toBe(429);
    const e = await t2.svc.db.one<{ failed_logins: number }>('SELECT failed_logins FROM users WHERE id=$1', [u.id]);
    expect(e!.failed_logins).toBe(5);
    const j = await t2.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='account.password_failed' AND username=$1",
      [u.username],
    );
    expect(j!.n).toBe(5);
  });
});
