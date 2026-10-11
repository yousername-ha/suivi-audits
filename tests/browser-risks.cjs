/* Recette réelle de l'administration et du registre ; stockage et comptes éphémères. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const XLSX = require("../lib/xlsx.full.min.js");
const ROOT = path.resolve(__dirname, ".."),
  TMP = fs.mkdtempSync("/tmp/legacy-risques-browser-"),
  PORT = Number(process.env.RISKS_PORT || 8161),
  URL = "http://127.0.0.1:" + PORT;
const results = [],
  errors = [],
  external = [],
  password = crypto.randomBytes(24).toString("base64url");
let server, browser, page, ctx, a, b, g, risk1, study1, independent;
const dlg = () => page.locator("#lx-dialog"),
  field = (n) => dlg().locator('[name="' + n + '"]');
const state = () =>
  page.evaluate(async () => {
    await LegacyServer.flush();
    return (await LegacyServer.request("/api/state")).state;
  });
async function nav(sec, sub) {
  await page.evaluate(
    ([sec, sub]) => {
      const el = document.querySelector(`[data-act="nav"][data-sec="${sec}"]`);
      if (!el) throw Error("Menu absent " + sec);
      el.click();
      if (sub) {
        const child = document.querySelector(
          `[data-act="nav"][data-sec="${sec}"][data-sub="${sub}"]`,
        );
        if (!child) throw Error("Sous-menu absent " + sub);
        child.click();
      }
    },
    [sec, sub],
  );
}
async function submit() {
  await dlg().locator("[type=submit]").click();
  await dlg()
    .waitFor({ state: "hidden", timeout: 15000 })
    .catch(async () => {
      throw Error(await dlg().locator("[role=alert]").innerText());
    });
  await page.evaluate(() => LegacyServer.flush());
}
async function check(name, fn) {
  const at = Date.now();
  try {
    await fn();
    results.push({ name, status: "PASSÉ", durationMs: Date.now() - at });
    console.log("PASSÉ " + name);
  } catch (e) {
    results.push({ name, status: "ÉCHEC", message: e.message });
    await page
      .screenshot({ path: path.join(TMP, "echec.png"), fullPage: true })
      .catch(() => {});
    console.error(e.stack);
    throw e;
  }
}
function watch(p) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(URL))
      external.push(r.url());
  });
}
async function auth(p, login = "admin_risques") {
  await p.locator("#lx-auth").waitFor();
  if (await p.locator("#lx-auth [name=name]").count())
    await p.locator("#lx-auth [name=name]").fill("Administration FICTIVE");
  await p.locator("#lx-auth [name=login]").fill(login);
  await p.locator("#lx-auth [name=password]").fill(password);
  await p.locator("#lx-auth [type=submit]").click();
  await p.locator("#lx-account").waitFor();
}
async function rejectWrite(p, change, expected) {
  const code = await p.evaluate(async (change) => {
    const data = await LegacyServer.request("/api/state");
    new Function("s", change)(data.state);
    try {
      await LegacyServer.request("/api/state", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return 200;
    } catch (e) {
      return e.status;
    }
  }, change);
  assert.equal(code, expected);
}
async function main() {
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
    server.once("exit", (c) => reject(Error("Serveur arrêté " + c)));
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  ctx = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 1440, height: 950 },
  });
  page = await ctx.newPage();
  watch(page);
  await check(
    "Installation : dix rôles de base, administration sans sauvegarde ni mise à jour",
    async () => {
      await page.goto(URL);
      await auth(page);
      const s = await state();
      assert.equal(s.roles.filter((r) => r.baseRoleKey).length, 10);
      assert.equal(s.riskMgmt.risks.length, 0);
      await page.locator("[data-act=settings]").first().click();
      assert.match(
        await page.locator("#panel h2").innerText(),
        /Administration/,
      );
      assert.doesNotMatch(
        await page.locator("#panel").innerText(),
        /sauvegarde|mise à jour/i,
      );
      const status = await page.evaluate(() =>
        LegacyServer.request("/api/admin/status"),
      );
      assert.equal(status.schema, 2);
      assert.equal(status.users, 1);
    },
  );
  await check(
    "Périmètre : référence PERI automatique et rôles proposés comme responsables",
    async () => {
      await nav("perimeters", "perimeter-registry");
      await page.locator("[data-lx-act=perimeter-new]").click();
      assert.equal(await field("internalId").getAttribute("readonly"), "");
      assert.match(await field("responsible").innerText(), /RSSI/);
      await field("name").fill("Périmètre hors jeu FICTIF");
      await field("description").fill("Périmètre témoin préexistant");
      await field("responsible").selectOption({
        label: (
          await field("responsible").locator("option").allTextContents()
        ).find((x) => x.includes("RSSI")),
      });
      await submit();
      const s = await state();
      assert.match(s.perimeters[0].internalId, /^PERI-\d{6}$/);
      assert.ok(s.perimeters[0].responsible.roleId);
      await rejectWrite(page, "s.perimeters[0].internalId='PERI-999999'", 422);
    },
  );
  await check(
    "Démonstration réelle : GHT, deux études, trois risques, BIA/PCA et facture physique",
    async () => {
      await nav("admin", "admin-demo");
      await page.locator("[data-lx-act=admin-demo]").click();
      await page.locator('#askDlg [data-ask="1"]').click();
      await page.waitForFunction(
        async () => {
          const { state: s } = await LegacyServer.request("/api/state");
          return s.integration.demoDatasets?.includes(LegacyDemo.KEY);
        },
        {},
        { timeout: 20000 },
      );
      const s = await state();
      assert.equal(s.perimeters.length, 5);
      g = s.perimeters.find((p) => p.name.startsWith("GHT Horizon"));
      a = s.perimeters.find((p) => p.name.startsWith("Centre Aurore"));
      b = s.perimeters.find((p) => p.name.startsWith("Centre Rivage"));
      assert.equal(s.riskMgmt.risks.length, 3);
      assert.equal(s.riskMgmt.studies.length, 2);
      assert.equal(s.riskMgmt.assessments.length, 4);
      risk1 = s.riskMgmt.risks[0];
      study1 = s.riskMgmt.studies[0];
      const aa = s.riskMgmt.assessments.filter((x) => x.riskId === risk1.id);
      assert.equal(aa.length, 2);
      assert.notEqual(aa[0].studyId, aa[1].studyId);
      assert.equal(study1.riskIds.length, 3);
      assert.match(s.pcra.bias[0].internalId, /^IMP-/);
      assert.equal(s.pcra.bias[0].activities.length, 2);
      assert.equal(
        s.pcra.bias[0].validation.contentRevision,
        s.pcra.bias[0].contentRevision,
      );
      const proof = s.evidences.find((p) => p.demoDataset);
      assert.equal(proof.dfVersions.length, 1);
      const text = await page.evaluate(
        async (key) =>
          (
            await LegacyServer.request("/api/files/" + key, { blob: true })
          ).text(),
        proof.dfVersions[0].fileKey,
      );
      assert.match(text, /FICTIF.*FACTURE/);
      assert.ok(s.df.budgets.length);
    },
  );
  await check(
    "Jeu répétable : aucun doublon, aucune altération des données antérieures ni compte ajouté",
    async () => {
      const before = await state();
      await page.locator("[data-lx-act=admin-demo]").click();
      await page.locator('#askDlg [data-ask="1"]').click();
      await page.waitForFunction(() =>
        document.body.innerText.includes("aucun doublon ajouté"),
      );
      const s = await state();
      assert.deepEqual(s.riskMgmt, before.riskMgmt);
      assert.deepEqual(s.perimeters[0], before.perimeters[0]);
      assert.equal(
        (await page.evaluate(() => LegacyServer.request("/api/users"))).users
          .length,
        1,
      );
    },
  );
  await check(
    "Fiche centrale : deux évaluations datées, auteur réel et niveaux initial/résiduel/accepté",
    async () => {
      await nav("risks", "risk-register");
      assert.equal(
        await page.locator("#panel [data-lx-act=risk-open]").count(),
        3,
      );
      await page
        .locator(`[data-lx-act=risk-open][data-id="${risk1.id}"]`)
        .click();
      const text = await page.locator("#panel").innerText();
      assert.match(text, /Évaluations historisées/);
      assert.match(text, /Administration FICTIVE/);
      assert.match(text, /Initial \/ brut/);
      assert.match(text, /Résiduel/);
      assert.match(text, /Accepté/);
      assert.match(
        text,
        new RegExp(study1.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      const s = await state();
      assert.ok(
        s.riskMgmt.assessments.every(
          (x) => x.authorId && x.author === "Administration FICTIVE",
        ),
      );
    },
  );
  await check(
    "Création indépendante et évaluation sans étude, avec identifiants RISK/EVR",
    async () => {
      await nav("risks", "risk-register");
      await page.locator("[data-lx-act=risk-new]").click();
      await field("title").fill("Risque indépendant FICTIF");
      await field("description").fill(
        "Interruption du portail fictif hors étude",
      );
      await field("perimeterIds").evaluateAll(
        (els, id) => els.find((e) => e.value === id).click(),
        a.id,
      );
      await submit();
      let s = await state();
      independent = s.riskMgmt.risks.find(
        (r) => r.title === "Risque indépendant FICTIF",
      );
      assert.match(independent.internalId, /^RISK-/);
      assert.ok(
        s.riskMgmt.studies.every((st) => !st.riskIds.includes(independent.id)),
      );
      await page.locator("[data-lx-act=risk-assess]").click();
      await field("impactId").selectOption("I2");
      await field("likelihoodId").selectOption("V2");
      await field("levelId").selectOption("L2");
      await field("justification").fill(
        "Appréciation indépendante FICTIVE vérifiée en recette",
      );
      await submit();
      s = await state();
      const aa = s.riskMgmt.assessments.find(
        (x) => x.riskId === independent.id,
      );
      assert.equal(aa.studyId, null);
      assert.match(aa.internalId, /^EVR-/);
      assert.equal(
        independent.id,
        s.riskMgmt.risks.find((r) => r.referenceEvaluationIds.initial === aa.id)
          .id,
      );
    },
  );
  await check(
    "Cartographie GHT et établissement : uniquement les références choisies, jamais un historique arbitraire",
    async () => {
      await nav("risks", "risk-map");
      assert.equal(
        await page.locator(".side-sub button.on[data-sub=risk-map]").count(),
        1,
      );
      assert.equal(
        await page.locator("#panel [data-lx-act=risk-open]").count(),
        4,
      );
      await page.locator("[name=riskMapPerimeter]").selectOption(g.id);
      assert.equal(
        await page.locator("#panel [data-lx-act=risk-open]").count(),
        4,
      );
      await page.locator("[name=riskMapPerimeter]").selectOption(b.id);
      assert.equal(
        await page.locator("#panel [data-lx-act=risk-open]").count(),
        2,
      );
      await page.locator("[name=riskMapPerimeter]").selectOption("");
      await page.locator("[name=riskMapStage]").selectOption("residual");
      const noFallback = await page.evaluate(
        async () =>
          LegacyRisks.rows((await LegacyServer.request("/api/state")).state, {
            stage: "residual",
          }).filter((x) => !x.assessment).length,
      );
      assert.equal(noFallback, 3);
      const tile = page.locator(
        `[data-lx-act=risk-open][data-id="${risk1.id}"]`,
      );
      assert.ok(
        (await tile.getAttribute("title")).includes(
          (await state()).riskMgmt.assessments.find(
            (x) => x.id === risk1.referenceEvaluationIds.residual,
          ).date,
        ),
      );
      await page.locator("[name=riskMapStage]").selectOption("accepted");
      assert.ok(
        (await tile.getAttribute("title")).includes(
          (await state()).riskMgmt.assessments.find(
            (x) => x.id === risk1.referenceEvaluationIds.residual,
          ).date,
        ),
      );
      await tile.click();
      assert.match(
        await page.locator("#panel h2").innerText(),
        /rançongiciel/i,
      );
    },
  );
  await check(
    "Exports Excel et rapport imprimable issus de la cartographie filtrée",
    async () => {
      await nav("risks", "risk-map");
      await page.locator("[name=riskMapPerimeter]").selectOption(b.id);
      await page.locator("[name=riskMapStage]").selectOption("initial");
      const download = page.waitForEvent("download");
      await page.locator("[data-lx-act=risk-export]").click();
      const dl = await download,
        dest = path.join(TMP, "risques.xlsx");
      await dl.saveAs(dest);
      const wb = XLSX.read(fs.readFileSync(dest), { type: "buffer" }),
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      assert.equal(rows.length, 2);
      assert.ok(
        rows.every(
          (r) => r.Évaluation && r.Politique && r.Méthode === "EBIOS RM",
        ),
      );
      const pop = page.waitForEvent("popup");
      await page.locator("[data-lx-act=risk-report]").click();
      const report = await pop;
      await report.waitForLoadState();
      assert.match(await report.locator("body").innerText(), /Cartographie/);
      assert.ok((await report.locator("body").innerText()).includes(b.name));
      await report.close();
    },
  );
  await check(
    "Archiver une étude conserve trois risques initiaux, leurs quatre évaluations et tous les liens",
    async () => {
      const before = await state();
      await nav("risks", "risk-studies");
      await page
        .locator(`[data-lx-act=risk-study-open][data-id="${study1.id}"]`)
        .click();
      await page.locator("[data-lx-act=risk-study-edit]").click();
      await field("status").selectOption("Archivée");
      await submit();
      const s = await state();
      assert.equal(
        s.riskMgmt.studies.find((st) => st.id === study1.id).status,
        "Archivée",
      );
      assert.deepEqual(s.riskMgmt.assessments, before.riskMgmt.assessments);
      assert.deepEqual(s.riskMgmt.risks, before.riskMgmt.risks);
      assert.equal(
        s.riskMgmt.studies.find((st) => st.id === study1.id).riskIds.length,
        3,
      );
      await rejectWrite(page, "s.riskMgmt.risks.splice(0,1)", 422);
      await rejectWrite(
        page,
        "s.riskMgmt.assessments[0].justification='altération'",
        422,
      );
    },
  );
  await check(
    "Traitements, preuves et action unique : clôturer une action conserve le résiduel",
    async () => {
      await nav("risks", "risk-treatments");
      const before = await state(),
        m = before.riskMgmt.measures[0];
      await page
        .locator(`[data-lx-act=risk-measure-edit][data-id="${m.id}"]`)
        .click();
      await field("description").fill(
        m.description + " · réalisation revue en recette FICTIVE",
      );
      await submit();
      let s = await state();
      assert.ok(s.riskMgmt.measures[0].history.length >= 2);
      assert.equal(
        s.riskMgmt.measures[0].history.at(-1).actor,
        "Administration FICTIVE",
      );
      assert.equal(
        s.findings.filter((f) => f.riskMeasureId === m.id).length,
        1,
      );
      assert.deepEqual(s.riskMgmt.measures[0].proofRefs, m.proofRefs);
      await page
        .locator(`[data-lx-act=risk-action-open][data-id="${m.id}"]`)
        .click();
      await page
        .locator("#drawer [data-fd][data-f=status]")
        .selectOption("Clos");
      await page.locator("#drawer [data-act=close]").first().click();
      s = await state();
      assert.equal(s.findings.find((f) => f.id === m.actionId).status, "Clos");
      assert.equal(
        s.riskMgmt.risks[0].referenceEvaluationIds.residual,
        before.riskMgmt.risks[0].referenceEvaluationIds.residual,
      );
    },
  );
  await check(
    "Comptes et habilitations créés dans le panneau d’administration",
    async () => {
      await nav("admin", "admin-users");
      for (const [login, permission] of [
        ["lecture_a", "viewer"],
        ["contribution_a", "editor"],
      ]) {
        await page.locator("[data-lx-act=account-new]").click();
        await field("login").fill(login);
        await field("name").fill(login + " FICTIF");
        await field("password").fill(password);
        await field("permission").selectOption(permission);
        await field("perimeterIds").evaluateAll(
          (els, id) => els.find((e) => e.value === id).click(),
          a.id,
        );
        await submit();
      }
      assert.equal(
        (await page.evaluate(() => LegacyServer.request("/api/users"))).users
          .length,
        3,
      );
    },
  );
  await check(
    "Lecteur établissement : registre restreint, politique GHT héritée, API administration interdite",
    async () => {
      const c = await browser.newContext(),
        p = await c.newPage();
      watch(p);
      await p.goto(URL);
      await auth(p, "lecture_a");
      const s = (await p.evaluate(() => LegacyServer.request("/api/state")))
        .state;
      assert.equal(s.riskMgmt.risks.length, 2);
      assert.ok(
        s.riskMgmt.risks.every((r) =>
          r.perimeterIds.every((id) => id === a.id),
        ),
      );
      assert.equal(s.riskMgmt.policies.length, 1);
      assert.equal(s.riskMgmt.studies.length, 0);
      assert.equal(await p.locator("[data-sec=admin]").count(), 0);
      for (const route of ["/api/admin/status", "/api/audit"])
        assert.equal(
          await p.evaluate(async (route) => {
            try {
              await LegacyServer.request(route);
              return 200;
            } catch (e) {
              return e.status;
            }
          }, route),
          403,
        );
      await rejectWrite(
        p,
        "s.riskMgmt.risks[0].title='Contournement FICTIF'",
        403,
      );
      await c.close();
    },
  );
  await check(
    "Contributeur établissement : édition autorisée, références et historiques protégés côté serveur",
    async () => {
      const c = await browser.newContext(),
        p = await c.newPage();
      watch(p);
      await p.goto(URL);
      await auth(p, "contribution_a");
      await p.evaluate(() =>
        document.querySelector("[data-act=nav][data-sec=risks]").click(),
      );
      await p.locator(`[data-lx-act=risk-open][data-id="${risk1.id}"]`).click();
      assert.match(
        await p.locator("#panel").innerText(),
        /Étude hors périmètre de consultation/,
      );
      await p.locator("[data-lx-act=risk-edit]").click();
      await p
        .locator("#lx-dialog [name=description]")
        .fill(
          risk1.description + " · contexte revu par le contributeur FICTIF",
        );
      await p.locator("#lx-dialog [type=submit]").click();
      await p.locator("#lx-dialog").waitFor({ state: "hidden" });
      await p.evaluate(() => LegacyServer.flush());
      await rejectWrite(
        p,
        "s.riskMgmt.risks[0].referenceEvaluationIds.initial=null",
        403,
      );
      await rejectWrite(p, "s.riskMgmt.assessments[0].levelId='L1'", 422);
      await rejectWrite(
        p,
        "s.riskMgmt.policies[0].title='Politique modifiée'",
        403,
      );
      await c.close();
      await page.reload();
      await page.locator("#lx-account").waitFor();
      const s = await state();
      assert.equal(s.riskMgmt.risks.length, 4);
      assert.match(s.riskMgmt.risks[0].description, /contributeur FICTIF/);
      assert.equal(
        s.riskMgmt.risks[0].history.at(-1).actor,
        "contribution_a FICTIF",
      );
    },
  );
  await check(
    "Politique personnalisée, matrice non uniforme et nouvelle version sans altérer l’historique",
    async () => {
      await nav("risks", "risk-policies");
      await page.locator("[data-lx-act=risk-policy-new]").click();
      await field("title").fill("Politique personnalisée FICTIVE");
      await field("method").selectOption("Personnalisée");
      await field("perimeterIds").evaluateAll(
        (els, id) => els.find((e) => e.value === id).click(),
        a.id,
      );
      await field("impactScale").fill("Impact métier\nImpact financier");
      await field("likelihoodScale").fill("Rare\nPossible\nFréquent");
      await field("levels").fill(
        "Tolérable ; #e0eade ; Acceptable sous conditions\nÀ traiter ; #f0e6d2 ; Validation requise",
      );
      await field("calculation").selectOption("matrix");
      for (const i of [1, 2])
        for (const v of [1, 2, 3])
          await field(`matrix:I${i}:V${v}`).selectOption(v === 3 ? "L2" : "L1");
      await submit();
      let s = await state();
      const p = s.riskMgmt.policies.at(-1),
        original = JSON.stringify(p);
      assert.equal(p.impactScale.length, 2);
      assert.equal(p.likelihoodScale.length, 3);
      assert.equal(p.levels.length, 2);
      assert.equal(p.normative, false);
      await nav("risks", "risk-register");
      await page.locator("[name=riskMapPerimeter]").selectOption("");
      await page
        .locator(`[data-lx-act=risk-open][data-id="${independent.id}"]`)
        .click();
      await page.locator("[data-lx-act=risk-assess]").click();
      await field("policyId").selectOption(p.id);
      await field("stage").selectOption("residual");
      await field("impactId").selectOption("I1");
      await field("likelihoodId").selectOption("V3");
      assert.equal(await field("levelId").inputValue(), "L2");
      assert.equal(await field("levelId").isDisabled(), true);
      await field("justification").fill(
        "Application de la matrice interne personnalisée FICTIVE",
      );
      await field("reference").uncheck();
      await submit();
      s = await state();
      const evaluation = s.riskMgmt.assessments.at(-1);
      assert.equal(evaluation.method, "Personnalisée");
      assert.equal(evaluation.levelId, "L2");
      assert.equal(
        s.riskMgmt.risks.find((r) => r.id === independent.id)
          .referenceEvaluationIds.residual,
        null,
      );
      await page
        .locator(`[data-lx-act=risk-reference][data-id="${evaluation.id}"]`)
        .click();
      await page.evaluate(() => LegacyServer.flush());
      await nav("risks", "risk-map");
      await page.locator("[name=riskMapStage]").selectOption("residual");
      assert.match(await page.locator("#panel").innerText(), /Personnalisée/);
      assert.match(await page.locator("#panel").innerText(), /EBIOS RM/);
      await nav("risks", "risk-policies");
      await page
        .locator(`[data-lx-act=risk-policy-version][data-id="${p.id}"]`)
        .click();
      await field("description").fill("Version suivante FICTIVE");
      await submit();
      s = await state();
      assert.equal(
        JSON.stringify(s.riskMgmt.policies.find((x) => x.id === p.id)),
        original,
      );
      assert.equal(s.riskMgmt.policies.at(-1).version, 2);
      assert.equal(
        s.riskMgmt.assessments.find((x) => x.id === evaluation.id).policyId,
        p.id,
      );
    },
  );
  await check(
    "Parcours guidé : modification du même risque central sans duplication",
    async () => {
      const before = await state(),
        task = before.journey.tasks.find((t) => t.stepId === "risks");
      assert.equal(task.businessRef.kind, "risk");
      await nav("journey");
      await page.locator("[data-lx-act=journey-step][data-step=risks]").click();
      await page
        .locator(`[data-lx-act=journey-business][data-id="${task.id}"]`)
        .click();
      assert.match(await dlg().locator("h2").innerText(), /risque central/);
      await field("description").fill(
        "Contexte FICTIF renseigné depuis le parcours guidé",
      );
      await submit();
      const s = await state();
      assert.equal(s.riskMgmt.risks.length, before.riskMgmt.risks.length);
      assert.equal(
        s.riskMgmt.risks.find((r) => r.id === task.businessRef.id).description,
        "Contexte FICTIF renseigné depuis le parcours guidé",
      );
      assert.deepEqual(
        s.journey.tasks.find((t) => t.id === task.id).businessRef,
        task.businessRef,
      );
      await nav("risks", "risk-register");
      await page
        .locator(`[data-lx-act=risk-open][data-id="${task.businessRef.id}"]`)
        .click();
      assert.match(
        await page.locator("#panel").innerText(),
        /Traitements et mesures du risque/,
      );
      assert.match(
        await page.locator("#panel").innerText(),
        /depuis le parcours guidé/,
      );
    },
  );
  await check(
    "Compatibilité des anciennes rubriques avec le jeu de démonstration",
    async () => {
      for (const sec of [
        "dash",
        "pil",
        "care",
        "has",
        "gap",
        "crrc",
        "invest",
        "crisis",
        "reports",
        "perimeters",
        "journey",
        "pcra",
      ]) {
        if (await page.locator(`[data-act=nav][data-sec="${sec}"]`).count())
          await nav(sec);
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    },
  );
  await check(
    "Responsive : administration et cartographie à 390, 768, 1440 et 3840 pixels",
    async () => {
      for (const width of [390, 768, 1440, 3840]) {
        await page.setViewportSize({ width, height: 950 });
        for (const [sec, sub] of [
          ["admin", "admin-overview"],
          ["risks", "risk-map"],
        ]) {
          await nav(sec, sub);
          await page.screenshot({
            path: path.join(TMP, `${sec}-${width}.png`),
            fullPage: true,
            animations: "disabled",
          });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          );
          assert.ok(
            overflow <= 2,
            "Débordement " + sec + " " + width + ":" + overflow,
          );
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    },
  );
  await check(
    "Persistance : références automatiques, évaluations et pièces conservées après redémarrage",
    async () => {
      const before = await state();
      const stopped = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await stopped;
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
      });
      await page.reload();
      await page.locator("#lx-account").waitFor();
      const s = await state();
      assert.deepEqual(s.riskMgmt, before.riskMgmt);
      assert.deepEqual(s.evidences, before.evidences);
      assert.deepEqual(s.perimeters, before.perimeters);
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
      path.join(ROOT, "recette/risques-admin-browser-resultats.json"),
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
      "Captures et fichiers synthétiques conservés hors Git : " + TMP,
    );
  });
