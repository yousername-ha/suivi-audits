/* Tableau de bord : parties de la synthèse qui viennent des fiches de registre (écarts, actions, tâches récurrentes,
   risques, continuité). Le périmètre de lecture est celui de la personne : les périmètres qu'elle peut lire, hors registres
   restreints qu'elle ne peut pas lire (un écran mural n'a aucun droit par registre : seuls le périmètre commun et les
   registres non restreints sont comptés). Chaque élément n'est compté qu'une fois, même s'il apparaît dans plusieurs
   périmètres par un registre partagé. Chaque bloc exige la lecture de son module et vaut `null` sans ce droit. */
import {
  ACTIONS_DETAILLEES,
  etatActionTdb,
  jourParis,
  repartirGrilleRisques,
  risquesCritiques,
  type DetailRisques,
  type MethodeGrille,
  type PlanActions,
  type Rights,
  type Synthese,
} from '@suivi/shared';
import { FINDING_TYPE_LABELS } from '@suivi/shared/audit';
import type { SessionUser } from './auth.js';
import { DEFAULT_SMSI, type Grc } from './grc/core.js';
import { compter } from './grc/cartes.js';
import { PorteeLecture } from './acces/portee.js';

type Natif = Pick<
  Synthese,
  | 'ecarts'
  | 'echeances'
  | 'ecartsOuverts'
  | 'actions'
  | 'recurrences'
  | 'risques'
  | 'continuite'
  | 'incidents'
  | 'pilotage'
  | 'detailRisques'
  | 'planActions'
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
const NON_CLASSE = 'Non classé';
const CONSTAT_OU_OPPORTUNITE = 'Constat ou opportunité';
const SOURCE_CERTIFICATION = 'Audit de certification';
const SOURCE_INTERNE = 'Audit interne';
const SOURCE_NON_PRECISEE = 'Non précisé';
/** Libellés connus des répartitions des écarts (`ecarts.parStatut`, `parType`, `parSource`) : listes fermées reprises par
    les chiffres ouverts d'un tableau de bord (ADR 0109). Un statut inconnu, repris tel quel par `parStatut`, n'y figure pas. */
export const LIBELLES_ECARTS = {
  statut: Object.values(LIBELLE_STATUT),
  type: [...Object.values(LIBELLE_CLASSIFICATION), NON_CLASSE, CONSTAT_OU_OPPORTUNITE],
  source: [SOURCE_CERTIFICATION, SOURCE_INTERNE, SOURCE_NON_PRECISEE],
} as const;
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

/* Agrégats du tableau de bord (regroupements, FILTER, statuts terminaux lus dans la politique en jsonb) : SQL paramétré,
   fragment de portée fixe, valeurs liées (ADR 0062 § 5). */
const DANS_LA_PORTEE = `NOT o.archived
  AND (o.smsi_id=ANY($1::uuid[]) OR o.registre_id IN (SELECT registre_id FROM registre_perimetres WHERE smsi_id=ANY($1::uuid[])))
  AND (o.registre_id IS NULL OR NOT (o.registre_id=ANY($2::uuid[])))`;

async function portee(g: Grc, user: SessionUser | null) {
  if (user) {
    // Périmètres lisibles et registres restreints masqués : porte de lecture (ADR 0083).
    const porte = PorteeLecture.pour(g, user);
    return { ids: [...(await porte.perimetresLisibles())], masques: [...(await porte.registresMasques())] };
  }
  const restreints = await g.db.k.selectFrom('registres').select('id').where('restricted', '=', true).execute();
  return { ids: [DEFAULT_SMSI], masques: restreints.map((r) => r.id) };
}

