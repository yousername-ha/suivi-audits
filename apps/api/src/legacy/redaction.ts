/* Rédaction de l'état historique selon les droits du lecteur : chaque clé relève d'un module, et un module illisible est
   remplacé par une valeur vide du même type. Partagé par l'état du suivi, la cartographie, le pilotage et les vues natives
   des modules repris (aucune vue ne renvoie une clé d'un module que la personne ne peut pas lire). */
import { legacyKeyModule, type Rights } from '@suivi/shared';
import { refModule } from '@suivi/shared/carto';
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

/** Nœuds d'une disposition de carte (référence → nœud) : le libellé d'un objet dont le module source n'est pas lisible est
    vidé. La disposition garde une copie des noms d'objets, écrite par une personne qui avait ce droit. */
export function redactNodes(nodes: Json | undefined, rights: Rights): Json | undefined {
  if (!isObject(nodes ?? null)) return nodes;
  return Object.fromEntries(
    Object.entries(nodes as JsonObject).map(([ref, n]) => {
      const m = refModule(ref);
      return [ref, m && !rights.can(m, 'lire') && isObject(n) ? { ...n, label: '' } : n];
    }),
  );
}
/** Disposition d'une carte (nœuds), éventuellement ses versions figées (clé historique « maps »). */
function redactLayoutJson(layout: Json, rights: Rights): Json {
  if (!isObject(layout)) return layout;
  const out: JsonObject = { ...layout };
  if ('nodes' in out) out.nodes = redactNodes(out.nodes, rights) as Json;
  if (Array.isArray(out.versions))
    out.versions = out.versions.map((v) =>
      isObject(v) && 'map' in v ? { ...v, map: redactLayoutJson(v.map as Json, rights) } : v,
    );
  return out;
}
/** Clé historique « maps » : libellés des nœuds selon le module de chaque objet, objets « issue » du pilotage. */
function redactMaps(maps: Json, rights: Rights): Json {
  if (!isObject(maps)) return maps;
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(maps)) {
    if (k === 'issues') out[k] = rights.can('pilotage', 'lire') ? v : [];
    else if (k === 'issueKind') out[k] = rights.can('pilotage', 'lire') ? v : {};
    else out[k] = redactLayoutJson(v, rights);
  }
  return out;
}

/** État vu par un utilisateur : les modules qu'il ne peut pas lire sont remplacés par une valeur vide du même type. */
export { redactLayoutJson };
export function redactLegacy(data: JsonObject, rights: Rights): JsonObject {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const m = legacyKeyModule(k);
      if (m && !rights.can(m, 'lire')) return [k, emptyLike(v)];
      return [k, k === 'maps' ? redactMaps(v, rights) : v];
    }),
  );
}
