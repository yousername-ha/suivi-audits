/* Maquette C — Sobre institutionnel santé. Rendu des écrans, graphiques SVG natifs, interactions.
   JS natif, sans module, sans dépendance. Données : window.FAKE uniquement, aucune persistance. */
(function () {
  'use strict';

  var F = window.FAKE;
  var $ = function (sel, racine) { return (racine || document).querySelector(sel); };
  var $$ = function (sel, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(sel)); };
  var MOUVEMENT_REDUIT = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(nom, classe) {
    return '<svg class="ico' + (classe ? ' ' + classe : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + nom + '"></use></svg>';
  }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function pct(n) { return Math.round(n) + ' %'; }
  function nomUtilisateur(id) { return F.utilisateur(id).nom; }
  function avatar(id, petit) {
    var u = F.utilisateur(id);
    return '<span class="avatar avatar--contour' + (petit ? ' avatar--petit' : '') + '" aria-hidden="true">' + esc(u.initiales) + '</span>';
  }
  function personne(id) { return '<span class="cell-icone">' + avatar(id, true) + esc(nomUtilisateur(id)) + '</span>'; }
  function heure(isoH) { return isoH.slice(11, 16).replace(':', ' h '); }
  function dateHeure(isoH) { return F.fr(isoH.slice(0, 10)); }

  /* ------------------------------------------------------------------ Vocabulaire visuel des statuts */
  var STATUT_AUDIT = {
    'Planifié': { classe: 'info', ico: 'calendrier', couleur: 'var(--g-2)' },
    'En préparation': { classe: 'neutre', ico: 'horloge', couleur: 'var(--g-6)' },
    'En cours': { classe: 'bleu', ico: 'point', couleur: 'var(--g-1)' },
    'Rapport attendu': { classe: 'alerte', ico: 'fiche', couleur: 'var(--g-4)' },
    'Clos': { classe: 'ok', ico: 'check', couleur: 'var(--g-5)' },
    'Reporté': { classe: 'reporte', ico: 'pause', couleur: 'var(--c-reporte)' },
  };
  var CRITICITE = {
    'Critique': { classe: 'erreur', ico: 'alerte', couleur: 'var(--g-3)' },
    'Majeure': { classe: 'alerte', ico: 'alerte', couleur: 'var(--g-4)' },
    'Mineure': { classe: 'info', ico: 'info', couleur: 'var(--g-2)' },
    'Observation': { classe: 'neutre', ico: 'point', couleur: 'var(--g-6)' },
  };
  var STATUT_CONSTAT = {
    'Ouvert': { classe: 'alerte', ico: 'point' },
    'En cours': { classe: 'info', ico: 'horloge' },
    'À vérifier': { classe: 'reporte', ico: 'loupe' },
    'Clos': { classe: 'ok', ico: 'check' },
  };
  var STATUT_ACTION = {
    'À faire': { classe: 'neutre', ico: 'point', couleur: 'var(--g-6)' },
    'En cours': { classe: 'info', ico: 'horloge', couleur: 'var(--g-2)' },
    'Bloquée': { classe: 'erreur', ico: 'bloc', couleur: 'var(--g-3)' },
    'Terminée': { classe: 'ok', ico: 'check', couleur: 'var(--g-5)' },
  };
  var PRIORITE = { P1: 'erreur', P2: 'alerte', P3: 'neutre' };
  var GRAVITE_RETEX = ['ok', 'neutre', 'alerte', 'alerte', 'erreur'];

  function badge(libelle, table, extra) {
    var d = table[libelle] || { classe: 'neutre', ico: 'point' };
    return '<span class="badge badge--' + d.classe + (extra ? ' ' + extra : '') + '">' + ico(d.ico) + esc(libelle) + '</span>';
  }
  function badgeTexte(libelle, classe) { return '<span class="badge badge--' + classe + '">' + esc(libelle) + '</span>'; }
  function badgeReferentiel(id) { var r = F.referentiel(id); return '<span class="badge badge--contour">' + esc(r ? r.court : id) + '</span>'; }
  function echeanceCellule(isoDate, statutClos) {
    var j = F.daysUntil(isoDate);
    if (statutClos) return '<time datetime="' + isoDate + '">' + F.fr(isoDate) + '</time>';
    if (j < 0) return '<span class="cell-icone" title="Échéance dépassée"><time datetime="' + isoDate + '">' + F.fr(isoDate) + '</time>' + badgeTexte('Dépassée de ' + pluriel(-j, 'jour', 'jours'), 'erreur') + '</span>';
    if (j <= 14) return '<span class="cell-icone"><time datetime="' + isoDate + '">' + F.fr(isoDate) + '</time>' + badgeTexte('J-' + j, 'alerte') + '</span>';
    return '<time datetime="' + isoDate + '">' + F.fr(isoDate) + '</time>';
  }
  function jauge(valeur, variante, libelle) {
    var cls = variante ? ' jauge--' + variante : '';
    return '<div class="jauge' + cls + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + valeur + '" aria-label="' + esc(libelle || 'Avancement') + '">' +
      '<div class="jauge__piste"><div class="jauge__barre" data-p="' + (valeur / 100) + '"></div></div><span class="jauge__valeur">' + pct(valeur) + '</span></div>';
  }
  function titreEcran(numero, sur, titre, intro, actions) {
    return '<header class="titre-ecran"><span class="titre-ecran__numero" aria-hidden="true">' + numero + '</span><div><p class="titre-ecran__sur">' + esc(sur) + '</p><h2>' + esc(titre) + '</h2>' +
      (intro ? '<p class="titre-ecran__intro">' + intro + '</p>' : '') + '</div>' + (actions ? '<div class="titre-ecran__actions">' + actions + '</div>' : '') + '</header>';
  }
  function sectionEntete(numero, titre, note) {
    return '<div class="section__entete"><span class="section__numero">' + numero + '</span><h3>' + esc(titre) + '</h3>' + (note ? '<span class="section__note">' + note + '</span>' : '') + '</div>';
  }
  function carteEntete(sur, titre, note) {
    return '<div class="carte__entete"><div><p class="carte__sur">' + esc(sur) + '</p><h4 class="carte__titre">' + esc(titre) + '</h4></div>' + (note ? '<span class="carte__note">' + note + '</span>' : '') + '</div>';
  }

  /* ------------------------------------------------------------------ Graphiques SVG */
  function legende(items) {
    return '<ul class="graphique__legende">' + items.map(function (it) {
      return '<li data-couleur="' + esc(it.couleur) + '"><i aria-hidden="true"></i>' + esc(it.libelle) + (it.valeur != null ? ' <span class="val">' + esc(it.valeur) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function graphique(svg, legendeHtml, titreAccessible, classe) {
    return '<figure class="graphique' + (classe ? ' ' + classe : '') + '" role="img" aria-label="' + esc(titreAccessible) + '">' + svg + (legendeHtml || '') + '</figure>';
  }
  /* Barres horizontales : libellé, valeur, couleur */
  function barresHorizontales(items, options) {
    options = options || {};
    var max = Math.max.apply(null, items.map(function (i) { return i.valeur; })) || 1;
    var larg = 440, gauche = options.gauche || 128, droite = 44, h = 26, ecart = 10, haut = 4;
    var hauteur = items.length * (h + ecart) + haut;
    var svg = '<svg viewBox="0 0 ' + larg + ' ' + hauteur + '" xmlns="http://www.w3.org/2000/svg">';
    items.forEach(function (it, i) {
      var y = haut + i * (h + ecart);
      var w = Math.max(2, ((larg - gauche - droite) * it.valeur) / max);
      svg += '<text x="' + (gauche - 10) + '" y="' + (y + h / 2 + 4) + '" text-anchor="end">' + esc(it.libelle) + '</text>';
      svg += '<rect x="' + gauche + '" y="' + y + '" width="' + (larg - gauche - droite) + '" height="' + h + '" fill="var(--c-doux)"/>';
      svg += '<rect class="barre-h survol" tabindex="0" data-infobulle="' + esc('<strong>' + it.libelle + '</strong><br>' + pluriel(it.valeur, it.unite || 'élément', it.unites || 'éléments') + (it.part != null ? ' · ' + it.part : '')) + '" x="' + gauche + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + it.couleur + '" data-delai="' + (i * 60) + '"><title>' + esc(it.libelle + ' : ' + it.valeur) + '</title></rect>';
      svg += '<text class="etiquette-forte" x="' + (gauche + w + 8) + '" y="' + (y + h / 2 + 4) + '">' + it.valeur + '</text>';
    });
    svg += '</svg>';
    return svg;
  }
  /* Anneau */
  function donut(items, centre, sousTitre) {
    var total = items.reduce(function (s, i) { return s + i.valeur; }, 0) || 1;
    var r = 70, C = 2 * Math.PI * r, debut = 0;
    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g class="donut-groupe">';
    svg += '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="var(--c-doux)" stroke-width="22"/>';
    items.forEach(function (it) {
      var len = (C * it.valeur) / total;
      svg += '<circle class="survol" tabindex="0" data-infobulle="' + esc('<strong>' + it.libelle + '</strong><br>' + pluriel(it.valeur, it.unite || 'élément', it.unites || 'éléments') + ' · ' + pct((100 * it.valeur) / total)) + '" cx="100" cy="100" r="' + r + '" fill="none" stroke="' + it.couleur + '" stroke-width="22" stroke-dasharray="' + Math.max(0, len - 2) + ' ' + (C - Math.max(0, len - 2)) + '" stroke-dashoffset="' + (-debut) + '" transform="rotate(-90 100 100)"><title>' + esc(it.libelle + ' : ' + it.valeur) + '</title></circle>';
      debut += len;
    });
    svg += '</g><text class="donut-centre" x="100" y="106" text-anchor="middle">' + esc(centre) + '</text>';
    svg += '<text class="donut-centre-sous" x="100" y="126" text-anchor="middle">' + esc(sousTitre) + '</text></svg>';
    return svg;
  }
  /* Jauge demi-circulaire : valeur / cible */
  function jaugeSvg(valeur, cible, max, unite) {
    var cx = 110, cy = 100, r = 80, ep = 16;
    function point(p) { var a = Math.PI * (1 - p); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
    function arc(p0, p1) {
      var a = point(p0), b = point(p1);
      return 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 0 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
    }
    var pv = Math.min(1, valeur / max), pc = Math.min(1, cible / max);
    var longueur = Math.PI * r * pv;
    var marque = point(pc), marqueInt = [cx + (r - ep) * Math.cos(Math.PI * (1 - pc)), cy - (r - ep) * Math.sin(Math.PI * (1 - pc))];
    var svg = '<svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg">';
    svg += '<path d="' + arc(0, 1) + '" fill="none" stroke="var(--c-doux)" stroke-width="' + ep + '"/>';
    svg += '<path class="trace survol" tabindex="0" data-infobulle="' + esc('<strong>Taux de conformité</strong><br>' + valeur + ' ' + unite + ' mesuré · cible ' + cible + ' ' + unite) + '" data-longueur="' + longueur.toFixed(1) + '" d="' + arc(0, pv) + '" fill="none" stroke="' + (valeur >= cible ? 'var(--g-5)' : 'var(--g-1)') + '" stroke-width="' + ep + '"><title>' + esc('Taux de conformité : ' + valeur + ' ' + unite) + '</title></path>';
    svg += '<line x1="' + marqueInt[0].toFixed(1) + '" y1="' + marqueInt[1].toFixed(1) + '" x2="' + (marque[0] + (marque[0] - marqueInt[0]) * 0.5).toFixed(1) + '" y2="' + (marque[1] + (marque[1] - marqueInt[1]) * 0.5).toFixed(1) + '" stroke="var(--c-terre)" stroke-width="2.5"/>';
    svg += '<text class="jauge-svg-valeur" x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle">' + valeur + '<tspan font-size="14" fill="var(--c-texte-2)"> ' + esc(unite) + '</tspan></text>';
    svg += '<text x="' + (cx - r) + '" y="' + (cy + 16) + '" text-anchor="middle">0</text><text x="' + (cx + r) + '" y="' + (cy + 16) + '" text-anchor="middle">' + max + '</text>';
    svg += '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" fill="var(--c-terre)" font-weight="600">cible ' + cible + ' ' + esc(unite) + '</text>';
    svg += '</svg>';
    return svg;
  }
  /* Courbe d'évolution à deux séries */
  function courbe(series, etiquettesX) {
    var larg = 760, haut = 240, g = 36, d = 16, h = 20, b = 36;
    var maxV = Math.max.apply(null, series.reduce(function (acc, s) { return acc.concat(s.valeurs); }, [])) || 1;
    var plafond = Math.ceil(maxV / 5) * 5;
    var n = etiquettesX.length;
    function x(i) { return g + (i * (larg - g - d)) / (n - 1); }
    function y(v) { return h + (haut - h - b) * (1 - v / plafond); }
    var svg = '<svg viewBox="0 0 ' + larg + ' ' + haut + '" xmlns="http://www.w3.org/2000/svg">';
    for (var k = 0; k <= plafond; k += 5) {
      svg += '<line class="grille-h" x1="' + g + '" x2="' + (larg - d) + '" y1="' + y(k).toFixed(1) + '" y2="' + y(k).toFixed(1) + '"/>';
      svg += '<text x="' + (g - 8) + '" y="' + (y(k) + 4).toFixed(1) + '" text-anchor="end">' + k + '</text>';
    }
    etiquettesX.forEach(function (m, i) { svg += '<text x="' + x(i).toFixed(1) + '" y="' + (haut - 12) + '" text-anchor="middle">' + esc(m) + '</text>'; });
    svg += '<line class="axe" x1="' + g + '" x2="' + (larg - d) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    series.forEach(function (s, si) {
      var pts = s.valeurs.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
      if (s.aire) svg += '<polygon class="aire" points="' + x(0).toFixed(1) + ',' + y(0).toFixed(1) + ' ' + pts.join(' ') + ' ' + x(n - 1).toFixed(1) + ',' + y(0).toFixed(1) + '" fill="' + s.couleur + '" fill-opacity="0.08"/>';
      svg += '<polyline class="trace" points="' + pts.join(' ') + '" fill="none" stroke="' + s.couleur + '" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"' + (s.pointille ? ' stroke-dasharray="4 4"' : '') + ' data-delai="' + (si * 150) + '"/>';
    });
    series.forEach(function (s) {
      s.valeurs.forEach(function (v, i) {
        svg += '<circle class="point-courbe survol" tabindex="0" data-infobulle="' + esc('<strong>' + etiquettesX[i] + '</strong><br>' + s.libelle + ' : ' + v) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4" fill="var(--c-surface)" stroke="' + s.couleur + '" stroke-width="2"><title>' + esc(etiquettesX[i] + ' — ' + s.libelle + ' : ' + v) + '</title></circle>';
      });
    });
    svg += '</svg>';
    return svg;
  }
  /* Barre empilée unique (répartition) */
  function barreEmpilee(items) {
    var total = items.reduce(function (s, i) { return s + i.valeur; }, 0) || 1;
    var larg = 440, hBarre = 22, xx = 0;
    var svg = '<svg viewBox="0 0 ' + larg + ' ' + hBarre + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">';
    items.forEach(function (it, i) {
      var w = (larg * it.valeur) / total;
      svg += '<rect class="barre-h survol" tabindex="0" data-infobulle="' + esc('<strong>' + it.libelle + '</strong><br>' + pluriel(it.valeur, 'action', 'actions') + ' · ' + pct((100 * it.valeur) / total)) + '" x="' + xx.toFixed(1) + '" y="0" width="' + Math.max(0, w - 1.5).toFixed(1) + '" height="' + hBarre + '" fill="' + it.couleur + '" data-delai="' + (i * 80) + '"><title>' + esc(it.libelle + ' : ' + it.valeur) + '</title></rect>';
      xx += w;
    });
    svg += '</svg>';
    return svg;
  }
  function sparkline(valeurs, libelle) {
    var larg = 96, haut = 24, min = Math.min.apply(null, valeurs), max = Math.max.apply(null, valeurs);
    var amp = max - min || 1;
    var pts = valeurs.map(function (v, i) { return ((i * (larg - 6)) / (valeurs.length - 1) + 3).toFixed(1) + ',' + (haut - 3 - ((v - min) / amp) * (haut - 6)).toFixed(1); });
    var dernier = pts[pts.length - 1].split(',');
    return '<svg class="sparkline" viewBox="0 0 ' + larg + ' ' + haut + '" role="img" aria-label="' + esc(libelle + ', douze derniers mois') + '"><path d="M' + pts.join(' L') + '"/><circle class="dernier" cx="' + dernier[0] + '" cy="' + dernier[1] + '" r="2.5"/></svg>';
  }
  /* Courbe en escalier de la gravité (RETEX) */
  function escalierGravite(evenements) {
    var larg = 760, haut = 150, g = 70, d = 16, h = 14, b = 40, n = evenements.length;
    function x(i) { return g + (i * (larg - g - d)) / (n - 1); }
    function y(v) { return h + (haut - h - b) * (1 - v / 4); }
    var svg = '<svg viewBox="0 0 ' + larg + ' ' + haut + '" xmlns="http://www.w3.org/2000/svg">';
    F.vocabulaire.gravitesRetex.forEach(function (lib, v) {
      svg += '<line class="grille-h" x1="' + g + '" x2="' + (larg - d) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
      svg += '<text x="' + (g - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(lib) + '</text>';
    });
    var pts = [];
    evenements.forEach(function (e, i) {
      if (i > 0) pts.push(x(i).toFixed(1) + ',' + y(evenements[i - 1].gravite).toFixed(1));
      pts.push(x(i).toFixed(1) + ',' + y(e.gravite).toFixed(1));
      svg += '<text x="' + x(i).toFixed(1) + '" y="' + (haut - 14) + '" text-anchor="middle">' + esc(heure(e.h)) + '</text>';
    });
    svg += '<polyline class="trace" points="' + pts.join(' ') + '" fill="none" stroke="var(--g-3)" stroke-width="2.25" stroke-linejoin="round"/>';
    evenements.forEach(function (e, i) {
      svg += '<circle class="point-courbe survol" tabindex="0" data-infobulle="' + esc('<strong>' + heure(e.h) + ' · ' + e.type + '</strong><br>' + e.titre + '<br>Gravité : ' + F.vocabulaire.gravitesRetex[e.gravite]) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(e.gravite).toFixed(1) + '" r="4.5" fill="var(--c-surface)" stroke="var(--g-3)" stroke-width="2"><title>' + esc(e.type + ' : ' + F.vocabulaire.gravitesRetex[e.gravite]) + '</title></circle>';
    });
    svg += '</svg>';
    return svg;
  }
  /* Après insertion : pose les variables CSS dynamiques et déclenche les animations */
  function activerGraphiques(racine) {
    $$('[data-delai]', racine).forEach(function (el) { el.style.setProperty('--delai', el.getAttribute('data-delai') + 'ms'); });
    $$('.trace', racine).forEach(function (el) {
      var L = el.getAttribute('data-longueur');
      if (!L && el.getTotalLength) { try { L = el.getTotalLength(); } catch (e) { L = 1000; } }
      el.style.setProperty('--longueur', (Math.ceil(L) + 2) + '');
    });
    $$('.graphique__legende li[data-couleur]', racine).forEach(function (li) { li.style.setProperty('--c', li.getAttribute('data-couleur')); });
    $$('.jauge__barre[data-p]', racine).forEach(function (el) { el.style.setProperty('--p', '0'); });
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        $$('.graphique', racine).forEach(function (g) { g.classList.add('est-anime'); });
        $$('.jauge__barre[data-p]', racine).forEach(function (el) { el.style.setProperty('--p', el.getAttribute('data-p')); });
      });
    });
  }

  /* ------------------------------------------------------------------ Infobulles */
  var infobulle = $('#infobulle');
  function montrerInfobulle(cible, x, y) {
    infobulle.innerHTML = cible.getAttribute('data-infobulle');
    infobulle.hidden = false;
    positionnerInfobulle(x, y);
  }
  function positionnerInfobulle(x, y) {
    var w = infobulle.offsetWidth, h = infobulle.offsetHeight;
    var px = Math.min(x + 14, window.innerWidth - w - 8), py = y + 16;
    if (py + h > window.innerHeight - 8) py = y - h - 10;
    infobulle.style.setProperty('--x', Math.max(8, px) + 'px');
    infobulle.style.setProperty('--y', Math.max(8, py) + 'px');
  }
  document.addEventListener('mouseover', function (e) {
    var c = e.target.closest && e.target.closest('[data-infobulle]');
    if (c) montrerInfobulle(c, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', function (e) {
    if (!infobulle.hidden && e.target.closest && e.target.closest('[data-infobulle]')) positionnerInfobulle(e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest('[data-infobulle]')) infobulle.hidden = true;
  });
  document.addEventListener('focusin', function (e) {
    var c = e.target.closest && e.target.closest('[data-infobulle]');
    if (c) { var r = c.getBoundingClientRect(); montrerInfobulle(c, r.left + r.width / 2, r.top + r.height / 2); }
  });
  document.addEventListener('focusout', function (e) {
    if (e.target.closest && e.target.closest('[data-infobulle]')) infobulle.hidden = true;
  });

  /* ------------------------------------------------------------------ Toasts */
  var toasts = $('#toasts');
  var TOAST_ICO = { succes: 'check', alerte: 'alerte', erreur: 'erreur', info: 'info' };
  function toast(type, titre, texte) {
    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
    t.innerHTML = ico(TOAST_ICO[type] || 'info') + '<div><strong>' + esc(titre) + '</strong>' + (texte ? '<p>' + esc(texte) + '</p>' : '') + '</div>' +
      '<button type="button" class="btn-icone" aria-label="Fermer la notification">' + ico('fermer') + '</button>';
    toasts.appendChild(t);
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { t.classList.add('est-visible'); }); });
    var minuterie = window.setTimeout(fermer, 6000);
    function fermer() {
      window.clearTimeout(minuterie);
      t.classList.add('est-sortant');
      window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, MOUVEMENT_REDUIT ? 160 : 260);
    }
    $('button', t).addEventListener('click', fermer);
    return t;
  }

  /* ------------------------------------------------------------------ Modale de confirmation */
  var modale = $('#modale'), modaleFond = $('#modale-fond');
  var modaleOuvreur = null, modaleConfirmer = null;
  function ouvrirModale(options) {
    modaleOuvreur = document.activeElement;
    $('#modale-titre').textContent = options.titre;
    $('#modale-texte').textContent = options.texte;
    $('#modale-confirmer').textContent = options.libelleConfirmer || 'Confirmer';
    modaleConfirmer = options.onConfirmer || null;
    modale.hidden = false; modaleFond.hidden = false;
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { modale.classList.add('est-visible'); modaleFond.classList.add('est-visible'); }); });
    $('#modale-annuler').focus();
    document.addEventListener('keydown', clavierModale);
  }
  function fermerModale() {
    modale.classList.remove('est-visible'); modaleFond.classList.remove('est-visible');
    document.removeEventListener('keydown', clavierModale);
    window.setTimeout(function () { modale.hidden = true; modaleFond.hidden = true; }, MOUVEMENT_REDUIT ? 160 : 260);
    if (modaleOuvreur && modaleOuvreur.focus) modaleOuvreur.focus();
  }
  function clavierModale(e) {
    if (e.key === 'Escape') { e.preventDefault(); fermerModale(); return; }
    if (e.key === 'Tab') {
      var focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modale).filter(function (el) { return !el.disabled; });
      var premier = focusables[0], dernier = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      else if (!modale.contains(document.activeElement)) { e.preventDefault(); premier.focus(); }
    }
  }
  $('#modale-annuler').addEventListener('click', fermerModale);
  modaleFond.addEventListener('click', fermerModale);
  $('#modale-confirmer').addEventListener('click', function () { var cb = modaleConfirmer; fermerModale(); if (cb) cb(); });

  /* ------------------------------------------------------------------ Onglets */
  function installerOnglets(racine, onChange) {
    var liste = $('[role="tablist"]', racine), onglets = $$('[role="tab"]', liste), indicateur = $('.onglets__indicateur', liste);
    function placer(onglet) {
      var r = onglet.getBoundingClientRect(), rl = liste.getBoundingClientRect();
      indicateur.style.setProperty('--x', (r.left - rl.left) + 'px');
      indicateur.style.setProperty('--w', r.width + '');
    }
    function activer(onglet, focaliser) {
      onglets.forEach(function (o) {
        var actif = o === onglet;
        o.setAttribute('aria-selected', String(actif));
        o.setAttribute('tabindex', actif ? '0' : '-1');
        var p = document.getElementById(o.getAttribute('aria-controls'));
        if (p) p.hidden = !actif;
      });
      placer(onglet);
      if (focaliser) onglet.focus();
      if (onChange) onChange(onglet);
    }
    onglets.forEach(function (o, i) {
      o.addEventListener('click', function () { activer(o); });
      o.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % onglets.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + onglets.length) % onglets.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = onglets.length - 1;
        if (j !== null) { e.preventDefault(); activer(onglets[j], true); }
      });
    });
    var initial = onglets.filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0] || onglets[0];
    activer(initial);
    window.addEventListener('resize', function () { var a = $('[role="tab"][aria-selected="true"]', liste); if (a) placer(a); });
  }

  /* ------------------------------------------------------------------ Écran 1 : Dashboard */
  function ecranDashboard() {
    var K = F.kpi;
    var tauxActions = Math.round((100 * K.actionsTerminees) / K.actions);
    var kpis = [
      { libelle: 'Audits en cours', valeur: K.auditsEnCours, detail: pluriel(K.auditsAVenir, 'audit à venir', 'audits à venir'), ico: 'calendrier', classe: '' },
      { libelle: 'Constats ouverts', valeur: K.constatsOuverts, detail: 'sur ' + F.constats.length + ' constats relevés', ico: 'fiche', classe: '' },
      { libelle: 'Non-conformités ouvertes', valeur: K.ncOuvertes, detail: pluriel(K.parCriticiteNC['Critique'] || 0, 'critique', 'critiques') + ' à traiter en priorité', ico: 'alerte', classe: 'alerte', alerte: true },
      { libelle: 'Actions en retard', valeur: K.actionsEnRetard, detail: 'échéance dépassée', ico: 'horloge', classe: 'erreur', alerte: true },
      { libelle: 'Taux de conformité', valeur: K.conformite, unite: '%', detail: '+1 point sur le mois, cible 90 %', ico: 'hausse', classe: 'ok' },
      { libelle: 'Actions terminées', valeur: tauxActions, unite: '%', detail: K.actionsTerminees + ' sur ' + K.actions + ' actions', ico: 'check', classe: 'ok' },
    ];
    var statuts = F.vocabulaire.statutsAudit.map(function (s) { return { libelle: s, valeur: K.parStatutAudit[s] || 0, couleur: STATUT_AUDIT[s].couleur, unite: 'audit', unites: 'audits' }; });
    var ncs = ['Critique', 'Majeure', 'Mineure'].map(function (c) { return { libelle: c, valeur: K.parCriticiteNC[c] || 0, couleur: CRITICITE[c].couleur, unite: 'non-conformité', unites: 'non-conformités' }; });
    var actions = F.vocabulaire.statutsAction.map(function (s) { return { libelle: s, valeur: K.parStatutAction[s] || 0, couleur: STATUT_ACTION[s].couleur }; });
    var series = [
      { libelle: 'Constats ouverts', valeurs: F.evolution.map(function (e) { return e.ouverts; }), couleur: 'var(--g-3)' },
      { libelle: 'Constats clos', valeurs: F.evolution.map(function (e) { return e.clos; }), couleur: 'var(--g-1)', aire: true },
    ];
    var depassees = K.echeancesDepassees;

    var html = titreEcran('01', 'Pilotage du SMSI', 'Tableau de bord', 'Situation consolidée du système de management de la sécurité de l’information au ' + F.frLong(F.aujourdhui) + ', ' + esc(F.organisation.periode.toLowerCase()) + '.',
      '<a class="btn btn--secondaire" href="#/audits">' + ico('liste') + 'Liste des audits</a><a class="btn btn--primaire" href="#/formulaire">' + ico('plus') + 'Nouvel audit</a>');

    html += '<section class="section" aria-labelledby="s-kpi">' + sectionEntete('1.1', 'Indicateurs clés', 'Au ' + F.fr(F.aujourdhui)).replace('<h3>', '<h3 id="s-kpi">') +
      '<div class="grille grille--kpi">' + kpis.map(function (k) {
        return '<article class="kpi col-2' + (k.alerte ? ' kpi--alerte' : '') + '"><p class="kpi__libelle">' + esc(k.libelle) + '</p><p class="kpi__valeur">' + k.valeur + (k.unite ? '<span class="kpi__unite">' + k.unite + '</span>' : '') + '</p>' +
          '<p class="kpi__detail' + (k.classe ? ' kpi__detail--' + k.classe : '') + '">' + ico(k.ico) + esc(k.detail) + '</p></article>';
      }).join('') + '</div></section>';

    html += '<section class="section" aria-labelledby="s-audits">' + sectionEntete('1.2', 'Audits et non-conformités').replace('<h3>', '<h3 id="s-audits">') + '<div class="grille">' +
      '<article class="carte col-4">' + carteEntete('Programme d’audit', 'État des audits par statut', F.audits.length + ' audits') + graphique(barresHorizontales(statuts), null, 'Nombre d’audits par statut', 'graphique--barres') + '</article>' +
      '<article class="carte col-4">' + carteEntete('Non-conformités ouvertes', 'Répartition par criticité', K.ncOuvertes + ' NC') + graphique(donut(ncs, String(K.ncOuvertes), 'NC ouvertes'), legende(ncs), 'Non-conformités ouvertes par criticité', 'graphique--anneau') + '</article>' +
      '<article class="carte col-4">' + carteEntete('Conformité ISO 27001', 'Taux de conformité et cible', F.indicateurs[0].tendance === 'hausse' ? '<span class="tendance tendance--ok">' + ico('hausse') + 'en hausse</span>' : '') + graphique(jaugeSvg(F.indicateurs[0].valeur, F.indicateurs[0].cible, 100, '%'), null, 'Jauge du taux de conformité', 'graphique--jauge') +
      '<div class="carte__pied"><span>Dernière mesure : octobre 2026</span><span>' + (F.indicateurs[0].cible - F.indicateurs[0].valeur) + ' points de la cible</span></div></article>' +
      '</div></section>';

    html += '<section class="section" aria-labelledby="s-evolution">' + sectionEntete('1.3', 'Évolution et plan d’actions').replace('<h3>', '<h3 id="s-evolution">') + '<div class="grille">' +
      '<article class="carte col-8">' + carteEntete('Douze derniers mois', 'Constats ouverts et clos par mois', 'nov. 2025 – oct. 2026') + graphique(courbe(series, F.vocabulaire.mois), legende(series.map(function (s) { return { libelle: s.libelle, couleur: s.couleur }; })), 'Courbe mensuelle des constats ouverts et clos') + '</article>' +
      '<article class="carte col-4">' + carteEntete('Actions correctives', 'Avancement du plan d’actions', K.actions + ' actions') + graphique(barreEmpilee(actions), legende(actions.map(function (a) { return { libelle: a.libelle, couleur: a.couleur, valeur: a.valeur }; })), 'Répartition des actions par statut') +
      '<ul class="liste-cle-valeur"><li><span class="cle">Taux de réalisation</span><span class="val">' + pct(tauxActions) + '</span></li><li><span class="cle">Actions bloquées</span><span class="val">' + (K.parStatutAction['Bloquée'] || 0) + '</span></li><li><span class="cle">En retard</span><span class="val">' + K.actionsEnRetard + '</span></li><li><span class="cle">Risques de niveau élevé</span><span class="val">' + K.risquesEleves + ' sur ' + F.risques.length + '</span></li></ul></article>' +
      '</div></section>';

    html += '<section class="section" aria-labelledby="s-echeances">' + sectionEntete('1.4', 'Échéances et indicateurs du SMSI').replace('<h3>', '<h3 id="s-echeances">') + '<div class="grille">' +
      '<article class="carte col-6">' + carteEntete('Prochaines échéances', 'Constats et actions à traiter', pluriel(depassees.length, 'échéance dépassée', 'échéances dépassées')) +
      '<div class="bandeau bandeau--erreur">' + ico('alerte') + '<div><strong>' + pluriel(depassees.length, 'échéance dépassée', 'échéances dépassées') + '</strong>La plus ancienne : ' + esc(depassees[0].titre) + ' (' + F.fr(depassees[0].echeance) + ', ' + (-depassees[0].jours) + ' jours de retard).</div></div>' +
      '<ul class="echeances">' + depassees.slice(-3).map(function (e) {
        return '<li><time datetime="' + e.echeance + '">' + F.fr(e.echeance) + '</time><span class="titre">' + esc(e.titre) + '<small>' + esc(e.genre) + ' ' + esc(e.id) + ' · ' + esc(nomUtilisateur(e.responsable)) + '</small></span>' + badgeTexte('Dépassée de ' + pluriel(-e.jours, 'jour', 'jours'), 'erreur') + '</li>';
      }).join('') + K.prochainesEcheances.slice(0, 5).map(function (e) {
        return '<li><time datetime="' + e.echeance + '">' + F.fr(e.echeance) + '</time><span class="titre">' + esc(e.titre) + '<small>' + esc(e.genre) + ' ' + esc(e.id) + ' · ' + esc(nomUtilisateur(e.responsable)) + '</small></span>' + badgeTexte('J-' + e.jours, e.jours <= 7 ? 'alerte' : 'info') + '</li>';
      }).join('') + '</ul></article>' +
      '<article class="carte col-6">' + carteEntete('Indicateurs du SMSI', 'Valeur, cible et tendance', '8 indicateurs') + '<div class="tableau-cadre"><table class="tableau tableau--compact"><thead><tr><th scope="col">Indicateur</th><th scope="col" class="num">Valeur</th><th scope="col" class="num">Cible</th><th scope="col">Tendance</th><th scope="col">12 mois</th></tr></thead><tbody>' +
      F.indicateurs.map(function (i) {
        var bon = i.id === 'I3' || i.id === 'I7' ? i.valeur <= i.cible : i.valeur >= i.cible;
        var tend = i.tendance === 'hausse' ? { ico: 'hausse', lib: 'hausse' } : i.tendance === 'baisse' ? { ico: 'baisse', lib: 'baisse' } : { ico: 'stable', lib: 'stable' };
        var favorable = i.tendance === 'stable' ? 'stable' : ((i.id === 'I3' || i.id === 'I7') === (i.tendance === 'baisse')) ? 'ok' : 'ko';
        return '<tr><td class="cell-principale">' + esc(i.libelle) + '</td><td class="num">' + i.valeur + esc(i.unite === '%' ? ' %' : i.unite ? ' ' + i.unite : '') + '</td><td class="num">' + i.cible + esc(i.unite === '%' ? ' %' : i.unite ? ' ' + i.unite : '') + (bon ? ' ' + ico('check', 'tendance--ok') : '') + '</td>' +
          '<td><span class="tendance tendance--' + favorable + '">' + ico(tend.ico) + esc(tend.lib) + '</span></td><td>' + sparkline(i.historique, i.libelle) + '</td></tr>';
      }).join('') + '</tbody></table></div></article>' +
      '</div></section>';
    return html;
  }

  /* ------------------------------------------------------------------ Écran 2 : Liste des audits */
  var etatListe = { recherche: '', statut: '', type: '', referentiel: '', tri: 'debut', sens: 'desc', page: 1 };
  var COLONNES = [
    { cle: 'id', libelle: 'N°' }, { cle: 'nom', libelle: 'Intitulé et site' }, { cle: 'type', libelle: 'Type' }, { cle: 'referentiel', libelle: 'Référentiel' },
    { cle: 'debut', libelle: 'Début' }, { cle: 'responsable', libelle: 'Responsable' }, { cle: 'statut', libelle: 'Statut' }, { cle: 'progression', libelle: 'Avancement', num: true }, { cle: 'nbConstats', libelle: 'Constats', num: true },
  ];
  function auditsFiltres() {
    var q = etatListe.recherche.trim().toLowerCase();
    var liste = F.audits.filter(function (a) {
      if (etatListe.statut && a.statut !== etatListe.statut) return false;
      if (etatListe.type && a.type !== etatListe.type) return false;
      if (etatListe.referentiel && a.referentiel !== etatListe.referentiel) return false;
      if (!q) return true;
      var texte = [a.id, a.nom, a.site, a.type, a.statut, F.referentiel(a.referentiel).libelle, nomUtilisateur(a.responsable), a.auditeur, a.perimetre].join(' ').toLowerCase();
      return texte.indexOf(q) !== -1;
    });
    var cle = etatListe.tri, sens = etatListe.sens === 'asc' ? 1 : -1;
    liste.sort(function (a, b) {
      var va = a[cle], vb = b[cle];
      if (cle === 'responsable') { va = nomUtilisateur(va); vb = nomUtilisateur(vb); }
      if (cle === 'referentiel') { va = F.referentiel(va).court; vb = F.referentiel(vb).court; }
      if (typeof va === 'number') return (va - vb) * sens;
      return String(va).localeCompare(String(vb), 'fr') * sens;
    });
    return liste;
  }
  function selectOptions(liste, courant, tout) {
    return '<option value="">' + esc(tout) + '</option>' + liste.map(function (o) {
      var v = typeof o === 'string' ? o : o.id, l = typeof o === 'string' ? o : o.libelle;
      return '<option value="' + esc(v) + '"' + (v === courant ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }
  function ecranAudits() {
    var html = titreEcran('02', 'Registre', 'Liste des audits', F.audits.length + ' audits inscrits au programme, du cycle de certification aux audits internes et fournisseurs.',
      '<a class="btn btn--primaire" href="#/formulaire">' + ico('plus') + 'Nouvel audit</a>');
    html += '<section class="section" aria-label="Filtres et tableau des audits">' +
      '<div class="outils">' +
      '<div class="champ recherche-cadre"><label for="recherche">Recherche</label><div class="recherche">' + ico('loupe') + '<input id="recherche" type="search" placeholder="Intitulé, site, responsable, numéro…" value="' + esc(etatListe.recherche) + '" autocomplete="off"></div></div>' +
      '<div class="champ"><label for="f-statut">Statut</label><select id="f-statut">' + selectOptions(F.vocabulaire.statutsAudit, etatListe.statut, 'Tous les statuts') + '</select></div>' +
      '<div class="champ"><label for="f-type">Type</label><select id="f-type">' + selectOptions(F.vocabulaire.typesAudit, etatListe.type, 'Tous les types') + '</select></div>' +
      '<div class="champ"><label for="f-ref">Référentiel</label><select id="f-ref">' + selectOptions(F.referentiels, etatListe.referentiel, 'Tous les référentiels') + '</select></div>' +
      '<button type="button" class="btn btn--secondaire" id="reinit-filtres">Réinitialiser</button>' +
      '</div>' +
      '<div id="zone-liste"></div></section>';
    return html;
  }
  function rendreTableauAudits() {
    var zone = $('#zone-liste');
    var liste = auditsFiltres();
    var parPage = 10, pages = Math.max(1, Math.ceil(liste.length / parPage));
    if (etatListe.page > pages) etatListe.page = pages;
    var debut = (etatListe.page - 1) * parPage, tranche = liste.slice(debut, debut + parPage);
    var html = '<p class="resume-liste" aria-live="polite"><span><strong>' + liste.length + '</strong> ' + (liste.length > 1 ? 'audits' : 'audit') + (liste.length !== F.audits.length ? ' sur ' + F.audits.length : '') + (liste.length ? ' · affichage ' + (debut + 1) + ' à ' + (debut + tranche.length) : '') + '</span><span>Tri : ' + esc(COLONNES.filter(function (c) { return c.cle === etatListe.tri; })[0].libelle.toLowerCase()) + ', ' + (etatListe.sens === 'asc' ? 'croissant' : 'décroissant') + '</span></p>';
    if (!liste.length) {
      html += '<div class="carte"><div class="vide">' + illustrationVide() + '<h4>Aucun audit ne correspond</h4><p>Modifiez la recherche ou les filtres pour retrouver des audits.</p><button type="button" class="btn btn--secondaire" id="vide-reinit">Réinitialiser les filtres</button></div></div>';
      zone.innerHTML = html;
      $('#vide-reinit').addEventListener('click', reinitialiserFiltres);
      return;
    }
    html += '<div class="carte carte--plate tableau-cadre"><table class="tableau" aria-label="Audits"><thead><tr>' + COLONNES.map(function (c) {
      var actif = c.cle === etatListe.tri;
      var icone = actif ? (etatListe.sens === 'asc' ? 'tri-asc' : 'tri-desc') : 'tri';
      return '<th scope="col"' + (c.num ? ' class="num"' : '') + (actif ? ' aria-sort="' + (etatListe.sens === 'asc' ? 'ascending' : 'descending') + '"' : '') + '><button type="button" class="tri" data-tri="' + c.cle + '">' + esc(c.libelle) + ico(icone) + '<span class="sr-only">, trier</span></button></th>';
    }).join('') + '</tr></thead><tbody>' + tranche.map(function (a) {
      return '<tr class="est-cliquable" data-id="' + a.id + '"><td><span class="cartouche">' + a.id + '</span></td>' +
        '<td class="cell-principale"><a href="#/audit/' + a.id + '">' + esc(a.nom) + '</a><span class="cell-secondaire">' + esc(a.site) + '</span></td>' +
        '<td>' + esc(a.type) + '</td><td>' + badgeReferentiel(a.referentiel) + '</td>' +
        '<td><time datetime="' + a.debut + '">' + F.fr(a.debut) + '</time><span class="cell-secondaire">au ' + F.fr(a.fin) + '</span></td>' +
        '<td>' + personne(a.responsable) + '</td><td>' + badge(a.statut, STATUT_AUDIT) + '</td>' +
        '<td class="num">' + jauge(a.progression, a.statut === 'Clos' ? 'ok' : '', 'Avancement de ' + a.nom) + '</td>' +
        '<td class="num">' + (a.nbConstats ? a.nbConstats : '<span class="cell-secondaire">—</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    html += '<nav class="resume-liste" aria-label="Pagination"><span>Page ' + etatListe.page + ' sur ' + pages + '</span><div class="pagination">' +
      '<button type="button" class="pagination__page" data-page="' + (etatListe.page - 1) + '"' + (etatListe.page === 1 ? ' disabled' : '') + ' aria-label="Page précédente">' + ico('fleche-g') + '</button>';
    for (var p = 1; p <= pages; p++) {
      html += '<button type="button" class="pagination__page" data-page="' + p + '"' + (p === etatListe.page ? ' aria-current="page"' : '') + ' aria-label="Page ' + p + '">' + p + '</button>';
    }
    html += '<button type="button" class="pagination__page" data-page="' + (etatListe.page + 1) + '"' + (etatListe.page === pages ? ' disabled' : '') + ' aria-label="Page suivante">' + ico('fleche-d') + '</button></div></nav>';
    zone.innerHTML = html;
    activerGraphiques(zone);
    $$('.tri', zone).forEach(function (b) {
      b.addEventListener('click', function () {
        var cle = b.getAttribute('data-tri');
        if (etatListe.tri === cle) etatListe.sens = etatListe.sens === 'asc' ? 'desc' : 'asc';
        else { etatListe.tri = cle; etatListe.sens = cle === 'debut' || cle === 'progression' || cle === 'nbConstats' ? 'desc' : 'asc'; }
        etatListe.page = 1;
        rendreTableauAudits();
        var nb = $('.tri[data-tri="' + cle + '"]', zone); if (nb) nb.focus();
      });
    });
    $$('.pagination__page[data-page]', zone).forEach(function (b) {
      b.addEventListener('click', function () { etatListe.page = parseInt(b.getAttribute('data-page'), 10); rendreTableauAudits(); var t = $('.tableau', zone); if (t) t.scrollIntoView({ block: 'nearest' }); });
    });
    $$('tr.est-cliquable', zone).forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        location.hash = '#/audit/' + tr.getAttribute('data-id');
      });
    });
  }
  function reinitialiserFiltres() {
    etatListe.recherche = ''; etatListe.statut = ''; etatListe.type = ''; etatListe.referentiel = ''; etatListe.page = 1;
    $('#recherche').value = ''; $('#f-statut').value = ''; $('#f-type').value = ''; $('#f-ref').value = '';
    rendreTableauAudits();
  }
  function brancherAudits() {
    var minuterie;
    $('#recherche').addEventListener('input', function (e) {
      window.clearTimeout(minuterie);
      minuterie = window.setTimeout(function () { etatListe.recherche = e.target.value; etatListe.page = 1; rendreTableauAudits(); }, 120);
    });
    $('#f-statut').addEventListener('change', function (e) { etatListe.statut = e.target.value; etatListe.page = 1; rendreTableauAudits(); });
    $('#f-type').addEventListener('change', function (e) { etatListe.type = e.target.value; etatListe.page = 1; rendreTableauAudits(); });
    $('#f-ref').addEventListener('change', function (e) { etatListe.referentiel = e.target.value; etatListe.page = 1; rendreTableauAudits(); });
    $('#reinit-filtres').addEventListener('click', reinitialiserFiltres);
    rendreTableauAudits();
  }

  /* ------------------------------------------------------------------ Écran 3 : Fiche d'un audit */
  function ecranAudit(id) {
    var a = F.audit(id);
    if (!a) {
      return titreEcran('03', 'Fiche', 'Audit introuvable', 'Aucun audit ne porte le numéro ' + esc(id) + '.', '<a class="btn btn--secondaire" href="#/audits">' + ico('fleche-g') + 'Retour à la liste</a>');
    }
    var constats = F.constatsDe(id), actions = F.actionsDe(id), histo = F.historiqueAudit(a);
    var nc = constats.filter(function (c) { return c.type.indexOf('NC') === 0; });
    var enRetard = actions.filter(function (x) { return x.statut !== 'Terminée' && F.daysUntil(x.echeance) < 0; }).length;
    var terminees = actions.filter(function (x) { return x.statut === 'Terminée'; }).length;
    var parType = F.compterPar(constats, 'type');
    var typesItems = F.vocabulaire.typesConstat.filter(function (t) { return parType[t]; }).map(function (t, i) {
      return { libelle: t, valeur: parType[t], couleur: ['var(--g-3)', 'var(--g-4)', 'var(--g-2)', 'var(--g-5)', 'var(--g-6)'][i % 5], unite: 'constat', unites: 'constats' };
    });
    var ref = F.referentiel(a.referentiel);

    var html = '<p><a href="#/audits" class="cell-icone">' + ico('fleche-g') + 'Liste des audits</a></p>';
    html += '<header class="titre-ecran"><span class="titre-ecran__numero" aria-hidden="true">03</span><div class="fiche-entete"><div><p class="titre-ecran__sur">Fiche d’audit · <span class="cartouche">' + a.id + '</span></p><h2>' + esc(a.nom) + '</h2>' +
      '<div class="fiche-entete__badges">' + badge(a.statut, STATUT_AUDIT) + badgeTexte(a.type, 'contour') + badgeReferentiel(a.referentiel) + (a.nbConstats ? badge(a.criticite, CRITICITE) : '') + '</div></div>' +
      '<div class="fiche-progression"><p class="kpi__libelle">Avancement</p><p class="kpi__valeur">' + a.progression + '<span class="kpi__unite">%</span></p>' + jauge(a.progression, a.statut === 'Clos' ? 'ok' : '', 'Avancement de l’audit') + '</div></div>' +
      '<div class="titre-ecran__actions"><button type="button" class="btn btn--secondaire" id="fiche-exporter">' + ico('fiche') + 'Exporter la fiche</button><a class="btn btn--primaire" href="#/formulaire">Modifier</a></div></header>';

    html += '<dl class="meta"><div><dt>' + ico('calendrier') + 'Dates</dt><dd>' + F.fr(a.debut) + ' – ' + F.fr(a.fin) + '<span class="cell-secondaire">' + (F.daysUntil(a.debut) > 0 ? 'dans ' + pluriel(F.daysUntil(a.debut), 'jour', 'jours') : F.daysUntil(a.fin) >= 0 ? 'en cours' : 'terminé') + '</span></dd></div>' +
      '<div><dt>' + ico('lieu') + 'Site</dt><dd>' + esc(a.site) + '<span class="cell-secondaire">' + esc(a.perimetre) + '</span></dd></div>' +
      '<div><dt>' + ico('utilisateur') + 'Responsable</dt><dd>' + personne(a.responsable) + '<span class="cell-secondaire">' + esc(F.utilisateur(a.responsable).role) + '</span></dd></div>' +
      '<div><dt>' + ico('loupe') + 'Auditeur</dt><dd>' + esc(a.auditeur) + '<span class="cell-secondaire">' + esc(ref.libelle) + '</span></dd></div></dl>';

    html += '<div class="section"><div class="onglets" role="tablist" aria-label="Rubriques de la fiche">' +
      '<button role="tab" class="onglet" id="ong-synthese" aria-controls="pan-synthese" aria-selected="true">Synthèse</button>' +
      '<button role="tab" class="onglet" id="ong-constats" aria-controls="pan-constats" aria-selected="false">Constats <span class="onglet__compteur">' + constats.length + '</span></button>' +
      '<button role="tab" class="onglet" id="ong-actions" aria-controls="pan-actions" aria-selected="false">Plan d’actions <span class="onglet__compteur">' + actions.length + '</span></button>' +
      '<button role="tab" class="onglet" id="ong-historique" aria-controls="pan-historique" aria-selected="false">Historique <span class="onglet__compteur">' + histo.length + '</span></button>' +
      '<span class="onglets__indicateur" aria-hidden="true"></span></div>';

    /* Synthèse */
    html += '<div class="panneau" role="tabpanel" id="pan-synthese" aria-labelledby="ong-synthese" tabindex="0"><div class="grille">' +
      '<article class="carte col-8">' + carteEntete('3.1', 'Objet et périmètre') + '<p>' + esc(a.description.charAt(0).toUpperCase() + a.description.slice(1)) + '</p><p class="note-marge">Référentiel : ' + esc(ref.libelle) + ' · Périmètre : ' + esc(a.perimetre.toLowerCase()) + ' · Auditeur : ' + esc(a.auditeur) + '.</p>' +
      (typesItems.length ? '<div class="carte__entete"><div><p class="carte__sur">3.2</p><h4 class="carte__titre">Répartition des constats par type</h4></div></div>' + graphique(barresHorizontales(typesItems, { gauche: 120 }), null, 'Constats par type', 'graphique--barres') : '<div class="vide">' + illustrationVide() + '<h4>Aucun constat pour l’instant</h4><p>Les constats seront saisis à l’issue de la réunion de clôture.</p></div>') + '</article>' +
      '<article class="carte col-4">' + carteEntete('3.3', 'Chiffres clés') + '<ul class="liste-cle-valeur"><li><span class="cle">Constats relevés</span><span class="val">' + constats.length + '</span></li><li><span class="cle">dont non-conformités</span><span class="val">' + nc.length + '</span></li><li><span class="cle">Constats ouverts</span><span class="val">' + constats.filter(function (c) { return c.statut !== 'Clos'; }).length + '</span></li><li><span class="cle">Actions correctives</span><span class="val">' + actions.length + '</span></li><li><span class="cle">Actions terminées</span><span class="val">' + terminees + '</span></li><li><span class="cle">Actions en retard</span><span class="val">' + enRetard + '</span></li></ul>' +
      '<div class="carte__pied"><span>Criticité maximale</span>' + (a.nbConstats ? badge(a.criticite, CRITICITE) : badgeTexte('Sans objet', 'neutre')) + '</div></article>' +
      '</div></div>';

    /* Constats */
    html += '<div class="panneau" role="tabpanel" id="pan-constats" aria-labelledby="ong-constats" tabindex="0" hidden>' +
      (constats.length ? '<div class="carte carte--plate tableau-cadre"><table class="tableau" aria-label="Constats de l’audit"><thead><tr><th scope="col">N°</th><th scope="col">Réf.</th><th scope="col">Constat</th><th scope="col">Type</th><th scope="col">Criticité</th><th scope="col">Statut</th><th scope="col">Responsable</th><th scope="col">Échéance</th></tr></thead><tbody>' +
        constats.map(function (c) {
          return '<tr><td><span class="cartouche">' + c.id + '</span></td><td class="mono">' + esc(c.ref) + '</td><td class="cell-principale">' + esc(c.titre) + '<span class="cell-secondaire">' + esc(c.description) + '</span></td><td>' + esc(c.type) + '</td><td>' + badge(c.criticite, CRITICITE) + '</td><td>' + badge(c.statut, STATUT_CONSTAT) + '</td><td>' + personne(c.responsable) + '</td><td>' + echeanceCellule(c.echeance, c.statut === 'Clos') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="carte"><div class="vide">' + illustrationVide() + '<h4>Aucun constat</h4><p>Cet audit n’a pas encore donné lieu à des constats.</p></div></div>') + '</div>';

    /* Plan d'actions */
    html += '<div class="panneau" role="tabpanel" id="pan-actions" aria-labelledby="ong-actions" tabindex="0" hidden>' +
      (actions.length ? '<div class="carte carte--plate tableau-cadre"><table class="tableau" aria-label="Plan d’actions"><thead><tr><th scope="col">N°</th><th scope="col">Action</th><th scope="col">Priorité</th><th scope="col">Responsable</th><th scope="col">Échéance</th><th scope="col">Statut</th><th scope="col">Charge</th><th scope="col" class="num">Avancement</th></tr></thead><tbody>' +
        actions.map(function (x) {
          return '<tr><td><span class="cartouche">' + x.id + '</span></td><td class="cell-principale">' + esc(x.titre) + '<span class="cell-secondaire">Constat ' + esc(x.constatId) + '</span></td><td>' + badgeTexte(x.priorite, PRIORITE[x.priorite]) + '</td><td>' + personne(x.responsable) + '</td><td>' + echeanceCellule(x.echeance, x.statut === 'Terminée') + '</td><td>' + badge(x.statut, STATUT_ACTION) + '</td><td class="num">' + esc(x.charge) + '</td><td class="num">' + jauge(x.avancement, x.statut === 'Terminée' ? 'ok' : x.statut === 'Bloquée' ? 'erreur' : '', 'Avancement de ' + x.titre) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="carte"><div class="vide">' + illustrationVide() + '<h4>Aucune action</h4><p>Le plan d’actions sera arbitré après diffusion du rapport.</p></div></div>') + '</div>';

    /* Historique */
    html += '<div class="panneau" role="tabpanel" id="pan-historique" aria-labelledby="ong-historique" tabindex="0" hidden><article class="carte col-12">' + carteEntete('3.4', 'Journal de l’audit', histo.length + ' événements') +
      '<ol class="chrono">' + histo.map(function (h) {
        var futur = F.daysUntil(h.quand) > 0;
        return '<li' + (futur ? ' class="est-futur"' : '') + '><time datetime="' + h.quand + '">' + F.fr(h.quand) + '</time><span>' + esc(h.quoi) + (futur ? ' ' + badgeTexte('À venir', 'info') : '') + '</span><span class="qui">' + avatar(h.qui, true) + esc(nomUtilisateur(h.qui)) + '</span></li>';
      }).join('') + '</ol></article></div>';
    html += '</div>';
    return html;
  }
  function brancherAudit() {
    var ecran = $('#ecran');
    installerOnglets(ecran);
    var exporter = $('#fiche-exporter');
    if (exporter) exporter.addEventListener('click', function () { toast('info', 'Export simulé', 'La fiche serait exportée au format PDF dans l’application réelle.'); });
  }

  /* ------------------------------------------------------------------ Écran 4 : Formulaire */
  function champ(id, libelle, controle, options) {
    options = options || {};
    return '<div class="champ' + (options.pleine ? ' pleine' : '') + '"><label for="' + id + '">' + esc(libelle) + (options.obligatoire ? '<span class="champ__obligatoire" aria-hidden="true">*</span><span class="sr-only"> (obligatoire)</span>' : '') + '</label>' +
      controle + (options.aide ? '<p class="champ__aide" id="' + id + '-aide">' + esc(options.aide) + '</p>' : '') + '<p class="champ__erreur" id="' + id + '-erreur"></p></div>';
  }
  function ecranFormulaire() {
    var html = titreEcran('04', 'Saisie', 'Nouvel audit', 'Inscription d’un audit au programme. Les champs marqués d’un astérisque sont obligatoires ; la fiche est vérifiée champ par champ puis à l’enregistrement.');
    html += '<div class="grille"><div class="col-8"><div id="formulaire-messages"></div><form class="carte formulaire" id="formulaire-audit" novalidate>' +
      '<fieldset class="formulaire__bloc"><legend><span class="section__numero">4.1</span>Identification</legend><div class="formulaire__grille">' +
      champ('f-nom', 'Intitulé de l’audit', '<input id="f-nom" name="nom" type="text" required aria-required="true" aria-describedby="f-nom-aide f-nom-erreur" maxlength="120" placeholder="Ex. Audit interne — gestion des accès">', { obligatoire: true, pleine: true, aide: 'Intitulé court, tel qu’il apparaîtra dans le registre et le programme d’audit.' }) +
      champ('f-type', 'Type d’audit', '<select id="f-type" name="type" required aria-required="true" aria-describedby="f-type-erreur">' + selectOptions(F.vocabulaire.typesAudit, '', 'Choisir un type') + '</select>', { obligatoire: true }) +
      champ('f-ref', 'Référentiel', '<select id="f-ref" name="referentiel" required aria-required="true" aria-describedby="f-ref-erreur">' + selectOptions(F.referentiels, '', 'Choisir un référentiel') + '</select>', { obligatoire: true }) +
      champ('f-site', 'Site audité', '<select id="f-site" name="site" aria-describedby="f-site-erreur">' + selectOptions(F.sites, '', 'Tous les sites du GHT') + '</select>') +
      champ('f-resp', 'Responsable du suivi', '<select id="f-resp" name="responsable" required aria-required="true" aria-describedby="f-resp-aide f-resp-erreur">' + selectOptions(F.utilisateurs.map(function (u) { return { id: u.id, libelle: u.nom + ' — ' + u.role }; }), '', 'Choisir une personne') + '</select>', { obligatoire: true, aide: 'Personne chargée du suivi du plan d’actions.' }) +
      '</div></fieldset>' +
      '<fieldset class="formulaire__bloc"><legend><span class="section__numero">4.2</span>Calendrier</legend><div class="formulaire__grille">' +
      champ('f-debut', 'Date de début', '<input id="f-debut" name="debut" type="date" required aria-required="true" aria-describedby="f-debut-erreur">', { obligatoire: true }) +
      champ('f-fin', 'Date de fin', '<input id="f-fin" name="fin" type="date" required aria-required="true" aria-describedby="f-fin-aide f-fin-erreur">', { obligatoire: true, aide: 'Égale ou postérieure à la date de début.' }) +
      '</div></fieldset>' +
      '<fieldset class="formulaire__bloc"><legend><span class="section__numero">4.3</span>Périmètre</legend><div class="formulaire__grille">' +
      champ('f-perimetre', 'Périmètre', '<input id="f-perimetre" name="perimetre" type="text" aria-describedby="f-perimetre-erreur" placeholder="Ex. Hébergement des données de santé">', { pleine: true }) +
      champ('f-desc', 'Description', '<textarea id="f-desc" name="description" aria-describedby="f-desc-aide f-desc-erreur" maxlength="600"></textarea>', { pleine: true, aide: 'Objectifs, processus concernés, documents attendus. 600 caractères au plus.' }) +
      '<div class="champ champ--case pleine"><input id="f-convoc" name="convocation" type="checkbox"><label for="f-convoc">Envoyer les convocations aux pilotes de processus dès l’enregistrement</label></div>' +
      '</div></fieldset>' +
      '<div class="formulaire__actions"><span class="note">Aucune donnée n’est enregistrée : simulation.</span><a class="btn btn--secondaire" href="#/audits">Annuler</a><button type="submit" class="btn btn--primaire" id="soumettre">' + ico('check') + 'Enregistrer l’audit</button></div>' +
      '</form></div>' +
      '<aside class="col-4"><article class="carte carte--papier"><p class="carte__sur">Aide à la saisie</p><dl class="aside-aide"><dt>Type d’audit</dt><dd>Certification et surveillance sont menés par l’organisme certificateur ; les audits internes, fournisseurs et blancs par l’équipe SMSI.</dd><dt>Référentiel</dt><dd>' + F.referentiels.map(function (r) { return esc(r.libelle); }).join(', ') + '.</dd><dt>Statut initial</dt><dd>L’audit est créé avec le statut « Planifié » ; il passe « En préparation » 45 jours avant la date de début.</dd><dt>Numérotation</dt><dd>Le numéro AUD-' + (F.audits.length + 1 < 10 ? '0' : '') + (F.audits.length + 1) + ' sera attribué automatiquement.</dd></dl></article></aside></div>';
    return html;
  }
  function brancherFormulaire() {
    var form = $('#formulaire-audit'), messages = $('#formulaire-messages'), soumettre = $('#soumettre');
    var REGLES = {
      'f-nom': function (v) { if (!v.trim()) return 'Indiquez l’intitulé de l’audit.'; if (v.trim().length < 5) return 'L’intitulé doit comporter au moins 5 caractères.'; return ''; },
      'f-type': function (v) { return v ? '' : 'Choisissez un type d’audit.'; },
      'f-ref': function (v) { return v ? '' : 'Choisissez un référentiel.'; },
      'f-resp': function (v) { return v ? '' : 'Désignez un responsable du suivi.'; },
      'f-debut': function (v) { return v ? '' : 'Indiquez la date de début.'; },
      'f-fin': function (v) { if (!v) return 'Indiquez la date de fin.'; var d = $('#f-debut').value; if (d && v < d) return 'La date de fin doit être égale ou postérieure à la date de début.'; return ''; },
      'f-perimetre': function () { return ''; },
      'f-desc': function (v) { return v.length > 600 ? 'La description dépasse 600 caractères.' : ''; },
      'f-site': function () { return ''; },
    };
    function valider(id) {
      var el = document.getElementById(id), err = document.getElementById(id + '-erreur');
      var m = REGLES[id](el.value);
      if (m) { el.setAttribute('aria-invalid', 'true'); err.innerHTML = ico('erreur') + esc(m); }
      else { el.removeAttribute('aria-invalid'); err.textContent = ''; }
      return m;
    }
    Object.keys(REGLES).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('blur', function () { if (el.value || el.getAttribute('aria-invalid')) valider(id); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) valider(id); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid')) valider(id); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      messages.innerHTML = '';
      var erreurs = Object.keys(REGLES).map(function (id) { var m = valider(id); return m ? { id: id, message: m } : null; }).filter(Boolean);
      if (erreurs.length) {
        messages.innerHTML = '<div class="bandeau bandeau--erreur" role="alert" tabindex="-1" id="resume-erreurs">' + ico('erreur') + '<div><strong>' + pluriel(erreurs.length, 'champ à corriger', 'champs à corriger') + '</strong><ul>' +
          erreurs.map(function (er) { return '<li><a href="#' + er.id + '" data-focus="' + er.id + '">' + esc($('label[for="' + er.id + '"]').textContent.replace('*', '').replace('(obligatoire)', '').trim()) + '</a> : ' + esc(er.message) + '</li>'; }).join('') + '</ul></div></div>';
        $$('[data-focus]', messages).forEach(function (l) { l.addEventListener('click', function (ev) { ev.preventDefault(); document.getElementById(l.getAttribute('data-focus')).focus(); }); });
        $('#resume-erreurs').focus();
        toast('erreur', 'Formulaire incomplet', pluriel(erreurs.length, 'champ est à corriger', 'champs sont à corriger') + '.');
        return;
      }
      var nom = $('#f-nom').value.trim();
      soumettre.disabled = true;
      soumettre.innerHTML = ico('horloge') + 'Enregistrement…';
      window.setTimeout(function () {
        soumettre.disabled = false;
        soumettre.innerHTML = ico('check') + 'Enregistrer l’audit';
        messages.innerHTML = '<div class="bandeau bandeau--succes" role="status" tabindex="-1" id="succes">' + ico('check') + '<div><strong>Audit « ' + esc(nom) + ' » enregistré (simulation).</strong>Il serait inscrit au registre avec le statut « Planifié » sous le numéro AUD-' + (F.audits.length + 1) + '. <a href="#/audits">Consulter la liste des audits</a></div></div>';
        $('#succes').focus();
        toast('succes', 'Audit enregistré', nom);
        form.reset();
      }, 900);
    });
  }

  /* ------------------------------------------------------------------ Écran 5 : RETEX */
  var etatRetex = { visibles: 1 };
  function ecranRetex() {
    var inc = F.incidents[0];
    var duree = Math.round((new Date(inc.fin) - new Date(inc.debut)) / 3600000);
    var html = titreEcran('05', 'Retour d’expérience', 'Chronologie de l’incident ' + inc.id, 'Déroulé point par point des événements, de la détection à la clôture, pour le retour d’expérience avec les pilotes de processus.');
    html += '<article class="carte"><div class="retex-entete"><div><p class="carte__sur">Incident <span class="cartouche">' + inc.id + '</span></p><h3 class="carte__titre" id="retex-titre">' + esc(inc.titre) + '</h3><p class="titre-ecran__intro">' + esc(inc.impact) + '</p></div>' +
      '<dl class="meta"><div><dt>' + ico('calendrier') + 'Période</dt><dd>' + dateHeure(inc.debut) + ' ' + heure(inc.debut) + '<span class="cell-secondaire">au ' + dateHeure(inc.fin) + ' ' + heure(inc.fin) + '</span></dd></div><div><dt>' + ico('horloge') + 'Durée</dt><dd>' + duree + ' h<span class="cell-secondaire">' + inc.evenements.length + ' événements</span></dd></div><div><dt>' + ico('utilisateur') + 'Pilote</dt><dd>' + personne(inc.pilote) + '</dd></div><div><dt>' + ico('alerte') + 'Gravité max.</dt><dd>' + badgeTexte(F.vocabulaire.gravitesRetex[inc.graviteMax], GRAVITE_RETEX[inc.graviteMax]) + '</dd></div></dl></div></article>';
    html += '<section class="section" aria-labelledby="s-chrono">' + sectionEntete('5.1', 'Déroulé des événements', '<span class="compteur" id="retex-compteur"></span>').replace('<h3>', '<h3 id="s-chrono">') +
      '<div class="retex-commandes"><button type="button" class="btn btn--primaire" id="retex-suivant">' + ico('fleche-d') + 'Point suivant</button><button type="button" class="btn btn--secondaire" id="retex-tout">Tout dérouler</button><button type="button" class="btn btn--discret" id="retex-reinit">Réinitialiser</button><span class="note-marge">Clavier : flèches pour avancer ou reculer, Fin pour tout dérouler, Début pour revenir.</span></div>' +
      '<p class="sr-only" aria-live="polite" id="retex-annonce"></p>' +
      '<article class="carte"><ol class="retex-chrono" id="retex-chrono" tabindex="0" aria-label="Chronologie, ' + inc.evenements.length + ' points">' + inc.evenements.map(function (e, i) {
        return '<li class="retex-point retex-point--g' + e.gravite + '" data-index="' + i + '" aria-hidden="true"><div class="retex-point__temps"><strong>' + heure(e.h) + '</strong>' + dateHeure(e.h) + '</div>' +
          '<div class="retex-point__axe"><span class="retex-point__puce" aria-hidden="true">' + (i + 1) + '</span><span class="retex-point__trait"></span></div>' +
          '<div class="retex-point__corps"><p class="retex-point__type"><span>' + esc(e.type) + '</span>' + badgeTexte('Gravité ' + F.vocabulaire.gravitesRetex[e.gravite].toLowerCase(), GRAVITE_RETEX[e.gravite]) + '</p><h4 class="retex-point__titre">' + esc(e.titre) + '</h4><p class="retex-point__detail">' + esc(e.detail) + '</p><p class="retex-point__acteur">' + avatar(e.acteur, true) + esc(nomUtilisateur(e.acteur)) + ' · ' + esc(F.utilisateur(e.acteur).role) + '</p></div></li>';
      }).join('') + '</ol><p class="retex-a-venir" id="retex-a-venir"></p></article></section>';
    html += '<section class="section retex-suite" id="retex-suite" aria-labelledby="s-ens">' + sectionEntete('5.2', 'Gravité au fil de l’incident et enseignements').replace('<h3>', '<h3 id="s-ens">') + '<div class="grille">' +
      '<article class="carte col-8">' + carteEntete('Courbe', 'Niveau de gravité par événement') + graphique(escalierGravite(inc.evenements), null, 'Gravité de l’incident au fil des événements', 'graphique--escalier') + '</article>' +
      '<article class="carte col-4">' + carteEntete('Enseignements', inc.enseignements.length + ' points retenus') + '<ol class="enseignements">' + inc.enseignements.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></article></div></section>';
    return html;
  }
  function brancherRetex() {
    var inc = F.incidents[0], n = inc.evenements.length;
    var points = $$('.retex-point'), compteur = $('#retex-compteur'), annonce = $('#retex-annonce'), aVenir = $('#retex-a-venir'), suite = $('#retex-suite'), chrono = $('#retex-chrono');
    var suivant = $('#retex-suivant'), tout = $('#retex-tout'), reinit = $('#retex-reinit');
    var suiteAnimee = false;
    function appliquer(annoncer) {
      var v = etatRetex.visibles;
      points.forEach(function (p, i) {
        var vis = i < v;
        p.classList.toggle('est-visible', vis);
        p.setAttribute('aria-hidden', String(!vis));
      });
      compteur.textContent = v + ' / ' + n + ' points';
      suivant.disabled = v >= n;
      tout.disabled = v >= n;
      reinit.disabled = v <= 1;
      if (v < n) { aVenir.hidden = false; aVenir.textContent = 'Point suivant : ' + inc.evenements[v].type.toLowerCase() + ' à ' + heure(inc.evenements[v].h) + '.'; }
      else { aVenir.hidden = true; }
      if (v >= n) { suite.classList.add('est-visible'); if (!suiteAnimee) { suiteAnimee = true; activerGraphiques(suite); } }
      else suite.classList.remove('est-visible');
      if (annoncer) {
        var e = inc.evenements[v - 1];
        annonce.textContent = annoncer === 'tout' ? 'Chronologie entièrement déroulée, ' + n + ' points.' : annoncer === 'reinit' ? 'Chronologie réinitialisée au premier point.' : 'Point ' + v + ' sur ' + n + ' : ' + heure(e.h) + ', ' + e.type + ', ' + e.titre + '.';
      }
    }
    function avancer() { if (etatRetex.visibles < n) { etatRetex.visibles++; appliquer('point'); } }
    function reculer() { if (etatRetex.visibles > 1) { etatRetex.visibles--; appliquer('point'); } }
    suivant.addEventListener('click', avancer);
    tout.addEventListener('click', function () { etatRetex.visibles = n; appliquer('tout'); });
    reinit.addEventListener('click', function () { etatRetex.visibles = 1; appliquer('reinit'); });
    chrono.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avancer(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); reculer(); }
      else if (e.key === 'End') { e.preventDefault(); etatRetex.visibles = n; appliquer('tout'); }
      else if (e.key === 'Home') { e.preventDefault(); etatRetex.visibles = 1; appliquer('reinit'); }
    });
    etatRetex.visibles = 1;
    appliquer();
  }

  /* ------------------------------------------------------------------ Écran 6 : Composants */
  function illustrationVide() {
    return '<svg viewBox="0 0 112 80" aria-hidden="true"><path d="M8 20h34l8 8h54v44H8z"/><path d="M8 32h96" stroke-dasharray="3 4"/><path d="M40 50h32M48 58h16" /><circle cx="90" cy="18" r="7"/><path d="M87 18l2 2 4-4"/></svg>';
  }
  function ecranComposants() {
    var html = titreEcran('06', 'Bibliothèque', 'Composants transverses', 'Éléments partagés par tous les écrans : confirmation, notifications, états vides, chargement, badges et nuancier.');
    html += '<section class="section" aria-labelledby="s-modale">' + sectionEntete('6.1', 'Modale de confirmation').replace('<h3>', '<h3 id="s-modale">') + '<article class="carte"><p>Toute action irréversible passe par une confirmation : le dialogue piège le focus, se ferme par Échap ou par le fond, et rend le focus au bouton d’origine.</p>' +
      '<div class="groupe-boutons"><button type="button" class="btn btn--danger" id="ouvrir-suppression">' + ico('corbeille') + 'Supprimer l’audit AUD-07</button><button type="button" class="btn btn--secondaire" id="ouvrir-cloture">Clore l’audit AUD-07</button></div></article></section>';
    html += '<section class="section" aria-labelledby="s-toasts">' + sectionEntete('6.2', 'Notifications').replace('<h3>', '<h3 id="s-toasts">') + '<article class="carte"><p>Les notifications apparaissent en haut à droite, sont annoncées aux lecteurs d’écran (zone <span class="mono">aria-live</span>) et disparaissent après six secondes ou à la fermeture.</p>' +
      '<div class="groupe-boutons"><button type="button" class="btn btn--secondaire" data-toast="succes">' + ico('check') + 'Succès</button><button type="button" class="btn btn--secondaire" data-toast="alerte">' + ico('alerte') + 'Alerte</button><button type="button" class="btn btn--secondaire" data-toast="erreur">' + ico('erreur') + 'Erreur</button><button type="button" class="btn btn--secondaire" data-toast="info">' + ico('info') + 'Information</button></div></article></section>';
    html += '<section class="section" aria-labelledby="s-etats">' + sectionEntete('6.3', 'État vide et chargement').replace('<h3>', '<h3 id="s-etats">') + '<div class="grille">' +
      '<article class="carte col-6">' + carteEntete('État vide', 'Aucun résultat') + '<div class="vide">' + illustrationVide() + '<h4>Aucun audit planifié sur ce site</h4><p>Les audits inscrits au programme apparaîtront ici. Vous pouvez en créer un dès maintenant.</p><a class="btn btn--primaire" href="#/formulaire">' + ico('plus') + 'Planifier un audit</a></div></article>' +
      '<article class="carte col-6">' + carteEntete('Chargement', 'Squelette puis contenu', '<button type="button" class="btn btn--secondaire btn--petit" id="simuler-chargement">Simuler un chargement</button>') + '<div class="zone-chargement" id="zone-chargement" aria-live="polite" aria-busy="false">' + contenuCharge() + '</div></article></div></section>';
    html += '<section class="section" aria-labelledby="s-badges">' + sectionEntete('6.4', 'Badges, boutons et cartouches').replace('<h3>', '<h3 id="s-badges">') + '<article class="carte galerie">' +
      '<p class="galerie__legende">Statuts d’audit</p><div class="galerie__rang">' + F.vocabulaire.statutsAudit.map(function (s) { return badge(s, STATUT_AUDIT); }).join('') + '</div>' +
      '<p class="galerie__legende">Criticités</p><div class="galerie__rang">' + F.vocabulaire.criticites.map(function (s) { return badge(s, CRITICITE); }).join('') + '</div>' +
      '<p class="galerie__legende">Statuts d’action et priorités</p><div class="galerie__rang">' + F.vocabulaire.statutsAction.map(function (s) { return badge(s, STATUT_ACTION); }).join('') + F.vocabulaire.priorites.map(function (p) { return badgeTexte(p, PRIORITE[p]); }).join('') + '</div>' +
      '<p class="galerie__legende">Boutons</p><div class="galerie__rang"><button type="button" class="btn btn--primaire">Action principale</button><button type="button" class="btn btn--bleu">Institutionnel</button><button type="button" class="btn btn--secondaire">Secondaire</button><button type="button" class="btn btn--discret">Discret</button><button type="button" class="btn btn--danger">Destructif</button><button type="button" class="btn btn--primaire" disabled>Désactivé</button></div>' +
      '<p class="galerie__legende">Cartouches et référentiels</p><div class="galerie__rang"><span class="cartouche">AUD-07</span><span class="cartouche">C-12</span><span class="cartouche">ACT-45</span>' + F.referentiels.map(function (r) { return badgeReferentiel(r.id); }).join('') + '</div></article></section>';
    var nuancier = [
      ['Bleu institutionnel', '#1F3A5F'], ['Bleu clair', '#6B86AA'], ['Terre cuite', '#A84E24'], ['Papier', '#FAF8F3'], ['Surface douce', '#F2EEE5'], ['Filet', '#D8D1C4'],
      ['Encre', '#23221E'], ['Texte secondaire', '#5B564D'], ['Succès', '#2F6B46'], ['Alerte', '#7F5208'], ['Erreur', '#9A3528'], ['Information', '#2B5A88'], ['Reporté', '#5B4A86'], ['Ocre (graphique)', '#A97B26'], ['Sauge (graphique)', '#5C8A6C'], ['Gris chaud (graphique)', '#8B857A'],
    ];
    html += '<section class="section" aria-labelledby="s-nuancier">' + sectionEntete('6.5', 'Nuancier').replace('<h3>', '<h3 id="s-nuancier">') + '<article class="carte"><ul class="nuancier">' + nuancier.map(function (c) { return '<li data-couleur="' + c[1] + '"><i aria-hidden="true"></i><strong>' + esc(c[0]) + '</strong><span class="mono">' + c[1] + '</span></li>'; }).join('') + '</ul></article></section>';
    return html;
  }
  function contenuCharge() {
    var a = F.audits[6], cs = F.constatsDe(a.id);
    return '<div class="contenu-charge"><p class="carte__sur">Contenu chargé</p><h4 class="carte__titre">' + esc(a.nom) + '</h4><p class="note-marge">' + esc(a.site) + ' · ' + F.fr(a.debut) + '</p><ul class="liste-cle-valeur">' + cs.slice(0, 3).map(function (c) { return '<li><span class="cle">' + esc(c.titre) + '</span>' + badge(c.criticite, CRITICITE) + '</li>'; }).join('') + '</ul></div>';
  }
  function brancherComposants() {
    $('#ouvrir-suppression').addEventListener('click', function () {
      ouvrirModale({ titre: 'Supprimer l’audit AUD-07 ?', texte: 'L’audit « Audit HDS — plateforme régionale », ses 5 constats et ses 4 actions seront définitivement retirés du registre. Cette opération ne peut pas être annulée.', libelleConfirmer: 'Supprimer définitivement',
        onConfirmer: function () { toast('succes', 'Audit supprimé (simulation)', 'AUD-07 a été retiré du registre.'); } });
    });
    $('#ouvrir-cloture').addEventListener('click', function () {
      ouvrirModale({ titre: 'Clore l’audit AUD-07 ?', texte: 'La clôture fige le rapport et déclenche l’arbitrage du plan d’actions en revue de direction.', libelleConfirmer: 'Clore l’audit',
        onConfirmer: function () { toast('info', 'Audit clos (simulation)', 'Le plan d’actions sera présenté en revue de direction.'); } });
    });
    var TEXTES = {
      succes: ['Rapport diffusé', 'Le rapport d’audit AUD-05 a été transmis aux pilotes de processus.'],
      alerte: ['Échéance proche', 'L’action ACT-12 arrive à échéance dans 12 jours.'],
      erreur: ['Enregistrement impossible', 'Le serveur n’a pas répondu. Vos modifications sont conservées localement.'],
      info: ['Revue de direction', 'La prochaine revue de direction est fixée au 19 novembre 2026.'],
    };
    $$('[data-toast]').forEach(function (b) { b.addEventListener('click', function () { var t = TEXTES[b.getAttribute('data-toast')]; toast(b.getAttribute('data-toast'), t[0], t[1]); }); });
    var zone = $('#zone-chargement'), btn = $('#simuler-chargement');
    btn.addEventListener('click', function () {
      btn.disabled = true;
      zone.setAttribute('aria-busy', 'true');
      zone.innerHTML = '<div class="squelette" aria-label="Chargement en cours"><div class="squelette__ligne squelette__ligne--titre"></div><div class="squelette__ligne"></div><div class="squelette__ligne squelette__ligne--courte"></div><div class="squelette__ligne squelette__ligne--bloc"></div></div>';
      window.setTimeout(function () {
        zone.innerHTML = contenuCharge();
        zone.setAttribute('aria-busy', 'false');
        btn.disabled = false;
      }, 1600);
    });
    $$('.nuancier li[data-couleur]').forEach(function (li) { li.style.setProperty('--c', li.getAttribute('data-couleur')); });
  }

  /* ------------------------------------------------------------------ Coquille et routage */
  var ROUTES = [
    { hash: '#/dashboard', numero: '01', libelle: 'Tableau de bord', ico: 'tableau' },
    { hash: '#/audits', numero: '02', libelle: 'Audits', ico: 'liste' },
    { hash: '#/audit/AUD-07', numero: '03', libelle: 'Fiche d’audit', ico: 'fiche', prefixe: '#/audit/' },
    { hash: '#/formulaire', numero: '04', libelle: 'Nouvel audit', ico: 'formulaire' },
    { hash: '#/retex', numero: '05', libelle: 'RETEX', ico: 'retex' },
    { hash: '#/composants', numero: '06', libelle: 'Composants', ico: 'composants' },
  ];
  function rendreCoquille() {
    $('#organisation').textContent = F.organisation.nom;
    $('#application').textContent = F.organisation.application;
    $('#sous-titre').textContent = F.organisation.sousTitre;
    $('#periode').textContent = F.organisation.periode;
    $('#date-ref').textContent = F.frLong(F.aujourdhui);
    $('#date-ref').setAttribute('datetime', F.aujourdhui);
    $('#utilisateur').innerHTML = '<span>' + esc(F.moi.nom) + ' · ' + esc(F.moi.role) + '</span><span class="avatar" aria-hidden="true">' + esc(F.moi.initiales) + '</span>';
    $('#pied-organisation').textContent = F.organisation.nom + ' (fictif)';
    $('#nav').innerHTML = ROUTES.map(function (r) {
      return '<li><a class="nav__lien" href="' + r.hash + '" data-route="' + r.hash + '"><span class="nav__numero" aria-hidden="true">' + r.numero + '</span>' + ico(r.ico) + '<span>' + esc(r.libelle) + '</span></a></li>';
    }).join('');
  }
  var premierRendu = true;
  function router() {
    var hash = location.hash || '#/dashboard';
    if (hash === '#/' || hash === '#') hash = '#/dashboard';
    var ecran = $('#ecran'), html = '', brancher = null, routeActive = hash;
    if (hash.indexOf('#/audit/') === 0) { html = ecranAudit(hash.slice(8)); brancher = brancherAudit; routeActive = '#/audit/AUD-07'; }
    else if (hash === '#/audits') { html = ecranAudits(); brancher = brancherAudits; }
    else if (hash === '#/formulaire') { html = ecranFormulaire(); brancher = brancherFormulaire; }
    else if (hash === '#/retex') { html = ecranRetex(); brancher = brancherRetex; }
    else if (hash === '#/composants') { html = ecranComposants(); brancher = brancherComposants; }
    else { html = ecranDashboard(); routeActive = '#/dashboard'; }
    $$('.nav__lien').forEach(function (a) {
      if (a.getAttribute('data-route') === routeActive) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    infobulle.hidden = true;
    ecran.classList.remove('est-entrant');
    ecran.innerHTML = html;
    void ecran.offsetWidth;
    ecran.classList.add('est-entrant');
    if (brancher) brancher();
    activerGraphiques(ecran);
    var titre = $('h2', ecran);
    document.title = (titre ? titre.textContent + ' — ' : '') + F.organisation.application + ' (maquette C)';
    if (!premierRendu) { window.scrollTo(0, 0); $('#contenu').focus({ preventScroll: true }); }
    premierRendu = false;
  }
  window.addEventListener('hashchange', router);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'route' && typeof d.hash === 'string' && d.hash.charAt(0) === '#') {
      if (location.hash === d.hash) router(); else location.hash = d.hash;
    }
  });
  rendreCoquille();
  router();
})();
