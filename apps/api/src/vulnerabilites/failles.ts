/* Module Vulnérabilités (ADR 0100, lot V5) : failles détectées par Tenable Security Center et machines, en lecture et en
   affectation (rôle, périmètre). Droits du module contrôlés par route() ; ce service applique en plus les droits par
   périmètre (ADR 0100, point 14) :
   - une machine se lit à travers les droits de son périmètre (pyramide des ADR 0092 et 0095 : fonction grc_smsi_visible) ;
     une machine sans périmètre n'est lisible qu'avec vulnerabilites:administrer ;
   - un constat ne compte que les machines lisibles où il est présent ; sans aucune, il n'est ni listé ni ouvert ;
   - indiquer le rôle ou le périmètre exige vulnerabilites:modifier (route), l'écriture sur le périmètre actuel de la machine
     et sur le périmètre visé ; retirer le périmètre (la machine ne serait plus lisible que par l'administration du module)
     exige vulnerabilites:administrer. Choix le plus restrictif, à confirmer par le RSSI.
   « Présent » : détection vue par la dernière synchronisation complète de son instance, ou plus récemment (tenable.ts).
   « Exploité » : une CVE du constat figure au catalogue KEV rangé par la veille (jointure en lecture, aucun appel).
   « Non maintenu » : constat sans CVE (V18).
   Lot V4a : priorité de chaque constat (présence « détectée ») et de chaque faille déclarée (CVE rattachée à un produit
   relié à des machines lisibles, hors machines où Tenable détecte déjà la CVE), calculée par la fonction pure du paquet
   partagé avec le seuil réglé ; rang de chaque machine parmi celles que la personne peut lire, compteurs complétés des
   failles déclarées (comptées une fois, et pas si Tenable les détecte sur la machine). Listes calculées en mémoire puis
   filtrées et paginées : l'ordre et la priorité sont ceux de la fonction partagée, sans copie en SQL.
   Journal `vulnerabilites.machine*` : identifiants internes seulement, jamais un nom ni une adresse de machine. */
import {
  AffectationMachine,
  AffectationMachines,
  calculerPriorite,
  type CompteursMachine,
  type FailleDeclareeDto,
  faitsRang,
  graviteDepuisNvd,
  type RechercheDeclarees,
  rangerMachines,
  type ReglagePriorite,
  type SourceExploitation,
  type ConstatDto,
  type ConstatResumeDto,
  FAILLES_PAR_PAGE,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type MachineDetectionDto,
  type MachineDto,
  type PageFailles,
  type PageMachines,
  type PerimetreAffectableDto,
  type RechercheConstats,
  type RechercheMachines,
  type RoleMachine,
} from '@suivi/shared';
import { sql, type RawBuilder } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { Grc } from '../grc/core.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { alerteCertFr, detecteeSurMachine, lisible, present, scoreNvd } from './sql.js';

const INTROUVABLE = 'Machine introuvable ou non accessible.';
/** Motif ILIKE littéral : les jokers saisis sont échappés. */
const litteral = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const nombre = (v: string | number | null) => (v === null ? null : Number(v));
const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Le constat `c` cite une CVE du catalogue KEV (veille). */
const exploite = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  JOIN vulnerabilites_veille_cve v ON v.cve = cc.cve WHERE cc.constat_id = c.id AND v.kev_ajout IS NOT NULL)`;
const sansCve = sql<boolean>`NOT EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id)`;
/** Une CVE du constat `c` est citée par une alerte du CERT-FR (veille). */
const alerteConstat = sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc
  WHERE cc.constat_id = c.id AND ${alerteCertFr('cc.cve')})`;
/** Score EPSS le plus haut des CVE du constat `c`, d'après la veille. */
const epssVeille = sql<string | null>`(SELECT max(v.epss_score) FROM vulnerabilites_constat_cves cc
  JOIN vulnerabilites_veille_cve v ON v.cve = cc.cve WHERE cc.constat_id = c.id)`;
const ORDRE_GRAVITE = (g: GraviteTenable | null) => (g ? GRAVITES_TENABLE.indexOf(g) : GRAVITES_TENABLE.length);

