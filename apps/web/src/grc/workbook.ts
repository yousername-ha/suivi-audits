import { Unzip, UnzipInflate, strFromU8, strToU8, zipSync } from 'fflate';
import type { FrameworkDefinition, MappingData } from '@suivi/shared';
const xml = (s: unknown) =>
  String(s ?? '').replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
const column = (i: number) => {
  let s = '';
  for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};
const sheet = (rows: unknown[][]) =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, i) => `<row r="${i + 1}">${row.map((v, j) => `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
/** Gabarit OOXML limité aux trois feuilles documentées, compatible Excel et LibreOffice. */
export function frameworkWorkbook(d: FrameworkDefinition, mappings: MappingData[] = []) {
  const rows = [
    [
      ['Champ', 'Valeur'],
      ...Object.entries({ name: d.name, identifier: d.identifier, source: JSON.stringify(d.source) }).map(([k, v]) => [
        k,
        v,
      ]),
    ],
    [['id', 'label'], ...d.domains.map((r) => [r.id, r.label])],
    [
      ['id', 'domain', 'title', 'description', 'applicability', 'measureRefs'],
      ...d.requirements.map((r) => [
        r.id,
        r.domain,
        r.title,
        r.description,
        r.applicability,
        JSON.stringify(r.measureRefs),
      ]),
    ],
  ];
  rows.push([
    ['source', 'target', 'type', 'justification', 'coverage', 'origin', 'status', 'sourceUrl', 'reviewNote'],
    ...mappings.map((m) => [
      JSON.stringify(m.source),
      JSON.stringify(m.target),
      m.type,
      m.justification,
      String(m.coverage),
      m.origin,
      'proposed',
      m.sourceUrl,
      m.reviewNote,
    ]),
  ]);
  const files: Record<string, Uint8Array> = {};
  files['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${rows.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  files['_rels/.rels'] = strToU8(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  files['xl/workbook.xml'] = strToU8(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${['Métadonnées', 'Domaines', 'Exigences', 'Correspondances'].map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  );
  rows.forEach((r, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheet(r))));
  return zipSync(files, { level: 6 });
}
function readZip(bytes: Uint8Array) {
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Fichier limité à 8 Mo.');
  const files: Record<string, string> = {};
  let total = 0,
    count = 0,
    error: Error | null = null;
  const unzip = new Unzip((file) => {
    if (
      ++count > 100 ||
      file.name.includes('..') ||
      file.name.includes('\\') ||
      (file.originalSize && file.originalSize > 20 * 1024 * 1024)
    ) {
      error = new Error('Archive trop volumineuse ou invalide.');
      return;
    }
    if (
      !/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(file.name)
    )
      return;
    const chunks: Uint8Array[] = [];
    file.ondata = (e, data, final) => {
      if (e) {
        error = e;
        return;
      }
      total += data.length;
      if (total > 20 * 1024 * 1024) {
        file.terminate();
        error = new Error('Contenu décompressé limité à 20 Mo.');
        return;
      }
      chunks.push(data);
      if (final) {
        const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of chunks) {
          all.set(c, offset);
          offset += c.length;
        }
        files[file.name] = strFromU8(all);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    if (error) throw error;
  }
  if (error) throw error;
  return files;
}
function parseXml(text: string | undefined) {
  if (!text || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML manquant ou entités externes interdites.');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Feuille XML invalide.');
  return document;
}
/** Ouvre un classeur .xlsx (sans dépendance serveur) : `lignes(feuille)` rend les cellules en texte, formules refusées. */
export function ouvrirClasseur(bytes: Uint8Array, maxColonnes = 20) {
  const files = readZip(bytes);
  const workbook = parseXml(files['xl/workbook.xml']),
    rels = parseXml(files['xl/_rels/workbook.xml.rels']);
  const shared = files['xl/sharedStrings.xml']
    ? Array.from(parseXml(files['xl/sharedStrings.xml']).getElementsByTagName('si')).map((e) => e.textContent ?? '')
    : [];
  const rows = (name: string) => {
    const node = Array.from(workbook.getElementsByTagName('sheet')).find((s) => s.getAttribute('name') === name);
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find(
      (r) => r.getAttribute('Id') === node?.getAttribute('r:id'),
    );
    const target = rel?.getAttribute('Target');
    if (!target || target.includes('..') || rel?.getAttribute('TargetMode') === 'External')
      throw new Error('Feuille requise : ' + name);
    const key = target.startsWith('/xl/') ? target.slice(1) : 'xl/' + target;
    const doc = parseXml(files[key]);
    const out = Array.from(doc.getElementsByTagName('row')).map((row) => {
      const r: string[] = [];
      for (const cell of Array.from(row.getElementsByTagName('c'))) {
        if (cell.getElementsByTagName('f').length)
          throw new Error('Remplacez les formules par des valeurs avant import.');
        const ref = cell.getAttribute('r') ?? '';
        const letters = /^[A-Z]+/.exec(ref)?.[0];
        if (!letters) throw new Error('Adresse de cellule invalide.');
        const index = [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        if (index >= maxColonnes) throw new Error('Trop de colonnes.');
        const value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
        r[index] =
          cell.getAttribute('t') === 's'
            ? (shared[Number(value)] ?? '')
            : cell.getAttribute('t') === 'inlineStr'
              ? (cell.getElementsByTagName('is')[0]?.textContent ?? '')
              : value;
      }
      return r;
    });
    if (out.length > 10001) throw new Error('Maximum 10 000 lignes métier par feuille.');
    return out;
  };
  return {
    lignes: rows,
    feuilles: () => Array.from(workbook.getElementsByTagName('sheet')).map((s) => s.getAttribute('name') ?? ''),
  };
}
export function readFrameworkWorkbook(bytes: Uint8Array) {
  const classeur = ouvrirClasseur(bytes, 21);
  const rows = classeur.lignes;
  const metadata = Object.fromEntries(
    rows('Métadonnées')
      .slice(1)
      .map((r) => [r[0], r[1]]),
  );
  return {
    definition: {
      name: metadata.name,
      identifier: metadata.identifier,
      source: JSON.parse(metadata.source ?? '{}'),
      domains: rows('Domaines')
        .slice(1)
        .filter((r) => r[0])
        .map((r) => ({ id: r[0], label: r[1] })),
      requirements: rows('Exigences')
        .slice(1)
        .filter((r) => r[0])
        .map((r) => ({
          id: r[0],
          domain: r[1],
          title: r[2],
          description: r[3] ?? '',
          applicability: r[4] ?? '',
          measureRefs: JSON.parse(r[5] || '[]'),
        })),
    },
    mappings: classeur.feuilles().includes('Correspondances')
      ? rows('Correspondances')
          .slice(1)
          .filter((r) => r[0])
          .map((r) => ({
            source: JSON.parse(r[0]!),
            target: JSON.parse(r[1]!),
            type: r[2],
            justification: r[3],
            coverage: Number(r[4]),
            origin: r[5],
            status: 'proposed',
            sourceUrl: r[7],
            reviewNote: r[8] ?? '',
          }))
      : [],
  };
}
export function saveWorkbook(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
