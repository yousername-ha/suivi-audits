/* Déclaration réglementaire des incidents (ADR 0105) : propositions à la qualification horodatée, préparation, gestes réservés
   au rôle « RSSI », envoi figé (déclencheur en base), complément, suppression refusée, correction de la date de qualification,
   périmètre (404), export Word et rappels (idempotents, indépendants du module des écarts). Données fictives. */
import zlib from 'node:zlib';
import { NOTIFICATION_TYPES_VULNERABILITES, plusUnMois } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rappelsDeclarationsIncidents } from '../src/automate-declarations.js';
import { createTestApp, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

const HEURE = 3_600_000;
let t: TestApp, admin: Agent, rssi: Agent, redacteur: Agent, lecteur: Agent, autre: Agent, rssiAilleurs: Agent;
let rssiId = '',
  responsableId = '';
let incident = '',
  incident2 = '';
let qualifieeLe = '';

interface Decl {
  id: string;
  regime: string;
  etape: string;
  statut: string;
  version: number;
  depart: string | null;
  echeance: string | null;
  reference: string;
  motif: string | null;
  lieeA: string | null;
  envoi: { par: string; le: string; reference: string } | null;
  rubriques: { cle: string; valeur: string; modifiee: boolean; source: string }[];
}
const vue = async (a: Agent, id = incident) => (await a.get(`/api/incidents/${id}/declarations`)).json();
const decl = async (regime: string, etape: string, id = incident): Promise<Decl> =>
  ((await vue(admin, id)).declarations as Decl[]).find((d) => d.regime === regime && d.etape === etape)!;
const url = (d: Decl, suite = '', id = incident) => `/api/incidents/${id}/declarations/${d.id}${suite}`;
const im = (d: Decl) => ({ 'if-match': `"${d.version}"` });

/** Texte d'une partie d'une archive ZIP (lecture minimale, comme export-revue.test.ts). */
function partie(buf: Buffer, nom: string): string {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  for (let i = 0; i < n; i++) {
    const methode = buf.readUInt16LE(p + 10),
      taille = buf.readUInt32LE(p + 20),
      lg = buf.readUInt16LE(p + 28),
      extra = buf.readUInt16LE(p + 30),
      com = buf.readUInt16LE(p + 32),
      local = buf.readUInt32LE(p + 42),
      x = buf.subarray(p + 46, p + 46 + lg).toString('utf8');
    if (x === nom) {
      const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const brut = buf.subarray(debut, debut + taille);
      return (methode === 8 ? zlib.inflateRawSync(brut) : brut).toString('utf8');
    }
    p += 46 + lg + extra + com;
  }
  return '';
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'decl_admin', 'admin'));
  const r = await makeUser(t, 'decl_rssi', 'rssi');
  rssiId = r.id;
  rssi = await login(t, r);
  redacteur = await login(t, await makeUser(t, 'decl_redacteur', 'rw'));
  lecteur = await login(t, await makeUser(t, 'decl_lecteur', 'ro'));
  const resp = await makeUser(t, 'decl_responsable', 'rw');
  responsableId = resp.id;
  const s = (await admin.get('/api/suivi/etat')).json();
  s.entityCategory = 'essentielle';
  s.findings = [];
  // Incident qualifié avant cette version : pas de date de qualification, aucune proposition rétroactive.
  s.incidents = [{ id: 'INC-2025-900', title: 'Ancien fictif', kind: 'Incident de sécurité', status: 'Qualifié' }];
  await seedState(t, s);
  const e = (await admin.get('/api/settings/etablissement')).json();
  const ok = await admin.put(
    '/api/settings/etablissement',
    {
      ...e.values,
      raisonSociale: 'Établissement fictif',
      finessJuridique: '990000001',
      arsRattachement: 'ARS fictive',
    },
    { 'if-match': `"${e.version}"` },
  );
  expect(ok.statusCode, ok.body).toBe(200);
  // Un autre périmètre, et des comptes qui n'ont accès qu'à lui.
  const ailleurs = (
    await admin.post('/api/grc/smsis', { name: 'Ailleurs fictif', scope: 'A', timezone: 'Europe/Paris' })
  ).json().id;
  const comptes = {
    autre: await makeUser(t, 'decl_autre', 'rw', { rattache: false }),
    rssiAilleurs: await makeUser(t, 'decl_rssi_ailleurs', 'rssi', { rattache: false }),
  };
  for (const u of Object.values(comptes))
    expect((await admin.put(`/api/grc/${ailleurs}/members`, { userId: u.id, write: true })).statusCode).toBe(204);
  autre = await login(t, comptes.autre);
  rssiAilleurs = await login(t, comptes.rssiAilleurs);
});
afterAll(() => t.close());

