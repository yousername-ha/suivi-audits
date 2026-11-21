/* Module Vulnérabilités (ADR 0100, lot S2 ; décision du RSSI du 18/11/2026) : historique de la situation (instantanés
   quotidiens) et tendances.
   - Instantané : au tic de l'API, au plus une fois par jour (fuseau de l'organisation) ; rien si le module est désactivé. Le
     créneau du jour est consommé AVANT le calcul (ligne « en_cours », dans sa propre transaction) : un calcul en échec laisse
     « echec » et n'est pas rejoué le même jour ; un jour sans tic (panne) reste sans instantané, rien n'est rattrapé. Le
     calcul reprend le calcul global des alertes (AlertesVulnerabilites.situationGlobale, sur TOUS les faits connus, les
     mêmes pour tout le monde, lot ALH5) et les objets suivis du lot S1 ; il range le niveau d'alerte de la plateforme et les
     nombres pour toute la plateforme et par périmètre (périmètre effectif des machines, périmètre AlgoLightHouse relié des
     actifs ; « aucun » à part). Des nombres seulement : aucun nom de machine, de domaine, d'adresse ni de compte. Purge au
     même tic des instantanés plus anciens que la rétention (RETENTION_INSTANTANES_ANS, à confirmer). Journal :
     `vulnerabilites.instantane.pris` (jour, niveau, nombre de périmètres, instantanés purgés).
   - L'historique commence à l'installation du lot : aucun passé n'est reconstruit.
   - Lecture des tendances (vulnerabilites:lire), seule, sans journal : toute la plateforme (nombres de failles communs à
     tous ; ni total de machines ni d'actifs), un périmètre que la personne lit (404 sinon, comme l'onglet « Périmètres »),
     ou « sans périmètre » avec le droit d'administrer le module.
   Requêtes, nombre fixe, aucune par faille :
   - instantané : créneau 1 ; propositions 1, calcul global 17 au plus (réglage 1, constats 1, failles déclarées 1,
     expositions 2, majoration 4 au plus, faits des sources 3, titres 1), périmètres des machines 1 et des actifs 1,
     corrections de la veille 1 ; écriture des nombres 1, état 1, purge 1, journal 1 : 27 au plus ;
   - tendances : périmètre 0 ou 1, périmètres lus 1, instantanés 1, premier instantané 1 : 4 au plus. */
import {
  composerInstantane,
  decalerJour,
  type EntreeInstantane,
  type FailleInstantane,
  granularite,
  agregerParSemaine,
  type IdPerimetreVue,
  type Instantane,
  type InstantaneLu,
  type MesuresAffichees,
  type MesuresInstantane,
  type NiveauAlerteGlobal,
  type NiveauAlerteGlobalDto,
  type ObjetInstantane,
  PERIMETRE_AUCUN,
  PERIMETRE_INSTANTANE_AUCUN,
  pointsParJour,
  prioriteLaPlusHaute,
  type Priorite,
  type RechercheTendances,
  type ReglagePriorite,
  RETENTION_INSTANTANES_ANS,
  type SourcesFailleDto,
  tendanceSituation,
  type TendancesDto,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Db, Kdb } from '../db/db.js';
import { HttpError } from '../http/errors.js';
import type { Modules } from '../modules.js';
import type { AlertesVulnerabilites, Cumul, ObjetDelai } from './alertes.js';
import { objetsEnDepassement } from './delais.js';
import { perimetreMachine } from './sql.js';
import { aujourdhui } from './suivi.js';
import { exploiteeSelonSources, niveauDesFailles, propositionsEnCours } from './vue-ensemble.js';

const SYSTEME = { username: 'système' };
const FUSEAU = 'Europe/Paris';
const INTROUVABLE = 'Périmètre introuvable ou non accessible.';

/** Portée d'une lecture : toute la plateforme (id null, aucun false), un périmètre, ou « sans périmètre ». */
export interface Portee {
  id: string | null;
  nom: string | null;
  aucun: boolean;
}

/** Failles et objets du calcul global, sous la forme attendue par composerInstantane (sans nom). `machines` à false (vue
    d'ensemble, lot PERF-04) : machines et actifs omis, pour les seules mesures globales qui n'en dépendent pas (nombres de
    failles par priorité, exploitées, dépassements, exceptions) ; les totaux de machines et d'actifs sont alors nuls. */
