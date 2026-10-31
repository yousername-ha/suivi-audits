/* Maquette E — DATA-DENSE COMPACT. Rendu des écrans, graphiques SVG natifs et interactions.
   JS natif, sans module, sans dépendance. Données : window.FAKE uniquement, aucune persistance. */
(function () {
  'use strict';

  var F = window.FAKE;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var contenu = document.getElementById('contenu');
  var fil = document.getElementById('fil');
  var toastsRacine = document.getElementById('toasts');
  var modaleRacine = document.getElementById('modale-racine');
  var infobulle = document.getElementById('infobulle');
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* État d'interface (mémoire seulement) */
  var etat = {
    densite: 'normal',
    liste: { recherche: '', statut: [], type: [], referentiel: [], tri: 'debut', sens: 'desc', page: 1 },
    ongletFiche: 'synthese',
    retex: { revele: 0 },
    panneauxReplies: {},
  };

  /* ------------------------------------------------------------------ Aides DOM */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'class') e.className = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'vars') Object.keys(v).forEach(function (n) { e.style.setProperty(n, v[n]); });
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    ajouter(e, children);
    return e;
  }
  function ajouter(parent, children) {
    if (!children) return parent;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return parent;
  }
  function svg(tag, attrs, children) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') e.textContent = v;
        else if (k === 'vars') Object.keys(v).forEach(function (n) { e.style.setProperty(n, v[n]); });
        else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      });
    }
    ajouter(e, children);
    return e;
  }
  function icone(nom, classe) {
    var s = svg('svg', { 'aria-hidden': 'true', class: 'icone' + (classe ? ' ' + classe : '') });
    s.appendChild(svg('use', { href: '#' + nom }));
    return s;
  }
  function vider(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
  }
  function pct(n, total) {
    return total ? Math.round((n / total) * 100) : 0;
  }
  function pluriel(n, s, p) {
    return n + ' ' + (n > 1 ? p || s + 's' : s);
  }
  function normaliser(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function heureCourte(isoH) {
    var p = isoH.split('T');
    return F.fr(p[0]) + ' ' + p[1];
  }

  /* ------------------------------------------------------------------ Vocabulaire visuel des statuts */
  var STATUT_AUDIT = {
    'Planifié': { classe: 'neutre', icone: 'i-calendrier' },
    'En préparation': { classe: 'violet', icone: 'i-horloge' },
    'En cours': { classe: 'info', icone: 'i-lecture' },
    'Rapport attendu': { classe: 'alerte', icone: 'i-fiche' },
    'Clos': { classe: 'succes', icone: 'i-ok' },
    'Reporté': { classe: 'ambre', icone: 'i-pause' },
  };
  var CRITICITE = {
    Critique: { classe: 'erreur', icone: 'i-erreur', couleur: 'var(--donnee-critique)' },
    Majeure: { classe: 'alerte', icone: 'i-alerte', couleur: 'var(--donnee-majeure)' },
    Mineure: { classe: 'ambre', icone: 'i-info', couleur: 'var(--donnee-mineure)' },
    Observation: { classe: 'neutre', icone: 'i-point', couleur: 'var(--donnee-observation)' },
  };
  var STATUT_CONSTAT = {
    Ouvert: { classe: 'erreur', icone: 'i-point' },
    'En cours': { classe: 'info', icone: 'i-lecture' },
    'À vérifier': { classe: 'alerte', icone: 'i-horloge' },
    Clos: { classe: 'succes', icone: 'i-ok' },
  };
  var STATUT_ACTION = {
    'À faire': { classe: 'neutre', icone: 'i-point', couleur: 'var(--donnee-observation)' },
    'En cours': { classe: 'info', icone: 'i-lecture', couleur: 'var(--info)' },
    'Bloquée': { classe: 'erreur', icone: 'i-bloque', couleur: 'var(--erreur)' },
    'Terminée': { classe: 'succes', icone: 'i-ok', couleur: 'var(--succes)' },
  };
  var GRAVITE = [
    { classe: 'neutre', icone: 'i-ok' },
    { classe: 'succes', icone: 'i-info' },
    { classe: 'ambre', icone: 'i-info' },
    { classe: 'alerte', icone: 'i-alerte' },
    { classe: 'erreur', icone: 'i-erreur' },
  ];
  var REF_CLASSE = { iso: 'succes', annexeA: 'info', hds: 'violet', nis2: 'alerte', rgpd: 'neutre' };

  function pastille(texte, def, contour) {
    def = def || { classe: 'neutre', icone: 'i-point' };
    return el('span', { class: 'pastille ' + def.classe + (contour ? ' contour' : '') }, [icone(def.icone), texte]);
  }
  function pastilleRef(id) {
    var r = F.referentiel(id);
    return el('span', { class: 'pastille contour ' + (REF_CLASSE[id] || 'neutre'), title: r.libelle }, [el('span', { class: 'point-statut', 'aria-hidden': 'true' }), r.court]);
  }
  function personne(id, petit) {
    var u = F.utilisateur(id);
    return el('span', { class: 'cellule-personne' }, [el('span', { class: 'avatar' + (petit ? ' petit' : ''), 'aria-hidden': 'true', text: u.initiales }), el('span', { text: u.nom })]);
  }
  function progression(valeur, classe, mince) {
    var p = el('div', { class: 'progression' + (classe ? ' ' + classe : '') + (mince ? ' mince' : ''), role: 'progressbar', 'aria-valuenow': valeur, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progression ' + valeur + ' %' });
    p.style.setProperty('--valeur', valeur);
    return p;
  }
  function celluleProgression(valeur, classe) {
    return el('span', { class: 'cellule-progression' }, [progression(valeur, classe, true), el('span', { class: 'chiffres', text: valeur + ' %' })]);
  }

  /* ------------------------------------------------------------------ Info-bulle de graphique */
  function montrerInfobulle(x, y, titre, lignes) {
    vider(infobulle);
    infobulle.appendChild(el('strong', { text: titre }));
    (lignes || []).forEach(function (l) {
      infobulle.appendChild(el('span', { text: l }));
      infobulle.appendChild(document.createElement('br'));
    });
    infobulle.hidden = false;
    infobulle.style.setProperty('left', x + 'px');
    infobulle.style.setProperty('top', y + 'px');
  }
  function cacherInfobulle() {
    infobulle.hidden = true;
  }
  function lierInfobulle(cible, titre, lignes) {
    cible.addEventListener('mouseenter', function (e) {
      var r = cible.getBoundingClientRect();
      montrerInfobulle(r.left + r.width / 2, r.top, titre, lignes);
    });
    cible.addEventListener('mousemove', function (e) {
      infobulle.style.setProperty('left', e.clientX + 'px');
      infobulle.style.setProperty('top', e.clientY - 6 + 'px');
    });
    cible.addEventListener('mouseleave', cacherInfobulle);
    cible.addEventListener('focus', function () {
      var r = cible.getBoundingClientRect();
      montrerInfobulle(r.left + r.width / 2, r.top, titre, lignes);
    });
    cible.addEventListener('blur', cacherInfobulle);
  }

  /* ------------------------------------------------------------------ Graphiques SVG */
  function sparkline(valeurs, opts) {
    opts = opts || {};
    var w = opts.w || 72;
    var h = opts.h || 28;
    var min = Math.min.apply(null, valeurs.concat(opts.cible !== undefined ? [opts.cible] : []));
    var max = Math.max.apply(null, valeurs.concat(opts.cible !== undefined ? [opts.cible] : []));
    if (max === min) max = min + 1;
    var pad = 3;
    function X(i) { return pad + (i * (w - 2 * pad)) / (valeurs.length - 1); }
    function Y(v) { return h - pad - ((v - min) * (h - 2 * pad)) / (max - min); }
    var d = valeurs.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    var s = svg('svg', { class: 'sparkline', viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'aria-hidden': 'true', focusable: 'false' });
    if (opts.cible !== undefined) s.appendChild(svg('line', { class: 'cible', x1: pad, x2: w - pad, y1: Y(opts.cible), y2: Y(opts.cible) }));
    s.appendChild(svg('path', { class: 'ligne ' + (opts.ton || ''), d: d }));
    var dernier = valeurs[valeurs.length - 1];
    s.appendChild(svg('circle', { class: 'point', cx: X(valeurs.length - 1), cy: Y(dernier), r: 2.5, fill: 'currentColor' }));
    return s;
  }

  function graphiqueDonut(parts, opts) {
    opts = opts || {};
    var taille = opts.taille || 140;
    var r = taille / 2 - 14;
    var cx = taille / 2;
    var cy = taille / 2;
    var circ = 2 * Math.PI * r;
    var total = parts.reduce(function (s, p) { return s + p.valeur; }, 0);
    var s = svg('svg', { class: 'graphique donut', viewBox: '0 0 ' + taille + ' ' + taille, role: 'img', 'aria-label': opts.label || 'Répartition' });
    s.setAttribute('width', taille);
    s.setAttribute('height', taille);
    s.style.setProperty('width', taille + 'px');
    var gap = 2;
    var offset = 0;
    parts.forEach(function (p) {
      if (!p.valeur) return;
      var len = (p.valeur / total) * circ - gap;
      if (len < 0) len = 0.1;
      var c = svg('circle', { class: 'donut-segment', cx: cx, cy: cy, r: r, stroke: p.couleur, 'stroke-width': 14, transform: 'rotate(' + (-90 + (offset / circ) * 360) + ' ' + cx + ' ' + cy + ')', tabindex: '0', 'aria-label': p.libelle + ' : ' + p.valeur });
      c.style.setProperty('--len', len.toFixed(2));
      lierInfobulle(c, p.libelle, [p.valeur + ' (' + pct(p.valeur, total) + ' %)']);
      c.addEventListener('mouseenter', function () { s.classList.add('a-survol'); c.classList.add('survole'); });
      c.addEventListener('mouseleave', function () { s.classList.remove('a-survol'); c.classList.remove('survole'); });
      s.appendChild(c);
      offset += (p.valeur / total) * circ;
    });
    s.appendChild(svg('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', class: 'valeur', 'font-size': 22, text: String(opts.centre !== undefined ? opts.centre : total) }));
    s.appendChild(svg('text', { x: cx, y: cy + 13, 'text-anchor': 'middle', text: opts.centreLibelle || 'total' }));
    return s;
  }

  function graphiqueCourbe(series, categories, opts) {
    opts = opts || {};
    var w = opts.w || 560;
    var h = opts.h || 170;
    var m = { t: 12, r: 12, b: 24, l: 28 };
    var max = 0;
    series.forEach(function (sr) { sr.valeurs.forEach(function (v) { if (v > max) max = v; }); });
    max = Math.ceil(max / 5) * 5 || 5;
    function X(i) { return m.l + (i * (w - m.l - m.r)) / (categories.length - 1); }
    function Y(v) { return m.t + (h - m.t - m.b) * (1 - v / max); }
    var s = svg('svg', { class: 'graphique courbe', viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': opts.label || 'Évolution' });
    s.setAttribute('preserveAspectRatio', 'none');
    s.style.setProperty('height', h + 'px');
    for (var g = 0; g <= 4; g++) {
      var yv = (max / 4) * g;
      s.appendChild(svg('line', { class: 'grille', x1: m.l, x2: w - m.r, y1: Y(yv), y2: Y(yv) }));
      s.appendChild(svg('text', { x: m.l - 6, y: Y(yv) + 3, 'text-anchor': 'end', text: String(Math.round(yv)) }));
    }
    categories.forEach(function (c, i) {
      if (i % (opts.pasX || 1) === 0) s.appendChild(svg('text', { x: X(i), y: h - 6, 'text-anchor': 'middle', text: c }));
    });
    series.forEach(function (sr) {
      var d = sr.valeurs.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
      if (sr.aire) {
        s.appendChild(svg('path', { class: 'aire', fill: sr.couleur, d: d + ' L' + X(sr.valeurs.length - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0) + ' ' + Y(0) + ' Z' }));
      }
      var p = svg('path', { class: 'trace', stroke: sr.couleur, d: d });
      s.appendChild(p);
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) { len = 1000; }
      p.style.setProperty('--len', (len || 1000).toFixed(0));
      var fin = sr.valeurs.length - 1;
      s.appendChild(svg('circle', { class: 'marqueur', cx: X(fin), cy: Y(sr.valeurs[fin]), r: 4, fill: sr.couleur }));
    });
    /* Colonnes de survol : une par catégorie */
    var surbrillance = svg('line', { class: 'axe', x1: 0, x2: 0, y1: m.t, y2: h - m.b, visibility: 'hidden' });
    s.appendChild(surbrillance);
    var marqueurs = series.map(function (sr) {
      var c = svg('circle', { class: 'marqueur', r: 4, fill: sr.couleur, visibility: 'hidden' });
      s.appendChild(c);
      return c;
    });
    var largeurCol = (w - m.l - m.r) / (categories.length - 1);
    categories.forEach(function (c, i) {
      var zone = svg('rect', { class: 'zone-survol', x: X(i) - largeurCol / 2, y: 0, width: largeurCol, height: h, tabindex: '0', 'aria-label': c + ' : ' + series.map(function (sr) { return sr.libelle + ' ' + sr.valeurs[i]; }).join(', ') });
      function entrer(e) {
        surbrillance.setAttribute('x1', X(i));
        surbrillance.setAttribute('x2', X(i));
        surbrillance.setAttribute('visibility', 'visible');
        marqueurs.forEach(function (mk, k) { mk.setAttribute('cx', X(i)); mk.setAttribute('cy', Y(series[k].valeurs[i])); mk.setAttribute('visibility', 'visible'); });
        var r = zone.getBoundingClientRect();
        montrerInfobulle(r.left + r.width / 2, r.top + 10, c, series.map(function (sr) { return sr.libelle + ' : ' + sr.valeurs[i]; }));
      }
      function sortir() {
        surbrillance.setAttribute('visibility', 'hidden');
        marqueurs.forEach(function (mk) { mk.setAttribute('visibility', 'hidden'); });
        cacherInfobulle();
      }
      zone.addEventListener('mouseenter', entrer);
      zone.addEventListener('focus', entrer);
      zone.addEventListener('mouseleave', sortir);
      zone.addEventListener('blur', sortir);
      s.appendChild(zone);
    });
    return s;
  }

  function graphiqueColonnes(items, opts) {
    opts = opts || {};
    var w = opts.w || 260;
    var h = opts.h || 120;
    var m = { t: 14, r: 4, b: 20, l: 4 };
    var max = Math.max.apply(null, items.map(function (i) { return i.valeur; })) || 1;
    var n = items.length;
    var pas = (w - m.l - m.r) / n;
    var larg = Math.min(24, pas - 6);
    var s = svg('svg', { class: 'graphique colonnes', viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': opts.label || 'Colonnes' });
    s.style.setProperty('height', h + 'px');
    s.appendChild(svg('line', { class: 'axe', x1: m.l, x2: w - m.r, y1: h - m.b, y2: h - m.b }));
    items.forEach(function (it, i) {
      var x = m.l + i * pas + (pas - larg) / 2;
      var hv = ((h - m.t - m.b) * it.valeur) / max;
      var y = h - m.b - hv;
      var rect = svg('rect', { class: 'colonne', x: x, y: y, width: larg, height: Math.max(hv, 0), rx: 3, fill: it.couleur || 'var(--donnee-1)', tabindex: '0', 'aria-label': it.libelle + ' : ' + it.valeur });
      lierInfobulle(rect, it.libelle, [it.valeur + (opts.unite ? ' ' + opts.unite : '')]);
      s.appendChild(rect);
      s.appendChild(svg('text', { x: x + larg / 2, y: y - 4, 'text-anchor': 'middle', class: 'valeur', text: String(it.valeur) }));
      s.appendChild(svg('text', { x: x + larg / 2, y: h - 6, 'text-anchor': 'middle', text: it.court || it.libelle }));
    });
    return s;
  }

  function jauge(valeur, cible, opts) {
    opts = opts || {};
    var w = 64;
    var h = 10;
    var s = svg('svg', { class: 'graphique jauge', viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, 'aria-hidden': 'true' });
    s.style.setProperty('width', w + 'px');
    s.appendChild(svg('line', { class: 'jauge-piste', x1: 3, x2: w - 3, y1: h / 2, y2: h / 2, 'stroke-width': 4 }));
    var ratio = Math.min(1, valeur / (opts.max || Math.max(cible, valeur)));
    var ligne = svg('line', { class: 'jauge-valeur', x1: 3, x2: w - 3, y1: h / 2, y2: h / 2, 'stroke-width': 4, stroke: opts.couleur || 'var(--accent)' });
    ligne.style.setProperty('--len', ((w - 6) * ratio).toFixed(1));
    s.appendChild(ligne);
    var xc = 3 + (w - 6) * Math.min(1, cible / (opts.max || Math.max(cible, valeur)));
    s.appendChild(svg('line', { x1: xc, x2: xc, y1: 0, y2: h, stroke: 'var(--texte-2)', 'stroke-width': 1.5 }));
    return s;
  }

  /* ------------------------------------------------------------------ Panneaux repliables */
  function panneau(id, titre, options, corps, pied) {
    options = options || {};
    var p = el('section', { class: 'panneau' + (options.classe ? ' ' + options.classe : '') + (etat.panneauxReplies[id] ? ' replie' : ''), 'aria-labelledby': 'titre-' + id });
    var entete = el('header', { class: 'panneau-entete' });
    var h = el('h2', { id: 'titre-' + id }, [titre]);
    if (options.compteur !== undefined) h.appendChild(el('span', { class: 'compteur', text: String(options.compteur) }));
    if (options.sous) h.appendChild(el('span', { class: 'sous', text: options.sous }));
    entete.appendChild(h);
    (options.actions || []).forEach(function (a) { entete.appendChild(a); });
    var corpsEl = el('div', { class: 'panneau-corps' + (options.sansMarge ? ' sans-marge' : ''), id: 'corps-' + id }, corps);
    var btn = el('button', { class: 'btn-icone btn-replier', type: 'button', 'aria-expanded': String(!etat.panneauxReplies[id]), 'aria-controls': 'corps-' + id, 'aria-label': 'Replier ou déplier « ' + titre + ' »' }, icone('i-chevron'));
    btn.addEventListener('click', function () {
      var replie = p.classList.toggle('replie');
      etat.panneauxReplies[id] = replie;
      btn.setAttribute('aria-expanded', String(!replie));
    });
    entete.appendChild(btn);
    p.appendChild(entete);
    p.appendChild(corpsEl);
    if (pied) p.appendChild(el('footer', { class: 'panneau-pied' }, pied));
    return p;
  }

  /* ------------------------------------------------------------------ Toasts */
  var ICONES_TOAST = { succes: 'i-cercle-ok', alerte: 'i-alerte', erreur: 'i-erreur', info: 'i-info' };
  function toast(type, titre, texte, duree) {
    var t = el('div', { class: 'toast ' + type, role: type === 'erreur' || type === 'alerte' ? 'alert' : null });
    t.appendChild(icone(ICONES_TOAST[type] || 'i-info', 'ico'));
    t.appendChild(el('div', { class: 'texte' }, [el('strong', { text: titre }), texte ? el('span', { text: texte }) : null]));
    var fermer = el('button', { class: 'btn-icone fermer', type: 'button', 'aria-label': 'Fermer la notification' }, icone('i-fermer'));
    var minuterie;
    function retirer() {
      clearTimeout(minuterie);
      if (!t.parentNode) return;
      if (reduit) { t.remove(); return; }
      t.classList.add('sortie');
      t.addEventListener('animationend', function () { t.remove(); }, { once: true });
    }
    fermer.addEventListener('click', retirer);
    t.appendChild(fermer);
    toastsRacine.appendChild(t);
    minuterie = setTimeout(retirer, duree || 6000);
    return t;
  }

  /* ------------------------------------------------------------------ Modale avec piège de focus */
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function ouvrirModale(opts) {
    var declencheur = document.activeElement;
    vider(modaleRacine);
    var m = el('div', { class: 'modale', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modale-titre', 'aria-describedby': 'modale-desc' });
    var entete = el('header', { class: 'modale-entete' });
    if (opts.danger) entete.appendChild(el('span', { class: 'icone-danger', 'aria-hidden': 'true' }, icone('i-alerte')));
    entete.appendChild(el('h2', { id: 'modale-titre', text: opts.titre }));
    var fermerBtn = el('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Fermer' }, icone('i-fermer'));
    entete.appendChild(fermerBtn);
    m.appendChild(entete);
    m.appendChild(el('div', { class: 'modale-corps', id: 'modale-desc' }, opts.corps));
    var annuler = el('button', { class: 'btn', type: 'button', text: opts.annuler || 'Annuler' });
    var confirmer = el('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primaire'), type: 'button', text: opts.confirmer || 'Confirmer' });
    m.appendChild(el('footer', { class: 'modale-pied' }, [annuler, confirmer]));
    modaleRacine.appendChild(m);
    modaleRacine.hidden = false;
    document.body.style.setProperty('overflow', 'hidden');

    function fermer(resultat) {
      modaleRacine.hidden = true;
      vider(modaleRacine);
      document.body.style.removeProperty('overflow');
      document.removeEventListener('keydown', clavier, true);
      if (declencheur && declencheur.focus) declencheur.focus();
      if (opts.apres) opts.apres(resultat);
    }
    function clavier(e) {
      if (e.key === 'Escape') { e.preventDefault(); fermer(false); return; }
      if (e.key === 'Tab') {
        var f = Array.prototype.slice.call(m.querySelectorAll(FOCUSABLE));
        if (!f.length) return;
        var premier = f[0];
        var dernier = f[f.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      }
    }
    document.addEventListener('keydown', clavier, true);
    fermerBtn.addEventListener('click', function () { fermer(false); });
    annuler.addEventListener('click', function () { fermer(false); });
    confirmer.addEventListener('click', function () { fermer(true); });
    modaleRacine.addEventListener('click', function (e) { if (e.target === modaleRacine) fermer(false); }, { once: true });
    annuler.focus();
  }

  /* ------------------------------------------------------------------ Fil d'Ariane */
  function majFil(parties) {
    vider(fil);
    fil.appendChild(el('a', { href: '#/dashboard', text: F.organisation.sigle }));
    parties.forEach(function (p, i) {
      fil.appendChild(icone('i-chevron-droite'));
      if (i === parties.length - 1) fil.appendChild(el('strong', { text: p.texte, 'aria-current': 'page' }));
      else fil.appendChild(el('a', { href: p.href, text: p.texte }));
    });
  }

  /* ================================================================== ÉCRAN : DASHBOARD */
  function ecranDashboard() {
    majFil([{ texte: 'Dashboard' }]);
    var K = F.kpi;
    var racine = el('div', { class: 'ecran ecran-dashboard' });

    racine.appendChild(
      el('div', { class: 'entete-ecran' }, [
        el('div', { class: 'titres' }, [
          el('h1', {}, ['Pilotage SMSI', el('span', { class: 'pastille accent' }, [icone('i-point'), F.organisation.periode])]),
          el('p', { class: 'sous-titre', text: F.organisation.nom + ' · ' + F.audits.length + ' audits suivis · données au ' + F.fr(F.aujourdhui) }),
        ]),
        el('div', { class: 'actions' }, [
          el('div', { class: 'groupe-btn', role: 'group', 'aria-label': 'Période' }, [
            el('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', text: '30 j', onclick: function () { toast('info', 'Période 30 jours', 'Filtre de période simulé.'); } }),
            el('button', { class: 'btn', type: 'button', 'aria-pressed': 'true', text: '12 mois' }),
            el('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', text: 'Cycle', onclick: function () { toast('info', 'Période : cycle 2025 – 2028', 'Filtre de période simulé.'); } }),
          ]),
          el('button', { class: 'btn', type: 'button', onclick: function () { toast('succes', 'Export lancé', 'Le tableau de bord sera disponible au format PDF dans quelques instants.'); } }, [icone('i-lien'), 'Exporter']),
          el('a', { class: 'btn btn-primaire', href: '#/formulaire' }, [icone('i-plus'), 'Nouvel audit']),
        ]),
      ]),
    );

    /* Bandeau KPI */
    var I = {};
    F.indicateurs.forEach(function (i) { I[i.id] = i; });
    var evolOuverts = F.evolution.map(function (e) { return e.ouverts; });
    var evolClos = F.evolution.map(function (e) { return e.clos; });
    var kpis = [
      { libelle: 'Audits en cours', valeur: K.auditsEnCours, unite: '/ ' + K.audits, delta: '+1', ton: 'neutre', spark: [2, 3, 3, 2, 4, 3, 5, 4, 3, 4, 4, K.auditsEnCours], href: '#/audits' },
      { libelle: 'Constats ouverts', valeur: K.constatsOuverts, unite: '', delta: '−3', ton: 'bon', spark: evolOuverts, href: '#/audits' },
      { libelle: 'NC ouvertes', valeur: K.ncOuvertes, unite: '', delta: '+2', ton: 'mauvais', spark: [19, 21, 20, 23, 22, 24, 26, 25, 24, 23, 23, K.ncOuvertes], href: '#/audits' },
      { libelle: 'Actions en retard', valeur: K.actionsEnRetard, unite: '/ ' + (K.actions - K.actionsTerminees), delta: '+2', ton: 'mauvais', spark: [4, 5, 5, 6, 7, 6, 8, 7, 7, 8, 8, K.actionsEnRetard], href: '#/audit/AUD-07' },
      { libelle: 'Conformité ISO 27001', valeur: K.conformite + ' %', unite: '', delta: '+1 pt', ton: 'bon', spark: I.I1.historique, cible: I.I1.cible },
      { libelle: 'Risques élevés', valeur: K.risquesEleves, unite: '/ ' + F.risques.length, delta: '=', ton: 'neutre', spark: [4, 4, 5, 4, 4, 3, 4, 3, 3, 3, 3, K.risquesEleves] },
    ];
    var bandeau = el('div', { class: 'bandeau-kpi', role: 'list', 'aria-label': 'Indicateurs clés' });
    kpis.forEach(function (k) {
      var tonLigne = k.ton === 'bon' ? 'bon' : k.ton === 'mauvais' ? 'mauvais' : '';
      var tuile = el('button', { class: 'kpi', type: 'button', role: 'listitem', onclick: function () { if (k.href) location.hash = k.href; else toast('info', k.libelle, 'Détail de l’indicateur non maquetté.'); } }, [
        el('span', { class: 'kpi-libelle', text: k.libelle }),
        el('span', { class: 'kpi-valeur' }, [
          String(k.valeur),
          k.unite ? el('small', { text: k.unite }) : null,
          el('span', { class: 'kpi-delta ' + k.ton, 'aria-label': 'Variation sur le mois : ' + k.delta }, [icone(k.delta.indexOf('+') === 0 ? 'i-haut' : k.delta.indexOf('−') === 0 ? 'i-bas' : 'i-point'), k.delta]),
        ]),
        sparkline(k.spark, { ton: tonLigne, cible: k.cible }),
      ]);
      bandeau.appendChild(tuile);
    });
    racine.appendChild(bandeau);

    var grille = el('div', { class: 'grille' });

    /* Audits par statut : barres horizontales */
    var listeStatuts = el('ul', { class: 'liste-barres' });
    var maxStatut = Math.max.apply(null, F.vocabulaire.statutsAudit.map(function (s) { return K.parStatutAudit[s] || 0; }));
    F.vocabulaire.statutsAudit.forEach(function (s) {
      var n = K.parStatutAudit[s] || 0;
      var def = STATUT_AUDIT[s];
      var li = el('li');
      var lib = el('span', { class: 'lib' }, [el('span', {}, [icone(def.icone, 'visuellement-cache'), s])]);
      var barre = progression(pct(n, maxStatut), null, false);
      barre.setAttribute('aria-label', s + ' : ' + n + ' audits');
      barre.style.setProperty('--progression-couleur', 'var(--' + (def.classe === 'neutre' ? 'donnee-observation' : def.classe) + ')');
      lierInfobulle(barre, s, [pluriel(n, 'audit'), pct(n, K.audits) + ' % du portefeuille']);
      lib.appendChild(barre);
      li.appendChild(lib);
      li.appendChild(el('span', { class: 'n', text: String(n) }));
      listeStatuts.appendChild(li);
    });
    var typesColonnes = graphiqueColonnes(
      F.vocabulaire.typesAudit.map(function (t) { return { libelle: t, court: t.slice(0, 5) + (t.length > 5 ? '.' : ''), valeur: F.compterPar(F.audits, 'type')[t] || 0 }; }),
      { label: 'Audits par type', w: 300, h: 110 },
    );
    grille.appendChild(
      panneau('statuts', 'Audits par statut', { compteur: K.audits, classe: 'col-4' }, [
        listeStatuts,
        el('h3', { class: 'nav-titre', text: 'Par type d’audit' }),
        typesColonnes,
      ]),
    );

    /* NC par criticité : donut + légende */
    var crits = ['Critique', 'Majeure', 'Mineure', 'Observation'];
    var partsNC = crits.map(function (c) { return { libelle: c, valeur: K.parCriticiteNC[c] || 0, couleur: CRITICITE[c].couleur }; }).filter(function (p) { return p.valeur; });
    var legendeNC = el('ul', { class: 'legende' });
    partsNC.forEach(function (p) {
      var li = el('li', {}, [el('span', { class: 'swatch', 'aria-hidden': 'true' }), pastille(p.libelle, CRITICITE[p.libelle], true), el('span', { class: 'val', text: String(p.valeur) })]);
      li.firstChild.style.setProperty('--c', p.couleur);
      legendeNC.appendChild(li);
    });
    var typesConstat = el('ul', { class: 'liste-barres' });
    var totalConstats = F.constats.length;
    F.vocabulaire.typesConstat.forEach(function (t) {
      var n = K.parTypeConstat[t] || 0;
      var li = el('li');
      var lib = el('span', { class: 'lib' }, [el('span', { text: t })]);
      var barre = progression(pct(n, totalConstats) * 3, null, true);
      barre.setAttribute('aria-label', t + ' : ' + n);
      barre.style.setProperty('--progression-couleur', 'var(--donnee-1)');
      lierInfobulle(barre, t, [pluriel(n, 'constat'), pct(n, totalConstats) + ' % des constats']);
      lib.appendChild(barre);
      li.appendChild(lib);
      li.appendChild(el('span', { class: 'n', text: String(n) }));
      typesConstat.appendChild(li);
    });
    grille.appendChild(
      panneau('nc', 'Non-conformités ouvertes', { compteur: K.ncOuvertes, classe: 'col-4', sous: 'par criticité' }, [
        el('div', { class: 'rangee-boutons' }, [graphiqueDonut(partsNC, { label: 'Non-conformités ouvertes par criticité', centre: K.ncOuvertes, centreLibelle: 'NC ouvertes', taille: 132 }), legendeNC]),
        el('h3', { class: 'nav-titre', text: 'Constats par type (tous statuts)' }),
        typesConstat,
      ]),
    );

    /* Avancement des actions : barre segmentée + colonnes */
    var statutsAct = ['Terminée', 'En cours', 'À faire', 'Bloquée'];
    var segm = el('div', { class: 'segmentee', role: 'img', 'aria-label': 'Répartition des actions par statut' });
    var legendeAct = el('ul', { class: 'legende' });
    statutsAct.forEach(function (s) {
      var n = K.parStatutAction[s] || 0;
      var seg = el('span', {});
      seg.style.setProperty('--part', pct(n, K.actions));
      seg.style.setProperty('--c', STATUT_ACTION[s].couleur);
      lierInfobulle(seg, s, [pluriel(n, 'action'), pct(n, K.actions) + ' %']);
      segm.appendChild(seg);
      var li = el('li', {}, [el('span', { class: 'swatch', 'aria-hidden': 'true' }), pastille(s, STATUT_ACTION[s], true), el('span', { class: 'val', text: n + ' · ' + pct(n, K.actions) + ' %' })]);
      li.firstChild.style.setProperty('--c', STATUT_ACTION[s].couleur);
      legendeAct.appendChild(li);
    });
    var retards = F.actions.filter(function (a) { return a.statut !== 'Terminée' && F.daysUntil(a.echeance) < 0; });
    var parPrio = F.compterPar(retards, 'priorite');
    grille.appendChild(
      panneau('actions', 'Avancement des actions', { compteur: K.actions, classe: 'col-4' }, [
        el('div', { class: 'stats-ligne' }, [
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Terminées' }), el('div', { class: 'val' }, [String(K.actionsTerminees), el('small', { text: pct(K.actionsTerminees, K.actions) + ' %' })])]),
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'En retard' }), el('div', { class: 'val' }, [String(K.actionsEnRetard), el('small', { text: 'P1 : ' + (parPrio.P1 || 0) })])]),
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Bloquées' }), el('div', { class: 'val' }, [String(K.parStatutAction['Bloquée'] || 0)])]),
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Délai NC' }), el('div', { class: 'val' }, [String(I.I3.valeur), el('small', { text: 'j · cible ' + I.I3.cible })])]),
        ]),
        el('div', { class: 'nav-titre', text: 'Répartition par statut' }),
        segm,
        legendeAct,
      ]),
    );

    /* Matrice de risques */
    var matrice = el('div', { class: 'matrice', role: 'img', 'aria-label': 'Matrice des risques : gravité en lignes, vraisemblance en colonnes' });
    for (var g = 4; g >= 1; g--) {
      matrice.appendChild(el('span', { class: 'axe-lib', text: 'G' + g }));
      for (var v = 1; v <= 4; v++) {
        var ici = F.risques.filter(function (r) { return r.gravite === g && r.vraisemblance === v; });
        var niveau = g * v;
        var cls = niveau >= 9 ? 'n4' : niveau >= 6 ? 'n3' : niveau >= 3 ? 'n2' : 'n1';
        var cell = el('span', { class: 'cell ' + cls + (ici.length ? '' : ' vide'), text: ici.length ? String(ici.length) : '·' });
        if (ici.length) lierInfobulle(cell, 'Gravité ' + g + ' × vraisemblance ' + v, ici.map(function (r) { return r.id + ' ' + r.titre; }));
        matrice.appendChild(cell);
      }
    }
    matrice.appendChild(el('span', { class: 'axe-lib', text: '' }));
    for (var vv = 1; vv <= 4; vv++) matrice.appendChild(el('span', { class: 'axe-lib', text: 'V' + vv }));
    var risquesEleves = F.risques.filter(function (r) { return r.niveau >= 9; }).sort(function (a, b) { return b.niveau - a.niveau; });
    var tabRisques = el('table', { class: 'tableau' }, [
      el('tbody', {}, risquesEleves.map(function (r) {
        return el('tr', {}, [
          el('td', { class: 'id', text: r.id }),
          el('td', { class: 'tronque etroit fort', title: r.titre + ' — traitement : ' + r.traitement }, el('span', { text: r.titre })),
          el('td', { class: 'num' }, pastille(String(r.niveau), { classe: 'erreur', icone: 'i-alerte' })),
          el('td', { class: 'secondaire', text: r.traitement }),
        ]);
      })),
    ]);
    grille.appendChild(
      panneau('risques', 'Risques', { compteur: F.risques.length, classe: 'col-4', sous: K.risquesEleves + ' élevés' }, [
        matrice,
        el('div', { class: 'nav-titre', text: 'Niveau ≥ 9' }),
        el('div', { class: 'tableau-enveloppe' }, tabRisques),
      ]),
    );

    /* Évolution 12 mois : courbe ouverts/clos */
    var legendeEvol = el('ul', { class: 'legende' });
    [['Constats ouverts', 'var(--donnee-1)'], ['Constats clos', 'var(--donnee-2)']].forEach(function (p) {
      var li = el('li', {}, [el('span', { class: 'swatch ligne', 'aria-hidden': 'true' }), p[0]]);
      li.firstChild.style.setProperty('--c', p[1]);
      legendeEvol.appendChild(li);
    });
    var totOuv = evolOuverts.reduce(function (a, b) { return a + b; }, 0);
    var totClos = evolClos.reduce(function (a, b) { return a + b; }, 0);
    grille.appendChild(
      panneau('evolution', 'Évolution des constats', { classe: 'col-8', sous: '12 derniers mois', actions: [legendeEvol] }, [
        graphiqueCourbe(
          [
            { libelle: 'Ouverts', valeurs: evolOuverts, couleur: 'var(--donnee-1)', aire: true },
            { libelle: 'Clos', valeurs: evolClos, couleur: 'var(--donnee-2)' },
          ],
          F.vocabulaire.mois,
          { label: 'Évolution mensuelle des constats ouverts et clos', h: 180, w: 760 },
        ),
      ], [
        el('span', { text: totOuv + ' constats ouverts et ' + totClos + ' clos sur la période' }),
        el('span', { class: 'chiffres', text: 'Solde : ' + (totClos - totOuv > 0 ? '+' : '') + (totClos - totOuv) }),
      ]),
    );

    /* Prochaines échéances */
    var depassees = K.echeancesDepassees.slice(-4).reverse();
    var liste = el('ul', { class: 'echeances' });
    depassees.concat(K.prochainesEcheances).forEach(function (e) {
      var u = F.utilisateur(e.responsable);
      var li = el('li', {}, [
        el('span', { class: 'pastille ' + (e.genre === 'Action' ? 'info' : 'violet'), title: e.genre, 'aria-label': e.genre }, [icone(e.genre === 'Action' ? 'i-ok' : 'i-fiche')]),
        el('span', { class: 'titre' }, [el('span', { class: 'id', text: e.id }), e.titre]),
        el('span', { class: 'avatar petit', title: u.nom, 'aria-label': u.nom, text: u.initiales }),
        e.jours < 0
          ? el('span', { class: 'retard' }, [icone('i-alerte'), 'J' + e.jours])
          : el('span', { class: 'bientot' }, [icone('i-calendrier'), F.fr(e.echeance)]),
      ]);
      li.firstChild.style.setProperty('padding', '0');
      li.firstChild.style.setProperty('width', '20px');
      li.firstChild.style.setProperty('justify-content', 'center');
      liste.appendChild(li);
    });
    grille.appendChild(
      panneau('echeances', 'Échéances', { compteur: K.prochainesEcheances.length + depassees.length, classe: 'col-4 tablette-pleine', sous: K.echeancesDepassees.length + ' dépassées au total', sansMarge: true }, liste, [
        el('span', {}, [icone('i-alerte'), ' ', K.echeancesDepassees.length + ' échéances dépassées, dont ' + depassees.length + ' affichées']),
        el('a', { href: '#/audits', text: 'Voir les audits' }),
      ]),
    );

    /* Indicateurs SMSI : tableau dense */
    var tabInd = el('table', { class: 'tableau ind-tableau' }, [
      el('thead', {}, el('tr', {}, [
        el('th', { scope: 'col', text: 'Indicateur' }),
        el('th', { scope: 'col', class: 'num', text: 'Valeur' }),
        el('th', { scope: 'col', class: 'num', text: 'Cible' }),
        el('th', { scope: 'col', text: 'Atteinte' }),
        el('th', { scope: 'col', text: 'Écart' }),
        el('th', { scope: 'col', text: '12 mois' }),
      ])),
      el('tbody', {}, F.indicateurs.map(function (i) {
        var inverse = i.id === 'I3' || i.id === 'I7';
        var ecart = i.valeur - i.cible;
        var bon = inverse ? ecart <= 0 : ecart >= 0;
        var ratio = inverse ? Math.min(1, i.cible / i.valeur) : Math.min(1, i.valeur / i.cible);
        var ton = bon ? 'bon' : ratio >= 0.85 ? 'neutre' : 'mauvais';
        var couleurJauge = bon ? 'var(--succes)' : ratio >= 0.85 ? 'var(--alerte)' : 'var(--erreur)';
        var tendBon = i.tendance === 'stable' ? 'neutre' : (i.tendance === 'hausse') !== inverse ? 'bon' : 'mauvais';
        return el('tr', {}, [
          el('td', { class: 'fort', text: i.libelle }),
          el('td', { class: 'num chiffres', text: i.valeur + (i.unite && i.unite.charAt(0) !== '/' ? ' ' + i.unite : i.unite) }),
          el('td', { class: 'num chiffres secondaire', text: i.cible + (i.unite && i.unite.charAt(0) !== '/' ? ' ' + i.unite : i.unite) }),
          el('td', {}, el('span', { class: 'ind-jauge' }, [jauge(inverse ? i.cible : i.valeur, inverse ? i.valeur : i.cible, { couleur: couleurJauge, max: inverse ? Math.max(i.valeur, i.cible) : i.cible }), el('span', { class: 'chiffres', text: Math.round(ratio * 100) + ' %' })])),
          el('td', {}, el('span', { class: 'ind-ecart ' + ton }, [icone(bon ? 'i-ok' : 'i-alerte'), (ecart > 0 ? '+' : '') + ecart])),
          el('td', {}, sparkline(i.historique, { w: 80, h: 20, ton: tendBon, cible: i.cible })),
        ]);
      })),
    ]);
    grille.appendChild(panneau('indicateurs', 'Indicateurs SMSI', { compteur: F.indicateurs.length, classe: 'col-8', sansMarge: true, sous: 'revue de direction' }, el('div', { class: 'tableau-enveloppe' }, tabInd)));

    racine.appendChild(grille);
    return racine;
  }

  /* ================================================================== ÉCRAN : LISTE DES AUDITS */
  var COLONNES = [
    { cle: 'id', libelle: 'Réf.', tri: true },
    { cle: 'nom', libelle: 'Audit', tri: true },
    { cle: 'type', libelle: 'Type', tri: true },
    { cle: 'referentiel', libelle: 'Référentiel', tri: true },
    { cle: 'site', libelle: 'Site', tri: true },
    { cle: 'responsable', libelle: 'Responsable', tri: true },
    { cle: 'debut', libelle: 'Début', tri: true },
    { cle: 'statut', libelle: 'Statut', tri: true },
    { cle: 'nbConstats', libelle: 'Constats', tri: true, num: true },
    { cle: 'progression', libelle: 'Avancement', tri: true },
  ];
  var PAR_PAGE = 10;

  function auditsFiltres() {
    var L = etat.liste;
    var q = normaliser(L.recherche);
    var liste = F.audits.filter(function (a) {
      if (L.statut.length && L.statut.indexOf(a.statut) < 0) return false;
      if (L.type.length && L.type.indexOf(a.type) < 0) return false;
      if (L.referentiel.length && L.referentiel.indexOf(a.referentiel) < 0) return false;
      if (q) {
        var texte = normaliser([a.id, a.nom, a.type, a.site, a.statut, F.utilisateur(a.responsable).nom, F.referentiel(a.referentiel).libelle, a.auditeur, a.perimetre].join(' '));
        if (texte.indexOf(q) < 0) return false;
      }
      return true;
    });
    var cle = L.tri;
    var sens = L.sens === 'asc' ? 1 : -1;
    liste.sort(function (a, b) {
      var va = a[cle];
      var vb = b[cle];
      if (cle === 'responsable') { va = F.utilisateur(va).nom; vb = F.utilisateur(vb).nom; }
      if (cle === 'referentiel') { va = F.referentiel(va).court; vb = F.referentiel(vb).court; }
      if (cle === 'statut') { va = F.vocabulaire.statutsAudit.indexOf(va); vb = F.vocabulaire.statutsAudit.indexOf(vb); }
      if (typeof va === 'number') return (va - vb) * sens;
      return String(va).localeCompare(String(vb), 'fr') * sens;
    });
    return liste;
  }

  function menuFiltre(cle, libelle, valeurs, libelleDe) {
    var L = etat.liste;
    var conteneur = el('div', { class: 'menu-filtre' });
    var idMenu = 'menu-' + cle;
    var btn = el('button', { class: 'btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': idMenu }, [
      icone('i-filtre'), libelle,
      L[cle].length ? el('span', { class: 'compteur-filtre', text: String(L[cle].length) }) : null,
      icone('i-chevron'),
    ]);
    var ul = el('ul', { class: 'menu-liste', id: idMenu, role: 'group', 'aria-label': 'Filtrer par ' + libelle.toLowerCase() });
    ul.hidden = true;
    var comptes = F.compterPar(F.audits, cle);
    valeurs.forEach(function (v) {
      var cb = el('input', { type: 'checkbox', value: v });
      cb.checked = L[cle].indexOf(v) >= 0;
      cb.addEventListener('change', function () {
        if (cb.checked) L[cle].push(v);
        else L[cle] = L[cle].filter(function (x) { return x !== v; });
        L.page = 1;
        rendreListe();
      });
      ul.appendChild(el('li', {}, el('label', {}, [cb, libelleDe ? libelleDe(v) : v, el('span', { class: 'compte', text: String(comptes[v] || 0) })])));
    });
    var pied = el('div', { class: 'menu-pied' }, [
      el('button', { type: 'button', text: 'Tout effacer', onclick: function () { L[cle] = []; L.page = 1; rendreListe(); } }),
      el('button', { type: 'button', text: 'Fermer', onclick: function () { fermerMenu(); btn.focus(); } }),
    ]);
    ul.appendChild(el('li', {}, pied));
    function fermerMenu() {
      ul.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', exterieur, true);
      document.removeEventListener('keydown', echap, true);
    }
    function exterieur(e) { if (!conteneur.contains(e.target)) fermerMenu(); }
    function echap(e) { if (e.key === 'Escape') { fermerMenu(); btn.focus(); } }
    btn.addEventListener('click', function () {
      var ouvert = ul.hidden;
      document.querySelectorAll('.menu-liste').forEach(function (m) { m.hidden = true; });
      document.querySelectorAll('.menu-filtre .btn[aria-expanded]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (ouvert) {
        ul.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        setTimeout(function () {
          document.addEventListener('click', exterieur, true);
          document.addEventListener('keydown', echap, true);
        }, 0);
        var premier = ul.querySelector('input');
        if (premier) premier.focus();
      } else fermerMenu();
    });
    conteneur.appendChild(btn);
    conteneur.appendChild(ul);
    return conteneur;
  }

  var listeConteneur = null;
  function rendreListe() {
    if (!listeConteneur) return;
    var L = etat.liste;
    var liste = auditsFiltres();
    var pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    if (L.page > pages) L.page = pages;
    var page = liste.slice((L.page - 1) * PAR_PAGE, L.page * PAR_PAGE);
    vider(listeConteneur);

    /* Barre d'outils */
    var recherche = el('input', { type: 'search', placeholder: 'Rechercher (nom, site, responsable…)', 'aria-label': 'Rechercher dans les audits', value: L.recherche, id: 'recherche-audits' });
    recherche.addEventListener('input', function () {
      L.recherche = recherche.value;
      L.page = 1;
      /* Rendu partiel : on ne re-rend que le tableau et la pagination pour garder le focus. */
      rendreTableau();
    });
    var compteResultats = el('span', { class: 'resultat-compte', id: 'compte-resultats', 'aria-live': 'polite' });
    var densite = el('div', { class: 'groupe-btn', role: 'group', 'aria-label': 'Densité des lignes' });
    [['compact', 'Compact', '28 px'], ['normal', 'Normal', '32 px'], ['confort', 'Confort', '40 px']].forEach(function (d) {
      densite.appendChild(el('button', { class: 'btn', type: 'button', 'aria-pressed': String(etat.densite === d[0]), title: d[2], text: d[1], onclick: function () { etat.densite = d[0]; rendreListe(); } }));
    });
    var outils = el('div', { class: 'outils' }, [
      el('label', { class: 'champ-recherche', for: 'recherche-audits' }, [icone('i-recherche'), recherche]),
      menuFiltre('statut', 'Statut', F.vocabulaire.statutsAudit),
      menuFiltre('type', 'Type', F.vocabulaire.typesAudit),
      menuFiltre('referentiel', 'Référentiel', F.referentiels.map(function (r) { return r.id; }), function (id) { return F.referentiel(id).libelle; }),
      el('span', { class: 'espace' }),
      compteResultats,
      densite,
      el('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Choisir les colonnes', title: 'Colonnes', onclick: function () { toast('info', 'Choix des colonnes', 'Non maquetté : les dix colonnes restent affichées.'); } }, icone('i-colonnes')),
    ]);
    listeConteneur.appendChild(outils);

    /* Jetons de filtres actifs */
    var actifs = [];
    ['statut', 'type', 'referentiel'].forEach(function (cle) {
      L[cle].forEach(function (v) { actifs.push({ cle: cle, v: v, lib: cle === 'referentiel' ? F.referentiel(v).court : v }); });
    });
    if (actifs.length) {
      var jetons = el('div', { class: 'outils filtres-actifs' });
      actifs.forEach(function (a) {
        jetons.appendChild(el('span', { class: 'jeton' }, [a.lib, el('button', { type: 'button', 'aria-label': 'Retirer le filtre ' + a.lib, onclick: function () { L[a.cle] = L[a.cle].filter(function (x) { return x !== a.v; }); L.page = 1; rendreListe(); } }, icone('i-fermer'))]));
      });
      jetons.appendChild(el('button', { class: 'btn btn-discret', type: 'button', text: 'Réinitialiser', onclick: function () { L.statut = []; L.type = []; L.referentiel = []; L.recherche = ''; L.page = 1; rendreListe(); } }));
      listeConteneur.appendChild(jetons);
    }

    var zoneTableau = el('div', { id: 'zone-tableau' });
    listeConteneur.appendChild(zoneTableau);

    function rendreTableau() {
      liste = auditsFiltres();
      pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
      if (L.page > pages) L.page = pages;
      page = liste.slice((L.page - 1) * PAR_PAGE, L.page * PAR_PAGE);
      vider(zoneTableau);
      compteResultats.textContent = liste.length + ' audit' + (liste.length > 1 ? 's' : '') + (liste.length !== F.audits.length ? ' sur ' + F.audits.length : '');

      var thead = el('thead', {}, el('tr', {}, COLONNES.map(function (c) {
        var th = el('th', { scope: 'col', class: c.num ? 'num' : null });
        if (L.tri === c.cle) th.setAttribute('aria-sort', L.sens === 'asc' ? 'ascending' : 'descending');
        var b = el('button', { class: 'btn-tri', type: 'button', 'aria-label': 'Trier par ' + c.libelle + (L.tri === c.cle ? (L.sens === 'asc' ? ', croissant' : ', décroissant') : '') }, [c.libelle, icone(L.tri === c.cle ? (L.sens === 'asc' ? 'i-haut' : 'i-bas') : 'i-tri')]);
        b.addEventListener('click', function () {
          if (L.tri === c.cle) L.sens = L.sens === 'asc' ? 'desc' : 'asc';
          else { L.tri = c.cle; L.sens = c.cle === 'debut' || c.cle === 'nbConstats' || c.cle === 'progression' ? 'desc' : 'asc'; }
          L.page = 1;
          rendreTableau();
          var nb = zoneTableau.querySelector('th[aria-sort] .btn-tri');
          if (nb) nb.focus();
        });
        th.appendChild(b);
        return th;
      })));
      var tbody = el('tbody');
      if (!page.length) {
        tbody.appendChild(el('tr', {}, el('td', { colspan: COLONNES.length, class: 'cellule-vide' }, etatVide('Aucun audit ne correspond', 'Modifiez la recherche ou retirez un filtre.', 'Réinitialiser les filtres', function () { L.statut = []; L.type = []; L.referentiel = []; L.recherche = ''; rendreListe(); }))));
      }
      page.forEach(function (a) {
        var tr = el('tr', { class: 'cliquable' });
        tr.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          location.hash = '#/audit/' + a.id;
        });
        var def = STATUT_AUDIT[a.statut];
        var clsProg = a.statut === 'Clos' ? 'succes' : a.statut === 'Reporté' ? 'ambre' : '';
        tr.appendChild(el('td', { class: 'id', text: a.id }));
        tr.appendChild(el('td', { class: 'tronque fort', title: a.nom }, el('a', { class: 'lien-ligne', href: '#/audit/' + a.id, text: a.nom })));
        tr.appendChild(el('td', { class: 'secondaire', text: a.type }));
        tr.appendChild(el('td', {}, pastilleRef(a.referentiel)));
        tr.appendChild(el('td', { class: 'secondaire tronque site', title: a.site }, el('span', { text: a.site })));
        tr.appendChild(el('td', {}, personne(a.responsable, true)));
        tr.appendChild(el('td', { class: 'chiffres secondaire', text: F.fr(a.debut) }));
        tr.appendChild(el('td', {}, pastille(a.statut, def)));
        tr.appendChild(el('td', { class: 'num chiffres', text: a.nbConstats ? String(a.nbConstats) : '—' }));
        tr.appendChild(el('td', {}, celluleProgression(a.progression, clsProg)));
        tbody.appendChild(tr);
      });
      var table = el('table', { class: 'tableau ' + etat.densite, 'aria-label': 'Liste des audits', 'aria-rowcount': liste.length }, [thead, tbody]);
      var env = el('div', { class: 'tableau-enveloppe' }, table);
      env.style.setProperty('--hauteur-max-tableau', 'calc(100vh - 230px)');
      zoneTableau.appendChild(env);

      /* Pagination */
      var pagination = el('nav', { class: 'pagination', 'aria-label': 'Pagination' });
      pagination.appendChild(el('button', { type: 'button', 'aria-label': 'Page précédente', disabled: L.page === 1, onclick: function () { L.page--; rendreTableau(); } }, icone('i-chevron-droite', 'retour')));
      pagination.lastChild.firstChild.style.setProperty('transform', 'rotate(180deg)');
      for (var p = 1; p <= pages; p++) {
        if (pages > 7 && p > 2 && p < pages - 1 && Math.abs(p - L.page) > 1) {
          if (p === 3 || p === pages - 2) pagination.appendChild(el('span', { class: 'points', text: '…', 'aria-hidden': 'true' }));
          continue;
        }
        pagination.appendChild(el('button', { type: 'button', text: String(p), 'aria-current': L.page === p ? 'page' : null, 'aria-label': 'Page ' + p, onclick: (function (n) { return function () { L.page = n; rendreTableau(); }; })(p) }));
      }
      pagination.appendChild(el('button', { type: 'button', 'aria-label': 'Page suivante', disabled: L.page === pages, onclick: function () { L.page++; rendreTableau(); } }, icone('i-chevron-droite')));
      var debut = liste.length ? (L.page - 1) * PAR_PAGE + 1 : 0;
      var fin = Math.min(liste.length, L.page * PAR_PAGE);
      zoneTableau.appendChild(el('div', { class: 'panneau-pied' }, [
        el('span', { class: 'chiffres', text: debut + '–' + fin + ' sur ' + liste.length + ' · ' + PAR_PAGE + ' par page' }),
        pagination,
      ]));
    }
    rendreTableau();
  }

  function etatVide(titre, texte, action, surAction) {
    var ill = svg('svg', { class: 'illustration', viewBox: '0 0 120 72', 'aria-hidden': 'true' });
    ill.appendChild(svg('rect', { class: 'dalle', x: 14, y: 10, width: 92, height: 52, rx: 6 }));
    ill.appendChild(svg('line', { class: 'ligne', x1: 26, x2: 70, y1: 24, y2: 24 }));
    ill.appendChild(svg('line', { class: 'ligne', x1: 26, x2: 94, y1: 36, y2: 36 }));
    ill.appendChild(svg('line', { class: 'ligne', x1: 26, x2: 58, y1: 48, y2: 48 }));
    ill.appendChild(svg('circle', { class: 'accent', cx: 92, cy: 50, r: 12 }));
    ill.appendChild(svg('path', { d: 'M87 50h10M92 45v10', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    return el('div', { class: 'etat-vide' }, [
      ill,
      el('h3', { text: titre }),
      el('p', { text: texte }),
      action ? el('button', { class: 'btn', type: 'button', text: action, onclick: surAction }) : null,
    ]);
  }

  function ecranAudits() {
    majFil([{ texte: 'Audits' }]);
    var racine = el('div', { class: 'ecran ecran-audits' });
    var K = F.kpi;
    racine.appendChild(
      el('div', { class: 'entete-ecran' }, [
        el('div', { class: 'titres' }, [
          el('h1', {}, ['Audits', el('span', { class: 'pastille neutre' }, [icone('i-liste'), F.audits.length + ' au total'])]),
          el('p', { class: 'sous-titre', text: K.auditsEnCours + ' en cours ou en attente de rapport · ' + K.auditsAVenir + ' à venir · ' + (K.parStatutAudit['Clos'] || 0) + ' clos' }),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn', type: 'button', onclick: function () { toast('succes', 'Export CSV généré', auditsFiltres().length + ' lignes exportées avec les filtres courants.'); } }, [icone('i-lien'), 'Exporter']),
          el('a', { class: 'btn btn-primaire', href: '#/formulaire' }, [icone('i-plus'), 'Nouvel audit']),
        ]),
      ]),
    );
    listeConteneur = el('section', { class: 'panneau', 'aria-label': 'Tableau des audits' });
    racine.appendChild(listeConteneur);
    rendreListe();
    return racine;
  }

  /* ================================================================== ÉCRAN : FICHE AUDIT */
  function ecranAudit(id) {
    var a = F.audit(id);
    if (!a) {
      majFil([{ texte: 'Audits', href: '#/audits' }, { texte: 'Introuvable' }]);
      return el('div', { class: 'ecran' }, el('section', { class: 'panneau' }, etatVide('Audit introuvable', 'L’identifiant « ' + id + ' » ne correspond à aucun audit.', 'Retour à la liste', function () { location.hash = '#/audits'; })));
    }
    majFil([{ texte: 'Audits', href: '#/audits' }, { texte: a.id + ' · ' + a.nom }]);
    var constats = F.constatsDe(a.id);
    var actions = F.actionsDe(a.id);
    var historique = F.historiqueAudit(a);
    var racine = el('div', { class: 'ecran ecran-audit' });
    var resp = F.utilisateur(a.responsable);
    var def = STATUT_AUDIT[a.statut];

    racine.appendChild(
      el('div', { class: 'entete-ecran' }, [
        el('div', { class: 'titres' }, [
          el('h1', {}, [el('span', { class: 'mono', text: a.id }), a.nom, pastille(a.statut, def), pastilleRef(a.referentiel), pastille(a.type, { classe: 'neutre', icone: 'i-fiche' }, true)]),
          el('dl', { class: 'meta-ligne' }, [
            el('div', {}, [el('dt', { text: 'Du' }), el('dd', { text: F.frLong(a.debut) }), el('dt', { text: 'au' }), el('dd', { text: F.frLong(a.fin) })]),
            el('div', {}, [el('dt', { text: 'Site' }), el('dd', { text: a.site })]),
            el('div', {}, [el('dt', { text: 'Responsable' }), el('dd', {}, personne(a.responsable, true))]),
            el('div', {}, [el('dt', { text: 'Auditeur' }), el('dd', { text: a.auditeur })]),
            el('div', {}, [el('dt', { text: 'Criticité max.' }), el('dd', {}, pastille(a.criticite, CRITICITE[a.criticite]))]),
          ]),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn', type: 'button', text: 'Modifier', onclick: function () { location.hash = '#/formulaire'; } }),
          el('button', { class: 'btn', type: 'button', onclick: function () { toast('info', 'Rapport', 'Génération du rapport d’audit simulée.'); } }, [icone('i-fiche'), 'Rapport']),
          el('button', { class: 'btn btn-danger', type: 'button', text: 'Clore l’audit', onclick: function () { modaleCloture(a); } }),
        ]),
      ]),
    );

    var panneauFiche = el('section', { class: 'panneau', 'aria-label': 'Détail de l’audit' });
    var ouverts = constats.filter(function (c) { return c.statut !== 'Clos'; }).length;
    var retard = actions.filter(function (x) { return x.statut !== 'Terminée' && F.daysUntil(x.echeance) < 0; }).length;
    var avancementMoyen = actions.length ? Math.round(actions.reduce(function (s, x) { return s + x.avancement; }, 0) / actions.length) : 0;

    panneauFiche.appendChild(
      el('div', { class: 'fiche-entete' }, [
        el('div', { class: 'stats-ligne' }, [
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Constats' }), el('div', { class: 'val' }, [String(constats.length), el('small', { text: ouverts + ' ouverts' })])]),
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Non-conformités' }), el('div', { class: 'val' }, [String(constats.filter(function (c) { return c.type.indexOf('NC') === 0; }).length)])]),
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Actions' }), el('div', { class: 'val' }, [String(actions.length), el('small', { text: retard + ' en retard' })])]),
          el('div', { class: 'stat' }, [el('div', { class: 'lib', text: 'Avancement actions' }), el('div', { class: 'val' }, [avancementMoyen + ' %'])]),
        ]),
        el('div', { class: 'fiche-progression' }, [
          el('div', { class: 'ligne' }, [el('span', { text: 'Progression de l’audit' }), el('strong', { text: a.progression + ' %' })]),
          progression(a.progression, a.statut === 'Clos' ? 'succes' : ''),
          el('div', { class: 'ligne' }, [el('span', { text: 'Fin prévue ' + F.fr(a.fin) }), el('span', { text: F.daysUntil(a.fin) >= 0 ? 'dans ' + F.daysUntil(a.fin) + ' j' : 'il y a ' + -F.daysUntil(a.fin) + ' j' })]),
        ]),
      ]),
    );

    /* Onglets */
    var onglets = [
      { id: 'synthese', libelle: 'Synthèse' },
      { id: 'constats', libelle: 'Constats', compteur: constats.length },
      { id: 'actions', libelle: 'Plan d’actions', compteur: actions.length },
      { id: 'historique', libelle: 'Historique', compteur: historique.length },
    ];
    var listeOnglets = el('div', { class: 'onglets', role: 'tablist', 'aria-label': 'Sections de la fiche' });
    var indicateur = el('span', { class: 'onglets-indicateur', 'aria-hidden': 'true' });
    var panneauxOnglets = {};
    var boutons = {};
    onglets.forEach(function (o) {
      var b = el('button', { class: 'onglet', type: 'button', role: 'tab', id: 'onglet-' + o.id, 'aria-selected': 'false', 'aria-controls': 'panneau-' + o.id, tabindex: '-1' }, [o.libelle, o.compteur !== undefined ? el('span', { class: 'compteur', text: String(o.compteur) }) : null]);
      b.addEventListener('click', function () { activerOnglet(o.id); });
      b.addEventListener('keydown', function (e) {
        var idx = onglets.findIndex(function (x) { return x.id === o.id; });
        var cible = null;
        if (e.key === 'ArrowRight') cible = onglets[(idx + 1) % onglets.length];
        if (e.key === 'ArrowLeft') cible = onglets[(idx - 1 + onglets.length) % onglets.length];
        if (e.key === 'Home') cible = onglets[0];
        if (e.key === 'End') cible = onglets[onglets.length - 1];
        if (cible) { e.preventDefault(); activerOnglet(cible.id); boutons[cible.id].focus(); }
      });
      boutons[o.id] = b;
      listeOnglets.appendChild(b);
    });
    listeOnglets.appendChild(indicateur);
    panneauFiche.appendChild(listeOnglets);

    panneauxOnglets.synthese = el('div', { role: 'tabpanel', id: 'panneau-synthese', 'aria-labelledby': 'onglet-synthese', tabindex: '0', class: 'panneau-corps' }, [
      el('div', { class: 'grille' }, [
        el('div', { class: 'col-7' }, [
          el('h3', { class: 'nav-titre', text: 'Description' }),
          el('dl', { class: 'description-liste' }, [
            el('dt', { text: 'Objet' }), el('dd', { text: a.description }),
            el('dt', { text: 'Périmètre' }), el('dd', { text: a.perimetre }),
            el('dt', { text: 'Référentiel' }), el('dd', { text: F.referentiel(a.referentiel).libelle }),
            el('dt', { text: 'Type' }), el('dd', { text: a.type }),
            el('dt', { text: 'Durée' }), el('dd', { text: (F.daysUntil(a.fin) - F.daysUntil(a.debut) + 1) + ' jour(s) sur site' }),
            el('dt', { text: 'Responsable' }), el('dd', { text: resp.nom + ' (' + resp.role + ')' }),
          ]),
        ]),
        el('div', { class: 'col-5' }, [
          el('h3', { class: 'nav-titre', text: 'Constats par criticité' }),
          graphiqueColonnes(
            ['Critique', 'Majeure', 'Mineure', 'Observation'].map(function (c) { return { libelle: c, court: c, valeur: constats.filter(function (x) { return x.criticite === c; }).length, couleur: CRITICITE[c].couleur }; }),
            { label: 'Constats de l’audit par criticité', w: 320, h: 120 },
          ),
          el('h3', { class: 'nav-titre', text: 'Statut des constats' }),
          (function () {
            var ul = el('ul', { class: 'liste-barres' });
            F.vocabulaire.statutsConstat.forEach(function (s) {
              var n = constats.filter(function (c) { return c.statut === s; }).length;
              var li = el('li');
              var lib = el('span', { class: 'lib' }, [el('span', { text: s })]);
              var b = progression(pct(n, constats.length || 1), null, true);
              b.setAttribute('aria-label', s + ' : ' + n);
              b.style.setProperty('--progression-couleur', 'var(--' + (STATUT_CONSTAT[s].classe === 'neutre' ? 'donnee-observation' : STATUT_CONSTAT[s].classe) + ')');
              lib.appendChild(b);
              li.appendChild(lib);
              li.appendChild(el('span', { class: 'n', text: String(n) }));
              ul.appendChild(li);
            });
            return ul;
          })(),
        ]),
      ]),
    ]);

    var tabConstats = el('table', { class: 'tableau', 'aria-label': 'Constats de l’audit' }, [
      el('thead', {}, el('tr', {}, ['Réf.', 'Exigence', 'Constat', 'Type', 'Criticité', 'Statut', 'Responsable', 'Échéance'].map(function (h) { return el('th', { scope: 'col', text: h }); }))),
      el('tbody', {}, constats.length ? constats.map(function (c) {
        var j = F.daysUntil(c.echeance);
        return el('tr', {}, [
          el('td', { class: 'id', text: c.id }),
          el('td', { class: 'mono secondaire', text: c.ref }),
          el('td', { class: 'tronque fort', title: c.titre + ' — ' + c.description }, el('span', { text: c.titre })),
          el('td', { class: 'secondaire', text: c.type }),
          el('td', {}, pastille(c.criticite, CRITICITE[c.criticite])),
          el('td', {}, pastille(c.statut, STATUT_CONSTAT[c.statut], true)),
          el('td', {}, personne(c.responsable, true)),
          el('td', { class: 'chiffres' }, c.statut !== 'Clos' && j < 0 ? el('span', { class: 'ind-ecart mauvais' }, [icone('i-alerte'), F.fr(c.echeance) + ' (J' + j + ')']) : F.fr(c.echeance)),
        ]);
      }) : [el('tr', {}, el('td', { colspan: 8, class: 'cellule-vide' }, etatVide('Aucun constat', 'Les constats seront saisis après la réunion de clôture.')))]),
    ]);
    panneauxOnglets.constats = el('div', { role: 'tabpanel', id: 'panneau-constats', 'aria-labelledby': 'onglet-constats', tabindex: '0', class: 'panneau-corps sans-marge' }, el('div', { class: 'tableau-enveloppe' }, tabConstats));

    var tabActions = el('table', { class: 'tableau', 'aria-label': 'Plan d’actions' }, [
      el('thead', {}, el('tr', {}, ['Réf.', 'Action', 'Constat', 'Priorité', 'Statut', 'Responsable', 'Échéance', 'Charge', 'Avancement'].map(function (h) { return el('th', { scope: 'col', text: h }); }))),
      el('tbody', {}, actions.length ? actions.map(function (x) {
        var j = F.daysUntil(x.echeance);
        var enRetard = x.statut !== 'Terminée' && j < 0;
        return el('tr', {}, [
          el('td', { class: 'id', text: x.id }),
          el('td', { class: 'tronque fort', title: x.titre }, el('span', { text: x.titre })),
          el('td', { class: 'id', text: x.constatId }),
          el('td', {}, pastille(x.priorite, { classe: x.priorite === 'P1' ? 'erreur' : x.priorite === 'P2' ? 'alerte' : 'neutre', icone: 'i-point' }, true)),
          el('td', {}, pastille(x.statut, STATUT_ACTION[x.statut])),
          el('td', {}, personne(x.responsable, true)),
          el('td', { class: 'chiffres' }, enRetard ? el('span', { class: 'ind-ecart mauvais' }, [icone('i-alerte'), F.fr(x.echeance) + ' (J' + j + ')']) : F.fr(x.echeance)),
          el('td', { class: 'num chiffres secondaire', text: x.charge }),
          el('td', {}, celluleProgression(x.avancement, x.statut === 'Terminée' ? 'succes' : x.statut === 'Bloquée' ? 'erreur' : '')),
        ]);
      }) : [el('tr', {}, el('td', { colspan: 9, class: 'cellule-vide' }, etatVide('Aucune action', 'Le plan d’actions est arbitré après réception du rapport.')))]),
    ]);
    panneauxOnglets.actions = el('div', { role: 'tabpanel', id: 'panneau-actions', 'aria-labelledby': 'onglet-actions', tabindex: '0', class: 'panneau-corps sans-marge' }, el('div', { class: 'tableau-enveloppe' }, tabActions));

    var chrono = el('ol', { class: 'chrono' });
    historique.forEach(function (h) {
      var futur = F.daysUntil(h.quand) > 0;
      chrono.appendChild(el('li', {}, [
        el('span', { class: 'puce' + (futur ? ' futur' : ''), 'aria-hidden': 'true' }),
        el('span', { class: 'quand', text: F.fr(h.quand) }),
        el('span', { class: 'quoi', text: h.quoi }),
        el('span', {}, [personne(h.qui, true), futur ? pastille('à venir', { classe: 'neutre', icone: 'i-calendrier' }, true) : null]),
      ]));
    });
    panneauxOnglets.historique = el('div', { role: 'tabpanel', id: 'panneau-historique', 'aria-labelledby': 'onglet-historique', tabindex: '0', class: 'panneau-corps' }, chrono);

    Object.keys(panneauxOnglets).forEach(function (k) { panneauxOnglets[k].hidden = true; panneauFiche.appendChild(panneauxOnglets[k]); });

    function placerIndicateur() {
      var b = boutons[etat.ongletFiche];
      if (!b) return;
      var r = b.getBoundingClientRect();
      var rl = listeOnglets.getBoundingClientRect();
      indicateur.style.setProperty('--x', (r.left - rl.left) + 'px');
      indicateur.style.setProperty('--w', r.width);
    }
    function activerOnglet(idO, initial) {
      etat.ongletFiche = idO;
      onglets.forEach(function (o) {
        var actif = o.id === idO;
        boutons[o.id].setAttribute('aria-selected', String(actif));
        boutons[o.id].setAttribute('tabindex', actif ? '0' : '-1');
        panneauxOnglets[o.id].hidden = !actif;
        panneauxOnglets[o.id].classList.toggle('entree', actif && !initial);
      });
      placerIndicateur();
    }
    racine.appendChild(panneauFiche);
    requestAnimationFrame(function () { activerOnglet(etat.ongletFiche, true); });
    window.addEventListener('resize', placerIndicateur);
    return racine;
  }

  function modaleCloture(a) {
    ouvrirModale({
      titre: 'Clore l’audit ' + a.id + ' ?',
      danger: true,
      confirmer: 'Clore l’audit',
      corps: [
        el('p', {}, ['La clôture fige les constats de « ', el('strong', { text: a.nom }), ' » et notifie les responsables d’action. Cette opération est irréversible dans la maquette.']),
        el('dl', { class: 'recap' }, [
          el('dt', { text: 'Constats ouverts' }), el('dd', { text: String(F.constatsDe(a.id).filter(function (c) { return c.statut !== 'Clos'; }).length) }),
          el('dt', { text: 'Actions non terminées' }), el('dd', { text: String(F.actionsDe(a.id).filter(function (x) { return x.statut !== 'Terminée'; }).length) }),
          el('dt', { text: 'Responsable' }), el('dd', { text: F.utilisateur(a.responsable).nom }),
        ]),
      ],
      apres: function (ok) {
        if (ok) toast('succes', 'Audit clos', a.id + ' passe au statut « Clos » (simulation, aucune donnée modifiée).');
      },
    });
  }

  /* ================================================================== ÉCRAN : FORMULAIRE */
  function ecranFormulaire() {
    majFil([{ texte: 'Audits', href: '#/audits' }, { texte: 'Nouvel audit' }]);
    var racine = el('div', { class: 'ecran ecran-formulaire' });
    racine.appendChild(
      el('div', { class: 'entete-ecran' }, [
        el('div', { class: 'titres' }, [
          el('h1', { text: 'Nouvel audit' }),
          el('p', { class: 'sous-titre', text: 'Les champs marqués d’un astérisque sont obligatoires. La validation s’effectue à la sortie du champ et à l’envoi.' }),
        ]),
      ]),
    );
    var zoneMessage = el('div', { 'aria-live': 'polite' });
    var form = el('form', { class: 'formulaire', novalidate: true, 'aria-label': 'Création d’un audit' });

    var champs = [];
    function champ(opts) {
      var idC = 'champ-' + opts.nom;
      var idErr = idC + '-erreur';
      var idAide = idC + '-aide';
      var controle;
      if (opts.type === 'select') {
        controle = el('select', { id: idC, name: opts.nom });
        controle.appendChild(el('option', { value: '', text: opts.placeholder || 'Sélectionner…' }));
        opts.options.forEach(function (o) { controle.appendChild(el('option', { value: o.valeur, text: o.libelle })); });
      } else if (opts.type === 'textarea') {
        controle = el('textarea', { id: idC, name: opts.nom, rows: 3, placeholder: opts.placeholder || null });
      } else {
        controle = el('input', { id: idC, name: opts.nom, type: opts.type || 'text', placeholder: opts.placeholder || null });
      }
      controle.setAttribute('aria-describedby', (opts.aide ? idAide + ' ' : '') + idErr);
      if (opts.requis) controle.setAttribute('aria-required', 'true');
      var conteneur = el('div', { class: 'champ' + (opts.pleine ? ' pleine' : '') }, [
        el('label', { for: idC }, [opts.libelle, opts.requis ? el('span', { class: 'req', 'aria-hidden': 'true', text: '*' }) : el('span', { class: 'opt', text: '(facultatif)' })]),
        controle,
        opts.aide ? el('span', { class: 'aide', id: idAide, text: opts.aide }) : null,
        el('span', { class: 'erreur', id: idErr }, [icone('i-erreur'), el('span', { class: 'erreur-texte' })]),
      ]);
      var def = { opts: opts, controle: controle, conteneur: conteneur, erreurTexte: conteneur.querySelector('.erreur-texte') };
      controle.addEventListener('blur', function () { valider(def); });
      controle.addEventListener('input', function () { if (def.conteneur.classList.contains('invalide')) valider(def); });
      champs.push(def);
      return conteneur;
    }
    function valider(def) {
      var v = def.controle.value.trim();
      var msg = '';
      if (def.opts.requis && !v) msg = 'Ce champ est obligatoire.';
      else if (v && def.opts.verif) msg = def.opts.verif(v) || '';
      def.conteneur.classList.toggle('invalide', !!msg);
      def.controle.setAttribute('aria-invalid', msg ? 'true' : 'false');
      def.erreurTexte.textContent = msg;
      return !msg;
    }

    form.appendChild(champ({ nom: 'nom', libelle: 'Nom de l’audit', requis: true, placeholder: 'Ex. : Audit interne — gestion des accès', aide: 'Nom court tel qu’il apparaîtra dans la liste et les rapports.', verif: function (v) { return v.length < 6 ? 'Saisissez au moins 6 caractères.' : ''; } }));
    form.appendChild(champ({ nom: 'type', libelle: 'Type', requis: true, type: 'select', options: F.vocabulaire.typesAudit.map(function (t) { return { valeur: t, libelle: t }; }) }));
    form.appendChild(champ({ nom: 'referentiel', libelle: 'Référentiel', requis: true, type: 'select', options: F.referentiels.map(function (r) { return { valeur: r.id, libelle: r.libelle }; }) }));
    form.appendChild(champ({ nom: 'site', libelle: 'Site', requis: true, type: 'select', options: F.sites.map(function (s) { return { valeur: s, libelle: s }; }) }));
    form.appendChild(champ({ nom: 'debut', libelle: 'Date de début', requis: true, type: 'date', aide: 'Format JJ/MM/AAAA via le sélecteur.' }));
    form.appendChild(champ({ nom: 'fin', libelle: 'Date de fin', requis: true, type: 'date', verif: function (v) {
      var d = form.querySelector('#champ-debut').value;
      return d && v < d ? 'La fin doit être postérieure ou égale au début.' : '';
    } }));
    form.appendChild(champ({ nom: 'responsable', libelle: 'Responsable interne', requis: true, type: 'select', options: F.utilisateurs.map(function (u) { return { valeur: u.id, libelle: u.nom + ' — ' + u.role }; }) }));
    form.appendChild(champ({ nom: 'auditeur', libelle: 'Auditeur', requis: false, placeholder: 'Organisme ou auditeur interne', aide: 'Laisser vide si non désigné.' }));
    form.appendChild(champ({ nom: 'perimetre', libelle: 'Périmètre', requis: true, type: 'select', options: ['Périmètre complet du SMSI', 'Hébergement des données de santé', 'Infrastructure et exploitation', 'Processus métier et support', 'Fournisseurs critiques'].map(function (p) { return { valeur: p, libelle: p }; }) }));
    form.appendChild(champ({ nom: 'courriel', libelle: 'Courriel de notification', requis: false, type: 'email', placeholder: 'prenom.nom@exemple.fr', verif: function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Adresse de courriel invalide.'; } }));
    form.appendChild(champ({ nom: 'description', libelle: 'Description', requis: false, type: 'textarea', pleine: true, placeholder: 'Objectifs, exigences couvertes, points d’attention…' }));
    form.appendChild(el('div', { class: 'champ pleine' }, [
      el('label', { class: 'champ-case' }, [el('input', { type: 'checkbox', name: 'convocations' }), 'Envoyer les convocations aux pilotes de processus à la création']),
    ]));

    var resume = el('span', { class: 'resume-erreurs', hidden: true });
    var btnEnvoyer = el('button', { class: 'btn btn-primaire', type: 'submit' }, [icone('i-ok'), 'Créer l’audit']);
    var btnAnnuler = el('button', { class: 'btn', type: 'button', text: 'Annuler', onclick: function () { location.hash = '#/audits'; } });
    var btnBrouillon = el('button', { class: 'btn btn-discret', type: 'button', text: 'Enregistrer le brouillon', onclick: function () { toast('info', 'Brouillon enregistré', 'Simulation : aucune donnée n’est conservée.'); } });
    form.appendChild(el('div', { class: 'formulaire-pied' }, [resume, btnBrouillon, btnAnnuler, btnEnvoyer]));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var invalides = champs.filter(function (d) { return !valider(d); });
      vider(zoneMessage);
      if (invalides.length) {
        resume.hidden = false;
        vider(resume);
        resume.appendChild(icone('i-erreur'));
        resume.appendChild(document.createTextNode(pluriel(invalides.length, 'champ') + ' à corriger'));
        zoneMessage.appendChild(el('div', { class: 'bandeau erreur', role: 'alert' }, [icone('i-erreur'), el('div', {}, [el('strong', { text: 'Le formulaire contient ' + pluriel(invalides.length, 'erreur') + '.' }), el('p', { text: 'Premier champ en erreur : ' + invalides[0].opts.libelle + '.' })])]));
        invalides[0].controle.focus();
        toast('erreur', 'Formulaire incomplet', pluriel(invalides.length, 'champ') + ' à corriger avant l’envoi.');
        return;
      }
      resume.hidden = true;
      btnEnvoyer.disabled = true;
      vider(btnEnvoyer);
      btnEnvoyer.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' }));
      btnEnvoyer.appendChild(document.createTextNode('Création en cours…'));
      btnEnvoyer.setAttribute('aria-busy', 'true');
      setTimeout(function () {
        btnEnvoyer.disabled = false;
        btnEnvoyer.removeAttribute('aria-busy');
        vider(btnEnvoyer);
        btnEnvoyer.appendChild(icone('i-ok'));
        btnEnvoyer.appendChild(document.createTextNode('Créer l’audit'));
        var nom = form.querySelector('#champ-nom').value;
        zoneMessage.appendChild(el('div', { class: 'bandeau succes', role: 'status' }, [icone('i-cercle-ok'), el('div', {}, [el('strong', { text: 'Audit créé (simulation)' }), el('p', {}, ['« ' + nom + ' » recevrait l’identifiant AUD-37. ', el('a', { href: '#/audits', text: 'Voir la liste' }), '.'])])]));
        toast('succes', 'Audit créé', '« ' + nom + ' » ajouté au portefeuille (simulation).');
        form.reset();
        champs.forEach(function (d) { d.conteneur.classList.remove('invalide'); d.controle.setAttribute('aria-invalid', 'false'); });
        zoneMessage.firstChild.setAttribute('tabindex', '-1');
        zoneMessage.firstChild.focus();
      }, reduit ? 300 : 1100);
    });

    var panneauForm = el('section', { class: 'panneau', 'aria-label': 'Formulaire de création' }, [
      el('header', { class: 'panneau-entete' }, [el('h2', { text: 'Informations générales' }), el('span', { class: 'sous', text: 'Étape 1 sur 2 · planification' })]),
      el('div', { class: 'panneau-corps' }, [zoneMessage, form]),
    ]);
    racine.appendChild(el('div', { class: 'grille' }, [
      el('div', { class: 'col-8' }, panneauForm),
      el('div', { class: 'col-4' }, [
        panneau('aide-form', 'Repères', { sous: 'portefeuille actuel' }, [
          el('dl', { class: 'description-liste' }, [
            el('dt', { text: 'Audits planifiés' }), el('dd', { text: String(F.kpi.parStatutAudit['Planifié'] || 0) }),
            el('dt', { text: 'Prochain audit' }), el('dd', { text: 'AUD-08 · ' + F.fr(F.audit('AUD-08').debut) }),
            el('dt', { text: 'Référentiel dominant' }), el('dd', { text: 'ISO 27001:2022 (' + F.compterPar(F.audits, 'referentiel').iso + ' audits)' }),
            el('dt', { text: 'Sites couverts' }), el('dd', { text: Object.keys(F.compterPar(F.audits, 'site')).length + ' sur ' + F.sites.length }),
          ]),
        ]),
        panneau('conseils', 'Conseils de saisie', {}, el('ul', { class: 'liste-points' }, [
          el('li', { text: 'Un audit de certification dure quatre jours ; une surveillance, deux.' }),
          el('li', { text: 'Le responsable interne reçoit les convocations et le rapport.' }),
          el('li', { text: 'Le périmètre conditionne les exigences proposées pour les constats.' }),
        ])),
      ]),
    ]));
    return racine;
  }

  /* ================================================================== ÉCRAN : RETEX */
  function ecranRetex() {
    var inc = F.incidents[0];
    majFil([{ texte: 'Résilience' }, { texte: 'RETEX ' + inc.id }]);
    var racine = el('div', { class: 'ecran ecran-retex' });
    var R = etat.retex;
    var n = inc.evenements.length;
    var pilote = F.utilisateur(inc.pilote);
    var duree = Math.round((new Date(inc.fin) - new Date(inc.debut)) / 3600000);

    racine.appendChild(
      el('div', { class: 'entete-ecran' }, [
        el('div', { class: 'titres' }, [
          el('h1', {}, [el('span', { class: 'mono', text: inc.id }), inc.titre, pastille('Gravité max. ' + F.vocabulaire.gravitesRetex[inc.graviteMax], GRAVITE[inc.graviteMax])]),
          el('dl', { class: 'meta-ligne' }, [
            el('div', {}, [el('dt', { text: 'Début' }), el('dd', { text: heureCourte(inc.debut) })]),
            el('div', {}, [el('dt', { text: 'Fin' }), el('dd', { text: heureCourte(inc.fin) })]),
            el('div', {}, [el('dt', { text: 'Durée' }), el('dd', { text: duree + ' h' })]),
            el('div', {}, [el('dt', { text: 'Pilote' }), el('dd', {}, personne(inc.pilote, true))]),
            el('div', {}, [el('dt', { text: 'Événements' }), el('dd', { text: String(n) })]),
          ]),
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn', type: 'button', onclick: function () { toast('info', 'Autre incident', 'INC-2026-009 non maquetté dans cette vue.'); } }, [icone('i-liste'), 'Autres incidents']),
          el('button', { class: 'btn btn-primaire', type: 'button', onclick: function () { toast('succes', 'Fiche RETEX exportée', 'Export PDF simulé.'); } }, [icone('i-lien'), 'Exporter le RETEX']),
        ]),
      ]),
    );

    var liste = el('ol', { class: 'retex-liste', 'aria-label': 'Chronologie de l’incident' });
    var points = [];
    inc.evenements.forEach(function (ev, i) {
      var g = GRAVITE[ev.gravite];
      var li = el('li', { class: 'retex-point', id: 'retex-point-' + i, tabindex: '-1', 'aria-label': 'Point ' + (i + 1) + ' sur ' + n + ' : ' + ev.titre });
      li.appendChild(el('span', { class: 'puce', 'aria-hidden': 'true', text: String(i + 1) }));
      li.appendChild(el('div', { class: 'ligne1' }, [
        el('span', { class: 'heure', text: heureCourte(ev.h) }),
        el('span', { class: 'type', text: ev.type }),
        pastille(F.vocabulaire.gravitesRetex[ev.gravite], g),
      ]));
      li.appendChild(el('h3', { text: ev.titre }));
      li.appendChild(el('div', { class: 'detail' }, el('div', {}, [
        el('p', { text: ev.detail }),
        el('span', { class: 'acteur' }, [personne(ev.acteur, true), ' · ' + F.utilisateur(ev.acteur).role]),
      ])));
      li.addEventListener('click', function () { reveler(i + 1, true); });
      points.push(li);
      liste.appendChild(li);
    });

    var avancement = progression(0, '', true);
    avancement.style.setProperty('width', '120px');
    var compteur = el('span', { class: 'chiffres', 'aria-live': 'polite', text: '0 / ' + n });
    var btnSuivant = el('button', { class: 'btn btn-primaire', type: 'button' }, [icone('i-fleche-d'), 'Point suivant']);
    var btnTout = el('button', { class: 'btn', type: 'button' }, [icone('i-double'), 'Tout dérouler']);
    var btnReset = el('button', { class: 'btn btn-discret', type: 'button' }, [icone('i-reset'), 'Réinitialiser']);
    btnSuivant.addEventListener('click', function () { reveler(R.revele + 1, true); });
    btnTout.addEventListener('click', function () { reveler(n, true); });
    btnReset.addEventListener('click', function () { reveler(0, false); btnSuivant.focus(); });

    /* Courbe de gravité */
    var gravites = inc.evenements.map(function (e) { return e.gravite; });
    var courbe = graphiqueColonnes(
      inc.evenements.map(function (e, i) { return { libelle: e.type + ' (' + heureCourte(e.h).slice(11) + ')', court: String(i + 1), valeur: e.gravite, couleur: ['var(--donnee-observation)', 'var(--succes)', 'var(--donnee-mineure)', 'var(--donnee-majeure)', 'var(--donnee-critique)'][e.gravite] }; }),
      { label: 'Gravité par événement', w: 288, h: 96 },
    );

    function reveler(k, focus) {
      k = Math.max(0, Math.min(n, k));
      R.revele = k;
      points.forEach(function (li, i) {
        li.classList.toggle('revele', i < k);
        li.classList.toggle('courant', i === k - 1);
        li.setAttribute('aria-current', i === k - 1 ? 'step' : 'false');
      });
      avancement.style.setProperty('--valeur', pct(k, n));
      avancement.setAttribute('aria-valuenow', pct(k, n));
      compteur.textContent = k + ' / ' + n;
      btnSuivant.disabled = k >= n;
      btnTout.disabled = k >= n;
      btnReset.disabled = k === 0;
      if (focus && k > 0) {
        points[k - 1].focus({ preventScroll: true });
        points[k - 1].scrollIntoView({ block: 'nearest', behavior: reduit ? 'auto' : 'smooth' });
      }
      if (k === n && focus) toast('succes', 'Chronologie complète', 'Les ' + n + ' points de l’incident sont déroulés.');
    }
    liste.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveler(R.revele + 1, true); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); reveler(R.revele - 1, true); }
      if (e.key === 'Home') { e.preventDefault(); reveler(1, true); }
      if (e.key === 'End') { e.preventDefault(); reveler(n, true); }
    });

    var panneauChrono = el('section', { class: 'panneau', 'aria-label': 'Chronologie déroulable' }, [
      el('header', { class: 'panneau-entete' }, [
        el('h2', {}, ['Chronologie', el('span', { class: 'compteur', text: String(n) })]),
        el('span', { class: 'sous', text: 'Flèches ou Entrée pour avancer' }),
      ]),
      el('div', { class: 'panneau-corps' }, [
        el('div', { class: 'retex-outils' }, [btnSuivant, btnTout, btnReset, el('span', { class: 'espace' }), el('span', { class: 'avancement' }, [avancement, compteur])]),
        el('div', { class: 'visuellement-cache', text: 'Chaque point se déroule à la demande.' }),
        liste,
      ]),
    ]);

    var cote = el('div', { class: 'retex-cote' }, [
      panneau('retex-impact', 'Impact', {}, el('p', { text: inc.impact })),
      panneau('retex-gravite', 'Gravité par événement', { sous: '0 à 4' }, [
        courbe,
        el('ul', { class: 'legende' }, F.vocabulaire.gravitesRetex.map(function (gLib, i) {
          var li = el('li', {}, [el('span', { class: 'swatch', 'aria-hidden': 'true' }), gLib]);
          li.firstChild.style.setProperty('--c', ['var(--donnee-observation)', 'var(--succes)', 'var(--donnee-mineure)', 'var(--donnee-majeure)', 'var(--donnee-critique)'][i]);
          return li;
        })),
      ]),
      panneau('retex-enseignements', 'Enseignements', { compteur: inc.enseignements.length }, el('ol', { class: 'liste-points' }, inc.enseignements.map(function (t) { return el('li', { text: t }); }))),
      panneau('retex-acteurs', 'Acteurs mobilisés', {}, (function () {
        var ids = [];
        inc.evenements.forEach(function (e) { if (ids.indexOf(e.acteur) < 0) ids.push(e.acteur); });
        var ul = el('ul', { class: 'liste-barres' });
        ul.style.setProperty('--largeur-lib', '150px');
        ids.forEach(function (idU) {
          var nb = inc.evenements.filter(function (e) { return e.acteur === idU; }).length;
          var li = el('li');
          var lib = el('span', { class: 'lib' }, [el('span', { text: F.utilisateur(idU).nom })]);
          var b = progression(pct(nb, n) * 2, null, true);
          b.setAttribute('aria-label', F.utilisateur(idU).nom + ' : ' + nb + ' événements');
          lib.appendChild(b);
          li.appendChild(lib);
          li.appendChild(el('span', { class: 'n', text: String(nb) }));
          ul.appendChild(li);
        });
        return ul;
      })()),
    ]);

    racine.appendChild(el('div', { class: 'retex-grille' }, [panneauChrono, cote]));
    reveler(R.revele, false);
    return racine;
  }

  /* ================================================================== ÉCRAN : COMPOSANTS */
  function ecranComposants() {
    majFil([{ texte: 'Système' }, { texte: 'Composants' }]);
    var racine = el('div', { class: 'ecran ecran-composants' });
    racine.appendChild(
      el('div', { class: 'entete-ecran' }, [
        el('div', { class: 'titres' }, [
          el('h1', { text: 'Composants transverses' }),
          el('p', { class: 'sous-titre', text: 'Modale de confirmation, notifications, états vides, chargement, pastilles et boutons.' }),
        ]),
      ]),
    );
    var grille = el('div', { class: 'composants-grille' });

    /* Modale */
    grille.appendChild(panneau('c-modale', 'Modale de confirmation', { sous: 'role=dialog, focus piégé, Échap' }, [
      el('p', { class: 'sous-titre', text: 'La modale rend le focus à son déclencheur à la fermeture. Le clic sur le voile annule.' }),
      el('div', { class: 'rangee-boutons' }, [
        el('button', { class: 'btn btn-danger', type: 'button', id: 'btn-ouvrir-modale', text: 'Supprimer un audit…', onclick: function () {
          ouvrirModale({
            titre: 'Supprimer l’audit AUD-24 ?',
            danger: true,
            confirmer: 'Supprimer',
            corps: [el('p', {}, ['« ', el('strong', { text: F.audit('AUD-24').nom }), ' » et ses ', el('strong', { text: F.constatsDe('AUD-24').length + ' constats' }), ' seront supprimés. Cette action ne peut pas être annulée.'])],
            apres: function (ok) { toast(ok ? 'succes' : 'info', ok ? 'Audit supprimé' : 'Suppression annulée', ok ? 'AUD-24 retiré (simulation).' : 'Aucune modification.'); },
          });
        } }),
        el('button', { class: 'btn', type: 'button', text: 'Confirmer un envoi…', onclick: function () {
          ouvrirModale({
            titre: 'Envoyer les convocations ?',
            confirmer: 'Envoyer',
            corps: [el('p', { text: 'Sept pilotes de processus recevront la convocation à la réunion d’ouverture de l’audit AUD-08.' })],
            apres: function (ok) { if (ok) toast('succes', 'Convocations envoyées', '7 destinataires (simulation).'); },
          });
        } }),
      ]),
    ]));

    /* Toasts */
    grille.appendChild(panneau('c-toasts', 'Notifications (toasts)', { sous: 'aria-live=polite, fermeture manuelle ou 6 s' }, [
      el('p', { class: 'sous-titre', text: 'Empilées en bas à droite, fermables, avec icône et libellé de type.' }),
      el('div', { class: 'rangee-boutons' }, [
        el('button', { class: 'btn', type: 'button', 'data-toast': 'succes', onclick: function () { toast('succes', 'Succès', 'Le plan d’actions a été enregistré.'); } }, [icone('i-cercle-ok'), 'Succès']),
        el('button', { class: 'btn', type: 'button', 'data-toast': 'alerte', onclick: function () { toast('alerte', 'Alerte', '3 actions arrivent à échéance cette semaine.'); } }, [icone('i-alerte'), 'Alerte']),
        el('button', { class: 'btn', type: 'button', 'data-toast': 'erreur', onclick: function () { toast('erreur', 'Erreur', 'L’export a échoué : service indisponible.'); } }, [icone('i-erreur'), 'Erreur']),
        el('button', { class: 'btn', type: 'button', 'data-toast': 'info', onclick: function () { toast('info', 'Information', 'Revue de direction planifiée le 12/12/2026.'); } }, [icone('i-info'), 'Info']),
      ]),
    ]));

    /* État vide */
    grille.appendChild(panneau('c-vide', 'État vide', { sous: 'illustration SVG, action de reprise' }, etatVide('Aucune non-conformité ouverte', 'Toutes les non-conformités de ce périmètre sont closes. Lancez un audit pour en relever de nouvelles.', 'Planifier un audit', function () { location.hash = '#/formulaire'; })));

    /* Squelette */
    var zoneCharg = el('div');
    function squelette() {
      var sq = el('div', { class: 'squelette', 'aria-busy': 'true', 'aria-label': 'Chargement en cours' });
      sq.appendChild(el('div', { class: 'os haut l40' }));
      for (var i = 0; i < 5; i++) {
        sq.appendChild(el('div', { class: 'ligne-os' }, [el('div', { class: 'os' }), el('div', { class: 'os ' + (i % 2 ? 'l80' : 'l60') }), el('div', { class: 'os' }), el('div', { class: 'os' })]));
      }
      return sq;
    }
    function contenuCharge() {
      var t = el('table', { class: 'tableau compact' }, [
        el('thead', {}, el('tr', {}, ['Réf.', 'Audit', 'Statut', 'Avancement'].map(function (h) { return el('th', { scope: 'col', text: h }); }))),
        el('tbody', {}, F.audits.slice(5, 10).map(function (a) {
          return el('tr', {}, [el('td', { class: 'id', text: a.id }), el('td', { class: 'tronque fort', title: a.nom }, el('span', { text: a.nom })), el('td', {}, pastille(a.statut, STATUT_AUDIT[a.statut])), el('td', {}, celluleProgression(a.progression, a.statut === 'Clos' ? 'succes' : ''))]);
        })),
      ]);
      return el('div', { class: 'tableau-enveloppe' }, t);
    }
    zoneCharg.appendChild(contenuCharge());
    var btnSimuler = el('button', { class: 'btn', type: 'button', id: 'btn-simuler', onclick: function () {
      btnSimuler.disabled = true;
      vider(zoneCharg);
      zoneCharg.appendChild(squelette());
      setTimeout(function () {
        vider(zoneCharg);
        zoneCharg.appendChild(contenuCharge());
        btnSimuler.disabled = false;
        toast('info', 'Chargement terminé', '5 lignes affichées.');
      }, reduit ? 400 : 1600);
    } }, [icone('i-reset'), 'Simuler un chargement']);
    grille.appendChild(panneau('c-squelette', 'Chargement', { sous: 'squelette aria-busy', actions: [btnSimuler] }, zoneCharg));

    /* Pastilles */
    var ech = el('div');
    ech.appendChild(el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Statuts d’audit' })].concat(F.vocabulaire.statutsAudit.map(function (s) { return pastille(s, STATUT_AUDIT[s]); }))));
    ech.appendChild(el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Criticités' })].concat(F.vocabulaire.criticites.map(function (c) { return pastille(c, CRITICITE[c]); }))));
    ech.appendChild(el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Statuts d’action' })].concat(F.vocabulaire.statutsAction.map(function (s) { return pastille(s, STATUT_ACTION[s]); }))));
    ech.appendChild(el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Référentiels' })].concat(F.referentiels.map(function (r) { return pastilleRef(r.id); }))));
    ech.appendChild(el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Gravités RETEX' })].concat(F.vocabulaire.gravitesRetex.map(function (g, i) { return pastille(g, GRAVITE[i]); }))));
    grille.appendChild(panneau('c-pastilles', 'Pastilles de statut', { sous: 'couleur + icône + libellé' }, ech));

    /* Boutons et champs */
    grille.appendChild(panneau('c-boutons', 'Boutons et champs', { sous: 'cibles ≥ 32 px' }, [
      el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Boutons' }), el('button', { class: 'btn btn-primaire', type: 'button', text: 'Primaire' }), el('button', { class: 'btn', type: 'button', text: 'Secondaire' }), el('button', { class: 'btn btn-discret', type: 'button', text: 'Discret' }), el('button', { class: 'btn btn-danger', type: 'button', text: 'Danger' }), el('button', { class: 'btn', type: 'button', text: 'Désactivé', disabled: true })]),
      el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Icônes' }), el('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Filtrer' }, icone('i-filtre')), el('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Colonnes' }, icone('i-colonnes')), el('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Densité', 'aria-pressed': 'true' }, icone('i-densite'))]),
      el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Progression' }), el('span', { class: 'cellule-progression' }, [progression(36, '', true), el('span', { class: 'chiffres', text: '36 %' })]), el('span', { class: 'cellule-progression' }, [progression(100, 'succes', true), el('span', { class: 'chiffres', text: '100 %' })]), el('span', { class: 'cellule-progression' }, [progression(22, 'erreur', true), el('span', { class: 'chiffres', text: '22 %' })])]),
      el('div', { class: 'echantillon' }, [el('span', { class: 'lib', text: 'Jetons' }), el('span', { class: 'jeton' }, ['En cours', el('button', { type: 'button', 'aria-label': 'Retirer' }, icone('i-fermer'))]), el('span', { class: 'jeton' }, ['HDS', el('button', { type: 'button', 'aria-label': 'Retirer' }, icone('i-fermer'))])]),
    ]));

    racine.appendChild(grille);
    return racine;
  }

  /* ================================================================== ROUTAGE */
  var ROUTES = {
    dashboard: ecranDashboard,
    audits: ecranAudits,
    audit: ecranAudit,
    formulaire: ecranFormulaire,
    retex: ecranRetex,
    composants: ecranComposants,
  };
  function rendre() {
    var h = location.hash || '#/dashboard';
    var parties = h.replace(/^#\/?/, '').split('/');
    var nom = parties[0] || 'dashboard';
    var param = parties[1];
    var fabrique = ROUTES[nom] || ecranDashboard;
    cacherInfobulle();
    document.querySelectorAll('.menu-liste').forEach(function (m) { m.hidden = true; });
    listeConteneur = null;
    vider(contenu);
    contenu.appendChild(fabrique(param));
    document.querySelectorAll('.nav-lien').forEach(function (a) {
      var actif = a.dataset.route === nom;
      if (actif) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = 'Suivi des audits SMSI — ' + (nom === 'audit' ? 'Fiche ' + (param || '') : nom.charAt(0).toUpperCase() + nom.slice(1)) + ' — maquette E';
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

  /* Navigation repliable et raccourcis */
  var coquille = document.getElementById('coquille');
  var btnNav = document.getElementById('btn-nav');
  btnNav.addEventListener('click', function () {
    var etroit = window.matchMedia('(max-width: 1100px)').matches;
    if (etroit) {
      var depliee = coquille.classList.toggle('nav-depliee');
      btnNav.setAttribute('aria-expanded', String(depliee));
    } else {
      var repliee = coquille.classList.toggle('nav-repliee');
      btnNav.setAttribute('aria-expanded', String(!repliee));
    }
  });
  document.getElementById('btn-notif').addEventListener('click', function () {
    toast('alerte', '3 notifications', 'Échéance dépassée sur C-16, rapport AUD-06 attendu, revue de direction à préparer.');
  });
  var rechercheGlobale = document.getElementById('recherche-globale');
  rechercheGlobale.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      etat.liste.recherche = rechercheGlobale.value;
      etat.liste.page = 1;
      if (location.hash === '#/audits') rendre();
      else location.hash = '#/audits';
    }
  });
  document.addEventListener('keydown', function (e) {
    var cible = e.target;
    var saisie = cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.tagName === 'SELECT' || cible.isContentEditable);
    if (saisie || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!modaleRacine.hidden) return;
    var routes = ['#/dashboard', '#/audits', '#/audit/AUD-07', '#/formulaire', '#/retex', '#/composants'];
    if (/^[1-6]$/.test(e.key)) { location.hash = routes[parseInt(e.key, 10) - 1]; }
    if (e.key === '/') { e.preventDefault(); rechercheGlobale.focus(); }
  });

  /* Identité */
  document.getElementById('nav-app').textContent = F.organisation.application;
  document.getElementById('nav-org').textContent = F.organisation.nom;
  document.getElementById('nav-nom').textContent = F.moi.nom;
  document.getElementById('nav-role').textContent = F.moi.role;
  document.getElementById('nav-avatar').textContent = F.moi.initiales;
  document.getElementById('pastille-date').lastChild.textContent = F.fr(F.aujourdhui);

  rendre();
})();
