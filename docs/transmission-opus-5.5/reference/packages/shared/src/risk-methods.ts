import { z } from 'zod';
import { CfgRef } from './config-grc.js';
import { GRC_KINDS, GrcKey, OfficialSource } from './grc.js';
const named = z.object({ id: GrcKey, label: z.string().trim().min(1).max(200) }).strict();
const scale = z
  .array(named.extend({ value: z.number().finite().min(0).max(100000) }))
  .min(2)
  .max(20)
  .superRefine((a, c) => {
    if (new Set(a.map((x) => x.id)).size !== a.length || a.some((x, i) => i > 0 && x.value <= a[i - 1]!.value))
      c.addIssue({ code: 'custom', message: 'Niveaux uniques, valeurs strictement croissantes.' });
  });
/** Éléments du catalogue de configuration épinglés par la méthode (ADR 0038) : à la publication, le serveur résout ces
    références et fige une copie intégrée dans la définition ; le moteur d'évaluation n'utilise que cette copie. Facultatif :
    une méthode sans épinglage garde ses échelles et sa matrice intégrées. Les épinglages l'emportent sur les valeurs intégrées. */
export const MethodBindings = z
  .object({
    /** Dimension de la méthode → échelle (impact, gravité…) dont les niveaux la définissent. */
    dimensions: z.record(GrcKey, CfgRef).default({}),
    likelihood: CfgRef.optional(),
    /** Échelle des niveaux de risque : chaque niveau porte une couleur et une acceptabilité. */
    levels: CfgRef.optional(),
    /** Matrice de calcul (lignes = dimension désignée, colonnes = vraisemblance, résultat = niveaux de risque). */
    matrix: z.object({ ref: CfgRef, dimension: GrcKey }).strict().optional(),
  })
  .strict();
