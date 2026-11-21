/* Lot R1 (ADR 0100) : barre de recherche globale du module Vulnérabilités. Schémas de la demande et de la réponse, forme d'un
   identifiant CVE, échappement des jokers, correspondance d'une machine, état d'une CVE en clair. Données fictives
   (adresses de documentation, domaines example.org). */
import { describe, expect, it } from 'vitest';
import {
  estIdentifiantCve,
  etatCveRecherche,
  machineCorrespond,
  motifLitteral,
  RECHERCHE_GLOBALE_BORNES,
  RechercheGlobaleReponse,
  RechercheGlobaleVulnerabilites,
  type RechercheGlobaleDto,
  ressembleACve,
  totalRechercheGlobale,
} from '../src/index.js';

describe('demande : saisie bornée de 2 à 200 caractères après rognage', () => {
  it.each<[string, boolean]>([
    ['ab', true],
    ['  ab  ', true],
    ['a', false],
    ['  a  ', false],
    ['', false],
    ['x'.repeat(200), true],
    ['x'.repeat(201), false],
    [`  ${'x'.repeat(200)}  `, true],
  ])('%j : %s', (q, ok) => {
    expect(RechercheGlobaleVulnerabilites.safeParse({ q }).success).toBe(ok);
  });
  it('rogne la saisie et refuse tout autre paramètre', () => {
    expect(RechercheGlobaleVulnerabilites.parse({ q: '  192.0.2.  ' })).toEqual({ q: '192.0.2.' });
    expect(RechercheGlobaleVulnerabilites.safeParse({ q: 'abc', page: 2 }).success).toBe(false);
    expect(RechercheGlobaleVulnerabilites.safeParse({}).success).toBe(false);
  });
});

describe('identifiant CVE et motif littéral', () => {
  it.each<[string, boolean, boolean]>([
    ['CVE-2026-94001', true, true],
    ['cve-2026-94001', true, true],
    [' CVE-2026-1234 ', true, true],
    ['CVE-2026-123', false, true],
    ['CVE-2026', false, true],
    ['cve-2', false, true],
    ['CVE-3026-12345', false, true],
    ['CVE-2026-1234567890', false, true],
    ['CVE-', false, false],
    ['glpi', false, false],
    ['2026-94001', false, false],
  ])('%j : bien formé %s, préfixe %s', (q, exact, prefixe) => {
    expect(estIdentifiantCve(q)).toBe(exact);
    expect(ressembleACve(q)).toBe(prefixe);
  });
  it.each<[string, string]>([
    ['100%', '100\\%'],
    ['srv_web', 'srv\\_web'],
    ['a\\b', 'a\\\\b'],
    ['%_\\', '\\%\\_\\\\'],
    ['texte simple', 'texte simple'],
  ])('%j devient %j', (q, attendu) => {
    expect(motifLitteral(q)).toBe(attendu);
  });
});

describe('correspondance d’une machine : nom ou système partiels, adresse IP par préfixe', () => {
  const m = { nom: 'SRV-Web-01.example.org', adresse: '192.0.2.41', systeme: 'Exemple Linux 9' };
  it.each<[string, boolean]>([
    ['srv-web', true],
    ['WEB-01', true],
    ['example.org', true],
    ['192.0.2.41', true],
    ['192.0.2.4', true],
    ['192.0.2.', true],
    ['0.2.41', false],
    ['linux', true],
    ['198.51.100.', false],
    ['srv-db', false],
    ['   ', true],
  ])('%j : %s', (q, attendu) => {
    expect(machineCorrespond(m, q)).toBe(attendu);
  });
  it('champs absents : ne correspondent à rien', () => {
    expect(machineCorrespond({ nom: null, adresse: null, systeme: null }, 'srv')).toBe(false);
  });
});

describe('état d’une CVE trouvée, en clair', () => {
  const r = (machines: number, machinesDeclarees: number, actifs: number, horsLecture: boolean) => ({
    machines,
    machinesDeclarees,
    actifs,
    horsLecture,
  });
  it.each<[ReturnType<typeof r>, string, string]>([
    [r(0, 0, 0, false), 'non_detectee', 'Non détectée sur le parc'],
    [r(0, 0, 0, true), 'hors_lecture', 'Présente hors des périmètres que vous lisez'],
    [r(1, 0, 0, false), 'presente', 'Détectée sur 1 machine'],
    [r(3, 0, 0, false), 'presente', 'Détectée sur 3 machines'],
    [r(0, 2, 0, false), 'presente', 'Déclarée sur 2 machines (produit relié)'],
    [r(0, 0, 1, false), 'presente', 'Exposée sur 1 actif exposé'],
    [r(2, 0, 4, true), 'presente', 'Détectée sur 2 machines, exposée sur 4 actifs exposés, et hors de vos périmètres'],
  ])('%j', (x, etat, libelle) => {
    expect(etatCveRecherche(x)).toEqual({ etat, libelle });
  });
});

describe('réponse : schéma borné', () => {
  const vide = { elements: [], total: 0 };
  const reponse: RechercheGlobaleDto = {
    q: 'CVE-2026-94001',
    cves: {
      elements: [
        {
          cve: 'CVE-2026-94001',
          veille: true,
          resume: 'Fictional Product RCE',
          produit: 'Editeur fictif Produit fictif',
          gravite: 'CRITICAL',
          score: 9.8,
          kev: true,
          machines: 1,
          machinesDeclarees: 0,
          actifs: 1,
          horsLecture: true,
          fiche: true,
        },
      ],
      total: 1,
    },
    machines: vide,
    actifs: {
      elements: [
        {
          id: '0190a000-0000-7000-8000-000000000011',
          type: 'domaine',
          valeur: 'www.example.org',
          adresse: '203.0.113.5',
          perimetreNom: null,
          alertesOuvertes: 0,
        },
      ],
      total: 1,
    },
    produits: vide,
    technologies: vide,
    controles: vide,
    cveInconnue: null,
  };
  it('accepte une réponse complète et compte ses résultats', () => {
    expect(RechercheGlobaleReponse.parse(reponse)).toEqual(reponse);
    expect(totalRechercheGlobale(reponse)).toBe(2);
  });
  it('refuse un groupe au-delà de la borne et tout champ inattendu', () => {
    const trop = Array.from({ length: RECHERCHE_GLOBALE_BORNES.parGroupe + 1 }, () => reponse.cves.elements[0]!);
    expect(RechercheGlobaleReponse.safeParse({ ...reponse, cves: { elements: trop, total: 9 } }).success).toBe(false);
    expect(RechercheGlobaleReponse.safeParse({ ...reponse, nvd: true }).success).toBe(false);
  });
  it('CVE inconnue : champ dédié, sans aucun résultat', () => {
    const inconnue = {
      ...reponse,
      q: 'CVE-2026-99999',
      cves: vide,
      actifs: vide,
      cveInconnue: { cve: 'CVE-2026-99999' },
    };
    expect(RechercheGlobaleReponse.parse(inconnue).cveInconnue).toEqual({ cve: 'CVE-2026-99999' });
    expect(totalRechercheGlobale(inconnue)).toBe(0);
  });
});
