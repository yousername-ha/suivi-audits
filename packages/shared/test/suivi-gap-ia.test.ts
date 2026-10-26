import { describe, expect, it } from 'vitest';
import {
  CAS_IA,
  POINTS_GAP,
  QUESTIONS_GAP_IA,
  etatPointGap,
  lireAppGap,
  pointsGap,
  questionnaireGapIa,
  questionsIaVisibles,
  statsGap,
} from '../src/suivi-gap.js';

const REF = /^(A-\d+\.\d+|ISO-\d+(\.\d+)*|HDS-\d+)$/;
const point = (r: ReturnType<typeof questionnaireGapIa>, refs: string[]) =>
  r.custom.find((p) => refs.every((x) => p.refs.includes(x)))!;
const etat = (r: ReturnType<typeof questionnaireGapIa>, refs: string[]) => r.st[point(r, refs).id];

describe('GAP IA (ADR 0064)', () => {
  it('sans cas d’usage : seulement le socle de gouvernance, aucun point d’un cas d’usage, rien n’est supposé', () => {
    const r = questionnaireGapIa({});
    expect(r.custom.map((p) => p.refs[0])).toEqual([
      'A-5.9',
      'A-5.10',
      'A-6.3',
      'ISO-6.1.2',
      'A-5.31',
      'A-5.34',
      'A-8.15',
    ]);
    expect(r.st).toEqual({});
    expect(r.dscp).toBe('À qualifier');
  });

  it('les trois cas d’usage ajoutent leurs points, avec des identifiants uniques et des références connues', () => {
    const seul = (cas: string) => questionnaireGapIa({ iaCas: [cas] }).custom.length;
    const base = questionnaireGapIa({}).custom.length;
    expect(seul(CAS_IA.grandPublic)).toBe(base + 4);
    expect(seul(CAS_IA.metier)).toBe(base + 4 + 2); // contrat, relecture, paramétrage, surveillance + HDS (certificat, lieu)
    expect(seul(CAS_IA.code)).toBe(base + 5);
    const tous = questionnaireGapIa({ iaCas: Object.values(CAS_IA) });
    const ids = tous.custom.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of tous.custom) {
      expect(p.t.length).toBeGreaterThan(20);
      for (const ref of p.refs) expect(ref, p.t).toMatch(REF);
    }
  });

  it('le GAP IA n’a pas le socle d’intégration d’une application : seulement ses points propres', () => {
    const r = questionnaireGapIa({ iaCas: Object.values(CAS_IA) });
    const app = { dscp: r.dscp, cloud: r.cloud, custom: r.custom, modele: 'ia' as const };
    expect(pointsGap(app)).toHaveLength(r.custom.length);
    expect(pointsGap(app).every((p) => p.custom)).toBe(true);
    expect(pointsGap({ ...app, modele: 'application' }).length).toBeGreaterThan(POINTS_GAP.length - 1);
    // Les statistiques ne comptent que les points du GAP IA.
    expect(statsGap({ ...app, lines: {} }, new Set()).n).toBe(r.custom.length);
  });

  it('outils grand public : comptes personnels, aucun filtrage et saisie déjà constatée donnent des écarts', () => {
    const r = questionnaireGapIa({
      iaCas: [CAS_IA.grandPublic],
      gpComptes: 'Comptes personnels',
      gpFiltrage: 'Non',
      gpContrat: 'Oui ou non garanti',
      gpIncident: 'Oui',
    });
    expect(etat(r, ['A-8.12'])).toBe('Non conforme');
    expect(etat(r, ['A-5.19', 'A-5.20', 'A-5.23'])).toBe('Non conforme');
    expect(etat(r, ['A-5.26'])).toBe('Non conforme');
    expect(etat(r, ['A-8.15', 'A-8.16'])).toBe('Non conforme');
  });

  it('outils grand public : comptes professionnels sous contrat et outils filtrés sont conformes ; supervision seule est partielle', () => {
    const bon = questionnaireGapIa({
      iaCas: [CAS_IA.grandPublic],
      gpComptes: 'Comptes professionnels fournis et contractualisés',
      gpContrat: 'Non, exclu par contrat',
      gpFiltrage: 'Bloqués ou filtrés',
    });
    expect(etat(bon, ['A-5.19', 'A-5.20', 'A-5.23'])).toBe('Conforme');
    expect(etat(bon, ['A-8.12'])).toBe('Conforme');
    const partiel = questionnaireGapIa({ iaCas: [CAS_IA.grandPublic], gpFiltrage: 'Supervisés sans blocage' });
    expect(etat(partiel, ['A-8.12'])).toBe('Partiel');
  });

  it('« Inconnu » ou une absence de réponse ne tranche jamais', () => {
    const r = questionnaireGapIa({
      iaCas: Object.values(CAS_IA),
      iaInventaire: 'Inconnu',
      iaRegle: 'Inconnu',
      gpComptes: 'Inconnu',
      gpFiltrage: 'Inconnu',
      lmHds: 'Inconnu',
      lmLieu: 'Inconnu',
      codeRevue: 'Inconnu',
      codeCritique: 'Inconnu',
      codeOutils: 'Inconnu',
    });
    expect(r.st).toEqual({});
  });

  it('logiciel métier : données de santé possibles sans certificat HDS ni hébergement dans l’UE, réutilisation des données', () => {
    const r = questionnaireGapIa({
      iaCas: [CAS_IA.metier],
      iaDscp: 'Oui, constaté',
      lmEntrainement: 'Oui',
      lmHds: 'Non',
      lmLieu: 'Hors Union européenne',
      lmRelecture: 'Parfois',
    });
    expect(r.dscp).toBe('Oui');
    expect(etat(r, ['HDS-12'])).toBe('Non conforme');
    expect(etat(r, ['HDS-28'])).toBe('Non conforme');
    expect(etat(r, ['A-5.19', 'A-5.20', 'A-5.23'])).toBe('Non conforme');
    expect(etat(r, ['A-5.10', 'ISO-8.1'])).toBe('Partiel');
  });

  it('logiciel métier : si les données de santé sont bloquées, pas de point HDS, mais un transfert hors UE reste un écart RGPD', () => {
    const r = questionnaireGapIa({
      iaCas: [CAS_IA.metier],
      iaDscp: 'Non, bloqué techniquement',
      lmLieu: 'Hors Union européenne',
    });
    expect(r.dscp).toBe('Non');
    expect(r.custom.some((p) => p.refs.some((x) => x.startsWith('HDS-')))).toBe(false);
    // Données de santé bloquées : plus de point de registre / AIPD, seul reste le transfert hors de l’UE.
    expect(r.custom.filter((p) => p.refs.includes('A-5.34'))).toHaveLength(1);
    const transfert = r.custom.find((p) => p.t.startsWith('Encadrer ou exclure les transferts'))!;
    expect(r.st[transfert.id]).toBe('Non conforme');
  });

  it('certificat HDS déclaré mais non vérifié : constat sans état', () => {
    const r = questionnaireGapIa({
      iaCas: [CAS_IA.metier],
      iaDscp: 'Possible, non maîtrisé',
      lmHds: 'Oui, déclaré non vérifié',
    });
    const p = point(r, ['HDS-12']);
    expect(r.st[p.id]).toBeUndefined();
    expect(r.cm[p.id]).toContain('vérifier');
  });

  it('code généré par IA : modules critiques, relecture partielle et comptes personnels', () => {
    const r = questionnaireGapIa({
      iaCas: [CAS_IA.code],
      codeCritique: 'Oui',
      codeRevue: 'Partiellement',
      codeOutils: 'Les deux',
    });
    expect(etat(r, ['A-8.26', 'A-8.28'])).toBe('Non conforme');
    expect(etat(r, ['A-8.28', 'A-8.29'])).toBe('Partiel');
    expect(etat(r, ['A-5.19', 'A-8.4'])).toBe('Non conforme');
    const ok = questionnaireGapIa({
      iaCas: [CAS_IA.code],
      codeCritique: 'Non',
      codeRevue: 'Oui, systématiquement',
      codeOutils: 'Fournis et contractualisés',
    });
    expect(Object.values(ok.st).every((x) => x === 'Conforme')).toBe(true);
  });

  it('la gouvernance est pré-évaluée par les réponses', () => {
    const mauvais = questionnaireGapIa({
      iaInventaire: 'Non',
      iaRegle: 'Non',
      iaSensibilisation: 'Non',
      iaRisques: 'Non',
    });
    expect(Object.values(mauvais.st)).toEqual(['Non conforme', 'Non conforme', 'Non conforme', 'Non conforme']);
    const bon = questionnaireGapIa({
      iaInventaire: 'Oui, à jour',
      iaRegle: 'Oui, diffusée aux agents',
      iaSensibilisation: 'Oui, dans les 12 derniers mois',
      iaRisques: 'Oui',
    });
    expect(Object.values(bon.st)).toEqual(['Conforme', 'Conforme', 'Conforme', 'Conforme']);
    const app = lireAppGap({
      id: 'APP01',
      modele: 'ia',
      custom: bon.custom,
      lines: Object.fromEntries(Object.entries(bon.st).map(([k, st]) => [k, { st }])),
    })!;
    expect(app.modele).toBe('ia');
    expect(etatPointGap(app, pointsGap(app)[0]!, new Set())).toBe('Conforme');
    expect(lireAppGap({ id: 'APP02' })!.modele).toBe('application');
  });

  it('les questions d’un cas d’usage ne s’affichent que si ce cas est choisi', () => {
    expect(questionsIaVisibles({}).map((q) => q.k)).toEqual([
      'iaCas',
      'iaDscp',
      'iaInventaire',
      'iaRegle',
      'iaSensibilisation',
      'iaRisques',
    ]);
    expect(questionsIaVisibles({ iaCas: [CAS_IA.grandPublic] })).toHaveLength(6 + 4);
    expect(questionsIaVisibles({ iaCas: Object.values(CAS_IA) })).toHaveLength(QUESTIONS_GAP_IA.length);
    for (const q of QUESTIONS_GAP_IA) expect(new Set(q.o).size, q.k).toBe(q.o.length);
  });
});
