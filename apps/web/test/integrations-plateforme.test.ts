/* Lot I1 (ADR 0076, addendum du 19/11/2026) : les intégrations se configurent dans la page Plateforme et nulle part ailleurs.
   Carte « Intégrations » visible avec le seul droit de lire le module ; dans les outils du module Vulnérabilités, l'état en
   lecture seule (fréquence et prochaine synchronisation comprises, lot F1) et un lien « Configurer l'intégration » visible
   seulement avec le droit d'administrer les intégrations (décision du RSSI du 19/11/2026) ; aucun réglage, aucune clé, aucun
   bouton de test ni de synchronisation dans les écrans du module. Données fictives. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import type { Action, EtatSurfaceExterneDto, EtatSynchronisationDto, Module } from '@suivi/shared';
import { MODULES } from '@suivi/shared';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { cartesVisibles } from '../src/administration-droits';
import { EtatIntegration, LienConfigurerIntegration } from '../src/integrations/EtatIntegration';
import { erreurSynchronisation, etatConnecteur, peutConfigurerIntegration } from '../src/integrations/etat-integration';
import { IntegrationsPanel } from '../src/integrations/IntegrationsPage';
import { cartesDuCote, fenetreAuDessus } from '../src/pages/Administration';
import { EtatSynchronisations } from '../src/vulnerabilites/FaillesDetectees';
import { EtatSurface } from '../src/vulnerabilites/SurfaceExterne';
import { messageCollectesDemandees } from '../src/vulnerabilites/veille-presentation';
import { Capteurs } from '../src/vulnerabilites/VueEnsemble';

const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const avec =
  (...droits: [Module, Action][]) =>
  (m: Module, a: Action) =>
    droits.some(([dm, da]) => dm === m && da === a);
const tout = () => true;
const LIEN = /<a[^>]*href="\/plateforme\/integrations"[^>]*>Configurer l’intégration<\/a>/;

const tenable = (x: Partial<EtatSynchronisationDto> = {}): EtatSynchronisationDto => ({
  integrationId: '00000000-0000-4000-8000-0000000000a1',
  nom: 'Tenable fictif',
  actif: true,
  gravites: ['critique', 'elevee'],
  derniere: {
    id: '00000000-0000-4000-8000-0000000000e1',
    etat: 'echec',
    origine: 'planifie',
    demandeLe: '2026-11-16T03:00:00.000Z',
    termineLe: '2026-11-16T03:01:00.000Z',
    bilan: null,
    erreur: 'Certificat refusé par l’exécutant (fictif).',
  },
  derniereCompleteLe: '2026-11-15T03:05:00.000Z',
  inventaire: null,
  frequenceHeures: 24,
  prochaineSynchronisation: '2026-11-17T03:00:00.000Z',
  ...x,
});
const alh = (x: Partial<EtatSurfaceExterneDto> = {}): EtatSurfaceExterneDto => ({
  integrationId: '00000000-0000-4000-8000-0000000000a2',
  nom: 'AlgoLightHouse fictif',
  actif: true,
  derniere: {
    id: '00000000-0000-4000-8000-0000000000e2',
    etat: 'recu',
    origine: 'planifie',
    demandeLe: '2026-11-17T08:00:00.000Z',
    termineLe: '2026-11-17T08:10:00.000Z',
    bilan: {
      elements: 9,
      perimetres: 2,
      hotes: 2,
      domaines: 1,
      alertes: 3,
      details: 3,
      technologies: 1,
      ecartes: 0,
      tronque: false,
    },
    erreur: null,
  },
  derniereCompleteLe: '2026-11-17T08:10:00.000Z',
  perimetresNonRelies: null,
  frequenceHeures: 168,
  prochaineSynchronisation: null,
  ...x,
});

describe('carte « Intégrations » de la page Plateforme', () => {
  const carte = cartesDuCote(tout, 'plateforme').find((c) => c.id === 'integrations');
  it('ouvre le panneau des intégrations dans la fenêtre de carte, sans page à part ni titre répété', () => {
    expect(carte).toMatchObject({ titre: 'Intégrations', cote: 'plateforme' });
    expect(carte?.lien).toBeUndefined();
    const detail = carte?.detail?.(() => undefined, tout);
    expect(isValidElement(detail) && detail.type === IntegrationsPanel).toBe(true);
  });
  it('est visible si et seulement si la personne lit le module Intégrations (droit de l’ancienne rubrique)', () => {
    for (const m of MODULES)
      for (const a of ['lire', 'modifier', 'administrer'] as const)
        expect([m, a, cartesVisibles(avec([m, a]), 'plateforme').includes('integrations')]).toEqual([
          m,
          a,
          m === 'integrations' && a === 'lire',
        ]);
    expect(cartesVisibles(avec(['integrations', 'lire']), 'plateforme')).toEqual(['integrations']);
    expect(cartesVisibles(avec(['vulnerabilites', 'administrer']), 'plateforme')).not.toContain('integrations');
  });
});

describe('fenêtres ouvertes par la carte', () => {
  it('la fenêtre de la carte ne se ferme pas tant qu’une fenêtre est ouverte au-dessus d’elle (Échap)', () => {
    const doc = (n: number) => ({ querySelectorAll: () => ({ length: n }) }) as unknown as Document;
    expect(fenetreAuDessus(doc(1))).toBe(false);
    expect(fenetreAuDessus(doc(2))).toBe(true);
    expect(fenetreAuDessus(doc(3))).toBe(true);
  });
});

describe('état d’une intégration dans un outil : lecture seule', () => {
  it('règle commune : état, erreur en lecture seulement quand la dernière synchronisation a échoué', () => {
    expect(etatConnecteur(tenable())).toMatchObject({ libelle: 'En échec', etat: 'erreur' });
    expect(erreurSynchronisation(tenable())).toBe('Certificat refusé par l’exécutant (fictif).');
    expect(erreurSynchronisation(alh())).toBeNull();
    expect(erreurSynchronisation(tenable({ derniere: null }))).toBeNull();
  });
  it('le lien « Configurer l’intégration » n’apparaît qu’avec le droit d’administrer les intégrations (décision du 19/11/2026)', () => {
    expect(peutConfigurerIntegration(avec(['integrations', 'administrer']))).toBe(true);
    // Lire (ou lancer) sans administrer : l'état se lit, le lien n'apparaît pas.
    expect(peutConfigurerIntegration(avec(['integrations', 'lire']))).toBe(false);
    expect(peutConfigurerIntegration(avec(['integrations', 'lire'], ['integrations', 'modifier']))).toBe(false);
    expect(peutConfigurerIntegration(avec(['vulnerabilites', 'administrer']))).toBe(false);
    const lecture = rendre(
      createElement(EtatIntegration, {
        type: 'Outil fictif',
        connecteurs: [tenable()],
        peutConfigurer: peutConfigurerIntegration(avec(['integrations', 'lire'])),
      }),
    );
    expect(lecture).toContain('Tenable fictif');
    expect(lecture).toContain('Dernière synchronisation');
    expect(lecture).not.toMatch(LIEN);
    // Les écrans du module calculent le droit par cette seule règle.
    for (const f of ['FaillesDetectees.tsx', 'SurfaceExterne.tsx', 'VueEnsemble.tsx']) {
      const texte = readFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/vulnerabilites', f),
        'utf8',
      );
      expect([f, /peutConfigurer=\{peutConfigurerIntegration\(can\)\}/.test(texte)]).toEqual([f, true]);
      expect([f, texte.includes("can('integrations', 'lire')")]).toEqual([f, false]);
    }

    expect(rendre(createElement(LienConfigurerIntegration, { visible: true }))).toMatch(LIEN);
    const sans = rendre(createElement(LienConfigurerIntegration, { visible: false }));
    expect(sans).not.toContain('<a');
    expect(sans).not.toContain('Configurer');
    for (const peutConfigurer of [true, false]) {
      const html = rendre(
        createElement(EtatIntegration, { type: 'Outil fictif', connecteurs: [tenable()], peutConfigurer }),
      );
      expect(LIEN.test(html)).toBe(peutConfigurer);
    }
  });
  it('fréquence et prochaine synchronisation en lecture seule (lot F1), sans aucune liste de choix', () => {
    const html = rendre(
      createElement(EtatIntegration, { type: 'Outil fictif', connecteurs: [tenable()], peutConfigurer: false }),
    );
    expect(html).toContain('Synchronisation automatique : une fois par jour');
    expect(html).toContain('prochaine prévue');
    expect(html).not.toContain('<select');
    const inactif = rendre(createElement(EtatSurface, { etats: [alh()] }));
    expect(inactif).toContain('Synchronisation automatique : une fois par semaine');
    expect(inactif).toContain('aucune prévue');
  });
  it('Failles détectées : date, erreur et lien, sans aucun bouton', () => {
    const html = rendre(createElement(EtatSynchronisations, { etats: [tenable()], peutConfigurer: true }));
    expect(html).toContain('Tenable fictif');
    expect(html).toContain('Dernière synchronisation');
    expect(html).toContain('Erreur de la dernière synchronisation');
    expect(html).toContain('Certificat refusé par l’exécutant (fictif).');
    expect(html).toContain('En échec');
    expect(html).toMatch(LIEN);
    expect(html).not.toContain('<button');
    expect(rendre(createElement(EtatSynchronisations, { etats: [tenable()] }))).not.toMatch(LIEN);
  });
  it('Surface externe : état, bilan et lien, sans aucun bouton', () => {
    const html = rendre(createElement(EtatSurface, { etats: [alh()], peutConfigurer: true }));
    expect(html).toContain('AlgoLightHouse fictif');
    expect(html).toContain('À jour');
    expect(html).toContain('Synchronisation reçue : 3 alertes');
    expect(html).not.toContain('Erreur de la dernière synchronisation');
    expect(html).toMatch(LIEN);
    expect(html).not.toContain('<button');
    const echec = rendre(
      createElement(EtatSurface, {
        etats: [alh({ derniere: { ...alh().derniere!, etat: 'echec', bilan: null, erreur: 'Clé refusée (fictif).' } })],
      }),
    );
    expect(echec).toContain('Dernière synchronisation en échec');
    expect(echec).toContain('Clé refusée (fictif).');
    // L'erreur n'est dite qu'une fois.
    expect(echec.split('Clé refusée (fictif).').length).toBe(2);
    expect(echec).not.toMatch(LIEN);
  });
  it('Vue d’ensemble : capteurs en lecture, erreur dite, lien seulement avec le droit, aucun bouton', () => {
    const html = rendre(
      createElement(Capteurs, { veille: undefined, tenable: [tenable()], alh: [alh()], peutConfigurer: true }),
    );
    expect(html).toContain('Erreur : Certificat refusé par l’exécutant (fictif).');
    expect(html).toMatch(LIEN);
    expect(html).not.toContain('<button');
    expect(rendre(createElement(Capteurs, { veille: undefined, tenable: [tenable()], alh: [] }))).not.toMatch(LIEN);
  });
});

describe('écrans du module Vulnérabilités : aucun réglage de connecteur', () => {
  const dossier = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/vulnerabilites');
  const sources = readdirSync(dossier)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({ f, texte: readFileSync(path.join(dossier, f), 'utf8') }));
  it('aucun appel aux routes des intégrations, aucun bouton de test ou de synchronisation, aucune clé saisie', () => {
    expect(sources.length).toBeGreaterThan(10);
    for (const { f, texte } of sources) {
      expect([f, texte.includes('/api/integrations')]).toEqual([f, false]);
      for (const motif of ['Synchroniser maintenant', 'Tester la connexion', 'PasswordInput', 'IntegrationsPanel'])
        expect([f, motif, texte.includes(motif)]).toEqual([f, motif, false]);
    }
  });
  it('« Collecter maintenant » (Veille) dit que seules les sources de la veille sont concernées', () => {
    expect(messageCollectesDemandees(5)).toBe(
      '5 collectes de veille demandées : l’exécutant les traite à son prochain passage. Les connecteurs (Tenable, AlgoLightHouse) ne sont pas concernés.',
    );
    expect(messageCollectesDemandees(1)).toMatch(/^1 collecte de veille demandée : /);
  });
});
