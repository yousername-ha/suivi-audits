/* Frise du plan d'actions (refonte des frises du 20/11/2026) : colonnes de temps alignées sur l'échelle, comptes par
   colonne, regroupements et libellés courts, tube depuis la création d'une action qui n'a qu'une échéance (proposition B
   du RSSI) et infobulle des repères, sans déplacer ni inventer aucune date. Données fictives. */
import { businessDefaults, type GrcObject } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { infobulleRepere, infobulleTache } from '../src/grc/etat-action';
import {
  calculerFrise,
  compterParColonne,
  dateCourte,
  debutDepuisCreation,
  debutUnite,
  grouperActions,
  initiales,
  periodeFrise,
  placerActions,
  reperesTaches,
  sansResponsable,
  tachesDe,
  uniteSuivante,
} from '../src/grc/Timeline';

const policy = businessDefaults();
const AUJ = Date.parse('2026-11-20T10:00:00Z');
const action = (id: string, startAt: string | null, dueAt: string | null, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, kind: 'action', data: { startAt, dueAt, status: 'todo', ...extra } }) as unknown as GrcObject;
/** Action fictive créée le `createdAt` donné. */
const creee = (id: string, createdAt: string, startAt: string | null, dueAt: string | null, extra = {}) =>
  ({ ...action(id, startAt, dueAt, extra), createdAt }) as GrcObject;

describe('colonnes de temps de la frise des actions', () => {
  it('aligne le début de chaque unité : lundi ISO, premier du mois, du trimestre, de l’année', () => {
    const n = Date.UTC(2026, 10, 20, 15);
    expect(debutUnite(n, 'semaine')).toBe(Date.UTC(2026, 10, 16));
    expect(debutUnite(n, 'mois')).toBe(Date.UTC(2026, 10, 1));
    expect(debutUnite(n, 'trimestre')).toBe(Date.UTC(2026, 9, 1));
    expect(debutUnite(n, 'annee')).toBe(Date.UTC(2026, 0, 1));
    expect(uniteSuivante(Date.UTC(2027, 0, 1), 'mois')).toBe(Date.UTC(2027, 1, 1));
    expect(uniteSuivante(Date.UTC(2026, 9, 1), 'trimestre')).toBe(Date.UTC(2027, 0, 1));
  });
  it('couvre toutes les actions placées et aujourd’hui, sans la marge d’une semaine, aux bornes de l’échelle', () => {
    const frise = calculerFrise(
      [action('a', '2026-11-02T08:00:00Z', '2026-11-15T08:00:00Z'), action('b', null, '2027-03-15T08:00:00Z')],
      AUJ,
    );
    const p = periodeFrise(frise, 'mois');
    expect(p.debut).toBe(Date.UTC(2026, 10, 1));
    expect(p.fin).toBe(Date.UTC(2027, 3, 1));
    expect(p.colonnes.map((c) => c.libelle)).toEqual(['nov. 26', 'déc. 26', 'janv. 27', 'févr. 27', 'mars 27']);
    expect(periodeFrise(frise, 'trimestre').colonnes.map((c) => c.libelle)).toEqual(['T4 2026', 'T1 2027']);
    expect(periodeFrise(frise, 'annee').colonnes.map((c) => c.libelle)).toEqual(['2026', '2027']);
    const semaines = periodeFrise(frise, 'semaine');
    // Le 02/11/2026 est le lundi de la semaine ISO 45.
    expect(semaines.debut).toBe(Date.UTC(2026, 10, 2));
    expect(semaines.colonnes[0]!.court).toBe('S45');
  });
  it('une action qui dure plusieurs mois reste entière dans la période, à toutes les échelles', () => {
    const frise = calculerFrise([action('longue', '2026-09-14T08:00:00Z', '2027-02-26T08:00:00Z')], AUJ);
    for (const unite of ['semaine', 'mois', 'trimestre', 'annee'] as const) {
      const p = periodeFrise(frise, unite);
      expect(p.debut).toBeLessThanOrEqual(Date.UTC(2026, 8, 14));
      expect(p.fin).toBeGreaterThan(Date.UTC(2027, 1, 26));
    }
    expect(periodeFrise(frise, 'mois').colonnes).toHaveLength(6);
  });
  it('sans action, la période est l’unité qui contient aujourd’hui', () => {
    const p = periodeFrise(calculerFrise([], AUJ), 'mois');
    expect(p.colonnes.map((c) => c.libelle)).toEqual(['nov. 26']);
  });
  it('compte les échéances de chaque colonne et ignore les dates absentes ou hors colonnes', () => {
    const colonnes = [
      { debut: Date.UTC(2026, 10, 1), fin: Date.UTC(2026, 11, 1) },
      { debut: Date.UTC(2026, 11, 1), fin: Date.UTC(2027, 0, 1) },
    ];
    expect(
      compterParColonne(colonnes, [Date.UTC(2026, 10, 15), Date.UTC(2026, 11, 1), Number.NaN, Date.UTC(2027, 0, 1)]),
    ).toEqual([1, 1]);
  });
});

