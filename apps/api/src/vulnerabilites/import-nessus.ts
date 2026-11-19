/* Module Vulnérabilités (ADR 0100, lot N1 ; décision du RSSI du 19/11/2026) : import d'un scan Nessus déposé dans la carte
   « Intégrations » (connecteur « nessus-fichier » : ni adresse, ni clé, ni flux, ni exécutant). Le fichier .nessus est lu
   dans le navigateur ; l'API ne lit aucun XML : elle reçoit un extrait en JSON, par lots de machines entières, revalidé
   champ par champ (packages/shared/src/import-nessus.ts), et le range par le chemin d'écriture des synchronisations de
   Tenable Security Center (tenable.ts, `rangerPassage`) : mêmes tables, même numéro de passage par instance.
   - Un import est une exécution de l'instance (opération « importer »), inscrite directement « en cours » au début, sous le
     nom de la personne qui importe : elle seule envoie ses lots et le termine. Un import à la fois par instance ; un import
     resté sans lot pendant trente minutes est clos comme interrompu (au début d'un autre import, ou au tic de l'API).
   - Gravités retenues : celles de la configuration de l'instance au début de l'import, fixées pour tout l'import ; un lot qui
     porte une autre gravité est refusé (le navigateur filtre, le serveur revérifie).
   - Chaque lot est un passage complet pour ses machines, dans une seule transaction : numéro de passage suivant ; machines,
     constats, CVE et détections rangés ; les détections déjà présentes des machines de l'instance qui ne sont pas dans le
     lot, et ces machines, sont reportées au nouveau numéro (elles ne changent pas) ; puis le numéro de référence avance.
     Pour chaque machine du lot, une faille qui n'y figure plus n'est donc plus présente (décision du RSSI : disparition par
     machine scannée) ; les machines absentes du fichier ne changent pas. Rien n'est supprimé. Un lot refusé ne change rien.
   - Après chaque lot rangé, dans sa transaction : suivi des failles (propositions « corrigée »), liaisons avec la surface
     externe et évaluation des alertes, comme après une synchronisation reçue (`apresImport`, branché par services.ts).
   Journal `integration.import.*` et `vulnerabilites.import.lot` : instance, exécution, nombres et gravités ; jamais un nom
   de machine, une adresse ni un nom de fichier (le nom du fichier ne quitte pas le navigateur).
   Lot N2 (décisions du RSSI du 19/11/2026) : chaque contrôle porte `exploiteMalware` (exploitation avérée selon Tenable) ;
   suppression d'une instance d'import et de tout ce qu'elle a importé (`supprimer`, refus net pour tout autre type). */
