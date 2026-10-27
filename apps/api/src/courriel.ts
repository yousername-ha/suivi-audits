/* Courriel (décision 1 du 25/10/2026, ADR 0049) : configuration SMTP/SMTPS, mot de passe scellé, contact technique et message
   de test réel. L'API n'a pas d'accès réseau sortant : elle ne fait que mettre la demande en file ; l'exécutant d'exploitation
   du serveur (scripts/exploitation-worker.py) la réclame par la CLI, envoie le message sous un compte sans privilège et rapporte
   le résultat étape par étape. Le message de test ne part que vers le contact technique (« destination autorisée »). Le mot de
   passe est scellé par le coffre (AES-GCM) ; il ne quitte l'API que pour l'exécutant, jamais vers le navigateur ni un journal. */
import { randomUUID } from 'node:crypto';
import type { SettingsValues, TestCourrielDto } from '@suivi/shared';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Actor, Db, Kdb } from './db/db.js';
import { HttpError } from './http/errors.js';
import { adresseUtilisable, EXPIRATION_NOTIFICATION_JOURS } from './notifications-metier.js';
import type { Vault } from './security/crypto.js';

const CLE = 'secret:courriel';
const AAD = 'courriel:mot-de-passe';
/** Une demande « en cours » depuis plus longtemps est considérée interrompue (l'exécutant a pu s'arrêter). */
const DELAI_ABANDON_MS = 3 * 60_000;

interface Ligne {
  id: string;
  kind: 'test' | 'notification';
  user_id: string | null;
  subject: string | null;
  body: string | null;
  status: TestCourrielDto['status'];
  requested_by: string;
  to_address: string;
  result: { steps?: TestCourrielDto['steps']; error?: string | null } | null;
  created_at: Date;
  finished_at: Date | null;
  attempts: number;
}
const dto = (r: Ligne): TestCourrielDto => ({
  id: r.id,
  status: r.status,
  requestedBy: r.requested_by,
  to: r.to_address,
  createdAt: r.created_at.toISOString(),
  finishedAt: r.finished_at?.toISOString() ?? null,
  steps: r.result?.steps ?? [],
  error: r.result?.error ?? null,
});
export const RapportCourriel = z
  .object({
    ok: z.boolean(),
    steps: z
      .array(z.object({ step: z.string().max(80), ok: z.boolean(), detail: z.string().max(400) }).strict())
      .max(20),
    error: z.string().max(600).nullable(),
    /** Échec qu'aucune relance ne peut corriger (destinataire refusé par le serveur) : la demande n'est pas remise en file. */
    permanent: z.boolean().optional(),
  })
  .strict();

type Relance = Pick<SettingsValues['courriel'], 'relanceEssais' | 'relanceDelaiMinutes'>;
/** Prochain essai après le n-ième : délai de base (minutes, lié), doublé à chaque échec, plafonné à 24 h. */
const prochainEssai = (minutes: number) =>
  sql<Date>`now() + (LEAST(1440, ${minutes}::int * power(2, GREATEST(attempts - 1, 0))) * interval '1 minute')`;
/** Résultat d'une demande close sans envoi : aucune étape, message fixe. */
const sansEnvoi = (erreur: string) => JSON.stringify({ steps: [], error: erreur });
/** Verrou consultatif de la file des courriels : SQL direct (ADR 0062). */
const verrouFile = (k: Kdb) => sql`SELECT pg_advisory_xact_lock(727277)`.execute(k);
const demandes = (k: Kdb) => k.selectFrom('courriel_jobs').selectAll();
const versLigne = (r: unknown) => r as Ligne;

