/* Module Vulnérabilités (ADR 0100, lot PC2) : écran « Machines », mode « Parc », côté interface. Adresse de la route, nom
   accessible d'une tuile, poids des zones en grand écran ; rendu : quatre zones nommées dans l'ordre, murs (rouge entre le
   front et le back, violet entre le back et les bases), tuiles (bouton, rang, priorité en texte, gravités, icône selon le
   rôle), marques zero-day (« exploitation avérée ») et exploitable, tuile « et n autres » (réduit) ou « voir la liste »
   (borne de la route), légende, marques dans la liste, aucun style en ligne ; aide. Animations des murs coupées par le
   mouvement réduit et à l'impression. Données entièrement fictives (noms en .invalid, adresses de 192.0.2.0/24). */
import { MantineProvider } from '@mantine/core';
import {
  type MachineMarqueeDto,
  type MarquesMachineDto,
  MARQUES_VIDES,
  type ParcMachinesDto,
  repartirParc,
  type RoleMachine,
} from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { MachinesTable } from '../src/vulnerabilites/Machines';
import {
  libelleGravites,
  MARQUE_EXPLOITABLE,
  MARQUE_EXPLOITATION_AVEREE,
  MARQUE_ZERO_DAY,
  nomAccessibleMachine,
  poidsZones,
  urlParc,
} from '../src/vulnerabilites/parc';
import { LegendeMarques, ParcMachines } from '../src/vulnerabilites/ParcMachines';

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src');
// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, e));
const rien = () => undefined;

