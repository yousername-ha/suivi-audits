/* Module Vulnérabilités (ADR 0100, lot SI1) : import du rapport Silène de l'ANSSI par le connecteur « silene-fichier » de la
   carte « Intégrations », et lecture fusionnée avec AlgoLightHouse dans l'écran « Surface externe ». Migration 095 ; type
   sans adresse, sans clé, sans flux ; import nominal en trois temps (début, lots, fin) ; réimport où un hôte et un constat
   disparaissent (plus présents, comptés) et note gardée d'un import à l'autre ; import interrompu (le rapport précédent fait
   foi) ; champ en trop et classe hors borne refusés ; droits (lecteur des intégrations : 403) et cloisonnement par périmètre
   (instance non reliée : administration seulement ; reliée : lecteurs du périmètre seulement) ; fusion avec un actif
   d'AlgoLightHouse de même adresse IP et de même nom de domaine (une seule ligne, deux sources) ; actif vu par Silène seul
   trouvé par la recherche du module (contrat inchangé) ; suppression du connecteur et de ce qu'il a importé ; journal sans
   adresse ni nom. Données entièrement fictives : adresses de 192.0.2.0/24, 198.51.100.0/24 et 203.0.113.0/24, noms
   en example.org ; aucun service n'est joint. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const I = '/api/integrations';
const S = '/api/vulnerabilites/surface';
let t: TestApp;
let admin: Agent, lecteurIntegrations: Agent, lecteurA: Agent, lecteurB: Agent;
let silene: string, sileneVersion: number, perimA: string, perimB: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const ECARTS = {
  hotesInvalides: 1,
  hotesAuDela: 0,
  nomsInvalides: 0,
  portsInvalides: 2,
  portsAuDela: 0,
  produitsInvalides: 0,
  controlesInvalides: 0,
  constatsInvalides: 0,
  constatsSansControle: 1,
  constatsAuDela: 0,
  lignesInvalides: 0,
  lignesAuDela: 0,
  perimetreInvalide: 0,
  valeursInvalides: 0,
  textesRaccourcis: 0,
};
const rapport = (note: number, date = '2026-11-15') => ({
  date,
  debut: `${date}T08:00:00`,
  fin: `${date}T09:30:00`,
  note,
  noteReseau: note - 1.5,
  vulnreco: 2,
  warning: 1,
  info: 3,
  ok: 40,
});
const hote = (adresse: string, extra: Record<string, unknown> = {}) => ({
  adresse,
  noms: [{ nom: `www-${adresse.split('.').pop()}.example.org`, type: 'A' }],
  ports: [
    { port: 443, protocole: 'tcp', service: 'https', produit: 'Fictional httpd', tunnel: 'ssl' },
    { port: 22, protocole: 'tcp', service: 'ssh', produit: null, tunnel: null },
  ],
  portsOuverts: 2,
  produits: [{ type: 'a', editeur: 'fictional', produit: 'httpd', version: '9.9' }],
  controles: ['OpenPort', 'HttpVersion'],
  ...extra,
});
const constat = (identifiant: string, controle: string, hotes: string[], classe = 2) => ({
  identifiant,
  controle,
  classe,
  points: 10,
  note: null,
  hotes,
  lignes: hotes.map((h) => ({
    hote: h,
    port: 443,
    protocole: 'tcp',
    service: 'https',
    produit: 'Fictional httpd',
    nomHote: null,
    type: null,
    echeance: null,
  })),
});
const debut = (hotes: number, constats: number, note = 14.5, date = '2026-11-15') => ({
  rapport: rapport(note, date),
  perimetre: { domaines: ['example.org'], plages: ['192.0.2.0/24', '198.51.100.7'] },
  hotes,
  constats,
  ecartes: ECARTS,
});
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;

/** Import complet par les routes : début, lots, fin. */
async function importer(
  lots: { hotes: unknown[]; constats: unknown[] }[],
  o: { note?: number; date?: string; qui?: Agent; annonces?: { hotes: number; constats: number } } = {},
) {
  const qui = o.qui ?? admin;
  const hotes = o.annonces?.hotes ?? lots.reduce((s, l) => s + l.hotes.length, 0);
  const constats = o.annonces?.constats ?? lots.reduce((s, l) => s + l.constats.length, 0);
  const d = await qui.post(`${I}/instances/${silene}/silene/imports`, debut(hotes, constats, o.note, o.date));
  expect(d.statusCode, d.body).toBe(201);
  const id = d.json().id as string;
  for (const l of lots) {
    const r = await qui.post(`${I}/instances/${silene}/silene/imports/${id}/lots`, l);
    expect(r.statusCode, r.body).toBe(200);
  }
  const f = await qui.post(`${I}/instances/${silene}/silene/imports/${id}/fin`, {});
  expect(f.statusCode, f.body).toBe(200);
  return { id, bilan: f.json() };
}

