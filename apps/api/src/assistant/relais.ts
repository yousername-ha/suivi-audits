/* Relais de modèle (ADR 0086, point 2) : petit serveur HTTP sans base ni fichiers, seul conteneur de l'assistant à avoir un
   accès sortant. Il ne sait faire qu'une chose : transmettre une demande « chat completions » à l'adresse réglée par
   l'administrateur, en HTTPS, certificat vérifié, vers une adresse publique, avec des tailles et des durées bornées. Il ne
   journalise ni la clé ni le contenu. Bibliothèque standard de Node uniquement. */
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export interface OptionsRelais {
  /** Autorise une adresse http:// (tests et développement seulement). */
  httpAutorise?: boolean;
  /** Autorise une adresse privée ou locale (modèle hébergé sur le réseau de l'organisation, tests). */
  priveAutorise?: boolean;
  delaiMs?: number;
  /** Journal minimal : jamais de clé ni de contenu. */
  journal?: (ligne: Record<string, unknown>) => void;
}

const MAX_DEMANDE = 2 * 1024 * 1024;
const MAX_REPONSE = 2 * 1024 * 1024;

const prives = new net.BlockList();
for (const [a, n] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const)
  prives.addSubnet(a, n, 'ipv4');
for (const [a, n] of [
  ['::', 127],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  prives.addSubnet(a, n, 'ipv6');

/** Adresse locale, privée, de lien local ou de diffusion : refusée sauf réglage explicite du serveur. */
export function adressePrivee(ip: string): boolean {
  const mappee = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mappee) return prives.check(mappee[1]!, 'ipv4');
  return prives.check(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4');
}

class Refus extends Error {}

function lireCorps(req: http.IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = [];
    let taille = 0;
    req.on('data', (c: Buffer) => {
      taille += c.length;
      if (taille > max) {
        reject(new Refus('Demande trop volumineuse.'));
        req.destroy();
      } else morceaux.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}

function transmettre(
  cible: URL,
  cle: string,
  corps: string,
  o: OptionsRelais,
): Promise<{ statut: number; corps: unknown }> {
  return new Promise((resolve, reject) => {
    // Résolution contrôlée : l'adresse réellement jointe est celle qui a été vérifiée (pas de seconde résolution).
    const lookup: net.LookupFunction = (hote, options, cb) => {
      dns.lookup(hote, { ...(options as dns.LookupAllOptions), all: true }, (err, adresses) => {
        if (err) return cb(err, '', 0);
        if (!o.priveAutorise && adresses.some((a) => adressePrivee(a.address)))
          return cb(new Refus('Adresse du modèle refusée : elle désigne un réseau privé ou local.'), '', 0);
        if ((options as dns.LookupAllOptions).all)
          return (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, adresses);
        cb(null, adresses[0]!.address, adresses[0]!.family);
      });
    };
    const lib = cible.protocol === 'https:' ? https : http;
    const req = lib.request(
      cible,
      {
        method: 'POST',
        lookup,
        timeout: o.delaiMs ?? 120_000,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: 'Bearer ' + cle,
          'content-length': Buffer.byteLength(corps),
        },
      },
      (res) => {
        const morceaux: Buffer[] = [];
        let taille = 0;
        res.on('data', (c: Buffer) => {
          taille += c.length;
          if (taille > MAX_REPONSE) {
            reject(new Refus('Réponse du fournisseur trop volumineuse.'));
            req.destroy();
          } else morceaux.push(c);
        });
        res.on('end', () => {
          let json: unknown = null;
          try {
            json = JSON.parse(Buffer.concat(morceaux).toString('utf8'));
          } catch {
            /* Réponse non JSON : seul le code est rendu. */
          }
          resolve({ statut: res.statusCode ?? 0, corps: json });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Refus('Le fournisseur du modèle ne répond pas dans le délai.')));
    req.on('error', reject);
    req.end(corps);
  });
}

/** Cible de la demande, ou refus motivé. Une adresse IP littérale est contrôlée ici (aucune résolution n'a lieu). */
export function cibleAutorisee(adresse: unknown, o: OptionsRelais): URL {
  let u: URL;
  try {
    u = new URL(String(adresse));
  } catch {
    throw new Refus('Adresse du modèle invalide.');
  }
  if (u.protocol !== 'https:' && !(o.httpAutorise && u.protocol === 'http:'))
    throw new Refus('Adresse du modèle refusée : HTTPS exigé.');
  if (u.username || u.password || u.search || u.hash) throw new Refus('Adresse du modèle invalide.');
  const hote = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hote) && !o.priveAutorise && adressePrivee(hote))
    throw new Refus('Adresse du modèle refusée : elle désigne un réseau privé ou local.');
  u.pathname = u.pathname.replace(/\/+$/, '') + '/chat/completions';
  return u;
}

export function creerRelais(o: OptionsRelais = {}): http.Server {
  const repondre = (res: http.ServerResponse, code: number, corps: unknown) => {
    const texte = JSON.stringify(corps);
    res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texte) });
    res.end(texte);
  };
  return http.createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/sante') return repondre(res, 200, { ok: true });
      if (req.method !== 'POST' || req.url !== '/v1/completer') return repondre(res, 404, { erreur: 'Introuvable.' });
      const debut = Date.now();
      let hote = '';
      try {
        const demande = JSON.parse((await lireCorps(req, MAX_DEMANDE)).toString('utf8')) as {
          adresse?: unknown;
          cle?: unknown;
          corps?: unknown;
        };
        if (typeof demande.cle !== 'string' || !demande.cle || typeof demande.corps !== 'object' || !demande.corps)
          throw new Refus('Demande invalide.');
        const cible = cibleAutorisee(demande.adresse, o);
        hote = cible.host;
        const r = await transmettre(cible, demande.cle, JSON.stringify(demande.corps), o);
        o.journal?.({ hote, statut: r.statut, ms: Date.now() - debut });
        repondre(res, 200, r);
      } catch (e) {
        const refus = e instanceof Refus;
        o.journal?.({
          hote,
          erreur: refus ? (e as Error).message : ((e as { code?: string }).code ?? 'echec'),
          ms: Date.now() - debut,
        });
        repondre(res, 200, {
          statut: 0,
          corps: null,
          erreur: refus ? (e as Error).message : 'Le fournisseur du modèle est injoignable depuis le relais.',
        });
      }
    })();
  });
}
