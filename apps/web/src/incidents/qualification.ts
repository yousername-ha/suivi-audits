/* Teinte de la pastille de qualification d'un incident (registre, fiche, qualification guidée). */
import type { Etat } from '@suivi/ui';

export const ETAT_QUALIFICATION: Record<string, Etat> = {
  'Incident de sécurité': 'erreur',
  Incident: 'attention',
  'Événement de sécurité': 'info',
  Événement: 'neutre',
  Demande: 'neutre',
};
