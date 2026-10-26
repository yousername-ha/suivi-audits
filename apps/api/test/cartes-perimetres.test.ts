/* Cartes de périmètres (R16, R17) : compteurs sans double comptage, indisponibles sans droit, registres restreints
   respectés, éléments hérités par registre. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition, SyntheseCartes } from '@suivi/shared';
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
const definition: FrameworkDefinition = {
  name: 'Référentiel de carte',
  identifier: 'CARTE-FICTIF',
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/carte',
    version: '1',
    date: '2026-10-21',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'd', label: 'Domaine' }],
  requirements: ['R1', 'R2', 'R3'].map((id) => ({
    id,
    domain: 'd',
    title: `Exigence ${id}`,
    description: 'Fictif',
    applicability: '',
    measureRefs: [],
  })),
};
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
  const p = async (n: string, parentId: string | null = null) =>
    (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris', parentId })).json().id as string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'car_admin', 'admin'));
    const m = (membreUser = await makeUser(t, 'car_membre', 'ro'));
    membre = await login(t, m);
    sansDroit = await login(t, await makeUser(t, 'car_sans', 'ro', { modules: ['audit'] }));
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
    // Seuls les plans de type PCRA sont comptés par la tuile Continuité (décision du 21/10/2026).
    for (const [name, planType] of [
      ['PCA carte', 'pca'],
      ['PRA carte', 'pra'],
      ['PCRA carte', 'pcra'],
    ]) {
      const r = await admin.post(`/api/grc/${A}/objects`, { kind: 'continuity_plan', name, data: { planType } });
      expect(r.statusCode, r.body).toBeLessThan(300);
    }
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

  it('compte les écarts ouverts, la continuité et laisse la couverture indisponible sans référentiel effectif', async () => {
    const a = await carte(admin, A);
    expect(a.compteurs.ecarts).toMatchObject({ ouverts: 1, enRetard: 0 });
    expect(a.compteurs.continuite).toEqual({ bia: 1, pcra: 1 });
    expect(a.compteurs.couverture).toBeNull();
  });

  it('un périmètre vide affiche des zéros réels, pas des valeurs indisponibles', async () => {
    const b = await carte(admin, B);
    expect(b.compteurs.ecarts).toEqual({
      ouverts: 0,
      enRetard: 0,
      parClassification: { majeure: 0, mineure: 0, point_sensible: 0, non_classe: 0 },
    });
    expect(b.compteurs.continuite).toEqual({ bia: 0, pcra: 0 });
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
        couverture: null,
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
    expect(total.couverture).toBeNull();
  });

  it('la carte parent compte son ensemble une seule fois, sans additionner les cartes enfants', async () => {
    const liste = await cartes(admin);
    const a = liste.find((c) => c.id === A)!,
      b = liste.find((c) => c.id === B)!;
    expect(a.sousPerimetres).toBe(1);
    // Le registre partagé figure dans A et dans B : la somme des deux cartes (5) compterait deux fois son action.
    expect(a.compteurs.actions!.ouverts + b.compteurs.actions!.ouverts).toBe(5);
    expect(a.total.actions).toEqual({ ouverts: 4, enRetard: 2 });
    expect(a.total.couverture).toBeNull();
    // Sans sous-périmètre, le total de la carte est son propre décompte.
    expect(b.sousPerimetres).toBe(0);
    expect(b.total).toEqual(b.compteurs);
  });

  it('ventile les écarts ouverts par classification (fiche ou outil historique), sans compter les clos', async () => {
    const C = await p('Périmètre classes');
    const ecart = (name: string, data: Record<string, unknown>) =>
      admin.post(`/api/grc/${C}/objects`, { kind: 'nonconformity', name, data: { cause: 'c', ...data } });
    await ecart('Majeur', { classification: 'majeure' });
    await ecart('Mineur', { classification: 'mineure' });
    await ecart('Sensible historique', { type: 'PS' });
    await ecart('Sans classification', {});
    await ecart('Majeur clos', { classification: 'majeure', status: 'closed' });
    const c = await carte(admin, C);
    expect(c.compteurs.ecarts).toEqual({
      ouverts: 4,
      enRetard: 0,
      parClassification: { majeure: 1, mineure: 1, point_sensible: 1, non_classe: 1 },
    });
  });

  it('l’échéance d’un écart se compare à la date locale du périmètre, pas à celle de l’UTC', async () => {
    const jourLocal = (fuseau: string) => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau }).format(new Date()); // AAAA-MM-JJ
    const jourUtc = new Date().toISOString().slice(0, 10);
    for (const fuseau of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const id = (await admin.post('/api/grc/smsis', { name: `Fuseau ${fuseau}`, scope: 'f', timezone: fuseau })).json()
        .id as string;
      await admin.post(`/api/grc/${id}/objects`, {
        kind: 'nonconformity',
        name: 'Échéance du jour UTC',
        data: { cause: 'c', dueAt: jourUtc },
      });
      const attendu = jourUtc < jourLocal(fuseau) ? 1 : 0;
      expect((await carte(admin, id)).compteurs.ecarts!.enRetard, fuseau).toBe(attendu);
    }
  });

  it('la couverture suit l’écran Couverture : référentiel rattaché et hérité, états communs, agrégée avec les sous-périmètres, provenance et détail par référentiel', async () => {
    const pub = await admin.post('/api/library/frameworks/preview', { id: null, definition });
    const publie = await admin.post(
      '/api/library/frameworks/publish',
      { id: null, definition, previewId: pub.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
      { 'if-match': '"0"' },
    );
    expect(publie.statusCode, publie.body).toBe(200);
    const fw = publie.json().id as string;
    const P = await p('Périmètre couvert');
    const Q = (
      await admin.post('/api/grc/smsis', {
        name: 'Enfant qui hérite',
        scope: 'q',
        timezone: 'Europe/Paris',
        parentId: P,
        inheritFrameworks: true,
      })
    ).json().id as string;
    const rattache = await admin.put(`/api/grc/${P}/framework-attachments/${fw}`, {
      version: 1,
      confirm: 'RATTACHER',
    });
    expect(rattache.statusCode, rattache.body).toBe(200);
    // Une exigence testée conforme : elle compte parmi les « testées ou validées ».
    const evaluation = await admin.post(
      `/api/grc/${P}/exigences/${fw}/R1/evaluations`,
      {
        applicability: 'applicable',
        implementation: 'complete',
        testedAt: '2026-10-20',
        testResult: 'conforme',
        reason: 'Revue de recette',
        confirm: 'EVALUER',
      },
      { 'if-match': '"0"' },
    );
    expect(evaluation.statusCode, evaluation.body).toBe(201);
    const chiffres = (testees: number, aDeterminer: number) => ({
      referentiels: 1,
      exigences: 3,
      applicables: 3,
      testees,
      aDeterminer,
      obligatoiresNonConformes: 0,
      perimetres: 1,
      nonLus: 0,
    });
    const ligne = (
      testees: number,
      aDeterminer: number,
      provenance: 'rattache' | 'herite',
      origine: string | null,
    ) => ({
      referentielId: fw,
      version: 1,
      perimetres: 1,
      exigences: 3,
      applicables: 3,
      testees,
      aDeterminer,
      obligatoiresNonConformes: 0,
      provenance,
      origine,
    });
    const propre = (await carte(admin, P)).compteurs.couverture!;
    expect(propre).toMatchObject(chiffres(1, 2));
    // Provenance : rattaché sur le périmètre lui-même.
    expect(propre.parReferentiel).toHaveLength(1);
    expect(propre.parReferentiel[0]).toMatchObject(ligne(1, 2, 'rattache', null));
    // L'enfant hérite du référentiel du parent : sa carte n'affiche plus « indisponible », mais l'évaluation est propre à
    // chaque périmètre : celle du parent ne lui est pas attribuée. Sa provenance nomme le parent (lisible).
    const enfant = (await carte(admin, Q)).compteurs.couverture!;
    expect(enfant).toMatchObject(chiffres(0, 3));
    expect(enfant.parReferentiel[0]).toMatchObject(ligne(0, 3, 'herite', 'Périmètre couvert'));
    // Le total du parent additionne explicitement la couverture de chaque périmètre de l'ensemble (une exigence compte une fois
    // par périmètre où elle est évaluée), avec le détail par référentiel.
    const total = (await carte(admin, P)).total.couverture!;
    expect(total).toMatchObject({
      referentiels: 1,
      exigences: 6,
      applicables: 6,
      testees: 1,
      aDeterminer: 5,
      obligatoiresNonConformes: 0,
      perimetres: 2,
      nonLus: 0,
    });
    expect(total.parReferentiel).toHaveLength(1);
    expect(total.parReferentiel[0]).toMatchObject({ referentielId: fw, perimetres: 2, exigences: 6, testees: 1 });
    expect(total.parReferentiel[0]).not.toHaveProperty('provenance');
    // Un enfant sans sous-périmètre : son total est sa propre carte.
    expect((await carte(admin, Q)).total.couverture).toMatchObject(chiffres(0, 3));
    // Le total général (tous périmètres) n'agrège pas la couverture.
    expect((await synthese(admin)).total.couverture).toBeNull();
  });

  it('sans droit de lecture, le total est indisponible comme les cartes', async () => {
    const { total } = await synthese(sansDroit);
    expect(total).toEqual({ actions: null, recurrentes: null, ecarts: null, continuite: null, couverture: null });
  });
});
