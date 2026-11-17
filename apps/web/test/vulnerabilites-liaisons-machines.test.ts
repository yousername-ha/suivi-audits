/* Module Vulnérabilités (ADR 0100, lot ALH3) : actif exposé relié aux machines internes, côté interface. Colonne
   « Machine interne » (reliée, proposée, à relier, machine illisible signalée sans nom), fiche d'un actif (boutons de
   décision et de déliaison seulement avec le droit de modifier, textes rendus comme texte), libellés d'une liaison,
   « exposée sur Internet par … » dans la fiche d'une machine, adresses de l'API, aide. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import { type ActifAlhDto, type FicheLiaisonsActifDto, type LiaisonMachineDto } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { ExpositionMachine } from '../src/vulnerabilites/Machines';
import { ActifsAlhTable, FicheLiaisonsActif } from '../src/vulnerabilites/SurfaceExterne';
import {
  libelleExposition,
  libelleLiaison,
  OPTIONS_LIAISON_ACTIF,
  resumeMachineInterne,
  urlActifsAlh,
  urlDecisionLiaison,
  urlDeliaison,
  urlExpositionMachine,
  urlLiaisonsActif,
} from '../src/vulnerabilites/surface';

const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const rien = () => undefined;
const ID = '00000000-0000-4000-8000-000000000011';
const liaison = (l: Partial<LiaisonMachineDto> = {}): LiaisonMachineDto => ({
  id: '00000000-0000-4000-8000-0000000000b1',
  statut: 'confirmee',
  motif: 'adresse',
  origine: 'proposition',
  machine: {
    id: '00000000-0000-4000-8000-0000000000c1',
    nom: 'srv-front-01.interne.invalid',
    adresse: '192.0.2.10',
    role: 'front',
    perimetreNom: 'Périmètre fictif A',
  },
  decidePar: 'rssi.fictif',
  decideLe: '2026-11-17T09:00:00.000Z',
  note: '',
  calculeLe: '2026-11-17T08:00:00.000Z',
  ...l,
});
const fiche = (f: Partial<FicheLiaisonsActifDto> = {}): FicheLiaisonsActifDto => ({
  actifId: ID,
  versionLiaisons: 3,
  reliees: [liaison()],
  propositions: [
    liaison({
      id: '00000000-0000-4000-8000-0000000000b2',
      statut: 'proposee',
      motif: 'nom_court',
      decidePar: null,
      decideLe: null,
      machine: {
        id: '00000000-0000-4000-8000-0000000000c2',
        nom: 'appli.interne.invalid',
        adresse: null,
        role: null,
        perimetreNom: null,
      },
    }),
  ],
  rejetees: [],
  autresMachines: false,
  max: 20,
  ...f,
});
const actif = (x: Partial<ActifAlhDto> = {}): ActifAlhDto => ({
  id: ID,
  type: 'domaine',
  valeur: 'www.exemple-fictif.example',
  statut: 'monitored',
  adresse: '192.0.2.10',
  fai: null,
  asn: null,
  pays: null,
  cdn: null,
  mutualise: null,
  joignable: null,
  joignableLe: null,
  niveau: 2,
  alertesOuvertes: 0,
  technologies: 0,
  creeLe: null,
  majLe: null,
  perimetreAlh: 'Périmètre ALH fictif 1',
  perimetreNom: 'Périmètre fictif A',
  integration: { id: '00000000-0000-4000-8000-0000000000a2', nom: 'AlgoLightHouse fictif' },
  machinesInternes: { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false },
  versionLiaisons: 1,
  ...x,
});

describe('adresses et libellés', () => {
  it('adresses de l’API et filtre « Machine interne »', () => {
    expect(urlActifsAlh('', '', 1, 'proposee')).toBe('/api/vulnerabilites/surface/actifs?liaison=proposee');
    expect(urlLiaisonsActif(ID)).toBe(`/api/vulnerabilites/surface/actifs/${ID}/machines`);
    expect(urlDecisionLiaison('x/y')).toBe('/api/vulnerabilites/surface/liaisons/x%2Fy/decision');
    expect(urlDeliaison(ID)).toBe(`/api/vulnerabilites/surface/liaisons/${ID}/deliaison`);
    expect(urlExpositionMachine(ID)).toBe(`/api/vulnerabilites/machines/${ID}/surface`);
    expect(OPTIONS_LIAISON_ACTIF.map((o) => o.label)).toEqual(['Reliée', 'Proposée, à décider', 'À relier']);
  });
  it('colonne « Machine interne » : reliée, proposée, à relier, machine illisible sans nom ni nombre', () => {
    const vide = { reliees: [], nombreReliees: 0, propositions: 0, autresMachines: false };
    expect(resumeMachineInterne(vide)).toEqual({ libelle: 'À relier', etat: 'neutre', detail: '' });
    expect(resumeMachineInterne({ ...vide, propositions: 2 })).toEqual({
      libelle: 'Proposée, à décider',
      etat: 'info',
      detail: '2 propositions à décider.',
    });
    const machines = ['a', 'b', 'c'].map((n, i) => ({ id: String(i), nom: `srv-${n}.interne.invalid`, adresse: null }));
    expect(resumeMachineInterne({ ...vide, reliees: machines, nombreReliees: 5, autresMachines: true })).toEqual({
      libelle: 'Reliée : srv-a.interne.invalid, srv-b.interne.invalid, srv-c.interne.invalid et 2 autres',
      etat: 'succes',
      detail: 'Reliée aussi à une machine que vous ne pouvez pas lire.',
    });
    expect(resumeMachineInterne({ ...vide, autresMachines: true }).libelle).toBe(
      'Reliée à une machine que vous ne pouvez pas lire',
    );
  });
  it('liaison : critère, origine, décision', () => {
    expect(libelleLiaison(liaison())).toBe('Proposition confirmée par rssi.fictif (critère : même adresse IP)');
    expect(libelleLiaison(liaison({ origine: 'manuelle', motif: null }))).toBe(
      'Reliée à la main par rssi.fictif (sans critère de la plateforme)',
    );
    expect(libelleLiaison(liaison({ statut: 'proposee', motif: 'nom_complet', decidePar: null }))).toBe(
      'Proposée par la plateforme (critère : même nom complet)',
    );
    expect(libelleLiaison(liaison({ statut: 'rejetee' }))).toMatch(/pas reproposée/);
  });
  it('fiche d’une machine : « exposée sur Internet par … », actif illisible sans nom', () => {
    const base = {
      liaisonId: 'l',
      origine: 'manuelle' as const,
      motif: null,
      adresse: null,
      perimetreAlh: null,
      perimetreNom: null,
    };
    expect(
      libelleExposition({
        actifs: [
          { ...base, id: '1', type: 'domaine', valeur: 'www.exemple-fictif.example' },
          { ...base, id: '2', type: 'hote', valeur: '192.0.2.10' },
        ],
        autresActifs: true,
      }),
    ).toBe(
      'Exposée sur Internet par www.exemple-fictif.example (domaine), 192.0.2.10 (hôte), un actif exposé que vous ne pouvez pas lire.',
    );
    expect(libelleExposition({ actifs: [], autresActifs: false })).toMatch(/^Aucun actif exposé/);
    expect(rendre(createElement(ExpositionMachine, { exposition: { actifs: [], autresActifs: true } }))).toContain(
      'un actif exposé que vous ne pouvez pas lire',
    );
  });
});

describe('rendu', () => {
  it('liste des actifs : colonne et fiche ouvrable par la valeur', () => {
    const html = rendre(
      createElement(ActifsAlhTable, {
        actifs: [
          actif({
            machinesInternes: {
              reliees: [{ id: 'm', nom: 'srv-front-01.interne.invalid', adresse: '192.0.2.10' }],
              nombreReliees: 1,
              propositions: 1,
              autresMachines: false,
            },
          }),
        ],
        onOuvrir: rien,
      }),
    );
    for (const t of ['Machine interne', 'Reliée : srv-front-01.interne.invalid', '1 proposition à décider.'])
      expect(html).toContain(t);
    expect(html).toMatch(/<button[^>]*>www\.exemple-fictif\.example<\/button>/i);
  });
  it('fiche d’un actif : boutons seulement avec le droit de modifier, machine illisible signalée', () => {
    const avec = rendre(
      createElement(FicheLiaisonsActif, {
        fiche: fiche({ autresMachines: true }),
        peutModifier: true,
        enCours: false,
        onDecider: rien,
        onDelier: rien,
      }),
    );
    for (const t of [
      'Machines internes reliées',
      'srv-front-01.interne.invalid',
      'Périmètre fictif A',
      'Propositions de la plateforme',
      'appli.interne.invalid',
      'aria-label="Délier srv-front-01.interne.invalid"',
      'aria-label="Confirmer appli.interne.invalid"',
      'aria-label="Rejeter appli.interne.invalid"',
      'aussi relié à une machine que vous ne pouvez pas lire',
      '20 au plus',
    ])
      expect(avec).toContain(t);
    const sans = rendre(
      createElement(FicheLiaisonsActif, {
        fiche: fiche(),
        peutModifier: false,
        enCours: false,
        onDecider: rien,
        onDelier: rien,
      }),
    );
    expect(sans).not.toMatch(/Délier|Confirmer|Rejeter/);
    expect(sans).not.toContain('ne pouvez pas lire');
    const vide = rendre(
      createElement(FicheLiaisonsActif, {
        fiche: fiche({
          reliees: [],
          propositions: [],
          rejetees: [liaison({ statut: 'rejetee', note: '<b>note</b>' })],
        }),
        peutModifier: true,
        enCours: false,
        onDecider: rien,
        onDelier: rien,
      }),
    );
    expect(vide).toContain('Aucune machine interne reliée');
    expect(vide).toContain('rien n’est relié sans votre confirmation');
    expect(vide).toContain('Rejetées ou déliées');
    expect(vide).toContain('Note : &lt;b&gt;note&lt;/b&gt;');
    expect(vide).not.toMatch(/<b>note/i);
  });
});

describe('aide', () => {
  it('l’aide de la surface externe explique les machines internes', () => {
    const texte = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-surface')!.steps.join(' ');
    for (const attendu of [
      'Machine interne',
      'même adresse IP',
      'nom court',
      'Confirmer',
      'Délier',
      'ne pouvez pas lire',
    ])
      expect(texte).toContain(attendu);
    expect(HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-failles')!.steps.join(' ')).toContain(
      'Exposition sur Internet',
    );
  });
});
