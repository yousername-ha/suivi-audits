/* Vérification WCAG des couples texte/fond de la maquette F (luminance relative, WCAG 2.1).
   Usage : node test/contraste.cjs  → liste les couples, échoue (code 1) si un couple est sous son seuil. */
'use strict';
function lum(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  var rgb = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }).map(function (c) {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function ratio(a, b) {
  var la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/* Mélange alpha d'une couleur sur un fond (pour les surfaces translucides). */
function mix(fg, bg, alpha) {
  function c(hex) { var h = hex.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  var f = c(fg), b = c(bg);
  return '#' + f.map(function (v, i) { return ('0' + Math.round(v * alpha + b[i] * (1 - alpha)).toString(16)).slice(-2); }).join('');
}
var MARINE_H = '#1C2B4A', MARINE_B = '#0F1A33';
var VERRE = mix('#232A48', MARINE_H, 0.6); // carte de verre sur le haut du dégradé
var VERRE_B = mix('#232A48', MARINE_B, 0.6);
var couples = [
  /* [libellé, texte, fond, seuil] */
  ['Texte principal / verre', '#FFFFFF', VERRE, 4.5],
  ['Texte secondaire / verre', '#A9B4D0', VERRE, 4.5],
  ['Texte tertiaire (légendes) / verre', '#8E9AB8', VERRE, 4.5],
  ['Texte tertiaire / marine clair', '#8E9AB8', MARINE_H, 4.5],
  ['Texte tertiaire / marine sombre', '#8E9AB8', MARINE_B, 4.5],
  ['Sarcelle clair (valeur) / verre', '#7EE0D6', VERRE, 4.5],
  ['Violet lumineux (valeur) / verre', '#B388FF', VERRE, 4.5],
  ['Corail clair (alerte) / verre', '#FF9A8E', VERRE, 4.5],
  ['Or clair / verre', '#F7C97A', VERRE, 4.5],
  ['Vert clair / verre', '#7CE7AC', VERRE, 4.5],
  ['Bleu clair / verre', '#8FC1FF', VERRE, 4.5],
  ['Blanc / bouton sarcelle assombri', '#FFFFFF', '#157F76', 4.5],
  ['Blanc / bouton violet', '#FFFFFF', '#5A48B5', 4.5],
  ['Blanc / bouton corail assombri', '#FFFFFF', '#C23A2F', 4.5],
  ['Marine / bouton or', '#0F1A33', '#F2A33A', 4.5],
  ['Marine / capsule sarcelle claire', '#0F1A33', '#2EC4B6', 4.5],
  ['Encre (titres) / carte claire', '#2B3350', '#FFFFFF', 4.5],
  ['Encre chiffres / carte claire', '#334066', '#FFFFFF', 4.5],
  ['Encre légendes / carte claire', '#5F6A8A', '#FFFFFF', 4.5],
  ['Sarcelle sombre (texte) / carte claire', '#0F6B63', '#FFFFFF', 4.5],
  ['Violet (texte) / carte claire', '#5A48B5', '#FFFFFF', 4.5],
  ['Corail sombre (texte) / carte claire', '#B8362B', '#FFFFFF', 4.5],
  ['Or sombre (texte) / carte claire', '#8A5200', '#FFFFFF', 4.5],
  ['Vert sombre (texte) / carte claire', '#1F7F4C', '#FFFFFF', 4.5],
  ['Bleu sombre (texte) / carte claire', '#2457B0', '#FFFFFF', 4.5],
  ['Badge clair : texte sarcelle / fond sarcelle 12 %', '#0F6B63', mix('#2EC4B6', '#FFFFFF', 0.12), 4.5],
  ['Badge clair : texte corail / fond corail 12 %', '#B8362B', mix('#F0564A', '#FFFFFF', 0.12), 4.5],
  ['Badge clair : texte or / fond or 14 %', '#8A5200', mix('#F2A33A', '#FFFFFF', 0.14), 4.5],
  ['Badge sombre : texte sarcelle clair / fond sarcelle 16 % sur verre', '#7EE0D6', mix('#2EC4B6', VERRE, 0.16), 4.5],
  ['Badge sombre : texte corail clair / fond corail 16 % sur verre', '#FF9A8E', mix('#F0564A', VERRE, 0.16), 4.5],
  ['Composant : bord de champ / carte claire', '#7A84A0', '#FFFFFF', 3],
  ['Composant : sarcelle / marine (jauge)', '#2EC4B6', MARINE_H, 3],
  ['Composant : violet lumineux / marine (courbe)', '#8F7BFF', MARINE_H, 3],
  ['Composant : anneau focus sarcelle clair / verre', '#7EE0D6', VERRE, 3],
  ['Composant : bord de champ blanc 48 % / verre', mix('#FFFFFF', VERRE, 0.48), VERRE, 3],
  ['Lien sarcelle clair / verre', '#7EE0D6', VERRE, 4.5],
  ['Placeholder / carte claire', '#6B7596', '#FFFFFF', 4.5],
];
var ko = 0;
couples.forEach(function (c) {
  var r = ratio(c[1], c[2]);
  var ok = r >= c[3];
  if (!ok) ko++;
  console.log((ok ? 'OK ' : 'KO ') + r.toFixed(2).padStart(6) + ' : 1  (seuil ' + c[3] + ')  ' + c[0] + '  ' + c[1] + ' sur ' + c[2]);
});
console.log(ko ? '\n' + ko + ' couple(s) sous le seuil.' : '\nTous les couples respectent leur seuil.');
process.exit(ko ? 1 : 0);
