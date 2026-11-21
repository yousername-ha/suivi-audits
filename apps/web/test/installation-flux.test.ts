/* Assistant d'installation, étape « Flux vers l'extérieur » (ADR 0097, lot 3) : « Plus tard » ne déclenche aucun appel
   d'ouverture, « Activer » est impossible sans la case de validation, et avec elle l'appel porte la validation ; le courriel
   et ACME renvoient à leur page ; l'étape se passe d'un coup ; elle n'est proposée qu'à la connexion qui le demande.
   Données fictives. */
import { MantineProvider } from '@mantine/core';
import { FLUX_MODULES, fluxExterne, type FluxModule, type ReglagesAssistantDto } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { corpsActivationAssistant, corpsReglages, saisieDe } from '../src/assistant/reglages-corps';
import { HELP_ARTICLES } from '../src/help';
import {
  aReglerEnsuite,
  appelOuverture,
  destinationApresConnexion,
  LIEN_QUESTIONS_FLUX,
  manques,
  modeInstallation,
  ouvertures,
  retourSur,
  SAISIE_VIDE,
  type SaisieQuestions,
} from '../src/installation-flux';
import { EtapeFluxExterieur } from '../src/pages/QuestionsFlux';

const mode = (m: FluxModule) => modeInstallation(fluxExterne(m), true);
const ferme = () => false;
const saisie = (s: Partial<SaisieQuestions>): SaisieQuestions => ({ ...SAISIE_VIDE, ...s });
const toutes = (c: 'activer' | 'plus-tard') => Object.fromEntries(FLUX_MODULES.map((m) => [m, c]));
const toutesValidees = Object.fromEntries(FLUX_MODULES.map((m) => [m, true]));
const fournisseur = { adresse: 'https://modele.example.test/v1', modele: 'modele-fictif' };

const rendu = (props: Partial<Parameters<typeof EtapeFluxExterieur>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(
        MemoryRouter,
        null,
        createElement(EtapeFluxExterieur, {
          ouvert: ferme,
          mode,
          saisie: SAISIE_VIDE,
          onSaisie: () => {},
          envoi: false,
          erreur: null,
          onTerminer: () => {},
          onPasser: () => {},
          ...props,
        }) as ReactElement,
      ),
    ),
  );
/** Bouton « Terminer » rendu, avec ses attributs. */
const terminer = (html: string) =>
  /<button[^>]*>(?:(?!<\/button>).)*Terminer(?:(?!<\/button>).)*<\/button>/s.exec(html)![0];

describe('installation, flux vers l’extérieur : modes', () => {
  it('antivirus, mises à jour et les deux veilles s’ouvrent depuis l’étape ; courriel, ACME, Tenable et AlgoLightHouse depuis leur page', () => {
    expect(FLUX_MODULES.map((m) => [m, mode(m)])).toEqual([
      ['assistant', 'direct'],
      ['courriel', 'page'],
      ['acme', 'page'],
      ['antivirus', 'direct'],
      ['mises-a-jour', 'direct'],
      ['tenable', 'page'],
      ['veille-vulnerabilites', 'direct'],
      ['algolighthouse', 'page'],
      ['veille-reglementaire', 'direct'],
    ]);
  });
  it('sans le droit de régler l’assistant (ou module désactivé), l’assistant s’active depuis sa page', () => {
    expect(modeInstallation(fluxExterne('assistant'), false)).toBe('page');
    expect(modeInstallation(fluxExterne('antivirus'), false)).toBe('direct');
  });
});

