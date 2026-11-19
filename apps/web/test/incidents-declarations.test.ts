/* Déclarations réglementaires d'un incident (ADR 0105), côté interface : bloc « Déclarations » de l'onglet Fiche (régime,
   étape, statut, compte à rebours, gestes selon le droit et le rôle RSSI), fiche de préparation (« Copier » par rubrique,
   Word, texte figé d'une déclaration envoyée), adresses de l'API, carte de la Configuration et aide. Données fictives. */
import { MantineProvider } from '@mantine/core';
import type { DeclarationIncidentDto, VueDeclarationsIncident } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { cartesVisibles } from '../src/administration-droits';
import { HELP_ARTICLES } from '../src/help';
import {
  BlocDeclarationsVue,
  FichePreparationVue,
  libelleDeclaration,
  ouvrables,
  urlDeclaration,
  urlDeclarations,
} from '../src/incidents/Declarations';

// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
const rendre = (n: ReactNode) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, n),
    ),
  );
const ok = async () => true;
const rien = () => undefined;
const QUALIF = '2026-11-18T09:30:00.000Z';
const decl = (d: Partial<DeclarationIncidentDto> = {}): DeclarationIncidentDto => ({
  id: '00000000-0000-4000-8000-0000000000d1',
  incidentId: 'INC-2026-901',
  regime: 'nis2',
  etape: 'alerte_precoce',
  statut: 'proposee',
  origine: 'proposition',
  lieeA: null,
  depart: QUALIF,
  echeance: '2026-11-19T09:30:00.000Z',
  rubriques: [
    {
      cle: 'identite',
      libelle: 'Identité de l’établissement',
      source: 'Identification du déclarant (à confirmer)',
      aide: '',
      valeur: 'Raison sociale : Établissement fictif',
      modifiee: false,
    },
    {
      cle: 'malveillance',
      libelle: 'Caractère illicite ou malveillant soupçonné',
      source: 'Directive (UE) 2022/2555 (NIS 2), article 23, paragraphe 4, point a)',
      aide: '',
      valeur: '',
      modifiee: false,
    },
  ],
  reference: '',
  motif: null,
  decision: null,
  envoi: null,
  creeLe: QUALIF,
  creePar: 'redacteur.fictif',
  version: 1,
  ...d,
});
const vue = (v: Partial<VueDeclarationsIncident> = {}): VueDeclarationsIncident => ({
  incidentId: 'INC-2026-901',
  qualifieeLe: QUALIF,
  peutDeclarer: false,
  peutPreparer: true,
  peutExporter: false,
  declarations: [
    decl(),
    decl({
      id: '00000000-0000-4000-8000-0000000000d2',
      regime: 'sante',
      etape: 'signalement',
      statut: 'envoyee',
      echeance: null,
      reference: 'AR-0001',
      decision: { par: 'RSSI fictif', le: '2026-11-18T10:00:00.000Z' },
      envoi: { par: 'RSSI fictif', le: '2026-11-18T10:00:00.000Z', reference: 'AR-0001' },
    }),
  ],
  ...v,
});
const bloc = (v: VueDeclarationsIncident) =>
  rendre(
    createElement(BlocDeclarationsVue, {
      vue: v,
      maintenant: new Date('2026-11-18T10:30:00.000Z'),
      onOuvrirFiche: rien,
      onConfirmer: ok,
      onEcarter: ok,
      onEnvoyer: ok,
      onCompleter: ok,
      onOuvrir: ok,
      onCorrigerQualification: ok,
      onWord: rien,
    }),
  );

