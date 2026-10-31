/* Maquette A — FIDÈLE. Rendu des écrans, graphiques SVG natifs, interactions.
   JS natif, sans module ni dépendance. Données : window.FAKE (../shared/fake-data.js). Aucune persistance. */
(function () {
  'use strict';

  var F = window.FAKE;
  var contenu = document.getElementById('contenu');
  var mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ================================================================ Utilitaires */
  function $(sel, racine) { return (racine || document).querySelector(sel); }
  function $$(sel, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(nom, classe) {
    return '<svg class="icone' + (classe ? ' ' + classe : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + nom + '"/></svg>';
  }
  function jeton(nom) { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }
  function heure(h) { return h.slice(11, 16).replace(':', ' h '); }
  function jourCourt(h) { var p = h.slice(0, 10).split('-'); return p[2] + '/' + p[1]; }
  function dureeHeures(a, b) {
    var h = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 36e5);
    var j = Math.floor(h / 24);
    return j ? j + ' j ' + (h - j * 24) + ' h' : h + ' h';
  }
  function dateLongue(iso) {
    var p = iso.split('-');
    var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return parseInt(p[2], 10) + ' ' + MOIS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  /* Variables CSS dynamiques : data-p → --p, data-c → --c (jamais d'attribut style dans le HTML). */
  function appliquerVariables(racine) {
    $$('[data-p]', racine).forEach(function (el) { el.style.setProperty('--p', el.getAttribute('data-p')); });
    $$('[data-c]', racine).forEach(function (el) { el.style.setProperty('--c', el.getAttribute('data-c')); });
    $$('[data-part]', racine).forEach(function (el) { el.style.setProperty('--part', el.getAttribute('data-part')); });
  }

  /* Emplacements de graphiques dimensionnés sur la largeur réelle du conteneur (texte SVG à taille constante). */
  var slots = {}, slotId = 0;
  function slot(fabrique, classe) {
    slotId++;
    slots[slotId] = fabrique;
    return '<div class="slot' + (classe ? ' ' + classe : '') + '" data-slot="' + slotId + '"></div>';
  }
  function remplirSlots(racine, immediat) {
    $$('[data-slot]', racine).forEach(function (el) {
      var largeur = el.clientWidth, hauteur = el.clientHeight;
      if (!largeur) return;
      if (el.getAttribute('data-largeur') === String(largeur)) return;
      var fabrique = slots[el.getAttribute('data-slot')];
      if (!fabrique) return;
      el.setAttribute('data-largeur', String(largeur));
      el.innerHTML = fabrique(largeur, hauteur);
      animerGraphiques(el, immediat);
    });
  }
  var minuterieRedim = null;
  window.addEventListener('resize', function () {
    clearTimeout(minuterieRedim);
    minuterieRedim = setTimeout(function () { remplirSlots(contenu, true); }, 150);
  });

  /* ================================================================ Vocabulaire visuel (couleur + icône + libellé) */
  var STATUT_AUDIT = {
    'Planifié': { cls: 'gris', ico: 'calendrier', c: '--donnee-gris' },
    'En préparation': { cls: 'violet', ico: 'crayon', c: '--donnee-violet' },
    'En cours': { cls: 'info', ico: 'lecture', c: '--donnee-bleu' },
    'Rapport attendu': { cls: 'alerte', ico: 'rapport', c: '--alerte' },
    'Clos': { cls: 'succes', ico: 'coche-cercle', c: '--donnee-vert' },
    'Reporté': { cls: 'jaune', ico: 'pause', c: '--jaune' },
  };
  var CRITICITE = {
    'Critique': { cls: 'erreur', ico: 'alerte', c: '--erreur' },
    'Majeure': { cls: 'alerte', ico: 'alerte', c: '--alerte' },
    'Mineure': { cls: 'jaune', ico: 'info', c: '--jaune' },
    'Observation': { cls: 'gris', ico: 'point', c: '--donnee-gris' },
  };
  var STATUT_CONSTAT = {
    'Ouvert': { cls: 'erreur', ico: 'erreur' },
    'En cours': { cls: 'info', ico: 'lecture' },
    'À vérifier': { cls: 'jaune', ico: 'horloge' },
    'Clos': { cls: 'succes', ico: 'coche-cercle' },
  };
  var STATUT_ACTION = {
    'À faire': { cls: 'gris', ico: 'point', c: '--donnee-gris' },
    'En cours': { cls: 'info', ico: 'lecture', c: '--info' },
    'Bloquée': { cls: 'erreur', ico: 'bloque', c: '--erreur' },
    'Terminée': { cls: 'succes', ico: 'coche-cercle', c: '--succes' },
  };
  var REF_CLS = { vert: 'vert', bleu: 'info', violet: 'marque-violet', orange: 'alerte', gris: 'gris' };
  /* c : couleur de composant (pastille, bordure, barre, >= 3:1) ; t : variante texte (>= 4,5:1 sur blanc et fond de page) */
  var GRAVITE = [
    { ico: 'coche-cercle', c: '--donnee-gris', t: '--texte-2' },
    { ico: 'info', c: '--info', t: '--info-texte' },
    { ico: 'info', c: '--jaune', t: '--jaune-texte' },
    { ico: 'alerte', c: '--alerte', t: '--alerte-texte' },
    { ico: 'alerte', c: '--erreur', t: '--erreur-texte' },
  ];
  var TYPE_EVENEMENT_ICO = {
    'Détection': 'recherche', 'Qualification': 'filtre', 'Alerte et escalade': 'alerte', 'Analyse': 'cible', 'Confinement': 'bouclier',
    'Décision': 'coche', 'Communication': 'info', 'Éradication': 'erreur', 'Rétablissement': 'recommencer', 'Clôture': 'coche-cercle',
  };

  function badge(libelle, def, extra) {
    def = def || { cls: 'gris' };
    return '<span class="badge badge--' + def.cls + (extra ? ' ' + extra : '') + '">' + (def.ico ? ico(def.ico) : '') + esc(libelle) + '</span>';
  }
  function badgeStatutAudit(s) { return badge(s, STATUT_AUDIT[s]); }
  function badgeCriticite(c) { return badge(c, CRITICITE[c]); }
  function badgeStatutConstat(s) { return badge(s, STATUT_CONSTAT[s]); }
  function badgeStatutAction(s) { return badge(s, STATUT_ACTION[s]); }
  function badgeReferentiel(id) { var r = F.referentiel(id); return '<span class="badge badge--' + REF_CLS[r.couleur] + '" title="' + esc(r.libelle) + '">' + esc(r.court) + '</span>'; }
  function badgeType(t) { return '<span class="badge badge--contour">' + esc(t) + '</span>'; }
  function gravite(n) {
    var g = GRAVITE[n];
    return '<span class="gravite" data-c="var(' + g.t + ')">' + ico(g.ico) + 'Gravité ' + esc(F.vocabulaire.gravitesRetex[n].toLowerCase()) + '</span>';
  }
  function avatar(id, classe) { var u = F.utilisateur(id); return '<span class="avatar' + (classe ? ' ' + classe : '') + '" aria-hidden="true">' + esc(u.initiales) + '</span>'; }
  function personne(id, avecRole) {
    var u = F.utilisateur(id);
    return '<span class="personne" title="' + esc(u.nom) + '">' + avatar(id) + '<span class="personne__textes"><span class="personne__nom">' + esc(u.nom) + '</span>' + (avecRole ? '<span class="personne__role">' + esc(u.role) + '</span>' : '') + '</span></span>';
  }
  function progression(valeur, variante, sansChiffre) {
    return '<div class="progression' + (variante ? ' progression--' + variante : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + valeur + '" aria-label="Progression ' + valeur + ' %">' +
      '<div class="progression__piste"><div class="progression__valeur" data-p="' + (valeur / 100) + '"></div></div>' +
      (sansChiffre ? '' : '<span class="progression__chiffre">' + valeur + ' %</span>') + '</div>';
  }
  function delai(jours) {
    if (jours < 0) return '<span class="echeance-delai echeance-delai--depasse">' + ico('alerte') + 'Dépassée de ' + pluriel(-jours, 'jour', 'jours') + '</span>';
    if (jours === 0) return '<span class="echeance-delai echeance-delai--proche">' + ico('horloge') + 'Aujourd’hui</span>';
    if (jours <= 14) return '<span class="echeance-delai echeance-delai--proche">' + ico('horloge') + 'Dans ' + pluriel(jours, 'jour', 'jours') + '</span>';
    return '<span class="echeance-delai">' + ico('calendrier') + 'Dans ' + pluriel(jours, 'jour', 'jours') + '</span>';
  }

  /* ================================================================ Info-bulle des graphiques */
  var bulle = document.getElementById('info-bulle');
  function montrerBulle(el, x, y) {
    var titre = el.getAttribute('data-tip-titre');
    bulle.innerHTML = (titre ? '<strong>' + esc(titre) + '</strong>' : '') + esc(el.getAttribute('data-tip'));
    positionnerBulle(x, y);
    bulle.classList.add('est-visible');
    bulle.setAttribute('aria-hidden', 'false');
  }
  function positionnerBulle(x, y) {
    bulle.classList.toggle('info-bulle--gauche', x > window.innerWidth - 240);
    bulle.style.setProperty('--tx', x + 'px');
    bulle.style.setProperty('--ty', y + 'px');
  }
  function cacherBulle() { bulle.classList.remove('est-visible'); bulle.setAttribute('aria-hidden', 'true'); }
  document.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) montrerBulle(t, e.clientX, e.clientY); });
  document.addEventListener('mousemove', function (e) { if (bulle.classList.contains('est-visible') && e.target.closest && e.target.closest('[data-tip]')) positionnerBulle(e.clientX, e.clientY); });
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) cacherBulle(); });
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) { var r = t.getBoundingClientRect(); montrerBulle(t, r.right, r.top + r.height / 2); } });
  document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) cacherBulle(); });

  /* ================================================================ Graphiques SVG */
  function svgOuvrir(w, h, classe, label) {
    return '<svg class="graphique' + (classe ? ' ' + classe : '') + '" viewBox="0 0 ' + w + ' ' + h + '" role="group" aria-label="' + esc(label) + '" preserveAspectRatio="xMidYMid meet">';
  }
  /* Barres horizontales : [{libelle, valeur, couleur}] */
  function barresHorizontales(donnees, label, L, hauteur) {
    L = Math.max(260, L || 420);
    var pas = hauteur ? Math.max(32, Math.min(46, Math.floor((hauteur - 6) / donnees.length))) : 34;
    var H = donnees.length * pas + 6, x0 = Math.min(142, Math.round(L * 0.34)), largeur = L - x0 - 40, dy = Math.round((pas - 22) / 2);
    var max = Math.max.apply(null, donnees.map(function (d) { return d.valeur; })) || 1;
    var s = svgOuvrir(L, H, '', label);
    donnees.forEach(function (d, i) {
      var y = i * pas + dy, w = Math.max(2, (d.valeur / max) * largeur);
      var tip = d.valeur + ' ' + (d.unite || (d.valeur > 1 ? 'audits' : 'audit')) + (d.part != null ? ' · ' + d.part + ' %' : '');
      s += '<text class="etiquette" x="0" y="' + (y + 17) + '">' + esc(d.libelle) + '</text>';
      s += '<rect class="piste-barre" x="' + x0 + '" y="' + y + '" width="' + largeur + '" height="22" rx="4" fill="' + jeton('--surface-douce') + '"/>';
      s += '<rect class="barre" x="' + x0 + '" y="' + y + '" width="' + w + '" height="22" rx="4" fill="' + jeton(d.couleur) + '" tabindex="0" role="img" aria-label="' + esc(d.libelle + ' : ' + tip) + '" data-tip-titre="' + esc(d.libelle) + '" data-tip="' + esc(tip) + '"/>';
      s += '<text class="etiquette etiquette--valeur" x="' + (x0 + w + 8) + '" y="' + (y + 16) + '">' + d.valeur + '</text>';
    });
    return s + '</svg>';
  }
  /* Barres verticales compactes (RETEX : gravité par étape) */
  function barresVerticales(donnees, max, label) {
    var L = 320, H = 110, base = 86, hMax = 70, n = donnees.length, pas = L / n, w = Math.min(18, pas * 0.6);
    var s = svgOuvrir(L, H, '', label);
    [0, 2, 4].forEach(function (v) { var y = base - (v / max) * hMax; s += '<line class="grille-ligne" x1="0" x2="' + L + '" y1="' + y + '" y2="' + y + '"/>'; });
    donnees.forEach(function (d, i) {
      var x = i * pas + (pas - w) / 2, h = Math.max(2, (d.valeur / max) * hMax), y = base - h;
      s += '<rect class="barre barre--verticale" data-index="' + i + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + jeton(d.couleur) + '" tabindex="0" role="img" aria-label="' + esc(d.libelle + ' : ' + d.tip) + '" data-tip-titre="' + esc(d.libelle) + '" data-tip="' + esc(d.tip) + '"/>';
      s += '<text x="' + (x + w / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + (i + 1) + '</text>';
    });
    return s + '</svg>';
  }
  /* Anneau (donut) : [{libelle, valeur, couleur}] ; texte central */
  function anneau(donnees, centre, sous, label) {
    var r = 58, C = 2 * Math.PI * r, total = donnees.reduce(function (a, d) { return a + d.valeur; }, 0) || 1, debut = 0;
    var s = svgOuvrir(160, 160, 'graphique--anneau', label);
    s += '<circle class="piste" cx="80" cy="80" r="' + r + '" stroke-width="18"/>';
    donnees.forEach(function (d) {
      var l = (d.valeur / total) * C, angle = (debut / total) * 360 - 90;
      var tip = d.valeur + ' · ' + pct(d.valeur, total) + ' %';
      s += '<circle class="arc" cx="80" cy="80" r="' + r + '" stroke="' + jeton(d.couleur) + '" stroke-width="18" stroke-dasharray="' + l.toFixed(2) + ' ' + (2 * C).toFixed(2) + '" stroke-dashoffset="' + l.toFixed(2) + '" data-offset-final="0" transform="rotate(' + angle.toFixed(2) + ' 80 80)" tabindex="0" role="img" aria-label="' + esc(d.libelle + ' : ' + tip) + '" data-tip-titre="' + esc(d.libelle) + '" data-tip="' + esc(tip) + '"/>';
      debut += d.valeur;
    });
    s += '<text class="centre" x="80" y="78" text-anchor="middle">' + esc(centre) + '</text>';
    s += '<text class="centre--sous" x="80" y="98" text-anchor="middle">' + esc(sous) + '</text>';
    return s + '</svg>';
  }
  /* Jauge demi-circulaire : valeur et cible en % */
  function jauge(valeur, cible, unite, label) {
    var R = 80, cx = 100, cy = 100, len = Math.PI * R, l = (valeur / 100) * len;
    var a = Math.PI * (1 - cible / 100), tx1 = cx + (R - 14) * Math.cos(a), ty1 = cy - (R - 14) * Math.sin(a), tx2 = cx + (R + 14) * Math.cos(a), ty2 = cy - (R + 14) * Math.sin(a);
    var d = 'M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy;
    var s = svgOuvrir(200, 122, 'graphique--jauge', label);
    s += '<path class="piste" d="' + d + '" stroke-width="16" stroke-linecap="round"/>';
    s += '<path class="arc" d="' + d + '" stroke="' + jeton('--vert') + '" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + l.toFixed(2) + ' ' + (2 * len).toFixed(2) + '" stroke-dashoffset="' + l.toFixed(2) + '" data-offset-final="0" tabindex="0" role="img" aria-label="' + esc(label + ' : ' + valeur + ' ' + unite + ', cible ' + cible + ' ' + unite) + '" data-tip-titre="Valeur actuelle" data-tip="' + valeur + ' ' + unite + ' (cible ' + cible + ' ' + unite + ')"/>';
    s += '<line class="repere-cible" x1="' + tx1.toFixed(1) + '" y1="' + ty1.toFixed(1) + '" x2="' + tx2.toFixed(1) + '" y2="' + ty2.toFixed(1) + '"><title>Cible ' + cible + ' ' + unite + '</title></line>';
    s += '<text class="jauge-valeur" x="100" y="92" text-anchor="middle">' + valeur + '<tspan font-size="16" font-weight="500"> ' + esc(unite) + '</tspan></text>';
    s += '<text class="jauge-libelle" x="100" y="114" text-anchor="middle">cible ' + cible + ' ' + esc(unite) + '</text>';
    return s + '</svg>';
  }
  /* Petit anneau de KPI */
  function anneauMini(valeur, couleur) {
    var r = 19, C = 2 * Math.PI * r, l = (valeur / 100) * C;
    return '<svg class="graphique graphique--mini" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<circle class="piste" cx="24" cy="24" r="' + r + '" stroke-width="5"/>' +
      '<circle class="arc" cx="24" cy="24" r="' + r + '" stroke="' + jeton(couleur) + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + l.toFixed(2) + ' ' + (2 * C).toFixed(2) + '" stroke-dashoffset="' + l.toFixed(2) + '" data-offset-final="0" transform="rotate(-90 24 24)"/></svg>';
  }
  /* Courbe d'évolution : séries [{nom, valeurs, couleur}], libellés x */
  function courbe(series, libelles, label, L, hauteur) {
    L = Math.max(360, L || 640);
    var H = Math.max(220, Math.min(hauteur || 260, 420)), pl = 34, pr = 16, pt = 14, pb = 30, w = L - pl - pr, h = H - pt - pb;
    var pasLibelle = L < 560 ? 2 : 1;
    var max = 0;
    series.forEach(function (s) { s.valeurs.forEach(function (v) { if (v > max) max = v; }); });
    max = Math.ceil(max / 5) * 5 || 5;
    var n = libelles.length, px = function (i) { return pl + (i * w) / (n - 1); }, py = function (v) { return pt + h - (v / max) * h; };
    var s = svgOuvrir(L, H, 'graphique--courbe', label);
    for (var g = 0; g <= max; g += 5) {
      s += '<line class="' + (g === 0 ? 'axe' : 'grille-ligne') + '" x1="' + pl + '" x2="' + (L - pr) + '" y1="' + py(g) + '" y2="' + py(g) + '"/>';
      s += '<text x="' + (pl - 8) + '" y="' + (py(g) + 4) + '" text-anchor="end">' + g + '</text>';
    }
    libelles.forEach(function (m, i) { if (i % pasLibelle === 0) s += '<text x="' + px(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(m) + '</text>'; });
    series.forEach(function (se) {
      var pts = se.valeurs.map(function (v, i) { return px(i).toFixed(1) + ' ' + py(v).toFixed(1); });
      var d = 'M ' + pts.join(' L ');
      s += '<path class="aire" d="' + d + ' L ' + px(n - 1).toFixed(1) + ' ' + py(0) + ' L ' + px(0).toFixed(1) + ' ' + py(0) + ' Z" fill="' + jeton(se.couleur) + '"/>';
      s += '<path class="courbe" d="' + d + '" stroke="' + jeton(se.couleur) + '"/>';
      se.valeurs.forEach(function (v, i) { s += '<circle class="point" cx="' + px(i).toFixed(1) + '" cy="' + py(v).toFixed(1) + '" r="3.5" stroke="' + jeton(se.couleur) + '"/>'; });
    });
    /* colonnes de survol (info-bulle + clavier) */
    libelles.forEach(function (m, i) {
      var x1 = i === 0 ? pl : (px(i - 1) + px(i)) / 2, x2 = i === n - 1 ? L - pr : (px(i) + px(i + 1)) / 2;
      var tip = series.map(function (se) { return se.nom + ' : ' + se.valeurs[i]; }).join(' · ');
      s += '<rect class="colonne-survol" x="' + x1.toFixed(1) + '" y="' + pt + '" width="' + (x2 - x1).toFixed(1) + '" height="' + h + '" tabindex="0" role="img" aria-label="' + esc(m + ' — ' + tip) + '" data-tip-titre="' + esc(m) + '" data-tip="' + esc(tip) + '"/>';
    });
    return s + '</svg>';
  }
  /* Sparkline (indicateurs) */
  function sparkline(valeurs, couleur) {
    var L = 120, H = 36, min = Math.min.apply(null, valeurs), max = Math.max.apply(null, valeurs), ecart = max - min || 1;
    var pts = valeurs.map(function (v, i) { return (4 + (i * (L - 8)) / (valeurs.length - 1)).toFixed(1) + ' ' + (H - 4 - ((v - min) / ecart) * (H - 8)).toFixed(1); });
    var dernier = pts[pts.length - 1].split(' ');
    return '<svg class="graphique graphique--mini" viewBox="0 0 ' + L + ' ' + H + '" aria-hidden="true" focusable="false">' +
      '<path class="courbe" d="M ' + pts.join(' L ') + '" stroke="' + jeton(couleur) + '"/>' +
      '<circle class="point" cx="' + dernier[0] + '" cy="' + dernier[1] + '" r="3" stroke="' + jeton(couleur) + '"/></svg>';
  }
  /* Lance les animations d'entrée des graphiques et barres de progression (transform, opacity, stroke-dashoffset). */
  function animerGraphiques(racine, immediat) {
    $$('.courbe', racine).forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 0;
      if (!len) return;
      p.setAttribute('stroke-dasharray', len);
      p.setAttribute('stroke-dashoffset', len);
    });
    /* force la prise en compte des états initiaux avant la transition */
    void racine.offsetWidth;
    (immediat ? function (fn) { fn(); } : requestAnimationFrame)(function () {
      $$('.graphique', racine).forEach(function (g) { g.classList.add('est-anime'); });
      $$('.courbe', racine).forEach(function (p) { p.setAttribute('stroke-dashoffset', 0); });
      $$('[data-offset-final]', racine).forEach(function (a) { a.setAttribute('stroke-dashoffset', a.getAttribute('data-offset-final')); });
    });
  }

  /* ================================================================ Toasts */
  var zoneToasts = document.getElementById('toasts');
  var TOAST_ICO = { succes: 'coche-cercle', alerte: 'alerte', erreur: 'erreur', info: 'info' };
  var TOAST_TITRE = { succes: 'Succès', alerte: 'Attention', erreur: 'Erreur', info: 'Information' };
  function toast(type, titre, texte, duree) {
    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
    el.innerHTML = '<span class="toast__icone">' + ico(TOAST_ICO[type]) + '</span>' +
      '<div><p class="toast__titre">' + esc(titre || TOAST_TITRE[type]) + '</p>' + (texte ? '<p class="toast__texte">' + esc(texte) + '</p>' : '') + '</div>' +
      '<button class="bouton bouton--icone bouton--fantome bouton--sm" type="button" aria-label="Fermer la notification">' + ico('fermer') + '</button>';
    zoneToasts.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('est-visible'); }); });
    var minuterie = setTimeout(fermer, duree || 6000);
    function fermer() {
      clearTimeout(minuterie);
      el.classList.add('est-sortant');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, mouvementReduit.matches ? 130 : 260);
    }
    $('button', el).addEventListener('click', fermer);
    return el;
  }

  /* ================================================================ Modale (role=dialog, piège de focus, Échap) */
  var modale = document.getElementById('modale');
  var boite = $('.modale__boite', modale);
  var declencheurModale = null, surConfirmation = null;
  function ouvrirModale(options) {
    declencheurModale = document.activeElement;
    surConfirmation = options.confirmer || null;
    $('#modale-titre').textContent = options.titre;
    $('#modale-texte').textContent = options.texte;
    var btn = $('#modale-confirmer');
    btn.textContent = options.libelleConfirmer || 'Confirmer';
    btn.className = 'bouton ' + (options.danger ? 'bouton--danger' : 'bouton--plein');
    modale.hidden = false;
    document.body.classList.add('modale-ouverte');
    requestAnimationFrame(function () { requestAnimationFrame(function () { modale.classList.add('est-ouverte'); btn.focus(); }); });
  }
  function fermerModale() {
    modale.classList.remove('est-ouverte');
    document.body.classList.remove('modale-ouverte');
    setTimeout(function () { modale.hidden = true; }, mouvementReduit.matches ? 130 : 260);
    if (declencheurModale && declencheurModale.focus) declencheurModale.focus();
  }
  $$('[data-fermer-modale]', modale).forEach(function (b) { b.addEventListener('click', fermerModale); });
  $('#modale-confirmer').addEventListener('click', function () { var cb = surConfirmation; fermerModale(); if (cb) cb(); });
  modale.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); fermerModale(); return; }
    if (e.key !== 'Tab') return;
    var focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', boite).filter(function (el) { return !el.disabled; });
    if (!focusables.length) return;
    var premier = focusables[0], dernier = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === premier || document.activeElement === boite)) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  });

  /* ================================================================ Coquille : navigation, fil d'Ariane, date */
  function initialiserCoquille() {
    $('#entete-date').textContent = 'Situation au ' + F.frLong(F.aujourdhui);
    $('#nav-org').textContent = F.organisation.nom;
    $('#nav-app').textContent = F.organisation.application;
    $('#nav-nb-audits').textContent = F.audits.length;
    $('#nav-nom').textContent = F.moi.nom;
    $('#nav-role').textContent = F.moi.role;
    $('#nav-avatar').textContent = F.moi.initiales;
    var etroit = window.matchMedia('(max-width: 1100px)');
    function appliquerRepli(replie) {
      document.body.classList.toggle('nav-repliee', replie);
      var b = $('#nav-replier');
      b.setAttribute('aria-pressed', String(replie));
      b.setAttribute('aria-label', replie ? 'Déplier la navigation' : 'Replier la navigation');
      b.title = b.getAttribute('aria-label');
    }
    appliquerRepli(etroit.matches);
    etroit.addEventListener('change', function (e) { appliquerRepli(e.matches); });
    $('#nav-replier').addEventListener('click', function () { appliquerRepli(!document.body.classList.contains('nav-repliee')); });
    $('#bouton-deconnexion').addEventListener('click', function () { toast('info', 'Déconnexion simulée', 'Dans l’application réelle, la session serait fermée.'); });
  }
  function filAriane(items) {
    $('#fil-ariane').innerHTML = '<ol>' + items.map(function (it, i) {
      var dernier = i === items.length - 1;
      return '<li>' + (it.href && !dernier ? '<a href="' + it.href + '">' + esc(it.libelle) + '</a>' : '<span' + (dernier ? ' aria-current="page"' : '') + '>' + esc(it.libelle) + '</span>') + '</li>';
    }).join('') + '</ol>';
  }
  function marquerNavigation(route) {
    $$('.nav__lien').forEach(function (a) {
      if (a.getAttribute('data-route') === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ================================================================ Écran 1 : tableau de bord */
  function ecranDashboard() {
    var K = F.kpi, conf = F.indicateurs[0];
    var evolConf = conf.valeur - conf.historique[conf.historique.length - 4];
    var ordreStatuts = F.vocabulaire.statutsAudit;
    var ordreCrit = ['Critique', 'Majeure', 'Mineure'];
    var ordreActions = ['Terminée', 'En cours', 'À faire', 'Bloquée'];
    var depassees = K.echeancesDepassees.length;
    var ncParCrit = ordreCrit.map(function (c) { return { libelle: c, valeur: K.parCriticiteNC[c] || 0, couleur: CRITICITE[c].c }; });
    var solde = F.evolution.reduce(function (a, m) { return a + m.ouverts - m.clos; }, 0);
    var indicateursChoisis = [F.indicateurs[1], F.indicateurs[2], F.indicateurs[3], F.indicateurs[4]];

    var html = '<section class="ecran" aria-labelledby="titre-ecran">' +
      '<header class="ecran__entete"><div class="ecran__titres"><p class="ecran__surtitre">Pilotage</p><h1 id="titre-ecran">Tableau de bord SMSI</h1>' +
      '<p class="ecran__sous-titre">' + esc(F.organisation.nom) + ' · ' + esc(F.organisation.periode) + ' · situation au ' + esc(dateLongue(F.aujourdhui)) + '</p></div>' +
      '<div class="ecran__actions"><button class="bouton bouton--defaut" type="button" data-action="exporter">' + ico('rapport') + 'Exporter la synthèse</button>' +
      '<a class="bouton bouton--plein" href="#/formulaire">' + ico('plus') + 'Nouvel audit</a></div></header>';

    /* KPI */
    html += '<div class="kpis">' +
      kpi('#/audits', 'Audits en cours', K.auditsEnCours, '', 'info', 'calendrier', pluriel(K.auditsAVenir, 'audit à venir', 'audits à venir')) +
      kpi('#/audits', 'Constats ouverts', K.constatsOuverts, '', 'attention', 'alerte', pluriel(K.ncOuvertes, 'non-conformité', 'non-conformités')) +
      kpi('#/audits', 'Actions en retard', K.actionsEnRetard, '', K.actionsEnRetard ? 'alerte' : 'ok', K.actionsEnRetard ? 'alerte' : 'coche-cercle', 'sur ' + pluriel(K.actions, 'action', 'actions')) +
      '<div class="kpi kpi--jauge"><p class="kpi__libelle">Conformité ISO 27001</p><p class="kpi__valeur">' + K.conformite + '<span class="kpi__unite">%</span></p>' +
      '<p class="kpi__detail kpi__detail--' + (evolConf >= 0 ? 'ok' : 'alerte') + '">' + ico(evolConf >= 0 ? 'fleche-haut' : 'fleche-bas') + (evolConf >= 0 ? '+' : '') + evolConf + ' pt / 3 mois · cible ' + conf.cible + ' %</p>' +
      '<div class="kpi__jauge">' + anneauMini(K.conformite, '--vert') + '</div></div>' +
      kpi(null, 'Risques élevés', K.risquesEleves, '', K.risquesEleves ? 'attention' : 'ok', 'bouclier', 'sur ' + pluriel(F.risques.length, 'risque suivi', 'risques suivis')) +
      '</div>';

    /* Rangée graphiques */
    html += '<div class="grille">';
    html += '<article class="carte col-4"><div class="carte__entete"><div><h2 class="carte__titre">État des audits par statut</h2><p class="carte__sous-titre">' + F.audits.length + ' audits du cycle</p></div></div>' +
      slot(function (L, H) { return barresHorizontales(ordreStatuts.map(function (s) { var v = K.parStatutAudit[s] || 0; return { libelle: s, valeur: v, couleur: STATUT_AUDIT[s].c, part: pct(v, F.audits.length) }; }), 'Répartition des audits par statut', L, H); }) +
      '<div class="carte__pied"><span>' + ico('info') + ' ' + pluriel(K.auditsEnCours, 'audit actif', 'audits actifs') + ' (en cours ou rapport attendu)</span><a class="carte__lien" href="#/audits">Voir la liste ' + ico('fleche-droite') + '</a></div></article>';

    html += '<article class="carte col-4"><div class="carte__entete"><div><h2 class="carte__titre">Non-conformités ouvertes</h2><p class="carte__sous-titre">Par criticité, hors constats clos</p></div></div>' +
      '<div class="donut-bloc">' + anneau(ncParCrit, String(K.ncOuvertes), 'NC ouvertes', 'Non-conformités ouvertes par criticité') +
      '<ul class="legende legende--colonne">' + ncParCrit.map(function (d) { return '<li class="legende__item"><span><span class="legende__puce" data-c="var(' + d.couleur + ')"></span>' + ico(CRITICITE[d.libelle].ico, 'icone--sm') + esc(d.libelle) + '</span><span class="legende__valeur">' + d.valeur + '</span></li>'; }).join('') + '</ul></div>' +
      '<div class="carte__pied"><span>' + ico('horloge') + ' Délai moyen de clôture : ' + F.indicateurs[2].valeur + ' j (cible ' + F.indicateurs[2].cible + ' j)</span></div></article>';

    html += '<article class="carte col-4"><div class="carte__entete"><div><h2 class="carte__titre">Avancement des actions correctives</h2><p class="carte__sous-titre">' + K.actions + ' actions issues des constats</p></div></div>' +
      '<p class="kpi__valeur">' + pct(K.actionsTerminees, K.actions) + '<span class="kpi__unite">% terminées</span></p>' +
      '<div class="empilee" role="img" aria-label="' + ordreActions.map(function (s) { return s + ' : ' + (K.parStatutAction[s] || 0); }).join(', ') + '">' +
      ordreActions.map(function (s) { var v = K.parStatutAction[s] || 0; return '<div class="empilee__segment" data-part="' + (v / K.actions) + '" data-c="var(' + STATUT_ACTION[s].c + ')" data-tip-titre="' + esc(s) + '" data-tip="' + v + ' actions · ' + pct(v, K.actions) + ' %"></div>'; }).join('') + '</div>' +
      '<ul class="legende legende--colonne">' + ordreActions.map(function (s) { var v = K.parStatutAction[s] || 0; return '<li class="legende__item"><span><span class="legende__puce" data-c="var(' + STATUT_ACTION[s].c + ')"></span>' + ico(STATUT_ACTION[s].ico, 'icone--sm') + esc(s) + '</span><span class="legende__valeur">' + v + '</span></li>'; }).join('') + '</ul>' +
      '<div class="carte__pied"><span class="echeance-delai echeance-delai--depasse">' + ico('alerte') + pluriel(K.actionsEnRetard, 'action en retard', 'actions en retard') + '</span><a class="carte__lien" href="#/audit/AUD-07">Plan d’actions ' + ico('fleche-droite') + '</a></div></article>';

    html += '<article class="carte col-8"><div class="carte__entete"><div><h2 class="carte__titre">Évolution des constats sur 12 mois</h2><p class="carte__sous-titre">Constats ouverts et clos chaque mois</p></div>' +
      '<ul class="legende"><li class="legende__item"><span class="legende__puce legende__puce--trait" data-c="var(--violet)"></span>Ouverts</li><li class="legende__item"><span class="legende__puce legende__puce--trait" data-c="var(--vert)"></span>Clos</li></ul></div>' +
      slot(function (L, H) {
        return courbe([
          { nom: 'Ouverts', valeurs: F.evolution.map(function (m) { return m.ouverts; }), couleur: '--violet' },
          { nom: 'Clos', valeurs: F.evolution.map(function (m) { return m.clos; }), couleur: '--vert' },
        ], F.evolution.map(function (m) { return m.mois; }), 'Évolution mensuelle des constats ouverts et clos', L, H);
      }) +
      '<div class="carte__pied"><span>' + ico(solde > 0 ? 'fleche-haut' : 'fleche-bas') + ' Solde sur la période : ' + (solde > 0 ? '+' : '') + solde + ' constats</span><span>' + F.evolution.reduce(function (a, m) { return a + m.ouverts; }, 0) + ' ouverts · ' + F.evolution.reduce(function (a, m) { return a + m.clos; }, 0) + ' clos</span></div></article>';

    html += '<article class="carte col-4"><div class="carte__entete"><div><h2 class="carte__titre">Prochaines échéances</h2><p class="carte__sous-titre">Constats et actions à traiter</p></div>' +
      (depassees ? badge(pluriel(depassees, 'dépassée', 'dépassées'), { cls: 'erreur', ico: 'alerte' }) : '') + '</div>' +
      '<ul class="liste">' + K.prochainesEcheances.slice(0, 5).map(function (e) {
        return '<li class="liste__item"><span class="liste__icone' + (e.jours <= 7 ? ' liste__icone--attention' : '') + '">' + ico(e.genre === 'Action' ? 'coche' : 'fiche') + '</span>' +
          '<div><p class="liste__titre" title="' + esc(e.titre) + '">' + esc(e.titre) + '</p><p class="liste__meta"><span class="mono">' + esc(e.id) + '</span><span>' + esc(e.genre) + '</span><span>' + esc(F.utilisateur(e.responsable).nom) + '</span></p></div>' +
          '<div class="liste__droite">' + delai(e.jours) + '<br><span class="secondaire petit">' + F.fr(e.echeance) + '</span></div></li>';
      }).join('') + '</ul>' +
      '<div class="carte__pied"><span>' + ico('alerte') + ' La plus ancienne : ' + esc(K.echeancesDepassees[0].id) + ', ' + F.fr(K.echeancesDepassees[0].echeance) + '</span><button class="bouton bouton--lien bouton--sm" type="button" data-action="toutes-echeances">Tout voir</button></div></article>';

    /* Indicateurs */
    html += '<article class="carte col-12"><div class="carte__entete"><div><h2 class="carte__titre">Indicateurs SMSI suivis en revue de direction</h2><p class="carte__sous-titre">Tendance sur 12 mois, valeur actuelle et cible</p></div><a class="carte__lien" href="#/composants">Tous les indicateurs ' + ico('fleche-droite') + '</a></div>' +
      '<div class="tuiles tuiles--quatre">' + indicateursChoisis.map(function (i) {
        var bon = i.id === 'I3' ? i.valeur <= i.cible : i.valeur >= i.cible;
        var tend = i.tendance === 'hausse' ? 'fleche-haut' : i.tendance === 'baisse' ? 'fleche-bas' : 'egal';
        return '<div class="tuile"><p class="tuile__libelle">' + esc(i.libelle) + '</p><div class="rangee"><p class="tuile__valeur">' + i.valeur + '<span class="kpi__unite"> ' + esc(i.unite) + '</span></p><span class="espace"></span>' + sparkline(i.historique, bon ? '--vert' : '--violet') + '</div>' +
          '<p class="kpi__detail kpi__detail--' + (bon ? 'ok' : 'attention') + '">' + ico(bon ? 'coche-cercle' : tend) + (bon ? 'Cible atteinte' : 'Cible ' + i.cible + (i.unite.charAt(0) === '/' ? '' : ' ' + esc(i.unite)) + ' · tendance ' + esc(i.tendance === 'hausse' ? 'à la hausse' : i.tendance === 'baisse' ? 'à la baisse' : 'stable')) + '</p></div>';
      }).join('') + '</div></article>';

    html += '</div></section>';
    contenu.innerHTML = html;
    appliquerVariables(contenu);
    remplirSlots(contenu);
    animerGraphiques(contenu);
    $('[data-action="exporter"]', contenu).addEventListener('click', function () { toast('info', 'Export en préparation', 'La synthèse PDF serait générée dans l’application réelle.'); });
    $('[data-action="toutes-echeances"]', contenu).addEventListener('click', function () { toast('alerte', pluriel(depassees, 'échéance dépassée', 'échéances dépassées'), 'Le registre complet des échéances n’est pas inclus dans cette maquette.'); });

    function kpi(href, libelle, valeur, unite, ton, icone, detail) {
      var tag = href ? 'a' : 'div';
      return '<' + tag + ' class="kpi"' + (href ? ' href="' + href + '"' : '') + '><p class="kpi__libelle">' + esc(libelle) + '</p><p class="kpi__valeur">' + valeur + (unite ? '<span class="kpi__unite">' + unite + '</span>' : '') + '</p>' +
        '<p class="kpi__detail kpi__detail--' + ton + '">' + ico(icone) + esc(detail) + '</p></' + tag + '>';
    }
  }

  /* ================================================================ Écran 2 : liste des audits */
  var etatListe = { q: '', statut: '', type: '', ref: '', tri: 'debut', sens: 'desc', page: 1 };
  var PAR_PAGE = 10;
  var COLONNES = [
    { cle: 'nom', libelle: 'Audit', tri: true, largeur: 21 },
    { cle: 'type', libelle: 'Type', tri: true, largeur: 12 },
    { cle: 'referentiel', libelle: 'Référentiel', tri: true, largeur: 9 },
    { cle: 'site', libelle: 'Site', tri: true, largeur: 12 },
    { cle: 'debut', libelle: 'Début', tri: true, largeur: 10 },
    { cle: 'statut', libelle: 'Statut', tri: true, largeur: 12 },
    { cle: 'progression', libelle: 'Progression', tri: true, numerique: true, largeur: 10 },
    { cle: 'responsable', libelle: 'Responsable', tri: false, largeur: 14 },
  ];
  function ecranAudits() {
    var E = etatListe;
    function options(liste, vide) { return '<option value="">' + esc(vide) + '</option>' + liste.map(function (o) { return '<option value="' + esc(o.v) + '"' + (o.v === o.sel ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join(''); }
    var html = '<section class="ecran" aria-labelledby="titre-ecran">' +
      '<header class="ecran__entete"><div class="ecran__titres"><p class="ecran__surtitre">Audits</p><h1 id="titre-ecran">Liste des audits</h1><p class="ecran__sous-titre">' + F.audits.length + ' audits du cycle ' + esc(F.organisation.periode.replace('Cycle de certification ', '')) + ' · tous sites</p></div>' +
      '<div class="ecran__actions"><button class="bouton bouton--defaut" type="button" data-action="exporter">' + ico('rapport') + 'Exporter</button><a class="bouton bouton--plein" href="#/formulaire">' + ico('plus') + 'Nouvel audit</a></div></header>' +
      '<div class="carte carte--sans-marge"><div class="outils" role="search">' +
      '<div class="champ-recherche">' + ico('recherche') + '<label class="visuellement-cache" for="recherche">Rechercher un audit</label><input class="controle" id="recherche" type="search" placeholder="Rechercher (nom, site, identifiant…)" autocomplete="off" value="' + esc(E.q) + '"></div>' +
      '<label class="visuellement-cache" for="filtre-statut">Filtrer par statut</label><select class="controle controle--select" id="filtre-statut">' + options(F.vocabulaire.statutsAudit.map(function (s) { return { v: s, l: s, sel: E.statut }; }), 'Tous les statuts') + '</select>' +
      '<label class="visuellement-cache" for="filtre-type">Filtrer par type</label><select class="controle controle--select" id="filtre-type">' + options(F.vocabulaire.typesAudit.map(function (s) { return { v: s, l: s, sel: E.type }; }), 'Tous les types') + '</select>' +
      '<label class="visuellement-cache" for="filtre-ref">Filtrer par référentiel</label><select class="controle controle--select" id="filtre-ref">' + options(F.referentiels.map(function (r) { return { v: r.id, l: r.libelle, sel: E.ref }; }), 'Tous les référentiels') + '</select>' +
      '<button class="bouton bouton--fantome" type="button" id="reinitialiser">' + ico('recommencer') + 'Réinitialiser</button>' +
      '<span class="espace"></span><span class="outils__compteur" id="compteur" aria-live="polite"></span></div>' +
      '<div class="tableau"><table aria-describedby="compteur"><colgroup>' + COLONNES.map(function (c) { return '<col class="col-' + c.largeur + 'p">'; }).join('') + '</colgroup><thead><tr>' + COLONNES.map(function (c) {
        return '<th scope="col"' + (c.numerique ? ' class="est-numerique"' : '') + (c.tri ? ' aria-sort="none" data-cle="' + c.cle + '"' : '') + '>' +
          (c.tri ? '<button class="tableau__tri" type="button" data-tri="' + c.cle + '">' + esc(c.libelle) + ico('tri') + '</button>' : esc(c.libelle)) + '</th>';
      }).join('') + '</tr></thead><tbody id="corps-table"></tbody></table></div>' +
      '<nav class="pagination" id="pagination" aria-label="Pagination"></nav></div></section>';
    contenu.innerHTML = html;

    var corps = $('#corps-table'), pagination = $('#pagination'), compteur = $('#compteur');
    function filtrer() {
      var q = E.q.trim().toLowerCase();
      return F.audits.filter(function (a) {
        if (E.statut && a.statut !== E.statut) return false;
        if (E.type && a.type !== E.type) return false;
        if (E.ref && a.referentiel !== E.ref) return false;
        if (!q) return true;
        var texte = [a.id, a.nom, a.site, a.type, a.statut, F.referentiel(a.referentiel).libelle, F.utilisateur(a.responsable).nom, a.perimetre].join(' ').toLowerCase();
        return texte.indexOf(q) !== -1;
      }).sort(function (a, b) {
        var va = valeurTri(a, E.tri), vb = valeurTri(b, E.tri), r = va < vb ? -1 : va > vb ? 1 : a.id.localeCompare(b.id);
        return E.sens === 'asc' ? r : -r;
      });
    }
    function valeurTri(a, cle) {
      if (cle === 'referentiel') return F.referentiel(a.referentiel).court;
      if (cle === 'statut') return F.vocabulaire.statutsAudit.indexOf(a.statut);
      if (cle === 'nom') return a.nom.toLowerCase();
      return a[cle];
    }
    function rendreTable() {
      var liste = filtrer(), total = liste.length, pages = Math.max(1, Math.ceil(total / PAR_PAGE));
      if (E.page > pages) E.page = pages;
      var debut = (E.page - 1) * PAR_PAGE, page = liste.slice(debut, debut + PAR_PAGE);
      compteur.textContent = total === F.audits.length ? total + ' audits · ' + PAR_PAGE + ' par page' : total + ' sur ' + F.audits.length + ' audits';
      $$('th[data-cle]', contenu).forEach(function (th) { th.setAttribute('aria-sort', th.getAttribute('data-cle') === E.tri ? (E.sens === 'asc' ? 'ascending' : 'descending') : 'none'); });
      $$('.tableau__tri .icone', contenu).forEach(function (i) { var cle = i.parentNode.getAttribute('data-tri'); i.innerHTML = '<use href="#i-' + (cle === E.tri ? (E.sens === 'asc' ? 'fleche-haut' : 'fleche-bas') : 'tri') + '"/>'; });
      if (!total) {
        corps.innerHTML = '<tr class="tableau__vide"><td colspan="' + COLONNES.length + '">' + etatVide('Aucun audit ne correspond', 'Modifiez la recherche ou réinitialisez les filtres pour retrouver les 36 audits du cycle.', 'Réinitialiser les filtres', 'reinitialiser') + '</td></tr>';
        $('[data-action="reinitialiser"]', corps).addEventListener('click', reinitialiser);
      } else {
        corps.innerHTML = page.map(function (a) {
          return '<tr class="tableau__ligne" data-id="' + a.id + '">' +
            '<td><div class="tableau__principal"><a href="#/audit/' + a.id + '">' + esc(a.nom) + '</a><span class="tableau__id">' + a.id + ' · ' + pluriel(a.nbConstats, 'constat', 'constats') + '</span></div></td>' +
            '<td>' + badgeType(a.type) + '</td><td>' + badgeReferentiel(a.referentiel) + '</td><td>' + esc(a.site) + '</td>' +
            '<td class="tabulaire">' + F.fr(a.debut) + '</td><td>' + badgeStatutAudit(a.statut) + '</td>' +
            '<td class="est-numerique">' + progression(a.progression, a.statut === 'Clos' ? 'succes' : a.statut === 'Reporté' ? 'gris' : '') + '</td>' +
            '<td>' + personne(a.responsable) + '</td></tr>';
        }).join('');
        appliquerVariables(corps);
        requestAnimationFrame(function () { $$('.progression__valeur', corps).forEach(function (p) { p.style.setProperty('--p', p.getAttribute('data-p')); }); });
      }
      var boutons = '';
      for (var p = 1; p <= pages; p++) {
        if (pages > 7 && p > 2 && p < pages - 1 && Math.abs(p - E.page) > 1) { if (boutons.slice(-33).indexOf('points') === -1) boutons += '<span class="pagination__points">…</span>'; continue; }
        boutons += '<button class="pagination__page" type="button" data-page="' + p + '"' + (p === E.page ? ' aria-current="page"' : '') + ' aria-label="Page ' + p + '">' + p + '</button>';
      }
      pagination.innerHTML = '<p class="pagination__info">' + (total ? 'Audits ' + (debut + 1) + ' à ' + Math.min(debut + PAR_PAGE, total) + ' sur ' + total : 'Aucun résultat') + '</p>' +
        '<div class="pagination__pages"><button class="pagination__page" type="button" data-page="' + (E.page - 1) + '" aria-label="Page précédente"' + (E.page <= 1 ? ' disabled' : '') + '>' + ico('chevron-gauche') + '</button>' + boutons +
        '<button class="pagination__page" type="button" data-page="' + (E.page + 1) + '" aria-label="Page suivante"' + (E.page >= pages ? ' disabled' : '') + '>' + ico('chevron-droite') + '</button></div>';
    }
    function reinitialiser() {
      E.q = ''; E.statut = ''; E.type = ''; E.ref = ''; E.page = 1;
      $('#recherche').value = ''; $('#filtre-statut').value = ''; $('#filtre-type').value = ''; $('#filtre-ref').value = '';
      rendreTable();
      $('#recherche').focus();
    }
    $('#recherche').addEventListener('input', function (e) { E.q = e.target.value; E.page = 1; rendreTable(); });
    $('#filtre-statut').addEventListener('change', function (e) { E.statut = e.target.value; E.page = 1; rendreTable(); });
    $('#filtre-type').addEventListener('change', function (e) { E.type = e.target.value; E.page = 1; rendreTable(); });
    $('#filtre-ref').addEventListener('change', function (e) { E.ref = e.target.value; E.page = 1; rendreTable(); });
    $('#reinitialiser').addEventListener('click', reinitialiser);
    $$('.tableau__tri', contenu).forEach(function (b) {
      b.addEventListener('click', function () {
        var cle = b.getAttribute('data-tri');
        if (E.tri === cle) E.sens = E.sens === 'asc' ? 'desc' : 'asc';
        else { E.tri = cle; E.sens = cle === 'debut' || cle === 'progression' ? 'desc' : 'asc'; }
        E.page = 1; rendreTable();
      });
    });
    pagination.addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]');
      if (!b || b.disabled) return;
      E.page = parseInt(b.getAttribute('data-page'), 10); rendreTable();
      $('.tableau', contenu).scrollIntoView({ behavior: mouvementReduit.matches ? 'auto' : 'smooth', block: 'start' });
    });
    corps.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var tr = e.target.closest('tr[data-id]');
      if (tr) location.hash = '#/audit/' + tr.getAttribute('data-id');
    });
    $('[data-action="exporter"]', contenu).addEventListener('click', function () { toast('succes', 'Export prêt', 'Le tableau filtré (' + filtrer().length + ' audits) serait téléchargé au format CSV.'); });
    rendreTable();
  }

  /* ================================================================ Écran 3 : fiche d'audit */
  function ecranAudit(id) {
    var a = F.audit(id);
    if (!a) { ecranIntrouvable('Audit ' + id + ' introuvable'); return; }
    var constats = F.constatsDe(a.id), actions = F.actionsDe(a.id), historique = F.historiqueAudit(a);
    var nc = constats.filter(function (c) { return c.type.indexOf('NC') === 0; });
    var terminees = actions.filter(function (x) { return x.statut === 'Terminée'; }).length;
    var enRetard = actions.filter(function (x) { return x.statut !== 'Terminée' && F.daysUntil(x.echeance) < 0; }).length;
    var ordreCrit = F.vocabulaire.criticites;
    var parCrit = F.compterPar(constats, 'criticite');
    var onglets = [
      { id: 'synthese', libelle: 'Synthèse' },
      { id: 'constats', libelle: 'Constats', n: constats.length },
      { id: 'actions', libelle: 'Plan d’actions', n: actions.length },
      { id: 'historique', libelle: 'Historique', n: historique.length },
    ];
    var html = '<section class="ecran" aria-labelledby="titre-ecran">' +
      '<header class="ecran__entete"><div class="ecran__titres"><p class="ecran__surtitre">Audits · <span class="mono">' + a.id + '</span></p><h1 id="titre-ecran">' + esc(a.nom) + '</h1></div>' +
      '<div class="ecran__actions"><a class="bouton bouton--defaut" href="#/formulaire">' + ico('crayon') + 'Modifier</a><button class="bouton bouton--plein" type="button" data-action="cloturer"' + (a.statut === 'Clos' ? ' disabled' : '') + '>' + ico('coche-cercle') + 'Clôturer l’audit</button></div></header>' +
      '<article class="carte"><div class="fiche__entete"><div>' +
      '<div class="fiche__badges">' + badgeStatutAudit(a.statut) + badgeType(a.type) + badgeReferentiel(a.referentiel) + badgeCriticite(a.criticite) + '</div>' +
      '<p class="description">' + esc(a.description) + '</p></div>' +
      '<div class="fiche__progression"><p class="fiche__progression-chiffre">' + a.progression + ' %</p>' + progression(a.progression, a.statut === 'Clos' ? 'succes' : '', true) + '<p class="secondaire petit">Avancement de l’audit</p></div></div>' +
      '<div class="fiche__meta">' +
      meta('Site', esc(a.site)) + meta('Dates', ico('calendrier') + F.fr(a.debut) + ' → ' + F.fr(a.fin)) + meta('Responsable', personne(a.responsable)) + meta('Auditeur', ico('utilisateur') + esc(a.auditeur)) +
      '</div></article>' +
      '<div class="section"><div class="onglets" role="tablist" aria-label="Sections de la fiche">' + onglets.map(function (o, i) {
        return '<button class="onglet" role="tab" type="button" id="onglet-' + o.id + '" aria-controls="panneau-' + o.id + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '">' + esc(o.libelle) + (o.n != null ? '<span class="onglet__compteur">' + o.n + '</span>' : '') + '</button>';
      }).join('') + '<span class="onglets__indicateur" aria-hidden="true"></span></div>';

    /* Panneau synthèse */
    html += '<div class="panneau" role="tabpanel" id="panneau-synthese" aria-labelledby="onglet-synthese"><div class="grille">' +
      '<article class="carte col-7"><h2 class="carte__titre">Synthèse</h2>' +
      '<div class="tuiles">' + tuile('Constats', constats.length, pluriel(nc.length, 'non-conformité', 'non-conformités')) + tuile('Actions', actions.length, terminees + ' terminées · ' + enRetard + ' en retard') + tuile('Périmètre', '', a.perimetre) + '</div>' +
      '<h3 class="carte__titre">Constats par criticité</h3>' +
      (constats.length ? slot(function (L) { return barresHorizontales(ordreCrit.map(function (c) { return { libelle: c, valeur: parCrit[c] || 0, couleur: CRITICITE[c].c, unite: 'constat(s)' }; }), 'Constats de l’audit par criticité', L); }) : '<p class="secondaire">Aucun constat n’a encore été relevé pour cet audit.</p>') +
      '</article>' +
      '<article class="carte col-5"><h2 class="carte__titre">Prochaines étapes</h2><ul class="liste">' +
      etape('Réunion de clôture', F.fr(a.fin), a.statut === 'En cours' ? 'attention' : 'ok', 'calendrier') +
      etape('Rapport d’audit attendu', F.fr(ajouterJours(a.fin, 12)), '', 'rapport') +
      etape('Arbitrage du plan d’actions', F.fr(ajouterJours(a.fin, 30)), '', 'coche') +
      '</ul><div class="carte__pied"><span>' + ico('info') + ' Avancement global ' + a.progression + ' %</span><a class="carte__lien" href="#/retex">RETEX associé ' + ico('fleche-droite') + '</a></div></article></div></div>';

    /* Panneau constats */
    html += '<div class="panneau" role="tabpanel" id="panneau-constats" aria-labelledby="onglet-constats" hidden><article class="carte">' +
      '<div class="carte__entete"><div><h2 class="carte__titre">Constats relevés</h2><p class="carte__sous-titre">' + pluriel(constats.length, 'constat', 'constats') + ', dont ' + pluriel(nc.length, 'non-conformité', 'non-conformités') + '</p></div><button class="bouton bouton--defaut bouton--sm" type="button" data-action="ajouter-constat">' + ico('plus') + 'Ajouter un constat</button></div>' +
      (constats.length ? '<ul class="liste">' + constats.map(function (c) {
        var j = F.daysUntil(c.echeance);
        return '<li class="constat"><span class="constat__ref">' + esc(c.ref) + '</span><div><p class="constat__titre">' + esc(c.titre) + '</p><p class="constat__texte">' + esc(c.description) + '</p>' +
          '<div class="constat__badges">' + badgeType(c.type) + badgeCriticite(c.criticite) + badgeStatutConstat(c.statut) + '<span class="secondaire petit mono">' + c.id + '</span></div></div>' +
          '<div class="constat__droite">' + (c.statut === 'Clos' ? '<span class="echeance-delai">' + ico('coche-cercle') + 'Clos</span>' : delai(j)) + '<span class="secondaire">' + F.fr(c.echeance) + '</span>' + personne(c.responsable) + '</div></li>';
      }).join('') + '</ul>' : etatVide('Aucun constat', 'Les constats apparaîtront après la réunion de clôture.', 'Ajouter un constat', 'ajouter-constat')) + '</article></div>';

    /* Panneau actions */
    html += '<div class="panneau" role="tabpanel" id="panneau-actions" aria-labelledby="onglet-actions" hidden><article class="carte">' +
      '<div class="carte__entete"><div><h2 class="carte__titre">Plan d’actions</h2><p class="carte__sous-titre">' + pluriel(actions.length, 'action', 'actions') + ' · ' + pct(terminees, actions.length) + ' % terminées</p></div>' + (enRetard ? badge(pluriel(enRetard, 'en retard', 'en retard'), { cls: 'erreur', ico: 'alerte' }) : '') + '</div>' +
      (actions.length ? '<ul class="liste">' + actions.map(function (x) {
        var j = F.daysUntil(x.echeance);
        return '<li class="action"><div><p class="action__titre">' + esc(x.titre) + '</p><p class="action__meta"><span class="priorite priorite--' + x.priorite + '">' + x.priorite + '</span><span class="mono">' + x.id + '</span><span>constat ' + x.constatId + '</span><span>charge ' + esc(x.charge) + '</span></p></div>' +
          progression(x.avancement, x.statut === 'Terminée' ? 'succes' : x.statut === 'Bloquée' ? 'erreur' : x.statut === 'À faire' ? 'gris' : 'info') +
          '<div class="constat__droite">' + badgeStatutAction(x.statut) + (x.statut === 'Terminée' ? '<span class="secondaire petit">Terminée le ' + F.fr(x.echeance) + '</span>' : delai(j)) + personne(x.responsable) + '</div></li>';
      }).join('') + '</ul>' : etatVide('Aucune action', 'Le plan d’actions est établi après arbitrage des constats.', 'Créer une action', 'ajouter-constat')) + '</article></div>';

    /* Panneau historique */
    html += '<div class="panneau" role="tabpanel" id="panneau-historique" aria-labelledby="onglet-historique" hidden><article class="carte"><h2 class="carte__titre">Historique</h2>' +
      '<ol class="chrono">' + historique.map(function (hItem) {
        var futur = hItem.quand > F.aujourdhui;
        return '<li class="chrono__item' + (futur ? ' chrono__item--futur' : '') + '"><span class="chrono__point" aria-hidden="true">' + ico(futur ? 'horloge' : 'coche') + '</span>' +
          '<p class="chrono__quand">' + F.frLong(hItem.quand) + (futur ? ' · à venir' : '') + '</p><p class="chrono__quoi">' + esc(hItem.quoi) + '</p><p class="chrono__qui">' + avatar(hItem.qui) + esc(F.utilisateur(hItem.qui).nom) + ' · ' + esc(F.utilisateur(hItem.qui).role) + '</p></li>';
      }).join('') + '</ol></article></div></div></section>';

    contenu.innerHTML = html;
    appliquerVariables(contenu);
    remplirSlots(contenu);
    animerGraphiques(contenu);
    requestAnimationFrame(function () { $$('.progression__valeur', contenu).forEach(function (p) { p.style.setProperty('--p', p.getAttribute('data-p')); }); });
    initialiserOnglets($('.onglets', contenu));
    $('[data-action="cloturer"]', contenu).addEventListener('click', function () {
      ouvrirModale({
        titre: 'Clôturer l’audit ' + a.id + ' ?',
        texte: 'La clôture fige les constats et notifie les responsables des ' + pluriel(actions.length, 'action', 'actions') + ' du plan. Cette opération est journalisée.',
        libelleConfirmer: 'Confirmer la clôture',
        confirmer: function () { toast('succes', 'Audit clôturé (simulation)', a.nom + ' passe au statut « Clos ». Aucune donnée n’est enregistrée dans la maquette.'); },
      });
    });
    $$('[data-action="ajouter-constat"]', contenu).forEach(function (b) { b.addEventListener('click', function () { toast('info', 'Saisie d’un constat', 'Le formulaire de constat n’est pas inclus dans la maquette.'); }); });

    function meta(libelle, valeur) { return '<div class="meta"><span class="meta__libelle">' + libelle + '</span><span class="meta__valeur">' + valeur + '</span></div>'; }
    function tuile(libelle, valeur, detail) { return '<div class="tuile"><p class="tuile__libelle">' + libelle + '</p>' + (valeur !== '' ? '<p class="tuile__valeur">' + valeur + '</p>' : '') + '<p class="secondaire petit">' + esc(detail) + '</p></div>'; }
    function etape(titre, date, ton, icone) { return '<li class="liste__item"><span class="liste__icone' + (ton ? ' liste__icone--' + ton : '') + '">' + ico(icone) + '</span><div><p class="liste__titre">' + titre + '</p></div><div class="liste__droite tabulaire">' + date + '</div></li>'; }
  }
  function ajouterJours(iso, n) { var d = new Date(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  /* Onglets : role=tablist, indicateur qui glisse (transform), clavier flèches / Début / Fin */
  function initialiserOnglets(liste) {
    var onglets = $$('[role="tab"]', liste), indicateur = $('.onglets__indicateur', liste);
    function activer(onglet, focus) {
      onglets.forEach(function (o) {
        var actif = o === onglet;
        o.setAttribute('aria-selected', String(actif));
        o.setAttribute('tabindex', actif ? '0' : '-1');
        var panneau = document.getElementById(o.getAttribute('aria-controls'));
        if (panneau) panneau.hidden = !actif;
      });
      indicateur.style.setProperty('--x', onglet.offsetLeft + 'px');
      indicateur.style.setProperty('--s', String(onglet.offsetWidth / 100));
      if (focus) onglet.focus();
      var panneauActif = document.getElementById(onglet.getAttribute('aria-controls'));
      if (panneauActif) { appliquerVariables(panneauActif); remplirSlots(panneauActif); animerGraphiques(panneauActif); $$('.progression__valeur', panneauActif).forEach(function (p) { p.style.setProperty('--p', p.getAttribute('data-p')); }); }
    }
    onglets.forEach(function (o, i) {
      o.addEventListener('click', function () { activer(o, false); });
      o.addEventListener('keydown', function (e) {
        var cible = null;
        if (e.key === 'ArrowRight') cible = onglets[(i + 1) % onglets.length];
        else if (e.key === 'ArrowLeft') cible = onglets[(i - 1 + onglets.length) % onglets.length];
        else if (e.key === 'Home') cible = onglets[0];
        else if (e.key === 'End') cible = onglets[onglets.length - 1];
        if (cible) { e.preventDefault(); activer(cible, true); }
      });
    });
    requestAnimationFrame(function () { activer(onglets.filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0] || onglets[0], false); });
    window.addEventListener('resize', function () { var actif = $('[role="tab"][aria-selected="true"]', liste); if (actif) { indicateur.style.setProperty('--x', actif.offsetLeft + 'px'); indicateur.style.setProperty('--s', String(actif.offsetWidth / 100)); } });
  }

  /* ================================================================ Écran 4 : formulaire */
  function ecranFormulaire() {
    function select(id, liste, vide) { return '<select class="controle controle--select" id="' + id + '" name="' + id + '"><option value="">' + vide + '</option>' + liste.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.l) + '</option>'; }).join('') + '</select>'; }
    function champ(id, libelle, controle, aide, requis, classe) {
      return '<div class="champ' + (classe ? ' ' + classe : '') + '" data-champ="' + id + '"><label class="champ__libelle" for="' + id + '">' + libelle + (requis ? ' <span class="champ__requis" aria-hidden="true">*</span>' : '') + '</label>' + controle +
        (aide ? '<p class="champ__aide" id="' + id + '-aide">' + aide + '</p>' : '') + '<p class="champ__erreur" id="' + id + '-erreur" role="status">' + ico('erreur') + '<span></span></p></div>';
    }
    var html = '<section class="ecran" aria-labelledby="titre-ecran">' +
      '<header class="ecran__entete"><div class="ecran__titres"><p class="ecran__surtitre">Audits</p><h1 id="titre-ecran">Nouvel audit</h1><p class="ecran__sous-titre">Les champs marqués d’un astérisque (<span class="champ__requis">*</span>) sont obligatoires. Rien n’est enregistré : la maquette simule l’envoi.</p></div></header>' +
      '<div class="grille"><article class="carte col-8"><div id="formulaire-messages" aria-live="polite"></div>' +
      '<form class="formulaire" id="formulaire-audit" novalidate>' +
      '<div class="formulaire__section"><h3>Identification</h3></div>' +
      champ('nom', 'Nom de l’audit', '<input class="controle" id="nom" name="nom" type="text" maxlength="120" autocomplete="off" placeholder="Ex. Audit interne — gestion des accès" aria-describedby="nom-aide">', 'Nom affiché dans la liste et les rapports (5 caractères minimum).', true, 'champ--large') +
      champ('type', 'Type d’audit', select('type', F.vocabulaire.typesAudit.map(function (t) { return { v: t, l: t }; }), 'Choisir un type'), '', true) +
      champ('referentiel', 'Référentiel', select('referentiel', F.referentiels.map(function (r) { return { v: r.id, l: r.libelle }; }), 'Choisir un référentiel'), '', true) +
      '<div class="formulaire__section"><h3>Organisation</h3></div>' +
      champ('site', 'Site audité', select('site', F.sites.map(function (s) { return { v: s, l: s }; }), 'Choisir un site'), '', true) +
      champ('responsable', 'Responsable', select('responsable', F.utilisateurs.map(function (u) { return { v: u.id, l: u.nom + ' — ' + u.role }; }), 'Choisir un responsable'), 'Pilote interne de l’audit, destinataire des rappels.', true) +
      champ('debut', 'Date de début', '<input class="controle" id="debut" name="debut" type="date" aria-describedby="debut-aide">', 'Format JJ/MM/AAAA.', true) +
      champ('fin', 'Date de fin', '<input class="controle" id="fin" name="fin" type="date" aria-describedby="fin-aide">', 'Postérieure ou égale à la date de début.', true) +
      '<div class="formulaire__section"><h3>Contenu</h3></div>' +
      champ('perimetre', 'Périmètre', '<input class="controle" id="perimetre" name="perimetre" type="text" maxlength="160" placeholder="Ex. Hébergement des données de santé">', 'Facultatif.', false, 'champ--large') +
      champ('description', 'Description', '<textarea class="controle" id="description" name="description" rows="4" maxlength="600" placeholder="Objectifs, processus concernés, points d’attention…" aria-describedby="description-aide"></textarea>', '<span id="description-compte">0</span> / 600 caractères.', false, 'champ--large') +
      '<div class="formulaire__actions"><a class="bouton bouton--fantome" href="#/audits">Annuler</a><button class="bouton bouton--defaut" type="button" id="prefill">' + ico('crayon') + 'Pré-remplir un exemple</button><button class="bouton bouton--plein" type="submit" id="soumettre">' + ico('coche') + 'Enregistrer l’audit</button></div>' +
      '</form></article>' +
      '<aside class="carte col-4 carte--douce"><h2 class="carte__titre">Repères</h2><ul class="liste">' +
      '<li class="liste__item"><span class="liste__icone liste__icone--ok">' + ico('calendrier') + '</span><div><p class="liste__titre">Planification</p><p class="liste__meta">Un audit créé passe en « Planifié » puis « En préparation » 45 jours avant le début.</p></div></li>' +
      '<li class="liste__item"><span class="liste__icone">' + ico('utilisateur') + '</span><div><p class="liste__titre">Responsable</p><p class="liste__meta">Il reçoit les convocations et le rapport. Les auditeurs sont ajoutés depuis la fiche.</p></div></li>' +
      '<li class="liste__item"><span class="liste__icone">' + ico('bouclier') + '</span><div><p class="liste__titre">Référentiels</p><p class="liste__meta">' + F.referentiels.map(function (r) { return r.libelle; }).join(', ') + '.</p></div></li>' +
      '</ul></aside></div></section>';
    contenu.innerHTML = html;

    var form = $('#formulaire-audit'), messages = $('#formulaire-messages'), soumettre = $('#soumettre');
    var REGLES = {
      nom: function (v) { if (!v.trim()) return 'Indiquez le nom de l’audit.'; if (v.trim().length < 5) return 'Le nom doit contenir au moins 5 caractères.'; return ''; },
      type: function (v) { return v ? '' : 'Choisissez un type d’audit.'; },
      referentiel: function (v) { return v ? '' : 'Choisissez un référentiel.'; },
      site: function (v) { return v ? '' : 'Choisissez le site audité.'; },
      responsable: function (v) { return v ? '' : 'Désignez un responsable.'; },
      debut: function (v) { return v ? '' : 'Indiquez la date de début.'; },
      fin: function (v) { var d = $('#debut').value; if (!v) return 'Indiquez la date de fin.'; if (d && v < d) return 'La date de fin doit être postérieure ou égale au début (' + F.fr(d) + ').'; return ''; },
    };
    function valider(id) {
      var el = document.getElementById(id), erreur = REGLES[id](el.value), bloc = el.closest('.champ'), texte = $('#' + id + '-erreur span');
      bloc.classList.toggle('champ--invalide', !!erreur);
      texte.textContent = erreur;
      var describe = [id + '-aide', erreur ? id + '-erreur' : ''].filter(function (x) { return x && document.getElementById(x); }).join(' ');
      if (describe) el.setAttribute('aria-describedby', describe); else el.removeAttribute('aria-describedby');
      if (erreur) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      return erreur;
    }
    Object.keys(REGLES).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('blur', function () { valider(id); if (id === 'debut' && $('#fin').value) valider('fin'); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) valider(id); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid')) valider(id); });
    });
    $('#description').addEventListener('input', function (e) { $('#description-compte').textContent = e.target.value.length; });
    $('#prefill').addEventListener('click', function () {
      var a = F.audits[13];
      $('#nom').value = 'Audit interne — gestion des accès (2027)'; $('#type').value = 'Interne'; $('#referentiel').value = 'annexeA'; $('#site').value = a.site; $('#responsable').value = a.responsable;
      $('#debut').value = '2027-02-08'; $('#fin').value = '2027-02-10'; $('#perimetre').value = a.perimetre; $('#description').value = a.description;
      $('#description-compte').textContent = a.description.length;
      Object.keys(REGLES).forEach(valider);
      messages.innerHTML = '';
      toast('info', 'Exemple chargé', 'Les champs ont été pré-remplis à partir d’un audit fictif.');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var erreurs = Object.keys(REGLES).map(function (id) { var m = valider(id); return m ? { id: id, message: m } : null; }).filter(Boolean);
      if (erreurs.length) {
        messages.innerHTML = '<div class="bandeau bandeau--erreur" role="alert" tabindex="-1" id="resume-erreurs">' + ico('erreur') + '<div><strong>' + pluriel(erreurs.length, 'champ à corriger', 'champs à corriger') + '</strong><ul>' +
          erreurs.map(function (er) { return '<li><a href="#/formulaire" data-focus="' + er.id + '">' + esc($('label[for="' + er.id + '"]').textContent.replace('*', '').trim()) + '</a> : ' + esc(er.message) + '</li>'; }).join('') + '</ul></div></div>';
        $$('[data-focus]', messages).forEach(function (l) { l.addEventListener('click', function (ev) { ev.preventDefault(); document.getElementById(l.getAttribute('data-focus')).focus(); }); });
        $('#resume-erreurs').focus();
        return;
      }
      soumettre.disabled = true;
      soumettre.innerHTML = '<span class="bouton__spinner" aria-hidden="true"></span>Enregistrement…';
      messages.innerHTML = '';
      setTimeout(function () {
        soumettre.disabled = false;
        soumettre.innerHTML = ico('coche') + 'Enregistrer l’audit';
        var nom = $('#nom').value.trim();
        messages.innerHTML = '<div class="bandeau bandeau--succes" role="status" tabindex="-1" id="succes">' + ico('coche-cercle') + '<div><strong>Audit « ' + esc(nom) + ' » enregistré (simulation).</strong> Il serait ajouté à la liste avec le statut « Planifié ». <a href="#/audits">Retour à la liste</a></div></div>';
        $('#succes').focus();
        toast('succes', 'Audit enregistré', nom + ' — ' + F.fr($('#debut').value) + ' au ' + F.fr($('#fin').value) + '.');
      }, 900);
    });
  }

  /* ================================================================ Écran 5 : RETEX */
  function ecranRetex() {
    var inc = F.incidents[0], evts = inc.evenements, n = evts.length, visibles = 0;
    var html = '<section class="ecran" aria-labelledby="titre-ecran">' +
      '<header class="ecran__entete"><div class="ecran__titres"><p class="ecran__surtitre">Résilience · Retour d’expérience</p><h1 id="titre-ecran">' + esc(inc.titre) + '</h1>' +
      '<p class="ecran__sous-titre"><span class="mono">' + inc.id + '</span> · du ' + F.frLong(inc.debut.slice(0, 10)) + ' à ' + heure(inc.debut) + ' au ' + F.frLong(inc.fin.slice(0, 10)) + ' à ' + heure(inc.fin) + ' · durée ' + dureeHeures(inc.debut, inc.fin) + '</p></div>' +
      '<div class="ecran__actions"><button class="bouton bouton--defaut" type="button" data-action="exporter">' + ico('rapport') + 'Exporter le RETEX</button></div></header>' +
      '<div class="retex__grille"><div class="pile">' +
      '<div class="carte"><div class="retex__commandes"><button class="bouton bouton--plein" type="button" id="retex-suivant">' + ico('suivant') + 'Point suivant</button>' +
      '<button class="bouton bouton--defaut" type="button" id="retex-tout">' + ico('avance') + 'Tout dérouler</button>' +
      '<button class="bouton bouton--fantome" type="button" id="retex-reset" disabled>' + ico('recommencer') + 'Recommencer</button>' +
      '<span class="retex__compteur" id="retex-compteur" aria-live="polite"></span></div>' +
      '<p class="secondaire petit">Clavier : Flèche droite ou Espace pour le point suivant, Fin pour tout dérouler, Début pour recommencer (dans la chronologie).</p></div>' +
      '<ol class="retex__liste" id="retex-liste" tabindex="0" role="region" aria-label="Chronologie de l’incident, ' + n + ' points">' + evts.map(function (e, i) {
        var g = GRAVITE[e.gravite], u = F.utilisateur(e.acteur);
        return '<li class="evenement est-masque" data-index="' + i + '" data-c="var(' + g.c + ')"><span class="evenement__point" aria-hidden="true">' + ico(TYPE_EVENEMENT_ICO[e.type] || 'point') + '</span>' +
          '<div class="evenement__carte"><div class="evenement__entete"><span class="evenement__heure">' + jourCourt(e.h) + ' · ' + heure(e.h) + '</span>' + badge(e.type, { cls: 'contour' }) + gravite(e.gravite) + '</div>' +
          '<p class="evenement__titre">' + (i + 1) + '. ' + esc(e.titre) + '</p><p class="evenement__detail">' + esc(e.detail) + '</p>' +
          '<p class="evenement__pied">' + avatar(e.acteur) + esc(u.nom) + ' · ' + esc(u.role) + '</p></div></li>';
      }).join('') + '</ol>' +
      '<article class="carte retex__fin" id="retex-fin" aria-hidden="true" hidden><h2 class="carte__titre">Enseignements du RETEX</h2><ul class="enseignements">' + inc.enseignements.map(function (e) { return '<li>' + ico('coche-cercle') + '<span>' + esc(e) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="carte__pied"><span>' + ico('calendrier') + ' Réunion de retour d’expérience du 24/09/2026</span><a class="carte__lien" href="#/audit/AUD-07">Audit lié ' + ico('fleche-droite') + '</a></div></article>' +
      '</div>' +
      '<div class="pile"><article class="carte"><h2 class="carte__titre">Incident</h2>' +
      '<div class="meta"><span class="meta__libelle">Gravité maximale</span><span class="meta__valeur">' + gravite(inc.graviteMax) + '</span></div>' +
      '<div class="meta"><span class="meta__libelle">Pilote</span><span class="meta__valeur">' + personne(inc.pilote, true) + '</span></div>' +
      '<div class="meta"><span class="meta__libelle">Impact</span><span class="secondaire">' + esc(inc.impact) + '</span></div>' +
      '<div class="meta"><span class="meta__libelle">Points de chronologie</span><span class="meta__valeur">' + n + ' · ' + F.vocabulaire.typesEvenementRetex.filter(function (t) { return evts.some(function (e) { return e.type === t; }); }).length + ' types d’événement</span></div></article>' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">Gravité par étape</h2><p class="carte__sous-titre">De 0 (aucune) à 4 (critique)</p></div></div>' +
      barresVerticales(evts.map(function (e, i) { return { libelle: (i + 1) + '. ' + e.titre, valeur: e.gravite, couleur: '--trait', tip: F.vocabulaire.gravitesRetex[e.gravite] + ' · ' + heure(e.h) }; }), 4, 'Gravité de chaque étape de l’incident') +
      '<ul class="legende">' + [4, 3, 2, 1, 0].map(function (g) { return '<li class="legende__item"><span class="legende__puce" data-c="var(' + GRAVITE[g].c + ')"></span>' + esc(F.vocabulaire.gravitesRetex[g]) + '</li>'; }).join('') + '</ul></article>' +
      '<article class="carte carte--douce"><h2 class="carte__titre">Autre incident du cycle</h2><p class="liste__titre">' + esc(F.incidents[1].titre) + '</p><p class="liste__meta"><span class="mono">' + F.incidents[1].id + '</span><span>' + F.frLong(F.incidents[1].debut.slice(0, 10)) + '</span>' + gravite(F.incidents[1].graviteMax) + '</p></article>' +
      '</div></div></section>';
    contenu.innerHTML = html;
    appliquerVariables(contenu);
    animerGraphiques(contenu);

    var liste = $('#retex-liste'), items = $$('.evenement', liste), compteur = $('#retex-compteur'), fin = $('#retex-fin');
    var bSuivant = $('#retex-suivant'), bTout = $('#retex-tout'), bReset = $('#retex-reset');
    var barres = $$('.barre--verticale', contenu);
    function majEtat() {
      compteur.textContent = visibles + ' / ' + n + ' points affichés';
      bSuivant.disabled = visibles >= n; bTout.disabled = visibles >= n; bReset.disabled = visibles === 0;
      var complet = visibles >= n;
      /* La carte des enseignements est retirée du flux (hidden) tant que le déroulé n'est pas complet : rien ne reste à opacité 0. */
      if (complet && fin.hidden) { fin.hidden = false; void fin.offsetWidth; fin.classList.add('est-visible'); }
      else if (!complet) { fin.classList.remove('est-visible'); fin.hidden = true; }
      fin.setAttribute('aria-hidden', String(!complet));
      items.forEach(function (it, i) { it.classList.toggle('est-courant', i === visibles - 1); });
      barres.forEach(function (b, i) { b.setAttribute('fill', jeton(i < visibles ? GRAVITE[evts[i].gravite].c : '--trait')); });
    }
    function reveler(defiler) {
      if (visibles >= n) return;
      var it = items[visibles];
      it.classList.remove('est-masque');
      void it.offsetWidth;
      it.classList.add('est-visible');
      visibles++;
      majEtat();
      if (defiler) it.scrollIntoView({ behavior: mouvementReduit.matches ? 'auto' : 'smooth', block: 'nearest' });
    }
    function tout() {
      var pas = mouvementReduit.matches ? 0 : 70;
      (function suite() { if (visibles >= n) return; reveler(false); if (pas) setTimeout(suite, pas); else suite(); })();
    }
    function recommencer() {
      items.forEach(function (it) { it.classList.remove('est-visible', 'est-courant'); it.classList.add('est-masque'); });
      visibles = 0; majEtat();
      liste.scrollIntoView({ behavior: mouvementReduit.matches ? 'auto' : 'smooth', block: 'start' });
    }
    bSuivant.addEventListener('click', function () { reveler(true); });
    bTout.addEventListener('click', tout);
    bReset.addEventListener('click', function () { recommencer(); bSuivant.focus(); });
    liste.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveler(true); }
      else if (e.key === 'End') { e.preventDefault(); tout(); }
      else if (e.key === 'Home') { e.preventDefault(); recommencer(); }
    });
    $('[data-action="exporter"]', contenu).addEventListener('click', function () { toast('info', 'Export du RETEX', 'Le compte rendu serait généré au format PDF.'); });
    majEtat();
    reveler(false);
  }

  /* ================================================================ Écran 6 : composants */
  function etatVide(titre, texte, action, code) {
    return '<div class="vide"><svg class="vide__illustration" viewBox="0 0 120 90" aria-hidden="true" focusable="false">' +
      '<rect x="14" y="22" width="92" height="56" rx="8" fill="' + jeton('--surface-douce') + '" stroke="' + jeton('--trait') + '"/>' +
      '<path d="M14 36h92" stroke="' + jeton('--trait') + '"/><rect x="26" y="46" width="40" height="6" rx="3" fill="' + jeton('--trait') + '"/><rect x="26" y="58" width="56" height="6" rx="3" fill="' + jeton('--sombre-clair') + '"/>' +
      '<circle cx="92" cy="22" r="13" fill="' + jeton('--vert-clair') + '" stroke="' + jeton('--vert') + '" stroke-width="1.5"/><path d="M92 16v12M86 22h12" stroke="' + jeton('--vert') + '" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      '<p class="vide__titre">' + esc(titre) + '</p><p class="vide__texte">' + esc(texte) + '</p>' + (action ? '<button class="bouton bouton--defaut" type="button" data-action="' + code + '">' + ico('plus') + esc(action) + '</button>' : '') + '</div>';
  }
  function squelette() {
    return '<div class="squelette" aria-busy="true" aria-label="Chargement en cours"><div class="squelette__bloc squelette__bloc--titre"></div><div class="squelette__bloc squelette__bloc--graphique"></div>' +
      '<div class="squelette__ligne"><div class="squelette__bloc squelette__bloc--rond"></div><div class="squelette__bloc squelette__bloc--long"></div></div>' +
      '<div class="squelette__ligne"><div class="squelette__bloc squelette__bloc--rond"></div><div class="squelette__bloc squelette__bloc--court"></div></div></div>';
  }
  function ecranComposants() {
    var exempleListe = F.kpi.prochainesEcheances.slice(0, 3);
    var html = '<section class="ecran" aria-labelledby="titre-ecran">' +
      '<header class="ecran__entete"><div class="ecran__titres"><p class="ecran__surtitre">Système</p><h1 id="titre-ecran">Composants transverses</h1><p class="ecran__sous-titre">Modale, notifications, états vides et chargement : le vocabulaire commun des écrans.</p></div></header>' +
      '<div class="demo-grille">' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">Modale de confirmation</h2><p class="carte__sous-titre"><span class="mono">role="dialog"</span>, focus piégé, Échap et clic sur le voile ferment, retour du focus au déclencheur.</p></div></div>' +
      '<div class="rangee"><button class="bouton bouton--plein" type="button" id="demo-modale">' + ico('coche-cercle') + 'Clôturer un audit</button><button class="bouton bouton--danger" type="button" id="demo-modale-danger">' + ico('erreur') + 'Supprimer un constat</button></div></article>' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">Notifications (toasts)</h2><p class="carte__sous-titre">Zone <span class="mono">aria-live="polite"</span> en haut à droite, fermeture manuelle ou après 6 s.</p></div></div>' +
      '<div class="rangee"><button class="bouton bouton--defaut" type="button" data-toast="succes">' + ico('coche-cercle') + 'Succès</button><button class="bouton bouton--defaut" type="button" data-toast="alerte">' + ico('alerte') + 'Alerte</button><button class="bouton bouton--defaut" type="button" data-toast="erreur">' + ico('erreur') + 'Erreur</button><button class="bouton bouton--defaut" type="button" data-toast="info">' + ico('info') + 'Information</button></div></article>' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">État vide</h2><p class="carte__sous-titre">Illustration sobre, explication et action de sortie.</p></div></div>' + etatVide('Aucun constat pour cet audit', 'Les constats apparaîtront après la réunion de clôture, ou peuvent être saisis dès maintenant.', 'Ajouter un constat', 'demo-vide') + '</article>' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">Chargement</h2><p class="carte__sous-titre">Squelette aux proportions du contenu, pulsation d’opacité uniquement.</p></div><button class="bouton bouton--defaut bouton--sm" type="button" id="demo-charger">' + ico('recommencer') + 'Simuler un chargement</button></div>' +
      '<div id="demo-zone" aria-live="polite">' + contenuDemo() + '</div></article>' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">Badges de statut</h2><p class="carte__sous-titre">Toujours couleur + icône + libellé.</p></div></div>' +
      '<p class="meta__libelle">Audits</p><div class="catalogue">' + F.vocabulaire.statutsAudit.map(badgeStatutAudit).join('') + '</div>' +
      '<p class="meta__libelle">Criticité des constats</p><div class="catalogue">' + F.vocabulaire.criticites.map(badgeCriticite).join('') + '</div>' +
      '<p class="meta__libelle">Actions</p><div class="catalogue">' + F.vocabulaire.statutsAction.map(badgeStatutAction).join('') + '</div>' +
      '<p class="meta__libelle">Référentiels et priorités</p><div class="catalogue">' + F.referentiels.map(function (r) { return badgeReferentiel(r.id); }).join('') + '<span class="priorite priorite--P1">P1</span><span class="priorite priorite--P2">P2</span><span class="priorite priorite--P3">P3</span></div></article>' +
      '<article class="carte"><div class="carte__entete"><div><h2 class="carte__titre">Palette reprise de la charte « Sauge »</h2><p class="carte__sous-titre">Aucune couleur nouvelle ; les teintes légères sont la couleur d’état à 12 % sur la surface.</p></div></div><div class="palette">' +
      [['Encre', '--encre'], ['Vert de marque', '--vert'], ['Violet', '--violet'], ['Fond', '--fond'], ['Surface douce', '--surface-douce'], ['Filet', '--trait'], ['Navigation', '--nav-fond'], ['Repère nav', '--nav-repere'], ['Erreur', '--erreur'], ['Alerte', '--alerte'], ['Jaune', '--jaune'], ['Succès', '--succes'], ['Info', '--info'], ['Donnée vert', '--donnee-vert'], ['Donnée bleu', '--donnee-bleu'], ['Donnée violet', '--donnee-violet'], ['Donnée gris', '--donnee-gris']].map(function (c) {
        return '<div class="nuancier"><div class="nuancier__couleur" data-c="var(' + c[1] + ')"></div><span class="nuancier__nom">' + c[0] + '</span><span class="nuancier__hex">' + jeton(c[1]).toUpperCase() + '</span></div>';
      }).join('') + '</div></article>' +
      '</div></section>';
    contenu.innerHTML = html;
    appliquerVariables(contenu);
    $('#demo-modale').addEventListener('click', function () {
      ouvrirModale({ titre: 'Clôturer l’audit AUD-07 ?', texte: 'La clôture fige les constats et notifie les responsables des actions. Cette opération est journalisée et réversible par un administrateur.', libelleConfirmer: 'Confirmer la clôture', confirmer: function () { toast('succes', 'Audit clôturé', 'Audit HDS — plateforme régionale passe au statut « Clos ».'); } });
    });
    $('#demo-modale-danger').addEventListener('click', function () {
      ouvrirModale({ titre: 'Supprimer le constat C-13 ?', texte: 'Le constat et son action associée (ACT-15) seront retirés définitivement du plan. Préférez la clôture si une preuve existe.', libelleConfirmer: 'Supprimer', danger: true, confirmer: function () { toast('erreur', 'Constat supprimé', 'C-13 « Comptes à privilèges partagés » a été retiré (simulation).'); } });
    });
    $$('[data-toast]', contenu).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-toast');
        var textes = { succes: ['Plan d’actions enregistré', '3 actions mises à jour pour AUD-07.'], alerte: ['Échéance proche', 'Le constat C-40 arrive à échéance dans 5 jours.'], erreur: ['Enregistrement impossible', 'Le serveur n’a pas répondu. Réessayez dans un instant.'], info: ['Rapport reçu', 'Le rapport de l’audit AUD-06 a été déposé par l’auditeur.'] };
        toast(t, textes[t][0], textes[t][1]);
      });
    });
    $('[data-action="demo-vide"]', contenu).addEventListener('click', function () { toast('info', 'Saisie d’un constat', 'Le formulaire de constat n’est pas inclus dans la maquette.'); });
    var zone = $('#demo-zone'), bCharger = $('#demo-charger');
    bCharger.addEventListener('click', function () {
      bCharger.disabled = true;
      zone.innerHTML = squelette();
      setTimeout(function () { zone.innerHTML = contenuDemo(); appliquerVariables(zone); animerGraphiques(zone); bCharger.disabled = false; toast('succes', 'Données chargées', '3 échéances récupérées en 1,5 s (simulation).'); }, 1500);
    });
    function contenuDemo() {
      return '<p class="carte__titre">Échéances de la semaine</p>' + sparkline(F.indicateurs[0].historique, '--vert') + '<ul class="liste">' + exempleListe.map(function (e) {
        return '<li class="liste__item"><span class="liste__icone' + (e.jours <= 7 ? ' liste__icone--attention' : '') + '">' + ico(e.genre === 'Action' ? 'coche' : 'fiche') + '</span><div><p class="liste__titre">' + esc(e.titre) + '</p><p class="liste__meta"><span class="mono">' + e.id + '</span><span>' + esc(F.utilisateur(e.responsable).nom) + '</span></p></div><div class="liste__droite">' + delai(e.jours) + '</div></li>';
      }).join('') + '</ul>';
    }
    animerGraphiques(zone);
  }

  function ecranIntrouvable(titre) {
    contenu.innerHTML = '<section class="ecran" aria-labelledby="titre-ecran"><article class="carte">' + etatVide(titre || 'Page introuvable', 'L’adresse demandée ne correspond à aucun écran de la maquette.', '', '') + '<p class="vide__texte" id="titre-ecran"><a href="#/dashboard">Retour au tableau de bord</a></p></article></section>';
  }

  /* ================================================================ Routeur */
  var ROUTES = {
    dashboard: { rendre: ecranDashboard, titre: 'Tableau de bord', fil: [{ libelle: 'Pilotage' }, { libelle: 'Tableau de bord' }] },
    audits: { rendre: ecranAudits, titre: 'Liste des audits', fil: [{ libelle: 'Audits' }, { libelle: 'Liste des audits' }] },
    audit: { rendre: ecranAudit, titre: 'Fiche d’audit', fil: function (id) { var a = F.audit(id); return [{ libelle: 'Audits' }, { libelle: 'Liste des audits', href: '#/audits' }, { libelle: a ? a.id + ' · ' + a.nom : id }]; } },
    formulaire: { rendre: ecranFormulaire, titre: 'Nouvel audit', fil: [{ libelle: 'Audits' }, { libelle: 'Liste des audits', href: '#/audits' }, { libelle: 'Nouvel audit' }] },
    retex: { rendre: ecranRetex, titre: 'RETEX', fil: [{ libelle: 'Résilience' }, { libelle: 'RETEX ' + F.incidents[0].id }] },
    composants: { rendre: ecranComposants, titre: 'Composants', fil: [{ libelle: 'Système' }, { libelle: 'Composants' }] },
  };
  function router() {
    var hash = location.hash || '#/dashboard';
    var m = hash.match(/^#\/([a-z]+)(?:\/([A-Za-z0-9-]+))?\/?$/);
    var nom = m ? m[1] : '', param = m ? m[2] : '';
    var route = ROUTES[nom];
    if (!modale.hidden) fermerModale();
    cacherBulle();
    if (!route || (nom === 'audit' && !param)) {
      marquerNavigation('');
      filAriane([{ libelle: 'Page introuvable' }]);
      document.title = 'Page introuvable — Suivi des audits SMSI';
      ecranIntrouvable();
    } else {
      marquerNavigation(nom);
      filAriane(typeof route.fil === 'function' ? route.fil(param) : route.fil);
      document.title = route.titre + ' — Suivi des audits SMSI';
      route.rendre(param);
    }
    window.scrollTo(0, 0);
    contenu.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', router);
  /* La page comparative pilote l'écran de l'iframe : { type: 'route', hash: '#/audits' } */
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'route' && typeof d.hash === 'string' && /^#\//.test(d.hash)) {
      if (location.hash === d.hash) router(); else location.hash = d.hash;
    }
  });

  initialiserCoquille();
  if (!location.hash) location.replace('#/dashboard');
  router();
})();
