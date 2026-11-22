/* Module Vulnérabilités (ADR 0100, lot TEN-SCORES ; décision du RSSI du 22/11/2026) : criticité (ACR) et exposition (AES)
   des machines selon Tenable. Catégories officielles (docs.tenable.com, « Tenable Exposure Management Metrics »), schéma
   de l'élément machine (AES facultatif, entier de 0 à 1000), filtres de la liste et du parc des machines. Données
   entièrement fictives : noms en .invalid, adresses de 192.0.2.0/24. */
import { describe, expect, it } from 'vitest';
import {
  CATEGORIE_ACR_LIBELLES,
  CATEGORIE_AES_LIBELLES,
  categorieAcr,
  categorieAes,
  ElementMachineTenable,
  ElementSynchronisation,
  FILTRE_ACR_LIBELLES,
  FILTRE_AES_LIBELLES,
  RechercheMachines,
  RechercheParc,
  SEUILS_ACR,
  SEUILS_AES,
} from '../src/index.js';

const UUID = '00000000-0000-4000-8000-0000000000aa';
const machine = (extra: Record<string, unknown> = {}) => ({
  type: 'machine',
  cle: `uuid:${UUID}`,
  uuid: UUID,
  nom: 'srv-exemple-01.exemple.invalid',
  adresse: '192.0.2.10',
  systeme: 'Linux Kernel 5.14 on Exemple Linux 9',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T05:24:48.000Z',
  exposition: 'internal',
  acr: 4,
  ...extra,
});

describe('catégories officielles de Tenable', () => {
  it('ACR : Critique 9–10, Élevée 7–8, Moyenne 4–6, Faible 1–3', () => {
    expect([10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(categorieAcr)).toEqual([
      'critique',
      'critique',
      'elevee',
      'elevee',
      'moyenne',
      'moyenne',
      'moyenne',
      'faible',
      'faible',
      'faible',
    ]);
    // Valeur entre deux catégories publiées : la catégorie inférieure (seuils).
    expect([8.5, 6.9, 3.5, 0.5, 0].map(categorieAcr)).toEqual(['elevee', 'moyenne', 'faible', 'faible', 'faible']);
    expect(SEUILS_ACR).toEqual({ critique: 9, elevee: 7, moyenne: 4, faible: 0 });
    expect(Object.values(CATEGORIE_ACR_LIBELLES)).toEqual(['Critique', 'Élevée', 'Moyenne', 'Faible']);
  });
  it('AES : Élevée 650–1000, Moyenne 350–649, Faible 0–349', () => {
    expect([1000, 650, 649, 350, 349, 0].map(categorieAes)).toEqual([
      'elevee',
      'elevee',
      'moyenne',
      'moyenne',
      'faible',
      'faible',
    ]);
    expect(SEUILS_AES).toEqual({ elevee: 650, moyenne: 350, faible: 0 });
    expect(Object.values(CATEGORIE_AES_LIBELLES)).toEqual(['Élevée', 'Moyenne', 'Faible']);
  });
  it('valeur absente : aucune catégorie (jamais celle de 0)', () => {
    for (const v of [null, undefined, Number.NaN]) {
      expect(categorieAcr(v)).toBeNull();
      expect(categorieAes(v)).toBeNull();
    }
    expect(categorieAcr(-1)).toBeNull();
    expect(categorieAes(-1)).toBeNull();
  });
});

describe('élément machine rapporté par le script', () => {
  const ok = (e: unknown) => ElementSynchronisation.safeParse(e).success;
  it('AES facultatif (script plus ancien), null, ou entier de 0 à 1000', () => {
    expect(ok(machine())).toBe(true);
    expect(ElementMachineTenable.parse(machine()).aes).toBeUndefined();
    for (const aes of [null, 0, 349, 650, 1000]) expect(ok(machine({ aes })), String(aes)).toBe(true);
    expect(ElementMachineTenable.parse(machine({ aes: 700 })).aes).toBe(700);
  });
  it('AES hors bornes, décimal ou de mauvais type : refusé', () => {
    for (const aes of [1001, -1, 12.5, '650', true, [650]]) expect(ok(machine({ aes })), String(aes)).toBe(false);
  });
  it('aucun autre champ de Tenable : refusé', () => {
    expect(ok(machine({ assetExposureScore: 650 }))).toBe(false);
    expect(ok(machine({ aes: 650, acrScore: 4 }))).toBe(false);
  });
});

describe('filtres de la liste et du parc', () => {
  it('catégorie minimale : ACR Critique, Élevée ou plus, Moyenne ou plus ; AES Élevée, Moyenne ou plus', () => {
    expect(FILTRE_ACR_LIBELLES).toEqual({ critique: 'Critique', elevee: 'Élevée ou plus', moyenne: 'Moyenne ou plus' });
    expect(FILTRE_AES_LIBELLES).toEqual({ elevee: 'Élevée', moyenne: 'Moyenne ou plus' });
    for (const schema of [RechercheMachines, RechercheParc]) {
      expect(schema.parse({ acr: 'critique', aes: 'elevee' })).toMatchObject({ acr: 'critique', aes: 'elevee' });
      expect(schema.parse({ acr: 'moyenne', aes: 'moyenne' })).toMatchObject({ acr: 'moyenne', aes: 'moyenne' });
      for (const f of [{ acr: 'faible' }, { aes: 'critique' }, { aes: 'faible' }, { acr: '9' }, { aes: '' }])
        expect(schema.safeParse(f).success, JSON.stringify(f)).toBe(false);
    }
    expect(RechercheMachines.parse({})).toEqual({ page: 1 });
  });
});
