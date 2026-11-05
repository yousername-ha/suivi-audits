/* Une clé de sécurité suspendue reste un facteur enregistré : elle n'abaisse jamais l'assurance exigée (ADR 0079 §8).
   Données fictives uniquement. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthentificateurLogiciel } from './authentificateur-logiciel.js';
import { Agent, ORIGIN, PASSWORD, createTestApp, makeUser, type TestApp, type TestUser } from './helpers.js';

type J = Parameters<AuthentificateurLogiciel['authentification']>[0];

describe('clé suspendue, double authentification facultative', () => {
  let t: TestApp, v: TestUser, vide: TestUser;
  const cle = (o = {}) => new AuthentificateurLogiciel({ origin: ORIGIN, rpId: 'suivi.test', ...o });
  const reset = () => {
    for (const l of [
      t.svc.limits.loginByIp,
      t.svc.limits.loginByUser,
      t.svc.limits.mfaBySession,
      t.svc.limits.mfaByUser,
      t.svc.limits.webauthnBySession,
      t.svc.limits.webauthnByUser,
      t.svc.limits.webauthnGestionByUser,
      t.svc.limits.motDePasseByUser,
    ])
      l.reset();
  };
  const motDePasse = async (u: TestUser) => {
    reset();
    const a = new Agent(t);
    const r = await a.post('/api/auth/login', { username: u.username, password: PASSWORD });
    expect(r.statusCode, r.body).toBe(200);
    await a.me();
    return a;
  };
  const parCle = async (a: Agent, k: AuthentificateurLogiciel, d = {}) => {
    const o = await a.post('/api/auth/webauthn/options');
    if (o.statusCode !== 200) return o;
    const r = await a.post('/api/auth/webauthn', { response: k.authentification(o.json() as J, d) });
    await a.me();
    return r;
  };

  beforeAll(async () => {
    t = await createTestApp({ MFA_REQUIRED: 'false' });
    v = await makeUser(t, 'cs_titulaire', 'rw', { totp: false });
    vide = await makeUser(t, 'cs_sans_facteur', 'rw', { totp: false });
  });
  afterAll(() => t.close());

  it('la seule clé suspendue laisse le compte à l’étape « mfa » et refuse la ré-authentification par mot de passe', async () => {
    const k = cle({ compteur: 10 });
    const s0 = await motDePasse(v);
    expect((await s0.post('/api/account/reauth', { password: PASSWORD })).statusCode).toBe(200);
    const o = await s0.post('/api/account/webauthn/options');
    const e = await s0.post('/api/account/webauthn', { response: k.enrolement(o.json()), label: 'Clé fictive' });
    expect(e.statusCode, e.body).toBe(201);

    // Témoin : clé utilisable, connexion par mot de passe seul → second facteur exigé.
    const b = await motDePasse(v);
    expect((await b.me()).stage).toBe('mfa');
    expect((await parCle(b, k)).statusCode).toBe(200);

    // Compteur qui ne progresse pas : la clé est suspendue.
    const c = await motDePasse(v);
    reset();
    const refus = await parCle(c, k, { compteur: 11 });
    expect(refus.statusCode).toBeGreaterThanOrEqual(400);
    const susp = await t.svc.db.one<{ suspect_at: Date | null }>(
      'SELECT suspect_at FROM webauthn_credentials WHERE credential_id=$1',
      [k.id],
    );
    expect(susp!.suspect_at).not.toBeNull();

    reset();
    expect((await c.me()).stage).toBe('mfa');
    expect((await c.get('/api/grc/smsis')).statusCode).not.toBe(200);
    const reauth = await c.post('/api/account/reauth', { password: PASSWORD });
    expect(reauth.statusCode).toBeGreaterThanOrEqual(400);

    // Une nouvelle connexion par mot de passe ne donne pas accès non plus, et ne permet pas d'inscrire une autre clé.
    const frais = await motDePasse(v);
    expect((await frais.me()).stage).toBe('mfa');
    expect((await frais.get('/api/grc/smsis')).statusCode).not.toBe(200);
    reset();
    const o2 = await frais.post('/api/account/webauthn/options');
    expect(o2.statusCode).toBeGreaterThanOrEqual(400);
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int AS n FROM webauthn_credentials WHERE user_id=$1 AND revoked_at IS NULL',
      [v.id],
    );
    expect(n!.n).toBe(1);
  });

  it('témoin : un compte sans aucun facteur se connecte et s’inscrit par mot de passe seul', async () => {
    const a = await motDePasse(vide);
    expect((await a.me()).stage).toBe('ok');
    expect((await a.post('/api/account/reauth', { password: PASSWORD })).statusCode).toBe(200);
    const o = await a.post('/api/account/webauthn/options');
    expect(o.statusCode, o.body).toBe(200);
  });
});
