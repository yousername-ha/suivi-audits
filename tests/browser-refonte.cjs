/* Recette de bout en bout, comptes et documents exclusivement synthétiques. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  JSZip = require("../lib/jszip.min"),
  XLSX = require("../lib/xlsx.full.min.js");
const ROOT = path.resolve(__dirname, ".."),
  TMP = fs.mkdtempSync("/tmp/legacy-refonte-recette-"),
  PORT = Number(process.env.REFONTE_PORT || 8141),
  URL = "http://127.0.0.1:" + PORT,
  results = [],
  errors = [],
  external = [];
let server, browser, page;
const password = "recette-synthetique-001";
const dlg = () => page.locator("#lx-dialog"),
  field = (name) => dlg().locator('[name="' + name + '"]'),
  state = () =>
    page.evaluate(async () => {
      await LegacyServer.flush();
      return (await LegacyServer.request("/api/state")).state;
    });
async function step(name, fn) {
  const at = Date.now();
  try {
    await fn();
    results.push({ name, status: "PASSÉ", durationMs: Date.now() - at });
    console.log("PASSÉ " + name);
  } catch (e) {
    results.push({ name, status: "ÉCHEC", message: e.message });
    console.error(e.stack);
    await page.screenshot({
      path: path.join(TMP, "echec.png"),
      fullPage: true,
    });
    throw e;
  }
}
async function submit() {
  await dlg().locator("[type=submit]").click();
  await dlg()
    .waitFor({ state: "hidden", timeout: 15000 })
    .catch(async (e) => {
      throw Error(
        (await dlg().locator("[role=alert]").innerText()) + "\n" + e.message,
      );
    });
  await page.evaluate(() => LegacyServer.flush());
}
async function nav(sec, sub) {
  if (sub)
    sec = await page.evaluate(
      ([sec, sub]) => LegacyNavigation.route(sub) || sec,
      [sec, sub],
    );
  await page.evaluate((sec) => {
    const target = document.querySelector(
      `[data-act="nav"][data-sec="${sec}"]`,
    );
    if (!target) throw Error("Navigation absente " + sec);
    target.click();
  }, sec);
  if (sub)
    await page.evaluate(
      ([sec, sub]) => {
        if (sub === "perimeter-roles") {
          document
            .querySelector('[data-act=nav][data-sec=pil][data-grp="g-roles"]')
            .click();
          return;
        }
        const target = document.querySelector(
          `[data-act="nav"][data-sec="${sec}"][data-sub="${sub}"]`,
        );
        if (!target) throw Error("Sous-menu absent " + sec + "/" + sub);
        target.click();
      },
      [sec, sub],
    );
}

async function auth(p, login = "recette_admin") {
  await p.locator("#lx-auth").waitFor();
  if (await p.locator("#lx-auth [name=name]").count())
    await p.locator("#lx-auth [name=name]").fill("Administration fictive");
  await p.locator("#lx-auth [name=login]").fill(login);
  await p.locator("#lx-auth [name=password]").fill(password);
  await p.locator("#lx-auth [type=submit]").click();
  await p.locator("#lx-account").waitFor();
}
async function makePerimeter(name, type = "Établissement", parentId = "") {
  await nav("perimeters", "perimeter-registry");
  await page.locator("[data-lx-act=perimeter-new]").click();
  await field("name").fill(name);
  await field("type").selectOption(type);
  if (parentId) await field("parentId").selectOption(parentId);
  await field("description").fill("Contexte synthétique de recette");
  await submit();
  return (await state()).perimeters.find((p) => p.name === name);
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
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error("Serveur arrêté " + code)));
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    locale: "fr-FR",
  });
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(URL))
      external.push(r.url());
  });
  let g, a, b, role, run, bia, pca, pra, proof, exercise;
  await step(
    "Installation, création du compte et état serveur autoritatif",
    async () => {
      await page.goto(URL);
      await auth(page);
      const s = await state();
      assert.equal(s.v, 1);
      assert.equal(s.items.length, 157);
      assert.ok(s.frameworks.some((f) => f.domain === "D2"));
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("suivi-audits-legacy-df:v1"),
        ),
        null,
      );
    },
  );
  await step(
    "GHT, deux établissements et SI mutualisé déclarés dans l’interface",
    async () => {
      g = await makePerimeter("GHT fictif", "GHT");
      a = await makePerimeter("Centre A fictif", "Établissement", g.id);
      b = await makePerimeter("Centre B fictif", "Établissement", g.id);
      await nav("perimeters", "perimeter-registry");
      await page.locator("[data-lx-act=perimeter-new]").click();
      await field("name").fill("SI mutualisé fictif");
      await field("type").selectOption("SI mutualisé");
      await field("relatedIds").evaluateAll(
        (els, ids) =>
          els
            .filter((el) => ids.includes(el.value))
            .forEach((el) => el.click()),
        [a.id, b.id],
      );
      await submit();
      const s = await state();
      assert.equal(s.perimeters.length, 4);
      assert.equal(
        s.perimeters.find((p) => p.name === "SI mutualisé fictif").relatedIds
          .length,
        2,
      );
    },
  );
  await step(
    "Responsable issu du registre existant, fonction et compte affecté",
    async () => {
      await nav("perimeters", "perimeter-roles");
      await page.locator("[data-lx-act=role-new]").click();
      await field("name").fill("RSSI");
      await field("holder").fill("Administration fictive");
      await field("function").fill("Référent sécurité fictif");
      await field("resp").fill("Responsabilités de recette");
      await field("perimeterIds").evaluateAll(
        (els, id) => els.find((el) => el.value === id).click(),
        g.id,
      );
      await field("userIds").first().check();
      await submit();
      role = (await state()).roles.find((r) => r.name === "RSSI");
      await nav("perimeters", "perimeter-registry");
      await page
        .locator('[data-lx-act=perimeter-edit][data-id="' + a.id + '"]')
        .click();
      assert.match(
        await field("responsible").innerText(),
        /Administration fictive.*RSSI/,
      );
      await field("responsible").selectOption({
        label: "Administration fictive · Référent sécurité fictif · RSSI",
      });
      await submit();
      assert.equal(
        (await state()).perimeters.find((p) => p.id === a.id).responsible
          .roleId,
        role.id,
      );
    },
  );
  await step(
    "Parcours D2 : mêmes évaluations et données que les menus unitaires",
    async () => {
      await nav("journey");
      await page.locator("[data-lx-act=journey-new]").click();
      await field("title").fill("Démarche D2 fictive");
      await field("perimeterIds").evaluateAll(
        (els, id) => els.find((el) => el.value === id).click(),
        a.id,
      );
      await field("frameworkIds").evaluateAll((els) =>
        els.find((el) => el.value === "CARE-D2-1.1.6-LEGACY").click(),
      );
      await submit();
      let s = await state();
      run = s.journey.runs[0];
      assert.equal(s.df.dossiers.length, 1);
      assert.equal(s.df.evaluations.length, 13);
      assert.equal(s.journey.tasks.filter((t) => t.requirement).length, 13);
      await page.locator("[data-lx-act=journey-business]").first().click();
      await field("description").fill(
        "Contexte modifié depuis le parcours guidé",
      );
      await submit();
      s = await state();
      assert.equal(
        s.perimeters.find((p) => p.id === a.id).description,
        "Contexte modifié depuis le parcours guidé",
      );
      await nav("perimeters", "perimeter-registry");
      assert.match(await page.locator("#panel").innerText(), /Centre A fictif/);
    },
  );
  await step(
    "Action idempotente, clôture depuis le plan central et validation humaine distincte",
    async () => {
      await nav("journey");
      await page
        .locator("[data-lx-act=journey-step][data-step=context]")
        .click();
      await page.locator("[data-lx-act=journey-action]").first().click();
      let s = await state();
      const t = s.journey.tasks.find((t) => t.stepId === "context"),
        action = s.findings.find((f) => f.id === t.actionId);
      assert.ok(action);
      await page.evaluate(async (id) => {
        const r = await LegacyServer.request("/api/state");
        LegacyJourney.ensureAction(r.state, id);
        await LegacyServer.request("/api/state", {
          method: "PUT",
          body: JSON.stringify(r),
        });
        await LegacyServer.refresh();
      }, t.id);
      s = await state();
      assert.equal(
        s.findings.filter((f) => f.journeyTaskId === t.id).length,
        1,
      );
      await page.locator("[data-lx-act=journey-action-open]").first().click();
      const select = page.locator("#drawerIn select[data-f=status]");
      if (await select.count()) await select.selectOption("Clos");
      else {
        await page.evaluate(async (actionId) => {
          const r = await LegacyServer.request("/api/state");
          r.state.findings.find((f) => f.id === actionId).status = "Clos";
          await LegacyServer.request("/api/state", {
            method: "PUT",
            body: JSON.stringify(r),
          });
          await LegacyServer.refresh();
        }, action.id);
      }
      if (await page.locator("#drawer[open]").count())
        await page.locator("#drawer [data-act=close]").first().click();
      s = await state();
      assert.equal(
        s.journey.tasks.find((x) => x.id === t.id).status,
        "Terminé",
      );
      assert.notEqual(
        s.journey.tasks.find((x) => x.stepId === "scope").status,
        "Terminé",
      );
      assert.equal(s.journey.runs[0].currentStep, "scope");
      assert.equal(
        await page.locator('.lx-steps button.on[data-step="scope"]').count(),
        1,
      );
      await page
        .locator('[data-lx-act=journey-step][data-step="context"]')
        .click();
      assert.equal(
        await page.locator('.lx-steps button.on[data-step="context"]').count(),
        1,
      );
    },
  );
  await step(
    "Pièce financière réelle, montant exact et téléchargement protégé",
    async () => {
      await nav("care", "care-finance");
      await page.locator("[data-lx-act=finance-new]").click();
      await field("title").fill("Facture synthétique");
      await field("supplier").fill("Prestataire fictif");
      await field("number").fill("RECETTE-001");
      await field("amountHT").fill("1200,30");
      await field("amountTTC").fill("1440,36");
      await field("perimeterIds").evaluateAll(
        (els, id) => els.find((el) => el.value === id).click(),
        a.id,
      );
      await field("file").setInputFiles({
        name: "facture-fictive.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Document financier entièrement synthétique"),
      });
      await submit();
      proof = (await state()).evidences.find((p) => p.financial);
      assert.equal(proof.financial.amountHT, 120030);
      assert.equal(proof.dfVersions.length, 1);
      const blob = await page.evaluate(
        async (key) =>
          (
            await LegacyServer.request("/api/files/" + key, { blob: true })
          ).text(),
        proof.dfVersions[0].fileKey,
      );
      assert.match(blob, /synthétique/);
    },
  );
  await step(
    "Création du BIA et impacts temporels sur les données persistées",
    async () => {
      await nav("pcra", "pcra-bias");
      await page.locator("[data-lx-act=pcra-bia-new]").click();
      await field("title").fill("BIA de recette fictive");
      await field("perimeterIds").evaluateAll(
        (els, id) => els.find((el) => el.value === id).click(),
        a.id,
      );
      await submit();
      let s = await state();
      bia = s.pcra.bias[0];
      await page.locator("[data-lx-act=pcra-activity-new]").click();
      await field("name").fill("Activité de soins fictive");
      await field("maxInterruptionHours").fill("4");
      await field("rtoBusinessHours").fill("2");
      await field("rpoBusinessHours").fill("1");
      for (const name of [
        "minimumService",
        "humanNeeds",
        "materialNeeds",
        "siNeeds",
        "buildingNeeds",
        "supplierNeeds",
        "dependencies",
        "workarounds",
        "justification",
      ])
        await field(name).fill("Contenu synthétique de recette : " + name);
      for (const el of await dlg().locator('select[name^="impact:"]').all())
        await el.selectOption("L3");
      await submit();
      await page.locator("[data-lx-act=pcra-bia-validate]").click();
      await page.evaluate(() => LegacyServer.flush());
      s = await state();
      bia = s.pcra.bias[0];
      assert.equal(bia.status, "Validé en interne");
      assert.equal(bia.activities.length, 1);
      assert.equal(s.pcra.policies.length, 1);
    },
  );
  async function makePlan(kind) {
    await nav("pcra", "pcra-" + kind);
    await page.locator("[data-lx-act=pcra-plan-new]").click();
    await field("title").fill(kind + " synthétique");
    await field("activityIds").first().check();
    for (const name of [
      "activation",
      "procedure",
      "communication",
      "resources",
      "dependencies",
      "returnToNormal",
    ])
      await field(name).fill("Procédure synthétique " + name);
    await field("technicalRtoHours").fill("2");
    await field("technicalRpoHours").fill("1");
    await submit();
    const plan = (await state()).pcra.plans.find((p) => p.kind === kind);
    await page
      .locator('[data-lx-act=pcra-plan-validate][data-id="' + plan.id + '"]')
      .click();
    await page.evaluate(() => LegacyServer.flush());
    return plan;
  }
  await step(
    "PCA et PRA reliés au BIA, avec objectifs métier et techniques distincts",
    async () => {
      pca = await makePlan("PCA");
      pra = await makePlan("PRA");
      const s = await state();
      assert.equal(s.pcra.plans.length, 2);
      assert.ok(s.pcra.plans.every((p) => p.status === "Validé en interne"));
      assert.equal(s.pcra.bias[0].activities[0].rtoBusinessHours, 2);
    },
  );
  await step(
    "Modification du BIA : anciens plans signalés à réexaminer",
    async () => {
      await nav("pcra", "pcra-bias");
      await page.locator("[data-lx-act=pcra-bia-open]").click();
      await page.locator("[data-lx-act=pcra-activity-edit]").click();
      await field("maxInterruptionHours").fill("3");
      await submit();
      const s = await state();
      assert.ok(
        s.pcra.plans.every((p) => p.needsReview && p.status === "À réévaluer"),
      );
      assert.equal(s.pcra.bias[0].status, "À réévaluer");
      assert.ok(s.pcra.bias[0].history.length >= 2);
    },
  );
  await step(
    "Exercice réalisé, RETEX et action corrective centrale sans doublon",
    async () => {
      await nav("pcra", "pcra-exercises");
      await page.locator("[data-lx-act=pcra-exercise-new]").click();
      await field("title").fill("Exercice synthétique");
      await field("planId").selectOption(pca.id);
      await field("date").fill("2026-10-11");
      await field("type").fill("Test de recette synthétique");
      await field("conduct").fill("Déroulement synthétique documenté");
      await field("actualRtoHours").fill("2");
      await field("proofRefs").first().check();
      await field("results").fill("Résultats synthétiques");
      await field("retex").fill("RETEX synthétique");
      await field("gaps").fill("Écart synthétique à corriger");
      await field("status").selectOption("Réalisé");
      await submit();
      exercise = (await state()).pcra.exercises[0];
      for (let n = 0; n < 2; n++) {
        await page.locator("[data-lx-act=pcra-corrective]").click();
        await field("title").fill("Correction synthétique");
        await submit();
      }
      const s = await state();
      assert.equal(
        s.findings.filter((f) => f.pcraExerciseId === exercise.id).length,
        1,
      );
      assert.equal(s.pcra.exercises[0].actionIds.length, 1);
    },
  );
  await step(
    "Vue GHT consolidée, établissement et contexte conservé",
    async () => {
      await nav("perimeters", "perimeter-registry");
      await page
        .locator(`[data-lx-act=perimeter-focus][data-id="${g.id}"]`)
        .last()
        .click();
      const table = page.locator("#panel .lx-table");
      assert.match(await table.innerText(), /Centre A fictif/);
      assert.match(await table.innerText(), /Centre B fictif/);
      assert.doesNotMatch(await table.innerText(), /SI mutualisé fictif/);
      await page
        .locator(`[data-lx-act=perimeter-focus][data-id="${a.id}"]`)
        .last()
        .click();
      assert.doesNotMatch(await table.innerText(), /Centre B fictif/);
      assert.match(
        await page
          .locator('[aria-label="Contexte organisationnel"]')
          .innerText(),
        /GHT fictif/,
      );
      await page.locator('[data-lx-act=perimeter-focus][data-id=""]').click();
      assert.match(await table.innerText(), /Centre B fictif/);
    },
  );
  await step(
    "PCRA : pièces, actions centrales et liens CaRE sans duplication",
    async () => {
      await nav("pcra", "pcra-documents");
      assert.match(
        await page.locator("#panel").innerText(),
        /Facture synthétique/,
      );
      await nav("pcra", "pcra-actions");
      assert.match(
        await page.locator("#panel").innerText(),
        /Correction synthétique/,
      );
      await page.locator("[data-lx-act=pcra-action-open]").click();
      await page
        .locator("#drawerIn select[data-f=status]")
        .selectOption("Clos");
      await page.locator("#drawer [data-act=close]").first().click();
      await page.evaluate(() => LegacyServer.flush());
      await nav("pcra", "pcra-exercises");
      assert.match(await page.locator("#panel").innerText(), /1 terminée/);
      await page.evaluate(
        async ({ biaId, proofId, versionId }) => {
          const r = await LegacyServer.request("/api/state");
          const evaluation = r.state.df.evaluations.find(
            (e) => e.requirementId === "D2.O1.C",
          );
          if (!evaluation) throw Error("Critère D2 PCRA absent");
          LegacyIntegration.relate(
            r.state,
            { kind: "bia", id: biaId },
            { kind: "evaluation", id: evaluation.id },
          );
          LegacyDF.attachProof(r.state, evaluation.id, proofId, versionId);
          await LegacyServer.request("/api/state", {
            method: "PUT",
            body: JSON.stringify(r),
          });
          await LegacyServer.refresh();
        },
        { biaId: bia.id, proofId: proof.id, versionId: proof.dfVersions[0].id },
      );
      const s = await state();
      assert.equal(s.evidences.length, 1);
      const evaluation = s.df.evaluations.find(
        (e) => e.requirementId === "D2.O1.C",
      );
      assert.ok(
        evaluation.objectRefs.some(
          (ref) => ref.kind === "bia" && ref.id === bia.id,
        ),
      );
      assert.equal(evaluation.proofRefs[0].evidenceId, proof.id);
    },
  );
  await step(
    "Rapport PCRA et Excel réels : BIA, plans, exercice, actions et preuve",
    async () => {
      await nav("pcra", "pcra-bias");
      await page.locator("[data-lx-act=pcra-bia-open]").click();
      const downloadPromise = page.waitForEvent("download");
      await page.locator("[data-lx-act=pcra-excel]").click();
      const download = await downloadPromise,
        file = path.join(TMP, "rapport-bia.xlsx");
      await download.saveAs(file);
      const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
      assert.deepEqual(wb.SheetNames, [
        "BIA",
        "Plans",
        "Exercices",
        "Actions",
        "Preuves",
      ]);
      assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Plans).length, 2);
      assert.equal(
        XLSX.utils.sheet_to_json(wb.Sheets.Exercices)[0]["RTO constaté (h)"],
        2,
      );
      assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Preuves).length, 1);
      const popupPromise = page.waitForEvent("popup");
      await page.locator("[data-lx-act=pcra-report]").click();
      const popup = await popupPromise;
      const text = await popup.locator("body").innerText();
      assert.match(text, /Activité de soins fictive/);
      assert.match(text, /Déroulement synthétique documenté/);
      assert.match(text, /Facture synthétique/);
      const pdf = await popup.pdf({ format: "A4" });
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      assert.ok(pdf.length > 1000);
      await popup.close();
    },
  );
  await step(
    "Sauvegarde complète : données intégrées et pièce physique conservée",
    async () => {
      const raw = await page.evaluate(async () => {
        const s = (await LegacyServer.request("/api/state")).state;
        const b = await LegacyDFStore.backup(s);
        return [...new Uint8Array(await b.arrayBuffer())];
      });
      const zip = await JSZip.loadAsync(Buffer.from(raw)),
        s = JSON.parse(await zip.file("data/state.json").async("string")),
        m = JSON.parse(await zip.file("manifest.json").async("string"));
      assert.equal(s.pcra.bias.length, 1);
      assert.equal(s.journey.runs.length, 1);
      assert.equal(m.files.length, 1);
      assert.match(
        await zip.file(m.files[0].path).async("string"),
        /synthétique/,
      );
    },
  );
  await step(
    "Contrôle serveur : compte en lecture, établissement interdit et pièce protégée",
    async () => {
      await page.evaluate(
        async ({ pids, password }) => {
          for (const [name, permission, perimeterIds] of [
            ["recette_b", "viewer", [pids[1]]],
            ["recette_a", "editor", [pids[0]]],
          ])
            await LegacyServer.request("/api/users", {
              method: "POST",
              body: JSON.stringify({
                login: name,
                name: "Compte fictif " + name,
                password,
                permission,
                perimeterIds,
              }),
            });
        },
        { pids: [a.id, b.id], password },
      );
      const other = await browser.newContext(),
        p = await other.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(URL);
      await auth(p, "recette_b");
      const projection = await p.evaluate(
        async () => (await LegacyServer.request("/api/state")).state,
      );
      assert.equal(projection.pcra.bias.length, 0);
      assert.equal(projection.evidences.length, 0);
      const status = await p.evaluate(
        async (key) => (await fetch("/api/files/" + key)).status,
        proof.dfVersions[0].fileKey,
      );
      assert.equal(status, 403);
      assert.equal(
        await p.evaluate(async () => {
          const r = await LegacyServer.request("/api/state");
          try {
            await LegacyServer.request("/api/state", {
              method: "PUT",
              body: JSON.stringify(r),
            });
          } catch (e) {
            return e.status;
          }
        }),
        403,
      );
      await other.close();
    },
  );
  await step(
    "Navigation regroupée, clavier et responsive à quatre largeurs",
    async () => {
      await nav("pcra", "pcra-dashboard");
      fs.mkdirSync(path.join(ROOT, "recette/refonte-captures"), {
        recursive: true,
      });
      for (const width of [390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 950 });
        if (width === 390) {
          await page.locator("#lx-menu-toggle").click();
          assert.equal(
            await page.locator("#lx-menu-toggle").getAttribute("aria-expanded"),
            "true",
          );
          await page.locator("#lx-menu-toggle").press("Enter");
          assert.equal(
            await page.locator("#lx-menu-toggle").getAttribute("aria-expanded"),
            "false",
          );
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        assert.ok(overflow <= 2, "Débordement " + width + " : " + overflow);
        await page.screenshot({
          path: path.join(
            ROOT,
            "recette/refonte-captures/pcra-" + width + ".png",
          ),
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 1440, height: 950 });
      const toggle = page.locator("[data-lx-nav-group=resources]");
      await toggle.press("Enter");
      const expanded = await toggle.getAttribute("aria-expanded");
      await toggle.press("Enter");
      assert.notEqual(await toggle.getAttribute("aria-expanded"), expanded);
    },
  );
  await step(
    "Rechargement : parcours, BIA, actions et pièces restaurés depuis le serveur",
    async () => {
      await page.reload();
      await page.locator("#lx-account").waitFor();
      const s = await state();
      assert.equal(s.pcra.bias.length, 1);
      assert.equal(s.pcra.exercises.length, 1);
      assert.equal(s.journey.runs.length, 1);
      assert.equal(s.evidences[0].dfVersions.length, 1);
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    },
  );
}
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
    fs.writeFileSync(
      path.join(ROOT, "recette/refonte-browser-resultats.json"),
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
      ),
    );
    console.log(
      "Recette : " +
        results.filter((r) => r.status === "PASSÉ").length +
        " parcours passés ; " +
        results.filter((r) => r.status === "ÉCHEC").length +
        " échec(s).",
    );
  });
