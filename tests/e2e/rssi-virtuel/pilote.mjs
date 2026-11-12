#!/usr/bin/env node
/* Pilote de navigateur de l'agent « RSSI virtuel » : un Chrome reste ouvert entre deux commandes (protocole CDP), l'agent le
   commande pas à pas et lit ce que voit un utilisateur (arbre d'accessibilité), sans dépendance ajoutée (@playwright/test
   des tests de bout en bout). Chaque commande est journalisée dans .pilote/journal.jsonl : c'est la trace du parcours, que
   l'agent transforme ensuite en test déterministe et cite dans son rapport.

   node tests/e2e/rssi-virtuel/pilote.mjs <commande> [arguments]      (aide : sans argument)

   Variables : E2E_BASE_URL (défaut https://localhost), E2E_TOKEN_CMD (jeton d'installation, comme les tests de bout en
   bout), PILOTE_CHROME (exécutable ; défaut : Chromium de Playwright), PILOTE_PORT (défaut 9333), PILOTE_VISIBLE=1. */
import { spawn, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DOSSIER = path.join(ICI, '.pilote');
const ETAT = path.join(DOSSIER, 'etat.json');
const JOURNAL = path.join(DOSSIER, 'journal.jsonl');
const BASE = (process.env.E2E_BASE_URL || 'https://localhost').replace(/\/+$/, '');
const PORT = Number(process.env.PILOTE_PORT || 9333);
const LIMITE_ARBRE = Number(process.env.PILOTE_LIMITE || 12_000);

const AIDE = `Pilote du navigateur de l'agent RSSI virtuel (base : ${BASE})

  demarrer                      ouvre Chrome (profil neuf dans .pilote/profil) et la page d'accueil
  arreter                       ferme Chrome
  ouvrir <chemin|url>           navigue (ex. ouvrir /pilotage)
  voir [sélecteur]              adresse, titre, alertes et arbre d'accessibilité de la page (ou d'une zone CSS)
  cliquer <rôle> <nom>          clic sur un élément par rôle ARIA et nom exact (ex. cliquer button "Créer le compte")
  cliquer-texte <texte>         clic sur le premier élément visible portant ce texte exact
  remplir <libellé> <valeur>    saisit dans le champ de ce libellé (remplace le contenu)
  choisir <libellé> <option>    liste déroulante (native ou Mantine) : ouvre puis choisit l'option
  cocher <libellé>              coche une case ou un interrupteur
  taper <texte>                 frappe au clavier dans l'élément actif (ex. code TOTP dans les six cases)
  touche <touche>               appuie sur une touche (Enter, Escape, Tab…)
  attendre <texte>              attend qu'un texte apparaisse (10 s)
  capture <nom>                 capture pleine page dans .pilote/captures/<nom>.png (à relire avec l'outil d'image)
  api <MÉTHODE> <chemin> [json] appel d'API avec la session du navigateur (jeton CSRF et origine ajoutés)
  jeton                         affiche un jeton d'installation neuf (E2E_TOKEN_CMD)
  totp <secret>                 calcule le code TOTP courant d'un secret base32
  invariants                    contrôle les règles de cohérence du SMSI (invariants.ts) sur l'état courant
  journal                       affiche la trace des commandes de la session

Code retour 0 : commande réussie ; 1 : échec (le message dit ce qui manquait : c'est souvent un constat à noter).`;

const journaliser = (entree) => {
  mkdirSync(DOSSIER, { recursive: true });
  appendFileSync(JOURNAL, JSON.stringify({ quand: new Date().toISOString(), ...entree }) + '\n');
};

function totp(secret, decalage = 0) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const octets = [];
  let bits = 0,
    val = 0;
  for (const c of secret.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    val = (val << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      octets.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + decalage));
  const h = crypto.createHmac('sha1', Buffer.from(octets)).update(compteur).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

async function demarrer() {
  // Un Chrome répond déjà sur le port : on le garde. Sinon l'état éventuel est périmé et sera réécrit.
  try {
    await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 2000 }).then((b) => b.close());
    return 'Chrome déjà ouvert (arreter pour repartir d’un profil neuf).';
  } catch {
    /* aucun Chrome : démarrage */
  }
  const profil = path.join(DOSSIER, 'profil');
  rmSync(profil, { recursive: true, force: true });
  mkdirSync(path.join(DOSSIER, 'captures'), { recursive: true });
  const executable = process.env.PILOTE_CHROME || chromium.executablePath();
  const args = [
    `--remote-debugging-port=${PORT}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profil}`,
    '--ignore-certificate-errors',
    '--no-first-run',
    '--no-default-browser-check',
    '--lang=fr-FR',
    '--window-size=1440,900',
    ...(process.env.PILOTE_VISIBLE === '1' ? [] : ['--headless=new']),
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ];
  const enfant = spawn(executable, args, { detached: true, stdio: 'ignore' });
  enfant.unref();
  for (let i = 0; i < 40; i++) {
    try {
      const b = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 1000 });
      await b.close();
      writeFileSync(ETAT, JSON.stringify({ pid: enfant.pid, port: PORT, base: BASE }));
      const { page, fermer } = await connecter();
      await page.goto(BASE + '/');
      const vu = await decrire(page);
      await fermer();
      return `Chrome ouvert (pid ${enfant.pid}).\n${vu}`;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Chrome ne répond pas sur le port ${PORT} (exécutable : ${executable}).`);
}

async function connecter() {
  if (!existsSync(ETAT)) throw new Error('Chrome n’est pas ouvert : lancer « demarrer ».');
  const navigateur = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = navigateur.contexts()[0];
  const pages = ctx.pages().filter((p) => !p.url().startsWith('devtools://'));
  const page = pages[pages.length - 1] ?? (await ctx.newPage());
  page.setDefaultTimeout(10_000);
  // CDP ne garde pas les écouteurs entre deux commandes : les erreurs de la page sont relevées pendant la commande.
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(`JS : ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text()))
      erreurs.push(`console : ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 500) erreurs.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return { page, erreurs, fermer: () => navigateur.close() };
}

async function decrire(page, selecteur) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(300);
  const zone = selecteur ? page.locator(selecteur).first() : page.locator('body');
  let arbre = await zone.ariaSnapshot({ timeout: 5000 }).catch((e) => `(arbre illisible : ${e.message})`);
  if (arbre.length > LIMITE_ARBRE)
    arbre = arbre.slice(0, LIMITE_ARBRE) + `\n… (tronqué : « voir <sélecteur> » pour une zone)`;
  const alertes = await page
    .locator('[role="alert"], .mantine-Notification-root')
    .allInnerTexts()
    .catch(() => []);
  return [
    `URL : ${page.url().replace(BASE, '')}`,
    `Titre : ${await page.title()}`,
    alertes.length ? `Alertes : ${alertes.map((a) => a.replace(/\s+/g, ' ').trim()).join(' | ')}` : 'Alertes : aucune',
    '--- arbre d’accessibilité ---',
    arbre,
  ].join('\n');
}

/** Champ désigné par son nom accessible, tel que « voir » l'affiche (le libellé visible d'un champ obligatoire porte un
    astérisque masqué aux lecteurs d'écran : le nom accessible est donc essayé en premier). */
async function parLibelle(page, libelle) {
  const candidats = [
    ...['textbox', 'combobox', 'spinbutton', 'searchbox', 'checkbox', 'switch', 'radio'].map((role) =>
      page.getByRole(role, { name: libelle, exact: true }),
    ),
    page.getByLabel(libelle, { exact: true }),
    page.getByLabel(libelle),
  ];
  for (const c of candidats) if ((await c.count()) > 0) return c.first();
  throw new Error(`aucun champ nommé « ${libelle} » sur la page`);
}

async function executer(commande, args) {
  switch (commande) {
    case 'demarrer':
      return demarrer();
    case 'arreter': {
      let pid = 0;
      try {
        pid = JSON.parse(readFileSync(ETAT, 'utf8')).pid;
      } catch {
        /* aucun état : rien à fermer */
      }
      if (pid) {
        try {
          process.kill(-pid);
        } catch {
          try {
            process.kill(pid);
          } catch {
            /* déjà fermé */
          }
        }
      }
      rmSync(ETAT, { force: true });
      return 'Chrome fermé.';
    }
    case 'jeton': {
      const cmd = process.env.E2E_TOKEN_CMD || 'docker compose exec -T app setup-token';
      const sortie = execSync(cmd, { cwd: process.env.E2E_STACK_DIR || path.join(ICI, '../../..'), encoding: 'utf8' });
      const m = /[A-Z2-9]{5}(-[A-Z2-9]{5}){3}/.exec(sortie);
      if (!m) throw new Error(`jeton introuvable dans la sortie de « ${cmd} »`);
      return m[0];
    }
    case 'totp':
      if (!args[0]) throw new Error('usage : totp <secret>');
      return totp(args[0]);
    case 'journal':
      try {
        return readFileSync(JOURNAL, 'utf8');
      } catch {
        return '(journal vide)';
      }
  }
  const { page, erreurs, fermer } = await connecter();
  try {
    let resultat = '';
    switch (commande) {
      case 'ouvrir':
        await page.goto(/^https?:/.test(args[0] ?? '') ? args[0] : BASE + (args[0] || '/'));
        break;
      case 'voir':
        return { texte: await decrire(page, args[0]), erreurs };
      case 'cliquer': {
        const [role, ...nom] = args;
        await page
          .getByRole(role, { name: nom.join(' '), exact: true })
          .first()
          .click();
        break;
      }
      case 'cliquer-texte':
        await page.getByText(args.join(' '), { exact: true }).locator('visible=true').first().click();
        break;
      case 'remplir':
        await (await parLibelle(page, args[0])).fill(args.slice(1).join(' '));
        break;
      case 'choisir': {
        const champ = await parLibelle(page, args[0]);
        const option = args.slice(1).join(' ');
        if ((await champ.evaluate((e) => e.tagName)) === 'SELECT') await champ.selectOption({ label: option });
        else {
          await champ.click();
          await page.getByRole('option', { name: option, exact: true }).first().click();
        }
        break;
      }
      case 'cocher':
        await (await parLibelle(page, args[0])).check({ force: true });
        break;
      case 'taper':
        await page.keyboard.type(args.join(' '), { delay: 30 });
        break;
      case 'touche':
        await page.keyboard.press(args[0]);
        break;
      case 'attendre':
        await page.getByText(args.join(' ')).first().waitFor({ state: 'visible' });
        break;
      case 'capture': {
        const fichier = path.join(DOSSIER, 'captures', `${(args[0] || 'capture').replace(/[^\w.-]/g, '_')}.png`);
        await page.screenshot({ path: fichier, fullPage: true });
        resultat = `Capture : ${fichier}`;
        break;
      }
      case 'invariants': {
        // Mêmes règles que le harnais (90-invariants.spec.ts), sur la pile où l'agent a travaillé (Node 24+ : types effacés).
        const { lireInstantane, REGLES } = await import('./invariants.ts');
        const instantane = await lireInstantane(page.request, BASE);
        const lignes = [];
        let bloquant = false;
        for (const [id, r] of Object.entries(REGLES)) {
          const v = r.regle(instantane);
          bloquant ||= v.some((x) => x.gravite === 'bloquant');
          lignes.push(
            `${v.length ? (v.some((x) => x.gravite === 'bloquant') ? 'ÉCHEC' : 'ALERTE') : 'OK   '} ${id} ${r.titre} (${r.source})`,
          );
          for (const x of v) lignes.push(`        ${x.gravite} : ${x.detail}`);
        }
        return { texte: lignes.join('\n'), erreurs, echec: bloquant };
      }
      case 'api': {
        const [methode = 'GET', chemin = '/', corps] = args;
        const csrf = (await (await page.request.get(BASE + '/api/auth/me')).json()).csrf;
        const r = await page.request.fetch(BASE + chemin, {
          method: methode.toUpperCase(),
          headers: { Origin: BASE, ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
          ...(corps ? { data: JSON.parse(corps) } : {}),
        });
        const texte = await r.text();
        return {
          texte: `HTTP ${r.status()}\n${texte.length > LIMITE_ARBRE ? texte.slice(0, LIMITE_ARBRE) + '\n… (tronqué)' : texte}`,
          erreurs,
          echec: r.status() >= 400,
        };
      }
      default:
        throw new Error(`commande inconnue « ${commande} »\n\n${AIDE}`);
    }
    return { texte: [resultat, await decrire(page)].filter(Boolean).join('\n'), erreurs };
  } finally {
    await fermer();
  }
}

const [commande, ...args] = process.argv.slice(2);
if (!commande || commande === 'aide') {
  console.log(AIDE);
  process.exit(0);
}
try {
  const r = await executer(commande, args);
  const { texte, erreurs = [], echec = false } = typeof r === 'string' ? { texte: r } : r;
  // Un secret TOTP ou un jeton n'est jamais journalisé : seule la commande est tracée.
  const argsJournal = ['totp', 'jeton'].includes(commande)
    ? []
    : commande === 'remplir' && /mot de passe|confirmation|jeton/i.test(args[0] ?? '')
      ? [args[0], '••••']
      : args;
  journaliser({ commande, args: argsJournal, ok: !echec, erreurs });
  console.log(texte);
  if (erreurs.length) console.log(`--- erreurs relevées pendant la commande ---\n${erreurs.join('\n')}`);
  process.exit(echec ? 1 : 0);
} catch (e) {
  journaliser({
    commande,
    args: commande === 'remplir' ? [args[0], '••••'] : args,
    ok: false,
    erreur: String(e.message).split('\n')[0],
  });
  console.error(`ÉCHEC : ${e.message.split('\n').slice(0, 6).join('\n')}`);
  process.exit(1);
}
