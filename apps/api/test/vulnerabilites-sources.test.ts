/* Module Vulnérabilités (ADR 0100, décisions V22 à V24, V26 et V27 ; lot V4c) : plusieurs sources, la source en avance prime.
   Migration 078 sur base vierge ; fiches du CERT Santé reçues et rangées avec leur provenance et leur date (relecture
   seulement si le titre change ou après le délai) ; CVE connue par une publication avant NVD, puis complétée par NVD sans
   rien effacer ; exploitation avérée et « exploitable » par chaque source et par plusieurs ; valeur la plus sévère entre les
   sources ; rapprochement par le nom d'une CVE absente de NVD, puis règle par version quand NVD publie ; annulation d'une
   décision (droits, If-Match, journal, effet sur le suivi) ; priorité rejouable. Données entièrement fictives : noms en
   .invalid, adresses de 192.0.2.0/24, CVE fictives ; aucun service n'est joint. */
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const SYSTEME = { username: 'test' };
const CPE = 'cpe:2.3:a:editeur_fictif:logiciel_fictif:*:*:*:*:*:*:*:*';
let t: TestApp;
let admin: Agent, lecteur: Agent, editeur: Agent;
let instance: string, machine: string;
let pCpe: { id: string; version: number }, pNom: { id: string; version: number };

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const bilan = (elements: number) => ({
  ok: true,
  bilan: { elements, ecartes: 0, tronque: false, detailsEchoues: 0 },
  erreur: null,
});
const n = async (table: string, where = 'true', p: unknown[] = []) =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p))!.n;
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
/** Une collecte de la source par le service (réclamée, lot rangé, terminée), comme l'exécutant ; rend la demande. */
async function collecte(source: string, elements: unknown[]) {
  await t.svc.db.q(
    "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ($1, 'manuel', 'test')",
    [source],
  );
  const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
  expect(job.source).toBe(source);
  if (elements.length) await t.svc.vulnerabilites.veille.lot(job.id as string, { elements });
  await t.svc.vulnerabilites.veille.terminer(job.id as string, bilan(elements.length));
  return job;
}
const fiche = (x: Record<string, unknown> = {}) => ({
  exploitee: 'non',
  correctif: 'oui',
  contournement: 'non',
  preuveConcept: 'indisponible',
  cvss31: 7.5,
  ...x,
});
/** Publication du CERT Santé au format du script (titre « Produit - CVE-… »). */
const certSante = (identifiant: string, cve: string, extra: Record<string, unknown> = {}) => ({
  identifiant,
  nature: 'alerte',
  titre: `Logiciel fictif - ${cve}`,
  resume: 'Résumé fictif.',
  adresse: `https://cyberveille.esante.gouv.fr/alertes/logiciel-fictif-${cve.toLowerCase()}`,
  publieLe: '2026-11-10T02:28:01.000Z',
  cves: [cve],
  cvesLues: true,
  produit: 'Logiciel fictif',
  fiche: fiche(),
  ...extra,
});
const touche = (extra: Record<string, unknown> = {}) => ({
  partie: 'a',
  editeur: 'editeur_fictif',
  produit: 'logiciel_fictif',
  version: null,
  debutInclus: null,
  debutExclus: null,
  finInclus: null,
  finExclus: '3.0',
  vulnerable: true,
  ...extra,
});
const nvd = (cve: string, extra: Record<string, unknown> = {}) => ({
  cve,
  publieLe: '2026-11-15T10:00:00.000Z',
  modifieLe: '2026-11-15T10:00:00.000Z',
  description: 'Fictional NVD description.',
  cvss31: { score: 7.5, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N', gravite: 'HIGH' },
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['logiciel_fictif'],
  produitsTouches: [touche()],
  produitsTronques: false,
  ...extra,
});
const kev = (cve: string) => ({
  cve,
  editeur: 'Éditeur fictif',
  produit: 'Logiciel fictif',
  nom: 'Faille fictive',
  description: 'Fictional description.',
  action: 'Apply updates.',
  ajoutLe: '2026-11-13',
  echeance: '2026-12-04',
  rancongiciel: false,
});
const alerteCertFr = (identifiant: string, cves: string[]) => ({
  identifiant,
  nature: 'alerte',
  titre: 'Alerte fictive',
  resume: 'Résumé fictif.',
  adresse: `https://cert.cyber.gouv.fr/alerte/${identifiant}/`,
  publieLe: '2026-11-12T00:00:00.000Z',
  cves,
  cvesLues: true,
});
type Rapp = {
  id: string;
  cve: string;
  statut: string;
  motif: string | null;
  parIdentifiant: boolean;
  version: number;
  note: string;
  decidePar: string | null;
  annulation: { decision: string; par: string; le: string; note: string } | null;
  priorite: { niveau: string; faits: unknown[] };
  sources: { exploitation: { source: string; le: string | null }[] };
};
const rapps = async (id: string) =>
  ((await admin.get(`${V}/produits/${id}/fiche`)).json().rapprochements as Rapp[]).filter((r) => r.cve);
const rapp = async (id: string, cve: string) => (await rapps(id)).find((r) => r.cve === cve);
const versionProduit = async (id: string) => (await admin.get(`${V}/produits/${id}`)).json().version as number;
const faille = async (cve: string) =>
  (await lecteur.get(`${V}/veille/failles?q=${cve}`)).json().elements.find((f: { cve: string }) => f.cve === cve);
const empreinte = (titre: string) => createHash('sha256').update(titre, 'utf8').digest('hex').slice(0, 16);

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'src_admin', 'admin'));
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_src_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire']),
       ('r_src_modif', 'Vulnérabilités, modification', ARRAY['vulnerabilites:lire','vulnerabilites:modifier'])`,
  );
  const perim = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre fictif S', scope: 'x', timezone: 'Europe/Paris' })
  ).json().id as string;
  const uLecteur = await makeUser(t, 'src_lecteur', 'r_src_lire', { rattache: false });
  const uEditeur = await makeUser(t, 'src_editeur', 'r_src_modif', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($1, $3, true)', [
    perim,
    uLecteur.id,
    uEditeur.id,
  ]);
  lecteur = await login(t, uLecteur);
  editeur = await login(t, uEditeur);
  instance = (await t.svc.db.one<{ id: string }>(
    "INSERT INTO integrations (type, nom, created_by, updated_by) VALUES ('tenable', 'Tenable fictif', 'test', 'test') RETURNING id",
  ))!.id;
  await t.svc.db.q(
    'INSERT INTO vulnerabilites_tenable_etat (integration_id, numero, numero_complet) VALUES ($1, 1, 1)',
    [instance],
  );
  machine = (await t.svc.db.one<{ id: string }>(
    `INSERT INTO vulnerabilites_machines (integration_id, identifiant_source, nom, adresse, role, perimetre_id, vu_numero)
     VALUES ($1, 'ip:192.0.2.71', 'srv-src-1.exemple.invalid', '192.0.2.71', 'front', $2, 1) RETURNING id`,
    [instance, perim],
  ))!.id;
  await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('migration 078 sur base vierge', () => {
  it('ajoute les colonnes, les réserve au CERT Santé et borne les valeurs', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '078_vulnerabilites_sources.sql'"))?.ok,
    ).toBe(1);
    expect(await n('vulnerabilites_veille_avis', 'fiche_lue_le IS NOT NULL OR produit IS NOT NULL')).toBe(0);
    const avis = `INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, produit, fiche_lue_le, fiche_titre,
      fiche_exploitee) VALUES ($1, $2, 'alerte', 't', $3, $4, $5, $6)`;
    await expect(t.svc.db.q(avis, ['cert-fr', 'CERTFR-2026-ALE-099', 'Produit', null, null, null])).rejects.toThrow();
    await expect(t.svc.db.q(avis, ['cert-sante', '99', null, new Date(), null, null])).rejects.toThrow();
    await expect(t.svc.db.q(avis, ['cert-sante', '99', null, new Date(), 't', 'Oui'])).rejects.toThrow();
    await t.svc.db.q(avis, ['cert-sante', '99', 'Produit', new Date(), 't', 'oui']);
    await t.svc.db.q("DELETE FROM vulnerabilites_veille_avis WHERE identifiant = '99'");
    const pid = (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_produits (editeur, nom, version_produit, famille, criticite, created_by, updated_by)
       VALUES ('E', 'P', '1', 'web', 'faible', 't', 't') RETURNING id`,
    ))!.id;
    await t.svc.db.q("INSERT INTO vulnerabilites_veille_cve (cve) VALUES ('CVE-2026-99998')");
    const h = 'b'.repeat(64);
    const rp = `INSERT INTO vulnerabilites_rapprochements (produit_id, cve, statut, motif, par_identifiant, empreinte_produit,
      empreinte_cve, annulation_decision, annule_par, annule_le) VALUES ($1, 'CVE-2026-99998', 'proposee', $2, false, $3, $3, $4, $5, $6)`;
    await expect(t.svc.db.q(rp, [pid, 'inconnu', h, null, null, null])).rejects.toThrow();
    await expect(t.svc.db.q(rp, [pid, 'avis_seulement', h, 'confirmee', null, null])).rejects.toThrow();
    await expect(t.svc.db.q(rp, [pid, 'avis_seulement', h, 'annulee', 'x', new Date()])).rejects.toThrow();
    await t.svc.db.q(rp, [pid, 'avis_seulement', h, 'rejetee', 'x', new Date()]);
    await t.svc.db.q('DELETE FROM vulnerabilites_produits WHERE id = $1', [pid]);
    await t.svc.db.q("DELETE FROM vulnerabilites_veille_cve WHERE cve = 'CVE-2026-99998'");
  });
});

