/* Campagne de recette multi-agent du 12/11/2026, phase 3 : défauts bloquants et majeurs des tranches « incidents, crise,
   continuité, documents, exports » et « installation, comptes, Plateforme, Système », rejoués sur les piles 5 et 6
   (docs/05_RECETTE/rssi-virtuel/campagne/rejeu-piles-5-6.md). Chaque test décrit le comportement attendu et porte un
   marqueur test.fail tant que le constat est ouvert : il devient rouge une fois le défaut corrigé, ce qui oblige à retirer
   le marqueur ; un constat corrigé et vérifié par la recette garde son test, sans marqueur (« corrigé »), comme test de
   non-régression. Le fichier crée lui-même ses données fictives (préfixe « Campagne … (fictif) »), ses périmètres
   restreints (celui de la campagne et un voisin) et ses deux comptes de rôle ; il archive ou supprime ce qu'il crée quand
   l'application le permet. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type APIRequestContext, type APIResponse, type Browser } from '@playwright/test';
import { preparerCompte, sessionAdmin, sessionCompte } from '../../helpers';
import { PERIMETRE_COMMUN } from '../invariants';

const PERIMETRE_CAMPAGNE = 'Campagne r56 hébergement (fictif)';
const PERIMETRE_VOISIN = 'Campagne r56 périmètre voisin (fictif)';
const CONTRIBUTEUR = 'camp-r56-contrib';
const AUDITEUR = 'camp-r56-auditeur';

type Objet = { id: string; name: string; version: number; archived?: boolean; data: Record<string, unknown> };
type Incident = { id: string; title: string; timeline: { id: string; titre: string }[] };

const texteDe = async (r: APIResponse) => `${r.status()} ${await r.text()}`;
/** Étape préparatoire : son échec doit se distinguer du défaut visé (message de la réponse dans le rapport). */
async function okJson<T>(r: APIResponse, etape: string): Promise<T> {
  expect(r.ok(), `${etape} : ${await texteDe(r)}`).toBe(true);
  return (await r.json()) as T;
}
const liste = <T>(x: T[] | { items: T[] }) => (Array.isArray(x) ? x : x.items);
const ilYaUnAn = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 16);

async function creerObjet(req: APIRequestContext, csrf: string, smsi: string, kind: string, name: string, data = {}) {
  return okJson<Objet>(
    await req.post(`/api/grc/${smsi}/objects`, { headers: { 'X-CSRF-Token': csrf }, data: { kind, name, data } }),
    `création ${kind} « ${name} »`,
  );
}
/** Archivage d'une fiche du test (DELETE, contrôle de version) : nettoyage, sans assertion. */
async function archiver(req: APIRequestContext, csrf: string, smsi: string, o: Objet | undefined) {
  if (!o) return;
  await req.delete(`/api/grc/${smsi}/objects/${o.id}`, {
    headers: { 'X-CSRF-Token': csrf, 'If-Match': String(o.version) },
  });
}
async function creerIncident(req: APIRequestContext, csrf: string, title: string, smsi?: string) {
  return okJson<Incident>(
    await req.post('/api/incidents', { headers: { 'X-CSRF-Token': csrf }, data: { title, ...(smsi ? { smsi } : {}) } }),
    `création de l’incident « ${title} »`,
  );
}
const supprimerIncident = (req: APIRequestContext, csrf: string, id: string | undefined) =>
  id ? req.delete(`/api/incidents/${id}`, { headers: { 'X-CSRF-Token': csrf } }) : Promise.resolve();

/** Écrit une section de réglages avec la version lue (If-Match), comme la fenêtre de l'écran. */
async function ecrireReglage(req: APIRequestContext, csrf: string, section: string, valeurs: Record<string, unknown>) {
  const lu = await okJson<{ version: number }>(await req.get(`/api/settings/${section}`), `lecture de ${section}`);
  return req.put(`/api/settings/${section}`, {
    headers: { 'X-CSRF-Token': csrf, 'If-Match': String(lu.version) },
    data: valeurs,
  });
}

/** Périmètre restreint créé une fois, rattaché au périmètre commun. */
async function perimetreRestreint(req: APIRequestContext, csrf: string, name: string, scope: string): Promise<string> {
  const smsis = await okJson<{ id: string; name: string }[]>(await req.get('/api/grc/smsis'), 'liste des périmètres');
  const existant = smsis.find((s) => s.name === name);
  if (existant) return existant.id;
  const cree = await okJson<{ id: string }>(
    await req.post('/api/grc/smsis', {
      headers: { 'X-CSRF-Token': csrf },
      data: { name, scope, parentId: PERIMETRE_COMMUN, timezone: 'Europe/Paris' },
    }),
    `création du périmètre restreint « ${name} »`,
  );
  return cree.id;
}
const perimetreCampagne = (req: APIRequestContext, csrf: string) =>
  perimetreRestreint(req, csrf, PERIMETRE_CAMPAGNE, 'Hébergement de données de santé du groupement (fictif)');
