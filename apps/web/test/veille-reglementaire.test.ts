/* Veille réglementaire (ADR 0110) : menu conditionné par le droit du module, adresses de la liste (filtres, recherche,
   page), état affiché des sources, liste des publications (texte simple, lien contrôlé et sans référent, ANSSI sans
   résumé), qualification en un clic réservée au rôle du domaine, réglage des sources réservé à qui administre, activation
   réservée à l'administrateur. Données fictives. */
import { MantineProvider } from '@mantine/core';
import type {
  Action,
  DroitsVeilleReglementaireDto,
  EtatSourceReglementaireDto,
  EtatVeilleReglementaireDto,
  Module,
  PublicationReglementaireDto,
} from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { famillesVisibles, localiser } from '../src/navigation';
import {
  ActivationVeilleReglementaire,
  BoutonsQualification,
  MotsClesEurLex,
  ListePublications,
  SourcesReglementaires,
  SyntheseReglementaire,
} from '../src/veille-reglementaire/VeilleReglementaire';
import {
  etatSourceReglementaire,
  FILTRES_VIDES,
  lienPublication,
  lignesMotsCles,
  motsClesSaisis,
  messageCollectes,
  peutQualifier,
  PICTOS_REGLEMENTAIRES,
  urlPublications,
} from '../src/veille-reglementaire/veille-reglementaire';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (c: (p: any) => ReactElement | null, p: Record<string, unknown>) => createElement(c, p);

const publication = (p: Partial<PublicationReglementaireDto> = {}): PublicationReglementaireDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  source: 'cnil',
  domaine: 'donnees-personnelles',
  titre: 'Publication fictive',
  resume: 'Résumé fictif.',
  lien: 'https://www.cnil.fr/fictif/1',
  publieLe: '2026-11-19T08:00:00.000Z',
  collecteLe: '2026-11-20T06:00:00.000Z',
  statut: 'a-qualifier',
  qualifieLe: null,
  qualifiePar: null,
  suites: { exigences: 0, actions: 0, documents: 0 },
  version: 1,
  ...p,
});
const source = (s: Partial<EtatSourceReglementaireDto> = {}): EtatSourceReglementaireDto => ({
  source: 'cnil',
  libelle: 'Actualités de la CNIL',
  organisme: 'CNIL',
  hote: 'www.cnil.fr',
  domaine: 'donnees-personnelles',
  langue: 'fr',
  reprise: 'Licence CC BY-ND.',
  collecteur: true,
  activee: true,
  frequenceHeures: 24,
  derniereReussite: '2026-11-20T06:00:00.000Z',
  dernierEssai: '2026-11-20T06:00:00.000Z',
  erreur: null,
  enErreur: false,
  enRetard: false,
  motsCles: null,
  derniereCollecte: null,
  prochaineCollecte: '2026-11-21T06:00:00.000Z',
  version: 3,
  ...s,
});
const etat = (ouvert: boolean): EtatVeilleReglementaireDto => ({
  flux: { ouvert, applique: ouvert ? 'ouvert' : null },
  executant: { disponible: true },
  mandataire: { actif: false },
  sources: [source()],
});
const droits = (securite: boolean, donneesPersonnelles: boolean): DroitsVeilleReglementaireDto => ({
  administrer: false,
  qualifier: { securite, donneesPersonnelles },
});

describe('menu', () => {
  const seulement = (d: string[]) => (m: Module, a: Action) => d.includes(`${m}:${a}`);
  it('« Veille réglementaire » dans Conformité et audits, avec la lecture du module seulement', () => {
    const conformite = (d: string[]) =>
      famillesVisibles(seulement(d))
        .find((f) => f.famille.id === 'conformite')
        ?.destinations.map((x) => x.id) ?? [];
    expect(conformite(['veille_reglementaire:lire'])).toEqual(['veille-reglementaire']);
    expect(conformite(['vulnerabilites:lire'])).not.toContain('veille-reglementaire');
    expect(localiser('/veille-reglementaire')?.destination.id).toBe('veille-reglementaire');
    // Le droit réservé « DPO » ouvre la rubrique à lui seul.
    expect(conformite(['veille_reglementaire:dpo'])).toEqual(['veille-reglementaire']);
  });
});

