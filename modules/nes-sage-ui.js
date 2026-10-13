/* Habillage global « Référence 08 » : style commun à toute l'instance (sage ou clair), choisi par un administrateur.
   Le serveur est la source de vérité (GET /api/appearance, PUT /api/admin/appearance) ; localStorage ne garde que le
   dernier style connu de l'instance pour une coupure réseau. Aucun effet sur les cartographies : l'attribut de style,
   l'identité ajoutée et les décorations sont retirés AVANT leur rendu (beforeRender) et à chaque rendu suivant. */
(function () {
  "use strict";
  const STYLES = ["sage", "clair"],
    LABELS = { sage: "Référence 08 — Sauge", clair: "Clair bleuté" },
    SITE = "https://www.normand-esante.fr/",
    CACHE = "suivi-audits-smsi:nes-style",
    POLL_MS = 20000,
    TIMEOUT_MS = 5000;
  let U = null,
    global = null, // dernier style connu du serveur : { style, revision }
    preview = null, // aperçu local non enregistré (administrateur, panneau Apparence seulement)
    started = false,
    inflight = false,
    saving = false,
    unavailable = false,
    remoteNote = "",
    status = { kind: "", text: "" },
    timer = null;
  const root = () => document.documentElement;
  const valid = (r) =>
    !!r &&
    STYLES.includes(r.style) &&
    Number.isInteger(r.revision) &&
    r.revision >= 1;
  const isAdmin = () => window.LegacyServer?.user?.()?.permission === "admin";
  const ui = () => U?.api().ui || {};
  /* Cartographies protégées : aucune trace de l'habillage, même à la réception d'un nouveau style. */
  function isProtected(state = ui()) {
    return (
      state.tab === "carto" ||
      (state.tab === "dash" && state.dashView === "map")
    );
  }
  function readCache() {
    try {
      const r = JSON.parse(localStorage.getItem(CACHE) || "null");
      return valid(r) ? r : null;
    } catch {
      return null;
    }
  }
  function writeCache(r) {
    try {
      localStorage.setItem(CACHE, JSON.stringify(r));
    } catch {}
  }
  function mode() {
    const t = root().dataset.theme;
    if (t === "dark" || t === "light") return t;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  const knownStyle = () => global?.style || readCache()?.style || "sage";
  const effective = () => preview || knownStyle();

  /* ---------------------------------------------------------------- application visuelle */
  function applyAttributes(blocked) {
    const el = root();
    if (blocked) {
      delete el.dataset.nesStyle;
      delete el.dataset.nesMode;
      document.querySelector(".nes-header")?.remove();
      return;
    }
    if (el.dataset.nesStyle !== effective()) el.dataset.nesStyle = effective();
    if (el.dataset.nesMode !== mode()) el.dataset.nesMode = mode();
  }
  function header() {
    if (document.querySelector(".nes-header")) return;
    const demo = !!(
      window.LegacyDemo?.KEY &&
      U.state()?.integration?.demoDatasets?.includes(window.LegacyDemo.KEY)
    );
    const el = document.createElement("div");
    el.className = "nes-header";
    el.innerHTML = `<div class="nes-brand"><span class="nes-monogram" aria-hidden="true">S</span><div><strong>Suivi des audits SMSI</strong><small>Qualité, sécurité et référentiels</small></div></div><div class="nes-signature">Normand’e-Santé<small>NUMÉRIQUE EN SANTÉ</small></div>${demo ? '<span class="nes-demo">DÉMONSTRATION</span>' : ""}<a class="nes-site" href="${SITE}" target="_blank" rel="noopener noreferrer"><span>Site Normand’e-Santé</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg><span class="sr">(s’ouvre dans un nouvel onglet)</span></a>`;
    document.body.prepend(el);
  }
  const CHEVRON =
    '<span class="nes-chev" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>';
  /* Pictogrammes en contour de la référence 08 pour les entrées qui y figurent ; les autres gardent les leurs. */
  const ICONS = {
    dash: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    pil: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16v.01"/>',
  };
  function decorateNavigation() {
    for (const [sec, paths] of Object.entries(ICONS)) {
      const svg = document.querySelector(`.side .mn[data-sec="${sec}"] > svg`);
      if (svg && svg.dataset.nesIcon !== sec) {
        svg.innerHTML = paths;
        svg.dataset.nesIcon = sec;
      }
    }
    for (const toggle of document.querySelectorAll(".lx-nav-heading")) {
      toggle.querySelector(":scope > span[aria-hidden]")?.classList.add("nes-sign");
      if (!toggle.querySelector(":scope > .nes-chev"))
        toggle.insertAdjacentHTML("beforeend", CHEVRON);
    }
    let counts = new Map();
    try {
      counts = new Map(
        (U.api().astra?.navigation?.() || []).map((s) => [s.id, s.items.length]),
      );
    } catch {}
    for (const mn of document.querySelectorAll(".side .mn[data-sec]")) {
      const sub = mn.nextElementSibling?.classList.contains("side-sub")
        ? mn.nextElementSibling
        : null;
      if ((counts.get(mn.dataset.sec) || 0) < 2 && !sub) continue;
      if (!mn.querySelector(":scope > .nes-chev")) mn.insertAdjacentHTML("beforeend", CHEVRON);
      mn.setAttribute("aria-expanded", String(!!sub));
      if (sub) {
        sub.id = "nes-sub-" + mn.dataset.sec;
        mn.setAttribute("aria-controls", sub.id);
      } else mn.removeAttribute("aria-controls");
    }
  }
  function apply() {
    const blocked = isProtected();
    applyAttributes(blocked);
    if (!blocked) {
      header();
      decorateNavigation();
    }
  }

  /* ---------------------------------------------------------------- lecture et propagation */
  function accept(r) {
    if (!valid(r)) return false;
    if (global && r.revision < global.revision) return false; // réponse plus ancienne : ignorée
    const changed = !global || r.revision !== global.revision || r.style !== global.style;
    global = { style: r.style, revision: r.revision };
    unavailable = false;
    writeCache(global);
    if (preview === r.style) preview = null;
    else if (preview && changed)
      remoteNote = `Le style global est devenu « ${LABELS[r.style]} » (révision ${r.revision}). Votre aperçu est conservé.`;
    return changed;
  }
  async function fetchAppearance() {
    const controller = new AbortController(),
      t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await LegacyServer.request("/api/appearance", { signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  }
  async function refresh() {
    if (inflight || !window.LegacyServer?.user?.()) return;
    inflight = true;
    try {
      const changed = accept(await fetchAppearance());
      if (changed) {
        apply();
        paintPanel();
      }
    } catch (e) {
      if (e.status === 401) stop();
      else {
        unavailable = true;
        paintPanel();
      }
    } finally {
      inflight = false;
    }
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  async function load() {
    if (started) return;
    started = true;
    await refresh();
    timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) refresh();
    }, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    window.addEventListener("online", refresh);
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", apply);
    new MutationObserver(apply).observe(root(), { attributes: true, attributeFilter: ["data-theme"] });
  }

  /* ---------------------------------------------------------------- panneau Administration → Apparence */
  const note = () =>
    status.text ||
    (preview
      ? `Aperçu non enregistré : « ${LABELS[preview]} ». Les autres utilisateurs voient toujours « ${LABELS[knownStyle()]} ».`
      : global
        ? `Style enregistré pour tous : « ${LABELS[global.style]} » (révision ${global.revision}).`
        : "Style global non lu : « Référence 08 — Sauge » est utilisé par défaut.");
  function panel(u) {
    U = U || u;
    const choice = (v, text) =>
      `<label class="nes-choice"><input type="radio" name="nes-style" value="${v}" ${effective() === v ? "checked" : ""}><span class="nes-swatch nes-swatch-${v}" aria-hidden="true"></span><span><b>${LABELS[v]}</b><small>${text}</small></span></label>`;
    return (
      U.header(
        "Apparence",
        "Style graphique commun à tous les utilisateurs de l’instance.",
      ) +
      `<section class="lx-card nes-appearance" id="nes-appearance"><p>Portée <b>globale</b> : le style enregistré s’applique à tous les comptes, sur tous leurs appareils. Le mode Clair, Sombre ou Système reste un réglage personnel.</p><fieldset class="nes-choices"><legend>Style de l’interface</legend>${choice("sage", "Fond clair chaud. Style par défaut.")}${choice("clair", "Fonds et bordures plus froids ; même identité.")}</fieldset><p class="nes-state" id="nes-state" role="status" aria-live="polite"></p><p class="lx-error" id="nes-error" role="alert"></p><div class="lx-actions">${U.button("Enregistrer pour tous", "admin-appearance-save", 'id="nes-save"', true)}${U.button("Annuler l’aperçu", "admin-appearance-cancel", 'id="nes-cancel"')}</div></section>`
    );
  }
  function paintPanel() {
    const box = document.getElementById("nes-appearance");
    if (!box) return;
    for (const r of box.querySelectorAll("input[name=nes-style]"))
      r.checked = r.value === effective();
    box.classList.toggle("nes-dirty", !!preview);
    const state = box.querySelector("#nes-state"),
      error = box.querySelector("#nes-error");
    state.textContent =
      note() + (remoteNote && preview ? " " + remoteNote : "") + (unavailable ? " Le serveur n’a pas répondu : dernier style connu conservé." : "");
    error.textContent = status.kind === "error" ? status.text : "";
    if (status.kind === "error") state.textContent = preview ? `Aperçu non enregistré : « ${LABELS[preview]} ».` : note();
    box.querySelector("#nes-save").disabled = !preview || saving;
    box.querySelector("#nes-cancel").disabled = !preview || saving;
    box.querySelector("#nes-save").textContent = saving ? "Enregistrement…" : "Enregistrer pour tous";
  }
  function setPreview(style) {
    if (!isAdmin() || !STYLES.includes(style) || saving) return;
    preview = style === knownStyle() ? null : style;
    status = { kind: "", text: "" };
    remoteNote = "";
    apply();
    paintPanel();
  }
  function cancel() {
    preview = null;
    status = { kind: "", text: "" };
    remoteNote = "";
    apply();
    paintPanel();
  }
  async function save() {
    if (!isAdmin() || !preview || saving || !global) return;
    saving = true;
    status = { kind: "", text: "Enregistrement en cours…" };
    paintPanel();
    const wanted = preview;
    try {
      const r = await LegacyServer.request("/api/admin/appearance", {
        method: "PUT",
        body: JSON.stringify({ style: wanted, revision: global.revision }),
      });
      if (!valid(r)) throw Error("Réponse du serveur inattendue.");
      global = { style: r.style, revision: r.revision };
      writeCache(global);
      preview = null;
      remoteNote = "";
      status = { kind: "ok", text: `Style « ${LABELS[r.style]} » enregistré pour tous les utilisateurs (révision ${r.revision}).` };
    } catch (e) {
      if (e.status === 409) {
        // Un autre administrateur est passé avant : on relit la valeur actuelle et on garde le choix en attente.
        inflight = false;
        await refresh();
        status = { kind: "error", text: "Un autre administrateur a modifié le style. Votre choix est conservé : vérifiez la valeur actuelle puis enregistrez de nouveau." };
      } else {
        unavailable = e.status === undefined;
        status = { kind: "error", text: e.status ? e.message : "Le serveur n’a pas répondu : rien n’a été enregistré. Votre aperçu est conservé." };
      }
    } finally {
      saving = false;
      apply();
      paintPanel();
    }
  }
  document.addEventListener("change", (e) => {
    if (e.target?.name === "nes-style" && e.target.closest("#nes-appearance")) setPreview(e.target.value);
  });

  window.NesStyle = {
    STYLES,
    LABELS,
    load,
    refresh,
    panel,
    paintPanel,
    save,
    cancel,
    setPreview,
    isProtected,
    /* Appelé par render() avant tout rendu : l'enveloppe change avant que les cartographies ne mesurent quoi que ce soit. */
    beforeRender: (state) => applyAttributes(isProtected(state)),
    state: () => ({ global: global && { ...global }, preview, effective: effective(), unavailable, saving }),
  };
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
    },
    afterRender: () => {
      const s = ui();
      if (preview && !(s.tab === "admin" && s.adminView === "appearance")) {
        preview = null; // quitter le panneau abandonne l'aperçu
        status = { kind: "", text: "" };
        remoteNote = "";
      }
      apply();
      paintPanel();
    },
  });
})();