const ACTIFS_PREMIER = [hote('192.0.2.10'), hote('198.51.100.20'), hote('203.0.113.30', { noms: [] })];
const CONSTATS_PREMIER = [
  constat('res-fictif-0001', 'OpenPort', ['192.0.2.10', '198.51.100.20']),
  constat('res-fictif-0002', 'SelfSignedCertificate', ['203.0.113.30'], 1),
];

/** Surface fictive d'AlgoLightHouse rangée en base : l'hôte 192.0.2.10 et le domaine www-10.example.org (mêmes valeurs que
    Silène), plus un hôte vu par AlgoLightHouse seul. Périmètre ALH relié au périmètre A. */
async function surfaceAlh() {
  const i = (await t.svc.db.one<{ id: string }>(
    `INSERT INTO integrations (type, nom, configuration, created_by, updated_by)
       VALUES ('algolighthouse', 'AlgoLightHouse fictif', '{"adresse":"https://espace-fictif.algolighthouse.fr"}', 'test', 'test')
       RETURNING id`,
  ))!.id;
  await t.svc.db.q('INSERT INTO vulnerabilites_alh_etat (integration_id, numero, numero_complet) VALUES ($1, 1, 1)', [
    i,
  ]);
  const perim = '0190a000-0000-7000-8000-000000000001';
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_alh_perimetres (integration_id, alh_id, nom, perimetre_id, vu_numero)
     VALUES ($1, $2, 'Périmètre ALH fictif', $3, 1)`,
    [i, perim, perimA],
  );
  const actif = (n: number, type: string, valeur: string, adresse: string | null) =>
    t.svc.db.q(
      `INSERT INTO vulnerabilites_alh_actifs (integration_id, type, alh_id, perimetre_alh, statut, valeur, adresse, vu_numero)
       VALUES ($1, $2, $3, $4, 'monitored', $5, $6, 1)`,
      [i, type, `0190a000-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`, perim, valeur, adresse],
    );
  await actif(1, 'hote', '192.0.2.10', null);
  await actif(2, 'domaine', 'www-10.example.org', '192.0.2.10');
  await actif(3, 'hote', '192.0.2.99', null);
  return i;
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'silene_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_si_integ', 'Intégrations, lecture', ARRAY['integrations:lire','vulnerabilites:lire','vulnerabilites:administrer']),
       ('r_si_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])`,
  );
  lecteurIntegrations = await login(t, await makeUser(t, 'silene_integ', 'r_si_integ'));
  perimA = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif A', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  perimB = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif B', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uA = await makeUser(t, 'silene_lecteur_a', 'r_si_lire', { rattache: false });
  const uB = await makeUser(t, 'silene_lecteur_b', 'r_si_lire', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($3, $4, false)', [
    perimA,
    uA.id,
    perimB,
    uB.id,
  ]);
  lecteurA = await login(t, uA);
  lecteurB = await login(t, uB);
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q("DELETE FROM integrations WHERE type IN ('silene-fichier', 'algolighthouse')");
  t.svc.limits.importNessus.reset();
  t.svc.limits.importNessusLot.reset();
  const r = await admin.post(`${I}/instances`, { type: 'silene-fichier', nom: 'Silène fictif', configuration: {} });
  expect(r.statusCode, r.body).toBe(201);
  silene = r.json().id as string;
  const a = await admin.put(`${I}/instances/${silene}/activation`, { actif: true }, ifMatch(r.json().version));
  expect(a.statusCode, a.body).toBe(200);
  sileneVersion = a.json().version as number;
});

