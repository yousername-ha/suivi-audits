/* Kit d'intégration IA (ADR 0055) : aperçu, import idempotent, correspondances proposées, annexes « à revérifier ».
   Toutes les données sont fictives : le kit réel ne figure jamais dans le dépôt. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent;
const source = {
  organisation: 'Organisation fictive',
  document: 'Document de recette',
  url: 'https://example.invalid/recette',
  version: '1',
  date: '2026-10-21',
  license: 'Données fictives de test',
  verifiedAt: '',
  normative: false,
  status: 'organisation' as const,
};
const iso: FrameworkDefinition = {
  name: 'ISO fictif',
  identifier: 'iso-27001-fictif',
  source,
  domains: [
    { id: 'clause_5', label: 'Clause 5' },
    { id: 'annexe_a_5', label: 'Annexe A 5' },
  ],
  requirements: [
    { id: 'C5-2', domain: 'clause_5', title: '5.2 — Politique', description: '', applicability: '', measureRefs: [] },
    {
      id: 'A5-1',
      domain: 'annexe_a_5',
      title: '5.1 — Politiques',
      description: '',
      applicability: '',
      measureRefs: [],
    },
  ],
};
const hds: FrameworkDefinition = {
  name: 'HDS fictif',
  identifier: 'hds-fictif',
  source,
  domains: [{ id: 'exi', label: 'Exigences' }],
  requirements: ['01', '02', '03'].map((n) => ({
    id: `EXI_${n}`,
    domain: 'exi',
    title: `EXI ${n} — Thème fictif`,
    description: '',
    applicability: '',
    measureRefs: [],
  })),
};
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
  correspondances: [
    { internal_control_id: 'IA-001', target_reference_type: 'ISO27001', reference_hint_raw: '§5.2 ; A.5.1' },
    { internal_control_id: 'IA-001', target_reference_type: 'HDS_V2_0', reference_hint_raw: 'EXI 02-03 si hébergeur' },
    { internal_control_id: 'IA-002', target_reference_type: 'ISO27001', reference_hint_raw: 'A.9.9' },
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

async function publier(def: FrameworkDefinition) {
  const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: def });
  const r = await admin.post(
    '/api/library/frameworks/publish',
    { id: null, definition: def, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}

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
    const inconnu = {
      ...kit(),
      correspondances: [
        { internal_control_id: 'IA-099', target_reference_type: 'ISO27001', reference_hint_raw: '§5.2' },
      ],
    };
    expect((await apercu(inconnu)).statusCode).toBe(422);
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

  it('sans ISO ni HDS en bibliothèque : tout est non résolu, rien n’est inventé', async () => {
    const p = (await apercu(kit())).json();
    expect(p.controles).toBe(2);
    expect(p.correspondances.resolues).toBe(0);
    expect(p.correspondances.themesIso42001).toBe(1);
    expect(p.correspondances.nonResolues.length).toBe(3);
    expect(p.avertissements.join(' ')).toMatch(/revérifier/);
    expect(p.annexes.deltas).toBe(1);
  });

  it('importe le référentiel puis, une fois ISO et HDS présents, rattache les correspondances « proposées »', async () => {
    const k = kit();
    const p1 = (await apercu(k)).json();
    const r1 = await importer(k, p1.referentiel.previewId);
    expect(r1.statusCode, r1.body).toBe(200);
    expect(r1.json().statut).toBe('importe');
    expect(r1.json().mappings).toBe(0);
    // Rejeu à l'identique : rien ne s'écrit de plus.
    const p2 = (await apercu(k)).json();
    expect(p2.dejaImporte).toBe(true);
    const r2 = await importer(k, p2.referentiel.previewId);
    expect(r2.json().statut).toBe('deja_importe');

    await publier(iso);
    await publier(hds);
    const p3 = (await apercu(k)).json();
    // IA-001 : §5.2 (clause), A.5.1 (annexe), EXI 02 et 03 ; IA-002 : A.9.9 ne correspond à rien.
    expect(p3.correspondances.resolues).toBe(4);
    expect(p3.correspondances.nouvelles).toBe(4);
    expect(p3.correspondances.nonResolues.map((x: { indication: string }) => x.indication)).toEqual(['A.9.9']);
    expect(p3.dejaImporte).toBe(false);
    expect(p3.referentiel.identique).toBe(true);
    const r3 = await importer(k, p3.referentiel.previewId);
    expect(r3.statusCode, r3.body).toBe(200);
    expect(r3.json().mappings).toBe(4);
    expect(r3.json().version).toBe(1); // le rejeu après import tardif ne republie pas le référentiel

    const fw = r3.json().frameworkId as string;
    const liste = (await admin.get(`/api/library/mappings?frameworkId=${fw}`)).json() as {
      status: string;
      origin: string;
      coverage: number;
    }[];
    expect(liste.length).toBe(4);
    expect(liste.every((m) => m.status === 'proposed' && m.coverage === 0)).toBe(true);

    // Nouveau rejeu : plus rien à rattacher.
    const p4 = (await apercu(k)).json();
    expect(p4.dejaImporte).toBe(true);
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
