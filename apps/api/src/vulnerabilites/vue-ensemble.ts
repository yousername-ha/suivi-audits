/* Module Vulnérabilités (ADR 0100, point 18 ; lot PC1) : « Vue d'ensemble », écran d'accueil du module (poste de
   commandement). Route de lecture seule, bornée, sans écriture ni entrée de journal, sans stockage nouveau.
   - Failles suivies, priorité et niveau d'alerte : calculés sur TOUS les faits connus de la plateforme, les mêmes pour tout le
     monde (lot ALH5, décision A), par le calcul déjà fait pour les alertes (AlertesVulnerabilites.situationGlobale), plus les
     rapprochements proposés (présence « produit à confirmer »). Une faille dont tous les objets suivis sont traités (corrigée,
     risque accepté, non concernée) n'est plus suivie.
   - Noms et nombres détaillés : seulement pour ce que la personne lit. Machines par leur périmètre effectif (`lisible`),
     actifs exposés par leur périmètre ALH relié (surfaceDesCves) ; un drapeau sans nombre pour le reste, jamais de total
     global. Fiche ouverte par un point : un constat ou une faille déclarée dont la personne lit au moins une machine.
     Aucun nom de machine, de domaine, d'adresse ni de périmètre n'est rendu.
   - Journal : traces existantes seulement (collectes de la veille, exécutions « synchroniser » des connecteurs Tenable et
     AlgoLightHouse, alertes ouvertes et closes), sans texte d'erreur.
   - Bornes : VUE_ENSEMBLE_BORNES (40 cibles par case secteur × priorité, 12 entrées de journal) ; le total de chaque case
     est toujours rendu.
   - Requêtes : nombre fixe, aucune par faille (propositions 1 ; situation globale : réglage 1, constats 1, failles déclarées
     1, expositions 2, majoration 4 au plus, faits des sources 3, titres 1 ; corrigées 1 ; machines lisibles 1 ; surface
     lisible 2 ; journal 1 : 18 au plus). Lot S1 : la tuile « En dépassement » reprend les objets suivis du même calcul
     global (aucune requête de plus). Lot S2 : variation sur sept jours, une requête de plus (l'instantané de référence),
     les nombres du moment étant composés à partir du même calcul global : 19 au plus. Lot S3 : précision « sans correctif
     connu » des failles exploitées et présentes (même calcul, aucune requête de plus) ; fin de support : constats présents
     (même calcul), machines lisibles 1, services exposés lisibles 1 : 21 au plus. Lot PERF-04 : le calcul global est lu sans
     titres ni machines ; titres des seules failles rendues (1), machines en fin de support relues à partir des constats (1) :
     même nombre de requêtes. Lot ASSISTANT-V1 : `cibles(user)` rend à l'outil `failles_prioritaires` de l'assistant les
     mêmes cibles que le tableau « Cibles par priorité », par le même code que `lire`. */
import {
  type EtatCorrectifDto,
  etatCorrectif,
  etatFinSupport,
  type CaseRadarDto,
  type CibleVueDto,
  comparerCibles,
  ETATS_SUIVI,
  type EtatSuiviFaille,
  type FamilleProduit,
  type FicheCibleDto,
  type EntreeJournalVueDto,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  type NombreLisible,
  niveauAlerte,
  niveauAlerteGlobal,
  prioriteLaPlusHaute,
  type Presence,
  PRESENCES,
  type Priorite,
  secteurDe,
  type SecteurRadar,
  type SourceVeille,
  type SourcesFailleDto,
  composerInstantane,
  variationSeptJours,
  VUE_ENSEMBLE_BORNES,
  type VueEnsembleDto,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db, Kdb } from '../db/db.js';
import { type AlertesVulnerabilites, type Cumul, exploitationDeCumul, type PropositionCumul } from './alertes.js';
import { objetsEnDepassement } from './delais.js';
import { entreesInstantane, instantaneDeReference } from './tendances.js';
import { servicesFinDeSupport } from './services-surface.js';
import { lisible, present } from './sql.js';
import { close } from './suivi.js';
import type { SurfaceExterneAlh } from './surface-externe.js';

