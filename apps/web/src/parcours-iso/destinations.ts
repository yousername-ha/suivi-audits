/* Destinations des sous-actions : une rubrique du Pilotage ou une page existante. Le parcours ne crée aucune adresse : il
   reprend celles de la navigation, avec le périmètre affiché et le chemin de retour (même mécanisme que les autres écrans). */
import type { DestinationParcours, Module } from '@suivi/shared';
import { PILOTAGE_NAV } from '../pilotage-navigation';

export const CHEMIN_PARCOURS = '/pilotage/parcours-iso';
const rubriques = new Map(PILOTAGE_NAV.flatMap((g) => g.items.map((i) => [i.id, i] as const)));
const LIBELLES_CHEMIN: Record<string, string> = { '/documents': 'Documents et liens' };

export interface DestinationResolue {
  /** Adresse de la rubrique (sans paramètre). */
  to: string;
  libelle: string;
  module: Module;
  /** Rubrique du Pilotage : accepte `perimetre`, `ouvrir` et `retour`. */
  pilotage: boolean;
  rubrique?: string;
}
/** Résout une destination du catalogue ; nulle si la rubrique n'existe plus (le test de navigation le signale). */
export function resoudreDestination(vers: DestinationParcours): DestinationResolue | null {
  if ('chemin' in vers)
    return {
      to: vers.chemin,
      libelle: LIBELLES_CHEMIN[vers.chemin] ?? vers.chemin,
      module: vers.module,
      pilotage: false,
    };
  const r = rubriques.get(vers.rubrique);
  return r ? { to: `/pilotage/${r.id}`, libelle: r.label, module: r.module, pilotage: true, rubrique: r.id } : null;
}
/** Lien vers le module, avec le périmètre affiché et le retour vers le parcours. */
export function lienModule(d: DestinationResolue, smsi: string, objetId?: string): string {
  if (!d.pilotage) return d.to;
  const p = new URLSearchParams({ perimetre: smsi, retour: CHEMIN_PARCOURS });
  if (objetId) p.set('ouvrir', objetId);
  return `${d.to}?${p.toString()}`;
}
