/* Module Intégrations (ADR 0076), socle des connecteurs réseau : catalogue, adresse HTTPS, configuration de Tenable Security
   Center, liste fermée des points d'accès, secrets, rapport de l'exécutant, flux déclaré. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  catalogueIntegrations,
  configurationValide,
  erreurAdresse,
  fluxExterne,
  FLUX_MODULES,
  IntegrationActivation,
  IntegrationCreation,
  IntegrationModification,
  IntegrationSecrets,
  OPERATIONS_EN_LOTS,
  pointAccesAdmis,
  portAdresse,
  RapportExecution,
  RESULTATS_OPERATION,
  SECRETS_INTEGRATION,
  TYPES_INTEGRATION,
  typeIntegration,
} from '../src/index.js';

const UUID = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

describe('catalogue des connecteurs', () => {
  it('deux types livrés, Tenable Security Center et AlgoLightHouse, de portée organisation, chacun avec son flux et ses secrets', () => {
    expect(TYPES_INTEGRATION.map((t) => t.id)).toEqual(['tenable', 'algolighthouse']);
    const t = typeIntegration('tenable');
    expect(t.libelle).toBe('Tenable Security Center');
    expect(t.portee).toBe('organisation');
    expect(t.flux).toBe('tenable');
    expect(t.secrets.map((s) => s.id)).toEqual(['accessKey', 'secretKey']);
    expect(t.operations).toEqual(['tester', 'synchroniser']);
    expect(OPERATIONS_EN_LOTS).toEqual({ synchroniser: 'vulnerabilites' });
    expect(SECRETS_INTEGRATION).toEqual(['accessKey', 'secretKey', 'cleApi']);
    const alh = typeIntegration('algolighthouse');
    expect([alh.libelle, alh.portee, alh.flux]).toEqual(['AlgoLightHouse', 'organisation', 'algolighthouse']);
    expect(alh.secrets.map((s) => s.id)).toEqual(['cleApi']);
    expect(alh.operations).toEqual(['tester', 'synchroniser']);
    expect(alh.champs).toEqual(['adresse', 'delaiSecondes']);
    // Chaque type emprunte un flux du registre (ADR 0097), refermé par la désactivation du module Intégrations.
    for (const x of TYPES_INTEGRATION) {
      expect(FLUX_MODULES).toContain(x.flux);
      expect(fluxExterne(x.flux).moduleActivation).toBe('integrations');
      expect(fluxExterne(x.flux).porteur.type).toBe('executant');
    }
    // Sortie de l'API : sans schéma ni motif.
    const c = catalogueIntegrations();
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
    expect(c[0]!.secrets[0]).toEqual({ id: 'accessKey', libelle: 'Clé d’accès', aide: expect.any(String) });
  });

  it('liste fermée des points d’accès : lecture seule, motif strict', () => {
    expect(typeIntegration('tenable').pointsAcces).toEqual([
      { methode: 'POST', chemin: '/rest/analysis' },
      { methode: 'GET', chemin: '/rest/hosts', parametres: ['limit', 'offset'] },
      { methode: 'GET', chemin: '/rest/hosts/{uuid}' },
      { methode: 'GET', chemin: '/rest/system' },
    ]);
    expect(pointAccesAdmis('tenable', 'GET', '/rest/system')).toBe(true);
    expect(pointAccesAdmis('tenable', 'GET', `/rest/hosts/${UUID}`)).toBe(true);
    expect(pointAccesAdmis('tenable', 'POST', '/rest/analysis')).toBe(true);
    for (const [m, c] of [
      ['PATCH', `/rest/hosts/${UUID}/acr`],
      ['DELETE', `/rest/hosts/${UUID}`],
      ['GET', '/rest/solutions'],
      ['POST', '/rest/system'],
      ['GET', '/rest/hosts/pas-un-uuid'],
      ['GET', '/rest/hosts/../system'],
      ['GET', '/rest/system?x=1'],
      ['GET', `/rest/hosts/${UUID}/`],
    ] as const)
      expect(pointAccesAdmis('tenable', m, c), `${m} ${c}`).toBe(false);
  });
});

describe('adresse et configuration de Tenable Security Center', () => {
  it('admet une adresse https:// nue, y compris privée, et la normalise', () => {
    for (const [saisie, rangee] of [
      ['https://tenable.exemple.test', 'https://tenable.exemple.test'],
      ['  https://Tenable.Exemple.Test/ ', 'https://tenable.exemple.test'],
      ['https://10.20.30.40', 'https://10.20.30.40'],
      ['https://tenable.exemple.test:443', 'https://tenable.exemple.test'],
      // Port réglable (décision du RSSI du 16/11/2026) : gardé quand il n'est pas 443.
      ['https://Tenable.Exemple.Test:8443/', 'https://tenable.exemple.test:8443'],
      ['https://10.20.30.40:1', 'https://10.20.30.40:1'],
      ['https://tenable.exemple.test:65535', 'https://tenable.exemple.test:65535'],
    ])
      expect(configurationValide('tenable', { adresse: saisie })).toEqual({
        adresse: rangee,
        autoriteCertification: '',
        delaiSecondes: 30,
        gravites: ['critique', 'elevee'],
      });
  });

  it('port du flux : celui de l’adresse réglée, 443 sans port explicite', () => {
    expect(portAdresse('https://tenable.exemple.test')).toBe(443);
    expect(portAdresse('https://tenable.exemple.test:8443')).toBe(8443);
    expect(portAdresse('pas une adresse')).toBe(443);
  });

  it('refuse http, les identifiants, les chemins, les paramètres, les fragments et un port hors bornes ou non numérique', () => {
    for (const [adresse, motif] of [
      ['http://tenable.exemple.test', /https:\/\//],
      ['https://compte:secret@tenable.exemple.test', /identifiant/],
      ['https://compte@tenable.exemple.test', /identifiant/],
      ['https://tenable.exemple.test/rest', /chemin/],
      ['https://tenable.exemple.test?a=1', /paramètre/],
      ['https://tenable.exemple.test#x', /fragment/],
      ['https://tenable.exemple.test:0', /Port invalide/],
      ['https://tenable.exemple.test:65536', /Port invalide/],
      ['https://tenable.exemple.test:99999', /Port invalide/],
      ['https://tenable.exemple.test:abc', /Port invalide/],
      ['https://tenable.exemple.test:', /Port invalide/],
      ['https://tenable.exemple.test:8443/rest', /chemin/],
      ['https://tenable exemple.test', /espace/],
      ['', /obligatoire/],
    ] as const)
      expect(erreurAdresse(adresse), adresse).toMatch(motif);
    expect(() => configurationValide('tenable', { adresse: 'http://tenable.exemple.test' })).toThrow();
  });

  it('autorité PEM facultative, délai borné, aucun champ inattendu', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
    expect(
      configurationValide('tenable', {
        adresse: 'https://tenable.exemple.test',
        autoriteCertification: pem,
        delaiSecondes: 5,
      }),
    ).toMatchObject({ autoriteCertification: pem, delaiSecondes: 5 });
    for (const extra of [
      { autoriteCertification: 'pas un certificat' },
      { delaiSecondes: 4 },
      { delaiSecondes: 61 },
      { accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' },
      { gravites: [] },
      { gravites: ['info'] },
      { gravites: ['critique', 'critique'] },
    ])
      expect(() => configurationValide('tenable', { adresse: 'https://tenable.exemple.test', ...extra })).toThrow();
  });

  it('filtre de gravité de « Synchroniser » : critiques et élevées par défaut, rangé de la plus grave à la moins grave', () => {
    expect(configurationValide('tenable', { adresse: 'https://tenable.exemple.test' }).gravites).toEqual([
      'critique',
      'elevee',
    ]);
    expect(
      configurationValide('tenable', { adresse: 'https://tenable.exemple.test', gravites: ['faible', 'critique'] })
        .gravites,
    ).toEqual(['critique', 'faible']);
  });
});

describe('corps des routes', () => {
  it('création, modification et activation strictes', () => {
    expect(
      IntegrationCreation.parse({ type: 'tenable', nom: 'Tenable', configuration: { adresse: 'https://x.test' } })
        .smsiId,
    ).toBeNull();
    expect(() => IntegrationCreation.parse({ type: 'glpi', nom: 'GLPI', configuration: {} })).toThrow();
    expect(() => IntegrationCreation.parse({ type: 'tenable', nom: ' ', configuration: {} })).toThrow();
    expect(() => IntegrationModification.parse({})).toThrow();
    expect(() => IntegrationModification.parse({ actif: true })).toThrow();
    expect(IntegrationActivation.parse({ actif: true, fluxConfirme: true })).toEqual({
      actif: true,
      fluxConfirme: true,
    });
    expect(() => IntegrationActivation.parse({ actif: true, fluxConfirme: false })).toThrow();
  });

  it('secrets : au moins un champ connu, rien d’autre', () => {
    expect(IntegrationSecrets.parse({ accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' })).toEqual({
      accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    });
    expect(() => IntegrationSecrets.parse({})).toThrow();
    expect(() => IntegrationSecrets.parse({ motDePasse: 'x' })).toThrow();
    expect(() => IntegrationSecrets.parse({ accessKey: '' })).toThrow();
  });
});

describe('rapport de l’exécutant', () => {
  it('succès avec résultat, ou échec avec une erreur sur une ligne', () => {
    expect(RapportExecution.parse({ ok: true, resultat: { version: '6.9.1' }, erreur: null }).ok).toBe(true);
    expect(RapportExecution.parse({ ok: false, resultat: null, erreur: 'Délai dépassé.' }).ok).toBe(false);
    for (const r of [
      { ok: true, resultat: null, erreur: null },
      { ok: false, resultat: null, erreur: null },
      { ok: false, resultat: null, erreur: 'ligne 1\nligne 2' },
      { ok: false, resultat: null, erreur: 'x'.repeat(301) },
      { ok: true, resultat: { version: '6.9.1' }, erreur: null, secrets: {} },
    ])
      expect(() => RapportExecution.parse(r)).toThrow();
  });

  it('résultat de « tester » : la seule version, de forme contrôlée', () => {
    const s = RESULTATS_OPERATION.tenable.tester;
    expect(s.parse({ version: '6.9.1' })).toEqual({ version: '6.9.1' });
    for (const r of [
      { version: '6.9.1', ActivationCode: 'FAUX' },
      { version: '6.9.1; x' },
      { version: '' },
      { version: 'a'.repeat(50) },
      {},
    ])
      expect(s.safeParse(r).success).toBe(false);
  });
});

describe('connecteur AlgoLightHouse (lot ALH1)', () => {
  it('liste fermée en lecture seule : GET seulement, version 1 de l’API, jamais d’écriture ni d’adresse obsolète', () => {
    const alh = typeIntegration('algolighthouse');
    expect(alh.pointsAcces.map((p) => `${p.methode} ${p.chemin}`)).toEqual([
      'GET /api/v1/health',
      'GET /api/v1/version',
      'GET /api/v1/alerts',
      'GET /api/v1/alerts/{uuid}',
      'GET /api/v1/perimeters',
      'GET /api/v1/targets/hosts',
      'GET /api/v1/targets/domains',
      'GET /api/v1/technologies',
    ]);
    expect(pointAccesAdmis('algolighthouse', 'GET', `/api/v1/alerts/${UUID}`)).toBe(true);
    for (const [m, c] of [
      ['POST', `/api/alerts/${UUID}/comments`],
      ['PUT', `/api/alerts/${UUID}/status`],
      ['GET', '/api/alerts'],
      ['GET', '/api/contacts'],
      ['POST', '/api/search'],
      ['GET', `/api/v1/alerts/${UUID}/comments`],
      ['GET', '/api/v1/targets/keywords'],
      ['POST', '/api/v1/alerts'],
    ] as const)
      expect(pointAccesAdmis('algolighthouse', m, c), `${m} ${c}`).toBe(false);
  });

  it('configuration : espace chez l’éditeur seulement, port 443, pas d’autorité propre ; clé de forme contrôlée', () => {
    expect(configurationValide('algolighthouse', { adresse: 'https://Espace-Fictif.algolighthouse.fr/' })).toEqual({
      adresse: 'https://espace-fictif.algolighthouse.fr',
      delaiSecondes: 30,
    });
    for (const adresse of [
      'https://algolighthouse.fr',
      'https://espace.algolighthouse.fr:443',
      'https://espace.algolighthouse.fr/api/v1',
      'https://espace.algolighthouse.fr.exemple.invalid',
      'https://compte@espace.algolighthouse.fr',
      'http://espace.algolighthouse.fr',
    ])
      expect(() => configurationValide('algolighthouse', { adresse }), adresse).toThrow();
    expect(() =>
      configurationValide('algolighthouse', { adresse: 'https://e.algolighthouse.fr', autoriteCertification: '' }),
    ).toThrow();
    const cle = typeIntegration('algolighthouse').secrets[0]!.motif;
    expect(cle.test('cle-api-fictive-0123456789abcdef')).toBe(true);
    for (const x of ['courte', 'avec espace 0123456789abc', 'x'.repeat(257), 'ligne\n0123456789abcdef'])
      expect(cle.test(x), x).toBe(false);
  });
});
