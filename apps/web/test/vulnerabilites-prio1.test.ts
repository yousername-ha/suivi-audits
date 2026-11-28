/* Module Vulnérabilités (ADR 0100, lot PRIO-1 ; décisions du RSSI des 19 et 20/11/2026), à l'écran : alerte critique gardée
   sous exception (marque « Risque accepté » dans la liste, la fiche et la fenêtre), alerte P1 montée par la fin de support
   (titre sans « exploitée »), marques des constats (libellé court « Logiciel malveillant (Tenable) », kit d'exploitation,
   rançongiciels, machine en fin de support), fait de la fin de support dans l'explication de la priorité, cartes d'avis
   « Présente sur le parc » et « Exposée sur Internet ». Données entièrement fictives ; aucune prop `style` dans le lot. */
import { MantineProvider } from '@mantine/core';
import type { AlerteVulnerabiliteDto, AvisVeilleDto, SourcesFailleDto } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { AlertesTable, FicheAlerte } from '../src/vulnerabilites/Alertes';
import { FicheAvis, ListeAvis } from '../src/vulnerabilites/AvisVeille';
import { FenetreAlerteCritiqueVue } from '../src/vulnerabilites/FenetreAlerteCritique';
import { faitsPriorite, marquesConstat } from '../src/vulnerabilites/failles';
import { MarquesSources, SourcesFaille } from '../src/vulnerabilites/SourcesFaille';
import { marquesAvis } from '../src/vulnerabilites/veille-presentation';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const rendre = (n: ReactNode) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, n),
    ),
  );
const rien = () => undefined;

const alerte = (a: Partial<AlerteVulnerabiliteDto> = {}): AlerteVulnerabiliteDto => ({
  id: '00000000-0000-4000-8000-0000000000a1',
  cle: 'CVE-2026-97001',
  cve: 'CVE-2026-97001',
  titre: 'Fictional Product Remote Code Execution',
  produit: 'Produit fictif',
  niveau: 'critique',
  priorite: {
    niveau: 'P1',
    faits: [
      { fait: 'exploitation', sources: ['kev'] },
      { fait: 'presence', presence: 'detectee' },
    ],
  },
  presences: ['detectee'],
  exploitation: [{ source: 'kev', le: '2026-11-01T00:00:00.000Z' }],
  etat: 'prise_en_compte',
  ouverteLe: '2026-11-15T05:31:00.000Z',
  critiqueLe: '2026-11-15T05:31:00.000Z',
  majLe: '2026-11-15T05:31:00.000Z',
  priseEnCompte: { par: 'rssi.fictif', le: '2026-11-15T06:00:00.000Z' },
  cloture: null,
  notifiee: true,
  machines: { lisibles: 2, horsLecture: false },
  actifs: { lisibles: 0, horsLecture: false },
  produits: 0,
  risqueAccepte: false,
  version: 1,
  ...a,
});

describe('lot PRIO-1 : alerte critique gardée sous exception', () => {
  it('liste et fiche : marque « Risque accepté » et sa définition ; rien sans exception', () => {
    const liste = rendre(createElement(AlertesTable, { alertes: [alerte({ risqueAccepte: true })], onOuvrir: rien }));
    expect(liste).toContain('Alerte critique');
    expect(liste).toContain('Risque accepté');
    const fiche = rendre(
      createElement(FicheAlerte, {
        a: alerte({ risqueAccepte: true }),
        peutPrendreEnCompte: false,
        onPrendreEnCompte: rien,
      }),
    );
    expect(fiche).toContain('Risque accepté');
    expect(fiche).toContain('une exception (risque accepté) est en vigueur');
    const sans = rendre(createElement(AlertesTable, { alertes: [alerte()], onOuvrir: rien }));
    expect(sans).not.toContain('Risque accepté');
  });

  it('fenêtre : marque dans l’en-tête ; une P1 montée par la fin de support n’est pas dite « exploitée »', () => {
    const vue = (a: AlerteVulnerabiliteDto) =>
      rendre(
        createElement(FenetreAlerteCritiqueVue, {
          alertes: [a],
          total: 1,
          peutPrendreEnCompte: true,
          onPrendreEnCompte: rien,
          onPlusTard: rien,
          onOuvrir: rien,
        }),
      );
    const marquee = vue(alerte({ etat: 'ouverte', priseEnCompte: null, risqueAccepte: true }));
    expect(marquee).toContain('Alerte critique · priorité P1 · risque accepté');
    expect(marquee).toContain('Faille exploitée présente chez nous');
    const fds = vue(
      alerte({
        etat: 'ouverte',
        priseEnCompte: null,
        exploitation: [],
        priorite: {
          niveau: 'P1',
          faits: [
            { fait: 'presence', presence: 'detectee' },
            { fait: 'gravite', gravite: 'critique' },
            { fait: 'fin_de_support' },
          ],
        },
      }),
    );
    expect(fds).toContain('Faille P1 présente chez nous');
    expect(fds).not.toContain('Faille exploitée présente chez nous');
    expect(fds).not.toContain('risque accepté');
  });
});

