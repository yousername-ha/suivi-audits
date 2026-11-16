/* Mandataire sortant de l'établissement (ADR 0101, lot P1) : réglage de la configuration système (administration:administrer,
   If-Match, CSRF), mot de passe en écriture seule (jamais renvoyé, ni en clair en base, ni au journal d'audit, ni dans les
   journaux techniques), effacé quand l'adresse ou l'identifiant change ; remise à l'exécutant avec la réclamation d'une
   collecte de la veille, seulement si le mandataire est actif ; jamais pour une exécution d'intégration (Tenable), qui
   reste en accès direct par construction. Données fictives. */
import pino from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REDACT } from '../src/log.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const base = '/api/admin/mandataire';
const MOT_DE_PASSE = 'Mdp-mandataire-fictif-à-ne-jamais-voir-58';
const AUTORITE =
  '-----BEGIN CERTIFICATE-----\nMIIBfictifAutoriteDeLEtablissementPourLesTests0000000000000000\n-----END CERTIFICATE-----';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, lecteurAdmin: Agent, ro: Agent;

const reglage = (x: Record<string, unknown> = {}) => ({
  actif: true,
  adresse: 'http://mandataire.exemple.test:3128',
  identifiant: 'compte-veille',
  autoriteCertification: '',
  ...x,
});
async function enregistrer(x: Record<string, unknown> = {}, agent: Agent = admin) {
  const g = await admin.get(base);
  return agent.put(base, reglage(x), { 'if-match': g.headers.etag as string });
}
const audits = async (like: string) =>
  (
    await t.svc.db.q<{ action: string; details: Record<string, unknown> }>(
      'SELECT action, details FROM audit_log WHERE action LIKE $1 ORDER BY id',
      [like],
    )
  ).rows;
const secretEnBase = async () =>
  (await t.svc.db.q<{ value: unknown }>("SELECT value FROM settings WHERE key = 'secret:mandataire'")).rows;

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'mandataire_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_mand_lecture', 'Administration, lecture', ARRAY['administration:lire'])",
  );
  lecteurAdmin = await login(t, await makeUser(t, 'mandataire_lecteur', 'r_mand_lecture'));
  ro = await login(t, await makeUser(t, 'mandataire_ro', 'ro'));
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("DELETE FROM settings WHERE key IN ('systeme:mandataire', 'secret:mandataire')");
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q('DELETE FROM vulnerabilites_veille_collectes');
  await t.svc.db.q('DELETE FROM integration_executions');
});

