/* Module Intégrations (ADR 0076), socle des connecteurs réseau : menu conditionné par le droit du module, état des tuiles,
   secrets affichés « défini » / « non défini » sans valeur, message si l'exécutant n'est pas vu, formulaire (adresse
   contrôlée, envoi des seuls champs modifiés), rendu des tuiles et des exécutions, aide. Données fictives. */
import { MantineProvider } from '@mantine/core';
import {
  catalogueIntegrations,
  type Action,
  type ExecutionIntegrationDto,
  type IntegrationDto,
  type Module,
} from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { TableExecutions, TuileInstance, TuileType } from '../src/integrations/IntegrationsPage';
import {
  corpsCreation,
  corpsModification,
  destinationChangee,
  erreursFormulaire,
  etatTuile,
  executionEnCours,
  fluxOuvertPour,
  formulaireDepuis,
  LIEN_INTEGRATIONS,
  messageExecutant,
  precisionPort,
  resumeExecution,
} from '../src/integrations/integrations';
import { famillesVisibles, localiser } from '../src/navigation';

const TENABLE = catalogueIntegrations()[0]!;
const execution = (e: Partial<ExecutionIntegrationDto> = {}): ExecutionIntegrationDto => ({
  id: '00000000-0000-4000-8000-0000000000e1',
  integrationId: '00000000-0000-4000-8000-0000000000a1',
  operation: 'tester',
  origine: 'manuel',
  etat: 'recu',
  demandePar: 'admin-fictif',
  demandeLe: '2026-11-16T10:00:00.000Z',
  debuteLe: '2026-11-16T10:00:05.000Z',
  termineLe: '2026-11-16T10:00:06.000Z',
  resultat: { version: '6.9.1' },
  erreur: null,
  ...e,
});
const instance = (i: Partial<IntegrationDto> = {}): IntegrationDto => ({
  id: '00000000-0000-4000-8000-0000000000a1',
  type: 'tenable',
  nom: 'Tenable fictif',
  smsiId: null,
  configuration: { adresse: 'https://tenable.exemple.test', autoriteCertification: '', delaiSecondes: 30 },
  actif: true,
  secrets: { accessKey: true, secretKey: true },
  version: 3,
  createdBy: 'admin-fictif',
  createdAt: '2026-11-16T09:00:00.000Z',
  updatedBy: 'admin-fictif',
  updatedAt: '2026-11-16T09:00:00.000Z',
  derniereExecution: execution(),
  ...i,
});
const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const rien = () => undefined;
/** Le rendu contient-il un bouton portant ce texte ? */
const bouton = (html: string, texte: string) =>
  new RegExp(`<button[^>]*>(?:(?!</button>).)*${texte}(?:(?!</button>).)*</button>`, 's').test(html);

describe('menu', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('« Intégrations » est une rubrique du Pilotage, visible avec la seule lecture du module', () => {
    const avec = famillesVisibles(seulement(['integrations:lire']));
    const pilotage = avec.find((f) => f.famille.id === 'pilotage')!;
    expect(pilotage.destinations.map((d) => d.id)).toEqual(['integrations']);
    expect(pilotage.destinations[0]!.to).toBe(LIEN_INTEGRATIONS);
    const sans = famillesVisibles(seulement(['pilotage:lire']));
    expect(sans.find((f) => f.famille.id === 'pilotage')?.destinations.map((d) => d.id)).not.toContain('integrations');
    expect(localiser('/integrations')?.destination.id).toBe('integrations');
  });
  it('un article d’aide décrit les secrets, la validation du flux et le test', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'integrations');
    expect(a?.permission).toBe('integrations:lire');
    expect(a?.link).toBe(LIEN_INTEGRATIONS);
    const texte = a!.steps.join(' ');
    for (const m of ['jamais réaffichées', 'case à cocher', 'Tester la connexion', 'exécutant d’exploitation'])
      expect(texte).toContain(m);
  });
});

