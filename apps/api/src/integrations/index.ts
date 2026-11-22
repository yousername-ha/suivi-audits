/* Module Intégrations (ADR 0076), socle des connecteurs réseau : instances de connecteur, secrets en écriture seule, file des
   exécutions. L'API n'a aucun accès réseau sortant (ADR 0014) : elle inscrit une exécution « en file » ; l'exécutant
   d'exploitation du serveur (scripts/exploitation-worker.py) la réclame par la CLI (`suivi integrations-claim`), lance le
   script isolé scripts/integration-http.py sous un compte sans privilège, puis rapporte un résultat borné
   (`suivi integrations-finish`). Modèle suivi : le courriel (courriel.ts).
   - Secrets scellés par le coffre (Vault.sealSmall, AAD `integration:<id>:<champ>`) dans la ligne `settings`
     `secret:integration:<id>` ; jamais renvoyés ni journalisés, ouverts seulement pour la remise à l'exécutant. Changer
     l'adresse ou l'autorité de certification les supprime (comme le mot de passe SMTP lié à son relais).
   - Flux (ADR 0097) : activer une instance ouvre le flux de son type, après validation explicite d'un administrateur, dans la
     même transaction ; désactiver la dernière instance active du type le referme. Flux fermé : rien n'est réclamé pour ce
     type, une demande en file est close sans appel.
   - Opérations rapportées par lots (« synchroniser », ADR 0100 lots V5 et ALH1) : l'exécutant envoie les éléments par lots
     bornés (`suivi integrations-lot`) avant la fin ; un module destinataire (catalogue OPERATIONS_EN_LOTS) les range, par un
     récepteur propre à chaque type (Tenable, AlgoLightHouse). Ce module désactivé : rien n'est inscrit ni réclamé pour
     l'opération, une demande en file est close sans appel.
   - Mandataire sortant de l'établissement (ADR 0101) : remis à l'exécutant avec la demande, seulement pour un type dont le
     flux l'utilise (USAGE_MANDATAIRE : AlgoLightHouse, service sur Internet) et seulement s'il est actif ; jamais pour un
     connecteur interne (Tenable), qui reste en accès direct par construction. Réglage illisible : la demande est close sans
     appel, jamais faite en direct.
   - Type sans réseau (lot N1 de l'ADR 0100 : « nessus-fichier », import de fichier) : aucun flux, aucun secret, aucune
     opération pour l'exécutant ; l'activer ou le désactiver ne touche aucun flux. Son opération « importer » est inscrite
     directement « en cours » par le service d'import (vulnerabilites/import-nessus.ts), hors de la file : le ménage de la
     file ne la touche pas et l'exécutant ne la réclame jamais.
   Droits contrôlés par route() ; ce service est seul juge du reste (portée, version, secrets, file). Audit `integration.*`
   sans secret. Accès aux données en Kysely (ADR 0062). */