/** Périmètre voisin du périmètre de campagne (même parent) : celui du contributeur. */
const perimetreVoisin = (req: APIRequestContext, csrf: string) =>
  perimetreRestreint(req, csrf, PERIMETRE_VOISIN, 'Activités voisines du groupement, hors hébergement (fictif)');

const idCompte = async (req: APIRequestContext, username: string) =>
  liste(
    await okJson<{ id: string; username: string }[] | { items: { id: string; username: string }[] }>(
      await req.get('/api/admin/users'),
      'liste des comptes',
    ),
  ).find((u) => u.username === username)?.id;

/** Rattachement direct d'un compte de test à un périmètre, par l'administrateur, s'il n'existe pas déjà : la désignation
    ferme les sessions du compte, elle se fait donc avant d'ouvrir la sienne et n'est pas répétée à chaque test. */
async function rattacher(req: APIRequestContext, csrf: string, smsi: string, username: string, write: boolean) {
  const uid = await idCompte(req, username);
  expect(uid, `compte ${username}`).toBeTruthy();
  const membres = await okJson<{ userId: string; write: boolean; herite: boolean }[]>(
    await req.get(`/api/grc/${smsi}/members`),
    `membres du périmètre ${smsi}`,
  );
  if (membres.some((m) => m.userId === uid && !m.herite && m.write === write)) return;
  const r = await req.put(`/api/grc/${smsi}/members`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { userId: uid, write },
  });
  expect(r.ok(), `rattachement de ${username} au périmètre ${smsi} : ${await texteDe(r)}`).toBe(true);
}

/** Compte de rôle créé par l'administrateur puis préparé (TOTP, mot de passe personnel) ; secret gardé dans le dossier
    temporaire des tests pour un second passage. `rattachements` : périmètres où le rattacher avant d'ouvrir sa session. */
const fichierSecret = (u: string) => path.join(os.tmpdir(), `suivi-e2e-campagne-${u}.json`);
async function compte(
  browser: Browser,
  req: APIRequestContext,
  csrf: string,
  username: string,
  corps: Record<string, unknown>,
  rattachements: { smsi: string; write: boolean }[] = [],
) {
  if (!existsSync(fichierSecret(username))) {
    const cree = await okJson<{ temporaryPassword: string }>(
      await req.post('/api/admin/users', { headers: { 'X-CSRF-Token': csrf }, data: { username, ...corps } }),
      `création du compte ${username}`,
    );
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const { secret } = await preparerCompte(ctx, username, cree.temporaryPassword);
      writeFileSync(fichierSecret(username), JSON.stringify({ secret }), { mode: 0o600 });
    } finally {
      await ctx.close();
    }
  }
  for (const a of rattachements) await rattacher(req, csrf, a.smsi, username, a.write);
  const { secret } = JSON.parse(readFileSync(fichierSecret(username), 'utf8')) as { secret: string };
  return sessionCompte(browser, username, secret);
}
/** Contributeur rattaché en écriture au seul périmètre voisin : sans aucun rattachement, un compte ne voit aucun périmètre
    (ADR 0095) et les contrôles visés ne seraient jamais atteints ; rattaché au périmètre commun, il verrait le périmètre de
    campagne, qui en descend (ADR 0092). */
const contributeur = async (browser: Browser, req: APIRequestContext, csrf: string) =>
  compte(
    browser,
    req,
    csrf,
    CONTRIBUTEUR,
    { displayName: 'Contributeur de campagne r56 (fictif)', roles: [{ roleId: 'contributeur' }] },
    [{ smsi: await perimetreVoisin(req, csrf), write: true }],
  );
/** Auditeur externe (module « Incidents et PCA/PRA » seul), rattaché en lecture seule au périmètre commun dont il lit les
    plans (CAMP-T5-03) : sans aucun rattachement, il ne verrait aucun périmètre (ADR 0095). */
async function auditeur(browser: Browser, req: APIRequestContext, csrf: string) {
  const expire = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
  return compte(
    browser,
    req,
    csrf,
    AUDITEUR,
    {
      displayName: 'Auditeur externe de campagne r56 (fictif)',
      roles: [{ roleId: 'auditeur_externe', modules: ['incidents'] }],
      expiresAt: expire,
    },
    [{ smsi: PERIMETRE_COMMUN, write: false }],
  );
}

