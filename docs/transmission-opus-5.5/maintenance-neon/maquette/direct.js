/* Une remontée par entrée nouvelle ; jamais de boucle de faux événements. */
(() => {
  const list = document.getElementById("events-list");
  let known = new Set([...list.children].map((row) => row.dataset.key));
  document.getElementById("scene").addEventListener("change", () => {
    const rows = [...list.children];
    const keys = rows.map((row) => row.dataset.key);
    const appended = keys.some((key) => !known.has(key));
    const sameOperationPrefix = keys.some((key) => known.has(key));
    list.classList.remove("flow-rise");
    if (
      appended &&
      sameOperationPrefix &&
      document.documentElement.dataset.paused !== "true" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      void list.offsetWidth;
      list.classList.add("flow-rise");
    }
    known = new Set(keys);
  });
})();