describe('fiches du CERT Santé (V23) : réception et stockage avec provenance', () => {
  it('mentions rangées sur la publication, avec la date du premier signalement ; gardées si la fiche n’est pas relue', async () => {
    await collecte('cert-sante', [
      certSante('40001', 'CVE-2026-94001', {
        fiche: fiche({ exploitee: 'oui', preuveConcept: 'disponible', cvss31: 9.8 }),
      }),
      certSante('40002', 'CVE-2026-94002', { fiche: null, produit: null, titre: 'Sans forme attendue CVE-2026-94002' }),
    ]);
    const lire = async (id: string) =>
      (await t.svc.db.one<Record<string, unknown>>(
        `SELECT produit, produit_norm, fiche_titre, fiche_exploitee, fiche_correctif, fiche_contournement, fiche_preuve,
                fiche_cvss31::float AS cvss, fiche_exploitee_le, fiche_preuve_le, fiche_lue_le IS NOT NULL AS lue
         FROM vulnerabilites_veille_avis WHERE source = 'cert-sante' AND identifiant = $1`,
        [id],
      ))!;
    const a = await lire('40001');
    expect(a).toMatchObject({
      produit: 'Logiciel fictif',
      produit_norm: 'logiciel_fictif',
      fiche_titre: 'Logiciel fictif - CVE-2026-94001',
      fiche_exploitee: 'oui',
      fiche_correctif: 'oui',
      fiche_contournement: 'non',
      fiche_preuve: 'disponible',
      cvss: 9.8,
      lue: true,
    });
    // Mention présente dès la première lecture : date de publication de la source.
    expect((a.fiche_exploitee_le as Date).toISOString()).toBe('2026-11-10T02:28:01.000Z');
    expect((a.fiche_preuve_le as Date).toISOString()).toBe('2026-11-10T02:28:01.000Z');
    expect(await lire('40002')).toMatchObject({ produit: null, fiche_exploitee: null, lue: false });
    // Collecte suivante sans relire la fiche : les mentions sont gardées.
    await collecte('cert-sante', [certSante('40001', 'CVE-2026-94001', { fiche: null })]);
    expect(await lire('40001')).toMatchObject({ fiche_exploitee: 'oui', cvss: 9.8 });
    // La source change d'avis : mention « non », date effacée ; puis de nouveau « oui » : date de la lecture.
    await collecte('cert-sante', [certSante('40001', 'CVE-2026-94001', { fiche: fiche({ exploitee: 'non' }) })]);
    expect(await lire('40001')).toMatchObject({
      fiche_exploitee: 'non',
      fiche_exploitee_le: null,
      fiche_preuve: 'indisponible',
    });
    const avant = Date.now();
    await collecte('cert-sante', [certSante('40001', 'CVE-2026-94001', { fiche: fiche({ exploitee: 'oui' }) })]);
    const relue = await lire('40001');
    expect((relue.fiche_exploitee_le as Date).getTime()).toBeGreaterThanOrEqual(avant - 1000);
    // La publication est lisible avec ses mentions, telles quelles.
    const liste = (await lecteur.get(`${V}/veille/avis?source=cert-sante&q=CVE-2026-94001`)).json();
    expect(liste.elements[0]).toMatchObject({
      produit: 'Logiciel fictif',
      fiche: { exploitee: 'oui', correctif: 'oui', contournement: 'non', preuveConcept: 'indisponible', cvss31: 7.5 },
    });
  });

  it('le script reçoit l’empreinte du titre des fiches lues depuis moins de sept jours ; l’état dit ce qui reste à lire', async () => {
    const job = await collecte('cert-sante', []);
    expect(job.parametres).toEqual({ lues: { '40001': empreinte('Logiciel fictif - CVE-2026-94001') } });
    // Lecture plus ancienne que le délai : la fiche n'est plus remise, elle sera relue.
    await t.svc.db.q(
      "UPDATE vulnerabilites_veille_avis SET fiche_lue_le = now() - interval '8 days' WHERE identifiant = '40001'",
    );
    expect((await collecte('cert-sante', [])).parametres).toEqual({ lues: {} });
    const etat = (await lecteur.get(`${V}/veille/etat`)).json();
    expect(etat.fichesCertSante).toMatchObject({ lues: 0, aLire: 2, relectureJours: 7 });
    expect(etat.sources.find((s: { source: string }) => s.source === 'cert-sante').demande).toMatch(/30 au plus/);
    await t.svc.db.q("UPDATE vulnerabilites_veille_avis SET fiche_lue_le = now() WHERE identifiant = '40001'");
    // Titre du flux modifié depuis la lecture : à relire.
    await collecte('cert-sante', [
      certSante('40001', 'CVE-2026-94001', {
        titre: 'Logiciel fictif - CVE-2026-94001 | modifié le 16-11-2026',
        fiche: null,
      }),
    ]);
    expect((await lecteur.get(`${V}/veille/etat`)).json().fichesCertSante).toMatchObject({ lues: 0, aLire: 2 });
    // Publication sortie du flux (pas revue depuis plus de 48 heures) : elle ne compte plus.
    await t.svc.db.q(
      "UPDATE vulnerabilites_veille_avis SET maj_le = now() - interval '3 days' WHERE identifiant = '40002'",
    );
    expect((await lecteur.get(`${V}/veille/etat`)).json().fichesCertSante).toMatchObject({ lues: 0, aLire: 1 });
  });
});

