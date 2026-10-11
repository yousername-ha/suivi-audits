/* Présentation uniquement : les objets métier restent dans leurs registres. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyCartographyCore = api;
})(globalThis, function () {
  "use strict";
  const collections = [
    "processes",
    "objectives",
    "indicators",
    "interested",
    "swots",
    "suppliers",
    "appGaps",
  ];
  function descendants(s, ids) {
    const out = new Set(ids);
    let size;
    do {
      size = out.size;
      for (const p of s.perimeters || [])
        if (out.has(p.parentId)) out.add(p.id);
    } while (size !== out.size);
    return out;
  }
  function init(s) {
    s.cartography ||= { schema: 1, maps: [] };
    if (s.cartography.schema !== 1 || !Array.isArray(s.cartography.maps))
      throw Error("Version de cartographie non reconnue.");
    if (!s.cartography.legacyImported && s.maps) {
      for (const view of ["context", "process"])
        if (s.maps[view]?.nodes)
          s.cartography.maps.push({
            ...structuredClone(s.maps[view]),
            id: "MAP-legacy-" + view,
            name: "Contexte historique · " + view,
            view,
            perimeterIds: [],
            issueKind: structuredClone(s.maps.issueKind || {}),
          });
      s.cartography.legacyImported = true;
    }
    return s.cartography;
  }
  function selection(s, scope, admin) {
    if (scope === "__legacy" && admin) return [];
    if ((s.perimeters || []).some((p) => p.id === scope)) return [scope];
    return (s.perimeters || []).map((p) => p.id).sort();
  }
  function key(ids) {
    return [...ids].sort().join("|");
  }
  function record(s, scope, view, admin) {
    const ids = selection(s, scope, admin);
    return init(s).maps.find(
      (m) => m.view === view && key(m.perimeterIds) === key(ids),
    );
  }
  function scoped(s, scope, admin) {
    const ids = selection(s, scope, admin),
      covered = descendants(s, ids),
      privateView = scope === "__legacy" && admin;
    const out = { ...s };
    for (const kind of collections)
      out[kind] = (s[kind] || []).filter((r) => {
        const rs = r.perimeterIds || [];
        return privateView
          ? !rs.length
          : rs.length && rs.every((id) => covered.has(id));
      });
    const p = (s.perimeters || []).find((p) => p.id === scope);
    out.scope = privateView
      ? s.scope || {}
      : {
          statement:
            p?.description ||
            (p ? p.name : "Consolidation des périmètres autorisés"),
          processes: out.processes.map((p) => p.id),
          sites: (s.perimeters || [])
            .filter((p) => covered.has(p.id) && p.type === "Site")
            .map((p) => p.name),
          systems: p?.systems || [],
        };
    return out;
  }
  function save(s, scope, view, layout, admin) {
    const data = init(s),
      prev = record(s, scope, view, admin),
      ids = selection(s, scope, admin);
    const row = {
      ...prev,
      ...structuredClone(layout),
      id: prev?.id || "MAP-" + crypto.randomUUID(),
      name: view === "context" ? "Contexte" : "Processus",
      view,
      perimeterIds: ids,
    };
    if (prev) Object.assign(prev, row);
    else data.maps.push(row);
    return row;
  }
  return { init, descendants, selection, key, record, scoped, save };
});
