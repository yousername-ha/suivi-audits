/* Cartes de périmètres : compteurs de synthèse par périmètre accessible (voir `cartes-perimetres.ts` pour les règles de
   comptage). Chaque compteur exige la lecture de son module ; les éléments des registres restreints que la personne ne peut
   pas lire ne sont jamais comptés. */
import type { CarteCompteurs, CartePerimetre, SyntheseCartes } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Grc } from './core.js';

export interface Ligne {
  actionsTotal: number;
  actionsTerminees: number;
  actionsOuvertes: number;
  actionsRetard: number;
  occurrencesOuvertes: number;
  occurrencesRetard: number;
  seriesActives: number;
  ecartsOuverts: number;
  ecartsRetard: number;
  bia: number;
  plans: number;
}

/** Fragment SQL : l'occurrence `o` a été validée (OK, KO ou NA) et ne s'est pas vue rouvrir depuis (journal immuable, migration
    030). Une occurrence validée n'est ni « en retard » ni rappelée, même si son statut d'action n'est pas terminal. */
export const OCCURRENCE_VALIDEE = `EXISTS (SELECT 1 FROM occurrence_validations ov WHERE ov.objet_id=o.id AND ov.kind='validation'
  AND ov.seq=(SELECT max(seq) FROM occurrence_validations ox WHERE ox.objet_id=o.id))`;

/** Compteurs des éléments visibles dans au moins un des périmètres donnés : une ligne par élément, donc chaque élément n'est
    compté qu'une fois, même s'il apparaît dans plusieurs périmètres par un registre partagé. Un statut terminal vient de la
    politique métier du périmètre de l'élément. */
export async function compter(g: Grc, ids: string[], masques: string[], maintenant: string) {
  return g.db.one<Ligne>(
    `SELECT
       count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NULL)::int AS "actionsTotal",
       count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NULL AND COALESCE(o.data->>'status','')=ANY(t.ids))::int AS "actionsTerminees",
       count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)))::int AS "actionsOuvertes",
       count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)) AND o.data->>'dueAt'<$3)::int AS "actionsRetard",
       count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NOT NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)) AND NOT ${OCCURRENCE_VALIDEE})::int AS "occurrencesOuvertes",
       count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NOT NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)) AND NOT ${OCCURRENCE_VALIDEE} AND o.data->>'dueAt'<$3)::int AS "occurrencesRetard",
       count(*) FILTER (WHERE o.kind='task_series' AND o.data->'recurrence'->>'active'='true')::int AS "seriesActives",
       count(*) FILTER (WHERE o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed')::int AS "ecartsOuverts",
       count(*) FILTER (WHERE o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed' AND NULLIF(o.data->>'dueAt','')<substr($3,1,10))::int AS "ecartsRetard",
       count(*) FILTER (WHERE o.kind='bia')::int AS bia,
       count(*) FILTER (WHERE o.kind='continuity_plan')::int AS plans
     FROM grc_objects o
     JOIN grc_smsis s ON s.id=o.smsi_id
     JOIN business_policy_versions v ON v.version=s.business_version
     CROSS JOIN LATERAL (
       SELECT COALESCE(array_agg(st->>'id') FILTER (WHERE st->>'terminal'='true'),'{}'::text[]) AS ids
         FROM jsonb_array_elements(v.definition->'statuses') st) t
     WHERE NOT o.archived
       AND (o.smsi_id=ANY($1::uuid[]) OR o.registre_id IN (SELECT registre_id FROM registre_perimetres WHERE smsi_id=ANY($1::uuid[])))
       AND (o.registre_id IS NULL OR NOT (o.registre_id=ANY($2::uuid[])))`,
    [ids, masques, maintenant],
  );
}
function versCompteurs(l: Ligne | null, ecarts: boolean, pilotage: boolean): CarteCompteurs {
  const c: CarteCompteurs = { actions: null, recurrentes: null, ecarts: null, continuite: null, conformite: null };
  if (!l) return c;
  if (ecarts) {
    c.actions = { ouverts: l.actionsOuvertes, enRetard: l.actionsRetard };
    c.recurrentes = {
      series: l.seriesActives,
      occurrences: { ouverts: l.occurrencesOuvertes, enRetard: l.occurrencesRetard },
    };
    c.ecarts = { ouverts: l.ecartsOuverts, enRetard: l.ecartsRetard };
  }
  if (pilotage) c.continuite = { bia: l.bia, plans: l.plans };
  return c;
}

