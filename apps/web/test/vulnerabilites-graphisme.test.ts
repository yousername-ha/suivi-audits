/* Refonte graphique du module Vulnérabilités (choix du RSSI du 22/11/2026) : style de la page de maintenance limité au module,
   réacteur du niveau d'alerte et cases des chiffres clés (proposition 1), ligne allégée de « Failles détectées » (choix D).
   Les dessins sont décoratifs : le niveau, les libellés et les liens restent écrits dans la page. */
import { MantineProvider } from '@mantine/core';
import {
  niveauAlerteGlobal,
  type Priorite,
  type PublicationReglementaireDto,
  SOURCES_REGLEMENTAIRES,
  type SourcesFailleDto,
} from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DelaiCourt, PrioriteCourte, SourceCourte } from '../src/vulnerabilites/FaillesDetectees';
import { faitsListe, raisonPriorite } from '../src/vulnerabilites/failles';
import { arcCran, arcReacteur, Reacteur, TeteCase } from '../src/vulnerabilites/Instruments';
import { ListePublications, SyntheseReglementaire } from '../src/veille-reglementaire/VeilleReglementaire';
import { AUTORITES_REGLEMENTAIRES } from '../src/veille-reglementaire/veille-reglementaire';
import { NiveauAlerteBloc } from '../src/vulnerabilites/VueEnsemble';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src');

// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
const rendre = (n: ReactNode) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, n),
    ),
  );
