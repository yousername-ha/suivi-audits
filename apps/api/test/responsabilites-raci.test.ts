/* Matrice « Qui décide quoi » des rôles et responsabilités (ADR 0115 ; décision du RSSI du 27/11/2026, migration 108) :
   droits du pilotage (sans droit, lecteur, contributeur, administrateur), périmètre (compte non rattaché, rattaché en
   lecture seule, une matrice par périmètre), colonnes issues du registre (fiches du Pilotage, rôles de l'outil de suivi au
   périmètre commun), If-Match (428 sans, 412 périmé), règle « un A, au moins un R » signalée sans bloquer, bornes et forme
   (API et base), journal d'audit réduit aux comptes, rôle retiré (lettres conservées, colonne « Rôle retiré »), contrôle
   des relations, remise à vide. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controleRelations } from '../src/controle-relations.js';
import { TABLES_TRAVAIL, tablesAVider } from '../src/remise-a-vide.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const COMMUN = '00000000-0000-4000-8000-000000000001';
let t: TestApp, admin: Agent, lecteur: Agent, contributeur: Agent, sansDroit: Agent, horsPerimetre: Agent;
let enLecture: Agent;
let perimetre: string, voisin: string;
let rssi: { id: string; version: number }, dsi: { id: string; version: number }, roleVoisin: string;
const url = (smsi: string) => `/api/grc/${smsi}/pilotage/responsabilites/raci`;
const im = (v: number | string) => ({ 'if-match': `"${v}"` });
const ref = (id: string) => `object:${id}`;
const lignesAudit = async (action: string) =>
  (
    await t.svc.db.q<{ target: string; details: Record<string, unknown> }>(
      'SELECT target, details FROM audit_log WHERE action=$1 ORDER BY id',
      [action],
    )
  ).rows;
const role = async (smsi: string, nom: string) => {
  const r = await admin.post(`/api/grc/${smsi}/objects`, { kind: 'governance', name: nom, data: {} });
  expect(r.statusCode, r.body).toBe(200);
  return { id: r.json().id as string, version: r.json().version as number };
};
const creerPerimetre = async (nom: string) => {
  const r = await admin.post('/api/grc/smsis', { name: nom, scope: 'Recette ADR 0115', timezone: 'Europe/Paris' });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
};
/** Deux décisions fictives : la première conforme (un A, un R), la seconde avec deux A et sans R. */
const corps = () => ({
  decisions: [
    { id: 'budget', libelle: '  Valider le budget\tsécurité fictif ' },
    { id: 'derogation', libelle: 'Accorder une dérogation fictive' },
  ],
  cases: [
    { decision: 'budget', role: ref(rssi.id), lettre: 'R' },
    { decision: 'budget', role: ref(dsi.id), lettre: 'A' },
    { decision: 'derogation', role: ref(rssi.id), lettre: 'A' },
    { decision: 'derogation', role: ref(dsi.id), lettre: 'A' },
  ],
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'qdq_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'qdq_lecteur', 'ro'));
  // Rôle personnalisé sans aucun droit sur le pilotage.
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_qdq_sans', 'Sans pilotage', '{fournisseurs:lire,audit:lire}')",
  );
  sansDroit = await login(t, await makeUser(t, 'qdq_sans_droit', 'r_qdq_sans'));
  perimetre = await creerPerimetre('Périmètre fictif des décisions');
  voisin = await creerPerimetre('Périmètre voisin fictif');
  const comptes = {
    contributeur: await makeUser(t, 'qdq_contributeur', 'rw', { rattache: false }),
    lecture: await makeUser(t, 'qdq_lecture', 'rw', { rattache: false }),
    hors: await makeUser(t, 'qdq_hors', 'rw', { rattache: false }),
  };
  for (const [u, smsi, write] of [
    [comptes.contributeur, perimetre, true],
    [comptes.lecture, perimetre, false],
    [comptes.hors, voisin, true],
  ] as const) {
    const r = await admin.put(`/api/grc/${smsi}/members`, { userId: u.id, write });
    expect(r.statusCode, r.body).toBeLessThan(300);
  }
  contributeur = await login(t, comptes.contributeur);
  enLecture = await login(t, comptes.lecture);
  horsPerimetre = await login(t, comptes.hors);
  dsi = await role(perimetre, 'DSI fictive');
  rssi = await role(perimetre, 'RSSI fictif');
  roleVoisin = (await role(voisin, 'Rôle du voisin fictif')).id;
});
afterAll(() => t.close());

