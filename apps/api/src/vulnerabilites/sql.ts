/* Module Vulnérabilités : fragments SQL communs aux lectures par périmètre (failles détectées, failles déclarées, fiche d'un
   produit). Alias attendus : `m` (vulnerabilites_machines), `d` (vulnerabilites_detections), `e`
   (vulnerabilites_tenable_etat de l'instance de la machine). */
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';

/** Périmètre effectif de la machine `m` (lot V4d) : le sien, indiqué à la main, qui prime ; sinon celui de son dépôt Tenable
    relié ; sinon NULL. Seule source du périmètre d'une machine pour les droits de lecture et l'affichage. */
export const perimetreMachine = sql<string | null>`coalesce(m.perimetre_id,
  (SELECT td.perimetre_id FROM vulnerabilites_tenable_depots td WHERE td.id = m.depot_id))`;

/** Machine `m` lisible par la personne : périmètre effectif visible (pyramide), ou sans périmètre effectif avec
    administrer. */
export const lisible = (user: SessionUser): RawBuilder<boolean> =>
  sql<boolean>`(CASE WHEN ${perimetreMachine} IS NULL THEN ${user.rights.can('vulnerabilites', 'administrer')}::boolean
                ELSE grc_smsi_visible(${perimetreMachine}, ${user.id}::uuid) END)`;

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

/** Gravité NVD retenue pour une CVE `v` : CVSS 3.1 d'abord, sinon 4.0 (comme graviteDepuisNvd), avec son score. */
export const scoreNvd = sql<
  string | null
>`CASE WHEN v.cvss31_gravite IS NOT NULL THEN v.cvss31_score ELSE v.cvss40_score END`;

/* ------------------------------------------------------------------ Surface externe (AlgoLightHouse, lots ALH1 et ALH2) */
/** Élément du périmètre ALH (alias fermé `lp` ou `lp2` de vulnerabilites_alh_perimetres) lisible : périmètre relié visible,
    ou non relié avec administrer. */
export const lisibleAlh = (user: SessionUser, alias: 'lp' | 'lp2' = 'lp'): RawBuilder<boolean> =>
  sql<boolean>`(CASE WHEN ${sql.ref(`${alias}.perimetre_id`)} IS NULL
                THEN ${user.rights.can('vulnerabilites', 'administrer')}::boolean
                ELSE grc_smsi_visible(${sql.ref(`${alias}.perimetre_id`)}, ${user.id}::uuid) END)`;

/** CVE de technologies vues par AlgoLightHouse et lisibles par la personne (lot ALH2) : version encore détectée sur au moins
    un actif lisible (un actif inconnu de la cartographie : administrer), technologie vue par la dernière synchronisation
    complète de son instance. Colonnes : cve, technologie_id, version, cvss, epss, preuve, exploitee. Même règle que la
    lecture des technologies (surface-externe.ts). */
export const cvesAlhLisibles = (user: SessionUser) => sql<{
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
      LEFT JOIN vulnerabilites_alh_actifs xa ON xa.integration_id = tt.integration_id AND xa.type = ta.actif_type
        AND xa.alh_id = ta.actif_alh
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = tt.integration_id AND lp.alh_id = xa.perimetre_alh
      WHERE ta.technologie_id = tc.technologie_id AND ta.version = tc.version AND ta.actuel AND ${lisibleAlh(user)})`;
