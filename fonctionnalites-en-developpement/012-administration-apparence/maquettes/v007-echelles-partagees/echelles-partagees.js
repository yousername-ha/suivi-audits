const previousOpenScales=openScales;
openScales=function(){previousOpenScales();const s=currentScale();if(!s)return;
 $('.dialog-foot').insertAdjacentHTML('beforeend','<button class="btn primary" id="publish-shared-scale">Publier pour les risques · démo</button>');
 $('.dialog-body').insertAdjacentHTML('beforeend','<div class="notice">Catalogue de démonstration partagé avec Risques / EBIOS RM sur la même origine du navigateur. Publier ajoute une version ; les anciennes cotations gardent leur référence. Les brouillons restent exclus des sélecteurs.</div><a href="../../../003-ebios-rm/maquettes/v002-echelles-plateforme/index.html#cotation">Ouvrir Risques / EBIOS RM →</a>');
};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.id==='publish-shared-scale'){const s=currentScale();if(!s)return;saveScale();if($('#dialog').open)return;try{s.version=AstraScales.publish(s);s.published=true;openScales();toast('Version '+s.version+' publiée dans le catalogue de démonstration.');}catch{openScales();scaleError('Publication impossible : stockage du navigateur indisponible.');}}
});
// Archive in the shared catalogue before the original handler mutates the local draft.
document.addEventListener('click',e=>{if(e.target.closest('#confirm-scale-remove')){const s=currentScale();if(s?.published)try{AstraScales.archive(s.id);}catch{e.stopImmediatePropagation();scaleError('Archivage impossible : stockage indisponible.');}}},true);

if(location.hash==='#scales'){page='platform';render();openScales();}
