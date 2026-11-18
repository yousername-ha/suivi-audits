/* Module Vulnérabilités (ADR 0100, point 17 et V12 ; lot PC3) : onglet « Périmètres », poste de commandement vu par
   périmètre. Deux lectures, seules, sans écriture ni entrée de journal, sans stockage nouveau :
   - liste : une carte par périmètre que la personne lit (machines lues, priorité la plus haute, failles présentes par
     gravité, chacune comptée une fois par périmètre, machines « zero-day » et « exploitable », machines sans rôle, actifs
     exposés sur Internet rattachés par les périmètres AlgoLightHouse reliés), triée du plus critique au moins critique ;
     plus la carte « Sans périmètre » pour qui administre le module (seul à lire ces machines, point 14) ;
   - détail d'un périmètre : sa carte, le parc du lot PC2 restreint à ses machines (zones de rôle, borne de 250 par zone,
     totaux exacts) et, pour chaque machine reliée par une liaison CONFIRMÉE (lot ALH3) à des actifs exposés que la
     personne lit, les trois premiers actifs et le nombre des autres actifs lisibles. Rien d'un actif illisible.
   Droits : périmètres visibles de la pyramide (grc_smsi_visible) ; machines par leur périmètre effectif (lisible, lot
   V4d) ; actifs par leur périmètre AlgoLightHouse relié (lisibleAlh). Un périmètre illisible répond comme un inconnu (404).
   Priorité et marques : celles du parc (faillesDesMachines, marquesMachine), sur tous les faits connus, les mêmes pour tout
   le monde (lot ALH5), sans majoration par la surface externe. Les compteurs ne portent que sur des machines et des actifs
   lus ; aucun total de ce qui est illisible.
   Périmètres listés : ceux de l'organisation que la personne lit, et tout autre périmètre lu (entité fournisseur) qui porte
   une machine ou un actif exposé.
   Requêtes, nombre fixe, aucune par périmètre ni par machine :
   - liste : périmètres 1, machines lisibles et leurs compteurs 2, réglage 1, marques 9 (faillesDesMachines), failles par
     périmètre 2 (constats, failles déclarées), actifs par périmètre 1 : 16 au plus ;
   - détail : périmètre 1, puis les mêmes restreintes au périmètre (machines 2, réglage 1, marques 9, failles 2, actifs 1),
     liaisons 1 : 17 au plus.
   Rien n'est remis à l'assistant : ni nom de périmètre, ni carte, ni machine (aucun outil nouveau). */
