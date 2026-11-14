/* Campagne de recette multi-agent du 12/11/2026, phase 3 : défauts bloquants et majeurs rejoués sur les piles 1 et 2
   (organisation, contexte, objectifs, fournisseurs ; risques et EBIOS RM), docs/05_RECETTE/rssi-virtuel/campagne/
   rejeu-piles-1-2.md. Chaque test décrit le comportement attendu et porte un marqueur test.fail tant que le constat est
   ouvert : il devient rouge une fois le défaut corrigé, ce qui oblige à retirer le marqueur ; un constat corrigé et vérifié
   par la recette garde son test, sans marqueur (« corrigé »), comme test de non-régression. Le fichier ne dépend que de
   l'installation (00) : il crée ses propres données fictives (« Campagne <constat> … (fictif) »), ses périmètres privés et
   ses comptes, et archive ce qui pourrait gêner les invariants (90). */
import { randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type APIRequestContext, type APIResponse, type Browser, type Page } from '@playwright/test';
import { preparerCompte, sessionAdmin, sessionCompte } from '../../helpers';
import { PERIMETRE_COMMUN } from '../invariants';

/* ------------------------------------------------------------------------------------------------------ outils */

/** Suffixe d'exécution : les registres de l'organisation (fournisseurs, critères) refusent les doublons de nom, et le
    fichier doit pouvoir se rejouer sur une pile déjà utilisée. */
const EXECUTION = Date.now().toString(36);

type Session = { req: APIRequestContext; csrf: string; page: Page; fermer: () => Promise<void> };

/** Contexte administrateur (session partagée de l'installation) avec sa page et son jeton CSRF. */
async function admin(browser: Browser): Promise<Session> {
  const { state, csrf } = await sessionAdmin(browser);
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  return { req: ctx.request, csrf, page, fermer: () => ctx.close() };
}

/** Réponse attendue en succès ; le texte de la réponse sert de message, pour qu'une préparation cassée ne passe pas pour
    le défaut. */
async function ok<T = Record<string, unknown>>(r: APIResponse, etape: string): Promise<T> {
  expect(r.ok(), `${etape} : ${r.status()} ${await r.text()}`).toBe(true);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

const ecrire = (s: Session, methode: 'POST' | 'PUT' | 'DELETE', chemin: string, data?: unknown, version?: number) =>
  s.req.fetch(chemin, {
    method: methode,
    headers: { 'X-CSRF-Token': s.csrf, ...(version !== undefined ? { 'If-Match': `"${version}"` } : {}) },
    ...(data !== undefined ? { data } : {}),
  });

async function creerObjet(s: Session, smsi: string, kind: string, name: string, data: Record<string, unknown> = {}) {
  return (await ok(await ecrire(s, 'POST', `/api/grc/${smsi}/objects`, { kind, name, data }), `création ${kind}`)) as {
    id: string;
    version: number;
  };
}

/** Archive une fiche créée par le test (le défaut porte sur l'écran, l'API sait archiver). */
async function archiver(s: Session, smsi: string, o: { id: string; version: number } | undefined) {
  if (o) await ecrire(s, 'DELETE', `/api/grc/${smsi}/objects/${o.id}`, undefined, o.version);
}

/** Périmètre privé de recette (racine ou enfant), créé par l'administrateur. */
async function creerPerimetre(s: Session, name: string, parentId: string | null = null) {
  return (await ok(
    await ecrire(s, 'POST', '/api/grc/smsis', {
      name,
      scope: 'Périmètre fictif de la campagne de recette',
      timezone: 'Europe/Paris',
      ...(parentId ? { parentId, inheritFrameworks: true } : {}),
    }),
    'création du périmètre',
  )) as { id: string; name: string };
}

/** Méthode ISO/IEC 27005 du modèle, publiée et choisie pour les nouveaux risques du périmètre. */
async function publierMethode(s: Session, smsi: string) {
  const root = `/api/grc/${smsi}`;
  const definition = await ok(await s.req.get('/api/grc/methods/templates/iso27005'), 'modèle de méthode');
  const apercu = await ok(await ecrire(s, 'POST', `${root}/methods/preview`, { id: null, definition }), 'aperçu');
  const methode = await ok(
    await ecrire(
      s,
      'POST',
      `${root}/methods/publish`,
      { id: null, definition, previewId: apercu.previewId, reason: 'Méthode de la campagne', confirm: 'PUBLIER' },
      0,
    ),
    'publication de la méthode',
  );
  await ok(
    await ecrire(s, 'PUT', `${root}/method`, { methodId: methode.methodId, version: 1, confirm: 'CHOISIR' }, 1),
    'choix de la méthode',
  );
  return methode.methodId as string;
}

/** Lecture minimale d'un classeur Office Open XML : feuilles, dans l'ordre, et texte de leurs cellules ligne par ligne. */
function lireClasseur(buf: Buffer): Map<string, string[][]> {
  const fichiers = new Map<string, Buffer>();
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--;
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  for (let i = 0; i < n; i++) {
    const methode = buf.readUInt16LE(p + 10),
      taille = buf.readUInt32LE(p + 20),
      lnom = buf.readUInt16LE(p + 28),
      lextra = buf.readUInt16LE(p + 30),
      lcomm = buf.readUInt16LE(p + 32),
      local = buf.readUInt32LE(p + 42);
    const nom = buf.toString('utf8', p + 46, p + 46 + lnom);
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const brut = buf.subarray(debut, debut + taille);
    fichiers.set(nom, methode === 8 ? inflateRawSync(brut) : brut);
    p += 46 + lnom + lextra + lcomm;
  }
  const xml = (f: string) => fichiers.get(f)?.toString('utf8') ?? '';
  const texte = (s: string) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  const partages = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    texte([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const cibles = new Map(
    [...xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      /Id="([^"]+)"/.exec(m[0])![1]!,
      /Target="([^"]+)"/.exec(m[0])![1]!.replace(/^\/?(xl\/)?/, 'xl/'),
    ]),
  );
  const classeur = new Map<string, string[][]>();
  for (const m of xml('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const nom = texte(/name="([^"]+)"/.exec(m[0])![1]!);
    const feuille = xml(cibles.get(/r:id="([^"]+)"/.exec(m[0])![1]!) ?? '');
    const lignes = [...feuille.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
      [...r[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? '')?.[1];
        if (/t="s"/.test(c[1]!) && v !== undefined) return partages[Number(v)] ?? '';
        const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2] ?? '')?.[1];
        return texte(t ?? v ?? '');
      }),
    );
    classeur.set(nom, lignes);
  }
  return classeur;
}

