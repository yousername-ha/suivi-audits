/* Refonte de densité du 21/11/2026 : les explications quittent la vue permanente, sans perdre les informations, les
   liens ni les commandes de page. Le cache de la liste d'affectation ne peut pas remplacer le bilan par périmètre
   (régression visible après navigation Machines → Périmètres). Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { PerimetreAffectableDto, PerimetresVulnerabilitesDto } from '@suivi/shared';
import { QueryClient } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EnteteVulnerabilites } from '../src/vulnerabilites/EnteteVulnerabilites';
import { ListePerimetres } from '../src/vulnerabilites/Perimetres';
import { CLE_PERIMETRES, CLE_PERIMETRES_AFFECTABLES } from '../src/vulnerabilites/perimetres-presentation';

const rendu = (element: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, element));

describe('explications de page disponibles à la demande', () => {
  it('garde le titre et les commandes visibles, ainsi que le texte complet et ses liens dans une aide fermée', () => {
    const html = rendu(
      createElement(EnteteVulnerabilites, {
        title: 'Produits surveillés',
        actions: createElement('button', { type: 'button' }, 'Ajouter un produit'),
        description: createElement(
          'span',
          null,
          'La version déclarée sert au rapprochement. ',
          createElement('a', { href: '/aide/vulnerabilites' }, 'Lire la méthode'),
        ),
      }),
    );
    const position = html.indexOf('<details');
    expect(position).toBeGreaterThan(0);
    expect(html.slice(0, position)).toMatch(/<h1[^>]*>Produits surveillés<\/h1>/);
    expect(html.slice(0, position)).toContain('Ajouter un produit');
    expect(html).toContain('<summary>À propos de cette page</summary>');
    expect(html).toContain('La version déclarée sert au rapprochement.');
    expect(html).toContain('href="/aide/vulnerabilites"');
    expect(html).not.toMatch(/<details[^>]*\bopen(?:[=>\s])/);
    expect(html.match(/La version déclarée sert au rapprochement\./g)).toHaveLength(1);
  });

  it('ne crée pas de commande d’aide vide quand la page ne fournit aucune description', () => {
    const html = rendu(createElement(EnteteVulnerabilites, { title: 'Périmètres' }));
    expect(html).toContain('Périmètres');
    expect(html).not.toContain('<details');
  });
});

describe('navigation Machines / Périmètres sans collision du cache', () => {
  it.each(['machines puis périmètres', 'périmètres puis machines'])('%s', async (ordre) => {
    const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const options: PerimetreAffectableDto[] = [{ id: '00000000-0000-4000-8000-000000000001', nom: 'Périmètre fictif' }];
    const bilan: PerimetresVulnerabilitesDto = { perimetres: [], sansPerimetre: null };
    let requetes = 0;
    const chargerOptions = () =>
      cache.fetchQuery({
        queryKey: CLE_PERIMETRES_AFFECTABLES,
        queryFn: async () => {
          requetes++;
          return options;
        },
      });
    const chargerBilan = () =>
      cache.fetchQuery({
        queryKey: CLE_PERIMETRES,
        queryFn: async () => {
          requetes++;
          return bilan;
        },
      });
    if (ordre === 'machines puis périmètres') {
      await chargerOptions();
      await chargerBilan();
    } else {
      await chargerBilan();
      await chargerOptions();
    }
    const cartes = await chargerBilan();
    const affectables = await chargerOptions();
    expect(cartes).toEqual(bilan);
    expect(affectables).toEqual(options);
    expect(requetes).toBe(2);
    expect(rendu(createElement(ListePerimetres, { liste: cartes, onOuvrir: () => {} }))).toContain(
      'Aucun périmètre que vous puissiez lire.',
    );
    cache.clear();
  });
});
