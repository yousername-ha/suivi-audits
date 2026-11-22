/* Module Vulnérabilités (ADR 0100, lot CPE-1 ; décisions du RSSI du 22/11/2026) : saisie assistée d'un produit surveillé par
   le dictionnaire CPE de la NVD. Migration 101 sur base vierge et contraintes ; droits (liste et versions avec `modifier`,
   état avec `lire`, réglage et copie complète avec `administrer`, If-Match, journal) ; bornes du terme ; recherche sans casse
   ni accent, triée ; saisie en cours et `actif` de la réclamation ; file des versions (une demande par produit, limite par
   personne, cache frais d'un jour, versions de la veille marquées, flux fermé, purge) ; chargement par tranches (curseur,
   tranche unique, échec et nouvel essai, fin, nouveautés à la fréquence, copie complète et sa suppression) ; vraie CLI de
   l'exécutant. Données entièrement fictives (éditeurs et produits inventés) ; aucune source n'est jointe. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TABLES_TRAVAIL } from '../src/remise-a-vide.js';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const base = '/api/vulnerabilites/cpe';
const SYSTEME = { username: 'test' };
let t: TestApp;
let admin: Agent, contributeur: Agent, lecteur: Agent, sansRole: Agent;

const n = async (table: string, where = 'true') =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ details: Record<string, unknown> }>(
      'SELECT details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
const dico = () => t.svc.vulnerabilites.dictionnaireCpe;
const ouvrir = () => t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
const fermer = () => t.svc.flux.changer('veille-vulnerabilites', false, SYSTEME, '127.0.0.1');
const version = async () => (await dico().etat()).version;
const activer = async () => {
  await dico().regler({ activee: true }, await version(), SYSTEME, '127.0.0.1');
};
const produit = (editeur: string, produit: string, intitule: string | null = null, partie = 'a') => ({
  partie,
  editeur,
  produit,
  intitule,
});
/** Range des produits comme une tranche de l'exécutant (réclamée, un lot, close sur la fin du dictionnaire). */
async function charger(produits: ReturnType<typeof produit>[], versions: unknown[] = []) {
  const tranche = (await dico().reclamerTranche(true))!;
  expect(tranche).not.toBeNull();
  await dico().lotTranche(tranche.id as string, { produits, versions });
  await dico().terminerTranche(tranche.id as string, {
    ok: true,
    erreur: null,
    bilan: { total: produits.length, suivant: produits.length, entrees: produits.length, obsoletes: 0, ecartes: 0 },
  });
  return tranche;
}
const reinitialiser = async () => {
  for (const table of [
    'vulnerabilites_cpe_produits',
    'vulnerabilites_cpe_copie',
    'vulnerabilites_cpe_versions',
    'vulnerabilites_cpe_demandes',
    'vulnerabilites_cpe_dictionnaire',
    'vulnerabilites_veille_cve',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
};

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
  admin = await login(t, await makeUser(t, 'cpe_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_cpe_contrib', 'CPE, contribution', ARRAY['vulnerabilites:lire','vulnerabilites:modifier']),
       ('r_cpe_lecteur', 'CPE, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  contributeur = await login(t, await makeUser(t, 'cpe_contrib', 'r_cpe_contrib'));
  lecteur = await login(t, await makeUser(t, 'cpe_lecteur', 'r_cpe_lecteur'));
  sansRole = await login(t, await makeUser(t, 'cpe_sans_role', null));
  for (const a of [admin, contributeur, lecteur, sansRole]) await a.me();
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await reinitialiser();
  await t.svc.db.q("DELETE FROM flux_externes WHERE module = 'veille-vulnerabilites'");
  t.svc.limits.cpeVersions.reset();
});

describe('migration 101 sur base vierge', () => {
  it('crée cinq tables vides, rangées avec le travail, et borne les données en base', async () => {
    expect(
      (
        await t.svc.db.one(
          "SELECT 1 AS ok FROM schema_migrations WHERE name = '101_vulnerabilites_dictionnaire_cpe.sql'",
        )
      )?.ok,
    ).toBe(1);
    const tables = [
      'vulnerabilites_cpe_produits',
      'vulnerabilites_cpe_dictionnaire',
      'vulnerabilites_cpe_demandes',
      'vulnerabilites_cpe_versions',
      'vulnerabilites_cpe_copie',
    ];
    for (const table of tables) {
      expect(await n(table)).toBe(0);
      expect(TABLES_TRAVAIL as readonly string[]).toContain(table);
    }
    // Aucune extension nouvelle (la recherche porte sur une forme normalisée par l'API).
    expect((await t.svc.db.q("SELECT 1 FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')")).rowCount).toBe(0);
    const refus = (q: string) => expect(t.svc.db.q(q)).rejects.toThrow();
    await refus(
      "INSERT INTO vulnerabilites_cpe_produits (partie, editeur, produit, cle, cle_produit) VALUES ('x', 'ed', 'p', 'ed p', 'p')",
    );
    await refus(
      "INSERT INTO vulnerabilites_cpe_produits (partie, editeur, produit, cle, cle_produit) VALUES ('a', '*', 'p', 'p', 'p')",
    );
    await refus(
      "INSERT INTO vulnerabilites_cpe_produits (partie, editeur, produit, cle, cle_produit) VALUES ('a', 'ed', 'p', 'Éd', 'p')",
    );
    await refus(
      "INSERT INTO vulnerabilites_cpe_produits (partie, editeur, produit, intitule, cle, cle_produit) VALUES ('a', 'ed', 'p', E'a\\nb', 'ed p', 'p')",
    );
    await refus('INSERT INTO vulnerabilites_cpe_dictionnaire (id) VALUES (2)');
    await refus('INSERT INTO vulnerabilites_cpe_dictionnaire (id, frequence_heures) VALUES (1, 2)');
    await refus("INSERT INTO vulnerabilites_cpe_dictionnaire (id, mode) VALUES (1, 'nouveautes')");
    await refus('INSERT INTO vulnerabilites_cpe_dictionnaire (id, copie_complete_le) VALUES (1, now())');
    await refus(
      "INSERT INTO vulnerabilites_cpe_versions (partie, editeur, produit, versions) VALUES ('a', 'ed', 'p', array_fill('1'::text, ARRAY[2001]))",
    );
    await refus(
      "INSERT INTO vulnerabilites_cpe_copie (partie, editeur, produit, version) VALUES ('a', 'ed', 'p', '*')",
    );
    await refus(
      "INSERT INTO vulnerabilites_cpe_demandes (partie, editeur, produit, etat, termine_le) VALUES ('a', 'ed', 'p', 'echec', now())",
    );
    // Une seule demande en file ou en cours par produit.
    await t.svc.db.q("INSERT INTO vulnerabilites_cpe_demandes (partie, editeur, produit) VALUES ('a', 'ed', 'p')");
    await refus("INSERT INTO vulnerabilites_cpe_demandes (partie, editeur, produit) VALUES ('a', 'ed', 'p')");
  });
});

describe('droits et bornes', () => {
  it('liste, versions et saisie avec `modifier` ; état avec `lire` ; réglage et copie avec `administrer`', async () => {
    const corps = { partie: 'a', editeur: 'ed', produit: 'p' };
    for (const a of [lecteur, sansRole]) {
      expect((await a.get(`${base}/produits?q=gl`)).statusCode).toBe(403);
      expect((await a.get(`${base}/versions?partie=a&editeur=ed&produit=p`)).statusCode).toBe(403);
      expect((await a.post(`${base}/versions`, corps)).statusCode).toBe(403);
      expect((await a.post(`${base}/saisie`)).statusCode).toBe(403);
    }
    expect((await lecteur.get(`${base}/dictionnaire`)).statusCode).toBe(200);
    expect((await sansRole.get(`${base}/dictionnaire`)).statusCode).toBe(403);
    expect((await contributeur.get(`${base}/produits?q=gl`)).statusCode).toBe(200);
    expect((await contributeur.post(`${base}/saisie`)).statusCode).toBe(200);
    const v = String((await contributeur.get(`${base}/dictionnaire`)).json().version);
    for (const [methode, url] of [
      ['PATCH', `${base}/dictionnaire`],
      ['POST', `${base}/dictionnaire/copie`],
      ['DELETE', `${base}/dictionnaire/copie`],
    ] as const) {
      const r = await contributeur.req(methode, url, {
        json: methode === 'PATCH' ? { activee: true } : undefined,
        headers: { 'if-match': `"${v}"` },
      });
      expect(r.statusCode, url).toBe(403);
    }
    // Module désactivé : 409, comme toute route du module.
    await t.svc.db.q("UPDATE module_activation SET disabled='{vulnerabilites}', version=version+1 WHERE id=1");
    expect((await contributeur.get(`${base}/produits?q=gl`)).statusCode).toBe(409);
  });

  it('terme de 2 à 100 caractères, champ inattendu refusé ; identité CPE contrôlée', async () => {
    expect((await contributeur.get(`${base}/produits?q=g`)).statusCode).toBe(422);
    expect((await contributeur.get(`${base}/produits?q=${'x'.repeat(101)}`)).statusCode).toBe(422);
    expect((await contributeur.get(`${base}/produits?q=gl&limite=500`)).statusCode).toBe(422);
    expect((await contributeur.post(`${base}/versions`, { partie: 'z', editeur: 'ed', produit: 'p' })).statusCode).toBe(
      422,
    );
    expect((await contributeur.post(`${base}/versions`, { partie: 'a', editeur: '*', produit: 'p' })).statusCode).toBe(
      422,
    );
    // Produit absent de la liste locale : 404, aucune demande inscrite.
    expect((await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'p' })).statusCode).toBe(
      404,
    );
    expect(await n('vulnerabilites_cpe_demandes')).toBe(0);
  });
});

