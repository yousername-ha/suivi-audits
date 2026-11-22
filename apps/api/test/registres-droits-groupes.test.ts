/* Droits groupés des registres (PERF-06, PERF-11) : la liste des registres et « Ce que je dois alimenter » calculent les
   droits de toute la page en quelques requêtes. Ce test vérifie, sur un jeu fictif varié (périmètres parent et enfant,
   registres multi-périmètres, restreints, archivés, attribués à une personne, à un groupe ou à une fonction, rôles attribués
   sur un registre ou sur un élément, créateurs d'éléments), que le chemin groupé rend exactement ce que rend le chemin
   unitaire (`peut` puis `dto`, registre par registre ; `peut` élément par élément), dans le même ordre, pour des comptes de
   profils différents ; puis que le nombre de requêtes ne dépend pas du nombre de registres ni d'éléments. Données
   entièrement fictives. */
import { GRC_MODULES, type RegistreKind } from '@suivi/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../src/auth.js';
import { DEFAULT_SMSI, objets, versObjet } from '../src/grc/core.js';
import { createTestApp, login, makeUser, sessionUser, type TestApp, type TestUser } from './helpers.js';

type Filtre = { perimetre?: string; kind?: RegistreKind; archives?: boolean };

/** Ancien chemin de la liste : `peut` puis `dto`, registre par registre. */
const listeUnitaire = async (t: TestApp, user: SessionUser, filtre: Filtre) => {
  const r = t.svc.grc.registres;
  const out = [];
  for (const reg of await r.lignesListe(filtre))
    if (await r.peut(user, reg, null, 'lire')) out.push(await r.dto(user, reg));
  return out;
};
/** Ancien chemin de « Ce que je dois alimenter » : relecture et `peut`, élément par élément. */
const mesElementsUnitaire = async (t: TestApp, user: SessionUser, search: string, offset: number) => {
  const r = t.svc.grc.registres;
  const rows = await r.lignesMesElements(user, search, offset);
  const items = [];
  for (const { id, rId, rName, rKind } of rows.slice(0, 50)) {
    const ligne = await objets(t.svc.db.k).where('id', '=', id).executeTakeFirst();
    const reg = await r.brut(rId);
    if (!ligne || !reg) continue;
    const el = versObjet(ligne);
    const module = GRC_MODULES[el.kind];
    try {
      if (!(await r.peut(user, reg, el.id, 'lire', undefined, module))) continue;
      items.push({
        element: el,
        registre: { id: rId, name: rName, kind: rKind as RegistreKind },
        peut: {
          contribuer: await r.peut(user, reg, el.id, 'contribuer', undefined, module),
          gerer: await r.peut(user, reg, el.id, 'gerer', undefined, module),
        },
      });
    } catch {
      /* module désactivé */
    }
  }
  return { items, nextOffset: rows.length > 50 ? offset + 50 : null };
};

