/* Vérification des contrastes WCAG 2.1 (luminance relative) sur les couples texte/fond de tokens.css.
   Usage : node design-mockups/E-data-dense/test/contraste.cjs */
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'tokens.css'), 'utf8');
const T = {};
css.replace(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi, (m, k, v) => { T[k] = v.toLowerCase(); return m; });

function lum(hex) {
  const c = hex.replace('#', '');
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(parseInt(c.slice(0, 2), 16)) + 0.7152 * f(parseInt(c.slice(2, 4), 16)) + 0.0722 * f(parseInt(c.slice(4, 6), 16));
}
function ratio(a, b) {
  const l1 = lum(a); const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* [texte, fond, seuil, usage] */
const COUPLES = [
  ['texte', 'surface', 4.5, 'corps sur carte'],
  ['texte', 'fond', 4.5, 'corps sur page'],
  ['texte', 'surface-2', 4.5, 'corps sur en-tête de tableau'],
  ['texte-2', 'surface', 4.5, 'texte secondaire sur carte'],
  ['texte-2', 'fond', 4.5, 'texte secondaire sur page'],
  ['texte-2', 'surface-3', 4.5, 'texte secondaire sur survol'],
  ['texte-3', 'surface', 4.5, 'libellés 11 px (KPI, en-têtes) sur carte'],
  ['texte-3', 'surface-2', 4.5, 'en-têtes de tableau'],
  ['texte-3', 'fond', 4.5, 'titres de navigation sur page'],
  ['texte-3', 'surface-3', 4.5, 'compteurs sur gris'],
  ['accent-texte', 'surface', 4.5, 'liens, onglet actif'],
  ['accent-texte', 'accent-fond', 4.5, 'entrée de navigation active, pastille accent'],
  ['accent-texte', 'fond', 4.5, 'liens sur page'],
  ['texte-inverse', 'accent', 4.5, 'bouton primaire'],
  ['texte-inverse', 'accent-survol', 4.5, 'bouton primaire survolé'],
  ['texte-inverse', 'erreur', 4.5, 'bouton danger, compteur de notifications'],
  ['texte-inverse', 'texte', 4.5, 'info-bulle'],
  ['texte-inverse-2', 'texte', 4.5, 'info-bulle, lignes secondaires'],
  ['succes', 'succes-fond', 4.5, 'pastille Clos / Terminée'],
  ['alerte', 'alerte-fond', 4.5, 'pastille Rapport attendu / Majeure'],
  ['erreur', 'erreur-fond', 4.5, 'pastille Critique / Bloquée'],
  ['info', 'info-fond', 4.5, 'pastille En cours'],
  ['violet', 'violet-fond', 4.5, 'pastille En préparation'],
  ['ambre', 'ambre-fond', 4.5, 'pastille Reporté / Mineure'],
  ['neutre', 'neutre-fond', 4.5, 'pastille Planifié / Observation'],
  ['succes', 'surface', 4.5, 'pastille contour, écarts'],
  ['alerte', 'surface', 4.5, 'pastille contour'],
  ['erreur', 'surface', 4.5, 'messages d’erreur, retards'],
  ['info', 'surface', 4.5, 'pastille contour'],
  ['violet', 'surface', 4.5, 'pastille contour'],
  ['ambre', 'surface', 4.5, 'pastille contour'],
  ['neutre', 'surface', 4.5, 'pastille contour'],
  ['erreur', 'surface-2', 4.5, 'retards dans les tableaux'],
  ['succes', 'surface-2', 4.5, 'écarts dans les tableaux'],
  /* Composants et graphiques : 3 : 1 */
  ['bordure-champ', 'surface', 3, 'bordure des champs'],
  ['accent', 'surface', 3, 'anneau de focus, indicateur d’onglet'],
  ['donnee-1', 'surface', 3, 'courbe ouverts, barres'],
  ['donnee-2', 'surface', 3, 'courbe clos'],
  ['donnee-3', 'surface', 3, 'colonnes vertes'],
  ['donnee-critique', 'surface', 3, 'segment Critique'],
  ['donnee-majeure', 'surface', 3, 'segment Majeure'],
  ['donnee-mineure', 'surface', 3, 'segment Mineure'],
  ['donnee-observation', 'surface', 3, 'segment Observation'],
  ['donnee-1', 'donnee-piste', 3, 'barre de progression sur piste'],
];
let echec = 0;
COUPLES.forEach(([a, b, seuil, usage]) => {
  const r = ratio(T[a], T[b]);
  const ok = r >= seuil;
  if (!ok) echec++;
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${r.toFixed(2).padStart(5)} : 1  (≥ ${seuil})  --${a} ${T[a]} sur --${b} ${T[b]}  — ${usage}`);
});
console.log(echec ? `\n${echec} couple(s) sous le seuil.` : '\nTous les couples respectent le seuil.');
process.exitCode = echec ? 1 : 0;