describe('réglage : droits, concurrence, validation', () => {
  it('par défaut : inactif, sans adresse ni mot de passe, version 0', async () => {
    const g = await admin.get(base);
    expect(g.statusCode, g.body).toBe(200);
    expect(g.headers.etag).toBe('"0"');
    expect(g.json()).toEqual({
      values: { actif: false, adresse: '', identifiant: '', autoriteCertification: '' },
      version: 0,
      motDePasseDefini: false,
    });
    expect(await t.svc.mandataire.actif()).toBe(false);
    expect(await t.svc.mandataire.pourExecutant()).toBeNull();
  });

  it('réservé à administration:administrer : la lecture de l’administration ne suffit pas', async () => {
    for (const a of [lecteurAdmin, ro]) {
      expect((await a.get(base)).statusCode).toBe(403);
      expect((await a.put(base, reglage(), { 'if-match': '"0"' })).statusCode).toBe(403);
      expect((await a.put(`${base}/mot-de-passe`, { password: MOT_DE_PASSE })).statusCode).toBe(403);
      expect((await a.del(`${base}/mot-de-passe`)).statusCode).toBe(403);
    }
    expect(await secretEnBase()).toEqual([]);
    // Le résumé des flux (lecture de l'administration) dit seulement si le mandataire est actif.
    const f = await lecteurAdmin.get('/api/admin/flux-externes');
    expect(f.statusCode).toBe(200);
    expect(f.json().mandataire).toEqual({ actif: false });
  });

  it('écriture sans jeton CSRF refusée ; If-Match obligatoire (428), version périmée refusée (412)', async () => {
    const sansCsrf = await admin.req('PUT', base, {
      json: reglage(),
      csrf: false,
      headers: { 'if-match': '"0"' },
    });
    expect(sansCsrf.statusCode).toBe(403);
    expect((await admin.put(base, reglage())).statusCode).toBe(428);
    const r = await enregistrer();
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"1"');
    expect(r.json().values).toEqual(reglage());
    const perime = await admin.put(base, reglage({ actif: false }), { 'if-match': '"0"' });
    expect(perime.statusCode).toBe(412);
    expect(perime.json().current.version).toBe(1);
    expect((await admin.get(base)).json().values.actif).toBe(true);
  });

  it('valide l’adresse (nom, IPv4, IPv6 entre crochets, port obligatoire, ni identifiant, ni chemin) et l’identifiant', async () => {
    for (const adresse of [
      'http://mandataire.exemple.test',
      'http://mandataire.exemple.test:0',
      'http://mandataire.exemple.test:65536',
      'https://mandataire.exemple.test:3128',
      'http://compte:secret@mandataire.exemple.test:3128',
      'http://mandataire.exemple.test:3128/',
      'http://mandataire.exemple.test:3128?x=1',
      'http://2001:db8::1:3128',
      'http://999.1.1.1:3128',
      'socks5://mandataire.exemple.test:1080',
    ]) {
      const r = await enregistrer({ adresse });
      expect(r.statusCode, adresse).toBe(422);
    }
    for (const adresse of ['http://10.0.0.8:8080', 'http://[2001:db8::8]:3128', 'http://proxy:3128']) {
      const r = await enregistrer({ adresse });
      expect(r.statusCode, `${adresse} ${r.body}`).toBe(200);
    }
    expect((await enregistrer({ adresse: '' })).statusCode).toBe(422); // actif sans adresse
    expect((await enregistrer({ adresse: '', actif: false })).statusCode).toBe(200);
    expect((await enregistrer({ identifiant: 'a:b' })).statusCode).toBe(422);
    expect((await enregistrer({ autoriteCertification: 'pas un certificat' })).statusCode).toBe(422);
    expect((await enregistrer({ autoriteCertification: AUTORITE })).statusCode).toBe(200);
    expect((await enregistrer({ motDePasse: MOT_DE_PASSE })).statusCode).toBe(422); // champ inattendu
    expect(await secretEnBase()).toEqual([]);
  });
});