describe('installation, flux vers l’extérieur : appels', () => {
  it('« Plus tard » ne déclenche aucun appel d’ouverture, même validé', () => {
    expect(
      ouvertures(FLUX_MODULES, saisie({ choix: toutes('plus-tard'), valides: toutesValidees }), mode, ferme),
    ).toEqual([]);
    // Aucun choix (étape passée) : rien non plus.
    expect(ouvertures(FLUX_MODULES, SAISIE_VIDE, mode, ferme)).toEqual([]);
    expect(manques(FLUX_MODULES, saisie({ choix: toutes('plus-tard') }), mode, ferme)).toEqual([]);
  });
  it('« Activer » sans case cochée : aucun appel, et « Terminer » est impossible', () => {
    const s = saisie({ choix: { antivirus: 'activer', 'mises-a-jour': 'activer' } });
    expect(ouvertures(FLUX_MODULES, s, mode, ferme)).toEqual([]);
    expect(manques(FLUX_MODULES, s, mode, ferme)).toEqual([
      'Antivirus (mise à jour des signatures) : cochez la case de validation, ou choisissez Plus tard.',
      'Mises à jour de la plateforme : cochez la case de validation, ou choisissez Plus tard.',
    ]);
  });
  it('« Activer » avec la case : l’appel de la route commune porte la confirmation', () => {
    const s = saisie({ choix: { antivirus: 'activer' }, valides: { antivirus: true } });
    expect(manques(FLUX_MODULES, s, mode, ferme)).toEqual([]);
    expect(ouvertures(FLUX_MODULES, s, mode, ferme)).toEqual(['antivirus']);
    expect(appelOuverture('antivirus')).toEqual({
      url: '/api/admin/flux-externes/antivirus',
      corps: { ouvert: true, confirmation: true },
    });
    expect(appelOuverture('mises-a-jour').url).toBe('/api/admin/flux-externes/mises-a-jour');
  });
  it('aucune ouverture par la route commune pour un module activé par son geste', () => {
    for (const m of ['assistant', 'courriel', 'acme'] as const) expect(() => appelOuverture(m)).toThrow();
  });
  it('courriel et ACME, même choisis et validés, ne sont pas ouverts depuis l’étape : ils renvoient à leur page', () => {
    const s = saisie({ choix: { courriel: 'activer', acme: 'activer' }, valides: { courriel: true, acme: true } });
    expect(ouvertures(FLUX_MODULES, s, mode, ferme)).toEqual([]);
    expect(manques(FLUX_MODULES, s, mode, ferme)).toEqual([]);
    expect(aReglerEnsuite(FLUX_MODULES, s, mode, []).map((r) => [r.module, r.lien])).toEqual([
      ['courriel', '/systeme/courriel'],
      ['acme', '/systeme/certificats'],
    ]);
  });
  it('un flux déjà ouvert n’est pas rouvert', () => {
    const s = saisie({ choix: { antivirus: 'activer' }, valides: { antivirus: true } });
    expect(ouvertures(FLUX_MODULES, s, mode, (m) => m === 'antivirus')).toEqual([]);
  });
  it('l’assistant exige la case, l’adresse et le modèle ; son corps porte la validation et l’activation', () => {
    const sansFournisseur = saisie({ choix: { assistant: 'activer' }, valides: { assistant: true } });
    expect(manques(FLUX_MODULES, sansFournisseur, mode, ferme)).toEqual([
      'Assistant RSSI : indiquez l’adresse du service de modèle et le nom du modèle.',
    ]);
    const s = { ...sansFournisseur, fournisseur };
    expect(manques(FLUX_MODULES, s, mode, ferme)).toEqual([]);
    expect(ouvertures(FLUX_MODULES, s, mode, ferme)).toEqual(['assistant']);
    const d = {
      actif: false,
      adresse: '',
      modele: '',
      budgetJetonsJour: 500000,
      enPause: false,
      heureRonde: 7,
      plafondRappelsJour: 3,
      delaiRelanceJours: 7,
      jourSynthese: 1,
      rondesSurEvenement: false,
      contexte: '',
      profils: [
        {
          id: 'pilotage',
          libelle: 'Pilotage',
          actif: true,
          perimetres: [],
          tousPerimetres: true,
          rondeQuotidienne: false,
          referent: null,
          documents: true,
          classificationMax: 'interne',
        },
      ],
      version: 4,
    } as unknown as ReglagesAssistantDto;
    const corps = corpsActivationAssistant(d, { adresse: ` ${fournisseur.adresse} `, modele: fournisseur.modele });
    expect(corps).toMatchObject({
      actif: true,
      fluxConfirme: true,
      adresse: fournisseur.adresse,
      modele: fournisseur.modele,
      version: 4,
      budgetJetonsJour: 500000,
    });
    expect(corps.profils[0]).not.toHaveProperty('libelle');
    // La page de réglage garde son corps : sans validation, aucune confirmation n'est jointe.
    expect(corpsReglages(saisieDe(d), 4, false)).not.toHaveProperty('fluxConfirme');
    expect(aReglerEnsuite(FLUX_MODULES, s, mode, ['assistant'])[0]).toMatchObject({
      module: 'assistant',
      lien: '/plateforme/assistant',
    });
  });
});

