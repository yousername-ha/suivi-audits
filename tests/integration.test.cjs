const test = require("node:test"),
  assert = require("node:assert/strict"),
  I = require("../modules/integration-core"),
  C = require("../modules/df-core");
const seed = () => ({
  v: 1,
  items: [],
  findings: [],
  years: [2026],
  roles: [
    { name: "RSSI", holder: "Personne fictive", deputy: "", resp: "Sécurité" },
  ],
  processes: [],
});
test("migration additive répétée : rôle historique conservé avec ID stable", () => {
  const s = seed();
  s.extra = { test: 1 };
  I.init(s);
  const id = s.roles[0].id;
  I.init(s);
  assert.equal(s.roles[0].id, id);
  assert.equal(s.roles[0].holder, "Personne fictive");
  assert.deepEqual(s.extra, { test: 1 });
});
test("GHT, établissements et SI partagé : liens, FINESS et cycles contrôlés", () => {
  const s = seed(),
    g = I.perimeter(s, { name: "GHT fictif", type: "GHT" }),
    a = I.perimeter(s, {
      name: "Établissement A fictif",
      type: "Établissement",
      parentId: g.id,
      finessEJ: "123456789",
    }),
    b = I.perimeter(s, { name: "Établissement B fictif", parentId: g.id }),
    si = I.perimeter(s, {
      name: "SI partagé fictif",
      type: "SI mutualisé",
      relatedIds: [a.id, b.id],
    });
  assert.deepEqual(si.relatedIds, [a.id, b.id]);
  assert.throws(() => I.perimeter(s, { ...g, parentId: a.id }, g.id), /cycle/);
  assert.throws(
    () =>
      I.perimeter(s, {
        name: "GHT invalide",
        type: "GHT",
        finessEJ: "123456789",
      }),
    /FINESS/,
  );
  assert.deepEqual(I.descendants(s, g.id), [g.id, a.id, b.id]);
});
test("responsables : rôle, personne, fonction et comptes multi-établissements", () => {
  const s = seed();
  I.init(s);
  const a = I.perimeter(s, { name: "A fictif" }),
    b = I.perimeter(s, { name: "B fictif" }),
    r = s.roles[0];
  r.perimeterIds = [a.id, b.id];
  r.function = "Référent sécurité";
  const users = [
    {
      id: "U1",
      name: "Compte fictif",
      permission: "editor",
      active: true,
      roleIds: [r.id],
      perimeterIds: [a.id, b.id],
    },
  ];
  const opts = I.responsibles(s, [a.id, b.id], users);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].userId, "U1");
  assert.match(opts[0].label, /Référent sécurité.*RSSI/);
  users[0].perimeterIds = [a.id];
  assert.equal(I.responsibles(s, [a.id, b.id], users)[0].userId, "");
});
test("relations bidirectionnelles et affectation utilisent le plan central", () => {
  const s = seed();
  I.init(s);
  const p = I.perimeter(s, { name: "A fictif" });
  s.findings.push({ id: "F01", text: "Action fictive" });
  s.processes.push({ id: "PROC1", name: "Activité fictive" });
  I.assign(s, { kind: "action", id: "F01" }, [p.id], {
    roleId: s.roles[0].id,
    userId: "",
  });
  I.relate(s, { kind: "action", id: "F01" }, { kind: "process", id: "PROC1" });
  I.relate(s, { kind: "action", id: "F01" }, { kind: "process", id: "PROC1" });
  assert.equal(s.findings.length, 1);
  assert.equal(s.findings[0].objectRefs.length, 1);
  assert.equal(s.processes[0].objectRefs[0].id, "F01");
});
const J = require("../modules/journey-core");
function journeyFixture() {
  const s = seed();
  I.init(s);
  const p = I.perimeter(s, {
    name: "Centre fictif",
    description: "Contexte de recette",
  });
  const r = J.create(s, {
    title: "Parcours fictif",
    perimeterIds: [p.id],
    frameworkIds: [],
  });
  return { s, p, r, t: s.journey.tasks.find((x) => x.stepId === "context") };
}
test("une sous-tâche génère une seule action centrale et synchronise le statut", () => {
  const { s, t } = journeyFixture();
  const a = J.ensureAction(s, t.id);
  assert.equal(J.ensureAction(s, t.id).id, a.id);
  assert.equal(s.findings.length, 1);
  a.status = "Clos";
  J.reconcile(s);
  assert.equal(t.status, "Terminé");
  J.setStatus(s, t.id, "En cours");
  assert.equal(a.status, "En cours");
  assert.equal(t.status, "En cours");
});
test("action close ne valide ni données manquantes, ni exigence, ni preuve", () => {
  const { s, r } = journeyFixture(),
    t = s.journey.tasks.find((x) => x.stepId === "documents"),
    a = J.ensureAction(s, t.id);
  a.status = "Clos";
  J.reconcile(s);
  assert.equal(t.status, "Bloqué");
  assert.notEqual(r.steps.find((x) => x.id === "documents").status, "Terminé");
  assert.throws(() => J.validateTask(s, t.id, "Recette"), /Objet métier/);
});
test("validation humaine devient obsolète quand le menu unitaire modifie le périmètre", () => {
  const { s, p, r } = journeyFixture(),
    t = s.journey.tasks.find((x) => x.stepId === "scope");
  J.setStatus(s, t.id, "Terminé");
  assert.equal(t.status, "En attente de validation");
  J.validateTask(s, t.id, "Validateur fictif");
  assert.equal(t.status, "Terminé");
  p.description = "Description modifiée dans le menu unitaire";
  J.reconcile(s);
  assert.equal(t.status, "En attente de validation");
  assert.notEqual(r.steps.find((x) => x.id === "scope").status, "Terminé");
});
test("une preuve refusée, obsolète ou remplacée réouvre la sous-tâche", () => {
  const { s, p, t } = journeyFixture();
  const proof = C.createProof(s, { title: "Preuve fictive" });
  proof.perimeterIds = [p.id];
  const v = C.addProofVersion(s, proof.id, {
    fileKey: "FILE1",
    name: "recette.txt",
    size: 1,
    sha256: "a".repeat(64),
  });
  C.validateProof(s, proof.id, v.id, {
    status: "Acceptée en interne",
    reviewer: "Recette",
    date: "2026-10-11",
  });
  t.requireProof = true;
  t.proofRefs = [{ evidenceId: proof.id, versionId: v.id }];
  J.setStatus(s, t.id, "Terminé");
  assert.equal(t.status, "Terminé");
  proof.obsolete = true;
  J.reconcile(s);
  assert.equal(t.status, "Bloqué");
  proof.obsolete = false;
  C.addProofVersion(s, proof.id, {
    fileKey: "FILE2",
    name: "recette2.txt",
    size: 1,
    sha256: "b".repeat(64),
  });
  J.reconcile(s);
  assert.equal(t.status, "Bloqué");
});
const F = require("../modules/finance-core"),
  catalog = require("../sources/catalogue.json");
