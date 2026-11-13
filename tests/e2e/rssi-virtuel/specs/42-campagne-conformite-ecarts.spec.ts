/* Campagne de recette multi-agent du 12/11/2026, rejeu des piles 3 et 4 (docs/05_RECETTE/rssi-virtuel/campagne/
   rejeu-piles-3-4.md) : défauts bloquants et majeurs de la conformité (DdA, couverture, référentiels), des écarts, des plans
   annuels, de la revue de direction et des droits sur les registres. Chaque test décrit le comportement attendu et porte un
   marqueur test.fail tant que le constat est ouvert : il devient rouge une fois le défaut corrigé, ce qui oblige à retirer
   le marqueur. Le fichier ne dépend que de l'installation : il crée ses données fictives (préfixe « Campagne »), son
   sous-périmètre et son compte contributeur, et remet la DdA dans l'état trouvé. */
import { expect, test, type APIRequestContext, type Browser, type BrowserContext } from '@playwright/test';
import { csrfOf, preparerCompte, sessionAdmin } from '../../helpers';
import { PERIMETRE_COMMUN } from '../invariants';

const SOUS_PERIMETRE = 'Campagne hébergement HDS (fictif)';
const ISO = 'iso-27001-2022';

type Ligne = { app: string; level: string; just: string };
type PageDda = { mesures: { id: string }[]; dda: Record<string, Ligne>; ecarts: { id: string; items: string[] }[] };

async function admin(browser: Browser) {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  return { ctx, rq: ctx.request, csrf };
}
const entetes = (csrf: string, version?: number | string) => ({
  'X-CSRF-Token': csrf,
  ...(version !== undefined ? { 'If-Match': `"${version}"` } : {}),
});

async function lireDda(rq: APIRequestContext): Promise<PageDda> {
  const r = await rq.get('/api/dda?reference=A');
  expect(r.ok(), await r.text()).toBe(true);
  return (await r.json()) as PageDda;
}
/** Mesure de l'annexe A encore non examinée : condition de départ des tests qui l'écrivent puis la remettent à vide. */
async function exigerNonExaminee(rq: APIRequestContext, mesure: string) {
  const page = await lireDda(rq);
  expect(
    page.mesures.map((m) => m.id),
    `${mesure} est une mesure de l’annexe A`,
  ).toContain(mesure);
  const l = page.dda[mesure];
  expect(`${l?.app ?? ''}|${l?.level ?? ''}|${l?.just ?? ''}`, `${mesure} doit être non examinée au départ`).toBe('||');
}
async function ecrireDda(rq: APIRequestContext, csrf: string, mesure: string, ligne: Partial<Ligne>) {
  return rq.patch(`/api/dda/${mesure}`, { data: ligne, headers: entetes(csrf) });
}
async function remettreAVide(rq: APIRequestContext, mesure: string) {
  const r = await ecrireDda(rq, await csrfOf(rq), mesure, { app: '', level: '', just: '' });
  expect(r.ok(), `remise à vide de ${mesure} : ${await r.text()}`).toBe(true);
}

