/* Vérification des contrastes WCAG (luminance relative) pour la maquette D. Usage : node test/contraste.cjs */
'use strict';
function lum(hex) {
  var h = hex.replace('#', '');
  var c = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }).map(function (v) {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) { var l1 = lum(a), l2 = lum(b); var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
var FONDS = { page: '#0B1220', nav: '#0E1627', surface: '#16203A', eleve: '#1C2846', selection: '#223058' };
var TEXTES = {
  texte: '#E6EDF7', secondaire: '#A9B6CC', attenue: '#8E9DB8', cyan: '#5EE1F0', vert: '#4ADE80', ambre: '#F6B860', rouge: '#FF7B7B', bleu: '#8DC2FF', violet: '#C1ABFF', gris: '#B4BED1',
};
var COMPOSANTS = { bordure: '#2B3A5F', bordureForte: '#3B4E7C', accentCyan: '#22C8DD', ambre: '#F0A030', rouge: '#F25757', vert: '#2FC46F' };
/* Fonds des badges : voile coloré à 12-14 % sur la surface */
function melange(hexSup, alpha, hexInf) {
  function c(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  var a = c(hexSup), b = c(hexInf);
  return '#' + a.map(function (v, i) { return ('0' + Math.round(v * alpha + b[i] * (1 - alpha)).toString(16)).slice(-2); }).join('');
}
var VOILES = { cyan: '#5EE1F0', vert: '#4ADE80', ambre: '#F6B860', rouge: '#FF7B7B', bleu: '#8DC2FF', violet: '#C1ABFF', gris: '#B4BED1' };
Object.keys(VOILES).forEach(function (k) { FONDS['voile-' + k] = melange(VOILES[k], 0.14, '#16203A'); });
FONDS.saisie = '#0F1830';
COMPOSANTS.bordureSaisie = '#5B6E98';
var echecs = 0;
console.log('Texte (≥ 4,5:1) :');
Object.keys(TEXTES).forEach(function (t) {
  var ligne = t.padEnd(11) + TEXTES[t] + ' ';
  Object.keys(FONDS).forEach(function (f) {
    /* Les fonds « voile » ne portent que les textes de badge (accents et texte principal), jamais le texte atténué. */
    if (f.indexOf('voile') === 0 && (t === 'attenue' || t === 'secondaire')) return;
    var r = ratio(TEXTES[t], FONDS[f]);
    if (r < 4.5) echecs++;
    ligne += ' ' + f + '=' + r.toFixed(2) + (r < 4.5 ? '!' : ' ');
  });
  console.log(ligne);
});
console.log('Composants / bordures (≥ 3:1) :');
Object.keys(COMPOSANTS).forEach(function (t) {
  var ligne = t.padEnd(13) + COMPOSANTS[t] + ' ';
  Object.keys(FONDS).forEach(function (f) {
    if (f.indexOf('voile') === 0) return;
    var r = ratio(COMPOSANTS[t], FONDS[f]);
    if (t === 'bordureSaisie' && (f === 'saisie' || f === 'surface') && r < 3) echecs++;
    ligne += ' ' + f + '=' + r.toFixed(2) + (r < 3 ? '!' : ' ');
  });
  console.log(ligne);
});
console.log('Texte sombre sur accent plein (bouton primaire) :');
[['#071019', '#22C8DD'], ['#071019', '#5EE1F0'], ['#0B1220', '#F25757'], ['#0B1220', '#F0A030'], ['#E6EDF7', '#B42318'], ['#0B1220', '#4ADE80']].forEach(function (p) {
  console.log('  ' + p[0] + ' sur ' + p[1] + ' = ' + ratio(p[0], p[1]).toFixed(2));
});
console.log(echecs ? 'ECHECS texte : ' + echecs : 'OK texte');
process.exit(echecs ? 1 : 0);
