/* Module Vulnérabilités (ADR 0100, lot V4a) : fiche d'un produit (rapprochements regroupés, motifs et plages en clair,
   décision offerte seulement sur une proposition et avec le droit), suggestion d'identifiant, machines reliées avec la
   mention « déclaré », failles déclarées, priorité et faits, produits reliés à une machine, seuils de priorité (menu, aide,
   saisie en pourcentage). Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { FailleDeclareeDto, ProduitSurveilleDto, RapprochementDto } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { DeclareesTable, PrioriteFaits } from '../src/vulnerabilites/FaillesDetectees';
import { ProduitsRelies } from '../src/vulnerabilites/Machines';
import { MachinesReliees, ProduitsTable, RapprochementsProduit } from '../src/vulnerabilites/ProduitsSurveilles';
import { depuisPourcentage, enPourcentage, GrillePriorite } from '../src/vulnerabilites/SeuilsPriorite';
import { ETAT_PRIORITE, faitsPriorite } from '../src/vulnerabilites/failles';
import {
  explicationProposition,
  groupesRapprochements,
  libellePlage,
  urlSuggestionsCpe,
} from '../src/vulnerabilites/produits';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const rien = () => undefined;

const rapp = (r: Partial<RapprochementDto> = {}): RapprochementDto => ({
  id: '00000000-0000-4000-8000-000000000r01'.replace('r', 'b'),
  cve: 'CVE-2026-91001',
  statut: 'proposee',
  motif: 'nom_seulement',
  versionDansPlage: 'oui',
  parIdentifiant: false,
  plages: [
    {
      editeur: 'editeur_fictif',
      produit: 'gestionnaire_fictif',
      version: null,
      debutInclus: '10.0',
      debutExclus: null,
      finInclus: null,
      finExclus: '10.1.5',
    },
  ],
  tronque: false,
  description: 'Fictional <b>description</b>.',
  gravite: 'critique',
  cvssScore: 9.3,
  epss: 0.2,
  kev: false,
  alerteCertFr: false,
  decidePar: null,
  decideLe: null,
  note: '',
  versionDecidee: null,
  calculeLe: '2026-11-16T10:00:00.000Z',
  version: 1,
  priorite: {
    niveau: 'P4',
    faits: [
      { fait: 'presence', presence: 'a_confirmer' },
      { fait: 'gravite', gravite: 'critique' },
    ],
  },
  ...r,
});

const produit = (p: Partial<ProduitSurveilleDto> = {}): ProduitSurveilleDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  fournisseurId: null,
  editeur: 'Éditeur fictif',
  nom: 'Gestionnaire fictif',
  versionProduit: '10.1.2',
  cpe: null,
  famille: 'applications_metier',
  criticite: 'elevee',
  responsable: null,
  responsableLibelle: null,
  origine: 'saisie',
  suivi: { rattachees: 2, aDecider: 3 },
  version: 4,
  createdBy: 'test',
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedBy: 'test',
  updatedAt: '2026-11-16T10:00:00.000Z',
  ...p,
});

describe('fiche d’un produit : helpers', () => {
  it('suggestions : adresse composée seulement à partir de deux caractères', () => {
    expect(urlSuggestionsCpe({ editeur: '', nom: 'G' })).toBeNull();
    expect(urlSuggestionsCpe({ editeur: ' Éditeur fictif ', nom: ' Gestionnaire fictif ' })).toBe(
      '/api/vulnerabilites/identites-cpe?nom=Gestionnaire+fictif&editeur=%C3%89diteur+fictif',
    );
    expect(urlSuggestionsCpe({ editeur: '', nom: 'gl' })).toBe('/api/vulnerabilites/identites-cpe?nom=gl');
  });

  it('groupes dans l’ordre : à décider, rattachées (d’office ou confirmées), écartées, rejetées ; retirées et vides omis', () => {
    const g = groupesRapprochements([
      rapp({ statut: 'rejetee', cve: 'CVE-2026-91009' }),
      rapp({ statut: 'confirmee', cve: 'CVE-2026-91008' }),
      rapp({ statut: 'rattachee', cve: 'CVE-2026-91007' }),
      rapp({ statut: 'retiree', cve: 'CVE-2026-91006' }),
      rapp({ statut: 'proposee', cve: 'CVE-2026-91005' }),
    ]);
    expect(g.map((x) => [x.titre, x.rapprochements.map((r) => r.cve)])).toEqual([
      ['Propositions à décider', ['CVE-2026-91005']],
      ['CVE rattachées (d’office ou confirmées)', ['CVE-2026-91008', 'CVE-2026-91007']],
      ['Propositions rejetées', ['CVE-2026-91009']],
    ]);
  });

  it('plages et motifs en clair', () => {
    expect(libellePlage(rapp().plages[0]!)).toBe('à partir de 10.0 (incluse), avant 10.1.5 (exclue)');
    expect(
      libellePlage({ version: '2.0', debutInclus: null, debutExclus: null, finInclus: null, finExclus: null }),
    ).toBe('version 2.0');
    expect(
      libellePlage({ version: null, debutInclus: null, debutExclus: '1.0', finInclus: '2.0', finExclus: null }),
    ).toBe('après 1.0 (exclue), jusqu’à 2.0 (incluse)');
    expect(
      libellePlage({ version: null, debutInclus: null, debutExclus: null, finInclus: null, finExclus: null }),
    ).toBe('aucune plage publiée');
    expect(explicationProposition(rapp())).toBe('Nom seulement · La version déclarée semble dans la plage');
    expect(explicationProposition(rapp({ motif: 'sans_plage', versionDansPlage: 'inconnu' }))).toBe(
      'Aucune plage publiée · Position de la version inconnue',
    );
    expect(explicationProposition(rapp({ motif: 'non_comparable', versionDansPlage: 'non' }))).toBe(
      'Version non comparable · La version déclarée semble hors de la plage',
    );
  });
});

describe('fiche d’un produit : rendu', () => {
  it('propositions : motif, position, plage, priorité et faits ; « Décider » seulement avec le droit', () => {
    const html = rendu(
      createElement(RapprochementsProduit, {
        rapprochements: [rapp(), rapp({ id: 'x2', cve: 'CVE-2026-91002', statut: 'rattachee', motif: null })],
        peutDecider: true,
        onDecider: rien,
      }),
    );
    expect(html).toContain('Propositions à décider (1)');
    expect(html).toContain('Nom seulement · La version déclarée semble dans la plage');
    expect(html).toContain('à partir de 10.0 (incluse), avant 10.1.5 (exclue)');
    expect(html).toContain('Produit à confirmer · Gravité critique');
    expect(html).toContain('Décider CVE-2026-91001');
    expect(html).not.toContain('Décider CVE-2026-91002');
    // Texte de la source en texte simple.
    expect(html).toContain('Fictional &lt;b&gt;description&lt;/b&gt;.');
    const lecteur = rendu(
      createElement(RapprochementsProduit, { rapprochements: [rapp()], peutDecider: false, onDecider: rien }),
    );
    expect(lecteur).not.toContain('Décider');
    expect(
      rendu(createElement(RapprochementsProduit, { rapprochements: [], peutDecider: true, onDecider: rien })),
    ).toContain('Aucune faille de la veille');
  });

  it('décision affichée : auteur, version décidée, note ; liste tronquée signalée', () => {
    const html = rendu(
      createElement(RapprochementsProduit, {
        rapprochements: [
          rapp({
            statut: 'rejetee',
            decidePar: 'compte.fictif',
            decideLe: '2026-11-16T11:00:00.000Z',
            versionDecidee: '10.1.2',
            note: 'Homonyme fictif.',
            tronque: true,
          }),
        ],
        peutDecider: true,
        onDecider: rien,
      }),
    );
    expect(html).toContain('Rejetée par compte.fictif');
    expect(html).toContain('(version 10.1.2) : Homonyme fictif.');
    expect(html).toContain('pas pu garder tous les produits touchés');
    expect(html).not.toContain('Décider');
  });

  it('machines reliées : mention « déclaré », délier seulement avec le droit', () => {
    const m = {
      id: '00000000-0000-4000-8000-0000000000c1',
      nom: 'srv-fictif.exemple.invalid',
      adresse: '192.0.2.30',
      role: 'front' as const,
      perimetreNom: 'Périmètre fictif',
      relieLe: '2026-11-16T10:00:00.000Z',
    };
    const html = rendu(createElement(MachinesReliees, { machines: [m], peutModifier: true, onDelier: rien }));
    expect(html).toContain('Déclaré');
    expect(html).toContain('Front · Périmètre fictif');
    expect(html).toContain('aria-label="Délier srv-fictif.exemple.invalid"');
    expect(rendu(createElement(MachinesReliees, { machines: [m], peutModifier: false, onDelier: rien }))).not.toContain(
      'Délier',
    );
    expect(rendu(createElement(MachinesReliees, { machines: [], peutModifier: true, onDelier: rien }))).toContain(
      'Aucune machine reliée',
    );
  });

  it('registre : nom cliquable vers la fiche, failles rattachées et à décider, date de mise à jour de la fiche', () => {
    const html = rendu(
      createElement(ProduitsTable, {
        produits: [produit()],
        fournisseurs: new Map(),
        peutModifier: false,
        peutSupprimer: false,
        onModifier: rien,
        onSupprimer: rien,
        onOuvrir: rien,
      }),
    );
    expect(html).toContain('2 rattachées');
    expect(html).toContain('3 à décider');
    expect(html).toContain('fiche mise à jour le');
    expect(html).toMatch(/<button[^>]*>Gestionnaire fictif<\/button>/);
  });
});

describe('failles déclarées, priorité, machines', () => {
  const declaree: FailleDeclareeDto = {
    rapprochementId: '00000000-0000-4000-8000-0000000000d1',
    cve: 'CVE-2026-91003',
    statut: 'confirmee',
    produit: {
      id: '00000000-0000-4000-8000-000000000001',
      editeur: 'Éditeur fictif',
      nom: 'Gestionnaire fictif',
      versionProduit: '10.1.2',
    },
    gravite: 'critique',
    cvssScore: 9.3,
    epss: null,
    kev: true,
    alerteCertFr: false,
    machines: 2,
    present: true,
    priorite: {
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['kev'] },
        { fait: 'presence', presence: 'declaree' },
      ],
    },
    suivi: {
      etat: 'a_traiter',
      proposition: 'aucune',
      revueLe: null,
      revueDepassee: false,
      nombreActions: 1,
      version: 2,
    },
  };
  it('liste des failles déclarées : mention « déclaré », produit et version, priorité et faits', () => {
    const html = rendu(createElement(DeclareesTable, { failles: [declaree] }));
    expect(html).toContain('Déclaré');
    expect(html).toContain('Gestionnaire fictif 10.1.2');
    expect(html).toContain('Éditeur fictif · Confirmée');
    expect(html).toContain('Exploitation avérée (catalogue KEV) · Déclarée (produit surveillé)');
    expect(html).toContain('Exploitée (KEV)');
    expect(rendu(createElement(DeclareesTable, { failles: [] }))).toContain('Aucune faille déclarée');
  });

  it('priorité : couleur par niveau, faits en clair', () => {
    expect(ETAT_PRIORITE).toEqual({ P1: 'erreur', P2: 'attention', P3: 'info', P4: 'neutre' });
    expect(faitsPriorite({ niveau: 'P2', faits: [{ fait: 'epss', score: 0.6, seuil: 0.5 }] })).toEqual([
      'Score EPSS 60 % (seuil 50 %)',
    ]);
    expect(rendu(createElement(PrioriteFaits, { p: declaree.priorite }))).toContain('P1');
  });

  it('produits reliés à une machine : CVE rattachées, délier avec le droit', () => {
    const p = {
      id: 'p1',
      editeur: 'Éditeur fictif',
      nom: 'Gestionnaire fictif',
      versionProduit: '10.1.2',
      version: 3,
      cvesRattachees: 1,
    };
    const html = rendu(createElement(ProduitsRelies, { produits: [p], peutModifier: true, onDelier: rien }));
    expect(html).toContain('1 CVE rattachée');
    expect(html).toContain('aria-label="Délier Gestionnaire fictif"');
    expect(rendu(createElement(ProduitsRelies, { produits: [], peutModifier: true, onDelier: rien }))).toContain(
      'Aucun produit surveillé relié',
    );
  });
});

describe('seuils de priorité', () => {
  it('saisie en pourcentage, de 1 à 100', () => {
    expect(enPourcentage(0.5)).toBe(50);
    expect(enPourcentage(0.0125)).toBe(1.25);
    expect(depuisPourcentage(50)).toBe(0.5);
    expect(depuisPourcentage('12,5')).toBe(0.125);
    expect(depuisPourcentage(0)).toBeNull();
    expect(depuisPourcentage(101)).toBeNull();
    expect(depuisPourcentage('')).toBeNull();
    expect(depuisPourcentage('abc')).toBeNull();
  });

  it('grille affichée avec le seuil réglé', () => {
    const html = rendu(createElement(GrillePriorite, { seuilEpss: 0.25 }));
    expect(html).toContain('score EPSS d’au moins 25 %');
    for (const n of ['P1', 'P2', 'P3', 'P4']) expect(html).toContain(`<strong>${n}</strong>`);
  });

  it('aide : grille, seuil réglable par l’administration du module, aucun taux inventé', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-priorite')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    expect(a.link).toBe('/vulnerabilites/priorite');
    const texte = a.steps.join(' ');
    for (const m of ['P1', 'seuil du score EPSS', 'administrer', 'jamais par le modèle']) expect(texte).toContain(m);
    const produits = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-produits')!.steps.join(' ');
    for (const m of ['version, famille et criticité sont obligatoires', 'déclaré', 'rattachée d’office', 'proposée'])
      expect(produits).toContain(m);
  });
});
