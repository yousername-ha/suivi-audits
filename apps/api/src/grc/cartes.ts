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
  ecartsMajeurs: number;
  ecartsMineurs: number;
  ecartsSensibles: number;
  bia: number;
  pcra: number;
}

/** Fragment SQL : l'occurrence `o` a été validée (OK, KO ou NA) et ne s'est pas vue rouvrir depuis (journal immuable, migration
    030). Une occurrence validée n'est ni « en retard » ni rappelée, même si son statut d'action n'est pas terminal. */
export const OCCURRENCE_VALIDEE = `EXISTS (SELECT 1 FROM occurrence_validations ov WHERE ov.objet_id=o.id AND ov.kind='validation'
  AND ov.seq=(SELECT max(seq) FROM occurrence_validations ox WHERE ox.objet_id=o.id))`;

/** Fragment SQL : classification d'un écart (celle de la fiche, sinon celle de l'outil de suivi historique : champ `type`),
    comme `classificationEcart` côté partagé ; NULL quand rien n'est renseigné. */
const CLASSIFICATION = `CASE COALESCE(NULLIF(o.data->>'classification',''),
    CASE o.data->>'type' WHEN 'NC maj' THEN 'majeure' WHEN 'NC min' THEN 'mineure' WHEN 'PS' THEN 'point_sensible' END)
  WHEN 'majeure' THEN 'majeure' WHEN 'mineure' THEN 'mineure' WHEN 'point_sensible' THEN 'point_sensible' END`;
const ECART_OUVERT = `o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed'`;

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
       count(*) FILTER (WHERE ${ECART_OUVERT})::int AS "ecartsOuverts",
       count(*) FILTER (WHERE ${ECART_OUVERT} AND NULLIF(o.data->>'dueAt','')<to_char($3::timestamptz AT TIME ZONE s.timezone,'YYYY-MM-DD'))::int AS "ecartsRetard",
       count(*) FILTER (WHERE ${ECART_OUVERT} AND ${CLASSIFICATION}='majeure')::int AS "ecartsMajeurs",
       count(*) FILTER (WHERE ${ECART_OUVERT} AND ${CLASSIFICATION}='mineure')::int AS "ecartsMineurs",
       count(*) FILTER (WHERE ${ECART_OUVERT} AND ${CLASSIFICATION}='point_sensible')::int AS "ecartsSensibles",
       count(*) FILTER (WHERE o.kind='bia')::int AS bia,
       count(*) FILTER (WHERE o.kind='continuity_plan' AND o.data->>'planType'='pcra')::int AS pcra
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
  const c: CarteCompteurs = { actions: null, recurrentes: null, ecarts: null, continuite: null, couverture: null };
  if (!l) return c;
  if (ecarts) {
    c.actions = { ouverts: l.actionsOuvertes, enRetard: l.actionsRetard };
    c.recurrentes = {
      series: l.seriesActives,
      occurrences: { ouverts: l.occurrencesOuvertes, enRetard: l.occurrencesRetard },
    };
    c.ecarts = {
      ouverts: l.ecartsOuverts,
      enRetard: l.ecartsRetard,
      parClassification: {
        majeure: l.ecartsMajeurs,
        mineure: l.ecartsMineurs,
        point_sensible: l.ecartsSensibles,
        non_classe: l.ecartsOuverts - l.ecartsMajeurs - l.ecartsMineurs - l.ecartsSensibles,
      },
    };
  }
  if (pilotage) c.continuite = { bia: l.bia, pcra: l.pcra };
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
      // Même calcul que l'écran « Couverture » : référentiels rattachés ou hérités du périmètre, états d'exigence communs.
      const reels = await g.rapprochements.coverage(p.id, user).then(
        (v) => v.frameworks,
        () => [], // périmètre non lisible pour la couverture : indisponible, jamais un zéro
      );
      if (reels.length)
        compteurs.couverture = {
          referentiels: reels.length,
          exigences: reels.reduce((t, f) => t + f.requirements, 0),
          applicables: reels.reduce((t, f) => t + f.etats.applicables, 0),
          testees: reels.reduce((t, f) => t + f.etats.teste + f.etats.valide_metier, 0),
          aDeterminer: reels.reduce((t, f) => t + f.etats.aDeterminer, 0),
          obligatoiresNonConformes: reels.reduce((t, f) => t + f.etats.obligatoiresNonConformes, 0),
        };
    }
    // Total de la carte : le périmètre et ses sous-périmètres, chaque élément une seule fois (jamais la somme des cartes
    // enfants). Sans sous-périmètre, c'est le décompte de la carte ; la couverture ne s'additionne pas.
    const ensemble = descendance(perimetres, p.id);
    const total: CarteCompteurs =
      ensemble.length === 1 || !(ecarts || pilotage)
        ? { ...compteurs, couverture: ensemble.length === 1 ? compteurs.couverture : null }
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
  // compterait deux fois un registre partagé). La couverture ne s'additionne pas : indisponible.
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
