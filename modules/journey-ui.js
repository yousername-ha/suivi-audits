(function () {
  "use strict";
  const J = LegacyJourney,
    C = LegacyDF,
    I = LegacyIntegration;
  let U,
    binding = null;
  const positions = new Map();
  const run = () =>
    J.getRun(U.state(), U.api().ui.journeyId || U.state().journey.runs[0]?.id);
  function proofPicker(refs = []) {
    return U.multi(
      "proofRefs",
      "Versions de preuves à examiner",
      U.state().evidences.flatMap((p) =>
        (p.dfVersions || []).map((v) => ({
          value: p.id + "|" + v.id,
          label:
            p.title +
            " · version " +
            v.number +
            (v.id === p.dfVersions.at(-1).id ? " · actuelle" : " · ancienne"),
        })),
      ),
      refs.map((r) => r.evidenceId + "|" + r.versionId),
    );
  }
  function runForm() {
    U.dialog(
      "Commencer un parcours guidé",
      U.field("title", "Nom du parcours", "", "text", "required") +
        U.scopes() +
        U.responsible() +
        U.multi("frameworkIds", "Référentiels concernés", U.state().frameworks),
      (f) =>
        U.mutate((s) => {
          const r = J.create(s, {
            title: f.get("title"),
            perimeterIds: f.getAll("perimeterIds"),
            responsible: U.parseResponsible(f),
            frameworkIds: f.getAll("frameworkIds"),
          });
          U.api().ui.journeyId = r.id;
          U.api().ui.journeyStep = r.currentStep;
        }),
    );
  }
  function taskForm(id) {
    const t = id ? J.getTask(U.state(), id) : null,
      r = run(),
      stepId = t?.stepId || U.api().ui.journeyStep || r.currentStep;
    U.dialog(
      t ? "Sous-tâche du parcours" : "Ajouter une sous-tâche",
      U.field("title", "Titre", t?.title, "text", "required") +
        U.area("description", "Description opérationnelle", t?.description) +
        U.select(
          "stepId",
          "Étape",
          J.STEPS.map((x) => ({ value: x.id, label: x.label })),
          stepId,
        ) +
        U.scopes(t?.perimeterIds || r.perimeterIds) +
        U.responsible(
          t?.responsible || r.responsible,
          t?.perimeterIds || r.perimeterIds,
        ) +
        U.field("due", "Échéance", t?.due, "date") +
        U.select(
          "priority",
          "Priorité",
          ["Basse", "Normale", "Haute", "Critique"],
          t?.priority || "Normale",
        ) +
        U.select(
          "businessRef",
          "Objet métier partagé",
          Object.entries(I.collections(U.state())).flatMap(([kind, rows]) =>
            rows
              .filter((x) => x.id && !["journey", "task"].includes(kind))
              .map((x) => ({
                value: kind + "|" + x.id,
                label: kind + " · " + (x.name || x.title || x.text || x.id),
              })),
          ),
          t?.businessRef ? t.businessRef.kind + "|" + t.businessRef.id : "",
        ) +
        proofPicker(t?.proofRefs || []) +
        U.multi(
          "dependsOn",
          "Dépendances",
          U.state()
            .journey.tasks.filter((x) => x.journeyId === r.id && x.id !== id)
            .map((x) => ({ value: x.id, label: x.title })),
          t?.dependsOn || [],
        ) +
        U.area("criteria", "Critères de validation", t?.criteria) +
        (LegacyServer.user()?.permission === "admin"
          ? `<details><summary>Contrôles internes de cette sous-tâche</summary>` +
            U.multi(
              "requiredFields",
              "Données nécessaires",
              [
                { value: "name", label: "Nom" },
                { value: "title", label: "Intitulé" },
                { value: "description", label: "Contexte et description" },
                { value: "desc", label: "Description opérationnelle" },
                { value: "type", label: "Type de périmètre" },
                { value: "holder", label: "Titulaire" },
                { value: "resp", label: "Responsabilités" },
                { value: "text", label: "Libellé de l’action" },
                { value: "action", label: "Traitement prévu" },
                { value: "notes", label: "Justification / notes" },
                { value: "activities", label: "Activités du BIA" },
              ],
              t?.requiredFields || [],
            ) +
            `<label><input type="checkbox" name="mandatory" ${t?.mandatory !== false ? "checked" : ""}>Sous-tâche obligatoire</label><label><input type="checkbox" name="requireProof" ${t?.requireProof ? "checked" : ""}>Preuve acceptée en interne requise</label><label><input type="checkbox" name="requireLatestProof" ${t?.requireLatestProof !== false ? "checked" : ""}>Exiger la version la plus récente de la preuve</label><label><input type="checkbox" name="requiresValidation" ${t?.requiresValidation ? "checked" : ""}>Validation humaine requise</label></details>`
          : '<p class="lx-muted">Les règles de validation sont définies par l’administration.</p>'),
      (f) =>
        U.mutate((s) => {
          const [kind, bid] = (f.get("businessRef") || "").split("|");
          const values = {
            ...Object.fromEntries(f),
            perimeterIds: f.getAll("perimeterIds"),
            responsible: U.parseResponsible(f),
            businessRef: bid ? { kind, id: bid } : null,
            proofRefs: f.getAll("proofRefs").map((v) => {
              const [evidenceId, versionId] = v.split("|");
              return { evidenceId, versionId };
            }),
            dependsOn: f.getAll("dependsOn"),
            requiredFields:
              LegacyServer.user()?.permission === "admin"
                ? f.getAll("requiredFields")
                : t?.requiredFields || [],
            mandatory:
              LegacyServer.user()?.permission === "admin"
                ? f.has("mandatory")
                : (t?.mandatory ?? true),
            requireProof:
              LegacyServer.user()?.permission === "admin"
                ? f.has("requireProof")
                : (t?.requireProof ?? false),
            requireLatestProof:
              LegacyServer.user()?.permission === "admin"
                ? f.has("requireLatestProof")
                : (t?.requireLatestProof ?? true),
            requiresValidation:
              LegacyServer.user()?.permission === "admin"
                ? f.has("requiresValidation")
                : (t?.requiresValidation ?? true),
          };
          if (t) J.updateTask(s, id, values);
          else J.addTask(s, r.id, values);
        }),
    );
  }
  function genericBusiness(t, ref) {
    const existing = ref ? I.object(U.state(), ref) : null,
      kind = ref?.kind || t.businessKind;
    const nameKey = kind === "action" ? "text" : "name";
    const fields =
      U.field(
        nameKey,
        kind === "action" ? "Action" : "Nom",
        existing?.[nameKey],
        "text",
        "required",
      ) +
      U.area(
        kind === "action" ? "action" : "desc",
        "Description opérationnelle",
        existing?.[kind === "action" ? "action" : "desc"],
      ) +
      U.scopes(existing?.perimeterIds || t.perimeterIds) +
      U.responsible(existing?.responsible || t.responsible, t.perimeterIds) +
      (kind === "indicator"
        ? U.select(
            "obj",
            "Objectif associé",
            (U.state().objectives || []).map((x) => ({
              value: x.id,
              label: x.name,
            })),
            existing?.obj,
          ) + U.field("target", "Cible", existing?.target)
        : "");
    U.dialog("Renseigner · " + t.title, fields, (f) =>
      U.mutate((s) => {
        let r = existing;
        if (!r) {
          if (kind === "action") {
            r = J.ensureAction(s, t.id);
          } else {
            const defaults =
              kind === "objective"
                ? { due: "", owner: "", processes: [], enjeux: [] }
                : kind === "indicator"
                  ? { values: [], target: "", dir: "", obj: "" }
                  : { owner: "" };
            r = {
              ...defaults,
              id: C.id(kind.toUpperCase()),
              createdAt: C.now(),
            };
            I.collections(s)[kind].push(r);
          }
        }
        Object.assign(r, Object.fromEntries(f), {
          perimeterIds: f.getAll("perimeterIds"),
          responsible: U.parseResponsible(f),
        });
        if (r.responsible)
          r.owner =
            s.roles.find((x) => x.id === r.responsible.roleId)?.name || "";
        t.businessRef = { kind, id: r.id };
        if (kind === "indicator" && !r.obj)
          throw Error("Créez ou choisissez d’abord un objectif.");
        C.log(s, "Saisie depuis le parcours", kind, r.id, null, r);
      }),
    );
  }
  function editBusiness(id) {
    const t = J.getTask(U.state(), id),
      ref = t.businessRef,
      kind = ref?.kind || t.businessKind;
    if (["action", "objective", "indicator"].includes(kind) && ref) {
      U.api().openSheet(
        { action: "fd", objective: "obj", indicator: "ind" }[kind],
        ref.id,
      );
      return;
    }
    if (kind === "evaluation") {
      if (!ref)
        throw Error("Rattachez une évaluation existante à cette sous-tâche.");
      U.api().df.openEvaluation(ref.id);
      return;
    }
    if (
      ["perimeter", "role", "proof", "bia", "continuity", "exercise"].includes(
        kind,
      )
    ) {
      binding = {
        taskId: t.id,
        kind,
        ids: I.collections(U.state())[kind].map((x) => x.id),
      };
      if (kind === "perimeter") U.perimeterForm(ref?.id);
      else if (kind === "role") U.roleForm(ref?.id);
      else if (kind === "proof") U.api().df.openProof(ref?.id || "");
      else if (window.LegacyPCRAUI)
        window.LegacyPCRAUI.open(kind, ref?.id, t.perimeterIds);
      else {
        binding = null;
        throw Error(
          "Le module PCRA sera accessible après sa phase d’intégration.",
        );
      }
      return;
    }
    genericBusiness(t, ref);
  }
  function view() {
    const s = J.init(U.state());
    J.reconcile(s);
    if (!s.journey.runs.length)
      return (
        U.header(
          "Parcours guidé",
          "Renseignez vos données dans un parcours relié aux registres existants.",
          U.button("Commencer un parcours", "journey-new", "", true),
        ) +
        U.empty(
          "Un point d’entrée pour votre démarche",
          "Choisissez les établissements et les référentiels. Les données déjà connues seront proposées.",
        )
      );
    const r = run(),
      previous = positions.get(r.id);
    if (
      previous &&
      previous !== r.currentStep &&
      (!U.api().ui.journeyStep || U.api().ui.journeyStep === previous)
    ) {
      U.api().ui.journeyStep =
        r.currentStep === "finished" ? r.steps.at(-1)?.id : r.currentStep;
    }
    positions.set(r.id, r.currentStep);
    const selected =
        U.api().ui.journeyStep ||
        (r.currentStep === "finished" ? r.steps.at(-1)?.id : r.currentStep),
      step = r.steps.find((x) => x.id === selected) || r.steps[0],
      tasks = s.journey.tasks.filter(
        (t) => t.journeyId === r.id && t.stepId === step.id,
      ),
      all = s.journey.tasks.filter((t) => t.journeyId === r.id),
      late = all.filter(
        (t) => t.due && t.due < C.now().slice(0, 10) && t.status !== "Terminé",
      );
    return (
      U.header(
        r.title,
        "Chaque saisie alimente les mêmes objets que les menus unitaires.",
        U.button("Nouveau parcours", "journey-new") +
          U.button("Ajouter une sous-tâche", "journey-task-new", "", true),
      ) +
      U.select(
        "journeyId",
        "Parcours",
        s.journey.runs.map((x) => ({ value: x.id, label: x.title })),
        r.id,
      ).replace(
        '<select name="journeyId">',
        '<select name="journeyId" data-lx-filter="journeyId" data-ro-ok>',
      ) +
      (r.progress === 100
        ? '<p class="lx-card" role="status">Parcours terminé : les données, preuves et validations internes requises sont réunies. Les étapes restent consultables et se rouvrent si leurs conditions changent.</p>'
        : "") +
      `<div class="lx-stats">${U.card("Progression", r.progress + " %", "Étapes validées avec leurs données et preuves")}${U.card("Sous-tâches", all.filter((t) => t.status === "Terminé").length + "/" + all.length, "Terminé ne vaut pas conformité officielle")}${U.card("Retards", late.length, "Actions et sous-tâches avec échéance dépassée")}${U.card("À vérifier", all.filter((t) => t.needsValidation || t.issues?.length).length, "Données, preuves ou validations attendues")}</div><div class="lx-journey"><nav class="lx-steps" aria-label="Étapes du parcours">${r.steps.map((x) => `<button data-lx-act="journey-step" data-step="${x.id}" class="${step.id === x.id ? "on" : ""}"><strong>${U.esc(x.label)}</strong><small>${U.esc(x.status)} · ${x.done}/${x.total}</small></button>`).join("")}</nav><section><h3>${U.esc(step.label)}</h3><p class="lx-muted">${U.esc(J.STEPS.find((x) => x.id === step.id).why)}</p><div class="lx-task-list">${tasks.map((t) => `<article class="lx-card" data-task-id="${t.id}"><div class="lx-actions"><h3>${U.esc(t.title)}</h3>${U.pill(t.status)}</div><p>${U.esc(t.description)}</p><p class="lx-muted">${U.esc(U.scopeLabel(t.perimeterIds))} · ${U.esc(U.ownerLabel(t))}${t.due ? " · " + U.esc(t.due) : ""} · ${U.esc(t.priority)}${t.mandatory ? " · Obligatoire" : " · Facultative"}</p>${t.requirement ? `<p>Exigence ${U.esc(t.requirement.requirementId)} : validation dans le registre du référentiel.</p>` : ""}${(t.issues || []).length ? `<ul class="lx-issues">${t.issues.map((x) => `<li>${U.esc(x)}</li>`).join("")}</ul>` : ""}${t.needsValidation ? '<p class="lx-muted">Une validation humaine est attendue sur les données actuelles.</p>' : ""}<div class="lx-actions">${U.button(t.businessRef ? "Renseigner / modifier les données" : "Renseigner les données", "journey-business", `data-id="${t.id}"`, true)}${U.button("Détails / preuves", "journey-task-edit", `data-id="${t.id}"`)}${t.actionId ? U.button("Ouvrir l’action liée", "journey-action-open", `data-id="${t.id}"`) : U.button("Ajouter au plan d’action", "journey-action", `data-id="${t.id}"`)}${U.button("Marquer réalisé", "journey-complete", `data-id="${t.id}"`)}${LegacyServer.canValidate() ? U.button("Valider les données", "journey-validate", `data-id="${t.id}"`) : ""}${t.status === "Terminé" ? U.button("Réouvrir", "journey-reopen", `data-id="${t.id}"`) : ""}</div></article>`).join("")}</div></section></div>`
    );
  }
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
      U.api().TABS.push({ id: "journey", label: () => "Parcours guidé", view });
    },
    extendNav: (nav) => [
      {
        id: "journey",
        label: "Parcours guidé",
        icon: "pil",
        items: [{ id: "journey-home", label: "Ma démarche", tab: "journey" }],
      },
      ...nav,
    ],
    readActions: ["journey-step", "journey-action-open"],
    afterRender: () => {
      if (binding) {
        const b = binding;
        const object = I.collections(U.state())[b.kind].find(
          (x) => !b.ids.includes(x.id),
        );
        if (object) {
          binding = null;
          const t = J.getTask(U.state(), b.taskId);
          t.businessRef = { kind: b.kind, id: object.id };
          if (!object.perimeterIds?.length)
            object.perimeterIds = [...t.perimeterIds];
          U.api().touch(false);
        }
      }
    },
    click: async (act, el) => {
      if (act === "journey-new") runForm();
      else if (act === "journey-task-new") taskForm();
      else if (act === "journey-task-edit") taskForm(el.dataset.id);
      else if (act === "journey-step") {
        U.api().ui.journeyStep = el.dataset.step;
        U.api().render();
      } else if (act === "journey-business") editBusiness(el.dataset.id);
      else if (act === "journey-action")
        await U.mutate((s) => J.ensureAction(s, el.dataset.id));
      else if (act === "journey-action-open")
        U.api().openSheet("fd", J.getTask(U.state(), el.dataset.id).actionId);
      else if (act === "journey-complete") {
        await U.mutate((s) => J.setStatus(s, el.dataset.id, "Terminé"));
        const r = run();
        U.api().ui.journeyStep = r.currentStep;
        U.api().render();
      } else if (act === "journey-reopen")
        await U.mutate((s) => J.setStatus(s, el.dataset.id, "En cours"));
      else if (act === "journey-validate") {
        if (!LegacyServer.canValidate())
          throw Error("Validation non autorisée.");
        await U.mutate((s) =>
          J.validateTask(s, el.dataset.id, LegacyServer.user().name),
        );
        U.api().ui.journeyStep = run().currentStep;
        U.api().render();
      } else return false;
      return true;
    },
  });
  window.LegacyJourneyUI = { proofPicker, editBusiness };
})();
