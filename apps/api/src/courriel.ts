/* Courriel (décision 1 du 25/10/2026, ADR 0049) : configuration SMTP/SMTPS, mot de passe scellé, contact technique et message
   de test réel. L'API n'a pas d'accès réseau sortant : elle ne fait que mettre la demande en file ; l'exécutant d'exploitation
   du serveur (scripts/exploitation-worker.py) la réclame par la CLI, envoie le message sous un compte sans privilège et rapporte
   le résultat étape par étape. Le message de test ne part que vers le contact technique (« destination autorisée »). Le mot de
   passe est scellé par le coffre (AES-GCM) ; il ne quitte l'API que pour l'exécutant, jamais vers le navigateur ni un journal. */
import { randomUUID } from 'node:crypto';
import type { SettingsValues, TestCourrielDto } from '@suivi/shared';
import { z } from 'zod';
import type { Actor, Db } from './db/db.js';
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
/** Délai de la relance après le n-ième essai : délai de base, doublé à chaque échec, plafonné à 24 h (SQL, en minutes). */
const DELAI_RELANCE_SQL = `LEAST(1440, $1::int * power(2, GREATEST(attempts - 1, 0)))`;

export class Courriel {
  constructor(
    private readonly db: Db,
    private readonly vault: Vault,
  ) {}

  async motDePasseDefini(): Promise<boolean> {
    return !!(await this.db.one('SELECT 1 FROM settings WHERE key = $1', [CLE]));
  }

