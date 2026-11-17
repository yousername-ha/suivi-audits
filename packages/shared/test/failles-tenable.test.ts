/* Module Vulnérabilités (ADR 0100, lot V5) : schémas des éléments rapportés par l'exécutant (machines, constats, détections,
   inventaire), bilan d'une synchronisation, corps des routes d'affectation, dépôt d'une machine et liaison d'un dépôt (lot
   V4d). Données entièrement fictives : noms en
   .invalid, adresses de 192.0.2.0/24, identifiants de CVE fictifs. */
import { describe, expect, it } from 'vitest';
import {
  AffectationMachine,
  AffectationMachines,
  BilanSynchronisation,
  cleMachine,
  DEPOT_TENABLE,
  ElementSynchronisation,
  LiaisonDepotTenable,
  LotSynchronisation,
  RechercheConstats,
  RechercheMachines,
  TENABLE_BORNES,
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
const constat = (extra: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin: '900001',
  nom: 'Exemple Linux : noyau (EX-2026-0001)',
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: 'AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H/E:U/RL:O/RC:C',
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.0056,
  exploitable: true,
  exploitLibelle: 'Exploits are available',
  failleLe: '2026-07-14T12:00:00.000Z',
  correctifLe: '2026-07-14T12:00:00.000Z',
  finSupportLe: null,
  voirAussi: 'https://example.org/advisory',
  cves: ['CVE-2026-90001', 'CVE-2026-90002'],
  cvesTronquees: false,
  ...extra,
});
const detection = (extra: Record<string, unknown> = {}) => ({
  type: 'detection',
  plugin: '900001',
  machine: `uuid:${UUID}`,
  port: 0,
  protocole: 'TCP',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T05:24:48.000Z',
  attenue: false,
  risqueAccepte: false,
  risqueRequalifie: false,
  ...extra,
});
const bilan = (extra: Record<string, unknown> = {}) => ({
  elements: 3,
  pages: 1,
  constats: 1,
  detections: 1,
  machines: 1,
  hotes: 0,
  ecartes: 0,
  tronque: false,
  inventaire: { ok: true, erreur: null },
  ...extra,
});
const ok = (e: unknown) => ElementSynchronisation.safeParse(e).success;

describe('identifiant d’une machine dans sa source', () => {
  it('UUID de Tenable d’abord, sinon adresse et nom, sinon rien', () => {
    expect(cleMachine(UUID.toUpperCase(), '192.0.2.10', 'srv.exemple.invalid')).toBe(`uuid:${UUID}`);
    expect(cleMachine(null, '192.0.2.10', 'srv.exemple.invalid')).toBe('ip:192.0.2.10|srv.exemple.invalid');
    expect(cleMachine(null, '192.0.2.10', null)).toBe('ip:192.0.2.10');
    expect(cleMachine(null, null, 'srv.exemple.invalid')).toBeNull();
  });
});