/** Sous-périmètre fictif rattaché à la racine, qui hérite des référentiels du parent (créé une fois, puis réutilisé). */
async function sousPerimetre(rq: APIRequestContext, csrf: string): Promise<string> {
  const liste = (await (await rq.get('/api/grc/smsis')).json()) as { id: string; name: string }[];
  const existant = liste.find((s) => s.name === SOUS_PERIMETRE);
  if (existant) return existant.id;
  const r = await rq.post('/api/grc/smsis', {
    headers: entetes(csrf),
    data: {
      name: SOUS_PERIMETRE,
      scope: 'Activités d’hébergement de données de santé (périmètre fictif de la campagne)',
      parentId: PERIMETRE_COMMUN,
      inheritFrameworks: true,
      timezone: 'Europe/Paris',
    },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return ((await r.json()) as { id: string }).id;
}

/** ISO/IEC 27001:2022 ajouté à la bibliothèque (standard de l'outil de suivi), attribué et appliqué à la racine. */
let isoRattacheParCeFichier = false;
async function isoAppliqueALaRacine(rq: APIRequestContext, csrf: string): Promise<{ id: string; version: number }> {
  const adoption = await rq.post('/api/library/standards/adopt', { headers: entetes(csrf), data: { identifier: ISO } });
  expect(adoption.ok(), await adoption.text()).toBe(true);
  const { id, version } = (await adoption.json()) as { id: string; version: number };
  const rattaches = (await (await rq.get(`/api/grc/${PERIMETRE_COMMUN}/framework-attachments`)).json()) as {
    frameworkId: string;
    statut: string;
  }[];
  if (!rattaches.some((a) => a.frameworkId === id && a.statut === 'applique')) {
    const r = await rq.put(`/api/grc/${PERIMETRE_COMMUN}/framework-attachments/${id}`, {
      headers: entetes(csrf),
      data: { version, statut: 'applique', confirm: 'RATTACHER' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    isoRattacheParCeFichier = true;
  }
  return { id, version };
}

/** Archive une fiche du Pilotage (écart, revue) créée par le test, à sa version courante. */
async function archiverFiche(rq: APIRequestContext, smsi: string, id: string) {
  const r = await rq.get(`/api/grc/${smsi}/objects/${id}`);
  if (!r.ok()) return;
  const o = (await r.json()) as { version: number; archived: boolean };
  if (o.archived) return;
  const d = await rq.delete(`/api/grc/${smsi}/objects/${id}`, { headers: entetes(await csrfOf(rq), o.version) });
  expect(d.ok(), `archivage de la fiche de test : ${await d.text()}`).toBe(true);
}

/** Compte au rôle prédéfini Contributeur, créé par l'administrateur et préparé (TOTP, mot de passe personnel) une fois. */
let contributeur: Promise<BrowserContext> | undefined;
function compteContributeur(browser: Browser): Promise<BrowserContext> {
  contributeur ??= (async () => {
    const { ctx, rq, csrf } = await admin(browser);
    const username = `campagne-contrib-${Date.now().toString(36)}`;
    try {
      const r = await rq.post('/api/admin/users', {
        headers: entetes(csrf),
        data: { username, displayName: 'Contributeur de la campagne (fictif)', roles: [{ roleId: 'contributeur' }] },
      });
      expect(r.status(), await r.text()).toBe(201);
      const temp = (await r.json()).temporaryPassword as string;
      const c = await browser.newContext({ ignoreHTTPSErrors: true });
      await preparerCompte(c, username, temp);
      return c;
    } finally {
      await ctx.close();
    }
  })();
  return contributeur;
}

test.afterAll(async ({ browser }) => {
  await (await contributeur?.catch(() => undefined))?.close();
  if (!isoRattacheParCeFichier) return;
  // Le référentiel attribué pour ces tests est détaché, pour ne pas changer les écrans des fichiers suivants.
  const { ctx, rq, csrf } = await admin(browser);
  try {
    const lib = (await (await rq.get('/api/library/frameworks')).json()) as { id: string; identifier: string }[];
    const iso = lib.find((f) => f.identifier === ISO);
    if (iso) {
      const r = await rq.delete(`/api/grc/${PERIMETRE_COMMUN}/framework-attachments/${iso.id}`, {
        headers: entetes(csrf),
      });
      if (!r.ok()) test.info().annotations.push({ type: 'nettoyage', description: `ISO non détaché : ${r.status()}` });
    }
  } finally {
    await ctx.close();
  }
});

test('CAMP-C4-04 ouvert : un écart d’un sous-périmètre peut être rattaché à une mesure de la DdA', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 9.2.2 et 10.2 (traçabilité mesure → écart). Sous un sous-périmètre qui hérite des référentiels du
  // parent, « Rechercher une référence » de la fiche d'un écart ne propose aucune mesure tant que la DdA repose sur le
  // socle historique (aucun référentiel de la bibliothèque appliqué) : l'écart est enregistré sans référence.
  test.fail(true, 'CAMP-C4-04 ouvert : GET …/sources sous le sous-périmètre ne propose pas A-8.13');
  const { ctx, rq, csrf } = await admin(browser);
  try {
    const sous = await sousPerimetre(rq, csrf);
    // Condition du constat : aucun référentiel de bibliothèque effectif pour le sous-périmètre (sinon ses exigences sont
    // proposées, voir CAMP-C3-06 pour la suite de la chaîne).
    const couv = await rq.get(`/api/grc/${sous}/couverture`);
    expect(couv.ok(), await couv.text()).toBe(true);
    expect(
      ((await couv.json()) as { frameworks: unknown[] }).frameworks,
      'référentiels effectifs du sous-périmètre',
    ).toEqual([]);
    const racine = await rq.get(`/api/grc/${PERIMETRE_COMMUN}/sources?search=Sauvegarde`);
    expect(racine.ok(), await racine.text()).toBe(true);
    const refsRacine = ((await racine.json()) as { items: { ref: string }[] }).items.map((i) => i.ref);
    expect(refsRacine, 'la racine propose la mesure A-8.13 du socle').toContain('legacy:items:A-8.13');

    const r = await rq.get(`/api/grc/${sous}/sources?search=Sauvegarde`);
    expect(r.ok(), await r.text()).toBe(true);
    const refs = ((await r.json()) as { items: { ref: string }[] }).items.map((i) => i.ref);
    expect(
      refs.some((ref) => /(^|:)A-8\.13$/.test(ref)),
      `références proposées sous le sous-périmètre : ${JSON.stringify(refs)}`,
    ).toBe(true);
  } finally {
    await ctx.close();
  }
});

test('CAMP-C3-01 ouvert : une décision de DdA prise sous un sous-périmètre ne modifie pas la DdA de la racine', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 6.1.3 d) ; HDS v2 (périmètre des activités d'hébergement). La DdA est un registre historique unique
  // de l'organisation (GET /api/dda sans périmètre) affiché derrière le sélecteur « Périmètre affiché » : une décision
  // prise sous le sous-périmètre se retrouve sous la racine. Attendu : une DdA par périmètre (héritée ou propre), ou une
  // page sans sélecteur trompeur qui dit que la DdA est commune.
  test.fail(true, 'CAMP-C3-01 ouvert : A.6.7 « Oui » choisi sous le sous-périmètre apparaît sous la racine');
  const { ctx, rq, csrf } = await admin(browser);
  const page = await ctx.newPage();
  try {
    const sous = await sousPerimetre(rq, csrf);
    await exigerNonExaminee(rq, 'A-6.7');
    await page.goto(`/pilotage/dda-annexe-a?perimetre=${sous}`);
    await expect(page.getByRole('heading', { name: 'Annexe A (DdA)', level: 1 })).toBeVisible();
    const applicabilite = page.getByRole('combobox', { name: 'Applicabilité de A.6.7', exact: true });
    const enregistrement = page.waitForResponse(
      (r) => r.url().endsWith('/api/dda/A-6.7') && r.request().method() === 'PATCH',
    );
    await applicabilite.click();
    await page.getByRole('option', { name: 'Oui', exact: true }).click();
    expect((await enregistrement).ok(), 'enregistrement sous le sous-périmètre').toBe(true);

    const lecture = page.waitForResponse((r) => r.url().includes('/api/dda?reference=A') && r.ok());
    await page.goto(`/pilotage/dda-annexe-a?perimetre=${PERIMETRE_COMMUN}`);
    await lecture;
    const ligne = page.getByRole('combobox', { name: 'Applicabilité de A.6.7', exact: true });
    await expect(ligne).toBeVisible();
    const selecteur = await page.getByRole('combobox', { name: 'Périmètre affiché' }).count();
    const valeur = await ligne.inputValue();
    expect(
      selecteur === 0 || valeur === '',
      `sous la racine, A.6.7 vaut « ${valeur} » alors que le choix a été fait sous « ${SOUS_PERIMETRE} »`,
    ).toBe(true);
  } finally {
    await remettreAVide(rq, 'A-6.7');
    await ctx.close();
  }
});

test('CAMP-C4-02 ouvert : une action de plan saisie sous un sous-périmètre n’apparaît pas dans le plan de la racine', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 4.3, 7.2 et 7.3 ; HDS (périmètre des activités d'hébergement). Les plans annuels (formation,
  // sensibilisation, audit interne) sont lus par GET /api/plans, sans périmètre : ce qui est saisi sous un périmètre
  // apparaît sous tous les autres.
  test.fail(true, 'CAMP-C4-02 ouvert : action de sensibilisation du sous-périmètre listée sous la racine');
  const { ctx, rq, csrf } = await admin(browser);
  const page = await ctx.newPage();
  const titre = 'Campagne C4-02 sensibilisation saisie sous le sous-périmètre (fictif)';
  try {
    const sous = await sousPerimetre(rq, csrf);
    await page.goto(`/pilotage/plans-sensibilisation?perimetre=${sous}`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const fiche = page.getByRole('dialog');
    await fiche.getByRole('textbox', { name: 'Intitulé de l’action', exact: true }).fill(titre);
    await fiche.getByRole('textbox', { name: 'Date prévue', exact: true }).fill('2027-03-15');
    await fiche.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Modifications enregistrées.')).toBeVisible();

    const lecture = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/plans' && r.ok());
    await page.goto(`/pilotage/plans-sensibilisation?perimetre=${PERIMETRE_COMMUN}`);
    await lecture;
    await expect(page.getByRole('button', { name: 'Ajouter', exact: true })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(titre.replace(/[()]/g, '\\$&')) })).toHaveCount(0);
  } finally {
    const plans = (await (await rq.get('/api/plans')).json()) as { plans: { id: string; title: string }[] };
    for (const p of plans.plans.filter((x) => x.title === titre)) {
      const d = await rq.delete(`/api/plans/${p.id}`, { headers: entetes(await csrfOf(rq)) });
      expect(d.ok(), `suppression de ${p.id} : ${await d.text()}`).toBe(true);
    }
    await ctx.close();
  }
});

test('CAMP-C4-05 ouvert : un périmètre enfant sans héritage des référentiels a sa propre revue de direction', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 9.3.2. Arbitrage du RSSI du 13/11/2026 (BUG-042) : chaque périmètre enfant a sa propre revue, sauf
  // s'il hérite des référentiels du parent (ses entrées remontent alors dans la revue du parent, test suivant). Sous un
  // périmètre enfant, la page « Revues de direction » n'a ni bandeau « Préparer la prochaine revue » ni entrées 9.3.2 :
  // l'API répond « Ces données appartiennent au pilotage commun. ».
  test.fail(true, 'CAMP-C4-05 ouvert : GET …/pilotage/revue/entrees répond 404 sous un périmètre enfant');
  const { ctx, rq, csrf } = await admin(browser);
  try {
    const nom = 'Campagne C4-05 périmètre enfant sans héritage (fictif)';
    const liste = (await (await rq.get('/api/grc/smsis')).json()) as { id: string; name: string }[];
    let enfant = liste.find((s) => s.name === nom)?.id;
    if (!enfant) {
      const c = await rq.post('/api/grc/smsis', {
        headers: entetes(csrf),
        data: {
          name: nom,
          scope: 'Périmètre enfant fictif de la campagne, sans héritage des référentiels',
          parentId: PERIMETRE_COMMUN,
          inheritFrameworks: false,
          timezone: 'Europe/Paris',
        },
      });
      expect(c.ok(), `création du périmètre enfant : ${await c.text()}`).toBe(true);
      enfant = ((await c.json()) as { id: string }).id;
    }
    const r = await rq.get(`/api/grc/${enfant}/pilotage/revue/entrees`);
    expect(r.status(), await r.text()).toBe(200);
  } finally {
    await ctx.close();
  }
});

test('CAMP-C4-05 ouvert : l’entrée 9.3.2 c) de la revue du SMSI compte les écarts ouverts de ses sous-périmètres', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 9.3.2 c) (non-conformités et actions correctives). Arbitrage du RSSI du 13/11/2026 (BUG-042) : un
  // périmètre enfant qui hérite des référentiels du parent n'a pas sa propre revue, ses entrées remontent dans celle du
  // parent. La seule revue préparée (racine) ne compte que les écarts de la racine : une non-conformité majeure ouverte sous le périmètre d'hébergement n'entre dans aucune revue,
  // sans que l'entrée le dise.
  test.fail(true, 'CAMP-C4-05 ouvert : l’écart ouvert du sous-périmètre est absent de l’entrée 9.3.2 c 4 de la racine');
  const { ctx, rq, csrf } = await admin(browser);
  let ecart: string | undefined;
  let sous = '';
  const ouverts = async () => {
    const r = await rq.get(`/api/grc/${PERIMETRE_COMMUN}/pilotage/revue/entrees`);
    expect(r.ok(), await r.text()).toBe(true);
    const c4 = ((await r.json()) as { entrees: { article: string; faits: string[] }[] }).entrees.find(
      (e) => e.article === '9.3.2 c 4',
    );
    const m = /(\d+) ouvert\(s\)/.exec((c4?.faits ?? []).join(' '));
    expect(m, `entrée 9.3.2 c 4 lisible : ${JSON.stringify(c4)}`).not.toBeNull();
    return Number(m![1]);
  };
  try {
    sous = await sousPerimetre(rq, csrf);
    const avant = await ouverts();
    const r = await rq.post(`/api/grc/${sous}/objects`, {
      headers: entetes(csrf),
      data: {
        kind: 'nonconformity',
        name: 'Campagne C4-05 contrat d’infogérance sans clause de localisation (fictif)',
        data: { classification: 'majeure', source: 'Interne', status: 'open' },
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    ecart = ((await r.json()) as { id: string }).id;
    expect(await ouverts()).toBe(avant + 1);
  } finally {
    if (ecart) await archiverFiche(rq, sous, ecart);
    await ctx.close();
  }
});

test('CAMP-C3-04 ouvert : un niveau de mise en œuvre est refusé tant que l’applicabilité n’est pas décidée', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 6.1.3 d) ; AGENTS.md (aucun taux inventé). Choisir « Total » dans « Niveau » d'une mesure non
  // examinée est enregistré : la mesure sort des « Non renseignées », entre dans le filtre « Total » et fait monter le taux.
  test.fail(true, 'CAMP-C3-04 ouvert : PATCH /api/dda/A-5.37 {"level":"Total"} accepté sans applicabilité');
  const { ctx, rq, csrf } = await admin(browser);
  try {
    await exigerNonExaminee(rq, 'A-5.37');
    const r = await ecrireDda(rq, csrf, 'A-5.37', { level: 'Total' });
    const corps = await r.text();
    const ignore = r.ok() && (JSON.parse(corps) as { dda: Ligne }).dda.level === '';
    expect(r.status() === 422 || ignore, `réponse ${r.status()} : ${corps}`).toBe(true);
  } finally {
    await remettreAVide(rq, 'A-5.37');
    await ctx.close();
  }
});

