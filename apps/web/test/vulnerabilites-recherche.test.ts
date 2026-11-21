/* Module Vulnérabilités (ADR 0100, lot R1) : barre de recherche globale à l'écran. Options groupées et pages ouvertes,
   « tout voir » vers les listes qui acceptent une recherche, état d'une CVE en texte (jamais la seule couleur), CVE inconnue
   de la veille locale, annonce des résultats, clavier, paramètres d'ouverture des pages ; rendu accessible (combobox nommé,
   listbox, groupes, options) ; aucun attribut style, feuille sans px ni rem. Données entièrement fictives. */
import { type RechercheGlobaleDto } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  deplacerOption,
  NOM_CHAMP_RECHERCHE,
  RechercheVulnerabilitesVue,
} from '../src/vulnerabilites/RechercheVulnerabilites';
import {
  annonceRecherche,
  detailCve,
  lienToutVoir,
  optionsRecherche,
  ouvertureConstat,
  ouvertureMachines,
  ouvertureProduit,
  ouvertureSurface,
  ouvertureVeille,
  rechercheValide,
  urlRecherche,
} from '../src/vulnerabilites/recherche';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ICI, '../src');
const UI = path.join(ICI, '../../../packages/ui/src');
const ID = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const rien = () => undefined;

const cve = (n: number, extra: Partial<RechercheGlobaleDto['cves']['elements'][number]> = {}) => ({
  cve: `CVE-2026-9${String(n).padStart(4, '0')}`,
  veille: true,
  resume: 'Fictional flaw.',
  produit: 'Editeur fictif Produit fictif',
  gravite: 'CRITICAL' as const,
  score: 9.8,
  kev: false,
  machines: 0,
  machinesDeclarees: 0,
  actifs: 0,
  horsLecture: false,
  fiche: true,
  ...extra,
});
const vide = { elements: [], total: 0 };
const reponse = (extra: Partial<RechercheGlobaleDto> = {}): RechercheGlobaleDto => ({
  q: 'exemple',
  cves: { elements: [cve(1, { machines: 2, kev: true }), cve(2), cve(3, { veille: false, fiche: false })], total: 12 },
  machines: {
    elements: [
      {
        id: ID(1),
        nom: 'srv-exemple-1.example.org',
        adresse: '192.0.2.41',
        systeme: 'Exemple Linux 9',
        role: 'front',
        perimetreNom: 'Périmètre fictif A',
      },
    ],
    total: 1,
  },
  actifs: {
    elements: [
      {
        id: ID(11),
        type: 'domaine',
        valeur: 'portail.example.org',
        adresse: '203.0.113.13',
        perimetreNom: null,
        alertesOuvertes: 2,
      },
    ],
    total: 9,
  },
  produits: {
    elements: [
      {
        id: ID(21),
        editeur: 'Editeur fictif',
        nom: 'Gestionnaire fictif',
        versionProduit: '10.1.2',
        machines: 5,
        porteurs: [
          { type: 'machine', id: ID(1), libelle: 'srv-exemple-1.example.org' },
          { type: 'machine', id: ID(2), libelle: 'srv-exemple-2.example.org' },
          { type: 'machine', id: ID(3), libelle: 'srv-exemple-3.example.org' },
        ],
      },
    ],
    total: 14,
  },
  technologies: {
    elements: [
      {
        id: ID(31),
        nom: 'Frontal fictif',
        editeur: 'Editeur fictif',
        produit: null,
        actifs: 1,
        porteurs: [{ type: 'hote', id: null, libelle: '198.51.100.11' }],
      },
    ],
    total: 1,
  },
  controles: { elements: [{ id: ID(41), pluginId: 950001, nom: 'Contrôle fictif < 2.0', machines: 3 }], total: 1 },
  cveInconnue: null,
  ...extra,
});

