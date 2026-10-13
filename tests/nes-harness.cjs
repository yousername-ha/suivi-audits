/* Outils communs aux recettes de l'habillage global : serveur temporaire, connexion, jeu de données FICTIF.
   Aucune donnée réelle ; le serveur et la base sont créés dans un répertoire temporaire. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawn } = require("node:child_process");

async function startServer(root, port, temp = fs.mkdtempSync(path.join(os.tmpdir(), "nes-"))) {
  const server = spawn(
    process.env.PYTHON || "python3",
    ["demarrer.py", "--sans-navigateur", "--port", String(port), "--donnees", path.join(temp, "data")],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error("Serveur arrêté : " + code)));
  });
  return { server, temp, url: `http://127.0.0.1:${port}` };
}
async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
}
async function login(page, url, user = "admin", password = "admin") {
  await page.goto(url);
  await page.locator("#lx-auth [name=login]").fill(user);
  await page.locator("#lx-auth [name=password]").fill(password);
  await page.locator("#lx-auth [type=submit]").click();
  await page.locator("#lx-account").waitFor();
}
const navigate = (page, tab, set = {}) =>
  page.evaluate(([t, s]) => LegacyIntegrationUI.toolkit.api().navigate(t, s), [tab, set]);

/* Données FICTIVES : jeu de démonstration, écarts, tâches récurrentes, trois politiques de risque. */
async function seed(page) {
  await page.evaluate(async () => {
    const u = LegacyIntegrationUI.toolkit;
    u.api().replaceState(LegacyDemo.build(u.state(), "Recette habillage FICTIVE").state);
    await u.mutate((s) => {
      s.nextDate = "2027-05-03";
      s.internalDate = "2027-03-01";
      s.nextYear = 2027;
      const scope = s.perimeters.map((p) => p.id);
      const titles = ["Renforcer les accès privilégiés", "Tester la restauration hors ligne", "Revoir les habilitations", "Segmenter le réseau clinique", "Qualifier les alertes critiques", "Actualiser le PCA", "Collecter les preuves HDS", "Évaluer les fournisseurs", "Préparer le comité SSI", "Actualiser les procédures"];
      for (let n = 0; n < 10; n++)
        s.findings.push({
          id: "NES-ACT-" + n,
          text: titles[n] + " (FICTIF)",
          action: "",
          type: n === 0 ? "NC min" : "PS",
          source: "Interne",
          year: 2026,
          status: n < 4 ? "Ouvert" : n < 8 ? "En cours" : "Clos",
          due: n < 2 ? "2026-10-01" : "2026-11-" + String(10 + n).padStart(2, "0"),
          start: n % 2 ? "2026-10-01" : "",
          owner: "Équipe SSI (FICTIF)",
          items: [],
          perimeterIds: scope,
          tasks: [{ t: "Préparer", done: n >= 8 }],
          createdAt: "2026-10-01T09:00:00Z",
        });
      s.recurring = [];
      const rec = ["Revue des habilitations", "Test de restauration", "Comité de sécurité", "Revue des journaux", "Contrôle des comptes privilégiés", "Revue des fournisseurs"];
      for (let n = 0; n < 6; n++)
        s.recurring.push({
          id: "NES-REC-" + n,
          title: rec[n] + " (FICTIF)",
          n: [1, 1, 1, 1, 3, 1][n],
          u: ["m", "s", "m", "s", "m", "a"][n],
          start: ["2026-09-05", "2026-10-14", "2026-10-16", "2026-10-15", "2026-10-20", "2026-10-22"][n],
          last: n === 0 ? "2026-09-05" : "",
          active: true,
          owner: n % 2 ? "Équipe SSI (FICTIF)" : "RSSI (FICTIF)",
          cat: n < 3 ? "Gouvernance" : "Contrôles",
          history: n === 0 ? [{ date: "2026-09-05", by: "RSSI (FICTIF)", comment: "Revue des habilitations effectuée. Écarts transmis au plan d’action.", proof: "Compte rendu fictif de revue des accès." }] : [],
          perimeterIds: scope,
          notes: "Vérifier les éléments attendus et consigner la réalisation avec un commentaire et une preuve.",
        });
      const R = LegacyRisks;
      const grid = (policy) =>
        policy.impactScale.forEach((im, i) =>
          policy.likelihoodScale.forEach((lk, j) => (policy.matrix[im.id + ":" + lk.id] = "L" + Math.min(4, 1 + Math.floor((i + j) / 2)))),
        );
      const standard = JSON.parse(JSON.stringify(R.DEFAULT_POLICY));
      standard.title = "Politique standard à matrice (FICTIVE)";
      standard.calculation = "matrix";
      standard.perimeterIds = scope;
      grid(standard);
      const custom = JSON.parse(JSON.stringify(R.DEFAULT_POLICY));
      custom.title = "Politique personnalisée (FICTIVE)";
      custom.calculation = "matrix";
      custom.perimeterIds = scope;
      custom.levels.forEach((l, i) => (l.color = ["#2B6CB0", "#6B46C1", "#B7791F", "#97266D"][i]));
      grid(custom);
      const manual = JSON.parse(JSON.stringify(R.DEFAULT_POLICY));
      manual.title = "Politique manuelle (FICTIVE)";
      manual.perimeterIds = scope;
      const made = [standard, custom, manual].map((p) => R.policy(s, p));
      s.riskMgmt.risks.forEach((r, i) => {
        const pol = made[i % 3];
        const a = R.assessment(
          s,
          { riskId: r.id, policyId: pol.id, impactId: "I" + (4 - i), likelihoodId: "V" + (4 - i), ...(pol.calculation === "manual" ? { levelId: "L2" } : {}), stage: "initial", date: "2026-10-01", justification: "Évaluation fictive de recette" },
          "Recette habillage",
        );
        R.reference(s, r.id, a.id);
      });
    });
    await LegacyServer.flush();
    u.api().render();
  });
}
module.exports = { startServer, launch, login, navigate, seed };
