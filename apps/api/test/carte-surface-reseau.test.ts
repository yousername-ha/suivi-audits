/* Carte de la surface externe, 7.6.1 (regroupement « Hébergeur », choix du RSSI du 22/11/2026) : la route de la carte rend
   le réseau de chaque hôte d'AlgoLightHouse (fournisseur, numéro de système autonome, pays, CDN), déjà en base, et null pour
   les domaines ; valeurs revalidées à la lecture ; rien de nouveau ne part vers l'assistant. Données entièrement fictives :
   domaines en .example, adresses de documentation, numéros de système autonome réservés à la documentation (64496 à 64511). */
import { ALH_BORNES, type CarteSurfaceDto } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reseauCarte } from '../src/vulnerabilites/surface-externe.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const SYSTEME = { username: 'test' };
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
let t: TestApp;
let admin: Agent;

const hote = (
  n: number,
  adresse: string,
  reseau: { fai: string | null; asn: string | null; pays: string | null; cdn: boolean | null },
) => ({
  type: 'hote',
  id: U(n),
  perimetre: U(1),
  statut: 'monitored',
  adresse,
  ...reseau,
  mutualise: false,
  joignable: true,
  joignableLe: '2026-11-16T07:00:00.000Z',
  importManuel: false,
  creeLe: '2026-06-10T14:00:00.000Z',
  majLe: null,
});
const elements = (): Record<string, unknown>[] => [
  { type: 'perimetre', id: U(1), nom: 'Périmètre ALH fictif 1' },
  hote(11, '192.0.2.10', { fai: 'Hébergeur fictif Alpha', asn: '64496', pays: 'FR', cdn: false }),
  hote(12, '198.51.100.20', { fai: 'Réseau de diffusion fictif', asn: '64498', pays: 'NL', cdn: true }),
  hote(13, '198.51.100.30', { fai: null, asn: null, pays: null, cdn: null }),
  {
    type: 'domaine',
    id: U(20),
    perimetre: U(1),
    statut: 'monitored',
    domaine: 'www.exemple-fictif.example',
    niveau: 2,
    importManuel: false,
    adresse: '192.0.2.10',
    parent: null,
    creeLe: '2026-02-01T10:11:01.000Z',
    majLe: null,
  },
];

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'csr_admin', 'admin'));
  const r = await admin.post('/api/integrations/instances', {
    type: 'algolighthouse',
    nom: 'AlgoLightHouse fictif',
    configuration: { adresse: 'https://espace-fictif.algolighthouse.fr' },
  });
  expect(r.statusCode, r.body).toBe(201);
  const alh = r.json().id as string;
  expect(
    (await admin.put(`/api/integrations/instances/${alh}/secrets`, { cleApi: 'cle-api-fictive-0123456789abcdef' }))
      .statusCode,
  ).toBe(204);
  const a = await admin.put(
    `/api/integrations/instances/${alh}/activation`,
    { actif: true, fluxConfirme: true },
    { 'if-match': `"${r.json().version}"` },
  );
  expect(a.statusCode, a.body).toBe(200);
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [alh],
  );
  const el = elements();
  const job = (await t.svc.integrations.reclamer(true))!;
  await t.svc.integrations.lot(job.id as string, el);
  await t.svc.integrations.terminer(job.id as string, {
    ok: true,
    resultat: {
      elements: el.length,
      perimetres: 1,
      hotes: 3,
      domaines: 1,
      alertes: 0,
      details: 0,
      technologies: 0,
      ecartes: 0,
      tronque: false,
    },
    erreur: null,
  });
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('carte : réseau des hôtes', () => {
  it('chaque hôte porte son réseau, un domaine n’en porte pas', async () => {
    const r = await admin.get('/api/vulnerabilites/surface/carte');
    expect(r.statusCode, r.body).toBe(200);
    const c = r.json() as CarteSurfaceDto;
    const par = (v: string) => c.actifs.find((x) => x.valeur === v)!;
    expect(par('192.0.2.10').reseau).toEqual({ asn: '64496', fai: 'Hébergeur fictif Alpha', pays: 'FR', cdn: false });
    expect(par('198.51.100.20').reseau).toEqual({
      asn: '64498',
      fai: 'Réseau de diffusion fictif',
      pays: 'NL',
      cdn: true,
    });
    expect(par('198.51.100.30').reseau).toEqual({ asn: null, fai: null, pays: null, cdn: null });
    expect(par('www.exemple-fictif.example').reseau).toBeNull();
  });

  it('valeurs revalidées à la lecture : motif du numéro et du pays, fournisseur borné', () => {
    expect(reseauCarte({ asn: 'AS64496', fai: 'x'.repeat(ALH_BORNES.fai + 50), pays: 'France', cdn: null })).toEqual({
      asn: null,
      fai: 'x'.repeat(ALH_BORNES.fai),
      pays: null,
      cdn: null,
    });
    expect(reseauCarte({ asn: '64496', fai: null, pays: 'FR', cdn: true })).toEqual({
      asn: '64496',
      fai: null,
      pays: 'FR',
      cdn: true,
    });
  });

  it('l’assistant ne lit pas la carte : le réseau des hôtes ne lui est jamais remis', () => {
    const assistant = readFileSync(path.join(SRC, 'vulnerabilites/assistant.ts'), 'utf8');
    expect(assistant).not.toMatch(/\.carte\(|ActifCarteDto|CarteSurfaceDto/);
  });
});
