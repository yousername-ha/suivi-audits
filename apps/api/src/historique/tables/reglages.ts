/* Réglages scalaires ou objets de l'outil de suivi (années du cycle, dates d'audit, plan d'audit, périmètre…) en table
   (ADR 0040) : une ligne par clé, lue en une seule requête. Valeurs en JSON : ce sont des réglages, pas des registres. */
import type { Json } from '@suivi/shared/legacy';
import { surConnexion, type Client } from '../../db/db.js';
import type { BatchMapper } from '../../legacy/store.js';

export const reglagesMapper = (keys: readonly string[]): BatchMapper => ({
  keys,
  async readAll(c: Client) {
    const rows = await surConnexion(c).selectFrom('suivi_reglages').select(['cle', 'valeur']).execute();
    return new Map(rows.map((r) => [r.cle, r.valeur as Json]));
  },
  async write(c: Client, key: string, value: Json | undefined) {
    const k = surConnexion(c);
    await k.deleteFrom('suivi_reglages').where('cle', '=', key).execute();
    if (value === undefined) return;
    // Texte JSON : une valeur null deviendrait sinon un NULL SQL, refusé par la colonne.
    await k
      .insertInto('suivi_reglages')
      .values({ cle: key, valeur: JSON.stringify(value), position: keys.indexOf(key) })
      .execute();
  },
});