/** Lecture minimale d'un classeur .xlsx (zip, chaînes en ligne) : texte des cellules de chaque ligne de chaque feuille. */
function lignesClasseur(buf: Buffer): string[][] {
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--;
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const lignes: string[][] = [];
  for (let i = 0; i < n; i++) {
    const methode = buf.readUInt16LE(p + 10),
      taille = buf.readUInt32LE(p + 20),
      lnom = buf.readUInt16LE(p + 28),
      lext = buf.readUInt16LE(p + 30),
      lcom = buf.readUInt16LE(p + 32),
      local = buf.readUInt32LE(p + 42);
    const nom = buf.toString('utf8', p + 46, p + 46 + lnom);
    p += 46 + lnom + lext + lcom;
    if (!/^xl\/worksheets\/.+\.xml$/.test(nom)) continue;
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const brut = buf.subarray(debut, debut + taille);
    const xml = (methode === 8 ? inflateRawSync(brut) : brut).toString('utf8');
    for (const row of xml.match(/<row[\s\S]*?<\/row>/g) ?? [])
      lignes.push(
        [...row.matchAll(/<(?:t|v)(?: [^>]*)?>([\s\S]*?)<\/(?:t|v)>/g)].map((m) =>
          m[1]!
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&'),
        ),
      );
  }
  return lignes;
}

/* ------------------------------------------------------------------------------------- continuité et exercices */

test('CAMP-C5-01 corrigé : la carte d’un périmètre compte tous ses plans de continuité et de reprise', async ({
  browser,
}) => {
  // BUG-043 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 9.1 et A.5.29, A.5.30 : « plans de continuité et de reprise » doit compter PCA, PRA, PCRA et plans
  // d'activité ; le compteur ne lit que planType « pcra » (un périmètre qui n'a qu'un PRA affiche « 0 PCRA »).
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  let pra: Objet | undefined;
  const smsi = await perimetreCampagne(ctx.request, csrf);
  try {
    pra = await creerObjet(ctx.request, csrf, smsi, 'continuity_plan', 'Campagne C5-01 PRA de la plateforme (fictif)', {
      planType: 'pra',
    });
    const plans = liste(
      await okJson<Objet[] | { items: Objet[] }>(
        await ctx.request.get(`/api/grc/${smsi}/objects?kind=continuity_plan`),
        'plans du périmètre',
      ),
    ).filter((o) => !o.archived);
    const cartes = await okJson<{ cartes: { id: string; compteurs: { continuite: Record<string, number> | null } }[] }>(
      await ctx.request.get('/api/grc/perimetres/synthese'),
      'cartes des périmètres',
    );
    const carte = cartes.cartes.find((c) => c.id === smsi);
    expect(carte?.compteurs.continuite, 'compteur de continuité du périmètre').toBeTruthy();
    expect(Object.values(carte!.compteurs.continuite!)).toContain(plans.length);
  } finally {
    await archiver(ctx.request, csrf, smsi, pra);
    await ctx.close();
  }
});

test('CAMP-C5-03 corrigé : une fiche d’exercice saisie par erreur peut être archivée depuis l’écran', async ({
  browser,
}) => {
  // BUG-052 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 7.5.3 : le registre « Exercices et RETEX » (comme « Continuité et reprise ») n'offre ni dans le
  // menu de ligne ni dans la fiche de commande d'archivage, alors que l'API sait archiver (DELETE …/objects/:id).
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const nom = 'Campagne C5-03 exercice saisi par erreur (fictif)';
  let fiche: Objet | undefined;
  try {
    fiche = await creerObjet(ctx.request, csrf, PERIMETRE_COMMUN, 'continuity_exercise', nom, {
      plannedAt: '2027-03-10',
    });
    await page.goto(`/pilotage/exercices?perimetre=${PERIMETRE_COMMUN}`);
    // La PR #269 place la commande dans la fiche (« Archiver la fiche » de l'éditeur commun, comme pour CAMP-C1-03), pas
    // dans le menu « Autres actions » de la ligne : le test ouvre la fiche, archive et vérifie l'archivage.
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await ligne.getByRole('button', { name: 'Ouvrir', exact: true }).click();
    const dialogue = page.getByRole('dialog', { name: 'Fiche — Exercice et retour d’expérience' });
    await expect(dialogue.getByRole('textbox', { name: 'Intitulé' })).toHaveValue(nom);
    await dialogue.getByRole('button', { name: 'Archiver la fiche' }).click();
    await dialogue.getByRole('alert').getByRole('button', { name: 'Confirmer l’archivage' }).click();
    await expect(dialogue).toBeHidden();
    await expect(ligne).toHaveCount(0);
    const relu = await okJson<Objet>(
      await ctx.request.get(`/api/grc/${PERIMETRE_COMMUN}/objects/${fiche.id}`),
      'relecture de la fiche',
    );
    expect(relu.archived, 'fiche archivée').toBe(true);
    fiche = undefined;
  } finally {
    await archiver(ctx.request, csrf, PERIMETRE_COMMUN, fiche);
    await ctx.close();
  }
});

