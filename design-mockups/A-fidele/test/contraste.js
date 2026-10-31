/* Vérification WCAG 2.1 des couples texte/fond et composant/fond utilisés par la maquette A-fidele.
   Usage : node test/contraste.js  (code de sortie 1 si un couple échoue). */
'use strict';
function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
function lum(rgb) {
  var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
/* Compose une couleur à alpha sur un fond opaque (teintes légères des badges). */
function sur(fg, alpha, bg) { var f = hex(fg), b = hex(bg); return f.map(function (v, i) { return Math.round(v * alpha + b[i] * (1 - alpha)); }); }
function toHex(rgb) { return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }

var BLANC = '#FFFFFF', FOND = '#F5F6F2', DOUCE = '#F8F9F6', NAV = '#163E33', NAV_ACTIF = '#305A49', NAV_SURVOL = '#244C3E';
var couples = [
  /* [libellé, premier plan, arrière-plan (hex ou rgb), seuil] */
  ['Texte encre / blanc', '#243B34', BLANC, 4.5],
  ['Texte encre / fond page', '#243B34', FOND, 4.5],
  ['Texte secondaire / blanc', '#58695F', BLANC, 4.5],
  ['Texte secondaire / fond page', '#58695F', FOND, 4.5],
  ['Texte secondaire / surface douce', '#58695F', DOUCE, 4.5],
  ['Lien vert / blanc', '#245F4C', BLANC, 4.5],
  ['Lien vert / fond page', '#245F4C', FOND, 4.5],
  ['Violet accent / blanc', '#5A48B5', BLANC, 4.5],
  ['Blanc / bouton vert', BLANC, '#245F4C', 4.5],
  ['Blanc / bouton vert sombre (survol)', BLANC, '#194B3B', 4.5],
  ['Blanc / bouton erreur', BLANC, '#C92A2A', 4.5],
  ['Nav texte / nav fond', '#F2F6EF', NAV, 4.5],
  ['Nav texte secondaire / nav fond', '#B5CEC0', NAV, 4.5],
  ['Nav texte / nav actif', '#F2F6EF', NAV_ACTIF, 4.5],
  ['Nav texte secondaire / nav actif', '#B5CEC0', NAV_ACTIF, 4.5],
  ['Nav texte / nav survol', '#F2F6EF', NAV_SURVOL, 4.5],
  ['Repère nav / nav fond (composant)', '#C5DBAB', NAV, 3],
  ['Bordure de champ / blanc (composant)', '#819087', BLANC, 3],
  ['Bordure de champ / fond page (composant)', '#819087', FOND, 3],
  ['Anneau focus vert / blanc (composant)', '#245F4C', BLANC, 3],
  ['Anneau focus vert / fond (composant)', '#245F4C', FOND, 3],
  ['Repère focus nav / nav fond', '#C5DBAB', NAV, 3],
  /* Badges légers : texte assombri sur teinte à 12 % sur blanc */
  ['Badge erreur texte / teinte', '#A82424', sur('#C92A2A', 0.12, BLANC), 4.5],
  ['Badge alerte texte / teinte', '#A03E08', sur('#CE440E', 0.12, BLANC), 4.5],
  ['Badge jaune texte / teinte', '#925500', sur('#AC5900', 0.12, BLANC), 4.5],
  ['Badge succès texte / teinte', '#206D2F', sur('#29833B', 0.12, BLANC), 4.5],
  ['Badge sarcelle texte / teinte', '#066A4C', sur('#087F5B', 0.12, BLANC), 4.5],
  ['Badge info texte / teinte', '#145B9C', sur('#1971C2', 0.12, BLANC), 4.5],
  ['Badge violet texte / teinte', '#5A2FB0', sur('#6741D9', 0.12, BLANC), 4.5],
  ['Badge gris texte / teinte', '#58695F', sur('#7A887F', 0.14, BLANC), 4.5],
  ['Badge vert marque texte / vert clair', '#245F4C', '#EDF4EF', 4.5],
  ['Badge violet marque texte / violet clair', '#43358B', '#F2F0FB', 4.5],
  /* Badges légers sur fond de page (en-tête de fiche) */
  ['Badge erreur texte / teinte sur fond', '#A82424', sur('#C92A2A', 0.12, FOND), 4.5],
  ['Badge info texte / teinte sur fond', '#145B9C', sur('#1971C2', 0.12, FOND), 4.5],
  /* Graphiques : remplissages contre le blanc des cartes (3:1 pour les composants) */
  ['Donnée vert / blanc', '#278A58', BLANC, 3],
  ['Donnée rouge / blanc', '#D63A30', BLANC, 3],
  ['Donnée violet / blanc', '#6556C2', BLANC, 3],
  ['Donnée bleu / blanc', '#3A66B5', BLANC, 3],
  ['Donnée gris / blanc', '#7A887F', BLANC, 3],
  ['État alerte / blanc', '#CE440E', BLANC, 3],
  ['État jaune / blanc', '#AC5900', BLANC, 3],
  ['État erreur / blanc', '#C92A2A', BLANC, 3],
  ['État succès / blanc', '#29833B', BLANC, 3],
  ['État info / blanc', '#1971C2', BLANC, 3],
  ['Vert marque / blanc', '#245F4C', BLANC, 3],
  ['Violet marque / blanc', '#5A48B5', BLANC, 3],
  ['Piste de jauge (trait) / blanc', '#D5DCD3', BLANC, 1],
  /* Texte d'état (variante légère) sur blanc, utilisé pour les chiffres KPI */
  ['Texte erreur / blanc', '#A82424', BLANC, 4.5],
  ['Texte alerte / blanc', '#A03E08', BLANC, 4.5],
  ['Texte succès / blanc', '#206D2F', BLANC, 4.5],
  ['Texte info / blanc', '#145B9C', BLANC, 4.5],
  ['Texte jaune / blanc', '#925500', BLANC, 4.5],
  /* Toasts (fond blanc, liseré coloré) et bandeaux pleins */
  ['Blanc / fond toast sombre (encre)', '#F2F6EF', '#243B34', 4.5],
  ['Nav texte 2 / fond encre', '#B5CEC0', '#243B34', 4.5],
  /* Compteur de navigation : fond blanc à 10 % sur l'entrée (repos, actif, survol) */
  ['Nav compteur (repos) texte 2 / blanc 10 % sur nav fond', '#B5CEC0', sur('#FFFFFF', 0.10, NAV), 4.5],
  ['Nav compteur (actif) texte / blanc 10 % sur nav actif', '#F2F6EF', sur('#FFFFFF', 0.10, NAV_ACTIF), 4.5],
  ['Nav compteur (survol) texte / blanc 10 % sur nav survol', '#F2F6EF', sur('#FFFFFF', 0.10, NAV_SURVOL), 4.5],
  /* Gravité RETEX : variantes texte des états, sur blanc et sur surface douce */
  ['Gravité texte secondaire / surface douce', '#58695F', DOUCE, 4.5],
  ['Gravité info texte / surface douce', '#145B9C', DOUCE, 4.5],
  ['Gravité jaune texte / surface douce', '#925500', DOUCE, 4.5],
  ['Gravité alerte texte / surface douce', '#A03E08', DOUCE, 4.5],
  ['Gravité erreur texte / surface douce', '#A82424', DOUCE, 4.5],
  /* Placeholder des champs (texte secondaire opaque) */
  ['Placeholder / blanc', '#58695F', BLANC, 4.5],
  /* Badge jaune sur fond de page (en-tête de fiche, statut Reporté) */
  ['Badge jaune texte / teinte sur fond', '#925500', sur('#AC5900', 0.12, FOND), 4.5],
  ['Badge alerte texte / teinte sur fond', '#A03E08', sur('#CE440E', 0.12, FOND), 4.5],
  ['Badge succès texte / teinte sur fond', '#206D2F', sur('#29833B', 0.12, FOND), 4.5],
  ['Badge violet texte / teinte sur fond', '#5A2FB0', sur('#6741D9', 0.12, FOND), 4.5],
  ['Badge gris texte / teinte sur fond', '#58695F', sur('#7A887F', 0.14, FOND), 4.5],
  /* Compteur d'onglet et priorité par défaut sur piste */
  ['Texte secondaire / piste (compteur d’onglet)', '#58695F', '#E7EEE9', 4.5],
];
var echec = 0;
couples.forEach(function (c) {
  var fg = typeof c[1] === 'string' ? hex(c[1]) : c[1];
  var bg = typeof c[2] === 'string' ? hex(c[2]) : c[2];
  var r = ratio(fg, bg);
  var ok = r >= c[3];
  if (!ok) echec++;
  console.log((ok ? 'OK   ' : 'ÉCHEC') + '  ' + r.toFixed(2).padStart(5) + ' (seuil ' + c[3] + ')  ' + c[0] + '  ' + toHex(fg) + ' sur ' + toHex(bg));
});
console.log(echec ? '\n' + echec + ' couple(s) sous le seuil.' : '\nTous les couples respectent le seuil.');
process.exit(echec ? 1 : 0);
