/* Rédaction de l'état historique selon les droits du lecteur : chaque clé relève d'un module, et un module illisible est
   remplacé par une valeur vide du même type. Partagé par l'état du suivi, la cartographie, le pilotage et les vues natives
   des modules repris (aucune vue ne renvoie une clé d'un module que la personne ne peut pas lire). */
import { legacyKeyModule, type Rights } from '@suivi/shared';
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';

const emptyLike = (v: Json): Json =>
  Array.isArray(v)
    ? []
    : isObject(v)
      ? {}
      : typeof v === 'string'
        ? ''
        : typeof v === 'number'
          ? 0
          : typeof v === 'boolean'
            ? false
            : null;

/** État vu par un utilisateur : les modules qu'il ne peut pas lire sont remplacés par une valeur vide du même type. */
export function redactLegacy(data: JsonObject, rights: Rights): JsonObject {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const m = legacyKeyModule(k);
      return [k, !m || rights.can(m, 'lire') ? v : emptyLike(v)];
    }),
  );
}