describe('registres : droits groupés équivalents au chemin unitaire', () => {
  let t: TestApp;
  const comptes: Record<string, SessionUser> = {};
  const p: Record<string, string> = {};
  let groupe: string, fonction: string, fonctionArchivee: string;
  let filtres: Filtre[];

  const q = (sql: string, params: unknown[] = []) => t.svc.db.q(sql, params);
  const one = async (sql: string, params: unknown[] = []) => (await t.svc.db.one<{ id: string }>(sql, params))!.id;
  const membre = (smsi: string, u: TestUser, ecriture: boolean) =>
    q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [
      smsi,
      u.id,
      ecriture,
    ]);
  const registre = async (o: {
    kind: RegistreKind;
    name: string;
    ref: string;
    autres?: string[];
    restreint?: boolean;
    archive?: boolean;
    responsable?: { type: string; id: string } | null;
  }) => {
    const id = await one(
      `INSERT INTO registres(kind, name, reference_smsi_id, restricted, archived, responsable, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,'test','test') RETURNING id`,
      [o.kind, o.name, o.ref, !!o.restreint, !!o.archive, o.responsable ? JSON.stringify(o.responsable) : null],
    );
    for (const s of new Set([o.ref, ...(o.autres ?? [])]))
      await q('INSERT INTO registre_perimetres(registre_id, smsi_id) VALUES ($1,$2)', [id, s]);
    return id;
  };
  const element = (o: {
    registre: string;
    smsi: string;
    kind?: 'action' | 'nonconformity' | 'task_series';
    name: string;
    data?: Record<string, unknown>;
    createur?: string;
    archive?: boolean;
  }) => {
    const kind = o.kind ?? 'action';
    return one(
      `INSERT INTO grc_objects(smsi_id, kind, module, name, data, created_by, updated_by, registre_id, archived)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING id`,
      [
        o.smsi,
        kind,
        GRC_MODULES[kind],
        o.name,
        JSON.stringify(o.data ?? {}),
        o.createur ?? 'test',
        o.registre,
        !!o.archive,
      ],
    );
  };
  const droit = (type: 'registre' | 'objet', id: string, sujet: 'utilisateur' | 'groupe', sid: string, role: string) =>
    q(
      `INSERT INTO droits_ressources(resource_type, resource_id, subject_type, subject_id, role, granted_by)
       VALUES ($1,$2,$3,$4,$5,'recette')`,
      [type, id, sujet, sid, role],
    );

  const identiques = (groupe: unknown, unitaire: unknown) => {
    expect(groupe).toStrictEqual(unitaire);
    // Même ordre des clés : la réponse sérialisée est la même au caractère près.
    expect(JSON.stringify(groupe)).toBe(JSON.stringify(unitaire));
  };

  beforeAll(async () => {
    t = await createTestApp();
    const adm = await makeUser(t, 'eq_admin', 'admin');
    const admin = await login(t, adm);
    const smsi = async (name: string, parentId?: string) => {
      const r = await admin.post('/api/grc/smsis', { name, scope: name, timezone: 'Europe/Paris', parentId });
      expect(r.statusCode, r.body).toBe(200);
      return r.json().id as string;
    };
    p.P = await smsi('Périmètre EQ-P');
    p.P1 = await smsi('Périmètre EQ-P1', p.P);
    p.Q = await smsi('Périmètre EQ-Q');
    p.R = await smsi('Périmètre EQ-R');
    // Deux périmètres de même nom : l'ordre des périmètres nommés d'un registre départage par identifiant.
    p.S = await smsi('Périmètre EQ-Q');
    p.C = DEFAULT_SMSI;

    const u = {
      adm,
      // Administrateur limité à un module : n'est pas administrateur au sens de isAdmin.
      admMod: await makeUser(t, 'eq_admmod', 'admin', { modules: ['ecarts'] }),
      rssi: await makeUser(t, 'eq_rssi', 'rssi', { rattache: false }),
      contrib: await makeUser(t, 'eq_contrib', 'rw', { rattache: false }),
      lect: await makeUser(t, 'eq_lect', 'ro'),
      audit: await makeUser(t, 'eq_audit', 'auditeur_externe', { rattache: false }),
      sans: await makeUser(t, 'eq_sans', null, { rattache: false }),
      attr: await makeUser(t, 'eq_attr', null, { rattache: false }),
      attrRw: await makeUser(t, 'eq_attrrw', 'rw', { rattache: false }),
    };
    await membre(p.P, u.rssi, true);
    await membre(p.P1, u.contrib, true);
    await membre(p.Q, u.contrib, false);
    await membre(p.Q, u.lect, false);
    await membre(p.S, u.lect, true);
    await membre(p.P, u.audit, false);
    await membre(p.R, u.attrRw, true);

    groupe = await one("INSERT INTO groups(name) VALUES ('Groupe EQ') RETURNING id");
    for (const m of [u.attr, u.contrib])
      await q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [m.id, groupe]);
    fonction = await one(
      "INSERT INTO fonctions(name, created_by, updated_by) VALUES ('Fonction EQ', 'test', 'test') RETURNING id",
    );
    fonctionArchivee = await one(
      "INSERT INTO fonctions(name, archived, created_by, updated_by) VALUES ('Fonction EQ ancienne', true, 'test', 'test') RETURNING id",
    );
    for (const m of [u.attr, u.lect])
      await q('INSERT INTO fonction_membres(fonction_id, user_id) VALUES ($1,$2)', [fonction, m.id]);
    await q('INSERT INTO fonction_membres(fonction_id, user_id) VALUES ($1,$2)', [fonctionArchivee, u.rssi.id]);

    const r = {
      planP: await registre({ kind: 'plan_actions', name: 'Plan EQ', ref: p.P }),
      planQ: await registre({ kind: 'plan_actions', name: 'Plan EQ', ref: p.Q }),
      ecartsP1: await registre({ kind: 'ecarts', name: 'Écarts EQ P1', ref: p.P1 }),
      ecartsPQ: await registre({ kind: 'ecarts', name: 'Écarts EQ P+Q', ref: p.P, autres: [p.Q, p.S] }),
      ecartsP1R: await registre({ kind: 'ecarts', name: 'Écarts EQ P1+R', ref: p.P1, autres: [p.R] }),
      restreintP: await registre({ kind: 'ecarts', name: 'Restreint EQ P', ref: p.P, restreint: true }),
      restreintQ: await registre({ kind: 'ecarts', name: 'Restreint EQ Q', ref: p.Q, restreint: true }),
      restreintR: await registre({
        kind: 'plan_actions',
        name: 'Restreint EQ R',
        ref: p.R,
        restreint: true,
        responsable: { type: 'utilisateur', id: u.rssi.id },
      }),
      archiveP: await registre({ kind: 'ecarts', name: 'Archivé EQ P', ref: p.P, archive: true }),
      archiveR: await registre({
        kind: 'recurrences',
        name: 'Archivé EQ R',
        ref: p.R,
        archive: true,
        restreint: true,
        responsable: { type: 'groupe', id: groupe },
      }),
      fonctionR: await registre({
        kind: 'plan_actions',
        name: 'Attribué EQ fonction',
        ref: p.R,
        responsable: { type: 'fonction', id: fonction },
      }),
      fonctionQ: await registre({
        kind: 'ecarts',
        name: 'Attribué EQ fonction archivée',
        ref: p.Q,
        responsable: { type: 'fonction', id: fonctionArchivee },
      }),
      personneC: await registre({
        kind: 'recurrences',
        name: 'Attribué EQ personne',
        ref: p.C,
        responsable: { type: 'utilisateur', id: u.attr.id },
      }),
      multiC: await registre({ kind: 'plan_actions', name: 'Multi EQ commun', ref: p.C, autres: [p.P1, p.Q] }),
      restreintGroupe: await registre({
        kind: 'ecarts',
        name: 'Restreint EQ attribué au groupe',
        ref: p.P1,
        restreint: true,
        responsable: { type: 'groupe', id: groupe },
      }),
    };
    // Rôles attribués sur des registres : en personne, par un groupe, donné à soi-même, sur un registre archivé.
    await droit('registre', r.restreintP, 'utilisateur', u.contrib.id, 'lecteur');
    await droit('registre', r.restreintQ, 'groupe', groupe, 'contributeur');
    await droit('registre', r.restreintR, 'utilisateur', u.attr.id, 'gestionnaire');
    await droit('registre', r.archiveP, 'utilisateur', u.rssi.id, 'gestionnaire');
    await droit('registre', r.planQ, 'utilisateur', u.lect.id, 'gestionnaire');
    await droit('registre', r.planQ, 'groupe', groupe, 'lecteur');
    await droit('registre', r.ecartsP1R, 'utilisateur', u.audit.id, 'contributeur');

    // Éléments : actions terminées ou non, écarts, séries ; attribués en personne (ownerId ou responsable), par un groupe
    // ou par une fonction ; créés par le compte ; archivés ; rôles sur un élément.
    const jour = (n: number) => `2026-12-${String(n).padStart(2, '0')}T09:00:00Z`;
    let n = 0;
    const el = (registreId: string, smsiId: string, o: Partial<Parameters<typeof element>[0]> = {}) =>
      element({ registre: registreId, smsi: smsiId, name: `Élément EQ ${++n}`, ...o });
    await el(r.planP, p.P, { data: { status: 'done', dueAt: jour(1) } });
    await el(r.planP, p.P, { data: { status: 'todo', dueAt: jour(2), ownerId: u.attr.id } });
    await el(r.planP, p.P, { data: { status: 'done' }, archive: true });
    await el(r.planP, p.P, { kind: 'nonconformity', data: { status: 'open' } });
    await el(r.ecartsP1, p.P1, {
      data: { status: 'todo', dueAt: jour(3), ownerId: u.attr.id },
      createur: 'eq_attr',
    });
    await el(r.ecartsP1, p.P1, {
      kind: 'nonconformity',
      data: { dueAt: jour(4), responsable: { type: 'groupe', id: groupe } },
    });
    const surElement = await el(r.restreintP, p.P, { data: { status: 'todo', dueAt: jour(5) } });
    await droit('objet', surElement, 'utilisateur', u.lect.id, 'gestionnaire');
    await el(r.restreintP, p.P, { data: { status: 'todo', dueAt: jour(6), ownerId: u.contrib.id } });
    await el(r.restreintQ, p.Q, {
      kind: 'nonconformity',
      data: { dueAt: jour(7), responsable: { type: 'fonction', id: fonction } },
    });
    await el(r.fonctionR, p.R, { data: { status: 'done', dueAt: jour(8) }, createur: 'eq_lect' });
    await el(r.fonctionR, p.R, { data: { status: 'todo', dueAt: jour(8) }, createur: 'eq_attr' });
    await el(r.archiveP, p.P, { data: { status: 'todo', dueAt: jour(9), ownerId: u.attr.id } });
    await el(r.personneC, p.C, { kind: 'task_series', data: { dueAt: jour(10) } });
    await el(r.personneC, p.C, { data: { ownerId: u.attr.id }, archive: true });
    const lecteurElement = await el(r.ecartsP1R, p.P1, { data: { status: 'todo', ownerId: u.rssi.id } });
    await droit('objet', lecteurElement, 'utilisateur', u.attr.id, 'lecteur');
    const contribElement = await el(r.ecartsPQ, p.P, { data: { status: 'todo', dueAt: jour(11) } });
    await droit('objet', contribElement, 'groupe', groupe, 'contributeur');
    await el(r.multiC, p.C, { data: { status: 'todo', dueAt: jour(12) }, createur: 'eq_contrib' });
    await el(r.multiC, p.C, {
      data: { status: 'todo', dueAt: jour(12), responsable: { type: 'utilisateur', id: u.contrib.id } },
      createur: 'eq_contrib',
    });
    await el(r.restreintGroupe, p.P1, { data: { status: 'todo', dueAt: jour(13) }, createur: 'eq_attr' });
    await el(r.restreintR, p.R, { data: { status: 'todo', dueAt: jour(14), ownerId: u.rssi.id } });
    await el(r.fonctionQ, p.Q, { kind: 'nonconformity', data: { dueAt: jour(15), ownerId: u.attrRw.id } });

    for (const [nom, compte] of Object.entries(u)) comptes[nom] = await sessionUser(t, compte);
    filtres = [
      {},
      { archives: true },
      { kind: 'ecarts' },
      { kind: 'plan_actions', archives: true },
      { kind: 'recurrences', archives: true },
      { perimetre: p.P },
      { perimetre: p.Q, archives: true },
      { perimetre: p.P1 },
      { perimetre: p.R, kind: 'plan_actions', archives: true },
      { perimetre: p.C },
      { perimetre: p.S },
    ];
  });
  afterAll(async () => t.close());

  it('liste : même contenu et même ordre que peut puis dto, pour chaque compte et chaque filtre', async () => {
    const r = t.svc.grc.registres;
    const vus = new Map<string, number>();
    for (const [nom, user] of Object.entries(comptes))
      for (const filtre of filtres) {
        const groupe = await r.list(user, filtre);
        identiques(groupe, await listeUnitaire(t, user, filtre));
        if (!filtre.perimetre && !filtre.kind && filtre.archives) vus.set(nom, groupe.length);
      }
    // Le jeu discrimine bien : profils aux visibilités différentes, personne sans droit qui ne voit rien.
    expect(vus.get('sans')).toBe(0);
    expect(vus.get('adm')).toBeGreaterThan(vus.get('rssi')!);
    expect(new Set(vus.values()).size).toBeGreaterThanOrEqual(5);
    // Des rôles et des droits variés apparaissent (sinon l'équivalence ne prouverait pas grand-chose).
    const tout = (await Promise.all(Object.values(comptes).map((c) => r.list(c, { archives: true })))).flat();
    expect(new Set(tout.map((x) => x.role))).toEqual(new Set([null, 'lecteur', 'contributeur', 'gestionnaire']));
    expect(tout.some((x) => x.autresPerimetres > 0)).toBe(true);
    expect(tout.some((x) => x.peutCreer && !x.peut.gerer)).toBe(true);
    expect(tout.some((x) => x.peut.lire && !x.peut.contribuer)).toBe(true);
    expect(tout.some((x) => x.peutAttribuer !== x.peut.gerer)).toBe(true);
    expect(tout.some((x) => x.avancement.terminees > 0)).toBe(true);
  });

  it('« Ce que je dois alimenter » : mêmes éléments, mêmes droits, même ordre que peut élément par élément', async () => {
    const r = t.svc.grc.registres;
    let vus = 0;
    for (const user of Object.values(comptes))
      for (const [search, offset] of [
        ['', 0],
        ['', 1],
        ['EQ 1', 0],
        ['introuvable', 0],
      ] as const) {
        const groupe = await r.mesElements(user, search, offset);
        identiques(groupe, await mesElementsUnitaire(t, user, search, offset));
        vus += groupe.items.length;
      }
    expect(vus).toBeGreaterThan(10);
    const attr = await r.mesElements(comptes.attr!, '', 0);
    expect(new Set(attr.items.map((i) => `${i.peut.contribuer}/${i.peut.gerer}`)).size).toBeGreaterThan(1);
  });

  it('module des écarts désactivé : mêmes refus et mêmes omissions sur les deux chemins', async () => {
    const r = t.svc.grc.registres;
    await q("UPDATE module_activation SET disabled=ARRAY['ecarts'], version=version+1 WHERE id=1");
    try {
      for (const user of [comptes.adm!, comptes.rssi!, comptes.attr!]) {
        await expect(r.list(user)).rejects.toMatchObject({ status: 409 });
        await expect(listeUnitaire(t, user, {})).rejects.toMatchObject({ status: 409 });
        const groupe = await r.mesElements(user, '', 0);
        identiques(groupe, await mesElementsUnitaire(t, user, '', 0));
        expect(groupe.items).toEqual([]);
      }
      // Aucun registre : aucune vérification de module, liste vide sur les deux chemins.
      identiques(await r.list(comptes.rssi!, { perimetre: p.S, kind: 'recurrences' }), []);
      identiques(await listeUnitaire(t, comptes.rssi!, { perimetre: p.S, kind: 'recurrences' }), []);
    } finally {
      await q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
    }
  });
});

