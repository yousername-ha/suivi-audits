/* Maquette D — « SOC sombre ». Rendu des écrans, graphiques SVG natifs et interactions.
   JS natif, sans module ni dépendance ; données : window.FAKE uniquement (aucune persistance). */
(function () {
  'use strict';
  var F = window.FAKE;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ecranEl = document.getElementById('ecran');
  var mouvementReduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ Utilitaires DOM */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') e.textContent = v;
        else if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v; /* uniquement avec des chaînes construites ici */
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else if (k === 'vars') Object.keys(v).forEach(function (n) { e.style.setProperty(n, v[n]); });
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    ajouter(e, children);
    return e;
  }
  function svg(tag, attrs, children) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') e.textContent = v;
        else if (k === 'class') e.setAttribute('class', v);
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else if (k === 'vars') Object.keys(v).forEach(function (n) { e.style.setProperty(n, v[n]); });
        else e.setAttribute(k, v);
      });
    }
    ajouter(e, children);
    return e;
  }
  function ajouter(parent, children) {
    if (!children) return;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }
  function icone(nom, classe) {
    var s = svg('svg', { class: 'icone' + (classe ? ' ' + classe : ''), 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svg('use', { href: '#i-' + nom }));
    return s;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function fmtPct(n) { return n + ' %'; }
  function pluriel(n, s, p) { return n + ' ' + (n > 1 ? p : s); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function prochainCadre(fn) {
    if (mouvementReduit) { fn(); return; }
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }
  function reveler(racine) {
    var cibles = racine.querySelectorAll('.barre, .colonne, .trace, .point:not(.point--manuel), .segment, .jauge-valeur, .aire');
    Array.prototype.forEach.call(racine.querySelectorAll('.trace, .segment, .jauge-valeur'), function (p) {
      if (p.getTotalLength && (p.classList.contains('trace') || p.classList.contains('jauge-valeur'))) {
        var l = 0;
        try { l = p.getTotalLength(); } catch (err) { l = 0; } /* élément non rendu (display:none) : longueur par défaut */
        if (l > 0) p.style.setProperty('--longueur', l.toFixed(1));
      }
    });
    prochainCadre(function () {
      Array.prototype.forEach.call(cibles, function (c) { c.classList.add('est-visible'); });
    });
  }

  /* ------------------------------------------------------------------ Vocabulaire visuel (couleur + icône + libellé) */
  var STATUT_AUDIT = {
    'Planifié': { ton: 'gris', icone: 'calendrier' },
    'En préparation': { ton: 'bleu', icone: 'formulaire' },
    'En cours': { ton: 'cyan', icone: 'lecture' },
    'Rapport attendu': { ton: 'ambre', icone: 'horloge' },
    'Clos': { ton: 'vert', icone: 'ok' },
    'Reporté': { ton: 'violet', icone: 'pause' },
  };
  var CRITICITE = {
    'Critique': { ton: 'rouge', icone: 'erreur' },
    'Majeure': { ton: 'ambre', icone: 'alerte' },
    'Mineure': { ton: 'bleu', icone: 'info' },
    'Observation': { ton: 'gris', icone: 'point' },
  };
  var STATUT_CONSTAT = {
    'Ouvert': { ton: 'rouge', icone: 'erreur' },
    'En cours': { ton: 'cyan', icone: 'lecture' },
    'À vérifier': { ton: 'ambre', icone: 'cible' },
    'Clos': { ton: 'vert', icone: 'ok' },
  };
  var STATUT_ACTION = {
    'À faire': { ton: 'gris', icone: 'point' },
    'En cours': { ton: 'cyan', icone: 'lecture' },
    'Bloquée': { ton: 'rouge', icone: 'verrou' },
    'Terminée': { ton: 'vert', icone: 'ok' },
  };
  var GRAVITE = [
    { ton: 'gris', icone: 'point', libelle: 'Aucune' },
    { ton: 'vert', icone: 'info', libelle: 'Faible' },
    { ton: 'bleu', icone: 'info', libelle: 'Modérée' },
    { ton: 'ambre', icone: 'alerte', libelle: 'Élevée' },
    { ton: 'rouge', icone: 'erreur', libelle: 'Critique' },
  ];
  var TON_REF = { iso: 'vert', annexeA: 'bleu', hds: 'violet', nis2: 'ambre', rgpd: 'gris' };
  var COULEUR_TON = { cyan: '--cyan', vert: '--vert', ambre: '--ambre', rouge: '--rouge', bleu: '--bleu', violet: '--violet', gris: '--gris' };

  function badge(libelle, def, extra) {
    def = def || { ton: 'gris', icone: 'point' };
    return el('span', { class: 'badge badge--' + def.ton + (extra ? ' ' + extra : '') }, [icone(def.icone), libelle]);
  }
  function badgeRef(id) {
    var r = F.referentiel(id);
    return el('span', { class: 'badge badge--' + (TON_REF[id] || 'gris') + ' badge--mono', title: r.libelle }, [r.court]);
  }
  function avatar(id, grand) {
    var u = F.utilisateur(id);
    return el('span', { class: 'avatar' + (grand ? ' avatar--lg' : ''), title: u.nom + (u.role ? ' — ' + u.role : ''), 'aria-label': u.nom }, [u.initiales]);
  }
  function delai(jours) {
    var classe = jours < 0 ? 'delai--depasse' : jours <= 14 ? 'delai--proche' : '';
    var texte = jours < 0 ? 'Dépassée · J' + jours : jours === 0 ? 'Aujourd’hui' : 'J+' + jours;
    return el('span', { class: 'delai ' + classe }, [icone(jours < 0 ? 'alerte' : jours <= 14 ? 'horloge' : 'calendrier'), texte]);
  }

  /* ------------------------------------------------------------------ Info-bulle */
  var infobulle = document.getElementById('infobulle');
  function montrerInfobulle(e, titre, valeur, sous) {
    vider(infobulle);
    infobulle.appendChild(el('strong', { text: valeur }));
    infobulle.appendChild(document.createTextNode(' ' + titre));
    if (sous) infobulle.appendChild(el('small', { text: sous }));
    infobulle.hidden = false;
    positionnerInfobulle(e);
  }
  function positionnerInfobulle(e) {
    var x, y;
    if (e && typeof e.clientX === 'number' && (e.clientX || e.clientY)) { x = e.clientX; y = e.clientY; }
    else if (e && e.target && e.target.getBoundingClientRect) { var r = e.target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    else return;
    var largeur = infobulle.offsetWidth || 160;
    if (x + largeur + 24 > window.innerWidth) x = x - largeur - 24;
    infobulle.style.setProperty('--x', x);
    infobulle.style.setProperty('--y', y);
  }
  function cacherInfobulle() { infobulle.hidden = true; }
  function avecInfobulle(node, titre, valeur, sous) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', valeur + ' ' + titre + (sous ? ', ' + sous : ''));
    node.addEventListener('mouseenter', function (e) { montrerInfobulle(e, titre, valeur, sous); });
    node.addEventListener('mousemove', positionnerInfobulle);
    node.addEventListener('mouseleave', cacherInfobulle);
    node.addEventListener('focus', function (e) { montrerInfobulle(e, titre, valeur, sous); });
    node.addEventListener('blur', cacherInfobulle);
    return node;
  }

  /* ------------------------------------------------------------------ Toasts */
  var toastsEl = document.getElementById('toasts');
  var TOAST_ICONE = { succes: 'ok', alerte: 'alerte', erreur: 'erreur', info: 'info' };
  function toast(type, titre, texte, duree) {
    var t = el('div', { class: 'toast toast--' + type, role: type === 'erreur' ? 'alert' : 'status' });
    t.appendChild(icone(TOAST_ICONE[type] || 'info', 'toast__icone'));
    t.appendChild(el('div', {}, [el('span', { class: 'toast__titre', text: titre }), texte ? el('span', { class: 'toast__texte', text: texte }) : null]));
    var fermer = el('button', { class: 'bouton bouton--discret bouton--icone bouton--sm', type: 'button', 'aria-label': 'Fermer la notification' }, [icone('fermer')]);
    fermer.addEventListener('click', function () { retirerToast(t); });
    t.appendChild(fermer);
    toastsEl.appendChild(t);
    var minuterie = setTimeout(function () { retirerToast(t); }, duree || 6000);
    t.addEventListener('mouseenter', function () { clearTimeout(minuterie); });
    return t;
  }
  function retirerToast(t) {
    if (!t.parentNode || t.classList.contains('est-sortant')) return;
    if (mouvementReduit) { t.remove(); return; }
    t.classList.add('est-sortant');
    t.addEventListener('animationend', function () { t.remove(); }, { once: true });
  }

  /* ------------------------------------------------------------------ Modale (focus piégé, Échap) */
  var voile = document.getElementById('modale-voile');
  var ouvreur = null;
  function ouvrirModale(options) {
    ouvreur = document.activeElement;
    vider(voile);
    var titreId = 'modale-titre';
    var descId = 'modale-desc';
    var boite = el('div', { class: 'modale', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titreId, 'aria-describedby': descId });
    var fermerBtn = el('button', { class: 'bouton bouton--discret bouton--icone bouton--sm', type: 'button', 'aria-label': 'Fermer la fenêtre' }, [icone('fermer')]);
    fermerBtn.addEventListener('click', fermerModale);
    boite.appendChild(el('div', { class: 'modale__entete' }, [el('h2', { id: titreId }, [icone(options.icone || 'alerte'), options.titre]), fermerBtn]));
    boite.appendChild(el('div', { class: 'modale__corps', id: descId }, options.corps));
    var annuler = el('button', { class: 'bouton', type: 'button', text: options.annuler || 'Annuler' });
    annuler.addEventListener('click', fermerModale);
    var confirmer = el('button', { class: 'bouton ' + (options.danger ? 'bouton--danger' : 'bouton--primaire'), type: 'button', text: options.confirmer || 'Confirmer' });
    confirmer.addEventListener('click', function () { fermerModale(); if (options.onConfirmer) options.onConfirmer(); });
    boite.appendChild(el('div', { class: 'modale__pied' }, [annuler, confirmer]));
    voile.appendChild(boite);
    voile.hidden = false;
    document.body.classList.add('a-modale');
    voile.addEventListener('keydown', toucheModale);
    voile.addEventListener('mousedown', clicVoile);
    annuler.focus();
  }
  function clicVoile(e) { if (e.target === voile) fermerModale(); }
  function toucheModale(e) {
    if (e.key === 'Escape') { e.preventDefault(); fermerModale(); return; }
    if (e.key !== 'Tab') return;
    var focusables = voile.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var premier = focusables[0];
    var dernier = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }
  function fermerModale() {
    if (voile.hidden) return;
    voile.hidden = true;
    voile.removeEventListener('keydown', toucheModale);
    voile.removeEventListener('mousedown', clicVoile);
    document.body.classList.remove('a-modale');
    vider(voile);
    if (ouvreur && ouvreur.focus) ouvreur.focus();
    ouvreur = null;
  }

  /* ------------------------------------------------------------------ Graphiques SVG natifs */
  function couleurSerie(i) { return 'var(--serie-' + ((i % 6) + 1) + ')'; }

  /* Barres horizontales : items = [{libelle, valeur, ton}] */
  function graphiqueBarres(items, options) {
    options = options || {};
    var largeur = options.largeur || 420, hauteurLigne = 26, gauche = options.gauche || 110, droite = 44;
    var hauteur = items.length * hauteurLigne + 8;
    var max = Math.max.apply(null, items.map(function (i) { return i.valeur; })) || 1;
    var g = svg('svg', { class: 'graphique', viewBox: '0 0 ' + largeur + ' ' + hauteur, role: 'group', 'aria-label': options.aria || 'Graphique en barres' });
    var zone = largeur - gauche - droite;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var x = gauche + zone * t;
      g.appendChild(svg('line', { class: 'grille-h', x1: x, y1: 0, x2: x, y2: hauteur - 8 }));
    });
    items.forEach(function (it, i) {
      var y = i * hauteurLigne + 4;
      var w = Math.max(2, (it.valeur / max) * zone);
      var couleur = it.ton ? 'var(' + COULEUR_TON[it.ton] + ')' : couleurSerie(i);
      g.appendChild(svg('text', { x: gauche - 8, y: y + 13, 'text-anchor': 'end', 'dominant-baseline': 'middle', text: it.libelle }));
      var rect = svg('rect', { class: 'barre', x: gauche, y: y + 5, width: w, height: 14, rx: 2, fill: couleur, color: couleur, vars: { color: couleur } });
      avecInfobulle(rect, it.libelle, String(it.valeur), it.sous);
      g.appendChild(rect);
      g.appendChild(svg('text', { class: 'libelle-fort', x: gauche + w + 6, y: y + 13, 'dominant-baseline': 'middle', text: it.valeur }));
    });
    return g;
  }

  /* Donut : items = [{libelle, valeur, ton}] ; renvoie {svg, liste} */
  function graphiqueDonut(items, options) {
    options = options || {};
    var taille = 150, cx = 75, cy = 75, r = 58;
    var total = items.reduce(function (s, i) { return s + i.valeur; }, 0) || 1;
    var circ = 2 * Math.PI * r;
    var g = svg('svg', { class: 'graphique graphique--donut', viewBox: '0 0 ' + taille + ' ' + taille, role: 'group', 'aria-label': options.aria || 'Répartition' });
    g.appendChild(svg('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: 'var(--surface-saisie)', 'stroke-width': 12 }));
    var angle = -90;
    items.forEach(function (it, i) {
      var part = it.valeur / total;
      var longueur = part * circ;
      var couleur = it.ton ? 'var(' + COULEUR_TON[it.ton] + ')' : couleurSerie(i);
      var c = svg('circle', {
        class: 'segment', cx: cx, cy: cy, r: r, stroke: couleur, color: couleur,
        'stroke-dasharray': (longueur - 1.5).toFixed(2) + ' ' + circ.toFixed(2),
        transform: 'rotate(' + angle + ' ' + cx + ' ' + cy + ')',
        vars: { '--longueur': (longueur - 1.5).toFixed(2) },
      });
      avecInfobulle(c, it.libelle, String(it.valeur), Math.round(part * 100) + ' % du total');
      g.appendChild(c);
      angle += part * 360;
    });
    g.appendChild(svg('text', { class: 'donut-centre', x: cx, y: cy - 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', text: options.centre !== undefined ? options.centre : total }));
    g.appendChild(svg('text', { class: 'donut-sous', x: cx, y: cy + 16, 'text-anchor': 'middle', text: options.sous || 'total' }));
    var liste = el('ul', { class: 'liste-donut', 'aria-label': 'Légende' });
    items.forEach(function (it, i) {
      var couleur = it.ton ? 'var(' + COULEUR_TON[it.ton] + ')' : couleurSerie(i);
      liste.appendChild(el('li', {}, [el('i', { 'aria-hidden': 'true', vars: { '--c': couleur } }), it.libelle, el('span', { class: 'mono', text: it.valeur })]));
    });
    return { svg: g, liste: liste };
  }

  /* Courbe d'évolution : series = [{libelle, valeurs, couleur}], libelles = [...] */
  function graphiqueCourbe(series, libelles, options) {
    options = options || {};
    var largeur = 640, hauteur = options.hauteur || 220, marge = { h: 12, d: 16, b: 28, g: 34 };
    var g = svg('svg', { class: 'graphique', viewBox: '0 0 ' + largeur + ' ' + hauteur, role: 'group', 'aria-label': options.aria || 'Courbe d’évolution' });
    var toutes = series.reduce(function (a, s) { return a.concat(s.valeurs); }, []);
    var max = Math.ceil((Math.max.apply(null, toutes) * 1.15) / 5) * 5 || 5;
    var zoneL = largeur - marge.g - marge.d, zoneH = hauteur - marge.h - marge.b;
    var n = libelles.length;
    function px(i) { return marge.g + (zoneL * i) / (n - 1); }
    function py(v) { return marge.h + zoneH - (v / max) * zoneH; }
    for (var k = 0; k <= 4; k++) {
      var v = (max / 4) * k;
      var y = py(v);
      g.appendChild(svg('line', { class: k === 0 ? 'axe' : 'grille-h', x1: marge.g, y1: y, x2: largeur - marge.d, y2: y }));
      g.appendChild(svg('text', { x: marge.g - 8, y: y, 'text-anchor': 'end', 'dominant-baseline': 'middle', text: Math.round(v) }));
    }
    libelles.forEach(function (l, i) {
      if (n > 8 && i % 2 === 1) return;
      g.appendChild(svg('text', { x: px(i), y: hauteur - 8, 'text-anchor': 'middle', text: l }));
    });
    var defs = svg('defs');
    g.appendChild(defs);
    series.forEach(function (s, si) {
      var couleur = s.couleur || couleurSerie(si);
      var d = s.valeurs.map(function (v, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' ');
      if (si === 0 && options.aire !== false) {
        var idDegrade = 'degrade-' + (options.id || 'courbe') + '-' + si;
        var deg = svg('linearGradient', { id: idDegrade, x1: 0, y1: 0, x2: 0, y2: 1 });
        deg.appendChild(svg('stop', { offset: '0%', 'stop-color': couleur, 'stop-opacity': 0.25 }));
        deg.appendChild(svg('stop', { offset: '100%', 'stop-color': couleur, 'stop-opacity': 0 }));
        defs.appendChild(deg);
        g.appendChild(svg('path', { class: 'aire', d: d + ' L' + px(n - 1).toFixed(1) + ' ' + py(0) + ' L' + px(0).toFixed(1) + ' ' + py(0) + ' Z', fill: 'url(#' + idDegrade + ')' }));
      }
      g.appendChild(svg('path', { class: 'trace trace--lueur', d: d, stroke: couleur }));
      g.appendChild(svg('path', { class: 'trace', d: d, stroke: couleur }));
      s.valeurs.forEach(function (v, i) {
        var p = svg('circle', { class: 'point', cx: px(i), cy: py(v), r: 3.2, stroke: couleur, color: couleur });
        avecInfobulle(p, s.libelle, String(v), libelles[i]);
        g.appendChild(p);
      });
    });
    return g;
  }

  /* Jauge demi-circulaire : valeur 0..100 */
  function graphiqueJauge(valeur, options) {
    options = options || {};
    var largeur = 200, hauteur = 120, cx = 100, cy = 100, r = 78;
    var g = svg('svg', { class: 'graphique graphique--jauge', viewBox: '0 0 ' + largeur + ' ' + hauteur, role: 'img', 'aria-label': (options.aria || 'Jauge') + ' : ' + valeur + ' %' });
    var d = 'M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy;
    g.appendChild(svg('path', { class: 'jauge-fond', d: d }));
    var demi = Math.PI * r;
    var couleur = options.couleur || 'var(--cyan)';
    var valeurPath = svg('path', { class: 'jauge-valeur', d: d, stroke: couleur, color: couleur, vars: { '--decalage': (demi * (1 - valeur / 100)).toFixed(1) } });
    g.appendChild(valeurPath);
    if (options.cible !== undefined) {
      var a = Math.PI * (1 - options.cible / 100);
      var x1 = cx + Math.cos(a) * (r - 9), y1 = cy - Math.sin(a) * (r - 9);
      var x2 = cx + Math.cos(a) * (r + 9), y2 = cy - Math.sin(a) * (r + 9);
      g.appendChild(svg('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), stroke: 'var(--texte)', 'stroke-width': 1.5, 'stroke-dasharray': '2 2' }));
    }
    g.appendChild(svg('text', { class: 'jauge-chiffre mono', x: cx, y: cy - 14, 'text-anchor': 'middle', text: valeur + ' %' }));
    g.appendChild(svg('text', { class: 'jauge-legende', x: cx, y: cy + 2, 'text-anchor': 'middle', text: options.legende || '' }));
    g.appendChild(svg('text', { x: cx - r, y: cy + 14, 'text-anchor': 'middle', text: '0' }));
    g.appendChild(svg('text', { x: cx + r, y: cy + 14, 'text-anchor': 'middle', text: '100' }));
    return g;
  }

  /* Mini-courbe (sparkline) */
  function sparkline(valeurs, couleur, classe) {
    var l = 80, h = 24, m = 2;
    var min = Math.min.apply(null, valeurs), max = Math.max.apply(null, valeurs);
    var amp = max - min || 1;
    var d = valeurs.map(function (v, i) {
      var x = m + ((l - 2 * m) * i) / (valeurs.length - 1);
      var y = h - m - ((v - min) / amp) * (h - 2 * m);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var g = svg('svg', { class: 'graphique ' + (classe || ''), viewBox: '0 0 ' + l + ' ' + h, 'aria-hidden': 'true', focusable: 'false' });
    g.appendChild(svg('path', { class: 'trace trace--lueur', d: d, stroke: couleur }));
    g.appendChild(svg('path', { class: 'trace mini', d: d, stroke: couleur }));
    var dernier = valeurs[valeurs.length - 1];
    g.appendChild(svg('circle', { class: 'point', cx: l - m, cy: (h - m - ((dernier - min) / amp) * (h - 2 * m)).toFixed(1), r: 2.2, stroke: couleur, fill: couleur }));
    return g;
  }

  /* ------------------------------------------------------------------ Blocs communs */
  function carte(titre, iconeNom, contenu, options) {
    options = options || {};
    var c = el('section', { class: 'carte' + (options.classe ? ' ' + options.classe : ''), 'aria-labelledby': options.id ? options.id + '-titre' : null });
    if (titre) {
      c.appendChild(el('div', { class: 'carte__entete' }, [
        el('h2', { class: 'carte__titre', id: options.id ? options.id + '-titre' : null }, [iconeNom ? icone(iconeNom) : null, titre]),
        options.meta ? el('span', { class: 'carte__meta', text: options.meta }) : null,
      ]));
    }
    ajouter(c, contenu);
    return c;
  }
  function enteteEcran(surtitre, titre, sousTitre, actions) {
    return el('header', { class: 'entete-ecran' }, [
      el('div', { class: 'entete-ecran__titre' }, [el('span', { class: 'surtitre', text: surtitre }), el('h1', { text: titre }), sousTitre ? el('p', { class: 'sous-titre', text: sousTitre }) : null]),
      actions ? el('div', { class: 'entete-ecran__actions' }, actions) : null,
    ]);
  }
  function progression(valeur, ton) {
    var p = el('div', { class: 'progression' + (ton ? ' progression--' + ton : ''), role: 'progressbar', 'aria-valuenow': valeur, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Avancement ' + valeur + ' %' });
    var piste = el('div', { class: 'progression__piste', vars: { '--valeur': valeur / 100 } });
    p.appendChild(piste);
    p.appendChild(el('span', { class: 'progression__valeur', text: valeur + ' %' }));
    return p;
  }

  /* ------------------------------------------------------------------ Barre d'état */
  function rendreBarreEtat() {
    var ind = document.getElementById('barre-indicateurs');
    vider(ind);
    ind.appendChild(el('li', { class: 'organisation', text: F.organisation.nom }));
    var k = F.kpi;
    var niveau = k.actionsEnRetard > 5 ? 'rouge' : k.actionsEnRetard > 0 ? 'ambre' : 'vert';
    ind.appendChild(el('li', {}, [el('span', { class: 'pastille pastille--' + niveau, 'aria-hidden': 'true' }), 'État SMSI : ', el('span', { class: 'mono est-' + niveau, text: niveau === 'vert' ? 'nominal' : niveau === 'ambre' ? 'vigilance' : 'dégradé' })]));
    ind.appendChild(el('li', {}, [icone('lecture', 'icone--sm'), 'Audits en cours ', el('span', { class: 'mono', text: k.auditsEnCours })]));
    ind.appendChild(el('li', {}, [icone('alerte', 'icone--sm'), 'Actions en retard ', el('span', { class: 'mono est-rouge', text: k.actionsEnRetard })]));
    ind.appendChild(el('li', { class: 'secondaire-barre' }, [icone('erreur', 'icone--sm'), 'NC ouvertes ', el('span', { class: 'mono est-ambre', text: k.ncOuvertes })]));
    ind.appendChild(el('li', { class: 'secondaire-barre' }, [icone('bouclier', 'icone--sm'), 'Conformité ', el('span', { class: 'mono est-vert', text: k.conformite + ' %' })]));
    var u = document.getElementById('barre-utilisateur');
    vider(u);
    u.appendChild(avatar(F.moi.id));
    u.appendChild(el('span', { class: 'utilisateur__nom', text: F.moi.nom + ' · ' + F.moi.role }));
  }

  /* ------------------------------------------------------------------ Écran : Dashboard */
  function ecranDashboard() {
    var k = F.kpi;
    var frag = document.createDocumentFragment();
    frag.appendChild(enteteEcran('Pilotage SMSI', 'Dashboard de pilotage', F.organisation.nom + ' · ' + F.organisation.periode, [
      el('span', { class: 'carte__meta', text: 'Synchronisé le ' + F.fr(F.aujourdhui) + ' à 09:41' }),
      el('button', { class: 'bouton bouton--sm', type: 'button', onclick: function () { toast('info', 'Export lancé', 'Le rapport de pilotage sera disponible dans la file d’exports.'); } }, [icone('audits'), 'Exporter']),
    ]));

    /* KPI */
    var critiques = k.parCriticiteNC['Critique'] || 0;
    var actionsOuvertes = k.actions - k.actionsTerminees;
    var conf = F.indicateurs[0];
    var kpis = [
      { libelle: 'Audits en cours', valeur: k.auditsEnCours, ton: 'cyan', detail: [icone('calendrier'), pluriel(k.auditsAVenir, 'audit à venir', 'audits à venir')] },
      { libelle: 'NC ouvertes', valeur: k.ncOuvertes, ton: critiques ? 'ambre' : '', detail: [icone('erreur'), pluriel(critiques, 'critique', 'critiques')], detailTon: critiques ? 'rouge' : '' },
      { libelle: 'Actions en retard', valeur: k.actionsEnRetard, ton: k.actionsEnRetard ? 'rouge' : 'vert', detail: [icone('alerte'), 'sur ' + pluriel(actionsOuvertes, 'action ouverte', 'actions ouvertes')], detailTon: k.actionsEnRetard ? 'rouge' : '' },
      { libelle: 'Taux de conformité', valeur: k.conformite, unite: '%', ton: 'vert', detail: [icone('tendance-haut'), 'cible ' + conf.cible + ' % · +' + (conf.historique[11] - conf.historique[0]) + ' pts/an'], detailTon: 'vert', trace: conf.historique },
      { libelle: 'Échéances dépassées', valeur: k.echeancesDepassees.length, ton: 'ambre', detail: [icone('horloge'), 'constats et actions'], detailTon: 'ambre' },
      { libelle: 'Risques élevés', valeur: k.risquesEleves, ton: k.risquesEleves ? 'ambre' : '', detail: [icone('cible'), 'niveau ≥ 9 sur ' + F.risques.length + ' risques'] },
    ];
    var grilleKpi = el('div', { class: 'grille grille--kpi' });
    kpis.forEach(function (x) {
      var c = el('article', { class: 'carte kpi' });
      c.appendChild(el('div', { class: 'kpi__libelle', text: x.libelle }));
      c.appendChild(el('div', { class: 'kpi__valeur' + (x.ton ? ' est-' + x.ton : '') }, [String(x.valeur), x.unite ? el('span', { class: 'kpi__unite', text: x.unite }) : null]));
      c.appendChild(el('div', { class: 'kpi__detail' + (x.detailTon ? ' est-' + x.detailTon : '') }, x.detail));
      if (x.trace) c.appendChild(sparkline(x.trace, 'var(--vert)', 'kpi__trace'));
      grilleKpi.appendChild(c);
    });
    frag.appendChild(grilleKpi);

    /* Rangée 2 : barres, donut, jauge */
    var rang2 = el('div', { class: 'grille grille--3' });
    var statuts = F.vocabulaire.statutsAudit.map(function (s) { return { libelle: s, valeur: k.parStatutAudit[s] || 0, ton: STATUT_AUDIT[s].ton, sous: 'audits au statut « ' + s + ' »' }; });
    rang2.appendChild(carte('Audits par statut', 'audits', [graphiqueBarres(statuts, { aria: 'Nombre d’audits par statut' })], { meta: k.audits + ' audits' }));
    var crit = ['Critique', 'Majeure', 'Mineure', 'Observation'].filter(function (c) { return k.parCriticiteNC[c]; }).map(function (c) { return { libelle: c, valeur: k.parCriticiteNC[c], ton: CRITICITE[c].ton }; });
    var donut = graphiqueDonut(crit, { aria: 'Non-conformités ouvertes par criticité', sous: 'NC ouvertes' });
    rang2.appendChild(carte('NC ouvertes par criticité', 'erreur', [el('div', { class: 'donut-conteneur' }, [donut.svg, donut.liste])], { meta: F.nonConformites.length + ' NC au total' }));
    var tauxActions = Math.round((k.actionsTerminees / k.actions) * 100);
    var statutsAction = F.vocabulaire.statutsAction.map(function (s) { return { libelle: s, valeur: k.parStatutAction[s] || 0, ton: STATUT_ACTION[s].ton }; });
    var legendeActions = el('ul', { class: 'legende' }, statutsAction.map(function (s) { return el('li', {}, [el('i', { 'aria-hidden': 'true', vars: { '--c': 'var(' + COULEUR_TON[s.ton] + ')' } }), s.libelle + ' ', el('span', { class: 'mono', text: s.valeur })]); }));
    rang2.appendChild(carte('Avancement des actions', 'cible', [graphiqueJauge(tauxActions, { aria: 'Part des actions terminées', legende: k.actionsTerminees + ' / ' + k.actions + ' terminées', cible: 80, couleur: 'var(--cyan)' }), legendeActions], { meta: 'cible 80 %' }));
    frag.appendChild(rang2);

    /* Rangée 3 : courbe + échéances */
    var rang3 = el('div', { class: 'grille grille--2-1' });
    var courbe = graphiqueCourbe([
      { libelle: 'constats ouverts', valeurs: F.evolution.map(function (e) { return e.ouverts; }), couleur: 'var(--serie-3)' },
      { libelle: 'constats clos', valeurs: F.evolution.map(function (e) { return e.clos; }), couleur: 'var(--serie-1)' },
    ], F.vocabulaire.mois, { aria: 'Constats ouverts et clos par mois sur douze mois', id: 'evolution', hauteur: 250 });
    var legendeCourbe = el('ul', { class: 'legende' }, [
      el('li', {}, [el('i', { 'aria-hidden': 'true', vars: { '--c': 'var(--serie-3)' } }), 'Constats ouverts dans le mois']),
      el('li', {}, [el('i', { 'aria-hidden': 'true', vars: { '--c': 'var(--serie-1)' } }), 'Constats clos dans le mois']),
    ]);
    rang3.appendChild(carte('Évolution des constats · 12 mois', 'retex', [courbe, legendeCourbe], { meta: 'nov. 2025 → oct. 2026' }));
    var depassees = k.echeancesDepassees.slice(-3).reverse();
    var liste = el('ul', { class: 'liste-echeances' });
    depassees.concat(k.prochainesEcheances.slice(0, 6)).forEach(function (e) {
      liste.appendChild(el('li', {}, [
        el('span', { class: 'identifiant', text: e.id }),
        el('div', {}, [el('div', { class: 'titre', title: e.titre, text: e.titre }), el('div', { class: 'meta' }, [e.genre + ' · ' + F.fr(e.echeance) + ' · ', avatar(e.responsable)])]),
        delai(e.jours),
      ]));
    });
    var voirTout = el('a', { href: '#/audits', text: 'Voir les audits' });
    rang3.appendChild(carte('Prochaines échéances', 'horloge', [liste, el('div', { class: 'carte__pied' }, [el('span', {}, [icone('alerte', 'icone--sm'), ' ' + pluriel(k.echeancesDepassees.length, 'échéance dépassée', 'échéances dépassées') + ' au total']), voirTout])], { meta: 'J+0 = ' + F.fr(F.aujourdhui) }));
    frag.appendChild(rang3);

    /* Rangée 4 : indicateurs + risques */
    var rang4 = el('div', { class: 'grille grille--2' });
    var tbody = el('tbody');
    F.indicateurs.forEach(function (i) {
      var inverse = i.id === 'I3' || i.id === 'I7';
      var ok = inverse ? i.valeur <= i.cible : i.valeur >= i.cible;
      var tendIcone = i.tendance === 'hausse' ? 'tendance-haut' : i.tendance === 'baisse' ? 'tendance-bas' : 'tendance-stable';
      var unite = i.unite.indexOf('/') === 0 ? i.unite : (i.unite ? ' ' + i.unite : '');
      tbody.appendChild(el('tr', {}, [
        el('td', { class: 'libelle' }, [i.libelle, el('div', { class: 'cible', text: 'cible ' + i.cible + unite })]),
        el('td', {}, [sparkline(i.historique, ok ? 'var(--vert)' : 'var(--ambre)', 'trace-mini')]),
        el('td', { class: 'valeur ' + (ok ? 'est-ok' : 'est-ecart'), text: i.valeur + unite }),
        el('td', {}, [el('span', { class: 'tendance' }, [icone(tendIcone), i.tendance])]),
        el('td', {}, [ok ? badge('Atteint', { ton: 'vert', icone: 'ok' }) : badge('Écart', { ton: 'ambre', icone: 'alerte' })]),
      ]));
    });
    var tableInd = el('table', { class: 'tableau-indicateurs' }, [el('caption', { class: 'visuellement-cache', text: 'Indicateurs SMSI, valeur, tendance et atteinte de la cible' }), tbody]);
    rang4.appendChild(carte('Indicateurs SMSI', 'signal', [tableInd], { meta: F.indicateurs.length + ' indicateurs' }));
    var risques = F.risques.slice().sort(function (a, b) { return b.niveau - a.niveau; }).slice(0, 6);
    var listeR = el('ul', { class: 'liste-echeances' });
    risques.forEach(function (r) {
      var ton = r.niveau >= 9 ? 'rouge' : r.niveau >= 6 ? 'ambre' : 'vert';
      var tend = r.tendance === 'hausse' ? 'tendance-haut' : r.tendance === 'baisse' ? 'tendance-bas' : 'tendance-stable';
      listeR.appendChild(el('li', {}, [
        el('span', { class: 'identifiant', text: r.id }),
        el('div', {}, [el('div', { class: 'titre', title: r.titre, text: r.titre }), el('div', { class: 'meta' }, ['G' + r.gravite + ' × V' + r.vraisemblance + ' · ' + r.traitement + ' · ', avatar(r.proprietaire), F.utilisateur(r.proprietaire).nom])]),
        el('span', { class: 'badge badge--' + ton + ' badge--mono' }, [icone(tend), 'niveau ' + r.niveau]),
      ]));
    });
    rang4.appendChild(carte('Risques les plus élevés', 'cible', [listeR], { meta: F.risques.length + ' risques suivis' }));
    frag.appendChild(rang4);
    return frag;
  }

  /* ------------------------------------------------------------------ Écran : Liste des audits */
  var etatListe = { recherche: '', statut: '', type: '', ref: '', tri: 'debut', sens: 'desc', page: 1 };
  var PAR_PAGE = 10;
  var COLONNES = [
    { cle: 'id', libelle: 'ID' },
    { cle: 'nom', libelle: 'Audit' },
    { cle: 'type', libelle: 'Type', masquable: true },
    { cle: 'referentiel', libelle: 'Référentiel' },
    { cle: 'site', libelle: 'Site', masquable: true },
    { cle: 'statut', libelle: 'Statut' },
    { cle: 'debut', libelle: 'Début' },
    { cle: 'progression', libelle: 'Avancement', num: true },
  ];
  function normaliser(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function auditsFiltres() {
    var q = normaliser(etatListe.recherche.trim());
    var liste = F.audits.filter(function (a) {
      if (etatListe.statut && a.statut !== etatListe.statut) return false;
      if (etatListe.type && a.type !== etatListe.type) return false;
      if (etatListe.ref && a.referentiel !== etatListe.ref) return false;
      if (!q) return true;
      var corpus = normaliser([a.id, a.nom, a.site, a.type, a.statut, F.referentiel(a.referentiel).libelle, F.utilisateur(a.responsable).nom, a.auditeur, a.perimetre].join(' '));
      return corpus.indexOf(q) !== -1;
    });
    var cle = etatListe.tri, sens = etatListe.sens === 'asc' ? 1 : -1;
    liste.sort(function (a, b) {
      var va = cle === 'referentiel' ? F.referentiel(a.referentiel).court : a[cle];
      var vb = cle === 'referentiel' ? F.referentiel(b.referentiel).court : b[cle];
      if (typeof va === 'number') return (va - vb) * sens;
      return String(va).localeCompare(String(vb), 'fr') * sens;
    });
    return liste;
  }
  function ecranAudits() {
    var frag = document.createDocumentFragment();
    frag.appendChild(enteteEcran('Registre', 'Audits', '36 audits du cycle de certification, tous référentiels confondus.', [
      el('a', { class: 'bouton bouton--primaire', href: '#/formulaire' }, [icone('plus'), 'Nouvel audit']),
    ]));
    var saisieRecherche = el('input', { class: 'saisie', type: 'search', id: 'recherche-audits', placeholder: 'Rechercher un audit, un site, un responsable…', value: etatListe.recherche, 'aria-label': 'Rechercher dans les audits', autocomplete: 'off' });
    saisieRecherche.addEventListener('input', function () { etatListe.recherche = saisieRecherche.value; etatListe.page = 1; rafraichirTableau(); });
    function selecteur(id, libelle, valeurs, cle) {
      var s = el('select', { class: 'saisie', id: id, 'aria-label': libelle });
      s.appendChild(el('option', { value: '', text: libelle + ' : tous' }));
      valeurs.forEach(function (v) { s.appendChild(el('option', { value: v.valeur !== undefined ? v.valeur : v, text: v.libelle || v, selected: etatListe[cle] === (v.valeur !== undefined ? v.valeur : v) })); });
      s.addEventListener('change', function () { etatListe[cle] = s.value; etatListe.page = 1; rafraichirTableau(); });
      return s;
    }
    var reinit = el('button', { class: 'bouton bouton--discret', type: 'button' }, [icone('boucle'), 'Réinitialiser']);
    reinit.addEventListener('click', function () {
      etatListe.recherche = ''; etatListe.statut = ''; etatListe.type = ''; etatListe.ref = ''; etatListe.page = 1;
      saisieRecherche.value = '';
      Array.prototype.forEach.call(outils.querySelectorAll('select'), function (s) { s.value = ''; });
      rafraichirTableau();
      toast('info', 'Filtres réinitialisés');
    });
    var compteur = el('span', { class: 'carte__meta', id: 'compteur-audits', 'aria-live': 'polite' });
    var outils = el('div', { class: 'barre-outils' }, [
      el('div', { class: 'recherche' }, [icone('recherche'), saisieRecherche]),
      selecteur('filtre-statut', 'Statut', F.vocabulaire.statutsAudit, 'statut'),
      selecteur('filtre-type', 'Type', F.vocabulaire.typesAudit, 'type'),
      selecteur('filtre-ref', 'Référentiel', F.referentiels.map(function (r) { return { valeur: r.id, libelle: r.court }; }), 'ref'),
      reinit,
      compteur,
    ]);
    frag.appendChild(outils);

    var thead = el('thead');
    var ligneEntete = el('tr');
    COLONNES.forEach(function (c) {
      var th = el('th', { scope: 'col', class: (c.num ? 'num ' : '') + (c.masquable ? 'masquable' : '') });
      var b = el('button', { class: 'tri', type: 'button' }, [c.libelle, icone('tri')]);
      b.addEventListener('click', function () {
        if (etatListe.tri === c.cle) etatListe.sens = etatListe.sens === 'asc' ? 'desc' : 'asc';
        else { etatListe.tri = c.cle; etatListe.sens = c.cle === 'debut' || c.cle === 'progression' ? 'desc' : 'asc'; }
        etatListe.page = 1;
        rafraichirTableau();
      });
      th.appendChild(b);
      th.dataset.cle = c.cle;
      ligneEntete.appendChild(th);
    });
    thead.appendChild(ligneEntete);
    var tbody = el('tbody');
    var table = el('table', { class: 'tableau' }, [el('caption', { class: 'visuellement-cache', text: 'Liste des audits, triable par colonne' }), thead, tbody]);
    frag.appendChild(el('div', { class: 'tableau-conteneur' }, [table]));
    var pied = el('div', { class: 'pied-tableau' });
    frag.appendChild(pied);

    function rafraichirTableau() {
      var liste = auditsFiltres();
      var total = liste.length;
      var pages = Math.max(1, Math.ceil(total / PAR_PAGE));
      if (etatListe.page > pages) etatListe.page = pages;
      var debut = (etatListe.page - 1) * PAR_PAGE;
      var page = liste.slice(debut, debut + PAR_PAGE);
      Array.prototype.forEach.call(thead.querySelectorAll('th'), function (th) {
        var actif = th.dataset.cle === etatListe.tri;
        if (actif) th.setAttribute('aria-sort', etatListe.sens === 'asc' ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
        var use = th.querySelector('use');
        use.setAttribute('href', actif ? (etatListe.sens === 'asc' ? '#i-tri-asc' : '#i-tri-desc') : '#i-tri');
      });
      vider(tbody);
      if (!page.length) {
        tbody.appendChild(el('tr', { class: 'vide' }, [el('td', { colspan: COLONNES.length }, [icone('vide', 'icone--lg'), el('div', { text: 'Aucun audit ne correspond à ces critères.' })])]));
      }
      page.forEach(function (a) {
        var tr = el('tr', { class: 'est-cliquable' });
        var lien = el('a', { href: '#/audit/' + a.id, text: a.nom });
        tr.appendChild(el('td', {}, [el('span', { class: 'identifiant', text: a.id })]));
        tr.appendChild(el('td', { class: 'cellule-nom' }, [lien, el('div', { class: 'secondaire', text: F.utilisateur(a.responsable).nom + ' · ' + a.auditeur })]));
        tr.appendChild(el('td', { class: 'masquable secondaire', text: a.type }));
        tr.appendChild(el('td', {}, [badgeRef(a.referentiel)]));
        tr.appendChild(el('td', { class: 'masquable secondaire', text: a.site }));
        tr.appendChild(el('td', {}, [badge(a.statut, STATUT_AUDIT[a.statut])]));
        tr.appendChild(el('td', { class: 'mono secondaire', text: F.fr(a.debut) }));
        var tdProg = el('td', { class: 'num' });
        tdProg.appendChild(progression(a.progression, a.statut === 'Clos' ? 'vert' : a.statut === 'Reporté' ? 'gris' : a.statut === 'Rapport attendu' ? 'ambre' : ''));
        tr.appendChild(tdProg);
        tr.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          location.hash = '#/audit/' + a.id;
        });
        tbody.appendChild(tr);
      });
      compteur.textContent = total + ' audit' + (total > 1 ? 's' : '') + (total !== F.audits.length ? ' sur ' + F.audits.length : '');
      vider(pied);
      pied.appendChild(el('span', { text: total ? 'Lignes ' + (debut + 1) + ' à ' + Math.min(debut + PAR_PAGE, total) + ' sur ' + total : 'Aucune ligne' }));
      var pag = el('nav', { class: 'pagination', 'aria-label': 'Pagination' });
      var prec = el('button', { class: 'pagination__page', type: 'button', 'aria-label': 'Page précédente', disabled: etatListe.page === 1 }, [icone('chevron-g')]);
      prec.addEventListener('click', function () { etatListe.page--; rafraichirTableau(); });
      pag.appendChild(prec);
      for (var p = 1; p <= pages; p++) {
        (function (p) {
          var b = el('button', { class: 'pagination__page', type: 'button', text: p, 'aria-label': 'Page ' + p, 'aria-current': p === etatListe.page ? 'page' : null });
          b.addEventListener('click', function () { etatListe.page = p; rafraichirTableau(); });
          pag.appendChild(b);
        })(p);
      }
      var suiv = el('button', { class: 'pagination__page', type: 'button', 'aria-label': 'Page suivante', disabled: etatListe.page === pages }, [icone('chevron-d')]);
      suiv.addEventListener('click', function () { etatListe.page++; rafraichirTableau(); });
      pag.appendChild(suiv);
      pied.appendChild(pag);
      prochainCadre(function () { reveler(tbody); });
    }
    rafraichirTableau();
    return frag;
  }

  /* ------------------------------------------------------------------ Écran : Fiche audit */
  var ecouteurRedim = null;
  function ecranAudit(id) {
    var a = F.audit(id);
    var frag = document.createDocumentFragment();
    if (!a) {
      frag.appendChild(enteteEcran('Fiche', 'Audit introuvable'));
      frag.appendChild(etatVide('Aucun audit « ' + id + ' »', 'L’identifiant demandé n’existe pas dans le registre.', el('a', { class: 'bouton', href: '#/audits', text: 'Retour à la liste' })));
      return frag;
    }
    var constats = F.constatsDe(a.id);
    var actions = F.actionsDe(a.id);
    var historique = F.historiqueAudit(a);
    frag.appendChild(el('nav', { class: 'fil', 'aria-label': 'Fil d’Ariane' }, [el('a', { href: '#/audits', text: 'Audits' }), icone('chevron-d'), el('span', { class: 'mono', text: a.id })]));

    var entete = el('header', { class: 'carte entete-fiche' });
    var gauche = el('div');
    gauche.appendChild(el('span', { class: 'surtitre', text: a.id + ' · ' + a.type }));
    gauche.appendChild(el('h1', { text: a.nom }));
    gauche.appendChild(el('div', { class: 'entete-fiche__badges' }, [badge(a.statut, STATUT_AUDIT[a.statut]), badgeRef(a.referentiel), badge('Criticité ' + a.criticite.toLowerCase(), CRITICITE[a.criticite]), el('span', { class: 'badge badge--gris' }, [icone('site'), a.site])]));
    var meta = el('dl', { class: 'entete-fiche__meta' }, [
      el('div', { class: 'meta-bloc' }, [el('dt', { text: 'Période' }), el('dd', {}, [icone('calendrier'), el('span', { class: 'mono', text: F.fr(a.debut) + ' → ' + F.fr(a.fin) })])]),
      el('div', { class: 'meta-bloc' }, [el('dt', { text: 'Responsable' }), el('dd', {}, [avatar(a.responsable), F.utilisateur(a.responsable).nom])]),
      el('div', { class: 'meta-bloc' }, [el('dt', { text: 'Auditeur' }), el('dd', {}, [icone('utilisateur'), a.auditeur])]),
      el('div', { class: 'meta-bloc' }, [el('dt', { text: 'Périmètre' }), el('dd', {}, [icone('cible'), a.perimetre])]),
    ]);
    gauche.appendChild(meta);
    entete.appendChild(gauche);
    var droite = el('div', { class: 'entete-fiche__progression' });
    droite.appendChild(el('span', { class: 'kpi__libelle', text: 'Avancement' }));
    droite.appendChild(el('span', { class: 'grand-chiffre', text: a.progression + ' %' }));
    droite.appendChild(progression(a.progression));
    droite.appendChild(el('div', { class: 'groupe-boutons' }, [
      el('a', { class: 'bouton bouton--sm', href: '#/formulaire' }, [icone('formulaire'), 'Modifier']),
      el('button', { class: 'bouton bouton--sm bouton--primaire', type: 'button', onclick: function () { toast('succes', 'Rapport généré', 'Le rapport de ' + a.id + ' est prêt au téléchargement.'); } }, [icone('audits'), 'Générer le rapport']),
    ]));
    entete.appendChild(droite);
    frag.appendChild(entete);

    /* Onglets */
    var onglets = [
      { id: 'synthese', libelle: 'Synthèse' },
      { id: 'constats', libelle: 'Constats', compteur: constats.length },
      { id: 'actions', libelle: 'Plan d’actions', compteur: actions.length },
      { id: 'historique', libelle: 'Historique', compteur: historique.length },
    ];
    var tablist = el('div', { class: 'onglets', role: 'tablist', 'aria-label': 'Sections de la fiche' });
    var indicateur = el('span', { class: 'onglets__indicateur', 'aria-hidden': 'true' });
    var panneaux = el('div');
    var boutons = [];
    onglets.forEach(function (o, i) {
      var b = el('button', { class: 'onglet', role: 'tab', type: 'button', id: 'onglet-' + o.id, 'aria-selected': i === 0 ? 'true' : 'false', 'aria-controls': 'panneau-' + o.id, tabindex: i === 0 ? '0' : '-1' }, [o.libelle, o.compteur !== undefined ? el('span', { class: 'compteur', text: o.compteur }) : null]);
      b.addEventListener('click', function () { activer(i); });
      b.addEventListener('keydown', function (e) {
        var n = i;
        if (e.key === 'ArrowRight') n = (i + 1) % onglets.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + onglets.length) % onglets.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = onglets.length - 1;
        else return;
        e.preventDefault();
        activer(n);
        boutons[n].focus();
      });
      boutons.push(b);
      tablist.appendChild(b);
      panneaux.appendChild(el('div', { class: 'panneau', role: 'tabpanel', id: 'panneau-' + o.id, 'aria-labelledby': 'onglet-' + o.id, tabindex: '0', hidden: i !== 0 }));
    });
    tablist.appendChild(indicateur);
    function positionnerIndicateur(i) {
      var b = boutons[i];
      indicateur.style.setProperty('--x', b.offsetLeft);
      indicateur.style.setProperty('--w', b.offsetWidth);
    }
    var courant = 0;
    function activer(i) {
      courant = i;
      boutons.forEach(function (b, j) {
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        b.setAttribute('tabindex', j === i ? '0' : '-1');
        var p = panneaux.children[j];
        p.hidden = j !== i;
      });
      positionnerIndicateur(i);
      reveler(panneaux.children[i]);
    }
    if (ecouteurRedim) window.removeEventListener('resize', ecouteurRedim);
    ecouteurRedim = function () { if (document.body.contains(tablist)) positionnerIndicateur(courant); };
    window.addEventListener('resize', ecouteurRedim);
    frag.appendChild(tablist);
    frag.appendChild(panneaux);

    /* Synthèse */
    var parCrit = F.compterPar(constats, 'criticite');
    var maxCrit = Math.max.apply(null, Object.keys(parCrit).map(function (k) { return parCrit[k]; }).concat([1]));
    var barresCrit = el('ul', { class: 'barres-criticite' }, ['Critique', 'Majeure', 'Mineure', 'Observation'].map(function (c) {
      var n = parCrit[c] || 0;
      return el('li', {}, [el('span', {}, [badge(c, CRITICITE[c])]), el('div', { class: 'progression progression--' + CRITICITE[c].ton, role: 'img', 'aria-label': n + ' constat(s) ' + c.toLowerCase() }, [el('div', { class: 'progression__piste', vars: { '--valeur': n / maxCrit } })]), el('span', { class: 'mono', text: n })]);
    }));
    var ouvertsFiche = constats.filter(function (c) { return c.statut !== 'Clos'; }).length;
    var retardFiche = actions.filter(function (x) { return x.statut !== 'Terminée' && F.daysUntil(x.echeance) < 0; }).length;
    panneaux.children[0].appendChild(el('div', { class: 'synthese' }, [
      carte('Objet de l’audit', 'fiche', [
        el('p', { class: 'texte-long', text: a.description.charAt(0).toUpperCase() + a.description.slice(1) }),
        el('p', { class: 'texte-long', text: 'Référentiel appliqué : ' + F.referentiel(a.referentiel).libelle + '. Les constats sont rattachés aux exigences ou mesures correspondantes ; le plan d’actions est arbitré en revue de direction.' }),
        el('h3', { text: 'Constats par criticité' }),
        barresCrit,
      ]),
      carte('Chiffres clés', 'signal', [el('ul', { class: 'liste-cles' }, [
        el('li', {}, ['Constats relevés', el('span', { class: 'mono', text: constats.length })]),
        el('li', {}, ['Constats encore ouverts', el('span', { class: 'mono', text: ouvertsFiche })]),
        el('li', {}, ['Actions correctives', el('span', { class: 'mono', text: actions.length })]),
        el('li', {}, ['Actions en retard', el('span', { class: 'mono ' + (retardFiche ? 'est-rouge' : ''), text: retardFiche })]),
        el('li', {}, ['Durée sur site', el('span', { class: 'mono', text: (F.daysUntil(a.fin) - F.daysUntil(a.debut) + 1) + ' j' })]),
        el('li', {}, ['Début', el('span', { class: 'mono', text: F.frLong(a.debut) })]),
        el('li', {}, ['Prochaine étape', el('span', { text: a.statut === 'Clos' ? 'Aucune (clos)' : a.statut === 'En cours' ? 'Réunion de clôture' : a.statut === 'Rapport attendu' ? 'Réception du rapport' : 'Réunion d’ouverture' })]),
      ])]),
    ]));

    /* Constats */
    if (!constats.length) {
      panneaux.children[1].appendChild(etatVide('Aucun constat', 'Les constats seront saisis à l’issue de la réunion de clôture.'));
    } else {
      var tb = el('tbody');
      constats.forEach(function (c) {
        tb.appendChild(el('tr', {}, [
          el('td', {}, [el('span', { class: 'identifiant', text: c.id })]),
          el('td', {}, [el('span', { class: 'etiquette-ref', text: c.ref })]),
          el('td', { class: 'cellule-nom' }, [c.titre, el('div', { class: 'secondaire', text: c.type })]),
          el('td', {}, [badge(c.criticite, CRITICITE[c.criticite])]),
          el('td', {}, [badge(c.statut, STATUT_CONSTAT[c.statut])]),
          el('td', {}, [avatar(c.responsable)]),
          el('td', {}, [el('span', { class: 'mono secondaire', text: F.fr(c.echeance) }), ' ', c.statut !== 'Clos' ? delai(F.daysUntil(c.echeance)) : null]),
        ]));
      });
      panneaux.children[1].appendChild(el('div', { class: 'tableau-conteneur' }, [el('table', { class: 'tableau' }, [
        el('caption', { class: 'visuellement-cache', text: 'Constats de l’audit' }),
        el('thead', {}, [el('tr', {}, ['ID', 'Exigence', 'Constat', 'Criticité', 'Statut', 'Resp.', 'Échéance'].map(function (t) { return el('th', { scope: 'col', text: t }); }))]),
        tb,
      ])]));
    }

    /* Plan d'actions */
    if (!actions.length) {
      panneaux.children[2].appendChild(etatVide('Aucune action', 'Le plan d’actions sera construit après arbitrage des constats.'));
    } else {
      var listeA = el('ul', { class: 'liste-actions' });
      actions.forEach(function (x) {
        var j = F.daysUntil(x.echeance);
        var ton = x.statut === 'Terminée' ? 'vert' : x.statut === 'Bloquée' ? 'rouge' : j < 0 ? 'ambre' : '';
        listeA.appendChild(el('li', { class: 'action' }, [
          el('span', { class: 'identifiant', text: x.id }),
          el('div', {}, [el('div', { class: 'action__titre', text: x.titre }), el('div', { class: 'action__sous' }, [el('span', { class: 'etiquette-ref', text: x.constatId }), 'charge ' + x.charge + ' · ', avatar(x.responsable), F.utilisateur(x.responsable).nom])]),
          progression(x.avancement, ton),
          el('div', { class: 'action__droite' }, [badge(x.statut, STATUT_ACTION[x.statut])]),
          el('div', { class: 'action__droite' }, [el('span', { class: 'badge badge--mono ' + (x.priorite === 'P1' ? 'badge--rouge' : x.priorite === 'P2' ? 'badge--ambre' : 'badge--gris'), text: x.priorite }), x.statut !== 'Terminée' ? delai(j) : el('span', { class: 'delai' }, [icone('ok'), F.fr(x.echeance)])]),
        ]));
      });
      panneaux.children[2].appendChild(listeA);
    }

    /* Historique */
    var chrono = el('ol', { class: 'chronologie' });
    historique.forEach(function (h) {
      chrono.appendChild(el('li', {}, [el('span', { class: 'date', text: F.fr(h.quand) }), el('div', {}, [el('div', { class: 'quoi', text: h.quoi }), el('div', { class: 'qui' }, [avatar(h.qui), F.utilisateur(h.qui).nom + ' · ' + F.utilisateur(h.qui).role])])]));
    });
    panneaux.children[3].appendChild(carte('Journal de l’audit', 'horloge', [chrono], { meta: historique.length + ' événements' }));

    prochainCadre(function () { positionnerIndicateur(0); });
    return frag;
  }

  /* ------------------------------------------------------------------ Écran : Formulaire */
  function ecranFormulaire() {
    var frag = document.createDocumentFragment();
    frag.appendChild(enteteEcran('Registre', 'Nouvel audit', 'Les champs marqués d’un astérisque sont obligatoires. La validation s’effectue à la sortie du champ et à l’envoi.'));
    var form = el('form', { class: 'carte', novalidate: true, 'aria-describedby': 'form-aide' });
    var bandeauErreur = el('div', { class: 'bandeau bandeau--erreur', role: 'alert', hidden: true });
    var bandeauSucces = el('div', { class: 'bandeau bandeau--succes', role: 'status', hidden: true });
    form.appendChild(bandeauErreur);
    form.appendChild(bandeauSucces);
    form.appendChild(el('p', { class: 'visuellement-cache', id: 'form-aide', text: 'Formulaire de création d’un audit, fictif : aucune donnée n’est enregistrée.' }));

    var champs = {};
    function champ(def) {
      var idErreur = def.id + '-erreur';
      var idAide = def.id + '-aide';
      var controle;
      if (def.type === 'select') {
        controle = el('select', { class: 'saisie', id: def.id, name: def.id, 'aria-describedby': (def.aide ? idAide + ' ' : '') + idErreur, 'aria-required': def.obligatoire ? 'true' : null });
        controle.appendChild(el('option', { value: '', text: def.vide || 'Sélectionner…' }));
        def.options.forEach(function (o) { controle.appendChild(el('option', { value: o.valeur !== undefined ? o.valeur : o, text: o.libelle || o })); });
      } else if (def.type === 'textarea') {
        controle = el('textarea', { class: 'saisie', id: def.id, name: def.id, maxlength: def.max || 400, placeholder: def.placeholder, 'aria-describedby': (def.aide ? idAide + ' ' : '') + idErreur, 'aria-required': def.obligatoire ? 'true' : null });
      } else {
        controle = el('input', { class: 'saisie' + (def.type === 'date' ? ' saisie--mono' : ''), type: def.type || 'text', id: def.id, name: def.id, placeholder: def.placeholder, 'aria-describedby': (def.aide ? idAide + ' ' : '') + idErreur, 'aria-required': def.obligatoire ? 'true' : null, autocomplete: 'off' });
      }
      var conteneur = el('div', { class: 'champ' + (def.plein ? ' champ--plein' : '') }, [
        el('label', { class: 'champ__libelle', for: def.id }, [def.libelle, def.obligatoire ? el('span', { class: 'obligatoire', 'aria-hidden': 'true', text: '*' }) : null]),
        controle,
        def.aide ? el('span', { class: 'champ__aide', id: idAide, text: def.aide }) : null,
        el('span', { class: 'champ__erreur', id: idErreur }),
      ]);
      if (def.type === 'textarea') {
        var compteurC = el('span', { class: 'compteur-caracteres', 'aria-live': 'polite', text: '0 / ' + (def.max || 400) });
        controle.addEventListener('input', function () { compteurC.textContent = controle.value.length + ' / ' + (def.max || 400); });
        conteneur.appendChild(compteurC);
      }
      champs[def.id] = { def: def, controle: controle, conteneur: conteneur, erreur: conteneur.querySelector('.champ__erreur') };
      controle.addEventListener('blur', function () { valider(def.id); majApercu(); });
      controle.addEventListener('input', function () { if (conteneur.classList.contains('est-invalide')) valider(def.id); majApercu(); });
      controle.addEventListener('change', majApercu);
      return conteneur;
    }
    var defs = [
      { id: 'nom', libelle: 'Intitulé de l’audit', obligatoire: true, placeholder: 'Ex. : Audit interne — gestion des accès', aide: 'Au moins 8 caractères ; reprendre la convention « Type — objet ».', plein: true, valider: function (v) { if (!v) return 'L’intitulé est obligatoire.'; if (v.length < 8) return 'L’intitulé doit comporter au moins 8 caractères.'; } },
      { id: 'type', libelle: 'Type d’audit', type: 'select', obligatoire: true, options: F.vocabulaire.typesAudit, valider: function (v) { if (!v) return 'Choisir un type d’audit.'; } },
      { id: 'referentiel', libelle: 'Référentiel', type: 'select', obligatoire: true, options: F.referentiels.map(function (r) { return { valeur: r.id, libelle: r.libelle }; }), valider: function (v) { if (!v) return 'Choisir un référentiel.'; } },
      { id: 'site', libelle: 'Site audité', type: 'select', obligatoire: true, options: F.sites, valider: function (v) { if (!v) return 'Choisir un site.'; } },
      { id: 'responsable', libelle: 'Responsable interne', type: 'select', obligatoire: true, options: F.utilisateurs.map(function (u) { return { valeur: u.id, libelle: u.nom + ' — ' + u.role }; }), valider: function (v) { if (!v) return 'Désigner un responsable.'; } },
      { id: 'debut', libelle: 'Date de début', type: 'date', obligatoire: true, aide: 'Format JJ/MM/AAAA.', valider: function (v) { if (!v) return 'La date de début est obligatoire.'; } },
      { id: 'fin', libelle: 'Date de fin', type: 'date', obligatoire: true, aide: 'Égale ou postérieure à la date de début.', valider: function (v, tous) { if (!v) return 'La date de fin est obligatoire.'; if (tous.debut && v < tous.debut) return 'La date de fin doit être postérieure ou égale à la date de début.'; } },
      { id: 'auditeur', libelle: 'Auditeur ou organisme', placeholder: 'Nom de l’auditeur ou de l’organisme', aide: 'Laisser vide pour un audit interne non encore attribué.' },
      { id: 'perimetre', libelle: 'Périmètre', type: 'select', options: ['Périmètre complet du SMSI', 'Hébergement des données de santé', 'Infrastructure et exploitation', 'Processus métier et support', 'Fournisseurs critiques'], vide: 'Non précisé' },
      { id: 'description', libelle: 'Description et objectifs', type: 'textarea', placeholder: 'Objet, mesures ciblées, attentes de la direction…', max: 400, plein: true },
    ];
    var section1 = el('div', { class: 'formulaire__section' }, [el('span', { class: 'formulaire__legende', text: 'Identification' }), el('div', { class: 'formulaire__grille' }, defs.slice(0, 5).map(champ))]);
    var section2 = el('div', { class: 'formulaire__section' }, [el('span', { class: 'formulaire__legende', text: 'Planification' }), el('div', { class: 'formulaire__grille' }, defs.slice(5, 9).map(champ))]);
    var caseConvocation = el('input', { type: 'checkbox', id: 'convoquer', name: 'convoquer', checked: true });
    var section3 = el('div', { class: 'formulaire__section' }, [el('span', { class: 'formulaire__legende', text: 'Contenu' }), el('div', { class: 'formulaire__grille' }, [champ(defs[9]), el('div', { class: 'champ champ--plein' }, [el('label', { class: 'case', for: 'convoquer' }, [caseConvocation, 'Envoyer les convocations aux pilotes de processus à la création'])])])]);
    form.appendChild(section1);
    form.appendChild(section2);
    form.appendChild(section3);
    var annuler = el('button', { class: 'bouton', type: 'reset' }, [icone('boucle'), 'Réinitialiser']);
    var envoyer = el('button', { class: 'bouton bouton--primaire', type: 'submit' }, [icone('ok'), 'Créer l’audit']);
    form.appendChild(el('div', { class: 'formulaire__pied' }, [annuler, envoyer]));

    function valeurs() { var v = {}; Object.keys(champs).forEach(function (k) { v[k] = champs[k].controle.value.trim(); }); return v; }
    function valider(id) {
      var c = champs[id];
      if (!c.def.valider) return true;
      var msg = c.def.valider(c.controle.value.trim(), valeurs());
      if (msg) {
        c.conteneur.classList.add('est-invalide');
        c.controle.setAttribute('aria-invalid', 'true');
        vider(c.erreur);
        c.erreur.appendChild(icone('erreur'));
        c.erreur.appendChild(document.createTextNode(msg));
        return false;
      }
      c.conteneur.classList.remove('est-invalide');
      c.controle.removeAttribute('aria-invalid');
      vider(c.erreur);
      return true;
    }
    form.addEventListener('reset', function () {
      Object.keys(champs).forEach(function (k) { champs[k].conteneur.classList.remove('est-invalide'); champs[k].controle.removeAttribute('aria-invalid'); vider(champs[k].erreur); });
      bandeauErreur.hidden = true;
      bandeauSucces.hidden = true;
      setTimeout(majApercu, 0);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      bandeauSucces.hidden = true;
      var invalides = Object.keys(champs).filter(function (k) { return !valider(k); });
      if (invalides.length) {
        vider(bandeauErreur);
        bandeauErreur.appendChild(icone('erreur'));
        var ul = el('ul', {}, invalides.map(function (k) {
          var lien = el('a', { href: '#' + k, text: champs[k].def.libelle + ' : ' + champs[k].erreur.textContent });
          lien.addEventListener('click', function (ev) { ev.preventDefault(); champs[k].controle.focus(); });
          return el('li', {}, [lien]);
        }));
        bandeauErreur.appendChild(el('div', {}, [el('strong', { text: pluriel(invalides.length, 'champ à corriger', 'champs à corriger') + ' avant l’envoi.' }), ul]));
        bandeauErreur.hidden = false;
        champs[invalides[0]].controle.focus();
        toast('erreur', 'Formulaire incomplet', pluriel(invalides.length, 'champ est invalide', 'champs sont invalides') + '.');
        return;
      }
      bandeauErreur.hidden = true;
      envoyer.disabled = true;
      vider(envoyer);
      envoyer.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' }));
      envoyer.appendChild(document.createTextNode('Envoi en cours…'));
      var v = valeurs();
      setTimeout(function () {
        envoyer.disabled = false;
        vider(envoyer);
        envoyer.appendChild(icone('ok'));
        envoyer.appendChild(document.createTextNode('Créer l’audit'));
        vider(bandeauSucces);
        bandeauSucces.appendChild(icone('ok'));
        bandeauSucces.appendChild(el('div', {}, [el('strong', { text: 'Audit créé (simulation).' }), ' « ' + v.nom + ' » a été ajouté au registre avec l’identifiant ', el('span', { class: 'mono', text: 'AUD-37' }), '. ', el('a', { href: '#/audits', text: 'Voir la liste' }), '.']));
        bandeauSucces.hidden = false;
        toast('succes', 'Audit AUD-37 créé', caseConvocation.checked ? 'Convocations envoyées aux pilotes de processus.' : 'Aucune convocation envoyée.');
        form.reset();
        bandeauSucces.hidden = false;
        bandeauSucces.setAttribute('tabindex', '-1');
        bandeauSucces.focus();
      }, 900);
    });

    /* Aperçu latéral */
    var apercu = el('aside', { class: 'carte apercu', 'aria-label': 'Aperçu de la fiche' });
    var apercuCorps = el('div');
    apercu.appendChild(el('div', { class: 'carte__entete' }, [el('h2', { class: 'carte__titre' }, [icone('fiche'), 'Aperçu']), el('span', { class: 'carte__meta', text: 'AUD-37' })]));
    apercu.appendChild(apercuCorps);
    function majApercu() {
      var v = valeurs();
      vider(apercuCorps);
      var lignes = [
        ['Intitulé', v.nom || '—'],
        ['Type', v.type || '—'],
        ['Référentiel', v.referentiel ? F.referentiel(v.referentiel).court : '—'],
        ['Site', v.site || '—'],
        ['Responsable', v.responsable ? F.utilisateur(v.responsable).nom : '—'],
        ['Période', v.debut ? F.fr(v.debut) + (v.fin ? ' → ' + F.fr(v.fin) : '') : '—'],
        ['Statut initial', 'Planifié'],
      ];
      lignes.forEach(function (l) { apercuCorps.appendChild(el('div', { class: 'apercu__ligne' }, [el('span', { text: l[0] }), el('span', { class: l[0] === 'Période' ? 'mono' : '', text: l[1] })])); });
      var complet = defs.filter(function (d) { return d.obligatoire; }).every(function (d) { return v[d.id]; });
      apercuCorps.appendChild(el('div', { class: 'apercu__ligne' }, [el('span', { text: 'Complétude' }), complet ? badge('Prêt à créer', { ton: 'vert', icone: 'ok' }) : badge('Champs manquants', { ton: 'ambre', icone: 'alerte' })]));
    }
    majApercu();
    frag.appendChild(el('div', { class: 'formulaire' }, [form, apercu]));
    return frag;
  }

  /* ------------------------------------------------------------------ Écran : RETEX */
  function heureCourte(h) { return h.slice(11, 16).replace(':', 'h'); }
  function dateHeure(h) { return F.fr(h.slice(0, 10)) + ' ' + h.slice(11, 16); }
  function ecranRetex() {
    var inc = F.incidents[0];
    var ev = inc.evenements;
    var frag = document.createDocumentFragment();
    var etat = { revele: 1 };
    frag.appendChild(el('nav', { class: 'fil', 'aria-label': 'Fil d’Ariane' }, [el('span', { text: 'Retours d’expérience' }), icone('chevron-d'), el('span', { class: 'mono', text: inc.id })]));
    var entete = el('header', { class: 'carte retex-entete' });
    var duree = Math.round((new Date(inc.fin) - new Date(inc.debut)) / 3600000);
    entete.appendChild(el('div', {}, [
      el('span', { class: 'surtitre', text: inc.id + ' · incident de sécurité' }),
      el('h1', { text: inc.titre }),
      el('div', { class: 'entete-fiche__badges' }, [badge('Gravité max. ' + GRAVITE[inc.graviteMax].libelle.toLowerCase(), GRAVITE[inc.graviteMax]), badge('Clos', { ton: 'vert', icone: 'ok' }), el('span', { class: 'badge badge--gris badge--mono' }, [icone('horloge'), duree + ' h de gestion']), el('span', { class: 'badge badge--gris' }, [icone('utilisateur'), 'Pilote : ' + F.utilisateur(inc.pilote).nom])]),
      el('p', { class: 'retex-impact', text: inc.impact }),
    ]));
    entete.appendChild(el('dl', { class: 'entete-fiche__meta' }, [
      el('div', { class: 'meta-bloc' }, [el('dt', { text: 'Détection' }), el('dd', { class: 'mono', text: dateHeure(inc.debut) })]),
      el('div', { class: 'meta-bloc' }, [el('dt', { text: 'Clôture' }), el('dd', { class: 'mono', text: dateHeure(inc.fin) })]),
    ]));
    frag.appendChild(entete);

    var compteur = el('span', { class: 'retex-compteur', 'aria-live': 'polite' });
    var suivant = el('button', { class: 'bouton bouton--primaire', type: 'button' }, [icone('lecture'), 'Point suivant']);
    var precedent = el('button', { class: 'bouton', type: 'button', 'aria-label': 'Point précédent' }, [icone('chevron-g')]);
    var tout = el('button', { class: 'bouton bouton--contour', type: 'button' }, [icone('fin'), 'Tout dérouler']);
    var reinit = el('button', { class: 'bouton bouton--discret', type: 'button' }, [icone('boucle'), 'Réinitialiser']);
    var commandes = el('div', { class: 'retex-commandes' }, [el('div', { class: 'groupe-boutons' }, [precedent, suivant, tout, reinit]), el('div', {}, [compteur, ' · ', el('span', { class: 'carte__meta', text: 'Flèches ← → ou Espace pour dérouler' })])]);

    var chrono = el('ol', { class: 'retex-chrono', tabindex: '0', role: 'region', 'aria-label': 'Chronologie de l’incident, point par point' });
    var points = ev.map(function (e, i) {
      var g = GRAVITE[e.gravite];
      var li = el('li', { class: 'retex-point retex-point--gravite-' + e.gravite + ' est-masque', id: 'retex-point-' + i });
      li.appendChild(el('div', { class: 'retex-point__ligne' }, [el('span', { class: 'retex-point__heure', text: dateHeure(e.h) }), el('span', { class: 'retex-point__type', text: e.type })]));
      li.appendChild(el('div', {}, [badge('Gravité ' + g.libelle.toLowerCase(), g)]));
      li.appendChild(el('h3', { class: 'retex-point__titre', text: e.titre }));
      li.appendChild(el('p', { class: 'retex-point__detail', text: e.detail }));
      li.appendChild(el('div', { class: 'retex-point__acteur' }, [avatar(e.acteur), F.utilisateur(e.acteur).nom + ' · ' + F.utilisateur(e.acteur).role]));
      chrono.appendChild(li);
      return li;
    });
    var fin = el('div', { class: 'retex-fin', hidden: true }, [carte('Enseignements du RETEX', 'bouclier', [el('ul', { class: 'liste-puces' }, inc.enseignements.map(function (t) { return el('li', {}, [icone('ok'), t]); }))], { meta: inc.enseignements.length + ' enseignements' })]);

    /* Panneau latéral : courbe de gravité et échelle */
    var lateral = el('aside', { class: 'retex-lateral', 'aria-label': 'Lecture de la gravité' });
    var courbeG = svg('svg', { class: 'graphique', viewBox: '0 0 300 150', role: 'img', 'aria-label': 'Évolution de la gravité au fil des événements' });
    var marge = { g: 26, d: 10, h: 10, b: 24 };
    function gx(i) { return marge.g + ((300 - marge.g - marge.d) * i) / (ev.length - 1); }
    function gy(v) { return marge.h + (150 - marge.h - marge.b) * (1 - v / 4); }
    for (var n = 0; n <= 4; n++) {
      courbeG.appendChild(svg('line', { class: n === 0 ? 'axe' : 'grille-h', x1: marge.g, y1: gy(n), x2: 300 - marge.d, y2: gy(n) }));
      courbeG.appendChild(svg('text', { x: marge.g - 6, y: gy(n), 'text-anchor': 'end', 'dominant-baseline': 'middle', text: n }));
    }
    ev.forEach(function (e, i) { if (i % 2 === 0) courbeG.appendChild(svg('text', { x: gx(i), y: 146, 'text-anchor': 'middle', text: heureCourte(e.h) })); });
    var dG = ev.map(function (e, i) { return (i ? 'L' : 'M') + gx(i).toFixed(1) + ' ' + gy(e.gravite).toFixed(1); }).join(' ');
    courbeG.appendChild(svg('path', { class: 'trace trace--lueur', d: dG, stroke: 'var(--ambre)' }));
    courbeG.appendChild(svg('path', { class: 'trace', d: dG, stroke: 'var(--ambre)' }));
    var pointsG = ev.map(function (e, i) {
      var couleur = 'var(' + COULEUR_TON[GRAVITE[e.gravite].ton] + ')';
      var p = svg('circle', { class: 'point point--manuel', cx: gx(i), cy: gy(e.gravite), r: 3.5, stroke: couleur, color: couleur });
      avecInfobulle(p, e.type, GRAVITE[e.gravite].libelle, heureCourte(e.h) + ' · ' + e.titre);
      courbeG.appendChild(p);
      return p;
    });
    lateral.appendChild(carte('Courbe de gravité', 'retex', [courbeG, el('ul', { class: 'retex-echelle', 'aria-label': 'Échelle de gravité' }, GRAVITE.map(function (g, i) { return el('li', {}, [badge(i + ' · ' + g.libelle, g)]); }))], { meta: ev.length + ' événements' }));
    lateral.appendChild(carte('Répartition par phase', 'composants', [graphiqueBarres(
      Object.keys(F.compterPar(ev, 'type')).map(function (t) { return { libelle: t, valeur: F.compterPar(ev, 'type')[t], ton: 'cyan' }; }),
      { aria: 'Nombre d’événements par type', gauche: 112, largeur: 320 }
    )]));

    function maj(ancien) {
      points.forEach(function (li, i) {
        var visible = i < etat.revele;
        li.hidden = !visible;
        li.classList.toggle('est-courant', i === etat.revele - 1);
        if (visible) prochainCadre(function () { li.classList.remove('est-masque'); });
        else li.classList.add('est-masque');
      });
      pointsG.forEach(function (p, i) { p.classList.toggle('est-visible', i < etat.revele); });
      compteur.textContent = '';
      compteur.appendChild(el('strong', { text: etat.revele }));
      compteur.appendChild(document.createTextNode(' / ' + ev.length + ' points'));
      suivant.disabled = etat.revele >= ev.length;
      precedent.disabled = etat.revele <= 1;
      tout.disabled = etat.revele >= ev.length;
      fin.hidden = etat.revele < ev.length;
      if (ancien !== undefined && etat.revele > ancien && etat.revele <= ev.length && !mouvementReduit) {
        var cible = points[etat.revele - 1];
        if (cible.scrollIntoView) cible.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    function avancer() { if (etat.revele < ev.length) { var a = etat.revele; etat.revele++; maj(a); if (etat.revele === ev.length) toast('succes', 'Chronologie complète', 'Les enseignements du RETEX sont affichés.'); } }
    function reculer() { if (etat.revele > 1) { var a = etat.revele; etat.revele--; maj(a); } }
    suivant.addEventListener('click', avancer);
    precedent.addEventListener('click', reculer);
    tout.addEventListener('click', function () { var a = etat.revele; etat.revele = ev.length; maj(a); });
    reinit.addEventListener('click', function () { etat.revele = 1; maj(); chrono.focus(); });
    chrono.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); avancer(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); reculer(); }
      else if (e.key === 'End') { e.preventDefault(); var a = etat.revele; etat.revele = ev.length; maj(a); }
      else if (e.key === 'Home') { e.preventDefault(); etat.revele = 1; maj(); }
    });
    frag.appendChild(el('div', { class: 'retex-grille' }, [el('div', { class: 'demo' }, [commandes, chrono, fin]), lateral]));
    maj();
    return frag;
  }

  /* ------------------------------------------------------------------ Écran : Composants */
  function etatVide(titre, texte, action) {
    var ill = svg('svg', { class: 'etat-vide__illustration', viewBox: '0 0 140 90', 'aria-hidden': 'true', focusable: 'false' });
    ill.appendChild(svg('rect', { x: 20, y: 18, width: 100, height: 60, rx: 6, fill: 'var(--surface-elevee)', stroke: 'var(--bordure-forte)' }));
    ill.appendChild(svg('path', { d: 'M20 34h100', stroke: 'var(--bordure-forte)' }));
    [0, 1, 2].forEach(function (i) { ill.appendChild(svg('rect', { x: 30, y: 44 + i * 10, width: 60 - i * 15, height: 4, rx: 2, fill: 'var(--bordure-forte)' })); });
    ill.appendChild(svg('circle', { cx: 104, cy: 58, r: 12, fill: 'var(--fond-page)', stroke: 'var(--cyan)', 'stroke-width': 1.5 }));
    ill.appendChild(svg('path', { d: 'M100 58h8M104 54v8', stroke: 'var(--cyan)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
    return el('div', { class: 'etat-vide' }, [ill, el('h3', { text: titre }), el('p', { text: texte }), action || null]);
  }
  function ecranComposants() {
    var frag = document.createDocumentFragment();
    frag.appendChild(enteteEcran('Bibliothèque', 'Composants transverses', 'Éléments partagés par tous les écrans : boutons, badges, modale, notifications, états vides et chargement.'));
    var grille = el('div', { class: 'grille grille--2' });

    /* Boutons et badges */
    grille.appendChild(carte('Boutons', 'composants', [el('div', { class: 'demo' }, [
      el('p', { class: 'demo__description', text: 'Un seul bouton primaire par zone ; le contour cyan pour les actions secondaires ; le rouge réservé aux actions destructrices.' }),
      el('div', { class: 'demo__rangee' }, [el('button', { class: 'bouton bouton--primaire', type: 'button' }, [icone('plus'), 'Primaire']), el('button', { class: 'bouton', type: 'button', text: 'Par défaut' }), el('button', { class: 'bouton bouton--contour', type: 'button', text: 'Contour' }), el('button', { class: 'bouton bouton--discret', type: 'button', text: 'Discret' }), el('button', { class: 'bouton bouton--danger', type: 'button' }, [icone('erreur'), 'Danger']), el('button', { class: 'bouton', type: 'button', disabled: true, text: 'Désactivé' })]),
      el('div', { class: 'demo__rangee' }, [el('button', { class: 'bouton bouton--sm', type: 'button', text: 'Petit' }), el('button', { class: 'bouton bouton--sm bouton--primaire', type: 'button', text: 'Petit primaire' }), el('button', { class: 'bouton bouton--sm bouton--icone', type: 'button', 'aria-label': 'Rechercher' }, [icone('recherche')])]),
    ])]));
    var badgesStatut = el('div', { class: 'demo__rangee' }, F.vocabulaire.statutsAudit.map(function (s) { return badge(s, STATUT_AUDIT[s]); }));
    var badgesCrit = el('div', { class: 'demo__rangee' }, F.vocabulaire.criticites.map(function (s) { return badge(s, CRITICITE[s]); }));
    var badgesRef = el('div', { class: 'demo__rangee' }, F.referentiels.map(function (r) { return badgeRef(r.id); }));
    var badgesAction = el('div', { class: 'demo__rangee' }, F.vocabulaire.statutsAction.map(function (s) { return badge(s, STATUT_ACTION[s]); }));
    grille.appendChild(carte('Badges et statuts', 'bouclier', [el('div', { class: 'demo' }, [el('p', { class: 'demo__description', text: 'Capsules en contour : la couleur n’est jamais seule, chaque statut porte une icône et son libellé.' }), badgesStatut, badgesCrit, badgesAction, badgesRef])]));

    /* Modale */
    var ouvrir = el('button', { class: 'bouton bouton--danger', type: 'button' }, [icone('erreur'), 'Clôturer l’audit AUD-07']);
    ouvrir.addEventListener('click', function () {
      ouvrirModale({
        titre: 'Clôturer l’audit ?',
        corps: [el('p', {}, ['Vous allez clôturer ', el('strong', { text: 'AUD-07 — Audit HDS — plateforme régionale' }), '. Les 5 constats resteront ouverts et le plan d’actions sera figé.']), el('p', { text: 'Cette opération est tracée dans le journal et notifiée au responsable.' })],
        confirmer: 'Clôturer',
        danger: true,
        onConfirmer: function () { toast('succes', 'Audit AUD-07 clôturé', 'Le responsable a été notifié.'); },
      });
    });
    var ouvrirInfo = el('button', { class: 'bouton', type: 'button' }, [icone('info'), 'Modale d’information']);
    ouvrirInfo.addEventListener('click', function () {
      ouvrirModale({ titre: 'Synchronisation planifiée', icone: 'info', corps: [el('p', { text: 'La prochaine synchronisation des indicateurs aura lieu le 01/11/2026 à 02:00. Les tableaux de bord resteront consultables.' })], confirmer: 'Compris', annuler: 'Fermer', onConfirmer: function () { toast('info', 'Rappel enregistré'); } });
    });
    grille.appendChild(carte('Modale de confirmation', 'alerte', [el('div', { class: 'demo' }, [el('p', { class: 'demo__description', text: 'role="dialog", focus piégé dans la fenêtre, Échap et clic sur le voile ferment, retour du focus sur le bouton déclencheur.' }), el('div', { class: 'demo__rangee' }, [ouvrir, ouvrirInfo])])]));

    /* Toasts */
    var journal = el('div', { class: 'journal', 'aria-label': 'Journal des notifications', role: 'log' });
    function consigner(niveau, texte) {
      journal.insertBefore(el('div', {}, [el('span', { class: 'heure', text: '09:41:' + String(10 + journal.children.length).padStart(2, '0') }), ' ', el('span', { class: 'niveau-' + niveau, text: '[' + niveau.toUpperCase() + ']' }), ' ' + texte]), journal.firstChild);
    }
    consigner('info', 'Journal prêt.');
    var declencheurs = el('div', { class: 'demo__rangee' }, [
      el('button', { class: 'bouton', type: 'button', onclick: function () { toast('succes', 'Action terminée', 'ACT-12 « Revoir le test de restauration » passée à 100 %.'); consigner('succes', 'ACT-12 terminée'); } }, [icone('ok'), 'Succès']),
      el('button', { class: 'bouton', type: 'button', onclick: function () { toast('alerte', 'Échéance proche', 'C-40 arrive à échéance dans 5 jours.'); consigner('alerte', 'C-40 : J+5'); } }, [icone('alerte'), 'Alerte']),
      el('button', { class: 'bouton', type: 'button', onclick: function () { toast('erreur', 'Export impossible', 'Le service de génération ne répond pas (délai dépassé).'); consigner('erreur', 'Export : délai dépassé'); } }, [icone('erreur'), 'Erreur']),
      el('button', { class: 'bouton', type: 'button', onclick: function () { toast('info', 'Synchronisation terminée', '36 audits et 82 actions à jour.'); consigner('info', 'Synchronisation OK'); } }, [icone('info'), 'Info']),
    ]);
    grille.appendChild(carte('Notifications (toasts)', 'signal', [el('div', { class: 'demo' }, [el('p', { class: 'demo__description', text: 'Région aria-live en bas à droite, fermeture au bouton ou après 6 s (le survol suspend la fermeture). Les erreurs utilisent role="alert".' }), declencheurs, journal])]));

    /* État vide */
    grille.appendChild(carte('État vide', 'vide', [etatVide('Aucune non-conformité ouverte', 'Ce périmètre ne comporte aucune non-conformité à traiter. Les prochains constats apparaîtront ici après la réunion de clôture.', el('a', { class: 'bouton bouton--contour', href: '#/formulaire' }, [icone('plus'), 'Planifier un audit']))]));

    /* Squelette */
    var squelette = el('div', { class: 'squelette', hidden: true, 'aria-hidden': 'true' }, [el('div', { class: 'squelette__ligne squelette__ligne--courte' }), el('div', { class: 'squelette__ligne' }), el('div', { class: 'squelette__ligne squelette__ligne--moyenne' }), el('div', { class: 'squelette__ligne squelette__ligne--haute' }), el('div', { class: 'squelette__ligne squelette__ligne--courte' })]);
    var charge = el('div', { class: 'charge' });
    function remplirCharge() {
      vider(charge);
      var donut = graphiqueDonut(F.vocabulaire.typesConstat.map(function (t, i) { return { libelle: t, valeur: F.kpi.parTypeConstat[t] || 0 }; }), { aria: 'Constats par type', sous: 'constats' });
      charge.appendChild(el('div', { class: 'donut-conteneur' }, [donut.svg, donut.liste]));
      reveler(charge);
    }
    remplirCharge();
    var etatCharge = el('span', { class: 'visuellement-cache', 'aria-live': 'polite' });
    var simuler = el('button', { class: 'bouton', type: 'button' }, [icone('boucle'), 'Simuler un chargement']);
    simuler.addEventListener('click', function () {
      simuler.disabled = true;
      charge.hidden = true;
      squelette.hidden = false;
      etatCharge.textContent = 'Chargement en cours';
      setTimeout(function () {
        squelette.hidden = true;
        charge.hidden = false;
        remplirCharge();
        simuler.disabled = false;
        etatCharge.textContent = 'Chargement terminé';
      }, 1400);
    });
    grille.appendChild(carte('Chargement', 'horloge', [el('div', { class: 'demo' }, [el('p', { class: 'demo__description', text: 'Squelette scintillant pendant la requête, puis fondu du contenu réel. Sous mouvement réduit, le squelette est statique.' }), el('div', { class: 'demo__rangee' }, [simuler, etatCharge]), squelette, charge])]));

    /* Champs */
    var champErr = el('div', { class: 'champ est-invalide' }, [el('label', { class: 'champ__libelle', for: 'demo-champ-err', text: 'Date de fin' }), el('input', { class: 'saisie saisie--mono', id: 'demo-champ-err', type: 'text', value: '30/10/2026', 'aria-invalid': 'true', 'aria-describedby': 'demo-champ-err-msg' }), el('span', { class: 'champ__erreur', id: 'demo-champ-err-msg' }, [icone('erreur'), 'Doit être postérieure à la date de début (31/10/2026).'])]);
    grille.appendChild(carte('Champs et bandeaux', 'formulaire', [el('div', { class: 'demo' }, [
      el('div', { class: 'formulaire__grille' }, [
        el('div', { class: 'champ' }, [el('label', { class: 'champ__libelle', for: 'demo-champ' }, ['Intitulé', el('span', { class: 'obligatoire', 'aria-hidden': 'true', text: '*' })]), el('input', { class: 'saisie', id: 'demo-champ', type: 'text', placeholder: 'Saisir…' }), el('span', { class: 'champ__aide', text: 'Texte d’aide sous le champ.' })]),
        champErr,
      ]),
      el('div', { class: 'bandeau bandeau--info' }, [icone('info'), el('div', {}, [el('strong', { text: 'Information.' }), ' Les données de cette maquette sont fictives et réinitialisées à chaque ouverture.'])]),
      el('div', { class: 'bandeau bandeau--alerte' }, [icone('alerte'), el('div', {}, [el('strong', { text: 'Vigilance.' }), ' 9 actions correctives ont dépassé leur échéance.'])]),
    ])]));
    frag.appendChild(grille);
    return frag;
  }

  /* ------------------------------------------------------------------ Routeur */
  var ECRANS = {
    dashboard: { rendu: ecranDashboard, titre: 'Dashboard' },
    audits: { rendu: ecranAudits, titre: 'Audits' },
    audit: { rendu: ecranAudit, titre: 'Fiche audit' },
    formulaire: { rendu: ecranFormulaire, titre: 'Nouvel audit' },
    retex: { rendu: ecranRetex, titre: 'RETEX' },
    composants: { rendu: ecranComposants, titre: 'Composants' },
  };
  function analyserHash() {
    var h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = h.split('/');
    var nom = parts[0] || 'dashboard';
    if (!ECRANS[nom]) nom = 'dashboard';
    return { nom: nom, param: parts[1] || (nom === 'audit' ? 'AUD-07' : null) };
  }
  function rendre() {
    var route = analyserHash();
    fermerModale();
    cacherInfobulle();
    var premierRendu = !ecranEl.firstChild;
    vider(ecranEl);
    ecranEl.classList.remove('est-entrant');
    ecranEl.appendChild(ECRANS[route.nom].rendu(route.param));
    if (!premierRendu) {
      void ecranEl.offsetWidth;
      ecranEl.classList.add('est-entrant');
    }
    Array.prototype.forEach.call(document.querySelectorAll('.nav__lien'), function (a) {
      if (a.dataset.ecran === route.nom) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = ECRANS[route.nom].titre + (route.nom === 'audit' && route.param ? ' ' + route.param : '') + ' — Suivi des audits SMSI (maquette D)';
    reveler(ecranEl);
    document.getElementById('contenu').scrollTop = 0;
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', rendre);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'route' && typeof d.hash === 'string' && d.hash.charAt(0) === '#') {
      if (location.hash === d.hash) rendre();
      else location.hash = d.hash;
    }
  });
  rendreBarreEtat();
  if (!location.hash) location.hash = '#/dashboard';
  else rendre();
})();
