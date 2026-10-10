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
      await g.db.q<{ id: string; name: string; data: Record<string, unknown>; version: number }>(
        `SELECT id,name,data,version FROM grc_objects WHERE smsi_id=$1 AND kind='framework' AND NOT archived ORDER BY name LIMIT 1000`,
        [smsi],
      )
    ).rows;
    sections.frameworks = rows;
    sections.mappings = (
      await g.db.q(
        `SELECT id,name,data,version,updated_by AS "updatedBy",updated_at AS "updatedAt" FROM grc_objects WHERE smsi_id=$1 AND kind='mapping' AND NOT archived AND data->>'status'='validated' ORDER BY id LIMIT 1000`,
        [smsi],
      )
    ).rows;
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