/** Tableau de bord natif : agrégats du Pilotage, plus les incidents des périmètres que la personne peut lire (BUG-070). */
export async function tableauDeBordNatif(
  g: Grc,
  rights: Rights,
  user: SessionUser | null,
  opts: { aujourdHui: Date; joursEcheance: number },
): Promise<Natif> {
  const base = await tableauDeBordNatifBase(g, rights, user, opts);
  if (!user || !rights.can('incidents', 'lire')) return base;
  const porteeLecture = PorteeLecture.pour(g, user);
  if (!(await porteeLecture.peutLireModule('incidents'))) return base;
  const lisibles = await porteeLecture.perimetresLisibles();
  const etat = (await porteeLecture.etatHistorique()).data as Record<string, unknown>;
  const incidents = (Array.isArray(etat.incidents) ? (etat.incidents as unknown[]) : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
    .filter((x) => lisibles.has(typeof x.smsi === 'string' && x.smsi ? x.smsi : DEFAULT_SMSI));
  const ouverts = incidents.filter((x) => !['Résolu', 'Clos'].includes(String(x.status ?? 'Nouveau')));
  return {
    ...base,
    incidents: {
      total: incidents.length,
      ouverts: ouverts.length,
      securiteOuverts: ouverts.filter((x) => /sécurité/i.test(String(x.kind ?? ''))).length,
    },
  };
}

async function tableauDeBordNatifBase(
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
    incidents: null,
    pilotage: null,
    detailRisques: null,
    planActions: null,
  };
  const ecarts = rights.can('ecarts', 'lire');
  const pilotage = rights.can('pilotage', 'lire');
  if (!ecarts && !pilotage) return vide;
  const { ids, masques } = await portee(g, user);
  if (!ids.length) return vide;
  const maintenant = opts.aujourdHui.toISOString();
  // Jours civils de Paris (échéances AAAA-MM-JJ) ; `maintenant` reste un instant ISO.
  const jour = jourParis(opts.aujourdHui);
  const horizon = jourParis(new Date(opts.aujourdHui.getTime() + opts.joursEcheance * 86400e3));
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
        LIBELLE_CLASSIFICATION[r.cl] ?? (r.nature === 'nonconformity' ? NON_CLASSE : CONSTAT_OU_OPPORTUNITE),
        r.n,
        parType,
      );
      cumul(
        r.src === 'AFNOR' ? SOURCE_CERTIFICATION : r.src === 'Interne' ? SOURCE_INTERNE : SOURCE_NON_PRECISEE,
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
    // `data` porte les tâches des actions (souvent hors ligne, compressé) : les quatre clés utiles sont lues d'un seul
    // décodage par ligne (PERF-15), avec le résultat de `o.data->>'clé'` (`null` pour une donnée qui n'est pas un objet).
    // `o.kind IN (…)`, déjà impliqué par la condition, écarte les autres types avant tout décodage.
    const e = await g.db.q<{
      id: string;
      kind: string;
      name: string;
      due: string;
      st: string;
      perimetre: string;
      pilote: string | null;
    }>(
      `SELECT o.id, o.kind, o.name, left(d."dueAt",10) due, COALESCE(d.status,'open') st,
              sm.name perimetre, u.display_name pilote
         FROM grc_objects o
         CROSS JOIN LATERAL jsonb_to_record(CASE WHEN jsonb_typeof(o.data)='object' THEN o.data END)
              AS d("dueAt" text, status text, "seriesId" text, "ownerId" text)
         JOIN grc_smsis sm ON sm.id=o.smsi_id
         JOIN business_policy_versions v ON v.version=sm.business_version
         LEFT JOIN users u ON u.id::text=d."ownerId"
        WHERE ${DANS_LA_PORTEE}
          AND o.kind IN ('nonconformity','action')
          AND ((o.kind='nonconformity' AND COALESCE(d.status,'open')<>'closed')
            OR (o.kind='action' AND d."seriesId" IS NULL
                AND NOT (COALESCE(d.status,'')=ANY(
                  SELECT st->>'id' FROM jsonb_array_elements(v.definition->'statuses') st WHERE st->>'terminal'='true'))))
          AND left(d."dueAt",10) ~ '^\\d{4}-\\d{2}-\\d{2}$' AND left(d."dueAt",10) <= $3
        ORDER BY left(d."dueAt",10), o.name LIMIT 12`,
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
    sortie.continuite = { plans: l.plans };
    const r = await g.db.one<{ total: number; sansDecision: number; revueEchue: number }>(
      `SELECT count(*)::int total,
              count(*) FILTER (WHERE NOT EXISTS(SELECT 1 FROM grc_risk_evaluations e WHERE e.risk_id=o.id AND e.decision='approved'))::int "sansDecision",
              count(*) FILTER (WHERE NULLIF(o.data->>'reviewAt','')<$3)::int "revueEchue"
         FROM grc_objects o WHERE o.kind='risk' AND ${DANS_LA_PORTEE}`,
      [ids, masques, jour],
    );
    sortie.risques = r ?? { total: 0, sansDecision: 0, revueEchue: 0 };
  }
  // Détail des dalles du style « Verre » (27/11/2026) : pour une personne connectée seulement, jamais pour un écran mural.
  if (user && ecarts && l) sortie.planActions = await planActions(g, ids, masques, jour);
  if (user && pilotage && l) sortie.detailRisques = await detailRisques(g, ids, masques);
  // Compteurs repris par les alertes du menu.
  sortie.pilotage = {
    constatsOuverts: sortie.ecarts?.ouverts ?? null,
    risques: sortie.risques?.total ?? null,
    risquesSansDecision: sortie.risques?.sansDecision ?? null,
    actionsEnRetard: sortie.actions?.enRetard ?? null,
  };
  return sortie;
}

/** Actions autonomes du tableau de bord (hors occurrences de tâches récurrentes) : décompte par état au jour civil `jour`
    (Paris) et les `ACTIONS_DETAILLEES` plus urgentes. Un statut terminal vient de la politique métier du périmètre de
    l'action ; `data` n'est décodé qu'une fois par ligne (PERF-15). Même portée que les autres compteurs. */
