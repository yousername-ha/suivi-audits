/* Module Vulnérabilités (ADR 0100, lot F1) : fréquence de synchronisation réglable par source de la veille et par instance
   de connecteur. Migration 090 : listes fermées garanties en base (plancher de NVD, EPSS fixe), concordance avec le paquet
   partagé ; planification à chaque fréquence avec horloge injectée, référence consommée avant l'inscription (aucune
   redemande à chaque tic après un échec), pas de rafale au changement de réglage, pas de double demande quand une collecte
   attend, aucun décalage cumulé par le tic ; route de la veille (droit d'administrer, If-Match, 422 hors liste, EPSS non
   modifiable, journal) ; fréquence d'une instance par la modification existante (droit d'administrer les intégrations,
   If-Match, 422, journal) ; état en lecture seule (fréquence et prochaine échéance) ; alerte ouverte à la fin d'une collecte
   planifiée. Données entièrement fictives : noms en .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est
   joint. */
import {
  FREQUENCE_CONNECTEUR_DEFAUT,
  FREQUENCE_VEILLE_DEFAUT,
  FREQUENCES_CONNECTEUR,
  FREQUENCES_VEILLE,
  INTEGRATION_TYPES,
  SOURCES_VEILLE,
} from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, ouvrirFlux, REPO, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const VEILLE = `${V}/veille`;
const SYSTEME = { username: 'test' };
const CLE_ACCES = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CLE_SECRETE = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
const CLE_ALH = 'cle-api-fictive-0123456789abcdef';
const CPE = 'cpe:2.3:a:editeur_frequence_fictif:produit_frequence_fictif:*:*:*:*:*:*:*:*';
const T0 = new Date('2026-11-16T09:00:00Z');
const plus = (minutes: number, depuis = T0) => new Date(depuis.getTime() + minutes * 60_000);
const HEURE = 60;
let t: TestApp;
let admin: Agent, rssi: Agent, lecteur: Agent, contributeur: Agent, integLecteur: Agent, integModif: Agent;
let tenable: { id: string; version: number }, alh: { id: string; version: number };

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const n = async (table: string, where = 'true', p: unknown[] = []) =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
/** Les collectes demandées sont closes en échec : aucune n'attend, la suivante ne dépend que de la fréquence. */
const echouerCollectes = () =>
  t.svc.db.q(
    "UPDATE vulnerabilites_veille_collectes SET etat = 'echec', termine_le = now(), erreur = 'Échec fictif.' WHERE etat IN ('en_file', 'en_cours')",
  );
const echouerExecutions = () =>
  t.svc.db.q(
    "UPDATE integration_executions SET etat = 'echec', termine_le = now(), erreur = 'Échec fictif.' WHERE etat IN ('en_file', 'en_cours')",
  );
