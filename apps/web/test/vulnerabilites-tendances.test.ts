/* Module Vulnérabilités (ADR 0100, lot S2) : tendances et rapport de pilotage à l'écran. Points et séries (jour, semaine),
   choix de la portée, adresses, mois proposés ; courbes avec légende (trait et forme, jamais la couleur seule) et tableau ;
   indicateur de tendance en clair ; variation sur sept jours de la vue d'ensemble ; document du rapport (en-tête, tableaux,
   pied, aucun nom de machine) ; feuille d'impression (A4, ni menu ni bouton) ; navigation et aide ; aucun attribut style.
   Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import {
  agregerParSemaine,
  DELAIS_CORRECTION_DEFAUT,
  type InstantaneLu,
  MESURES_VIDES,
  mesurerCorrections,
  mesurerPrisesEnCompte,
  pointsParJour,
  type RapportVulnerabilitesDto,
  syntheseNiveau,
  tendanceSituation,
  type TendancesDto,
  variationSeptJours,
} from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { FAMILLES } from '../src/navigation';
import { DocumentRapport } from '../src/vulnerabilites/Rapport';
import { CourbeTendance, IndicateurTendance, TendancesVue } from '../src/vulnerabilites/Tendances';
import {
  aujourdhui,
  moisProposes,
  optionsPortee,
  pointsAffiches,
  PORTEE_TOUT,
  serieNiveau,
  seriesParc,
  seriesPriorites,
  seriesSuivi,
  urlRapport,
  urlTendances,
} from '../src/vulnerabilites/tendances';
import { VariationSeptJours } from '../src/vulnerabilites/VueEnsemble';

// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      { withCssVariables: false, withGlobalClasses: false },
      createElement(MemoryRouter, null, e),
    ),
  );
/** Balises propres à l'écran (classes vt-*, rp-*, rapport-*, pc-variation*, neon-*) : aucune ne porte d'attribut style ; ni
    <style> ni <script>. */
const sansStyle = (html: string) => {
  const propres = (html.match(/<[^>]*class="(?:vt|rp|rapport|pc-variation|neon)[^"]*"[^>]*>/gi) ?? []).filter(
    (b) => !/mantine-/i.test(b),
  );
  expect(propres.length).toBeGreaterThan(0);
  expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/<script/i);
};
const PA = '00000000-0000-4000-8000-0000000000a1';
const lu = (jour: string, niveau: 1 | 2 | 3 | 4, p1: number, corrigeesVeille = 0): InstantaneLu => ({
  jour,
  niveau,
  mesures: { ...MESURES_VIDES, p1, p2: 2, corrigeesVeille, machines: null, actifs: null },
});
const vue = (v: Partial<TendancesDto> = {}): TendancesDto => {
  const jours = pointsParJour(
    [lu('2026-11-16', 2, 3), lu('2026-11-17', 4, 2, 5), lu('2026-11-18', 4, 1, 1)],
    '2026-11-15',
    '2026-11-18',
  );
  return {
    periode: 30,
    granularite: 'jour',
    du: '2026-11-15',
    au: '2026-11-18',
    perimetre: { id: null, nom: null, aucun: false },
    depuis: '2026-11-16',
    jours,
    semaines: agregerParSemaine(jours),
    tendance: tendanceSituation(jours),
    perimetres: [{ id: PA, nom: 'Périmètre fictif A' }],
    sansPerimetre: false,
    retentionAns: 3,
    calculeLe: '2026-11-18T09:00:00.000Z',
    ...v,
  };
};