export function entreesInstantane(
  cumuls: ReadonlyMap<string, Cumul>,
  sources: ReadonlyMap<string, SourcesFailleDto>,
  objets: readonly ObjetDelai[],
  reglage: ReglagePriorite,
  maintenant: Date,
  cartes: Pick<EntreeInstantane, 'perimetreMachine' | 'perimetreActif' | 'corrections'> = {
    perimetreMachine: new Map(),
    perimetreActif: new Map(),
    corrections: [],
  },
  machines = true,
): EntreeInstantane {
  const failles: FailleInstantane[] = [];
  for (const x of cumuls.values()) {
    const p = prioriteLaPlusHaute(x.priorites);
    if (!p) continue;
    failles.push({
      priorite: p.niveau,
      exploitee: exploiteeSelonSources(x, sources),
      machines: machines ? [...x.machines] : [],
      actifs: machines ? x.actifIds : [],
    });
  }
  const depasses = new Set(objetsEnDepassement(objets, reglage.delais, maintenant).map((o) => `${o.nature}:${o.id}`));
  const objetsInst: ObjetInstantane[] = objets.map((o) => ({
    depassement: depasses.has(`${o.nature}:${o.id}`),
    exception: o.etat === 'risque_accepte',
    machines: machines ? o.machines : [],
  }));
  return { failles, objets: objetsInst, ...cartes };
}

/** Instantané global de référence pour la variation sur sept jours : le plus récent pris entre J-14 et J-7. Une requête. */
export async function instantaneDeReference(
  k: Kdb,
  maintenant: Date,
): Promise<{ jour: string; niveau: NiveauAlerteGlobal; mesures: MesuresAffichees } | null> {
  const jour = aujourdhui(maintenant);
  const { rows } = await sql<LigneMesures & { jour: string; niveau: number }>`
    SELECT i.jour::text AS jour, i.niveau, ${colonnesMesures}
    FROM vulnerabilites_instantanes i
    JOIN vulnerabilites_instantanes_mesures m ON m.jour = i.jour AND m.portee = 'global'
    WHERE i.etat = 'pris' AND i.jour <= ${decalerJour(jour, -7)}::date AND i.jour >= ${decalerJour(jour, -14)}::date
    ORDER BY i.jour DESC LIMIT 1`.execute(k);
  const r = rows[0];
  return r
    ? {
        jour: r.jour,
        niveau: r.niveau as NiveauAlerteGlobal,
        mesures: { ...versMesures(r), machines: null, actifs: null },
      }
    : null;
}

interface LigneMesures {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  exploitees: number;
  depassements: number;
  exceptions: number;
  corrigees_veille: number;
  machines: number;
  actifs: number;
}
const colonnesMesures = sql`m.p1, m.p2, m.p3, m.p4, m.exploitees, m.depassements, m.exceptions, m.corrigees_veille,
  m.machines, m.actifs`;
const versMesures = (r: LigneMesures): MesuresInstantane => ({
  p1: r.p1,
  p2: r.p2,
  p3: r.p3,
  p4: r.p4,
  exploitees: r.exploitees,
  depassements: r.depassements,
  exceptions: r.exceptions,
  corrigeesVeille: r.corrigees_veille,
  machines: r.machines,
  actifs: r.actifs,
});

/** Situation du moment, mesurée comme un instantané : niveau, nombres, et ce qu'il faut au rapport. */
export interface SituationMesuree {
  niveau: NiveauAlerteGlobalDto;
  instantane: Instantane;
  /** Failles présentes, avec leur priorité et les périmètres qu'elles touchent (identifiants, ou « aucun »). */
  presentes: { x: Cumul; priorite: Priorite; perimetres: Set<string> }[];
  objets: ObjetDelai[];
  /** Périmètres touchés par chaque objet suivi (clé « nature:id »). */
  perimetresObjet: (o: ObjetDelai) => Set<string>;
  titres: Map<string, { titre: string | null; produit: string | null }>;
  reglage: ReglagePriorite;
  /** Lot S3 : ce que disent les sources de chaque CVE (état du correctif) et périmètre (clé) d'une machine. */
  sources: ReadonlyMap<string, SourcesFailleDto>;
  perimetreDeMachine: (machine: string) => string;
}

