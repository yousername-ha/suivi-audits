/* Style global de l'instance (Paramètres > Apparence) : « sage » (défaut), « clair » (clair bleuté) ou « verre » (décision
   du RSSI du 26/11/2026, feuille verre.css de la charte, limitée à html[data-style='verre']). Une valeur absente ou inconnue
   vaut le style par défaut. */
import { STYLES, type StyleInstance } from '@suivi/shared';

export const styleInstance = (v: unknown): StyleInstance =>
  (STYLES as readonly unknown[]).includes(v) ? (v as StyleInstance) : 'sage';
