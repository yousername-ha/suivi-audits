/* Module Vulnérabilités (ADR 0100, lot PC3) : onglet « Périmètres ». Résumé des machines d'un périmètre (priorité la plus
   haute, machines zero-day, exploitables, sans rôle), tri du plus critique au moins critique, présentation « au global »
   (ordre du rang, mode réduit, « et n autres »), identifiant de l'adresse. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  type CartePerimetreDto,
  comparerPerimetres,
  FAILLES_GRAVITE_VIDES,
  IdPerimetreVue,
  MARQUES_VIDES,
  type MachineMarqueeDto,
  machinesGlobal,
  type MarquesMachineDto,
  PERIMETRE_GLOBAL_REDUIT,
  perimetreOccupe,
  rangerPerimetres,
  repartirParc,
  resumerMachines,
  type RoleMachine,
  visiblesGlobal,
} from '../src/index.js';

const carte = (id: string, nom: string, c: Partial<CartePerimetreDto> = {}): CartePerimetreDto => ({
  id,
  nom,
  machines: 0,
  priorite: null,
  failles: { ...FAILLES_GRAVITE_VIDES },
  machinesExploitationAveree: 0,
  machinesExploitables: 0,
  machinesSansRole: 0,
  actifsExposes: 0,
  ...c,
});
const mq = (role: RoleMachine | null, marques: Partial<MarquesMachineDto> = {}) => ({
  role,
  marques: { ...MARQUES_VIDES, ...marques },
});

describe('lot PC3 : résumé des machines d’un périmètre', () => {
  it('priorité la plus haute, machines zero-day, exploitables et sans rôle', () => {
    expect(
      resumerMachines([
        mq('front', { priorite: 'P2', exploitable: true }),
        mq('back', { priorite: 'P1', exploitationAveree: true, exploitable: true }),
        mq(null, { priorite: 'P4' }),
        mq(null),
      ]),
    ).toEqual({
      machines: 4,
      priorite: 'P1',
      machinesExploitationAveree: 1,
      machinesExploitables: 2,
      machinesSansRole: 2,
    });
  });
  it('sans machine ou sans faille présente : aucune priorité', () => {
    expect(resumerMachines([])).toEqual({
      machines: 0,
      priorite: null,
      machinesExploitationAveree: 0,
      machinesExploitables: 0,
      machinesSansRole: 0,
    });
    expect(resumerMachines([mq('bdd')]).priorite).toBeNull();
  });
});

describe('lot PC3 : tri des périmètres', () => {
  it('priorité, puis machines zero-day, failles critiques, machines exploitables, failles élevées', () => {
    const p1 = carte('a', 'Zulu', { priorite: 'P1', machines: 1 });
    const p1zd = carte('b', 'Yankee', { priorite: 'P1', machinesExploitationAveree: 2, machines: 2 });
    const p2crit = carte('c', 'X-ray', { priorite: 'P2', failles: { ...FAILLES_GRAVITE_VIDES, critique: 4 } });
    const p2ex = carte('d', 'Whisky', { priorite: 'P2', machinesExploitables: 3 });
    const p2el = carte('e', 'Victor', { priorite: 'P2', failles: { ...FAILLES_GRAVITE_VIDES, elevee: 9 } });
    const p4 = carte('f', 'Uniform', { priorite: 'P4' });
    const vide = carte('g', 'Alpha');
    const actifs = carte('h', 'Tango', { actifsExposes: 2 });
    expect(rangerPerimetres([vide, p4, actifs, p2el, p2ex, p1, p2crit, p1zd]).map((c) => c.id)).toEqual([
      'b',
      'a',
      'c',
      'd',
      'e',
      'f',
      'h',
      'g',
    ]);
  });
  it('à égalité, le nom (sans casse ni accent) puis l’identifiant : ordre stable', () => {
    const a = carte('2', 'éclair');
    const b = carte('1', 'Eclair');
    const c = carte('3', 'Bravo');
    expect(rangerPerimetres([a, b, c]).map((x) => x.id)).toEqual(['3', '1', '2']);
    expect(comparerPerimetres(a, a)).toBe(0);
  });
  it('carte occupée : au moins une machine ou un actif exposé', () => {
    expect(perimetreOccupe(carte('a', 'A'))).toBe(false);
    expect(perimetreOccupe(carte('a', 'A', { machines: 1 }))).toBe(true);
    expect(perimetreOccupe(carte('a', 'A', { actifsExposes: 1 }))).toBe(true);
  });
});

describe('lot PC3 : présentation « au global »', () => {
  const machine = (position: number, role: RoleMachine | null) =>
    ({
      id: `m${position}`,
      role,
      rang: { position, total: 60, faits: [] },
      marques: MARQUES_VIDES,
    }) as unknown as MachineMarqueeDto;
  it('toutes les machines reçues ensemble, dans l’ordre du rang', () => {
    const recues = [machine(1, 'front'), machine(5, null), machine(2, 'bdd'), machine(3, 'back'), machine(4, 'front')];
    const zones = repartirParc(recues);
    const parc = { zones, total: 5, parZone: 250, tronquee: false };
    expect(machinesGlobal(parc).map((m) => m.rang.position)).toEqual([1, 2, 3, 4, 5]);
  });
  it('mode réduit : les premières, puis « et n autres » qui compte aussi ce que la route n’a pas rendu', () => {
    const recues = Array.from({ length: 40 }, (_, i) => i);
    expect(visiblesGlobal(recues, 40, false)).toEqual({
      visibles: recues.slice(0, PERIMETRE_GLOBAL_REDUIT),
      autres: 16,
    });
    expect(visiblesGlobal(recues, 40, true)).toEqual({ visibles: recues, autres: 0 });
    expect(visiblesGlobal(recues, 45, true).autres).toBe(5);
    expect(visiblesGlobal(recues.slice(0, 3), 3, false)).toEqual({ visibles: [0, 1, 2], autres: 0 });
  });
  it('identifiant de l’adresse : un UUID ou « aucun », rien d’autre', () => {
    expect(IdPerimetreVue.safeParse('aucun').success).toBe(true);
    expect(IdPerimetreVue.safeParse('00000000-0000-4000-8000-000000000001').success).toBe(true);
    expect(IdPerimetreVue.safeParse('tous').success).toBe(false);
    expect(IdPerimetreVue.safeParse('').success).toBe(false);
  });
});
