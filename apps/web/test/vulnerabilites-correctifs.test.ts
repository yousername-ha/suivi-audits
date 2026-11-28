/* Module Vulnérabilités (ADR 0100, lot S3) : vue « Correctifs », état du correctif, fin de support, à l'écran. En-tête
   « n mises à jour à faire pour m failles », table des correctifs (texte de Tenable en anglais, nombres, machines lues,
   marques, délai, état du correctif et sources), failles et machines d'un groupe, mentions « Fin de support » et « sans
   correctif connu » (texte, jamais la seule couleur), tuile de la vue d'ensemble, fiche illustrée, aide ; aucun attribut
   style ni prop `style` dans les sources du lot. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import {
  type CorrectifDto,
  type CorrectifsDto,
  DELAIS_CORRECTION_DEFAUT,
  type FailleCorrectifDto,
  MARQUES_VIDES,
  type MachineMarqueeDto,
  estZeroDay,
  libelleMarqueExploitation,
  REGLE_ZERO_DAY,
  type VueEnsembleDto,
} from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import {
  CorrectifsTable,
  EnteteCorrectifs,
  FaillesCorrectifTable,
  MachinesCorrectifTable,
} from '../src/vulnerabilites/Correctifs';
import {
  ETAT_CORRECTIF_PUCE,
  libelleMachinesLues,
  repartitionCorrectif,
  sourceEtatCorrectif,
  sourcesCorrectif,
  urlCorrectif,
  urlCorrectifs,
} from '../src/vulnerabilites/correctifs-presentation';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { filtresDepuisAdresse, marquesConstat, urlMachines } from '../src/vulnerabilites/failles';
import { nomAccessibleMachine, urlParc } from '../src/vulnerabilites/parc';
import { TuileMachine } from '../src/vulnerabilites/ParcMachines';
import { Tuiles } from '../src/vulnerabilites/VueEnsemble';
import { LIENS_TUILES } from '../src/vulnerabilites/vue-ensemble';
import { ficheFaille } from './fiche-faille-fixture';

const rendu = (e: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(MemoryRouter, null, e)));
const rien = () => undefined;
const ICI = path.dirname(fileURLToPath(import.meta.url));

const groupe = (g: Partial<CorrectifDto> = {}): CorrectifDto => ({
  cle: '0123456789abcdef',
  solution: 'Upgrade to Exemple Server 2.4.62 or later (fictif).',
  failles: 37,
  cves: 112,
  machines: { lisibles: 14, horsLecture: true },
  priorite: 'P1',
  exploitees: 3,
  exploiteesSansCorrectif: 1,
  exploitables: 5,
  finDeSupport: 2,
  delai: { etat: 'en_depassement', echeance: '2026-11-10T08:00:00.000Z', enDepassement: 4 },
  correctif: { disponible: 30, aucun_connu: 1, non_renseigne: 6 },
  sourcesCorrectif: ['tenable', 'cert-sante'],
  ...g,
});
const faille = (f: Partial<FailleCorrectifDto> = {}): FailleCorrectifDto => ({
  id: '00000000-0000-4000-8000-0000000000c1',
  plugin: '900101',
  nom: 'Exemple Server < 2.4.62 Multiple Vulnerabilities (fictif)',
  priorite: 'P1',
  exploitee: true,
  exploitable: false,
  correctif: { etat: 'aucun_connu', sources: [{ source: 'cert-sante', valeur: 'aucun', le: null }] },
  situation: 'sans_correctif',
  finSupportLe: null,
  finDeSupport: false,
  delai: {
    etat: 'en_depassement',
    priorite: 'P1',
    delai: DELAIS_CORRECTION_DEFAUT.P1,
    premiere: '2026-11-01T08:00:00.000Z',
    depuis: '2026-11-01T08:00:00.000Z',
    echeance: '2026-11-03T08:00:00.000Z',
  },
  cves: 3,
  lisible: true,
  ...f,
});
/** Aucune balise propre à l'écran (hors balises de Mantine) ne porte d'attribut style ; aucune balise <style> autre que
    celles de Mantine, aucune balise <script>. */