export type MethodBindings = z.infer<typeof MethodBindings>;
export const RiskMethod = z
  .object({
    bindings: MethodBindings.optional(),
    /** Types d'objets que la méthode mobilise (facultatif ; sans valeur, aucun type n'est imposé). */
    objects: z.array(z.enum(GRC_KINDS)).max(50).optional(),
    /** Livrables attendus, rattachés à une étape de la méthode (facultatif). */
    deliverables: z
      .array(named.extend({ stage: GrcKey, required: z.boolean() }))
      .max(100)
      .optional(),
    name: z.string().trim().min(1).max(200),
    family: z.enum(['ebios_rm', 'iso27005', 'mehari', 'custom']),
    description: z.string().max(10000),
    source: OfficialSource,
    stages: z
      .array(named.extend({ description: z.string().max(5000), requires: z.array(GrcKey).max(20) }))
      .min(1)
      .max(30),
    fields: z
      .array(
        named.extend({
          stage: GrcKey,
          type: z.enum(['text', 'longtext', 'number', 'date', 'choice', 'boolean', 'references']),
          required: z.boolean(),
          options: z.array(named).max(100),
        }),
      )
      .max(200),
    dimensions: z
      .array(named.extend({ levels: scale }))
      .min(1)
      .max(20),
    likelihood: scale,
    levels: z
      .array(
        named.extend({
          color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
          acceptability: z.enum(['acceptable', 'conditional', 'unacceptable']),
        }),
      )
      .min(2)
      .max(20),
    calculation: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('judgement') }).strict(),
      z
        .object({
          kind: z.literal('matrix'),
          dimension: GrcKey,
          cells: z
            .array(
              z
                .object({
                  impact: GrcKey,
                  likelihood: GrcKey,
                  level: GrcKey,
                  score: z.number().finite().min(0).max(1000000).nullable(),
                })
                .strict(),
            )
            .min(4)
            .max(400),
        })
        .strict(),
      z
        .object({
          kind: z.literal('lookup'),
          inputs: z.array(GrcKey).min(1).max(10),
          rules: z
            .array(
              z
                .object({
                  when: z.record(GrcKey, GrcKey),
                  level: GrcKey,
                  score: z.number().finite().min(0).max(1000000).nullable(),
                })
                .strict(),
            )
            .min(1)
            .max(10000),
        })
        .strict(),
    ]),
    strategies: z
      .array(named.extend({ kind: z.enum(['reduce', 'accept', 'transfer', 'avoid', 'treated']) }))
      .min(1)
      .max(20),
    reevaluation: z
      .object({
        months: z.number().int().min(1).max(120),
        triggers: z.array(z.string().min(1).max(300)).max(50),
        requireApproval: z.boolean(),
      })
      .strict(),
    display: z
      .object({
        groupings: z
          .array(z.enum(['domain', 'entity', 'scope', 'method', 'asset', 'process', 'scenario', 'security_domain']))
          .min(1)
          .max(8),
        defaultBasis: z.enum(['gross', 'residual']),
        showScores: z.boolean(),
        showAcceptability: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((m, c) => {
    const issue = (message: string) => c.addIssue({ code: 'custom', message });
    for (const rows of [m.stages, m.fields, m.dimensions, m.levels, m.strategies])
      if (new Set(rows.map((x) => x.id)).size !== rows.length) issue('Identifiants dupliqués.');
    const stages = new Set(m.stages.map((x) => x.id)),
      levels = new Set(m.levels.map((x) => x.id));
    for (const [i, s] of m.stages.entries())
      if (s.requires.some((r) => !m.stages.slice(0, i).some((x) => x.id === r)))
        issue('Une dépendance d’étape doit précéder cette étape.');
    if (
      m.fields.some(
        (f) =>
          !stages.has(f.stage) ||
          (f.type === 'choice' &&
            (f.options.length === 0 || new Set(f.options.map((x) => x.id)).size !== f.options.length)),
      )
    )
      issue('Champ/étape ou choix invalide.');
    if (m.deliverables) {
      if (new Set(m.deliverables.map((x) => x.id)).size !== m.deliverables.length) issue('Livrables dupliqués.');
      if (m.deliverables.some((d) => !stages.has(d.stage))) issue('Un livrable désigne une étape inconnue.');
    }
    if (m.objects && new Set(m.objects).size !== m.objects.length) issue('Types d’objets dupliqués.');
    if (m.family === 'ebios_rm' && m.stages.length !== 5) issue('EBIOS RM exige les cinq ateliers.');
    if (new Set(m.display.groupings).size !== m.display.groupings.length) issue('Regroupements dupliqués.');
    const calc = m.calculation;
    if (calc.kind === 'matrix') {
      const dimension = m.dimensions.find((x) => x.id === calc.dimension);
      if (!dimension) {
        issue('Dimension de calcul inconnue.');
        return;
      }
      const pairs = new Set<string>();
      for (const cell of calc.cells) {
        const key = cell.impact + '/' + cell.likelihood;
        if (
          pairs.has(key) ||
          !dimension.levels.some((x) => x.id === cell.impact) ||
          !m.likelihood.some((x) => x.id === cell.likelihood) ||
          !levels.has(cell.level)
        )
          issue('Cellule de matrice inconnue ou dupliquée.');
        pairs.add(key);
      }
      if (pairs.size !== dimension.levels.length * m.likelihood.length) issue('Matrice exhaustive requise.');
    }
    if (calc.kind === 'lookup') {
      if (
        new Set(calc.inputs).size !== calc.inputs.length ||
        calc.inputs.some(
          (k) =>
            k !== 'likelihood' &&
            !m.dimensions.some((x) => x.id === k) &&
            !m.fields.some((x) => x.id === k && x.type === 'choice'),
        )
      )
        issue('Entrées de règles inconnues.');
      const seen = new Set<string>();
      for (const r of calc.rules) {
        const k = calc.inputs.map((x) => r.when[x]).join('/');
        if (
          Object.keys(r.when).length !== calc.inputs.length ||
          calc.inputs.some(
            (x) =>
              !r.when[x] ||
              !(
                x === 'likelihood'
                  ? m.likelihood
                  : (m.dimensions.find((d) => d.id === x)?.levels ?? m.fields.find((f) => f.id === x)?.options ?? [])
              ).some((l) => l.id === r.when[x]),
          ) ||
          seen.has(k) ||
          !levels.has(r.level)
        )
          issue('Règle inconnue, incomplète ou dupliquée.');
        seen.add(k);
      }
    }
  });
export type RiskMethod = z.infer<typeof RiskMethod>;
export const MethodRating = z
  .object({
    dimensions: z.record(GrcKey, GrcKey),
    likelihood: GrcKey,
    level: GrcKey.nullable(),
    inputs: z.record(GrcKey, GrcKey),
  })
  .strict();
export type MethodRating = z.infer<typeof MethodRating>;
export const RiskRatings = z.object({ gross: MethodRating, residual: MethodRating }).strict();
export type RiskRatings = z.infer<typeof RiskRatings>;
export function evaluateMethod(method: RiskMethod, rating: MethodRating) {
  const m = RiskMethod.parse(method),
    r = MethodRating.parse(rating);
  if (
    Object.keys(r.dimensions).length !== m.dimensions.length ||
    m.dimensions.some((d) => !d.levels.some((l) => l.id === r.dimensions[d.id])) ||
    !m.likelihood.some((l) => l.id === r.likelihood)
  )
    throw new Error('Dimensions et vraisemblance doivent utiliser les niveaux de cette méthode.');
  let level: string | null = r.level,
    score: number | null = null;
  if (m.calculation.kind === 'matrix') {
    const cell = m.calculation.cells.find(
      (x) =>
        x.impact === r.dimensions[m.calculation.kind === 'matrix' ? m.calculation.dimension : ''] &&
        x.likelihood === r.likelihood,
    )!;
    level = cell.level;
    score = cell.score;
  } else if (m.calculation.kind === 'lookup') {
    if (
      Object.keys(r.inputs).some(
        (k) => !m.fields.some((f) => f.id === k && f.type === 'choice' && f.options.some((o) => o.id === r.inputs[k])),
      )
    )
      throw new Error('Entrée de calcul inconnue.');
    const values: Record<string, string> = { ...r.inputs, ...r.dimensions, likelihood: r.likelihood };
    const rule = m.calculation.rules.find(
      (rule) => m.calculation.kind === 'lookup' && m.calculation.inputs.every((k) => values[k] === rule.when[k]),
    );
    if (!rule) throw new Error('Aucune règle publiée ne couvre cette combinaison.');
    level = rule.level;
    score = rule.score;
  }
  const result = m.levels.find((l) => l.id === level);
  if (!result) throw new Error('Choisissez un niveau de risque explicite de cette méthode.');
  return { level: result.id, label: result.label, color: result.color, acceptability: result.acceptability, score };
}
/** Écart entre le niveau enregistré d'un risque et celui que donnerait la méthode courante (version publiée la plus récente). */
export interface EcartMatrice {
  etat: 'ecart' | 'non_comparable';
  versionEnregistree: number;
  versionCourante: number;
  enregistre: { brut: string | null; residuel: string | null };
  courant: { brut: string | null; residuel: string | null } | null;
}
type Resultat = Record<string, { level?: string; label?: string } | undefined>;
/** Compare, sans rien modifier, les niveaux enregistrés (le registre fait foi) à ceux que donneraient les mêmes
    cotations avec la version courante de la méthode. `null` : même version, ou mêmes niveaux. `non_comparable` : les
    échelles ont changé au point que les cotations enregistrées n'existent plus dans la méthode courante. */
export function ecartMatriceCourante(args: {
  result: Resultat;
  ratings: unknown;
  versionEnregistree: number;
  courante: { version: number; definition: RiskMethod };
}): EcartMatrice | null {
  const { result, versionEnregistree, courante } = args;
  if (versionEnregistree >= courante.version) return null;
  const label = (k: 'gross' | 'residual') => result[k]?.label ?? result[k]?.level ?? null;
  const base = {
    versionEnregistree,
    versionCourante: courante.version,
    enregistre: { brut: label('gross'), residuel: label('residual') },
  };
  const parsed = RiskRatings.safeParse(args.ratings);
  if (!parsed.success) return { etat: 'non_comparable', ...base, courant: null };
  try {
    const gross = evaluateMethod(courante.definition, parsed.data.gross);
    const residual = evaluateMethod(courante.definition, parsed.data.residual);
    const different =
      (result.gross?.level !== undefined && result.gross.level !== gross.level) ||
      (result.residual?.level !== undefined && result.residual.level !== residual.level);
    return different ? { etat: 'ecart', ...base, courant: { brut: gross.label, residuel: residual.label } } : null;
  } catch {
    return { etat: 'non_comparable', ...base, courant: null };
  }
}
/** Modèles organisationnels à relire et publier ; aucun contenu normatif sous licence n’est reproduit. */
export function methodTemplate(family: RiskMethod['family']): RiskMethod {
  const names = {
    ebios_rm: 'EBIOS Risk Manager — ateliers',
    iso27005: 'ISO/IEC 27005 — politique d’appréciation',
    mehari: 'MÉHARI — politique à adapter',
    custom: 'Méthode personnalisée',
  };
  const titles = {
    ebios_rm: [
      'Cadrage et socle de sécurité',
      'Sources de risque',
      'Scénarios stratégiques',
      'Scénarios opérationnels',
      'Traitement du risque',
    ],
    iso27005: [
      'Contexte et critères',
      'Identification',
      'Analyse',
      'Évaluation et traitement',
      'Surveillance et revue',
    ],
    mehari: [
      'Enjeux et classification',
      'Diagnostic des services de sécurité',
      'Analyse des scénarios',
      'Traitement et suivi',
    ],
    custom: ['Appréciation', 'Traitement et revue'],
  };
  const stages = titles[family].map((label, i) => ({
    id: `stage_${i + 1}`,
    label,
    description: 'Adapter les critères, données attendues et validations à votre SMSI.',
    requires: i ? [`stage_${i}`] : [],
  }));
  const levels = [
    { id: 'low', label: 'Faible', color: '#718975', acceptability: 'acceptable' as const },
    { id: 'medium', label: 'Modéré', color: '#9A8B64', acceptability: 'conditional' as const },
    { id: 'high', label: 'Élevé', color: '#A36F65', acceptability: 'unacceptable' as const },
  ];
  const severity = ['Mineur', 'Significatif', 'Grave', 'Critique'].map((label, i) => ({
    id: `impact_${i + 1}`,
    label,
    value: i + 1,
  }));
  const likelihood = ['Peu probable', 'Possible', 'Probable', 'Très probable'].map((label, i) => ({
    id: `likelihood_${i + 1}`,
    label,
    value: i + 1,
  }));
  const sourceUrls = {
    ebios_rm: 'https://messervices.cyber.gouv.fr/guides/la-methode-ebios-risk-manager-le-guide',
    iso27005: 'https://www.iso.org/standard/80585.html',
    mehari: 'https://clusif.fr/services/management-des-risques/les-fondamentaux-de-mehari/',
    custom: 'https://example.invalid/politique-interne',
  };
  return {
    name: names[family],
    family,
    description: 'Proposition organisationnelle à adapter et valider, sans présomption de conformité ni labellisation.',
    source: {
      organisation:
        family === 'ebios_rm'
          ? 'ANSSI'
          : family === 'iso27005'
            ? 'ISO'
            : family === 'mehari'
              ? 'CLUSIF'
              : 'Organisation',
      document: names[family],
      url: sourceUrls[family],
      version: family === 'iso27005' ? '2022' : 'À préciser',
      date: '',
      license: 'Référence publique ; aucun texte normatif reproduit. Vérifier les droits de tout contenu importé.',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    stages,
    fields: [
      ...stages.map((s) => ({
        id: `notes_${s.id}`,
        label: 'Analyse et justification',
        stage: s.id,
        type: 'longtext' as const,
        required: true,
        options: [],
      })),
      ...(family === 'ebios_rm'
        ? [
            {
              id: 'business_values',
              label: 'Valeurs métier',
              stage: 'stage_1',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'support_assets',
              label: 'Biens supports',
              stage: 'stage_1',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'feared_events',
              label: 'Événements redoutés et gravité',
              stage: 'stage_1',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'security_baseline',
              label: 'Socle de sécurité et écarts',
              stage: 'stage_1',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'risk_sources',
              label: 'Sources de risque et objectifs visés',
              stage: 'stage_2',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'ecosystem',
              label: 'Parties prenantes de l’écosystème',
              stage: 'stage_3',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'strategic_scenarios',
              label: 'Scénarios stratégiques',
              stage: 'stage_3',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'operational_scenarios',
              label: 'Scénarios opérationnels et chemins d’attaque',
              stage: 'stage_4',
              type: 'references' as const,
              required: false,
              options: [],
            },
            {
              id: 'treatment_measures',
              label: 'Mesures et plan de traitement',
              stage: 'stage_5',
              type: 'references' as const,
              required: false,
              options: [],
            },
          ]
        : family === 'mehari'
          ? [
              {
                id: 'stakes',
                label: 'Classification des enjeux',
                stage: 'stage_1',
                type: 'longtext' as const,
                required: false,
                options: [],
              },
              {
                id: 'services',
                label: 'Diagnostic des services de sécurité',
                stage: 'stage_2',
                type: 'references' as const,
                required: false,
                options: [],
              },
              {
                id: 'scenarios',
                label: 'Scénarios de risque',
                stage: 'stage_3',
                type: 'references' as const,
                required: false,
                options: [],
              },
              {
                id: 'plans',
                label: 'Plans et décisions de traitement',
                stage: 'stage_4',
                type: 'references' as const,
                required: false,
                options: [],
              },
            ]
          : family === 'iso27005'
            ? [
                {
                  id: 'criteria',
                  label: 'Critères d’appréciation et d’acceptation',
                  stage: 'stage_1',
                  type: 'longtext' as const,
                  required: false,
                  options: [],
                },
                {
                  id: 'assets',
                  label: 'Actifs et événements à considérer',
                  stage: 'stage_2',
                  type: 'references' as const,
                  required: false,
                  options: [],
                },
                {
                  id: 'treatments',
                  label: 'Options et plan de traitement',
                  stage: 'stage_4',
                  type: 'references' as const,
                  required: false,
                  options: [],
                },
              ]
            : []),
    ],
    dimensions: [{ id: 'severity', label: 'Gravité', levels: severity }],
    likelihood,
    levels,
    calculation:
      family === 'ebios_rm'
        ? {
            kind: 'matrix',
            dimension: 'severity',
            cells: severity.flatMap((i, index) =>
              likelihood.map((p, j) => ({
                impact: i.id,
                likelihood: p.id,
                level: index + j >= 5 ? 'high' : index + j >= 2 ? 'medium' : 'low',
                score: null,
              })),
            ),
          }
        : { kind: 'judgement' },
    strategies: [
      { id: 'reduce', label: 'Réduire', kind: 'reduce' },
      { id: 'accept', label: 'Accepter', kind: 'accept' },
      { id: 'transfer', label: 'Transférer', kind: 'transfer' },
      { id: 'avoid', label: 'Éviter', kind: 'avoid' },
      { id: 'treated', label: 'Traité', kind: 'treated' },
    ],
    reevaluation: {
      months: 12,
      triggers: ['Modification du périmètre', 'Incident', 'Évolution des mesures'],
      requireApproval: true,
    },
    display: {
      groupings: ['domain', 'entity', 'scope', 'method', 'asset', 'process', 'scenario', 'security_domain'],
      defaultBasis: 'residual',
      showScores: false,
      showAcceptability: true,
    },
  };
}