const collectesDe = (source: string) => n('vulnerabilites_veille_collectes', 'source = $1', [source]);
const regler = (source: string, heures: number | null) =>
  t.svc.db.q('UPDATE vulnerabilites_veille_sources SET frequence_heures = $2 WHERE source = $1', [source, heures]);

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'freq_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'freq_rssi', 'rssi'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_freq_lecteur', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_freq_contrib', 'Vulnérabilités, contribution', ARRAY['vulnerabilites:lire','vulnerabilites:modifier']),
       ('r_freq_integ_lire', 'Intégrations, lecture', ARRAY['integrations:lire']),
       ('r_freq_integ_modif', 'Intégrations, modification', ARRAY['integrations:lire','integrations:modifier'])`,
  );
  lecteur = await login(t, await makeUser(t, 'freq_lecteur', 'r_freq_lecteur'));
  contributeur = await login(t, await makeUser(t, 'freq_contrib', 'r_freq_contrib'));
  integLecteur = await login(t, await makeUser(t, 'freq_integ_lire', 'r_freq_integ_lire'));
  integModif = await login(t, await makeUser(t, 'freq_integ_modif', 'r_freq_integ_modif'));
  const instance = async (type: string, nom: string, adresse: string, secrets: Record<string, string>) => {
    const r = await admin.post('/api/integrations/instances', { type, nom, configuration: { adresse } });
    expect(r.statusCode, r.body).toBe(201);
    await admin.put(`/api/integrations/instances/${r.json().id}/secrets`, secrets);
    const a = await admin.put(
      `/api/integrations/instances/${r.json().id}/activation`,
      { actif: true, fluxConfirme: true },
      ifMatch(r.json().version),
    );
    expect(a.statusCode, a.body).toBe(200);
    return { id: a.json().id as string, version: a.json().version as number };
  };
  tenable = await instance('tenable', 'Tenable fréquence fictif', 'https://tenable-frequence.exemple.invalid', {
    accessKey: CLE_ACCES,
    secretKey: CLE_SECRETE,
  });
  alh = await instance('algolighthouse', 'ALH fréquence fictif', 'https://espace-frequence.algolighthouse.fr', {
    cleApi: CLE_ALH,
  });
  await ouvrirFlux(t, 'veille-vulnerabilites');
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  for (const table of [
    'vulnerabilites_veille_collectes',
    'vulnerabilites_veille_sources',
    'integration_executions',
    'vulnerabilites_tenable_etat',
    'vulnerabilites_alh_etat',
  ])
    await t.svc.db.q(`DELETE FROM ${table}`);
  await t.svc.db.q('UPDATE integrations SET frequence_heures = NULL');
  await t.svc.db.q('DELETE FROM backup_worker');
});

describe('migration 090 : listes fermées garanties en base', () => {
  const candidates = [1, 2, 3, 4, 6, 8, 12, 24, 48, 168];

  it('veille : chaque source n’admet que sa liste (NVD deux heures au moins, EPSS vingt-quatre) ; NULL vaut la valeur par défaut', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '090_frequences_synchronisation.sql'"))
        ?.ok,
    ).toBe(1);
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_sources (source) VALUES ${SOURCES_VEILLE.map((s) => `('${s}')`).join(', ')}`,
    );
    for (const s of SOURCES_VEILLE) {
      for (const h of candidates) {
        const essai = regler(s, h);
        if (FREQUENCES_VEILLE[s].includes(h)) await essai;
        else await expect(essai, `${s} ${h} h`).rejects.toThrow(/vulnerabilites_veille_sources_frequence/);
      }
      await regler(s, null);
    }
    await expect(regler('nvd', 1)).rejects.toThrow();
    await expect(regler('epss', 2)).rejects.toThrow();
    expect(await n('vulnerabilites_veille_sources', 'frequence_heures IS NULL AND version = 1')).toBe(5);
    // Les valeurs par défaut du code sont dans les listes.
    for (const s of SOURCES_VEILLE) expect(FREQUENCES_VEILLE[s]).toContain(FREQUENCE_VEILLE_DEFAUT[s]);
    expect(FREQUENCE_VEILLE_DEFAUT).toEqual({ 'cisa-kev': 2, nvd: 2, epss: 24, 'cert-fr': 2, 'cert-sante': 2 });
  });

  it('connecteurs : chaque type n’admet que sa liste ; les listes de la migration sont celles du code', async () => {
    // Lot N1 : l'import de fichier (« nessus-fichier ») n'a aucune synchronisation automatique : liste vide, seule la valeur
    // NULL passe en base.
    const { rows } = await t.svc.db.q<{ id: string }>(
      `INSERT INTO integrations (type, nom, configuration, created_by, updated_by)
       VALUES ('nessus-fichier', 'Nessus fréquence fictif', '{}', 'test', 'test') RETURNING id`,
    );
    const parType = { tenable: tenable.id, algolighthouse: alh.id, 'nessus-fichier': rows[0]!.id };
    expect(FREQUENCES_CONNECTEUR['nessus-fichier']).toEqual([]);
    for (const type of INTEGRATION_TYPES) {
      if (type !== 'nessus-fichier') expect(FREQUENCES_CONNECTEUR[type]).toContain(FREQUENCE_CONNECTEUR_DEFAUT);
      for (const h of candidates) {
        const essai = t.svc.db.q('UPDATE integrations SET frequence_heures = $2 WHERE id = $1', [parType[type], h]);
        if (FREQUENCES_CONNECTEUR[type].includes(h)) await essai;
        else await expect(essai, `${type} ${h} h`).rejects.toThrow(/integrations_frequence/);
      }
    }
    // La migration recopie les listes du code (une seule source de vérité).
    const sqlTexte = readFileSync(path.join(REPO, 'apps/api/migrations/090_frequences_synchronisation.sql'), 'utf8');
    expect(sqlTexte).toContain(`frequence_heures IN (${FREQUENCES_VEILLE['cisa-kev'].join(', ')})`);
    expect(sqlTexte).toContain(`source = 'nvd' AND frequence_heures IN (${FREQUENCES_VEILLE.nvd.join(', ')})`);
    expect(sqlTexte).toContain(`source = 'epss' AND frequence_heures = ${FREQUENCES_VEILLE.epss[0]}`);
    expect(sqlTexte).toContain(`'tenable' AND frequence_heures IN (${FREQUENCES_CONNECTEUR.tenable.join(', ')})`);
    expect(sqlTexte).toContain(
      `'algolighthouse' AND frequence_heures IN (${FREQUENCES_CONNECTEUR.algolighthouse.join(', ')})`,
    );
    await t.svc.db.q('DELETE FROM integrations WHERE id = $1', [parType['nessus-fichier']]);
  });
});