describe('propositions à la qualification', () => {
  it('le premier passage à « Incident de sécurité » horodate la qualification et propose santé et NIS 2', async () => {
    const avant = Date.now();
    const c = await redacteur.post('/api/incidents', {
      title: 'Chiffrement fictif',
      answers: { cia: 'oui', sante: 'nsp' },
    });
    expect(c.statusCode, c.body).toBe(201);
    incident = c.json().id;
    qualifieeLe = c.json().qualifiedAt;
    expect(Date.parse(qualifieeLe)).toBeGreaterThanOrEqual(avant - 1000);
    const v = await vue(redacteur);
    expect(v.qualifieeLe).toBe(qualifieeLe);
    expect(v.peutDeclarer).toBe(false);
    expect(v.peutPreparer).toBe(true);
    expect((await vue(rssi)).peutDeclarer).toBe(true);
    const l = v.declarations as Decl[];
    expect(l.map((d) => `${d.regime}/${d.etape}/${d.statut}`).sort()).toEqual([
      'nis2/alerte_precoce/proposee',
      'nis2/notification/proposee',
      'nis2/rapport_final/proposee',
      'sante/signalement/proposee',
    ]);
    const q = Date.parse(qualifieeLe);
    expect(Date.parse((await decl('nis2', 'alerte_precoce')).echeance!)).toBe(q + 24 * HEURE);
    expect(Date.parse((await decl('nis2', 'notification')).echeance!)).toBe(q + 72 * HEURE);
    expect((await decl('nis2', 'rapport_final')).echeance).toBeNull();
    expect((await decl('sante', 'signalement')).echeance).toBeNull();
    const journal = await t.svc.db.q<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action = 'incident.declaration.proposee' AND target = $1",
      [`legacy:incidents:${incident}`],
    );
    expect(journal.rows[0]!.n).toBe(4);
    // Rappel de qualification aussitôt, au RSSI (le rédacteur n'a pas le rôle et n'est pas responsable).
    const n = await t.svc.db.q<{ user_id: string; title: string }>(
      "SELECT user_id::text, title FROM grc_notifications WHERE kind = 'incident_declaration'",
    );
    expect(n.rows.length).toBe(4);
    expect(new Set(n.rows.map((x) => x.user_id))).toEqual(new Set([rssiId]));
    // Le titre (repris dans le courriel) ne dit ni le régime ni le contenu.
    for (const x of n.rows) {
      expect(x.title).toMatch(new RegExp(`^Déclaration réglementaire de l’incident ${incident} : `));
      expect(x.title).not.toMatch(/santé|NIS|Chiffrement/i);
    }
  });

  it('par modification : une seule fois, et rien pour un incident qualifié avant cette version', async () => {
    const c = (await redacteur.post('/api/incidents', { title: 'Panne fictive' })).json().id as string;
    incident2 = c;
    expect((await vue(redacteur, c)).declarations).toEqual([]);
    const p = await redacteur.patch(`/api/incidents/${c}`, { kind: 'Incident de sécurité' });
    expect(p.statusCode, p.body).toBe(200);
    const premiere = p.json().qualifiedAt as string;
    expect(premiere).not.toBe('');
    // Sans données de santé : NIS 2 seulement.
    expect(((await vue(redacteur, c)).declarations as Decl[]).map((d) => d.regime)).toEqual(['nis2', 'nis2', 'nis2']);
    await redacteur.patch(`/api/incidents/${c}`, { kind: 'Incident' });
    const retour = await redacteur.patch(`/api/incidents/${c}`, { kind: 'Incident de sécurité' });
    expect(retour.json().qualifiedAt).toBe(premiere);
    expect((await vue(redacteur, c)).declarations).toHaveLength(3);
    await redacteur.patch('/api/incidents/INC-2025-900', { title: 'Ancien fictif modifié' });
    const ancien = await vue(redacteur, 'INC-2025-900');
    expect(ancien.qualifieeLe).toBeNull();
    expect(ancien.declarations).toEqual([]);
  });
});

