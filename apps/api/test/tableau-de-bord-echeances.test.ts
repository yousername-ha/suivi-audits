/* Échéances de la synthèse du mur (PERF-15) : la requête lit les clés utiles de `data` d'un seul décodage par ligne, alors
   que `data` porte les tâches des actions (souvent hors ligne et compressé). Ce test compare, sur un jeu fictif d'actions
   à tâches et d'écarts aux données variées (échéances valides, incomplètes ou absentes, statuts terminaux ou non, séries,
   responsables connus ou non, données qui ne sont pas un objet, registre restreint, registre partagé), les échéances rendues
   par la synthèse à celles que rend la requête d'origine, recopiée ici : même contenu, même ordre. Données fictives. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '../src/auth.js';
import { PorteeLecture } from '../src/acces/portee.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { tableauDeBordNatif } from '../src/tableau-de-bord.js';
import { createTestApp, login, makeUser, sessionUser, type TestApp } from './helpers.js';

/** Requête d'origine (avant PERF-15), avec son fragment de portée. */
const DANS_LA_PORTEE = `NOT o.archived
  AND (o.smsi_id=ANY($1::uuid[]) OR o.registre_id IN (SELECT registre_id FROM registre_perimetres WHERE smsi_id=ANY($1::uuid[])))
  AND (o.registre_id IS NULL OR NOT (o.registre_id=ANY($2::uuid[])))`;
const ORIGINE = `SELECT o.id, o.kind, o.name, left(o.data->>'dueAt',10) due, COALESCE(o.data->>'status','open') st,
              sm.name perimetre, u.display_name pilote
         FROM grc_objects o
         JOIN grc_smsis sm ON sm.id=o.smsi_id
         JOIN business_policy_versions v ON v.version=sm.business_version
         LEFT JOIN users u ON u.id::text=o.data->>'ownerId'
        WHERE ${DANS_LA_PORTEE}
          AND ((o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed')
            OR (o.kind='action' AND o.data->>'seriesId' IS NULL
                AND NOT (COALESCE(o.data->>'status','')=ANY(
                  SELECT st->>'id' FROM jsonb_array_elements(v.definition->'statuses') st WHERE st->>'terminal'='true'))))
          AND left(o.data->>'dueAt',10) ~ '^\\d{4}-\\d{2}-\\d{2}$' AND left(o.data->>'dueAt',10) <= $3
        ORDER BY left(o.data->>'dueAt',10), o.name LIMIT 12`;
const LIBELLE_STATUT: Record<string, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  progress: 'Actions en cours',
  effectiveness: 'À vérifier',
  closed: 'Clos',
};

