/* Gestion des risques (lot U3, ADR 0027) : registre commun (colonnes utiles, filtres côté serveur, état
   d'acceptation) et vue d'une étude EBIOS RM par atelier (objets rattachés, calculs d'aide à la décision,
   validations d'ateliers). Lecture seule ; toutes les écritures passent par les objets GRC et les décisions. */
import {
  EBIOS_ATELIERS,
  ecartMatriceCourante,
  etatAcceptation,
  graviteProposee,
  indiceMenace,
  MappingDefinition,
  ScaleDefinition,
  StudyConfiguration,
  type EtatAcceptation,
  type GrcKind,
  type RiskMethod,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Grc } from './core.js';

export interface FiltresRegistre {
  demarche?: 'ebios_rm' | 'iso27005' | 'mehari' | 'custom';
  strategie?: string;
  acceptation?: EtatAcceptation;
  enRetard?: boolean;
  ecart?: boolean;
  etude?: string;
  recherche?: string;
}

interface Ligne {
  id: string;
  name: string;
  version: number;
  data: Record<string, unknown>;
  family: string | null;
  evaluation: {
    result: Record<string, { label?: string; level?: string; acceptability?: string }>;
    decision: string;
    ratings: unknown;
    methodId: string;
    methodVersion: number;
  } | null;
  acceptance: { result: string; until: string | null; date: string; by: string } | null;
}

const jour = () => new Date().toISOString().slice(0, 10);
/** Définition d'une version de configuration (échelle, correspondance). */
const definitionCfg = async (k: Kdb, ref: { item: string; version: number }) =>
  (
    await k
      .selectFrom('cfg_versions')
      .select('definition')
      .where('item_id', '=', ref.item)
      .where('version', '=', ref.version)
      .executeTakeFirst()
  )?.definition;