describe('lecture', () => {
  it('matrice vide au départ ; les colonnes sont les rôles du registre du périmètre, par ordre alphabétique', async () => {
    const r = await enLecture.get(url(perimetre));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBeUndefined();
    expect(r.json()).toEqual({
      matrice: null,
      roles: [
        { ref: ref(dsi.id), libelle: 'DSI fictive', retire: false },
        { ref: ref(rssi.id), libelle: 'RSSI fictif', retire: false },
      ],
      controle: [],
    });
    // Une matrice par périmètre : le voisin n'a que ses propres rôles.
    expect((await horsPerimetre.get(url(voisin))).json().roles).toEqual([
      { ref: ref(roleVoisin), libelle: 'Rôle du voisin fictif', retire: false },
    ]);
  });
  it('refuse sans le droit de lire le pilotage, et l’écriture au lecteur', async () => {
    for (const r of [
      await sansDroit.get(url(COMMUN)),
      await sansDroit.put(url(COMMUN), { decisions: [], cases: [] }, im(0)),
      await lecteur.put(url(COMMUN), { decisions: [], cases: [] }, im(0)),
    ])
      expect(r.statusCode, r.body).toBe(403);
  });
  it('cloisonne par périmètre : non rattaché, 404 ; rattaché en lecture seule, écriture refusée (403)', async () => {
    expect((await horsPerimetre.get(url(perimetre))).statusCode).toBe(404);
    expect((await horsPerimetre.put(url(perimetre), corps(), im(0))).statusCode).toBe(404);
    expect((await enLecture.put(url(perimetre), corps(), im(0))).statusCode).toBe(403);
    expect(await t.svc.db.one('SELECT 1 FROM responsabilites_raci WHERE smsi_id=$1', [perimetre])).toBeFalsy();
  });
  it('exige le jeton CSRF', async () => {
    const r = await contributeur.req('PUT', url(perimetre), { json: corps(), headers: im(0), csrf: false });
    expect(r.statusCode).toBe(403);
  });
});

