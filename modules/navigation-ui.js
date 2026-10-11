(function () {
  "use strict";
  let U;
  const GROUPS = [
    {
      id: "overview",
      label: "Vue d’ensemble",
      sections: ["dash", "journey", "carto"],
    },
    {
      id: "pilotage",
      label: "Organisation et pilotage",
      sections: ["perimeters", "context", "pil", "risks", "actions"],
    },
    {
      id: "references",
      label: "Référentiels et audits",
      sections: ["compliance", "care", "has", "audit", "proofs"],
    },
    {
      id: "resilience",
      label: "Continuité et opérations",
      sections: ["pcra", "ops", "suppliers", "gap", "crrc"],
    },
    {
      id: "resources",
      label: "Ressources et bilans",
      sections: ["inv", "rep", "admin"],
    },
  ];
  function organize(nav) {
    const out = nav.map((s) => ({ ...s, items: [...s.items] })),
      pil = out.find((s) => s.id === "pil");
    function extract(id, label, icon, groups) {
      const items = pil.items
        .filter((i) => groups.includes(i.g))
        .map((i) => ({ ...i }));
      pil.items = pil.items.filter((i) => !groups.includes(i.g));
      out.push({
        id,
        label,
        icon,
        items,
        groups: pil.groups.filter((g) => groups.includes(g.id)),
      });
    }
    if (pil) {
      extract("context", "Contexte et parties intéressées", "tiers", ["g-ctx"]);
      const context = out.find((s) => s.id === "context");
      // Une seule entrée pour le registre partagé des rôles ; ancienne rubrique conservée par son onglet.
      context.items = context.items.filter((i) => i.id !== "ctx-roles");
      extract("actions", "Plan d’action et échéances", "ecarts", [
        "g-ec",
        "g-plans",
      ]);
      extract("compliance", "Conformité et applicabilité", "conf", ["g-conf"]);
      extract("suppliers", "Fournisseurs et accès", "tiers", ["g-sup"]);
      extract("proofs", "Preuves et justificatifs", "rep", ["g-prv"]);
      pil.groups = pil.groups.filter((g) => g.id === "g-obj");
      pil.label = "Objectifs et indicateurs";
      delete pil.count;
    }
    const risks = out.find((s) => s.id === "risks"),
      dash = out.find((s) => s.id === "dash");
    const map = risks?.items.find((i) => i.id === "risk-map"),
      status = dash?.items.find((i) => i.id === "dmap");
    if (risks) {
      risks.items = risks.items.filter((i) => i.id !== "risk-map");
      risks.label = "Risques et études";
    }
    if (dash) dash.items = dash.items.filter((i) => i.id !== "dmap");
    out.push({
      id: "carto",
      label: "Cartographies",
      icon: "carto",
      items: [
        {
          id: "mb-ctx",
          label: "Contexte et dépendances",
          tab: "carto",
          set: { mbView: "context" },
        },
        {
          id: "mb-proc",
          label: "Processus et interactions",
          tab: "carto",
          set: { mbView: "process" },
        },
        ...(map ? [{ ...map, label: "Risques consolidés" }] : []),
        ...(status ? [{ ...status, label: "Conformité et indicateurs" }] : []),
      ],
    });
    const prefs = U?.api().ui.navOrder || [];
    const order = GROUPS.flatMap((g) => {
      const known = prefs.filter((id) => g.sections.includes(id));
      let i = 0;
      return g.sections.map((id) => (known.includes(id) ? known[i++] : id));
    });
    const group = (id) => GROUPS.findIndex((g) => g.sections.includes(id));
    out.sort((a, b) => {
      if (group(a.id) !== group(b.id)) return group(a.id) - group(b.id);
      return order.indexOf(a.id) - order.indexOf(b.id);
    });
    window.LegacyNavigation.route = (sub) =>
      out.find((s) => s.items.some((i) => i.id === sub))?.id;
    return out;
  }
  window.LegacyNavigation = {
    organize,
    groups: GROUPS,
    sameGroup: (a, b) =>
      GROUPS.some((g) => g.sections.includes(a) && g.sections.includes(b)),
  };
  let lastSection = "";
  function afterRender() {
    const root = document.querySelector("#tabs .mn-in");
    if (!root) return;
    const buttons = [...root.querySelectorAll(":scope > .mn")],
      current = buttons.find((b) => b.classList.contains("on"))?.dataset.sec;
    U.api().ui.navGroups = U.api().ui.navGroups || {};
    const prefs = U.api().ui.navGroups;
    const entries = buttons.map((button) => ({
      button,
      sub: button.nextElementSibling?.classList.contains("side-sub")
        ? button.nextElementSibling
        : null,
    }));
    root.replaceChildren();
    for (const group of GROUPS) {
      const nodes = entries.filter((x) =>
        group.sections.includes(x.button.dataset.sec),
      );
      if (!nodes.length) continue;
      const open =
        current !== lastSection && group.sections.includes(current)
          ? true
          : (prefs[group.id] ??
            (group.id === "overview" || group.sections.includes(current)));
      const box = document.createElement("section");
      box.className = "lx-nav-group";
      const toggle = document.createElement("button");
      toggle.className = "lx-nav-heading";
      toggle.type = "button";
      toggle.dataset.lxNavGroup = group.id;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-controls", "lx-nav-body-" + group.id);
      toggle.innerHTML =
        U.esc(group.label) +
        '<span aria-hidden="true">' +
        (open ? "−" : "+") +
        "</span>";
      const body = document.createElement("div");
      body.id = "lx-nav-body-" + group.id;
      body.className = "lx-nav-body";
      body.hidden = !open;
      for (const x of nodes) {
        body.appendChild(x.button);
        if (x.sub) body.appendChild(x.sub);
      }
      toggle.onclick = () => {
        prefs[group.id] = !open;
        U.api().saveUI();
        U.api().render();
      };
      box.append(toggle, body);
      root.appendChild(box);
    }
    for (const x of entries.filter(
      (x) => !GROUPS.some((g) => g.sections.includes(x.button.dataset.sec)),
    )) {
      root.appendChild(x.button);
      if (x.sub) root.appendChild(x.sub);
    }
    lastSection = current;
    let mobile = document.getElementById("lx-menu-toggle");
    if (!mobile) {
      mobile = document.createElement("button");
      mobile.type = "button";
      mobile.id = "lx-menu-toggle";
      mobile.className = "btn";
      mobile.setAttribute("aria-controls", "tabs");
      mobile.textContent = "Menu";
      document.querySelector(".side-brand")?.after(mobile);
      mobile.onclick = () => {
        document.querySelector(".side").classList.toggle("lx-mobile-open");
        mobile.setAttribute(
          "aria-expanded",
          String(
            document
              .querySelector(".side")
              .classList.contains("lx-mobile-open"),
          ),
        );
      };
      mobile.setAttribute("aria-expanded", "false");
    }
    const sideBrand = document.querySelector(".side-brand b");
    if (sideBrand) sideBrand.textContent = "Pilotage";
    const sideSubtitle = document.querySelector(".side-brand small");
    if (sideSubtitle)
      sideSubtitle.textContent = "Cybersécurité · Qualité · Continuité";
    const foot = document.querySelector(".side-foot span");
    if (foot) foot.textContent = "Pilotage des référentiels et des activités";
  }
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
      if (U.api().ui.tab === "contexte" && U.api().ui.ctxView === "roles") {
        U.api().ui.tab = "perimeters";
        U.api().ui.perimetersView = "roles";
      }
      const t = U.api().TABS.find((x) => x.id === "pilotage");
      if (t) t.label = () => "Pilotage";
    },
    afterRender,
  });
})();
