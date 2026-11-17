/* Module Vulnérabilités (ADR 0100, lot V6) : alertes, côté interface. Fenêtre d'alerte critique (rôle alertdialog, nom et
   description accessibles, contenu, boutons selon les droits, plusieurs alertes bornées, aucun style en ligne, aucun nom),
   liste et fiche d'une alerte, rappel de l'en-tête du module, adresses de l'API, mise à l'écart pour la session, aide et
   menu. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import { type AlerteVulnerabiliteDto } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { FAMILLES } from '../src/navigation';
import { AlertesTable, FicheAlerte, RappelAlertesCritiquesVue } from '../src/vulnerabilites/Alertes';
import { FenetreAlerteCritiqueVue } from '../src/vulnerabilites/FenetreAlerteCritique';
import {
  lienFicheAlerte,
  resumePresence,
  resumeSuiviAlerte,
  urlAlertes,
  urlFenetre,
  urlPriseEnCompte,
} from '../src/vulnerabilites/alertes';
import { ecarter, ecartees, marqueAlerte, oublierEcartees } from '../src/vulnerabilites/alertes-session';

// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
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
  cle: 'CVE-2026-90001',
  cve: 'CVE-2026-90001',
  titre: 'Fictional Product Remote Code Execution',
  produit: 'Produit fictif',
  niveau: 'critique',
  priorite: {
    niveau: 'P1',
    faits: [
      { fait: 'exploitation', sources: ['kev', 'cert-fr'] },
      { fait: 'presence', presence: 'detectee' },
    ],
  },
  presences: ['detectee'],
  exploitation: [
    { source: 'kev', le: '2026-11-01T00:00:00.000Z' },
    { source: 'cert-fr', le: '2026-11-02T00:00:00.000Z' },
  ],
  etat: 'ouverte',
  ouverteLe: '2026-11-15T05:31:00.000Z',
  critiqueLe: '2026-11-15T05:31:00.000Z',
  majLe: '2026-11-15T05:31:00.000Z',
  priseEnCompte: null,
  cloture: null,
  notifiee: true,
  machines: { lisibles: 14, horsLecture: false },
  actifs: { lisibles: 0, horsLecture: false },
  produits: 0,
  version: 1,
  ...a,
});
const fenetre = (props: Partial<Parameters<typeof FenetreAlerteCritiqueVue>[0]> = {}) =>
  rendre(
    createElement(FenetreAlerteCritiqueVue, {
      alertes: [alerte()],
      total: 1,
      peutPrendreEnCompte: true,
      onPrendreEnCompte: rien,
      onPlusTard: rien,
      onOuvrir: rien,
      ...props,
    }),
  );
const boutons = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => texte(m[1]!));
/** Texte lisible d'un fragment rendu : les balises sont retirées jusqu'à ce qu'il n'en reste plus aucune. */
const texte = (html: string) => {
  let reste = html;
  let avant: string;
  do {
    avant = reste;
    reste = reste.replace(/<[^>]*>/g, '');
  } while (reste !== avant);
  return reste
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
};

