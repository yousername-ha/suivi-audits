/* Réglages scalaires ou objets de l'outil de suivi (années du cycle, dates d'audit, plan d'audit, périmètre…) en table
   (ADR 0040) : une ligne par clé, lue en une seule requête. Valeurs en JSON : ce sont des réglages, pas des registres. */
import type { Json } from '@suivi/shared/legacy';
import type { Client } from '../../db/db.js';
import type { BatchMapper } from '../../legacy/store.js';

export const reglagesMapper = (keys: readonly string[]): BatchMapper => ({
  keys,
  async readAll(c: Client) {
    const rows = (await c.query<{ cle: string; valeur: Json }>('SELECT cle, valeur FROM suivi_reglages')).rows;
    return new Map(rows.map((r) => [r.cle, r.valeur]));
  },
  async write(c: Client, key: string, value: Json | undefined) {
    await c.query('DELETE FROM suivi_reglages WHERE cle=$1', [key]);
    if (value === undefined) return;
    // Texte JSON : une valeur null deviendrait sinon un NULL SQL, refusé par la colonne.
    await c.query('INSERT INTO suivi_reglages(cle, valeur, position) VALUES ($1,$2,$3)', [
      key,
      JSON.stringify(value),
      keys.indexOf(key),
    ]);
  },
});
