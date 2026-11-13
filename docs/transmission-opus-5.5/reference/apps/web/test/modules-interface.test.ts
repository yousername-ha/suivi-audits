import { describe, expect, it } from 'vitest';
import { MODULES } from '@suivi/shared';
import { moduleDansInterface, sectionRetiree } from '../src/modules-interface';
import { FAMILLES, localiser, ordonnerMenu } from '../src/navigation';
import { PILOTAGE_NAV } from '../src/pilotage-navigation';

describe('retrait de Budget et CRRC des écrans', () => {
  it('préserve les autres modules et les contrats historiques', () => {
    expect(MODULES.filter((m) => !moduleDansInterface(m))).toEqual(['crrc', 'investissements']);
    expect(MODULES).toContain('crrc');
    expect(MODULES).toContain('investissements');
  });
  it('ne propose aucun écran retiré, même avec un ancien ordre de navigation enregistré', () => {
    const rubriques = FAMILLES.flatMap((f) => f.destinations.flatMap((d) => d.rubriques));
    expect(rubriques.some((r) => sectionRetiree(r.id))).toBe(false);
    expect(PILOTAGE_NAV.some((g) => g.items.some((i) => !moduleDansInterface(i.module)))).toBe(false);
    expect(
      ordonnerMenu({ destinations: { organisation: ['budget'], resilience: ['sauvegardes'] } })
        .flatMap((f) => f.destinations)
        .map((d) => d.id),
    ).not.toEqual(expect.arrayContaining(['budget', 'sauvegardes']));
    expect(localiser('/pilotage/investissements')).toBeUndefined();
    expect(localiser('/pilotage/crrc-ensemble')).toBeUndefined();
  });
  it.each(['investissements', 'crrc-ensemble', 'crrc-restaurations', 'crrc-rapports'])(
    'reconnaît l’ancienne adresse %s',
    (section) => {
      expect(sectionRetiree(section)).toBe(true);
    },
  );
  it.each(['actions', 'recurrences', 'contexte', 'bia', 'continuite', 'exercices'])(
    'conserve la rubrique %s',
    (section) => {
      expect(sectionRetiree(section)).toBe(false);
    },
  );
});

describe('regroupement de la bibliothèque', () => {
  it('préserve le périmètre et le retour mais retire une ouverture de fiche devenue hors contexte', async () => {
    const { lienBibliotheque } = await import('../src/modules-interface');
    const url = new URL(
      lienBibliotheque(
        new URLSearchParams({ perimetre: 'scope', retour: '/pilotage/parcours-iso', ouvrir: 'ancienne-fiche' }),
      ),
      'https://example.invalid',
    );
    expect(url.pathname).toBe('/pilotage/bibliotheque');
    expect(url.searchParams.get('perimetre')).toBe('scope');
    expect(url.searchParams.get('retour')).toBe('/pilotage/parcours-iso');
    expect(url.searchParams.has('ouvrir')).toBe(false);
  });
});