describe('synthèse du mur : échéances identiques avec des actions à tâches', () => {
  let t: TestApp;
  let admin: SessionUser, membre: SessionUser;
  let n = 0;
  const AUJOURDHUI = new Date('2026-12-15T10:00:00Z');

  const inserer = (smsi: string, kind: 'action' | 'nonconformity', data: unknown, registre: string | null = null) =>
    t.svc.db.q(
      `INSERT INTO grc_objects(smsi_id, kind, module, name, data, created_by, updated_by, registre_id)
       VALUES ($1, $2, 'ecarts', $3, $4, 'test', 'test', $5)`,
      [smsi, kind, `Échéance fictive ${String(++n).padStart(3, '0')}`, JSON.stringify(data), registre],
    );
  /** Tâches fictives peu compressibles : la donnée dépasse la taille d'une ligne et part hors ligne. */
  const taches = (combien: number) =>
    Array.from({ length: combien }, (_, i) => ({
      id: randomUUID(),
      intitule: `Tâche ${i} ${randomUUID()} ${randomUUID()} ${randomUUID()}`,
      faite: i % 3 === 0,
    }));

  const reference = async (user: SessionUser | null, jours: number) => {
    const { ids, masques } = user
      ? {
          ids: [...(await PorteeLecture.pour(t.svc.grc, user).perimetresLisibles())],
          masques: [...(await PorteeLecture.pour(t.svc.grc, user).registresMasques())],
        }
      : {
          ids: [DEFAULT_SMSI],
          masques: (await t.svc.db.q<{ id: string }>('SELECT id FROM registres WHERE restricted')).rows.map(
            (r) => r.id,
          ),
        };
    const jour = AUJOURDHUI.toISOString().slice(0, 10);
    const horizon = new Date(AUJOURDHUI.getTime() + jours * 86400e3).toISOString().slice(0, 10);
    const r = await t.svc.db.q<{
      id: string;
      kind: string;
      name: string;
      due: string;
      st: string;
      perimetre: string;
      pilote: string | null;
    }>(ORIGINE, [ids, masques, horizon]);
    return r.rows.map((x) => ({
      id: 'object:' + x.id,
      texte: x.name,
      echeance: x.due,
      pilote: x.pilote ?? '',
      statut: LIBELLE_STATUT[x.st] ?? x.st,
      enRetard: x.due < jour,
      type: x.kind === 'action' ? 'Action' : 'Écart',
      perimetre: x.perimetre,
    }));
  };
  const synthese = async (user: SessionUser | null, rights: SessionUser['rights'], jours: number) =>
    (await tableauDeBordNatif(t.svc.grc, rights, user, { aujourdHui: AUJOURDHUI, joursEcheance: jours })).echeances;

  beforeAll(async () => {
    t = await createTestApp();
    const a = await makeUser(t, 'ech_admin', 'admin');
    const ag = await login(t, a);
    const m = await makeUser(t, 'ech_membre', 'ro', { rattache: false });
    const smsi = async (name: string) =>
      (await ag.post('/api/grc/smsis', { name, scope: name, timezone: 'Europe/Paris' })).json().id as string;
    const A = await smsi('Périmètre échéances A');
    const B = await smsi('Périmètre échéances B');
    await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1,$2,false)', [A, m.id]);
    const registre = async (ref: string, restreint: boolean, autres: string[] = []) => {
      const id = (await t.svc.db.one<{ id: string }>(
        `INSERT INTO registres(kind, name, reference_smsi_id, restricted, created_by, updated_by)
         VALUES ('plan_actions', $1, $2, $3, 'test', 'test') RETURNING id`,
        [`Plan échéances ${randomUUID().slice(0, 8)}`, ref, restreint],
      ))!.id;
      for (const s of [ref, ...autres])
        await t.svc.db.q('INSERT INTO registre_perimetres(registre_id, smsi_id) VALUES ($1,$2)', [id, s]);
      return id;
    };
    const restreint = await registre(A, true);
    const partage = await registre(B, false, [A]);
    const commun = await registre(DEFAULT_SMSI, false);

    const jour = (d: number) => new Date(AUJOURDHUI.getTime() + d * 86400e3).toISOString().slice(0, 10);
    const statuts = ['todo', 'in_progress', 'done', 'cancelled', 'blocked', undefined];
    const responsables = [a.id, m.id, randomUUID(), 'pas-un-identifiant', 42, null, undefined];
    // Actions à tâches (jusqu'à 50), réparties dans les périmètres et les registres.
    for (let i = 0; i < 60; i++) {
      // Sans registre : un des trois périmètres ; dans un registre : son périmètre de référence.
      const [smsiId, reg] = (
        [
          [[A, B, DEFAULT_SMSI][i % 3]!, null],
          [A, restreint],
          [B, partage],
          [DEFAULT_SMSI, commun],
        ] as const
      )[i % 4]!;
      await inserer(
        smsiId,
        'action',
        {
          status: statuts[i % statuts.length],
          dueAt: i % 11 === 0 ? null : `${jour((i % 40) - 15)}T09:00:00Z`,
          ownerId: responsables[i % responsables.length],
          ...(i % 13 === 0 ? { seriesId: randomUUID() } : {}),
          taches: taches(10 + (i % 41)),
        },
        reg,
      );
    }
    // Écarts : chaque statut avec chaque forme d’échéance (valide, incomplète, non textuelle, absente).
    const echeancesEcarts = [jour(-3), jour(2), `${jour(5)}T08:00:00Z`, 'bientôt', '2026-1-5', 20261220, null];
    for (let i = 0; i < 49; i++)
      await inserer([A, B, DEFAULT_SMSI][i % 3]!, 'nonconformity', {
        status: ['open', 'progress', 'effectiveness', 'closed', 'draft', undefined, 'inconnu'][Math.floor(i / 7)],
        dueAt: echeancesEcarts[i % echeancesEcarts.length],
        ownerId: responsables[(i + 2) % responsables.length],
      });
    // Actions dont la donnée n'est pas un objet : `o.data->>'clé'` y rend null ; la requête ne doit ni échouer ni les
    // retenir. (Un écart ainsi formé ferait échouer la relecture de l'état historique, hors de cette requête.)
    for (const data of [[1, 2], 'texte', 7]) await inserer(A, 'action', data);

    admin = await sessionUser(t, a);
    membre = await sessionUser(t, m);
  });
  afterAll(async () => t.close());

  it('le jeu met bien des tâches hors ligne', async () => {
    const r = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int n FROM grc_objects WHERE kind='action' AND pg_column_size(data) > 2000",
    );
    expect(r!.n).toBeGreaterThan(30);
  });

  it('mêmes échéances, même ordre, pour chaque lecteur et chaque horizon, sur tout le jeu', async () => {
    const vues: Awaited<ReturnType<typeof reference>> = [];
    // Seules les douze premières échéances sortent : on archive celles déjà comparées, tour après tour, pour que la
    // comparaison parcoure tout le jeu (l'archivage vaut pour les deux requêtes).
    for (let tour = 0; tour < 20; tour++) {
      for (const jours of [0, 3, 10, 30, 3650])
        for (const [user, rights] of [
          [admin, admin.rights],
          [membre, membre.rights],
          [null, admin.rights],
        ] as const) {
          const attendu = await reference(user, jours);
          expect(await synthese(user, rights, jours)).toStrictEqual(attendu);
          vues.push(...attendu);
        }
      const vus = (await reference(admin, 3650)).map((e) => e.id.slice('object:'.length));
      if (!vus.length) break;
      await t.svc.db.q('UPDATE grc_objects SET archived=true WHERE id=ANY($1::uuid[])', [vus]);
    }
    expect((await reference(admin, 3650)).length).toBe(0);
    // Le jeu discrimine : des échéances en retard et à venir, avec et sans pilote, actions et écarts.
    expect(new Set(vues.map((e) => e.id)).size).toBeGreaterThan(40);
    expect(new Set(vues.map((e) => e.enRetard)).size).toBe(2);
    expect(new Set(vues.map((e) => e.pilote !== '')).size).toBe(2);
    expect(new Set(vues.map((e) => e.type)).size).toBe(2);
    expect(new Set(vues.map((e) => e.statut)).size).toBeGreaterThan(3);
  });
});
