/* Module Vulnérabilités (ADR 0100), lot V1 : registre des produits surveillés, tenu au niveau de l'organisation comme les
   fournisseurs (ADR 0032), sans périmètre. La veille, les connecteurs et les failles viendront dans les lots suivants. */
import { z } from 'zod';
import { ResponsableRef } from './responsables.js';

/** Famille du produit (ADR 0100, point 18) : secteur du radar. Liste fermée. */
export const FAMILLES_PRODUIT = [
  'systemes',
  'reseau',
  'messagerie',
  'applications_metier',
  'postes_de_travail',
  'web',
] as const;
export type FamilleProduit = (typeof FAMILLES_PRODUIT)[number];
export const FAMILLE_PRODUIT_LIBELLES: Record<FamilleProduit, string> = {
  systemes: 'Systèmes',
  reseau: 'Réseau',
  messagerie: 'Messagerie',
  applications_metier: 'Applications métier',
  postes_de_travail: 'Postes de travail',
  web: 'Web',
};

/** Criticité du produit pour l'organisation : trois niveaux, aucune échelle existante du dépôt ne s'appliquant à un produit. */
export const CRITICITES_PRODUIT = ['faible', 'moyenne', 'elevee'] as const;
export type CriticiteProduit = (typeof CRITICITES_PRODUIT)[number];
export const CRITICITE_PRODUIT_LIBELLES: Record<CriticiteProduit, string> = {
  faible: 'Faible',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
};

/** Origine de la fiche : saisie à la main, ou proposée par un connecteur (lots V5 et V7). Seule la saisie existe en V1. */
export const ORIGINES_PRODUIT = ['saisie', 'ekialis', 'tenable'] as const;
export type OrigineProduit = (typeof ORIGINES_PRODUIT)[number];
export const ORIGINE_PRODUIT_LIBELLES: Record<OrigineProduit, string> = {
  saisie: 'Saisie',
  ekialis: 'Ekialis',
  tenable: 'Tenable',
};

/** Identifiant normalisé CPE 2.3 (forme « cpe:2.3:part:éditeur:produit:version:… », 13 composantes, deux-points échappés
    admis). Contrôle de forme seulement : la plateforme ne consulte aucun dictionnaire en ligne. */
export const CPE_23 = /^cpe:2\.3:[aho*-](?::(?:[^:\\\s]|\\[^\s])+){10}$/;

const texte = (max: number) => z.string().trim().max(max);
const sansControle = (s: string) => !/\p{Cc}/u.test(s);

const champsProduit = {
  /** Identifiant du fournisseur au registre de l'organisation (ADR 0032), facultatif. */
  fournisseurId: z.string().trim().min(1).max(200).nullable(),
  editeur: texte(200).min(1, 'Éditeur obligatoire.').refine(sansControle, 'Caractère de contrôle refusé.'),
  nom: texte(200).min(1, 'Nom du produit obligatoire.').refine(sansControle, 'Caractère de contrôle refusé.'),
  versionProduit: texte(100).refine(sansControle, 'Caractère de contrôle refusé.'),
  cpe: z.string().trim().max(500).regex(CPE_23, 'Identifiant CPE 2.3 attendu (cpe:2.3:…).').nullable(),
  famille: z.enum(FAMILLES_PRODUIT),
  criticite: z.enum(CRITICITES_PRODUIT),
  responsable: ResponsableRef.nullable(),
};

/** Création d'un produit surveillé. L'origine n'est pas choisie : une saisie est toujours d'origine « saisie ». */
export const ProduitSurveilleBody = z
  .object({
    ...champsProduit,
    fournisseurId: champsProduit.fournisseurId.default(null),
    versionProduit: champsProduit.versionProduit.default(''),
    cpe: champsProduit.cpe.default(null),
    responsable: champsProduit.responsable.default(null),
  })
  .strict();
export type ProduitSurveilleBody = z.infer<typeof ProduitSurveilleBody>;

/** Modification : seuls les champs présents sont écrits ; la version attendue passe par If-Match. */
export const ProduitSurveillePatch = z
  .object(champsProduit)
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'Aucune modification.');
export type ProduitSurveillePatch = z.infer<typeof ProduitSurveillePatch>;

export interface ProduitSurveilleDto {
  id: string;
  fournisseurId: string | null;
  editeur: string;
  nom: string;
  versionProduit: string;
  cpe: string | null;
  famille: FamilleProduit;
  criticite: CriticiteProduit;
  responsable: ResponsableRef | null;
  /** Libellé du responsable (personne, groupe ou fonction) ; null si aucun, ou si la cible a disparu. */
  responsableLibelle: string | null;
  origine: OrigineProduit;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

/** Filtre de la liste : par famille (absent : toutes). */
export const ProduitsSurveillesQuery = z.object({ famille: z.enum(FAMILLES_PRODUIT).optional() }).strict();
export type ProduitsSurveillesQuery = z.infer<typeof ProduitsSurveillesQuery>;

/** Clé de doublon : même éditeur, même produit et même version, sans tenir compte de la casse ni des espaces de bord. */
export const cleDoublonProduit = (p: { editeur: string; nom: string; versionProduit: string }) =>
  [p.editeur, p.nom, p.versionProduit].map((s) => s.trim().toLowerCase()).join('\u0000');