describe('préparation', () => {
  it('pré-remplit depuis la fiche et l’identité de l’établissement ; incidents:modifier et If-Match', async () => {
    await redacteur.patch(`/api/incidents/${incident}`, { desc: 'Serveurs chiffrés (fictif).', actions: 'Isolement.' });
    const d = await decl('sante', 'signalement');
    const valeur = (cle: string) => d.rubriques.find((x) => x.cle === cle)!.valeur;
    expect(valeur('identite')).toContain('Raison sociale : Établissement fictif');
    expect(valeur('identite')).toContain('ARS de rattachement : ARS fictive');
    expect(valeur('description')).toBe('Chiffrement fictif\nServeurs chiffrés (fictif).');
    expect(valeur('mesures')).toBe('Isolement.');
    expect(d.rubriques.every((x) => x.source.length > 10)).toBe(true);
    const corps = { rubriques: { consequences_patients: 'Report de consultations (fictif).' }, reference: 'DOSSIER-1' };
    expect((await lecteur.patch(url(d), corps, im(d))).statusCode).toBe(403);
    expect((await redacteur.patch(url(d), corps)).statusCode).toBe(428);
    expect((await redacteur.patch(url(d), { rubriques: { inconnue: 'x' } }, im(d))).statusCode).toBe(422);
    const r = await redacteur.patch(url(d), corps, im(d));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers.etag).toBe(`"${d.version + 1}"`);
    expect(r.json().reference).toBe('DOSSIER-1');
    expect(r.json().rubriques.find((x: { cle: string }) => x.cle === 'consequences_patients')).toMatchObject({
      valeur: 'Report de consultations (fictif).',
      modifiee: true,
    });
    expect((await redacteur.patch(url(d), corps, im(d))).statusCode).toBe(412);
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action = 'incident.declaration.preparee'")).rows.length,
    ).toBe(1);
  });
});

