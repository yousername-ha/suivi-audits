/* Clés de sécurité FIDO2 / WebAuthn (ADR 0079) : configuration de la relying party, enrôlement, connexion, compteur de
   signature, ré-authentification, révocation, codes de récupération, administration et politique. Les réponses viennent d'un
   authentificateur logiciel (test/authentificateur-logiciel.ts) ; la vérification est celle de l'application. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configWebauthn } from '../src/config.js';
import { AuthentificateurLogiciel, chaineAttestation } from './authentificateur-logiciel.js';
import {
  Agent,
  ORIGIN,
  PASSWORD,
  createTestApp,
  login,
  makeUser,
  nextCode,
  type TestApp,
  type TestUser,
} from './helpers.js';

const RP_ID = 'suivi.test';
type Json = Record<string, unknown> & {
  challenge: string;
  rp: { id: string };
  rpId: string;
  allowCredentials: { id: string }[];
  excludeCredentials: { id: string }[];
};
const cle = (o: Partial<ConstructorParameters<typeof AuthentificateurLogiciel>[0]> = {}) =>
  new AuthentificateurLogiciel({ origin: ORIGIN, rpId: RP_ID, ...o });

/** Mot de passe seul : la session attend le second facteur. */
async function motDePasse(t: TestApp, u: TestUser): Promise<Agent> {
  const a = new Agent(t);
  const r = await a.post('/api/auth/login', { username: u.username, password: PASSWORD });
  expect(r.statusCode).toBe(200);
  await a.me();
  t.svc.limits.loginByIp.reset();
  t.svc.limits.loginByUser.reset();
  return a;
}
function remettreLimites(t: TestApp) {
  for (const l of [
    t.svc.limits.mfaBySession,
    t.svc.limits.mfaByUser,
    t.svc.limits.webauthnBySession,
    t.svc.limits.webauthnByUser,
    t.svc.limits.webauthnGestionByUser,
    t.svc.limits.motDePasseByUser,
    t.svc.limits.codeRecuperationByUser,
  ])
    l.reset();
}
/** Enrôle la clé k sur la session a (ré-authentification récente déjà acquise). */
async function enroler(a: Agent, k: AuthentificateurLogiciel, label = 'Clé principale', d = {}) {
  const o = await a.post('/api/account/webauthn/options');
  expect(o.statusCode, o.body).toBe(200);
  return a.post('/api/account/webauthn', { response: k.enrolement(o.json() as Json, d), label });
}
/** Second facteur par clé, depuis une session à l'étape « mfa ». */
async function parCle(a: Agent, k: AuthentificateurLogiciel, d = {}) {
  const o = await a.post('/api/auth/webauthn/options');
  expect(o.statusCode, o.body).toBe(200);
  const r = await a.post('/api/auth/webauthn', { response: k.authentification(o.json() as Json, d) });
  if (r.statusCode === 200) await a.me();
  return r;
}
const audit = (t: TestApp, action: string, username: string) =>
  t.svc.db.q<{ details: Record<string, unknown>; ip: string | null }>(
    'SELECT details, ip::text AS ip FROM audit_log WHERE action=$1 AND username=$2 ORDER BY id',
    [action, username],
  );
const echecs = async (t: TestApp, u: TestUser) =>
  (await t.svc.db.one<{ n: number }>('SELECT failed_logins AS n FROM users WHERE id=$1', [u.id]))!.n;

