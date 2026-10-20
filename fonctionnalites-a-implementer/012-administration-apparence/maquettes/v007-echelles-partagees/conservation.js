// Local retention demonstration: no requests, timers, storage or filesystem deletion.
paths.retention='M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7';
const retentionNow=new Date('2026-10-20T12:00:00Z');
const retentionKinds=[
 {id:'proof',name:'Pièces justificatives',icon:'backup',anchor:'Après retrait du justificatif',duration:24,unit:'months',mode:'trash'},
 {id:'gap',name:'Écarts clôturés',icon:'catalogue',anchor:'Après la dernière clôture',duration:36,unit:'months',mode:'archive'},
 {id:'action',name:'Actions terminées',icon:'logs',anchor:'Après la date de fin effective',duration:36,unit:'months',mode:'archive'},
 {id:'export',name:'Exports temporaires',icon:'stack',anchor:'Après la génération du fichier',duration:30,unit:'days',mode:'trash'},
 {id:'log',name:'Journaux techniques',icon:'resources',anchor:'Après la rotation du journal',duration:90,unit:'days',mode:'trash'}
];
const defaults={enabled:false,time:'03:00',purge:false,grace:30,rules:Object.fromEntries(retentionKinds.map(k=>[k.id,{enabled:true,duration:k.duration,unit:k.unit,mode:k.mode}]))};
let retentionSaved=structuredClone(defaults),retentionDraft=structuredClone(defaults),retentionTab='rules',retentionConfirmation=false;
const retentionRows=[
 {id:'PJ-101',type:'proof',name:'Justificatif retiré',date:'2023-06-01',state:'retired',bytes:1200},
 {id:'PJ-102',type:'proof',name:'Preuve partagée entre deux registres',date:'2023-06-01',state:'retired',refs:2,bytes:800},
 {id:'PJ-103',type:'proof',name:'Justificatif sous conservation',date:'2022-02-01',state:'retired',hold:true,bytes:640},
 {id:'EC-041',type:'gap',name:'Écart clôturé de la campagne 2022',date:'2022-08-10',state:'closed',bytes:0},
 {id:'EC-042',type:'gap',name:'Écart lié à un audit actif',date:'2022-01-01',state:'closed',refs:1,bytes:0},
 {id:'AC-061',type:'action',name:'Action corrective terminée',date:'2022-08-10',state:'done',bytes:0},
 {id:'AC-062',type:'action',name:'Action rouverte',date:'2022-05-01',state:'open',bytes:0},
 {id:'AC-063',type:'action',name:'Action récemment terminée',date:'2026-09-01',state:'done',bytes:0},
 {id:'EX-011',type:'export',name:'Export temporaire obsolète',date:'2025-01-01',state:'finished',bytes:64},
 {id:'JT-014',type:'log',name:'Journal technique après rotation',date:'2025-01-01',state:'rotated',bytes:10},
 {id:'EX-009',type:'export',name:'Ancien export déjà en corbeille',date:'2024-01-01',state:'finished',bytes:40,stage:'trash',trashedAt:'2026-09-01',autoTrash:true}
].map(r=>({stage:'active',refs:0,hold:false,...r}));
let retentionHistory=[];
function retentionCutoff(duration,unit,now=retentionNow){
 const d=new Date(now);if(unit==='days'){d.setUTCDate(d.getUTCDate()-duration);return d;}
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-duration*(unit==='years'?12:1));
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d;
}
function retentionDecision(row,policy){
 const rule=policy.rules[row.type];
 if(!rule?.enabled)return {eligible:false,reason:'Catégorie désactivée'};
 if(row.stage!=='active')return {eligible:false,reason:row.stage==='trash'?'Déjà en corbeille':row.stage==='purged'?'Déjà supprimé':'Déjà archivé'};
 if(row.hold)return {eligible:false,reason:'Conservation protégée'};
 if(row.refs>0)return {eligible:false,reason:'Encore lié à un usage protégé'};
 if(row.state!==({proof:'retired',gap:'closed',action:'done',export:'finished',log:'rotated'})[row.type])return {eligible:false,reason:'Élément actif ou rouvert'};
 if(!row.date||!Number.isFinite(new Date(row.date).getTime()))return {eligible:false,reason:'Date de référence absente ou invalide'};
 if(new Date(row.date)>retentionCutoff(rule.duration,rule.unit))return {eligible:false,reason:'Délai non atteint'};
 return {eligible:true,reason:rule.mode==='archive'?'À archiver':'Vers la corbeille',mode:rule.mode};
}
function retentionPurgeEligible(row,policy){return policy.enabled&&policy.purge&&policy.rules[row.type]?.enabled&&policy.rules[row.type].mode==='trash'&&row.state===({proof:'retired',gap:'closed',action:'done',export:'finished',log:'rotated'})[row.type]&&Boolean(row.date)&&new Date(row.date)<=retentionCutoff(policy.rules[row.type].duration,policy.rules[row.type].unit)&&row.stage==='trash'&&row.autoTrash&&!row.refs&&!row.hold&&Boolean(row.trashedAt)&&new Date(row.trashedAt)<=retentionCutoff(policy.grace,'days');}
function retentionValidate(p){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))return 'Renseignez une heure valide.';
 for(const k of retentionKinds){const r=p.rules[k.id];if(r.enabled&&(!Number.isSafeInteger(r.duration)||r.duration<1||!Number.isFinite(retentionCutoff(r.duration,r.unit).getTime())))return 'Chaque délai actif doit être un nombre entier supérieur à zéro.';}
 if(!Number.isSafeInteger(p.grace)||p.grace<1||!Number.isFinite(retentionCutoff(p.grace,'days').getTime()))return 'Le délai de récupération doit être supérieur à zéro.';
 if(p.enabled&&!Object.values(p.rules).some(r=>r.enabled))return 'Activez au moins une catégorie ou désactivez le nettoyage automatique.';
 return '';
}
function retentionOpenTab(tab){retentionTab=tab;retentionConfirmation=false;openRetention();}
const retentionUnit=u=>({days:'jours',months:'mois',years:'ans'})[u];
const retentionSize=n=>n>=1000?(n/1000).toLocaleString('fr-FR',{maximumFractionDigits:2})+' Go':n+' Mo';
function retentionCounts(policy){const selected=retentionRows.filter(r=>retentionDecision(r,policy).eligible);return {selected,archive:selected.filter(r=>policy.rules[r.type].mode==='archive'),trash:selected.filter(r=>policy.rules[r.type].mode==='trash'),blocked:retentionRows.filter(r=>r.stage==='active'&&!retentionDecision(r,policy).eligible),purge:retentionRows.filter(r=>retentionPurgeEligible(r,policy))};}
function retentionHeader(){return `<nav class="segmented retention-tabs" aria-label="Conservation"><button data-retention-tab="rules" aria-pressed="${retentionTab==='rules'}">Règles de conservation</button><button data-retention-tab="preview" aria-pressed="${retentionTab==='preview'}">Prévisualisation</button><button data-retention-tab="history" aria-pressed="${retentionTab==='history'}">Journal & corbeille</button></nav>`;}
function retentionRuleBody(){return `<div class="retention-master"><div><b>Nettoyage automatique</b><small>Chaque jour à l’heure choisie · ${retentionDraft.enabled?'activation proposée dans le brouillon':'désactivé dans le brouillon'}</small></div><label class="toggle-label"><input type="checkbox" id="retention-enabled" ${retentionDraft.enabled?'checked':''}><span>Activer</span></label></div><div class="retention-settings"><label>Heure du passage (UTC)<input type="time" id="retention-time" value="${esc(retentionDraft.time)}" required></label><p>Politique commune à la plateforme.<br>Les périmètres restent ceux des registres.</p></div><div class="retention-table-head"><span>Contenus à gérer</span><span>Après</span><span>Traitement</span></div>${retentionKinds.map(k=>{const r=retentionDraft.rules[k.id];return `<div class="retention-rule" data-rule="${k.id}"><label class="rule-name"><input type="checkbox" data-rule-field="enabled" ${r.enabled?'checked':''}><span><b>${k.name}</b><small>${k.anchor}</small></span></label><div class="duration"><input type="number" data-rule-field="duration" min="1" step="1" value="${r.duration}" aria-label="Délai ${k.name}" ${r.enabled?'':'disabled'}><select data-rule-field="unit" aria-label="Unité ${k.name}" ${r.enabled?'':'disabled'}>${['days','months','years'].map(u=>`<option value="${u}" ${u===r.unit?'selected':''}>${retentionUnit(u)}</option>`).join('')}</select></div><select data-rule-field="mode" aria-label="Traitement ${k.name}" ${r.enabled?'':'disabled'}><option value="archive" ${r.mode==='archive'?'selected':''}>Archiver</option><option value="trash" ${r.mode==='trash'?'selected':''}>Mettre en corbeille</option></select></div>`}).join('')}<div class="purge-panel"><label><input id="retention-purge" type="checkbox" ${retentionDraft.purge?'checked':''}><b>Vider automatiquement la corbeille issue du nettoyage</b></label><div><span>Après</span><input id="retention-grace" type="number" min="1" step="1" value="${retentionDraft.grace}" aria-label="Délai de récupération en jours"><span>jours en corbeille</span><span class="badge ${retentionDraft.purge?'attention':''}">${retentionDraft.purge?'Suppression définitive':'Purge désactivée'}</span></div></div><p class="editor-help">Les délais ci-dessus sont des exemples à adapter. L’archivage conserve les contenus ; la corbeille permet leur récupération avant purge.</p><div class="notice">Toujours exclus : éléments actifs ou rouverts, preuves encore utilisées, contenus sous conservation protégée. Les validations immuables et le journal d’audit ne sont pas nettoyés par cette politique.</div>`;}
function retentionPreviewBody(){
 const error=retentionValidate(retentionDraft);if(error)return `<div class="form-error">${error}</div><button class="btn" data-retention-tab="rules">Corriger les règles</button>`;
 const c=retentionCounts(retentionDraft),potential=retentionReclaimableBytes(c.trash),purgeBytes=retentionReclaimableBytes(c.purge);
 return `<p class="retention-caption">Projection du brouillon au 20 octobre 2026 · données fictives · ${retentionDraft.enabled?'automatisation proposée':'aucune exécution automatique tant que désactivé'}</p><div class="mini-grid retention-metrics"><div><small>À archiver</small><b>${c.archive.length}</b><small>Conservés dans l’historique</small></div><div><small>Vers la corbeille</small><b>${c.trash.length}</b><small>${retentionSize(potential)} potentiels après purge</small></div><div><small>Exclus du nettoyage</small><b>${c.blocked.length}</b><small>Usage, protection ou délai</small></div><div><small>Purge éligible maintenant</small><b>${c.purge.length}</b><small>${retentionSize(purgeBytes)} simulés · aucun gain réel</small></div></div><div class="retention-results"><div class="result-head"><b>Éléments examinés</b><small>Le serveur devra revérifier les liens avant chaque opération.</small></div>${retentionRows.filter(r=>r.stage==='active').map(r=>{const d=retentionDecision(r,retentionDraft);return `<div class="retention-result"><span><b>${r.id} · ${r.name}</b><small>Date de référence : ${r.date||'absente'}</small></span><span class="badge ${d.eligible?'':'neutral'}">${d.reason}</span></div>`}).join('')}</div><div class="notice">Aucun espace n’est libéré lors de l’archivage ou de la mise en corbeille. Les volumes affichés concernent uniquement les fichiers fictifs ; les sauvegardes suivent leur propre rétention.</div>${retentionConfirmation?`<div class="confirm-inline"><b>Confirmer cette politique de démonstration ?</b><p>Automatisation ${retentionDraft.enabled?'activée':'désactivée'} · ${Object.values(retentionDraft.rules).filter(r=>r.enabled).length} catégories · purge ${retentionDraft.purge?'activée après '+retentionDraft.grace+' jours':'désactivée'}. Aucune tâche réelle ne sera programmée.</p><button class="btn primary" id="retention-confirm-save">Confirmer · démo</button> <button class="btn" id="retention-cancel-save">Annuler</button></div>`:''}`;
}
function retentionHistoryBody(){const trash=retentionRows.filter(r=>r.stage==='trash');return `<div class="retention-master"><div><b>Politique enregistrée · ${retentionSaved.enabled?'automatique activé':'automatique désactivé'}</b><small>Simulation uniquement · aucune tâche serveur programmée</small></div><button class="btn primary" id="retention-run" ${retentionSaved.enabled?'':'disabled'}>Simuler un passage</button></div><div class="section-heading"><h2>Journal des opérations</h2><span>${retentionHistory.length} événement(s) local(aux)</span></div>${retentionHistory.length?`<div class="retention-results">${retentionHistory.map(h=>`<div class="retention-result"><span><b>${esc(h.title)}</b><small>${esc(h.actor)} · version de politique ${h.version}</small></span><span>${esc(h.detail)}</span></div>`).join('')}</div>`:'<div class="empty">Aucun passage simulé dans cette session.</div>'}<div class="section-heading"><h2>Corbeille du nettoyage</h2><span>Récupération avant suppression définitive</span></div><div class="retention-results">${trash.length?trash.map(r=>`<div class="retention-result"><span><b>${r.id} · ${r.name}</b><small>En corbeille depuis ${r.trashedAt} · ${retentionSize(r.bytes)}</small></span><button class="btn" data-retention-restore="${r.id}">Restaurer</button></div>`).join(''):'<p class="empty">Corbeille vide.</p>'}</div><p class="editor-help">Une restauration ajoute une protection pour éviter un nouveau retrait au prochain passage. Cet historique est fictif et conservé en mémoire seulement.</p>`;}
function openRetention(){
 const body=retentionTab==='rules'?retentionRuleBody():retentionTab==='preview'?retentionPreviewBody():retentionHistoryBody();
 const buttons=retentionTab==='rules'?'<button class="btn primary" id="retention-preview">Prévisualiser les effets →</button>':retentionTab==='preview'?'<button class="btn" data-retention-tab="rules">Modifier les règles</button> <button class="btn primary" id="retention-save">Enregistrer la politique · démo</button>':'<button class="btn" data-retention-tab="rules">Revenir aux règles</button>';
 panel('Historique & conservation',retentionHeader()+body+'<div id="retention-error" class="form-error" role="alert"></div>',buttons,true);$('#dialog').classList.add('retention-dialog');
}
let retentionVersion=0;
function retentionRun(){
 if(!retentionSaved.enabled)return;
 const before=retentionCounts(retentionSaved);let archived=0,trashed=0,purged=0;
 // Purge is assessed before newly trashed objects: no same-run bypass of grace.
 for(const row of retentionRows){if(retentionPurgeEligible(row,retentionSaved)){row.stage='purged';purged++;}}
 for(const row of retentionRows){const decision=retentionDecision(row,retentionSaved);if(!decision.eligible)continue;if(decision.mode==='archive'){row.stage='archived';archived++;}else{row.stage='trash';row.autoTrash=true;row.trashedAt=retentionNow.toISOString().slice(0,10);trashed++;}}
 retentionHistory.unshift({title:'Passage simulé · 20/10/2026, 12:00 UTC',actor:'Moteur de démonstration',version:retentionVersion,detail:`${archived} archivés · ${trashed} en corbeille · ${purged} purgés · ${before.blocked.length} exclus`});openRetention();
}
function retentionChanged(){retentionConfirmation=false;}
document.addEventListener('input',e=>{
 const t=e.target;if(t.id==='retention-time'){retentionDraft.time=t.value;retentionChanged();}if(t.id==='retention-grace'){retentionDraft.grace=Number(t.value);retentionChanged();}
 if(t.dataset.ruleField==='duration'){retentionDraft.rules[t.closest('[data-rule]').dataset.rule].duration=Number(t.value);retentionChanged();}
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='retention-enabled'||t.id==='retention-purge'){retentionDraft[t.id==='retention-enabled'?'enabled':'purge']=t.checked;retentionChanged();openRetention();}
 if(t.dataset.ruleField&&t.dataset.ruleField!=='duration'){const r=retentionDraft.rules[t.closest('[data-rule]').dataset.rule];r[t.dataset.ruleField]=t.type==='checkbox'?t.checked:t.value;retentionChanged();if(t.type==='checkbox')openRetention();}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.retentionTab)retentionOpenTab(b.dataset.retentionTab);
 if(b.id==='retention-preview'||b.id==='retention-save'){const error=retentionValidate(retentionDraft);if(error){$('#retention-error').textContent=error;return;}if(b.id==='retention-preview')retentionOpenTab('preview');else{retentionConfirmation=true;openRetention();$('.confirm-inline').scrollIntoView({block:'nearest'});}}
 if(b.id==='retention-cancel-save'){retentionConfirmation=false;openRetention();}
 if(b.id==='retention-confirm-save'){if(retentionValidate(retentionDraft))return;retentionSaved=structuredClone(retentionDraft);retentionVersion++;retentionConfirmation=false;retentionHistory.unshift({title:'Politique enregistrée · démonstration',actor:'Administrateur démo',version:retentionVersion,detail:`Automatique ${retentionSaved.enabled?'activé':'désactivé'} · purge ${retentionSaved.purge?'activée':'désactivée'}`});catalogue.system.find(c=>c.id==='retention').badge=retentionSaved.enabled?'Automatique · démo':'Automatique désactivé';render();retentionOpenTab('history');}
 if(b.id==='retention-run')retentionRun();
 if(b.dataset.retentionRestore){const row=retentionRows.find(r=>r.id===b.dataset.retentionRestore);if(row?.stage==='trash'){row.stage='active';row.hold=true;retentionHistory.unshift({title:row.id+' restauré et protégé',actor:'Administrateur démo',version:retentionVersion,detail:'Exclu des prochains passages'});openRetention();}}
});
// Base page was rendered before this file loaded; refresh the new card icon.
render();