const FUSEAU = 'Europe/Paris';
const VIDE: NombreLisible = { lisibles: 0, horsLecture: false };

interface Suivie {
  x: Cumul;
  priorite: Priorite;
  presences: Presence[];
  aConfirmer: boolean;
  secteur: SecteurRadar;
  exploitee: boolean;
}

export class VueEnsembleVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly alertes: Pick<AlertesVulnerabilites, 'situationGlobale' | 'titreEtProduit' | 'titres'>,
    private readonly surface: Pick<SurfaceExterneAlh, 'surfaceDesCves'>,
  ) {}

  async lire(user: SessionUser): Promise<VueEnsembleDto> {
    const k = this.db.k;
    const { propositions, cumuls, sources, objets, reglage, suivies } = await this.suivies(k);
    const maintenant = new Date();
    const { totaux, retenues } = rangerParCase(suivies);
    const parPriorite = Object.fromEntries(NIVEAUX_PRIORITE.map((n) => [n, 0])) as Record<NiveauPriorite, number>;
    for (const s of suivies) parPriorite[s.priorite.niveau]++;

    const cibles = await this.rendre(user, retenues);
    const [corrigees, journal] = [await this.corrigeesCeMois(), await this.journal()];
    const niveau = niveauDesFailles(cumuls, sources);
    // Lot S2 : variation sur sept jours, par rapport à l'instantané de référence (une requête), avec les nombres du moment
    // calculés par la même composition que l'instantané (aucune requête de plus).
    const reference = await instantaneDeReference(k, maintenant);
    // Mesures globales seulement (sans machines ni actifs, rendus nuls ici) : la vue n'en montre pas le total.
    const actuel = composerInstantane(
      entreesInstantane(cumuls, sources, objets, reglage, maintenant, undefined, false),
    );
    // Lot S3 : précision des failles exploitées et présentes selon l'état de leur correctif (sans renommer la marque).
    const p1 = suivies.filter((s) => !s.aConfirmer && s.priorite.niveau === 'P1');
    const etats = p1.map((s) => correctifDeCumul(s.x, sources).etat);
    // Lot S3 : fin de support (constats présents selon Tenable, machines et services exposés lus).
    const fin = objets.filter(
      (o) => o.nature === 'constat' && etatFinSupport(o.finSupportLe ?? null, maintenant) === 'atteinte',
    );
    const machinesFin = await this.machinesLues(
      user,
      fin.map((o) => o.id),
    );
    const servicesFin = await servicesFinDeSupport(k, user);
    return {
      niveau,
      tuiles: {
        exploiteesPresentes: suivies.filter((s) => !s.aConfirmer && s.priorite.niveau === 'P1').length,
        aTraiter: { p1: parPriorite.P1, p2: parPriorite.P2 },
        aConfirmer: {
          failles: new Set(propositions.map((p) => p.cve)).size,
          produits: new Set(propositions.map((p) => p.produit_id)).size,
        },
        corrigeesCeMois: corrigees,
        // Lot S1 : objets suivis présents en dépassement de délai, sur tous les faits connus (aucune requête de plus).
        enDepassement: objetsEnDepassement(objets, reglage.delais, maintenant).length,
        exploiteesSansCorrectif: etats.filter((e) => e === 'aucun_connu').length,
        exploiteesCorrectifNonRenseigne: etats.filter((e) => e === 'non_renseigne').length,
        finDeSupport: { constats: fin.length, machines: machinesFin, services: servicesFin },
      },
      total: suivies.length,
      parPriorite,
      cases: [...totaux.values()],
      cibles,
      tronquee: [...totaux.values()].some((c) => c.total > VUE_ENSEMBLE_BORNES.ciblesParCase),
      journal,
      variation: reference
        ? variationSeptJours(reference, {
            niveau: niveau.niveau,
            mesures: { ...actuel.global, machines: null, actifs: null },
          })
        : null,
      calculeLe: maintenant.toISOString(),
    };
  }

  /** Pour l'assistant (lot ASSISTANT-V1, outils `failles_prioritaires` et `machines_prioritaires`) : les cibles du tableau
      « Cibles par priorité » telles que l'écran les rend à la personne (même calcul global, même ordre, mêmes bornes par
      case, mêmes nombres lisibles et même fiche lisible : `lire` et cette méthode partagent `suivies`, `rangerParCase` et
      `rendre`), le total des failles suivies, et les CVE exposées sur Internet parmi TOUTES les failles suivies, dans le
      même ordre, avec leur priorité (les mêmes pour tout le monde, lot ALH5). Aucun nom de machine, de domaine, d'adresse
      ni de périmètre. Requêtes : celles du calcul global et des cibles de la vue, sans le journal ni les tuiles. */
  async cibles(user: SessionUser): Promise<{
    cibles: CibleVueDto[];
    total: number;
    exposees: { cve: string; niveau: NiveauPriorite }[];
  }> {
    const { suivies } = await this.suivies(this.db.k);
    const { retenues } = rangerParCase(suivies);
    return {
      cibles: await this.rendre(user, retenues),
      total: suivies.length,
      exposees: suivies.flatMap((s) =>
        s.x.cve && s.x.presences.has('exposee') ? [{ cve: s.x.cve, niveau: s.priorite.niveau }] : [],
      ),
    };
  }

  /** Failles suivies (calcul global, propositions comprises), rangées dans l'ordre des cibles (comparerCibles). */
  private async suivies(k: Kdb) {
    const propositions = await propositionsEnCours(k);
    const { cumuls, sources, objets, reglage } = await this.alertes.situationGlobale(k, propositions, {
      titres: false,
      machines: false,
    });

    // Failles suivies : au moins une présence non traitée, ou un produit à confirmer.
    const suivies: Suivie[] = [];
    for (const x of cumuls.values()) {
      const presente = prioriteLaPlusHaute(x.priorites);
      const p = prioriteLaPlusHaute([...x.priorites, ...(x.aConfirmer ? [x.aConfirmer] : [])]);
      if (!p) continue;
      const exploitee = exploiteeSelonSources(x, sources);
      suivies.push({
        x,
        priorite: p,
        presences: [
          ...PRESENCES.filter((s) => x.presences.has(s)),
          ...(x.aConfirmer && !x.presences.has('a_confirmer') ? (['a_confirmer'] as const) : []),
        ],
        aConfirmer: !presente,
        secteur: secteurDe(x.familles as FamilleProduit[]),
        exploitee,
      });
    }
    const ordre = (s: Suivie) => ({
      cle: s.x.cle,
      priorite: s.priorite,
      exploitee: s.exploitee,
      aConfirmer: s.aConfirmer,
      exploitable: s.x.exploitable,
      gravite: s.x.gravite,
      epss: s.x.epss,
    });
    // Clés de l'ordre calculées une fois par faille (lot PERF-04), pas à chaque comparaison ; même ordre (comparerCibles).
    const cles = new Map(suivies.map((s) => [s, ordre(s)]));
    suivies.sort((a, b) => comparerCibles(cles.get(a)!, cles.get(b)!));
    return { propositions, cumuls, sources, objets, reglage, suivies };
  }

  /** Cibles rendues à la personne : titres, machines et actifs qu'elle lit, fiche lisible (trois requêtes). */
  private async rendre(user: SessionUser, retenues: readonly Suivie[]): Promise<CibleVueDto[]> {
    const [titres, lisibles, surface] = [
      await this.alertes.titres(
        this.db.k,
        retenues.flatMap((s) => (s.x.cve ? [s.x.cve] : [])),
      ),
      await this.machinesLisibles(user, retenues),
      await this.surfaceLisible(user, retenues),
    ];
    return retenues.map((s) => {
      const { titre, produit } = this.alertes.titreEtProduit(s.x, titres);
      const m = lisibles.get(s.x.cle);
      const a = s.x.cve ? surface.get(s.x.cve) : undefined;
      return {
        cle: s.x.cle,
        cve: s.x.cve,
        titre,
        produit,
        secteur: s.secteur,
        priorite: s.priorite,
        presences: s.presences,
        exploitee: s.exploitee,
        exploitable: s.x.exploitable,
        aConfirmer: s.aConfirmer,
        gravite: s.x.gravite,
        epss: s.x.epss,
        etat: etatLeMoinsAvance(s.x.etats),
        machines: m ? { lisibles: m.lisibles, horsLecture: m.horsLecture } : VIDE,
        actifs: a ? { lisibles: a.actifs, horsLecture: a.horsLecture } : VIDE,
        produitId: [...s.x.produitIds].sort()[0] ?? null,
        fiche: m?.fiche ?? null,
      };
    });
  }

  /** Machines touchées que la personne lit, par faille rendue (une requête), et fiche lisible : le premier constat présent,
      sinon la première faille déclarée, dont elle lit au moins une machine. */
  private async machinesLisibles(user: SessionUser, retenues: readonly Suivie[]) {
    const cves = retenues.flatMap((s) => (s.x.cve ? [s.x.cve] : []));
    const constats = retenues.flatMap((s) => (s.x.cve ? [] : s.x.constatIds));
    const out = new Map<string, NombreLisible & { fiche: FicheCibleDto }>();
    if (!cves.length && !constats.length) return out;
    const { rows } = await sql<{
      cle: string;
      lisibles: number;
      total: number;
      constat: string | null;
      declaree: string | null;
    }>`
      SELECT x.cle, count(DISTINCT x.machine_id) FILTER (WHERE x.lu)::int AS lisibles,
        count(DISTINCT x.machine_id)::int AS total,
        min(x.objet_id::text) FILTER (WHERE x.lu AND x.nature = 'constat') AS constat,
        min(x.objet_id::text) FILTER (WHERE x.lu AND x.nature = 'declaree') AS declaree
      FROM (
        SELECT cc.cve AS cle, 'constat' AS nature, c.id AS objet_id, m.id AS machine_id, ${lisible(user)} AS lu
        FROM vulnerabilites_constat_cves cc
        JOIN vulnerabilites_constats c ON c.id = cc.constat_id
        JOIN vulnerabilites_detections d ON d.constat_id = c.id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE cc.cve = ANY(${cves}::text[]) AND ${present} AND NOT ${close('constat')}
        UNION ALL
        SELECT 'constat:' || c.id::text, 'constat', c.id, m.id, ${lisible(user)}
        FROM vulnerabilites_constats c
        JOIN vulnerabilites_detections d ON d.constat_id = c.id
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE c.id = ANY(${constats}::uuid[]) AND ${present} AND NOT ${close('constat')}
        UNION ALL
        SELECT r.cve, 'declaree', r.id, m.id, ${lisible(user)}
        FROM vulnerabilites_rapprochements r
        JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id
        JOIN vulnerabilites_machines m ON m.id = pm.machine_id
        WHERE r.cve = ANY(${cves}::text[]) AND r.statut IN ('rattachee', 'confirmee') AND NOT ${close('declaree')}
      ) x GROUP BY x.cle`.execute(this.db.k);
    for (const r of rows)
      out.set(r.cle, {
        lisibles: r.lisibles,
        horsLecture: r.total > r.lisibles,
        fiche: r.constat
          ? { nature: 'constat', id: r.constat }
          : r.declaree
            ? { nature: 'declaree', id: r.declaree }
            : null,
      });
    return out;
  }

  /** Lot S3 : machines où les constats donnés (identifiants) sont présents, celles que la personne lit ; drapeau pour les
      autres. Lot PERF-04 : lues ici à partir des constats (le calcul global de la vue ne lit pas les machines), mêmes
      machines qu'avant (détections présentes de ces constats). */
  private async machinesLues(user: SessionUser, constats: readonly string[]): Promise<NombreLisible> {
    if (!constats.length) return { ...VIDE };
    const { rows } = await sql<{ lues: number; total: number }>`
      SELECT count(*) FILTER (WHERE x.lu)::int AS lues, count(*)::int AS total FROM (
        SELECT DISTINCT m.id, ${lisible(user)} AS lu
        FROM vulnerabilites_detections d
        JOIN vulnerabilites_machines m ON m.id = d.machine_id
        LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
        WHERE d.constat_id = ANY(${[...constats]}::uuid[]) AND ${present}) x`.execute(this.db.k);
    const lues = rows[0]?.lues ?? 0;
    return { lisibles: lues, horsLecture: lues < (rows[0]?.total ?? 0) };
  }

  /** Actifs exposés que la personne lit, pour les CVE rendues exposées sur Internet. */
  private async surfaceLisible(user: SessionUser, retenues: readonly Suivie[]) {
    const cves = retenues.flatMap((s) => (s.x.cve && s.x.presences.has('exposee') ? [s.x.cve] : []));
    return cves.length
      ? this.surface.surfaceDesCves(user, cves)
      : new Map<
          string,
          Awaited<ReturnType<SurfaceExterneAlh['surfaceDesCves']>> extends Map<string, infer V> ? V : never
        >();
  }

  /** Objets suivis passés à « Corrigée » depuis le premier jour du mois (Europe/Paris), encore dans cet état. */
  private async corrigeesCeMois(): Promise<number> {
    const { rows } = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM vulnerabilites_suivis
      WHERE etat = 'corrigee'
        AND maj_le >= (date_trunc('month', now() AT TIME ZONE ${FUSEAU}) AT TIME ZONE ${FUSEAU})`.execute(this.db.k);
    return rows[0]?.n ?? 0;
  }

  /** Dernières traces existantes : collectes terminées de la veille, synchronisations terminées de Tenable et
      d'AlgoLightHouse, alertes ouvertes et closes. Ni texte d'erreur, ni nom de machine, de domaine ou d'adresse. */
  private async journal(): Promise<EntreeJournalVueDto[]> {
    const n = VUE_ENSEMBLE_BORNES.journal;
    const { rows } = await sql<{
      nature: EntreeJournalVueDto['nature'];
      le: Date;
      source: SourceVeille | null;
      etat: 'recu' | 'echec' | 'expire' | null;
      elements: number | null;
      connecteur: 'tenable' | 'algolighthouse' | null;
      nom: string | null;
      complete: boolean | null;
      cve: string | null;
      niveau: 'critique' | 'simple' | null;
    }>`
      SELECT * FROM (
        (SELECT 'collecte' AS nature, v.termine_le AS le, v.source, v.etat, v.elements, NULL::text AS connecteur,
           NULL::text AS nom, NULL::boolean AS complete, NULL::text AS cve, NULL::text AS niveau
         FROM vulnerabilites_veille_collectes v WHERE v.termine_le IS NOT NULL ORDER BY v.termine_le DESC LIMIT ${n})
        UNION ALL
        (SELECT 'synchronisation', x.termine_le, NULL, x.etat, coalesce(st.elements, sa.elements), i.type, i.nom,
           coalesce(st.complete, sa.complete), NULL, NULL
         FROM integration_executions x JOIN integrations i ON i.id = x.integration_id
         LEFT JOIN vulnerabilites_synchronisations st ON st.execution_id = x.id
         LEFT JOIN vulnerabilites_alh_synchronisations sa ON sa.execution_id = x.id
         WHERE x.operation = 'synchroniser' AND i.type IN ('tenable', 'algolighthouse') AND x.termine_le IS NOT NULL
         ORDER BY x.termine_le DESC LIMIT ${n})
        UNION ALL
        (SELECT 'alerte_ouverte', a.ouverte_le, NULL, NULL, NULL, NULL, NULL, NULL, a.cve, a.niveau
         FROM vulnerabilites_alertes a ORDER BY a.ouverte_le DESC LIMIT ${n})
        UNION ALL
        (SELECT 'alerte_close', a.close_le, NULL, NULL, NULL, NULL, NULL, NULL, a.cve, a.niveau
         FROM vulnerabilites_alertes a WHERE a.close_le IS NOT NULL ORDER BY a.close_le DESC LIMIT ${n})
      ) j ORDER BY j.le DESC, j.nature LIMIT ${n}`.execute(this.db.k);
    return rows.map((r): EntreeJournalVueDto => {
      const le = r.le.toISOString();
      switch (r.nature) {
        case 'collecte':
          return { nature: 'collecte', le, source: r.source!, etat: r.etat!, elements: r.elements ?? 0 };
        case 'synchronisation':
          return {
            nature: 'synchronisation',
            le,
            connecteur: r.connecteur!,
            nom: r.nom!,
            etat: r.etat!,
            elements: r.elements,
            complete: r.complete,
          };
        default:
          return { nature: r.nature, le, cve: r.cve, niveau: r.niveau! };
      }
    });
  }
}

/** Rapprochements proposés (produit à confirmer), avec la famille du produit : secteur du radar et niveau d'alerte. Une
    requête. Reprise par les instantanés et le rapport du lot S2. */
export async function propositionsEnCours(k: Kdb): Promise<PropositionCumul[]> {
  const { rows } = await sql<PropositionCumul>`
    SELECT r.id, r.cve, r.produit_id, p.editeur, p.nom, p.famille
    FROM vulnerabilites_rapprochements r JOIN vulnerabilites_produits p ON p.id = r.produit_id
    WHERE r.statut = 'proposee' ORDER BY r.cve, r.id`.execute(k);
  return rows;
}

/** Lot S3 : état du correctif d'une faille du calcul global : date de publication du correctif selon Tenable (le plus ancien
    des contrôles qui la portent) et mention « Un correctif existe » du CERT Santé pour sa CVE. Repris par le rapport. */
export function correctifDeCumul(x: Cumul, sources: ReadonlyMap<string, SourcesFailleDto>): EtatCorrectifDto {
  return etatCorrectif({
    tenablePublieLe: x.correctifTenableLe,
    certSante: (x.cve ? sources.get(x.cve)?.certSante?.correctif : null) ?? null,
  });
}

/** Exploitation avérée d'une faille : au moins une source de l'exploitation rangée avec sa CVE, ou un contrôle présent marqué
    « exploité par un logiciel malveillant » par Tenable (lot N2, exploitationDeCumul). */
export const exploiteeSelonSources = (x: Cumul, sources: ReadonlyMap<string, SourcesFailleDto>) =>
  exploitationDeCumul(x, sources).length > 0;

/** Niveau d'alerte de la plateforme (règle du lot PC1), sur les failles du calcul global : les mêmes pour tout le monde.
    Repris par la vue d'ensemble, les instantanés et le rapport (lot S2). */
export function niveauDesFailles(cumuls: ReadonlyMap<string, Cumul>, sources: ReadonlyMap<string, SourcesFailleDto>) {
  const faits = { critiques: 0, simples: 0, p2Presentes: 0, exploiteesAConfirmer: 0 };
  for (const x of cumuls.values()) {
    const presente = prioriteLaPlusHaute(x.priorites);
    if (presente) {
      const n = niveauAlerte({
        priorite: presente.niveau,
        exploitable: x.exploitable,
        exposee: x.presences.has('exposee'),
      });
      if (n === 'critique') faits.critiques++;
      else if (n === 'simple') faits.simples++;
      if (presente.niveau === 'P2') faits.p2Presentes++;
    } else if (x.aConfirmer && exploiteeSelonSources(x, sources)) faits.exploiteesAConfirmer++;
  }
  return niveauAlerteGlobal(faits);
}

/** Cases du radar (secteur × priorité) : total toujours compté, cibles retenues dans l'ordre des failles suivies, bornées
    par case (VUE_ENSEMBLE_BORNES.ciblesParCase). */
function rangerParCase(suivies: readonly Suivie[]) {
  const totaux = new Map<string, CaseRadarDto>();
  const retenues: Suivie[] = [];
  for (const s of suivies) {
    const cle = `${s.secteur}|${s.priorite.niveau}`;
    let c = totaux.get(cle);
    if (!c) totaux.set(cle, (c = { secteur: s.secteur, priorite: s.priorite.niveau, total: 0 }));
    if (c.total < VUE_ENSEMBLE_BORNES.ciblesParCase) retenues.push(s);
    c.total++;
  }
  return { totaux, retenues };
}

/** État le moins avancé des objets suivis encore ouverts (ordre de ETATS_SUIVI : nouvelle, à traiter, en cours…). */
function etatLeMoinsAvance(etats: readonly EtatSuiviFaille[]): EtatSuiviFaille | null {
  let m: EtatSuiviFaille | null = null;
  for (const e of etats) if (m === null || ETATS_SUIVI.indexOf(e) < ETATS_SUIVI.indexOf(m)) m = e;
  return m;
}
