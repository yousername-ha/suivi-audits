/* Module Vulnérabilités (ADR 0100, lot ALH3) : actif exposé relié aux machines internes. Normalisation des adresses et des
   noms, critères d'une proposition (adresse, nom complet, nom court), transitions reprises du rapprochement des failles
   (rejet non reproposé à données égales, confirmation qui tient, critère perdu qui retire), schémas d'entrée. Données
   fictives : adresses de 192.0.2.0/24, 198.51.100.0/24 et 2001:db8::/32, noms en .example et .invalid.
   Lot ALH5 : joker « * » (correspondance littérale, sans expression régulière) et schémas de la liaison en masse. */
import { describe, expect, it } from 'vitest';
import {
  ApplicationLiaisonMasse,
  correspondanceJoker,
  DemandeLiaisonMasse,
  LIAISONS_MASSE_MAX,
  MotifJoker,
  nombreJokers,
  ORIGINES_LIAISON_MACHINE,
  adressesActif,
  CorpsDeliaisonMachine,
  CorpsLiaisonMachine,
  critereLiaisonMachine,
  DecisionLiaisonMachine,
  nomCourt,
  normaliserAdresseIp,
  normaliserNomDns,
  RechercheActifsAlh,
  RechercheLiaisonsMachines,
  transitionLiaisonMachine,
} from '../src/index.js';

