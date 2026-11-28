/* Liens en style « Verre » (dessin DocLiens validé par le RSSI le 28/11/2026) : genre déduit de l'adresse (site web,
   partage réseau, fichier, autre), compteurs des tuiles, puces et filtre par genre, adresse abrégée, lignes et lien
   choisi. Seules les valeurs rendues par l'API sont affichées. Données fictives (adresses en .exemple.invalid, partages
   \\srv-fictif\…), rendu statique sans réseau. */
import { MantineProvider } from '@mantine/core';
import type { LinkOut } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  adresseCourte,
  detailGenres,
  filtrerGenre,
  genreLien,
  pucesGenre,
  tuilesLiens,
} from '../src/pages/liens-verre';
import { IconeLien, ListeLiensVerre, PanneauLienVerre, TuilesLiensVerre } from '../src/pages/LiensVerre';

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

let n = 0;
const lien = (p: Partial<LinkOut> = {}): LinkOut => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  title: 'Lien fictif',
  url: 'https://portail.exemple.invalid/',
  description: '',
  category: '',
  refs: [],
  tags: [],
  version: 1,
  created_by: 'personne.fictive',
  created_at: '2026-01-10T09:00:00Z',
  updated_by: 'personne.fictive',
  updated_at: '2026-11-20T09:00:00Z',
  ...p,
});

describe('genre déduit de l’adresse', () => {
  it('site web : http et https, quelle que soit la casse', () => {
    expect(genreLien('https://portail.exemple.invalid/declarer')).toBe('web');
    expect(genreLien('http://intranet.exemple.invalid')).toBe('web');
    expect(genreLien('  HTTPS://PORTAIL.EXEMPLE.INVALID  ')).toBe('web');
  });
  it('partage réseau : \\\\serveur\\… et smb://', () => {
    expect(genreLien('\\\\srv-fictif\\dsi\\procedures')).toBe('partage');
    expect(genreLien('smb://srv-fictif/qualite')).toBe('partage');
    expect(genreLien('SMB://srv-fictif/qualite')).toBe('partage');
  });
  it('fichier : file://', () => {
    expect(genreLien('file:///D:/crise/annuaire.xlsx')).toBe('fichier');
    expect(genreLien('file://srv-fictif/partage/a.txt')).toBe('fichier');
  });
  it('toute autre adresse est neutre (lecteur, protocole inconnu, texte)', () => {
    expect(genreLien('D:\\crise\\annuaire.xlsx')).toBe('autre');
    expect(genreLien('ftp://depot.exemple.invalid')).toBe('autre');
    expect(genreLien('https:/manque-une-barre')).toBe('autre');
    expect(genreLien('\\un-seul\\antislash')).toBe('autre');
    expect(genreLien('')).toBe('autre');
  });
  it('icône : globe, dossier, page ou neutre, selon le genre', () => {
    expect(html(<IconeLien url="https://a.exemple.invalid" />)).toContain('data-genre="web"');
    expect(html(<IconeLien url={'\\\\srv-fictif\\dsi'} />)).toContain('data-genre="partage"');
    expect(html(<IconeLien url="file:///C:/a.txt" />)).toContain('data-genre="fichier"');
    const autre = html(<IconeLien url={'D:\\a.txt'} />);
    expect(autre).toContain('data-genre="autre"');
    expect(autre).toContain('aria-hidden="true"');
  });
});

describe('adresse abrégée des lignes', () => {
  it('un site web perd son protocole et sa barre finale ; les autres adresses restent entières', () => {
    expect(adresseCourte('https://signalement.exemple.invalid/')).toBe('signalement.exemple.invalid');
    expect(adresseCourte('http://esante.exemple.invalid/hds')).toBe('esante.exemple.invalid/hds');
    expect(adresseCourte('https://a.exemple.invalid/x/?q=1')).toBe('a.exemple.invalid/x/?q=1');
    expect(adresseCourte('\\\\srv-fictif\\dsi\\procedures')).toBe('\\\\srv-fictif\\dsi\\procedures');
    expect(adresseCourte('file:///D:/crise/annuaire.xlsx')).toBe('file:///D:/crise/annuaire.xlsx');
  });
});

