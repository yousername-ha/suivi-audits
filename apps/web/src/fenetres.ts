/* Style des fenêtres et panneaux, à l'essai pour toute l'instance (addendum du 19/11/2026 à l'ADR 0093) : réglé dans
   Plateforme > Apparence, appliqué par l'attribut data-fenetres de <html> (feuille neon-fenetres.css de la charte). Une
   valeur absente ou inconnue vaut le style par défaut, la barre d'accent. */
import { FENETRES, type StyleFenetres } from '@suivi/shared';

export const styleFenetres = (v: unknown): StyleFenetres =>
  (FENETRES as readonly unknown[]).includes(v) ? (v as StyleFenetres) : 'barre';

export function appliquerStyleFenetres(html: { dataset: DOMStringMap }, v: unknown): void {
  html.dataset.fenetres = styleFenetres(v);
}