describe('réglage de la source', () => {
  it('désactivée au départ ; activation et fréquence avec If-Match, journalisées ; 422 hors liste', async () => {
    const e0 = (await admin.get(`${base}/dictionnaire`)).json();
    expect(e0).toMatchObject({ activee: false, etat: 'inactif', frequenceHeures: 24, produits: 0, chargement: null });
    expect(e0.source.hote).toBe('services.nvd.nist.gov');
    expect((await admin.patch(`${base}/dictionnaire`, { activee: true })).statusCode).toBe(428);
    expect(
      (await admin.patch(`${base}/dictionnaire`, { activee: true }, { 'if-match': `"${e0.version + 5}"` })).statusCode,
    ).toBe(412);
    expect(
      (await admin.patch(`${base}/dictionnaire`, { frequenceHeures: 2 }, { 'if-match': `"${e0.version}"` })).statusCode,
    ).toBe(422);
    const r = await admin.patch(
      `${base}/dictionnaire`,
      { activee: true, frequenceHeures: 168 },
      { 'if-match': `"${e0.version}"` },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ activee: true, frequenceHeures: 168, etat: 'en_attente' });
    expect((await audits('vulnerabilites.cpe.reglage')).at(-1)!.details).toEqual({
      avant: { activee: false, frequenceHeures: 24 },
      apres: { activee: true, frequenceHeures: 168 },
    });
    // Activée mais flux fermé : rien n'est remis à l'exécutant.
    expect(await dico().reclamerTranche(true)).toBeNull();
  });
});

