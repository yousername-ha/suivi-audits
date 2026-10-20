'use strict';
// Modèle de démonstration, sans équivalence présumée avec le contrat natif.
const Recurrences = (() => {
  const KEY = 'astra-018-timeline-v3';
  const actor = Object.freeze({id: 'DEMO-CM', name: 'Camille Martin', role: 'RSSI'});
  const scopes = Object.freeze({GHT: 'GHT — Direction', 'ETAB-B': 'Établissement B', 'ETAB-C': 'Établissement C'});
  const clone = v => JSON.parse(JSON.stringify(v));
  const seed = () => {
    const registers = [{id:'REG-SEC',name:'Sécurité opérationnelle',tone:'security'}, {id:'REG-HDS',name:'Hébergement & continuité',tone:'continuity'}, {id:'REG-QUA',name:'Qualité & fournisseurs',tone:'quality'}];
    const series = [
      {id:'REC-001', registerId:'REG-SEC', name:'Vérifier les sauvegardes', category:'Sécurité', scope:'ETAB-B', owner:'Équipe exploitation', cadence:'Hebdomadaire', icon:'shield', days:[2,9,16,23,30]},
      {id:'REC-002', registerId:'REG-SEC', name:'Revoir les accès privilégiés', category:'Sécurité', scope:'GHT', owner:'Camille Martin', cadence:'Mensuelle', icon:'key', days:[20]},
      {id:'REC-003', registerId:'REG-HDS', name:'Contrôler les accès aux locaux', category:'Hébergement', scope:'ETAB-B', owner:'Référent hébergement', cadence:'Hebdomadaire', icon:'building', days:[1,8,15,22,29]},
      {id:'REC-004', registerId:'REG-QUA', name:'Suivre les indicateurs qualité', category:'Qualité', scope:'ETAB-C', owner:'Pilote qualité', cadence:'Hebdomadaire', icon:'chart', days:[6,13,20,27]},
      {id:'REC-005', registerId:'REG-HDS', name:'Tester une restauration', category:'Continuité', scope:'ETAB-B', owner:'Équipe exploitation', cadence:'Mensuelle', icon:'restore', days:[16]},
      {id:'REC-006', registerId:'REG-QUA', name:'Revoir les évaluations fournisseurs', category:'Fournisseurs', scope:'GHT', owner:'Responsable achats', cadence:'Mensuelle', icon:'users', days:[28]}
    ];
    // Échéances fixes du jeu fictif, pas un moteur de génération concurrent.
    const occurrences = series.flatMap(s=>s.days.map(d=>({id:s.id+'-10-'+d, seriesId:s.id, due:'2026-10-'+String(d).padStart(2,'0')})));
    const proofs = [{id:'PRV-001', title:'Compte rendu sauvegardes — semaine 40', scope:'ETAB-B', version:1, fileName:'compte-rendu-fictif.txt', mime:'text/plain', content:'data:text/plain;base64,Q29tcHRlIHJlbmR1IGZpY3RpZiBkZSBkZW1vbnN0cmF0aW9uLg==', sha256:null, createdBy:'Léa Bernard', createdAt:'2026-10-02T10:20:00Z'},
      {id:'PRV-002', title:'Revue qualité — octobre', scope:'ETAB-C', version:1, fileName:'revue-qualite-fictive.txt', mime:'text/plain', content:'data:text/plain;base64,UmV2dWUgcXVhbGl0ZSBmaWN0aXZlLg==', sha256:null, createdBy:'Alex Moreau', createdAt:'2026-10-06T09:30:00Z'}];
    const examples = [
      ['REC-001-10-2','OK','Contrôle effectué sur le jeu fictif.',['PRV-001']],
      ['REC-001-10-9','KO','Un traitement est à examiner dans cette démonstration.',[]],
      ['REC-003-10-1','OK','Accès examinés.',[]],['REC-003-10-8','NA','Local fermé pendant la période fictive.',[]],
      ['REC-004-10-6','OK','Indicateurs examinés.',['PRV-002']],['REC-004-10-13','OK','Revue effectuée.',[]]
    ];
    const validations = examples.map(([id,result,comment,proofIds],i)=>({id:'VAL-DEMO-'+(i+1),occurrenceId:id,result,comment,proofIds,actor:{id:'DEMO-LB',name:'Léa Bernard',role:'Pilote de contrôle'},recordedAt:occurrences.find(o=>o.id===id).due+'T10:20:00Z'}));
    return {schema:'astra-recurrences-3', revision:0, registers, series, occurrences, proofs, validations};
  };
  function validate(d) {
    if(!d || d.schema!=='astra-recurrences-3' || !Number.isInteger(d.revision)) throw Error('Sauvegarde incompatible.');
    for(const key of ['registers','series','occurrences','proofs','validations']) {
      if(!Array.isArray(d[key]))throw Error('Collection absente.');
      if(new Set(d[key].map(x=>x.id)).size!==d[key].length)throw Error('Identifiants dupliqués.');
    }
    for(const s of d.series)if(!d.registers.some(r=>r.id===s.registerId))throw Error('Registre absent pour cette tâche.');
    const used = new Set();
    for(const o of d.occurrences)if(!d.series.some(s=>s.id===o.seriesId))throw Error('Série absente.');
    for(const v of d.validations) {
      const o=d.occurrences.find(o=>o.id===v.occurrenceId), s=d.series.find(s=>s.id===o?.seriesId);
      if(!s||used.has(o.id)||!['OK','KO','NA'].includes(v.result)||!v.actor?.id||!v.actor?.name||!v.recordedAt)throw Error('Validation invalide ou dupliquée.');
      used.add(o.id);
      if(!Array.isArray(v.proofIds)||v.proofIds.some(id=>!d.proofs.some(p=>p.id===id&&p.scope===s.scope)))throw Error('Preuve absente ou hors périmètre.');
    }
    return d;
  }
  let db, loadError='';
  try { const raw=localStorage.getItem(KEY);db=raw?validate(JSON.parse(raw)):seed(); }
  catch(e) { db=seed();loadError='La sauvegarde est indisponible ou invalide. Elle est conservée ; aucune validation ne sera enregistrée.'; }
  const uid=prefix=>prefix+'-'+crypto.randomUUID();
  function commit(input) {
    if(loadError)throw Error(loadError);
    const current=localStorage.getItem(KEY);
    if((current?validate(JSON.parse(current)).revision:0)!==db.revision)throw Error('Les données ont changé dans un autre onglet. Rechargez avant de valider.');
    const o=db.occurrences.find(o=>o.id===input.occurrenceId),s=db.series.find(s=>s.id===o?.seriesId);
    if(!s)throw Error('Occurrence inconnue.');
    if(db.validations.some(v=>v.occurrenceId===o.id))throw Error('Cette occurrence est déjà validée. Sa validation est conservée.');
    if(!['OK','KO','NA'].includes(input.result))throw Error('Choisissez OK, KO ou NA.');
    const next=clone(db), now=new Date().toISOString(), proofIds=[];
    for(const id of input.proofIds||[]) {
      if(!next.proofs.some(p=>p.id===id&&p.scope===s.scope))throw Error('Cette preuve ne relève pas du périmètre de la tâche.');
      if(!proofIds.includes(id))proofIds.push(id);
    }
    if(input.file) {
      const f=input.file;
      if(!/^[a-f0-9]{64}$/.test(f.sha256)||!/^data:(application\/pdf|image\/png|image\/jpeg|text\/plain);base64,[A-Za-z0-9+/=]+$/.test(f.content))throw Error('Fichier non pris en charge.');
      let p=next.proofs.find(p=>p.sha256===f.sha256&&p.scope===s.scope);
      if(!p) {p={id:uid('PRV'),title:f.title,fileName:f.fileName,mime:f.mime,content:f.content,sha256:f.sha256,scope:s.scope,version:1,createdBy:actor.name,createdAt:now};next.proofs.push(p);}
      if(!proofIds.includes(p.id))proofIds.push(p.id);
    }
    // L'acteur et la date ne sont jamais pris dans les champs de saisie.
    const record={id:uid('VAL'),occurrenceId:o.id,result:input.result,comment:String(input.comment||'').trim(),proofIds,actor:clone(actor),recordedAt:now};
    next.validations.push(record);next.revision++;
    validate(next);
    try {localStorage.setItem(KEY,JSON.stringify(next));}
    catch(e) {throw Error('Enregistrement impossible (stockage plein ou indisponible). La validation et la nouvelle preuve n’ont pas été enregistrées.');}
    db=next;
    return clone(record);
  }
  return Object.freeze({actor,scopes,key:KEY,get:()=>clone(db),get loadError(){return loadError;},commit,validate});
})();