test('CAMP-C5-04 corrigé : un exercice planifié du registre peut être lié à une cellule de crise', async ({
  browser,
}) => {
  // BUG-066 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, A.5.30 et traçabilité : la cellule de crise ne propose que les exercices du registre historique
  // (« Plan d'exercices PRA et crise ») ; un exercice planifié du registre « Exercices et RETEX » n'est jamais proposé.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const nom = 'Campagne C5-04 exercice de bascule planifié (fictif)';
  let fiche: Objet | undefined;
  try {
    fiche = await creerObjet(ctx.request, csrf, PERIMETRE_COMMUN, 'continuity_exercise', nom, {
      plannedAt: '2027-02-10',
    });
    const vue = await okJson<{ exercices: { id: string; title: string }[] }>(
      await ctx.request.get('/api/crise'),
      'vue de la cellule de crise',
    );
    expect(vue.exercices.map((e) => e.title)).toContain(nom);
  } finally {
    await archiver(ctx.request, csrf, PERIMETRE_COMMUN, fiche);
    await ctx.close();
  }
});

/* ------------------------------------------------------------------------------------------- incidents et crise */

test('CAMP-C5-05 corrigé : le responsable d’une action de scénario saisi juste après l’action est enregistré', async ({
  browser,
}) => {
  // BUG-067 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 7.5.3 et A.5.24 : saisir l'action puis son responsable ; l'enregistrement de l'action recrée la
  // ligne (clé qui contient le texte de l'action) et la saisie du responsable disparaît sans message.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const titre = 'Campagne C5-05 scénario de crise (fictif)';
  const responsable = 'Astreinte infrastructure (fictive)';
  let id: string | undefined;
  try {
    id = (
      await okJson<{ id: string }>(
        await ctx.request.post('/api/crise/scenarios', { headers: { 'X-CSRF-Token': csrf } }),
        'création du scénario',
      )
    ).id;
    await okJson(
      await ctx.request.patch(`/api/crise/scenarios/${id}`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { title: titre },
      }),
      'intitulé du scénario',
    );
    await okJson(
      await ctx.request.post(`/api/crise/scenarios/${id}/actions`, { headers: { 'X-CSRF-Token': csrf } }),
      'première action',
    );
    await page.goto('/pilotage/crise-scenarios');
    await page.getByRole('button', { name: `${titre} (1)`, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Scénario', exact: true })).toHaveValue(titre);

    // L'action s'enregistre quand on passe au champ du responsable ; le RSSI tape le responsable pendant ce temps.
    let actionEnregistree = false;
    page.on('response', (r) => {
      if (r.request().method() === 'PATCH' && r.url().endsWith(`/api/crise/scenarios/${id}/actions/0`))
        actionEnregistree = true;
    });
    const relu = page.waitForResponse(
      (r) => actionEnregistree && r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/crise',
    );
    await page.getByRole('textbox', { name: 'Action 1', exact: true }).fill('Isoler le serveur touché (fictif)');
    await page.getByRole('textbox', { name: 'Responsable de l’action 1', exact: true }).fill(responsable);
    await relu;
    const ajout = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith(`/api/crise/scenarios/${id}/actions`),
    );
    await page.getByRole('button', { name: 'Ajouter une action', exact: true }).click();
    expect((await ajout).ok()).toBe(true);

    await expect
      .poll(
        async () => {
          const vue = await okJson<{ etat: { scenarios: { id: string; items: { t: string; owner: string }[] }[] } }>(
            await ctx.request.get('/api/crise'),
            'relecture des scénarios',
          );
          return vue.etat.scenarios.find((s) => s.id === id)?.items[0]?.owner;
        },
        { timeout: 5000 },
      )
      .toBe(responsable);
  } finally {
    if (id) await ctx.request.delete(`/api/crise/scenarios/${id}`, { headers: { 'X-CSRF-Token': csrf } });
    await ctx.close();
  }
});