/* ------------------------------------------------------------------------------- organisation et contexte (pile 1) */

test('CAMP-C1-03 corrigé : une fiche du contexte créée par erreur s’archive depuis l’écran', async ({ browser }) => {
  // BUG-052 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 7.5.3 (maîtrise des informations documentées, retrait des informations obsolètes). La fiche
  // générique des registres du Pilotage (SWOT, parties intéressées, rôles, contexte : constat C2-10, même cause)
  // n'offre que « Fermer » et « Enregistrer », alors que l'API archive (DELETE …/objects/:id) et que la fiche d'un
  // risque porte « Archiver la fiche ». Le cas « opportunité » est retiré avec le type de fiche (ADR 0090, lot 2).
  const s = await admin(browser);
  const fiches: { id: string; version: number }[] = [];
  try {
    const cas = [
      {
        kind: 'swot',
        page: '/pilotage/swot',
        fiche: 'Fiche — Analyse SWOT',
        nom: 'Campagne C1-03 SWOT à archiver (fictif)',
      },
    ];
    for (const c of cas) fiches.push(await creerObjet(s, PERIMETRE_COMMUN, c.kind, c.nom));
    for (const c of cas) {
      await s.page.goto(`${c.page}?perimetre=${PERIMETRE_COMMUN}`);
      await s.page
        .getByRole('row')
        .filter({ hasText: c.nom })
        .getByRole('button', { name: 'Ouvrir', exact: true })
        .click();
      const fiche = s.page.getByRole('dialog', { name: c.fiche });
      await expect(fiche.getByRole('textbox', { name: 'Intitulé' })).toHaveValue(c.nom);
      await expect(s.page.getByRole('button', { name: 'Archiver la fiche' }), c.kind).toBeVisible();
      await s.page.keyboard.press('Escape');
    }
  } finally {
    for (const f of fiches) await archiver(s, PERIMETRE_COMMUN, f);
    await s.fermer();
  }
});

test('CAMP-C1-04 corrigé : l’export Excel « Contexte du SMSI » reprend les parties intéressées saisies', async ({
  browser,
}) => {
  // BUG-038 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 4.2 et 7.5 : le classeur remis à un auditeur doit refléter les fiches de la rubrique. L'export
  // lit le registre historique (`interested`, `swots`, `roles`), pas les objets `stakeholder`, `swot`, `governance` :
  // feuilles réduites à leur en-tête (même famille que BUG-020).
  const s = await admin(browser);
  try {
    const nom = 'Campagne C1-04 partie intéressée exportée (fictif)';
    await creerObjet(s, PERIMETRE_COMMUN, 'stakeholder', nom, { nature: 'Externe' });
    const r = await s.req.get('/api/suivi/export?groupe=ctx&mode=std');
    expect(r.ok(), `export : ${r.status()}`).toBe(true);
    const classeur = lireClasseur(await r.body());
    const feuille = classeur.get('Parties intéressées');
    expect(feuille, `feuilles : ${[...classeur.keys()].join(', ')}`).toBeTruthy();
    expect(feuille!.flat()).toContain(nom);
  } finally {
    await s.fermer();
  }
});

test('CAMP-C1-05 corrigé : le PESTEL reprend les menaces d’un SWOT saisi à l’écran', async ({ browser }) => {
  // BUG-053 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 4.1 (enjeux externes) : le PESTEL, la carte et la fiche processus lisent les enjeux du registre
  // historique ; un SWOT ou une fiche de contexte saisis dans la rubrique n'y figurent jamais.
  const s = await admin(browser);
  try {
    const menace = 'Campagne C1-05 menace externe du SWOT (fictif)';
    await creerObjet(s, PERIMETRE_COMMUN, 'swot', 'Campagne C1-05 SWOT (fictif)', { threats: menace });
    const pestel = await ok(await s.req.get(`/api/grc/${PERIMETRE_COMMUN}/pilotage/pestel`), 'PESTEL');
    expect(pestel.parFacteur, 'réponse du PESTEL').toBeTruthy();
    expect(JSON.stringify(pestel)).toContain(menace);
  } finally {
    await s.fermer();
  }
});

