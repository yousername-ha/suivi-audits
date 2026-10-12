/* Registre central indépendant des études. Évaluations, politiques et décisions immuables. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./df-core")
      : root.LegacyDF,
    typeof module === "object" && module.exports
      ? require("./integration-core")
      : root.LegacyIntegration,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyRisks = api;
})(typeof globalThis === "object" ? globalThis : this, function (C, I) {
  "use strict";
  const METHODS = ["EBIOS RM", "ISO 27005", "MÉHARI", "Personnalisée"];
  const WORKSHOPS = [
    "Cadrage et socle de sécurité",
    "Sources de risque",
    "Scénarios stratégiques",
    "Scénarios opérationnels",
    "Traitement du risque",
  ];
  const DEFAULT_POLICY = {
    title: "Appréciation interne — à adapter",
    method: "EBIOS RM",
    calculation: "manual",
    impactScale: [
      { id: "I1", label: "Limité" },
      { id: "I2", label: "Significatif" },
      { id: "I3", label: "Majeur" },
      { id: "I4", label: "Critique" },
    ],
    likelihoodScale: [
      { id: "V1", label: "Peu vraisemblable" },
      { id: "V2", label: "Possible" },
      { id: "V3", label: "Vraisemblable" },
      { id: "V4", label: "Très vraisemblable" },
    ],
    levels: [
      {
        id: "L1",
        label: "Faible",
        color: "#dce8e0",
        acceptability: "Acceptable",
      },
      {
        id: "L2",
        label: "Modéré",
        color: "#b9d0c1",
        acceptability: "À examiner",
      },
      {
        id: "L3",
        label: "Élevé",
        color: "#d6b979",
        acceptability: "Traitement requis",
      },
      {
        id: "L4",
        label: "Critique",
        color: "#b66f61",
        acceptability: "Traitement requis",
      },
    ],
    matrix: {},
    description:
      "Politique interne configurable. Aucun barème normatif imposé.",
  };
  const find = (xs, id, label) => {
    const r = (xs || []).find((r) => r.id === id);
    if (!r) throw Error(label + " introuvable.");
    return r;
  };
  function init(s) {
    I.init(s);
    s.riskMgmt = s.riskMgmt || { schema: 1 };
    if (s.riskMgmt.schema !== 1)
      throw Error("Version du registre des risques inconnue.");
    for (const k of [
      "risks",
      "studies",
      "assessments",
      "scenarios",
      "policies",
      "treatments",
      "measures",
      "decisions",
    ])
      s.riskMgmt[k] = s.riskMgmt[k] || [];
    return s;
  }
  function scoped(s, ids) {
    ids = I.unique(ids);
    if (!ids.length) throw Error("Choisissez au moins un périmètre.");
    for (const id of ids) I.object(s, { kind: "perimeter", id });
    return ids;
  }
  function covers(s, parent, child) {
    return child.every((id) =>
      parent.some((root) => I.descendants(s, root).includes(id)),
    );
  }
  function record(s, key, prefix, fields, id) {
    init(s);
    const xs = s.riskMgmt[key],
      old = id ? find(xs, id, key) : null;
    const r = {
      ...(old || {
        id: C.id(prefix),
        createdAt: C.now(),
        history: [],
        version: 0,
      }),
      ...fields,
      updatedAt: C.now(),
      version: (old?.version || 0) + 1,
    };
    if (old) {
      r.history = [
        ...(old.history || []),
        {
          at: C.now(),
          version: old.version,
          snapshot: C.clone({ ...old, history: undefined }),
        },
      ];
      Object.assign(old, r);
    } else xs.push(r);
    C.log(
      s,
      old ? "Modification" : "Création",
      "risk-" + key,
      r.id,
      null,
      fields,
    );
    return old || r;
  }
  function policy(s, f) {
    init(s);
    const p = {
      ...C.clone(DEFAULT_POLICY),
      ...f,
      perimeterIds: scoped(s, f.perimeterIds),
      id: C.id("RPOL"),
      version: f.previousId
        ? find(s.riskMgmt.policies, f.previousId, "Politique").version + 1
        : 1,
      createdAt: C.now(),
      normative: false,
    };
    if (
      !METHODS.includes(p.method) ||
      !["manual", "matrix"].includes(p.calculation)
    )
      throw Error("Méthode ou calcul invalide.");
    for (const key of ["impactScale", "likelihoodScale", "levels"]) {
      const rows = p[key];
      if (
        !Array.isArray(rows) ||
        !rows.length ||
        rows.length > 20 ||
        new Set(rows.map((r) => r.id)).size !== rows.length ||
        rows.some((r) => !r.id || !r.label)
      )
        throw Error("Échelle invalide.");
    }
    if (p.levels.some((l) => !/^#[a-f\d]{6}$/i.test(l.color)))
      throw Error("Couleur invalide.");
    if (p.calculation === "matrix")
      for (const i of p.impactScale)
        for (const v of p.likelihoodScale)
          if (!p.levels.some((l) => l.id === p.matrix[i.id + ":" + v.id]))
            throw Error("Complétez toutes les cellules de la matrice.");
    s.riskMgmt.policies.push(p);
    C.log(s, "Politique des risques versionnée", "riskPolicy", p.id, null, p);
    return p;
  }
  function risk(s, f, id) {
    init(s);
    const old = id ? find(s.riskMgmt.risks, id, "Risque") : null;
    const perimeterIds = scoped(s, f.perimeterIds || old?.perimeterIds);
    I.checkResponsible(s, f.responsible, perimeterIds);
    return record(
      s,
      "risks",
      "RISK",
      {
        title: C.required(f.title, "Le risque"),
        description: C.required(f.description, "La description"),
        perimeterIds,
        responsible: f.responsible || old?.responsible || null,
        domain: C.cleanText(f.domain || ""),
        status: f.status || old?.status || "Ouvert",
        reviewDate: C.date(f.reviewDate || ""),
        referenceEvaluationIds: old?.referenceEvaluationIds || {
          initial: null,
          residual: null,
        },
        acceptedDecisionId: old?.acceptedDecisionId || null,
        needsReview:
          (!!old &&
            (old.description !== f.description ||
              JSON.stringify(old.perimeterIds) !==
                JSON.stringify(perimeterIds))) ||
          old?.needsReview ||
          false,
      },
      id,
    );
  }
  function annexAControls(s) {
    return (s.items || []).filter((item) => item.ref === "A");
  }
  function annexALinks(s, riskId) {
    const r = find(init(s).riskMgmt.risks, riskId, "Risque"),
      direct = new Set((r.objectRefs || []).filter((ref) => ref.kind === "control").map((ref) => ref.id)),
      measures = s.riskMgmt.measures.filter((m) => m.riskId === riskId);
    return annexAControls(s).map((control) => ({
      control,
      direct: direct.has(control.id),
      measures: measures.filter((m) => (m.controlIds || []).includes(control.id)),
    })).filter((link) => link.direct || link.measures.length);
  }
  function linkAnnexA(s, riskId, ids) {
    const r = find(init(s).riskMgmt.risks, riskId, "Risque"),
      controls = annexAControls(s),
      selected = I.unique(ids),
      valid = new Set(controls.map((c) => c.id));
    if (selected.some((id) => !valid.has(id)))
      throw Error("Mesure de l’Annexe A inconnue ou inaccessible.");
    const previous = (r.objectRefs || []).filter((ref) => ref.kind === "control" && valid.has(ref.id)).map((ref) => ref.id);
    if (previous.length === selected.length && previous.every((id) => selected.includes(id))) return r;
    const removed = new Set(previous.filter((id) => !selected.includes(id)));
    r.objectRefs = (r.objectRefs || []).filter((ref) => ref.kind !== "control" || !removed.has(ref.id));
    for (const c of controls) {
      if (removed.has(c.id)) c.objectRefs = (c.objectRefs || []).filter((ref) => ref.kind !== "risk" || ref.id !== riskId);
    }
    for (const id of selected) I.relate(s, { kind: "risk", id: riskId }, { kind: "control", id });
    r.updatedAt = C.now();
    C.log(s, "Rattachement Annexe A ISO 27001:2022", "risk", riskId, previous, selected);
    return r;
  }
  function study(s, f, id) {
    init(s);
    const ids = scoped(s, f.perimeterIds),
      riskIds = I.unique(f.riskIds);
    for (const rid of riskIds) {
      const r = find(s.riskMgmt.risks, rid, "Risque");
      if (!covers(s, ids, r.perimeterIds))
        throw Error("Le risque dépasse le périmètre de cette étude.");
    }
    return record(
      s,
      "studies",
      "EBRM",
      {
        title: C.required(f.title, "L’étude"),
        method: f.method || "EBIOS RM",
        date: C.date(f.date || C.now().slice(0, 10)),
        perimeterIds: ids,
        riskIds,
        responsible: f.responsible || null,
        status: f.status || "En cours",
        workshops: f.workshops || {},
      },
      id,
    );
  }
  function scenario(s, f, id) {
    init(s);
    const rids = I.unique(f.riskIds),
      st = f.studyId ? find(s.riskMgmt.studies, f.studyId, "Étude") : null,
      ids = scoped(s, f.perimeterIds);
    for (const rid of rids)
      if (!covers(s, ids, find(s.riskMgmt.risks, rid, "Risque").perimeterIds))
        throw Error("Risque hors scénario.");
    if (st && (!covers(s, st.perimeterIds, ids) || st.status === "Archivée"))
      throw Error("Étude archivée ou hors périmètre.");
    return record(
      s,
      "scenarios",
      "SCEN",
      {
        title: C.required(f.title, "Le scénario"),
        description: C.required(f.description, "Le déroulement"),
        type: f.type || "Opérationnel",
        source: C.cleanText(f.source || ""),
        fearedEvent: C.cleanText(f.fearedEvent || ""),
        supportingAssets: C.cleanText(f.supportingAssets || ""),
        studyId: st?.id || null,
        riskIds: rids,
        perimeterIds: ids,
        parentScenarioId: f.parentScenarioId || null,
      },
      id,
    );
  }
  function assessment(s, f, author) {
    init(s);
    const r = find(s.riskMgmt.risks, f.riskId, "Risque"),
      p = find(s.riskMgmt.policies, f.policyId, "Politique"),
      st = f.studyId ? find(s.riskMgmt.studies, f.studyId, "Étude") : null;
    if (
      !covers(s, p.perimeterIds, r.perimeterIds) ||
      (st &&
        (!covers(s, st.perimeterIds, r.perimeterIds) ||
          st.status !== "En cours" ||
          st.method !== p.method))
    )
      throw Error("Politique/étude hors périmètre ou archivée.");
    if (
      !["initial", "residual"].includes(f.stage) ||
      !p.impactScale.some((x) => x.id === f.impactId) ||
      !p.likelihoodScale.some((x) => x.id === f.likelihoodId)
    )
      throw Error("Résultat d’évaluation invalide.");
    const levelId =
      p.calculation === "matrix"
        ? p.matrix[f.impactId + ":" + f.likelihoodId]
        : f.levelId;
    if (!p.levels.some((x) => x.id === levelId))
      throw Error("Choisissez le niveau selon cette politique.");
    for (const id of f.scenarioIds || [])
      if (!find(s.riskMgmt.scenarios, id, "Scénario").riskIds.includes(r.id))
        throw Error("Scénario sans lien avec ce risque.");
    const a = {
      id: C.id("EVR"),
      riskId: r.id,
      studyId: st?.id || null,
      policyId: p.id,
      method: p.method,
      stage: f.stage,
      date: C.date(C.required(f.date, "La date")),
      author: author || "À attribuer côté serveur",
      justification: C.required(f.justification, "La justification"),
      impactId: f.impactId,
      likelihoodId: f.likelihoodId,
      levelId,
      results: C.cleanText(f.results || ""),
      scenarioIds: I.unique(f.scenarioIds),
      proofRefs: C.clone(f.proofRefs || []),
      perimeterIds: [...r.perimeterIds],
      createdAt: C.now(),
    };
    s.riskMgmt.assessments.push(a);
    if (st && !st.riskIds.includes(r.id)) st.riskIds.push(r.id);
    C.log(s, "Évaluation historisée", "riskAssessment", a.id, null, a);
    return a;
  }
  function reference(s, riskId, assessmentId) {
    const r = find(init(s).riskMgmt.risks, riskId, "Risque"),
      a = find(s.riskMgmt.assessments, assessmentId, "Évaluation");
    if (a.riskId !== r.id) throw Error("Évaluation d’un autre risque.");
    const before = C.clone(r.referenceEvaluationIds);
    r.referenceEvaluationIds[a.stage] = a.id;
    r.needsReview = false;
    C.log(
      s,
      "Choix de l’évaluation de référence",
      "risk",
      r.id,
      before,
      r.referenceEvaluationIds,
    );
    return a;
  }
  function decision(s, f, author) {
    init(s);
    const r = find(s.riskMgmt.risks, f.riskId, "Risque"),
      a = find(s.riskMgmt.assessments, f.assessmentId, "Évaluation");
    if (
      a.riskId !== r.id ||
      !["Accepter", "Réduire", "Transférer", "Éviter", "Réévaluer"].includes(
        f.kind,
      )
    )
      throw Error("Décision invalide.");
    const d = {
      id: C.id("DEC"),
      riskId: r.id,
      assessmentId: a.id,
      kind: f.kind,
      date: C.date(C.required(f.date, "La date")),
      validUntil: C.date(f.validUntil || ""),
      justification: C.required(f.justification, "La justification"),
      author: author || "À attribuer côté serveur",
      perimeterIds: [...r.perimeterIds],
      proofRefs: C.clone(f.proofRefs || []),
      createdAt: C.now(),
    };
    if (d.validUntil && d.validUntil < d.date)
      throw Error("La validité précède la décision.");
    s.riskMgmt.decisions.push(d);
    if (d.kind === "Accepter") r.acceptedDecisionId = d.id;
    C.log(s, "Décision de traitement", "riskDecision", d.id, null, d);
    return d;
  }
  function treatment(s, f, id) {
    const r = find(init(s).riskMgmt.risks, f.riskId, "Risque");
    if (!["Réduire", "Accepter", "Transférer", "Éviter"].includes(f.strategy))
      throw Error("Stratégie invalide.");
    return record(
      s,
      "treatments",
      "TRT",
      {
        riskId: r.id,
        title: C.required(f.title, "Le plan"),
        strategy: f.strategy,
        description: C.cleanText(f.description || ""),
        due: C.date(f.due || ""),
        responsible: f.responsible || null,
        perimeterIds: [...r.perimeterIds],
        status: f.status || "En cours",
      },
      id,
    );
  }
  function measure(s, f, id) {
    const t = find(
        init(s).riskMgmt.treatments,
        f.treatmentId,
        "Plan de traitement",
      ),
      old = id ? find(s.riskMgmt.measures, id, "Mesure") : null;
    return record(
      s,
      "measures",
      "MES",
      {
        title: C.required(f.title, "La mesure"),
        description: C.required(f.description, "La réalisation attendue"),
        treatmentId: t.id,
        riskId: t.riskId,
        perimeterIds: [...t.perimeterIds],
        responsible: f.responsible || null,
        due: C.date(f.due || ""),
        proofRefs: C.clone(f.proofRefs || []),
        controlIds: I.unique(f.controlIds),
        actionId: old?.actionId || null,
      },
      id,
    );
  }
  function action(s, measureId) {
    const m = find(init(s).riskMgmt.measures, measureId, "Mesure");
    let a = s.findings.find(
      (a) => a.id === m.actionId || a.riskMeasureId === m.id,
    );
    if (!a) {
      a = {
        id: C.id("F"),
        text: m.title,
        desc: m.description,
        action: m.description,
        items: m.controlIds || [],
        tasks: [],
        status: "Ouvert",
        source: "Traitement des risques",
        type: "Remarque",
        year: s.nextYear || new Date().getFullYear(),
        owner: m.responsible
          ? s.roles.find((r) => r.id === m.responsible.roleId)?.name || ""
          : "",
        responsible: m.responsible,
        perimeterIds: [...m.perimeterIds],
        due: m.due,
        proof: "",
        comment: "",
        riskMeasureId: m.id,
        createdAt: C.now(),
      };
      s.findings.push(a);
    }
    m.actionId = a.id;
    I.relate(
      s,
      { kind: "riskMeasure", id: m.id },
      { kind: "action", id: a.id },
    );
    I.relate(
      s,
      { kind: "risk", id: m.riskId },
      { kind: "riskTreatment", id: m.treatmentId },
    );
    return a;
  }
  function rows(
    s,
    {
      stage = "residual",
      perimeterId = "",
      status = "",
      policyId = "",
      query = "",
    } = {},
  ) {
    init(s);
    const scope = perimeterId ? new Set(I.descendants(s, perimeterId)) : null;
    return s.riskMgmt.risks
      .filter(
        (r) =>
          (!scope || r.perimeterIds.some((id) => scope.has(id))) &&
          (!status || r.status === status) &&
          (!query ||
            (r.title + " " + r.internalId + " " + r.domain)
              .toLowerCase()
              .includes(query.toLowerCase())),
      )
      .map((r) => {
        const d = s.riskMgmt.decisions.find(
            (d) => d.id === r.acceptedDecisionId,
          ),
          a = s.riskMgmt.assessments.find(
            (a) =>
              a.id ===
              (stage === "accepted"
                ? d?.assessmentId
                : r.referenceEvaluationIds?.[stage]),
          ),
          p = s.riskMgmt.policies.find((p) => p.id === a?.policyId),
          level = p?.levels.find((l) => l.id === a?.levelId);
        return {
          risk: r,
          assessment: a || null,
          policy: p || null,
          level: level || null,
          decision: d || null,
          acceptanceExpired:
            !!d?.validUntil && d.validUntil < C.now().slice(0, 10),
        };
      })
      .filter((row) => !policyId || row.policy?.id === policyId);
  }
  return {
    METHODS,
    WORKSHOPS,
    DEFAULT_POLICY,
    init,
    policy,
    risk,
    annexAControls,
    annexALinks,
    linkAnnexA,
    study,
    scenario,
    assessment,
    reference,
    decision,
    treatment,
    measure,
    action,
    rows,
    covers,
  };
});