describe('options : groupes, pages ouvertes, « tout voir »', () => {
  const groupes = optionsRecherche(reponse());
  const g = (nom: string) => groupes.find((x) => x.groupe === nom)!;
  it('six groupes dans l’ordre, totaux de la réponse', () => {
    expect(groupes.map((x) => [x.libelle, x.total])).toEqual([
      ['CVE', 12],
      ['Machines internes', 1],
      ['Actifs exposés', 9],
      ['Applications : produits surveillés', 14],
      ['Applications : technologies exposées (AlgoLightHouse)', 1],
      ['Applications : contrôles de Tenable', 1],
    ]);
  });
  it('chaque résultat ouvre la page existante', () => {
    expect(g('cves').options[0]!.to).toBe('/vulnerabilites/veille?q=CVE-2026-90001&cve=CVE-2026-90001');
    // Sans fiche ouvrable : la liste des technologies de la surface externe, cherchée sur la CVE.
    expect(g('cves').options[2]!.to).toBe('/vulnerabilites/surface-externe?onglet=technologies&q=CVE-2026-90003');
    expect(g('machines').options[0]!.to).toBe(`/vulnerabilites/machines?machine=${ID(1)}`);
    expect(g('actifs').options[0]!.to).toBe(
      `/vulnerabilites/surface-externe?onglet=actifs&q=portail.example.org&actif=${ID(11)}`,
    );
    expect(g('produits').options[0]!.to).toBe(`/vulnerabilites/produits?produit=${ID(21)}`);
    expect(g('technologies').options[0]!.to).toBe(
      '/vulnerabilites/surface-externe?onglet=technologies&q=Frontal+fictif',
    );
    expect(g('controles').options[0]!.to).toBe(`/vulnerabilites/failles?constat=${ID(41)}`);
  });
  it('« tout voir » quand le groupe est tronqué et que la liste accepte une recherche', () => {
    expect(g('cves').options.at(-1)).toMatchObject({
      toutVoir: true,
      titre: 'Tout voir (12)',
      to: '/vulnerabilites/veille?q=exemple',
    });
    expect(g('actifs').options.at(-1)).toMatchObject({
      toutVoir: true,
      to: '/vulnerabilites/surface-externe?onglet=actifs&q=exemple',
    });
    // Groupe complet : pas de lien ; registre des produits : aucune recherche, pas de lien.
    expect(g('machines').options.some((o) => o.toutVoir)).toBe(false);
    expect(g('produits').options.some((o) => o.toutVoir)).toBe(false);
  });
  it('liens « tout voir » par liste ; saisie plus longue que les listes : aucun lien', () => {
    expect(lienToutVoir('machines', '192.0.2.')).toBe('/vulnerabilites/machines?q=192.0.2.');
    expect(lienToutVoir('controles', 'tomcat')).toBe('/vulnerabilites/failles?q=tomcat');
    expect(lienToutVoir('produits', 'glpi')).toBeNull();
    expect(lienToutVoir('cves', 'x'.repeat(101))).toBeNull();
  });
  it('détails en texte : état de la CVE, gravité, catalogue KEV, hors veille ; porteurs nommés et comptés', () => {
    expect(g('cves').options[0]!.detail).toBe(
      'Détectée sur 2 machines · Critique 9,8 · Catalogue KEV · Editeur fictif Produit fictif · Fictional flaw.',
    );
    expect(g('cves').options[1]).toMatchObject({ etat: 'non_detectee' });
    expect(g('cves').options[1]!.detail).toContain('Non détectée sur le parc');
    expect(g('cves').options[2]!.detail).toContain('Non citée par la veille locale');
    expect(detailCve(cve(4, { horsLecture: true, gravite: null, score: null, resume: null, produit: null }))).toBe(
      'Présente hors des périmètres que vous lisez',
    );
    expect(g('machines').options[0]!.detail).toBe('192.0.2.41 · Exemple Linux 9 · Front · Périmètre fictif A');
    expect(g('actifs').options[0]!.detail).toBe(
      'Nom de domaine · 203.0.113.13 · Périmètre AlgoLightHouse non relié · 2 alertes ouvertes',
    );
    expect(g('produits').options[0]!.detail).toBe(
      '5 machines reliées : srv-exemple-1.example.org, srv-exemple-2.example.org, srv-exemple-3.example.org et 2 autres',
    );
    expect(g('technologies').options[0]!.detail).toBe('Editeur fictif · 1 actif exposé : 198.51.100.11');
    expect(g('controles').options[0]!.detail).toBe('Contrôle 950001 · présent sur 3 machines');
  });
});

