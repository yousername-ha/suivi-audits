/* Lot VEILLE-PLATEFORME (ADR 0100, décision du RSSI du 23/11/2026 : « comme pour les intégrations »). La configuration de la
   veille est une carte « Veille des vulnérabilités » de la page Plateforme, visible seulement avec le droit qui protégeait déjà
   ces réglages (administrer le module, avec sa lecture) ; l'écran « Veille » du module ne garde que le contenu et une ligne
   d'état par source, en lecture seule, avec un lien « Configurer » visible seulement avec ce droit. Aucune route ni aucun
   droit ne change : seul l'endroit d'affichage change. Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import {
  type Action,
  type EtatDictionnaireCpeDto,
  type EtatSourceAnnonceDto,
  type EtatSourceVeilleDto,
  type EtatVeilleDto,
  fluxExterne,
  type Module,
  MODULES,
  SOURCE_DICTIONNAIRE_CPE,
} from '@suivi/shared';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { cartesVisibles } from '../src/administration-droits';
import { HELP_ARTICLES } from '../src/help';
import { cartesDuCote } from '../src/pages/Administration';
import { ConfigurationVeillePanel } from '../src/vulnerabilites/ConfigurationVeille';
import { EtatSourcesVeille } from '../src/vulnerabilites/Veille';
import {
  ERREUR_COURTE,
  erreurCourte,
  etatSourceAnnonce,
  LIEN_CONFIGURATION_VEILLE,
  lignesEtatVeille,
  peutConfigurerVeille,
} from '../src/vulnerabilites/veille-presentation';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const lireSource = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
/** Code seul, sans les commentaires (qui racontent l'historique des lots et citent les anciens réglages). */
const code = (f: string) =>
  lireSource(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const avec =
  (...droits: [Module, Action][]) =>
  (m: Module, a: Action) =>
    droits.some(([dm, da]) => dm === m && da === a);
const tout = () => true;
const LIEN =
  /<a[^>]*href="\/plateforme\/veille-vulnerabilites"[^>]*>Configurer<span class="sr-only"> la veille des vulnérabilités<\/span><\/a>/;

const source = (s: Partial<EtatSourceVeilleDto> = {}): EtatSourceVeilleDto => ({
  source: 'cisa-kev',
  libelle: 'Catalogue des failles exploitées (KEV)',
  organisme: 'CISA (États-Unis)',
  hote: 'www.cisa.gov',
  format: 'Fichier JSON unique',
  langue: 'en',
  demande: 'Le catalogue entier, en une lecture.',
  derniereReussite: '2026-11-16T05:00:00.000Z',
  dernierEssai: '2026-11-16T05:00:00.000Z',
  erreur: null,
  enRetard: false,
  derniereCollecte: null,
  frequenceHeures: 2,
  prochaineCollecte: '2026-11-16T07:00:00.000Z',
  version: 1,
  ...s,
});
const etat = (ouvert: boolean, sources: EtatSourceVeilleDto[] = [source()]): EtatVeilleDto => ({
  flux: { ouvert, applique: ouvert ? 'ouvert' : null },
  executant: { disponible: true },
  mandataire: { actif: false },
  sources,
  fichesCertSante: { lues: 0, aLire: 0, derniereLecture: null, relectureJours: 7 },
});
const dictionnaire = (e: Partial<EtatDictionnaireCpeDto> = {}): EtatDictionnaireCpeDto => ({
  source: SOURCE_DICTIONNAIRE_CPE,
  activee: false,
  frequenceHeures: 24,
  flux: { ouvert: true, applique: 'ouvert' },
  executant: { disponible: true },
  etat: 'inactif',
  chargement: null,
  produits: 0,
  completLe: null,
  derniereMiseAJour: null,
  dernierEssai: null,
  erreur: null,
  prochaineMiseAJour: null,
  copie: { voulue: false, complete: false, completeLe: null, versions: 0 },
  version: 1,
  ...e,
});
const annonce = (s: Partial<EtatSourceAnnonceDto> = {}): EtatSourceAnnonceDto => ({
  source: 'cloudflare-radar',
  libelle: 'Préavis des CVE (Cloudflare Radar)',
  organisme: 'Cloudflare',
  hote: 'radar.cloudflare.com',
  activee: false,
  frequenceMinutes: 15,
  frequences: [15, 30, 60, 120, 360, 1440],
  derniereReussite: null,
  dernierEssai: null,
  erreur: null,
  prochaineCollecte: null,
  version: 1,
  ...s,
});

describe('carte « Veille des vulnérabilités » de la page Plateforme', () => {
  const carte = cartesDuCote(tout, 'plateforme').find((c) => c.id === 'veille-vulnerabilites');
  it('ouvre le panneau de configuration de la veille dans la fenêtre de carte, à défilement, sans page à part', () => {
    expect(carte).toMatchObject({ titre: 'Veille des vulnérabilités', cote: 'plateforme', consultation: true });
    expect(carte?.lien).toBeUndefined();
    const detail = carte?.detail?.(() => undefined, tout);
    expect(isValidElement(detail) && detail.type === ConfigurationVeillePanel).toBe(true);
    // Rangée juste après « Intégrations ».
    const ids = cartesDuCote(tout, 'plateforme').map((c) => c.id);
    expect(ids.indexOf('veille-vulnerabilites')).toBe(ids.indexOf('integrations') + 1);
  });
  it('n’apparaît qu’avec le droit qui protégeait ces réglages : administrer le module Vulnérabilités, avec sa lecture', () => {
    // Aucun droit seul ne l'ouvre, ni l'administration de la plateforme, ni la lecture du module.
    for (const m of MODULES)
      for (const a of ['lire', 'modifier', 'supprimer', 'exporter', 'administrer'] as const)
        expect([m, a, cartesVisibles(avec([m, a]), 'plateforme').includes('veille-vulnerabilites')]).toEqual([
          m,
          a,
          false,
        ]);
    expect(cartesVisibles(avec(['vulnerabilites', 'lire'], ['vulnerabilites', 'administrer']), 'plateforme')).toEqual([
      'veille-vulnerabilites',
    ]);
    expect(
      cartesVisibles(avec(['vulnerabilites', 'lire'], ['vulnerabilites', 'modifier']), 'plateforme'),
    ).not.toContain('veille-vulnerabilites');
    expect(
      cartesVisibles(avec(['administration', 'lire'], ['administration', 'administrer']), 'plateforme'),
    ).not.toContain('veille-vulnerabilites');
    // Même règle que le lien de l'écran « Veille ».
    for (const droits of [
      [],
      [['vulnerabilites', 'lire']],
      [['vulnerabilites', 'administrer']],
      [
        ['vulnerabilites', 'lire'],
        ['vulnerabilites', 'administrer'],
      ],
      [
        ['vulnerabilites', 'lire'],
        ['integrations', 'administrer'],
      ],
    ] as [Module, Action][][]) {
      const can = avec(...droits);
      expect(cartesVisibles(can, 'plateforme').includes('veille-vulnerabilites')).toBe(peutConfigurerVeille(can));
    }
  });
  it('le registre des flux et l’aide renvoient vers la carte', () => {
    expect(fluxExterne('veille-vulnerabilites').reglage.lien).toBe(LIEN_CONFIGURATION_VEILLE);
    const aide = HELP_ARTICLES.find((a) => a.id === 'vulnerabilites-veille-configuration');
    expect(aide).toMatchObject({ permission: 'vulnerabilites:administrer', link: LIEN_CONFIGURATION_VEILLE });
    const texte = aide!.steps.join(' ');
    for (const motif of ['Activer la veille', 'Fréquence', 'Collecter maintenant', 'Copier le dictionnaire complet'])
      expect([motif, texte.includes(motif)]).toEqual([motif, true]);
    // L'article de l'écran « Veille » ne décrit plus aucun réglage.
    const veille = HELP_ARTICLES.find((a) => a.id === 'vulnerabilites-veille')!.steps.join(' ');
    for (const motif of ['Activer la veille', 'Collecter maintenant', 'Copier le dictionnaire complet'])
      expect([motif, veille.includes(motif)]).toEqual([motif, false]);
    expect(veille).toContain('« Configurer »');
  });
  it('le panneau appelle les mêmes routes qu’avant (aucune route ni aucun droit ne change)', () => {
    const panneau = lireSource('vulnerabilites/ConfigurationVeille.tsx');
    for (const motif of [
      "api('PUT', `/api/admin/flux-externes/${FLUX}`",
      "api<unknown[]>('POST', '/api/vulnerabilites/veille/collectes'",
      "api('PUT', `/api/vulnerabilites/veille/sources/${src.source}/frequence`",
      "api('PATCH', urlSourceAnnonce(s.source)",
      "actionCpe('PATCH', URL_DICTIONNAIRE_CPE",
      "actionCpe('POST', URL_COPIE_CPE)",
      "actionCpe('DELETE', URL_COPIE_CPE)",
    ])
      expect([motif, panneau.includes(motif)]).toEqual([motif, true]);
    expect(panneau).not.toMatch(/style=\{|dangerouslySetInnerHTML|lockScroll=\{true\}/);
  });
});

describe('écran « Veille » : contenu seulement, une ligne d’état par source', () => {
  it('ne contient plus aucun réglage ni aucune écriture', () => {
    for (const f of ['vulnerabilites/Veille.tsx', 'vulnerabilites/AnnoncesVeille.tsx']) {
      const texte = code(f);
      for (const motif of [
        'ChampFrequence',
        'Switch',
        'NativeSelect',
        'ConfirmButton',
        'useValidationFlux',
        'api(',
        "'PUT'",
        "'PATCH'",
        "'POST'",
        "'DELETE'",
        'Activer la veille',
        'Désactiver la veille',
        'Collecter maintenant',
        'Copier le dictionnaire complet',
        'DictionnaireCpeSection',
        'SourcesFacultatives',
        'SourcesTable',
        'ActivationVeille',
        'ConfigurationVeille',
      ])
        expect([f, motif, texte.includes(motif)]).toEqual([f, motif, false]);
    }
    // Le droit du lien est calculé par la seule règle commune.
    expect(lireSource('vulnerabilites/Veille.tsx')).toMatch(/peutConfigurer=\{peutConfigurerVeille\(can\)\}/);
  });

  it('lignes d’état : les cinq sources, le dictionnaire et les sources facultatives, en lecture seule', () => {
    const longue = `Délai dépassé : ${'la source ne répond pas, '.repeat(12)}fin.`;
    const lignes = lignesEtatVeille(
      etat(true, [
        source(),
        source({
          source: 'nvd',
          libelle: 'Base nationale des vulnérabilités (NVD)',
          hote: 'services.nvd.nist.gov',
          derniereReussite: null,
          enRetard: true,
          erreur: longue,
        }),
        source({ source: 'epss', libelle: 'Probabilité d’exploitation (EPSS)', enRetard: true }),
      ]),
      dictionnaire({ activee: true, etat: 'a_jour', derniereMiseAJour: '2026-11-16T03:00:00.000Z' }),
      [annonce(), annonce({ source: 'tldrcve', libelle: 'Résumés des CVE (tldrcve)', activee: true })],
    );
    expect(lignes.map((l) => [l.cle, l.etat.libelle])).toEqual([
      ['cisa-kev', 'À jour'],
      ['nvd', 'En erreur'],
      ['epss', 'En retard'],
      ['nvd-cpe', 'À jour'],
      ['cloudflare-radar', 'Désactivée'],
      ['tldrcve', 'Jamais collectée'],
    ]);
    // Erreur abrégée sur la ligne ; le texte entier reste dans la carte de la Plateforme.
    expect(lignes[1]!.erreur!.length).toBe(ERREUR_COURTE);
    expect(lignes[1]!.erreur!.endsWith('…')).toBe(true);
    for (const peutConfigurer of [true, false]) {
      const html = rendre(
        createElement(EtatSourcesVeille, { lignes, veilleActive: true, executantVu: true, peutConfigurer }),
      );
      expect(html).toContain('État des sources');
      expect(html).toContain('Veille active');
      for (const l of lignes) expect(html).toContain(l.libelle);
      expect(html).toContain('En retard');
      expect(html).toContain('Jamais');
      expect(html).toContain(lignes[1]!.erreur!);
      expect(html).not.toContain(longue);
      // Aucun réglage : ni liste, ni bouton, ni champ, ni hôte ou fréquence.
      for (const motif of ['<select', '<button', '<input', 'Fréquence', 'www.cisa.gov', 'Collecter maintenant'])
        expect([peutConfigurer, motif, html.includes(motif)]).toEqual([peutConfigurer, motif, false]);
      expect([peutConfigurer, LIEN.test(html)]).toEqual([peutConfigurer, peutConfigurer]);
      if (!peutConfigurer) expect(html).not.toContain('Configurer');
    }
  });

  it('veille inactive et exécutant non vu dits en une pastille', () => {
    const inactive = rendre(
      createElement(EtatSourcesVeille, {
        lignes: lignesEtatVeille(etat(false), undefined, undefined),
        veilleActive: false,
        executantVu: false,
        peutConfigurer: false,
      }),
    );
    expect(inactive).toContain('Veille inactive');
    expect(inactive).not.toContain('Exécutant non vu');
    const sansExecutant = rendre(
      createElement(EtatSourcesVeille, { lignes: [], veilleActive: true, executantVu: false, peutConfigurer: false }),
    );
    expect(sansExecutant).toContain('Exécutant non vu');
  });

  it('le lien « Configurer » n’apparaît qu’avec le droit d’administrer le module (et de le lire)', () => {
    expect(peutConfigurerVeille(avec(['vulnerabilites', 'lire'], ['vulnerabilites', 'administrer']))).toBe(true);
    expect(peutConfigurerVeille(avec(['vulnerabilites', 'lire']))).toBe(false);
    expect(peutConfigurerVeille(avec(['vulnerabilites', 'lire'], ['vulnerabilites', 'modifier']))).toBe(false);
    expect(peutConfigurerVeille(avec(['vulnerabilites', 'lire'], ['administration', 'administrer']))).toBe(false);
    expect(peutConfigurerVeille(avec(['vulnerabilites', 'lire'], ['integrations', 'administrer']))).toBe(false);
  });

  it('état d’une source facultative et erreur courte', () => {
    expect(etatSourceAnnonce(annonce(), true)).toEqual({ libelle: 'Désactivée', etat: 'neutre' });
    expect(etatSourceAnnonce(annonce({ activee: true }), false)).toEqual({
      libelle: 'Veille inactive',
      etat: 'neutre',
    });
    expect(etatSourceAnnonce(annonce({ activee: true, erreur: 'x' }), true).etat).toBe('erreur');
    expect(etatSourceAnnonce(annonce({ activee: true }), true).libelle).toBe('Jamais collectée');
    expect(etatSourceAnnonce(annonce({ activee: true, derniereReussite: '2026-11-16T05:00:00.000Z' }), true)).toEqual({
      libelle: 'À jour',
      etat: 'succes',
    });
    expect(erreurCourte(null)).toBeNull();
    expect(erreurCourte('  Délai   dépassé.  ')).toBe('Délai dépassé.');
    expect(erreurCourte('abcdefghij', 5)).toBe('abcd…');
  });
});
