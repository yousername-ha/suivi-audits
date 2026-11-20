/* Lot SI1 (ADR 0100) : surface externe importée de Silène dans l'écran « Surface externe ». Note Silène (note, sous-note,
   familles, date, évolution, pastille) ; liste commune des actifs (une ligne, deux pastilles, ports de Silène et services
   d'AlgoLightHouse réunis sans doublon, source de chaque information nommée ; actif de Silène seul sans liaison possible) ;
   constats (classe « classe N » tant que la correspondance n'est pas connue, aucune priorité) et fiche d'un constat ; fiche
   Silène d'un actif ; liaison d'une instance à un périmètre ; adresses des lectures. Données fictives. */
import { MantineProvider } from '@mantine/core';
import {
  type ActifSurfaceDto,
  CLASSES_SILENE,
  type FicheActifSileneDto,
  type FicheConstatSileneDto,
  fusionnerPortsActif,
  libelleClasseSilene,
  type NoteImportSileneDto,
  type NoteSileneDto,
  type ServiceAlhDto,
} from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ONGLETS_SURFACE } from '../src/vulnerabilites/recherche';
import { ActifsAlhTable } from '../src/vulnerabilites/SurfaceExterne';
import {
  ConstatsSileneTable,
  FicheActifSilene,
  FicheConstatSilene,
  NoteSilene,
  PerimetresSileneTable,
  SILENE_SEUL,
} from '../src/vulnerabilites/SurfaceSilene';
import {
  detailsPortActif,
  horodatageRapport,
  libelleLigneSilene,
  libellePortActif,
  texteEvolution,
  urlConstatsSilene,
  urlFicheActifSilene,
} from '../src/vulnerabilites/surface-silene';

const rendre = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const note = (n: number | null, date: string): NoteImportSileneDto => ({
  date,
  debut: `${date}T06:00:00`,
  fin: `${date}T07:00:00`,
  note: n,
  noteReseau: n === null ? null : n - 1.5,
  vulnreco: 2,
  warning: 1,
  info: 3,
  ok: 40,
  importeLe: `${date}T08:00:00.000Z`,
});
const service = (port: number, protocole: 'tcp' | 'udp' | null, extra: Partial<ServiceAlhDto> = {}): ServiceAlhDto => ({
  port,
  protocole,
  nom: null,
  produit: null,
  version: null,
  editeur: null,
  cpe: null,
  statutVersion: null,
  ...extra,
});
const silene = (
  extra: Partial<NonNullable<ActifSurfaceDto['silene']>> = {},
): NonNullable<ActifSurfaceDto['silene']> => ({
  instances: [{ id: id(90), nom: 'Silène fictif' }],
  perimetreNom: 'Périmètre fictif A',
  adresses: ['192.0.2.10'],
  noms: [{ nom: 'www.example.org', type: 'A' }],
  ports: [
    { port: 22, protocole: 'tcp', service: 'ssh', produit: 'FictionalSSH', tunnel: null },
    { port: 443, protocole: 'tcp', service: 'https', produit: 'Fictional httpd', tunnel: 'ssl' },
  ],
  nombrePorts: 2,
  portsOuverts: 2,
  produits: [],
  controles: ['OpenPort'],
  constats: 1,
  ...extra,
});
const actif = (x: Partial<ActifSurfaceDto>): ActifSurfaceDto => ({
  id: id(1),
  type: 'hote',
  valeur: '192.0.2.10',
  statut: 'monitored',
  adresse: null,
  fai: null,
  asn: null,
  pays: null,
  cdn: null,
  mutualise: null,
  joignable: null,
  joignableLe: null,
  niveau: null,
  alertesOuvertes: 1,
  technologies: 0,
  creeLe: null,
  majLe: null,
  perimetreAlh: 'Périmètre ALH fictif',
  perimetreNom: 'Périmètre fictif A',
  integration: { id: id(80), nom: 'AlgoLightHouse fictif' },
  machinesInternes: { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false },
  versionLiaisons: 1,
  services: [service(443, 'tcp', { nom: 'https', produit: 'nginx', version: '1.18' })],
  nombreServices: 1,
  sources: ['alh', 'silene'],
  alhId: id(1),
  silene: silene(),
  ...x,
});

