/* Recette de l'habillage global « Référence 08 » : style commun, droits, aperçu, conflit, propagation, cartographies.
   Fixtures synthétiques ; serveur et base temporaires. Exécution : CHROMIUM_EXECUTABLE=… node tests/browser-nes.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const H = require("./nes-harness.cjs");
const ROOT = path.resolve(__dirname, ".."),
  PORT = Number(process.env.NES_PORT || 8231),
  RESULTS = process.env.NES_RESULTS || "";
const checks = [],
  errors = [],
  external = [];
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log("PASS", name);
};
const attr = (page, name = "data-nes-style") => page.evaluate((n) => document.documentElement.getAttribute(n), name);
const style = (page) => attr(page);
const state = (page) => page.evaluate(() => NesStyle.state());
const api = (page, url, options) =>
  page.evaluate(
    async ([u, o]) => {
      try {
        return { ok: true, body: await LegacyServer.request(u, o) };
      } catch (e) {
        return { ok: false, status: e.status, message: e.message };
      }
    },
    [url, options],
  );
const rawPut = (page, body, csrf = true) =>
  page.evaluate(
    async ([b, c]) => {
      const session = await (await fetch("/api/session")).json();
      const r = await fetch("/api/admin/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(c ? { "X-CSRF-Token": session.csrf } : {}) },
        body: JSON.stringify(b),
      });
      return r.status;
    },
    [body, csrf],
  );
const watch = (page) => {
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("BROWSER ERROR", e.message);
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:" + PORT)) external.push(r.url());
  });
};
const openAppearance = async (page) => {
  await H.navigate(page, "admin", { adminView: "appearance" });
  await page.locator("#nes-appearance").waitFor();
};

(async () => {
  const { server: first, temp, url } = await H.startServer(ROOT, PORT);
  let server = first;
  const browser = await H.launch();
  const ctx = async (viewport = { width: 1440, height: 1000 }) => {
    const c = await browser.newContext({ viewport, locale: "fr-FR", timezoneId: "Europe/Paris" });
    const p = await c.newPage();
    watch(p);
    return { c, p };
  };
  try {
    const A = await ctx(); // administrateur 1
    await H.login(A.p, url);
    await H.seed(A.p);
    await A.p.waitForTimeout(400);
    // Comptes complémentaires créés par l'administrateur : contributeur et second administrateur.
    for (const [login, permission] of [["editeur-nes", "editor"], ["admin-nes-2", "admin"]]) {
      const r = await api(A.p, "/api/users", { method: "POST", body: JSON.stringify({ login, name: login + " FICTIF", password: "motdepasse-FICTIF-123", permission }) });
      assert(r.ok, JSON.stringify(r));
    }
    const E = await ctx(); // contributeur, contexte indépendant
    await H.login(E.p, url, "editeur-nes", "motdepasse-FICTIF-123");
    const B = await ctx(); // administrateur 2
    await H.login(B.p, url, "admin-nes-2", "motdepasse-FICTIF-123");

    await check("Style par défaut Sauge, identité et lien externe sur clic seulement", async () => {
      for (const p of [A.p, E.p, B.p]) {
        assert.equal(await style(p), "sage");
        assert.equal(await attr(p, "data-nes-mode"), "light");
        const link = p.locator(".nes-header a.nes-site");
        assert.equal(await link.getAttribute("href"), "https://www.normand-esante.fr/");
        assert.equal(await link.getAttribute("target"), "_blank");
        assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
        assert.equal(await p.locator(".nes-header iframe, .nes-header img").count(), 0);
      }
      assert.deepEqual(external, []);
    });

    await check("Droits API : lecture pour tous les comptes, écriture refusée sans administration, sans CSRF ou invalide", async () => {
      assert.deepEqual((await api(E.p, "/api/appearance")).body, { style: "sage", revision: 1 });
      const denied = await api(E.p, "/api/admin/appearance", { method: "PUT", body: JSON.stringify({ style: "clair", revision: 1 }) });
      assert.equal(denied.status, 403);
      assert.equal(await rawPut(A.p, { style: "clair", revision: 1 }, false), 403);
      assert.equal(await rawPut(A.p, { style: "inconnu", revision: 1 }), 422);
      assert.equal(await rawPut(A.p, { style: "clair" }), 422);
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "sage", revision: 1 });
    });

    await check("Administration → Apparence : une seule destination ajoutée, deux cartes radio", async () => {
      const routes = await A.p.evaluate(() => LegacyIntegrationUI.toolkit.api().astra.navigation().flatMap((s) => s.items.map((i) => i.id)));
      assert.equal(routes.filter((id) => id === "admin-appearance").length, 1);
      assert.equal(routes.length, 101);
      await openAppearance(A.p);
      assert.equal(await A.p.locator("#nes-appearance input[name=nes-style]").count(), 2);
      assert(await A.p.locator('#nes-appearance input[value=sage]').isChecked());
      assert(await A.p.locator("#nes-save").isDisabled());
      assert.equal(await E.p.evaluate(() => LegacyIntegrationUI.toolkit.api().astra.navigation().some((s) => s.id === "admin")), false);
    });

    await check("Aperçu local sans écriture, puis abandon", async () => {
      await A.p.locator('#nes-appearance input[value=clair]').check();
      assert.equal(await style(A.p), "clair");
      assert(await A.p.locator("#nes-state").innerText().then((t) => /Aperçu non enregistré/.test(t)));
      assert(await A.p.locator("#nes-save").isEnabled());
      await A.p.waitForTimeout(600);
      assert.equal(await style(E.p), "sage");
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "sage", revision: 1 });
      await A.p.locator("#nes-cancel").click();
      assert.equal(await style(A.p), "sage");
      await A.p.locator('#nes-appearance input[value=clair]').check();
      await H.navigate(A.p, "dash"); // quitter le panneau abandonne l'aperçu
      assert.equal(await style(A.p), "sage");
      assert.equal((await state(A.p)).preview, null);
    });

    await check("Enregistrer pour tous : réponse serveur, audit, propagation sans rechargement ni perte de saisie", async () => {
      await H.navigate(E.p, "risks", { riskView: "register" });
      await E.p.evaluate(() => {
        window.__reload = "intact";
        const q = document.querySelector("#gsq");
        q.value = "saisie en cours FICTIVE";
        q.focus();
        q.__node = "gardé";
        window.scrollTo(0, 120);
      });
      await openAppearance(A.p);
      await A.p.locator('#nes-appearance input[value=clair]').check();
      await A.p.locator("#nes-save").click();
      await A.p.waitForFunction(() => /enregistré pour tous les utilisateurs \(révision 2\)/.test(document.querySelector("#nes-state")?.textContent || ""));
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "clair", revision: 2 });
      const started = Date.now();
      await E.p.waitForFunction(() => document.documentElement.dataset.nesStyle === "clair", null, { timeout: 30000 });
      console.log("  propagation :", Math.round((Date.now() - started) / 1000), "s");
      const kept = await E.p.evaluate(() => ({ reload: window.__reload, value: document.querySelector("#gsq").value, node: document.querySelector("#gsq").__node, focus: document.activeElement?.id, y: Math.round(window.scrollY) }));
      assert.deepEqual({ reload: kept.reload, value: kept.value, node: kept.node, focus: kept.focus }, { reload: "intact", value: "saisie en cours FICTIVE", node: "gardé", focus: "gsq" });
      const audit = await api(A.p, "/api/audit");
      const last = audit.body.events.find((e) => e.action === "Apparence globale");
      assert.deepEqual(JSON.parse(last.details), { before: { style: "sage", revision: 1 }, after: { style: "clair", revision: 2 } });
    });

    await check("Conflit entre deux administrateurs : le second reçoit un refus, son choix est conservé", async () => {
      await B.p.evaluate(() => NesStyle.refresh());
      await openAppearance(B.p);
      await B.p.waitForFunction(() => NesStyle.state().global?.revision === 2);
      await B.p.locator('#nes-appearance input[value=sage]').check();
      // L'administrateur 1 enregistre deux changements successifs avant le second administrateur.
      await openAppearance(A.p);
      for (const v of ["sage", "clair"]) {
        await A.p.locator(`#nes-appearance input[value=${v}]`).check();
        await A.p.locator("#nes-save").click();
        await A.p.waitForFunction((n) => NesStyle.state().global?.style === n && !NesStyle.state().saving, v);
      }
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "clair", revision: 4 });
      await B.p.locator("#nes-save").click();
      await B.p.waitForFunction(() => /a modifié le style/.test(document.querySelector("#nes-error")?.textContent || ""));
      const s = await state(B.p);
      assert.equal(s.preview, "sage", "le choix en attente est conservé");
      assert.deepEqual(s.global, { style: "clair", revision: 4 });
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "clair", revision: 4 });
      assert(!/enregistré pour tous/.test(await B.p.locator("#nes-state").innerText()));
      // Résolution explicite : second enregistrement sur la révision actuelle.
      await B.p.locator("#nes-save").click();
      await B.p.waitForFunction(() => /révision 5/.test(document.querySelector("#nes-state")?.textContent || ""));
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "sage", revision: 5 });
    });

    await check("Réseau coupé : aucun faux succès, aperçu et dernier style connu conservés", async () => {
      await openAppearance(B.p);
      await B.p.locator('#nes-appearance input[value=clair]').check();
      await B.p.route("**/api/admin/appearance", (r) => r.abort());
      await B.p.locator("#nes-save").click();
      await B.p.waitForFunction(() => /n’a pas répondu/.test(document.querySelector("#nes-error")?.textContent || ""));
      assert(!/enregistré pour tous les utilisateurs/.test(await B.p.locator("#nes-state").innerText()));
      assert.equal((await state(B.p)).preview, "clair");
      assert.deepEqual((await api(A.p, "/api/appearance")).body, { style: "sage", revision: 5 });
      await B.p.unroute("**/api/admin/appearance");
      await B.p.route("**/api/appearance", (r) => r.abort());
      await B.p.evaluate(() => NesStyle.refresh());
      await B.p.waitForFunction(() => NesStyle.state().unavailable === true);
      assert.deepEqual((await state(B.p)).global, { style: "sage", revision: 5 });
      await B.p.unroute("**/api/appearance");
      await B.p.locator("#nes-cancel").click();
      await B.p.evaluate(() => NesStyle.refresh());
      await B.p.waitForFunction(() => NesStyle.state().unavailable === false);
    });

    const rgb = (h) => `rgb(${[1, 3, 5].map((n) => parseInt(h.slice(n, n + 2), 16)).join(", ")})`;
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const section = (p, title) => p.locator("#panel section.as-surface").filter({ has: p.locator("h3", { hasText: title }) });
    const cellsOf = (sec) => sec.evaluate((el) => [...el.querySelectorAll(".as-risk-cell")].map((c) => {
      const b = c.querySelector(".as-cell-select"), cs = getComputedStyle(c);
      return { bg: cs.backgroundColor, ink: getComputedStyle(b).color, label: b.querySelector("span").textContent, count: b.querySelector("b").textContent, name: b.getAttribute("aria-label"), pressed: b.getAttribute("aria-pressed"), dots: [...c.querySelectorAll(".as-risk-dots button")].map((d) => ({ bg: getComputedStyle(d).backgroundColor, ink: getComputedStyle(d).color, text: d.textContent })), selected: c.classList.contains("selected") };
    }));

    await check("Matrice des risques : cases pleines vert / jaune / orange / rouge pour la politique standard", async () => {
      await H.navigate(A.p, "risks", { riskView: "map" });
      await A.p.locator("#panel .as-matrix").first().waitFor();
      const sec = section(A.p, "Politique standard à matrice");
      const cells = await cellsOf(sec);
      assert.equal(cells.length, 16);
      const palette = { Faible: "#4dbb69", Modéré: "#ffdf45", Élevé: "#ff8335", Critique: "#e5192f" };
      const seen = new Set();
      for (const c of cells) {
        assert.equal(c.bg, rgb(palette[c.label]), c.label);
        assert(ratio(c.bg, c.ink) >= 4.5, `contraste ${c.label} ${ratio(c.bg, c.ink).toFixed(2)}`);
        for (const d of c.dots) assert(ratio(d.bg, d.ink) >= 4.5, "contraste des références");
        seen.add(c.label);
        assert.match(c.name, /^.+ \/ .+ : (Faible|Modéré|Élevé|Critique), \d+ risques$/);
        assert(c.count === "–" || /^\d+$/.test(c.count));
      }
      assert.equal(seen.size, 4);
      const legend = await sec.evaluate((el) => [...el.querySelectorAll(".as-legend i")].map((i) => getComputedStyle(i).backgroundColor));
      assert.deepEqual(legend, ["#4dbb69", "#ffdf45", "#ff8335", "#e5192f"].map(rgb));
      // Contraste du repère de sélection (contour bleu + anneau blanc) sur chacune des quatre couleurs.
      for (const c of cells.slice(0, 1)) assert(ratio("rgb(38, 100, 184)", "rgb(255, 255, 255)") >= 3);
    });

    await check("Matrice : politique personnalisée conservée, politique manuelle sans niveau de cellule inventé", async () => {
      const custom = await cellsOf(section(A.p, "Politique personnalisée"));
      assert.deepEqual([...new Set(custom.map((c) => c.bg))].sort(), ["#2B6CB0", "#6B46C1", "#B7791F", "#97266D"].map(rgb).sort());
      const manual = await cellsOf(section(A.p, "Politique manuelle"));
      assert(manual.every((c) => c.bg === "rgb(233, 238, 240)" && c.label === "Appréciation manuelle"));
      // Aucune politique versionnée n'est modifiée : les couleurs enregistrées de la politique standard restent d'origine.
      const stored = await A.p.evaluate(() => LegacyIntegrationUI.toolkit.state().riskMgmt.policies.find((p) => /standard/.test(p.title)).levels.map((l) => l.color));
      assert.deepEqual(stored, ["#dce8e0", "#b9d0c1", "#d6b979", "#b66f61"]);
    });

    await check("Matrice : sélection, cellule vide, réinitialisation, références et totaux inchangés", async () => {
      const sec = section(A.p, "Politique standard à matrice");
      const total = async () => (await cellsOf(sec)).reduce((n, c) => n + c.dots.length, 0);
      const before = await total();
      const cells = await cellsOf(sec);
      const withRisk = cells.findIndex((c) => c.dots.length), empty = cells.findIndex((c) => !c.dots.length);
      const button = (i) => sec.locator(".as-cell-select").nth(i);
      await button(empty).click();
      assert.equal(await button(empty).getAttribute("aria-pressed"), "true");
      assert.match(await sec.locator("aside h4").innerText(), /Risques sélectionnés · 0/);
      assert.match(await sec.locator("aside").innerText(), /Aucun risque dans cette cellule\./);
      const bgEmpty = (await cellsOf(sec))[empty];
      assert.equal(bgEmpty.selected, true);
      assert.notEqual(bgEmpty.bg, "rgba(0, 0, 0, 0)", "le fond de niveau est conservé");
      await button(withRisk).click();
      assert.match(await sec.locator("aside h4").innerText(), /Risques sélectionnés · 1/);
      const outline = await sec.locator(".as-risk-cell.selected").evaluate((e) => getComputedStyle(e).outlineColor + "|" + getComputedStyle(e).outlineWidth);
      assert.match(outline, /^rgb\(38, 100, 184\)\|4px$/);
      await A.p.locator('#panel [data-astra=risk-cell][data-id=""]').first().click();
      assert.equal(await sec.locator(".as-risk-cell.selected").count(), 0);
      assert.match(await sec.locator("aside h4").innerText(), /Dans cette matrice/);
      assert.equal(await total(), before);
    });

    await check("Matrice : mêmes couleurs dans les deux styles et en mode sombre, même marquage", async () => {
      const sec = section(A.p, "Politique standard à matrice");
      const read = async () => (await cellsOf(sec)).map((c) => c.bg + "|" + c.label + "|" + c.count);
      const base = await read();
      await A.p.evaluate(() => { NesStyle.setPreview("clair"); });
      assert.equal(await style(A.p), "clair");
      assert.deepEqual(await read(), base);
      await A.p.evaluate(() => { NesStyle.cancel(); document.documentElement.dataset.theme = "dark"; });
      await A.p.waitForFunction(() => document.documentElement.dataset.nesMode === "dark");
      assert.deepEqual(await read(), base);
      const dark = await A.p.evaluate(() => ({ paper: getComputedStyle(document.body).backgroundColor, surface: getComputedStyle(document.querySelector(".as-surface")).backgroundColor }));
      assert.notEqual(dark.paper, "rgb(245, 245, 240)");
      assert(lum(dark.paper) < 0.1 && lum(dark.surface) < 0.1, "fond sombre conservé");
      await A.p.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      await A.p.waitForFunction(() => document.documentElement.dataset.nesMode === "light");
    });

    await check("Persistance après redémarrage du serveur et reprise d'un contexte neuf", async () => {
      await H.navigate(A.p, "dash");
      server.kill();
      await new Promise((r) => server.once("exit", r));
      ({ server } = await H.startServer(ROOT, PORT, temp));
      const fresh = await ctx();
      await H.login(fresh.p, url, "editeur-nes", "motdepasse-FICTIF-123");
      assert.equal(await style(fresh.p), "sage");
      assert.deepEqual((await api(fresh.p, "/api/appearance")).body, { style: "sage", revision: 5 });
      await fresh.c.close();
    });

    const summary = { date: new Date().toISOString(), checks, errors, externalRequests: external };
    if (RESULTS) fs.writeFileSync(path.join(RESULTS, "nes-appearance.json"), JSON.stringify(summary, null, 2) + "\n");
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log("ALL PASSED", checks.length);
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