describe('état des tuiles et de l’exécutant', () => {
  it('non configurée, inactive, flux fermé, en échec, active', () => {
    expect(etatTuile(instance({ secrets: { accessKey: true, secretKey: false } }), true)).toBe('non_configuree');
    expect(etatTuile(instance({ actif: false }), true)).toBe('inactive');
    expect(etatTuile(instance(), false)).toBe('flux_ferme');
    expect(
      etatTuile(instance({ derniereExecution: execution({ etat: 'echec', resultat: null, erreur: 'x' }) }), true),
    ).toBe('echec');
    expect(
      etatTuile(instance({ derniereExecution: execution({ etat: 'expire', resultat: null, erreur: 'x' }) }), true),
    ).toBe('echec');
    expect(etatTuile(instance(), true)).toBe('active');
    expect(etatTuile(instance({ derniereExecution: null }), true)).toBe('active');
  });
  it('exécutant non vu : message clair ; vu : rien', () => {
    expect(messageExecutant({ disponible: true, vuLe: '2026-11-16T10:00:00.000Z' })).toBeNull();
    expect(messageExecutant({ disponible: false, vuLe: null })).toMatch(/jamais été vu/);
    expect(messageExecutant({ disponible: false, vuLe: '2026-11-16T10:00:00.000Z' })).toMatch(/deux minutes/);
  });
  it('flux d’un type et exécution en cours', () => {
    const etat = {
      executant: { disponible: true, vuLe: null },
      flux: [{ type: 'tenable' as const, flux: 'tenable' as const, ouvert: true }],
    };
    expect(fluxOuvertPour(etat, 'tenable')).toBe(true);
    expect(fluxOuvertPour(undefined, 'tenable')).toBe(false);
    expect(executionEnCours(execution({ etat: 'en_file', resultat: null, termineLe: null }))).toBe(true);
    expect(executionEnCours(execution())).toBe(false);
    expect(resumeExecution(execution())).toBe('Connexion établie : version 6.9.1.');
    expect(resumeExecution(execution({ etat: 'echec', resultat: null, erreur: 'Délai dépassé.' }))).toBe(
      'Délai dépassé.',
    );
  });
});

describe('formulaire', () => {
  it('contrôle l’adresse et n’envoie que ce qui change', () => {
    const vide = formulaireDepuis(null, TENABLE);
    expect(vide.nom).toBe('Tenable Security Center');
    expect(erreursFormulaire(vide)).toEqual(['Adresse obligatoire (https://…).']);
    expect(erreursFormulaire({ ...vide, adresse: 'http://tenable.exemple.test' })).toEqual([
      'Seule une adresse https:// est admise.',
    ]);
    const f = { ...vide, adresse: ' https://tenable.exemple.test ' };
    expect(corpsCreation(TENABLE, f)).toEqual({
      type: 'tenable',
      nom: 'Tenable Security Center',
      configuration: {
        adresse: 'https://tenable.exemple.test',
        autoriteCertification: '',
        delaiSecondes: 30,
        gravites: ['critique', 'elevee'],
      },
    });
    const i = instance();
    expect(corpsModification(i, formulaireDepuis(i, TENABLE))).toEqual({});
    expect(corpsModification(i, { ...formulaireDepuis(i, TENABLE), nom: 'Autre' })).toEqual({ nom: 'Autre' });
    expect(Object.keys(corpsModification(i, { ...formulaireDepuis(i, TENABLE), delaiSecondes: 10 }))).toEqual([
      'configuration',
    ]);
    expect(destinationChangee(i, formulaireDepuis(i, TENABLE))).toBe(false);
    expect(destinationChangee(i, { ...formulaireDepuis(i, TENABLE), adresse: 'https://autre.exemple.test' })).toBe(
      true,
    );
    // Port réglable : admis de 1 à 65535 ; le changer est un changement de destination (clés effacées).
    expect(erreursFormulaire({ ...f, adresse: 'https://tenable.exemple.test:8443' })).toEqual([]);
    expect(erreursFormulaire({ ...f, adresse: 'https://tenable.exemple.test:70000' })).toEqual([
      'Port invalide : un nombre de 1 à 65535 (443 par défaut).',
    ]);
    expect(
      destinationChangee(i, { ...formulaireDepuis(i, TENABLE), adresse: 'https://tenable.exemple.test:8443' }),
    ).toBe(true);
    // Gravités de la synchronisation : au moins une ; un changement est envoyé, rangé de la plus grave à la moins grave.
    expect(erreursFormulaire({ ...f, gravites: [] })).toEqual(['Choisissez au moins une gravité à synchroniser.']);
    expect(corpsModification(i, { ...formulaireDepuis(i, TENABLE), gravites: ['faible', 'critique'] })).toEqual({
      configuration: {
        adresse: 'https://tenable.exemple.test',
        autoriteCertification: '',
        delaiSecondes: 30,
        gravites: ['critique', 'faible'],
      },
    });
  });

  it('validation du flux : le port réglé de l’instance est rappelé', () => {
    expect(precisionPort(instance())).toBe('Port réglé pour « Tenable fictif » : TCP 443.');
    expect(precisionPort(instance({ configuration: { adresse: 'https://tenable.exemple.test:8443' } }))).toBe(
      'Port réglé pour « Tenable fictif » : TCP 8443.',
    );
  });
});

