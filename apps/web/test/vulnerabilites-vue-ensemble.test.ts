/* Module Vulnérabilités (ADR 0100, lot PC1) : « Vue d'ensemble », côté interface. Tuiles (liens vers les listes filtrées),
   bandeau d'alerte critique, niveau d'alerte, radar (nœuds atteignables au clavier avec un nom lisible, un seul arrêt de
   tabulation, aucun style en ligne), radar vide, tableau « Cibles par priorité », journal, capteurs, filtres repris de
   l'adresse par « Failles détectées », menu et aide. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import {
  type AlerteVulnerabiliteDto,
  type CibleVueDto,
  type EtatSynchronisationDto,
  niveauAlerteGlobal,
  type VueEnsembleDto,
} from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { FAMILLES, localiser } from '../src/navigation';
import { filtresDepuisAdresse } from '../src/vulnerabilites/failles';
import { disposerRadar } from '../src/vulnerabilites/radar';
import {
  BandeauAlerte,
  Capteurs,
  CiblesTable,
  Journal,
  NiveauAlerteBloc,
  RadarTactique,
  RadarVide,
  Tuiles,
} from '../src/vulnerabilites/VueEnsemble';
import {
  ADRESSE_VUE,
  etatConnecteur,
  filtrerCibles,
  ligneJournal,
  LIENS_TUILES,
  ouvertureCible,
  URL_VUE,
} from '../src/vulnerabilites/vue-ensemble';

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
/** Les composants Mantine posent leurs variables par le DOM (CSSOM, admis par l'ADR 0006) ; le rendu serveur les écrit en
    attribut. Le balisage propre à l'écran (classes pc-*, poste) n'en porte aucun ; aucune balise <style> ni <script>. */
const sansStyle = (html: string) => {
  const propres = (html.match(/<[^>]*class="(?:poste|pc-)[^"]*"[^>]*>/gi) ?? []).filter((b) => !/mantine-/i.test(b));
  expect(propres.length).toBeGreaterThan(0);
  expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/<script/i);
};
const cible = (c: Partial<CibleVueDto> = {}): CibleVueDto => ({
  cle: 'CVE-2026-90001',
  cve: 'CVE-2026-90001',
  titre: 'Fictional Product Remote Code Execution',
  produit: 'Produit fictif',
  secteur: 'web',
  priorite: { niveau: 'P1', faits: [] },
  presences: ['detectee'],
  exploitee: true,
  exploitable: false,
  aConfirmer: false,
  gravite: 'critique',
  epss: 0.94,
  etat: 'a_traiter',
  machines: { lisibles: 14, horsLecture: false },
  actifs: { lisibles: 0, horsLecture: false },
  produitId: '00000000-0000-4000-8000-0000000000b1',
  fiche: { nature: 'constat', id: '00000000-0000-4000-8000-0000000000c1' },
  ...c,
});
const tuiles: VueEnsembleDto['tuiles'] = {
  exploiteesPresentes: 1,
  aTraiter: { p1: 1, p2: 6 },
  aConfirmer: { failles: 4, produits: 2 },
  corrigeesCeMois: 12,
  enDepassement: 3,
};

describe('tuiles : chaque tuile mène à la liste filtrée', () => {
  it('liens et nombres', () => {
    const html = rendre(createElement(Tuiles, { tuiles }));
    expect(html).toContain(`href="${LIENS_TUILES.exploitees}"`);
    expect(html).toContain('href="/vulnerabilites/failles?priorite=P1"');
    expect(html).toContain('href="/vulnerabilites/failles?priorite=P2"');
    expect(html).toContain('href="/vulnerabilites/produits"');
    expect(html).toContain('href="/vulnerabilites/failles?etat=corrigee"');
    expect(html).toContain('Exploitées et présentes');
    expect(html).toContain('À traiter (P1 et P2)');
    expect(html).toContain('Produits à confirmer');
    expect(html).toContain('Corrigées ce mois');
    expect(html).toContain('<b>12</b>');
    expect(html).toContain('<b>06</b>');
    expect(html).toContain('4 failles, 2 produits');
    sansStyle(html);
  });
  it('« Failles détectées » reprend les filtres de l’adresse, et ignore une valeur inconnue', () => {
    expect(filtresDepuisAdresse(new URLSearchParams('priorite=P1'))).toMatchObject({ priorite: 'P1', etat: '' });
    expect(filtresDepuisAdresse(new URLSearchParams('etat=corrigee&exploite=oui'))).toMatchObject({
      etat: 'corrigee',
      exploite: true,
    });
    expect(filtresDepuisAdresse(new URLSearchParams('priorite=P9&etat=nimporte&gravite=x'))).toMatchObject({
      priorite: '',
      etat: '',
      gravite: '',
    });
  });
});