describe('migration 095 et catalogue', () => {
  it('type sans adresse, sans clé, sans flux ni fréquence ; contraintes des tables alignées sur AlgoLightHouse', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '095_vulnerabilites_silene.sql'"))?.ok,
    ).toBe(1);
    const cat = (await admin.get(`${I}/catalogue`)).json() as { id: string; flux: unknown; secrets: unknown[] }[];
    expect(cat.find((x) => x.id === 'silene-fichier')).toMatchObject({ flux: null, secrets: [], pointsAcces: [] });
    // Configuration : aucun champ admis.
    const refus = await admin.post(`${I}/instances`, {
      type: 'silene-fichier',
      nom: 'Silène refusé',
      configuration: { adresse: 'https://silene.example.org' },
    });
    expect(refus.statusCode).toBe(422);
    await expect(t.svc.db.q('UPDATE integrations SET frequence_heures = 24 WHERE id = $1', [silene])).rejects.toThrow(
      /integrations_frequence/,
    );
    const h = 'INSERT INTO vulnerabilites_silene_hotes (integration_id, adresse, vu_numero) VALUES ($1, $2, 1)';
    await expect(t.svc.db.q(h, [silene, 'HOTE.EXAMPLE.ORG'])).rejects.toThrow(/check/);
    await t.svc.db.q(h, [silene, '192.0.2.1']);
    await expect(
      t.svc.db.q(
        "INSERT INTO vulnerabilites_silene_ports (hote_id, port, protocole) SELECT id, 0, 'tcp' FROM vulnerabilites_silene_hotes",
      ),
    ).rejects.toThrow(/check/);
    await expect(
      t.svc.db.q(
        "INSERT INTO vulnerabilites_silene_noms (hote_id, nom, type) SELECT id, 'WWW.Example.org', 'A' FROM vulnerabilites_silene_hotes",
      ),
    ).rejects.toThrow(/check/);
  });
});

