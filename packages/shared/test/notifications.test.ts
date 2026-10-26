/* Notifications métier (décision 012-10, ADR 0058) : liste fermée des types et règle de résolution à trois niveaux.
   Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_CANAUX,
  NOTIFICATION_TYPES,
  ReglagesBody,
  resoudreHeritage,
  resoudreNotification,
  type HeritageReglage,
  type Reglage,
} from '../src/index.js';

const groupe = (nom: string, valeur: Reglage): HeritageReglage => ({ kind: 'groupe', id: 'g-' + nom, nom, valeur });
const role = (nom: string, valeur: Reglage): HeritageReglage => ({ kind: 'role', id: 'r-' + nom, nom, valeur });

describe('types et canaux', () => {
  it('liste fermée : seuls les types réellement émis par le serveur', () => {
    expect(NOTIFICATION_TYPES.map((t) => t.id)).toEqual(['task_due', 'risk_review', 'rapprochement']);
    expect(NOTIFICATION_CANAUX).toEqual(['application', 'courriel']);
    for (const t of NOTIFICATION_TYPES) {
      expect(t.label.length).toBeGreaterThan(5);
      expect(t.description.length).toBeGreaterThan(20);
    }
  });
});

describe('résolution : valeur par défaut', () => {
  it('sans aucun réglage : application activée, courriel désactivé', () => {
    expect(resoudreNotification(null, [], 'application')).toMatchObject({ actif: true, origine: 'defaut' });
    expect(resoudreNotification(undefined, [], 'courriel')).toMatchObject({ actif: false, origine: 'defaut' });
    expect(resoudreNotification(null, [groupe('Qualité', null), role('Lecteur', null)], 'courriel')).toMatchObject({
      actif: false,
      origine: 'defaut',
      sources: [],
    });
  });
});

describe('résolution : groupes et rôles', () => {
  it('activé si au moins un groupe ou un rôle est activé, même si un autre est désactivé', () => {
    const r = resoudreNotification(null, [groupe('A', false), groupe('B', true), role('C', false)], 'courriel');
    expect(r).toMatchObject({ actif: true, origine: 'groupe', exclu: false });
    expect(r.sources.map((s) => s.nom)).toEqual(['B']);
  });
  it('un rôle activé suffit, l’origine est alors le rôle', () => {
    const r = resoudreNotification(null, [groupe('A', null), role('Contributeur', true)], 'courriel');
    expect(r).toMatchObject({ actif: true, origine: 'role' });
  });
  it('groupe et rôle activés : l’origine citée est le groupe, les deux sources sont conservées', () => {
    const r = resoudreNotification(null, [role('R', true), groupe('G', true)], 'courriel');
    expect(r.origine).toBe('groupe');
    expect(r.sources.map((s) => s.kind).sort()).toEqual(['groupe', 'role']);
  });
  it('désactivé explicitement par un groupe, sans aucun parent activé : désactivé (même pour l’application)', () => {
    expect(resoudreNotification(null, [groupe('Silencieux', false)], 'application')).toMatchObject({
      actif: false,
      origine: 'groupe',
    });
    expect(resoudreHeritage([role('R', false), groupe('G', null)], 'application')).toMatchObject({
      actif: false,
      origine: 'role',
    });
  });
});

describe('résolution : le réglage personnel l’emporte toujours', () => {
  it('désactivé en personne malgré un groupe activé : exclu', () => {
    const r = resoudreNotification(false, [groupe('Équipe', true)], 'courriel');
    expect(r).toMatchObject({ actif: false, origine: 'utilisateur', exclu: true, ajoute: false, sources: [] });
  });
  it('activé en personne sans rien d’hérité : ajouté', () => {
    expect(resoudreNotification(true, [groupe('Équipe', false)], 'courriel')).toMatchObject({
      actif: true,
      origine: 'utilisateur',
      ajoute: true,
      exclu: false,
    });
  });
  it('désactivé en personne sans rien d’hérité : exclu seulement si la valeur par défaut l’aurait activé', () => {
    expect(resoudreNotification(false, [], 'courriel')).toMatchObject({ actif: false, exclu: false });
    expect(resoudreNotification(false, [], 'application')).toMatchObject({ actif: false, exclu: true });
  });
  it('non défini en personne : l’héritage s’applique', () => {
    expect(resoudreNotification(null, [groupe('Équipe', true)], 'courriel').actif).toBe(true);
  });
});

describe('cas de la décision : A, B et C dans un groupe avec le courriel coché, A l’a retiré dans son profil', () => {
  const equipe = [groupe('Équipe', true)];
  const personnels: Record<string, Reglage> = { A: false, B: null, C: null };
  const destinataires = Object.entries(personnels)
    .filter(([, perso]) => resoudreNotification(perso, equipe, 'courriel').actif)
    .map(([nom]) => nom);

  it('seuls B et C reçoivent le courriel', () => {
    expect(destinataires).toEqual(['B', 'C']);
  });
  it('A est exclu par son réglage personnel, B et C héritent du groupe', () => {
    expect(resoudreNotification(false, equipe, 'courriel')).toMatchObject({ actif: false, exclu: true });
    expect(resoudreNotification(null, equipe, 'courriel')).toMatchObject({ actif: true, origine: 'groupe' });
  });
  it('l’application, non touchée, reste activée pour les trois', () => {
    for (const perso of Object.values(personnels))
      expect(resoudreNotification(perso === false ? null : perso, equipe, 'application').actif).toBe(true);
  });
  it('A garde l’application même si seul le courriel est retiré (canaux indépendants)', () => {
    expect(resoudreNotification(null, equipe, 'application').actif).toBe(true);
  });
});

describe('corps de modification', () => {
  it('accepte activé, désactivé, non défini', () => {
    const r = ReglagesBody.safeParse({
      changements: [
        { type: 'task_due', canal: 'courriel', valeur: true },
        { type: 'task_due', canal: 'application', valeur: false },
        { type: 'risk_review', canal: 'courriel', valeur: null },
      ],
    });
    expect(r.success).toBe(true);
  });
  it('refuse un type inconnu, un canal inconnu, un doublon, un corps vide et un champ en trop', () => {
    const ok = { type: 'task_due', canal: 'courriel', valeur: true };
    expect(ReglagesBody.safeParse({ changements: [{ ...ok, type: 'retard' }] }).success).toBe(false);
    expect(ReglagesBody.safeParse({ changements: [{ ...ok, canal: 'sms' }] }).success).toBe(false);
    expect(ReglagesBody.safeParse({ changements: [ok, { ...ok, valeur: false }] }).success).toBe(false);
    expect(ReglagesBody.safeParse({ changements: [] }).success).toBe(false);
    expect(ReglagesBody.safeParse({ changements: [{ ...ok, valeur: 'oui' }] }).success).toBe(false);
    expect(ReglagesBody.safeParse({ changements: [{ ...ok, extra: 1 }] }).success).toBe(false);
  });
});