describe('bandeau d’alerte critique', () => {
  const alerte = {
    id: '00000000-0000-4000-8000-0000000000a1',
    cve: 'CVE-2026-90001',
    titre: 'Fictional Product Remote Code Execution',
    machines: { lisibles: 3, horsLecture: true },
  } as AlerteVulnerabiliteDto;
  it('affiché quand une alerte critique est en cours, avec le lien vers sa fiche', () => {
    const html = rendre(createElement(BandeauAlerte, { alertes: [alerte], total: 1 }));
    expect(html).toContain('role="status"');
    expect(html).toContain('Une faille exploitée est présente chez nous');
    expect(html).toContain('3 machines que vous pouvez lire, et d’autres hors de vos droits');
    expect(html).toContain('href="/vulnerabilites/alertes?alerte=00000000-0000-4000-8000-0000000000a1"');
    sansStyle(html);
  });
  it('absent sans alerte critique', () => {
    expect(rendre(createElement(BandeauAlerte, { alertes: [], total: 0 }))).toBe('');
  });
});

describe('niveau d’alerte', () => {
  it('chiffre, libellé, explication et échelle à quatre crans (cran courant marqué, texte en plus de la couleur)', () => {
    const n = niveauAlerteGlobal({ critiques: 0, simples: 2, p2Presentes: 3, exploiteesAConfirmer: 0 });
    const html = rendre(createElement(NiveauAlerteBloc, { niveau: n }));
    expect(html).toContain('<b>3</b>');
    expect(html).toContain('Alerte');
    expect(html).toContain(n.explication);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    for (const l of ['1 Veille', '2 Vigilance', '3 Alerte', '4 Maximale']) expect(html).toContain(l);
    expect(html).toContain('à confirmer par le RSSI');
    sansStyle(html);
  });
});