describe('note Silène', () => {
  it('note, sous-note réseau, familles, date, évolution, pastille de source', () => {
    const n: NoteSileneDto = {
      integrationId: id(90),
      nom: 'Silène fictif',
      actif: true,
      perimetreNom: null,
      courante: note(16.25, '2026-11-18'),
      precedente: note(14.5, '2026-11-15'),
      historique: [note(16.25, '2026-11-18'), note(14.5, '2026-11-15')],
      hotes: 2,
      constats: 3,
      perimetre: { domaines: 1, plages: 3 },
      derniere: null,
    };
    const html = rendre(
      createElement(MemoryRouter, null, createElement(NoteSilene, { notes: [n], peutConfigurer: true })),
    );
    for (const t of [
      'aria-label="Note Silène"',
      'data-source="silene"',
      'Note : <strong>16,25</strong>',
      'sous-note réseau : <strong>14,75</strong>',
      'rapport du 18/11/2026',
      '+1,75 depuis le rapport du 15/11/2026 (14,5 auparavant).',
      'Vulnérabilités ou recommandations (vulnreco) : 2',
      'Conformes (ok) : 40',
      'non relié (administration du module seulement)',
    ])
      expect(html).toContain(t);
    // Un seul lien « Configurer l'intégration » par écran : celui de l'état d'AlgoLightHouse.
    expect(html).not.toContain('Configurer l’intégration');
    expect(rendre(createElement(NoteSilene, { notes: [], peutConfigurer: true }))).toContain(
      'Ajoutez « Silène, import de fichier » dans la carte « Intégrations »',
    );
    expect(rendre(createElement(NoteSilene, { notes: [] }))).toContain('Aucune instance Silène que vous pouvez lire.');
    expect(texteEvolution(note(14.5, '2026-11-18'), null)).toBe('Premier rapport importé : pas encore d’évolution.');
    expect(texteEvolution(note(12, '2026-11-18'), note(14.5, '2026-11-15'))).toBe(
      '−2,5 depuis le rapport du 15/11/2026 (14,5 auparavant).',
    );
    expect(texteEvolution(note(null, '2026-11-18'), note(14.5, '2026-11-15'))).toContain('non calculable');
  });
});

describe('liste commune des actifs', () => {
  it('une ligne, deux pastilles, ports réunis sans doublon et source nommée ; Silène seul sans liaison', () => {
    const html = rendre(
      createElement(ActifsAlhTable, {
        actifs: [
          actif({}),
          actif({
            id: id(2),
            valeur: '203.0.113.30',
            statut: null,
            alertesOuvertes: 0,
            perimetreAlh: null,
            services: [],
            nombreServices: 0,
            sources: ['silene'],
            alhId: null,
            silene: silene({ adresses: ['203.0.113.30'], ports: [], nombrePorts: 0, portsOuverts: 0 }),
          }),
        ],
      }),
    );
    for (const t of [
      'aria-label="Sources"',
      'aria-label="Source : AlgoLightHouse"',
      'aria-label="Source : Silène (ANSSI)"',
      '22/tcp · SSH',
      '443/tcp · HTTPS',
      'Silène : Fictional httpd, tunnel ssl',
      'AlgoLightHouse : nginx 1.18',
      '2 ports ouverts selon Silène',
      SILENE_SEUL,
      'Aucun port ouvert connu',
    ])
      expect(html).toContain(t);
    // 443/tcp une seule fois, malgré les deux sources.
    expect(html.split('443/tcp · HTTPS').length - 1).toBe(1);
  });

  it('nom de domaine vu par Silène : les ports de l’hôte restent sur la ligne de l’hôte, la ligne dit qui le porte', () => {
    const html = rendre(
      createElement(ActifsAlhTable, {
        actifs: [actif({ type: 'domaine', valeur: 'www.example.org', services: [], nombreServices: 0 })],
      }),
    );
    expect(html).toContain('Selon Silène, porté par 192.0.2.10');
    expect(html).not.toContain('22/tcp · SSH');
    expect(html).not.toContain('ports ouverts selon Silène');
  });

  it('réunion des ports : un service sans protocole rejoint le seul port de même numéro ; tri par port', () => {
    const p = fusionnerPortsActif(
      [service(8443, null, { nom: 'https-alt' }), service(25, 'tcp', { nom: 'smtp' })],
      [{ port: 8443, protocole: 'tcp', service: null, produit: null, tunnel: null }],
    );
    expect(p.map(libellePortActif)).toEqual(['25/tcp · SMTP', '8443/tcp · HTTPS-ALT']);
    expect(detailsPortActif(p[1]!)).toEqual([
      { source: 'silene', texte: 'Silène : port ouvert' },
      { source: 'alh', texte: 'AlgoLightHouse : service porté par une alerte' },
    ]);
  });

  it('fiche Silène d’un actif : ports, noms, produits non rapprochés des CVE, constats', () => {
    const fiche: FicheActifSileneDto = {
      ...silene({
        produits: [{ type: 'a', editeur: 'fictional', produit: 'httpd', version: '9.9' }],
        portsOuverts: 3,
      }),
      listeConstats: [{ id: id(5), identifiant: 'RES-FICTIF-0001', controle: 'OpenPort', classe: 2 }],
    };
    const html = rendre(createElement(FicheActifSilene, { fiche }));
    for (const t of [
      'Vu par Silène',
      '22/tcp · SSH',
      'Fictional httpd, tunnel ssl',
      'www.example.org',
      'résolution directe (A)',
      'application fictional httpd 9.9',
      'Ces produits ne sont pas encore rapprochés des CVE.',
      'OpenPort (classe 2)',
      '2 ports ouverts selon Silène (3 annoncés)',
    ])
      expect(html).toContain(t);
  });
});

