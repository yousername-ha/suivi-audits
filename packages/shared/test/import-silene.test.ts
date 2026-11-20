/* Lot SI1 (ADR 0100) : schémas de l'import du rapport Silène (revalidation par l'API), bornes, table de correspondance des
   classes (vide tant qu'elle n'est pas confirmée), réunion des ports d'un actif, catalogue des intégrations. Données
   fictives. */
import { describe, expect, it } from 'vitest';
import {
  BilanImportSilene,
  catalogueIntegrations,
  CLASSES_SILENE,
  ConstatSilene,
  CONTROLE_SILENE,
  CONTROLES_SILENE_CONNUS,
  DebutImportSilene,
  ecartsSileneVides,
  evolutionSilene,
  FREQUENCES_CONNECTEUR,
  fusionnerPortsActif,
  HoteSilene,
  libelleClasseSilene,
  libelleOperationType,
  LotImportSilene,
  NESSUS_BORNES,
  plageSileneValide,
  RapportSilene,
  RESULTATS_OPERATION,
  SILENE_BORNES,
  TYPES_INTEGRATION_RESEAU,
} from '../src/index.js';

const hote = (adresse: string, extra: Record<string, unknown> = {}) => ({
  adresse,
  noms: [{ nom: 'www.example.org', type: 'A' }],
  ports: [{ port: 443, protocole: 'tcp', service: 'https', produit: null, tunnel: 'ssl' }],
  portsOuverts: 1,
  produits: [{ type: 'a', editeur: 'fictional', produit: 'httpd', version: null }],
  controles: ['OpenPort'],
  ...extra,
});
const constat = (extra: Record<string, unknown> = {}) => ({
  identifiant: 'RES-FICTIF-0001',
  controle: 'OpenPort',
  classe: 2,
  points: 10,
  note: null,
  hotes: ['192.0.2.10'],
  lignes: [
    {
      hote: '192.0.2.10',
      port: 443,
      protocole: 'tcp',
      service: null,
      produit: null,
      nomHote: 'www.example.org',
      type: null,
      echeance: '2026-10-01T00:00:00',
    },
  ],
  ...extra,
});
const rapport = {
  date: '2026-11-15',
  debut: '2026-11-15T06:00:00',
  fin: null,
  note: 14.5,
  noteReseau: 13,
  vulnreco: 2,
  warning: 1,
  info: 3,
  ok: 40,
};

describe('schémas de l’import Silène', () => {
  it('hôte, constat, lot et début nominaux', () => {
    expect(HoteSilene.safeParse(hote('192.0.2.10')).success).toBe(true);
    expect(HoteSilene.safeParse(hote('2001:db8::10')).success).toBe(true);
    expect(ConstatSilene.safeParse(constat()).success).toBe(true);
    expect(LotImportSilene.safeParse({ hotes: [hote('192.0.2.10')], constats: [constat()] }).success).toBe(true);
    expect(
      DebutImportSilene.safeParse({
        rapport,
        perimetre: { domaines: ['example.org'], plages: ['192.0.2.0/24', '2001:db8::/32'] },
        hotes: 1,
        constats: 1,
        ecartes: ecartsSileneVides(),
      }).success,
    ).toBe(true);
  });

  it('refuse les champs en trop (certificat, en-têtes, passage précédent) et les formes hors norme', () => {
    for (const x of [
      hote('192.0.2.10', { certificat: 'PEM' }),
      hote('192.0.2.10', { entetes: 'Server: x' }),
      hote('HOTE.EXAMPLE.ORG'),
      hote('192.0.2.10', { noms: [{ nom: 'WWW.Example.org', type: 'A' }] }),
      hote('192.0.2.10', { noms: [{ nom: 'www.example.org', type: 'MX' }] }),
      hote('192.0.2.10', { ports: [{ port: 0, protocole: 'tcp', service: null, produit: null, tunnel: null }] }),
      hote('192.0.2.10', { ports: [{ port: 22, protocole: 'sctp', service: null, produit: null, tunnel: null }] }),
      hote('192.0.2.10', { controles: ['nom invalide'] }),
      hote('192.0.2.10', { ports: [...hote('x').ports, ...hote('x').ports] }),
      hote('192.0.2.10', { produits: [{ type: 'a', editeur: 'x\u0000y', produit: 'p', version: null }] }),
    ])
      expect(HoteSilene.safeParse(x).success, JSON.stringify(x)).toBe(false);
    for (const x of [
      constat({ classe: 1001 }),
      constat({ classe: 1.5 }),
      constat({ identifiant: 'id avec espace' }),
      constat({ controle: '9Controle' }),
      constat({ points: 1.23456 }),
      constat({ hotes: ['192.0.2.10', '192.0.2.10'] }),
      constat({ subject: 'CN=x' }),
    ])
      expect(ConstatSilene.safeParse(x).success, JSON.stringify(x)).toBe(false);
    expect(LotImportSilene.safeParse({ hotes: [], constats: [] }).success).toBe(false);
    expect(LotImportSilene.safeParse({ hotes: [hote('192.0.2.10'), hote('192.0.2.10')], constats: [] }).success).toBe(
      false,
    );
    expect(RapportSilene.safeParse({ ...rapport, debut: '2026-11-15 06:00:00' }).success).toBe(false);
    expect(RapportSilene.safeParse({ ...rapport, _prev: {} }).success).toBe(false);
    expect(
      DebutImportSilene.safeParse({
        rapport,
        perimetre: { domaines: [], plages: [] },
        hotes: 1,
        constats: 0,
        ecartes: ecartsSileneVides(),
        nomFichier: 'rapport.json',
      }).success,
    ).toBe(false);
  });

  it('plages du périmètre déclaré : préfixe borné selon la famille d’adresses', () => {
    expect(plageSileneValide('192.0.2.0/24')).toBe(true);
    expect(plageSileneValide('192.0.2.0/33')).toBe(false);
    expect(plageSileneValide('2001:db8::/48')).toBe(true);
    expect(plageSileneValide('2001:db8::/129')).toBe(false);
    expect(plageSileneValide('example.org')).toBe(false);
  });

  it('bornes : limite des imports alignée sur Nessus, fichier de 50 Mo, bilan borné', () => {
    expect(SILENE_BORNES.importsParHeure).toBe(NESSUS_BORNES.importsParHeure);
    expect(SILENE_BORNES.fichierMo).toBe(50);
    expect(
      BilanImportSilene.safeParse({
        hotesAnnonces: 1,
        hotes: 1,
        constatsAnnonces: 0,
        constats: 0,
        lots: 1,
        hotesDisparus: 0,
        constatsDisparus: 0,
        ecartes: ecartsSileneVides(),
      }).success,
    ).toBe(true);
    // Le bilan tient dans le résultat d'une exécution (4 096 octets, migration 073).
    expect(
      JSON.stringify({
        hotesAnnonces: 20000,
        hotes: 20000,
        constatsAnnonces: 5000,
        constats: 5000,
        lots: 1000,
        hotesDisparus: 10_000_000,
        constatsDisparus: 10_000_000,
        ecartes: Object.fromEntries(Object.keys(ecartsSileneVides()).map((k) => [k, 10_000_000])),
      }).length,
    ).toBeLessThan(4096);
  });
});

