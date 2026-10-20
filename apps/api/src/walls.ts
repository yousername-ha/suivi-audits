/* Écrans muraux : affichage permanent en lecture seule (vue /mur), sans compte nominatif.
   Création par un administrateur (code d'activation à usage unique, 24 h) ; l'appareil échange ce code contre un
   jeton de longue durée (cookie __Host-, SameSite=Strict, HttpOnly), limité aux routes de la vue /mur et révocable.
   Seules les empreintes SHA-256 du code et du jeton sont stockées. */
import { Rights, type BusinessModule } from '@suivi/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import type { Db } from './db/db.js';
import { isHttps } from './http/security.js';
import { parseCookies } from './auth.js';
import { sha256, token } from './security/crypto.js';

const WALL_COOKIE_SECURE = '__Host-suivi_mur';
const WALL_COOKIE_PLAIN = 'suivi_mur';
const ACTIVATION_MS = 24 * 3600e3;

export interface WallSession {
  id: string;
  name: string;
  modules: BusinessModule[];
  rights: Rights;
}

export class Walls {
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
  ) {}

  /** Création : renvoie le code d'activation, affiché une seule fois. */
  async create(name: string, modules: BusinessModule[], days: number, by: string) {
    const code = token(24);
    const r = await this.db.tx(
      (c) =>
        c.query<{ id: string }>(
          `INSERT INTO wall_screens(name, modules, activation_hash, activation_expires, expires_at, created_by)
           VALUES ($1, $2, $3, now() + make_interval(secs => $4), now() + make_interval(days => $5), $6) RETURNING id`,
          [name, modules, sha256(code), ACTIVATION_MS / 1000, days, by],
        ),
      by,
    );
    return { id: r.rows[0]!.id, code };
  }

  /** Activation par l'appareil : code valide, non utilisé, non expiré, écran non révoqué. Pose le cookie. */
  async activate(req: FastifyRequest, reply: FastifyReply, code: string): Promise<string | null> {
    const device = token(32);
    const r = await this.db.tx(
      (c) =>
        c.query<{ id: string; name: string; expires_at: Date }>(
          `UPDATE wall_screens SET activation_hash = NULL, activation_expires = NULL, device_hash = $2,
                  activated_at = now(), last_ip = $3, version = version + 1
            WHERE activation_hash = $1 AND activation_expires > now() AND revoked_at IS NULL AND expires_at > now()
            RETURNING id, name, expires_at`,
          [sha256(code), sha256(device), req.ip || null],
        ),
      'écran mural',
    );
    const w = r.rows[0];
    if (!w) return null;
    const maxAge = Math.max(60, Math.floor((new Date(w.expires_at).getTime() - Date.now()) / 1000));
    this.setCookie(req, reply, device, maxAge);
    return w.name;
  }

  /** Écran mural de la requête (cookie), ou null. Met à jour la dernière activité (au plus une fois par minute). */
  async load(req: FastifyRequest): Promise<WallSession | null> {
    const c = parseCookies(req.headers.cookie);
    const tok = c.get(WALL_COOKIE_SECURE) || c.get(WALL_COOKIE_PLAIN);
    if (!tok || tok.length > 100) return null;
    const r = await this.db.one<{ id: string; name: string; modules: BusinessModule[]; last_seen_at: Date | null }>(
      `SELECT id, name, modules, last_seen_at FROM wall_screens
        WHERE device_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [sha256(tok)],
    );
    if (!r) return null;
    if (!r.last_seen_at || Date.now() - new Date(r.last_seen_at).getTime() > 60e3)
      this.db
        .q('UPDATE wall_screens SET last_seen_at = now(), last_ip = $2 WHERE id = $1', [r.id, req.ip || null])
        .catch(() => {});
    return { id: r.id, name: r.name, modules: r.modules, rights: new Rights(r.modules.map((m) => `${m}:lire`)) };
  }

  async revoke(id: string, by: string): Promise<string | null> {
    const r = await this.db.tx(
      (c) =>
        c.query<{ name: string }>(
          `UPDATE wall_screens SET revoked_at = now(), revoked_by = $2, device_hash = NULL, activation_hash = NULL,
                  version = version + 1 WHERE id = $1 AND revoked_at IS NULL RETURNING name`,
          [id, by],
        ),
      by,
    );
    return r.rows[0]?.name ?? null;
  }

  private setCookie(req: FastifyRequest, reply: FastifyReply, value: string, maxAge: number) {
    const secure = this.cfg.cookieSecure === 'true' || (this.cfg.cookieSecure === 'auto' && isHttps(req));
    reply.header(
      'Set-Cookie',
      `${secure ? WALL_COOKIE_SECURE : WALL_COOKIE_PLAIN}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${maxAge}`,
    );
  }
}
