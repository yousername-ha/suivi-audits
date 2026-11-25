/* Connexion unique SAML 2.0 (ADR 0114 ; décisions du RSSI du 25/11/2026) : réponses d'un fournisseur fictif signées par la
   bibliothèque, sur PostgreSQL. Succès (Entra ID et Keycloak), refus (signature absente ou altérée, SHA-1, audience,
   destination, expiration, rejeu, InResponseTo inconnu ou consommé, IdP-initiated, double authentification absente, compte
   inconnu, désactivé ou local), compte « sso » refusé au mot de passe, dernier administrateur local, XML avec DTD ou
   entité, chemin de retour externe, exception d'origine limitée à l'adresse de retour, ré-authentification (ForceAuthn),
   métadonnées (validation du flux, lecture par l'exécutant, signature, entityID, certificat changé ou bientôt expiré). */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ECHEC_CONNEXION } from '../src/routes/auth.js';
import { EMPREINTE_SSO, retourInterne } from '../src/connexion-unique/index.js';
import { registerRoutes, route } from '../src/http/route.js';
import { Agent, ORIGIN, PASSWORD, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';
import {
  AMR,
  ENTITE_ENTRA,
  ENTITE_KEYCLOAK,
  MFA_ENTRA,
  MOT_DE_PASSE_ENTRA,
  lireDemande,
  metadonnees,
  nouvelIdp,
  reponse,
  type IdpFictif,
  type OptionsReponse,
} from './idp-fictif.js';

const SP = `${ORIGIN}/api/auth/sso/sp`;
const IDP_ORIGINE = 'https://login.example.org';
const idp = nouvelIdp();
const sp = nouvelIdp(3650);

let t: TestApp;
let admin: TestUser;
let a: Agent;
let entra: string;
let keycloak: string;

const corpsEntra = (o: Record<string, unknown> = {}) => ({
  type: 'entra',
  libelle: 'Entra ID (fictif)',
  actif: true,
  entityId: ENTITE_ENTRA,
  urlMetadonnees: null,
  autoriteTls: null,
  mfaSource: 'attribut',
  mfaAttribut: AMR,
  mfaValeurs: [MFA_ENTRA],
  rapprochement: 'nameid',
  rapprochementAttribut: '',
  ...o,
});
const corpsKeycloak = (o: Record<string, unknown> = {}) => ({
  type: 'keycloak',
  libelle: 'Keycloak (fictif)',
  actif: true,
  entityId: ENTITE_KEYCLOAK,
  urlMetadonnees: null,
  autoriteTls: null,
  mfaSource: 'authn_context',
  mfaAttribut: '',
  mfaValeurs: ['https://refeds.org/profile/mfa'],
  rapprochement: 'attribut',
  rapprochementAttribut: 'uid',
  ...o,
});

const acs = (id: string) => `${ORIGIN}/api/auth/sso/${id}/acs`;
const reinitialiserLimites = () => {
  t.svc.limits.ssoByIp.reset();
  t.svc.limits.loginByIp.reset();
  t.svc.limits.loginByUser.reset();
};

/** Départ vers le fournisseur : identifiant de la demande enregistrée. */
async function demande(fournisseur: string, retour = '/accueil'): Promise<string> {
  reinitialiserLimites();
  const r = await new Agent(t).get(`/api/auth/sso/${fournisseur}/connexion?retour=${encodeURIComponent(retour)}`);
  expect(r.statusCode, r.body).toBe(302);
  return lireDemande(String(r.headers.location)).id;
}

/** POST du formulaire HTTP-POST par le navigateur, depuis la page du fournisseur (autre origine), sans cookie. */
async function poster(fournisseur: string, b64: string, agent = new Agent(t, IDP_ORIGINE)) {
  reinitialiserLimites();
  return agent.req('POST', `/api/auth/sso/${fournisseur}/acs`, {
    body: `SAMLResponse=${encodeURIComponent(b64)}&RelayState=`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

const optsEntra = (inResponseTo: string | null, o: Partial<OptionsReponse> = {}): OptionsReponse => ({
  idp,
  issuer: ENTITE_ENTRA,
  acs: acs(entra),
  audience: SP,
  inResponseTo,
  nameId: 'alice@example.org',
  attributs: { [AMR]: [MOT_DE_PASSE_ENTRA, MFA_ENTRA] },
  ...o,
});
const optsKeycloak = (inResponseTo: string | null, o: Partial<OptionsReponse> = {}): OptionsReponse => ({
  idp,
  issuer: ENTITE_KEYCLOAK,
  acs: acs(keycloak),
  audience: SP,
  inResponseTo,
  nameId: 'G-00000000-fictif',
  attributs: { uid: ['bruno'] },
  contexte: 'https://refeds.org/profile/mfa',
  ...o,
});

async function dernierRefus(): Promise<{ motif: string; but: string | null } | undefined> {
  const r = await t.svc.db.q<{ details: { motif: string; but: string | null } }>(
    "SELECT details FROM audit_log WHERE action='auth.sso_refus' ORDER BY id DESC LIMIT 1",
  );
  return r.rows[0]?.details;
}
async function alertes(prefixe: string): Promise<number> {
  const r = await t.svc.db.q<{ n: number }>(
    "SELECT count(DISTINCT due_key)::int AS n FROM grc_notifications WHERE kind='alerte_securite' AND due_key LIKE $1",
    [`${prefixe}%`],
  );
  return r.rows[0]!.n;
}
async function creerCompteSso(username: string, fournisseur: string, identifiant: string, role = 'lecteur') {
  const r = await a.post('/api/admin/users', {
    username,
    roles: [{ roleId: role }],
    modeConnexion: 'sso',
    fournisseurId: fournisseur,
    identifiantExterne: identifiant,
  });
  expect(r.statusCode, r.body).toBe(201);
  expect(r.json().temporaryPassword).toBeNull();
  await t.svc.db.q(
    "INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ('00000000-0000-4000-8000-000000000001', $1, true) ON CONFLICT DO NOTHING",
    [r.json().id],
  );
  return r.json().id as string;
}

beforeAll(async () => {
  t = await createTestApp({ SAML_SP_KEY: sp.cle, SAML_SP_CERT: sp.certificat });
  admin = await makeUser(t, 'admin-local', 'admin');
  a = await login(t, admin);
  const e = await a.post('/api/admin/sso/fournisseurs', corpsEntra());
  expect(e.statusCode, e.body).toBe(201);
  entra = e.json().id;
  const im = await a.post(`/api/admin/sso/fournisseurs/${entra}/metadonnees`, {
    xml: metadonnees({ entityId: ENTITE_ENTRA, idp, signer: idp }),
  });
  expect(im.statusCode, im.body).toBe(200);
  expect(im.json()).toMatchObject({ pret: true, metadonnees: { source: 'import', signees: true } });
  const k = await a.post('/api/admin/sso/fournisseurs', corpsKeycloak());
  keycloak = k.json().id;
  expect(
    (
      await a.post(`/api/admin/sso/fournisseurs/${keycloak}/metadonnees`, {
        xml: metadonnees({ entityId: ENTITE_KEYCLOAK, idp }),
      })
    ).statusCode,
  ).toBe(200);
  await creerCompteSso('alice', entra, 'Alice@Example.org');
  await creerCompteSso('bruno', keycloak, 'bruno');
}, 120_000);
afterAll(async () => t?.close());

describe('connexion unique : succès', () => {
  it('Entra ID : demande signée (HTTP-Redirect), réponse vérifiée, session complète par cookie SameSite=Strict, redirection 303', async () => {
    const r0 = await new Agent(t).get(`/api/auth/sso/${entra}/connexion?retour=/accueil`);
    expect(r0.statusCode).toBe(302);
    const d = lireDemande(String(r0.headers.location));
    expect(d.url.origin + d.url.pathname).toBe('https://login.example.org/saml2');
    expect(d.url.searchParams.get('SigAlg')).toBe('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
    expect(d.url.searchParams.get('Signature')).toBeTruthy();
    expect(d.xml).toContain(`AssertionConsumerServiceURL="${acs(entra)}"`);
    expect(d.xml).not.toContain('ForceAuthn');
    // Entra ID : aucune classe de contexte demandée (sa preuve est le claim des méthodes).
    expect(d.xml).not.toContain('RequestedAuthnContext');
    const navigateur = new Agent(t, IDP_ORIGINE);
    const r = await poster(entra, reponse(optsEntra(d.id)), navigateur);
    expect(r.statusCode, r.body).toBe(303);
    expect(r.headers.location).toBe('/accueil');
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/^__Host-suivi_sid=.+; Path=\/; HttpOnly; SameSite=Strict; Secure/);
    // Navigation suivante : l'interface appelle /api/auth/me en même origine, le cookie l'accompagne.
    const me = await navigateur.me();
    expect(me.stage).toBe('ok');
    expect((me as unknown as { user: { username: string; sso: boolean } }).user).toMatchObject({
      username: 'alice',
      sso: true,
    });
    const s = await t.svc.db.q<{ par_sso: boolean; mfa_ok: boolean }>(
      "SELECT par_sso, mfa_ok FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.username='alice'",
    );
    expect(s.rows).toEqual([{ par_sso: true, mfa_ok: true }]);
    const j = await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='auth.sso_succes' AND username='alice'");
    expect(j.rowCount).toBe(1);
  });
  it('Keycloak : classe de contexte demandée et prouvée, rapprochement par attribut, réponse signée', async () => {
    const r0 = await new Agent(t).get(`/api/auth/sso/${keycloak}/connexion`);
    const d = lireDemande(String(r0.headers.location));
    expect(d.xml).toContain('RequestedAuthnContext');
    expect(d.xml).toContain('https://refeds.org/profile/mfa');
    const r = await poster(keycloak, reponse(optsKeycloak(d.id, { signer: 'reponse' })));
    expect(r.statusCode, r.body).toBe(303);
    expect(r.headers.location).toBe('/');
  });
  it('les boutons de la page de connexion ne listent que les fournisseurs actifs et prêts', async () => {
    const r = await new Agent(t).get('/api/auth/sso/fournisseurs');
    expect(
      r
        .json()
        .map((f: { libelle: string }) => f.libelle)
        .sort(),
    ).toEqual(['Entra ID (fictif)', 'Keycloak (fictif)']);
  });
});

describe('connexion unique : refus', () => {
  const refuse = async (b64: string, motif: string, fournisseur = entra, code = 'refus') => {
    const r = await poster(fournisseur, b64);
    expect(r.statusCode, r.body).toBe(303);
    expect(r.headers.location).toBe(`/login?sso=${code}`);
    expect(r.headers['set-cookie']).toBeUndefined();
    expect((await dernierRefus())?.motif).toBe(motif);
  };
  it('signature absente : refus et alerte de sécurité', async () => {
    const avant = await alertes('sso:refus_signature');
    await refuse(reponse(optsEntra(await demande(entra), { signer: 'aucune' })), 'signature');
    expect(await alertes('sso:refus_signature')).toBeGreaterThan(avant);
  });
  it('signature altérée (identité changée après la signature)', async () => {
    await refuse(
      reponse(optsEntra(await demande(entra), { alterer: ['alice@example.org', 'admin-local@example.org'] })),
      'signature',
    );
  });
  it('signature par un autre certificat que celui du fournisseur', async () => {
    await refuse(reponse(optsEntra(await demande(entra), { idp: nouvelIdp() })), 'signature');
  });
  it('SHA-1 refusé (signature et condensé)', async () => {
    await refuse(reponse(optsEntra(await demande(entra), { algo: 'sha1' })), 'algorithme');
  });
  it('mauvaise audience', async () => {
    await refuse(reponse(optsEntra(await demande(entra), { audience: 'https://autre.example.org/sp' })), 'audience');
  });
  it('Destination et Recipient différents de l’adresse de retour', async () => {
    await refuse(
      reponse(optsEntra(await demande(entra), { destination: 'https://autre.example.org/acs' })),
      'destination',
    );
    await refuse(reponse(optsEntra(await demande(entra), { destination: null })), 'destination');
    await refuse(
      reponse(optsEntra(await demande(entra), { recipient: 'https://autre.example.org/acs' })),
      'destination',
    );
  });
  it('assertion expirée (au-delà de la tolérance d’horloge)', async () => {
    await refuse(reponse(optsEntra(await demande(entra), { expireDans: -600 })), 'expiration', entra, 'expire');
  });
  it('réponse rejouée : la demande est à usage unique', async () => {
    const b64 = reponse(optsEntra(await demande(entra)));
    expect((await poster(entra, b64)).statusCode).toBe(303);
    await refuse(b64, 'requete_inconnue', entra, 'expire');
  });
  it('assertion rejouée sur une nouvelle demande : cache anti-rejeu', async () => {
    const assertionId = `_a${crypto.randomBytes(8).toString('hex')}`;
    expect((await poster(entra, reponse(optsEntra(await demande(entra), { assertionId })))).headers.location).toBe(
      '/accueil',
    );
    await refuse(reponse(optsEntra(await demande(entra), { assertionId })), 'rejeu', entra, 'expire');
  });
  it('InResponseTo inconnu, ou d’un autre fournisseur', async () => {
    await refuse(reponse(optsEntra('_inconnu0123456789')), 'requete_inconnue', entra, 'expire');
    await refuse(reponse(optsEntra(await demande(keycloak))), 'requete_inconnue', entra, 'expire');
  });
  it('IdP-initiated (sans InResponseTo) refusé', async () => {
    await refuse(reponse(optsEntra(null)), 'idp_initie');
  });
  it('Entra ID : double authentification absente (mot de passe seul) : refus et alerte', async () => {
    const avant = await alertes('sso:refus_mfa');
    await refuse(
      reponse(optsEntra(await demande(entra), { attributs: { [AMR]: [MOT_DE_PASSE_ENTRA] } })),
      'mfa_absente',
      entra,
      'mfa',
    );
    expect(await alertes('sso:refus_mfa')).toBeGreaterThan(avant);
  });
  it('Keycloak : classe de contexte sans double authentification', async () => {
    await refuse(
      reponse(
        optsKeycloak(await demande(keycloak), {
          contexte: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
        }),
      ),
      'mfa_absente',
      keycloak,
      'mfa',
    );
  });
  it('compte inconnu : aucune création à la volée', async () => {
    const n = await t.svc.db.q('SELECT 1 FROM users');
    await refuse(
      reponse(optsEntra(await demande(entra), { nameId: 'inconnu@example.org' })),
      'compte_inconnu',
      entra,
      'compte',
    );
    expect((await t.svc.db.q('SELECT 1 FROM users')).rowCount).toBe(n.rowCount);
  });
  it('compte désactivé', async () => {
    await creerCompteSso('chloe', entra, 'chloe@example.org');
    await t.svc.db.q("UPDATE users SET disabled=true WHERE username='chloe'");
    await refuse(
      reponse(optsEntra(await demande(entra), { nameId: 'chloe@example.org' })),
      'compte_desactive',
      entra,
      'compte',
    );
  });
  it('compte local tentant la connexion unique', async () => {
    await makeUser(t, 'denis', 'ro');
    await t.svc.db.q("UPDATE users SET email='denis@example.org' WHERE username='denis'");
    await refuse(
      reponse(optsEntra(await demande(entra), { nameId: 'denis@example.org' })),
      'compte_local',
      entra,
      'compte',
    );
  });
  it('fournisseur désactivé : refus, et il n’est plus proposé', async () => {
    const d = await demande(entra);
    const f = await a.get('/api/admin/sso');
    const version = f.json().fournisseurs.find((x: { id: string }) => x.id === entra).version;
    expect(
      (
        await a.put(`/api/admin/sso/fournisseurs/${entra}`, corpsEntra({ actif: false }), {
          'if-match': `"${version}"`,
        })
      ).statusCode,
    ).toBe(200);
    await refuse(reponse(optsEntra(d)), 'fournisseur', entra, 'indisponible');
    expect(
      (await new Agent(t).get('/api/auth/sso/fournisseurs')).json().map((x: { id: string }) => x.id),
    ).not.toContain(entra);
    expect(
      (await a.put(`/api/admin/sso/fournisseurs/${entra}`, corpsEntra(), { 'if-match': `"${version + 1}"` }))
        .statusCode,
    ).toBe(200);
  });
});

describe('connexion unique : XML durci', () => {
  it('DTD (DOCTYPE) refusée', async () => {
    await expect(
      (async () => {
        const r = await poster(
          entra,
          reponse(optsEntra(await demande(entra), { prologue: '<!DOCTYPE samlp:Response>', signer: 'aucune' })),
        );
        expect(r.headers.location).toBe('/login?sso=refus');
        return (await dernierRefus())?.motif;
      })(),
    ).resolves.toBe('xml');
  });
  it('entité déclarée refusée, même dans une DTD interne', async () => {
    const r = await poster(
      entra,
      reponse(
        optsEntra(await demande(entra), {
          prologue: '<!DOCTYPE r [<!ENTITY x "alice@example.org">]>',
          signer: 'aucune',
        }),
      ),
    );
    expect(r.headers.location).toBe('/login?sso=refus');
    expect((await dernierRefus())?.motif).toBe('xml');
  });
  it('corps borné (256 Kio) et champ répété refusé', async () => {
    reinitialiserLimites();
    const gros = await new Agent(t, IDP_ORIGINE).req('POST', `/api/auth/sso/${entra}/acs`, {
      body: `SAMLResponse=${'A'.repeat(300 * 1024)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(gros.statusCode).toBe(413);
    const double = await new Agent(t, IDP_ORIGINE).req('POST', `/api/auth/sso/${entra}/acs`, {
      body: 'SAMLResponse=AAAA&SAMLResponse=BBBB',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(double.statusCode).toBe(400);
  });
});

describe('connexion unique : chemin de retour, origine', () => {
  it('chemin de retour externe refusé (aucune redirection ouverte)', async () => {
    for (const retour of ['https://evil.example.org/', '//evil.example.org', '/\\evil.example.org', '/api/auth/me']) {
      reinitialiserLimites();
      const r = await new Agent(t).get(`/api/auth/sso/${entra}/connexion?retour=${encodeURIComponent(retour)}`);
      expect(r.statusCode, retour).toBe(400);
    }
    expect(retourInterne('/accueil?onglet=1')).toBe('/accueil?onglet=1');
    expect(retourInterne(undefined)).toBe('/');
  });
  it('l’exception d’origine se limite à l’adresse de retour : les autres POST restent refusés', async () => {
    const r = await new Agent(t, IDP_ORIGINE).post('/api/auth/login', { username: 'alice', password: PASSWORD });
    expect(r.statusCode).toBe(403);
    expect(() =>
      registerRoutes(t.app, t.svc, [
        route({
          method: 'POST',
          url: '/api/autre',
          summary: 'x',
          tags: [],
          access: 'public',
          csrf: false,
          origineExterne: 'acs-saml',
          handler: async () => undefined,
        }),
      ]),
    ).toThrow(/réservée à l’adresse de retour SAML/);
  });
});

describe('connexion unique : comptes', () => {
  it('un compte « sso » est refusé au mot de passe, avec la réponse uniforme', async () => {
    const u = await t.svc.db.one<{ password_hash: string }>("SELECT password_hash FROM users WHERE username='alice'");
    expect(u!.password_hash).toBe(EMPREINTE_SSO);
    reinitialiserLimites();
    const r = await new Agent(t).post('/api/auth/login', { username: 'alice', password: PASSWORD });
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toBe(ECHEC_CONNEXION);
    const j = await t.svc.db.q<{ details: { reason: string } }>(
      "SELECT details FROM audit_log WHERE action='auth.login_failed' AND username='alice' ORDER BY id DESC LIMIT 1",
    );
    expect(j.rows[0]!.details.reason).toBe('sso');
  });
  it('ni mot de passe temporaire, ni TOTP, ni clé pour un compte « sso » ; ré-authentification par le fournisseur', async () => {
    const navigateur = new Agent(t, IDP_ORIGINE);
    await poster(entra, reponse(optsEntra(await demande(entra))), navigateur);
    const nav = new Agent(t);
    nav.cookies = navigateur.cookies;
    await nav.me();
    for (const [url, corps] of [
      ['/api/account/totp/begin', {}],
      ['/api/account/password', { current: 'x', next: 'y' }],
      ['/api/account/reauth', { password: 'x', code: '123456' }],
      ['/api/account/recovery-codes', {}],
    ] as const) {
      const r = await nav.post(url, corps);
      expect(r.statusCode, url).toBe(403);
      expect(r.json().reason, url).toBe('sso');
    }
    const id = (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username='alice'"))!.id;
    expect((await a.post(`/api/admin/users/${id}/reset-password`)).statusCode).toBe(409);
    // Ré-authentification : aller-retour SAML avec ForceAuthn, retour vers la page de départ.
    const ra = await nav.post('/api/account/reauth/sso', { retour: '/compte' });
    expect(ra.statusCode, ra.body).toBe(200);
    const d = lireDemande(ra.json().url);
    expect(d.xml).toContain('ForceAuthn="true"');
    await t.svc.db.q("UPDATE sessions SET reauth_at = now() - interval '1 hour' WHERE par_sso");
    const r = await poster(entra, reponse(optsEntra(d.id)));
    expect(r.statusCode).toBe(303);
    expect(r.headers.location).toBe('/compte');
    expect(r.headers['set-cookie']).toBeUndefined();
    const f = await nav.get('/api/account/factors');
    expect(f.json().reauthJusqua).not.toBeNull();
    // Une ré-authentification par un autre compte du fournisseur est refusée.
    const ra2 = await nav.post('/api/account/reauth/sso', { retour: '/compte' });
    const r2 = await poster(entra, reponse(optsEntra(lireDemande(ra2.json().url).id, { nameId: 'chloe@example.org' })));
    expect(r2.headers.location).toBe('/compte');
  });
  it('une session non ouverte par la connexion unique n’est pas admise pour un compte « sso »', async () => {
    const u = (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username='alice'"))!;
    const h = crypto.createHash('sha256').update('jeton-fictif-0123456789').digest();
    await t.svc.db.q(
      "INSERT INTO sessions(id_hash, user_id, csrf, mfa_ok, expires_at) VALUES ($1, $2, 'x', true, now() + interval '1 hour')",
      [h, u.id],
    );
    expect(await t.svc.auth.loadByHash(h, false)).toBeNull();
  });
  it('création : fournisseur et identifiant attendu exigés ; identifiant unique par fournisseur (sans casse)', async () => {
    expect(
      (await a.post('/api/admin/users', { username: 'emile', modeConnexion: 'sso', fournisseurId: entra })).statusCode,
    ).toBe(422);
    const dbl = await a.post('/api/admin/users', {
      username: 'emile',
      modeConnexion: 'sso',
      fournisseurId: entra,
      identifiantExterne: 'ALICE@example.org',
    });
    expect(dbl.statusCode).toBe(409);
    expect(dbl.json().error).toMatch(/identifiant du fournisseur/);
  });
  it('le dernier administrateur local actif ne peut pas passer en connexion unique', async () => {
    // Un second administrateur local passe en « sso » : il reste admin-local.
    const second = await makeUser(t, 'admin-second', 'admin');
    const g = await a.get(`/api/admin/users/${second.id}`);
    const p = await a.patch(
      `/api/admin/users/${second.id}`,
      { modeConnexion: 'sso', fournisseurId: entra, identifiantExterne: 'second@example.org' },
      { 'if-match': String(g.headers.etag) },
    );
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json()).toMatchObject({
      mode_connexion: 'sso',
      sso_identifiant: 'second@example.org',
      totp_enabled: false,
    });
    // Connecté par la connexion unique, il tente de passer admin-local, dernier administrateur local, en « sso ».
    const navigateur = new Agent(t, IDP_ORIGINE);
    const r = await poster(
      entra,
      reponse(optsEntra(await demande(entra), { nameId: 'second@example.org' })),
      navigateur,
    );
    expect(r.statusCode).toBe(303);
    const b = new Agent(t);
    b.cookies = navigateur.cookies;
    expect((await b.me()).stage).toBe('ok');
    const ga = await b.get(`/api/admin/users/${admin.id}`);
    const refus = await b.patch(
      `/api/admin/users/${admin.id}`,
      { modeConnexion: 'sso', fournisseurId: entra, identifiantExterne: 'admin@example.org' },
      { 'if-match': String(ga.headers.etag) },
    );
    expect(refus.statusCode).toBe(409);
    expect(refus.json().reason).toBe('dernier_admin_local');
    expect(
      (await t.svc.db.one<{ m: string }>("SELECT mode_connexion AS m FROM users WHERE username='admin-local'"))!.m,
    ).toBe('local');
  });
});

describe('connexion unique : métadonnées et flux', () => {
  let f: string;
  let idp2: IdpFictif;
  const url =
    'https://login.microsoftonline.com/00000000-0000-4000-8000-0000000000bb/federationmetadata/2007-06/federationmetadata.xml?appid=00000000-0000-4000-8000-0000000000cc';
  const ENT = 'https://sts.windows.net/00000000-0000-4000-8000-0000000000bb/';
  const lire = async (xml: string) => {
    const l = await t.svc.connexionUnique.reclamerLecture();
    expect(l).not.toBeNull();
    return t.svc.connexionUnique.terminerLecture(l!.id, { ok: true, contenu: Buffer.from(xml).toString('base64') });
  };
  it('adresse refusée : http clair, identifiants dans l’adresse, autre hôte qu’Entra ID', async () => {
    for (const u of [
      'http://login.microsoftonline.com/x/federationmetadata.xml',
      'https://user:secret@login.microsoftonline.com/x',
      'https://login.example.org/x',
    ]) {
      const r = await a.post(
        '/api/admin/sso/fournisseurs',
        corpsEntra({ entityId: ENT, urlMetadonnees: u, fluxConfirme: true }),
      );
      expect(r.statusCode, u).toBe(422);
    }
    const kc = await a.post(
      '/api/admin/sso/fournisseurs',
      corpsKeycloak({
        entityId: 'https://kc.example.org/realms/r',
        urlMetadonnees: 'http://kc.example.org/realms/r/protocol/saml/descriptor',
        fluxConfirme: true,
      }),
    );
    expect(kc.statusCode).toBe(422);
  });
  it('une adresse de métadonnées exige la validation du flux, puis l’ouvre (journal), fermé par défaut', async () => {
    expect(await t.svc.flux.ouvert('sso-saml')).toBe(false);
    expect(await t.svc.connexionUnique.reclamerLecture()).toBeNull();
    const sans = await a.post(
      '/api/admin/sso/fournisseurs',
      corpsEntra({ entityId: ENT, libelle: 'Entra auto', urlMetadonnees: url }),
    );
    expect(sans.statusCode).toBe(409);
    expect(sans.json()).toMatchObject({ reason: 'flux_validation', destination: 'login.microsoftonline.com' });
    const r = await a.post(
      '/api/admin/sso/fournisseurs',
      corpsEntra({ entityId: ENT, libelle: 'Entra auto', urlMetadonnees: url, fluxConfirme: true }),
    );
    expect(r.statusCode, r.body).toBe(201);
    f = r.json().id;
    expect(await t.svc.flux.ouvert('sso-saml')).toBe(true);
    const j = await t.svc.db.q<{ details: { origine: string } }>(
      "SELECT details FROM audit_log WHERE action='flux.externe.ouvert' AND target='sso-saml'",
    );
    expect(j.rows[0]!.details.origine).toBe('sso.fournisseur');
  });
  it('l’exécutant lit l’adresse : métadonnées signées acceptées ; entityID différent refusé, configuration conservée', async () => {
    idp2 = nouvelIdp();
    const l = await t.svc.connexionUnique.reclamerLecture();
    expect(l).toMatchObject({ type: 'entra', url });
    expect(
      await t.svc.connexionUnique.terminerLecture(l!.id, {
        ok: true,
        contenu: Buffer.from(metadonnees({ entityId: ENT, idp: idp2, signer: idp2 })).toString('base64'),
      }),
    ).toBe('appliquee');
    // Lecture déjà close : un second rapport est ignoré.
    expect(await t.svc.connexionUnique.terminerLecture(l!.id, { ok: false, erreur: 'x' })).toBe('ignoree');
    const out = await t.svc.connexionUnique.un(f);
    expect(out).toMatchObject({ pret: true, metadonnees: { source: 'url', signees: true, erreur: null } });
    await a.post(`/api/admin/sso/fournisseurs/${f}/relire`, {});
    await t.svc.db.q("UPDATE sso_fournisseurs SET lecture_reclamee_le = now() - interval '1 minute' WHERE id=$1", [f]);
    expect(await lire(metadonnees({ entityId: 'https://sts.windows.net/autre/', idp: idp2, signer: idp2 }))).toBe(
      'refusee',
    );
    const apres = await t.svc.connexionUnique.un(f);
    expect(apres!.pret).toBe(true);
    expect(apres!.metadonnees.erreur).toMatch(/entityID/);
  });
  it('relecture : signature par un certificat inconnu refusée (alerte d’échec) ; rotation annoncée acceptée (alerte de changement)', async () => {
    const intrus = nouvelIdp();
    const echecs = await alertes('sso:metadonnees_echec');
    await t.svc.db.q(
      "UPDATE sso_fournisseurs SET relecture_demandee=true, lecture_reclamee_le = now() - interval '1 minute', metadonnees_erreur=null WHERE id=$1",
      [f],
    );
    expect(await lire(metadonnees({ entityId: ENT, idp: intrus, signer: intrus }))).toBe('refusee');
    expect(await alertes('sso:metadonnees_echec')).toBe(echecs + 1);
    // Rotation : le nouveau certificat, annoncé, signe ; l'ancien (connu) est encore listé.
    const suivant = nouvelIdp();
    const changes = await alertes('sso:certificat_change');
    await t.svc.db.q(
      "UPDATE sso_fournisseurs SET relecture_demandee=true, lecture_reclamee_le = now() - interval '1 minute' WHERE id=$1",
      [f],
    );
    expect(await lire(metadonnees({ entityId: ENT, idp: suivant, autresCertificats: [idp2], signer: idp2 }))).toBe(
      'appliquee',
    );
    expect(await alertes('sso:certificat_change')).toBe(changes + 1);
    expect((await t.svc.connexionUnique.un(f))!.certificats).toHaveLength(2);
  });
  it('certificat de signature qui expire dans moins de 30 jours : une alerte, une seule fois', async () => {
    const court = nouvelIdp(10);
    await a.post(`/api/admin/sso/fournisseurs/${keycloak}/metadonnees`, {
      xml: metadonnees({ entityId: ENTITE_KEYCLOAK, idp: court }),
    });
    const avant = await alertes('sso:certificat_expire');
    expect(await t.svc.connexionUnique.verifierEcheances()).toBeGreaterThanOrEqual(1);
    expect(await alertes('sso:certificat_expire')).toBe(avant + 1);
    expect(await t.svc.connexionUnique.verifierEcheances()).toBe(0);
    await a.post(`/api/admin/sso/fournisseurs/${keycloak}/metadonnees`, {
      xml: metadonnees({ entityId: ENTITE_KEYCLOAK, idp }),
    });
  });
  it('import manuel : DTD refusée, entityID contrôlé ; possible flux fermé', async () => {
    const dtd = await a.post(`/api/admin/sso/fournisseurs/${keycloak}/metadonnees`, {
      xml:
        '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>' +
        metadonnees({ entityId: ENTITE_KEYCLOAK, idp }).replace(/^<\?xml[^>]*>/, ''),
    });
    expect(dtd.statusCode).toBe(422);
    const autre = await a.post(`/api/admin/sso/fournisseurs/${keycloak}/metadonnees`, {
      xml: metadonnees({ entityId: 'https://sso.example.org/realms/autre', idp }),
    });
    expect(autre.statusCode).toBe(422);
  });
  it('retirer la dernière adresse referme le flux ; la suppression refuse un fournisseur qui a des comptes', async () => {
    const g = await a.get('/api/admin/sso');
    const v = g.json().fournisseurs.find((x: { id: string }) => x.id === f).version;
    const r = await a.put(`/api/admin/sso/fournisseurs/${f}`, corpsEntra({ entityId: ENT, libelle: 'Entra auto' }), {
      'if-match': `"${v}"`,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(await t.svc.flux.ouvert('sso-saml')).toBe(false);
    expect((await a.post(`/api/admin/sso/fournisseurs/${f}/relire`, {})).statusCode).toBe(409);
    expect((await a.del(`/api/admin/sso/fournisseurs/${entra}`)).statusCode).toBe(409);
    expect((await a.del(`/api/admin/sso/fournisseurs/${f}`)).statusCode).toBe(204);
  });
  it('métadonnées du service pour un fournisseur : entityID, adresse de retour, certificat des demandes signées', async () => {
    const sso = await a.get('/api/admin/sso');
    expect(sso.json().sp).toMatchObject({ disponible: true, entityId: SP, signeRequetes: true });
    expect(sso.json().sp.certificat).toContain('BEGIN CERTIFICATE');
    const x = await a.get(`/api/admin/sso/fournisseurs/${entra}/metadonnees-sp`);
    expect(x.statusCode).toBe(200);
    expect(x.headers['content-type']).toContain('application/samlmetadata+xml');
    expect(x.body).toContain(`entityID="${SP}"`);
    expect(x.body).toContain(`Location="${acs(entra)}"`);
  });
  it('droits : lecture et administration réservées (un lecteur est refusé)', async () => {
    const lecteur = await makeUser(t, 'lecteur-sso', 'ro');
    const l = await login(t, lecteur);
    expect((await l.get('/api/admin/sso')).statusCode).toBe(403);
    expect(
      (await l.post('/api/admin/sso/fournisseurs', corpsKeycloak({ entityId: 'https://x.example.org/' }))).statusCode,
    ).toBe(403);
  });
});
