/* Timeline Studio (refonte Neon, lot 6) : teintes, commande et description des repères. La teinte double toujours un
   texte ; le retard reste distinct de l'état et du résultat. Données fictives. */
import { businessDefaults, type GrcObject } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import {
  classeResultat,
  commandeRepere,
  descriptionRepere,
  estOccurrence,
  estRecurrente,
  tonStatut,
  tonTache,
} from '../src/grc/etat-action';

const policy = businessDefaults();
const MAINTENANT = Date.parse('2026-11-14T10:00:00Z');
const objet = (data: Record<string, unknown>, extra: Partial<GrcObject> & { validation?: unknown } = {}) =>
  ({ id: 'a1', name: 'Action fictive', kind: 'action', data, ...extra }) as unknown as GrcObject;
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

describe('teintes de la Timeline Studio', () => {
  it('donne l’orange au premier état ouvert, et une teinte à chaque sens', () => {
    expect(tonStatut(policy, 'todo')).toBe('amber');
    expect(tonStatut(policy, 'progress')).toBe('blue');
    expect(tonStatut(policy, 'blocked')).toBe('red');
    expect(tonStatut(policy, 'done')).toBe('teal');
    expect(tonStatut(policy, 'cancelled')).toBe('muted');
  });
  it('suit une politique personnalisée : premier état orange, état terminal vert', () => {
    const perso = {
      ...policy,
      statuses: [
        { id: 'ouvert', label: 'Ouvert', terminal: false, color: '#000000' },
        { id: 'revue', label: 'En revue', terminal: false, color: '#000000' },
        { id: 'clos', label: 'Clos', terminal: true, color: '#000000' },
      ],
    };
    expect(tonStatut(perso, 'ouvert')).toBe('amber');
    expect(tonStatut(perso, 'revue')).toBe('blue');
    expect(tonStatut(perso, 'clos')).toBe('teal');
  });
  it('traite les états historiques inconnus sans les inventer', () => {
    expect(tonStatut(policy, 'done')).toBe('teal');
    expect(tonStatut({ ...policy, statuses: policy.statuses.filter((s) => s.id !== 'done') }, 'done')).toBe('teal');
    expect(tonStatut(policy, 'inconnu')).toBe('amber');
  });
  it('le résultat d’une occurrence prime sur son état', () => {
    const occ = (result?: string) =>
      objet({ status: 'todo', seriesId: 's1' }, { validation: result ? { result } : null });
    expect(tonTache(occ(), policy)).toBe('amber');
    expect(tonTache(occ('ok'), policy)).toBe('teal');
    expect(tonTache(occ('ko'), policy)).toBe('red');
    expect(tonTache(occ('na'), policy)).toBe('muted');
    expect(classeResultat(occ())).toBe('attente');
    expect(classeResultat(occ('ko'))).toBe('ko');
  });
});

describe('repères de la Timeline Studio', () => {
  it('distingue occurrences, tâches historiques et actions', () => {
    const occ = objet({ status: 'todo', seriesId: 's1', occurrenceKey: 's1:1' });
    const historique = objet({ status: 'todo', legacyRecurring: true }, { id: 'legacy:recurring:r1' });
    const simple = objet({ status: 'todo' });
    expect(estOccurrence(occ)).toBe(true);
    expect(estOccurrence(historique)).toBe(false);
    expect(estRecurrente(historique)).toBe(true);
    expect(estRecurrente(simple)).toBe(false);
    expect(commandeRepere(occ)).toBe('Saisir le résultat');
    expect(commandeRepere(historique)).toBe('Réaliser la tâche historique');
    expect(commandeRepere(simple)).toBe('Suivi de réalisation');
  });
  it('dit l’état, le retard et la période sans répéter l’intitulé', () => {
    const o = objet({ status: 'todo', startAt: '2026-10-01T08:00:00Z', dueAt: '2026-11-01T08:00:00Z' });
    const d = descriptionRepere(o, policy, MAINTENANT, date);
    expect(d).toBe('à faire, en retard, du 01/10/2026, échéance le 01/11/2026');
    expect(d).not.toContain('Action fictive');
  });
  it('une occurrence validée n’est pas en retard et dit son résultat', () => {
    const o = objet(
      { status: 'todo', seriesId: 's1', dueAt: '2026-11-01T08:00:00Z' },
      { validation: { result: 'ko' } },
    );
    expect(descriptionRepere(o, policy, MAINTENANT, date)).toBe('à faire, validée (KO), échéance le 01/11/2026');
    const attente = objet({ status: 'progress', seriesId: 's1', dueAt: '2026-12-01T08:00:00Z' });
    expect(descriptionRepere(attente, policy, MAINTENANT, date)).toBe(
      'en cours, résultat en attente, échéance le 01/12/2026',
    );
  });
});
