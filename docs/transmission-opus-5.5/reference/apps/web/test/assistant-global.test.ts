/* Régressions : pause des rondes, quota, périmètres et contexte de navigation. */
import { describe, expect, it } from 'vitest';
import {
  estNotificationAssistant,
  indisponibilite,
  messageAEnvoyer,
  pointEnAttente,
  type EtatAssistant,
  type NotificationAssistant,
} from '../src/assistant/contrats';
const etat: EtatAssistant = {
  actif: true,
  pret: true,
  motif: null,
  fournisseur: 'api.mistral.ai',
  modele: 'test',
  profils: [{ id: 'mise_en_oeuvre', libelle: 'Mise en œuvre', perimetres: [{ id: 'scope', nom: 'Périmètre' }] }],
  jetonsDuJour: 0,
  budgetJetonsJour: 1000,
  enPause: false,
};
describe('Assistant global — contrat de disponibilité', () => {
  it('la pause des rondes laisse le chat disponible', () =>
    expect(indisponibilite({ ...etat, enPause: true }, 'mise_en_oeuvre')).toBe(''));
  it('le quota serveur atteint bloque le chat même si les rondes sont actives', () =>
    expect(indisponibilite({ ...etat, jetonsDuJour: 1000 }, 'mise_en_oeuvre')).toContain('budget'));
  it('un profil absent ou sans périmètre ne peut interroger la plateforme', () => {
    expect(indisponibilite(etat, 'audit_interne')).toContain('Aucun périmètre');
    expect(
      indisponibilite({ ...etat, profils: [{ ...etat.profils[0]!, perimetres: [] }] }, 'mise_en_oeuvre'),
    ).toContain('Aucun périmètre');
  });
  it('le motif serveur prime sur la disponibilité du profil', () =>
    expect(indisponibilite({ ...etat, pret: false, motif: 'Clé à configurer' }, 'mise_en_oeuvre')).toBe(
      'Clé à configurer',
    ));
  it('le contexte est un préfixe visible du texte, pas un nouveau champ protocolaire', () => {
    const value = messageAEnvoyer(' Question ', { nom: 'Documents', chemin: '/documents', perimetre: 'scope' });
    expect(value).toContain('pas une source consultée');
    expect(value).toContain('périmètre : scope');
    expect(value.endsWith('\n\nQuestion')).toBe(true);
    expect(messageAEnvoyer('Question')).toBe('Question');
    expect(
      messageAEnvoyer('x'.repeat(4000), { nom: 'Documents', chemin: '/documents', perimetre: null }).length,
    ).toBeGreaterThan(4000);
  });
});
describe('Assistant global — boîte personnelle indépendante du profil', () => {
  const n: NotificationAssistant = {
    id: 'n',
    smsiId: 's',
    objectId: 'o',
    kind: 'assistant_question',
    title: 'Question',
    message: 'Précision ?',
    readAt: null,
  };
  it('une question lue reste à traiter tant qu’elle n’a pas de réponse', () => {
    expect(pointEnAttente({ ...n, readAt: '2026-11-12' })).toBe(true);
    expect(pointEnAttente({ ...n, reponse: 'Réponse' })).toBe(false);
  });
  it('un rappel lu ne compte plus, un rappel non lu compte', () => {
    expect(pointEnAttente({ ...n, kind: 'assistant_rappel' })).toBe(true);
    expect(pointEnAttente({ ...n, kind: 'assistant_rappel', readAt: '2026-11-12' })).toBe(false);
  });
  it('une autre notification métier ne devient pas une question de l’assistant', () => {
    expect(estNotificationAssistant({ ...n, kind: 'rapprochement' })).toBe(false);
    expect(estNotificationAssistant(n)).toBe(true);
  });
});