describe('planification de la veille à chaque fréquence (horloge injectée)', () => {
  it('KEV, CERT-FR, CERT Santé et NVD : une demande par période, aucune avant, aucune redemande après un échec', async () => {
    for (const source of ['cisa-kev', 'nvd', 'cert-fr', 'cert-sante'] as const)
      for (const h of FREQUENCES_VEILLE[source]) {
        await t.svc.db.q('DELETE FROM vulnerabilites_veille_collectes');
        await t.svc.db.q('DELETE FROM vulnerabilites_veille_sources');
        await t.svc.vulnerabilites.veille.planifier(T0);
        await regler(source, h);
        expect(await collectesDe(source), `${source} ${h} h`).toBe(1);
        // La collecte échoue aussitôt : rien n'est redemandé avant la fin de la période, à aucun tic.
        await echouerCollectes();
        for (const m of [1, 30, h * HEURE - 1]) {
          await t.svc.vulnerabilites.veille.planifier(plus(m));
          expect(await collectesDe(source), `${source} ${h} h, +${m} min`).toBe(1);
        }
        await t.svc.vulnerabilites.veille.planifier(plus(h * HEURE));
        expect(await collectesDe(source), `${source} ${h} h, une période plus tard`).toBe(2);
      }
  });

  it('EPSS : une fois par jour, après les autres sources, quand la file est vide', async () => {
    await t.svc.vulnerabilites.veille.planifier(T0);
    expect(await collectesDe('epss')).toBe(0); // les quatre autres attendent
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(1));
    expect(await collectesDe('epss')).toBe(1);
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(23 * HEURE));
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(24 * HEURE));
    expect(await collectesDe('epss')).toBe(1); // les autres viennent d'être demandées : EPSS attend qu'elles soient traitées
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(24 * HEURE + 1));
    expect(await collectesDe('epss')).toBe(2);
  });

  it('aucune rafale au changement de réglage ; aucun décalage cumulé par le tic d’une minute', async () => {
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_sources (source, frequence_heures) VALUES ('cisa-kev', 24) ON CONFLICT (source) DO UPDATE SET frequence_heures = 24",
    );
    await t.svc.vulnerabilites.veille.planifier(T0);
    await echouerCollectes();
    // Cinq heures plus tard, la fréquence passe à une heure : UNE demande, puis une par heure (pas cinq d'un coup).
    await regler('cisa-kev', 1);
    await t.svc.vulnerabilites.veille.planifier(plus(5 * HEURE));
    await t.svc.vulnerabilites.veille.planifier(plus(5 * HEURE + 1));
    expect(await collectesDe('cisa-kev')).toBe(2);
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(5 * HEURE + 59));
    expect(await collectesDe('cisa-kev')).toBe(2);
    // Tic en retard de 40 secondes : la référence reste l'échéance théorique, la suivante n'en hérite pas.
    const tic = new Date(plus(6 * HEURE).getTime() + 40_000);
    await t.svc.vulnerabilites.veille.planifier(tic);
    expect(await collectesDe('cisa-kev')).toBe(3);
    const ref = await t.svc.db.one<{ p: Date }>(
      "SELECT planifiee_le AS p FROM vulnerabilites_veille_sources WHERE source = 'cisa-kev'",
    );
    expect(ref!.p.toISOString()).toBe(plus(6 * HEURE).toISOString());
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(new Date(plus(7 * HEURE).getTime() + 10_000));
    expect(await collectesDe('cisa-kev')).toBe(4);
  });

  it('une collecte déjà en file ou en cours tient lieu de la demande automatique : pas de double demande', async () => {
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('nvd', 'manuel', 'test')",
    );
    await t.svc.vulnerabilites.veille.planifier(T0);
    expect(await collectesDe('nvd')).toBe(1);
    // L'échéance est consommée : la collecte manuelle terminée, rien avant deux heures.
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(HEURE));
    expect(await collectesDe('nvd')).toBe(1);
    await t.svc.vulnerabilites.veille.planifier(plus(2 * HEURE));
    expect(await collectesDe('nvd')).toBe(2);
  });
});

