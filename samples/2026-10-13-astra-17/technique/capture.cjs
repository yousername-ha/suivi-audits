/* Captures de l'application RÉELLEMENT intégrée (aucune CSS injectée) : habillage global Référence 08.
   Serveur et base temporaires, données FICTIVES (tests/nes-harness.cjs). Usage :
   CHROMIUM_EXECUTABLE=… node samples/2026-10-13-astra-17/technique/capture.cjs */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "../../.."),
  OUT = path.resolve(__dirname, ".."),
  PORT = Number(process.env.NES_CAPTURE_PORT || 8291);
const H = require(path.join(ROOT, "tests/nes-harness.cjs"));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const files = [],
  errors = [],
  external = [],
  checks = [];
let n = 0;

(async () => {
  fs.rmSync(path.join(OUT, "images"), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "images"), { recursive: true });
  const { server, url } = await H.startServer(ROOT, PORT);
  const browser = await H.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(url)) external.push(r.url());
  });
  try {
    await H.login(page, url);
    await H.seed(page);
    await page.waitForTimeout(500);
    const registry = await page.evaluate(() => LegacyIntegrationUI.toolkit.api().astra.navigation());
    const find = (sec, id) => {
      const s = registry.find((x) => x.id === sec),
        i = s?.items.find((x) => x.id === id);
      if (!i) throw Error("Route absente " + sec + "/" + id);
      return { section: s, item: i };
    };
    const save = async (name, meta, target = page) => {
      await target.evaluate(() => document.fonts.ready);
      await target.waitForTimeout(150);
      const buf = await target.screenshot({ animations: "disabled" });
      const view = target.viewportSize();
      const overflow = await target.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4);
      const file = String(++n).padStart(3, "0") + "-" + name + ".png";
      fs.writeFileSync(path.join(OUT, "images", file), buf);
      files.push({ file: "images/" + file, ...meta, width: view.width, height: view.height, sha256: sha(buf), documentOverflow: overflow });
    };
    const go = async (sec, id, extra) => {
      const { item } = find(sec, id);
      await H.navigate(page, item.tab, item.set || {});
      await page.waitForTimeout(250);
      if (extra) await extra();
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector(".side-nav")?.scrollTo(0, 0);
      });
    };
    const style = () => page.evaluate(() => document.documentElement.dataset.nesStyle);

    // 1. Trente vues de la série 14, rendues par l'application intégrée (style Sauge).
    const routes = [["dash", "dash"], ["risks", "risk-register"], ["risks", "risk-map"], ["risks", "risk-studies"], ["compliance", "iso"], ["compliance", "ann"], ["care", "df-care-dash"], ["has", "df-has-dash"], ["audit", "cibles"], ["proofs", "prv-reg"], ["pcra", "pcra-dashboard"], ["pcra", "pcra-bias"], ["perimeters", "perimeter-registry"], ["suppliers", "sup"], ["admin", "admin-overview"], ["programs", "pl-formation"], ["ops", "inc-reg"], ["ai", "reg"], ["context", "ctx-pi"]];
    for (const [sec, id] of routes) {
      await go(sec, id);
      await save(`${sec}-${id}-sage`, { kind: "route", section: sec, id, style: await style() });
    }
    for (const [sec, id, views] of [["actions", "fd", [["list", "Liste"], ["kanban", "Kanban"], ["planning", "Planning"], ["calendar", "Calendrier"], ["gantt", "Gantt"], ["summary", "Synthèse"]]], ["recurring", "pl-rec", [["list", "Liste"], ["kanban", "Kanban"], ["planning", "Planning"], ["calendar", "Calendrier"]]]])
      for (const [view, label] of views) {
        await go(sec, id, async () => {
          await page.locator(`[data-astra=view][data-value=${view}]`).click();
          checks.push({ name: `${sec} / ${label} actif`, pass: (await page.locator(`[data-astra=view][data-value=${view}]`).getAttribute("aria-pressed")) === "true" });
        });
        await save(`${sec}-${view}-sage`, { kind: "view", section: sec, view: label, style: await style() });
      }
    await go("recurring", "pl-rec", async () => {
      await page.locator("[data-astra=view][data-value=list]").click();
      await page.locator('#panel [data-astra=work-detail][data-id="NES-REC-0"]').click();
      checks.push({ name: "Historique de réalisation visible", pass: (await page.locator("#as-detail").innerText()).includes("Revue des habilitations effectuée") });
    });
    await save("recurring-fiche-historique-sage", { kind: "detail", section: "recurring", style: await style() });
    await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));

    // 2. Administration → Apparence : panneau enregistré, puis aperçu non enregistré d'un autre style.
    await go("admin", "admin-appearance", async () => page.locator("#nes-appearance").waitFor());
    await save("admin-appearance-enregistre", { kind: "appearance", state: "enregistré pour tous : Sauge", style: await style() });
    await page.locator("#nes-appearance input[value=clair]").check();
    await save("admin-appearance-apercu-clair", { kind: "appearance", state: "aperçu non enregistré : Clair bleuté", style: await style() });
    await page.locator("#nes-save").click();
    await page.waitForFunction(() => /enregistré pour tous les utilisateurs/.test(document.querySelector("#nes-state")?.textContent || ""));
    await save("admin-appearance-enregistre-clair", { kind: "appearance", state: "enregistré pour tous : Clair bleuté (révision 2)", style: await style() });

    // 3. Style Clair bleuté, quelques vues.
    checks.push({ name: "Style global Clair bleuté appliqué", pass: (await style()) === "clair" });
    for (const [sec, id, view] of [["dash", "dash"], ["risks", "risk-map"], ["actions", "fd", "kanban"], ["recurring", "pl-rec", "list"]]) {
      await go(sec, id, async () => view && page.locator(`[data-astra=view][data-value=${view}]`).click());
      await save(`${sec}-${view || id}-clair`, { kind: "style-clair", section: sec, style: await style() });
    }
    // Retour au style par défaut, enregistré lui aussi.
    await go("admin", "admin-appearance", async () => page.locator("#nes-appearance").waitFor());
    await page.locator("#nes-appearance input[value=sage]").check();
    await page.locator("#nes-save").click();
    await page.waitForFunction(() => NesStyle.state().global?.style === "sage" && !NesStyle.state().saving);

    // 4. Mode sombre personnel.
    await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
    await page.waitForFunction(() => document.documentElement.dataset.nesMode === "dark");
    for (const [sec, id] of [["dash", "dash"], ["risks", "risk-map"]]) {
      await go(sec, id);
      await save(`${sec}-${id}-sombre`, { kind: "dark", section: sec, style: await style() });
    }
    await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
    await page.waitForFunction(() => document.documentElement.dataset.nesMode === "light");

    // 5. Largeurs de recette.
    for (const [w, h] of [[390, 844], [768, 1024], [1440, 900], [1920, 1080]]) {
      const p = await context.newPage();
      await p.setViewportSize({ width: w, height: h });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(url);
      await p.locator("#lx-account").waitFor();
      for (const [sec, id] of [["dash", "dash"], ["risks", "risk-map"]]) {
        const { item } = find(sec, id);
        await H.navigate(p, item.tab, item.set || {});
        await p.waitForTimeout(250);
        await save(`${sec}-${id}-${w}`, { kind: "responsive", section: sec, style: await p.evaluate(() => document.documentElement.dataset.nesStyle) }, p);
      }
      await p.close();
    }

    // 6. Cartographies protégées (aucun habillage), accès direct.
    for (const [id, tab, set] of [["carto-context", "carto", { mbView: "context" }], ["carto-process", "carto", { mbView: "process" }], ["dash-map", "dash", { dashView: "map" }]]) {
      const p = await context.newPage();
      await p.setViewportSize({ width: 1600, height: 1100 });
      await p.addInitScript(([k, v]) => localStorage.setItem(k, v), ["suivi-audits-legacy-df:ui", JSON.stringify({ tab, ...set })]);
      await p.goto(url);
      await p.locator("#lx-account").waitFor();
      await p.waitForTimeout(900);
      const attr = await p.evaluate(() => document.documentElement.hasAttribute("data-nes-style"));
      checks.push({ name: "Cartographie sans habillage : " + id, pass: !attr && (await p.locator(".nes-header").count()) === 0 });
      await save(`${id}-protegee`, { kind: "protected", route: id, style: null }, p);
      await p.close();
    }

    const sourceFiles = execFileSync("git", ["ls-files", "index.html", "modules", "demarrer.py", "legacy_server.py", "legacy_cartography.py", "legacy_risks.py"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n");
    const manifest = {
      branch: execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim(),
      applicationReference: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
      date: "2026-10-13",
      type: "Captures de l'application intégrée (habillage global Référence 08), cartographies exclues",
      images: files.length,
      errors,
      externalRequests: external,
      checks,
      sourceHashes: Object.fromEntries(sourceFiles.map((f) => [f, sha(fs.readFileSync(path.join(ROOT, f)))])),
      files,
    };
    fs.writeFileSync(path.join(OUT, "technique/verification.json"), JSON.stringify(manifest, null, 2) + "\n");
    const bad = files.filter((f) => f.documentOverflow);
    if (errors.length || external.length || checks.some((c) => !c.pass) || new Set(files.map((f) => f.sha256)).size !== files.length || bad.length)
      throw Error("Contrôles non satisfaits : " + JSON.stringify({ errors, external, checks: checks.filter((c) => !c.pass), overflow: bad.map((f) => f.file) }));
    console.log("TERMINÉ", files.length, "images");
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
