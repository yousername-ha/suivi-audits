/* Classeurs Excel à plusieurs feuilles, sans dépendance (Office Open XML). Deux présentations :
   - « std » : données brutes, en-têtes en gras, volet figé et filtres ;
   - « pro » : feuille « Sommaire » avec liens, titre et ligne de contexte, en-têtes colorés, lignes alternées, bordures,
     mise en page paysage à la largeur d'une page. */
import { echapper } from './office.js';
import { zip } from './tabular.js';

export interface Feuille {
  titre: string;
  colonnes: readonly (readonly [libelle: string, largeur: number])[];
  lignes: readonly (readonly (string | number)[])[];
}
export interface OptionsClasseur {
  mode: 'std' | 'pro';
  /** Titre du classeur (feuille « Sommaire » et en-tête des feuilles du mode pro). */
  titre: string;
  /** Mention d'extraction, par exemple « Normand'e-Santé — extraction du 18/10/2026 ». */
  contexte: string;
}

const ENTETE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const lettre = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
/** Nom de feuille Excel : 31 caractères au plus, sans caractères interdits, unique sans tenir compte de la casse. */
export function nomsFeuilles(titres: readonly string[]): string[] {
  const pris = new Set<string>();
  return titres.map((t) => {
    const base = (t.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Feuille').slice(0, 31);
    let nom = base;
    for (let k = 2; pris.has(nom.toLowerCase()); k++) nom = base.slice(0, 31 - String(k).length - 1) + ' ' + k;
    pris.add(nom.toLowerCase());
    return nom;
  });
}

/* Indices de style (cellXfs) : 0 défaut, 1 en-tête std, 2 titre, 3 contexte, 4 en-tête pro, 5 cellule, 6 cellule alternée,
   7 lien du sommaire, 8 lien du sommaire alterné, 9 nombre du sommaire, 10 nombre du sommaire alterné. */
const STYLES =
  `${ENTETE}<styleSheet xmlns="${NS}">` +
  '<fonts count="6"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><color rgb="FF1B3A5C"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FF5B6B7A"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="10"/><color rgb="FF1B3A5C"/><name val="Calibri"/></font></fonts>' +
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1B3A5C"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color rgb="FFC9D1DA"/></left><right style="thin"><color rgb="FFC9D1DA"/></right><top style="thin"><color rgb="FFC9D1DA"/></top><bottom style="thin"><color rgb="FFC9D1DA"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const cellule = (ref: string, v: string | number | null, style = 0) => {
  const s = style ? ` s="${style}"` : '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  if (v === null || v === '') return style ? `<c r="${ref}"${s}/>` : '';
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${echapper(String(v))}</t></is></c>`;
};
const largeurs = (cols: Feuille['colonnes']) =>
  `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(c[1], 8), 70)}" customWidth="1"/>`).join('')}</cols>`;