describe('configuration de la relying party (RP_ID, RP_ORIGINS)', () => {
  it('déduite de l’adresse du site par défaut', () => {
    const c = configWebauthn({}, 'https://suivi.example.org', 'Suivi');
    expect(c).toMatchObject({
      disponible: true,
      rpId: 'suivi.example.org',
      origines: ['https://suivi.example.org'],
      source: 'adresse_site',
      rpName: 'Suivi',
    });
  });
  it('adresse IP ou HTTP déduites : clés désactivées, démarrage maintenu', () => {
    expect(configWebauthn({ NODE_ENV: 'production' }, 'https://192.0.2.10', 'S').disponible).toBe(false);
    expect(configWebauthn({ NODE_ENV: 'production' }, 'http://suivi.example.org', 'S').disponible).toBe(false);
    expect(configWebauthn({}, '', 'S')).toMatchObject({ disponible: false, source: 'aucune' });
  });
  it('configuration explicite incohérente : démarrage refusé (fail closed)', () => {
    const env = { NODE_ENV: 'production' };
    expect(() => configWebauthn({ ...env, RP_ID: '192.0.2.10' }, '', 'S')).toThrow(/RP_ID/);
    expect(() => configWebauthn({ ...env, RP_ID: 'Suivi.Example.org' }, '', 'S')).toThrow(/RP_ID/);
    expect(() =>
      configWebauthn({ ...env, RP_ID: 'example.org', RP_ORIGINS: 'http://suivi.example.org' }, '', 'S'),
    ).toThrow(/HTTPS/);
    expect(() =>
      configWebauthn({ ...env, RP_ID: 'example.org', RP_ORIGINS: 'https://suivi.autre.org' }, '', 'S'),
    ).toThrow(/hors du domaine/);
    expect(() =>
      configWebauthn({ ...env, RP_ID: 'example.org', RP_ORIGINS: 'https://example.org/app' }, '', 'S'),
    ).toThrow(/sans chemin/);
    expect(() => configWebauthn({ ...env, RP_ID: 'localhost', RP_ORIGINS: 'http://localhost:5173' }, '', 'S')).toThrow(
      /HTTPS obligatoire en production/,
    );
  });
  it('liste stricte d’origines, sous-domaines du RP ID, localhost en HTTP hors production', () => {
    const c = configWebauthn(
      { RP_ID: 'example.org', RP_ORIGINS: 'https://suivi.example.org, https://example.org', RP_NAME: 'Organisation' },
      'https://suivi.example.org',
      'Suivi',
    );
    expect(c).toMatchObject({
      disponible: true,
      rpId: 'example.org',
      rpName: 'Organisation',
      origines: ['https://suivi.example.org', 'https://example.org'],
      source: 'env',
    });
    expect(configWebauthn({ RP_ID: 'localhost', RP_ORIGINS: 'http://localhost:5173' }, '', 'S').disponible).toBe(true);
  });
});

