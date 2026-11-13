/* Pictogrammes du menu bleu nuit (refonte Neon, ADR 0093) : décoratifs, une teinte par identité, masque de la coche unique
   par instance, aucun style en ligne (CSP). */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IconeMenu, IDENTITES_MENU, MENU, variablesMenu } from '@suivi/ui';

describe('menu bleu nuit : pictogrammes et teintes', () => {
  it('chaque identité a un pictogramme décoratif sans style en ligne', () => {
    for (const identite of [...IDENTITES_MENU, 'retex' as const]) {
      const html = renderToStaticMarkup(createElement(IconeMenu, { identite }));
      expect(html, identite).toContain('aria-hidden="true"');
      expect(html, identite).toContain('<svg');
      expect(html, identite).not.toMatch(/style=/);
    }
  });
  it('les huit familles animées portent un mouvement, les entrées d’administration aucun', () => {
    const animees = [
      'dashboard',
      'organisation',
      'pilotage',
      'risques',
      'conformite',
      'actions',
      'resilience',
      'documents',
    ];
    for (const identite of IDENTITES_MENU) {
      const html = renderToStaticMarkup(createElement(IconeMenu, { identite }));
      expect(html.includes('mw-motion'), identite).toBe(animees.includes(identite));
    }
  });
  it('deux coches de Conformité affichées ensemble ont des masques distincts', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(IconeMenu, { identite: 'conformite' }),
        createElement(IconeMenu, { identite: 'conformite' }),
      ),
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`clip-path="url(#${id})"`);
  });
  it('treize teintes distinctes, une variable CSS par identité', () => {
    const teintes = IDENTITES_MENU.map((i) => MENU.teintes[i].toLowerCase());
    expect(new Set(teintes).size).toBe(13);
    const v = variablesMenu();
    for (const i of IDENTITES_MENU) expect(v[`--menu-teinte-${i}`]).toBe(MENU.teintes[i]);
  });
});
