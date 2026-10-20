/* Cartes de périmètres (R16, R17) : compteurs sans double comptage, indisponibles sans droit, registres restreints
   respectés, éléments hérités par registre. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SyntheseCartes } from '@suivi/shared';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const action = (name: string, extra: Record<string, unknown> = {}, registreId?: string) => ({
  kind: 'action',
  name,
  registreId,
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
const passe = new Date(Date.now() - 20 * 86400000).toISOString();
const futur = new Date(Date.now() + 20 * 86400000).toISOString();

describe('cartes de périmètres', () => {
  let t: TestApp;
  let admin: Agent, membre: Agent, sansDroit: Agent;
  let membreUser: Awaited<ReturnType<typeof makeUser>>;
  let A: string, B: string;
  let regRestreint: string, regPartage: string;
  const synthese = async (a: Agent) => {
    const r = await a.get('/api/grc/perimetres/synthese');
    if (r.statusCode !== 200) throw new Error(r.statusCode + ' ' + r.body);
    return r.json() as SyntheseCartes;
  };
  const cartes = async (a: Agent) => (await synthese(a)).cartes;
  const carte = async (a: Agent, id: string) => (await cartes(a)).find((c) => c.id === id)!;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'car_admin', 'admin'));
    const m = (membreUser = await makeUser(t, 'car_membre', 'ro'));
    membre = await login(t, m);
    sansDroit = await login(t, await makeUser(t, 'car_sans', 'ro', { modules: ['audit'] }));
    const p = async (n: string, parentId: string | null = null) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris', parentId })).json()
        .id as string;
    A = await p('Périmètre carte A');
    B = await p('Périmètre carte B', A);
    for (const id of [A, B]) await admin.put(`/api/grc/${id}/members`, { userId: m.id, write: false });
    // A : deux actions ouvertes (dont une en retard), une terminée, une archivée.
    await admin.post(`/api/grc/${A}/objects`, action('Ouverte à temps', { dueAt: futur }));
    await admin.post(`/api/grc/${A}/objects`, action('Ouverte en retard', { dueAt: passe }));
    const finie = (await admin.post(`/api/grc/${A}/objects`, action('Terminée', { dueAt: passe }))).json().id;
    await t.svc.db.q("UPDATE grc_objects SET data=jsonb_set(data,'{status}','\"done\"') WHERE id=$1", [finie]);
    const archivee = (await admin.post(`/api/grc/${A}/objects`, action('Archivée', { dueAt: passe }))).json().id;
    await t.svc.db.q('UPDATE grc_objects SET archived=true WHERE id=$1', [archivee]);
    // Série active : ses occurrences ne comptent que dans « récurrentes ».
    await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série carte',
      data: {
        description: '',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'week',
          interval: 1,
          until: null,
          count: 3,
          reminderDays: 7,
          active: true,
        },
      },
    });
    await t.svc.grc.tasks.tick(new Date(Date.now() + 7 * 86400000));
    await admin.post(`/api/grc/${A}/objects`, { kind: 'nonconformity', name: 'Écart ouvert', data: { cause: 'c' } });
    await admin.post(`/api/grc/${A}/objects`, { kind: 'bia', name: 'BIA carte', data: {} });
    // Registre restreint (non lisible par le membre) et registre partagé A/B.
    regRestreint = (
      await admin.post('/api/registres', { kind: 'plan_actions', name: 'Plan secret', referenceId: A, restreint: true })
    ).json().id;
    await admin.post(`/api/grc/${A}/objects`, action('Action secrète', { dueAt: passe }, regRestreint));
    regPartage = (
      await admin.post('/api/registres', { kind: 'plan_actions', name: 'Plan A/B', referenceId: A, perimetres: [B] })
    ).json().id;
    await admin.post(`/api/grc/${A}/objects`, action('Action partagée', { dueAt: futur }, regPartage));
  });
  afterAll(async () => t.close());

  it('compte les actions autonomes ouvertes et en retard, sans terminées ni archivées ni occurrences', async () => {
    const a = await carte(admin, A);
    // Ouverte à temps + ouverte en retard + action secrète (en retard) + action partagée = 4 ouvertes, 2 en retard.
    expect(a.compteurs.actions).toEqual({ ouverts: 4, enRetard: 2 });
  });

  it('compte les séries actives et leurs occurrences ouvertes une seule fois', async () => {
    const a = await carte(admin, A);
    expect(a.compteurs.recurrentes!.series).toBe(1);
    const occ = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int n FROM grc_objects WHERE smsi_id=$1 AND kind='action' AND data->>'seriesId' IS NOT NULL",
      [A],
    );
    expect(a.compteurs.recurrentes!.occurrences.ouverts).toBe(occ!.n);
    expect(occ!.n).toBeGreaterThanOrEqual(2);
    // Les occurrences n'ont pas gonflé le compteur des actions.
    expect(a.compteurs.actions!.ouverts).toBe(4);
  });

  it('compte les écarts ouverts, la continuité et laisse la conformité indisponible sans référentiel activé', async () => {
    const a = await carte(admin, A);
    expect(a.compteurs.ecarts).toEqual({ ouverts: 1, enRetard: 0 });
    expect(a.compteurs.continuite).toEqual({ bia: 1, plans: 0 });
    expect(a.compteurs.conformite).toBeNull();
  });

  it('un périmètre vide affiche des zéros réels, pas des valeurs indisponibles', async () => {
    const b = await carte(admin, B);
    expect(b.compteurs.ecarts).toEqual({ ouverts: 0, enRetard: 0 });
    expect(b.compteurs.continuite).toEqual({ bia: 0, plans: 0 });
    expect(b.parentId).toBe(A);
  });

  it('le périmètre enfant compte les éléments du registre partagé qui le porte, sans les additionner à son parent', async () => {
    const b = await carte(admin, B);
    expect(b.compteurs.actions).toEqual({ ouverts: 1, enRetard: 0 });
    const a = await carte(admin, A);
    expect(a.compteurs.actions!.ouverts).toBe(4);
  });

  it('masque les éléments d’un registre restreint à qui ne peut pas le lire', async () => {
    // Les changements de droits referment les sessions : la personne se reconnecte pour chaque observation.
    membre = await login(t, membreUser);
    const vue = await carte(membre, A);
    // Sans l'action secrète : 3 ouvertes, 1 en retard.
    expect(vue.compteurs.actions).toEqual({ ouverts: 3, enRetard: 1 });
    await admin.put(`/api/droits/registre/${regRestreint}`, {
      subjectType: 'utilisateur',
      subjectId: membreUser.id,
      role: 'lecteur',
    });
    // L'attribution d'un droit referme les sessions de la personne : elle se reconnecte.
    membre = await login(t, membreUser);
    expect((await carte(membre, A)).compteurs.actions).toEqual({ ouverts: 4, enRetard: 2 });
  });

  it('sans droit de lecture d’un module, le compteur est indisponible (null), jamais zéro', async () => {
    const liste = await cartes(sansDroit);
    expect(liste.length).toBeGreaterThan(0);
    for (const c of liste)
      expect(c.compteurs).toEqual({
        actions: null,
        recurrentes: null,
        ecarts: null,
        continuite: null,
        conformite: null,
      });
  });

  it('ne montre que les périmètres accessibles', async () => {
    const ids = (await cartes(sansDroit)).map((c) => c.id);
    expect(ids).not.toContain(A);
    expect((await cartes(admin)).map((c) => c.id)).toEqual(expect.arrayContaining([A, B]));
  });

  it('le total compte chaque élément une seule fois, alors que les cartes comptent un registre partagé dans chacune', async () => {
    const { cartes: liste, total } = await synthese(admin);
    const a = liste.find((c) => c.id === A)!,
      b = liste.find((c) => c.id === B)!;
    // L'action du registre partagé A/B figure dans la carte de A et dans celle de B : la somme des cartes la compte deux fois.
    expect(a.compteurs.actions!.ouverts + b.compteurs.actions!.ouverts).toBe(5);
    // Total sur tous les périmètres accessibles (dont le périmètre commun) : le même élément n'y compte qu'une fois.
    const ouvertesReelles = await t.svc.db.one<{ n: number }>(
      `SELECT count(*)::int n FROM grc_objects WHERE kind='action' AND NOT archived AND data->>'seriesId' IS NULL
         AND COALESCE(data->>'status','') NOT IN ('done','cancelled') AND smsi_id IN (SELECT id FROM grc_smsis)`,
    );
    expect(total.actions!.ouverts).toBe(ouvertesReelles!.n);
    expect(total.conformite).toBeNull();
  });

  it('sans droit de lecture, le total est indisponible comme les cartes', async () => {
    const { total } = await synthese(sansDroit);
    expect(total).toEqual({ actions: null, recurrentes: null, ecarts: null, continuite: null, conformite: null });
  });
});
