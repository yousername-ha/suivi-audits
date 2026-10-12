/* Recette ASTRA : fixtures synthétiques uniquement, serveur et données temporaires. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
const ROOT = path.resolve(__dirname, ".."),
  TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "astra-browser-"));
const RESULTS = process.env.ASTRA_RESULTS || TEMP;
fs.mkdirSync(RESULTS, { recursive: true });
const PORT = Number(process.env.ASTRA_PORT || 8197),
  URL = process.env.ASTRA_URL || `http://127.0.0.1:${PORT}`;
let server;
async function start() {
  if (process.env.ASTRA_URL) return;
  server = spawn(
    process.env.ASTRA_LAUNCHER === "sh" ? "sh" : (process.env.PYTHON || "python3"),
    [
      process.env.ASTRA_LAUNCHER === "sh" ? "demarrer.sh" : "demarrer.py",
      "--sans-navigateur",
      "--port",
      String(PORT),
      "--donnees",
      path.join(TEMP, "data"),
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error("Serveur arrêté : " + code)));
  });
}

(async () => {
  await start();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });
  const errors = [],
    checks = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("BROWSER ERROR", e.message);
  });
  page.on("response", async (r) => {
    if (r.status() >= 400) console.log("HTTP", r.status(), r.url(), await r.text());
  });
  const nav = (tab, set = {}) =>
    page.evaluate(
      ([tab, set]) => LegacyIntegrationUI.toolkit.api().navigate(tab, set),
      [tab, set],
    );
  const check = async (name, fn) => {
    await fn();
    checks.push(name);
    console.log("PASS", name);
  };
  try {
    await page.goto(URL);
    await page.locator("#lx-auth [name=login]").fill("admin");
    await page.locator("#lx-auth [name=password]").fill("admin");
    await page.locator("#lx-auth [type=submit]").click();
    await page.locator("#lx-account").waitFor();
    await check("Cockpit et lancement local", async () => {
      await page
        .getByRole("heading", { name: "Cockpit RSSI", exact: true })
        .waitFor();
    });
    await page.evaluate(async () => {
      const u = LegacyIntegrationUI.toolkit;
      const built = LegacyDemo.build(u.state(), "Recette ASTRA");
      u.api().replaceState(built.state);
      await u.mutate((s) => {
        const scope = s.perimeters.map((p) => p.id);
        for (let n = 0; n < 8; n++) {
          if (s.findings.some((f) => f.id === "ASTRA-" + n)) continue;
          s.findings.push({
            id: "ASTRA-" + n,
            text:
              [
                "Renforcer les accès privilégiés",
                "Tester la restauration hors ligne",
                "Revoir les habilitations",
                "Segmenter le réseau clinique",
                "Qualifier les alertes critiques",
                "Actualiser le PCA",
                "Collecter les preuves HDS",
                "Évaluer les fournisseurs",
              ][n] + " (FICTIF)",
            action: "",
            type: n % 3 === 0 ? "NC maj" : "PS",
            source: "Interne",
            year: 2026,
            status: n < 3 ? "Ouvert" : n < 6 ? "En cours" : "Clos",
            due: "2026-10-" + String(5 + n * 3).padStart(2, "0"),
            start: "2026-10-01",
            owner: n % 2 ? "Équipe SSI (FICTIF)" : "RSSI (FICTIF)",
            items: [],
            perimeterIds: scope,
            tasks: [
              { t: "Préparer", done: n > 2 },
              { t: "Vérifier", done: n > 5 },
            ],
            desc: "Description de recette",
            createdAt: new Date().toISOString(),
          });
        }
        for (let n = 0; n < 4; n++)
          if (!s.recurring.some((r) => r.id === "AS-REC-" + n))
            s.recurring.push({
              id: "AS-REC-" + n,
              title:
                [
                  "Revue des droits",
                  "Test de sauvegarde",
                  "Comité sécurité",
                  "Contrôle quotidien",
                ][n] + " (FICTIF)",
              n: 1,
              u: ["m", "s", "a", "j"][n],
              start: "2026-10-05",
              last: "",
              active: true,
              owner: "RSSI (FICTIF)",
              cat: "Gouvernance",
              history: [],
              perimeterIds: scope,
            });
        if (!s.plans.some((r) => r.id === "AS-PLAN"))
          s.plans.push({
            id: "AS-PLAN",
            type: "formation",
            title: "Formation cybersécurité (FICTIF)",
            status: "Planifié",
            start: "2026-10-12",
            end: "2026-10-20",
            owner: "RSSI (FICTIF)",
            items: [],
            perimeterIds: scope,
          });
        if (
          !s.riskMgmt.policies.some((p) => p.title === "Matrice ASTRA (FICTIF)")
        ) {
          const R = LegacyRisks,
            p = JSON.parse(JSON.stringify(R.DEFAULT_POLICY));
          p.title = "Matrice ASTRA (FICTIF)";
          p.perimeterIds = scope;
          p.calculation = "matrix";
          p.levels.forEach(
            (l, i) =>
              (l.color = ["#4DB86A", "#FFD83D", "#FF8735", "#FF353A"][i]),
          );
          p.impactScale.forEach((im, i) =>
            p.likelihoodScale.forEach(
              (lk, j) =>
                (p.matrix[im.id + ":" + lk.id] =
                  "L" + Math.min(4, 1 + Math.floor((i + j) / 2))),
            ),
          );
          const pol = R.policy(s, p);
          s.riskMgmt.risks.forEach((r, i) => {
            const a = R.assessment(
              s,
              {
                riskId: r.id,
                policyId: pol.id,
                impactId: "I" + (4 - i),
                likelihoodId: "V" + (4 - i),
                stage: "initial",
                date: "2026-10-01",
                justification: "Évaluation fictive de recette",
              },
              "Recette ASTRA",
            );
            R.reference(s, r.id, a.id);
          });
        }
      });
      u.api().render();
    });
    await check("Données persistées par le moteur existant", async () => {
      await page.reload();
      await page.locator("#lx-account").waitFor();
      await page.waitForTimeout(400);
      assert(
        await page.evaluate(() =>
          LegacyIntegrationUI.toolkit
            .state()
            .findings.some((f) => f.id === "ASTRA-0"),
        ),
      );
    });
    await check("Tableau de bord historique conservé", async () => {
      await page.locator("[data-astra=cockpit-advanced]").click();
      assert(
        (await page.locator("#panel").innerText()).includes("Tableau de bord"),
      );
      await page.locator("[data-astra=cockpit-advanced]").click();
    });
    await page.screenshot({
      path: path.join(RESULTS, "astra-cockpit.png"),
      fullPage: true,
    });
    await check("Matrice, sélection et fiche du risque", async () => {
      await nav("risks", { riskView: "map", riskId: "" });
      await page.locator("[data-astra=view][data-value=matrix]").click();
      assert.equal(await page.locator(".as-risk-cell").count(), 16);
      await page.locator(".as-cell-select").first().click();
      assert.equal(await page.locator(".as-risk-cell.selected").count(), 1);
      await page.locator(".as-risk-dots button").first().click();
      await page.locator("#as-detail").waitFor();
      assert(
        (await page.locator("#as-detail").innerText()).includes(
          "Plan de traitement",
        ),
      );
      await page.locator("#as-detail [data-astra=close]").click();
    });
    await page.screenshot({
      path: path.join(RESULTS, "astra-matrix.png"),
      fullPage: true,
    });
    await check("Conformité, hiérarchie et détail", async () => {
      await nav("conformite", { confView: "A" });
      assert.equal(await page.locator(".as-table tbody input").count(), 0);
      assert((await page.locator(".as-requirements details").count()) > 0);
      await page.locator("[data-astra=control]").first().click();
      await page.locator("#as-detail").waitFor();
      await page.locator("#as-detail [data-astra=close]").click();
    });
    await page.screenshot({
      path: path.join(RESULTS, "astra-compliance.png"),
      fullPage: true,
    });
    await check(
      "Actions : Kanban et changement de statut partagé",
      async () => {
        await nav("ecarts", { ecView: "list" });
        await page.locator("[data-astra=view][data-value=kanban]").click();
        await page
          .locator('[data-astra-drag="ASTRA-0"]')
          .dragTo(page.locator('[data-astra-drop="En cours"]'), {
            sourcePosition: { x: 15, y: 12 },
            targetPosition: { x: 20, y: 30 },
          });
        await page.waitForTimeout(400);
        assert.equal(
          await page.evaluate(
            () =>
              LegacyIntegrationUI.toolkit
                .state()
                .findings.find((f) => f.id === "ASTRA-0").status,
          ),
          "En cours",
        );
        await page.locator("[data-astra=view][data-value=list]").click();
        const row = page.locator(".as-table tr").filter({ hasText: "ASTRA-0" });
        assert((await row.innerText()).includes("En cours"));
      },
    );
    await page.locator("[data-astra=view][data-value=kanban]").click();
    await page.screenshot({
      path: path.join(RESULTS, "astra-kanban.png"),
      fullPage: true,
    });
    await check(
      "Actions : Planning, Calendrier, Gantt et Synthèse",
      async () => {
        for (const view of ["planning", "calendar", "gantt", "summary"]) {
          await page.locator(`[data-astra=view][data-value=${view}]`).click();
          assert((await page.locator("#panel").innerText()).length > 100);
        }
        await page.locator("[data-astra=view][data-value=gantt]").click();
        assert((await page.locator(".as-gantt-bar").count()) > 0);
      },
    );
    await page.screenshot({
      path: path.join(RESULTS, "astra-gantt.png"),
      fullPage: true,
    });
    await check("Action : édition existante et persistance", async () => {
      await page
        .locator('[data-astra=work-detail][data-id="ASTRA-0"]')
        .first()
        .click();
      await page.locator("#as-detail [data-astra=work-edit]").click();
      await page
        .locator('#drawer [data-fd="ASTRA-0"][data-f=owner]')
        .fill("RSSI recette persistée (FICTIF)");
      await page.locator("#drawer [data-act=saveclose]").click();
      await page.waitForTimeout(600);
      await page.reload();
      await page.locator("#lx-account").waitFor();
      assert.equal(
        await page.evaluate(
          () =>
            LegacyIntegrationUI.toolkit
              .state()
              .findings.find((f) => f.id === "ASTRA-0").owner,
        ),
        "RSSI recette persistée (FICTIF)",
      );
    });
    await check("Récurrences : vues et détail d’une projection", async () => {
      await nav("plans", { planView: "rec" });
      for (const view of ["list", "kanban", "planning", "calendar"]) {
        await page.locator(`[data-astra=view][data-value=${view}]`).click();
      }
      await page.locator("[data-astra=occurrence]").first().click();
      assert(
        (await page.locator("#as-detail").innerText()).includes("Projection"),
      );
      await page.locator("#as-detail [data-astra=close]").click();
    });
    await page.screenshot({
      path: path.join(RESULTS, "astra-recurring.png"),
      fullPage: true,
    });
    await check(
      "Réalisation récurrente : historique et prochaine échéance",
      async () => {
        await page.locator("[data-astra=view][data-value=list]").click();
        await page
          .locator('#panel [data-astra=work-detail][data-id="AS-REC-0"]')
          .click();
        await page.locator("#as-detail [data-astra=work-edit]").click();
        await page.locator("#recDate").fill("2026-10-11");
        await page.locator("#recCom").fill("Recette de persistance");
        await page.locator("#drawer [data-act=recsave]").click();
        await page.locator("#drawer [data-act=saveclose]").click();
        await page.waitForTimeout(500);
        await page.reload();
        await page.locator("#lx-account").waitFor();
        const info = await page.evaluate(() => {
          const u = LegacyIntegrationUI.toolkit,
            r = u.state().recurring.find((r) => r.id === "AS-REC-0");
          return {
            history: r.history,
            next: u.api().astra.isoD(u.api().astra.recNext(r)),
          };
        });
        assert(
          info.history.some((h) => h.comment === "Recette de persistance"),
        );
        assert.equal(info.next, "2026-11-11");
      },
    );
    await check(
      "Création et saisie rapide de programme persistées malgré une réponse retardée",
      async () => {
        await page.evaluate(() => LegacyServer.flush());
        let release, received;
        const gate = new Promise((resolve) => { release = resolve; });
        const saved = new Promise((resolve) => { received = resolve; });
        let held = false;
        const delayFirstSave = async (route) => {
          if (route.request().method() !== "PUT" || held) return route.continue();
          held = true;
          const response = await route.fetch();
          received();
          await gate;
          await route.fulfill({ response });
        };
        await page.route("**/api/state", delayFirstSave);
        await nav("plans", { planView: "cal" });
        await page.locator("[data-astra=new-plan]").click();
        await page.locator("#lx-dialog [name=type]").selectOption("formation");
        await page.locator("#lx-dialog [type=submit]").click();
        await saved;
        await page
          .locator("#drawer [data-plf=title]")
          .fill("Nouveau programme de recette (FICTIF)");
        await page.locator("#drawer [data-act=saveclose]").click();
        release();
        await page.evaluate(() => LegacyServer.flush());
        await page.unroute("**/api/state", delayFirstSave);
        await page.reload();
        await page.locator("#lx-account").waitFor();
        assert(
          await page.evaluate(() =>
            LegacyIntegrationUI.toolkit
              .state()
              .plans.some(
                (p) => p.title === "Nouveau programme de recette (FICTIF)" && p.internalId,
              ),
          ),
        );
      },
    );
    await check("Navigation complète sans erreur de rendu", async () => {
      const routes = await page.evaluate(() =>
        LegacyIntegrationUI.toolkit
          .api()
          .astra.navigation()
          .flatMap((s) => s.items),
      );
      for (const route of routes) {
        await nav(route.tab, route.set || {});
      }
      console.log("ROUTES", routes.length);
      assert.equal(errors.length, 0, errors.join("\n"));
    });
    await check(
      "Responsive 390 / 768 / 1440 / 1920 et thème sombre",
      async () => {
        for (const width of [390, 768, 1440, 1920]) {
          await page.setViewportSize({ width, height: 1000 });
          await nav("dash", { dashView: "cards" });
          const dimensions = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert(
            dimensions.scroll <= dimensions.width + 4,
            JSON.stringify(dimensions),
          );
          await page.screenshot({
            path: path.join(RESULTS, `astra-${width}.png`),
            fullPage: true,
          });
        }
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        await page.screenshot({
          path: path.join(RESULTS, "astra-dark.png"),
          fullPage: true,
        });
      },
    );
    await check(
      "Compte lecteur : consultation et absence de contrôles de mutation",
      async () => {
        await page.evaluate(async () => {
          const users = await LegacyServer.users();
          if (!users.some((u) => u.login === "astra_reader"))
            await LegacyServer.request("/api/users", {
              method: "POST",
              body: JSON.stringify({
                login: "astra_reader",
                name: "Lecteur de recette",
                password: "Fixture-Astra-Reader-Only-2026!",
                permission: "viewer",
                active: true,
                perimeterIds: LegacyIntegrationUI.toolkit
                  .state()
                  .perimeters.map((p) => p.id),
                roleIds: [],
                canValidate: false,
              }),
            });
        });
        const context = await browser.newContext();
        const reader = await context.newPage();
        await reader.goto(URL);
        await reader.locator("#lx-auth [name=login]").fill("astra_reader");
        await reader
          .locator("#lx-auth [name=password]")
          .fill("Fixture-Astra-Reader-Only-2026!");
        await reader.locator("#lx-auth [type=submit]").click();
        await reader.locator("#lx-account").waitFor();
        await reader.evaluate(() =>
          LegacyIntegrationUI.toolkit
            .api()
            .navigate("ecarts", { ecView: "list" }),
        );
        assert.equal(
          await reader.locator("[data-astra=new-action]").count(),
          0,
        );
        await reader.locator("[data-astra=view][data-value=kanban]").click();
        assert.equal(await reader.locator("[data-astra-drag]").count(), 0);
        await reader.locator("[data-astra=work-detail]").first().click();
        assert.equal(
          await reader.locator("#as-detail [data-astra=work-edit]").count(),
          0,
        );
        assert.equal(
          await reader.locator("#as-detail [data-astra-status]").count(),
          0,
        );
        await context.close();
      },
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("ALL PASSED", checks.length);
    fs.writeFileSync(
      path.join(RESULTS, "astra-browser-results.json"),
      JSON.stringify({ checks, errors }, null, 2),
    );
  } catch (e) {
    console.error(e);
    await page.screenshot({
      path: path.join(RESULTS, "astra-failure.png"),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(RESULTS, "astra-browser-results.json"),
      JSON.stringify({ checks, errors, failure: e.message }, null, 2),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await exited;
    }
  }
})().catch((e) => {
  console.error(e);
  server?.kill();
  process.exitCode = 1;
});
