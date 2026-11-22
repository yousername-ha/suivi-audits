/* Inventaire local en lecture seule du code ; seule la destination JSON passée en argument est écrite. */
/* eslint-disable @typescript-eslint/no-require-imports -- script CommonJS autonome, hors du paquet de l'application. */
const fs = require('fs'),
  path = require('path');
const root = path.resolve(process.argv[2] || process.cwd()),
  // Destination choisie par l'appelant : aucun fichier par défaut dans le dossier temporaire commun (nom prévisible,
  // qu'un autre compte de la machine pourrait créer avant le script).
  destination = process.argv[3] ? path.resolve(process.argv[3]) : null;
const ts = require(path.join(root, 'node_modules/typescript')),
  sources = path.join(root, 'apps/web/src');
let fenetres = [],
  outils = [],
  recherchesRestantes = [];
function scan(file) {
  let source = fs.readFileSync(file, 'utf8'),
    sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tag = (n) =>
    ts.isJsxElement(n)
      ? n.openingElement.tagName.getText(sf)
      : ts.isJsxSelfClosingElement(n)
        ? n.tagName.getText(sf)
        : '';
  const attrs = (n) =>
    Object.fromEntries(
      (ts.isJsxElement(n) ? n.openingElement : n).attributes.properties
        .filter(ts.isJsxAttribute)
        .map((a) => [a.name.getText(sf), a.initializer?.getText(sf) || 'true']),
    );
  function visit(n) {
    let t = tag(n);
    if (t) {
      let a = attrs(n),
        ref = { fichier: path.relative(root, file), ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 };
      if (['Modal', 'Drawer'].includes(t))
        fenetres.push({
          ...ref,
          type: t,
          titre: a.title || null,
          classes: a.classNames || a.className || null,
          taille: a.size || 'défaut',
          pleinEcran: a.fullScreen || false,
        });
      if (['BoiteOutils', 'BarreFiltres'].includes(t)) outils.push({ ...ref, composant: t, nom: a.label || null });
      if (t === 'TextInput' && /Recherch|Chercher/.test(a.label || a['aria-label'] || '')) {
        let dansOutil = false;
        for (let p = n.parent; p; p = p.parent) if (['BoiteOutils', 'BarreFiltres'].includes(tag(p))) dansOutil = true;
        if (!dansOutil)
          recherchesRestantes.push({
            ...ref,
            nom: a.label || a['aria-label'],
            contexte: ref.fichier.includes('BarreOutils')
              ? 'champ interne de sélection de valeur / fabrication de la boîte'
              : ref.fichier.includes('RechercheMenu')
                ? 'recherche de navigation avec suggestions'
                : 'à examiner',
          });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
}
function walk(dir) {
  for (let e of fs.readdirSync(dir, { withFileTypes: true })) {
    let p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) scan(p);
  }
}
walk(sources);
walk(root + '/packages/ui/src');
let rapport = {
  nature: 'Inventaire syntaxique de couverture ; il ne remplace pas une recette visuelle de chaque fenêtre.',
  fenetres,
  outils,
  recherchesRestantes,
};
if (destination) fs.writeFileSync(destination, JSON.stringify(rapport, null, 2) + '\n');
else console.error('Aucune destination donnée : seul le résumé est affiché.');
console.log(
  JSON.stringify(
    {
      declarationsFenetres: fenetres.length,
      fichiersFenetres: new Set(fenetres.map((x) => x.fichier)).size,
      modal: fenetres.filter((x) => x.type === 'Modal').length,
      drawer: fenetres.filter((x) => x.type === 'Drawer').length,
      pointsOutils: outils.length,
      fichiersOutils: new Set(outils.map((x) => x.fichier)).size,
      boite: outils.filter((x) => x.composant === 'BoiteOutils').length,
      adaptateur: outils.filter((x) => x.composant === 'BarreFiltres').length,
      recherchesRestantes,
    },
    null,
    2,
  ),
);