/** Balisage propre au module (classes vu-*, pc-*) : aucun attribut style. */
const sansStyle = (html: string) => {
  const propres = (html.match(/<[^>]*class="(?:vu-|pc-)[^"]*"[^>]*>/gi) ?? []).filter((b) => !/mantine-/i.test(b));
  expect(propres.length).toBeGreaterThan(0);
  expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
};

const SANS_SOURCE: SourcesFailleDto = {
  exploitation: [],
  exploitable: [],
  valeurs: { gravites: [], cvss: [], epss: [] },
  certSante: null,
};
const faits = (c: Partial<Parameters<typeof faitsListe>[0]> = {}) =>
  faitsListe({
    exploite: false,
    exploiteMalware: false,
    exploitable: false,
    kitsExploitation: [],
    finDeSupport: false,
    surMachineFinSupport: false,
    nonMaintenu: false,
    sources: SANS_SOURCE,
    ...c,
  }).map((m) => m.libelle);

describe('ligne allégée de « Failles détectées »', () => {
  it('un fait par sujet, sans doublon, quelle que soit la source', () => {
    expect(faits()).toEqual([]);
    // KEV, logiciel malveillant et sources : une seule « Exploitation avérée ».
    expect(
      faits({
        exploite: true,
        exploiteMalware: true,
        sources: { ...SANS_SOURCE, exploitation: [{ source: 'tenable', le: null }] },
      }),
    ).toEqual(['Exploitation avérée']);
    // Kits et sources « exploitable » : un seul « Exploitable ».
    expect(
      faits({
        exploitable: true,
        kitsExploitation: ['metasploit'],
        sources: { ...SANS_SOURCE, exploitable: [{ source: 'tenable', le: null }] },
      }),
    ).toEqual(['Exploitable']);
    // Ordre : exploitation, rançongiciels, exploitable, fin de support, non maintenu.
    expect(
      faits({
        exploite: true,
        exploitable: true,
        finDeSupport: true,
        nonMaintenu: true,
        sources: { ...SANS_SOURCE, rancongiciel: true },
      }),
    ).toEqual(['Exploitation avérée', 'Rançongiciels (KEV)', 'Exploitable', 'Fin de support', 'Non maintenu']);
    expect(faits({ surMachineFinSupport: true })).toEqual(['Sur une machine en fin de support']);
  });
  it('priorité : niveau et raison courte, sans la précision entre parenthèses', () => {
    const p: Priorite = {
      niveau: 'P1',
      faits: [
        { fait: 'exploitation', sources: ['kev'] },
        { fait: 'presence', presence: 'detectee' },
      ],
    };
    expect(raisonPriorite(p)).toBe('Exploitation avérée');
    expect(raisonPriorite({ niveau: 'P4', faits: [] })).toBe('');
    const html = rendre(createElement(PrioriteCourte, { p }));
    expect(html).toContain('>P1<');
    expect(html).toMatch(/class="[^"]*vu-raison[^"]*">Exploitation avérée</);
    expect(html).not.toContain('Détectée par Tenable');
  });
  it('délai : état, échéance et âge sur une ligne ; la règle du délai reste dans la fiche', () => {
    const html = rendre(
      createElement(DelaiCourt, {
        d: {
          etat: 'en_depassement',
          priorite: 'P1',
          delai: { duree: 48, unite: 'heures' },
          premiere: '2026-11-19T08:10:00.000Z',
          echeance: '2026-11-21T08:10:00.000Z',
        } as Parameters<typeof DelaiCourt>[0]['d'],
        maintenant: new Date('2026-11-22T08:10:00.000Z'),
      }),
    );
    expect(html).toContain('En dépassement');
    expect(html).toContain('Échéance : ');
    expect(html).toContain('âge : ');
    expect(html).not.toContain('Délai P1');
  });
  it('source : pastille et nom à l’écran, texte complet pour les lecteurs d’écran', () => {
    const html = rendre(
      createElement(SourceCourte, {
        origine: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Nessus fictif', type: 'nessus-fichier' },
      }),
    );
    expect(html).toContain('data-source="tenable"');
    expect(html).toMatch(/Source : <\/span>Nessus fictif<span[^>]*> \(Nessus, import de fichier\)<\/span>/);
  });
});

describe('réacteur du niveau d’alerte', () => {
  it('décoratif : quatre crans, ceux atteints allumés, le niveau en cours seul à respirer', () => {
    for (const n of [1, 2, 3, 4] as const) {
      const html = rendre(createElement(Reacteur, { niveau: n }));
      expect(html).toMatch(/^<svg class="vu-reacteur"[^>]*aria-hidden="true"/);
      expect(html.match(/vu-cran__arc/g)).toHaveLength(4);
      expect(html.match(/vu-cran--atteint/g)).toHaveLength(n);
      expect(html.match(/vu-cran__halo/g)).toHaveLength(1);
      expect(html.includes('vu-reacteur__coeur')).toBe(n >= 3);
      expect(html).not.toMatch(/\sstyle=/);
      expect(html).not.toMatch(/<text/);
    }
  });
  it('crans sur 270 degrés, ouverts en bas, séparés par un jeu', () => {
    expect(arcReacteur(10, 0, 90)).toBe('M120.0 110.0A10 10 0 0 1 130.0 120.0');
    expect(arcCran(1)).toBe(arcReacteur(82, -132.5, -70));
    expect(arcCran(4)).toBe(arcReacteur(82, 70, 132.5));
  });
  it('le niveau, l’échelle et la règle restent écrits ; la règle se replie', () => {
    const html = rendre(
      createElement(NiveauAlerteBloc, {
        niveau: niveauAlerteGlobal({ critiques: 2, simples: 0, p2Presentes: 0, exploiteesAConfirmer: 0 }),
      }),
    );
    expect(html).toContain('<b>4</b>');
    expect(html).toContain('Maximale');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<details class="a-propos"><summary>Règle du niveau d’alerte<\/summary><p class="pc-niveau__regle">/,
    );
    sansStyle(html);
  });
  it('en-tête des cases : icône et rang décoratifs', () => {
    const html = rendre(createElement(TeteCase, { icone: 'exploitees', rang: 1 }));
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('>01<');
    sansStyle(html);
  });
});

