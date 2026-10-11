(function () {
  "use strict";
  const P = LegacyPCRA,
    C = LegacyDF,
    I = LegacyIntegration;
  let U;
  const get = (kind, id) => I.object(U.state(), { kind, id }),
    picker = (refs) => LegacyJourneyUI.proofPicker(refs);
  function biaForm(id, ids = []) {
    const b = id ? get("bia", id) : null;
    U.dialog(
      id ? "Modifier le BIA" : "Créer une analyse d’impact sur l’activité",
      U.field("title", "Nom du BIA", b?.title, "text", "required") +
        U.scopes(b?.perimeterIds || ids) +
        U.responsible(b?.responsible, b?.perimeterIds || ids) +
        U.select(
          "policyId",
          "Politique d’impact versionnée (vide : échelles internes de départ)",
          U.state().pcra.policies.map((p) => ({
            value: p.id,
            label: p.title + " · v" + p.version,
          })),
          b?.policyId,
        ) +
        U.field(
          "analysisDate",
          "Date d’analyse",
          b?.analysisDate || b?.createdAt?.slice(0, 10) || C.now().slice(0, 10),
          "date",
        ) +
        U.field("reviewDate", "Prochaine revue", b?.reviewDate, "date") +
        U.area("notes", "Contexte et justification du périmètre", b?.notes) +
        picker(b?.proofRefs || []) +
        '<p class="lx-muted">Les activités et leurs impacts seront renseignés dans la fiche BIA. Les échelles internes sont configurables ; elles ne sont pas présentées comme des seuils ANS.</p>',
      (fd) =>
        U.mutate((s) => {
          const f = {
            ...Object.fromEntries(fd),
            perimeterIds: fd.getAll("perimeterIds"),
            responsible: U.parseResponsible(fd),
            proofRefs: refs(fd),
          };
          if (!f.policyId) {
            f.policyId = P.policy(s, {
              ...C.clone(P.DEFAULT_POLICY),
              perimeterIds: f.perimeterIds,
            }).id;
          }
          const out = P.saveBia(s, f, id);
          U.api().ui.pcraView = "bias";
          U.api().ui.biaId = out.id;
        }),
    );
  }
  const refs = (fd) =>
    fd.getAll("proofRefs").map((v) => {
      const [evidenceId, versionId] = v.split("|");
      return { evidenceId, versionId };
    });
  function activityForm(biaId, id) {
    const b = get("bia", biaId),
      a = b.activities.find((x) => x.id === id) || {},
      pol = U.state().pcra.policies.find((p) => p.id === b.policyId);
    const impact = pol.horizons
      .map(
        (h) =>
          `<fieldset class="lx-choices"><legend>Interruption : ${U.esc(h.label)}</legend>${pol.dimensions
            .map((d) =>
              U.select(
                "impact:" + h.id + ":" + d.id,
                d.label,
                pol.levels.map((l) => ({ value: l.id, label: l.label })),
                a.impacts?.[h.id]?.[d.id],
              ),
            )
            .join("")}</fieldset>`,
      )
      .join("");
    U.dialog(
      id ? "Modifier l’activité et ses impacts" : "Ajouter une activité au BIA",
      U.field("name", "Activité considérée", a.name, "text", "required") +
        U.select(
          "processId",
          "Processus existant (si pertinent)",
          U.state().processes.map((p) => ({ value: p.id, label: p.name })),
          a.processId,
        ) +
        U.select(
          "category",
          "Catégorie",
          ["Soins", "Plateau technique", "Administratif / support", "Autre"],
          a.category || "Soins",
        ) +
        U.field(
          "maxInterruptionHours",
          "Délai maximal d’indisponibilité acceptable (heures)",
          a.maxInterruptionHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.field(
          "rtoBusinessHours",
          "Besoin métier de reprise RTO (heures)",
          a.rtoBusinessHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.field(
          "rpoBusinessHours",
          "Perte de données acceptable métier RPO (heures)",
          a.rpoBusinessHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.area("minimumService", "Service minimum attendu", a.minimumService) +
        `<details open><summary>Besoins et modes dégradés</summary>${[
          ["humanNeeds", "Ressources humaines"],
          ["materialNeeds", "Matériels"],
          ["siNeeds", "Systèmes d’information"],
          ["buildingNeeds", "Bâtiments / locaux"],
          ["supplierNeeds", "Fournisseurs"],
          ["dependencies", "Dépendances"],
          ["workarounds", "Solutions de contournement"],
          ["justification", "Justification et hypothèses"],
        ]
          .map(([k, label]) => U.area(k, label, a[k]))
          .join(
            "",
          )}</details><details open><summary>Impacts selon la durée de l’interruption</summary><p class="lx-muted">${U.esc(pol.title)} · v${pol.version} : échelles internes à votre démarche.</p>${impact}</details>`,
      (fd) =>
        U.mutate((s) => {
          const impacts = {};
          for (const [k, v] of fd)
            if (k.startsWith("impact:") && v) {
              const [, h, d] = k.split(":");
              (impacts[h] = impacts[h] || {})[d] = v;
            }
          P.activity(s, biaId, { ...Object.fromEntries(fd), impacts }, id);
        }),
    );
  }
  function planForm(id, ids = [], kind = "PCA") {
    const p = id ? get("continuity", id) : null,
      b =
        U.state().pcra.bias.find((b) => b.id === p?.biaId) ||
        U.state().pcra.bias.find(
          (b) => !ids.length || ids.every((id) => b.perimeterIds.includes(id)),
        );
    U.dialog(
      p ? "Modifier le " + p.kind : "Formaliser un " + kind,
      U.field("title", "Nom du plan", p?.title, "text", "required") +
        U.select("kind", "Type", ["PCA", "PRA"], p?.kind || kind) +
        U.select(
          "biaId",
          "BIA source",
          U.state().pcra.bias.map((b) => ({
            value: b.id,
            label: b.title + " · v" + b.version,
          })),
          b?.id,
        ) +
        U.multi(
          "activityIds",
          "Activités couvertes",
          (b?.activities || []).map((a) => ({ value: a.id, label: a.name })),
          p?.activityIds || [],
        ) +
        U.scopes(p?.perimeterIds || b?.perimeterIds || ids) +
        U.responsible(
          p?.responsible,
          p?.perimeterIds || b?.perimeterIds || ids,
        ) +
        U.select(
          "scenario",
          "Scénario d’indisponibilité",
          [
            "Systèmes d’information",
            "Ressources humaines",
            "Bâtiments",
            "Fournisseurs",
            "Autre scénario",
          ],
          p?.scenario || "Systèmes d’information",
        ) +
        U.area(
          "activation",
          "Critères d’activation et décision",
          p?.activation,
        ) +
        U.area(
          "procedure",
          "Procédures ordonnées de continuité ou reprise",
          p?.procedure,
        ) +
        U.area(
          "communication",
          "Responsabilités, alerte et communication",
          p?.communication,
        ) +
        U.area("resources", "Ressources et moyens de secours", p?.resources) +
        U.area(
          "dependencies",
          "Dépendances et conditions de réussite",
          p?.dependencies,
        ) +
        U.area(
          "returnToNormal",
          "Retour au fonctionnement normal et vérifications",
          p?.returnToNormal,
        ) +
        U.field(
          "technicalRtoHours",
          "Objectif technique RTO du PRA (heures)",
          p?.technicalRtoHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.field(
          "technicalRpoHours",
          "Objectif technique RPO du PRA (heures)",
          p?.technicalRpoHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.field("reviewDate", "Prochaine revue", p?.reviewDate, "date") +
        picker(p?.proofRefs || []) +
        '<p class="lx-muted">Le PCA organise la continuité en mode dégradé ; le PRA organise la reprise. Les objectifs techniques restent distincts des besoins métiers du BIA.</p>',
      (fd) =>
        U.mutate((s) =>
          P.savePlan(
            s,
            {
              ...Object.fromEntries(fd),
              activityIds: fd.getAll("activityIds"),
              perimeterIds: fd.getAll("perimeterIds"),
              responsible: U.parseResponsible(fd),
              proofRefs: refs(fd),
            },
            id,
          ),
        ),
    );
    const dialog = document.getElementById("lx-dialog");
    dialog.querySelector("[name=biaId]").onchange = (e) => {
      const chosen = get("bia", e.target.value),
        fs = dialog.querySelector("[name=activityIds]")?.closest("fieldset");
      if (fs)
        fs.outerHTML = U.multi(
          "activityIds",
          "Activités couvertes",
          chosen.activities.map((a) => ({ value: a.id, label: a.name })),
          [],
        );
    };
  }
  function exerciseForm(id, ids = []) {
    const e = id ? get("exercise", id) : null;
    U.dialog(
      id ? "Modifier l’exercice" : "Planifier ou consigner un exercice",
      U.field("title", "Nom de l’exercice", e?.title, "text", "required") +
        U.select(
          "planId",
          "PCA / PRA testé",
          U.state().pcra.plans.map((p) => ({
            value: p.id,
            label: p.kind + " · " + p.title,
          })),
          e?.planId,
        ) +
        U.field("date", "Date", e?.date, "date") +
        U.field(
          "type",
          "Type d’exercice (sur table, technique, crise…)",
          e?.type || "Sur table",
        ) +
        U.responsible(e?.responsible, e?.perimeterIds || ids) +
        U.area("participants", "Participants et fonctions", e?.participants) +
        U.area("scenario", "Scénario joué", e?.scenario) +
        U.area(
          "objectives",
          "Objectifs et critères de réussite",
          e?.objectives,
        ) +
        U.area("conduct", "Déroulement et compte rendu", e?.conduct) +
        U.area("results", "Résultats et observations", e?.results) +
        U.area("retex", "Retour d’expérience (RETEX)", e?.retex) +
        U.area("gaps", "Écarts et améliorations attendues", e?.gaps) +
        U.field(
          "actualRtoHours",
          "Temps de reprise constaté (heures)",
          e?.actualRtoHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.field(
          "actualRpoHours",
          "Perte de données constatée (heures)",
          e?.actualRpoHours ?? "",
          "number",
          'min="0" step="0.01"',
        ) +
        U.select(
          "status",
          "Statut",
          ["Prévu", "En cours", "Réalisé", "Annulé"],
          e?.status || "Prévu",
        ) +
        picker(e?.proofRefs || []),
      (fd) =>
        U.mutate((s) =>
          P.exercise(
            s,
            {
              ...Object.fromEntries(fd),
              responsible: U.parseResponsible(fd),
              proofRefs: refs(fd),
            },
            id,
          ),
        ),
    );
  }
  function policyForm(id) {
    const old = U.state().pcra.policies.find((x) => x.id === id),
      p = old || P.DEFAULT_POLICY;
    const row = (kind, r, n) =>
      `<div data-policy-row="${kind}" data-row-id="${U.esc(r.id || "")}" class="lx-policy-row"><input name="${kind}-label-${n}" value="${U.esc(r.label || "")}" placeholder="Libellé" required aria-label="Libellé">${kind === "horizons" ? `<input name="${kind}-hours-${n}" type="number" min="0.01" step="0.01" value="${r.hours || 1}" aria-label="Durée en heures" required>` : kind === "levels" ? `<input name="${kind}-rank-${n}" type="number" value="${r.rank ?? n + 1}" aria-label="Rang" required><input name="${kind}-color-${n}" type="color" value="${r.color || "#dce8e0"}" aria-label="Couleur">` : ""}<button class="btn" type="button" data-policy-remove>Retirer</button></div>`;
    U.dialog(
      "Politique d’impact BIA · nouvelle version",
      U.field("title", "Nom de la politique", p.title, "text", "required") +
        U.scopes(old?.perimeterIds || []) +
        ["horizons", "dimensions", "levels"]
          .map(
            (kind) =>
              `<fieldset class="lx-choices" data-policy-section="${kind}"><legend>${{ horizons: "Horizons temporels (heures)", dimensions: "Dimensions d’impact", levels: "Niveaux, rangs et couleurs" }[kind]}</legend>${p[kind].map((r, n) => row(kind, r, n)).join("")}<button class="btn" type="button" data-policy-add="${kind}">Ajouter</button></fieldset>`,
          )
          .join("") +
        '<p class="lx-muted">Ces choix sont méthodologiques et internes. Une nouvelle version ne modifie pas les BIA rattachés aux versions antérieures.</p>',
      (fd) =>
        U.mutate((s) => {
          const f = {
            title: fd.get("title"),
            perimeterIds: fd.getAll("perimeterIds"),
            previousId: old?.id,
          };
          for (const kind of ["horizons", "dimensions", "levels"])
            f[kind] = [
              ...document.querySelectorAll(`[data-policy-row="${kind}"]`),
            ].map((el, n) => ({
              id: el.dataset.rowId || C.id(kind.toUpperCase()),
              label: el.querySelector('[name*="-label-"]').value,
              ...(kind === "horizons"
                ? { hours: Number(el.querySelector('[name*="-hours-"]').value) }
                : kind === "levels"
                  ? {
                      rank: Number(el.querySelector('[name*="-rank-"]').value),
                      color: el.querySelector("[type=color]").value,
                    }
                  : {}),
            }));
          P.policy(s, f);
        }),
    );
    const d = document.getElementById("lx-dialog");
    d.onclick = (e) => {
      if (e.target.hasAttribute("data-policy-remove"))
        e.target.closest("[data-policy-row]").remove();
      if (e.target.dataset.policyAdd) {
        const kind = e.target.dataset.policyAdd;
        const n = Date.now();
        e.target.insertAdjacentHTML("beforebegin", row(kind, {}, n));
      }
    };
  }
  function timeline(b) {
    const p = U.state().pcra.policies.find((p) => p.id === b.policyId);
    return `<div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Activité</th>${p.horizons.map((h) => `<th>${U.esc(h.label)}</th>`).join("")}<th>Délai maximal</th></tr></thead><tbody>${b.activities
      .map(
        (a) =>
          `<tr><td>${U.esc(a.name)}<small>${U.esc(a.category)}</small></td>${p.horizons
            .map((h) => {
              const levels = Object.values(a.impacts?.[h.id] || {})
                  .map((id) => p.levels.find((l) => l.id === id))
                  .filter(Boolean)
                  .sort((a, b) => b.rank - a.rank),
                max = levels[0];
              return `<td style="background:${max?.color || "#f2f4f2"};color:#213a2b">${U.esc(max?.label || "À évaluer")}<small>${p.dimensions.map((d) => U.esc(d.label) + ": " + U.esc(p.levels.find((l) => l.id === a.impacts?.[h.id]?.[d.id])?.label || "—")).join("<br>")}</small></td>`;
            })
            .join("")}<td>${a.maxInterruptionHours ?? "—"} h</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  }
  function biaDetail(b) {
    const issues = P.biaIssues(U.state(), b);
    return (
      U.header(
        b.title,
        U.scopeLabel(b.perimeterIds) + " · version " + b.version,
        U.button(
          "Ajouter une activité",
          "pcra-activity-new",
          `data-id="${b.id}"`,
          true,
        ) +
          U.button("Modifier le BIA", "pcra-bia-edit", `data-id="${b.id}"`) +
          U.button("Rapport PDF", "pcra-report", `data-id="${b.id}"`) +
          U.button("Excel", "pcra-excel", `data-id="${b.id}"`),
      ) +
      `<p>${U.pill(b.status)} · ${U.esc(U.ownerLabel(b))}${b.reviewDate ? " · Revue " + U.esc(b.reviewDate) : ""}</p><p class="lx-muted">Criticité affichée : niveau d’impact maximal par horizon, selon la politique interne versionnée du BIA. Aucun seuil unique imposé par l’application.</p>${b.activities.length ? timeline(b) : U.empty("Décrire les activités", "Ajoutez les activités de soins, de plateau technique ou de support et évaluez les impacts dans le temps.")}<div class="lx-list">${b.activities.map((a) => `<article class="lx-card"><h3>${U.esc(a.name)}</h3><p>RTO métier : ${a.rtoBusinessHours ?? "À préciser"} h · RPO métier : ${a.rpoBusinessHours ?? "À préciser"} h</p><p>${U.esc(a.minimumService || "Service minimum à préciser")}</p>${U.button("Modifier les impacts et besoins", "pcra-activity-edit", `data-id="${b.id}" data-activity="${a.id}"`)}</article>`).join("")}</div><section class="lx-card"><h3>Validation interne</h3>${
        issues.length
          ? `<p>${issues.length} point(s) à compléter.</p><ul class="lx-issues">${issues
              .slice(0, 8)
              .map((x) => `<li>${U.esc(x)}</li>`)
              .join("")}</ul>`
          : "<p>Données de l’analyse renseignées. Une validation humaine reste nécessaire.</p>"
      }${LegacyServer.canValidate() ? U.button("Valider le BIA", "pcra-bia-validate", `data-id="${b.id}"`) : ""}${U.button("Liens et preuves", "object-relations", `data-kind="bia" data-id="${b.id}"`)}</section><section class="lx-card"><h3>Historique</h3><p>${b.history.length} version(s) antérieure(s) conservée(s), avec décisions et données.</p>${U.button("Consulter les versions", "pcra-history", `data-kind="bia" data-id="${b.id}"`)}</section>`
    );
  }
  function plansView(kind) {
    const rows = U.state().pcra.plans.filter((p) => p.kind === kind);
    return (
      U.header(
        kind === "PCA"
          ? "Plans de continuité d’activité"
          : "Plans de reprise d’activité",
        kind === "PCA"
          ? "Maintenir les activités et organiser les modes dégradés."
          : "Restaurer les ressources et vérifier la reprise métier.",
        U.button(
          "Créer un " + kind,
          "pcra-plan-new",
          `data-kind="${kind}"`,
          true,
        ),
      ) +
      `<div class="lx-list">${
        rows
          .map((p) => {
            const b = U.state().pcra.bias.find((b) => b.id === p.biaId),
              issues = P.planIssues(U.state(), p);
            return `<article class="lx-card"><h3>${U.esc(p.title)}</h3><p>${U.esc(p.scenario)} · ${U.esc(U.scopeLabel(p.perimeterIds))}</p><p>${U.pill(p.status)} · ${U.esc(p.reviewState)}</p><p class="lx-muted">BIA : ${U.esc(b?.title || "À relier")} · ${p.activityIds.length} activité(s) · plan v${p.version}</p>${
              kind === "PRA"
                ? `<p>RTO technique ${p.technicalRtoHours ?? "—"} h / RPO technique ${p.technicalRpoHours ?? "—"} h</p>${p.activityIds
                    .map((id) => b?.activities.find((a) => a.id === id))
                    .filter(Boolean)
                    .filter(
                      (a) =>
                        (p.technicalRtoHours > a.rtoBusinessHours &&
                          a.rtoBusinessHours != null) ||
                        (p.technicalRpoHours > a.rpoBusinessHours &&
                          a.rpoBusinessHours != null),
                    )
                    .map(
                      (a) =>
                        `<p class="lx-issues">Objectif technique au-delà du besoin métier : ${U.esc(a.name)}.</p>`,
                    )
                    .join("")}`
                : ""
            }${issues.length ? `<p class="lx-muted">${U.esc(issues.join(" · "))}</p>` : ""}<div class="lx-actions">${U.button("Modifier", "pcra-plan-edit", `data-id="${p.id}"`)}${LegacyServer.canValidate() ? U.button("Valider", "pcra-plan-validate", `data-id="${p.id}"`) : ""}${U.button("Liens", "object-relations", `data-kind="continuity" data-id="${p.id}"`)}${U.button("Versions", "pcra-history", `data-kind="continuity" data-id="${p.id}"`)}</div></article>`;
          })
          .join("") ||
        U.empty(
          "Aucun " + kind,
          "Formalisez un BIA puis construisez le plan sur les activités concernées.",
        )
      }</div>`
    );
  }
  function exercisesView() {
    const rows = U.state().pcra.exercises;
    return (
      U.header(
        "Exercices et retours d’expérience",
        "Les écarts génèrent des actions dans le plan central.",
        U.button("Planifier un exercice", "pcra-exercise-new", "", true),
      ) +
      `<div class="lx-list">${rows.map((e) => `<article class="lx-card"><h3>${U.esc(e.title)}</h3><p>${U.esc(e.date || "Date à préciser")} · ${U.pill(e.status)}</p><p>${U.esc(e.results || "Résultats à consigner")}</p><p>${U.esc(e.retex || "RETEX à renseigner")}</p><p>${e.actionIds.length} action(s) corrective(s), ${e.actionIds.filter((id) => U.state().findings.find((f) => f.id === id)?.status === "Clos").length} terminée(s)</p><div class="lx-actions">${U.button("Modifier / résultats", "pcra-exercise-edit", `data-id="${e.id}"`)}${U.button("Créer une action corrective", "pcra-corrective", `data-id="${e.id}"`)}${U.button("Liens", "object-relations", `data-kind="exercise" data-id="${e.id}"`)}</div></article>`).join("") || U.empty("Aucun exercice", "Consignez les tests réellement réalisés, leurs résultats, écarts et améliorations.")}</div>`
    );
  }
  function sharedView(v) {
    const s = U.state(),
      kinds = ["bia", "continuity", "exercise"],
      records = [...s.pcra.bias, ...s.pcra.plans, ...s.pcra.exercises],
      actions = s.findings.filter(
        (a) =>
          a.pcraExerciseId ||
          (a.objectRefs || []).some((r) => kinds.includes(r.kind)),
      ),
      proofIds = new Set(
        records.flatMap((r) =>
          (r.proofRefs || []).map((ref) => ref.evidenceId),
        ),
      ),
      proofs = s.evidences.filter(
        (p) =>
          proofIds.has(p.id) ||
          (p.objectRefs || []).some((r) => kinds.includes(r.kind)),
      ),
      rows = v === "actions" ? actions : proofs;
    return (
      U.header(
        v === "actions"
          ? "Actions et améliorations PCRA"
          : "Documents et preuves PCRA",
        v === "actions"
          ? "Les mêmes actions que dans le plan central ; leur clôture se retrouve dans les exercices."
          : "Les mêmes pièces que dans le registre central ; les versions examinées sont conservées dans les BIA, plans et exercices.",
      ) +
      `<div class="lx-list">${rows.map((r) => `<article class="lx-card"><h3>${U.esc(r.text || r.title)}</h3><p>${U.esc(U.scopeLabel(r.perimeterIds))} · ${U.esc(U.ownerLabel(r))}</p><p>${U.pill(r.status || C.proofValidation(s, { evidenceId: r.id, versionId: r.dfVersions?.at(-1)?.id })?.status || "À vérifier")}</p>${U.button(v === "actions" ? "Ouvrir l’action centrale" : "Ouvrir la preuve centrale", v === "actions" ? "pcra-action-open" : "pcra-proof-open", `data-id="${r.id}"`)}${U.button("Liens", "object-relations", `data-kind="${v === "actions" ? "action" : "proof"}" data-id="${r.id}"`)}</article>`).join("") || U.empty(v === "actions" ? "Aucune action PCRA" : "Aucune pièce liée au PCRA", v === "actions" ? "Créez une action depuis un exercice ou reliez une action existante à un BIA ou plan." : "Sélectionnez une version de preuve dans le formulaire du BIA, du plan ou de l’exercice, ou utilisez les liens partagés.")}</div>`
    );
  }
  function view() {
    const s = P.init(U.state()),
      v = U.api().ui.pcraView || "dashboard";
    P.reconcile(s);
    if (["actions", "documents"].includes(v)) return sharedView(v);
    if (v === "bias") {
      const b = s.pcra.bias.find((x) => x.id === U.api().ui.biaId);
      if (b) return biaDetail(b);
      return (
        U.header(
          "Analyses d’impact sur l’activité",
          "Les activités, leurs impacts temporels et leurs besoins métiers.",
          U.button("Créer un BIA", "pcra-bia-new", "", true),
        ) +
        `<div class="lx-list">${s.pcra.bias.map((b) => `<article class="lx-card"><h3>${U.esc(b.title)}</h3><p>${U.esc(U.scopeLabel(b.perimeterIds))} · ${b.activities.length} activité(s)</p><p>${U.pill(b.status)} · version ${b.version}</p>${U.button("Ouvrir le BIA", "pcra-bia-open", `data-id="${b.id}"`, true)}</article>`).join("") || U.empty("Commencer par le BIA", "L’analyse d’impact structure les plans de continuité et de reprise.")}</div>`
      );
    }
    if (["PCA", "PRA"].includes(v)) return plansView(v);
    if (v === "exercises") return exercisesView();
    if (v === "policies")
      return (
        U.header(
          "Politiques d’impact BIA",
          "Horizons, dimensions, niveaux et couleurs versionnés. Choix internes configurables.",
          U.button("Nouvelle politique", "pcra-policy-new", "", true),
        ) +
        `<div class="lx-list">${s.pcra.policies.map((p) => `<article class="lx-card"><h3>${U.esc(p.title)} · v${p.version}</h3><p>${U.esc(U.scopeLabel(p.perimeterIds))}</p><p>${p.horizons.map((h) => U.esc(h.label)).join(" · ")}</p><p>${p.dimensions.map((d) => U.esc(d.label)).join(" · ")}</p>${U.button("Créer une nouvelle version", "pcra-policy-version", `data-id="${p.id}"`)}</article>`).join("")}</div>`
      );
    const stats = P.dashboard(s);
    return (
      U.header(
        "Continuité et reprise d’activité",
        "BIA → PCA / PRA → exercices → actions correctives.",
        U.button("Créer un BIA", "pcra-bia-new", "", true),
      ) +
      `<div class="lx-stats">${U.card("Analyses d’impact", stats.bias, stats.activities + " activités évaluables")}${U.card("BIA validés", stats.validated, "Validation interne de la version actuelle")}${U.card("Plans à revoir", stats.review, "Après évolution du BIA source")}${U.card("Exercices réalisés", stats.exercises, stats.actions + " actions correctives ouvertes")}</div><section class="lx-card"><h3>Parcours PCRA</h3><p>Déclarez le périmètre, analysez les activités et leurs impacts, puis formalisez séparément les PCA et PRA. Les exercices vérifient les procédures et alimentent le plan d’action.</p><p>CaRE D2.O1.C et D2.O1.D : consultez les critères et pièces officiels dans Programme CaRE. Une validation interne du BIA ou du plan ne vaut pas acceptation de l’ANS.</p><a href="https://esante.gouv.fr/strategie-nationale/cybersecurite/axe-1" target="_blank" rel="noopener noreferrer">Kit PCRA de l’ANS et ressources officielles</a></section>`
    );
  }
  function report(id, excel = false) {
    const s = U.state(),
      b = get("bia", id),
      p = s.pcra.policies.find((p) => p.id === b.policyId),
      rows = b.activities.map((a) => ({
        Activité: a.name,
        Catégorie: a.category,
        Périmètre: U.scopeLabel(b.perimeterIds),
        Politique: p.title + " v" + p.version,
        "Délai maximal (h)": a.maxInterruptionHours,
        "RTO métier (h)": a.rtoBusinessHours,
        "RPO métier (h)": a.rpoBusinessHours,
        "Service minimum": a.minimumService,
        "Besoins humains": a.humanNeeds,
        "Besoins matériels": a.materialNeeds,
        "Besoins SI": a.siNeeds,
        "Besoins locaux": a.buildingNeeds,
        Fournisseurs: a.supplierNeeds,
        Dépendances: a.dependencies,
        Contournements: a.workarounds,
        ...Object.fromEntries(
          p.horizons.flatMap((h) =>
            p.dimensions.map((d) => [
              h.label + " / " + d.label,
              p.levels.find((l) => l.id === a.impacts?.[h.id]?.[d.id])?.label ||
                "Non évalué",
            ]),
          ),
        ),
      }));
    const plans = s.pcra.plans.filter((plan) => plan.biaId === b.id),
      planIds = new Set(plans.map((plan) => plan.id)),
      exercises = s.pcra.exercises.filter((e) => planIds.has(e.planId)),
      exerciseIds = new Set(exercises.map((e) => e.id)),
      actions = s.findings.filter(
        (a) =>
          exerciseIds.has(a.pcraExerciseId) ||
          (a.objectRefs || []).some(
            (r) =>
              (r.kind === "bia" && r.id === b.id) ||
              (r.kind === "continuity" && planIds.has(r.id)),
          ),
      ),
      proofs = [b, ...plans, ...exercises].flatMap((r) =>
        (r.proofRefs || []).map((ref) => {
          const proof = s.evidences.find((p) => p.id === ref.evidenceId),
            version = proof?.dfVersions.find((v) => v.id === ref.versionId);
          return {
            Objet: r.title,
            Preuve: proof?.title || "Indisponible",
            Version: version?.number || "Indisponible",
            "SHA-256": version?.sha256 || "",
            Périmètre: U.scopeLabel(proof?.perimeterIds),
            Vérification: C.proofValidation(s, ref)?.status || "À vérifier",
          };
        }),
      ),
      sections = {
        BIA: rows,
        Plans: plans.map((plan) => ({
          Type: plan.kind,
          Plan: plan.title,
          Version: plan.version,
          "BIA source (révision)": plan.biaRevision,
          Statut: plan.status,
          Revue: plan.reviewState,
          Activités: plan.activityIds
            .map((id) => b.activities.find((a) => a.id === id)?.name || id)
            .join(", "),
          Responsable: U.ownerLabel(plan),
          Scénario: plan.scenario,
          Activation: plan.activation,
          Procédures: plan.procedure,
          Communication: plan.communication,
          Ressources: plan.resources,
          Dépendances: plan.dependencies,
          "Retour à la normale": plan.returnToNormal,
          "RTO technique (h)": plan.technicalRtoHours,
          "RPO technique (h)": plan.technicalRpoHours,
        })),
        Exercices: exercises.map((e) => ({
          Exercice: e.title,
          Plan: plans.find((plan) => plan.id === e.planId)?.title,
          "Version du plan": e.planVersion,
          Date: e.date,
          Type: e.type,
          Statut: e.status,
          Responsable: U.ownerLabel(e),
          Participants: e.participants,
          Scénario: e.scenario,
          Objectifs: e.objectives,
          Déroulement: e.conduct,
          Résultats: e.results,
          Écarts: e.gaps,
          RETEX: e.retex,
          "RTO constaté (h)": e.actualRtoHours,
          "RPO constaté (h)": e.actualRpoHours,
        })),
        Actions: actions.map((a) => ({
          Action: a.text,
          Statut: a.status,
          Responsable: U.ownerLabel(a),
          Échéance: a.due,
          Description: a.desc || a.action,
        })),
        Preuves: proofs,
      };
    if (excel) {
      const wb = XLSX.utils.book_new();
      for (const [name, entries] of Object.entries(sections)) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            entries.map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [k, C.spreadsheetText(v)]),
              ),
            ),
          ),
          name,
        );
      }
      XLSX.writeFile(wb, "BIA-" + b.id + ".xlsx");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) throw Error("Autorisez la fenêtre de rapport.");
    win.document.write(
      '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Rapport BIA / PCRA</title><style>body{font:14px sans-serif;padding:25px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}td{white-space:pre-wrap}button{margin-bottom:20px}@media print{button{display:none}article{break-inside:avoid}}</style><button onclick="print()">Imprimer / PDF</button><h1>' +
        U.esc(b.title) +
        "</h1><p>Version " +
        b.version +
        " · " +
        U.esc(b.status) +
        " · " +
        U.esc(U.scopeLabel(b.perimeterIds)) +
        "</p>" +
        timeline(b) +
        Object.entries(sections)
          .map(
            ([name, entries]) =>
              "<section><h2>" +
              U.esc(name) +
              "</h2>" +
              (entries
                .map(
                  (r) =>
                    "<article><table>" +
                    Object.entries(r)
                      .map(
                        ([k, v]) =>
                          "<tr><th>" +
                          U.esc(k) +
                          "</th><td>" +
                          U.esc(v ?? "") +
                          "</td></tr>",
                      )
                      .join("") +
                    "</table></article>",
                )
                .join("") || "<p>Aucun élément lié.</p>") +
              "</section>",
          )
          .join("") +
        "<p>Échelles internes configurables ; ce rapport ne constitue pas une validation de conformité par l’ANS.</p></html>",
    );
    win.document.close();
  }
  function history(ref) {
    const r = get(ref.kind, ref.id);
    U.dialog(
      "Versions et décisions",
      `<div class="lx-list">${(r.history || []).map((h) => `<article class="lx-card"><h3>Version ${h.version}</h3><p>${U.esc(h.at)}</p><pre class="lx-history">${U.esc(JSON.stringify(h.snapshot, null, 2))}</pre></article>`).join("") || "<p>Aucune version antérieure.</p>"}</div>`,
      async () => {},
    );
  }
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
      U.api().TABS.push({ id: "pcra", label: () => "PCRA", view });
      U.api().NAV_DEF.pcraView = "dashboard";
    },
    extendNav: (nav) => [
      {
        id: "pcra",
        label: "PCRA · continuité et reprise",
        icon: "ops",
        items: [
          ["dashboard", "Vue d’ensemble"],
          ["bias", "Analyses d’impact · BIA"],
          ["PCA", "Plans de continuité · PCA"],
          ["PRA", "Plans de reprise · PRA"],
          ["exercises", "Exercices et RETEX"],
          ["actions", "Actions et améliorations"],
          ["documents", "Documents et preuves"],
          ["policies", "Politiques d’impact"],
        ].map(([v, label]) => ({
          id: "pcra-" + v,
          label,
          tab: "pcra",
          set: { pcraView: v, biaId: "" },
        })),
      },
      ...nav,
    ],
    readActions: [
      "pcra-bia-open",
      "pcra-report",
      "pcra-excel",
      "pcra-history",
      "pcra-action-open",
      "pcra-proof-open",
    ],
    click: async (act, el) => {
      if (act === "pcra-bia-new") biaForm();
      else if (act === "pcra-bia-edit") biaForm(el.dataset.id);
      else if (act === "pcra-bia-open") {
        U.api().ui.pcraView = "bias";
        U.api().ui.biaId = el.dataset.id;
        U.api().render();
      } else if (act === "pcra-activity-new") activityForm(el.dataset.id);
      else if (act === "pcra-activity-edit")
        activityForm(el.dataset.id, el.dataset.activity);
      else if (act === "pcra-bia-validate")
        await U.mutate((s) =>
          P.validateBia(s, el.dataset.id, LegacyServer.user().name),
        );
      else if (act === "pcra-plan-new") planForm("", [], el.dataset.kind);
      else if (act === "pcra-plan-edit") planForm(el.dataset.id);
      else if (act === "pcra-plan-validate")
        await U.mutate((s) =>
          P.validatePlan(s, el.dataset.id, LegacyServer.user().name),
        );
      else if (act === "pcra-exercise-new") exerciseForm();
      else if (act === "pcra-exercise-edit") exerciseForm(el.dataset.id);
      else if (act === "pcra-action-open")
        U.api().openSheet("fd", el.dataset.id);
      else if (act === "pcra-proof-open") U.api().df.openProof(el.dataset.id);
      else if (act === "pcra-corrective") {
        const e = get("exercise", el.dataset.id);
        U.dialog(
          "Action corrective dans le plan partagé",
          U.field(
            "title",
            "Action corrective",
            e.gaps || "",
            "text",
            "required",
          ) +
            U.area("description", "Description", e.gaps) +
            U.field("due", "Échéance", "", "date") +
            U.responsible(e.responsible, e.perimeterIds),
          (fd) =>
            U.mutate((s) =>
              P.corrective(s, e.id, {
                ...Object.fromEntries(fd),
                responsible: U.parseResponsible(fd),
                sourceKey: fd.get("title"),
              }),
            ),
        );
      } else if (act === "pcra-policy-new") policyForm();
      else if (act === "pcra-policy-version") policyForm(el.dataset.id);
      else if (act === "pcra-report") report(el.dataset.id);
      else if (act === "pcra-excel") report(el.dataset.id, true);
      else if (act === "pcra-history")
        history({ kind: el.dataset.kind, id: el.dataset.id });
      else return false;
      return true;
    },
  });
  window.LegacyPCRAUI = {
    open: (kind, id, ids) =>
      kind === "bia"
        ? biaForm(id, ids)
        : kind === "continuity"
          ? planForm(id, ids)
          : exerciseForm(id, ids),
  };
})();
