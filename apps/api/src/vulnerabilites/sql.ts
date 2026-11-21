/* Module Vulnérabilités : fragments SQL communs aux lectures par périmètre (failles détectées, failles déclarées, fiche d'un
   produit). Alias attendus : `m` (vulnerabilites_machines), `d` (vulnerabilites_detections), `e`
   (vulnerabilites_tenable_etat de l'instance de la machine). */
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';

/** Périmètre effectif de la machine `m` (lot V4d) : le sien, indiqué à la main, qui prime ; sinon celui de son dépôt Tenable
    relié ; sinon NULL. Seule source du périmètre d'une machine pour les droits de lecture et l'affichage. */
export const perimetreMachine = sql<string | null>`coalesce(m.perimetre_id,
  (SELECT td.perimetre_id FROM vulnerabilites_tenable_depots td WHERE td.id = m.depot_id))`;

/** Périmètres que la personne voit (pyramide, grc_smsi_visible). Sous-requête sans corrélation : PostgreSQL l'évalue une
    seule fois par requête (InitPlan), au lieu d'un appel de grc_smsi_visible par ligne lue (lot PERF, PERF-01 : 114 718
    appels pour la liste des constats). Même règle : un périmètre effectif existe toujours dans grc_smsis (clés étrangères
    ON DELETE SET NULL), il est donc visible si et seulement s'il figure dans ce tableau. */
export const perimetresVisibles = (user: SessionUser): RawBuilder<string[]> =>
  sql<string[]>`ARRAY(SELECT sv.id FROM grc_smsis sv WHERE grc_smsi_visible(sv.id, ${user.id}::uuid))`;

/** Machine `m` lisible par la personne : périmètre effectif visible (pyramide), ou sans périmètre effectif avec
    administrer. */
export const lisible = (user: SessionUser): RawBuilder<boolean> =>
  sql<boolean>`(CASE WHEN ${perimetreMachine} IS NULL THEN ${user.rights.can('vulnerabilites', 'administrer')}::boolean
                ELSE ${perimetreMachine} = ANY(${perimetresVisibles(user)}) END)`;

/** Détection `d` présente : vue par la dernière synchronisation complète de son instance (alias `e`), ou plus récemment. */
export const present = sql<boolean>`(d.vu_numero >= coalesce(e.numero_complet, 0))`;

/** La CVE désignée (colonne qualifiée, liste fermée écrite dans le code) est citée par une alerte du CERT-FR de la veille. */
export const alerteCertFr = (colonne: 'v.cve' | 'cc.cve' | 'r.cve'): RawBuilder<boolean> =>
  sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_veille_avis a
    WHERE a.source = 'cert-fr' AND a.nature = 'alerte' AND a.cves @> ARRAY[${sql.ref(colonne)}]::text[])`;

/** Tenable détecte la CVE `r.cve` sur la machine `m` (détection présente, alias `e` de l'instance de `m`). */
export const detecteeSurMachine = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_detections d
  JOIN vulnerabilites_constat_cves cc ON cc.constat_id = d.constat_id
  WHERE d.machine_id = m.id AND cc.cve = r.cve AND ${present})`;

/** Lot PRIO-1 (décision du RSSI du 20/11/2026) : machines en fin de support, la même règle que la fiche d'une machine (lot
    S3) : au moins un contrôle présent dont la date de fin de support de Tenable (`seolDate`) est passée, quel que soit son
    état de suivi. Sous-requête sans corrélation (évaluée une fois par requête), à employer en `colonne IN (…)` ; partie des
    constats datés (peu nombreux), puis de leurs détections. Les mêmes pour tout le monde (un fait, pas un droit). Colonne :
    machine_id. */
export const machinesFinSupport = sql<{ machine_id: string }>`SELECT dfs.machine_id
  FROM vulnerabilites_constats cfs
  JOIN vulnerabilites_detections dfs ON dfs.constat_id = cfs.id
  JOIN vulnerabilites_machines mfs ON mfs.id = dfs.machine_id
  LEFT JOIN vulnerabilites_tenable_etat efs ON efs.integration_id = mfs.integration_id
  WHERE cfs.fin_support_le IS NOT NULL AND cfs.fin_support_le <= now()
    AND dfs.vu_numero >= coalesce(efs.numero_complet, 0)`;

/** Lot PRIO-1 : le produit surveillé `p` est relié à au moins une machine en fin de support (toutes machines : un fait
    commun, comme le calcul global des alertes). */
