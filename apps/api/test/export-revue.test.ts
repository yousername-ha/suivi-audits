/* Exports de la revue de direction (Word, PowerPoint, Excel) : archives Office Open XML sans défaut de structure connu pour
   déclencher la « réparation » d'Office. Données fictives. */
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent, id: string;
const racine = `/api/grc/${DEFAULT_SMSI}`;

/** Lecture minimale d'une archive ZIP : noms dans l'ordre du répertoire central, contenus décompressés. */
function lire(buf: Buffer) {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const parties: { nom: string; texte: string }[] = [];
  for (let i = 0; i < n; i++) {
    const methode = buf.readUInt16LE(p + 10),
      taille = buf.readUInt32LE(p + 20),
      lg = buf.readUInt16LE(p + 28),
      extra = buf.readUInt16LE(p + 30),
      com = buf.readUInt16LE(p + 32),
      local = buf.readUInt32LE(p + 42),
      nom = buf.subarray(p + 46, p + 46 + lg).toString('utf8');
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const brut = buf.subarray(debut, debut + taille);
    parties.push({ nom, texte: (methode === 8 ? zlib.inflateRawSync(brut) : brut).toString('utf8') });
    p += 46 + lg + extra + com;
  }
  return parties;
}
const structure = (buf: Buffer) => {
  const parties = lire(buf);
  const noms = parties.map((p) => p.nom);
  const types = parties.find((p) => p.nom === '[Content_Types].xml')!.texte;
  const surcharges = [...types.matchAll(/PartName="([^"]+)"/g)].map((m) => m[1]!.slice(1));
  return { parties, noms, surcharges };
};

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'exp_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'exp_ro', 'ro'));
  const r = await a.post(`${racine}/objects`, {
    kind: 'management_review',
    name: 'Revue T3 <fictive> & "test"',
    data: {
      description: '',
      ownerId: null,
      refs: [],
      heldAt: '2026-10-12',
      participants: 'Direction\nRSSI',
      inputs: '',
      decisions: 'Valider le plan',
      followup: '',
      status: 'draft',
      entree_a: 'Action A close',
      improvements: 'Former les équipes',
    },
  });
  expect(r.statusCode).toBe(200);
  id = r.json().id;
});
afterAll(() => t.close());

const exporter = (agent: Agent, format: string, cible = id) =>
  agent.get(`${racine}/pilotage/revue/${cible}/export?format=${format}`);

describe('export d’une revue de direction', () => {
  it('Word : compte rendu structuré, texte échappé, corps terminé par un paragraphe', async () => {
    const r = await exporter(a, 'docx');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/revue-de-direction-\d{4}-\d{2}-\d{2}\.docx/);
    const { parties, noms, surcharges } = structure(r.rawPayload);
    expect(noms[0]).toBe('[Content_Types].xml');
    expect(new Set(noms).size).toBe(noms.length);
    for (const n of noms.filter((x) => !x.endsWith('.rels') && x !== '[Content_Types].xml'))
      expect(surcharges).toContain(n);
    const doc = parties.find((p) => p.nom === 'word/document.xml')!.texte;
    expect(doc).toContain('Revue T3 &lt;fictive&gt; &amp; &quot;test&quot;');
    expect(doc).toContain('Action A close');
    expect(doc).toContain('À renseigner');
    expect(doc).toMatch(/<\/w:p><w:sectPr>/);
  });

  it('PowerPoint : une maquette, un gabarit, identifiants de formes uniques, aucune partie orpheline', async () => {
    const r = await exporter(a, 'pptx');
    expect(r.statusCode).toBe(200);
    const { parties, noms, surcharges } = structure(r.rawPayload);
    expect(noms[0]).toBe('[Content_Types].xml');
    expect(new Set(noms).size).toBe(noms.length);
    expect(noms.filter((n) => n.startsWith('ppt/slideMasters/slideMaster'))).toHaveLength(1);
    // Toute surcharge déclarée correspond à une partie présente, et réciproquement.
    for (const s of surcharges) expect(noms).toContain(s);
    for (const n of noms.filter((x) => !x.endsWith('.rels') && x !== '[Content_Types].xml'))
      expect(surcharges).toContain(n);
    const diapos = parties.filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p.nom));
    expect(diapos.length).toBeGreaterThan(3);
    for (const d of diapos) {
      const ids = [...d.texte.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const pres = parties.find((p) => p.nom === 'ppt/presentation.xml')!.texte;
    expect([...pres.matchAll(/<p:sldId /g)]).toHaveLength(diapos.length);
  });

  it('Excel : une ligne par rubrique renseignée', async () => {
    const r = await exporter(a, 'xlsx');
    expect(r.statusCode).toBe(200);
    const feuille = structure(r.rawPayload).parties.find((p) => p.nom === 'xl/worksheets/sheet1.xml')!.texte;
    expect(feuille).toContain('Participants');
    expect(feuille).toContain('Former les équipes');
  });

  it('refuse un identifiant qui n’est pas une revue, un format inconnu et un compte sans droit d’export', async () => {
    const autre = (
      await a.post(`${racine}/objects`, {
        kind: 'context',
        name: 'Enjeu fictif',
        data: { description: '', ownerId: null, refs: [] },
      })
    ).json().id as string;
    expect((await exporter(a, 'docx', autre)).statusCode).toBe(404);
    expect((await exporter(a, 'odt')).statusCode).toBe(422);
    expect((await exporter(ro, 'docx')).statusCode).toBe(403);
  });
});
