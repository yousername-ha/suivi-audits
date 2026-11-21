/* Lot N1 (ADR 0100) : import d'un scan Nessus lu dans le navigateur. Extraction sur des fichiers .nessus fictifs écrits à la
   main (tests/fixtures/nessus) : cas nominal, DOCTYPE et entité refusés avant toute analyse, racine inconnue, aucune sortie
   brute ni description longue ni politique dans l'extrait, gravités filtrées, hôte sans nom, CVE mal formée écartée et
   comptée, fichier trop gros ; découpe en lots de machines entières revalidés par le schéma partagé ; fenêtre d'import
   (champ de fichier nommé, borne annoncée) ; tuile et formulaire du type sans adresse ni clé. Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import {
  BilanImportNessus,
  catalogueIntegrations,
  MESSAGE_LIMITE_IMPORTS,
  type IntegrationDto,
  LotImportNessus,
  NESSUS_BORNES,
} from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportNessus, RefusImport, texteProgression } from '../src/integrations/ImportNessus';
import {
  ConfirmationSuppression,
  LIBELLE_SUPPRESSION,
  lignesSuppression,
  MOT_SUPPRESSION,
} from '../src/integrations/SuppressionNessus';
import { TuileInstance, TuileType } from '../src/integrations/IntegrationsPage';
import {
  configurationDepuis,
  corpsCreation,
  corpsModification,
  erreursFormulaire,
  executionEnCours,
  fluxOuvertInstance,
  formulaireDepuis,
  resumeExecution,
} from '../src/integrations/integrations';
import {
  datePublication,
  decouperEnLots,
  ErreurImport,
  erreurTaille,
  erreurTexte,
  exploiteParMalware,
  kitsNessus,
  extraireNessus,
  instantHote,
  libelleEcartes,
  lireDocument,
  listeBornee,
  nomMachine,
  type NoeudXml,
  resumeBilanImport,
  resumeExtrait,
  texteNettoye,
} from '../src/integrations/nessus';
import { lireXmlFictif } from './xml-fictif';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const fixture = (nom: string) => readFileSync(path.join(ICI, '../../../tests/fixtures/nessus', nom), 'utf8');
const SCAN1 = fixture('scan-fictif-1.nessus');
const SCAN2 = fixture('scan-fictif-2.nessus');
const rendre = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const lire = (texte: string) => lireXmlFictif(texte);
const DEFAUT = ['critique', 'elevee'] as const;

describe('extraction d’un scan .nessus fictif', () => {
  it('cas nominal : machines et contrôles retenus, champs en liste blanche, hôte sans nom, éléments écartés comptés', () => {
    const x = extraireNessus(lire(SCAN1), [...DEFAUT]);
    expect(x.machines.map((m) => m.machine)).toEqual([
      {
        cle: 'ip:192.0.2.21|srv-fictif-01.example.org',
        uuid: null,
        nom: 'srv-fictif-01.example.org',
        adresse: '192.0.2.21',
        systeme: 'Fictional Linux 9 Fictional Linux 9.1',
        debut: '2026-11-18T08:00:00.000Z',
        fin: '2026-11-18T08:10:00.000Z',
      },
      {
        cle: 'ip:198.51.100.22|srv-fictif-02',
        uuid: null,
        nom: 'srv-fictif-02',
        adresse: '198.51.100.22',
        systeme: 'Fictional Windows Server 2026',
        debut: expect.stringMatching(/^2026-11-18T\d{2}:01:00\.000Z$/),
        fin: expect.stringMatching(/^2026-11-18T\d{2}:12:00\.000Z$/),
      },
      // Hôte sans nom : identifié par son adresse seule.
      {
        cle: 'ip:203.0.113.23',
        uuid: null,
        nom: null,
        adresse: '203.0.113.23',
        systeme: null,
        debut: null,
        fin: '2026-11-18T08:13:00.000Z',
      },
    ]);
    expect(x.machines.map((m) => m.detections)).toEqual([
      [
        { plugin: '919101', port: 443, protocole: 'TCP' },
        { plugin: '919102', port: 22, protocole: 'TCP' },
      ],
      [{ plugin: '919101', port: 443, protocole: 'TCP' }],
      [{ plugin: '919104', port: 3306, protocole: 'TCP' }],
    ]);
    expect(x.constats.get('919101')).toEqual({
      plugin: '919101',
      nom: 'Fictional Web Server < 9.9 Remote Flaw',
      gravite: 'critique',
      famille: 'Web Servers',
      synopsis: 'The remote fictional web server is affected by an invented flaw.',
      correctif: 'Upgrade the fictional web server to version 9.9 or later.',
      cvss3Vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      cvss3Score: 9.8,
      vpr: 8.4,
      epss: null,
      exploitable: true,
      exploitLibelle: 'Exploits are available',
      // Lot N2 : `exploited_by_malware` lu (exploitation avérée selon Tenable).
      exploiteMalware: true,
      // Lot PRIO-1 : aucun `exploit_framework_*` dans la fixture.
      kitsExploitation: [],
      failleLe: '2026-10-01T00:00:00.000Z',
      correctifLe: '2026-10-02T00:00:00.000Z',
      voirAussi: 'https://example.org/avis-fictif-919101',
      cves: ['CVE-2026-91101', 'CVE-2026-91102'],
      cvesTronquees: false,
    });
    expect([...x.constats.keys()].sort()).toEqual(['919101', '919102', '919104']);
    expect(x.constats.get('919104')).toMatchObject({ gravite: 'elevee', cves: [], exploitable: false });
    expect(x.ecartes).toEqual({
      machinesSansIdentite: 1,
      machinesTropVolumineuses: 0,
      controlesInvalides: 0,
      controlesInformatifs: 2,
      controlesHorsGravite: 1,
      cvesInvalides: 1,
      liensRefuses: 0,
      valeursInvalides: 0,
      textesRaccourcis: 0,
    });
    expect(x.detections).toBe(4);
    expect(x.gravites).toEqual(['critique', 'elevee']);
    expect(resumeExtrait(x)).toBe(
      '3 machines et 3 failles (4 détections) à importer ; gravités retenues : Critique, Élevée.',
    );
    expect(libelleEcartes(x.ecartes)).toBe(
      'machines sans adresse ni identifiant : 1 ; contrôles informatifs (jamais rangés) : 2 ; contrôles hors des gravités retenues : 1 ; identifiants CVE mal formés : 1',
    );
  });

  it('rien d’autre que la liste blanche : ni sortie brute, ni description, ni politique, ni compte de scan, ni CVSS 4, ni EPSS, ni adresse matérielle', () => {
    const x = extraireNessus(lire(SCAN1), ['critique', 'elevee', 'moyenne', 'faible']);
    const envoye = JSON.stringify(decouperEnLots(x));
    for (const interdit of [
      'SORTIE-BRUTE',
      'DESCRIPTION-LONGUE',
      'COMPTE-DE-SCAN-FICTIF',
      'Politique fictive',
      'Scan fictif de recette',
      'CVSS:4.0',
      '0.9123',
      '00:00:5e:00:53:01',
      'http://example.org/non-chiffre',
      'plugin_output',
      'cible-sans-adresse',
      '2026/10/03',
    ])
      expect(envoye.includes(interdit), interdit).toBe(false);
  });

  it('gravités filtrées : moyennes ajoutées par la configuration, jamais les informatifs', () => {
    const x = extraireNessus(lire(SCAN1), ['critique', 'elevee', 'moyenne']);
    expect([...x.constats.keys()].sort()).toEqual(['919101', '919102', '919103', '919104']);
    expect(x.ecartes.controlesHorsGravite).toBe(0);
    expect(x.ecartes.controlesInformatifs).toBe(2);
    const critiques = extraireNessus(lire(SCAN1), ['critique']);
    expect([...critiques.constats.keys()]).toEqual(['919101']);
    // Une machine sans contrôle retenu reste importée : ses failles disparues se jugent machine par machine.
    expect(critiques.machines.map((m) => [m.machine.adresse, m.detections.length])).toEqual([
      ['192.0.2.21', 1],
      ['198.51.100.22', 1],
      ['203.0.113.23', 0],
    ]);
    expect(critiques.ecartes.controlesHorsGravite).toBe(3);
  });

  it('second scan : la faille corrigée et la machine absente ne figurent pas dans l’extrait', () => {
    const x = extraireNessus(lire(SCAN2), [...DEFAUT]);
    expect(x.machines.map((m) => [m.machine.adresse, m.detections.map((d) => d.plugin)])).toEqual([
      ['192.0.2.21', ['919101']],
      ['198.51.100.22', ['919101']],
    ]);
  });

  it('DOCTYPE et entité refusés avant toute analyse, casse ignorée ; erreur d’analyse et racine inconnue refusées', () => {
    expect(erreurTexte(SCAN1)).toBeNull();
    const doctype = SCAN1.replace('<NessusClientData_v2>', '<!doctype x [ ]>\n<NessusClientData_v2>');
    expect(erreurTexte(doctype)).toContain('DOCTYPE');
    const entite = SCAN1.replace('<NessusClientData_v2>', '<NessusClientData_v2><!-- <!Entity x "y"> -->');
    expect(erreurTexte(entite)).toContain('ENTITY');
    let appele = false;
    const analyseur = {
      parseFromString: () => {
        appele = true;
        return { getElementsByTagName: () => [{}], documentElement: null } as unknown as Document;
      },
    };
    expect(() => lireDocument(doctype, analyseur)).toThrow(ErreurImport);
    expect(appele).toBe(false);
    expect(() => lireDocument(SCAN1, analyseur)).toThrow('Fichier illisible');
    expect(appele).toBe(true);
    const autre: NoeudXml = { nom: 'NessusClientData', attribut: () => null, enfants: () => [], texte: () => '' };
    expect(() => extraireNessus(autre, [...DEFAUT])).toThrow(/NessusClientData_v2/);
  });

  it('fichier trop gros : message clair avant toute lecture', () => {
    expect(erreurTaille(5_000_000)).toBeNull();
    expect(erreurTaille(NESSUS_BORNES.fichierMo * 1_000_000)).toBeNull();
    expect(erreurTaille(NESSUS_BORNES.fichierMo * 1_000_000 + 1)).toMatch(
      /^Fichier trop volumineux : 100 Mo, pour 100 Mo au plus\./,
    );
    expect(erreurTaille(0)).toBe('Fichier vide.');
  });

  it('valeurs hors norme : écartées et comptées, jamais tronquées en silence', () => {
    const scan = SCAN1.replace('<cvss3_base_score>9.8</cvss3_base_score>', '<cvss3_base_score>98</cvss3_base_score>')
      .replace('https://example.org/avis-fictif-919102', 'javascript:alert(1)')
      .replace('<tag name="host-ip">203.0.113.23</tag>', '<tag name="host-ip">203.0.113.999</tag>')
      .replace('pluginID="919104"', 'pluginID="abc"')
      .replace('Fictional Windows Server 2026', 'W'.repeat(250));
    const x = extraireNessus(lire(scan), [...DEFAUT]);
    expect(x.constats.get('919101')!.cvss3Score).toBeNull();
    expect(x.constats.get('919102')!.voirAussi).toBeNull();
    expect(x.ecartes).toMatchObject({
      valeursInvalides: 2,
      liensRefuses: 1,
      controlesInvalides: 1,
      textesRaccourcis: 1,
    });
    expect(x.machines[1]!.machine.systeme).toHaveLength(200);
    expect(x.machines[1]!.machine.systeme!.endsWith('…')).toBe(true);
    // 203.0.113.999 n'est pas une adresse : la machine reste identifiée par le nom du ReportHost, ici une adresse valide.
    expect(x.machines[2]!.machine.adresse).toBe('203.0.113.23');
  });

  it('lot PRIO-1 : kits d’exploitation lus (exploit_framework_metasploit, _core, _canvas), « true » seulement', () => {
    expect(kitsNessus({})).toEqual([]);
    expect(
      kitsNessus({
        exploit_framework_canvas: 'true',
        exploit_framework_metasploit: ' TRUE ',
        exploit_framework_core: 'false',
      }),
    ).toEqual(['metasploit', 'canvas']);
    const x = extraireNessus(
      lire(
        SCAN1.replace(
          '<exploited_by_malware>true</exploited_by_malware>',
          '<exploited_by_malware>true</exploited_by_malware><exploit_framework_core>true</exploit_framework_core><exploit_framework_canvas>peut-être</exploit_framework_canvas>',
        ),
      ),
      [...DEFAUT],
    );
    expect(x.constats.get('919101')!.kitsExploitation).toEqual(['core_impact']);
    // Contrôle sans ces champs : aucun kit ; valeur hors norme : non, comptée.
    expect(x.constats.get('919102')!.kitsExploitation).toEqual([]);
    expect(x.ecartes.valeursInvalides).toBe(1);
  });

  it('lot N2 : « exploité par un logiciel malveillant » lu, « true » seulement, valeur hors norme comptée', () => {
    expect(exploiteParMalware('true')).toBe(true);
    expect(exploiteParMalware(' TRUE ')).toBe(true);
    for (const v of [undefined, '', 'false', 'False']) expect(exploiteParMalware(v), String(v)).toBe(false);
    const x = extraireNessus(lire(SCAN1), [...DEFAUT]);
    expect(x.constats.get('919101')!.exploiteMalware).toBe(true);
    // Contrôles sans le champ : faux, comme avant le lot.
    expect(x.constats.get('919102')!.exploiteMalware).toBe(false);
    expect(x.constats.get('919104')!.exploiteMalware).toBe(false);
    expect(x.ecartes.valeursInvalides).toBe(0);
    const faux = extraireNessus(
      lire(
        SCAN1.replace(
          '<exploited_by_malware>true</exploited_by_malware>',
          '<exploited_by_malware>peut-être</exploited_by_malware>',
        ),
      ),
      [...DEFAUT],
    );
    expect(faux.constats.get('919101')!.exploiteMalware).toBe(false);
    expect(faux.ecartes.valeursInvalides).toBe(1);
    // Seul le booléen part : ni le nom du champ Nessus, ni sa valeur brute.
    const envoye = JSON.stringify(decouperEnLots(x));
    expect(envoye).toContain('"exploiteMalware":true');
    expect(envoye).not.toContain('exploited_by_malware');
    for (const l of decouperEnLots(x)) expect(LotImportNessus.safeParse(l).success).toBe(true);
  });

  it('textes : balises retirées jusqu’au point fixe, casse ignorée, entités décodées, rien qui ressemble à une balise', () => {
    // Entités doublement encodées : décodées puis retirées comme balise, jusqu'au point fixe (comme le script de Tenable).
    expect(texteNettoye('<B>Gras</b> &amp;lt;script&amp;gt;x', 100)).toBe('Gras x');
    expect(texteNettoye('Version &lt; 9.9 &amp; plus', 100)).toBe('Version < 9.9 & plus');
    expect(texteNettoye('<<b>scr<i>ipt>', 100)).toBe('< scr ipt>');
    expect(texteNettoye('a<b sans fin', 100)).toBe('a‹b sans fin');
    expect(texteNettoye('<SCRIPT>x</SCRIPT>y', 100)).toBe('x y');
    expect(texteNettoye('  a​ b\n\tc ', 100)).toBe('a b c');
    expect(texteNettoye('', 10)).toBeNull();
    expect(nomMachine('DOMAINE\\SRV-FICTIF-09')).toBe('srv-fictif-09');
    expect(nomMachine('192.0.2.9')).toBeNull();
    expect(nomMachine('nom avec espace')).toBeNull();
    expect(instantHote('1794988800', null)).toBe('2026-11-18T08:00:00.000Z');
    expect(instantHote(null, 'Pas une date')).toBeNull();
    expect(datePublication('2026/02/30')).toBeNull();
    expect(datePublication('2026/02/28')).toBe('2026-02-28T00:00:00.000Z');
  });
});

describe('lots de machines entières', () => {
  /** Scan fictif généré : n machines, chacune avec deux contrôles parmi dix. */
  const genere = (n: number) => {
    const hotes = Array.from({ length: n }, (_, i) => {
      const items = [0, 1]
        .map((j) => {
          const p = 918000 + ((i + j) % 10);
          return `<ReportItem port="${443 + j}" protocol="tcp" severity="4" pluginID="${p}" pluginName="Fictional flaw ${p}" pluginFamily="Misc."><synopsis>Invented.</synopsis><plugin_output>SORTIE-BRUTE</plugin_output><cve>CVE-2026-9${p - 900000}</cve></ReportItem>`;
        })
        .join('');
      return `<ReportHost name="198.51.100.${(i % 250) + 1}"><HostProperties><tag name="host-fqdn">srv-fictif-${i}.example.org</tag></HostProperties>${items}</ReportHost>`;
    });
    return `<?xml version="1.0"?><NessusClientData_v2><Report name="g">${hotes.join('')}</Report></NessusClientData_v2>`;
  };

  it('une machine n’est jamais coupée ; chaque lot porte ses contrôles, revalidé par le schéma de l’API', () => {
    const x = extraireNessus(lire(genere(450)), [...DEFAUT]);
    const lots = decouperEnLots(x);
    expect(lots.map((l) => l.machines.length)).toEqual([200, 200, 50]);
    for (const l of lots) {
      expect(LotImportNessus.safeParse(l).success).toBe(true);
      expect(new TextEncoder().encode(JSON.stringify(l)).length).toBeLessThanOrEqual(NESSUS_BORNES.octetsParLot);
    }
    expect(lots.flatMap((l) => l.machines.map((m) => m.machine.nom))).toEqual(
      Array.from({ length: 450 }, (_, i) => `srv-fictif-${i}.example.org`),
    );
  });

  it('textes du bilan et de la progression', () => {
    const b = BilanImportNessus.parse({
      machinesAnnoncees: 3,
      machines: 3,
      constats: 3,
      detections: 4,
      disparues: 1,
      lots: 1,
      ecartes: extraireNessus(lire(SCAN1), [...DEFAUT]).ecartes,
      gravites: ['critique', 'elevee'],
    });
    expect(resumeBilanImport(b)).toBe(
      'Import : 3 machines sur 3, 3 failles (4 détections) en 1 lot. 1 détection disparue sur les machines scannées. Gravités retenues : Critique, Élevée. Écartés : machines sans adresse ni identifiant : 1 ; contrôles informatifs (jamais rangés) : 2 ; contrôles hors des gravités retenues : 1 ; identifiants CVE mal formés : 1.',
    );
    expect(resumeExecution({ etat: 'recu', resultat: b, erreur: null })).toBe(resumeBilanImport(b));
    expect(resumeExecution({ etat: 'en_cours', resultat: null, erreur: null, operation: 'importer' })).toBe(
      'Import en cours depuis un navigateur…',
    );
    expect(texteProgression(1, 3, 200, 450)).toBe('Lot 2 sur 3 : 200 machines importées sur 450.');
    expect(listeBornee(['a', 'b', 'c'], 2)).toBe('a, b et 1 autres');
    expect(listeBornee([])).toBe('aucune');
  });
});

