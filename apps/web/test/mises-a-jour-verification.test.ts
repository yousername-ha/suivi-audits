/* Vérification des mises à jour depuis l'interface (R6-03, signalement du RSSI du 16/11/2026 sur les flux GitHub/Sigstore) :
   l'échec est annoncé dès qu'il est connu, avec sa cause probable (pare-feu de l'hôte ou du réseau), même si l'exécutant
   laisse la phase « checking » publiée ; l'échec d'une vérification précédente n'est jamais pris pour le résultat de la
   nouvelle. Données fictives. */
import type { UpdateState } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { ECHEC_GITHUB, issueVerification, nouvelleVersion } from '../src/mises-a-jour';

const ID = '00000000-0000-4000-8000-000000000003';
const AVANT = '2026-10-01T08:00:00.000Z';
const etat = (e: Partial<UpdateState> = {}): UpdateState => ({
  installed: '3.0.0',
  available: null,
  checkedAt: AVANT,
  notes: null,
  checking: false,
  checkError: false,
  ready: true,
  maintenance: false,
  id: null,
  target: null,
  status: 'idle',
  phase: 'idle',
  message: '',
  startedAt: null,
  updatedAt: AVANT,
  etapes: [],
  finishedAt: null,
  ...e,
});
const demande = { id: ID, checkedAt: AVANT };

describe('vérification des mises à jour : résultat annoncé', () => {
  it('en cours : rien n’est encore annoncé', () => {
    expect(
      issueVerification(etat({ checking: true, phase: 'checking', status: 'running', id: ID }), demande),
    ).toBeNull();
    expect(issueVerification(etat({ status: 'queued' }), demande)).toBeNull();
  });
  it('réussite : nouvelle version, ou aucune', () => {
    const fin = '2026-11-16T09:00:00.000Z';
    expect(
      issueVerification(
        etat({ id: ID, status: 'success', phase: 'complete', checkedAt: fin, available: '3.1.0' }),
        demande,
      ),
    ).toEqual({ ton: 'info', texte: 'Une nouvelle version est disponible : 3.1.0.' });
    expect(issueVerification(etat({ id: ID, status: 'success', phase: 'complete', checkedAt: fin }), demande)).toEqual({
      ton: 'info',
      texte: 'Vérification terminée : aucune nouvelle version.',
    });
  });
  it('GitHub injoignable : échec annoncé aussitôt, même avec la phase « checking » laissée par un ancien exécutant', () => {
    for (const phase of ['checking', 'idle'] as const) {
      const r = issueVerification(etat({ id: ID, status: 'failed', phase, checkError: true }), demande);
      expect(r, phase).toEqual({ ton: 'erreur', texte: ECHEC_GITHUB });
    }
    expect(ECHEC_GITHUB).toContain('pare-feu de l’hôte et du réseau');
    expect(ECHEC_GITHUB).toContain('Flux vers l’extérieur');
  });
  it('autre échec (flux refermé depuis la demande…) : le message de l’exécutant est repris', () => {
    const message = 'Le flux « Mises à jour de la plateforme » est fermé : rien n’a été vérifié ni téléchargé.';
    expect(issueVerification(etat({ id: ID, status: 'failed', message }), demande)).toEqual({
      ton: 'erreur',
      texte: `La vérification n’a pas abouti : ${message}`,
    });
  });
  it('un échec antérieur (checkError resté vrai, autre demande) n’est pas le résultat de la nouvelle vérification', () => {
    const ancien = etat({ id: '00000000-0000-4000-8000-000000000001', status: 'failed', checkError: true });
    expect(issueVerification(ancien, demande)).toBeNull();
  });
  it('exécutant qui ne publie pas l’identifiant : la nouvelle date de vérification suffit', () => {
    expect(
      issueVerification(etat({ checkedAt: '2026-11-16T09:00:00.000Z', available: '3.1.0' }), {
        id: null,
        checkedAt: AVANT,
      }),
    ).toEqual({ ton: 'info', texte: 'Une nouvelle version est disponible : 3.1.0.' });
  });
  it('nouvelle version : comparaison numérique, jamais pour une version installée non numérotée', () => {
    expect(nouvelleVersion(etat({ installed: '7.2.0', available: '7.2.1' }))).toBe(true);
    expect(nouvelleVersion(etat({ installed: '7.10.0', available: '7.9.9' }))).toBe(false);
    expect(nouvelleVersion(etat({ installed: 'local', available: '7.2.1' }))).toBe(false);
    expect(nouvelleVersion(undefined)).toBe(false);
  });
});
