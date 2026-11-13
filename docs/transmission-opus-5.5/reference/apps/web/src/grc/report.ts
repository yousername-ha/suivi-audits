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
      residual.acceptability,
      data.strategy,
      data.reviewAt,
      assessment.revision,
      assessment.decision,
      assessment.created_by,
      assessment.created_at,
      assessment.rationale,
    ];
  });
  const frameworks = list(sections.frameworks),
    mappings = list(sections.mappings);
  const taskSummary = record(record(sections.tasks).summary);
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comité de pilotage — ${escape(scope.name)}</title><body><main>
    <h1>Rapport de pilotage et audit</h1><h2>${escape(scope.name)}</h2><p>Périmètre : ${escape(scope.scope)}</p><p>Généré le ${escape(report.generatedAt)} par ${escape(report.generatedBy)}. Politique métier : version ${escape(record(report.policy).version)}.</p>
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
          )}<h2>Correspondances validées</h2>${table(
            ['Nom', 'Relation', 'Couverture justifiée (%)', 'Justification', 'Validation par', 'Date'],
            mappings.map((m) => {
              const d = record(m.data);
              return [m.name, d.type, d.coverage, d.justification, d.validatedBy, d.validatedAt];
            }),
          )}`
        : ''
    }
    <h2>Portée du rapport</h2><ul>${(Array.isArray(report.notes) ? report.notes : []).map((n) => `<li>${escape(n)}</li>`).join('')}</ul></main></body></html>`;
}
