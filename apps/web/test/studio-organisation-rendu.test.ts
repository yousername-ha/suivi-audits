/* Refonte Neon, lot 5 : rendu de Processus Studio et du panorama des parties intéressées. Vérifie que les repères
   utilisés par les parcours existants restent présents (région nommée par le type, classe « carte-processus »,
   compteurs « Objectifs 1 », bouton « Afficher les sous-processus (1) », commande « Nouveau processus ») et que les
   règles de présentation sont tenues : catégorie inaccessible distincte de vide, nature inconnue sans liaison inventée,
   revue à vérifier au seuil existant de 365 jours ; animations en continu, sans bouton de pause (ADR 0099). Données
   fictives. */
import { MantineProvider } from '@mantine/core';
import type { CarteProcessus, GrcObject, ProcessusCartes } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  etatPartie,
  naturePartie,
  PartiesInteresseesStudio,
  revuePartie,
} from '../src/pilotage/PartiesInteresseesStudio';
import { ProcessusStudio } from '../src/processus/ProcessusStudio';

const rendu = (element: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, element));

const vides = { objectifs: [], indicateurs: [], swots: [], risques: [], fournisseurs: [] };
const processus = (id: string, extra: Partial<CarteProcessus> = {}): CarteProcessus => ({
  id,
  ref: 'legacy:processes:' + id,
  name: id,
  owner: '',
  family: 'realisation',
  parent: '',
  purpose: '',
  rattaches: { ...vides },
  ...extra,
});
const donnees = (liste: CarteProcessus[], candidatsRisques: [] | null = []): ProcessusCartes => ({
  types: [
    {
      code: 'realisation',
      label: 'Réalisation',
      description: 'Activités fictives',
      tint: 'bleu',
      archived: false,
    } as ProcessusCartes['types'][number],
  ],
  processus: liste,
  candidats: { objectifs: [], indicateurs: [], swots: [], risques: candidatsRisques, fournisseurs: [] },
});

describe('Processus Studio : repères conservés', () => {
  const racine = processus('PRO-001', {
    name: 'Accueil fictif',
    owner: 'Pilote fictif',
    rattaches: {
      ...vides,
      objectifs: [{ ref: 'legacy:objectives:OBJ-1', id: 'OBJ-1', name: 'Objectif fictif', via: 'lien', lienId: null }],
    },
  });
  const enfant = processus('PRO-002', { name: 'Admission fictive', parent: 'PRO-001' });
  const html = rendu(
    createElement(ProcessusStudio, {
      donnees: donnees([racine, enfant]),
      scopeName: 'Mon organisation',
      modifiable: true,
      onOpen: () => undefined,
      onCreate: () => undefined,
    }),
  );
  it('nomme la section par le libellé du type et garde la classe historique des cartes', () => {
    expect(html).toContain('aria-label="Réalisation"');
    expect(html).toMatch(/class="pr-card carte-processus"[^>]*data-id="PRO-001"/);
  });
  it('affiche les compteurs sous la forme « Objectifs 1 »', () => {
    expect(html).toContain('Objectifs <b>1</b>');
  });
  it('rattache le sous-processus à son parent, sans carte propre, avec le bouton de dépliage nommé', () => {
    expect(html).toContain('aria-label="Afficher les sous-processus (1) de Accueil fictif"');
    expect(html).not.toMatch(/data-id="PRO-002"/);
    expect(html).toContain('1 sous-processus');
  });
  it('propose la création sous le nom « Nouveau processus » à qui peut modifier', () => {
    expect(html).toMatch(/<span aria-hidden="true">\+.*<\/span>Nouveau processus/);
    expect(html).toContain('Périmètre affiché');
    expect(html).toContain('Mon organisation');
  });
  it('n’affiche pas la création sans droit de modification', () => {
    const lecture = rendu(
      createElement(ProcessusStudio, {
        donnees: donnees([racine]),
        scopeName: 'Mon organisation',
        modifiable: false,
        onOpen: () => undefined,
        onCreate: () => undefined,
      }),
    );
    expect(lecture).not.toContain('Nouveau processus');
  });
  it('distingue une catégorie inaccessible d’une catégorie vide', () => {
    const sansDroit = rendu(
      createElement(ProcessusStudio, {
        donnees: donnees([processus('PRO-003', { rattaches: { ...vides, risques: null } })], null),
        scopeName: 'Mon organisation',
        modifiable: false,
        onOpen: () => undefined,
        onCreate: () => undefined,
      }),
    );
    expect(sansDroit).toContain('Risques <b>—</b>');
    expect(sansDroit).toContain('Risques : accès non disponible');
    expect(sansDroit).toContain('Indicateurs <b>0</b>');
  });
  it('anime en continu : aucun bouton de pause ni de reprise des animations (ADR 0099)', () => {
    expect(html).toContain('data-motion="on"');
    expect(html).not.toMatch(/en pause|Reprendre les animations|Mouvement réduit activé/);
  });
  it('présente un état vide explicite', () => {
    const vide = rendu(
      createElement(ProcessusStudio, {
        donnees: donnees([]),
        scopeName: 'Mon organisation',
        modifiable: true,
        onOpen: () => undefined,
        onCreate: () => undefined,
      }),
    );
    expect(vide).toContain('Aucun processus pour l’instant');
  });
});