describe('clés de sécurité : enrôlement et connexion', () => {
  let t: TestApp;
  let u: TestUser, admin: TestUser;
  beforeAll(async () => {
    t = await createTestApp();
    u = await makeUser(t, 'porteur', 'rw');
    admin = await makeUser(t, 'admin', 'admin');
  });
  afterAll(() => t.close());

  it('annonce les clés et ne change rien pour un compte sans clé (mot de passe puis TOTP)', async () => {
    const a = await motDePasse(t, u);
    const me = await a.me();
    expect(me.stage).toBe('mfa');
    expect((me as unknown as { webauthn: boolean }).webauthn).toBe(true);
    expect((await a.post('/api/auth/webauthn/options')).statusCode).toBe(409);
    // À l'étape du second facteur : ni ré-authentification, ni enrôlement, ni codes de récupération.
    expect((await a.post('/api/account/reauth', { password: PASSWORD, code: '000000' })).statusCode).toBe(403);
    expect((await a.post('/api/account/webauthn/options')).statusCode).toBe(403);
    expect((await a.post('/api/account/recovery-codes')).statusCode).toBe(403);
    expect((await a.get('/api/account/factors')).statusCode).toBe(403);
    const r = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
    expect(r.json()).toEqual({ stage: 'ok' });
    const me2 = (await a.me()) as unknown as { user: { cles: number } };
    expect(me2.user.cles).toBe(0);
    expect((await audit(t, 'auth.login', u.username)).rows.at(-1)!.details).toEqual({ facteur: 'totp' });
  });

  it('enrôlement : options conformes, clé enregistrée, journalisée sans secret', async () => {
    remettreLimites(t);
    const a = await login(t, u);
    const o = (await a.post('/api/account/webauthn/options')).json() as Json & {
      user: { id: string; name: string };
      pubKeyCredParams: { alg: number }[];
      authenticatorSelection: Record<string, unknown>;
      attestation: string;
      timeout: number;
    };
    expect(o.rp.id).toBe(RP_ID);
    expect(o.pubKeyCredParams.map((p) => p.alg)).toEqual([-8, -7, -257]);
    expect(o.authenticatorSelection).toMatchObject({ residentKey: 'preferred', userVerification: 'required' });
    expect(o.attestation).toBe('none');
    expect(o.timeout).toBeLessThanOrEqual(300_000);
    expect(o.user.name).toBe('porteur');
    expect(Buffer.from(o.user.id, 'base64url')).toHaveLength(32);
    expect(Buffer.from(o.user.id, 'base64url').toString('hex')).not.toContain(u.id.replace(/-/g, ''));
    const k = cle();
    const r = await a.post('/api/account/webauthn', { response: k.enrolement(o), label: 'YubiKey bureau' });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ cle: { label: 'YubiKey bureau', deviceType: 'singleDevice', suspect: false } });
    const ev = (await audit(t, 'account.webauthn_enrolled', u.username)).rows;
    expect(ev).toHaveLength(1);
    expect(ev[0]!.details).toMatchObject({ resultat: 'succes', cle: k.id.slice(0, 8) + '…', ua: expect.any(String) });
    // Ni challenge ni identifiant complet dans le journal.
    const tout = JSON.stringify((await t.svc.db.q('SELECT details FROM audit_log')).rows);
    expect(tout).not.toContain(o.challenge);
    expect(tout).not.toContain(k.id);
    // Le challenge est consommé : la même réponse rejouée est refusée.
    const rejeu = await a.post('/api/account/webauthn', { response: k.enrolement(o), label: 'Encore' });
    expect(rejeu.statusCode).toBe(400);
    expect(rejeu.json().reason).toBe('challenge');
  });

  it('double enrôlement empêché (excludeCredentials, puis refus explicite)', async () => {
    remettreLimites(t);
    const a = await login(t, u);
    const k = cle();
    expect((await enroler(a, k, 'Première')).statusCode).toBe(201);
    const o = (await a.post('/api/account/webauthn/options')).json() as Json;
    expect(o.excludeCredentials.map((c) => c.id)).toContain(k.id);
    const r = await a.post('/api/account/webauthn', { response: k.enrolement(o), label: 'Doublon' });
    expect(r.statusCode).toBe(409);
    expect(r.json().reason).toBe('doublon');
  });

  it('enrôlement refusé : origine, RP ID, UV absent, challenge expiré', async () => {
    remettreLimites(t);
    const a = await login(t, u);
    for (const d of [{ origin: 'https://pirate.test' }, { rpId: 'pirate.test' }, { uv: false }]) {
      const r = await enroler(a, cle(), 'Refusée', d);
      expect(r.statusCode, JSON.stringify(d)).toBe(400);
      expect(r.json().reason).toBe('verification');
    }
    const o = (await a.post('/api/account/webauthn/options')).json() as Json;
    await t.svc.db.q("UPDATE webauthn_challenges SET expires_at = now() - interval '1 second'");
    const r = await a.post('/api/account/webauthn', { response: cle().enrolement(o), label: 'Tardive' });
    expect(r.statusCode).toBe(400);
    expect(r.json().reason).toBe('challenge');
    expect((await audit(t, 'account.webauthn_enrolement_refuse', u.username)).rows.length).toBeGreaterThanOrEqual(4);
  });

  it('enrôlement : ré-authentification récente exigée (mot de passe et TOTP ou clé)', async () => {
    remettreLimites(t);
    const a = await login(t, u);
    await t.svc.db.q("UPDATE sessions SET reauth_at = now() - interval '6 minutes' WHERE user_id=$1", [u.id]);
    const r = await a.post('/api/account/webauthn/options');
    expect(r.statusCode).toBe(403);
    expect(r.json().reason).toBe('reauth');
    // Mot de passe faux : refusé et compté.
    expect((await a.post('/api/account/reauth', { password: 'faux', code: '000000' })).statusCode).toBe(401);
    // Les deux facteurs, ou aucun : refusé à la validation.
    expect((await a.post('/api/account/reauth', { password: PASSWORD })).statusCode).toBe(400);
    expect((await a.post('/api/account/reauth', { password: PASSWORD, code: '123456', response: {} })).statusCode).toBe(
      422,
    );
    const ok = await a.post('/api/account/reauth', { password: PASSWORD, code: await nextCode(t, u) });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await a.post('/api/account/webauthn/options')).statusCode).toBe(200);
    expect((await audit(t, 'account.reauth', u.username)).rows.at(-1)!.details).toMatchObject({ facteur: 'totp' });
  });

  it('connexion par clé : seconde étape, allowCredentials limité, rotation de la session', async () => {
    remettreLimites(t);
    const v = await makeUser(t, 'cle-connexion', 'rw');
    const a0 = await login(t, v);
    const k1 = cle(),
      k2 = cle();
    expect((await enroler(a0, k1, 'Clé 1')).statusCode).toBe(201);
    expect((await enroler(a0, k2, 'Clé 2')).statusCode).toBe(201);
    const id2 = (await a0.get('/api/account/factors'))
      .json()
      .cles.find((c: { label: string }) => c.label === 'Clé 2').id;
    expect((await a0.del(`/api/account/webauthn/${id2}`)).statusCode).toBe(204);

    const a = await motDePasse(t, v);
    expect((await a.me()).stage).toBe('mfa');
    const avant = [...a.cookies.values()].join();
    const o = (await a.post('/api/auth/webauthn/options')).json() as Json;
    expect(o.allowCredentials.map((c) => c.id)).toEqual([k1.id]);
    expect(o).toMatchObject({ rpId: RP_ID, userVerification: 'required' });
    const r = await a.post('/api/auth/webauthn', { response: k1.authentification(o) });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ stage: 'ok' });
    expect([...a.cookies.values()].join()).not.toBe(avant);
    expect((await a.me()).stage).toBe('ok');
    expect((await audit(t, 'auth.login', v.username)).rows.at(-1)!.details).toEqual({ facteur: 'webauthn' });
    const ok = (await audit(t, 'auth.webauthn_succes', v.username)).rows.at(-1)!;
    expect(ok.details).toMatchObject({ resultat: 'succes', cle: k1.id.slice(0, 8) + '…', aaguid: expect.any(String) });
    expect(ok.ip).toBeTruthy();

    // Clé révoquée : refusée même si le navigateur la présente.
    const b = await motDePasse(t, v);
    const r2 = await parCle(b, k2);
    expect(r2.statusCode).toBe(401);
    expect(r2.json().reason).toBe('revoquee');
  });

  it('connexion refusée : origine, rpIdHash, UV absent, challenge rejoué ou expiré, type, et chaque échec compte', async () => {
    remettreLimites(t);
    const v = await makeUser(t, 'cle-refus', 'rw');
    const k = cle();
    expect((await enroler(await login(t, v), k)).statusCode).toBe(201);
    const a = await motDePasse(t, v);
    const cas: [Record<string, unknown>, string][] = [
      [{ origin: 'https://pirate.test' }, 'verification'],
      [{ rpId: 'pirate.test' }, 'verification'],
      [{ uv: false }, 'verification'],
      [{ type: 'webauthn.create' }, 'verification'],
    ];
    for (const [d, motif] of cas) {
      remettreLimites(t);
      const r = await parCle(a, k, d);
      expect(r.statusCode, JSON.stringify(d)).toBe(401);
      expect(r.json().reason).toBe(motif);
    }
    expect(await echecs(t, v)).toBe(4);
    // Rejeu : la réponse valide d'un challenge déjà consommé (compteur d'échecs remis à zéro : sinon le compte se verrouille).
    await t.svc.db.q('UPDATE users SET failed_logins = 0 WHERE id=$1', [v.id]);
    remettreLimites(t);
    const o = (await a.post('/api/auth/webauthn/options')).json() as Json;
    const rep = k.authentification(o, { origin: 'https://pirate.test' });
    expect((await a.post('/api/auth/webauthn', { response: rep })).statusCode).toBe(401);
    const rejeu = await a.post('/api/auth/webauthn', { response: k.authentification(o) });
    expect(rejeu.statusCode).toBe(401);
    expect(rejeu.json().reason).toBe('challenge');
    // Expiré.
    const o2 = (await a.post('/api/auth/webauthn/options')).json() as Json;
    await t.svc.db.q("UPDATE webauthn_challenges SET expires_at = now() - interval '1 second'");
    const tard = await a.post('/api/auth/webauthn', { response: k.authentification(o2) });
    expect(tard.json().reason).toBe('challenge');
    // Challenge d'une autre session : inconnu de celle-ci.
    remettreLimites(t);
    const autre = await motDePasse(t, v);
    const o3 = (await autre.post('/api/auth/webauthn/options')).json() as Json;
    const croise = await a.post('/api/auth/webauthn', { response: k.authentification(o3) });
    expect(croise.json().reason).toBe('challenge');
    expect((await audit(t, 'auth.webauthn_failed', v.username)).rows.length).toBeGreaterThanOrEqual(5);
  });

  it('verrouillage : après le seuil, la clé valide ne suffit plus', async () => {
    remettreLimites(t);
    const v = await makeUser(t, 'cle-verrou', 'rw');
    const k = cle();
    expect((await enroler(await login(t, v), k)).statusCode).toBe(201);
    const a = await motDePasse(t, v);
    for (let i = 0; i < 5; i++) {
      remettreLimites(t);
      await parCle(a, k, { uv: false });
    }
    remettreLimites(t);
    t.svc.limits.loginByIp.reset();
    const b = new Agent(t);
    expect((await b.post('/api/auth/login', { username: v.username, password: PASSWORD })).statusCode).toBe(401);
  });

  it('compteur de signature régressif : refus, clé suspendue, alerte ; passkey synchronisée à 0 acceptée', async () => {
    remettreLimites(t);
    const v = await makeUser(t, 'cle-clone', 'rw');
    const k = cle({ compteur: 10 });
    expect((await enroler(await login(t, v), k)).statusCode).toBe(201);
    const a = await motDePasse(t, v);
    expect((await parCle(a, k)).statusCode).toBe(200); // 11
    const b = await motDePasse(t, v);
    const r = await parCle(b, k, { compteur: 11 }); // ne progresse pas
    expect(r.statusCode).toBe(401);
    expect(r.json().reason).toBe('compteur');
    const ligne = await t.svc.db.one<{ suspect_at: Date | null }>(
      'SELECT suspect_at FROM webauthn_credentials WHERE credential_id=$1',
      [k.id],
    );
    expect(ligne!.suspect_at).not.toBeNull();
    expect((await audit(t, 'auth.webauthn_compteur', v.username)).rows[0]!.details).toMatchObject({
      resultat: 'alerte',
      cle: k.id.slice(0, 8) + '…',
    });
    const alerte = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM grc_notifications WHERE kind='alerte_securite' AND user_id=$1 AND title LIKE 'Clé de sécurité suspendue%'",
      [admin.id],
    );
    expect(alerte!.n).toBe(1);
    // Suspendue : plus proposée ni acceptée, même avec un compteur correct.
    const c = await motDePasse(t, v);
    expect((await c.post('/api/auth/webauthn/options')).statusCode).toBe(409);

    // Passkey synchronisée : compteur toujours 0.
    const w = await makeUser(t, 'passkey-sync', 'rw');
    const p = cle({ compteur: null, synchronisee: true });
    const e = await enroler(await login(t, w), p);
    expect(e.json().cle).toMatchObject({ deviceType: 'multiDevice', backedUp: true });
    for (let i = 0; i < 3; i++) {
      remettreLimites(t);
      expect((await parCle(await motDePasse(t, w), p)).statusCode).toBe(200);
    }
  });

  it('codes de récupération : dix, usage unique, ré-authentification exigée', async () => {
    remettreLimites(t);
    const v = await makeUser(t, 'codes', 'rw');
    const a = await login(t, v);
    const r = await a.post('/api/account/recovery-codes');
    expect(r.statusCode).toBe(200);
    const codes = r.json().codes as string[];
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    // Empreintes seulement.
    const brut = JSON.stringify((await t.svc.db.q('SELECT * FROM recovery_codes')).rows);
    expect(brut).not.toContain(codes[0]!.replace(/-/g, ''));
    const b = await motDePasse(t, v);
    const ok = await b.post('/api/auth/recovery', { code: codes[0]!.toLowerCase().replace(/-/g, ' ') });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toEqual({ stage: 'ok' });
    remettreLimites(t);
    const c = await motDePasse(t, v);
    const rejeu = await c.post('/api/auth/recovery', { code: codes[0] });
    expect(rejeu.statusCode).toBe(401);
    expect((await a.get('/api/account/factors')).json().codesRestants).toBe(9);
    await t.svc.db.q("UPDATE sessions SET reauth_at = now() - interval '6 minutes' WHERE user_id=$1", [v.id]);
    expect((await a.post('/api/account/recovery-codes')).statusCode).toBe(403);
  });

  it('renommer et révoquer : ré-authentification pour révoquer, jamais le dernier facteur fort', async () => {
    remettreLimites(t);
    const t2 = await createTestApp({ MFA_REQUIRED: 'false' });
    try {
      await makeUser(t2, 'sans-totp', 'rw', { totp: false });
      const a = new Agent(t2);
      await a.post('/api/auth/login', { username: 'sans-totp', password: PASSWORD });
      expect((await a.me()).stage).toBe('ok');
      const k = cle();
      // Session ouverte sans second facteur : pas de ré-authentification récente ; le mot de passe seul y suffit.
      expect((await a.post('/api/account/webauthn/options')).json().reason).toBe('reauth');
      expect((await a.post('/api/account/reauth', { password: PASSWORD })).statusCode).toBe(200);
      expect((await enroler(a, k, 'Seule clé')).statusCode).toBe(201);
      // La session est régénérée avec le second facteur validé (nouveau jeton CSRF).
      expect((await a.me()).stage).toBe('ok');
      // Désormais, le mot de passe seul ne suffit plus pour se ré-authentifier.
      expect((await a.post('/api/account/reauth', { password: PASSWORD })).statusCode).toBe(400);
      const id = (await a.get('/api/account/factors')).json().cles[0].id;
      expect((await a.patch(`/api/account/webauthn/${id}`, { label: 'Clé renommée' })).statusCode).toBe(204);
      expect((await a.get('/api/account/factors')).json().cles[0].label).toBe('Clé renommée');
      // Une session complète exige désormais la clé ; la session courante reste ouverte.
      const r = await a.del(`/api/account/webauthn/${id}`);
      expect(r.statusCode).toBe(409);
      expect(r.json().reason).toBe('dernier_facteur');
      // Désactiver un TOTP absent n'a pas de sens ; le TOTP d'un compte sans clé ne peut pas être retiré.
      const w = await makeUser(t2, 'avec-totp', 'rw');
      const b = await login(t2, w);
      const d = await b.post('/api/account/totp/disable', { password: PASSWORD });
      expect(d.statusCode).toBe(409);
      expect(d.json().reason).toBe('dernier_facteur');
    } finally {
      await t2.close();
    }
    // Avec le TOTP, la dernière clé peut être révoquée (après ré-authentification).
    const v = await makeUser(t, 'revoque', 'rw');
    const a = await login(t, v);
    expect((await enroler(a, cle())).statusCode).toBe(201);
    const id = (await a.get('/api/account/factors')).json().cles[0].id;
    await t.svc.db.q("UPDATE sessions SET reauth_at = now() - interval '6 minutes' WHERE user_id=$1", [v.id]);
    expect((await a.del(`/api/account/webauthn/${id}`)).json().reason).toBe('reauth');
    await t.svc.db.q('UPDATE sessions SET reauth_at = now() WHERE user_id=$1', [v.id]);
    expect((await a.del(`/api/account/webauthn/${id}`)).statusCode).toBe(204);
    expect((await audit(t, 'account.webauthn_revoked', v.username)).rows).toHaveLength(1);
    expect((await a.get('/api/account/factors')).json().cles).toEqual([]);
  });

  it('un autre compte ne voit ni ne révoque mes clés', async () => {
    remettreLimites(t);
    const v = await makeUser(t, 'proprio', 'rw');
    const a = await login(t, v);
    expect((await enroler(a, cle())).statusCode).toBe(201);
    const id = (await a.get('/api/account/factors')).json().cles[0].id;
    const intrus = await login(t, await makeUser(t, 'intrus', 'rw'));
    expect((await intrus.patch(`/api/account/webauthn/${id}`, { label: 'Volée' })).statusCode).toBe(404);
    expect((await intrus.del(`/api/account/webauthn/${id}`)).statusCode).toBe(404);
    expect((await intrus.get(`/api/admin/users/${v.id}/factors`)).statusCode).toBe(403);
  });
});