describe('fenêtre d’alerte critique', () => {
  it('rôle alertdialog, modale, nom et description accessibles reliés', () => {
    const html = fenetre();
    expect(html).toMatch(/role="alertdialog"/i);
    expect(html).toMatch(/aria-modal="true"/i);
    const nom = /aria-labelledby="([^"]+)"/i.exec(html)![1]!;
    const description = /aria-describedby="([^"]+)"/i.exec(html)![1]!;
    expect(html).toContain(`id="${nom}"`);
    expect(html).toContain(`id="${description}"`);
    expect(html).toMatch(/<h2[^>]*>Faille exploitée présente chez nous<\/h2>/i);
    // Bandes diagonales et pictogramme : décoratifs, cachés des lecteurs d'écran.
    expect(html.match(/class="ac-bande" aria-hidden="true"/gi)).toHaveLength(2);
    expect(html).toMatch(/class="ac-signal" aria-hidden="true"/i);
  });

  it('contenu : priorité, titre, CVE, produit, présence, sources de l’exploitation, heure', () => {
    const t = texte(fenetre());
    expect(t).toContain('Alerte critique · priorité P1');
    expect(t).toContain('Fictional Product Remote Code Execution · CVE-2026-90001 · produit : Produit fictif');
    expect(t).toContain('Machines touchées14');
    expect(t).toContain('Détectée par Tenable');
    expect(t).toContain('ExploitationAvérée');
    expect(t).toContain('catalogue KEV · alerte du CERT-FR');
    expect(t).toContain('Reçue');
  });

  it('nombres hors des droits : signalés sans nombre ; exposition seule : actifs exposés', () => {
    expect(texte(fenetre({ alertes: [alerte({ machines: { lisibles: 2, horsLecture: true } })] }))).toContain(
      'Machines touchées2que vous pouvez lire, et d’autres hors de vos droits',
    );
    const expo = texte(
      fenetre({
        alertes: [
          alerte({
            presences: ['exposee'],
            machines: { lisibles: 0, horsLecture: false },
            actifs: { lisibles: 0, horsLecture: true },
          }),
        ],
      }),
    );
    expect(expo).toContain('Actifs exposés0que vous pouvez lire, et d’autres hors de vos droits');
  });

  it('boutons selon les droits : modifier, ou lecture seule', () => {
    expect(boutons(fenetre())).toEqual(['Pris en compte', 'Plus tard', 'Ouvrir la fiche']);
    expect(texte(fenetre())).toContain('La prise en compte vaut pour tout le monde et elle est tracée');
    const lecture = fenetre({ peutPrendreEnCompte: false });
    expect(boutons(lecture)).toEqual(['Fermer pour cette session', 'Ouvrir la fiche']);
    expect(texte(lecture)).toContain('réapparaît à votre prochaine connexion');
    expect(lecture).not.toMatch(/Pris en compte/);
  });

  it('plusieurs alertes : une seule fenêtre, la plus récente en tête, les autres listées et le reste compté', () => {
    const html = fenetre({
      alertes: [
        alerte(),
        alerte({ id: '00000000-0000-4000-8000-0000000000a2', cve: 'CVE-2026-90002', titre: 'Second fictional flaw' }),
        alerte({ id: '00000000-0000-4000-8000-0000000000a3', cve: null, cle: 'constat:x', titre: 'Contrôle fictif' }),
      ],
      total: 7,
    });
    expect(html.match(/role="alertdialog"/gi)).toHaveLength(1);
    const t = texte(html);
    expect(t).toContain('7 alertes critiques en attente');
    expect(t).toContain('Autres alertes critiques en attente');
    expect(t).toContain('Second fictional flaw · CVE-2026-90002');
    expect(t).toContain('Contrôle fictif · Constat de Tenable sans CVE');
    expect(t).toContain('et 4 autres, dans l’onglet « Alertes »');
    expect(t.indexOf('Fictional Product Remote Code Execution')).toBeLessThan(t.indexOf('Second fictional flaw'));
  });

  it('erreur affichée dans la fenêtre ; aucune alerte : rien', () => {
    expect(fenetre({ erreur: 'L’alerte a changé.' })).toMatch(
      /<p class="ac-erreur" role="alert">L’alerte a changé\.<\/p>/i,
    );
    expect(fenetre({ alertes: [] })).toBe('');
  });

  it('CSP : aucun attribut style ni script en ligne', () => {
    const html = fenetre({ alertes: [alerte(), alerte({ id: 'b' })], total: 2 });
    // Les composants Mantine posent leurs variables par le DOM (CSSOM, admis par l'ADR 0006) ; le rendu serveur les écrit en
    // attribut. Le balisage propre à la fenêtre (classes ac-*) n'en porte aucun.
    const propres = html.match(/<[^>]*class="(?:alerte-critique|ac-)[^"]*"[^>]*>/gi) ?? [];
    expect(propres.length).toBeGreaterThan(8);
    expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
    expect(html).not.toMatch(/<script/i);
  });
});

