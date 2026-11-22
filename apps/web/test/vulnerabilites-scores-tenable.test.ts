/* Module Vulnérabilités (ADR 0100, lot TEN-SCORES ; décision du RSSI du 22/11/2026) : criticité (ACR) et exposition (AES)
   des machines selon Tenable, côté interface. Catégories officielles de Tenable (ACR Critique 9–10, Élevée 7–8, Moyenne
   4–6, Faible 1–3 ; AES Élevée 650–1000, Moyenne 350–649, Faible 0–349) ; « — » pour une valeur absente, jamais 0 ;
   colonnes, valeurs de la fiche et filtres montrés seulement si une intégration Tenable existe ; adresses de la liste et du
   parc. Rendu statique (sans navigateur). Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { EtatSynchronisationDto, MachineDto, MeOut } from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { ME_KEY, SessionProvider } from '../src/session';
import {
  CLE_ETAT_TENABLE,
  FILTRES_MACHINES_VIDES,
  filtresAvecScores,
  libelleAcr,
  libelleAes,
  OPTIONS_FILTRE_ACR,
  OPTIONS_FILTRE_AES,
  tenableConfigure,
  urlMachines,
} from '../src/vulnerabilites/failles';
import {
  FicheMachine,
  FiltresScoresTenable,
  MachinesPage,
  MachinesTable,
  ScoresTenableFiche,
} from '../src/vulnerabilites/Machines';
import { urlParc } from '../src/vulnerabilites/parc';

const ETAT: EtatSynchronisationDto = {
  integrationId: '00000000-0000-4000-8000-000000000e01',
  nom: 'Tenable fictif',
  actif: false,
  gravites: ['critique', 'elevee'],
  derniere: null,
  derniereCompleteLe: null,
  inventaire: null,
  frequenceHeures: 24,
  prochaineSynchronisation: null,
};

const machine = (m: Partial<MachineDto> = {}): MachineDto => ({
  id: '00000000-0000-4000-8000-000000000a01',
  nom: 'srv-score-01.exemple.invalid',
  adresse: '192.0.2.41',
  systeme: null,
  role: 'front',
  perimetreId: null,
  perimetreNom: null,
  perimetreOrigine: null,
  depot: null,
  exposition: null,
  acr: 9,
  aes: 700,
  premiere: null,
  derniere: null,
  source: 'tenable',
  integration: { id: ETAT.integrationId, nom: 'Tenable fictif', type: 'tenable' },
  compteurs: {
    critique: 1,
    elevee: 0,
    moyenne: 0,
    faible: 0,
    exploites: 0,
    exploitables: 0,
    declarees: 0,
    exploitationAveree: 0,
  },
  rang: { position: 1, total: 1, faits: [] },
  finDeSupport: false,
  finsDeSupport: [],
  version: 1,
  ...m,
});

/** Client de requêtes prérempli (aucun appel réseau dans un rendu statique). */
function client(etats: EtatSynchronisationDto[] | undefined) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(ME_KEY, {
    stage: 'ok',
    permissions: ['vulnerabilites:lire'],
    preferences: undefined,
  } as unknown as MeOut);
  if (etats) qc.setQueryData([...CLE_ETAT_TENABLE], etats);
  return qc;
}
const rendu = (e: ReactElement, etats?: EtatSynchronisationDto[]) =>
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: client(etats) },
      createElement(
        MantineProvider,
        null,
        createElement(MemoryRouter, null, createElement(SessionProvider, { fallback: 'Session absente', children: e })),
      ),
    ),
  );

describe('catégories officielles de Tenable', () => {
  it('ACR : Critique 9–10, Élevée 7–8, Moyenne 4–6, Faible 1–3 ; absente : « — »', () => {
    expect([10, 9, 8, 7, 6, 4, 3, 1].map(libelleAcr)).toEqual([
      '10 · Critique',
      '9 · Critique',
      '8 · Élevée',
      '7 · Élevée',
      '6 · Moyenne',
      '4 · Moyenne',
      '3 · Faible',
      '1 · Faible',
    ]);
    expect(libelleAcr(null)).toBe('—');
    expect(libelleAcr(8.5)).toBe('8,5 · Élevée');
  });
  it('AES : Élevée 650–1000, Moyenne 350–649, Faible 0–349 ; absent : « — », jamais 0', () => {
    expect([1000, 650, 649, 350, 349, 0].map(libelleAes)).toEqual([
      '1000 · Élevée',
      '650 · Élevée',
      '649 · Moyenne',
      '350 · Moyenne',
      '349 · Faible',
      '0 · Faible',
    ]);
    expect(libelleAes(null)).toBe('—');
  });
  it('choix des filtres : catégorie minimale', () => {
    expect(OPTIONS_FILTRE_ACR.map((o) => o.label)).toEqual(['Critique', 'Élevée ou plus', 'Moyenne ou plus']);
    expect(OPTIONS_FILTRE_AES.map((o) => o.label)).toEqual(['Élevée', 'Moyenne ou plus']);
  });
});