/** Registre des risques du périmètre (500 au plus, filtres appliqués côté serveur). */
export async function registreRisques(g: Grc, smsi: string, user: SessionUser, f: FiltresRegistre) {
  await g.access(smsi, user);
  await g.permission(user, 'pilotage', 'lire');
  const motif = '%' + (f.recherche ?? '').replace(/[\\%_]/g, '\\$&') + '%';
  // Sous-requêtes corrélées et chemins jsonb : SQL paramétré (ADR 0062 § 5), filtres liés.
  const rows = (
    await g.db.q<Ligne>(
      `SELECT o.id,o.name,o.version,o.data,m.definition->>'family' AS family,
        (SELECT jsonb_build_object('result',e.result,'decision',e.decision,'ratings',e.ratings,'methodId',mv.method_id,'methodVersion',mv.version)
          FROM grc_risk_evaluations e JOIN grc_method_versions mv ON mv.id=e.method_version_id
          WHERE e.risk_id=o.id ORDER BY (e.decision='approved') DESC,e.revision DESC LIMIT 1) AS evaluation,
        (SELECT jsonb_build_object('result',d.result,'until',d.terms->>'until','date',d.performed_on::text,'by',d.created_by)
          FROM pilotage_decisions d WHERE d.smsi_id=o.smsi_id AND d.source_ref='object:'||o.id AND d.operation='risk_acceptance'
          ORDER BY d.created_at DESC,d.id DESC LIMIT 1) AS acceptance
       FROM grc_objects o
       LEFT JOIN grc_method_versions m ON m.smsi_id=o.smsi_id AND m.method_id::text=o.data->>'methodId'
         AND m.version=NULLIF(o.data->>'methodVersion','')::int
       WHERE o.smsi_id=$1 AND o.kind='risk' AND NOT o.archived AND (o.name ILIKE $2 OR COALESCE(o.data->>'code','') ILIKE $2)
         AND ($3::text IS NULL OR m.definition->>'family'=$3) AND ($4::text IS NULL OR o.data->>'strategy'=$4)
         AND ($5::text IS NULL OR o.data->>'studyRef'=$5)
       ORDER BY o.name,o.id LIMIT 500`,
      [smsi, motif, f.demarche ?? null, f.strategie ?? null, f.etude ? 'object:' + f.etude : null],
    )
  ).rows;
  const aujourdhui = jour();
  // Version la plus récente de chaque méthode utilisée : « matrice courante » à laquelle on compare, sans rien recalculer.
  const methodes = [...new Set(rows.flatMap((r) => (r.evaluation ? [r.evaluation.methodId] : [])))];
  const courantes = new Map(
    methodes.length
      ? (
          await g.db.k
            .selectFrom('grc_method_versions')
            .select(['method_id as methodId', 'version', 'definition'])
            .distinctOn('method_id')
            .where('smsi_id', '=', smsi)
            .where('method_id', 'in', methodes)
            .orderBy('method_id')
            .orderBy('version', 'desc')
            .execute()
        ).map((m) => [m.methodId, { version: m.version, definition: m.definition as RiskMethod }] as const)
      : [],
  );
  const items = rows
    .map((r) => {
      const res = r.evaluation?.result ?? {};
      const acceptation = etatAcceptation(String(r.data.strategy ?? ''), r.acceptance, aujourdhui);
      const revue = typeof r.data.reviewAt === 'string' ? r.data.reviewAt : null;
      return {
        id: r.id,
        name: r.name,
        version: r.version,
        code: String(r.data.code ?? ''),
        demarche: r.family,
        strategie: String(r.data.strategy ?? ''),
        ownerId: (r.data.ownerId as string | null) ?? null,
        brut: res.gross?.label ?? null,
        residuel: res.residual?.label ?? null,
        acceptabilite: res.residual?.acceptability ?? null,
        appreciationValidee: r.evaluation?.decision === 'approved',
        acceptation,
        decisionAcceptation: r.acceptance,
        prochaineRevue: revue,
        enRetard: !!revue && revue < aujourdhui,
        etude: typeof r.data.studyRef === 'string' ? r.data.studyRef : null,
        /** Le niveau enregistré fait foi ; l'écart avec la matrice courante est seulement signalé (ADR 0052). */
        ecartMatrice: (() => {
          const courante = r.evaluation && courantes.get(r.evaluation.methodId);
          return r.evaluation && courante
            ? ecartMatriceCourante({
                result: r.evaluation.result,
                ratings: r.evaluation.ratings,
                versionEnregistree: r.evaluation.methodVersion,
                courante,
              })
            : null;
        })(),
      };
    })
    .filter(
      (x) =>
        (!f.acceptation || x.acceptation === f.acceptation) &&
        (!f.enRetard || x.enRetard) &&
        (!f.ecart || x.ecartMatrice !== null),
    );
  return { items, tronque: rows.length >= 500 };
}