describe('import nominal, réimport, note gardée', () => {
  it('range hôtes et constats ; le réimport fait disparaître l’hôte et le constat absents ; la note précédente est gardée', async () => {
    const { id, bilan } = await importer([{ hotes: ACTIFS_PREMIER, constats: CONSTATS_PREMIER }]);
    expect(bilan).toMatchObject({ hotesAnnonces: 3, hotes: 3, constatsAnnonces: 2, constats: 2, lots: 1 });
    expect(bilan.ecartes).toEqual(ECARTS);
    const x = (await admin.get(`${I}/executions/${id}`)).json();
    expect(x).toMatchObject({ operation: 'importer', etat: 'recu' });
    // Note : instance non reliée, lisible avec administrer (l'administrateur).
    const notes = (await admin.get(`${S}/silene`)).json() as {
      courante: { note: number; noteReseau: number; date: string; ok: number };
      precedente: unknown;
      hotes: number;
      constats: number;
      perimetre: { domaines: number; plages: number };
    }[];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      courante: { note: 14.5, noteReseau: 13, date: '2026-11-15', ok: 40, debut: '2026-11-15T08:00:00' },
      precedente: null,
      hotes: 3,
      constats: 2,
      perimetre: { domaines: 1, plages: 2 },
    });
    const c = (await admin.get(`${S}/silene/constats`)).json();
    expect(c.total).toBe(2);
    expect(c.elements.map((e: { controle: string }) => e.controle)).toEqual(['OpenPort', 'SelfSignedCertificate']);
    const fiche = (await admin.get(`${S}/silene/constats/${c.elements[0].id}`)).json();
    expect(fiche.parHote.map((h: { hote: string }) => h.hote)).toEqual(['192.0.2.10', '198.51.100.20']);
    expect(fiche.parHote[0].lignes[0]).toMatchObject({ port: 443, protocole: 'tcp', service: 'https' });

    // Second rapport : 198.51.100.20 et le constat 0002 ont disparu ; 192.0.2.10 perd son port 22.
    const { bilan: b2 } = await importer(
      [
        {
          hotes: [hote('192.0.2.10', { ports: [hote('x').ports[0]] }), hote('203.0.113.30', { noms: [] })],
          constats: [constat('res-fictif-0001', 'OpenPort', ['192.0.2.10'])],
        },
      ],
      { note: 16.25, date: '2026-11-18' },
    );
    expect(b2).toMatchObject({ hotes: 2, constats: 1, hotesDisparus: 1, constatsDisparus: 1 });
    const n2 = (await admin.get(`${S}/silene`)).json()[0];
    expect(n2.courante).toMatchObject({ note: 16.25, date: '2026-11-18' });
    expect(n2.precedente).toMatchObject({ note: 14.5, date: '2026-11-15' });
    expect(n2.historique).toHaveLength(2);
    expect(n2).toMatchObject({ hotes: 2, constats: 1 });
    expect((await admin.get(`${S}/silene/constats`)).json().total).toBe(1);
    const actifs = (await admin.get(`${S}/actifs?type=hote`)).json();
    expect(actifs.elements.map((e: { valeur: string }) => e.valeur)).toEqual(['192.0.2.10', '203.0.113.30']);
    expect(actifs.elements[0].silene.ports.map((p: { port: number }) => p.port)).toEqual([443]);
    // Rien n'est supprimé : l'hôte disparu reste en base, non présent.
    expect(
      (await t.svc.db.one<{ n: number }>(
        "SELECT count(*)::int AS n FROM vulnerabilites_silene_hotes WHERE adresse = '198.51.100.20'",
      ))!.n,
    ).toBe(1);
  });

  it('import interrompu : en échec, le rapport précédent reste celui qui fait foi', async () => {
    await importer([{ hotes: ACTIFS_PREMIER, constats: CONSTATS_PREMIER }]);
    const d = await admin.post(`${I}/instances/${silene}/silene/imports`, debut(2, 1, 3));
    const id = d.json().id as string;
    expect(
      (
        await admin.post(`${I}/instances/${silene}/silene/imports/${id}/lots`, {
          hotes: [hote('192.0.2.10')],
          constats: [],
        })
      ).statusCode,
    ).toBe(200);
    const f = await admin.post(`${I}/instances/${silene}/silene/imports/${id}/fin`, {});
    expect(f.statusCode).toBe(200);
    const x = (await admin.get(`${I}/executions/${id}`)).json();
    expect(x.etat).toBe('echec');
    expect(x.erreur).toContain('1 hôte importé sur 2');
    const n = (await admin.get(`${S}/silene`)).json()[0];
    expect(n.courante.note).toBe(14.5);
    expect(n).toMatchObject({ hotes: 3, constats: 2 });
    expect(n.derniere.etat).toBe('echec');
  });

  it('refuse un champ en trop, une classe hors borne, plus d’hôtes qu’annoncé ; rien n’est rangé', async () => {
    const d = await admin.post(`${I}/instances/${silene}/silene/imports`, debut(1, 1));
    const id = d.json().id as string;
    const lot = (l: unknown) => admin.post(`${I}/instances/${silene}/silene/imports/${id}/lots`, l);
    expect((await lot({ hotes: [hote('192.0.2.10', { certificat: 'PEM-INTERDIT' })], constats: [] })).statusCode).toBe(
      422,
    );
    expect((await lot({ hotes: [], constats: [constat('res-fictif-9', 'OpenPort', [], 5000)] })).statusCode).toBe(422);
    expect((await lot({ hotes: [hote('192.0.2.10'), hote('192.0.2.11')], constats: [] })).statusCode).toBe(422);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM vulnerabilites_silene_hotes'))!.n).toBe(
      0,
    );
    // Début : champ interdit (passage précédent) refusé.
    expect(
      (await admin.post(`${I}/instances/${silene}/silene/imports`, { ...debut(1, 0), _prev: {} })).statusCode,
    ).toBe(422);
  });
});

