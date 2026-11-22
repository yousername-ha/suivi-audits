/* Densité (21/11/2026) : une navigation en pictogrammes conserve adresses, noms et droits ; les décisions ne deviennent
   pas des commandes implicites. Données fictives, rendu statique sans réseau ni base. */
import { MantineProvider } from '@mantine/core';
import type { Action, Module } from '@suivi/shared';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OngletsRubriques } from '../src/components/OngletsRubriques';
import { CommandesRisque } from '../src/grc/CommandesRisque';
import { localiser, rubriquesVisibles } from '../src/navigation';

const { permissions } = vi.hoisted(() => ({ permissions: new Set<string>() }));
vi.mock('../src/session', () => ({
  useCan: () => (m: Module, a: Action) => permissions.has(`${m}:${a}`),
}));
const rendu = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const navigation = (pathname: string) =>
  rendu(createElement(MemoryRouter, { initialEntries: [pathname] }, createElement(OngletsRubriques)));
const liens = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];

beforeEach(() => permissions.clear());

describe('rubriques Risques et Vulnérabilités en pictogrammes', () => {
  it('conserve les adresses autorisées, tous les noms accessibles et le libellé actif visible', () => {
    permissions.add('vulnerabilites:lire');
    const html = navigation('/vulnerabilites/machines');
    const actuel = liens(html);
    const lieu = localiser('/vulnerabilites/machines')!;
    const attendu = rubriquesVisibles(lieu.destination, (m, a) => permissions.has(`${m}:${a}`));
    expect(actuel.map((l) => l[1]?.match(/href="([^"]+)"/)?.[1])).toEqual(attendu.map((r) => r.to));
    for (const r of attendu) {
      const lien = actuel.find((l) => l[1]?.includes(`href="${r.to}"`));
      expect(lien?.[1]).toContain(`aria-label="${r.label}"`);
      expect(lien?.[2]).toContain('aria-hidden="true"');
    }
    const courant = actuel.find((l) => l[1]?.includes('aria-current="page"'));
    expect(courant?.[1]).toContain('href="/vulnerabilites/machines"');
    expect(courant?.[2]).toContain('class="onglet-rubrique__libelle">Machines');
    expect(courant?.[2]).not.toContain('sr-only');
    expect(html).not.toContain('href="/vulnerabilites/masque"');
  });

  it('conserve le droit d’administration des mots à ne pas masquer et masque les destinations sans droit', () => {
    expect(navigation('/vulnerabilites/machines')).not.toContain('<nav');
    permissions.add('vulnerabilites:lire');
    permissions.add('vulnerabilites:administrer');
    const html = navigation('/vulnerabilites/masque');
    expect(html).toContain('aria-label="Mots à ne pas masquer"');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/vulnerabilites\/masque"/);
    expect(html).toContain('class="onglet-rubrique__libelle">Mots à ne pas masquer');
  });

  it('garde les textes des rubriques des autres familles et la double permission de la carte des risques', () => {
    permissions.add('pilotage:lire');
    const contexte = navigation('/pilotage/contexte');
    expect(contexte).not.toContain('onglets-rubriques--icones');
    expect(contexte).toContain('SWOT par processus');
    const risques = navigation('/pilotage/risques');
    expect(risques).toContain('aria-label="Études EBIOS RM"');
    expect(risques).not.toContain('href="/pilotage/carte"');
    permissions.add('cartographie:lire');
    expect(navigation('/pilotage/risques')).toContain('href="/pilotage/carte"');
  });
});

describe('commandes compactes d’une ligne de risque', () => {
  const props = () => ({
    nom: 'Risque fictif',
    onOpen: vi.fn(),
    onPlan: vi.fn(),
    onRelation: vi.fn(),
    onEvaluation: vi.fn(),
  });

  it('nomme chaque raccourci et conserve une décision métier visible seulement quand elle est autorisée', () => {
    const sans = rendu(createElement(CommandesRisque, props()));
    for (const label of ['Ouvrir', 'Plan d’action de', 'Liens et preuves de', 'Apprécier / réévaluer'])
      expect(sans).toContain(`aria-label="${label} Risque fictif"`);
    expect(sans).toContain('Évaluer');
    expect(sans).not.toContain('Décider de l’acceptation');
    const avec = rendu(createElement(CommandesRisque, { ...props(), onAcceptation: vi.fn() }));
    expect(avec).toContain('aria-label="Décider de l’acceptation de Risque fictif"');
    expect(avec).toContain('Décider');
  });

  it('chaque commande appelle son propre parcours, sans confondre consultation et décision', () => {
    const p = { ...props(), onAcceptation: vi.fn() };
    const commandes: { label: string; onClick: () => void }[] = [];
    function parcourir(n: ReactNode) {
      if (Array.isArray(n)) return n.forEach(parcourir);
      if (!isValidElement(n)) return;
      const a = n.props as { children?: ReactNode; 'aria-label'?: string; onClick?: () => void };
      if (a['aria-label'] && a.onClick) commandes.push({ label: a['aria-label'], onClick: a.onClick });
      parcourir(a.children);
    }
    parcourir(CommandesRisque(p));
    for (const [prefixe, callback] of [
      ['Ouvrir', p.onOpen],
      ['Plan d’action', p.onPlan],
      ['Liens et preuves', p.onRelation],
      ['Apprécier', p.onEvaluation],
      ['Décider', p.onAcceptation],
    ] as const) {
      commandes.find((c) => c.label.startsWith(prefixe))!.onClick();
      expect(callback).toHaveBeenCalledTimes(1);
    }
  });
});