describe('rendu', () => {
  it('tuile d’un type : pictogramme neutre, aucun logo, ajout réservé à l’administration', () => {
    const avec = rendre(createElement(TuileType, { t: TENABLE, peutAjouter: true, onAjouter: rien }));
    expect(avec).toContain('Tenable Security Center');
    expect(avec).toContain('integration-picto');
    expect(avec).toContain('Ajouter une instance');
    expect(avec).not.toMatch(/<img/);
    expect(rendre(createElement(TuileType, { t: TENABLE, peutAjouter: false, onAjouter: rien }))).not.toContain(
      'Ajouter une instance',
    );
  });

  it('tuile d’une instance : secrets « défini » / « non défini », gestes selon les droits, flux fermé signalé', () => {
    const props = {
      i: instance({ secrets: { accessKey: true, secretKey: false } }),
      t: TENABLE,
      fluxOuvert: false,
      peutAdministrer: true,
      peutLancer: true,
      enCours: false,
      onConfigurer: rien,
      onActiver: rien,
      onTester: rien,
      onExecutions: rien,
    };
    const html = rendre(createElement(TuileInstance, props));
    expect(html).toContain('Clé d’accès : Défini');
    expect(html).toContain('Clé secrète : Non défini');
    expect(bouton(html, 'Configurer')).toBe(true);
    expect(bouton(html, 'Activer')).toBe(true);
    expect(bouton(html, 'Tester la connexion')).toBe(true);
    expect(html).toContain('Flux « Tenable Security Center » fermé');
    const lecture = rendre(createElement(TuileInstance, { ...props, peutAdministrer: false, peutLancer: false }));
    expect(bouton(lecture, 'Configurer')).toBe(false);
    expect(bouton(lecture, 'Activer')).toBe(false);
    expect(bouton(lecture, 'Tester la connexion')).toBe(false);
    expect(bouton(lecture, 'Exécutions')).toBe(true);
    const active = rendre(createElement(TuileInstance, { ...props, i: instance(), fluxOuvert: true }));
    expect(bouton(active, 'Désactiver')).toBe(true);
    expect(active).toContain('version 6.9.1');
    // Synchronisation (ADR 0100, lot V5) : bouton avec le droit de lancer, filtre de gravité et dernier résultat affichés.
    const synchro = rendre(
      createElement(TuileInstance, {
        ...props,
        i: instance({
          configuration: { adresse: 'https://tenable.exemple.test', gravites: ['critique', 'elevee'] },
          derniereExecution: execution({
            operation: 'synchroniser',
            resultat: {
              elements: 9,
              pages: 1,
              constats: 2,
              detections: 4,
              machines: 3,
              hotes: 0,
              ecartes: 0,
              tronque: true,
              inventaire: { ok: false, erreur: 'Accès refusé (code 403).' },
            },
          }),
        }),
        fluxOuvert: true,
        onSynchroniser: rien,
      }),
    );
    expect(bouton(synchro, 'Synchroniser maintenant')).toBe(true);
    expect(synchro).toContain('Critique, Élevée');
    expect(synchro).toContain('2 failles sur 3 machines (4 détections)');
    expect(synchro).toContain('Incomplète');
    expect(synchro).toContain('Inventaire des machines (expérimental) indisponible : Accès refusé (code 403).');
    expect(
      bouton(
        rendre(createElement(TuileInstance, { ...props, peutLancer: false, onSynchroniser: rien })),
        'Synchroniser',
      ),
    ).toBe(false);
  });

  it('tableau des exécutions', () => {
    const html = rendre(
      createElement(TableExecutions, {
        executions: [execution(), execution({ id: 'e2', etat: 'echec', resultat: null, erreur: 'Certificat refusé.' })],
      }),
    );
    expect(html).toContain('Reçu');
    expect(html).toContain('Certificat refusé.');
    expect(rendre(createElement(TableExecutions, { executions: [] }))).toContain('Aucune exécution.');
  });
});