describe('gestes réservés au rôle RSSI', () => {
  it('confirmer : 403 pour le rédacteur et pour l’administrateur, accepté pour le RSSI', async () => {
    const d = await decl('nis2', 'alerte_precoce');
    expect((await redacteur.post(url(d, '/confirmation'), {}, im(d))).statusCode).toBe(403);
    expect((await admin.post(url(d, '/confirmation'), {}, im(d))).statusCode).toBe(403);
    const r = await rssi.post(url(d, '/confirmation'), {}, im(d));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ statut: 'a_declarer', decision: { par: 'Nom decl_rssi' } });
    expect((await rssi.post(url(d, '/confirmation'), {}, { 'if-match': `"${r.json().version}"` })).statusCode).toBe(
      409,
    );
  });

  it('écarter « non requise » : motif obligatoire, figé', async () => {
    const d = await decl('nis2', 'rapport_final');
    expect((await rssi.post(url(d, '/mise-a-l-ecart'), { motif: ' ' }, im(d))).statusCode).toBe(422);
    expect((await admin.post(url(d, '/mise-a-l-ecart'), { motif: 'x' }, im(d))).statusCode).toBe(403);
    const r = await rssi.post(url(d, '/mise-a-l-ecart'), { motif: 'Incident non important (fictif).' }, im(d));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ statut: 'non_requise', motif: 'Incident non important (fictif).' });
    const v = { 'if-match': `"${r.json().version}"` };
    expect((await rssi.post(url(d, '/mise-a-l-ecart'), { motif: 'Autre' }, v)).statusCode).toBe(409);
    expect((await redacteur.patch(url(d), { reference: 'X' }, v)).statusCode).toBe(409);
  });

  it('marquer envoyée : référence obligatoire, texte figé, échéance du rapport final après la notification', async () => {
    const d = await decl('sante', 'signalement');
    expect((await rssi.post(url(d, '/envoi'), { reference: '' }, im(d))).statusCode).toBe(422);
    expect((await redacteur.post(url(d, '/envoi'), { reference: 'AR-1' }, im(d))).statusCode).toBe(403);
    const r = await rssi.post(url(d, '/envoi'), { reference: 'AR-SANTE-0001' }, im(d));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ statut: 'envoyee', envoi: { par: 'Nom decl_rssi', reference: 'AR-SANTE-0001' } });
    // La fiche change ensuite : le texte transmis ne bouge pas.
    await redacteur.patch(`/api/incidents/${incident}`, { desc: 'Description réécrite après l’envoi.' });
    const figee = await decl('sante', 'signalement');
    expect(figee.rubriques.find((x) => x.cle === 'description')!.valeur).toBe(
      'Chiffrement fictif\nServeurs chiffrés (fictif).',
    );
    expect(figee.rubriques.find((x) => x.cle === 'consequences_patients')!.valeur).toBe(
      'Report de consultations (fictif).',
    );
    // Notification NIS 2 envoyée : l'échéance du rapport final part de l'envoi (un mois calendaire).
    const n = await decl('nis2', 'notification', incident2);
    const env = await rssi.post(url(n, '/envoi', incident2), { reference: 'ANSSI-0001' }, im(n));
    expect(env.statusCode, env.body).toBe(200);
    const rf = await decl('nis2', 'rapport_final', incident2);
    expect(rf.depart).toBe(env.json().envoi.le);
    expect(rf.echeance).toBe(plusUnMois(env.json().envoi.le));
    // Le rapport final écarté de l'incident principal reste figé, sans échéance, et ne se rouvre pas à la main.
    expect((await decl('nis2', 'rapport_final')).echeance).toBeNull();
    expect(
      (await rssi.post(`/api/incidents/${incident}/declarations`, { regime: 'nis2', etape: 'rapport_final' }))
        .statusCode,
    ).toBe(409);
  });

  it('ouvrir à la main : rôle RSSI, date de qualification connue, pas de doublon', async () => {
    const c = (await redacteur.post('/api/incidents', { title: 'Sans santé fictif', answers: { cia: 'oui' } })).json()
      .id as string;
    const corps = { regime: 'sante', etape: 'signalement' };
    expect((await redacteur.post(`/api/incidents/${c}/declarations`, corps)).statusCode).toBe(403);
    expect(
      (await rssi.post(`/api/incidents/${c}/declarations`, { regime: 'sante', etape: 'alerte_precoce' })).statusCode,
    ).toBe(422);
    const r = await rssi.post(`/api/incidents/${c}/declarations`, corps);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ statut: 'a_declarer', origine: 'manuelle', regime: 'sante' });
    expect((await rssi.post(`/api/incidents/${c}/declarations`, corps)).statusCode).toBe(409);
    expect((await rssi.post('/api/incidents/INC-2025-900/declarations', corps)).statusCode).toBe(409);
  });

  it('complément : lié à une déclaration envoyée seulement', async () => {
    const envoyee = await decl('sante', 'signalement');
    const ouverte = await decl('nis2', 'alerte_precoce');
    expect((await rssi.post(url(ouverte, '/complement'))).statusCode).toBe(409);
    expect((await redacteur.post(url(envoyee, '/complement'))).statusCode).toBe(403);
    const r = await rssi.post(url(envoyee, '/complement'));
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ etape: 'complement', regime: 'sante', lieeA: envoyee.id, statut: 'a_declarer' });
    const liee = r.json().rubriques.find((x: { cle: string }) => x.cle === 'declaration_completee').valeur as string;
    expect(liee).toContain('Référence : AR-SANTE-0001');
  });
});