interface LigneConstat {
  id: string;
  plugin_id: number;
  nom: string;
  gravite: GraviteTenable;
  famille: string | null;
  synopsis: string | null;
  correctif: string | null;
  cvss3_vecteur: string | null;
  cvss3_score: string | null;
  vpr_score: string | null;
  epss_score: string | null;
  exploitable: boolean;
  exploit_libelle: string | null;
  faille_publiee_le: Date | null;
  correctif_publie_le: Date | null;
  fin_support_le: Date | null;
  voir_aussi: string | null;
  cves_tronquees: boolean;
  integration_id: string;
  exploite: boolean;
  non_maintenu: boolean;
  nombre_cves: number;
  cves: string[];
  machines: number;
  derniere: Date | null;
  alerte_certfr: boolean;
  epss_veille: string | null;
}

interface LigneMachine {
  id: string;
  nom: string | null;
  adresse: string | null;
  systeme: string | null;
  role: RoleMachine | null;
  perimetre_id: string | null;
  perimetre_nom: string | null;
  exposition: string | null;
  acr: string | null;
  premiere_detection: Date | null;
  derniere_detection: Date | null;
  integration_id: string;
  integration_nom: string;
  version: number;
  critique: number;
  elevee: number;
  moyenne: number;
  faible: number;
  exploites: number;
  exploitables: number;
  exploitees_avere: number;
}

/** Priorité d'un constat présent sur une machine lisible : présence « détectée ». EPSS : le plus haut entre Tenable et la
    veille. Un constat sans CVE (non maintenu) n'a ni exploitation ni EPSS de la veille : il est classé sur sa gravité. */
const prioriteConstat = (l: LigneConstat, reglage: ReglagePriorite) => {
  const scores = [nombre(l.epss_score), nombre(l.epss_veille)].filter((x): x is number => x !== null);
  const exploitation: SourceExploitation[] = [
    ...(l.exploite ? ['kev' as const] : []),
    ...(l.alerte_certfr ? ['cert-fr' as const] : []),
  ];
  return calculerPriorite(
    {
      exploitation,
      presence: 'detectee',
      gravite: l.gravite,
      epss: scores.length ? Math.max(...scores) : null,
      exploitDisponible: l.exploitable,
    },
    reglage,
  );
};

const versResume = (l: LigneConstat, reglage: ReglagePriorite): ConstatResumeDto => ({
  id: l.id,
  plugin: String(l.plugin_id),
  nom: l.nom,
  gravite: l.gravite,
  famille: l.famille,
  cvss3Score: nombre(l.cvss3_score),
  vpr: nombre(l.vpr_score),
  epss: nombre(l.epss_score),
  exploitable: l.exploitable,
  exploite: l.exploite,
  nonMaintenu: l.non_maintenu,
  finSupportLe: iso(l.fin_support_le),
  nombreCves: l.nombre_cves,
  cves: l.cves,
  machines: l.machines,
  derniereDetection: iso(l.derniere),
  alerteCertFr: l.alerte_certfr,
  priorite: prioriteConstat(l, reglage),
});

/** Faille déclarée sur une machine : CVE rattachée à un produit relié, non détectée par Tenable sur cette machine. */
interface DeclareeMachine {
  machine_id: string;
  cve: string;
  cvss31_gravite: string | null;
  cvss40_gravite: string | null;
  exploitee: boolean;
}

const versMachine = (l: LigneMachine, declarees: DeclareeMachine[]): Omit<MachineDto, 'rang'> => {
  const compteurs: CompteursMachine = {
    critique: l.critique,
    elevee: l.elevee,
    moyenne: l.moyenne,
    faible: l.faible,
    exploites: l.exploites,
    exploitables: l.exploitables,
    declarees: declarees.length,
    exploitationAveree: l.exploitees_avere,
  };
  for (const x of declarees) {
    const g = graviteDepuisNvd(x.cvss31_gravite, x.cvss40_gravite);
    if (g) compteurs[g]++;
    if (x.exploitee) compteurs.exploitationAveree++;
  }
  return {
    id: l.id,
    nom: l.nom,
    adresse: l.adresse,
    systeme: l.systeme,
    role: l.role,
    perimetreId: l.perimetre_id,
    perimetreNom: l.perimetre_nom,
    exposition: l.exposition,
    acr: nombre(l.acr),
    premiere: iso(l.premiere_detection),
    derniere: iso(l.derniere_detection),
    source: 'tenable',
    integration: { id: l.integration_id, nom: l.integration_nom },
    compteurs,
    version: l.version,
  };
};