describe('tuiles, puces et filtre', () => {
  const liste = [
    lien({ url: 'https://a.exemple.invalid/', refs: ['A.5.24', 'Incidents'] }),
    lien({ url: 'https://b.exemple.invalid/hds', refs: ['HDS'] }),
    lien({ url: 'http://c.exemple.invalid/' }),
    lien({ url: '\\\\srv-fictif\\dsi\\procedures', refs: ['A.5.37'] }),
    lien({ url: '\\\\srv-fictif\\qualite\\audit', refs: ['Clause 9.2'] }),
    lien({ url: 'file:///D:/crise/annuaire.xlsx', refs: ['A.5.29'] }),
  ];

  it('compteurs : total, genres présents dans l’ordre, rattachés, partages, sites web', () => {
    const t = tuilesLiens(liste);
    expect(t).toEqual({ total: 6, genres: ['web', 'partage', 'fichier'], rattaches: 5, partages: 2, web: 3 });
    expect(detailGenres(t)).toBe('3 genres : sites, partages, fichiers');
    expect(detailGenres({ genres: ['partage'] })).toBe('1 genre : partages');
    expect(detailGenres({ genres: ['web', 'autre'] })).toBe('2 genres : sites, autres');
    expect(tuilesLiens([])).toEqual({ total: 0, genres: [], rattaches: 0, partages: 0, web: 0 });
    expect(detailGenres(tuilesLiens([]))).toBe('aucun genre');
  });

  it('puces de genre : seuls les genres présents, avec leur nombre, dans l’ordre web, partage, fichier, autre', () => {
    expect(pucesGenre(liste).map((o) => [o.value, o.label, o.compte])).toEqual([
      ['web', 'Sites web', 3],
      ['partage', 'Partages réseau', 2],
      ['fichier', 'Fichiers', 1],
    ]);
    expect(pucesGenre([lien({ url: 'D:\\a.txt' }), lien()]).map((o) => o.label)).toEqual([
      'Sites web',
      'Autres adresses',
    ]);
    expect(pucesGenre([])).toEqual([]);
  });

  it('filtre par genre fait dans le navigateur ; sans genre, toute la liste', () => {
    expect(filtrerGenre(liste, 'web')).toHaveLength(3);
    expect(filtrerGenre(liste, 'partage').map((l) => l.url)).toEqual([
      '\\\\srv-fictif\\dsi\\procedures',
      '\\\\srv-fictif\\qualite\\audit',
    ]);
    expect(filtrerGenre(liste, 'autre')).toEqual([]);
    expect(filtrerGenre(liste, null)).toHaveLength(6);
  });

  it('tuiles rendues : nombre, « / total » pour les rattachés, détail sans promesse d’ouverture des partages', () => {
    const h = html(<TuilesLiensVerre t={tuilesLiens(liste)} />);
    expect(h).toContain('aria-label="Synthèse des liens"');
    expect([...h.matchAll(/data-tuile="([^"]+)".*?__nombre">(\d+)</g)].map((m) => [m[1], m[2]])).toEqual([
      ['liens', '6'],
      ['rattaches', '5'],
      ['partages', '2'],
      ['web', '3'],
    ]);
    const t = texte(h);
    expect(t).toContain('Rattachés 5 / 6');
    expect(t).toContain('3 genres : sites, partages, fichiers');
    expect(t).toContain('adresses \\\\serveur\\…');
    expect(t).toContain('ouverts dans un nouvel onglet');
    expect(t).not.toContain('réseau interne');
  });
});