describe('bloc « Déclarations »', () => {
  it('régime, étape, statut et compte à rebours ; envoi figé avec sa référence', () => {
    const h = bloc(vue());
    expect(h).toContain('Déclarations');
    expect(h).toContain('Qualification : 18/11/2026 à 10:30');
    expect(h).toContain('NIS 2 (ANSSI)');
    expect(h).toContain('Alerte précoce');
    expect(h).toContain('Proposée');
    expect(h).toContain('Reste 23 h 00 (échéance le 19/11/2026 à 10:30)');
    expect(h).toContain('Santé (CERT Santé, ARS)');
    expect(h).toContain('Envoyée le 18/11/2026 à 11:00 par RSSI fictif, référence AR-0001');
    // Les composants Mantine posent leurs variables par le DOM (CSSOM, admis par l'ADR 0006) ; aucune balise style ni script.
    expect(h).not.toMatch(/<style|<script/i);
    expect(h).toContain('id="declarations-incident"');
  });
  it('sans le rôle RSSI : préparer et voir seulement, avec la mention du rôle', () => {
    const h = bloc(vue());
    expect(h).toContain('Préparer');
    expect(h).toContain('Voir');
    expect(h).not.toContain('Confirmer « à déclarer »');
    expect(h).not.toContain('Marquer envoyée');
    expect(h).not.toContain('Non requise');
    expect(h).not.toContain('Corriger la date');
    expect(h).not.toContain('>Word<');
    expect(h).toContain('réservés au rôle RSSI');
  });
  it('avec le rôle RSSI : confirmer, envoyer, écarter, compléter, ouvrir, corriger la date ; Word avec le droit d’export', () => {
    const h = bloc(vue({ peutDeclarer: true, peutExporter: true }));
    expect(h).toContain('Confirmer « à déclarer »');
    expect(h).toContain('Marquer envoyée');
    expect(h).toContain('Non requise');
    expect(h).toContain('Ajouter un complément');
    expect(h).toContain('Ouvrir une déclaration non proposée');
    expect(h).toContain('Corriger la date');
    expect(h).toContain('>Word<');
    expect(h).not.toContain('réservés au rôle RSSI');
  });
  it('déclarations encore ouvrables à la main (une par régime et étape)', () => {
    expect(ouvrables(vue().declarations).map((o) => o.value)).toEqual(['nis2/notification', 'nis2/rapport_final']);
    expect(ouvrables([]).map((o) => o.label)).toEqual([
      'Santé (CERT Santé, ARS) — signalement',
      'NIS 2 (ANSSI) — alerte précoce',
      'NIS 2 (ANSSI) — notification',
      'NIS 2 (ANSSI) — rapport final',
    ]);
    expect(libelleDeclaration({ regime: 'nis2', etape: 'complement' })).toBe('NIS 2 (ANSSI) — complément');
  });
  it('adresses de l’API, identifiant de l’incident encodé', () => {
    expect(urlDeclarations('INC-2026-901')).toBe('/api/incidents/INC-2026-901/declarations');
    expect(urlDeclaration('A&B', 'd1', '/envoi')).toBe('/api/incidents/A%26B/declarations/d1/envoi');
  });
});

describe('fiche de préparation', () => {
  const fiche = (d: DeclarationIncidentDto, modifiable = true, peutExporter = true) =>
    rendre(
      createElement(FichePreparationVue, {
        d,
        modifiable,
        peutExporter,
        onRubrique: ok,
        onReference: ok,
        onWord: rien,
      }),
    );
  it('une rubrique par ligne, avec sa source et un bouton « Copier » ; numéro pressenti ; Word', () => {
    const h = fiche(decl());
    expect(h).toContain('Identité de l’établissement');
    expect(h).toContain('Source : Directive (UE) 2022/2555 (NIS 2), article 23, paragraphe 4, point a)');
    expect(h.match(/aria-label="Copier : /g)).toHaveLength(2);
    expect(h).toContain('Raison sociale : Établissement fictif');
    expect(h).toContain('Numéro de dossier pressenti');
    expect(h).toContain('Télécharger en Word');
    expect(h).toContain('<textarea');
    expect(h).not.toMatch(/<style|<script/i);
  });
  it('envoyée : texte figé, sans champ de saisie ; sans droit d’export, pas de Word', () => {
    const h = fiche(
      decl({
        statut: 'envoyee',
        reference: 'ANSSI-0001',
        envoi: { par: 'RSSI fictif', le: '2026-11-18T10:00:00.000Z', reference: 'ANSSI-0001' },
      }),
      true,
      false,
    );
    expect(h).toContain('Texte transmis, figé');
    expect(h).toContain('référence ANSSI-0001');
    expect(h).not.toContain('<textarea');
    expect(h).not.toContain('Numéro de dossier pressenti');
    expect(h).toContain('declaration-texte');
    expect(h).not.toContain('Télécharger en Word');
  });
  it('écartée : motif affiché ; lecture seule sans droit de modification', () => {
    expect(fiche(decl({ statut: 'non_requise', motif: 'Incident non important (fictif).' }))).toContain(
      'Incident non important (fictif).',
    );
    expect(fiche(decl(), false)).not.toContain('<textarea');
  });
});

describe('configuration et aide', () => {
  it('carte « Identité de l’établissement » de la Plateforme, avec le droit conformite', () => {
    const avec =
      (...p: [string, string][]) =>
      (m: string, a: string) =>
        p.some(([x, y]) => x === m && y === a);
    expect(cartesVisibles(avec(['parametres', 'lire']), 'plateforme')).not.toContain('etablissement');
    expect(cartesVisibles(avec(['parametres', 'lire'], ['conformite', 'lire']), 'plateforme')).toContain(
      'etablissement',
    );
  });
  it('article d’aide de la déclaration, lisible avec incidents:lire', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'declarations-incidents');
    expect(a?.permission).toBe('incidents:lire');
    expect(a?.link).toBe('/pilotage/incidents-registre');
    expect(a?.steps.join(' ')).toMatch(/rôle « RSSI »/);
  });
});