export class FaillesDetectees {
  constructor(
    private readonly db: Db,
    private readonly g: Grc,
    private readonly reglage: ReglagePrioriteVulnerabilites,
  ) {}

  /* ---------------------------------------------------------------- Constats */
  /** Requête des constats présents sur au moins une machine lisible, avec leurs compteurs limités à ces machines. */
  private requeteConstats(user: SessionUser, conditions: RawBuilder<boolean>[]) {
    const ou = conditions.length ? sql.join(conditions, sql` AND `) : sql`true`;
    return sql`
      WITH par_constat AS (
        SELECT d.constat_id, count(DISTINCT d.machine_id)::int AS machines, max(d.derniere_detection) AS derniere
        FROM vulnerabilites_detections d
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE ${present} AND ${lisible(user)}
        GROUP BY d.constat_id)
      SELECT c.*, p.machines, p.derniere, ${exploite} AS exploite, ${sansCve} AS non_maintenu,
        ${alerteConstat} AS alerte_certfr, ${epssVeille} AS epss_veille,
        (SELECT count(*)::int FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id) AS nombre_cves,
        ARRAY(SELECT cc.cve FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id ORDER BY cc.cve DESC LIMIT 5)
          AS cves
      FROM vulnerabilites_constats c JOIN par_constat p ON p.constat_id = c.id
      WHERE ${ou}`;
  }