test('CAMP-C5-06 corrigé : un incident saisi sous un périmètre restreint n’est pas lu par un compte non membre', async ({
  browser,
}) => {
  // BUG-044 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 4.3 et A.5.15 ; HDS v2 (périmètre des activités d'hébergement) : les incidents, RETEX et cellules
  // n'ont pas de périmètre ; l'incident saisi avec le périmètre restreint affiché est lu par tout contributeur.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const titre = 'Campagne C5-06 coupure du lien du site d’hébergement (fictif)';
  const temoin = 'Campagne C5-06 incident du périmètre voisin (fictif)';
  let id: string | undefined;
  let idTemoin: string | undefined;
  const smsi = await perimetreCampagne(ctx.request, csrf);
  const contrib = await contributeur(browser, ctx.request, csrf);
  const cctx = await browser.newContext({ storageState: contrib.state });
  try {
    const nonMembre = await cctx.request.get(`/api/grc/${smsi}/objects?kind=continuity_plan`);
    expect(nonMembre.status(), 'le contributeur n’est pas membre du périmètre restreint').toBe(404);
    // Témoin : le contributeur lit bien les incidents de son propre périmètre (voisin). Sans lui, un compte qui ne lit aucun
    // incident (compte sans rattachement, ADR 0095) ferait passer le test sans rien prouver.
    idTemoin = (await creerIncident(ctx.request, csrf, temoin, await perimetreVoisin(ctx.request, csrf))).id;
    const siens = await okJson<{ incidents: Incident[] }>(await cctx.request.get('/api/incidents'), 'incidents lus');
    expect(
      siens.incidents.map((i) => i.title),
      'incident du périmètre du contributeur',
    ).toContain(temoin);

    // Saisie par l'écran, le périmètre restreint étant affiché : « Nouvel incident » crée une fiche vide et l'ouvre en
    // page du registre (ADR 0091).
    await page.goto(`/pilotage/incidents-registre?perimetre=${smsi}`);
    await expect(page.getByRole('combobox', { name: 'Périmètre affiché' })).toHaveValue(PERIMETRE_CAMPAGNE);
    const [cree] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/incidents')),
      page.getByRole('button', { name: 'Nouvel incident', exact: true }).click(),
    ]);
    expect(cree.ok(), `création de l’incident par l’écran : ${cree.status()} ${await cree.text()}`).toBe(true);
    id = ((await cree.json()) as { id: string }).id;
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${id} — `) })).toBeVisible();
    const enregistre = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/incidents/${id}`),
    );
    await page.getByRole('textbox', { name: 'Intitulé', exact: true }).fill(titre);
    await page.getByRole('textbox', { name: 'Signalé par', exact: true }).click();
    expect((await enregistre).ok()).toBe(true);

    const vue = await okJson<{ incidents: Incident[] }>(await cctx.request.get('/api/incidents'), 'incidents lus');
    expect(vue.incidents.map((i) => i.title)).not.toContain(titre);
  } finally {
    await supprimerIncident(ctx.request, csrf, id);
    await supprimerIncident(ctx.request, csrf, idTemoin);
    await cctx.close();
    await ctx.close();
  }
});

test('CAMP-C5-11 corrigé : sans gravité saisie, le RETEX d’un incident critique n’affiche pas « Faible »', async ({
  browser,
}) => {
  // BUG-045 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // A.5.27 ; AGENTS.md (aucun chiffre inventé) : un événement sans gravité reçoit « Faible (reportée) » et la gravité
  // maximale du RETEX vaut « Faible » pour un incident d'impact et d'urgence « Élevé » (priorité P1 Critique).
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  let id: string | undefined;
  try {
    const inc = await creerIncident(ctx.request, csrf, 'Campagne C5-11 rançongiciel sur un serveur (fictif)');
    id = inc.id;
    await okJson(
      await ctx.request.patch(`/api/incidents/${id}`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { kind: 'Incident de sécurité', impact: 'Élevé', urgency: 'Élevé' },
      }),
      'qualification P1 de l’incident',
    );
    await okJson(
      await ctx.request.post(`/api/incidents/${id}/retex`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { ts: ilYaUnAn(), type: 'Détection', titre: 'Campagne C5-11 alerte EDR (fictif)', gravite: '' },
      }),
      'événement sans gravité',
    );
    await page.goto(`/pilotage/incidents-retex?incident=${id}`);
    await expect(page.getByRole('row', { name: /Campagne C5-11 alerte EDR \(fictif\)/ })).toBeVisible();
    const graviteMax = page.locator('dt', { hasText: /^Gravité maximale$/ }).locator('xpath=following-sibling::dd[1]');
    await expect(graviteMax).toBeVisible();
    await expect(graviteMax).not.toHaveText('Faible', { timeout: 5000 });
  } finally {
    await supprimerIncident(ctx.request, csrf, id);
    await ctx.close();
  }
});

