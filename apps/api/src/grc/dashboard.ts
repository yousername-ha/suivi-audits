import type { SessionUser } from '../auth.js';
import type { Grc } from './core.js';
export async function dashboard(g: Grc, smsi: string, user: SessionUser) {
  await g.access(smsi, user);
  const policy = (await g.policy(smsi, user)).definition,
    sections: Record<string, unknown> = {};
  if (policy.dashboard.cards.includes('tasks') && user.rights.can('ecarts', 'lire'))
    sections.tasks = await g.tasks.dashboard(smsi, user);
  if (policy.dashboard.cards.includes('risks') && user.rights.can('pilotage', 'lire'))
    sections.risks = await g.db.one(
      `SELECT count(*)::int total,count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM grc_risk_evaluations e WHERE e.risk_id=o.id AND e.decision='approved'))::int awaitingReview,count(*) FILTER(WHERE data->>'reviewAt'<$2)::int overdue FROM grc_objects o WHERE smsi_id=$1 AND kind='risk' AND NOT archived`,
      [smsi, new Date().toISOString().slice(0, 10)],
    );
  for (const [card, kind, module] of [
    ['controls', 'control', 'pilotage'],
    ['evidence', 'evidence', 'documents'],
  ] as const)
    if (policy.dashboard.cards.includes(card) && user.rights.can(module, 'lire'))
      sections[card] = await g.db.one(
        `SELECT count(*)::int total FROM grc_objects WHERE smsi_id=$1 AND kind=$2 AND NOT archived`,
        [smsi, kind],
      );
  if (policy.dashboard.cards.includes('frameworks') && user.rights.can('conformite', 'lire'))
    sections.frameworks = (
      await g.db.q(
        `WITH publications AS(SELECT DISTINCT ON(framework_id) framework_id,version,definition FROM grc_framework_versions WHERE smsi_id=$1 ORDER BY framework_id,version DESC) SELECT o.id,o.name,p.version,jsonb_array_length(p.definition->'requirements') requirements,(SELECT count(DISTINCT m.data->'target'->>'requirementId')::int FROM grc_objects m WHERE m.smsi_id=$1 AND m.kind='mapping' AND NOT m.archived AND m.data->>'status'='validated' AND m.data->'target'->>'frameworkId'=o.id::text AND (m.data->'target'->>'version')::int=p.version AND m.data->>'type'<>'none') AS mapped FROM grc_objects o JOIN publications p ON p.framework_id=o.id WHERE o.smsi_id=$1 AND NOT o.archived AND o.data->>'enabled'='true' ORDER BY o.name`,
        [smsi],
      )
    ).rows;
  return { sections, display: policy.dashboard };
}
