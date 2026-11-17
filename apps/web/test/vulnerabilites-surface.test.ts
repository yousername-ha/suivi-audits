/* Module Vulnérabilités (ADR 0100, lot ALH1) : écran « Surface externe » (AlgoLightHouse) et formulaire du connecteur. Menu
   conditionné par le droit du module, adresses de recherche et de filtres, libellés, périmètre non relié signalé, textes de
   l'éditeur rendus comme texte simple, liaison des périmètres, bilan d'une synchronisation, formulaire du connecteur limité à
   ses champs (adresse de l'espace chez l'éditeur, délai), aide. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import {
  type Action,
  type ActifAlhDto,
  type AlerteAlhDto,
  catalogueIntegrations,
  type EtatSurfaceExterneDto,
  type IntegrationDto,
  type Module,
  type PerimetreAlhDto,
  type TechnologieAlhDto,
} from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { TuileInstance } from '../src/integrations/IntegrationsPage';
import {
  configurationDepuis,
  corpsCreation,
  corpsModification,
  erreursFormulaire,
  formulaireDepuis,
  resumeExecution,
} from '../src/integrations/integrations';
import { famillesVisibles, localiser } from '../src/navigation';
import {
  ActifsAlhTable,
  AlertesAlhTable,
  EtatSurface,
  PerimetresAlhTable,
  TechnologiesAlh,
} from '../src/vulnerabilites/SurfaceExterne';
import {
  FILTRES_ALERTES_VIDES,
  libelleCible,
  libellePerimetre,
  pourcentage,
  resumeEtatAlh,
  urlActifsAlh,
  urlAlertesAlh,
  urlTechnologiesAlh,
} from '../src/vulnerabilites/surface';

const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const rien = () => undefined;
const ALH = catalogueIntegrations().find((t) => t.id === 'algolighthouse')!;
const integration = { id: '00000000-0000-4000-8000-0000000000a2', nom: 'AlgoLightHouse fictif' };

const alerte = (a: Partial<AlerteAlhDto> = {}): AlerteAlhDto => ({
  id: '00000000-0000-4000-8000-000000000031',
  type: 'vulnerable_service',
  criticite: 'critical',
  statut: 'untreated',
  titre: 'Exposed RDP service <b>(fictif)</b>',
  verifiee: true,
  detail: true,
  cible: { type: 'host', valeur: '192.0.2.10' },
  cves: ['CVE-2026-91001'],
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: null,
  termineeLe: null,
  perimetreAlh: 'Périmètre ALH fictif 1',
  perimetreNom: 'Périmètre fictif A',
  integration,
  ...a,
});
const actif = (x: Partial<ActifAlhDto> = {}): ActifAlhDto => ({
  id: '00000000-0000-4000-8000-000000000011',
  type: 'hote',
  valeur: '198.51.100.20',
  statut: 'monitored',
  adresse: null,
  fai: 'FAI fictif',
  asn: '64500',
  pays: 'FR',
  cdn: true,
  mutualise: false,
  joignable: true,
  joignableLe: null,
  niveau: null,
  alertesOuvertes: 2,
  technologies: 1,
  creeLe: null,
  majLe: null,
  perimetreAlh: 'Périmètre ALH fictif 2',
  perimetreNom: null,
  integration,
  ...x,
});
const techno: TechnologieAlhDto = {
  id: '00000000-0000-4000-8000-000000000041',
  nom: 'nginx',
  editeur: 'F5',
  produit: 'Nginx',
  technologie: null,
  derniere: null,
  tronquee: false,
  versions: [
    {
      version: '1.18.0',
      actifs: [{ type: 'hote', libelle: '192.0.2.10' }],
      cves: [
        {
          cve: 'CVE-2026-92001',
          titre: 'Faille fictive',
          cvss: 7.5,
          epss: 0.42,
          severite: 'high',
          preuve: true,
          exploitee: true,
          publieeLe: null,
        },
      ],
    },
  ],
  actifsInactifs: 1,
  nombreCves: 1,
  exploitees: 1,
  preuves: 1,
  cvssMax: 7.5,
  integration,
};

describe('menu et aide', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('« Surface externe » suit « Machines », avec la lecture du module seulement', () => {
    const rubriques = (droits: string[]) =>
      famillesVisibles(seulement(droits))
        .find((f) => f.famille.id === 'risques')
        ?.destinations.find((d) => d.id === 'vulnerabilites')
        ?.rubriques.map((r) => r.id) ?? [];
    const ids = rubriques(['vulnerabilites:lire']);
    expect(ids.indexOf('vulnerabilites-surface')).toBe(ids.indexOf('vulnerabilites-machines') + 1);
    expect(rubriques(['pilotage:lire'])).not.toContain('vulnerabilites-surface');
    expect(localiser('/vulnerabilites/surface-externe')?.rubrique.id).toBe('vulnerabilites-surface');
  });
  it('l’aide dit la lecture seule, la liaison des périmètres et ce qui n’est jamais lu', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-surface')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    const texte = a.steps.join(' ');
    for (const attendu of ['lecture seule', 'non relié', 'administrer le module', 'données sensibles', 'mandataire'])
      expect(texte).toContain(attendu);
    expect(HELP_ARTICLES.find((x) => x.id === 'integrations')!.steps.join(' ')).toContain('AlgoLightHouse');
  });
});

describe('adresses et libellés', () => {
  it('recherche et filtres', () => {
    expect(urlAlertesAlh(FILTRES_ALERTES_VIDES)).toBe('/api/vulnerabilites/surface/alertes');
    expect(urlAlertesAlh({ q: ' rdp ', type: 'typosquatting', criticite: 'major', statut: 'toutes' }, 2)).toBe(
      '/api/vulnerabilites/surface/alertes?q=rdp&type=typosquatting&criticite=major&statut=toutes&page=2',
    );
    expect(urlActifsAlh('exemple', 'domaine')).toBe('/api/vulnerabilites/surface/actifs?q=exemple&type=domaine');
    expect(urlTechnologiesAlh('', true, 3)).toBe('/api/vulnerabilites/surface/technologies?exploitee=oui&page=3');
  });
  it('cible, périmètre non relié, EPSS en pourcentage', () => {
    expect(libelleCible(alerte())).toBe('Hôte : 192.0.2.10');
    expect(libelleCible(alerte({ cible: null, detail: false }))).toMatch(/non lue/);
    expect(libellePerimetre({ perimetreNom: null, perimetreAlh: 'Périmètre ALH fictif 2' })).toBe(
      'Périmètre ALH fictif 2 (non relié)',
    );
    expect(pourcentage(0.42)).toBe('42 %');
    expect(pourcentage(null)).toBe('—');
  });
  it('état d’une instance : échec, incomplète, périmètres non reliés pour l’administration', () => {
    const e = (x: Partial<EtatSurfaceExterneDto>): EtatSurfaceExterneDto => ({
      integrationId: integration.id,
      nom: integration.nom,
      actif: true,
      derniere: null,
      derniereCompleteLe: null,
      perimetresNonRelies: null,
      ...x,
    });
    expect(resumeEtatAlh(e({})).libelle).toBe('Jamais synchronisé');
    const bilan = {
      elements: 9,
      perimetres: 2,
      hotes: 2,
      domaines: 1,
      alertes: 3,
      details: 3,
      technologies: 1,
      ecartes: 0,
      tronque: true,
    };
    const r = resumeEtatAlh(
      e({
        perimetresNonRelies: 2,
        derniere: {
          id: 'x',
          etat: 'recu',
          origine: 'planifie',
          demandeLe: '2026-11-17T08:00:00.000Z',
          termineLe: null,
          bilan,
          erreur: null,
        },
      }),
    );
    expect(r).toMatchObject({ libelle: 'Synchronisation incomplète', etat: 'attention' });
    expect(r.detail).toMatch(/3 alertes.*2 périmètres AlgoLightHouse ne sont pas reliés/);
    expect(resumeExecution({ etat: 'recu', resultat: bilan, erreur: null })).toMatch(
      /^Synchronisation reçue : 3 alertes/,
    );
  });
});

describe('rendu', () => {
  it('alertes : textes de l’éditeur en texte simple, criticité, cible, périmètre', () => {
    const html = rendre(createElement(AlertesAlhTable, { alertes: [alerte()] }));
    expect(html).toContain('Exposed RDP service &lt;b&gt;(fictif)&lt;/b&gt;');
    expect(html).not.toContain('<b>(fictif)');
    for (const t of [
      'Critique',
      'Service vulnérable',
      'Hôte : 192.0.2.10',
      'CVE-2026-91001',
      'Non traitée',
      'Périmètre fictif A',
    ])
      expect(html).toContain(t);
    expect(rendre(createElement(AlertesAlhTable, { alertes: [] }))).toContain('Aucune alerte ne correspond');
  });
  it('actifs, technologies et état', () => {
    const a = rendre(createElement(ActifsAlhTable, { actifs: [actif()] }));
    for (const t of ['198.51.100.20', 'Surveillé', 'AS64500', 'CDN', '(non relié)']) expect(a).toContain(t);
    const t = rendre(createElement(TechnologiesAlh, { technologies: [techno] }));
    for (const x of [
      'nginx',
      '1.18.0',
      '192.0.2.10',
      'CVE-2026-92001',
      'EPSS 42 %',
      'exploitée',
      'Plus détectée sur 1 actif',
    ])
      expect(t).toContain(x);
    expect(rendre(createElement(EtatSurface, { etats: [] }))).toContain('Aucune instance AlgoLightHouse');
  });
  it('liaison des périmètres : un sélecteur nommé par périmètre, « non relié » signalé', () => {
    const p: PerimetreAlhDto = {
      id: '00000000-0000-4000-8000-000000000051',
      nom: 'Périmètre ALH fictif 1',
      perimetreId: null,
      perimetreNom: null,
      present: true,
      alertes: 2,
      actifs: 3,
      version: 1,
      majPar: null,
      majLe: '2026-11-17T08:00:00.000Z',
      integration,
    };
    const html = rendre(
      createElement(PerimetresAlhTable, {
        perimetres: [p],
        options: [{ id: '00000000-0000-4000-8000-0000000000f1', nom: 'Périmètre fictif A' }],
        enCours: null,
        onLier: rien,
      }),
    );
    expect(html).toContain('Périmètre de la plateforme pour Périmètre ALH fictif 1');
    expect(html).toContain('Non relié : visible de l’administration du module seulement.');
    expect(html).toContain('2 alertes · 3 actifs');
  });
});

describe('formulaire du connecteur AlgoLightHouse', () => {
  it('adresse de l’espace chez l’éditeur, délai ; ni autorité ni gravités envoyées', () => {
    const f = { ...formulaireDepuis(null, ALH), adresse: 'https://espace-fictif.algolighthouse.fr' };
    expect(erreursFormulaire(f, ALH)).toEqual([]);
    expect(erreursFormulaire({ ...f, adresse: 'https://tenable.exemple.test' }, ALH)[0]).toMatch(/algolighthouse\.fr/);
    expect(erreursFormulaire({ ...f, gravites: [] }, ALH)).toEqual([]);
    expect(configurationDepuis(f, ALH)).toEqual({
      adresse: 'https://espace-fictif.algolighthouse.fr',
      delaiSecondes: 30,
    });
    expect(corpsCreation(ALH, f)).toEqual({
      type: 'algolighthouse',
      nom: 'AlgoLightHouse',
      configuration: { adresse: 'https://espace-fictif.algolighthouse.fr', delaiSecondes: 30 },
    });
    const i: IntegrationDto = {
      id: integration.id,
      type: 'algolighthouse',
      nom: integration.nom,
      smsiId: null,
      configuration: { adresse: 'https://espace-fictif.algolighthouse.fr', delaiSecondes: 30 },
      actif: true,
      secrets: { cleApi: true },
      version: 2,
      createdBy: 'admin-fictif',
      createdAt: '2026-11-17T08:00:00.000Z',
      updatedBy: 'admin-fictif',
      updatedAt: '2026-11-17T08:00:00.000Z',
      derniereExecution: null,
    };
    expect(corpsModification(i, formulaireDepuis(i, ALH), ALH)).toEqual({});
    expect(corpsModification(i, { ...formulaireDepuis(i, ALH), delaiSecondes: 10 }, ALH)).toEqual({
      configuration: { adresse: 'https://espace-fictif.algolighthouse.fr', delaiSecondes: 10 },
    });
    const html = rendre(
      createElement(TuileInstance, {
        i,
        t: ALH,
        fluxOuvert: true,
        peutAdministrer: true,
        peutLancer: true,
        enCours: false,
        onConfigurer: rien,
        onActiver: rien,
        onTester: rien,
        onSynchroniser: rien,
        onExecutions: rien,
      }),
    );
    expect(html).toContain('Clé d’API : Défini');
    expect(html).toContain('Surface externe');
    expect(html).not.toContain('gravités');
  });
});
