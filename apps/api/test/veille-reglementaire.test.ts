/* Veille réglementaire (ADR 0110, lot VR-1) : migration 098 sur base vierge, droits (lecture du module ; qualification par
   le rôle RSSI pour la sécurité et par le droit réservé « DPO » pour les données personnelles (rôle personnalisé, qui ouvre
   aussi la lecture à lui seul ; donné ni à l'administrateur ni au RSSI d'office), administrateur compris refusé ; réglage
   des sources et « Collecter maintenant » avec administrer), If-Match, journal, filtres et recherche, synthèse, cycle
   réclamation -> lot -> fin par le service et par la vraie CLI de l'exécutant, éléments refusés (ANSSI avec résumé, lien hors
   hôte), flux fermé ou module désactivé, planification par source activée, file indépendante de la veille des
   vulnérabilités ; ANS et Légifrance sans collecteur ; filtre d'EUR-Lex par mots-clés (liste par défaut remise avec la
   collecte, domaine déduit du mot trouvé, données personnelles l'emporte, réglage administrer, If-Match, journal).
   Données fictives ; aucune source n'est jointe. */
import { MOTS_CLES_EURLEX_DEFAUT } from '@suivi/shared';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp, type TestUser } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const base = '/api/veille-reglementaire';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent,
  rssi: Agent,
  dpo: Agent,
  lecteur: Agent,
  sansDroit: Agent,
  contributeur: Agent,
  contributeurDpo: Agent;
let uRssi: TestUser, uDpo: TestUser;

const pub = (n: number, source = 'cnil', extra: Record<string, unknown> = {}) => {
  const hotes: Record<string, string> = {
    cnil: 'www.cnil.fr',
    cepd: 'www.edpb.europa.eu',
    'eur-lex': 'eur-lex.europa.eu',
    anssi: 'cyber.gouv.fr',
  };
  return {
    identifiant: `fictif-${source}-${n}`,
    titre: `Publication fictive ${n} (${source})`,
    resume: source === 'anssi' ? null : `Résumé fictif ${n}.`,
    lien: `https://${hotes[source]}/fictif/${n}`,
    publieLe: `2026-11-${String(10 + n).padStart(2, '0')}T08:00:00.000Z`,
    ...extra,
  };
};
const bilan = (elements: number) => ({
  ok: true,
  bilan: { elements, ecartes: 0, tronque: false, detailsEchoues: 0 },
  erreur: null,
});
const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
const ouvrir = () => t.svc.flux.changer('veille-reglementaire', true, SYSTEME, '127.0.0.1');
const veille = () => t.svc.veilleReglementaire;
/** Une collecte de la source, réclamée, lot rangé, terminée. */
async function collecte(source: string, elements: unknown[]) {
  await t.svc.db.q(
    "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ($1, 'manuel', 'test')",
    [source],
  );
  const job = (await veille().reclamer(true))!;
  expect(job.source).toBe(source);
  if (elements.length) await veille().lot(job.id as string, { elements });
  await veille().terminer(job.id as string, bilan(elements.length));
  return job;
}
const idDe = async (identifiant: string) =>
  (await t.svc.db.one<{ id: string; version: number }>(
    'SELECT id, version FROM veille_reglementaire_publications WHERE identifiant = $1',
    [identifiant],
  ))!;