async function planActions(g: Grc, ids: string[], masques: string[], jour: string): Promise<PlanActions> {
  const finMois = `${jour.slice(0, 7)}-31`;
  // Rang : 0 en retard, 1 à échéance ce mois-ci, 2 autre ouverte, 3 close (même règle que `etatActionTdb`).
  const actions = `WITH a AS (
      SELECT o.id, o.smsi_id, o.name,
             CASE WHEN left(d."dueAt",10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN left(d."dueAt",10) END due,
             COALESCE(d.status,'')=ANY(t.ids) fin
        FROM grc_objects o
        CROSS JOIN LATERAL jsonb_to_record(CASE WHEN jsonb_typeof(o.data)='object' THEN o.data END)
             AS d("dueAt" text, status text, "seriesId" text)
        JOIN grc_smsis s ON s.id=o.smsi_id
        JOIN business_policy_versions v ON v.version=s.business_version
        CROSS JOIN LATERAL (
          SELECT COALESCE(array_agg(st->>'id') FILTER (WHERE st->>'terminal'='true'),'{}'::text[]) AS ids
            FROM jsonb_array_elements(v.definition->'statuses') st) t
       WHERE ${DANS_LA_PORTEE} AND o.kind='action' AND d."seriesId" IS NULL),
    r AS (SELECT a.*, CASE WHEN fin THEN 3 WHEN due IS NULL THEN 2 WHEN due < $3 THEN 0 WHEN due <= $4 THEN 1 ELSE 2 END rang
            FROM a)`;
  const [compte, lignes] = await Promise.all([
    g.db.q<{ rang: number; n: number }>(`${actions} SELECT rang, count(*)::int n FROM r GROUP BY rang`, [
      ids,
      masques,
      jour,
      finMois,
    ]),
    g.db.q<{ id: string; smsi_id: string; name: string; due: string | null; fin: boolean }>(
      `${actions} SELECT id, smsi_id, name, due, fin FROM r ORDER BY rang, due NULLS LAST, name, id LIMIT $5`,
      [ids, masques, jour, finMois, ACTIONS_DETAILLEES],
    ),
  ]);
  const parRang = new Map(compte.rows.map((x) => [x.rang, x.n]));
  const nb = (rang: number) => parRang.get(rang) ?? 0;
  return {
    total: nb(0) + nb(1) + nb(2) + nb(3),
    enRetard: nb(0),
    ceMois: nb(1),
    autresOuvertes: nb(2),
    closes: nb(3),
    items: lignes.rows.map((x) => ({
      id: x.id,
      perimetre: x.smsi_id,
      nom: x.name,
      echeance: x.due,
      etat: etatActionTdb(x.due, x.fin, jour),
    })),
  };
}

/** Grille des risques du tableau de bord : méthode à calcul matriciel la plus utilisée par les dernières appréciations
    des risques lisibles (validée d'abord, puis la plus récente, comme le registre), dans sa version publiée la plus
    récente ; risques sans appréciation ; risques au niveau le plus fort de la méthode. */
async function detailRisques(g: Grc, ids: string[], masques: string[]): Promise<DetailRisques> {
  const lignes = (
    await g.db.q<{
      id: string;
      smsi_id: string;
      name: string;
      code: string;
      methode: string | null;
      ratings: unknown;
    }>(
      `SELECT o.id, o.smsi_id, o.name, COALESCE(o.data->>'code','') code, ev.methode, ev.ratings
         FROM grc_objects o
         LEFT JOIN LATERAL (
           SELECT mv.method_id::text methode, e.ratings
             FROM grc_risk_evaluations e JOIN grc_method_versions mv ON mv.id=e.method_version_id
            WHERE e.risk_id=o.id ORDER BY (e.decision='approved') DESC, e.revision DESC LIMIT 1) ev ON true
        WHERE o.kind='risk' AND ${DANS_LA_PORTEE}`,
      [ids, masques],
    )
  ).rows;
  const aApprecier = lignes.filter((x) => !x.methode).length;
  const parMethode = new Map<string, number>();
  for (const x of lignes) if (x.methode) parMethode.set(x.methode, (parMethode.get(x.methode) ?? 0) + 1);
  const choisie = [...parMethode].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (!choisie) return { aApprecier, critiques: null, grille: null };
  const version = await g.db.k
    .selectFrom('grc_method_versions')
    .select('definition')
    .where('method_id', '=', choisie)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
  const grille = version
    ? repartirGrilleRisques(
        version.definition as unknown as MethodeGrille,
        lignes
          .filter((x) => x.methode === choisie)
          .map((x) => ({ id: x.id, perimetre: x.smsi_id, nom: x.name, code: x.code, ratings: x.ratings })),
      )
    : null;
  if (!grille) return { aApprecier, critiques: null, grille: null };
  const autres = lignes.length - aApprecier - (parMethode.get(choisie) ?? 0);
  return {
    aApprecier,
    critiques: risquesCritiques(grille),
    grille: { ...grille, horsGrille: grille.horsGrille + autres },
  };
}
