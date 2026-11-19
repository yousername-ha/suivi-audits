/* Module Vulnérabilités (ADR 0100, lot ALH6 ; décision du RSSI du 17/11/2026) : services exposés (port, protocole, produit)
   des actifs de la surface externe. L'éditeur d'AlgoLightHouse ne publie pas la liste des ports ouverts d'un hôte : un
   service n'est connu que par les fragments du détail d'une alerte, lus en liste blanche par le script de l'exécutant
   (aucun appel réseau nouveau).
   - Rangement (migration 085) : à chaque lecture du détail d'une alerte, ses liens vers les services sont remplacés ; chaque
     service est rangé sur l'actif que vise l'alerte (hôte, sinon domaine), par instance, actif, port et protocole ; un
     service qu'aucune alerte ne porte plus est supprimé (il n'a plus de source). Une alerte dont l'actif n'est pas rangé ne
     range aucun service.
   - Présence : un service n'est rendu que si au moins une alerte ouverte et présente le porte (vue par la dernière
     synchronisation complète de son instance) et que son actif est présent ; seule une synchronisation complète le fait
     donc disparaître, comme le reste de la surface externe.
   - Droits : ceux de l'actif (périmètre ALH relié visible, sinon vulnerabilites:administrer). Les alertes nommées avec un
     service sont celles que la personne lit ; les autres ne sont ni nommées ni comptées.
   - Priorité : aucun effet (règles des lots ALH2 et ALH5 inchangées). Assistant : rien n'est remis au modèle.
   Rendu : services fusionnés par fusionnerServices (packages/shared). Kysely (ADR 0062). */
import {
  type CriticiteAlh,
  fusionnerServices,
  type ProtocoleServiceAlh,
  type ServiceAlh,
  type ServiceAlhDto,
  type ServiceExposeDto,
  STATUTS_ALERTE_ALH_OUVERTS,
  type StatutVersionAlh,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Kdb } from '../db/db.js';
import { lisibleAlh } from './sql.js';

const OUVERTS = [...STATUTS_ALERTE_ALH_OUVERTS];
const cle = (actif: string, port: number, protocole: string | null) => `${actif}|${port}|${protocole ?? ''}`;

/** Alerte détaillée dans un lot, avec l'actif qu'elle vise (identifiants chez l'éditeur) et ses services. */
export interface AlerteServices {
  alerteId: string;
  cibleHote: string | null;
  cibleDomaine: string | null;
  services: ServiceAlh[];
}