describe('immutabilité et suppression', () => {
  it('le déclencheur refuse toute modification ou suppression d’une déclaration envoyée ou écartée', async () => {
    await expect(
      t.svc.db.q("UPDATE incidents_declarations SET reference = 'détourné' WHERE statut = 'envoyee'"),
    ).rejects.toThrow(/figée/);
    await expect(
      t.svc.db.q("UPDATE incidents_declarations SET maj_par = 'x' WHERE statut = 'non_requise'"),
    ).rejects.toThrow(/figée/);
    await expect(t.svc.db.q("DELETE FROM incidents_declarations WHERE statut = 'envoyee'")).rejects.toThrow(/figée/);
    await expect(t.svc.db.q('TRUNCATE incidents_declarations CASCADE')).rejects.toThrow();
    // Une déclaration encore ouverte reste modifiable.
    const r = await t.svc.db.q("UPDATE incidents_declarations SET maj_par = maj_par WHERE statut = 'a_declarer'");
    expect(r.rowCount).toBeGreaterThan(0);
  });

  it('un incident qui porte une déclaration figée n’est pas supprimable ; sinon ses déclarations partent avec lui', async () => {
    const r = await admin.del(`/api/incidents/${incident}`);
    expect(r.statusCode).toBe(409);
    expect((await admin.get('/api/incidents')).json().incidents.map((i: { id: string }) => i.id)).toContain(incident);
    const c = (await redacteur.post('/api/incidents', { title: 'Éphémère fictif', answers: { cia: 'oui' } })).json()
      .id as string;
    expect((await vue(admin, c)).declarations).toHaveLength(3);
    expect((await admin.del(`/api/incidents/${c}`)).statusCode).toBe(200);
    const reste = await t.svc.db.q('SELECT 1 FROM incidents_declarations WHERE incident_id = $1', [c]);
    expect(reste.rows).toEqual([]);
  });
});

describe('correction de la date de qualification', () => {
  it('réservée au RSSI, tracée avant et après, échéances non envoyées recalculées', async () => {
    const nouvelle = new Date(Date.parse(qualifieeLe) - 6 * HEURE).toISOString();
    const route = `/api/incidents/${incident}/qualification`;
    expect((await redacteur.put(route, { qualifieeLe: nouvelle })).statusCode).toBe(403);
    expect((await admin.put(route, { qualifieeLe: nouvelle })).statusCode).toBe(403);
    expect((await rssi.put(route, { qualifieeLe: 'hier' })).statusCode).toBe(422);
    const futur = new Date(Date.now() + 2 * 24 * HEURE).toISOString();
    expect((await rssi.put(route, { qualifieeLe: futur })).statusCode).toBe(422);
    const envoyeeAvant = await decl('sante', 'signalement');
    const r = await rssi.put(route, { qualifieeLe: nouvelle });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().qualifiedAt).toBe(nouvelle);
    expect(Date.parse((await decl('nis2', 'alerte_precoce')).echeance!)).toBe(Date.parse(nouvelle) + 24 * HEURE);
    // Envoyée : inchangée.
    expect(await decl('sante', 'signalement')).toEqual(envoyeeAvant);
    const j = await t.svc.db.one<{ details: { avant: string; apres: string; recalculees: number } }>(
      "SELECT details FROM audit_log WHERE action = 'incident.qualification.corrigee' ORDER BY id DESC LIMIT 1",
    );
    expect(j?.details).toMatchObject({ avant: qualifieeLe, apres: nouvelle, recalculees: 2 });
    qualifieeLe = nouvelle;
  });
});

