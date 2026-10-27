import { createElement, isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  BarresEmpilees,
  BarresHorizontales,
  bandesSeuils,
  cheminArc,
  JaugeArc,
  pointArc,
  SEUILS_TAUX,
  taux,
  teinteSeuil,
} from '../src/tableau-de-bord.tsx';

/** Arbre d'éléments rendu à plat (sans DOM ni dépendance) : composants de la page appelés, éléments natifs et
    composants tiers (VisuallyHidden) conservés avec leurs propriétés. Sert à vérifier libellés, classes et textes. */
type Noeud = { type: string; props: Record<string, unknown>; enfants: (Noeud | string)[] };
function aplatir(n: ReactNode): (Noeud | string)[] {
  if (n == null || typeof n === 'boolean') return [];
  if (typeof n === 'string' || typeof n === 'number') return [String(n)];
  if (Array.isArray(n)) return n.flatMap(aplatir);
  if (!isValidElement(n)) return [];
  const { children, ...props } = n.props as { children?: ReactNode } & Record<string, unknown>;
  if (typeof n.type === 'function' && /^[A-Z]/.test(n.type.name) && n.type.name !== 'VisuallyHidden') {
    return aplatir((n.type as (p: unknown) => ReactNode)(n.props));
  }
  const type = typeof n.type === 'string' ? n.type : ((n.type as { name?: string }).name ?? 'composant');
  return [{ type, props, enfants: aplatir(children) }];
}
const serialiser = (noeuds: (Noeud | string)[]): string =>
  noeuds
    .map((x) =>
      typeof x === 'string'
        ? x
        : `<${x.type}${Object.entries(x.props)
            .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
            .map(([k, v]) => ` ${k === 'className' ? 'class' : k}="${String(v)}"`)
            .join('')}>${serialiser(x.enfants)}</${x.type}>`,
    )
    .join('');
const html = (e: ReactNode) => serialiser(aplatir(e));

describe('tableau de bord « verre et relief » (ADR 0066)', () => {
  it('seuils : base sous le premier palier, puis teinte du plus haut palier atteint, quel que soit leur ordre', () => {
    expect(teinteSeuil(SEUILS_TAUX, 0)).toBe('rouge');
    expect(teinteSeuil(SEUILS_TAUX, 59.9)).toBe('rouge');
    expect(teinteSeuil(SEUILS_TAUX, 60)).toBe('orange');
    expect(teinteSeuil(SEUILS_TAUX, 80)).toBe('vert');
    const desordre = {
      base: 'vert' as const,
      paliers: [
        { des: 10, teinte: 'rouge' as const },
        { des: 3, teinte: 'orange' as const },
      ],
    };
    expect(teinteSeuil(desordre, 2)).toBe('vert');
    expect(teinteSeuil(desordre, 5)).toBe('orange');
    expect(teinteSeuil(desordre, 12)).toBe('rouge');
  });

  it('taux : pourcentage, nul si le dénominateur est nul', () => {
    expect(taux(3, 4)).toBe(75);
    expect(taux(3, 0)).toBe(0);
  });

  it('arc : extrémités du demi-cercle et chemin vide pour un arc nul', () => {
    expect(pointArc(0, 80)).toEqual([20, 100]);
    expect(pointArc(1, 80)).toEqual([180, 100]);
    expect(pointArc(0.5, 80)).toEqual([100, 20]);
    expect(pointArc(2, 80)).toEqual([180, 100]);
    expect(cheminArc(0, 0, 80)).toBe('');
    expect(cheminArc(0, 0.5, 80)).toBe('M 20 100 A 80 80 0 0 1 100 20');
  });

  it('zones de seuils : contiguës de 0 à 100 %', () => {
    expect(bandesSeuils(SEUILS_TAUX)).toEqual([
      { de: 0, teinte: 'rouge', a: 60 },
      { de: 60, teinte: 'orange', a: 80 },
      { de: 80, teinte: 'vert', a: 100 },
    ]);
  });

  it('jauge : alternative textuelle chiffrée, teinte du seuil et repère de cible', () => {
    const rendu = html(createElement(JaugeArc, { libelle: 'Indicateurs atteints', valeur: 7, max: 10, cible: 75 }));
    expect(rendu).toContain('aria-label="Indicateurs atteints : 70\u202f%, cible 75\u202f%"');
    expect(rendu).toContain('tdb-jauge-arc tdb-s-orange');
    expect(rendu).toContain('class="tdb-cible"');
    expect(rendu).not.toContain('style=');
  });

  it('barres horizontales : valeur lisible par ligne, teinte selon les seuils, état vide', () => {
    const rendu = html(
      createElement(BarresHorizontales, {
        titre: 'Conformité',
        lignes: [
          { libelle: 'ISO 27001', valeur: 9, max: 10 },
          { libelle: 'HDS', valeur: 1, max: 2 },
        ],
        seuils: SEUILS_TAUX,
      }),
    );
    expect(rendu).toContain('ISO 27001');
    expect(rendu).toContain('tdb-barre-valeur chiffres tdb-t-vert">90\u202f%');
    expect(rendu).toContain('tdb-barre-valeur chiffres tdb-t-rouge">50\u202f%');
    expect(rendu).not.toContain('style=');
    expect(html(createElement(BarresHorizontales, { titre: 'Vide', lignes: [], vide: 'Rien.' }))).toContain('Rien.');
  });

  it('barres empilées : part de la série choisie et tableau masqué pour les lecteurs d’écran', () => {
    const rendu = html(
      createElement(BarresEmpilees, {
        titre: 'Niveau',
        series: [
          { cle: 't', libelle: 'Total', teinte: 'vert' },
          { cle: 'p', libelle: 'Partiel', teinte: 'orange' },
        ],
        lignes: [{ libelle: 'ISO 27001', valeurs: { t: 3, p: 1 } }],
        part: 't',
        libellePart: 'part mise en œuvre totalement',
      }),
    );
    expect(rendu).toContain('75\u202f%');
    expect(rendu).toContain('<caption>Niveau</caption>');
    expect(rendu).not.toContain('style=');
  });
});
