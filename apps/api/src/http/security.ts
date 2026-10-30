/* En-têtes de sécurité, contrôle d'origine (défense CSRF complémentaire) et limitation de débit. */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';

/** CSP stricte : aucun script ni style en ligne, aucune origine externe. */
export const CSP_STRICT = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
/** Fichiers téléchargés : jamais interprétés dans l'origine de l'application. */
export const CSP_FILE = "default-src 'none'; sandbox";

export const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), publickey-credentials-create=(self), publickey-credentials-get=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function setBaseHeaders(reply: FastifyReply, csp = CSP_STRICT) {
  for (const [k, v] of Object.entries(BASE_HEADERS)) reply.header(k, v);
  reply.header('Content-Security-Policy', csp);
}

export function isHttps(req: FastifyRequest): boolean {
  return req.protocol === 'https';
}

/** Contrôle d'origine pour toute requête modifiante. */
export function sameOrigin(req: FastifyRequest, cfg: Config): boolean {
  const o = (req.headers.origin as string | undefined) || (req.headers.referer as string | undefined);
  if (!o) {
    const sfs = req.headers['sec-fetch-site'];
    return sfs ? sfs === 'same-origin' : true;
  }
  let u: URL;
  try {
    u = new URL(o);
  } catch {
    return false;
  }
  if (cfg.publicUrl) {
    try {
      if (new URL(cfg.publicUrl).host === u.host) return true;
    } catch {
      /* PUBLIC_URL invalide : on se rabat sur l'hôte de la requête */
    }
  }
  const host = (cfg.trustProxy && (req.headers['x-forwarded-host'] as string | undefined)) || req.headers.host;
  return (
    u.host ===
    String(host || '')
      .split(',')[0]!
      .trim()
  );
}

/** Limiteur à fenêtre fixe, en mémoire (une instance d'API par déploiement). */
export function limiter(max: number, windowMs: number) {
  const m = new Map<string, { n: number; reset: number }>();
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of m) if (v.reset < now) m.delete(k);
  }, windowMs);
  t.unref();
  const hit = (key: string): boolean => {
    const now = Date.now();
    let v = m.get(key);
    if (!v || v.reset < now) {
      v = { n: 0, reset: now + windowMs };
      m.set(key, v);
    }
    v.n++;
    return v.n <= max;
  };
  hit.reset = () => m.clear();
  return hit;
}
export type Limiter = ReturnType<typeof limiter>;
