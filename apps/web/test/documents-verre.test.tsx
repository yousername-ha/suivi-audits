/* Documents en style « Verre » (dessin DocDocuments validé par le RSSI le 28/11/2026) : type de fichier d'après
   l'extension ou le type MIME, règle « à revoir » (non modifié depuis plus d'un an, décision du RSSI du 28/11/2026),
   compteurs des tuiles, puces et filtre de classification, lignes, document choisi et zone de dépôt. Seules les valeurs
   rendues par l'API sont affichées. Données fictives, rendu statique sans réseau. */
import { MantineProvider } from '@mantine/core';
import type { DocumentDetailOut, DocumentOut } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  aRevoir,
  detailTypes,
  filtrerClassification,
  metaDocument,
  pucesClassification,
  refsLigne,
  tuilesDocuments,
  typeFichier,
  versionsFrise,
} from '../src/pages/documents-verre';
import {
  BadgeFichier,
  ListeDocumentsVerre,
  PanneauDocumentVerre,
  TuilesDocumentsVerre,
  ZoneDepotVerre,
} from '../src/pages/DocumentsVerre';
import { fmtSize } from '../src/components/common';

const html = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MantineProvider, null, n))
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
const texte = (h: string) =>
  h
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const rien = () => undefined;
const MAINTENANT = Date.parse('2026-11-28T10:00:00Z');

let n = 0;
const doc = (p: Partial<DocumentOut> = {}): DocumentOut => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  title: 'Document fictif',
  description: '',
  category: '',
  refs: [],
  tags: [],
  classification: 'interne',
  current_version: 1,
  version: 1,
  created_by: 'personne.fictive',
  created_at: '2026-01-10T09:00:00Z',
  updated_by: 'personne.fictive',
  updated_at: '2026-11-14T09:00:00Z',
  deleted_at: null,
  deleted_by: null,
  filename: 'fictif.pdf',
  mime: 'application/pdf',
  size: 1258291,
  sha256: 'a'.repeat(64),
  scan_status: 'clean',
  uploaded_by: 'personne.fictive',
  uploaded_at: '2026-11-14T09:00:00Z',
  ...p,
});