import {
  configurationValide,
  FREQUENCES_CONNECTEUR,
  frequenceConnecteur,
  frequenceConnecteurAdmise,
  frequenceConnecteurReglable,
  type EtatExecution,
  type EtatIntegrationsDto,
  type ExecutionIntegrationDto,
  type IntegrationActivation,
  type IntegrationCreation,
  type IntegrationDto,
  type IntegrationModification,
  type IntegrationType,
  type OperationIntegration,
  OPERATIONS_EN_LOTS,
  type OrigineExecution,
  RapportExecution,
  RESULTATS_OPERATION,
  TYPES_INTEGRATION_RESEAU,
  typeIntegration,
  INTEGRATION_TYPES,
  USAGE_MANDATAIRE,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import type { Actor, Client, Db, Kdb } from '../db/db.js';
import type { IntegrationExecutions, Integrations as LigneIntegrations } from '../db/types.generated.js';
import type { FluxExternes } from '../flux-externes.js';
import { conflict } from '../http/concurrency.js';
import type { Mandataire } from '../mandataire.js';
import { HttpError } from '../http/errors.js';
import type { Vault } from '../security/crypto.js';

type Ligne = Selectable<LigneIntegrations>;
type LigneExecution = Selectable<IntegrationExecutions>;

const cleSecrets = (id: string) => `secret:integration:${id}`;
const aad = (id: string, champ: string) => `integration:${id}:${champ}`;
/** Verrou consultatif de la file des exécutions (comme 727277 pour la file des courriels). */
export const verrouFileIntegrations = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727278)`.execute(k);
const verrouFile = verrouFileIntegrations;
/** Une demande non réclamée après ce délai expire ; une demande « en cours » au-delà est considérée interrompue. Une
    synchronisation dure plus longtemps (lectures paginées bornées à huit minutes, puis envoi des lots) : délais plus longs. */
const EXPIRATION_FILE = sql<Date>`now() - interval '10 minutes'`;
const ABANDON_EN_COURS = sql<Date>`now() - interval '5 minutes'`;
const EXPIRATION_FILE_LONGUE = sql<Date>`now() - interval '60 minutes'`;
const ABANDON_EN_COURS_LONG = sql<Date>`now() - interval '30 minutes'`;
/** « Synchroniser maintenant » : une instance déjà synchronisée à la main depuis moins de ce délai ne l'est pas à nouveau. */
const INTERVALLE_MANUEL = sql<Date>`now() - interval '15 minutes'`;
const OPERATIONS_LONGUES = Object.keys(OPERATIONS_EN_LOTS) as OperationIntegration[];
/** Opération hors de la file (lot N1) : un import est inscrit « en cours » par la personne qui importe ; son abandon est
    traité par le service d'import, jamais par le ménage de la file. */
export const OPERATION_HORS_FILE: OperationIntegration = 'importer';

/** Module destinataire d'une opération rapportée par lots (synchronisation de Tenable : module Vulnérabilités). */
export interface OperationEnLots {
  /** À la réclamation, dans sa transaction : prépare la réception (numéro de synchronisation…). */
  reclamee(k: Kdb, executionId: string, integrationId: string): Promise<void>;
  /** Range un lot d'éléments (validés un à un ; un refus fait refuser tout le lot) ; rend les totaux reçus. */
  lot(k: Kdb, executionId: string, elements: unknown[]): Promise<{ elements: number; lots: number }>;
  /** Fin de l'exécution : `resultat` validé (succès) ou null (échec). Rend une erreur qui change le succès en échec (bilan
      incohérent), ou null. */
  terminee(k: Kdb, c: Client, executionId: string, resultat: Record<string, unknown> | null): Promise<string | null>;
  /** Facultatif : après la validation (COMMIT) d'une fin reçue, hors transaction (statistiques des tables réécrites). Son
      échec est journalisé et ne change pas l'issue de l'exécution. */
  apresValidation?(executionId: string): Promise<void>;
}
const NOM_EXISTANT = 'Une intégration porte déjà ce nom.';
const EXECUTANT = { username: 'exécutant serveur' };
/** Champs de configuration qui désignent la destination : les changer supprime les secrets (à ressaisir). */
const CHAMPS_DESTINATION = ['adresse', 'autoriteCertification'];

const typeConnu = (t: string): t is IntegrationType => (INTEGRATION_TYPES as readonly string[]).includes(t);

const versExecution = (r: LigneExecution): ExecutionIntegrationDto => ({
  id: r.id,
  integrationId: r.integration_id,
  operation: r.operation as OperationIntegration,
  origine: r.origine as OrigineExecution,
  etat: r.etat as EtatExecution,
  demandePar: r.demande_par,
  demandeLe: r.demande_le.toISOString(),
  debuteLe: r.debute_le?.toISOString() ?? null,
  termineLe: r.termine_le?.toISOString() ?? null,
  resultat: (r.resultat as Record<string, unknown> | null) ?? null,
  erreur: r.erreur,
});

/** Données d'audit d'une instance : jamais de secret (la configuration n'en contient pas). */
const resume = (i: IntegrationDto) => ({
  type: i.type,
  nom: i.nom,
  smsiId: i.smsiId,
  configuration: i.configuration,
  frequenceHeures: i.frequenceHeures,
});

/** Lot F1 : fréquence admise pour le type (liste fermée), sinon 422. */
function frequenceControlee(type: IntegrationType, heures: number | undefined): number | undefined {
  if (heures === undefined) return undefined;
  if (!frequenceConnecteurReglable(type))
    throw new HttpError(422, `« ${typeIntegration(type).libelle} » n’a pas de synchronisation automatique.`);
  if (!frequenceConnecteurAdmise(type, heures))
    throw new HttpError(
      422,
      `Fréquence refusée pour ${typeIntegration(type).libelle} : ${FREQUENCES_CONNECTEUR[type].join(', ')} heures seulement.`,
    );
  return heures;
}

const nomEnBase = (e: unknown): never => {
  if ((e as { code?: string }).code === '23505') throw new HttpError(409, NOM_EXISTANT);
  throw e;
};

/** Clé d'un récepteur d'opération par lots : type de connecteur et opération. */
export type CleRecepteur = `${IntegrationType}:${OperationIntegration}`;

/** Ce que l'exécutant reçoit pour lire une instance (lot CVE-INC) : type, configuration, secrets ouverts. */
export interface AccesExecutant {
  type: IntegrationType;
  configuration: Record<string, unknown>;
  secrets: Record<string, string>;
}

export class Integrations {
  /** Modules destinataires des opérations rapportées par lots, par type et par opération, branchés par services.ts. */
  readonly enLots: Partial<Record<CleRecepteur, OperationEnLots>> = {};
  /** Mandataire sortant de l'établissement (ADR 0101), branché par services.ts : seuls les types dont le flux l'utilise le
      reçoivent. */
  mandataire?: Pick<Mandataire, 'pourExecutant'>;
  private recepteur(type: string, operation: string): OperationEnLots | undefined {
    return typeConnu(type) ? this.enLots[`${type}:${operation as OperationIntegration}`] : undefined;
  }
  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
    private readonly flux: FluxExternes,
  ) {}

  /* ---------------------------------------------------------------- Lecture */
  async lister(): Promise<IntegrationDto[]> {
    const lignes = await this.db.k
      .selectFrom('integrations')
      .selectAll()
      .orderBy(sql`lower(nom)`)
      .orderBy('id')
      .execute();
    return Promise.all(lignes.map((l) => this.versDto(l, this.db.k)));
  }

  async lire(id: string, k: Kdb = this.db.k, verrou = false): Promise<IntegrationDto> {
    let q = k.selectFrom('integrations').selectAll().where('id', '=', id);
    if (verrou) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    if (!r) throw new HttpError(404, 'Intégration introuvable.');
    return this.versDto(r, k);
  }

  async executions(id: string, limite = 20): Promise<ExecutionIntegrationDto[]> {
    await this.lire(id);
    const r = await this.db.k
      .selectFrom('integration_executions')
      .selectAll()
      .where('integration_id', '=', id)
      .orderBy('demande_le', 'desc')
      .orderBy('id')
      .limit(limite)
      .execute();
    return r.map(versExecution);
  }

  async execution(id: string): Promise<ExecutionIntegrationDto> {
    const r = await this.db.k.selectFrom('integration_executions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!r) throw new HttpError(404, 'Exécution introuvable.');
    return versExecution(r);
  }

  async etat(): Promise<EtatIntegrationsDto> {
    const w = await this.db.k
      .selectFrom('backup_worker')
      .select(['ready', 'seen_at'])
      .where('id', '=', 1)
      .executeTakeFirst();
    return {
      executant: { disponible: await this.executantDisponible(), vuLe: w?.seen_at.toISOString() ?? null },
      flux: await Promise.all(
        TYPES_INTEGRATION_RESEAU.map(async (t) => ({
          type: t.id,
          flux: t.flux!,
          ouvert: await this.flux.ouvert(t.flux!),
        })),
      ),
    };
  }

  /* ---------------------------------------------------------------- Configuration (integrations:administrer) */
  async creer(body: IntegrationCreation, user: SessionUser, ip: string): Promise<IntegrationDto> {
    const configuration = configurationValide(body.type, body.configuration);
    const frequence = frequenceControlee(body.type, body.frequenceHeures);
    await this.verifierPortee(body.type, body.smsiId);
    return this.db
      .tx(async (c, k) => {
        const { id } = await k
          .insertInto('integrations')
          .values({
            type: body.type,
            nom: body.nom,
            smsi_id: body.smsiId,
            configuration: JSON.stringify(configuration),
            frequence_heures: frequence ?? null,
            actif: false,
            created_by: user.username,
            updated_by: user.username,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const cree = await this.lire(id, k);
        await this.db.audit(user, ip, 'integration.creee', id, resume(cree), c);
        return cree;
      }, user.username)
      .catch(nomEnBase);
  }

  async modifier(
    id: string,
    patch: IntegrationModification,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<IntegrationDto> {
    return this.db
      .tx(async (c, k) => {
        const avant = await this.lire(id, k, true);
        if (avant.version !== attendue) throw conflict({ ...avant, updated_by: avant.updatedBy });
        const configuration =
          patch.configuration !== undefined
            ? configurationValide(avant.type, patch.configuration)
            : avant.configuration;
        const nom = patch.nom ?? avant.nom;
        const frequence = frequenceControlee(avant.type, patch.frequenceHeures);
        await k
          .updateTable('integrations')
          .set((eb) => ({
            nom,
            configuration: JSON.stringify(configuration),
            ...(frequence !== undefined ? { frequence_heures: frequence } : {}),
            version: eb('version', '+', 1),
            updated_by: user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', id)
          .execute();
        // La clé ne vaut que pour la destination pour laquelle elle a été saisie : une autre adresse ou une autre autorité de
        // certification la supprime (même règle que le mot de passe SMTP).
        const destinationChangee = CHAMPS_DESTINATION.some(
          (champ) => JSON.stringify(avant.configuration[champ]) !== JSON.stringify(configuration[champ]),
        );
        if (destinationChangee && Object.values(avant.secrets).some(Boolean)) {
          await k.deleteFrom('settings').where('key', '=', cleSecrets(id)).execute();
          await this.db.audit(user, ip, 'integration.secrets_invalides', id, { type: avant.type, nom }, c);
        }
        const apres = await this.lire(id, k);
        await this.db.audit(
          user,
          ip,
          'integration.modifiee',
          id,
          { avant: resume(avant), apres: resume(apres), version: apres.version },
          c,
        );
        // Lot F1 : changement de fréquence journalisé à part (qui, connecteur, ancienne et nouvelle fréquence).
        if (apres.frequenceHeures !== avant.frequenceHeures)
          await this.db.audit(
            user,
            ip,
            'integration.frequence',
            id,
            { type: avant.type, nom, avant: avant.frequenceHeures, apres: apres.frequenceHeures },
            c,
          );
        return apres;
      }, user.username)
      .catch(nomEnBase);
  }

  /** Activer ouvre le flux du type (validation explicite, droit administration:administrer s'il est fermé) dans la même
      transaction ; désactiver la dernière instance active du type referme ce flux. Réactiver une instance déjà active
      rouvre son flux s'il a été refermé entre-temps (module désactivé, fermeture depuis le résumé des flux). */
  async activer(
    id: string,
    body: IntegrationActivation,
    attendue: number,
    user: SessionUser,
    ip: string,
  ): Promise<IntegrationDto> {
    return this.db.tx(async (c, k) => {
      const avant = await this.lire(id, k, true);
      if (avant.version !== attendue) throw conflict({ ...avant, updated_by: avant.updatedBy });
      const t = typeIntegration(avant.type);
      // Type sans réseau (import de fichier) : aucun flux à ouvrir ni à refermer.
      if (body.actif && t.flux) {
        await this.flux.activer(c, k, t.flux, {
          confirme: body.fluxConfirme,
          administrateur: user.rights.can('administration', 'administrer'),
          actor: user,
          ip,
          origine: 'integrations.activation',
        });
      }
      if (avant.actif !== body.actif)
        await k
          .updateTable('integrations')
          .set((eb) => ({
            actif: body.actif,
            version: eb('version', '+', 1),
            updated_by: user.username,
            updated_at: sql<Date>`now()`,
          }))
          .where('id', '=', id)
          .execute();
      if (!body.actif && t.flux) {
        // Verrou des instances du type : deux désactivations simultanées voient bien la dernière instance active.
        const autres = await k
          .selectFrom('integrations')
          .select('id')
          .where('type', '=', avant.type)
          .where('actif', '=', true)
          .forUpdate()
          .execute();
        if (!autres.length) await this.flux.desactiver(c, k, t.flux, user, ip, 'integrations.activation');
      }
      if (avant.actif !== body.actif)
        await this.db.audit(
          user,
          ip,
          body.actif ? 'integration.activee' : 'integration.desactivee',
          id,
          { type: avant.type, nom: avant.nom, flux: t.flux },
          c,
        );
      return this.lire(id, k);
    }, user.username);
  }

  /** Secrets en écriture seule : chaque champ doit appartenir au type de l'instance et respecter sa forme. Seuls les noms des
      champs sont journalisés. */
  async definirSecrets(id: string, valeurs: Record<string, string | undefined>, user: SessionUser, ip: string) {
    await this.db.tx(async (c, k) => {
      const i = await this.lire(id, k, true);
      const t = typeIntegration(i.type);
      const fournis = Object.entries(valeurs).filter((e): e is [string, string] => e[1] !== undefined);
      for (const [champ, valeur] of fournis) {
        const s = t.secrets.find((x) => x.id === champ);
        if (!s) throw new HttpError(422, `Le connecteur « ${t.libelle} » n’a pas de secret « ${champ} ».`);
        if (!s.motif.test(valeur)) throw new HttpError(422, `${s.libelle} : forme invalide. ${s.aide}`);
      }
      const existants = await this.lireScelles(id, k);
      for (const [champ, valeur] of fournis)
        existants[champ] = this.vault.sealSmall(Buffer.from(valeur, 'utf8'), aad(id, champ)).toString('base64');
      await k
        .insertInto('settings')
        .values({ key: cleSecrets(id), value: JSON.stringify({ scelles: existants }) })
        .onConflict((oc) =>
          oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value'), updated_at: sql<Date>`now()` })),
        )
        .execute();
      await this.db.audit(
        user,
        ip,
        'integration.secret_defini',
        id,
        { type: i.type, nom: i.nom, champs: fournis.map(([champ]) => champ).sort() },
        c,
      );
    }, user.username);
  }

  async retirerSecret(id: string, champ: string, user: SessionUser, ip: string) {
    await this.db.tx(async (c, k) => {
      const i = await this.lire(id, k, true);
      const t = typeIntegration(i.type);
      if (!t.secrets.some((s) => s.id === champ))
        throw new HttpError(422, `Le connecteur « ${t.libelle} » n’a pas de secret « ${champ} ».`);
      const existants = await this.lireScelles(id, k);
      if (!(champ in existants)) return;
      delete existants[champ];
      if (Object.keys(existants).length)
        await k
          .updateTable('settings')
          .set({ value: JSON.stringify({ scelles: existants }), updated_at: sql<Date>`now()` })
          .where('key', '=', cleSecrets(id))
          .execute();
      else await k.deleteFrom('settings').where('key', '=', cleSecrets(id)).execute();
      await this.db.audit(user, ip, 'integration.secret_retire', id, { type: i.type, nom: i.nom, champ }, c);
    }, user.username);
  }

  /* ---------------------------------------------------------------- Exécutions (integrations:modifier) */
  /** Inscrit « Tester la connexion » ; refuse si l'instance est inactive, incomplète, son flux fermé ou l'exécutant absent. */
  async demanderTest(id: string, user: SessionUser, ip: string): Promise<ExecutionIntegrationDto> {
    return this.demander(id, 'tester', user, ip);
  }

  /** Inscrit une opération du type (« tester », « synchroniser ») à la main. Le module destinataire d'une opération par lots
      est contrôlé par la route. « Synchroniser » : refusé si l'instance a déjà été synchronisée à la main depuis moins de
      quinze minutes. */
  async demander(
    id: string,
    operation: OperationIntegration,
    user: SessionUser,
    ip: string,
  ): Promise<ExecutionIntegrationDto> {
    const i = await this.lire(id);
    const t = typeIntegration(i.type);
    if (!t.operations.includes(operation) || !t.flux || operation === OPERATION_HORS_FILE)
      throw new HttpError(422, `Le connecteur « ${t.libelle} » ne connaît pas cette opération.`);
    if (!i.actif) throw new HttpError(409, 'Activez d’abord ce connecteur.');
    const manquants = t.secrets.filter((s) => !i.secrets[s.id]).map((s) => s.libelle);
    if (manquants.length) throw new HttpError(409, `Secrets à enregistrer d’abord : ${manquants.join(', ')}.`);
    await this.flux.exiger(t.flux);
    if (!(await this.executantDisponible()))
      throw new HttpError(
        503,
        'L’exécutant d’exploitation du serveur n’est pas disponible : c’est lui qui interroge les outils externes (guide d’installation, étape 11.6).',
      );
    return this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      const active = await k
        .selectFrom('integration_executions')
        .select('id')
        .where('integration_id', '=', id)
        .where('etat', 'in', ['en_file', 'en_cours'])
        .executeTakeFirst();
      if (active) throw new HttpError(409, 'Une exécution de ce connecteur est déjà en cours.');
      if (OPERATIONS_LONGUES.includes(operation)) {
        const recente = await k
          .selectFrom('integration_executions')
          .select('id')
          .where('integration_id', '=', id)
          .where('operation', '=', operation)
          .where('origine', '=', 'manuel')
          .where('demande_le', '>', INTERVALLE_MANUEL)
          .executeTakeFirst();
        if (recente)
          throw new HttpError(409, 'Synchronisation demandée il y a moins de quinze minutes : réessayez plus tard.');
      }
      const r = await this.inscrire(k, c, i, operation, 'manuel', user, ip);
      return versExecution(r);
    }, user.username);
  }

  /** Inscrit une exécution en file, sous le verrou de la file (à prendre par l'appelant), avec son audit. */
  async inscrire(
    k: Kdb,
    c: Client,
    i: Pick<IntegrationDto, 'id' | 'type' | 'nom'>,
    operation: OperationIntegration,
    origine: OrigineExecution,
    acteur: Actor,
    ip: string | null,
  ): Promise<LigneExecution> {
    const r = await k
      .insertInto('integration_executions')
      .values({ integration_id: i.id, operation, origine, demande_par: acteur.username })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.db.audit(
      acteur,
      ip,
      'integration.execution.demandee',
      r.id,
      { integration: i.id, type: i.type, nom: i.nom, operation, origine },
      c,
    );
    return r;
  }

  /** Ménage de la file, à appeler sous son verrou (planification d'un module destinataire). */
  async menageFile(k: Kdb, c: Client) {
    await this.menage(k, c);
  }

  /** Ménage de la file, sous son verrou : demande jamais réclamée expirée, demande interrompue close. */
  private async menage(k: Kdb, c: Client) {
    const expirees = await k
      .updateTable('integration_executions')
      .set({
        etat: 'expire',
        termine_le: sql<Date>`now()`,
        erreur: 'Demande expirée : l’exécutant ne l’a pas prise en charge à temps.',
      })
      .where('etat', '=', 'en_file')
      .where('operation', '<>', OPERATION_HORS_FILE)
      .where((eb) =>
        eb.or([
          eb.and([eb('operation', 'not in', OPERATIONS_LONGUES), eb('demande_le', '<', EXPIRATION_FILE)]),
          eb.and([eb('operation', 'in', OPERATIONS_LONGUES), eb('demande_le', '<', EXPIRATION_FILE_LONGUE)]),
        ]),
      )
      .returning('id')
      .execute();
    const interrompues = await k
      .updateTable('integration_executions')
      .set({ etat: 'echec', termine_le: sql<Date>`now()`, erreur: 'Exécutant interrompu : aucun résultat reçu.' })
      .where('etat', '=', 'en_cours')
      .where('operation', '<>', OPERATION_HORS_FILE)
      .where((eb) =>
        eb.or([
          eb.and([eb('operation', 'not in', OPERATIONS_LONGUES), eb('debute_le', '<', ABANDON_EN_COURS)]),
          eb.and([eb('operation', 'in', OPERATIONS_LONGUES), eb('debute_le', '<', ABANDON_EN_COURS_LONG)]),
        ]),
      )
      .returning('id')
      .execute();
    for (const r of expirees)
      await this.db.audit(EXECUTANT, null, 'integration.execution.expiree', r.id, { etat: 'expire' }, c);
    for (const r of interrompues)
      await this.db.audit(EXECUTANT, null, 'integration.execution.terminee', r.id, { etat: 'echec' }, c);
  }

  /* ---------------------------------------------------------------- CLI de l'exécutant */
  /** `suivi integrations-claim` : réclame l'exécution en file la plus ancienne dont le type a son flux ouvert et l'instance
      active ; rend ce qu'il faut pour l'exécuter, secrets compris (seul chemin par lequel un secret quitte l'API). Une
      demande dont le flux est fermé ou l'instance désactivée est close sans appel. Le module désactivé : rien n'est
      réclamé et les demandes en file sont closes. Une opération dont le module destinataire est désactivé
      (`modulesInactifs`) est close de même. */
  async reclamer(
    moduleActif: boolean,
    modulesInactifs: readonly string[] = [],
  ): Promise<Record<string, unknown> | null> {
    const ouverts: string[] = [];
    if (moduleActif) for (const t of TYPES_INTEGRATION_RESEAU) if (await this.flux.ouvert(t.flux!)) ouverts.push(t.id);
    const operationsFermees = Object.entries(OPERATIONS_EN_LOTS)
      .filter(([, m]) => modulesInactifs.includes(m))
      .map(([o]) => o);
    const r = await this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
      if (operationsFermees.length) {
        const fermees = await k
          .updateTable('integration_executions')
          .set({
            etat: 'echec',
            termine_le: sql<Date>`now()`,
            erreur: 'Module destinataire désactivé : la demande n’a pas été transmise.',
          })
          .where('etat', '=', 'en_file')
          .where('operation', 'in', operationsFermees)
          .returning('id')
          .execute();
        for (const x of fermees)
          await this.db.audit(EXECUTANT, null, 'integration.execution.terminee', x.id, { etat: 'echec' }, c);
      }
      // Demandes à clore sans appel : instance désactivée, ou type dont le flux est fermé (module désactivé : tous).
      const bloquees = k
        .selectFrom('integrations')
        .select('id')
        .where((eb) =>
          ouverts.length ? eb.or([eb('actif', '=', false), eb('type', 'not in', ouverts)]) : eb('id', 'is not', null),
        );
      const closes = await k
        .updateTable('integration_executions')
        .set({
          etat: 'echec',
          termine_le: sql<Date>`now()`,
          erreur: 'Flux fermé, module ou connecteur désactivé : la demande n’a pas été transmise.',
        })
        .where('etat', '=', 'en_file')
        .where('integration_id', 'in', bloquees)
        .returning('id')
        .execute();
      for (const x of closes)
        await this.db.audit(EXECUTANT, null, 'integration.execution.terminee', x.id, { etat: 'echec' }, c);
      if (!ouverts.length) return undefined;
      const reclamee = await k
        .updateTable('integration_executions')
        .set({ etat: 'en_cours', debute_le: sql<Date>`now()` })
        .where('id', '=', (eb) =>
          eb
            .selectFrom('integration_executions as e')
            .innerJoin('integrations as i', 'i.id', 'e.integration_id')
            .select('e.id')
            .where('e.etat', '=', 'en_file')
            .where('i.actif', '=', true)
            .where('i.type', 'in', ouverts)
            .orderBy('e.demande_le')
            .limit(1),
        )
        .returningAll()
        .executeTakeFirst();
      if (reclamee) {
        const type = await k
          .selectFrom('integrations')
          .select('type')
          .where('id', '=', reclamee.integration_id)
          .executeTakeFirstOrThrow();
        await this.recepteur(type.type, reclamee.operation)?.reclamee(k, reclamee.id, reclamee.integration_id);
        await this.db.audit(
          EXECUTANT,
          null,
          'integration.execution.reclamee',
          reclamee.id,
          { integration: reclamee.integration_id, operation: reclamee.operation },
          c,
        );
      }
      return reclamee;
    });
    if (!r) return null;
    const i = await this.lire(r.integration_id);
    const t = typeIntegration(i.type);
    const secrets: Record<string, string> = {};
    const scelles = await this.lireScelles(i.id, this.db.k);
    for (const s of t.secrets) {
      const b = scelles[s.id];
      if (!b) {
        await this.terminer(r.id, {
          ok: false,
          resultat: null,
          erreur: 'Secret manquant : la demande n’a pas été transmise.',
        });
        return null;
      }
      secrets[s.id] = this.vault.openSmall(Buffer.from(b, 'base64'), aad(i.id, s.id)).toString('utf8');
    }
    // Mandataire (ADR 0101) : seulement pour un flux qui l'utilise (service sur Internet), et seulement s'il est actif.
    let mandataire: Awaited<ReturnType<Mandataire['pourExecutant']>> = null;
    if (t.flux && USAGE_MANDATAIRE[t.flux] === 'utilise' && this.mandataire) {
      mandataire = await this.mandataire.pourExecutant();
      if (mandataire === 'illisible') {
        await this.terminer(r.id, {
          ok: false,
          resultat: null,
          erreur:
            'Réglage du mandataire sortant illisible : la demande n’a pas été transmise (Configuration système, Mandataire sortant).',
        });
        return null;
      }
    }
    return {
      id: r.id,
      type: i.type,
      operation: r.operation,
      configuration: i.configuration,
      secrets,
      ...(mandataire ? { mandataire } : {}),
    };
  }

  /** `suivi integrations-lot <id>` : un lot d'éléments d'une exécution en cours dont l'opération est rapportée par lots. */
  async lot(id: string, elements: unknown[]): Promise<{ elements: number; lots: number }> {
    z.uuid().parse(id);
    return this.db.tx(async (_c, k) => {
      const cur = await k
        .selectFrom('integration_executions as e')
        .innerJoin('integrations as i', 'i.id', 'e.integration_id')
        .select(['e.operation', 'i.type'])
        .where('e.id', '=', id)
        .where('e.etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      const recepteur = cur && this.recepteur(cur.type, cur.operation);
      if (!recepteur) throw new HttpError(409, 'Exécution absente, terminée ou sans envoi par lots.');
      return recepteur.lot(k, id, elements);
    });
  }

  /** `suivi integrations-finish <id>` : enregistre le rapport (validé strictement, résultat typé par opération). */
  async terminer(id: string, rapport: unknown): Promise<ExecutionIntegrationDto> {
    z.uuid().parse(id);
    const p = RapportExecution.parse(rapport);
    let type = '';
    const r = await this.db.tx(async (c, k) => {
      const cur = await k
        .selectFrom('integration_executions as e')
        .innerJoin('integrations as i', 'i.id', 'e.integration_id')
        .select(['e.id', 'e.operation', 'i.type', 'i.nom', 'e.integration_id'])
        .where('e.id', '=', id)
        .where('e.etat', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!cur) return undefined;
      type = cur.type;
      let resultat: Record<string, unknown> | null = null;
      let erreur = p.erreur;
      if (p.ok) {
        const schema = typeConnu(cur.type)
          ? RESULTATS_OPERATION[cur.type][cur.operation as OperationIntegration]
          : undefined;
        const v = schema?.safeParse(p.resultat);
        if (v?.success) resultat = v.data as Record<string, unknown>;
        else erreur = 'Résultat refusé : forme inattendue.';
      }
      const recepteur = this.recepteur(cur.type, cur.operation);
      if (recepteur) {
        const refus = await recepteur.terminee(k, c, id, resultat);
        if (refus) {
          resultat = null;
          erreur = refus;
        }
      }
      const fin = await k
        .updateTable('integration_executions')
        .set({
          etat: resultat ? 'recu' : 'echec',
          termine_le: sql<Date>`now()`,
          resultat: resultat ? JSON.stringify(resultat) : null,
          erreur: resultat ? null : erreur,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.db.audit(
        EXECUTANT,
        null,
        'integration.execution.terminee',
        id,
        {
          integration: cur.integration_id,
          type: cur.type,
          nom: cur.nom,
          operation: cur.operation,
          etat: fin.etat,
          ...(resultat ? { resultat } : { erreur: fin.erreur }),
        },
        c,
      );
      return fin;
    });
    if (!r) throw new HttpError(409, 'Exécution absente ou déjà terminée.');
    const apres = r.etat === 'recu' ? this.recepteur(type, r.operation) : undefined;
    if (apres?.apresValidation)
      await apres
        .apresValidation(id)
        .catch((e: { code?: string }) =>
          this.db.log.warn({ execution: id, code: e.code ?? null }, 'traitement après la fin reçue en échec'),
        );
    return versExecution(r);
  }

  /* ---------------------------------------------------------------- Interne */
  private async verifierPortee(type: IntegrationType, smsiId: string | null) {
    const t = typeIntegration(type);
    if (t.portee === 'organisation') {
      if (smsiId !== null)
        throw new HttpError(422, `« ${t.libelle} » couvre toute l’organisation : aucun périmètre n’est à choisir.`);
      return;
    }
    if (smsiId === null) throw new HttpError(422, `« ${t.libelle} » se rattache à un périmètre : choisissez-le.`);
    if (!(await this.db.k.selectFrom('grc_smsis').select('id').where('id', '=', smsiId).executeTakeFirst()))
      throw new HttpError(422, 'Périmètre introuvable.');
  }

  /** Lot CVE-INC (ADR 0100) : configuration et secrets d'une instance réseau active, pour une demande de lecture remise à
      l'exécutant par une file du module Vulnérabilités (contrôles Tenable qui citent une CVE). Même chemin de sortie que
      `reclamer` (la CLI de l'exécutant, jamais une route) ; null si l'instance est inactive ou si un secret manque. */
  async pourExecutant(id: string): Promise<AccesExecutant | null> {
    const i = await this.lire(id);
    if (!i.actif || !typeConnu(i.type)) return null;
    const t = typeIntegration(i.type);
    if (!t.flux) return null;
    const scelles = await this.lireScelles(i.id, this.db.k);
    const secrets: Record<string, string> = {};
    for (const s of t.secrets) {
      const b = scelles[s.id];
      if (!b) return null;
      secrets[s.id] = this.vault.openSmall(Buffer.from(b, 'base64'), aad(i.id, s.id)).toString('utf8');
    }
    return { type: i.type, configuration: i.configuration, secrets };
  }

  private async lireScelles(id: string, k: Kdb): Promise<Record<string, string>> {
    const r = await k.selectFrom('settings').select('value').where('key', '=', cleSecrets(id)).executeTakeFirst();
    const v = (r?.value as { scelles?: Record<string, string> } | undefined)?.scelles;
    return v && typeof v === 'object' ? { ...v } : {};
  }

  private async versDto(r: Ligne, k: Kdb): Promise<IntegrationDto> {
    const type = r.type as IntegrationType;
    const scelles = await this.lireScelles(r.id, k);
    const derniere = await k
      .selectFrom('integration_executions')
      .selectAll()
      .where('integration_id', '=', r.id)
      .orderBy('demande_le', 'desc')
      .orderBy('id')
      .limit(1)
      .executeTakeFirst();
    return {
      id: r.id,
      type,
      nom: r.nom,
      smsiId: r.smsi_id,
      configuration: r.configuration as Record<string, unknown>,
      actif: r.actif,
      secrets: Object.fromEntries(
        (typeConnu(type) ? typeIntegration(type).secrets : []).map((s) => [s.id, s.id in scelles]),
      ),
      frequenceHeures:
        typeConnu(type) && frequenceConnecteurReglable(type) ? frequenceConnecteur(r.frequence_heures) : null,
      version: r.version,
      createdBy: r.created_by,
      createdAt: r.created_at.toISOString(),
      updatedBy: r.updated_by,
      updatedAt: r.updated_at.toISOString(),
      derniereExecution: derniere ? versExecution(derniere) : null,
    };
  }

  private async executantDisponible(): Promise<boolean> {
    return !!(await this.db.k
      .selectFrom('backup_worker')
      .select('id')
      .where('id', '=', 1)
      .where('ready', '=', true)
      .where('seen_at', '>', sql<Date>`now() - interval '120 seconds'`)
      .executeTakeFirst());
  }
}