describe('regroupements de la frise des actions', () => {
  const responsable = (o: GrcObject) => String(o.data.ownerLabel ?? 'Non attribué');
  const objets = [
    action('basse', null, '2026-12-01T08:00:00Z', {
      priority: 'low',
      status: 'progress',
      ownerId: 'u1',
      ownerLabel: 'Zoé Martin',
    }),
    action('urgente', null, '2026-12-02T08:00:00Z', { priority: 'urgent', status: 'blocked' }),
    action('normale', null, '2026-12-03T08:00:00Z', { priority: 'normal', ownerId: 'u2', ownerLabel: 'Alix Bernard' }),
    action('haute', null, '2026-12-04T08:00:00Z', {
      priority: 'high',
      status: 'progress',
      ownerId: 'u1',
      ownerLabel: 'Zoé Martin',
    }),
  ];
  const options = { objet: (o: GrcObject) => o, policy, responsable };
  it('ordonne les priorités : urgente, haute, normale, basse', () => {
    expect(grouperActions(objets, 'priorite', options).map((g) => g.libelle)).toEqual([
      'Priorité urgente',
      'Priorité haute',
      'Priorité normale',
      'Priorité basse',
    ]);
  });
  it('suit l’ordre des états de la politique et range les responsables, « Non attribué » en dernier', () => {
    expect(grouperActions(objets, 'etat', options).map((g) => g.libelle)).toEqual(['À faire', 'En cours', 'Bloquée']);
    const parResponsable = grouperActions(objets, 'responsable', options);
    expect(parResponsable.map((g) => g.libelle)).toEqual(['Alix Bernard', 'Zoé Martin', 'Non attribué']);
    expect(parResponsable[1]!.lignes.map((o) => o.id)).toEqual(['basse', 'haute']);
  });
  it('« Aucun » garde toutes les lignes dans un seul groupe, dans leur ordre', () => {
    const g = grouperActions(objets, 'aucun', options);
    expect(g).toHaveLength(1);
    expect(g[0]!.lignes.map((o) => o.id)).toEqual(['basse', 'urgente', 'normale', 'haute']);
    expect(grouperActions([], 'aucun', options)).toEqual([]);
  });
  it('une priorité inconnue garde son groupe, après les priorités connues', () => {
    const g = grouperActions([action('x', null, null, { priority: 'critique' }), objets[1]!], 'priorite', options);
    expect(g.map((x) => x.libelle)).toEqual(['Priorité urgente', 'Priorité critique']);
  });
});