  async constats(user: SessionUser, q: RechercheConstats): Promise<PageFailles<ConstatResumeDto>> {
    const conditions: RawBuilder<boolean>[] = [];
    if (q.gravite) conditions.push(sql<boolean>`c.gravite = ${q.gravite}`);
    if (q.exploite) conditions.push(exploite);
    if (q.exploitable) conditions.push(sql<boolean>`c.exploitable`);
    if (q.nonMaintenu) conditions.push(sansCve);
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      if (/^cve-\d/i.test(texte))
        conditions.push(
          sql<boolean>`EXISTS (SELECT 1 FROM vulnerabilites_constat_cves cc WHERE cc.constat_id = c.id
                         AND cc.cve LIKE ${`${motif.toUpperCase()}%`})`,
        );
      else if (/^\d{1,9}$/.test(texte))
        conditions.push(sql<boolean>`(c.plugin_id = ${Number(texte)}::int OR c.nom ILIKE ${`%${motif}%`})`);
      else conditions.push(sql<boolean>`c.nom ILIKE ${`%${motif}%`}`);
    }
    const reglage = await this.reglage.valeurs();
    const { rows } = await sql<LigneConstat>`SELECT * FROM (${this.requeteConstats(user, conditions)}) c`.execute(
      this.db.k,
    );
    // Priorité calculée par la fonction partagée, puis filtre et ordre : priorité, gravité, exploitée, machines, contrôle.
    const tous = rows
      .map((l) => ({ l, r: versResume(l, reglage) }))
      .filter((x) => !q.priorite || x.r.priorite.niveau === q.priorite)
      .sort(
        (a, b) =>
          a.r.priorite.niveau.localeCompare(b.r.priorite.niveau) ||
          ORDRE_GRAVITE(a.l.gravite) - ORDRE_GRAVITE(b.l.gravite) ||
          Number(b.l.exploite) - Number(a.l.exploite) ||
          b.l.machines - a.l.machines ||
          a.l.plugin_id - b.l.plugin_id,
      );
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    return {
      total: tous.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      elements: tous.slice(debut, debut + FAILLES_PAR_PAGE).map((x) => x.r),
    };
  }

  /** Fiche d'un constat : ses CVE (avec leur présence au catalogue KEV) et les machines lisibles où il est présent, par rôle.
      Un constat sans machine lisible répond comme un constat inconnu. */
  async constat(user: SessionUser, id: string): Promise<ConstatDto> {
    const { rows } = await sql<LigneConstat & { integration_nom: string }>`
      SELECT x.*, i.nom AS integration_nom FROM (${this.requeteConstats(user, [sql<boolean>`c.id = ${id}::uuid`])}) x
      JOIN integrations i ON i.id = x.integration_id`.execute(this.db.k);
    const l = rows[0];
    if (!l) throw new HttpError(404, 'Faille introuvable ou non accessible.');
    const cves = await this.db.k
      .selectFrom('vulnerabilites_constat_cves as cc')
      .leftJoin('vulnerabilites_veille_cve as v', 'v.cve', 'cc.cve')
      .select(['cc.cve', sql<boolean>`v.kev_ajout IS NOT NULL`.as('kev')])
      .where('cc.constat_id', '=', id)
      .orderBy('cc.cve', 'desc')
      .execute();
    const { rows: detections } = await sql<{
      machine_id: string;
      nom: string | null;
      adresse: string | null;
      role: RoleMachine | null;
      perimetre_id: string | null;
      perimetre_nom: string | null;
      port: number;
      protocole: string;
      premiere_detection: Date | null;
      derniere_detection: Date | null;
      attenue: boolean;
      risque_accepte: boolean;
      risque_requalifie: boolean;
    }>`
      SELECT m.id AS machine_id, m.nom, m.adresse, m.role, m.perimetre_id, s.name AS perimetre_nom, d.port, d.protocole,
             d.premiere_detection, d.derniere_detection, d.attenue, d.risque_accepte, d.risque_requalifie
      FROM vulnerabilites_detections d
      JOIN vulnerabilites_machines m ON m.id = d.machine_id
      LEFT JOIN grc_smsis s ON s.id = m.perimetre_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      WHERE d.constat_id = ${id}::uuid AND ${present} AND ${lisible(user)}
      ORDER BY lower(coalesce(m.nom, m.adresse, '')), m.id, d.port, d.protocole`.execute(this.db.k);
    const parRole: ConstatDto['parRole'] = { front: [], back: [], bdd: [], aucun: [] };
    for (const d of detections)
      parRole[d.role ?? 'aucun'].push({
        machineId: d.machine_id,
        nom: d.nom,
        adresse: d.adresse,
        role: d.role,
        perimetreId: d.perimetre_id,
        perimetreNom: d.perimetre_nom,
        port: d.port,
        protocole: d.protocole,
        premiere: iso(d.premiere_detection),
        derniere: iso(d.derniere_detection),
        attenue: d.attenue,
        risqueAccepte: d.risque_accepte,
        risqueRequalifie: d.risque_requalifie,
      } satisfies MachineDetectionDto);
    return {
      ...versResume(l, await this.reglage.valeurs()),
      synopsis: l.synopsis,
      correctif: l.correctif,
      cvss3Vecteur: l.cvss3_vecteur,
      exploitLibelle: l.exploit_libelle,
      failleLe: iso(l.faille_publiee_le),
      correctifLe: iso(l.correctif_publie_le),
      voirAussi: l.voir_aussi,
      cvesTronquees: l.cves_tronquees,
      cvesDetail: cves.map((x) => ({ cve: x.cve, kev: x.kev })),
      parRole,
      integration: { id: l.integration_id, nom: l.integration_nom },
    };
  }

  /* ---------------------------------------------------------------- Machines */
  /** Toutes les machines lisibles, avec leurs compteurs (constats présents, puis failles déclarées non détectées), rangées
      de la plus critique à la moins critique (rangerMachines du paquet partagé). */
  private async machinesRangees(user: SessionUser): Promise<MachineDto[]> {
    const { rows } = await sql<LigneMachine>`
      SELECT m.id, m.nom, m.adresse, m.systeme, m.role, m.perimetre_id, s.name AS perimetre_nom, m.exposition, m.acr,
             m.premiere_detection, m.derniere_detection, m.integration_id, i.nom AS integration_nom, m.version,
             coalesce(k.critique, 0) AS critique, coalesce(k.elevee, 0) AS elevee, coalesce(k.moyenne, 0) AS moyenne,
             coalesce(k.faible, 0) AS faible, coalesce(k.exploites, 0) AS exploites,
             coalesce(k.exploitables, 0) AS exploitables, coalesce(k.exploitees_avere, 0) AS exploitees_avere
      FROM vulnerabilites_machines m
      JOIN integrations i ON i.id = m.integration_id
      LEFT JOIN grc_smsis s ON s.id = m.perimetre_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      LEFT JOIN LATERAL (
        SELECT count(DISTINCT c.id) FILTER (WHERE c.gravite = 'critique')::int AS critique,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'elevee')::int AS elevee,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'moyenne')::int AS moyenne,
               count(DISTINCT c.id) FILTER (WHERE c.gravite = 'faible')::int AS faible,
               count(DISTINCT c.id) FILTER (WHERE ${exploite})::int AS exploites,
               count(DISTINCT c.id) FILTER (WHERE c.exploitable)::int AS exploitables,
               count(DISTINCT c.id) FILTER (WHERE ${exploite} OR ${alerteConstat})::int AS exploitees_avere
        FROM vulnerabilites_detections d JOIN vulnerabilites_constats c ON c.id = d.constat_id
        WHERE d.machine_id = m.id AND ${present}) k ON true
      WHERE ${lisible(user)}`.execute(this.db.k);
    const { rows: declarees } = await sql<DeclareeMachine>`
      SELECT DISTINCT m.id AS machine_id, r.cve, v.cvss31_gravite, v.cvss40_gravite,
             (v.kev_ajout IS NOT NULL OR ${alerteCertFr('v.cve')}) AS exploitee
      FROM vulnerabilites_produits_machines pm
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      JOIN vulnerabilites_rapprochements r ON r.produit_id = pm.produit_id AND r.statut IN ('rattachee', 'confirmee')
      JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
      WHERE ${lisible(user)} AND NOT ${detecteeSurMachine}`.execute(this.db.k);
    const parMachine = new Map<string, DeclareeMachine[]>();
    for (const x of declarees) parMachine.set(x.machine_id, [...(parMachine.get(x.machine_id) ?? []), x]);
    const machines = rows.map((l) => versMachine(l, parMachine.get(l.id) ?? []));
    const ranges = rangerMachines(
      machines.map((m) => ({
        m,
        exploitationAveree: m.compteurs.exploitationAveree,
        role: m.role,
        critiques: m.compteurs.critique,
        elevees: m.compteurs.elevee,
        cle: `${(m.nom ?? m.adresse ?? '').toLowerCase()}\u0000${m.id}`,
      })),
    );
    return ranges.map((x) => ({
      ...x.m,
      rang: { position: x.rang, total: ranges.length, faits: faitsRang(x) },
    }));
  }

  /** Machines lisibles, de la plus critique à la moins critique ; recherche par nom, filtres par rôle et périmètre. Le rang
      est calculé sur toutes les machines lisibles, avant les filtres. */
  async machines(user: SessionUser, q: RechercheMachines): Promise<PageMachines> {
    const toutes = await this.machinesRangees(user);
    const texte = q.q?.trim().toLowerCase();
    const filtrees = toutes.filter(
      (m) =>
        (!texte || (m.nom ?? '').includes(texte)) &&
        (q.role === 'aucun' ? m.role === null : !q.role || m.role === q.role) &&
        (q.perimetre === 'aucun' ? m.perimetreId === null : !q.perimetre || m.perimetreId === q.perimetre),
    );
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    return {
      total: filtrees.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      elements: filtrees.slice(debut, debut + FAILLES_PAR_PAGE),
      sansRole: toutes.filter((m) => m.role === null).length,
    };
  }

  async machine(user: SessionUser, id: string): Promise<MachineDto> {
    const m = (await this.machinesRangees(user)).find((x) => x.id === id);
    if (!m) throw new HttpError(404, INTROUVABLE);
    return m;
  }

  /* ---------------------------------------------------------------- Failles déclarées (V20, lot V4a) */
  /** CVE rattachées (d'office ou confirmées) à un produit relié à des machines lisibles, sur les machines où Tenable ne les
      détecte pas ; une par produit et par CVE, avec sa priorité (présence « déclarée »). */
  async declarees(user: SessionUser, q: RechercheDeclarees): Promise<PageFailles<FailleDeclareeDto>> {
    const conditions: RawBuilder<boolean>[] = [];
    const texte = q.q?.trim();
    if (texte) {
      const motif = litteral(texte);
      conditions.push(
        /^cve-\d/i.test(texte)
          ? sql<boolean>`r.cve LIKE ${`${motif.toUpperCase()}%`}`
          : sql<boolean>`(p.nom ILIKE ${`%${motif}%`} OR p.editeur ILIKE ${`%${motif}%`})`,
      );
    }
    const et = conditions.length ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``;
    const { rows } = await sql<{
      id: string;
      cve: string;
      statut: 'rattachee' | 'confirmee';
      produit_id: string;
      editeur: string;
      nom: string;
      version_produit: string;
      cvss31_gravite: string | null;
      cvss40_gravite: string | null;
      score: string | null;
      epss_score: string | null;
      kev: boolean;
      alerte: boolean;
      machines: number;
    }>`
      SELECT r.id, r.cve, r.statut, p.id AS produit_id, p.editeur, p.nom, p.version_produit, v.cvss31_gravite,
             v.cvss40_gravite, ${scoreNvd} AS score, v.epss_score, v.kev_ajout IS NOT NULL AS kev,
             ${alerteCertFr('v.cve')} AS alerte, count(DISTINCT m.id)::int AS machines
      FROM vulnerabilites_rapprochements r
      JOIN vulnerabilites_produits p ON p.id = r.produit_id
      JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
      JOIN vulnerabilites_produits_machines pm ON pm.produit_id = p.id
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      WHERE r.statut IN ('rattachee', 'confirmee') AND ${lisible(user)} AND NOT ${detecteeSurMachine} ${et}
      GROUP BY r.id, p.id, v.cve`.execute(this.db.k);
    const reglage = await this.reglage.valeurs();
    const tous = rows
      .map((l): FailleDeclareeDto => {
        const gravite = graviteDepuisNvd(l.cvss31_gravite, l.cvss40_gravite);
        const epss = nombre(l.epss_score);
        return {
          rapprochementId: l.id,
          cve: l.cve,
          statut: l.statut,
          produit: { id: l.produit_id, editeur: l.editeur, nom: l.nom, versionProduit: l.version_produit },
          gravite,
          cvssScore: nombre(l.score),
          epss,
          kev: l.kev,
          alerteCertFr: l.alerte,
          machines: l.machines,
          priorite: calculerPriorite(
            {
              exploitation: [...(l.kev ? ['kev' as const] : []), ...(l.alerte ? ['cert-fr' as const] : [])],
              presence: 'declaree',
              gravite,
              epss,
              exploitDisponible: false,
            },
            reglage,
          ),
        };
      })
      .filter((x) => !q.priorite || x.priorite.niveau === q.priorite)
      .sort(
        (a, b) =>
          a.priorite.niveau.localeCompare(b.priorite.niveau) ||
          ORDRE_GRAVITE(a.gravite) - ORDRE_GRAVITE(b.gravite) ||
          (a.cve < b.cve ? 1 : a.cve > b.cve ? -1 : 0) ||
          (a.produit.id < b.produit.id ? -1 : a.produit.id > b.produit.id ? 1 : 0),
      );
    const debut = (q.page - 1) * FAILLES_PAR_PAGE;
    return {
      total: tous.length,
      page: q.page,
      parPage: FAILLES_PAR_PAGE,
      elements: tous.slice(debut, debut + FAILLES_PAR_PAGE),
    };
  }

  /** Périmètres où la personne peut écrire : seuls choix admis pour l'affectation. */
  async perimetresAffectables(user: SessionUser): Promise<PerimetreAffectableDto[]> {
    const { rows } = await sql<PerimetreAffectableDto>`SELECT s.id, s.name AS nom FROM grc_smsis s
      WHERE grc_est_admin(${user.id}::uuid) OR grc_acces_perimetre(s.id, ${user.id}::uuid) IS TRUE
      ORDER BY lower(s.name), s.id`.execute(this.db.k);
    return rows;
  }

  /* ---------------------------------------------------------------- Affectation (vulnerabilites:modifier) */
  /** Rôle et périmètre d'une machine (If-Match). */
  async affecter(
    id: string,
    patch: AffectationMachine,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<MachineDto> {
    const p = AffectationMachine.parse(patch);
    await this.db.tx(async (c, k) => {
      const [m] = await this.verrouiller(k, user, [id]);
      if (!m) throw new HttpError(404, INTROUVABLE);
      if (m.version !== attendue) throw conflict({ ...(await this.machine(user, id)), updated_by: m.maj_par ?? '' });
      await this.controlerEcriture(c, user, m, p.perimetreId);
      const apres = await this.ecrire(k, user, m, p);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.machine.modifiee',
        id,
        {
          avant: { role: m.role, perimetreId: m.perimetre_id },
          apres: { role: apres.role, perimetreId: apres.perimetre_id },
          version: apres.version,
        },
        c,
      );
    }, user.username);
    return this.machine(user, id);
  }

  /** Affectation en masse : tout ou rien. Chaque machine porte sa version attendue ; une seule périmée fait tout refuser. */
  async affecterEnMasse(body: AffectationMachines, user: SessionUser, ip: string): Promise<{ machines: number }> {
    const p = AffectationMachines.parse(body);
    const ids = p.machines.map((x) => x.id);
    await this.db.tx(async (c, k) => {
      const lues = await this.verrouiller(k, user, ids);
      if (lues.length !== ids.length) throw new HttpError(404, 'Une machine est introuvable ou non accessible.');
      const attendues = new Map(p.machines.map((x) => [x.id, x.version]));
      const perimees = lues.filter((m) => m.version !== attendues.get(m.id));
      if (perimees.length)
        throw new HttpError(
          412,
          `${perimees.length} machine(s) modifiée(s) depuis leur affichage : rechargez la liste avant de recommencer.`,
          { reason: 'conflict', current: perimees.map((m) => ({ id: m.id, version: m.version })) },
        );
      const patch = {
        ...(p.role !== undefined ? { role: p.role } : {}),
        ...(p.perimetreId !== undefined ? { perimetreId: p.perimetreId } : {}),
      };
      for (const m of lues) {
        await this.controlerEcriture(c, user, m, patch.perimetreId);
        await this.ecrire(k, user, m, patch);
      }
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.machines.affectees',
        '',
        { machines: [...ids].sort(), nombre: ids.length, ...patch },
        c,
      );
    }, user.username);
    return { machines: ids.length };
  }

  /** Machines lisibles par la personne, verrouillées dans l'ordre des identifiants (aucun interblocage entre deux envois). */
  private async verrouiller(k: Kdb, user: SessionUser, ids: string[]) {
    const { rows } = await sql<{
      id: string;
      role: RoleMachine | null;
      perimetre_id: string | null;
      version: number;
      maj_par: string | null;
    }>`SELECT m.id, m.role, m.perimetre_id, m.version, m.maj_par FROM vulnerabilites_machines m
       WHERE m.id = ANY(${ids}::uuid[]) AND ${lisible(user)} ORDER BY m.id FOR UPDATE OF m`.execute(k);
    return rows;
  }

  /** Écriture sur le périmètre actuel ; sur le périmètre visé s'il change ; administrer pour retirer le périmètre. */
  private async controlerEcriture(
    c: Client,
    user: SessionUser,
    m: { perimetre_id: string | null },
    vise: string | null | undefined,
  ) {
    if (m.perimetre_id) await this.g.access(m.perimetre_id, user, true, c);
    if (vise === undefined || vise === m.perimetre_id) return;
    if (vise === null) {
      if (!user.rights.can('vulnerabilites', 'administrer'))
        throw new HttpError(
          403,
          'Retirer le périmètre d’une machine demande le droit d’administrer le module Vulnérabilités : elle ne serait plus lisible que par ce droit.',
        );
      return;
    }
    await this.g.access(vise, user, true, c).catch((e: unknown) => {
      if (e instanceof HttpError && e.status === 404)
        throw new HttpError(422, 'Périmètre introuvable ou non accessible.');
      throw e;
    });
  }

  private async ecrire(
    k: Kdb,
    user: SessionUser,
    m: { id: string; role: RoleMachine | null; perimetre_id: string | null },
    p: AffectationMachine,
  ) {
    return k
      .updateTable('vulnerabilites_machines')
      .set((eb) => ({
        role: p.role !== undefined ? p.role : m.role,
        perimetre_id: p.perimetreId !== undefined ? p.perimetreId : m.perimetre_id,
        version: eb('version', '+', 1),
        maj_le: sql<Date>`now()`,
        maj_par: user.username,
      }))
      .where('id', '=', m.id)
      .returning(['role', 'perimetre_id', 'version'])
      .executeTakeFirstOrThrow();
  }
}