describe('classes, contrôles, évolution', () => {
  it('table de correspondance vide (non confirmée) : « classe N »', () => {
    expect(CLASSES_SILENE).toEqual({});
    expect(libelleClasseSilene(0)).toBe('classe 0');
    expect(libelleClasseSilene(-3)).toBe('classe -3');
  });
  it('contrôles connus de la forme admise ; un contrôle inconnu de cette forme est admis', () => {
    for (const c of CONTROLES_SILENE_CONNUS) expect(CONTROLE_SILENE.test(c), c).toBe(true);
    expect(CONTROLE_SILENE.test('ControleFictifInconnu')).toBe(true);
    expect(CONTROLE_SILENE.test('Contrôle')).toBe(false);
  });
  it('évolution arrondie, null si une note manque', () => {
    expect(evolutionSilene(16.25, 14.5)).toBe(1.75);
    expect(evolutionSilene(null, 14.5)).toBeNull();
  });
});

describe('ports d’un actif, deux sources', () => {
  const alh = (port: number, protocole: 'tcp' | 'udp' | null) => ({
    port,
    protocole,
    nom: 'svc',
    produit: null,
    version: null,
    editeur: null,
    cpe: null,
    statutVersion: null,
  });
  const sil = (port: number, protocole: 'tcp' | 'udp') => ({
    port,
    protocole,
    service: null,
    produit: null,
    tunnel: null,
  });
  it('sans doublon port/protocole ; protocole manquant rejoint le seul port de même numéro', () => {
    const p = fusionnerPortsActif(
      [alh(443, 'tcp'), alh(8443, null), alh(53, null)],
      [sil(443, 'tcp'), sil(8443, 'tcp'), sil(53, 'tcp'), sil(53, 'udp')],
    );
    expect(p.map((x) => [x.port, x.protocole, !!x.alh, !!x.silene])).toEqual([
      [53, 'tcp', false, true],
      [53, 'udp', false, true],
      [53, null, true, false],
      [443, 'tcp', true, true],
      [8443, 'tcp', true, true],
    ]);
  });
});

describe('catalogue des intégrations', () => {
  it('type sans réseau ni réglage ; libellé « Importer un rapport » ; aucune fréquence ; bilan propre', () => {
    const t = catalogueIntegrations().find((x) => x.id === 'silene-fichier')!;
    expect(t).toMatchObject({
      libelle: 'Silène, import de fichier',
      champs: [],
      secrets: [],
      flux: null,
      pointsAcces: [],
      operations: ['importer'],
    });
    expect(TYPES_INTEGRATION_RESEAU.some((x) => x.id === 'silene-fichier')).toBe(false);
    expect(FREQUENCES_CONNECTEUR['silene-fichier']).toEqual([]);
    expect(RESULTATS_OPERATION['silene-fichier'].importer).toBe(BilanImportSilene);
    expect(libelleOperationType('silene-fichier', 'importer')).toBe('Importer un rapport');
    expect(libelleOperationType('nessus-fichier', 'importer')).toBe('Importer un scan');
  });
});
