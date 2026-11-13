/* Kit d'intégration IA (ADR 0055) : aperçu, import idempotent, annexes « à revérifier » ; les correspondances du kit ne sont
   plus importées (ADR 0089, lot 3).
   Toutes les données sont fictives : le kit réel ne figure jamais dans le dépôt. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent;
const controle = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `IA-${String(n).padStart(3, '0')}`,
  domain: '01 Gouvernance',
  title_fr: `Contrôle fictif ${n}`,
  requirement_fr: 'Le service décrit son usage de l’IA et en désigne un responsable.',
  audit_question_fr: 'Qui est le responsable ?',
  evidence_expected_fr: 'Fiche de service',
  eligible_scopes: ['external', 'business'],
  default_priority_suggestion_fr: 'Haute',
  is_official_normative_text: false,
  ...extra,
});
const kit = () => ({
  version: 'fictif-1',
  controls: [controle(1), controle(2, { eligible_scopes: ['external'] })],
  // Fichier de correspondances d'un ancien kit : toléré, ignoré.
  correspondances: [
    { internal_control_id: 'IA-001', target_reference_type: 'ISO27001', reference_hint_raw: '§5.2 ; A.5.1' },
    { internal_control_id: 'IA-002', target_reference_type: 'ISO42001_THEME', reference_hint_raw: 'Gouvernance IA' },
  ],
  deltas: [
    {
      delta_id: 'D-1',
      draft_ref: 'Projet fictif',
      theme_fr: 'Thème',
      proposed_change_fr: 'Évolution préparatoire',
      import_as_enforceable_HDS_2_1_control: false,
    },
  ],
  sources: [{ title: 'Source fictive', url: 'https://example.invalid/source' }],
});
const apercu = (k: unknown) => admin.post('/api/library/ia-kit/preview', { kit: k });
const importer = (k: unknown, previewId: string) =>
  admin.post('/api/library/ia-kit/import', { kit: k, previewId, reason: 'Import du kit fictif', confirm: 'IMPORTER' });

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'kit_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'kit_lecteur', 'ro'));
});
afterAll(async () => t.close());

describe('kit IA', () => {
  it('refuse un kit invalide, un texte normatif et un delta importé comme exigence', async () => {
    expect((await apercu({ controls: [] })).statusCode).toBe(422);
    const normatif = { ...kit(), controls: [controle(1, { is_official_normative_text: true })] };
    expect((await apercu(normatif)).statusCode).toBe(422);
    const delta = { ...kit(), deltas: [{ ...kit().deltas[0], import_as_enforceable_HDS_2_1_control: true }] };
    expect((await apercu(delta)).statusCode).toBe(422);
    const doublon = { ...kit(), controls: [controle(1), controle(1)] };
    expect((await apercu(doublon)).statusCode).toBe(422);
  });

  it('refuse le caractère nul, que PostgreSQL ne saurait pas stocker dans les annexes', async () => {
    const k = { ...kit(), actions: [{ id: 'A1', source_ref: 'S1', suggestion_fr: 'Action\u0000piégée' }] };
    const r = await apercu(k);
    expect(r.statusCode).toBe(422);
    expect(r.body).toMatch(/nul/);
  });

  it('réserve l’aperçu et l’import aux personnes qui modifient la conformité', async () => {
    expect((await lecteur.post('/api/library/ia-kit/preview', { kit: kit() })).statusCode).toBe(403);
    const p = await apercu(kit());
    expect(p.statusCode, p.body).toBe(200);
    const r = await lecteur.post('/api/library/ia-kit/import', {
      kit: kit(),
      previewId: p.json().referentiel.previewId,
      reason: 'Tentative non autorisée',
      confirm: 'IMPORTER',
    });
    expect(r.statusCode).toBe(403);
  });

  it('l’aperçu ne parle plus de correspondances et ne rattache rien à l’ISO ni à l’HDS', async () => {
    const p = (await apercu(kit())).json();
    expect(p.controles).toBe(2);
    expect(p).not.toHaveProperty('correspondances');
    expect(JSON.stringify(p.avertissements)).not.toMatch(/correspondance/i);
    expect(p.avertissements.join(' ')).toMatch(/revérifier/);
    expect(p.annexes.deltas).toBe(1);
  });

  it('importe le référentiel et les annexes, sans correspondance, puis reste idempotent', async () => {
    const k = kit();
    const p1 = (await apercu(k)).json();
    const r1 = await importer(k, p1.referentiel.previewId);
    expect(r1.statusCode, r1.body).toBe(200);
    expect(r1.json().statut).toBe('importe');
    expect(r1.json().controles).toBe(2);
    expect(r1.json()).not.toHaveProperty('mappings');
    // Rejeu à l'identique : rien ne s'écrit de plus.
    const p2 = (await apercu(k)).json();
    expect(p2.dejaImporte).toBe(true);
    const r2 = await importer(k, p2.referentiel.previewId);
    expect(r2.json().statut).toBe('deja_importe');
    // Les routes de correspondances ont disparu.
    expect((await admin.get('/api/library/mappings')).statusCode).toBe(404);
  });

  it('garde les annexes de veille « à revérifier » et ne fait pas du delta une exigence', async () => {
    const d = (await admin.get('/api/library/ia-kit')).json();
    expect(d.importe).toBe(true);
    expect(d.statutJuridique).toBe('a_reverifier');
    expect(d.annexes.deltas).toHaveLength(1);
    expect(d.annexes.deltas[0].import_as_enforceable_HDS_2_1_control).toBe(false);
    const fw = (await admin.get('/api/library/frameworks')).json() as {
      identifier: string;
      requirements?: unknown[];
    }[];
    expect(fw.some((f) => f.identifier === 'ia-controles-internes')).toBe(true);
  });

  it('refuse un import dont l’aperçu est périmé ou non confirmé', async () => {
    const k = { ...kit(), version: 'fictif-2', controls: [controle(1), controle(2), controle(3)] };
    const p = (await apercu(k)).json();
    const perime = await importer(k, 'aperçu-périmé');
    expect(perime.statusCode).toBe(422);
    const sansConfirmer = await admin.post('/api/library/ia-kit/import', {
      kit: k,
      previewId: p.referentiel.previewId,
      reason: 'Import du kit fictif',
      confirm: 'oui',
    });
    expect(sansConfirmer.statusCode).toBe(422);
  });
});