describe('éléments rapportés par l’exécutant', () => {
  it('machine, constat, détection et machine d’inventaire bien formés', () => {
    expect(ok(machine())).toBe(true);
    expect(ok(machine({ uuid: null, cle: 'ip:192.0.2.10|srv-exemple-01.exemple.invalid' }))).toBe(true);
    expect(ok(constat())).toBe(true);
    // Constat sans CVE (système qui n'est plus maintenu, V18), avec ou sans date de fin de support.
    expect(ok(constat({ cves: [], finSupportLe: '2025-01-01T00:00:00.000Z' }))).toBe(true);
    expect(ok(constat({ cves: [], epss: null, vpr: null, cvss3Vecteur: null, voirAussi: null }))).toBe(true);
    expect(ok(detection())).toBe(true);
    expect(
      ok({
        type: 'hote',
        uuid: UUID,
        tenableUuid: null,
        nom: null,
        adresse: '192.0.2.11',
        systeme: null,
        premiere: null,
        derniere: null,
      }),
    ).toBe(true);
  });

  it('refuse un champ non listé, à commencer par le texte détaillé de Tenable (pluginText)', () => {
    expect(ok(constat({ pluginText: '<texte long>' }))).toBe(false);
    expect(ok(machine({ macAddress: '00:00:5e:00:53:01' }))).toBe(false);
    expect(ok(detection({ vulnUUID: UUID }))).toBe(false);
    expect(ok({ ...constat(), type: 'autre' })).toBe(false);
  });

  it('identifiant de machine incohérent, adresse, nom ou UUID mal formés : refusés', () => {
    expect(ok(machine({ cle: 'uuid:00000000-0000-4000-8000-0000000000bb' }))).toBe(false);
    expect(ok(machine({ adresse: '192.0.2.300' }))).toBe(false);
    expect(ok(machine({ nom: 'SRV<script>' }))).toBe(false);
    expect(ok(machine({ uuid: 'pas-un-uuid', cle: 'uuid:pas-un-uuid' }))).toBe(false);
    expect(ok(machine({ exposition: 'Interne ; autre' }))).toBe(false);
    expect(ok(machine({ acr: 11 }))).toBe(false);
  });

  it('constat : EPSS entre 0 et 1, scores sur 10, CVE bornées sans doublon, lien https, texte nettoyé', () => {
    expect(ok(constat({ epss: 56 }))).toBe(false);
    expect(ok(constat({ cvss3Score: 10.5 }))).toBe(false);
    expect(ok(constat({ cves: ['CVE-2026-90001', 'CVE-2026-90001'] }))).toBe(false);
    expect(ok(constat({ cves: ['CVE-26-1'] }))).toBe(false);
    const beaucoup = Array.from({ length: TENABLE_BORNES.cvesParConstat + 1 }, (_, i) => `CVE-2026-${90000 + i}`);
    expect(ok(constat({ cves: beaucoup }))).toBe(false);
    expect(ok(constat({ cves: beaucoup.slice(0, -1), cvesTronquees: true }))).toBe(true);
    expect(ok(constat({ voirAussi: 'http://example.org/advisory' }))).toBe(false);
    expect(ok(constat({ voirAussi: 'javascript:alert(1)' }))).toBe(false);
    expect(ok(constat({ voirAussi: 'https://example.org/"onmouseover' }))).toBe(false);
    expect(ok(constat({ synopsis: 'ligne 1\nligne 2' }))).toBe(false);
    expect(ok(constat({ correctif: 'Mettre à jour <b>maintenant</b>' }))).toBe(false);
    expect(ok(constat({ correctif: 'x'.repeat(TENABLE_BORNES.correctif + 1) }))).toBe(false);
    expect(ok(constat({ gravite: 'info' }))).toBe(false);
    expect(ok(constat({ plugin: '0' }))).toBe(false);
    expect(ok(constat({ cvss3Vecteur: 'AV:N/<script>' }))).toBe(false);
  });

  it('détection : port et protocole contrôlés', () => {
    expect(ok(detection({ port: 70000 }))).toBe(false);
    expect(ok(detection({ protocole: 'tcp' }))).toBe(false);
    expect(ok(detection({ machine: 'ailleurs' }))).toBe(false);
  });

  it('lot borné, bilan strict (l’inventaire peut échouer, avec une erreur sur une ligne)', () => {
    expect(LotSynchronisation.safeParse({ elements: [] }).success).toBe(false);
    expect(
      LotSynchronisation.safeParse({ elements: Array.from({ length: TENABLE_BORNES.lot + 1 }, () => ({})) }).success,
    ).toBe(false);
    expect(BilanSynchronisation.safeParse(bilan()).success).toBe(true);
    expect(
      BilanSynchronisation.safeParse(bilan({ inventaire: { ok: false, erreur: 'Inventaire indisponible.' } })).success,
    ).toBe(true);
    for (const b of [
      bilan({ inventaire: { ok: false, erreur: null } }),
      bilan({ inventaire: { ok: true, erreur: 'x' } }),
      bilan({ inventaire: { ok: false, erreur: 'ligne 1\nligne 2' } }),
      bilan({ tronque: 'non' }),
      bilan({ machinesNoms: ['srv.exemple.invalid'] }),
      bilan({ elements: -1 }),
    ])
      expect(BilanSynchronisation.safeParse(b).success).toBe(false);
  });
});

