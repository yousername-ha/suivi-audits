/* Police à l'essai pour toute l'instance (demande du RSSI du 23/11/2026) : réglée dans Plateforme > Apparence, appliquée par
   l'attribut data-police de <html> (feuille polices-essai.css de la charte). Une valeur absente ou inconnue vaut Lexend, la
   police par défaut. */
import { POLICES, type PoliceEssai } from '@suivi/shared';

export const policeEssai = (v: unknown): PoliceEssai =>
  (POLICES as readonly unknown[]).includes(v) ? (v as PoliceEssai) : 'lexend';

export function appliquerPolice(html: { dataset: DOMStringMap }, v: unknown): void {
  html.dataset.police = policeEssai(v);
}