describe('action qui n’a qu’une échéance : tube depuis la création de sa fiche (proposition B)', () => {
  const echeance = '2027-01-29T09:00:00Z';
  it('part de la création quand elle précède l’échéance', () => {
    expect(debutDepuisCreation(creee('a', '2026-11-20T08:00:00Z', null, echeance))).toBe(Date.UTC(2026, 10, 20));
    // Création le jour même de l'échéance : tube d'un jour, pas de losange.
    expect(debutDepuisCreation(creee('b', '2027-01-29T07:00:00Z', null, echeance))).toBe(Date.UTC(2027, 0, 29));
  });
  it('garde le losange quand la création suit l’échéance ou est illisible', () => {
    expect(debutDepuisCreation(creee('c', '2027-02-01T08:00:00Z', null, echeance))).toBeNull();
    expect(debutDepuisCreation(creee('d', 'pas une date', null, echeance))).toBeNull();
    expect(debutDepuisCreation(action('e', null, echeance))).toBeNull();
  });
  it('laisse le carré aux occurrences de séries et aux tâches récurrentes historiques', () => {
    expect(debutDepuisCreation(creee('f', '2026-11-01T08:00:00Z', null, echeance, { seriesId: 's1' }))).toBeNull();
    expect(
      debutDepuisCreation(creee('g', '2026-11-01T08:00:00Z', null, echeance, { occurrenceKey: 's1:1' })),
    ).toBeNull();
    expect(
      debutDepuisCreation(creee('h', '2026-11-01T08:00:00Z', null, echeance, { legacyRecurring: true })),
    ).toBeNull();
  });
  it('ne concerne ni une action qui a une date de début, ni une action sans échéance', () => {
    expect(debutDepuisCreation(creee('i', '2026-11-01T08:00:00Z', '2026-12-01T08:00:00Z', echeance))).toBeNull();
    expect(debutDepuisCreation(creee('j', '2026-11-01T08:00:00Z', '2026-12-01T08:00:00Z', null))).toBeNull();
  });
  it('place le tube depuis la création sans toucher à calculerFrise, et la période l’englobe', () => {
    const objets = [
      creee('sans-debut', '2026-09-03T08:00:00Z', null, '2026-12-15T09:00:00Z'),
      creee('creee-apres', '2026-12-20T08:00:00Z', null, '2026-12-10T09:00:00Z'),
      creee('occurrence', '2026-09-01T08:00:00Z', null, '2026-12-05T09:00:00Z', { seriesId: 's1' }),
      creee('datee', '2026-08-01T08:00:00Z', '2026-11-25T08:00:00Z', '2026-12-20T08:00:00Z'),
    ];
    const frise = calculerFrise(objets, AUJ);
    // calculerFrise reste inchangé : une action qui n'a qu'une échéance y est un repère d'un jour.
    const brute = frise.placees.find((p) => p.objet.id === 'sans-debut')!;
    expect(brute.de).toBe(brute.a);
    const dessinees = placerActions(frise.placees);
    const parId = (id: string) => dessinees.find((d) => d.objet.id === id)!;
    expect(parId('sans-debut')).toMatchObject({ de: Date.UTC(2026, 8, 3), creation: Date.UTC(2026, 8, 3) });
    expect(parId('creee-apres').creation).toBeNull();
    expect(parId('creee-apres').de).toBe(parId('creee-apres').a);
    expect(parId('occurrence').creation).toBeNull();
    expect(parId('datee')).toMatchObject({ de: Date.UTC(2026, 10, 25), creation: null });
    const debuts = dessinees.filter((d) => d.creation !== null).map((d) => d.de);
    expect(periodeFrise(frise, 'mois').debut).toBe(Date.UTC(2026, 10, 1));
    expect(periodeFrise(frise, 'mois', debuts).debut).toBe(Date.UTC(2026, 8, 1));
  });
  it('reste dans la limite de deux ans de la frise', () => {
    const frise = calculerFrise([creee('ancienne', '2020-01-10T08:00:00Z', null, '2026-12-15T09:00:00Z')], AUJ);
    const p = periodeFrise(
      frise,
      'mois',
      placerActions(frise.placees).map((d) => d.de),
    );
    const finFrise = frise.debut + (frise.jours - 1) * 86_400_000;
    expect(p.debut).toBeGreaterThanOrEqual(Date.UTC(new Date(finFrise - 730 * 86_400_000).getUTCFullYear(), 0, 1));
    expect(p.colonnes.length).toBeLessThanOrEqual(25);
  });
});

describe('infobulle des repères', () => {
  it('tube : intitulé, du … au …, état et retard', () => {
    expect(
      infobulleRepere(
        action('Revoir les comptes', '2026-11-02T08:00:00Z', '2026-11-15T08:00:00Z', { status: 'progress' }),
        policy,
        AUJ,
      ),
    ).toEqual(['Revoir les comptes', 'du 02/11/2026 au 15/11/2026', 'En cours · En retard']);
  });
  it('tube depuis la création : il le dit, avec l’échéance', () => {
    expect(
      infobulleRepere(action('Planifier le test', null, '2027-01-29T09:00:00Z'), policy, AUJ, {
        creation: Date.UTC(2026, 10, 20),
      }),
    ).toEqual([
      'Planifier le test',
      'depuis la création le 20/11/2026 (pas de date de début) · échéance 29/01/2027',
      'À faire',
    ]);
  });
  it('losange : intitulé, échéance, état', () => {
    expect(infobulleRepere(action('Corriger la faille', null, '2026-12-18T08:00:00Z'), policy, AUJ)).toEqual([
      'Corriger la faille',
      'échéance 18/12/2026',
      'À faire',
    ]);
  });
  it('carré d’occurrence : série, échéance, résultat ou résultat attendu', () => {
    const occ = (validation: unknown) =>
      ({
        ...action('Revue des accès', null, '2026-11-19T09:00:00Z', { seriesId: 's1' }),
        validation,
      }) as unknown as GrcObject;
    expect(infobulleRepere(occ({ result: 'ko' }), policy, AUJ, { carre: true })).toEqual([
      'Revue des accès',
      'échéance 19/11/2026',
      'Résultat : KO',
    ]);
    expect(infobulleRepere(occ(null), policy, AUJ, { carre: true })).toEqual([
      'Revue des accès',
      'échéance 19/11/2026',
      'Résultat attendu · En retard',
    ]);
  });
});

