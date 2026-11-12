/* Contenu des documents pour l'assistant (ADR 0086, point 12) : extraction bornée, formats lus et non lus, fichiers piégés,
   index tenu avec la version courante, lecture bornée par le droit de la personne et la classification du profil.
   Le modèle est remplacé par un faux transport : aucun appel réseau. Données fictives. */
import { deflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReglagesAssistantDto } from '@suivi/shared';
import { extraireTexte } from '../src/assistant/extraction.js';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

/** Archive ZIP minimale (une entrée compressée par nom), pour fabriquer de faux documents bureautiques. */
function zip(entrees: Record<string, string>, o: { tailleDeclaree?: number; drapeaux?: number } = {}): Buffer {
  const locaux: Buffer[] = [];
  const centraux: Buffer[] = [];
  let decalage = 0;
  for (const [nom, contenu] of Object.entries(entrees)) {
    const n = Buffer.from(nom, 'utf8');
    const brut = Buffer.from(contenu, 'utf8');
    const comp = deflateRawSync(brut);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(o.drapeaux ?? 0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(o.tailleDeclaree ?? brut.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(o.drapeaux ?? 0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(o.tailleDeclaree ?? brut.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(decalage, 42);
    locaux.push(local, n, comp);
    centraux.push(central, n);
    decalage += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(entrees).length, 8);
  fin.writeUInt16LE(Object.keys(entrees).length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, cd, fin]);
}
const DOCX = zip({
  '[Content_Types].xml': '<Types/>',
  'word/document.xml':
    '<w:document><w:body><w:p><w:r><w:t>Politique fictive de sauvegarde</w:t></w:r></w:p><w:p><w:r><w:t>Les sauvegardes hors site sont test&#233;es &amp; v&#xE9;rifi&#233;es chaque trimestre.</w:t></w:r></w:p></w:body></w:document>',
});

describe('extraction du texte d’un document', () => {
  it('lit le texte brut et le borne', () => {
    expect(extraireTexte('txt', Buffer.from('Procédure fictive\n\n\n\nÉtape 1\u0000'))).toEqual({
      etat: 'extrait',
      texte: 'Procédure fictive\n\nÉtape 1',
    });
    const long = extraireTexte('md', Buffer.from('a'.repeat(900_000)));
    expect(long.etat === 'extrait' && long.texte.length).toBe(400_000);
    expect(extraireTexte('txt', Buffer.from('   '))).toMatchObject({ etat: 'non_lu' });
  });

  it('lit les formats bureautiques ouverts : paragraphes, entités, diapositives, feuilles', () => {
    expect(extraireTexte('docx', DOCX)).toEqual({
      etat: 'extrait',
      texte: 'Politique fictive de sauvegarde\nLes sauvegardes hors site sont testées & vérifiées chaque trimestre.',
    });
    expect(
      extraireTexte(
        'odt',
        zip({ 'content.xml': '<office:text><text:h>Titre fictif</text:h><text:p>Corps fictif</text:p></office:text>' }),
      ),
    ).toEqual({ etat: 'extrait', texte: 'Titre fictif\nCorps fictif' });
    const pptx = extraireTexte(
      'pptx',
      zip({
        'ppt/slides/slide10.xml': '<p:sld><a:p><a:t>Dernière</a:t></a:p></p:sld>',
        'ppt/slides/slide2.xml': '<p:sld><a:p><a:t>Deuxième</a:t></a:p></p:sld>',
      }),
    );
    expect(pptx.etat === 'extrait' && pptx.texte).toBe('Diapositive 1\nDeuxième\n\nDiapositive 2\nDernière');
    expect(
      extraireTexte('xlsx', zip({ 'xl/sharedStrings.xml': '<sst><si><t>Cellule fictive</t></si></sst>' })),
    ).toEqual({
      etat: 'extrait',
      texte: 'Cellule fictive',
    });
  });

  it('dit pourquoi un format n’est pas lu, et ne lève jamais sur un fichier piégé', () => {
    expect(extraireTexte('pdf', Buffer.from('%PDF-1.4'))).toEqual({
      etat: 'non_lu',
      motif: 'Le format PDF n’est pas encore lu par l’assistant.',
    });
    expect(extraireTexte('png', Buffer.alloc(10))).toMatchObject({ etat: 'non_lu' });
    // Archive tronquée, entrée annoncée énorme, archive chiffrée, bombe de décompression.
    expect(extraireTexte('docx', DOCX.subarray(0, 40))).toMatchObject({ etat: 'non_lu' });
    expect(
      extraireTexte('docx', zip({ 'word/document.xml': '<w:p>x</w:p>' }, { tailleDeclaree: 0x7fffffff })),
    ).toMatchObject({
      etat: 'non_lu',
    });
    expect(extraireTexte('docx', zip({ 'word/document.xml': '<w:p>x</w:p>' }, { drapeaux: 1 }))).toEqual({
      etat: 'non_lu',
      motif: 'Document protégé par un mot de passe.',
    });
    expect(
      extraireTexte('docx', zip({ 'word/document.xml': 'a'.repeat(40 * 1024 * 1024) }, { tailleDeclaree: 10 })),
    ).toMatchObject({
      etat: 'non_lu',
    });
  });
});

class FauxModele implements TransportModele {
  demandes: DemandeModele[] = [];
  script: (d: DemandeModele, n: number) => MessageModele = () => ({ role: 'assistant', content: 'Réponse fictive.' });
  declare() {
    return true;
  }
  async completer(_a: string, _c: string, demande: DemandeModele): Promise<ReponseModele> {
    this.demandes.push(structuredClone(demande));
    return { message: this.script(demande, this.demandes.length), jetonsEntree: 10, jetonsSortie: 5 };
  }
}
const appel = (nom: string, args: unknown): MessageModele => ({
  role: 'assistant',
  content: '',
  tool_calls: [
    {
      id: 'a' + Math.random().toString(36).slice(2, 10),
      type: 'function',
      function: { name: nom, arguments: JSON.stringify(args) },
    },
  ],
});

let t: TestApp, modele: FauxModele, admin: Agent, sansDocuments: Agent;
const base = '/api/assistant';
const deposer = async (nom: string, contenu: Buffer, meta: Record<string, unknown> = {}) => {
  const r = await admin.req('POST', '/api/documents', {
    body: contenu,
    headers: { 'x-file-name': encodeURIComponent(nom), 'x-meta': encodeURIComponent(JSON.stringify(meta)) },
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { id: string }).id;
};
const regler = async (profil: Record<string, unknown>) => {
  const cur = (await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto;
  const r = await admin.put(`${base}/reglages`, {
    actif: true,
    adresse: 'https://modele.example.invalid/v1',
    modele: 'modele-fictif',
    budgetJetonsJour: cur.budgetJetonsJour,
    profils: cur.profils.map(({ id, actif, perimetres }) => ({
      id,
      actif,
      perimetres,
      ...(id === 'mise_en_oeuvre' ? { actif: true, ...profil } : {}),
    })),
    version: cur.version,
  });
  expect(r.statusCode, r.body).toBe(200);
};
/** Fait appeler un outil par le faux modèle, dans une conversation, et rend son résultat. */
const outil = async (a: Agent, nom: string, args: unknown) => {
  let resultat: Record<string, unknown> | null = null;
  modele.demandes = [];
  modele.script = (d, n) => {
    if (n === 1) return appel(nom, args);
    resultat = JSON.parse([...d.messages].reverse().find((m) => m.role === 'tool')!.content!) as Record<
      string,
      unknown
    >;
    return { role: 'assistant', content: 'Réponse fictive.' };
  };
  const conv = (await a.post(`${base}/conversations`, { profil: 'mise_en_oeuvre' })).json().id as string;
  const r = await a.post(`${base}/conversations/${conv}/messages`, { texte: 'Question fictive' });
  expect(r.statusCode, r.body).toBe(202);
  await t.svc.assistant.attendre(conv);
  return resultat as unknown as Record<string, unknown>;
};
const textes = async () =>
  (
    await t.svc.db.q<{ document_id: string; version: number; etat: string }>(
      'SELECT document_id::text, version, etat FROM document_textes ORDER BY 1',
    )
  ).rows;

let politique: string, secret: string, pdf: string;

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  admin = await login(t, await makeUser(t, 'doc_admin', 'admin'));
  await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ('r_sans_doc', 'Assistant sans documents', $1)", [
    ['assistant:lire', 'ecarts:lire'],
  ]);
  sansDocuments = await login(t, await makeUser(t, 'doc_sans', 'r_sans_doc'));
  expect((await admin.put(`${base}/reglages/cle`, { cle: 'cle-fictive-de-test-0123456789' })).statusCode).toBe(204);
  politique = await deposer('politique-fictive.docx', DOCX, { title: 'Politique fictive de sauvegarde' });
  secret = await deposer('note-fictive.txt', Buffer.from('Note fictive confidentielle sur les sauvegardes.'), {
    title: 'Note fictive confidentielle',
    classification: 'confidentiel',
  });
  pdf = await deposer(
    'rapport-fictif.pdf',
    Buffer.from('%PDF-1.4\n% test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n'),
    {
      title: 'Rapport fictif',
    },
  );
});
afterAll(async () => {
  await t?.close();
});

describe('assistant : index des documents', () => {
  it('n’extrait rien tant qu’aucun profil n’est autorisé à lire les documents', async () => {
    await regler({});
    expect(await t.svc.assistantDocuments.indexer()).toBe(0);
    expect(await textes()).toEqual([]);
    expect(await outil(admin, 'chercher_documents', { recherche: 'sauvegarde' })).toEqual({
      erreur: 'Ce profil de l’assistant ne lit pas les documents.',
    });
  });

  it('extrait la version courante de chaque document et dit ce qui n’est pas lu', async () => {
    await regler({ documents: true });
    expect(await t.svc.assistantDocuments.indexer()).toBe(3);
    expect(await t.svc.assistantDocuments.indexer()).toBe(0);
    const l = await textes();
    expect(l.find((x) => x.document_id === politique)).toMatchObject({ version: 1, etat: 'extrait' });
    expect(l.find((x) => x.document_id === pdf)).toMatchObject({ etat: 'non_lu' });
    expect(((await admin.get(`${base}/reglages`)).json() as ReglagesAssistantDto).indexDocuments).toEqual({
      extraits: 2,
      nonLus: 1,
      enAttente: 0,
    });
  });

  it('cherche et lit dans la limite de classification du profil', async () => {
    const r = (await outil(admin, 'chercher_documents', { recherche: 'sauvegardes' })) as {
      documents: { id: string; titre: string; extrait: string }[];
    };
    // « interne » par défaut : la note confidentielle n'est ni trouvée ni lisible.
    expect(r.documents.map((d) => d.id)).toEqual([politique]);
    expect(r.documents[0]!.extrait).toContain('hors site');
    expect(await outil(admin, 'lire_document', { id: secret })).toEqual({
      erreur: 'Document introuvable ou non ouvert à ce profil de l’assistant.',
    });
    expect(await outil(admin, 'lire_document', { id: politique })).toMatchObject({
      lisible: true,
      partie: 1,
      parties: 1,
      titre: 'Politique fictive de sauvegarde',
    });
    expect(await outil(admin, 'lire_document', { id: pdf })).toMatchObject({
      lisible: false,
      motif: 'Le format PDF n’est pas encore lu par l’assistant.',
    });

    await regler({ classificationMax: 'confidentiel' });
    const large = (await outil(admin, 'chercher_documents', { recherche: 'sauvegardes' })) as {
      documents: { id: string }[];
    };
    expect(large.documents.map((d) => d.id).sort()).toEqual([politique, secret].sort());
    await regler({ classificationMax: 'interne' });
  });

  it('refuse les documents à une personne qui n’a pas le droit de les lire', async () => {
    expect(await outil(sansDocuments, 'chercher_documents', { recherche: 'sauvegardes' })).toEqual({
      erreur: 'Les documents ne sont pas accessibles à cette personne.',
    });
    expect(await outil(sansDocuments, 'lire_document', { id: politique })).toEqual({
      erreur: 'Les documents ne sont pas accessibles à cette personne.',
    });
  });

  it('suit la version courante, puis vide l’index quand la lecture des documents est retirée', async () => {
    const r = await admin.req('POST', `/api/documents/${politique}/versions`, {
      body: Buffer.from('Politique fictive révisée : sauvegardes quotidiennes.'),
      headers: { 'x-file-name': encodeURIComponent('politique-fictive.txt') },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(await t.svc.assistantDocuments.indexer()).toBe(1);
    expect((await textes()).filter((x) => x.document_id === politique)).toEqual([
      { document_id: politique, version: 2, etat: 'extrait' },
    ]);
    expect(await outil(admin, 'lire_document', { id: politique })).toMatchObject({ version: 2 });

    await regler({ documents: false });
    await t.svc.assistantDocuments.indexer();
    expect(await textes()).toEqual([]);
  });
});
