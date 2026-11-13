import { libelleAcceptabilite, libelleEtatAppreciation, libelleOptionTraitement } from '@suivi/shared';

/** Horodatage ISO affiché « jj/mm/aaaa hh:mm » (sans fuseau ni fraction de seconde). */
const horodatageFr = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(v ?? '');
};
const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const list = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);
const table = (headers: string[], rows: unknown[][]) =>
  `<table><thead><tr>${headers.map((h) => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
/** Rapport autonome sans script ni ressource externe ; toutes les valeurs du registre sont échappées. */
export function committeeReport(input: unknown) {
  const report = record(input),
    scope = record(report.smsi),
    sections = record(report.sections),
    risks = record(sections.risks);
  const riskRows = list(risks.items).map((r) => {
    const data = record(r.data),
      assessment = record(r.assessment),
      result = record(assessment.result);
    const gross = record(result.gross),
      residual = record(result.residual),
      method = record(r.method);
    return [
      data.code,
      r.name,
      method.name,
      data.methodVersion,
      gross.label,
      residual.label,
      libelleAcceptabilite(residual.acceptability),
      libelleOptionTraitement(data.strategy),
      data.reviewAt,
      assessment.revision,
      libelleEtatAppreciation(assessment.decision),
      assessment.created_by,
      horodatageFr(assessment.created_at),
      assessment.rationale,
    ];
  });
  const incidents = list(sections.incidents);
  const frameworks = list(sections.frameworks);
  const taskSummary = record(record(sections.tasks).summary);
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comité de pilotage — ${escape(scope.name)}</title><body><main>
    <h1>Rapport de pilotage et audit</h1><h2>${escape(scope.name)}</h2><p>Périmètre : ${escape(scope.scope)}</p><p>Généré le ${escape(report.generatedAt)} par ${escape(report.generatedBy)}. Politique métier : version ${escape(record(report.policy).version)}.</p>
    ${
      sections.incidents
        ? `<h2>Incidents</h2><p>${escape(incidents.length)} incident(s) dans ce périmètre, dont ${escape(incidents.filter((i) => !['Résolu', 'Clos'].includes(String(i.status))).length)} ouvert(s).</p>${table(
            ['Référence', 'Intitulé', 'Qualification', 'Statut', 'Impact', 'Urgence', 'Détecté le', 'Résolu le'],
            incidents.map((i) => [
              i.id,
              i.title,
              i.kind,
              i.status,
              i.impact,
              i.urgency,
              horodatageFr(i.detectedAt),
              horodatageFr(i.resolvedAt),
            ]),
          )}`
        : ''
    }
    ${sections.tasks ? `<h2>Suivi des actions</h2>${table(['Total', 'Closes', 'En retard', 'Sans responsable'], [[taskSummary.total, taskSummary.closed, taskSummary.overdue, taskSummary.unassigned]])}` : ''}
    ${
      sections.risks
        ? `<h2>Registre et décisions de risques</h2><p>${escape(risks.total)} risques dans le registre. Les niveaux restent propres à chaque version méthodologique.</p>${table(['Code', 'Risque', 'Méthode', 'Version', 'Brut', 'Résiduel', 'Acceptabilité', 'Traitement', 'Réévaluation', 'Décision n°', 'Statut', 'Auteur', 'Date', 'Justification'], riskRows)}<h3>Relations de pilotage</h3>${table(
            ['Source', 'Cible', 'Relation'],
            list(risks.edges).map((e) => [e.source_ref, e.target_ref, e.type]),
          )}`
        : ''
    }
    ${
      sections.frameworks
        ? `<h2>Référentiels</h2>${table(
            ['Nom', 'Identifiant', 'Version de fiche', 'Activation'],
            frameworks.map((f) => [
              f.name,
              record(record(f.data).definition).identifier,
              f.version,
              record(f.data).enabled ? 'Activé' : 'Désactivé',
            ]),
          )}`
        : ''
    }
    <h2>Portée du rapport</h2><ul>${(Array.isArray(report.notes) ? report.notes : []).map((n) => `<li>${escape(n)}</li>`).join('')}</ul></main></body></html>`;
}