describe('route de la fréquence de la veille', () => {
  const url = (s: string) => `${VEILLE}/sources/${s}/frequence`;
  const source = async (a: Agent, s: string) => {
    const r = await a.get(`${VEILLE}/etat`);
    expect(r.statusCode, r.body).toBe(200);
    return r.json().sources.find((x: { source: string }) => x.source === s) as {
      frequenceHeures: number;
      prochaineCollecte: string | null;
      version: number;
    };
  };

  it('lecture : fréquence par défaut, prochaine collecte et version ; flux fermé, aucune échéance', async () => {
    const kev = await source(lecteur, 'cisa-kev');
    expect(kev).toMatchObject({ frequenceHeures: 2, version: 1 });
    expect(kev.prochaineCollecte).not.toBeNull();
    expect((await source(lecteur, 'epss')).frequenceHeures).toBe(24);
    await t.svc.flux.changer('veille-vulnerabilites', false, SYSTEME, '127.0.0.1');
    try {
      expect((await source(lecteur, 'nvd')).prochaineCollecte).toBeNull();
    } finally {
      await ouvrirFlux(t, 'veille-vulnerabilites');
    }
  });

  it('droit d’administrer, CSRF, If-Match ; 422 hors liste, plancher NVD, EPSS fixe ; journal', async () => {
    expect((await lecteur.put(url('nvd'), { frequenceHeures: 4 }, ifMatch(1))).statusCode).toBe(403);
    expect((await contributeur.put(url('nvd'), { frequenceHeures: 4 }, ifMatch(1))).statusCode).toBe(403);
    expect((await integLecteur.put(url('nvd'), { frequenceHeures: 4 }, ifMatch(1))).statusCode).toBe(403);
    expect(
      (await admin.req('PUT', url('nvd'), { json: { frequenceHeures: 4 }, headers: ifMatch(1), csrf: false }))
        .statusCode,
    ).toBe(403);
    expect((await admin.put(url('nvd'), { frequenceHeures: 4 })).statusCode).toBe(428);
    expect((await admin.put(url('nvd'), { frequenceHeures: 4 }, ifMatch(7))).statusCode).toBe(412);
    for (const [s, h] of [
      ['nvd', 1],
      ['cisa-kev', 3],
      ['cert-fr', 168],
      ['epss', 24],
      ['epss', 2],
    ] as const) {
      const r = await admin.put(url(s), { frequenceHeures: h }, ifMatch(1));
      expect(r.statusCode, `${s} ${h}`).toBe(422);
    }
    expect((await admin.put(url('nvd'), { frequenceHeures: 2.5 }, ifMatch(1))).statusCode).toBe(422);
    expect((await admin.put(url('ailleurs'), { frequenceHeures: 2 }, ifMatch(1))).statusCode).toBe(422);
    expect(await audits('vulnerabilites.veille.frequence')).toHaveLength(0);
    const ok = await rssi.put(url('nvd'), { frequenceHeures: 12 }, ifMatch(1));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.headers.etag).toBe('"2"');
    expect(ok.json()).toMatchObject({ source: 'nvd', frequenceHeures: 12, version: 2 });
    expect((await source(lecteur, 'nvd')).frequenceHeures).toBe(12);
    expect((await admin.put(url('nvd'), { frequenceHeures: 4 }, ifMatch(1))).statusCode).toBe(412);
    const j = await audits('vulnerabilites.veille.frequence');
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({
      username: 'freq_rssi',
      target: 'nvd',
      details: { source: 'nvd', avant: 2, apres: 12 },
    });
    // Le planificateur suit le réglage : NVD n'est plus demandé qu'une fois toutes les douze heures.
    await t.svc.vulnerabilites.veille.planifier(T0);
    await echouerCollectes();
    await t.svc.vulnerabilites.veille.planifier(plus(11 * HEURE));
    expect(await collectesDe('nvd')).toBe(1);
    await t.svc.vulnerabilites.veille.planifier(plus(12 * HEURE));
    expect(await collectesDe('nvd')).toBe(2);
    // Prochaine collecte affichée : douze heures après la dernière demande automatique.
    const demande = new Date(Date.now() - 3 * 3_600_000);
    await t.svc.db.q("UPDATE vulnerabilites_veille_sources SET planifiee_le = $1 WHERE source = 'nvd'", [demande]);
    expect(Date.parse((await source(lecteur, 'nvd')).prochaineCollecte!)).toBe(demande.getTime() + 12 * 3_600_000);
  });

  it('module désactivé : route refusée', async () => {
    await t.svc.db.q(
      "UPDATE module_activation SET disabled = ARRAY['vulnerabilites'], version = version + 1 WHERE id=1",
    );
    const r = await admin.put(url('nvd'), { frequenceHeures: 4 }, ifMatch(1));
    expect(r.statusCode).toBe(409);
    expect(r.json().reason).toBe('module_disabled');
  });
});

