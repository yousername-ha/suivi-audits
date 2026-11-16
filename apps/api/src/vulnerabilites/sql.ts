/* Module Vulnérabilités : fragments SQL communs aux lectures par périmètre (failles détectées, failles déclarées, fiche d'un
   produit). Alias attendus : `m` (vulnerabilites_machines), `d` (vulnerabilites_detections), `e`
   (vulnerabilites_tenable_etat de l'instance de la machine). */
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';

/** Machine `m` lisible par la personne : périmètre visible (pyramide), ou sans périmètre avec administrer. */
export const lisible = (user: SessionUser): RawBuilder<boolean> =>
  sql<boolean>`(CASE WHEN m.perimetre_id IS NULL THEN ${user.rights.can('vulnerabilites', 'administrer')}::boolean
                ELSE grc_smsi_visible(m.perimetre_id, ${user.id}::uuid) END)`;

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
