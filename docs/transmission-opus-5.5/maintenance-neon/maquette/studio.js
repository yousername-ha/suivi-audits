/* Maquette autonome : aucune requête réseau, aucun appel au service de mise à jour. */
(() => {
  const root = document.documentElement;
  const get = (id) => document.getElementById(id);
  const phases = ["preparing", "backup", "installing", "verifying", "complete"];
  const copy = {
    preparing: {
      phase: "preparing",
      title: "Téléchargement et préparation",
      message: "Préparation et contrôle de la nouvelle version.",
      number: "01",
    },
    backup: {
      phase: "backup",
      title: "Sauvegarde en cours",
      message: "Création de la sauvegarde de sécurité avant installation.",
      number: "02",
    },
    installing: {
      phase: "installing",
      title: "Installation en cours",
      message: "Installation de la nouvelle version.",
      number: "03",
    },
    waiting: {
      phase: "preparing",
      title: "Préparation de l’installation",
      message:
        "Demande enregistrée. Le service de mise à jour prépare l’installation ; cette page se met à jour toute seule.",
      number: "01",
      waiting: true,
    },
    verifying: {
      phase: "verifying",
      title: "Vérification en cours",
      message: "Vérification du bon fonctionnement de la nouvelle version.",
      number: "04",
    },
    success: {
      phase: "complete",
      title: "Votre espace est prêt",
      message: "La mise à jour est terminée.",
      number: "05",
      end: true,
    },
    rollback: {
      phase: "rollback",
      title: "Retour à la version précédente",
      message:
        "La nouvelle version n’a pas pu être installée. Restauration de la version précédente.",
      number: "—",
      rollback: true,
    },
    rolled_back: {
      phase: "rollback",
      title: "La version précédente est rétablie",
      message:
        "La mise à jour n’a pas été installée. Votre espace est de nouveau disponible dans sa version précédente.",
      number: "—",
      rollback: true,
      end: true,
      healthy: true,
    },
    failed: {
      phase: "installing",
      title: "La mise à jour n’a pas été installée",
      message:
        "L’opération a échoué. Consultez le résultat dans l’application.",
      number: "03",
      end: true,
      healthy: true,
    },
    intervention: {
      phase: "rollback",
      title: "Une intervention est nécessaire",
      message:
        "La restauration automatique n’a pas pu aboutir. Un administrateur doit intervenir.",
      number: "—",
      rollback: true,
      end: true,
    },
    connection: {
      phase: "installing",
      title: "Installation en cours",
      message: "Installation de la nouvelle version.",
      number: "03",
      disconnected: true,
    },
    delay: {
      phase: "installing",
      title: "Installation en cours",
      message: "Installation de la nouvelle version.",
      number: "03",
      delay: true,
    },
  };
  let sceneStarted = performance.now();
  let active = copy.installing;
  const times = ["14:32:00", "14:32:12", "14:32:45", "14:35:12", "14:35:48"];
  function render(scene) {
    active = copy[scene] || copy.installing;
    sceneStarted = performance.now();
    root.dataset.scene = scene;
    const illustrations = {
      preparing: "download",
      backup: "backup",
      installing: "building",
      waiting: "waiting",
      verifying: "verifying",
      success: "complete",
      rollback: "rollback",
      rolled_back: "restored",
      failed: "alert",
      intervention: "alert",
      connection: "building",
      delay: "building",
    };
    root.dataset.art = illustrations[scene] || "building";
    document.querySelector(".axis-label.top").textContent = {
      download: "TRANSFERT DE LA VERSION",
      backup: "SAUVEGARDE",
      building: "INSTALLATION",
      verifying: "VÉRIFICATION",
      complete: "TERMINÉ",
      rollback: "RESTAURATION",
      restored: "VERSION RÉTABLIE",
      alert: "ATTENTION",
      waiting: "INITIALISATION",
    }[root.dataset.art];
    get("phase-title").textContent = active.disconnected
      ? "Dernier état : installation"
      : active.title;
    get("message").textContent = active.message;
    get("core-number").textContent = active.number;
    get("step-label").textContent = active.rollback
      ? "RESTAURATION"
      : `ÉTAPE ${active.number}`;
    get("reactor-caption").textContent = active.title;
    document.querySelector(".phase-index small").textContent = active.rollback
      ? "RESTAURATION"
      : active.end
        ? "DERNIÈRE ÉTAPE"
        : "ÉTAPE EN COURS";
    document.querySelector(".phase-denominator").hidden = !!active.rollback;
    get("duration-label").textContent = active.end
      ? "DURÉE TOTALE"
      : "DURÉE ÉCOULÉE";
    get("title").innerHTML =
      scene === "success"
        ? "Votre espace est <span>prêt.</span>"
        : scene === "intervention"
          ? "Une intervention <span>est nécessaire.</span>"
          : scene === "failed"
            ? "Mise à jour <span>interrompue.</span>"
            : scene === "rolled_back"
              ? "Votre espace est <span>rétabli.</span>"
              : "Votre espace <span>évolue.</span>";
    get("eyebrow").textContent = active.end
      ? scene === "success"
        ? "MISE À JOUR TERMINÉE"
        : "MISE À JOUR INTERROMPUE"
      : "MISE À JOUR EN COURS";
    get("live-label").innerHTML =
      `<span class="signal-dot"></span>${active.disconnected ? "SUIVI INTERROMPU" : scene === "intervention" ? "INTERVENTION REQUISE" : active.end ? "OPÉRATION TERMINÉE" : "EN COURS"}`;
    get("intro-copy").textContent =
      scene === "intervention"
        ? "Votre espace reste en maintenance. Contactez votre administrateur."
        : scene === "success"
          ? "La transition est terminée. Votre espace peut vous accueillir."
          : "Un instant de transition. Une plateforme prête pour la suite.";
    get("return-hint").textContent =
      scene === "intervention"
        ? "Le retour automatique reste suspendu dans l’attente d’une intervention."
        : active.healthy
          ? "Votre espace est disponible. Vous pouvez y consulter le résultat."
          : "Votre espace revient automatiquement dès qu’il est disponible.";
    get("connection-status").innerHTML = active.disconnected
      ? "Interrompu"
      : 'Actif<span class="metric-dot"></span>';
    get("connection").hidden = !active.disconnected;
    get("delay").hidden = !active.delay;
    get("receipt").hidden = !active.end;
    get("return").hidden = !active.healthy;
    get("rollback-step").hidden = !active.rollback;
    get("rollback-copy").textContent =
      scene === "intervention"
        ? "Restauration interrompue — intervention nécessaire."
        : active.end
          ? "Restauration terminée."
          : "Restauration en cours.";
    get("steps").hidden = !!active.healthy;
    get("journey-note").hidden = !!active.healthy;
    document.querySelector(".journey-heading h2").textContent = active.healthy
      ? "Résultat de l’opération"
      : "Le parcours de mise à jour";
    get("footer-state").textContent = active.disconnected
      ? "Reprise automatique du suivi à la reconnexion"
      : "Suivi automatique de l’installation";
    const current = active.rollback ? 2 : phases.indexOf(active.phase);
    document.querySelectorAll("#steps [data-phase]").forEach((li, index) => {
      const done =
        index < current || (scene === "success" && index === current);
      const isCurrent = index === current && !active.end && !active.rollback;
      li.className = done ? "done" : isCurrent ? "current" : "";
      if (isCurrent) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
      li.querySelector(".step-status").textContent = done
        ? "Terminée"
        : isCurrent
          ? "En cours…"
          : active.rollback && index === 2
            ? "Interrompue"
            : scene === "intervention"
              ? "Suspendue"
              : active.end
                ? "Non réalisée"
                : "À venir";
      li.querySelector("time").textContent =
        !active.waiting &&
        (done || isCurrent || (active.rollback && index === 2))
          ? times[index]
          : "";
    });
    get("elapsed").hidden = !!active.waiting;
    get("duration-label").hidden = !!active.waiting;
    updateDuration();
  }
  function updateDuration() {
    const elapsed = active.end
      ? active.rollback
        ? 320
        : 228
      : active.delay
        ? 743
        : (active.rollback
            ? 280
            : active.phase === "preparing"
              ? 6
              : active.phase === "backup"
                ? 22
                : active.phase === "verifying"
                  ? 192
                  : 138) +
          Math.floor((performance.now() - sceneStarted) / 1000);
    get("elapsed").textContent =
      `${String(Math.floor(elapsed / 60)).padStart(2, "0")} min ${String(elapsed % 60).padStart(2, "0")} s`;
  }
  get("scene").addEventListener("change", (e) => render(e.target.value));
  get("pause").addEventListener("click", () => {
    const paused = root.dataset.paused !== "true";
    root.dataset.paused = String(paused);
    get("pause").setAttribute("aria-pressed", String(paused));
    get("pause").setAttribute(
      "aria-label",
      paused ? "Reprendre les animations" : "Mettre les animations en pause",
    );
    get("pause").innerHTML =
      `<svg><use href="#i-${paused ? "play" : "pause"}"/></svg>`;
  });
  get("theme").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    get("theme").setAttribute(
      "aria-label",
      root.dataset.theme === "dark"
        ? "Afficher le thème clair"
        : "Afficher le thème sombre",
    );
  });
  get("return").addEventListener("click", (e) => {
    e.preventDefault();
  });
  const requested = new URLSearchParams(location.search);
  if (requested.get("focus") === "1") root.dataset.focus = "true";
  const initial = requested.get("scene");
  if (requested.get("theme") === "light") get("theme").click();
  if (initial && copy[initial]) {
    get("scene").value = initial;
    render(initial);
  } else render("installing");
  setInterval(updateDuration, 1000);
})();
