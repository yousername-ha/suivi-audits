/* RETEX d'un incident (ADR 0078) : le pilote ouvre un RETEX et invite un compte sans droit sur les incidents ; ce
   contributeur voit le bandeau, propose un élément et déclare sa contribution terminée ; un compte non invité reçoit 404 ;
   le pilote valide la proposition, récupère la main courante de crise, clôt la collecte, génère la chronologie et la
   diffuse au contributeur. Comptes, incident et cellule de crise FICTIFS, posés par l'API. */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { apiLogin, csrfOf, ecrireEtat, markTotpUsed, PASSWORD, sessionAdmin, totp, watchPage } from '../helpers';

test.describe.configure({ mode: 'serial' });

const INCIDENT = 'INC-2026-901';
const TITRE = 'Indisponibilité fictive de la messagerie';
const CELLULE = 'CEL-RETEX-E2E';
const suffixe = Date.now().toString(36);
const CONTRIBUTEUR = `retex-contrib-${suffixe}`;
const TIERS = `retex-tiers-${suffixe}`;
const PROPOSITION = 'Bascule fictive sur la messagerie de secours';

let pilote: { ctx: BrowserContext; page: Page; problems: string[]; csrf: string };
let contributeur: { ctx: BrowserContext; page: Page; problems: string[] } | undefined;
const secrets: Record<string, string> = {};

test.beforeAll(async ({ browser }) => {
  const admin = await sessionAdmin(browser);
  const ctx = await browser.newContext({
    storageState: admin.state,
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  });
  const page = await ctx.newPage();
  pilote = { ctx, page, problems: watchPage(page), csrf: admin.csrf };
  const rq = ctx.request;

  // Incident et cellule de crise fictifs, remis à neuf à chaque exécution (aucune collecte, main courante de deux entrées ;
  // identifiants « CL- » exigés par le schéma 15).
  const s = (await (await rq.get('/api/suivi/etat')).json()) as Record<string, unknown>;
  const incidents = (Array.isArray(s.incidents) ? s.incidents : []) as { id?: string }[];
  const crise = (s.crisis && typeof s.crisis === 'object' ? s.crisis : {}) as Record<string, unknown>;
  Object.assign(s, {
    incidents: [
      ...incidents.filter((i) => i.id !== INCIDENT),
      {
        id: INCIDENT,
        createdAt: '2026-10-12T07:00:00.000Z',
        detectedAt: '2026-10-12T08:00',
        reporter: '',
        title: TITRE,
        desc: 'Incident fictif de recette.',
        kind: 'Incident',
        cat: 'Autre',
        impact: '',
        urgency: '',
        status: 'Résolu',
        owner: '',
        actions: '',
        cause: '',
        resolvedAt: '2026-10-12T12:00',
        retex: '',
        answers: {},
        notified: {},
      },
    ],
    crisis: {
      scenarios: [],
      contacts: [],
      ...crise,
      // Seule la cellule fictive du RETEX est conservée, comme dans le spec des incidents : les entrées de main courante
      // écrites par l'écran de crise n'ont pas d'identifiant du schéma 15, que l'import « Remplacer un module » exige.
      cells: [
        {
          id: CELLULE,
          title: 'Cellule fictive RETEX',
          mode: 'Exercice',
          scenario: '',
          plan: '',
          start: '2026-10-12T08:15:00.000Z',
          end: '2026-10-12T11:00:00.000Z',
          status: 'Clôturée',
          log: [
            {
              id: 'CL-RETEX-1',
              ts: '2026-10-12T08:20:00.000Z',
              type: 'Décision',
              author: 'Cellule',
              text: 'Isolement fictif du relais',
            },
            {
              id: 'CL-RETEX-2',
              ts: '2026-10-12T09:10:00.000Z',
              type: 'Communication',
              author: 'Cellule',
              text: 'Message fictif aux utilisateurs',
            },
          ],
          checks: {},
          deadlines: [],
        },
      ],
    },
  });
  await ecrireEtat(rq, admin.csrf, s);

  // Rôle sans aucun droit sur les incidents : le contributeur n'est habilité que par son invitation.
  const roles = (await (await rq.get('/api/admin/roles')).json()) as { id: string; name: string }[];
  let roleId = roles.find((x) => x.name === 'RETEX sans incidents')?.id;
  if (!roleId) {
    const role = await rq.post('/api/admin/roles', {
      data: { from: 'lecteur', name: 'RETEX sans incidents' },
      headers: { 'x-csrf-token': admin.csrf },
    });
    expect(role.status(), await role.text()).toBe(201);
    const r = await role.json();
    const patch = await rq.patch(`/api/admin/roles/${r.id}`, {
      data: { permissions: ['pilotage:lire'] },
      headers: { 'x-csrf-token': admin.csrf, 'if-match': `"${r.version}"` },
    });
    expect(patch.status(), await patch.text()).toBe(200);
    roleId = r.id as string;
  }
  for (const username of [CONTRIBUTEUR, TIERS]) {
    const r = await rq.post('/api/admin/users', {
      data: { username, displayName: `Compte ${username}`, roles: [{ roleId }] },
      headers: { 'x-csrf-token': admin.csrf },
    });
    expect(r.status(), await r.text()).toBe(201);
    const temp = (await r.json()).temporaryPassword as string;
    const c = await browser.newContext({ ignoreHTTPSErrors: true });
    await c.request.post('/api/auth/login', { data: { username, password: temp } });
    let csrf = await csrfOf(c.request);
    const begin = await (
      await c.request.post('/api/account/totp/begin', { data: {}, headers: { 'x-csrf-token': csrf } })
    ).json();
    await c.request.post('/api/account/totp/confirm', {
      data: { code: totp(begin.secret) },
      headers: { 'x-csrf-token': csrf },
    });
    markTotpUsed(begin.secret);
    csrf = await csrfOf(c.request);
    const mdp = await c.request.post('/api/account/password', {
      data: { current: temp, next: PASSWORD },
      headers: { 'x-csrf-token': csrf },
    });
    expect(mdp.ok(), await mdp.text()).toBe(true);
    await c.close();
    secrets[username] = begin.secret as string;
  }
});

