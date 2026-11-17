/* Module Vulnérabilités (ADR 0100, lot ALH5), côté interface : fait « mène à une machine interne vulnérable » affiché sans
   nom, technologie dont la priorité vient de versions non détaillées (dit sans nom), exposition hors lecture dans la veille,
   liaison en masse (saisie contrôlée, aperçu rendu comme texte, résumé, bilan, libellé « en masse »), aide. Données
   entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import { type ApercuLiaisonMasseDto, type Priorite, type TechnologieAlhDto } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { faitsPriorite } from '../src/vulnerabilites/failles';
import { ApercuMasse, TechnologiesAlh } from '../src/vulnerabilites/SurfaceExterne';
import {
  demandeMasse,
  libelleLiaison,
  OPTIONS_MODE_MASSE,
  prioriteHorsDetail,
  resumeApercuMasse,
  resumeResultatMasse,
  SAISIE_MASSE_VIDE,
  URL_APERCU_MASSE,
  URL_LIAISON_MASSE,
} from '../src/vulnerabilites/surface';

const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const p = (niveau: Priorite['niveau'], majoree = false): Priorite => ({
  niveau,
  faits: [
    { fait: 'presence', presence: 'exposee' },
    ...(majoree ? [{ fait: 'machine_interne_vulnerable' as const }] : []),
  ],
});
const techno = (t: Partial<TechnologieAlhDto> = {}): TechnologieAlhDto => ({
  id: ID(1),
  nom: 'logiciel-fictif',
  editeur: 'Éditeur fictif',
  produit: 'logiciel-fictif',
  technologie: null,
  derniere: null,
  tronquee: false,
  versions: [
    {
      version: '1.0',
      actifs: [{ type: 'hote', libelle: '192.0.2.10' }],
      cves: [
        {
          cve: 'CVE-2026-95010',
          titre: null,
          cvss: null,
          epss: null,
          severite: null,
          preuve: false,
          exploitee: false,
          publieeLe: null,
          priorite: p('P3'),
        },
      ],
    },
  ],
  actifsInactifs: 0,
  nombreCves: 1,
  exploitees: 0,
  preuves: 0,
  cvssMax: null,
  integration: { id: ID(2), nom: 'AlgoLightHouse fictif' },
  priorite: p('P1'),
  produits: [],
  ...t,
});
const apercu = (a: Partial<ApercuLiaisonMasseDto> = {}): ApercuLiaisonMasseDto => ({
  demande: { mode: 'un_pour_un', motifActifs: 'pre-*.exemple.example', motifMachines: 'srv-pre-*' },
  machine: null,
  paires: [
    {
      actif: { id: ID(41), type: 'domaine', valeur: 'pre-web01.exemple.example' },
      machine: { id: ID(51), nom: 'srv-pre-web01', adresse: '192.0.2.21' },
      versionLiaisons: 1,
    },
  ],
  actifs: 4,
  sansCorrespondance: [{ id: ID(42), type: 'domaine', valeur: 'pre-web02.exemple.example' }],
  nombreSansCorrespondance: 1,
  multiples: [{ actif: { id: ID(44), type: 'domaine', valeur: 'pre-web04.exemple.example' }, machines: 2 }],
  nombreMultiples: 1,
  dejaReliees: 0,
  plafond: 0,
  nonModifiables: 1,
  empreinte: 'a'.repeat(64),
  max: 200,
  ...a,
});

describe('priorité la même pour tout le monde, majoration (lot ALH5)', () => {
  it('le fait de la majoration s’affiche sans nom de machine', () => {
    expect(faitsPriorite(p('P2', true))).toEqual([
      'Exposée sur Internet (AlgoLightHouse)',
      'Mène à une machine interne vulnérable',
    ]);
  });
  it('technologie : priorité tenue de versions non détaillées, dite sans nom', () => {
    expect(prioriteHorsDetail(techno())).toBe(true);
    expect(prioriteHorsDetail(techno({ priorite: p('P3') }))).toBe(false);
    expect(prioriteHorsDetail(techno({ priorite: null }))).toBe(false);
    expect(prioriteHorsDetail(techno({ versions: [] }))).toBe(true);
    const html = rendre(createElement(TechnologiesAlh, { technologies: [techno()] }));
    expect(html).toContain('Priorité tenue de versions détectées sur des actifs que vous ne pouvez pas lire');
    expect(rendre(createElement(TechnologiesAlh, { technologies: [techno({ priorite: p('P3') })] }))).not.toContain(
      'Priorité tenue de versions',
    );
  });
});

describe('liaison en masse (lot ALH5)', () => {
  it('saisie : motifs exigés, même nombre de jokers en un pour un, machine exigée sinon', () => {
    expect(demandeMasse(SAISIE_MASSE_VIDE)).toBe('Indiquez le motif des actifs.');
    expect(demandeMasse({ ...SAISIE_MASSE_VIDE, motifActifs: 'pre-*' })).toBe('Indiquez le motif des machines.');
    expect(demandeMasse({ ...SAISIE_MASSE_VIDE, motifActifs: 'pre-*', motifMachines: 'srv-*-*' })).toMatch(
      /même nombre de jokers/,
    );
    expect(demandeMasse({ ...SAISIE_MASSE_VIDE, motifActifs: ' pre-* ', motifMachines: 'srv-pre-*' })).toEqual({
      mode: 'un_pour_un',
      motifActifs: 'pre-*',
      motifMachines: 'srv-pre-*',
    });
    expect(demandeMasse({ ...SAISIE_MASSE_VIDE, mode: 'tous_vers_une', motifActifs: 'pre-*' })).toBe(
      'Choisissez la machine interne.',
    );
    expect(
      demandeMasse({ ...SAISIE_MASSE_VIDE, mode: 'tous_vers_une', motifActifs: 'pre-*', machineId: ID(7) }),
    ).toEqual({ mode: 'tous_vers_une', motifActifs: 'pre-*', machineId: ID(7) });
    expect(OPTIONS_MODE_MASSE.map((o) => o.label)).toEqual([
      'Un pour un (même partie couverte par le joker)',
      'Tous vers une machine',
    ]);
    expect([URL_APERCU_MASSE, URL_LIAISON_MASSE]).toEqual([
      '/api/vulnerabilites/surface/liaisons/masse/apercu',
      '/api/vulnerabilites/surface/liaisons/masse',
    ]);
  });
  it('aperçu : résumé chiffré, paires, sans correspondance et multiples ; textes rendus comme texte', () => {
    expect(resumeApercuMasse(apercu())).toBe(
      '4 actifs correspondent au motif : 1 paire à relier ; 1 actif sans correspondance ; 1 actif écarté (plusieurs machines correspondent) ; 1 paire hors de vos droits d’écriture.',
    );
    expect(
      resumeApercuMasse(
        apercu({
          paires: [],
          actifs: 0,
          sansCorrespondance: [],
          nombreSansCorrespondance: 0,
          multiples: [],
          nombreMultiples: 0,
          nonModifiables: 0,
        }),
      ),
    ).toBe('0 actif correspond au motif : 0 paire à relier.');
    const html = rendre(createElement(ApercuMasse, { apercu: apercu() }));
    expect(html).toContain('pre-web01.exemple.example');
    expect(html).toContain('srv-pre-web01');
    expect(html).toContain('Sans correspondance : pre-web02.exemple.example');
    expect(html).toContain('pre-web04.exemple.example (2)');
    const piege = rendre(
      createElement(ApercuMasse, {
        apercu: apercu({
          paires: [
            {
              actif: { id: ID(41), type: 'domaine', valeur: '<img src=x>.exemple.example' },
              machine: { id: ID(51), nom: '<script>x</script>', adresse: null },
              versionLiaisons: 1,
            },
          ],
        }),
      }),
    );
    expect(piege).not.toMatch(/<img|<script/i);
  });
  it('bilan et libellé d’une liaison faite en masse', () => {
    expect(resumeResultatMasse({ reliees: 3, ecartees: 0 })).toBe('3 paires reliées.');
    expect(resumeResultatMasse({ reliees: 1, ecartees: 2 })).toBe(
      '1 paire reliée ; 2 paires écartées (changées depuis l’aperçu).',
    );
    expect(libelleLiaison({ statut: 'confirmee', motif: null, origine: 'masse', decidePar: 'rssi.fictif' })).toBe(
      'Reliée en masse par motif par rssi.fictif (sans critère de la plateforme)',
    );
  });
});

describe('aide', () => {
  it('l’aide de la surface externe explique la priorité commune, la majoration et la liaison en masse', () => {
    const texte = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-surface')!.steps.join(' ');
    for (const attendu of [
      'même pour tout le monde',
      'machine interne vulnérable',
      'Relier en masse',
      'joker',
      'aperçu',
    ])
      expect(texte).toContain(attendu);
  });
});
