/* Poivre des mots de passe (L9, ADR 0072) : installation, définition sur une installation existante, changement (ancien poivre,
   code de double authentification, rechiffrement atomique), liaison de l'empreinte au compte, aucune fuite du poivre. */
import { finPoivre, formaterPoivreGenere, genererPoivre, type PoivreAEnregistrer } from '@suivi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMANDEUR_ALERTE } from '../src/alertes-exploitation.js';
import {
  Agent,
  cleSecoursDeTest,
  createTestApp,
  login,
  makeUser,
  nextCode,
  PASSWORD,
  type TestApp,
  type TestUser,
} from './helpers.js';

const SAISI = 'Vq7!mZ3#kP9$wX2@nR5%tL8&yB4*cD6^hF1(';
const AUTRE = 'Jh6&nB2!rT8#qL4@zW9$cK5%xP3*mD7^vF1)';
/** Poivre généré, tel que l'interface l'affiche et l'envoie, avec la preuve de recopie. */
const generer = (): { p: PoivreAEnregistrer; brut: string } => {
  const brut = genererPoivre();
  return {
    brut,
    p: { mode: 'genere', valeur: formaterPoivreGenere(brut), engagement: { coffre: true, fin: finPoivre(brut) } },
  };
};
const saisi = (valeur: string): PoivreAEnregistrer => ({
  mode: 'saisi',
  valeur,
  engagement: { coffre: true, fin: valeur.slice(-8) },
});

describe('installation', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t?.close();
  });
  const corps = (token: string, extra: Record<string, unknown> = {}) => ({
    token,
    username: 'chef',
    password: PASSWORD,
    cleSecours: cleSecoursDeTest(),
    ...extra,
  });
  const hash = async (nom: string) =>
    (await t.svc.db.one<{ h: string }>('SELECT password_hash AS h FROM users WHERE username=$1', [nom]))!.h;

  it('exige le poivre, ses règles et l’engagement de sauvegarde sans consommer le jeton', async () => {
    const { token } = await t.svc.auth.issueSetupToken('cli', () => {});
    const a = new Agent(t);
    const { p } = generer();
    const sans = await a.post('/api/setup', corps(token));
    expect(sans.statusCode).toBe(422);
    expect(sans.json().reason).toBe('poivre_requis');
    // Case non cochée : refusée par le schéma.
    expect(
      (
        await a.post(
          '/api/setup',
          corps(token, { poivre: { ...p, engagement: { coffre: false, fin: p.engagement.fin } } }),
        )
      ).statusCode,
    ).toBe(422);
    // Fin mal recopiée.
    const fin = await a.post(
      '/api/setup',
      corps(token, { poivre: { ...p, engagement: { coffre: true, fin: 'XXXXXXXX' } } }),
    );
    expect(fin.statusCode).toBe(422);
    expect(fin.json().reason).toBe('engagement');
    // Poivre saisi trop faible : un message par critère.
    const faible = await a.post('/api/setup', corps(token, { poivre: saisi('MotDePasse2026') }));
    expect(faible.statusCode).toBe(422);
    expect(faible.json().problemes.length).toBeGreaterThan(1);
    // Contient l'identifiant du compte créé.
    const ident = await a.post(
      '/api/setup',
      corps(token, { poivre: saisi(SAISI.slice(0, 20) + 'chef' + SAISI.slice(20)) }),
    );
    expect(ident.statusCode).toBe(422);
    // Rien n'a été créé, le jeton reste utilisable, aucun poivre n'est enregistré.
    expect((await a.get('/api/setup')).json()).toMatchObject({ needed: true, poivreDefini: false });
    expect(await t.svc.motsDePasse.defini()).toBe(false);
    const ok = await a.post('/api/setup', corps(token, { poivre: p }));
    expect(ok.statusCode, ok.body).toBe(201);
  });

  it('crée l’administrateur avec une empreinte poivrée, dans la même transaction que le poivre', async () => {
    const { token } = await t.svc.auth.issueSetupToken('cli', () => {});
    const { p, brut } = generer();
    const a = new Agent(t);
    expect((await a.post('/api/setup', corps(token, { poivre: p }))).statusCode).toBe(201);
    expect(await hash('chef')).toMatch(/^poivre\$[0-9a-f]{16}\$/);
    expect(await t.svc.motsDePasse.defini()).toBe(true);
    expect((await a.get('/api/setup')).json()).toMatchObject({ poivreDefini: true });
    // L'administrateur se connecte avec son mot de passe ; le poivre saisi avec séparateurs ou en minuscules est le même.
    expect((await new Agent(t).post('/api/auth/login', { username: 'chef', password: PASSWORD })).statusCode).toBe(200);
    expect(await t.svc.motsDePasse.estLePoivre(formaterPoivreGenere(brut).toLowerCase())).toBe(true);
    // Le texte du poivre n'est ni dans la base ni dans le journal d'audit.
    const dump = JSON.stringify(
      (await t.svc.db.q("SELECT key, value FROM settings WHERE key = 'secret:poivre'")).rows.concat(
        (await t.svc.db.q('SELECT action, details FROM audit_log')).rows as never[],
      ),
    );
    expect(dump).not.toContain(brut);
    expect(dump).toContain('securite.poivre_defini');
    // Un administrateur de secours (jeton « recovery ») ne redéfinit pas le poivre : empreinte poivrée par la clé courante.
    const secours = await t.svc.auth.issueSetupToken('recovery', () => {});
    const refus = await new Agent(t).post(
      '/api/setup',
      corps(secours.token, { username: 'secours', poivre: generer().p }),
    );
    expect(refus.statusCode).toBe(409);
    const ok = await new Agent(t).post('/api/setup', corps(secours.token, { username: 'secours' }));
    expect(ok.statusCode, ok.body).toBe(201);
    expect(await hash('secours')).toMatch(/^poivre\$/);
  });
});

