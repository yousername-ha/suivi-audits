/* Module Vulnérabilités (ADR 0100, lot PC3) : onglet « Périmètres », côté interface. Adresses (route, page partageable,
   liste filtrée), lecture de l'adresse, noms accessibles et libellés ; rendu : cartes (bouton, priorité en texte et en
   couleur, gravités, marques, actifs exposés, carte « Sans périmètre »), détail par ligne (zones et murs du parc) et au
   global (ordre du rang, réduit, « et n autres »), mention « Exposée sur Internet » d'une tuile et liste des expositions,
   bandeau de première ligne, aucun trait entre machines, aucun style en ligne ; menu, aide, lien depuis la liste des
   machines. Données entièrement fictives (noms en .invalid et .example, adresses de 192.0.2.0/24 et 198.51.100.0/24). */
import { MantineProvider } from '@mantine/core';
import {
  type CartePerimetreDto,
  type DetailPerimetreDto,
  FAILLES_GRAVITE_VIDES,
  type MachineMarqueeDto,
  type MarquesMachineDto,
  MARQUES_VIDES,
  PERIMETRE_GLOBAL_REDUIT,
  repartirParc,
  type RoleMachine,
} from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { famillesVisibles, localiser } from '../src/navigation';
import type { Action, Module } from '@suivi/shared';
import { MachinesTable } from '../src/vulnerabilites/Machines';
import { CartePerimetre, DetailPerimetre, ListePerimetres } from '../src/vulnerabilites/Perimetres';
import {
  adresseListeMachines,
  adressePerimetre,
  bandeauPremiereLigne,
  filtresDepuisAdresse,
  libelleExpositionTuile,
  lireAdresse,
  nomAccessibleCarte,
  urlDetailPerimetre,
  URL_PERIMETRES,
} from '../src/vulnerabilites/perimetres-presentation';

// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      { withCssVariables: false, withGlobalClasses: false },
      createElement(MemoryRouter, null, e),
    ),
  );
const rien = () => undefined;
const PERIM = '00000000-0000-4000-8000-0000000000a1';

const carte = (c: Partial<CartePerimetreDto> = {}): CartePerimetreDto => ({
  id: PERIM,
  nom: 'Portail fictif',
  machines: 5,
  priorite: 'P1',
  failles: { critique: 6, elevee: 3, moyenne: 0, faible: 1 },
  machinesExploitationAveree: 2,
  machinesExploitables: 1,
  machinesSansRole: 0,
  actifsExposes: 2,
  ...c,
});

