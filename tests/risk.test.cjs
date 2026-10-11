const test = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../modules/df-core"),
  I = require("../modules/integration-core"),
  R = require("../modules/risk-core"),
  D = require("../modules/demo-data");
const fixture = () => {
  const s = {
    v: 1,
    years: [2026],
    items: [],
    findings: [],
    roles: [],
    frameworks: [],
  };
  R.init(s);
  const g = I.perimeter(s, { name: "GHT FICTIF", type: "GHT" }),
    a = I.perimeter(s, { name: "A FICTIF", parentId: g.id }),
    b = I.perimeter(s, { name: "B FICTIF", parentId: g.id }),
    policy = R.policy(s, {
      ...C.clone(R.DEFAULT_POLICY),
      perimeterIds: [g.id],
    });
  return { s, g, a, b, policy };
};
test("les codes de présentation ne changent pas le contenu métier validé du parcours", () => {
  const J = require("../modules/journey-core");
  const before = {
    id: "FICTIF",
    title: "BIA",
    activities: [{ id: "ACTI-FICTIF", name: "Soins" }],
  };
  const after = {
    ...before,
    internalId: "IMP-000001",
    activities: [{ ...before.activities[0], internalId: "ACTI-000001" }],
  };
  assert.deepEqual(J.snapshot(after), J.snapshot(before));
});
function evaluate(f, risk, study, stage = "initial", level = "L3") {
  return R.assessment(
    f.s,
    {
      riskId: risk.id,
      studyId: study?.id,
      policyId: f.policy.id,
      stage,
      impactId: "I3",
      likelihoodId: "V2",
      levelId: level,
      date: "2026-10-11",
      justification: "Justification FICTIVE",
    },
    "Compte FICTIF",
  );
}
test("critère demandé : trois risques, deux études, deux évaluations du même risque", () => {
  const f = fixture();
  const rs = [f.a, f.a, f.b].map((p, n) =>
    R.risk(f.s, {
      title: "Risque FICTIF " + n,
      description: "Contexte FICTIF",
      perimeterIds: [p.id],
    }),
  );
  const st1 = R.study(f.s, {
    title: "Étude 1 FICTIVE",
    perimeterIds: [f.g.id],
    riskIds: rs.map((r) => r.id),
  });
  rs.forEach((r) => R.reference(f.s, r.id, evaluate(f, r, st1).id));
  const st2 = R.study(f.s, {
    title: "Étude 2 FICTIVE",
    perimeterIds: [f.g.id],
    riskIds: [rs[0].id],
  });
  const second = evaluate(f, rs[0], st2, "residual", "L2");
  R.reference(f.s, rs[0].id, second.id);
  assert.equal(f.s.riskMgmt.risks.length, 3);
  assert.equal(
    f.s.riskMgmt.assessments.filter((a) => a.riskId === rs[0].id).length,
    2,
  );
  assert.equal(
    R.rows(f.s, { stage: "residual", perimeterId: f.g.id })[0].assessment.id,
    second.id,
  );
  st1.status = "Archivée";
  assert.equal(f.s.riskMgmt.risks.length, 3);
  assert.equal(f.s.riskMgmt.assessments.length, 4);
  assert.throws(() => evaluate(f, rs[1], st1), /archivée/);
});
test("risque et évaluation créés indépendamment de toute étude", () => {
  const f = fixture(),
    r = R.risk(f.s, {
      title: "Indépendant FICTIF",
      description: "Contexte",
      perimeterIds: [f.a.id],
    });
  const a = evaluate(f, r);
  assert.equal(a.studyId, null);
  assert.equal(f.s.riskMgmt.studies.length, 0);
  assert.equal(R.rows(f.s, { stage: "initial" })[0].assessment, null);
  R.reference(f.s, r.id, a.id);
  assert.equal(R.rows(f.s, { stage: "initial" })[0].assessment.id, a.id);
});
test("la cartographie ne choisit pas implicitement la dernière évaluation historique", () => {
  const f = fixture(),
    r = R.risk(f.s, {
      title: "FICTIF",
      description: "Contexte",
      perimeterIds: [f.a.id],
    });
  const first = evaluate(f, r);
  R.reference(f.s, r.id, first.id);
  evaluate(f, r, undefined, "initial", "L1");
  assert.equal(R.rows(f.s, { stage: "initial" })[0].level.id, "L3");
  assert.equal(R.rows(f.s, { stage: "residual" })[0].assessment, null);
});
test("acceptation, initial et résiduel sont trois références distinctes", () => {
  const f = fixture(),
    r = R.risk(f.s, {
      title: "FICTIF",
      description: "Contexte",
      perimeterIds: [f.a.id],
    });
  const first = evaluate(f, r),
    res = evaluate(f, r, null, "residual", "L2");
  R.reference(f.s, r.id, first.id);
  R.reference(f.s, r.id, res.id);
  R.decision(
    f.s,
    {
      riskId: r.id,
      assessmentId: res.id,
      kind: "Accepter",
      date: "2026-10-11",
      validUntil: "2030-01-01",
      justification: "Acceptation FICTIVE",
    },
    "Validateur FICTIF",
  );
  assert.equal(R.rows(f.s, { stage: "initial" })[0].level.id, "L3");
  assert.equal(R.rows(f.s, { stage: "accepted" })[0].level.id, "L2");
  assert.equal(R.rows(f.s, { stage: "accepted" })[0].decision.kind, "Accepter");
});
test("politiques distinctes, échelles personnalisées et matrice explicite", () => {
  const f = fixture();
  const old = JSON.stringify(f.policy);
  const p = R.policy(f.s, {
    ...C.clone(R.DEFAULT_POLICY),
    perimeterIds: [f.a.id],
    method: "Personnalisée",
    calculation: "matrix",
    impactScale: [{ id: "G", label: "Impact métier" }],
    likelihoodScale: [{ id: "V", label: "Probabilité métier" }],
    levels: [
      {
        id: "CUSTOM",
        label: "Priorité métier",
        color: "#abcdef",
        acceptability: "À examiner",
      },
    ],
    matrix: { "G:V": "CUSTOM" },
    previousId: f.policy.id,
  });
  const r = R.risk(f.s, {
    title: "FICTIF",
    description: "Contexte",
    perimeterIds: [f.a.id],
  });
  const a = R.assessment(f.s, {
    riskId: r.id,
    policyId: p.id,
    stage: "initial",
    impactId: "G",
    likelihoodId: "V",
    levelId: "FORGED",
    date: "2026-10-11",
    justification: "FICTIF",
  });
  R.reference(f.s, r.id, a.id);
  assert.equal(R.rows(f.s, { stage: "initial" })[0].level.id, "CUSTOM");
  assert.equal(JSON.stringify(f.policy), old);
});
test("une clôture d’action de mesure ne recalcule jamais le résiduel", () => {
  const f = fixture(),
    r = R.risk(f.s, {
      title: "FICTIF",
      description: "Contexte",
      perimeterIds: [f.a.id],
    }),
    t = R.treatment(f.s, {
      riskId: r.id,
      title: "Traitement",
      strategy: "Réduire",
    }),
    m = R.measure(f.s, {
      treatmentId: t.id,
      title: "Mesure",
      description: "Faire le contrôle",
    });
  const a = R.action(f.s, m.id);
  assert.equal(R.action(f.s, m.id).id, a.id);
  assert.equal(f.s.findings.length, 1);
  a.status = "Clos";
  assert.equal(R.rows(f.s, { stage: "residual" })[0].assessment, null);
});
test("consolidation GHT et établissement sans compter les historiques comme des risques", () => {
  const f = fixture();
  for (const p of [f.a, f.b]) {
    const r = R.risk(f.s, {
      title: "Risque " + p.name,
      description: "FICTIF",
      perimeterIds: [p.id],
    });
    evaluate(f, r);
    evaluate(f, r);
  }
  assert.equal(R.rows(f.s, { perimeterId: f.g.id }).length, 2);
  assert.equal(R.rows(f.s, { perimeterId: f.a.id }).length, 1);
});
test("jeu FICTIF cohérent, répétable, sans écrasement ni compte de connexion", () => {
  const f = fixture();
  const info = D.build(f.s, "Compte FICTIF");
  assert.equal(f.s.riskMgmt.risks.length, 0);
  assert.equal(info.state.riskMgmt.risks.length, 3);
  assert.equal(info.state.riskMgmt.studies.length, 2);
  assert.equal(info.state.riskMgmt.assessments.length, 4);
  assert.equal(info.state.pcra.bias[0].activities.length, 2);
  const again = D.build(info.state, "Compte FICTIF");
  assert.equal(again.created, false);
  assert.deepEqual(again.state, info.state);
  assert.ok(!JSON.stringify(info.state).includes("password"));
});
