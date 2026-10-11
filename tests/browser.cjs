/* Recette avec fixtures synthétiques ; réutilise Playwright installé dans l'environnement. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const JSZip = require('../lib/jszip.min.js');
const ROOT = path.resolve(__dirname, '..'), TEMP = fs.mkdtempSync('/tmp/legacy-df-recette-');
const URL = process.env.LEGACY_URL || 'http://127.0.0.1:8123';
const tests = [], errors = [], external = [];
let initialState, browser, context, p, careId, firstId, secondId, hasId, hasEvalId, proofId, v1, v2, auditorZip, observationsFile, backupFile, auditServer, auditOrigin;
const dlg = () => p.locator('#dfDialog');
const fld = name => dlg().locator('[name="' + name + '"]');
const stored = page => page.evaluate(async () => {await LegacyServer.flush();return (await LegacyServer.request('/api/state')).state});
const fill = (name, value) => fld(name).fill(String(value));
async function submit() {
  await dlg().locator('button[type="submit"]').click();
  await dlg().waitFor({ state: 'hidden', timeout: 15000 }).catch(async e => { throw new Error('Formulaire non enregistré : ' + await dlg().locator('#dfError').innerText().catch(() => '') + '\n' + e.message); });
}
async function signIn(page) {
  if (await page.locator('#lx-auth').count()) {
    if(await page.locator('#lx-auth [name=name]').count())await page.locator('#lx-auth [name=name]').fill('Administration fictive');
    await page.locator('#lx-auth [name=login]').fill('recette_admin');
    await page.locator('#lx-auth [name=password]').fill('recette-synthetique-001');
    await page.locator('#lx-auth button').click();
  }
  await page.locator('#lx-account').waitFor();
}
async function go(sec, sub) {
  if(await p.locator('#lx-menu-toggle').isVisible() && await p.locator('#lx-menu-toggle').getAttribute('aria-expanded')!=='true') await p.locator('#lx-menu-toggle').click();
  await p.locator('[data-act="nav"][data-sec="' + sec + '"]').first().click();
  if (sub) await p.locator('[data-sec="' + sec + '"][data-sub="df-' + sec + '-' + sub + '"]:visible').first().click();
}
async function openEval(eid) {
  await go(eid === hasEvalId ? 'has' : 'care', 'grid');
  const state = await stored(p), entry = state.df.evaluations.find(e => e.id === eid);
  await p.locator('#panel [data-df-search]').fill(entry.requirementId);
  await p.locator('#panel [data-df-act="evaluation"][data-id="' + eid + '"]').click();
}
async function newObjective(reference, title) {
  await p.locator('#panel [data-df-act="new-objective"]').click(); await fill('reference', reference); await fill('title', title); await submit();
}
async function downloaded(action, name) {
  const promise = p.waitForEvent('download'); await action(); const dl = await promise; const target = path.join(TEMP, name || dl.suggestedFilename()); await dl.saveAs(target); return target;
}
async function chooser(action, file) {
  const promise = p.waitForEvent('filechooser'); await action(); const choice = await promise; await choice.setFiles(file);
}
async function confirm() { await p.locator('#askDlg [data-ask="1"]').click(); }
async function run(name, fn) {
  const at = Date.now();
  try { const result = await fn(); const status = result && result.notExecutedReason ? 'NON EXÉCUTÉ' : 'PASSÉ'; tests.push({ name, status, durationMs: Date.now() - at, ...(result || {}) }); console.log(status + ' ' + name); }
  catch (e) { tests.push({ name, status: 'ÉCHEC', message: e.message }); console.error('ÉCHEC ' + name + '\n' + e.stack); await p.screenshot({ path: path.join(ROOT, 'recette/refonte-captures/regression-echec.png'), fullPage: true }).catch(() => {}); throw e; }
}
function watch(page) { page.on('pageerror', e => errors.push(e.message)); page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(URL) && !(auditOrigin && req.url().startsWith(auditOrigin))) external.push(req.url()); }); }
async function main() {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  p = await context.newPage(); watch(p);
  await run('Démarrage local : menu legacy, rubriques CaRE/HAS et aucune donnée opérationnelle préremplie', async () => {
    await p.goto(URL); await p.locator('#lx-auth').waitFor(); await signIn(p);initialState=await stored(p); await p.locator('[data-sec="care"]').first().waitFor();
    await go('care'); assert.equal(await p.locator('#panel h2').innerText(), 'Piloter le programme CaRE');
    assert.equal(await p.locator('[data-sec="has"]').count(), 1); assert.equal(await p.locator('[data-sec="pil"]').count(), 1);
    assert.equal(await p.locator('.df-stat strong').first().innerText(), '0');
  });
  await run('CaRE : dossier générique D2 et objectif local avec périmètre réel saisi', async () => {
    await p.locator('#panel [data-df-act="new-dossier"]').first().click(); await fill('title', 'Suivi CaRE de recette');
    await fld('domain').selectOption('D2'); await fill('scope', 'Établissement fictif A\nGroupement fictif'); await fill('owner', 'Responsable fictif'); await fill('due', '2026-12-31'); await submit();
    await newObjective('LOC-REC-1', 'Vérifier la procédure de recette');
    const s = await stored(p); careId = s.df.dossiers[0].id; firstId = s.df.evaluations[0].id;
    assert.equal(s.df.dossiers[0].domain, 'D2'); assert.equal(s.df.evaluations[0].custom, true); assert.equal(s.df.dossiers[0].scope.length, 2);
  });
  await run('Preuve physique : dépôt, SHA-256 et rattachement dans le registre partagé', async () => {
    await openEval(firstId); await dlg().locator('[data-df-act="new-proof"]').click(); await fill('title', 'Procès-verbal de recette synthétique'); await fill('owner', 'Responsable fictif');
    await dlg().locator('[data-df-deposit]').setInputFiles({ name: 'preuve-v1.txt', mimeType: 'text/plain', buffer: Buffer.from('PREUVE SYNTHÉTIQUE DE RECETTE — version 1\n') }); await submit();
    const s = await stored(p); proofId = s.evidences[0].id; v1 = s.evidences[0].dfVersions[0].id;
    assert.equal(s.evidences.length, 1); assert.equal(s.df.evaluations[0].proofRefs[0].versionId, v1);
    const digest = crypto.createHash('sha256').update('PREUVE SYNTHÉTIQUE DE RECETTE — version 1\n').digest('hex'); assert.equal(s.evidences[0].dfVersions[0].sha256, digest);
  });
  await run('Vérification interne et validation documentée d’un objectif CaRE', async () => {
    await go('care', 'proofs'); await p.locator('#panel [data-df-act="proof"][data-id="' + proofId + '"]').click();
    await dlg().locator('[data-df-act="validate-proof"]').click(); await fld('status').selectOption('Acceptée en interne'); await fill('reviewer', 'Vérificateur fictif'); await fill('date', '2026-10-11'); await submit();
    await openEval(firstId); await fld('status').selectOption('Atteint'); await fill('reviewer', 'Vérificateur fictif'); await fill('reviewedAt', '2026-10-11'); await fill('notes', 'Vérification synthétique confirmée.'); await submit();
    const s = await stored(p); assert.equal(s.df.evaluations[0].status, 'Atteint'); assert.equal(s.df.evaluations[0].progress, 100); assert.equal(s.df.evaluations[0].history.length, 1);
  });
  await run('Preuve partagée et nouvelle version : aucun déplacement silencieux des références', async () => {
    await newObjective('LOC-REC-2', 'OBJET_HORS_PERIMETRE_AUDITEUR'); const st = await stored(p); secondId = st.df.evaluations[1].id;
    await openEval(secondId); await dlg().locator('[data-df-act="attach-proof"]').click(); await fld('proof').selectOption(proofId + '|' + v1); await submit();
    await go('care', 'proofs'); await p.locator('#panel [data-df-act="proof"]').click();
    await dlg().locator('[data-df-version-file]').setInputFiles({ name: 'VERSION_NON_SELECTIONNEE.txt', mimeType: 'text/plain', buffer: Buffer.from('PIECE VERSION 2 NON AUTORISEE POUR AUDIT\n') });
    await dlg().getByText('Version 2 · VERSION_NON_SELECTIONNEE.txt', { exact: true }).waitFor();
    await dlg().locator('[data-df-act="close"]').first().click(); const s = await stored(p); v2 = s.evidences[0].dfVersions[1].id;
    assert.equal(s.evidences.length, 1); assert.equal(s.evidences[0].dfVersions.length, 2); assert.equal(s.df.evaluations[0].status,'Atteint'); assert.equal(s.df.evaluations[0].proofRefs[0].versionId, v1); assert.equal(s.df.evaluations[1].proofRefs[0].versionId, v1);
  });
  await run('Action suivie dans le plan legacy et aucun recalcul automatique du statut', async () => {
    await openEval(secondId); await dlg().locator('[data-df-act="new-action"]').click(); await fill('title', 'Action corrective synthétique'); await fill('owner', 'Responsable fictif'); await fill('due', '2026-12-20'); await submit();
    await openEval(secondId); await dlg().locator('[data-df-act="legacy-finding"]').click(); await p.locator('#drawerIn').getByText('Action corrective synthétique', { exact: false }).first().waitFor();
    await p.locator('#drawer [data-act="close"]').first().click(); const s = await stored(p);
    assert.equal(s.findings.length, 1); assert.equal(s.df.evaluations[1].status, 'À démarrer'); assert.equal(s.findings[0].dfEvaluationIds[0], secondId);
  });
  await run('Budgets : saisie décimale française, sommes exactes et historique', async () => {
    await go('care', 'budget');
    for (const [name, value] of [['Ligne de recette A', '0,10'], ['Ligne de recette B', '0,20']]) { await p.locator('#panel [data-df-act="new-budget"]').click(); await fill('label', name); await fill('planned', '0,30'); await fill('spent', value); await fill('notified', '0,20'); await fill('received', '0,10'); await submit(); }
    let s = await stored(p); assert.equal(s.df.budgets.reduce((n, b) => n + b.spent, 0), 30);
    await p.locator('#panel [data-df-act="edit-budget"]').first().click(); await fill('spent', '0,15'); await submit(); s = await stored(p); assert.equal(s.df.budgets[0].history[0].snapshot.spent, 10); assert.equal(s.df.budgets[0].spent, 15);
  });
  await run('HAS : création d’une campagne version 2025 et pagination de 118 critères', async () => {
    await go('has'); await p.locator('#panel [data-df-act="new-dossier"]').first().click(); await fill('title', 'Campagne HAS de recette'); await fill('scope', 'Établissement fictif B'); await fill('owner', 'Responsable qualité fictif'); await fld('frameworkId').selectOption('HAS-ES-2025-DF'); await submit();
    const s = await stored(p); hasId = s.df.dossiers.find(d => d.kind === 'HAS').id; hasEvalId = s.df.evaluations.find(e => e.dossierId === hasId && e.requirementId === '3.1-07').id;
    assert.equal(s.df.evaluations.filter(e => e.dossierId === hasId).length, 118); assert.equal(await p.locator('.df-table tbody tr').count(), 50);
    await p.locator('#panel [data-df-search]').fill('3.1-07'); await p.locator('#panel [data-df-act="evaluation"][data-id="' + hasEvalId + '"]').waitFor();
  });
  await run('HAS : applicabilité justifiée et preuve partagée pour une validation interne', async () => {
    await openEval(hasEvalId); await fld('status').selectOption('Non applicable'); await dlg().locator('button[type="submit"]').click(); await dlg().locator('#dfError').waitFor({ state: 'visible' }); assert.match(await dlg().locator('#dfError').innerText(), /Justifiez/);
    await fld('status').selectOption('Partiel'); await fill('notes', 'Constat interne de recette'); await submit();
    await openEval(hasEvalId); await dlg().locator('[data-df-act="attach-proof"]').click(); await fld('proof').selectOption(proofId + '|' + v1); await submit();
    await openEval(hasEvalId); await fld('status').selectOption('Conforme'); await fill('reviewer', 'Vérificateur qualité fictif'); await fill('reviewedAt', '2026-10-11'); await submit();
    const s = await stored(p), e = s.df.evaluations.find(e => e.id === hasEvalId); assert.equal(e.status, 'Conforme'); assert.equal(e.version, 3); assert.equal(s.evidences.length, 1);
  });
  await run('Exports Excel CaRE/HAS réels et données limitées aux dossiers sélectionnés', async () => {
    for (const [sec, expected] of [['care', 2], ['has', 118]]) {
      await go(sec, 'grid'); const file = await downloaded(() => p.locator('#panel [data-df-act="export-excel"]').click(), sec + '.xlsx');
      const XLSX = require('../lib/xlsx.full.min.js'), wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' }); assert.equal(XLSX.utils.sheet_to_json(wb.Sheets['Évaluations']).length, expected);
      assert.ok(wb.Sheets['Périmètre et sources']);
    }
  });
  await run('Rapport PDF réel : périmètre, preuves et décisions lisibles', async () => {
    const popup = p.waitForEvent('popup'); await p.locator('#panel [data-df-act="report"]').click(); const report = await popup; await report.waitForLoadState();
    assert.match(await report.locator('body').innerText(), /Campagne HAS de recette/); await report.pdf({ path: path.join(TEMP, 'rapport-has.pdf'), format: 'A4', landscape: true }); assert.ok(fs.statSync(path.join(TEMP, 'rapport-has.pdf')).size > 10000); await report.close();
  });
  await run('Dossier auditeur exporté : une sélection explicite et aucun objet/version hors périmètre', async () => {
    await go('has', 'audit'); await p.locator('#panel [data-df-act="audit-package"]').click(); await fill('title', 'Audit externe de recette'); await fill('auditor', 'Auditeur fictif');
    await dlg().locator('[name="evaluationIds"][value="' + hasEvalId + '"]').check(); await fill('confirmation', 'PARTAGER');
    const download = p.waitForEvent('download'); await dlg().locator('button[type="submit"]').click(); await confirm(); const dl = await download; auditorZip = path.join(TEMP, 'audit.zip'); await dl.saveAs(auditorZip); await dlg().waitFor({ state: 'hidden' });
    const zip = await JSZip.loadAsync(fs.readFileSync(auditorZip)), pkg = JSON.parse(await zip.file('audit.json').async('string')), html = await zip.file('index.html').async('string');
    assert.equal(pkg.evaluations.length, 1); assert.equal(pkg.dossiers.length, 1); assert.equal(pkg.evidences[0].versions.length, 1); assert.equal(pkg.evidences[0].versions[0].id, v1);
    for (const marker of ['OBJET_HORS_PERIMETRE_AUDITEUR', 'VERSION_NON_SELECTIONNEE', 'PIECE VERSION 2 NON AUTORISEE', 'Ligne de recette A', 'Action corrective synthétique', 'Suivi CaRE de recette']) { assert.ok(!JSON.stringify(pkg).includes(marker), marker); assert.ok(!html.includes(marker), marker); }
    const dest = path.join(TEMP, 'auditeur'); fs.mkdirSync(dest);
    for (const [name, f] of Object.entries(zip.files)) { if (f.dir) continue; const out = path.join(dest, name); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, await f.async('nodebuffer')); }
    assert.equal(Object.keys(zip.files).filter(n => n.endsWith('.txt') && n.startsWith('pieces/')).length, 1);
    // Exécute le lanceur réellement contenu dans le ZIP, sans ouvrir un navigateur système.
    auditServer = spawn('python3', ['-c', "import runpy,webbrowser; webbrowser.open=lambda *args, **kwargs: False; runpy.run_path('demarrer.py',run_name='__main__')"], { cwd: dest });
    await new Promise((resolve,reject) => {
      let error = ''; const timer = setTimeout(()=>reject(new Error('Le lanceur auditeur ne répond pas. '+error)),10000);
      auditServer.stderr.on('data',chunk=>error+=chunk.toString());
      auditServer.once('error',err=>{clearTimeout(timer);reject(err);});
      auditServer.once('exit',code=>{clearTimeout(timer);reject(new Error('Lanceur auditeur arrêté : '+code+' '+error));});
      auditServer.stdout.once('data',()=>{clearTimeout(timer);resolve();});
    });
    auditOrigin = 'http://127.0.0.1:8124';
  });
  await run('Application auditeur hors ligne : consultation, observations et rapport sans accès à l’application', async () => {
    const audContext = await browser.newContext(), aud = await audContext.newPage(); watch(aud); await aud.goto(auditOrigin); await aud.locator('article.card').first().waitFor();
    // Le dossier autonome est servi seul, puis le réseau est coupé pour les observations/rapports.
    await audContext.setOffline(true);
    assert.equal(await aud.locator('form[data-eval]').count(), 1); await aud.locator('#author').fill('Auditeur fictif');
    await aud.locator('form [name="type"]').selectOption('Écart'); await aud.locator('form [name="text"]').fill('Écart synthétique à examiner, sans changement automatique du registre.'); await aud.locator('form button[type="submit"]').click();
    const promise = aud.waitForEvent('download'); await aud.locator('[data-a="export"]').click(); const dl = await promise; observationsFile = path.join(TEMP, 'observations.json'); await dl.saveAs(observationsFile);
    const report = JSON.parse(fs.readFileSync(observationsFile)); assert.equal(report.observations.length, 1); assert.equal(report.observations[0].type, 'Écart');
    const pop = aud.waitForEvent('popup'); await aud.locator('[data-a="report"]').click(); const rp = await pop; await rp.waitForLoadState(); assert.match(await rp.locator('body').innerText(), /À examiner/); await rp.pdf({ path: path.join(TEMP, 'rapport-auditeur.pdf'), format: 'A4', landscape: true }); await rp.close(); await audContext.close();
  });
  await run('Import et décision sur observations : scope contrôlé, résultats internes conservés', async () => {
    await chooser(() => p.locator('#panel [data-df-act="observations-import"]').click(), observationsFile); await confirm(); await p.getByText('Écart synthétique à examiner, sans changement automatique du registre.', { exact: true }).waitFor();
    let s = await stored(p); assert.equal(s.df.observations.length, 1); assert.equal(s.df.evaluations.find(e => e.id === hasEvalId).status, 'Conforme');
    await p.locator('#panel [data-df-act="review-observation"]').click(); await fld('validation').selectOption('Confirmée en interne'); await fill('reviewer', 'Responsable fictif'); await fill('decision', 'Prise en charge dans le prochain plan d’action.'); await submit();
    s = await stored(p); assert.equal(s.df.observations[0].validation, 'Confirmée en interne'); assert.equal(s.df.evaluations.find(e => e.id === hasEvalId).version, 3);
  });
  await run('Sauvegarde complète : données et deux versions de preuve avec empreintes vérifiables', async () => {
    await go('has', 'sources'); backupFile = await downloaded(() => p.locator('#panel [data-df-act="backup"]').click(), 'backup.zip');
    const z = await JSZip.loadAsync(fs.readFileSync(backupFile)), manifest = JSON.parse(await z.file('manifest.json').async('string')), text = await z.file('data/state.json').async('string');
    assert.equal(manifest.files.length, 2); assert.equal(crypto.createHash('sha256').update(text).digest('hex'), manifest.stateSha256);
    for (const f of manifest.files) assert.equal(crypto.createHash('sha256').update(await z.file(f.path).async('nodebuffer')).digest('hex'), f.sha256);
  });
  await run('Export JSON du menu legacy : conservation des données existantes et des lots D/F', async () => {
    await p.locator('[data-act="xexport"]').click();
    const exported = await downloaded(() => p.locator('#exportDlg [data-act="json"]').click(), 'legacy.json');
    const state = JSON.parse(fs.readFileSync(exported)); assert.equal(state.schema, 15); assert.equal(state.df.dossiers.length, 2); assert.equal(state.items.length, 157); assert.equal(state.evidences[0].dfVersions.length, 2);
    await p.locator('#exportDlg [data-act="closeexp"]').click();
  });
  await run('Restauration dans un profil neuf : données, relations et pièces réellement récupérées', async () => {
    const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await fresh.newPage(); watch(page); const previous = p; p = page;
    try { await p.goto(URL); await p.locator('#lx-auth').waitFor();await signIn(p); await go('care', 'sources'); await chooser(() => p.locator('#panel [data-df-act="restore"]').click(), backupFile); await confirm();
      await p.waitForFunction(async () => { const s = (await LegacyServer.request('/api/state')).state;return s && s.df.dossiers.length === 2; });
      const st = await stored(p); assert.equal(st.evidences[0].dfVersions.length, 2); assert.equal(st.df.budgets[0].spent, 15); assert.equal(st.df.auditPackages.length, 1);
      const checked = await p.evaluate(async () => { const st = (await LegacyServer.request('/api/state')).state; return (await LegacyDFStore.checkedBlob(st.evidences[0].dfVersions[0])).text(); }); assert.match(checked, /PREUVE SYNTHÉTIQUE/);
      await p.reload(); await p.locator('[data-sec="care"]').first().waitFor(); assert.equal((await stored(p)).df.dossiers.length, 2);
    } finally { p = previous; await fresh.close();await p.reload();await p.locator('#lx-account').waitFor(); }
  });
  await run('Archive altérée refusée avant toute écriture, dépôt trop volumineux également refusé', async () => {
    const z = await JSZip.loadAsync(fs.readFileSync(backupFile)); z.file('data/state.json', '{}'); const bad = await z.generateAsync({ type: 'nodebuffer' });
    const result = await p.evaluate(async bytes => { const before = JSON.stringify((await LegacyServer.request('/api/state')).state); let error; try { await LegacyDFStore.inspectBackup(new File([new Uint8Array(bytes)], 'altérée.zip')); } catch (e) { error = e.message; } return { error, unchanged: before === JSON.stringify((await LegacyServer.request('/api/state')).state) }; }, [...bad]);
    assert.match(result.error, /empreinte/); assert.equal(result.unchanged, true);
    const oversized = await p.evaluate(async () => { const st = (await LegacyServer.request('/api/state')).state; try { await LegacyDFStore.deposit(st, st.evidences[0].id, new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'trop-gros.bin')); } catch (e) { return e.message; } }); assert.match(oversized, /20 Mo/);
  });
  await run('Lecture seule : commandes désactivées et garde sur un événement forcé', async () => {
    const ro = await browser.newContext(), page = await ro.newPage(); watch(page); await page.goto(URL + '/?lecture');await page.locator('#lx-auth').waitFor();await signIn(page); await page.locator('[data-sec="care"]').first().click();
    const b = page.locator('[data-df-act="new-dossier"]').first(); assert.equal(await b.isDisabled(), true); await b.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.equal(await page.locator('#dfDialog').count(), 0); assert.match(await page.locator('#toast').innerText(), /lecture seule/); await ro.close();
  });
  await run('Non-régression du menu : les pages legacy restent accessibles', async () => {
    const targets = [['dash', 'dash'], ['audit', 'cibles'], ['audit', 'deroule'], ['audit', 'cal'], ['audit', 'people'], ['audit', 'couv'], ['pil', 'ctx-scope'], ['pil', 'ctx-pi'], ['pil', 'ctx-swot'], ['pil', 'ctx-roles'], ['pil', 'proc'], ['pil', 'obj'], ['pil', 'cmp'], ['pil', 'iso'], ['pil', 'ann'], ['pil', 'hds'], ['pil', 'fw'], ['pil', 'fd'], ['pil', 'act'], ['pil', 'sup'], ['pil', 'ar'], ['pil', 'sev'], ['pil', 'prv-reg'], ['pil', 'prv-cov'], ['pil', 'prv-det'], ['pil', 'pl-cal'], ['pil', 'pl-gantt'], ['pil', 'pl-rec'], ['pil', 'pl-formation'], ['pil', 'pl-sensi'], ['pil', 'pl-audit'], ['pil', 'pl-exo'], ['gap', 'apps'], ['gap', 'syn'], ['gap', 'reg'], ['gap', 'eval'], ['gap', 'plan'], ['gap', 'pol'], ['crrc', 'cr-over'], ['crrc', 'cr-est'], ['crrc', 'cr-off'], ['crrc', 'bk-dash'], ['crrc', 'bk-res'], ['crrc', 'bk-rest'], ['crrc', 'bk-alerts'], ['crrc', 'bk-rep'], ['inv', 'inv-dash'], ['inv', 'inv-lines'], ['inv', 'inv-ren'], ['inv', 'inv-cmp'], ['ops', 'inc-reg'], ['ops', 'inc-qual'], ['ops', 'cr-cell'], ['ops', 'cr-ct'], ['ops', 'cr-scen'], ['rep', 'exp'], ['rep', 'copil'], ['rep', 'codir']];
    const before = errors.length;
    for (const [sec, sub] of targets) { await p.locator('[data-act="nav"][data-sec="' + sec + '"]').first().click(); await p.evaluate(({ sec, sub }) => { const btn = document.createElement('button'); btn.dataset.act = 'nav'; btn.dataset.sec = sec; btn.dataset.sub = sub; document.body.appendChild(btn); btn.click(); btn.remove(); }, { sec, sub }); assert.ok((await p.locator('#panel').innerText()).length > 10, sec + '/' + sub); }
    assert.equal(errors.length, before, errors.slice(before).join('\n'));
  });
  await run('Responsive et thème sombre : captures réelles, sans débordement du document', async () => {
    await go('care');
    for (const width of [390, 768, 1440, 3840]) { await p.setViewportSize({ width, height: 950 }); await go('care', 'budget'); assert.match(await p.locator('#panel h2').innerText(), /Budgets/); await go('care', 'dash'); const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 2, 'Débordement ' + width + ': ' + overflow); await p.screenshot({ path: path.join(ROOT, 'recette/refonte-captures/care-' + width + '.png'), fullPage: true }); }
    await p.setViewportSize({ width: 1440, height: 950 }); await p.evaluate(() => document.documentElement.dataset.theme = 'dark'); await go('has', 'grid'); await p.screenshot({ path: path.join(ROOT, 'recette/refonte-captures/has-1440-sombre.png') });
    await p.setViewportSize({ width: 390, height: 950 }); await p.screenshot({ path: path.join(ROOT, 'recette/refonte-captures/has-390-sombre.png') }); await openEval(hasEvalId); await p.screenshot({ path: path.join(ROOT, 'recette/refonte-captures/has-fiche-390-sombre.png') }); await dlg().locator('[data-df-act="close"]').first().click();
    await p.evaluate(() => document.documentElement.dataset.theme = 'light'); await p.setViewportSize({ width: 1440, height: 900 });
  });
  await run('Sources et versions : campagne D1 réelle, import de grille, archivage et réouverture', async () => {
    const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await fresh.newPage(), previous = p; p = page; watch(p);
    try {
      await p.goto(URL);await p.locator('#lx-auth').waitFor();await signIn(p);await p.evaluate(async s=>{await LegacyServer.save(s);await LegacyServer.flush();await LegacyServer.refresh()},initialState);await p.reload();await p.locator('#lx-account').waitFor(); await go('care'); await p.locator('#panel [data-df-act="new-dossier"]').first().click(); await fill('title', 'D1 version documentée'); await fill('scope', 'Périmètre fictif'); await fld('frameworkId').selectOption('CARE-D1-1.9-DF'); await submit();
      let state = await stored(p); assert.equal(state.df.evaluations.length, 10); const original = state.df.dossiers[0]; assert.match(original.frameworkVersion, /1\.9/);
      await go('care', 'dossiers'); await p.locator('#panel [data-df-act="edit-dossier"]').click(); await dlg().locator('[data-df-act="archive-dossier"]').click(); await confirm(); await dlg().waitFor({ state: 'hidden' });
      state = await stored(p); assert.equal(state.df.dossiers[0].archived, true); assert.equal(state.df.evaluations.length, 10);
      await p.locator('[data-df-filter="dfArchived"]').check(); await p.locator('#panel [data-df-act="edit-dossier"]').click(); await dlg().locator('[data-df-act="archive-dossier"]').click(); await confirm(); await dlg().waitFor({ state: 'hidden' }); assert.equal((await stored(p)).df.dossiers[0].archived, false);
      await p.locator('[data-df-filter="dfArchived"]').uncheck(); await go('care', 'sources'); const frame = {dfKind:'CARE',domain:'D2',name:'Grille synthétique de recette',version:'RECETTE-1',sourceUrl:'https://esante.gouv.fr/',requirements:[{id:'TEST-1',title:'Critère synthétique à vérifier',chapter:'Recette',prerequisites:'Précondition synthétique',criteria:'Vérification synthétique'}]};
      const file = path.join(TEMP,'grille-synthetique.json'); fs.writeFileSync(file,JSON.stringify(frame)); await chooser(() => p.locator('#panel [data-df-act="framework-import"]').click(),file); await confirm(); await p.getByText('Grille synthétique de recette · RECETTE-1',{exact:true}).waitFor();
      state = await stored(p); const imported = state.frameworks.find(f=>f.name===frame.name); assert.equal(imported.sourceStatus,'Importé — à vérifier');
      await p.locator('#panel [data-df-act="verify-framework"][data-id="'+imported.id+'"]').click(); await fill('reuse','Fixture interne synthétique de recette, sans prétention officielle.'); await submit(); assert.equal((await stored(p)).frameworks.find(f=>f.id===imported.id).sourceStatus,'Vérifié localement');
      await go('care','dossiers'); await p.locator('#panel [data-df-act="new-dossier"]').click(); await fill('title','Campagne de grille importée'); await fld('domain').selectOption('D2'); await fld('frameworkId').selectOption(imported.id); await fill('scope','Autre périmètre fictif'); await submit();
      state = await stored(p); assert.equal(state.df.evaluations.length,11); assert.equal(state.df.dossiers[0].frameworkId,original.frameworkId); assert.equal(state.df.evaluations.at(-1).requirement.criteria,'Vérification synthétique');
    } finally {p=previous;await fresh.close();}
  });
  await run('Ouverture sans serveur : prérequis explicite pour la persistance et les permissions', async () => {
    const c = await browser.newContext(), page = await c.newPage(); watch(page);
    try {
      await page.goto('file://' + path.join(ROOT, 'index.html'));
      await page.locator('#legacy-session h1').waitFor();
      assert.match(await page.locator('#legacy-session').innerText(), /Démarrer le serveur Legacy/);
    } catch (e) {
      if (e.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR')) return {notExecutedReason:'Politique Chromium du workspace : file:// interdit. Application qualifiée sur le serveur Legacy localhost.'};
      throw e;
    } finally {await c.close();}
  });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
}
main().catch(e => { process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (auditServer) auditServer.kill();
  fs.writeFileSync(path.join(ROOT, 'recette/refonte-regression-resultats.json'), JSON.stringify({ executedAt: new Date().toISOString(), environment: 'Chromium local, profils isolés, données synthétiques', passed: tests.filter(t => t.status === 'PASSÉ').length, failed: tests.filter(t => t.status === 'ÉCHEC').length, notExecuted: tests.filter(t => t.status === 'NON EXÉCUTÉ').length, pageErrors: errors, externalRequests: external.length, tests }, null, 2));
  console.log('Résultats ' + tests.filter(t => t.status === 'PASSÉ').length + ' passés ; ' + tests.filter(t => t.status === 'ÉCHEC').length + ' échec(s). Fichiers temporaires hors livraison.');
});