const sources = (s: Partial<SourcesFailleDto> = {}): SourcesFailleDto => ({
  exploitation: [],
  exploitable: [],
  valeurs: { gravites: [], cvss: [], epss: [] },
  certSante: null,
  ...s,
});

describe('lot PRIO-1 : marques et faits des failles', () => {
  it('kit d’exploitation, rançongiciels, machine en fin de support ; libellés courts en liste, complets en fiche', () => {
    const c = {
      exploite: true,
      exploiteMalware: true,
      exploitable: true,
      nonMaintenu: false,
      kitsExploitation: ['metasploit', 'canvas'] as const,
      surMachineFinSupport: true,
      sources: sources({ rancongiciel: true }),
    };
    expect(marquesConstat({ ...c, kitsExploitation: [...c.kitsExploitation] }).map((m) => m.libelle)).toEqual([
      'Exploitée (KEV)',
      'Rançongiciels (KEV)',
      'Logiciel malveillant (Tenable)',
      'Exploitable',
      'Kit d’exploitation : Metasploit, CANVAS (Tenable)',
      'Sur une machine en fin de support',
    ]);
    expect(marquesConstat({ ...c, kitsExploitation: [...c.kitsExploitation] }, true).map((m) => m.libelle)).toEqual([
      'Exploitée (KEV)',
      'Rançongiciels (KEV)',
      'Exploitée par un logiciel malveillant selon Tenable (« Exploited by malware »)',
      'Exploitable',
      'Kit d’exploitation disponible selon Tenable (« Exploitable with ») : Metasploit, CANVAS',
      'Sur une machine en fin de support',
    ]);
    // Le constat lui-même en fin de support garde sa marque propre, sans doublon.
    expect(
      marquesConstat({ ...c, kitsExploitation: [], finDeSupport: true, sources: sources() }).map((m) => m.libelle),
    ).toEqual(['Exploitée (KEV)', 'Logiciel malveillant (Tenable)', 'Exploitable', 'Fin de support']);
  });

  it('faits de la priorité : fin de support et rançongiciels visibles', () => {
    expect(
      faitsPriorite({
        niveau: 'P1',
        faits: [
          { fait: 'exploitation', sources: ['kev'] },
          { fait: 'rancongiciel' },
          { fait: 'presence', presence: 'detectee' },
          { fait: 'fin_de_support' },
        ],
      }),
    ).toEqual([
      'Exploitation avérée (catalogue KEV)',
      'Utilisée par des rançongiciels (catalogue KEV)',
      'Détectée par Tenable',
      'Machine en fin de support (système ou produit plus maintenu par l’éditeur) : un cran de plus',
    ]);
  });

  it('sources : rançongiciels dans la liste et la fiche ; kit rangé avec « exploitable »', () => {
    const s = sources({
      exploitation: [{ source: 'kev', le: '2026-11-01T00:00:00.000Z' }],
      exploitable: [{ source: 'tenable-kit', le: null }],
      rancongiciel: true,
    });
    const liste = rendre(createElement(MarquesSources, { s }));
    expect(liste).toContain('Rançongiciels (KEV)');
    expect(liste).toContain('d’abord kit d’exploitation disponible (Tenable)');
    const fiche = rendre(createElement(SourcesFaille, { s }));
    expect(fiche).toContain('Utilisée par des rançongiciels selon le catalogue KEV de la CISA');
    expect(fiche).toContain('Exploitable : kit d’exploitation disponible (Tenable).');
    expect(rendre(createElement(SourcesFaille, { s: sources() }))).not.toContain('rançongiciels');
  });
});

