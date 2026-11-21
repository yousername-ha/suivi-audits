// Client HTTP du banc : cookie de session, jeton CSRF, origine identique. Pile de test au certificat interne : le
// certificat est vérifié avec l'autorité locale de la pile (BANC_CA_PILE, copie de
// gateway:/data/caddy/pki/authorities/local/root.crt, comme scripts/ci/update-integree.py), jamais désactivé.
import https from 'node:https';
import fs from 'node:fs';
export const BASE = process.env.BANC_URL || 'https://127.0.0.77';
const CA = process.env.BANC_CA_PILE;
if (!CA) throw new Error('BANC_CA_PILE : autorité locale de la pile de test (root.crt) à fournir.');
const agent = new https.Agent({ ca: fs.readFileSync(CA), keepAlive: true, maxSockets: 64 });
export class Client {
  constructor() { this.cookies = new Map(); this.csrf = null; }
  req(method, path, body, extra = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, BASE);
      const raw = Buffer.isBuffer(body);
      const data = body === undefined ? undefined : raw ? body : Buffer.from(JSON.stringify(body));
      const headers = { Origin: BASE, Accept: 'application/json', ...extra };
      if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      if (data) { if (!raw) headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
      if (this.csrf && method !== 'GET') headers['X-CSRF-Token'] = this.csrf;
      const t0 = performance.now();
      const r = https.request(u, { method, headers, agent }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const ms = performance.now() - t0;
          for (const sc of res.headers['set-cookie'] || []) {
            const [kv] = sc.split(';'); const i = kv.indexOf('=');
            this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
          }
          const buf = Buffer.concat(chunks);
          let json = null;
          if ((res.headers['content-type'] || '').includes('json')) { try { json = JSON.parse(buf.toString()); } catch { json = null; } }
          resolve({ status: res.statusCode, ms, bytes: buf.length, json, text: () => buf.toString(), headers: res.headers });
        });
      });
      r.on('error', reject);
      r.setTimeout(120000, () => r.destroy(new Error('timeout 120s')));
      if (data) r.write(data);
      r.end();
    });
  }
  get(p, h) { return this.req('GET', p, undefined, h); }
  post(p, b, h) { return this.req('POST', p, b ?? {}, h); }
  put(p, b, h) { return this.req('PUT', p, b, h); }
  patch(p, b, h) { return this.req('PATCH', p, b, h); }
  async refreshCsrf() { const r = await this.get('/api/auth/me'); this.csrf = r.json?.csrf ?? null; return r.json; }
  async login(username, password) {
    const r = await this.post('/api/auth/login', { username, password });
    if (r.status >= 300) throw new Error(`login ${username}: ${r.status} ${r.text().slice(0, 200)}`);
    return this.refreshCsrf();
  }
}
const SESS = '/srv/suivi-banc-perf/sessions';
/** Session réutilisée (limite de 20 connexions par adresse et par 15 min) : cookie rangé hors dépôt, 0600. */
export async function session(username, password) {
  fs.mkdirSync(SESS, { recursive: true, mode: 0o700 });
  const f = `${SESS}/${username}.json`;
  const c = new Client();
  let enregistree = null;
  try {
    enregistree = fs.readFileSync(f, 'utf8');
  } catch {
    // pas de session enregistrée : connexion ci-dessous
  }
  if (enregistree) {
    c.cookies = new Map(JSON.parse(enregistree));
    const me = await c.refreshCsrf();
    if (me?.stage === 'ok') return c;
    c.cookies = new Map();
  }
  await c.login(username, password);
  fs.writeFileSync(f, JSON.stringify([...c.cookies]), { mode: 0o600 });
  return c;
}
export const pct = (v, p) => { const t = [...v].sort((a, b) => a - b); return t[Math.min(t.length - 1, Math.ceil((p / 100) * t.length) - 1)]; };
