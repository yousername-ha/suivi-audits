/* Menu Résilience (ADR 0091) : anciennes adresses redirigées vers la fiche de l'incident, état du RETEX du registre. */
import { describe, expect, it } from 'vitest';
import type { CollecteRetex, EvenementRetex, PropositionRetex } from '@suivi/shared';
import { adresseRegistreDepuisRetex } from '../src/incidents/anciennes-adresses';
import { etatRetexIncident } from '../src/incidents/etat-retex';

describe('anciennes adresses du menu Résilience', () => {
  it('« RETEX et chronologie » ouvre l’onglet RETEX de la fiche, rubrique interne conservée', () => {
    expect(adresseRegistreDepuisRetex('?incident=INC-2026-901&vue=valider')).toBe(
      '/pilotage/incidents-registre?incident=INC-2026-901&onglet=retex&vue=valider',
    );
    expect(adresseRegistreDepuisRetex('?incident=INC-2026-901')).toBe(
      '/pilotage/incidents-registre?incident=INC-2026-901&onglet=retex',
    );
  });
  it('sans incident, ou avec un identifiant à encoder, reste sûr', () => {
    expect(adresseRegistreDepuisRetex('')).toBe('/pilotage/incidents-registre');
    expect(adresseRegistreDepuisRetex('?vue=valider')).toBe('/pilotage/incidents-registre');
    expect(adresseRegistreDepuisRetex('?incident=A%26B&vue=x%3Dy')).toBe(
      '/pilotage/incidents-registre?incident=A%26B&onglet=retex&vue=x%3Dy',
    );
  });
});

describe('état du RETEX d’un incident', () => {
  const evenement = { id: 'EV-001' } as EvenementRetex;
  const proposition = (statut: PropositionRetex['statut']) => ({ statut }) as PropositionRetex;
  const collecte = (c: Partial<CollecteRetex>) =>
    ({ statut: 'ouverte', diffusee: false, contributeurs: [], propositions: [], ...c }) as CollecteRetex;
  it('distingue pas de RETEX, saisie seule, collecte ouverte et collecte close', () => {
    expect(etatRetexIncident({ collecte: null, timeline: [] })).toMatchObject({
      cle: 'aucun',
      libelle: 'Pas de RETEX',
    });
    expect(etatRetexIncident({ collecte: null, timeline: [evenement] })).toMatchObject({
      cle: 'saisie',
      libelle: 'Saisie seule',
    });
    expect(etatRetexIncident({ collecte: collecte({}), timeline: [] })).toMatchObject({
      cle: 'ouverte',
      libelle: 'Collecte ouverte',
      ton: 'attention',
    });
    expect(etatRetexIncident({ collecte: collecte({ statut: 'cloturee' }), timeline: [] })).toMatchObject({
      cle: 'close',
      libelle: 'Collecte close',
      ton: 'succes',
    });
    expect(
      etatRetexIncident({ collecte: collecte({ statut: 'cloturee', diffusee: true }), timeline: [] }).libelle,
    ).toBe('Close · diffusée');
  });
  it('compte les propositions à valider', () => {
    const c = collecte({
      propositions: [proposition('en_attente'), proposition('acceptee'), proposition('en_attente')],
    });
    expect(etatRetexIncident({ collecte: c, timeline: [] }).enAttente).toBe(2);
  });
});