test('CAMP-C1-07 corrigé : cocher, décocher et recocher un critère d’évaluation d’un fournisseur', async ({
  browser,
}) => {
  // BUG-054 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, A.5.19 à A.5.22 ; règle « aucune erreur JavaScript ». Au troisième clic, la page tombe sur
  // « Une erreur est survenue — Cannot read properties of null (reading 'checked') » (Fournisseurs.tsx lit
  // `e.currentTarget.checked` dans la fonction passée à `setChoix`) ; l'évaluation en cours est perdue.
  const s = await admin(browser);
  const erreurs: string[] = [];
  s.page.on('pageerror', (e) => erreurs.push(e.message));
  s.page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text().split('\n')[0]!);
  });
  try {
    const fournisseur = `Campagne C1-07 fournisseur ${EXECUTION} (fictif)`;
    const critere = `Campagne C1-07 critère d’évaluation ${EXECUTION} (fictif)`;
    await ok(await ecrire(s, 'POST', '/api/suppliers', { name: fournisseur }), 'création du fournisseur');
    await ok(
      await ecrire(s, 'POST', '/api/suppliers/criteria', {
        label: critere,
        purposes: ['evaluation'],
        reason: 'Critère fictif de la campagne de recette',
      }),
      'création du critère',
    );
    await s.page.goto(`/pilotage/fournisseurs?perimetre=${PERIMETRE_COMMUN}`);
    await s.page.getByRole('button', { name: `Évaluer le fournisseur ${fournisseur}` }).click();
    const fenetre = s.page.getByRole('dialog', { name: `Évaluer ${fournisseur}` });
    const caseCritere = fenetre.getByRole('checkbox', { name: critere });
    await caseCritere.click();
    await expect(caseCritere).toBeChecked();
    await caseCritere.click();
    await expect(caseCritere).not.toBeChecked();
    await caseCritere.click();
    await expect(caseCritere, `erreurs : ${erreurs.join(' | ')}`).toBeChecked();
    expect(erreurs).toEqual([]);
  } finally {
    await s.fermer();
  }
});

test('CAMP-C1-10 corrigé : la Synthèse d’un sous-périmètre montre ses objectifs et indicateurs', async ({
  browser,
}) => {
  // BUG-055 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.2 et 9.1 : sous un sous-périmètre, objectifs et indicateurs passent par un registre générique
  // (sans processus, ressources ni méthode d'évaluation) et la Synthèse n'a aucune carte « Objectifs et indicateurs »
  // (même cause que BUG-037, `smsi === SOCLE`).
  const s = await admin(browser);
  let objectif: { smsi: string; id: string } | undefined;
  try {
    const p = await creerPerimetre(s, 'Campagne C1-10 sous-périmètre (fictif)', PERIMETRE_COMMUN);
    // Depuis l'ADR 0094 (PR #269), un seul modèle d'objectifs dans tous les périmètres, celui de l'outil de suivi : la fiche
    // native « objective » n'est plus proposée à la saisie et n'alimente plus la Synthèse.
    const nom = 'Campagne C1-10 objectif du sous-périmètre (fictif)';
    const cree = await ok<{ id: string }>(
      await ecrire(s, 'POST', `/api/grc/${p.id}/pilotage/objectifs/objectives`, { name: nom, due: '2027-06-30' }),
      'création de l’objectif',
    );
    objectif = { smsi: p.id, id: cree.id };
    await s.page.goto(`/pilotage/synthese?perimetre=${p.id}`);
    await expect(s.page.getByRole('combobox', { name: 'Périmètre affiché' })).toHaveValue(p.name);
    await expect(s.page.getByRole('heading', { name: 'Synthèse', level: 1 })).toBeVisible();
    await expect(s.page.getByRole('heading', { name: 'Objectifs et indicateurs', level: 2 })).toBeVisible();
    await expect(s.page.getByLabel('Objectifs et indicateurs du périmètre')).toContainText(nom);
  } finally {
    if (objectif)
      await ecrire(
        s,
        'DELETE',
        `/api/grc/${objectif.smsi}/pilotage/objectifs/objectives/${objectif.id}?confirm=SUPPRIMER`,
      );
    await s.fermer();
  }
});