/** Remplace les liens des alertes détaillées vers leurs services (dans la transaction du lot). */
export async function rangerServicesAlertes(k: Kdb, integration: string, alertes: AlerteServices[]): Promise<void> {
  if (!alertes.length) return;
  await k
    .deleteFrom('vulnerabilites_alh_service_alertes')
    .where(
      'alerte_id',
      'in',
      alertes.map((a) => a.alerteId),
    )
    .execute();
  const avec = alertes.filter((a) => a.services.length && (a.cibleHote || a.cibleDomaine));
  if (avec.length) {
    const hotes = [...new Set(avec.flatMap((a) => (a.cibleHote ? [a.cibleHote] : [])))];
    const domaines = [...new Set(avec.flatMap((a) => (a.cibleDomaine ? [a.cibleDomaine] : [])))];
    const { rows: actifs } = await sql<{ id: string; type: 'hote' | 'domaine'; alh_id: string }>`
      SELECT id, type, alh_id FROM vulnerabilites_alh_actifs
      WHERE integration_id = ${integration}::uuid
        AND ((type = 'hote' AND alh_id = ANY(${hotes}::uuid[])) OR (type = 'domaine' AND alh_id = ANY(${domaines}::uuid[])))`.execute(
      k,
    );
    const actif = new Map(actifs.map((x) => [`${x.type}|${x.alh_id}`, x.id]));
    // Un service par actif, port et protocole ; les champs connus se complètent (le premier connu l'emporte).
    const services = new Map<string, ServiceAlh & { actif: string }>();
    const liens: { cle: string; alerte: string }[] = [];
    for (const a of avec) {
      const id =
        (a.cibleHote ? actif.get(`hote|${a.cibleHote}`) : undefined) ??
        (a.cibleDomaine ? actif.get(`domaine|${a.cibleDomaine}`) : undefined);
      if (!id) continue;
      for (const s of a.services) {
        const c = cle(id, s.port, s.protocole);
        const avant = services.get(c);
        if (!avant) services.set(c, { ...s, actif: id });
        else
          for (const champ of ['nom', 'produit', 'version', 'editeur', 'cpe', 'statutVersion'] as const)
            if (avant[champ] === null && s[champ] !== null) (avant as Record<string, unknown>)[champ] = s[champ];
        liens.push({ cle: c, alerte: a.alerteId });
      }
    }
    if (services.size) {
      const ids = await k
        .insertInto('vulnerabilites_alh_services')
        .values(
          [...services.values()].map((s) => ({
            integration_id: integration,
            actif_id: s.actif,
            port: s.port,
            protocole: s.protocole,
            nom: s.nom,
            produit: s.produit,
            version: s.version,
            editeur: s.editeur,
            cpe: s.cpe,
            statut_version: s.statutVersion,
          })),
        )
        .onConflict((oc) =>
          oc.columns(['integration_id', 'actif_id', 'port', 'protocole']).doUpdateSet({
            // Une valeur lue remplace la valeur rangée ; une valeur absente ne l'efface pas.
            nom: sql`coalesce(excluded.nom, vulnerabilites_alh_services.nom)`,
            produit: sql`coalesce(excluded.produit, vulnerabilites_alh_services.produit)`,
            version: sql`coalesce(excluded.version, vulnerabilites_alh_services.version)`,
            editeur: sql`coalesce(excluded.editeur, vulnerabilites_alh_services.editeur)`,
            cpe: sql`coalesce(excluded.cpe, vulnerabilites_alh_services.cpe)`,
            statut_version: sql`coalesce(excluded.statut_version, vulnerabilites_alh_services.statut_version)`,
            maj_le: sql`now()`,
          }),
        )
        .returning(['id', 'actif_id', 'port', 'protocole'])
        .execute();
      const parCle = new Map(ids.map((r) => [cle(r.actif_id, r.port, r.protocole), r.id]));
      const uniques = new Map(liens.map((l) => [`${l.cle}|${l.alerte}`, l]));
      await k
        .insertInto('vulnerabilites_alh_service_alertes')
        .values([...uniques.values()].map((l) => ({ service_id: parCle.get(l.cle)!, alerte_id: l.alerte })))
        .execute();
    }
  }
  // Un service qu'aucune alerte ne porte plus n'a plus de source : il est supprimé.
  await sql`DELETE FROM vulnerabilites_alh_services s WHERE s.integration_id = ${integration}::uuid
    AND NOT EXISTS (SELECT 1 FROM vulnerabilites_alh_service_alertes sa WHERE sa.service_id = s.id)`.execute(k);
}

interface LigneService {
  actif_id: string;
  port: number;
  protocole: ProtocoleServiceAlh | null;
  nom: string | null;
  produit: string | null;
  version: string | null;
  editeur: string | null;
  cpe: string | null;
  statut_version: StatutVersionAlh | null;
  alertes: { id: string; titre: string; criticite: CriticiteAlh | null }[];
}

const versService = (r: LigneService): ServiceExposeDto => ({
  port: r.port,
  protocole: r.protocole,
  nom: r.nom,
  produit: r.produit,
  version: r.version,
  editeur: r.editeur,
  cpe: r.cpe,
  statutVersion: r.statut_version,
  alertes: r.alertes,
});

/** Sans les alertes (liste des actifs, carte). */
export const sansAlertes = (l: ServiceExposeDto[]): ServiceAlhDto[] => l.map(({ alertes: _, ...s }) => s);

const joindreAlertes = (a: ServiceExposeDto, b: ServiceExposeDto): ServiceExposeDto => ({
  ...a,
  alertes: [...new Map([...a.alertes, ...b.alertes].map((x) => [x.id, x])).values()],
});

/** Services visibles des actifs demandés (identifiants internes) : actif lisible et présent, service porté par au moins
    une alerte ouverte et présente ; `alertes` : celles que la personne lit. Fusionnés et triés par port. */