describe('libellés courts', () => {
  it('donne les initiales d’une personne, d’un groupe ou d’une fonction', () => {
    expect(initiales('Zoé Martin')).toBe('ZM');
    expect(initiales('Jean-Luc Petit')).toBe('JP');
    expect(initiales('rssi')).toBe('RS');
    expect(initiales('Groupe Équipe réseau')).toBe('ÉR');
    expect(initiales('Fonction Délégué à la protection des données')).toBe('DD');
    expect(initiales('')).toBe('');
  });
  it('repère une fiche sans responsable désigné', () => {
    expect(sansResponsable(action('a', null, null))).toBe(true);
    expect(sansResponsable(action('b', null, null, { ownerId: 'u1' }))).toBe(false);
    expect(sansResponsable(action('c', null, null, { responsable: { type: 'groupe', id: 'g1' } }))).toBe(false);
  });
  it('écrit jj/mm, avec l’année si elle diffère de l’année en cours', () => {
    expect(dateCourte(Date.UTC(2026, 10, 15), 2026)).toBe('15/11');
    expect(dateCourte(Date.UTC(2027, 2, 15), 2026)).toBe('15/03/27');
  });
});

describe('tâches d’une action dans la frise (ADR 0111)', () => {
  const t = (id: string, echeance: string | null, faite = false) => ({ id, intitule: `Tâche ${id}`, faite, echeance });
  it('place un repère par tâche datée, dans l’ordre des échéances : faite, en retard ou à faire', () => {
    const r = reperesTaches(
      [
        t('c', '2026-12-12'),
        t('a', '2026-11-25', true),
        t('sans', null),
        t('b', '2026-11-10'),
        t('jour', '2026-11-20'),
        t('illisible', 'pas une date'),
      ],
      AUJ,
    );
    expect(r.map((x) => [x.tache.id, x.etat])).toEqual([
      ['b', 'retard'],
      ['jour', 'afaire'],
      ['a', 'faite'],
      ['c', 'afaire'],
    ]);
    expect(r[0]!.jour).toBe(Date.UTC(2026, 10, 10));
  });
  it('une tâche faite en retard reste « faite » ; sans tâche, aucun repère', () => {
    expect(reperesTaches([t('x', '2026-01-01', true)], AUJ).map((x) => x.etat)).toEqual(['faite']);
    expect(reperesTaches([], AUJ)).toEqual([]);
    expect(tachesDe(action('sans', null, '2026-12-01T00:00:00Z'))).toEqual([]);
    expect(tachesDe(action('mal', null, null, { taches: 'pas un tableau' }))).toEqual([]);
  });
  it('l’infobulle du tube ajoute « Tâches : n/N (p %) » ; celle d’un losange de tâche dit responsable, échéance et état', () => {
    const o = action('Activer la MFA', '2026-11-16T08:00:00Z', '2026-12-31T08:00:00Z', {
      taches: [
        t('a', '2026-11-25', true),
        t('b', '2026-12-05', true),
        t('c', '2026-12-12'),
        t('d', null),
        t('e', null),
      ],
    });
    expect(infobulleRepere(o, policy, AUJ).at(-1)).toBe('Tâches : 2/5 (40 %)');
    // Carré d'occurrence : pas de ligne de tâches.
    expect(infobulleRepere(o, policy, AUJ, { carre: true }).some((l) => l.startsWith('Tâches'))).toBe(false);
    expect(infobulleTache(t('c', '2026-11-10'), 'Zoé Martin', AUJ)).toEqual([
      'Tâche c',
      'Responsable : Zoé Martin',
      'échéance 10/11/2026',
      'Tâche à faire · En retard',
    ]);
    expect(infobulleTache(t('d', null, true), null, AUJ)).toEqual([
      'Tâche d',
      'Responsable : non désigné',
      'sans échéance',
      'Tâche faite',
    ]);
  });
});
