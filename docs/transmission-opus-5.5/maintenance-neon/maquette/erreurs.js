/* Habillage de maquette : préférer les métadonnées de sévérité si disponibles. */
(() => {
  const list = document.getElementById("events-list");
  function isError(row) {
    const level = row.dataset.level || row.dataset.severity;
    if (level)
      return ["error", "fatal", "50", "60"].includes(level.toLowerCase());
    if (row.dataset.exitCode !== undefined) {
      const code = Number(row.dataset.exitCode);
      if (Number.isFinite(code) && code !== 0) return true;
    }
    const text = row.querySelector(".event-label")?.textContent.trim() || "";
    return /^(?:ERREUR\s*:|ERROR\s*:|FATAL\s*:|\[(?:ERROR|FATAL)\](?:\s|$))/i.test(
      text,
    );
  }
  function colorize() {
    for (const row of list.children)
      row.classList.toggle("log-error", isError(row));
  }
  colorize();
  document.getElementById("scene").addEventListener("change", colorize);
  new MutationObserver(colorize).observe(list, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-level", "data-severity", "data-exit-code"],
  });
})();