describe('type de fichier', () => {
  it('d’après l’extension : PDF, DOC, XLSX, CSV, PPTX, IMG, avec la famille de sa couleur', () => {
    expect(typeFichier('politique.PDF', null)).toEqual({ libelle: 'PDF', famille: 'pdf' });
    expect(typeFichier('charte.docx', null)).toEqual({ libelle: 'DOC', famille: 'texte' });
    expect(typeFichier('charte.odt', null)).toEqual({ libelle: 'DOC', famille: 'texte' });
    expect(typeFichier('dda.xlsx', null)).toEqual({ libelle: 'XLSX', famille: 'tableur' });
    expect(typeFichier('export.csv', null)).toEqual({ libelle: 'CSV', famille: 'tableur' });
    expect(typeFichier('revue.pptx', null)).toEqual({ libelle: 'PPTX', famille: 'presentation' });
    expect(typeFichier('schema.png', null)).toEqual({ libelle: 'IMG', famille: 'image' });
  });

  it('à défaut d’extension connue, d’après le type MIME (paramètres ignorés)', () => {
    expect(typeFichier('sans-extension', 'application/pdf')).toEqual({ libelle: 'PDF', famille: 'pdf' });
    expect(
      typeFichier(null, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=binary'),
    ).toEqual({ libelle: 'XLSX', famille: 'tableur' });
    expect(typeFichier('note', 'text/plain')).toEqual({ libelle: 'TXT', famille: 'autre' });
  });

  it('extension inconnue : badge neutre à son nom ; ni nom ni type : aucun badge inventé', () => {
    expect(typeFichier('plan.vsdx', 'application/octet-stream')).toEqual({ libelle: 'VSDX', famille: 'autre' });
    expect(typeFichier(null, null)).toBeNull();
    expect(typeFichier('sans-extension', 'application/octet-stream')).toBeNull();
    const vide = html(<BadgeFichier nom={null} mime={null} />);
    expect(vide).toContain('data-type="autre"');
    expect(vide).toContain('aria-hidden="true"');
    expect(texte(vide)).toBe('');
    expect(html(<BadgeFichier nom="a.docx" mime={null} />)).toMatch(/data-type="texte"[^>]*>DOC</);
  });
});

describe('à revoir : non modifié depuis plus d’un an', () => {
  it('limite au même jour un an plus tôt ; une date illisible ne compte pas', () => {
    expect(aRevoir({ updated_at: '2025-11-28T09:59:59Z' }, MAINTENANT)).toBe(true);
    expect(aRevoir({ updated_at: '2025-11-28T10:00:00Z' }, MAINTENANT)).toBe(false);
    expect(aRevoir({ updated_at: '2026-06-01T00:00:00Z' }, MAINTENANT)).toBe(false);
    expect(aRevoir({ updated_at: '2023-01-01T00:00:00Z' }, MAINTENANT)).toBe(true);
    expect(aRevoir({ updated_at: 'pas une date' }, MAINTENANT)).toBe(false);
  });
});

describe('tuiles, puces et filtre', () => {
  const registre = [
    doc({ category: 'Politique', refs: ['A.5.1', 'Clause 5.2'], classification: 'interne' }),
    doc({ category: 'Charte', filename: 'charte.docx', mime: null, classification: 'interne' }),
    doc({ category: 'Politique ', filename: 'dda.xlsx', refs: ['A.5.30'], classification: 'restreint' }),
    doc({ category: '', updated_at: '2024-03-04T09:00:00Z', classification: 'confidentiel' }),
    doc({ filename: null, mime: null, size: null, classification: 'confidentiel', updated_at: '2025-01-01T09:00:00Z' }),
  ];

  it('compteurs : total, types et catégories distincts, rattachés, à revoir, confidentiels', () => {
    const t = tuilesDocuments(registre, MAINTENANT);
    expect(t).toEqual({ total: 5, types: 3, categories: 2, rattaches: 2, aRevoir: 2, confidentiels: 2 });
    expect(detailTypes(t)).toBe('3 types, 2 catégories');
    expect(detailTypes({ types: 1, categories: 0 })).toBe('1 type, 0 catégorie');
    expect(tuilesDocuments([], MAINTENANT)).toEqual({
      total: 0,
      types: 0,
      categories: 0,
      rattaches: 0,
      aRevoir: 0,
      confidentiels: 0,
    });
  });

  it('puces de classification : seules celles présentes, avec leur nombre et leur libellé', () => {
    expect(pucesClassification(registre).map((o) => [o.value, o.label, o.compte])).toEqual([
      ['confidentiel', 'Confidentiel', 2],
      ['interne', 'Interne', 2],
      ['restreint', 'Restreint', 1],
    ]);
  });

  it('filtre par classification fait dans le navigateur ; sans filtre, toute la liste', () => {
    expect(filtrerClassification(registre, 'confidentiel')).toHaveLength(2);
    expect(filtrerClassification(registre, 'public')).toEqual([]);
    expect(filtrerClassification(registre, null)).toHaveLength(5);
  });

  it('ligne : deux rattachements puis « +N » ; méta sans valeur absente', () => {
    expect(refsLigne(['A.5.24', 'A.5.26', 'A.5.27'])).toEqual({ visibles: ['A.5.24', 'A.5.26'], reste: 1 });
    expect(refsLigne(['A.5.1'])).toEqual({ visibles: ['A.5.1'], reste: 0 });
    expect(metaDocument({ category: 'Politique', current_version: 4, size: 1258291 }, fmtSize)).toBe(
      'Politique · v4 · 1.2 Mo',
    );
    expect(metaDocument({ category: ' ', current_version: 1, size: null }, fmtSize)).toBe('v1');
  });

  it('tuiles rendues : nombre, « / total » pour les rattachés, détail', () => {
    const h = html(<TuilesDocumentsVerre t={tuilesDocuments(registre, MAINTENANT)} />);
    expect(h).toContain('aria-label="Synthèse du registre documentaire"');
    expect([...h.matchAll(/data-tuile="([^"]+)".*?__nombre">(\d+)</g)].map((m) => [m[1], m[2]])).toEqual([
      ['documents', '5'],
      ['rattaches', '2'],
      ['a-revoir', '2'],
      ['confidentiels', '2'],
    ]);
    const t = texte(h);
    expect(t).toContain('Rattachés 2 / 5');
    expect(t).toContain('3 types, 2 catégories');
    expect(t).toContain('non modifiés depuis plus d’un an');
  });
});