describe('registres : nombre de requêtes indépendant du nombre de registres et d’éléments', () => {
  let t: TestApp;
  let user: SessionUser;
  let compte: TestUser;
  let perim: string, groupe: string, autre: string;
  let n = 0;

  /** Registres du périmètre dédié, avec deux éléments chacun : un attribué au compte, un rôle sur un sur trois. */
  const ajouter = async (combien: number, u: TestUser) => {
    for (let i = 0; i < combien; i++) {
      n++;
      const reg = (await t.svc.db.one<{ id: string }>(
        `INSERT INTO registres(kind, name, reference_smsi_id, restricted, responsable, created_by, updated_by)
         VALUES ('plan_actions', $1, $2, $3, $4, 'test', 'test') RETURNING id`,
        [
          `Registre compté ${String(n).padStart(3, '0')}`,
          perim,
          n % 4 === 0,
          n % 2 ? JSON.stringify({ type: 'groupe', id: groupe }) : null,
        ],
      ))!.id;
      for (const s of n % 3 ? [perim] : [perim, autre])
        await t.svc.db.q('INSERT INTO registre_perimetres(registre_id, smsi_id) VALUES ($1,$2)', [reg, s]);
      if (n % 3 === 0)
        await t.svc.db.q(
          `INSERT INTO droits_ressources(resource_type, resource_id, subject_type, subject_id, role, granted_by)
           VALUES ('registre', $1, 'utilisateur', $2, 'lecteur', 'recette')`,
          [reg, u.id],
        );
      for (const [statut, owner] of [
        ['done', u.id],
        ['todo', null],
      ])
        await t.svc.db.q(
          `INSERT INTO grc_objects(smsi_id, kind, module, name, data, created_by, updated_by, registre_id)
           VALUES ($1, 'action', 'ecarts', $2, $3, 'test', 'test', $4)`,
          [
            perim,
            `Action comptée ${n}-${statut}`,
            JSON.stringify({ status: statut, ownerId: owner, dueAt: `2026-12-0${(n % 9) + 1}T09:00:00Z` }),
            reg,
          ],
        );
    }
  };
  const compter = async (fn: () => Promise<unknown>) => {
    const espion = vi.spyOn(pg.Client.prototype, 'query');
    try {
      await fn();
      return espion.mock.calls.length;
    } finally {
      espion.mockRestore();
    }
  };

  beforeAll(async () => {
    t = await createTestApp();
    const admin = await login(t, await makeUser(t, 'cq_admin', 'admin'));
    const smsi = async (name: string) =>
      (await admin.post('/api/grc/smsis', { name, scope: name, timezone: 'Europe/Paris' })).json().id as string;
    perim = await smsi('Périmètre compté');
    autre = await smsi('Périmètre compté voisin');
    const u = await makeUser(t, 'cq_pilote', 'rw', { rattache: false });
    await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1,$2,true)', [perim, u.id]);
    groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Groupe compté') RETURNING id"))!.id;
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [u.id, groupe]);
    compte = u;
    user = await sessionUser(t, u);
    await ajouter(5, u);
  });
  afterAll(async () => t.close());

  it('liste des registres et « mes éléments » : même nombre de requêtes pour 5 puis 50 registres', async () => {
    const r = t.svc.grc.registres;
    const liste = () => r.list(user, { perimetre: perim });
    const mes = () => r.mesElements(user, 'Action comptée', 0);
    // Échauffement (cache des modules et des requêtes préparées) puis comptage.
    await liste();
    // Un registre sur quatre est restreint ; lisible seulement par un rôle attribué (un sur trois) : n° 4 masqué.
    expect(await liste()).toHaveLength(4);
    const liste5 = await compter(liste);
    const ancienne5 = await compter(() => listeUnitaire(t, user, { perimetre: perim }));
    const mes5 = await compter(mes);
    const ancienneMes5 = await compter(() => mesElementsUnitaire(t, user, 'Action comptée', 0));
    expect((await mes()).items.length).toBeGreaterThan(0);

    await ajouter(45, compte);
    // Masqués : n° 4, 8, 16, 20, 28, 32, 40, 44.
    expect(await liste()).toHaveLength(42);
    const liste50 = await compter(liste);
    const ancienne50 = await compter(() => listeUnitaire(t, user, { perimetre: perim }));
    const mes50 = await compter(mes);
    const ancienneMes50 = await compter(() => mesElementsUnitaire(t, user, 'Action comptée', 0));
    expect((await mes()).items).toHaveLength(50);

    // L'espion voit les requêtes (sinon les bornes ne prouveraient rien), et l'ancien chemin croît avec les registres.
    expect(liste5).toBeGreaterThan(3);
    expect(ancienne50).toBeGreaterThan(ancienne5 * 5);
    expect(liste50).toBe(liste5);
    expect(liste50).toBeLessThanOrEqual(10);
    expect(ancienneMes50).toBeGreaterThan(ancienneMes5);
    expect(mes50).toBe(mes5);
    expect(mes50).toBeLessThanOrEqual(12);
  });
});