describe('liste et lien choisi', () => {
  const a = lien({
    title: 'Portail fictif de déclaration',
    url: 'https://signalement.exemple.invalid/declarer',
    category: 'Déclaration',
    refs: ['A.5.24', 'Incidents', 'A.5.26'],
    updated_at: '2026-11-20T09:00:00Z',
  });
  const b = lien({
    title: 'Procédures fictives',
    url: '\\\\srv-fictif\\dsi\\procedures',
    updated_at: '2026-11-14T09:00:00Z',
  });

  it('lignes : icône, titre et adresse surlignés, adresse abrégée (complète en infobulle), deux rattachements et « +1 », catégorie, date ; ligne choisie', () => {
    const h = html(<ListeLiensVerre liens={[a, b]} choisi={a.id} recherche="fict" onChoisir={rien} />);
    expect(h).toContain('aria-label="Liens"');
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(h).toMatch(/aria-pressed="true" aria-label="Afficher Portail fictif de déclaration"/);
    expect(h).toContain('Portail <mark class="surligne">fict</mark>if de déclaration');
    expect(h).toMatch(/data-genre="web"/);
    expect(h).toMatch(/data-genre="partage"/);
    expect(h).toContain('title="https://signalement.exemple.invalid/declarer"');
    expect(h).toMatch(/class="lienv-adresse"[^>]*>signalement\.exemple\.invalid\/declarer</);
    expect(h).toContain('\\\\srv-<mark class="surligne">fict</mark>if\\dsi\\procedures');
    const t = texte(h);
    expect(t).toContain('A.5.24 Incidents +1');
    expect(t).not.toContain('A.5.26');
    expect(t).toContain('Déclaration');
    expect(t).toContain('20/11/2026');
    expect(t).toContain('14/11/2026');
    // Sans rattachement ni catégorie : ni puce vide, ni « +0 » (le partage n'a que son titre, son adresse et sa date).
    expect(t).toMatch(/Procédures fict ives \\\\srv- fict if\\dsi\\procedures 14\/11\/2026$/);
    expect(t).not.toContain('+0');
  });

  it('liste vide : message, pas de ligne', () => {
    expect(texte(html(<ListeLiensVerre liens={[]} choisi={undefined} recherche="" onChoisir={rien} />))).toBe(
      'Aucun lien.',
    );
  });

  it('lien choisi : genre et catégorie, adresse complète et copie, description, rattachements, étiquettes, ouverture et modification', () => {
    const h = html(
      <PanneauLienVerre
        l={{ ...a, description: 'Description fictive.', tags: ['Étiquette fictive'] }}
        onModifier={rien}
        onEtiquette={rien}
      />,
    );
    const t = texte(h);
    expect(t).toContain('Portail fictif de déclaration Site web Déclaration');
    expect(t).toContain('Adresse https://signalement.exemple.invalid/declarer');
    expect(h).toContain('aria-label="Copier l’adresse"');
    expect(t).toContain('Description fictive.');
    expect(t).toContain('Rattachements · 3');
    expect(h).toMatch(/data-ton="rattachement">A\.5\.26</);
    expect(h).toContain('aria-label="Filtrer sur l’étiquette Étiquette fictive"');
    // Ouverture : la même que le rendu classique, l'adresse enregistrée dans un nouvel onglet.
    expect(h).toMatch(
      /<a class="docv-gelule docv-gelule--primaire" href="https:\/\/signalement\.exemple\.invalid\/declarer" target="_blank" rel="noopener noreferrer">Ouvrir le lien<\/a>/,
    );
    expect(h).toContain('aria-label="Modifier le lien"');
  });

  it('partage : même ouverture (adresse enregistrée, nouvel onglet), genre « Partage réseau » ; sans donnée, pas de bloc ; sans droit, pas de Modifier', () => {
    const h = html(<PanneauLienVerre l={b} />);
    const t = texte(h);
    expect(t).toContain('Procédures fictives Partage réseau');
    expect(h).toContain('href="\\\\srv-fictif\\dsi\\procedures" target="_blank" rel="noopener noreferrer"');
    expect(h).not.toContain('docv-detail__description');
    expect(t).not.toContain('Rattachements');
    expect(t).not.toContain('Étiquettes');
    expect(h).not.toContain('Modifier le lien');
    expect(texte(html(<PanneauLienVerre l={b} suppression={<button type="button">Supprimer</button>} />))).toContain(
      'Supprimer',
    );
  });
});

describe('branchement de l’onglet Liens', () => {
  const source = readFileSync(new URL('../src/pages/Documents.tsx', import.meta.url), 'utf8');
  const verre = source.slice(source.indexOf('function DocumentsPageVerre'), source.indexOf('function DocumentList'));
  const liensVerre = source.slice(source.indexOf('function LiensPageVerre'));
  const classique = source.slice(source.indexOf('function LinkList'), source.indexOf('function LiensPageVerre'));

  it('style « Verre » : onglet Liens en lignes de verre, rendu classique (LinkList) gardé hors du Verre', () => {
    expect(verre).toContain('<LiensPageVerre');
    expect(verre).not.toContain('<LinkList');
    expect(source).toContain('<LinkList canWrite={canWrite} />');
  });

  it('« Ajouter un lien » : bouton principal plein dans l’en-tête, onglet Liens et droit de modifier seulement', () => {
    expect(verre).toContain("{canWrite && tab === 'links' && (");
    expect(verre).toContain('<Button variant="filled" onClick={() => setLienEdite({ refs: [], tags: [] })}>');
    expect(verre).toContain('<FenetreLien edit={lienEdite} setEdit={setLienEdite} />');
    expect(classique).toContain('<FenetreLien edit={edit} setEdit={setEdit} />');
  });

  it('lien choisi dans l’adresse (/documents?lien=…), qui ouvre l’onglet Liens', () => {
    expect(verre).toContain("const lienId = adresse.get('lien') ?? undefined;");
    expect(verre).toContain("useState<string | null>(lienId ? 'links' : 'docs')");
    expect(verre).toContain('onChoisir={(lien) => nav(`/documents?lien=${encodeURIComponent(lien)}`)}');
  });

  it('mêmes droits : Modifier avec le droit de modifier, Supprimer avec les droits de modifier et de supprimer', () => {
    expect(liensVerre).toContain('onModifier={canWrite ? () => onModifier(lien) : undefined}');
    expect(liensVerre).toContain('canWrite &&\n                canDelete && (');
    expect(liensVerre).toContain("api('DELETE', `/api/links/${lien.id}`)");
  });

  it('mêmes appels : liste et base partagées avec le rendu classique, recherche validée et puces de genre', () => {
    expect(liensVerre).toContain('const { list, base } = useListeLiens({ q, tags, tri });');
    expect(classique).toContain('const { list, base } = useListeLiens({ q, tags, tri });');
    expect(liensVerre).toContain(
      "{ cle: 'genre', libelle: 'Genre', valeur: genre, options: pucesGenre(tous), onChange: setGenre }",
    );
    expect(liensVerre).toContain('libelleTout="Tous"');
  });
});
