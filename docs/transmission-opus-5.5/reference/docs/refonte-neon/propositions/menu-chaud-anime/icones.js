/* global document, MutationObserver */
(() => {
  'use strict';
  // Static decorative SVG only. Menu state, destinations and theme controls remain in the existing simulator.
  const shapes = {
    dashboard:
      '<path class="mf-fill mw-motion mw-tiles" d="M5 6h9v9H5Zm13 12h9v8h-9Z"/><path d="M18 6h9v9h-9ZM5 19h9v7H5Z"/><path class="mf-accent mf-signal" d="M22 2h5l3 3M2 23v4l3 3"/>',
    organisation:
      '<path d="M16 11v5M7 22v-6h18v6"/><path class="mf-fill mw-motion mw-organisation" d="m16 3 5 3v6l-5 3-5-3V6Z"/><path class="mf-fill" d="M7 21l5 3v5H2v-5Zm18 0 5 3v5H20v-5Z"/><circle class="mf-node mf-signal" cx="16" cy="18" r="1.8"/>',
    pilotage:
      '<path class="mf-orbit" d="M3 23V5h26M3 12h26M3 19h26"/><path d="M3 27h26"/><path class="mf-accent mw-motion mw-pilotage" d="m5 22 6-8 6 3L27 5M21 5h6v6"/><circle class="mf-node mf-signal" cx="17" cy="17" r="2"/>',
    risques:
      '<g class="mw-motion mw-risque"><path class="mf-fill" d="m16 3 14 25H2Z"/><path d="M16 11v8"/><circle class="mf-node" cx="16" cy="23" r="1.6"/></g><path class="mf-accent" d="m3 8 3-5h4M26 3h3v5"/>',
    conformite:
      '<path class="mf-fill" d="m16 3 11 4v10c0 6-11 12-11 12S5 23 5 17V7Z"/><path class="mw-motion mw-check" d="m10 15 4 4 8-9"/><path class="mf-accent mf-signal" d="M1 11v8m30-8v8M12 2h8"/>',
    actions:
      '<path class="mf-orbit" d="M7 7v18h20"/><path class="mf-fill" d="M3 3h8v8H3Zm18 18h8v8h-8Z"/><path d="m5 17 3 3 6-7"/><path class="mf-accent mw-motion mw-action" d="M17 7h10m-4-4 4 4-4 4"/><circle class="mf-node mf-signal" cx="17" cy="25" r="1.8"/>',
    resilience:
      '<path class="mf-orbit" d="M16 3a13 13 0 1 0 13 13"/><path class="mf-accent mw-motion mw-resilience" d="M27 12a11 11 0 1 0-2 12M27 5v7h-7"/><path d="M16 10v7l5 3"/><circle class="mf-node mf-signal" cx="7" cy="7" r="2"/>',
    documents:
      '<path class="mf-orbit" d="M4 7v22h18"/><path class="mf-fill" d="M9 3h12l7 7v17H9Z"/><path d="M21 3v8h7"/><path class="mw-motion mw-document" d="M13 16h10m-10 5h7"/><path class="mf-accent mf-signal" d="M2 2h4M28 29h3v-4"/>',
  };
  const originals = new WeakMap();
  function update() {
    document.querySelectorAll('.mh-family > .mh-icon').forEach((svg) => {
      const button = svg.parentElement;
      const key = button.dataset.mhFamily || button.dataset.mhPage;
      if (!originals.has(svg)) originals.set(svg, { html: svg.innerHTML, box: svg.getAttribute('viewBox') });
      const source = originals.get(svg);
      const light = document.documentElement.dataset.theme === 'light';
      svg.setAttribute('viewBox', light ? '0 0 32 32' : source.box);
      svg.innerHTML = light ? shapes[key] || source.html : source.html;
    });
  }
  new MutationObserver(update).observe(document.getElementById('mh-menu'), { childList: true });
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  update();
})();
