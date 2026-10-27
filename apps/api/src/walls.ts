/* Écrans muraux : affichage permanent en lecture seule (vue /mur), sans compte nominatif.
   Création par un administrateur (code d'activation à usage unique, 24 h) ; l'appareil échange ce code contre un
   jeton de longue durée (cookie __Host-, SameSite=Strict, HttpOnly), limité aux routes de la vue /mur et révocable.
   Seules les empreintes SHA-256 du code et du jeton sont stockées. */
import { Rights, type BusinessModule } from '@suivi/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import { sql } from 'kysely';
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
    const { id } = await this.db.tx(
      (_c, k) =>
        k
          .insertInto('wall_screens')
          .values({
            name,
            modules,
            activation_hash: sha256(code),
            activation_expires: sql<Date>`now() + make_interval(secs => ${ACTIVATION_MS / 1000})`,
            expires_at: sql<Date>`now() + make_interval(days => ${days})`,
            created_by: by,
          })
          .returning('id')
          .executeTakeFirstOrThrow(),
      by,
    );
    return { id, code };
  }

  /** Activation par l'appareil : code valide, non utilisé, non expiré, écran non révoqué. Pose le cookie. */
  async activate(req: FastifyRequest, reply: FastifyReply, code: string): Promise<string | null> {
    const device = token(32);
    const w = await this.db.tx(
      (_c, k) =>
        k
          .updateTable('wall_screens')
          .set((eb) => ({
            activation_hash: null,
            activation_expires: null,
            device_hash: sha256(device),
            activated_at: sql<Date>`now()`,
            last_ip: req.ip || null,
            version: eb('version', '+', 1),
          }))
          .where('activation_hash', '=', sha256(code))
          .where('activation_expires', '>', sql<Date>`now()`)
          .where('revoked_at', 'is', null)
          .where('expires_at', '>', sql<Date>`now()`)
          .returning(['id', 'name', 'expires_at'])
          .executeTakeFirst(),
      'écran mural',
    );
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
    const r = await this.db.k
      .selectFrom('wall_screens')
      .select(['id', 'name', 'modules', 'last_seen_at'])
      .where('device_hash', '=', sha256(tok))
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .executeTakeFirst();
    if (!r) return null;
    if (!r.last_seen_at || Date.now() - new Date(r.last_seen_at).getTime() > 60e3)
      this.db.k
        .updateTable('wall_screens')
        .set({ last_seen_at: sql<Date>`now()`, last_ip: req.ip || null })
        .where('id', '=', r.id)
        .execute()
        .catch(() => {});
    const modules = r.modules as BusinessModule[];
    return { id: r.id, name: r.name, modules, rights: new Rights(modules.map((m) => `${m}:lire`)) };
  }

  async revoke(id: string, by: string): Promise<string | null> {
    const r = await this.db.tx(
      (_c, k) =>
        k
          .updateTable('wall_screens')
          .set((eb) => ({
            revoked_at: sql<Date>`now()`,
            revoked_by: by,
            device_hash: null,
            activation_hash: null,
            version: eb('version', '+', 1),
          }))
          .where('id', '=', id)
          .where('revoked_at', 'is', null)
          .returning('name')
          .executeTakeFirst(),
      by,
    );
    return r?.name ?? null;
  }

  private setCookie(req: FastifyRequest, reply: FastifyReply, value: string, maxAge: number) {
    const secure = this.cfg.cookieSecure === 'true' || (this.cfg.cookieSecure === 'auto' && isHttps(req));
    reply.header(
      'Set-Cookie',
      `${secure ? WALL_COOKIE_SECURE : WALL_COOKIE_PLAIN}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${maxAge}`,
    );
  }
}