export class TendancesVulnerabilites {
  /** Dernier jour pour lequel le tic a tenté un instantané (évite une requête à chaque minute ; la base fait foi). */
  private dernierJour: string | null = null;

  constructor(
    private readonly db: Db,
    private readonly alertes: Pick<AlertesVulnerabilites, 'situationGlobale'>,
    private readonly modules: Pick<Modules, 'state'>,
  ) {}

  /* ---------------------------------------------------------------- Mesure (instantané et rapport) */
  /** Calcul global et nombres du moment. `corrections` : fenêtre des corrections comptées (instantané : la veille). */
  async mesurer(k: Kdb, maintenant: Date, corrections: { du: Date; au: Date } | null): Promise<SituationMesuree> {
    const propositions = await propositionsEnCours(k);
    const { cumuls, sources, titres, objets, reglage } = await this.alertes.situationGlobale(k, propositions);
    const { rows: machines } = await sql<{ id: string; perimetre_id: string | null }>`
      SELECT m.id, ${perimetreMachine} AS perimetre_id FROM vulnerabilites_machines m`.execute(k);
    const { rows: actifs } = await sql<{ id: string; perimetre_id: string | null }>`
      SELECT x.id, lp.perimetre_id FROM vulnerabilites_alh_actifs x
      LEFT JOIN vulnerabilites_alh_perimetres lp ON lp.integration_id = x.integration_id AND lp.alh_id = x.perimetre_alh`.execute(
      k,
    );
    const corrigees = corrections ? await this.corrections(k, corrections.du, corrections.au) : [];
    const perimetreMachine_ = new Map(machines.map((m) => [m.id, m.perimetre_id]));
    const perimetreActif = new Map(actifs.map((a) => [a.id, a.perimetre_id]));
    const entree = entreesInstantane(cumuls, sources, objets, reglage, maintenant, {
      perimetreMachine: perimetreMachine_,
      perimetreActif,
      corrections: corrigees,
    });
    const cleMachine = (m: string) => perimetreMachine_.get(m) ?? PERIMETRE_INSTANTANE_AUCUN;
    const cleActif = (a: string) => perimetreActif.get(a) ?? PERIMETRE_INSTANTANE_AUCUN;
    const presentes: SituationMesuree['presentes'] = [];
    for (const x of cumuls.values()) {
      const p = prioriteLaPlusHaute(x.priorites);
      if (p)
        presentes.push({
          x,
          priorite: p,
          perimetres: new Set([...[...x.machines].map(cleMachine), ...x.actifIds.map(cleActif)]),
        });
    }
    return {
      niveau: niveauDesFailles(cumuls, sources),
      instantane: composerInstantane(entree),
      presentes,
      objets,
      perimetresObjet: (o) => new Set(o.machines.map(cleMachine)),
      titres,
      reglage,
      sources,
      perimetreDeMachine: cleMachine,
    };
  }

  /** Objets passés à « Corrigée » dans [du, au[, avec leurs machines (constat : toutes ses détections ; faille déclarée :
      machines reliées à son produit). Une requête ; aucun nom. */
  private async corrections(k: Kdb, du: Date, au: Date): Promise<{ machines: string[] }[]> {
    const { rows } = await sql<{ machines: string[] | null }>`
      SELECT DISTINCT ON (h.nature, h.objet_id)
        CASE WHEN h.nature = 'constat'
          THEN (SELECT array_agg(DISTINCT d.machine_id) FROM vulnerabilites_detections d WHERE d.constat_id = h.objet_id)
          ELSE (SELECT array_agg(DISTINCT pm.machine_id) FROM vulnerabilites_rapprochements r
                JOIN vulnerabilites_produits_machines pm ON pm.produit_id = r.produit_id WHERE r.id = h.objet_id)
        END AS machines
      FROM vulnerabilites_suivi_historique h
      WHERE h.evenement = 'changement' AND h.etat_apres = 'corrigee' AND h.cree_le >= ${du} AND h.cree_le < ${au}
      ORDER BY h.nature, h.objet_id`.execute(k);
    return rows.map((r) => ({ machines: r.machines ?? [] }));
  }

