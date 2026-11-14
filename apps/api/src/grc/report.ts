import { PorteeLecture } from '../acces/portee.js';
import type { SessionUser } from '../auth.js';
import { DEFAULT_SMSI, type Grc } from './core.js';
export async function report(g: Grc, smsi: string, user: SessionUser, ip: string) {
  await g.permission(user, 'import_export', 'exporter');
  const scope = await g.access(smsi, user),
    sections: Record<string, unknown> = {};
  // Les sections lues dans la base passent par la porte de lecture (ADR 0083) : module, périmètre, registre restreint.
  const portee = PorteeLecture.pour(g, user);
  if (
    user.rights.can('pilotage', 'lire') &&
    user.rights.can('cartographie', 'lire') &&
    user.rights.can('cartographie', 'exporter')
  )
    sections.risks = await g.risks.projection(smsi, user, { limit: 1000 });
  if (user.rights.can('ecarts', 'lire') && user.rights.can('ecarts', 'exporter'))
    sections.tasks = await g.tasks.dashboard(smsi, user);
  if (user.rights.can('conformite', 'lire') && user.rights.can('conformite', 'exporter')) {
    const rows = (
      await (
        await portee.filtrerObjets(
          g.db.k
            .selectFrom('grc_objects')
            .select(['id', 'name', 'data', 'version'])
            .where('smsi_id', '=', smsi)
            .where('kind', '=', 'framework')
            .where('archived', '=', false)
            .orderBy('name')
            .limit(1000),
        )
      ).execute()
    ).map((r) => ({ ...r, data: r.data as Record<string, unknown> }));
    sections.frameworks = rows;
  }
  // Incidents du périmètre (BUG-070) : registre filtré par la porte de lecture (module, périmètre).
  if (
    user.rights.can('incidents', 'lire') &&
    user.rights.can('incidents', 'exporter') &&
    (await portee.peutLireModule('incidents'))
  ) {
    const etat = (await portee.etatHistorique()).data as Record<string, unknown>;
    const incidents = (Array.isArray(etat.incidents) ? (etat.incidents as unknown[]) : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
      .filter((x) => (typeof x.smsi === 'string' && x.smsi ? x.smsi : DEFAULT_SMSI) === smsi);
    sections.incidents = incidents.slice(0, 1000).map((x) => ({
      id: x.id,
      title: x.title,
      kind: x.kind,
      status: x.status,
      impact: x.impact,
      urgency: x.urgency,
      detectedAt: x.detectedAt,
      resolvedAt: x.resolvedAt,
    }));
  }
  await g.db.audit(user, ip, 'grc.report.exported', smsi, { sections: Object.keys(sections) });
  return {
    format: 'suivi-smsi-comite-v1',
    smsi: scope,
    generatedAt: new Date().toISOString(),
    generatedBy: user.username,
    policy: await g.policy(smsi, user),
    sections,
    notes: [
      'Les critères, couleurs et niveaux appartiennent à chaque version méthodologique.',
      'Les actions de traitement ne modifient pas automatiquement le risque résiduel.',
      'Les registres volumineux sont plafonnés à 1 000 lignes par section ; les totaux et indicateurs portent sur le périmètre complet.',
    ],
  };
}