describe('constats Silène', () => {
  it('classe affichée « classe N » tant que la correspondance n’est pas confirmée ; aucune priorité', () => {
    expect(CLASSES_SILENE).toEqual({});
    expect(libelleClasseSilene(3)).toBe('classe 3');
    const c = {
      id: id(7),
      identifiant: 'RES-FICTIF-0001',
      controle: 'OpenPort',
      classe: 2,
      points: 10,
      note: null,
      hotes: 2,
      lignes: 2,
      integration: { id: id(90), nom: 'Silène fictif' },
      perimetreNom: null,
    };
    const html = rendre(createElement(ConstatsSileneTable, { constats: [c] }));
    for (const t of ['Constats Silène', 'OpenPort', 'RES-FICTIF-0001', 'classe 2', 'Non relié'])
      expect(html).toContain(t);
    expect(html).not.toMatch(/>P[1-4]</);
    const fiche: FicheConstatSileneDto = {
      ...c,
      parHote: [
        {
          hote: '192.0.2.10',
          lignes: [
            {
              rang: 0,
              port: 8443,
              protocole: 'tcp',
              service: null,
              produit: null,
              nomHote: 'www.example.org',
              type: null,
              echeance: '2026-10-01T00:00:00',
            },
          ],
        },
        { hote: '198.51.100.20', lignes: [] },
      ],
    };
    const f = rendre(createElement(FicheConstatSilene, { c: fiche }));
    for (const t of [
      'Détail par hôte',
      '192.0.2.10',
      '8443/tcp · www.example.org · échéance 01/10/2026 00:00',
      'Concerné, sans détail',
      'un constat Silène n’a pas de CVE',
    ])
      expect(f).toContain(t);
    expect(horodatageRapport(null)).toBe('—');
    expect(libelleLigneSilene({ ...fiche.parHote[0]!.lignes[0]!, port: null, nomHote: null, echeance: null })).toBe(
      'Sans détail',
    );
  });
});

describe('périmètres et adresses', () => {
  it('instance non reliée : visible de l’administration seulement ; sélecteur nommé', () => {
    const html = rendre(
      createElement(PerimetresSileneTable, {
        instances: [
          {
            integrationId: id(90),
            nom: 'Silène fictif',
            perimetreId: null,
            perimetreNom: null,
            hotes: 3,
            constats: 4,
            version: 0,
            majPar: null,
            majLe: null,
          },
        ],
        options: [],
        enCours: null,
        onLier: () => {},
      }),
    );
    for (const t of [
      'Instances Silène',
      'Périmètre de la plateforme pour Silène fictif',
      '3 hôtes · 4 constats',
      'Non relié : visible de l’administration du module seulement.',
    ])
      expect(html).toContain(t);
  });

  it('adresses des lectures et onglet ouvrable par l’adresse', () => {
    expect(urlConstatsSilene(' OpenPort ', 2)).toBe('/api/vulnerabilites/surface/silene/constats?q=OpenPort&page=2');
    expect(urlConstatsSilene('')).toBe('/api/vulnerabilites/surface/silene/constats');
    expect(urlFicheActifSilene('domaine', 'www.example.org')).toBe(
      '/api/vulnerabilites/surface/silene/actif?type=domaine&valeur=www.example.org',
    );
    expect(ONGLETS_SURFACE).toContain('constats-silene');
  });
});