  async definirMotDePasse(password: string, user: Actor, ip: string): Promise<void> {
    const scelle = this.vault.sealSmall(Buffer.from(password, 'utf8'), AAD).toString('base64');
    await this.db.tx(async (c) => {
      await c.query(
        `INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [CLE, { sealed: scelle }],
      );
      await this.db.audit(user, ip, 'courriel.mot_de_passe_defini', '', {}, c);
    }, user.username);
  }

  async retirerMotDePasse(user: Actor, ip: string): Promise<void> {
    await this.db.tx(async (c) => {
      await c.query('DELETE FROM settings WHERE key = $1', [CLE]);
      await this.db.audit(user, ip, 'courriel.mot_de_passe_retire', '', {}, c);
    }, user.username);
  }

  private async lireMotDePasse(): Promise<string> {
    const r = await this.db.one<{ value: { sealed: string } }>('SELECT value FROM settings WHERE key = $1', [CLE]);
    if (!r) return '';
    return this.vault.openSmall(Buffer.from(r.value.sealed, 'base64'), AAD).toString('utf8');
  }

  private async executantDisponible(): Promise<boolean> {
    return !!(await this.db.one(
      "SELECT 1 FROM backup_worker WHERE id=1 AND ready AND seen_at > now() - interval '120 seconds'",
    ));
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
    return this.db.tx(async (cl) => {
      await cl.query('SELECT pg_advisory_xact_lock(727277)');
      await cl.query(
        `UPDATE courriel_jobs SET status='echec',finished_at=now(),
                result=jsonb_build_object('steps','[]'::jsonb,'error','Demande abandonnée : l’exécutant n’a pas répondu.')
          WHERE kind='test' AND status IN ('en_attente','en_cours') AND created_at < now() - interval '3 minutes'`,
      );
      const active = await cl.query(
        "SELECT 1 FROM courriel_jobs WHERE kind='test' AND status IN ('en_attente','en_cours')",
      );
      if (active.rowCount) throw new HttpError(409, 'Un message de test est déjà en cours.');
      const r = (
        await cl.query<Ligne>(
          `INSERT INTO courriel_jobs (id,kind,requested_by,to_address) VALUES ($1,'test',$2,$3) RETURNING *`,
          [randomUUID(), user.username, c.contactTechnique],
        )
      ).rows[0]!;
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
    const r = await this.db.one<Ligne>("SELECT * FROM courriel_jobs WHERE id = $1 AND kind='test'", [id]);
    if (!r) throw new HttpError(404, 'Demande introuvable.');
    return dto(r);
  }

  async derniere(): Promise<TestCourrielDto | null> {
    const r = await this.db.one<Ligne>(
      "SELECT * FROM courriel_jobs WHERE kind='test' ORDER BY created_at DESC LIMIT 1",
    );
    return r ? dto(r) : null;
  }

  /** CLI hôte (exécutant) : réclame la demande la plus ancienne (le message de test passe avant les notifications) et renvoie
      ce qu'il faut pour l'envoyer, mot de passe compris. Une demande de notification dont le destinataire est devenu
      inutilisable (désactivé, expiré, sans adresse) est close sans envoi et la suivante est réclamée. */
  async reclamer(c: SettingsValues['courriel']): Promise<Record<string, unknown> | null> {
    for (let essai = 0; essai < 50; essai++) {
      const r = await this.db.tx(async (cl) => {
        await cl.query('SELECT pg_advisory_xact_lock(727277)');
        // Une notification interrompue (exécutant arrêté en cours d'envoi) est remise en file tant qu'il reste des essais ; le
        // message de test, lancé à la main, est simplement clos.
        await cl.query(
          `UPDATE courriel_jobs SET status='en_attente',started_at=NULL,
                  next_attempt_at = now() + (${DELAI_RELANCE_SQL} * interval '1 minute'),
                  result=jsonb_build_object('steps','[]'::jsonb,'error','Exécutant interrompu : nouvel essai programmé.')
            WHERE kind='notification' AND status = 'en_cours' AND attempts < $2::int
              AND started_at < now() - ($3::int * interval '1 millisecond')`,
          [c.relanceDelaiMinutes, c.relanceEssais, DELAI_ABANDON_MS],
        );
        await cl.query(
          `UPDATE courriel_jobs SET status='echec',finished_at=now(),
                  result=jsonb_build_object('steps','[]'::jsonb,'error','Exécutant interrompu : aucun essai restant.')
            WHERE status = 'en_cours' AND started_at < now() - ($1::int * interval '1 millisecond')`,
          [DELAI_ABANDON_MS],
        );
        await cl.query(
          `UPDATE courriel_jobs SET status='echec',finished_at=now(),to_address='',
                  result=jsonb_build_object('steps','[]'::jsonb,'error','Demande expirée : l’exécutant n’a pas pu l’envoyer à temps.')
            WHERE kind='notification' AND status='en_attente' AND created_at < now() - ($1::int * interval '1 day')`,
          [EXPIRATION_NOTIFICATION_JOURS],
        );
        return (
          await cl.query<Ligne>(
            `UPDATE courriel_jobs SET status='en_cours',started_at=now(),attempts=attempts+1
              WHERE id = (SELECT id FROM courriel_jobs WHERE status='en_attente' AND next_attempt_at <= now()
                           ORDER BY (kind='test') DESC, created_at LIMIT 1) RETURNING *`,
          )
        ).rows[0];
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
        const u = await this.db.one<{ email: string }>(
          'SELECT email FROM users WHERE id=$1 AND NOT disabled AND (expires_at IS NULL OR expires_at > now())',
          [r.user_id],
        );
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
    const r = await this.db.tx(async (cl) => {
      const courante = (
        await cl.query<Ligne>("SELECT * FROM courriel_jobs WHERE id=$1 AND status='en_cours' FOR UPDATE", [id])
      ).rows[0];
      if (!courante) return undefined;
      const resultat = { steps: p.steps, error: p.error };
      if (
        !p.ok &&
        !p.permanent &&
        relance &&
        courante.kind === 'notification' &&
        courante.attempts < relance.relanceEssais
      ) {
        await cl.query(
          `UPDATE courriel_jobs SET status='en_attente',started_at=NULL,result=$2,
                  next_attempt_at = now() + (${DELAI_RELANCE_SQL} * interval '1 minute')
            WHERE id=$3`,
          [relance.relanceDelaiMinutes, resultat, id],
        );
        return courante;
      }
      const ligne = (
        await cl.query<Ligne>(
          `UPDATE courriel_jobs SET status=$2,finished_at=now(),result=$3,
                  to_address = CASE WHEN kind='notification' THEN '' ELSE to_address END
            WHERE id=$1 RETURNING *`,
          [id, p.ok ? 'reussie' : 'echec', resultat],
        )
      ).rows[0]!;
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