test("D2 officiel : 13 références uniques, sources, critères et justificatifs précis", () => {
  const d2 = catalog.frameworks.find((x) => x.domain === "D2");
  assert.equal(d2.requirements.length, 13);
  assert.equal(new Set(d2.requirements.map((x) => x.id)).size, 13);
  for (const id of ["D2.P1", "D2.P2", "D2.O1.C", "D2.O2.A", "D2.O3.C", "D2.O4"])
    assert.ok(d2.requirements.some((x) => x.id === id));
  assert.ok(
    d2.requirements.every(
      (x) =>
        x.criteria &&
        x.sourcePage &&
        x.sourceUrl.startsWith("https://prod-convergence.esante.gouv.fr/"),
    ),
  );
  assert.match(d2.source, /Incohérence/);
  assert.match(d2.requirements.find((x) => x.id === "D2.O1.C").criteria, /66%/);
});
test("finances : registre de preuves unique, cents exacts et rattachements sans doublons", () => {
  const { s, p } = journeyFixture();
  const proof = F.save(s, {
    title: "Facture fictive",
    type: "Facture",
    supplier: "Prestataire fictif",
    amountHT: "1 200,30",
    amountTTC: "1 440,36",
    perimeterIds: [p.id],
  });
  assert.equal(proof.financial.amountHT, 120030);
  assert.equal(s.evidences.length, 1);
  C.addProofVersion(s, proof.id, {
    fileKey: "FIN1",
    name: "facture-fictive.txt",
    size: 1,
    sha256: "a".repeat(64),
  });
  s.findings.push({
    id: "ACT-FIN",
    text: "Achat fictif",
    perimeterIds: [p.id],
  });
  F.attach(s, proof.id, { kind: "action", id: "ACT-FIN" });
  F.attach(s, proof.id, { kind: "action", id: "ACT-FIN" });
  assert.equal(s.findings[0].proofRefs.length, 1);
  F.save(
    s,
    {
      title: proof.title,
      type: "Facture",
      amountHT: "1200,30",
      amountTTC: "1440,36",
      perimeterIds: [p.id],
    },
    proof.id,
  );
  assert.equal(s.evidences.length, 1);
  assert.throws(
    () =>
      F.save(s, {
        title: "Erreur",
        amountHT: "20",
        amountTTC: "10",
        perimeterIds: [p.id],
      }),
    /TTC/,
  );
});
const P = require("../modules/pcra-core");
function biaFixture() {
  const s = seed();
  I.init(s);
  P.init(s);
  const p = I.perimeter(s, { name: "Centre fictif" }),
    pol = P.policy(s, {
      title: "Politique synthétique",
      perimeterIds: [p.id],
      horizons: [{ id: "H1", label: "1 heure", hours: 1 }],
      dimensions: [{ id: "PATIENT", label: "Patient" }],
      levels: [
        { id: "L1", label: "Faible", rank: 1, color: "#dce8e0" },
        { id: "L4", label: "Critique", rank: 4, color: "#b66f61" },
      ],
    }),
    b = P.saveBia(s, {
      title: "BIA fictif",
      perimeterIds: [p.id],
      policyId: pol.id,
    });
  const a = {
    name: "Activité de soins fictive",
    maxInterruptionHours: 4,
    rtoBusinessHours: 2,
    rpoBusinessHours: 1,
    minimumService: "Service fictif minimum",
    humanNeeds: "Équipe fictive",
    materialNeeds: "Matériel fictif",
    siNeeds: "SI fictif",
    buildingNeeds: "Local fictif",
    supplierNeeds: "Aucun, recette",
    dependencies: "Aucune, recette",
    workarounds: "Procédure fictive",
    justification: "Hypothèses de recette",
    impacts: { H1: { PATIENT: "L4" } },
  };
  P.activity(s, b.id, a);
  return { s, p, pol, b, a: b.activities[0] };
}
test("BIA métier : impacts temporels configurables, besoins et validation humaine", () => {
  const { s, b, a } = biaFixture();
  assert.equal(P.biaIssues(s, b).length, 0);
  P.validateBia(s, b.id, "Validateur fictif");
  assert.equal(b.status, "Validé en interne");
  assert.equal(a.impacts.H1.PATIENT, "L4");
  const incomplete = P.saveBia(s, {
    title: "BIA incomplet",
    perimeterIds: b.perimeterIds,
    policyId: b.policyId,
  });
  assert.throws(
    () => P.validateBia(s, incomplete.id, "Recette"),
    /Aucune activité/,
  );
});
test("PCA et PRA distincts, modification significative du BIA signale la révision", () => {
  const { s, b, a } = biaFixture();
  P.validateBia(s, b.id, "Recette");
  const fields = {
    biaId: b.id,
    title: "Plan fictif",
    scenario: "SI",
    activityIds: [a.id],
    activation: "Déclenchement fictif",
    procedure: "Procédure fictive",
    communication: "Communication fictive",
    resources: "Moyens fictifs",
    dependencies: "Aucune",
    returnToNormal: "Contrôles fictifs",
    technicalRtoHours: 2,
    technicalRpoHours: 1,
  };
  const pca = P.savePlan(s, { ...fields, kind: "PCA" }),
    pra = P.savePlan(s, { ...fields, kind: "PRA" });
  P.validatePlan(s, pca.id, "Recette");
  P.validatePlan(s, pra.id, "Recette");
  assert.equal(pca.kind, "PCA");
  assert.equal(pra.kind, "PRA");
  P.activity(s, b.id, { ...a, maxInterruptionHours: 3 }, a.id);
  P.reconcile(s);
  assert.equal(pca.needsReview, true);
  assert.equal(pra.needsReview, true);
  assert.equal(b.status, "À réévaluer");
  assert.throws(() => P.validatePlan(s, pca.id, "Recette"), /BIA/);
  assert.equal(pca.biaRevision, 2);
  assert.equal(b.contentRevision, 3);
});
test("politique versionnée : l’échelle du BIA existant reste inchangée", () => {
  const { s, p, pol, b } = biaFixture();
  const next = P.policy(s, {
    ...C.clone(pol),
    previousId: pol.id,
    title: "Nouvelle politique fictive",
    perimeterIds: [p.id],
    horizons: [{ id: "H8", label: "8 heures", hours: 8 }],
  });
  assert.equal(next.version, 2);
  assert.equal(b.policyId, pol.id);
  assert.equal(
    s.pcra.policies.find((x) => x.id === b.policyId).horizons[0].id,
    "H1",
  );
});
test("exercices, RETEX et actions correctives centrales idempotentes", () => {
  const { s, b, a } = biaFixture();
  const plan = P.savePlan(s, {
    kind: "PCA",
    biaId: b.id,
    title: "PCA fictif",
    scenario: "SI",
    activityIds: [a.id],
  });
  assert.throws(
    () =>
      P.exercise(s, {
        title: "Test incomplet",
        planId: plan.id,
        status: "Réalisé",
      }),
    /RETEX/,
  );
  const ex = P.exercise(s, {
    title: "Exercice fictif",
    planId: plan.id,
    status: "Réalisé",
    date: "2026-10-11",
    results: "Résultats fictifs",
    retex: "RETEX fictif",
    gaps: "Amélioration fictive",
  });
  const action = P.corrective(s, ex.id, {
    title: "Action fictive",
    sourceKey: "écart-1",
  });
  assert.equal(
    P.corrective(s, ex.id, { title: "Action fictive", sourceKey: "écart-1" })
      .id,
    action.id,
  );
  assert.equal(s.findings.length, 1);
  assert.equal(ex.actionIds[0], action.id);
  assert.equal(action.objectRefs[0].id, ex.id);
});
test("historique BIA sans snapshots récursifs ; RTO métier et technique restent distincts", () => {
  const { s, b, a } = biaFixture();
  for (let n = 0; n < 5; n++)
    P.activity(s, b.id, { ...a, minimumService: "Service fictif " + n }, a.id);
  assert.ok(b.history.every((h) => !h.snapshot.history));
  assert.equal(b.activities[0].rtoBusinessHours, 2);
  assert.throws(
    () =>
      P.activity(s, b.id, { ...a, impacts: { H99: { PATIENT: "L4" } } }, a.id),
    /Horizon/,
  );
});
test("CRRC et périmètres : rattachement explicite, nom synchronisé sans seconde saisie", () => {
  const s = seed();
  s.crrc = { establishments: [{ id: "EST-REC", name: "Ancien nom fictif" }] };
  const p = I.perimeter(s, { name: "Centre fictif" });
  I.linkEstablishment(s, "EST-REC", p.id);
  assert.equal(s.crrc.establishments[0].legacyName, "Ancien nom fictif");
  p.name = "Centre renommé fictif";
  I.sync(s);
  assert.equal(s.crrc.establishments[0].name, p.name);
  s.crrc.establishments[0].name = "Modification depuis CRRC fictive";
  I.sync(s);
  assert.equal(p.name, s.crrc.establishments[0].name);
  assert.equal(s.perimeters.length, 1);
});
test("dépendances longues et cycles de tâches : calcul cohérent indépendamment de l’ordre", () => {
  const { s, r, t } = journeyFixture();
  const tasks = [];
  for (let n = 0; n < 6; n++) {
    const task = J.addTask(s, r.id, {
      stepId: "context",
      title: "Dépendance " + n,
      businessRef: t.businessRef,
      requiredFields: [],
      dependsOn: tasks.length ? [tasks.at(-1).id] : [],
    });
    task.completionRequested = true;
    tasks.push(task);
  }
  s.journey.tasks.reverse();
  J.reconcile(s);
  assert.ok(tasks.every((t) => t.status === "Terminé"));
  tasks[0].dependsOn = [tasks[5].id];
  assert.throws(() => J.reconcile(s), /Cycle/);
});
