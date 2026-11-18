/* Module Vulnérabilités (ADR 0100), lot V1 : écran « Produits surveillés ». Menu conditionné par le droit du module,
   formulaire (champs obligatoires, envoi des seuls champs modifiés) et rendu du registre. Données fictives. */
import { MantineProvider } from '@mantine/core';
import type { Action, Module, ProduitSurveilleDto } from '@suivi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { famillesVisibles, localiser } from '../src/navigation';
import { ProduitsTable } from '../src/vulnerabilites/ProduitsSurveilles';
import {
  champsManquants,
  corpsCreation,
  corpsModification,
  formulaireDepuis,
  libelleResponsable,
  OPTIONS_FILTRE_FAMILLE,
  optionsResponsables,
  responsableDepuisValeur,
  urlProduits,
} from '../src/vulnerabilites/produits';

const ID = '00000000-0000-4000-8000-0000000000aa';
const produit = (p: Partial<ProduitSurveilleDto> = {}): ProduitSurveilleDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  fournisseurId: null,
  editeur: 'Éditeur fictif',
  nom: 'Produit fictif',
  versionProduit: '8.3',
  cpe: null,
  famille: 'web',
  criticite: 'elevee',
  responsable: null,
  responsableLibelle: null,
  origine: 'saisie',
  suivi: { rattachees: 0, aDecider: 0 },
  version: 1,
  createdBy: 'test',
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedBy: 'test',
  updatedAt: '2026-11-15T10:00:00.000Z',
  ...p,
});

describe('menu', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('l’entrée « Produits surveillés » n’apparaît qu’avec la lecture du module', () => {
    const avec = famillesVisibles(seulement(['vulnerabilites:lire']));
    expect(avec.map((f) => f.famille.id)).toContain('risques');
    const risques = avec.find((f) => f.famille.id === 'risques')!;
    expect(risques.destinations.map((d) => d.id)).toEqual(['vulnerabilites']);
    // Lot PC1 : le module s'ouvre sur la « Vue d'ensemble » ; « Produits surveillés » reste le deuxième onglet.
    expect(risques.destinations[0]!.to).toBe('/vulnerabilites/vue');
    expect(risques.destinations[0]!.rubriques.map((r) => r.to)).toContain('/vulnerabilites/produits');
    const sans = famillesVisibles(seulement(['pilotage:lire']));
    expect(sans.find((f) => f.famille.id === 'risques')?.destinations.map((d) => d.id)).toEqual(['risques']);
    expect(localiser('/vulnerabilites/produits')?.destination.id).toBe('vulnerabilites');
  });
});

