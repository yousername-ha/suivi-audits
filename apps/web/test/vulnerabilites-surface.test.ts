/* Module Vulnérabilités (ADR 0100, lot ALH1) : écran « Surface externe » (AlgoLightHouse) et formulaire du connecteur. Menu
   conditionné par le droit du module, adresses de recherche et de filtres, libellés, périmètre non relié signalé, textes de
   l'éditeur rendus comme texte simple, liaison des périmètres, bilan d'une synchronisation, formulaire du connecteur limité à
   ses champs (adresse de l'espace chez l'éditeur, délai), aide. Lot ALH2 : priorité des alertes et des technologies,
   tri par priorité, fiche d'une alerte avec les recommandations de l'éditeur rendues comme texte (jamais comme HTML),
   produits surveillés rapprochés. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import {
  type Action,
  type ActifAlhDto,
  type AlerteAlhDto,
  catalogueIntegrations,
  type EtatSurfaceExterneDto,
  type FicheAlerteAlhDto,
  type IntegrationDto,
  type Priorite,
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
  FicheAlerteAlh,
  PerimetresAlhTable,
  TechnologiesAlh,
} from '../src/vulnerabilites/SurfaceExterne';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { ficheFaille } from './fiche-faille-fixture';
import {
  FILTRES_ALERTES_VIDES,
  libelleCible,
  libellePerimetre,
  libelleProduitRapproche,
  libelleSurfaceCve,
  libelleTechnologieRapprochee,
  triDepuis,
  urlFicheAlerteAlh,
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
const P1: Priorite = {
  niveau: 'P1',
  faits: [
    { fait: 'exploitation', sources: ['alh'] },
    { fait: 'presence', presence: 'exposee' },
  ],
};
const P3: Priorite = {
  niveau: 'P3',
  faits: [
    { fait: 'presence', presence: 'exposee' },
    { fait: 'gravite', gravite: 'elevee' },
  ],
};

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
  priorite: P1,
  nombreDefauts: 1,
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
  machinesInternes: { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false },
  versionLiaisons: 1,
  services: [],
  nombreServices: 0,
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
          priorite: P1,
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
  priorite: P1,
  produits: [
    {
      id: '00000000-0000-4000-8000-0000000000c1',
      editeur: 'F5',
      nom: 'Nginx',
      versionProduit: '1.16',
      par: 'nom',
      memeVersion: false,
    },
  ],
};

describe('menu et aide', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('« Surface externe » suit « Machines » et « Périmètres » (lot PC3), avec la lecture du module seulement', () => {
    const rubriques = (droits: string[]) =>
      famillesVisibles(seulement(droits))
        .find((f) => f.famille.id === 'risques')
        ?.destinations.find((d) => d.id === 'vulnerabilites')
        ?.rubriques.map((r) => r.id) ?? [];
    const ids = rubriques(['vulnerabilites:lire']);
    expect(ids.indexOf('vulnerabilites-perimetres')).toBe(ids.indexOf('vulnerabilites-machines') + 1);
    expect(ids.indexOf('vulnerabilites-surface')).toBe(ids.indexOf('vulnerabilites-perimetres') + 1);
    expect(rubriques(['pilotage:lire'])).not.toContain('vulnerabilites-surface');
    expect(localiser('/vulnerabilites/surface-externe')?.rubrique.id).toBe('vulnerabilites-surface');
  });
  it('l’aide dit la lecture seule, la liaison des périmètres et ce qui n’est jamais lu', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-surface')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    const texte = a.steps.join(' ');
    for (const attendu of [
      'lecture seule',
      'non relié',
      'administrer le module',
      'données sensibles',
      'mandataire',
      'Priorité calculée',
      'recommandations de l’éditeur',
      'texte simple',
      '« E-001 »',
    ])
      expect(texte).toContain(attendu);
    expect(HELP_ARTICLES.find((x) => x.id === 'integrations')!.steps.join(' ')).toContain('AlgoLightHouse');
  });
});

describe('adresses et libellés', () => {
  it('recherche et filtres', () => {
    expect(urlAlertesAlh(FILTRES_ALERTES_VIDES)).toBe('/api/vulnerabilites/surface/alertes');
    expect(urlAlertesAlh({ q: ' rdp ', type: 'typosquatting', criticite: 'major', statut: 'toutes', tri: '' }, 2)).toBe(
      '/api/vulnerabilites/surface/alertes?q=rdp&type=typosquatting&criticite=major&statut=toutes&page=2',
    );
    expect(urlAlertesAlh({ ...FILTRES_ALERTES_VIDES, tri: 'priorite' })).toBe(
      '/api/vulnerabilites/surface/alertes?tri=priorite',
    );
    expect(urlActifsAlh('exemple', 'domaine')).toBe('/api/vulnerabilites/surface/actifs?q=exemple&type=domaine');
    expect(urlTechnologiesAlh('', true, 3)).toBe('/api/vulnerabilites/surface/technologies?exploitee=oui&page=3');
    expect(urlTechnologiesAlh('', false, 1, 'priorite')).toBe('/api/vulnerabilites/surface/technologies?tri=priorite');
    expect(urlFicheAlerteAlh('00000000-0000-4000-8000-000000000031')).toBe(
      '/api/vulnerabilites/surface/alertes/00000000-0000-4000-8000-000000000031',
    );
    expect([triDepuis('priorite'), triDepuis('criticite'), triDepuis(null)]).toEqual(['priorite', '', '']);
  });
  it('vue sur la surface externe, produits et technologies rapprochés (lot ALH2)', () => {
    expect(libelleSurfaceCve({ actifs: 1, alertes: 0, horsLecture: false })).toBe(
      'Vue sur la surface externe : 1 actif exposé.',
    );
    // Lot ALH5 : exposée aussi hors de ce que la personne lit, dit sans nom ni nombre.
    expect(libelleSurfaceCve({ actifs: 1, alertes: 0, horsLecture: true })).toBe(
      'Vue sur la surface externe : 1 actif exposé. Exposée aussi sur des actifs que vous ne pouvez pas lire.',
    );
    expect(libelleSurfaceCve({ actifs: 0, alertes: 0, horsLecture: true })).toBe(
      'Exposée sur Internet, sur des actifs que vous ne pouvez pas lire (ni nommés ni comptés).',
    );
    expect(libelleProduitRapproche(techno.produits[0]!)).toBe(
      'F5 Nginx 1.16 (par nom, version différente : à vérifier)',
    );
    expect(
      libelleTechnologieRapprochee({
        id: techno.id,
        nom: 'nginx',
        editeur: 'F5',
        produit: 'nginx',
        versions: ['1.18.0'],
        actifs: 2,
        par: 'cpe',
        memeVersion: true,
      }),
    ).toBe('F5 nginx 1.18.0 sur 2 actifs exposés (par identifiant CPE, même version)');
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
      frequenceHeures: 24,
      prochaineSynchronisation: null,
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
  it('alertes : textes de l’éditeur en texte simple, priorité, criticité, cible, périmètre', () => {
    const html = rendre(createElement(AlertesAlhTable, { alertes: [alerte(), alerte({ id: 'x', priorite: null })] }));
    expect(html).toContain('Exposed RDP service &lt;b&gt;(fictif)&lt;/b&gt;');
    expect(html).not.toContain('<b>(fictif)');
    for (const t of [
      'P1',
      'Exploitation avérée (AlgoLightHouse)',
      'Exposée sur Internet (AlgoLightHouse)',
      'Sans CVE',
      '1 recommandation de l’éditeur',
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
    for (const t of ['198.51.100.20', 'Surveillé', 'AS64500', 'CDN', '(non relié)', 'Machine interne', 'À relier'])
      expect(a).toContain(t);
    const t = rendre(createElement(TechnologiesAlh, { technologies: [techno] }));
    for (const x of [
      'nginx',
      '1.18.0',
      '192.0.2.10',
      'CVE-2026-92001',
      'EPSS 42 %',
      'exploitée',
      'Plus détectée sur 1 actif',
      'P1',
      'Produit surveillé : F5 Nginx 1.16 (par nom, version différente : à vérifier)',
    ])
      expect(t).toContain(x);
    expect(rendre(createElement(EtatSurface, { etats: [] }))).toContain('Aucune instance AlgoLightHouse');
  });
  it('fiche d’une alerte : CVE et priorité, recommandations de l’éditeur en texte, jamais en HTML', () => {
    const fiche: FicheAlerteAlhDto = {
      ...alerte(),
      cvesDetail: [
        {
          cve: 'CVE-2026-91001',
          priorite: P3,
          sources: {
            exploitation: [],
            exploitable: [],
            valeurs: { gravites: [], cvss: [], epss: [] },
            certSante: null,
          },
        },
      ],
      defauts: [
        {
          nom: 'Exposed port <img src=x onerror=alert(1)>',
          description: 'Service <script>alert(1)</script> exposé.',
          resolutions: [
            {
              nom: 'Restrict access',
              description: '<b>Filtrer</b> par adresse IP.',
              facilite: 'Quick Win',
              gain: 'Strong',
            },
          ],
        },
      ],
      services: [
        {
          port: 443,
          protocole: 'tcp',
          nom: 'https',
          produit: 'nginx',
          version: '1.18',
          editeur: 'F5',
          cpe: 'cpe:/a:f5:nginx:1.18',
          statutVersion: 'eol',
        },
        {
          port: 8443,
          protocole: null,
          nom: null,
          produit: '<b>nginx</b>',
          version: null,
          editeur: null,
          cpe: null,
          statutVersion: null,
        },
      ],
    };
    // Lot PC4 : les défauts et résolutions de l'éditeur sont rendus par la fiche illustrée commune, placée au-dessus du
    // détail de l'alerte.
    const html =
      rendre(createElement(FicheAlerteAlh, { a: fiche })) +
      rendre(
        createElement(FicheFailleIllustree, {
          f: ficheFaille({
            nature: 'alerte-alh',
            recommandations: { alh: [{ alerteId: fiche.id, titre: fiche.titre, defauts: fiche.defauts }] },
          }),
        }),
      );
    for (const x of [
      'Priorité calculée par la plateforme',
      'P3',
      'Recommandations de l’éditeur',
      'Restrict access',
      'facilité : Quick Win · gain : Strong',
      'Exposed port &lt;img src=x onerror=alert(1)&gt;',
      'Service &lt;script&gt;alert(1)&lt;/script&gt; exposé.',
      '&lt;b&gt;Filtrer&lt;/b&gt; par adresse IP.',
      // Lot ALH6 : services de l'alerte, termes exacts ; protocole jamais inventé ; texte de l'éditeur jamais en HTML.
      'Services portés par l’alerte',
      'Service (port/protocole · service)',
      '443/tcp · HTTPS',
      'nginx 1.18',
      'éditeur : F5 · version en fin de vie',
      'cpe:/a:f5:nginx:1.18',
      '8443',
      'protocole non communiqué',
      '&lt;b&gt;nginx&lt;/b&gt;',
    ])
      expect(html).toContain(x);
    expect(html).not.toMatch(/<img|<script|<b>Filtrer|<b>nginx|8443\/tcp/i);
    const vide = rendre(createElement(FicheAlerteAlh, { a: { ...fiche, cvesDetail: [], defauts: [], detail: false } }));
    expect(vide).toContain('Détail pas encore lu');
    expect(vide).toContain('Aucune CVE citée par l’éditeur');
    expect(rendre(createElement(FicheAlerteAlh, { a: { ...fiche, services: [] } }))).toContain(
      'Port non communiqué : le détail de l’alerte ne donne aucun service',
    );
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
      frequenceHeures: 24,
    });
    const i: IntegrationDto = {
      id: integration.id,
      type: 'algolighthouse',
      nom: integration.nom,
      smsiId: null,
      configuration: { adresse: 'https://espace-fictif.algolighthouse.fr', delaiSecondes: 30 },
      actif: true,
      secrets: { cleApi: true },
      frequenceHeures: 24,
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
