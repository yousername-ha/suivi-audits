/* Module Vulnérabilités (ADR 0100, lots V6 et V6b) : règles des alertes décidées par la plateforme. Cas en table : seuils
   (P1 critique ; P2 simple seulement si exploitable et exposée directement sur Internet, décision du RSSI du 18/11/2026 ;
   rien pour P3 et P4), création, mise à jour sans rejeu, montée et descente, clôture et son motif, clé
   d'une faille, titre de notification sans nom. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  type AlerteExistante,
  cleAlerte,
  deciderAlerte,
  type FaitsSeuilAlerte,
  LIEN_RESUME_ALERTES,
  MESSAGE_RESUME_ALERTES,
  MOTIF_CLOTURE_ALERTE_LIBELLES,
  type DecisionAlerte,
  empreinteAlerte,
  type FaitsAlerte,
  motifCloture,
  NOTIFICATION_RUBRIQUES,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPES_VULNERABILITES,
  niveauAlerte,
  PREFIXE_RESUME_ALERTES,
  PRISE_EN_COMPTE_RESERVEE,
  ROLE_PRISE_EN_COMPTE_ALERTE,
  SYSTEM_ROLE_DEFS,
  type NiveauAlerte,
  type NiveauPriorite,
  RechercheAlertesVulnerabilites,
  resumeExploitationAlerte,
  resumeNombreLisible,
  type SituationFaille,
  titreNotificationAlerte,
  titreResumeAlertes,
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

describe('seuils (décision du RSSI du 18/11/2026 : « P1 et P2 exploitable sur les asset qui sont exposé directement sur internet »)', () => {
  const f = (priorite: NiveauPriorite, exploitable: boolean, exposee: boolean): FaitsSeuilAlerte => ({
    priorite,
    exploitable,
    exposee,
  });
  it.each<[string, FaitsSeuilAlerte, NiveauAlerte | null]>([
    ['P1 exposée et exploitable', f('P1', true, true), 'critique'],
    ['P1 interne seulement, non exploitable', f('P1', false, false), 'critique'],
    ['P2 exploitable et exposée : alerte simple', f('P2', true, true), 'simple'],
    ['P2 exposée mais non exploitable : rien', f('P2', false, true), null],
    ['P2 exploitable mais interne seulement (non exposée) : rien', f('P2', true, false), null],
    ['P2 ni exploitable ni exposée : rien', f('P2', false, false), null],
    ['P3 exploitable et exposée : rien', f('P3', true, true), null],
    ['P4 exploitable et exposée : rien', f('P4', true, true), null],
  ])('%s', (_cas, faits, n) => expect(niveauAlerte(faits)).toBe(n));

  it('alerte simple devenue hors règle (plus exposée ou plus exploitable) : close « sous le seuil », motif explicite', () => {
    const ouverte: AlerteExistante = { niveau: 'simple', etat: 'ouverte', empreinte: E };
    for (const faits of [f('P2', true, false), f('P2', false, true)]) {
      const niveau = niveauAlerte(faits);
      expect(niveau).toBeNull();
      expect(
        deciderAlerte(ouverte, { niveau, empreinte: null, situation: { priorite: 'P2', traitee: false } }),
      ).toEqual({ action: 'clore', motif: 'sous_le_seuil' });
    }
    expect(MOTIF_CLOTURE_ALERTE_LIBELLES.sous_le_seuil).toContain(
      'ni P1, ni P2 exploitable sur un actif exposé directement sur Internet',
    );
  });

  it('critique qui redescend en P2 hors règle : close ; en P2 exploitable et exposée : reste ouverte, simple', () => {
    const critique: AlerteExistante = { niveau: 'critique', etat: 'prise_en_compte', empreinte: E };
    const situation: SituationFaille = { priorite: 'P2', traitee: false };
    expect(deciderAlerte(critique, { niveau: niveauAlerte(f('P2', true, false)), empreinte: null, situation })).toEqual(
      {
        action: 'clore',
        motif: 'sous_le_seuil',
      },
    );
    expect(deciderAlerte(critique, { niveau: niveauAlerte(f('P2', true, true)), empreinte: E, situation })).toEqual({
      action: 'mettre_a_jour',
      niveau: 'simple',
      notifier: null,
      reprise: false,
    });
  });
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
      expect(NOTIFICATION_RUBRIQUES[t]?.rubrique).toBe('Vulnérabilités, Alertes');
    }
    expect(NOTIFICATION_RUBRIQUES.vulnerabilites_alerte_critique?.lien).toBe('/vulnerabilites/alertes');
    // Résumé des alertes simples : onglet filtré sur les alertes simples ouvertes.
    expect(NOTIFICATION_RUBRIQUES.vulnerabilites_alerte?.lien).toBe(LIEN_RESUME_ALERTES);
    expect(LIEN_RESUME_ALERTES).toBe('/vulnerabilites/alertes?niveau=simple&etat=ouverte');
  });

  it('résumé des alertes simples : leur nombre seulement, ni CVE ni nom', () => {
    expect(titreResumeAlertes(1)).toBe('Vulnérabilités : 1 nouvelle alerte');
    expect(titreResumeAlertes(37)).toBe('Vulnérabilités : 37 nouvelles alertes');
    expect(titreResumeAlertes(37)).not.toMatch(/CVE/);
    expect(MESSAGE_RESUME_ALERTES).not.toMatch(/CVE-|srv-|\.example|192\.0\.2/);
    expect(PREFIXE_RESUME_ALERTES).toBe('resume:');
  });

  it('prise en compte : rôle prédéfini « RSSI » seulement', () => {
    expect(ROLE_PRISE_EN_COMPTE_ALERTE).toBe('rssi');
    expect(SYSTEM_ROLE_DEFS[ROLE_PRISE_EN_COMPTE_ALERTE].name).toBe('RSSI');
    expect(PRISE_EN_COMPTE_RESERVEE).toBe('Seul le RSSI peut prendre en compte une alerte.');
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