describe('une CVE est suivie dès qu’une source la publie (V26)', () => {
  it('connue par le CERT Santé avant NVD, avec ce que la source en dit ; NVD complète sans rien effacer', async () => {
    await collecte('cert-sante', [
      certSante('40010', 'CVE-2026-94010', {
        fiche: fiche({ exploitee: 'oui', preuveConcept: 'disponible', cvss31: 9.8 }),
      }),
    ]);
    const avant = await faille('CVE-2026-94010');
    expect(avant).toMatchObject({
      cve: 'CVE-2026-94010',
      publieLe: null,
      cvss31: null,
      publications: [{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }],
      produitsCites: ['Logiciel fictif'],
      sources: {
        exploitation: [{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }],
        exploitable: [{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }],
        valeurs: {
          gravites: [{ source: 'cert-sante', gravite: 'critique' }],
          cvss: [{ source: 'cert-sante', score: 9.8 }],
        },
        certSante: { correctif: 'oui', contournement: 'non' },
      },
    });
    // Recherche par le produit cité.
    expect(
      (await lecteur.get(`${V}/veille/failles?q=logiciel`)).json().elements.map((f: { cve: string }) => f.cve),
    ).toContain('CVE-2026-94010');
    await collecte('nvd', [nvd('CVE-2026-94010')]);
    const apres = await faille('CVE-2026-94010');
    expect(apres.publications).toEqual([
      { source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' },
      { source: 'nvd', le: '2026-11-15T10:00:00.000Z' },
    ]);
    expect(apres.sources.valeurs.cvss).toEqual([
      { source: 'nvd', score: 7.5 },
      { source: 'cert-sante', score: 9.8 },
    ]);
    expect(apres.sources.exploitation).toEqual(avant.sources.exploitation);
    expect(await n('vulnerabilites_veille_avis', "identifiant = '40010' AND fiche_exploitee = 'oui'")).toBe(1);
  });
});

describe('rapprochement par le nom d’une CVE absente de NVD (V26)', () => {
  it('proposée par le nom, même pour un produit à identifiant ; jamais pour un avis sans produit', async () => {
    await collecte('cert-sante', [certSante('40020', 'CVE-2026-94020')]);
    await collecte('cert-fr', [alerteCertFr('CERTFR-2026-ALE-020', ['CVE-2026-94021'])]);
    const cree = async (corps: Record<string, unknown>) => {
      const r = await editeur.post(`${V}/produits`, {
        editeur: 'Éditeur fictif',
        versionProduit: '2.0',
        famille: 'applications_metier',
        criticite: 'elevee',
        ...corps,
      });
      expect(r.statusCode, r.body).toBe(201);
      return r.json() as { id: string; version: number };
    };
    pCpe = await cree({ nom: 'Logiciel fictif', cpe: CPE });
    pNom = await cree({ nom: 'Logiciel fictif', versionProduit: '2.1' });
    // « éditeur nom » : « Logiciel » + « Fictif » vaut « Logiciel fictif » ; dans l'autre ordre, non.
    const pEditeurNom = await cree({ editeur: 'Logiciel', nom: 'Fictif' });
    const pInverse = await cree({ editeur: 'Fictif', nom: 'Logiciel' });
    const sansRapport = await cree({ nom: 'Autre logiciel' });
    for (const p of [pCpe, pNom, pEditeurNom])
      expect(await rapp(p.id, 'CVE-2026-94020'), p.id).toMatchObject({
        statut: 'proposee',
        motif: 'avis_seulement',
        parIdentifiant: false,
        priorite: { niveau: 'P4' },
      });
    for (const p of [pInverse, sansRapport]) expect(await rapps(p.id)).toEqual([]);
    // Une alerte du CERT-FR ne cite aucun produit : pas de rapprochement par le nom.
    expect((await rapps(pCpe.id)).map((r) => r.cve)).not.toContain('CVE-2026-94021');
  });

  it('NVD publie la CVE avec ses plages : la règle par version s’applique, une décision n’est pas écrasée à données égales', async () => {
    // Avant NVD : le produit à identifiant voit sa proposition confirmée ; le produit par nom la voit rejetée.
    await collecte('cert-sante', [certSante('40030', 'CVE-2026-94030'), certSante('40031', 'CVE-2026-94031')]);
    const decider = async (pid: string, cve: string, decision: string) => {
      const r = (await rapp(pid, cve))!;
      const d = await editeur.post(`${V}/rapprochements/${r.id}/decision`, { decision }, ifMatch(r.version));
      expect(d.statusCode, d.body).toBe(200);
    };
    await decider(pCpe.id, 'CVE-2026-94030', 'confirmer');
    await decider(pNom.id, 'CVE-2026-94030', 'rejeter');
    // Publication du CERT Santé rejouée à l'identique : rien ne change.
    await collecte('cert-sante', [certSante('40030', 'CVE-2026-94030')]);
    expect((await rapp(pCpe.id, 'CVE-2026-94030'))!.statut).toBe('confirmee');
    expect((await rapp(pNom.id, 'CVE-2026-94030'))!.statut).toBe('rejetee');
    // NVD publie 94030 et 94031 (version 2.0 dans la plage < 3.0).
    await collecte('nvd', [nvd('CVE-2026-94030'), nvd('CVE-2026-94031')]);
    // Confirmation gardée (version inchangée) ; rejet reproposé (données changées), par le nom (produit sans identifiant).
    expect((await rapp(pCpe.id, 'CVE-2026-94030'))!.statut).toBe('confirmee');
    expect(await rapp(pNom.id, 'CVE-2026-94030')).toMatchObject({ statut: 'proposee', motif: 'nom_seulement' });
    // Sans décision : rattachée d'office pour le produit à identifiant.
    expect(await rapp(pCpe.id, 'CVE-2026-94031')).toMatchObject({ statut: 'rattachee', parIdentifiant: true });
    // NVD publie une CVE sans produit touché vulnérable : le rapprochement par le nom reste proposé.
    await collecte('nvd', [nvd('CVE-2026-94020', { produitsTouches: [] })]);
    expect((await rapp(pCpe.id, 'CVE-2026-94020'))!.motif).toBe('avis_seulement');
  });
});

describe('annulation d’une décision (V24)', () => {
  it('droits, If-Match, décision exigée ; confirmation annulée : à décider de nouveau, tracé et journalisé', async () => {
    const r = (await rapp(pNom.id, 'CVE-2026-94031'))!;
    expect(r.statut).toBe('proposee');
    const url = (id: string) => `${V}/rapprochements/${id}/annulation`;
    expect((await editeur.post(url(r.id), {}, ifMatch(r.version))).statusCode).toBe(409);
    await editeur.post(`${V}/rapprochements/${r.id}/decision`, { decision: 'confirmer' }, ifMatch(r.version));
    const c = (await rapp(pNom.id, 'CVE-2026-94031'))!;
    expect(c.statut).toBe('confirmee');
    expect((await lecteur.post(url(c.id), {}, ifMatch(c.version))).statusCode).toBe(403);
    expect((await editeur.post(url(c.id), {})).statusCode).toBe(428);
    expect((await editeur.post(url(c.id), {}, ifMatch(c.version + 3))).statusCode).toBe(412);
    expect((await editeur.post(url(c.id), { note: 'a\u0007' }, ifMatch(c.version))).statusCode).toBe(422);
    expect((await editeur.post(url('00000000-0000-4000-8000-000000000999'), {}, ifMatch(1))).statusCode).toBe(404);
    const ok = await editeur.post(url(c.id), { note: 'Confirmée par erreur.' }, ifMatch(c.version));
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ id: c.id, statut: 'proposee' });
    expect(ok.headers.etag).toBe(`"${ok.json().version}"`);
    const apres = (await rapp(pNom.id, 'CVE-2026-94031'))!;
    expect(apres).toMatchObject({
      statut: 'proposee',
      motif: 'nom_seulement',
      decidePar: null,
      note: '',
      annulation: { decision: 'confirmee', par: 'src_editeur', note: 'Confirmée par erreur.' },
    });
    expect((await audits('vulnerabilites.rapprochement.annule')).at(-1)).toMatchObject({
      username: 'src_editeur',
      target: c.id,
      details: {
        produit: pNom.id,
        cve: 'CVE-2026-94031',
        decisionAnnulee: { statut: 'confirmee', par: 'src_editeur', versionProduit: '2.1' },
        statut: 'proposee',
        note: 'Confirmée par erreur.',
      },
    });
    // Annuler deux fois : plus de décision.
    expect((await editeur.post(url(c.id), {}, ifMatch(apres.version))).statusCode).toBe(409);
  });

  it('confirmation annulée alors que la règle d’office tranche désormais : rattachée d’office ; rejet annulé : à décider', async () => {
    // 94030 confirmée avant NVD, gardée après ; NVD donne maintenant une plage qui contient 2.0.
    const c = (await rapp(pCpe.id, 'CVE-2026-94030'))!;
    expect(c.statut).toBe('confirmee');
    const a = await editeur.post(`${V}/rapprochements/${c.id}/annulation`, {}, ifMatch(c.version));
    expect(a.statusCode, a.body).toBe(200);
    expect(a.json().statut).toBe('rattachee');
    expect(await rapp(pCpe.id, 'CVE-2026-94030')).toMatchObject({
      statut: 'rattachee',
      decidePar: null,
      annulation: { decision: 'confirmee', par: 'src_editeur', note: '' },
    });
    // Rejet annulé : de nouveau à décider, avec son motif.
    const p = (await rapp(pNom.id, 'CVE-2026-94030'))!;
    expect(p.statut).toBe('proposee');
    await editeur.post(`${V}/rapprochements/${p.id}/decision`, { decision: 'rejeter' }, ifMatch(p.version));
    const r = (await rapp(pNom.id, 'CVE-2026-94030'))!;
    expect(r.statut).toBe('rejetee');
    const b = await editeur.post(
      `${V}/rapprochements/${r.id}/annulation`,
      { note: 'Rejet hâtif.' },
      ifMatch(r.version),
    );
    expect(b.statusCode, b.body).toBe(200);
    expect(await rapp(pNom.id, 'CVE-2026-94030')).toMatchObject({
      statut: 'proposee',
      motif: 'nom_seulement',
      annulation: { decision: 'rejetee', note: 'Rejet hâtif.' },
    });
    expect((await audits('vulnerabilites.rapprochement.annule')).at(-1)!.details).toMatchObject({
      decisionAnnulee: { statut: 'rejetee', versionProduit: '2.1' },
      statut: 'proposee',
    });
  });

  it('confirmation annulée sur une faille déclarée : le suivi propose « corrigée », comme tout retrait de rattachement', async () => {
    // pNom relié à la machine ; 94031 confirmée de nouveau, puis annulée.
    const v = await versionProduit(pNom.id);
    expect(
      (await editeur.post(`${V}/produits/${pNom.id}/machines`, { machineId: machine }, ifMatch(v))).statusCode,
    ).toBe(200);
    const r = (await rapp(pNom.id, 'CVE-2026-94031'))!;
    await editeur.post(`${V}/rapprochements/${r.id}/decision`, { decision: 'confirmer' }, ifMatch(r.version));
    const declarees = (await editeur.get(`${V}/declarees?q=CVE-2026-94031`)).json();
    expect(declarees.total).toBe(1);
    const c = (await rapp(pNom.id, 'CVE-2026-94031'))!;
    const ok = await editeur.post(`${V}/rapprochements/${c.id}/annulation`, { note: 'À revoir.' }, ifMatch(c.version));
    expect(ok.statusCode, ok.body).toBe(200);
    const s = (await editeur.get(`${V}/suivis/declaree/${c.id}`)).json();
    expect(s).toMatchObject({ proposition: 'a_confirmer', present: false });
    expect(s.historique[0]).toMatchObject({ evenement: 'proposition', auteur: 'système' });
    // Confirmée de nouveau : la proposition « corrigée » est retirée.
    const c2 = (await rapp(pNom.id, 'CVE-2026-94031'))!;
    await editeur.post(`${V}/rapprochements/${c2.id}/decision`, { decision: 'confirmer' }, ifMatch(c2.version));
    expect((await editeur.get(`${V}/suivis/declaree/${c.id}`)).json()).toMatchObject({
      proposition: 'aucune',
      present: true,
    });
  });
});

