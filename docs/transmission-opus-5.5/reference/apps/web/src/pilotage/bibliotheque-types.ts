/* Métadonnées existantes de la bibliothèque et couverture du périmètre. Pas de schéma serveur ajouté. */
import type { SyntheseEtats } from '@suivi/shared';
export interface ReferentielBibliotheque {
  id: string;
  identifier: string;
  name: string;
  version: number;
  requirements: number;
  scopes: number;
  source: { status: string; organisation: string };
  locked: boolean;
  derivedFrom: { identifier: string; name: string; version: number } | null;
}
export interface ReferentielCouverture {
  frameworkId: string;
  name: string;
  version: number;
  requirements: number;
  covered: number;
  toValidate: number;
  uncovered: number;
  etats: SyntheseEtats & { applicables: number; aDeterminer: number; obligatoiresNonConformes: number };
}
