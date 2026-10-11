import { FONDS, GRIS } from '@suivi/ui';
import { GRC_LABELS, PILOTAGE_FIELDS, type GrcKind } from '@suivi/shared';

const escape = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown) => (Array.isArray(v) ? v.map(record) : []);
const table = (headers: string[], values: unknown[][]) =>
  `<table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${values.map((r) => `<tr>${r.map((v) => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
/** Document autonome imprimable : aucun script, aucune ressource distante, contenu échappé. */
export function pilotageReport(input: unknown) {
  const report = record(input),
    kind = String(report.kind) as GrcKind;
  const objects = [...rows(report.objects), ...rows(report.legacy)],
    decisions = rows(report.decisions);
  const fields = PILOTAGE_FIELDS[kind] ?? [];
  const contents = objects
    .map((o) => {
      const data = record(o.data),
        source = String(o.id).startsWith('legacy:') ? o.id : 'object:' + String(o.id);
      const own = decisions.filter((d) => d.source_ref === source);
      const details = fields
        .filter((f) => f.key !== 'documentRefs')
        .map((f) => {
          const v = data[f.key];
          const value = f.type === 'select' ? (f.options?.find((opt) => opt.value === v)?.label ?? v) : v;
          return [f.label, typeof value === 'object' ? '' : value];
        });
      return `<article><h2>${escape(o.name)}</h2><p>${escape(data.description)}</p><p>Fiche version ${escape(o.version)} · Dernière modification : ${escape(o.updated_at ?? o.updatedAt)} · ${escape(o.updated_by ?? o.updatedBy)}</p>${table(['Information', 'Valeur'], details)}
      ${
        kind === 'bia'
          ? `<h3>Impacts dans le temps</h3>${table(
              ['Interruption (heures)', 'Métier', 'Financier', 'Juridique', 'Réputation'],
              rows(data.impacts).map((r) => [r.hours, r.business, r.financial, r.legal, r.reputation]),
            )}`
          : ''
      }
      <h3>Références et versions documentaires</h3>${table(
        ['Référence conservée'],
        [
          ...new Set([
            ...(Array.isArray(data.refs) ? data.refs : []),
            ...(Array.isArray(data.documentRefs) ? data.documentRefs : []),
          ]),
        ].map((r) => [r]),
      )}
      <h3>Décisions enregistrées</h3>${table(
        [
          'Opération',
          'Résultat',
          'Date de réalisation',
          'Auteur',
          'Fiche examinée',
          'Justification',
          'Références exactes',
        ],
        own.map((d) => [
          decisionLabel(d.operation),
          resultLabel(d.result),
          d.performed_on,
          d.created_by,
          'Version ' + String(d.source_version),
          d.note,
          Array.isArray(d.refs) ? d.refs.join('\n') : '',
        ]),
      )}</article>`;
    })
    .join('');
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pilotage — ${escape(GRC_LABELS[kind] ?? 'Registre')}</title><style>body{font-family:system-ui,sans-serif;color:${FONDS.clair.texte};line-height:1.5;max-width:70em;margin:2em auto;padding:1em}table{width:100%;border-collapse:collapse;margin-bottom:1em}th,td{text-align:left;vertical-align:top;border:1px solid ${GRIS[4]};padding:.5em;white-space:pre-wrap;overflow-wrap:anywhere}th{background:${FONDS.clair.page}}article{break-inside:avoid}h2{border-top:1px solid ${GRIS[4]};padding-top:1em}@media print{body{margin:0;max-width:none}article{break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid}}</style><body><main><h1>${escape(GRC_LABELS[kind] ?? 'Registre de pilotage')}</h1><p>Généré le ${escape(report.generatedAt)} · ${objects.length} fiches · ${decisions.length} décisions</p><p>${escape(report.note)}</p>${contents}</main></body></html>`;
}
function decisionLabel(value: unknown) {
  return (
    (
      {
        proof_review: 'Examen de preuve',
        control_execution: 'Réalisation du contrôle',
        effectiveness: 'Vérification d’efficacité',
        close: 'Clôture',
        step_validation: 'Validation d’étape',
        approval: 'Validation',
        action_create: 'Création d’action',
      } as Record<string, string>
    )[String(value)] ?? String(value ?? '')
  );
}
function resultLabel(value: unknown) {
  return (
    (
      {
        accepted: 'Accepté',
        rejected: 'À corriger',
        pass: 'Réussi',
        partial: 'Partiellement réussi',
        fail: 'Non réussi',
        effective: 'Efficace',
        ineffective: 'Non efficace',
        completed: 'Réalisé',
      } as Record<string, string>
    )[String(value)] ?? String(value ?? '')
  );
}
