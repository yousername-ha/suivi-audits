/* Campagne de recette multi-agent du 12/11/2026, phase 3 : défauts bloquants et majeurs rejoués sur les piles 1 et 2
   (organisation, contexte, objectifs, fournisseurs ; risques et EBIOS RM), docs/05_RECETTE/rssi-virtuel/campagne/
   rejeu-piles-1-2.md. Chaque test décrit le comportement attendu et porte un marqueur test.fail tant que le constat est
   ouvert : il devient rouge une fois le défaut corrigé, ce qui oblige à retirer le marqueur. Le fichier ne dépend que de
   l'installation (00) : il crée ses propres données fictives (« Campagne <constat> … (fictif) »), ses périmètres privés et
   ses comptes, et archive ce qui pourrait gêner les invariants (90). */
import { randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type APIRequestContext, type APIResponse, type Browser, type Page } from '@playwright/test';
import { preparerCompte, sessionAdmin, sessionCompte } from '../../helpers';
import { PERIMETRE_COMMUN } from '../invariants';

/* ------------------------------------------------------------------------------------------------------ outils */

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

test('CAMP-C1-03 ouvert : une fiche du contexte ou des risques créée par erreur s’archive depuis l’écran', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 7.5.3 (maîtrise des informations documentées, retrait des informations obsolètes). La fiche
  // générique des registres du Pilotage (SWOT, parties intéressées, rôles, contexte, et aussi traitements, actifs,
  // sources de risque, opportunités : constat C2-10, même cause) n'offre que « Fermer » et « Enregistrer », alors que
  // l'API archive (DELETE …/objects/:id) et que la fiche d'un risque porte « Archiver la fiche ».
  test.fail(true, 'CAMP-C1-03 ouvert : aucun « Archiver la fiche » dans la fiche SWOT ni dans la fiche opportunité');
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
      {
        kind: 'opportunity',
        page: '/pilotage/opportunites',
        fiche: 'Fiche — Opportunité',
        nom: 'Campagne C2-10 opportunité à archiver (fictif)',
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

test('CAMP-C1-04 ouvert : l’export Excel « Contexte du SMSI » reprend les parties intéressées saisies', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 4.2 et 7.5 : le classeur remis à un auditeur doit refléter les fiches de la rubrique. L'export
  // lit le registre historique (`interested`, `swots`, `roles`), pas les objets `stakeholder`, `swot`, `governance` :
  // feuilles réduites à leur en-tête (même famille que BUG-020).
  test.fail(true, 'CAMP-C1-04 ouvert : feuille « Parties intéressées » réduite à son en-tête');
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

test('CAMP-C1-05 ouvert : le PESTEL reprend les menaces d’un SWOT saisi à l’écran', async ({ browser }) => {
  // ISO/IEC 27001:2022, 4.1 (enjeux externes) : le PESTEL, la carte et la fiche processus lisent les enjeux du registre
  // historique ; un SWOT ou une fiche de contexte saisis dans la rubrique n'y figurent jamais.
  test.fail(true, 'CAMP-C1-05 ouvert : la menace du SWOT est absente du PESTEL (aucun enjeu externe)');
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

test('CAMP-C1-07 ouvert : cocher, décocher et recocher un critère d’évaluation d’un fournisseur', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, A.5.19 à A.5.22 ; règle « aucune erreur JavaScript ». Au troisième clic, la page tombe sur
  // « Une erreur est survenue — Cannot read properties of null (reading 'checked') » (Fournisseurs.tsx lit
  // `e.currentTarget.checked` dans la fonction passée à `setChoix`) ; l'évaluation en cours est perdue.
  test.fail(true, 'CAMP-C1-07 ouvert : « Une erreur est survenue » au troisième clic sur la case');
  const s = await admin(browser);
  const erreurs: string[] = [];
  s.page.on('pageerror', (e) => erreurs.push(e.message));
  s.page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text().split('\n')[0]!);
  });
  try {
    const fournisseur = 'Campagne C1-07 fournisseur (fictif)';
    const critere = 'Campagne C1-07 critère d’évaluation (fictif)';
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

test('CAMP-C1-10 ouvert : la Synthèse d’un sous-périmètre montre ses objectifs et indicateurs', async ({ browser }) => {
  // ISO/IEC 27001:2022, 6.2 et 9.1 : sous un sous-périmètre, objectifs et indicateurs passent par un registre générique
  // (sans processus, ressources ni méthode d'évaluation) et la Synthèse n'a aucune carte « Objectifs et indicateurs »
  // (même cause que BUG-037, `smsi === SOCLE`).
  test.fail(true, 'CAMP-C1-10 ouvert : aucune carte « Objectifs et indicateurs » dans la Synthèse du sous-périmètre');
  const s = await admin(browser);
  try {
    const p = await creerPerimetre(s, 'Campagne C1-10 sous-périmètre (fictif)', PERIMETRE_COMMUN);
    await creerObjet(s, p.id, 'objective', 'Campagne C1-10 objectif du sous-périmètre (fictif)', {
      target: 'Disponibilité de 99,9 % (fictif)',
      dueAt: '2027-06-30',
    });
    await s.page.goto(`/pilotage/synthese?perimetre=${p.id}`);
    await expect(s.page.getByRole('combobox', { name: 'Périmètre affiché' })).toHaveValue(p.name);
    await expect(s.page.getByRole('heading', { name: 'Synthèse', level: 1 })).toBeVisible();
    await expect(s.page.getByRole('heading', { name: 'Objectifs et indicateurs', level: 2 })).toBeVisible();
  } finally {
    await s.fermer();
  }
});

test('CAMP-C1-12 ouvert : « Créer les actions pour les écarts » d’une évaluation par le clausier crée une action', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 10.2 et A.5.19 à A.5.22. Le bouton annonce « Action FOU-0n créée » mais crée seulement un écart
  // (nature « Opportunité d'amélioration », sans responsable ni échéance) ; le plan d'actions reste vide. L'écart, lui,
  // figure bien dans la DdA sur A.5.19 à A.5.22 (l'échec d'INV-08 relevé en phase 1 était un faux positif).
  test.fail(true, 'CAMP-C1-12 ouvert : aucune action créée, seulement un écart sans responsable ni échéance');
  const s = await admin(browser);
  let ecart: { id: string; version: number } | undefined;
  try {
    const nom = 'Campagne C1-12 fournisseur (fictif)';
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
    ecart = (ecarts.items as { id: string; version: number; legacyId: string | null }[]).find(
      (e) => e.legacyId === cree.action,
    );
    expect(ecart, `écart ${cree.action} créé`).toBeTruthy();
    const actions = await ok(await s.req.get(`/api/grc/${PERIMETRE_COMMUN}/objects?kind=action`), 'plan d’actions');
    expect((actions.items as { name: string }[]).map((a) => a.name).filter((n) => n.includes(nom))).not.toEqual([]);
  } finally {
    // L'écart ouvert sans responsable sur A.5.19 à A.5.22 ne doit pas rester pour les invariants (90).
    await archiver(s, PERIMETRE_COMMUN, ecart);
    await s.fermer();
  }
});

/* --------------------------------------------------------------------------------------- risques et EBIOS RM (pile 2) */

test('CAMP-C2-01 ouvert : re-choisir « Réduire » dans « Stratégie » enregistre « Réduire »', async ({ browser }) => {
  // ISO/IEC 27001:2022, 6.1.3 a) ; AGENTS.md (messages en français). La liste affiche « Réduire » mais, re-cliquée,
  // envoie `strategy: null` et reçoit 422 « Données invalides — strategy : Option invalide … » (même mécanisme que
  // BUG-022 pour « Méthode publiée »).
  test.fail(true, 'CAMP-C2-01 ouvert : strategy null envoyé alors que « Réduire » est affiché');
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

test('CAMP-C2-03 ouvert : un risque jamais apprécié ne peut pas être formellement accepté', async ({ browser }) => {
  // ISO/IEC 27001:2022, 6.1.2 e), 6.1.3 f) et 8.3 : l'acceptation d'un risque résiduel suppose un niveau de risque
  // comparé aux critères d'acceptation. Un risque « Non apprécié » reçoit aujourd'hui une décision « acceptée »
  // (HTTP 200), immuable, sans avertissement.
  test.fail(true, 'CAMP-C2-03 ouvert : décision d’acceptation enregistrée (200) sur un risque sans appréciation');
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
      stages: notes,
    });
    const registre = await ok(await s.req.get(`/api/grc/${p.id}/risks/register`), 'registre');
    const ligne = (registre.items as { id: string; brut: unknown }[]).find((r) => r.id === risque.id);
    expect(ligne?.brut, 'risque sans appréciation').toBeNull();
    const decision = await ecrire(s, 'POST', `/api/grc/${p.id}/pilotage/decisions`, {
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
    });
    expect([409, 422], `décision : ${decision.status()} ${await decision.text()}`).toContain(decision.status());
  } finally {
    await s.fermer();
  }
});

test('CAMP-C2-05 ouvert : l’export Excel complet contient le registre des risques et le plan de traitement', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 6.1.2 e), 6.1.3 e), 8.2 et 8.3 (résultats conservés en information documentée) : le classeur
  // complet compte 28 feuilles (DdA, écarts, actions, fournisseurs…), aucune de risques ni de traitements ; aucun écran
  // des risques n'exporte hors de la carte.
  test.fail(true, 'CAMP-C2-05 ouvert : aucune feuille de risques ni de traitements dans l’export complet');
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

test('CAMP-C2-06 ouvert : l’éditeur de méthode nomme ses boutons sans clé technique', async ({ browser }) => {
  // AGENTS.md (interface en français, sans clé technique) ; ISO/IEC 27001:2022, 7.5. Boutons « Retirer
  // configuration.dimensions 1 », « Retirer configuration.levels 1 »… ; ailleurs « Modéré · conditional »,
  // « Option : reduce », « draft » (extension de BUG-023). Ce test couvre la partie qui se rejoue sans données.
  test.fail(true, 'CAMP-C2-06 ouvert : boutons « Retirer configuration.… » dans l’éditeur de méthode');
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

test('CAMP-C2-07 ouvert : les mesures proposées à un traitement portent leur référence', async ({ browser }) => {
  // ISO/IEC 27001:2022, 6.1.3 b) et c) (comparaison avec l'annexe A) : au périmètre commun, la liste « Mesures de
  // sécurité (mesures, DdA) » propose « Sauvegarde des informations » sans « A.8.13 », des homonymes (« Généralités »
  // trois fois) et des exigences HDS tronquées.
  test.fail(true, 'CAMP-C2-07 ouvert : option « Sauvegarde des informations » sans référence');
  const s = await admin(browser);
  try {
    await s.page.goto(`/pilotage/traitements?perimetre=${PERIMETRE_COMMUN}`);
    await s.page.getByRole('button', { name: 'Ajouter un traitement' }).click();
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
    await s.fermer();
  }
});

test('CAMP-C2-09 ouvert : un scénario G4 × V2 des échelles publiées se place dans la matrice de l’étude', async ({
  browser,
}) => {
  // ISO/IEC 27001:2022, 6.1.2 d) ; EBIOS RM, atelier 4. Avec les échelles publiées épinglées (niveaux `g4`, `v2`), la
  // matrice gravité × vraisemblance reste vide et l'écran indique « Non placés dans la matrice (gravité ou
  // vraisemblance sans rang de 1 à 4) » : seules les valeurs numériques sont placées (ebios-visuel/modele.ts).
  test.fail(true, 'CAMP-C2-09 ouvert : SO « non placé dans la matrice » malgré G4 et V2 des échelles publiées');
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
  // ISO/IEC 27001:2022, A.5.15, A.5.18 et A.8.3 (moindre privilège) ; HDS v2 (cloisonnement des activités
  // d'hébergement). EN ATTENTE D'ARBITRAGE DU RSSI : aucun document ne promet ce cloisonnement (ADR 0039 : pas de
  // propagation des droits ; ADR 0010 : portée par module seulement ; ADR 0043 : registres restreints) et le périmètre
  // commun est créé « Toute l'organisation » (`visibility: 'instance'`), sans réglage possible. Ce test décrit le
  // comportement attendu SI le cloisonnement est retenu ; si la limite est assumée, il sera remplacé par un test de
  // l'avertissement de l'écran « Accès au périmètre ». Constats T1-01, T2-01, T3-01, T4-01, T5-01, T6-02.
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