test('CAMP-C5-18 corrigé : une crise réelle ouverte est annoncée sur le tableau de bord', async ({ browser }) => {
  // BUG-069 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // A.5.26, A.5.29 : l'écran annonce « bandeau rouge sur le tableau de bord et dans le menu jusqu'à la clôture » ; aucun
  // bandeau n'existe.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  let id: string | undefined;
  try {
    id = (
      await okJson<{ id: string }>(
        await ctx.request.post('/api/crise/cellules', {
          headers: { 'X-CSRF-Token': csrf },
          data: { mode: 'Réel', title: 'Campagne C5-18 crise réelle (fictive)' },
        }),
        'ouverture de la cellule de crise réelle',
      )
    ).id;
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/crise réelle/i).first()).toBeVisible({ timeout: 5000 });
  } finally {
    if (id)
      await ctx.request.post(`/api/crise/cellules/${id}/cloture`, { headers: { 'X-CSRF-Token': csrf }, data: {} });
    await ctx.close();
  }
});

test('CAMP-C5-19 corrigé : les incidents de sécurité remontent dans la synthèse du SMSI', async ({ browser }) => {
  // BUG-070 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 9.1 et 9.3.2 ; A.5.27 : ni le tableau de bord, ni la synthèse, ni le mur, ni le rapport de pilotage
  // ne comptent les incidents ; l'écran du registre annonce pourtant une diapositive « Revue des incidents ».
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  let id: string | undefined;
  try {
    id = (await creerIncident(ctx.request, csrf, 'Campagne C5-19 incident de sécurité ouvert (fictif)')).id;
    await okJson(
      await ctx.request.patch(`/api/incidents/${id}`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { kind: 'Incident de sécurité', impact: 'Élevé', urgency: 'Élevé' },
      }),
      'qualification de l’incident',
    );
    const synthese = await okJson<Record<string, unknown>>(await ctx.request.get('/api/mur/synthese'), 'synthèse');
    expect(Object.keys(synthese).filter((k) => /incident/i.test(k))).not.toEqual([]);
  } finally {
    await supprimerIncident(ctx.request, csrf, id);
    await ctx.close();
  }
});

test('CAMP-T5-02 corrigé : un contributeur ne retire pas un événement de la chronologie RETEX', async ({ browser }) => {
  // BUG-050 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // A.5.27, A.5.28 et 7.5.3 ; rôle Contributeur « lire et modifier » : DELETE /api/incidents/:id/retex/:eid n'exige que
  // incidents:modifier, alors que la suppression d'un incident exige incidents:supprimer ; le journal ne garde pas le
  // contenu retiré.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  let id: string | undefined;
  const contrib = await contributeur(browser, ctx.request, csrf);
  const cctx = await browser.newContext({ storageState: contrib.state });
  try {
    // Incident du périmètre où le contributeur est rattaché en écriture (sans rattachement : 404 « Incident absent. »).
    const voisin = await perimetreVoisin(ctx.request, csrf);
    id = (await creerIncident(ctx.request, csrf, 'Campagne T5-02 incident pour le RETEX (fictif)', voisin)).id;
    const avec = await okJson<Incident>(
      await cctx.request.post(`/api/incidents/${id}/retex`, {
        headers: { 'X-CSRF-Token': contrib.csrf },
        data: { ts: ilYaUnAn(), type: 'Détection', titre: 'Campagne T5-02 détection (fictif)', gravite: '' },
      }),
      'événement ajouté par le contributeur',
    );
    const ev = avec.timeline.find((e) => e.titre === 'Campagne T5-02 détection (fictif)');
    expect(ev, 'événement présent').toBeTruthy();
    const r = await cctx.request.delete(`/api/incidents/${id}/retex/${ev!.id}`, {
      headers: { 'X-CSRF-Token': contrib.csrf },
    });
    expect(r.status(), await r.text()).toBe(403);
  } finally {
    await supprimerIncident(ctx.request, csrf, id);
    await cctx.close();
    await ctx.close();
  }
});

test('CAMP-T5-03 corrigé : le module « Incidents et PCA/PRA » donne la lecture des PCA/PRA', async ({ browser }) => {
  // BUG-076 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // A.5.15, A.5.18, A.5.29 : un auditeur externe à qui l'on ouvre le seul module « Incidents et PCA/PRA » reçoit 403
  // « pilotage:lire » sur les plans de continuité : il faut lui ouvrir tout le Pilotage du SMSI.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  // L'auditeur est rattaché en lecture seule au périmètre commun (voir `auditeur`) : sans rattachement, il ne voit aucun
  // périmètre (ADR 0095) et recevrait 404 avant le contrôle du module.
  const aud = await auditeur(browser, ctx.request, csrf);
  const actx = await browser.newContext({ storageState: aud.state });
  try {
    await okJson(await actx.request.get('/api/incidents'), 'lecture des incidents par l’auditeur');
    const r = await actx.request.get(`/api/grc/${PERIMETRE_COMMUN}/objects?kind=continuity_plan`);
    expect(r.status(), await r.text()).toBe(200);
  } finally {
    await actx.close();
    await ctx.close();
  }
});

