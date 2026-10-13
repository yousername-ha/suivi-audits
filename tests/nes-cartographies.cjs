/* Cartographies protégées : comparaison avant / après (même jeu FICTIF, même fenêtre, même mode).
   Usage : node tests/nes-cartographies.cjs <racine-avant> <racine-après> [dossier-de-captures]
   Les trois routes (carto/context, carto/process, dash/map) doivent donner des images et des mesures identiques,
   y compris après un changement global de style reçu pendant leur affichage. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const H = require("./nes-harness.cjs");
const UIKEY = "suivi-audits-legacy-df:ui";
const [before, after, out = ""] = process.argv.slice(2);
if (!before || !after) throw Error("Usage : nes-cartographies.cjs <avant> <après> [dossier]");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const ROUTES = [
  ["carto-context", "carto", { mbView: "context" }],
  ["carto-process", "carto", { mbView: "process" }],
  ["dash-map", "dash", { dashView: "map" }],
];

async function run(root, port, label, extra) {
  const { server, url } = await H.startServer(root, port);
  const browser = await H.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-FR", timezoneId: "Europe/Paris" })).newPage();
  const result = {};
  try {
    await H.login(page, url);
    await H.seed(page);
    await page.waitForTimeout(500);
    // Accès direct : page neuve ouverte sur la route (aucun rendu habillé auparavant), puis interactions.
    const context = page.context();
    for (const [id, tab, set] of ROUTES) {
      const p = await context.newPage();
      await p.setViewportSize({ width: 1440, height: 1000 });
      await p.addInitScript(([k, v]) => localStorage.setItem(k, v), [UIKEY, JSON.stringify({ tab, ...set })]);
      await p.goto(url);
      await p.locator("#lx-account").waitFor();
      await p.waitForTimeout(900);
      const shot = async (name) => {
        const buf = await p.screenshot({ animations: "disabled" });
        if (out) fs.writeFileSync(path.join(out, `${label}-${id}-${name}.png`), buf);
        return sha(buf);
      };
      const metrics = () =>
        p.evaluate(() => {
          const box = (s) => {
            const e = document.querySelector(s);
            if (!e) return null;
            const r = e.getBoundingClientRect(),
              c = getComputedStyle(e);
            return [r.x, r.y, r.width, r.height, c.fontFamily, c.backgroundColor, c.color];
          };
          return {
            attributes: [...document.documentElement.attributes].map((a) => a.name).filter((n) => n.startsWith("data-nes")),
            header: !!document.querySelector(".nes-header"),
            chevrons: document.querySelectorAll(".nes-chev").length,
            boxes: ["body", ".app", ".side", ".top", ".wrap", "#panel", "#mbSvg", ".mn.on", ".lx-nav-heading", ".user .av", "#bell"].map(box),
            scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          };
        });
      const r = { initial: await shot("initial"), metrics: await metrics() };
      const svg = p.locator("#mbSvg");
      if (await svg.count()) {
        const bb = await svg.boundingBox();
        await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await p.mouse.wheel(0, -300);
        await p.waitForTimeout(150);
        r.zoom = await shot("zoom");
        await p.mouse.down();
        await p.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 + 30, { steps: 4 });
        await p.mouse.up();
        await p.waitForTimeout(150);
        r.pan = await shot("pan");
        const node = p.locator("#mbVp [data-n]").first();
        if (await node.count()) {
          await node.click();
          await p.waitForTimeout(150);
          r.select = await shot("select");
        }
        const fit = p.locator("[data-mb=fit]");
        if (await fit.count()) {
          await fit.click();
          await p.waitForTimeout(150);
          r.fit = await shot("fit");
        }
      }
      result[id] = r;
      await p.close();
    }
    // Changement global reçu pendant l'affichage d'une cartographie (candidat seulement : l'API n'existe pas avant).
    if (extra) {
      const [, tab, set] = ROUTES[0];
      await H.navigate(page, tab, set);
      await page.waitForTimeout(500);
      const buf0 = await page.screenshot({ animations: "disabled" });
      const m0 = await page.evaluate(() => document.documentElement.outerHTML.length);
      const admin = await page.evaluate(async () => {
        const s = await LegacyServer.request("/api/appearance");
        return LegacyServer.request("/api/admin/appearance", { method: "PUT", body: JSON.stringify({ style: "clair", revision: s.revision }) });
      });
      assert.equal(admin.style, "clair");
      await page.evaluate(() => NesStyle.refresh());
      await page.waitForFunction(() => NesStyle.state().global?.style === "clair");
      await page.waitForTimeout(300);
      const buf1 = await page.screenshot({ animations: "disabled" });
      result.receivedWhileOnMap = { identical: sha(buf0) === sha(buf1), noAttribute: !(await page.evaluate(() => document.documentElement.hasAttribute("data-nes-style"))), noHeader: (await page.locator(".nes-header").count()) === 0, domSize: [m0, await page.evaluate(() => document.documentElement.outerHTML.length)] };
      // Sortie de la carte : le style courant est appliqué ; retour : enveloppe de nouveau retirée.
      await H.navigate(page, "dash", { dashView: "cards" });
      result.afterLeaving = await page.evaluate(() => document.documentElement.getAttribute("data-nes-style"));
      await H.navigate(page, "carto", { mbView: "process" });
      result.afterReturn = { attribute: await page.evaluate(() => document.documentElement.getAttribute("data-nes-style")), header: await page.locator(".nes-header").count() };
    }
  } finally {
    await browser.close();
    server.kill();
  }
  return result;
}
(async () => {
  if (out) fs.mkdirSync(out, { recursive: true });
  const a = await run(before, 8241, "avant", false);
  const b = await run(after, 8242, "apres", true);
  const report = [];
  for (const [id] of ROUTES) {
    const keys = Object.keys(a[id]);
    for (const k of keys) {
      const same = JSON.stringify(a[id][k]) === JSON.stringify(b[id][k]);
      report.push({ route: id, element: k, identique: same });
    }
  }
  console.log(JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ receivedWhileOnMap: b.receivedWhileOnMap, afterLeaving: b.afterLeaving, afterReturn: b.afterReturn }));
  if (out) fs.writeFileSync(path.join(out, "cartographies-avant-apres.json"), JSON.stringify({ report, apres: { receivedWhileOnMap: b.receivedWhileOnMap, afterLeaving: b.afterLeaving, afterReturn: b.afterReturn } }, null, 2) + "\n");
  assert(report.every((r) => r.identique), "Une cartographie diffère avant / après");
  assert.equal(b.receivedWhileOnMap.identical, true);
  assert.equal(b.receivedWhileOnMap.noAttribute, true);
  assert.equal(b.receivedWhileOnMap.noHeader, true);
  assert.equal(b.afterLeaving, "clair");
  assert.deepEqual(b.afterReturn, { attribute: null, header: 0 });
  console.log("CARTOGRAPHIES INCHANGÉES");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
