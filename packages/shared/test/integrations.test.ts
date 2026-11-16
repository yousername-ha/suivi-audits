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
  pointAccesAdmis,
  RapportExecution,
  RESULTATS_OPERATION,
  SECRETS_INTEGRATION,
  TYPES_INTEGRATION,
  typeIntegration,
} from '../src/index.js';

const UUID = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

describe('catalogue des connecteurs', () => {
  it('un seul type livré, Tenable Security Center, de portée organisation, avec son flux et ses deux secrets', () => {
    expect(TYPES_INTEGRATION.map((t) => t.id)).toEqual(['tenable']);
    const t = typeIntegration('tenable');
    expect(t.libelle).toBe('Tenable Security Center');
    expect(t.portee).toBe('organisation');
    expect(t.flux).toBe('tenable');
    expect(t.secrets.map((s) => s.id)).toEqual(['accessKey', 'secretKey']);
    expect(t.operations).toEqual(['tester']);
    expect(SECRETS_INTEGRATION).toEqual(['accessKey', 'secretKey']);
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
      { methode: 'GET', chemin: '/rest/hosts' },
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
    ])
      expect(configurationValide('tenable', { adresse: saisie })).toEqual({
        adresse: rangee,
        autoriteCertification: '',
        delaiSecondes: 30,
      });
  });

  it('refuse http, les identifiants, les chemins, les paramètres, les fragments et un autre port', () => {
    for (const [adresse, motif] of [
      ['http://tenable.exemple.test', /https:\/\//],
      ['https://compte:secret@tenable.exemple.test', /identifiant/],
      ['https://compte@tenable.exemple.test', /identifiant/],
      ['https://tenable.exemple.test/rest', /chemin/],
      ['https://tenable.exemple.test?a=1', /paramètre/],
      ['https://tenable.exemple.test#x', /fragment/],
      ['https://tenable.exemple.test:8443', /443/],
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
    ])
      expect(() => configurationValide('tenable', { adresse: 'https://tenable.exemple.test', ...extra })).toThrow();
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
