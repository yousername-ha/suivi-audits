/* Documents Office générés sans dépendance (Office Open XML) : compte rendu Word et support PowerPoint à partir d'un même
   modèle de document. Garde-fous contre les fichiers « à réparer » : [Content_Types].xml en première entrée, aucune partie
   sans type ni sans relation, identifiants de formes uniques par diapositive, une seule maquette et un seul gabarit, et un
   corps Word qui ne se termine jamais par un tableau. */
import { xlsx, zip } from './tabular.js';

export interface SectionDocument {
  titre: string;
  paragraphes: string[];
  tableau?: { entetes: string[]; lignes: string[][] };
}
export interface ModeleDocument {
  titre: string;
  sousTitre?: string;
  sections: SectionDocument[];
}

const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const ENTETE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export const echapper = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const types = (defauts: [string, string][], parties: [string, string][]) =>
  `${ENTETE}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  defauts.map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`).join('') +
  parties.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('') +
  '</Types>';
const relations = (rels: [string, string, string][]) =>
  `${ENTETE}<Relationships xmlns="${NS_REL}">` +
  rels.map(([id, type, cible]) => `<Relationship Id="${id}" Type="${NS_DOC}/${type}" Target="${cible}"/>`).join('') +
  '</Relationships>';
const DEFAUTS: [string, string][] = [
  ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
  ['xml', 'application/xml'],
];
const entrees = (fichiers: [string, string][]): [string, Buffer][] =>
  fichiers.map(([n, c]) => [n, Buffer.from(c, 'utf8')]);

/* ---------- Word ---------- */