describe('enregistrement', () => {
  it('exige If-Match (428) ; à la création, seule la version « 0 » est admise (412)', async () => {
    expect((await contributeur.put(url(perimetre), corps())).statusCode).toBe(428);
    expect((await contributeur.put(url(perimetre), corps(), im(1))).statusCode).toBe(412);
  });
  it('crée la matrice (contributeur) : version 1, ETag, libellés nettoyés, règle signalée sans bloquer', async () => {
    const r = await contributeur.put(url(perimetre), corps(), im(0));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe('"1"');
    const { matrice, roles, controle } = r.json();
    expect(matrice).toMatchObject({ smsiId: perimetre, version: 1, misAJourPar: 'qdq_contributeur' });
    expect(matrice.decisions.map((d: { libelle: string }) => d.libelle)).toEqual([
      'Valider le budget sécurité fictif',
      'Accorder une dérogation fictive',
    ]);
    expect(matrice.cases).toEqual(corps().cases);
    expect(roles).toHaveLength(2);
    expect(controle).toEqual([
      { decision: 'budget', libelle: 'Valider le budget sécurité fictif', a: 1, r: 1, ecarts: [] },
      {
        decision: 'derogation',
        libelle: 'Accorder une dérogation fictive',
        a: 2,
        r: 0,
        ecarts: ['plusieurs_a', 'aucun_r'],
      },
    ]);
    // Une seconde création (If-Match « 0 ») est un conflit, avec la version courante.
    const deux = await admin.put(url(perimetre), corps(), im(0));
    expect(deux.statusCode).toBe(412);
    expect(deux.json().current.version).toBe(1);
    const lu = await enLecture.get(url(perimetre));
    expect(lu.headers.etag).toBe('"1"');
    expect(lu.json().matrice.version).toBe(1);
  });
  it('remplace la matrice avec la version courante ; version périmée : 412, rien n’est écrit', async () => {
    const c = corps();
    c.cases = c.cases.filter((k) => !(k.decision === 'derogation' && k.role === ref(dsi.id)));
    c.cases.push({ decision: 'derogation', role: ref(dsi.id), lettre: 'R' });
    const r = await contributeur.put(url(perimetre), c, im(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().matrice.version).toBe(2);
    expect(r.json().controle.every((x: { ecarts: string[] }) => x.ecarts.length === 0)).toBe(true);
    const perime = await admin.put(url(perimetre), corps(), im(1));
    expect(perime.statusCode).toBe(412);
    expect(perime.json().current).toMatchObject({ version: 2 });
    expect((await enLecture.get(url(perimetre))).json().matrice.version).toBe(2);
  });
  it('n’admet que les rôles du registre du périmètre (422) et contrôle bornes et forme', async () => {
    const c = corps();
    const decisions = Array.from({ length: 61 }, (_, i) => ({ id: `d-${i}`, libelle: `Décision fictive ${i}` }));
    const cas = [
      { ...c, cases: [{ decision: 'budget', role: ref(roleVoisin), lettre: 'R' }] },
      { ...c, cases: [{ decision: 'budget', role: 'object:00000000-0000-4000-8000-00000000abcd', lettre: 'R' }] },
      { ...c, cases: [{ decision: 'budget', role: 'legacy:roles:R-INCONNU', lettre: 'R' }] },
      { ...c, cases: [{ decision: 'budget', role: 'legacy:suppliers:SUP-1', lettre: 'R' }] },
      { ...c, cases: [{ decision: 'budget', role: ref(rssi.id), lettre: 'X' }] },
      { ...c, cases: [{ decision: 'inconnue', role: ref(rssi.id), lettre: 'R' }] },
      {
        ...c,
        cases: [
          { decision: 'budget', role: ref(rssi.id), lettre: 'R' },
          { decision: 'budget', role: ref(rssi.id), lettre: 'A' },
        ],
      },
      { ...c, decisions },
      { ...c, decisions: [{ id: 'x', libelle: 'x'.repeat(201) }], cases: [] },
      { ...c, decisions: [{ id: 'x', libelle: '\u0000\u0007' }], cases: [] },
      { ...c, decisions: [{ id: 'X Y', libelle: 'Mauvais identifiant' }], cases: [] },
      {
        decisions: [
          { id: 'a', libelle: 'Une' },
          { id: 'a', libelle: 'Deux' },
        ],
        cases: [],
      },
      { ...c, note: 'champ inconnu' },
      { decisions: c.decisions },
    ];
    for (const b of cas) {
      const r = await contributeur.put(url(perimetre), b, im(2));
      expect(r.statusCode, JSON.stringify(b).slice(0, 160)).toBe(422);
    }
    // Aux bornes exactes : accepté (60 décisions, au périmètre voisin).
    const juste = await horsPerimetre.put(url(voisin), { decisions: decisions.slice(0, 60), cases: [] }, im(0));
    expect(juste.statusCode, juste.body).toBe(200);
    expect((await enLecture.get(url(perimetre))).json().matrice.version).toBe(2);
  });
  it('la base refuse aussi une forme invalide (contraintes de la migration 108)', async () => {
    const inserer = (decisions: unknown, cases: unknown = []) =>
      t.svc.db.q('INSERT INTO responsabilites_raci(smsi_id, decisions, cases, mise_a_jour_par) VALUES ($1,$2,$3,$4)', [
        COMMUN,
        JSON.stringify(decisions),
        JSON.stringify(cases),
        'test',
      ]);
    await expect(inserer({})).rejects.toThrow();
    await expect(inserer([{ id: 'a', libelle: 'Libellé\u0007fictif' }])).rejects.toThrow();
    await expect(inserer([{ id: 'A', libelle: 'Majuscule' }])).rejects.toThrow();
    await expect(inserer(Array.from({ length: 61 }, (_, i) => ({ id: `a-${i}`, libelle: 'x' })))).rejects.toThrow();
    await expect(inserer([], [{ decision: 'a', role: ref(rssi.id), lettre: 'Z' }])).rejects.toThrow();
    await expect(inserer([], [{ decision: 'a', role: 'legacy:suppliers:SUP-1', lettre: 'R' }])).rejects.toThrow();
    await expect(inserer([], [{ decision: 'a', role: 'object:pas-un-uuid', lettre: 'R' }])).rejects.toThrow();
    await expect(
      t.svc.db.q('INSERT INTO responsabilites_raci(smsi_id, decisions, cases, mise_a_jour_par) VALUES ($1,$2,$3,$4)', [
        '00000000-0000-4000-8000-00000000ffff',
        '[]',
        '[]',
        'test',
      ]),
    ).rejects.toThrow();
    expect(await t.svc.db.one('SELECT 1 FROM responsabilites_raci WHERE smsi_id=$1', [COMMUN])).toBeFalsy();
  });
  it('journalise le périmètre et les nombres de lignes et de colonnes, rien d’autre', async () => {
    expect(await lignesAudit('grc.responsabilites.raci.created')).toEqual([
      {
        target: `responsabilites-raci:${perimetre}`,
        details: { smsiId: perimetre, lignes: 2, colonnes: 2 },
      },
      { target: `responsabilites-raci:${voisin}`, details: { smsiId: voisin, lignes: 60, colonnes: 1 } },
    ]);
    expect(await lignesAudit('grc.responsabilites.raci.updated')).toEqual([
      { target: `responsabilites-raci:${perimetre}`, details: { smsiId: perimetre, lignes: 2, colonnes: 2 } },
    ]);
    const tout = JSON.stringify(
      await t.svc.db.q("SELECT details FROM audit_log WHERE action LIKE 'grc.responsabilites.raci.%'"),
    );
    expect(tout).not.toContain('budget');
    expect(tout).not.toContain('RSSI fictif');
  });
});

describe('rôle retiré du registre', () => {
  it('colonne « Rôle retiré », lettres conservées et ignorées par le contrôle, puis effacées sans retour', async () => {
    const avant = (await enLecture.get(url(perimetre))).json();
    const archive = await admin.del(`/api/grc/${perimetre}/objects/${dsi.id}`, im(dsi.version));
    expect(archive.statusCode, archive.body).toBeLessThan(300);
    const lu = (await enLecture.get(url(perimetre))).json();
    expect(lu.matrice.cases).toEqual(avant.matrice.cases);
    expect(lu.roles).toEqual([
      { ref: ref(rssi.id), libelle: 'RSSI fictif', retire: false },
      { ref: ref(dsi.id), libelle: 'Rôle retiré', retire: true },
    ]);
    // La DSI portait le A de « budget » et le R de « dérogation » : le contrôle ne les compte plus.
    expect(lu.controle.map((c: { decision: string; ecarts: string[] }) => [c.decision, c.ecarts])).toEqual([
      ['budget', ['aucun_a']],
      ['derogation', ['aucun_r']],
    ]);
    // Un rôle archivé reste une référence résolue : aucune anomalie de relation.
    expect(
      (await controleRelations(t.svc)).controles.flatMap((c) => c.anomalies).filter((a) => a.includes('Qui décide')),
    ).toEqual([]);
    // Les lettres du rôle retiré peuvent être gardées à l'enregistrement…
    const garde = await contributeur.put(
      url(perimetre),
      { decisions: lu.matrice.decisions, cases: lu.matrice.cases },
      im(lu.matrice.version),
    );
    expect(garde.statusCode, garde.body).toBe(200);
    // … ou effacées : la colonne disparaît, et le rôle retiré ne peut plus recevoir de lettre.
    const sans = lu.matrice.cases.filter((k: { role: string }) => k.role !== ref(dsi.id));
    const efface = await contributeur.put(
      url(perimetre),
      { decisions: lu.matrice.decisions, cases: sans },
      im(garde.json().matrice.version),
    );
    expect(efface.statusCode, efface.body).toBe(200);
    expect(efface.json().roles).toEqual([{ ref: ref(rssi.id), libelle: 'RSSI fictif', retire: false }]);
    const retour = await contributeur.put(
      url(perimetre),
      { decisions: lu.matrice.decisions, cases: [...sans, { decision: 'budget', role: ref(dsi.id), lettre: 'A' }] },
      im(efface.json().matrice.version),
    );
    expect(retour.statusCode).toBe(422);
  });
  it('une référence qui ne désigne plus aucun rôle est signalée par le contrôle des relations', async () => {
    const fantome = 'object:00000000-0000-4000-8000-00000000dead';
    await t.svc.db.q(`UPDATE responsabilites_raci SET cases = cases || $2::jsonb WHERE smsi_id=$1`, [
      perimetre,
      JSON.stringify([{ decision: 'budget', role: fantome, lettre: 'I' }]),
    ]);
    const lu = (await enLecture.get(url(perimetre))).json();
    expect(lu.roles.at(-1)).toEqual({ ref: fantome, libelle: 'Rôle retiré', retire: true });
    expect((await controleRelations(t.svc)).controles.flatMap((c) => c.anomalies)).toContain(
      `matrice « Qui décide quoi » du périmètre ${perimetre} : rôle introuvable ${fantome}`,
    );
  });
});

describe('périmètre commun', () => {
  it('les rôles de l’outil de suivi sont aussi des colonnes (legacy:roles:<id>), avec les fiches du Pilotage', async () => {
    const natif = await role(COMMUN, 'Comité de direction fictif');
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      await t.svc.legacy.nativeWrite(
        c,
        { ...st.data, roles: [{ id: 'ROL-1', name: 'Responsable historique fictif' }, { name: 'Sans identifiant' }] },
        { username: 'test' } as never,
        st.version,
      );
    }, 'test');
    const lu = (await lecteur.get(url(COMMUN))).json();
    expect(lu.roles).toEqual([
      { ref: ref(natif.id), libelle: 'Comité de direction fictif', retire: false },
      { ref: 'legacy:roles:ROL-1', libelle: 'Responsable historique fictif', retire: false },
    ]);
    const r = await admin.put(
      url(COMMUN),
      {
        decisions: [{ id: 'politique', libelle: 'Approuver la politique fictive' }],
        cases: [
          { decision: 'politique', role: ref(natif.id), lettre: 'A' },
          { decision: 'politique', role: 'legacy:roles:ROL-1', lettre: 'R' },
        ],
      },
      im(0),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().controle[0].ecarts).toEqual([]);
    // Un rôle du périmètre commun n'est pas une colonne d'un autre périmètre.
    const ailleurs = await contributeur.put(
      url(perimetre),
      {
        decisions: [{ id: 'x', libelle: 'Fictive' }],
        cases: [{ decision: 'x', role: 'legacy:roles:ROL-1', lettre: 'R' }],
      },
      im((await enLecture.get(url(perimetre))).json().matrice.version),
    );
    expect(ailleurs.statusCode).toBe(422);
  });
});

describe('remise à vide', () => {
  it('classe la table avec les données de travail, effacée par les deux portées', () => {
    expect(TABLES_TRAVAIL).toContain('responsabilites_raci');
    expect(tablesAVider('travail')).toContain('responsabilites_raci');
    expect(tablesAVider('tout')).toContain('responsabilites_raci');
  });
});
