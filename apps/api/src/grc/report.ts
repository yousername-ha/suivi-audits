import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Grc } from './core.js';
export async function report(g: Grc, smsi: string, user: SessionUser, ip: string) {
  await g.permission(user, 'import_export', 'exporter');
  const scope = await g.access(smsi, user),
    sections: Record<string, unknown> = {};
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
      await g.db.k
        .selectFrom('grc_objects')
        .select(['id', 'name', 'data', 'version'])
        .where('smsi_id', '=', smsi)
        .where('kind', '=', 'framework')
        .where('archived', '=', false)
        .orderBy('name')
        .limit(1000)
        .execute()
    ).map((r) => ({ ...r, data: r.data as Record<string, unknown> }));
    sections.frameworks = rows;
    sections.mappings = await g.db.k
      .selectFrom('grc_objects')
      .select(['id', 'name', 'data', 'version', 'updated_by as updatedBy', 'updated_at as updatedAt'])
      .where('smsi_id', '=', smsi)
      .where('kind', '=', 'mapping')
      .where('archived', '=', false)
      .where(sql<string>`data->>'status'`, '=', 'validated')
      .orderBy('id')
      .limit(1000)
      .execute();
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
      'Les propositions de correspondance ne constituent pas des équivalences normatives validées.',
      'Les actions de traitement ne modifient pas automatiquement le risque résiduel.',
      'Les registres volumineux sont plafonnés à 1 000 lignes par section ; les totaux et indicateurs portent sur le périmètre complet.',
    ],
  };
}
