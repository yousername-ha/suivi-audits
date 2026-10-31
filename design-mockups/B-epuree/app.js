/* Maquette B — Fidèle épurée. JS natif, sans module, sans dépendance. Tout repose sur window.FAKE. */
(function () {
  'use strict';

  var F = window.FAKE;
  var NS = 'http://www.w3.org/2000/svg';
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ Utilitaires */
  function $(sel, racine) { return (racine || document).querySelector(sel); }
  function $$(sel, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nf(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function svg(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }
  function texte(el, s) { el.textContent = s; return el; }
  function nomUtilisateur(id) { return F.utilisateur(id).nom; }
  function heure(isoH) { var p = isoH.split('T'); return F.frLong(p[0]) + ' · ' + p[1].replace(':', ' h '); }
  function heureCourte(isoH) { return isoH.split('T')[1].replace(':', ' h '); }
  function jeton(nom) { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); }

  /* ------------------------------------------------------------------ Icônes (traits 1,6 px) */
  var ICONES = {
    tableau: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    liste: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    fiche: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    formulaire: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    retex: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    composants: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/>',
    recherche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    fermer: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    'check-cercle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lecture: '<path d="M7 5v14l11-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    document: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    alerte: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.5v.5"/>',
    'alerte-cercle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    oeil: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'moins-cercle': '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    cercle: '<circle cx="12" cy="12" r="9"/>',
    'tri-neutre': '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
    'tri-haut': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'tri-bas': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    'fleche-haut': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'fleche-bas': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    'fleche-stable': '<path d="M5 12h14"/>',
    'fleche-droite': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'fleche-gauche': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    'chevron-gauche': '<path d="m15 6-6 6 6 6"/>',
    'chevron-droite': '<path d="m9 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    utilisateur: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    corbeille: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    drapeau: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    bloc: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    cible: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    eclair: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    dossier: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'tout-derouler': '<path d="M7 4v16M12 4v16M17 4v16" opacity=".35"/><path d="m4 12 4 4M4 12l4-4"/><path d="M8 12h12"/>',
    rafraichir: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  };
  function ico(nom, classe) {
    return '<svg class="ico' + (classe ? ' ' + classe : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONES[nom] || ICONES.cercle) + '</svg>';
  }

  /* ------------------------------------------------------------------ Statuts : couleur + icône + libellé */
  var STATUT_AUDIT = {
    'Planifié': ['neutre', 'calendrier'], 'En préparation': ['info', 'horloge'], 'En cours': ['vert', 'lecture'],
    'Rapport attendu': ['jaune', 'document'], 'Clos': ['succes', 'check-cercle'], 'Reporté': ['alerte', 'pause'],
  };
  var CRITICITE = { 'Critique': ['erreur', 'alerte'], 'Majeure': ['alerte', 'alerte-cercle'], 'Mineure': ['violet', 'moins-cercle'], 'Observation': ['neutre', 'oeil'] };
  var STATUT_CONSTAT = { 'Ouvert': ['alerte', 'cercle'], 'En cours': ['info', 'horloge'], 'À vérifier': ['jaune', 'recherche'], 'Clos': ['succes', 'check-cercle'] };
  var STATUT_ACTION = { 'À faire': ['neutre', 'cercle'], 'En cours': ['info', 'horloge'], 'Bloquée': ['erreur', 'bloc'], 'Terminée': ['succes', 'check-cercle'] };
  var GRAVITE = [['succes', 'check-cercle'], ['info', 'info'], ['jaune', 'alerte-cercle'], ['alerte', 'alerte'], ['erreur', 'alerte']];
  var PRIORITE = { P1: 'erreur', P2: 'alerte', P3: 'neutre' };
  var REF_COULEUR = { vert: 'vert', bleu: 'info', violet: 'violet', orange: 'alerte', gris: 'neutre' };

  function badge(libelle, table, classe) {
    var d = table[libelle] || ['neutre', 'cercle'];
    return '<span class="badge badge-' + d[0] + (classe ? ' ' + classe : '') + '">' + ico(d[1]) + esc(libelle) + '</span>';
  }
  function badgeGravite(g) {
    var d = GRAVITE[g] || GRAVITE[0];
    return '<span class="badge badge-' + d[0] + '">' + ico(d[1]) + 'Gravité ' + esc(F.vocabulaire.gravitesRetex[g].toLowerCase()) + '</span>';
  }
  function badgeRef(id) {
    var r = F.referentiel(id);
    return '<span class="badge badge-' + (REF_COULEUR[r.couleur] || 'neutre') + '">' + ico('drapeau') + esc(r.court) + '</span>';
  }
  function personne(id) {
    var u = F.utilisateur(id);
    return '<span class="personne"><span class="avatar" aria-hidden="true">' + esc(u.initiales) + '</span>' + esc(u.nom) + '</span>';
  }
  function progression(valeur, classe, grande) {
    return '<span class="progression' + (grande ? ' progression-grande' : '') + '" role="img" aria-label="Progression ' + valeur + ' %"><span class="progression-piste"><span class="progression-barre' + (classe ? ' ' + classe : '') + '" data-p="' + (valeur / 100) + '"></span></span><span class="progression-valeur">' + valeur + '&nbsp;%</span></span>';
  }
  function poserVariables(racine) {
    $$('[data-p]', racine).forEach(function (el) { el.style.setProperty('--p', el.getAttribute('data-p')); });
    $$('[data-c]', racine).forEach(function (el) { el.style.setProperty('--c', el.getAttribute('data-c')); });
    $$('[data-t]', racine).forEach(function (el) { el.style.setProperty('--t', el.getAttribute('data-t')); });
    $$('[data-l]', racine).forEach(function (el) { el.style.setProperty('--l', el.getAttribute('data-l')); });
  }
  function delai(jours) {
    if (jours < 0) return '<span class="echeance-delai est-depassee">' + ico('alerte') + 'Dépassée de ' + Math.abs(jours) + ' j</span>';
    if (jours === 0) return '<span class="echeance-delai est-proche">' + ico('horloge') + 'Aujourd’hui</span>';
    if (jours <= 7) return '<span class="echeance-delai est-proche">' + ico('horloge') + 'Dans ' + jours + ' j</span>';
    return '<span class="echeance-delai">' + ico('calendrier') + 'Dans ' + jours + ' j</span>';
  }

  /* ------------------------------------------------------------------ Infobulle unique */
  var infobulle = $('#infobulle');
  function montrerInfobulle(html, x, y) {
    infobulle.innerHTML = html;
    infobulle.style.setProperty('--tx', x + 'px');
    infobulle.style.setProperty('--ty', y + 'px');
    infobulle.classList.add('visible');
    infobulle.setAttribute('aria-hidden', 'false');
  }
  function cacherInfobulle() {
    infobulle.classList.remove('visible');
    infobulle.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('mousemove', function (e) {
    var cible = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (cible) montrerInfobulle(cible.getAttribute('data-tip'), e.clientX, e.clientY);
    else if (infobulle.classList.contains('visible') && !infobulle.hasAttribute('data-focus')) cacherInfobulle();
  });
  document.addEventListener('focusin', function (e) {
    var cible = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (cible) {
      var r = cible.getBoundingClientRect();
      infobulle.setAttribute('data-focus', '1');
      montrerInfobulle(cible.getAttribute('data-tip'), r.left + r.width / 2, r.top);
    }
  });
  document.addEventListener('focusout', function (e) {
    if (e.target.closest && e.target.closest('[data-tip]')) { infobulle.removeAttribute('data-focus'); cacherInfobulle(); }
  });

  /* ------------------------------------------------------------------ Toasts */
  var TOAST_ICONES = { succes: 'check-cercle', alerte: 'alerte', erreur: 'alerte-cercle', info: 'info' };
  function toast(genre, titre, textePlus) {
    var conteneur = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast toast-' + genre;
    el.setAttribute('role', genre === 'erreur' ? 'alert' : 'status');
    el.innerHTML = '<span class="toast-icone" aria-hidden="true">' + ico(TOAST_ICONES[genre] || 'info') + '</span>' +
      '<div><div class="toast-titre">' + esc(titre) + '</div>' + (textePlus ? '<div class="toast-texte">' + esc(textePlus) + '</div>' : '') + '</div>' +
      '<button type="button" class="btn btn-icone" aria-label="Fermer la notification">' + ico('fermer') + '</button>';
    conteneur.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('visible'); }); });
    var minuteur = setTimeout(function () { fermerToast(el); }, 6000);
    $('button', el).addEventListener('click', function () { clearTimeout(minuteur); fermerToast(el); });
    return el;
  }
  function fermerToast(el) {
    if (!el.parentNode) return;
    el.classList.add('sortie');
    el.classList.remove('visible');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduit.matches ? 20 : 240);
  }

  /* ------------------------------------------------------------------ Modale (focus piégé, Échap) */
  var voile = $('#voile');
  var modale = $('#modale');
  var ouvreurModale = null;
  $('#modale-icone').innerHTML = ico('corbeille', 'ico-lg');
  function focusables(racine) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', racine);
  }
  function ouvrirModale(ouvreur) {
    ouvreurModale = ouvreur || document.activeElement;
    voile.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { voile.classList.add('ouverte'); }); });
    var premier = $('[data-action="fermer-modale"]', modale);
    setTimeout(function () { premier.focus(); }, 30);
    document.addEventListener('keydown', toucheModale);
  }
  function fermerModale() {
    voile.classList.remove('ouverte');
    document.removeEventListener('keydown', toucheModale);
    setTimeout(function () {
      voile.hidden = true;
      if (ouvreurModale && ouvreurModale.focus) ouvreurModale.focus();
    }, reduit.matches ? 10 : 230);
  }
  function toucheModale(e) {
    if (e.key === 'Escape') { e.preventDefault(); fermerModale(); return; }
    if (e.key !== 'Tab') return;
    var liste = focusables(modale);
    if (!liste.length) return;
    var premier = liste[0], dernier = liste[liste.length - 1];
    if (e.shiftKey && (document.activeElement === premier || !modale.contains(document.activeElement))) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }
  voile.addEventListener('click', function (e) { if (e.target === voile) fermerModale(); });

  /* ------------------------------------------------------------------ Graphiques SVG */
  function graphiqueCourbe(conteneur, series, mois) {
    var W = 640, H = 250, mg = { g: 30, d: 60, h: 16, b: 30 };
    var larg = W - mg.g - mg.d, haut = H - mg.h - mg.b;
    var maxVal = 0;
    series.forEach(function (s) { s.valeurs.forEach(function (v) { if (v > maxVal) maxVal = v; }); });
    var yMax = Math.ceil(maxVal / 5) * 5 || 5;
    var n = mois.length;
    var x = function (i) { return mg.g + (i * larg) / (n - 1); };
    var y = function (v) { return mg.h + haut - (v / yMax) * haut; };
    var el = svg('svg', { class: 'graphique', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': conteneur.id + '-titre' }, conteneur);
    var titre = svg('title', { id: conteneur.id + '-titre' }, el);
    texte(titre, 'Évolution mensuelle des constats sur douze mois : ' + series.map(function (s) { return s.nom + ' (' + s.valeurs.join(', ') + ')'; }).join(' ; ') + '.');
    for (var t = 0; t <= yMax; t += 5) {
      svg('line', { class: 'grille-ligne', x1: mg.g, x2: W - mg.d, y1: y(t), y2: y(t) }, el);
      texte(svg('text', { class: 'axe-libelle', x: mg.g - 8, y: y(t) + 4, 'text-anchor': 'end' }, el), String(t));
    }
    mois.forEach(function (m, i) {
      if (i % 2 === 1) texte(svg('text', { class: 'axe-libelle', x: x(i), y: H - 8, 'text-anchor': 'middle' }, el), m);
    });
    var curseur = svg('line', { class: 'curseur', x1: x(0), x2: x(0), y1: mg.h, y2: mg.h + haut }, el);
    series.forEach(function (s, si) {
      var d = s.valeurs.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
      if (si === 0) {
        svg('path', { class: 'aire', d: d + ' L' + x(n - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z', fill: s.couleur }, el);
      }
      var trace = svg('path', { class: 'trace', d: d, stroke: s.couleur }, el);
      var L = Math.ceil(trace.getTotalLength ? trace.getTotalLength() : 1200);
      trace.setAttribute('stroke-dasharray', L);
      trace.setAttribute('stroke-dashoffset', L);
      s.valeurs.forEach(function (v, i) {
        svg('circle', { class: 'point', cx: x(i), cy: y(v), r: 4, fill: s.couleur }, el);
      });
      var fin = s.valeurs[n - 1];
      texte(svg('text', { class: 'point-etiquette', x: x(n - 1) + 10, y: y(fin) + 4 }, el), fin + ' ' + s.nom.toLowerCase());
    });
    var pas = larg / (n - 1);
    mois.forEach(function (m, i) {
      var tip = '<strong>' + esc(m) + '</strong>' + series.map(function (s) {
        return '<div class="infobulle-ligne"><span class="legende-pastille" data-c="' + s.couleur + '"></span>' + esc(s.nom) + ' : <strong>' + s.valeurs[i] + '</strong></div>';
      }).join('');
      var zone = svg('rect', { class: 'zone-survol', x: x(i) - pas / 2, y: mg.h, width: pas, height: haut, 'data-tip': tip }, el);
      zone.addEventListener('mouseenter', function () { curseur.setAttribute('x1', x(i)); curseur.setAttribute('x2', x(i)); curseur.classList.add('visible'); });
      zone.addEventListener('mouseleave', function () { curseur.classList.remove('visible'); });
    });
  }

  function graphiqueBarres(conteneur, lignes, couleur) {
    var W = 360, hLigne = 34, W0 = 118, maxLarg = W - W0 - 44;
    var max = Math.max.apply(null, lignes.map(function (l) { return l.valeur; })) || 1;
    var el = svg('svg', { class: 'graphique', viewBox: '0 0 ' + W + ' ' + lignes.length * hLigne, role: 'list', 'aria-label': 'Audits par statut' }, conteneur);
    lignes.forEach(function (l, i) {
      var yC = i * hLigne + hLigne / 2;
      var g = svg('g', { role: 'listitem', tabindex: '0', 'aria-label': l.libelle + ' : ' + l.valeur + ' audit' + (l.valeur > 1 ? 's' : ''), 'data-tip': '<strong>' + esc(l.libelle) + '</strong><div>' + l.valeur + ' audit' + (l.valeur > 1 ? 's' : '') + ' · ' + pct(l.valeur, l.total) + ' %</div>' }, el);
      texte(svg('text', { class: 'barre-libelle', x: 0, y: yC + 4 }, g), l.libelle);
      svg('rect', { class: 'barre-piste', x: W0, y: yC - 7, width: maxLarg, height: 14, rx: 4 }, g);
      var w = Math.max(4, (l.valeur / max) * maxLarg);
      var barre = svg('path', { class: 'barre', d: 'M' + W0 + ' ' + (yC - 7) + ' h' + (w - 4) + ' a4 4 0 0 1 4 4 v6 a4 4 0 0 1 -4 4 h-' + (w - 4) + ' z', fill: couleur }, g);
      barre.style.setProperty('--delai', (i * 60) + 'ms');
      texte(svg('text', { class: 'barre-valeur', x: W0 + w + 8, y: yC + 4 }, g), String(l.valeur));
    });
  }

  function graphiqueDonut(conteneur, parts, total, libelleCentre) {
    var S = 150, c = S / 2, r = 56, ep = 16, C = 2 * Math.PI * r, ecart = 3;
    var el = svg('svg', { class: 'graphique', viewBox: '0 0 ' + S + ' ' + S, role: 'list', 'aria-label': libelleCentre + ' par criticité' }, conteneur);
    svg('circle', { class: 'anneau-piste', cx: c, cy: c, r: r, 'stroke-width': ep }, el);
    var cumul = 0;
    parts.forEach(function (p, i) {
      var frac = total ? p.valeur / total : 0;
      var len = Math.max(0, C * frac - ecart);
      var angle = -90 + 360 * cumul + (ecart / 2 / C) * 360;
      var seg = svg('circle', {
        class: 'anneau', cx: c, cy: c, r: r, 'stroke-width': ep, stroke: p.couleur, 'stroke-dasharray': len.toFixed(2) + ' ' + C.toFixed(2),
        'stroke-dashoffset': len.toFixed(2), transform: 'rotate(' + angle.toFixed(2) + ' ' + c + ' ' + c + ')', role: 'listitem', tabindex: '0',
        'aria-label': p.libelle + ' : ' + p.valeur + ' (' + pct(p.valeur, total) + ' %)',
        'data-tip': '<strong>' + esc(p.libelle) + '</strong><div>' + p.valeur + ' · ' + pct(p.valeur, total) + ' %</div>',
      }, el);
      seg.style.setProperty('--delai', (i * 120) + 'ms');
      cumul += frac;
    });
    texte(svg('text', { class: 'centre-valeur', x: c, y: c + 4, 'text-anchor': 'middle' }, el), String(total));
    texte(svg('text', { class: 'centre-libelle', x: c, y: c + 22, 'text-anchor': 'middle' }, el), libelleCentre);
  }

  function graphiqueJauge(conteneur, valeur, cible, unite) {
    var W = 220, H = 125, cx = W / 2, cy = 110, r = 86, ep = 14;
    var d = 'M' + (cx - r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy;
    var el = svg('svg', { class: 'graphique', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Jauge : ' + valeur + ' ' + unite + ' pour une cible de ' + cible + ' ' + unite }, conteneur);
    svg('path', { class: 'jauge-piste', d: d, 'stroke-width': ep }, el);
    var arc = svg('path', { class: 'jauge-arc', d: d, 'stroke-width': ep, 'data-tip': '<strong>' + valeur + ' ' + unite + '</strong><div>Cible ' + cible + ' ' + unite + '</div>' }, el);
    var L = Math.PI * r;
    var part = Math.min(1, valeur / 100) * L;
    arc.setAttribute('stroke-dasharray', part.toFixed(2) + ' ' + (L + 10).toFixed(2));
    arc.setAttribute('stroke-dashoffset', part.toFixed(2));
    var a = Math.PI * (1 - cible / 100);
    var x1 = cx + Math.cos(a) * (r - ep / 2 - 4), y1 = cy - Math.sin(a) * (r - ep / 2 - 4);
    var x2 = cx + Math.cos(a) * (r + ep / 2 + 4), y2 = cy - Math.sin(a) * (r + ep / 2 + 4);
    svg('line', { class: 'jauge-cible', x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) }, el);
    texte(svg('text', { class: 'centre-valeur', x: cx, y: cy - 6, 'text-anchor': 'middle' }, el), valeur + ' ' + unite);
    texte(svg('text', { class: 'centre-libelle', x: cx, y: cy + 12, 'text-anchor': 'middle' }, el), 'cible ' + cible + ' ' + unite);
  }

  function graphiqueSegments(conteneur, parts, total) {
    var W = 600, H = 22, ecart = 2, idClip = 'clip-' + conteneur.id;
    var el = svg('svg', { class: 'graphique', viewBox: '0 0 ' + W + ' ' + H, role: 'list', 'aria-label': 'Répartition des actions par statut' }, conteneur);
    var defs = svg('defs', null, el);
    var clip = svg('clipPath', { id: idClip }, defs);
    svg('rect', { x: 0, y: 0, width: W, height: H, rx: 5 }, clip);
    var g = svg('g', { 'clip-path': 'url(#' + idClip + ')' }, el);
    svg('rect', { class: 'barre-piste', x: 0, y: 0, width: W, height: H }, g);
    var x0 = 0;
    parts.forEach(function (p, i) {
      var w = total ? (p.valeur / total) * W : 0;
      var seg = svg('rect', {
        class: 'segment', x: x0 + (i ? ecart / 2 : 0), y: 0, width: Math.max(0, w - (i ? ecart / 2 : 0) - (i < parts.length - 1 ? ecart / 2 : 0)), height: H, fill: p.couleur,
        role: 'listitem', tabindex: '0', 'aria-label': p.libelle + ' : ' + p.valeur + ' (' + pct(p.valeur, total) + ' %)',
        'data-tip': '<strong>' + esc(p.libelle) + '</strong><div>' + p.valeur + ' action' + (p.valeur > 1 ? 's' : '') + ' · ' + pct(p.valeur, total) + ' %</div>',
      }, g);
      seg.style.setProperty('--delai', (i * 80) + 'ms');
      x0 += w;
    });
  }

  /* ------------------------------------------------------------------ Écran : tableau de bord */
  function kpi(valeur, unite, libelle, note, ton, icone) {
    return '<div class="kpi"><div class="kpi-valeur chiffres">' + valeur + (unite ? '<small>' + unite + '</small>' : '') + '</div>' +
      '<div class="kpi-libelle">' + libelle + '</div>' +
      (note ? '<div class="kpi-note' + (ton ? ' est-' + ton : '') + '">' + (icone ? ico(icone) : '') + note + '</div>' : '') + '</div>';
  }
  function echeanceHTML(e) {
    return '<li class="echeance"><span class="echeance-date">' + F.fr(e.echeance) + '</span>' +
      '<span class="echeance-corps"><span class="echeance-titre" title="' + esc(e.titre) + '">' + esc(e.titre) + '</span><span class="echeance-meta">' + esc(e.genre) + ' ' + esc(e.id) + ' · ' + esc(nomUtilisateur(e.responsable)) + '</span></span>' +
      delai(e.jours) + '</li>';
  }
  function rendreDashboard() {
    var k = F.kpi;
    var actionsOuvertes = k.actions - k.actionsTerminees;
    var conf = F.indicateurs[0];
    var tendance = conf.historique[11] - conf.historique[10];
    var html = '<div class="page-entete"><div><div class="surtitre">' + esc(F.organisation.sigle) + ' · ' + esc(F.frLong(F.aujourdhui)) + '</div><h1 id="titre-page" tabindex="-1">Pilotage du SMSI</h1>' +
      '<p class="page-sous">Vue d’ensemble des audits, des non-conformités et des plans d’actions du cycle en cours.</p></div>' +
      '<div class="page-actions"><a class="btn" href="#/audits">' + ico('liste') + 'Tous les audits</a><a class="btn btn-primaire" href="#/formulaire">' + ico('plus') + 'Nouvel audit</a></div></div>';

    html += '<div class="kpis">' +
      kpi(k.auditsEnCours, '', 'Audits en cours', k.auditsAVenir + ' à venir', '', 'calendrier') +
      kpi(k.ncOuvertes, '', 'Non-conformités ouvertes', (k.parCriticiteNC.Critique || 0) + ' critiques', 'erreur', 'alerte') +
      kpi(k.actionsEnRetard, '', 'Actions en retard', 'sur ' + actionsOuvertes + ' actions ouvertes', 'alerte', 'horloge') +
      kpi(k.conformite, '%', 'Taux de conformité ISO 27001', (tendance >= 0 ? '+' : '') + tendance + ' pt ce mois · cible ' + conf.cible + ' %', tendance > 0 ? 'succes' : '', tendance > 0 ? 'fleche-haut' : tendance < 0 ? 'fleche-bas' : 'fleche-stable') +
      kpi(k.constatsOuverts, '', 'Constats ouverts', k.echeancesDepassees.length + ' échéances dépassées', 'erreur', 'alerte') +
      kpi(k.risquesEleves, '', 'Risques élevés', 'sur ' + F.risques.length + ' risques suivis', '', 'cible') +
      '</div>';

    html += '<div class="pile">' +
      '<div class="grille grille-2">' +
        '<section class="section" aria-labelledby="t-evolution"><div class="section-entete"><h2 id="t-evolution">Évolution des constats</h2><span class="section-note">Douze derniers mois</span></div>' +
          '<div class="legende" aria-hidden="true"><span class="legende-item"><span class="legende-pastille ligne" data-c="' + jeton('--donnee-1') + '"></span>Ouverts</span><span class="legende-item"><span class="legende-pastille ligne" data-c="' + jeton('--donnee-2') + '"></span>Clos</span></div>' +
          '<div id="g-evolution"></div></section>' +
        '<section class="section" aria-labelledby="t-conformite"><div class="section-entete"><h2 id="t-conformite">Conformité ISO 27001</h2><span class="section-note">Indicateur I1</span></div>' +
          '<div class="jauge-bloc"><div id="g-jauge"></div><div class="jauge-legende"><span>Il y a 12 mois <strong>' + conf.historique[0] + ' %</strong></span><span>Tendance <strong>' + (conf.tendance === 'hausse' ? 'en hausse' : conf.tendance === 'baisse' ? 'en baisse' : 'stable') + '</strong></span></div>' +
          '<p class="section-note">' + esc(F.indicateurs[1].libelle) + ' : <strong class="chiffres">' + F.indicateurs[1].valeur + ' ' + F.indicateurs[1].unite + '</strong> · ' + esc(F.indicateurs[2].libelle) + ' : <strong class="chiffres">' + F.indicateurs[2].valeur + ' ' + F.indicateurs[2].unite + '</strong></p></div></section>' +
      '</div>' +
      '<div class="grille grille-3">' +
        '<section class="section" aria-labelledby="t-statuts"><div class="section-entete"><h2 id="t-statuts">Audits par statut</h2><span class="section-note">' + k.audits + ' audits</span></div><div id="g-statuts"></div></section>' +
        '<section class="section" aria-labelledby="t-nc"><div class="section-entete"><h2 id="t-nc">NC ouvertes par criticité</h2><span class="section-note">' + k.ncOuvertes + ' ouvertes</span></div>' +
          '<div class="donut-bloc"><div id="g-donut"></div><ul class="legende-liste" id="l-donut"></ul></div></section>' +
        '<section class="section" aria-labelledby="t-actions"><div class="section-entete"><h2 id="t-actions">Avancement des actions</h2><span class="section-note">' + k.actions + ' actions</span></div>' +
          '<div class="segments-resume"><span><strong class="chiffres">' + pct(k.actionsTerminees, k.actions) + ' %</strong> terminées</span><span class="section-note">' + k.actionsTerminees + ' / ' + k.actions + '</span></div>' +
          '<div id="g-segments"></div><ul class="legende-liste" id="l-segments"></ul></section>' +
      '</div>' +
      '<div class="grille grille-egale">' +
        '<section class="section section-blanche" aria-labelledby="t-echeances"><div class="section-entete"><h2 id="t-echeances">Prochaines échéances</h2><span class="section-note">Constats et actions ouverts</span></div><ul class="echeances">' +
          k.prochainesEcheances.map(echeanceHTML).join('') + '</ul></section>' +
        '<section class="section section-blanche" aria-labelledby="t-depassees"><div class="section-entete"><h2 id="t-depassees">Échéances dépassées</h2><span class="section-note">' + k.echeancesDepassees.length + ' au total</span></div><ul class="echeances">' +
          k.echeancesDepassees.slice(-6).reverse().map(echeanceHTML).join('') + '</ul>' +
          '<p class="section-note" data-marge>Les ' + (k.echeancesDepassees.length - 6) + ' autres échéances dépassées sont visibles depuis la liste des audits.</p></section>' +
      '</div>' +
    '</div>';
    return { html: html, apres: apresDashboard, titre: 'Pilotage du SMSI' };
  }
  function apresDashboard(racine) {
    graphiqueCourbe($('#g-evolution', racine), [
      { nom: 'Ouverts', couleur: jeton('--donnee-1'), valeurs: F.evolution.map(function (m) { return m.ouverts; }) },
      { nom: 'Clos', couleur: jeton('--donnee-2'), valeurs: F.evolution.map(function (m) { return m.clos; }) },
    ], F.vocabulaire.mois);
    graphiqueJauge($('#g-jauge', racine), F.indicateurs[0].valeur, F.indicateurs[0].cible, '%');
    graphiqueBarres($('#g-statuts', racine), F.vocabulaire.statutsAudit.map(function (s) { return { libelle: s, valeur: F.kpi.parStatutAudit[s] || 0, total: F.kpi.audits }; }), jeton('--donnee-1'));
    var crit = [['Critique', jeton('--donnee-6')], ['Majeure', jeton('--donnee-4')], ['Mineure', jeton('--donnee-5')]].map(function (c) { return { libelle: c[0], couleur: c[1], valeur: F.kpi.parCriticiteNC[c[0]] || 0 }; });
    graphiqueDonut($('#g-donut', racine), crit, F.kpi.ncOuvertes, 'NC ouvertes');
    $('#l-donut', racine).innerHTML = crit.map(function (c) {
      return '<li class="legende-item"><span><span class="legende-pastille" data-c="' + c.couleur + '"></span>' + badge(c.libelle, CRITICITE) + '</span><span class="legende-valeur">' + c.valeur + '<span class="legende-pct">' + pct(c.valeur, F.kpi.ncOuvertes) + ' %</span></span></li>';
    }).join('');
    var segs = [['Terminée', jeton('--donnee-1')], ['En cours', jeton('--donnee-3')], ['À faire', jeton('--donnee-5')], ['Bloquée', jeton('--donnee-4')]].map(function (c) { return { libelle: c[0], couleur: c[1], valeur: F.kpi.parStatutAction[c[0]] || 0 }; });
    graphiqueSegments($('#g-segments', racine), segs, F.kpi.actions);
    $('#l-segments', racine).innerHTML = segs.map(function (c) {
      return '<li class="legende-item"><span><span class="legende-pastille" data-c="' + c.couleur + '"></span>' + badge(c.libelle, STATUT_ACTION) + '</span><span class="legende-valeur">' + c.valeur + '<span class="legende-pct">' + pct(c.valeur, F.kpi.actions) + ' %</span></span></li>';
    }).join('');
    poserVariables(racine);
  }

  /* ------------------------------------------------------------------ Écran : liste des audits */
  var etatListe = { q: '', statut: '', type: '', ref: '', tri: 'debut', sens: 'desc', page: 1 };
  var COLONNES = [
    { cle: 'id', libelle: 'Réf.' }, { cle: 'nom', libelle: 'Audit' }, { cle: 'type', libelle: 'Type' }, { cle: 'referentiel', libelle: 'Référentiel' },
    { cle: 'site', libelle: 'Site' }, { cle: 'responsable', libelle: 'Responsable' }, { cle: 'debut', libelle: 'Début' }, { cle: 'statut', libelle: 'Statut' }, { cle: 'progression', libelle: 'Progression', num: true },
  ];
  function valeurTri(a, cle) {
    if (cle === 'referentiel') return F.referentiel(a.referentiel).court;
    if (cle === 'responsable') return nomUtilisateur(a.responsable);
    if (cle === 'statut') return F.vocabulaire.statutsAudit.indexOf(a.statut);
    return a[cle];
  }
  function auditsFiltres() {
    var q = etatListe.q.trim().toLowerCase();
    var liste = F.audits.filter(function (a) {
      if (etatListe.statut && a.statut !== etatListe.statut) return false;
      if (etatListe.type && a.type !== etatListe.type) return false;
      if (etatListe.ref && a.referentiel !== etatListe.ref) return false;
      if (!q) return true;
      var texteA = [a.id, a.nom, a.site, a.type, a.statut, nomUtilisateur(a.responsable), F.referentiel(a.referentiel).libelle, a.perimetre].join(' ').toLowerCase();
      return texteA.indexOf(q) !== -1;
    });
    liste.sort(function (a, b) {
      var va = valeurTri(a, etatListe.tri), vb = valeurTri(b, etatListe.tri);
      var r = va < vb ? -1 : va > vb ? 1 : a.id < b.id ? -1 : 1;
      return etatListe.sens === 'asc' ? r : -r;
    });
    return liste;
  }
  function option(v, libelle, courant) { return '<option value="' + esc(v) + '"' + (v === courant ? ' selected' : '') + '>' + esc(libelle) + '</option>'; }
  function rendreListe() {
    var html = '<div class="page-entete"><div><div class="surtitre">Audits · ' + esc(F.organisation.periode) + '</div><h1 id="titre-page" tabindex="-1">Audits</h1>' +
      '<p class="page-sous">' + F.audits.length + ' audits planifiés, en cours ou clos. Cliquer sur une ligne ouvre la fiche.</p></div>' +
      '<div class="page-actions"><a class="btn btn-primaire" href="#/formulaire">' + ico('plus') + 'Nouvel audit</a></div></div>';
    html += '<form class="outils" id="outils-liste" role="search" aria-label="Rechercher et filtrer les audits">' +
      '<div class="champ-recherche">' + ico('recherche') + '<label class="visuellement-cache" for="recherche">Rechercher un audit</label><input class="saisie" type="search" id="recherche" name="q" placeholder="Rechercher un audit, un site, une personne…" value="' + esc(etatListe.q) + '" autocomplete="off"></div>' +
      '<label class="visuellement-cache" for="f-statut">Statut</label><select class="selection" id="f-statut" name="statut">' + option('', 'Tous les statuts', etatListe.statut) + F.vocabulaire.statutsAudit.map(function (s) { return option(s, s, etatListe.statut); }).join('') + '</select>' +
      '<label class="visuellement-cache" for="f-type">Type</label><select class="selection" id="f-type" name="type">' + option('', 'Tous les types', etatListe.type) + F.vocabulaire.typesAudit.map(function (s) { return option(s, s, etatListe.type); }).join('') + '</select>' +
      '<label class="visuellement-cache" for="f-ref">Référentiel</label><select class="selection" id="f-ref" name="ref">' + option('', 'Tous les référentiels', etatListe.ref) + F.referentiels.map(function (r) { return option(r.id, r.libelle, etatListe.ref); }).join('') + '</select>' +
      '<button type="button" class="btn btn-discret btn-sm" data-action="reinitialiser-filtres" id="btn-reinit"' + (etatListe.q || etatListe.statut || etatListe.type || etatListe.ref ? '' : ' hidden') + '>' + ico('fermer') + 'Réinitialiser</button>' +
      '<span class="outils-compte" id="compte-liste" aria-live="polite"></span></form>';
    html += '<div class="tableau-enveloppe"><table class="tableau" id="tableau-audits"><thead><tr>' + COLONNES.map(function (c) {
      return '<th scope="col"' + (c.num ? ' class="num"' : '') + ' data-cle="' + c.cle + '"><button type="button" class="tri" data-action="trier" data-cle="' + c.cle + '">' + esc(c.libelle) + ico('tri-neutre') + '</button></th>';
    }).join('') + '</tr></thead><tbody id="corps-audits"></tbody></table></div>' +
      '<nav class="pagination" id="pagination" aria-label="Pagination des audits"></nav>';
    return { html: html, apres: apresListe, titre: 'Audits' };
  }
  function apresListe(racine) {
    var form = $('#outils-liste', racine);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $('#recherche', racine).addEventListener('input', function (e) { etatListe.q = e.target.value; etatListe.page = 1; rendreTableau(); });
    $('#f-statut', racine).addEventListener('change', function (e) { etatListe.statut = e.target.value; etatListe.page = 1; rendreTableau(); });
    $('#f-type', racine).addEventListener('change', function (e) { etatListe.type = e.target.value; etatListe.page = 1; rendreTableau(); });
    $('#f-ref', racine).addEventListener('change', function (e) { etatListe.ref = e.target.value; etatListe.page = 1; rendreTableau(); });
    rendreTableau();
  }
  function rendreTableau() {
    var corps = $('#corps-audits');
    if (!corps) return;
    var liste = auditsFiltres();
    var parPage = 10, pages = Math.max(1, Math.ceil(liste.length / parPage));
    if (etatListe.page > pages) etatListe.page = pages;
    var debut = (etatListe.page - 1) * parPage;
    var tranche = liste.slice(debut, debut + parPage);
    $$('#tableau-audits th').forEach(function (th) {
      var cle = th.getAttribute('data-cle');
      var actif = cle === etatListe.tri;
      th.setAttribute('aria-sort', actif ? (etatListe.sens === 'asc' ? 'ascending' : 'descending') : 'none');
      var btn = $('.tri', th);
      $('svg', btn).outerHTML = ico(actif ? (etatListe.sens === 'asc' ? 'tri-haut' : 'tri-bas') : 'tri-neutre');
    });
    if (!tranche.length) {
      corps.innerHTML = '<tr><td colspan="' + COLONNES.length + '"><div class="tableau-vide">' + illustrationVide() + '<h3>Aucun audit ne correspond</h3><p>Modifiez la recherche ou les filtres pour élargir la sélection.</p></div></td></tr>';
    } else {
      corps.innerHTML = tranche.map(function (a) {
        return '<tr class="ligne" tabindex="0" data-id="' + a.id + '" aria-label="Ouvrir la fiche ' + esc(a.nom) + '">' +
          '<td class="id" data-col="id">' + a.id + '</td>' +
          '<td data-col="nom"><a class="cellule-nom" href="#/audit/' + a.id + '" tabindex="-1">' + esc(a.nom) + '</a><span class="cellule-sous">' + esc(a.perimetre) + '</span></td>' +
          '<td data-col="type">' + esc(a.type) + '</td><td data-col="referentiel">' + badgeRef(a.referentiel) + '</td><td data-col="site">' + esc(a.site) + '</td><td data-col="responsable">' + personne(a.responsable) + '</td>' +
          '<td class="chiffres">' + F.fr(a.debut) + '</td><td>' + badge(a.statut, STATUT_AUDIT) + '</td>' +
          '<td class="num">' + progression(a.progression, a.statut === 'Clos' ? 'est-terminee' : a.statut === 'Reporté' ? 'est-bloquee' : '') + '</td></tr>';
      }).join('');
    }
    poserVariables(corps);
    $('#compte-liste').textContent = liste.length + ' audit' + (liste.length > 1 ? 's' : '') + (liste.length !== F.audits.length ? ' sur ' + F.audits.length : '') + ' · page ' + etatListe.page + ' / ' + pages;
    var reinit = $('#btn-reinit');
    if (reinit) reinit.hidden = !(etatListe.q || etatListe.statut || etatListe.type || etatListe.ref);
    var pag = $('#pagination');
    var boutons = '';
    for (var p = 1; p <= pages; p++) boutons += '<button type="button" class="page-btn" data-action="page" data-page="' + p + '"' + (p === etatListe.page ? ' aria-current="page"' : '') + ' aria-label="Page ' + p + '">' + p + '</button>';
    pag.innerHTML = '<span>' + (liste.length ? 'Lignes ' + (debut + 1) + ' à ' + Math.min(debut + parPage, liste.length) + ' sur ' + liste.length : 'Aucune ligne') + '</span>' +
      '<div class="pagination-pages"><button type="button" class="page-btn" data-action="page" data-page="' + (etatListe.page - 1) + '" aria-label="Page précédente"' + (etatListe.page === 1 ? ' disabled' : '') + '>' + ico('chevron-gauche') + '</button>' + boutons +
      '<button type="button" class="page-btn" data-action="page" data-page="' + (etatListe.page + 1) + '" aria-label="Page suivante"' + (etatListe.page === pages ? ' disabled' : '') + '>' + ico('chevron-droite') + '</button></div>';
  }

  /* ------------------------------------------------------------------ Écran : fiche d'un audit */
  var ONGLETS = [['synthese', 'Synthèse'], ['constats', 'Constats'], ['actions', 'Plan d’actions'], ['historique', 'Historique']];
  function rendreFiche(id) {
    var a = F.audit(id);
    if (!a) {
      return { html: '<div class="fil"><a href="#/audits">' + ico('fleche-gauche') + 'Retour aux audits</a></div><h1 id="titre-page" tabindex="-1">Audit introuvable</h1><div class="section vide">' + illustrationVide() + '<h3>Aucun audit « ' + esc(id) + ' »</h3><p>L’identifiant demandé n’existe pas dans les données de la maquette.</p><a class="btn" href="#/audits">Voir la liste</a></div>', apres: function () {}, titre: 'Audit introuvable' };
    }
    var constats = F.constatsDe(a.id), actions = F.actionsDe(a.id), histo = F.historiqueAudit(a);
    var ouverts = constats.filter(function (c) { return c.statut !== 'Clos'; }).length;
    var retard = actions.filter(function (x) { return x.statut !== 'Terminée' && F.daysUntil(x.echeance) < 0; }).length;
    var html = '<div class="fil"><a href="#/audits">' + ico('fleche-gauche') + 'Audits</a><span aria-hidden="true">/</span><span>' + a.id + '</span></div>' +
      '<div class="fiche-entete"><div><div class="surtitre">' + esc(a.type) + ' · ' + esc(F.referentiel(a.referentiel).libelle) + '</div><h1 id="titre-page" tabindex="-1">' + esc(a.nom) + '</h1>' +
      '<div class="fiche-badges">' + badge(a.statut, STATUT_AUDIT) + badgeRef(a.referentiel) + badge(a.criticite, CRITICITE) + (retard ? '<span class="badge badge-erreur">' + ico('horloge') + retard + ' action' + (retard > 1 ? 's' : '') + ' en retard</span>' : '') + '</div>' +
      '<dl class="fiche-meta">' +
        '<div class="meta-item"><dt>Dates</dt><dd class="chiffres">' + F.fr(a.debut) + ' → ' + F.fr(a.fin) + '</dd></div>' +
        '<div class="meta-item"><dt>Site</dt><dd>' + esc(a.site) + '</dd></div>' +
        '<div class="meta-item"><dt>Responsable</dt><dd>' + personne(a.responsable) + '</dd></div>' +
        '<div class="meta-item"><dt>Auditeur</dt><dd>' + esc(a.auditeur) + '</dd></div>' +
        '<div class="meta-item"><dt>Périmètre</dt><dd>' + esc(a.perimetre) + '</dd></div>' +
      '</dl></div>' +
      '<div class="fiche-progression"><div class="surtitre">Avancement</div><div class="kpi-valeur chiffres">' + a.progression + '<small>%</small></div>' + progression(a.progression, a.statut === 'Clos' ? 'est-terminee' : '', true) +
      '<p class="section-note" data-marge>' + constats.length + ' constat' + (constats.length > 1 ? 's' : '') + ' · ' + ouverts + ' ouvert' + (ouverts > 1 ? 's' : '') + ' · ' + actions.length + ' action' + (actions.length > 1 ? 's' : '') + '</p>' +
      '<div class="page-actions" data-marge><a class="btn btn-sm" href="#/formulaire">' + ico('formulaire') + 'Modifier</a><button type="button" class="btn btn-sm btn-discret" data-action="ouvrir-modale">' + ico('corbeille') + 'Supprimer</button></div></div></div>';

    html += '<div class="onglets" role="tablist" aria-label="Sections de la fiche">' + ONGLETS.map(function (o, i) {
      var compte = o[0] === 'constats' ? constats.length : o[0] === 'actions' ? actions.length : o[0] === 'historique' ? histo.length : null;
      return '<button type="button" role="tab" class="onglet" id="onglet-' + o[0] + '" aria-controls="panneau-' + o[0] + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '">' + esc(o[1]) + (compte !== null ? '<span class="onglet-compte">' + compte + '</span>' : '') + '</button>';
    }).join('') + '<span class="onglets-indicateur" aria-hidden="true"></span></div>';

    html += '<div role="tabpanel" id="panneau-synthese" aria-labelledby="onglet-synthese" tabindex="0"><div class="synthese"><div class="section section-blanche"><h2 data-marge>Objet de l’audit</h2><p class="texte-long">' + esc(a.description) + '</p>' +
      '<p class="texte-long">Périmètre : ' + esc(a.perimetre.toLowerCase()) + '. Référentiel ' + esc(F.referentiel(a.referentiel).libelle) + ', audit ' + esc(a.type.toLowerCase()) + ' conduit par ' + esc(a.auditeur) + ' sur le site ' + esc(a.site) + '.</p></div>' +
      '<div class="section"><h2 data-marge>Repères</h2><div class="mini-stats">' +
        '<div class="mini-stat"><div class="kpi-valeur chiffres">' + constats.length + '</div><div class="kpi-libelle">Constats</div><div class="kpi-note">' + constats.filter(function (c) { return c.type.indexOf('NC') === 0; }).length + ' non-conformités</div></div>' +
        '<div class="mini-stat"><div class="kpi-valeur chiffres">' + ouverts + '</div><div class="kpi-libelle">Constats ouverts</div><div class="kpi-note' + (ouverts ? ' est-alerte' : '') + '">' + (ouverts ? ico('alerte-cercle') + 'à traiter' : ico('check') + 'tout est clos') + '</div></div>' +
        '<div class="mini-stat"><div class="kpi-valeur chiffres">' + actions.length + '</div><div class="kpi-libelle">Actions</div><div class="kpi-note">' + actions.filter(function (x) { return x.statut === 'Terminée'; }).length + ' terminées</div></div>' +
        '<div class="mini-stat"><div class="kpi-valeur chiffres">' + retard + '</div><div class="kpi-libelle">En retard</div><div class="kpi-note' + (retard ? ' est-erreur' : '') + '">' + (retard ? ico('horloge') + 'échéance dépassée' : ico('check') + 'aucun retard') + '</div></div>' +
      '</div></div></div></div>';

    html += '<div role="tabpanel" id="panneau-constats" aria-labelledby="onglet-constats" tabindex="0" hidden>' +
      (constats.length ? '<div class="constats">' + constats.map(function (c) {
        return '<article class="constat"><span class="constat-ref">' + esc(c.ref) + '</span><div><div class="constat-titre">' + esc(c.titre) + '</div><p class="constat-desc">' + esc(c.description) + '</p>' +
          '<div class="constat-meta"><span>' + esc(c.id) + ' · ' + esc(c.type) + '</span><span>' + personne(c.responsable) + '</span><span class="chiffres">Échéance ' + F.fr(c.echeance) + '</span>' + delai(F.daysUntil(c.echeance)) + '</div></div>' +
          '<div class="constat-badges">' + badge(c.criticite, CRITICITE) + badge(c.statut, STATUT_CONSTAT) + '</div></article>';
      }).join('') + '</div>' : '<div class="section vide">' + illustrationVide() + '<h3>Aucun constat</h3><p>Les constats apparaîtront après la réunion de clôture.</p></div>') + '</div>';

    html += '<div role="tabpanel" id="panneau-actions" aria-labelledby="onglet-actions" tabindex="0" hidden>' +
      (actions.length ? '<div class="tableau-enveloppe"><table class="tableau"><thead><tr><th scope="col">Réf.</th><th scope="col">Action</th><th scope="col">Priorité</th><th scope="col">Responsable</th><th scope="col">Échéance</th><th scope="col">Statut</th><th scope="col" class="num">Avancement</th></tr></thead><tbody>' +
        actions.map(function (x) {
          return '<tr><td class="id">' + x.id + '</td><td><span class="cellule-nom">' + esc(x.titre) + '</span><span class="cellule-sous">Constat ' + esc(x.constatId) + ' · charge ' + esc(x.charge) + '</span></td>' +
            '<td><span class="badge badge-' + PRIORITE[x.priorite] + '">' + ico('eclair') + x.priorite + '</span></td><td>' + personne(x.responsable) + '</td><td class="chiffres">' + F.fr(x.echeance) + '</td><td>' + badge(x.statut, STATUT_ACTION) + '</td>' +
            '<td class="num">' + progression(x.avancement, x.statut === 'Terminée' ? 'est-terminee' : x.statut === 'Bloquée' ? 'est-bloquee' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="section vide">' + illustrationVide() + '<h3>Aucune action</h3><p>Le plan d’actions sera arbitré après diffusion du rapport.</p></div>') + '</div>';

    html += '<div role="tabpanel" id="panneau-historique" aria-labelledby="onglet-historique" tabindex="0" hidden><div class="section"><ol class="chrono">' + histo.map(function (h) {
      return '<li class="chrono-item' + (F.daysUntil(h.quand) > 0 ? ' est-futur' : '') + '"><span class="chrono-date">' + F.frLong(h.quand) + '</span><span class="chrono-quoi">' + esc(h.quoi) + '<span class="chrono-qui">' + esc(nomUtilisateur(h.qui)) + ' · ' + esc(F.utilisateur(h.qui).role) + '</span></span></li>';
    }).join('') + '</ol></div></div>';
    return { html: html, apres: apresFiche, titre: a.nom };
  }
  function apresFiche(racine) {
    poserVariables(racine);
    var liste = $('[role="tablist"]', racine);
    if (!liste) return;
    var onglets = $$('[role="tab"]', liste);
    function activer(onglet, focus) {
      onglets.forEach(function (o) {
        var actif = o === onglet;
        o.setAttribute('aria-selected', actif);
        o.setAttribute('tabindex', actif ? '0' : '-1');
        var panneau = $('#' + o.getAttribute('aria-controls'), racine);
        if (panneau) panneau.hidden = !actif;
      });
      placerIndicateur(liste);
      if (focus) onglet.focus();
    }
    onglets.forEach(function (o, i) {
      o.addEventListener('click', function () { activer(o, false); });
      o.addEventListener('keydown', function (e) {
        var j = i;
        if (e.key === 'ArrowRight') j = (i + 1) % onglets.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + onglets.length) % onglets.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = onglets.length - 1;
        else return;
        e.preventDefault();
        activer(onglets[j], true);
      });
    });
    placerIndicateur(liste);
  }
  function placerIndicateur(liste) {
    var actif = $('[role="tab"][aria-selected="true"]', liste);
    var ind = $('.onglets-indicateur', liste);
    if (!actif || !ind) return;
    ind.style.setProperty('--x', actif.offsetLeft + 'px');
    ind.style.setProperty('--w', String(actif.offsetWidth / 100));
  }

  /* ------------------------------------------------------------------ Écran : formulaire */
  function rendreFormulaire() {
    var champ = function (id, libelle, controle, aide, pleine) {
      return '<div class="champ' + (pleine ? ' pleine' : '') + '"><label for="' + id + '">' + libelle + '<span class="obligatoire" aria-hidden="true">*</span></label>' + controle +
        (aide ? '<span class="champ-aide" id="' + id + '-aide">' + aide + '</span>' : '') + '<span class="champ-erreur" id="' + id + '-erreur" hidden></span></div>';
    };
    var champFacultatif = function (id, libelle, controle, aide, pleine) {
      return '<div class="champ' + (pleine ? ' pleine' : '') + '"><label for="' + id + '">' + libelle + '</label>' + controle + (aide ? '<span class="champ-aide" id="' + id + '-aide">' + aide + '</span>' : '') + '</div>';
    };
    var sel = function (id, options, aide) {
      return '<select class="selection" id="' + id + '" name="' + id + '" required aria-describedby="' + id + '-aide ' + id + '-erreur"><option value="">Choisir…</option>' + options + '</select>';
    };
    var html = '<div class="fil"><a href="#/audits">' + ico('fleche-gauche') + 'Audits</a><span aria-hidden="true">/</span><span>Nouvel audit</span></div>' +
      '<div class="page-entete"><div><div class="surtitre">Création</div><h1 id="titre-page" tabindex="-1">Nouvel audit</h1><p class="page-sous">Les champs marqués d’un astérisque sont obligatoires. La validation a lieu à la sortie de chaque champ et à l’enregistrement.</p></div></div>' +
      '<form class="formulaire" id="form-audit" novalidate><div id="form-bandeau"></div><div class="section">' +
      '<div class="formulaire-grille">' +
        champ('f-nom', 'Intitulé de l’audit', '<input class="saisie" id="f-nom" name="nom" type="text" required minlength="5" maxlength="120" aria-describedby="f-nom-aide f-nom-erreur" placeholder="Ex. Audit interne — gestion des accès">', 'Cinq caractères au minimum ; l’intitulé apparaît dans la liste et les exports.', true) +
        champ('f-type', 'Type', sel('f-type', F.vocabulaire.typesAudit.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('')), 'Certification, surveillance, interne, fournisseur…') +
        champ('f-ref', 'Référentiel', sel('f-ref', F.referentiels.map(function (r) { return '<option value="' + r.id + '">' + esc(r.libelle) + '</option>'; }).join('')), 'Référentiel principal évalué.') +
        champ('f-site', 'Site', sel('f-site', F.sites.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('')), 'Établissement ou plateforme audité.') +
        champ('f-resp', 'Responsable', sel('f-resp', F.utilisateurs.map(function (u) { return '<option value="' + u.id + '">' + esc(u.nom) + ' — ' + esc(u.role) + '</option>'; }).join('')), 'Personne qui suit l’audit et ses constats.') +
        champ('f-debut', 'Date de début', '<input class="saisie chiffres" id="f-debut" name="debut" type="date" required aria-describedby="f-debut-aide f-debut-erreur">', 'Réunion d’ouverture.') +
        champ('f-fin', 'Date de fin', '<input class="saisie chiffres" id="f-fin" name="fin" type="date" required aria-describedby="f-fin-aide f-fin-erreur">', 'Réunion de clôture, égale ou postérieure au début.') +
        champFacultatif('f-perimetre', 'Périmètre', '<input class="saisie" id="f-perimetre" name="perimetre" type="text" maxlength="160" aria-describedby="f-perimetre-aide" placeholder="Ex. Hébergement des données de santé">', 'Facultatif.', true) +
        champFacultatif('f-desc', 'Description', '<textarea class="saisie" id="f-desc" name="description" maxlength="400" aria-describedby="f-desc-aide"></textarea>', '<span id="f-desc-compteur">0</span> / 400 caractères.', true) +
      '</div>' +
      '<div class="formulaire-pied"><span class="note">Aucune donnée n’est enregistrée : l’envoi est simulé.</span><a class="btn btn-discret" href="#/audits">Annuler</a><button type="submit" class="btn btn-primaire" id="btn-enregistrer">' + ico('check') + '<span>Enregistrer l’audit</span></button></div>' +
      '</div></form>';
    return { html: html, apres: apresFormulaire, titre: 'Nouvel audit' };
  }
  var REGLES = {
    'f-nom': function (v) { return !v.trim() ? 'Indiquez un intitulé.' : v.trim().length < 5 ? 'L’intitulé doit comporter au moins cinq caractères.' : ''; },
    'f-type': function (v) { return v ? '' : 'Choisissez un type d’audit.'; },
    'f-ref': function (v) { return v ? '' : 'Choisissez un référentiel.'; },
    'f-site': function (v) { return v ? '' : 'Choisissez un site.'; },
    'f-resp': function (v) { return v ? '' : 'Désignez un responsable.'; },
    'f-debut': function (v) { return v ? '' : 'Indiquez la date de début.'; },
    'f-fin': function (v, form) {
      if (!v) return 'Indiquez la date de fin.';
      var d = $('#f-debut', form).value;
      return d && v < d ? 'La fin ne peut pas précéder le début (' + F.fr(d) + ').' : '';
    },
  };
  var LIBELLES = { 'f-nom': 'Intitulé', 'f-type': 'Type', 'f-ref': 'Référentiel', 'f-site': 'Site', 'f-resp': 'Responsable', 'f-debut': 'Date de début', 'f-fin': 'Date de fin' };
  function validerChamp(id, form) {
    var el = $('#' + id, form), erreur = $('#' + id + '-erreur', form);
    var message = REGLES[id](el.value, form);
    el.setAttribute('aria-invalid', message ? 'true' : 'false');
    erreur.hidden = !message;
    erreur.innerHTML = message ? ico('alerte-cercle') + esc(message) : '';
    return message;
  }
  function apresFormulaire(racine) {
    var form = $('#form-audit', racine);
    var bandeau = $('#form-bandeau', racine);
    var touche = {};
    form.addEventListener('focusout', function (e) {
      var id = e.target.id;
      if (REGLES[id]) { touche[id] = true; validerChamp(id, form); if (id === 'f-debut' && touche['f-fin']) validerChamp('f-fin', form); }
    });
    form.addEventListener('input', function (e) {
      var id = e.target.id;
      if (REGLES[id] && touche[id]) validerChamp(id, form);
      if (id === 'f-desc') $('#f-desc-compteur', form).textContent = e.target.value.length;
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var erreurs = [];
      Object.keys(REGLES).forEach(function (id) {
        touche[id] = true;
        var m = validerChamp(id, form);
        if (m) erreurs.push({ id: id, message: m });
      });
      if (erreurs.length) {
        bandeau.innerHTML = '<div class="bandeau bandeau-erreur" role="alert" tabindex="-1" id="resume-erreurs">' + ico('alerte-cercle') + '<div><h2>' + erreurs.length + ' champ' + (erreurs.length > 1 ? 's' : '') + ' à corriger</h2><ul>' +
          erreurs.map(function (er) { return '<li><a href="#' + er.id + '" data-action="aller-champ" data-cible="' + er.id + '">' + esc(LIBELLES[er.id]) + '</a> : ' + esc(er.message) + '</li>'; }).join('') + '</ul></div></div>';
        $('#resume-erreurs', bandeau).focus();
        return;
      }
      var btn = $('#btn-enregistrer', form);
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      $('span', btn).textContent = 'Enregistrement…';
      bandeau.innerHTML = '';
      setTimeout(function () {
        if (!document.body.contains(btn)) return;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        $('span', btn).textContent = 'Enregistrer l’audit';
        var nom = $('#f-nom', form).value.trim();
        bandeau.innerHTML = '<div class="bandeau bandeau-succes" role="status">' + ico('check-cercle') + '<div><h2>Audit enregistré</h2>« ' + esc(nom) + ' » a été ajouté au plan d’audit (simulation : rien n’est conservé). <a href="#/audits">Voir la liste</a></div></div>';
        toast('succes', 'Audit enregistré', '« ' + nom + ' » apparaîtra dans la liste des audits.');
        form.reset();
        $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
        $$('.champ-erreur', form).forEach(function (el) { el.hidden = true; });
        $('#f-desc-compteur', form).textContent = '0';
        touche = {};
      }, 900);
    });
  }

  /* ------------------------------------------------------------------ Écran : RETEX */
  var etatRetex = { reveles: 0 };
  function rendreRetex() {
    var inc = F.incidents[0];
    var n = inc.evenements.length;
    var html = '<div class="retex-entete"><div><div class="surtitre">Retour d’expérience · ' + esc(inc.id) + '</div><h1 id="titre-page" tabindex="-1">' + esc(inc.titre) + '</h1>' +
      '<p class="page-sous chiffres">Du ' + heure(inc.debut) + ' au ' + heure(inc.fin) + ' · pilote ' + esc(nomUtilisateur(inc.pilote)) + '</p>' +
      '<div class="fiche-badges">' + badgeGravite(inc.graviteMax).replace('Gravité', 'Gravité max.') + '<span class="badge badge-neutre">' + ico('retex') + n + ' événements</span><span class="badge badge-succes">' + ico('check-cercle') + 'Incident clos</span></div></div>' +
      '<aside class="retex-impact" aria-label="Impact"><div><strong>Impact</strong>' + esc(inc.impact) + '</div><div><strong>Durée</strong><span class="chiffres">3 jours et 11 heures, dont 31 h de mode dégradé.</span></div></aside></div>';
    html += '<div class="retex-commandes"><button type="button" class="btn btn-primaire" data-action="retex-suivant" id="btn-retex-suivant">' + ico('chevron-droite') + 'Point suivant</button>' +
      '<button type="button" class="btn" data-action="retex-tout">' + ico('tout-derouler') + 'Tout dérouler</button>' +
      '<button type="button" class="btn btn-discret" data-action="retex-reinit">' + ico('rafraichir') + 'Réinitialiser</button>' +
      '<span class="retex-progres"><span id="retex-compte" aria-live="polite"></span><span class="progression" aria-hidden="true"><span class="progression-piste"><span class="progression-barre" id="retex-barre"></span></span></span></span></div>' +
      '<p class="retex-aide" id="retex-aide">Clavier : flèche droite ou Entrée pour le point suivant, Fin pour tout dérouler, Début pour recommencer.</p>';
    html += '<ol class="retex-chrono" id="retex-chrono" tabindex="0" role="group" aria-label="Chronologie de l’incident" aria-describedby="retex-aide">' + inc.evenements.map(function (ev, i) {
      return '<li class="retex-point" data-gravite="' + ev.gravite + '" data-index="' + i + '" hidden><div class="retex-point-entete"><span class="retex-heure">' + esc(F.frLong(ev.h.split('T')[0])) + ' · ' + esc(heureCourte(ev.h)) + '</span><span class="retex-type">' + esc(ev.type) + '</span>' + badgeGravite(ev.gravite) + '</div>' +
        '<h3>' + esc(ev.titre) + '</h3><p class="retex-detail">' + esc(ev.detail) + '</p><div class="retex-acteur">' + personne(ev.acteur) + '</div></li>';
    }).join('') + '<li class="retex-sentinelle" id="retex-sentinelle">' + ico('chevron-droite') + '<span id="retex-sentinelle-texte"></span></li></ol>';
    html += '<section class="retex-suite section" id="retex-suite" aria-labelledby="t-enseignements" hidden><h2 id="t-enseignements" data-marge>Enseignements</h2><ol>' + inc.enseignements.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ol></section>';
    return { html: html, apres: apresRetex, titre: 'RETEX ' + inc.id };
  }
  function apresRetex(racine) {
    etatRetex.reveles = 0;
    majRetex(racine);
    $('#retex-chrono', racine).addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retexSuivant(); }
      else if (e.key === 'End') { e.preventDefault(); retexTout(); }
      else if (e.key === 'Home') { e.preventDefault(); retexReinit(); }
    });
  }
  function majRetex() {
    var points = $$('.retex-point');
    var n = points.length;
    points.forEach(function (p, i) {
      p.hidden = i >= etatRetex.reveles;
      p.classList.toggle('est-actif', i === etatRetex.reveles - 1);
    });
    var compte = $('#retex-compte');
    if (compte) compte.textContent = etatRetex.reveles + ' / ' + n + ' points';
    var barre = $('#retex-barre');
    if (barre) barre.style.setProperty('--p', String(n ? etatRetex.reveles / n : 0));
    var btn = $('#btn-retex-suivant');
    if (btn) btn.disabled = etatRetex.reveles >= n;
    var suite = $('#retex-suite');
    if (suite) suite.hidden = etatRetex.reveles < n;
    var sentinelle = $('#retex-sentinelle-texte');
    if (sentinelle) sentinelle.textContent = etatRetex.reveles >= n ? 'Fin de la chronologie : incident clos, enseignements ci-dessous.' : etatRetex.reveles === 0 ? 'La chronologie se déroule point par point.' : 'Point suivant : ' + F.incidents[0].evenements[etatRetex.reveles].type.toLowerCase() + ' à ' + heureCourte(F.incidents[0].evenements[etatRetex.reveles].h) + '.';
  }
  function retexSuivant() {
    var n = F.incidents[0].evenements.length;
    if (etatRetex.reveles >= n) return;
    etatRetex.reveles++;
    majRetex();
    var actif = $('.retex-point.est-actif');
    if (actif) actif.scrollIntoView({ block: 'nearest', behavior: reduit.matches ? 'auto' : 'smooth' });
  }
  function retexTout() { etatRetex.reveles = F.incidents[0].evenements.length; majRetex(); }
  function retexReinit() { etatRetex.reveles = 0; majRetex(); var c = $('#retex-chrono'); if (c) c.focus(); }

  /* ------------------------------------------------------------------ Écran : composants */
  function illustrationVide() {
    return '<svg viewBox="0 0 150 100" aria-hidden="true" focusable="false"><rect x="25" y="18" width="100" height="70" rx="10" fill="#E6EFE9"/><rect x="40" y="34" width="70" height="8" rx="4" fill="#FFFFFF"/><rect x="40" y="50" width="48" height="8" rx="4" fill="#FFFFFF"/><rect x="40" y="66" width="58" height="8" rx="4" fill="#FFFFFF"/><circle cx="118" cy="26" r="12" fill="#245F4C"/><path d="M112 26h12M118 20v12" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function rendreComposants() {
    var html = '<div class="page-entete"><div><div class="surtitre">Bibliothèque</div><h1 id="titre-page" tabindex="-1">Composants transverses</h1><p class="page-sous">Modale de confirmation, notifications, états vides, chargement, badges et palette. Tout est fonctionnel sur données fictives.</p></div></div>';
    html += '<div class="pile">' +
      '<div class="demo-grille">' +
        '<section class="section" aria-labelledby="t-modale"><div class="section-entete"><h2 id="t-modale">Modale de confirmation</h2><span class="section-note">role=dialog · focus piégé · Échap</span></div><p class="texte-long" data-marge>La modale concentre l’attention sur une seule décision. Le voile est doux, l’ombre est la seule de l’interface.</p><div class="demo-rangee"><button type="button" class="btn btn-danger" data-action="ouvrir-modale">' + ico('corbeille') + 'Supprimer un audit…</button></div></section>' +
        '<section class="section" aria-labelledby="t-toasts"><div class="section-entete"><h2 id="t-toasts">Notifications</h2><span class="section-note">aria-live=polite · fermeture nommée</span></div><p class="texte-long" data-marge>Quatre tonalités, toujours accompagnées d’une icône et d’un titre. Disparition automatique après six secondes.</p><div class="demo-rangee">' +
          '<button type="button" class="btn" data-action="toast" data-genre="succes" data-titre="Plan d’actions validé" data-texte="Les 4 actions de AUD-07 passent en suivi.">' + ico('check-cercle') + 'Succès</button>' +
          '<button type="button" class="btn" data-action="toast" data-genre="alerte" data-titre="Échéance proche" data-texte="C-40 arrive à échéance dans 5 jours.">' + ico('alerte') + 'Alerte</button>' +
          '<button type="button" class="btn" data-action="toast" data-genre="erreur" data-titre="Export impossible" data-texte="Le service d’export ne répond pas (simulation).">' + ico('alerte-cercle') + 'Erreur</button>' +
          '<button type="button" class="btn" data-action="toast" data-genre="info" data-titre="Rapport reçu" data-texte="Le rapport de « Surveillance 1 ISO 27001 » est disponible.">' + ico('info') + 'Info</button></div></section>' +
        '<section class="section section-blanche" aria-labelledby="t-vide"><div class="section-entete"><h2 id="t-vide">État vide</h2><span class="section-note">Illustration sobre + action</span></div><div class="vide">' + illustrationVide() + '<h3>Aucun constat pour cet audit</h3><p>Les constats seront saisis après la réunion de clôture. Vous pouvez préparer le plan d’audit en attendant.</p><a class="btn btn-primaire" href="#/formulaire">' + ico('plus') + 'Préparer le plan</a></div></section>' +
        '<section class="section section-blanche" aria-labelledby="t-charge"><div class="section-entete"><h2 id="t-charge">Chargement</h2><button type="button" class="btn btn-sm" data-action="simuler-chargement">' + ico('rafraichir') + 'Simuler un chargement</button></div><div id="zone-chargement" aria-live="polite" aria-busy="false">' + contenuCharge() + '</div></section>' +
      '</div>' +
      '<section class="section" aria-labelledby="t-badges"><div class="section-entete"><h2 id="t-badges">Statuts et badges</h2><span class="section-note">Couleur + icône + libellé, jamais la couleur seule</span></div><div class="pile">' +
        '<div class="demo-rangee">' + F.vocabulaire.statutsAudit.map(function (s) { return badge(s, STATUT_AUDIT); }).join('') + '</div>' +
        '<div class="demo-rangee">' + F.vocabulaire.criticites.map(function (s) { return badge(s, CRITICITE); }).join('') + F.vocabulaire.statutsConstat.map(function (s) { return badge(s, STATUT_CONSTAT); }).join('') + '</div>' +
        '<div class="demo-rangee">' + F.vocabulaire.statutsAction.map(function (s) { return badge(s, STATUT_ACTION); }).join('') + F.referentiels.map(function (r) { return badgeRef(r.id); }).join('') + '</div>' +
        '<div class="demo-rangee">' + [0, 1, 2, 3, 4].map(badgeGravite).join('') + '</div>' +
      '</div></section>' +
      '<section class="section section-blanche" aria-labelledby="t-palette"><div class="section-entete"><h2 id="t-palette">Palette</h2><span class="section-note">Couleurs de base de l’application, nuancées</span></div><div class="palette-demo">' +
        [['Encre', '#243B34', '#FFFFFF'], ['Encre 80 %', '#4F6159', '#FFFFFF'], ['Vert', '#245F4C', '#FFFFFF'], ['Vert pâle', '#E3EEE7', '#243B34'], ['Violet', '#5A48B5', '#FFFFFF'], ['Violet pâle', '#EDEAF8', '#243B34'], ['Sauge', '#F3F7F4', '#243B34'], ['Fond', '#FBFCFB', '#243B34'], ['Succès', '#206D2F', '#FFFFFF'], ['Alerte', '#A03E08', '#FFFFFF'], ['Erreur', '#B02424', '#FFFFFF'], ['Info', '#145B9C', '#FFFFFF']].map(function (c) {
          return '<div class="nuance" data-c="' + c[1] + '" data-t="' + c[2] + '"><span>' + c[0] + '</span><code>' + c[1] + '</code></div>';
        }).join('') + '</div></section>' +
    '</div>';
    return { html: html, apres: function (racine) { poserVariables(racine); }, titre: 'Composants' };
  }
  function contenuCharge() {
    var prochains = F.audits.filter(function (a) { return a.statut === 'En préparation' || a.statut === 'Planifié'; }).sort(function (a, b) { return a.debut < b.debut ? -1 : 1; }).slice(0, 3);
    return '<div class="charge-resultat"><p class="section-note">Prochains audits chargés :</p><ul class="echeances">' + prochains.map(function (a) {
      return '<li class="echeance"><span class="echeance-date chiffres">' + F.fr(a.debut) + '</span><span class="echeance-corps"><a class="echeance-titre" href="#/audit/' + a.id + '">' + esc(a.nom) + '</a><span class="echeance-meta">' + esc(a.site) + '</span></span>' + badge(a.statut, STATUT_AUDIT) + '</li>';
    }).join('') + '</ul></div>';
  }
  function simulerChargement() {
    var zone = $('#zone-chargement');
    if (!zone) return;
    zone.setAttribute('aria-busy', 'true');
    zone.innerHTML = '<div class="squelette" aria-label="Chargement en cours"><div class="squelette-ligne" data-l="40%"></div><div class="squelette-bloc"></div><div class="squelette-ligne" data-l="85%"></div><div class="squelette-ligne" data-l="60%"></div></div>';
    poserVariables(zone);
    setTimeout(function () {
      if (!document.body.contains(zone)) return;
      zone.innerHTML = contenuCharge();
      zone.setAttribute('aria-busy', 'false');
    }, 1400);
  }

  /* ------------------------------------------------------------------ Navigation et routage */
  var ROUTES = [
    { hash: '#/dashboard', libelle: 'Tableau de bord', icone: 'tableau' },
    { hash: '#/audits', libelle: 'Audits', icone: 'liste' },
    { hash: '#/audit/AUD-07', libelle: 'Fiche d’audit', icone: 'fiche', prefixe: '#/audit/' },
    { hash: '#/formulaire', libelle: 'Nouvel audit', icone: 'formulaire' },
    { hash: '#/retex', libelle: 'RETEX', icone: 'retex' },
    { hash: '#/composants', libelle: 'Composants', icone: 'composants' },
  ];
  $('#nav-liste').innerHTML = ROUTES.map(function (r) {
    return '<li><a href="' + r.hash + '" data-prefixe="' + (r.prefixe || r.hash) + '">' + ico(r.icone) + '<span>' + esc(r.libelle) + '</span></a></li>';
  }).join('');
  $('#entete-org').textContent = F.organisation.nom + ' · ' + F.organisation.sousTitre;
  $('#entete-cycle').textContent = F.organisation.periode;
  $('#utilisateur-avatar').textContent = F.moi.initiales;
  $('#utilisateur-nom').textContent = F.moi.nom;
  $('#utilisateur-role').textContent = F.moi.role;

  var premierRendu = true;
  function routeCourante() {
    var h = location.hash || '#/dashboard';
    if (h === '#/' || h === '#') h = '#/dashboard';
    return h;
  }
  function rendre() {
    var h = routeCourante();
    var resultat;
    if (h === '#/dashboard') resultat = rendreDashboard();
    else if (h === '#/audits') resultat = rendreListe();
    else if (h.indexOf('#/audit/') === 0) resultat = rendreFiche(decodeURIComponent(h.slice(8)));
    else if (h === '#/formulaire') resultat = rendreFormulaire();
    else if (h === '#/retex') resultat = rendreRetex();
    else if (h === '#/composants') resultat = rendreComposants();
    else resultat = { html: '<h1 id="titre-page" tabindex="-1">Page introuvable</h1><div class="section vide">' + illustrationVide() + '<h3>Aucun écran pour « ' + esc(h) + ' »</h3><a class="btn" href="#/dashboard">Retour au tableau de bord</a></div>', apres: function () {}, titre: 'Page introuvable' };
    var ecran = $('#ecran');
    var neuf = document.createElement('div');
    neuf.className = 'ecran';
    neuf.id = 'ecran';
    neuf.innerHTML = resultat.html;
    ecran.parentNode.replaceChild(neuf, ecran);
    resultat.apres(neuf);
    document.title = resultat.titre + ' — Suivi des audits SMSI (maquette B)';
    $$('#nav-liste a').forEach(function (a) {
      var actif = h.indexOf(a.getAttribute('data-prefixe')) === 0;
      if (actif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    cacherInfobulle();
    if (!premierRendu) {
      var titre = $('#titre-page', neuf);
      if (titre) titre.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    premierRendu = false;
  }
  window.addEventListener('hashchange', rendre);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'route' && typeof d.hash === 'string' && d.hash.indexOf('#/') === 0) location.hash = d.hash;
  });
  var minuteurRedim;
  window.addEventListener('resize', function () {
    clearTimeout(minuteurRedim);
    minuteurRedim = setTimeout(function () { var l = $('[role="tablist"]'); if (l) placerIndicateur(l); }, 80);
  });

  /* ------------------------------------------------------------------ Délégation des actions */
  document.addEventListener('click', function (e) {
    var cible = e.target.closest ? e.target.closest('[data-action]') : null;
    if (cible) {
      var action = cible.getAttribute('data-action');
      if (action === 'toast') toast(cible.getAttribute('data-genre'), cible.getAttribute('data-titre'), cible.getAttribute('data-texte'));
      else if (action === 'ouvrir-modale') ouvrirModale(cible);
      else if (action === 'fermer-modale') fermerModale();
      else if (action === 'confirmer-modale') { fermerModale(); toast('succes', 'Audit supprimé', 'Simulation : les données fictives ne changent pas.'); }
      else if (action === 'trier') {
        var cle = cible.getAttribute('data-cle');
        if (etatListe.tri === cle) etatListe.sens = etatListe.sens === 'asc' ? 'desc' : 'asc';
        else { etatListe.tri = cle; etatListe.sens = cle === 'debut' || cle === 'progression' ? 'desc' : 'asc'; }
        etatListe.page = 1;
        rendreTableau();
      }
      else if (action === 'page') { var p = parseInt(cible.getAttribute('data-page'), 10); if (p >= 1) { etatListe.page = p; rendreTableau(); var t = $('#tableau-audits'); if (t) t.scrollIntoView({ block: 'nearest', behavior: reduit.matches ? 'auto' : 'smooth' }); } }
      else if (action === 'reinitialiser-filtres') {
        etatListe.q = ''; etatListe.statut = ''; etatListe.type = ''; etatListe.ref = ''; etatListe.page = 1;
        var f = $('#outils-liste'); if (f) { f.reset(); $('#recherche', f).value = ''; }
        rendreTableau();
        $('#recherche').focus();
      }
      else if (action === 'retex-suivant') retexSuivant();
      else if (action === 'retex-tout') retexTout();
      else if (action === 'retex-reinit') retexReinit();
      else if (action === 'simuler-chargement') simulerChargement();
      else if (action === 'aller-champ') { e.preventDefault(); var champ = $('#' + cible.getAttribute('data-cible')); if (champ) champ.focus(); }
      return;
    }
    var ligne = e.target.closest ? e.target.closest('tr.ligne') : null;
    if (ligne && !(e.target.closest('a'))) { location.hash = '#/audit/' + ligne.getAttribute('data-id'); }
  });
  document.addEventListener('keydown', function (e) {
    var ligne = e.target.closest ? e.target.closest('tr.ligne') : null;
    if (ligne && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = '#/audit/' + ligne.getAttribute('data-id'); }
  });

  /* ------------------------------------------------------------------ Démarrage */
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    try { history.replaceState(null, '', '#/dashboard'); } catch (err) { /* file:// restrictif : on rend la route par défaut sans toucher à l'URL */ }
  }
  rendre();
})();