export const produitSurMachineFinSupport = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_produits_machines pfs
  WHERE pfs.produit_id = p.id AND pfs.machine_id IN (${machinesFinSupport}))`;

/** Lot PRIO-1 : la CVE est présente sur une machine en fin de support, détectée par Tenable (détection présente) ou déclarée
    (produit surveillé rattaché, relié à la machine). Pour la fiche d'une CVE ; un fait commun à tous. */
export const cveSurMachineFinSupport = (cve: string): RawBuilder<boolean> =>
  sql<boolean>`(EXISTS (SELECT 1 FROM vulnerabilites_constat_cves ccf
      JOIN vulnerabilites_detections df ON df.constat_id = ccf.constat_id
      JOIN vulnerabilites_machines mf ON mf.id = df.machine_id
      LEFT JOIN vulnerabilites_tenable_etat ef ON ef.integration_id = mf.integration_id
      JOIN vulnerabilites_constats cf ON cf.id = ccf.constat_id
      WHERE ccf.cve = ${cve} AND df.vu_numero >= coalesce(ef.numero_complet, 0)
        AND df.machine_id IN (${machinesFinSupport})
        -- Décision du RSSI du 20/11/2026 : le contrôle de fin de support lui-même ne fait pas monter ses CVE.
        AND NOT (cf.fin_support_le IS NOT NULL AND cf.fin_support_le <= now()))
    OR EXISTS (SELECT 1 FROM vulnerabilites_rapprochements rf
      JOIN vulnerabilites_produits_machines pmf ON pmf.produit_id = rf.produit_id
      WHERE rf.cve = ${cve} AND rf.statut IN ('rattachee', 'confirmee') AND pmf.machine_id IN (${machinesFinSupport})))`;

/** Première présence connue du constat `c` chez nous (lot S1) : la première détection de Tenable sur une de ses machines,
    sinon son entrée dans la plateforme (aucune date inventée). Sert à l'âge et au délai de correction. */
export const premiereConstat = sql<Date>`coalesce((SELECT min(dp.premiere_detection) FROM vulnerabilites_detections dp
  WHERE dp.constat_id = c.id), c.cree_le)`;

/** Gravité NVD retenue pour une CVE `v` : CVSS 3.1 d'abord, sinon 4.0 (comme graviteDepuisNvd), avec son score. */
export const scoreNvd = sql<
  string | null
>`CASE WHEN v.cvss31_gravite IS NOT NULL THEN v.cvss31_score ELSE v.cvss40_score END`;

/* ------------------------------------------------------------------ Surface externe (AlgoLightHouse, lots ALH1 et ALH2) */
/** Élément du périmètre ALH (alias fermé `lp` ou `lp2` de vulnerabilites_alh_perimetres) lisible : périmètre relié visible,
    ou non relié avec administrer. Lot SI1 : même règle pour ce qu'une instance Silène a importé (alias `sp` de
    vulnerabilites_silene_perimetres, jointure externe : instance sans liaison = non reliée). */
export const lisibleAlh = (user: SessionUser, alias: 'lp' | 'lp2' | 'sp' = 'lp'): RawBuilder<boolean> =>
  sql<boolean>`(CASE WHEN ${sql.ref(`${alias}.perimetre_id`)} IS NULL
                THEN ${user.rights.can('vulnerabilites', 'administrer')}::boolean
                ELSE grc_smsi_visible(${sql.ref(`${alias}.perimetre_id`)}, ${user.id}::uuid) END)`;

/** CVE de technologies vues par AlgoLightHouse (lot ALH2) : version encore détectée sur au moins un actif, technologie vue par
    la dernière synchronisation complète de son instance. Colonnes : cve, technologie_id, version, cvss, epss, preuve,
    exploitee. Lot ALH5 (décision A du RSSI du 17/11/2026) : ce sont des faits de la priorité, la même pour tout le monde ;
    ils ne dépendent donc pas de ce que la personne lit (aucun nom d'actif n'en sort). */
export const cvesAlh = sql<{
  cve: string;
  technologie_id: string;
  version: string;
  cvss: string | null;
  epss: string | null;
  preuve: boolean | null;
  exploitee: boolean | null;
}>`SELECT tc.cve, tc.technologie_id, tc.version, tc.cvss, tc.epss, tc.preuve, tc.exploitee
  FROM vulnerabilites_alh_technologie_cves tc
  JOIN vulnerabilites_alh_technologies tt ON tt.id = tc.technologie_id
  LEFT JOIN vulnerabilites_alh_etat te ON te.integration_id = tt.integration_id
  WHERE tt.vu_numero >= coalesce(te.numero_complet, 0)
    AND EXISTS (SELECT 1 FROM vulnerabilites_alh_technologie_actifs ta
      WHERE ta.technologie_id = tc.technologie_id AND ta.version = tc.version AND ta.actuel)`;
