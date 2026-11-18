/* Module Vulnérabilités (ADR 0100, lot PC2) : écran « Machines », mode « Parc ». Répartition par zone dans l'ordre du rang,
   borne par zone avec totaux exacts, mode réduit et tuile « et n autres », marques d'une machine (priorité la plus haute,
   zero-day = exploitation avérée d'une faille présente, exploitable sans exploitation avérée), filtres de la route et
   préférence d'affichage mémorisée. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  type FailleMarquee,
  MARQUES_VIDES,
  marquesMachine,
  PARC_PAR_ZONE,
  PARC_REDUIT,
  Preferences,
  RechercheParc,
  repartirParc,
  visiblesZone,
  ZONE_PARC_LIBELLES,
  zoneParc,
  ZONES_PARC,
} from '../src/index.js';

type M = { id: string; role: 'front' | 'back' | 'bdd' | null };
const m = (id: string, role: M['role']): M => ({ id, role });
const f = (niveau: FailleMarquee['niveau'], exploitee = false, exploitable = false): FailleMarquee => ({
  niveau,
  exploitee,
  exploitable,
});

describe('lot PC2 : zones du parc', () => {
  it('quatre zones nommées, dans l’ordre front, back applicatif, base de données, rôle non indiqué', () => {
    expect(ZONES_PARC).toEqual(['front', 'back', 'bdd', 'aucun']);
    expect(ZONES_PARC.map((z) => ZONE_PARC_LIBELLES[z])).toEqual([
      'Front',
      'Back applicatif',
      'Base de données',
      'Rôle non indiqué',
    ]);
    expect(zoneParc(null)).toBe('aucun');
    expect(zoneParc('bdd')).toBe('bdd');
  });

  it('répartition dans l’ordre reçu (celui du rang), zones vides comprises', () => {
    const r = repartirParc([m('1', 'back'), m('2', null), m('3', 'back'), m('4', 'front')]);
    expect(r.map((z) => [z.zone, z.total, z.machines.map((x) => x.id)])).toEqual([
      ['front', 1, ['4']],
      ['back', 2, ['1', '3']],
      ['bdd', 0, []],
      ['aucun', 1, ['2']],
    ]);
  });

  it('borne par zone : les premières gardées, le total reste exact', () => {
    const parc = Array.from({ length: 7 }, (_, i) => m(String(i + 1), 'front'));
    const [front] = repartirParc(parc, 3);
    expect(front).toEqual({ zone: 'front', total: 7, exploitationAveree: 0, machines: parc.slice(0, 3) });
    // Machines marquées « zero-day » : comptées aussi au-delà de la borne.
    const marquees = parc.map((x, i) => ({ ...x, marques: { ...MARQUES_VIDES, exploitationAveree: i >= 4 } }));
    expect(repartirParc(marquees, 3)[0]).toMatchObject({ total: 7, exploitationAveree: 3 });
    expect(PARC_PAR_ZONE).toBe(250);
    // 150 machines (volume annoncé par le RSSI) : aucune zone tronquée par la borne.
    const grand = Array.from({ length: 150 }, (_, i) =>
      m(String(i), (['front', 'back', 'bdd', null] as const)[i % 4]!),
    );
    const zones = repartirParc(grand);
    expect(zones.reduce((s, z) => s + z.total, 0)).toBe(150);
    expect(zones.every((z) => z.machines.length === z.total)).toBe(true);
  });

  it('mode réduit : les plus prioritaires, puis « et n autres » ; dépliée ou grand écran : tout ce qui est reçu', () => {
    const recues = Array.from({ length: 12 }, (_, i) => i);
    expect(PARC_REDUIT).toEqual({ front: 5, back: 5, bdd: 5, aucun: 8 });
    expect(visiblesZone('front', recues, 12, 'reduit')).toEqual({ visibles: [0, 1, 2, 3, 4], autres: 7 });
    expect(visiblesZone('aucun', recues, 12, 'reduit').autres).toBe(4);
    expect(visiblesZone('front', recues, 12, 'reduit', true)).toEqual({ visibles: recues, autres: 0 });
    expect(visiblesZone('front', recues, 12, 'grand')).toEqual({ visibles: recues, autres: 0 });
    // Borne de la route : le reste compte aussi les machines non reçues.
    expect(visiblesZone('back', recues, 300, 'grand').autres).toBe(288);
    expect(visiblesZone('back', recues, 300, 'reduit').autres).toBe(295);
    // Peu de machines : aucune tuile « et n autres ».
    expect(visiblesZone('bdd', [1, 2], 2, 'reduit')).toEqual({ visibles: [1, 2], autres: 0 });
  });
});

describe('lot PC2 : marques d’une machine', () => {
  it('sans faille présente : aucune priorité, aucune marque', () => {
    expect(marquesMachine([])).toEqual(MARQUES_VIDES);
    expect(MARQUES_VIDES).toEqual({ priorite: null, exploitationAveree: false, exploitable: false });
  });
  it('priorité la plus haute des failles présentes', () => {
    expect(marquesMachine([f('P4'), f('P2'), f('P3')]).priorite).toBe('P2');
    expect(marquesMachine([f('P4')]).priorite).toBe('P4');
  });
  it('zero-day : une faille présente à exploitation avérée (P1)', () => {
    expect(marquesMachine([f('P3'), f('P1', true)])).toEqual({
      priorite: 'P1',
      exploitationAveree: true,
      exploitable: false,
    });
  });
  it('exploitable : seulement pour une faille sans exploitation avérée', () => {
    // La faille exploitée et exploitable ne donne que la marque zero-day.
    expect(marquesMachine([f('P1', true, true)])).toEqual({
      priorite: 'P1',
      exploitationAveree: true,
      exploitable: false,
    });
    expect(marquesMachine([f('P2', false, true)])).toEqual({
      priorite: 'P2',
      exploitationAveree: false,
      exploitable: true,
    });
    // Deux failles différentes : les deux marques.
    expect(marquesMachine([f('P1', true), f('P3', false, true)])).toEqual({
      priorite: 'P1',
      exploitationAveree: true,
      exploitable: true,
    });
  });
});

describe('lot PC2 : filtres de la route et préférence mémorisée', () => {
  it('filtres de la liste, sans page ; tout autre champ refusé', () => {
    expect(RechercheParc.parse({ q: ' srv ', role: 'aucun' })).toEqual({ q: 'srv', role: 'aucun' });
    expect(RechercheParc.safeParse({ page: 2 }).success).toBe(false);
    expect(RechercheParc.safeParse({ role: 'routeur' }).success).toBe(false);
    expect(RechercheParc.safeParse({ perimetre: 'pas-un-uuid' }).success).toBe(false);
    expect(RechercheParc.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });
  it('préférence de la personne : liste ou parc, réduit ou grand écran ; absente par défaut', () => {
    expect(Preferences.parse({}).vulnerabilitesMachines).toBeUndefined();
    expect(
      Preferences.parse({ vulnerabilitesMachines: { vue: 'parc', echelle: 'grand' } }).vulnerabilitesMachines,
    ).toEqual({ vue: 'parc', echelle: 'grand' });
    expect(Preferences.safeParse({ vulnerabilitesMachines: { vue: 'mur' } }).success).toBe(false);
    expect(Preferences.safeParse({ vulnerabilitesMachines: { echelle: 'immense' } }).success).toBe(false);
  });
});