test('CAMP-C3-05 ouvert : enregistrer une fiche d’applicabilité sans rien changer ne décide pas l’applicabilité', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 6.1.3 d) ; prolonge RSSI-13. La fiche « Applicabilité et justifications » d'une mesure jamais
  // examinée montre « Applicable » coché ; « Enregistrer » sans modification écrit app = « oui » dans la DdA, au nom du RSSI.
  test.fail(true, 'CAMP-C3-05 ouvert : A-5.2 passe « oui » après un enregistrement sans modification');
  const { ctx, rq } = await admin(browser);
  const page = await ctx.newPage();
  try {
    await exigerNonExaminee(rq, 'A-5.2');
    await page.goto(`/pilotage/applicabilite?perimetre=${PERIMETRE_COMMUN}`);
    await page
      .getByRole('row')
      .filter({ hasText: 'A-5.2 — Fonctions' })
      .getByRole('button', { name: 'Ouvrir', exact: true })
      .click();
    const fiche = page.getByRole('dialog', { name: 'Fiche — Déclaration d’applicabilité' });
    await expect(fiche.getByRole('checkbox', { name: 'Applicable' })).toBeVisible();
    const enregistrer = page.getByRole('button', { name: 'Enregistrer', exact: true });
    if (await enregistrer.isEnabled()) {
      const ecriture = page
        .waitForResponse((r) => r.url().includes('/pilotage/legacy/dda/A-5.2') && r.request().method() === 'PUT', {
          timeout: 5000,
        })
        .catch(() => null);
      await enregistrer.click();
      await ecriture;
    }
    expect((await lireDda(rq)).dda['A-5.2']?.app ?? '', 'applicabilité de A-5.2 après « Enregistrer »').toBe('');
  } finally {
    await remettreAVide(rq, 'A-5.2');
    await ctx.close();
  }
});

