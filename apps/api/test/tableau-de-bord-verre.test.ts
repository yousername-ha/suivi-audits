/* Tableau de bord du style « Verre » (décision du RSSI du 27/11/2026) : la synthèse porte la grille des risques selon la
   méthode d'appréciation paramétrée et les actions une par une, dans le périmètre de lecture de la personne (porte de
   lecture, ADR 0083), jamais pour un écran mural. Données fictives. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '../src/auth.js';
import { tableauDeBordNatif } from '../src/tableau-de-bord.js';
import { createTestApp, login, makeUser, sessionUser, type TestApp } from './helpers.js';

const AUJOURDHUI = new Date('2026-11-27T10:00:00Z');

/** Méthode fictive à calcul matriciel : gravité sur 3 niveaux, vraisemblance sur 2, échelle de 3 niveaux. */
const methode = (nom: string) => ({
  name: nom,
  family: 'custom',
  display: { groupings: ['method'], defaultBasis: 'residual', showScores: false, showAcceptability: true },
  dimensions: [
    {
      id: 'g',
      label: 'Gravité',
      levels: [
        { id: 'g1', label: 'Mineure', value: 1 },
        { id: 'g2', label: 'Significative', value: 2 },
        { id: 'g3', label: 'Grave', value: 3 },
      ],
    },
  ],
  likelihood: [
    { id: 'v1', label: 'Peu probable', value: 1 },
    { id: 'v2', label: 'Probable', value: 2 },
  ],
  levels: [
    { id: 'bas', label: 'Faible', color: '#718975', acceptability: 'acceptable' },
    { id: 'moyen', label: 'Modéré', color: '#9A8B64', acceptability: 'conditional' },
    { id: 'haut', label: 'Élevé', color: '#A36F65', acceptability: 'unacceptable' },
  ],
  calculation: {
    kind: 'matrix',
    dimension: 'g',
    cells: [
      { impact: 'g1', likelihood: 'v1', level: 'bas', score: null },
      { impact: 'g2', likelihood: 'v1', level: 'bas', score: null },
      { impact: 'g3', likelihood: 'v1', level: 'moyen', score: null },
      { impact: 'g1', likelihood: 'v2', level: 'bas', score: null },
      { impact: 'g2', likelihood: 'v2', level: 'moyen', score: null },
      { impact: 'g3', likelihood: 'v2', level: 'haut', score: null },
    ],
  },
});

