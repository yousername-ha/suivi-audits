/* Requêtes des registres (conversion Kysely, ADR 0062) : aperçu d'une attribution à un groupe (membres actifs, rôles
   directs déjà plus élevés), liste des droits et de leurs libellés, impact d'un changement de périmètres, vue paginée des
   accès d'un sujet, annuaire des titulaires. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

describe('registres : requêtes', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, B: string, registre: string, groupe: string;
  const membres: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'rq_admin', 'admin'));
    A = (await admin.post('/api/grc/smsis', { name: 'Périmètre RQ-A', scope: 'A', timezone: 'Europe/Paris' })).json()
      .id;
    B = (await admin.post('/api/grc/smsis', { name: 'Périmètre RQ-B', scope: 'B', timezone: 'Europe/Paris' })).json()
      .id;
    const r = await admin.post('/api/registres', { kind: 'ecarts', name: 'Registre RQ', referenceId: A });
    expect(r.statusCode, r.body).toBe(201);
    registre = r.json().id;
    groupe = (await t.svc.db.one<{ id: string }>("INSERT INTO groups(name) VALUES ('Groupe RQ') RETURNING id"))!.id;
    for (const nom of ['rq_actif', 'rq_gestion', 'rq_lecteur', 'rq_desactive', 'rq_expire']) {
      membres[nom] = (await makeUser(t, nom, null)).id;
      await t.svc.db.q('INSERT INTO user_groups(user_id, group_id) VALUES ($1,$2)', [membres[nom], groupe]);
    }
    await t.svc.db.q("UPDATE users SET display_name='Alice Fictive' WHERE id=$1", [membres.rq_actif]);
    await t.svc.db.q('UPDATE users SET disabled=true WHERE id=$1', [membres.rq_desactive]);
    // Nom affiché vide : le libellé retombe sur l'identifiant.
    await t.svc.db.q("UPDATE users SET display_name='' WHERE id=$1", [membres.rq_lecteur]);
    await t.svc.db.q("UPDATE users SET expires_at=now() - interval '1 day' WHERE id=$1", [membres.rq_expire]);
    // Rôles directs : gestionnaire (plus élevé que contributeur), lecteur (plus faible), et un compte désactivé gestionnaire.
    for (const [nom, role] of [
      ['rq_gestion', 'gestionnaire'],
      ['rq_lecteur', 'lecteur'],
      ['rq_desactive', 'gestionnaire'],
    ] as const)
      await t.svc.db.q(
        `INSERT INTO droits_ressources(resource_type,resource_id,subject_type,subject_id,role,granted_by)
         VALUES('registre',$1,'utilisateur',$2,$3,'recette')`,
        [registre, membres[nom], role],
      );
  });
  afterAll(async () => t.close());

  it('aperçu pour un groupe : membres actifs seulement, rôles directs plus élevés comptés', async () => {
    const r = await admin.put(`/api/droits/registre/${registre}`, {
      subjectType: 'groupe',
      subjectId: groupe,
      role: 'contributeur',
      apercu: true,
    });
    expect(r.statusCode, r.body).toBe(200);
    // Membres actifs : rq_actif, rq_gestion, rq_lecteur (désactivé et expiré exclus).
    expect(r.json()).toMatchObject({ avant: null, apres: 'contributeur', personnes: 3, dejaPlusEleves: 2 });
    const lecteur = await admin.put(`/api/droits/registre/${registre}`, {
      subjectType: 'groupe',
      subjectId: groupe,
      role: 'gestionnaire',
      apercu: true,
    });
    expect(lecteur.json().dejaPlusEleves).toBe(0);
  });

  it('liste des droits : libellés, ordre par type puis libellé, retrait', async () => {
    expect(
      (
        await admin.put(`/api/droits/registre/${registre}`, {
          subjectType: 'utilisateur',
          subjectId: membres.rq_actif,
          role: 'contributeur',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await admin.put(`/api/droits/registre/${registre}`, {
          subjectType: 'groupe',
          subjectId: groupe,
          role: 'lecteur',
        })
      ).statusCode,
    ).toBe(200);
    const items = (await admin.get(`/api/droits/registre/${registre}`)).json().items as {
      id: string;
      subjectType: string;
      libelle: string;
      role: string;
      grantedAt: string;
    }[];
    expect(items.map((d) => [d.subjectType, d.libelle, d.role])).toEqual([
      ['groupe', 'Groupe RQ', 'lecteur'],
      ['utilisateur', 'Alice Fictive', 'contributeur'],
      ['utilisateur', 'Nom rq_admin', 'gestionnaire'],
      ['utilisateur', 'Nom rq_desactive', 'gestionnaire'],
      ['utilisateur', 'Nom rq_gestion', 'gestionnaire'],
      ['utilisateur', 'rq_lecteur', 'lecteur'],
    ]);
    expect(Number.isNaN(Date.parse(items[0]!.grantedAt))).toBe(false);
    // Réattribuer met à jour le rôle sans doublon.
    await admin.put(`/api/droits/registre/${registre}`, {
      subjectType: 'groupe',
      subjectId: groupe,
      role: 'gestionnaire',
    });
    const apres = (await admin.get(`/api/droits/registre/${registre}`)).json().items as typeof items;
    expect(apres.filter((d) => d.subjectType === 'groupe')).toMatchObject([{ role: 'gestionnaire' }]);
    const g = apres.find((d) => d.subjectType === 'groupe')!;
    expect((await admin.req('DELETE', `/api/droits/registre/${registre}/${g.id}`)).statusCode).toBe(204);
    expect((await admin.req('DELETE', `/api/droits/registre/${registre}/${g.id}`)).statusCode).toBe(404);
  });

  it('impact d’un changement de périmètres : éléments, séries, liens et droits comptés', async () => {
    const o = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'nonconformity',
      name: 'Écart RQ',
      registreId: registre,
      data: { cause: 'Cause de recette' },
    });
    expect(o.statusCode, o.body).toBe(200);
    const dto = (await admin.get(`/api/registres/${registre}`)).json();
    const apercu = await admin.put(`/api/registres/${registre}/perimetres`, { perimetres: [A, B], apercu: true });
    expect(apercu.statusCode, apercu.body).toBe(200);
    const droits = (await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int n FROM droits_ressources WHERE resource_type='registre' AND resource_id=$1",
      [registre],
    ))!.n;
    expect(apercu.json().impact).toMatchObject({
      ajoutes: [{ id: B, name: 'Périmètre RQ-B' }],
      retires: [],
      elements: dto.elements,
      series: 0,
      liens: 0,
      droits,
    });
    expect(dto.elements).toBe(1);
  });

  it('vue des accès d’un sujet : filtre par nom, total et pagination', async () => {
    for (const n of ['RQ Pagination 1', 'RQ Pagination 2', 'RQ Pagination 3'])
      expect((await admin.post('/api/registres', { kind: 'ecarts', name: n, referenceId: A })).statusCode).toBe(201);
    const page = async (qs: string) =>
      (await admin.get(`/api/droits/sujets/utilisateur/${membres.rq_gestion}/registres${qs}`)).json() as {
        total: number;
        items: { registre: { name: string } }[];
      };
    const p1 = await page('?q=Pagination&limite=2');
    expect(p1.total).toBe(3);
    expect(p1.items.map((i) => i.registre.name)).toEqual(['RQ Pagination 1', 'RQ Pagination 2']);
    expect((await page('?q=Pagination&limite=2&decalage=2')).items.map((i) => i.registre.name)).toEqual([
      'RQ Pagination 3',
    ]);
    expect((await page('?q=pagination%25')).total).toBe(0); // joker saisi pris littéralement
    const g = (await admin.get(`/api/droits/sujets/groupe/${groupe}/registres?q=Registre%20RQ`)).json();
    expect(g.total).toBe(1);
  });

  it('annuaire des titulaires : comptes actifs et groupes, par nom ou identifiant', async () => {
    const r = (await admin.get(`/api/droits/registre/${registre}/titulaires?q=alice`)).json();
    expect(r.utilisateurs).toEqual([{ id: membres.rq_actif, libelle: 'Alice Fictive' }]);
    const d = (await admin.get(`/api/droits/registre/${registre}/titulaires?q=rq_desactive`)).json();
    expect(d.utilisateurs).toEqual([]);
    const gr = (await admin.get(`/api/droits/registre/${registre}/titulaires?q=groupe%20rq`)).json();
    expect(gr.groupes).toEqual([{ id: groupe, libelle: 'Groupe RQ' }]);
  });
});
