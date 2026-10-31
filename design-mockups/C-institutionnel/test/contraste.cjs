/* Vérification WCAG 2.1 des couples texte/fond de la maquette C (calcul de luminance relative). */
function lum(hex) {
  var h = hex.replace('#', '');
  var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) { var l1 = lum(a), l2 = lum(b); var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
var P = {
  papier: '#FAF8F3', surface: '#FFFFFF', doux: '#F2EEE5', filet: '#D8D1C4', bordureChamp: '#857D70',
  encre: '#23221E', texte2: '#5B564D', bleu: '#1F3A5F', bleuClair: '#6B86AA', terre: '#A84E24', terreSombre: '#8F421E',
  okTexte: '#2F6B46', okFond: '#E4EEE4', alerteTexte: '#7F5208', alerteFond: '#F7ECD2', erreurTexte: '#9A3528', erreurFond: '#F7E2DC',
  infoTexte: '#2B5A88', infoFond: '#E1EAF3', neutreTexte: '#5B564D', neutreFond: '#ECE7DC', reporteTexte: '#5B4A86', reporteFond: '#EAE5F2',
  navTexte: '#F4F1EA', navTexte2: '#C9D3E2', graphBleu: '#1F3A5F', graphBleuClair: '#6B86AA', graphTerre: '#A84E24', graphOcre: '#B8862B', graphSauge: '#5C8A6C', graphGris: '#8F897E',
};
var couples = [
  ['texte principal / papier', P.encre, P.papier, 4.5], ['texte principal / surface', P.encre, P.surface, 4.5], ['texte principal / doux', P.encre, P.doux, 4.5],
  ['texte secondaire / papier', P.texte2, P.papier, 4.5], ['texte secondaire / surface', P.texte2, P.surface, 4.5], ['texte secondaire / doux', P.texte2, P.doux, 4.5],
  ['bleu (titres, liens) / papier', P.bleu, P.papier, 4.5], ['bleu / doux', P.bleu, P.doux, 4.5], ['blanc / bleu (bouton, nav)', P.navTexte, P.bleu, 4.5], ['nav secondaire / bleu', P.navTexte2, P.bleu, 4.5],
  ['terre cuite (lien action) / papier', P.terre, P.papier, 4.5], ['terre cuite / surface', P.terre, P.surface, 4.5], ['blanc / terre cuite (bouton)', P.surface, P.terre, 4.5], ['blanc / terre sombre (survol)', P.surface, P.terreSombre, 4.5],
  ['succès texte / fond', P.okTexte, P.okFond, 4.5], ['succès texte / papier', P.okTexte, P.papier, 4.5],
  ['alerte texte / fond', P.alerteTexte, P.alerteFond, 4.5], ['alerte texte / papier', P.alerteTexte, P.papier, 4.5],
  ['erreur texte / fond', P.erreurTexte, P.erreurFond, 4.5], ['erreur texte / papier', P.erreurTexte, P.papier, 4.5],
  ['info texte / fond', P.infoTexte, P.infoFond, 4.5], ['info texte / papier', P.infoTexte, P.papier, 4.5],
  ['neutre texte / fond', P.neutreTexte, P.neutreFond, 4.5], ['reporté texte / fond', P.reporteTexte, P.reporteFond, 4.5], ['reporté texte / papier', P.reporteTexte, P.papier, 4.5],
  ['bordure de champ / surface', P.bordureChamp, P.surface, 3], ['bordure de champ / papier', P.bordureChamp, P.papier, 3], ['bordure champ (texte2) / surface', P.texte2, P.surface, 3],
  ['graphique bleu / surface', P.graphBleu, P.surface, 3], ['graphique bleu clair / surface', P.graphBleuClair, P.surface, 3], ['graphique terre / surface', P.graphTerre, P.surface, 3],
  ['graphique ocre / surface', P.graphOcre, P.surface, 3], ['graphique sauge / surface', P.graphSauge, P.surface, 3], ['graphique gris / surface', P.graphGris, P.surface, 3],
  
];
var ko = 0;
couples.forEach(function (c) { var r = ratio(c[1], c[2]); var ok = r >= c[3]; if (!ok) ko++; console.log((ok ? 'OK  ' : 'KO  ') + r.toFixed(2).padStart(5) + '  (min ' + c[3] + ')  ' + c[0] + '  ' + c[1] + ' sur ' + c[2]); });
console.log(ko ? ko + ' couple(s) insuffisant(s)' : 'Tous les couples sont conformes.');
process.exit(ko ? 1 : 0);
