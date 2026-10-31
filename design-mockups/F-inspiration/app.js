/* Maquette F « Inspiration » — rendu des écrans, graphiques SVG natifs, interactions.
   JS natif, sans module ni dépendance ; données : window.FAKE uniquement, aucune persistance. */
(function () {
  'use strict';

  var F = window.FAKE;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var racine = document.documentElement;
  var vue = document.getElementById('vue');
  var contenu = document.getElementById('contenu');
  var compteurId = 0;
  var apresMontage = [];
  var etat = {
    liste: { recherche: '', statut: 'Tous', type: '', referentiel: '', tri: { cle: 'debut', sens: 'desc' }, page: 1 },
    fiche: { onglet: 'synthese' },
    evolution: { periode: 12 },
    retex: { actif: -1 },
  };

  /* ====================================================================== Utilitaires DOM */
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    poserAttributs(e, attrs);
    ajouterEnfants(e, children);
    return e;
  }
  function s(tag, attrs, children) {
    var e = document.createElementNS(SVG_NS, tag);
    poserAttributs(e, attrs);
    ajouterEnfants(e, children);
    return e;
  }
  function poserAttributs(e, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.setAttribute('class', v);
      else if (k === 'html') e.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'vars') Object.keys(v).forEach(function (n) { e.style.setProperty(n, v[n]); });
      else if (k === 'href' && e.namespaceURI === SVG_NS) e.setAttribute('href', v);
      else e.setAttribute(k, v === true ? '' : v);
    });
  }
  function ajouterEnfants(e, children) {
    if (children === undefined || children === null) return;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }
  function icone(nom, classe) {
    var svg = s('svg', { class: 'icone' + (classe ? ' ' + classe : ''), 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(s('use', { href: '#' + nom }));
    return svg;
  }
  function uid(prefixe) {
    compteurId += 1;
    return (prefixe || 'id') + '-' + compteurId;
  }
  function fmt(n) {
    var str = String(Math.round(n));
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function heureCourte(isoHeure) {
    var p = isoHeure.split('T');
    var d = p[0].split('-');
    return d[2] + '/' + d[1] + ' ' + p[1];
  }
  function dureeHeures(a, b) {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 3600000);
  }
  function anim() {
    return racine.getAttribute('data-animations') !== 'off';
  }
  function pluriel(n, sing, plur) {
    return n + ' ' + (n > 1 ? plur || sing + 's' : sing);
  }

  /* ====================================================================== Vocabulaire visuel : statuts → teinte + icône */
  var TEINTES = {
    statutAudit: { 'Planifié': 'violet', 'En préparation': 'bleu', 'En cours': 'sarcelle', 'Rapport attendu': 'or', 'Clos': 'vert', 'Reporté': 'corail' },
    criticite: { Critique: 'corail', Majeure: 'or', Mineure: 'bleu', Observation: 'gris' },
    statutConstat: { Ouvert: 'corail', 'En cours': 'sarcelle', 'À vérifier': 'or', Clos: 'vert' },
    statutAction: { 'À faire': 'gris', 'En cours': 'sarcelle', 'Bloquée': 'corail', 'Terminée': 'vert' },
    referentiel: { vert: 'vert', bleu: 'bleu', violet: 'violet', orange: 'or', gris: 'gris' },
    type: { Certification: 'violet', Surveillance: 'bleu', Interne: 'gris', Fournisseur: 'or', Blanc: 'sarcelle', 'Réglementaire': 'corail' },
  };
  var ICONES_CRITICITE = { Critique: 'i-flamme', Majeure: 'i-alerte', Mineure: 'i-info', Observation: 'i-point' };
  var ICONES_GRAVITE = ['i-ok-cercle', 'i-info', 'i-cloche', 'i-alerte', 'i-flamme'];
  var COULEURS_SVG = { sarcelle: '#2EC4B6', violet: '#8F7BFF', corail: '#F0564A', or: '#F2A33A', vert: '#2FD37A', bleu: '#4C8DFF', gris: '#8E9AB8' };

  function badge(libelle, teinte, nomIcone) {
    return h('span', { class: 'badge badge--' + (teinte || 'gris') }, [
      nomIcone ? icone(nomIcone) : h('span', { class: 'point', 'aria-hidden': 'true' }),
      h('span', { class: 'badge__texte', text: libelle }),
    ]);
  }
  function badgeStatutAudit(statut) { return badge(statut, TEINTES.statutAudit[statut]); }
  function badgeCriticite(c) { return badge(c, TEINTES.criticite[c], ICONES_CRITICITE[c]); }
  function badgeReferentiel(id) { var r = F.referentiel(id); return badge(r.court, TEINTES.referentiel[r.couleur]); }
  function badgeType(t) { return badge(t, TEINTES.type[t]); }
  function gravite(niveau) {
    return h('span', { class: 'gravite gravite--' + niveau }, [icone(ICONES_GRAVITE[niveau]), F.vocabulaire.gravitesRetex[niveau]]);
  }
  function avatar(id, grand) {
    var u = F.utilisateur(id);
    return h('span', { class: 'avatar' + (grand ? ' avatar--grand' : ''), 'aria-hidden': 'true', text: u.initiales });
  }
  function personne(id) {
    var u = F.utilisateur(id);
    return h('span', { class: 'meta__valeur' }, [avatar(id), u.nom]);
  }

  /* ====================================================================== Interrupteur d'animations */
  var segmentAnimations = document.getElementById('segment-animations');
  function placerCapsule(conteneur, option, selecteurCapsule) {
    var capsule = conteneur.querySelector(selecteurCapsule);
    if (!capsule || !option) return;
    capsule.style.setProperty('--x', option.offsetLeft + 'px');
    capsule.style.setProperty('--s', String(option.offsetWidth / 100));
  }
  function initialiserSegment(conteneur, onChange) {
    var options = Array.prototype.slice.call(conteneur.querySelectorAll('.segment__option'));
    function choisir(valeur, silencieux) {
      options.forEach(function (o) {
        o.setAttribute('aria-pressed', String(o.dataset.valeur === valeur));
      });
      var actif = options.filter(function (o) { return o.dataset.valeur === valeur; })[0];
      placerCapsule(conteneur, actif, '.segment__capsule');
      if (!silencieux && onChange) onChange(valeur);
    }
    options.forEach(function (o) {
      o.addEventListener('click', function () { choisir(o.dataset.valeur); });
    });
    var initial = options.filter(function (o) { return o.getAttribute('aria-pressed') === 'true'; })[0] || options[0];
    requestAnimationFrame(function () { placerCapsule(conteneur, initial, '.segment__capsule'); });
    return { choisir: choisir };
  }
  function appliquerAnimations(valeur) {
    racine.setAttribute('data-animations', valeur);
  }
  var reduire = window.matchMedia('(prefers-reduced-motion: reduce)');
  var segAnim = initialiserSegment(segmentAnimations, appliquerAnimations);
  if (reduire.matches) {
    appliquerAnimations('off');
    segAnim.choisir('off', true);
  }
  reduire.addEventListener('change', function (e) {
    appliquerAnimations(e.matches ? 'off' : 'on');
    segAnim.choisir(e.matches ? 'off' : 'on', true);
  });

  /* ====================================================================== Compteurs animés et observateur d'apparition */
  function animerCompteur(el) {
    var cible = parseFloat(el.dataset.compteur);
    var suffixe = el.dataset.suffixe || '';
    var decimales = parseInt(el.dataset.decimales || '0', 10);
    function ecrire(v) {
      el.textContent = (decimales ? v.toFixed(decimales) : fmt(v)) + suffixe;
    }
    if (!anim() || cible === 0) { ecrire(cible); return; }
    var duree = 1100;
    var debut = null;
    function pas(t) {
      if (debut === null) debut = t;
      var p = Math.min(1, (t - debut) / duree);
      var e = 1 - Math.pow(1 - p, 3);
      ecrire(cible * e);
      if (p < 1) requestAnimationFrame(pas);
      else ecrire(cible);
    }
    ecrire(0);
    requestAnimationFrame(pas);
  }
  function reveler(el) {
    if (el.classList.contains('anime')) return;
    el.classList.add('anime');
    Array.prototype.forEach.call(el.querySelectorAll('.barre'), function (b) { b.classList.add('anime'); });
    if (el.classList.contains('barre')) el.classList.add('anime');
    Array.prototype.forEach.call(el.querySelectorAll('[data-compteur]'), animerCompteur);
    if (el.hasAttribute('data-compteur')) animerCompteur(el);
  }
  var observateur = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        if (en.isIntersecting) {
          reveler(en.target);
          observateur.unobserve(en.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px 240px 0px' })
    : null;
  var minuteurRepli = null;
  /* Apparition : IntersectionObserver d'abord ; repli après 1,5 s pour ce qui reste hors écran
     (impression, capture pleine page, lecteurs d'écran), afin qu'aucun chiffre ne reste à zéro. */
  function observer(conteneur) {
    Array.prototype.forEach.call(conteneur.querySelectorAll('.a-observer'), function (el) {
      if (observateur) observateur.observe(el);
      else reveler(el);
    });
    clearTimeout(minuteurRepli);
    minuteurRepli = setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.a-observer:not(.anime)'), function (el) {
        if (observateur) observateur.unobserve(el);
        reveler(el);
      });
    }, anim() ? 1500 : 0);
  }
  function cascade(conteneur) {
    Array.prototype.forEach.call(conteneur.querySelectorAll('[data-cascade]'), function (parent) {
      Array.prototype.forEach.call(parent.children, function (enfant, i) {
        enfant.classList.add('cascade__item');
        enfant.style.setProperty('--i', String(i));
      });
    });
  }
  document.addEventListener('animationend', function (e) {
    if (e.animationName === 'entree' || e.animationName === 'entree-ligne') e.target.classList.add('entree-finie');
  });

  /* ====================================================================== Info-bulle (suit le pointeur) */
  var infobulle = document.getElementById('infobulle');
  var infobulleCorps = h('div', { class: 'infobulle__corps' });
  infobulle.appendChild(infobulleCorps);
  function positionnerInfobulle(x, y) {
    var l = infobulle.offsetWidth || 160;
    var hh = infobulle.offsetHeight || 48;
    var tx = Math.min(x + 16, window.innerWidth - l - 12);
    var ty = y - hh - 14;
    if (ty < 8) ty = y + 18;
    infobulle.style.setProperty('--tx', tx + 'px');
    infobulle.style.setProperty('--ty', ty + 'px');
  }
  function montrerInfobulle(contenuFn, x, y) {
    infobulleCorps.innerHTML = '';
    ajouterEnfants(infobulleCorps, contenuFn());
    infobulle.hidden = false;
    positionnerInfobulle(x, y);
    requestAnimationFrame(function () { infobulle.classList.add('visible'); });
  }
  function cacherInfobulle() {
    infobulle.classList.remove('visible');
    infobulle.hidden = true;
  }
  function attacherInfobulle(el, contenuFn) {
    el.addEventListener('pointerenter', function (e) { montrerInfobulle(contenuFn, e.clientX, e.clientY); });
    el.addEventListener('pointermove', function (e) { positionnerInfobulle(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', cacherInfobulle);
    el.addEventListener('focus', function () {
      var r = el.getBoundingClientRect();
      montrerInfobulle(contenuFn, r.left + r.width / 2, r.top);
    });
    el.addEventListener('blur', cacherInfobulle);
  }
  function contenuBulle(titre, valeur) {
    return [h('span', { class: 'infobulle__titre', text: titre }), h('span', { class: 'infobulle__valeur', text: valeur })];
  }

  /* ====================================================================== Toasts */
  var zoneToasts = document.getElementById('toasts');
  var ICONES_TOAST = { succes: 'i-ok-cercle', alerte: 'i-alerte', erreur: 'i-erreur', info: 'i-info' };
  var LIBELLES_TOAST = { succes: 'Succès', alerte: 'Alerte', erreur: 'Erreur', info: 'Information' };
  function toast(type, titre, texte) {
    var el = h('div', { class: 'toast toast--' + type, role: type === 'erreur' ? 'alert' : 'status' });
    var fermer = h('button', { type: 'button', class: 'toast__fermer', 'aria-label': 'Fermer la notification' }, icone('i-fermer'));
    el.appendChild(h('span', { class: 'toast__icone', 'aria-hidden': 'true' }, icone(ICONES_TOAST[type])));
    el.appendChild(h('div', {}, [
      h('div', { class: 'toast__titre' }, [h('span', { class: 'sr-only', text: LIBELLES_TOAST[type] + ' : ' }), titre]),
      texte ? h('div', { class: 'toast__texte', text: texte }) : null,
    ]));
    el.appendChild(fermer);
    var minuteur = setTimeout(retirer, 5200);
    function retirer() {
      clearTimeout(minuteur);
      if (!el.parentNode) return;
      if (!anim()) { el.remove(); return; }
      el.classList.add('toast--sortie');
      el.addEventListener('animationend', function () { el.remove(); }, { once: true });
    }
    fermer.addEventListener('click', retirer);
    zoneToasts.appendChild(el);
    return el;
  }

  /* ====================================================================== Modale (piège de focus, Échap) */
  var racineModale = document.getElementById('modale-racine');
  function ouvrirModale(opts) {
    var declencheur = document.activeElement;
    var idTitre = uid('modale-titre');
    var idTexte = uid('modale-texte');
    var boite = h('div', { class: 'modale__boite', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitre, 'aria-describedby': idTexte });
    var fermerBtn = h('button', { type: 'button', class: 'modale__fermer', 'aria-label': 'Fermer' }, icone('i-fermer'));
    var annuler = h('button', { type: 'button', class: 'bouton', text: opts.annuler || 'Annuler' });
    var confirmer = h('button', { type: 'button', class: 'bouton ' + (opts.classeConfirmer || 'bouton--primaire'), text: opts.confirmer || 'Confirmer' });
    boite.appendChild(fermerBtn);
    if (opts.icone) boite.appendChild(h('div', { class: 'modale__icone', 'aria-hidden': 'true' }, icone(opts.icone, 'icone--lg')));
    boite.appendChild(h('h2', { class: 'modale__titre', id: idTitre, text: opts.titre }));
    boite.appendChild(h('p', { class: 'modale__texte', id: idTexte, text: opts.texte }));
    boite.appendChild(h('div', { class: 'modale__actions' }, [annuler, confirmer]));
    var voile = h('div', { class: 'modale__voile' });
    var modale = h('div', { class: 'modale' }, [voile, boite]);
    function focusables() {
      return Array.prototype.filter.call(boite.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled; });
    }
    function fermer(resultat) {
      document.removeEventListener('keydown', clavier, true);
      function retirer() {
        modale.remove();
        if (declencheur && declencheur.focus) declencheur.focus();
        if (opts.onFermer) opts.onFermer(resultat);
      }
      if (!anim()) { retirer(); return; }
      modale.classList.add('modale--sortie');
      boite.addEventListener('animationend', retirer, { once: true });
    }
    function clavier(e) {
      if (e.key === 'Escape') { e.preventDefault(); fermer(false); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        var premier = f[0], dernier = f[f.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      }
    }
    voile.addEventListener('click', function () { fermer(false); });
    fermerBtn.addEventListener('click', function () { fermer(false); });
    annuler.addEventListener('click', function () { fermer(false); });
    confirmer.addEventListener('click', function () { fermer(true); });
    document.addEventListener('keydown', clavier, true);
    racineModale.appendChild(modale);
    confirmer.focus();
    return modale;
  }

  /* ====================================================================== Graphiques SVG */
  function degrade(id, couleurA, couleurB, vertical) {
    var g = s('linearGradient', { id: id, x1: '0', y1: '0', x2: vertical ? '0' : '1', y2: vertical ? '1' : '0' });
    g.appendChild(s('stop', { offset: '0%', 'stop-color': couleurA }));
    g.appendChild(s('stop', { offset: '100%', 'stop-color': couleurB }));
    return g;
  }
  function degradeAire(id, couleur) {
    var g = s('linearGradient', { id: id, x1: '0', y1: '0', x2: '0', y2: '1' });
    g.appendChild(s('stop', { offset: '0%', 'stop-color': couleur, 'stop-opacity': '0.45' }));
    g.appendChild(s('stop', { offset: '100%', 'stop-color': couleur, 'stop-opacity': '0' }));
    return g;
  }

  /* Barres verticales arrondies, dégradé sarcelle → violet, piste translucide, info-bulle. */
  function graphBarres(items, opts) {
    opts = opts || {};
    var L = 420, H = opts.hauteur || 220, mB = 34, mT = 26, mX = 12;
    var max = Math.max.apply(null, items.map(function (i) { return i.valeur; })) || 1;
    var svg = s('svg', { class: 'graphique', viewBox: '0 0 ' + L + ' ' + H, role: 'img', 'aria-label': opts.label || 'Diagramme en barres' });
    var defs = s('defs');
    var idG = uid('deg');
    defs.appendChild(degrade(idG, '#6D5BD0', '#2EC4B6', true));
    svg.appendChild(defs);
    var pas = (L - 2 * mX) / items.length;
    var largeur = Math.min(34, pas * 0.5);
    items.forEach(function (it, i) {
      var x = mX + pas * i + (pas - largeur) / 2;
      var hBarre = Math.max(4, ((H - mB - mT) * it.valeur) / max);
      var y = H - mB - hBarre;
      var groupe = s('g', { class: 'g-groupe' });
      groupe.appendChild(s('rect', { class: 'g-piste', x: x, y: mT, width: largeur, height: H - mB - mT, rx: largeur / 2 }));
      var barre = s('rect', { class: 'g-barre', x: x, y: y, width: largeur, height: hBarre, rx: largeur / 2, fill: it.couleur || 'url(#' + idG + ')' });
      barre.style.setProperty('--i', String(i));
      groupe.appendChild(barre);
      var valeur = s('text', { class: 'g-valeur', x: x + largeur / 2, y: y - 8, 'text-anchor': 'middle', text: fmt(it.valeur) });
      valeur.style.setProperty('--i', String(i));
      groupe.appendChild(valeur);
      groupe.appendChild(s('text', { x: x + largeur / 2, y: H - 12, 'text-anchor': 'middle', text: it.court || it.libelle }));
      var zone = s('rect', { class: 'g-zone', x: mX + pas * i, y: 0, width: pas, height: H, tabindex: '0', role: 'img', 'aria-label': it.libelle + ' : ' + fmt(it.valeur) });
      attacherInfobulle(zone, function () { return contenuBulle(it.libelle, fmt(it.valeur) + (opts.unite ? ' ' + opts.unite : '')); });
      groupe.appendChild(zone);
      svg.appendChild(groupe);
    });
    return svg;
  }

  /* Courbe lissée (Catmull-Rom → Bézier). */
  function cheminLisse(points) {
    if (points.length < 2) return '';
    var d = 'M' + points[0][0] + ' ' + points[0][1];
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  }

  /* Courbe d'évolution : plusieurs séries, aire dégradée, tracé progressif, guide + info-bulle. */
  function graphCourbe(etiquettes, series, opts) {
    opts = opts || {};
    var L = 640, H = opts.hauteur || 250, mG = 36, mD = 16, mT = 18, mB = 30;
    var svg = s('svg', { class: 'graphique', viewBox: '0 0 ' + L + ' ' + H, role: 'img', 'aria-label': opts.label || 'Courbe d’évolution' });
    var defs = s('defs');
    svg.appendChild(defs);
    var max = 0;
    series.forEach(function (se) { se.valeurs.forEach(function (v) { if (v > max) max = v; }); });
    max = Math.ceil(max / 5) * 5 || 5;
    var n = etiquettes.length;
    function px(i) { return mG + ((L - mG - mD) * i) / Math.max(1, n - 1); }
    function py(v) { return mT + (H - mT - mB) * (1 - v / max); }
    for (var g = 0; g <= 4; g++) {
      var yv = (max / 4) * g;
      svg.appendChild(s('line', { class: 'g-grille', x1: mG, x2: L - mD, y1: py(yv), y2: py(yv) }));
      svg.appendChild(s('text', { x: mG - 8, y: py(yv) + 4, 'text-anchor': 'end', text: fmt(yv) }));
    }
    svg.appendChild(s('line', { class: 'g-axe', x1: mG, x2: L - mD, y1: H - mB, y2: H - mB }));
    etiquettes.forEach(function (et, i) {
      if (n > 8 && i % 2 === 1) return;
      svg.appendChild(s('text', { x: px(i), y: H - 10, 'text-anchor': 'middle', text: et }));
    });
    var traces = [];
    series.forEach(function (se, k) {
      var pts = se.valeurs.map(function (v, i) { return [px(i), py(v)]; });
      var d = cheminLisse(pts);
      var idA = uid('aire');
      defs.appendChild(degradeAire(idA, se.couleur));
      var aire = s('path', { class: 'g-aire', d: d + ' L' + pts[pts.length - 1][0] + ' ' + (H - mB) + ' L' + pts[0][0] + ' ' + (H - mB) + ' Z', fill: 'url(#' + idA + ')' });
      aire.style.setProperty('--i', String(k));
      svg.appendChild(aire);
      var trace = s('path', { class: 'g-trace' + (se.lueur ? ' g-trace--lueur' : ''), d: d, stroke: se.couleur });
      trace.style.setProperty('--i', String(k));
      if (se.lueur) trace.style.setProperty('--lueur-couleur', se.couleur);
      svg.appendChild(trace);
      traces.push(trace);
      pts.forEach(function (p, i) {
        var c = s('circle', { class: 'g-point-courbe', cx: p[0], cy: p[1], r: 3.5, fill: se.couleur, stroke: '#1C2B4A', 'stroke-width': 1.5 });
        c.style.setProperty('--i', String(i));
        svg.appendChild(c);
      });
    });
    var guide = s('line', { class: 'g-guide', x1: 0, x2: 0, y1: mT, y2: H - mB });
    svg.appendChild(guide);
    var pas = (L - mG - mD) / Math.max(1, n - 1);
    etiquettes.forEach(function (et, i) {
      var zone = s('rect', { class: 'g-zone', x: px(i) - pas / 2, y: 0, width: pas, height: H, tabindex: '0', role: 'img',
        'aria-label': et + ' : ' + series.map(function (se) { return se.nom + ' ' + se.valeurs[i]; }).join(', ') });
      zone.addEventListener('pointerenter', function () { guide.setAttribute('x1', px(i)); guide.setAttribute('x2', px(i)); guide.classList.add('visible'); });
      zone.addEventListener('focus', function () { guide.setAttribute('x1', px(i)); guide.setAttribute('x2', px(i)); guide.classList.add('visible'); });
      zone.addEventListener('pointerleave', function () { guide.classList.remove('visible'); });
      zone.addEventListener('blur', function () { guide.classList.remove('visible'); });
      attacherInfobulle(zone, function () {
        return [h('span', { class: 'infobulle__titre', text: et })].concat(series.map(function (se) {
          return h('div', {}, [h('span', { class: 'point point--dyn', 'aria-hidden': 'true', vars: { '--c': se.couleur } }), ' ', se.nom, ' : ', h('span', { class: 'infobulle__valeur', text: fmt(se.valeurs[i]) })]);
        }));
      });
      svg.appendChild(zone);
    });
    apresMontage.push(function () {
      traces.forEach(function (t) {
        var l = Math.ceil(t.getTotalLength()) + 2;
        t.style.setProperty('--long', String(l));
      });
    });
    return svg;
  }

  /* Jauge circulaire pointillée : anneau de points qui s'allument un à un, arc interne, chiffre au centre. */
  function jaugePointillee(valeur, max, opts) {
    opts = opts || {};
    var T = 160, c = T / 2, rPoints = 68, rArc = 54, nb = 40;
    var frac = Math.max(0, Math.min(1, valeur / max));
    var svg = s('svg', { class: 'jauge__svg', viewBox: '0 0 ' + T + ' ' + T, role: 'img', 'aria-label': (opts.label || 'Jauge') + ' : ' + valeur + (opts.unite || '') + ' sur ' + max });
    var defs = s('defs');
    var idG = uid('deg');
    defs.appendChild(degrade(idG, opts.couleurA || '#2EC4B6', opts.couleurB || '#6D5BD0'));
    svg.appendChild(defs);
    var actifs = Math.round(frac * nb);
    for (var i = 0; i < nb; i++) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / nb;
      var actif = i < actifs;
      var p = s('circle', { class: 'g-point' + (actif ? ' g-point--actif' : ''), cx: (c + rPoints * Math.cos(a)).toFixed(2), cy: (c + rPoints * Math.sin(a)).toFixed(2), r: actif ? 3.2 : 2.4, fill: actif ? 'url(#' + idG + ')' : '#A9B4D0' });
      p.style.setProperty('--i', String(i));
      svg.appendChild(p);
    }
    var circ = 2 * Math.PI * rArc;
    svg.appendChild(s('circle', { class: 'g-arc-piste', cx: c, cy: c, r: rArc, 'stroke-width': 6 }));
    var arc = s('circle', { class: 'g-arc', cx: c, cy: c, r: rArc, 'stroke-width': 6, stroke: 'url(#' + idG + ')', transform: 'rotate(-90 ' + c + ' ' + c + ')' });
    arc.style.setProperty('--long', circ.toFixed(1));
    arc.style.setProperty('--cible', (circ * (1 - frac)).toFixed(1));
    svg.appendChild(arc);
    var txt = s('text', { class: 'jauge__centre', x: c, y: c + 6, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    var nombre = s('tspan', { 'data-compteur': String(valeur), text: '0' });
    txt.appendChild(nombre);
    if (opts.unite) txt.appendChild(s('tspan', { class: 'jauge__unite', dx: 2, text: opts.unite }));
    svg.appendChild(txt);
    return svg;
  }

  /* Anneaux concentriques : un arc par série. */
  function anneaux(items, total) {
    var T = 170, c = T / 2, ep = 10;
    var svg = s('svg', { class: 'graphique', viewBox: '0 0 ' + T + ' ' + T, role: 'img', 'aria-label': 'Anneaux : ' + items.map(function (i) { return i.libelle + ' ' + i.valeur; }).join(', ') });
    items.forEach(function (it, i) {
      var r = 72 - i * (ep + 6);
      var circ = 2 * Math.PI * r;
      var frac = total ? it.valeur / total : 0;
      svg.appendChild(s('circle', { class: 'g-arc-piste', cx: c, cy: c, r: r, 'stroke-width': ep }));
      var arc = s('circle', { class: 'g-arc', cx: c, cy: c, r: r, 'stroke-width': ep, stroke: it.couleur, transform: 'rotate(-90 ' + c + ' ' + c + ')', tabindex: '0', role: 'img', 'aria-label': it.libelle + ' : ' + it.valeur });
      arc.style.setProperty('--long', circ.toFixed(1));
      arc.style.setProperty('--cible', (circ * (1 - frac)).toFixed(1));
      arc.style.setProperty('--i', String(i));
      attacherInfobulle(arc, function () { return contenuBulle(it.libelle, it.valeur + ' (' + Math.round(frac * 100) + ' %)'); });
      svg.appendChild(arc);
    });
    return svg;
  }

  /* Sparklines : mini-barres (image 03) ou mini-courbe. */
  function sparklineBarres(valeurs, couleur) {
    var L = 100, H = 32;
    var max = Math.max.apply(null, valeurs) || 1;
    var svg = s('svg', { class: 'kpi__sparkline', viewBox: '0 0 ' + L + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    var pas = L / valeurs.length;
    valeurs.forEach(function (v, i) {
      var hB = Math.max(3, (H - 2) * (v / max));
      var r = s('rect', { class: 'g-barre', x: i * pas + 1.5, y: H - hB, width: pas - 3, height: hB, rx: (pas - 3) / 2, fill: couleur || '#2EC4B6' });
      r.style.setProperty('--i', String(i));
      svg.appendChild(r);
    });
    return svg;
  }
  function sparklineCourbe(valeurs, couleur) {
    var L = 120, H = 36;
    var max = Math.max.apply(null, valeurs), min = Math.min.apply(null, valeurs);
    var pts = valeurs.map(function (v, i) { return [((L - 4) * i) / (valeurs.length - 1) + 2, 4 + (H - 8) * (1 - (v - min) / Math.max(1, max - min))]; });
    var svg = s('svg', { class: 'indicateur__sparkline', viewBox: '0 0 ' + L + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
    var idA = uid('aire');
    var defs = s('defs');
    defs.appendChild(degradeAire(idA, couleur));
    svg.appendChild(defs);
    svg.appendChild(s('path', { class: 'g-aire', d: cheminLisse(pts) + ' L' + pts[pts.length - 1][0] + ' ' + H + ' L' + pts[0][0] + ' ' + H + ' Z', fill: 'url(#' + idA + ')' }));
    var trace = s('path', { class: 'g-trace', d: cheminLisse(pts), stroke: couleur, 'stroke-width': 2 });
    svg.appendChild(trace);
    apresMontage.push(function () { trace.style.setProperty('--long', String(Math.ceil(trace.getTotalLength()) + 2)); });
    return svg;
  }

  /* Barre horizontale HTML (piste + remplissage dégradé). */
  function barre(valeur, teinte, epaisse, index) {
    var rempl = h('span', { class: 'barre__remplissage' + (teinte ? ' barre__remplissage--' + teinte : '') });
    rempl.style.setProperty('--valeur', String(Math.max(0, Math.min(1, valeur / 100))));
    rempl.style.setProperty('--i', String(index || 0));
    return h('span', { class: 'barre' + (epaisse ? ' barre--epaisse' : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(valeur)), 'aria-label': 'Avancement ' + Math.round(valeur) + ' %' }, rempl);
  }

  /* ====================================================================== Composants d'écran */
  function carte(opts, enfants) {
    var classes = 'carte ' + (opts.claire ? 'carte--claire' : 'carte--verre') + (opts.survol === false ? '' : ' carte--survol') + (opts.classe ? ' ' + opts.classe : '');
    var c = h('section', { class: classes, 'aria-labelledby': opts.titre ? opts.id = uid('carte') : null });
    if (opts.titre) {
      c.appendChild(h('header', { class: 'carte__entete' }, [
        h('div', {}, [h('h2', { class: 'carte__titre', id: opts.id, text: opts.titre }), opts.sousTitre ? h('p', { class: 'carte__sous-titre', text: opts.sousTitre }) : null]),
        opts.droite || null,
      ]));
    }
    ajouterEnfants(c, enfants);
    return c;
  }
  function enteteEcran(titre, contexte, actions) {
    return h('div', { class: 'ecran__entete' }, [
      h('div', {}, [h('h1', { class: 'ecran__titre', text: titre }), contexte ? h('p', { class: 'ecran__contexte', text: contexte }) : null]),
      actions ? h('div', { class: 'ecran__actions' }, actions) : null,
    ]);
  }
  function segment(options, valeur, onChange, clair) {
    var conteneur = h('div', { class: 'segment' + (clair ? ' segment--clair' : ''), role: 'group' });
    options.forEach(function (o) {
      conteneur.appendChild(h('button', { type: 'button', class: 'segment__option', 'data-valeur': o.valeur, 'aria-pressed': String(o.valeur === valeur), text: o.libelle }));
    });
    conteneur.appendChild(h('span', { class: 'segment__capsule', 'aria-hidden': 'true' }));
    apresMontage.push(function () { initialiserSegment(conteneur, onChange); });
    return conteneur;
  }
  function etatVide(titre, texte, action) {
    var ill = s('svg', { class: 'vide__illustration', viewBox: '0 0 160 160', 'aria-hidden': 'true', focusable: 'false' });
    var defs = s('defs');
    var idG = uid('deg');
    defs.appendChild(degrade(idG, '#2EC4B6', '#6D5BD0'));
    ill.appendChild(defs);
    ill.appendChild(s('circle', { cx: 80, cy: 80, r: 64, fill: 'url(#' + idG + ')', opacity: 0.12 }));
    ill.appendChild(s('circle', { cx: 80, cy: 80, r: 48, fill: 'none', stroke: 'url(#' + idG + ')', 'stroke-width': 2, 'stroke-dasharray': '4 8', 'stroke-linecap': 'round', opacity: 0.7 }));
    ill.appendChild(s('path', { d: 'M52 70h22l6 6h28v34H52z', fill: 'none', stroke: 'url(#' + idG + ')', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    ill.appendChild(s('path', { d: 'M68 92h24', stroke: 'url(#' + idG + ')', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    return h('div', { class: 'vide' }, [ill, h('p', { class: 'vide__titre', text: titre }), h('p', { class: 'vide__texte', text: texte }), action || null]);
  }
  function squelette(claire) {
    return h('div', { class: 'squelette', 'aria-busy': 'true', 'aria-label': 'Chargement en cours' }, [
      h('span', { class: 'squelette__os squelette__os--titre' }),
      h('span', { class: 'squelette__os squelette__os--kpi' }),
      h('span', { class: 'squelette__os' }),
      h('span', { class: 'squelette__os squelette__os--court' }),
      h('span', { class: 'squelette__os squelette__os--bloc' }),
    ]);
  }

  /* ====================================================================== Écran 1 : Dashboard */
  function ecranDashboard() {
    var K = F.kpi;
    var racineEcran = h('div');
    racineEcran.appendChild(enteteEcran('Tableau de bord SMSI', F.organisation.periode + ' · situation au ' + F.frLong(F.aujourdhui), [
      h('a', { class: 'bouton bouton--primaire', href: '#/formulaire' }, [icone('i-plus'), 'Nouvel audit']),
    ]));

    /* KPI */
    var ouvertes = K.actions - K.actionsTerminees;
    var kpis = [
      { valeur: K.auditsEnCours, legende: 'Audits en cours', detail: [badge(K.parStatutAudit['Rapport attendu'] + ' rapports attendus', 'or')] },
      { valeur: K.auditsAVenir, legende: 'Audits à venir', detail: [badge(K.parStatutAudit['En préparation'] + ' en préparation', 'bleu')] },
      { valeur: K.ncOuvertes, legende: 'Non-conformités ouvertes', teinte: 'violet', detail: [badge(K.parCriticiteNC.Critique + ' critiques', 'corail', 'i-flamme')] },
      { valeur: K.actionsEnRetard, legende: 'Actions en retard', teinte: 'corail', detail: [icone('i-horloge'), 'sur ' + ouvertes + ' actions ouvertes'] },
      { valeur: K.conformite, unite: '%', legende: 'Taux de conformité ISO 27001', teinte: 'sarcelle', sparkline: F.indicateurs[0].historique, detail: [h('span', { class: 'tendance tendance--haut' }, [icone('i-tendance-haut'), '+15 pts sur 12 mois']), ' · cible 90 %'] },
      { valeur: K.risquesEleves, legende: 'Risques élevés', teinte: 'or', detail: [icone('i-alerte'), 'niveau ≥ 9 sur ' + F.risques.length + ' risques'] },
    ];
    var grilleKpi = h('div', { class: 'grille grille--kpi', 'data-cascade': '' });
    kpis.forEach(function (k) {
      var c = carte({ classe: 'kpi a-observer carte--compacte' }, [
        h('div', { class: 'kpi__valeur' + (k.teinte ? ' kpi__valeur--' + k.teinte : '') }, [
          h('span', { 'data-compteur': String(k.valeur), text: '0' }),
          k.unite ? h('span', { class: 'kpi__unite', text: k.unite }) : null,
        ]),
        h('p', { class: 'legende kpi__legende', text: k.legende }),
        k.sparkline ? sparklineBarres(k.sparkline) : null,
        h('div', { class: 'kpi__detail' }, k.detail),
      ]);
      grilleKpi.appendChild(c);
    });
    racineEcran.appendChild(grilleKpi);

    var grille = h('div', { class: 'grille', 'data-cascade': '' });

    /* Évolution */
    var conteneurCourbe = h('div', { class: 'a-observer' });
    function rendreCourbe() {
      var n = etat.evolution.periode;
      var ev = F.evolution.slice(-n);
      conteneurCourbe.innerHTML = '';
      conteneurCourbe.classList.remove('anime');
      conteneurCourbe.appendChild(graphCourbe(ev.map(function (e) { return e.mois; }), [
        { nom: 'Constats ouverts', valeurs: ev.map(function (e) { return e.ouverts; }), couleur: '#8F7BFF', lueur: true },
        { nom: 'Constats clos', valeurs: ev.map(function (e) { return e.clos; }), couleur: '#2EC4B6' },
      ], { label: 'Évolution mensuelle des constats ouverts et clos' }));
    }
    rendreCourbe();
    var legendeCourbe = h('div', { class: 'carte__pied' }, [
      h('span', {}, [h('span', { class: 'point point--violet', 'aria-hidden': 'true' }), ' Constats ouverts']),
      h('span', {}, [h('span', { class: 'point point--sarcelle', 'aria-hidden': 'true' }), ' Constats clos']),
      h('span', { text: 'Total 12 mois : ' + fmt(F.evolution.reduce(function (a, e) { return a + e.ouverts; }, 0)) + ' ouverts · ' + fmt(F.evolution.reduce(function (a, e) { return a + e.clos; }, 0)) + ' clos' }),
    ]);
    grille.appendChild(carte({ titre: 'Évolution des constats', sousTitre: 'Constats ouverts et clos par mois', classe: 'col-7',
      droite: segment([{ valeur: '12', libelle: '12 mois' }, { valeur: '6', libelle: '6 mois' }, { valeur: '3', libelle: '3 mois' }], String(etat.evolution.periode), function (v) {
        etat.evolution.periode = parseInt(v, 10);
        rendreCourbe();
        apresMontage.splice(0).forEach(function (fn) { fn(); });
        requestAnimationFrame(function () { reveler(conteneurCourbe); });
      }) }, [conteneurCourbe, legendeCourbe]));

    /* Jauges */
    var I1 = F.indicateurs[0], I2 = F.indicateurs[1];
    grille.appendChild(carte({ titre: 'Conformité et couverture', sousTitre: 'Référentiel ISO 27001:2022', classe: 'col-5 a-observer' }, [
      h('div', { class: 'jauges' }, [
        h('div', { class: 'jauge' }, [jaugePointillee(I1.valeur, 100, { unite: '%', label: I1.libelle }), h('p', { class: 'legende', text: 'Taux de conformité' }), h('p', { class: 'jauge__cible', text: 'Cible ' + I1.cible + ' %' })]),
        h('div', { class: 'jauge' }, [jaugePointillee(I2.valeur, 93, { label: I2.libelle, couleurA: '#8F7BFF', couleurB: '#2EC4B6' }), h('p', { class: 'legende', text: 'Mesures Annexe A' }), h('p', { class: 'jauge__cible', text: I2.valeur + ' sur 93 · cible ' + I2.cible })]),
      ]),
    ]));

    /* Audits par statut */
    var statuts = F.vocabulaire.statutsAudit;
    var COURTS = { 'Planifié': 'Planifié', 'En préparation': 'Prépa.', 'En cours': 'En cours', 'Rapport attendu': 'Rapport', 'Clos': 'Clos', 'Reporté': 'Reporté' };
    grille.appendChild(carte({ titre: 'Audits par statut', sousTitre: K.audits + ' audits sur le cycle', classe: 'col-4 a-observer' }, [
      graphBarres(statuts.map(function (st) { return { libelle: st, court: COURTS[st], valeur: K.parStatutAudit[st] || 0 }; }), { label: 'Audits par statut', unite: 'audits' }),
    ]));

    /* NC par criticité */
    var crit = [{ libelle: 'Critique', valeur: K.parCriticiteNC.Critique || 0, couleur: COULEURS_SVG.corail, teinte: 'corail' }, { libelle: 'Majeure', valeur: K.parCriticiteNC.Majeure || 0, couleur: COULEURS_SVG.or, teinte: 'or' }, { libelle: 'Mineure', valeur: K.parCriticiteNC.Mineure || 0, couleur: COULEURS_SVG.bleu, teinte: 'bleu' }];
    grille.appendChild(carte({ titre: 'Non-conformités ouvertes', sousTitre: 'Par criticité', classe: 'col-4 a-observer' }, [
      h('div', { class: 'anneaux' }, [
        anneaux(crit, K.ncOuvertes),
        h('div', { class: 'anneaux__legende' }, crit.map(function (c) {
          return h('div', { class: 'anneaux__item' }, [
            h('span', { class: 'pastille-couleur', 'aria-hidden': 'true', vars: { '--c': c.couleur } }),
            h('span', { class: 'libelle' }, [icone(ICONES_CRITICITE[c.libelle], 'icone--sm'), ' ', c.libelle]),
            h('span', { class: 'valeur', 'data-compteur': String(c.valeur), text: '0' }),
          ]);
        })),
      ]),
    ]));

    /* Avancement des actions */
    var pct = Math.round((K.actionsTerminees / K.actions) * 100);
    grille.appendChild(carte({ titre: 'Avancement des actions', sousTitre: K.actions + ' actions correctives', classe: 'col-4 a-observer' }, [
      h('div', { class: 'kpi__valeur kpi__valeur--sarcelle' }, [h('span', { 'data-compteur': String(pct), text: '0' }), h('span', { class: 'kpi__unite', text: '%' })]),
      h('p', { class: 'legende', text: 'Actions terminées' }),
      h('div', { class: 'barres-h' }, F.vocabulaire.statutsAction.map(function (st, i) {
        var v = K.parStatutAction[st] || 0;
        var teinte = TEINTES.statutAction[st];
        return h('div', { class: 'barres-h__ligne' }, [
          h('span', { class: 'libelle' }, [h('span', { class: 'point point--' + teinte, 'aria-hidden': 'true' }), st]),
          barre((v / K.actions) * 100, teinte === 'gris' ? 'violet' : teinte, false, i),
          h('span', { class: 'valeur', 'data-compteur': String(v), text: '0' }),
        ]);
      })),
    ]));

    /* Échéances */
    var depassees = K.echeancesDepassees.slice(-3).reverse();
    var prochaines = K.prochainesEcheances.slice(0, 5);
    function ligneEcheance(e) {
      var classe = e.jours < 0 ? 'depassee' : e.jours <= 10 ? 'proche' : 'ok';
      var libelle = e.jours < 0 ? 'Dépassée de ' + pluriel(-e.jours, 'jour') : e.jours === 0 ? 'Aujourd’hui' : 'Dans ' + pluriel(e.jours, 'jour');
      var ic = e.jours < 0 ? 'i-alerte' : e.jours <= 10 ? 'i-horloge' : 'i-calendrier';
      return h('li', { class: 'liste__item' }, [
        h('span', { class: 'jour-compte jour-compte--' + classe, 'aria-hidden': 'true', text: e.jours < 0 ? '−' + (-e.jours) : String(e.jours) }),
        h('span', { class: 'liste__titre' }, [h('span', { class: 'ellipse', text: e.titre }), h('small', {}, [e.id + ' · ' + e.genre + ' · ' + F.utilisateur(e.responsable).nom])]),
        h('span', { class: 'echeance echeance--' + classe }, [icone(ic), libelle + ' · ' + F.fr(e.echeance)]),
      ]);
    }
    grille.appendChild(carte({ claire: true, titre: 'Prochaines échéances', sousTitre: K.echeancesDepassees.length + ' échéances dépassées · ' + K.prochainesEcheances.length + ' à venir sous 30 jours', classe: 'col-7',
      droite: h('a', { class: 'bouton bouton--sm', href: '#/audits' }, ['Voir les audits', icone('i-fleche-d')]) }, [
      h('ul', { class: 'liste' }, depassees.concat(prochaines).map(ligneEcheance)),
    ]));

    /* Indicateurs */
    grille.appendChild(carte({ titre: 'Indicateurs SMSI', sousTitre: 'Valeur actuelle, tendance sur 12 mois', classe: 'col-5 a-observer' }, [
      h('div', {}, F.indicateurs.slice(2, 8).map(function (ind) {
        var bon = ind.id === 'I3' || ind.id === 'I7' ? ind.tendance === 'baisse' : ind.tendance === 'hausse';
        var couleur = ind.tendance === 'stable' ? '#F2A33A' : bon ? '#2EC4B6' : '#F0564A';
        return h('div', { class: 'indicateur' }, [
          h('span', { class: 'indicateur__valeur' }, [h('span', { 'data-compteur': String(ind.valeur), text: '0' }), h('small', { text: ind.unite })]),
          sparklineCourbe(ind.historique, couleur),
          h('span', { class: 'indicateur__libelle' }, [ind.libelle, h('span', { class: 'cible' }, [h('span', { class: 'tendance tendance--' + (ind.tendance === 'stable' ? 'stable' : bon ? 'haut' : 'bas') }, [icone(ind.tendance === 'hausse' ? 'i-tendance-haut' : ind.tendance === 'baisse' ? 'i-tendance-bas' : 'i-tendance-stable', 'icone--sm'), ind.tendance]), ' · cible ' + ind.cible + ind.unite])]),
        ]);
      })),
    ]));

    racineEcran.appendChild(grille);
    return racineEcran;
  }

  /* ====================================================================== Écran 2 : Liste des audits */
  var COLONNES = [
    { cle: 'id', libelle: 'Identifiant' },
    { cle: 'nom', libelle: 'Audit' },
    { cle: 'type', libelle: 'Type' },
    { cle: 'referentiel', libelle: 'Référentiel' },
    { cle: 'debut', libelle: 'Début' },
    { cle: 'statut', libelle: 'Statut' },
    { cle: 'progression', libelle: 'Avancement' },
    { cle: 'nbConstats', libelle: 'Constats', num: true },
  ];
  function auditsFiltres() {
    var L = etat.liste;
    var q = L.recherche.trim().toLowerCase();
    var res = F.audits.filter(function (a) {
      if (L.statut !== 'Tous' && a.statut !== L.statut) return false;
      if (L.type && a.type !== L.type) return false;
      if (L.referentiel && a.referentiel !== L.referentiel) return false;
      if (q) {
        var texte = [a.id, a.nom, a.site, a.type, F.referentiel(a.referentiel).libelle, a.statut, F.utilisateur(a.responsable).nom, a.perimetre].join(' ').toLowerCase();
        if (texte.indexOf(q) === -1) return false;
      }
      return true;
    });
    var cle = L.tri.cle, sens = L.tri.sens === 'asc' ? 1 : -1;
    res.sort(function (a, b) {
      var va = a[cle], vb = b[cle];
      if (cle === 'referentiel') { va = F.referentiel(va).court; vb = F.referentiel(vb).court; }
      if (typeof va === 'number') return (va - vb) * sens;
      return String(va).localeCompare(String(vb), 'fr') * sens;
    });
    return res;
  }
  function ecranAudits() {
    var L = etat.liste;
    var racineEcran = h('div');
    racineEcran.appendChild(enteteEcran('Audits', F.audits.length + ' audits sur le cycle · ' + F.kpi.auditsEnCours + ' en cours', [
      h('a', { class: 'bouton bouton--primaire', href: '#/formulaire' }, [icone('i-plus'), 'Nouvel audit']),
    ]));
    var compte = h('span', { class: 'resultat-compte', role: 'status', 'aria-live': 'polite' });
    var idRecherche = uid('recherche');
    var recherche = h('input', { type: 'search', id: idRecherche, placeholder: 'Rechercher un audit, un site, un responsable…', value: L.recherche, autocomplete: 'off' });
    recherche.addEventListener('input', function () { L.recherche = recherche.value; L.page = 1; rendreTable(); });
    function selecteur(libelle, options, valeur, onChange) {
      var id = uid('sel');
      var sel = h('select', { id: id, 'aria-label': libelle }, [h('option', { value: '', text: libelle + ' : tous' })].concat(options.map(function (o) { return h('option', { value: o.valeur, text: o.libelle, selected: o.valeur === valeur }); })));
      sel.addEventListener('change', function () { onChange(sel.value); L.page = 1; rendreTable(); });
      return h('span', { class: 'selecteur' }, sel);
    }
    var reinit = h('button', { type: 'button', class: 'bouton bouton--discret bouton--sm' }, [icone('i-recommencer'), 'Réinitialiser']);
    reinit.addEventListener('click', function () {
      L.recherche = ''; L.statut = 'Tous'; L.type = ''; L.referentiel = ''; L.page = 1;
      recherche.value = '';
      Array.prototype.forEach.call(outils.querySelectorAll('select'), function (sl) { sl.value = ''; });
      rendreChips(); rendreTable();
      toast('info', 'Filtres réinitialisés', 'Les 36 audits sont affichés.');
    });
    var outils = h('div', { class: 'outils' }, [
      h('div', { class: 'champ-recherche' }, [icone('i-recherche'), h('label', { class: 'sr-only', for: idRecherche, text: 'Rechercher' }), recherche]),
      selecteur('Type', F.vocabulaire.typesAudit.map(function (t) { return { valeur: t, libelle: t }; }), L.type, function (v) { L.type = v; }),
      selecteur('Référentiel', F.referentiels.map(function (r) { return { valeur: r.id, libelle: r.court }; }), L.referentiel, function (v) { L.referentiel = v; }),
      h('span', { class: 'outils__espace' }),
      compte,
      reinit,
    ]);
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrer par statut' });
    function rendreChips() {
      chips.innerHTML = '';
      ['Tous'].concat(F.vocabulaire.statutsAudit).forEach(function (st) {
        var n = st === 'Tous' ? F.audits.length : F.kpi.parStatutAudit[st] || 0;
        var c = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(L.statut === st) }, [st, h('span', { class: 'chip__compte', text: n })]);
        c.addEventListener('click', function () { L.statut = st; L.page = 1; rendreChips(); rendreTable(); });
        chips.appendChild(c);
      });
    }
    rendreChips();
    var enveloppe = h('div', { class: 'tableau-enveloppe' });
    var pagination = h('nav', { class: 'pagination', 'aria-label': 'Pagination' });
    var PAR_PAGE = 10;
    function rendreTable() {
      var res = auditsFiltres();
      var pages = Math.max(1, Math.ceil(res.length / PAR_PAGE));
      if (L.page > pages) L.page = pages;
      var debut = (L.page - 1) * PAR_PAGE;
      var tranche = res.slice(debut, debut + PAR_PAGE);
      compte.textContent = res.length === F.audits.length ? F.audits.length + ' audits' : res.length + ' audit' + (res.length > 1 ? 's' : '') + ' sur ' + F.audits.length;
      var thead = h('thead', {}, h('tr', {}, COLONNES.map(function (col) {
        var actif = L.tri.cle === col.cle;
        var th = h('th', { scope: 'col', class: col.num ? 'num' : null, 'aria-sort': actif ? (L.tri.sens === 'asc' ? 'ascending' : 'descending') : null });
        var btn = h('button', { type: 'button', class: 'tri', 'aria-label': 'Trier par ' + col.libelle.toLowerCase() + (actif ? (L.tri.sens === 'asc' ? ', ordre croissant' : ', ordre décroissant') : '') }, [col.libelle, icone(actif ? (L.tri.sens === 'asc' ? 'i-tri-asc' : 'i-tri-desc') : 'i-tri')]);
        btn.addEventListener('click', function () {
          if (actif) L.tri.sens = L.tri.sens === 'asc' ? 'desc' : 'asc';
          else { L.tri.cle = col.cle; L.tri.sens = col.cle === 'debut' || col.num || col.cle === 'progression' ? 'desc' : 'asc'; }
          rendreTable();
          enveloppe.querySelector('th[aria-sort] .tri').focus();
        });
        th.appendChild(btn);
        return th;
      })));
      var tbody = h('tbody', { 'data-cascade': '' });
      if (!tranche.length) {
        tbody.appendChild(h('tr', { class: 'vide-tableau' }, h('td', { colspan: String(COLONNES.length) }, etatVide('Aucun audit ne correspond', 'Modifiez la recherche ou les filtres pour retrouver des audits.', null))));
      }
      tranche.forEach(function (a) {
        var lien = h('a', { href: '#/audit/' + a.id, text: a.nom });
        var tr = h('tr', {}, [
          h('td', { class: 'mono', text: a.id }),
          h('td', {}, h('span', { class: 'cellule-principale' }, [lien, h('span', { class: 'cellule-secondaire', text: a.site + ' · ' + F.utilisateur(a.responsable).nom })])),
          h('td', {}, badgeType(a.type)),
          h('td', {}, badgeReferentiel(a.referentiel)),
          h('td', {}, [F.fr(a.debut), h('span', { class: 'cellule-secondaire', text: ' → ' + F.fr(a.fin) })]),
          h('td', {}, badgeStatutAudit(a.statut)),
          h('td', {}, h('span', { class: 'cellule-progression' }, [barre(a.progression, a.statut === 'Reporté' ? 'corail' : a.statut === 'Clos' ? 'vert' : null), h('span', { text: a.progression + ' %' })])),
          h('td', { class: 'num' }, a.nbConstats ? [String(a.nbConstats), ' ', a.criticite !== 'Observation' ? h('span', { class: 'sr-only', text: ', criticité ' + a.criticite }) : null] : h('span', { class: 'cellule-secondaire', text: '—' })),
        ]);
        tr.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          location.hash = '#/audit/' + a.id;
        });
        tbody.appendChild(tr);
      });
      var table = h('table', { class: 'tableau' }, [h('caption', { class: 'sr-only', text: 'Liste des audits, triée par ' + COLONNES.filter(function (c) { return c.cle === L.tri.cle; })[0].libelle.toLowerCase() }), thead, tbody]);
      enveloppe.innerHTML = '';
      enveloppe.appendChild(table);
      cascade(enveloppe);
      Array.prototype.forEach.call(enveloppe.querySelectorAll('.barre'), function (b) { requestAnimationFrame(function () { b.classList.add('anime'); }); });
      /* Pagination */
      pagination.innerHTML = '';
      pagination.appendChild(h('span', { class: 'pagination__info', text: res.length ? 'Audits ' + (debut + 1) + ' à ' + Math.min(debut + PAR_PAGE, res.length) + ' sur ' + res.length : 'Aucun résultat' }));
      var pagesEl = h('div', { class: 'pagination__pages' });
      var prec = h('button', { type: 'button', class: 'pagination__page', 'aria-label': 'Page précédente', disabled: L.page === 1 }, icone('i-chevron-g'));
      prec.addEventListener('click', function () { L.page -= 1; rendreTable(); });
      pagesEl.appendChild(prec);
      for (var p = 1; p <= pages; p++) {
        (function (num) {
          var b = h('button', { type: 'button', class: 'pagination__page', 'aria-label': 'Page ' + num, 'aria-current': num === L.page ? 'page' : null, text: String(num) });
          b.addEventListener('click', function () { L.page = num; rendreTable(); });
          pagesEl.appendChild(b);
        })(p);
      }
      var suiv = h('button', { type: 'button', class: 'pagination__page', 'aria-label': 'Page suivante', disabled: L.page === pages }, icone('i-chevron-d'));
      suiv.addEventListener('click', function () { L.page += 1; rendreTable(); });
      pagesEl.appendChild(suiv);
      pagination.appendChild(pagesEl);
    }
    rendreTable();
    racineEcran.appendChild(h('div', { 'data-cascade': '' }, [
      carte({ claire: true, survol: false }, [outils, h('div', { class: 'outils' }, chips), enveloppe, pagination]),
    ]));
    return racineEcran;
  }

  /* ====================================================================== Écran 3 : Fiche d'audit */
  function onglets(definition, actif, onChange) {
    var liste = h('div', { class: 'onglets', role: 'tablist', 'aria-label': 'Sections de la fiche' });
    var indicateur = h('span', { class: 'onglets__indicateur', 'aria-hidden': 'true' });
    var panneaux = h('div');
    var boutons = [];
    definition.forEach(function (d) {
      var idOnglet = uid('onglet'), idPanneau = uid('panneau');
      var b = h('button', { type: 'button', class: 'onglet', role: 'tab', id: idOnglet, 'aria-controls': idPanneau, 'aria-selected': String(d.cle === actif), tabindex: d.cle === actif ? '0' : '-1' }, [d.libelle, d.compte !== undefined ? h('span', { class: 'onglet__compte', text: String(d.compte) }) : null]);
      var p = h('div', { class: 'panneau', role: 'tabpanel', id: idPanneau, 'aria-labelledby': idOnglet, tabindex: '0', hidden: d.cle !== actif });
      if (d.cle === actif) p.appendChild(d.rendu());
      b.addEventListener('click', function () { activer(d.cle); });
      b.addEventListener('keydown', function (e) {
        var i = boutons.indexOf(b), cible = null;
        if (e.key === 'ArrowRight') cible = boutons[(i + 1) % boutons.length];
        if (e.key === 'ArrowLeft') cible = boutons[(i - 1 + boutons.length) % boutons.length];
        if (e.key === 'Home') cible = boutons[0];
        if (e.key === 'End') cible = boutons[boutons.length - 1];
        if (cible) { e.preventDefault(); cible.focus(); cible.click(); }
      });
      boutons.push(b);
      liste.appendChild(b);
      panneaux.appendChild(p);
      d._bouton = b; d._panneau = p;
    });
    liste.appendChild(indicateur);
    function placer() {
      var b = boutons.filter(function (x) { return x.getAttribute('aria-selected') === 'true'; })[0];
      if (!b) return;
      indicateur.style.setProperty('--x', b.offsetLeft + 'px');
      indicateur.style.setProperty('--s', String(b.offsetWidth / 100));
    }
    function activer(cle) {
      definition.forEach(function (d) {
        var on = d.cle === cle;
        d._bouton.setAttribute('aria-selected', String(on));
        d._bouton.setAttribute('tabindex', on ? '0' : '-1');
        if (on && !d._panneau.hasChildNodes()) d._panneau.appendChild(d.rendu());
        if (on) {
          d._panneau.hidden = false;
          d._panneau.classList.remove('panneau');
          void d._panneau.offsetWidth;
          d._panneau.classList.add('panneau');
          cascade(d._panneau);
          observer(d._panneau);
          Array.prototype.forEach.call(d._panneau.querySelectorAll('.barre'), function (bb) { requestAnimationFrame(function () { bb.classList.add('anime'); }); });
        } else d._panneau.hidden = true;
      });
      placer();
      if (onChange) onChange(cle);
    }
    apresMontage.push(function () {
      placer();
      var d0 = definition.filter(function (d) { return d.cle === actif; })[0];
      if (d0) Array.prototype.forEach.call(d0._panneau.querySelectorAll('.barre'), function (bb) { requestAnimationFrame(function () { bb.classList.add('anime'); }); });
    });
    window.addEventListener('resize', placer);
    return h('div', {}, [liste, panneaux]);
  }
  function ecranFiche(id) {
    var a = F.audit(id);
    var racineEcran = h('div', { 'data-cascade': '' });
    if (!a) {
      racineEcran.appendChild(carte({ claire: true }, etatVide('Audit introuvable', 'L’identifiant « ' + id + ' » ne correspond à aucun audit du cycle.', h('a', { class: 'bouton bouton--primaire', href: '#/audits', text: 'Retour à la liste' }))));
      return racineEcran;
    }
    var constats = F.constatsDe(a.id), actions = F.actionsDe(a.id), historique = F.historiqueAudit(a);
    racineEcran.appendChild(h('a', { class: 'retour', href: '#/audits' }, [icone('i-fleche-g'), 'Retour aux audits']));
    racineEcran.appendChild(carte({ classe: 'a-observer', survol: false }, [
      h('div', { class: 'fiche-entete' }, [
        h('div', {}, [
          h('div', { class: 'fiche-entete__badges' }, [badgeStatutAudit(a.statut), badgeType(a.type), badgeReferentiel(a.referentiel), a.nbConstats ? badgeCriticite(a.criticite) : null]),
          h('h1', { class: 'fiche-entete__titre', text: a.nom }),
          h('p', { class: 'ecran__contexte', text: a.id + ' · ' + a.perimetre }),
          h('div', { class: 'fiche-entete__meta' }, [
            h('div', { class: 'meta' }, [h('span', { class: 'legende', text: 'Responsable' }), personne(a.responsable)]),
            h('div', { class: 'meta' }, [h('span', { class: 'legende', text: 'Auditeur' }), h('span', { class: 'meta__valeur' }, [icone('i-utilisateur'), a.auditeur])]),
            h('div', { class: 'meta' }, [h('span', { class: 'legende', text: 'Site' }), h('span', { class: 'meta__valeur' }, [icone('i-site'), a.site])]),
            h('div', { class: 'meta' }, [h('span', { class: 'legende', text: 'Dates' }), h('span', { class: 'meta__valeur' }, [icone('i-calendrier'), F.fr(a.debut) + ' → ' + F.fr(a.fin)])]),
          ]),
        ]),
        h('div', { class: 'jauge' }, [jaugePointillee(a.progression, 100, { unite: '%', label: 'Progression de l’audit' }), h('p', { class: 'legende', text: 'Progression' })]),
      ]),
    ]));

    function renduSynthese() {
      var parType = F.compterPar(constats, 'type');
      var typesPresents = F.vocabulaire.typesConstat.filter(function (t) { return parType[t]; });
      return h('div', { class: 'synthese' }, [
        h('div', { class: 'synthese__bloc' }, [
          h('h3', { class: 'legende', text: 'Description' }),
          h('p', { class: 'synthese__texte', text: a.description }),
          h('div', { class: 'synthese__chiffres a-observer' }, [
            h('div', { class: 'chiffre' }, [h('div', { class: 'chiffre__valeur', 'data-compteur': String(constats.length), text: '0' }), h('div', { class: 'legende chiffre__legende', text: 'Constats' })]),
            h('div', { class: 'chiffre' }, [h('div', { class: 'chiffre__valeur', 'data-compteur': String(constats.filter(function (c) { return c.type.indexOf('NC') === 0; }).length), text: '0' }), h('div', { class: 'legende chiffre__legende', text: 'Non-conformités' })]),
            h('div', { class: 'chiffre' }, [h('div', { class: 'chiffre__valeur', 'data-compteur': String(actions.length), text: '0' }), h('div', { class: 'legende chiffre__legende', text: 'Actions' })]),
          ]),
        ]),
        h('div', { class: 'synthese__bloc' }, [
          h('h3', { class: 'legende', text: 'Répartition des constats' }),
          typesPresents.length ? h('div', { class: 'barres-h' }, typesPresents.map(function (t, i) {
            var teinte = t === 'NC majeure' ? 'corail' : t === 'NC mineure' ? 'or' : t === 'Point sensible' ? 'violet' : null;
            return h('div', { class: 'barres-h__ligne' }, [h('span', { class: 'libelle', text: t }), barre((parType[t] / constats.length) * 100, teinte, false, i), h('span', { class: 'valeur', text: String(parType[t]) })]);
          })) : h('p', { class: 'synthese__texte', text: 'Aucun constat pour le moment : l’audit n’a pas encore produit de rapport.' }),
          h('h3', { class: 'legende mt-5', text: 'Prochaine étape' }),
          h('p', { class: 'synthese__texte', text: a.statut === 'En cours' ? 'Réunion de clôture le ' + F.frLong(a.fin) + ', puis réception du rapport sous 12 jours.' : a.statut === 'Clos' ? 'Audit clos ; le plan d’actions est suivi dans l’onglet dédié.' : 'Réunion d’ouverture le ' + F.frLong(a.debut) + '.' }),
        ]),
      ]);
    }
    function renduConstats() {
      if (!constats.length) return etatVide('Aucun constat', 'Les constats apparaîtront après la réunion de clôture.');
      return h('div', { 'data-cascade': '' }, constats.map(function (c) {
        return h('article', { class: 'constat' }, [
          h('span', { class: 'constat__ref', text: c.ref }),
          h('div', {}, [
            h('p', { class: 'constat__titre', text: c.titre }),
            h('p', { class: 'constat__desc', text: c.description }),
            h('div', { class: 'constat__meta' }, [badge(c.type, c.type.indexOf('NC') === 0 ? 'corail' : 'gris'), badge(c.statut, TEINTES.statutConstat[c.statut]), h('span', {}, [icone('i-calendrier', 'icone--sm'), ' Échéance ' + F.fr(c.echeance)]), h('span', {}, [avatar(c.responsable), ' ', F.utilisateur(c.responsable).nom])]),
          ]),
          h('div', { class: 'constat__droite' }, [badgeCriticite(c.criticite), h('span', { class: 'cellule-secondaire', text: c.id })]),
        ]);
      }));
    }
    function renduActions() {
      if (!actions.length) return etatVide('Aucune action', 'Le plan d’actions sera arbitré à réception du rapport.');
      return h('div', { 'data-cascade': '' }, actions.map(function (ac, i) {
        var retard = ac.statut !== 'Terminée' && F.daysUntil(ac.echeance) < 0;
        return h('article', { class: 'action' }, [
          h('div', {}, [
            h('p', { class: 'action__titre', text: ac.titre }),
            h('div', { class: 'action__meta' }, [h('span', { class: 'priorite priorite--' + ac.priorite, text: ac.priorite }), badge(ac.statut, TEINTES.statutAction[ac.statut]), h('span', { class: retard ? 'echeance echeance--depassee' : 'echeance echeance--ok' }, [icone(retard ? 'i-alerte' : 'i-calendrier'), (retard ? 'En retard · ' : 'Échéance ') + F.fr(ac.echeance)]), h('span', { text: ac.charge + ' · ' + ac.constatId })]),
          ]),
          h('div', { class: 'action__progression' }, [barre(ac.avancement, ac.statut === 'Bloquée' ? 'corail' : ac.statut === 'Terminée' ? 'vert' : null, false, i), h('span', { text: ac.avancement + ' %' })]),
          personne(ac.responsable),
        ]);
      }));
    }
    function renduHistorique() {
      return h('ol', { class: 'chrono', 'data-cascade': '' }, historique.map(function (it) {
        var futur = it.quand > F.aujourdhui;
        return h('li', { class: 'chrono__item' + (futur ? ' chrono__item--futur' : '') }, [
          h('div', { class: 'chrono__date', text: F.frLong(it.quand) + (futur ? ' · à venir' : '') }),
          h('div', { class: 'chrono__texte', text: it.quoi }),
          h('div', { class: 'chrono__qui' }, [avatar(it.qui), F.utilisateur(it.qui).nom + ' · ' + F.utilisateur(it.qui).role]),
        ]);
      }));
    }
    racineEcran.appendChild(carte({ claire: true, survol: false }, onglets([
      { cle: 'synthese', libelle: 'Synthèse', rendu: renduSynthese },
      { cle: 'constats', libelle: 'Constats', compte: constats.length, rendu: renduConstats },
      { cle: 'actions', libelle: 'Plan d’actions', compte: actions.length, rendu: renduActions },
      { cle: 'historique', libelle: 'Historique', rendu: renduHistorique },
    ], etat.fiche.onglet, function (cle) { etat.fiche.onglet = cle; })));
    return racineEcran;
  }

  /* ====================================================================== Écran 4 : Formulaire */
  function ecranFormulaire() {
    var racineEcran = h('div', { 'data-cascade': '' });
    racineEcran.appendChild(enteteEcran('Nouvel audit', 'Les champs marqués d’un astérisque sont obligatoires.'));
    var zoneBandeau = h('div', { 'aria-live': 'polite' });
    var champs = {};
    function champ(def) {
      var id = uid('champ'), idAide = id + '-aide', idErreur = id + '-erreur';
      var controle;
      if (def.type === 'select') controle = h('select', { id: id, name: def.nom }, [h('option', { value: '', text: 'Sélectionner…' })].concat(def.options.map(function (o) { return h('option', { value: o.valeur, text: o.libelle }); })));
      else if (def.type === 'textarea') controle = h('textarea', { id: id, name: def.nom, placeholder: def.placeholder || null, maxlength: def.max ? String(def.max) : null });
      else controle = h('input', { id: id, name: def.nom, type: def.type || 'text', placeholder: def.placeholder || null });
      controle.setAttribute('aria-describedby', (def.aide ? idAide + ' ' : '') + idErreur);
      if (def.requis) controle.setAttribute('aria-required', 'true');
      var erreur = h('p', { class: 'champ__erreur', id: idErreur, 'aria-live': 'polite' });
      var enveloppe = h('div', { class: 'champ' + (def.large ? ' champ--large' : '') }, [
        h('label', { class: 'champ__libelle', for: id }, [def.libelle, def.requis ? h('span', { class: 'champ__obligatoire', 'aria-hidden': 'true', text: ' *' }) : null, def.requis ? h('span', { class: 'sr-only', text: ' (obligatoire)' }) : null]),
        def.aide ? h('p', { class: 'champ__aide', id: idAide, text: def.aide }) : null,
        controle,
        erreur,
      ]);
      var obj = { def: def, controle: controle, erreur: erreur, enveloppe: enveloppe };
      champs[def.nom] = obj;
      controle.addEventListener('blur', function () { valider(obj); });
      controle.addEventListener('input', function () { if (obj.enErreur) valider(obj); });
      controle.addEventListener('change', function () { if (obj.enErreur) valider(obj); });
      return enveloppe;
    }
    function messageErreur(obj) {
      var v = obj.controle.value.trim();
      var d = obj.def;
      if (d.requis && !v) return d.type === 'select' ? 'Choisissez une valeur.' : 'Ce champ est obligatoire.';
      if (d.min && v.length < d.min) return 'Saisissez au moins ' + d.min + ' caractères.';
      if (d.nom === 'fin' && v && champs.debut.controle.value && v < champs.debut.controle.value) return 'La date de fin doit être postérieure ou égale au début.';
      if (d.nom === 'debut' && v && v < '2025-01-01') return 'Le cycle de certification commence en 2025.';
      return '';
    }
    function valider(obj) {
      var msg = messageErreur(obj);
      obj.enErreur = Boolean(msg);
      obj.controle.setAttribute('aria-invalid', msg ? 'true' : 'false');
      obj.erreur.innerHTML = '';
      if (msg) { obj.erreur.appendChild(icone('i-erreur', 'icone--sm')); obj.erreur.appendChild(document.createTextNode(msg)); obj.erreur.classList.add('visible'); }
      else obj.erreur.classList.remove('visible');
      if (obj.def.nom === 'debut' && champs.fin.enErreur) valider(champs.fin);
      return !msg;
    }
    var optionsUtilisateurs = F.utilisateurs.map(function (u) { return { valeur: u.id, libelle: u.nom + ' — ' + u.role }; });
    var soumettre = h('button', { type: 'submit', class: 'bouton bouton--primaire' }, [icone('i-ok'), 'Enregistrer l’audit']);
    var annuler = h('a', { class: 'bouton bouton--discret', href: '#/audits', text: 'Annuler' });
    var form = h('form', { class: 'formulaire', novalidate: true, 'aria-describedby': null }, [
      h('h2', { class: 'legende formulaire__section', text: 'Identification' }),
      champ({ nom: 'nom', libelle: 'Intitulé de l’audit', requis: true, min: 5, placeholder: 'Ex. : Audit interne — gestion des accès', aide: 'Nom affiché dans la liste et les rapports.' }),
      champ({ nom: 'type', libelle: 'Type d’audit', type: 'select', requis: true, options: F.vocabulaire.typesAudit.map(function (t) { return { valeur: t, libelle: t }; }) }),
      champ({ nom: 'referentiel', libelle: 'Référentiel', type: 'select', requis: true, options: F.referentiels.map(function (r) { return { valeur: r.id, libelle: r.libelle }; }), aide: 'Référentiel principal évalué.' }),
      champ({ nom: 'site', libelle: 'Site audité', type: 'select', requis: true, options: F.sites.map(function (st) { return { valeur: st, libelle: st }; }) }),
      h('h2', { class: 'legende formulaire__section', text: 'Organisation' }),
      champ({ nom: 'responsable', libelle: 'Responsable interne', type: 'select', requis: true, options: optionsUtilisateurs, aide: 'Pilote le suivi des constats et du plan d’actions.' }),
      champ({ nom: 'auditeur', libelle: 'Auditeur', placeholder: 'Nom ou organisme (laisser vide si non désigné)', aide: 'Organisme certificateur ou auditeur interne.' }),
      champ({ nom: 'debut', libelle: 'Date de début', type: 'date', requis: true }),
      champ({ nom: 'fin', libelle: 'Date de fin', type: 'date', requis: true, aide: 'Égale ou postérieure à la date de début.' }),
      h('h2', { class: 'legende formulaire__section', text: 'Périmètre' }),
      champ({ nom: 'perimetre', libelle: 'Périmètre', type: 'select', options: ['Périmètre complet du SMSI', 'Hébergement des données de santé', 'Infrastructure et exploitation', 'Processus métier et support', 'Fournisseurs critiques'].map(function (p) { return { valeur: p, libelle: p }; }), large: true }),
      champ({ nom: 'description', libelle: 'Description', type: 'textarea', large: true, max: 300, placeholder: 'Objectifs, mesures évaluées, points d’attention…', aide: '300 caractères maximum.' }),
      h('div', { class: 'formulaire__actions' }, [annuler, soumettre]),
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      zoneBandeau.innerHTML = '';
      var invalides = Object.keys(champs).map(function (k) { return champs[k]; }).filter(function (o) { return !valider(o); });
      if (invalides.length) {
        var bandeau = h('div', { class: 'bandeau bandeau--erreur', role: 'alert', tabindex: '-1' }, [icone('i-erreur'), h('div', {}, [
          h('strong', { text: invalides.length + (invalides.length > 1 ? ' champs comportent des erreurs.' : ' champ comporte une erreur.') }),
          h('ul', {}, invalides.map(function (o) {
            var lien = h('a', { href: '#' + o.controle.id, text: o.def.libelle + ' : ' + messageErreur(o) });
            lien.addEventListener('click', function (ev) { ev.preventDefault(); o.controle.focus(); });
            return h('li', {}, lien);
          })),
        ])]);
        zoneBandeau.appendChild(bandeau);
        invalides[0].controle.focus();
        toast('erreur', 'Formulaire incomplet', 'Corrigez les champs signalés avant d’enregistrer.');
        return;
      }
      soumettre.disabled = true;
      soumettre.setAttribute('aria-busy', 'true');
      soumettre.textContent = 'Enregistrement…';
      setTimeout(function () {
        soumettre.disabled = false;
        soumettre.removeAttribute('aria-busy');
        soumettre.innerHTML = '';
        soumettre.appendChild(icone('i-ok'));
        soumettre.appendChild(document.createTextNode('Enregistrer l’audit'));
        var nom = champs.nom.controle.value.trim();
        zoneBandeau.appendChild(h('div', { class: 'bandeau bandeau--succes', role: 'status' }, [icone('i-ok-cercle'), h('div', {}, [
          h('strong', { text: 'Audit « ' + nom + ' » enregistré (simulation).' }),
          h('div', {}, ['Il apparaîtrait dans la liste avec le statut « Planifié ». ', h('a', { href: '#/audits', text: 'Voir la liste des audits' }), '.']),
        ])]));
        toast('succes', 'Audit enregistré', nom);
        form.reset();
        Object.keys(champs).forEach(function (k) { champs[k].controle.setAttribute('aria-invalid', 'false'); });
        zoneBandeau.firstChild.scrollIntoView({ block: 'nearest', behavior: anim() ? 'smooth' : 'auto' });
      }, 1200);
    });
    racineEcran.appendChild(carte({ claire: true, survol: false }, [zoneBandeau, form]));
    return racineEcran;
  }

  /* ====================================================================== Écran 5 : RETEX */
  function ecranRetex() {
    var inc = F.incidents[0];
    var evts = inc.evenements;
    var n = evts.length;
    var racineEcran = h('div', { 'data-cascade': '' });
    racineEcran.appendChild(enteteEcran('Retour d’expérience', 'Incident ' + inc.id + ' · piloté par ' + F.utilisateur(inc.pilote).nom));
    racineEcran.appendChild(carte({ classe: 'a-observer', survol: false }, [
      h('div', { class: 'retex-entete' }, [
        h('div', {}, [
          h('div', { class: 'fiche-entete__badges' }, [badge(inc.id, 'violet'), badge('Gravité maximale : ' + F.vocabulaire.gravitesRetex[inc.graviteMax], 'corail', 'i-flamme'), badge('Clos', 'vert')]),
          h('h2', { class: 'retex-entete__titre', text: inc.titre }),
          h('p', { class: 'retex-entete__impact', text: inc.impact }),
        ]),
        h('div', { class: 'retex-entete__chiffres' }, [
          h('div', { class: 'retex-chiffre' }, [h('div', { class: 'retex-chiffre__valeur' }, [h('span', { 'data-compteur': String(dureeHeures(inc.debut, inc.fin)), text: '0' }), h('span', { class: 'kpi__unite', text: ' h' })]), h('p', { class: 'legende', text: 'Durée totale' })]),
          h('div', { class: 'retex-chiffre' }, [h('div', { class: 'retex-chiffre__valeur', 'data-compteur': String(n), text: '0' }), h('p', { class: 'legende', text: 'Événements' })]),
          h('div', { class: 'retex-chiffre' }, [h('div', { class: 'retex-chiffre__valeur', 'data-compteur': String(inc.enseignements.length), text: '0' }), h('p', { class: 'legende', text: 'Enseignements' })]),
        ]),
      ]),
    ]));

    /* Graphique façon cotation */
    var L = 900, H = 320, mG = 64, mD = 36, mT = 30, mB = 48;
    function px(i) { return mG + ((L - mG - mD) * i) / (n - 1); }
    function py(g) { return mT + (H - mT - mB) * (1 - g / 4); }
    var svg = s('svg', { class: 'retex-graph__svg', viewBox: '0 0 ' + L + ' ' + H, role: 'application', tabindex: '0', 'aria-label': 'Chronologie de l’incident : ' + n + ' événements. Flèches gauche et droite pour parcourir, Origine et Fin pour les extrémités.' });
    var defs = s('defs');
    defs.appendChild(degrade('retex-degrade', '#2EC4B6', '#8F7BFF'));
    defs.appendChild(degradeAire('retex-aire', '#8F7BFF'));
    svg.appendChild(defs);
    for (var g = 0; g <= 4; g++) {
      svg.appendChild(s('line', { class: 'g-grille-retex' + (g === 0 ? ' g-grille-retex--forte' : ''), x1: mG, x2: L - mD, y1: py(g), y2: py(g) }));
      svg.appendChild(s('text', { class: 'g-etiquette-y', x: mG - 10, y: py(g) + 3, 'text-anchor': 'end', text: F.vocabulaire.gravitesRetex[g] }));
    }
    for (var i = 0; i < n; i++) {
      svg.appendChild(s('line', { class: 'g-grille-retex', x1: px(i), x2: px(i), y1: mT - 6, y2: H - mB }));
      svg.appendChild(s('text', { class: 'g-etiquette-x', x: px(i), y: H - mB + 18, 'text-anchor': 'middle', text: heureCourte(evts[i].h).split(' ')[1] }));
      if (i === 0 || evts[i].h.slice(0, 10) !== evts[i - 1].h.slice(0, 10)) svg.appendChild(s('text', { class: 'g-etiquette-x', x: px(i), y: H - mB + 32, 'text-anchor': 'start', text: F.fr(evts[i].h.slice(0, 10)) }));
    }
    var aire = s('path', { class: 'g-aire-retex', d: '' });
    svg.appendChild(aire);
    var segments = [], points = [];
    for (var k = 0; k < n - 1; k++) {
      var seg = s('path', { class: 'g-segment', d: 'M' + px(k) + ' ' + py(evts[k].gravite) + ' L' + px(k + 1) + ' ' + py(evts[k + 1].gravite) });
      var longueur = Math.hypot(px(k + 1) - px(k), py(evts[k + 1].gravite) - py(evts[k].gravite));
      seg.style.setProperty('--long', String(Math.ceil(longueur) + 2));
      svg.appendChild(seg);
      segments.push(seg);
    }
    evts.forEach(function (ev, idx) {
      var couleur = ['#8E9AB8', '#2FD37A', '#4C8DFF', '#F2A33A', '#F0564A'][ev.gravite];
      var grp = s('g', { class: 'g-evt', tabindex: '-1', role: 'button', 'aria-label': heureCourte(ev.h) + ' — ' + ev.titre });
      grp.appendChild(s('circle', { class: 'g-evt__halo', cx: px(idx), cy: py(ev.gravite), r: 9, fill: couleur }));
      grp.appendChild(s('circle', { class: 'g-evt__coeur', cx: px(idx), cy: py(ev.gravite), r: 6, fill: couleur }));
      grp.addEventListener('click', function () { aller(idx); });
      attacherInfobulle(grp, function () { return contenuBulle(heureCourte(ev.h) + ' · ' + ev.type, ev.titre); });
      svg.appendChild(grp);
      points.push(grp);
    });

    var bulle = h('div', { class: 'retex-bulle', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var graph = h('div', { class: 'retex-graph' }, [svg, bulle]);
    var liste = h('div', { class: 'retex-liste' });
    var progression = barre(0, null, false, 0);
    var compteProgression = h('span', { text: '0 / ' + n });
    var btnPrec = h('button', { type: 'button', class: 'bouton' }, [icone('i-chevron-g'), 'Point précédent']);
    var btnSuiv = h('button', { type: 'button', class: 'bouton bouton--primaire' }, [icone('i-lecture'), 'Point suivant']);
    var btnTout = h('button', { type: 'button', class: 'bouton bouton--violet' }, [icone('i-fin'), 'Tout dérouler']);
    var btnReinit = h('button', { type: 'button', class: 'bouton bouton--discret' }, [icone('i-recommencer'), 'Recommencer']);
    var lecture = null;

    function cheminAire(jusqua) {
      if (jusqua < 0) return '';
      var d = 'M' + px(0) + ' ' + (H - mB);
      for (var j = 0; j <= jusqua; j++) d += ' L' + px(j) + ' ' + py(evts[j].gravite);
      return d + ' L' + px(jusqua) + ' ' + (H - mB) + ' Z';
    }
    function ouvrirBulle(idx) {
      var ev = evts[idx];
      bulle.innerHTML = '';
      bulle.classList.remove('ouverte', 'retex-bulle--gauche', 'retex-bulle--haut', 'retex-bulle--bas');
      if (ev.gravite <= 1) bulle.classList.add('retex-bulle--haut');
      else if (ev.gravite >= 4) bulle.classList.add('retex-bulle--bas');
      bulle.style.setProperty('--x', ((px(idx) / L) * 100).toFixed(2) + '%');
      bulle.style.setProperty('--y', ((py(ev.gravite) / H) * 100).toFixed(2) + '%');
      if (px(idx) > L * 0.6) bulle.classList.add('retex-bulle--gauche');
      bulle.appendChild(h('span', { class: 'retex-bulle__anneau', 'aria-hidden': 'true' }));
      bulle.appendChild(h('span', { class: 'retex-bulle__trait', 'aria-hidden': 'true' }));
      bulle.appendChild(h('div', { class: 'retex-bulle__carte' }, [
        h('div', { class: 'retex-bulle__entete' }, [badge(ev.type, 'sarcelle'), h('span', { class: 'retex-bulle__heure', text: heureCourte(ev.h) })]),
        h('p', { class: 'retex-bulle__titre', text: (idx + 1) + '. ' + ev.titre }),
        h('p', { class: 'retex-bulle__detail', text: ev.detail }),
        h('div', { class: 'retex-bulle__acteur' }, [avatar(ev.acteur), F.utilisateur(ev.acteur).nom + ' · ' + F.utilisateur(ev.acteur).role, ' · ', gravite(ev.gravite)]),
      ]));
      void bulle.offsetWidth;
      bulle.classList.add('ouverte');
    }
    function rendreListe(actif) {
      liste.innerHTML = '';
      if (actif < 0) {
        liste.appendChild(h('p', { class: 'synthese__texte', text: 'Utilisez « Point suivant » ou les flèches du clavier sur le graphique pour dérouler la chronologie.' }));
        return;
      }
      for (var j = 0; j <= actif; j++) {
        (function (idx) {
          var ev = evts[idx];
          var item = h('article', { class: 'retex-evt', 'aria-current': idx === actif ? 'true' : null, tabindex: '0', role: 'button', 'aria-label': 'Afficher le point ' + (idx + 1) });
          item.appendChild(h('span', { class: 'retex-evt__index', 'aria-hidden': 'true', text: String(idx + 1) }));
          item.appendChild(h('div', {}, [
            h('div', { class: 'retex-evt__heure', text: heureCourte(ev.h) + ' · ' + ev.type }),
            h('p', { class: 'retex-evt__titre', text: ev.titre }),
            h('div', { class: 'retex-evt__pied' }, [gravite(ev.gravite), h('span', {}, [avatar(ev.acteur), ' ', F.utilisateur(ev.acteur).nom])]),
          ]));
          item.addEventListener('click', function () { aller(idx); });
          item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aller(idx); } });
          liste.appendChild(item);
        })(j);
      }
    }
    function appliquer(actif) {
      etat.retex.actif = actif;
      points.forEach(function (p, idx) {
        p.classList.toggle('visible', idx <= actif);
        p.classList.toggle('actif', idx === actif);
        p.setAttribute('tabindex', idx <= actif ? '0' : '-1');
      });
      segments.forEach(function (sg, idx) { sg.classList.toggle('trace', idx < actif); });
      aire.setAttribute('d', cheminAire(actif));
      aire.classList.toggle('visible', actif >= 0);
      if (actif >= 0) ouvrirBulle(actif); else { bulle.innerHTML = ''; bulle.classList.remove('ouverte'); }
      rendreListe(actif);
      var frac = ((actif + 1) / n) * 100;
      progression.querySelector('.barre__remplissage').style.setProperty('--valeur', String(frac / 100));
      progression.setAttribute('aria-valuenow', String(Math.round(frac)));
      compteProgression.textContent = (actif + 1) + ' / ' + n;
      btnPrec.disabled = actif < 0;
      btnSuiv.disabled = actif >= n - 1;
      btnTout.disabled = actif >= n - 1;
    }
    function aller(idx) {
      if (lecture) { clearInterval(lecture); lecture = null; }
      appliquer(Math.max(-1, Math.min(n - 1, idx)));
    }
    function toutDerouler() {
      if (lecture) return;
      if (!anim()) { aller(n - 1); return; }
      lecture = setInterval(function () {
        if (etat.retex.actif >= n - 1) { clearInterval(lecture); lecture = null; return; }
        appliquer(etat.retex.actif + 1);
      }, 260);
    }
    btnPrec.addEventListener('click', function () { aller(etat.retex.actif - 1); });
    btnSuiv.addEventListener('click', function () { aller(etat.retex.actif + 1); });
    btnTout.addEventListener('click', toutDerouler);
    btnReinit.addEventListener('click', function () { aller(-1); svg.focus(); });
    svg.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'Enter') { e.preventDefault(); aller(etat.retex.actif + 1); }
      else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); aller(etat.retex.actif - 1); }
      else if (k === 'Home') { e.preventDefault(); aller(-1); }
      else if (k === 'End') { e.preventDefault(); aller(n - 1); }
    });

    racineEcran.appendChild(carte({ titre: 'Chronologie de l’incident', sousTitre: 'Gravité de chaque événement, du ' + heureCourte(inc.debut) + ' au ' + heureCourte(inc.fin), survol: false, classe: 'a-observer' }, [
      graph,
      h('div', { class: 'retex-commandes' }, [btnPrec, btnSuiv, btnTout, btnReinit, h('div', { class: 'retex-commandes__progression' }, [compteProgression, progression])]),
    ]));
    racineEcran.appendChild(h('div', { class: 'grille' }, [
      carte({ claire: true, titre: 'Déroulé', sousTitre: 'Les points apparaissent au fil de la lecture', classe: 'col-8', survol: false }, [liste]),
      carte({ titre: 'Enseignements', sousTitre: 'Issus de la réunion de retour d’expérience', classe: 'col-4', survol: false }, [
        h('ul', { class: 'enseignements' }, inc.enseignements.map(function (e) { return h('li', { class: 'enseignement' }, [icone('i-ok-cercle'), e]); })),
      ]),
    ]));
    apresMontage.push(function () {
      progression.classList.add('anime');
      appliquer(Math.min(etat.retex.actif, n - 1));
      if (etat.retex.actif < 0) {
        setTimeout(function () { if (location.hash.indexOf('#/retex') === 0 && etat.retex.actif < 0) appliquer(0); }, anim() ? 700 : 0);
      }
    });
    return racineEcran;
  }

  /* ====================================================================== Écran 6 : Composants */
  function ecranComposants() {
    var racineEcran = h('div');
    racineEcran.appendChild(enteteEcran('Composants transverses', 'Vocabulaire visuel de la maquette : capsules de verre, badges, boutons, modale, toasts, états.'));
    var grille = h('div', { class: 'grille', 'data-cascade': '' });

    /* Modale */
    var ouvrir = h('button', { type: 'button', class: 'bouton bouton--corail' }, [icone('i-verrou'), 'Clore l’audit AUD-07']);
    ouvrir.addEventListener('click', function () {
      ouvrirModale({ icone: 'i-alerte', titre: 'Clore l’audit AUD-07 ?', texte: 'La clôture fige les constats et notifie les responsables du plan d’actions. Cette action est réversible par le RSSI uniquement.', confirmer: 'Clore l’audit', classeConfirmer: 'bouton--corail',
        onFermer: function (ok) { if (ok) toast('succes', 'Audit AUD-07 clos', 'Les 4 responsables d’actions ont été notifiés.'); else toast('info', 'Clôture annulée', 'Aucune modification n’a été enregistrée.'); } });
    });
    grille.appendChild(carte({ claire: true, titre: 'Modale de confirmation', sousTitre: 'role="dialog", focus piégé, fermeture par Échap ou par le voile', classe: 'col-6' }, [
      h('p', { class: 'synthese__texte', text: 'Les actions irréversibles ou à fort impact demandent une confirmation explicite, avec le bouton d’action coloré selon le risque.' }),
      h('div', { class: 'demo mt-5' }, [ouvrir]),
    ]));

    /* Toasts */
    grille.appendChild(carte({ titre: 'Notifications', sousTitre: 'Zone aria-live, fermeture manuelle ou automatique après 5 s', classe: 'col-6' }, [
      h('div', { class: 'demo' }, [
        h('button', { type: 'button', class: 'bouton bouton--sarcelle', onclick: function () { toast('succes', 'Rapport diffusé', 'Le rapport de l’audit AUD-02 a été envoyé à 6 destinataires.'); } }, [icone('i-ok-cercle'), 'Succès']),
        h('button', { type: 'button', class: 'bouton bouton--or', onclick: function () { toast('alerte', 'Échéance proche', 'C-40 arrive à échéance dans 5 jours.'); } }, [icone('i-alerte'), 'Alerte']),
        h('button', { type: 'button', class: 'bouton bouton--corail', onclick: function () { toast('erreur', 'Export impossible', 'Le service d’export ne répond pas, réessayez dans quelques minutes.'); } }, [icone('i-erreur'), 'Erreur']),
        h('button', { type: 'button', class: 'bouton', onclick: function () { toast('info', 'Revue de direction', 'La prochaine revue est planifiée le 12 décembre 2026.'); } }, [icone('i-info'), 'Information']),
      ]),
    ]));

    /* Badges + simulation */
    var statutsAudit = F.vocabulaire.statutsAudit;
    var indexDemo = 2;
    var badgeDemo = badgeStatutAudit(statutsAudit[indexDemo]);
    var simuler = h('button', { type: 'button', class: 'bouton bouton--sm' }, [icone('i-eclair'), 'Simuler un changement de statut']);
    simuler.addEventListener('click', function () {
      indexDemo = (indexDemo + 1) % statutsAudit.length;
      var suivant = statutsAudit[indexDemo];
      var teinte = TEINTES.statutAudit[suivant];
      function appliquerTexte() {
        badgeDemo.className = 'badge badge--' + teinte + (anim() ? ' badge--bascule' : '');
        badgeDemo.querySelector('.badge__texte').textContent = suivant;
      }
      if (!anim()) { appliquerTexte(); return; }
      badgeDemo.classList.remove('badge--bascule');
      void badgeDemo.offsetWidth;
      badgeDemo.classList.add('badge--bascule');
      setTimeout(appliquerTexte, 150);
      badgeDemo.addEventListener('animationend', function () { badgeDemo.classList.remove('badge--bascule'); }, { once: true });
    });
    grille.appendChild(carte({ titre: 'Badges et statuts', sousTitre: 'Toujours couleur + point ou icône + libellé', classe: 'col-6' }, [
      h('p', { class: 'legende', text: 'Statuts d’audit' }),
      h('div', { class: 'demo my-2-4' }, statutsAudit.map(badgeStatutAudit)),
      h('p', { class: 'legende', text: 'Criticités' }),
      h('div', { class: 'demo my-2-4' }, F.vocabulaire.criticites.map(badgeCriticite)),
      h('p', { class: 'legende', text: 'Transition animée' }),
      h('div', { class: 'demo mt-2' }, [badgeDemo, simuler]),
    ]));

    /* Capsules de verre et interrupteur */
    var valeurVue = 'tableau';
    grille.appendChild(carte({ titre: 'Capsules de verre', sousTitre: 'Pastille de statut et interrupteur segmenté (images 01 et 02)', classe: 'col-6' }, [
      h('div', { class: 'demo demo--colonne' }, [
        h('div', { class: 'pastille pastille--grande' }, [icone('i-ok-cercle'), 'Audit confirmé', h('span', { class: 'point point--gris', 'aria-hidden': 'true' }), h('span', { class: 'pastille__meta', text: 'AUD-07' }), h('span', { class: 'point point--vert', 'aria-hidden': 'true' }), h('span', { class: 'pastille__meta', text: '09:30' })]),
        h('div', { class: 'demo' }, [
          segment([{ valeur: 'tableau', libelle: 'Tableau' }, { valeur: 'cartes', libelle: 'Cartes' }, { valeur: 'planning', libelle: 'Planning' }], valeurVue, function (v) { valeurVue = v; toast('info', 'Vue « ' + v + ' »', 'Interrupteur segmenté : la capsule glisse par transform.'); }),
          h('div', { class: 'pastille' }, [icone('i-horloge'), h('span', { class: 'pastille__texte', text: 'Synchronisé' }), h('span', { class: 'point point--vert', 'aria-hidden': 'true' }), h('span', { class: 'pastille__meta', text: 'il y a 2 min' })]),
        ]),
      ]),
    ]));

    /* Boutons */
    grille.appendChild(carte({ titre: 'Boutons capsule', sousTitre: 'Sarcelle et violet assombris pour un texte blanc AA ; or avec texte marine', classe: 'col-6' }, [
      h('div', { class: 'demo' }, [
        h('button', { type: 'button', class: 'bouton bouton--primaire' }, [icone('i-plus'), 'Primaire']),
        h('button', { type: 'button', class: 'bouton bouton--sarcelle', text: 'Sarcelle' }),
        h('button', { type: 'button', class: 'bouton bouton--violet', text: 'Violet' }),
        h('button', { type: 'button', class: 'bouton bouton--corail', text: 'Corail' }),
        h('button', { type: 'button', class: 'bouton bouton--or', text: 'Or' }),
        h('button', { type: 'button', class: 'bouton', text: 'Verre' }),
        h('button', { type: 'button', class: 'bouton bouton--discret', text: 'Discret' }),
        h('button', { type: 'button', class: 'bouton', disabled: true, text: 'Désactivé' }),
      ]),
      h('p', { class: 'legende mt-5', text: 'Chips de filtre' }),
      h('div', { class: 'chips mt-2' }, ['Tous', 'ISO 27001', 'HDS', 'NIS 2'].map(function (c, i) {
        var chip = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === 1), text: c });
        chip.addEventListener('click', function () { chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true')); });
        return chip;
      })),
    ]));

    /* État vide */
    grille.appendChild(carte({ claire: true, titre: 'État vide', sousTitre: 'Illustration légère, explication, action', classe: 'col-6' }, [
      etatVide('Aucune non-conformité ouverte', 'Toutes les non-conformités de ce périmètre sont closes. Les prochaines apparaîtront après la réunion de clôture du 2 novembre.', h('a', { class: 'bouton bouton--primaire', href: '#/audits', text: 'Voir les audits' })),
    ]));

    /* Squelette */
    var zoneChargement = h('div', {});
    function contenuCharge() {
      var K = F.kpi;
      return h('div', { class: 'grille a-observer', 'data-cascade': '' }, [
        h('div', { class: 'col-6 kpi' }, [h('div', { class: 'kpi__valeur kpi__valeur--sarcelle' }, [h('span', { 'data-compteur': String(K.constatsOuverts), text: '0' })]), h('p', { class: 'legende', text: 'Constats ouverts' })]),
        h('div', { class: 'col-6 kpi' }, [h('div', { class: 'kpi__valeur' }, [h('span', { 'data-compteur': String(K.actionsTerminees), text: '0' })]), h('p', { class: 'legende', text: 'Actions terminées' })]),
      ]);
    }
    var btnCharger = h('button', { type: 'button', class: 'bouton bouton--sm' }, [icone('i-recommencer'), 'Simuler un chargement']);
    btnCharger.addEventListener('click', function () {
      btnCharger.disabled = true;
      zoneChargement.innerHTML = '';
      zoneChargement.appendChild(squelette());
      setTimeout(function () {
        zoneChargement.innerHTML = '';
        var c = contenuCharge();
        zoneChargement.appendChild(c);
        cascade(zoneChargement);
        observer(zoneChargement);
        btnCharger.disabled = false;
      }, anim() ? 1600 : 600);
    });
    zoneChargement.appendChild(contenuCharge());
    grille.appendChild(carte({ titre: 'Chargement', sousTitre: 'Squelette balayé (statique en mouvement réduit), puis contenu en cascade', classe: 'col-6', droite: btnCharger }, [zoneChargement]));

    /* Nuancier */
    var nuances = [
      { role: 'Fond haut', hex: '#1C2B4A' }, { role: 'Fond bas', hex: '#0F1A33' }, { role: 'Sarcelle', hex: '#2EC4B6' }, { role: 'Sarcelle sombre', hex: '#157F76' },
      { role: 'Violet', hex: '#6D5BD0' }, { role: 'Violet lumineux', hex: '#8F7BFF' }, { role: 'Corail', hex: '#F0564A' }, { role: 'Or', hex: '#F2A33A' },
      { role: 'Vert statut', hex: '#2FD37A' }, { role: 'Texte secondaire', hex: '#A9B4D0' }, { role: 'Encre (clair)', hex: '#2B3350' }, { role: 'Signature', hex: 'dégradé' },
    ];
    grille.appendChild(carte({ titre: 'Nuancier', sousTitre: 'Palette transposée des références, ajustée AA', classe: 'col-12' }, [
      h('div', { class: 'nuancier' }, nuances.map(function (nu) {
        return h('div', { class: 'nuance' }, [h('span', { class: 'nuance__couleur' + (nu.hex === 'dégradé' ? ' nuance__couleur--degrade' : ''), 'aria-hidden': 'true', vars: nu.hex === 'dégradé' ? {} : { '--c': nu.hex } }), h('span', { text: nu.role }), h('code', { text: nu.hex })]);
      })),
    ]));

    racineEcran.appendChild(grille);
    return racineEcran;
  }

  /* ====================================================================== Routeur */
  var ROUTES = {
    dashboard: { titre: 'Tableau de bord', rendu: ecranDashboard },
    audits: { titre: 'Audits', rendu: ecranAudits },
    audit: { titre: 'Fiche audit', rendu: ecranFiche },
    formulaire: { titre: 'Nouvel audit', rendu: ecranFormulaire },
    retex: { titre: 'RETEX', rendu: ecranRetex },
    composants: { titre: 'Composants', rendu: ecranComposants },
  };
  function analyserHash() {
    var brut = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = brut.split('/');
    var nom = parts[0] || 'dashboard';
    if (!ROUTES[nom]) nom = 'dashboard';
    return { nom: nom, param: parts[1] || null };
  }
  var navListe = document.getElementById('nav-liste');
  var navIndicateur = navListe.querySelector('.nav__indicateur');
  function placerNav(nom) {
    var liens = navListe.querySelectorAll('a[data-route]');
    var actif = null;
    Array.prototype.forEach.call(liens, function (a) {
      var on = a.dataset.route === nom;
      if (on) { a.setAttribute('aria-current', 'page'); actif = a; } else a.removeAttribute('aria-current');
    });
    if (actif) {
      navIndicateur.style.setProperty('--x', actif.offsetLeft + 'px');
      navIndicateur.style.setProperty('--s', String(actif.offsetWidth / 100));
      navIndicateur.classList.add('est-place');
    }
  }
  window.addEventListener('resize', function () {
    placerNav(analyserHash().nom);
    placerCapsule(segmentAnimations, segmentAnimations.querySelector('.segment__option[aria-pressed="true"]'), '.segment__capsule');
  });

  function rendre(route) {
    cacherInfobulle();
    apresMontage.length = 0;
    vue.innerHTML = '';
    vue.appendChild(ROUTES[route.nom].rendu(route.param));
    cascade(vue);
    apresMontage.splice(0).forEach(function (fn) { fn(); });
    observer(vue);
    document.title = ROUTES[route.nom].titre + ' — Suivi des audits SMSI (maquette F)';
    placerNav(route.nom);
  }
  var premierRendu = true;
  function naviguer() {
    var route = analyserHash();
    var racineOuverte = racineModale.firstChild;
    if (racineOuverte) racineOuverte.remove();
    if (!premierRendu && anim() && typeof document.startViewTransition === 'function') {
      document.startViewTransition(function () { rendre(route); });
    } else {
      rendre(route);
      if (!premierRendu && anim()) {
        vue.classList.remove('vue--entree');
        void vue.offsetWidth;
        vue.classList.add('vue--entree');
      }
    }
    if (!premierRendu) {
      window.scrollTo({ top: 0, behavior: anim() ? 'smooth' : 'auto' });
      contenu.focus({ preventScroll: true });
    }
    premierRendu = false;
  }
  window.addEventListener('hashchange', naviguer);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'route' && typeof d.hash === 'string' && d.hash.indexOf('#/') === 0) location.hash = d.hash;
  });

  /* ====================================================================== En-tête */
  document.getElementById('entete-organisation').textContent = F.organisation.nom + ' · ' + F.organisation.periode;
  document.getElementById('entete-avatar').textContent = F.moi.initiales;
  document.getElementById('entete-nom').textContent = F.moi.nom;
  document.getElementById('entete-role').textContent = F.moi.role;

  if (!location.hash) location.replace('#/dashboard');
  naviguer();
})();