describe('veille réglementaire : cartes d’acte (choix « K1 »)', () => {
  const publication = (p: Partial<PublicationReglementaireDto> = {}): PublicationReglementaireDto => ({
    id: '00000000-0000-4000-8000-000000000001',
    source: 'eur-lex',
    domaine: 'securite',
    titre: 'Acte fictif',
    resume: 'Résumé fictif.',
    lien: 'https://eur-lex.europa.eu/fictif/1',
    publieLe: '2026-11-19T08:00:00.000Z',
    collecteLe: '2026-11-20T06:00:00.000Z',
    statut: 'impactant',
    qualifieLe: '2026-11-20T09:00:00.000Z',
    qualifiePar: { id: 'u', nom: 'Nom fictif' },
    suites: { exigences: 0, actions: 0, documents: 0 },
    version: 1,
    ...p,
  });
  it('une autorité pour chaque source', () => {
    for (const s of SOURCES_REGLEMENTAIRES) expect(AUTORITES_REGLEMENTAIRES[s].autorite.length).toBeGreaterThan(0);
  });
  it('carte : source et autorité, statut, titre, résumé en citation, champs datés, lien', () => {
    const html = rendre(createElement(ListePublications, { publications: [publication()] }));
    expect(html).toContain('<article role="listitem" class="pc-niveau vr-acte vr--impactant">');
    expect(html).toContain('EUR-Lex · Union européenne');
    expect(html).toMatch(/<h3 class="vr-titre veille-texte">Acte fictif<\/h3>/);
    expect(html).toMatch(/<blockquote class="vr-resume veille-texte">Résumé fictif\.<\/blockquote>/);
    expect(html).toContain('<dt>Publié le</dt>');
    expect(html).toContain('Qualifiée par Nom fictif');
    expect(html).toContain('Lire sur le site de la source');
    sansStyle(html);
    const sansQualif = rendre(
      createElement(ListePublications, {
        publications: [publication({ statut: 'a-qualifier', qualifieLe: null, qualifiePar: null })],
      }),
    );
    expect(sansQualif).toContain('Non qualifiée');
  });
  it('sommaire : quatre cases décoratives, le texte lu reste « À qualifier : 3 »', () => {
    const html = rendre(
      createElement(SyntheseReglementaire, {
        s: {
          aQualifier: 3,
          aSuivre: 1,
          impactant: 2,
          sansObjet: 0,
          parDomaine: {
            securite: { aQualifier: 1, aSuivre: 0, impactant: 2, sansObjet: 0 },
            donneesPersonnelles: { aQualifier: 2, aSuivre: 1, impactant: 0, sansObjet: 0 },
          },
          derniereCollecteLe: null,
          sourcesEnErreur: 0,
        },
      }),
    );
    expect(html.match(/class="pc-tuile vr--/g)).toHaveLength(4);
    expect(html).toContain('<b aria-hidden="true">03</b>');
    expect(html).toContain('À qualifier : 3');
    sansStyle(html);
  });
});

describe('feuille de style du module', () => {
  const css = readFileSync(path.join(UI, 'neon-vulnerabilites.css'), 'utf8');
  it('jetons de la charte, ni px ni rem, ni couleur codée ; exportée et chargée après les autres', () => {
    expect(css.split('\n').filter((l) => /(?<![\w-])\d*\.?\d+(px|rem)\b/.test(l))).toEqual([]);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(readFileSync(path.join(UI, '../package.json'), 'utf8')).toContain('"./neon-vulnerabilites.css"');
    const main = readFileSync(path.join(SRC, 'main.tsx'), 'utf8');
    expect(main.indexOf("import '@suivi/ui/neon-vulnerabilites.css';")).toBeGreaterThan(
      main.indexOf("import '@suivi/ui/neon-commandement.css';"),
    );
  });
  it('limitée au module, flèches décoratives hors des noms accessibles', () => {
    const layout = readFileSync(path.join(SRC, 'components/Layout.tsx'), 'utf8');
    expect(layout).toContain(
      "destination === 'vulnerabilites' || destination === 'veille-reglementaire' ? destination : undefined",
    );
    expect(layout).toContain('data-module={moduleMaintenance}');
    // Toutes les règles portent la portée des deux modules (aucune règle globale hors des classes propres vu-, vr-).
    expect(css).not.toMatch(/\.app-main\[data-module='vulnerabilites'\]/);
    for (const c of css.match(/content: '[^']*[→][^']*'[^;]*;/g) ?? []) expect(c).toMatch(/\/ '';$/);
  });
  it('animations seulement sans préférence de mouvement réduit, coupées sinon et à l’impression', () => {
    const libre = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
      css.indexOf('@keyframes vu-orbite'),
    );
    expect((css.match(/animation: vu-/g) ?? []).length).toBe((libre.match(/animation: vu-/g) ?? []).length);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\{\s*animation: none !important;/);
    expect(css).toMatch(/@media print \{[^}]*\{\s*animation: none !important;/);
  });
});
