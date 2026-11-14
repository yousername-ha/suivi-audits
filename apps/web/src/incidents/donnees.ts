/* Types communs du registre des incidents et de la fiche (qualification guidée, RETEX). */
import type { Incident } from '@suivi/shared';

/** Vue du module incidents renvoyée par `GET /api/incidents`. */
export interface Donnees {
  version: number;
  incidents: Incident[];
  categorieEntite: string;
  ecarts: Record<string, string>;
}
/** Appel d'écriture de `useModule` : rafraîchit la vue et renvoie la réponse, ou `undefined` en cas d'erreur. */
export type Agir = <R = unknown>(m: string, c: string, b?: unknown) => Promise<R | undefined>;
