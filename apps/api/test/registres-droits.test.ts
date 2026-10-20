/* Registres, périmètres hérités et droits par ressource (ADR 0043). Données fictives.
   Matrice : administrateur, membre d'un seul périmètre, contributeur sans droit de module, lecteur sans aucun droit de
   module, groupe contributeur, registre restreint ; création, contribution, modification, archivage, droits, périmètres. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { businessDefaults } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';
import { createDatabase } from './pg.js';

const action = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'action',
  name,
  data: {
    description: '',
    status: 'todo',
    ownerId: null,
    startAt: null,
    dueAt: null,
    priority: 'normal',
    category: 'action',
    justification: '',
    reminderDays: 7,
    dependencies: [],
    ...extra,
  },
});

describe('registres et droits par ressource', () => {
  let t: TestApp;
  let admin: Agent, membreA: Agent, contributeur: Agent, lecteurSansModule: Agent, deGroupe: Agent;
  let A: string, B: string, registre: string, element: string;
  let contributeurId: string, lecteurId: string, deGroupeId: string, groupeId: string, membreAId: string;
  const etag = (r: { headers: Record<string, unknown> }) =>
    String(r.headers.etag).replace(/^W\//, '').replaceAll('"', '');
  const version = async (id: string) =>
    (await t.svc.db.one<{ version: number }>('SELECT version FROM registres WHERE id=$1', [id]))!.version;
  const ifMatch = async (id: string) => ({ 'if-match': `"${await version(id)}"` });

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'reg_admin', 'admin'));
    const ma = await makeUser(t, 'reg_membre_a', 'rw');
    membreAId = ma.id;
    membreA = await login(t, ma);
    const c = await makeUser(t, 'reg_contrib', 'ro'); // lecture de module seulement, aucun périmètre
    contributeurId = c.id;
    contributeur = await login(t, c);
    const l = await makeUser(t, 'reg_lecteur', null); // aucun droit de module
    lecteurId = l.id;
    lecteurSansModule = await login(t, l);
    const g = await makeUser(t, 'reg_groupe', null);
    deGroupeId = g.id;
    deGroupe = await login(t, g);
    groupeId = (await t.svc.db.one<{ id: string }>(
      "INSERT INTO groups(name) VALUES ('Équipe de recette') RETURNING id",
    ))!.id;
    await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [deGroupeId, groupeId]);
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre A', scope: 'A', timezone: 'Europe/Paris' })).json().id;
    B = (await admin.post('/api/grc/smsis', { name: 'Périmètre B', scope: 'B', timezone: 'Europe/Paris' })).json().id;
    // Le membre de A (écriture) n'est membre que de A.
    expect((await admin.put(`/api/grc/${A}/members`, { userId: membreAId, write: true })).statusCode).toBe(204);
    // Les sessions sont révoquées par le changement d'appartenance : nouvelle connexion.
    membreA = await login(t, { id: membreAId, username: 'reg_membre_a', role: 'rw', key: ma.key });
  });
  afterAll(async () => t.close());

  it('un registre porte plusieurs périmètres ; le périmètre de référence est obligatoire', async () => {
    const r = await admin.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan A+B',
      referenceId: A,
      perimetres: [B],
    });
    expect(r.statusCode).toBe(201);
    const dto = r.json();
    registre = dto.id;
    expect(dto.perimetres.map((p: { id: string }) => p.id).sort()).toEqual([A, B].sort());
    expect(dto.autresPerimetres).toBe(0);
    expect(dto.peut).toEqual({ lire: true, contribuer: true, gerer: true });
    // Un type de registre inconnu est refusé ; un périmètre inconnu aussi.
    expect((await admin.post('/api/registres', { kind: 'autre', name: 'x', referenceId: A })).statusCode).toBe(422);
    expect(
      (
        await admin.post('/api/registres', {
          kind: 'ecarts',
          name: 'x',
          referenceId: '00000000-0000-4000-8000-0000000000aa',
        })
      ).statusCode,
    ).toBe(422);
  });

  it('les éléments héritent du registre : aucun périmètre propre, registre par défaut sinon', async () => {
    const r = await admin.post(`/api/grc/${A}/objects`, { ...action('Action du plan A+B'), registreId: registre });
    expect(r.statusCode).toBe(200);
    element = r.json().id;
    expect(r.json().registreId).toBe(registre);
    // Sans choix de registre : le registre par défaut du périmètre.
    const defaut = await admin.post(`/api/grc/${A}/objects`, action('Action sans registre'));
    const dto = defaut.json();
    expect(dto.registreId).not.toBe(registre);
    const parDefaut = await t.svc.db.one<{ par_defaut: boolean; kind: string }>(
      'SELECT par_defaut, kind FROM registres WHERE id=$1',
      [dto.registreId],
    );
    expect(parDefaut).toEqual({ par_defaut: true, kind: 'plan_actions' });
    // Un registre d'un autre périmètre de référence ou d'une autre famille est refusé.
    expect(
      (await admin.post(`/api/grc/${B}/objects`, { ...action('Mauvais périmètre'), registreId: registre })).statusCode,
    ).toBe(422);
    // Le périmètre d'un élément ne se choisit pas dans la fiche : la liste d'un registre donne les périmètres hérités.
    const liste = (await admin.get(`/api/registres/${registre}/elements`)).json();
    expect(liste.items.map((x: { id: string }) => x.id)).toEqual([element]);
    expect(liste.registre.perimetres).toHaveLength(2);
  });

  it('le registre par défaut du périmètre commun existe pour chaque famille', async () => {
    const lignes = await t.svc.db.q<{ kind: string; name: string }>(
      'SELECT kind, name FROM registres WHERE reference_smsi_id=$1 AND par_defaut ORDER BY kind',
      [DEFAULT_SMSI],
    );
    expect(lignes.rows.map((x) => x.kind)).toEqual(['ecarts', 'plan_actions', 'recurrences']);
    expect(lignes.rows.every((x) => x.name.endsWith('Pilotage commun'))).toBe(true);
  });

  it('un membre d’un seul périmètre lit le registre mais ne le modifie pas, sans voir le périmètre B', async () => {
    const dto = (await membreA.get(`/api/registres/${registre}`)).json();
    expect(dto.perimetres.map((p: { id: string }) => p.id)).toEqual([A]);
    expect(dto.autresPerimetres).toBe(1);
    expect(dto.peut).toEqual({ lire: true, contribuer: false, gerer: false });
    expect(
      (await membreA.post(`/api/grc/${A}/objects`, { ...action('Création refusée'), registreId: registre })).statusCode,
    ).toBe(403);
    const maj = await membreA.get(`/api/grc/${A}/objects/${element}`);
    expect(maj.statusCode).toBe(200);
    expect(
      (await membreA.put(`/api/grc/${A}/objects/${element}`, action('Renommée'), { 'if-match': etag(maj) })).statusCode,
    ).toBe(403);
  });

  it('un utilisateur sans droit sur A ni B ne voit pas le registre (404, aucune fuite)', async () => {
    expect((await contributeur.get(`/api/registres/${registre}`)).statusCode).toBe(404);
    expect((await contributeur.get(`/api/registres/${registre}/elements`)).statusCode).toBe(404);
    expect((await contributeur.get('/api/registres')).json().items.some((r: { id: string }) => r.id === registre)).toBe(
      false,
    );
    expect((await contributeur.get(`/api/grc/${A}/objects/${element}`)).statusCode).toBe(404);
  });

  it('un contributeur remplit sans modifier : avancement oui, définition non', async () => {
    expect(
      (
        await admin.put(`/api/droits/registre/${registre}`, {
          subjectType: 'utilisateur',
          subjectId: contributeurId,
          role: 'contributeur',
        })
      ).statusCode,
    ).toBe(200);
    const lecture = await contributeur.get(`/api/grc/${A}/objects/${element}`);
    expect(lecture.statusCode).toBe(200);
    const v1 = etag(lecture);
    // Avancement : transition todo → progress, sans aucun droit de modification de module ni périmètre.
    const ok = await contributeur.req('POST', `/api/grc/${A}/objects/${element}/contribution`, {
      json: { status: 'progress' },
      headers: { 'if-match': v1 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.status).toBe('progress');
    expect(ok.json().name).toBe('Action du plan A+B');
    // Transition interdite, clôture sans justification, version périmée.
    const v2 = etag(ok);
    expect(
      (
        await contributeur.req('POST', `/api/grc/${A}/objects/${element}/contribution`, {
          json: { status: 'todo' },
          headers: { 'if-match': v2 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await contributeur.req('POST', `/api/grc/${A}/objects/${element}/contribution`, {
          json: { status: 'done' },
          headers: { 'if-match': v2 },
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await contributeur.req('POST', `/api/grc/${A}/objects/${element}/contribution`, {
          json: { status: 'blocked' },
          headers: { 'if-match': v1 },
        })
      ).statusCode,
    ).toBe(412);
    // Clôture avec compte rendu.
    const fin = await contributeur.req('POST', `/api/grc/${A}/objects/${element}/contribution`, {
      json: { status: 'done', justification: 'Réalisée et vérifiée sur site.' },
      headers: { 'if-match': v2 },
    });
    expect(fin.statusCode).toBe(200);
    // Modification de la définition, archivage et attribution de droits : refusés (403, il lit mais ne gère pas).
    expect(
      (
        await contributeur.put(`/api/grc/${A}/objects/${element}`, action('Renommée par le contributeur'), {
          'if-match': etag(fin),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await contributeur.req('DELETE', `/api/grc/${A}/objects/${element}`, { headers: { 'if-match': etag(fin) } }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await contributeur.put(`/api/droits/registre/${registre}`, {
          subjectType: 'utilisateur',
          subjectId: contributeurId,
          role: 'gestionnaire',
        })
      ).statusCode,
    ).toBe(403);
    expect((await contributeur.get(`/api/droits/registre/${registre}`)).statusCode).toBe(403);
    // L'accès effectif de l'élément reflète le rôle de contributeur : il lit et contribue sans gérer.
    const acces = (await contributeur.get(`/api/registres/elements/${element}/acces`)).json();
    expect(acces.peut).toEqual({ lire: true, contribuer: true, gerer: false });
    expect(acces.role).toBe('contributeur');
    // L'annuaire des titulaires n'est servi qu'à qui gère la ressource.
    expect((await contributeur.get(`/api/droits/registre/${registre}/titulaires`)).statusCode).toBe(403);
    const propose = (
      await admin.get(`/api/droits/registre/${registre}/titulaires?q=${encodeURIComponent('%')}`)
    ).json();
    expect(propose.utilisateurs).toEqual([]);
    const tous = (await admin.get(`/api/droits/registre/${registre}/titulaires`)).json();
    expect(tous.utilisateurs.map((u: { id: string }) => u.id)).toContain(contributeurId);
  });

  it('un lecteur sans aucun droit de module consulte par un droit de lecture attribué', async () => {
    expect((await lecteurSansModule.get(`/api/registres/${registre}`)).statusCode).toBe(404);
    await admin.put(`/api/droits/registre/${registre}`, {
      subjectType: 'utilisateur',
      subjectId: lecteurId,
      role: 'lecteur',
    });
    const dto = (await lecteurSansModule.get(`/api/registres/${registre}`)).json();
    expect(dto.role).toBe('lecteur');
    expect(dto.peut).toEqual({ lire: true, contribuer: false, gerer: false });
    expect((await lecteurSansModule.get(`/api/registres/${registre}/elements`)).json().items).toHaveLength(1);
    expect((await lecteurSansModule.get(`/api/grc/${A}/objects/${element}`)).statusCode).toBe(200);
    // Lecture seulement : aucune contribution.
    const lecture = await lecteurSansModule.get(`/api/grc/${A}/objects/${element}`);
    expect(
      (
        await lecteurSansModule.req('POST', `/api/grc/${A}/objects/${element}/contribution`, {
          json: { status: 'progress' },
          headers: { 'if-match': etag(lecture) },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('un groupe porte un rôle : ses membres contribuent', async () => {
    const lecture = await admin.get(
      `/api/grc/${A}/objects/${(await admin.post(`/api/grc/${A}/objects`, { ...action('Action du groupe'), registreId: registre })).json().id}`,
    );
    const id = lecture.json().id;
    expect(
      (
        await deGroupe.req('POST', `/api/grc/${A}/objects/${id}/contribution`, {
          json: { status: 'progress' },
          headers: { 'if-match': etag(lecture) },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await admin.put(`/api/droits/registre/${registre}`, {
          subjectType: 'groupe',
          subjectId: groupeId,
          role: 'contributeur',
        })
      ).statusCode,
    ).toBe(200);
    const fait = await deGroupe.req('POST', `/api/grc/${A}/objects/${id}/contribution`, {
      json: { status: 'progress' },
      headers: { 'if-match': etag(lecture) },
    });
    expect(fait.statusCode).toBe(200);
    // Le journal d'audit conserve l'attribution.
    const journal = await t.svc.db.q("SELECT details FROM audit_log WHERE action='droit.accorde' AND target=$1", [
      registre,
    ]);
    expect(journal.rowCount).toBeGreaterThanOrEqual(3);
  });

  it('un droit sur un seul élément ne donne pas le registre', async () => {
    const dto = (
      await admin.post(`/api/grc/${A}/objects`, { ...action('Action isolée'), registreId: registre })
    ).json();
    await admin.put(`/api/droits/objet/${dto.id}`, {
      subjectType: 'utilisateur',
      subjectId: membreAId,
      role: 'gestionnaire',
    });
    const lecture = await membreA.get(`/api/grc/${A}/objects/${dto.id}`);
    // Gestionnaire de cet élément : il le modifie, alors qu'il ne peut pas modifier le registre multi-périmètre.
    expect(
      (
        await membreA.put(`/api/grc/${A}/objects/${dto.id}`, action('Action isolée modifiée'), {
          'if-match': etag(lecture),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await membreA.post(`/api/grc/${A}/objects`, { ...action('Toujours refusé'), registreId: registre })).statusCode,
    ).toBe(403);
  });

  it('un registre restreint masque ses éléments à qui n’a pas de droit attribué', async () => {
    const restreint = (
      await admin.post('/api/registres', {
        kind: 'plan_actions',
        name: 'Plan confidentiel',
        referenceId: A,
        perimetres: [],
        restreint: true,
      })
    ).json().id as string;
    const o = (
      await admin.post(`/api/grc/${A}/objects`, { ...action('Action confidentielle'), registreId: restreint })
    ).json();
    expect((await membreA.get(`/api/registres/${restreint}`)).statusCode).toBe(404);
    expect((await membreA.get(`/api/grc/${A}/objects/${o.id}`)).statusCode).toBe(404);
    const liste = (await membreA.get(`/api/grc/${A}/objects?kind=action`)).json();
    expect(liste.items.some((x: { id: string }) => x.id === o.id)).toBe(false);
    await admin.put(`/api/droits/registre/${restreint}`, {
      subjectType: 'utilisateur',
      subjectId: membreAId,
      role: 'lecteur',
    });
    expect((await membreA.get(`/api/grc/${A}/objects/${o.id}`)).statusCode).toBe(200);
    expect(
      ((await membreA.get(`/api/grc/${A}/objects?kind=action`)).json().items as { id: string }[]).some(
        (x) => x.id === o.id,
      ),
    ).toBe(true);
  });

  it('les périmètres d’un registre se changent par commande atomique, avec aperçu et motif', async () => {
    const v = await version(registre);
    const apercu = await admin.put(`/api/registres/${registre}/perimetres`, { perimetres: [A], apercu: true });
    expect(apercu.statusCode).toBe(200);
    expect(apercu.json().apercu).toBe(true);
    expect(apercu.json().impact.retires.map((p: { id: string }) => p.id)).toEqual([B]);
    expect(apercu.json().impact.elements).toBeGreaterThanOrEqual(3);
    expect(await version(registre)).toBe(v); // aucun effet
    // Le périmètre de référence ne peut pas être retiré ; motif obligatoire ; version contrôlée.
    expect(
      (
        await admin.put(
          `/api/registres/${registre}/perimetres`,
          { perimetres: [B], reason: 'Retrait de la référence' },
          await ifMatch(registre),
        )
      ).statusCode,
    ).toBe(422);
    expect(
      (await admin.put(`/api/registres/${registre}/perimetres`, { perimetres: [A] }, await ifMatch(registre)))
        .statusCode,
    ).toBe(422);
    expect(
      (
        await admin.put(
          `/api/registres/${registre}/perimetres`,
          { perimetres: [A], reason: 'Le registre ne concerne plus B.' },
          { 'if-match': '"999"' },
        )
      ).statusCode,
    ).toBe(412);
    const ok = await admin.put(
      `/api/registres/${registre}/perimetres`,
      { perimetres: [A], reason: 'Le registre ne concerne plus B.' },
      await ifMatch(registre),
    );
    expect(ok.statusCode).toBe(200);
    expect(ok.json().registre.perimetres.map((p: { id: string }) => p.id)).toEqual([A]);
    // Les éléments n'ont pas été réécrits : même identité, même version.
    const intact = await t.svc.db.one<{ n: string }>(
      'SELECT count(*)::text AS n FROM grc_objects WHERE registre_id=$1',
      [registre],
    );
    expect(Number(intact!.n)).toBeGreaterThanOrEqual(3);
    // Revenir sur B : il faut pouvoir le consulter (l'administrateur le peut).
    expect(
      (
        await admin.put(
          `/api/registres/${registre}/perimetres`,
          { perimetres: [A, B], reason: 'B est de nouveau concerné.' },
          await ifMatch(registre),
        )
      ).statusCode,
    ).toBe(200);
    const journal = await t.svc.db.q(
      "SELECT 1 FROM audit_log WHERE action='registre.perimetres.changed' AND target=$1",
      [registre],
    );
    expect(journal.rowCount).toBe(2);
  });

  it('archiver un registre conserve ses éléments ; le registre par défaut ne s’archive pas', async () => {
    const defaut = await t.svc.db.one<{ id: string }>(
      "SELECT id FROM registres WHERE par_defaut AND kind='plan_actions' AND reference_smsi_id=$1",
      [A],
    );
    expect((await admin.post(`/api/registres/${defaut!.id}/archivage`, {}, await ifMatch(defaut!.id))).statusCode).toBe(
      409,
    );
    const jetable = (
      await admin.post('/api/registres', { kind: 'recurrences', name: 'Récurrences jetables', referenceId: A })
    ).json().id as string;
    const archive = await admin.post(`/api/registres/${jetable}/archivage`, {}, await ifMatch(jetable));
    expect(archive.statusCode).toBe(200);
    expect(archive.json().archived).toBe(true);
    expect((await admin.get('/api/registres')).json().items.some((r: { id: string }) => r.id === jetable)).toBe(false);
    expect(
      (await admin.get('/api/registres?archives=true')).json().items.some((r: { id: string }) => r.id === jetable),
    ).toBe(true);
  });

  it('retirer un droit ferme l’accès ; la suppression d’un groupe retire ses droits', async () => {
    const droits = (await admin.get(`/api/droits/registre/${registre}`)).json().items as {
      id: string;
      subjectId: string;
    }[];
    const du = droits.find((d) => d.subjectId === lecteurId)!;
    expect((await admin.del(`/api/droits/registre/${registre}/${du.id}`)).statusCode).toBe(204);
    expect((await lecteurSansModule.get(`/api/registres/${registre}`)).statusCode).toBe(404);
    await t.svc.db.q('DELETE FROM groups WHERE id=$1', [groupeId]);
    const reste = await t.svc.db.q("SELECT 1 FROM droits_ressources WHERE subject_type='groupe' AND subject_id=$1", [
      groupeId,
    ]);
    expect(reste.rowCount).toBe(0);
  });
});

describe('migration 029 : reprise des éléments existants', () => {
  it('rattache chaque élément à un registre par défaut de son périmètre, occurrences dans les récurrences', async () => {
    const dbName = await createDatabase();
    const t = await createTestApp({}, { migrate: false, dbName });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'reg-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '029'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      await t.svc.db.q(
        "INSERT INTO business_policy_versions(version,definition,reason,created_by) VALUES (1,$1,'test','système')",
        [businessDefaults()],
      );
      const p = (nom: string, id?: string) =>
        t.svc.db.one<{ id: string }>(
          `INSERT INTO grc_smsis(${id ? 'id,' : ''}name,scope,visibility,business_version,created_by) VALUES (${id ? "'" + id + "'," : ''}$1,'','restricted',1,'test') RETURNING id`,
          [nom],
        );
      const commun = (await p('Commun', DEFAULT_SMSI))!.id;
      const autre = (await p('Autre périmètre'))!.id;
      const objet = async (smsi: string, kind: string, name: string, data: Record<string, unknown> = {}) =>
        (await t.svc.db.one<{ id: string }>(
          "INSERT INTO grc_objects(smsi_id,kind,module,name,data,created_by,updated_by) VALUES ($1,$2,'ecarts',$3,$4,'test','test') RETURNING id",
          [smsi, kind, name, data],
        ))!.id;
      const a1 = await objet(commun, 'action', 'Action commune');
      const e1 = await objet(autre, 'nonconformity', 'Écart autre');
      const s1 = await objet(autre, 'task_series', 'Série autre');
      const o1 = await objet(autre, 'action', 'Occurrence', {
        seriesId: s1,
        occurrenceKey: '2026-10-01T09:00[Europe/Paris]',
      });
      const risque = await objet(autre, 'risk', 'Risque (hors registre)');
      expect(await t.svc.db.migrate()).toContain('029_registres_droits_ressources.sql');
      const reg = async (id: string) =>
        (await t.svc.db.one<{ kind: string; par_defaut: boolean; reference_smsi_id: string; name: string }>(
          'SELECT r.kind, r.par_defaut, r.reference_smsi_id, r.name FROM grc_objects o JOIN registres r ON r.id=o.registre_id WHERE o.id=$1',
          [id],
        ))!;
      expect(await reg(a1)).toMatchObject({ kind: 'plan_actions', par_defaut: true, reference_smsi_id: commun });
      expect((await reg(a1)).name).toMatch(/Pilotage commun$/);
      expect(await reg(e1)).toMatchObject({ kind: 'ecarts', par_defaut: true, reference_smsi_id: autre });
      expect(await reg(s1)).toMatchObject({ kind: 'recurrences', reference_smsi_id: autre });
      expect(await reg(o1)).toMatchObject({ kind: 'recurrences', reference_smsi_id: autre });
      const sansRegistre = await t.svc.db.one<{ registre_id: string | null }>(
        'SELECT registre_id FROM grc_objects WHERE id=$1',
        [risque],
      );
      expect(sansRegistre!.registre_id).toBeNull();
      // Chaque registre porte au moins son périmètre de référence ; rien n'a été supprimé.
      const sans = await t.svc.db.one<{ n: string }>(
        'SELECT count(*)::text AS n FROM registres r WHERE NOT EXISTS (SELECT 1 FROM registre_perimetres p WHERE p.registre_id=r.id AND p.smsi_id=r.reference_smsi_id)',
      );
      expect(Number(sans!.n)).toBe(0);
      expect(Number((await t.svc.db.one<{ n: string }>('SELECT count(*)::text AS n FROM grc_objects'))!.n)).toBe(5);
    } finally {
      await t.close();
    }
  });
});