const sansStyle = (html: string) => {
  const balises = (html.match(/<[a-z][^>]*>/gi) ?? []).filter((b) => !/mantine/i.test(b));
  expect(balises.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
  expect(html.match(/<style\b[^>]*>/gi)?.every((b) => /data-mantine-styles/i.test(b)) ?? true).toBe(true);
  expect(html).not.toMatch(/<script/i);
};

describe('vue « Correctifs »', () => {
  it('adresses de la route', () => {
    expect(urlCorrectifs({ q: '', priorite: '' })).toBe('/api/vulnerabilites/correctifs');
    expect(urlCorrectifs({ q: ' openssl ', priorite: 'P1' })).toBe(
      '/api/vulnerabilites/correctifs?q=openssl&priorite=P1',
    );
    expect(urlCorrectif('aucun')).toBe('/api/vulnerabilites/correctifs/aucun');
  });

  it('en-tête « n mises à jour à faire pour m failles », limites dites', () => {
    const d: CorrectifsDto = {
      misesAJour: 15,
      failles: 412,
      sansCorrectif: 9,
      groupes: [],
      total: 16,
      tronquee: false,
      calculeLe: '2026-11-18T10:00:00.000Z',
    };
    const html = rendu(createElement(EnteteCorrectifs, { d }));
    expect(html).toContain('15 mises à jour à faire pour 412 failles');
    expect(html).toContain('Et 9 failles sans correctif indiqué par la source.');
    expect(html).toContain('ne sont pas fusionnés');
    expect(html).toContain(
      'Les failles déclarées (produits surveillés) et les CVE de la surface externe n’y figurent pas',
    );
    expect(html).toContain('Fin de support : l’éditeur ne publie plus de correctif de sécurité');
    sansStyle(html);
  });

  it('table : texte de Tenable en anglais, nombres, machines lues, marques, délai, état du correctif et sources', () => {
    const html = rendu(
      createElement(CorrectifsTable, {
        groupes: [
          groupe(),
          groupe({ cle: 'aucun', solution: null, priorite: 'P3', exploitees: 0, finDeSupport: 0, exploitables: 0 }),
        ],
        onOuvrir: rien,
      }),
    );
    expect(html).toContain('lang="en"');
    expect(html).toContain('Upgrade to Exemple Server 2.4.62 or later (fictif).');
    expect(html).toContain('37 failles');
    expect(html).toContain('112 CVE distinctes');
    expect(html).toContain('14 machines lues, et d’autres que vous ne lisez pas');
    expect(html).toContain('3 à exploitation avérée, dont 1 sans correctif connu');
    expect(html).toContain('5 exploitable(s)');
    expect(html).toContain('Fin de support');
    expect(html).toContain('En dépassement');
    expect(html).toContain('4 en dépassement');
    expect(html).toContain('Correctif disponible : 30 · Aucun correctif connu : 1 · Correctif non renseigné : 6');
    expect(html).toContain('Selon Tenable (date de publication du correctif) et CERT Santé');
    expect(html).toContain('Sans correctif indiqué par la source');
    expect(html.indexOf('Upgrade to')).toBeLessThan(html.indexOf('Sans correctif indiqué'));
    sansStyle(html);
  });

  it('libellés : machines lues, répartition, sources, puce jamais seule', () => {
    expect(libelleMachinesLues({ lisibles: 1, horsLecture: false })).toBe('1 machine lue');
    expect(repartitionCorrectif({ disponible: 0, aucun_connu: 0, non_renseigne: 0 })).toBe('—');
    expect(sourcesCorrectif([])).toBe('Aucune source n’en parle');
    expect(ETAT_CORRECTIF_PUCE).toEqual({ disponible: 'succes', aucun_connu: 'erreur', non_renseigne: 'neutre' });
    expect(
      sourceEtatCorrectif(
        { etat: 'disponible', sources: [{ source: 'tenable', valeur: 'disponible', le: '2026-11-02T00:00:00.000Z' }] },
        () => '02/11/2026',
      ),
    ).toBe('Tenable (date de publication du correctif), 02/11/2026');
    expect(sourceEtatCorrectif({ etat: 'non_renseigne', sources: [] }, () => '')).toBeNull();
  });

  it('failles d’un groupe : lien seulement si une machine est lue ; précision « sans correctif connu » à côté de la marque', () => {
    const html = rendu(
      createElement(FaillesCorrectifTable, {
        failles: [
          faille(),
          faille({
            id: '00000000-0000-4000-8000-0000000000c2',
            nom: 'Exemple OS Unsupported Version Detection (fictif)',
            lisible: false,
            exploitee: false,
            situation: null,
            correctif: { etat: 'non_renseigne', sources: [] },
            finDeSupport: true,
          }),
        ],
        onOuvrir: rien,
      }),
    );
    // Lot PRIO-1 : exploitée sans correctif connu, la faille est dite « zero-day ».
    expect(html).toContain('Zero-day : exploitée, sans correctif connu');
    expect(html).not.toContain('Zero-day : exploitation avérée');
    expect(html).toContain('Exploitée, sans correctif connu');
    expect(html).toContain('Aucun correctif connu');
    expect(html).toContain('CERT Santé (mention « Un correctif existe »)');
    expect(html).toContain('Correctif non renseigné');
    expect(html).toContain('aucune de ses machines n’est lue par vous');
    // Une faille illisible n'a pas de bouton : un seul bouton (la faille lue).
    expect(html.match(/<button/gi)).toHaveLength(1);
    expect(html).toContain('Fin de support');
    sansStyle(html);
  });

  it('machines lues d’un groupe, avec la mention « Fin de support »', () => {
    const html = rendu(
      createElement(MachinesCorrectifTable, {
        machines: [
          {
            id: '00000000-0000-4000-8000-0000000000a1',
            nom: 'srv-web-01.exemple.invalid',
            adresse: '192.0.2.1',
            role: 'front',
            perimetreNom: 'Portail fictif',
            finDeSupport: true,
          },
        ],
        onOuvrir: rien,
      }),
    );
    expect(html).toContain('srv-web-01.exemple.invalid');
    expect(html).toContain('Portail fictif');
    expect(html).toContain('Fin de support');
    expect(rendu(createElement(MachinesCorrectifTable, { machines: [], onOuvrir: rien }))).toContain(
      'Aucune machine que vous lisez.',
    );
  });
});

describe('fin de support et précision du zero-day sur les machines', () => {
  const m = (x: Partial<MachineMarqueeDto> = {}): MachineMarqueeDto => ({
    id: '00000000-0000-4000-8000-0000000000a9',
    nom: 'srv-ancien-01.exemple.invalid',
    adresse: '192.0.2.9',
    systeme: null,
    role: 'back',
    perimetreId: null,
    perimetreNom: null,
    perimetreOrigine: null,
    depot: null,
    exposition: null,
    acr: null,
    aes: null,
    premiere: null,
    derniere: null,
    source: 'tenable',
    integration: { id: '00000000-0000-4000-8000-0000000000b1', nom: 'Tenable fictif', type: 'tenable' },
    compteurs: {
      critique: 1,
      elevee: 0,
      moyenne: 0,
      faible: 0,
      exploites: 1,
      exploitables: 0,
      declarees: 0,
      exploitationAveree: 1,
    },
    rang: { position: 1, total: 150, faits: [] },
    finDeSupport: true,
    finsDeSupport: [{ nom: 'Exemple OS Unsupported Version Detection (fictif)', le: '2025-10-14T00:00:00.000Z' }],
    version: 1,
    marques: { ...MARQUES_VIDES, priorite: 'P1', exploitationAveree: true, exploiteeSansCorrectif: true },
    ...x,
  });
  it('tuile : texte « Fin de support » et « Sans correctif connu », nom accessible complet, marque zero-day gardée', () => {
    const html = rendu(createElement(TuileMachine, { m: m(), onOuvrir: rien }));
    expect(html).toContain('Fin de support');
    expect(html).toContain('Sans correctif connu');
    expect(html).toContain('parc-marque--zd');
    expect(nomAccessibleMachine(m())).toContain('exploitation avérée, zero-day, sans correctif connu, fin de support');
    expect(nomAccessibleMachine(m({ finDeSupport: false, marques: MARQUES_VIDES }))).not.toContain('fin de support');
    sansStyle(html);
  });
  it('filtres « Fin de support » des machines, du parc et des failles, repris de l’adresse', () => {
    expect(urlMachines({ q: '', role: '', perimetre: '', finSupport: true })).toBe(
      '/api/vulnerabilites/machines?finSupport=oui',
    );
    expect(urlParc({ q: '', role: '', perimetre: '', finSupport: true })).toBe(
      '/api/vulnerabilites/machines/parc?finSupport=oui',
    );
    expect(filtresDepuisAdresse(new URLSearchParams('finSupport=oui')).finSupport).toBe(true);
    expect(filtresDepuisAdresse(new URLSearchParams('finSupport=non')).finSupport).toBe(false);
  });
  it('marques d’un constat : « Fin de support » distincte de « Non maintenu »', () => {
    expect(
      marquesConstat({
        exploite: false,
        exploiteMalware: false,
        exploitable: false,
        nonMaintenu: true,
        finDeSupport: true,
      }),
    ).toEqual([
      { libelle: 'Fin de support', etat: 'attention' },
      { libelle: 'Non maintenu', etat: 'neutre' },
    ]);
  });
});

describe('vue d’ensemble et fiche illustrée', () => {
  it('tuile « Fin de support » et précision des failles exploitées', () => {
    const tuiles: VueEnsembleDto['tuiles'] = {
      exploiteesPresentes: 3,
      aTraiter: { p1: 3, p2: 0 },
      aConfirmer: { failles: 0, produits: 0 },
      corrigeesCeMois: 0,
      enDepassement: 0,
      exploiteesSansCorrectif: 1,
      exploiteesCorrectifNonRenseigne: 2,
      finDeSupport: {
        constats: 4,
        machines: { lisibles: 3, horsLecture: true },
        services: { lisibles: 1, horsLecture: false },
      },
    };
    const html = rendu(createElement(Tuiles, { tuiles }));
    expect(LIENS_TUILES.finSupport).toBe('/vulnerabilites/failles?finSupport=oui');
    expect(html).toContain('href="/vulnerabilites/failles?finSupport=oui"');
    expect(html).toContain('dont 1 sans correctif connu, 2 correctif non renseigné');
    expect(html).toContain('machines : 3 lues (et d’autres)');
    expect(html).toContain('services exposés : 1 lu');
    expect(html).toContain('<b>04</b>');
    sansStyle(html);
  });
  it('fiche illustrée : état du correctif, sa source, la précision et la fin de support', () => {
    const html = rendu(
      createElement(FicheFailleIllustree, {
        f: ficheFaille({
          correctif: {
            etat: 'disponible',
            sources: [{ source: 'tenable', valeur: 'disponible', le: '2026-11-02T00:00:00.000Z' }],
          },
          situationExploitation: 'corrigible',
          finSupport: { etat: 'atteinte', le: '2025-10-14T00:00:00.000Z', source: 'tenable' },
        }),
      }),
    );
    expect(html).toContain('Correctif disponible');
    expect(html).toContain('Correctif disponible selon Tenable (date de publication du correctif) le 02/11/2026.');
    expect(html).toContain('Exploitée, correctif disponible');
    expect(html).toContain('Fin de support le 14/10/2025');
    expect(html).toContain('Tenable : date de fin de support du logiciel (seolDate) passée');
    // Lot PRIO-1 : exploitée avec un correctif disponible, la faille est dite « exploitation avérée », pas « zero-day ».
    expect(html).toContain('<span>Exploitation avérée</span>');
    expect(html).not.toContain('Zero-day');
    const nr = rendu(createElement(FicheFailleIllustree, { f: ficheFaille() }));
    expect(nr).toContain('Correctif non renseigné : aucune source rangée ne dit s’il en existe un.');
    expect(nr).toContain('Exploitée, correctif non renseigné');
  });
});

describe('aide et sources du lot', () => {
  it('aide en ligne : vue par correctif, état du correctif, fin de support', () => {
    const texte = HELP_ARTICLES.find((a) => a.id === 'vulnerabilites-failles')!.steps.join(' ');
    expect(texte).toContain('« n mises à jour à faire pour m failles »');
    expect(texte).toContain('ce qui ne veut pas dire qu’il n’en existe pas');
    expect(texte).toContain('Fin de support');
    // Lot PRIO-1 : la fin de support monte la priorité d'un cran (décision du RSSI du 19/11/2026).
    expect(texte).toContain(
      'Une faille présente sur une machine en fin de support gagne un cran de priorité (P1 reste P1)',
    );
    expect(texte).not.toContain('La fin de support ne change pas la priorité.');
  });
  it('lot PRIO-1 : le mot « zero-day » est réservé à une faille exploitée sans correctif connu', () => {
    expect(REGLE_ZERO_DAY).toContain('aucun correctif n’est connu');
    expect(REGLE_ZERO_DAY).toContain('ni « récente », ni « critique »');
    expect(libelleMarqueExploitation('sans_correctif')).toBe('Zero-day : exploitée, sans correctif connu');
    expect(libelleMarqueExploitation('corrigible')).toBe('Exploitation avérée');
    expect(libelleMarqueExploitation('correctif_non_renseigne')).toBe('Exploitation avérée');
    expect(libelleMarqueExploitation(null)).toBe('Exploitation avérée');
    expect(estZeroDay('corrigible')).toBe(false);
    expect(estZeroDay('sans_correctif')).toBe(true);
  });
  it('aucune prop style dans les sources du lot', () => {
    for (const f of ['Correctifs.tsx', 'correctifs-presentation.ts']) {
      const src = readFileSync(path.join(ICI, '../src/vulnerabilites', f), 'utf8');
      expect(src).not.toMatch(/\sstyle=\{/);
      expect(src).not.toMatch(/lockScroll=\{true\}/);
    }
    const src = readFileSync(path.join(ICI, '../src/vulnerabilites/Correctifs.tsx'), 'utf8');
    expect(src.match(/<Modal\b/g)?.length).toBe(src.match(/^\s+closeButtonProps=\{\{ 'aria-label'/gm)?.length);
    expect(src.match(/<Modal\b/g)?.length).toBe(src.match(/^\s+lockScroll=\{false\}/gm)?.length);
  });
});