/** Le périmètre et tous ses descendants accessibles (sans cycle : la hiérarchie en interdit). */
function descendance(perimetres: { id: string; parentId?: string | null }[], racine: string): string[] {
  const out = [racine];
  for (let i = 0; i < out.length; i++)
    for (const p of perimetres) if (p.parentId === out[i] && !out.includes(p.id)) out.push(p.id);
  return out;
}

export async function cartesPerimetres(g: Grc, user: SessionUser): Promise<SyntheseCartes> {
  const perimetres = await g.listSmsis(user);
  const masques = await g.registres.inaccessiblesPartout(user);
  const ecarts = user.rights.can('ecarts', 'lire');
  const pilotage = user.rights.can('pilotage', 'lire');
  const conformite = user.rights.can('conformite', 'lire');
  const maintenant = new Date().toISOString();
  const out: CartePerimetre[] = [];
  for (const p of perimetres) {
    const compteurs: CarteCompteurs =
      ecarts || pilotage
        ? versCompteurs(await compter(g, [p.id], masques, maintenant), ecarts, pilotage)
        : versCompteurs(null, false, false);
    if (conformite) {
      const c = await g.db.one<{ couvertes: number; exigences: number; referentiels: number }>(
        `WITH publications AS (
           SELECT DISTINCT ON (framework_id) framework_id,version,definition FROM grc_framework_versions
            WHERE smsi_id=$1 ORDER BY framework_id,version DESC)
         SELECT COALESCE(sum(jsonb_array_length(pub.definition->'requirements')),0)::int AS exigences,
                COALESCE(sum((SELECT count(DISTINCT m.data->'target'->>'requirementId') FROM grc_objects m
                   WHERE m.smsi_id=$1 AND m.kind='mapping' AND NOT m.archived AND m.data->>'status'='validated'
                     AND m.data->'target'->>'frameworkId'=o.id::text AND (m.data->'target'->>'version')::int=pub.version
                     AND m.data->>'type'<>'none')),0)::int AS couvertes,
                count(*)::int AS referentiels
           FROM grc_objects o JOIN publications pub ON pub.framework_id=o.id
          WHERE o.smsi_id=$1 AND o.kind='framework' AND NOT o.archived AND o.data->>'enabled'='true'`,
        [p.id],
      );
      // Sans référentiel activé, la conformité n'est pas mesurable : indisponible, pas 0 %.
      if (c && c.referentiels > 0) compteurs.conformite = { couvertes: c.couvertes, exigences: c.exigences };
    }
    // Total de la carte : le périmètre et ses sous-périmètres, chaque élément une seule fois (jamais la somme des cartes
    // enfants). Sans sous-périmètre, c'est le décompte de la carte ; la conformité ne s'additionne pas.
    const ensemble = descendance(perimetres, p.id);
    const total: CarteCompteurs =
      ensemble.length === 1 || !(ecarts || pilotage)
        ? { ...compteurs, conformite: ensemble.length === 1 ? compteurs.conformite : null }
        : versCompteurs(await compter(g, ensemble, masques, maintenant), ecarts, pilotage);
    out.push({
      id: p.id,
      name: p.name,
      parentId: p.parentId ?? null,
      nature: p.nature,
      entityKind: p.entityKind,
      compteurs,
      total,
      sousPerimetres: ensemble.length - 1,
    });
  }
  // Total général : chaque élément compté une seule fois sur l'ensemble des périmètres accessibles (jamais la somme des cartes, qui
  // compterait deux fois un registre partagé). La conformité ne s'additionne pas : indisponible.
  const general =
    (ecarts || pilotage) && perimetres.length
      ? versCompteurs(
          await compter(
            g,
            perimetres.map((p) => p.id),
            masques,
            maintenant,
          ),
          ecarts,
          pilotage,
        )
      : versCompteurs(null, false, false);
  return { cartes: out, total: general };
}