test.afterAll(async () => {
  await contributeur?.ctx.close();
  await pilote?.ctx.close();
});

test('Pilote : ouvrir un RETEX et inviter un contributeur d’un autre pôle', async () => {
  const { page, problems } = pilote;
  await page.goto('/pilotage/incidents-retex');
  await expect(page.getByRole('heading', { name: 'Retours d’expérience' })).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir un RETEX' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Ouvrir un RETEX' });
  await fenetre.getByRole('combobox', { name: 'Incident' }).click();
  await fenetre.getByRole('option', { name: new RegExp(INCIDENT) }).click();
  await fenetre.getByRole('combobox', { name: 'Contributeurs' }).click();
  await fenetre.getByRole('combobox', { name: 'Contributeurs' }).fill(CONTRIBUTEUR);
  await fenetre.getByRole('option', { name: `Compte ${CONTRIBUTEUR}` }).click();
  await fenetre.getByRole('textbox', { name: 'Échéance de la collecte' }).fill('2026-12-31');
  await fenetre.getByRole('button', { name: 'Ouvrir et envoyer les invitations' }).click();
  await expect(fenetre).toBeHidden();

  // Fiche du RETEX, onglet des contributeurs : l'invité est listé, sa contribution n'est pas terminée.
  await expect(page.getByRole('heading', { name: TITRE })).toBeVisible();
  const table = page.getByRole('region', { name: 'Contributeurs du RETEX' });
  await expect(table.getByRole('row', { name: new RegExp(`Compte ${CONTRIBUTEUR}`) })).toBeVisible();
  // Le compte non invité ne figure pas dans la collecte.
  await expect(table.getByText(`Compte ${TIERS}`)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('Contributeur : bandeau, proposition, contribution terminée ; compte non invité : 404', async ({ browser }) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage();
  contributeur = { ctx, page, problems: watchPage(page) };
  await apiLogin(page.request, CONTRIBUTEUR, PASSWORD, secrets[CONTRIBUTEUR]!);
  await page.goto('/');

  // Bandeau d'invitation visible sans aucun droit sur les incidents.
  const bandeau = page.locator('[data-retex-invitation]');
  await expect(bandeau).toContainText('Contribution RETEX demandée');
  await expect(bandeau).toContainText(INCIDENT);
  await bandeau.getByRole('link', { name: 'Contribuer' }).click();
  await expect(page).toHaveURL(new RegExp(`/retex/${INCIDENT}$`));
  await expect(page.getByRole('heading', { name: TITRE })).toBeVisible();

  // Proposer un élément au pilote.
  await page.getByRole('textbox', { name: 'Date et heure' }).fill('2026-10-12T09:30');
  await page.getByRole('textbox', { name: 'Acteur' }).fill('Équipe fictive messagerie');
  await page.getByRole('textbox', { name: 'Intitulé' }).fill(PROPOSITION);
  await page.getByRole('button', { name: 'Proposer au pilote' }).click();
  const mesElements = page.getByRole('region', { name: 'Mes éléments proposés' });
  const ligne = mesElements.getByRole('row', { name: new RegExp(PROPOSITION) });
  await expect(ligne).toContainText('À valider');

  // Contribution terminée : le formulaire disparaît, la reprise reste possible.
  await page.getByRole('button', { name: 'J’ai terminé ma contribution' }).click();
  await expect(page.getByText(/Contribution déclarée terminée le/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proposer au pilote' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reprendre ma contribution' })).toBeVisible();
  await expect(bandeau).toHaveCount(0);

  // Compte non invité : même réponse 404 pour ce RETEX et pour un incident inexistant ; aucune demande listée.
  const tiers = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const csrf = await apiLogin(tiers.request, TIERS, PASSWORD, secrets[TIERS]!);
    const invite = await tiers.request.get(`/api/retex/${INCIDENT}`);
    const absent = await tiers.request.get('/api/retex/INC-1999-999');
    expect(invite.status()).toBe(404);
    expect(absent.status()).toBe(404);
    expect(await invite.json()).toEqual(await absent.json());
    expect(await (await tiers.request.get('/api/retex/invitations')).json()).toEqual([]);
    const proposer = await tiers.request.post(`/api/retex/${INCIDENT}/propositions`, {
      data: { ts: '2026-10-12T10:00', type: 'Analyse', titre: 'Intrusion fictive' },
      headers: { 'x-csrf-token': csrf },
    });
    expect(proposer.status()).toBe(404);
    // Ni l'écran du pilote ni ses routes : aucun droit sur les incidents.
    expect((await tiers.request.get('/api/incidents')).status()).toBe(403);
  } finally {
    await tiers.close();
  }
  expect(contributeur.problems).toEqual([]);
});

