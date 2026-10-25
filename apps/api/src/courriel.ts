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
import type { Vault } from './security/crypto.js';

const CLE = 'secret:courriel';
const AAD = 'courriel:mot-de-passe';
/** Une demande « en cours » depuis plus longtemps est considérée interrompue (l'exécutant a pu s'arrêter). */
const DELAI_ABANDON_MS = 3 * 60_000;

interface Ligne {
  id: string;
  status: TestCourrielDto['status'];
  requested_by: string;
  to_address: string;
  result: { steps?: TestCourrielDto['steps']; error?: string | null } | null;
  created_at: Date;
  finished_at: Date | null;
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
  })
  .strict();

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
          WHERE status IN ('en_attente','en_cours') AND created_at < now() - interval '3 minutes'`,
      );
      const active = await cl.query("SELECT 1 FROM courriel_jobs WHERE status IN ('en_attente','en_cours')");
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
    const r = await this.db.one<Ligne>('SELECT * FROM courriel_jobs WHERE id = $1', [id]);
    if (!r) throw new HttpError(404, 'Demande introuvable.');
    return dto(r);
  }

  async derniere(): Promise<TestCourrielDto | null> {
    const r = await this.db.one<Ligne>('SELECT * FROM courriel_jobs ORDER BY created_at DESC LIMIT 1');
    return r ? dto(r) : null;
  }

  /** CLI hôte (exécutant) : réclame la plus ancienne demande et renvoie ce qu'il faut pour l'envoyer, mot de passe compris. */
  async reclamer(c: SettingsValues['courriel']): Promise<Record<string, unknown> | null> {
    const r = await this.db.tx(async (cl) => {
      await cl.query('SELECT pg_advisory_xact_lock(727277)');
      await cl.query(
        `UPDATE courriel_jobs SET status='echec',finished_at=now(),
                result=jsonb_build_object('steps','[]'::jsonb,'error','Exécutant interrompu : aucune relance automatique.')
          WHERE status = 'en_cours' AND started_at < now() - ($1::int * interval '1 millisecond')`,
        [DELAI_ABANDON_MS],
      );
      return (
        await cl.query<Ligne>(
          `UPDATE courriel_jobs SET status='en_cours',started_at=now()
            WHERE id = (SELECT id FROM courriel_jobs WHERE status='en_attente' ORDER BY created_at LIMIT 1) RETURNING *`,
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
    return {
      id: r.id,
      host: c.hote,
      port: c.port,
      security: c.securite,
      username: c.utilisateur,
      password: c.utilisateur ? await this.lireMotDePasse() : '',
      from: c.expediteur,
      to: r.to_address,
      ca: c.autoriteCertification.trim(),
      requested_by: r.requested_by,
    };
  }

  /** CLI hôte : enregistre le rapport de l'envoi (jamais de secret). */
  async terminer(id: string, rapport: unknown): Promise<void> {
    z.uuid().parse(id);
    const p = RapportCourriel.parse(rapport);
    const r = await this.db.tx(async (cl) => {
      const ligne = (
        await cl.query<Ligne>(
          `UPDATE courriel_jobs SET status=$2,finished_at=now(),result=$3
            WHERE id=$1 AND status='en_cours' RETURNING *`,
          [id, p.ok ? 'reussie' : 'echec', { steps: p.steps, error: p.error }],
        )
      ).rows[0];
      if (ligne)
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