let n = 0;
const machine = (
  nom: string,
  role: RoleMachine | null,
  marques: Partial<MarquesMachineDto> = {},
  position?: number,
): MachineMarqueeDto => {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    nom,
    adresse: `192.0.2.${n % 250}`,
    systeme: null,
    role,
    perimetreId: PERIM,
    perimetreNom: 'Portail fictif',
    perimetreOrigine: 'machine',
    depot: null,
    exposition: null,
    acr: null,
    aes: null,
    premiere: null,
    derniere: null,
    source: 'tenable',
    integration: { id: '00000000-0000-4000-8000-0000000000b1', nom: 'Tenable fictif', type: 'tenable' },
    compteurs: {
      critique: marques.priorite === 'P1' ? 1 : 0,
      elevee: 0,
      moyenne: 0,
      faible: 0,
      exploites: 0,
      exploitables: 0,
      declarees: 0,
      exploitationAveree: marques.exploitationAveree ? 1 : 0,
    },
    rang: { position: position ?? n, total: 60, faits: [] },
    finDeSupport: false,
    finsDeSupport: [],
    version: 1,
    marques: { ...MARQUES_VIDES, ...marques },
  };
};
const detailDe = (
  machines: MachineMarqueeDto[],
  c: Partial<CartePerimetreDto> = {},
  borne = 250,
): DetailPerimetreDto => {
  const zones = repartirParc(
    [...machines].sort((a, b) => a.rang.position - b.rang.position),
    borne,
  );
  return {
    carte: carte(c),
    parc: { zones, total: machines.length, parZone: borne, tronquee: zones.some((z) => z.total > z.machines.length) },
    expositions: [],
  };
};
/** Balises propres à l'écran (classes parc-*, perim-*, pc-*) : aucune ne porte d'attribut style ; ni <style> ni <script>. */
const sansStyle = (html: string) => {
  const propres = (html.match(/<[^>]*class="(?:parc|perim|pc|poste)[^"]*"[^>]*>/gi) ?? []).filter(
    (b) => !/mantine-/i.test(b),
  );
  expect(propres.length).toBeGreaterThan(0);
  expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/<script/i);
};
const tuiles = (html: string) =>
  [...html.matchAll(/<button[^>]*class="parc-tuile[^"]*"[^>]*aria-label="([^"]*)"/gi)].map((x) => x[1]!);

describe('lot PC3 : adresses et libellés', () => {
  it('route, détail, page partageable et liste des machines filtrée', () => {
    expect(URL_PERIMETRES).toBe('/api/vulnerabilites/machines/perimetres');
    expect(urlDetailPerimetre('aucun')).toBe('/api/vulnerabilites/machines/perimetres/aucun');
    expect(adressePerimetre(PERIM)).toBe(`/vulnerabilites/perimetres?perimetre=${PERIM}`);
    expect(adressePerimetre(null, 'global')).toBe('/vulnerabilites/perimetres?perimetre=aucun&presentation=global');
    expect(adresseListeMachines(PERIM, 'bdd')).toBe(`/vulnerabilites/machines?perimetre=${PERIM}&role=bdd`);
    expect(adresseListeMachines(null)).toBe('/vulnerabilites/machines?perimetre=aucun');
  });
  it('lecture de l’adresse : présentation inconnue ignorée ; filtres de la liste des machines', () => {
    expect(lireAdresse(new URLSearchParams(''))).toEqual({ perimetre: null, presentation: 'lignes' });
    expect(lireAdresse(new URLSearchParams(`perimetre=${PERIM}&presentation=global`))).toEqual({
      perimetre: PERIM,
      presentation: 'global',
    });
    expect(lireAdresse(new URLSearchParams('perimetre=aucun&presentation=carte')).presentation).toBe('lignes');
    expect(filtresDepuisAdresse(new URLSearchParams(`perimetre=${PERIM}&role=front`))).toEqual({
      role: 'front',
      perimetre: PERIM,
      groupe: '',
    });
    expect(filtresDepuisAdresse(new URLSearchParams('role=routeur'))).toEqual({ role: '', perimetre: '', groupe: '' });
    // Lot GRP-MACHINES : « Voir le parc » depuis la fiche d'un fournisseur (`?groupe=<uuid>`), « Sans groupe » (`aucun`) ;
    // toute autre valeur est ignorée.
    const GROUPE = '0b1c2d3e-4f50-4617-8899-aabbccddeeff';
    expect(filtresDepuisAdresse(new URLSearchParams(`groupe=${GROUPE}`)).groupe).toBe(GROUPE);
    expect(filtresDepuisAdresse(new URLSearchParams(`groupe=${GROUPE.toUpperCase()}`)).groupe).toBe(GROUPE);
    expect(filtresDepuisAdresse(new URLSearchParams('groupe=aucun')).groupe).toBe('aucun');
    for (const x of ['tous', '1', 'aucun2', `${GROUPE}x`, '../machines'])
      expect(filtresDepuisAdresse(new URLSearchParams(`groupe=${encodeURIComponent(x)}`)).groupe).toBe('');
  });
  it('nom accessible d’une carte, exposition d’une tuile, bandeau de première ligne', () => {
    expect(nomAccessibleCarte(carte())).toBe(
      'Portail fictif : 5 machines lues, priorité P1, failles présentes : 6 critiques, 3 élevées, 0 moyenne, 1 faible, 2 machines à exploitation avérée, 1 machine exploitable, 2 actifs exposés sur Internet',
    );
    expect(
      nomAccessibleCarte(
        carte({
          id: null,
          nom: null,
          machines: 1,
          priorite: null,
          failles: FAILLES_GRAVITE_VIDES,
          machinesExploitationAveree: 0,
          machinesExploitables: 0,
          actifsExposes: 0,
        }),
      ),
    ).toBe(
      'Sans périmètre : 1 machine lue, aucune priorité, failles présentes : 0 critique, 0 élevée, 0 moyenne, 0 faible, 0 actif exposé sur Internet',
    );
    expect(
      libelleExpositionTuile({
        machineId: 'm',
        actifs: [
          { id: 'a', type: 'domaine', valeur: 'portail.exemple-fictif.example' },
          { id: 'b', type: 'hote', valeur: '198.51.100.11' },
        ],
        autres: 2,
      }),
    ).toBe(
      'exposée sur Internet par portail.exemple-fictif.example (domaine), 198.51.100.11 (hôte) et 2 autres actifs',
    );
    expect(bandeauPremiereLigne(0)).toBeNull();
    expect(bandeauPremiereLigne(1)).toContain('Une machine de première ligne (front)');
    expect(bandeauPremiereLigne(2)).toContain('2 machines de première ligne (front)');
  });
});

describe('lot PC3 : cartes des périmètres', () => {
  it('carte : bouton au nom accessible, priorité en texte et en couleur, gravités, marques, actifs exposés', () => {
    const html = rendu(createElement(CartePerimetre, { c: carte(), onOuvrir: rien }));
    sansStyle(html);
    expect(html).toMatch(/<button type="button" class="perim-carte parc-p--P1"/i);
    expect(html).toContain(`aria-label="${nomAccessibleCarte(carte())}"`);
    expect(html).toMatch(/class="parc-tuile__prio"[^>]*>P1</i);
    expect(html).toContain('Portail fictif');
    expect(html).toMatch(/class="parc-g parc-g--c parc-mono"[^>]*>6</i);
    expect(html).toMatch(/class="parc-g parc-g--m parc-g--zero parc-mono"[^>]*>0</i);
    expect(html).toContain('title="Exploitation avérée"');
    expect(html).toContain('2 à exploitation avérée');
    // Lot PRIO-1 : le mot « zero-day » est réservé aux failles exploitées sans correctif connu.
    expect(html).not.toContain('zero-day');
    expect(html).toContain('1 exploitable');
    expect(html).toContain('2 actifs exposés sur Internet');
  });
  it('liste : dans l’ordre reçu, puis la carte « Sans périmètre » ; liste vide annoncée', () => {
    const sans = carte({ id: null, nom: null, priorite: 'P2' });
    const html = rendu(
      createElement(ListePerimetres, {
        liste: {
          perimetres: [carte(), carte({ id: 'b', nom: 'Messagerie fictive', priorite: null })],
          sansPerimetre: sans,
        },
        onOuvrir: rien,
      }),
    );
    const cartes = [...html.matchAll(/<button[^>]*class="perim-carte[^"]*"[^>]*aria-label="([^":]*) :/gi)].map(
      (x) => x[1],
    );
    expect(cartes).toEqual(['Portail fictif', 'Messagerie fictive', 'Sans périmètre']);
    expect(html).toMatch(/class="perim-carte parc-p--P2 perim-carte--sans"/i);
    expect(html).toMatch(/class="parc-tuile__prio"[^>]*>Aucune</i);
    expect(html).toContain('aria-label="Périmètres, du plus critique au moins critique"');
    const vide = rendu(
      createElement(ListePerimetres, { liste: { perimetres: [], sansPerimetre: null }, onOuvrir: rien }),
    );
    expect(vide).toContain('Aucun périmètre que vous puissiez lire.');
  });
});

describe('lot PC3 : détail d’un périmètre', () => {
  const machines = () => {
    n = 0;
    return [
      machine('srv-web-01.exemple.invalid', 'front', { priorite: 'P1', exploitationAveree: true }),
      machine('srv-web-02.exemple.invalid', 'front', { priorite: 'P1', exploitationAveree: true }),
      machine('srv-app-07.exemple.invalid', 'back', { priorite: 'P2', exploitable: true }),
      machine('srv-bdd-03.exemple.invalid', 'bdd', { priorite: 'P4' }),
      machine('srv-div-01.exemple.invalid', null),
    ];
  };
  const props = (detail: DetailPerimetreDto, presentation: 'lignes' | 'global' = 'lignes') => ({
    detail,
    presentation,
    onPresentation: rien,
    onOuvrir: rien,
    onVoirListe: rien,
  });

  it('par ligne : chiffres clés, bandeau de première ligne, zones et murs du parc, aucun trait entre machines', () => {
    const html = rendu(createElement(DetailPerimetre, props(detailDe(machines()))));
    sansStyle(html);
    expect(html).toContain('aria-label="Chiffres clés du périmètre"');
    for (const t of [
      'Machines du périmètre',
      'Failles critiques',
      'Machines avec exploitation avérée',
      'Machines sans rôle',
      'Actifs exposés rattachés',
    ])
      expect(html).toContain(t);
    expect(html).toContain('2 machines de première ligne (front) portent une faille dont l’exploitation est avérée.');
    expect(html).toContain('Première ligne touchée');
    const titres = [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/gi)].map((x) => x[1]);
    expect(titres).toEqual(['Front', 'Back applicatif', 'Base de données', 'Rôle non indiqué']);
    expect([...html.matchAll(/class="parc-mur parc-mur--(\w+)"/gi)].map((x) => x[1])).toEqual(['rouge', 'violet']);
    expect(tuiles(html)).toHaveLength(5);
    // Ni flèche ni trait entre machines ; l'écran le dit.
    expect(html).not.toMatch(/<line|class="[^"]*fleche/i);
    expect(html).toContain('aucun trait ne relie deux machines');
    expect(html).toContain('aria-label="Présentation du périmètre"');
    expect(html).toContain('Tous les périmètres');
  });

  it('vue globale : toutes les machines ensemble, dans l’ordre du rang, sans zone de rôle', () => {
    const html = rendu(createElement(DetailPerimetre, props(detailDe(machines()), 'global')));
    sansStyle(html);
    expect(tuiles(html).map((x) => x.split(' : ')[0])).toEqual([
      'srv-web-01.exemple.invalid',
      'srv-web-02.exemple.invalid',
      'srv-app-07.exemple.invalid',
      'srv-bdd-03.exemple.invalid',
      'srv-div-01.exemple.invalid',
    ]);
    expect(html).not.toContain('Frontière front · back');
    expect([...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/gi)].map((x) => x[1])).toEqual(['Machines du périmètre']);
  });

  it('vue globale réduite : les premières, puis « et n autres » ; au-delà de la borne, « voir la liste »', () => {
    n = 0;
    const beaucoup = Array.from({ length: 40 }, (_, i) =>
      machine(`srv-${String(i).padStart(2, '0')}.exemple.invalid`, i % 2 ? 'back' : 'front', {}, 40 - i),
    );
    const html = rendu(createElement(DetailPerimetre, props(detailDe(beaucoup), 'global')));
    const vus = tuiles(html);
    expect(vus).toHaveLength(PERIMETRE_GLOBAL_REDUIT);
    // Ordre du rang, pas celui des zones : la machine de rang 1 d'abord.
    expect(vus[0]).toContain('srv-39.exemple.invalid : rang 1 sur 60');
    expect(html).toContain(`et ${40 - PERIMETRE_GLOBAL_REDUIT} autres : tout montrer`);
    const borne = rendu(createElement(DetailPerimetre, props(detailDe(beaucoup.slice(0, 10), {}, 3), 'global')));
    // Parc de 10 machines, 3 rendues par zone : 6 reçues, 4 au-delà de la borne.
    expect(tuiles(borne)).toHaveLength(6);
    expect(borne).toContain('et 4 autres : voir la liste');
  });

  it('exposition : mention sur la tuile de la machine reliée, liste des actifs lisibles sous le parc', () => {
    const ms = machines();
    const d = {
      ...detailDe(ms),
      expositions: [
        {
          machineId: ms[0]!.id,
          actifs: [{ id: 'a', type: 'domaine' as const, valeur: 'portail.exemple-fictif.example' }],
          autres: 0,
        },
      ],
    };
    const html = rendu(createElement(DetailPerimetre, props(d)));
    const t = tuiles(html);
    expect(t[0]).toMatch(/, exposée sur Internet par portail\.exemple-fictif\.example \(domaine\)$/);
    expect(t.filter((x) => x.includes('exposée sur Internet'))).toHaveLength(1);
    expect((html.match(/class="parc-tuile__expo"/gi) ?? []).length).toBe(1);
    expect(html).toContain('Exposition sur Internet (liaisons confirmées)');
    expect(html).toMatch(/srv-web-01\.exemple\.invalid<\/strong> : exposée sur Internet par portail/i);
    const sans = rendu(createElement(DetailPerimetre, props(detailDe(machines()))));
    expect(sans).toContain('Aucune machine de ce périmètre n’est reliée, par une liaison confirmée');
    expect(sans).not.toMatch(/class="parc-tuile__expo"/i);
  });

  it('sans faille en première ligne : pas de bandeau', () => {
    n = 0;
    const html = rendu(
      createElement(
        DetailPerimetre,
        props(detailDe([machine('srv-bdd-09.exemple.invalid', 'bdd', { priorite: 'P3' })], { priorite: 'P3' })),
      ),
    );
    expect(html).not.toContain('pc-bandeau');
    expect(html).toContain('Priorité la plus haute : P3');
  });
});

