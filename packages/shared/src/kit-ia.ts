/* Kit d'intégration IA (ISO/IEC 27001 et HDS) : contrôles internes de l'organisation, correspondances proposées et annexes
   de veille. Le kit se charge depuis l'interface (aucun contenu n'est versionné dans le dépôt) ; ce module valide ses
   fichiers, en tire un référentiel de bibliothèque et résout les indications de correspondance. Jamais de texte normatif :
   les contrôles sont des propositions de l'organisation (ADR 0055). */
import { z } from 'zod';
import type { LibraryFrameworkDefinition } from './grc.js';

const court = (n: number) => z.string().trim().min(1).max(n);
const facultatif = (n: number) => z.string().trim().max(n).nullish();
const PORTEES = z.enum(['external', 'business']);

export const KitControle = z.object({
  id: z.string().regex(/^IA-\d{3}$/, 'Identifiant de contrôle IA-nnn attendu.'),
  domain: court(120),
  title_fr: court(160),
  requirement_fr: z.string().trim().min(10).max(5000),
  audit_question_fr: facultatif(2000),
  evidence_expected_fr: facultatif(2000),
  eligible_scopes: z.array(PORTEES).min(1).max(2),
  default_priority_suggestion_fr: facultatif(40),
  proposed_owner_function_fr: facultatif(200),
  proposed_review_frequency_fr: facultatif(100),
  is_official_normative_text: z.literal(false, 'Un texte normatif ne s’importe pas par ce kit.'),
  source_links_raw: z
    .object({ iso27001: facultatif(300), hds: facultatif(300), iso42001_theme: facultatif(200) })
    .partial()
    .optional(),
});
export type KitControle = z.infer<typeof KitControle>;

export const KitCorrespondance = z.object({
  internal_control_id: z.string().regex(/^IA-\d{3}$/),
  target_reference_type: z.enum(['ISO27001', 'HDS_V2_0', 'ISO42001_THEME']),
  reference_hint_raw: court(300),
  explanation: facultatif(1000),
  normative_equivalence: z.literal(false).optional(),
});
export type KitCorrespondance = z.infer<typeof KitCorrespondance>;

export const KitAction = z.object({
  id: court(40),
  source_ref: court(40),
  suggestion_fr: z.string().trim().min(3).max(1000),
  initial_priority_fr: facultatif(40),
});
export const KitScenario = z.object({
  id: court(40),
  scenario_fr: z.string().trim().min(3).max(1000),
  risk_theme_fr: facultatif(300),
  candidate_measures_fr: facultatif(1000),
});
export const KitDelta = z.object({
  delta_id: court(60),
  draft_ref: court(200),
  theme_fr: court(300),
  proposed_change_fr: z.string().trim().max(3000),
  legal_basis_citation_fr: facultatif(500),
  legal_effective_date_from_source: facultatif(40),
  draft_status_note_fr: facultatif(1000),
  audit_question_fr: facultatif(1000),
  evidence_expected_fr: facultatif(1000),
  ans_draft_url: z
    .url()
    .refine((u) => new URL(u).protocol === 'https:')
    .nullish(),
  legal_reference_url: z
    .url()
    .refine((u) => new URL(u).protocol === 'https:')
    .nullish(),
  /** Un delta préparatoire n'est jamais une exigence en vigueur : le kit l'interdit, l'import le refuse. */
  import_as_enforceable_HDS_2_1_control: z.literal(
    false,
    'Un delta préparatoire n’est pas une exigence HDS en vigueur.',
  ),
});
export const KitMemoHds = z.object({
  id: z.string().regex(/^EXI \d{2}$/),
  thematic_memo_fr: facultatif(500),
  reference_memo_fr: facultatif(500),
  is_official_normative_quote: z.literal(false).optional(),
});
export const KitQuestion = z.object({
  id: z.string().regex(/^Q-IA-\d{2}$/),
  question_fr: z.string().trim().min(5).max(600),
  values: z.array(court(60)).min(1).max(12),
});
export const KitSource = z.object({
  title: court(300),
  type_fr: facultatif(200),
  url: z.url().refine((u) => new URL(u).protocol === 'https:'),
  qualification_fr: facultatif(1000),
});

/** Fichiers du kit, tels qu'ils sont chargés dans l'interface. Seuls les contrôles sont obligatoires. */
export const KitIaBundle = z
  .object({
    version: z.string().trim().min(1).max(60).default('non précisée'),
    controls: z.array(KitControle).min(1).max(300),
    correspondances: z.array(KitCorrespondance).max(3000).default([]),
    actions: z.array(KitAction).max(200).default([]),
    scenarios: z.array(KitScenario).max(200).default([]),
    deltas: z.array(KitDelta).max(100).default([]),
    memosHds: z.array(KitMemoHds).max(100).default([]),
    questionnaire: z.array(KitQuestion).max(40).default([]),
    sources: z.array(KitSource).max(100).default([]),
  })
  .superRefine((b, c) => {
    const ids = new Set(b.controls.map((x) => x.id));
    if (ids.size !== b.controls.length) c.addIssue({ code: 'custom', message: 'Identifiants de contrôle en double.' });
    for (const m of b.correspondances)
      if (!ids.has(m.internal_control_id))
        c.addIssue({ code: 'custom', message: `Correspondance vers un contrôle inconnu : ${m.internal_control_id}.` });
  });