describe('annonce, saisie, clavier', () => {
  it('annonce les résultats, l’absence de résultat et la CVE inconnue', () => {
    expect(annonceRecherche(undefined, true)).toBe('Recherche en cours…');
    expect(annonceRecherche(reponse(), false)).toBe(
      '38 résultats : CVE 12, Machines internes 1, Actifs exposés 9, Applications : produits surveillés 14, Applications : technologies exposées (AlgoLightHouse) 1, Applications : contrôles de Tenable 1.',
    );
    const rienDuTout = reponse({
      cves: vide,
      machines: vide,
      actifs: vide,
      produits: vide,
      technologies: vide,
      controles: vide,
    });
    expect(annonceRecherche(rienDuTout, false)).toBe('Aucun résultat dans le module.');
    expect(annonceRecherche({ ...rienDuTout, cveInconnue: { cve: 'CVE-2026-99999' } }, false)).toBe(
      'CVE-2026-99999 : CVE inconnue de la veille locale.',
    );
  });
  it('saisie de 2 à 200 caractères ; adresse de la route', () => {
    expect(rechercheValide(' a ')).toBe(false);
    expect(rechercheValide('ab')).toBe(true);
    expect(rechercheValide('x'.repeat(201))).toBe(false);
    expect(urlRecherche(' 192.0.2.4 ')).toBe('/api/vulnerabilites/recherche?q=192.0.2.4');
    expect(urlRecherche('50% & co')).toBe('/api/vulnerabilites/recherche?q=50%25%20%26%20co');
  });
  it.each<[number, string, number, number | null]>([
    [-1, 'ArrowDown', 5, 0],
    [0, 'ArrowDown', 5, 1],
    [4, 'ArrowDown', 5, 0],
    [-1, 'ArrowUp', 5, 4],
    [0, 'ArrowUp', 5, 4],
    [2, 'Home', 5, 0],
    [2, 'End', 5, 4],
    [2, 'a', 5, null],
    [-1, 'ArrowDown', 0, null],
  ])('option %i, touche %s, %i options : %s', (actif, touche, n, attendu) => {
    expect(deplacerOption(actif, touche, n)).toBe(attendu);
  });
});

describe('paramètres d’ouverture des pages', () => {
  const p = (s: string) => new URLSearchParams(s);
  it('veille : recherche et fiche d’une CVE bien formée seulement', () => {
    expect(ouvertureVeille(p('q=CVE-2026-90001&cve=cve-2026-90001'))).toEqual({
      q: 'CVE-2026-90001',
      cve: 'CVE-2026-90001',
    });
    expect(ouvertureVeille(p('cve=pas-une-cve'))).toEqual({ q: null, cve: null });
    expect(ouvertureVeille(p(`q=${'x'.repeat(150)}`)).q).toHaveLength(100);
  });
  it('machines, surface externe, produits, contrôles : identifiants et onglets contrôlés', () => {
    expect(ouvertureMachines(p(`q=192.0.2.&machine=${ID(1)}`))).toEqual({ q: '192.0.2.', machine: ID(1) });
    expect(ouvertureMachines(p('machine=1;DROP'))).toEqual({ q: null, machine: null });
    expect(ouvertureSurface(p(`onglet=actifs&q=portail&actif=${ID(11)}`))).toEqual({
      onglet: 'actifs',
      q: 'portail',
      actif: ID(11),
    });
    expect(ouvertureSurface(p('onglet=inconnu')).onglet).toBeNull();
    expect(ouvertureProduit(p(`produit=${ID(21)}`))).toBe(ID(21));
    expect(ouvertureConstat(p('constat=x'))).toBeNull();
  });
});

