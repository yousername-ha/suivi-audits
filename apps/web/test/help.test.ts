import { BUSINESS_MODULES, MODULE_LABELS } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';

describe('guide du socle historique', () => {
  it('couvre chaque module métier historique sans le présenter comme migré', () => {
    for (const module of BUSINESS_MODULES.filter((m) => m !== 'cartographie')) {
      const article = HELP_ARTICLES.find((a) => a.id === `historique-${module}`);
      expect(article, module).toBeDefined();
      expect(article?.title).toBe(MODULE_LABELS[module]);
      expect(article?.permission).toBe(`${module}:lire`);
      expect(article?.link).toBe('/legacy/');
    }
  });
  it('un lecteur limité aux fournisseurs ne reçoit pas les rubriques des autres modules', () => {
    const permissions: readonly string[] = ['fournisseurs:lire'];
    const permitted = HELP_ARTICLES.filter((a) => !a.permission || permissions.includes(a.permission));
    expect(permitted.map((a) => a.id)).toEqual(['fournisseurs-organisation', 'historique-fournisseurs', 'compte']);
  });
});
