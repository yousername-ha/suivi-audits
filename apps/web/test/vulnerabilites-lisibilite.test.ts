/* Lot L1 (ADR 0100) : lisibilité des alertes et avis de la veille, pastilles de source. Sept pastilles distinctes (sigle,
   forme, teinte), nom accessible complet ou décoratives ; découpe du texte d'une source en paragraphes et listes, en texte
   simple ; liste des alertes et avis (alerte du CERT-FR distincte d'un avis, CVE citées en boutons, lien vers l'original
   sans référent, ouverture de la fiche) ; fiche d'une alerte ; failles connues, un fait par ligne ; sources de la fiche
   illustrée ; feuille de style dans la charte. Données entièrement fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import type { AvisVeilleDto, FailleVeilleDto } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FicheAvis, ListeAvis, PucesCve } from '../src/vulnerabilites/AvisVeille';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { PictoSource } from '../src/vulnerabilites/PictoSource';
import {
  nomPicto,
  PICTO_EXPLOITABLE,
  PICTO_EXPLOITATION,
  PICTO_VALEUR,
  PICTOS_SOURCES,
  pictosExploitation,
  SOURCES_PICTO,
  sourcesFiche,
  TRACES_FORMES,
} from '../src/vulnerabilites/pictos-sources';
import { optionsRecherche } from '../src/vulnerabilites/recherche';
import { ListeFailles } from '../src/vulnerabilites/Veille';
import { alerteUrgente, blocsTexte, marquesAvis } from '../src/vulnerabilites/veille-presentation';
import { ficheFaille } from './fiche-faille-fixture';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src');
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, e),
    ),
  );
const rien = () => undefined;

const avis = (a: Partial<AvisVeilleDto> = {}): AvisVeilleDto => ({
  id: '00000000-0000-4000-8000-0000000000a1',
  parc: { presentes: [], exposees: [] },
  source: 'cert-fr',
  identifiant: 'CERTFR-2026-ALE-9001',
  nature: 'alerte',
  titre: 'Vulnérabilité dans un produit fictif',
  resume: 'Résumé fictif.',
  adresse: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-9001/',
  publieLe: '2026-11-17T10:00:00.000Z',
  cves: ['CVE-2026-90001'],
  vuLe: '2026-11-18T05:00:00.000Z',
  produit: null,
  fiche: null,
  ...a,
});
const faille = (f: Partial<FailleVeilleDto> = {}): FailleVeilleDto => ({
  cve: 'CVE-2026-90001',
  description: 'Fictional description.',
  publieLe: '2026-11-10T00:00:00.000Z',
  modifieLe: null,
  cvss31: { score: 9.8, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['produit_fictif'],
  epss: { score: 0.5, centile: 0.99, date: '2026-11-18' },
  kev: null,
  publications: [
    { source: 'nvd', le: '2026-11-10T00:00:00.000Z' },
    { source: 'cert-fr', le: '2026-11-17T10:00:00.000Z' },
  ],
  produitsCites: [],
  sources: { exploitation: [], exploitable: [], valeurs: { gravites: [], cvss: [], epss: [] }, certSante: null },
  surfaceExterne: null,
  ...f,
});

describe('pastilles de source', () => {
  it('huit sources (lot SI1 : Silène), chacune avec son sigle, sa forme et sa teinte propres ; noms exacts', () => {
    expect(SOURCES_PICTO).toHaveLength(8);
    const d = SOURCES_PICTO.map((s) => PICTOS_SOURCES[s]);
    for (const cle of ['sigle', 'forme', 'teinte'] as const) expect(new Set(d.map((x) => x[cle])).size).toBe(8);
    for (const x of d) {
      expect(x.sigle.length).toBeLessThanOrEqual(4);
      expect(TRACES_FORMES[x.forme]).toMatch(/^M[\d .a-zA-Z-]+$/);
    }
    expect(SOURCES_PICTO.map(nomPicto)).toEqual([
      'Source : catalogue KEV de la CISA',
      'Source : NVD (NIST)',
      'Source : EPSS (FIRST)',
      'Source : CERT-FR (ANSSI)',
      'Source : CERT Santé',
      'Source : Tenable',
      'Source : AlgoLightHouse',
      'Source : Silène (ANSSI)',
    ]);
  });
  it('correspondances des sources de la plateforme vers les pastilles', () => {
    expect(PICTO_EXPLOITATION).toEqual({
      kev: 'cisa-kev',
      'cert-fr': 'cert-fr',
      'cert-sante': 'cert-sante',
      alh: 'algolighthouse',
      // Lot N2 : contrôle « exploité par un logiciel malveillant » selon Tenable, pastille de Tenable.
      tenable: 'tenable',
    });
    expect(pictosExploitation([{ source: 'tenable' }, { source: 'kev' }])).toEqual(['cisa-kev', 'tenable']);
    expect(PICTO_EXPLOITABLE.alh).toBe('algolighthouse');
    expect(PICTO_VALEUR.first).toBe('epss');
    expect(pictosExploitation([{ source: 'cert-fr' }, { source: 'kev' }, { source: 'cert-fr' }])).toEqual([
      'cisa-kev',
      'cert-fr',
    ]);
  });
  it('nom accessible complet, ou décorative ; aucun style en ligne, aucune image', () => {
    const nommee = rendu(createElement(PictoSource, { source: 'cert-fr', avecNom: true }));
    expect(nommee).toContain('role="img"');
    expect(nommee).toContain('aria-label="Source : CERT-FR (ANSSI)"');
    expect(nommee).toContain('>FR</text>');
    expect(nommee).toContain('CERT-FR</span>');
    const deco = rendu(createElement(PictoSource, { source: 'nvd', decoratif: true }));
    expect(deco).toContain('aria-hidden="true"');
    expect(deco).not.toContain('role="img"');
    for (const html of [nommee, deco]) {
      expect(html).not.toMatch(/style="/);
      expect(html).not.toMatch(/<img|href=/);
    }
  });
});

describe('texte d’une source en paragraphes et listes', () => {
  it('texte sur une ligne : puces intégrées (deux au moins) après une ponctuation de fin', () => {
    expect(
      blocsTexte(
        'L’éditeur indique qu’elle est exploitée. - Appliquer le correctif ; - Restreindre l’accès ; - Chercher des traces.',
      ),
    ).toEqual([
      { type: 'paragraphe', texte: 'L’éditeur indique qu’elle est exploitée.' },
      { type: 'liste', elements: ['Appliquer le correctif ;', 'Restreindre l’accès ;', 'Chercher des traces.'] },
    ]);
  });
  it('tirets dans un mot, tiret isolé ou incise : rien n’est découpé', () => {
    const t = 'Vulnérabilité CVE-2026-90001 – dite critique – dans un produit fictif. - Une seule puce.';
    expect(blocsTexte(t)).toEqual([{ type: 'paragraphe', texte: t }]);
    expect(blocsTexte('   ')).toEqual([]);
  });
  it('retours à la ligne : ligne vide = paragraphe, puce en tête de ligne = liste', () => {
    expect(blocsTexte('Premier.\nSuite du premier.\n\nSecond.\n• un\n• deux\nFin.')).toEqual([
      { type: 'paragraphe', texte: 'Premier. Suite du premier.' },
      { type: 'paragraphe', texte: 'Second.' },
      { type: 'liste', elements: ['un', 'deux'] },
      { type: 'paragraphe', texte: 'Fin.' },
    ]);
  });
});

describe('alertes et avis', () => {
  it('alerte du CERT-FR distincte d’un avis et d’une publication du CERT Santé ; marques tirées de la veille seulement', () => {
    expect(alerteUrgente(avis())).toBe(true);
    expect(alerteUrgente(avis({ nature: 'avis' }))).toBe(false);
    expect(alerteUrgente(avis({ source: 'cert-sante' }))).toBe(false);
    expect(marquesAvis(avis()).map((m) => m.libelle)).toEqual(['Exploitation avérée (alerte du CERT-FR)']);
    expect(marquesAvis(avis({ cves: [] }))).toEqual([]);
    expect(marquesAvis(avis({ nature: 'avis' }))).toEqual([]);
    const fiche = {
      exploitee: 'oui',
      correctif: null,
      contournement: null,
      preuveConcept: 'disponible',
      cvss31: null,
      lueLe: '2026-11-16T05:00:00.000Z',
      exploiteeLe: null,
      preuveLe: null,
    } as const;
    expect(marquesAvis(avis({ source: 'cert-sante', fiche })).map((m) => m.libelle)).toEqual([
      'Exploitée selon le CERT Santé',
      'Preuve de concept disponible (CERT Santé)',
    ]);
  });
  it('liste : pastille et nature, titre de niveau 3, CVE en boutons, fiche à ouvrir, un seul lien sans référent', () => {
    const cves = Array.from({ length: 9 }, (_, i) => `CVE-2026-9000${i + 1}`);
    const html = rendu(
      createElement(ListeAvis, {
        avis: [
          avis({ cves }),
          avis({
            id: '2',
            nature: 'avis',
            identifiant: 'CERTFR-2026-AVI-9002',
            titre: '<script>alert(1)</script> Avis fictif',
            adresse: null,
            cves: [],
          }),
        ],
        onOuvrir: rien,
        onOuvrirCve: rien,
      }),
    );
    expect(html).toMatch(/^.*<ul class="va-liste" aria-label="Alertes et avis">/s);
    expect(html).toContain('class="va-item va-item--alerte va-item--urgente"');
    expect(html).toContain('class="va-item va-item--avis"');
    expect(html).toContain('va-nature va-nature--alerte va-nature--urgente');
    expect(html).toContain('aria-label="Source : CERT-FR (ANSSI)"');
    expect(html).toMatch(/<h3 class="va-titre"[^>]*>Vulnérabilité dans un produit fictif<\/h3>/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Avis fictif');
    expect(html).not.toContain('<script>');
    expect([...html.matchAll(/<button type="button" class="va-cve">/g)]).toHaveLength(6);
    expect(html).toContain('aria-label="CVE citées (9)"');
    expect(html).toContain('et 3 autres');
    expect(html).toContain('Ouvrir la fiche<span class="sr-only"> : CERTFR-2026-ALE-9001</span>');
    const liens = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(liens).toHaveLength(1);
    expect(liens[0]).toContain('target="_blank"');
    expect(liens[0]).toContain('rel="noopener noreferrer"');
    expect(liens[0]).toMatch(/referrerPolicy="no-referrer"/i);
    expect(html).toContain('Exploitation avérée (alerte du CERT-FR)');
  });
  it('fiche : résumé en paragraphes et liste, texte simple ; toutes les CVE ; mentions et lien', () => {
    const html = rendu(
      createElement(FicheAvis, {
        a: avis({
          resume: 'Faille <b>exploitée</b>. - Appliquer le correctif ; - Restreindre l’accès.',
          cves: Array.from({ length: 9 }, (_, i) => `CVE-2026-9000${i + 1}`),
        }),
        onOuvrirCve: rien,
      }),
    );
    expect(html).toContain('<p>Faille &lt;b&gt;exploitée&lt;/b&gt;.</p><ul><li>Appliquer le correctif ;</li>');
    expect(html).not.toContain('<b>');
    expect([...html.matchAll(/<button type="button" class="va-cve">/g)]).toHaveLength(9);
    expect(html).not.toContain('autres');
    expect(html).toContain('href="https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-9001/"');
    const vide = rendu(createElement(FicheAvis, { a: avis({ resume: '', cves: [], adresse: null }) }));
    expect(vide).toContain('La source ne publie aucun résumé');
    expect(vide).toContain('Aucune CVE citée.');
    expect(vide).not.toContain('<a ');
  });
  it('CVE sans action : texte simple', () => {
    const html = rendu(createElement(PucesCve, { cves: ['CVE-2026-90001'] }));
    expect(html).toContain('<span class="va-cve va-cve--texte">CVE-2026-90001</span>');
    expect(html).not.toContain('<button');
    expect(rendu(createElement(PucesCve, { cves: [] }))).not.toContain('va-cves');
  });
  it('aucun HTML interprété dans les composants des alertes et avis', () => {
    for (const f of ['AvisVeille.tsx', 'PictoSource.tsx', 'Veille.tsx'])
      expect(readFileSync(path.join(SRC, 'vulnerabilites', f), 'utf8')).not.toMatch(/dangerouslySetInnerHTML|style=\{/);
  });
});

describe('failles connues', () => {
  it('un fait par ligne : gravité, exploitation, EPSS, produit touché ; sources en pastilles nommées', () => {
    const html = rendu(createElement(ListeFailles, { failles: [faille()], onOuvrir: rien }));
    expect(html).toContain('<ul class="vf-liste" aria-label="Failles connues de la veille">');
    for (const t of ['Gravité (CVSS)', 'Exploitation', 'EPSS (FIRST)', 'Produit touché'])
      expect(html).toContain(`<dt>${t}</dt>`);
    expect(html).toContain('aria-label="Sources de CVE-2026-90001"');
    expect(html).toContain('aria-label="Source : NVD (NIST)"');
    expect(html).toContain('aria-label="Source : CERT-FR (ANSSI)"');
    expect(html).toContain('aria-label="Source : EPSS (FIRST)"');
    expect(html).not.toContain('Source : catalogue KEV');
    expect(html).toContain('Aucune source ne la signale');
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>CVE-2026-90001<\/button>/);
    const vide = rendu(createElement(ListeFailles, { failles: [] }));
    expect(vide).toContain('Aucune faille connue ne correspond à la recherche.');
  });
});

describe('ailleurs dans le module', () => {
  it('fiche illustrée : sources reprises dans l’en-tête, pastille sur chaque recommandation', () => {
    const f = ficheFaille({
      nature: 'cve',
      recommandations: {
        avis: [
          {
            source: 'cert-fr',
            identifiant: 'CERTFR-2026-ALE-9001',
            nature: 'alerte',
            titre: 'Alerte fictive',
            adresse: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-9001/',
            le: '2026-11-17T10:00:00.000Z',
          },
        ],
      },
    });
    expect(sourcesFiche(f)).toContain('cert-fr');
    const html = rendu(createElement(FicheFailleIllustree, { f }));
    expect(html).toContain('aria-label="Sources reprises par la fiche"');
    expect(html).toContain('aria-label="Source : CERT-FR (ANSSI)"');
    expect(html).toMatch(/<div class="ff-reco__tete"><span class="ps ps--bleu ps--fanion"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<a [^>]*referrerPolicy="no-referrer"[^>]*>lire l’avis/i);
    expect(sourcesFiche(ficheFaille({ nature: 'constat' }))).toContain('tenable');
  });
  it('barre de recherche : NVD et catalogue KEV d’une CVE', () => {
    const vide = { total: 0, elements: [] };
    const g = optionsRecherche({
      q: 'CVE-2026-90001',
      cves: {
        total: 1,
        elements: [
          {
            cve: 'CVE-2026-90001',
            gravite: 'CRITICAL',
            score: 9.8,
            kev: true,
            veille: true,
            fiche: true,
            produit: null,
            resume: null,
            machines: 0,
            machinesDeclarees: 0,
            actifs: 0,
            horsLecture: false,
          },
        ],
      },
      machines: vide,
      actifs: vide,
      produits: vide,
      technologies: vide,
      controles: vide,
      cveInconnue: null,
    });
    expect(g[0]!.options[0]!.sources).toEqual(['cisa-kev', 'nvd']);
  });
  it('feuille de style : jetons de la charte, ni px ni rem, ni couleur codée ; exportée et chargée', () => {
    const css = readFileSync(path.join(UI, 'neon-veille.css'), 'utf8');
    const lignes = css.split('\n').filter((l) => !l.trim().startsWith('@media'));
    expect(lignes.filter((l) => /(?<![\w-])\d*\.?\d+(px|rem)\b/.test(l))).toEqual([]);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(readFileSync(path.join(UI, '../package.json'), 'utf8')).toContain('"./neon-veille.css"');
    expect(readFileSync(path.join(SRC, 'main.tsx'), 'utf8')).toContain("import '@suivi/ui/neon-veille.css';");
  });
});