test('CAMP-C1-12 corrigé : « Créer les actions pour les écarts » d’une évaluation par le clausier crée une action', async ({
  browser,
}) => {
  // BUG-056 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 10.2 et A.5.19 à A.5.22. Le bouton annonce « Action FOU-0n créée » mais crée seulement un écart
  // (nature « Opportunité d'amélioration », sans responsable ni échéance) ; le plan d'actions reste vide. L'écart, lui,
  // figure bien dans la DdA sur A.5.19 à A.5.22 (l'échec d'INV-08 relevé en phase 1 était un faux positif).
  const s = await admin(browser);
  try {
    const nom = `Campagne C1-12 fournisseur ${EXECUTION} (fictif)`;
    const f = await ok(await ecrire(s, 'POST', '/api/suppliers', { name: nom }), 'création du fournisseur');
    const evaluation = await ok(
      await ecrire(s, 'POST', '/api/evaluations-clausier', { supplier: f.id }),
      'création de l’évaluation',
    );
    await ok(
      await ecrire(s, 'PUT', `/api/evaluations-clausier/${evaluation.id}/points/O-1.1`, {
        st: 'Non conforme',
        c: 'Clause absente du contrat (fictif)',
      }),
      'réponse au point O-1.1',
    );
    const cree = await ok(
      await ecrire(s, 'POST', `/api/evaluations-clausier/${evaluation.id}/action`),
      'création des actions',
    );
    const ecarts = await ok(
      await s.req.get(`/api/grc/${PERIMETRE_COMMUN}/objects?kind=nonconformity`),
      'lecture des écarts',
    );
    const ecart = (ecarts.items as { id: string; version: number; legacyId: string | null }[]).find(
      (e) => e.legacyId === cree.action,
    );
    expect(ecart, `écart ${cree.action} créé`).toBeTruthy();
    const actions = await ok(await s.req.get(`/api/grc/${PERIMETRE_COMMUN}/objects?kind=action`), 'plan d’actions');
    // Depuis la PR #269, une action par point du clausier, nommée d'après le point (« Clausier O-1.1 : … ») et décrite
    // d'après l'écart (« Écart FOU-0n : … ») : elle se retrouve par l'identifiant de l'écart, pas par le nom du fournisseur.
    const deLEcart = new RegExp(`\\b${String(cree.action)}\\b`);
    expect(
      (actions.items as { name: string; data: { description?: string } }[])
        .filter((a) => deLEcart.test(`${a.name} ${a.data.description ?? ''}`))
        .map((a) => a.name),
    ).not.toEqual([]);
  } finally {
    // L'écart (piste de progrès, type PP) reste ouvert : INV-05 ne vise que les NC et points sensibles, INV-06 n'en fait
    // qu'un avertissement. Il n'est pas archivé : l'identifiant historique FOU-0n d'un écart archivé est réattribué à
    // l'écart suivant et sa création échoue alors en 500 (clé `grc_objects_smsi_id_legacy_key_legacy_id_key`, constat
    // relevé pendant l'écriture de ce test).
    await s.fermer();
  }
});

test('CAMP-R12-01 corrigé : l’écart d’une évaluation se crée encore après l’archivage du précédent écart du clausier', async ({
  browser,
}) => {
  // BUG-077 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 10.2 et A.5.19 à A.5.22 ; aucune réponse 5xx. Le prochain identifiant historique FOU-0n est calculé
  // sur les écarts restants, sans l'écart archivé qui garde le sien : la création suivante viole la clé unique
  // `grc_objects_smsi_id_legacy_key_legacy_id_key` et répond 500 (relevé pendant l'écriture de CAMP-C1-12).
  const s = await admin(browser);
  const ecartDe = async (cle: string) => {
    const nom = `Campagne R12-01 fournisseur ${cle} ${EXECUTION} (fictif)`;
    const f = await ok(await ecrire(s, 'POST', '/api/suppliers', { name: nom }), `création du fournisseur ${cle}`);
    const evaluation = await ok(
      await ecrire(s, 'POST', '/api/evaluations-clausier', { supplier: f.id }),
      `création de l’évaluation ${cle}`,
    );
    await ok(
      await ecrire(s, 'PUT', `/api/evaluations-clausier/${evaluation.id}/points/O-1.1`, {
        st: 'Non conforme',
        c: 'Clause absente du contrat (fictif)',
      }),
      `réponse au point O-1.1 (${cle})`,
    );
    return ecrire(s, 'POST', `/api/evaluations-clausier/${evaluation.id}/action`);
  };
  const ecartCree = async (legacyId: unknown) => {
    const ecarts = await ok(
      await s.req.get(`/api/grc/${PERIMETRE_COMMUN}/objects?kind=nonconformity`),
      'lecture des écarts',
    );
    return (ecarts.items as { id: string; version: number; legacyId: string | null }[]).find(
      (e) => e.legacyId === legacyId,
    );
  };
  let second: { id: string; version: number } | undefined;
  try {
    const premier = await ok(await ecartDe('A'), 'écart de la première évaluation');
    const ecart = await ecartCree(premier.action);
    expect(ecart, `écart ${premier.action} créé`).toBeTruthy();
    await ok(
      await ecrire(s, 'DELETE', `/api/grc/${PERIMETRE_COMMUN}/objects/${ecart!.id}`, undefined, ecart!.version),
      'archivage du premier écart',
    );
    const r = await ecartDe('B');
    const texte = await r.text();
    if (r.ok()) second = await ecartCree((JSON.parse(texte) as { action?: unknown }).action);
    expect(r.status(), `écart de la seconde évaluation : ${texte}`).toBeLessThan(400);
  } finally {
    await archiver(s, PERIMETRE_COMMUN, second);
    await s.fermer();
  }
});

/* --------------------------------------------------------------------------------------- risques et EBIOS RM (pile 2) */