describe('mot de passe en écriture seule', () => {
  it('scellé, jamais renvoyé ni journalisé ; on peut le retirer', async () => {
    expect((await enregistrer()).statusCode).toBe(200);
    expect((await admin.put(`${base}/mot-de-passe`, { password: 'a\r\nb' })).statusCode).toBe(422);
    expect((await admin.put(`${base}/mot-de-passe`, { password: MOT_DE_PASSE })).statusCode).toBe(204);
    const g = await admin.get(base);
    expect(g.json().motDePasseDefini).toBe(true);
    expect(g.body).not.toContain(MOT_DE_PASSE);
    expect(JSON.stringify(await secretEnBase())).not.toContain(MOT_DE_PASSE);
    expect((await secretEnBase()).length).toBe(1);
    const journal = (await audits('systeme.mandataire.%')).slice(-2);
    expect(journal.map((x) => x.action)).toEqual([
      'systeme.mandataire.modifie',
      'systeme.mandataire.mot_de_passe_defini',
    ]);
    expect(JSON.stringify(await audits('%'))).not.toContain(MOT_DE_PASSE);
    expect(JSON.stringify(journal)).not.toContain(MOT_DE_PASSE);
    // Le journal du réglage garde l'adresse et l'identifiant, ni le mot de passe ni le certificat entier.
    expect(journal[0]!.details).toMatchObject({
      apres: { actif: true, adresse: 'http://mandataire.exemple.test:3128', autoriteFournie: false },
    });
    const r = await admin.del(`${base}/mot-de-passe`);
    expect(r.statusCode).toBe(204);
    expect((await admin.get(base)).json().motDePasseDefini).toBe(false);
    expect(await secretEnBase()).toEqual([]);
    expect((await audits('systeme.mandataire.mot_de_passe_retire')).length).toBe(1);
  });

  it('changer l’adresse ou l’identifiant efface le mot de passe, avec une entrée au journal ; le reste le garde', async () => {
    expect((await enregistrer()).statusCode).toBe(200);
    await admin.put(`${base}/mot-de-passe`, { password: MOT_DE_PASSE });
    // Activer, désactiver ou changer l'autorité : le mot de passe reste.
    expect((await enregistrer({ actif: false })).statusCode).toBe(200);
    expect((await enregistrer({ autoriteCertification: AUTORITE })).statusCode).toBe(200);
    expect((await admin.get(base)).json().motDePasseDefini).toBe(true);
    // Adresse changée : effacé.
    expect((await enregistrer({ adresse: 'http://autre-mandataire.exemple.test:8080' })).statusCode).toBe(200);
    expect((await admin.get(base)).json().motDePasseDefini).toBe(false);
    let efface = await audits('systeme.mandataire.mot_de_passe_efface');
    expect(efface.at(-1)!.details).toEqual({ motif: 'adresse modifiée' });
    // Identifiant changé : effacé aussi.
    await admin.put(`${base}/mot-de-passe`, { password: MOT_DE_PASSE });
    expect(
      (await enregistrer({ adresse: 'http://autre-mandataire.exemple.test:8080', identifiant: 'autre-compte' }))
        .statusCode,
    ).toBe(200);
    expect((await admin.get(base)).json().motDePasseDefini).toBe(false);
    efface = await audits('systeme.mandataire.mot_de_passe_efface');
    expect(efface.at(-1)!.details).toEqual({ motif: 'identifiant modifié' });
  });

  it('les journaux techniques masquent le mot de passe et l’en-tête Proxy-Authorization', () => {
    for (const champ of ['*.motDePasse', 'req.headers["proxy-authorization"]']) expect(REDACT).toContain(champ);
    const lignes: string[] = [];
    const l = pino({ redact: { paths: REDACT, censor: '[masqué]' } }, { write: (s: string) => lignes.push(s) });
    const jeton = Buffer.from(`compte-veille:${MOT_DE_PASSE}`).toString('base64');
    l.info({ motDePasse: MOT_DE_PASSE }, 'saisie');
    l.info({ job: { mandataire: { motDePasse: MOT_DE_PASSE } } }, 'réclamation');
    l.info({ mandataire: { motDePasse: MOT_DE_PASSE } }, 'réclamation');
    l.info({ req: { headers: { 'proxy-authorization': `Basic ${jeton}` } } }, 'requête');
    l.info({ tunnel: { 'Proxy-Authorization': `Basic ${jeton}` } }, 'tunnel');
    const tout = lignes.join('');
    expect(tout).not.toContain(MOT_DE_PASSE);
    expect(tout).not.toContain(jeton);
  });
});