import {
  type CartePerimetreDto,
  type DetailPerimetreDto,
  EXPOSITIONS_PAR_MACHINE,
  type ExpositionTuileDto,
  FAILLES_GRAVITE_VIDES,
  type FaillesParGravite,
  type GraviteTenable,
  type IdPerimetreVue,
  type MachineMarqueeDto,
  marquesMachine,
  PARC_PAR_ZONE,
  PERIMETRE_AUCUN,
  type PerimetresVulnerabilitesDto,
  perimetreOccupe,
  rangerPerimetres,
  repartirParc,
  resumerMachines,
  type TypeActifAlh,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import { type DeclareeMachine, type FaillesDetectees, faillesDesMachines, graviteDeclaree } from './failles.js';
import type { ReglagePrioriteVulnerabilites } from './priorite.js';
import { detecteeSurMachine, lisible, lisibleAlh, perimetreMachine, present } from './sql.js';
import { close } from './suivi.js';

const INTROUVABLE = 'Périmètre introuvable ou non accessible.';
/** Clé d'un périmètre dans les tables de calcul : son identifiant, ou « aucun » pour les machines sans périmètre. */
const cle = (id: string | null) => id ?? PERIMETRE_AUCUN;

/** Restriction facultative au périmètre effectif d'une machine `m` (détail) ; null : sans périmètre. */
type Restriction = { perimetre: string | null } | undefined;

export class PerimetresVulnerabilites {
  constructor(
    private readonly db: Db,
    private readonly failles: FaillesDetectees,
    private readonly reglage: ReglagePrioriteVulnerabilites,
  ) {}

  /** Liste des périmètres lus, du plus critique au moins critique, et carte « Sans périmètre » (administration). */
  async lister(user: SessionUser): Promise<PerimetresVulnerabilitesDto> {
    const { rows: perimetres } = await sql<{ id: string; nom: string; organisation: boolean }>`
      SELECT s.id, s.name AS nom, s.entity_kind = 'organisation' AS organisation FROM grc_smsis s
      WHERE grc_smsi_visible(s.id, ${user.id}::uuid)`.execute(this.db.k);
    const machines = await this.machinesMarquees(user);
    const failles = await this.faillesParPerimetre(user);
    const actifs = await this.actifsParPerimetre(user);
    const parPerimetre = new Map<string, MachineMarqueeDto[]>();
    for (const m of machines)
      parPerimetre.set(cle(m.perimetreId), [...(parPerimetre.get(cle(m.perimetreId)) ?? []), m]);
    const carte = (id: string | null, nom: string | null): CartePerimetreDto => ({
      id,
      nom,
      ...resumerMachines(parPerimetre.get(cle(id)) ?? []),
      failles: failles.get(cle(id)) ?? { ...FAILLES_GRAVITE_VIDES },
      actifsExposes: actifs.get(cle(id)) ?? 0,
    });
    const cartes = perimetres.map((p) => ({ carte: carte(p.id, p.nom), organisation: p.organisation }));
    return {
      perimetres: rangerPerimetres(
        cartes.filter((c) => c.organisation || perimetreOccupe(c.carte)).map((c) => c.carte),
      ),
      sansPerimetre: user.rights.can('vulnerabilites', 'administrer') ? carte(null, null) : null,
    };
  }

  /** Détail d'un périmètre lu (ou « aucun » : machines sans périmètre, administration du module). */
  async detail(user: SessionUser, id: IdPerimetreVue): Promise<DetailPerimetreDto> {
    let perimetre: string | null = null;
    let nom: string | null = null;
    if (id === PERIMETRE_AUCUN) {
      if (!user.rights.can('vulnerabilites', 'administrer')) throw new HttpError(404, INTROUVABLE);
    } else {
      const { rows } = await sql<{ id: string; nom: string }>`SELECT s.id, s.name AS nom FROM grc_smsis s
        WHERE s.id = ${id}::uuid AND grc_smsi_visible(s.id, ${user.id}::uuid)`.execute(this.db.k);
      if (!rows[0]) throw new HttpError(404, INTROUVABLE);
      perimetre = rows[0].id;
      nom = rows[0].nom;
    }
    const restriction = { perimetre };
    const machines = await this.machinesMarquees(user, restriction);
    const failles = await this.faillesParPerimetre(user, restriction);
    const actifs = await this.actifsParPerimetre(user, restriction);
    const zones = repartirParc(machines, PARC_PAR_ZONE);
    const rendues = zones.flatMap((z) => z.machines.map((m) => m.id));
    return {
      carte: {
        id: perimetre,
        nom,
        ...resumerMachines(machines),
        failles: failles.get(cle(perimetre)) ?? { ...FAILLES_GRAVITE_VIDES },
        actifsExposes: actifs.get(cle(perimetre)) ?? 0,
      },
      parc: {
        zones,
        total: machines.length,
        parZone: PARC_PAR_ZONE,
        tronquee: zones.some((z) => z.total > z.machines.length),
      },
      expositions: await this.expositions(user, rendues),
    };
  }

  /* ---------------------------------------------------------------- Calculs (nombre de requêtes fixe) */
  /** Machines lisibles, dans l'ordre du rang (rang parmi toutes les machines lues, comme la liste et le parc), avec leurs
      marques ; restreintes au périmètre demandé pour le détail. */
  private async machinesMarquees(user: SessionUser, r?: Restriction): Promise<MachineMarqueeDto[]> {
    const toutes = await this.failles.machinesRangees(user);
    const retenues = r ? toutes.filter((m) => m.perimetreId === r.perimetre) : toutes;
    const failles = await faillesDesMachines(
      this.db.k,
      await this.reglage.valeurs(),
      retenues.map((m) => m.id),
    );
    return retenues.map((m) => ({ ...m, marques: marquesMachine(failles.get(m.id) ?? []) }));
  }

  /** Failles présentes par périmètre effectif et par gravité, sur les machines lisibles : constats de Tenable présents et
      non traités (gravité de Tenable, chaque constat une fois par périmètre), failles déclarées non détectées sur la
      machine et non traitées (gravité la plus sévère entre NVD et le CERT Santé, chaque CVE une fois par périmètre). Mêmes
      règles que les compteurs d'une machine. */
  private async faillesParPerimetre(user: SessionUser, r?: Restriction): Promise<Map<string, FaillesParGravite>> {
    const restreint = r
      ? sql<boolean>`${perimetreMachine} IS NOT DISTINCT FROM ${r.perimetre}::uuid`
      : sql<boolean>`true`;
    const { rows: constats } = await sql<{ perimetre_id: string | null; gravite: GraviteTenable; n: number }>`
      SELECT ${perimetreMachine} AS perimetre_id, c.gravite, count(DISTINCT c.id)::int AS n
      FROM vulnerabilites_detections d
      JOIN vulnerabilites_machines m ON m.id = d.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      JOIN vulnerabilites_constats c ON c.id = d.constat_id
      WHERE ${lisible(user)} AND ${restreint} AND ${present} AND NOT ${close('constat')}
      GROUP BY 1, 2`.execute(this.db.k);
    const { rows: declarees } = await sql<
      Pick<DeclareeMachine, 'cve' | 'cvss31_gravite' | 'cvss40_gravite' | 'cvss_cert_sante'> & {
        perimetre_id: string | null;
      }
    >`
      SELECT DISTINCT ${perimetreMachine} AS perimetre_id, r.cve, v.cvss31_gravite, v.cvss40_gravite,
             (SELECT max(a.fiche_cvss31) FROM vulnerabilites_veille_avis a WHERE a.source = 'cert-sante'
                AND a.cves @> ARRAY[v.cve]) AS cvss_cert_sante
      FROM vulnerabilites_produits_machines pm
      JOIN vulnerabilites_machines m ON m.id = pm.machine_id
      LEFT JOIN vulnerabilites_tenable_etat e ON e.integration_id = m.integration_id
      JOIN vulnerabilites_rapprochements r ON r.produit_id = pm.produit_id AND r.statut IN ('rattachee', 'confirmee')
      JOIN vulnerabilites_veille_cve v ON v.cve = r.cve
      WHERE ${lisible(user)} AND ${restreint} AND NOT ${detecteeSurMachine} AND NOT ${close('declaree')}`.execute(
      this.db.k,
    );
    const total = new Map<string, FaillesParGravite>();
    const ajouter = (perimetre: string | null, g: GraviteTenable, n: number) => {
      const t = total.get(cle(perimetre)) ?? { ...FAILLES_GRAVITE_VIDES };
      t[g] += n;
      total.set(cle(perimetre), t);
    };
    for (const c of constats) ajouter(c.perimetre_id, c.gravite, c.n);
    // Une même CVE déclarée par plusieurs produits ou sur plusieurs machines du périmètre ne compte qu'une fois.
    const vues = new Set<string>();
    for (const d of declarees) {
      const k = `${cle(d.perimetre_id)}\u0000${d.cve}`;
      const g = graviteDeclaree(d);
      if (!g || vues.has(k)) continue;
      vues.add(k);
      ajouter(d.perimetre_id, g, 1);
    }
    return total;
  }

  /** Actifs exposés présents (vus par la dernière synchronisation complète de leur instance), lisibles, par périmètre de la
      plateforme relié à leur périmètre AlgoLightHouse ; « aucun » : périmètre AlgoLightHouse non relié (administration). */
  private async actifsParPerimetre(user: SessionUser, r?: Restriction): Promise<Map<string, number>> {
    const restreint = r ? sql<boolean>`lp.perimetre_id IS NOT DISTINCT FROM ${r.perimetre}::uuid` : sql<boolean>`true`;
    const { rows } = await sql<{ perimetre_id: string | null; n: number }>`
      SELECT lp.perimetre_id, count(DISTINCT x.id)::int AS n
      FROM vulnerabilites_alh_actifs x
      LEFT JOIN vulnerabilites_alh_etat e ON e.integration_id = x.integration_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      WHERE ${lisibleAlh(user)} AND ${restreint} AND x.vu_numero >= coalesce(e.numero_complet, 0)
      GROUP BY 1`.execute(this.db.k);
    return new Map(rows.map((x) => [cle(x.perimetre_id), x.n]));
  }

  /** Actifs exposés lisibles reliés par une liaison confirmée (lot ALH3) aux machines rendues : les premiers par type
      (domaines d'abord) et valeur, puis le nombre des autres actifs lisibles. Une liaison vers un actif illisible n'est ni
      nommée, ni comptée, ni signalée. */
  private async expositions(user: SessionUser, machines: string[]): Promise<ExpositionTuileDto[]> {
    if (!machines.length) return [];
    const { rows } = await sql<{ machine_id: string; id: string; type: TypeActifAlh; valeur: string }>`
      SELECT l.machine_id, x.id, x.type, x.valeur
      FROM vulnerabilites_alh_liaisons_machines l
      JOIN vulnerabilites_alh_actifs x ON x.id = l.actif_id
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh
      WHERE l.machine_id = ANY(${machines}::uuid[]) AND l.statut = 'confirmee' AND ${lisibleAlh(user)}
      ORDER BY l.machine_id, x.type DESC, x.valeur, x.id`.execute(this.db.k);
    const parMachine = new Map<string, ExpositionTuileDto>();
    for (const x of rows) {
      const e = parMachine.get(x.machine_id) ?? { machineId: x.machine_id, actifs: [], autres: 0 };
      if (e.actifs.length < EXPOSITIONS_PAR_MACHINE) e.actifs.push({ id: x.id, type: x.type, valeur: x.valeur });
      else e.autres++;
      parMachine.set(x.machine_id, e);
    }
    return [...parMachine.values()];
  }
}