describe('synthèse du tableau de bord : détail des dalles du style « Verre »', () => {
  let t: TestApp;
  let admin: SessionUser, membre: SessionUser;
  let A: string, B: string;
  const ids: Record<string, string> = {};

  const objet = async (smsi: string, kind: string, nom: string, data: unknown) => {
    const r = await t.svc.db.one<{ id: string }>(
      `INSERT INTO grc_objects(smsi_id, kind, module, name, data, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, 'test', 'test') RETURNING id`,
      [smsi, kind, kind === 'risk' ? 'pilotage' : 'ecarts', nom, JSON.stringify(data)],
    );
    ids[nom] = r!.id;
    return r!.id;
  };
  const versionMethode = async (smsi: string, nom: string) =>
    (await t.svc.db.one<{ id: string }>(
      `INSERT INTO grc_method_versions(method_id, smsi_id, version, definition, reason, created_by)
       VALUES ($1, $2, 1, $3, 'test', 'test') RETURNING id`,
      [randomUUID(), smsi, JSON.stringify(methode(nom))],
    ))!.id;
  let revision = 0;
  const apprecier = (smsi: string, risque: string, version: string, g: string, v: string, decision = 'draft') =>
    t.svc.db.q(
      `INSERT INTO grc_risk_evaluations(risk_id, smsi_id, method_version_id, revision, risk_snapshot, ratings, result,
         rationale, decision, request_id, user_id, created_by)
       VALUES ($1, $2, $3, $4, '{}', $5, '{}', '', $6, $7, $8, 'test')`,
      [
        risque,
        smsi,
        version,
        ++revision,
        JSON.stringify({ residual: { dimensions: { g }, likelihood: v }, gross: { dimensions: { g }, likelihood: v } }),
        decision,
        randomUUID(),
        randomUUID(),
      ],
    );
  const synthese = (user: SessionUser | null, rights = (user ?? admin).rights) =>
    tableauDeBordNatif(t.svc.grc, rights, user, { aujourdHui: AUJOURDHUI, joursEcheance: 30 });

  beforeAll(async () => {
    t = await createTestApp();
    const a = await makeUser(t, 'verre_admin', 'admin');
    const ag = await login(t, a);
    const m = await makeUser(t, 'verre_membre', 'ro', { rattache: false });
    const smsi = async (name: string) =>
      (await ag.post('/api/grc/smsis', { name, scope: name, timezone: 'Europe/Paris' })).json().id as string;
    A = await smsi('Périmètre Verre A');
    B = await smsi('Périmètre Verre B');
    await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1,$2,false)', [A, m.id]);

    // Risques du périmètre A : trois selon la méthode de la grille, un selon une autre méthode, un sans appréciation.
    const principale = await versionMethode(A, 'Méthode fictive principale');
    const autre = await versionMethode(A, 'Méthode fictive secondaire');
    const r1 = await objet(A, 'risk', 'Risque fictif 1', { code: 'RF-1' });
    const r2 = await objet(A, 'risk', 'Risque fictif 2', { code: 'RF-2' });
    const r3 = await objet(A, 'risk', 'Risque fictif 3', { code: 'RF-3' });
    const r4 = await objet(A, 'risk', 'Risque fictif autre méthode', {});
    await objet(A, 'risk', 'Risque fictif à apprécier', {});
    await apprecier(A, r1, principale, 'g3', 'v2');
    // Appréciation validée d'abord, même plus ancienne qu'un brouillon.
    await apprecier(A, r2, principale, 'g3', 'v2', 'approved');
    await apprecier(A, r2, principale, 'g1', 'v1');
    await apprecier(A, r3, principale, 'g2', 'v1');
    await apprecier(A, r4, autre, 'g1', 'v1');
    // Périmètre B, que le membre ne lit pas.
    const rb = await objet(B, 'risk', 'Risque fictif B', {});
    await apprecier(B, rb, principale, 'g1', 'v2');

    // Actions du périmètre A : une par état, plus une occurrence de tâche récurrente (exclue).
    await objet(A, 'action', 'Action fictive en retard', { status: 'todo', dueAt: '2026-11-20' });
    await objet(A, 'action', 'Action fictive du mois', { status: 'progress', dueAt: '2026-11-30T09:00:00Z' });
    await objet(A, 'action', 'Action fictive du jour', { status: 'todo', dueAt: '2026-11-27' });
    await objet(A, 'action', 'Action fictive ouverte', { status: 'todo', dueAt: '2027-01-15' });
    await objet(A, 'action', 'Action fictive sans échéance', { status: 'todo' });
    await objet(A, 'action', 'Action fictive close', { status: 'done', dueAt: '2026-10-01' });
    await objet(A, 'action', 'Occurrence fictive', { status: 'todo', dueAt: '2026-11-01', seriesId: randomUUID() });
    await objet(B, 'action', 'Action fictive B', { status: 'todo', dueAt: '2026-11-01' });

    admin = await sessionUser(t, a);
    membre = await sessionUser(t, m);
  });
  afterAll(async () => t.close());

  it('grille de la méthode la plus utilisée, à sa taille, avec le nombre et les noms des risques de chaque case', async () => {
    const d = (await synthese(membre)).detailRisques!;
    expect(d.aApprecier).toBe(1);
    const g = d.grille!;
    expect(g.methode).toBe('Méthode fictive principale');
    expect(g.colonnes).toEqual(['Mineure', 'Significative', 'Grave']);
    expect(g.lignes).toEqual(['Peu probable', 'Probable']);
    expect(g.cases).toHaveLength(6);
    const caseDe = (colonne: number, ligne: number) => g.cases.find((c) => c.colonne === colonne && c.ligne === ligne)!;
    // RF-2 : son appréciation validée (g3, v2) l'emporte sur le brouillon plus récent.
    expect(caseDe(2, 1).n).toBe(2);
    expect(caseDe(2, 1).risques.map((r) => r.code)).toEqual(['RF-1', 'RF-2']);
    expect(caseDe(2, 1).risques[0]).toMatchObject({ id: ids['Risque fictif 1'], perimetre: A });
    expect(caseDe(1, 0).n).toBe(1);
    expect(caseDe(0, 0).n).toBe(0);
    expect(g.places).toBe(3);
    // Autre méthode : hors grille ; périmètre B : jamais compté pour le membre.
    expect(g.horsGrille).toBe(1);
    expect(d.critiques).toBe(2);
    expect(JSON.stringify(d)).not.toContain('Risque fictif B');
  });

  it('actions une par une : décompte par état au jour de Paris, les plus urgentes d’abord, hors occurrences', async () => {
    const p = (await synthese(membre)).planActions!;
    expect([p.total, p.enRetard, p.ceMois, p.autresOuvertes, p.closes]).toEqual([6, 1, 2, 2, 1]);
    expect(p.items.map((x) => [x.nom, x.etat])).toEqual([
      ['Action fictive en retard', 'retard'],
      ['Action fictive du jour', 'mois'],
      ['Action fictive du mois', 'mois'],
      ['Action fictive ouverte', 'ouverte'],
      ['Action fictive sans échéance', 'ouverte'],
      ['Action fictive close', 'close'],
    ]);
    expect(p.items[0]).toMatchObject({ id: ids['Action fictive en retard'], perimetre: A, echeance: '2026-11-20' });
  });

  it('administrateur : tous les périmètres lisibles', async () => {
    const s = await synthese(admin);
    expect(s.planActions!.total).toBe(7);
    expect(s.detailRisques!.grille!.places).toBe(4);
  });

  it('écran mural et droits insuffisants : aucun détail', async () => {
    const mur = await synthese(null);
    expect(mur.detailRisques).toBeNull();
    expect(mur.planActions).toBeNull();
    const sansPilotage = await synthese(membre, {
      can: (m: string, a: string) => m === 'ecarts' && a === 'lire',
    } as never);
    expect(sansPilotage.detailRisques).toBeNull();
    expect(sansPilotage.planActions).not.toBeNull();
    const sansEcarts = await synthese(membre, {
      can: (m: string, a: string) => m === 'pilotage' && a === 'lire',
    } as never);
    expect(sansEcarts.planActions).toBeNull();
    expect(sansEcarts.detailRisques).not.toBeNull();
  });
});
