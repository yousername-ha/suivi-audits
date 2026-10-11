/* Étapes reprises de packages/shared/src/pilotage.ts, adaptées au document Legacy partagé. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./df-core")
      : root.LegacyDF,
    typeof module === "object" && module.exports
      ? require("./integration-core")
      : root.LegacyIntegration,
    typeof module === "object" && module.exports
      ? require("../sources/journey-steps.json")
      : root.LegacyJourneySteps,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LegacyJourney = api;
})(typeof globalThis === "object" ? globalThis : this, function (C, I, STEPS) {
  "use strict";
  const STATES = [
    "Non commencé",
    "En cours",
    "Bloqué",
    "En attente de validation",
    "Terminé",
  ];

  function init(s) {
    I.init(s);
    s.journey = s.journey || { schema: 1, runs: [], tasks: [] };
    if (s.journey.schema !== 1)
      throw Error("Version du parcours non reconnue.");
    return s;
  }
  const getRun = (s, id) => {
    init(s);
    const r = s.journey.runs.find((x) => x.id === id);
    if (!r) throw Error("Parcours introuvable.");
    return r;
  };
  const getTask = (s, id) => {
    init(s);
    const r = s.journey.tasks.find((x) => x.id === id);
    if (!r) throw Error("Sous-tâche introuvable.");
    return r;
  };
  function create(s, f) {
    init(s);
    if (!f.perimeterIds?.length)
      throw Error("Choisissez au moins un périmètre.");
    for (const id of f.perimeterIds) I.object(s, { kind: "perimeter", id });
    const r = {
      id: C.id("JOURNEY"),
      title: C.required(f.title, "Le nom du parcours"),
      perimeterIds: I.unique(f.perimeterIds),
      frameworkIds: I.unique(f.frameworkIds),
      responsible: f.responsible || null,
      createdAt: C.now(),
      steps: STEPS.map((x) => ({
        id: x.id,
        label: x.label,
        status: "Non commencé",
      })),
      currentStep: "context",
    };
    s.journey.runs.push(r);
    for (const step of STEPS) {
      let refs = I.collections(s)[step.kind].filter((x) =>
        x.perimeterIds?.some((id) => r.perimeterIds.includes(id)),
      );
      const task = addTask(s, r.id, {
        stepId: step.id,
        title: step.label,
        description: step.why,
        businessRef: refs.length ? { kind: step.kind, id: refs[0].id } : null,
        requiredFields: step.fields,
        mandatory: true,
        requireProof: ["documents", "continuity", "improvement"].includes(
          step.id,
        ),
        requiresValidation: [
          "scope",
          "governance",
          "continuity",
          "review",
        ].includes(step.id),
      });
      task.businessKind = step.kind;
    }
    for (const frameworkId of r.frameworkIds) {
      const fw = s.frameworks.find((x) => x.id === frameworkId);
      if (!fw) throw Error("Référentiel introuvable.");
      if (!["CARE", "HAS"].includes(fw.dfKind)) continue;
      let dossier = s.df.dossiers.find(
        (d) =>
          d.frameworkId === frameworkId &&
          JSON.stringify([...(d.perimeterIds || [])].sort()) ===
            JSON.stringify([...r.perimeterIds].sort()) &&
          !d.archived,
      );
      if (!dossier) {
        dossier = C.createDossier(s, {
          kind: fw.dfKind,
          domain: fw.domain,
          title: r.title + " · " + fw.name,
          frameworkId,
          scope: r.perimeterIds.map(
            (id) => I.object(s, { kind: "perimeter", id }).name,
          ),
        });
        dossier.perimeterIds = [...r.perimeterIds];
      }
      for (const e of s.df.evaluations.filter(
        (e) => e.dossierId === dossier.id,
      )) {
        const stepId = /D2\.O1\.[CD]/.test(e.requirementId)
          ? "continuity"
          : /D2\.P2|D2\.O1\.A/.test(e.requirementId)
            ? "governance"
            : /D2\.O4/.test(e.requirementId)
              ? "monitoring"
              : "documents";
        addTask(s, r.id, {
          stepId,
          title: e.requirementId + " · " + e.requirement.title,
          description: e.requirement.criteria || e.requirement.text,
          requirement: {
            frameworkId,
            requirementId: e.requirementId,
            evaluationId: e.id,
          },
          businessRef: { kind: "evaluation", id: e.id },
          requiredFields: ["notes"],
          requireProof: true,
          requiresValidation: true,
          mandatory: true,
        });
      }
    }
    reconcile(s);
    C.log(s, "Création du parcours", "journey", r.id, null, r);
    return r;
  }
  function addTask(s, journeyId, f) {
    const run = getRun(s, journeyId);
    if (!STEPS.some((x) => x.id === f.stepId)) throw Error("Étape inconnue.");
    if (f.requirement) {
      const exists = s.journey.tasks.find(
        (x) =>
          x.journeyId === journeyId &&
          x.requirement?.evaluationId === f.requirement.evaluationId,
      );
      if (exists) return exists;
    }
    const t = {
      id: C.id("TASK"),
      journeyId,
      stepId: f.stepId,
      title: C.required(f.title, "Le titre"),
      description: C.cleanText(f.description || ""),
      perimeterIds: f.perimeterIds?.length
        ? I.unique(f.perimeterIds)
        : [...run.perimeterIds],
      responsible: f.responsible || run.responsible,
      requirement: f.requirement || null,
      businessRef: f.businessRef || null,
      businessKind:
        f.businessRef?.kind || STEPS.find((x) => x.id === f.stepId).kind,
      requiredFields: f.requiredFields || [],
      criteria: C.cleanText(f.criteria || ""),
      due: C.date(f.due || ""),
      priority: f.priority || "Normale",
      dependsOn: I.unique(f.dependsOn),
      mandatory: f.mandatory !== false,
      requireProof: !!f.requireProof,
      requireLatestProof: f.requireLatestProof !== false,
      requiresValidation: !!f.requiresValidation,
      proofRefs: f.proofRefs || [],
      completionRequested: false,
      status: "Non commencé",
      createdAt: C.now(),
      actionId: "",
    };
    s.journey.tasks.push(t);
    return t;
  }
  function updateTask(s, id, f) {
    const t = getTask(s, id);
    for (const dep of f.dependsOn || []) {
      getTask(s, dep);
      if (dep === id)
        throw Error("Une tâche ne peut pas dépendre d’elle-même.");
    }
    const before = C.clone(t);
    Object.assign(t, {
      title: C.required(f.title || t.title, "Le titre"),
      description: C.cleanText(f.description ?? t.description),
      due: C.date(f.due ?? t.due),
      priority: f.priority || t.priority,
      responsible: f.responsible === undefined ? t.responsible : f.responsible,
      perimeterIds: f.perimeterIds || t.perimeterIds,
      dependsOn: f.dependsOn || [],
      criteria: C.cleanText(f.criteria ?? t.criteria),
      requiredFields: f.requiredFields || t.requiredFields,
      businessRef: f.businessRef === undefined ? t.businessRef : f.businessRef,
      proofRefs: f.proofRefs || t.proofRefs,
      mandatory: f.mandatory === undefined ? t.mandatory : f.mandatory,
      requireProof:
        f.requireProof === undefined ? t.requireProof : f.requireProof,
      requireLatestProof:
        f.requireLatestProof === undefined
          ? t.requireLatestProof
          : f.requireLatestProof,
      requiresValidation:
        f.requiresValidation === undefined
          ? t.requiresValidation
          : f.requiresValidation,
    });
    if (t.actionId) {
      const a = I.object(s, { kind: "action", id: t.actionId });
      Object.assign(a, {
        text: t.title,
        desc: t.description,
        due: t.due,
        responsible: t.responsible,
        perimeterIds: t.perimeterIds,
        owner: t.responsible
          ? s.roles.find((r) => r.id === t.responsible.roleId)?.name || a.owner
          : a.owner,
      });
    }
    reconcile(s);
    C.log(s, "Modification de sous-tâche", "task", t.id, before, t);
    return t;
  }
  function ensureAction(s, id, existingId) {
    const t = getTask(s, id);
    let a = s.findings.find(
      (x) => x.id === (existingId || t.actionId) || x.journeyTaskId === t.id,
    );
    if (!a) {
      a = {
        id: C.id("F"),
        text: t.title,
        desc: t.description,
        items: [],
        status: "Ouvert",
        action: t.description || t.title,
        tasks: [],
        comment: "",
        owner: t.responsible
          ? s.roles.find((r) => r.id === t.responsible.roleId)?.name || ""
          : "",
        due: t.due,
        proof: "",
        source: "Parcours guidé",
        year: s.nextYear || new Date().getFullYear(),
        type: "Remarque",
        createdAt: C.now(),
        perimeterIds: [...t.perimeterIds],
        responsible: t.responsible,
      };
      s.findings.push(a);
    }
    if (a.journeyTaskId && a.journeyTaskId !== t.id)
      throw Error("Cette action est déjà rattachée à une autre sous-tâche.");
    a.journeyTaskId = t.id;
    t.actionId = a.id;
    t.lastActionStatus = a.status;
    I.relate(s, { kind: "task", id: t.id }, { kind: "action", id: a.id });
    if (t.requirement?.evaluationId)
      C.attachFinding(s, t.requirement.evaluationId, a.id);
    return a;
  }
  const ignored = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "history",
    "validation",
    "objectRefs",
    "actionIds",
    "reviewState",
    "needsReview",
  ]);
  function snapshot(r) {
    const withoutCodes = (value) =>
      Array.isArray(value)
        ? value.map(withoutCodes)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([k]) => k !== "internalId")
                .map(([k, v]) => [k, withoutCodes(v)]),
            )
          : value;
    return Object.fromEntries(
      Object.entries(r || {})
        .filter(([k]) => !ignored.has(k) && k !== "internalId")
        .map(([k, v]) => [k, withoutCodes(C.clone(v))]),
    );
  }
  function accepted(s, ref, latest = true) {
    const p = s.evidences.find((p) => p.id === ref.evidenceId),
      last = p?.dfVersions?.at(-1),
      val = C.proofValidation(s, ref);
    return !!(
      last &&
      (latest
        ? last.id === ref.versionId
        : p.dfVersions.some((v) => v.id === ref.versionId)) &&
      val?.status === "Acceptée en interne" &&
      !p.obsolete &&
      (!p.review || p.review >= C.now().slice(0, 10))
    );
  }
  function gates(s, t) {
    let business = null;
    try {
      if (t.businessRef) business = I.object(s, t.businessRef);
    } catch {}
    const missing = [];
    if (!business) missing.push("Objet métier à renseigner");
    for (const field of t.requiredFields || []) {
      const val = business?.[field];
      if (
        !val ||
        (typeof val === "string" && !val.trim()) ||
        (Array.isArray(val) && !val.length)
      )
        missing.push("Donnée manquante : " + field);
    }
    if (
      business &&
      (t.perimeterIds || []).some((id) => !business.perimeterIds?.includes(id))
    )
      missing.push("Couverture des périmètres à compléter");
    const refs = t.proofRefs?.length
      ? t.proofRefs
      : business?.proofRefs?.length
        ? business.proofRefs
        : t.businessRef?.kind === "proof" && business?.dfVersions?.length
          ? [
              {
                evidenceId: business.id,
                versionId: business.dfVersions.at(-1).id,
              },
            ]
          : [];
    if (
      t.requireProof &&
      !refs.some((r) => accepted(s, r, t.requireLatestProof !== false))
    )
      missing.push("Version actuelle de preuve acceptée en interne requise");
    if (
      t.requirement &&
      business &&
      !["Atteint", "Conforme", "Non applicable"].includes(business.status)
    )
      missing.push("Exigence à évaluer et valider dans son registre");
    if (
      t.dependsOn.some(
        (id) => s.journey.tasks.find((x) => x.id === id)?.status !== "Terminé",
      )
    )
      missing.push("Dépendance non terminée");
    const validationNeeded =
      t.requiresValidation &&
      (!t.validation ||
        JSON.stringify(snapshot(t.validation.dataSnapshot)) !==
          JSON.stringify(snapshot(business)));
    return { missing, validationNeeded, business };
  }
  function validateTask(s, id, reviewer) {
    const t = getTask(s, id),
      g = gates(s, t);
    if (g.missing.length) throw Error(g.missing.join(" · "));
    t.validation = {
      actor: reviewer,
      date: C.now(),
      dataSnapshot: snapshot(g.business),
    };
    t.completionRequested = true;
    reconcile(s);
    return t;
  }
  function setStatus(s, id, status) {
    const t = getTask(s, id);
    if (!STATES.includes(status)) throw Error("Statut invalide.");
    t.completionRequested = status === "Terminé";
    t.blocked = status === "Bloqué";
    t.started = status !== "Non commencé";
    if (t.actionId) {
      const a = I.object(s, { kind: "action", id: t.actionId });
      a.status =
        status === "Terminé"
          ? "Clos"
          : status === "Non commencé"
            ? "Ouvert"
            : "En cours";
      t.lastActionStatus = a.status;
    }
    reconcile(s);
    return t;
  }
  function reconcile(s) {
    init(s);
    const visited = new Set(),
      tasks = new Map(s.journey.tasks.map((t) => [t.id, t]));
    function visit(t, chain = new Set()) {
      if (visited.has(t.id)) return;
      if (chain.has(t.id)) throw Error("Cycle entre les sous-tâches.");
      const next = new Set([...chain, t.id]);
      for (const id of t.dependsOn) {
        const dep = tasks.get(id);
        if (!dep) throw Error("Dépendance introuvable.");
        visit(dep, next);
      }
      const a = s.findings.find((x) => x.id === t.actionId);
      if (a && a.status !== t.lastActionStatus) {
        t.completionRequested = a.status === "Clos";
        t.started = a.status !== "Ouvert";
        t.lastActionStatus = a.status;
      }
      const g = gates(s, t);
      t.issues = g.missing;
      t.needsValidation = g.validationNeeded;
      t.status = t.blocked
        ? "Bloqué"
        : t.completionRequested && g.missing.length
          ? "Bloqué"
          : t.completionRequested && g.validationNeeded
            ? "En attente de validation"
            : t.completionRequested
              ? "Terminé"
              : t.started || a?.status === "En cours"
                ? "En cours"
                : "Non commencé";
      visited.add(t.id);
    }
    for (const t of s.journey.tasks) visit(t);
    for (const r of s.journey.runs) {
      r.steps = STEPS.map((step) => {
        const ts = s.journey.tasks.filter(
          (t) => t.journeyId === r.id && t.stepId === step.id && t.mandatory,
        );
        const done = ts.filter((t) => t.status === "Terminé").length;
        return {
          id: step.id,
          label: step.label,
          total: ts.length,
          done,
          status:
            done === ts.length
              ? "Terminé"
              : ts.some((t) => t.status === "Bloqué")
                ? "Bloqué"
                : ts.some((t) => t.status === "En attente de validation")
                  ? "En attente de validation"
                  : ts.some((t) => t.status !== "Non commencé")
                    ? "En cours"
                    : "Non commencé",
        };
      });
      r.currentStep =
        r.steps.find((x) => x.status !== "Terminé")?.id || "finished";
      r.progress = Math.round(
        (r.steps.filter((x) => x.status === "Terminé").length /
          r.steps.length) *
          100,
      );
    }
    return s;
  }
  return {
    STATES,
    STEPS,
    init,
    create,
    addTask,
    updateTask,
    ensureAction,
    getRun,
    getTask,
    accepted,
    gates,
    validateTask,
    setStatus,
    reconcile,
    snapshot,
  };
});