/* -------------------------------------------------------------------------------------------- exports et périmètre */

test('CAMP-C5-15 corrigé : l’export Excel garde la classification « Piste de progrès » de l’écart', async ({
  browser,
}) => {
  // BUG-046 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 10.2 et traçabilité : l'export « Écarts et actions » traduit le code PP par « Point sensible »,
  // alors que l'application (modèle, tableau de bord) l'affiche « Piste de progrès ».
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const nom = 'Campagne C5-15 piste de progrès sur la journalisation (fictif)';
  let ecart: Objet | undefined;
  try {
    ecart = await creerObjet(ctx.request, csrf, PERIMETRE_COMMUN, 'nonconformity', nom, {
      findingType: 'opportunity',
      source: 'Interne',
    });
    const r = await ctx.request.get('/api/suivi/export?groupe=ec&mode=std');
    expect(r.ok(), await texteDe(r)).toBe(true);
    const lignes = lignesClasseur(await r.body()).filter((l) => l.includes(nom));
    expect(lignes.length, 'ligne de l’écart dans l’export').toBeGreaterThan(0);
    for (const l of lignes) expect(l).toContain('Piste de progrès');
  } finally {
    await archiver(ctx.request, csrf, PERIMETRE_COMMUN, ecart);
    await ctx.close();
  }
});

test('CAMP-C5-16 corrigé : l’export complet contient les plans de continuité', async ({ browser }) => {
  // BUG-058 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 7.5 ; scénario, étape 17 : « Export complet » ne lit que le registre historique ; plans de
  // continuité, exercices du registre, RETEX, scénarios, documents, risques et revues n'y figurent pas.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const nom = 'Campagne C5-16 PRA du site principal (fictif)';
  let plan: Objet | undefined;
  try {
    plan = await creerObjet(ctx.request, csrf, PERIMETRE_COMMUN, 'continuity_plan', nom, { planType: 'pra' });
    const r = await ctx.request.get('/api/suivi/export?groupe=all&mode=std');
    expect(r.ok(), await texteDe(r)).toBe(true);
    expect(lignesClasseur(await r.body()).some((l) => l.includes(nom))).toBe(true);
  } finally {
    await archiver(ctx.request, csrf, PERIMETRE_COMMUN, plan);
    await ctx.close();
  }
});

test('CAMP-C5-17 corrigé : choisir de nouveau le périmètre affiché ne change pas de périmètre', async ({ browser }) => {
  // BUG-068 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 4.3 : la liste « Périmètre affiché » désélectionne l'option déjà choisie et retombe sur le
  // périmètre racine (l'adresse garde le sous-périmètre) ; une saisie part alors dans le mauvais périmètre.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  try {
    const smsi = await perimetreCampagne(ctx.request, csrf);
    await page.goto(`/pilotage/continuite?perimetre=${smsi}`);
    const perimetre = page.getByRole('combobox', { name: 'Périmètre affiché' });
    await expect(perimetre).toHaveValue(PERIMETRE_CAMPAGNE);
    await perimetre.click();
    await page.getByRole('option', { name: PERIMETRE_CAMPAGNE, exact: true }).click();
    await expect(perimetre).toHaveValue(PERIMETRE_CAMPAGNE, { timeout: 5000 });
  } finally {
    await ctx.close();
  }
});

/* ------------------------------------------------------------------------------------- Plateforme et Système */

test('CAMP-C6-04 corrigé : la fenêtre Référentiels affiche le référentiel complémentaire actif', async ({
  browser,
}) => {
  // BUG-047 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // Traçabilité du référentiel appliqué : `activeFw` vaut un identifiant (« recyf-2.5 ») mais la liste ne propose que des
  // noms ; elle s'affiche vide, et l'enregistrer tel quel désactive ReCyF dans le socle.
  const { state } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  try {
    const lu = await okJson<{ values: { activeFw: string } }>(
      await ctx.request.get('/api/settings/referentiels'),
      'réglages des référentiels',
    );
    expect(lu.values.activeFw, 'un référentiel complémentaire est actif').not.toBe('');
    await page.goto('/plateforme/referentiels');
    const fenetre = page.getByRole('dialog', { name: 'Référentiels' });
    await expect(fenetre.getByRole('combobox', { name: 'Catégorie d’entité (NIS 2)' })).toBeVisible();
    await expect(fenetre.getByRole('combobox', { name: 'Référentiel complémentaire actif' })).not.toHaveValue('', {
      timeout: 5000,
    });
  } finally {
    await ctx.close();
  }
});