describe('périmètre', () => {
  it('un compte d’un autre périmètre, même RSSI, reçoit 404', async () => {
    const d = await decl('nis2', 'alerte_precoce');
    expect((await autre.get(`/api/incidents/${incident}/declarations`)).statusCode).toBe(404);
    expect((await autre.patch(url(d), { reference: 'x' }, im(d))).statusCode).toBe(404);
    expect((await rssiAilleurs.post(url(d, '/envoi'), { reference: 'x' }, im(d))).statusCode).toBe(404);
    expect((await rssiAilleurs.put(`/api/incidents/${incident}/qualification`, { qualifieeLe })).statusCode).toBe(404);
    expect((await rssiAilleurs.get(url(d, '/export'))).statusCode).toBe(404);
    expect(
      (
        await rssi.post(
          `/api/incidents/${incident}/declarations/00000000-0000-4000-8000-000000000000/confirmation`,
          {},
          {
            'if-match': '"1"',
          },
        )
      ).statusCode,
    ).toBe(404);
  });
});

describe('export Word', () => {
  it('fiche de préparation ou texte transmis ; droit d’export requis', async () => {
    const d = await decl('sante', 'signalement');
    expect((await lecteur.get(url(d, '/export'))).statusCode).toBe(403);
    expect((await redacteur.get(url(d, '/export'))).statusCode).toBe(403);
    const r = await rssi.get(url(d, '/export'));
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toMatch(new RegExp(`declaration-${incident}-sante-signalement\\.docx`));
    const doc = partie(r.rawPayload, 'word/document.xml');
    expect(doc).toContain('Établissement fictif');
    expect(doc).toContain('AR-SANTE-0001');
    expect(doc).toContain('Texte transmis, figé à l’envoi.');
    expect(doc).toMatch(/<\/w:p><w:sectPr>/);
    expect((await t.svc.db.q("SELECT 1 FROM audit_log WHERE action = 'incident.declaration.export'")).rows.length).toBe(
      1,
    );
  });
});

