/* Jour et heure civils de Paris dans l'interface : échéance KEV jugée au jour de Paris, valeurs par défaut des champs
   « datetime-local » du RETEX à l'heure de Paris, et garde contre le retour de « aujourd'hui » calculé en UTC
   (`new Date().toISOString().slice(…)`). Données fictives. */
import { MantineProvider } from '@mantine/core';
import { jourParis, type FailleVeilleDto } from '@suivi/shared';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isoVersLocal, maintenantLocal } from '../src/incidents/FormulaireEvenementRetex';
import { aujourdhui } from '../src/vulnerabilites/tendances';
import { KevTable } from '../src/vulnerabilites/Veille';
import { echeanceDepassee } from '../src/vulnerabilites/veille';

const rendu = (e: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, e)));

const faille = (echeance: string): FailleVeilleDto => ({
  cve: 'CVE-2026-0001',
  description: 'Fictional description.',
  publieLe: null,
  modifieLe: null,
  cvss31: null,
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['produit_fictif'],
  epss: null,
  kev: {
    editeur: 'Éditeur fictif',
    produit: 'Produit fictif',
    nom: 'Fictional Vulnerability',
    description: 'Fictional description.',
    action: 'Apply mitigations per vendor instructions.',
    ajoutLe: '2026-11-13',
    echeance,
    rancongiciel: false,
  },
  publications: [],
  produitsCites: [],
  sources: { exploitation: [], exploitable: [], valeurs: { gravites: [], cvss: [], epss: [] }, certSante: null },
  surfaceExterne: null,
});

describe('échéance KEV au jour civil de Paris', () => {
  // 24/11/2026 à 23 h 30 UTC : déjà le 25/11 à Paris (00 h 30).
  const instant = new Date('2026-11-24T23:30:00Z');

  it('une échéance du 24/11 est dépassée à 00 h 30 à Paris, même si l’UTC est encore au 24/11', () => {
    expect(echeanceDepassee('2026-11-24', instant.toISOString().slice(0, 10))).toBe(false);
    expect(echeanceDepassee('2026-11-24', jourParis(instant))).toBe(true);
    expect(echeanceDepassee('2026-11-25', jourParis(instant))).toBe(false);
  });

  it('le tableau KEV signale l’échéance dépassée selon le jour de Paris', () => {
    const kev = (aujourdhui: string) => rendu(createElement(KevTable, { failles: [faille('2026-11-24')], aujourdhui }));
    const depassee = kev('2026-12-31'),
      aTemps = kev('2026-11-01');
    expect(depassee).not.toEqual(aTemps);
    expect(kev(jourParis(instant))).toEqual(depassee);
    expect(kev(instant.toISOString().slice(0, 10))).toEqual(aTemps);
  });

  it('« aujourd’hui » des tendances et de la veille est le jour civil de Paris', () => {
    expect(aujourdhui(instant)).toBe('2026-11-25');
    expect(aujourdhui(new Date('2026-07-14T22:00:00Z'))).toBe('2026-07-15');
  });
});

describe('RETEX : heure par défaut des champs « datetime-local »', () => {
  afterEach(() => vi.useRealTimers());

  it('maintenant : heure de Paris, quel que soit le fuseau du navigateur', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-29T01:00:00Z') });
    expect(maintenantLocal()).toBe('2026-03-29T03:00');
    vi.setSystemTime(new Date('2026-11-24T23:30:00Z'));
    expect(maintenantLocal()).toBe('2026-11-25T00:30');
  });

  it('un horodatage ISO devient l’heure de Paris ; vide s’il est invalide', () => {
    expect(isoVersLocal('2026-10-25T00:59:59Z')).toBe('2026-10-25T02:59');
    expect(isoVersLocal('2026-10-25T01:00:00Z')).toBe('2026-10-25T02:00');
    expect(isoVersLocal('pas une date')).toBe('');
  });
});

describe('garde : pas de jour ni d’heure « du jour » calculés en UTC', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) return f === 'generated' ? [] : fichiers(p);
      return /\.tsx?$/.test(f) ? [p] : [];
    });
  const MOTIF = /new Date\(\)\.toISOString\(\)\.slice\(0, ?(7|10|13|16)\)|getTimezoneOffset\(\)/;

  it('l’interface utilise jourParis ou maintenantLocalParis (@suivi/shared)', () => {
    const fautifs = fichiers(SRC).flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((l, i) => [l, i] as const)
        .filter(([l]) => MOTIF.test(l))
        .map(([l, i]) => `${path.relative(SRC, f)}:${i + 1} ${l.trim()}`),
    );
    expect(fautifs).toEqual([]);
  });
});
