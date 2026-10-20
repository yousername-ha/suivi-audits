// UI-only fixtures. No API, cryptographic operation or persistent storage.
let nextId=100,activeScale='impact',pendingScaleAction=null;
const palette=['#4eaf78','#e7c34b','#e18b3d','#c8445e'];
const makeLevel=(label,i)=>({id:'level-'+(++nextId),label,value:i+1,color:palette[i%4],description:'Critère défini par l’organisation'});
const scales=AstraScales.read().filter(s=>!s.archived).map(s=>{const v=s.versions.at(-1);return {...structuredClone(v),id:s.id,published:true,usages:0,archived:false};});
nextId=Date.now();
const publishedSnapshots=structuredClone(scales);
const currentScale=()=>scales.find(s=>s.id===activeScale);
function panel(title,body,foot,wide=false){
 const d=$('#dialog');d.classList.toggle('wide',wide);
 d.innerHTML=`<div class="dialog-head"><div><small>PARAMÈTRES · MAQUETTE À VALIDER</small><h2 id="dialog-title">${title}</h2></div><button class="close" data-close aria-label="Fermer">×</button></div><div class="dialog-body">${body}</div><div class="dialog-foot"><small>Simulation locale · aucune configuration réelle modifiée</small>${foot}</div>`;
 if(!d.open)d.showModal();
}
function refreshScaleCard(){catalogue.platform.find(c=>c.id==='scales').badge=scales.filter(s=>!s.archived).length+' échelles';render();}
function scaleError(message){$('#scale-error').textContent=message;}
function openScales(){
 const list=scales.filter(s=>!s.archived);if(!list.some(s=>s.id===activeScale))activeScale=list[0]?.id;
 const s=currentScale();
 const toolbar=`<div class="editor-toolbar"><label class="grow">Échelle<select id="scale-picker"><option value="" ${s?'hidden':''}>Choisir une échelle</option>${list.map(x=>`<option value="${x.id}" ${x.id===activeScale?'selected':''}>${esc(x.name||'Sans nom')}${x.published?'':' · brouillon'}</option>`).join('')}</select></label><button class="btn primary" id="new-scale">+ Nouvelle échelle</button>${s?'<button class="btn" id="duplicate-scale">Dupliquer</button>':''}</div>`;
 if(!s){panel('Échelles personnalisées',toolbar+'<div class="empty">Aucune échelle active. Créez votre première échelle.</div>','<button class="btn" data-close>Fermer</button>');return;}
 const confirmation=pendingScaleAction?`<div class="confirm-inline"><b>${s.published?'Archiver cette échelle ?':'Supprimer ce brouillon ?'}</b><p>${s.published?`${s.usages} usages de la version publiée sont conservés. L’échelle ne sera plus proposée pour de nouveaux usages.`:'Ce brouillon n’a jamais été publié. Il sera retiré de la démonstration.'}</p><button class="btn danger" id="confirm-scale-remove">${s.published?'Confirmer l’archivage':'Confirmer la suppression'}</button> <button class="btn" id="cancel-scale-remove">Annuler</button></div>`:'';
 panel('Échelles personnalisées',`${toolbar}<div class="editor-meta"><span class="badge">${s.published?'Publiée v'+s.version+' · brouillon suivant':'Nouvelle échelle · brouillon'}</span><span>${s.published?s.usages+' usages existants · conservés':'Aucun usage'}</span><button class="text-danger" id="remove-scale">${s.published?'Archiver l’échelle':'Supprimer l’échelle'}</button></div>${confirmation}<div class="fields scale-fields"><label>Nom de l’échelle<input id="scale-name" value="${esc(s.name)}" maxlength="200" required></label><label>Type de valeurs<select id="scale-nature"><option value="quantitative" ${s.nature==='quantitative'?'selected':''}>Quantitative · scores obligatoires</option><option value="qualitative" ${s.nature==='qualitative'?'selected':''}>Qualitative · scores facultatifs</option><option value="hybrid" ${s.nature==='hybrid'?'selected':''}>Hybride · scores facultatifs</option></select></label></div><div class="levels-title"><h3>Niveaux <span class="badge">${s.levels.length}</span></h3><button class="btn" id="add-level" ${s.levels.length>=20?'disabled':''}>+ Ajouter un niveau</button></div><div class="level-head"><span>Couleur</span><span>Score</span><span>Libellé</span><span>Description / critère</span><span>Ordre / retrait</span></div><div id="custom-levels">${s.levels.map((l,i)=>`<div class="custom-level" data-level="${l.id}"><input type="color" data-field="color" value="${l.color}" aria-label="Couleur du niveau ${i+1}"><input type="number" step="any" min="-1000000000" max="1000000000" data-field="value" value="${l.value??''}" aria-label="Score du niveau ${i+1}" ${s.nature==='quantitative'?'required':''}><input data-field="label" value="${esc(l.label)}" maxlength="200" required aria-label="Libellé du niveau ${i+1}"><input data-field="description" value="${esc(l.description)}" maxlength="5000" aria-label="Critère du niveau ${i+1}"><div class="row-tools"><button data-move="-1" data-level-id="${l.id}" aria-label="Monter le niveau ${i+1}" ${i===0?'disabled':''}>↑</button><button data-move="1" data-level-id="${l.id}" aria-label="Descendre le niveau ${i+1}" ${i===s.levels.length-1?'disabled':''}>↓</button><button data-delete-level="${l.id}" aria-label="Supprimer le niveau ${i+1}" ${s.levels.length<=2?'disabled':''}>×</button></div></div>`).join('')}</div><p class="editor-help">2 à 20 niveaux · Ordre et couleurs personnalisables · Les scores renseignés doivent rester croissants.</p><div id="scale-error" class="form-error" role="alert"></div><div class="notice">Vous modifiez un brouillon. Retirer un niveau ne supprime pas les évaluations passées. Avant publication, les matrices et correspondances concernées devront être vérifiées.</div>`, '<button class="btn primary" id="save-custom-scale">Enregistrer le brouillon · démo</button>',true);
}
function saveScale(){
 const s=currentScale();if(!s)return;
 if(!s.name.trim()){scaleError('Renseignez le nom de l’échelle.');return;}
 if(scales.some(x=>x.id!==s.id&&!x.archived&&x.name.trim().toLocaleLowerCase()===s.name.trim().toLocaleLowerCase())){scaleError('Une échelle active porte déjà ce nom dans la démonstration.');return;}
 if(s.levels.some(l=>!l.label.trim())){scaleError('Chaque niveau doit avoir un libellé.');return;}
 if(s.nature==='quantitative'&&s.levels.some(l=>l.value===null)){scaleError('Chaque niveau quantitatif doit avoir un score.');return;}
 const values=s.levels.map(l=>l.value).filter(v=>v!==null);
 if(values.some((v,i)=>!Number.isFinite(v)||Math.abs(v)>1e9||(i&&v<=values[i-1]))){scaleError('Les scores renseignés doivent être strictement croissants dans l’ordre des niveaux (entre −1 milliard et +1 milliard).');return;}
 s.name=s.name.trim();refreshScaleCard();$('#dialog').close();toast('Brouillon enregistré dans la démonstration. Les versions publiées restent inchangées.');
}
let certMode='import';
const certForm={domains:'grc.example.org',days:'365',algorithm:'ECDSA P-256',provider:'le',directory:'https://acme.example.org/directory',challenge:'http',environment:'staging',email:'',dns:'demo-dns',renew:true,terms:false,certificate:'',key:''};
function domainList(){return certForm.domains.split(/[\s,;]+/).filter(Boolean);}
function validDomain(n){return /^(\*\.)?(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(n);}
function openCertificate(){
 const choice=[['import','backup','Importer mon certificat','Certificat et clé privée'],['self','cert','Certificat autosigné','Génération pour usage interne'],['acme','update','Let’s Encrypt / ACME','Émission et renouvellement']];
 const selector=`<div class="cert-options">${choice.map(([id,ico,name,sub])=>`<button data-cert-mode="${id}" aria-pressed="${certMode===id}">${icon(ico,id==='acme'?'blue':id==='self'?'amber':'teal')}<b>${name}</b><small>${sub}</small></button>`).join('')}</div>`;
 const domainField=`<label class="domain-field">Nom(s) de domaine · SAN<input id="cert-domains" data-cert-field="domains" value="${esc(certForm.domains)}" placeholder="grc.mondomaine.fr, audit.mondomaine.fr" required><small>Séparez les noms par une virgule. Exemples affichés, sans demande réelle.</small></label>`;
 let body='';
 if(certMode==='import')body=`<div class="fields"><label>Certificat et chaîne · PEM<input type="file" id="cert-file" accept=".pem,.crt,.cer"><small id="cert-filename">${esc(certForm.certificate||'Aucun fichier sélectionné')}</small></label><label>Clé privée · PEM<input type="file" id="key-file" accept=".pem,.key"><small id="key-filename">${esc(certForm.key||'Aucun fichier sélectionné')}</small></label></div><button class="btn" id="cert-example">Utiliser des fichiers fictifs</button><div class="notice">Dans cette maquette, seuls les noms des fichiers sont utilisés. Aucun contenu n’est lu ni transmis. Le produit vérifiera la chaîne, les dates, les domaines et la correspondance avec la clé.</div>`;
 if(certMode==='self')body=`<div class="fields"><label>Durée souhaitée (jours)<input type="number" id="self-days" data-cert-field="days" min="1" step="1" value="${esc(certForm.days)}" required></label><label>Type de clé<select data-cert-field="algorithm"><option ${certForm.algorithm==='ECDSA P-256'?'selected':''}>ECDSA P-256</option><option ${certForm.algorithm==='RSA 3072'?'selected':''}>RSA 3072</option></select></label></div><div class="notice amber">Un certificat autosigné n’est pas approuvé automatiquement par les navigateurs. Sa confiance doit être gérée sur les postes concernés.</div><p>La clé sera générée par le service d’exploitation. Les options et la durée seront validées selon la politique du serveur.</p>`;
 if(certMode==='acme')body=`<div class="fields"><label>Service ACME<select data-cert-field="provider"><option value="le" ${certForm.provider==='le'?'selected':''}>Let’s Encrypt</option><option value="custom" ${certForm.provider==='custom'?'selected':''}>Autre service ACME</option></select></label><label>${certForm.provider==='le'?'Environnement':'URL de l’annuaire ACME'}${certForm.provider==='le'?`<select data-cert-field="environment"><option value="staging" ${certForm.environment==='staging'?'selected':''}>Test · staging</option><option value="production" ${certForm.environment==='production'?'selected':''}>Production</option></select>`:`<input type="url" data-cert-field="directory" value="${esc(certForm.directory)}" required>`}</label><label>Validation du domaine<select data-cert-field="challenge"><option value="http" ${certForm.challenge==='http'?'selected':''}>HTTP-01 · accès web</option><option value="dns" ${certForm.challenge==='dns'?'selected':''}>DNS-01 · enregistrement DNS</option></select></label><label>Contact (facultatif)<input type="email" data-cert-field="email" value="${esc(certForm.email)}" placeholder="Contact du compte ACME"></label></div>${certForm.challenge==='dns'?`<label>Connexion DNS<select data-cert-field="dns"><option value="demo-dns">Connexion DNS · Démonstration</option><option value="">Aucune connexion configurée</option></select></label><p>Les identifiants DNS seront conservés dans le coffre serveur. L’automatisation dépend d’un fournisseur DNS compatible.</p>`:'<div class="notice">HTTP-01 : le domaine doit répondre au challenge public sur le port 80. Pour un nom générique (*.domaine.fr), choisissez DNS-01.</div>'}<div class="check-lines"><label><input type="checkbox" data-cert-field="renew" ${certForm.renew?'checked':''}> Renouvellement automatique et suivi des échecs</label><label><input type="checkbox" data-cert-field="terms" ${certForm.terms?'checked':''}> Prévoir l’acceptation des conditions du service avant émission</label></div><p>${certForm.provider==='le'&&certForm.environment==='staging'?'Le mode test ne délivre pas un certificat reconnu par les navigateurs.':certForm.provider==='custom'?'Compatibilité, conditions et possibilités du service à vérifier avant activation.':'La demande réelle nécessitera une confirmation après contrôle des domaines.'}</p>`;
 panel('Certificat HTTPS',`<div class="cert-current"><span class="dot"></span><span><b>Certificat actuel · démonstration</b><small>grc.exemple.test · échéance 08/01/2027 · aucune modification appliquée</small></span></div>${selector}${domainField}${body}<div id="cert-error" class="form-error" role="alert"></div><div id="cert-preview" aria-live="polite"></div>`, '<button class="btn primary" id="check-certificate">Vérifier la configuration · démo</button>',true);
 if(certMode==='acme'&&certForm.challenge==='dns')$('[data-cert-field=dns]').value=certForm.dns;
}
function checkCertificate(){
 $('#cert-error').textContent='';$('#cert-preview').innerHTML='';
 const domains=domainList();
 const fail=t=>{$('#cert-error').textContent=t;};
 if(!domains.length||domains.some(n=>!validDomain(n)))return fail('Saisissez des noms de domaine valides. Cette maquette illustre uniquement les noms DNS.');
 if(certMode==='import'&&(!certForm.certificate||!certForm.key))return fail('Sélectionnez le certificat et sa clé, ou utilisez les fichiers fictifs.');
 if(certMode==='self'&&(!Number.isInteger(Number(certForm.days))||Number(certForm.days)<1))return fail('La durée doit être un nombre entier de jours supérieur à zéro.');
 if(certMode==='acme'){
  if(certForm.challenge==='http'&&domains.some(n=>n.startsWith('*.')))return fail('Un domaine générique nécessite DNS-01. HTTP-01 ne prend pas en charge les jokers.');
  if(certForm.challenge==='dns'&&!certForm.dns)return fail('Choisissez une connexion DNS pour préparer le renouvellement automatique.');
  if(certForm.provider==='custom'){try{const u=new URL(certForm.directory);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{return fail('Renseignez une URL HTTPS d’annuaire ACME sans identifiants intégrés.');}}
  const email=$('[data-cert-field=email]');if(email&&!email.reportValidity())return;
  if(!certForm.terms)return fail('Les conditions du service doivent être prises en compte avant de préparer l’émission.');
 }
 $('#cert-preview').innerHTML=`<div class="notice"><b>Configuration de démonstration cohérente</b><br>${esc(domains.join(', '))}<br>${certMode==='import'?'Import de certificat':certMode==='self'?'Génération autosignée':`ACME · ${certForm.provider==='le'?"Let’s Encrypt · "+(certForm.environment==='staging'?'test':'production'):'service personnalisé'} · ${certForm.challenge==='http'?'HTTP-01':'DNS-01'}`}<br>Aucun domaine contrôlé, aucun certificat vérifié, émis ou installé.</div>`;
}
document.addEventListener('input',e=>{
 const t=e.target,s=currentScale();
 if(t.id==='scale-name'&&s)s.name=t.value;
 if(t.dataset.field&&s){const l=s.levels.find(x=>x.id===t.closest('[data-level]').dataset.level);l[t.dataset.field]=t.dataset.field==='value'?(t.value===''?null:Number(t.value)):t.value;}
 if(t.dataset.certField){certForm[t.dataset.certField]=t.type==='checkbox'?t.checked:t.value;if($('#cert-preview'))$('#cert-preview').innerHTML='';if($('#cert-error'))$('#cert-error').textContent='';}
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='scale-picker'){activeScale=t.value;pendingScaleAction=null;openScales();}
 if(t.id==='scale-nature'){currentScale().nature=t.value;openScales();}
 if(t.dataset.certField){certForm[t.dataset.certField]=t.type==='checkbox'?t.checked:t.value;if(['provider','environment','challenge'].includes(t.dataset.certField))openCertificate();}
 if(t.id==='cert-file'||t.id==='key-file'){const field=t.id==='cert-file'?'certificate':'key';certForm[field]=t.files[0]?.name||'';$('#'+(field==='certificate'?'cert':'key')+'-filename').textContent=certForm[field]||'Aucun fichier sélectionné';$('#cert-preview').innerHTML='';}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const s=currentScale();
 if(b.id==='new-scale'){const id='scale-'+(++nextId);scales.push({id,name:'Nouvelle échelle '+nextId,nature:'quantitative',published:false,usages:0,archived:false,levels:['Niveau 1','Niveau 2'].map(makeLevel)});activeScale=id;pendingScaleAction=null;refreshScaleCard();openScales();$('#scale-name').select();}
 if(b.id==='duplicate-scale'&&s){const copy=structuredClone(s);copy.id='scale-'+(++nextId);copy.name=s.name+' · copie '+nextId;copy.published=false;copy.usages=0;copy.levels.forEach(l=>l.id='level-'+(++nextId));scales.push(copy);activeScale=copy.id;refreshScaleCard();openScales();}
 if(b.id==='add-level'&&s&&s.levels.length<20){const l=makeLevel('Niveau '+(s.levels.length+1),s.levels.length);const last=s.levels.at(-1)?.value;l.value=last===null?null:(last??0)+1;s.levels.push(l);openScales();$('#custom-levels .custom-level:last-child input[data-field=label]').focus();}
 if(b.dataset.deleteLevel&&s&&s.levels.length>2){s.levels=s.levels.filter(l=>l.id!==b.dataset.deleteLevel);openScales();}
 if(b.dataset.move&&s){const i=s.levels.findIndex(l=>l.id===b.dataset.levelId),j=i+Number(b.dataset.move);if(j>=0&&j<s.levels.length){[s.levels[i],s.levels[j]]=[s.levels[j],s.levels[i]];openScales();}}
 if(b.id==='remove-scale'){pendingScaleAction=true;openScales();}
 if(b.id==='cancel-scale-remove'){pendingScaleAction=null;openScales();}
 if(b.id==='confirm-scale-remove'&&s){if(s.published)s.archived=true;else scales.splice(scales.indexOf(s),1);pendingScaleAction=null;activeScale=null;refreshScaleCard();openScales();}
 if(b.id==='save-custom-scale')saveScale();
 if(b.dataset.certMode){certMode=b.dataset.certMode;openCertificate();}
 if(b.id==='cert-example'){certForm.certificate='chaine-fictive.pem';certForm.key='cle-fictive.pem';$('#cert-filename').textContent=certForm.certificate;$('#key-filename').textContent=certForm.key;$('#cert-preview').innerHTML='';}
 if(b.id==='check-certificate')checkCertificate();
});