import {
  BilanImportNessus,
  type ConstatImportNessus,
  type DebutImportDto,
  type DebutImportNessus,
  type EcartsImportNessus,
  type ElementDetectionTenable,
  type ElementMachineTenable,
  type EtatImportNessusDto,
  GRAVITE_TENABLE_LIBELLES,
  GRAVITES_PAR_DEFAUT,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type LotImportNessus,
  NESSUS_BORNES,
  type ResultatLotImportDto,
  type SuppressionImportDto,
  TYPE_NESSUS_FICHIER,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { SessionUser } from '../auth.js';
import type { Actor, Client, Db, Kdb } from '../db/db.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import { type Integrations, verrouFileIntegrations } from '../integrations/index.js';
import type { ConstatPassage, SynchronisationTenable } from './tenable.js';

const PLANIFICATION = { username: 'planification' };
const INACTIVITE = sql<Date>`now() - make_interval(mins => ${NESSUS_BORNES.inactiviteMinutes})`;

const SUPPRESSION_REFUSEE =
  'Seul un connecteur « Nessus, import de fichier » se supprime avec ce qu’il a importé ; ce lot ne crée pas la suppression des autres connecteurs.';

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Gravités de la configuration de l'instance (critiques et élevées par défaut). */
const gravitesDe = (configuration: Record<string, unknown>): GraviteTenable[] => {
  const g = configuration.gravites;
  return Array.isArray(g) ? GRAVITES_TENABLE.filter((x) => g.includes(x)) : [...GRAVITES_PAR_DEFAUT];
};

interface LigneImport {
  execution_id: string;
  integration_id: string;
  gravites: string[];
  machines_annoncees: number;
  detections_annoncees: number;
  ecartes: unknown;
  lots: number;
  machines: number;
  detections: number;
  disparues: number;
  premier_numero: number | null;
  dernier_numero: number | null;
}

export class ImportNessus {
  /** Après chaque lot rangé, dans sa transaction : suivi, liaisons, alertes (branché par services.ts). */
  apresImport?: (k: Kdb, c: Client, integrationId: string) => Promise<void>;

  constructor(
    private readonly db: Db,
    private readonly integrations: Integrations,
    private readonly tenable: Pick<SynchronisationTenable, 'rangerPassage'>,
  ) {}

  /* ---------------------------------------------------------------- Début */
  async debuter(id: string, body: DebutImportNessus, user: SessionUser, ip: string): Promise<DebutImportDto> {
    const i = await this.integrations.lire(id);
    if (i.type !== TYPE_NESSUS_FICHIER) throw new HttpError(422, 'Ce connecteur ne reçoit pas d’import de fichier.');
    if (!i.actif) throw new HttpError(409, 'Activez d’abord ce connecteur.');
    const gravites = gravitesDe(i.configuration);
    return this.db.tx(async (c, k) => {
      await verrouFileIntegrations(k);
      await this.clore(k, c, id);
      const active = await k
        .selectFrom('integration_executions')
        .select('id')
        .where('integration_id', '=', id)
        .where('etat', 'in', ['en_file', 'en_cours'])
        .executeTakeFirst();
      if (active) throw new HttpError(409, 'Un import de ce connecteur est déjà en cours.');
      const x = await k
        .insertInto('integration_executions')
        .values({
          integration_id: id,
          operation: 'importer',
          origine: 'manuel',
          etat: 'en_cours',
          demande_par: user.username,
          debute_le: sql<Date>`now()`,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await k
        .insertInto('vulnerabilites_imports')
        .values({
          execution_id: x.id,
          integration_id: id,
          gravites,
          machines_annoncees: body.machines,
          detections_annoncees: body.detections,
          ecartes: JSON.stringify(body.ecartes),
        })
        .execute();
      await this.db.audit(
        user,
        ip,
        'integration.import.debute',
        x.id,
        {
          integration: id,
          type: i.type,
          machinesAnnoncees: body.machines,
          detectionsAnnoncees: body.detections,
          gravites,
          ecartes: body.ecartes,
        },
        c,
      );
      return { id: x.id, gravites };
    }, user.username);
  }

  /* ---------------------------------------------------------------- Lot */
  async lot(
    id: string,
    executionId: string,
    lot: LotImportNessus,
    user: SessionUser,
    ip: string,
  ): Promise<ResultatLotImportDto> {
    return this.db.tx(async (c, k) => {
      const imp = await this.importEnCours(k, id, executionId, user);
      if (imp.lots >= NESSUS_BORNES.lotsParImport) throw new HttpError(409, 'Nombre de lots dépassé pour cet import.');
      if (imp.machines + lot.machines.length > imp.machines_annoncees)
        throw new HttpError(422, 'Lot refusé : plus de machines que l’import n’en annonçait.');
      const retenues = new Set(imp.gravites);
      const hors = lot.constats.find((x) => !retenues.has(x.gravite));
      if (hors)
        throw new HttpError(
          422,
          `Lot refusé : gravité « ${GRAVITE_TENABLE_LIBELLES[hors.gravite]} » hors des gravités retenues pour cet import.`,
        );
      // Numéro de passage suivant de l'instance (même compteur que les synchronisations de Tenable).
      await k
        .insertInto('vulnerabilites_tenable_etat')
        .values({ integration_id: id })
        .onConflict((oc) => oc.column('integration_id').doNothing())
        .execute();
      const e = await k
        .selectFrom('vulnerabilites_tenable_etat')
        .select(['numero', 'numero_complet'])
        .where('integration_id', '=', id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const numero = e.numero + 1;
      const reference = e.numero_complet;
      const detections = lot.machines.flatMap((m) => m.detections.map((d) => ({ m: m.machine, d })));
      await this.tenable.rangerPassage(
        k,
        id,
        numero,
        {
          machines: lot.machines.map((x): ElementMachineTenable => ({
            type: 'machine',
            cle: x.machine.cle,
            uuid: x.machine.uuid,
            nom: x.machine.nom,
            adresse: x.machine.adresse,
            systeme: x.machine.systeme,
            premiere: x.machine.debut ?? x.machine.fin,
            derniere: x.machine.fin ?? x.machine.debut,
            exposition: null,
            acr: null,
            depot: null,
          })),
          // Lot N2 : `exploiteMalware` (revalidé par le schéma partagé) suit le constat jusqu'à sa colonne.
          constats: lot.constats.map((x: ConstatImportNessus): ConstatPassage => ({
            type: 'constat',
            ...x,
            finSupportLe: null,
          })),
          detections: detections.map(({ m, d }): ElementDetectionTenable => {
            const le = m.fin ?? m.debut;
            return {
              type: 'detection',
              plugin: d.plugin,
              machine: m.cle,
              port: d.port,
              protocole: d.protocole,
              premiere: le,
              derniere: le,
              attenue: false,
              risqueAccepte: false,
              risqueRequalifie: false,
            };
          }),
        },
        TYPE_NESSUS_FICHIER,
      );
      const ids = (
        await k
          .selectFrom('vulnerabilites_machines')
          .select('id')
          .where('integration_id', '=', id)
          .where(
            'identifiant_source',
            'in',
            lot.machines.map((m) => m.machine.cle),
          )
          .execute()
      ).map((r) => r.id);
      // Disparues : présentes sur une machine du lot avant ce passage, absentes du fichier.
      const { rows: disp } = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM vulnerabilites_detections
        WHERE machine_id = ANY(${ids}::uuid[]) AND vu_numero >= ${reference}::int AND vu_numero < ${numero}::int`.execute(
        k,
      );
      const disparues = disp[0]?.n ?? 0;
      // Report des machines hors du lot : ce qui était présent le reste (machine absente du fichier : inchangée).
      await sql`
        UPDATE vulnerabilites_detections d SET vu_numero = ${numero}::int
        FROM vulnerabilites_machines m
        WHERE d.machine_id = m.id AND m.integration_id = ${id}::uuid AND m.id <> ALL(${ids}::uuid[])
          AND d.vu_numero >= ${reference}::int`.execute(k);
      await sql`
        UPDATE vulnerabilites_machines SET vu_numero = ${numero}::int
        WHERE integration_id = ${id}::uuid AND id <> ALL(${ids}::uuid[]) AND vu_numero >= ${reference}::int`.execute(k);
      await k
        .updateTable('vulnerabilites_tenable_etat')
        .set({ numero, numero_complet: numero, complete_le: sql<Date>`now()` })
        .where('integration_id', '=', id)
        .execute();
      const r = await k
        .updateTable('vulnerabilites_imports')
        .set((eb) => ({
          lots: eb('lots', '+', 1),
          machines: eb('machines', '+', lot.machines.length),
          detections: eb('detections', '+', detections.length),
          disparues: eb('disparues', '+', disparues),
          premier_numero: sql<number>`coalesce(premier_numero, ${numero}::int)`,
          dernier_numero: numero,
          maj_le: sql<Date>`now()`,
        }))
        .where('execution_id', '=', executionId)
        .returning(['lots', 'machines', 'detections'])
        .executeTakeFirstOrThrow();
      await this.apresImport?.(k, c, id);
      await this.db.audit(
        user,
        ip,
        'vulnerabilites.import.lot',
        executionId,
        {
          integration: id,
          numero,
          machines: lot.machines.length,
          constats: lot.constats.length,
          detections: detections.length,
          disparues,
        },
        c,
      );
      return { lots: r.lots, machines: r.machines, detections: r.detections };
    }, user.username);
  }

  /* ---------------------------------------------------------------- Suppression (lot N2) */
  /** Ce que la suppression ferait disparaître (fenêtre de confirmation). Autre type de connecteur : 422. */
  async apercuSuppression(id: string): Promise<SuppressionImportDto> {
    const i = await this.integrations.lire(id);
    if (i.type !== TYPE_NESSUS_FICHIER) throw new HttpError(422, SUPPRESSION_REFUSEE);
    return this.compter(this.db.k, id);
  }

  /** Supprime une instance « Nessus, import de fichier » et tout ce qu'elle a importé (décision du RSSI du 19/11/2026),
      If-Match sur la version de l'instance. Refus net pour tout autre type (422) et pendant un import en cours (409).
      Les clés étrangères de la migration 075 et suivantes effacent en cascade : exécutions et journal des imports,
      machines, détections, constats (propres à l'instance : jamais partagés avec une autre), leurs CVE, suivis et
      propositions de l'assistant, liaisons actif ↔ machine, produits reliés aux machines (la liaison seulement), état des
      passages. Les signalements de dépassement de délai des constats effacés (sans clé étrangère) partent avec eux.
      Restent, par construction : l'historique du suivi (table immuable, jamais contournée), les instantanés des
      tendances (historiques, jamais réécrits), le journal d'audit, les alertes (réévaluées ici, dans les règles
      existantes : une alerte dont la seule présence venait de cet import se clôt, motif « plus présente »), les repères de
      l'assistant (machine remise à null par la clé de la migration 079). Journal : qui, type et nombres seulement. */
  async supprimer(id: string, attendue: number, user: SessionUser, ip: string): Promise<SuppressionImportDto> {
    return this.db.tx(async (c, k) => {
      await verrouFileIntegrations(k);
      const avant = await this.integrations.lire(id, k, true);
      if (avant.type !== TYPE_NESSUS_FICHIER) throw new HttpError(422, SUPPRESSION_REFUSEE);
      if (avant.version !== attendue) throw conflict({ ...avant, updated_by: avant.updatedBy });
      await this.clore(k, c, id);
      const active = await k
        .selectFrom('integration_executions')
        .select('id')
        .where('integration_id', '=', id)
        .where('etat', 'in', ['en_file', 'en_cours'])
        .executeTakeFirst();
      if (active)
        throw new HttpError(409, 'Un import de ce connecteur est en cours : attendez sa fin pour le supprimer.');
      const n = await this.compter(k, id);
      await sql`DELETE FROM vulnerabilites_depassements WHERE nature = 'constat'
        AND objet_id IN (SELECT id FROM vulnerabilites_constats WHERE integration_id = ${id}::uuid)`.execute(k);
      await k.deleteFrom('integrations').where('id', '=', id).execute();
      await this.apresSuppression?.(k, c);
      await this.db.audit(user, ip, 'integration.supprimee', id, { type: avant.type, ...n }, c);
      return n;
    }, user.username);
  }

  /** Après une suppression, dans sa transaction : liaisons et alertes réévaluées (branché par services.ts). */
  apresSuppression?: (k: Kdb, c: Client) => Promise<void>;

  private async compter(k: Kdb, id: string): Promise<SuppressionImportDto> {
    const { rows } = await sql<SuppressionImportDto>`SELECT
        (SELECT count(*)::int FROM vulnerabilites_machines WHERE integration_id = ${id}::uuid) AS machines,
        (SELECT count(*)::int FROM vulnerabilites_constats WHERE integration_id = ${id}::uuid) AS failles,
        (SELECT count(*)::int FROM vulnerabilites_detections d JOIN vulnerabilites_machines m ON m.id = d.machine_id
           WHERE m.integration_id = ${id}::uuid) AS detections,
        (SELECT count(*)::int FROM vulnerabilites_imports WHERE integration_id = ${id}::uuid) AS imports`.execute(k);
    return rows[0]!;
  }

  /* ---------------------------------------------------------------- Fin */
  /** Fin d'un import : reçu si toutes les machines annoncées sont rangées, sinon en échec (les machines rangées le restent). */
  async terminer(id: string, executionId: string, user: SessionUser, ip: string): Promise<BilanImportNessus> {
    return this.db.tx(async (c, k) => {
      const imp = await this.importEnCours(k, id, executionId, user);
      return this.cloreImport(k, c, imp, user, ip, null);
    }, user.username);
  }

  /** Clôt les imports de l'instance (ou de toutes, sans instance) restés sans lot pendant trente minutes. À appeler sous le
      verrou de la file, ou seul (tic de l'API). */
  async clore(k: Kdb, c: Client, integrationId?: string): Promise<number> {
    let q = k
      .selectFrom('vulnerabilites_imports as v')
      .innerJoin('integration_executions as x', 'x.id', 'v.execution_id')
      .selectAll('v')
      .where('x.etat', '=', 'en_cours')
      .where('v.maj_le', '<', INACTIVITE)
      .orderBy('v.maj_le')
      .forUpdate();
    if (integrationId) q = q.where('v.integration_id', '=', integrationId);
    const lignes = (await q.execute()) as LigneImport[];
    for (const l of lignes)
      await this.cloreImport(k, c, l, PLANIFICATION, null, 'Import abandonné : aucun lot reçu depuis trente minutes.');
    return lignes.length;
  }

  /** Tic de l'API : clôt les imports abandonnés (le module Vulnérabilités est contrôlé par l'appelant). */
  async tic(): Promise<number> {
    return this.db.tx(async (c, k) => {
      await verrouFileIntegrations(k);
      return this.clore(k, c);
    });
  }

  /* ---------------------------------------------------------------- État (vulnerabilites:lire) */
  async etat(): Promise<EtatImportNessusDto[]> {
    const instances = (await this.integrations.lister()).filter((i) => i.type === TYPE_NESSUS_FICHIER);
    const out: EtatImportNessusDto[] = [];
    for (const i of instances) {
      const e = await this.db.k
        .selectFrom('vulnerabilites_tenable_etat')
        .select('complete_le')
        .where('integration_id', '=', i.id)
        .executeTakeFirst();
      const d = await this.db.k
        .selectFrom('integration_executions as x')
        .leftJoin('vulnerabilites_imports as v', 'v.execution_id', 'x.id')
        .select([
          'x.id',
          'x.etat',
          'x.demande_le',
          'x.termine_le',
          'x.erreur',
          'v.execution_id',
          'v.integration_id',
          'v.gravites',
          'v.machines_annoncees',
          'v.detections_annoncees',
          'v.ecartes',
          'v.lots',
          'v.machines',
          'v.detections',
          'v.disparues',
          'v.premier_numero',
          'v.dernier_numero',
        ])
        .where('x.integration_id', '=', i.id)
        .where('x.operation', '=', 'importer')
        .orderBy('x.demande_le', 'desc')
        .orderBy('x.id')
        .limit(1)
        .executeTakeFirst();
      out.push({
        integrationId: i.id,
        nom: i.nom,
        actif: i.actif,
        gravites: gravitesDe(i.configuration),
        derniere: d
          ? {
              id: d.id,
              etat: d.etat as NonNullable<EtatImportNessusDto['derniere']>['etat'],
              demandeLe: d.demande_le.toISOString(),
              termineLe: d.termine_le?.toISOString() ?? null,
              erreur: d.erreur,
              bilan: d.execution_id ? await this.bilan(this.db.k, d as unknown as LigneImport) : null,
            }
          : null,
        derniereCompleteLe: e?.complete_le?.toISOString() ?? null,
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------- Interne */
  /** Import en cours de l'instance, verrouillé ; seule la personne qui l'a commencé l'alimente et le termine. */
  private async importEnCours(k: Kdb, id: string, executionId: string, user: SessionUser): Promise<LigneImport> {
    const r = await k
      .selectFrom('vulnerabilites_imports as v')
      .innerJoin('integration_executions as x', 'x.id', 'v.execution_id')
      .selectAll('v')
      .select(['x.etat', 'x.demande_par'])
      .where('v.execution_id', '=', executionId)
      .where('v.integration_id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    if (!r) throw new HttpError(404, 'Import introuvable.');
    if (r.etat !== 'en_cours') throw new HttpError(409, 'Import déjà terminé : recommencez l’import du fichier.');
    if (r.demande_par !== user.username)
      throw new HttpError(409, 'Cet import a été commencé par une autre personne : elle seule peut le poursuivre.');
    return r as unknown as LigneImport;
  }

  private async bilan(k: Kdb, l: LigneImport): Promise<BilanImportNessus> {
    let constats = 0;
    if (l.premier_numero !== null && l.dernier_numero !== null) {
      const { rows } = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM vulnerabilites_constats
        WHERE integration_id = ${l.integration_id}::uuid
          AND vu_numero BETWEEN ${l.premier_numero}::int AND ${l.dernier_numero}::int`.execute(k);
      constats = rows[0]?.n ?? 0;
    }
    return BilanImportNessus.parse({
      machinesAnnoncees: l.machines_annoncees,
      machines: l.machines,
      constats,
      detections: l.detections,
      disparues: l.disparues,
      lots: l.lots,
      ecartes: l.ecartes as EcartsImportNessus,
      gravites: GRAVITES_TENABLE.filter((g) => l.gravites.includes(g)),
    });
  }

  /** Termine un import : reçu si complet, sinon en échec avec un message qui dit ce qui est rangé. */
  private async cloreImport(
    k: Kdb,
    c: Client,
    l: LigneImport,
    acteur: Actor,
    ip: string | null,
    motif: string | null,
  ): Promise<BilanImportNessus> {
    const bilan = await this.bilan(k, l);
    const complet = bilan.machines === bilan.machinesAnnoncees;
    const erreur = complet
      ? null
      : `${motif ?? 'Import interrompu.'} ${pluriel(bilan.machines, 'machine importée', 'machines importées')} sur ${bilan.machinesAnnoncees} ; les machines importées le restent, réimportez le fichier pour les autres.`;
    await k
      .updateTable('integration_executions')
      .set({
        etat: complet ? 'recu' : 'echec',
        termine_le: sql<Date>`now()`,
        resultat: complet ? JSON.stringify(bilan) : null,
        erreur: erreur ? erreur.slice(0, 300) : null,
      })
      .where('id', '=', l.execution_id)
      .execute();
    await this.db.audit(
      acteur,
      ip,
      'integration.import.termine',
      l.execution_id,
      { integration: l.integration_id, etat: complet ? 'recu' : 'echec', ...bilan },
      c,
    );
    return bilan;
  }
}