describe('fréquence d’un connecteur', () => {
  const inst = (id: string) => `/api/integrations/instances/${id}`;
  const lire = async (id: string) => (await admin.get(inst(id))).json() as { version: number; frequenceHeures: number };

  it('modification de l’instance : droit d’administrer les intégrations, If-Match, 422 hors liste du type, journal', async () => {
    const v = (await lire(tenable.id)).version;
    expect((await lire(tenable.id)).frequenceHeures).toBe(24);
    expect((await integLecteur.patch(inst(tenable.id), { frequenceHeures: 12 }, ifMatch(v))).statusCode).toBe(403);
    expect((await integModif.patch(inst(tenable.id), { frequenceHeures: 12 }, ifMatch(v))).statusCode).toBe(403);
    expect((await admin.patch(inst(tenable.id), { frequenceHeures: 12 })).statusCode).toBe(428);
    expect((await admin.patch(inst(tenable.id), { frequenceHeures: 12 }, ifMatch(v + 5))).statusCode).toBe(412);
    for (const h of [1, 2, 4, 48])
      expect((await admin.patch(inst(tenable.id), { frequenceHeures: h }, ifMatch(v))).statusCode).toBe(422);
    expect(
      (await admin.patch(inst(alh.id), { frequenceHeures: 6 }, ifMatch((await lire(alh.id)).version))).statusCode,
    ).toBe(422);
    const ok = await admin.patch(inst(tenable.id), { frequenceHeures: 6 }, ifMatch(v));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ frequenceHeures: 6, version: v + 1 });
    // Secrets gardés : la fréquence n'est pas une destination.
    expect(ok.json().secrets).toEqual({ accessKey: true, secretKey: true });
    const j = await audits('integration.frequence');
    expect(j.at(-1)).toMatchObject({
      username: 'freq_admin',
      target: tenable.id,
      details: { type: 'tenable', avant: 24, apres: 6 },
    });
    expect(JSON.stringify(j)).not.toMatch(/exemple\.invalid|cle|secret/i);
    // Remise à la valeur par défaut.
    const r = await admin.patch(inst(tenable.id), { frequenceHeures: 24 }, ifMatch(v + 1));
    expect(r.statusCode).toBe(200);
    tenable.version = r.json().version;
  });

  it('création avec une fréquence : contrôlée par la liste du type', async () => {
    const corps = {
      type: 'algolighthouse',
      nom: 'ALH fréquence création fictif',
      configuration: { adresse: 'https://espace-creation.algolighthouse.fr' },
    };
    expect((await admin.post('/api/integrations/instances', { ...corps, frequenceHeures: 6 })).statusCode).toBe(422);
    const r = await admin.post('/api/integrations/instances', { ...corps, frequenceHeures: 168 });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json().frequenceHeures).toBe(168);
    await t.svc.db.q('DELETE FROM integrations WHERE id = $1', [r.json().id]);
  });

  it('planification à chaque fréquence : Tenable et AlgoLightHouse, aucune redemande après un échec', async () => {
    const cas = [
      ['tenable', tenable.id, () => t.svc.vulnerabilites.tenable.planifier.bind(t.svc.vulnerabilites.tenable)],
      [
        'algolighthouse',
        alh.id,
        () => t.svc.vulnerabilites.surfaceExterne.planifier.bind(t.svc.vulnerabilites.surfaceExterne),
      ],
    ] as const;
    for (const [type, id, planificateur] of cas) {
      const planifier = planificateur();
      for (const h of FREQUENCES_CONNECTEUR[type]) {
        await t.svc.db.q('DELETE FROM integration_executions');
        await t.svc.db.q('DELETE FROM vulnerabilites_tenable_etat');
        await t.svc.db.q('DELETE FROM vulnerabilites_alh_etat');
        await t.svc.db.q('UPDATE integrations SET frequence_heures = $2 WHERE id = $1', [id, h]);
        const execs = () => n('integration_executions', 'integration_id = $1', [id]);
        expect(await planifier(T0), `${type} ${h} h`).toHaveLength(1);
        await echouerExecutions();
        for (const m of [1, 60, h * HEURE - 1]) {
          await planifier(plus(m));
          expect(await execs(), `${type} ${h} h, +${m} min`).toBe(1);
        }
        await planifier(plus(h * HEURE));
        expect(await execs(), `${type} ${h} h, une période plus tard`).toBe(2);
      }
    }
  });

  it('état en lecture seule dans le module : fréquence et prochaine synchronisation ; instance inactive, aucune échéance', async () => {
    await t.svc.db.q('UPDATE integrations SET frequence_heures = 12 WHERE id = $1', [tenable.id]);
    await t.svc.vulnerabilites.tenable.planifier(new Date());
    const s = (await rssi.get(`${V}/synchronisation`)).json() as {
      integrationId: string;
      frequenceHeures: number;
      prochaineSynchronisation: string | null;
    }[];
    const e = s.find((x) => x.integrationId === tenable.id)!;
    expect(e.frequenceHeures).toBe(12);
    expect(Date.parse(e.prochaineSynchronisation!)).toBeGreaterThan(Date.now() + 11 * 3_600_000);
    const surface = (await rssi.get(`${V}/surface/etat`)).json() as {
      integrationId: string;
      frequenceHeures: number;
      prochaineSynchronisation: string | null;
    }[];
    expect(surface.find((x) => x.integrationId === alh.id)).toMatchObject({ frequenceHeures: 24 });
    await t.svc.db.q('UPDATE integrations SET actif = false WHERE id = $1', [alh.id]);
    try {
      const apres = (await rssi.get(`${V}/surface/etat`)).json() as {
        integrationId: string;
        prochaineSynchronisation: string | null;
      }[];
      expect(apres.find((x) => x.integrationId === alh.id)!.prochaineSynchronisation).toBeNull();
    } finally {
      await t.svc.db.q('UPDATE integrations SET actif = true WHERE id = $1', [alh.id]);
    }
  });
});

