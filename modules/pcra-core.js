/* PCRA : BIA métier, continuité, reprise et exercices sur le registre Legacy. */
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
  else root.LegacyPCRA = api;
})(typeof globalThis === "object" ? globalThis : this, function (C, I) {
  "use strict";
  const DEFAULT_POLICY = {
    title: "Échelles internes de départ — à adapter",
    horizons: [
      { id: "H1", label: "1 heure", hours: 1 },
      { id: "H4", label: "4 heures", hours: 4 },
      { id: "H24", label: "24 heures", hours: 24 },
      { id: "H72", label: "72 heures", hours: 72 },
    ],
    dimensions: [
      { id: "PATIENT", label: "Sécurité du patient" },
      { id: "ACTIVITY", label: "Activité / soins" },
      { id: "LEGAL", label: "Juridique" },
      { id: "FINANCE", label: "Financier" },
      { id: "REPUTATION", label: "Réputation" },
    ],
    levels: [
      { id: "L1", label: "Faible", rank: 1, color: "#dce8e0" },
      { id: "L2", label: "Modéré", rank: 2, color: "#b9d0c1" },
      { id: "L3", label: "Important", rank: 3, color: "#d6b979" },
      { id: "L4", label: "Critique", rank: 4, color: "#b66f61" },
    ],
  };
  function init(s) {
    I.init(s);
    s.pcra = s.pcra || {
      schema: 1,
      bias: [],
      plans: [],
      exercises: [],
      policies: [],
    };
    for (const k of ["bias", "plans", "exercises", "policies"])
      s.pcra[k] = s.pcra[k] || [];
    if (s.pcra.schema !== 1) throw Error("Version PCRA non reconnue.");
    return s;
  }
  const find = (xs, id, label) => {
    const x = xs.find((x) => x.id === id);
    if (!x) throw Error(label + " introuvable.");
    return x;
  };
  function policy(s, f) {
    init(s);
    if (!f.perimeterIds?.length)
      throw Error("Choisissez les périmètres de la politique BIA.");
    const base = { ...C.clone(DEFAULT_POLICY), ...f },
      seen = new Set();
    for (const k of ["horizons", "dimensions", "levels"]) {
      if (!Array.isArray(base[k]) || !base[k].length || base[k].length > 30)
        throw Error("Définissez de 1 à 30 " + k + ".");
      for (const row of base[k]) {
        if (!row.id || seen.has(k + row.id) || !row.label)
          throw Error("Identifiants et libellés de politique invalides.");
        seen.add(k + row.id);
        if (k === "horizons" && (!Number.isFinite(row.hours) || row.hours <= 0))
          throw Error("Horizon temporel invalide.");
        if (
          k === "levels" &&
          (!Number.isFinite(row.rank) || !/^#[a-f\d]{6}$/i.test(row.color))
        )
          throw Error("Niveau ou couleur invalide.");
      }
    }
    const p = {
      ...base,
      id: C.id("POLICY"),
      title: C.required(base.title, "Le nom de la politique"),
      perimeterIds: I.unique(f.perimeterIds),
      version: f.previousId
        ? find(s.pcra.policies, f.previousId, "Politique").version + 1
        : 1,
      createdAt: C.now(),
      normative: false,
    };
    s.pcra.policies.push(p);
    C.log(s, "Version de politique BIA interne", "policy", p.id, null, p);
    return p;
  }
  const semantic = (b) => ({
    perimeterIds: b.perimeterIds,
    policyId: b.policyId,
    activities: b.activities,
  });
  function saveBia(s, f, id) {
    init(s);
    const old = id ? find(s.pcra.bias, id, "BIA") : null;
    let pol = f.policyId
      ? s.pcra.policies.find((p) => p.id === f.policyId)
      : null;
    if (!pol) throw Error("Choisissez une politique d’impact versionnée.");
    if (!f.perimeterIds?.length)
      throw Error("Choisissez au moins un périmètre.");
    if (
      !f.perimeterIds.every((id) =>
        pol.perimeterIds.some((root) => I.descendants(s, root).includes(id)),
      )
    )
      throw Error("La politique ne couvre pas tous les périmètres du BIA.");
    const activities = (f.activities || old?.activities || []).map((a) => ({
      ...a,
      id: a.id || C.id("ACTIVITY"),
      name: C.required(
        a.name || s.processes?.find((p) => p.id === a.processId)?.name,
        "L’activité",
      ),
      maxInterruptionHours: number(a.maxInterruptionHours, true),
      rtoBusinessHours: number(a.rtoBusinessHours, true),
      rpoBusinessHours: number(a.rpoBusinessHours, true),
      impacts: a.impacts || {},
    }));
    for (const a of activities) {
      for (const [h, scores] of Object.entries(a.impacts)) {
        if (!pol.horizons.some((x) => x.id === h))
          throw Error("Horizon absent de cette politique.");
        for (const [d, v] of Object.entries(scores))
          if (
            !pol.dimensions.some((x) => x.id === d) ||
            !pol.levels.some((x) => x.id === v)
          )
            throw Error("Impact absent de cette politique.");
      }
    }
    const before = old ? C.clone({ ...old, history: undefined }) : null,
      b = {
        ...(old || {
          id: C.id("BIA"),
          createdAt: C.now(),
          history: [],
          contentRevision: 0,
        }),
        title: C.required(f.title, "Le titre"),
        perimeterIds: I.unique(f.perimeterIds),
        responsible: f.responsible || null,
        policyId: pol.id,
        activities,
        notes: C.cleanText(f.notes || ""),
        analysisDate: C.date(
          f.analysisDate || old?.analysisDate || C.now().slice(0, 10),
        ),
        reviewDate: C.date(f.reviewDate || ""),
        proofRefs: f.proofRefs || old?.proofRefs || [],
        version: (old?.version || 0) + 1,
        updatedAt: C.now(),
        status: "Brouillon",
      };
    const changed =
      !old || JSON.stringify(semantic(old)) !== JSON.stringify(semantic(b));
    b.contentRevision = (old?.contentRevision || 0) + (changed ? 1 : 0);
    if (old) {
      b.history.push({ version: old.version, at: C.now(), snapshot: before });
      Object.assign(old, b);
    } else s.pcra.bias.push(b);
    if (changed)
      for (const p of s.pcra.plans.filter((p) => p.biaId === b.id)) {
        p.needsReview = true;
        p.reviewState = "BIA modifié — plan à réexaminer";
      }
    C.log(s, "Version du BIA", "bia", b.id, before, b);
    return old || b;
  }
  function number(v, optional = false) {
    if ((v === "" || v === null || v === undefined) && optional) return null;
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 1000000)
      throw Error("Durée invalide : utilisez des heures positives ou nulles.");
    return n;
  }
  function activity(s, biaId, f, id) {
    const b = find(init(s).pcra.bias, biaId, "BIA"),
      old = b.activities.find((a) => a.id === id);
    const a = {
      ...(old || {}),
      ...f,
      id: id || C.id("ACTIVITY"),
      name: C.required(
        f.name || s.processes?.find((p) => p.id === f.processId)?.name,
        "L’activité",
      ),
      processId: f.processId || "",
      category: f.category || "Autre",
      minimumService: C.cleanText(f.minimumService || ""),
      humanNeeds: C.cleanText(f.humanNeeds || ""),
      materialNeeds: C.cleanText(f.materialNeeds || ""),
      siNeeds: C.cleanText(f.siNeeds || ""),
      buildingNeeds: C.cleanText(f.buildingNeeds || ""),
      supplierNeeds: C.cleanText(f.supplierNeeds || ""),
      dependencies: C.cleanText(f.dependencies || ""),
      workarounds: C.cleanText(f.workarounds || ""),
      justification: C.cleanText(f.justification || ""),
      maxInterruptionHours: number(f.maxInterruptionHours, true),
      rtoBusinessHours: number(f.rtoBusinessHours, true),
      rpoBusinessHours: number(f.rpoBusinessHours, true),
      impacts: f.impacts || old?.impacts || {},
    };
    return saveBia(
      s,
      {
        ...b,
        activities: old
          ? b.activities.map((x) => (x.id === id ? a : x))
          : [...b.activities, a],
      },
      b.id,
    );
  }
  function biaIssues(s, b) {
    const p = find(init(s).pcra.policies, b.policyId, "Politique"),
      issues = [];
    if (!b.activities.length) issues.push("Aucune activité");
    for (const a of b.activities) {
      const prefix = a.name + " : ";
      if (!(a.maxInterruptionHours > 0))
        issues.push(prefix + "délai maximal acceptable requis");
      for (const field of [
        "minimumService",
        "humanNeeds",
        "materialNeeds",
        "siNeeds",
        "buildingNeeds",
        "supplierNeeds",
        "dependencies",
        "workarounds",
        "justification",
      ])
        if (!a[field])
          issues.push(
            prefix + "renseigner " + field + " (ou « aucun » justifié)",
          );
      for (const h of p.horizons)
        for (const d of p.dimensions)
          if (!a.impacts?.[h.id]?.[d.id])
            issues.push(
              prefix + "impact " + d.label + " à " + h.label + " non évalué",
            );
      if (
        a.rtoBusinessHours != null &&
        a.rtoBusinessHours > a.maxInterruptionHours
      )
        issues.push(prefix + "RTO métier supérieur au délai maximal");
    }
    return issues;
  }
  function validateBia(s, id, reviewer) {
    const b = find(init(s).pcra.bias, id, "BIA"),
      issues = biaIssues(s, b);
    if (issues.length) throw Error(issues.slice(0, 8).join(" · "));
    b.validation = {
      actor: reviewer,
      date: C.now(),
      contentRevision: b.contentRevision,
      version: b.version,
    };
    b.status = "Validé en interne";
    C.log(s, "Validation interne du BIA", "bia", b.id, null, b.validation);
    return b;
  }
  function savePlan(s, f, id) {
    init(s);
    const old = id ? find(s.pcra.plans, id, "Plan") : null,
      b = find(s.pcra.bias, f.biaId || old?.biaId, "BIA");
    if (!["PCA", "PRA"].includes(f.kind || old?.kind))
      throw Error("Choisissez PCA ou PRA.");
    const p = {
      ...(old || { id: C.id("PCRA"), createdAt: C.now(), history: [] }),
      kind: f.kind || old.kind,
      biaId: b.id,
      biaRevision: b.contentRevision,
      activityIds: I.unique(f.activityIds || []),
      perimeterIds: I.unique(f.perimeterIds || b.perimeterIds),
      title: C.required(f.title, "Le titre du plan"),
      responsible: f.responsible || null,
      scenario: C.required(f.scenario, "Le scénario d’indisponibilité"),
      activation: C.cleanText(f.activation || ""),
      procedure: C.cleanText(f.procedure || ""),
      communication: C.cleanText(f.communication || ""),
      resources: C.cleanText(f.resources || ""),
      dependencies: C.cleanText(f.dependencies || ""),
      returnToNormal: C.cleanText(f.returnToNormal || ""),
      technicalRtoHours: number(f.technicalRtoHours, true),
      technicalRpoHours: number(f.technicalRpoHours, true),
      reviewDate: C.date(f.reviewDate || ""),
      proofRefs: f.proofRefs || old?.proofRefs || [],
      version: (old?.version || 0) + 1,
      status: "Brouillon",
      needsReview: false,
      reviewState: "À valider",
      updatedAt: C.now(),
    };
    if (p.activityIds.some((id) => !b.activities.some((a) => a.id === id)))
      throw Error("Activité absente du BIA associé.");
    const before = old ? C.clone({ ...old, history: undefined }) : null;
    if (old) {
      p.history.push({ version: old.version, at: C.now(), snapshot: before });
      Object.assign(old, p);
    } else s.pcra.plans.push(p);
    I.relate(s, { kind: "bia", id: b.id }, { kind: "continuity", id: p.id });
    C.log(s, "Version du " + p.kind, "continuity", p.id, before, p);
    return old || p;
  }
  function planIssues(s, p) {
    const b = find(init(s).pcra.bias, p.biaId, "BIA"),
      issues = [];
    if (!b.validation || b.validation.contentRevision !== b.contentRevision)
      issues.push("BIA actuel non validé");
    if (p.biaRevision !== b.contentRevision)
      issues.push("BIA modifié : réexaminer le plan");
    if (!p.activityIds.length)
      issues.push("Activités couvertes à sélectionner");
    for (const key of [
      "activation",
      "procedure",
      "communication",
      "resources",
      "dependencies",
      "returnToNormal",
    ])
      if (!p[key]) issues.push("Renseigner " + key);
    if (
      p.kind === "PRA" &&
      (p.technicalRtoHours === null || p.technicalRpoHours === null)
    )
      issues.push("Objectifs techniques RTO/RPO à définir");
    return issues;
  }
  function validatePlan(s, id, reviewer) {
    const p = find(init(s).pcra.plans, id, "Plan"),
      issues = planIssues(s, p);
    if (issues.length) throw Error(issues.join(" · "));
    p.validation = {
      actor: reviewer,
      date: C.now(),
      version: p.version,
      biaRevision: p.biaRevision,
    };
    p.status = "Validé en interne";
    p.reviewState = "Version actuelle validée";
    C.log(
      s,
      "Validation interne du " + p.kind,
      "continuity",
      p.id,
      null,
      p.validation,
    );
    return p;
  }
  function exercise(s, f, id) {
    init(s);
    const old = id ? find(s.pcra.exercises, id, "Exercice") : null,
      p = find(s.pcra.plans, f.planId || old?.planId, "Plan");
    const e = {
      ...(old || {
        id: C.id("EXERCISE"),
        createdAt: C.now(),
        actionIds: [],
        history: [],
      }),
      planId: p.id,
      planVersion: p.version,
      perimeterIds: [...p.perimeterIds],
      title: C.required(f.title, "Le titre"),
      date: C.date(f.date || ""),
      responsible: f.responsible || null,
      participants: C.cleanText(f.participants || ""),
      type: C.cleanText(f.type || old?.type || "Sur table", 200),
      conduct: C.cleanText(f.conduct || old?.conduct || ""),
      scenario: C.cleanText(f.scenario || p.scenario),
      objectives: C.cleanText(f.objectives || ""),
      results: C.cleanText(f.results || ""),
      retex: C.cleanText(f.retex || ""),
      gaps: C.cleanText(f.gaps || ""),
      actualRtoHours: number(f.actualRtoHours, true),
      actualRpoHours: number(f.actualRpoHours, true),
      proofRefs: f.proofRefs || old?.proofRefs || [],
      status: f.status || "Prévu",
      version: (old?.version || 0) + 1,
    };
    if (e.status === "Réalisé" && (!e.date || !e.results || !e.retex))
      throw Error("Un exercice réalisé nécessite date, résultats et RETEX.");
    if (old) {
      e.history.push({
        version: old.version,
        at: C.now(),
        snapshot: C.clone({ ...old, history: undefined }),
      });
      Object.assign(old, e);
    } else s.pcra.exercises.push(e);
    I.relate(
      s,
      { kind: "exercise", id: e.id },
      { kind: "continuity", id: p.id },
    );
    C.log(s, "Suivi d’exercice", "exercise", e.id, null, e);
    return old || e;
  }
  function corrective(s, exerciseId, f) {
    const e = find(init(s).pcra.exercises, exerciseId, "Exercice");
    if (f.sourceKey) {
      const a = s.findings.find(
        (x) => x.pcraExerciseId === e.id && x.pcraSourceKey === f.sourceKey,
      );
      if (a) return a;
    }
    const a = {
      id: C.id("F"),
      text: C.required(f.title, "L’action corrective"),
      desc: C.cleanText(f.description || e.gaps || ""),
      action: C.cleanText(f.description || e.gaps || ""),
      items: [],
      tasks: [],
      status: "Ouvert",
      comment: "",
      proof: "",
      source: "Exercice PCRA",
      type: "Remarque",
      year: s.nextYear || new Date().getFullYear(),
      owner: f.responsible
        ? s.roles.find((r) => r.id === f.responsible.roleId)?.name || ""
        : "",
      responsible: f.responsible || e.responsible,
      due: C.date(f.due || ""),
      createdAt: C.now(),
      perimeterIds: [...e.perimeterIds],
      pcraExerciseId: e.id,
      pcraSourceKey: f.sourceKey || "",
    };
    s.findings.push(a);
    e.actionIds = I.unique([...e.actionIds, a.id]);
    I.relate(s, { kind: "action", id: a.id }, { kind: "exercise", id: e.id });
    C.log(s, "Action corrective", "action", a.id, null, a);
    return a;
  }
  function reconcile(s) {
    init(s);
    for (const b of s.pcra.bias)
      if (b.validation && b.validation.contentRevision !== b.contentRevision)
        b.status = "À réévaluer";
    for (const p of s.pcra.plans) {
      const b = s.pcra.bias.find((b) => b.id === p.biaId);
      if (!b || p.biaRevision !== b.contentRevision) {
        p.needsReview = true;
        p.reviewState = "BIA modifié — plan à réexaminer";
        p.status = "À réévaluer";
      }
    }
    return s;
  }
  function dashboard(s) {
    reconcile(s);
    return {
      bias: s.pcra.bias.length,
      activities: s.pcra.bias.reduce((n, b) => n + b.activities.length, 0),
      validated: s.pcra.bias.filter((b) => b.status === "Validé en interne")
        .length,
      review: s.pcra.plans.filter((p) => p.needsReview).length,
      plans: s.pcra.plans.length,
      exercises: s.pcra.exercises.filter((e) => e.status === "Réalisé").length,
      actions: s.findings.filter((a) => a.pcraExerciseId && a.status !== "Clos")
        .length,
    };
  }
  return {
    DEFAULT_POLICY,
    init,
    policy,
    saveBia,
    activity,
    biaIssues,
    validateBia,
    savePlan,
    planIssues,
    validatePlan,
    exercise,
    corrective,
    reconcile,
    dashboard,
    number,
  };
});