describe('chargement par tranches', () => {
  it('curseur rangé côté API, une tranche à la fois, fin du chargement, puis nouveautés à la fréquence', async () => {
    await ouvrir();
    expect(await dico().reclamerTranche(true)).toBeNull(); // source désactivée
    await activer();
    expect(await dico().reclamerTranche(false)).toBeNull(); // module désactivé
    const t1 = (await dico().reclamerTranche(true))!;
    expect(t1.parametres).toEqual({ operation: 'dictionnaire', debut: 0, pages: 1, versions: false });
    // Une seule tranche remise à la fois.
    expect(await dico().reclamerTranche(true)).toBeNull();
    await dico().lotTranche(t1.id as string, {
      produits: [produit('ed', 'p', 'Ed P'), produit('ed', 'p', 'autre intitulé'), produit('ed2', 'q', null)],
      versions: [{ partie: 'a', editeur: 'ed', produit: 'p', version: '1.0' }],
    });
    expect(await n('vulnerabilites_cpe_produits')).toBe(2);
    // Sans copie complète voulue, les versions ne sont pas rangées.
    expect(await n('vulnerabilites_cpe_copie')).toBe(0);
    // Mauvais identifiant, curseur hors tranche : refusés.
    await expect(
      dico().lotTranche('00000000-0000-4000-8000-000000000000', { produits: [], versions: [] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      dico().terminerTranche(t1.id as string, {
        ok: true,
        erreur: null,
        bilan: { total: 90000, suivant: 10001, entrees: 0, obsoletes: 0, ecartes: 0 },
      }),
    ).rejects.toMatchObject({ status: 422 });
    await dico().terminerTranche(t1.id as string, {
      ok: true,
      erreur: null,
      bilan: { total: 20000, suivant: 10000, entrees: 10000, obsoletes: 5, ecartes: 0 },
    });
    expect((await dico().etat()).chargement).toEqual({ mode: 'complet', lues: 10000, total: 20000 });
    expect((await dico().etat()).etat).toBe('chargement');
    const t2 = (await dico().reclamerTranche(true))!;
    expect(t2.parametres).toMatchObject({ debut: 10000, pages: 1 });
    await dico().terminerTranche(t2.id as string, {
      ok: true,
      erreur: null,
      bilan: { total: 20000, suivant: 20000, entrees: 10000, obsoletes: 0, ecartes: 0 },
    });
    const fin = await dico().etat();
    expect(fin).toMatchObject({ etat: 'a_jour', chargement: null, produits: 2 });
    expect(fin.completLe).not.toBeNull();
    expect((await audits('vulnerabilites.cpe.chargement.termine')).at(-1)!.details).toEqual({
      mode: 'complet',
      total: 20000,
      copie: false,
    });
    // Rien d'échu tout de suite ; un jour plus tard : les nouveautés, par fenêtre de dates depuis la dernière mise à jour.
    expect(await dico().reclamerTranche(true)).toBeNull();
    const demain = new Date(Date.now() + 25 * 3_600_000);
    const t3 = (await dico().reclamerTranche(true, demain))!;
    expect(t3.parametres).toMatchObject({ operation: 'dictionnaire', debut: 0, versions: false });
    expect(new Date((t3.parametres as { depuis: string }).depuis).getTime()).toBeLessThan(Date.now());
    expect((t3.parametres as { jusqua: string }).jusqua).toBe(
      new Date(Math.floor(demain.getTime() / 1000) * 1000).toISOString(),
    );
  });

  it('échec : erreur rangée, curseur gardé, nouvel essai après quinze minutes seulement', async () => {
    await ouvrir();
    await activer();
    const t1 = (await dico().reclamerTranche(true))!;
    await dico().terminerTranche(t1.id as string, {
      ok: false,
      erreur: 'Limite de débit de la source atteinte (code 429).',
      bilan: null,
    });
    const e = await dico().etat();
    expect(e).toMatchObject({ etat: 'erreur', erreur: 'Limite de débit de la source atteinte (code 429).' });
    expect(await dico().reclamerTranche(true)).toBeNull();
    const plusTard = (await dico().reclamerTranche(true, new Date(Date.now() + 16 * 60_000)))!;
    expect(plusTard.parametres).toMatchObject({ debut: 0 });
    expect(await audits('vulnerabilites.cpe.chargement.echec')).toHaveLength(1);
    // Tranche jamais close : pas de seconde remise avant dix minutes (ni avant quinze, l'erreur précédente restant affichée).
    expect(await dico().reclamerTranche(true, new Date(Date.now() + 20 * 60_000))).toBeNull();
    expect(await dico().reclamerTranche(true, new Date(Date.now() + 27 * 60_000))).toBeNull();
    expect(await dico().reclamerTranche(true, new Date(Date.now() + 32 * 60_000))).not.toBeNull();
  });
});

describe('recherche dans la liste locale', () => {
  it('sans casse ni accent, correspondance exacte du produit d’abord, puis les plus courts ; 20 au plus', async () => {
    await ouvrir();
    await activer();
    await charger([
      produit('glpi-project', 'glpi', 'GLPI Project GLPI'),
      produit('glpi-project', 'glpi_agent', 'GLPI Project GLPI Agent'),
      produit('autre', 'plugin_pour_glpi', 'Autre Plugin pour GLPI'),
      produit('editeur_fictif', 'produit_eclair', 'Éditeur Fictif Produit Éclair'),
      ...Array.from({ length: 30 }, (_, i) => produit('serie', `glpi_greffon_${i}`)),
    ]);
    const r = (await contributeur.get(`${base}/produits?q=${encodeURIComponent('GLPÎ')}`)).json();
    expect(r).toHaveLength(20);
    expect(r[0]).toEqual({ partie: 'a', editeur: 'glpi-project', produit: 'glpi', intitule: 'GLPI Project GLPI' });
    expect(r[1].produit).toBe('glpi_agent');
    // « produit eclair » retrouve « Produit Éclair » (accents, tiret bas et casse ignorés).
    const e = (await contributeur.get(`${base}/produits?q=${encodeURIComponent('produit éclair')}`)).json();
    expect(e.map((x: { produit: string }) => x.produit)).toEqual(['produit_eclair']);
    // Un terme fait seulement de ponctuation ne cherche rien.
    expect((await contributeur.get(`${base}/produits?q=${encodeURIComponent('%_')}`)).json()).toEqual([]);
  });
});

describe('saisie en cours et file des versions', () => {
  it('l’ouverture du formulaire note la saisie ; `actif` rendu à l’exécutant dans tous les cas', async () => {
    await ouvrir();
    await activer();
    expect(await dico().reclamerVersions(true)).toEqual({ actif: false, demande: null });
    const s = (await contributeur.post(`${base}/saisie`)).json();
    expect(s).toEqual({ listeChargee: false, versionsDistantes: true, copieComplete: false });
    expect(await dico().reclamerVersions(true)).toEqual({ actif: true, demande: null });
    await t.svc.db.q("UPDATE vulnerabilites_cpe_dictionnaire SET saisie_le = now() - interval '3 minutes'");
    expect(await dico().reclamerVersions(true)).toEqual({ actif: false, demande: null });
    // Aucune personne n'est désignée dans l'état de la saisie.
    const colonnes = (
      await t.svc.db.q<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'vulnerabilites_cpe_dictionnaire'",
      )
    ).rows.map((c) => c.column_name);
    expect(colonnes.filter((c) => /par|user|utilisateur/.test(c))).toEqual([]);
  });

  it('demande, une seule par produit, réponse par la CLI, cache frais ; versions de la veille marquées', async () => {
    await ouvrir();
    await activer();
    await charger([produit('editeur-fictif', 'produit_fictif', 'Editeur Fictif Produit Fictif')]);
    // La veille a déjà vu la version 8.0 de ce produit dans une CVE (fait proposé aussitôt, marqué).
    await t.svc.db.q("INSERT INTO vulnerabilites_veille_cve (cve) VALUES ('CVE-2026-90001')");
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_cve_produits (cve, rang, partie, editeur, produit, editeur_norm, produit_norm, version, vulnerable)
       VALUES ('CVE-2026-90001', 0, 'a', 'editeur-fictif', 'produit_fictif', 'editeur_fictif', 'produit_fictif', '8.0', true)`,
    );
    const corps = { partie: 'a', editeur: 'editeur-fictif', produit: 'produit_fictif' };
    const r1 = (await contributeur.post(`${base}/versions`, corps)).json();
    expect(r1).toMatchObject({ etat: 'en_attente', versions: [{ version: '8.0', source: 'veille' }] });
    expect((await contributeur.post(`${base}/versions`, corps)).json().etat).toBe('en_attente');
    expect(await n('vulnerabilites_cpe_demandes')).toBe(1);
    const q = `${base}/versions?partie=a&editeur=editeur-fictif&produit=produit_fictif`;
    expect((await contributeur.get(q)).json().etat).toBe('en_attente');
    // L'exécutant réclame la demande par la vraie CLI, puis la termine.
    const claim = await cli(['cpe-versions-claim']);
    expect(claim.code, claim.err).toBe(0);
    const { actif, demande } = JSON.parse(claim.out) as { actif: boolean; demande: Record<string, string> };
    expect(actif).toBe(true);
    expect(demande).toEqual({ id: expect.any(String), ...corps });
    expect((await cli(['cpe-versions-finish', demande.id!], '{"ok": true}')).code).toBe(2);
    const fin = await cli(
      ['cpe-versions-finish', demande.id!],
      JSON.stringify({ ok: true, erreur: null, versions: ['9.5.1', '10.0.2', '10.0.10'], tronque: false }),
    );
    expect(fin.code, fin.err).toBe(0);
    const r2 = (await contributeur.get(q)).json();
    expect(r2.etat).toBe('pret');
    expect(r2.versions).toEqual([
      { version: '10.0.10', source: 'nvd' },
      { version: '10.0.2', source: 'nvd' },
      { version: '9.5.1', source: 'nvd' },
      { version: '8.0', source: 'veille' },
    ]);
    expect(r2.obtenuLe).not.toBeNull();
    // Cache frais : réponse immédiate, aucune nouvelle demande.
    expect((await contributeur.post(`${base}/versions`, corps)).json().etat).toBe('pret');
    expect(await n('vulnerabilites_cpe_demandes')).toBe(1);
    // Plus d'un jour après : une nouvelle demande, les versions gardées restent proposées en attendant.
    await t.svc.db.q("UPDATE vulnerabilites_cpe_versions SET obtenu_le = now() - interval '25 hours'");
    const r3 = (await contributeur.post(`${base}/versions`, corps)).json();
    expect(r3.etat).toBe('en_attente');
    expect(r3.versions[0]).toEqual({ version: '10.0.10', source: 'nvd' });
    expect(await n('vulnerabilites_cpe_demandes')).toBe(2);
  });

  it('échec rapporté : « indisponible » avec son message ; flux fermé : demandes closes, `actif` faux', async () => {
    await ouvrir();
    await activer();
    await charger([produit('ed', 'p'), produit('ed', 'q')]);
    await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'p' });
    const { demande } = await dico().reclamerVersions(true);
    await dico().terminerVersions(demande!.id as string, {
      ok: false,
      erreur: 'Délai dépassé : la NVD ne répond pas assez vite.',
      versions: [],
      tronque: false,
    });
    const r = (await contributeur.get(`${base}/versions?partie=a&editeur=ed&produit=p`)).json();
    expect(r.etat).toBe('indisponible');
    expect(r.message).toContain('Délai dépassé');
    // Une demande close ne se termine pas deux fois.
    await expect(
      dico().terminerVersions(demande!.id as string, { ok: true, erreur: null, versions: [], tronque: false }),
    ).rejects.toMatchObject({ status: 409 });
    await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'q' });
    await fermer();
    expect(await dico().reclamerVersions(true)).toEqual({ actif: false, demande: null });
    expect(await n('vulnerabilites_cpe_demandes', "etat = 'echec' AND produit = 'q'")).toBe(1);
    // Flux fermé ou source désactivée : la saisie n'inscrit rien et le dit.
    const ferme = (await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'q' })).json();
    expect(ferme.etat).toBe('indisponible');
    expect(await n('vulnerabilites_cpe_demandes', "etat = 'en_file'")).toBe(0);
  });

  it('limite de trente demandes par heure et par personne ; demandes purgées après sept jours', async () => {
    await ouvrir();
    await activer();
    await charger(Array.from({ length: 31 }, (_, i) => produit('ed', `p${i}`)));
    for (let i = 0; i < 30; i++)
      expect(
        (await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: `p${i}` })).statusCode,
      ).toBe(200);
    expect(
      (await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'p30' })).statusCode,
    ).toBe(429);
    await t.svc.db.q(
      "UPDATE vulnerabilites_cpe_demandes SET etat = 'reussie', debute_le = now(), termine_le = now(), demande_le = now() - interval '8 days' WHERE produit = 'p0'",
    );
    // Demande jamais réclamée depuis plus de dix minutes : expirée à la réclamation suivante.
    await t.svc.db.q(
      "UPDATE vulnerabilites_cpe_demandes SET demande_le = now() - interval '11 minutes' WHERE produit = 'p1'",
    );
    await dico().reclamerVersions(true);
    expect(await n('vulnerabilites_cpe_demandes', "produit = 'p0'")).toBe(0);
    expect(await n('vulnerabilites_cpe_demandes', "produit = 'p1' AND etat = 'expire'")).toBe(1);
  });
});

describe('copie complète', () => {
  it('demandée : chargement complet avec les versions, puis versions locales sans demande ; supprimée : place libérée', async () => {
    await ouvrir();
    expect(
      (await admin.post(`${base}/dictionnaire/copie`, {}, { 'if-match': `"${await version()}"` })).statusCode,
    ).toBe(409); // source désactivée
    await activer();
    await charger([produit('ed', 'p')]);
    const r = await admin.post(`${base}/dictionnaire/copie`, {}, { 'if-match': `"${await version()}"` });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().copie).toMatchObject({ voulue: true, complete: false });
    expect(await audits('vulnerabilites.cpe.copie.demandee')).toHaveLength(1);
    const tranche = (await dico().reclamerTranche(true))!;
    expect(tranche.parametres).toMatchObject({ debut: 0, versions: true });
    const v = (version: string) => ({ partie: 'a', editeur: 'ed', produit: 'p', version });
    await dico().lotTranche(tranche.id as string, { produits: [produit('ed', 'p')], versions: [v('1.0'), v('2.0')] });
    await dico().terminerTranche(tranche.id as string, {
      ok: true,
      erreur: null,
      bilan: { total: 2, suivant: 2, entrees: 2, obsoletes: 0, ecartes: 0 },
    });
    expect((await dico().etat()).copie).toMatchObject({ voulue: true, complete: true });
    expect((await contributeur.post(`${base}/saisie`)).json().copieComplete).toBe(true);
    const versions = (await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'p' })).json();
    expect(versions).toMatchObject({
      etat: 'pret',
      versions: [
        { version: '2.0', source: 'copie' },
        { version: '1.0', source: 'copie' },
      ],
    });
    expect(await n('vulnerabilites_cpe_demandes')).toBe(0);
    const s = await admin.req('DELETE', `${base}/dictionnaire/copie`, {
      headers: { 'if-match': `"${await version()}"` },
    });
    expect(s.statusCode, s.body).toBe(200);
    expect(await n('vulnerabilites_cpe_copie')).toBe(0);
    expect(s.json().copie).toMatchObject({ voulue: false, complete: false });
    expect(await audits('vulnerabilites.cpe.copie.supprimee')).toHaveLength(1);
    // Sans copie : les versions reviennent par la file.
    expect(
      (await contributeur.post(`${base}/versions`, { partie: 'a', editeur: 'ed', produit: 'p' })).json().etat,
    ).toBe('en_attente');
  });
});