let n = 0;
const machine = (
  nom: string,
  role: RoleMachine | null,
  marques: Partial<MarquesMachineDto> = {},
  compteurs: Partial<MachineMarqueeDto['compteurs']> = {},
): MachineMarqueeDto => {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    nom,
    adresse: `192.0.2.${n % 250}`,
    systeme: null,
    role,
    perimetreId: null,
    perimetreNom: null,
    perimetreOrigine: null,
    depot: null,
    exposition: null,
    acr: null,
    premiere: null,
    derniere: null,
    source: 'tenable',
    integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif', type: 'tenable' },
    compteurs: {
      critique: 0,
      elevee: 0,
      moyenne: 0,
      faible: 0,
      exploites: 0,
      exploitables: 0,
      declarees: 0,
      exploitationAveree: marques.exploitationAveree ? 1 : 0,
      ...compteurs,
    },
    rang: { position: n, total: 150, faits: [] },
    finDeSupport: false,
    finsDeSupport: [],
    version: 1,
    marques: { ...MARQUES_VIDES, ...marques },
  };
};
const parcDe = (machines: MachineMarqueeDto[], borne = 250): ParcMachinesDto => {
  const zones = repartirParc(machines, borne);
  return {
    zones,
    total: machines.length,
    parZone: borne,
    tronquee: zones.some((z) => z.total > z.machines.length),
  };
};
/** Balises propres à l'écran (classes parc-*) : aucune ne porte d'attribut style ; aucune balise <style> ni <script>. */
const sansStyle = (html: string) => {
  const propres = (html.match(/<[^>]*class="parc[^"]*"[^>]*>/gi) ?? []).filter((b) => !/mantine-/i.test(b));
  expect(propres.length).toBeGreaterThan(0);
  expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/<script/i);
};
/** Contenu des tuiles (boutons de classe parc-tuile), dans l'ordre. */
const noms = (html: string) =>
  [...html.matchAll(/<button[^>]*class="parc-tuile[^"]*"[^>]*aria-label="([^"]*)"/gi)].map((x) => x[1]);

describe('lot PC2 : fonctions pures du parc', () => {
  it('adresse de la route : mêmes filtres que la liste, sans page', () => {
    expect(urlParc({ q: '', role: '', perimetre: '' })).toBe('/api/vulnerabilites/machines/parc');
    expect(urlParc({ q: ' srv ', role: 'aucun', perimetre: 'aucun' })).toBe(
      '/api/vulnerabilites/machines/parc?q=srv&role=aucun&perimetre=aucun',
    );
  });

  it('nom accessible lisible : nom, rang, rôle, gravités, priorité, marques', () => {
    const m = machine(
      'srv-web-03.exemple.invalid',
      'front',
      { priorite: 'P1', exploitationAveree: true },
      { critique: 2 },
    );
    m.rang = { position: 3, total: 150, faits: [] };
    // Lot PRIO-1 : « zero-day » seulement pour une faille exploitée sans correctif connu.
    expect(nomAccessibleMachine(m)).toBe(
      'srv-web-03.exemple.invalid : rang 3 sur 150, front, 2 critiques, priorité P1, exploitation avérée',
    );
    m.marques = { ...m.marques, exploiteeSansCorrectif: true };
    expect(nomAccessibleMachine(m)).toBe(
      'srv-web-03.exemple.invalid : rang 3 sur 150, front, 2 critiques, priorité P1, exploitation avérée, zero-day, sans correctif connu',
    );
    const e = machine(
      'srv-app-07.exemple.invalid',
      'back',
      { priorite: 'P2', exploitable: true },
      { elevee: 1, faible: 3 },
    );
    expect(nomAccessibleMachine(e)).toMatch(
      /: rang \d+ sur 150, back applicatif, 1 élevée, 3 faibles, priorité P2, exploitable, code d’exploitation disponible$/,
    );
    const vide = machine('srv-div-01.exemple.invalid', null);
    expect(nomAccessibleMachine(vide)).toMatch(/rôle non indiqué, aucune faille présente, aucune priorité$/);
    expect(libelleGravites({ ...vide.compteurs, moyenne: 1 })).toBe('1 moyenne');
  });

  it('libellés exacts des marques', () => {
    // Lot PRIO-1 (décision du RSSI du 20/11/2026) : le mot « zero-day » est réservé.
    expect(MARQUE_ZERO_DAY).toBe('Zero-day : exploitée, sans correctif connu');
    expect(MARQUE_EXPLOITATION_AVEREE).toBe('Exploitation avérée');
    expect(MARQUE_EXPLOITABLE).toContain('sans exploitation avérée');
  });

  it('grand écran : la zone la plus peuplée est la plus large (poids 1 à 4)', () => {
    expect(poidsZones({ front: 38, back: 96, bdd: 41 })).toEqual({ front: 2, back: 4, bdd: 2 });
    expect(poidsZones({ front: 0, back: 0, bdd: 0 })).toEqual({ front: 1, back: 1, bdd: 1 });
  });
});

describe('lot PC2 : rendu du parc', () => {
  const parc = () => {
    n = 0;
    return [
      machine(
        'srv-web-01.exemple.invalid',
        'front',
        { priorite: 'P1', exploitationAveree: true, exploitable: true },
        { critique: 3, elevee: 6 },
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        machine(
          `srv-web-${String(i + 2).padStart(2, '0')}.exemple.invalid`,
          'front',
          { priorite: 'P3' },
          { elevee: 1 },
        ),
      ),
      machine('srv-app-01.exemple.invalid', 'back', { priorite: 'P2', exploitable: true }, { critique: 1 }),
      machine('srv-bdd-01.exemple.invalid', 'bdd', { priorite: 'P4' }, { moyenne: 2 }),
      machine('srv-div-01.exemple.invalid', null),
    ];
  };

  it('quatre zones nommées dans l’ordre, murs rouge puis violet, note sur les frontières', () => {
    const html = rendu(
      createElement(ParcMachines, { parc: parcDe(parc()), echelle: 'reduit', onOuvrir: rien, onVoirListe: rien }),
    );
    sansStyle(html);
    const titres = [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/gi)].map((x) => x[1]);
    expect(titres).toEqual(['Front', 'Back applicatif', 'Base de données', 'Rôle non indiqué']);
    const murs = [...html.matchAll(/class="parc-mur parc-mur--(\w+)"/gi)].map((x) => x[1]);
    expect(murs).toEqual(['rouge', 'violet']);
    expect(html).toContain('Frontière front · back');
    expect(html).toContain('Frontière back · bases');
    // Bandes décoratives, cachées aux lecteurs d'écran.
    expect(html).toMatch(/<i class="parc-mur__hachures" aria-hidden="true"><\/i>/i);
    expect(html).toContain('ne prouvent pas un cloisonnement du réseau');
    expect(html).toContain('8 machines · 1 avec une exploitation avérée');
  });

  it('tuiles : boutons au nom accessible, rang, priorité en texte et en couleur, icône selon le rôle', () => {
    const html = rendu(
      createElement(ParcMachines, { parc: parcDe(parc()), echelle: 'reduit', onOuvrir: rien, onVoirListe: rien }),
    );
    const tuiles = noms(html);
    expect(tuiles[0]).toBe(
      'srv-web-01.exemple.invalid : rang 1 sur 150, front, 3 critiques, 6 élevées, priorité P1, exploitation avérée, exploitable, code d’exploitation disponible',
    );
    expect(html).toMatch(/<button type="button" class="parc-tuile parc-p--P1 parc-tuile--zd"/i);
    expect(html).toMatch(/class="parc-tuile parc-p--aucune"/i);
    expect(html).toMatch(/class="parc-tuile__prio"[^>]*>P1</i);
    expect(html).toMatch(/class="parc-tuile__prio"[^>]*>Aucune</i);
    // Une icône par tuile, décorative.
    expect((html.match(/<svg class="parc-appareil"[^>]*aria-hidden="true"/gi) ?? []).length).toBe(tuiles.length);
  });

  it('marques : triangle de l’exploitation avérée et éclair exploitable, infobulles exactes', () => {
    const html = rendu(
      createElement(ParcMachines, { parc: parcDe(parc()), echelle: 'reduit', onOuvrir: rien, onVoirListe: rien }),
    );
    // Lot PRIO-1 : sans « sans correctif connu », le triangle dit « Exploitation avérée », jamais « zero-day ».
    expect((html.match(/class="parc-marque parc-marque--zd" title="Exploitation avérée"/gi) ?? []).length).toBe(1);
    expect(html).not.toContain('title="Zero-day');
    expect(
      (html.match(/class="parc-marque parc-marque--ex" title="Exploitable : [^"]*sans exploitation avérée"/gi) ?? [])
        .length,
    ).toBe(2);
  });

  it('réduit : les 5 plus prioritaires de la zone, puis « et n autres » qui déplie ; grand écran : toutes', () => {
    const reduit = rendu(
      createElement(ParcMachines, { parc: parcDe(parc()), echelle: 'reduit', onOuvrir: rien, onVoirListe: rien }),
    );
    expect(noms(reduit).filter((x) => x?.includes(', front,'))).toHaveLength(5);
    expect(reduit).toMatch(/<button type="button" class="parc-plus" aria-expanded="false">/i);
    expect(reduit).toContain('et 3 autres : tout montrer');
    const grand = rendu(
      createElement(ParcMachines, { parc: parcDe(parc()), echelle: 'grand', onOuvrir: rien, onVoirListe: rien }),
    );
    expect(noms(grand).filter((x) => x?.includes(', front,'))).toHaveLength(8);
    expect(grand).not.toContain('tout montrer');
    expect(grand).toContain('class="parc parc--grand"');
    // Zone la plus peuplée plus large.
    expect(grand).toMatch(/parc-zone parc-zone--front parc-zone--poids-4/i);
  });

  it('borne de la route : « et n autres : voir la liste » en grand écran', () => {
    const p = parcDe(parc(), 3);
    const html = rendu(createElement(ParcMachines, { parc: p, echelle: 'grand', onOuvrir: rien, onVoirListe: rien }));
    expect(noms(html).filter((x) => x?.includes(', front,'))).toHaveLength(3);
    expect(html).toContain('et 5 autres : voir la liste');
  });

  it('parc vide : zones vides annoncées, aucune tuile', () => {
    const html = rendu(
      createElement(ParcMachines, { parc: parcDe([]), echelle: 'reduit', onOuvrir: rien, onVoirListe: rien }),
    );
    expect(noms(html)).toEqual([]);
    expect((html.match(/Aucune machine lue avec ce rôle\./g) ?? []).length).toBe(3);
    expect(html).toContain('Aucune machine lue sans rôle.');
  });

  it('légende des marques, et marques dans la liste existante', () => {
    const legende = rendu(createElement(LegendeMarques, { parc: true }));
    expect(legende).toContain('aria-label="Légende des marques"');
    expect(legende).toContain('Zero-day : une faille présente dont l’exploitation est avérée');
    expect(legende).toContain('Exploitable : une faille présente');
    expect(legende).toContain('le numéro est le rang');
    n = 0;
    const liste = rendu(
      createElement(MachinesTable, {
        machines: [
          machine('srv-web-01.exemple.invalid', 'front', {
            priorite: 'P1',
            exploitationAveree: true,
            exploitable: true,
          }),
        ],
      }),
    );
    expect(liste).toContain('Priorité et marques');
    expect(liste).toMatch(/>P1</);
    expect(liste).toContain('title="Exploitation avérée"');
    // Texte lisible par les lecteurs d'écran, en plus des icônes.
    expect(liste).toContain('Exploitation avérée ; Exploitable');
    // Lot PRIO-1 : une faille exploitée sans correctif connu, et elle seule, est dite « zero-day ».
    const zd = rendu(
      createElement(MachinesTable, {
        machines: [
          machine('srv-web-02.exemple.invalid', 'front', {
            priorite: 'P1',
            exploitationAveree: true,
            exploiteeSansCorrectif: true,
          }),
        ],
      }),
    );
    expect(zd).toContain('title="Zero-day : exploitée, sans correctif connu"');
    expect(zd).toContain('Exploitation avérée ; Zero-day : exploitée, sans correctif connu');
  });
});

describe('lot PC2 : aide et feuille de style', () => {
  it('aide : présentation « Parc », zones, murs, marques, réduit et grand écran', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-failles')!.steps.join(' ');
    for (const t of [
      '« Parc »',
      'Rôle non indiqué',
      'mur rouge',
      'Zero-day : exploitée, sans correctif connu',
      'Grand écran',
      'et n autres',
    ])
      expect(a).toContain(t);
  });
  it('murs animés seulement sans mouvement réduit ; coupés par le mouvement réduit et à l’impression ; ni px ni rem', () => {
    const css = readFileSync(path.join(UI, 'neon-parc.css'), 'utf8');
    const libre = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    expect(libre).toMatch(/animation: parc-defile 1s linear infinite/);
    expect((css.match(/animation: parc-/g) ?? []).length).toBe(
      (css.match(/@media \(prefers-reduced-motion: no-preference\) \{[^@]*/g) ?? []).join('').match(/animation: parc-/g)
        ?.length,
    );
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.parc \.parc-mur__hachures::before/);
    expect(css).toMatch(/@media print \{[^}]*\.parc \.parc-mur__hachures::before/);
    expect(css.split('\n').filter((l) => !l.trim().startsWith('@') && /(?<![\w-])\d*\.?\d+(px|rem)\b/.test(l))).toEqual(
      [],
    );
  });
});