test('CAMP-T3-03 ouvert : au téléphone, la DdA laisse lire le niveau de mise en œuvre', async ({ browser }) => {
  // ISO/IEC 27001:2022, 6.1.3 d) (DdA lisible) ; WCAG 1.4.10 (redistribution à 320 px CSS). En 390 × 844, les listes
  // « Applicabilité » et « Niveau » de la DdA mesurent 52 et 42 px : seules la croix et le chevron sont visibles.
  test.fail(true, 'CAMP-T3-03 ouvert : « Total » tronqué dans « Niveau de A.5.3 » à 390 px');
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 } });
  const rq = ctx.request;
  const page = await ctx.newPage();
  try {
    await exigerNonExaminee(rq, 'A-5.3');
    const r = await ecrireDda(rq, csrf, 'A-5.3', { app: 'oui', level: 'Total', just: 'Campagne T3-03 (fictif)' });
    expect(r.ok(), await r.text()).toBe(true);
    await page.goto(`/pilotage/dda-annexe-a?perimetre=${PERIMETRE_COMMUN}`);
    const niveau = page.getByRole('combobox', { name: 'Niveau de A.5.3', exact: true });
    await expect(niveau).toHaveValue('Total');
    await niveau.scrollIntoViewIfNeeded();
    const mesure = await niveau.evaluate((e) => ({ scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }));
    expect(mesure.scrollWidth <= mesure.clientWidth, `largeurs ${JSON.stringify(mesure)}`).toBe(true);
  } finally {
    await remettreAVide(rq, 'A-5.3');
    await ctx.close();
  }
});