describe('installation existante et changement', () => {
  let t: TestApp, admin: TestUser, agent: Agent, autres: TestUser[];
  /** Poivre courant au fil des tests de la série. */
  let courant = SAISI;
  beforeAll(async () => {
    t = await createTestApp();
    admin = await makeUser(t, 'rssi', 'admin');
    autres = [await makeUser(t, 'alice', 'rw'), await makeUser(t, 'bob', 'ro', { totp: false })];
    agent = await login(t, admin);
  });
  afterAll(async () => {
    await t.close();
  });
  const remise = () => {
    t.svc.limits.updateMfaByUser.reset();
    t.svc.limits.poivreByUser.reset();
    t.svc.limits.loginByIp.reset();
    t.svc.limits.loginByUser.reset();
    t.svc.limits.mfaBySession.reset();
    t.svc.limits.mfaByUser.reset();
  };
  const hashes = async () =>
    (
      await t.svc.db.q<{ username: string; h: string }>(
        'SELECT username, password_hash AS h FROM users ORDER BY username',
      )
    ).rows;
  const connexion = async (u: TestUser) =>
    (await new Agent(t).post('/api/auth/login', { username: u.username, password: PASSWORD })).statusCode;
  const definir = async (poivre: PoivreAEnregistrer, code?: string) =>
    agent.post('/api/admin/poivre/definir', { poivre, code: code ?? (await nextCode(t, admin)) });
  const changer = async (poivre: PoivreAEnregistrer, ancien: string, code?: string) =>
    agent.post('/api/admin/poivre/changer', { poivre, ancienPoivre: ancien, code: code ?? (await nextCode(t, admin)) });

  it('signale un poivre non défini, laisse les connexions continuer, puis refuse les définitions invalides', async () => {
    remise();
    const e = (await agent.get('/api/admin/poivre')).json();
    expect(e).toMatchObject({ defini: false, idCle: null, empreintesPoivrees: 0, comptes: 3 });
    expect((await hashes()).every((x) => x.h.startsWith('scrypt$'))).toBe(true);
    expect(await connexion(autres[0]!)).toBe(200);
    // Droit insuffisant, code faux, poivre faible, engagement non tenu : rien ne change.
    const lecteur = await login(t, autres[0]!);
    expect((await lecteur.get('/api/admin/poivre')).statusCode).toBe(403);
    expect((await lecteur.post('/api/admin/poivre/definir', { poivre: saisi(SAISI), code: '000000' })).statusCode).toBe(
      403,
    );
    expect((await definir(saisi(SAISI), '000000')).statusCode).toBe(401);
    expect((await definir(saisi('MotDePasse2026'))).statusCode).toBe(422);
    expect((await definir({ ...saisi(SAISI), engagement: { coffre: true, fin: 'ZZZZZZZZ' } })).statusCode).toBe(422);
    expect((await hashes()).every((x) => x.h.startsWith('scrypt$'))).toBe(true);
  });

  it('définit le poivre : toutes les empreintes sont protégées, chaque compte se connecte avec son mot de passe inchangé', async () => {
    remise();
    const r = await definir(saisi(SAISI));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ defini: true, empreintesPoivrees: 3, comptes: 3 });
    expect((await hashes()).every((x) => /^poivre\$[0-9a-f]{16}\$/.test(x.h))).toBe(true);
    remise();
    for (const u of [admin, ...autres]) expect(await connexion(u), u.username).toBe(200);
    // Déjà défini : la définition est refusée.
    remise();
    expect((await definir(saisi(AUTRE))).statusCode).toBe(409);
    // Les nouveaux comptes et les changements de mot de passe sont poivrés aussi.
    const cree = await agent.post('/api/admin/users', { username: 'carole', roles: [], groups: [] });
    expect(cree.statusCode, cree.body).toBe(201);
    expect((await hashes()).find((x) => x.username === 'carole')!.h).toMatch(/^poivre\$/);
    const reset = await agent.post(`/api/admin/users/${cree.json().id}/reset-password`, {});
    expect(reset.statusCode).toBe(200);
    expect((await hashes()).find((x) => x.username === 'carole')!.h).toMatch(/^poivre\$/);
    remise();
    expect(
      (await new Agent(t).post('/api/auth/login', { username: 'carole', password: reset.json().temporaryPassword }))
        .statusCode,
    ).toBe(200);
    // Protection d'une empreinte non poivrée restée en base (compte restauré, inséré hors service) à la première connexion.
    const bob = autres[1]!;
    const { hashPassword } = await import('../src/security/crypto.js');
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE id=$1', [bob.id, await hashPassword(PASSWORD)]);
    remise();
    expect(await connexion(bob)).toBe(200);
    expect((await hashes()).find((x) => x.username === 'bob')!.h).toMatch(/^poivre\$/);
  });

  it('refuse un changement sans droit, sans bon code, avec un ancien poivre faux, trop faible ou identique', async () => {
    remise();
    const avant = await hashes();
    const idAvant = (await agent.get('/api/admin/poivre')).json().idCle;
    const lecteur = await login(t, autres[0]!);
    expect(
      (await lecteur.post('/api/admin/poivre/changer', { poivre: saisi(AUTRE), ancienPoivre: SAISI, code: '123456' }))
        .statusCode,
    ).toBe(403);
    expect((await changer(saisi(AUTRE), SAISI, '000000')).statusCode).toBe(401);
    const faux = await changer(saisi(AUTRE), SAISI + 'x');
    expect(faux.statusCode).toBe(403);
    expect(faux.json().reason).toBe('ancien_incorrect');
    expect((await changer(saisi('MotDePasse2026'), SAISI)).statusCode).toBe(422);
    const identique = await changer(saisi(SAISI), SAISI);
    expect(identique.statusCode).toBe(422);
    expect(identique.json().error).toContain('différent de l’ancien poivre');
    expect(await hashes()).toEqual(avant);
    expect((await agent.get('/api/admin/poivre')).json().idCle).toBe(idAvant);
    const refus = await t.svc.db.q("SELECT action FROM audit_log WHERE action LIKE 'securite.poivre_changement.%'");
    expect(refus.rows.map((r) => (r as { action: string }).action)).toEqual(
      expect.arrayContaining(['securite.poivre_changement.mfa_failed', 'securite.poivre_changement.ancien_incorrect']),
    );
  });

  it('limite les tentatives à cinq par heure et par compte', async () => {
    remise();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await changer(saisi(AUTRE), SAISI + 'x')).statusCode);
    expect(codes.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(codes[5]).toBe(429);
  });

  it('annule tout si une empreinte est illisible : aucun état intermédiaire', async () => {
    remise();
    const avant = await hashes();
    const reglage = (await t.svc.db.one<{ v: string }>(
      "SELECT value::text AS v FROM settings WHERE key='secret:poivre'",
    ))!.v;
    const corrompu = avant.find((x) => x.username === 'bob')!;
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE username=$1', [
      'bob',
      corrompu.h.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')),
    ]);
    const apresCorruption = await hashes();
    const r = await changer(saisi(AUTRE), SAISI);
    expect(r.statusCode).toBe(500);
    expect(await hashes()).toEqual(apresCorruption);
    expect(
      (await t.svc.db.one<{ v: string }>("SELECT value::text AS v FROM settings WHERE key='secret:poivre'"))!.v,
    ).toBe(reglage);
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE username=$1', ['bob', corrompu.h]);
  });

  it('change le poivre : toutes les empreintes sont rechiffrées, l’ancien identifiant de clé disparaît, les connexions fonctionnent', async () => {
    remise();
    const ancien = (await agent.get('/api/admin/poivre')).json();
    const { p, brut } = generer();
    const r = await changer(p, SAISI);
    expect(r.statusCode, r.body).toBe(200);
    const nouveau = r.json();
    courant = brut;
    expect(nouveau.idCle).not.toBe(ancien.idCle);
    expect(nouveau.empreintesPoivrees).toBe(nouveau.comptes);
    const tous = await hashes();
    expect(tous.every((x) => x.h.startsWith(`poivre$${nouveau.idCle}$`))).toBe(true);
    expect(JSON.stringify(tous)).not.toContain(ancien.idCle);
    expect(
      (await t.svc.db.one<{ v: string }>("SELECT value::text AS v FROM settings WHERE key='secret:poivre'"))!.v,
    ).not.toContain(ancien.idCle);
    remise();
    for (const u of [admin, ...autres]) expect(await connexion(u), u.username).toBe(200);
    // La session ouverte n'est pas fermée.
    expect((await agent.get('/api/admin/poivre')).statusCode).toBe(200);
    // Audit : auteur, anciens et nouveaux identifiants, jamais le poivre.
    const ligne = (await t.svc.db.one<{ username: string; details: Record<string, unknown> }>(
      "SELECT username, details FROM audit_log WHERE action='securite.poivre_change'",
    ))!;
    expect(ligne.username).toBe('rssi');
    expect(ligne.details).toMatchObject({ ancienIdCle: ancien.idCle, nouvelIdCle: nouveau.idCle });
    expect(JSON.stringify((await t.svc.db.q('SELECT details FROM audit_log')).rows)).not.toContain(brut);
    // L'ancien poivre ne vaut plus ; le nouveau, avec ou sans séparateurs, oui.
    expect(await t.svc.motsDePasse.estLePoivre(SAISI)).toBe(false);
    expect(await t.svc.motsDePasse.estLePoivre(brut)).toBe(true);
  });

  it('alerte le contact technique et les administrateurs, sans le poivre', async () => {
    remise();
    await t.svc.db.q('UPDATE users SET email=$2 WHERE id=$1', [admin.id, 'rssi@exemple.test']);
    const g = await agent.get('/api/settings/courriel');
    const m = await agent.put(
      '/api/settings/courriel',
      {
        ...g.json().values,
        actif: true,
        hote: 'smtp.exemple.test',
        expediteur: 'suivi@exemple.test',
        contactTechnique: 'tech@exemple.test',
      },
      { 'if-match': g.headers.etag as string },
    );
    expect(m.statusCode, m.body).toBe(200);
    await t.svc.db.q('DELETE FROM courriel_jobs');
    const avant = (await agent.get('/api/admin/poivre')).json();
    const r = await changer(saisi(AUTRE), courant);
    expect(r.statusCode, r.body).toBe(200);
    const mails = (
      await t.svc.db.q<{ to_address: string; subject: string; body: string }>(
        'SELECT to_address, subject, body FROM courriel_jobs WHERE requested_by=$1',
        [DEMANDEUR_ALERTE],
      )
    ).rows;
    expect(mails.map((x) => x.to_address).sort()).toEqual(['rssi@exemple.test', 'tech@exemple.test']);
    for (const x of mails) {
      expect(x.subject).toContain('Poivre des mots de passe changé');
      expect(x.body).toContain(avant.idCle);
      expect(x.body).toContain(r.json().idCle);
      expect(x.body).not.toContain(AUTRE);
      expect(x.body).not.toContain(courant);
    }
    courant = AUTRE;
  });
});