describe('liste et document choisi', () => {
  const a = doc({
    title: 'Politique fictive',
    category: 'Politique',
    current_version: 4,
    refs: ['Clause 5.2', 'A.5.1', 'A.5.2'],
    classification: 'interne',
  });
  const b = doc({
    title: 'Plan fictif',
    filename: 'plan.xlsx',
    mime: null,
    classification: 'confidentiel',
    size: null,
  });

  it('lignes : badge, titre surligné, méta, deux rattachements et « +1 », classification, date ; ligne choisie', () => {
    const h = html(<ListeDocumentsVerre documents={[a, b]} choisi={a.id} recherche="fictive" onChoisir={rien} />);
    expect(h).toContain('aria-label="Documents"');
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(h).toMatch(/aria-pressed="true" aria-label="Afficher Politique fictive"/);
    expect(h).toContain('<mark class="surligne">fictive</mark>');
    expect(h).toMatch(/data-type="pdf"[^>]*>PDF</);
    expect(h).toMatch(/data-type="tableur"[^>]*>XLSX</);
    const t = texte(h);
    expect(t).toContain('Politique · v4 · 1.2 Mo Clause 5.2 A.5.1 +1');
    expect(t).not.toContain('A.5.2');
    expect(h).toMatch(/data-classification="interne">Interne</);
    expect(h).toMatch(/data-classification="confidentiel">Confidentiel</);
    expect(t).toContain('14/11/2026');
    // Sans taille ni catégorie : seule la version est écrite.
    expect(t).toContain('Plan fictif v1');
  });

  it('liste vide : message, pas de ligne', () => {
    const h = html(<ListeDocumentsVerre documents={[]} choisi={undefined} recherche="" onChoisir={rien} />);
    expect(texte(h)).toBe('Aucun document.');
  });

  const detail = (p: Partial<DocumentDetailOut> = {}): DocumentDetailOut => ({
    ...a,
    description: 'Description fictive.',
    tags: ['Étiquette fictive'],
    versions: [
      {
        version: 3,
        filename: 'politique-v3.pdf',
        mime: 'application/pdf',
        size: 1000,
        sha256: 'b'.repeat(64),
        scan_status: 'clean',
        uploaded_by: 'personne.fictive',
        uploaded_at: '2026-06-02T09:00:00Z',
        comment: '',
      },
      {
        version: 4,
        filename: 'politique-v4.pdf',
        mime: 'application/pdf',
        size: 1000,
        sha256: 'c'.repeat(64),
        scan_status: 'clean',
        uploaded_by: 'personne.fictive',
        uploaded_at: '2026-11-14T09:00:00Z',
        comment: 'Révision fictive',
      },
    ],
    ...p,
  });

  it('frise des versions de la plus récente à la plus ancienne', () => {
    expect(versionsFrise(detail().versions).map((v) => v.version)).toEqual([4, 3]);
  });

  it('document choisi : en-tête, description, rattachements, étiquettes, frise, actions', () => {
    const h = html(
      <PanneauDocumentVerre
        d={detail()}
        peutDeposerVersion
        onTelecharger={rien}
        onTelechargerVersion={rien}
        onNouvelleVersion={rien}
        onFiche={rien}
        onEtiquette={rien}
      />,
    );
    const t = texte(h);
    expect(t).toContain('Politique fictive');
    expect(t).toContain('Description fictive.');
    expect(t).toContain('Rattachements · 3');
    expect(h).toContain('aria-label="Filtrer sur l’étiquette Étiquette fictive"');
    // Version courante en premier, mise en avant ; commentaire, à défaut fichier et taille.
    expect(h).toMatch(/data-courante="true".*?v4/);
    expect(t).toMatch(/v4 · 14\/11\/2026 Révision fictive v3 · 02\/06\/2026 politique-v3\.pdf · 1000 o/);
    expect(h).toContain('aria-label="Télécharger la version 4 (politique-v4.pdf)"');
    expect(t).toContain('Télécharger');
    expect(t).toContain('Nouvelle version');
    expect(h).toContain('aria-label="Modifier la fiche"');
  });

  it('sans donnée, pas de bloc : ni description, ni rattachements, ni étiquettes ; sans droit, pas de nouvelle version', () => {
    const h = html(
      <PanneauDocumentVerre
        d={detail({ description: '', refs: [], tags: [], category: '', deleted_at: '2026-11-20T09:00:00Z' })}
        peutDeposerVersion={false}
        onTelecharger={rien}
        onTelechargerVersion={rien}
        onNouvelleVersion={rien}
        onFiche={rien}
        libelleFiche="Ouvrir la fiche"
      />,
    );
    const t = texte(h);
    expect(h).not.toContain('docv-detail__description');
    expect(t).not.toContain('Rattachements');
    expect(t).not.toContain('Étiquettes');
    expect(t).not.toContain('Nouvelle version');
    expect(t).toContain('Dans la corbeille depuis le');
    expect(h).toContain('aria-label="Ouvrir la fiche"');
  });

  it('zone de dépôt : glisser-déposer et bouton pour choisir, sans limite de taille inventée', () => {
    const t = texte(html(<ZoneDepotVerre enCours={false} onDeposer={rien} />));
    expect(t).toBe('Glissez des fichiers ici pour les déposer ou choisissez-les');
    expect(texte(html(<ZoneDepotVerre enCours onDeposer={rien} />))).toContain('Dépôt en cours…');
  });
});