describe('alertes à la fin d’une collecte planifiée (règles inchangées)', () => {
  it('une CVE critique exploitée qui touche un produit surveillé relié à une machine ouvre son alerte dès la collecte NVD suivante', async () => {
    // Machine fictive de l'instance Tenable, produit surveillé relié, faille déjà connue comme exploitée (KEV).
    await t.svc.db.q(
      'INSERT INTO vulnerabilites_tenable_etat (integration_id, numero, numero_complet) VALUES ($1, 1, 1) ON CONFLICT DO NOTHING',
      [tenable.id],
    );
    const machine = (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_machines (integration_id, identifiant_source, nom, adresse, vu_numero)
       VALUES ($1, 'ip:192.0.2.61', 'srv-frequence-01.exemple.invalid', '192.0.2.61', 1) RETURNING id`,
      [tenable.id],
    ))!.id;
    const p = await admin.post(`${V}/produits`, {
      editeur: 'Éditeur fréquence fictif',
      nom: 'Produit fréquence fictif',
      versionProduit: '3.1.0',
      cpe: CPE,
      famille: 'applications_metier',
      criticite: 'elevee',
    });
    expect(p.statusCode, p.body).toBe(201);
    const lie = await admin.post(
      `${V}/produits/${p.json().id}/machines`,
      { machineId: machine },
      ifMatch(p.json().version),
    );
    expect(lie.statusCode, lie.body).toBe(200);
    // Collecte du catalogue KEV (manuelle) : la faille est déjà connue comme exploitée, sans produit touché.
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('cisa-kev', 'manuel', 'test')",
    );
    const kev = (await t.svc.vulnerabilites.veille.reclamer(true))!;
    await t.svc.vulnerabilites.veille.lot(kev.id as string, {
      elements: [
        {
          cve: 'CVE-2026-93001',
          editeur: 'Éditeur fréquence fictif',
          produit: 'Produit fréquence fictif',
          nom: 'Fictional Product Vulnerability',
          description: 'Fictional description, kept as is.',
          action: 'Apply mitigations per vendor instructions.',
          ajoutLe: '2026-11-13',
          echeance: '2026-12-04',
          rancongiciel: false,
        },
      ],
    });
    await t.svc.vulnerabilites.veille.terminer(kev.id as string, {
      ok: true,
      bilan: { elements: 1, ecartes: 0, tronque: false, detailsEchoues: 0 },
      erreur: null,
    });
    expect(await n('vulnerabilites_alertes')).toBe(0);
    // Tic : collectes planifiées ; l'exécutant fictif rapporte NVD (la CVE touche le produit), rien pour les autres.
    await t.svc.backups.heartbeat(true);
    const ids = await t.svc.vulnerabilites.veille.planifier(new Date());
    expect(ids.length).toBeGreaterThan(0);
    for (;;) {
      const job = await t.svc.vulnerabilites.veille.reclamer(true);
      if (!job) break;
      const elements =
        job.source === 'nvd'
          ? [
              {
                cve: 'CVE-2026-93001',
                publieLe: '2026-11-15T10:00:00.000Z',
                modifieLe: '2026-11-16T08:00:00.000Z',
                description: 'Fictional NVD description.',
                cvss31: {
                  score: 9.8,
                  vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                  gravite: 'CRITICAL',
                },
                cvss40: null,
                editeurs: ['editeur_frequence_fictif'],
                produits: ['produit_frequence_fictif'],
                produitsTouches: [
                  {
                    partie: 'a',
                    editeur: 'editeur_frequence_fictif',
                    produit: 'produit_frequence_fictif',
                    version: null,
                    debutInclus: null,
                    debutExclus: null,
                    finInclus: null,
                    finExclus: '3.2.0',
                    vulnerable: true,
                  },
                ],
                produitsTronques: false,
              },
            ]
          : [];
      if (elements.length) await t.svc.vulnerabilites.veille.lot(job.id as string, { elements });
      await t.svc.vulnerabilites.veille.terminer(job.id as string, {
        ok: true,
        bilan: { elements: elements.length, ecartes: 0, tronque: false, detailsEchoues: 0 },
        erreur: null,
      });
    }
    const alertes = (
      await t.svc.db.q<{ cle: string; niveau: string; etat: string }>(
        'SELECT cle, niveau, etat FROM vulnerabilites_alertes',
      )
    ).rows;
    expect(alertes).toEqual([{ cle: 'CVE-2026-93001', niveau: 'critique', etat: 'ouverte' }]);
    const ouverte = (await audits('vulnerabilites.alerte.ouverte')).at(-1)!;
    expect(ouverte.details.declencheur).toBe('collecte-nvd');
  });
});