describe('carte « Intégrations » : type sans adresse ni clé', () => {
  const type = catalogueIntegrations().find((t) => t.id === 'nessus-fichier')!;
  const instance: IntegrationDto = {
    id: '00000000-0000-4000-8000-0000000000f1',
    type: 'nessus-fichier',
    nom: 'Nessus fictif',
    smsiId: null,
    configuration: { gravites: ['critique', 'elevee'] },
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
  const rien = () => undefined;

  it('tuile du catalogue et de l’instance : « Importer un scan », ni test de connexion ni synchronisation', () => {
    expect(rendre(createElement(TuileType, { t: type, peutAjouter: true, onAjouter: rien }))).toContain(
      'import de fichier, sans réseau',
    );
    const html = rendre(
      createElement(TuileInstance, {
        i: instance,
        t: type,
        fluxOuvert: fluxOuvertInstance(undefined, 'nessus-fichier', type),
        peutAdministrer: true,
        peutLancer: true,
        enCours: false,
        onConfigurer: rien,
        onActiver: rien,
        onTester: rien,
        onSynchroniser: rien,
        onImporter: rien,
        onExecutions: rien,
      }),
    );
    expect(html).toContain('aria-label="Importer un scan dans Nessus fictif"');
    expect(html).toContain('Désactiver');
    expect(html).not.toContain('Tester la connexion');
    expect(html).not.toContain('Synchroniser maintenant');
    expect(html).not.toContain('Flux fermé');
    expect(html).toContain('gravités retenues : Critique, Élevée');
    // Sans le droit d'administrer : pas de bouton d'import.
    expect(
      rendre(
        createElement(TuileInstance, {
          i: instance,
          t: type,
          fluxOuvert: true,
          peutAdministrer: false,
          peutLancer: true,
          enCours: false,
          onConfigurer: rien,
          onActiver: rien,
          onTester: rien,
          onImporter: rien,
          onExecutions: rien,
        }),
      ),
    ).not.toContain('Importer un scan');
  });

  it('lot N2 : « Supprimer ce connecteur et tout ce qu’il a importé », pour ce type et avec le droit d’administrer seulement', () => {
    const tuile = (i: IntegrationDto, t: typeof type | undefined, peutAdministrer: boolean) =>
      rendre(
        createElement(TuileInstance, {
          i,
          t,
          fluxOuvert: true,
          peutAdministrer,
          peutLancer: true,
          enCours: false,
          onConfigurer: rien,
          onActiver: rien,
          onTester: rien,
          onImporter: rien,
          onSupprimer: rien,
          onExecutions: rien,
        }),
      );
    expect(LIBELLE_SUPPRESSION).toBe('Supprimer ce connecteur et tout ce qu’il a importé');
    const html = tuile(instance, type, true);
    expect(html).toContain(`aria-label="${LIBELLE_SUPPRESSION} : Nessus fictif"`);
    expect(html).toContain(`>${LIBELLE_SUPPRESSION}<`);
    expect(tuile(instance, type, false)).not.toContain(LIBELLE_SUPPRESSION);
    // Security Center : jamais cette action.
    const tenable = catalogueIntegrations().find((t) => t.id === 'tenable')!;
    expect(
      tuile({ ...instance, type: 'tenable', configuration: { adresse: 'https://tenable.example.org' } }, tenable, true),
    ).not.toContain(LIBELLE_SUPPRESSION);
  });

  it('lot N2 : confirmation explicite, nombres, irréversible, mot à saisir, bouton relié à l’avertissement', () => {
    const n = { machines: 3, failles: 1, detections: 4, imports: 2 };
    expect(lignesSuppression(n)).toEqual(['3 machines', '1 faille (4 détections)', '2 imports et leurs exécutions']);
    const props = {
      instance,
      n,
      onSaisie: rien,
      occupe: false,
      erreur: null,
      onConfirmer: rien,
      onAnnuler: rien,
    };
    const vide = rendre(createElement(ConfirmationSuppression, { ...props, saisie: '' }));
    expect(vide).toContain('Action irréversible');
    expect(vide).toContain('Le connecteur « Nessus fictif » et tout ce qu’il a importé disparaîtront définitivement');
    expect(vide).toContain('3 machines');
    expect(vide).toContain(`Saisissez ${MOT_SUPPRESSION} pour confirmer`);
    const bouton = (h: string) => /<button[^>]*>(?:(?!<\/button>).)*Supprimer définitivement/s.exec(h)![0];
    expect(bouton(vide)).toContain('disabled');
    const avertissement = /id="([^"]+-avertissement)"/.exec(vide)![1];
    expect(bouton(vide)).toContain(`aria-describedby="${avertissement}"`);
    const saisi = rendre(createElement(ConfirmationSuppression, { ...props, saisie: MOT_SUPPRESSION }));
    expect(bouton(saisi)).not.toContain('disabled');
    const refus = rendre(
      createElement(ConfirmationSuppression, { ...props, saisie: MOT_SUPPRESSION, erreur: 'Un import est en cours.' }),
    );
    expect(refus).toContain('role="alert"');
    expect(refus).toContain('Un import est en cours.');
  });

  it('formulaire : ni adresse ni fréquence envoyées, gravités seulement', () => {
    const f = formulaireDepuis(null, type);
    expect(erreursFormulaire(f, type)).toEqual([]);
    expect(configurationDepuis(f, type)).toEqual({ gravites: ['critique', 'elevee'] });
    expect(corpsCreation(type, f)).toEqual({
      type: 'nessus-fichier',
      nom: 'Nessus, import de fichier',
      configuration: { gravites: ['critique', 'elevee'] },
    });
    expect(corpsModification(instance, { ...formulaireDepuis(instance, type), gravites: ['critique'] }, type)).toEqual({
      configuration: { gravites: ['critique'] },
    });
    // Un import en cours n'est pas suivi par la carte (la fenêtre d'import s'en charge).
    expect(executionEnCours({ etat: 'en_cours', operation: 'importer' })).toBe(false);
    expect(executionEnCours({ etat: 'en_cours', operation: 'synchroniser' })).toBe(true);
  });

  it('fenêtre d’import : champ de fichier nommé (étiquette reliée), borne et liste blanche annoncées', () => {
    const html = rendre(createElement(ImportNessus, { instance }));
    expect(html).toContain('Fichier .nessus');
    expect(html).toContain('100 Mo au plus');
    expect(html).toContain('accept=".nessus,application/xml,text/xml"');
    expect(html).toContain('ni sortie brute des contrôles, ni description longue');
    expect(html).toContain('Gravités retenues : Critique, Élevée');
    const id = /<label[^>]*for="([^"]+)"[^>]*>Fichier \.nessus<\/label>/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain(`aria-describedby="${id}-description"`);
  });

  it('lot N2 : refus d’un import (limite horaire) dit dans une alerte nommée, rien d’importé', () => {
    expect(MESSAGE_LIMITE_IMPORTS).toBe(
      'Trop d’imports de fichiers commencés (30 par heure). Réessayez dans une heure.',
    );
    const html = rendre(createElement(RefusImport, { id: 'refus-fictif', erreur: MESSAGE_LIMITE_IMPORTS }));
    expect(html).toContain('role="alert"');
    // L'identifiant est porté par le texte (message et conséquence), décrit le bouton « Importer ».
    expect(html).toMatch(/id="refus-fictif"[^>]*>(?:(?!<\/div>).)*Trop d’imports/s);
    expect(html).toContain('Import refusé');
    expect(html).toContain('Trop d’imports de fichiers commencés (30 par heure). Réessayez dans une heure.');
    expect(html).toContain('Aucune machine n’a été importée.');
  });
});