describe('présentation des tendances', () => {
  it('points jour par jour : étiquettes, trous sans instantané, corrections du lendemain', () => {
    const p = pointsAffiches(vue());
    expect(p.map((x) => [x.etiquette, x.niveau, x.mesures?.p1 ?? null, x.corrigees])).toEqual([
      // Corrections du 15/11 lues dans l'instantané du 16/11 (0) ; aujourd'hui, inconnues.
      ['15/11', null, null, 0],
      ['16/11', 2, 3, 5],
      ['17/11', 4, 2, 1],
      ['18/11', 4, 1, null],
    ]);
    expect(seriesPriorites(p)[0]).toMatchObject({ cle: 'p1', classe: 'vt-serie--p1', valeurs: [null, 3, 2, 1] });
    expect(seriesSuivi(p, 'jour').map((s) => s.libelle)).toEqual([
      'Failles exploitées et présentes',
      'Failles en dépassement de délai',
      'Failles sous exception',
      'Failles corrigées dans la journée',
    ]);
    expect(serieNiveau(p, 'semaine')[0]!.libelle).toBe('Niveau d’alerte le plus haut de la semaine');
    expect(seriesParc(p)[0]!.valeurs).toEqual([null, null, null, null]);
  });

  it('points semaine après semaine', () => {
    const v = vue({ granularite: 'semaine', periode: 91 });
    const p = pointsAffiches(v);
    expect(p.map((x) => x.etiquetteLongue)).toEqual([
      'semaine du 09/11/2026 au 15/11/2026',
      'semaine du 16/11/2026 au 18/11/2026',
    ]);
    expect(p[1]).toMatchObject({ niveau: 4, corrigees: 6 });
  });

  it('portée et adresses', () => {
    expect(optionsPortee(vue()).map((o) => o.label)).toEqual(['Toute la plateforme', 'Périmètre fictif A']);
    expect(optionsPortee(vue({ sansPerimetre: true })).at(-1)).toEqual({ value: 'aucun', label: 'Sans périmètre' });
    expect(urlTendances(30, PORTEE_TOUT)).toBe('/api/vulnerabilites/tendances?periode=30');
    expect(urlTendances(91, PA)).toBe(`/api/vulnerabilites/tendances?periode=91&perimetre=${PA}`);
    expect(urlRapport({ mode: 'mois', mois: '2026-10', du: '', au: '', perimetre: PORTEE_TOUT }, 'json')).toBe(
      '/api/vulnerabilites/rapport?mois=2026-10&format=json',
    );
    expect(urlRapport({ mode: 'libre', mois: '', du: '2026-11-01', au: '2026-11-18', perimetre: 'aucun' }, 'csv')).toBe(
      '/api/vulnerabilites/rapport?du=2026-11-01&au=2026-11-18&perimetre=aucun&format=csv',
    );
    const mois = moisProposes('2026-01-15', 3);
    expect(mois.map((m) => m.value)).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(mois[0]!.label).toBe('janvier 2026');
    expect(aujourdhui(new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
  });
});

describe('rendu des tendances', () => {
  it('courbe : légende (trait, forme, libellé), nom accessible, tableau aux mêmes valeurs, aucun style', () => {
    const points = pointsAffiches(vue());
    const html = rendu(
      createElement(CourbeTendance, {
        titre: 'Failles présentes par priorité',
        description: 'Description fictive.',
        series: seriesPriorites(points),
        points,
        granularite: 'jour',
      }),
    );
    expect(html).toContain('aria-label="Légende"');
    expect(html).toMatch(/class="neon-courbe neon-trait-1"/);
    expect(html).toContain('class="neon-marque"');
    expect(html).toContain('aria-label="Failles présentes par priorité, jour par jour, du 15/11/2026 au 18/11/2026"');
    expect(html).toContain('<th');
    expect(html).toMatch(/<td[^>]*>16\/11\/2026<\/td><td[^>]*>3<\/td>/i);
    expect(html).toMatch(/<td[^>]*>15\/11\/2026<\/td><td[^>]*>—<\/td>/i);
    sansStyle(html);
  });

  it('vue complète : historique depuis, tendance en clair avec sa règle, machines par périmètre seulement', () => {
    const html = rendu(createElement(TendancesVue, { v: vue() }));
    expect(html).toContain('Historique depuis le <span class="horodatage">16/11/2026</span>');
    expect(html).toContain('S’améliore');
    expect(html).toContain('à confirmer par le RSSI');
    expect(html).toContain('se lisent par périmètre');
    expect(html).not.toContain('Machines et actifs exposés touchés');
    const perimetre = rendu(createElement(TendancesVue, { v: vue({ perimetre: { id: PA, nom: 'A', aucun: false } }) }));
    expect(perimetre).toContain('Machines et actifs exposés touchés');
    const vide = rendu(createElement(TendancesVue, { v: vue({ depuis: null, jours: [], semaines: [] }) }));
    expect(vide).toContain('Aucun instantané encore');
    sansStyle(html);
  });

  it('indicateur : libellé et flèche en texte (jamais la couleur seule)', () => {
    const html = rendu(createElement(IndicateurTendance, { tendance: tendanceSituation([]) }));
    expect(html).toContain('Indéterminée');
    expect(html).toContain('Moins de deux instantanés');
  });

  it('variation sur sept jours : écarts en clair, ou absence dite', () => {
    const v = variationSeptJours(
      { jour: '2026-11-11', niveau: 2, mesures: { ...MESURES_VIDES, p1: 0, machines: null, actifs: null } },
      { niveau: 4, mesures: { ...MESURES_VIDES, p1: 2, machines: null, actifs: null } },
    );
    const html = rendu(createElement(VariationSeptJours, { variation: v }));
    expect(html).toContain('Niveau d’alerte : 2 → 4');
    expect(html).toContain('Failles présentes en P1 : 0 → 2, <b>+2 (en hausse)</b>');
    expect(html).toContain('href="/vulnerabilites/tendances"');
    expect(rendu(createElement(VariationSeptJours, { variation: null }))).toContain(
      'Pas encore d’instantané d’il y a sept jours',
    );
    sansStyle(html);
  });
});

const rapport = (): RapportVulnerabilitesDto => ({
  etablissement: 'Établissement fictif',
  produitLe: '2026-11-18T09:30:00.000Z',
  du: '2026-11-01',
  au: '2026-11-18',
  perimetre: { id: PA, nom: 'Périmètre fictif A', aucun: false },
  avecDetail: false,
  niveau: {
    ...syntheseNiveau([{ jour: '2026-11-18', niveau: 4 }]),
    actuel: {
      niveau: 4,
      libelle: 'Maximale',
      explication: '1 faille exploitée et présente chez nous (P1) : seuil d’alerte critique.',
      faits: { critiques: 1, simples: 0, p2Presentes: 0, exploiteesAConfirmer: 0 },
    },
  },
  situation: { ...MESURES_VIDES, p1: 1 },
  critiques: {
    total: 1,
    p2: 0,
    elements: [
      {
        cle: 'CVE-2026-0001',
        cve: 'CVE-2026-0001',
        titre: 'Exemple : faille fictive',
        produit: 'Produit fictif',
        presences: ['detectee'],
        depuis: '2026-11-10T08:00:00.000Z',
        enDepassement: true,
      },
    ],
  },
  delais: { reglage: DELAIS_CORRECTION_DEFAUT, mesures: mesurerCorrections([]), nonMesurees: 0 },
  depassements: { total: 0, elements: [] },
  exceptions: { compteurs: { en_cours: 0, bientot_echue: 0, echue: 0, sans_echeance: 0 }, elements: [] },
  tendances: { depuis: '2026-11-18', semaines: [], tendance: tendanceSituation([]) },
  alertes: {
    ouvertes: 0,
    prisesEnCompte: 0,
    closes: 0,
    enCours: 0,
    delai: mesurerPrisesEnCompte([]),
    total: 0,
    elements: [],
  },
  sources: { fluxOuvert: false, veille: [], connecteurs: [] },
  bornes: { liste: 200 },
});

describe('document du rapport', () => {
  it('en-tête et pied (établissement, période, portée, date de production), tableaux, aucun style', () => {
    const html = rendu(createElement(DocumentRapport, { r: rapport() }));
    expect(html).toContain('class="rapport-doc"');
    expect(html).toContain('<h1>Rapport de pilotage des vulnérabilités</h1>');
    expect(html).toContain('Établissement fictif');
    expect(html).toContain('du 01/11/2026 au 18/11/2026');
    expect(html).toContain('Périmètre fictif A');
    expect(html).toContain('Document produit par la plateforme le <span class="horodatage">18/11/2026 10:30</span>');
    expect(html.match(/<h2 /gi)).toHaveLength(9);
    expect(html).toContain('<th scope="col">CVE</th>');
    expect(html).toContain('<td>CVE-2026-0001</td>');
    expect(html).toContain('Aucune faille en dépassement de délai.');
    sansStyle(html);
    expect(html).not.toMatch(/<button/i);
  });
});

describe('CSP stricte (ADR 0006)', () => {
  it('aucune prop style ni balise <style> ou <script> dans les sources du lot', () => {
    for (const f of ['Tendances.tsx', 'Rapport.tsx', 'tendances.ts', 'VueEnsemble.tsx']) {
      const source = readFileSync(new URL(`../src/vulnerabilites/${f}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/\sstyle=\{/i);
      expect(source).not.toMatch(/<style/i);
      expect(source).not.toMatch(/<script/i);
    }
  });
});

describe('feuille d’impression et charte', () => {
  const css = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src/neon-tendances.css'),
    'utf8',
  );
  it('A4, page nommée, numéro de page, ni menu ni bouton ni fenêtre à l’impression, noir sur blanc', () => {
    expect(css).toMatch(/@page rapport \{\s*size: A4 portrait;/);
    expect(css).toContain("content: 'Page ' counter(page) ' sur ' counter(pages);");
    const impression = css.slice(css.indexOf('@media print'));
    for (const masque of ['.shell-nav', '.rapport-ecran', '.alerte-critique', ':not(.shell-body)'])
      expect(impression).toContain(masque);
    expect(impression).toContain('page: rapport;');
    expect(impression).toContain('color: black;');
    expect(impression).toContain('background: white;');
  });
  it('aucune longueur en px ni en rem, aucune couleur codée en dur', () => {
    const lignes = css.split('\n').filter((l) => !l.trim().startsWith('@media'));
    expect(lignes.filter((l) => /(?<![\w-])\d*\.?\d+(px|rem)\b/.test(l))).toEqual([]);
    expect(lignes.filter((l) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(l))).toEqual([]);
  });
});

describe('navigation et aide', () => {
  it('onglets « Tendances » et « Rapport de pilotage » avec le droit de lire', () => {
    const pages = FAMILLES.flatMap((f) => f.destinations.flatMap((d) => d.rubriques));
    expect(pages.find((p) => p.id === 'vulnerabilites-tendances')).toMatchObject({
      label: 'Tendances',
      to: '/vulnerabilites/tendances',
    });
    expect(pages.find((p) => p.id === 'vulnerabilites-rapport')).toMatchObject({
      label: 'Rapport de pilotage',
      to: '/vulnerabilites/rapport',
    });
  });
  it('aide : instantanés, historique depuis l’installation, règle à confirmer, PDF par le navigateur, confidentialité', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-tendances')!;
    expect(a.permission).toBe('vulnerabilites:lire');
    const texte = a.steps.join(' ');
    for (const m of [
      'aucun passé n’est reconstruit',
      'à confirmer par le RSSI',
      'Enregistrer au format PDF',
      'aucun nom de machine',
      'journal d’audit',
    ])
      expect(texte).toContain(m);
  });
});