test('CAMP-C6-05 corrigé : la catégorie NIS 2 peut être remise à « Non renseignée »', async ({ browser }) => {
  // BUG-048 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 7.5.3 et A.8.15 : la valeur vide est acceptée (200, « enregistré ») mais la catégorie précédente
  // revient ; le journal d'audit consigne pourtant le passage à la valeur vide.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  try {
    const lu = await okJson<{ values: { activeFw: string } }>(
      await ctx.request.get('/api/settings/referentiels'),
      'réglages des référentiels',
    );
    await okJson(
      await ecrireReglage(ctx.request, csrf, 'referentiels', {
        activeFw: lu.values.activeFw,
        entityCategory: 'importante',
      }),
      'catégorie « Entité importante »',
    );
    const vide = await ecrireReglage(ctx.request, csrf, 'referentiels', {
      activeFw: lu.values.activeFw,
      entityCategory: '',
    });
    expect(vide.ok(), await texteDe(vide)).toBe(true);
    const relu = await okJson<{ values: { entityCategory: string } }>(
      await ctx.request.get('/api/settings/referentiels'),
      'relecture des référentiels',
    );
    expect(relu.values.entityCategory).toBe('');
  } finally {
    await ctx.close();
  }
});

test('CAMP-C6-12 corrigé : la revue des accès indique les périmètres accessibles de chaque compte', async ({
  browser,
}) => {
  // BUG-071 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, A.5.15 et A.5.18 ; HDS : l'export « Revue des accès » (CSV et Excel) n'a ni colonne ni mention
  // des périmètres lisibles ou modifiables, alors que l'accès au périmètre restreint est attribué au compte.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  try {
    const smsi = await perimetreCampagne(ctx.request, csrf);
    await auditeur(browser, ctx.request, csrf);
    const uid = await idCompte(ctx.request, AUDITEUR);
    expect(uid, 'compte de l’auditeur').toBeTruthy();
    const acces = await ctx.request.put(`/api/grc/${smsi}/members`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { userId: uid, write: false },
    });
    expect(acces.ok(), `accès en lecture au périmètre restreint : ${await texteDe(acces)}`).toBe(true);
    const r = await ctx.request.get('/api/admin/access-review?format=csv');
    expect(r.ok(), await texteDe(r)).toBe(true);
    const ligne = (await r.text()).split(/\r?\n/).find((l) => l.startsWith(`"${AUDITEUR}"`));
    expect(ligne, 'ligne du compte dans la revue').toBeTruthy();
    expect(ligne).toContain(PERIMETRE_CAMPAGNE);
  } finally {
    await ctx.close();
  }
});

test('CAMP-C6-21 corrigé : une date de test de restauration dans le futur est refusée', async ({ browser }) => {
  // BUG-072 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, A.8.13 ; guide d'installation, étape 11.4 : une date future est enregistrée et fait disparaître
  // l'alerte « Test de restauration à faire ».
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const avant = await okJson<{ values: Record<string, unknown> }>(
    await ctx.request.get('/api/settings/sauvegardes'),
    'réglages des sauvegardes',
  );
  let modifie = false;
  try {
    const futur = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    const r = await ecrireReglage(ctx.request, csrf, 'sauvegardes', {
      ...avant.values,
      dernierTestRestauration: futur,
    });
    modifie = r.ok();
    expect(r.status(), await r.text()).toBe(422);
  } finally {
    if (modifie) await ecrireReglage(ctx.request, csrf, 'sauvegardes', avant.values);
    await ctx.close();
  }
});

test('CAMP-C6-22 corrigé : une version de l’état contient l’état qu’elle date', async ({ browser }) => {
  // BUG-073 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 7.5.3 ; AGENTS.md (aucune promesse que l'outil ne tient pas) : chaque version est enregistrée sans
  // les modules repris dans des tables ; « Télécharger » rend {} et « Restaurer » n'a rien à restaurer.
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  let id: string | undefined;
  try {
    id = (await creerIncident(ctx.request, csrf, 'Campagne C6-22 incident daté par une version (fictif)')).id;
    const versions = await okJson<{ version: number }[]>(await ctx.request.get('/api/admin/versions'), 'versions');
    expect(versions.length, 'au moins une version').toBeGreaterThan(0);
    const derniere = Math.max(...versions.map((v) => v.version));
    const contenu = await okJson<Record<string, unknown>>(
      await ctx.request.get(`/api/admin/versions/${derniere}`),
      `version ${derniere}`,
    );
    expect(Object.keys(contenu)).not.toEqual([]);
  } finally {
    await supprimerIncident(ctx.request, csrf, id);
    await ctx.close();
  }
});
