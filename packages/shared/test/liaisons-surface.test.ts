/* Module Vulnérabilités (ADR 0100, lot ALH3) : actif exposé relié aux machines internes. Normalisation des adresses et des
   noms, critères d'une proposition (adresse, nom complet, nom court), transitions reprises du rapprochement des failles
   (rejet non reproposé à données égales, confirmation qui tient, critère perdu qui retire), schémas d'entrée. Données
   fictives : adresses de 192.0.2.0/24, 198.51.100.0/24 et 2001:db8::/32, noms en .example et .invalid. */
import { describe, expect, it } from 'vitest';
import {
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
