/* L'API ne lance aucune commande : demandes auditées, exécutées uniquement par la CLI locale. */
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  dansFenetre,
  effectivePermissions,
  FENETRE_MAINTENANCE_DEFAUT,
  FenetreMaintenance,
  libelleFenetre,
  SBOM_COMPOSANTS,
  UpdateReceipt,
  UpdateReceiptSummary,
  UpdateState,
  type UpdateRequest,
} from '@suivi/shared';
import type { SessionUser } from './auth.js';
import type { Config } from './config.js';
import { sql } from 'kysely';
import type { AlertesExploitation } from './alertes-exploitation.js';
import type { Client, Db } from './db/db.js';
import { HttpError } from './http/errors.js';
import { exploitationOccupee } from './operations.js';
import { loadGrants } from './rights.js';
import type { Settings } from './settings.js';
import { compareVersions } from './systeme.js';

export class Updates {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
    private readonly settings: Settings,
    private readonly alertes: AlertesExploitation,
  ) {}
  /** Fenêtre de maintenance lue en base (et non dans le cache) : la CLI de l'exécutant n'a pas de cache chargé. */
  async fenetre(c?: Client): Promise<FenetreMaintenance> {
    const values = (await this.settings.read('securite', c)).values as { fenetreMaintenance?: unknown };
    const f = FenetreMaintenance.safeParse(values.fenetreMaintenance);
    return f.success ? f.data : FENETRE_MAINTENANCE_DEFAUT;
  }
  /** Refuse une installation hors du créneau autorisé (contrôle de la demande, puis de la prise en charge). */
  async assertWindow(c?: Client, now = new Date()) {
    const f = await this.fenetre(c);
    if (!dansFenetre(f, now))
      throw new HttpError(
        409,
        `Installation refusée hors de la fenêtre de maintenance : ${libelleFenetre(f)}. Réessayez pendant ce créneau.`,
        { reason: 'outside_window' },
      );
  }
  private fenetreInfo() {
    const parsed = FenetreMaintenance.safeParse(this.settings.get('securite').fenetreMaintenance);
    const f = parsed.success ? parsed.data : FENETRE_MAINTENANCE_DEFAUT;
    return { active: f.active, ouverte: dansFenetre(f), libelle: libelleFenetre(f) };
  }
  state(): UpdateState {
    try {
      const state = UpdateState.parse(
        JSON.parse(readFileSync(path.join(this.cfg.etatDir, 'updates/status.json'), 'utf8')),
      );
      // Un rapport ancien ne peut autoriser une opération privilégiée.
      if (Date.now() - new Date(state.updatedAt).getTime() > 90_000) state.ready = false;
      return { ...state, installed: this.cfg.version, fenetre: this.fenetreInfo() };
    } catch {
      return {
        installed: this.cfg.version,
        available: null,
        checkedAt: null,
        notes: null,
        checking: false,
        checkError: false,
        ready: false,
        maintenance: false,
        id: null,
        target: null,
        status: 'idle',
        phase: 'idle',
        message: 'Le service de mise à jour est indisponible.',
        startedAt: null,
        updatedAt: new Date().toISOString(),
        etapes: [],
        finishedAt: null,
        fenetre: this.fenetreInfo(),
      };
    }
  }
  async assertAdmin(user: SessionUser, c?: Client) {
    const grants = await loadGrants(c ?? this.db.pool, user.id);
    if (!grants.some((g) => g.roleId === 'administrateur') || !user.rights.can('administration', 'administrer'))
      throw new HttpError(403, 'Seul le rôle Administrateur peut commander une mise à jour.');
  }
  async request(user: SessionUser, ip: string, input?: UpdateRequest) {
    return this.db.tx(async (c, k) => {
      // Verrou consultatif de la file de mise à jour : appel SQL direct (ADR 0062 §5).
      await c.query('SELECT pg_advisory_xact_lock(727277)');
      await this.assertAdmin(user, c);
      const requestId = input?.requestId ?? randomUUID();
      const previous = await k
        .selectFrom('update_jobs')
        .select(['id', 'kind', 'target', 'status', 'user_id'])
        .where('request_id', '=', requestId)
        .executeTakeFirst();
      if (previous) {
        if (previous.user_id !== user.id || previous.target !== (input?.version ?? null))
          throw new HttpError(409, 'Cet identifiant désigne une autre demande.');
        return { id: previous.id, status: previous.status as string };
      }
      const state = this.state();
      if (!state.ready) throw new HttpError(503, 'Le service de mise à jour est indisponible.');
      if (state.maintenance || state.status === 'intervention')
        throw new HttpError(409, 'Une opération requiert déjà le service de mise à jour.');
      if (
        await k
          .selectFrom('update_jobs')
          .select('id')
          .where('status', 'in', ['queued', 'running', 'intervention'])
          .executeTakeFirst()
      )
        throw new HttpError(409, 'Une opération de mise à jour est déjà en cours.');
      if (
        input &&
        (state.available !== input.version ||
          compareVersions(this.cfg.version, input.version) >= 0 ||
          !state.checkedAt ||
          Date.now() - new Date(state.checkedAt).getTime() > 24 * 3600e3)
      )
        throw new HttpError(
          409,
          'La version disponible a changé ou sa vérification est trop ancienne. Vérifiez à nouveau.',
        );
      if (input) await this.assertWindow(c);
      if (
        input &&
        (await exploitationOccupee(k, ['en_attente', 'en_cours', 'intervention'], ['en_attente', 'en_cours']))
      )
        throw new HttpError(409, 'Une sauvegarde, restauration ou opération serveur est déjà active.');
      const kind = input ? 'install' : 'check';
      const row = await k
        .insertInto('update_jobs')
        .values({
          request_id: requestId,
          kind,
          target: input?.version ?? null,
          requested_by: user.username,
          user_id: user.id,
        })
        .returning(['id', 'status'])
        .executeTakeFirstOrThrow();
      await this.db.audit(user, ip, `update.${kind}.requested`, row.id, { target: input?.version ?? null }, c);
      return { id: row.id, status: row.status as string };
    }, user.username);
  }
  /** Pas de route HTTP pour ces opérations ; l'exécutant doit détenir le verrou hôte. */
  async claim() {
    return this.db.tx(async (c, k) => {
      await c.query('SELECT pg_advisory_xact_lock(727277)');
      const job = await k
        .selectFrom('update_jobs')
        .select(['id', 'kind', 'target', 'user_id', 'created_at'])
        .where('status', '=', 'queued')
        .orderBy('created_at')
        .limit(1)
        .forUpdate()
        .executeTakeFirst();
      if (!job) return null;
      const u = job.user_id
        ? await k
            .selectFrom('users')
            .select(['id', 'disabled', 'expires_at'])
            .where('id', '=', job.user_id)
            .executeTakeFirst()
        : undefined;
      const echouer = () =>
        k
          .updateTable('update_jobs')
          .set({ status: 'failed', finished_at: sql<Date>`now()` })
          .where('id', '=', job.id)
          .execute();
      const grants = u ? await loadGrants(c, u.id) : [];
      if (
        !u ||
        u.disabled ||
        (u.expires_at && new Date(u.expires_at) <= new Date()) ||
        !grants.some((g) => g.roleId === 'administrateur') ||
        !effectivePermissions(grants).has('administration:administrer') ||
        Date.now() - new Date(job.created_at).getTime() > 15 * 60e3
      ) {
        await echouer();
        return null;
      }
      // Créneau refermé entre la demande et sa prise en charge : refus tracé, rien n'est installé.
      if (job.kind === 'install' && !dansFenetre(await this.fenetre(c))) {
        await echouer();
        await this.db.audit(
          { username: 'exploitation serveur' },
          null,
          'update.install.outside_window',
          job.id,
          { target: job.target },
          c,
        );
        return null;
      }
      await k
        .updateTable('update_jobs')
        .set({ status: 'running', started_at: sql<Date>`now()` })
        .where('id', '=', job.id)
        .execute();
      return { id: job.id, kind: job.kind, target: job.target };
    });
  }
  /** Une restauration ne doit jamais remettre en file des intentions anciennes. */
  async synchronize() {
    let epoch: string;
    try {
      const report = JSON.parse(
        readFileSync(path.join(this.cfg.etatDir, 'sauvegardes/derniere-restauration.json'), 'utf8'),
      );
      epoch = z.string().datetime().parse(report.date);
    } catch {
      return;
    }
    const state = this.state();
    const keep = state.maintenance ? state.id : null;
    await this.db.tx(async (c, k) => {
      await c.query('SELECT pg_advisory_xact_lock(727277)');
      // Demandes antérieures à la restauration : neutralisées, sauf celle que la maintenance en cours exécute.
      const old = await k
        .updateTable('update_jobs')
        .set({ status: 'failed', finished_at: sql<Date>`now()` })
        .where('created_at', '<=', sql<Date>`${epoch}`)
        .$if(!!keep, (q) => q.where('id', '<>', keep!))
        .where('status', 'in', ['queued', 'running', 'intervention'])
        .returning('id')
        .execute();
      for (const row of old)
        await this.db.audit(
          { username: 'exploitation serveur' },
          null,
          'update.neutralized',
          row.id,
          { reason: 'restoration' },
          c,
        );
    });
  }
  private get receiptsDir() {
    return path.join(this.cfg.etatDir, 'recus-mises-a-jour');
  }
  /** Reçus écrits par l'exécutant, du plus récent au plus ancien ; un fichier illisible ou non conforme est ignoré. */
  receipts(max = 20): UpdateReceiptSummary[] {
    let files: string[];
    try {
      files = readdirSync(this.receiptsDir).filter((f) => /^[a-f0-9-]{36}\.json$/.test(f));
    } catch {
      return [];
    }
    return files
      .map((f) => this.readReceipt(f.slice(0, 36)))
      .filter((r): r is UpdateReceipt => r !== null)
      .sort((a, b) => b.fin.localeCompare(a.fin))
      .slice(0, max)
      .map((r) => UpdateReceiptSummary.parse({ ...r, sbom: SBOM_COMPOSANTS.filter((c) => r.sbom[c]) }));
  }
  receipt(id: string): UpdateReceipt {
    const r = this.readReceipt(id);
    if (!r) throw new HttpError(404, 'Reçu de mise à jour introuvable.');
    return r;
  }
  /** SBOM vérifié d'une installation : le fichier conservé doit avoir l'empreinte inscrite dans le reçu. */
  sbom(id: string, composant: (typeof SBOM_COMPOSANTS)[number]): { vers: string; contenu: Buffer } {
    const r = this.receipt(id);
    const ref = r.sbom[composant];
    if (!ref) throw new HttpError(404, 'Aucun SBOM vérifié pour ce composant.');
    let contenu: Buffer;
    try {
      contenu = readFileSync(path.join(this.cfg.etatDir, 'sbom', r.vers, ref.fichier));
    } catch {
      throw new HttpError(404, 'SBOM introuvable sur le serveur.');
    }
    if (createHash('sha256').update(contenu).digest('hex') !== ref.sha256)
      throw new HttpError(409, 'Le SBOM conservé ne correspond pas à l’empreinte du reçu.');
    return { vers: r.vers, contenu };
  }
  private readReceipt(id: string): UpdateReceipt | null {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) return null;
    try {
      const r = UpdateReceipt.safeParse(JSON.parse(readFileSync(path.join(this.receiptsDir, `${id}.json`), 'utf8')));
      return r.success && r.data.id === id ? r.data : null;
    } catch {
      return null;
    }
  }
  async finish(id: string, status: string) {
    if (!/^[a-f0-9-]{36}$/.test(id) || !['success', 'rolled_back', 'failed', 'intervention'].includes(status))
      throw new Error('Résultat de mise à jour invalide.');
    await this.db.tx(async (c, k) => {
      const job = await k
        .updateTable('update_jobs')
        .set({
          status: status as 'success' | 'rolled_back' | 'failed' | 'intervention',
          finished_at: sql<Date>`now()`,
        })
        .where('id', '=', id)
        .where('status', 'in', ['queued', 'running', 'intervention'])
        .returning(['requested_by', 'target'])
        .executeTakeFirst();
      if (job && status !== 'success') await this.alertes.signaler(k, 'mise_a_jour', id.slice(0, 8));
      if (job)
        await this.db.audit(
          { username: job.requested_by },
          null,
          'update.finished',
          id,
          { status, target: job.target },
          c,
        );
    });
  }
}