test('CAMP-C3-02 ouvert : la couverture du référentiel reprend une décision prise dans la DdA', async ({ browser }) => {
  // ISO/IEC 27001:2022, 6.1.3 d) ; AGENTS.md (une seule source modifiable par objet). La page DdA annonce que son niveau
  // « alimente la couverture présumée des autres référentiels », mais la couverture de la copie ISO appliquée laisse
  // « À déterminer · Non implémenté » une mesure déclarée applicable et « Total » dans la DdA : double saisie.
  test.fail(true, 'CAMP-C3-02 ouvert : A-6.8 « Total » dans la DdA, « non_implemente » dans la couverture');
  const { ctx, rq, csrf } = await admin(browser);
  try {
    const iso = await isoAppliqueALaRacine(rq, csrf);
    await exigerNonExaminee(rq, 'A-6.8');
    const r = await ecrireDda(rq, csrf, 'A-6.8', { app: 'oui', level: 'Total', just: 'Campagne C3-02 (fictif)' });
    expect(r.ok(), await r.text()).toBe(true);
    const c = await rq.get(`/api/grc/${PERIMETRE_COMMUN}/couverture?frameworkId=${iso.id}`);
    expect(c.ok(), await c.text()).toBe(true);
    const ligne = ((await c.json()) as { detail: { id: string; etat: string }[] }).detail.find((d) => d.id === 'A-6.8');
    expect(ligne, 'exigence A-6.8 dans la couverture de la copie ISO').toBeTruthy();
    expect(['implemente', 'teste', 'valide_metier'], `état de A-6.8 : ${JSON.stringify(ligne)}`).toContain(ligne!.etat);
  } finally {
    await remettreAVide(rq, 'A-6.8');
    await ctx.close();
  }
});