describe('remise à l’exécutant', () => {
  const ouvrirVeille = () => t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
  const enFile = () =>
    t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cisa-kev', 'manuel', 'test')",
    );

  it('veille : les paramètres sont joints seulement si le mandataire est actif ; l’état le dit sans adresse', async () => {
    await ouvrirVeille();
    // Inactif : demande inchangée, sans mandataire.
    await enFile();
    let job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    expect(job).not.toHaveProperty('mandataire');
    await t.svc.vulnerabilites.veille.terminer(job.id as string, { ok: false, bilan: null, erreur: 'Essai.' });

    expect((await enregistrer({ autoriteCertification: AUTORITE })).statusCode).toBe(200);
    await admin.put(`${base}/mot-de-passe`, { password: MOT_DE_PASSE });
    await enFile();
    job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    expect(job.mandataire).toEqual({
      hote: 'mandataire.exemple.test',
      port: 3128,
      identifiant: 'compte-veille',
      motDePasse: MOT_DE_PASSE,
      autorite: AUTORITE,
    });
    // Le journal de la réclamation ne garde rien du mandataire.
    expect(JSON.stringify(await audits('vulnerabilites.veille.%'))).not.toContain(MOT_DE_PASSE);
    expect(JSON.stringify(await audits('vulnerabilites.veille.%'))).not.toContain('mandataire.exemple.test');
    await t.svc.vulnerabilites.veille.terminer(job.id as string, { ok: false, bilan: null, erreur: 'Essai.' });

    // CERT Santé (lot V4c) : le flux et les fiches sont lus dans la même collecte ; les paramètres du mandataire sont
    // joints comme pour les autres sources, à côté des fiches déjà lues.
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cert-sante', 'manuel', 'test')",
    );
    job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    expect(job).toMatchObject({
      source: 'cert-sante',
      parametres: { lues: {} },
      mandataire: { hote: 'mandataire.exemple.test', port: 3128, identifiant: 'compte-veille' },
    });
    await t.svc.vulnerabilites.veille.terminer(job.id as string, { ok: false, bilan: null, erreur: 'Essai.' });

    const etat = (await admin.get('/api/vulnerabilites/veille/etat')).json();
    expect(etat.mandataire).toEqual({ actif: true });
    expect(JSON.stringify(etat)).not.toContain('mandataire.exemple.test');
    expect((await admin.get('/api/admin/flux-externes')).json().mandataire).toEqual({ actif: true });

    // IPv6 : l'hôte est remis sans crochets ; sans identifiant, aucun mot de passe n'est remis.
    expect((await enregistrer({ adresse: 'http://[2001:db8::8]:3128', identifiant: '' })).statusCode).toBe(200);
    await enFile();
    job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    expect(job.mandataire).toMatchObject({ hote: '2001:db8::8', port: 3128, identifiant: '', motDePasse: '' });
    await t.svc.vulnerabilites.veille.terminer(job.id as string, { ok: false, bilan: null, erreur: 'Essai.' });

    // Désactivé : plus rien n'est joint.
    expect(
      (await enregistrer({ actif: false, adresse: 'http://[2001:db8::8]:3128', identifiant: '' })).statusCode,
    ).toBe(200);
    await enFile();
    job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    expect(job).not.toHaveProperty('mandataire');
    expect((await admin.get('/api/vulnerabilites/veille/etat')).json().mandataire).toEqual({ actif: false });
  });

  it('réglage enregistré illisible : la collecte est close, jamais faite en direct', async () => {
    await ouvrirVeille();
    await t.svc.db.q(
      `INSERT INTO settings(key, value) VALUES ('systeme:mandataire', '{"values": {"actif": true, "adresse": "pas une adresse"}, "version": 3}')`,
    );
    await enFile();
    expect(await t.svc.vulnerabilites.veille.reclamer(true)).toBeNull();
    const c = await t.svc.db.one<{ etat: string; erreur: string }>(
      'SELECT etat, erreur FROM vulnerabilites_veille_collectes',
    );
    expect(c).toMatchObject({ etat: 'echec', erreur: expect.stringContaining('mandataire sortant illisible') });
  });

  it('intégration (Tenable) : jamais de paramètres de mandataire, même actif', async () => {
    expect((await enregistrer()).statusCode).toBe(200);
    await admin.put(`${base}/mot-de-passe`, { password: MOT_DE_PASSE });
    const r = await admin.post('/api/integrations/instances', {
      type: 'tenable',
      nom: 'Tenable fictif',
      configuration: { adresse: 'https://tenable.exemple.invalid' },
    });
    expect(r.statusCode, r.body).toBe(201);
    const instance = r.json().id as string;
    await admin.put(`/api/integrations/instances/${instance}/secrets`, {
      accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
    });
    const a = await admin.put(
      `/api/integrations/instances/${instance}/activation`,
      { actif: true, fluxConfirme: true },
      { 'if-match': `"${r.json().version}"` },
    );
    expect(a.statusCode, a.body).toBe(200);
    await t.svc.db.q(
      "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'tester', 'manuel', 'test')",
      [instance],
    );
    const job = (await t.svc.integrations.reclamer(true))!;
    expect(job).toBeTruthy();
    expect(Object.keys(job).sort()).toEqual(['configuration', 'id', 'operation', 'secrets', 'type']);
    expect(JSON.stringify(job)).not.toContain(MOT_DE_PASSE);
    expect(JSON.stringify(job)).not.toContain('mandataire.exemple.test');
  });
});
