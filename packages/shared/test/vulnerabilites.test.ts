/* Module Vulnérabilités (ADR 0100), lot V1 : schémas du registre des produits surveillés. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  cleDoublonProduit,
  CPE_23,
  CRITICITE_PRODUIT_LIBELLES,
  CRITICITES_PRODUIT,
  FAMILLE_PRODUIT_LIBELLES,
  FAMILLES_PRODUIT,
  MODULE_LABELS,
  MODULE_REGISTRY,
  ORIGINE_PRODUIT_LIBELLES,
  ORIGINES_PRODUIT,
  ProduitSurveilleBody,
  ProduitSurveillePatch,
  ProduitsSurveillesQuery,
} from '../src/index.js';

const base = {
  editeur: 'Éditeur fictif',
  nom: 'Produit fictif',
  versionProduit: '8.3',
  famille: 'web',
  criticite: 'moyenne',
};

describe('module Vulnérabilités', () => {
  it('est un module désactivable, libellé « Vulnérabilités », avec ses dépendances facultatives', () => {
    expect(MODULE_LABELS.vulnerabilites).toBe('Vulnérabilités');
    const def = MODULE_REGISTRY.find((m) => m.id === 'vulnerabilites')!;
    expect(def.protected).toBe(false);
    expect(def.required).toEqual([]);
    expect(def.optional).toEqual(['fournisseurs', 'ecarts', 'assistant']);
  });

  it('listes fermées : six familles, trois criticités, trois origines, chacune libellée', () => {
    expect(FAMILLES_PRODUIT).toEqual([
      'systemes',
      'reseau',
      'messagerie',
      'applications_metier',
      'postes_de_travail',
      'web',
    ]);
    expect(Object.values(FAMILLE_PRODUIT_LIBELLES)).toEqual([
      'Systèmes',
      'Réseau',
      'Messagerie',
      'Applications métier',
      'Postes de travail',
      'Web',
    ]);
    expect(CRITICITES_PRODUIT).toEqual(['faible', 'moyenne', 'elevee']);
    expect(Object.keys(CRITICITE_PRODUIT_LIBELLES)).toEqual([...CRITICITES_PRODUIT]);
    expect(ORIGINES_PRODUIT).toEqual(['saisie', 'ekialis', 'tenable']);
    expect(Object.keys(ORIGINE_PRODUIT_LIBELLES)).toEqual([...ORIGINES_PRODUIT]);
  });

  it('création : valeurs par défaut, texte nettoyé, origine non choisie par le client', () => {
    const p = ProduitSurveilleBody.parse({ ...base, editeur: '  Éditeur fictif  ' });
    expect(p).toEqual({
      ...base,
      fournisseurId: null,
      cpe: null,
      responsable: null,
    });
    expect(ProduitSurveilleBody.safeParse({ ...base, origine: 'tenable' }).success).toBe(false);
  });

  it('création : champs obligatoires, listes fermées et caractères de contrôle refusés', () => {
    expect(ProduitSurveilleBody.safeParse({ ...base, editeur: '   ' }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, nom: '' }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, famille: 'autre' }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, criticite: 'critique' }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, famille: undefined }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, criticite: undefined }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, nom: 'Produit\u0007fictif' }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, editeur: 'x'.repeat(201) }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, versionProduit: '1'.repeat(101) }).success).toBe(false);
  });

  it('version obligatoire (V21) : absente, vide ou faite d’espaces, refusée à la création comme à la modification', () => {
    const { versionProduit: _, ...sansVersion } = base;
    expect(ProduitSurveilleBody.safeParse(sansVersion).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, versionProduit: '' }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, versionProduit: '   ' }).success).toBe(false);
    expect(ProduitSurveilleBody.parse({ ...base, versionProduit: ' 10.1.2 ' }).versionProduit).toBe('10.1.2');
    expect(ProduitSurveillePatch.safeParse({ versionProduit: '' }).success).toBe(false);
    expect(ProduitSurveillePatch.safeParse({ versionProduit: '10.1.3' }).success).toBe(true);
  });

  it('responsable : personne, groupe ou fonction désignés par identifiant', () => {
    const id = '00000000-0000-4000-8000-0000000000aa';
    for (const type of ['utilisateur', 'groupe', 'fonction'] as const)
      expect(ProduitSurveilleBody.safeParse({ ...base, responsable: { type, id } }).success).toBe(true);
    expect(ProduitSurveilleBody.safeParse({ ...base, responsable: { type: 'equipe', id } }).success).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, responsable: { type: 'groupe', id: 'x' } }).success).toBe(false);
  });

  it('identifiant CPE 2.3 : forme contrôlée (13 composantes)', () => {
    const ok = 'cpe:2.3:a:editeur_fictif:produit_fictif:8.3:*:*:*:*:*:*:*';
    expect(CPE_23.test(ok)).toBe(true);
    expect(CPE_23.test('cpe:2.3:o:editeur:systeme\\:fictif:1.0:*:*:*:*:*:*:*')).toBe(true);
    expect(CPE_23.test('cpe:/a:editeur:produit:1.0')).toBe(false);
    expect(CPE_23.test('cpe:2.3:a:editeur:produit:1.0')).toBe(false);
    expect(CPE_23.test('cpe:2.3:x:editeur:produit:1:*:*:*:*:*:*:*')).toBe(false);
    expect(CPE_23.test('cpe:2.3:a:edi teur:produit:1:*:*:*:*:*:*:*')).toBe(false);
    expect(ProduitSurveilleBody.safeParse({ ...base, cpe: ok }).success).toBe(true);
    expect(ProduitSurveilleBody.safeParse({ ...base, cpe: 'n’importe quoi' }).success).toBe(false);
  });

  it('modification : au moins un champ, champs inconnus refusés', () => {
    expect(ProduitSurveillePatch.safeParse({}).success).toBe(false);
    expect(ProduitSurveillePatch.safeParse({ criticite: 'elevee' }).success).toBe(true);
    expect(ProduitSurveillePatch.safeParse({ origine: 'saisie' }).success).toBe(false);
    expect(ProduitSurveillePatch.safeParse({ version: 3 }).success).toBe(false);
  });

  it('filtre par famille et clé de doublon insensible à la casse', () => {
    expect(ProduitsSurveillesQuery.parse({})).toEqual({});
    expect(ProduitsSurveillesQuery.parse({ famille: 'reseau' })).toEqual({ famille: 'reseau' });
    expect(ProduitsSurveillesQuery.safeParse({ famille: 'autre' }).success).toBe(false);
    expect(cleDoublonProduit({ editeur: 'Éditeur Fictif', nom: 'PRODUIT', versionProduit: '8.3' })).toBe(
      cleDoublonProduit({ editeur: ' éditeur fictif ', nom: 'produit', versionProduit: '8.3' }),
    );
    expect(cleDoublonProduit({ editeur: 'A', nom: 'B', versionProduit: '1' })).not.toBe(
      cleDoublonProduit({ editeur: 'A', nom: 'B', versionProduit: '2' }),
    );
  });
});
