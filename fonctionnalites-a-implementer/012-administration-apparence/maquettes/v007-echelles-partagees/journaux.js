// Fixtures only. Downloads contain synthetic rows; no production log is read.
const auditFixtures=[
 {id:'TR-204',ts:'2026-10-20T09:42:00Z',actor:'Camille Martin',action:'Validation de tâche',target:'TR-018 · Contrôle mensuel',result:'OK'},
 {id:'TR-203',ts:'2026-10-20T09:30:00Z',actor:'Alex Dupont',action:'Clôture d’action',target:'ACT-042 · Revue des accès',result:'Terminée'},
 {id:'TR-202',ts:'2026-10-20T08:15:00Z',actor:'Administration démo',action:'Modification des paramètres',target:'Messagerie technique',result:'Enregistrée'},
 {id:'TR-201',ts:'2026-10-19T16:22:00Z',actor:'Camille Martin',action:'Ajout de preuve',target:'PJ-104 · Audit de surveillance',result:'Ajoutée'}
];
const technicalFixtures=[
 {id:'LOG-405',ts:'2026-10-20T09:45:00Z',service:'API',level:'debug',message:'Recherche terminée · durée 42 ms · paramètres masqués'},
 {id:'LOG-404',ts:'2026-10-20T09:42:00Z',service:'Stockage',level:'info',message:'Contrôle de capacité terminé'},
 {id:'LOG-403',ts:'2026-10-20T09:15:00Z',service:'Notifications',level:'warning',message:'Livraison différée · nouvelle tentative prévue · destinataire masqué'},
 {id:'LOG-402',ts:'2026-10-20T02:06:00Z',service:'Sauvegardes',level:'error',message:'Sauvegarde échouée · destination indisponible'},
 {id:'LOG-401',ts:'2026-10-19T02:05:00Z',service:'Sauvegardes',level:'info',message:'Sauvegarde terminée · contrôle effectué'}
];
let journalTab='audit';
const journalFilters={audit:{from:'2026-10-19',to:'2026-10-20',actor:'',q:'',format:'csv'},tech:{from:'2026-10-19',to:'2026-10-20',service:'',level:'',q:'',format:'jsonl'}};
let logConfig={level:'info',minutes:60,reason:'',expires:null},logDraft=structuredClone(logConfig);
const levelNames={debug:'Debug',info:'Info',warning:'Warning',error:'Erreur'};
function effectiveLogLevel(now=Date.now()){return logConfig.level==='debug'&&now>=logConfig.expires?'info':logConfig.level;}
function journalError(f){if(!f.from||!f.to||!/^\d{4}-\d{2}-\d{2}$/.test(f.from)||!/^\d{4}-\d{2}-\d{2}$/.test(f.to)||!Number.isFinite(Date.parse(f.from))||!Number.isFinite(Date.parse(f.to)))return 'Renseignez les deux dates.';if(f.from>f.to)return 'La date de début doit précéder la date de fin.';return '';}
function filteredJournal(kind=journalTab){const f=journalFilters[kind];if(journalError(f))return [];return (kind==='audit'?auditFixtures:technicalFixtures).filter(r=>r.ts.slice(0,10)>=f.from&&r.ts.slice(0,10)<=f.to&&(!f.actor||r.actor===f.actor)&&(!f.service||r.service===f.service)&&(!f.level||r.level===f.level)&&Object.values(r).join(' ').toLocaleLowerCase('fr').includes(f.q.toLocaleLowerCase('fr')));}
function logBadge(level){return `<span class="log-level ${level}">${levelNames[level]}</span>`;}
function openJournals(){
 const config=journalTab==='config',audit=journalTab==='audit';
 const tabs=`<nav class="segmented" aria-label="Journaux"><button data-journal-tab="audit" aria-pressed="${audit}">Traçabilité</button><button data-journal-tab="tech" aria-pressed="${journalTab==='tech'}">Journaux techniques</button><button data-journal-tab="config" aria-pressed="${config}">Niveau de log</button></nav>`;
 let body,foot;
 if(config){
 body=`<div class="routing-banner">${icon('logs','teal')}<div><b>Niveau technique actuel : ${levelNames[effectiveLogLevel()]}</b><small>La traçabilité métier reste active, quel que soit ce réglage.</small></div></div><div class="log-options">${[['warning','Warning','Avertissements et erreurs'],['info','Info','Informations, avertissements et erreurs'],['debug','Debug','Détails de diagnostic + tous les niveaux']].map(([v,n,d])=>`<button data-log-level="${v}" aria-pressed="${logDraft.level===v}">${logBadge(v)}<b>${n}</b><small>${d}</small></button>`).join('')}</div><div class="notice">Le niveau règle les prochains événements techniques collectés. Il ne retire aucun événement déjà enregistré. Les erreurs restent collectées dans les trois modes.</div>${logDraft.level==='debug'?`<div class="debug-window"><b>Diagnostic temporaire</b><div class="fields"><label>Retour automatique à Info<select id="debug-minutes">${[15,30,60,120].map(n=>`<option value="${n}" ${n===logDraft.minutes?'selected':''}>Après ${n} minutes</option>`).join('')}</select></label><label>Motif du diagnostic<input id="debug-reason" value="${esc(logDraft.reason)}" placeholder="Ex. analyser un échec de sauvegarde" maxlength="200" required></label></div><small>Éviter les données personnelles dans le motif. La durée limitée est une proposition à valider.</small></div>`:''}<div class="log-principles"><span>✓ Secrets exclus</span><span>✓ Changement tracé</span><span>✓ Traçabilité indépendante</span></div>`;
 foot='<button class="btn primary" id="save-log-level">Appliquer le niveau · démo</button>';
 }else{
 const f=journalFilters[journalTab];
 body=`<div class="routing-banner">${icon(audit?'rights':'logs',audit?'purple':'blue')}<div><b>${audit?'Qui a fait quoi, quand et sur quel élément ?':'Comprendre un incident et préparer un diagnostic'}</b><small>${audit?'Consultation et export · aucun bouton de modification ou suppression.':'Niveau de collecte : '+levelNames[effectiveLogLevel()]+' · filtrer ci-dessous ne change pas la collecte.'}</small></div></div><div class="log-filters"><label>Du · UTC<input type="date" data-jfilter="from" value="${f.from}"></label><label>Au · UTC inclus<input type="date" data-jfilter="to" value="${f.to}"></label>${audit?`<label>Utilisateur<select data-jfilter="actor"><option value="">Tous les utilisateurs</option>${[...new Set(auditFixtures.map(r=>r.actor))].map(v=>`<option ${f.actor===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`:`<label>Service<select data-jfilter="service"><option value="">Tous les services</option>${[...new Set(technicalFixtures.map(r=>r.service))].map(v=>`<option ${f.service===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Niveau affiché<select data-jfilter="level"><option value="">Tous les niveaux</option>${Object.entries(levelNames).map(([v,n])=>`<option value="${v}" ${f.level===v?'selected':''}>${n}</option>`).join('')}</select></label>`}<label class="log-search">Rechercher<input type="search" data-jfilter="q" value="${esc(f.q)}" placeholder="${audit?'Action, élément, personne…':'Message, identifiant…'}"></label></div><div id="journal-results"></div><div class="log-export"><label>Format du téléchargement<select id="journal-format">${(audit?['csv','json']:['jsonl','log']).map(v=>`<option value="${v}" ${v===f.format?'selected':''}>${v.toUpperCase()}</option>`).join('')}</select></label><p>L’export reprend tous les résultats filtrés de cette démonstration, pas seulement les lignes visibles.</p></div><small class="log-help">${audit?'Le téléchargement sera lui-même tracé. Les validations historiques restent inchangées.':'Exemples déjà expurgés : mots de passe, jetons et URL de Workflow ne figurent pas dans ces journaux.'}</small>`;
 foot='<button class="btn primary" id="export-journal">↓ Télécharger l’exemple filtré</button>';
 }
 panel('Journaux & traçabilité',tabs+body+'<div id="journal-feedback" role="status" aria-live="polite"></div>',foot,true);$('#dialog').classList.remove('retention-dialog');if(!config)renderJournalRows();
}
function renderJournalRows(){
 const audit=journalTab==='audit',f=journalFilters[journalTab],err=journalError(f),items=filteredJournal();
 $('#journal-results').innerHTML=err?`<div class="form-error" role="alert">${err}</div>`:`<div class="log-result-head"><b>${items.length} événement${items.length>1?'s':''}</b><span>Données fictives · dates en UTC</span></div><div class="log-table-scroll"><table class="log-table"><thead><tr>${(audit?['Date / heure UTC','Utilisateur','Action / élément','Résultat']:['Date / heure UTC','Niveau','Service','Message']).map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${items.length?items.map(r=>`<tr><td><b>${r.ts.slice(0,10)}</b><small>${r.ts.slice(11,19)} · ${r.id}</small></td>${audit?`<td>${esc(r.actor)}</td><td><b>${esc(r.action)}</b><small>${esc(r.target)}</small></td><td><span class="badge">${esc(r.result)}</span></td>`:`<td>${logBadge(r.level)}</td><td>${esc(r.service)}</td><td>${esc(r.message)}</td>`}</tr>`).join(''):'<tr><td colspan="4">Aucun événement pour ces filtres.</td></tr>'}</tbody></table></div>`;
 $('#export-journal').disabled=!!err||!items.length;
}
function safeCsv(value){let s=String(value);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function serializeJournal(items,format){if(format==='json')return JSON.stringify({demonstration:true,timezone:'UTC',events:items},null,2);if(format==='jsonl')return items.map(r=>JSON.stringify({...r,demonstration:true})).join('\n')+'\n';if(format==='log')return '# DEMONSTRATION · données fictives · UTC\n'+items.map(r=>`${r.ts} ${r.level.toUpperCase()} [${r.service}] ${r.id} ${r.message.replace(/[\r\n]/g,' ')}`).join('\n')+'\n';const cols=['id','ts','actor','action','target','result'];return '\uFEFF'+[cols.map(safeCsv).join(';'),...items.map(r=>cols.map(c=>safeCsv(r[c])).join(';'))].join('\r\n');}
function appendDemoAudit(action,target,result){auditFixtures.unshift({id:'TR-DEMO-'+(auditFixtures.length+1),ts:new Date().toISOString(),actor:'Administration démo',action,target,result});}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.jfilter){journalFilters[journalTab][t.dataset.jfilter]=t.value;renderJournalRows();$('#journal-feedback').textContent='';}if(t.id==='debug-reason'){logDraft.reason=t.value;$('#journal-feedback').textContent='';}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.jfilter){journalFilters[journalTab][t.dataset.jfilter]=t.value;renderJournalRows();}if(t.id==='journal-format')journalFilters[journalTab].format=t.value;if(t.id==='debug-minutes')logDraft.minutes=Number(t.value);});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.journalTab){journalTab=b.dataset.journalTab;if(journalTab==='config')logDraft={...logConfig,level:effectiveLogLevel()};openJournals();}
 if(b.dataset.logLevel){logDraft.level=b.dataset.logLevel;openJournals();}
 if(b.id==='save-log-level'){
 if(logDraft.level==='debug'&&(!logDraft.reason.trim()||![15,30,60,120].includes(logDraft.minutes))){$('#journal-feedback').textContent='Indiquez le motif et une durée de diagnostic valide.';return;}
 logConfig={...logDraft,expires:logDraft.level==='debug'?Date.now()+logDraft.minutes*60000:null};appendDemoAudit('Niveau technique modifié',levelNames[logConfig.level],logConfig.level==='debug'?`Retour à Info après ${logConfig.minutes} min`:'Appliqué en démo');openJournals();$('#journal-feedback').textContent='Réglage simulé et changement ajouté à la trace locale.';
 }
 if(b.id==='export-journal'){
 const items=filteredJournal(),f=journalFilters[journalTab];if(journalError(f)||!items.length)return;
 const text=serializeJournal(items,f.format),blob=new Blob([text],{type:f.format==='csv'?'text/csv;charset=utf-8':f.format==='json'?'application/json':'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`DEMO-${journalTab==='audit'?'tracabilite':'technique'}-${f.from}-${f.to}.${f.format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 appendDemoAudit('Téléchargement de journal',journalTab==='audit'?'Traçabilité':'Journaux techniques',`${items.length} événements · ${f.format.toUpperCase()}`);renderJournalRows();$('#journal-feedback').textContent=`Exemple téléchargé : ${items.length} événements fictifs. Téléchargement ajouté à la trace locale.`;
 }
});
Object.assign(catalogue.system.find(c=>c.id==='logs'),{name:'Journaux & traçabilité',desc:'Télécharger les traces et journaux techniques, régler le niveau de log.',foot:'Traçabilité · Technique · Info / Warning / Debug',badge:'Consultation & export',attention:false});render();