describe('onglet « Alertes »', () => {
  it('liste : en-têtes, niveau, faille, priorité, présence, état et suivi ; aucune alerte : message', () => {
    const html = rendre(
      createElement(AlertesTable, {
        alertes: [
          alerte(),
          alerte({
            id: 'c',
            niveau: 'simple',
            etat: 'close',
            cloture: { le: '2026-11-16T08:00:00.000Z', motif: 'traitee' },
            priseEnCompte: { par: 'Personne fictive', le: '2026-11-15T07:00:00.000Z' },
          }),
        ],
        onOuvrir: rien,
      }),
    );
    expect([...html.matchAll(/<th[^>]*>([^<]*)<\/th>/gi)].map((m) => m[1])).toEqual([
      'Niveau',
      'Faille',
      'Priorité',
      'Présence',
      'État',
    ]);
    const t = texte(html);
    expect(t).toContain('Alerte critique');
    expect(t).toContain('Prise en compte par Personne fictive');
    expect(t).toContain('Faille traitée (corrigée, risque accepté ou non concernée)');
    expect(t).toContain('Alerte close : plus rien n’est compté.');
    expect(texte(rendre(createElement(AlertesTable, { alertes: [], onOuvrir: rien })))).toContain(
      'Aucune alerte ne correspond.',
    );
  });

  it('fiche : « Pris en compte » seulement avec le droit de modifier et sur une alerte ouverte', () => {
    const avec = rendre(
      createElement(FicheAlerte, { a: alerte(), peutPrendreEnCompte: true, onPrendreEnCompte: rien }),
    );
    expect(boutons(avec)).toEqual(['Pris en compte']);
    const sans = rendre(
      createElement(FicheAlerte, { a: alerte(), peutPrendreEnCompte: false, onPrendreEnCompte: rien }),
    );
    expect(boutons(sans)).toEqual([]);
    expect(texte(sans)).toContain('demande le droit de modifier le module Vulnérabilités');
    const prise = rendre(
      createElement(FicheAlerte, {
        a: alerte({
          etat: 'prise_en_compte',
          priseEnCompte: { par: 'Personne fictive', le: '2026-11-15T07:00:00.000Z' },
        }),
        peutPrendreEnCompte: true,
        onPrendreEnCompte: rien,
      }),
    );
    expect(boutons(prise)).toEqual([]);
  });

  it('rappel de l’en-tête du module', () => {
    expect(rendre(createElement(RappelAlertesCritiquesVue, { enCours: 0 }))).toBe('');
    const html = rendre(createElement(RappelAlertesCritiquesVue, { enCours: 2 }));
    expect(html).toMatch(/role="status"/i);
    expect(texte(html)).toContain('2 alertes critiques en cours');
    expect(html).toContain('href="/vulnerabilites/alertes"');
  });

  it('résumés : présence en nombres lisibles, suivi', () => {
    expect(resumePresence(alerte({ produits: 2 }))).toEqual([
      'Machines touchées : 14',
      'Produits surveillés rattachés : 2',
    ]);
    expect(resumePresence(alerte({ machines: { lisibles: 0, horsLecture: false } }))).toEqual([
      'Aucune machine ni aucun actif que vous puissiez lire.',
    ]);
    expect(resumeSuiviAlerte(alerte())).toHaveLength(1);
  });

  it('adresses de l’API et lien de la fiche', () => {
    expect(urlAlertes({ etat: 'actives', niveau: '' })).toBe('/api/vulnerabilites/alertes');
    expect(urlAlertes({ etat: 'close', niveau: 'critique' }, 2)).toBe(
      '/api/vulnerabilites/alertes?etat=close&niveau=critique&page=2',
    );
    expect(urlFenetre()).toBe('/api/vulnerabilites/alertes/fenetre');
    expect(urlPriseEnCompte('a b')).toBe('/api/vulnerabilites/alertes/a%20b/prise-en-compte');
    expect(lienFicheAlerte('x')).toBe('/vulnerabilites/alertes?alerte=x');
  });
});

describe('mise à l’écart pour la session', () => {
  const memoire = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    };
  };
  it('par compte et par passage au niveau critique ; effacée à la fermeture de la session', () => {
    const s = memoire();
    const m = marqueAlerte(alerte());
    ecarter('u1', [m], s);
    expect(ecartees('u1', s).has(m)).toBe(true);
    expect(ecartees('u2', s).size).toBe(0);
    // Une montée ultérieure (nouvelle date critique) remontre la fenêtre.
    expect(ecartees('u1', s).has(marqueAlerte(alerte({ critiqueLe: '2026-11-16T00:00:00.000Z' })))).toBe(false);
    s.setItem('autre-cle', 'x');
    oublierEcartees(s);
    expect(ecartees('u1', s).size).toBe(0);
    expect(s.getItem('autre-cle')).toBe('x');
    // Valeur illisible : rien n'est écarté.
    s.setItem('suivi-alertes-critiques-ecartees:u3', '{');
    expect(ecartees('u3', s).size).toBe(0);
  });
});

describe('aide et menu', () => {
  it('article d’aide et onglet du module', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-alertes')!;
    expect(a.link).toBe('/vulnerabilites/alertes');
    const t = a.steps.join(' ');
    for (const mot of ['Pris en compte', 'Plus tard', 'Fermer pour cette session', 'Échap', 'P2', 'courriel'])
      expect(t).toContain(mot);
    const pages = FAMILLES.flatMap((f) => f.destinations).find((d) => d.id === 'vulnerabilites')!.rubriques;
    expect(pages.map((p) => p.to)).toContain('/vulnerabilites/alertes');
  });
});