describe('corps des routes', () => {
  it('recherche des constats et des machines', () => {
    expect(RechercheConstats.parse({ q: 'CVE-2026', exploite: 'oui' })).toMatchObject({ page: 1, exploite: 'oui' });
    expect(RechercheConstats.safeParse({ gravite: 'info' }).success).toBe(false);
    expect(RechercheConstats.safeParse({ exploitable: 'non' }).success).toBe(false);
    expect(RechercheMachines.parse({ role: 'aucun', perimetre: 'aucun' })).toMatchObject({ role: 'aucun' });
    expect(RechercheMachines.safeParse({ perimetre: 'pas-un-uuid' }).success).toBe(false);
    expect(RechercheMachines.safeParse({ role: 'proxy' }).success).toBe(false);
  });

  it('affectation unitaire et en masse : stricte, au moins une modification, bornée, sans doublon', () => {
    expect(AffectationMachine.parse({ role: null })).toEqual({ role: null });
    expect(AffectationMachine.safeParse({}).success).toBe(false);
    expect(AffectationMachine.safeParse({ role: 'proxy' }).success).toBe(false);
    expect(AffectationMachine.safeParse({ nom: 'x' }).success).toBe(false);
    const m = { id: UUID, version: 1 };
    expect(AffectationMachines.parse({ machines: [m], role: 'front' })).toMatchObject({ role: 'front' });
    expect(AffectationMachines.safeParse({ machines: [m] }).success).toBe(false);
    expect(AffectationMachines.safeParse({ machines: [m, m], role: 'front' }).success).toBe(false);
    expect(AffectationMachines.safeParse({ machines: [], role: 'front' }).success).toBe(false);
    expect(AffectationMachines.safeParse({ machines: [{ id: UUID }], role: 'front' }).success).toBe(false);
  });
});

describe('dépôts de Tenable (lot V4d)', () => {
  it('dépôt d’une machine : identifiant entier positif et nom nettoyé seulement ; absent ou nul admis', () => {
    expect(ok(machine({ depot: { id: '11', nom: 'Dépôt fictif Nord' } }))).toBe(true);
    expect(ok(machine({ depot: null }))).toBe(true);
    expect(ok(machine())).toBe(true);
    for (const depot of [
      { id: '0', nom: 'Dépôt fictif' },
      { id: '01', nom: 'Dépôt fictif' },
      { id: '1234567890', nom: 'Dépôt fictif' },
      { id: 11, nom: 'Dépôt fictif' },
      { id: '11', nom: '' },
      { id: '11', nom: 'x'.repeat(TENABLE_BORNES.nomDepot + 1) },
      { id: '11', nom: '<b>Dépôt</b>' },
      { id: '11', nom: 'Dépôt fictif', description: 'Texte fictif' },
      '11',
    ])
      expect(ok(machine({ depot })), JSON.stringify(depot).slice(0, 60)).toBe(false);
  });

  it('liaison d’un dépôt : un périmètre ou null, rien d’autre', () => {
    expect(LiaisonDepotTenable.parse({ perimetreId: UUID })).toEqual({ perimetreId: UUID });
    expect(LiaisonDepotTenable.parse({ perimetreId: null })).toEqual({ perimetreId: null });
    expect(LiaisonDepotTenable.safeParse({}).success).toBe(false);
    expect(LiaisonDepotTenable.safeParse({ perimetreId: 'x' }).success).toBe(false);
    expect(LiaisonDepotTenable.safeParse({ perimetreId: UUID, nom: 'x' }).success).toBe(false);
    expect(DEPOT_TENABLE.test('999999999')).toBe(true);
  });
});