export async function servicesDesActifs(
  k: Kdb,
  user: SessionUser,
  actifs: readonly string[],
): Promise<Map<string, ServiceExposeDto[]>> {
  const out = new Map<string, ServiceExposeDto[]>(actifs.map((id) => [id, []]));
  if (!actifs.length) return out;
  const { rows } = await sql<LigneService>`
    SELECT s.actif_id, s.port, s.protocole, s.nom, s.produit, s.version, s.editeur, s.cpe, s.statut_version,
      coalesce(jsonb_agg(jsonb_build_object('id', a2.id, 'titre', a2.titre, 'criticite', a2.criticite)
                 ORDER BY CASE a2.criticite WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'important' THEN 2
                          WHEN 'minor' THEN 3 ELSE 4 END, a2.titre, a2.id)
               FILTER (WHERE ${lisibleAlh(user, 'lp2')}), '[]'::jsonb) AS alertes
    FROM vulnerabilites_alh_services s
    JOIN vulnerabilites_alh_actifs x ON x.id = s.actif_id
    LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
    LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
    JOIN vulnerabilites_alh_service_alertes sa ON sa.service_id = s.id
    JOIN vulnerabilites_alh_alertes a2 ON a2.id = sa.alerte_id
    LEFT JOIN vulnerabilites_alh_perimetres lp2 ON lp2.integration_id = a2.integration_id AND lp2.alh_id = a2.perimetre_alh
    WHERE s.actif_id = ANY(${[...actifs]}::uuid[]) AND ${lisibleAlh(user)}
      AND x.vu_numero >= coalesce(e.numero_complet, 0)
      AND a2.statut = ANY(${OUVERTS}::text[]) AND a2.vu_numero >= coalesce(e.numero_complet, 0)
    GROUP BY s.id
    ORDER BY s.actif_id, s.port, s.protocole NULLS LAST`.execute(k);
  for (const r of rows) out.get(r.actif_id)!.push(versService(r));
  for (const [id, l] of out) out.set(id, fusionnerServices(l, joindreAlertes));
  return out;
}

/** Services rangés avec une alerte (sa fiche), sur son actif s'il est lisible et présent ; sans les alertes. */
export async function servicesDeLAlerte(k: Kdb, user: SessionUser, alerteId: string): Promise<ServiceAlhDto[]> {
  const { rows } = await sql<Omit<LigneService, 'alertes'>>`
    SELECT s.actif_id, s.port, s.protocole, s.nom, s.produit, s.version, s.editeur, s.cpe, s.statut_version
    FROM vulnerabilites_alh_service_alertes sa
    JOIN vulnerabilites_alh_services s ON s.id = sa.service_id
    JOIN vulnerabilites_alh_actifs x ON x.id = s.actif_id
    LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
    LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
    WHERE sa.alerte_id = ${alerteId}::uuid AND ${lisibleAlh(user)} AND x.vu_numero >= coalesce(e.numero_complet, 0)
    ORDER BY s.port, s.protocole NULLS LAST`.execute(k);
  return fusionnerServices(sansAlertes(rows.map((r) => versService({ ...r, alertes: [] }))));
}

/** Lot S3 : services exposés en fin de support selon AlgoLightHouse (`version_status = eol`), visibles (actif présent, porté
    par au moins une alerte ouverte et présente) : nombre de ceux dont la personne lit l'actif, drapeau sans nombre pour les
    autres. Une requête. */
export async function servicesFinDeSupport(
  k: Kdb,
  user: SessionUser,
): Promise<{ lisibles: number; horsLecture: boolean }> {
  const { rows } = await sql<{ lisibles: number; total: number }>`
    SELECT count(*) FILTER (WHERE z.lu)::int AS lisibles, count(*)::int AS total FROM (
      SELECT DISTINCT s.id, ${lisibleAlh(user)} AS lu
      FROM vulnerabilites_alh_services s
      JOIN vulnerabilites_alh_actifs x ON x.id = s.actif_id
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      JOIN vulnerabilites_alh_service_alertes sa ON sa.service_id = s.id
      JOIN vulnerabilites_alh_alertes a2 ON a2.id = sa.alerte_id
      WHERE s.statut_version = 'eol' AND x.vu_numero >= coalesce(e.numero_complet, 0)
        AND a2.statut = ANY(${OUVERTS}::text[]) AND a2.vu_numero >= coalesce(e.numero_complet, 0)) z`.execute(k);
  const r = rows[0] ?? { lisibles: 0, total: 0 };
  return { lisibles: r.lisibles, horsLecture: r.total > r.lisibles };
}
