// Shared fixture catalogue for the two prototypes, not a backend or a risk engine.
(()=>{
 const key='astra-demo-shared-scales-v1';
 const colors=['#4eaf78','#e7c34b','#e18b3d','#c8445e'];
 const seed=()=>[['impact','Impact',['Limité','Significatif','Majeur','Critique']],['severity','Sévérité',['Faible','Modérée','Élevée','Critique']],['probability','Probabilité',['Rare','Possible','Probable','Très probable']]].map(([id,name,labels])=>({id,archived:false,versions:[{version:1,name,nature:'quantitative',levels:labels.map((label,i)=>({id:id+'-n'+(i+1),label,value:i+1,color:colors[i],description:'Critère défini par l’organisation'}))}]}));
 let memory=seed(),storageAvailable=true;
 function read(){try{const raw=localStorage.getItem(key);if(raw){const v=JSON.parse(raw);if(!Array.isArray(v)||v.some(s=>!s.id||!Array.isArray(s.versions)))throw Error('Catalogue invalide');memory=v;}}catch{storageAvailable=false;}return structuredClone(memory);}
 function write(data){localStorage.setItem(key,JSON.stringify(data));memory=structuredClone(data);storageAvailable=true;window.dispatchEvent(new Event('astra-catalogue-change'));}
 function list(){return read().filter(s=>!s.archived).flatMap(s=>s.versions.map(v=>({...v,id:s.id,ref:s.id+'@'+v.version})));}
 function get(ref){const [id,n]=String(ref).split('@');const item=read().find(s=>s.id===id);const v=item?.versions.find(v=>v.version===Number(n));return v?{...v,id,ref,archived:item.archived}:null;}
 function publish(draft){const all=read();let item=all.find(s=>s.id===draft.id);if(!item){item={id:draft.id,archived:false,versions:[]};all.push(item);}if(item.archived)throw Error('Échelle archivée');const version=Math.max(0,...item.versions.map(v=>v.version))+1;item.versions.push({version,name:draft.name,nature:draft.nature,levels:structuredClone(draft.levels)});write(all);return version;}
 function archive(id){const all=read(),item=all.find(s=>s.id===id);if(item){item.archived=true;write(all);}}
 window.AstraScales={list,get,publish,archive,read,available:()=>storageAvailable};
})();
