/* Lot SI1 (ADR 0100) : import du rapport Silène de l'ANSSI lu dans le navigateur. Extraction sur des rapports JSON fictifs
   écrits à la main (tests/fixtures/silene) : cas nominal, champs interdits (certificats, en-têtes, sorties de sonde, titres,
   géolocalisation, système autonome, base, filtre, passage précédent, sujet et noms d'un certificat, origines d'un produit)
   absents de l'extrait envoyé, JSON invalide, structure inconnue, fichier trop gros, contrôle inconnu accepté, valeurs hors
   norme écartées et comptées ; lots revalidés par les schémas partagés. Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import {
  catalogueIntegrations,
  DebutImportSilene,
  type IntegrationDto,
  LotImportSilene,
  SILENE_BORNES,
} from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportSilene } from '../src/integrations/ImportSilene';
import { TuileInstance, TuileType } from '../src/integrations/IntegrationsPage';
import { lignesSuppression } from '../src/integrations/SuppressionNessus';
import { resumeExecution } from '../src/integrations/integrations';
import {
  decouperEnLotsSilene,
  ErreurImportSilene,
  erreurTailleSilene,
  extraireSilene,
  horodatageSilene,
  CompteurSilene,
  libelleEcartsSilene,
  lireJson,
  noteSilene,
  resumeBilanSilene,
  resumeExtraitSilene,
  texteSilene,
} from '../src/integrations/silene';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../tests/fixtures/silene');
const lire = (nom: string) => readFileSync(path.join(FIXTURES, nom), 'utf8');
const rendre = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const INTERDITS = [
  'INTERDIT',
  'INTERDITE',
  'BEGIN CERTIFICATE',
  'syn-ack',
  'SILENE',
  'schema_version',
  'origins',
  '192.0.2.250',
];

describe('extraction d’un rapport Silène (liste blanche)', () => {
  it('rapport nominal : synthèse, périmètre, hôtes, ports, noms, produits, constats ; écarts comptés', () => {
    const x = extraireSilene(lireJson(lire('rapport-fictif-1.json')));
    expect(x.rapport).toEqual({
      date: '2026-11-15',
      debut: '2026-11-15T06:00:00',
      fin: '2026-11-15T07:45:00',
      note: 14.5,
      noteReseau: 13,
      vulnreco: 2,
      warning: 1,
      info: 3,
      ok: 40,
    });
    expect(x.perimetre).toEqual({
      domaines: ['example.org'],
      plages: ['192.0.2.0/24', '198.51.100.0/24', '203.0.113.30'],
    });
    expect(x.hotes.map((h) => h.adresse)).toEqual(['192.0.2.10', '198.51.100.20', '203.0.113.30']);
    const h = x.hotes[0]!;
    expect(h.noms).toEqual([
      { nom: 'www.example.org', type: 'A' },
      { nom: 'host-10.ptr.example.org', type: 'PTR' },
      { nom: 'www.example.org', type: 'cert-san-dns' },
    ]);
    // Ports : ceux de `ports` ouverts, complétés par `openports` (8443 sans service) ; fermé ignoré, 70000 écarté.
    expect(h.ports).toEqual([
      { port: 22, protocole: 'tcp', service: 'ssh', produit: 'FictionalSSH', tunnel: null },
      { port: 443, protocole: 'tcp', service: 'https', produit: 'Fictional httpd', tunnel: 'ssl' },
      { port: 8443, protocole: 'tcp', service: null, produit: null, tunnel: null },
    ]);
    expect(h.portsOuverts).toBe(3);
    expect(h.produits).toEqual([
      { type: 'a', editeur: 'fictional', produit: 'httpd', version: '9.9' },
      { type: 'o', editeur: 'fictional', produit: 'fictional_os', version: null },
    ]);
    expect(h.controles).toEqual(['OpenPort', 'HttpVersion', 'ExpiredCertificate']);
    expect(x.hotes[1]!.ports.map((p) => `${p.port}/${p.protocole}`)).toEqual(['53/udp', '3389/tcp']);
    // Constats : contrôle connu ou inconnu de forme admise ; sans contrôle et classe illisible écartés.
    expect(x.constats.map((c) => [c.identifiant, c.controle, c.classe])).toEqual([
      ['RES-FICTIF-0001', 'OpenPort', 2],
      ['RES-FICTIF-0002', 'SelfSignedCertificate', 1],
      ['RES-FICTIF-0003', 'ExpiredCertificate', 3],
      ['RES-FICTIF-0004', 'ControleFictifInconnu', 0],
    ]);
    const c1 = x.constats[0]!;
    expect(c1).toMatchObject({ points: 10, note: 0, hotes: ['192.0.2.10', '198.51.100.20'] });
    expect(c1.lignes[0]).toEqual({
      hote: '192.0.2.10',
      port: 22,
      protocole: 'tcp',
      service: 'ssh',
      produit: 'FictionalSSH',
      nomHote: null,
      type: null,
      echeance: null,
    });
    expect(x.constats[1]!.lignes[0]).toMatchObject({ nomHote: 'vpn.example.org', type: 'autosigne', port: 443 });
    expect(x.constats[2]!.lignes[0]).toMatchObject({ echeance: '2026-10-01T00:00:00', port: 8443 });
    expect(x.ecartes).toMatchObject({
      hotesInvalides: 1,
      nomsInvalides: 1,
      portsInvalides: 1,
      controlesInvalides: 1,
      constatsInvalides: 1,
      constatsSansControle: 1,
      perimetreInvalide: 1,
      valeursInvalides: 0,
    });
    expect(libelleEcartsSilene(x.ecartes)).toContain('constats qu’aucun contrôle ne cite : 1');
    expect(resumeExtraitSilene(x)).toBe(
      '3 hôtes, 6 ports ouverts et 4 constats à importer (rapport du 15/11/2026, note 14,5).',
    );
  });

  it('aucun champ interdit dans l’extrait ni dans les lots envoyés ; lots et début revalidés par les schémas partagés', () => {
    const texte = lire('rapport-fictif-1.json');
    // Les marqueurs sont bien présents dans le fichier d'origine.
    for (const m of ['CERTIFICAT-INTERDIT', 'ENTETE-HTTP-INTERDITE', 'SORTIE-SONDE-INTERDITE', 'PASSAGE-PRECEDENT'])
      expect(texte).toContain(m);
    const x = extraireSilene(lireJson(texte));
    const lots = decouperEnLotsSilene(x);
    const envoye = JSON.stringify({
      debut: { rapport: x.rapport, perimetre: x.perimetre, ecartes: x.ecartes },
      lots,
    });
    for (const m of INTERDITS) expect(envoye.includes(m), m).toBe(false);
    for (const l of lots) expect(LotImportSilene.safeParse(l).success).toBe(true);
    expect(
      DebutImportSilene.safeParse({
        rapport: x.rapport,
        perimetre: x.perimetre,
        hotes: x.hotes.length,
        constats: x.constats.length,
        ecartes: x.ecartes,
      }).success,
    ).toBe(true);
    // Hôtes d'abord, puis constats.
    expect(lots.map((l) => [l.hotes.length, l.constats.length])).toEqual([
      [3, 0],
      [0, 4],
    ]);
  });

  it('JSON invalide, structure inconnue, fichier trop gros ou vide : refus clairs', () => {
    expect(() => lireJson('{ "summary": ')).toThrow(ErreurImportSilene);
    expect(() => lireJson('<NessusClientData_v2/>')).toThrow('ce n’est pas un fichier JSON valide');
    for (const brut of [[], 'texte', null, { summary: {} }, { summary: {}, hosts: {}, results: [], modules: {} }])
      expect(() => extraireSilene(brut)).toThrow('Structure inconnue');
    expect(erreurTailleSilene(0)).toBe('Fichier vide.');
    expect(erreurTailleSilene(SILENE_BORNES.fichierMo * 1_000_000)).toBeNull();
    expect(erreurTailleSilene(SILENE_BORNES.fichierMo * 1_000_000 + 1)).toContain('Fichier trop volumineux');
  });

  it('valeurs hors norme écartées et comptées ; bornes par hôte et par constat ; contrôle inconnu accepté', () => {
    const ports = Array.from({ length: SILENE_BORNES.portsParHote + 5 }, (_, i) => i + 1);
    const lignes = Array.from({ length: SILENE_BORNES.lignesParHote + 2 }, (_, i) => ({
      port: i + 1,
      protocol: 'tcp',
    }));
    const x = extraireSilene({
      summary: {
        grade: 'quinze',
        grades: { network: Number.MAX_VALUE },
        starttime: '15/11/2026 06:00',
        vulnreco_count: -1,
      },
      perimeter: { domains: ['Example.ORG.'], ip: ['192.0.2.0/33'] },
      modules: { ControleNouveau: { results: ['r-1', 'r-2'] } },
      results: {
        'r-1': {
          id: 'r-1',
          result_class: 7,
          max_points: { network: 'dix' },
          applicable_hosts: ['192.0.2.1', 'pas-une-adresse'],
          listing: { '192.0.2.1': lignes, 'nom-de-cle': [{ port: 22 }] },
        },
        'r-2': { id: 'r-2', result_class: 1001, listing: {} },
      },
      hosts: {
        '192.0.2.1': {
          addr: '192.0.2.1',
          openports: { count: ports.length, tcp: { ports } },
          categories: ['ControleNouveau', 'nom invalide'],
          cpes: [{ type: 'x', vendor: 'v', product: 'p' }],
          hostnames: [{ name: '192.0.2.1', type: 'A' }],
        },
      },
    });
    expect(x.rapport).toMatchObject({ note: null, noteReseau: null, debut: null, vulnreco: null });
    expect(x.perimetre).toEqual({ domaines: ['example.org'], plages: [] });
    expect(x.hotes[0]!.ports).toHaveLength(SILENE_BORNES.portsParHote);
    expect(x.hotes[0]!.controles).toEqual(['ControleNouveau']);
    expect(x.constats.map((c) => c.controle)).toEqual(['ControleNouveau']);
    expect(x.constats[0]!.lignes).toHaveLength(SILENE_BORNES.lignesParHote);
    expect(x.constats[0]!).toMatchObject({ points: null, hotes: ['192.0.2.1'] });
    expect(x.ecartes).toMatchObject({
      portsAuDela: 5,
      controlesInvalides: 1,
      produitsInvalides: 1,
      nomsInvalides: 1,
      constatsInvalides: 1,
      lignesInvalides: 1,
      lignesAuDela: 2,
      perimetreInvalide: 1,
      valeursInvalides: 6,
    });
  });

  it('valeurs unitaires : texte nettoyé et borné, horodatage normalisé, note arrondie', () => {
    const c = new CompteurSilene();
    expect(texteSilene('  a\u0000b \n c  ', c)).toBe('a b c');
    expect(texteSilene('x'.repeat(150), c)).toHaveLength(SILENE_BORNES.texte);
    expect(c.valeurs.textesRaccourcis).toBe(1);
    expect(texteSilene('<script>', c)).toBe('‹script>');
    expect(horodatageSilene('2026-11-15T06:00:00', c)).toBe('2026-11-15T06:00:00');
    expect(horodatageSilene('2026-13-15 06:00:00', c)).toBeNull();
    expect(noteSilene(14.123456, c)).toBe(14.1235);
    expect(noteSilene(Number.NaN, c)).toBeNull();
  });
});

describe('fenêtre d’import et carte « Intégrations »', () => {
  const type = catalogueIntegrations().find((t) => t.id === 'silene-fichier')!;
  const instance: IntegrationDto = {
    id: '0190a000-0000-7000-8000-000000000001',
    type: 'silene-fichier',
    nom: 'Silène fictif',
    smsiId: null,
    configuration: {},
    actif: true,
    secrets: {},
    frequenceHeures: null,
    version: 2,
    createdBy: 'admin',
    createdAt: '2026-11-19T08:00:00.000Z',
    updatedBy: 'admin',
    updatedAt: '2026-11-19T08:00:00.000Z',
    derniereExecution: null,
  };

  it('type sans adresse, sans clé ni flux ; tuile avec « Importer un rapport » et la suppression', () => {
    expect(type).toMatchObject({ champs: [], secrets: [], flux: null, pointsAcces: [], operations: ['importer'] });
    expect(rendre(createElement(TuileType, { t: type, peutAjouter: true, onAjouter: () => {} }))).toContain(
      'import de fichier, sans réseau',
    );
    const html = rendre(
      createElement(TuileInstance, {
        i: instance,
        t: type,
        fluxOuvert: false,
        peutAdministrer: true,
        peutLancer: true,
        enCours: false,
        onConfigurer: () => {},
        onActiver: () => {},
        onTester: () => {},
        onImporter: () => {},
        onSupprimer: () => {},
        onExecutions: () => {},
      }),
    );
    expect(html).toContain('aria-label="Importer un rapport dans Silène fictif"');
    expect(html).toContain('Importer un rapport');
    expect(html).not.toContain('Importer un scan');
    expect(html).toContain('Supprimer ce connecteur et tout ce qu’il a importé');
    expect(html).not.toContain('Gravités');
  });

  it('fenêtre : champ de fichier nommé, borne et liste de ce qui ne part jamais', () => {
    const html = rendre(createElement(ImportSilene, { instance }));
    expect(html).toContain('Rapport Silène (JSON)');
    expect(html).toContain(`${SILENE_BORNES.fichierMo} Mo au plus`);
    expect(html).toContain('certificats');
    expect(html).toContain('géolocalisation');
  });

  it('bilan dans « Exécutions » et nombres de la suppression', () => {
    const bilan = {
      hotesAnnonces: 3,
      hotes: 3,
      constatsAnnonces: 4,
      constats: 4,
      lots: 2,
      hotesDisparus: 1,
      constatsDisparus: 0,
      ecartes: extraireSilene(lireJson(lire('rapport-fictif-2.json'))).ecartes,
    };
    expect(resumeBilanSilene(bilan)).toContain('Import : 3 hôtes sur 3, 4 constats sur 4, en 2 lots.');
    expect(resumeBilanSilene(bilan)).toContain('Plus présents depuis le rapport précédent : 1 hôte, 0 constat.');
    expect(resumeExecution({ operation: 'importer', etat: 'recu', resultat: bilan, erreur: null })).toContain(
      '3 hôtes sur 3',
    );
    expect(lignesSuppression({ hotes: 3, constats: 4, imports: 2 })).toEqual([
      '3 hôtes (adresses IP, noms, ports ouverts, produits)',
      '4 constats et leur détail',
      '2 imports, leurs notes et leurs exécutions',
    ]);
  });
});