describe('branchement sur le style d’instance', () => {
  const source = readFileSync(new URL('../src/pages/Documents.tsx', import.meta.url), 'utf8');
  it('rendu Verre seulement pour le style « Verre », rendu classique inchangé sinon', () => {
    expect(source).toContain("const verre = useMe().appearance.style === 'verre';");
    expect(source).toContain('return verre ? <DocumentsPageVerre /> : <DocumentsPageClassique />;');
  });
  it('mêmes appels : dépôt, nouvelle version, corbeille, liens ; rail « Documents · N | Liens · N »', () => {
    expect(source).toContain("await api('POST', '/api/documents', {");
    expect(source).toContain("await api('POST', `/api/documents/${docId}/versions`, {");
    expect(source).toContain("queryFn: () => get<DocumentOut[]>('/api/documents?tri=modifie&ordre=desc&trash=1'),");
    expect(source).toContain('<Tabs.Tab value="docs">Documents{nombre(registre.data?.length)}</Tabs.Tab>');
    expect(source).toContain('<Tabs.Tab value="links">Liens{nombre(liens.data?.length)}</Tabs.Tab>');
    expect(source).toContain('Corbeille{nombre(corbeille.data?.length)}');
  });
  it('« Déposer des documents » : bouton principal plein (dégradé violet du Verre) dans l’en-tête Verre seulement', () => {
    const verre = source.slice(source.indexOf('function DocumentsPageVerre'), source.indexOf('function DocumentList'));
    const classique = source.slice(source.indexOf('function DocumentList'), source.indexOf('function DocumentDetail'));
    expect(verre).toContain('<Button {...props} variant="filled" loading={uploading}>');
    expect(classique).toContain('<Button {...props} loading={uploading}>');
    expect(classique).not.toContain('variant="filled"');
  });
});