const paragrapheW = (texte: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${echapper(texte)}</w:t></w:r></w:p>`;
const celluleW = (texte: string, gras: boolean) =>
  `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:r>${gras ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${echapper(texte)}</w:t></w:r></w:p></w:tc>`;
const tableauW = (t: NonNullable<SectionDocument['tableau']>) =>
  '<w:tbl><w:tblPr><w:tblStyle w:val="Grille"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>' +
  `<w:tblGrid>${t.entetes.map(() => '<w:gridCol/>').join('')}</w:tblGrid>` +
  `<w:tr>${t.entetes.map((e) => celluleW(e, true)).join('')}</w:tr>` +
  t.lignes.map((l) => `<w:tr>${t.entetes.map((_, i) => celluleW(l[i] ?? '', false)).join('')}</w:tr>`).join('') +
  '</w:tbl>';

export function docx(m: ModeleDocument): Buffer {
  const corps: string[] = [paragrapheW(m.titre, 'Titre')];
  if (m.sousTitre) corps.push(paragrapheW(m.sousTitre, 'SousTitre'));
  for (const s of m.sections) {
    corps.push(paragrapheW(s.titre, 'Titre1'));
    for (const p of s.paragraphes) corps.push(paragrapheW(p));
    if (s.tableau && s.tableau.entetes.length) corps.push(tableauW(s.tableau), paragrapheW(''));
  }
  const style = (id: string, nom: string, props: string, rpr = '') =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nom}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr>${props}</w:pPr>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
  const styles =
    `${ENTETE}<w:styles xmlns:w="${NS_W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    style('Titre', 'Title', '<w:spacing w:after="240"/>', '<w:b/><w:sz w:val="48"/>') +
    style('SousTitre', 'Subtitle', '<w:spacing w:after="240"/>') +
    style(
      'Titre1',
      'heading 1',
      '<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>',
      '<w:b/><w:sz w:val="32"/>',
    ) +
    '<w:style w:type="table" w:default="1" w:styleId="TableauNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '<w:style w:type="table" w:styleId="Grille"><w:name w:val="Table Grid"/><w:basedOn w:val="TableauNormal"/><w:tblPr><w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((c) => `<w:${c} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`)
      .join('') +
    '</w:tblBorders></w:tblPr></w:style></w:styles>';
  return zip(
    entrees([
      [
        '[Content_Types].xml',
        types(DEFAUTS, [
          ['/word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'],
          ['/word/styles.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'],
        ]),
      ],
      ['_rels/.rels', relations([['rId1', 'officeDocument', 'word/document.xml']])],
      ['word/_rels/document.xml.rels', relations([['rId1', 'styles', 'styles.xml']])],
      ['word/styles.xml', styles],
      [
        'word/document.xml',
        `${ENTETE}<w:document xmlns:w="${NS_W}"><w:body>${corps.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
      ],
    ]),
  );
}

/* ---------- PowerPoint ---------- */

const LARGEUR = 12192000; // 16:9
const HAUTEUR = 6858000;
const MARGE = 609600;
/** Une diapositive tient au plus ce nombre de caractères de contenu ; au-delà, la section se poursuit. */
const CAPACITE = 900;

const run = (t: string, taille?: number, gras = false) =>
  `<a:r><a:rPr lang="fr-FR"${taille ? ` sz="${taille}"` : ''}${gras ? ' b="1"' : ''}/><a:t>${echapper(t)}</a:t></a:r>`;
const forme = (id: number, nom: string, x: number, y: number, w: number, h: number, paras: string, ph?: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${echapper(nom)}"/><p:cNvSpPr${ph ? '><a:spLocks noGrp="1"/></p:cNvSpPr>' : ' txBox="1"/>'}<p:nvPr>${ph ? `<p:ph type="${ph}"/>` : ''}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
const arbre = (formes: string) =>
  `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${formes}</p:spTree></p:cSld>`;

interface Diapo {
  titre: string;
  lignes: string[];
  couverture?: boolean;
}

/** Découpe les sections en diapositives. Un tableau devient une ligne de texte par rangée. */
function diapositives(m: ModeleDocument): Diapo[] {
  const d: Diapo[] = [{ titre: m.titre, lignes: m.sousTitre ? [m.sousTitre] : [], couverture: true }];
  for (const s of m.sections) {
    const lignes = [
      ...s.paragraphes.filter((p) => p.trim()),
      ...(s.tableau?.lignes.map((l) => l.filter((c) => c).join(' — ')) ?? []),
    ];
    let courant: string[] = [];
    let taille = 0;
    const parts: string[][] = [];
    for (const l of lignes) {
      if (courant.length && taille + l.length > CAPACITE) {
        parts.push(courant);
        courant = [];
        taille = 0;
      }
      courant.push(l);
      taille += l.length;
    }
    if (courant.length || !parts.length) parts.push(courant);
    parts.forEach((p, i) =>
      d.push({ titre: parts.length > 1 ? `${s.titre} (${i + 1}/${parts.length})` : s.titre, lignes: p }),
    );
  }
  return d;
}

const THEME =
  `${ENTETE}<a:theme xmlns:a="${NS_A}" name="Suivi"><a:themeElements><a:clrScheme name="Suivi"><a:dk1><a:srgbClr val="1F2933"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1B3A5C"/></a:dk2><a:lt2><a:srgbClr val="F2F4F7"/></a:lt2><a:accent1><a:srgbClr val="1B5E9E"/></a:accent1><a:accent2><a:srgbClr val="2E7D6B"/></a:accent2><a:accent3><a:srgbClr val="B7791F"/></a:accent3><a:accent4><a:srgbClr val="9B2C2C"/></a:accent4><a:accent5><a:srgbClr val="5B6B7A"/></a:accent5><a:accent6><a:srgbClr val="6B4C9A"/></a:accent6><a:hlink><a:srgbClr val="1B5E9E"/></a:hlink><a:folHlink><a:srgbClr val="6B4C9A"/></a:folHlink></a:clrScheme>` +
  '<a:fontScheme name="Suivi"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="Suivi"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
  '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
  '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
  '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';

const MAQUETTE =
  `${ENTETE}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_DOC}" xmlns:p="${NS_P}">` +
  arbre('') +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>';
const GABARIT = `${ENTETE}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_DOC}" xmlns:p="${NS_P}" type="blank" preserve="1">${arbre('')}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

function diapo(d: Diapo): string {
  const l = LARGEUR - 2 * MARGE;
  const formes = d.couverture
    ? forme(2, 'Titre', MARGE, 2200000, l, 1300000, `<a:p>${run(d.titre, 4000, true)}</a:p>`, 'ctrTitle') +
      forme(
        3,
        'Sous-titre',
        MARGE,
        3700000,
        l,
        900000,
        d.lignes.map((t) => `<a:p>${run(t, 2000)}</a:p>`).join('') || '<a:p><a:endParaRPr lang="fr-FR"/></a:p>',
        'subTitle',
      )
    : forme(2, 'Titre', MARGE, 365000, l, 900000, `<a:p>${run(d.titre, 3000, true)}</a:p>`, 'title') +
      forme(
        3,
        'Contenu',
        MARGE,
        1400000,
        l,
        HAUTEUR - 1400000 - MARGE,
        d.lignes
          .map((t) => `<a:p><a:pPr marL="285750" indent="-285750"><a:buChar char="•"/></a:pPr>${run(t, 1800)}</a:p>`)
          .join('') || '<a:p><a:endParaRPr lang="fr-FR"/></a:p>',
      );
  return `${ENTETE}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_DOC}" xmlns:p="${NS_P}">${arbre(formes)}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export function pptx(m: ModeleDocument): Buffer {
  const ds = diapositives(m);
  const parties: [string, string][] = [
    ['/ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'],
    [
      '/ppt/slideMasters/slideMaster1.xml',
      'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml',
    ],
    [
      '/ppt/slideLayouts/slideLayout1.xml',
      'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml',
    ],
    ['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
    ...ds.map((_, i): [string, string] => [
      `/ppt/slides/slide${i + 1}.xml`,
      'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
    ]),
  ];
  const fichiers: [string, string][] = [
    ['[Content_Types].xml', types(DEFAUTS, parties)],
    ['_rels/.rels', relations([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
    [
      'ppt/presentation.xml',
      `${ENTETE}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_DOC}" xmlns:p="${NS_P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ds.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${LARGEUR}" cy="${HAUTEUR}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    ],
    [
      'ppt/_rels/presentation.xml.rels',
      relations([
        ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
        ['rId2', 'theme', 'theme/theme1.xml'],
        ...ds.map((_, i): [string, string, string] => [`rId${i + 3}`, 'slide', `slides/slide${i + 1}.xml`]),
      ]),
    ],
    ['ppt/slideMasters/slideMaster1.xml', MAQUETTE],
    [
      'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      relations([
        ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
        ['rId2', 'theme', '../theme/theme1.xml'],
      ]),
    ],
    ['ppt/slideLayouts/slideLayout1.xml', GABARIT],
    [
      'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      relations([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
    ],
    ['ppt/theme/theme1.xml', THEME],
  ];
  ds.forEach((d, i) => {
    fichiers.push([`ppt/slides/slide${i + 1}.xml`, diapo(d)]);
    fichiers.push([
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      relations([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]),
    ]);
  });
  return zip(entrees(fichiers));
}

/* ---------- Excel ---------- */

/** Classeur à une feuille : une ligne par paragraphe ou rangée de tableau, avec la section en première colonne. */
export function classeur(m: ModeleDocument): Buffer {
  const lignes: string[][] = [['Section', 'Contenu']];
  for (const s of m.sections) {
    for (const p of s.paragraphes) if (p.trim()) lignes.push([s.titre, p]);
    for (const l of s.tableau?.lignes ?? []) lignes.push([s.titre, l.filter((c) => c).join(' — ')]);
  }
  return xlsx(m.titre, lignes);
}