describe('intégration Tenable configurée', () => {
  it('au moins un état de synchronisation ; aucun, ou réponse absente : non', () => {
    expect(tenableConfigure([ETAT])).toBe(true);
    expect(tenableConfigure([])).toBe(false);
    expect(tenableConfigure(undefined)).toBe(false);
  });
  it('adresses : filtres ACR et AES envoyés à la liste et au parc ; masqués sans intégration Tenable', () => {
    const f = { ...FILTRES_MACHINES_VIDES, role: 'front' as const, acr: 'elevee' as const, aes: 'moyenne' as const };
    expect(urlMachines(f, 2)).toBe('/api/vulnerabilites/machines?role=front&acr=elevee&aes=moyenne&page=2');
    expect(urlParc(f)).toBe('/api/vulnerabilites/machines/parc?role=front&acr=elevee&aes=moyenne');
    expect(urlMachines(filtresAvecScores(f, false))).toBe('/api/vulnerabilites/machines?role=front');
    expect(urlParc(filtresAvecScores(f, false))).toBe('/api/vulnerabilites/machines/parc?role=front');
    expect(filtresAvecScores(f, true)).toBe(f);
    expect(urlMachines(FILTRES_MACHINES_VIDES)).toBe('/api/vulnerabilites/machines');
  });
});

describe('rendu', () => {
  it('liste : colonnes ACR et AES seulement avec `scoresTenable` ; catégories ; « — » pour une valeur absente', () => {
    const sans = rendu(createElement(MachinesTable, { machines: [machine()] }));
    expect(sans).not.toContain('ACR');
    expect(sans).not.toContain('AES');
    expect(sans).not.toContain('9 · Critique');
    const avec = rendu(
      createElement(MachinesTable, {
        machines: [machine(), machine({ id: '00000000-0000-4000-8000-000000000a02', acr: null, aes: null })],
        scoresTenable: true,
      }),
    );
    expect(avec).toContain('Criticité (ACR, Tenable)');
    expect(avec).toContain('Exposition (AES, Tenable)');
    expect(avec).toContain('9 · Critique');
    expect(avec).toContain('700 · Élevée');
    expect(avec.match(/<span aria-hidden="true">—<\/span>/g)).toHaveLength(2);
    expect(avec.match(/Non fournie par Tenable/g)).toHaveLength(2);
    // Valeur absente : jamais lue comme 0.
    expect(avec).not.toContain('0 · Faible');
    // Liste vide : la ligne « aucune machine » couvre toutes les colonnes.
    expect(rendu(createElement(MachinesTable, { machines: [], scoresTenable: true }))).toContain('colSpan="9"');
    expect(rendu(createElement(MachinesTable, { machines: [] }))).toContain('colSpan="7"');
  });

  it('fiche : « Selon Tenable » seulement si une intégration Tenable existe', () => {
    const fiche = (etats?: EtatSynchronisationDto[]) =>
      rendu(createElement(FicheMachine, { machine: machine({ acr: 7, aes: null }), modifier: false }), etats);
    expect(fiche()).not.toContain('Selon Tenable');
    expect(fiche([])).not.toContain('Selon Tenable');
    const avec = fiche([ETAT]);
    expect(avec).toContain('Selon Tenable');
    expect(avec).toContain('Criticité de l’actif (ACR) : 7 · Élevée');
    expect(avec).toContain('Non fournie par Tenable');
    expect(avec).toContain('elles n’entrent ni dans la priorité ni dans le rang');
    const seule = rendu(createElement(ScoresTenableFiche, { machine: { acr: 3, aes: 350 } }));
    expect(seule).toContain('3 · Faible');
    expect(seule).toContain('350 · Moyenne');
  });

  it('écran « Machines » : filtres ACR et AES absents sans intégration Tenable, présents avec', () => {
    const page = (etats?: EtatSynchronisationDto[]) => rendu(createElement(MachinesPage), etats);
    for (const html of [page(), page([])]) {
      expect(html).toContain('Fin de support');
      expect(html).not.toContain('Criticité (ACR, Tenable)');
      expect(html).not.toContain('Exposition (AES, Tenable)');
    }
    const avec = page([ETAT]);
    expect(avec).toContain('Criticité (ACR, Tenable)');
    expect(avec).toContain('Exposition (AES, Tenable)');
    const filtres = rendu(createElement(FiltresScoresTenable, { acr: '', aes: '', onChange: () => undefined }));
    expect(filtres).toContain('Criticité (ACR, Tenable)');
    expect(filtres).toContain('Exposition (AES, Tenable)');
  });

  it('aide de l’écran : ACR et AES, catégories officielles, sans effet sur la priorité', () => {
    const texte = JSON.stringify(HELP_ARTICLES);
    expect(texte).toContain('Criticité (ACR');
    expect(texte).toContain('Critique de 9 à 10');
    expect(texte).toContain('Élevée de 650 à 1000');
    expect(texte).toContain('Tenable Exposure Management Metrics');
  });
});
