/* Application auditeur autonome : le HTML exporté contient exclusivement le dossier filtré. */
(function () {
  'use strict';
  function run() {
    const P = JSON.parse(document.getElementById('auditData').textContent);
    const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const key = 'legacy-df-audit:' + P.id, types = ['Constat', 'Observation', 'Écart', 'Recommandation'];
    let rows = [], author = P.auditor || '', q = '', selected = '', typeFilter = '', toastTimer;
    try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && Array.isArray(saved.rows)) { rows = saved.rows.filter(o => P.evaluations.some(e => e.id === o.evaluationId) && types.includes(o.type)); author = saved.author || author; } } catch (_) {}
    function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 6000); }
    function save() { try { localStorage.setItem(key, JSON.stringify({ rows, author })); } catch (_) { toast('Le navigateur ne conserve pas les observations : exportez le JSON avant de fermer.'); } }
    function download(name, data) { const b = new Blob([data], { type: 'application/json;charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
    function external(url, text) { try { const u = new URL(url); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw 0; return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`; } catch (_) { return '<span class="muted">Document externe non accessible</span>'; } }
    function pathLink(path, name) { if (typeof path !== 'string' || !path.startsWith('pieces/') || path.split('/').includes('..') || /[\\\x00-\x1f]/.test(path)) return 'Pièce non incluse'; return `<a href="${esc(path.split('/').map(encodeURIComponent).join('/'))}" download>${esc(name)}</a>`; }
    function pills(status) { return `<span class="pill">${esc(status)}</span>`; }
    function render() {
      const entries = P.evaluations.filter(e => (!selected || e.dossierId === selected) && (!q || (e.requirementId + ' ' + e.requirement.title + ' ' + e.notes).toLowerCase().includes(q.toLowerCase())));
      document.getElementById('content').innerHTML = `<div class="heading"><div><div class="eyebrow">Dossier auditeur · accès limité au contenu remis</div><h1>${esc(P.title)}</h1><p class="muted">${P.evaluations.length} critères autorisés · ${P.evidences.length} preuves · ${new Date(P.createdAt).toLocaleDateString('fr-FR')}</p></div><div class="actions"><button data-a="export">Exporter les observations JSON</button><button data-a="report">Rapport / PDF</button></div></div><div class="note">Les évaluations et pièces du dossier sont consultables. Vos observations restent distinctes et seront examinées par le responsable. Le nom saisi est un auteur déclaré, sans connexion à l’application source.${P.expiresAt ? '<br>Fin prévue de mission : ' + esc(P.expiresAt) + '. Les données déjà transmises ne sont pas révoquées automatiquement.' : ''}</div><div class="filters"><label>Auteur déclaré<input id="author" value="${esc(author)}" maxlength="200"></label><label>Dossier<select id="dossier"><option value="">Tous les dossiers autorisés</option>${P.dossiers.map(d => `<option value="${esc(d.id)}"${selected === d.id ? ' selected' : ''}>${esc(d.title + ' · ' + d.scope.join(', '))}</option>`).join('')}</select></label><label>Rechercher<input id="query" value="${esc(q)}" placeholder="Référence, libellé…"></label></div><section class="grid">${entries.map(e => {
        const d = P.dossiers.find(d => d.id === e.dossierId), proofs = e.proofRefs.map(r => { const p = P.evidences.find(p => p.id === r.evidenceId), v = p && p.versions.find(v => v.id === r.versionId); return p ? `<li><strong>${esc(p.title)}</strong> · ${esc(p.classification || '')}<br>${v ? pathLink(v.exportPath, 'v' + v.number + ' · ' + v.name) + '<br><small>SHA-256 ' + esc(v.sha256) + '</small>' : external(p.location, 'Ouvrir le document externe')}<br>${(p.validations.filter(v => v.versionId === r.versionId).at(-1) || {}).status ? pills(p.validations.filter(v => v.versionId === r.versionId).at(-1).status) : pills('Non vérifiée')}</li>` : ''; }).join('');
        const findings = P.findings.filter(f => e.findingIds.includes(f.id));
        return `<article class="card"><div class="eyebrow">${esc(d.title)} · ${esc(e.requirementId)}</div><h2>${esc(e.requirement.title)}</h2><p>${pills(e.status)} ${e.custom ? pills('Objectif local — non officiel') : ''}</p><p class="muted">${esc(d.frameworkName)} · ${esc(d.frameworkVersion)} · version d’évaluation ${e.version}</p>${e.requirement.applicability || e.requirement.scope ? '<p><strong>Applicabilité :</strong> ' + esc(e.requirement.applicability || e.requirement.scope) + '</p>' : ''}${e.applicabilityReason ? '<p>Justification : ' + esc(e.applicabilityReason) + '</p>' : ''}<p>${esc(e.notes || 'Aucun commentaire de l’évaluateur.')}</p><p class="muted">${esc(e.owner)} · ${esc(e.due)}${e.reviewer ? '<br>Vérifié en interne par ' + esc(e.reviewer) + ' · ' + esc(e.reviewedAt) : ''}</p>${external(e.requirement.sourceUrl, 'Consulter la source')}<details><summary>Preuves (${e.proofRefs.length}) et actions (${findings.length})</summary><ul class="proofs">${proofs || '<li>Aucune pièce rattachée.</li>'}</ul><ul>${findings.map(f => `<li>${esc(f.id)} · ${esc(f.text)} · ${esc(f.status)} · ${f.tasks.filter(t => t.done).length}/${f.tasks.length} tâches</li>`).join('')}</ul></details><div class="observation">${rows.filter(o => o.evaluationId === e.id).map(o => `<div class="obs"><strong>${esc(o.type)}</strong><p>${esc(o.text)}</p><small>${esc(o.author)} · À examiner par le responsable</small><button data-a="remove" data-id="${esc(o.id)}" aria-label="Retirer cette observation">Retirer</button></div>`).join('')}<form data-eval="${esc(e.id)}"><label>Type<select name="type">${types.map(t => `<option>${t}</option>`).join('')}</select></label><label>Texte<textarea name="text" maxlength="10000" rows="3" required placeholder="Rédiger un constat, un écart ou une recommandation…"></textarea></label><button type="submit">Ajouter une observation</button></form></div></article>`;
      }).join('') || '<p>Aucun critère pour ce filtre.</p>'}</section><section class="card"><h2>Observations (${rows.length})</h2><label>Filtrer par type<select id="typeFilter"><option value="">Tous</option>${types.map(t => `<option${typeFilter === t ? ' selected' : ''}>${t}</option>`).join('')}</select></label><ul>${rows.filter(o => !typeFilter || o.type === typeFilter).map(o => `<li><strong>${esc(o.type)}</strong> · ${esc((P.evaluations.find(e => e.id === o.evaluationId) || {}).requirementId)}<p>${esc(o.text)}</p><small>${esc(o.author)} · Validation : à examiner</small></li>`).join('') || '<li>Aucune observation.</li>'}</ul></section>`;
    }
    function report() {
      const w = window.open('', '_blank'); if (!w) return toast('Autorisez l’ouverture du rapport.');
      w.opener = null;
      const css = document.getElementById('auditStyle').textContent;
      w.document.open(); w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport d’audit interne</title><style>${css}</style></head><body><div class="actions print-toolbar"><button id="print">Imprimer / enregistrer en PDF</button></div><main><div class="eyebrow">Rapport auditeur · version remise ${esc(P.fingerprint.slice(0, 12))}</div><h1>${esc(P.title)}</h1><p>Auteur déclaré : ${esc(author || 'Non renseigné')}</p><p class="note">Constats, observations, écarts et recommandations sont distincts. Statut de validation : à examiner par le responsable. Ce rapport ne vaut pas certification.</p>${P.dossiers.map(d => `<p><strong>${esc(d.title)}</strong> · ${esc(d.scope.join(', '))} · ${esc(d.frameworkName)} · ${esc(d.frameworkVersion)}</p>`).join('')}<h2>Évaluations consultées</h2><table><thead><tr><th>Critère</th><th>État interne</th><th>Preuves examinables</th></tr></thead><tbody>${P.evaluations.map(e => `<tr><td>${esc(e.requirementId)} · ${esc(e.requirement.title)}</td><td>${esc(e.status)}</td><td>${esc(e.proofRefs.map(r => r.evidenceId + '/' + r.versionId).join('; '))}</td></tr>`).join('')}</tbody></table><h2>Observations à examiner</h2><table><thead><tr><th>Type</th><th>Critère</th><th>Texte</th><th>Auteur déclaré</th><th>Validation</th></tr></thead><tbody>${rows.map(o => `<tr><td>${esc(o.type)}</td><td>${esc((P.evaluations.find(e => e.id === o.evaluationId) || {}).requirementId)}</td><td>${esc(o.text)}</td><td>${esc(o.author)}</td><td>À examiner</td></tr>`).join('') || '<tr><td colspan="5">Aucune observation.</td></tr>'}</tbody></table></main><script>document.getElementById('print').onclick=()=>window.print();<\/script></body></html>`); w.document.close();
    }
    document.addEventListener('submit', e => {
      const form = e.target.closest('[data-eval]'); if (!form) return; e.preventDefault();
      const fd = new FormData(form), text = String(fd.get('text') || '').trim(), type = fd.get('type');
      if (!author.trim()) return toast('Renseignez votre nom d’auteur avant d’ajouter une observation.');
      if (!text || text.length > 10000 || !types.includes(type) || !P.evaluations.some(x => x.id === form.dataset.eval)) return toast('Observation invalide.');
      rows.push({ id: 'OBS-' + crypto.randomUUID(), evaluationId: form.dataset.eval, type, text, author: author.trim(), at: new Date().toISOString() }); save(); render();
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'export') { download('Observations-audit-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ format: 'legacy-df-observations', formatVersion: 1, packageId: P.id, fingerprint: P.fingerprint, exportedAt: new Date().toISOString(), author, observations: rows }, null, 2)); toast('Observations téléchargées. Remettez ce JSON au responsable.'); }
      if (b.dataset.a === 'remove') { rows = rows.filter(o => o.id !== b.dataset.id); save(); render(); }
      if (b.dataset.a === 'report') report();
    });
    let timer;
    document.addEventListener('input', e => { if (e.target.id === 'author') { author = e.target.value; save(); } if (e.target.id === 'query') { q = e.target.value; const pos = e.target.selectionStart; clearTimeout(timer); timer = setTimeout(() => { render(); const inp = document.getElementById('query'); inp.focus(); inp.setSelectionRange(pos, pos); }, 200); } });
    document.addEventListener('change', e => { if (e.target.id === 'dossier') { selected = e.target.value; render(); } if (e.target.id === 'typeFilter') { typeFilter = e.target.value; render(); } });
    render();
  }
  const css = `:root{--paper:#edf1f0;--surface:#fff;--sunk:#f4f7f5;--ink:#253b31;--ink2:#596d62;--line:#d2ded6;--accent:#376d57;color-scheme:light}@media(prefers-color-scheme:dark){:root{--paper:#14201a;--surface:#1d2b23;--sunk:#17231c;--ink:#e2eee6;--ink2:#a5baad;--line:#354a3d;--accent:#9bbda5;color-scheme:dark}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 system-ui,sans-serif}main{max-width:1350px;margin:30px auto;padding:0 24px}h1{font-size:27px;line-height:1.2}h2{font-size:17px}a{color:var(--accent);overflow-wrap:anywhere}.eyebrow{font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;font-weight:700}.muted,small{color:var(--ink2)}small{overflow-wrap:anywhere}.heading,.actions,.filters{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;align-items:center}.actions{justify-content:flex-start}.note{background:var(--sunk);border:1px solid var(--line);padding:14px;border-radius:10px;font-size:13px;margin:20px 0}.filters{justify-content:flex-start;margin:20px 0;align-items:flex-end}label{display:flex;flex-direction:column;gap:6px;color:var(--ink2);font-size:12px}input,select,textarea{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:7px;padding:9px;max-width:100%}textarea{width:100%;resize:vertical}button{font:inherit;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:7px;padding:8px 12px;cursor:pointer}button:hover{background:var(--sunk)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px}.card{background:var(--surface);border:1px solid var(--line);padding:22px;border-radius:12px;min-width:0}.pill{background:var(--sunk);border:1px solid var(--line);padding:3px 7px;border-radius:5px;font-size:11px}summary{cursor:pointer;font-weight:600;margin:18px 0;color:var(--accent)}.proofs{padding-left:18px}.proofs li{padding:8px 0}.observation{margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}form{display:grid;gap:10px}.obs{background:var(--sunk);padding:12px;border-radius:8px;margin-bottom:12px}.obs p{white-space:pre-wrap}.obs button{margin-left:12px;font-size:11px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--surface);border-radius:9px;padding:12px 18px;max-width:90vw;z-index:10}@media(max-width:750px){main{padding:0 14px;margin:20px auto}.grid{grid-template-columns:1fr}.card{padding:16px}.filters label{width:100%}input,select{width:100%}}@page{size:A4 landscape;margin:12mm}@media print{body{background:#fff;color:#14213d;font-size:11px}main{padding:0;margin:0;max-width:none}.actions,.filters,form,.obs button{display:none}.grid{display:block}.card{border:1px solid #ddd;background:white;break-inside:avoid;margin-bottom:15px}.note{color:#333;border:1px solid #ddd}.eyebrow,.muted,small{color:#555}tr{break-inside:avoid}thead{display:table-header-group}}`;
  function html(pkg) {
    const data = JSON.stringify(pkg).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"><title>Dossier auditeur — local</title><style id="auditStyle">${css}</style></head><body><main id="content"></main><div id="toast" class="toast" role="status" hidden></div><script id="auditData" type="application/json">${data}<\/script><script>(${run.toString()})();<\/script></body></html>`;
  }
  function launchers() {
    return {
      'demarrer.py': `#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import functools, webbrowser
root = Path(__file__).resolve().parent
class LocalHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Host', '').split(':')[0] not in ['127.0.0.1', 'localhost']:
            self.send_error(403)
            return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()
server = ThreadingHTTPServer(('127.0.0.1', 8124), functools.partial(LocalHandler, directory=str(root)))
print('Dossier auditeur : http://127.0.0.1:8124 — Ctrl+C pour arrêter.', flush=True)
webbrowser.open('http://127.0.0.1:8124')
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
`,
      'demarrer.bat': '@echo off\r\ncd /d "%~dp0"\r\nwhere py >nul 2>nul\r\nif errorlevel 1 (python demarrer.py) else (py -3 demarrer.py)\r\npause\r\n',
      'demarrer.sh': '#!/usr/bin/env sh\nset -eu\ncd "$(dirname "$0")"\nexec python3 demarrer.py\n'
    };
  }
  window.LegacyDFAuditor = { html, launchers };
})();
