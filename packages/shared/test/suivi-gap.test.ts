/* Applications à intégrer (GAP) : liste de contrôle, états, avancement et questionnaire guidé de l'outil de suivi
   historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  AppGapModification,
  GuideGapCreation,
  POINTS_GAP,
  QUESTIONS_GAP,
  identifiantApp,
  identifiantEcartGap,
  identifiantExigence,
  lireAppGap,
  pointsGap,
  questionnaireGap,
  statsGap,
} from '../src/index.js';

const app = (o: Record<string, unknown> = {}) => lireAppGap({ id: 'APP01', name: 'Application fictive', ...o })!;
const aucune = new Set<string>();

describe('liste de contrôle', () => {
  it('26 points au socle ; HDS masqué sans DSCP, nuage masqué si l’application n’en est pas un', () => {
    expect(POINTS_GAP).toHaveLength(26);
    expect(pointsGap(app({ dscp: 'Oui', cloud: 'Oui' }))).toHaveLength(26);
    expect(pointsGap(app({ dscp: 'À qualifier', cloud: 'À qualifier' }))).toHaveLength(26);
    // DSCP = Non : G02, G04 et G20 à G26 (9 points) disparaissent.
    expect(pointsGap(app({ dscp: 'Non', cloud: 'Oui' }))).toHaveLength(17);
    expect(pointsGap(app({ dscp: 'Oui', cloud: 'Non' }))).toHaveLength(25);
  });
  it('ajoute les points personnalisés après le socle', () => {
    const a = app({ dscp: 'Non', cloud: 'Non', custom: [{ id: 'C1', refs: ['A-8.24'], t: 'Point ajouté' }] });
    const l = pointsGap(a);
    expect(l.at(-1)).toMatchObject({ id: 'C1', custom: true, sec: 'per' });
    expect(l).toHaveLength(16 + 1);
  });
});

describe('états et avancement', () => {
  it('état saisi, sinon « Non applicable » si toutes les exigences sont exclues de la DdA, sinon « À évaluer »', () => {
    const a = app({ dscp: 'Non', cloud: 'Non', lines: { G07: { st: 'Conforme' } } });
    const s = statsGap(a, new Set(['A-5.12', 'ISO-4.3']));
    expect(s.c.Conforme).toBe(1);
    expect(s.c['Non applicable']).toBe(2); // G08 (A-5.12) et G01 (ISO-4.3)
    expect(s.n).toBe(16);
    expect(s.applicables).toBe(14);
    expect(s.pct).toBe(7);
  });
  it('points ouverts : partiels et non conformes', () => {
    const a = app({
      dscp: 'Non',
      cloud: 'Non',
      lines: { G01: { st: 'Partiel' }, G03: { st: 'Non conforme' }, G05: { st: 'Conforme' } },
    });
    expect(statsGap(a, aucune)).toMatchObject({ ouverts: 2, pct: 6 });
  });
  it('aucune division par zéro sans point applicable', () => {
    const a = app({ dscp: 'Non', cloud: 'Non' });
    const tous = new Set(POINTS_GAP.flatMap((p) => p.refs));
    expect(statsGap(a, tous)).toMatchObject({ applicables: 0, pct: 0 });
  });
});

describe('références et identifiants', () => {
  it('normalise les saisies libres', () => {
    expect(identifiantExigence('A.8.24')).toBe('A-8.24');
    expect(identifiantExigence('Annexe A 5.15')).toBe('A-5.15');
    expect(identifiantExigence('EXI 15')).toBe('HDS-15');
    expect(identifiantExigence('HDS 7')).toBe('HDS-07');
    expect(identifiantExigence('6.1.2')).toBe('ISO-6.1.2');
    expect(identifiantExigence('clause 9')).toBe('ISO-9');
    expect(identifiantExigence('n’importe quoi')).toBeNull();
  });
  it('premier numéro libre', () => {
    expect(identifiantApp([])).toBe('APP01');
    expect(identifiantApp(['APP01', 'APP03'])).toBe('APP02');
    expect(identifiantEcartGap(['GAP-01', 'GAP-02'])).toBe('GAP-03');
  });
});

describe('questionnaire guidé', () => {
  it('16 questions', () => expect(QUESTIONS_GAP).toHaveLength(16));
  it('sans réponse : seuls les deux points communs sont ajoutés, aucune pré-évaluation', () => {
    const r = questionnaireGap({});
    expect(r.custom.map((c) => c.t)).toEqual([
      'Inclure l’application au programme d’audit interne',
      'Former et sensibiliser les utilisateurs et les administrateurs',
    ]);
    expect(r.st).toEqual({});
    expect(r).toMatchObject({ dscp: 'À qualifier', cloud: 'Non', saas: false, fournisseur: false });
  });
  it('MFA et SSO : non conforme l’emporte, puis partiel, puis conforme', () => {
    expect(questionnaireGap({ mfa: 'Non disponible', sso: 'Disponible et activée' }).st.G10).toBe('Non conforme');
    expect(questionnaireGap({ mfa: 'Disponible, non activée', sso: 'Disponible et activée' }).st.G10).toBe('Partiel');
    expect(questionnaireGap({ mfa: 'Disponible et activée', sso: 'Disponible et activée' }).st.G10).toBe('Conforme');
    expect(questionnaireGap({ mfa: 'Inconnu', sso: 'Disponible et activée' }).st.G10).toBeUndefined();
  });
  it('service SaaS avec DSCP hébergé hors Union européenne, sans certificat HDS', () => {
    const r = questionnaireGap({
      type: 'SaaS (hébergé par l’éditeur)',
      dscp: 'Oui',
      loc: 'Hors Union européenne',
      certs: ['ISO 27001'],
      logs: 'Non',
      expo: 'Accessible depuis internet',
      crit: 'Critique : arrêt de moins de 4 h tolérable',
    });
    expect(r).toMatchObject({ dscp: 'Oui', cloud: 'Oui', saas: true, fournisseur: true });
    expect(r.st).toMatchObject({ G25: 'Non conforme', G21: 'Non conforme', G14: 'Non conforme' });
    const textes = r.custom.map((c) => c.t).join('|');
    expect(textes).toContain('analyse d’impact (AIPD)');
    expect(textes).toContain('contrat de sous-traitance conforme à l’article 28');
    expect(textes).toContain('transferts de données hors de l’Union européenne');
    expect(textes).toContain('test d’intrusion');
    expect(textes).toContain('RTO, RPO), intégrer au PCA et au PRA');
    const transfert = r.custom.find((c) => c.t.includes('transferts'))!;
    expect(r.st[transfert.id]).toBe('Non conforme');
  });
  it('service hébergé et administré par l’organisme : G21 non applicable', () => {
    const r = questionnaireGap({ type: 'Hébergé par le GCS, administré par le GCS', dscp: 'Oui', tma: 'Non' });
    expect(r.st.G21).toBe('Non applicable');
    expect(r.fournisseur).toBe(false);
  });
  it('identifiants Q1, Q2… dans l’ordre d’ajout', () => {
    const r = questionnaireGap({ dcp: 'Oui', ia: 'Oui' });
    expect(r.custom.map((c) => c.id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });
});

describe('requêtes', () => {
  it('modification : statuts et qualifications bornés, champ inconnu refusé', () => {
    expect(AppGapModification.safeParse({ status: 'Intégrée', dscp: 'Oui', target: '2026-12-01' }).success).toBe(true);
    expect(AppGapModification.safeParse({ status: 'Autre' }).success).toBe(false);
    expect(AppGapModification.safeParse({ inconnu: 1 }).success).toBe(false);
    expect(AppGapModification.safeParse({ name: '' }).success).toBe(false);
  });
  it('questionnaire : nom obligatoire', () => {
    expect(
      GuideGapCreation.safeParse({ name: 'Service fictif', answers: { dscp: 'Oui', certs: ['HDS'] } }).success,
    ).toBe(true);
    expect(GuideGapCreation.safeParse({ name: '' }).success).toBe(false);
  });
});