describe('installation, flux vers l’extérieur : connexion', () => {
  it('l’étape n’est ouverte qu’à la connexion qui la propose, et ramène ensuite à la page demandée', () => {
    expect(destinationApresConnexion('/', false)).toBe('/');
    expect(destinationApresConnexion('/documents?x=1', true)).toBe(
      `${LIEN_QUESTIONS_FLUX}?next=${encodeURIComponent('/documents?x=1')}`,
    );
    expect(retourSur('/documents')).toBe('/documents');
    for (const n of [null, '', '//exemple.test', 'https://exemple.test/']) expect(retourSur(n)).toBe('/');
  });
});

describe('installation, flux vers l’extérieur : rendu de l’étape', () => {
  it('chaque module du registre propose « Activer » et « Plus tard » ; l’étape se passe d’un coup', () => {
    const html = rendu();
    for (const f of FLUX_MODULES.map(fluxExterne)) expect(html).toContain(f.libelle);
    expect(html.match(/>Activer</g)).toHaveLength(FLUX_MODULES.length);
    expect(html.match(/>Plus tard</g)).toHaveLength(FLUX_MODULES.length);
    expect(html).toContain('Passer l’étape : tout plus tard');
    expect(terminer(html)).not.toContain('disabled');
    expect(html).not.toContain('J’ai pris connaissance');
  });
  it('« Activer » affiche la validation et sa case ; sans case cochée, « Terminer » est désactivé', () => {
    const html = rendu({ saisie: saisie({ choix: { antivirus: 'activer' } }) });
    expect(html).toContain('J’ai pris connaissance des destinations, des ports et des données qui sortent');
    expect(html).toContain('database.clamav.net');
    expect(terminer(html)).toContain('disabled');
    expect(html).toContain('cochez la case de validation');
    const valide = rendu({ saisie: saisie({ choix: { antivirus: 'activer' }, valides: { antivirus: true } }) });
    expect(terminer(valide)).not.toContain('disabled');
  });
  it('l’assistant demande son fournisseur ; le courriel renvoie à sa page, sans case dans l’étape', () => {
    const assistant = rendu({ saisie: saisie({ choix: { assistant: 'activer' } }) });
    expect(assistant).toContain('Adresse du service de modèle');
    expect(assistant).toContain('Nom du modèle');
    expect(assistant).toContain('J’ai pris connaissance');
    const courriel = rendu({ saisie: saisie({ choix: { courriel: 'activer' } }) });
    expect(courriel).toContain('Ce module s’active dans sa page (Configuration système &gt; Courriel)');
    expect(courriel).not.toContain('J’ai pris connaissance');
    expect(terminer(courriel)).not.toContain('disabled');
  });
  it('un flux déjà ouvert ne repropose pas « Activer »', () => {
    const html = rendu({ ouvert: (m) => m === 'antivirus' });
    expect(html.match(/>Activer</g)).toHaveLength(FLUX_MODULES.length - 1);
    expect(html).toContain('Flux déjà ouvert');
  });
});

describe('installation, flux vers l’extérieur : aide', () => {
  it('l’article des flux décrit l’étape de l’installation', () => {
    const texte = HELP_ARTICLES.find((x) => x.id === 'flux-externes')!.steps.join(' ');
    expect(texte).toContain('« Activer » ou « Plus tard »');
    expect(texte).toContain('Passer l’étape : tout plus tard');
    expect(texte).toContain('L’étape n’est proposée qu’une fois.');
  });
});