describe('présentation', () => {
  it('adresses de la liste : filtres, recherche encodée, page', () => {
    expect(urlPublications(FILTRES_VIDES)).toBe('/api/veille-reglementaire/publications');
    expect(urlPublications({ statut: 'impactant', domaine: 'securite', source: 'anssi', q: ' NIS 2 & co ' }, 3)).toBe(
      '/api/veille-reglementaire/publications?statut=impactant&domaine=securite&source=anssi&q=NIS+2+%26+co&page=3',
    );
  });

  it('lien rendu seulement en https sur l’hôte de la source', () => {
    expect(lienPublication(publication())).toBe('https://www.cnil.fr/fictif/1');
    expect(lienPublication(publication({ lien: 'https://exemple.invalid/x' }))).toBeNull();
    expect(lienPublication(publication({ lien: 'javascript:alert(1)' }))).toBeNull();
    expect(lienPublication(publication({ source: 'anssi', lien: 'https://www.cnil.fr/fictif/1' }))).toBeNull();
  });

  it('état d’une source : sans collecteur, désactivée, en cours, inactive, erreur, retard, jamais, à jour', () => {
    expect(etatSourceReglementaire(source({ collecteur: false, activee: false }), true).libelle).toBe('Non disponible');
    expect(etatSourceReglementaire(source({ activee: false }), true).libelle).toBe('Désactivée');
    const enFile = source({
      derniereCollecte: {
        id: 'x',
        source: 'cnil',
        origine: 'manuel',
        etat: 'en_file',
        demandeLe: '2026-11-20T06:00:00.000Z',
        termineLe: null,
        elements: 0,
        tronque: false,
        erreur: null,
      },
    });
    expect(etatSourceReglementaire(enFile, true).libelle).toBe('Collecte demandée');
    expect(etatSourceReglementaire(source(), false).libelle).toBe('Veille inactive');
    expect(etatSourceReglementaire(source({ enErreur: true, erreur: 'Échec.' }), true)).toEqual({
      libelle: 'En erreur',
      etat: 'erreur',
    });
    expect(etatSourceReglementaire(source({ enRetard: true }), true).libelle).toBe('En retard');
    expect(etatSourceReglementaire(source({ enRetard: true, derniereReussite: null }), true).libelle).toBe(
      'Jamais collectée',
    );
    expect(etatSourceReglementaire(source(), true)).toEqual({ libelle: 'À jour', etat: 'succes' });
    expect(messageCollectes(2)).toMatch(/^2 collectes demandées/);
  });

  it('pastilles maison : une forme distincte par source, jamais un logo', () => {
    const formes = Object.values(PICTOS_REGLEMENTAIRES).map((p) => p.forme);
    expect(new Set(formes).size).toBe(formes.length);
    const html = rendu(h(ListePublications, { publications: [publication()] }));
    expect(html).toContain('aria-label="Source : CNIL"');
    expect(html).not.toMatch(/<img/);
  });
});

