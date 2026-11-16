/* Flux vers l'extérieur, demandes du RSSI du 16/11/2026. (1) Garde-fou HSTS : fermer le flux ACME, depuis le résumé ou en
   changeant de mode dans la page Certificats, dit dans la confirmation que le site repasse sur le certificat interne, risque
   de devenir inaccessible par son nom de domaine (HSTS) et reste joignable par l'adresse IP ; rien n'est bloqué. (2) Texte
   replié proprement : le résumé et la fenêtre de validation portent les classes de repli de packages/ui (tableau empilable
   avec intitulés, textes sans ellipse) ; ces classes existent dans la charte, sans longueur codée en dur. Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import { FLUX_EXTERNES, FLUX_MODULES, fluxExterne, type FluxExterneEtat, type FluxModule } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TableauFlux } from '../src/components/FluxExternes';
import { DetailValidationFlux, Destinations } from '../src/components/ValidationFlux';
import {
  AVERTISSEMENT_HSTS,
  AVERTISSEMENT_HSTS_FOURNI,
  messageChangementCertificat,
  texteFermeture,
} from '../src/flux-externes';

const ici = path.dirname(fileURLToPath(import.meta.url));
const UI = path.resolve(ici, '../../../packages/ui/src');
const lire = (f: string) => readFileSync(f, 'utf8');
const rendu = (el: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, el)));

const etat = (module: FluxModule, e: Partial<FluxExterneEtat> = {}): FluxExterneEtat => ({
  module,
  ouvert: false,
  decidePar: null,
  decideLe: null,
  applique: null,
  appliqueLe: null,
  erreur: null,
  ...e,
});

describe('garde-fou HSTS : fermer le flux ACME', () => {
  it('l’avertissement nomme le certificat interne, le risque HSTS sur le nom de domaine et le recours par l’adresse IP', () => {
    expect(AVERTISSEMENT_HSTS).toContain('certificat de l’autorité interne');
    expect(AVERTISSEMENT_HSTS).toContain('HSTS');
    expect(AVERTISSEMENT_HSTS).toContain('inaccessible par son nom de domaine');
    expect(AVERTISSEMENT_HSTS).toContain('adresse IP du serveur');
    // Aucun nom de domaine réel : l'adresse est un exemple générique.
    expect(AVERTISSEMENT_HSTS).toContain('https://adresse-ip-du-serveur');
  });
  it('la confirmation de fermeture depuis le résumé avertit pour ACME, et seulement pour ACME', () => {
    expect(texteFermeture(fluxExterne('acme'))).toContain(AVERTISSEMENT_HSTS);
    for (const m of FLUX_MODULES.filter((x) => x !== 'acme')) {
      const t = texteFermeture(fluxExterne(m));
      expect(t, m).not.toContain('HSTS');
      expect(t, m).toContain('Pour le rouvrir, réactivez le module dans sa page');
    }
  });
  it('changer de mode depuis la page Certificats quand ACME est en service avertit, sans rien bloquer', () => {
    expect(messageChangementCertificat('tls_internal', true)).toContain(AVERTISSEMENT_HSTS);
    expect(messageChangementCertificat('tls_install', true)).toContain(AVERTISSEMENT_HSTS_FOURNI);
    expect(messageChangementCertificat('tls_reset', true)).toMatch(/CADDY_TLS=internal.*HSTS.*adresse IP du serveur/s);
    for (const g of ['tls_internal', 'tls_install', 'tls_reset'] as const) {
      expect(messageChangementCertificat(g, false), g).not.toContain('HSTS');
      expect(messageChangementCertificat(g, true).startsWith(messageChangementCertificat(g, false)), g).toBe(true);
    }
  });
});

describe('résumé des flux : tableau qui se replie sans rien tronquer', () => {
  const etats = new Map<FluxModule, FluxExterneEtat>([
    [
      'acme',
      etat('acme', {
        ouvert: true,
        decidePar: 'reprise-mise-a-jour',
        decideLe: '2026-11-16T08:00:00.000Z',
        applique: 'erreur',
        appliqueLe: '2026-11-16T08:01:00.000Z',
        erreur:
          'Retour de la passerelle à l’autorité interne refusé à la validation : elle reste en ACME ; nouvel essai dans dix minutes.',
      }),
    ],
    ['courriel', etat('courriel')],
  ]);
  const html = rendu(createElement(TableauFlux, { etats, ecriture: true, onFermer: () => {} }) as ReactElement);

  it('porte le conteneur et la classe du tableau empilable, chaque cellule avec son intitulé', () => {
    expect(html).toContain('tableau-empilable-conteneur');
    expect(html).toMatch(/<table[^>]*class="[^"]*tableau-empilable/);
    const intitules = [...html.matchAll(/<td[^>]*data-label="([^"]+)"/g)].map((m) => m[1]);
    expect(intitules).toEqual(FLUX_EXTERNES.flatMap(() => ['Module', 'Destinations', 'État', 'Action']));
    for (const t of ['Module', 'Destinations', 'État', 'Action']) expect(html).toContain(`>${t}</th>`);
  });
  it('affiche en entier destinations, ports, état voulu et appliqué, erreur et décision (aucune ellipse)', () => {
    for (const f of FLUX_EXTERNES)
      for (const d of f.destinations) {
        expect(html).toContain(d.hote);
        expect(html).toContain(d.ports);
      }
    expect(html).toContain('Voulu : ouvert');
    expect(html).toContain('Appliqué : erreur');
    expect(html).toContain('Erreur : Retour de la passerelle à l’autorité interne refusé');
    expect(html).toContain('par reprise-mise-a-jour');
    expect(html).toContain('Jamais décidé');
    expect(html).not.toMatch(/text-overflow|line-clamp|…<\/(td|span|p|div)>/);
    expect(html).toContain('aria-label="Fermer le flux Certificat public ACME"');
    expect(html).not.toContain('aria-label="Fermer le flux Courriel (SMTP/SMTPS)"');
  });
  it('sans le droit d’administrer, aucun bouton Fermer', () => {
    const lecture = rendu(createElement(TableauFlux, { etats, ecriture: false, onFermer: () => {} }) as ReactElement);
    expect(lecture).not.toContain('Fermer le flux');
  });
});

describe('fenêtre de validation : texte replié', () => {
  it('destinations, ports, données, porteur et pare-feu en entier, dans un bloc de repli ; ports groupés', () => {
    for (const m of FLUX_MODULES) {
      const f = fluxExterne(m);
      const html = rendu(
        createElement(DetailValidationFlux, { module: m, valide: false, onValide: () => {} }) as ReactElement,
      );
      expect(html, m).toMatch(/class="[^"]*flux-texte/);
      expect(html, m).toContain(f.donnees);
      for (const r of f.pareFeu) expect(html, m).toContain(`>${r}</`);
      for (const d of f.destinations) expect(html, m).toContain(`<span class="flux-ports">· ${d.ports}</span>`);
    }
    expect(rendu(createElement(Destinations, { f: fluxExterne('antivirus') }) as ReactElement)).toContain(
      'flux-destinations',
    );
  });
});

describe('classes de repli dans la charte (packages/ui)', () => {
  const styles = lire(path.join(UI, 'styles.css'));
  const fenetres = lire(path.join(UI, 'neon-fenetres.css'));
  it('le tableau empilable passe en blocs avec intitulés dans un conteneur étroit', () => {
    expect(styles).toMatch(/\.tableau-empilable-conteneur \{\s*container-type: inline-size;/);
    expect(styles).toMatch(
      /@container \(max-width: 48em\) \{[\s\S]*?display: block;[\s\S]*?content: attr\(data-label\);/,
    );
    expect(styles).toMatch(/\.tableau-empilable :is\(th, td\) \{\s*overflow-wrap: break-word;\s*white-space: normal;/);
  });
  it('les textes des flux se coupent plutôt que de déborder, sans ellipse', () => {
    expect(styles).toMatch(/\.flux-texte \{\s*min-inline-size: 0;\s*overflow-wrap: anywhere;/);
    expect(styles).toMatch(/text-overflow: clip;/);
  });
  it('la fenêtre ne dépasse jamais l’écran et ses boutons s’empilent sur téléphone', () => {
    expect(fenetres).toMatch(/\.mantine-Modal-content\.fenetre-flux \{\s*max-inline-size: 100%;/);
    expect(fenetres).toMatch(
      /@media \(max-width: 36em\) \{\s*\.fenetre-flux__actions \{\s*flex-direction: column-reverse;/,
    );
  });
  it('les règles ajoutées n’ont aucune longueur en px ou rem (jetons de la charte)', () => {
    const bloc = (texte: string, debut: string, fin: string) => texte.slice(texte.indexOf(debut), texte.indexOf(fin));
    const ajouts = [
      bloc(
        styles,
        '/* Tableau empilable',
        '/* ---------------------------------------------------------------- Sections',
      ),
      bloc(fenetres, '/* Fenêtres des flux vers', '/* Fiches des registres'),
    ];
    for (const a of ajouts) {
      expect(a.length).toBeGreaterThan(100);
      expect(a).not.toMatch(/(?<![\w-])\d*\.?\d+(px|rem)\b/);
    }
  });
});
