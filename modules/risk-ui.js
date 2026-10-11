(function () {
  "use strict";
  const R = LegacyRisks,
    C = LegacyDF,
    I = LegacyIntegration;
  let U;
  const today = () => C.now().slice(0, 10),
    get = (kind, id) => I.object(U.state(), { kind, id }),
    choices = (key) =>
      U.state().riskMgmt[key].map((r) => ({
        value: r.id,
        label: (r.internalId ? r.internalId + " · " : "") + (r.title || r.name),
      })),
    refs = (fd) =>
      fd.getAll("proofRefs").map((v) => {
        const [evidenceId, versionId] = v.split("|");
        return { evidenceId, versionId };
      }),
    proofPicker = (rs) => LegacyJourneyUI.proofPicker(rs || []);
  function riskForm(id, scope = [], studyId) {
    const r = id ? get("risk", id) : {};
    U.dialog(
      id
        ? "Modifier le risque central"
        : "Créer un risque dans le registre central",
      U.field(
        "internalId",
        "Référence automatique",
        r.internalId || "Attribuée à l’enregistrement",
        "text",
        "readonly",
      ) +
        U.field("title", "Titre du risque", r.title, "text", "required") +
        U.area(
          "description",
          "Description et conséquences métier",
          r.description,
        ) +
        U.scopes(r.perimeterIds || scope) +
        U.responsible(r.responsible, r.perimeterIds || scope) +
        U.field("domain", "Domaine de sécurité ou activité", r.domain) +
        U.field("reviewDate", "Prochaine réévaluation", r.reviewDate, "date") +
        U.select(
          "status",
          "Statut du suivi",
          [
            "Ouvert",
            "En traitement",
            "Accepté",
            "Transféré",
            "Évité",
            "Archivé",
          ],
          r.status || "Ouvert",
        ) +
        '<p class="lx-muted">La fiche existe indépendamment des études. Le statut de suivi ne remplace pas une décision formelle d’acceptation.</p>',
      (fd) =>
        U.mutate((s) => {
          const out = R.risk(
            s,
            {
              ...Object.fromEntries(fd),
              perimeterIds: fd.getAll("perimeterIds"),
              responsible: U.parseResponsible(fd),
            },
            id,
          );
          if (studyId) {
            const st = get("riskStudy", studyId);
            st.riskIds = I.unique([...st.riskIds, out.id]);
            I.relate(
              s,
              { kind: "risk", id: out.id },
              { kind: "riskStudy", id: st.id },
            );
          }
          U.api().ui.riskId = out.id;
          U.api().ui.riskView = "register";
        }),
    );
  }
  function studyForm(id) {
    const st = id ? get("riskStudy", id) : {};
    U.dialog(
      id ? "Modifier l’étude" : "Nouvelle étude EBIOS RM / risques",
      U.field("title", "Titre de l’étude", st.title, "text", "required") +
        U.select(
          "method",
          "Méthode déclarée",
          R.METHODS,
          st.method || "EBIOS RM",
        ) +
        U.field("date", "Date de l’étude", st.date || today(), "date") +
        U.scopes(st.perimeterIds) +
        U.responsible(st.responsible, st.perimeterIds) +
        U.multi(
          "riskIds",
          "Risques existants à étudier",
          choices("risks"),
          st.riskIds || [],
        ) +
        U.select(
          "status",
          "État de l’étude",
          ["En cours", "Clôturée", "Archivée"],
          st.status || "En cours",
        ) +
        R.WORKSHOPS.map((label, n) =>
          U.area(
            "workshop" + n,
            "Atelier " + (n + 1) + " · " + label,
            st.workshops?.[n],
          ),
        ).join("") +
        '<p class="lx-muted">Les risques sont référencés, jamais copiés dans l’étude. Les ateliers structurent les travaux ; les échelles restent celles de la politique choisie lors de l’évaluation.</p>',
      (fd) =>
        U.mutate((s) =>
          R.study(
            s,
            {
              ...Object.fromEntries(fd),
              perimeterIds: fd.getAll("perimeterIds"),
              riskIds: I.unique([
                ...(st.riskIds || []),
                ...fd.getAll("riskIds"),
              ]),
              responsible: U.parseResponsible(fd),
              workshops: Object.fromEntries(
                R.WORKSHOPS.map((_, n) => [n, fd.get("workshop" + n)]),
              ),
            },
            id,
          ),
        ),
    );
  }
  function scenarioForm(id) {
    const sc = id ? get("riskScenario", id) : {};
    U.dialog(
      id ? "Modifier le scénario" : "Documenter un scénario",
      U.field("title", "Titre", sc.title, "text", "required") +
        U.select(
          "type",
          "Type",
          [
            "Source de risque",
            "Événement redouté",
            "Stratégique",
            "Opérationnel",
          ],
          sc.type || "Opérationnel",
        ) +
        U.select(
          "studyId",
          "Étude (facultative)",
          choices("studies"),
          sc.studyId,
        ) +
        U.multi(
          "riskIds",
          "Risques concernés",
          choices("risks"),
          sc.riskIds || [],
        ) +
        U.scopes(sc.perimeterIds) +
        U.area("description", "Description / déroulement", sc.description) +
        U.area("source", "Source de risque et objectifs visés", sc.source) +
        U.area("fearedEvent", "Événement redouté", sc.fearedEvent) +
        U.area(
          "supportingAssets",
          "Biens supports et dépendances",
          sc.supportingAssets,
        ) +
        U.select(
          "parentScenarioId",
          "Scénario lié en amont",
          choices("scenarios").filter((x) => x.value !== id),
          sc.parentScenarioId,
        ),
      (fd) =>
        U.mutate((s) =>
          R.scenario(
            s,
            {
              ...Object.fromEntries(fd),
              riskIds: fd.getAll("riskIds"),
              perimeterIds: fd.getAll("perimeterIds"),
            },
            id,
          ),
        ),
    );
  }
  function assessmentForm(riskId) {
    const r = get("risk", riskId),
      ps = U.state().riskMgmt.policies.filter((p) =>
        R.covers(U.state(), p.perimeterIds, r.perimeterIds),
      );
    if (!ps.length)
      throw Error(
        "Créez une politique d’appréciation couvrant ce risque dans Risques → Politiques.",
      );
    const p = ps[0];
    const fields = (pol) =>
      U.select(
        "impactId",
        "Gravité / impact selon la politique",
        pol.impactScale.map((x) => ({ value: x.id, label: x.label })),
      ) +
      U.select(
        "likelihoodId",
        "Vraisemblance selon la politique",
        pol.likelihoodScale.map((x) => ({ value: x.id, label: x.label })),
      ) +
      U.select(
        "levelId",
        pol.calculation === "matrix"
          ? "Niveau calculé par la matrice"
          : "Niveau retenu et justifié",
        pol.levels.map((x) => ({ value: x.id, label: x.label })),
      ) +
      `<p class="lx-muted">${U.esc(pol.method)} · ${U.esc(pol.title)} v${pol.version}. ${pol.calculation === "manual" ? "Appréciation explicite ; aucune formule uniforme imposée." : "La matrice configurée calcule le niveau côté serveur."}</p>`;
    U.dialog(
      "Nouvelle évaluation historisée · " + r.title,
      U.select(
        "policyId",
        "Méthode / politique versionnée",
        ps.map((p) => ({
          value: p.id,
          label: p.method + " · " + p.title + " v" + p.version,
        })),
        p.id,
      ) +
        U.select(
          "studyId",
          "Étude (facultative)",
          U.state()
            .riskMgmt.studies.filter(
              (st) =>
                st.status === "En cours" &&
                R.covers(U.state(), st.perimeterIds, r.perimeterIds),
            )
            .map((st) => ({ value: st.id, label: st.title })),
        ) +
        U.select(
          "stage",
          "Niveau évalué",
          [
            { value: "initial", label: "Initial / brut" },
            { value: "residual", label: "Résiduel après traitement" },
          ],
          "initial",
        ) +
        U.field("date", "Date de l’évaluation", today(), "date") +
        '<div id="risk-result-fields">' +
        fields(p) +
        "</div>" +
        U.area("justification", "Justification de l’appréciation") +
        U.area("results", "Résultats détaillés et dimensions d’impact") +
        U.multi(
          "scenarioIds",
          "Scénarios documentés",
          U.state().riskMgmt.scenarios.filter((sc) =>
            sc.riskIds.includes(r.id),
          ),
          [],
        ) +
        proofPicker([]) +
        (LegacyServer.canValidate()
          ? '<label><input name="reference" type="checkbox" checked>Définir comme évaluation de référence pour ce niveau</label>'
          : '<p class="lx-muted">Un validateur désignera l’évaluation de référence.</p>'),
      (fd) =>
        U.mutate((s) => {
          const a = R.assessment(
            s,
            {
              ...Object.fromEntries(fd),
              riskId,
              scenarioIds: fd.getAll("scenarioIds"),
              proofRefs: refs(fd),
            },
            LegacyServer.user().name,
          );
          if (fd.has("reference")) R.reference(s, riskId, a.id);
        }),
    );
    const d = document.getElementById("lx-dialog");
    function refresh() {
      const pol = get("riskPolicy", d.querySelector("[name=policyId]").value);
      d.querySelector("#risk-result-fields").innerHTML = fields(pol);
      const bind = () => {
        if (pol.calculation === "matrix") {
          const level =
            pol.matrix[
              d.querySelector("[name=impactId]").value +
                ":" +
                d.querySelector("[name=likelihoodId]").value
            ];
          d.querySelector("[name=levelId]").value = level || "";
          d.querySelector("[name=levelId]").disabled = true;
        }
      };
      d.querySelector("[name=impactId]").onchange = bind;
      d.querySelector("[name=likelihoodId]").onchange = bind;
      bind();
    }
    d.querySelector("[name=policyId]").onchange = refresh;
    refresh();
  }
  function decisionForm(riskId) {
    const r = get("risk", riskId);
    U.dialog(
      "Décision formelle · " + r.title,
      U.select(
        "assessmentId",
        "Évaluation examinée",
        U.state()
          .riskMgmt.assessments.filter((a) => a.riskId === riskId)
          .map((a) => ({
            value: a.id,
            label:
              a.date +
              " · " +
              a.method +
              " · " +
              (a.stage === "initial" ? "Initial" : "Résiduel") +
              " · " +
              (a.internalId || a.id),
          })),
      ) +
        U.select(
          "kind",
          "Décision",
          ["Accepter", "Réduire", "Transférer", "Éviter", "Réévaluer"],
          "Accepter",
        ) +
        U.field("date", "Date", today(), "date") +
        U.field("validUntil", "Date limite / nouvelle revue", "", "date") +
        U.area("justification", "Justification et conditions de la décision") +
        proofPicker([]),
      (fd) =>
        U.mutate((s) =>
          R.decision(
            s,
            { ...Object.fromEntries(fd), riskId, proofRefs: refs(fd) },
            LegacyServer.user().name,
          ),
        ),
    );
  }
  function treatmentForm(id, riskId) {
    const t = id ? get("riskTreatment", id) : {};
    U.dialog(
      id ? "Modifier le plan" : "Plan de traitement",
      U.field("title", "Titre", t.title, "text", "required") +
        U.select(
          "riskId",
          "Risque central",
          choices("risks"),
          t.riskId || riskId,
        ) +
        U.select(
          "strategy",
          "Stratégie",
          ["Réduire", "Accepter", "Transférer", "Éviter"],
          t.strategy || "Réduire",
        ) +
        U.area("description", "Objectifs et conditions", t.description) +
        U.responsible(t.responsible, t.perimeterIds) +
        U.field("due", "Échéance", t.due, "date") +
        U.select(
          "status",
          "Suivi",
          ["En cours", "Terminé", "Suspendu"],
          t.status || "En cours",
        ),
      (fd) =>
        U.mutate((s) =>
          R.treatment(
            s,
            { ...Object.fromEntries(fd), responsible: U.parseResponsible(fd) },
            id,
          ),
        ),
    );
  }
  function measureForm(id, treatmentId) {
    const m = id ? get("riskMeasure", id) : {};
    U.dialog(
      id ? "Modifier la mesure" : "Mesure de traitement",
      U.field("title", "Titre", m.title, "text", "required") +
        U.select(
          "treatmentId",
          "Plan de traitement",
          choices("treatments"),
          m.treatmentId || treatmentId,
        ) +
        U.area("description", "Réalisation attendue", m.description) +
        U.responsible(m.responsible, m.perimeterIds) +
        U.field("due", "Échéance", m.due, "date") +
        U.multi(
          "controlIds",
          "Mesures ISO/HDS existantes (liens explicites)",
          U.state().items.map((i) => ({
            value: i.id,
            label: i.id + " · " + i.title,
          })),
          m.controlIds || [],
        ) +
        proofPicker(m.proofRefs),
      (fd) =>
        U.mutate((s) =>
          R.measure(
            s,
            {
              ...Object.fromEntries(fd),
              responsible: U.parseResponsible(fd),
              controlIds: fd.getAll("controlIds"),
              proofRefs: refs(fd),
            },
            id,
          ),
        ),
    );
  }
  function policyForm(id) {
    const old = id ? get("riskPolicy", id) : null,
      p = old || R.DEFAULT_POLICY;
    U.dialog(
      "Politique d’appréciation · nouvelle version",
      U.field("title", "Nom de la politique", p.title, "text", "required") +
        U.select("method", "Méthode déclarée", R.METHODS, p.method) +
        U.scopes(old?.perimeterIds) +
        U.area(
          "description",
          "Règles méthodologiques et critères de décision",
          p.description,
        ) +
        U.area(
          "impactScale",
          "Gravité / impact · un libellé par ligne",
          p.impactScale.map((x) => x.label).join("\n"),
        ) +
        U.area(
          "likelihoodScale",
          "Vraisemblance · un libellé par ligne",
          p.likelihoodScale.map((x) => x.label).join("\n"),
        ) +
        U.area(
          "levels",
          "Niveaux · libellé ; couleur hexadécimale ; acceptabilité",
          p.levels
            .map((x) => [x.label, x.color, x.acceptability].join(" ; "))
            .join("\n"),
        ) +
        U.select(
          "calculation",
          "Appréciation du niveau",
          [
            {
              value: "manual",
              label: "Appréciation justifiée, sans formule imposée",
            },
            { value: "matrix", label: "Matrice de décision explicite" },
          ],
          p.calculation,
        ) +
        '<div id="risk-policy-matrix"></div><p class="lx-muted">Ces échelles sont des choix internes. Les méthodes ne sont pas ramenées à un produit unique. Les versions existantes restent immuables.</p>',
      (fd) =>
        U.mutate((s) => {
          const scale = (key, prefix) =>
            fd
              .get(key)
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
              .map((label, n) => ({ id: prefix + (n + 1), label }));
          const levels = fd
            .get("levels")
            .split("\n")
            .filter((x) => x.trim())
            .map((line, n) => {
              const [label, color, acceptability] = line
                .split(";")
                .map((x) => x.trim());
              return {
                id: "L" + (n + 1),
                label,
                color,
                acceptability: acceptability || "À examiner",
              };
            });
          R.policy(s, {
            ...Object.fromEntries(fd),
            previousId: id || null,
            perimeterIds: fd.getAll("perimeterIds"),
            impactScale: scale("impactScale", "I"),
            likelihoodScale: scale("likelihoodScale", "V"),
            levels,
            matrix: Object.fromEntries(
              [...fd]
                .filter(([k]) => k.startsWith("matrix:"))
                .map(([k, v]) => [k.slice(7), v]),
            ),
          });
        }),
    );
    const d = document.getElementById("lx-dialog");
    const draw = () => {
      const selected = Object.fromEntries(
        [...d.querySelectorAll('[name^="matrix:"]')].map((el) => [
          el.name.slice(7),
          el.value,
        ]),
      );
      const impacts = d
          .querySelector("[name=impactScale]")
          .value.split("\n")
          .filter((x) => x.trim()),
        likes = d
          .querySelector("[name=likelihoodScale]")
          .value.split("\n")
          .filter((x) => x.trim()),
        levels = d
          .querySelector("[name=levels]")
          .value.split("\n")
          .filter((x) => x.trim())
          .map((x, n) => ({
            value: "L" + (n + 1),
            label: x.split(";")[0].trim(),
          }));
      d.querySelector("#risk-policy-matrix").innerHTML =
        d.querySelector("[name=calculation]").value === "matrix"
          ? '<div class="lx-form-grid">' +
            impacts
              .flatMap((impact, i) =>
                likes.map((like, v) =>
                  U.select(
                    "matrix:I" + (i + 1) + ":V" + (v + 1),
                    impact.trim() + " / " + like.trim(),
                    levels,
                    selected["I" + (i + 1) + ":V" + (v + 1)] ??
                      p.matrix?.["I" + (i + 1) + ":V" + (v + 1)],
                  ),
                ),
              )
              .join("") +
            "</div>"
          : "";
    };
    for (const name of [
      "calculation",
      "impactScale",
      "likelihoodScale",
      "levels",
    ])
      d.querySelector("[name=" + name + "]").addEventListener("change", draw);
    draw();
  }
  function result(a) {
    if (!a) return "Non évalué";
    const p = get("riskPolicy", a.policyId);
    return (
      (p.levels.find((l) => l.id === a.levelId)?.label || "—") +
      " · " +
      a.date +
      " · " +
      p.method +
      " / " +
      p.title +
      " v" +
      p.version
    );
  }
  function history(record) {
    if (!record.history?.length) return "";
    return `<details><summary>Historique · ${record.history.length} opération(s)</summary>${record.history.map((event) => `<p>${U.esc(event.at)} · ${U.esc(event.actor)} · ${U.esc(event.operation || "Modification")}<small>${U.esc((event.fields || []).join(", "))}</small>${event.snapshot ? `<details><summary>Version précédente</summary><pre class="lx-history">${U.esc(JSON.stringify(event.snapshot, null, 2))}</pre></details>` : ""}</p>`).join("")}</details>`;
  }
  function detail(r) {
    const s = U.state(),
      as = s.riskMgmt.assessments.filter((a) => a.riskId === r.id),
      ds = s.riskMgmt.decisions.filter((d) => d.riskId === r.id);
    const reference = (stage) =>
      as.find((a) => a.id === r.referenceEvaluationIds?.[stage]);
    return (
      U.header(
        r.title,
        (r.internalId || "Référence en cours") +
          " · " +
          U.scopeLabel(r.perimeterIds),
        U.button("Retour au registre", "risk-back") +
          U.button("Modifier", "risk-edit", `data-id="${r.id}"`) +
          U.button("Évaluer", "risk-assess", `data-id="${r.id}"`, true) +
          (LegacyServer.canValidate()
            ? U.button("Décision", "risk-decision", `data-id="${r.id}"`)
            : "") +
          U.button(
            "Plan de traitement",
            "risk-treatment-new",
            `data-id="${r.id}"`,
          ),
      ) +
      `<p>${U.esc(r.description)}</p>${history(r)}<p>${U.pill(r.status)} · ${U.esc(U.ownerLabel(r))} · Revue ${U.esc(r.reviewDate || "À définir")}</p>${r.needsReview ? '<p class="lx-issues">Le contexte du risque a changé : réévaluation à examiner.</p>' : ""}<div class="lx-stats">${U.card("Initial / brut", result(reference("initial")), "Référence explicite")}${U.card("Résiduel", result(reference("residual")), "Réévaluation nécessaire après traitement")}${U.card("Accepté", result(as.find((a) => a.id === ds.find((d) => d.id === r.acceptedDecisionId)?.assessmentId)), "Décision formelle, distincte du statut de suivi")}</div><section class="lx-card"><h3>Évaluations historisées</h3><div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Évaluation / méthode</th><th>Date / auteur</th><th>Étude</th><th>Résultat</th><th>Référence</th></tr></thead><tbody>${as.map((a) => `<tr><td>${U.esc(a.internalId || a.id)}<small>${U.esc(a.method)} · ${a.stage === "initial" ? "Initial" : "Résiduel"}</small></td><td>${U.esc(a.date)}<small>${U.esc(a.author)}</small></td><td>${U.esc(s.riskMgmt.studies.find((st) => st.id === a.studyId)?.title || (a.studyId ? "Étude hors périmètre de consultation" : "Indépendante"))}</td><td>${U.esc(result(a))}<small>${U.esc(a.justification)}</small>${U.esc(a.results)}</td><td>${r.referenceEvaluationIds?.[a.stage] === a.id ? U.pill("Référence actuelle") : LegacyServer.canValidate() ? U.button("Choisir la référence", "risk-reference", `data-risk="${r.id}" data-id="${a.id}"`) : "Historique"}</td></tr>`).join("") || '<tr><td colspan="5">Aucune évaluation.</td></tr>'}</tbody></table></div></section><section class="lx-card"><h3>Décisions</h3>${ds.map((d) => `<p>${U.esc(d.date + " · " + d.kind + " · " + d.author)} · ${U.esc(d.justification)}<small>${d.validUntil ? "Valide jusqu’au " + U.esc(d.validUntil) : "Durée non définie"} · ${U.esc(result(as.find((a) => a.id === d.assessmentId)))}</small></p>`).join("") || "<p>Aucune décision formelle.</p>"}</section><section class="lx-card"><h3>Études et scénarios associés</h3>${s.riskMgmt.studies
        .filter((st) => st.riskIds.includes(r.id))
        .map(
          (st) =>
            `<p>${U.esc(st.title)} · ${U.esc(st.status)} ${U.button("Ouvrir", "risk-study-open", `data-id="${st.id}"`)}</p>`,
        )
        .join("")}${s.riskMgmt.scenarios
        .filter((sc) => sc.riskIds.includes(r.id))
        .map(
          (sc) =>
            `<p>${U.esc(sc.type + " · " + sc.title + " : " + sc.description)}</p>`,
        )
        .join(
          "",
        )}</section>${plansForRisk(r)}<section class="lx-card">${U.button("Liens et preuves partagés", "object-relations", `data-kind="risk" data-id="${r.id}"`)}</section>`
    );
  }
  function plansForRisk(r) {
    const s = U.state(),
      plans = s.riskMgmt.treatments.filter((t) => t.riskId === r.id);
    return `<section class="lx-card"><h3>Traitements et mesures du risque</h3>${
      plans
        .map(
          (t) =>
            `<article><h4>${U.esc(t.internalId + " · " + t.title)}</h4><p>${U.esc(t.strategy + " · " + t.status)}</p>${U.button("Consulter / modifier le plan", "risk-treatment-edit", `data-id="${t.id}"`)}${history(t)}${s.riskMgmt.measures
              .filter((m) => m.treatmentId === t.id)
              .map(
                (m) =>
                  `<p>${U.esc(m.internalId + " · " + m.title)} · ${m.proofRefs?.length || 0} preuve(s) · ${U.esc(s.findings.find((a) => a.id === m.actionId)?.status || "Action à créer")}${m.actionId ? U.button("Ouvrir l’action", "risk-action-open", `data-id="${m.id}"`) : ""}${U.button("Liens et preuves", "object-relations", `data-kind="riskMeasure" data-id="${m.id}"`)}</p>`,
              )
              .join("")}</article>`,
        )
        .join("") || "<p>Aucun plan de traitement défini.</p>"
    }<p class="lx-muted">Une clôture d’action conserve la référence résiduelle : réévaluer le risque pour la faire évoluer.</p></section>`;
  }
  function filters() {
    const ui = U.api().ui;
    return (
      '<div class="lx-form-grid">' +
      U.select(
        "riskMapStage",
        "Niveau affiché",
        [
          { value: "initial", label: "Initial / brut" },
          { value: "residual", label: "Résiduel" },
          { value: "accepted", label: "Accepté par décision" },
        ],
        ui.riskMapStage || "initial",
      ).replace(
        '<select name="riskMapStage">',
        '<select name="riskMapStage" data-lx-filter="riskMapStage" data-ro-ok>',
      ) +
      U.select(
        "riskMapPerimeter",
        "Consolidation GHT / établissement",
        [
          { value: "", label: "Tous mes périmètres autorisés" },
          ...U.state().perimeters.map((p) => ({ value: p.id, label: p.name })),
        ],
        ui.riskMapPerimeter || "",
      ).replace(
        '<select name="riskMapPerimeter">',
        '<select name="riskMapPerimeter" data-lx-filter="riskMapPerimeter" data-ro-ok>',
      ) +
      U.select(
        "riskMapStatus",
        "Statut",
        [
          { value: "", label: "Tous" },
          ...[
            "Ouvert",
            "En traitement",
            "Accepté",
            "Transféré",
            "Évité",
            "Archivé",
          ],
        ],
        ui.riskMapStatus || "",
      ).replace(
        '<select name="riskMapStatus">',
        '<select name="riskMapStatus" data-lx-filter="riskMapStatus" data-ro-ok>',
      ) +
      `<label class="lx-field">Rechercher<input data-lx-query="riskMapQuery" data-ro-ok value="${U.esc(ui.riskMapQuery || "")}"></label></div>`
    );
  }
  function mapRows() {
    const ui = U.api().ui;
    return R.rows(U.state(), {
      stage: ui.riskMapStage || "initial",
      perimeterId: ui.riskMapPerimeter || "",
      status: ui.riskMapStatus || "",
      query: ui.riskMapQuery || "",
    });
  }
  function ink(color) {
    const rgb = [1, 3, 5]
      .map((n) => parseInt(color.slice(n, n + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
      ? "#000000"
      : "#ffffff";
  }
  function mapView() {
    const rows = mapRows(),
      groups = new Map();
    for (const row of rows) {
      const key = row.policy?.id || "none";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return (
      U.header(
        "Cartographie centrale des risques",
        "Uniquement les évaluations de référence. Les méthodes et versions sont regroupées séparément.",
        U.button("Excel", "risk-export") +
          U.button("Rapport / PDF", "risk-report"),
      ) +
      filters() +
      `<div class="map">${
        [...groups]
          .map(([key, rs]) => {
            const p = rs[0].policy;
            return `<section class="lx-card"><h3>${U.esc(p ? p.method + " · " + p.title + " v" + p.version : "Risques sans évaluation de référence")}</h3><ul class="legend">${(p?.levels || []).map((l) => `<li><span class="sw" style="background:${l.color}"></span>${U.esc(l.label + " · " + l.acceptability)}</li>`).join("")}</ul>${(
              p?.levels || [
                { id: "none", label: "À évaluer", color: "#eff2ef" },
              ]
            )
              .map((l) => {
                const matching = rs.filter(
                  (row) => (row.level?.id || "none") === l.id,
                );
                return `<div class="mrow"><div class="ml">${U.esc(l.label)}<span>${matching.length} risque(s)</span></div><div class="tiles">${matching.map((row) => U.api().mapTile("na", (row.risk.internalId || "RISK") + " · " + row.risk.title, row.risk.title + " — " + result(row.assessment) + (row.acceptanceExpired ? " — Acceptation expirée" : ""), "risk-open", `data-id="${row.risk.id}" style="background:${l.color};color:${ink(l.color)};width:auto;height:auto;min-height:34px;line-height:1.4;min-width:90px;max-width:100%;padding:10px;white-space:normal"`)).join("") || '<span class="lx-muted">Aucun risque.</span>'}</div></div>`;
              })
              .join("")}</section>`;
          })
          .join("") ||
        U.empty(
          "Aucun risque dans ce filtre",
          "Créez un risque puis définissez son évaluation de référence.",
        )
      }</div>`
    );
  }
  function exportMap(pdf = false) {
    const rows = mapRows().map((row) => ({
      Référence: row.risk.internalId,
      Risque: row.risk.title,
      Périmètres: U.scopeLabel(row.risk.perimeterIds),
      Statut: row.risk.status,
      Niveau: row.level?.label || "Non évalué",
      Acceptabilité: row.level?.acceptability || "",
      Méthode: row.policy?.method || "",
      Politique: row.policy ? row.policy.title + " v" + row.policy.version : "",
      Évaluation: row.assessment?.internalId || "",
      Date: row.assessment?.date || "",
      Auteur: row.assessment?.author || "",
      Justification: row.assessment?.justification || "",
      Impact:
        row.policy?.impactScale.find((i) => i.id === row.assessment?.impactId)
          ?.label || "",
      Vraisemblance:
        row.policy?.likelihoodScale.find(
          (i) => i.id === row.assessment?.likelihoodId,
        )?.label || "",
      Acceptation: row.decision?.justification || "",
      Validité: row.decision?.validUntil || "",
      "Acceptation expirée": row.acceptanceExpired ? "Oui" : "Non",
    }));
    if (pdf) {
      const win = window.open("", "_blank");
      if (!win) throw Error("Autorisez la fenêtre du rapport.");
      win.document.write(
        '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Cartographie des risques</title><style>body{font:14px sans-serif}article{break-inside:avoid;border:1px solid #ddd;margin:20px;padding:16px}td,th{padding:5px;text-align:left}@media print{button{display:none}}</style><button onclick="print()">Imprimer / PDF</button><h1>Cartographie consolidée des risques</h1><p>Évaluations de référence explicites, méthodes et politiques distinctes. ' +
          U.esc(today()) +
          "</p>" +
          rows
            .map(
              (r) =>
                "<article><table>" +
                Object.entries(r)
                  .map(
                    ([k, v]) =>
                      "<tr><th>" +
                      U.esc(k) +
                      "</th><td>" +
                      U.esc(v) +
                      "</td></tr>",
                  )
                  .join("") +
                "</table></article>",
            )
            .join("") +
          "</html>",
      );
      win.document.close();
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          rows.map((r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) => [k, C.spreadsheetText(v)]),
            ),
          ),
        ),
        "Risques de référence",
      );
      XLSX.writeFile(wb, "Cartographie-risques.xlsx");
    }
  }
  function view() {
    const s = R.init(U.state()),
      v = U.api().ui.riskView || "register";
    if (v === "map") return mapView();
    if (v === "register") {
      const r = s.riskMgmt.risks.find((r) => r.id === U.api().ui.riskId);
      if (r) return detail(r);
      return (
        U.header(
          "Registre central des risques",
          "Une fiche par risque, indépendante des études ; historique et références explicites.",
          U.button("Créer un risque", "risk-new", "", true),
        ) +
        filters() +
        `<div class="lx-list">${
          mapRows()
            .map(
              ({ risk: r, assessment: a }) =>
                `<article class="lx-card"><h3>${U.esc(r.internalId || "Référence en cours")} · ${U.esc(r.title)}</h3><p>${U.esc(U.scopeLabel(r.perimeterIds))} · ${U.pill(r.status)}</p><p>${U.esc(result(a))}</p>${U.button("Consulter", "risk-open", `data-id="${r.id}"`)}</article>`,
            )
            .join("") ||
          U.empty(
            "Registre vide",
            "Ajoutez les risques de votre établissement, avec ou sans étude.",
          )
        }</div>`
      );
    }
    if (v === "studies") {
      const st = s.riskMgmt.studies.find(
        (st) => st.id === U.api().ui.riskStudyId,
      );
      if (st)
        return (
          U.header(
            st.title,
            (st.internalId || "") + " · " + st.method + " · " + st.status,
            U.button("Toutes les études", "risk-studies-back") +
              U.button(
                "Modifier / archiver",
                "risk-study-edit",
                `data-id="${st.id}"`,
              ) +
              (st.status === "En cours"
                ? U.button(
                    "Créer un risque central",
                    "risk-study-risk-new",
                    `data-id="${st.id}"`,
                  )
                : ""),
          ) +
          `<p>${U.esc(U.scopeLabel(st.perimeterIds))}</p><div class="lx-list">${R.WORKSHOPS.map((label, n) => `<section class="lx-card"><h3>Atelier ${n + 1} · ${U.esc(label)}</h3><p>${U.esc(st.workshops?.[n] || "À documenter")}</p></section>`).join("")}</div><section class="lx-card"><h3>Risques du registre associés</h3>${
            st.riskIds
              .map((id) => s.riskMgmt.risks.find((r) => r.id === id))
              .filter(Boolean)
              .map(
                (r) =>
                  `<p>${U.esc(r.internalId + " · " + r.title)} ${U.button("Consulter le risque", "risk-open", `data-id="${r.id}"`)}</p>`,
              )
              .join("") || "<p>Aucun risque lié.</p>"
          }<p>${s.riskMgmt.assessments.filter((a) => a.studyId === st.id).length} évaluation(s) historisée(s). Archiver cette étude conserve ces évaluations et les risques.</p></section>`
        );
      return (
        U.header(
          "Études EBIOS RM et appréciation des risques",
          "Réutilisez les risques centraux dans plusieurs études successives.",
          U.button("Créer une étude", "risk-study-new", "", true),
        ) +
        `<div class="lx-list">${s.riskMgmt.studies.map((st) => `<article class="lx-card"><h3>${U.esc(st.internalId || "")} · ${U.esc(st.title)}</h3><p>${U.esc(st.method + " · " + st.date + " · " + st.status)}</p><p>${st.riskIds.length} risque(s) du registre central</p>${U.button("Ouvrir l’étude", "risk-study-open", `data-id="${st.id}"`)}</article>`).join("") || U.empty("Aucune étude", "Les risques peuvent être créés avant leur étude.")}</div>`
      );
    }
    if (v === "scenarios")
      return (
        U.header(
          "Scénarios et sources de risque",
          "Sources, événements redoutés, scénarios stratégiques et opérationnels.",
          U.button("Ajouter un scénario", "risk-scenario-new", "", true),
        ) +
        `<div class="lx-list">${s.riskMgmt.scenarios.map((sc) => `<article class="lx-card"><h3>${U.esc(sc.internalId || "")} · ${U.esc(sc.title)}</h3><p>${U.esc(sc.type + " · " + sc.description)}</p><p>${U.esc(sc.source)} · ${U.esc(sc.fearedEvent)} · ${U.esc(sc.supportingAssets)}</p>${U.button("Modifier", "risk-scenario-edit", `data-id="${sc.id}"`)}${U.button("Liens", "object-relations", `data-kind="riskScenario" data-id="${sc.id}"`)}</article>`).join("") || U.empty("Aucun scénario", "Documentez les relations entre scénarios et risques.")}</div>`
      );
    if (v === "treatments")
      return (
        U.header(
          "Plans de traitement et mesures",
          "Les actions réutilisent le plan central. Leur clôture ne recalcule pas le risque résiduel.",
          U.button("Créer un plan", "risk-treatment-new", "", true),
        ) +
        `<div class="lx-list">${
          s.riskMgmt.treatments
            .map(
              (t) =>
                `<article class="lx-card"><h3>${U.esc(t.internalId || "")} · ${U.esc(t.title)}</h3><p>${U.esc(t.strategy + " · " + t.status)} · ${U.esc(s.riskMgmt.risks.find((r) => r.id === t.riskId)?.title)}</p>${U.button("Consulter le risque", "risk-open", `data-id="${t.riskId}"`)}${U.button("Modifier", "risk-treatment-edit", `data-id="${t.id}"`)}${U.button("Ajouter une mesure", "risk-measure-new", `data-id="${t.id}"`)}${history(t)}${s.riskMgmt.measures
                  .filter((m) => m.treatmentId === t.id)
                  .map(
                    (m) =>
                      `<section class="lx-card"><strong>${U.esc(m.internalId || "")} · ${U.esc(m.title)}</strong><p>${U.esc(m.description)}</p>${history(m)}<p>${U.pill(s.findings.find((a) => a.id === m.actionId)?.status || "Action à créer")}</p>${U.button("Modifier / preuves", "risk-measure-edit", `data-id="${m.id}"`)}${U.button(m.actionId ? "Ouvrir l’action" : "Créer l’action centrale", m.actionId ? "risk-action-open" : "risk-action", `data-id="${m.id}"`)}</section>`,
                  )
                  .join("")}</article>`,
            )
            .join("") ||
          U.empty(
            "Aucun plan de traitement",
            "Définissez les moyens et actions pour chaque risque.",
          )
        }</div>`
      );
    return (
      U.header(
        "Politiques méthodologiques versionnées",
        "Méthodes, échelles, matrice éventuelle, niveaux et couleurs propres à chaque politique.",
        LegacyServer.canValidate()
          ? U.button("Nouvelle politique", "risk-policy-new", "", true)
          : "",
      ) +
      `<div class="lx-list">${s.riskMgmt.policies.map((p) => `<article class="lx-card"><h3>${U.esc(p.title)} v${p.version}</h3><p>${U.esc(p.method + " · " + (p.calculation === "manual" ? "Appréciation justifiée" : "Matrice explicite"))}</p><p>${U.esc(U.scopeLabel(p.perimeterIds))}</p><p>${U.esc(p.description)}</p>${LegacyServer.canValidate() ? U.button("Créer une nouvelle version", "risk-policy-version", `data-id="${p.id}"`) : ""}</article>`).join("") || U.empty("Aucune politique", "Définissez des échelles internes adaptées à vos activités.")}</div>`
    );
  }
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
      U.api().TABS.push({ id: "risks", label: () => "Risques", view });
      U.api().NAV_DEF.riskView = "register";
    },
    extendNav: (nav) => [
      {
        id: "risks",
        label: "Risques et études EBIOS RM",
        icon: "pil",
        items: [
          ["register", "Registre central"],
          ["map", "Cartographie consolidée"],
          ["studies", "Études EBIOS RM"],
          ["scenarios", "Scénarios"],
          ["treatments", "Traitements et mesures"],
          ["policies", "Politiques méthodologiques"],
        ].map(([v, label]) => ({
          id: "risk-" + v,
          label,
          tab: "risks",
          set: { riskView: v, riskId: "", riskStudyId: "" },
          match: { riskView: v },
        })),
      },
      ...nav,
    ],
    readActions: [
      "risk-open",
      "risk-back",
      "risk-study-open",
      "risk-studies-back",
      "risk-action-open",
      "risk-export",
      "risk-report",
    ],
    click: async (act, el) => {
      const id = el.dataset.id;
      if (act === "risk-new") riskForm();
      else if (act === "risk-edit") riskForm(id);
      else if (act === "risk-open") {
        U.api().navigate("risks", { riskView: "register", riskId: id });
      } else if (act === "risk-back")
        U.api().navigate("risks", { riskView: "register", riskId: "" });
      else if (act === "risk-assess") assessmentForm(id);
      else if (act === "risk-reference") {
        if (!LegacyServer.canValidate())
          throw Error("Validation non autorisée.");
        await U.mutate((s) => R.reference(s, el.dataset.risk, id));
      } else if (act === "risk-decision") {
        if (!LegacyServer.canValidate())
          throw Error("Validation non autorisée.");
        decisionForm(id);
      } else if (act === "risk-study-new") studyForm();
      else if (act === "risk-study-edit") studyForm(id);
      else if (act === "risk-study-open")
        U.api().navigate("risks", { riskView: "studies", riskStudyId: id });
      else if (act === "risk-studies-back")
        U.api().navigate("risks", { riskView: "studies", riskStudyId: "" });
      else if (act === "risk-study-risk-new")
        riskForm("", get("riskStudy", id).perimeterIds, id);
      else if (act === "risk-scenario-new") scenarioForm();
      else if (act === "risk-scenario-edit") scenarioForm(id);
      else if (act === "risk-treatment-new") treatmentForm("", id);
      else if (act === "risk-treatment-edit") treatmentForm(id);
      else if (act === "risk-measure-new") measureForm("", id);
      else if (act === "risk-measure-edit") measureForm(id);
      else if (act === "risk-action") await U.mutate((s) => R.action(s, id));
      else if (act === "risk-action-open")
        U.api().openSheet("fd", get("riskMeasure", id).actionId);
      else if (act === "risk-policy-new" || act === "risk-policy-version") {
        if (!LegacyServer.canValidate())
          throw Error("Validation non autorisée.");
        policyForm(id);
      } else if (act === "risk-export") exportMap();
      else if (act === "risk-report") exportMap(true);
      else return false;
      return true;
    },
  });
  window.LegacyRiskUI = {
    open: (kind, id, ids) =>
      kind === "risk"
        ? riskForm(id, ids)
        : kind === "riskStudy"
          ? studyForm(id)
          : kind === "riskTreatment"
            ? treatmentForm(id)
            : measureForm(id),
  };
})();
