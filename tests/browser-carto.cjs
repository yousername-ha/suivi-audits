/* Recette SVG et navigation avec SQLite et comptes éphémères. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ROOT = path.resolve(__dirname, ".."),
  TMP = fs.mkdtempSync("/tmp/legacy-carto-browser-"),
  PORT = Number(process.env.CARTO_PORT || 8171),
  URL = "http://127.0.0.1:" + PORT,
  password = crypto.randomBytes(24).toString("base64url"),
  results = [],
  errors = [],
  external = [];
let server, browser, page, ctx, a, b, g, proc;
function watch(p) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(URL))
      external.push(r.url());
  });
}
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASSÉ" });
    console.log("PASSÉ " + name);
  } catch (e) {
    results.push({ name, status: "ÉCHEC", message: e.message });
    await page
      .screenshot({
        path: path.join(TMP, "echec.png"),
        fullPage: true,
        animations: "disabled",
      })
      .catch(() => {});
    throw e;
  }
}
async function nav(sec, sub) {
  await page.evaluate(
    ([sec, sub]) => {
      sec = sub ? LegacyNavigation.route(sub) || sec : sec;
      document.querySelector(`[data-act=nav][data-sec="${sec}"]`).click();
      if (sub)
        document
          .querySelector(`[data-act=nav][data-sec="${sec}"][data-sub="${sub}"]`)
          .click();
    },
    [sec, sub],
  );
}
async function auth(p, login = "admin_cartes") {
  await p.locator("#lx-auth").waitFor();
  if (await p.locator("#lx-auth [name=name]").count())
    await p.locator("#lx-auth [name=name]").fill("Administration FICTIVE");
  await p.locator("#lx-auth [name=login]").fill(login);
  await p.locator("#lx-auth [name=password]").fill(password);
  await p.locator("#lx-auth [type=submit]").click();
  await p.locator("#lx-account").waitFor();
}
async function state() {
  return page.evaluate(async () => {
    await LegacyServer.flush();
    return (await LegacyServer.request("/api/state")).state;
  });
}
async function save() {
  await page.locator("[data-mb=save]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-mb=save]")?.disabled,
  );
  await page.evaluate(() => LegacyServer.flush());
}
async function generate(view, scope) {
  await nav("carto", view === "context" ? "mb-ctx" : "mb-proc");
  await page.locator("#mbScope").selectOption(scope);
  await page.locator("[data-mb=wizard]").first().click();
  await page.locator("#mbDlg button[value=go]").click();
  await page.waitForFunction(
    () => document.querySelectorAll("#mbVp [data-n]").length > 0,
  );
  await save();
}
async function main() {
  server = spawn(
    "python3",
    [
      "demarrer.py",
      "--sans-compte-test",
      "--sans-navigateur",
      "--port",
      String(PORT),
      "--donnees",
      path.join(TMP, "data"),
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((res, rej) => {
    server.stdout.once("data", res);
    server.once("error", rej);
    server.once("exit", (c) => rej(Error("Serveur arrêté " + c)));
  });
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  ctx = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page = await ctx.newPage();
  watch(page);
  await page.goto(URL);
  await auth(page);
  await check(
    "Jeu FICTIF et liens métier préparés sans duplication",
    async () => {
      await nav("admin", "admin-demo");
      await page.locator("[data-lx-act=admin-demo]").click();
      await page.locator('#askDlg [data-ask="1"]').click();
      await page.waitForFunction(
        () => LegacyIntegrationUI.toolkit.state().riskMgmt.risks.length === 3,
      );
      await page.evaluate(() => LegacyServer.flush());
      const s = await state();
      a = s.perimeters.find((p) => p.name.startsWith("Centre Aurore"));
      b = s.perimeters.find((p) => p.name.startsWith("Centre Rivage"));
      g = s.perimeters.find((p) => p.type === "GHT");
      proc = s.processes.find((p) => p.perimeterIds?.includes(a.id));
      await page.evaluate(
        async ([a, b]) => {
          const U = LegacyIntegrationUI.toolkit;
          await U.mutate((s) => {
            const ps = s.processes.filter((p) => p.perimeterIds?.includes(a));
            ps[0].family = "Management";
            ps[1].family = "Réalisation";
            s.interested.push({
              id: "PI-CARTE-FICTIF",
              name: "Équipe soignante FICTIVE",
              type: "Interne",
              perimeterIds: [a],
            });
            s.suppliers.push({
              id: "SUP-CARTE-FICTIF",
              name: "Prestataire FICTIF",
              critical: "Oui",
              perimeterIds: [a],
            });
            s.appGaps.push({
              id: "APP-CARTE-FICTIF",
              name: "Dossier patient FICTIF",
              supplier: "Prestataire FICTIF",
              status: "Intégrée",
              perimeterIds: [a],
            });
            s.processes.push({
              id: "PB-CARTE-FICTIF",
              name: "Activité B réservée FICTIVE",
              family: "Support",
              perimeterIds: [b],
            });
          });
        },
        [a.id, b.id],
      );
    },
  );
  await check(
    "Menus : ordre logique, Pilotage allégé, liens historiques redirigés",
    async () => {
      const groups = await page.locator(".lx-nav-heading").allTextContents();
      assert.match(groups[0], /Vue d’ensemble/);
      assert.match(groups[1], /Organisation et pilotage/);
      assert.deepEqual(
        await page
          .locator("#lx-nav-body-overview > .mn")
          .evaluateAll((xs) => xs.map((x) => x.dataset.sec)),
        ["dash", "journey", "carto"],
      );
      await page.evaluate(() => {
        const a = LegacyIntegrationUI.toolkit.api();
        a.ui.navOrder = ["carto", "dash"];
        a.render();
      });
      assert.deepEqual(
        await page
          .locator("#lx-nav-body-overview > .mn")
          .evaluateAll((xs) => xs.map((x) => x.dataset.sec)),
        ["carto", "journey", "dash"],
      );
      await page.evaluate(() => {
        const a = LegacyIntegrationUI.toolkit.api();
        a.ui.navOrder = [];
        a.render();
      });
      await nav("pil", "obj");
      assert.match(await page.locator(".crumb").innerText(), /Pilotage/);
      // Une carte historique de tableau de bord conserve son lien même après déplacement.
      await page.evaluate(() => {
        const e = document.createElement("button");
        e.dataset.act = "nav";
        e.dataset.sec = "pil";
        e.dataset.sub = "act";
        document.body.append(e);
        e.click();
        e.remove();
      });
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "actions",
      );
      await nav("carto", "mb-ctx");
      assert.equal(await page.locator("#panel [data-mb=view]").count(), 2);
    },
  );
  await check(
    "Contexte SVG généré et enregistré pour un établissement",
    async () => {
      await generate("context", a.id);
      const s = await state(),
        m = s.cartography.maps.find(
          (m) => m.view === "context" && m.perimeterIds.includes(a.id),
        );
      assert.match(m.internalId, /^MAP-\d{6}$/);
      assert.ok(m.nodes["process:" + proc.id]);
      assert.ok(m.nodes["app:APP-CARTE-FICTIF"]);
      assert.ok(!m.nodes["process:PB-CARTE-FICTIF"]);
      assert.ok((await page.locator("#mbVp .mbe").count()) > 0);
      assert.doesNotMatch(
        await page.locator("#panel").innerText(),
        /Créer un SMSI|Contexte SMSI/,
      );
    },
  );
  await check(
    "Déplacement réel, annulation et rétablissement sans altération métier",
    async () => {
      const before = await state(),
        m = before.cartography.maps.find(
          (m) => m.view === "context" && m.perimeterIds.includes(a.id),
        ),
        x = m.nodes["process:" + proc.id].x;
      await page.locator("[data-mb=edit]").click();
      const n = page.locator(`#mbVp [data-n="process:${proc.id}"]`);
      await n.click();
      await page.keyboard.press("ArrowRight");
      await page.locator("[data-mb=undo]").click();
      await page.locator("[data-mb=redo]").click();
      await save();
      const after = await state();
      assert.equal(
        after.cartography.maps.find((m) => m.view === "context").nodes[
          "process:" + proc.id
        ].x,
        x + 4,
      );
      assert.deepEqual(after.processes, before.processes);
    },
  );
  await check("Version nommée, restauration et auteur serveur", async () => {
    await page.locator("[data-mb=versions]").click();
    await page.locator("#mbDlg [name=label]").fill("COPIL FICTIF");
    await page.locator("#mbDlg button[value=new]").click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-mb=save]")?.disabled &&
        !document.querySelector("#mbDlg[open]"),
    );
    const old = await state(),
      m = old.cartography.maps.find((m) => m.view === "context");
    assert.equal(m.versions[0].author, "Administration FICTIVE");
    await page.locator("[data-mb=versions]").click();
    await page.locator("#mbDlg [name=sel]").check();
    await page.locator("#mbDlg button[value=restore]").click();
    await save();
    const s = await state();
    assert.deepEqual(
      s.cartography.maps.find((m) => m.view === "context").nodes,
      m.versions[0].map.nodes,
    );
  });
  await check(
    "Renommage métier synchronisé, positions conservées, objet nouveau signalé",
    async () => {
      const old = await state(),
        node = old.cartography.maps.find((m) => m.view === "context").nodes[
          "process:" + proc.id
        ];
      await page.evaluate(async (id) => {
        await LegacyIntegrationUI.toolkit.mutate((s) => {
          s.processes.find((p) => p.id === id).name =
            "Processus renommé FICTIF";
          s.interested.push({
            id: "PI-NOUVEAU-FICTIF",
            name: "Nouveau partenaire FICTIF",
            perimeterIds: s.processes.find((p) => p.id === id).perimeterIds,
          });
        });
      }, proc.id);
      await page.locator("[data-mb=fit]").click();
      assert.match(
        await page.locator(`#mbVp [data-n="process:${proc.id}"]`).textContent(),
        /Processus renommé/,
      );
      assert.match(
        await page.locator(".mb-banner").last().innerText(),
        /nouvel objet/,
      );
      const s = await state();
      assert.equal(
        s.cartography.maps.find((m) => m.view === "context").nodes[
          "process:" + proc.id
        ].x,
        node.x,
      );
    },
  );
  await check("Exports réels SVG, JSON, PNG et PDF", async () => {
    for (const kind of ["svg", "json", "png", "pdf"]) {
      await page.locator(".mb-dd summary").click();
      const wait = page.waitForEvent("download");
      await page.locator(`[data-mb=x${kind}]`).click();
      const d = await wait,
        file = path.join(TMP, "carte." + kind);
      await d.saveAs(file);
      const bytes = fs.readFileSync(file);
      if (kind === "svg") {
        assert.match(bytes.toString(), /<svg/);
        assert.match(bytes.toString(), /Processus renommé/);
      }
      if (kind === "json")
        assert.equal(JSON.parse(bytes).type, "pilotage-map-layout");
      if (kind === "png") assert.equal(bytes.slice(1, 4).toString(), "PNG");
      if (kind === "pdf")
        assert.equal(bytes.slice(0, 8).toString(), "%PDF-1.4");
      assert.ok(bytes.length > 300);
    }
  });
  await check(
    "Processus : bandes de familles, propositions identifiées, sauvegarde indépendante",
    async () => {
      await generate("process", a.id);
      const s = await state(),
        m = s.cartography.maps.find(
          (m) => m.view === "process" && m.perimeterIds.includes(a.id),
        );
      assert.ok(m.nodes["lane:pil"]);
      assert.ok(m.nodes["lane:rea"]);
      assert.ok(m.edges.some((e) => e.gen));
      assert.equal(s.cartography.maps.length, 2);
    },
  );
  await check(
    "GHT consolidé et carte des risques partagent les registres existants",
    async () => {
      await generate("context", g.id);
      const s = await state(),
        m = s.cartography.maps.find(
          (m) => m.view === "context" && m.perimeterIds.includes(g.id),
        );
      assert.ok(m.nodes["process:PB-CARTE-FICTIF"]);
      assert.equal(s.riskMgmt.risks.length, 3);
      assert.equal(s.riskMgmt.assessments.length, 4);
      await nav("carto", "risk-map");
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "carto",
      );
      assert.equal(
        await page.locator("#panel [data-lx-act=risk-open]").count(),
        3,
      );
      await nav("carto", "dmap");
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "carto",
      );
    },
  );
  await check(
    "Lecteur et contributeur : droits serveur, carte propre, données étrangères absentes",
    async () => {
      for (const [login, permission] of [
        ["lecture_cartes", "viewer"],
        ["edition_cartes", "editor"],
      ])
        await page.evaluate(
          async (x) =>
            LegacyServer.request("/api/users", {
              method: "POST",
              body: JSON.stringify(x),
            }),
          {
            name: "Compte carte FICTIF",
            login,
            password,
            permission,
            perimeterIds: [a.id],
            roleIds: [],
            canValidate: false,
            active: true,
          },
        );
      for (const login of ["lecture_cartes", "edition_cartes"]) {
        const c = await browser.newContext({
            locale: "fr-FR",
            viewport: { width: 1440, height: 1000 },
          }),
          p = await c.newPage();
        watch(p);
        await p.goto(URL);
        await auth(p, login);
        await p.evaluate(() =>
          LegacyIntegrationUI.toolkit
            .api()
            .navigate("carto", { mbView: "context", mbScope: "__all" }),
        );
        await p.locator("#mbSvg").waitFor();
        assert.doesNotMatch(
          await p.locator("#panel").innerText(),
          /Activité B réservée/,
        );
        const s = await p.evaluate(
          async () => (await LegacyServer.request("/api/state")).state,
        );
        assert.equal(s.cartography.maps.length, 2);
        assert.equal(
          await p.locator("[data-mb=wizard]").count(),
          login === "lecture_cartes" ? 0 : 1,
        );
        const code = await p.evaluate(async () => {
          const d = await LegacyServer.request("/api/state");
          d.state.cartography.maps[0].nodes["process:PB-CARTE-FICTIF"] = {
            x: 0,
            y: 0,
            w: 200,
            h: 80,
            label: "Tentative FICTIVE",
          };
          try {
            await LegacyServer.request("/api/state", {
              method: "PUT",
              body: JSON.stringify(d),
            });
            return 200;
          } catch (e) {
            return e.status;
          }
        });
        assert.equal(code, login === "lecture_cartes" ? 403 : 422);
        await c.close();
      }
    },
  );
  await check(
    "Responsive, mode sombre, aucune dépendance réseau extérieure",
    async () => {
      await nav("carto", "mb-proc");
      await page.locator("#mbScope").selectOption(a.id);
      for (const width of [390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        await page.screenshot({
          path: path.join(TMP, "carte-" + width + ".png"),
          fullPage: true,
          animations: "disabled",
        });
        assert.ok(
          (await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          )) <= 2,
          "Débordement " + width,
        );
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    },
  );
  await check(
    "Rechargement conserve les trois dispositions et leurs versions",
    async () => {
      const before = (await state()).cartography;
      await page.reload();
      await page.locator("#lx-account").waitFor();
      assert.deepEqual((await state()).cartography, before);
    },
  );
}
main()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
    fs.writeFileSync(
      path.join(ROOT, "recette/cartographies-browser-resultats.json"),
      JSON.stringify(
        {
          executedAt: new Date().toISOString(),
          passed: results.filter((r) => r.status === "PASSÉ").length,
          failed: results.filter((r) => r.status === "ÉCHEC").length,
          pageErrors: errors,
          externalRequests: external.length,
          tests: results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Fichiers et captures FICTIFS hors Git : " + TMP);
  });
