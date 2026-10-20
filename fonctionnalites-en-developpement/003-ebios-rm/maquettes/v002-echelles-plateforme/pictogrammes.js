'use strict';
// Pictogrammes décoratifs de la maquette : aucune nouvelle catégorie ANSSI.
const pictogramPaths={
 hacker:'<path d="M4 12C4 5 8 2 12 2s8 3 8 10l-3 3H7z" fill="currentColor" opacity=".13"/><path d="M4 12C4 5 8 2 12 2s8 3 8 10M7 10h10l-1 5H8zM9 12h1m4 0h1M3 17h18l-2 5H5zM9 20h6"/>',
 spy:'<path d="m5 9 3-6h8l3 6M2 10h20M6 14h5l1 1 1-1h5v4h-5l-1-1-1 1H6zM5 22l3-3m11 3-3-3"/><path d="M8 3h8l3 7H5z" fill="currentColor" opacity=".15"/>',
 thief:'<path d="M5 7c0-6 14-6 14 0M5 8h14v6c0 8-14 8-14 0z"/><path d="M4 9h16v6H4z" fill="currentColor" opacity=".2"/><path d="M7 12h2m6 0h2m-7 6h4M2 22l4-3m16 3-4-3"/>',
 activist:'<path d="m3 9 13-5v14L3 13zM16 8h3v7h-3M5 14l2 7h4l-2-6M20 4l2-2m-1 9h2m-3 7 2 2"/><path d="m3 9 13-5v14L3 13z" fill="currentColor" opacity=".14"/>',
 theft:'<path d="M12 3H4v18h13v-8M12 3v6H4M11 14h11m-4-4 4 4-4 4M7 17h2"/><path d="M4 3h8v6H4z" fill="currentColor" opacity=".14"/>',
 sabotage:'<path d="M5 4h5v6H4V5m0 5v10h16V10h-7M10 4h10v3M14 2l-3 6 4 2-3 7M7 15h2m7 2h1"/><path d="m14 2-3 6 4 2-3 7" stroke-width="2.3"/>',
 fire:'<path d="M13 2c1 6 6 7 6 12a7 7 0 0 1-14 0c0-3 2-6 4-8 0 4 2 5 2 5s3-4 2-9z" fill="currentColor" opacity=".15"/><path d="M13 2c1 6 6 7 6 12a7 7 0 0 1-14 0c0-3 2-6 4-8 0 4 2 5 2 5s3-4 2-9zM12 14c-5 5-1 8 2 6 2-2-1-4-2-6z"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 7 7M7 10h6m-3-3v6"/>',
 mail:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m3 7 9 6 9-6M17 14v2m0 2v.1"/>',
 web:'<rect x="2" y="3" width="20" height="18" rx="3"/><path d="M2 8h20M5 5.5h1m2 0h1M9 12l-3 3 3 3m6-6 3 3-3 3"/>',
 person:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3M9 15l3 4 3-4"/>',
 usb:'<rect x="7" y="10" width="10" height="12" rx="3"/><path d="M9 10V2h6v8M11 5v2m2-2v2m-3 10h4"/>',
 network:'<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="1" y="16" width="8" height="6" rx="1"/><rect x="15" y="16" width="8" height="6" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
 upload:'<path d="M12 16V2m-5 5 5-5 5 5M4 13H2v9h20v-9h-2M6 18h2"/>',
 value:'<path d="m12 2 10 10-10 10L2 12z" fill="currentColor" opacity=".14"/><path d="m12 2 10 10-10 10L2 12zM7 12h10m-5-5v10"/>'
};
function pictogram(name,opts={}){return `<svg class="picto ${opts.x!==undefined?'graphpicto':''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${opts.x!==undefined?`x="${opts.x}" y="${opts.y}" width="${opts.size}" height="${opts.size}"`:''} fill="none" stroke="${opts.tone||'currentColor'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${pictogramPaths[name]||pictogramPaths.value}</svg>`;}
window.addEventListener('DOMContentLoaded',()=>{
 const library=[['spy','Espionnage','Illustrer une source orientée espionnage','amber'],['hacker','Hacker','Illustrer un acteur ou une action cyber','blue'],['activist','Activisme','Illustrer la source du cas pédagogique','amber'],['thief','Voleur','Illustrer un vol','red'],['theft','Vol de données','Illustrer un objectif visé','red'],['sabotage','Sabotage','Illustrer un objectif de perturbation','red'],['fire','Incendie','Événement à contextualiser ; pas une SR en soi','orange'],['value','Valeur métier','Illustrer ce que l’étude cherche à protéger','purple']];
 document.body.insertAdjacentHTML('beforeend',`<dialog id="iconLibrary" class="iconlibrary"><div class="dialoghead"><div><small>REPÈRES VISUELS / PROPOSITION ASTRA</small><h2>Des illustrations discrètes, des libellés précis</h2></div><button class="btn" id="closeIconLibrary">Fermer ×</button></div><p>Les pictogrammes accompagnent les libellés SR / OV. Leur sens dépend de l’étude ; ils ne constituent pas une classification ANSSI.</p><div class="pictogrid">${library.map(([id,title,desc,tone])=>`<div class="pictocard"><span class="pictochip ${tone}">${pictogram(id)}</span><strong>${title}</strong><small>${desc}</small></div>`).join('')}</div><p class="muted">L’incendie est disponible dans la palette. Il n’est pas ajouté au cas ANSSI illustré et ne devient pas automatiquement une source de risque.</p></dialog>`);
 document.querySelector('#closeIconLibrary').onclick=()=>document.querySelector('#iconLibrary').close();
});
