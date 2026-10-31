/* Contraste WCAG 2.1 (luminance relative) des couples texte/fond réellement utilisés par la maquette B.
   Les couleurs sont lues dans tokens.css ; les valeurs rgba() sont composées sur le fond indiqué.
   Exécution : node design-mockups/B-epuree/test/contraste.cjs  (code de sortie 1 si un seuil n'est pas atteint). */
const fs = require('fs');
const path = require('path');

const tokens = {};
fs.readFileSync(path.join(__dirname, '..', 'tokens.css'), 'utf8').replace(/--([\w-]+):\s*([^;]+);/g, (m, k, v) => { tokens['--' + k] = v.trim(); });

function parse(c) {
  c = c.trim();
  if (c.startsWith('var(')) return parse(tokens[c.slice(4, -1).trim()]);
  let m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('Couleur non reconnue : ' + c);
}
function compose(fg, bg) { const a = fg[3]; return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))).concat(1); }
function lum([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const b = parse(bg), f = compose(parse(fg), b);
  const l1 = lum(f), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const hex = (c) => { const p = compose(parse(c), [255, 255, 255, 1]); return '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(); };

// [libellé, texte, fond, seuil]
const TEXTE = 4.5, GRAPHIQUE = 3;
const couples = [
  // Texte principal et secondaire sur chaque fond
  ['Encre sur fond de page', '--encre', '--fond-page', TEXTE],
  ['Encre sur surface', '--encre', '--fond-surface', TEXTE],
  ['Encre sur sauge (sections)', '--encre', '--fond-sauge', TEXTE],
  ['Encre sur sauge 2 (boutons)', '--encre', '--fond-sauge-2', TEXTE],
  ['Encre 80 % sur page', '--encre-80', '--fond-page', TEXTE],
  ['Encre 80 % sur surface', '--encre-80', '--fond-surface', TEXTE],
  ['Encre 80 % sur sauge', '--encre-80', '--fond-sauge', TEXTE],
  ['Encre 80 % sur fond de navigation (libellés nav)', '--encre-80', '--fond-nav', TEXTE],
  ['Encre 60 % sur page (légendes, sous-titres)', '--encre-60', '--fond-page', TEXTE],
  ['Encre 60 % sur surface', '--encre-60', '--fond-surface', TEXTE],
  ['Encre 60 % sur sauge (axes SVG, en-têtes de tableau)', '--encre-60', '--fond-sauge', TEXTE],
  ['Encre 60 % sur sauge 2 (compteur d’onglet)', '--encre-60', '--fond-sauge-2', TEXTE],
  ['Encre 60 % sur fond de navigation (légende, pied)', '--encre-60', '--fond-nav', TEXTE],
  // Navigation
  ['Nav active : vert sombre sur vert pâle', '--vert-sombre', '--vert-pale', TEXTE],
  ['Nav : icône encre 60 % sur fond nav', '--encre-60', '--fond-nav', GRAPHIQUE],
  // Boutons
  ['Bouton principal : blanc sur vert', '--blanc', '--vert', TEXTE],
  ['Bouton principal survolé : blanc sur vert sombre', '--blanc', '--vert-sombre', TEXTE],
  ['Bouton danger : blanc sur erreur plein', '--blanc', '--erreur-plein', TEXTE],
  ['Bouton danger survolé : blanc sur erreur texte', '--blanc', '--erreur-texte', TEXTE],
  ['Bouton discret : vert sombre sur page', '--vert-sombre', '--fond-page', TEXTE],
  ['Bouton discret : vert sombre sur sauge', '--vert-sombre', '--fond-sauge', TEXTE],
  ['Lien : vert sombre sur surface', '--vert-sombre', '--fond-surface', TEXTE],
  ['Pagination courante : blanc sur vert', '--blanc', '--vert', TEXTE],
  ['Info-bulle / lien d’évitement : blanc sur encre', '--blanc', '--encre', TEXTE],
  // Badges de statut (texte sur leur fond)
  ['Badge succès', '--succes-texte', '--succes-fond', TEXTE],
  ['Badge alerte', '--alerte-texte', '--alerte-fond', TEXTE],
  ['Badge erreur', '--erreur-texte', '--erreur-fond', TEXTE],
  ['Badge info', '--info-texte', '--info-fond', TEXTE],
  ['Badge jaune (rapport attendu, à vérifier)', '--jaune-texte', '--jaune-fond', TEXTE],
  ['Badge neutre', '--neutre-texte', '--neutre-fond', TEXTE],
  ['Badge violet (mineure)', '--violet', '--violet-pale', TEXTE],
  ['Badge vert (en cours)', '--vert-sombre', '--vert-pale', TEXTE],
  ['Avatar : violet sur violet pâle', '--violet', '--violet-pale', TEXTE],
  // Textes d'état hors badge
  ['Alerte texte sur page (notes KPI, délais)', '--alerte-texte', '--fond-page', TEXTE],
  ['Erreur texte sur page', '--erreur-texte', '--fond-page', TEXTE],
  ['Erreur texte sur surface (échéances dépassées)', '--erreur-texte', '--fond-surface', TEXTE],
  ['Erreur texte sur sauge (messages du formulaire)', '--erreur-texte', '--fond-sauge', TEXTE],
  ['Succès texte sur page', '--succes-texte', '--fond-page', TEXTE],
  ['Succès texte sur surface (En direct)', '--succes-texte', '--fond-surface', TEXTE],
  ['Encre 80 % sur sauge (cycle dans l’en-tête)', '--encre-80', '--fond-sauge', TEXTE],
  ['Placeholder : encre 60 % sur sauge (champ hors section)', '--encre-60', '--fond-sauge', TEXTE],
  ['Placeholder : encre 60 % sur surface (champ dans une section)', '--encre-60', '--fond-surface', TEXTE],
  // Composants graphiques (3 : 1)
  ['Donnée 1 sur sauge', '--donnee-1', '--fond-sauge', GRAPHIQUE],
  ['Donnée 2 sur sauge', '--donnee-2', '--fond-sauge', GRAPHIQUE],
  ['Donnée 3 sur sauge', '--donnee-3', '--fond-sauge', GRAPHIQUE],
  ['Donnée 4 sur sauge', '--donnee-4', '--fond-sauge', GRAPHIQUE],
  ['Donnée 5 sur sauge', '--donnee-5', '--fond-sauge', GRAPHIQUE],
  ['Donnée 6 sur sauge', '--donnee-6', '--fond-sauge', GRAPHIQUE],
  ['Donnée 1 sur surface', '--donnee-1', '--fond-surface', GRAPHIQUE],
  ['Donnée 4 sur surface', '--donnee-4', '--fond-surface', GRAPHIQUE],
  ['Donnée 5 sur surface', '--donnee-5', '--fond-surface', GRAPHIQUE],
  ['Barre de progression : vert sur piste', '--vert', '--donnee-piste', GRAPHIQUE],
  ['Barre de progression terminée : succès plein sur piste', '--succes-plein', '--donnee-piste', GRAPHIQUE],
  ['Barre de progression bloquée : alerte plein sur piste', '--alerte-plein', '--donnee-piste', GRAPHIQUE],
  ['Jauge : donnée 1 sur piste', '--donnee-1', '--donnee-piste', GRAPHIQUE],
  ['Point RETEX gravité 3 : alerte plein sur page', '--alerte-plein', '--fond-page', GRAPHIQUE],
  ['Point RETEX gravité 4 : erreur plein sur page', '--erreur-plein', '--fond-page', GRAPHIQUE],
  ['Point RETEX gravité 1 : info plein sur page', '--info-plein', '--fond-page', GRAPHIQUE],
  ['Point RETEX gravité 0 : succès plein sur page', '--succes-plein', '--fond-page', GRAPHIQUE],
  ['Pastille En direct : succès plein sur surface', '--succes-plein', '--fond-surface', GRAPHIQUE],
  ['Chronologie future : trait fort sur sauge', '--encre-trait-fort', '--fond-sauge', GRAPHIQUE],
  ['Contour d’erreur de champ : erreur plein sur surface', '--erreur-plein', '--fond-surface', GRAPHIQUE],
  ['Indicateur d’onglet : vert sur page', '--vert', '--fond-page', GRAPHIQUE],
  // Focus
  ['Anneau de focus (champs) composé sur surface', '--focus-anneau', '--fond-surface', GRAPHIQUE],
  ['Anneau de focus (champs) composé sur sauge', '--focus-anneau', '--fond-sauge', GRAPHIQUE],
  ['Contour de focus : vert sur page', '--vert', '--fond-page', GRAPHIQUE],
  ['Contour de focus : vert sur sauge', '--vert', '--fond-sauge', GRAPHIQUE],
  // Palette de démonstration (écran Composants)
  ['Démo : blanc sur encre 80 %', '--blanc', '--encre-80', TEXTE],
  ['Démo : blanc sur violet', '--blanc', '--violet', TEXTE],
  ['Démo : blanc sur succès texte', '--blanc', '--succes-texte', TEXTE],
  ['Démo : blanc sur alerte texte', '--blanc', '--alerte-texte', TEXTE],
  ['Démo : blanc sur info texte', '--blanc', '--info-texte', TEXTE],
  ['Démo : encre sur vert pâle', '--encre', '--vert-pale', TEXTE],
  ['Démo : encre sur violet pâle', '--encre', '--violet-pale', TEXTE],
];

function couleurDe(v) {
  // Pour --focus-anneau (ombre), on extrait la couleur rgba.
  const val = tokens[v] || v;
  const m = val.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}|var\(--[\w-]+\)/);
  return m ? m[0] : val;
}

let minTexte = Infinity, minGraphique = Infinity, echec = false;
const lignes = couples.map(([lib, fg, bg, seuil]) => {
  const r = ratio(couleurDe(fg), couleurDe(bg));
  const ok = r >= seuil;
  if (!ok) echec = true;
  if (seuil === TEXTE) minTexte = Math.min(minTexte, r); else minGraphique = Math.min(minGraphique, r);
  return (ok ? 'OK   ' : 'ÉCHEC') + ' ' + r.toFixed(2).replace('.', ',') + ' : 1  (seuil ' + seuil + ')  ' + lib + '  [' + hex(couleurDe(fg)) + ' sur ' + hex(couleurDe(bg)) + ']';
});
lignes.forEach((l) => console.log(l));
console.log('\nMinimum texte : ' + minTexte.toFixed(2).replace('.', ',') + ' : 1 — minimum graphique : ' + minGraphique.toFixed(2).replace('.', ',') + ' : 1');
if (require.main === module) process.exit(echec ? 1 : 0);
module.exports = { ratio, tokens };
