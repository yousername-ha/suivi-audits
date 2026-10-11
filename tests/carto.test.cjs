const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  Core = require("../modules/carto-core.js");
const fixture = () => ({
  perimeters: [
    { id: "G", name: "GHT FICTIF", type: "GHT" },
    { id: "A", name: "A FICTIF", parentId: "G" },
    { id: "B", name: "B FICTIF", parentId: "G" },
    { id: "SI", relatedIds: ["A"] },
  ],
  processes: [
    { id: "PA", name: "Soins FICTIFS", perimeterIds: ["A"] },
    { id: "PB", perimeterIds: ["B"] },
    { id: "PAB", perimeterIds: ["A", "B"] },
    { id: "PSI", perimeterIds: ["SI"] },
    { id: "OLD" },
  ],
  scope: { statement: "Historique FICTIF" },
});
test("GHT : descendants consolidés, mutualisation sans extension implicite", () => {
  const s = fixture();
  assert.deepEqual(
    Core.scoped(s, "G", true).processes.map((x) => x.id),
    ["PA", "PB", "PAB"],
  );
  assert.deepEqual(
    Core.scoped(s, "A", true).processes.map((x) => x.id),
    ["PA"],
  );
});
test("Le contexte historique reste privé, distinct des objets classés", () => {
  const s = fixture();
  assert.deepEqual(
    Core.scoped(s, "__legacy", true).processes.map((x) => x.id),
    ["OLD"],
  );
  assert.equal(Core.scoped(s, "__all", true).processes.length, 4);
});
test("Disposition par vue et couverture, sans dupliquer les objets métier", () => {
  const s = fixture(),
    layout = {
      nodes: { "process:PA": { x: 0, y: 0, w: 200, h: 80 } },
      edges: [],
    };
  Core.save(s, "A", "context", layout, true);
  Core.save(
    s,
    "A",
    "context",
    {
      ...layout,
      nodes: { ...layout.nodes, scope: { x: 0, y: 0, w: 400, h: 400 } },
    },
    true,
  );
  Core.save(s, "A", "process", layout, true);
  assert.equal(s.cartography.maps.length, 2);
  assert.equal(Core.record(s, "B", "context", true), undefined);
  assert.equal(s.processes[0].name, "Soins FICTIFS");
});
test("La référence logique conserve la disposition après renommage", () => {
  const s = fixture();
  Core.save(
    s,
    "A",
    "context",
    { nodes: { "process:PA": { x: 123, y: 45, w: 200, h: 80 } } },
    true,
  );
  s.processes[0].name = "Autre nom FICTIF";
  assert.equal(Core.record(s, "A", "context", true).nodes["process:PA"].x, 123);
  assert.equal(Core.scoped(s, "A", true).processes[0].name, "Autre nom FICTIF");
});
test("Import idempotent des anciennes cartes, originales conservées", () => {
  const s = fixture();
  s.maps = {
    context: { nodes: { scope: { x: 1, y: 2, w: 300, h: 400 } }, versions: [] },
    issueKind: { "issue:1": "ext" },
  };
  const old = JSON.stringify(s.maps);
  Core.init(s);
  Core.init(s);
  assert.equal(s.cartography.maps.length, 1);
  assert.equal(JSON.stringify(s.maps), old);
  assert.deepEqual(s.cartography.maps[0].perimeterIds, []);
});
