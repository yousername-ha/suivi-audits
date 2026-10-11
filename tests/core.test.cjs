const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../modules/df-core.js');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../sources/catalogue.json'), 'utf8'));
const state = () => ({ v: 1, schema: 15, years: [2026], items: [{ id: 'A-5.1', ref: 'A', num: '5.1', title: 'Mesure synthétique', notes: 'NOTE_NON_AUTORISEE' }], findings: [], evidences: [], frameworks: C.clone(catalog.frameworks), preserved: { arbitrary: ['EXTRA_HISTORIQUE', { x: 42 }] } });
const dossier = (s, kind = 'CARE', extra = {}) => C.createDossier(s, { kind, domain: 'D1', title: 'Dossier synthétique', scope: ['Établissement de recette'], frameworkId: kind === 'CARE' ? 'CARE-D1-1.9-DF' : 'HAS-ES-2025-DF', ...extra });
const evaluation = s => s.df.evaluations[0];
function proof(s, e) {
  const p = C.createProof(s, { title: 'Pièce synthétique', classification: 'INTERNE' });
  const v = C.addProofVersion(s, p.id, { name: 'preuve.txt', mime: 'text/plain', size: 20, fileKey: 'blob-synthetique', sha256: 'a'.repeat(64) });
  C.attachProof(s, e.id, p.id, v.id); return { p, v };
}
test('initialisation additive et répétée : tous les champs legacy et extra sont préservés', () => {
  const s = state(), before = C.clone(s); C.initialise(s); C.initialise(s);
  for (const key of Object.keys(before)) assert.deepEqual(s[key], before[key]);
  assert.equal(s.schema, 15); assert.equal(s.df.schema, 1);
  assert.throws(() => C.initialise({ ...s, df: { schema: 2 } }), /Version/);
});
test('catalogues sourcés : 118 critères HAS, 21 impératifs et 10 entrées D1 sans doublons', () => {
  const [h, d] = catalog.frameworks;
  assert.equal(h.requirements.length, 118); assert.equal(new Set(h.requirements.map(r => r.id)).size, 118);
  assert.equal(h.requirements.filter(r => r.level === 'Impératif').length, 21);
  assert.equal(h.requirements.find(r => r.id === '3.1-07').title, 'Les risques de sécurité numérique sont maîtrisés');
  assert.equal(h.requirements.find(r => r.id === '2.3-16').sourcePage, '107');
  assert.equal(d.requirements.length, 10); assert.match(d.sourceStatus, /actualisations/);
  assert.ok(h.requirements.every(r => r.sourceUrl.startsWith('https://www.has-sante.fr/') && r.sourcePage));
});
test('création de campagne sans toucher aux mesures, actions et autres référentiels', () => {
  const s = state(), before = C.clone(s), d = dossier(s, 'HAS');
  assert.equal(s.df.evaluations.length, 118); assert.equal(d.frameworkVersion, '2025');
  for (const k of ['items', 'findings', 'frameworks', 'preserved']) assert.deepEqual(s[k], before[k]);
  assert.equal(C.validateState(s), s);
});
test('suivi générique pour tous les domaines non documentés, objectifs explicitement locaux', () => {
  for (const domain of ['D1bis', 'D2', 'D3', 'D4']) {
    const s = state(), d = dossier(s, 'CARE', { frameworkId: '', domain });
    assert.equal(s.df.evaluations.length, 0); assert.match(d.sourceStatus, /indisponible/);
    const e = C.addLocalObjective(s, d.id, { title: 'Choix local de recette' });
    assert.equal(e.custom, true); assert.equal(e.requirement.chapter, 'Objectifs locaux');
    assert.throws(() => C.addLocalObjective(s, d.id, { title: 'Doublon', reference: e.requirementId }), /existe/);
  }
});
test('contrôle des domaines, périmètres et chronologie avant toute création', () => {
  const s = state(); C.initialise(s);
  assert.throws(() => dossier(s, 'CARE', { domain: 'D2' }), /incompatibles/);
  assert.throws(() => dossier(s, 'HAS', { frameworkId: '' }), /version/);
  assert.throws(() => dossier(s, 'CARE', { scope: [] }), /périmètre/);
  assert.throws(() => dossier(s, 'CARE', { start: '2026-10-11', due: '2026-10-10' }), /précéder/);
  assert.equal(s.df.dossiers.length, 0);
});
test('réévaluations historisées et sans recalcul des campagnes antérieures', () => {
  const s = state(); dossier(s); const e = evaluation(s), old = C.clone(e.requirement);
  C.updateEvaluation(s, e.id, { status: 'En cours', progress: 35, notes: 'Situation A', owner: 'Responsable fictif' });
  C.updateEvaluation(s, e.id, { status: 'À vérifier', progress: 60, notes: 'Situation B' });
  assert.equal(e.version, 3); assert.equal(e.history.length, 2); assert.equal(e.history[1].snapshot.notes, 'Situation A'); assert.deepEqual(e.requirement, old);
  s.frameworks[1].requirements[0].title = 'Changement externe'; assert.deepEqual(e.requirement, old);
});
test('validation interne exige preuve acceptée, vérificateur et date', () => {
  const s = state(); dossier(s); const e = evaluation(s);
  assert.throws(() => C.updateEvaluation(s, e.id, { status: 'Atteint', progress: 100 }), /vérificateur/);
  assert.throws(() => C.updateEvaluation(s, e.id, { status: 'Atteint', reviewer: 'Fictif', reviewedAt: '2026-10-11' }), /preuve/);
  const { p, v } = proof(s, e);
  assert.throws(() => C.updateEvaluation(s, e.id, { status: 'Atteint', reviewer: 'Fictif', reviewedAt: '2026-10-11' }), /acceptée/);
  C.validateProof(s, p.id, v.id, { status: 'Acceptée en interne', reviewer: 'Fictif', date: '2026-10-11' });
  C.updateEvaluation(s, e.id, { status: 'Atteint', reviewer: 'Fictif', reviewedAt: '2026-10-11' });
  assert.equal(e.progress, 100); assert.equal(e.status, 'Atteint');
  assert.throws(() => C.detachProof(s, e.id, p.id, v.id), /Réévaluez/);
});
test('non-applicabilité justifiée et dates réellement valides', () => {
  const s = state(); dossier(s, 'HAS'); const e = evaluation(s);
  assert.throws(() => C.updateEvaluation(s, e.id, { status: 'Non applicable' }), /Justifiez/);
  C.updateEvaluation(s, e.id, { status: 'Non applicable', applicabilityReason: 'Activité absente du périmètre de recette' });
  assert.equal(C.stats(s, s.df.dossiers).applicable, 117);
  for (const invalid of ['2026-02-30', '2026-13-01', '01/01/2026']) assert.throws(() => C.date(invalid), /invalide/);
});
test('preuve partagée, relations bidirectionnelles et versions stables', () => {
  const s = state(); dossier(s); const [a, b] = s.df.evaluations, { p, v } = proof(s, a);
  C.attachProof(s, b.id, p.id, v.id); C.attachProof(s, a.id, p.id, v.id);
  const newer = C.addProofVersion(s, p.id, { name: 'nouvelle.txt', size: 50, sha256: 'b'.repeat(64), fileKey: 'blob-2' });
  assert.equal(s.evidences.length, 1); assert.equal(p.links.dfEvaluations.length, 2); assert.equal(a.proofRefs.length, 1); assert.equal(a.proofRefs[0].versionId, v.id); assert.notEqual(v.id, newer.id);
  C.detachProof(s, a.id, p.id, v.id); assert.deepEqual(p.links.dfEvaluations, [b.id]); assert.equal(p.dfVersions.length, 2);
});
test('validation de chaque version distincte, même pour les liens legacy', () => {
  const s = state(); dossier(s); const e = evaluation(s), { p, v } = proof(s, e);
  C.validateProof(s, p.id, v.id, { status: 'À corriger', reviewer: 'Fictif', date: '2026-10-11' });
  C.validateProof(s, p.id, v.id, { status: 'Acceptée en interne', reviewer: 'Fictif', date: '2026-10-12' });
  assert.equal(p.dfValidations.length, 2); assert.equal(C.proofValidation(s, e.proofRefs[0]).status, 'Acceptée en interne');
  p.location = 'https://example.invalid/preuve'; C.attachProof(s, e.id, p.id, 'legacy');
  assert.equal(C.proofValidation(s, e.proofRefs[1]), null);
});
test('actions dans le registre commun, sans duplication ni validation automatique', () => {
  const s = state(); dossier(s); const [a, b] = s.df.evaluations;
  C.linkMeasures(s, a.id, ['A-5.1']); const f = C.createAction(s, a.id, { title: 'Action de recette', owner: 'Fictif', due: '2026-11-01' });
  C.attachFinding(s, b.id, f.id); C.attachFinding(s, a.id, f.id);
  assert.equal(s.findings.length, 1); assert.deepEqual(f.items, ['A-5.1']); assert.equal(f.dfEvaluationIds.length, 2);
  f.tasks[0].done = true; f.status = 'Clos'; assert.equal(a.status, 'À démarrer'); assert.equal(b.status, 'À démarrer');
});
test('argent exact : espaces français, centimes et sommes, sans formule d’aide', () => {
  assert.equal(C.parseMoney('1 234,56 €'), 123456); assert.equal(C.parseMoney('0.1'), 10); assert.equal(C.parseMoney('0,20'), 20);
  for (const bad of ['1.234', '-1', 'NaN', '1e2', '1,2,3', 'Infinity']) assert.throws(() => C.parseMoney(bad));
  const s = state(), d = dossier(s), fields = { label: 'Recette', year: 2026, planned: '0,30', spent: '0,10', notified: '0,20', received: '0,10' };
  const a = C.upsertBudget(s, d.id, '', fields), b = C.upsertBudget(s, d.id, '', { ...fields, spent: '0,20' }), total = C.budgetTotals([a, b]);
  assert.equal(total.spent, 30); assert.equal(total.remaining, 30); assert.equal(total.fundingRemaining, 20);
  assert.equal(Object.keys(total).includes('subventionAutomatique'), false);
});
test('erreur budgétaire atomique et historique des montants conservé', () => {
  const s = state(), d = dossier(s), b = C.upsertBudget(s, d.id, '', { label: 'Recette', year: 2026, spent: '10,01' }), before = C.clone(b);
  assert.throws(() => C.upsertBudget(s, d.id, b.id, { label: 'Erreur', year: 2026, spent: '10,001' })); assert.deepEqual(b, before);
  C.upsertBudget(s, d.id, b.id, { label: 'Recette modifiée', year: 2026, spent: '12,02' }); assert.equal(b.history[0].snapshot.spent, 1001); assert.equal(b.spent, 1202);
});
test('dossier archivé conservé avec ses liens et protégé des écritures', () => {
  const s = state(), d = dossier(s), e = evaluation(s); C.archiveDossier(s, d.id);
  assert.equal(s.df.evaluations.length, 10); assert.throws(() => C.updateEvaluation(s, e.id, { status: 'En cours' }), /Réouvrez/);
  assert.throws(() => C.createAction(s, e.id, { title: 'Action' }), /archivé/);
  C.archiveDossier(s, d.id); assert.equal(d.archived, false);
});
test('référentiels importés vérifiables, versions distinctes et pas de remplacement silencieux', () => {
  const s = state(), input = { dfKind: 'HAS', name: 'Référentiel de recette', version: 'V1', sourceUrl: 'https://www.has-sante.fr/', requirements: [{ id: 'REC-1', title: 'Critère synthétique' }] };
  const f = C.importFramework(s, input); assert.match(f.sourceStatus, /à vérifier/); assert.equal(C.importFramework(s, input).id, f.id);
  assert.throws(() => C.importFramework(s, { ...input, requirements: [{ id: 'REC-1', title: 'Autre texte' }] }), /nouvelle version/);
  assert.notEqual(C.importFramework(s, { ...input, version: 'V2' }).id, f.id);
  C.verifyFramework(s, f.id, { checkedAt: '2026-10-11', reuse: 'Fixture synthétique, autorisée' }); assert.equal(f.sourceStatus, 'Vérifié localement');
});
test('paquet auditeur physiquement filtré : aucun champ ni version hors périmètre', () => {
  const s = state(); dossier(s); const [a, b] = s.df.evaluations, { p, v } = proof(s, a);
  s.df.evaluations[1].notes = 'EVALUATION_NON_AUTORISEE'; p.notes = 'NOTES_GLOBALES_NON_AUTORISEES';
  C.addProofVersion(s, p.id, { name: 'VERSION_NON_AUTORISEE.txt', size: 10, sha256: 'b'.repeat(64), fileKey: 'autre' });
  const hidden = C.createProof(s, { title: 'PREUVE_NON_AUTORISEE' });
  s.findings.push({ id: 'HIDDEN', text: 'ACTION_NON_AUTORISEE' });
  C.linkMeasures(s, a.id, ['A-5.1']);
  const pkg = C.buildAuditPackage(s, { title: 'Audit recette', evaluationIds: [a.id] }), text = JSON.stringify(pkg);
  assert.equal(pkg.evaluations.length, 1); assert.equal(pkg.evidences.length, 1); assert.equal(pkg.evidences[0].versions.length, 1); assert.equal(pkg.findings.length, 0);
  for (const marker of ['EXTRA_HISTORIQUE', 'NOTE_NON_AUTORISEE', 'EVALUATION_NON_AUTORISEE', 'NOTES_GLOBALES_NON_AUTORISEES', 'VERSION_NON_AUTORISEE', hidden.title, 'ACTION_NON_AUTORISEE']) assert.ok(!text.includes(marker), marker);
  assert.equal(pkg.evidences[0].versions[0].id, v.id);
});
test('observations hors périmètre et mauvais paquet refusés sans écriture', () => {
  const s = state(); dossier(s); const [a, b] = s.df.evaluations, pkg = C.buildAuditPackage(s, { title: 'Audit', evaluationIds: [a.id] }); C.registerAuditPackage(s, pkg, 'a'.repeat(64));
  const report = { format: 'legacy-df-observations', formatVersion: 1, packageId: pkg.id, fingerprint: 'a'.repeat(64), observations: [{ id: 'OBS-1', evaluationId: b.id, type: 'Écart', text: 'Hors périmètre', author: 'Fictif', at: '2026-10-11' }] };
  assert.throws(() => C.importObservationReport(s, report), /hors du périmètre/); assert.equal(s.df.observations.length, 0);
  assert.throws(() => C.importObservationReport(s, { ...report, fingerprint: 'b'.repeat(64) }), /empreinte/);
});
test('réception idempotente, décision explicite et aucun changement d’évaluation', () => {
  const s = state(); dossier(s); const a = evaluation(s), pkg = C.buildAuditPackage(s, { title: 'Audit', evaluationIds: [a.id] }); C.registerAuditPackage(s, pkg, 'a'.repeat(64));
  const report = { format: 'legacy-df-observations', formatVersion: 1, packageId: pkg.id, fingerprint: 'a'.repeat(64), observations: [{ id: 'OBS-1', evaluationId: a.id, type: 'Écart', text: 'Écart synthétique', author: 'Fictif', at: '2026-10-11' }] };
  assert.equal(C.importObservationReport(s, report), 1); assert.equal(C.importObservationReport(s, report), 0); assert.equal(s.df.observations[0].validation, 'À examiner');
  C.reviewObservation(s, 'OBS-1', { validation: 'Confirmée en interne', decision: 'Prise en charge', reviewer: 'Responsable fictif', reviewedAt: '2026-10-11' });
  assert.equal(a.status, 'À démarrer'); assert.equal(a.version, 1);
});
test('conflits d’observation : aucun import partiel', () => {
  const s = state(); dossier(s); const e = evaluation(s), pkg = C.buildAuditPackage(s, { title: 'Audit', evaluationIds: [e.id] }); C.registerAuditPackage(s, pkg, 'a'.repeat(64));
  const obs = { id: 'OBS-1', evaluationId: e.id, type: 'Constat', text: 'Texte reçu', author: 'Fictif', at: '2026-10-11' }, report = { format: 'legacy-df-observations', formatVersion: 1, packageId: pkg.id, fingerprint: 'a'.repeat(64), observations: [obs] };
  C.importObservationReport(s, report);
  assert.throws(() => C.importObservationReport(s, { ...report, observations: [{ ...obs, id: 'OBS-2' }, { ...obs, text: 'Texte altéré' }] }), /modifiée/); assert.equal(s.df.observations.length, 1);
});
test('sauvegardes incohérentes et pollution de prototype refusées', () => {
  assert.throws(() => C.safeJson('{"__proto__":{"polluted":true}}'), /interdite/); assert.equal({}.polluted, undefined);
  const s = state(); dossier(s); s.df.evaluations[0].dossierId = 'inconnu'; assert.throws(() => C.validateState(s), /Évaluation invalide/);
});
test('liens dangereux et formules bureautiques neutralisés', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://user:pass@example.invalid']) assert.throws(() => C.sourceUrl(url));
  assert.equal(C.spreadsheetText('=HYPERLINK("url")')[0], "'"); assert.equal(C.spreadsheetText('  @SUM(A1)')[0], "'"); assert.equal(C.spreadsheetText(42), 42);
});
test('projection des tableaux de bord : sources réelles, retards et aucune division par zéro', () => {
  const s = state(), d = dossier(s), e = evaluation(s);
  assert.equal(C.stats(s, []).progress, null);
  C.updateEvaluation(s, e.id, { status: 'En cours', progress: 40, due: '2026-01-01' });
  const st = C.stats(s, [d], '2026-10-11'); assert.equal(st.overdue, 1); assert.equal(st.missing, 10); assert.equal(st.progress, 4);
});