const avis = (a: Partial<AvisVeilleDto> = {}): AvisVeilleDto => ({
  id: '00000000-0000-4000-8000-0000000000b1',
  source: 'cert-fr',
  identifiant: 'CERTFR-2026-AVI-9701',
  nature: 'avis',
  titre: 'Multiples vulnérabilités dans un produit fictif',
  resume: 'Résumé fictif.',
  adresse: null,
  publieLe: '2026-11-19T10:00:00.000Z',
  cves: ['CVE-2026-97001', 'CVE-2026-97002', 'CVE-2026-97003'],
  vuLe: '2026-11-19T11:00:00.000Z',
  produit: null,
  fiche: null,
  parc: { presentes: [], exposees: [] },
  ...a,
});

describe('lot PRIO-1 : cartes d’avis de la veille', () => {
  it('« Présente sur le parc » et « Exposée sur Internet », avec le nombre de CVE concernées', () => {
    const a = avis({ parc: { presentes: ['CVE-2026-97001'], exposees: ['CVE-2026-97001', 'CVE-2026-97002'] } });
    expect(marquesAvis(a)).toEqual([
      { libelle: 'Présente sur le parc (1 CVE citée sur 3)', etat: 'attention' },
      { libelle: 'Exposée sur Internet (2 CVE citées sur 3)', etat: 'erreur' },
    ]);
    const toutes = avis({ cves: ['CVE-2026-97001'], parc: { presentes: ['CVE-2026-97001'], exposees: [] } });
    expect(marquesAvis(toutes).map((m) => m.libelle)).toEqual(['Présente sur le parc']);
    expect(marquesAvis(avis())).toEqual([]);
    const carte = rendre(createElement(ListeAvis, { avis: [a] }));
    expect(carte).toContain('Présente sur le parc (1 CVE citée sur 3)');
    expect(carte).toContain('Exposée sur Internet (2 CVE citées sur 3)');
    expect(rendre(createElement(ListeAvis, { avis: [avis()] }))).not.toContain('sur le parc');
  });

  it('fiche de l’avis : CVE concernées, par présence ; rien quand l’avis ne concerne pas la plateforme', () => {
    const fiche = rendre(
      createElement(FicheAvis, {
        a: avis({ parc: { presentes: ['CVE-2026-97003'], exposees: ['CVE-2026-97002'] } }),
        onOuvrirCve: rien,
      }),
    );
    expect(fiche).toContain('Sur la plateforme');
    expect(fiche).toContain('aria-label="Présentes sur le parc (1)"');
    expect(fiche).toContain('aria-label="Exposées sur Internet (1)"');
    expect(rendre(createElement(FicheAvis, { a: avis() }))).not.toContain('Sur la plateforme');
  });
});

describe('lot PRIO-1 : aide et sources', () => {
  it('aide : fin de support, zero-day, logiciel malveillant, risque accepté, cartes d’avis, fréquences', () => {
    const tout = HELP_ARTICLES.flatMap((a) => a.steps).join(' ');
    for (const t of [
      'gagne un cran : P4 devient P3, P3 devient P2, P2 devient P1, P1 reste P1',
      'le mot « zero-day » est réservé à une faille exploitée pour laquelle aucun correctif n’est connu',
      '« Logiciel malveillant (Tenable) » dans les listes',
      '« Exploited by malware »',
      'garde son alerte critique, marquée « Risque accepté »',
      '« Présente sur le parc »',
      'trois périodes de sa fréquence',
      'NVD jamais moins de deux heures après la précédente demande',
      'purgé au-delà de 90 jours',
      'garde les fréquences choisies',
      // Décisions du RSSI du 20/11/2026 (points a, b, c).
      'Le contrôle qui signale lui-même le système ou le produit non maintenu ne monte pas',
      'un seul cran au plus, les deux faits restent cités',
      'à priorité égale ces failles passent devant dans les listes et dans le tableau « Cibles par priorité »',
    ])
      expect(tout).toContain(t);
    expect(tout).not.toContain('36 heures');
  });
  it('aucune prop style dans les sources touchées par le lot', () => {
    for (const f of [
      'AvisVeille.tsx',
      'Alertes.tsx',
      'FenetreAlerteCritique.tsx',
      'SourcesFaille.tsx',
      'SeuilsPriorite.tsx',
    ])
      expect(readFileSync(path.join(ICI, '../src/vulnerabilites', f), 'utf8')).not.toMatch(/\bstyle=\{/);
  });
});