describe('normalisation', () => {
  it('adresses IP : IPv4 sans zéro de tête, IPv6 développée, IPv4 portée par une IPv6, forme inconnue écartée', () => {
    expect(normaliserAdresseIp('192.0.2.10')).toBe('192.0.2.10');
    expect(normaliserAdresseIp(' 192.000.002.010 ')).toBe('192.0.2.10');
    expect(normaliserAdresseIp('2001:DB8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(normaliserAdresseIp('2001:db8:0:0:0:0:0:1')).toBe(normaliserAdresseIp('2001:db8::1'));
    expect(normaliserAdresseIp('::ffff:192.0.2.10')).toBe('192.0.2.10');
    expect(normaliserAdresseIp('::ffff:c000:20a')).toBe('192.0.2.10');
    for (const x of ['192.0.2.256', '192.0.2', '2001:db8::1::2', 'g::1', '', null, undefined, '1:2:3:4:5:6:7:8:9'])
      expect(normaliserAdresseIp(x)).toBeNull();
  });
  it('noms : minuscules, point final retiré, joker et caractères inattendus écartés ; nom court', () => {
    expect(normaliserNomDns('Srv-Web.Exemple.example.')).toBe('srv-web.exemple.example');
    expect(normaliserNomDns('*.exemple.example')).toBeNull();
    expect(normaliserNomDns('srv web')).toBeNull();
    expect(normaliserNomDns('srv..exemple')).toBeNull();
    expect(nomCourt('srv-web.interne.invalid')).toBe('srv-web');
    expect(nomCourt('intranet')).toBe('intranet');
    expect(nomCourt(null)).toBeNull();
  });
  it('adresses d’un actif : la sienne pour un hôte, celle de résolution pour un domaine', () => {
    expect(adressesActif({ type: 'hote', valeur: '192.0.2.10', adresse: null })).toEqual(['192.0.2.10']);
    expect(adressesActif({ type: 'domaine', valeur: 'www.exemple.example', adresse: '198.51.100.7' })).toEqual([
      '198.51.100.7',
    ]);
    expect(adressesActif({ type: 'domaine', valeur: 'www.exemple.example', adresse: null })).toEqual([]);
  });
});

describe('critères d’une proposition', () => {
  const hote = { type: 'hote' as const, valeur: '192.0.2.10', adresse: null };
  const domaine = (valeur: string, adresse: string | null = null) => ({ type: 'domaine' as const, valeur, adresse });
  it('même adresse (hôte ou domaine qui y résout) ; l’adresse prime sur le nom', () => {
    expect(critereLiaisonMachine(hote, { nom: 'srv-a.interne.invalid', adresse: '192.0.2.10' })).toBe('adresse');
    expect(critereLiaisonMachine(hote, { nom: null, adresse: '192.0.2.11' })).toBeNull();
    expect(
      critereLiaisonMachine(domaine('srv-a.exemple.example', '192.0.2.10'), {
        nom: 'srv-a.exemple.example',
        adresse: '192.0.2.10',
      }),
    ).toBe('adresse');
  });
  it('nom complet égal, ou première étiquette du domaine égale au nom court de la machine', () => {
    expect(
      critereLiaisonMachine(domaine('srv-a.exemple.example'), { nom: 'srv-a.exemple.example', adresse: null }),
    ).toBe('nom_complet');
    expect(critereLiaisonMachine(domaine('SRV-A.exemple.example.'), { nom: 'srv-a', adresse: null })).toBe('nom_court');
    expect(
      critereLiaisonMachine(domaine('srv-a.exemple.example'), { nom: 'srv-a.interne.invalid', adresse: null }),
    ).toBe('nom_court');
    expect(critereLiaisonMachine(domaine('srv-ab.exemple.example'), { nom: 'srv-a', adresse: null })).toBeNull();
    expect(critereLiaisonMachine(domaine('*.exemple.example'), { nom: 'exemple', adresse: null })).toBeNull();
    // Un hôte n'a pas de nom chez l'éditeur : jamais de critère par le nom.
    expect(
      critereLiaisonMachine({ type: 'hote', valeur: '192.0.2.10', adresse: null }, { nom: '192', adresse: null }),
    ).toBeNull();
  });
});

describe('transitions (règle du rapprochement des failles)', () => {
  const e = { empreinteActif: 'a'.repeat(64), empreinteMachine: 'b'.repeat(64) };
  const autre = { empreinteActif: 'c'.repeat(64), empreinteMachine: 'b'.repeat(64) };
  it('aucune ligne : proposée si un critère tient, rien sinon', () => {
    expect(transitionLiaisonMachine(null, 'adresse', e)).toEqual({ statut: 'proposee', garderDecision: false });
    expect(transitionLiaisonMachine(null, null, e)).toBeNull();
  });
  it('confirmée : tient, critère perdu ou données changées', () => {
    expect(transitionLiaisonMachine({ statut: 'confirmee', ...e }, null, autre)).toEqual({
      statut: 'confirmee',
      garderDecision: true,
    });
  });
  it('rejetée : gardée à données égales, même sans critère ; reproposée ou retirée quand elles changent', () => {
    expect(transitionLiaisonMachine({ statut: 'rejetee', ...e }, 'adresse', e)).toEqual({
      statut: 'rejetee',
      garderDecision: true,
    });
    expect(transitionLiaisonMachine({ statut: 'rejetee', ...e }, null, e)?.statut).toBe('rejetee');
    expect(transitionLiaisonMachine({ statut: 'rejetee', ...e }, 'nom_court', autre)).toEqual({
      statut: 'proposee',
      garderDecision: false,
    });
    expect(transitionLiaisonMachine({ statut: 'rejetee', ...e }, null, autre)?.statut).toBe('retiree');
  });
  it('proposée ou retirée : suit le critère', () => {
    expect(transitionLiaisonMachine({ statut: 'proposee', ...e }, null, e)?.statut).toBe('retiree');
    expect(transitionLiaisonMachine({ statut: 'retiree', ...e }, 'adresse', autre)?.statut).toBe('proposee');
  });
});

describe('schémas', () => {
  it('décision, liaison, déliaison, recherches', () => {
    expect(DecisionLiaisonMachine.parse({ decision: 'rejeter' })).toEqual({ decision: 'rejeter', note: '' });
    expect(DecisionLiaisonMachine.safeParse({ decision: 'garder' }).success).toBe(false);
    expect(CorpsLiaisonMachine.safeParse({ machineId: 'x' }).success).toBe(false);
    expect(
      CorpsLiaisonMachine.safeParse({ machineId: '00000000-0000-4000-8000-000000000001', role: 'front' }).success,
    ).toBe(false);
    expect(CorpsDeliaisonMachine.safeParse({ note: 'a\u0007b' }).success).toBe(false);
    expect(RechercheLiaisonsMachines.parse({})).toEqual({ statut: 'proposee', page: 1 });
    expect(RechercheLiaisonsMachines.safeParse({ statut: 'retiree' }).success).toBe(false);
    expect(RechercheActifsAlh.parse({ liaison: 'a_relier' })).toMatchObject({ liaison: 'a_relier' });
    expect(RechercheActifsAlh.safeParse({ liaison: 'autre' }).success).toBe(false);
  });
});

describe('joker « * » (lot ALH5, décision C)', () => {
  it.each([
    ['pre-*.exemple.example', 'pre-web01.exemple.example', ['web01']],
    ['PRE-*.Exemple.Example', 'pre-WEB01.exemple.example', ['web01']],
    ['srv-pre-*', 'srv-pre-web01', ['web01']],
    ['*.exemple.example', 'exemple.example', null],
    ['*.exemple.example', '.exemple.example', ['']],
    ['192.0.2.*', '192.0.2.10', ['10']],
    ['192.0.2.*', '198.51.100.10', null],
    ['pre*-*', 'preprod-web', ['prod', 'web']],
    ['*-*', 'a-b-c', ['a', 'b-c']],
    ['exact.exemple.example', 'EXACT.exemple.example', []],
    ['exact.exemple.example', 'exact.exemple.example.autre', null],
    ['a*a', 'a', null],
    ['a*a', 'aa', ['']],
    ['%', '%', []],
  ] as const)('%s sur %s → %j', (motif, valeur, attendu) => {
    expect(correspondanceJoker(motif, valeur)).toEqual(attendu);
  });

  it('aucun métacaractère hors « * » : « . », « _ », « % », « ? » sont littéraux', () => {
    expect(correspondanceJoker('pre-web.exemple.example', 'pre-webxexemple.example')).toBeNull();
    expect(correspondanceJoker('srv_*', 'srva01')).toBeNull();
    expect(correspondanceJoker('srv_*', 'srv_01')).toEqual(['01']);
  });

  it('temps linéaire : un motif à nombreux jokers sur une longue valeur répond tout de suite', () => {
    const debut = Date.now();
    expect(correspondanceJoker(`${'a*'.repeat(100)}b`, 'a'.repeat(5000))).toBeNull();
    expect(Date.now() - debut).toBeLessThan(500);
  });

  it('motif : caractères admis, au moins un caractère qui n’est pas un joker', () => {
    expect(MotifJoker.parse(' pre-*.exemple.example ')).toBe('pre-*.exemple.example');
    expect(MotifJoker.parse('2001:db8::*')).toBe('2001:db8::*');
    for (const x of ['', '*', '**', 'pre-%', 'pre-?', 'a|b', '(a)', 'pre-[0-9]', 'a b', 'x'.repeat(254)])
      expect(MotifJoker.safeParse(x).success, x).toBe(false);
    expect(nombreJokers('pre-*-*.exemple.example')).toBe(2);
  });

  it('demande : un pour un exige autant de jokers (au moins un) ; tous vers une machine exige la machine', () => {
    expect(
      DemandeLiaisonMasse.safeParse({
        mode: 'un_pour_un',
        motifActifs: 'pre-*.exemple.example',
        motifMachines: 'srv-pre-*',
      }).success,
    ).toBe(true);
    expect(
      DemandeLiaisonMasse.safeParse({
        mode: 'un_pour_un',
        motifActifs: 'pre-*.exemple.example',
        motifMachines: 'srv-*-*',
      }).success,
    ).toBe(false);
    expect(
      DemandeLiaisonMasse.safeParse({
        mode: 'un_pour_un',
        motifActifs: 'web.exemple.example',
        motifMachines: 'srv-web',
      }).success,
    ).toBe(false);
    const id = '0190a000-0000-7000-8000-000000000001';
    expect(
      DemandeLiaisonMasse.safeParse({ mode: 'tous_vers_une', motifActifs: '*.exemple.example', machineId: id }).success,
    ).toBe(true);
    expect(DemandeLiaisonMasse.safeParse({ mode: 'tous_vers_une', motifActifs: '*.exemple.example' }).success).toBe(
      false,
    );
    expect(
      DemandeLiaisonMasse.safeParse({ mode: 'tous_vers_une', motifActifs: 'a*', machineId: id, autre: 1 }).success,
    ).toBe(false);
  });

  it('application : paires bornées, empreinte au bon format ; origine « masse » admise', () => {
    const paire = {
      actifId: '0190a000-0000-7000-8000-000000000001',
      machineId: '0190a000-0000-7000-8000-000000000002',
      versionLiaisons: 1,
    };
    const demande = { mode: 'tous_vers_une', motifActifs: 'a*', machineId: paire.machineId };
    const e = 'a'.repeat(64);
    expect(ApplicationLiaisonMasse.safeParse({ demande, empreinte: e, paires: [paire] }).success).toBe(true);
    expect(ApplicationLiaisonMasse.safeParse({ demande, empreinte: e, paires: [] }).success).toBe(false);
    expect(ApplicationLiaisonMasse.safeParse({ demande, empreinte: 'xyz', paires: [paire] }).success).toBe(false);
    expect(
      ApplicationLiaisonMasse.safeParse({
        demande,
        empreinte: e,
        paires: Array.from({ length: LIAISONS_MASSE_MAX + 1 }, () => paire),
      }).success,
    ).toBe(false);
    expect(ORIGINES_LIAISON_MACHINE).toContain('masse');
  });
});
