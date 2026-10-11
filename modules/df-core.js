/* Moteur local partagé CaRE / HAS. Sans réseau, sans dépendance. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LegacyDF = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const CARE_STATUSES = ['À démarrer', 'En cours', 'À vérifier', 'Atteint', 'Non applicable'];
  const HAS_STATUSES = ['Non évalué', 'Conforme', 'Partiel', 'Non conforme', 'Non applicable'];
  const OBSERVATION_TYPES = ['Constat', 'Observation', 'Écart', 'Recommandation'];
  const MONEY_FIELDS = ['planned', 'committed', 'spent', 'declared', 'requested', 'notified', 'received'];
  const DOMAIN_IDS = ['D1', 'D1bis', 'D2', 'D3', 'D4'];
  const now = () => new Date().toISOString();
  const clone = x => JSON.parse(JSON.stringify(x));
  const id = p => p + '-' + (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  const cleanText = (value, max = 10000) => {
    if (typeof value !== 'string' || value.length > max) throw new Error('Texte invalide ou trop long.');
    return value.trim();
  };
  const required = (value, label, max = 500) => {
    const v = cleanText(value || '', max);
    if (!v) throw new Error(label + ' est obligatoire.');
    return v;
  };
  const list = v => Array.isArray(v) ? v : [];
  const uniq = v => [...new Set(list(v).filter(x => typeof x === 'string' && x))];
  function safeJson(text) {
    if (typeof text !== 'string' || text.length > 40 * 1024 * 1024) throw new Error('Fichier JSON trop volumineux.');
    return JSON.parse(text, (k, v) => {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('Clé de données interdite.');
      return v;
    });
  }
  function date(value, label = 'Date') {
    if (!value) return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(label + ' invalide.');
    const d = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error(label + ' invalide.');
    return value;
  }
  function parseMoney(value) {
    if (value === '' || value == null) return 0;
    if (typeof value === 'number') value = String(value);
    const s = String(value).trim().replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(s)) throw new Error('Montant invalide : utilisez au maximum deux décimales, sans signe négatif.');
    const [a, b = ''] = s.split('.');
    const cents = Number(a) * 100 + Number(b.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents > 100000000000000) throw new Error('Montant trop élevé.');
    return cents;
  }
  function formatMoney(cents) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
  }
  function amountInput(cents) { return ((cents || 0) / 100).toFixed(2); }
  function initialise(s) {
    if (!s || s.v !== 1 || !Array.isArray(s.items) || !Array.isArray(s.findings) || !Array.isArray(s.years)) throw new Error('Sauvegarde legacy non reconnue.');
    s.frameworks = list(s.frameworks); s.evidences = list(s.evidences);
    if (s.df != null && (typeof s.df !== 'object' || Array.isArray(s.df))) throw new Error('Données D/F invalides.');
    const d = s.df = s.df || {};
    if (d.schema != null && d.schema !== VERSION) throw new Error('Version D/F non prise en charge. Préservez cette sauvegarde.');
    d.schema = VERSION;
    for (const k of ['dossiers', 'evaluations', 'budgets', 'history', 'auditPackages', 'observations']) {
      if (d[k] != null && !Array.isArray(d[k])) throw new Error('Collection D/F invalide : ' + k);
      d[k] = d[k] || [];
    }
    d.actor = typeof d.actor === 'string' ? d.actor : 'Responsable local';
    return s;
  }
  function log(s, action, kind, objectId, before, after) {
    initialise(s).df.history.push({ id: id('HIS'), at: now(), actor: s.df.actor, action, kind, objectId, before: before == null ? null : clone(before), after: after == null ? null : clone(after) });
  }
  function getDossier(s, dossierId) {
    const d = initialise(s).df.dossiers.find(x => x.id === dossierId);
    if (!d) throw new Error('Dossier introuvable.');
    return d;
  }
  function getEvaluation(s, evaluationId) {
    const e = initialise(s).df.evaluations.find(x => x.id === evaluationId);
    if (!e) throw new Error('Évaluation introuvable.');
    return e;
  }
  function sourceUrl(value, allowEmpty = true) {
    if (!value && allowEmpty) return '';
    try {
      const u = new URL(value);
      if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw 0;
      return u.href;
    } catch (_) { throw new Error('Utilisez une adresse HTTP ou HTTPS sans identifiants.'); }
  }
  function importFramework(s, input) {
    initialise(s);
    if (!input || typeof input !== 'object' || !['CARE', 'HAS'].includes(input.dfKind)) throw new Error('Le référentiel doit préciser dfKind : CARE ou HAS.');
    if (!Array.isArray(input.requirements) || input.requirements.length > 3000) throw new Error('Liste de critères invalide (3 000 maximum).');
    const name = required(input.name, 'Le nom'), version = required(input.version, 'La version', 100);
    const url = sourceUrl(input.sourceUrl || '', false);
    const seen = new Set();
    const requirements = input.requirements.map((r, i) => {
      const rid = required(r.id, 'L’identifiant du critère', 100);
      if (seen.has(rid)) throw new Error('Identifiant de critère en double : ' + rid);
      seen.add(rid);
      return { id: rid, title: required(r.title || r.text, 'Le libellé'), text: cleanText(r.text || r.title || ''), chapter: cleanText(r.chapter || ''), theme: cleanText(r.theme || ''), objective: cleanText(r.objective || r.chapter || ''), os: Number.isInteger(r.os) ? r.os : 1, scope: cleanText(r.scope || 'À préciser'), level: cleanText(r.level || ''), method: cleanText(r.method || ''), applicability: cleanText(r.applicability || ''), sourceUrl: sourceUrl(r.sourceUrl || url, false), sourcePage: String(r.sourcePage || ''), prerequisites: cleanText(r.prerequisites || ''), criteria: cleanText(r.criteria || ''), maps: [], self: '' };
    });
    const content = { dfKind: input.dfKind, domain: input.dfKind === 'CARE' ? required(input.domain, 'Le domaine', 30) : '', name, version, sourceUrl: url, publisher: cleanText(input.publisher || ''), publishedAt: date(input.publishedAt || ''), checkedAt: date(input.checkedAt || ''), reuse: cleanText(input.reuse || 'Droits de réutilisation à vérifier'), sourceStatus: 'Importé — à vérifier', source: cleanText(input.source || name + ' — ' + version), requirements, objectives: {} };
    if (content.dfKind === 'CARE' && !DOMAIN_IDS.includes(content.domain)) throw new Error('Domaine CaRE inconnu.');
    const existing = s.frameworks.find(f => f.dfKind === content.dfKind && f.domain === content.domain && f.name === name && f.version === version);
    if (existing) {
      const same = existing.sourceUrl === url && JSON.stringify(existing.requirements.map(r => [r.id, r.text])) === JSON.stringify(requirements.map(r => [r.id, r.text]));
      if (same) return existing;
      throw new Error('Cette version existe avec un contenu différent. Importez une nouvelle version.');
    }
    const f = { id: id('REF'), createdAt: now(), ...content };
    s.frameworks.push(f); log(s, 'Import du référentiel', 'framework', f.id, null, { name, version, criteria: requirements.length, sourceStatus: f.sourceStatus });
    return f;
  }
  function verifyFramework(s, frameworkId, fields) {
    const f = initialise(s).frameworks.find(x => x.id === frameworkId && x.dfKind);
    if (!f) throw new Error('Référentiel introuvable.');
    const before = { sourceStatus: f.sourceStatus, reuse: f.reuse, checkedAt: f.checkedAt };
    const reuse = required(fields.reuse, 'Les modalités de réutilisation');
    const checkedAt = date(required(fields.checkedAt, 'La date de vérification'));
    f.reuse = reuse; f.checkedAt = checkedAt;
    f.sourceStatus = 'Vérifié localement';
    log(s, 'Vérification locale de la source', 'framework', f.id, before, { sourceStatus: f.sourceStatus, reuse: f.reuse, checkedAt: f.checkedAt });
  }
  function requirementSnapshot(r) {
    return { id: r.id, title: r.title || r.text, text: r.text || '', chapter: r.chapter || r.objective || '', theme: r.theme || '', scope: r.scope || '', level: r.level || '', method: r.method || '', applicability: r.applicability || '', sourceUrl: r.sourceUrl || '', sourcePage: r.sourcePage || '', prerequisites: r.prerequisites || '', criteria: r.criteria || '' };
  }
  function createEvaluation(s, d, r, custom) {
    const e = { id: id('EVA'), dossierId: d.id, requirementId: r.id, requirement: requirementSnapshot(r), custom: !!custom, status: d.kind === 'CARE' ? CARE_STATUSES[0] : HAS_STATUSES[0], owner: d.owner, due: d.due, progress: 0, applicabilityReason: '', notes: '', reviewer: '', reviewedAt: '', proofRefs: [], findingIds: [], measureIds: [], version: 1, createdAt: now(), updatedAt: now(), history: [] };
    s.df.evaluations.push(e);
    return e;
  }
  function createDossier(s, fields) {
    initialise(s);
    if (!['CARE', 'HAS'].includes(fields.kind)) throw new Error('Type de dossier inconnu.');
    const f = fields.frameworkId ? s.frameworks.find(x => x.id === fields.frameworkId && x.dfKind === fields.kind) : null;
    if (fields.frameworkId && !f) throw new Error('Référentiel incompatible.');
    if (fields.kind === 'HAS' && !f) throw new Error('Sélectionnez une version identifiée du référentiel HAS.');
    const domain = fields.kind === 'CARE' ? required(fields.domain, 'Le domaine', 30) : '';
    if (fields.kind === 'CARE' && (!DOMAIN_IDS.includes(domain) || (f && f.domain !== domain))) throw new Error('Domaine et référentiel incompatibles.');
    const scope = uniq(fields.scope);
    if (!scope.length) throw new Error('Renseignez au moins un périmètre.');
    const d = { id: id('DOS'), kind: fields.kind, title: required(fields.title, 'Le titre'), domain, frameworkId: f ? f.id : '', frameworkName: f ? f.name : 'Suivi générique', frameworkVersion: f ? f.version : '', sourceStatus: f ? f.sourceStatus : 'Documentation officielle indisponible', scope: scope.map(v => cleanText(v, 200)), owner: cleanText(fields.owner || '', 200), due: date(fields.due || ''), start: date(fields.start || ''), status: 'En préparation', archived: false, createdAt: now(), updatedAt: now() };
    if (d.start && d.due && d.start > d.due) throw new Error('La date de début doit précéder l’échéance.');
    s.df.dossiers.push(d);
    if (f) for (const r of f.requirements) createEvaluation(s, d, { ...r, sourceUrl: r.sourceUrl || f.sourceUrl });
    log(s, 'Création du dossier', 'dossier', d.id, null, d);
    return d;
  }
  function updateDossier(s, dossierId, fields) {
    const d = getDossier(s, dossierId), before = clone(d);
    const next = { title: required(fields.title, 'Le titre'), owner: cleanText(fields.owner || '', 200), due: date(fields.due || ''), start: date(fields.start || ''), status: fields.status || d.status, scope: uniq(fields.scope).map(v => cleanText(v, 200)) };
    if (!next.scope.length) throw new Error('Renseignez au moins un périmètre.');
    if (!['En préparation', 'En cours', 'En revue', 'Clos'].includes(next.status)) throw new Error('Statut du dossier invalide.');
    if (next.start && next.due && next.start > next.due) throw new Error('La date de début doit précéder l’échéance.');
    Object.assign(d, next, { updatedAt: now() }); log(s, 'Modification du dossier', 'dossier', d.id, before, d);
    return d;
  }
  function archiveDossier(s, dossierId) {
    const d = getDossier(s, dossierId);
    d.archived = !d.archived; d.updatedAt = now();
    log(s, d.archived ? 'Archivage' : 'Réouverture', 'dossier', d.id, null, { archived: d.archived });
  }
  function addLocalObjective(s, dossierId, fields) {
    const d = getDossier(s, dossierId);
    if (d.kind !== 'CARE' || d.archived) throw new Error('Ajout impossible dans ce dossier.');
    const r = { id: fields.reference ? required(fields.reference, 'La référence', 100) : id('LOCAL'), title: required(fields.title, 'Le libellé'), text: cleanText(fields.description || ''), chapter: 'Objectifs locaux', sourceUrl: sourceUrl(fields.sourceUrl || ''), prerequisites: cleanText(fields.prerequisites || ''), criteria: cleanText(fields.criteria || '') };
    if (s.df.evaluations.some(e => e.dossierId === d.id && e.requirementId === r.id)) throw new Error('Cette référence existe déjà dans le dossier.');
    const e = createEvaluation(s, d, r, true); log(s, 'Ajout d’un objectif local (non officiel)', 'evaluation', e.id, null, e);
    return e;
  }
  function proofVersion(s, ref) {
    const p = list(s.evidences).find(x => x.id === ref.evidenceId);
    if (!p) return null;
    if (ref.versionId === 'legacy') return p.location ? { id: 'legacy', name: p.title, location: p.location, legacy: true } : null;
    return list(p.dfVersions).find(v => v.id === ref.versionId) || null;
  }
  function proofValidation(s, ref) {
    const p = list(s.evidences).find(x => x.id === ref.evidenceId);
    if (!p) return null;
    return list(p.dfValidations).filter(v => v.versionId === ref.versionId).at(-1) || null;
  }
  function updateEvaluation(s, evaluationId, fields) {
    const e = getEvaluation(s, evaluationId), d = getDossier(s, e.dossierId);
    if (d.archived) throw new Error('Réouvrez le dossier avant modification.');
    const status = fields.status || e.status;
    if (!(d.kind === 'CARE' ? CARE_STATUSES : HAS_STATUSES).includes(status)) throw new Error('Statut d’évaluation invalide.');
    const next = { status, owner: cleanText(fields.owner || '', 200), due: date(fields.due || ''), progress: Number(fields.progress == null ? e.progress : fields.progress), applicabilityReason: cleanText(fields.applicabilityReason || ''), notes: cleanText(fields.notes || ''), reviewer: cleanText(fields.reviewer || '', 200), reviewedAt: date(fields.reviewedAt || '') };
    if (!Number.isInteger(next.progress) || next.progress < 0 || next.progress > 100) throw new Error('L’avancement doit être compris entre 0 et 100.');
    if (status === 'Non applicable' && !next.applicabilityReason) throw new Error('Justifiez la non-applicabilité.');
    if (['Atteint', 'Conforme'].includes(status)) {
      if (!next.reviewer || !next.reviewedAt) throw new Error('Une validation interne exige un vérificateur et une date.');
      if (!list(e.proofRefs).some(r => proofVersion(s, r) && (proofValidation(s, r) || {}).status === 'Acceptée en interne')) throw new Error('Rattachez au moins une version de preuve acceptée en interne.');
    }
    if (status === 'Atteint') next.progress = 100;
    const before = clone({ ...e, history: undefined });
    e.history.push({ version: e.version, archivedAt: now(), actor: s.df.actor, snapshot: before });
    Object.assign(e, next, { version: e.version + 1, updatedAt: now() });
    log(s, 'Réévaluation', 'evaluation', e.id, before, { ...e, history: undefined });
    return e;
  }
  function attachProof(s, evaluationId, evidenceId, versionId) {
    const e = getEvaluation(s, evaluationId), p = s.evidences.find(x => x.id === evidenceId);
    if (!p || !proofVersion(s, { evidenceId, versionId })) throw new Error('Version de preuve introuvable.');
    if (getDossier(s, e.dossierId).archived) throw new Error('Dossier archivé.');
    if (e.proofRefs.some(r => r.evidenceId === evidenceId && r.versionId === versionId)) return;
    e.proofRefs.push({ evidenceId, versionId, attachedAt: now() });
    p.links = p.links || {}; p.links.dfEvaluations = uniq([...(p.links.dfEvaluations || []), e.id]);
    log(s, 'Rattachement d’une version de preuve', 'evaluation', e.id, null, { evidenceId, versionId });
  }
  function detachProof(s, evaluationId, evidenceId, versionId) {
    const e = getEvaluation(s, evaluationId);
    if (getDossier(s, e.dossierId).archived) throw new Error('Dossier archivé.');
    if (['Atteint', 'Conforme'].includes(e.status)) throw new Error('Réévaluez le critère avant de retirer une preuve de sa validation.');
    e.proofRefs = e.proofRefs.filter(r => r.evidenceId !== evidenceId || r.versionId !== versionId);
    const p = s.evidences.find(x => x.id === evidenceId);
    if (p && p.links && !e.proofRefs.some(r => r.evidenceId === evidenceId)) p.links.dfEvaluations = list(p.links.dfEvaluations).filter(x => x !== e.id);
    log(s, 'Retrait du rattachement de preuve', 'evaluation', e.id, { evidenceId, versionId }, null);
  }
  function createProof(s, fields) {
    initialise(s);
    let n = 1; while (s.evidences.some(x => x.id === 'PRV-' + String(n).padStart(3, '0'))) n++;
    const p = { id: 'PRV-' + String(n).padStart(3, '0'), title: required(fields.title, 'Le titre'), type: fields.type || 'Document', owner: cleanText(fields.owner || '', 200), date: date(fields.date || ''), review: date(fields.review || ''), classification: fields.classification || 'INTERNE', status: 'À produire', location: sourceUrl(fields.location || ''), notes: cleanText(fields.notes || ''), createdAt: now(), links: {}, dfVersions: [], dfValidations: [] };
    if (!['PUBLIC', 'INTERNE', 'RESTREINT', 'CONFIDENTIEL'].includes(p.classification)) throw new Error('Classification invalide.');
    s.evidences.push(p); log(s, 'Création de preuve', 'evidence', p.id, null, { title: p.title, classification: p.classification });
    return p;
  }
  function addProofVersion(s, evidenceId, metadata) {
    const p = initialise(s).evidences.find(x => x.id === evidenceId);
    if (!p) throw new Error('Preuve introuvable.');
    if (!/^[a-f0-9]{64}$/.test(metadata.sha256 || '') || !Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > 20 * 1024 * 1024) throw new Error('Pièce invalide (20 Mo maximum).');
    p.dfVersions = list(p.dfVersions);
    const v = { id: id('VER'), number: p.dfVersions.length + 1, name: required(metadata.name, 'Le nom de fichier', 240), mime: cleanText(metadata.mime || 'application/octet-stream', 200), size: metadata.size, sha256: metadata.sha256, fileKey: required(metadata.fileKey, 'La référence locale', 200), createdAt: now(), actor: s.df.actor };
    p.dfVersions.push(v); p.status = 'Disponible'; p.date = p.date || now().slice(0, 10);
    log(s, 'Dépôt d’une nouvelle version', 'evidence', p.id, null, v);
    return v;
  }
  function validateProof(s, evidenceId, versionId, fields) {
    const p = initialise(s).evidences.find(x => x.id === evidenceId);
    if (!p || !proofVersion(s, { evidenceId, versionId })) throw new Error('Version de preuve introuvable.');
    if (!['À vérifier', 'Acceptée en interne', 'À corriger', 'Refusée en interne'].includes(fields.status)) throw new Error('Statut de vérification invalide.');
    const record = { id: id('VAL'), versionId, status: fields.status, reviewer: required(fields.reviewer, 'Le vérificateur', 200), date: date(required(fields.date, 'La date de vérification')), comment: cleanText(fields.comment || ''), createdAt: now() };
    (p.dfValidations = list(p.dfValidations)).push(record);
    log(s, 'Vérification interne de preuve', 'evidence', p.id, null, record);
    return record;
  }
  function attachFinding(s, evaluationId, findingId) {
    const e = getEvaluation(s, evaluationId), f = s.findings.find(x => x.id === findingId);
    if (!f || getDossier(s, e.dossierId).archived) throw new Error('Action introuvable ou dossier archivé.');
    if (e.findingIds.includes(f.id)) return f;
    e.findingIds.push(f.id); f.dfEvaluationIds = uniq([...(f.dfEvaluationIds || []), e.id]);
    log(s, 'Rattachement d’action existante', 'evaluation', e.id, null, { findingId });
    return f;
  }
  function createAction(s, evaluationId, fields) {
    const e = getEvaluation(s, evaluationId), d = getDossier(s, e.dossierId);
    if (d.archived) throw new Error('Dossier archivé.');
    const title = required(fields.title, 'L’action'), due = date(fields.due || ''), owner = cleanText(fields.owner || '', 200);
    let n = 1; while (s.findings.some(x => x.id === 'F' + String(n).padStart(2, '0'))) n++;
    const f = { id: 'F' + String(n).padStart(2, '0'), createdAt: now(), source: d.kind === 'CARE' ? 'CaRE' : 'HAS', year: Number(now().slice(0, 4)), type: 'Remarque', text: title, desc: cleanText(fields.description || ''), items: uniq(e.measureIds), status: 'Ouvert', action: title, tasks: [{ id: id('TK'), t: title, done: false, createdAt: now() }], comment: '', owner, due, proof: '', dfEvaluationIds: [] };
    s.findings.push(f); attachFinding(s, e.id, f.id); log(s, 'Création dans le plan d’actions partagé', 'finding', f.id, null, f);
    return f;
  }
  function linkMeasures(s, evaluationId, ids) {
    const e = getEvaluation(s, evaluationId);
    if (getDossier(s, e.dossierId).archived) throw new Error('Dossier archivé.');
    const values = uniq(ids);
    if (values.some(v => !s.items.some(i => i.id === v))) throw new Error('Mesure introuvable.');
    const before = e.measureIds; e.measureIds = values;
    log(s, 'Association de mesures (choix local, sans conformité présumée)', 'evaluation', e.id, before, values);
  }
  function upsertBudget(s, dossierId, budgetId, fields) {
    const d = getDossier(s, dossierId);
    if (d.kind !== 'CARE' || d.archived) throw new Error('Le budget appartient à un dossier CaRE ouvert.');
    let row = budgetId ? s.df.budgets.find(x => x.id === budgetId && x.dossierId === dossierId) : null;
    if (budgetId && !row) throw new Error('Ligne budgétaire introuvable.');
    const next = { label: required(fields.label, 'Le libellé'), year: Number(fields.year), notes: cleanText(fields.notes || ''), financeSource: sourceUrl(fields.financeSource || ''), proofRefs: list(fields.proofRefs).map(r => ({ evidenceId: r.evidenceId, versionId: r.versionId })) };
    if (!Number.isInteger(next.year) || next.year < 2000 || next.year > 2200) throw new Error('Exercice invalide.');
    if (next.proofRefs.some(r => !proofVersion(s, r))) throw new Error('Pièce financière introuvable.');
    for (const k of MONEY_FIELDS) next[k] = parseMoney(fields[k]);
    const before = row ? clone({ ...row, history: undefined }) : null;
    if (!row) { row = { id: id('BUD'), dossierId, version: 0, history: [], createdAt: now() }; s.df.budgets.push(row); }
    if (before) row.history.push({ version: row.version, at: now(), actor: s.df.actor, snapshot: before });
    Object.assign(row, next, { version: row.version + 1, updatedAt: now() });
    log(s, 'Modification budgétaire (centimes entiers)', 'budget', row.id, before, { ...row, history: undefined });
    return row;
  }
  function budgetTotals(rows) {
    const totals = Object.fromEntries(MONEY_FIELDS.map(k => [k, 0]));
    for (const row of rows) for (const k of MONEY_FIELDS) {
      if (!Number.isSafeInteger(row[k]) || row[k] < 0) throw new Error('Montant stocké invalide.');
      totals[k] += row[k]; if (!Number.isSafeInteger(totals[k])) throw new Error('Total trop élevé.');
    }
    return { ...totals, remaining: totals.planned - totals.spent, fundingRemaining: totals.notified - totals.received };
  }
  function stats(s, dossiers, day = now().slice(0, 10)) {
    initialise(s);
    const ids = new Set(dossiers.map(d => d.id)), rows = s.df.evaluations.filter(e => ids.has(e.dossierId));
    const applicable = rows.filter(e => e.status !== 'Non applicable');
    const done = applicable.filter(e => ['Atteint', 'Conforme'].includes(e.status));
    const overdue = applicable.filter(e => !['Atteint', 'Conforme'].includes(e.status) && e.due && e.due < day);
    const missing = applicable.filter(e => !list(e.proofRefs).some(r => proofVersion(s, r)));
    const openActions = new Set(applicable.flatMap(e => e.findingIds).filter(v => { const f = s.findings.find(x => x.id === v); return f && f.status !== 'Clos'; }));
    return { total: rows.length, applicable: applicable.length, done: done.length, overdue: overdue.length, missing: missing.length, openActions: openActions.size, progress: applicable.length ? Math.round(applicable.reduce((a, e) => a + (['Atteint', 'Conforme'].includes(e.status) ? 100 : Number(e.progress) || 0), 0) / applicable.length) : null, statuses: rows.reduce((a, e) => { a[e.status] = (a[e.status] || 0) + 1; return a; }, {}) };
  }
  function buildAuditPackage(s, selection) {
    initialise(s);
    const ids = uniq(selection.evaluationIds);
    if (!ids.length || ids.length > 3000) throw new Error('Sélectionnez de 1 à 3 000 évaluations.');
    const allowed = ids.map(v => getEvaluation(s, v));
    const dossierIds = new Set(allowed.map(e => e.dossierId));
    const selectedProofs = allowed.flatMap(e => e.proofRefs).filter(r => proofVersion(s, r));
    const proofKeys = new Set(selectedProofs.map(r => r.evidenceId + ':' + r.versionId));
    const findingIds = new Set(allowed.flatMap(e => e.findingIds));
    const measureIds = new Set(allowed.flatMap(e => e.measureIds));
    const pkg = { format: 'legacy-df-audit', formatVersion: 1, id: id('AUD'), title: required(selection.title, 'Le titre de l’audit'), auditor: cleanText(selection.auditor || '', 200), createdAt: now(), expiresAt: date(selection.expiresAt || ''), confidentiality: 'Dossier autonome limité à la sélection. Distribution sous la responsabilité de son émetteur.', dossiers: s.df.dossiers.filter(d => dossierIds.has(d.id)).map(d => ({ id: d.id, title: d.title, kind: d.kind, domain: d.domain, scope: clone(d.scope), frameworkName: d.frameworkName, frameworkVersion: d.frameworkVersion, sourceStatus: d.sourceStatus })), evaluations: allowed.map(e => ({ id: e.id, dossierId: e.dossierId, requirementId: e.requirementId, requirement: clone(e.requirement), custom: e.custom, status: e.status, owner: e.owner, due: e.due, progress: e.progress, applicabilityReason: e.applicabilityReason, notes: e.notes, reviewer: e.reviewer, reviewedAt: e.reviewedAt, proofRefs: clone(e.proofRefs.filter(r => proofVersion(s, r))), findingIds: [...e.findingIds], measureIds: [...e.measureIds], version: e.version })), evidences: [], findings: [], measures: [] };
    for (const p of s.evidences) {
      const versions = list(p.dfVersions).filter(v => proofKeys.has(p.id + ':' + v.id)).map(v => ({ id: v.id, number: v.number, name: v.name, mime: v.mime, size: v.size, sha256: v.sha256, fileKey: v.fileKey, createdAt: v.createdAt }));
      const legacy = proofKeys.has(p.id + ':legacy');
      if (!versions.length && !legacy) continue;
      // Pas de notes, liens métier ni versions non autorisées du registre global.
      pkg.evidences.push({ id: p.id, title: p.title, classification: p.classification, owner: p.owner, date: p.date, versions, location: legacy ? p.location : '', validations: list(p.dfValidations).filter(v => proofKeys.has(p.id + ':' + v.versionId)).map(v => ({ versionId: v.versionId, status: v.status, reviewer: v.reviewer, date: v.date, comment: v.comment })) });
    }
    pkg.findings = s.findings.filter(f => findingIds.has(f.id)).map(f => ({ id: f.id, text: f.text, status: f.status, owner: f.owner, due: f.due, tasks: list(f.tasks).map(t => ({ id: t.id, t: t.t, done: !!t.done })) }));
    pkg.measures = s.items.filter(i => measureIds.has(i.id)).map(i => ({ id: i.id, ref: i.ref, num: i.num, title: i.title }));
    return pkg;
  }
  function registerAuditPackage(s, pkg, fingerprint) {
    if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Empreinte invalide.');
    const record = { id: pkg.id, title: pkg.title, auditor: pkg.auditor, createdAt: pkg.createdAt, expiresAt: pkg.expiresAt, evaluationIds: pkg.evaluations.map(e => e.id), evaluationVersions: Object.fromEntries(pkg.evaluations.map(e => [e.id, e.version])), fingerprint };
    initialise(s).df.auditPackages.push(record); log(s, 'Export limité pour auditeur', 'audit', record.id, null, record);
    return record;
  }
  function checkObservationReport(s, report) {
    if (!report || report.format !== 'legacy-df-observations' || report.formatVersion !== 1 || !Array.isArray(report.observations) || report.observations.length > 3000) throw new Error('Rapport d’observations non reconnu.');
    const pkg = initialise(s).df.auditPackages.find(x => x.id === report.packageId && x.fingerprint === report.fingerprint);
    if (!pkg) throw new Error('Le dossier d’audit ou son empreinte ne correspond pas à un export de cette application.');
    const seen = new Set();
    const rows = report.observations.map(o => {
      if (!o || typeof o !== 'object' || !OBSERVATION_TYPES.includes(o.type)) throw new Error('Type d’observation invalide.');
      const oid = required(o.id, 'L’identifiant d’observation', 150);
      if (seen.has(oid)) throw new Error('Observation en double.'); seen.add(oid);
      if (!pkg.evaluationIds.includes(o.evaluationId)) throw new Error('Une observation concerne un objet hors du périmètre exporté.');
      const e = getEvaluation(s, o.evaluationId);
      return { id: oid, packageId: pkg.id, evaluationId: e.id, evaluationVersion: pkg.evaluationVersions[e.id], type: o.type, text: required(o.text, 'Le texte de l’observation', 10000), author: required(o.author, 'L’auteur déclaré', 200), at: required(o.at, 'La date', 100), changedSinceExport: e.version !== pkg.evaluationVersions[e.id] };
    });
    return { pkg, rows };
  }
  function importObservationReport(s, report) {
    const { rows } = checkObservationReport(s, report); let added = 0;
    // Vérification de tout le lot avant ajout : pas d'import partiel en cas de conflit.
    for (const row of rows) {
      const old = s.df.observations.find(o => o.id === row.id && o.packageId === row.packageId);
      if (old && (old.text !== row.text || old.type !== row.type || old.author !== row.author)) throw new Error('Une observation déjà reçue a été modifiée. Demandez un nouvel identifiant.');
    }
    for (const row of rows) {
      const old = s.df.observations.find(o => o.id === row.id && o.packageId === row.packageId);
      if (old) {
        if (old.text !== row.text || old.type !== row.type || old.author !== row.author) throw new Error('Une observation déjà reçue a été modifiée. Demandez un nouvel identifiant.');
        continue;
      }
      const o = { ...row, receivedAt: now(), validation: 'À examiner', decision: '', reviewer: '', reviewedAt: '' };
      s.df.observations.push(o); log(s, 'Réception d’observation (non validée)', 'observation', o.id, null, o); added++;
    }
    return added;
  }
  function reviewObservation(s, observationId, fields) {
    const o = initialise(s).df.observations.find(x => x.id === observationId);
    if (!o) throw new Error('Observation introuvable.');
    if (!['À examiner', 'Confirmée en interne', 'Contestée', 'Classée'].includes(fields.validation)) throw new Error('Décision invalide.');
    const next = { validation: fields.validation, decision: required(fields.decision, 'La justification'), reviewer: required(fields.reviewer, 'Le responsable de la décision', 200), reviewedAt: date(required(fields.reviewedAt, 'La date de décision')) };
    const before = clone(o); Object.assign(o, next); log(s, 'Décision sur observation, sans réévaluation automatique', 'observation', o.id, before, o);
    return o;
  }
  function evaluationRows(s, dossierId) {
    const dossiers = dossierId ? [getDossier(s, dossierId)] : initialise(s).df.dossiers;
    const ids = new Set(dossiers.map(d => d.id));
    return s.df.evaluations.filter(e => ids.has(e.dossierId)).map(e => {
      const d = dossiers.find(x => x.id === e.dossierId);
      return { Dossier: d.title, Type: d.kind === 'CARE' ? 'CaRE' : 'HAS', Domaine: d.domain, Périmètre: d.scope.join(' ; '), Référentiel: d.frameworkName, Version: d.frameworkVersion, Référence: e.requirementId, Libellé: e.requirement.title, Chapitre: e.requirement.chapter, Applicabilité: e.requirement.applicability || e.requirement.scope, 'Objectif local': e.custom ? 'Oui — non officiel' : 'Non', Statut: e.status, 'Avancement déclaré (%)': d.kind === 'CARE' ? e.progress : '', Responsable: e.owner, Échéance: e.due, 'Justification non-applicabilité': e.applicabilityReason, Notes: e.notes, Vérificateur: e.reviewer, 'Vérification interne': e.reviewedAt, Preuves: e.proofRefs.map(r => r.evidenceId + '/' + r.versionId).join(' ; '), Actions: e.findingIds.join(' ; '), Mesures: e.measureIds.join(' ; '), Source: e.requirement.sourceUrl, Page: e.requirement.sourcePage, 'Version évaluation': e.version };
    });
  }
  // Évite l'interprétation de cellules en formules dans les fichiers bureautiques.
  function spreadsheetText(v) { return typeof v === 'string' && /^[=+@-]/.test(v.trimStart()) ? "'" + v : v; }
  function validateState(state) {
    const s = initialise(state), ids = new Set(), eids = new Set();
    if (s.df.dossiers.length > 3000 || s.df.evaluations.length > 100000 || s.df.budgets.length > 30000) throw new Error('Sauvegarde D/F trop volumineuse.');
    for (const d of s.df.dossiers) {
      if (!d || ids.has(d.id) || !['CARE', 'HAS'].includes(d.kind) || !Array.isArray(d.scope) || !d.scope.length) throw new Error('Dossier invalide dans la sauvegarde.');
      required(d.id, 'L’identifiant', 150); required(d.title, 'Le titre'); ids.add(d.id);
      for (const scope of d.scope) required(scope, 'Le périmètre', 200);
      date(d.start); date(d.due);
    }
    for (const e of s.df.evaluations) {
      if (!e || eids.has(e.id) || !ids.has(e.dossierId) || !e.requirement || !Array.isArray(e.proofRefs) || !Array.isArray(e.findingIds) || !Array.isArray(e.measureIds) || !Array.isArray(e.history) || !Number.isSafeInteger(e.version) || e.version < 1) throw new Error('Évaluation invalide dans la sauvegarde.');
      const d = s.df.dossiers.find(d => d.id === e.dossierId);
      if (!(d.kind === 'CARE' ? CARE_STATUSES : HAS_STATUSES).includes(e.status) || !Number.isInteger(e.progress) || e.progress < 0 || e.progress > 100) throw new Error('Situation d’évaluation invalide.');
      required(e.id, 'L’identifiant', 150); required(e.requirementId, 'La référence', 100); required(e.requirement.title, 'Le libellé'); eids.add(e.id); date(e.due); date(e.reviewedAt);
      for (const r of e.proofRefs) if (!r || typeof r.evidenceId !== 'string' || typeof r.versionId !== 'string') throw new Error('Rattachement de preuve invalide.');
    }
    for (const b of s.df.budgets) {
      if (!b || !ids.has(b.dossierId) || !Array.isArray(b.history) || !Array.isArray(b.proofRefs)) throw new Error('Ligne budgétaire invalide.');
      budgetTotals([b]);
    }
    for (const p of s.evidences) for (const v of list(p.dfVersions)) if (!v || !/^[a-f0-9]{64}$/.test(v.sha256 || '') || !Number.isSafeInteger(v.size) || v.size < 1 || v.size > 20 * 1024 * 1024 || typeof v.fileKey !== 'string') throw new Error('Version de pièce invalide.');
    return s;
  }
  return { VERSION, CARE_STATUSES, HAS_STATUSES, OBSERVATION_TYPES, MONEY_FIELDS, DOMAIN_IDS, initialise, validateState, safeJson, cleanText, required, date, sourceUrl, parseMoney, formatMoney, amountInput, clone, id, now, log, importFramework, verifyFramework, createDossier, updateDossier, archiveDossier, getDossier, getEvaluation, addLocalObjective, updateEvaluation, proofVersion, proofValidation, createProof, addProofVersion, validateProof, attachProof, detachProof, createAction, attachFinding, linkMeasures, upsertBudget, budgetTotals, stats, buildAuditPackage, registerAuditPackage, checkObservationReport, importObservationReport, reviewObservation, evaluationRows, spreadsheetText };
});
