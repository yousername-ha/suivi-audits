(function () {
  "use strict";
  let U;
  const GROUPS = [
    {
      id: "pilotage",
      label: "Pilotage",
      sections: ["dash", "journey", "perimeters", "pil", "risks"],
    },
    {
      id: "references",
      label: "Référentiels et audits",
      sections: ["care", "has", "audit"],
    },
    {
      id: "resilience",
      label: "Continuité et opérations",
      sections: ["pcra", "ops", "crrc"],
    },
    {
      id: "resources",
      label: "Ressources et bilans",
      sections: ["gap", "inv", "rep", "admin"],
    },
  ];
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
      if (current !== lastSection && group.sections.includes(current))
        prefs[group.id] = true;
      const open = prefs[group.id] !== false;
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
      const t = U.api().TABS.find((x) => x.id === "pilotage");
      if (t) t.label = () => "Pilotage";
    },
    afterRender,
  });
})();
