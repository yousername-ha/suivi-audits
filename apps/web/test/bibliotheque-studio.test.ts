/* Bibliothèque Studio (refonte Neon, lot 4, ADR 0093) : recherche tolérante, provenance déclarée, barre des états sans
   segment vide, et dalle d'un référentiel rendue avec les libellés et noms accessibles des parcours existants. */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BibliothequeStudio } from '../src/pilotage/BibliothequeStudio';
import {
  filtrerReferentiels,
  normaliser,
  provenance,
  segmentsEtats,
  type ReferentielBibliotheque,
} from '../src/pilotage/bibliotheque-types';
import type { CouvertureReferentiel } from '../src/pilotage/Couverture';

const ref = (p: Partial<ReferentielBibliotheque> = {}): ReferentielBibliotheque => ({
  id: 'f1',
  identifier: 'REF-FICTIF',
  name: 'Référentiel fictif',
  version: 2,
  requirements: 12,
  scopes: 1,
  source: { status: 'organisation', organisation: 'Mon organisation' },
  locked: true,
  derivedFrom: null,
  ...p,
});
const etats = { non_implemente: 2, partiel: 1, implemente: 0, teste: 1, valide_metier: 0, non_applicable: 0 };
const couv = (p: Partial<CouvertureReferentiel> = {}): CouvertureReferentiel => ({
  frameworkId: 'copie-1',
  identifier: 'REF-FICTIF',
  name: 'Référentiel fictif',
  version: 2,
  requirements: 4,
  covered: 1,
  uncovered: 3,
  etats: { ...etats, applicables: 4, aDeterminer: 1, obligatoiresNonConformes: 2 },
  ...p,
});

describe('recherche et provenance', () => {
  it('ignore accents et majuscules, sur le nom comme sur l’identifiant', () => {
    const liste = [ref(), ref({ id: 'f2', name: 'Sécurité des données', identifier: 'SEC-2' })];
    expect(normaliser('Sécurité')).toBe('securite');
    expect(filtrerReferentiels(liste, 'securite').map((f) => f.id)).toEqual(['f2']);
    expect(filtrerReferentiels(liste, 'ref-fic').map((f) => f.id)).toEqual(['f1']);
    expect(filtrerReferentiels(liste, '  ')).toHaveLength(2);
  });
  it('dit « Source à vérifier » pour une source reprise de l’outil de suivi, jamais « officielle »', () => {
    expect(provenance(ref({ source: { status: 'unverified', organisation: '' } }))).toBe('Source à vérifier');
    expect(provenance(ref({ derivedFrom: { identifier: 'X', name: 'Origine fictive', version: 1 } }))).toBe(
      'Copie de Origine fictive',
    );
    expect(provenance(ref({ source: { status: 'autre', organisation: '' } }))).toBe('autre');
  });
});

describe('barre des états', () => {
  it('ne trace que les états non vides, bout à bout sur 1000', () => {
    const s = segmentsEtats(etats);
    expect(s.map((x) => x.etat)).toEqual(['non_implemente', 'partiel', 'teste']);
    expect(s.map((x) => x.x)).toEqual([0, 500, 750]);
    expect(s[0]!.largeur).toBe(498);
  });
  it('ne trace rien sans exigence', () => {
    expect(segmentsEtats({ ...etats, non_implemente: 0, partiel: 0, teste: 0 })).toEqual([]);
  });
});

describe('dalle d’un référentiel', () => {
  const rendu = (p: Partial<Parameters<typeof BibliothequeStudio>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(BibliothequeStudio, {
        catalogue: [ref()],
        chargement: false,
        smsi: 'perimetre-1',
        couverture: [couv()],
        couvertureChargement: false,
        couvertureErreur: false,
        modifier: true,
        onImporter: () => undefined,
        onExigences: () => undefined,
        onEdition: () => undefined,
        onCouverture: () => undefined,
        outils: null,
        ...p,
      }),
    );
  it('garde le nom accessible de la dalle, « Figé », l’identifiant et les commandes existantes', () => {
    const html = rendu();
    expect(html).toContain('aria-label="Référentiel Référentiel fictif"');
    expect(html).toContain('>Figé<');
    expect(html).toContain('REF-FICTIF');
    expect(html).toContain('exigences au catalogue');
    expect(html).toContain('aria-label="Consulter les exigences de Référentiel fictif"');
    expect(html).toContain('aria-label="Importer une nouvelle édition de Référentiel fictif"');
    expect(html).toContain('aria-label="Voir la couverture de Référentiel fictif"');
    expect(html).toContain('Importer un référentiel');
    expect(html).toContain('data-fiche-ouvrable="true"');
    // La bibliothèque est figée : ni copie ni ajout d'exigence.
    expect(html).not.toContain('copie personnalisable');
    expect(html).not.toContain('Ajouter une exigence');
    expect(html).not.toContain('style=');
  });
  it('affiche les clauses obligatoires et les applicabilités à déterminer, sans score', () => {
    const html = rendu();
    expect(html).toContain('2 clause(s) obligatoire(s) (4 à 10) pas encore');
    expect(html).toContain('1 exigence(s) à déterminer');
    expect(html).toContain('bb-warning-clauses');
    expect(html).not.toMatch(/\d+ ?%/);
  });
  it('n’invente pas de zéros quand la couverture est en chargement, en erreur ou absente', () => {
    expect(rendu({ couverture: undefined, couvertureChargement: true })).toContain('Chargement de la couverture');
    expect(rendu({ couverture: undefined, couvertureErreur: true })).toContain('Couverture indisponible');
    expect(rendu({ couverture: [] })).toContain('Non appliqué dans ce périmètre');
  });
  it('réserve les commandes d’écriture aux personnes qui peuvent modifier', () => {
    const html = rendu({ modifier: false });
    expect(html).not.toContain('Importer un référentiel');
    expect(html).not.toContain('Nouvelle édition');
    expect(html).toContain('Exigences');
  });
});