describe('formulaire', () => {
  it('signale les champs obligatoires manquants', () => {
    expect(champsManquants(formulaireDepuis(null))).toEqual([
      'éditeur',
      'nom du produit',
      'version',
      'famille',
      'criticité',
    ]);
    // Version obligatoire (lot V4a, V21) : des espaces ne suffisent pas.
    expect(champsManquants({ ...formulaireDepuis(produit()), versionProduit: '  ' })).toEqual(['version']);
    expect(champsManquants(formulaireDepuis(produit()))).toEqual([]);
  });

  it('création : textes nettoyés, vides convertis, responsable reconstitué', () => {
    const f = {
      ...formulaireDepuis(null),
      editeur: '  Éditeur fictif ',
      nom: 'Produit fictif',
      famille: 'reseau' as const,
      criticite: 'faible' as const,
      cpe: '  ',
      responsable: `groupe:${ID}`,
    };
    expect(corpsCreation(f)).toEqual({
      fournisseurId: null,
      editeur: 'Éditeur fictif',
      nom: 'Produit fictif',
      versionProduit: '',
      cpe: null,
      famille: 'reseau',
      criticite: 'faible',
      responsable: { type: 'groupe', id: ID },
    });
  });

  it('modification : seuls les champs changés partent', () => {
    const avant = produit({ responsable: { type: 'utilisateur', id: ID }, responsableLibelle: 'Nom fictif' });
    expect(corpsModification(avant, formulaireDepuis(avant))).toEqual({});
    expect(corpsModification(avant, { ...formulaireDepuis(avant), criticite: 'moyenne', responsable: null })).toEqual({
      criticite: 'moyenne',
      responsable: null,
    });
  });

  it('valeurs de responsable et annuaire groupé', () => {
    expect(responsableDepuisValeur(`fonction:${ID}`)).toEqual({ type: 'fonction', id: ID });
    expect(responsableDepuisValeur('inconnu:x')).toBeNull();
    expect(responsableDepuisValeur(null)).toBeNull();
    const options = optionsResponsables({
      utilisateurs: [{ id: ID, username: 'compte.fictif', displayName: 'Nom fictif' }],
      groupes: [],
      fonctions: [{ id: ID, name: 'Fonction fictive', membres: 1 }],
    });
    expect(options.map((g) => g.group)).toEqual(['Personnes', 'Fonctions']);
    expect(options[0]!.items[0]).toEqual({ value: `utilisateur:${ID}`, label: 'Nom fictif (compte.fictif)' });
  });

  it('filtre par famille appliqué par le serveur', () => {
    expect(OPTIONS_FILTRE_FAMILLE).toHaveLength(7);
    expect(urlProduits('toutes')).toBe('/api/vulnerabilites/produits');
    expect(urlProduits('messagerie')).toBe('/api/vulnerabilites/produits?famille=messagerie');
  });
});

describe('registre', () => {
  const rendu = (props: Partial<Parameters<typeof ProduitsTable>[0]>) =>
    renderToStaticMarkup(
      createElement(
        MantineProvider,
        null,
        createElement(ProduitsTable, {
          produits: [],
          fournisseurs: new Map(),
          peutModifier: false,
          peutSupprimer: false,
          onModifier: () => {},
          onSupprimer: () => {},
          ...props,
        }),
      ),
    );

  it('affiche produit, éditeur, fournisseur, version, famille, criticité, responsable et origine', () => {
    const html = rendu({
      produits: [
        produit({ fournisseurId: 'SUP-001', cpe: 'cpe:2.3:a:editeur:produit:8.3:*:*:*:*:*:*:*' }),
        produit({
          id: '00000000-0000-4000-8000-000000000002',
          nom: 'Messagerie fictive',
          versionProduit: '',
          famille: 'messagerie',
          criticite: 'faible',
          responsable: { type: 'fonction', id: ID },
          responsableLibelle: 'Équipe messagerie fictive',
        }),
      ],
      fournisseurs: new Map([['SUP-001', 'Fournisseur fictif']]),
    });
    for (const texte of [
      'Produit fictif',
      'Éditeur fictif',
      'fournisseur Fournisseur fictif',
      'cpe:2.3:a:editeur:produit:8.3',
      '8.3',
      'Web',
      'Élevée',
      'Sans responsable',
      'Saisie',
      'Messagerie',
      'Faible',
      'Équipe messagerie fictive',
    ])
      expect(html).toContain(texte);
    expect(html).not.toContain('Modifier');
    expect(html).not.toContain('Supprimer');
  });

  it('boutons selon les droits, message quand le registre est vide', () => {
    const html = rendu({ produits: [produit()], peutModifier: true, peutSupprimer: false });
    expect(html).toContain('aria-label="Modifier Produit fictif"');
    expect(html).not.toContain('Supprimer Produit fictif');
    expect(rendu({ produits: [produit()], peutModifier: true, peutSupprimer: true })).toContain(
      'aria-label="Supprimer Produit fictif"',
    );
    expect(rendu({})).toContain('Aucun produit surveillé');
  });

  it('responsable disparu signalé', () => {
    expect(libelleResponsable({ responsable: { type: 'groupe', id: ID }, responsableLibelle: null })).toBe(
      'Responsable introuvable',
    );
  });
});