describe('droits et cloisonnement par périmètre', () => {
  it('lecteur des intégrations : 403 ; instance non reliée : administration seulement ; reliée : lecteurs du périmètre', async () => {
    expect((await lecteurIntegrations.post(`${I}/instances/${silene}/silene/imports`, debut(1, 0))).statusCode).toBe(
      403,
    );
    await importer([{ hotes: ACTIFS_PREMIER, constats: CONSTATS_PREMIER }]);
    // Non reliée : ni note, ni constat, ni actif pour un lecteur de périmètre ; l'administration du module voit tout.
    for (const a of [lecteurA, lecteurB]) {
      expect((await a.get(`${S}/silene`)).json()).toEqual([]);
      expect((await a.get(`${S}/silene/constats`)).json().total).toBe(0);
      expect((await a.get(`${S}/actifs`)).json().total).toBe(0);
      expect((await a.get(`${S}/silene/actif?type=hote&valeur=192.0.2.10`)).statusCode).toBe(404);
    }
    expect((await lecteurIntegrations.get(`${S}/silene`)).json()).toHaveLength(1);
    expect((await lecteurA.get(`${S}/silene/perimetres`)).statusCode).toBe(403);
    // Relier à A (If-Match 0 : jamais reliée).
    const p = (await admin.get(`${S}/silene/perimetres`)).json();
    expect(p).toEqual([expect.objectContaining({ integrationId: silene, perimetreId: null, version: 0, hotes: 3 })]);
    expect((await admin.put(`${S}/silene/perimetres/${silene}`, { perimetreId: perimA }, ifMatch(3))).statusCode).toBe(
      412,
    );
    const l = await admin.put(`${S}/silene/perimetres/${silene}`, { perimetreId: perimA }, ifMatch(0));
    expect(l.statusCode, l.body).toBe(200);
    expect(l.json()).toMatchObject({ perimetreNom: 'Périmètre fictif A', version: 1 });
    expect((await audits('vulnerabilites.silene.perimetre.relie'))[0]!.target).toBe(silene);
    // Lecteur de A : tout ; lecteur de B : rien.
    expect((await lecteurA.get(`${S}/silene`)).json()[0]).toMatchObject({ perimetreNom: 'Périmètre fictif A' });
    expect((await lecteurA.get(`${S}/silene/constats`)).json().total).toBe(2);
    expect((await lecteurA.get(`${S}/actifs?type=hote`)).json().total).toBe(3);
    const fa = await lecteurA.get(`${S}/silene/actif?type=hote&valeur=192.0.2.10`);
    expect(fa.statusCode).toBe(200);
    expect(fa.json()).toMatchObject({ adresses: ['192.0.2.10'], nombrePorts: 2, constats: 1 });
    expect(fa.json().listeConstats[0]).toMatchObject({ controle: 'OpenPort' });
    expect((await lecteurB.get(`${S}/silene`)).json()).toEqual([]);
    expect((await lecteurB.get(`${S}/actifs`)).json().total).toBe(0);
    const id = (await admin.get(`${S}/silene/constats`)).json().elements[0].id as string;
    expect((await lecteurB.get(`${S}/silene/constats/${id}`)).statusCode).toBe(404);
  });
});

