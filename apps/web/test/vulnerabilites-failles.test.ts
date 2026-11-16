/* Module Vulnérabilités (ADR 0100, lot V5) : écrans « Failles détectées » et « Machines ». Menu conditionné par le droit du
   module, adresses de recherche et de filtres, marques (exploitée, exploitable, non maintenu), fiche (CVE, vecteur CVSS et
   correctif tels quels, machines par rôle, lien « voir aussi » contrôlé), textes de Tenable rendus comme texte simple,
   affectation en masse (versions jointes), bandeau des machines sans rôle. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { Action, ConstatDto, ConstatResumeDto, MachineDto, Module } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { famillesVisibles, localiser } from '../src/navigation';
import { ConstatsTable, EtatSynchronisations, FicheConstat } from '../src/vulnerabilites/FaillesDetectees';
import { BandeauSansRole, MachinesTable } from '../src/vulnerabilites/Machines';
import {
  corpsAffectation,
  FILTRES_CONSTATS_VIDES,
  FILTRES_MACHINES_VIDES,
  groupesParRole,
  libelleEpssTenable,
  libelleMachine,
  lienVoirAussi,
  marquesConstat,
  resumeCves,
  urlConstats,
  urlMachines,
} from '../src/vulnerabilites/failles';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const rien = () => undefined;

const resume = (c: Partial<ConstatResumeDto> = {}): ConstatResumeDto => ({
  id: '00000000-0000-4000-8000-000000000c01',
  plugin: '900001',
  nom: 'Exemple Linux : noyau (EX-2026-0001)',
  gravite: 'critique',
  famille: 'Misc.',
  cvss3Score: 9.1,
  vpr: 5,
  epss: 0.0056,
  exploitable: true,
  exploite: true,
  nonMaintenu: false,
  finSupportLe: null,
  nombreCves: 7,
  cves: ['CVE-2026-90005', 'CVE-2026-90004'],
  machines: 3,
  derniereDetection: '2026-11-16T06:04:48.000Z',
  ...c,
});
const machineDetection = (nom: string | null, role: 'front' | 'back' | 'bdd' | null) => ({
  machineId: `00000000-0000-4000-8000-0000000000${nom ? nom.length : 99}`,
  nom,
  adresse: '192.0.2.10',
  role,
  perimetreId: null,
  perimetreNom: 'Périmètre fictif',
  port: 443,
  protocole: 'TCP',
  premiere: null,
  derniere: null,
  attenue: false,
  risqueAccepte: true,
  risqueRequalifie: false,
});
const fiche = (c: Partial<ConstatDto> = {}): ConstatDto => ({
  ...resume(),
  synopsis: 'The remote host is missing a security update.',
  correctif: 'Update the affected packages.',
  cvss3Vecteur: 'AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H',
  exploitLibelle: 'Exploits are available',
  failleLe: null,
  correctifLe: null,
  voirAussi: 'https://example.org/advisory',
  cvesTronquees: false,
  cvesDetail: [
    { cve: 'CVE-2026-90002', kev: true },
    { cve: 'CVE-2026-90001', kev: false },
  ],
  parRole: {
    front: [machineDetection('web-01.exemple.invalid', 'front')],
    back: [],
    bdd: [machineDetection('bdd-01.exemple.invalid', 'bdd')],
    aucun: [machineDetection(null, null)],
  },
  integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif' },
  ...c,
});
const machine = (m: Partial<MachineDto> = {}): MachineDto => ({
  id: '00000000-0000-4000-8000-000000000m01'.replace('m', 'a'),
  nom: 'srv-exemple-01.exemple.invalid',
  adresse: '192.0.2.11',
  systeme: 'Linux Kernel 5.14 on Exemple Linux 9',
  role: null,
  perimetreId: null,
  perimetreNom: null,
  exposition: 'internal',
  acr: 4,
  premiere: null,
  derniere: null,
  source: 'tenable',
  integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif' },
  compteurs: { critique: 2, elevee: 1, moyenne: 0, faible: 0, exploites: 1, exploitables: 2 },
  version: 4,
  ...m,
});

describe('menu et aide', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('« Failles détectées » et « Machines » : Risques > Vulnérabilités, avec la lecture du module seulement', () => {
    const avec = famillesVisibles(seulement(['vulnerabilites:lire']));
    const d = avec.find((f) => f.famille.id === 'risques')!.destinations.find((x) => x.id === 'vulnerabilites')!;
    expect(d.rubriques.map((p) => p.id)).toEqual([
      'vulnerabilites-produits',
      'vulnerabilites-veille',
      'vulnerabilites-failles',
      'vulnerabilites-machines',
    ]);
    expect(localiser('/vulnerabilites/failles')?.rubrique.id).toBe('vulnerabilites-failles');
    expect(localiser('/vulnerabilites/machines')?.rubrique.id).toBe('vulnerabilites-machines');
    // Un droit métier seul n'ouvre pas le module (droits par défaut resserrés, lot V5).
    expect(
      famillesVisibles(seulement(['pilotage:lire', 'audit:lire']))
        .find((f) => f.famille.id === 'risques')
        ?.destinations.map((x) => x.id),
    ).not.toContain('vulnerabilites');
  });
  it('un article d’aide décrit la lecture par périmètre et l’affectation', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-failles')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    const texte = a.steps.join(' ');
    for (const m of [
      'périmètres que vous pouvez lire',
      'non maintenu',
      'catalogue KEV',
      'en anglais',
      'sans nom ni adresse',
    ])
      expect(texte).toContain(m);
  });
});

describe('adresses et libellés', () => {
  it('constats : recherche et filtres ; machines : nom, rôle, périmètre', () => {
    expect(urlConstats(FILTRES_CONSTATS_VIDES)).toBe('/api/vulnerabilites/constats');
    expect(
      urlConstats({ q: ' CVE-2026 ', gravite: 'critique', exploite: true, exploitable: true, nonMaintenu: true }, 2),
    ).toBe(
      '/api/vulnerabilites/constats?q=CVE-2026&gravite=critique&exploite=oui&exploitable=oui&nonMaintenu=oui&page=2',
    );
    expect(urlMachines(FILTRES_MACHINES_VIDES)).toBe('/api/vulnerabilites/machines');
    expect(urlMachines({ q: 'srv', role: 'aucun', perimetre: 'aucun' }, 3)).toBe(
      '/api/vulnerabilites/machines?q=srv&role=aucun&perimetre=aucun&page=3',
    );
  });
  it('marques, CVE résumées, EPSS en pourcentage, nom de machine', () => {
    expect(marquesConstat(resume()).map((m) => m.libelle)).toEqual(['Exploitée (KEV)', 'Exploitable']);
    expect(
      marquesConstat(resume({ exploite: false, exploitable: false, nonMaintenu: true })).map((m) => m.libelle),
    ).toEqual(['Non maintenu']);
    expect(resumeCves(resume())).toBe('CVE-2026-90005, CVE-2026-90004 et 5 autres');
    expect(resumeCves(resume({ cves: [], nombreCves: 0 }))).toBe('Aucune CVE');
    expect(libelleEpssTenable(0.0056)).toBe('0,56 %');
    expect(libelleEpssTenable(null)).toBe('—');
    expect(libelleMachine({ nom: null, adresse: '192.0.2.4' })).toBe('192.0.2.4');
    expect(libelleMachine({ nom: null, adresse: null })).toBe('Machine sans nom');
  });
  it('lien « voir aussi » seulement en https ; groupes par rôle dans l’ordre, vides omis', () => {
    expect(lienVoirAussi(fiche())).toBe('https://example.org/advisory');
    expect(lienVoirAussi(fiche({ voirAussi: 'javascript:alert(1)' }))).toBeNull();
    expect(groupesParRole(fiche()).map((g) => g.libelle)).toEqual(['Front', 'Base de données', 'Rôle non renseigné']);
  });
  it('affectation en masse : versions jointes, rôle ou périmètre retiré par « aucun », inchangé si vide', () => {
    const m = [machine(), machine({ id: '00000000-0000-4000-8000-0000000000a2', version: 7 })];
    expect(corpsAffectation(m, 'front', '')).toEqual({
      machines: [
        { id: m[0]!.id, version: 4 },
        { id: m[1]!.id, version: 7 },
      ],
      role: 'front',
    });
    expect(corpsAffectation(m, 'aucun', 'aucun')).toMatchObject({ role: null, perimetreId: null });
    expect(corpsAffectation(m, '', '00000000-0000-4000-8000-000000000001')).toEqual({
      machines: expect.any(Array),
      perimetreId: '00000000-0000-4000-8000-000000000001',
    });
  });
});

describe('rendu', () => {
  it('liste des constats : marques, CVE, nombre de machines ; texte de Tenable en texte simple', () => {
    const html = rendu(
      createElement(ConstatsTable, {
        constats: [resume({ nom: '<img src=x onerror=alert(1)> Exemple' })],
        onOuvrir: rien,
      }),
    );
    expect(html).toContain('Exploitée (KEV)');
    expect(html).toContain('CVE-2026-90005, CVE-2026-90004 et 5 autres');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('<img');
    expect(rendu(createElement(ConstatsTable, { constats: [], onOuvrir: rien }))).toContain('Aucune faille détectée');
  });
  it('fiche : correctif et vecteur tels quels, CVE du KEV marquées, machines par rôle, lien sans référent', () => {
    const html = rendu(createElement(FicheConstat, { c: fiche() }));
    expect(html).toContain('Update the affected packages.');
    expect(html).toContain('AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H');
    expect(html).toContain('CVE-2026-90002 (KEV), CVE-2026-90001');
    expect(html).toContain('Front (1)');
    expect(html).toContain('Base de données (1)');
    expect(html).toContain('Rôle non renseigné (1)');
    expect(html).toContain('web-01.exemple.invalid');
    expect(html).toContain('Risque accepté');
    expect(html).toMatch(
      /href="https:\/\/example\.org\/advisory"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*href="https:\/\/example\.org\/advisory"/,
    );
    const sansCve = rendu(
      createElement(FicheConstat, {
        c: fiche({ cvesDetail: [], nombreCves: 0, cves: [], nonMaintenu: true, voirAussi: null, cvss3Vecteur: null }),
      }),
    );
    expect(sansCve).toContain('plus maintenu');
    expect(sansCve).toContain('Vecteur CVSS non publié.');
    expect(sansCve).not.toContain('Voir aussi');
  });
  it('machines : compteurs par gravité, rôle manquant signalé, cases à cocher seulement pour l’affectation', () => {
    const html = rendu(createElement(MachinesTable, { machines: [machine()] }));
    expect(html).toContain('2 · 1 · 0 · 0');
    expect(html).toContain('Rôle non renseigné');
    expect(html).not.toContain('type="checkbox"');
    const choix = rendu(
      createElement(MachinesTable, { machines: [machine()], selection: new Set<string>(), onSelection: rien }),
    );
    expect(choix).toContain('type="checkbox"');
    expect(rendu(createElement(BandeauSansRole, { n: 3 }))).toContain('3 machines lisibles sans rôle');
    expect(rendu(createElement(BandeauSansRole, { n: 0 }))).not.toContain('sans rôle');
  });
  it('état des synchronisations : aucune instance, ou dernier bilan', () => {
    expect(rendu(createElement(EtatSynchronisations, { etats: [] }))).toContain('Pilotage &gt; Intégrations');
    const html = rendu(
      createElement(EtatSynchronisations, {
        etats: [
          {
            integrationId: '00000000-0000-4000-8000-0000000000a1',
            nom: 'Tenable fictif',
            actif: true,
            gravites: ['critique', 'elevee'],
            derniere: {
              id: '00000000-0000-4000-8000-0000000000e1',
              etat: 'recu',
              origine: 'planifie',
              demandeLe: '2026-11-16T03:00:00.000Z',
              termineLe: '2026-11-16T03:05:00.000Z',
              bilan: {
                elements: 6,
                pages: 1,
                constats: 1,
                detections: 1,
                machines: 1,
                hotes: 3,
                ecartes: 0,
                tronque: false,
                inventaire: { ok: true, erreur: null },
              },
              erreur: null,
            },
            derniereCompleteLe: '2026-11-16T03:05:00.000Z',
            inventaire: { ok: true, erreur: null, le: '2026-11-16T03:05:00.000Z' },
          },
        ],
      }),
    );
    expect(html).toContain('Tenable fictif');
    expect(html).toContain('1 faille sur 1 machine (1 détection)');
    expect(html).toContain('3 machines lues');
  });
});
