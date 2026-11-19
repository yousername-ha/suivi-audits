/* Module Vulnérabilités (ADR 0100, point 10 ; lot V4b) : suivi d'une faille à l'écran. Marques (état, « corrigée selon la
   source, à confirmer », plus rapportée, proposition refusée, revue dépassée, actions liées), filtre de suivi, états
   proposés, corps du changement d'état (note obligatoire, date de revue), historique, actions liées (une action non
   lisible n'est signalée que par sa présence), colonne « Suivi » des listes, fiche d'une faille déclarée, aide. Données
   entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type {
  SourcesFailleDto,
  ActionLieeDto,
  ConstatResumeDto,
  EntreeHistoriqueSuiviDto,
  FailleDeclareeDto,
  FicheDeclareeDto,
  SuiviResumeDto,
} from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { ConstatsTable, DeclareesTable, FicheDeclaree } from '../src/vulnerabilites/FaillesDetectees';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { ficheFaille } from './fiche-faille-fixture';
import { ActionsLiees, HistoriqueSuivi, MarquesSuivi } from '../src/vulnerabilites/SuiviFaille';
import {
  corpsChangementEtat,
  ETAT_SUIVI_PUCE,
  etatsChoisissables,
  libelleHistorique,
  marquesSuivi,
  OPTIONS_FILTRE_SUIVI,
  urlSuivi,
} from '../src/vulnerabilites/suivi';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const SOURCES_VIDES: SourcesFailleDto = {
  exploitation: [],
  exploitable: [],
  valeurs: { gravites: [], cvss: [], epss: [] },
  certSante: null,
};
const rien = () => undefined;
const suivi = (s: Partial<SuiviResumeDto> = {}): SuiviResumeDto => ({
  etat: 'nouvelle',
  proposition: 'aucune',
  revueLe: null,
  revueDepassee: false,
  exceptionStatut: null,
  nombreActions: 0,
  version: 0,
  ...s,
});
const DELAI = {
  etat: 'dans_les_delais' as const,
  priorite: 'P2' as const,
  delai: { duree: 15, unite: 'jours' as const },
  premiere: '2026-11-10T08:00:00.000Z',
  depuis: '2026-11-10T08:00:00.000Z',
  echeance: '2026-11-25T08:00:00.000Z',
};
const priorite = { niveau: 'P2' as const, faits: [{ fait: 'presence' as const, presence: 'detectee' as const }] };
const constat = (c: Partial<ConstatResumeDto> = {}): ConstatResumeDto => ({
  id: '00000000-0000-4000-8000-000000000c01',
  plugin: '950003',
  nom: 'Exemple Linux : contrôle fictif',
  gravite: 'moyenne',
  famille: null,
  cvss3Score: null,
  vpr: null,
  epss: null,
  exploitable: false,
  exploite: false,
  exploiteMalware: false,
  nonMaintenu: false,
  finSupportLe: null,
  finDeSupport: false,
  correctifEtat: { etat: 'non_renseigne', sources: [] },
  nombreCves: 0,
  cves: [],
  machines: 1,
  derniereDetection: null,
  present: false,
  alerteCertFr: false,
  sources: SOURCES_VIDES,
  priorite,
  suivi: suivi({ etat: 'a_traiter', proposition: 'a_confirmer' }),
  delai: DELAI,
  integration: { id: '00000000-0000-4000-8000-0000000000a1', nom: 'Tenable fictif', type: 'tenable' },
  ...c,
});
const declaree: FailleDeclareeDto = {
  rapprochementId: '00000000-0000-4000-8000-0000000000d1',
  cve: 'CVE-2026-95101',
  statut: 'ecartee',
  produit: {
    id: '00000000-0000-4000-8000-000000000001',
    editeur: 'Éditeur fictif',
    nom: 'Produit fictif',
    versionProduit: '2.1',
  },
  gravite: 'critique',
  cvssScore: 9.8,
  epss: null,
  kev: false,
  alerteCertFr: false,
  sources: SOURCES_VIDES,
  machines: 1,
  present: false,
  priorite,
  suivi: suivi({ etat: 'risque_accepte', revueLe: '2026-01-01', revueDepassee: true, exceptionStatut: 'echue' }),
  delai: { ...DELAI, etat: 'sous_exception' },
};

describe('marques et filtre de suivi', () => {
  it('état, proposition à confirmer, plus rapportée, refus, revue dépassée, actions liées', () => {
    expect(marquesSuivi(suivi(), true, 'Tenable').map((m) => m.libelle)).toEqual(['Nouvelle']);
    expect(
      marquesSuivi(suivi({ etat: 'a_traiter', proposition: 'a_confirmer', nombreActions: 2 }), false, 'Tenable').map(
        (m) => m.libelle,
      ),
    ).toEqual(['À traiter', 'Corrigée selon Tenable, à confirmer', '2 actions liées']);
    expect(marquesSuivi(suivi({ etat: 'corrigee' }), false, 'la veille').map((m) => m.libelle)).toEqual([
      'Corrigée',
      'Plus rapportée par la veille',
    ]);
    expect(
      marquesSuivi(
        suivi({
          proposition: 'refusee',
          etat: 'risque_accepte',
          revueDepassee: true,
          exceptionStatut: 'echue',
          nombreActions: 1,
        }),
        false,
        'Tenable',
      ),
    ).toEqual([
      { libelle: 'Risque accepté', etat: 'neutre' },
      { libelle: 'Plus rapportée par Tenable', etat: 'neutre' },
      { libelle: 'Proposition « corrigée » refusée', etat: 'neutre' },
      // Lot S1 : la date de revue est l'échéance de l'exception ; passée, l'exception est « échue ».
      { libelle: 'Exception échue', etat: 'erreur' },
      { libelle: '1 action liée', etat: 'neutre' },
    ]);
    expect(ETAT_SUIVI_PUCE.corrigee).toBe('succes');
    expect(OPTIONS_FILTRE_SUIVI.map((o) => o.value)).toEqual([
      'a_clore',
      'nouvelle',
      'a_traiter',
      'en_cours',
      'corrigee',
      'risque_accepte',
      'non_concernee',
      'tous',
    ]);
    expect(urlSuivi('declaree', 'x', '/etat')).toBe('/api/vulnerabilites/suivis/declaree/x/etat');
  });

  it('états proposés et corps du changement : note obligatoire, date de revue du seul risque accepté', () => {
    expect(etatsChoisissables('a_traiter').map((e) => e.value)).toEqual([
      'en_cours',
      'corrigee',
      'risque_accepte',
      'non_concernee',
    ]);
    expect(etatsChoisissables('risque_accepte').map((e) => e.value)).toContain('risque_accepte');
    // Lot S1 : sans le rôle RSSI, ni accorder une exception, ni en sortir.
    expect(etatsChoisissables('a_traiter', false).map((e) => e.value)).toEqual([
      'en_cours',
      'corrigee',
      'non_concernee',
    ]);
    expect(etatsChoisissables('risque_accepte', false)).toEqual([]);
    expect(
      marquesSuivi(suivi({ etat: 'risque_accepte', exceptionStatut: 'sans_echeance' }), true, 'Tenable').map(
        (m) => m.libelle,
      ),
    ).toEqual(['Risque accepté', 'Exception sans échéance, à compléter']);
    expect(etatsChoisissables('nouvelle').map((e) => e.value)).not.toContain('nouvelle');
    expect(corpsChangementEtat('non_concernee', '  ', '')).toEqual({
      corps: { etat: 'non_concernee', note: '' },
      erreur: 'Une note est obligatoire pour l’état « Non concernée ».',
    });
    // Lot S1 : justification, mesure compensatoire et échéance obligatoires pour une exception.
    expect(corpsChangementEtat('risque_accepte', ' Accepté. ', '2099-06-30', ' Flux filtré. ')).toEqual({
      corps: { etat: 'risque_accepte', note: 'Accepté.', revueLe: '2099-06-30', mesure: 'Flux filtré.' },
      erreur: null,
    });
    expect(corpsChangementEtat('risque_accepte', ' Accepté. ', '2099-06-30').erreur).toBe(
      'Une mesure compensatoire est obligatoire pour accepter un risque.',
    );
    expect(corpsChangementEtat('risque_accepte', '', '2099-06-30', 'm').erreur).toBe(
      'Une justification est obligatoire pour accepter un risque.',
    );
    expect(corpsChangementEtat('risque_accepte', 'x', '', 'm')).toMatchObject({
      corps: { revueLe: null },
      erreur: 'Une date d’échéance est obligatoire pour accepter un risque.',
    });
    expect(corpsChangementEtat('en_cours', '', '2099-06-30')).toEqual({
      corps: { etat: 'en_cours', note: '' },
      erreur: null,
    });
  });
});

describe('historique et actions liées', () => {
  const h = (e: Partial<EntreeHistoriqueSuiviDto>): EntreeHistoriqueSuiviDto => ({
    id: '00000000-0000-4000-8000-0000000000e1',
    evenement: 'changement',
    etatAvant: 'nouvelle',
    etatApres: 'a_traiter',
    note: '',
    revueLe: null,
    mesure: null,
    auteur: 'utilisateur_fictif',
    le: '2026-11-16T10:00:00.000Z',
    ...e,
  });
  it('libellés : transition, réapparition par le système, refus sans changement d’état', () => {
    expect(libelleHistorique(h({}))).toBe('Changement d’état : Nouvelle → À traiter');
    expect(libelleHistorique(h({ evenement: 'reapparition', etatAvant: 'corrigee', etatApres: 'a_traiter' }))).toBe(
      'Réapparue : Corrigée → À traiter',
    );
    expect(libelleHistorique(h({ evenement: 'refus', etatAvant: 'en_cours', etatApres: 'en_cours' }))).toBe(
      'Proposition « corrigée » refusée (En cours)',
    );
  });
  it('rendu de l’historique : date masquée dans les captures, auteur, note', () => {
    const html = rendu(
      createElement(HistoriqueSuivi, {
        historique: [
          h({ evenement: 'proposition', etatAvant: 'a_traiter', etatApres: 'a_traiter', auteur: 'système' }),
          h({ note: 'Note fictive.' }),
        ],
      }),
    );
    expect(html).toContain('class="horodatage"');
    expect(html).toContain('Corrigée selon la source, à confirmer (À traiter)');
    expect(html).toContain('système');
    expect(html).toContain('Note fictive.');
    expect(rendu(createElement(HistoriqueSuivi, { historique: [] }))).toContain('état initial');
  });
  it('actions liées : état de l’action lisible, présence seule d’une action non lisible, « Délier » si décidable', () => {
    const actions: ActionLieeDto[] = [
      {
        lisible: true,
        id: '00000000-0000-4000-8000-0000000000a1',
        perimetreId: '00000000-0000-4000-8000-000000000001',
        nom: 'Corriger le contrôle fictif',
        statut: 'done',
        statutLibelle: 'Terminée',
        terminee: true,
        archivee: false,
        echeance: '2099-03-31T12:00:00.000Z',
        relieLe: '2026-11-16T10:00:00.000Z',
      },
      { lisible: false, relieLe: '2026-11-16T10:00:00.000Z' },
    ];
    const html = rendu(createElement(ActionsLiees, { actions, peutDelier: true, onDelier: rien }));
    expect(html).toContain('Corriger le contrôle fictif');
    expect(html).toContain('Terminée');
    expect(html).toContain('Action liée que vous ne pouvez pas lire.');
    expect(html).toContain('aria-label="Délier Corriger le contrôle fictif"');
    expect(rendu(createElement(ActionsLiees, { actions, peutDelier: false, onDelier: rien }))).not.toContain('Délier');
    expect(rendu(createElement(ActionsLiees, { actions: [], peutDelier: true, onDelier: rien }))).toContain(
      'Aucune action liée.',
    );
  });
});

describe('listes et fiche d’une faille déclarée', () => {
  it('colonne « Suivi » des constats : proposition à confirmer, vue en dernier', () => {
    const html = rendu(createElement(ConstatsTable, { constats: [constat()], onOuvrir: rien }));
    expect(html).toContain('<th');
    expect(html).toContain('Suivi');
    expect(html).toContain('Corrigée selon Tenable, à confirmer');
    expect(html).toContain('vue en dernier');
    expect(rendu(createElement(MarquesSuivi, { s: suivi(), present: true, source: 'Tenable' }))).toContain('Nouvelle');
  });
  it('failles déclarées : CVE cliquable, exception échue, plus rapportée par la veille, délai', () => {
    const html = rendu(createElement(DeclareesTable, { failles: [declaree], onOuvrir: rien }));
    expect(html).toMatch(/<button[^>]*>CVE-2026-95101<\/button>/i);
    expect(html).toContain('Exception échue');
    expect(html).toMatch(/<th[^>]*>Délai<\/th>/i);
    expect(html).toContain('Sous exception');
    expect(html).toContain('Plus rapportée par la veille');
  });
  it('fiche : description et action KEV telles quelles, machines reliées, détection par Tenable', () => {
    const f: FicheDeclareeDto = {
      ...declaree,
      kev: true,
      description: 'Fictional NVD description.',
      kevAction: 'Apply updates.',
      kevEcheance: '2026-12-04',
      machinesReliees: [
        {
          id: 'm1',
          nom: 'srv-fictif-01.exemple.invalid',
          adresse: '192.0.2.61',
          role: null,
          perimetreNom: 'Périmètre fictif',
          detectee: false,
        },
        { id: 'm2', nom: null, adresse: '192.0.2.62', role: 'front', perimetreNom: null, detectee: true },
      ],
    };
    // Lot PC4 : l'action exigée du catalogue KEV est rendue par la fiche illustrée commune, au-dessus du détail.
    const html =
      rendu(createElement(FicheDeclaree, { f })) +
      rendu(
        createElement(FicheFailleIllustree, {
          f: ficheFaille({
            nature: 'declaree',
            recommandations: { kev: [{ cve: f.cve, action: f.kevAction!, echeance: f.kevEcheance }] },
          }),
        }),
      );
    expect(html).toContain('lang="en"');
    expect(html).toContain('Apply updates.');
    expect(html).toContain('Fictional NVD description.');
    expect(html).toContain('Machines reliées au produit (2)');
    expect(html).toContain('Détectée aussi par Tenable');
    expect(html).toContain('Sans périmètre');
    expect(html).toContain('Écartée');
  });
  it('aide : suivi, à clore, actions liées', () => {
    const texte = JSON.stringify(HELP_ARTICLES);
    expect(texte).toContain('À clore');
    expect(texte).toContain('Créer une action');
    expect(texte).toContain('Relier une action');
  });
});
