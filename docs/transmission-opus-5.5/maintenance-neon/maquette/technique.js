/* Lignes illustratives anonymes, inspirées du script et de Compose. Aucun journal réel lu. */
(() => {
  const get = (id) => document.getElementById(id);
  const list = get("events-list");
  const install = [
    "== Version 6.3.0 du dépôt et images",
    "app       Pulled",
    "web       Pulled",
    "== Démarrage de la version 6.3.0",
    "app       Recreated",
    "web       Recreated",
    "app       Starting",
    "web       Starting",
  ];
  const samples = {
    waiting: [],
    preparing: [
      "== Contrôles",
      "== Vérification de la version 6.3.0",
      "app       Pulling",
      "web       Pulling",
    ],
    backup: [
      "== Sauvegarde chiffrée",
      "backup    Archivage en cours",
      "backup    Chiffrement en cours",
    ],
    installing: install,
    verifying: [
      ...install,
      "== Contrôle de santé",
      "Santé : vérification en cours",
    ],
    success: [
      ...install,
      "== Contrôle de santé",
      "Santé : service prêt",
      "== Mise à jour terminée : 6.2.0 → 6.3.0",
    ],
    rollback: [
      ...install,
      "ATTENTION : contrôle en échec",
      "== Retour arrière vers 6.2.0",
      "app       Recreated",
    ],
    rolled_back: [
      ...install,
      "== Retour arrière vers 6.2.0",
      "Santé : service prêt",
    ],
    failed: [...install.slice(0, 6), "ERREUR : mise à jour interrompue"],
    intervention: [
      ...install,
      "== Retour arrière vers 6.2.0",
      "ERREUR : intervention nécessaire",
    ],
    connection: install,
    delay: install,
  };
  function render() {
    const scene = document.documentElement.dataset.scene || "installing";
    const lines = samples[scene] || install;
    // Tout l'historique reçu reste présent ; le masque est seulement visuel.
    const shown = lines.map((text, index) => ({
      text,
      key: String(index) + ":" + text,
      index,
    }));
    const keys = new Set(shown.map((e) => e.key));
    for (const row of [...list.children])
      if (!keys.has(row.dataset.key)) row.remove();
    for (const [index, event] of shown.entries()) {
      let row = [...list.children].find((r) => r.dataset.key === event.key);
      if (!row) {
        row = document.createElement("li");
        row.className = "event-line";
        row.dataset.key = event.key;
        const time = document.createElement("time");
        time.textContent =
          "14:34:" + String(4 + event.index * 2).padStart(2, "0");
        const text = document.createElement("span");
        text.className = "event-label";
        text.textContent = event.text;
        row.append(time, text);
        list.append(row);
      }
      row.classList.toggle("latest", index === shown.length - 1);
    }
    get("events-empty").hidden = lines.length > 0;
    get("events-count").textContent = String(lines.length);
    get("events-state").textContent = "Extrait technique simulé";
    get("events-foot").textContent = "Aucune sortie système réelle";
  }
  get("scene").addEventListener("change", render);
  render();
})();
