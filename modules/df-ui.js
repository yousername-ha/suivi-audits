/* Intégration native dans le menu et les composants de la copie legacy. */
(function () {
  'use strict';
  const C = window.LegacyDF, Store = window.LegacyDFStore;
  let api, selectedFile, dialog, busy = false;
  const navSections = {};
  const MONEY_LABELS = { planned: 'Budget prévu', committed: 'Engagé', spent: 'Réalisé', declared: 'Déclaré', requested: 'Financement demandé', notified: 'Financement notifié', received: 'Financement reçu' };
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const shortDate = v => v ? new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR') : '—';
  const today = () => new Date().toLocaleDateString('en-CA');
  const s = () => C.initialise(api.getState());
  const u = () => api.ui;
  const kind = () => u().tab === 'care' ? 'CARE' : 'HAS';
  const label = k => k === 'CARE' ? 'CaRE' : 'HAS';
  const stateKey = k => k === 'CARE' ? 'careDossier' : 'hasDossier';
  const dossiers = k => s().df.dossiers.filter(d => d.kind === k && (u().dfArchived ? d.archived : !d.archived));
  const selectedDossier = k => dossiers(k).find(d => d.id === u()[stateKey(k)]) || null;
  const chosen = k => { const d = selectedDossier(k); return d ? [d] : dossiers(k); };
  const button = (text, act, attrs = '', primary = false) => `<button class="btn${primary ? ' primary' : ''}" data-df-act="${act}" ${attrs}>${esc(text)}</button>`;
  const pill = status => `<span class="df-pill ${['Atteint', 'Conforme', 'Acceptée en interne', 'Confirmée en interne'].includes(status) ? 'ok' : ['En cours', 'Partiel', 'À vérifier', 'En revue'].includes(status) ? 'mid' : ['Non conforme', 'Refusée en interne', 'À corriger', 'En retard'].includes(status) ? 'bad' : ''}">${esc(status)}</span>`;
  const option = (v, text, current) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(text)}</option>`;
  const textField = (name, text, value = '', opts = {}) => `<label class="df-field${opts.full ? ' full' : ''}">${esc(text)}${opts.area ? `<textarea name="${name}" rows="${opts.rows || 3}" maxlength="10000">${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}" type="${opts.type || 'text'}" ${opts.required ? 'required' : ''} ${opts.type === 'number' ? `min="${opts.min == null ? 0 : opts.min}" max="${opts.max || 100}" step="1"` : ''} ${opts.type === 'text' || !opts.type ? 'maxlength="500"' : ''}>`}${opts.help ? `<small>${esc(opts.help)}</small>` : ''}</label>`;
  const selectField = (name, text, values, current, full) => `<label class="df-field${full ? ' full' : ''}">${esc(text)}<select name="${name}">${values.map(v => option(Array.isArray(v) ? v[0] : v, Array.isArray(v) ? v[1] : v, current)).join('')}</select></label>`;
  const checkField = (name, value, text, checked) => `<label class="df-check"><input type="checkbox" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}> <span>${esc(text)}</span></label>`;
  const empty = (title, text, action = '') => `<div class="df-empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  const note = text => `<div class="df-note">${text}</div>`;
  const stat = (text, n, sub) => `<div class="df-stat"><span>${esc(text)}</span><strong>${esc(n == null ? '—' : n)}</strong><small>${esc(sub || '')}</small></div>`;
  function sourceLink(url, text = 'Consulter la source') {
    try { const safe = C.sourceUrl(url, false); return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`; }
    catch (_) { return '<span class="df-muted">Source non renseignée</span>'; }
  }
  function header(k, title, text, actions = '') {
    return `<div class="df-head"><div><div class="df-eyebrow">Pilotage ${label(k)} · version locale</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="df-actions">${actions}</div></div>`;
  }
  function dossierPicker(k, includeArchive = true) {
    return `<div class="df-toolbar"><label>Dossier <select data-df-filter="${stateKey(k)}" data-ro-ok>${option('', 'Tous les dossiers', u()[stateKey(k)])}${dossiers(k).map(d => option(d.id, d.title + (d.domain ? ' · ' + d.domain : ''), u()[stateKey(k)])).join('')}</select></label>${includeArchive ? `<label><input type="checkbox" data-df-filter="dfArchived" ${u().dfArchived ? 'checked' : ''} data-ro-ok> Archives</label>` : ''}${button('Créer ' + (k === 'CARE' ? 'un suivi' : 'une campagne'), 'new-dossier', `data-kind="${k}"`, true)}</div>`;
  }
  function activeEvaluations(k) {
    const ids = new Set(chosen(k).map(d => d.id));
    const q = (u().dfQuery || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return s().df.evaluations.filter(e => ids.has(e.dossierId)).filter(e => !u().dfStatus || e.status === u().dfStatus).filter(e => !u().dfChapter || e.requirement.chapter === u().dfChapter).filter(e => !u().dfLate || (e.due && e.due < today() && !['Atteint', 'Conforme', 'Non applicable'].includes(e.status))).filter(e => !q || (e.requirementId + ' ' + e.requirement.title + ' ' + e.owner + ' ' + e.notes).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q));
  }
  function rootView(k) {
    ensureCatalog();
    if (u().dfFilterKind !== k) { u().dfFilterKind = k; u().dfStatus = ''; u().dfChapter = ''; u().dfQuery = ''; u().dfLate = false; u().dfPage = 0; }
    const view = u()[k === 'CARE' ? 'careView' : 'hasView'] || 'dash';
    return '<div class="df-root">' + ({ dash: () => dashboard(k), dossiers: () => dossierView(k), grid: () => gridView(k), budget: () => budgetView(), proofs: () => proofsView(k), actions: () => actionsView(k), sources: () => sourcesView(k), audit: () => auditView(k) }[view] || (() => dashboard(k)))() + '</div>';
  }
  function dashboard(k) {
    const ds = chosen(k), stats = C.stats(s(), ds), budget = C.budgetTotals(s().df.budgets.filter(b => ds.some(d => d.id === b.dossierId)));
    let content = header(k, k === 'CARE' ? 'Piloter le programme CaRE' : 'Préparer et suivre les évaluations HAS', k === 'CARE' ? 'Objectifs, justificatifs, actions et financements réunis dans un même suivi.' : 'Une grille versionnée, des évaluations documentées et un dossier limité pour les auditeurs.', button('Créer ' + (k === 'CARE' ? 'un suivi' : 'une campagne'), 'new-dossier', `data-kind="${k}"`, true));
    content += dossierPicker(k) + `<div class="df-cards">${stat(k === 'CARE' ? 'Objectifs atteints' : 'Conformes en interne', stats.done, 'sur ' + stats.applicable + ' critères applicables')}${stat('Échéances dépassées', stats.overdue, 'évaluations encore ouvertes')}${stat('Sans preuve rattachée', stats.missing, 'critères applicables')}${stat('Actions à suivre', stats.openActions, 'registre partagé des écarts et actions')}</div>`;
    content += note(k === 'CARE' ? '<strong>Suivi opérationnel.</strong> L’avancement est déclaré par les responsables. Une validation interne ne vaut ni éligibilité ni financement accordé.' : '<strong>Évaluation interne.</strong> Les résultats ci-dessous ne sont ni une décision de certification HAS ni une cotation officielle. L’applicabilité se justifie critère par critère.');
    if (!ds.length) content += empty(k === 'CARE' ? 'Votre premier suivi CaRE' : 'Votre première campagne HAS', 'Choisissez un périmètre et une version de référentiel pour démarrer.', button('Créer ' + (k === 'CARE' ? 'un suivi CaRE' : 'une campagne HAS'), 'new-dossier', `data-kind="${k}"`, true));
    if (k === 'CARE') {
      content += '<div class="df-grid">' + C.DOMAIN_IDS.map(domain => {
        const rows = ds.filter(d => d.domain === domain), st = C.stats(s(), rows), fw = s().frameworks.find(f => f.dfKind === 'CARE' && f.domain === domain);
        const info = (window.LegacyDFCatalog || {}).domains && window.LegacyDFCatalog.domains.find(x => x.id === domain);
        return `<article class="df-card"><div class="df-eyebrow">Domaine ${esc(domain)}</div><h3>${esc(info ? info.name : domain)}</h3><p>${rows.length} dossier(s) · ${st.done}/${st.applicable} objectif(s) atteint(s)</p>${st.progress == null ? '<p class="df-muted">Aucun avancement renseigné.</p>' : `<div class="df-progress" aria-label="Avancement déclaré : ${st.progress} %"><span style="width:${st.progress}%"></span></div><p>${st.progress} % d’avancement déclaré</p>`}<span class="df-pill">${esc(fw ? fw.sourceStatus : 'Suivi générique — source à intégrer')}</span><div class="df-actions">${button('Nouveau suivi', 'new-dossier', `data-kind="CARE" data-domain="${domain}"`)}</div></article>`;
      }).join('') + `<article class="df-card"><div class="df-eyebrow">Finances · sélection courante</div><h3>${esc(C.formatMoney(budget.spent))} réalisés</h3><p>Budget prévu : ${esc(C.formatMoney(budget.planned))}</p><p>Financement notifié : ${esc(C.formatMoney(budget.notified))}</p><p>Reçu : ${esc(C.formatMoney(budget.received))}</p><div class="df-actions">${button('Voir les budgets', 'go', 'data-view="budget"')}</div></article></div>`;
    } else if (ds.length) {
      content += '<div class="df-grid">' + ds.map(d => dossierCard(d)).join('') + '</div>';
    }
    const ids = new Set(ds.map(d => d.id));
    const alerts = s().df.evaluations.filter(e => ids.has(e.dossierId) && e.due && !['Atteint', 'Conforme', 'Non applicable'].includes(e.status)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);
    if (alerts.length) content += `<section class="df-card df-section"><h3>Prochaines échéances</h3><ul class="df-list">${alerts.map(e => `<li><div><strong>${esc(e.requirementId)} · ${esc(e.requirement.title)}</strong><p>${esc(e.owner || 'Responsable à préciser')} · ${shortDate(e.due)}</p></div>${button('Ouvrir', 'evaluation', `data-id="${e.id}"`)}</li>`).join('')}</ul></section>`;
    return content;
  }
  function dossierCard(d) {
    const st = C.stats(s(), [d]);
    return `<article class="df-card"><div class="df-eyebrow">${esc(d.domain || d.frameworkVersion || 'Campagne')}</div><h3>${esc(d.title)}</h3><p>${esc(d.scope.join(' · '))}</p><div class="df-meta"><span>${esc(d.owner || 'Responsable à préciser')}</span><span>${shortDate(d.due)}</span><span>${esc(d.frameworkVersion || 'Objectifs locaux')}</span></div>${pill(d.archived ? 'Archivé' : d.status)}<p>${st.total} critère(s) · ${st.done} validé(s) en interne · ${st.overdue} retard(s)</p><div class="df-actions">${button('Ouvrir la grille', 'select-dossier', `data-id="${d.id}" data-kind="${d.kind}"`)}${button('Paramètres', 'edit-dossier', `data-id="${d.id}"`)}</div></article>`;
  }
  function dossierView(k) {
    const ds = dossiers(k);
    return header(k, k === 'CARE' ? 'Suivis CaRE' : 'Campagnes HAS', 'Chaque dossier conserve son périmètre, sa version de référentiel et ses décisions.') + dossierPicker(k) + (ds.length ? '<div class="df-grid">' + ds.map(dossierCard).join('') + '</div>' : empty('Aucun dossier', 'Créez un suivi pour commencer.'));
  }
  function gridView(k) {
    const rows = activeEvaluations(k), selected = selectedDossier(k), all = s().df.evaluations.filter(e => chosen(k).some(d => d.id === e.dossierId)), chapters = [...new Set(all.map(e => e.requirement.chapter).filter(Boolean))];
    let out = header(k, k === 'CARE' ? 'Objectifs et validations' : 'Grille d’évaluation HAS', 'Ouvrez un critère pour renseigner sa situation, ses preuves et ses actions.', button('Excel', 'export-excel', `data-kind="${k}"`) + button('Rapport PDF', 'report', `data-kind="${k}"`));
    out += dossierPicker(k) + `<div class="df-toolbar"><label>Rechercher <input data-df-search value="${esc(u().dfQuery || '')}" placeholder="Référence, libellé, responsable" data-ro-ok></label><label>Statut <select data-df-filter="dfStatus" data-ro-ok>${option('', 'Tous', u().dfStatus)}${(k === 'CARE' ? C.CARE_STATUSES : C.HAS_STATUSES).map(x => option(x, x, u().dfStatus)).join('')}</select></label><label>Chapitre <select data-df-filter="dfChapter" data-ro-ok>${option('', 'Tous', u().dfChapter)}${chapters.map(x => option(x, x, u().dfChapter)).join('')}</select></label><label><input type="checkbox" data-df-filter="dfLate" ${u().dfLate ? 'checked' : ''} data-ro-ok> En retard</label>${selected && k === 'CARE' ? button('+ Objectif local', 'new-objective', `data-id="${selected.id}"`, true) : ''}</div>`;
    if (!rows.length) return out + empty('Aucun critère pour cette sélection', k === 'CARE' ? 'Sélectionnez un dossier puis ajoutez vos objectifs locaux, ou importez une grille officielle vérifiée depuis Sources et sauvegarde.' : 'Créez une campagne ou ajustez les filtres.');
    const page = Math.max(0, Math.min(Number(u().dfPage) || 0, Math.ceil(rows.length / 50) - 1)), pageRows = rows.slice(page * 50, (page + 1) * 50);
    out += `<div class="df-muted">${rows.length} critère(s) · page ${page + 1}/${Math.ceil(rows.length / 50)}</div><div class="df-table-wrap"><table class="df-table df-evaluation-table"><thead><tr><th>Critère / objectif</th>${selected ? '' : '<th>Dossier</th>'}<th>Situation</th><th>Responsable</th><th>Échéance</th><th>Justificatifs</th></tr></thead><tbody>${pageRows.map(e => {
      const d = C.getDossier(s(), e.dossierId), late = e.due && e.due < today() && !['Atteint', 'Conforme', 'Non applicable'].includes(e.status);
      return `<tr><td><button class="btn link" data-df-act="evaluation" data-id="${e.id}"><strong>${esc(e.requirementId)}</strong>${esc(e.requirement.title)}</button><span class="df-sub">${esc(e.requirement.chapter)}${e.custom ? ' · Objectif local, non officiel' : ''}${e.requirement.level ? ' · ' + esc(e.requirement.level) : ''}</span></td>${selected ? '' : `<td data-label="Dossier">${esc(d.title)}</td>`}<td data-label="Situation">${pill(e.status)}${k === 'CARE' ? `<span class="df-sub">${e.progress} % déclaré</span>` : ''}</td><td data-label="Responsable">${esc(e.owner || '—')}</td><td data-label="Échéance">${shortDate(e.due)}${late ? '<span class="df-sub">En retard</span>' : ''}</td><td data-label="Justificatifs">${e.proofRefs.filter(r => C.proofVersion(s(), r)).length} preuve(s)<span class="df-sub">${e.findingIds.length} action(s)</span></td></tr>`;
    }).join('')}</tbody></table></div><div class="df-actions">${page > 0 ? button('Précédent', 'page', `data-page="${page - 1}"`) : ''}${(page + 1) * 50 < rows.length ? button('Suivant', 'page', `data-page="${page + 1}"`) : ''}</div>`;
    return out;
  }
  function budgetView() {
    const ds = chosen('CARE'), rows = s().df.budgets.filter(b => ds.some(d => d.id === b.dossierId)), totals = C.budgetTotals(rows);
    return header('CARE', 'Budgets et financements', 'Montants saisis, pièces et historique. Les calculs portent uniquement sur les sommes enregistrées.', button('Ajouter une ligne', 'new-budget', '', true) + button('Excel', 'export-excel', 'data-kind="CARE"') + button('Rapport PDF', 'report', 'data-kind="CARE"')) + dossierPicker('CARE') + note('Les montants <strong>demandés, notifiés et reçus restent distincts</strong>. Aucun taux d’aide ni calcul d’éligibilité automatique. Les montants sont conservés en centimes, en euros.') + `<div class="df-cards">${stat('Budget prévu', C.formatMoney(totals.planned), 'sélection courante')}${stat('Dépenses réalisées', C.formatMoney(totals.spent), 'pièces rattachables')}${stat('Écart prévu − réalisé', C.formatMoney(totals.remaining), 'peut être négatif')}${stat('Financement restant à recevoir', C.formatMoney(totals.fundingRemaining), 'notifié − reçu')}</div>` + (rows.length ? `<div class="df-table-wrap"><table class="df-table"><thead><tr><th>Ligne / exercice</th><th>Dossier</th>${C.MONEY_FIELDS.map(k => `<th>${MONEY_LABELS[k]}</th>`).join('')}<th>Pièces</th></tr></thead><tbody>${rows.map(b => `<tr><td><button class="btn link" data-df-act="edit-budget" data-id="${b.id}"><strong>${esc(b.label)}</strong>${b.year}</button></td><td>${esc(C.getDossier(s(), b.dossierId).title)}</td>${C.MONEY_FIELDS.map(k => `<td class="df-money">${esc(C.formatMoney(b[k]))}</td>`).join('')}<td>${b.proofRefs.length}</td></tr>`).join('')}<tr><td><strong>Total</strong></td><td></td>${C.MONEY_FIELDS.map(k => `<td class="df-money"><strong>${esc(C.formatMoney(totals[k]))}</strong></td>`).join('')}<td></td></tr></tbody></table></div>` : empty('Aucune ligne budgétaire', 'Créez un suivi CaRE puis renseignez vos dépenses et financements.'));
  }
  function proofsView(k) {
    const ids = new Set(s().df.evaluations.filter(e => chosen(k).some(d => d.id === e.dossierId)).map(e => e.id));
    const rows = s().evidences.filter(p => !u().dfProofLinked || (p.links && (p.links.dfEvaluations || []).some(x => ids.has(x))));
    return header(k, 'Preuves et versions', 'Le registre est commun à toute la version legacy. Chaque évaluation référence une version précise.', button('Ajouter une preuve', 'new-proof', '', true) + button('Sauvegarde complète', 'backup')) + `<div class="df-toolbar"><label><input type="checkbox" data-df-filter="dfProofLinked" ${u().dfProofLinked ? 'checked' : ''} data-ro-ok> Liées à la sélection ${label(k)}</label></div>` + note('Les fichiers sont stockés <strong>sur le serveur local</strong>. Une sauvegarde JSON contient leurs métadonnées ; utilisez la <strong>sauvegarde complète ZIP</strong> pour conserver les pièces physiques. « Acceptée en interne » ne vaut pas acceptation par l’ANS ou la HAS.') + (rows.length ? `<div class="df-table-wrap"><table class="df-table"><thead><tr><th>Preuve</th><th>Classification</th><th>Responsable</th><th>Versions</th><th>Dernière vérification</th><th>Liens</th></tr></thead><tbody>${rows.map(p => {
      const v = (p.dfVersions || []).at(-1), val = v ? C.proofValidation(s(), { evidenceId: p.id, versionId: v.id }) : C.proofValidation(s(), { evidenceId: p.id, versionId: 'legacy' });
      return `<tr><td><button class="btn link" data-df-act="proof" data-id="${esc(p.id)}"><strong>${esc(p.id)}</strong>${esc(p.title)}</button></td><td>${esc(p.classification || 'INTERNE')}</td><td>${esc(p.owner || '—')}</td><td>${(p.dfVersions || []).length}${p.location ? ' + lien externe' : ''}</td><td>${val ? pill(val.status) : '<span class="df-muted">À vérifier</span>'}</td><td>${(p.links && p.links.dfEvaluations || []).length} évaluation(s)</td></tr>`;
    }).join('')}</tbody></table></div>` : empty('Aucune preuve pour ce filtre', 'Ajoutez une pièce ou utilisez les preuves déjà présentes dans le registre legacy.'));
  }
  function actionsView(k) {
    const ids = new Set(s().df.evaluations.filter(e => chosen(k).some(d => d.id === e.dossierId)).flatMap(e => e.findingIds)), rows = s().findings.filter(f => ids.has(f.id));
    return header(k, 'Actions de traitement', 'Les actions appartiennent au plan partagé. Leur réalisation ne valide pas automatiquement un objectif ou un critère.') + dossierPicker(k) + (rows.length ? `<div class="df-table-wrap"><table class="df-table"><thead><tr><th>Action</th><th>Responsable</th><th>Échéance</th><th>Statut</th><th>Tâches réalisées</th></tr></thead><tbody>${rows.map(f => `<tr><td><button class="btn link" data-df-act="legacy-finding" data-id="${esc(f.id)}"><strong>${esc(f.id)}</strong>${esc(f.text)}</button></td><td>${esc(f.owner || '—')}</td><td>${shortDate(f.due)}</td><td>${pill(f.status)}</td><td>${(f.tasks || []).filter(t => t.done).length}/${(f.tasks || []).length}</td></tr>`).join('')}</tbody></table></div>` : empty('Aucune action rattachée', 'Depuis la fiche d’un critère, créez une action ou rattachez une action existante.'));
  }
  function sourcesView(k) {
    const frameworks = s().frameworks.filter(f => f.dfKind === k), catalog = window.LegacyDFCatalog || {}, sources = (catalog.sources || []).filter(x => x.kind === k);
    return header(k, 'Sources et sauvegarde', 'Documents institutionnels, versions importées et conservation locale des données.', button('Importer une grille JSON', 'framework-import', `data-kind="${k}"`)) + '<div class="df-grid">' + sources.map(f => `<article class="df-card"><div class="df-eyebrow">${esc(f.publisher)} · ${esc(f.version || 'version à vérifier')}</div><h3>${esc(f.title)}</h3><p>${esc(f.status)}</p><p class="df-muted">Vérification : ${shortDate(f.checkedAt)}${f.publishedAt ? ' · Publication : ' + shortDate(f.publishedAt) : ''}</p>${sourceLink(f.url)}<p class="df-muted">${esc(f.reuse || '')}</p></article>`).join('') + '</div>' + `<section class="df-card df-section"><h3>Versions disponibles dans le registre partagé</h3>${frameworks.length ? `<ul class="df-list">${frameworks.map(f => `<li><div><strong>${esc(f.name)} · ${esc(f.version)}</strong><p>${f.requirements.length} critère(s) · ${esc(f.sourceStatus)}</p>${sourceLink(f.sourceUrl)}<p>${esc(f.reuse || '')}</p></div>${button('Tracer une vérification', 'verify-framework', `data-id="${f.id}"`)}</li>`).join('')}</ul>` : '<p>Aucune grille importée. Le suivi générique CaRE permet de travailler avec des objectifs locaux clairement distingués.</p>'}<div class="df-actions">${button('Modèle JSON', 'framework-template', `data-kind="${k}"`)}</div></section><div class="df-grid df-section"><section class="df-card"><h3>Sauvegarder sur un autre support</h3><p>La sauvegarde complète contient l’état legacy, les lots D/F et toutes les versions des pièces jointes. Le fichier peut contenir des données confidentielles.</p><div class="df-actions">${button('Télécharger la sauvegarde complète', 'backup', '', true)}${button('Exporter les données JSON', 'json')}</div></section><section class="df-card"><h3>Restaurer vos données</h3><p>Importez une sauvegarde complète ZIP ou un JSON legacy. Une confirmation précède le remplacement. Les fichiers ZIP sont contrôlés par SHA-256.</p><div class="df-actions">${button('Restaurer un ZIP', 'restore')}${button('Importer un JSON legacy', 'import-legacy')}</div></section><section class="df-card"><h3>Identité de traçabilité</h3><p>Compte connecté : <strong>${esc(window.LegacyServer.user()?.name || s().df.actor)}</strong>. Le serveur enregistre l’auteur authentifié de chaque opération. Les habilitations et rôles se règlent dans Périmètres.</p></section><section class="df-card"><h3>Historique des opérations</h3><p>${s().df.history.length} opération(s) conservée(s). Les exports de rapport incluent les décisions pertinentes.</p><div class="df-actions">${button('Consulter l’historique', 'history')}</div></section></div>`;
  }
  function auditView(k) {
    const rows = s().df.observations.filter(o => { const e = s().df.evaluations.find(e => e.id === o.evaluationId); return e && C.getDossier(s(), e.dossierId).kind === k; });
    return header(k, 'Dossiers auditeur et observations', 'Transmettez uniquement les critères et pièces sélectionnés. Les observations reçues restent à examiner.', button('Préparer un dossier auditeur', 'audit-package', '', true) + button('Importer des observations', 'observations-import') + button('Rapport PDF', 'report', `data-kind="${k}"`)) + note('<strong>Accès limité par le contenu remis.</strong> Le dossier exporté ne contient pas les autres objets de l’application. Il fonctionne hors ligne, sans connexion à votre registre. Les données déjà remises ne peuvent pas être révoquées à distance.') + `<div class="df-cards">${stat('Dossiers exportés', s().df.auditPackages.length, 'sélections traçables')}${stat('Observations reçues', rows.length, 'auteur déclaré par l’auditeur')}${stat('À examiner', rows.filter(o => o.validation === 'À examiner').length, 'aucun changement automatique du registre')}${stat('Confirmées en interne', rows.filter(o => o.validation === 'Confirmée en interne').length, 'décision du responsable')}</div>` + (rows.length ? `<div class="df-table-wrap"><table class="df-table"><thead><tr><th>Type / critère</th><th>Observation</th><th>Auteur déclaré</th><th>Décision</th><th></th></tr></thead><tbody>${rows.map(o => `<tr><td><strong>${esc(o.type)}</strong>${esc(C.getEvaluation(s(), o.evaluationId).requirementId)}${o.changedSinceExport ? '<span class="df-sub">Évaluation modifiée depuis l’export</span>' : ''}</td><td>${esc(o.text)}</td><td>${esc(o.author)}</td><td>${pill(o.validation)}<span class="df-sub">${esc(o.decision)}</span></td><td>${button('Examiner', 'review-observation', `data-id="${esc(o.id)}"`)}</td></tr>`).join('')}</tbody></table></div>` : empty('Aucune observation reçue', 'Exportez un dossier, puis importez le fichier JSON remis par l’auditeur.')) + `<section class="df-card df-section"><h3>Historique des dossiers remis</h3><ul class="df-list">${s().df.auditPackages.slice().reverse().map(p => `<li><div><strong>${esc(p.title)}</strong><p>${shortDate(p.createdAt)} · ${p.evaluationIds.length} critère(s) · ${esc(p.auditor || 'Auditeur à préciser')}</p><p>Empreinte ${esc(p.fingerprint.slice(0, 16))}…</p></div></li>`).join('') || '<li>Aucun dossier exporté.</li>'}</ul></section>`;
  }
  function modal(title, body, form, data = {}) {
    selectedFile = null;
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'df-dialog'; dialog.id = 'dfDialog'; document.body.appendChild(dialog); dialog.addEventListener('click', e => { if (e.target === dialog && !busy) dialog.close(); }); }
    dialog.innerHTML = `<div class="df-dialog-head"><h2 id="dfDialogTitle">${esc(title)}</h2><button type="button" data-df-act="close" aria-label="Fermer">×</button></div><div class="df-dialog-body">${form ? `<form data-df-form="${form}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join('')}>` : ''}${body}<div id="dfError" class="df-error" role="alert" hidden></div>${form ? '<div class="df-form-actions"><button type="button" class="btn" data-df-act="close">Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div></form>' : ''}</div>`;
    dialog.setAttribute('aria-labelledby', 'dfDialogTitle');
    if (!dialog.open) dialog.showModal();
    if (api.readOnly()) { dialog.querySelectorAll('[data-df-write],form [name],form [type="submit"]').forEach(x => x.disabled = true); }
    (dialog.querySelector('input:not([type="checkbox"]),textarea,select') || dialog.querySelector('button')).focus();
  }
  function error(e) { const el = dialog && dialog.open && dialog.querySelector('#dfError'); if (el) { el.hidden = false; el.textContent = e.message || String(e); } else api.toast(e.message || String(e)); }
  function guard() { if (api.readOnly()) throw new Error('Le mode lecture seule interdit cette modification.'); }
  async function persist(rerender = true) { api.touch(false); await window.LegacyServer.flush(); if (rerender) api.render(); }
  function ensureCatalog() {
    const data = (window.LegacyDFCatalog || {}).frameworks || [];
    let added=0;for (const f of data) if (!s().frameworks.some(x => x.id === f.id)){s().frameworks.push(C.clone(f));added++;}return added;
  }
  function dossierModal(k, dossierId, domain = 'D1') {
    const d = dossierId ? C.getDossier(s(), dossierId) : null, frames = s().frameworks.filter(f => f.dfKind === k);
    const chosenDomain = d ? d.domain : domain;
    modal(d ? 'Paramètres du dossier' : k === 'CARE' ? 'Créer un suivi CaRE' : 'Créer une campagne HAS', `<div class="df-form">${textField('title', 'Nom du dossier', d ? d.title : '', { required: true, full: true })}${!d && k === 'CARE' ? selectField('domain', 'Domaine CaRE', C.DOMAIN_IDS, chosenDomain) : ''}${!d ? selectField('frameworkId', 'Version du référentiel', [...(k === 'CARE' ? [['', 'Suivi générique — objectifs locaux']] : [['', 'Sélectionner une version HAS']]), ...frames.map(f => [f.id, (f.domain ? f.domain + ' · ' : '') + f.name + ' · ' + f.version])], '', true) : textField('frameworkInfo', 'Référentiel retenu (immuable)', d.frameworkName + ' · ' + (d.frameworkVersion || 'local'), { full: true, help: 'Une nouvelle version nécessite un nouveau dossier ; le passé n’est pas recalculé.' })}${textField('scope', 'Périmètre(s) concernés', d ? d.scope.join('\n') : '', { area: true, full: true, help: 'Un établissement, entité ou groupement par ligne. Aucune règle d’éligibilité déduite.' })}${window.LegacyIntegrationUI.toolkit.scopes(d ? d.perimeterIds : [])}${window.LegacyIntegrationUI.toolkit.responsible(d && d.responsible,d ? d.perimeterIds : [])}${textField('owner', 'Responsable historique (conservé)', d ? d.owner : '')}${d ? selectField('status', 'Statut du dossier', ['En préparation', 'En cours', 'En revue', 'Clos'], d.status) : ''}${textField('start', 'Date de début', d ? d.start : '', { type: 'date' })}${textField('due', 'Échéance', d ? d.due : '', { type: 'date' })}</div>${k === 'HAS' ? note('La campagne reprend la version sélectionnée. Les statuts et validations sont internes. L’applicabilité de chaque critère reste à vérifier selon les activités de l’établissement.') : note('Un objectif ajouté au suivi générique est identifié comme <strong>local et non officiel</strong>. Les règles de candidature et de financement ne sont pas inventées.')}${d ? `<div class="df-actions df-section">${button(d.archived ? 'Réouvrir le dossier' : 'Archiver le dossier', 'archive-dossier', `data-id="${d.id}"`)}</div>` : ''}`, 'dossier', { kind: k, id: dossierId || '' });
    if (d) dialog.querySelector('[name="frameworkInfo"]').readOnly = true;
  }
  function objectiveModal(dossierId) {
    modal('Ajouter un objectif local', note('Cet objectif est un choix de suivi local. Il ne sera jamais présenté comme une exigence officielle CaRE.') + `<div class="df-form">${textField('reference', 'Référence locale', '', { help: 'Facultative ; une référence stable est générée sinon.' })}${textField('title', 'Libellé', '', { required: true })}${textField('description', 'Description', '', { area: true, full: true })}${textField('sourceUrl', 'Source documentaire (facultative)', '', { type: 'url', full: true })}${textField('prerequisites', 'Prérequis', '', { area: true })}${textField('criteria', 'Critères de vérification', '', { area: true })}</div>`, 'objective', { id: dossierId });
  }
  function evaluationModal(evaluationId) {
    const e = C.getEvaluation(s(), evaluationId), d = C.getDossier(s(), e.dossierId), r = e.requirement;
    const proofs = e.proofRefs.map(ref => { const p = s().evidences.find(x => x.id === ref.evidenceId), v = C.proofVersion(s(), ref), validation = C.proofValidation(s(), ref); return `<li><div><strong>${esc(p ? p.title : ref.evidenceId)}</strong><p>${esc(ref.evidenceId)} · ${esc(v ? v.legacy ? 'Lien historique' : 'Version ' + v.number + ' · ' + v.name : 'Version indisponible')}</p>${validation ? pill(validation.status) : pill('À vérifier')}</div><div class="df-actions">${button('Ouvrir', 'proof', `data-id="${esc(ref.evidenceId)}"`)}${button('Retirer', 'detach-proof', `data-eval="${e.id}" data-evidence="${esc(ref.evidenceId)}" data-version="${esc(ref.versionId)}"`)}</div></li>`; }).join('');
    modal(e.requirementId + ' · ' + r.title, `<div class="df-meta"><span>${esc(d.title)}</span><span>${esc(d.frameworkVersion || 'Objectif local')}</span><span>Évaluation v${e.version}</span></div>${r.text && r.text !== r.title ? `<p>${esc(r.text)}</p>` : ''}${sourceLink(r.sourceUrl, 'Source officielle ou documentaire' + (r.sourcePage ? ' · page ' + r.sourcePage : ''))}${e.custom ? note('Objectif local — contenu non officiel.') : ''}${r.applicability || r.scope ? note('<strong>Périmètre indiqué dans la source :</strong> ' + esc(r.applicability || r.scope)) : ''}${r.criteria || r.prerequisites ? note((r.prerequisites ? '<strong>Prérequis :</strong> ' + esc(r.prerequisites) + '<br>' : '') + (r.criteria ? '<strong>Critères :</strong> ' + esc(r.criteria) : '')) : ''}<div class="df-form">${selectField('status', 'Situation', d.kind === 'CARE' ? C.CARE_STATUSES : C.HAS_STATUSES, e.status)}${d.kind === 'CARE' ? textField('progress', 'Avancement déclaré (%)', e.progress, { type: 'number' }) : ''}${textField('owner', 'Responsable', e.owner)}${textField('due', 'Échéance', e.due, { type: 'date' })}${textField('applicabilityReason', 'Justification de non-applicabilité', e.applicabilityReason, { area: true, full: true })}${textField('notes', 'Évaluation, constats et commentaires', e.notes, { area: true, full: true })}${textField('reviewer', 'Vérificateur interne', e.reviewer)}${textField('reviewedAt', 'Date de vérification interne', e.reviewedAt, { type: 'date' })}</div>${note('Un statut « Atteint » ou « Conforme » exige une version de preuve acceptée en interne, un vérificateur et une date. Une action terminée ne change pas cette évaluation.')}<section class="df-section"><h3>Versions de preuves examinées</h3><ul class="df-list">${proofs || '<li>Aucune preuve rattachée.</li>'}</ul><div class="df-actions">${button('Rattacher une version existante', 'attach-proof', `data-id="${e.id}"`)}${button('Créer une preuve', 'new-proof', `data-eval="${e.id}"`)}</div></section><section class="df-section"><h3>Actions partagées</h3><ul class="df-list">${e.findingIds.map(fid => { const f = s().findings.find(x => x.id === fid); return `<li><div><strong>${esc(f ? f.text : fid)}</strong><p>${esc(fid)} · ${esc(f ? f.status : 'Introuvable')}</p></div>${f ? button('Ouvrir', 'legacy-finding', `data-id="${esc(fid)}"`) : ''}</li>`; }).join('') || '<li>Aucune action.</li>'}</ul><div class="df-actions">${button('Créer une action', 'new-action', `data-id="${e.id}"`)}${button('Rattacher une action existante', 'attach-action', `data-id="${e.id}"`)}</div></section><section class="df-section"><h3>Mesures associées</h3><p class="df-muted">${e.measureIds.map(mid => esc((s().items.find(i => i.id === mid) || {}).title || mid)).join(' · ') || 'Aucune mesure associée.'}</p>${button('Choisir les mesures', 'measures', `data-id="${e.id}"`)}</section><section class="df-section"><h3>Historique des évaluations</h3><ul class="df-history">${e.history.slice().reverse().map(h => `<li><b>Version ${h.version} · ${esc(h.snapshot.status)}</b> · ${shortDate(h.archivedAt)} · ${esc(h.actor)}<br>${esc(h.snapshot.notes || '')}</li>`).join('') || '<li>Aucune réévaluation antérieure.</li>'}</ul></section>`, 'evaluation', { id: e.id });
    if (d.archived) dialog.querySelectorAll('form input,form select,form textarea,form button:not([data-df-act="close"])').forEach(x => x.disabled = true);
  }
  function proofModal(evidenceId, contextEval = '') {
    const p = evidenceId ? s().evidences.find(x => x.id === evidenceId) : null;
    if (evidenceId && !p) throw new Error('Preuve introuvable.');
    modal(p ? 'Preuve ' + p.id + ' · versions' : 'Créer une preuve', `<div class="df-form">${textField('title', 'Titre', p ? p.title : '', { required: true, full: true })}${selectField('classification', 'Classification', ['PUBLIC', 'INTERNE', 'RESTREINT', 'CONFIDENTIEL'], p ? p.classification : 'INTERNE')}${textField('owner', 'Responsable', p ? p.owner : '')}${textField('date', 'Date de la preuve', p ? p.date : '', { type: 'date' })}${textField('review', 'Prochaine revue', p ? p.review : '', { type: 'date' })}${textField('location', 'Lien documentaire HTTP/HTTPS', p ? (/^https?:/i.test(p.location || '') ? p.location : '') : '', { type: 'url', full: true, help: p && p.location && !/^https?:/i.test(p.location) ? 'L’emplacement historique sera préservé si ce champ reste vide.' : '' })}${textField('notes', 'Notes', p ? p.notes : '', { area: true, full: true })}${!p ? '<label class="df-field full">Première pièce (facultative, 20 Mo maximum)<input type="file" data-df-deposit></label>' : ''}</div>${p ? `<section class="df-section"><h3>Pièces et validations internes</h3><ul class="df-list">${(p.dfVersions || []).slice().reverse().map(v => { const val = C.proofValidation(s(), { evidenceId: p.id, versionId: v.id }); return `<li><div><strong>Version ${v.number} · ${esc(v.name)}</strong><p>${shortDate(v.createdAt)} · ${(v.size / 1024).toFixed(1)} Ko · SHA-256 ${esc(v.sha256.slice(0, 12))}…</p>${val ? pill(val.status) + `<p>${esc(val.reviewer)} · ${shortDate(val.date)} · ${esc(val.comment)}</p>` : pill('À vérifier')}</div><div class="df-actions">${button('Télécharger', 'download-proof', `data-id="${p.id}" data-version="${v.id}"`)}${button('Vérifier', 'validate-proof', `data-id="${p.id}" data-version="${v.id}"`)}</div></li>`; }).join('') || '<li>Aucune pièce physique déposée.</li>'}${p.location ? `<li><div><strong>Lien historique</strong><p>${sourceLink(p.location, 'Ouvrir le document externe')}</p>${pill((C.proofValidation(s(), { evidenceId: p.id, versionId: 'legacy' }) || {}).status || 'À vérifier')}</div>${button('Vérifier le lien', 'validate-proof', `data-id="${p.id}" data-version="legacy"`)}</li>` : ''}</ul><label class="df-field df-section">Déposer une nouvelle version (20 Mo maximum)<input type="file" data-df-version-file data-id="${p.id}" data-df-write></label><p class="df-muted">Les versions antérieures sont conservées. Le remplacement ne déplace pas les liens des évaluations vers la nouvelle version.</p></section><section class="df-section"><h3>Évaluations liées</h3><ul class="df-list">${(p.links && p.links.dfEvaluations || []).map(eid => { const e = s().df.evaluations.find(x => x.id === eid); return e ? `<li><div>${esc(C.getDossier(s(), e.dossierId).title)} · ${esc(e.requirementId)}</div>${button('Ouvrir', 'evaluation', `data-id="${eid}"`)}</li>` : ''; }).join('') || '<li>Aucune évaluation liée.</li>'}</ul></section>` : ''}`, 'proof', { id: evidenceId || '', eval: contextEval });
    const form=dialog.querySelector('form');const wrap=document.createElement('div');wrap.innerHTML=window.LegacyIntegrationUI.toolkit.scopes(p?p.perimeterIds:contextEval?C.getDossier(s(),C.getEvaluation(s(),contextEval).dossierId).perimeterIds:[]);form.insertBefore(wrap,form.lastElementChild);
  }
  function attachProofModal(evaluationId) {
    const opts = s().evidences.flatMap(p => [...(p.dfVersions || []).map(v => [p.id + '|' + v.id, p.id + ' · ' + p.title + ' · v' + v.number + ' · ' + v.name]), ...(p.location ? [[p.id + '|legacy', p.id + ' · ' + p.title + ' · lien historique']] : [])]);
    modal('Rattacher une version de preuve', opts.length ? selectField('proof', 'Preuve et version examinée', [['', 'Sélectionner…'], ...opts], '', true) : note('Aucune version disponible. Déposez une pièce dans le registre des preuves.'), 'attach-proof', { id: evaluationId });
  }
  function validateProofModal(evidenceId, versionId) {
    modal('Vérification interne de la version', note('Cette décision est interne. Elle ne représente aucune acceptation officielle de l’ANS, de la HAS ou d’un financeur.') + `<div class="df-form">${selectField('status', 'Décision', ['À vérifier', 'Acceptée en interne', 'À corriger', 'Refusée en interne'], 'À vérifier')}${textField('reviewer', 'Vérificateur', s().df.actor, { required: true })}${textField('date', 'Date de vérification', today(), { type: 'date', required: true })}${textField('comment', 'Commentaire de vérification', '', { area: true, full: true })}</div>`, 'validate-proof', { id: evidenceId, version: versionId });
  }
  function actionModal(evaluationId, attach) {
    const e = C.getEvaluation(s(), evaluationId);
    modal(attach ? 'Rattacher une action existante' : 'Créer une action dans le plan partagé', attach ? selectField('findingId', 'Action existante', [['', 'Sélectionner…'], ...s().findings.filter(f => !e.findingIds.includes(f.id)).map(f => [f.id, f.id + ' · ' + f.text])], '', true) : `<div class="df-form">${textField('title', 'Action', '', { required: true, full: true })}${textField('owner', 'Responsable', e.owner)}${textField('due', 'Échéance', e.due, { type: 'date' })}${textField('description', 'Description', '', { area: true, full: true })}</div>`, attach ? 'attach-action' : 'action', { id: evaluationId });
  }
  function budgetModal(budgetId) {
    const b = budgetId ? s().df.budgets.find(x => x.id === budgetId) : null, ds = dossiers('CARE');
    if (!ds.length) throw new Error('Créez d’abord un dossier CaRE ouvert.');
    const proofOpts = s().evidences.flatMap(p => (p.dfVersions || []).map(v => [p.id + '|' + v.id, p.id + ' · ' + p.title + ' · v' + v.number]));
    modal(b ? 'Modifier la ligne budgétaire' : 'Ajouter une ligne budgétaire', `<div class="df-form">${selectField('dossierId', 'Dossier CaRE', ds.map(d => [d.id, d.title]), b ? b.dossierId : u().careDossier || ds[0].id, true)}${textField('label', 'Libellé', b ? b.label : '', { required: true })}${textField('year', 'Exercice', b ? b.year : new Date().getFullYear(), { type: 'number', min: 2000, max: 2200 })}${C.MONEY_FIELDS.map(k => textField(k, MONEY_LABELS[k] + ' (€)', b ? C.amountInput(b[k]) : '0,00', { help: 'Deux décimales au maximum.' })).join('')}${textField('financeSource', 'Source du dispositif / notification (URL)', b ? b.financeSource : '', { type: 'url', full: true })}${textField('notes', 'Notes et références de notification', b ? b.notes : '', { area: true, full: true })}<div class="full"><h3>Pièces justificatives</h3><div class="df-scroll">${proofOpts.map(([key, text]) => checkField('proofs', key, text, b && b.proofRefs.some(r => r.evidenceId + '|' + r.versionId === key))).join('') || '<p>Aucune pièce physique au registre.</p>'}</div></div></div>${note('Les calculs portent sur les sommes saisies. Aucun montant d’aide n’est calculé automatiquement. Les anciennes valeurs sont conservées dans l’historique.')} ${b ? `<ul class="df-history">${b.history.slice().reverse().map(h => `<li>Version ${h.version} · ${shortDate(h.at)} · ${esc(h.actor)} · Réalisé : ${esc(C.formatMoney(h.snapshot.spent))}</li>`).join('')}</ul>` : ''}`, 'budget', { id: budgetId || '' });
    if (b) dialog.querySelector('[name="dossierId"]').disabled = true;
  }
  function auditPackageModal() {
    const rows = s().df.evaluations.filter(e => !C.getDossier(s(), e.dossierId).archived), ds = s().df.dossiers.filter(d => !d.archived);
    if (!rows.length) throw new Error('Créez d’abord des évaluations à partager.');
    modal('Préparer un dossier auditeur limité', `<div class="df-form">${textField('title', 'Titre de l’audit', '', { required: true, full: true })}${textField('auditor', 'Auditeur destinataire', '')}${textField('expiresAt', 'Fin prévue de la mission', '', { type: 'date' })}<div class="full"><label class="df-field">Afficher le dossier<select data-df-audit-filter>${option('', 'Tous les dossiers', '')}${ds.map(d => option(d.id, d.title, '')).join('')}</select></label><p class="df-muted">Cochez uniquement les critères autorisés. Les preuves et actions de ces critères seront incluses. Les budgets, autres preuves, anciennes versions non liées et autres données sont exclus.</p><div class="df-scroll" id="dfAuditSelection">${rows.map(e => `<div data-dossier="${e.dossierId}">${checkField('evaluationIds', e.id, C.getDossier(s(), e.dossierId).title + ' · ' + e.requirementId + ' · ' + e.requirement.title, false)}</div>`).join('')}</div><div class="df-actions">${button('Cocher les critères affichés', 'audit-select-visible')}${button('Tout décocher', 'audit-clear')}</div></div>${textField('confirmation', 'Pour confirmer la transmission, saisir PARTAGER', '', { required: true, full: true })}</div>${note('Un ZIP autonome est téléchargé. Relisez sa sélection avant transmission. Il contient les pièces réellement sélectionnées, éventuellement confidentielles. Les observations retournées seront examinées avant décision.')}`, 'audit-package');
    dialog.querySelector('button[type="submit"]').textContent = 'Créer et télécharger le dossier';
  }
  function historyModal() {
    modal('Historique local des opérations', note('Les dates, versions et noms déclarés sont conservés. Ce journal local n’est pas une preuve d’identité authentifiée ni un dispositif de scellement.') + `<ul class="df-history">${s().df.history.slice(-100).reverse().map(h => `<li><b>${esc(h.action)}</b> · ${new Date(h.at).toLocaleString('fr-FR')} · ${esc(h.actor)}<br>${esc(h.kind)} · ${esc(h.objectId)}</li>`).join('') || '<li>Aucune opération.</li>'}</ul>${button('Exporter tout l’historique JSON', 'history-export')}`);
  }
  function busyState(value, text) {
    busy = value;
    if (dialog && dialog.open) dialog.querySelectorAll('button[type="submit"]').forEach(b => { b.disabled = value; if (value) { b.dataset.original = b.textContent; b.textContent = text || 'Traitement en cours…'; } else if (b.dataset.original) b.textContent = b.dataset.original; });
  }
  async function chooseFile(accept) {
    return new Promise(resolve => { const el = document.createElement('input'); el.type = 'file'; el.accept = accept; el.style.display = 'none'; document.body.appendChild(el); el.onchange = () => { const f = el.files[0]; el.remove(); resolve(f || null); }; el.oncancel = () => { el.remove(); resolve(null); }; el.click(); });
  }
  async function exportExcel(k) {
    if (!window.XLSX) throw new Error('La bibliothèque Excel est indisponible. Vérifiez le dossier lib.');
    const ds = chosen(k), ids = new Set(ds.map(d => d.id)), wb = XLSX.utils.book_new();
    const add = (rows, title) => { const data = rows.map(r => Object.fromEntries(Object.entries(r).map(([key, v]) => [key, C.spreadsheetText(v)]))); const ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = Object.keys(data[0] || {}).map(x => ({ wch: /Libellé|Notes|Source|Preuves/.test(x) ? 55 : 23 })); if (data.length) ws['!autofilter'] = { ref: ws['!ref'] }; XLSX.utils.book_append_sheet(wb, ws, title); };
    add(ds.flatMap(d => C.evaluationRows(s(), d.id)), 'Évaluations');
    if (k === 'CARE') add(s().df.budgets.filter(b => ids.has(b.dossierId)).map(b => ({ Dossier: C.getDossier(s(), b.dossierId).title, Ligne: b.label, Exercice: b.year, ...Object.fromEntries(C.MONEY_FIELDS.map(key => [MONEY_LABELS[key] + ' (€)', b[key] / 100])), 'Écart prévu − réalisé (€)': (b.planned - b.spent) / 100, 'Pièces': b.proofRefs.map(r => r.evidenceId + '/' + r.versionId).join(' ; '), Source: b.financeSource, Notes: b.notes })), 'Budgets');
    const evalIds = new Set(s().df.evaluations.filter(e => ids.has(e.dossierId)).map(e => e.id));
    add(s().df.observations.filter(o => evalIds.has(o.evaluationId)).map(o => ({ Critère: C.getEvaluation(s(), o.evaluationId).requirementId, Type: o.type, Texte: o.text, 'Auteur déclaré': o.author, Statut: o.validation, Décision: o.decision, Responsable: o.reviewer, Date: o.reviewedAt })), 'Observations');
    add(ds.map(d => ({ Dossier: d.title, Référentiel: d.frameworkName, Version: d.frameworkVersion, Périmètre: d.scope.join(' ; '), 'Statut source à création': d.sourceStatus, 'Nature du résultat': 'Évaluation interne — aucune certification ni éligibilité déduite' })), 'Périmètre et sources');
    Store.download('Pilotage-' + label(k) + '-' + today() + '.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
    if (!api.readOnly()) { C.log(s(), 'Export Excel', 'export', k, null, { dossierIds: [...ids] }); await persist(false); } api.toast('Export Excel téléchargé.');
  }
  async function exportPackage(fields, evaluationIds) {
    const pkg = C.buildAuditPackage(s(), { ...fields, evaluationIds }), fingerprint = await Store.hash(JSON.stringify(pkg));
    const zip = new JSZip(), files = await Store.zipFiles(zip, pkg.evidences);
    // L’empreinte porte sur le contenu métier avant ajout des chemins de fichiers.
    pkg.fingerprint = fingerprint;
    zip.file('audit.json', JSON.stringify(pkg, null, 2));
    zip.file('index.html', window.LegacyDFAuditor.html(pkg));
    for (const [name, text] of Object.entries(window.LegacyDFAuditor.launchers())) zip.file(name, text);
    zip.file('manifest.json', JSON.stringify({ format: 'legacy-df-audit-files', packageId: pkg.id, fingerprint, files }, null, 2));
    zip.file('LIRE-MOI.txt', 'Extraire intégralement ce ZIP. Ouvrir index.html ; si votre navigateur bloque les fichiers locaux, lancer demarrer.bat (Windows avec Python) ou python3 demarrer.py (Linux/macOS), puis http://127.0.0.1:8124. Ce serveur statique expose uniquement ce dossier, sur cet appareil. Les pièces sont dans pieces/. Seules les données sélectionnées ont été transmises. Les observations restent sur cet appareil : télécharger le JSON puis le remettre au responsable. L’auteur est déclaré, sans authentification distante. Les résultats sont internes, sans décision de certification.\n');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    C.registerAuditPackage(s(), pkg, fingerprint); await persist();
    Store.download('Dossier-auditeur-' + today() + '.zip', blob);
    api.toast('Dossier auditeur téléchargé : ' + pkg.evaluations.length + ' critères, ' + files.length + ' pièces.');
  }
  async function click(e) {
    const el = e.target.closest('[data-df-act]'); if (!el || busy) return;
    e.preventDefault();
    const a = el.dataset.dfAct, attrs = el.dataset;
    try {
      if (a === 'close') { dialog.close(); return; }
      if (['new-dossier', 'edit-dossier', 'new-objective', 'new-proof', 'new-budget', 'edit-budget', 'attach-proof', 'detach-proof', 'validate-proof', 'new-action', 'attach-action', 'measures', 'archive-dossier', 'verify-framework', 'observations-import', 'review-observation', 'restore', 'framework-import', 'import-legacy', 'audit-package'].includes(a)) guard();
      if (a === 'new-dossier') return dossierModal(attrs.kind || kind(), '', attrs.domain || 'D1');
      if (a === 'edit-dossier') return dossierModal(C.getDossier(s(), attrs.id).kind, attrs.id);
      if (a === 'select-dossier') { u()[stateKey(attrs.kind)] = attrs.id; u().tab = attrs.kind === 'CARE' ? 'care' : 'has'; u()[attrs.kind === 'CARE' ? 'careView' : 'hasView'] = 'grid'; u().dfStatus = ''; u().dfChapter = ''; u().dfPage = 0; api.saveUI(); api.render(); return; }
      if (a === 'go') { u()[kind() === 'CARE' ? 'careView' : 'hasView'] = attrs.view; api.saveUI(); api.render(); return; }
      if (a === 'page') { u().dfPage = Number(attrs.page); api.render(); return; }
      if (a === 'new-objective') return objectiveModal(attrs.id);
      if (a === 'evaluation') return evaluationModal(attrs.id);
      if (a === 'proof' || a === 'new-proof') return proofModal(a === 'proof' ? attrs.id : '', attrs.eval || '');
      if (a === 'attach-proof') return attachProofModal(attrs.id);
      if (a === 'detach-proof') { C.detachProof(s(), attrs.eval, attrs.evidence, attrs.version); await persist(false); return evaluationModal(attrs.eval); }
      if (a === 'validate-proof') return validateProofModal(attrs.id, attrs.version);
      if (a === 'download-proof') { const p = s().evidences.find(p => p.id === attrs.id), v = p && (p.dfVersions || []).find(v => v.id === attrs.version); if (!v) throw new Error('Version introuvable.'); return Store.download(v.name, await Store.checkedBlob(v)); }
      if (a === 'new-action' || a === 'attach-action') return actionModal(attrs.id, a === 'attach-action');
      if (a === 'legacy-finding') { if (dialog && dialog.open) dialog.close(); api.openSheet('fd', attrs.id); return; }
      if (a === 'new-budget' || a === 'edit-budget') return budgetModal(a === 'edit-budget' ? attrs.id : '');
      if (a === 'archive-dossier') { if (!await api.confirm('Archiver ou réouvrir ce dossier ? Ses données et liens seront conservés.')) return; C.archiveDossier(s(), attrs.id); await persist(); dialog.close(); return; }
      if (a === 'measures') { const ev = C.getEvaluation(s(), attrs.id); return modal('Associer des mesures du registre commun', note('Ces relations sont des choix locaux. Elles ne démontrent aucune équivalence normative automatique.') + '<div class="df-scroll">' + s().items.map(i => checkField('measureIds', i.id, (i.ref === 'A' ? 'A.' : i.ref + ' ') + i.num + ' · ' + i.title, ev.measureIds.includes(i.id))).join('') + '</div>', 'measures', { id: ev.id }); }
      if (a === 'history') return historyModal();
      if (a === 'history-export') return Store.download('Historique-local-' + today() + '.json', JSON.stringify(s().df.history, null, 2));
      if (a === 'json') return Store.download('Sauvegarde-legacy-D-F-' + today() + '.json', JSON.stringify(s(), null, 2));
      if (a === 'backup') { busyState(true); const file = await Store.backup(s()); Store.download('Sauvegarde-complete-legacy-D-F-' + today() + '.zip', file); api.toast('Sauvegarde complète téléchargée, pièces comprises.'); return; }
      if (a === 'restore') { const file = await chooseFile('.zip'); if (!file) return; busyState(true); const prepared = await Store.inspectBackup(file); if (!await api.confirm('Remplacer les données locales par cette sauvegarde complète (' + prepared.state.evidences.length + ' preuves) ? Téléchargez d’abord une sauvegarde de vos données actuelles.')) return; const state = await Store.restore(prepared); api.replaceState(state); C.log(s(), 'Restauration locale contrôlée', 'backup', C.id('RST'), null, { files: prepared.blobs.length }); await persist(); api.toast('Sauvegarde restaurée et pièces contrôlées.'); return; }
      if (a === 'import-legacy') { const file = await chooseFile('.json'); if (!file) return; const parsed = C.safeJson(await file.text()), state = C.validateState(parsed.format === 'suivi-audits-legacy' ? parsed.data : parsed); if (!await api.confirm('Remplacer les données par ce JSON legacy ? Les fichiers physiques ne sont pas inclus ; utilisez le ZIP pour une restauration complète.')) return; api.replaceState(state); await persist(); api.toast('Données legacy importées.'); return; }
      if (a === 'framework-template') { const k = attrs.kind; return Store.download('Modele-referentiel-' + k + '.json', JSON.stringify({ dfKind: k, domain: k === 'CARE' ? 'D1' : undefined, name: 'À compléter', version: 'À compléter', sourceUrl: k === 'CARE' ? 'https://esante.gouv.fr/' : 'https://www.has-sante.fr/', publisher: k === 'CARE' ? 'ANS' : 'HAS', publishedAt: '', checkedAt: '', reuse: 'À vérifier', requirements: [{ id: 'REFERENCE_A_REMPLACER', title: 'Libellé exact du document source', chapter: 'Chapitre ou domaine', applicability: 'Applicabilité à vérifier', text: 'Texte source autorisé', sourcePage: '', sourceUrl: '' }] }, null, 2)); }
      if (a === 'framework-import') { const file = await chooseFile('.json'); if (!file) return; const data = C.safeJson(await file.text()); const trial = C.clone(s()), frame = C.importFramework(trial, data); if (frame.dfKind !== attrs.kind) throw new Error('Ce fichier concerne un autre module.'); if (!await api.confirm('Importer « ' + frame.name + ' » version ' + frame.version + ' avec ' + frame.requirements.length + ' critères ? La source restera à vérifier localement.')) return; C.importFramework(s(), data); await persist(); api.toast('Référentiel importé dans le registre partagé.'); return; }
      if (a === 'verify-framework') return modal('Tracer la vérification documentaire', `<div class="df-form">${textField('checkedAt', 'Date de vérification', today(), { type: 'date', required: true })}${textField('reuse', 'Modalités de réutilisation vérifiées', '', { area: true, required: true, full: true })}</div>`, 'verify-framework', { id: attrs.id });
      if (a === 'export-excel') return await exportExcel(attrs.kind || kind());
      if (a === 'report') return window.LegacyDFReports.print(s(), chosen(attrs.kind || kind()), attrs.kind || kind());
      if (a === 'audit-package') return auditPackageModal();
      if (a === 'audit-select-visible' || a === 'audit-clear') { dialog.querySelectorAll('[name="evaluationIds"]').forEach(x => { if (a === 'audit-clear' || !x.closest('[data-dossier]').hidden) x.checked = a !== 'audit-clear'; }); return; }
      if (a === 'observations-import') { const file = await chooseFile('.json'); if (!file) return; const report = C.safeJson(await file.text()), check = C.checkObservationReport(s(), report); if (!await api.confirm('Importer ' + check.rows.length + ' observations de « ' + check.pkg.title + ' » comme éléments à examiner ? Les évaluations ne seront pas modifiées.')) return; const n = C.importObservationReport(s(), report); await persist(); api.toast(n + ' nouvelle(s) observation(s) reçue(s).'); return; }
      if (a === 'review-observation') { const o = s().df.observations.find(o => o.id === attrs.id); if (!o) throw new Error('Observation introuvable.'); return modal('Examiner l’observation', `<p><strong>${esc(o.type)}</strong> · ${esc(o.author)}</p><p>${esc(o.text)}</p><div class="df-form">${selectField('validation', 'Décision interne', ['À examiner', 'Confirmée en interne', 'Contestée', 'Classée'], o.validation)}${textField('reviewer', 'Responsable de la décision', s().df.actor, { required: true })}${textField('reviewedAt', 'Date de décision', today(), { type: 'date', required: true })}${textField('decision', 'Justification', o.decision, { area: true, full: true })}</div>${note('Cette décision ne modifie pas l’évaluation. Ouvrez le critère pour une réévaluation explicite si nécessaire.')}`, 'review-observation', { id: o.id }); }
    } catch (err) { error(err); }
    finally { busyState(false); }
  }
  async function submit(e) {
    const form = e.target.closest('[data-df-form]'); if (!form) return;
    e.preventDefault(); if (busy) return;
    try {
      guard(); busyState(true);
      const fd = new FormData(form), f = Object.fromEntries(fd.entries()), ds = form.dataset;
      if (ds.dfForm === 'actor') { s().df.actor = C.required(f.actor, 'Le responsable', 200); await persist(); api.toast('Identité locale enregistrée.'); return; }
      if (ds.dfForm === 'dossier') { const perimeterIds=fd.getAll('perimeterIds'),responsible=window.LegacyIntegrationUI.toolkit.parseResponsible(fd); if(perimeterIds.length)f.scope=perimeterIds.map(id=>s().perimeters.find(p=>p.id===id).name).join('\n'); if(responsible)f.owner=s().roles.find(r=>r.id===responsible.roleId).name; f.scope = (f.scope || '').split(/\n|;/).map(v => v.trim()).filter(Boolean); const d = ds.id ? C.updateDossier(s(), ds.id, f) : C.createDossier(s(), { ...f, kind: ds.kind }); window.LegacyIntegration.assign(s(),{kind:'dossier',id:d.id},perimeterIds,responsible); u()[stateKey(ds.kind)] = d.id; u().dfArchived = false; u().dfStatus = ''; u().dfChapter = ''; u().dfQuery = ''; u().dfPage = 0; u().tab = ds.kind === 'CARE' ? 'care' : 'has'; u()[ds.kind === 'CARE' ? 'careView' : 'hasView'] = 'grid'; api.saveUI(); }
      if (ds.dfForm === 'objective') C.addLocalObjective(s(), ds.id, f);
      if (ds.dfForm === 'evaluation') C.updateEvaluation(s(), ds.id, f);
      if (ds.dfForm === 'proof') {
        const working = C.clone(s());
        const p = ds.id ? working.evidences.find(p => p.id === ds.id) : C.createProof(working, f);
        if (!p) throw new Error('Preuve introuvable.');
        p.perimeterIds=fd.getAll('perimeterIds');
        if (ds.id) { const before = { title: p.title, classification: p.classification, owner: p.owner, date: p.date, review: p.review, location: p.location, notes: p.notes }; const next = { title: C.required(f.title, 'Le titre'), classification: f.classification, owner: C.cleanText(f.owner || '', 200), date: C.date(f.date), review: C.date(f.review), location: f.location ? C.sourceUrl(f.location) : /^https?:/i.test(p.location || '') ? '' : p.location || '', notes: C.cleanText(f.notes || '') }; if (!['PUBLIC', 'INTERNE', 'RESTREINT', 'CONFIDENTIEL'].includes(next.classification)) throw new Error('Classification invalide.'); Object.assign(p, next); C.log(working, 'Modification des métadonnées de preuve', 'evidence', p.id, before, next); }
        if (selectedFile) { const v = await Store.deposit(working, p.id, selectedFile); if (ds.eval) C.attachProof(working, ds.eval, p.id, v.id); }
        else if (ds.eval && p.location) C.attachProof(working, ds.eval, p.id, 'legacy');
        api.replaceState(working);
      }
      if (ds.dfForm === 'attach-proof') { if (!f.proof) throw new Error('Sélectionnez une preuve et une version.'); const [eid, vid] = f.proof.split('|'); C.attachProof(s(), ds.id, eid, vid); }
      if (ds.dfForm === 'validate-proof') C.validateProof(s(), ds.id, ds.version, f);
      if (ds.dfForm === 'action') C.createAction(s(), ds.id, f);
      if (ds.dfForm === 'attach-action') C.attachFinding(s(), ds.id, f.findingId);
      if (ds.dfForm === 'measures') C.linkMeasures(s(), ds.id, fd.getAll('measureIds'));
      if (ds.dfForm === 'budget') { const old = ds.id && s().df.budgets.find(b => b.id === ds.id); f.proofRefs = fd.getAll('proofs').map(v => { const [evidenceId, versionId] = v.split('|'); return { evidenceId, versionId }; }); C.upsertBudget(s(), old ? old.dossierId : f.dossierId, ds.id, f); }
      if (ds.dfForm === 'verify-framework') C.verifyFramework(s(), ds.id, f);
      if (ds.dfForm === 'review-observation') C.reviewObservation(s(), ds.id, f);
      if (ds.dfForm === 'audit-package') {
        if (f.confirmation !== 'PARTAGER') throw new Error('Saisissez PARTAGER pour confirmer le périmètre.');
        const ids = fd.getAll('evaluationIds'), preview = C.buildAuditPackage(s(), { ...f, evaluationIds: ids });
        const names = preview.dossiers.map(d => d.title + ' [' + d.scope.join(', ') + ']').join(' ; ');
        const files = preview.evidences.reduce((n, p) => n + p.versions.length, 0);
        if (!await api.confirm('Partager ' + preview.evaluations.length + ' critères, ' + files + ' pièces et ' + preview.findings.length + ' actions ? Périmètres : ' + names + '. Les classifications des pièces sont conservées.')) return;
        await exportPackage(f, ids);
      }
      await persist(); dialog.close(); api.toast('Enregistré sur le serveur local.');
    } catch (err) { error(err); }
    finally { busyState(false); }
  }
  async function change(e) {
    const el = e.target;
    try {
      if (el.hasAttribute('data-df-filter')) { u()[el.dataset.dfFilter] = el.type === 'checkbox' ? el.checked : el.value; u().dfPage = 0; api.saveUI(); api.render(); }
      if (el.hasAttribute('data-df-deposit')) selectedFile = el.files[0] || null;
      if (el.hasAttribute('data-df-audit-filter')) dialog.querySelectorAll('#dfAuditSelection [data-dossier]').forEach(row => { row.hidden = !!el.value && row.dataset.dossier !== el.value; });
      if (el.hasAttribute('data-df-version-file')) { guard(); const file = el.files[0]; if (!file) return; busyState(true); await Store.deposit(s(), el.dataset.id, file); await persist(false); proofModal(el.dataset.id); api.toast('Nouvelle version déposée ; les liens des évaluations sont conservés.'); }
    } catch (err) { error(err); }
    finally { busyState(false); }
  }
  function extendNav(nav) {
    const make = (k, id, title, values) => ({ id, label: title, icon: k === 'CARE' ? 'pil' : 'audit', items: values.map(([view, text]) => ({ id: 'df-' + id + '-' + view, label: text, tab: id, set: { [id + 'View']: view } })) });
    const insert = nav.findIndex(x => x.id === 'gap');
    nav.splice(insert < 0 ? nav.length : insert, 0, make('CARE', 'care', 'Programme CaRE', [['dash', 'Tableau de bord'], ['dossiers', 'Suivis par domaine'], ['grid', 'Objectifs'], ['budget', 'Budgets et financements'], ['proofs', 'Preuves et versions'], ['actions', 'Actions'], ['audit', 'Dossiers auditeur'], ['sources', 'Sources et sauvegarde']]), make('HAS', 'has', 'Qualité · HAS', [['dash', 'Tableau de bord'], ['dossiers', 'Campagnes'], ['grid', 'Grille d’évaluation'], ['proofs', 'Preuves et versions'], ['actions', 'Actions'], ['audit', 'Mode auditeur'], ['sources', 'Sources et sauvegarde']]));
    const order = u().navOrder || []; nav.sort((a, b) => { const x = order.indexOf(a.id), y = order.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    for (const section of nav) if (['care', 'has'].includes(section.id)) navSections[section.id] = section;
    return nav;
  }
  function afterRender() {
    const sn = document.getElementById('subnav');
    if (sn) sn.classList.toggle('df-subnav', ['care', 'has'].includes(u().tab));
    if (['care', 'has'].includes(u().tab)) {
      if (sn) {
        const x = sn.querySelector('[data-act="exppage"]'); if (x) x.hidden = true;
        const section = navSections[u().tab], row = sn.querySelector('.sn-in');
        if (section && row && !row.querySelector('.df-mobile-nav')) {
          const tabs = document.createElement('div'); tabs.className = 'sn-items df-mobile-nav'; tabs.setAttribute('role', 'tablist');
          tabs.setAttribute('aria-label', section.label);
          tabs.innerHTML = section.items.map(item => {
            const active = item.tab === u().tab && (!item.set || u()[u().tab + 'View'] === item.set[u().tab + 'View']);
            return `<button class="sn${active ? ' on' : ''}" role="tab" aria-selected="${active}" data-act="nav" data-sec="${section.id}" data-sub="${item.id}">${esc(item.label)}</button>`;
          }).join('');
          row.prepend(tabs);
        }
      }
    }
    const p = u().sheet && u().sheet.kind === 'prv' && s().evidences.find(x => x.id === u().sheet.id);
    const container = document.getElementById('drawerIn');
    if (p && container && !container.querySelector('[data-df-act="proof"]')) { const block = document.createElement('div'); block.className = 'df-note'; block.innerHTML = `<strong>Pièces et versions protégées</strong><p>${(p.dfVersions || []).length} version(s) physique(s), ${(p.links && p.links.dfEvaluations || []).length} évaluation(s) CaRE/HAS.</p>${button('Gérer les versions et validations', 'proof', `data-id="${esc(p.id)}"`)}`; container.appendChild(block); }
    if (api.readOnly()) document.querySelectorAll('[data-df-act]').forEach(el => { if (!['evaluation', 'proof', 'go', 'page', 'select-dossier', 'close', 'history', 'history-export', 'download-proof', 'report', 'export-excel', 'json', 'backup', 'legacy-finding', 'framework-template'].includes(el.dataset.dfAct)) el.disabled = true; });
  }
  function install(context) {
    api = context;
    context.TABS.push({ id: 'care', label: () => 'Programme CaRE', view: () => rootView('CARE') }, { id: 'has', label: () => 'Qualité · HAS', view: () => rootView('HAS') });
    Object.assign(context.NAV_DEF, { careView: 'dash', hasView: 'dash' });
    document.addEventListener('click', click); document.addEventListener('submit', submit); document.addEventListener('change', change);
    let searchTimer;
    document.addEventListener('input', e => { if (!e.target.hasAttribute('data-df-search')) return; const value = e.target.value, selection = e.target.selectionStart; clearTimeout(searchTimer); searchTimer = setTimeout(() => { u().dfQuery = value; u().dfPage = 0; api.render(); const inp = document.querySelector('[data-df-search]'); if (inp) { inp.focus(); inp.setSelectionRange(selection, selection); } }, 200); });
    document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; if (el.dataset.act === 'prvdel' && u().sheet && s().df.evaluations.some(ev => ev.proofRefs.some(r => r.evidenceId === u().sheet.id))) { e.preventDefault(); e.stopImmediatePropagation(); api.toast('Cette preuve est liée à une évaluation CaRE/HAS : conservez ses versions ou retirez d’abord ses rattachements.'); } if (el.dataset.act === 'delfd' && s().df.evaluations.some(ev => ev.findingIds.includes(el.dataset.fd))) { e.preventDefault(); e.stopImmediatePropagation(); api.toast('Cette action est liée à une évaluation : clôturez-la pour préserver sa traçabilité.'); } }, true);
    return { extendNav, afterRender, ensureCatalog, openDossier:dossierModal, openEvaluation:evaluationModal, openProof:proofModal };
  }
  window.LegacyDFUI = { install };
})();
