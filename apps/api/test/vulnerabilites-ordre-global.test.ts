/* Module Vulnérabilités (ADR 0100, lot PERF-04 ; décision du RSSI du 20/11/2026) : ordre du calcul global des failles.
   - À priorité égale, les faits affichés d'une faille (CVE, ou constat sans CVE) sont ceux du contrôle de Tenable détecté le
     plus récemment (dernière détection PRÉSENTE ; un contrôle traité ne compte pas ; sans date, après les contrôles datés),
     puis, à égalité parfaite, du plus petit identifiant.
   - Le résultat ne dépend pas de l'ordre physique des lignes (CLUSTER, lignes réécrites) : deux calculs rendent la même chose.
   - Ni la priorité, ni le niveau d'alerte, ni aucun nombre ne changent ; droits de lecture inchangés (faits communs à tous,
     nombres de machines limités à ce que la personne lit).
   - Quand le contrôle retenu change à priorité égale (ce qui arrive une fois à la mise à jour), l'alerte existante est
     seulement mise à jour : aucune notification rejouée, ni réouverte, ni close, prise en compte conservée, niveau inchangé.
   Données entièrement fictives : machines en .invalid, CVE fictives ; aucun service n'est joint. */
import { prioriteLaPlusHaute, type Priorite } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
const INSTANCE = '0d0d0d0d-0000-4000-8000-000000000001';
const M1 = '0d0d0d0d-0000-4000-8000-0000000000a1';
const M2 = '0d0d0d0d-0000-4000-8000-0000000000a2';
/** Identifiants choisis pour que l'ordre des identifiants contredise celui des détections. */
const C = (n: number) => `0d0d0d0d-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const CVE_RECENT = 'CVE-2026-95001';
const CVE_EGALITE = 'CVE-2026-95002';
const CVE_SANS_DATE = 'CVE-2026-95003';
const CVE_ALERTE = 'CVE-2026-95010';

let t: TestApp;
let admin: Agent, lecteur: Agent;

const presence = { fait: 'presence', presence: 'detectee' };
const graviteCritique = { fait: 'gravite', gravite: 'critique' };
const epss = (score: number) => ({ fait: 'epss', score, seuil: 0.5 });

/** Priorité retenue de chaque faille du calcul global, et ordre rendu (failles, objets suivis). */
async function calcul() {
  const g = await t.svc.vulnerabilites.alertes.situationGlobale(t.svc.db.k, []);
  return {
    priorites: Object.fromEntries([...g.cumuls].map(([cle, x]) => [cle, prioriteLaPlusHaute(x.priorites)])),
    nombres: Object.fromEntries(
      [...g.cumuls].map(([cle, x]) => [cle, { machines: x.machines.size, objets: x.objets, traites: x.traites }]),
    ),
    cles: [...g.cumuls.keys()],
    objets: g.objets.map((o) => `${o.nature}:${o.id}:${o.priorite}`),
  };
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ordre_admin', 'admin'));
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_ordre_lire', 'Vulnérabilités, lecture', ARRAY['vulnerabilites:lire'])",
  );
  lecteur = await login(t, await makeUser(t, 'ordre_lecteur', 'r_ordre_lire', { rattache: false }));
  // Contrôles insérés dans l'ordre inverse de celui attendu : l'ordre physique ne doit rien décider.
  await t.svc.db.q(`
    INSERT INTO integrations (id, type, nom, actif, created_by, updated_by)
      VALUES ('${INSTANCE}', 'tenable', 'Tenable fictif (ordre)', true, 'test', 'test');
    INSERT INTO vulnerabilites_tenable_etat (integration_id, numero, numero_complet) VALUES ('${INSTANCE}', 2, 2);
    INSERT INTO vulnerabilites_machines (id, integration_id, identifiant_source, nom, vu_numero) VALUES
      ('${M1}', '${INSTANCE}', 'uuid:${M1}', 'srv-ordre-01.exemple.invalid', 2),
      ('${M2}', '${INSTANCE}', 'uuid:${M2}', 'srv-ordre-02.exemple.invalid', 2);
    INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout) VALUES
      ('${CVE_RECENT}', NULL), ('${CVE_EGALITE}', NULL), ('${CVE_SANS_DATE}', NULL), ('${CVE_ALERTE}', date '2026-11-01');
    INSERT INTO vulnerabilites_constats (id, integration_id, plugin_id, nom, gravite, epss_score, exploitable,
      exploite_malware, vu_numero) VALUES
      -- ${CVE_RECENT} : 01 critique (détection présente du 10/11, et une ABSENTE du 19/11 : numéro de synchronisation antérieur), 02 moyenne et EPSS 0,9
      -- (détection présente du 15/11), 05 critique traité (détection présente du 20/11) : toutes en P2.
      ('${C(5)}', '${INSTANCE}', 950005, 'Contrôle fictif traité', 'critique', NULL, false, false, 2),
      ('${C(2)}', '${INSTANCE}', 950002, 'Contrôle fictif récent', 'moyenne', 0.9, false, false, 2),
      ('${C(1)}', '${INSTANCE}', 950001, 'Contrôle fictif ancien', 'critique', NULL, false, false, 2),
      -- ${CVE_EGALITE} : 04 (EPSS 0,8) et 03 (critique), même dernière détection : le plus petit identifiant (03).
      ('${C(4)}', '${INSTANCE}', 950004, 'Contrôle fictif égal B', 'moyenne', 0.8, false, false, 2),
      ('${C(3)}', '${INSTANCE}', 950003, 'Contrôle fictif égal A', 'critique', NULL, false, false, 2),
      -- ${CVE_SANS_DATE} : 06 critique sans date de détection, 07 EPSS 0,7 daté : le contrôle daté (07).
      ('${C(6)}', '${INSTANCE}', 950006, 'Contrôle fictif sans date', 'critique', NULL, false, false, 2),
      ('${C(7)}', '${INSTANCE}', 950007, 'Contrôle fictif daté', 'moyenne', 0.7, false, false, 2),
      -- ${CVE_ALERTE} (catalogue KEV, P1) : 08 marqué « exploité par un logiciel malveillant » sur M1, 09 sans ce
      -- marquage sur M2 ; même priorité, faits différents (sources de l'exploitation).
      ('${C(9)}', '${INSTANCE}', 950009, 'Contrôle fictif KEV', 'elevee', NULL, false, false, 2),
      ('${C(8)}', '${INSTANCE}', 950008, 'Contrôle fictif KEV malveillant', 'elevee', NULL, false, true, 2);
    INSERT INTO vulnerabilites_constat_cves (constat_id, cve) VALUES
      ('${C(5)}', '${CVE_RECENT}'), ('${C(2)}', '${CVE_RECENT}'), ('${C(1)}', '${CVE_RECENT}'),
      ('${C(4)}', '${CVE_EGALITE}'), ('${C(3)}', '${CVE_EGALITE}'),
      ('${C(6)}', '${CVE_SANS_DATE}'), ('${C(7)}', '${CVE_SANS_DATE}'),
      ('${C(9)}', '${CVE_ALERTE}'), ('${C(8)}', '${CVE_ALERTE}');
    INSERT INTO vulnerabilites_detections (constat_id, machine_id, port, protocole, derniere_detection, vu_numero) VALUES
      ('${C(5)}', '${M1}', 0, 'TCP', timestamptz '2026-11-20T08:00:00Z', 2),
      ('${C(2)}', '${M2}', 0, 'TCP', timestamptz '2026-11-15T08:00:00Z', 2),
      ('${C(1)}', '${M1}', 0, 'TCP', timestamptz '2026-11-10T08:00:00Z', 2),
      ('${C(1)}', '${M2}', 443, 'TCP', timestamptz '2026-11-19T08:00:00Z', 1),
      ('${C(4)}', '${M1}', 0, 'TCP', timestamptz '2026-11-12T08:00:00Z', 2),
      ('${C(3)}', '${M2}', 0, 'TCP', timestamptz '2026-11-12T08:00:00Z', 2),
      ('${C(6)}', '${M1}', 0, 'TCP', NULL, 2),
      ('${C(7)}', '${M2}', 0, 'TCP', timestamptz '2026-01-01T08:00:00Z', 2),
      ('${C(9)}', '${M2}', 0, 'TCP', timestamptz '2026-11-16T08:00:00Z', 2),
      ('${C(8)}', '${M1}', 0, 'TCP', timestamptz '2026-11-14T08:00:00Z', 2);
    INSERT INTO vulnerabilites_suivis (id, nature, constat_id, etat, proposition, version, maj_le, maj_par)
      VALUES ('0d0d0d0d-0000-4000-8000-0000000000f5', 'constat', '${C(5)}', 'corrigee', 'aucune', 1, now(), 'test');
    ANALYZE;`);
}, 120_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('calcul global : à priorité égale, le contrôle détecté le plus récemment', () => {
  it('fournit les faits de la faille ; priorités et nombres inchangés', async () => {
    const r = await calcul();
    // 02 (15/11) plutôt que 01 (10/11 présent ; 19/11 absent ne compte pas) ou 05 (traité, 20/11).
    expect(r.priorites[CVE_RECENT]).toEqual({ niveau: 'P2', faits: [presence, epss(0.9)] });
    // Égalité parfaite des dates : le plus petit identifiant (03, critique), quel que soit l'ordre d'insertion.
    expect(r.priorites[CVE_EGALITE]).toEqual({ niveau: 'P2', faits: [presence, graviteCritique] });
    // Sans date de détection : après le contrôle daté.
    expect(r.priorites[CVE_SANS_DATE]).toEqual({ niveau: 'P2', faits: [presence, epss(0.7)] });
    // KEV : 09 (16/11) plutôt que 08 (14/11, malveillant) ; P1 dans les deux cas.
    expect(r.priorites[CVE_ALERTE]?.niveau).toBe('P1');
    expect((r.priorites[CVE_ALERTE] as Priorite).faits[0]).toEqual({ fait: 'exploitation', sources: ['kev'] });
    // Nombres : toutes les machines où un contrôle non traité est présent ; contrôle traité compté à part.
    expect(r.nombres[CVE_RECENT]).toEqual({ machines: 2, objets: 3, traites: 1 });
    expect(r.nombres[CVE_ALERTE]).toEqual({ machines: 2, objets: 2, traites: 0 });
    // Failles rendues dans l'ordre de leur clé ; objets suivis dans l'ordre de leur identifiant.
    expect(r.cles).toEqual([...r.cles].sort());
    expect(r.objets.map((o) => o.split(':')[1])).toEqual([...r.objets.map((o) => o.split(':')[1])].sort());
  });

  it('ne dépend pas de l’ordre physique des lignes (CLUSTER, lignes réécrites)', async () => {
    const reference = JSON.stringify(await calcul());
    await t.svc.db.q('CLUSTER vulnerabilites_constats USING vulnerabilites_constats_pkey');
    await t.svc.db.q('CLUSTER vulnerabilites_detections USING vulnerabilites_detections_pkey');
    expect(JSON.stringify(await calcul())).toBe(reference);
    // Lignes réécrites une à une dans un autre ordre : chacune passe en fin de table.
    for (const n of [3, 1, 9, 2, 7])
      await t.svc.db.q('UPDATE vulnerabilites_constats SET nom = nom WHERE id = $1', [C(n)]);
    await t.svc.db.q('UPDATE vulnerabilites_detections SET port = port WHERE constat_id = $1', [C(4)]);
    await t.svc.db.q('ANALYZE vulnerabilites_constats');
    expect(JSON.stringify(await calcul())).toBe(reference);
  });

  it('vue d’ensemble : mêmes faits pour tous ; nombres de machines limités à ce que la personne lit', async () => {
    const lire = async (a: Agent) => {
      const r = await a.get(`${V}/vue-ensemble`);
      expect(r.statusCode).toBe(200);
      return r.json() as {
        cibles: { cle: string; priorite: Priorite; machines: { lisibles: number; horsLecture: boolean } }[];
        parPriorite: Record<string, number>;
        total: number;
      };
    };
    const va = await lire(admin);
    const vl = await lire(lecteur);
    const cible = (v: typeof va, cle: string) => v.cibles.find((c) => c.cle === cle)!;
    for (const v of [va, vl]) {
      expect(cible(v, CVE_RECENT).priorite).toEqual({ niveau: 'P2', faits: [presence, epss(0.9)] });
      expect(cible(v, CVE_EGALITE).priorite).toEqual({ niveau: 'P2', faits: [presence, graviteCritique] });
      expect(v.parPriorite).toEqual({ P1: 1, P2: 3, P3: 0, P4: 0 });
      expect(v.total).toBe(4);
    }
    // Machines sans périmètre : lues par l'administrateur, pas par le lecteur sans périmètre (drapeau sans nombre).
    expect(cible(va, CVE_RECENT).machines).toEqual({ lisibles: 2, horsLecture: false });
    expect(cible(vl, CVE_RECENT).machines).toEqual({ lisibles: 0, horsLecture: true });
  });
});

describe('alertes : un changement du contrôle retenu à priorité égale', () => {
  const notifications = async () =>
    (await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM grc_notifications WHERE kind LIKE 'vulnerabilites_alerte%'",
    ))!.n;
  const alerte = async () =>
    (await t.svc.db.one<{
      etat: string;
      niveau: string;
      priorite: string;
      version: number;
      notifiee: boolean;
      prise_par: string | null;
      faits: { priorite: Priorite; nombres: { machines: number } };
    }>(
      `SELECT etat, niveau, priorite, version, notifiee, prise_par, faits FROM vulnerabilites_alertes WHERE cle = $1`,
      [CVE_ALERTE],
    ))!;

  it('met seulement à jour les faits : aucune notification rejouée, ni réouverte, ni close', async () => {
    expect(await t.svc.vulnerabilites.alertes.evaluer('essai')).toMatchObject({ creees: 1, closes: 0 });
    const avant = await alerte();
    expect(avant).toMatchObject({ etat: 'ouverte', niveau: 'critique', priorite: 'P1', notifiee: true });
    expect(avant.faits.priorite.faits[0]).toEqual({ fait: 'exploitation', sources: ['kev'] });
    // Prise en compte par le RSSI (état posé directement : la prise en compte elle-même est testée ailleurs).
    await t.svc.db.q(
      "UPDATE vulnerabilites_alertes SET etat = 'prise_en_compte', prise_par = 'RSSI fictif', prise_le = now() WHERE cle = $1",
      [CVE_ALERTE],
    );
    const n = await notifications();
    expect(n).toBeGreaterThan(0);
    // Le contrôle malveillant (08) devient le plus récent : à priorité égale, ses faits sont retenus.
    await t.svc.db.q('UPDATE vulnerabilites_detections SET derniere_detection = $1 WHERE constat_id = $2', [
      '2026-11-18T08:00:00Z',
      C(8),
    ]);
    expect(await t.svc.vulnerabilites.alertes.evaluer('essai')).toEqual({
      creees: 0,
      misesAJour: 1,
      closes: 0,
      notifiees: 0,
    });
    const apres = await alerte();
    expect(apres).toMatchObject({
      etat: 'prise_en_compte',
      niveau: 'critique',
      priorite: 'P1',
      prise_par: 'RSSI fictif',
      notifiee: true,
      version: avant.version + 1,
    });
    expect(apres.faits.priorite.faits[0]).toEqual({ fait: 'exploitation', sources: ['kev', 'tenable'] });
    expect(apres.faits.nombres.machines).toBe(avant.faits.nombres.machines);
    expect(await notifications()).toBe(n);
    // Évaluation suivante : rien ne bouge.
    expect(await t.svc.vulnerabilites.alertes.evaluer('essai')).toEqual({
      creees: 0,
      misesAJour: 0,
      closes: 0,
      notifiees: 0,
    });
    expect(await notifications()).toBe(n);
  });
});
