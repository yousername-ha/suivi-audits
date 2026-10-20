// Graph fixtures illustrate references outside the currently displayed register.
retentionRows.push({id:'PJ-104',type:'proof',name:'Preuve liée indirectement à un audit',date:'2020-01-01',state:'retired',bytes:500,stage:'active',refs:0,hold:false});
retentionRows.push({id:'EC-043',type:'gap',name:'Écart clôturé avec justificatif rattaché',date:'2020-01-01',state:'closed',bytes:0,stage:'active',refs:0,hold:false});
retentionRows.find(r=>r.id==='PJ-101').blob='blob-partage';
const externalRetentionNodes={audit:{label:'Audit de surveillance actif',retained:true},version:{label:'Version de preuve historique',retained:true,blob:'blob-partage'}};
const retentionEdges=[{from:'audit',to:'EC-042'},{from:'EC-042',to:'PJ-104'},{from:'EC-043',to:'PJ-104'}];
function nodeRetained(id){const r=retentionRows.find(r=>r.id===id);return r?r.stage!=='purged':externalRetentionNodes[id]?.retained??true;}
function referencePaths(id,trail=[id],seen=new Set([id])){
 const paths=[];
 for(const edge of retentionEdges.filter(e=>e.to===id&&nodeRetained(e.from))){
  const path=[edge.from,...trail];paths.push(path);
  if(!seen.has(edge.from)){const next=new Set(seen);next.add(edge.from);paths.push(...referencePaths(edge.from,path,next));}
 }
 return paths;
}
function sharedBlobOwners(row){if(!row.blob)return [];return [...retentionRows.filter(r=>r.id!==row.id&&r.blob===row.blob&&r.stage!=='purged').map(r=>r.id),...Object.entries(externalRetentionNodes).filter(([id,n])=>id!==row.id&&n.blob===row.blob&&n.retained).map(([id])=>id)];}
function retainedChildren(row){return retentionEdges.filter(e=>e.from===row.id&&nodeRetained(e.to)).map(e=>e.to);}
const originalRetentionDecision=retentionDecision;
retentionDecision=function(row,policy){const d=originalRetentionDecision(row,policy);if(!d.eligible)return d;if(referencePaths(row.id).length)return {eligible:false,reason:'Dépendance directe ou indirecte conservée'};if(d.mode==='trash'&&retainedChildren(row).length)return {eligible:false,reason:'Éléments rattachés à examiner'};return d;};
const originalPurgeDecision=retentionPurgeEligible;
retentionPurgeEligible=function(row,policy){return originalPurgeDecision(row,policy)&&referencePaths(row.id).length===0&&retainedChildren(row).length===0&&sharedBlobOwners(row).length===0;};
function retentionReclaimableBytes(rows){const seen=new Set();return rows.reduce((sum,row)=>{const key=row.blob||row.id;if(sharedBlobOwners(row).length||seen.has(key))return sum;seen.add(key);return sum+row.bytes;},0);}
const baseOpenRetention=openRetention;
openRetention=function(){baseOpenRetention();if(retentionTab==='preview')$('.retention-caption').insertAdjacentHTML('afterend','<button class="btn" id="show-retention-links">Voir les dépendances et fichiers partagés →</button>');};
function retentionNodeLabel(id){return externalRetentionNodes[id]?.label||retentionRows.find(r=>r.id===id)?.name||id;}
function showRetentionLinks(){
 const paths=referencePaths('PJ-104').sort((a,b)=>b.length-a.length),longest=paths[0]||['PJ-104'];
 panel('Suppression & cohérence des données',`<div class="routing-banner">${icon('rights','purple')}<div><b>Un objet clôturé peut encore être référencé.</b><small>Les références sont résolues dans tous les registres et versions.</small></div></div><h3>Exemple : preuve liée à un audit</h3><div class="dependency-flow">${longest.map((id,i)=>`${i?'<span aria-hidden="true">→</span>':''}<div><b>${esc(retentionNodeLabel(id))}</b><small>${esc(id)}</small></div>`).join('')}</div><div class="notice">PJ-104 reste protégée tant que ces références existent. Aucun retrait en cascade de l’audit, de l’écart ou de la preuve.</div><h3>Exemple : fichier physique partagé</h3><div class="dependency-flow"><div><b>Justificatif PJ-101</b><small>Peut être placé en corbeille</small></div><span>→</span><div><b>Fichier partagé</b><small>1,2 Go fictifs · même objet de stockage</small></div><span>←</span><div><b>Version historique conservée</b><small>Autre référence au même fichier</small></div></div><div class="notice amber">La purge de PJ-101 est bloquée tant que le fichier reste partagé. Ce volume est exclu de l’espace récupérable affiché.</div><p>Les liens, protections et états sont revérifiés au moment de l’opération. Une modification après prévisualisation peut donc bloquer le nettoyage.</p>`, '<button class="btn primary" id="return-retention-preview">Revenir à la prévisualisation</button>',true);
 $('#dialog').classList.remove('retention-dialog');
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.id==='show-retention-links')showRetentionLinks();if(b?.id==='return-retention-preview'){retentionTab='preview';openRetention();}});