describe('exploitation, « exploitable » et valeur la plus sévère, par chaque source et par plusieurs', () => {
  it('faille déclarée : exploitation avérée par la seule fiche du CERT Santé (P1), sources et date de la première', async () => {
    // 94031 : confirmée et reliée à la machine. Le CERT Santé publie « activement exploitée : Oui ».
    await collecte('cert-sante', [
      certSante('40031', 'CVE-2026-94031', {
        fiche: fiche({ exploitee: 'oui', preuveConcept: 'disponible', cvss31: 9.1 }),
      }),
    ]);
    const d = (await editeur.get(`${V}/declarees?q=CVE-2026-94031`)).json().elements[0];
    expect(d.priorite).toEqual({
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['cert-sante'] },
        { fait: 'presence', presence: 'declaree' },
      ],
    });
    // La fiche avait été lue sans la mention : la date est celle de la lecture qui l'a vue.
    expect(d.sources.exploitation).toEqual([{ source: 'cert-sante', le: expect.any(String) }]);
    expect(Date.parse(d.sources.exploitation[0].le)).toBeGreaterThan(Date.parse('2026-11-10T02:28:01.000Z'));
    expect(d.sources.exploitable).toEqual([{ source: 'cert-sante', le: expect.any(String) }]);
    // Gravité retenue : la plus sévère (CERT Santé 9,1, critique ; NVD 7,5, élevée), chaque valeur gardée.
    expect(d).toMatchObject({ gravite: 'critique', cvssScore: 9.1 });
    expect(d.sources.valeurs.gravites).toEqual([
      { source: 'nvd', gravite: 'elevee' },
      { source: 'cert-sante', gravite: 'critique' },
    ]);
    // Puis le catalogue KEV et une alerte du CERT-FR, datés plus tôt : trois sources, la plus ancienne d'abord.
    await collecte('cisa-kev', [kev('CVE-2026-94031')]);
    await collecte('cert-fr', [alerteCertFr('CERTFR-2026-ALE-031', ['CVE-2026-94031'])]);
    const d2 = (await editeur.get(`${V}/declarees?q=CVE-2026-94031`)).json().elements[0];
    expect(d2.sources.exploitation).toEqual([
      { source: 'cert-fr', le: '2026-11-12T00:00:00.000Z' },
      { source: 'kev', le: '2026-11-13T00:00:00.000Z' },
      { source: 'cert-sante', le: d.sources.exploitation[0].le },
    ]);
    expect(d2.priorite.faits[0]).toEqual({ fait: 'exploitation', sources: ['kev', 'cert-fr', 'cert-sante'] });
    // Le rang de la machine compte l'exploitation avérée.
    expect((await editeur.get(`${V}/machines/${machine}`)).json().compteurs.exploitationAveree).toBeGreaterThanOrEqual(
      1,
    );
    // Fiche du produit : même priorité, mêmes sources.
    expect((await rapp(pNom.id, 'CVE-2026-94031'))!.priorite.niveau).toBe('P1');
  });

  it('constat de Tenable : « exploitable » par le CERT Santé, gravité la plus sévère, filtres multi-sources ; rejouable', async () => {
    await collecte('cert-sante', [
      certSante('40040', 'CVE-2026-94040', {
        fiche: fiche({ exploitee: 'non', preuveConcept: 'disponible', cvss31: 8.1 }),
      }),
      certSante('40041', 'CVE-2026-94041', { fiche: fiche({ exploitee: 'oui', cvss31: 5.0 }) }),
    ]);
    const detecter = async (plugin: number, cves: string[], gravite: string, cvss3: number | null) => {
      const c = (await t.svc.db.one<{ id: string }>(
        `INSERT INTO vulnerabilites_constats (integration_id, plugin_id, nom, gravite, exploitable, cvss3_score, vu_numero)
         VALUES ($1, $2, $3, $4, false, $5, 1) RETURNING id`,
        [instance, plugin, `Contrôle fictif ${plugin}`, gravite, cvss3],
      ))!.id;
      for (const cve of cves)
        await t.svc.db.q('INSERT INTO vulnerabilites_constat_cves (constat_id, cve) VALUES ($1, $2)', [c, cve]);
      await t.svc.db.q(
        "INSERT INTO vulnerabilites_detections (constat_id, machine_id, port, protocole, vu_numero) VALUES ($1, $2, 0, 'TCP', 1)",
        [c, machine],
      );
    };
    // Tenable dit « moyenne » (5,0) ; le CERT Santé 8,1 (élevée) et une preuve de concept : P2 (présente, élevée, exploitable).
    await detecter(940040, ['CVE-2026-94040'], 'moyenne', 5.0);
    // Exploitation avérée selon le seul CERT Santé : P1.
    await detecter(940041, ['CVE-2026-94041'], 'faible', null);
    const lire = async (q: string) => (await editeur.get(`${V}/constats${q}`)).json();
    const c40 = (await lire('?q=940040')).elements[0];
    expect(c40.priorite).toEqual({
      niveau: 'P2',
      faits: [
        { fait: 'presence', presence: 'detectee' },
        { fait: 'gravite', gravite: 'elevee' },
        { fait: 'exploit_disponible', sources: ['cert-sante'] },
      ],
    });
    expect(c40.gravite).toBe('moyenne');
    expect(c40.sources.valeurs).toEqual({
      gravites: [
        { source: 'tenable', gravite: 'moyenne' },
        { source: 'cert-sante', gravite: 'elevee' },
      ],
      cvss: [
        { source: 'tenable', score: 5 },
        { source: 'cert-sante', score: 8.1 },
      ],
      epss: [],
    });
    expect(c40.sources.certSante).toEqual({ correctif: 'oui', contournement: 'non' });
    const c41 = (await lire('?q=940041')).elements[0];
    expect(c41.priorite.niveau).toBe('P1');
    expect(c41.sources.exploitation).toEqual([{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }]);
    // Filtres : « exploitée » et « exploitable » valent pour toutes les sources.
    const plugins = async (q: string) => ((await lire(q)).elements as { plugin: string }[]).map((x) => x.plugin).sort();
    expect(await plugins('?exploite=oui')).toEqual(['940041']);
    expect(await plugins('?exploitable=oui')).toEqual(['940040']);
    // Rejouable : mêmes faits, même résultat.
    expect(await lire('')).toEqual(await lire(''));
  });
});