describe('liste des publications', () => {
  it('textes en texte simple, lien dans un nouvel onglet sans référent, ANSSI sans résumé', () => {
    const html = rendu(
      h(ListePublications, {
        publications: [
          publication({ titre: '<img src=x onerror=alert(1)>Titre piégé' }),
          publication({
            id: '00000000-0000-4000-8000-000000000002',
            source: 'anssi',
            domaine: 'securite',
            resume: null,
            lien: 'https://cyber.gouv.fr/fictif/2',
          }),
        ],
      }),
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;Titre piégé');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('href="https://www.cnil.fr/fictif/1"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="https://cyber.gouv.fr/fictif/2"');
    expect(html.match(/Résumé fictif\./g)).toHaveLength(1);
  });

  it('lien hors hôte : pas de lien', () => {
    const html = rendu(h(ListePublications, { publications: [publication({ lien: 'https://exemple.invalid/x' })] }));
    expect(html).not.toContain('exemple.invalid');
    expect(html).toContain('Lien indisponible');
  });

  it('qualification en un clic pour le rôle du domaine seulement', () => {
    const cnil = publication();
    const anssi = publication({
      id: '00000000-0000-4000-8000-000000000003',
      source: 'anssi',
      domaine: 'securite',
      resume: null,
      lien: 'https://cyber.gouv.fr/x',
    });
    expect(peutQualifier(droits(false, true), cnil)).toBe(true);
    expect(peutQualifier(droits(false, true), anssi)).toBe(false);
    expect(peutQualifier(undefined, cnil)).toBe(false);
    const dpo = rendu(
      h(ListePublications, { publications: [cnil, anssi], droits: droits(false, true), onQualifier: () => {} }),
    );
    expect(dpo.match(/aria-label="Qualifier « /g)).toHaveLength(1);
    expect(dpo).toContain('Qualification réservée au rôle RSSI.');
    const rssi = rendu(
      h(ListePublications, { publications: [cnil, anssi], droits: droits(true, false), onQualifier: () => {} }),
    );
    expect(rssi).toContain('Qualification réservée au droit DPO.');
    // Sans gestionnaire (lecture seule), aucun bouton.
    expect(rendu(h(ListePublications, { publications: [cnil], droits: droits(true, true) }))).not.toContain(
      'Qualifier « ',
    );
  });

  it('boutons de qualification : trois statuts, l’actuel marqué', () => {
    const html = rendu(
      h(BoutonsQualification, {
        p: publication({ statut: 'a-suivre', qualifiePar: { id: 'u', nom: 'Nom fictif' } }),
        enCours: false,
        onQualifier: () => {},
      }),
    );
    expect(html).toContain('Sans objet');
    expect(html).toContain('À suivre');
    expect(html).toContain('Impactant');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).not.toContain('À qualifier');
  });

  it('auteur et date de la qualification, synthèse', () => {
    const html = rendu(
      h(ListePublications, {
        publications: [
          publication({
            statut: 'impactant',
            qualifieLe: '2026-11-20T09:00:00.000Z',
            qualifiePar: { id: 'u', nom: 'Nom fictif' },
          }),
        ],
      }),
    );
    expect(html).toContain('Qualifiée par Nom fictif');
    const s = rendu(
      h(SyntheseReglementaire, {
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
          sourcesEnErreur: 2,
        },
      }),
    );
    expect(s).toContain('À qualifier : 3');
    expect(s).toContain('Impactant : 2');
    expect(s).toContain('2 sources en erreur');
  });
});

describe('filtre d’EUR-Lex', () => {
  const liste = [
    { mot: 'personal data', domaine: 'donnees-personnelles' as const },
    { mot: 'cybersecurity', domaine: 'securite' as const },
    { mot: 'resilience', domaine: 'securite' as const },
  ];
  const eurlex = source({
    source: 'eur-lex',
    libelle: 'Flux EUR-Lex',
    hote: 'eur-lex.europa.eu',
    domaine: 'securite',
    motsCles: { liste, parDefaut: true },
  });
  it('saisie : un mot par ligne et par domaine, lignes vides retirées', () => {
    expect(lignesMotsCles(liste, 'securite')).toBe('cybersecurity\nresilience');
    expect(
      motsClesSaisis({ securite: ' cybersecurity \n\nresilience\r\n', 'donnees-personnelles': 'personal data' }),
    ).toEqual([
      { mot: 'cybersecurity', domaine: 'securite' },
      { mot: 'resilience', domaine: 'securite' },
      { mot: 'personal data', domaine: 'donnees-personnelles' },
    ]);
  });
  it('lecture pour tous, saisie pour qui administre ; « Rétablir » seulement pour une liste réglée', () => {
    const lecture = rendu(h(MotsClesEurLex, { source: eurlex }));
    expect(lecture).toContain('cybersecurity · resilience');
    expect(lecture).toContain('Liste par défaut.');
    expect(lecture).not.toContain('<textarea');
    const admin = rendu(h(MotsClesEurLex, { source: eurlex, peutRegler: true, onEnregistrer: () => {} }));
    expect(admin.match(/<textarea/g)).toHaveLength(2);
    expect(admin).toContain('Enregistrer les mots-clés');
    expect(admin).not.toContain('Rétablir la liste par défaut');
    const reglee = rendu(
      h(MotsClesEurLex, {
        source: { ...eurlex, motsCles: { liste, parDefaut: false } },
        peutRegler: true,
        onEnregistrer: () => {},
      }),
    );
    expect(reglee).toContain('Rétablir la liste par défaut');
  });
});

describe('sources et activation', () => {
  it('réglage (activation, fréquence) pour qui administre ; texte sinon ; Légifrance non réglable', () => {
    const sources = [
      source(),
      source({
        source: 'legifrance',
        libelle: 'Journal officiel (Légifrance)',
        hote: null,
        collecteur: false,
        activee: false,
      }),
    ];
    const admin = rendu(
      h(SourcesReglementaires, { sources: sources, fluxOuvert: true, peutRegler: true, onRegler: () => {} }),
    );
    expect(admin).toContain('aria-label="Activer la source Actualités de la CNIL"');
    expect(admin).not.toContain('aria-label="Activer la source Journal officiel (Légifrance)"');
    expect(admin).toContain('Non disponible');
    const lecture = rendu(h(SourcesReglementaires, { sources: sources, fluxOuvert: true }));
    expect(lecture).not.toContain('aria-label="Activer la source');
    expect(lecture).toContain('Une fois par jour');
  });

  it('activation réservée à l’administrateur ; destinations affichées', () => {
    const fermee = rendu(
      h(ActivationVeilleReglementaire, {
        etat: etat(false),
        peutActiver: false,
        envoi: false,
        onActiver: () => {},
        onDesactiver: () => {},
      }),
    );
    expect(fermee).toContain('Seul un administrateur peut activer la veille réglementaire.');
    expect(fermee).toContain('www.cnil.fr');
    expect(fermee).toContain('cyber.gouv.fr');
    // ANS : aucun flux public connu, son hôte n'est pas une destination.
    expect(fermee).not.toContain('esante.gouv.fr');
    const admin = rendu(
      h(ActivationVeilleReglementaire, {
        etat: etat(false),
        peutActiver: true,
        envoi: false,
        onActiver: () => {},
        onDesactiver: () => {},
      }),
    );
    expect(admin).toContain('Activer la veille réglementaire');
    const ouverte = rendu(
      h(ActivationVeilleReglementaire, {
        etat: etat(true),
        peutActiver: true,
        envoi: false,
        onActiver: () => {},
        onDesactiver: () => {},
      }),
    );
    expect(ouverte).toContain('Désactiver la veille réglementaire');
  });
});
