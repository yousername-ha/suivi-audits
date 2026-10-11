(function () {
  "use strict";
  const C = LegacyDF,
    I = LegacyIntegration;
  let api,
    users = [];
  const plugins = [];
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const state = () => I.init(api.getState()),
    button = (text, act, attrs = "", primary = false) =>
      `<button class="btn${primary ? " primary" : ""}" type="button" data-lx-act="${act}" ${attrs}>${esc(text)}</button>`;
  const opt = (value, label, current) =>
    `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
  const field = (name, label, value = "", type = "text", extra = "") =>
    `<label class="lx-field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const area = (name, label, value = "") =>
    `<label class="lx-field">${esc(label)}<textarea name="${name}" rows="3" maxlength="10000">${esc(value)}</textarea></label>`;
  const select = (name, label, options, value = "") =>
    `<label class="lx-field">${esc(label)}<select name="${name}">${opt("", "À choisir", value)}${options.map((x) => opt(x.value ?? x, x.label ?? x, value)).join("")}</select></label>`;
  const multi = (name, label, options, values = []) =>
    `<fieldset class="lx-choices"><legend>${esc(label)}</legend>${options.map((x) => `<label><input type="checkbox" name="${name}" value="${esc(x.value ?? x.id)}" ${values.includes(x.value ?? x.id) ? "checked" : ""}>${esc(x.label ?? x.name ?? x.title ?? x.id)}</label>`).join("") || '<span class="lx-muted">Aucun élément disponible.</span>'}</fieldset>`;
  const scopes = (ids = []) =>
    multi(
      "perimeterIds",
      "Établissements et périmètres concernés",
      state().perimeters.filter((p) => p.status !== "Archivé"),
      ids,
    );
  const responsible = (ref, ids = []) =>
    select(
      "responsible",
      "Responsable · personne / fonction / rôle",
      I.responsibles(state(), ids, users),
      ref ? ref.roleId + "|" + (ref.userId || "") : "",
    );
  const parseResponsible = (f) => {
    const v = f.get("responsible");
    if (!v) return null;
    const [roleId, userId] = v.split("|");
    return { roleId, userId };
  };
  function dialog(title, html, submit) {
    let d = document.getElementById("lx-dialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "lx-dialog";
      d.className = "lx-dialog";
      document.body.appendChild(d);
    }
    d.innerHTML = `<form><div class="lx-dialog-head"><h2>${esc(title)}</h2>${button("Fermer", "dialog-close")}</div><div class="lx-dialog-content">${html}</div><p class="lx-error" role="alert"></p><div class="lx-dialog-foot"><button class="btn primary" type="submit">Enregistrer</button>${button("Annuler", "dialog-close")}</div></form>`;
    d.querySelectorAll('[data-lx-act="dialog-close"]').forEach(
      (b) => (b.onclick = () => d.close()),
    );
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const b = d.querySelector("[type=submit]");
      b.disabled = true;
      try {
        await submit(new FormData(e.target));
        d.close();
        api.render();
      } catch (e) {
        d.querySelector("[role=alert]").textContent = e.message;
        b.disabled = false;
      }
    };
    d.showModal();
  }
  async function mutate(fn) {
    if (api.readOnly()) throw Error("Mode lecture seule.");
    const result = await fn(state());
    api.touch(true);
    await LegacyServer.flush();
    return result;
  }
  const header = (title, text, actions = "") =>
    `<header class="lx-page-head"><div><span class="lx-eyebrow">Pilotage intégré</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="lx-actions">${actions}</div></header>`;
  const empty = (title, text) =>
    `<div class="lx-empty"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  const card = (title, value, text) =>
    `<article class="lx-stat"><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(text)}</small></article>`;
  const pill = (text) => `<span class="lx-pill">${esc(text)}</span>`;
  function ownerLabel(r) {
    if (!r.responsible) return r.owner || "À désigner";
    const role = state().roles.find((x) => x.id === r.responsible.roleId),
      u = users.find((x) => x.id === r.responsible.userId);
    return u
      ? [u.name, role?.name].filter(Boolean).join(" · ")
      : role
        ? I.roleLabel(role)
        : "Affectation à revoir";
  }
  function scopeLabel(ids) {
    return (
      (ids || [])
        .map((id) => state().perimeters.find((x) => x.id === id)?.name || id)
        .join(", ") || "À classer"
    );
  }
  function related(ref) {
    const r = I.object(state(), ref);
    return `<section class="lx-card"><h3>Objets reliés</h3>${
      (r.objectRefs || [])
        .map((x) => {
          const o = I.object(state(), x);
          return `<p>${esc(x.kind)} · ${esc(o.title || o.name || o.text || o.id)}</p>`;
        })
        .join("") || "<p>Aucun rattachement.</p>"
    }${button("Relier un objet", "relate", `data-kind="${ref.kind}" data-id="${esc(ref.id)}"`)}</section>`;
  }
  function perimeterForm(id) {
    const p = state().perimeters.find((x) => x.id === id) || {};
    dialog(
      id ? "Modifier le périmètre" : "Déclarer un périmètre",
      field("name", "Nom", p.name, "text", 'required maxlength="500"') +
        select("type", "Type", I.TYPES, p.type || "Établissement") +
        field(
          "internalId",
          "Identifiant interne automatique",
          p.internalId || "Attribué à l’enregistrement",
          "text",
          "readonly",
        ) +
        select(
          "parentId",
          "Rattachement hiérarchique",
          state()
            .perimeters.filter((x) => x.id !== id)
            .map((x) => ({ value: x.id, label: x.name })),
          p.parentId,
        ) +
        field(
          "finessEJ",
          "FINESS juridique (si pertinent)",
          p.finessEJ,
          "text",
          'pattern="[0-9]{9}" maxlength="9"',
        ) +
        field(
          "finessEG",
          "FINESS géographique (si pertinent)",
          p.finessEG,
          "text",
          'pattern="[0-9]{9}" maxlength="9"',
        ) +
        responsible(p.responsible, id ? [id] : []) +
        multi(
          "referentRoleIds",
          "Référents fonctionnels",
          state().roles.map((r) => ({
            value: r.id,
            label: I.roleLabel(r, users),
          })),
          p.referentRoleIds,
        ) +
        multi(
          "relatedIds",
          "Établissements / SI mutualisés (liens hors hiérarchie)",
          state().perimeters.filter((x) => x.id !== id),
          p.relatedIds,
        ) +
        multi(
          "frameworkIds",
          "Référentiels applicables",
          state().frameworks,
          p.frameworkIds,
        ) +
        select(
          "status",
          "Statut",
          ["Brouillon", "Actif", "Archivé"],
          p.status || "Actif",
        ) +
        area("description", "Description", p.description),
      (f) =>
        mutate((s) =>
          I.perimeter(
            s,
            {
              ...Object.fromEntries(f),
              responsible: parseResponsible(f),
              relatedIds: f.getAll("relatedIds"),
              referentRoleIds: f.getAll("referentRoleIds"),
              frameworkIds: f.getAll("frameworkIds"),
            },
            id,
          ),
        ),
    );
  }
  function establishmentLink() {
    dialog(
      "Relier un établissement déjà saisi dans CRRC",
      select(
        "establishmentId",
        "Établissement CRRC",
        (state().crrc?.establishments || []).map((e) => ({
          value: e.id,
          label: e.name,
        })),
      ) +
        select(
          "perimeterId",
          "Périmètre commun",
          state()
            .perimeters.filter((p) =>
              ["Support", "Établissement", "Entité juridique", "Site"].includes(
                p.type,
              ),
            )
            .map((p) => ({ value: p.id, label: p.name })),
        ),
      (f) =>
        mutate((s) =>
          I.linkEstablishment(
            s,
            f.get("establishmentId"),
            f.get("perimeterId"),
          ),
        ),
    );
  }
  function roleForm(id) {
    const r = state().roles.find((x) => x.id === id) || {};
    dialog(
      id ? "Rôle et affectations" : "Définir un rôle fonctionnel",
      field("name", "Rôle fonctionnel", r.name, "text", "required") +
        field("holder", "Titulaire déclaré", r.holder) +
        field("function", "Fonction", r.function) +
        field("deputy", "Suppléant déclaré", r.deputy) +
        area("resp", "Responsabilités", r.resp) +
        scopes(r.perimeterIds) +
        multi(
          "userIds",
          "Comptes effectivement affectés (habilitations gérées séparément)",
          users
            .filter((u) => u.active)
            .map((u) => ({ value: u.id, label: u.name })),
          r.userIds,
        ),
      (f) =>
        mutate((s) => {
          const next = {
            ...Object.fromEntries(f),
            perimeterIds: f.getAll("perimeterIds"),
            userIds: f.getAll("userIds"),
          };
          if (r.id) Object.assign(r, next);
          else {
            const existing = s.roles.find(
              (x) =>
                x.name.trim().toLocaleLowerCase() ===
                next.name.trim().toLocaleLowerCase(),
            );
            if (
              existing &&
              existing.baseRoleKey &&
              !existing.holder &&
              !existing.userIds?.length
            ) {
              Object.assign(existing, next);
            } else if (existing)
              throw Error("Ce rôle existe déjà ; modifiez ses affectations.");
            else
              s.roles.push({
                ...next,
                id: C.id("ROLE"),
                createdAt: C.now(),
                email: "",
                phone: "",
                refs: [],
              });
          }
          C.log(
            s,
            "Rôle / affectations",
            "role",
            r.id ||
              s.roles.find((x) => x.name === next.name)?.id ||
              s.roles.at(-1).id,
            null,
            next,
          );
        }),
    );
  }
  function assignment(ref) {
    const r = I.object(state(), ref);
    dialog(
      "Classer et affecter · " + (r.title || r.name || r.text || r.id),
      scopes(r.perimeterIds) + responsible(r.responsible, r.perimeterIds),
      (f) =>
        mutate((s) =>
          I.assign(s, ref, f.getAll("perimeterIds"), parseResponsible(f)),
        ),
    );
  }
  function relationForm(ref) {
    const options = Object.entries(I.collections(state())).flatMap(
      ([kind, rows]) =>
        rows
          .filter((x) => x.id && (x.id !== ref.id || kind !== ref.kind))
          .map((x) => ({
            value: kind + "|" + x.id,
            label: kind + " · " + (x.title || x.name || x.text || x.id),
          })),
    );
    dialog(
      "Rattachement partagé",
      select("object", "Objet métier", options),
      (f) =>
        mutate((s) => {
          const [kind, id] = (f.get("object") || "").split("|");
          I.relate(s, ref, { kind, id });
        }),
    );
  }
  function accounts() {
    return (
      header(
        "Comptes et habilitations",
        "Le compte ouvre un accès ; le rôle fonctionnel désigne une responsabilité.",
        LegacyServer.user()?.permission === "admin"
          ? button("Créer un compte", "account-new", "", true)
          : "",
      ) +
      `<div class="lx-list">${users.map((u) => `<article class="lx-card"><h3>${esc(u.name)}</h3><p>${esc({ admin: "Administration", editor: "Contribution", viewer: "Lecture" }[u.permission])} · ${u.active ? "Actif" : "Désactivé"}${u.canValidate ? " · Validation interne autorisée" : ""}</p><p>${esc(scopeLabel(u.perimeterIds))}</p>${LegacyServer.user()?.permission === "admin" ? button("Ajuster les habilitations", "account-edit", `data-id="${u.id}"`) : ""}</article>`).join("")}</div>`
    );
  }
  function accountForm(id) {
    const u = users.find((x) => x.id === id) || {};
    dialog(
      id ? "Habilitations du compte" : "Nouveau compte",
      field("name", "Nom affiché", u.name, "text", "required") +
        (id
          ? ""
          : field(
              "login",
              "Identifiant",
              "",
              "text",
              'required minlength="3" maxlength="80"',
            )) +
        field(
          "password",
          id
            ? "Nouveau mot de passe (laisser vide pour conserver)"
            : "Mot de passe",
          "",
          "password",
          (id ? "" : "required ") +
            'minlength="12" maxlength="200" autocomplete="new-password"',
        ) +
        select(
          "permission",
          "Accès",
          ["admin", "editor", "viewer"].map((value) => ({
            value,
            label: {
              admin: "Administrateur",
              editor: "Contributeur",
              viewer: "Lecture",
            }[value],
          })),
          u.permission || "viewer",
        ) +
        scopes(u.perimeterIds) +
        multi(
          "roleIds",
          "Rôles fonctionnels",
          state().roles.map((r) => ({ value: r.id, label: I.roleLabel(r) })),
          u.roleIds,
        ) +
        `<label><input type="checkbox" name="canValidate" ${u.canValidate ? "checked" : ""}>Autoriser les validations internes</label>${id ? `<label><input type="checkbox" name="active" ${u.active ? "checked" : ""}>Compte actif</label>` : ""}`,
      async (f) => {
        await LegacyServer.flush();
        await LegacyServer.request("/api/users", {
          method: "POST",
          body: JSON.stringify({
            ...Object.fromEntries(f),
            ...(id ? { id, active: f.has("active") } : {}),
            canValidate: f.has("canValidate"),
            perimeterIds: f.getAll("perimeterIds"),
            roleIds: f.getAll("roleIds"),
          }),
        });
        users = await LegacyServer.users();
      },
    );
  }
  function perimeters() {
    const s = state(),
      view = api.ui.perimetersView || "registry";
    if (view === "accounts") return accounts();
    if (view === "roles")
      return (
        header(
          "Rôles et responsabilités",
          "Désignez les responsables et leurs périmètres. Les affectations sont partagées avec les autres menus.",
          button("Ajouter un rôle", "role-new", "", true),
        ) +
        `<div class="lx-list lx-role-list">${s.roles
          .map((r) => {
            const members = users.filter(
                (u) =>
                  u.active &&
                  ((r.userIds || []).includes(u.id) ||
                    u.roleIds?.includes(r.id)),
              ),
              holder =
                r.holder ||
                members.map((u) => u.name).join(", ") ||
                "Titulaire à désigner";
            return `<article class="lx-card lx-role-card"><div class="lx-role-heading"><h3>${esc(r.name || "Rôle")}</h3><p class="lx-muted lx-role-function">${esc(r.function || "Fonction à préciser")}</p></div><div class="lx-role-assignment"><p><span class="lx-muted">Responsable</span><br><strong>${esc(holder)}</strong></p><p class="lx-muted">${esc(scopeLabel(r.perimeterIds))}</p></div><p class="lx-role-responsibility">${esc(r.resp || "Responsabilités à préciser")}</p><div class="lx-card-actions">${button("Modifier les affectations", "role-edit", `data-id="${esc(r.id)}"`)}</div></article>`;
          })
          .join("")}</div>`
      );
    if (view === "classification") {
      const kind = api.ui.classKind || "action",
        rows = I.collections(s)[kind] || [];
      return (
        header(
          "Relations et classement",
          "Les objets historiques sans périmètre restent privés à l’administration.",
        ) +
        select(
          "classKind",
          "Registre",
          Object.keys(I.collections(s)),
          kind,
        ).replace(
          '<select name="classKind">',
          '<select name="classKind" data-lx-filter="classKind" data-ro-ok>',
        ) +
        `<div class="lx-list">${rows
          .slice(0, 300)
          .map(
            (r) =>
              `<article class="lx-card"><h3>${esc(r.title || r.name || r.text || r.id)}</h3><p>${esc(scopeLabel(r.perimeterIds))} · ${esc(ownerLabel(r))}</p>${button("Affecter", "assign", `data-kind="${kind}" data-id="${esc(r.id)}"`)}${button("Relier", "relate", `data-kind="${kind}" data-id="${esc(r.id)}"`)}</article>`,
          )
          .join(
            "",
          )}</div>${rows.length > 300 ? "<p>300 objets affichés ; utilisez les registres unitaires pour les recherches détaillées.</p>" : ""}`
      );
    }
    const focus = s.perimeters.find((p) => p.id === api.ui.perimeterFocus),
      coverage = new Set(
        focus ? I.descendants(s, focus.id) : s.perimeters.map((p) => p.id),
      ),
      included = (r) => (r.perimeterIds || []).some((id) => coverage.has(id)),
      ancestors = [];
    for (
      let p = focus;
      p && ancestors.length < 30;
      p = s.perimeters.find((x) => x.id === p.parentId)
    )
      ancestors.unshift(p);
    const rows = s.perimeters.filter(
      (p) =>
        coverage.has(p.id) &&
        (!api.ui.perimeterQuery ||
          p.name.toLowerCase().includes(api.ui.perimeterQuery.toLowerCase())),
    );
    const depth = (p) => {
      let n = 0;
      while (p.parentId && n < 10) {
        p = s.perimeters.find((x) => x.id === p.parentId) || {};
        n++;
      }
      return n;
    };
    return (
      header(
        "Périmètres",
        "Un registre commun pour les établissements, services et systèmes mutualisés.",
        LegacyServer.user()?.permission === "admin"
          ? button("Déclarer un périmètre", "perimeter-new", "", true) +
              button("Relier un établissement CRRC", "establishment-link")
          : "",
      ) +
      `<nav class="lx-actions" aria-label="Contexte organisationnel">${button("Tous mes périmètres", "perimeter-focus", 'data-id=""')}${ancestors.map((p) => button(p.name, "perimeter-focus", `data-id="${esc(p.id)}"`)).join(" → ")}</nav><p class="lx-muted">${focus ? "Vue consolidée : " + esc(focus.name) + " et ses rattachements. Les SI mutualisés restent des liens et ne confèrent aucun droit." : "Ouvrez un périmètre pour consulter ses rattachements et leurs objets communs."}</p>` +
      `<div class="lx-stats">${card("Périmètres actifs", s.perimeters.filter((p) => coverage.has(p.id) && p.status === "Actif").length, "Dans le contexte sélectionné")}${card("Établissements", s.perimeters.filter((p) => coverage.has(p.id) && ["Support", "Établissement"].includes(p.type)).length, "Établissements rattachés")}${card("Actions ouvertes", s.findings.filter((a) => included(a) && a.status !== "Clos").length, "Actions partagées comptées une seule fois")}${card("Analyses BIA", (s.pcra?.bias || []).filter(included).length, "Analyses dans les établissements concernés")}${card("Preuves", s.evidences.filter(included).length, "La couverture et la validation restent distinctes")}</div><label class="lx-field">Rechercher<input data-lx-query="perimeterQuery" data-ro-ok value="${esc(api.ui.perimeterQuery || "")}"></label>` +
      (rows.length
        ? `<div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Organisation</th><th>Type / statut</th><th>Responsable</th><th>Mutualisations</th><th></th></tr></thead><tbody>${rows.map((p) => `<tr><td style="padding-left:${12 + depth(p) * 15}px">${button(p.name, "perimeter-focus", `data-id="${esc(p.id)}"`)}<small>${esc(p.internalId || "")}${p.finessEJ ? " · EJ " + esc(p.finessEJ) : ""}${p.finessEG ? " · EG " + esc(p.finessEG) : ""}</small></td><td>${esc(p.type)}<small>${esc(p.status)}</small></td><td>${esc(ownerLabel(p))}</td><td>${esc(scopeLabel(p.relatedIds))}</td><td>${LegacyServer.user()?.permission === "admin" ? button("Modifier", "perimeter-edit", `data-id="${p.id}"`) : ""}${button("Liens", "object-relations", `data-kind="perimeter" data-id="${p.id}"`)}</td></tr>`).join("")}</tbody></table></div>`
        : empty(
            "Commencez par votre organisation",
            "Déclarez le GHT ou établissement, puis ses sites et activités. Les systèmes mutualisés peuvent relier plusieurs établissements.",
          ))
    );
  }
  const U = {
    esc,
    state,
    button,
    opt,
    field,
    area,
    select,
    multi,
    scopes,
    responsible,
    parseResponsible,
    dialog,
    mutate,
    header,
    empty,
    card,
    pill,
    ownerLabel,
    scopeLabel,
    related,
    perimeterForm,
    roleForm,
    accounts,
    rolesView: () => {
      const previous = api.ui.perimetersView;
      api.ui.perimetersView = "roles";
      const html = perimeters();
      api.ui.perimetersView = previous;
      return html;
    },
    api: () => api,
    users: () => users,
  };
  function install(context) {
    api = context;
    for (const p of plugins) p.install?.(U);
    api.TABS.push({
      id: "perimeters",
      label: () => "Périmètres",
      view: perimeters,
    });
    api.NAV_DEF.perimetersView = "registry";
    document.addEventListener("click", async (e) => {
      const el = e.target.closest("[data-lx-act]");
      if (!el) return;
      const act = el.dataset.lxAct;
      try {
        if (act === "perimeter-focus") {
          api.ui.perimeterFocus = el.dataset.id;
          api.ui.perimeterQuery = "";
          api.render();
        } else if (act === "establishment-link") establishmentLink();
        else if (act === "perimeter-new") perimeterForm();
        else if (act === "perimeter-edit") perimeterForm(el.dataset.id);
        else if (act === "role-new") roleForm();
        else if (act === "role-edit") roleForm(el.dataset.id);
        else if (act === "assign")
          assignment({ kind: el.dataset.kind, id: el.dataset.id });
        else if (act === "relate")
          relationForm({ kind: el.dataset.kind, id: el.dataset.id });
        else if (act === "object-relations") {
          dialog(
            "Relations",
            related({ kind: el.dataset.kind, id: el.dataset.id }),
            async () => {},
          );
        } else if (act === "account-new") accountForm();
        else if (act === "account-edit") accountForm(el.dataset.id);
        else
          for (const plugin of plugins)
            if (await plugin.click?.(act, el)) break;
      } catch (err) {
        api.toast(err.message);
      }
    });
    document.addEventListener("change", (e) => {
      if (e.target.dataset.lxFilter) {
        api.ui[e.target.dataset.lxFilter] = e.target.value;
        api.render();
      }
    });
    let timer;
    document.addEventListener("input", (e) => {
      if (e.target.dataset.lxQuery) {
        clearTimeout(timer);
        const el = e.target,
          key = el.dataset.lxQuery,
          value = el.value,
          pos = el.selectionStart;
        timer = setTimeout(() => {
          api.ui[key] = value;
          api.render();
          const input = document.querySelector(`[data-lx-query="${key}"]`);
          input?.focus();
          input?.setSelectionRange(pos, pos);
        }, 180);
      }
    });
    return {
      extendNav: (nav) => [
        {
          id: "perimeters",
          label: "Périmètres",
          icon: "pil",
          items: [
            {
              id: "perimeter-registry",
              label: "Organisations et établissements",
              tab: "perimeters",
              set: { perimetersView: "registry" },
            },
            {
              id: "perimeter-roles",
              label: "Responsables et rôles",
              tab: "perimeters",
              set: { perimetersView: "roles" },
            },
            {
              id: "perimeter-relations",
              label: "Relations et classement",
              tab: "perimeters",
              set: { perimetersView: "classification" },
            },
            {
              id: "perimeter-accounts",
              label: "Comptes et habilitations",
              tab: "perimeters",
              set: { perimetersView: "accounts" },
            },
          ],
        },
        ...plugins.reduce((n, p) => (p.extendNav ? p.extendNav(n) : n), nav),
      ],
      afterRender: () => {
        for (const p of plugins) p.afterRender?.();
        for (const card of document.querySelectorAll(".lx-list > .lx-card")) {
          const actions = [...card.children].filter((el) =>
            el.matches("button.btn"),
          );
          if (!actions.length) continue;
          const footer = document.createElement("div");
          footer.className = "lx-card-actions";
          footer.append(...actions);
          card.append(footer);
        }
        if (api.readOnly())
          document.querySelectorAll("[data-lx-act]").forEach((el) => {
            if (
              !["object-relations", "dialog-close", "perimeter-focus"].includes(
                el.dataset.lxAct,
              ) &&
              !plugins.some((p) => p.readActions?.includes(el.dataset.lxAct))
            )
              el.disabled = true;
          });
      },
      load: async () => {
        users = await LegacyServer.users();
      },
      toolkit: U,
    };
  }
  window.LegacyIntegrationUI = {
    install,
    register: (plugin) => {
      plugins.push(plugin);
    },
    toolkit: U,
  };
})();