describe('rendu accessible', () => {
  const rendre = (props: Partial<Parameters<typeof RechercheVulnerabilitesVue>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(RechercheVulnerabilitesVue, {
        id: 'rv',
        saisie: 'exemple',
        ouvert: true,
        actif: 1,
        reponse: reponse(),
        enCours: false,
        erreur: null,
        onSaisie: rien,
        onTouche: rien,
        onChoisir: rien,
        onSurvol: rien,
        onFocus: rien,
        onBlur: rien,
        ...props,
      }),
    );
  it('champ combobox nommé, liste ouverte, option active désignée, groupes nommés', () => {
    const html = rendre();
    expect(html).toContain('role="combobox"');
    expect(html).toContain(`aria-label="${NOM_CHAMP_RECHERCHE}"`);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-activedescendant="rv-o1"');
    expect(html).toContain('role="listbox"');
    expect((html.match(/role="group"/g) ?? []).length).toBe(6);
    expect((html.match(/role="option"/g) ?? []).length).toBe(10);
    expect(html).toContain('id="rv-o1" role="option" aria-selected="true"');
    expect(html).toContain('Non détectée sur le parc');
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/style=/);
  });
  it('liste fermée ou saisie trop courte : rien d’annoncé, liste repliée', () => {
    const html = rendre({ ouvert: false });
    expect(html).toContain('aria-expanded="false"');
    // La liste reste dans le document (cible de aria-controls), masquée.
    expect(html).toContain('<div class="rv__panneau" hidden="">');
    expect(html).toMatch(/id="rv-liste" role="listbox" aria-label="Résultats de la recherche" hidden=""/);
    expect(rendre({ saisie: 'e' })).toContain('<div class="rv__panneau" hidden="">');
    expect(rendre({ saisie: 'e' })).not.toContain('Recherche en cours');
  });
  it('CVE inconnue de la veille locale : message explicite, sans appel extérieur', () => {
    const html = rendre({
      reponse: reponse({
        q: 'CVE-2026-99999',
        cves: vide,
        machines: vide,
        actifs: vide,
        produits: vide,
        technologies: vide,
        controles: vide,
        cveInconnue: { cve: 'CVE-2026-99999' },
      }),
    });
    expect(html).toContain('<strong>CVE-2026-99999</strong> : CVE inconnue de la veille locale.');
    expect(html).toContain('La plateforme ne consulte aucun service extérieur depuis cette recherche.');
    expect(html).toContain('aria-expanded="false"');
  });
  it('erreur et recherche en cours dites en texte', () => {
    expect(rendre({ reponse: undefined, erreur: 'Erreur 500' })).toContain('Recherche impossible : Erreur 500');
    expect(rendre({ reponse: undefined, enCours: true })).toContain('Recherche en cours…');
  });
});

describe('intégration et charte', () => {
  it('la barre est en tête de toutes les pages du module ; l’appel précédent est annulé', () => {
    const layout = readFileSync(path.join(SRC, 'components/Layout.tsx'), 'utf8');
    expect(layout).toMatch(/destination\.id === 'vulnerabilites' &&\s*\(?\s*<RechercheVulnerabilites \/>/);
    const composant = readFileSync(path.join(SRC, 'vulnerabilites/RechercheVulnerabilites.tsx'), 'utf8');
    expect(composant).toContain('useDebouncedValue');
    expect(composant).toContain('{ signal }');
    expect(readFileSync(path.join(SRC, 'api.ts'), 'utf8')).toContain('signal: o.signal');
  });
  it('feuille de la barre : jetons de la charte, ni px ni rem', () => {
    const css = readFileSync(path.join(UI, 'neon-recherche.css'), 'utf8');
    const lignes = css.split('\n').filter((l) => !l.trim().startsWith('@media'));
    expect(lignes.filter((l) => /(?<![\w-])\d*\.?\d+(px|rem)\b/.test(l))).toEqual([]);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