describe('liaison de l’empreinte au compte et fuites', () => {
  let t: TestApp, a: TestUser, b: TestUser, agent: Agent;
  beforeAll(async () => {
    t = await createTestApp();
    a = await makeUser(t, 'alice', 'rw');
    b = await makeUser(t, 'bob', 'rw');
    const admin = await makeUser(t, 'rssi', 'admin');
    agent = await login(t, admin);
    const r = await agent.post('/api/admin/poivre/definir', { poivre: saisi(SAISI), code: await nextCode(t, admin) });
    expect(r.statusCode, r.body).toBe(200);
  });
  afterAll(async () => {
    await t.close();
  });
  const motDePasse = (id: string) =>
    t.svc.db.one<{ h: string }>('SELECT password_hash AS h FROM users WHERE id=$1', [id]);
  const connexion = async (u: TestUser) => {
    t.svc.limits.loginByIp.reset();
    t.svc.limits.loginByUser.reset();
    return (await new Agent(t).post('/api/auth/login', { username: u.username, password: PASSWORD })).statusCode;
  };

  it('refuse une empreinte copiée d’un compte vers un autre (AAD) et le journalise', async () => {
    const ha = (await motDePasse(a.id))!.h;
    const hb = (await motDePasse(b.id))!.h;
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE id=$1', [b.id, ha]);
    expect(await connexion(b)).toBe(401);
    const trace = await t.svc.db.q("SELECT target FROM audit_log WHERE action='securite.poivre_integrite'");
    expect(trace.rows.length).toBeGreaterThan(0);
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE id=$1', [b.id, hb]);
    expect(await connexion(b)).toBe(200);
  });

  it('refuse une empreinte chiffrée par une autre clé ou altérée', async () => {
    const ha = (await motDePasse(a.id))!.h;
    const autreId = ha.replace(/^poivre\$[0-9a-f]{16}\$/, 'poivre$0000000000000000$');
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE id=$1', [a.id, autreId]);
    expect(await connexion(a)).toBe(401);
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE id=$1', [a.id, ha.slice(0, -4) + 'AAAA']);
    expect(await connexion(a)).toBe(401);
    await t.svc.db.q('UPDATE users SET password_hash=$2 WHERE id=$1', [a.id, ha]);
    expect(await connexion(a)).toBe(200);
  });

  it('masque le poivre dans les journaux techniques', async () => {
    const g = await agent.get('/api/admin/journaux-techniques');
    expect(g.statusCode, g.body).toBe(200);
    const n = await agent.put('/api/admin/journaux-techniques/niveau', { niveau: 'warn', confirm: 'APPLIQUER' });
    expect(n.statusCode, n.body).toBe(200);
    t.svc.log.warn(
      { body: { poivre: { mode: 'saisi', valeur: SAISI }, ancienPoivre: AUTRE }, req: { poivre: SAISI } },
      'essai-poivre',
    );
    const liste = (await agent.get('/api/admin/journaux-techniques?q=essai-poivre')).json();
    const sortie = JSON.stringify(liste.entrees);
    expect(sortie).toContain('essai-poivre');
    expect(sortie).toContain('[masqué]');
    expect(sortie).not.toContain(SAISI);
    expect(sortie).not.toContain(AUTRE);
  });
});