test('CAMP-C3-03 ouvert : « Référentiels et exigences » liste le référentiel appliqué au périmètre', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 6.1.3 et 7.5 ; ADR 0082 (référentiels en copie). ISO/IEC 27001:2022 ajouté, attribué et appliqué
  // à la racine n'est proposé ni par « Référentiel publié » ni par « Référentiel source » (Correspondances entre
  // exigences) : ces écrans ne lisent que les référentiels créés à la main (objets « framework »).
  test.fail(true, 'CAMP-C3-03 ouvert : la copie ISO appliquée est absente de « Référentiel publié »');
  const { ctx, rq, csrf } = await admin(browser);
  const page = await ctx.newPage();
  try {
    await isoAppliqueALaRacine(rq, csrf);
    await page.goto(`/pilotage/referentiels?perimetre=${PERIMETRE_COMMUN}`);
    await expect(page.getByRole('heading', { name: 'Référentiels et exigences', level: 1 })).toBeVisible();
    await page.getByRole('combobox', { name: 'Référentiel publié' }).click();
    await expect(page.getByRole('option', { name: /ISO\/IEC 27001:2022/ }).first()).toBeVisible({ timeout: 5000 });
  } finally {
    await ctx.close();
  }
});

test('CAMP-C3-06 ouvert : un écart rattaché à l’exigence du référentiel est repris par la DdA', async ({ browser }) => {
  // ISO/IEC 27001:2022, 10.2 et 6.1.3 d) (état de mise en œuvre) ; traçabilité mesure → écart. La recherche de la fiche
  // d'écart propose « A-5.24 · 5.24 — … » (référence requirement:…) ; la DdA ne lit que les références historiques
  // legacy:items:… : la mesure reste sans écart et l'indicateur « « Total » avec écart ouvert » à 0.
  test.fail(true, 'CAMP-C3-06 ouvert : écart rattaché à requirement:…:A-5.24 absent des écarts de la DdA');
  const { ctx, rq, csrf } = await admin(browser);
  let ecart: string | undefined;
  try {
    await isoAppliqueALaRacine(rq, csrf);
    expect(
      (await lireDda(rq)).ecarts.filter((e) => e.items.includes('A-5.24')),
      'aucun écart sur A-5.24 au départ',
    ).toEqual([]);
    const s = await rq.get(`/api/grc/${PERIMETRE_COMMUN}/sources?search=5.24`);
    expect(s.ok(), await s.text()).toBe(true);
    const exigence = ((await s.json()) as { items: { ref: string; kind: string; name: string }[] }).items.find(
      (i) => i.kind === 'requirement' && i.name.startsWith('A-5.24 '),
    );
    expect(exigence, 'exigence A-5.24 proposée par la recherche de références').toBeTruthy();
    const r = await rq.post(`/api/grc/${PERIMETRE_COMMUN}/objects`, {
      headers: entetes(csrf),
      data: {
        kind: 'nonconformity',
        name: 'Campagne C3-06 plan de gestion des incidents non testé (fictif)',
        data: { refs: [exigence!.ref], classification: 'mineure', source: 'Interne', status: 'open' },
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    ecart = ((await r.json()) as { id: string }).id;
    const ecarts = (await lireDda(rq)).ecarts;
    expect(
      ecarts.some((e) => e.items.includes('A-5.24')),
      `écarts lus par la DdA : ${JSON.stringify(ecarts)}`,
    ).toBe(true);
  } finally {
    if (ecart) await archiverFiche(rq, PERIMETRE_COMMUN, ecart);
    await ctx.close();
  }
});

test('CAMP-T4-02 ouvert : un contributeur ne peut pas archiver un registre dont il n’est pas gestionnaire', async ({
  browser,
}) => {
  // ADR 0043, point 4 (le gestionnaire archive) ; ADR 0010 et 0068 (un Contributeur ne supprime pas) ; ISO/IEC 27001:2022
  // 7.5.3. Arbitrage du RSSI du 13/11/2026 (BUG-049) : seul le gestionnaire du registre peut l'archiver. Le même compte est refusé (403) pour archiver une seule action, mais archive le registre entier, sans retour
  // possible (aucune commande de désarchivage).
  test.fail(true, 'CAMP-T4-02 ouvert : POST /api/registres/:id/archivage par un contributeur répond 200');
  const { ctx, rq, csrf } = await admin(browser);
  let registre: string | undefined;
  try {
    const c = await rq.post('/api/registres', {
      headers: entetes(csrf),
      data: {
        kind: 'plan_actions',
        name: 'Campagne T4-02 plan créé par l’administrateur (fictif)',
        referenceId: PERIMETRE_COMMUN,
      },
    });
    expect(c.status(), await c.text()).toBe(201);
    const cree = (await c.json()) as { id: string; version: number };
    registre = cree.id;
    const contrib = (await compteContributeur(browser)).request;
    const r = await contrib.post(`/api/registres/${registre}/archivage`, {
      headers: entetes(await csrfOf(contrib), cree.version),
    });
    expect(r.status(), await r.text()).toBe(403);
  } finally {
    if (registre) {
      const g = await rq.get(`/api/registres/${registre}`);
      const reg = (await g.json()) as { archived: boolean; version: number };
      if (g.ok() && !reg.archived) {
        const a = await rq.post(`/api/registres/${registre}/archivage`, { headers: entetes(csrf, reg.version) });
        expect(a.ok(), `archivage du registre de test : ${await a.text()}`).toBe(true);
      }
    }
    await ctx.close();
  }
});

test('CAMP-T4-03 ouvert : un contributeur ne peut pas modifier une revue de direction validée', async ({ browser }) => {
  // ISO/IEC 27001:2022, 9.3.3 (décisions de la direction conservées) et 7.5.3 ; ADR 0010. La validation exige
  // pilotage:administrer, mais un Contributeur rouvre la fiche validée, remplace « Décisions et moyens » et la remet en
  // brouillon : la validation de la direction est défaite par un compte qui n'a pas le droit de la donner.
  test.fail(true, 'CAMP-T4-03 ouvert : PUT de la revue validée par un contributeur répond 200');
  const { ctx, rq, csrf } = await admin(browser);
  let revue: string | undefined;
  try {
    const c = await rq.post(`/api/grc/${PERIMETRE_COMMUN}/objects`, {
      headers: entetes(csrf),
      data: {
        kind: 'management_review',
        name: 'Campagne T4-03 revue de direction (fictive)',
        data: {
          heldAt: '2026-11-12',
          inputs: 'Entrées 9.3.2 examinées (fictif)',
          decisions: 'Décision fictive : reconduire le budget de formation',
        },
      },
    });
    expect(c.ok(), await c.text()).toBe(true);
    const cree = (await c.json()) as { id: string; version: number };
    revue = cree.id;
    const v = await rq.post(`/api/grc/${PERIMETRE_COMMUN}/pilotage/decisions`, {
      headers: entetes(csrf, cree.version),
      data: {
        ref: `object:${revue}`,
        decision: {
          operation: 'approval',
          requestId: crypto.randomUUID(),
          note: 'Validation de la revue de test par la direction (fictif)',
          date: '2026-11-12',
          result: 'accepted',
          refs: [`object:${revue}`],
          confirm: 'ENREGISTRER',
        },
      },
    });
    expect(v.ok(), await v.text()).toBe(true);
    const validee = (await (await rq.get(`/api/grc/${PERIMETRE_COMMUN}/objects/${revue}`)).json()) as {
      kind: string;
      name: string;
      version: number;
      data: Record<string, unknown>;
    };
    expect(validee.data.status, 'revue validée par l’administrateur').toBe('validated');

    const contrib = (await compteContributeur(browser)).request;
    const r = await contrib.put(`/api/grc/${PERIMETRE_COMMUN}/objects/${revue}`, {
      headers: entetes(await csrfOf(contrib), validee.version),
      data: {
        kind: validee.kind,
        name: validee.name,
        data: { ...validee.data, status: 'draft', decisions: 'Décision remplacée par le contributeur (fictif)' },
      },
    });
    expect([403, 409], `réponse ${r.status()} : ${await r.text()}`).toContain(r.status());
  } finally {
    if (revue) await archiverFiche(rq, PERIMETRE_COMMUN, revue);
    await ctx.close();
  }
});