  /* ---------------------------------------------------------------- Instantané (tic de l'API) */
  /** Appelé à chaque tic : un instantané par jour au plus ; rien si le module est désactivé (le créneau n'est alors pas
      consommé : l'instantané du jour sera pris au premier tic qui suit la réactivation). */
  async tic(maintenant = new Date()): Promise<'pris' | 'deja' | 'echec' | null> {
    const jour = aujourdhui(maintenant);
    if (this.dernierJour === jour) return null;
    try {
      if ((await this.modules.state(true)).disabled.includes('vulnerabilites')) return null;
    } catch (e) {
      this.db.log.error({ err: (e as Error).message }, 'instantané vulnérabilités : état des modules illisible');
      return null;
    }
    this.dernierJour = jour;
    return this.prendre(maintenant);
  }

  /** Prend l'instantané du jour : créneau consommé d'abord (une transaction), calcul ensuite (une autre). Rend « deja » si le
      créneau du jour est déjà pris, « echec » si le calcul a échoué (créneau consommé, pas de nouvel essai ce jour-là). */
  async prendre(maintenant = new Date()): Promise<'pris' | 'deja' | 'echec'> {
    const jour = aujourdhui(maintenant);
    const creneau = await this.db.k
      .insertInto('vulnerabilites_instantanes')
      .values({ jour })
      .onConflict((oc) => oc.column('jour').doNothing())
      .returning('etat')
      .executeTakeFirst();
    if (!creneau) return 'deja';
    try {
      await this.db.tx(async (c, k) => {
        const { rows: bornes } = await sql<{ du: Date; au: Date }>`
          SELECT ((${jour}::date - 1)::timestamp AT TIME ZONE ${FUSEAU}) AS du,
                 (${jour}::date::timestamp AT TIME ZONE ${FUSEAU}) AS au`.execute(k);
        const s = await this.mesurer(k, maintenant, bornes[0]!);
        const ligne = (portee: 'global' | 'perimetre' | 'aucun', perimetre: string | null, m: MesuresInstantane) => ({
          jour,
          portee,
          perimetre_id: perimetre,
          p1: m.p1,
          p2: m.p2,
          p3: m.p3,
          p4: m.p4,
          exploitees: m.exploitees,
          depassements: m.depassements,
          exceptions: m.exceptions,
          corrigees_veille: m.corrigeesVeille,
          machines: m.machines,
          actifs: m.actifs,
        });
        await k
          .insertInto('vulnerabilites_instantanes_mesures')
          .values([
            ligne('global', null, s.instantane.global),
            ...[...s.instantane.perimetres].map(([p, m]) =>
              p === PERIMETRE_INSTANTANE_AUCUN ? ligne('aucun', null, m) : ligne('perimetre', p, m),
            ),
          ])
          .execute();
        await k
          .updateTable('vulnerabilites_instantanes')
          .set({ etat: 'pris', fin: sql<Date>`now()`, niveau: s.niveau.niveau })
          .where(sql<boolean>`jour = ${jour}::date`)
          .execute();
        const purge = await sql`DELETE FROM vulnerabilites_instantanes
          WHERE jour < ${jour}::date - ${RETENTION_INSTANTANES_ANS}::int * interval '1 year'`.execute(k);
        await this.db.audit(
          SYSTEME,
          null,
          'vulnerabilites.instantane.pris',
          jour,
          {
            niveau: s.niveau.niveau,
            perimetres: s.instantane.perimetres.size,
            purges: Number(purge.numAffectedRows ?? 0),
          },
          c,
        );
      }, SYSTEME.username);
      return 'pris';
    } catch (e) {
      this.db.log.error({ err: (e as Error).message, jour }, 'instantané vulnérabilités : calcul en échec');
      await this.db.k
        .updateTable('vulnerabilites_instantanes')
        .set({ etat: 'echec', fin: sql<Date>`now()` })
        .where(sql<boolean>`jour = ${jour}::date`)
        .where('etat', '=', 'en_cours')
        .execute()
        .catch(() => undefined);
      return 'echec';
    }
  }

