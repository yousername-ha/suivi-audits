/* Relais de modèle de l'assistant (ADR 0086, point 2) : transmission bornée vers une seule adresse, HTTPS exigé, réseaux
   privés refusés sauf réglage explicite du serveur, clé jamais journalisée. Faux fournisseur local, aucun appel extérieur. */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lireReponse, RelaisModele } from '../src/assistant/modele.js';
import { adressePrivee, cibleAutorisee, creerRelais } from '../src/assistant/relais.js';
import { HttpError } from '../src/http/errors.js';

const CLE = 'cle-fictive-du-relais-0123456789';
let fournisseur: http.Server, relaisOuvert: http.Server, relaisStrict: http.Server;
let urlFournisseur: string, urlOuvert: string, urlStrict: string;
const recues: { url: string; autorisation: string; corps: unknown }[] = [];
const journal: Record<string, unknown>[] = [];
let reponse: { statut: number; corps: string } = { statut: 200, corps: '{}' };

const ecouter = (s: http.Server) =>
  new Promise<string>((ok) =>
    s.listen(0, '127.0.0.1', () => ok('http://127.0.0.1:' + (s.address() as AddressInfo).port)),
  );
const fermer = (s: http.Server) => new Promise((ok) => s.close(ok));
const completer = async (relais: string, corps: unknown) =>
  (
    await fetch(relais + '/v1/completer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    })
  ).json() as Promise<{ statut: number; corps: unknown; erreur?: string }>;

beforeAll(async () => {
  fournisseur = http.createServer((req, res) => {
    const morceaux: Buffer[] = [];
    req.on('data', (c: Buffer) => morceaux.push(c));
    req.on('end', () => {
      recues.push({
        url: String(req.url),
        autorisation: String(req.headers.authorization),
        corps: JSON.parse(Buffer.concat(morceaux).toString('utf8')),
      });
      res.writeHead(reponse.statut, { 'content-type': 'application/json' });
      res.end(reponse.corps);
    });
  });
  urlFournisseur = await ecouter(fournisseur);
  relaisOuvert = creerRelais({ httpAutorise: true, priveAutorise: true, journal: (l) => journal.push(l) });
  urlOuvert = await ecouter(relaisOuvert);
  relaisStrict = creerRelais({ journal: (l) => journal.push(l) });
  urlStrict = await ecouter(relaisStrict);
});
afterAll(async () => {
  await Promise.all([fermer(fournisseur), fermer(relaisOuvert), fermer(relaisStrict)]);
});

describe('relais de modèle', () => {
  it('transmet la demande à « chat/completions » avec la clé en en-tête, et rend le code et le corps', async () => {
    reponse = {
      statut: 200,
      corps: JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'prêt' } }],
        usage: { prompt_tokens: 7, completion_tokens: 2 },
      }),
    };
    const demande = { model: 'modele-fictif', messages: [{ role: 'user', content: 'Bonjour' }] };
    const r = await completer(urlOuvert, { adresse: urlFournisseur + '/v1/', cle: CLE, corps: demande });
    expect(r.statut).toBe(200);
    expect(recues.at(-1)).toEqual({ url: '/v1/chat/completions', autorisation: 'Bearer ' + CLE, corps: demande });
    expect(lireReponse(r.corps)).toEqual({
      message: { role: 'assistant', content: 'prêt' },
      jetonsEntree: 7,
      jetonsSortie: 2,
    });
    // Le journal du relais ne contient ni la clé ni le contenu.
    expect(JSON.stringify(journal)).not.toContain(CLE);
    expect(JSON.stringify(journal)).not.toContain('Bonjour');
    expect(journal.at(-1)).toMatchObject({ statut: 200 });
  });

  it('par défaut : refuse une adresse sans HTTPS et une adresse privée ou locale, sans rien émettre', async () => {
    const avant = recues.length;
    const corps = { model: 'm', messages: [] };
    expect((await completer(urlStrict, { adresse: urlFournisseur + '/v1', cle: CLE, corps })).erreur).toContain(
      'HTTPS',
    );
    for (const adresse of [
      'https://127.0.0.1/v1',
      'https://10.1.2.3/v1',
      'https://[::1]/v1',
      'https://169.254.169.254/v1',
    ])
      expect((await completer(urlStrict, { adresse, cle: CLE, corps })).erreur).toContain('réseau privé');
    // Nom qui se résout vers une adresse locale : refusé à la résolution, pas seulement sur une adresse littérale.
    expect((await completer(urlStrict, { adresse: 'https://localhost/v1', cle: CLE, corps })).erreur).toContain(
      'réseau privé',
    );
    expect(recues.length).toBe(avant);
  });

  it('refuse une demande incomplète, une adresse avec identifiants ou paramètres, et toute autre route', async () => {
    const corps = { model: 'm', messages: [] };
    expect((await completer(urlOuvert, { adresse: urlFournisseur, corps })).erreur).toBe('Demande invalide.');
    expect((await completer(urlOuvert, { adresse: urlFournisseur, cle: CLE })).erreur).toBe('Demande invalide.');
    for (const adresse of ['http://u:p@127.0.0.1/v1', urlFournisseur + '/v1?x=1', 'pas une adresse'])
      expect((await completer(urlOuvert, { adresse, cle: CLE, corps })).erreur).toContain('invalide');
    expect((await fetch(urlOuvert + '/autre', { method: 'POST', body: '{}' })).status).toBe(404);
    expect((await fetch(urlOuvert + '/v1/completer')).status).toBe(404);
    expect(await (await fetch(urlOuvert + '/sante')).json()).toEqual({ ok: true });
  });

  it('adresses privées reconnues, cible construite sans double barre', () => {
    for (const ip of [
      '10.0.0.1',
      '172.16.5.4',
      '192.168.1.1',
      '127.0.0.1',
      '100.64.0.1',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ])
      expect(adressePrivee(ip), ip).toBe(true);
    for (const ip of ['1.1.1.1', '51.15.0.1', '2001:4860:4860::8888']) expect(adressePrivee(ip), ip).toBe(false);
    expect(cibleAutorisee('https://api.example.invalid/v1/', {}).href).toBe(
      'https://api.example.invalid/v1/chat/completions',
    );
  });

  it('côté API : un refus du fournisseur devient un message court, sans détail', async () => {
    const transport = new RelaisModele(urlOuvert);
    expect(transport.declare()).toBe(true);
    expect(new RelaisModele('').declare()).toBe(false);
    const demande = { model: 'm', messages: [{ role: 'user' as const, content: 'x' }] };
    const cas: [number, string][] = [
      [401, 'refuse la clé'],
      [404, 'ne connaît pas'],
      [429, 'limite les appels'],
      [503, 'indisponible'],
    ];
    for (const [statut, extrait] of cas) {
      reponse = { statut, corps: JSON.stringify({ message: 'détail interne du fournisseur' }) };
      const e = await transport.completer(urlFournisseur + '/v1', CLE, demande).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).message).toContain(extrait);
      expect((e as HttpError).message).not.toContain('détail interne');
    }
    reponse = { statut: 200, corps: JSON.stringify({ inattendu: true }) };
    await expect(transport.completer(urlFournisseur + '/v1', CLE, demande)).rejects.toThrow('illisible');
    await expect(new RelaisModele('http://127.0.0.1:9').completer(urlFournisseur, CLE, demande)).rejects.toThrow(
      'ne répond pas',
    );
    await expect(new RelaisModele('').completer(urlFournisseur, CLE, demande)).rejects.toThrow('pas installé');
  });
});