test('CAMP-C2-01 corrigé : re-choisir « Réduire » dans « Stratégie » enregistre « Réduire »', async ({ browser }) => {
  // BUG-057 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.1.3 a) ; AGENTS.md (messages en français). La liste affiche « Réduire » mais, re-cliquée,
  // envoie `strategy: null` et reçoit 422 « Données invalides — strategy : Option invalide … » (même mécanisme que
  // BUG-022 pour « Méthode publiée »).
  const s = await admin(browser);
  try {
    const p = await creerPerimetre(s, 'Campagne C2-01 risques (fictif)');
    await publierMethode(s, p.id);
    await s.page.goto(`/pilotage/risques?perimetre=${p.id}`);
    await s.page.getByRole('button', { name: 'Ajouter un risque' }).click();
    const fiche = s.page.getByRole('dialog', { name: 'Créer — Risque' });
    await fiche.getByRole('textbox', { name: 'Nom de la fiche' }).fill('Campagne C2-01 risque (fictif)');
    const justifications = fiche.getByRole('textbox', { name: 'Analyse et justification' });
    for (const j of await justifications.all()) await j.fill('Justification fictive de la campagne');
    const strategie = fiche.getByRole('combobox', { name: 'Stratégie' });
    await expect(strategie).toHaveValue('Réduire');
    await strategie.click();
    await s.page.getByRole('option', { name: 'Réduire', exact: true }).click();
    await expect(strategie).toHaveValue('Réduire');
    const [requete] = await Promise.all([
      s.page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/api/grc/${p.id}/objects`)),
      fiche.getByRole('button', { name: 'Enregistrer la fiche' }).click(),
    ]);
    expect(requete.postDataJSON()?.data?.strategy).toBe('reduce');
  } finally {
    await s.fermer();
  }
});

test('CAMP-C2-03 corrigé : un risque jamais apprécié ne peut pas être formellement accepté', async ({ browser }) => {
  // BUG-039 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.1.2 e), 6.1.3 f) et 8.3 : l'acceptation d'un risque résiduel suppose un niveau de risque
  // comparé aux critères d'acceptation. Un risque « Non apprécié » reçoit aujourd'hui une décision « acceptée »
  // (HTTP 200), immuable, sans avertissement.
  const s = await admin(browser);
  try {
    const p = await creerPerimetre(s, 'Campagne C2-03 risques (fictif)');
    const methodId = await publierMethode(s, p.id);
    const notes = Object.fromEntries(
      [1, 2, 3, 4, 5].map((i) => [
        `stage_${i}`,
        { status: 'draft', values: { [`notes_stage_${i}`]: 'Justification fictive' }, comment: '' },
      ]),
    );
    const risque = await creerObjet(s, p.id, 'risk', 'Campagne C2-03 risque jamais apprécié (fictif)', {
      description: 'Risque fictif saisi sans appréciation',
      code: 'CAMP-C2-03',
      ownerId: null,
      domain: '',
      entity: '',
      scope: '',
      methodId,
      methodVersion: 1,
      strategy: 'accept',
      acceptanceReason: 'Justification fictive de l’acceptation',
      reviewAt: null,
      stages: notes,
    });
    const registre = await ok(await s.req.get(`/api/grc/${p.id}/risks/register`), 'registre');
    const ligne = (registre.items as { id: string; brut: unknown }[]).find((r) => r.id === risque.id);
    expect(ligne?.brut, 'risque sans appréciation').toBeNull();
    const decision = await ecrire(
      s,
      'POST',
      `/api/grc/${p.id}/pilotage/decisions`,
      {
        ref: `object:${risque.id}`,
        decision: {
          operation: 'risk_acceptance',
          step: '',
          requestId: randomUUID(),
          note: 'Décision fictive de la campagne',
          date: new Date().toISOString().slice(0, 10),
          result: 'accepted',
          refs: [],
          createFinding: false,
          createAction: false,
          until: `${new Date().getFullYear() + 1}-12-31`,
          confirm: 'ENREGISTRER',
        },
      },
      risque.version,
    );
    expect([409, 422], `décision : ${decision.status()} ${await decision.text()}`).toContain(decision.status());
  } finally {
    await s.fermer();
  }
});

test('RSSI-09 corrigé : un risque ne s’apprécie pas sans matrice (niveau choisi librement refusé)', async ({
  browser,
}) => {
  // BUG-024 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.1.2 b) (résultats cohérents et comparables). ARBITRAGE DU RSSI DU 13/11/2026 (BUG-024) : la
  // matrice est obligatoire pour apprécier un risque. Le modèle de méthode « ISO/IEC 27005 » calcule aujourd'hui par
  // « jugement » : « Critique × Très probable » peut recevoir le niveau « Faible ». Attendu après correction : méthode sans
  // matrice refusée (aperçu ou publication), ou niveau imposé par la matrice, jamais le niveau choisi librement.
  const s = await admin(browser);
  try {
    const p = await creerPerimetre(s, `Campagne RSSI-09 risques ${EXECUTION} (fictif)`);
    const root = `/api/grc/${p.id}`;
    const definition = await ok<{
      dimensions: { id: string; levels: { id: string }[] }[];
      likelihood: { id: string }[];
      levels: { id: string }[];
    }>(await s.req.get('/api/grc/methods/templates/iso27005'), 'modèle de méthode');
    // Une méthode sans matrice refusée dès l'aperçu ou la publication satisfait aussi la règle.
    const apercu = await ecrire(s, 'POST', `${root}/methods/preview`, { id: null, definition });
    if (!apercu.ok()) {
      expect(apercu.status(), await apercu.text()).toBeLessThan(500);
      return;
    }
    const publication = await ecrire(
      s,
      'POST',
      `${root}/methods/publish`,
      {
        id: null,
        definition,
        previewId: ((await apercu.json()) as { previewId: string }).previewId,
        reason: 'Méthode de la campagne',
        confirm: 'PUBLIER',
      },
      0,
    );
    if (!publication.ok()) {
      expect(publication.status(), await publication.text()).toBeLessThan(500);
      return;
    }
    const { methodId } = (await publication.json()) as { methodId: string };
    await ok(
      await ecrire(s, 'PUT', `${root}/method`, { methodId, version: 1, confirm: 'CHOISIR' }, 1),
      'choix de la méthode',
    );
    const notes = Object.fromEntries(
      [1, 2, 3, 4, 5].map((i) => [
        `stage_${i}`,
        { status: 'draft', values: { [`notes_stage_${i}`]: 'Justification fictive' }, comment: '' },
      ]),
    );
    const risque = await creerObjet(s, p.id, 'risk', 'Campagne RSSI-09 risque critique (fictif)', {
      description: 'Risque fictif apprécié au plus haut',
      code: 'CAMP-RSSI-09',
      ownerId: null,
      domain: '',
      entity: '',
      scope: '',
      methodId,
      methodVersion: 1,
      strategy: 'reduce',
      acceptanceReason: '',
      reviewAt: null,
      stages: notes,
    });
    const dernier = <T>(l: T[]): T => l[l.length - 1]!;
    const plusBas = definition.levels[0]!.id;
    const note = {
      dimensions: Object.fromEntries(definition.dimensions.map((d) => [d.id, dernier(d.levels).id])),
      likelihood: dernier(definition.likelihood).id,
      level: plusBas,
      inputs: {},
    };
    const r = await ecrire(s, 'POST', `${root}/risks/${risque.id}/preview`, {
      ratings: { gross: note, residual: note },
      rationale: 'Appréciation fictive de la campagne',
      decision: 'draft',
    });
    const texte = await r.text();
    if (r.ok()) {
      const niveau = (JSON.parse(texte) as { result: { gross: { level: string } } }).result.gross.level;
      expect(niveau, `niveau brut retenu pour gravité et vraisemblance maximales : ${texte}`).not.toBe(plusBas);
    } else expect(r.status(), texte).toBeLessThan(500);
  } finally {
    await s.fermer();
  }
});

test('CAMP-C2-05 corrigé : l’export Excel complet contient le registre des risques et le plan de traitement', async ({
  browser,
}) => {
  // BUG-058 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.1.2 e), 6.1.3 e), 8.2 et 8.3 (résultats conservés en information documentée) : le classeur
  // complet compte 28 feuilles (DdA, écarts, actions, fournisseurs…), aucune de risques ni de traitements ; aucun écran
  // des risques n'exporte hors de la carte.
  const s = await admin(browser);
  try {
    const r = await s.req.get('/api/suivi/export?groupe=all&mode=std');
    expect(r.ok(), `export : ${r.status()}`).toBe(true);
    const feuilles = [...lireClasseur(await r.body()).keys()];
    expect(feuilles, 'feuilles du classeur').toContain('Registre des écarts');
    expect(
      feuilles.filter((f) => /risque/i.test(f)),
      feuilles.join(', '),
    ).not.toEqual([]);
    expect(
      feuilles.filter((f) => /traitement/i.test(f)),
      feuilles.join(', '),
    ).not.toEqual([]);
  } finally {
    await s.fermer();
  }
});

test('CAMP-C2-06 corrigé : l’éditeur de méthode nomme ses boutons sans clé technique', async ({ browser }) => {
  // BUG-059 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // AGENTS.md (interface en français, sans clé technique) ; ISO/IEC 27001:2022, 7.5. Boutons « Retirer
  // configuration.dimensions 1 », « Retirer configuration.levels 1 »… ; ailleurs « Modéré · conditional »,
  // « Option : reduce », « draft » (extension de BUG-023). Ce test couvre la partie qui se rejoue sans données.
  const s = await admin(browser);
  try {
    await s.page.goto(`/pilotage/configuration?perimetre=${PERIMETRE_COMMUN}`);
    await s.page.getByRole('button', { name: 'Créer ISO 27005' }).click();
    await s.page.getByRole('button', { name: 'Échelles et niveaux', exact: true }).click();
    await s.page.getByRole('button', { name: 'Dimensions d’impact', exact: true }).click();
    await expect(s.page.getByRole('button', { name: /^Retirer / }).first()).toBeVisible();
    await expect(s.page.getByRole('button', { name: /configuration\./ })).toHaveCount(0);
  } finally {
    await s.fermer();
  }
});

test('CAMP-C2-07 corrigé : les mesures proposées à un traitement portent leur référence', async ({ browser }) => {
  // BUG-060 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.1.3 b) et c) (comparaison avec l'annexe A) : au périmètre commun, la liste « Mesures de
  // sécurité (mesures, DdA) » propose « Sauvegarde des informations » sans « A.8.13 », des homonymes (« Généralités »
  // trois fois) et des exigences HDS tronquées. Depuis l'ADR 0090, le traitement s'ajoute par le plan d'action d'un risque,
  // dans le Registre des risques : le test saisit un risque au périmètre commun, avec une méthode publiée de ce périmètre
  // (celle qui existe déjà, sinon le modèle ISO/IEC 27005, publié sans être choisi par défaut).
  const s = await admin(browser);
  const root = `/api/grc/${PERIMETRE_COMMUN}`;
  const nom = 'Campagne C2-07 risque à traiter (fictif)';
  let risque: { id: string; version: number } | undefined;
  try {
    let methode = (
      await ok<{ methodId: string; version: number }[]>(await s.req.get(`${root}/methods`), 'méthodes')
    )[0];
    if (!methode) {
      const definition = await ok(await s.req.get('/api/grc/methods/templates/iso27005'), 'modèle de méthode');
      const apercu = await ok(await ecrire(s, 'POST', `${root}/methods/preview`, { id: null, definition }), 'aperçu');
      const publiee = await ok(
        await ecrire(
          s,
          'POST',
          `${root}/methods/publish`,
          { id: null, definition, previewId: apercu.previewId, reason: 'Méthode de la campagne', confirm: 'PUBLIER' },
          0,
        ),
        'publication de la méthode',
      );
      methode = { methodId: publiee.methodId as string, version: 1 };
    }
    risque = await creerObjet(s, PERIMETRE_COMMUN, 'risk', nom, {
      description: 'Risque fictif de la campagne, sans appréciation',
      code: 'CAMP-C2-07',
      ownerId: null,
      domain: '',
      entity: '',
      scope: '',
      methodId: methode.methodId,
      methodVersion: methode.version,
      strategy: 'reduce',
      acceptanceReason: '',
      reviewAt: null,
      stages: Object.fromEntries(
        [1, 2, 3, 4, 5].map((i) => [
          `stage_${i}`,
          { status: 'draft', values: { [`notes_stage_${i}`]: 'Justification fictive' }, comment: '' },
        ]),
      ),
    });
    await s.page.goto(`/pilotage/risques?perimetre=${PERIMETRE_COMMUN}`);
    await s.page.getByRole('button', { name: `Plan d’action de ${nom}`, exact: true }).click();
    await s.page
      .getByRole('dialog', { name: `Plan d’action : ${nom}` })
      .getByRole('button', { name: 'Ajouter un traitement ou une mesure' })
      .click();
    const fiche = s.page.getByRole('dialog', { name: 'Ajouter — Traitement' });
    await fiche
      .getByRole('combobox', { name: 'Mesures de sécurité (mesures, DdA)' })
      .fill('Sauvegarde des informations');
    const options = s.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const sansReference = (await options.allInnerTexts()).filter(
      (t) => !/^(A[.-]\d+\.\d+|HDS-\d+|\d+(\.\d+)+)\b/.test(t.trim()),
    );
    expect(sansReference).toEqual([]);
  } finally {
    await archiver(s, PERIMETRE_COMMUN, risque);
    await s.fermer();
  }
});

test('CAMP-C2-09 corrigé : un scénario G4 × V2 des échelles publiées se place dans la matrice de l’étude', async ({
  browser,
}) => {
  // BUG-061 : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, 6.1.2 d) ; EBIOS RM, atelier 4. Avec les échelles publiées épinglées (niveaux `g4`, `v2`), la
  // matrice gravité × vraisemblance reste vide et l'écran indique « Non placés dans la matrice (gravité ou
  // vraisemblance sans rang de 1 à 4) » : seules les valeurs numériques sont placées (ebios-visuel/modele.ts).
  const s = await admin(browser);
  try {
    const adoption = await ecrire(s, 'POST', '/api/config-grc/templates/ebios-rm-gravite-vraisemblance/adopt');
    expect([201, 409], `adoption : ${adoption.status()} ${await adoption.text()}`).toContain(adoption.status());
    type Echelle = { id: string; key: string; scope: string; currentVersion: number | null };
    const reponse = await ok<Echelle[] | { items: Echelle[] }>(
      await s.req.get('/api/config-grc/items?kind=scale'),
      'catalogue des échelles',
    );
    const elements = Array.isArray(reponse) ? reponse : reponse.items;
    const echelle = (cle: string) => {
      const e = elements.find((x) => x.key === cle && x.scope === 'instance');
      expect(e?.currentVersion, `échelle ${cle} publiée`).toBeTruthy();
      return { item: e!.id, version: e!.currentVersion! };
    };
    const p = await creerPerimetre(s, 'Campagne C2-09 étude EBIOS RM (fictif)');
    const etude = await creerObjet(s, p.id, 'risk_study', 'Campagne C2-09 étude (fictif)', {
      configuration: {
        likelihoodScale: echelle('vraisemblance_ebios_rm'),
        scenarioSeverityScale: echelle('gravite_ebios_rm'),
      },
    });
    const ss = await creerObjet(s, p.id, 'strategic_scenario', 'Campagne C2-09 SS (fictif)', {
      studyRef: `object:${etude.id}`,
      severityLevel: 'g4',
    });
    await creerObjet(s, p.id, 'operational_scenario', 'Campagne C2-09 SO (fictif)', {
      studyRef: `object:${etude.id}`,
      strategicScenarioRef: `object:${ss.id}`,
      likelihoodLevel: 'v2',
    });
    await s.page.goto(`/pilotage/etudes?perimetre=${p.id}`);
    await s.page.getByRole('button', { name: 'Ouvrir l’étude' }).click();
    await s.page.getByRole('tab', { name: 'Suivi, matrice et cercle' }).click();
    await expect(s.page.getByRole('row', { name: /Campagne C2-09 SO \(fictif\).*V2 — Vraisemblable/ })).toBeVisible();
    const matrice = s.page.getByRole('region', { name: 'Scénarios opérationnels par gravité et vraisemblance' });
    await expect(matrice.getByRole('row', { name: /^G4 — Critique/ }).getByRole('button')).toHaveCount(1);
  } finally {
    await s.fermer();
  }
});

/* ------------------------------------------------------------------------------------- droits (transversal, pile 1) */

test('CAMP-T1-01 ouvert : un contributeur limité au sous-périmètre n’écrit pas dans le périmètre principal', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, A.5.15, A.5.18 et A.8.3 (moindre privilège). ARBITRAGE DU RSSI DU 13/11/2026 (BUG-051) : un
  // compte rattaché à un périmètre enfant ne voit que ce périmètre ; rattaché au parent, il voit le parent et ses enfants.
  // Aujourd'hui le périmètre commun est créé « Toute l'organisation » (`visibility: 'instance'`), sans réglage possible,
  // et le membre du seul enfant y écrit. Constats T1-01, T2-01, T3-01, T4-01, T5-01, T6-02.
  test.fail(true, 'CAMP-T1-01 ouvert : le membre du seul sous-périmètre crée une fiche au principal (HTTP 200)');
  const s = await admin(browser);
  const compte = `campagne-t1-01-${Date.now().toString(36)}`;
  try {
    const cree = await ok<{ id: string; temporaryPassword: string }>(
      await ecrire(s, 'POST', '/api/admin/users', {
        username: compte,
        displayName: 'Contributeur limité au sous-périmètre (fictif)',
        roles: [{ roleId: 'contributeur' }],
      }),
      'création du compte',
    );
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const { secret } = await preparerCompte(ctx, compte, cree.temporaryPassword);
    await ctx.close();
    const p = await creerPerimetre(s, 'Campagne T1-01 sous-périmètre d’hébergement (fictif)', PERIMETRE_COMMUN);
    await ok(await ecrire(s, 'PUT', `/api/grc/${p.id}/members`, { userId: cree.id, write: true }), 'adhésion');

    const c = await sessionCompte(browser, compte, secret);
    const cctx = await browser.newContext({ storageState: c.state, ignoreHTTPSErrors: true });
    try {
      const propre = await cctx.request.post(`/api/grc/${p.id}/objects`, {
        headers: { 'X-CSRF-Token': c.csrf },
        data: { kind: 'stakeholder', name: 'Campagne T1-01 fiche du sous-périmètre (fictif)', data: {} },
      });
      expect(propre.ok(), `écriture dans son périmètre : ${propre.status()} ${await propre.text()}`).toBe(true);
      const principal = await cctx.request.post(`/api/grc/${PERIMETRE_COMMUN}/objects`, {
        headers: { 'X-CSRF-Token': c.csrf },
        data: { kind: 'stakeholder', name: 'Campagne T1-01 fiche hors périmètre (fictif)', data: {} },
      });
      if (principal.ok()) await archiver(s, PERIMETRE_COMMUN, await principal.json());
      expect(principal.status(), await principal.text()).toBe(404);
    } finally {
      await cctx.close();
    }
  } finally {
    await s.fermer();
  }
});

test('CAMP-T1-02 corrigé : un compte rattaché à un périmètre parent voit aussi ses périmètres enfants', async ({
  browser,
}) => {
  // BUG-051, volet « le compte rattaché au parent voit l’enfant » : corrigé par la PR #269, vérifié par la recette le 14/11/2026 (test de non-régression). Constat
  // d'origine :
  // ISO/IEC 27001:2022, A.5.15 et A.5.18. ARBITRAGE DU RSSI DU 13/11/2026 (BUG-051) : rattaché au parent, un compte voit le
  // parent et les enfants qui lui sont rattachés. Aujourd'hui l'appartenance ne se propage pas (ADR 0039) : le membre du
  // parent reçoit 404 sur l'enfant (constaté au rejeu de C5-06 et en phase 2 pour un compte non membre).
  const s = await admin(browser);
  const compte = `campagne-t1-02-${Date.now().toString(36)}`;
  try {
    const cree = await ok<{ id: string; temporaryPassword: string }>(
      await ecrire(s, 'POST', '/api/admin/users', {
        username: compte,
        displayName: 'Contributeur rattaché au périmètre parent (fictif)',
        roles: [{ roleId: 'contributeur' }],
      }),
      'création du compte',
    );
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const { secret } = await preparerCompte(ctx, compte, cree.temporaryPassword);
    await ctx.close();
    const parent = await creerPerimetre(s, `Campagne T1-02 périmètre parent ${EXECUTION} (fictif)`);
    const enfant = await creerPerimetre(s, `Campagne T1-02 périmètre enfant ${EXECUTION} (fictif)`, parent.id);
    await ok(await ecrire(s, 'PUT', `/api/grc/${parent.id}/members`, { userId: cree.id, write: true }), 'adhésion');
    const nom = 'Campagne T1-02 fiche du périmètre enfant (fictif)';
    await creerObjet(s, enfant.id, 'stakeholder', nom);

    const c = await sessionCompte(browser, compte, secret);
    const cctx = await browser.newContext({ storageState: c.state, ignoreHTTPSErrors: true });
    try {
      const sienne = await cctx.request.get(`/api/grc/${parent.id}/objects?kind=stakeholder`);
      expect(sienne.ok(), `lecture du parent : ${sienne.status()} ${await sienne.text()}`).toBe(true);
      const r = await cctx.request.get(`/api/grc/${enfant.id}/objects?kind=stakeholder`);
      const texte = await r.text();
      expect(r.status(), `lecture de l’enfant : ${texte}`).toBe(200);
      expect(texte).toContain(nom);
    } finally {
      await cctx.close();
    }
  } finally {
    await s.fermer();
  }
});
