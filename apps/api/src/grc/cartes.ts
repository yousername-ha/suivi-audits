/* Cartes de périmètres : compteurs de synthèse par périmètre accessible (voir `cartes-perimetres.ts` pour les règles de
   comptage). Chaque compteur exige la lecture de son module ; les éléments des registres restreints que la personne ne peut
   pas lire ne sont jamais comptés. */
import type { CarteCompteurs, CartePerimetre } from '@suivi/shared';
import type { SessionUser } from '../auth.js';
import type { Grc } from './core.js';

interface Ligne {
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

export async function cartesPerimetres(g: Grc, user: SessionUser): Promise<CartePerimetre[]> {
  const perimetres = await g.listSmsis(user);
  const masques = await g.registres.inaccessiblesPartout(user);
  const ecarts = user.rights.can('ecarts', 'lire');
  const pilotage = user.rights.can('pilotage', 'lire');
  const conformite = user.rights.can('conformite', 'lire');
  const maintenant = new Date().toISOString();
  const out: CartePerimetre[] = [];
  for (const p of perimetres) {
    const compteurs: CarteCompteurs = {
      actions: null,
      recurrentes: null,
      ecarts: null,
      continuite: null,
      conformite: null,
    };
    if (ecarts || pilotage) {
      // Un statut terminal vient de la politique métier du périmètre ; un élément est compté dans son périmètre ou dans
      // celui d'un registre qui le porte, une seule fois (une ligne par élément).
      const l = await g.db.one<Ligne>(
        `WITH termine AS (
           SELECT COALESCE(array_agg(st->>'id') FILTER (WHERE st->>'terminal'='true'),'{}'::text[]) AS ids
             FROM grc_smsis s JOIN business_policy_versions v ON v.version=s.business_version,
                  jsonb_array_elements(v.definition->'statuses') st WHERE s.id=$1)
         SELECT
           count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)))::int AS "actionsOuvertes",
           count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)) AND o.data->>'dueAt'<$3)::int AS "actionsRetard",
           count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NOT NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)))::int AS "occurrencesOuvertes",
           count(*) FILTER (WHERE o.kind='action' AND o.data->>'seriesId' IS NOT NULL AND NOT (COALESCE(o.data->>'status','')=ANY(t.ids)) AND o.data->>'dueAt'<$3)::int AS "occurrencesRetard",
           count(*) FILTER (WHERE o.kind='task_series' AND o.data->'recurrence'->>'active'='true')::int AS "seriesActives",
           count(*) FILTER (WHERE o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed')::int AS "ecartsOuverts",
           count(*) FILTER (WHERE o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed' AND NULLIF(o.data->>'dueAt','')<substr($3,1,10))::int AS "ecartsRetard",
           count(*) FILTER (WHERE o.kind='bia')::int AS bia,
           count(*) FILTER (WHERE o.kind='continuity_plan')::int AS plans
         FROM grc_objects o, termine t
         WHERE NOT o.archived
           AND (o.smsi_id=$1 OR o.registre_id IN (SELECT registre_id FROM registre_perimetres WHERE smsi_id=$1))
           AND (o.registre_id IS NULL OR NOT (o.registre_id=ANY($2::uuid[])))`,
        [p.id, masques, maintenant],
      );
      if (l) {
        if (ecarts) {
          compteurs.actions = { ouverts: l.actionsOuvertes, enRetard: l.actionsRetard };
          compteurs.recurrentes = {
            series: l.seriesActives,
            occurrences: { ouverts: l.occurrencesOuvertes, enRetard: l.occurrencesRetard },
          };
          compteurs.ecarts = { ouverts: l.ecartsOuverts, enRetard: l.ecartsRetard };
        }
        if (pilotage) compteurs.continuite = { bia: l.bia, plans: l.plans };
      }
    }
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
    out.push({
      id: p.id,
      name: p.name,
      parentId: p.parentId ?? null,
      nature: p.nature,
      entityKind: p.entityKind,
      compteurs,
    });
  }
  return out;
}
