/* Recette locale : compte demandé, accents, disposition et cartes d'origine. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawn, execFileSync } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ROOT = path.resolve(__dirname, ".."),
  TMP = fs.mkdtempSync("/tmp/legacy-interface-browser-"),
  PORT = Number(process.env.INTERFACE_PORT || 8184),
  URL = `http://127.0.0.1:${PORT}`;
const results = [],
  errors = [],
  external = [];
let server, browser, page, role;
async function launch() {
  server = spawn(
    "python3",
    [
      "demarrer.py",
      "--sans-navigateur",
      "--port",
      String(PORT),
      "--donnees",
      path.join(TMP, "data"),
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error("Serveur arrêté : " + code)));
  });
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill();
  await exited;
}
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASSÉ" });
    console.log("PASSÉ " + name);
  } catch (e) {
    results.push({ name, status: "ÉCHEC", message: e.message });
    throw e;
  }
}
async function nav(sec, sub) {
  await page.evaluate(
    ([sec, sub]) => {
      sec = sub ? LegacyNavigation.route(sub) || sec : sec;
      document.querySelector(`[data-act=nav][data-sec="${sec}"]`).click();
      if (sub === "perimeter-roles") {
        document
          .querySelector('[data-act=nav][data-sec=pil][data-grp="g-roles"]')
          .click();
        return;
      }
      if (sub)
        document
          .querySelector(`[data-act=nav][data-sec="${sec}"][data-sub="${sub}"]`)
          .click();
    },
    [sec, sub],
  );
}
const state = () =>
  page.evaluate(async () => {
    await LegacyServer.flush();
    return (await LegacyServer.request("/api/state")).state;
  });
async function alignment() {
  const cards = await page.locator(".lx-role-card").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect(),
        b = el.querySelector(".lx-card-actions .btn").getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        button: b.top,
        font: getComputedStyle(el).fontFamily,
      };
    }),
  );
  assert.ok(cards.length >= 10);
  for (const c of cards) {
    assert.match(c.font, /Sauge Inter/);
    for (const other of cards.filter((r) => Math.abs(r.top - c.top) < 1)) {
      assert.ok(
        Math.abs(c.button - other.button) < 1,
        "Boutons alignés dans chaque rangée",
      );
      assert.ok(
        Math.abs(c.bottom - other.bottom) < 1,
        "Cartes de même hauteur dans chaque rangée",
      );
    }
  }
}
async function main() {
  await launch();
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "fr-FR",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(URL))
      external.push(r.url());
  });
  await page.goto(URL);
  await check(
    "Démarrage normal : connexion admin/admin depuis le formulaire",
    async () => {
      await page.locator("#lx-auth").waitFor();
      assert.match(
        await page.locator("#lx-auth").innerText(),
        /Compte de test : admin \/ admin/,
      );
      await page.locator("#lx-auth [name=login]").fill("admin");
      await page.locator("#lx-auth [name=password]").fill("admin");
      await page.locator("#lx-auth [type=submit]").click();
      await page.locator("#lx-account").waitFor();
      assert.equal(
        await page.evaluate(() => LegacyServer.user().permission),
        "admin",
      );
      assert.equal((await page.evaluate(() => LegacyServer.users())).length, 1);
    },
  );
  await check(
    "Rôles et responsabilités dans Pilotage, accents français et boutons alignés",
    async () => {
      assert.equal(
        await page.evaluate(() => LegacyNavigation.route("perimeter-roles")),
        "pil",
      );
      await nav("pil", "perimeter-roles");
      assert.match(
        await page.locator(".lx-page-head h2").innerText(),
        /Rôles et responsabilités/,
      );
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "pil",
      );
      const text = await page.locator(".lx-role-list").innerText();
      assert.match(text, /Sécurité des systèmes d’information/);
      assert.doesNotMatch(text, /Ã©|â€™|Ã¨/);
      await alignment();
      role = (await state()).roles.find((r) => r.baseRoleKey === "direction");
      assert.ok(role);
    },
  );
  await check(
    "Texte long et affectation personnalisée conservés, dispositions uniformes",
    async () => {
      await page
        .locator(`[data-lx-act=role-edit][data-id="${role.id}"]`)
        .click();
      const dlg = page.locator("#lx-dialog");
      await dlg.locator("[name=holder]").fill("Responsable FICTIF");
      await dlg
        .locator("[name=resp]")
        .fill("Arbitrer les moyens et accepter les risques. ".repeat(8));
      await dlg.locator("[type=submit]").click();
      await dlg.waitFor({ state: "hidden" });
      const updated = (await state()).roles.find((r) => r.id === role.id);
      assert.equal(updated.internalId, role.internalId);
      assert.equal(updated.holder, "Responsable FICTIF");
      await alignment();
      await page.screenshot({
        path: path.join(TMP, "roles-1440.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Rechargement : retour au registre des rôles dans Pilotage",
    async () => {
      await page.reload();
      await page.locator("#lx-account").waitFor();
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "pil",
      );
      assert.match(
        await page.locator(".lx-page-head h2").innerText(),
        /Rôles et responsabilités/,
      );
    },
  );
  await check(
    "Cartographie V2 : première vue, lectures et ouverture des fiches d'origine",
    async () => {
      await nav("carto");
      assert.match(
        await page.locator(".map h2").innerText(),
        /Cartographie du pilotage/,
      );
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "carto",
      );
      assert.ok(
        (await page.locator(".map .tile[data-act=open]").count()) > 100,
      );
      await page.locator(".map [data-k=mapLens][data-v=dda]").click();
      assert.equal(
        await page
          .locator(".map [data-k=mapLens][data-v=dda]")
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.locator(".map .tile[data-act=open]").first().click();
      await page.locator("#drawer").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await nav("carto", "dmap");
      await page.screenshot({
        path: path.join(TMP, "carte-v2-1440.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Cartographies contexte/processus GPT6 conservées et police Sauge",
    async () => {
      await nav("carto", "mb-ctx");
      assert.ok(await page.locator("#mbSvg").count());
      assert.match(
        await page.locator("#mbSvg").getAttribute("font-family"),
        /Sauge Inter/,
      );
      await nav("carto", "mb-proc");
      assert.ok(await page.locator("#mbSvg").count());
      await nav("carto", "risk-map");
      assert.equal(
        await page.locator(".mn.on").getAttribute("data-sec"),
        "carto",
      );
    },
  );
  await check(
    "Mobile et thème sombre : cartes lisibles sans débordement",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await nav("pil", "perimeter-roles");
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await alignment();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        const tones = await page
          .locator(".lx-role-card")
          .first()
          .evaluate((el) => ({
            background: getComputedStyle(el).backgroundColor,
            color: getComputedStyle(el).color,
          }));
        assert.notEqual(tones.background, tones.color);
        await page.screenshot({
          path: path.join(TMP, `roles-390-${theme}.png`),
          fullPage: true,
        });
      }
    },
  );
  await check(
    "Redémarrage : accents CP1252 réparés, personnalisation et identités préservées",
    async () => {
      await page.evaluate(() => LegacyServer.flush());
      await stop();
      execFileSync("python3", [
        "-c",
        "import sys,json,sqlite3; db=sqlite3.connect(sys.argv[1]); r=db.execute('SELECT data FROM state WHERE id=1').fetchone(); s=json.loads(r[0]); role=next(r for r in s['roles'] if r.get('baseRoleKey')=='direction'); role['function']=role['function'].encode('utf-8').decode('cp1252'); db.execute('UPDATE state SET data=? WHERE id=1',(json.dumps(s,ensure_ascii=False),)); db.commit()",
        path.join(TMP, "data", "legacy.sqlite3"),
      ]);
      await launch();
      await page.reload();
      await page.locator("#lx-account").waitFor();
      const updated = (await state()).roles.find((r) => r.id === role.id);
      assert.equal(updated.function, "Direction de l’établissement");
      assert.equal(updated.holder, "Responsable FICTIF");
      assert.equal(updated.internalId, role.internalId);
      assert.equal((await page.evaluate(() => LegacyServer.users())).length, 1);
      assert.doesNotMatch(
        await page.locator(".lx-role-list").innerText(),
        /Ã©|â€™/,
      );
      const events = await page.evaluate(() =>
        LegacyServer.request("/api/audit"),
      );
      assert.ok(
        events.events.some(
          (e) => e.action === "Correction des accents des rôles de base",
        ),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
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
    await stop();
    fs.writeFileSync(
      path.join(ROOT, "recette/interface-browser-resultats.json"),
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
    console.log("Captures FICTIVES hors Git : " + TMP);
  });
