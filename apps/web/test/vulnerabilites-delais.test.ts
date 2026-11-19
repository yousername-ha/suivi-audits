/* Module Vulnérabilités (ADR 0100, lot S1) : délais de correction et exceptions à l'écran. Puces et libellés exacts (jamais
   la couleur seule), lignes du délai (âge, échéance, délai de la priorité), saisie des délais (bornes), filtres repris de
   l'adresse, colonne « Délai », tuile « En dépassement », tables de l'onglet « Délais et exceptions », fiche illustrée,
   aide ; aucun attribut style. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import {
  DELAIS_CORRECTION_DEFAUT,
  type DelaiFailleDto,
  ETATS_DELAI,
  type ExceptionDto,
  mesurerCorrections,
  STATUTS_EXCEPTION,
} from '@suivi/shared';
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { FAMILLES } from '../src/navigation';
import { ExceptionsTable, MesuresTable } from '../src/vulnerabilites/DelaisExceptions';
import { DelaiFaille } from '../src/vulnerabilites/FaillesDetectees';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { Tuiles } from '../src/vulnerabilites/VueEnsemble';
import {
  depuisSaisie,
  ETAT_DELAI_PUCE,
  fmtJourCivil,
  lignesDelai,
  OPTIONS_FILTRE_DELAI,
  STATUT_EXCEPTION_PUCE,
  urlDelais,
  versSaisie,
} from '../src/vulnerabilites/delais';
import { filtresDepuisAdresse, urlDeclarees } from '../src/vulnerabilites/failles';
import { LIENS_TUILES } from '../src/vulnerabilites/vue-ensemble';
import { ficheFaille } from './fiche-faille-fixture';

const rendu = (e: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, e)));
const delai = (d: Partial<DelaiFailleDto> = {}): DelaiFailleDto => ({
  etat: 'en_depassement',
  priorite: 'P1',
  delai: { duree: 48, unite: 'heures' },
  premiere: '2026-11-01T08:00:00.000Z',
  depuis: '2026-11-01T08:00:00.000Z',
  echeance: '2026-11-03T08:00:00.000Z',
  ...d,
});
const exception = (e: Partial<ExceptionDto> = {}): ExceptionDto => ({
  nature: 'constat',
  objetId: '00000000-0000-4000-8000-0000000000e5',
  titre: 'Exemple Linux : contrôle fictif',
  statut: 'en_cours',
  echeance: '2027-03-31',
  justification: 'Équipement fictif non corrigeable.',
  mesure: 'Flux filtré (fictif).',
  par: 'RSSI fictif',
  le: '2026-11-18T09:00:00.000Z',
  expireeLe: null,
  etatApres: null,
  ...e,
});

describe('libellés et saisie', () => {
  it('chaque état de délai et chaque statut d’exception a sa puce et son libellé', () => {
    expect(Object.keys(ETAT_DELAI_PUCE).sort()).toEqual([...ETATS_DELAI].sort());
    expect(Object.keys(STATUT_EXCEPTION_PUCE).sort()).toEqual([...STATUTS_EXCEPTION].sort());
    expect(OPTIONS_FILTRE_DELAI.find((o) => o.value === 'en_depassement')?.label).toBe('En dépassement');
    expect(urlDelais(30)).toBe('/api/vulnerabilites/delais?periode=30');
    expect(fmtJourCivil('2027-03-31')).toBe('31/03/2027');
    expect(fmtJourCivil(null)).toBe('');
  });
  it('lignes du délai : âge, échéance, délai de la priorité', () => {
    const l = lignesDelai(delai(), new Date('2026-11-13T08:00:00.000Z'));
    expect(l.age).toBe('Âge : 12 j');
    expect(l.regle).toBe('Délai P1 : 48 heures');
    expect(l.echeance).toBeTruthy();
    expect(lignesDelai(delai({ echeance: null, priorite: 'P4', delai: null }), new Date()).regle).toBe(
      'Délai P4 : Aucun délai',
    );
  });
  it('saisie des délais : aller-retour, bornes, aucun délai', () => {
    const s = versSaisie(DELAIS_CORRECTION_DEFAUT);
    expect(depuisSaisie(s)).toEqual({ delais: DELAIS_CORRECTION_DEFAUT, erreur: null });
    expect(depuisSaisie({ ...s, P2: { actif: true, duree: 366, unite: 'jours' } }).erreur).toBe(
      'P2 : durée entière de 1 à 365 jours.',
    );
    expect(depuisSaisie({ ...s, P1: { actif: true, duree: '1,5', unite: 'heures' } }).delais).toBeNull();
    expect(depuisSaisie({ ...s, P3: { actif: false, duree: '', unite: 'jours' } }).delais?.P3).toBeNull();
  });
  it('filtres repris de l’adresse : délai et tri (valeur inconnue ignorée)', () => {
    const f = filtresDepuisAdresse(new URLSearchParams('delai=en_depassement&tri=echeance'));
    expect(f).toMatchObject({ delai: 'en_depassement', tri: 'echeance' });
    expect(filtresDepuisAdresse(new URLSearchParams('delai=x&tri=y'))).toMatchObject({ delai: '', tri: '' });
    expect(urlDeclarees({ q: '', priorite: '', delai: 'echeance_proche', tri: 'echeance' })).toBe(
      '/api/vulnerabilites/declarees?delai=echeance_proche&tri=echeance',
    );
  });
});

describe('rendu', () => {
  it('délai d’une faille : état en clair, âge, échéance, délai', () => {
    const html = rendu(createElement(DelaiFaille, { d: delai(), maintenant: new Date('2026-11-13T08:00:00.000Z') }));
    expect(html).toContain('En dépassement');
    expect(html).toContain('Âge : 12 j');
    expect(html).toContain('Échéance');
    expect(html).toContain('Délai P1 : 48 heures');
  });
  it('tuile « En dépassement » : lien vers la liste filtrée, la plus en retard d’abord', () => {
    const html = rendu(
      createElement(Tuiles, {
        tuiles: {
          exploiteesPresentes: 0,
          aTraiter: { p1: 0, p2: 0 },
          aConfirmer: { failles: 0, produits: 0 },
          corrigeesCeMois: 0,
          enDepassement: 7,
          exploiteesSansCorrectif: 0,
          exploiteesCorrectifNonRenseigne: 0,
          finDeSupport: {
            constats: 0,
            machines: { lisibles: 0, horsLecture: false },
            services: { lisibles: 0, horsLecture: false },
          },
        },
      }),
    );
    expect(LIENS_TUILES.depassement).toBe('/vulnerabilites/failles?delai=en_depassement&tri=echeance');
    expect(html).toContain('href="/vulnerabilites/failles?delai=en_depassement&amp;tri=echeance"');
    expect(html).toContain('En dépassement');
    expect(html).toContain('07');
  });
  it('onglet « Délais et exceptions » : mesures et exceptions', () => {
    const m = rendu(
      createElement(MesuresTable, {
        m: mesurerCorrections([
          {
            priorite: 'P1',
            depuis: '2026-11-01T08:00:00.000Z',
            fin: '2026-11-02T08:00:00.000Z',
            echeance: '2026-11-03T08:00:00.000Z',
          },
        ]),
      }),
    );
    for (const th of ['Priorité', 'Failles corrigées', 'Délai moyen', 'Délai médian', 'Part dans les délais'])
      expect(m).toMatch(new RegExp(`<th[^>]*>${th}</th>`, 'i'));
    expect(m).toContain('24 h');
    expect(m).toContain('100 %');
    expect(m).toContain('1 sur 1');
    const e = rendu(
      createElement(ExceptionsTable, {
        exceptions: [
          exception(),
          exception({
            objetId: '00000000-0000-4000-8000-0000000000e6',
            statut: 'echue',
            expireeLe: '2026-11-18T10:00:00.000Z',
            etatApres: 'a_traiter',
          }),
          exception({
            objetId: '00000000-0000-4000-8000-0000000000e7',
            statut: 'sans_echeance',
            echeance: null,
            par: null,
            le: null,
            mesure: null,
          }),
        ],
      }),
    );
    for (const th of ['Faille', 'Statut', 'Échéance', 'Accordée par', 'Justification', 'Mesure compensatoire'])
      expect(e).toMatch(new RegExp(`<th[^>]*>${th}</th>`, 'i'));
    expect(e).toContain('31/03/2027');
    expect(e).toContain('En cours');
    expect(e).toContain('Échue');
    expect(e).toContain('faille rendue « À traiter »');
    expect(e).toContain('Sans échéance, à compléter');
    expect(e).toContain('Flux filtré (fictif).');
    expect(rendu(createElement(ExceptionsTable, { exceptions: [] }))).toContain('Aucune exception');
  });
  it('fiche illustrée : délai et exception d’un objet suivi', () => {
    const html = rendu(
      createElement(FicheFailleIllustree, {
        f: ficheFaille({
          delai: delai({ etat: 'sous_exception' }),
          exception: { statut: 'bientot_echue', echeance: '2026-12-01' },
        }),
      }),
    );
    expect(html).toContain('Délai : Sous exception');
    expect(html).toContain('Exception : Bientôt échue (échéance 01/12/2026)');
    expect(rendu(createElement(FicheFailleIllustree, { f: ficheFaille() }))).not.toContain('Délai :');
  });
});

describe('navigation et aide', () => {
  it('onglet « Délais et exceptions » ; article d’aide', () => {
    expect(JSON.stringify(FAMILLES)).toContain('/vulnerabilites/delais');
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-delais');
    expect(a?.link).toBe('/vulnerabilites/delais');
    const texte = a!.steps.join(' ');
    for (const mot of [
      '48 heures',
      '15 jours',
      '90 jours',
      'RSSI',
      'mesure compensatoire',
      'douze mois',
      'quatorze jours',
    ])
      expect(texte).toContain(mot);
  });
});

describe('CSP stricte (ADR 0006)', () => {
  it('aucune prop style ni balise <style> ou <script> dans les sources du lot', () => {
    for (const f of [
      'DelaisExceptions.tsx',
      'delais.ts',
      'SuiviFaille.tsx',
      'SeuilsPriorite.tsx',
      'FaillesDetectees.tsx',
      'FicheFaille.tsx',
      'VueEnsemble.tsx',
    ]) {
      const source = readFileSync(new URL(`../src/vulnerabilites/${f}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/\sstyle=\{/i);
      expect(source).not.toMatch(/<style/i);
      expect(source).not.toMatch(/<script/i);
    }
  });
});
