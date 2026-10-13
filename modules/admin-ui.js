(function () {
  "use strict";
  let U,
    status = null,
    events = [],
    loading = false,
    error = "";
  const admin = () => LegacyServer.user()?.permission === "admin";
  async function load() {
    if (!admin() || loading) return;
    loading = true;
    error = "";
    try {
      status = await LegacyServer.request("/api/admin/status");
      events = (await LegacyServer.request("/api/audit")).events;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      if (U.api().ui.tab === "admin") U.api().render();
    }
  }
  function settings() {
    const s = U.state();
    U.dialog(
      "Paramètres de pilotage",
      U.select(
        "nextYear",
        "Prochain audit",
        s.years.map((y) => ({ value: String(y), label: String(y) })),
        String(s.nextYear),
      ) +
        U.field("nextDate", "Date du prochain audit", s.nextDate, "date") +
        U.field(
          "internalDate",
          "Date de l’audit interne",
          s.internalDate,
          "date",
        ) +
        U.field(
          "closeDeadline",
          "Clôture des écarts",
          s.closeDeadline,
          "date",
        ) +
        U.field("org", "Organisme pour les documents", s.branding?.org || "") +
        U.area(
          "contact",
          "Coordonnées pour les documents",
          s.branding?.contact || "",
        ),
      (fd) =>
        U.mutate((s) => {
          s.nextYear = Number(fd.get("nextYear"));
          for (const k of ["nextDate", "internalDate", "closeDeadline"])
            s[k] = LegacyDF.date(fd.get(k));
          s.branding = {
            ...s.branding,
            org: fd.get("org"),
            contact: fd.get("contact"),
          };
        }),
    );
  }
  async function demo() {
    if (!admin()) throw Error("Administration requise.");
    if (U.api().readOnly()) throw Error("Ce poste est en lecture seule.");
    if (
      !(await U.api().confirm(
        "Ajouter le jeu de démonstration FICTIF Horizon ? Les données existantes sont conservées. Aucun compte ni mot de passe n’est créé.",
      ))
    )
      return;
    await LegacyServer.flush();
    const original = U.state(),
      info = LegacyDemo.build(original, LegacyServer.user().name);
    if (!info.created) {
      U.api().toast("Le jeu FICTIF est déjà présent ; aucun doublon ajouté.");
      return;
    }
    const file = new File(
      [
        "FICTIF — FACTURE DE DÉMONSTRATION\nPrestataire Démonstration, FACT-DEMO-001\nExercice PCRA : 1 200 EUR HT / 1 440 EUR TTC\nAucune dépense, donnée de santé ou demande de financement réelle.",
      ],
      "facture-horizon-FICTIF.txt",
      { type: "text/plain" },
    );
    const version = await LegacyDFStore.deposit(info.state, info.proofId, file);
    LegacyDemo.attachProof(info.state, info, version);
    U.api().replaceState(info.state);
    try {
      U.api().touch(true);
      await LegacyServer.flush();
      U.api().toast(
        "Jeu de données FICTIF ajouté : GHT, CaRE/PCRA et trois risques avec deux études.",
      );
    } catch (e) {
      U.api().replaceState(original);
      throw e;
    }
    await load();
  }
  function view() {
    if (!admin())
      return U.empty(
        "Administration réservée",
        "Votre compte ne dispose pas des droits d’administration.",
      );
    const s = U.state(),
      v = U.api().ui.adminView || "overview";
    if (v === "users") return U.accounts();
    if (v === "roles") return U.rolesView();
    if (v === "appearance")
      return window.NesStyle
        ? window.NesStyle.panel(U)
        : U.empty("Apparence indisponible", "Le module d’apparence n’est pas chargé.");
    if (v === "frameworks")
      return (
        U.header(
          "Référentiels et sources",
          "Versions intégrées et limites documentaires. Les imports restent dans les moteurs existants.",
        ) +
        `<div class="lx-list">${s.frameworks.map((f) => `<article class="lx-card"><h3>${U.esc(f.name)} · ${U.esc(f.version || "Version non renseignée")}</h3><p>${U.esc(f.sourceStatus || f.source || "Source à vérifier")}</p><p>${f.requirements?.length || 0} référence(s)</p>${["CARE", "HAS"].includes(f.dfKind) ? U.button("Ouvrir les sources", f.dfKind === "CARE" ? "admin-care-sources" : "admin-has-sources") : ""}</article>`).join("")}</div>`
      );
    if (v === "audit")
      return (
        U.header(
          "Journal d’administration et de traçabilité",
          "Dernières opérations, compte authentifié et empreintes des changements.",
          U.button("Actualiser", "admin-refresh"),
        ) +
        `<p role="status">${U.esc(error || (loading ? "Chargement…" : events.length + " opération(s) consultables"))}</p><div class="lx-table-wrap"><table class="lx-table"><thead><tr><th>Date</th><th>Compte</th><th>Opération</th><th>Changements</th></tr></thead><tbody>${events
          .map((e) => {
            let d = {};
            try {
              d = JSON.parse(e.details);
            } catch (_) {}
            return `<tr><td>${U.esc(new Date(e.at * 1000).toLocaleString("fr-FR"))}</td><td>${U.esc(U.users().find((u) => u.id === e.actor)?.name || e.actor)}</td><td>${U.esc(e.action)}</td><td><details><summary>${d.objects?.length || 0} objet(s) modifié(s)</summary><pre class="lx-history">${U.esc(JSON.stringify(d, null, 2))}</pre></details></td></tr>`;
          })
          .join("")}</tbody></table></div>`
      );
    if (v === "demo")
      return (
        U.header(
          "Jeu de données de démonstration",
          "Données explicitement fictives, ajoutées sur demande, sans écrasement.",
          U.button("Ajouter le jeu FICTIF", "admin-demo", "", true),
        ) +
        `<section class="lx-card"><h3>GHT Horizon · scénario cohérent</h3><p>Deux établissements, SI partagé, responsables fictifs, suivi CaRE D2, facture, BIA à deux activités, PCA et exercice avec action corrective.</p><p>Trois risques centraux : dossier patient, sauvegardes mutualisées et imagerie. Une étude initiale contient les trois risques ; une seconde réévalue uniquement le premier. Sa référence résiduelle et sa décision d’acceptation sont distinctes.</p><p>${s.integration.demoDatasets?.includes(LegacyDemo.KEY) ? "Jeu déjà installé : relancer ne crée aucun doublon." : "Aucun jeu ajouté automatiquement."}</p><p>Aucun FINESS, patient, adresse personnelle, secret ni compte de connexion fictif n’est fourni.</p></section>`
      );
    return (
      U.header(
        "Administration",
        "Comptes, rôles, paramètres de pilotage et traçabilité.",
        U.button("Paramètres de pilotage", "admin-settings") +
          U.button("Actualiser", "admin-refresh"),
      ) +
      `<div class="lx-stats">${U.card("Comptes", status?.users ?? U.users().length, "Habilitations contrôlées sur le serveur")}${U.card("Rôles", s.roles.length, "Fonctions de base et titulaires déclarés")}${U.card("Périmètres", s.perimeters.length, "Organisation et couvertures")}${U.card("Sessions", status?.sessions ?? "—", "Sessions actives")}</div><section class="lx-card"><h3>Références internes automatiques</h3><p>Attribuées par le serveur, conservées après rechargement et non réutilisées par les compteurs après suppression.</p><p>${U.esc((status?.prefixes || ["PERI", "IMP", "RISK", "EBRM", "EVR", "SCEN", "MES", "DEC"]).map((p) => p + "-000001").join(" · "))}</p></section><section class="lx-card"><h3>Affichage de ce poste</h3><div class="seg">${[
        ["auto", "Système"],
        ["light", "Clair"],
        ["dark", "Sombre"],
      ]
        .map(
          ([v, label]) =>
            `<button data-act="theme" data-v="${v}" data-ro-ok>${label}</button>`,
        )
        .join("")}</div></section>`
    );
  }
  LegacyIntegrationUI.register({
    install: (u) => {
      U = u;
      U.api().TABS.push({ id: "admin", label: () => "Administration", view });
      U.api().NAV_DEF.adminView = "overview";
    },
    extendNav: (nav) =>
      admin()
        ? [
            ...nav,
            {
              id: "admin",
              label: "Administration",
              icon: "pil",
              items: [
                ["overview", "Vue d’ensemble"],
                ["users", "Comptes et habilitations"],
                ["roles", "Rôles et responsabilités"],
                ["frameworks", "Référentiels"],
                ["audit", "Journal et traçabilité"],
                ["demo", "Données de démonstration"],
                ["appearance", "Apparence"],
              ].map(([v, label]) => ({
                id: "admin-" + v,
                label,
                tab: "admin",
                set: { adminView: v },
              })),
            },
          ]
        : nav,
    afterRender: () => {
      if (
        admin() &&
        U.api().ui.tab === "admin" &&
        !status &&
        !loading &&
        !error
      )
        load();
    },
    readActions: ["admin-refresh"],
    click: async (act) => {
      if (!act.startsWith("admin-")) return false;
      if (!admin()) throw Error("Administration requise.");
      if (act === "admin-refresh") await load();
      else if (act === "admin-settings") settings();
      else if (act === "admin-demo") await demo();
      else if (act === "admin-appearance-save") await window.NesStyle.save();
      else if (act === "admin-appearance-cancel") window.NesStyle.cancel();
      else if (act === "admin-care-sources")
        U.api().navigate("care", { careView: "sources" });
      else if (act === "admin-has-sources")
        U.api().navigate("has", { hasView: "sources" });
      else return false;
      return true;
    },
  });
})();