  /* ---------------------------------------------------------------- Lecture */
  /** Portée demandée, lue avec les droits : un périmètre illisible ou inconnu répond 404 (même message), « aucun » sans le
      droit d'administrer aussi. */
  async portee(user: SessionUser, id: IdPerimetreVue | undefined): Promise<Portee> {
    if (id === undefined) return { id: null, nom: null, aucun: false };
    if (id === PERIMETRE_AUCUN) {
      if (!user.rights.can('vulnerabilites', 'administrer')) throw new HttpError(404, INTROUVABLE);
      return { id: null, nom: null, aucun: true };
    }
    const { rows } = await sql<{ id: string; nom: string }>`SELECT s.id, s.name AS nom FROM grc_smsis s
      WHERE s.id = ${id}::uuid AND grc_smsi_visible(s.id, ${user.id}::uuid)`.execute(this.db.k);
    if (!rows[0]) throw new HttpError(404, INTROUVABLE);
    return { id: rows[0].id, nom: rows[0].nom, aucun: false };
  }

  /** Instantanés pris de `du` à `au` compris, pour la portée : le niveau d'alerte de la plateforme et les nombres de la
      portée (un périmètre sans ligne un jour pris compte zéro). Toute la plateforme : ni machines ni actifs (null). */
  async instantanes(k: Kdb, portee: Portee, du: string, au: string): Promise<InstantaneLu[]> {
    const filtre = portee.aucun
      ? sql<boolean>`m.portee = 'aucun'`
      : portee.id
        ? sql<boolean>`m.portee = 'perimetre' AND m.perimetre_id = ${portee.id}::uuid`
        : sql<boolean>`m.portee = 'global'`;
    const { rows } = await sql<{ jour: string; niveau: number } & { [K in keyof LigneMesures]: number | null }>`
      SELECT i.jour::text AS jour, i.niveau, ${colonnesMesures}
      FROM vulnerabilites_instantanes i
      LEFT JOIN vulnerabilites_instantanes_mesures m ON m.jour = i.jour AND ${filtre}
      WHERE i.etat = 'pris' AND i.jour >= ${du}::date AND i.jour <= ${au}::date
      ORDER BY i.jour`.execute(k);
    return rows.map((r) => {
      const m = versMesures({
        p1: r.p1 ?? 0,
        p2: r.p2 ?? 0,
        p3: r.p3 ?? 0,
        p4: r.p4 ?? 0,
        exploitees: r.exploitees ?? 0,
        depassements: r.depassements ?? 0,
        exceptions: r.exceptions ?? 0,
        corrigees_veille: r.corrigees_veille ?? 0,
        machines: r.machines ?? 0,
        actifs: r.actifs ?? 0,
      });
      const global = !portee.id && !portee.aucun;
      return {
        jour: r.jour,
        niveau: r.niveau as NiveauAlerteGlobal,
        mesures: global ? { ...m, machines: null, actifs: null } : m,
      };
    });
  }

  /** Jour du plus ancien instantané pris (historique depuis le …), ou null. */
  async depuis(k: Kdb): Promise<string | null> {
    const { rows } = await sql<{ jour: string | null }>`
      SELECT min(jour)::text AS jour FROM vulnerabilites_instantanes WHERE etat = 'pris'`.execute(k);
    return rows[0]?.jour ?? null;
  }

  async lire(user: SessionUser, q: RechercheTendances): Promise<TendancesDto> {
    const k = this.db.k;
    const portee = await this.portee(user, q.perimetre);
    const { rows: perimetres } = await sql<{ id: string; nom: string }>`SELECT s.id, s.name AS nom FROM grc_smsis s
      WHERE grc_smsi_visible(s.id, ${user.id}::uuid) ORDER BY s.name, s.id`.execute(k);
    const maintenant = new Date();
    const au = aujourdhui(maintenant);
    const du = decalerJour(au, -(q.periode - 1));
    const jours = pointsParJour(await this.instantanes(k, portee, du, au), du, au);
    const semaines = agregerParSemaine(jours);
    const g = granularite(q.periode);
    return {
      periode: q.periode,
      granularite: g,
      du,
      au,
      perimetre: portee,
      depuis: await this.depuis(k),
      jours,
      semaines,
      tendance: tendanceSituation(g === 'jour' ? jours : semaines),
      perimetres,
      sansPerimetre: user.rights.can('vulnerabilites', 'administrer'),
      retentionAns: RETENTION_INSTANTANES_ANS,
      calculeLe: maintenant.toISOString(),
    };
  }
}