describe('administration des facteurs et politique', () => {
  let t: TestApp;
  let admin: TestUser, chef: TestUser, u: TestUser;
  let ad: Agent;
  beforeAll(async () => {
    t = await createTestApp();
    admin = await makeUser(t, 'admin', 'admin');
    chef = await makeUser(t, 'chef', 'admin');
    u = await makeUser(t, 'agent', 'rw');
    ad = await login(t, admin);
  });
  afterAll(() => t.close());

  const politique = async (p: Record<string, unknown>) => {
    const g = await ad.get('/api/admin/webauthn/policy');
    const cur = g.json();
    return ad.req('PUT', '/api/admin/webauthn/policy', {
      json: { ...cur.politique, ...p },
      headers: { 'if-match': String(g.headers.etag) },
    });
  };

  it('facteurs d’un compte, révocation, réactivation et réinitialisation tracées avec motif', async () => {
    remettreLimites(t);
    const a = await login(t, u);
    const k1 = cle({ compteur: 3 }),
      k2 = cle();
    expect((await enroler(a, k1, 'K1')).statusCode).toBe(201);
    expect((await enroler(a, k2, 'K2')).statusCode).toBe(201);
    const f = (await ad.get(`/api/admin/users/${u.id}/factors`)).json();
    expect(f).toMatchObject({ totpEnabled: true, codesRestants: 0, obligatoire: false });
    expect(f.cles.map((c: { label: string }) => c.label)).toEqual(['K1', 'K2']);
    const [c1, c2] = f.cles as { id: string }[];
    // Motif obligatoire.
    expect((await ad.post(`/api/admin/users/${u.id}/webauthn/${c1!.id}/revoke`, { motif: '' })).statusCode).toBe(422);
    expect(
      (await ad.post(`/api/admin/users/${u.id}/webauthn/${c2!.id}/revoke`, { motif: 'Clé perdue (ticket 42)' }))
        .statusCode,
    ).toBe(204);
    expect((await audit(t, 'admin.user_webauthn_revoked', 'admin')).rows[0]!.details).toMatchObject({
      motif: 'Clé perdue (ticket 42)',
      cle: k2.id.slice(0, 8) + '…',
    });
    expect((await a.me()).stage).toBe('anon'); // sessions du compte fermées
    // Clé suspecte, puis réactivée par l'administrateur.
    await t.svc.db.q('UPDATE webauthn_credentials SET suspect_at = now() WHERE id=$1', [c1!.id]);
    expect(
      (await ad.post(`/api/admin/users/${u.id}/webauthn/${c1!.id}/reactivate`, { motif: 'Vérifiée avec le porteur' }))
        .statusCode,
    ).toBe(204);
    remettreLimites(t);
    expect((await parCle(await motDePasse(t, u), k1)).statusCode).toBe(200);
    // Réinitialisation : tout révoqué, ré-enrôlement imposé à la prochaine connexion.
    expect((await ad.post(`/api/admin/users/${u.id}/webauthn/reset`, { motif: 'Départ de poste' })).statusCode).toBe(
      204,
    );
    expect((await audit(t, 'admin.user_webauthn_reset', 'admin')).rows[0]!.details).toMatchObject({
      clesRevoquees: 1,
      motif: 'Départ de poste',
    });
    remettreLimites(t);
    const b = await motDePasse(t, u);
    const r = await b.post('/api/auth/mfa', { code: await nextCode(t, u) });
    expect(r.json()).toEqual({ stage: 'enroll_key' });
    await b.me();
    // À cette étape : l'enrôlement est ouvert, le reste de l'application non.
    expect((await b.get('/api/account/sessions')).statusCode).toBe(403);
    expect((await enroler(b, cle(), 'Nouvelle')).statusCode).toBe(201);
    expect((await b.me()).stage).toBe('ok');
    expect((await ad.get(`/api/admin/users/${u.id}/factors`)).json().reenrolement).toBe(false);
  });

  it('les droits d’administration sont exigés', async () => {
    const a = await login(t, await makeUser(t, 'lecteur', 'ro'));
    expect((await a.get('/api/admin/webauthn/policy')).statusCode).toBe(403);
    expect((await a.post(`/api/admin/users/${u.id}/webauthn/reset`, { motif: 'essai' })).statusCode).toBe(403);
  });

  it('politique : If-Match, journal, obligation des administrateurs avec période de grâce', async () => {
    remettreLimites(t);
    // L'administrateur qui active l'obligation sans délai a lui-même une clé (sinon il passe aussitôt à l'enrôlement).
    await t.svc.db.q('UPDATE sessions SET reauth_at = now() WHERE user_id=$1', [admin.id]);
    expect((await enroler(ad, cle(), 'Clé de l’administrateur')).statusCode).toBe(201);
    const g = await ad.get('/api/admin/webauthn/policy');
    expect(g.json()).toMatchObject({
      politique: { obligatoireAdmins: false, graceJours: 14, materielUniquement: false, passwordless: false },
      serveur: { disponible: true, rpId: RP_ID, origines: [ORIGIN], source: 'adresse_site' },
    });
    expect((await ad.req('PUT', '/api/admin/webauthn/policy', { json: g.json().politique })).statusCode).toBe(428);
    expect((await politique({ passwordless: true })).statusCode).toBe(422);
    expect((await politique({ materielUniquement: true, aaguidAutorises: [] })).statusCode).toBe(422);
    // Obligation avec 14 jours de grâce : échéance affichée, rien de bloqué.
    expect((await politique({ obligatoireAdmins: true, graceJours: 14 })).statusCode).toBe(204);
    const ev = (await audit(t, 'securite.webauthn_politique', 'admin')).rows.at(-1)!;
    expect(ev.details).toMatchObject({ avant: { obligatoireAdmins: false }, apres: { obligatoireAdmins: true } });
    const c = await login(t, chef);
    expect((await c.me()).stage).toBe('ok');
    const f = (await c.get('/api/account/factors')).json();
    expect(f.obligatoire).toBe(true);
    expect(new Date(f.echeance).getTime()).toBeGreaterThan(Date.now() + 13 * 86400e3);
    // Grâce échue : un administrateur sans clé doit en enrôler une ; un compte ordinaire n'est pas concerné.
    expect((await politique({ graceJours: 0 })).statusCode).toBe(204);
    expect((await c.me()).stage).toBe('enroll_key');
    remettreLimites(t);
    const autre = await login(t, await makeUser(t, 'ordinaire', 'rw'));
    expect((await autre.me()).stage).toBe('ok');
    expect((await enroler(c, cle(), 'Clé du chef')).statusCode).toBe(201);
    expect((await c.me()).stage).toBe('ok');
    // Connexion de cet administrateur par le TOTP (secours) : acceptée, tracée, alerte.
    remettreLimites(t);
    await login(t, chef);
    expect((await audit(t, 'auth.facteur_secours', 'chef')).rows.at(-1)!.details).toMatchObject({
      resultat: 'alerte',
      facteur: 'totp',
    });
    const n = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM grc_notifications WHERE kind='alerte_securite' AND title LIKE 'Connexion par facteur de secours%'",
    );
    expect(n!.n).toBeGreaterThan(0);
    // Dernière clé d'un administrateur obligé : révocation refusée.
    const id = (await c.get('/api/account/factors')).json().cles[0].id;
    await t.svc.db.q('UPDATE sessions SET reauth_at = now() WHERE user_id=$1', [chef.id]);
    const r = await c.del(`/api/account/webauthn/${id}`);
    expect(r.statusCode).toBe(409);
    expect(r.json().reason).toBe('cle_obligatoire');
    await politique({ obligatoireAdmins: false });
    expect((await ad.me()).stage).toBe('ok');
  });

  it('politique « clés matérielles uniquement » : attestation vérifiée jusqu’à une racine, AAGUID autorisé', async () => {
    remettreLimites(t);
    const aaguid = '2fc0579f-8113-47ea-b116-bb5a8db9202a';
    const att = chaineAttestation(aaguid);
    expect(
      (
        await politique({
          materielUniquement: true,
          aaguidAutorises: [aaguid],
          racinesSupplementaires: [att.racinePem],
        })
      ).statusCode,
    ).toBe(204);
    const v = await makeUser(t, 'materiel', 'rw');
    const a = await login(t, v);
    const o = (await a.post('/api/account/webauthn/options')).json() as Json & { attestation: string };
    expect(o.attestation).toBe('direct');
    // Attestation « none » ou auto-attestation : refus explicite.
    for (const fmt of ['none', 'packed-self'] as const) {
      const r = await enroler(a, cle({ aaguid }), 'Sans attestation', { fmt });
      expect(r.statusCode, fmt).toBe(422);
      expect(r.json().reason).toBe('materiel');
    }
    // Modèle hors liste blanche (attestation pourtant valide).
    const autre = chaineAttestation('cb69481e-8ff7-4039-93ec-0a2729a154a8');
    await politique({ racinesSupplementaires: [att.racinePem, autre.racinePem] });
    const r1 = await enroler(a, cle({ aaguid: autre.aaguid }), 'Hors liste', { fmt: 'packed', attestation: autre });
    expect(r1.statusCode).toBe(422);
    // Chaîne qui ne remonte à aucune racine connue.
    await politique({ racinesSupplementaires: [autre.racinePem] });
    const r2 = await enroler(a, cle({ aaguid }), 'Racine inconnue', { fmt: 'packed', attestation: att });
    expect(r2.statusCode).toBe(400);
    // Attestation complète, racine connue, modèle autorisé : acceptée.
    await politique({ racinesSupplementaires: [att.racinePem] });
    const ok = await enroler(a, cle({ aaguid }), 'YubiKey attestée', { fmt: 'packed', attestation: att });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json().cle.aaguid).toBe(aaguid);
    // Racine refusée si elle n'est pas une autorité.
    expect(
      (await politique({ racinesSupplementaires: ['-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'] }))
        .statusCode,
    ).toBe(422);
    await politique({ materielUniquement: false, aaguidAutorises: [], racinesSupplementaires: [] });
  });
});

describe('serveur sans configuration utilisable', () => {
  it('adresse IP : clés non proposées, connexion par TOTP inchangée', async () => {
    const t = await createTestApp({ PUBLIC_URL: 'https://192.0.2.10' });
    try {
      const u = await makeUser(t, 'ip', 'admin');
      const a = new Agent(t, 'https://192.0.2.10');
      await a.post('/api/auth/login', { username: 'ip', password: PASSWORD });
      const me = (await a.me()) as unknown as { webauthn: boolean; stage: string };
      expect(me.webauthn).toBe(false);
      expect((await a.post('/api/auth/webauthn/options')).statusCode).toBe(404);
      const r = await a.post('/api/auth/mfa', { code: await nextCode(t, u) });
      expect(r.json()).toEqual({ stage: 'ok' });
      expect(t.svc.webauthn.exigence({ admin: true, creeLe: new Date(0), reenrolement: true }).requise).toBe(false);
    } finally {
      await t.close();
    }
  });
});
