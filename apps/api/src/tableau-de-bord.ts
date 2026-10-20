/* Tableau de bord : parties de la synthèse qui viennent des fiches de registre (écarts, actions, tâches récurrentes,
   risques, continuité). Le périmètre de lecture est celui de la personne : les périmètres qu'elle peut lire, hors registres
   restreints qu'elle ne peut pas lire (un écran mural n'a aucun droit par registre : seuls le périmètre commun et les
   registres non restreints sont comptés). Chaque élément n'est compté qu'une fois, même s'il apparaît dans plusieurs
   périmètres par un registre partagé. Chaque bloc exige la lecture de son module et vaut `null` sans ce droit. */
import type { Rights, Synthese } from '@suivi/shared';
import { FINDING_TYPE_LABELS } from '@suivi/shared/audit';
import type { SessionUser } from './auth.js';
import { DEFAULT_SMSI, type Grc } from './grc/core.js';
import { compter } from './grc/cartes.js';

type Natif = Pick<
  Synthese,
  'ecarts' | 'echeances' | 'ecartsOuverts' | 'actions' | 'recurrences' | 'risques' | 'continuite' | 'pilotage'
>;

const LIBELLE_STATUT: Record<string, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  progress: 'Actions en cours',
  effectiveness: 'À vérifier',
  closed: 'Clos',
};
const LIBELLE_CLASSIFICATION: Record<string, string> = {
  majeure: 'Non-conformité majeure',
  mineure: 'Non-conformité mineure',
  point_sensible: 'Point sensible',
};
/** Code historique des types d'écart (couleurs du graphique) selon la classification ou la nature du constat. */
const CODE_TYPE = (classification: string, nature: string) =>
  classification === 'majeure'
    ? 'NC maj'
    : classification === 'mineure'
      ? 'NC min'
      : classification === 'point_sensible'
        ? 'PS'
        : nature === 'opportunity'
          ? 'PP'
          : 'Remarque';

const DANS_LA_PORTEE = `NOT o.archived
  AND (o.smsi_id=ANY($1::uuid[]) OR o.registre_id IN (SELECT registre_id FROM registre_perimetres WHERE smsi_id=ANY($1::uuid[])))
  AND (o.registre_id IS NULL OR NOT (o.registre_id=ANY($2::uuid[])))`;

async function portee(g: Grc, user: SessionUser | null) {
  if (user) {
    return {
      ids: (await g.listSmsis(user)).map((p) => p.id),
      masques: await g.registres.inaccessiblesPartout(user),
    };
  }
  const restreints = await g.db.q<{ id: string }>('SELECT id FROM registres WHERE restricted');
  return { ids: [DEFAULT_SMSI], masques: restreints.rows.map((r) => r.id) };
}

