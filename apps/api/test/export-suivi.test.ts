/* Exports Excel par rubrique : structure des archives, contenu des feuilles, droits. Données fictives. */
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GROUPES, JEUX, TOUS_LES_JEUX } from '../src/export/rubriques.js';
import { nomsFeuilles } from '../src/export/classeur.js';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, ro: Agent;

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
const partie = (b: Buffer, nom: string) => lire(b).find((p) => p.nom === nom)!.texte;
const noms = (b: Buffer) => [...partie(b, 'xl/workbook.xml').matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]!);

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'xs_admin', 'admin'));
  ro = await login(t, await makeUser(t, 'xs_ro', 'ro'));
  await seedState(t, {
    items: [{ id: 'm1', ref: 'A', num: '5.1', title: 'Politiques', afnor: {}, interne: {} }],
    suppliers: [
      {
        id: 's1',
        name: 'Fournisseur fictif',
        saas: true,
        hds: 'Oui',
        critical: 'Oui',
        certs: [],
        controls: [{ t: 'Revue annuelle', last: '2020-01-01', freq: 12, result: 'Conforme' }],
      },
    ],
    processes: [{ id: 'P1', name: 'Processus fictif', family: 'Support', owner: 'Responsable' }],
    objectives: [{ id: 'O1', name: 'Objectif fictif', processes: ['P1'], due: '2026-12-31', owner: 'Responsable' }],
    indicators: [
      {
        id: 'I1',
        obj: 'O1',
        name: 'Indicateur fictif',
        dir: '≥',
        target: 90,
        values: [{ id: 'V-1', date: '2026-06-01', v: 95 }],
      },
    ],
    years: [2026],
  });
  // Écart natif du périmètre commun, lié à la mesure : l'export le lit comme un constat de l'ancien format.
  const ecart = await a.post('/api/grc/00000000-0000-4000-8000-000000000001/objects', {
    kind: 'nonconformity',
    name: 'Constat <fictif> & "test"',
    data: { findingType: 'nonconformity', classification: 'mineure', refs: ['legacy:items:m1'] },
  });
  if (ecart.statusCode >= 300) throw new Error(ecart.statusCode + ' ' + ecart.body);
});
afterAll(() => t.close());

describe('jeux de données', () => {
  it('chaque groupe ne référence que des jeux existants, avec des largeurs positives', () => {
    for (const g of GROUPES) for (const k of g.jeux) expect(JEUX[k], `${g.id}/${k}`).toBeDefined();
    expect(new Set(TOUS_LES_JEUX).size).toBe(TOUS_LES_JEUX.length);
    for (const j of Object.values(JEUX)) for (const [, w] of j.colonnes) expect(w).toBeGreaterThan(0);
  });
  it('donne des noms de feuille valides et uniques', () => {
    const n = nomsFeuilles(['A/B', 'a/b', 'Très long '.repeat(6), 'x?*']);
    expect(new Set(n.map((x) => x.toLowerCase())).size).toBe(n.length);
    for (const x of n) {
      expect(x.length).toBeLessThanOrEqual(31);
      expect(x).not.toMatch(/[\\/?*[\]:]/);
    }
  });
});

describe('GET /api/suivi/export', () => {
  it('Excel classique : une feuille par jeu, en-têtes et lignes, texte échappé', async () => {
    const r = await a.get('/api/suivi/export?groupe=ec&mode=std');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/export-ec-std-\d{4}-\d{2}-\d{2}\.xlsx/);
    const b = r.rawPayload;
    expect(lire(b)[0]!.nom).toBe('[Content_Types].xml');
    expect(noms(b)).toEqual(['Registre des écarts', "Plan d'actions"]);
    const feuille = partie(b, 'xl/worksheets/sheet1.xml');
    expect(feuille).toContain('Constat &lt;fictif&gt; &amp; &quot;test&quot;');
    expect(feuille).toContain('A.5.1');
    expect(feuille).toContain('<autoFilter ref="A1:M2"/>');
  });

  it('Excel pro : sommaire avec liens, titres, en-têtes colorés, états calculés', async () => {
    const r = await a.get('/api/suivi/export?groupe=sup&mode=pro');
    expect(r.statusCode).toBe(200);
    const b = r.rawPayload;
    expect(noms(b)[0]).toBe('Sommaire');
    expect(noms(b)).toContain('Fournisseurs et applications');
    const sommaire = partie(b, 'xl/worksheets/sheet1.xml');
    expect(sommaire).toContain('<hyperlink ref="B6"');
    expect(sommaire).toContain('location="\'Fournisseurs et applications\'!A1"');
    const four = partie(b, 'xl/worksheets/sheet2.xml');
    expect(four).toContain('Fournisseur fictif');
    expect(four).toContain('À fournir'); // hébergeur HDS sans certificat
    const ctrl = partie(b, 'xl/worksheets/sheet4.xml');
    expect(ctrl).toContain('En retard'); // dernier contrôle en 2020
    expect(partie(b, 'xl/styles.xml')).toContain('FF1B3A5C');
  });

  it('structure valide : un seul type de contenu par partie, relations résolues, noms définis cohérents', async () => {
    const r = await a.get('/api/suivi/export?groupe=all&mode=pro');
    expect(r.statusCode).toBe(200);
    const b = r.rawPayload;
    const parties = lire(b);
    const liste = parties.map((p) => p.nom);
    expect(new Set(liste).size).toBe(liste.length);
    const types = partie(b, '[Content_Types].xml');
    const surcharges = [...types.matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1]!);
    for (const n of liste.filter((x) => !x.endsWith('.rels') && x !== '[Content_Types].xml'))
      expect(surcharges).toContain(n);
    for (const s of surcharges) expect(liste).toContain(s);
    const rels = partie(b, 'xl/_rels/workbook.xml.rels');
    for (const m of rels.matchAll(/Target="([^"]+)"/g)) expect(liste).toContain('xl/' + m[1]);
    expect(noms(b)).toHaveLength(TOUS_LES_JEUX.length + 1);
    // Chaque feuille non vide du mode pro déclare un filtre et son nom défini.
    expect((partie(b, 'xl/workbook.xml').match(/_xlnm\._FilterDatabase/g) ?? []).length).toBeGreaterThan(3);
  });

  it('refuse un groupe inconnu et un mode inconnu, exige session et droit d’export', async () => {
    expect((await a.get('/api/suivi/export?groupe=zz&mode=std')).statusCode).toBe(404);
    expect((await a.get('/api/suivi/export?groupe=ec&mode=csv')).statusCode).toBe(422);
    expect((await t.app.inject({ method: 'GET', url: '/api/suivi/export?groupe=ec' })).statusCode).toBe(401);
    expect((await ro.get('/api/suivi/export?groupe=ec')).statusCode).toBe(403);
  });

  it('liste les groupes', async () => {
    const r = await a.get('/api/suivi/export/groupes');
    expect(r.statusCode).toBe(200);
    expect(r.json().map((g: { id: string }) => g.id)).toEqual(GROUPES.map((g) => g.id));
  });
});