describe('rappels', () => {
  it('mi-délai, préavis et dépassement : une notification par personne et par jalon, responsable compris', async () => {
    await redacteur.patch(`/api/incidents/${incident}`, { owner: 'Nom decl_responsable' });
    const q = Date.parse(qualifieeLe);
    const compte = async (uid: string) =>
      (
        await t.svc.db.q<{ n: number }>(
          "SELECT count(*)::int AS n FROM grc_notifications WHERE kind = 'incident_declaration' AND user_id = $1",
          [uid],
        )
      ).rows[0]!.n;
    const avantRssi = await compte(rssiId);
    // Mi-délai de l'alerte précoce (+12 h) ; signalement santé envoyé : plus aucune relance.
    const mi = await t.svc.historique.declarations.rappels(new Date(q + 12 * HEURE + 60_000));
    expect(mi).toBeGreaterThan(0);
    expect(await t.svc.historique.declarations.rappels(new Date(q + 12 * HEURE + 120_000))).toBe(0);
    expect(await compte(responsableId)).toBeGreaterThan(0);
    expect(await compte(rssiId)).toBeGreaterThan(avantRssi);
    const titres = (
      await t.svc.db.q<{ title: string }>(
        "SELECT title FROM grc_notifications WHERE kind = 'incident_declaration' AND user_id = $1",
        [responsableId],
      )
    ).rows.map((x) => x.title);
    expect(titres.some((x) => x.endsWith('mi-délai atteint'))).toBe(true);
    expect(await t.svc.historique.declarations.rappels(new Date(q + 22 * HEURE + 60_000))).toBeGreaterThan(0);
    expect(await t.svc.historique.declarations.rappels(new Date(q + 24 * HEURE + 60_000))).toBeGreaterThan(0);
    expect(await t.svc.historique.declarations.rappels(new Date(q + 25 * HEURE))).toBe(0);
  });

  it('santé sans délai : relance toutes les 4 heures tant que le signalement est ouvert', async () => {
    const c = (
      await redacteur.post('/api/incidents', { title: 'Santé fictive', answers: { cia: 'oui', sante: 'oui' } })
    ).json() as { id: string; qualifiedAt: string };
    const q = Date.parse(c.qualifiedAt);
    const cles = async () =>
      (
        await t.svc.db.q<{ due_key: string }>(
          "SELECT due_key FROM grc_notifications WHERE kind = 'incident_declaration' AND user_id = $1 AND title LIKE $2",
          [rssiId, `%${c.id}%`],
        )
      ).rows.map((x) => x.due_key.split(':')[1]);
    await t.svc.historique.declarations.rappels(new Date(q + 3 * HEURE));
    expect((await cles()).filter((k) => k?.startsWith('relance'))).toEqual([]);
    await t.svc.historique.declarations.rappels(new Date(q + 4 * HEURE + 1000));
    await t.svc.historique.declarations.rappels(new Date(q + 8 * HEURE + 1000));
    await t.svc.historique.declarations.rappels(new Date(q + 8 * HEURE + 2000));
    expect((await cles()).filter((k) => k?.startsWith('relance')).sort()).toEqual(['relance-1', 'relance-2']);
  });

  it('indépendants du module des écarts, arrêtés avec le module incidents', async () => {
    const c = (
      await redacteur.post('/api/incidents', { title: 'Écarts coupés fictif', answers: { cia: 'oui' } })
    ).json().qualifiedAt as string;
    const plusTard = new Date(Date.parse(c) + 12 * HEURE + 60_000);
    try {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{incidents}', version = version + 1 WHERE id = 1");
      expect(await rappelsDeclarationsIncidents(t.svc, plusTard)).toBe(0);
      await t.svc.db.q("UPDATE module_activation SET disabled = '{ecarts}', version = version + 1 WHERE id = 1");
      // L'automate des écarts refuse de tourner…
      await expect(t.svc.modules.run(true, () => t.svc.grc.tasks.tick(plusTard))).rejects.toThrow();
      // … les rappels de déclaration passent quand même.
      expect(await rappelsDeclarationsIncidents(t.svc, plusTard)).toBeGreaterThan(0);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });

  it('visibles dans les rappels avec un lien vers la fiche ; courriel sans contenu', async () => {
    const l = (await rssi.get('/api/grc/notifications')).json() as { kind: string; lien?: string; title: string }[];
    const d = l.filter((n) => n.kind === 'incident_declaration');
    expect(d.length).toBeGreaterThan(0);
    expect(d[0]!.lien).toMatch(/^\/pilotage\/incidents-registre\?perimetre=[0-9a-f-]{36}&incident=INC-/);
    // Hors périmètre : rien (le compte n'est pas destinataire, et ne lirait pas le lien).
    expect(
      ((await autre.get('/api/grc/notifications')).json() as { kind: string }[]).filter(
        (n) => n.kind === 'incident_declaration',
      ),
    ).toEqual([]);
    const m = t.svc.notificationsMetier.composer('incident_declaration', d[0]!.title, 'Suivi fictif');
    expect(m.objet).toBe('Suivi fictif : Déclaration réglementaire d’un incident');
    expect(m.corps).toContain('/pilotage/incidents-registre');
    expect(m.corps).not.toMatch(/santé|NIS 2|ANSSI|échéance le/i);
  });
});

describe('contrainte de portée des notifications (migration 089)', () => {
  it('admet sans SMSI ni objet les types des modules, Vulnérabilités (086, 087) compris, et refuse les autres', async () => {
    const types = [
      'alerte_securite',
      'retex_contribution',
      ...NOTIFICATION_TYPES_VULNERABILITES,
      'incident_declaration',
    ];
    const inserer = (kind: string) =>
      t.svc.db.q(
        "INSERT INTO grc_notifications(smsi_id, object_id, user_id, kind, due_key, title, message) VALUES (NULL, NULL, $1, $2, $3, 't', 'm')",
        [rssiId, kind, `portee-fictive:${kind}`],
      );
    try {
      for (const kind of types) await inserer(kind);
      expect(
        (await t.svc.db.q("SELECT 1 FROM grc_notifications WHERE due_key LIKE 'portee-fictive:%'")).rows,
      ).toHaveLength(types.length);
      await expect(inserer('task_due')).rejects.toThrow(/grc_notifications_portee/);
    } finally {
      await t.svc.db.q("DELETE FROM grc_notifications WHERE due_key LIKE 'portee-fictive:%'");
    }
  });
});