/** Vue d'une étude EBIOS RM : objets de chaque atelier (selon les droits), calculs et validations. */
export async function etudeEbios(g: Grc, smsi: string, id: string, user: SessionUser) {
  const etude = await g.object(smsi, id, user);
  if (etude.kind !== 'risk_study') throw new HttpError(422, 'Étude EBIOS RM attendue.');
  const ref = 'object:' + id;
  const kinds = [...new Set(EBIOS_ATELIERS.flatMap((a) => a.kinds as readonly GrcKind[]))];
  type Objet = {
    id: string;
    kind: GrcKind;
    name: string;
    version: number;
    data: Record<string, unknown>;
    updatedAt: string;
  };
  const objets = (await g.db.k
    .selectFrom('grc_objects')
    .select(['id', 'kind', 'name', 'version', 'data', 'updated_at as updatedAt'])
    .where('smsi_id', '=', smsi)
    .where('archived', '=', false)
    .where('kind', 'in', kinds)
    .where(sql<string>`data->>'studyRef'`, '=', ref)
    .orderBy('kind')
    .orderBy('name')
    .orderBy('id')
    .limit(2000)
    .execute()) as unknown as Objet[];
  // Sources de la bibliothèque de risques (sans étude propriétaire) référencées par les couples de l'étude : lues, pas copiées.
  const propres = new Set(objets.map((o) => o.id));
  const idsBibliotheque = [
    ...new Set(
      objets
        .filter((o) => o.kind === 'sr_ov' && typeof o.data.sourceRef === 'string')
        .map((o) => String(o.data.sourceRef).replace(/^object:/, ''))
        .filter((id) => /^[0-9a-f-]{36}$/.test(id) && !propres.has(id)),
    ),
  ];
  const bibliotheque = idsBibliotheque.length
    ? ((await g.db.k
        .selectFrom('grc_objects')
        .select(['id', 'kind', 'name', 'version', 'data', 'updated_at as updatedAt', 'archived'])
        .where('smsi_id', '=', smsi)
        .where('kind', '=', 'risk_source')
        .where('id', 'in', idsBibliotheque)
        .where(sql<string>`COALESCE(data->>'studyRef','')`, '=', '')
        .execute()) as unknown as (Objet & { archived: boolean })[])
    : [];
  const versionsBibliotheque = new Map(bibliotheque.map((o) => ['object:' + o.id, o.version]));
  objets.push(...bibliotheque);
  const parId = new Map(objets.map((o) => ['object:' + o.id, o]));
  const gravites = await libellesGravite(g, etude.data.configuration);
  const echelles = await libellesEchellesScenario(g, etude.data.configuration);
  const enrichi = objets.map((o) => {
    const calcul: Record<string, unknown> = {};
    if (versionsBibliotheque.has('object:' + o.id)) calcul.bibliotheque = true;
    if (o.kind === 'sr_ov') {
      const courante = versionsBibliotheque.get(String(o.data.sourceRef ?? ''));
      const choisie = typeof o.data.sourceVersion === 'number' ? o.data.sourceVersion : null;
      // Source de la bibliothèque modifiée depuis le choix du couple : à relire, rien n'est changé en silence.
      if (courante !== undefined) calcul.sourceModifiee = choisie === null || courante > choisie ? courante : null;
    }
    if (o.kind === 'feared_event' && typeof o.data.severityLevel === 'string')
      calcul.graviteCatalogue = gravites.get(o.data.severityLevel) ?? null;
    if (o.kind === 'ecosystem_party') calcul.menace = indiceMenace(o.data as Parameters<typeof indiceMenace>[0]);
    if (o.kind === 'strategic_scenario' && typeof o.data.severityLevel === 'string')
      calcul.graviteScenarioCatalogue = echelles.gravite.get(o.data.severityLevel) ?? null;
    if (o.kind === 'operational_scenario' && typeof o.data.likelihoodLevel === 'string')
      calcul.vraisemblanceCatalogue = echelles.vraisemblance.get(o.data.likelihoodLevel) ?? null;
    if (o.kind === 'strategic_scenario') {
      const refs = Array.isArray(o.data.fearedEventRefs) ? (o.data.fearedEventRefs as string[]) : [];
      calcul.graviteProposee = graviteProposee(
        refs.map((r) => {
          const ev = parId.get(r);
          return typeof ev?.data.gravity === 'number' ? ev.data.gravity : null;
        }),
      );
    }
    return { ...o, calcul };
  });
  const validations = (await g.db.k
    .selectFrom('pilotage_decisions')
    .select([
      'step',
      'result',
      sql<string>`performed_on::text`.as('date'),
      'created_by as by',
      'source_version as sourceVersion',
      'created_at as at',
    ])
    .where('smsi_id', '=', smsi)
    .where('source_ref', '=', ref)
    .where('operation', '=', 'step_validation')
    .orderBy('created_at')
    .execute()) as unknown as {
    step: string;
    result: string;
    date: string;
    by: string;
    sourceVersion: number;
    at: string;
  }[];
  return {
    etude,
    ateliers: EBIOS_ATELIERS.map((a) => {
      const objetsAtelier = enrichi.filter((o) => (a.kinds as readonly string[]).includes(o.kind));
      const courantes = validations.filter((v) => v.step === a.id && v.sourceVersion === etude.version);
      const derniere = courantes.at(-1);
      // Un élément modifié (ou ajouté) après la dernière validation la rend caduque : jamais de faux « validé ».
      const modifie =
        !!derniere && objetsAtelier.some((o) => new Date(o.updatedAt).getTime() > new Date(derniere.at).getTime());
      return {
        id: a.id,
        label: a.label,
        aide: a.aide,
        kinds: a.kinds,
        objets: objetsAtelier,
        valide: !!derniere && !modifie,
        modifieDepuisValidation: modifie,
        validations: validations.filter((v) => v.step === a.id),
      };
    }),
  };
}