test('Pilote : valider la proposition, récupérer la main courante, clore, générer et diffuser la chronologie', async () => {
  const { page, problems } = pilote;
  await page.goto(`/pilotage/incidents-retex?incident=${INCIDENT}&vue=valider`);
  const proposition = page.locator('article.retex-proposition', { hasText: PROPOSITION });
  await expect(proposition).toContainText(`Compte ${CONTRIBUTEUR}`);
  await proposition.getByRole('button', { name: 'Accepter', exact: true }).click();
  await expect(page.getByText('Rien à valider pour le moment.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Déjà traitées (1)' })).toBeVisible();

  // Récupération depuis la main courante de la cellule de crise fictive.
  const rubriques = page.getByRole('navigation', { name: 'Rubriques du RETEX' });
  await rubriques.getByRole('button', { name: /Récupérer des éléments/ }).click();
  const section = page.locator('section.retex-panneau', { hasText: 'Main courante de crise' });
  await section.getByRole('combobox', { name: 'Cellule de crise' }).click();
  await section.getByRole('option', { name: /Cellule fictive RETEX/ }).click();
  await expect(section.getByRole('checkbox', { name: 'Importer Isolement fictif du relais' })).toBeChecked();
  await section.getByRole('button', { name: 'Ajouter à la chronologie (2)' }).click();
  await expect(section.getByText('Déjà dans la chronologie')).toHaveCount(2);

  // Chronologie : la proposition intégrée et les deux entrées de la main courante, avec leur origine.
  await rubriques.getByRole('button', { name: /^Chronologie\s*3$/ }).click();
  const chronologie = page.getByRole('region', { name: 'Chronologie de l’incident' });
  await expect(chronologie.getByRole('row', { name: new RegExp(PROPOSITION) })).toContainText(
    `Proposé par Compte ${CONTRIBUTEUR}`,
  );
  await expect(chronologie.getByRole('row', { name: /Isolement fictif du relais/ })).toContainText(
    'Main courante de crise',
  );
  await expect(chronologie.getByRole('row', { name: /Message fictif aux utilisateurs/ })).toBeVisible();

  // Clôture, génération de la chronologie animée, diffusion en lecture seule.
  await page.getByRole('button', { name: 'Clore la collecte' }).click();
  await expect(page.getByRole('button', { name: 'Rouvrir la collecte' })).toBeVisible();
  await page.getByRole('button', { name: 'Générer la chronologie' }).click();
  await expect(page.getByRole('group', { name: /^Chronologie de 3 événements/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Étapes de la chronologie' })).toBeVisible();
  await page.getByRole('switch', { name: 'Diffuser aux contributeurs' }).check();
  await expect(page.getByText('Close · diffusée')).toBeVisible();
  expect(problems).toEqual([]);

  // Le contributeur retrouve la chronologie diffusée, en lecture seule.
  const c = contributeur!;
  await c.page.goto(`/retex/${INCIDENT}`);
  await expect(c.page.getByText('Collecte close')).toBeVisible();
  await expect(c.page.getByRole('group', { name: /^Chronologie de 3 événements/ })).toBeVisible();
  await expect(
    c.page.getByRole('region', { name: 'Mes éléments proposés' }).getByRole('row', { name: new RegExp(PROPOSITION) }),
  ).toContainText('Intégrée');
  expect(c.problems).toEqual([]);
});
