/* Déclaration réglementaire des incidents (ADR 0105) : délais, propositions, rubriques et leur source, pré-remplissage,
   compte à rebours, jalons des rappels, schémas d'échange et identité de l'établissement. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  CorrectionQualification,
  ETAPES_PAR_REGIME,
  EnvoiDeclaration,
  IDENTITE_ETABLISSEMENT_VIDE,
  IdentiteEtablissement,
  MiseAlEcartDeclaration,
  NOTIFICATION_RUBRIQUES,
  OuvertureDeclaration,
  PreparationDeclaration,
  SETTINGS_SCHEMAS,
  SETTINGS_SECTIONS,
  SETTINGS_WRITE,
  compteARebours,
  declarationFigee,
  declarationsProposees,
  delaiDeclaration,
  dureeLisible,
  jalonRappel,
  lienDeclarationIncident,
  messageRappelDeclaration,
  plusUnMois,
  preremplissage,
  rubriquesDeclaration,
  rubriquesRemplies,
  titreRappelDeclaration,
  type ContextePreremplissage,
} from '../src/index.js';

const H = 3_600_000;
const Q = '2026-11-18T09:30:00.000Z';
const q = Date.parse(Q);
const at = (h: number) => new Date(q + h * H);

describe('délais', () => {
  it('alerte précoce + 24 h, notification + 72 h, depuis la qualification', () => {
    const r = { qualifieeLe: Q, notificationEnvoyeeLe: null };
    expect(delaiDeclaration('nis2', 'alerte_precoce', r)).toEqual({ depart: Q, echeance: '2026-11-19T09:30:00.000Z' });
    expect(delaiDeclaration('nis2', 'notification', r)).toEqual({ depart: Q, echeance: '2026-11-21T09:30:00.000Z' });
  });
  it('rapport final : un mois calendaire après l’envoi de la notification, sinon pas d’échéance', () => {
    expect(delaiDeclaration('nis2', 'rapport_final', { qualifieeLe: Q, notificationEnvoyeeLe: null })).toEqual({
      depart: null,
      echeance: null,
    });
    expect(
      delaiDeclaration('nis2', 'rapport_final', { qualifieeLe: Q, notificationEnvoyeeLe: '2026-11-20T08:00:00.000Z' }),
    ).toEqual({ depart: '2026-11-20T08:00:00.000Z', echeance: '2026-12-20T08:00:00.000Z' });
  });
  it('santé : départ à la qualification, aucune échéance chiffrée ; complément sans délai', () => {
    expect(delaiDeclaration('sante', 'signalement', { qualifieeLe: Q, notificationEnvoyeeLe: null })).toEqual({
      depart: Q,
      echeance: null,
    });
    expect(delaiDeclaration('nis2', 'complement', { qualifieeLe: Q, notificationEnvoyeeLe: Q })).toEqual({
      depart: null,
      echeance: null,
    });
  });
  it('sans date de qualification, pas de délai', () => {
    expect(delaiDeclaration('nis2', 'alerte_precoce', { qualifieeLe: null, notificationEnvoyeeLe: null })).toEqual({
      depart: null,
      echeance: null,
    });
  });
  it('un mois calendaire : fin de mois ramenée au dernier jour, passage d’année', () => {
    expect(plusUnMois('2027-01-31T10:00:00.000Z')).toBe('2027-02-28T10:00:00.000Z');
    expect(plusUnMois('2028-01-31T10:00:00.000Z')).toBe('2028-02-29T10:00:00.000Z');
    expect(plusUnMois('2026-12-15T23:59:00.000Z')).toBe('2027-01-15T23:59:00.000Z');
    expect(plusUnMois('2026-03-31T00:00:00.000Z')).toBe('2026-04-30T00:00:00.000Z');
  });
});

describe('propositions à la qualification', () => {
  it('santé si données de santé ou HDS touchées (« oui » ou « je ne sais pas »)', () => {
    expect(declarationsProposees({ sante: 'oui' }, '')).toEqual([{ regime: 'sante', etape: 'signalement' }]);
    expect(declarationsProposees({ sante: 'nsp' }, 'hors_champ')).toEqual([{ regime: 'sante', etape: 'signalement' }]);
    expect(declarationsProposees({ sante: 'non' }, '')).toEqual([]);
    expect(declarationsProposees({}, '')).toEqual([]);
  });
  it('NIS 2 (trois étapes) si entité essentielle ou importante', () => {
    for (const cat of ['essentielle', 'importante'])
      expect(declarationsProposees({}, cat)).toEqual([
        { regime: 'nis2', etape: 'alerte_precoce' },
        { regime: 'nis2', etape: 'notification' },
        { regime: 'nis2', etape: 'rapport_final' },
      ]);
    expect(declarationsProposees({ sante: 'oui' }, 'importante')).toHaveLength(4);
    expect(declarationsProposees({}, 'hors_champ')).toEqual([]);
  });
});

describe('rubriques', () => {
  it('chaque étape a ses rubriques, chacune avec sa source', () => {
    for (const [regime, etapes] of Object.entries(ETAPES_PAR_REGIME))
      for (const etape of [...etapes, 'complement' as const]) {
        const l = rubriquesDeclaration(regime as 'sante', etape);
        expect(l.length, `${regime}/${etape}`).toBeGreaterThan(1);
        expect(new Set(l.map((x) => x.cle)).size).toBe(l.length);
        for (const x of l) {
          expect(x.libelle.length).toBeGreaterThan(3);
          expect(x.source.length).toBeGreaterThan(20);
        }
      }
  });
  it('NIS 2 : article 23 de la directive ; santé : la liste de l’ADR', () => {
    const cles = (r: 'sante' | 'nis2', e: Parameters<typeof rubriquesDeclaration>[1]) =>
      rubriquesDeclaration(r, e).map((x) => x.cle);
    expect(cles('nis2', 'alerte_precoce')).toEqual(['identite', 'malveillance', 'transfrontiere']);
    expect(cles('nis2', 'notification')).toEqual([
      'identite',
      'evaluation_initiale',
      'gravite',
      'impact',
      'indicateurs',
    ]);
    expect(cles('nis2', 'rapport_final')).toEqual([
      'identite',
      'description_detaillee',
      'cause',
      'mesures',
      'transfrontiere',
    ]);
    expect(cles('sante', 'signalement')).toEqual([
      'identite',
      'description',
      'date_detection',
      'consequences_patients',
      'mesures',
    ]);
    expect(rubriquesDeclaration('nis2', 'alerte_precoce')[1]!.source).toMatch(/article 23, paragraphe 4, point a\)/);
    expect(rubriquesDeclaration('nis2', 'rapport_final')[2]!.source).toMatch(/point d\) ii\)/);
    expect(rubriquesDeclaration('sante', 'signalement')[1]!.source).toMatch(/L\. 1111-8-2/);
  });
});

describe('pré-remplissage', () => {
  const ctx: ContextePreremplissage = {
    incident: {
      id: 'INC-2026-901',
      title: 'Rançongiciel fictif',
      desc: 'Postes chiffrés (fictif).',
      detectedAt: '2026-11-18T08:05',
      actions: 'Isolement du réseau.',
      cause: 'Pièce jointe piégée.',
      impact: 'Élevé',
      urgency: 'Moyen',
      timeline: [
        {
          id: 'EV-001',
          ts: '2026-11-18T08:05',
          type: 'Détection',
          titre: 'Alerte EDR',
          description: '',
          acteur: '',
          gravite: '',
          source: '',
          apport: '',
        },
      ],
    },
    identite: {
      ...IDENTITE_ETABLISSEMENT_VIDE,
      raisonSociale: 'Établissement fictif',
      finessJuridique: '990000001',
      arsRattachement: 'ARS fictive',
      contactNom: 'Personne fictive',
      contactFonction: 'RSSI',
      contactCourriel: 'rssi@exemple.example',
      secteurNis2: 'Santé',
    },
    categorieEntite: 'essentielle',
  };
  it('santé : identité (ARS, sans secteur NIS 2), description, détection, mesures ; rien d’inventé', () => {
    const v = preremplissage('sante', 'signalement', ctx);
    expect(v.identite).toBe(
      [
        'Raison sociale : Établissement fictif',
        'FINESS juridique : 990000001',
        'ARS de rattachement : ARS fictive',
        'Contact de signalement : Personne fictive, RSSI',
        'Courriel : rssi@exemple.example',
      ].join('\n'),
    );
    expect(v.description).toBe('Rançongiciel fictif\nPostes chiffrés (fictif).');
    expect(v.date_detection).toBe('18/11/2026 08:05');
    expect(v.consequences_patients).toBe('');
    expect(v.mesures).toBe('Isolement du réseau.');
    expect(Object.keys(v)).toEqual(rubriquesDeclaration('sante', 'signalement').map((x) => x.cle));
  });
  it('NIS 2 : secteur et catégorie, gravité, chronologie dans le rapport final', () => {
    expect(preremplissage('nis2', 'alerte_precoce', ctx).identite).toContain('Catégorie (NIS 2) : entité essentielle');
    expect(preremplissage('nis2', 'alerte_precoce', ctx).identite).not.toContain('ARS');
    expect(preremplissage('nis2', 'alerte_precoce', ctx).malveillance).toBe('');
    expect(preremplissage('nis2', 'notification', ctx).gravite).toBe(
      'Priorité : P2 Haute\nImpact : Élevé\nUrgence : Moyen',
    );
    const rf = preremplissage('nis2', 'rapport_final', ctx);
    expect(rf.description_detaillee).toContain('Chronologie :\n18/11/2026 08:05 — Alerte EDR');
    expect(rf.cause).toBe('Pièce jointe piégée.');
  });
  it('identité vide : rubrique vide', () => {
    expect(preremplissage('sante', 'signalement', { ...ctx, identite: IDENTITE_ETABLISSEMENT_VIDE }).identite).toBe('');
  });
  it('complément : déclaration complétée et sa référence', () => {
    const v = preremplissage('sante', 'complement', {
      ...ctx,
      liee: { etape: 'signalement', envoyeeLe: '2026-11-18T10:00:00.000Z', reference: 'AR-0001' },
    });
    expect(v.declaration_completee).toBe(
      'Signalement de l’incident INC-2026-901\nEnvoyée le 18/11/2026 à 11:00\nRéférence : AR-0001',
    );
  });
  it('la saisie l’emporte sur la valeur pré-remplie, même vide', () => {
    const l = rubriquesRemplies('sante', 'signalement', { mesures: '' }, preremplissage('sante', 'signalement', ctx));
    expect(l.find((x) => x.cle === 'mesures')).toMatchObject({ valeur: '', modifiee: true });
    expect(l.find((x) => x.cle === 'description')).toMatchObject({ modifiee: false });
  });
});

describe('compte à rebours', () => {
  const nis2 = (statut: 'proposee' | 'envoyee' = 'proposee') => ({
    regime: 'nis2' as const,
    etape: 'alerte_precoce' as const,
    statut,
    echeance: '2026-11-19T09:30:00.000Z',
  });
  it('à venir, proche (2 heures), dépassée ; rien pour une déclaration figée', () => {
    expect(compteARebours(nis2(), at(1))).toEqual({
      etat: 'a_venir',
      libelle: 'Reste 23 h 00 (échéance le 19/11/2026 à 10:30)',
    });
    expect(compteARebours(nis2(), at(22.5))?.etat).toBe('proche');
    expect(compteARebours(nis2(), at(25))).toMatchObject({ etat: 'depassee', libelle: 'Échéance dépassée de 1 h 00' });
    expect(compteARebours(nis2('envoyee'), at(1))).toBeNull();
  });
  it('santé sans délai ; rapport final en attente de la notification ; qualification inconnue', () => {
    expect(
      compteARebours({ regime: 'sante', etape: 'signalement', statut: 'a_declarer', echeance: null }, at(1))?.etat,
    ).toBe('sans_delai');
    expect(
      compteARebours({ regime: 'nis2', etape: 'rapport_final', statut: 'proposee', echeance: null }, at(1)),
    ).toEqual({
      etat: 'sans_echeance',
      libelle: 'Échéance fixée à l’envoi de la notification',
    });
    expect(
      compteARebours({ regime: 'nis2', etape: 'notification', statut: 'proposee', echeance: null }, at(1))?.libelle,
    ).toBe('Date de qualification à renseigner');
  });
  it('durées lisibles', () => {
    expect(dureeLisible(12 * 60_000)).toBe('12 min');
    expect(dureeLisible(5 * H + 7 * 60_000)).toBe('5 h 07');
    expect(dureeLisible(52 * H)).toBe('2 j 4 h');
  });
});

describe('jalons des rappels', () => {
  const base = {
    id: 'd1',
    regime: 'nis2' as const,
    etape: 'alerte_precoce' as const,
    statut: 'proposee' as const,
    origine: 'proposition' as const,
    depart: Q,
    echeance: '2026-11-19T09:30:00.000Z',
    creeLe: Q,
  };
  const dep = Math.floor(q / 1000);
  it('NIS 2 : qualification, mi-délai, 2 heures avant, dépassement ; le plus récent seulement', () => {
    expect(jalonRappel(base, at(-1))).toBeNull();
    expect(jalonRappel(base, at(0.1))?.cle).toBe('d1:qualification');
    expect(jalonRappel(base, at(12))?.cle).toBe(`d1:mi-delai:${dep}`);
    expect(jalonRappel(base, at(21.9))?.cle).toBe(`d1:mi-delai:${dep}`);
    expect(jalonRappel(base, at(22))).toMatchObject({ cle: `d1:preavis:${dep}`, libelle: 'échéance dans 2 heures' });
    expect(jalonRappel(base, at(24))).toMatchObject({ cle: `d1:depassement:${dep}`, libelle: 'échéance dépassée' });
    expect(jalonRappel(base, at(100))?.cle).toBe(`d1:depassement:${dep}`);
  });
  it('notification : mi-délai à 36 heures', () => {
    const n = { ...base, etape: 'notification' as const, echeance: '2026-11-21T09:30:00.000Z' };
    expect(jalonRappel(n, at(35.9))?.cle).toBe('d1:qualification');
    expect(jalonRappel(n, at(36))?.cle).toBe(`d1:mi-delai:${dep}`);
  });
  it('santé : qualification puis toutes les 4 heures', () => {
    const s = { ...base, regime: 'sante' as const, etape: 'signalement' as const, echeance: null };
    expect(jalonRappel(s, at(3.9))?.cle).toBe('d1:qualification');
    expect(jalonRappel(s, at(4))).toMatchObject({ cle: `d1:relance-1:${dep}`, libelle: 'à signaler sans délai' });
    expect(jalonRappel(s, at(11.9))?.cle).toBe(`d1:relance-2:${dep}`);
    // Ouverte à la main : pas de rappel « à examiner », les relances seulement.
    expect(jalonRappel({ ...s, origine: 'manuelle' }, at(1))).toBeNull();
    expect(jalonRappel({ ...s, origine: 'manuelle' }, at(4))?.cle).toBe(`d1:relance-1:${dep}`);
  });
  it('rien pour une déclaration figée, un complément ; date corrigée : rappels réarmés, dépassement pas masqué', () => {
    expect(jalonRappel({ ...base, statut: 'envoyee' }, at(30))).toBeNull();
    expect(jalonRappel({ ...base, statut: 'non_requise' }, at(30))).toBeNull();
    expect(jalonRappel({ ...base, etape: 'complement', depart: null, echeance: null }, at(30))).toBeNull();
    // Qualification reculée de 30 heures après la proposition : l'échéance est dépassée, c'est ce rappel qui part.
    const recul = { ...base, depart: new Date(q - 30 * H).toISOString(), echeance: new Date(q - 6 * H).toISOString() };
    expect(jalonRappel(recul, at(0.1))?.cle).toBe(`d1:depassement:${Math.floor((q - 30 * H) / 1000)}`);
  });
  it('rapport final sans notification envoyée : le seul rappel « à examiner »', () => {
    const rf = { ...base, etape: 'rapport_final' as const, depart: null, echeance: null };
    expect(jalonRappel(rf, at(500))?.cle).toBe('d1:qualification');
  });
});

describe('notifications', () => {
  it('titre sans régime ni contenu ; message et lien', () => {
    expect(titreRappelDeclaration('INC-2026-901', 'mi-délai atteint')).toBe(
      'Déclaration réglementaire de l’incident INC-2026-901 : mi-délai atteint',
    );
    expect(messageRappelDeclaration('nis2', 'alerte_precoce', '2026-11-19T09:30:00.000Z')).toBe(
      'NIS 2 (ANSSI), alerte précoce : échéance le 19/11/2026 à 10:30. Ouvrez la fiche de l’incident, bloc « Déclarations ».',
    );
    expect(messageRappelDeclaration('sante', 'signalement', null)).toMatch(/sans délai/);
    expect(lienDeclarationIncident('00000000-0000-4000-8000-000000000001', 'INC-2026-901')).toBe(
      '/pilotage/incidents-registre?perimetre=00000000-0000-4000-8000-000000000001&incident=INC-2026-901',
    );
    expect(NOTIFICATION_RUBRIQUES.incident_declaration?.lien).toBe('/pilotage/incidents-registre');
  });
});

describe('échanges et réglages', () => {
  it('ouverture : étape propre au régime', () => {
    expect(OuvertureDeclaration.safeParse({ regime: 'sante', etape: 'signalement' }).success).toBe(true);
    expect(OuvertureDeclaration.safeParse({ regime: 'sante', etape: 'notification' }).success).toBe(false);
    expect(OuvertureDeclaration.safeParse({ regime: 'nis2', etape: 'complement' }).success).toBe(false);
  });
  it('motif et référence obligatoires ; date de qualification avec fuseau', () => {
    expect(MiseAlEcartDeclaration.safeParse({ motif: '  ' }).success).toBe(false);
    expect(MiseAlEcartDeclaration.safeParse({ motif: 'Non important' }).success).toBe(true);
    expect(EnvoiDeclaration.safeParse({ reference: '' }).success).toBe(false);
    expect(PreparationDeclaration.safeParse({ rubriques: { 'Hors liste': 'x' } }).success).toBe(false);
    expect(PreparationDeclaration.safeParse({ rubriques: { mesures: null }, reference: 'D-1' }).success).toBe(true);
    expect(CorrectionQualification.safeParse({ qualifieeLe: '2026-11-18T09:30' }).success).toBe(false);
    expect(CorrectionQualification.safeParse({ qualifieeLe: '2026-11-18T09:30:00+01:00' }).success).toBe(true);
  });
  it('statuts figés', () => {
    expect(declarationFigee('envoyee')).toBe(true);
    expect(declarationFigee('non_requise')).toBe(true);
    expect(declarationFigee('a_declarer')).toBe(false);
  });
  it('identité de l’établissement : section de paramètres, vide par défaut, FINESS sur 9 caractères', () => {
    expect(SETTINGS_SECTIONS.at(-1)).toBe('etablissement');
    expect(SETTINGS_SCHEMAS.etablissement).toBe(IdentiteEtablissement);
    expect(SETTINGS_WRITE.etablissement).toBe('parametres:modifier');
    expect(Object.values(IDENTITE_ETABLISSEMENT_VIDE).every((v) => v === '')).toBe(true);
    expect(IdentiteEtablissement.safeParse(IDENTITE_ETABLISSEMENT_VIDE).success).toBe(true);
    for (const f of ['990000001', '2A0000001', '2B0000001'])
      expect(IdentiteEtablissement.safeParse({ ...IDENTITE_ETABLISSEMENT_VIDE, finessJuridique: f }).success).toBe(
        true,
      );
    for (const f of ['99000000', '2C0000001', 'ABCDEFGHI'])
      expect(IdentiteEtablissement.safeParse({ ...IDENTITE_ETABLISSEMENT_VIDE, finessJuridique: f }).success).toBe(
        false,
      );
  });
});