describe('fusion avec AlgoLightHouse et recherche', () => {
  it('même adresse IP et même nom de domaine : une ligne, deux sources ; actif de Silène seul trouvé par la recherche', async () => {
    await surfaceAlh();
    await importer([{ hotes: ACTIFS_PREMIER, constats: CONSTATS_PREMIER }]);
    const tous = (await admin.get(`${S}/actifs`)).json();
    const parValeur = new Map(
      (
        tous.elements as {
          id: string;
          valeur: string;
          type: string;
          sources: string[];
          alhId: string | null;
          silene: { ports: { port: number }[]; adresses: string[] } | null;
          statut: string | null;
        }[]
      ).map((e) => [`${e.type}|${e.valeur}`, e]),
    );
    // Hôte vu par les deux sources : une seule ligne, champs d'AlgoLightHouse et ports ouverts de Silène.
    expect([...parValeur.keys()].filter((k) => k === 'hote|192.0.2.10')).toHaveLength(1);
    const deux = parValeur.get('hote|192.0.2.10')!;
    expect(deux).toMatchObject({ sources: ['alh', 'silene'], statut: 'monitored' });
    expect(deux.alhId).toBe(deux.id);
    expect(deux.silene!.ports.map((p) => p.port)).toEqual([22, 443]);
    // Nom de domaine vu par les deux : une ligne, adresse portée par Silène.
    expect(parValeur.get('domaine|www-10.example.org')).toMatchObject({ sources: ['alh', 'silene'] });
    expect(parValeur.get('domaine|www-10.example.org')!.silene!.adresses).toEqual(['192.0.2.10']);
    // Vu par AlgoLightHouse seul, puis par Silène seul.
    expect(parValeur.get('hote|192.0.2.99')).toMatchObject({ sources: ['alh'], silene: null });
    const seul = parValeur.get('hote|203.0.113.30')!;
    expect(seul).toMatchObject({ sources: ['silene'], alhId: null, statut: null, alertesOuvertes: 0 });
    expect(parValeur.get('domaine|www-20.example.org')).toMatchObject({
      sources: ['silene'],
      adresse: '198.51.100.20',
    });
    // Trois actifs d'AlgoLightHouse (dont deux vus aussi par Silène) et trois de Silène seul (deux hôtes, un nom).
    expect(tous.total).toBe(6);
    // Filtre « Machine interne » : seuls les actifs d'AlgoLightHouse.
    expect(
      ((await admin.get(`${S}/actifs?liaison=a_relier`)).json().elements as { sources: string[] }[]).every((e) =>
        e.sources.includes('alh'),
      ),
    ).toBe(true);
    // Recherche du module : contrat inchangé, l'actif de Silène seul est trouvé.
    const r = await admin.get('/api/vulnerabilites/recherche?q=203.0.113.30');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().actifs).toEqual({
      total: 1,
      elements: [
        {
          id: seul.id,
          type: 'hote',
          valeur: '203.0.113.30',
          adresse: null,
          perimetreNom: null,
          alertesOuvertes: 0,
        },
      ],
    });
  });
});

describe('suppression du connecteur, limite, journal', () => {
  it('aperçu chiffré, If-Match, tout ce que l’instance a importé disparaît ; journal sans adresse ni nom', async () => {
    await importer([{ hotes: ACTIFS_PREMIER, constats: CONSTATS_PREMIER }]);
    const ap = await admin.get(`${I}/instances/${silene}/suppression`);
    expect(ap.json()).toEqual({ hotes: 3, constats: 2, imports: 1 });
    expect((await lecteurIntegrations.del(`${I}/instances/${silene}`, ifMatch(sileneVersion))).statusCode).toBe(403);
    expect((await admin.del(`${I}/instances/${silene}`, ifMatch(sileneVersion + 7))).statusCode).toBe(412);
    const d = await admin.del(`${I}/instances/${silene}`, ifMatch(sileneVersion));
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json()).toEqual({ hotes: 3, constats: 2, imports: 1 });
    for (const table of [
      'vulnerabilites_silene_hotes',
      'vulnerabilites_silene_ports',
      'vulnerabilites_silene_constats',
      'vulnerabilites_silene_lignes',
      'vulnerabilites_silene_imports',
      'vulnerabilites_silene_etat',
    ])
      expect((await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`))!.n, table).toBe(0);
    expect((await admin.get(`${S}/silene`)).json()).toEqual([]);
    const journal = [
      ...(await audits('integration.import.debute')),
      ...(await audits('vulnerabilites.silene.lot')),
      ...(await audits('integration.import.termine')),
      ...(await audits('integration.supprimee')),
    ];
    expect(journal.length).toBeGreaterThanOrEqual(4);
    const texte = JSON.stringify(journal);
    for (const interdit of ['192.0.2.', '198.51.100.', '203.0.113.', 'example.org', 'Fictional', 'OpenPort'])
      expect(texte.includes(interdit), interdit).toBe(false);
  });

  it('limite des imports commencés partagée avec Nessus (429, message commun)', async () => {
    // La limite est par personne : on l'épuise pour l'administrateur.
    const id = (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username = 'silene_admin'"))!.id;
    for (let i = 0; i < 30; i++) t.svc.limits.importNessus(id);
    const r = await admin.post(`${I}/instances/${silene}/silene/imports`, debut(1, 0));
    expect(r.statusCode).toBe(429);
    expect(r.json().error).toBe('Trop d’imports de fichiers commencés (30 par heure). Réessayez dans une heure.');
  });
});