export class Courriel {
  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
  ) {}

  async motDePasseDefini(): Promise<boolean> {
    return !!(await this.db.k.selectFrom('settings').select('key').where('key', '=', CLE).executeTakeFirst());
  }

  async definirMotDePasse(password: string, user: Actor, ip: string): Promise<void> {
    const scelle = this.vault.sealSmall(Buffer.from(password, 'utf8'), AAD).toString('base64');
    await this.db.tx(async (c, k) => {
      await k
        .insertInto('settings')
        .values({ key: CLE, value: JSON.stringify({ sealed: scelle }) })
        .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
        .execute();
      await this.db.audit(user, ip, 'courriel.mot_de_passe_defini', '', {}, c);
    }, user.username);
  }

  async retirerMotDePasse(user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c, k) => {
      await k.deleteFrom('settings').where('key', '=', CLE).execute();
      await this.db.audit(user, ip, 'courriel.mot_de_passe_retire', '', {}, c);
    }, user.username);
  }

  private async lireMotDePasse(): Promise<string> {
    const r = await this.db.k.selectFrom('settings').select('value').where('key', '=', CLE).executeTakeFirst();
    if (!r) return '';
    return this.vault.openSmall(Buffer.from((r.value as { sealed: string }).sealed, 'base64'), AAD).toString('utf8');
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

  /** Met en file un message de test vers le contact technique ; refuse si la configuration est incomplète ou l'exécutant absent. */
  async demanderTest(c: SettingsValues['courriel'], user: Actor, ip: string): Promise<TestCourrielDto> {
    if (!c.actif)
      throw new HttpError(409, 'L’envoi de courriels est désactivé : activez-le et enregistrez avant de tester.');
    if (!c.hote || !c.expediteur || !c.contactTechnique)
      throw new HttpError(409, 'Renseignez l’hôte, l’adresse d’expédition et le contact technique, puis enregistrez.');
    if (c.utilisateur && !(await this.motDePasseDefini()))
      throw new HttpError(409, 'Un compte est configuré mais aucun mot de passe n’est enregistré.');
    if (!(await this.executantDisponible()))
      throw new HttpError(
        503,
        'L’exécutant d’exploitation du serveur n’est pas disponible : c’est lui qui envoie les courriels (guide d’installation, étape 11.6).',
      );
    return this.db.tx(async (cl, k) => {
      await verrouFile(k);
      await k
        .updateTable('courriel_jobs')
        .set({
          status: 'echec',
          finished_at: sql<Date>`now()`,
          result: sansEnvoi('Demande abandonnée : l’exécutant n’a pas répondu.'),
        })
        .where('kind', '=', 'test')
        .where('status', 'in', ['en_attente', 'en_cours'])
        .where('created_at', '<', sql<Date>`now() - interval '3 minutes'`)
        .execute();
      const active = await k
        .selectFrom('courriel_jobs')
        .select('id')
        .where('kind', '=', 'test')
        .where('status', 'in', ['en_attente', 'en_cours'])
        .executeTakeFirst();
      if (active) throw new HttpError(409, 'Un message de test est déjà en cours.');
      const r = versLigne(
        await k
          .insertInto('courriel_jobs')
          .values({ id: randomUUID(), kind: 'test', requested_by: user.username, to_address: c.contactTechnique })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
      await this.db.audit(
        user,
        ip,
        'courriel.test_demande',
        r.id,
        { host: c.hote, port: c.port, to: c.contactTechnique },
        cl,
      );
      return dto(r);
    }, user.username);
  }

  async lireDemande(id: string): Promise<TestCourrielDto> {
    const r = await demandes(this.db.k).where('id', '=', id).where('kind', '=', 'test').executeTakeFirst();
    if (!r) throw new HttpError(404, 'Demande introuvable.');
    return dto(versLigne(r));
  }

  async derniere(): Promise<TestCourrielDto | null> {
    const r = await demandes(this.db.k)
      .where('kind', '=', 'test')
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return r ? dto(versLigne(r)) : null;
  }

  /** CLI hôte (exécutant) : réclame la demande la plus ancienne (le message de test passe avant les notifications) et renvoie
      ce qu'il faut pour l'envoyer, mot de passe compris. Une demande de notification dont le destinataire est devenu
      inutilisable (désactivé, expiré, sans adresse) est close sans envoi et la suivante est réclamée. */
  async reclamer(c: SettingsValues['courriel']): Promise<Record<string, unknown> | null> {
    for (let essai = 0; essai < 50; essai++) {
      const r = await this.db.tx(async (_cl, k) => {
        await verrouFile(k);
        // Une notification interrompue (exécutant arrêté en cours d'envoi) est remise en file tant qu'il reste des essais ; le
        // message de test, lancé à la main, est simplement clos.
        const abandon = sql<Date>`now() - (${DELAI_ABANDON_MS}::int * interval '1 millisecond')`;
        await k
          .updateTable('courriel_jobs')
          .set({
            status: 'en_attente',
            started_at: null,
            next_attempt_at: prochainEssai(c.relanceDelaiMinutes),
            result: sansEnvoi('Exécutant interrompu : nouvel essai programmé.'),
          })
          .where('kind', '=', 'notification')
          .where('status', '=', 'en_cours')
          .where('attempts', '<', sql<number>`${c.relanceEssais}::int`)
          .where('started_at', '<', abandon)
          .execute();
        await k
          .updateTable('courriel_jobs')
          .set({
            status: 'echec',
            finished_at: sql<Date>`now()`,
            result: sansEnvoi('Exécutant interrompu : aucun essai restant.'),
          })
          .where('status', '=', 'en_cours')
          .where('started_at', '<', abandon)
          .execute();
        await k
          .updateTable('courriel_jobs')
          .set({
            status: 'echec',
            finished_at: sql<Date>`now()`,
            to_address: '',
            result: sansEnvoi('Demande expirée : l’exécutant n’a pas pu l’envoyer à temps.'),
          })
          .where('kind', '=', 'notification')
          .where('status', '=', 'en_attente')
          .where('created_at', '<', sql<Date>`now() - (${EXPIRATION_NOTIFICATION_JOURS}::int * interval '1 day')`)
          .execute();
        const reclamee = await k
          .updateTable('courriel_jobs')
          .set((eb) => ({ status: 'en_cours', started_at: sql<Date>`now()`, attempts: eb('attempts', '+', 1) }))
          .where('id', '=', (eb) =>
            eb
              .selectFrom('courriel_jobs')
              .select('id')
              .where('status', '=', 'en_attente')
              .where('next_attempt_at', '<=', sql<Date>`now()`)
              .orderBy(sql`(kind = 'test')`, 'desc')
              .orderBy('created_at')
              .limit(1),
          )
          .returningAll()
          .executeTakeFirst();
        return reclamee && versLigne(reclamee);
      });
      if (!r) return null;
      if (!c.actif || !c.hote || !c.expediteur) {
        await this.terminer(r.id, {
          ok: false,
          steps: [],
          error: 'La configuration a changé : l’envoi est désactivé ou incomplet.',
        });
        return null;
      }
      let to = r.to_address;
      if (r.kind === 'notification') {
        const u = r.user_id
          ? await this.db.k
              .selectFrom('users')
              .select('email')
              .where('id', '=', r.user_id)
              .where('disabled', '=', false)
              .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', sql<Date>`now()`)]))
              .executeTakeFirst()
          : undefined;
        if (!u || !adresseUtilisable(u.email)) {
          await this.terminer(r.id, {
            ok: false,
            steps: [],
            error: 'Destinataire désactivé, expiré ou sans adresse : rien n’a été envoyé.',
          });
          continue;
        }
        to = u.email.trim();
      }
      return {
        id: r.id,
        kind: r.kind,
        host: c.hote,
        port: c.port,
        security: c.securite,
        username: c.utilisateur,
        password: c.utilisateur ? await this.lireMotDePasse() : '',
        from: c.expediteur,
        to,
        ca: c.autoriteCertification.trim(),
        requested_by: r.requested_by,
        ...(r.kind === 'notification' ? { subject: r.subject ?? '', body: r.body ?? '' } : {}),
      };
    }
    return null;
  }

  /** CLI hôte : enregistre le rapport de l'envoi (jamais de secret). Une notification qui échoue de façon passagère est remise en
      file avec un délai croissant tant qu'il reste des essais (réglages du courriel) ; le message de test n'est jamais relancé. */
  async terminer(id: string, rapport: unknown, relance?: Relance): Promise<void> {
    z.uuid().parse(id);
    const p = RapportCourriel.parse(rapport);
    const r = await this.db.tx(async (cl, k) => {
      const trouvee = await demandes(k)
        .where('id', '=', id)
        .where('status', '=', 'en_cours')
        .forUpdate()
        .executeTakeFirst();
      if (!trouvee) return undefined;
      const courante = versLigne(trouvee);
      const resultat = JSON.stringify({ steps: p.steps, error: p.error });
      if (
        !p.ok &&
        !p.permanent &&
        relance &&
        courante.kind === 'notification' &&
        courante.attempts < relance.relanceEssais
      ) {
        await k
          .updateTable('courriel_jobs')
          .set({
            status: 'en_attente',
            started_at: null,
            result: resultat,
            next_attempt_at: prochainEssai(relance.relanceDelaiMinutes),
          })
          .where('id', '=', id)
          .execute();
        return courante;
      }
      const ligne = versLigne(
        await k
          .updateTable('courriel_jobs')
          .set({
            status: p.ok ? 'reussie' : 'echec',
            finished_at: sql<Date>`now()`,
            result: resultat,
            to_address: sql<string>`CASE WHEN kind = 'notification' THEN '' ELSE to_address END`,
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
      // Le message de test est tracé au journal ; les notifications le sont dans leur demande (état, trace), sans adresse.
      if (ligne.kind === 'test')
        await this.db.audit(
          { username: 'exécutant serveur' },
          null,
          'courriel.test',
          id,
          { ok: p.ok, to: ligne.to_address },
          cl,
        );
      return ligne;
    });
    if (!r) throw new HttpError(409, 'Demande absente ou déjà terminée.');
  }
}