const partie = (id: string, data: Record<string, unknown>): GrcObject => ({
  id,
  smsiId: 'smsi-fictif',
  kind: 'stakeholder',
  name: 'Partie ' + id,
  data,
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'fictif',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'fictif',
  legacyKey: null,
  legacyId: null,
  archived: false,
  registreId: null,
});

describe('Parties intéressées Studio', () => {
  it('garde une nature absente ou inconnue « À préciser »', () => {
    expect(naturePartie(partie('A', { nature: 'Interne' }))).toBe('Interne');
    expect(naturePartie(partie('B', { nature: 'Externe' }))).toBe('Externe');
    expect(naturePartie(partie('C', {}))).toBe('À préciser');
    expect(naturePartie(partie('D', { nature: 'Partenaire' }))).toBe('À préciser');
  });
  it('signale une revue à vérifier au seuil existant de 365 jours seulement', () => {
    expect(revuePartie(partie('A', {}), '2026-11-14')).toBe(true);
    expect(revuePartie(partie('B', { reviewedAt: '2025-11-14' }), '2026-11-14')).toBe(false);
    expect(revuePartie(partie('C', { reviewedAt: '2025-11-13' }), '2026-11-14')).toBe(true);
  });
  it('libelle la prise en compte des exigences sans valeur inventée', () => {
    expect(etatPartie(partie('A', { addressed: 'Oui' }))).toBe('Traitées');
    expect(etatPartie(partie('B', { addressed: 'Partiel' }))).toBe('Partiellement');
    expect(etatPartie(partie('C', { addressed: 'Non' }))).toBe('Non traitées');
    expect(etatPartie(partie('D', {}))).toBe('Non renseigné');
  });
  it('présente les acteurs de nature inconnue à part, avec les compteurs des fiches chargées', () => {
    const html = rendu(
      createElement(PartiesInteresseesStudio, {
        objects: [partie('A', { nature: 'Interne', addressed: 'Oui' }), partie('B', {})],
        scopeName: 'Mon organisation',
        owner: () => 'Non attribué',
        writable: true,
        loading: false,
        total: 60,
        onOpen: () => undefined,
        onCreate: () => undefined,
        onBrowse: () => undefined,
        registreOuvert: false,
        pagination: null,
      }),
    );
    expect(html).toContain('Acteurs internes');
    expect(html).not.toContain('Acteurs externes');
    expect(html).toContain('Nature à préciser');
    expect(html).toContain('chargées sur 60');
    expect(html).toContain('aria-label="Afficher Partie A"');
    expect(html).toContain('Ouvrir le registre détaillé');
    expect(html).toContain('Ajouter une partie intéressée');
    // Animations en continu (ADR 0099) : plus de bouton de pause ni de reprise.
    expect(html).toContain('data-motion="on"');
    expect(html).not.toMatch(/en pause|Reprendre les animations|Mouvement réduit activé/);
  });
});
