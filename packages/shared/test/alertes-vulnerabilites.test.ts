/* Module Vulnérabilités (ADR 0100, lot V6) : règles des alertes décidées par la plateforme. Cas en table : seuils (P1
   critique, P2 simple, rien pour P3 et P4), création, mise à jour sans rejeu, montée et descente, clôture et son motif, clé
   d'une faille, titre de notification sans nom. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  type AlerteExistante,
  cleAlerte,
  deciderAlerte,
  type DecisionAlerte,
  empreinteAlerte,
  type FaitsAlerte,
  motifCloture,
  NOTIFICATION_RUBRIQUES,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPES_VULNERABILITES,
  niveauAlerte,
  type NiveauAlerte,
  type NiveauPriorite,
  RechercheAlertesVulnerabilites,
  resumeExploitationAlerte,
  resumeNombreLisible,
  type SituationFaille,
  titreNotificationAlerte,
} from '../src/index.js';

const faits = (extra: Partial<FaitsAlerte> = {}): FaitsAlerte => ({
  priorite: {
    niveau: 'P1',
    faits: [
      { fait: 'exploitation', sources: ['kev'] },
      { fait: 'presence', presence: 'detectee' },
    ],
  },
  presences: ['detectee'],
  exploitation: [{ source: 'kev', le: '2026-11-01T00:00:00.000Z' }],
  nombres: { machines: 3, produits: 0, actifs: 0 },
  titre: 'Produit fictif : exécution de code à distance',
  produit: 'Produit fictif',
  ...extra,
});
const E = empreinteAlerte(faits());
const presente = (p: NiveauPriorite): SituationFaille => ({ priorite: p, traitee: false });
const absente: SituationFaille = { priorite: null, traitee: false };

describe('seuils', () => {
  it.each<[NiveauPriorite, NiveauAlerte | null]>([
    ['P1', 'critique'],
    ['P2', 'simple'],
    ['P3', null],
    ['P4', null],
  ])('%s → %s', (p, n) => expect(niveauAlerte(p)).toBe(n));
});

describe('décision', () => {
  const ouverte = (
    niveau: NiveauAlerte,
    etat: AlerteExistante['etat'] = 'ouverte',
    empreinte = E,
  ): AlerteExistante => ({
    niveau,
    etat,
    empreinte,
  });
  it.each<[string, AlerteExistante | null, NiveauAlerte | null, string | null, SituationFaille, DecisionAlerte]>([
    ['rien à alerter, aucune alerte', null, null, null, absente, { action: 'rien' }],
    ['P3 présente, aucune alerte', null, null, null, presente('P3'), { action: 'rien' }],
    [
      'P1 sans alerte : création critique',
      null,
      'critique',
      E,
      presente('P1'),
      { action: 'creer', niveau: 'critique', notifier: 'critique' },
    ],
    [
      'P2 sans alerte : création simple',
      null,
      'simple',
      E,
      presente('P2'),
      { action: 'creer', niveau: 'simple', notifier: 'simple' },
    ],
    [
      'alerte close et faille revenue : nouvelle alerte',
      ouverte('critique', 'close'),
      'critique',
      E,
      presente('P1'),
      { action: 'creer', niveau: 'critique', notifier: 'critique' },
    ],
    ['mêmes faits : rien (pas de rejeu)', ouverte('critique'), 'critique', E, presente('P1'), { action: 'rien' }],
    [
      'prise en compte, mêmes faits : rien',
      ouverte('critique', 'prise_en_compte'),
      'critique',
      E,
      presente('P1'),
      { action: 'rien' },
    ],
    [
      'nombres changés : mise à jour sans notification',
      ouverte('critique'),
      'critique',
      empreinteAlerte(faits({ nombres: { machines: 4, produits: 0, actifs: 0 } })),
      presente('P1'),
      { action: 'mettre_a_jour', niveau: 'critique', notifier: null, reprise: false },
    ],
    [
      'simple qui devient critique : montée notifiée',
      ouverte('simple'),
      'critique',
      E,
      presente('P1'),
      { action: 'mettre_a_jour', niveau: 'critique', notifier: 'critique', reprise: false },
    ],
    [
      'simple prise en compte qui devient critique : prise en compte annulée',
      ouverte('simple', 'prise_en_compte'),
      'critique',
      E,
      presente('P1'),
      { action: 'mettre_a_jour', niveau: 'critique', notifier: 'critique', reprise: true },
    ],
    [
      'critique qui redescend en P2 : reste ouverte, simple, sans notification',
      ouverte('critique', 'prise_en_compte'),
      'simple',
      E,
      presente('P2'),
      { action: 'mettre_a_jour', niveau: 'simple', notifier: null, reprise: false },
    ],
    [
      'critique sous le seuil (P3)',
      ouverte('critique'),
      null,
      null,
      presente('P3'),
      { action: 'clore', motif: 'sous_le_seuil' },
    ],
    [
      'faille traitée (corrigée, risque accepté, non concernée)',
      ouverte('critique', 'prise_en_compte'),
      null,
      null,
      { priorite: null, traitee: true },
      { action: 'clore', motif: 'traitee' },
    ],
    ['faille disparue', ouverte('simple'), null, null, absente, { action: 'clore', motif: 'plus_presente' }],
  ])('%s', (_cas, existante, niveau, empreinte, situation, attendu) =>
    expect(deciderAlerte(existante, { niveau, empreinte, situation })).toEqual(attendu),
  );

  it('motif de clôture', () => {
    expect(motifCloture({ priorite: 'P4', traitee: true })).toBe('sous_le_seuil');
    expect(motifCloture({ priorite: null, traitee: true })).toBe('traitee');
    expect(motifCloture({ priorite: null, traitee: false })).toBe('plus_presente');
  });

  it('empreinte stable : ordre des présences indifférent, tout fait compte', () => {
    expect(empreinteAlerte(faits({ presences: ['exposee', 'detectee'] }))).toBe(
      empreinteAlerte(faits({ presences: ['detectee', 'exposee'] })),
    );
    for (const autre of [
      faits({ titre: 'Autre titre fictif' }),
      faits({ produit: null }),
      faits({ exploitation: [] }),
      faits({ priorite: { niveau: 'P2', faits: [] } }),
      faits({ nombres: { machines: 3, produits: 1, actifs: 0 } }),
    ])
      expect(empreinteAlerte(autre)).not.toBe(E);
  });
});

describe('clé, titre et libellés', () => {
  it('clé : la CVE, ou le constat sans CVE ; toute autre forme refusée', () => {
    expect(cleAlerte({ cve: 'CVE-2026-90001' })).toBe('CVE-2026-90001');
    expect(cleAlerte({ constatId: '00000000-0000-4000-8000-000000000001' })).toBe(
      'constat:00000000-0000-4000-8000-000000000001',
    );
    expect(() => cleAlerte({ cve: 'cve-2026-1' })).toThrow();
    expect(() => cleAlerte({ constatId: 'srv-01' })).toThrow();
  });

  it('titre de notification : niveau, CVE, produit ; jamais de saut de ligne', () => {
    expect(titreNotificationAlerte({ niveau: 'critique', cve: 'CVE-2026-90001', produit: 'Produit\nfictif' })).toBe(
      'Alerte critique : CVE-2026-90001 (Produit fictif)',
    );
    expect(titreNotificationAlerte({ niveau: 'simple', cve: null, produit: null })).toBe(
      'Alerte P2 : constat de Tenable sans CVE',
    );
  });

  it('types de notification du module : déclarés, avec leur rubrique', () => {
    const ids = NOTIFICATION_TYPES.map((t) => t.id) as string[];
    for (const t of NOTIFICATION_TYPES_VULNERABILITES) {
      expect(ids).toContain(t);
      expect(NOTIFICATION_RUBRIQUES[t]?.lien).toBe('/vulnerabilites/alertes');
    }
  });

  it('nombres lisibles : jamais de nombre hors des droits', () => {
    expect(resumeNombreLisible({ lisibles: 3, horsLecture: false })).toBe('3');
    expect(resumeNombreLisible({ lisibles: 2, horsLecture: true })).toBe(
      '2 que vous pouvez lire, et d’autres hors de vos droits',
    );
    expect(resumeNombreLisible({ lisibles: 0, horsLecture: true }, 'm')).toBe(
      'aucun que vous puissiez lire (hors de vos droits)',
    );
    expect(resumeExploitationAlerte([])).toBe('Non avérée');
    expect(
      resumeExploitationAlerte([
        { source: 'kev', le: null },
        { source: 'cert-fr', le: null },
      ]),
    ).toBe('catalogue KEV · alerte du CERT-FR');
  });

  it('recherche : actives par défaut, filtre fermé', () => {
    expect(RechercheAlertesVulnerabilites.parse({})).toEqual({ etat: 'actives', page: 1 });
    expect(RechercheAlertesVulnerabilites.safeParse({ etat: 'inconnu' }).success).toBe(false);
    expect(RechercheAlertesVulnerabilites.safeParse({ niveau: 'P1' }).success).toBe(false);
  });
});
