/* Module Vulnérabilités (ADR 0100, lot TEN-SCORES ; décision du RSSI du 22/11/2026) : criticité (ACR, Asset Criticality
   Rating) et exposition (AES, Asset Exposure Score) d'une machine, telles que Tenable Security Center les calcule.
   - Catégories officielles de Tenable (docs.tenable.com, « Tenable Exposure Management Metrics ») : ACR Critique 9–10,
     Élevée 7–8, Moyenne 4–6, Faible 1–3 ; AES Élevée 650–1000, Moyenne 350–649, Faible 0–349.
   - Les catégories se lisent comme des seuils (une valeur au moins égale au bas de la catégorie) : une valeur entre deux
     catégories publiées (ACR décimale, ACR inférieure à 1) prend la catégorie inférieure.
   - Une valeur absente (non fournie par Tenable, import Nessus) n'a aucune catégorie et ne répond à aucun filtre ; elle
     s'affiche « — », jamais 0.
   - Informations affichées seulement : ni la priorité, ni le rang, ni les alertes n'en dépendent. */
import { z } from 'zod';

export const CATEGORIES_ACR = ['critique', 'elevee', 'moyenne', 'faible'] as const;
export type CategorieAcr = (typeof CATEGORIES_ACR)[number];
/** Bas de chaque catégorie d'ACR (0 à 10). */
export const SEUILS_ACR: Record<CategorieAcr, number> = { critique: 9, elevee: 7, moyenne: 4, faible: 0 };
export const CATEGORIE_ACR_LIBELLES: Record<CategorieAcr, string> = {
  critique: 'Critique',
  elevee: 'Élevée',
  moyenne: 'Moyenne',
  faible: 'Faible',
};

export const CATEGORIES_AES = ['elevee', 'moyenne', 'faible'] as const;
export type CategorieAes = (typeof CATEGORIES_AES)[number];
/** Bas de chaque catégorie d'AES (0 à 1000). */
export const SEUILS_AES: Record<CategorieAes, number> = { elevee: 650, moyenne: 350, faible: 0 };
export const CATEGORIE_AES_LIBELLES: Record<CategorieAes, string> = {
  elevee: 'Élevée',
  moyenne: 'Moyenne',
  faible: 'Faible',
};

/** Catégorie d'une ACR (null : valeur absente). */
export function categorieAcr(v: number | null | undefined): CategorieAcr | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return CATEGORIES_ACR.find((c) => v >= SEUILS_ACR[c]) ?? null;
}
/** Catégorie d'un AES (null : valeur absente). */
export function categorieAes(v: number | null | undefined): CategorieAes | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return CATEGORIES_AES.find((c) => v >= SEUILS_AES[c]) ?? null;
}

/** Filtres de la liste des machines : catégorie minimale. ACR : Critique, Élevée ou plus, Moyenne ou plus ; AES : Élevée,
    Moyenne ou plus. */
export const FILTRES_ACR = ['critique', 'elevee', 'moyenne'] as const;
export const FiltreAcr = z.enum(FILTRES_ACR);
export type FiltreAcr = z.infer<typeof FiltreAcr>;
export const FILTRE_ACR_LIBELLES: Record<FiltreAcr, string> = {
  critique: 'Critique',
  elevee: 'Élevée ou plus',
  moyenne: 'Moyenne ou plus',
};
export const FILTRES_AES = ['elevee', 'moyenne'] as const;
export const FiltreAes = z.enum(FILTRES_AES);
export type FiltreAes = z.infer<typeof FiltreAes>;
export const FILTRE_AES_LIBELLES: Record<FiltreAes, string> = {
  elevee: 'Élevée',
  moyenne: 'Moyenne ou plus',
};
