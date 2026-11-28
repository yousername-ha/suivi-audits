/* Exports Excel en style « Verre » (dessin DocExports validé par le RSSI le 28/11/2026) : bandeau Classique / Pro, une
   carte par rubrique rendue par l'API (icône teintée selon la rubrique, nombre de feuilles, boutons Classique et Pro),
   export complet violet en dernier, dont le nombre de feuilles est la somme de celles des rubriques. Données fictives,
   rendu statique sans réseau. */
import { MantineProvider } from '@mantine/core';
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BandeauModesExport,
  GrilleExportsVerre,
  libelleFeuilles,
  totalFeuilles,
  type GroupeExport,
} from '../src/pages/ExportsVerre';

const html = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MantineProvider, null, n))
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&');
const texte = (h: string) =>
  h
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const rien = () => undefined;

const groupes: GroupeExport[] = [
  { id: 'audit', titre: 'Rubrique fictive A', description: 'Description fictive A.', feuilles: 4 },
  { id: 'ec', titre: 'Rubrique fictive B', description: 'Description fictive B.', feuilles: 1 },
  { id: 'zz', titre: 'Rubrique fictive C', description: 'Description fictive C.', feuilles: 2 },
];

describe('nombre de feuilles', () => {
  it('export complet : somme des feuilles des rubriques ; libellé au singulier ou au pluriel', () => {
    expect(totalFeuilles(groupes)).toBe(7);
    expect(totalFeuilles([])).toBe(0);
    expect(libelleFeuilles(1)).toBe('1 feuille');
    expect(libelleFeuilles(7)).toBe('7 feuilles');
  });
});

describe('rendu « Verre »', () => {
  it('bandeau : ce que contiennent les modes Classique et Pro', () => {
    const t = texte(html(<BandeauModesExport />));
    expect(t).toContain('Classique Données brutes, filtres activés');
    expect(t).toContain('Pro Mise en forme avec sommaire et pagination');
  });

  it('une carte par rubrique dans l’ordre de l’API, puis l’export complet violet en dernier', () => {
    const h = html(<GrilleExportsVerre groupes={groupes} onExport={rien} />);
    expect([...h.matchAll(/data-groupe="([^"]+)"/g)].map((m) => m[1])).toEqual(['audit', 'ec', 'zz', 'all']);
    expect(h.match(/data-complet="true"/g)).toHaveLength(1);
    expect(h).toMatch(/data-groupe="all" data-complet="true"/);
    const t = texte(h);
    expect(t).toContain('Rubrique fictive A Description fictive A. 4 feuilles Classique Pro');
    expect(t).toContain('Rubrique fictive B Description fictive B. 1 feuille Classique Pro');
    expect(t).toContain(
      'Export complet Toutes les rubriques, une feuille par jeu de données. 7 feuilles Classique Pro',
    );
  });

  it('boutons nommés comme le rendu classique ; Pro mis en avant sur l’export complet seulement', () => {
    const h = html(<GrilleExportsVerre groupes={groupes} onExport={rien} />);
    expect(h).toContain('aria-label="Excel classique : Rubrique fictive A"');
    expect(h).toContain('aria-label="Excel pro : Rubrique fictive A"');
    expect(h).toContain('aria-label="Excel classique : export complet"');
    expect(h).toContain('aria-label="Excel pro : export complet"');
    expect(h.match(/data-pro="true"/g)).toHaveLength(1);
    expect(h).toMatch(/data-pro="true" aria-label="Excel pro : export complet"/);
  });

  it('liste des rubriques pas encore lue : pas de nombre de feuilles inventé pour l’export complet', () => {
    const t = texte(html(<GrilleExportsVerre groupes={undefined} onExport={rien} />));
    expect(t).toBe('Export complet Toutes les rubriques, une feuille par jeu de données. Classique Pro');
  });
});

describe('branchement sur le style d’instance', () => {
  const source = readFileSync(new URL('../src/pages/Exports.tsx', import.meta.url), 'utf8');
  it('rendu Verre seulement pour le style « Verre », même appel de téléchargement', () => {
    expect(source).toContain("const verre = useMe().appearance.style === 'verre';");
    expect(source).toContain('if (verre)');
    expect(source).toContain('download(`/api/suivi/export?groupe=${groupe}&mode=${mode}');
    expect(source).toContain('onExport={(g, mode) => lien(g, mode)()}');
  });
});