/** Lance « suivi <commande> » comme l'exécutant (`docker compose exec -T app suivi`), sur la base du test. */
function cli(args: string[], stdin = '') {
  return new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
    const enfant = spawn(
      path.join(REPO, 'apps/api/node_modules/.bin/tsx'),
      ['--conditions=source', path.join(REPO, 'apps/api/src/cli.ts'), ...args],
      {
        cwd: path.join(REPO, 'apps/api'),
        env: {
          ...process.env,
          DB_HOST: PG.host,
          DB_PORT: String(PG.port),
          DB_NAME: t.dbName,
          DB_USER: APP_ROLE,
          DB_PASSWORD: APP_ROLE_PASSWORD,
          DOC_MASTER_KEY: t.svc.cfg.masterKey,
          SECRETS_DIR: '/nonexistent',
          LOG_LEVEL: 'silent',
        },
      },
    );
    let out = '',
      err = '';
    enfant.stdout.on('data', (d) => (out += d));
    enfant.stderr.on('data', (d) => (err += d));
    enfant.on('error', reject);
    enfant.on('close', (code) => resolve({ code, out, err }));
    enfant.stdin.on('error', () => {});
    enfant.stdin.end(stdin);
  });
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'vr_admin', 'admin'));
  uRssi = await makeUser(t, 'vr_rssi', 'rssi');
  rssi = await login(t, uRssi);
  // Droit spécial « DPO » (décision du RSSI du 20/11/2026) : accordé par un rôle personnalisé qui n'a que lui.
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_vr_lecteur', 'Veille réglementaire, lecture', ARRAY['veille_reglementaire:lire']),
       ('r_vr_dpo', 'DPO seul', ARRAY['veille_reglementaire:dpo'])`,
  );
  uDpo = await makeUser(t, 'vr_dpo', 'r_vr_dpo');
  dpo = await login(t, uDpo);
  // « Contributeur + DPO » : un profil, plus le droit spécial cumulé par un second rôle.
  const contribDpo = await makeUser(t, 'vr_contrib_dpo', 'rw');
  await t.svc.db.q("INSERT INTO user_roles(user_id, role_id) VALUES ($1, 'r_vr_dpo')", [contribDpo.id]);
  contributeurDpo = await login(t, contribDpo);
  lecteur = await login(t, await makeUser(t, 'vr_lecteur', 'r_vr_lecteur'));
  contributeur = await login(t, await makeUser(t, 'vr_contrib', 'rw'));
  sansDroit = await login(t, await makeUser(t, 'vr_sans_droit', null));
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'veille_reglementaire_collectes',
    'veille_reglementaire_publications',
    'veille_reglementaire_sources',
    'vulnerabilites_veille_collectes',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.db.q("DELETE FROM flux_externes WHERE module IN ('veille-reglementaire', 'veille-vulnerabilites')");
  await t.svc.db.q('DELETE FROM backup_worker');
  t.svc.limits.veilleCollecte.reset();
});

describe('veille réglementaire : schéma et rôle', () => {
  it('migration 098 : tables vides, aucun rôle prédéfini ajouté, aucun compte touché', async () => {
    expect(await n('veille_reglementaire_publications')).toBe(0);
    // Plus de rôle prédéfini « DPO » : les rôles prédéfinis sont ceux de la migration 003.
    expect(
      (await t.svc.db.q<{ id: string }>('SELECT id FROM roles WHERE system ORDER BY id')).rows.map((r) => r.id),
    ).toEqual(['administrateur', 'auditeur_externe', 'contributeur', 'lecteur', 'rssi']);
    // La migration ne donne le droit « DPO » à aucun rôle stocké.
    expect(await n('roles', "'veille_reglementaire:dpo' = ANY(permissions) AND id <> 'r_vr_dpo'")).toBe(0);
    // La base refuse ce que le code refuse : résumé de l'ANSSI, lien hors hôte, Légifrance activée.
    await expect(
      t.svc.db.q(
        "INSERT INTO veille_reglementaire_publications (source, domaine, identifiant, titre, resume, lien, publie_le) VALUES ('anssi', 'securite', 'x', 'T', 'R', 'https://cyber.gouv.fr/x', now())",
      ),
    ).rejects.toThrow();
    await expect(
      t.svc.db.q(
        "INSERT INTO veille_reglementaire_publications (source, domaine, identifiant, titre, lien, publie_le) VALUES ('cnil', 'donnees-personnelles', 'x', 'T', 'https://exemple.invalid/x', now())",
      ),
    ).rejects.toThrow();
    await expect(
      t.svc.db.q("INSERT INTO veille_reglementaire_sources (source, activee) VALUES ('legifrance', true)"),
    ).rejects.toThrow();
  });
});

describe('veille réglementaire : droits de lecture', () => {
  it('lire : synthèse, publications, sources ; sans droit, 403 ; module désactivé, 409', async () => {
    // Le droit « DPO » ouvre la lecture à lui seul.
    for (const a of [admin, rssi, dpo, lecteur, contributeurDpo])
      for (const url of ['/synthese', '/publications', '/sources', '/droits'])
        expect((await a.get(base + url)).statusCode, url).toBe(200);
    // Le contributeur et le lecteur v2 n'ont pas le module (hors des modules métier, comme les vulnérabilités).
    for (const a of [sansDroit, contributeur])
      for (const url of ['/synthese', '/publications', '/sources'])
        expect((await a.get(base + url)).statusCode, url).toBe(403);
    await t.svc.db.q("UPDATE module_activation SET disabled='{veille_reglementaire}', version=version+1 WHERE id=1");
    expect((await admin.get(base + '/synthese')).statusCode).toBe(409);
  });

  it('droits affichés : RSSI la sécurité, DPO les données personnelles, administrateur aucun domaine', async () => {
    expect((await rssi.get(base + '/droits')).json()).toEqual({
      administrer: true,
      qualifier: { securite: true, donneesPersonnelles: false },
    });
    expect((await dpo.get(base + '/droits')).json()).toEqual({
      administrer: false,
      qualifier: { securite: false, donneesPersonnelles: true },
    });
    expect((await contributeurDpo.get(base + '/droits')).json().qualifier).toEqual({
      securite: false,
      donneesPersonnelles: true,
    });
    expect((await admin.get(base + '/droits')).json()).toEqual({
      administrer: true,
      qualifier: { securite: false, donneesPersonnelles: false },
    });
  });
});

describe('veille réglementaire : collecte', () => {
  it('flux fermé : rien n’est réclamé, la collecte en file est close ; « Collecter maintenant » refusé', async () => {
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ('cnil', 'manuel', 'test')",
    );
    expect(await veille().reclamer(true)).toBeNull();
    expect(await n('veille_reglementaire_collectes', "etat = 'echec'")).toBe(1);
    expect((await admin.post(base + '/collectes', {})).statusCode).toBe(409);
    expect(await veille().planifier()).toEqual([]);
  });

  it('module désactivé : rien n’est remis même flux ouvert', async () => {
    await ouvrir();
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ('cnil', 'manuel', 'test')",
    );
    expect(await veille().reclamer(false)).toBeNull();
    expect(await n('veille_reglementaire_collectes', "etat = 'echec'")).toBe(1);
  });

  it('activation du flux par la route commune (administrateur, validation explicite) ; RSSI refusé', async () => {
    expect(
      (await rssi.put('/api/admin/flux-externes/veille-reglementaire', { ouvert: true, confirmation: true }))
        .statusCode,
    ).toBe(403);
    const r = await admin.put('/api/admin/flux-externes/veille-reglementaire', { ouvert: true, confirmation: true });
    expect(r.statusCode).toBe(200);
    expect((await admin.get(base + '/sources')).json().flux.ouvert).toBe(true);
    // Désactiver le module referme le flux.
    const intent = { changes: [{ id: 'veille_reglementaire', enabled: false }], cascade: false };
    const apercu = await admin.post('/api/admin/modules/preview', intent);
    expect(apercu.statusCode, apercu.body).toBe(200);
    const d = await admin.put(
      '/api/admin/modules',
      { intent, previewId: apercu.json().previewId, confirm: 'VALIDER' },
      { 'if-match': `"${apercu.json().version}"` },
    );
    expect(d.statusCode, d.body).toBe(200);
    expect(await t.svc.flux.ouvert('veille-reglementaire')).toBe(false);
  });

  it('cycle complet : publications rangées sans doublon, domaine de la source, qualification gardée au rejeu', async () => {
    await ouvrir();
    await collecte('cnil', [pub(1), pub(2)]);
    await collecte('anssi', [pub(3, 'anssi')]);
    expect(await n('veille_reglementaire_publications')).toBe(3);
    expect(await n('veille_reglementaire_publications', "source = 'cnil' AND domaine = 'donnees-personnelles'")).toBe(
      2,
    );
    expect(await n('veille_reglementaire_publications', "source = 'anssi' AND domaine = 'securite'")).toBe(1);
    const p1 = await idDe('fictif-cnil-1');
    await t.svc.db.q(
      "UPDATE veille_reglementaire_publications SET statut = 'a-suivre', qualifie_le = now() WHERE id = $1",
      [p1.id],
    );
    await collecte('cnil', [pub(1, 'cnil', { titre: 'Titre corrigé par la source' }), pub(2)]);
    expect(await n('veille_reglementaire_publications')).toBe(3);
    const l = await t.svc.db.one<{ titre: string; statut: string }>(
      'SELECT titre, statut FROM veille_reglementaire_publications WHERE id = $1',
      [p1.id],
    );
    expect(l).toEqual({ titre: 'Titre corrigé par la source', statut: 'a-suivre' });
    const etat = (await admin.get(base + '/sources')).json();
    const cnil = etat.sources.find((s: { source: string }) => s.source === 'cnil');
    expect(cnil.derniereReussite).not.toBeNull();
    expect(cnil.derniereCollecte.etat).toBe('recu');
    expect(etat.sources.find((s: { source: string }) => s.source === 'legifrance').collecteur).toBe(false);
  });

  it('élément refusé : résumé pour l’ANSSI, lien hors hôte ou hors https, texte non nettoyé ; tout le lot', async () => {
    await ouvrir();
    for (const [source, mauvais] of [
      ['anssi', pub(1, 'anssi', { resume: 'Interdit.' })],
      ['cnil', pub(1, 'cnil', { lien: 'https://exemple.invalid/x' })],
      ['cnil', pub(1, 'cnil', { lien: 'http://www.cnil.fr/x' })],
      ['cepd', pub(1, 'cepd', { lien: 'https://www.cnil.fr/x' })],
      ['cnil', pub(1, 'cnil', { titre: '<b>balise</b>' })],
      ['cnil', pub(1, 'cnil', { inattendu: true })],
    ] as const) {
      await t.svc.db.q(
        "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ($1, 'manuel', 'test')",
        [source],
      );
      const job = (await veille().reclamer(true))!;
      await expect(veille().lot(job.id as string, { elements: [pub(9, source), mauvais] })).rejects.toMatchObject({
        status: 422,
      });
      await veille().terminer(job.id as string, { ok: false, bilan: null, erreur: 'Lot refusé.' });
    }
    expect(await n('veille_reglementaire_publications')).toBe(0);
  });

  it('par la vraie CLI : claim, lot, finish ; entrée invalide refusée (code 2)', async () => {
    await ouvrir();
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ('anssi', 'manuel', 'test')",
    );
    const claim = await cli(['veille-reglementaire-claim']);
    expect(claim.code).toBe(0);
    const job = JSON.parse(claim.out) as { id: string; source: string; parametres: unknown };
    expect(job).toMatchObject({ source: 'anssi', parametres: {} });
    const lot = await cli(['veille-reglementaire-lot', job.id], JSON.stringify({ elements: [pub(1, 'anssi')] }));
    expect(lot.code).toBe(0);
    expect(JSON.parse(lot.out)).toEqual({ elements: 1, lots: 1 });
    expect((await cli(['veille-reglementaire-lot', job.id], '{"elements": [], "x": 1}')).code).toBe(2);
    expect((await cli(['veille-reglementaire-finish', 'pas-un-uuid'], JSON.stringify(bilan(1)))).code).toBe(2);
    expect((await cli(['veille-reglementaire-finish', job.id], JSON.stringify(bilan(1)))).code).toBe(0);
    expect(await n('veille_reglementaire_collectes', "etat = 'recu'")).toBe(1);
    expect(await n('veille_reglementaire_publications', "source = 'anssi' AND resume IS NULL")).toBe(1);
    // La file de la veille des vulnérabilités n'est pas touchée.
    expect(await n('vulnerabilites_veille_collectes')).toBe(0);
  }, 60_000);

  it('réglage d’une source : administrer, If-Match, liste fermée, Légifrance sans collecteur, journal', async () => {
    const lire = async () =>
      (await admin.get(base + '/sources')).json().sources.find((s: { source: string }) => s.source === 'cepd') as {
        version: number;
        activee: boolean;
      };
    const v = (await lire()).version;
    expect((await dpo.patch(base + '/sources/cepd', { activee: true }, { 'if-match': `"${v}"` })).statusCode).toBe(403);
    expect((await admin.patch(base + '/sources/cepd', { activee: true })).statusCode).toBe(428);
    expect(
      (await admin.patch(base + '/sources/cepd', { frequenceHeures: 2 }, { 'if-match': `"${v}"` })).statusCode,
    ).toBe(422);
    expect((await admin.patch(base + '/sources/legifrance', { activee: true }, { 'if-match': '"1"' })).statusCode).toBe(
      422,
    );
    // ANS : aucun flux public connu, ni activation ni collecte (code et base).
    expect((await admin.patch(base + '/sources/ans', { activee: true }, { 'if-match': '"1"' })).statusCode).toBe(422);
    await expect(
      t.svc.db.q("INSERT INTO veille_reglementaire_sources (source, activee) VALUES ('ans', true)"),
    ).rejects.toThrow();
    await expect(
      t.svc.db.q(
        "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ('ans', 'manuel', 'test')",
      ),
    ).rejects.toThrow();
    const ans = (await admin.get(base + '/sources')).json().sources.find((x: { source: string }) => x.source === 'ans');
    expect(ans).toMatchObject({ collecteur: false, hote: null, reprise: 'Non disponible : aucun flux public connu.' });
    const ok = await admin.patch(
      base + '/sources/cepd',
      { activee: true, frequenceHeures: 12 },
      { 'if-match': `"${v}"` },
    );
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ activee: true, frequenceHeures: 12, version: v + 1 });
    expect(ok.headers.etag).toBe(`"${v + 1}"`);
    expect((await admin.patch(base + '/sources/cepd', { activee: false }, { 'if-match': `"${v}"` })).statusCode).toBe(
      412,
    );
    expect((await audits('veille_reglementaire.source.reglee')).at(-1)!.details).toEqual({
      source: 'cepd',
      avant: { activee: false, frequenceHeures: 24 },
      apres: { activee: true, frequenceHeures: 12 },
    });
  });

  it('planification : seules les sources activées, une fois par période ; « Collecter maintenant » les seules activées', async () => {
    await ouvrir();
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_sources (source, activee, frequence_heures) VALUES ('cnil', true, 4), ('anssi', true, NULL), ('cepd', false, NULL)",
    );
    const maintenant = new Date();
    expect((await veille().planifier(maintenant)).length).toBe(2);
    expect(await veille().planifier(maintenant)).toEqual([]);
    expect(await n('veille_reglementaire_collectes')).toBe(2);
    expect(await n('veille_reglementaire_collectes', "source = 'cepd'")).toBe(0);
    // Cinq heures plus tard : la CNIL (4 h) est due, l'ANSSI (24 h par défaut) non ; la collecte de la CNIL est encore en
    // file, elle tient lieu de la nouvelle.
    expect(await veille().planifier(new Date(maintenant.getTime() + 5 * 3_600_000))).toEqual([]);
    await t.svc.db.q('DELETE FROM veille_reglementaire_collectes');
    // « Collecter maintenant » : exécutant exigé, puis seules les sources activées sont inscrites.
    expect((await admin.post(base + '/collectes', {})).statusCode).toBe(503);
    await t.svc.backups.heartbeat(true);
    expect((await rssi.post(base + '/collectes', { source: 'cepd' })).statusCode).toBe(409);
    expect((await dpo.post(base + '/collectes', {})).statusCode).toBe(403);
    const r = await rssi.post(base + '/collectes', {});
    expect(r.statusCode).toBe(201);
    expect((r.json() as { source: string }[]).map((c) => c.source).sort()).toEqual(['anssi', 'cnil']);
    expect((await rssi.post(base + '/collectes', {})).statusCode).toBe(409);
  });
});

describe('veille réglementaire : filtre d’EUR-Lex par mots-clés', () => {
  it('la liste en vigueur part avec la collecte ; seuls les actes avec un mot-clé sont rangés, domaine déduit', async () => {
    await ouvrir();
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ('eur-lex', 'manuel', 'test')",
    );
    const job = (await veille().reclamer(true))!;
    expect(job.parametres).toEqual({ motsCles: [...MOTS_CLES_EURLEX_DEFAUT] });
    const elements = [
      pub(1, 'eur-lex', { titre: 'Regulation on Cybersecurity of products' }),
      pub(2, 'eur-lex', { titre: 'Directive on PERSONAL DATA and network and information security' }),
      pub(3, 'eur-lex', { titre: 'Decision on fisheries quotas' }),
      pub(4, 'eur-lex', { titre: 'Règlement sur les données de santé' }),
    ];
    // Les quatre sont reçus (le script filtre déjà) ; l'API revérifie et ne range pas celui sans mot-clé.
    expect(await veille().lot(job.id as string, { elements })).toEqual({ elements: 4, lots: 1 });
    await veille().terminer(job.id as string, bilan(4));
    const rangees = (
      await t.svc.db.q<{ identifiant: string; domaine: string }>(
        "SELECT identifiant, domaine FROM veille_reglementaire_publications WHERE source = 'eur-lex' ORDER BY identifiant",
      )
    ).rows;
    expect(rangees).toEqual([
      { identifiant: 'fictif-eur-lex-1', domaine: 'securite' },
      // Les deux domaines trouvés : données personnelles l'emporte.
      { identifiant: 'fictif-eur-lex-2', domaine: 'donnees-personnelles' },
      { identifiant: 'fictif-eur-lex-4', domaine: 'donnees-personnelles' },
    ]);
  });

  it('réglage : administrer, If-Match, bornes et doublons refusés, autre source 422, journal, retour au défaut', async () => {
    const eurlex = async () =>
      (await admin.get(base + '/sources')).json().sources.find((x: { source: string }) => x.source === 'eur-lex') as {
        version: number;
        motsCles: { liste: unknown[]; parDefaut: boolean };
      };
    const avant = await eurlex();
    expect(avant.motsCles).toEqual({ liste: [...MOTS_CLES_EURLEX_DEFAUT], parDefaut: true });
    const url = base + '/sources/eur-lex/mots-cles';
    const liste = [
      { mot: 'Fisheries', domaine: 'securite' },
      { mot: 'données personnelles', domaine: 'donnees-personnelles' },
    ];
    const im = { 'if-match': `"${avant.version}"` };
    expect((await dpo.put(url, { motsCles: liste }, im)).statusCode).toBe(403);
    expect((await rssi.put(url, { motsCles: liste })).statusCode).toBe(428);
    for (const mauvais of [
      [],
      [{ mot: 'x', domaine: 'securite' }],
      [{ mot: 'a'.repeat(61), domaine: 'securite' }],
      [{ mot: 'privacy', domaine: 'autre' }],
      [
        { mot: 'Données', domaine: 'securite' },
        { mot: 'donnees', domaine: 'donnees-personnelles' },
      ],
      Array.from({ length: 61 }, (_x, i) => ({ mot: `mot ${i}`, domaine: 'securite' })),
    ])
      expect((await rssi.put(url, { motsCles: mauvais }, im)).statusCode, JSON.stringify(mauvais).slice(0, 60)).toBe(
        422,
      );
    expect(
      (await rssi.put(base + '/sources/cnil/mots-cles', { motsCles: liste }, { 'if-match': '"1"' })).statusCode,
    ).toBe(422);
    const ok = await rssi.put(url, { motsCles: liste }, im);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().motsCles).toEqual({ liste, parDefaut: false });
    expect(ok.headers.etag).toBe(`"${avant.version + 1}"`);
    expect((await rssi.put(url, { motsCles: null }, im)).statusCode).toBe(412);
    expect((await audits('veille_reglementaire.mots_cles.regles')).at(-1)!.details).toMatchObject({
      source: 'eur-lex',
      avant: { parDefaut: true },
      apres: { parDefaut: false, motsCles: liste },
    });
    // La liste réglée part avec la collecte suivante.
    await ouvrir();
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_collectes (source, origine, demande_par) VALUES ('eur-lex', 'manuel', 'test')",
    );
    expect((await veille().reclamer(true))!.parametres).toEqual({ motsCles: liste });
    const remise = await rssi.put(url, { motsCles: null }, { 'if-match': `"${avant.version + 1}"` });
    expect(remise.json().motsCles.parDefaut).toBe(true);
  });
});

describe('veille réglementaire : qualification', () => {
  beforeEach(async () => {
    await ouvrir();
    await collecte('cnil', [pub(1), pub(2)]);
    await collecte('anssi', [pub(3, 'anssi')]);
    await collecte('eur-lex', [pub(4, 'eur-lex', { titre: 'Publication fictive 4 on cybersecurity (eur-lex)' })]);
  });

  it('RSSI qualifie la sécurité, DPO les données personnelles ; l’inverse, l’administrateur et le lecteur : 403', async () => {
    // Administrateur qui reçoit aussi le droit « DPO » par un rôle personnalisé (connecté avant le relevé du journal).
    const adminDpo = await makeUser(t, 'vr_admin_dpo', 'admin');
    await t.svc.db.q("INSERT INTO user_roles(user_id, role_id) VALUES ($1, 'r_vr_dpo')", [adminDpo.id]);
    const aDpo = await login(t, adminDpo);
    const debut = (await t.svc.db.one<{ m: number }>('SELECT coalesce(max(id), 0)::int AS m FROM audit_log'))!.m;
    const securite = await idDe('fictif-anssi-3');
    const donnees = await idDe('fictif-cnil-1');
    const qualifier = (a: Agent, p: { id: string; version: number }, statut = 'impactant') =>
      a.patch(`${base}/publications/${p.id}`, { statut }, { 'if-match': `"${p.version}"` });
    for (const a of [dpo, admin, lecteur]) expect((await qualifier(a, securite)).statusCode).toBe(403);
    // Données personnelles : le droit « DPO », que ni le RSSI ni l'administrateur n'ont d'office.
    for (const a of [rssi, admin, lecteur]) expect((await qualifier(a, donnees)).statusCode).toBe(403);
    for (const a of [admin, rssi])
      expect((await a.get('/api/auth/me')).json().permissions).not.toContain('veille_reglementaire:dpo');
    expect((await qualifier(sansDroit, securite)).statusCode).toBe(403);
    const r = await qualifier(rssi, securite);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      statut: 'impactant',
      qualifiePar: { id: uRssi.id, nom: 'Nom vr_rssi' },
      suites: { exigences: 0, actions: 0, documents: 0 },
      version: securite.version + 1,
    });
    expect(r.headers.etag).toBe(`"${securite.version + 1}"`);
    // Administrateur (ou RSSI) qui reçoit le droit « DPO » par un rôle personnalisé : il qualifie les données personnelles.
    const autre = await idDe('fictif-cnil-2');
    expect((await qualifier(aDpo, autre, 'a-suivre')).statusCode).toBe(200);
    const d = await qualifier(dpo, donnees, 'sans-objet');
    expect(d.statusCode).toBe(200);
    expect(d.json().qualifiePar).toEqual({ id: uDpo.id, nom: 'Nom vr_dpo' });
    expect((await audits('veille_reglementaire.publication.qualifiee')).map((x) => x.details)).toEqual([
      { source: 'anssi', domaine: 'securite', avant: 'a-qualifier', apres: 'impactant' },
      { source: 'cnil', domaine: 'donnees-personnelles', avant: 'a-qualifier', apres: 'a-suivre' },
      { source: 'cnil', domaine: 'donnees-personnelles', avant: 'a-qualifier', apres: 'sans-objet' },
    ]);
    // Rien n'est écrit ailleurs (référentiels, actions, documents) : hors de cette tranche. Les seules entrées du journal
    // depuis le début du test sont les deux qualifications.
    expect(
      (
        await t.svc.db.q<{ action: string }>('SELECT action FROM audit_log WHERE id > $1 ORDER BY id', [debut])
      ).rows.map((x) => x.action),
    ).toEqual([
      'veille_reglementaire.publication.qualifiee',
      'veille_reglementaire.publication.qualifiee',
      'veille_reglementaire.publication.qualifiee',
    ]);
  });

  it('droit « DPO » tenu par un groupe ou cumulé à un profil : accepté ; restreint à d’autres modules ou module désactivé : refusé', async () => {
    const membre = await makeUser(t, 'vr_dpo_groupe', null);
    const g = await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('DPO du groupe') RETURNING id");
    await t.svc.db.q("INSERT INTO group_roles(group_id, role_id) VALUES ($1, 'r_vr_dpo')", [g!.id]);
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1, $2)', [membre.id, g!.id]);
    const a = await login(t, membre);
    const p = await idDe('fictif-cnil-2');
    expect(
      (await a.patch(`${base}/publications/${p.id}`, { statut: 'a-suivre' }, { 'if-match': `"${p.version}"` }))
        .statusCode,
    ).toBe(200);
    const c = await idDe('fictif-cnil-1');
    expect(
      (
        await contributeurDpo.patch(
          `${base}/publications/${c.id}`,
          { statut: 'sans-objet' },
          {
            'if-match': `"${c.version}"`,
          },
        )
      ).statusCode,
    ).toBe(200);
    const restreint = await makeUser(t, 'vr_dpo_restreint', 'r_vr_dpo', { modules: ['documents'] });
    const b = await login(t, restreint);
    // Portée qui écarte le module : ni lecture, ni qualification.
    expect((await b.get(base + '/publications')).statusCode).toBe(403);
    // Module désactivé : le droit est retiré avec lui.
    await t.svc.db.q("UPDATE module_activation SET disabled='{veille_reglementaire}', version=version+1 WHERE id=1");
    expect((await dpo.get(base + '/publications')).statusCode).toBe(409);
    expect((await dpo.get('/api/auth/me')).json().permissions).not.toContain('veille_reglementaire:dpo');
  });

  it('If-Match : absent 428, périmé 412, statut inconnu ou « à qualifier » 422, publication inconnue 404', async () => {
    const p = await idDe('fictif-anssi-3');
    const url = `${base}/publications/${p.id}`;
    expect((await rssi.patch(url, { statut: 'a-suivre' })).statusCode).toBe(428);
    expect((await rssi.patch(url, { statut: 'a-qualifier' }, { 'if-match': `"${p.version}"` })).statusCode).toBe(422);
    expect((await rssi.patch(url, { statut: 'a-suivre' }, { 'if-match': `"${p.version}"` })).statusCode).toBe(200);
    const perime = await rssi.patch(url, { statut: 'impactant' }, { 'if-match': `"${p.version}"` });
    expect(perime.statusCode).toBe(412);
    expect(perime.json().current).toMatchObject({ version: p.version + 1, statut: 'a-suivre' });
    expect(
      (
        await rssi.patch(
          `${base}/publications/00000000-0000-4000-8000-00000000abcd`,
          { statut: 'a-suivre' },
          { 'if-match': '"1"' },
        )
      ).statusCode,
    ).toBe(404);
    // CSRF : sans jeton, refusé.
    expect(
      (
        await rssi.req('PATCH', url, {
          json: { statut: 'impactant' },
          headers: { 'if-match': `"${p.version + 1}"` },
          csrf: false,
        })
      ).statusCode,
    ).toBe(403);
  });

  it('filtres, recherche, pagination et synthèse', async () => {
    const liste = async (q: string) => (await lecteur.get(`${base}/publications${q}`)).json();
    const tout = await liste('');
    expect(tout).toMatchObject({ total: 4, page: 1, parPage: 25 });
    // Les plus récentes d'abord.
    expect(tout.elements.map((e: { titre: string }) => e.titre)).toEqual([
      'Publication fictive 4 on cybersecurity (eur-lex)',
      'Publication fictive 3 (anssi)',
      'Publication fictive 2 (cnil)',
      'Publication fictive 1 (cnil)',
    ]);
    expect(tout.elements[1]).toMatchObject({
      source: 'anssi',
      domaine: 'securite',
      resume: null,
      lien: 'https://cyber.gouv.fr/fictif/3',
      statut: 'a-qualifier',
      qualifieLe: null,
      qualifiePar: null,
      suites: { exigences: 0, actions: 0, documents: 0 },
      version: 1,
    });
    expect((await liste('?source=cnil')).total).toBe(2);
    expect((await liste('?domaine=securite')).total).toBe(2);
    expect((await liste('?domaine=donnees-personnelles&source=anssi')).total).toBe(0);
    expect((await liste('?q=fictif%202')).total).toBe(1);
    // Jokers saisis pris à la lettre.
    expect((await liste('?q=%25')).total).toBe(0);
    expect((await lecteur.get(`${base}/publications?statut=inconnu`)).statusCode).toBe(422);
    expect((await lecteur.get(`${base}/publications?page=2`)).json().elements).toEqual([]);
    const p = await idDe('fictif-anssi-3');
    await rssi.patch(`${base}/publications/${p.id}`, { statut: 'impactant' }, { 'if-match': `"${p.version}"` });
    const q = await idDe('fictif-cnil-1');
    await dpo.patch(`${base}/publications/${q.id}`, { statut: 'a-suivre' }, { 'if-match': `"${q.version}"` });
    expect((await liste('?statut=impactant')).total).toBe(1);
    expect((await liste('?statut=a-qualifier')).total).toBe(2);
    await t.svc.db.q(
      "INSERT INTO veille_reglementaire_sources (source, activee, erreur) VALUES ('cepd', true, 'Échec fictif.') ON CONFLICT (source) DO UPDATE SET activee = true, erreur = 'Échec fictif.'",
    );
    const s = (await lecteur.get(`${base}/synthese`)).json();
    expect(s).toMatchObject({
      aQualifier: 2,
      aSuivre: 1,
      impactant: 1,
      sansObjet: 0,
      parDomaine: {
        securite: { aQualifier: 1, aSuivre: 0, impactant: 1, sansObjet: 0 },
        donneesPersonnelles: { aQualifier: 1, aSuivre: 1, impactant: 0, sansObjet: 0 },
      },
      sourcesEnErreur: 1,
    });
    expect(typeof s.derniereCollecteLe).toBe('string');
  });
});
