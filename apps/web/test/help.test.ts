import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';

describe('guide embarqué', () => {
  it('ne renvoie plus vers l’ancien outil /legacy', () => {
    for (const a of HELP_ARTICLES) expect(a.link, a.id).not.toMatch(/^\/legacy/);
    expect(HELP_ARTICLES.some((a) => a.id.startsWith('historique'))).toBe(false);
  });
  it('décrit les exports Excel avec leur droit', () => {
    const article = HELP_ARTICLES.find((a) => a.id === 'exports-excel');
    expect(article?.permission).toBe('import_export:exporter');
    expect(article?.link).toBe('/exports');
  });
  it('un lecteur sans droit d’export ne reçoit pas l’article des exports', () => {
    const permissions: readonly string[] = ['fournisseurs:lire'];
    const permitted = HELP_ARTICLES.filter((a) => !a.permission || permissions.includes(a.permission));
    expect(permitted.map((a) => a.id)).not.toContain('exports-excel');
  });
  it('décrit la contribution à un RETEX à toute personne, et le pilotage du RETEX avec son droit', () => {
    const permitted = HELP_ARTICLES.filter((a) => !a.permission);
    expect(permitted.find((a) => a.id === 'retex-contribution')?.link).toBe('/retex');
    const pilote = HELP_ARTICLES.find((a) => a.id === 'retex-incidents');
    expect(pilote?.permission).toBe('incidents:modifier');
    expect(pilote?.link).toBe('/pilotage/incidents-retex');
  });
});