/** Libellés des niveaux des échelles de vraisemblance et de gravité des scénarios épinglées par l'étude (vides sans liaison). */
async function libellesEchellesScenario(g: Grc, configuration: unknown) {
  const conf = StudyConfiguration.safeParse(configuration);
  const lire = async (ref: { item: string; version: number } | null | undefined) => {
    const noms = new Map<string, string>();
    if (!ref) return noms;
    const echelle = ScaleDefinition.safeParse(await definitionCfg(g.db.k, ref));
    if (echelle.success) for (const l of echelle.data.levels) noms.set(l.id, l.label);
    return noms;
  };
  return {
    vraisemblance: await lire(conf.success ? conf.data.likelihoodScale : null),
    gravite: await lire(conf.success ? conf.data.scenarioSeverityScale : null),
  };
}

/** Libellés des niveaux de gravité de l'échelle d'arrivée de la correspondance épinglée par l'étude (vide sans liaison). */
async function libellesGravite(g: Grc, configuration: unknown) {
  const noms = new Map<string, string>();
  const conf = StudyConfiguration.safeParse(configuration);
  if (!conf.success || !conf.data.severityMapping) return noms;
  const def = (ref: { item: string; version: number }) => definitionCfg(g.db.k, ref);
  const mapping = MappingDefinition.safeParse(await def(conf.data.severityMapping));
  if (!mapping.success) return noms;
  const echelle = ScaleDefinition.safeParse(await def(mapping.data.to));
  if (echelle.success) for (const l of echelle.data.levels) noms.set(l.id, l.label);
  return noms;
}

/** Bibliothèque partagée des sources de risque du périmètre : sources sans étude propriétaire, réutilisables par toutes les
    études par référence, avec le nombre de couples qui s'y rattachent. Les cotations restent propres à chaque étude. */
export async function bibliothequeSources(g: Grc, smsi: string, user: SessionUser) {
  await g.access(smsi, user);
  await g.permission(user, 'pilotage', 'lire');
  // Décomptes corrélés sur chemins jsonb : SQL paramétré (ADR 0062 § 5).
  const rows = (
    await g.db.q<{
      id: string;
      name: string;
      version: number;
      data: Record<string, unknown>;
      usages: number;
      etudes: number;
    }>(
      `SELECT o.id,o.name,o.version,o.data,
        (SELECT count(*)::int FROM grc_objects c WHERE c.smsi_id=o.smsi_id AND c.kind='sr_ov' AND NOT c.archived AND c.data->>'sourceRef'='object:'||o.id) AS usages,
        (SELECT count(DISTINCT c.data->>'studyRef')::int FROM grc_objects c WHERE c.smsi_id=o.smsi_id AND c.kind='sr_ov' AND NOT c.archived AND c.data->>'sourceRef'='object:'||o.id) AS etudes
       FROM grc_objects o
       WHERE o.smsi_id=$1 AND o.kind='risk_source' AND NOT o.archived AND COALESCE(o.data->>'studyRef','')=''
       ORDER BY o.name,o.id LIMIT 500`,
      [smsi],
    )
  ).rows;
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      version: r.version,
      category: String(r.data.category ?? ''),
      motive: String(r.data.motive ?? ''),
      resources: String(r.data.resources ?? ''),
      targetObjective: String(r.data.targetObjective ?? ''),
      usages: r.usages,
      etudes: r.etudes,
    })),
    tronque: rows.length >= 500,
  };
}