describe('radar', () => {
  const cibles = [
    cible(),
    cible({ cle: 'CVE-2026-90002', cve: 'CVE-2026-90002', priorite: { niveau: 'P2', faits: [] }, exploitee: false }),
    cible({
      cle: 'CVE-2026-90003',
      cve: 'CVE-2026-90003',
      priorite: { niveau: 'P2', faits: [] },
      aConfirmer: true,
      presences: ['a_confirmer'],
      secteur: 'reseau',
      fiche: null,
    }),
  ];
  const cases = [
    { secteur: 'web' as const, priorite: 'P1' as const, total: 1 },
    { secteur: 'web' as const, priorite: 'P2' as const, total: 1 },
    { secteur: 'reseau' as const, priorite: 'P2' as const, total: 1 },
  ];
  it('nœuds atteignables au clavier avec un nom lisible ; un seul arrêt de tabulation ; aucun style en ligne', () => {
    const scene = disposerRadar(cibles, cases);
    const html = rendre(createElement(RadarTactique, { scene, total: 3, onPoint: rien, onGroupe: rien }));
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Radar des failles suivies"');
    expect(html.match(/role="button"/g)).toHaveLength(3);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="P1 · CVE-2026-90001 · Fictional Product Remote Code Execution · secteur Web');
    // Halo pour l'exploitation avérée (CVE 90001 et 90003), cercle vide pour un produit à confirmer.
    expect(html.match(/class="pc-halo"/g)).toHaveLength(2);
    expect(html.match(/pc-noyau pc-noyau--vide/g)?.length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('Légende du radar');
    expect(html).toContain('pc-balayage');
    sansStyle(html);
  });
  it('radar vide : aucun point inventé', () => {
    const html = rendre(createElement(RadarVide));
    expect(html).toContain('Radar vide : aucune faille suivie.');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('<circle');
  });
});

describe('cibles par priorité', () => {
  it('en-têtes, ligne, faits, responsable du produit ; nombres lisibles seulement', () => {
    const html = rendre(
      createElement(CiblesTable, {
        cibles: [cible({ machines: { lisibles: 2, horsLecture: true } })],
        responsables: new Map([['00000000-0000-4000-8000-0000000000b1', 'Équipe fictive']]),
        onOuvrir: rien,
      }),
    );
    for (const t of ['Priorité', 'Faille et produit', 'Faits', 'EPSS', 'État', 'Responsable'])
      expect(html).toMatch(new RegExp(`<th[^>]*>${t}</th>`, 'i'));
    expect(html).toContain('Exploitation avérée');
    expect(html).toContain('Détectée par Tenable');
    expect(html).toContain('2 machines lisibles, et d’autres hors de vos droits');
    expect(html).toContain('0,94');
    expect(html).toContain('À traiter');
    expect(html).toContain('Équipe fictive');
    sansStyle(html);
  });
  it('filtres Toutes, Exploitées, Détectées, À confirmer et case du radar', () => {
    const l = [
      cible(),
      cible({ cle: 'b', exploitee: false, presences: ['declaree'] }),
      cible({ cle: 'c', exploitee: false, presences: ['a_confirmer'], aConfirmer: true, secteur: 'reseau' }),
    ];
    expect(filtrerCibles(l, 'toutes', null)).toHaveLength(3);
    expect(filtrerCibles(l, 'exploitees', null).map((c) => c.cle)).toEqual(['CVE-2026-90001']);
    expect(filtrerCibles(l, 'detectees', null).map((c) => c.cle)).toEqual(['CVE-2026-90001']);
    expect(filtrerCibles(l, 'a_confirmer', null).map((c) => c.cle)).toEqual(['c']);
    expect(filtrerCibles(l, 'toutes', { secteur: 'reseau', niveau: 'P1' }).map((c) => c.cle)).toEqual(['c']);
  });
  it('ouverture : fiche existante lisible, sinon la veille sur la CVE, sinon rien', () => {
    expect(ouvertureCible(cible())).toEqual({
      type: 'fiche',
      nature: 'constat',
      id: '00000000-0000-4000-8000-0000000000c1',
    });
    expect(ouvertureCible(cible({ fiche: null }))).toEqual({
      type: 'lien',
      to: '/vulnerabilites/veille?q=CVE-2026-90001',
    });
    expect(ouvertureCible(cible({ fiche: null, cve: null }))).toBeNull();
  });
});

describe('journal et capteurs', () => {
  it('lignes du journal : traces existantes, étiquette en texte', () => {
    expect(
      ligneJournal({
        nature: 'collecte',
        le: '2026-11-15T05:02:00.000Z',
        source: 'cisa-kev',
        etat: 'recu',
        elements: 3,
      }),
    ).toMatchObject({ etiquette: expect.stringContaining('KEV'), texte: 'collecte reçue : 3 éléments' });
    expect(
      ligneJournal({
        nature: 'synchronisation',
        le: '2026-11-15T05:30:00.000Z',
        connecteur: 'tenable',
        nom: 'Tenable fictif',
        etat: 'echec',
        elements: null,
        complete: null,
      }),
    ).toMatchObject({ etiquette: 'Tenable', texte: '« Tenable fictif » : synchronisation en échec', teinte: 'orange' });
    expect(
      ligneJournal({
        nature: 'alerte_ouverte',
        le: '2026-11-15T05:31:00.000Z',
        cve: 'CVE-2026-90001',
        niveau: 'critique',
      }),
    ).toMatchObject({ etiquette: 'Alerte critique', texte: 'CVE-2026-90001 : alerte ouverte' });
    const html = rendre(createElement(Journal, { entrees: [] }));
    expect(html).toContain('Aucune collecte, synchronisation ni alerte');
  });
  it('capteurs : sources de veille et connecteurs en deux listes distinctes', () => {
    const tenable = {
      integrationId: '00000000-0000-4000-8000-0000000000d1',
      nom: 'Tenable fictif',
      actif: true,
      gravites: ['critique'],
      derniere: {
        id: 'x',
        etat: 'recu',
        origine: 'planifie',
        demandeLe: '2026-11-15T05:00:00.000Z',
        termineLe: '2026-11-15T05:30:00.000Z',
        bilan: null,
        erreur: null,
      },
      derniereCompleteLe: '2026-11-15T05:30:00.000Z',
      inventaire: null,
    } as EtatSynchronisationDto;
    expect(etatConnecteur(tenable)).toEqual({
      libelle: 'Synchronisé',
      etat: 'succes',
      reussie: '2026-11-15T05:30:00.000Z',
    });
    expect(etatConnecteur({ ...tenable, actif: false }).libelle).toBe('Désactivé');
    expect(etatConnecteur({ ...tenable, derniere: null, derniereCompleteLe: null })).toMatchObject({
      libelle: 'Jamais synchronisé',
      reussie: null,
    });
    const html = rendre(createElement(Capteurs, { veille: undefined, tenable: [tenable], alh: [] }));
    expect(html).toMatch(/<h3[^>]*>Sources de veille<\/h3>/i);
    expect(html).toMatch(/<h3[^>]*>Connecteurs<\/h3>/i);
    expect(html).toContain('Tenable fictif');
    expect(html).toContain('Tenable Security Center');
    sansStyle(html);
  });
});

describe('menu, adresse et aide', () => {
  it('« Vue d’ensemble » est le premier onglet du module et son adresse d’accueil', () => {
    const d = FAMILLES.flatMap((f) => f.destinations).find((x) => x.id === 'vulnerabilites')!;
    expect(d.rubriques[0]).toMatchObject({ id: 'vulnerabilites-vue', label: 'Vue d’ensemble', to: ADRESSE_VUE });
    expect(localiser(ADRESSE_VUE)?.rubrique.id).toBe('vulnerabilites-vue');
    expect(URL_VUE).toBe('/api/vulnerabilites/vue-ensemble');
  });
  it('article d’aide : règle du niveau à confirmer, radar, nombres lisibles', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-vue')!;
    expect(a.link).toBe(ADRESSE_VUE);
    const t = JSON.stringify(a);
    for (const mot of [
      'niveau d’alerte',
      'radar',
      'à confirmer par le RSSI',
      'que vous pouvez lire',
      'Cibles par priorité',
    ])
      expect(t).toContain(mot);
  });
});
