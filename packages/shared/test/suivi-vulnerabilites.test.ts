/* Module Vulnérabilités (ADR 0100, point 10 ; lot V4b) : suivi d'une faille. États et libellés, états clos, changements
   admis, notes obligatoires, date de revue, filtres de liste, action préremplie (sans nom de machine) et mention de
   l'origine. Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  ChangementEtatSuivi,
  CreationActionSuivi,
  ETAT_SUIVI_LIBELLES,
  ETATS_SUIVI,
  ETATS_SUIVI_ACTIFS,
  ETATS_SUIVI_CLOS,
  estEtatClos,
  FiltreSuivi,
  LienActionSuivi,
  mentionOrigineAction,
  noteObligatoire,
  ORIGINE_ACTION_VULNERABILITES,
  preremplirAction,
  RechercheConstats,
  RechercheDeclarees,
  RefusPropositionSuivi,
  refusChangementSuivi,
} from '../src/index.js';

describe('états de suivi', () => {
  it('six états libellés ; actifs et clos se partagent les états sans recouvrement', () => {
    expect(ETATS_SUIVI).toEqual(['nouvelle', 'a_traiter', 'en_cours', 'corrigee', 'risque_accepte', 'non_concernee']);
    expect(Object.keys(ETAT_SUIVI_LIBELLES)).toEqual([...ETATS_SUIVI]);
    expect([...ETATS_SUIVI_ACTIFS, ...ETATS_SUIVI_CLOS].sort()).toEqual([...ETATS_SUIVI].sort());
    expect(ETATS_SUIVI.filter(estEtatClos)).toEqual(['corrigee', 'risque_accepte', 'non_concernee']);
    expect(ETATS_SUIVI.filter(noteObligatoire)).toEqual(['risque_accepte', 'non_concernee']);
  });

  it('changements admis : jamais vers « nouvelle », même état seulement pour renouveler un risque accepté', () => {
    expect(refusChangementSuivi('a_traiter', 'nouvelle')).toMatch(/état initial/);
    expect(refusChangementSuivi('en_cours', 'en_cours')).toMatch(/déjà dans l’état « En cours »/);
    expect(refusChangementSuivi('risque_accepte', 'risque_accepte')).toBeNull();
    expect(refusChangementSuivi('nouvelle', 'corrigee')).toBeNull();
    expect(refusChangementSuivi('corrigee', 'a_traiter')).toBeNull();
  });

  it('changement d’état : note obligatoire (blanche refusée), date de revue réservée au risque accepté', () => {
    expect(ChangementEtatSuivi.safeParse({ etat: 'nouvelle' }).success).toBe(false);
    expect(ChangementEtatSuivi.parse({ etat: 'en_cours' })).toEqual({ etat: 'en_cours', note: '' });
    // Lot S1 : une exception (risque accepté) exige en plus une mesure compensatoire et une échéance.
    const exception = { mesure: 'Mesure fictive.', revueLe: '2099-01-01' };
    for (const [etat, complement] of [
      ['risque_accepte', exception],
      ['non_concernee', {}],
    ] as const) {
      expect(ChangementEtatSuivi.safeParse({ etat, ...complement }).success).toBe(false);
      expect(ChangementEtatSuivi.safeParse({ etat, note: '   ', ...complement }).success).toBe(false);
      expect(ChangementEtatSuivi.safeParse({ etat, note: 'Motif fictif.', ...complement }).success).toBe(true);
    }
    expect(ChangementEtatSuivi.safeParse({ etat: 'risque_accepte', note: 'x', revueLe: '2099-01-01' }).success).toBe(
      false,
    );
    expect(ChangementEtatSuivi.safeParse({ etat: 'risque_accepte', note: 'x', mesure: 'm' }).success).toBe(false);
    expect(
      ChangementEtatSuivi.safeParse({ etat: 'risque_accepte', note: 'x', mesure: '   ', revueLe: '2099-01-01' })
        .success,
    ).toBe(false);
    expect(
      ChangementEtatSuivi.safeParse({
        etat: 'risque_accepte',
        note: 'x',
        mesure: 'm'.repeat(1001),
        revueLe: '2099-01-01',
      }).success,
    ).toBe(false);
    expect(
      ChangementEtatSuivi.safeParse({ etat: 'risque_accepte', note: 'x', mesure: 'm', revueLe: '2099-02-30' }).success,
    ).toBe(false);
    expect(ChangementEtatSuivi.safeParse({ etat: 'corrigee', revueLe: '2099-01-01' }).success).toBe(false);
    expect(ChangementEtatSuivi.safeParse({ etat: 'corrigee', mesure: 'm' }).success).toBe(false);
    expect(
      ChangementEtatSuivi.parse({ etat: 'risque_accepte', note: ' x ', mesure: ' m ', revueLe: '2099-01-01' }),
    ).toEqual({
      etat: 'risque_accepte',
      note: 'x',
      mesure: 'm',
      revueLe: '2099-01-01',
    });
    expect(ChangementEtatSuivi.safeParse({ etat: 'en_cours', note: 'x'.repeat(1001) }).success).toBe(false);
    expect(ChangementEtatSuivi.safeParse({ etat: 'en_cours', autre: 1 }).success).toBe(false);
  });

  it('refus de la proposition : note obligatoire ; création et lien d’une action : formes strictes', () => {
    expect(RefusPropositionSuivi.safeParse({ note: ' ' }).success).toBe(false);
    expect(RefusPropositionSuivi.parse({ note: ' Non corrigée. ' })).toEqual({ note: 'Non corrigée.' });
    const corps = {
      perimetreId: '00000000-0000-4000-8000-000000000001',
      titre: 'Corriger',
      description: '',
      echeance: null,
    };
    expect(CreationActionSuivi.parse(corps)).toEqual(corps);
    expect(CreationActionSuivi.safeParse({ ...corps, titre: '  ' }).success).toBe(false);
    expect(CreationActionSuivi.safeParse({ ...corps, titre: 'x'.repeat(201) }).success).toBe(false);
    expect(CreationActionSuivi.safeParse({ ...corps, echeance: '31/12/2099' }).success).toBe(false);
    expect(CreationActionSuivi.safeParse({ ...corps, perimetreId: 'x' }).success).toBe(false);
    expect(LienActionSuivi.safeParse({ actionId: 'x' }).success).toBe(false);
  });

  it('filtre de suivi des listes : un état, « à clore » ou « tous »', () => {
    expect(FiltreSuivi.options).toEqual([...ETATS_SUIVI, 'a_clore', 'tous']);
    expect(RechercheConstats.parse({ etat: 'a_clore' }).etat).toBe('a_clore');
    expect(RechercheDeclarees.parse({ etat: 'corrigee' }).etat).toBe('corrigee');
    expect(RechercheConstats.safeParse({ etat: 'ouvert' }).success).toBe(false);
    expect(RechercheConstats.parse({}).etat).toBeUndefined();
  });
});

describe('action préremplie', () => {
  it('constat : nom du contrôle, correctif de Tenable tel quel ; intitulé borné à 200 caractères', () => {
    const p = preremplirAction({
      nature: 'constat',
      plugin: '900001',
      nom: 'Exemple Linux : noyau (EX-2026-0001)',
      correctif: 'Update the affected packages.',
    });
    expect(p.titre).toBe('Corriger : Exemple Linux : noyau (EX-2026-0001)');
    expect(p.description).toBe(
      'Faille détectée par Tenable Security Center : contrôle n° 900001, « Exemple Linux : noyau (EX-2026-0001) ».\n\n' +
        'Correctif indiqué par Tenable (en anglais, tel quel) :\nUpdate the affected packages.',
    );
    const long = preremplirAction({ nature: 'constat', plugin: '1', nom: 'x'.repeat(300), correctif: null });
    expect(long.titre).toHaveLength(200);
    expect(long.titre.endsWith('…')).toBe(true);
    expect(long.description).not.toContain('Correctif');
  });

  it('faille déclarée : CVE et produit, action exigée du catalogue KEV si elle existe', () => {
    const p = preremplirAction({
      nature: 'declaree',
      cve: 'CVE-2026-91001',
      produit: { editeur: 'Éditeur fictif', nom: 'Gestionnaire fictif', versionProduit: '10.1.2' },
      actionKev: 'Apply updates.',
    });
    expect(p.titre).toBe('Corriger CVE-2026-91001 : Éditeur fictif Gestionnaire fictif 10.1.2');
    expect(p.description).toContain('Action exigée par le catalogue KEV (en anglais, telle quelle) :\nApply updates.');
    expect(
      preremplirAction({
        nature: 'declaree',
        cve: 'CVE-2026-91001',
        produit: { editeur: 'E', nom: 'P', versionProduit: '1' },
        actionKev: null,
      }).description,
    ).toBe('Faille CVE-2026-91001 rattachée au produit surveillé « E P 1 ».');
  });

  it('mention de l’origine : module, et contrôle ou CVE ; jamais de machine', () => {
    expect(mentionOrigineAction({ nature: 'constat', plugin: '900001' })).toBe(
      `${ORIGINE_ACTION_VULNERABILITES} (contrôle n° 900001 de Tenable Security Center).`,
    );
    expect(mentionOrigineAction({ nature: 'declaree', cve: 'CVE-2026-91001' })).toBe(
      'Créée depuis le module Vulnérabilités (faille déclarée CVE-2026-91001).',
    );
  });
});