export async function tableauDeBordNatif(
  g: Grc,
  rights: Rights,
  user: SessionUser | null,
  opts: { aujourdHui: Date; joursEcheance: number },
): Promise<Natif> {
  const vide: Natif = {
    ecarts: null,
    echeances: [],
    ecartsOuverts: null,
    actions: null,
    recurrences: null,
    risques: null,
    continuite: null,
    pilotage: null,
  };
  const ecarts = rights.can('ecarts', 'lire');
  const pilotage = rights.can('pilotage', 'lire');
  if (!ecarts && !pilotage) return vide;
  const { ids, masques } = await portee(g, user);
  if (!ids.length) return vide;
  const maintenant = opts.aujourdHui.toISOString();
  const jour = maintenant.slice(0, 10);
  const horizon = new Date(opts.aujourdHui.getTime() + opts.joursEcheance * 86400e3).toISOString().slice(0, 10);
  const sortie: Natif = { ...vide };

  const l = await compter(g, ids, masques, maintenant);
  if (ecarts && l) {
    const lignes = (
      await g.db.q<{ st: string; cl: string; src: string; nature: string; due: string | null; n: number }>(
        `SELECT COALESCE(o.data->>'status','open') st, COALESCE(o.data->>'classification','') cl,
                COALESCE(o.data->>'source','') src, COALESCE(o.data->>'findingType','nonconformity') nature,
                NULLIF(left(o.data->>'dueAt',10),'') due, count(*)::int n
           FROM grc_objects o WHERE o.kind='nonconformity' AND ${DANS_LA_PORTEE} GROUP BY 1,2,3,4,5`,
        [ids, masques],
      )
    ).rows;
    const cumul = (cle: string, n: number, m: Record<string, number>) => (m[cle] = (m[cle] ?? 0) + n);
    const parStatut: Record<string, number> = {},
      parType: Record<string, number> = {},
      parSource: Record<string, number> = {},
      ouvertsParCode: Record<string, number> = {};
    let total = 0,
      ouverts = 0,
      enRetard = 0,
      aEcheance = 0;
    for (const r of lignes) {
      total += r.n;
      cumul(LIBELLE_STATUT[r.st] ?? r.st, r.n, parStatut);
      cumul(
        LIBELLE_CLASSIFICATION[r.cl] ?? (r.nature === 'nonconformity' ? 'Non classé' : 'Constat ou opportunité'),
        r.n,
        parType,
      );
      cumul(
        r.src === 'AFNOR' ? 'Audit de certification' : r.src === 'Interne' ? 'Audit interne' : 'Non précisé',
        r.n,
        parSource,
      );
      if (r.st === 'closed') continue;
      ouverts += r.n;
      cumul(CODE_TYPE(r.cl, r.nature), r.n, ouvertsParCode);
      if (r.due && r.due < jour) enRetard += r.n;
      else if (r.due && r.due <= horizon) aEcheance += r.n;
    }
    sortie.ecarts = { total, ouverts, enRetard, aEcheance, parStatut, parType, parSource };
    sortie.ecartsOuverts = {
      ouverts,
      parType: ['NC maj', 'NC min', 'PS', 'PP', 'Remarque'].map((type) => ({
        type,
        libelle: FINDING_TYPE_LABELS[type as keyof typeof FINDING_TYPE_LABELS] ?? type,
        n: ouvertsParCode[type] ?? 0,
      })),
      actionsRealisees: l.actionsTerminees,
      actionsTotal: l.actionsTotal,
    };
    sortie.actions = {
      total: l.actionsTotal,
      ouvertes: l.actionsOuvertes,
      enRetard: l.actionsRetard,
      terminees: l.actionsTerminees,
    };
    sortie.recurrences = {
      series: l.seriesActives,
      occurrencesOuvertes: l.occurrencesOuvertes,
      occurrencesEnRetard: l.occurrencesRetard,
    };
    // Prochaines échéances : écarts et actions ouverts, du plus ancien retard au plus proche, jusqu'à l'horizon.
    const e = await g.db.q<{
      id: string;
      kind: string;
      name: string;
      due: string;
      st: string;
      perimetre: string;
      pilote: string | null;
    }>(
      `SELECT o.id, o.kind, o.name, left(o.data->>'dueAt',10) due, COALESCE(o.data->>'status','open') st,
              sm.name perimetre, u.display_name pilote
         FROM grc_objects o
         JOIN grc_smsis sm ON sm.id=o.smsi_id
         JOIN business_policy_versions v ON v.version=sm.business_version
         LEFT JOIN users u ON u.id::text=o.data->>'ownerId'
        WHERE ${DANS_LA_PORTEE}
          AND ((o.kind='nonconformity' AND COALESCE(o.data->>'status','open')<>'closed')
            OR (o.kind='action' AND o.data->>'seriesId' IS NULL
                AND NOT (COALESCE(o.data->>'status','')=ANY(
                  SELECT st->>'id' FROM jsonb_array_elements(v.definition->'statuses') st WHERE st->>'terminal'='true'))))
          AND left(o.data->>'dueAt',10) ~ '^\\d{4}-\\d{2}-\\d{2}$' AND left(o.data->>'dueAt',10) <= $3
        ORDER BY left(o.data->>'dueAt',10), o.name LIMIT 12`,
      [ids, masques, horizon],
    );
    sortie.echeances = e.rows.map((x) => ({
      id: 'object:' + x.id,
      texte: x.name,
      echeance: x.due,
      pilote: x.pilote ?? '',
      statut: LIBELLE_STATUT[x.st] ?? x.st,
      enRetard: x.due < jour,
      type: x.kind === 'action' ? 'Action' : 'Écart',
      perimetre: x.perimetre,
    }));
  }
  if (pilotage && l) {
    sortie.continuite = { bia: l.bia, plans: l.plans };
    const r = await g.db.one<{ total: number; sansDecision: number; revueEchue: number }>(
      `SELECT count(*)::int total,
              count(*) FILTER (WHERE NOT EXISTS(SELECT 1 FROM grc_risk_evaluations e WHERE e.risk_id=o.id AND e.decision='approved'))::int "sansDecision",
              count(*) FILTER (WHERE NULLIF(o.data->>'reviewAt','')<$3)::int "revueEchue"
         FROM grc_objects o WHERE o.kind='risk' AND ${DANS_LA_PORTEE}`,
      [ids, masques, jour],
    );
    sortie.risques = r ?? { total: 0, sansDecision: 0, revueEchue: 0 };
  }
  // Compteurs repris par les alertes du menu.
  sortie.pilotage = {
    constatsOuverts: sortie.ecarts?.ouverts ?? null,
    risques: sortie.risques?.total ?? null,
    risquesSansDecision: sortie.risques?.sansDecision ?? null,
    actionsEnRetard: sortie.actions?.enRetard ?? null,
  };
  return sortie;
}
