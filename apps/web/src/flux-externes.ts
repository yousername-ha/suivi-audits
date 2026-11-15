/* Flux vers l'extérieur (ADR 0097) : libellés et règles d'affichage de la page d'administration, sans dépendance à React
   (testés seuls). Le registre (destinations, porteur, données qui sortent) vient de @suivi/shared. */
import { sensDuFlux, type FluxExterneDefinition, type FluxExterneEtat } from '@suivi/shared';

/** Adresse de la carte qui ouvre et ferme les flux. */
export const LIEN_FLUX_EXTERNES = '/systeme/flux-externes';

export const libelleSens = (f: Pick<FluxExterneDefinition, 'destinations'>): string => {
  const s = sensDuFlux(f);
  return s.length === 2 ? 'Sortant et entrant' : s[0] === 'entrant' ? 'Entrant' : 'Sortant';
};

export type Ton = 'vert' | 'gris' | 'rouge' | 'orange';

/** État appliqué, tel que l'exécutant l'a rapporté, comparé à l'état voulu. */
export function etatApplique(e: Pick<FluxExterneEtat, 'ouvert' | 'applique'>): { libelle: string; ton: Ton } {
  if (e.applique === 'erreur') return { libelle: 'Erreur', ton: 'rouge' };
  if (e.applique === null)
    return e.ouvert
      ? { libelle: 'En attente de l’exécutant', ton: 'orange' }
      : { libelle: 'Non rapporté', ton: 'gris' };
  const ouvert = e.applique === 'ouvert';
  if (ouvert !== e.ouvert)
    return { libelle: e.ouvert ? 'Ouverture en attente' : 'Fermeture en attente', ton: 'orange' };
  return ouvert ? { libelle: 'Ouvert', ton: 'vert' } : { libelle: 'Fermé', ton: 'gris' };
}

/** Ouvrir exige la case de validation cochée ; fermer se confirme sans case. Rien pendant un envoi. */
export const peutConfirmer = (ouvrir: boolean, valide: boolean, envoi: boolean): boolean =>
  !envoi && (!ouvrir || valide);

/** Flux à faire autoriser sur le pare-feu de l'hôte et du réseau : ceux des modules voulus ouverts. */
export function pareFeuAOuvrir(
  registre: readonly FluxExterneDefinition[],
  etats: readonly Pick<FluxExterneEtat, 'module' | 'ouvert'>[],
): { libelle: string; regles: readonly string[] }[] {
  const ouverts = new Set(etats.filter((e) => e.ouvert).map((e) => e.module));
  return registre.filter((f) => ouverts.has(f.id)).map((f) => ({ libelle: f.libelle, regles: f.pareFeu }));
}
