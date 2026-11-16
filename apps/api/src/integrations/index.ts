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
   Droits contrôlés par route() ; ce service est seul juge du reste (portée, version, secrets, file). Audit `integration.*`
   sans secret. Accès aux données en Kysely (ADR 0062). */
import {
  configurationValide,
  type EtatExecution,
  type EtatIntegrationsDto,
  type ExecutionIntegrationDto,
  type IntegrationActivation,
  type IntegrationCreation,
  type IntegrationDto,
  type IntegrationModification,
  type IntegrationType,
  type OperationIntegration,
  type OrigineExecution,
  RapportExecution,
  RESULTATS_OPERATION,
  TYPES_INTEGRATION,
  typeIntegration,
  INTEGRATION_TYPES,
} from '@suivi/shared';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import type { SessionUser } from '../auth.js';
import type { Client, Db, Kdb } from '../db/db.js';
import type { IntegrationExecutions, Integrations as LigneIntegrations } from '../db/types.generated.js';
import type { FluxExternes } from '../flux-externes.js';
import { conflict } from '../http/concurrency.js';
import { HttpError } from '../http/errors.js';
import type { Vault } from '../security/crypto.js';

type Ligne = Selectable<LigneIntegrations>;
type LigneExecution = Selectable<IntegrationExecutions>;

const cleSecrets = (id: string) => `secret:integration:${id}`;
const aad = (id: string, champ: string) => `integration:${id}:${champ}`;
/** Verrou consultatif de la file des exécutions (comme 727277 pour la file des courriels). */
const verrouFile = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727278)`.execute(k);
/** Une demande non réclamée après ce délai expire ; une demande « en cours » au-delà est considérée interrompue. */
const EXPIRATION_FILE = sql<Date>`now() - interval '10 minutes'`;
const ABANDON_EN_COURS = sql<Date>`now() - interval '5 minutes'`;
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
const resume = (i: IntegrationDto) => ({ type: i.type, nom: i.nom, smsiId: i.smsiId, configuration: i.configuration });

const nomEnBase = (e: unknown): never => {
  if ((e as { code?: string }).code === '23505') throw new HttpError(409, NOM_EXISTANT);
  throw e;
};

export class Integrations {
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
        TYPES_INTEGRATION.map(async (t) => ({ type: t.id, flux: t.flux, ouvert: await this.flux.ouvert(t.flux) })),
      ),
    };
  }

  /* ---------------------------------------------------------------- Configuration (integrations:administrer) */
  async creer(body: IntegrationCreation, user: SessionUser, ip: string): Promise<IntegrationDto> {
    const configuration = configurationValide(body.type, body.configuration);
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
        await k
          .updateTable('integrations')
          .set((eb) => ({
            nom,
            configuration: JSON.stringify(configuration),
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
      if (body.actif) {
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
      if (!body.actif) {
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
    const i = await this.lire(id);
    const t = typeIntegration(i.type);
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
      const r = await k
        .insertInto('integration_executions')
        .values({ integration_id: id, operation: 'tester', origine: 'manuel', demande_par: user.username })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.db.audit(
        user,
        ip,
        'integration.execution.demandee',
        r.id,
        { integration: id, type: i.type, nom: i.nom, operation: 'tester', origine: 'manuel' },
        c,
      );
      return versExecution(r);
    }, user.username);
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
      .where('demande_le', '<', EXPIRATION_FILE)
      .returning('id')
      .execute();
    const interrompues = await k
      .updateTable('integration_executions')
      .set({ etat: 'echec', termine_le: sql<Date>`now()`, erreur: 'Exécutant interrompu : aucun résultat reçu.' })
      .where('etat', '=', 'en_cours')
      .where('debute_le', '<', ABANDON_EN_COURS)
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
      réclamé et les demandes en file sont closes. */
  async reclamer(moduleActif: boolean): Promise<Record<string, unknown> | null> {
    const ouverts: string[] = [];
    if (moduleActif) for (const t of TYPES_INTEGRATION) if (await this.flux.ouvert(t.flux)) ouverts.push(t.id);
    const r = await this.db.tx(async (c, k) => {
      await verrouFile(k);
      await this.menage(k, c);
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
      if (reclamee)
        await this.db.audit(
          EXECUTANT,
          null,
          'integration.execution.reclamee',
          reclamee.id,
          { integration: reclamee.integration_id, operation: reclamee.operation },
          c,
        );
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
    return {
      id: r.id,
      type: i.type,
      operation: r.operation,
      configuration: i.configuration,
      secrets,
    };
  }

  /** `suivi integrations-finish <id>` : enregistre le rapport (validé strictement, résultat typé par opération). */
  async terminer(id: string, rapport: unknown): Promise<ExecutionIntegrationDto> {
    z.uuid().parse(id);
    const p = RapportExecution.parse(rapport);
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