describe('lot PC3 : menu, aide, lien depuis la liste des machines', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('« Périmètres » suit « Machines », avec la lecture du module seulement', () => {
    const rubriques = (droits: string[]) =>
      famillesVisibles(seulement(droits))
        .find((f) => f.famille.id === 'risques')
        ?.destinations.find((d) => d.id === 'vulnerabilites')
        ?.rubriques.map((r) => r.id) ?? [];
    const ids = rubriques(['vulnerabilites:lire']);
    expect(ids.indexOf('vulnerabilites-perimetres')).toBe(ids.indexOf('vulnerabilites-machines') + 1);
    expect(rubriques(['pilotage:lire'])).not.toContain('vulnerabilites-perimetres');
    expect(localiser('/vulnerabilites/perimetres')?.rubrique.id).toBe('vulnerabilites-perimetres');
  });
  it('aide : cartes, « Sans périmètre », par ligne et vue globale, exposition, aucun lien entre machines', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-perimetres')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    expect(a.link).toBe('/vulnerabilites/perimetres');
    const texte = a.steps.join(' ');
    for (const t of [
      'Sans périmètre',
      '« Par ligne »',
      '« Vue globale »',
      'Exposée sur Internet',
      'liaison confirmée',
      'Aucun trait ne relie deux machines',
      'ne prouvent pas un cloisonnement du réseau',
      'n’est remis à l’assistant',
    ])
      expect(texte.toLowerCase()).toContain(t.toLowerCase());
  });
  it('liste des machines : le nom du périmètre ouvre son détail quand le lien est fourni', () => {
    n = 0;
    const m = machine('srv-web-01.exemple.invalid', 'front');
    const avec = rendu(createElement(MachinesTable, { machines: [m], onPerimetre: rien }));
    expect(avec).toMatch(/<button[^>]*class="[^"]*mantine-Anchor-root[^"]*"[^>]*>Portail fictif<\/button>/i);
    const sans = rendu(createElement(MachinesTable, { machines: [m] }));
    expect(sans).not.toMatch(/<button[^>]*>Portail fictif<\/button>/i);
    expect(sans).toContain('Portail fictif');
  });
});
