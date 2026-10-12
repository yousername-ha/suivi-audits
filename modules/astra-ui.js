/* ASTRA: presentation only. The legacy registries, calculations and persistence remain authoritative. */
(function () {
  "use strict";
  let U,
    A,
    B,
    lastAnalysis,
    dragId = "",
    focusBack = null;
  const old = {},
    prefs = {};
  const E = (x) => U.esc(x),
    S = () => U.state(),
    ui = () => U.api().ui;
  const date = (x) =>
    x
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(String(x).slice(0, 10) + "T12:00:00"))
      : "À planifier";
  const iso = (d) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const today = () => iso(new Date());
  const btn = (label, act, attrs = "", primary = false) =>
    `<button type="button" class="btn${primary ? " primary" : ""}" data-astra="${act}" ${attrs}>${E(label)}</button>`;
  const pill = (text, tone = "neutral") =>
    `<span class="as-pill ${tone}">${E(text)}</span>`;
  const tone = (s) =>
    /Clos|Réalisé|Total|Conforme|À jour/.test(s)
      ? "good"
      : /retard|Non conforme|Insuffisant|Critique/.test(s)
        ? "bad"
        : /cours|Partiel|bientôt|Élevé/.test(s)
          ? "warn"
          : "neutral";
  const progress = (n) =>
    `<span class="as-progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${n}"><span style="width:${n}%"></span></span><small>${n} %</small>`;
  const head = (eyebrow, title, desc, actions = "") =>
    `<header class="as-head"><div><p class="as-eyebrow">${E(eyebrow)}</p><h1>${E(title)}</h1><p>${E(desc)}</p></div><div class="as-head-actions">${actions}</div></header>`;
  const empty = (title, desc) =>
    `<div class="as-empty"><strong>${E(title)}</strong><p>${E(desc)}</p></div>`;
  function metric(value, label, act = "", attrs = "", accent = "") {
    return `<${act ? "button" : "div"} ${act ? `type="button" data-astra="${act}" ${attrs}` : ""} class="as-metric ${accent}"><strong>${E(value)}</strong><span>${E(label)}</span>${act ? "<small>Consulter →</small>" : ""}</${act ? "button" : "div"}>`;
  }
  function pref(key, fallback) {
    return prefs[key] ?? fallback;
  }
  function select(key, label, options, value) {
    return `<label class="as-filter">${E(label)}<select data-astra-pref="${key}" data-ro-ok>${options
      .map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${E(v)}" ${String(v) === String(value) ? "selected" : ""}>${E(l)}</option>`;
      })
      .join("")}</select></label>`;
  }
  function search(key, value) {
    return `<label class="as-filter as-search">Rechercher<input type="search" data-astra-search="${key}" data-ro-ok value="${E(value)}" placeholder="Titre, référence, responsable…"></label>`;
  }
  function views(key, options) {
    const current = pref(key, options[0][0]);
    return `<nav class="as-views" aria-label="Représentation">${options.map(([v, l]) => btn(l, "view", `data-key="${key}" data-value="${v}" aria-pressed="${v === current}"`)).join("")}</nav>`;
  }
  function closeDetail() {
    document.getElementById("as-detail")?.close();
    focusBack?.focus();
  }
  function detail(title, html, actions = "") {
    let d = document.getElementById("as-detail");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "as-detail";
      d.className = "as-drawer";
      document.body.append(d);
      d.addEventListener("close", () => focusBack?.focus());
    }
    focusBack = document.activeElement;
    d.innerHTML = `<header><div><p class="as-eyebrow">Fiche de synthèse</p><h2 id="as-detail-title">${E(title)}</h2></div>${btn("Fermer ×", "close")}</header><div class="as-detail-body">${html}</div><footer>${actions}</footer>`;
    d.setAttribute("aria-labelledby", "as-detail-title");
    if (!d.open) d.showModal();
  }
  function riskRows(stage) {
    return LegacyRisks.rows(S(), {
      stage: stage || pref("riskStage", "initial"),
      perimeterId: pref("riskScope", ""),
      query: pref("riskQuery", ""),
      status: pref("riskStatus", ""),
    });
  }
  function levelColor(level) {
    return level?.color || "#e9eef0";
  }
  function ink(hex) {
    const c = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#e9eef0";
    const rgb = [1, 3, 5]
      .map((n) => parseInt(c.slice(n, n + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
      ? "#102a32"
      : "#ffffff";
  }
  function riskList(rows) {
    return `<div class="as-table-scroll"><table class="as-table"><thead><tr><th>Risque</th><th>Niveau / statut</th><th>Responsable</th><th>Prochaine revue</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${btn(r.risk.title, "risk-detail", `data-id="${E(r.risk.id)}"`)}<small>${E(r.risk.internalId || r.risk.id)} · ${E(r.risk.domain || "Domaine à préciser")}</small></td><td>${pill(r.level?.label || "Non évalué", tone(r.level?.label || ""))}<small>${E(r.risk.status)}</small></td><td>${E(U.ownerLabel(r.risk))}</td><td>${date(r.risk.reviewDate)}</td></tr>`).join("") || '<tr><td colspan="4">Aucun risque pour ces filtres.</td></tr>'}</tbody></table></div>`;
  }
  function matrix(rows, compact = false) {
    const groups = new Map();
    rows.forEach((r) => {
      const k = r.policy?.id || "none";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    });
    return (
      [...groups]
        .map(([id, rs]) => {
          const p = rs[0].policy;
          if (!p)
            return `<section class="as-surface"><h3>Risques à évaluer <span class="as-count">${rs.length}</span></h3>${
              compact
                ? rs
                    .slice(0, 5)
                    .map((r) =>
                      btn(
                        r.risk.title,
                        "risk-detail",
                        `data-id="${E(r.risk.id)}"`,
                      ),
                    )
                    .join("")
                : riskList(rs)
            }</section>`;
          const isMatrix = p.calculation === "matrix";
          const selected = pref("riskCell", "");
          const cells = p.impactScale
            .slice()
            .reverse()
            .map(
              (imp) =>
                `<div class="as-axis">${E(imp.label)}</div>${p.likelihoodScale
                  .map((like) => {
                    const key = imp.id + ":" + like.id,
                      l = p.levels.find((l) => l.id === p.matrix?.[key]),
                      matches = rs.filter(
                        (r) =>
                          r.assessment?.impactId === imp.id &&
                          r.assessment?.likelihoodId === like.id,
                      );
                    const col = isMatrix ? levelColor(l) : "#e9eef0";
                    return `<div class="as-risk-cell ${selected === id + "|" + key ? "selected" : ""}" style="--cell:${E(col)};--ink:${ink(col)}"><button class="as-cell-select" type="button" data-astra="risk-cell" data-id="${E(id + "|" + key)}" aria-pressed="${selected === id + "|" + key}" aria-label="${E(imp.label + " / " + like.label + " : " + (l?.label || "Appréciation manuelle") + ", " + matches.length + " risques")}"><span>${E(isMatrix ? l?.label || "Non défini" : "Appréciation manuelle")}</span><b>${matches.length || "–"}</b></button><div class="as-risk-dots">${matches.map((r) => `<button type="button" data-astra="risk-detail" data-id="${E(r.risk.id)}" title="${E(r.risk.title + " · " + r.level?.label)}" style="--dot:${E(levelColor(r.level))};color:${ink(levelColor(r.level))}">${E(r.risk.internalId || r.risk.id)}</button>`).join("")}</div></div>`;
                  })
                  .join("")}`,
            )
            .join("");
          const display = selected.startsWith(id + "|")
            ? rs.filter(
                (r) =>
                  r.assessment?.impactId + ":" + r.assessment?.likelihoodId ===
                  selected.slice(id.length + 1),
              )
            : rs;
          return `<section class="as-surface"><div class="as-section-title"><div><h3>${E(p.title)}</h3><p>${E(p.method)} · version ${p.version} · ${rs.length} risques</p></div>${selected ? btn("Réinitialiser la sélection", "risk-cell", 'data-id=""') : ""}</div><div class="as-risk-layout ${compact ? "compact" : ""}"><div><p class="as-axis-title">↑ Impact / gravité</p><div class="as-matrix-scroll"><div class="as-matrix" style="grid-template-columns:100px repeat(${p.likelihoodScale.length},minmax(80px,1fr))">${cells}<div></div>${p.likelihoodScale.map((l) => `<div class="as-axis bottom">${E(l.label)}</div>`).join("")}</div></div><p class="as-axis-title right">Probabilité / vraisemblance →</p><div class="as-legend">${p.levels.map((l) => `<span><i style="background:${E(l.color)}"></i>${E(l.label)}</span>`).join("")}</div>${!isMatrix ? '<p class="as-note">Cette politique utilise une appréciation manuelle. Les pastilles portent le niveau évalué ; les cellules n’imposent aucun calcul.</p>' : ""}</div>${compact ? "" : `<aside><h4>${selected ? "Risques sélectionnés" : "Dans cette matrice"} · ${display.length}</h4>${display.map((r) => `<div class="as-risk-row">${btn(r.risk.title, "risk-detail", `data-id="${E(r.risk.id)}"`)}${pill(r.level?.label || "Non évalué", tone(r.level?.label || ""))}<small>${E(U.ownerLabel(r.risk))} · ${E(r.risk.status)}</small></div>`).join("") || "<p>Aucun risque dans cette cellule.</p>"}</aside>`}</div></section>`;
        })
        .join("") ||
      empty(
        "Votre registre est prêt",
        "Créez un risque et son évaluation pour alimenter la matrice.",
      )
    );
  }
  function risks() {
    if (
      !["register", "map"].includes(ui().riskView || "register") ||
      ui().riskId
    )
      return old.risks();
    const rows = riskRows(),
      view = pref("riskView", ui().riskView === "map" ? "matrix" : "list");
    return (
      head(
        "Gouvernance / Analyse des risques",
        "Comprendre les risques. Prioriser le traitement.",
        "Des évaluations de référence, des décisions traçables et une vision consolidée.",
        U.button("Créer un risque", "risk-new", "", true) +
          U.button("Excel", "risk-export") +
          U.button("Rapport / PDF", "risk-report"),
      ) +
      `<div class="as-toolbar">${views("riskView", [
        ["matrix", "Matrice"],
        ["list", "Registre"],
      ])}<span class="as-count">${rows.length} risques</span></div><div class="as-filters">${select(
        "riskStage",
        "Évaluation",
        [
          ["initial", "Initial / brut"],
          ["residual", "Actuel · résiduel"],
          ["accepted", "Accepté par décision"],
        ],
        pref("riskStage", "initial"),
      )}${select("riskScope", "Périmètre", [["", "Tous mes périmètres"], ...S().perimeters.map((p) => [p.id, p.name])], pref("riskScope", ""))}${select("riskStatus", "Statut", [["", "Tous"], "Ouvert", "En traitement", "Accepté", "Transféré", "Évité", "Archivé"], pref("riskStatus", ""))}${search("riskQuery", pref("riskQuery", ""))}</div><p class="as-note">Le niveau cible n’est pas défini dans ce registre. Un risque sans référence résiduelle reste non évalué dans la vue « Actuel ».</p>` +
      (view === "matrix"
        ? matrix(rows)
        : `<section class="as-surface">${riskList(rows)}</section>`)
    );
  }
  function riskDetail(id) {
    const s = S(),
      r = s.riskMgmt.risks.find((r) => r.id === id);
    if (!r) return;
    const levels = ["initial", "residual"]
      .map((stage) => {
        const row = LegacyRisks.rows(s, { stage }).find(
          (x) => x.risk.id === id,
        );
        return metric(
          row.level?.label || "Non évalué",
          stage === "initial" ? "Initial / brut" : "Actuel · résiduel",
        );
      })
      .join("");
    detail(
      r.title,
      `<p class="as-note">${E(r.internalId)} · ${E(U.scopeLabel(r.perimeterIds))}</p>${pill(r.status)}<div class="as-metrics">${levels}</div><h3>Contexte</h3><p>${E(r.description || "À documenter")}</p><dl class="as-facts"><dt>Responsable</dt><dd>${E(U.ownerLabel(r))}</dd><dt>Prochaine revue</dt><dd>${date(r.reviewDate)}</dd><dt>Domaine</dt><dd>${E(r.domain || "À préciser")}</dd></dl><h3>Plan de traitement</h3>${
        s.riskMgmt.treatments
          .filter((t) => t.riskId === id)
          .map(
            (t) =>
              `<div class="as-detail-section"><h4>${E(t.title)}</h4><p>${E(t.strategy)} · ${E(t.status)} · ${date(t.due)}</p>${s.riskMgmt.measures
                .filter((m) => m.treatmentId === t.id)
                .map(
                  (m) =>
                    `<p>${E(m.title)} · ${m.proofRefs?.length || 0} preuve(s) ${m.actionId ? btn("Action liée", "work-detail", `data-kind="action" data-id="${E(m.actionId)}"`) : pill("Action à créer")}</p>`,
                )
                .join("")}</div>`,
          )
          .join("") || "<p>Aucun traitement renseigné.</p>"
      }<h3>Décisions</h3>${
        s.riskMgmt.decisions
          .filter((d) => d.riskId === id)
          .map(
            (d) =>
              `<p>${E(d.kind)} · ${date(d.date)}<br>${E(d.justification)}</p>`,
          )
          .join("") || "<p>Aucune décision formelle.</p>"
      }`,
      btn("Dossier et historique", "risk-full", `data-id="${E(id)}"`) +
        (!A.readOnly()
          ? btn("Modifier", "risk-edit", `data-id="${E(id)}"`, true)
          : ""),
    );
  }
  function workRows(kind) {
    if (kind === "rec")
      return (S().recurring || []).map((r) => ({
        id: r.id,
        raw: r,
        kind,
        title: r.title || "Tâche sans titre",
        owner: U.ownerLabel(r),
        status: B.recState(r)[0],
        due: B.isoD(B.recNext(r)),
        start: "",
        group: r.cat || "Sans catégorie",
        priority: B.recState(r)[0] === "En retard" ? "À traiter" : "Récurrente",
        progress: null,
      }));
    if (kind === "plan")
      return (S().plans || []).map((r) => ({
        id: r.id,
        raw: r,
        kind,
        title: r.title || "Programme sans titre",
        owner: U.ownerLabel(r),
        status: r.status,
        due: r.end || r.start || "",
        start: r.start || "",
        group: B.PLAN_T[r.type]?.pl || r.type,
        priority: B.planLate(r) ? "En retard" : "Planifié",
        progress: r.status === "Réalisé" ? 100 : null,
      }));
    return S().findings.map((r) => ({
      id: r.id,
      raw: r,
      kind: "action",
      title: r.action || r.text || "Action sans titre",
      owner: U.ownerLabel(r),
      status: r.status,
      due: r.due || "",
      start: r.start || "",
      group: r.source || "Sans origine",
      priority: r.type || "À qualifier",
      progress: r.tasks?.length
        ? Math.round(
            (100 * r.tasks.filter((t) => t.done).length) / r.tasks.length,
          )
        : r.status === "Clos"
          ? 100
          : 0,
    }));
  }
  const done = (r) =>
    ["Clos", "Réalisé", "Annulé", "Suspendue"].includes(r.status);
  const late = (r) => !!r.due && r.due < today() && !done(r);
  function filtered(kind) {
    let rows = workRows(kind),
      q = pref(kind + "Query", "").toLocaleLowerCase(),
      st = pref(kind + "Status", ""),
      owner = pref(kind + "Owner", "");
    rows = rows.filter(
      (r) =>
        (!q ||
          (r.id + " " + r.title + " " + r.owner)
            .toLocaleLowerCase()
            .includes(q)) &&
        (!st || (st === "late" ? late(r) : r.status === st)) &&
        (!owner || r.owner === owner),
    );
    if (kind === "plan" && !["cal", "gantt"].includes(ui().planView))
      rows = rows.filter((r) => r.raw.type === ui().planView);
    const sort = pref(kind + "Sort", "due");
    return rows.sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "fr")
        : sort === "owner"
          ? a.owner.localeCompare(b.owner, "fr")
          : String(a.due || "9999").localeCompare(String(b.due || "9999")),
    );
  }
  function openButton(r) {
    return btn(
      r.title,
      "work-detail",
      `data-kind="${r.kind}" data-id="${E(r.id)}"`,
    );
  }
  function workTable(rows) {
    return `<div class="as-table-scroll"><table class="as-table"><thead><tr><th>Action / tâche</th><th>Responsable</th><th>Échéance</th><th>Statut</th><th>Priorité / fréquence</th><th>Avancement</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${openButton(r)}<small>${E(r.id)} · ${E(r.group)}</small></td><td>${E(r.owner)}</td><td>${date(r.due)}${late(r) ? pill("En retard", "bad") : ""}</td><td>${pill(r.status, tone(r.status))}</td><td>${E(r.kind === "rec" ? B.recFreq(r.raw) : r.priority)}</td><td>${r.progress === null ? "—" : progress(r.progress)}</td></tr>`).join("") || '<tr><td colspan="6">Aucun résultat. Ajustez les filtres ou ajoutez une entrée.</td></tr>'}</tbody></table></div>`;
  }
  function kanban(rows, kind) {
    const statuses =
      kind === "action"
        ? ["Ouvert", "En cours", "Clos"]
        : kind === "plan"
          ? ["Planifié", "En cours", "Réalisé", "Annulé"]
          : ["En retard", "À faire bientôt", "À jour", "Suspendue"];
    return `<p class="as-note">${kind === "action" ? "Déplacez une action pour changer son statut. Le menu de la fiche propose la même action au clavier." : kind === "rec" ? "Les colonnes sont calculées à partir des échéances et réalisations. Enregistrez une réalisation depuis la fiche." : "Le statut se modifie dans la fiche du programme."}</p><div class="as-kanban" style="--columns:${statuses.length}">${statuses
      .map((st) => {
        const rs = rows.filter((r) => r.status === st);
        return `<section class="as-column" data-astra-drop="${E(st)}"><h3>${pill(st, tone(st))}<span>${rs.length}</span></h3>${rs.map((r) => `<article class="as-task" ${kind === "action" && !A.readOnly() ? `draggable="true" data-astra-drag="${E(r.id)}"` : ""}><small>${E(r.id)} · ${E(r.priority)}</small>${openButton(r)}<p>${E(r.owner)}</p><div>${pill(late(r) ? "En retard" : date(r.due), late(r) ? "bad" : "neutral")}</div>${r.progress !== null ? `<div class="as-inline-progress">${progress(r.progress)}</div>` : `<small>${E(kind === "rec" ? B.recFreq(r.raw) : r.group)}</small>`}</article>`).join("") || '<p class="as-column-empty">Aucun élément</p>'}</section>`;
      })
      .join("")}</div>`;
  }
  function timeControls(kind, planning = false) {
    return `<div class="as-filters">${select(
      kind + "Zoom",
      "Échelle",
      planning
        ? [
            ["day", "Jour"],
            ["week", "Semaine"],
            ["month", "Mois"],
          ]
        : [
            ["month", "Mois"],
            ["quarter", "Trimestre"],
            ["year", "Année"],
          ],
      pref(kind + "Zoom", planning ? "week" : "quarter"),
    )}<label class="as-filter">Date de référence<input type="date" data-astra-pref="${kind}Anchor" data-ro-ok value="${E(pref(kind + "Anchor", today()))}"></label>${select(
      kind + "Group",
      "Regrouper par",
      [
        ["group", "Domaine / origine"],
        ["owner", "Responsable"],
      ],
      pref(kind + "Group", "group"),
    )}</div>`;
  }
  function events(rows, from, to) {
    const out = [];
    for (const r of rows) {
      if (r.kind !== "rec") {
        if (r.due) out.push({ ...r, eventDate: r.due, eventLabel: r.status });
        continue;
      }
      if (r.raw.active !== false) {
        for (let y = from.getFullYear(); y <= to.getFullYear(); y++)
          B.recOccurrences(r.raw, y).forEach((d) => {
            const day = iso(d);
            if (
              day >= iso(from) &&
              day <= iso(to) &&
              (day >= r.raw.start || !r.raw.start)
            )
              out.push({
                ...r,
                eventDate: day,
                eventLabel:
                  day < r.due
                    ? "Échéance théorique passée"
                    : day === r.due
                      ? "Prochaine échéance"
                      : "Projection",
              });
          });
      }
      for (const h of r.raw.history || [])
        if (h.date >= iso(from) && h.date <= iso(to))
          out.push({
            ...r,
            eventDate: h.date,
            eventLabel: "Réalisée",
            history: h,
          });
    }
    return out;
  }
  function timeline(rows, kind, planning = false) {
    const zoom = pref(kind + "Zoom", planning ? "week" : "quarter"),
      anchor = new Date(pref(kind + "Anchor", today()) + "T12:00:00");
    let start = new Date(anchor),
      end = new Date(anchor);
    if (zoom === "day") {
      end.setDate(start.getDate() + 1);
    } else if (zoom === "week") {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else if (zoom === "year") {
      start = new Date(anchor.getFullYear(), 0, 1, 12);
      end = new Date(anchor.getFullYear() + 1, 0, 1, 12);
    } else {
      start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
      end = new Date(
        anchor.getFullYear(),
        anchor.getMonth() + (zoom === "quarter" ? 3 : 1),
        1,
        12,
      );
    }
    const span = end - start,
      ticks =
        zoom === "year"
          ? 12
          : zoom === "quarter"
            ? 3
            : zoom === "week"
              ? 7
              : zoom === "day"
                ? 1
                : new Date(
                    anchor.getFullYear(),
                    anchor.getMonth() + 1,
                    0,
                  ).getDate();
    const group = pref(kind + "Group", "group"),
      groups = [...new Set(rows.map((r) => r[group]))];
    const marks = events(rows, start, end);
    const grid = groups
      .map(
        (g) =>
          `<div class="as-timeline-group">${E(g)}</div>${rows
            .filter((r) => r[group] === g)
            .map((r) => {
              let bars = "";
              if (kind === "rec")
                bars = marks
                  .filter((m) => m.id === r.id)
                  .map(
                    (m) =>
                      `<button type="button" class="as-milestone ${m.history ? "good" : ""}" style="left:${Math.max(0, Math.min(99, ((new Date(m.eventDate + "T12:00:00") - start) / span) * 100))}%" data-astra="occurrence" data-id="${E(r.id)}" data-date="${m.eventDate}" data-label="${E(m.eventLabel)}" title="${E(r.title + " · " + date(m.eventDate) + " · " + m.eventLabel)}">◆</button>`,
                  )
                  .join("");
              else {
                const d = r.due ? new Date(r.due + "T12:00:00") : null,
                  st = r.start ? new Date(r.start + "T12:00:00") : null;
                if (
                  d &&
                  d >= start &&
                  (!st || st <= d) &&
                  ((st && st < end) || d < end)
                ) {
                  const left = Math.max(0, (((st || d) - start) / span) * 100),
                    right = Math.min(100, ((d - start) / span) * 100);
                  bars = st
                    ? `<button type="button" class="as-gantt-bar ${late(r) ? "late" : ""}" style="left:${left}%;width:${Math.max(0.6, right - left)}%" data-astra="work-detail" data-kind="${kind}" data-id="${E(r.id)}" title="${E(r.title + " · " + date(r.start) + " → " + date(r.due))}"><span style="width:${r.progress || 0}%"></span><b>${E(r.title)}</b></button>`
                    : `<button type="button" class="as-milestone ${late(r) ? "late" : ""}" style="left:${Math.min(98, left)}%" data-astra="work-detail" data-kind="${kind}" data-id="${E(r.id)}" title="${E("Échéance : " + date(r.due))}">◆</button>`;
                }
              }
              return `<div class="as-timeline-row"><div class="as-timeline-label">${openButton(r)}<small>${E(r.owner)} · ${kind === "rec" ? E(B.recFreq(r.raw)) : r.due ? date(r.due) : "Sans échéance"}</small></div><div class="as-track" style="--ticks:${ticks}">${bars}</div></div>`;
            })
            .join("")}`,
      )
      .join("");
    return (
      timeControls(kind, planning) +
      `<p class="as-note">${date(iso(start))} → ${date(iso(new Date(end.getTime() - 864e5)))} · ◆ Échéance / occurrence${kind === "action" ? " · Une durée est affichée uniquement si une date de début existe." : ""}${kind === "rec" ? " · Vert : réalisation enregistrée. Les projections suivent la récurrence actuelle." : ""}</p><div class="as-timeline"><div class="as-timeline-row as-timeline-head"><b>Activité / responsable</b><div class="as-ticks">${Array.from(
        { length: ticks },
        (_, i) => {
          const d = new Date(start);
          if (zoom === "year" || zoom === "quarter")
            d.setMonth(d.getMonth() + i);
          else d.setDate(d.getDate() + i);
          return `<span>${E(new Intl.DateTimeFormat("fr-FR", zoom === "year" || zoom === "quarter" ? { month: "short" } : { day: "numeric", month: ticks < 8 ? "short" : undefined }).format(d))}</span>`;
        },
      ).join(
        "",
      )}</div></div>${grid || empty("Aucune activité", "Ajustez les filtres.")}</div>`
    );
  }
  function calendar(rows, kind) {
    const anchor = pref(kind + "Month", today().slice(0, 7)),
      [y, m] = anchor.split("-").map(Number),
      first = new Date(y, m - 1, 1, 12),
      start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 41);
    const ev = events(rows, start, end);
    return `<div class="as-filters">${btn("←", "month", `data-kind="${kind}" data-delta="-1" aria-label="Mois précédent"`)}<label class="as-filter">Mois<input type="month" data-astra-pref="${kind}Month" data-ro-ok value="${E(anchor)}"></label>${btn("→", "month", `data-kind="${kind}" data-delta="1" aria-label="Mois suivant"`)}</div>${kind === "rec" ? '<p class="as-note">↻ Projections selon la série actuelle. Les réalisations sont affichées à leur date réelle ; une projection passée ne prouve pas une réalisation.</p>' : ""}<div class="as-calendar-wrap"><div class="as-calendar">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<div class="as-weekday">${d}</div>`).join("")}${Array.from(
      { length: 42 },
      (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const day = iso(d),
          items = ev.filter((e) => e.eventDate === day);
        return `<section class="as-day ${d.getMonth() !== m - 1 ? "outside" : ""} ${day === today() ? "today" : ""}"><time datetime="${day}">${d.getDate()}</time>${items.map((r) => `<button type="button" class="as-event ${r.history ? "good" : r.eventDate < today() && !done(r) ? "late" : ""}" data-astra="${kind === "rec" ? "occurrence" : "work-detail"}" data-kind="${kind}" data-id="${E(r.id)}" data-date="${day}" data-label="${E(r.eventLabel)}" title="${E(r.title + " · " + r.owner + " · " + r.eventLabel)}">${kind === "rec" ? "↻ " : ""}${E(r.title)}<small>${E(r.eventLabel)}</small></button>`).join("")}</section>`;
      },
    ).join(
      "",
    )}</div></div>${rows.filter((r) => !r.due).length ? `<p class="as-note">${rows.filter((r) => !r.due).length} activité(s) sans échéance : accessibles en Liste.</p>` : ""}`;
  }
  function summary(rows) {
    const owners = [...new Set(rows.map((r) => r.owner))],
      statuses = [...new Set(rows.map((r) => r.status))],
      p = rows.filter((r) => r.progress !== null);
    return `<div class="as-metrics">${metric(rows.length, "Actions au total")}${metric(rows.filter((r) => !done(r)).length, "Ouvertes")}${metric(rows.filter(late).length, "En retard", "", "", "bad")}${metric(rows.filter((r) => r.priority === "NC maj").length, "Priorité majeure")}</div><div class="as-two"><section class="as-surface"><h3>Répartition par statut</h3>${statuses.map((st) => `<div class="as-bar-row"><span>${E(st)}</span><meter min="0" max="${rows.length || 1}" value="${rows.filter((r) => r.status === st).length}"></meter><b>${rows.filter((r) => r.status === st).length}</b></div>`).join("")}<h4>Avancement des sous-actions</h4>${p.length ? progress(Math.round(p.reduce((n, r) => n + r.progress, 0) / p.length)) : "Non renseigné"}</section><section class="as-surface"><h3>Charge par responsable</h3>${owners.map((owner) => `<div class="as-bar-row"><span>${E(owner)}</span><meter min="0" max="${rows.length || 1}" value="${rows.filter((r) => r.owner === owner).length}"></meter><b>${rows.filter((r) => r.owner === owner).length}</b></div>`).join("")}</section></div><section class="as-surface"><h3>Échéances prochaines et retards</h3>${workTable(
      rows
        .filter((r) => !done(r) && r.due)
        .sort((a, b) => a.due.localeCompare(b.due))
        .slice(0, 10),
    )}</section>`;
  }
  function workspace(kind) {
    const key = kind + "View",
      options = [
        ["list", "Liste"],
        ["kanban", "Kanban"],
        ["planning", "Planning"],
        ["calendar", "Calendrier"],
        ...(kind === "rec"
          ? []
          : [
              ["gantt", "Gantt"],
              ["summary", "Synthèse"],
            ]),
      ],
      view = pref(key, "list"),
      rows = filtered(kind),
      all = workRows(kind);
    const title =
      kind === "rec"
        ? "Tâches récurrentes"
        : kind === "plan"
          ? "Programmes du SMSI"
          : "Plans d’action";
    if (kind === "action" && ui().ecView === "actions") return old.ecarts();
    if (pref(kind + "Advanced", false))
      return (
        `<div class="as-toolbar">${btn("Revenir à la vue de consultation", "advanced", `data-kind="${kind}"`)}</div>` +
        (kind === "action" ? old.ecarts() : old.plans())
      );
    return (
      head(
        "Opérations / " + title,
        title,
        kind === "rec"
          ? "Les activités à réaliser, leurs prochaines échéances et leur historique."
          : kind === "plan"
            ? "Formation, sensibilisation, audits internes et exercices."
            : "Du constat à la remédiation : un registre commun, plusieurs façons de travailler.",
        btn("Options et saisie détaillée", "advanced", `data-kind="${kind}"`) +
          (A.readOnly()
            ? ""
            : kind === "action"
              ? btn("+ Nouvelle action", "new-action", "", true)
              : kind === "rec"
                ? '<button type="button" class="btn primary" data-act="recnew">+ Nouvelle tâche</button>'
                : btn("+ Programmer", "new-plan", "", true)),
      ) +
      `<div class="as-toolbar">${views(key, options)}<span class="as-count">${rows.length} / ${all.length}</span></div><div class="as-filters">${search(kind + "Query", pref(kind + "Query", ""))}${select(kind + "Status", "Statut", [["", "Tous"], ["late", "En retard"], ...[...new Set(all.map((r) => r.status))]], pref(kind + "Status", ""))}${select(kind + "Owner", "Responsable", [["", "Tous"], ...[...new Set(all.map((r) => r.owner))]], pref(kind + "Owner", ""))}${select(
        kind + "Sort",
        "Trier par",
        [
          ["due", "Échéance"],
          ["title", "Titre"],
          ["owner", "Responsable"],
        ],
        pref(kind + "Sort", "due"),
      )}</div>` +
      (view === "list"
        ? `<section class="as-surface">${workTable(rows)}</section>`
        : view === "kanban"
          ? kanban(rows, kind)
          : view === "calendar"
            ? calendar(rows, kind)
            : view === "summary"
              ? summary(rows)
              : timeline(rows, kind, view === "planning"))
    );
  }
  function workDetail(kind, id) {
    const r = workRows(kind).find((r) => r.id === id);
    if (!r) return;
    const x = r.raw;
    detail(
      r.title,
      `${pill(r.status, tone(r.status))}${late(r) ? pill("En retard", "bad") : ""}<dl class="as-facts"><dt>Référence</dt><dd>${E(id)}</dd><dt>Responsable</dt><dd>${E(r.owner)}</dd><dt>Échéance</dt><dd>${date(r.due)}</dd><dt>${kind === "rec" ? "Fréquence" : "Priorité / type"}</dt><dd>${E(kind === "rec" ? B.recFreq(x) : r.priority)}</dd></dl>${r.progress !== null ? `<h3>Avancement</h3>${progress(r.progress)}` : ""}<h3>Description</h3><p class="as-preline">${E(x.desc || x.notes || x.action || "À documenter")}</p>${
        kind === "action"
          ? `<h3>Sous-actions</h3><ul class="as-checklist">${(x.tasks || []).map((t) => `<li>${t.done ? "✓" : "○"} ${E(t.t)}</li>`).join("") || "<li>Aucune sous-action.</li>"}</ul><h3>Preuves</h3><p>${E(x.proof || "Aucune preuve textuelle renseignée.")}</p>${S()
              .evidences.filter((e) => e.links?.findings?.includes(id))
              .map((e) => `<p>${E(e.title)} · ${E(e.status)}</p>`)
              .join(
                "",
              )}${!A.readOnly() ? `<label class="as-filter">Changer le statut<select data-astra-status="${E(id)}">${["Ouvert", "En cours", "Clos"].map((st) => `<option ${st === r.status ? "selected" : ""}>${st}</option>`).join("")}</select></label>` : ""}`
          : ""
      }${
        kind === "rec"
          ? `<h3>Historique des réalisations</h3>${
              (x.history || [])
                .slice()
                .reverse()
                .map(
                  (h) =>
                    `<div class="as-detail-section"><strong>${date(h.date)} · ${E(h.by)}</strong><p>${E(h.comment || "Sans commentaire")}</p><p>${E(h.proof || "Sans preuve")}</p></div>`,
                )
                .join("") || "<p>Aucune réalisation enregistrée.</p>"
            }<p class="as-note">L’édition de la série modifie sa planification future. Les réalisations restent historisées. Ce moteur ne propose pas de modification isolée d’une occurrence projetée.</p>`
          : ""
      }`,
      !A.readOnly()
        ? btn(
            kind === "rec"
              ? "Modifier la série / enregistrer une réalisation"
              : "Modifier la fiche",
            "work-edit",
            `data-kind="${kind}" data-id="${E(id)}"`,
            true,
          )
        : "",
    );
  }
  function occurrence(id, day, label) {
    const r = workRows("rec").find((r) => r.id === id);
    if (!r) return;
    const hs = (r.raw.history || []).filter((h) => h.date === day);
    detail(
      r.title,
      `${pill("↻ Tâche récurrente")}<h3>${date(day)}</h3>${pill(label, tone(label))}<p>${E(r.owner)} · ${E(B.recFreq(r.raw))}</p><p>Prochaine échéance calculée : <strong>${date(r.due)}</strong></p>${hs.map((h) => `<div class="as-detail-section"><h4>Réalisation enregistrée</h4><p>${E(h.by)} · ${E(h.comment)}</p><p>${E(h.proof || "Sans preuve")}</p></div>`).join("") || "<p>Projection de la série actuelle, sans réalisation enregistrée à cette date.</p>"}<p class="as-note">Une réalisation recalcule la prochaine échéance selon la règle existante. Les projections ne sont pas des occurrences stockées indépendamment.</p>`,
      btn(
        "Consulter la série",
        "work-detail",
        `data-kind="rec" data-id="${E(id)}"`,
      ) +
        (!A.readOnly()
          ? btn(
              "Enregistrer une réalisation",
              "work-edit",
              `data-kind="rec" data-id="${E(id)}"`,
              true,
            )
          : ""),
    );
  }
  function complianceRows() {
    if (ui().confView === "fw") {
      const fw = B.fwActive();
      return (fw?.requirements || []).filter(B.reqInScope).map((r) => ({
        id: r.id,
        title: r.text,
        group: r.objective || r.theme || "Exigences",
        status: B.reqEffective(r) || "À évaluer",
        declared: r.self || "Non déclarée",
        presumed: B.reqPresumed(r) || "Non établie",
        raw: r,
        fw: true,
        proof: null,
      }));
    }
    return S()
      .items.filter((i) => i.ref === (ui().confView || "A"))
      .map((i) => {
        const d = S().dda[i.id] || {};
        return {
          id: i.id,
          title: i.title,
          group:
            S().groups.find((g) => g.id === i.group)?.title || i.group || i.ref,
          status: d.app === "non" ? "Non applicable" : d.level || "À évaluer",
          declared: d.level || "Non déclarée",
          proof: !!(
            d.docs ||
            d.url ||
            S().evidences.some(
              (e) =>
                e.links?.items?.includes(i.id) && e.status === "Disponible",
            )
          ),
          raw: i,
        };
      });
  }
  function compliance() {
    if (pref("confAdvanced", false))
      return (
        btn("Revenir à la consultation", "conf-advanced") + old.conformite()
      );
    const all = complianceRows(),
      app = all.filter((r) => r.status !== "Non applicable"),
      total = app.filter((r) =>
        ["Total", "Conforme"].includes(r.status),
      ).length,
      score = app.length ? Math.round((100 * total) / app.length) : null;
    const q = pref("confQuery", "").toLowerCase(),
      f = pref("confFilter", "");
    const rows = all.filter(
      (r) =>
        (!q ||
          (r.id + " " + r.title + " " + r.group).toLowerCase().includes(q)) &&
        (!f ||
          (f === "gap"
            ? !["Total", "Conforme", "Non applicable"].includes(r.status)
            : f === "proof"
              ? r.proof === false
              : r.status === f)),
    );
    const groups = [...new Set(all.map((r) => r.group))];
    return (
      head(
        "Gouvernance / Conformité",
        ui().confView === "fw"
          ? B.fwActive()?.name || "Référentiels"
          : {
              A: "Déclaration d’applicabilité",
              ISO: "ISO 27001",
              HDS: "Hébergement des données de santé",
            }[ui().confView] || "Conformité",
        "Identifier les écarts, documenter les preuves et préparer l’évaluation.",
        btn("Options et saisie détaillée", "conf-advanced"),
      ) +
      `<div class="as-compliance-top"><section class="as-score"><div class="as-ring" style="--score:${score || 0}"><strong>${score === null ? "—" : score + " %"}</strong></div><div><p class="as-eyebrow">${ui().confView === "fw" ? "État effectif selon le moteur" : "Mise en œuvre déclarée"}</p><h3>${total} / ${app.length} exigences ${ui().confView === "fw" ? "conformes" : "en mise en œuvre totale"}</h3><p>Le score ne vaut pas validation des preuves ni certification.</p></div></section><div class="as-metrics">${metric(app.length - total, "À examiner", "conf-filter", 'data-value="gap"')}${ui().confView === "fw" ? metric("—", "Preuves : non calculées") : metric(all.filter((r) => r.proof === false).length, "Sans preuve disponible", "conf-filter", 'data-value="proof"')}</div></div><section class="as-surface"><h3>Maîtrise par domaine</h3><div class="as-domains">${groups
        .map((g) => {
          const rs = app.filter((r) => r.group === g),
            n = rs.filter((r) =>
              ["Total", "Conforme"].includes(r.status),
            ).length;
          return `<button type="button" class="as-domain" data-astra="conf-domain" data-value="${E(g)}"><span>${E(g)}</span><meter min="0" max="${rs.length || 1}" value="${n}"></meter><b>${n} / ${rs.length}</b></button>`;
        })
        .join(
          "",
        )}</div></section><div class="as-filters">${search("confQuery", pref("confQuery", ""))}${select("confFilter", "Afficher", [["", "Toutes"], ["gap", "Écarts et non évaluées"], ...(ui().confView === "fw" ? [] : [["proof", "Sans preuve disponible"]])], f)}${btn("Réinitialiser", "conf-reset")}</div><section class="as-surface as-requirements">${
        [...new Set(rows.map((r) => r.group))]
          .map(
            (g) =>
              `<details open><summary>${E(g)} <span class="as-count">${rows.filter((r) => r.group === g).length}</span></summary><div class="as-table-scroll"><table class="as-table"><thead><tr><th>Exigence / mesure</th><th>${ui().confView === "fw" ? "Déclaration / couverture présumée" : "Mise en œuvre"}</th><th>${ui().confView === "fw" ? "État effectif" : "Preuve"}</th><th>Écarts</th></tr></thead><tbody>${rows
                .filter((r) => r.group === g)
                .map(
                  (r) =>
                    `<tr><td>${btn(r.title, "control", `data-id="${E(r.id)}"`)}<small>${E(r.id)}</small></td><td>${pill(r.fw ? r.declared : r.status, tone(r.fw ? r.declared : r.status))}${r.fw ? `<small>Présumée : ${E(r.presumed)}</small>` : ""}</td><td>${r.fw ? pill(r.status, tone(r.status)) : pill(r.proof ? "Disponible" : "À documenter", r.proof ? "good" : "warn")}</td><td>${S().findings.filter((f) => f.status !== "Clos" && f.items?.includes(r.id)).length}</td></tr>`,
                )
                .join("")}</tbody></table></div></details>`,
          )
          .join("") ||
        empty(
          "Aucune exigence",
          "Ajustez vos filtres ou importez un référentiel.",
        )
      }</section>`
    );
  }
  function control(id) {
    const r = complianceRows().find((r) => r.id === id);
    if (!r) return;
    detail(
      r.title,
      `<p>${E(r.id)} · ${E(r.group)}</p>${pill(r.status, tone(r.status))}${r.fw ? `<dl class="as-facts"><dt>Déclaration</dt><dd>${E(r.declared)}</dd><dt>Couverture présumée</dt><dd>${E(r.presumed)}</dd><dt>État effectif</dt><dd>${E(r.status)}</dd></dl><p>${E(r.raw.comment || "Aucun commentaire.")}</p>` : `<h3>Justification et actions</h3><p>${E(S().dda[id]?.just || S().dda[id]?.actions || "À documenter")}</p><h3>Preuves</h3><p>${E(S().dda[id]?.docs || "Aucun document déclaré.")}</p><p>${E(S().dda[id]?.url || "")}</p>`}<h3>Actions et écarts liés</h3>${
        S()
          .findings.filter((f) => f.items?.includes(id))
          .map((f) =>
            btn(
              f.text || f.id,
              "work-detail",
              `data-kind="action" data-id="${E(f.id)}"`,
            ),
          )
          .join("") || "<p>Aucun écart lié.</p>"
      }`,
      !A.readOnly()
        ? btn("Évaluer / modifier", "control-edit", `data-id="${E(id)}"`, true)
        : "",
    );
  }
  function cockpit() {
    if (pref("cockpitAdvanced", false))
      return (
        btn("Revenir au cockpit", "cockpit-advanced") + old.dash(lastAnalysis)
      );
    const s = S(),
      rs = LegacyRisks.rows(s, { stage: "residual" }).filter(
        (r) => r.risk.status !== "Archivé",
      ),
      initial = LegacyRisks.rows(s, { stage: "initial" }),
      high = rs.filter((r) => r.level?.acceptability === "Traitement requis"),
      evaluated = rs.filter((r) => r.assessment),
      actions = workRows("action"),
      recs = workRows("rec"),
      inc = (s.incidents || []).filter(B.incOpen),
      lateActions = actions.filter(late),
      percent = actions.length
        ? Math.round(
            (100 * actions.filter((r) => r.status === "Clos").length) /
              actions.length,
          )
        : 0;
    const priority = [
      ...lateActions.map((r) => ({
        title: r.title,
        meta: "Action en retard · " + date(r.due),
        act: "work-detail",
        attrs: `data-kind="action" data-id="${E(r.id)}"`,
        tone: "bad",
      })),
      ...high.map((r) => ({
        title: r.risk.title,
        meta: r.level.label + " · Traitement requis",
        act: "risk-detail",
        attrs: `data-id="${E(r.risk.id)}"`,
        tone: "warn",
      })),
      ...recs.filter(late).map((r) => ({
        title: r.title,
        meta: "Tâche récurrente · " + date(r.due),
        act: "work-detail",
        attrs: `data-kind="rec" data-id="${E(r.id)}"`,
        tone: "warn",
      })),
    ];
    return (
      head(
        "Pilotage & stratégie",
        "Cockpit RSSI",
        "Une lecture partagée de votre posture de sécurité et des décisions à prendre.",
        btn("Tableaux de bord détaillés", "cockpit-advanced") +
          btn("Reporting direction", "navigate", 'data-tab="rapports"'),
      ) +
      `<div class="as-cockpit-intro"><div><span class="as-eyebrow">Votre agenda de décision</span><h2>${priority.length ? priority.length + " points méritent votre attention" : "Les priorités se construisent ici"}</h2><p>Référence résiduelle : ${evaluated.length} / ${rs.length} risques. Sans référence résiduelle : ${rs.length - evaluated.length}.</p></div><div class="as-intro-stamp">${E(new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date()))}<span>Données de votre périmètre autorisé</span></div></div><div class="as-metrics as-cockpit-metrics">${metric(high.length, "Risques à traiter", "navigate", 'data-tab="risks"', "warn")}${metric(lateActions.length, "Actions en retard", "late-actions", "", "bad")}${metric(recs.filter(late).length, "Récurrences en retard", "late-rec", "", "warn")}${metric(inc.length, "Incidents ouverts", "navigate", 'data-tab="incidents"')}</div>
      <div class="as-cockpit-grid"><section class="as-surface"><div class="as-section-title"><div><p class="as-eyebrow">Prioriser</p><h3>À traiter en premier</h3></div><span class="as-count">${priority.length}</span></div>${
        priority
          .slice(0, 8)
          .map(
            (p, i) =>
              `<div class="as-priority"><span class="as-priority-n ${p.tone}">${String(i + 1).padStart(2, "0")}</span><div>${btn(p.title, p.act, p.attrs)}<small>${E(p.meta)}</small></div><span>→</span></div>`,
          )
          .join("") ||
        empty(
          "Aucune alerte calculée",
          "Les risques sans évaluation doivent encore être appréciés.",
        )
      }${priority.length > 8 ? '<p class="as-note">Les compteurs ci-dessus donnent accès à toutes les priorités.</p>' : ""}</section><section class="as-surface"><p class="as-eyebrow">Contrôler</p><h3>Conformité des référentiels</h3>${[
        "ISO",
        "A",
        "HDS",
      ]
        .map((ref) => {
          const st = B.ddaStats(ref);
          return `<button class="as-compliance-row" type="button" data-astra="conf-nav" data-ref="${ref}"><span>${{ ISO: "ISO 27001", A: "Annexe A", HDS: "HDS" }[ref]}<small>${st.c.Total} / ${st.app} mesures en mise en œuvre totale</small></span><strong>${st.app ? st.pct + " %" : "—"}</strong><meter min="0" max="100" value="${st.pct}"></meter></button>`;
        })
        .join(
          "",
        )}<p class="as-note">Déclarations de mise en œuvre. Consultez les preuves et les écarts avant toute décision.</p></section><section class="as-surface"><p class="as-eyebrow">Agir</p><h3>Progression des plans d’action</h3><div class="as-big-number">${percent}<small>% clôturées</small></div>${progress(percent)}<p>${actions.filter((r) => r.status === "En cours").length} en cours · ${actions.filter((r) => r.status === "Ouvert").length} ouvertes</p>${btn("Ouvrir les plans d’action →", "navigate", 'data-tab="ecarts"')}</section><section class="as-surface"><p class="as-eyebrow">Analyser</p><h3>Évolution des évaluations</h3>${
        s.riskMgmt.assessments.length
          ? `<div class="as-assessment-history">${s.riskMgmt.assessments
              .slice()
              .sort((a, b) => String(b.date).localeCompare(String(a.date)))
              .slice(0, 5)
              .map(
                (a) =>
                  `<div><time>${date(a.date)}</time><span>${E(s.riskMgmt.risks.find((r) => r.id === a.riskId)?.title || a.riskId)}<small>${a.stage === "initial" ? "Initial" : "Résiduel"} · ${E(s.riskMgmt.policies.find((p) => p.id === a.policyId)?.levels.find((l) => l.id === a.levelId)?.label || "Non évalué")}</small></span></div>`,
              )
              .join("")}</div>`
          : "<p>Aucune évaluation historisée. Les tendances apparaîtront à partir des évaluations réelles.</p>"
      }${btn("Analyser les risques →", "risk-matrix")}</section></div><section class="as-surface"><div class="as-section-title"><div><p class="as-eyebrow">Observer</p><h3>Risques : références initiales</h3></div>${btn("Ouvrir la matrice", "risk-matrix")}</div>${initial.length ? `<div class="as-risk-strip">${initial.map((r) => `<button type="button" data-astra="risk-detail" data-id="${E(r.risk.id)}" style="--risk-color:${E(levelColor(r.level))}"><b>${E(r.level?.label || "Non évalué")}</b><span>${E(r.risk.title)}</span></button>`).join("")}</div>` : empty("Registre central vide", "Documentez les risques pour éclairer les arbitrages.")}</section>`
    );
  }
  async function status(id, value) {
    if (A.readOnly()) throw Error("Mode lecture seule.");
    const f = S().findings.find((f) => f.id === id);
    if (!f) throw Error("Action introuvable.");
    if (
      value === "Clos" &&
      f.status !== "Clos" &&
      !(await A.confirm(
        "Clôturer cette action ? Comme dans le registre, toutes ses sous-actions seront marquées réalisées.",
      ))
    )
      return false;
    await U.mutate((state) =>
      B.setFindingStatus(
        state.findings.find((row) => row.id === id),
        value,
      ),
    );
    A.render();
    return true;
  }
  function legacyAction(name, attrs = {}) {
    const b = document.createElement("button");
    b.dataset.act = name;
    Object.assign(b.dataset, attrs);
    document.body.append(b);
    b.click();
    b.remove();
  }
  async function click(e) {
    const el = e.target.closest("[data-astra]");
    if (!el) return;
    const d = el.dataset,
      act = d.astra;
    try {
      if (act === "close") closeDetail();
      else if (act === "view") {
        prefs[d.key] = d.value;
        A.render();
      } else if (act === "risk-detail") riskDetail(d.id);
      else if (act === "risk-edit") {
        if (A.readOnly()) return;
        closeDetail();
        LegacyRiskUI.open("risk", d.id);
      } else if (act === "risk-full") {
        closeDetail();
        A.navigate("risks", { riskView: "register", riskId: d.id });
      } else if (act === "risk-cell") {
        prefs.riskCell = d.id;
        A.render();
      } else if (act === "risk-matrix") {
        prefs.riskView = "matrix";
        A.navigate("risks", { riskView: "map", riskId: "" });
      } else if (act === "work-detail") workDetail(d.kind, d.id);
      else if (act === "work-edit") {
        if (A.readOnly()) return;
        closeDetail();
        A.openSheet(d.kind === "action" ? "fd" : d.kind, d.id);
      } else if (act === "occurrence") occurrence(d.id, d.date, d.label);
      else if (act === "advanced") {
        prefs[d.kind + "Advanced"] = !pref(d.kind + "Advanced", false);
        A.render();
      } else if (act === "new-action") {
        if (A.readOnly()) return;
        const before = new Set(S().findings.map((f) => f.id));
        legacyAction("newfd");
        const f = S().findings.find((f) => !before.has(f.id));
        if (f) A.openSheet("fd", f.id);
      } else if (act === "new-plan") {
        if (A.readOnly()) return;
        U.dialog(
          "Programmer une activité",
          U.select(
            "type",
            "Programme",
            Object.entries(B.PLAN_T).map(([value, t]) => ({
              value,
              label: t.pl,
            })),
          ),
          async (fd) => {
            prefs.planAdvanced = true;
            A.navigate("plans", { planView: fd.get("type") });
            setTimeout(() => legacyAction("pladd", { t: fd.get("type") }), 0);
          },
        );
      } else if (act === "month") {
        const [y, m] = pref(d.kind + "Month", today().slice(0, 7))
          .split("-")
          .map(Number);
        prefs[d.kind + "Month"] = iso(
          new Date(y, m - 1 + Number(d.delta), 1),
        ).slice(0, 7);
        A.render();
      } else if (act === "conf-advanced") {
        prefs.confAdvanced = !pref("confAdvanced", false);
        A.render();
      } else if (act === "conf-filter") {
        prefs.confFilter = d.value;
        A.render();
      } else if (act === "conf-domain") {
        prefs.confQuery = d.value;
        A.render();
      } else if (act === "conf-reset") {
        prefs.confQuery = "";
        prefs.confFilter = "";
        A.render();
      } else if (act === "control") control(d.id);
      else if (act === "control-edit") {
        if (A.readOnly()) return;
        closeDetail();
        if (ui().confView === "fw") {
          const r = B.fwActive()?.requirements.find((r) => r.id === d.id);
          if (r)
            U.dialog(
              "Évaluer l’exigence · " + r.id,
              U.select(
                "self",
                "Déclaration",
                ["Conforme", "Partiel", "Non conforme", "Non applicable"],
                r.self,
              ) + U.area("comment", "Commentaire", r.comment),
              (fd) =>
                U.mutate(() => {
                  r.self = fd.get("self");
                  r.comment = fd.get("comment");
                }),
            );
        } else B.openControl(d.id);
      } else if (act === "cockpit-advanced") {
        prefs.cockpitAdvanced = !pref("cockpitAdvanced", false);
        A.render();
      } else if (act === "navigate") {
        closeDetail();
        A.navigate(
          d.tab,
          d.tab === "risks" ? { riskView: "register", riskId: "" } : {},
        );
      } else if (act === "conf-nav") {
        prefs.confAdvanced = false;
        prefs.confQuery = "";
        prefs.confFilter = "";
        A.navigate("conformite", { confView: d.ref });
      } else if (act === "late-actions") {
        prefs.actionStatus = "late";
        prefs.actionView = "list";
        prefs.actionAdvanced = false;
        A.navigate("ecarts", { ecView: "list" });
      } else if (act === "late-rec") {
        prefs.recStatus = "late";
        prefs.recView = "list";
        prefs.recAdvanced = false;
        A.navigate("plans", { planView: "rec" });
      }
    } catch (err) {
      A.toast(err.message);
    }
  }
  function afterRender() {
    // Keep risk exports on the very same filter state as the visual analysis.
    ui().riskMapStage = pref("riskStage", "initial");
    ui().riskMapPerimeter = pref("riskScope", "");
    ui().riskMapQuery = pref("riskQuery", "");
    ui().riskMapStatus = pref("riskStatus", "");
    document
      .querySelectorAll(".side .mn")
      .forEach((b) => b.setAttribute("aria-label", b.textContent.trim()));
    document
      .querySelector(".side-brand")
      ?.setAttribute("aria-label", "ASTRA · Gouvernance cybersécurité");
    if (!document.getElementById("as-collapse")) {
      const b = document.createElement("button");
      b.id = "as-collapse";
      b.type = "button";
      b.className = "as-collapse";
      b.textContent = "Réduire la navigation";
      b.setAttribute("aria-expanded", "true");
      b.onclick = () => {
        const small = document.body.classList.toggle("as-nav-compact");
        b.textContent = small ? "Développer" : "Réduire la navigation";
        b.setAttribute("aria-expanded", String(!small));
      };
      document.querySelector(".side-foot")?.prepend(b);
    }
    // Legacy tables stay editable on demand, without removing controls or their handlers.
    const panel = document.getElementById("panel");
    if (!panel || panel.querySelector(".as-head")) return;
    const fields = [
      ...panel.querySelectorAll(
        "td input:not([type=checkbox]):not([type=hidden]),td textarea,td select",
      ),
    ].filter((x) => !x.hasAttribute("data-ro-ok") && !x.closest(".filters"));
    if (!fields.length) return;
    const key =
      ui().tab + ":" + (ui().confView || "") + ":" + (ui().pilView || "");
    if (!pref("edit:" + key, false)) {
      fields.forEach((input) => {
        const text = document.createElement("span");
        text.className = "as-read-value";
        text.textContent =
          input.tagName === "SELECT"
            ? input.selectedOptions[0]?.textContent || "—"
            : input.value || "—";
        input.before(text);
        input.hidden = true;
      });
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn as-edit-view";
    b.textContent = pref("edit:" + key, false)
      ? "Terminer la saisie"
      : "Modifier les données de cette vue";
    b.disabled = A.readOnly();
    b.onclick = () => {
      prefs["edit:" + key] = !pref("edit:" + key, false);
      A.render();
    };
    panel.prepend(b);
  }
  LegacyIntegrationUI.register({
    install(u) {
      U = u;
      A = U.api();
      B = A.astra;
      for (const id of ["dash", "ecarts", "plans", "risks", "conformite"]) {
        const t = A.TABS.find((t) => t.id === id);
        old[id] = t.view;
        t.view =
          id === "dash"
            ? (an) => {
                lastAnalysis = an;
                return ui().dashView === "map" ? old.dash(an) : cockpit();
              }
            : id === "ecarts"
              ? () => workspace("action")
              : id === "plans"
                ? () => workspace(ui().planView === "rec" ? "rec" : "plan")
                : id === "risks"
                  ? risks
                  : compliance;
      }
      document.addEventListener(
        "click",
        (e) => {
          const el = e.target.closest(
            "[data-act=nav], [data-lx-act=risk-back]",
          );
          if (el?.dataset.sub === "risk-map") prefs.riskView = "matrix";
          if (
            el?.dataset.sub === "risk-register" ||
            el?.dataset.lxAct === "risk-back"
          )
            prefs.riskView = "list";
        },
        true,
      );
      document.addEventListener("click", click);
      let timer;
      document.addEventListener("input", (e) => {
        const el = e.target;
        if (!el.dataset.astraSearch) return;
        clearTimeout(timer);
        const key = el.dataset.astraSearch,
          value = el.value,
          pos = el.selectionStart;
        timer = setTimeout(() => {
          prefs[key] = value;
          A.render();
          const input = document.querySelector(`[data-astra-search="${key}"]`);
          input?.focus();
          input?.setSelectionRange(pos, pos);
        }, 180);
      });
      document.addEventListener("change", async (e) => {
        const el = e.target;
        try {
          if (el.dataset.astraPref) {
            if (!el.value && ["date", "month"].includes(el.type)) return;
            prefs[el.dataset.astraPref] = el.value;
            if (el.dataset.astraPref.startsWith("risk")) prefs.riskCell = "";
            A.render();
          }
          if (el.dataset.astraStatus) {
            await status(el.dataset.astraStatus, el.value);
            workDetail("action", el.dataset.astraStatus);
          }
        } catch (err) {
          A.toast(err.message);
        }
      });
      document.addEventListener("dragstart", (e) => {
        const el = e.target.closest("[data-astra-drag]");
        if (!el || A.readOnly()) return;
        dragId = el.dataset.astraDrag;
        e.dataTransfer.setData("text/plain", dragId);
        e.dataTransfer.effectAllowed = "move";
      });
      document.addEventListener("dragover", (e) => {
        if (dragId && e.target.closest("[data-astra-drop]")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      });
      document.addEventListener("drop", async (e) => {
        const el = e.target.closest("[data-astra-drop]");
        if (!el || !dragId) return;
        e.preventDefault();
        const id = dragId;
        dragId = "";
        try {
          await status(id, el.dataset.astraDrop);
        } catch (err) {
          A.toast(err.message);
        }
      });
      document.addEventListener("dragend", () => (dragId = ""));
    },
    afterRender,
  });
  window.AstraUI = { workRows, filtered, riskRows, events, workspace };
})();