export type KitIaBundle = z.infer<typeof KitIaBundle>;

export const KIT_IA_IDENTIFIANT = 'ia-controles-internes';
export const KIT_IA_NOM = 'Contrôles IA internes (ISO/IEC 27001 et HDS)';

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Clé de domaine : « 01 Gouvernance » → « ia_01_gouvernance ». */
export const cleDomaine = (domaine: string) =>
  (
    'ia_' +
    sansAccent(domaine)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  ).slice(0, 64);

const PORTEE_LIBELLE: Record<'external' | 'business', string> = {
  external: 'usage d’outils d’IA externes',
  business: 'IA intégrée aux applications métier',
};
/** Référentiel de bibliothèque tiré des contrôles : source « organisation », jamais normative ni vérifiée. */
export function kitVersReferentiel(b: KitIaBundle): LibraryFrameworkDefinition {
  const domaines = [...new Set(b.controls.map((c) => c.domain))].map((d) => ({
    id: cleDomaine(d),
    label: d.slice(0, 200),
  }));
  return {
    name: KIT_IA_NOM,
    identifier: KIT_IA_IDENTIFIANT,
    source: {
      organisation: 'Organisation',
      document: `Contrôles IA internes proposés — kit d’intégration IA (version ${b.version})`.slice(0, 300),
      url: 'https://cyber.gouv.fr/',
      version: b.version.slice(0, 100),
      date: '',
      license:
        'Contenu de l’organisation : propositions internes, qui ne reproduisent aucun texte normatif de l’ISO/IEC 27001, de l’ISO/IEC 42001 ni du référentiel HDS.',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    domains: domaines,
    requirements: b.controls.map((c) => ({
      id: c.id,
      domain: cleDomaine(c.domain),
      title: `${c.id} — ${c.title_fr}`.slice(0, 200),
      description: c.requirement_fr,
      applicability: `Périmètres éligibles : ${c.eligible_scopes.map((p) => PORTEE_LIBELLE[p]).join(' ; ')}.`,
      measureRefs: [],
      ...(c.audit_question_fr ? { auditQuestion: c.audit_question_fr } : {}),
      ...(c.evidence_expected_fr ? { expectedEvidence: c.evidence_expected_fr } : {}),
      eligibleScopes: c.eligible_scopes,
      ...(c.default_priority_suggestion_fr ? { priority: c.default_priority_suggestion_fr } : {}),
      ...(c.proposed_owner_function_fr ? { ownerFunction: c.proposed_owner_function_fr } : {}),
      ...(c.proposed_review_frequency_fr ? { reviewFrequency: c.proposed_review_frequency_fr } : {}),
      ...(c.source_links_raw?.iso42001_theme ? { themeIso42001: c.source_links_raw.iso42001_theme } : {}),
    })),
  };
}

/* --------------------------------------------------------------------------- résolution des indications */
export interface ExigenceCible {
  id: string;
  domain: string;
  title: string;
}
/** Numéros d'article d'une indication ISO : « §5.2 ; A.5.1 » → clause 5.2 et Annexe A 5.1. */
export function jetonsIso(indication: string): { annexe: string[]; clause: string[] } {
  const annexe = [...indication.matchAll(/\bA\.(\d{1,2}\.\d{1,2})\b/g)].map((m) => m[1]!);
  const clause = [
    ...indication.matchAll(/§\s*(\d{1,2}(?:\.\d{1,2}){0,2})(?:\s*[-–]\s*(\d{1,2}(?:\.\d{1,2}){0,2}))?/g),
  ].flatMap((m) => (m[2] ? [m[1]!, m[2]] : [m[1]!]));
  return { annexe: [...new Set(annexe)], clause: [...new Set(clause)] };
}
/** Numéros « EXI nn » d'une indication HDS : « EXI 02-04 si hébergeur » → 02, 03, 04. */
export function jetonsHds(indication: string): string[] {
  const m = /EXI\s*(\d{2})(?:\s*[-–]\s*(\d{2}))?/i.exec(indication);
  if (!m) return [];
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return Array.from({ length: Math.max(0, Math.min(b, a + 40) - a + 1) }, (_, i) => String(a + i).padStart(2, '0'));
}
const numero = (titre: string) => /^\s*(?:A[.-]\s*)?(\d{1,2}(?:\.\d{1,2}){0,2})\b/.exec(titre)?.[1] ?? null;
/** Exigences d'un référentiel ISO de la bibliothèque correspondant à un jeton : l'Annexe A se reconnaît à son domaine,
    les clauses aux leurs ; le numéro se lit en tête de l'intitulé (« 5.1 — … » ou « A.5.1 — … ») ou dans l'identifiant. */
export function cibleIso(exigences: readonly ExigenceCible[], type: 'annexe' | 'clause', jeton: string): string[] {
  return exigences
    .filter((e) => (type === 'annexe' ? /^annexe_a/.test(e.domain) : /^clause_/.test(e.domain)))
    .filter((e) => (numero(e.title) ?? numero(e.id)) === jeton)
    .map((e) => e.id);
}
export function cibleHds(exigences: readonly ExigenceCible[], jeton: string): string[] {
  const motif = new RegExp(`\\bEXI[\\s_-]*0*${Number(jeton)}\\b`, 'i');
  return exigences.filter((e) => motif.test(e.title) || motif.test(e.id)).map((e) => e.id);
}