const apostrophes = (n: string) => n.replace(/'/g, "''");

function feuilleStd(f: Feuille): string {
  const n = f.colonnes.length;
  const lignes = [
    `<row r="1">${f.colonnes.map((c, i) => cellule(`${lettre(i)}1`, c[0], 1)).join('')}</row>`,
    ...f.lignes.map(
      (l, ri) =>
        `<row r="${ri + 2}">${f.colonnes.map((_, i) => cellule(`${lettre(i)}${ri + 2}`, l[i] ?? null)).join('')}</row>`,
    ),
  ];
  return (
    `${ENTETE}<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `${largeurs(f.colonnes)}<sheetData>${lignes.join('')}</sheetData><autoFilter ref="A1:${lettre(n - 1)}${Math.max(1, f.lignes.length + 1)}"/></worksheet>`
  );
}

function feuillePro(f: Feuille, o: OptionsClasseur): string {
  const n = f.colonnes.length;
  const fin = lettre(n - 1);
  const lignes = [
    `<row r="1">${cellule('A1', f.titre, 2)}</row>`,
    `<row r="2">${cellule('A2', `${o.contexte} — ${o.titre} — ${f.lignes.length} ligne(s)`, 3)}</row>`,
    `<row r="4" ht="30" customHeight="1">${f.colonnes.map((c, i) => cellule(`${lettre(i)}4`, c[0], 4)).join('')}</row>`,
    ...f.lignes.map((l, ri) => {
      const style = ri % 2 ? 6 : 5;
      return `<row r="${ri + 5}">${f.colonnes.map((_, i) => cellule(`${lettre(i)}${ri + 5}`, l[i] ?? null, style)).join('')}</row>`;
    }),
  ];
  const filtre = f.lignes.length ? `<autoFilter ref="A4:${fin}${f.lignes.length + 4}"/>` : '';
  return (
    `${ENTETE}<worksheet xmlns="${NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `${largeurs(f.colonnes)}<sheetData>${lignes.join('')}</sheetData>${filtre}` +
    `<mergeCells count="2"><mergeCell ref="A1:${fin}1"/><mergeCell ref="A2:${fin}2"/></mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>'
  );
}

function sommaire(feuilles: readonly Feuille[], noms: readonly string[], o: OptionsClasseur): string {
  const lignes = [
    `<row r="2">${cellule('B2', o.titre, 2)}</row>`,
    `<row r="3">${cellule('B3', o.contexte, 3)}</row>`,
    `<row r="5">${cellule('B5', 'Feuille', 4)}${cellule('C5', 'Lignes', 4)}</row>`,
    ...feuilles.map((f, i) => {
      const alt = i % 2;
      return `<row r="${i + 6}">${cellule(`B${i + 6}`, f.titre, alt ? 8 : 7)}${cellule(`C${i + 6}`, f.lignes.length, alt ? 10 : 9)}</row>`;
    }),
  ];
  const liens = feuilles
    .map(
      (f, i) =>
        `<hyperlink ref="B${i + 6}" location="'${apostrophes(noms[i + 1]!)}'!A1" display="${echapper(f.titre)}"/>`,
    )
    .join('');
  return (
    `${ENTETE}<worksheet xmlns="${NS}"><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>` +
    '<cols><col min="1" max="1" width="4" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/><col min="3" max="3" width="12" customWidth="1"/></cols>' +
    `<sheetData>${lignes.join('')}</sheetData>${liens ? `<hyperlinks>${liens}</hyperlinks>` : ''}</worksheet>`
  );
}

export function classeur(feuilles: readonly Feuille[], o: OptionsClasseur): Buffer {
  const pro = o.mode === 'pro';
  const titres = pro ? ['Sommaire', ...feuilles.map((f) => f.titre)] : feuilles.map((f) => f.titre);
  const noms = nomsFeuilles(titres);
  const contenus = pro
    ? [sommaire(feuilles, noms, o), ...feuilles.map((f) => feuillePro(f, o))]
    : feuilles.map(feuilleStd);
  // Plage du filtre automatique de chaque feuille (nom défini masqué, comme le fait Excel).
  const filtres = feuilles.flatMap((f, i) => {
    if (pro && !f.lignes.length) return [];
    const idx = pro ? i + 1 : i;
    const debut = pro ? 4 : 1;
    const fin = f.lignes.length + debut;
    return [
      `<definedName name="_xlnm._FilterDatabase" localSheetId="${idx}" hidden="1">'${apostrophes(noms[idx]!)}'!$A$${debut}:$${lettre(f.colonnes.length - 1)}$${Math.max(debut, fin)}</definedName>`,
    ];
  });
  const fichiers: [string, string][] = [
    [
      '[Content_Types].xml',
      `${ENTETE}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contenus.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    ],
    [
      '_rels/.rels',
      `${ENTETE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${ENTETE}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>${noms.map((n, i) => `<sheet name="${echapper(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filtres.length ? `<definedNames>${filtres.join('')}</definedNames>` : ''}</workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${ENTETE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${contenus.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${contenus.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`,
    ],
    ['xl/styles.xml', STYLES],
    ...contenus.map((c, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, c]),
  ];
  return zip(fichiers.map(([n, c]) => [n, Buffer.from(c, 'utf8')]));
}
