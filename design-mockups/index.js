/* Page comparative : cartes des maquettes (depuis catalogue.js) et comparateur dans un cadre. */
(function () {
  'use strict';
  var CAT = window.CATALOGUE || { maquettes: [], ecrans: [] };
  var grille = document.getElementById('grille');
  var selMaquettes = document.getElementById('sel-maquettes');
  var selEcrans = document.getElementById('sel-ecrans');
  var cadre = document.getElementById('cadre');
  var info = document.getElementById('cadre-info');
  var courant = { maquette: null, ecran: CAT.ecrans[0] && CAT.ecrans[0].hash };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function pastilles(palette) {
    var ul = el('ul', { class: 'pastilles', 'aria-label': 'Palette' });
    palette.forEach(function (p) {
      var i = el('i', { 'aria-hidden': 'true' });
      i.style.setProperty('--c', p.hex);
      ul.appendChild(el('li', {}, [i, p.role + ' ' + p.hex]));
    });
    return ul;
  }

  function carte(m) {
    var vedette = m.vedette;
    var c = el('article', { class: 'carte' + (vedette ? ' carte--vedette' : '') + (m.disponible ? '' : ' carte--absente') });
    var corps = el('div', { class: 'corps' });
    var titre = el('h3', {}, [m.titre]);
    if (vedette) titre.appendChild(el('span', { class: 'etiquette', text: 'Prioritaire' }));
    corps.appendChild(titre);
    corps.appendChild(el('p', { text: m.intention }));
    corps.appendChild(pastilles(m.palette));
    if (m.disponible) {
      var img = el('img', { class: 'vignette', src: 'screenshots/' + m.dossier + '/dashboard-1440x900.png', alt: 'Dashboard de la maquette ' + m.titre, loading: 'lazy' });
      img.addEventListener('error', function () { img.remove(); });
      corps.appendChild(img);
    }
    var actions = el('div', { class: 'actions' });
    if (m.disponible) {
      actions.appendChild(el('a', { class: 'lien-ouvrir', href: m.dossier + '/index.html#/dashboard', target: '_blank', rel: 'noopener', text: 'Ouvrir' }));
      var btn = el('button', { class: 'btn-comparer', type: 'button', text: 'Comparer ici' });
      btn.addEventListener('click', function () {
        choisirMaquette(m.dossier);
        document.getElementById('comparateur').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      actions.appendChild(btn);
      actions.appendChild(el('a', { class: 'lien-ouvrir lien-ouvrir--secondaire', href: m.dossier + '/README.md', text: 'README' }));
    } else {
      actions.appendChild(el('span', { class: 'note', text: 'Non produite (voir SYNTHESE.md).' }));
    }
    corps.appendChild(actions);
    c.appendChild(corps);
    if (vedette) {
      var refs = el('div', { class: 'references', 'aria-label': 'Images de référence' });
      (CAT.references || []).forEach(function (r) {
        var f = el('figure', { class: r.large ? 'large' : '' }, [el('img', { src: 'reference/' + r.fichier, alt: r.legende, loading: 'lazy' }), el('figcaption', { text: r.legende })]);
        refs.appendChild(f);
      });
      refs.appendChild(el('p', { class: 'note large', text: 'Références fournies par le commanditaire : le style est transposé, aucun contenu n’est repris. Analyse : reference/ANALYSE-INSPIRATION.md.' }));
      c.appendChild(refs);
    }
    return c;
  }

  function majBoutons(conteneur, valeur) {
    Array.prototype.forEach.call(conteneur.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.valeur === valeur));
    });
  }

  function charger() {
    if (!courant.maquette) return;
    var src = courant.maquette + '/index.html' + courant.ecran;
    if (!cadre.dataset.maquette || cadre.dataset.maquette !== courant.maquette) {
      cadre.src = src;
      cadre.dataset.maquette = courant.maquette;
    } else {
      try {
        cadre.contentWindow.postMessage({ type: 'route', hash: courant.ecran }, '*');
      } catch (e) {
        cadre.src = src;
      }
    }
    info.textContent = src;
    try { history.replaceState(null, '', '#' + courant.maquette + courant.ecran.replace('#', '/')); } catch (e) { /* file:// */ }
  }
  function choisirMaquette(dossier) {
    courant.maquette = dossier;
    majBoutons(selMaquettes, dossier);
    charger();
  }
  function choisirEcran(hash) {
    courant.ecran = hash;
    majBoutons(selEcrans, hash);
    charger();
  }

  /* Rendu */
  var ordre = CAT.maquettes.slice().sort(function (a, b) { return (b.vedette ? 1 : 0) - (a.vedette ? 1 : 0); });
  ordre.forEach(function (m) { grille.appendChild(carte(m)); });
  CAT.maquettes.filter(function (m) { return m.disponible; }).forEach(function (m) {
    var b = el('button', { class: 'puce', type: 'button', 'data-valeur': m.dossier, 'aria-pressed': 'false', text: m.titre });
    b.addEventListener('click', function () { choisirMaquette(m.dossier); });
    selMaquettes.appendChild(b);
  });
  CAT.ecrans.forEach(function (e) {
    var b = el('button', { class: 'puce', type: 'button', 'data-valeur': e.hash, 'aria-pressed': 'false', text: e.libelle });
    b.addEventListener('click', function () { choisirEcran(e.hash); });
    selEcrans.appendChild(b);
  });
  /* État initial : #F-inspiration/dashboard si présent dans l'URL, sinon la vedette. */
  var h = location.hash.replace(/^#/, '');
  var parts = h.split('/');
  var demande = CAT.maquettes.filter(function (m) { return m.dossier === parts[0] && m.disponible; })[0];
  var premiere = demande || CAT.maquettes.filter(function (m) { return m.vedette && m.disponible; })[0] || CAT.maquettes.filter(function (m) { return m.disponible; })[0];
  if (parts.length > 1) courant.ecran = '#/' + parts.slice(1).join('/');
  majBoutons(selEcrans, courant.ecran);
  if (premiere) choisirMaquette(premiere.dossier);
})();
