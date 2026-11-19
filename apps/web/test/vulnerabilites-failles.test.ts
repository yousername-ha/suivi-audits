/* Module Vulnérabilités (ADR 0100, lot V5) : écrans « Failles détectées » et « Machines ». Menu conditionné par le droit du
   module, adresses de recherche et de filtres, marques (exploitée, exploitable, non maintenu), fiche (CVE, vecteur CVSS et
   correctif tels quels, machines par rôle, lien « voir aussi » contrôlé), textes de Tenable rendus comme texte simple,
   affectation en masse (versions jointes), bandeau des machines sans rôle. Lot V4d : origine du périmètre d'une machine
   (hérité du dépôt ou indiqué à la main), dépôts de Tenable et leur liaison. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { Action, ConstatDto, ConstatResumeDto, DepotTenableDto, MachineDto, Module } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { famillesVisibles, localiser } from '../src/navigation';
import { ConstatsTable, EtatSynchronisations, FicheConstat } from '../src/vulnerabilites/FaillesDetectees';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { ficheFaille } from './fiche-faille-fixture';
import { BandeauSansRole, DepotsTenableTable, MachinesTable } from '../src/vulnerabilites/Machines';
import {
  corpsAffectation,
  FILTRES_CONSTATS_VIDES,
  FILTRES_MACHINES_VIDES,
  groupesParRole,
  libelleEpssTenable,
  libelleMachine,
  lienVoirAussi,
  marquesConstat,
  originePerimetre,
  resumeCves,
  urlConstats,
  urlDeclarees,
  urlMachines,
} from '../src/vulnerabilites/failles';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const rien = () => undefined;

const resume = (c: Partial<ConstatResumeDto> = {}): ConstatResumeDto => ({
  id: '00000000-0000-4000-8000-000000000c01',
  plugin: '900001',
  nom: 'Exemple Linux : noyau (EX-2026-0001)',
  gravite: 'critique',
  famille: 'Misc.',
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.0056,
  exploitable: true,
  exploite: true,
  nonMaintenu: false,
  finSupportLe: null,
  finDeSupport: false,
  correctifEtat: { etat: 'non_renseigne', sources: [] },
  nombreCves: 7,
  cves: ['CVE-2026-90005', 'CVE-2026-90004'],
  machines: 3,
  derniereDetection: '2026-11-16T06:04:48.000Z',
  present: true,
  alerteCertFr: false,
  sources: {
    exploitation: [{ source: 'kev', le: '2026-11-13T00:00:00.000Z' }],
    exploitable: [{ source: 'tenable', le: null }],
    valeurs: {
      gravites: [{ source: 'tenable', gravite: 'critique' }],
      cvss: [{ source: 'tenable', score: 9.1 }],
      epss: [],
    },
    certSante: null,
  },
  priorite: {
    niveau: 'P1',
    faits: [
      { fait: 'exploitation', sources: ['kev'] },
      { fait: 'presence', presence: 'detectee' },
    ],
  },
  suivi: {
    etat: 'nouvelle',
    proposition: 'aucune',
    revueLe: null,
    revueDepassee: false,
    exceptionStatut: null,
    nombreActions: 0,
    version: 0,
  },
  delai: {
    etat: 'dans_les_delais' as const,
    priorite: 'P2' as const,
    delai: { duree: 15, unite: 'jours' as const },
    premiere: '2026-11-10T08:00:00.000Z',
    depuis: '2026-11-10T08:00:00.000Z',
    echeance: '2026-11-25T08:00:00.000Z',
  },
  ...c,
});
const machineDetection = (nom: string | null, role: 'front' | 'back' | 'bdd' | null) => ({
  machineId: `00000000-0000-4000-8000-0000000000${nom ? nom.length : 99}`,
  nom,
  adresse: '192.0.2.10',
  role,
  perimetreId: null,
  perimetreNom: 'Périmètre fictif',
  port: 443,
  protocole: 'TCP',
  premiere: null,
  derniere: null,
  attenue: false,
  risqueAccepte: true,
  risqueRequalifie: false,
});
const fiche = (c: Partial<ConstatDto> = {}): ConstatDto => ({
  ...resume(),
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: 'AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H',
  exploitLibelle: 'Exploits are available',
  failleLe: null,
  correctifLe: null,
  voirAussi: 'https://example.org/advisory',
  cvesTronquees: false,
  cvesDetail: [
    { cve: 'CVE-2026-90002', kev: true },
    { cve: 'CVE-2026-90001', kev: false },
  ],
  parRole: {
    front: [machineDetection('web-01.exemple.invalid', 'front')],
    back: [],
    bdd: [machineDetection('bdd-01.exemple.invalid', 'bdd')],
    aucun: [machineDetection(null, null)],
  },
  integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif' },
  ...c,
});
const machine = (m: Partial<MachineDto> = {}): MachineDto => ({
  id: '00000000-0000-4000-8000-000000000m01'.replace('m', 'a'),
  nom: 'srv-exemple-01.exemple.invalid',
  adresse: '192.0.2.11',
  systeme: 'Linux Kernel 5.14 on Exemple Linux 9',
  role: null,
  perimetreId: null,
  perimetreNom: null,
  perimetreOrigine: null,
  depot: null,
  exposition: 'internal',
  acr: 4,
  premiere: null,
  derniere: null,
  source: 'tenable',
  integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif' },
  compteurs: {
    critique: 2,
    elevee: 1,
    moyenne: 0,
    faible: 0,
    exploites: 1,
    exploitables: 2,
    declarees: 1,
    exploitationAveree: 1,
  },
  rang: {
    position: 2,
    total: 5,
    faits: [
      { fait: 'exploitation', nombre: 1 },
      { fait: 'role', role: null },
      { fait: 'critiques', nombre: 2 },
      { fait: 'elevees', nombre: 1 },
    ],
  },
  finDeSupport: false,
  finsDeSupport: [],
  version: 4,
  ...m,
});

describe('menu et aide', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('« Failles détectées » et « Machines » : Risques > Vulnérabilités, avec la lecture du module seulement', () => {
    const avec = famillesVisibles(seulement(['vulnerabilites:lire']));
    const d = avec.find((f) => f.famille.id === 'risques')!.destinations.find((x) => x.id === 'vulnerabilites')!;
    expect(d.rubriques.map((p) => p.id)).toEqual([
      'vulnerabilites-vue',
      'vulnerabilites-produits',
      'vulnerabilites-veille',
      'vulnerabilites-failles',
      'vulnerabilites-machines',
      'vulnerabilites-perimetres',
      'vulnerabilites-surface',
      'vulnerabilites-alertes',
      'vulnerabilites-delais',
      'vulnerabilites-tendances',
      'vulnerabilites-rapport',
      'vulnerabilites-priorite',
    ]);
    expect(localiser('/vulnerabilites/failles')?.rubrique.id).toBe('vulnerabilites-failles');
    expect(localiser('/vulnerabilites/priorite')?.rubrique.id).toBe('vulnerabilites-priorite');
    expect(localiser('/vulnerabilites/machines')?.rubrique.id).toBe('vulnerabilites-machines');
    // Un droit métier seul n'ouvre pas le module (droits par défaut resserrés, lot V5).
    expect(
      famillesVisibles(seulement(['pilotage:lire', 'audit:lire']))
        .find((f) => f.famille.id === 'risques')
        ?.destinations.map((x) => x.id),
    ).not.toContain('vulnerabilites');
  });
  it('un article d’aide décrit la lecture par périmètre et l’affectation', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-failles')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    const texte = a.steps.join(' ');
    for (const m of [
      'périmètres que vous pouvez lire',
      'non maintenu',
      'catalogue KEV',
      'en anglais',
      'sans nom ni adresse',
      // Lot V4d : dépôts de Tenable.
      'Dépôts Tenable',
      'hérité du dépôt',
      'indiqué à la main',
      'prime',
    ])
      expect(texte).toContain(m);
  });
});

describe('adresses et libellés', () => {
  it('constats : recherche et filtres ; machines : nom, rôle, périmètre', () => {
    expect(urlConstats(FILTRES_CONSTATS_VIDES)).toBe('/api/vulnerabilites/constats');
    expect(
      urlConstats(
        {
          q: ' CVE-2026 ',
          gravite: 'critique',
          exploite: true,
          exploitable: true,
          nonMaintenu: true,
          finSupport: true,
          priorite: 'P2',
          etat: '',
          delai: 'en_depassement',
          tri: 'echeance',
        },
        2,
      ),
    ).toBe(
      '/api/vulnerabilites/constats?q=CVE-2026&gravite=critique&exploite=oui&exploitable=oui&nonMaintenu=oui&finSupport=oui&priorite=P2&delai=en_depassement&tri=echeance&page=2',
    );
    expect(urlConstats({ ...FILTRES_CONSTATS_VIDES, etat: 'a_clore' })).toBe(
      '/api/vulnerabilites/constats?etat=a_clore',
    );
    expect(urlDeclarees({ q: '', priorite: '', etat: 'risque_accepte' })).toBe(
      '/api/vulnerabilites/declarees?etat=risque_accepte',
    );
    expect(urlDeclarees(FILTRES_CONSTATS_VIDES)).toBe('/api/vulnerabilites/declarees');
    expect(urlDeclarees({ q: ' glpi ', priorite: 'P1' }, 2)).toBe(
      '/api/vulnerabilites/declarees?q=glpi&priorite=P1&page=2',
    );
    expect(urlMachines(FILTRES_MACHINES_VIDES)).toBe('/api/vulnerabilites/machines');
    expect(urlMachines({ q: 'srv', role: 'aucun', perimetre: 'aucun' }, 3)).toBe(
      '/api/vulnerabilites/machines?q=srv&role=aucun&perimetre=aucun&page=3',
    );
  });
  it('marques, CVE résumées, EPSS en pourcentage, nom de machine', () => {
    expect(marquesConstat(resume()).map((m) => m.libelle)).toEqual(['Exploitée (KEV)', 'Exploitable']);
    expect(
      marquesConstat(resume({ exploite: false, exploitable: false, nonMaintenu: true })).map((m) => m.libelle),
    ).toEqual(['Non maintenu']);
    expect(resumeCves(resume())).toBe('CVE-2026-90005, CVE-2026-90004 et 5 autres');
    expect(resumeCves(resume({ cves: [], nombreCves: 0 }))).toBe('Aucune CVE');
    expect(libelleEpssTenable(0.0056)).toBe('0,56 %');
    expect(libelleEpssTenable(null)).toBe('—');
    expect(libelleMachine({ nom: null, adresse: '192.0.2.4' })).toBe('192.0.2.4');
    expect(libelleMachine({ nom: null, adresse: null })).toBe('Machine sans nom');
  });
  it('lien « voir aussi » seulement en https ; groupes par rôle dans l’ordre, vides omis', () => {
    expect(lienVoirAussi(fiche())).toBe('https://example.org/advisory');
    expect(lienVoirAussi(fiche({ voirAussi: 'javascript:alert(1)' }))).toBeNull();
    expect(groupesParRole(fiche()).map((g) => g.libelle)).toEqual(['Front', 'Base de données', 'Rôle non renseigné']);
  });
  it('affectation en masse : versions jointes, rôle ou périmètre retiré par « aucun », inchangé si vide', () => {
    const m = [machine(), machine({ id: '00000000-0000-4000-8000-0000000000a2', version: 7 })];
    expect(corpsAffectation(m, 'front', '')).toEqual({
      machines: [
        { id: m[0]!.id, version: 4 },
        { id: m[1]!.id, version: 7 },
      ],
      role: 'front',
    });
    expect(corpsAffectation(m, 'aucun', 'aucun')).toMatchObject({ role: null, perimetreId: null });
    expect(corpsAffectation(m, '', '00000000-0000-4000-8000-000000000001')).toEqual({
      machines: expect.any(Array),
      perimetreId: '00000000-0000-4000-8000-000000000001',
    });
  });
});

describe('rendu', () => {
  it('liste des constats : marques, CVE, nombre de machines ; texte de Tenable en texte simple', () => {
    const html = rendu(
      createElement(ConstatsTable, {
        constats: [resume({ nom: '<img src=x onerror=alert(1)> Exemple' })],
        onOuvrir: rien,
      }),
    );
    expect(html).toContain('Exploitée (KEV)');
    expect(html).toContain('CVE-2026-90005, CVE-2026-90004 et 5 autres');
    // Lot V4a : priorité calculée, ses faits en clair, mention « détecté par Tenable ».
    expect(html).toContain('>P1<');
    expect(html).toContain('Exploitation avérée (catalogue KEV) · Détectée par Tenable');
    expect(html).toContain('Détecté par Tenable');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('<img');
    expect(rendu(createElement(ConstatsTable, { constats: [], onOuvrir: rien }))).toContain('Aucune faille détectée');
  });
  it('fiche : correctif et vecteur tels quels, CVE du KEV marquées, machines par rôle, lien sans référent', () => {
    // Lot PC4 : le correctif de Tenable est rendu par la fiche illustrée commune, placée au-dessus du détail du constat.
    const html =
      rendu(createElement(FicheConstat, { c: fiche() })) +
      rendu(
        createElement(FicheFailleIllustree, {
          f: ficheFaille({
            recommandations: { tenable: { correctif: 'Update the affected packages.', publieLe: null } },
          }),
        }),
      );
    expect(html).toContain('Update the affected packages.');
    expect(html).toContain('AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H');
    expect(html).toContain('CVE-2026-90002 (KEV), CVE-2026-90001');
    expect(html).toContain('Front (1)');
    expect(html).toContain('Base de données (1)');
    expect(html).toContain('Rôle non renseigné (1)');
    expect(html).toContain('web-01.exemple.invalid');
    expect(html).toContain('Risque accepté');
    expect(html).toMatch(
      /href="https:\/\/example\.org\/advisory"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*href="https:\/\/example\.org\/advisory"/,
    );
    const sansCve = rendu(
      createElement(FicheConstat, {
        c: fiche({ cvesDetail: [], nombreCves: 0, cves: [], nonMaintenu: true, voirAussi: null, cvss3Vecteur: null }),
      }),
    );
    expect(sansCve).toContain('plus maintenu');
    expect(sansCve).toContain('Vecteur CVSS non publié.');
    expect(sansCve).not.toContain('Voir aussi');
  });
  it('machines : compteurs par gravité, rôle manquant signalé, cases à cocher seulement pour l’affectation', () => {
    const html = rendu(createElement(MachinesTable, { machines: [machine()] }));
    expect(html).toContain('2 · 1 · 0 · 0');
    // Lot V4a : rang et faits, exploitées, exploitables et déclarées.
    expect(html).toContain('2 / 5');
    expect(html).toContain('1 faille à l’exploitation avérée · Rôle non renseigné · 2 critiques · 1 élevée');
    expect(html).toContain('1 · 2 · 1');
    expect(html).toContain('Rôle non renseigné');
    expect(html).not.toContain('type="checkbox"');
    const choix = rendu(
      createElement(MachinesTable, { machines: [machine()], selection: new Set<string>(), onSelection: rien }),
    );
    expect(choix).toContain('type="checkbox"');
    expect(rendu(createElement(BandeauSansRole, { n: 3 }))).toContain('3 machines lisibles sans rôle');
    expect(rendu(createElement(BandeauSansRole, { n: 0 }))).not.toContain('sans rôle');
  });
  it('machines (lot V4d) : périmètre hérité du dépôt, indiqué à la main, ou dépôt non relié', () => {
    const depot = {
      id: '00000000-0000-4000-8000-0000000000d1',
      nom: 'Dépôt fictif Nord',
      perimetreId: null,
      perimetreNom: null,
    };
    const herite = machine({ perimetreId: 'p', perimetreNom: 'Périmètre fictif A', perimetreOrigine: 'depot', depot });
    const main = machine({ perimetreId: 'p', perimetreNom: 'Périmètre fictif B', perimetreOrigine: 'machine', depot });
    expect(originePerimetre(herite)).toBe('Hérité du dépôt « Dépôt fictif Nord »');
    expect(originePerimetre({ perimetreOrigine: 'depot', depot: null })).toBe('Hérité du dépôt');
    expect(originePerimetre(main)).toBe('Indiqué à la main');
    expect(originePerimetre(machine())).toBeNull();
    const html = rendu(createElement(MachinesTable, { machines: [herite, main, machine({ depot })] }));
    expect(html).toContain('Périmètre fictif A');
    expect(html).toContain('Hérité du dépôt « Dépôt fictif Nord »');
    expect(html).toContain('Indiqué à la main');
    expect(html).toContain('Dépôt « Dépôt fictif Nord » non relié');
    expect(rendu(createElement(MachinesTable, { machines: [machine()] }))).not.toContain('dépôt');
  });
  it('dépôts de Tenable : liaison, machines et exceptions, absence signalée ; liste vide', () => {
    const d = (x: Partial<DepotTenableDto> = {}): DepotTenableDto => ({
      id: '00000000-0000-4000-8000-0000000000d1',
      depotTenable: 11,
      nom: 'Dépôt fictif Nord',
      perimetreId: null,
      perimetreNom: null,
      present: true,
      machines: 3,
      exceptions: 1,
      version: 2,
      majPar: null,
      majLe: '2026-11-17T08:00:00.000Z',
      integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif' },
      ...x,
    });
    const html = rendu(
      createElement(DepotsTenableTable, {
        depots: [
          d(),
          d({
            id: '00000000-0000-4000-8000-0000000000d2',
            nom: '<b>Dépôt</b> fictif Sud',
            present: false,
            machines: 1,
            exceptions: 0,
            perimetreId: '00000000-0000-4000-8000-0000000000f1',
            perimetreNom: 'Périmètre fictif B',
          }),
        ],
        options: [{ id: '00000000-0000-4000-8000-0000000000f2', nom: 'Périmètre fictif A' }],
        enCours: null,
        onLier: rien,
      }),
    );
    expect(html).toContain('Tenable fictif · dépôt 11');
    expect(html).toContain('3 machines');
    expect(html).toContain('dont 1 au périmètre indiqué à la main');
    expect(html).toContain('Non relié : ses machines sans périmètre indiqué à la main');
    expect(html).toContain('absent de la dernière synchronisation complète');
    expect(html).toContain('Périmètre de la plateforme pour Dépôt fictif Nord');
    // Périmètre relié hors des choix de la personne : affiché quand même ; nom du dépôt en texte simple.
    expect(html).toContain('Périmètre fictif B');
    expect(html).toContain('&lt;b&gt;Dépôt&lt;/b&gt; fictif Sud');
    expect(html).not.toContain('<b>Dépôt');
    expect(
      rendu(createElement(DepotsTenableTable, { depots: [], options: [], enCours: null, onLier: rien })),
    ).toContain('Aucun dépôt Tenable');
  });
  it('état des synchronisations : aucune instance, ou dernier bilan', () => {
    // Aucune instance : l'écran le dit et renvoie à la page Plateforme (ADR 0076, addendum du 19/11/2026).
    const vide = rendu(createElement(EtatSynchronisations, { etats: [] }));
    expect(vide).toContain('Aucune instance Tenable Security Center n’est configurée.');
    expect(vide).toContain('page Plateforme');
    expect(vide).not.toContain('Configurer l’intégration');
    const html = rendu(
      createElement(EtatSynchronisations, {
        etats: [
          {
            integrationId: '00000000-0000-4000-8000-0000000000a1',
            nom: 'Tenable fictif',
            actif: true,
            gravites: ['critique', 'elevee'],
            derniere: {
              id: '00000000-0000-4000-8000-0000000000e1',
              etat: 'recu',
              origine: 'planifie',
              demandeLe: '2026-11-16T03:00:00.000Z',
              termineLe: '2026-11-16T03:05:00.000Z',
              bilan: {
                elements: 6,
                pages: 1,
                constats: 1,
                detections: 1,
                machines: 1,
                hotes: 3,
                ecartes: 0,
                tronque: false,
                inventaire: { ok: true, erreur: null },
              },
              erreur: null,
            },
            derniereCompleteLe: '2026-11-16T03:05:00.000Z',
            inventaire: { ok: true, erreur: null, le: '2026-11-16T03:05:00.000Z' },
          },
        ],
      }),
    );
    expect(html).toContain('Tenable fictif');
    expect(html).toContain('1 faille sur 1 machine (1 détection)');
    expect(html).toContain('3 machines lues');
  });
});
