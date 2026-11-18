/* Mandataire sortant de l'établissement (ADR 0101, lot P1) : règles d'affichage de l'écran du réglage, sans dépendance à
   React (testées seules). Le serveur reste seul juge de la validité et des droits. */
import {
  analyserAdresseMandataire,
  fluxParUsageMandataire,
  LIBELLES_USAGE_MANDATAIRE,
  MOTIFS_USAGE_MANDATAIRE,
  type ReglageMandataire,
  type UsageMandataire,
} from '@suivi/shared';

/** Adresse de la carte du réglage. */
export const LIEN_MANDATAIRE = '/systeme/mandataire';

/** Message d'erreur de l'adresse saisie (vide : aucune erreur à afficher). */
export function erreurAdresse(adresse: string): string | null {
  if (adresse.trim() === '') return null;
  const a = analyserAdresseMandataire(adresse);
  return 'erreur' in a ? a.erreur : null;
}

/** Enregistrer ce réglage effacera-t-il le mot de passe enregistré ? (adresse ou identifiant changé, comme le serveur). */
export const effaceraMotDePasse = (
  avant: Pick<ReglageMandataire, 'adresse' | 'identifiant'>,
  apres: Pick<ReglageMandataire, 'adresse' | 'identifiant'>,
  defini: boolean,
): boolean =>
  defini && (avant.adresse.trim() !== apres.adresse.trim() || avant.identifiant.trim() !== apres.identifiant.trim());

/** Le réglage peut-il être envoyé ? Actif seulement avec une adresse valide ; inactif, adresse vide ou valide. */
export function peutEnregistrer(v: ReglageMandataire): boolean {
  if (erreurAdresse(v.adresse)) return false;
  return !v.actif || v.adresse.trim() !== '';
}

/** Flux du registre, groupés par usage du mandataire, avec leur libellé et la raison, dans l'ordre d'affichage. */
export function lignesFluxMandataire(): {
  usage: UsageMandataire;
  libelle: string;
  flux: { id: string; libelle: string; motif: string }[];
}[] {
  const g = fluxParUsageMandataire();
  return (['utilise', 'direct', 'non_pris_en_charge'] as const).map((usage) => ({
    usage,
    libelle: LIBELLES_USAGE_MANDATAIRE[usage],
    flux: g[usage].map((f) => ({ id: f.id, libelle: f.libelle, motif: MOTIFS_USAGE_MANDATAIRE[f.id] })),
  }));
}
