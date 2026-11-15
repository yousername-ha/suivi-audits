/* Réglages de l'assistant RSSI : saisie tirée des réglages enregistrés et corps de PUT /api/assistant/reglages. Partagés par
   la page de réglage (ReglagesAssistant) et l'étape « Flux vers l'extérieur » de l'installation (ADR 0097, lot 3), qui
   active l'assistant sans toucher au reste de ses réglages. Sans dépendance à React (testés seuls). */
import type { ReglagesAssistantBody, ReglagesAssistantDto } from '@suivi/shared';

export type Saisie = Pick<
  ReglagesAssistantDto,
  | 'actif'
  | 'adresse'
  | 'modele'
  | 'budgetJetonsJour'
  | 'enPause'
  | 'heureRonde'
  | 'plafondRappelsJour'
  | 'delaiRelanceJours'
  | 'jourSynthese'
  | 'rondesSurEvenement'
  | 'contexte'
  | 'profils'
>;

export const saisieDe = (d: ReglagesAssistantDto): Saisie => ({
  actif: d.actif,
  adresse: d.adresse,
  modele: d.modele,
  budgetJetonsJour: d.budgetJetonsJour,
  enPause: d.enPause,
  heureRonde: d.heureRonde,
  plafondRappelsJour: d.plafondRappelsJour,
  delaiRelanceJours: d.delaiRelanceJours,
  jourSynthese: d.jourSynthese,
  rondesSurEvenement: d.rondesSurEvenement,
  contexte: d.contexte,
  profils: d.profils,
});

/** Corps de l'enregistrement : la validation explicite du flux (`fluxConfirme`) n'est jointe que si elle a été donnée. */
export const corpsReglages = (saisie: Saisie, version: number, fluxConfirme: boolean): ReglagesAssistantBody => ({
  ...saisie,
  ...(fluxConfirme ? { fluxConfirme: true as const } : {}),
  profils: saisie.profils.map(
    ({ id, actif, perimetres, tousPerimetres, rondeQuotidienne, referent, documents, classificationMax }) => ({
      id,
      actif,
      perimetres,
      tousPerimetres,
      rondeQuotidienne,
      referent,
      documents,
      classificationMax,
    }),
  ),
  version,
});

/** Activation depuis l'installation : les réglages enregistrés, avec le fournisseur choisi (adresse et modèle, exigés pour
    activer), assistant activé et validation du flux jointe. La clé et les profils se règlent ensuite dans la page. */
export const corpsActivationAssistant = (
  d: ReglagesAssistantDto,
  fournisseur: { adresse: string; modele: string },
): ReglagesAssistantBody =>
  corpsReglages(
    { ...saisieDe(d), actif: true, adresse: fournisseur.adresse.trim(), modele: fournisseur.modele.trim() },
    d.version,
    true,
  );
