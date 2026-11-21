/* Veille réglementaire (ADR 0110) : liste fermée des sources, domaines, rôles de qualification, schémas des éléments
   rapportés par l'exécutant (ANSSI sans résumé, lien en https sur l'hôte de la source, texte nettoyé), réglage et
   recherche ; ANS et Légifrance sans collecteur ; filtre d'EUR-Lex par mots-clés. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  domaineSelonMotsCles,
  elementPublication,
  estSourceCollectee,
  FREQUENCE_VEILLE_REGLEMENTAIRE_DEFAUT,
  frequenceReglementaireAdmise,
  lienPublicationValide,
  MOTS_CLES_EURLEX_DEFAUT,
  MotsClesEurLexBody,
  normaliserMotCle,
  QualificationBody,
  RecherchePublications,
  ReglageSourceReglementaire,
  DROIT_DPO,
  LECTURE_VEILLE_REGLEMENTAIRE,
  PERMISSIONS_RESERVEES,
  QUALIFICATION_SECURITE_ROLE,
  sourceReglementaire,
  SOURCES_REGLEMENTAIRES,
  SOURCES_REGLEMENTAIRES_DEFINITIONS,
  SOURCES_REGLEMENTAIRES_JOINTES,
  SYSTEM_ROLES,
} from '../src/index.js';

const element = (extra: Record<string, unknown> = {}) => ({
  identifiant: 'fictif-1',
  titre: 'Publication fictive',
  resume: 'Résumé fictif.',
  lien: 'https://www.cnil.fr/fictif/1',
  publieLe: '2026-11-20T08:00:00.000Z',
  ...extra,
});

describe('veille réglementaire : sources', () => {
  it('six sources, Légifrance et ANS prévues sans collecteur ni hôte', () => {
    expect(SOURCES_REGLEMENTAIRES).toEqual(['cnil', 'cepd', 'eur-lex', 'anssi', 'ans', 'legifrance']);
    expect(SOURCES_REGLEMENTAIRES_DEFINITIONS.map((s) => s.id)).toEqual([...SOURCES_REGLEMENTAIRES]);
    for (const s of ['legifrance', 'ans'] as const) {
      expect(estSourceCollectee(s)).toBe(false);
      expect(sourceReglementaire(s)).toMatchObject({ hote: null, chemin: null });
    }
    expect(sourceReglementaire('ans').reprise).toBe('Non disponible : aucun flux public connu.');
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.id)).toEqual(['cnil', 'cepd', 'eur-lex', 'anssi']);
  });
  it('hôtes et chemins décidés par le RSSI ; ANSSI sans résumé', () => {
    expect(SOURCES_REGLEMENTAIRES_JOINTES.map((s) => `https://${s.hote}${s.chemin}`)).toEqual([
      'https://www.cnil.fr/fr/rss.xml',
      'https://www.edpb.europa.eu/feed/publications_en',
      'https://eur-lex.europa.eu/EN/display-feed.rss?rssId=222',
      'https://cyber.gouv.fr/actualites/rss/',
    ]);
    expect(sourceReglementaire('anssi').resume).toBe(false);
    expect(sourceReglementaire('ans').resume).toBe(false);
    expect(sourceReglementaire('cnil').reprise).toMatch(/CC BY-ND/);
    expect(sourceReglementaire('cnil').domaine).toBe('donnees-personnelles');
    expect(sourceReglementaire('cepd').domaine).toBe('donnees-personnelles');
    expect(sourceReglementaire('anssi').domaine).toBe('securite');
  });
  it('qualification : rôle RSSI pour la sécurité, droit réservé « DPO » pour les données personnelles ; lecture par l’un ou l’autre', () => {
    expect(QUALIFICATION_SECURITE_ROLE).toBe('rssi');
    expect(SYSTEM_ROLES).toContain(QUALIFICATION_SECURITE_ROLE);
    expect(SYSTEM_ROLES).not.toContain('dpo');
    expect(DROIT_DPO).toBe('veille_reglementaire:dpo');
    expect(PERMISSIONS_RESERVEES).toContain(DROIT_DPO);
    expect(LECTURE_VEILLE_REGLEMENTAIRE).toEqual(['veille_reglementaire:lire', 'veille_reglementaire:dpo']);
  });
});

describe('veille réglementaire : éléments de l’exécutant', () => {
  it('lien : https, hôte exact, sans espace ni guillemet', () => {
    expect(lienPublicationValide('cnil', 'https://www.cnil.fr/fictif')).toBe(true);
    for (const l of [
      'http://www.cnil.fr/fictif',
      'https://www.cnil.fr.exemple.invalid/fictif',
      'https://cnil.fr/fictif',
      'https://www.cnil.fr',
      'https://www.cnil.fr/a b',
      'https://www.cnil.fr/"x"',
      'https://www.cnil.fr/<x>',
      `https://www.cnil.fr/${'a'.repeat(500)}`,
      'javascript:alert(1)',
    ])
      expect(lienPublicationValide('cnil', l), l).toBe(false);
    expect(lienPublicationValide('legifrance', 'https://www.legifrance.gouv.fr/x')).toBe(false);
  });
  it('schéma par source : résumé refusé pour l’ANSSI, lien d’une autre source refusé, champs stricts', () => {
    expect(elementPublication('cnil').safeParse(element()).success).toBe(true);
    expect(elementPublication('cnil').safeParse(element({ resume: null })).success).toBe(true);
    const anssi = element({ lien: 'https://cyber.gouv.fr/fictif/1' });
    expect(elementPublication('anssi').safeParse(anssi).success).toBe(false);
    expect(elementPublication('anssi').safeParse({ ...anssi, resume: null }).success).toBe(true);
    expect(elementPublication('cepd').safeParse(element()).success).toBe(false);
    for (const mauvais of [
      element({ titre: '' }),
      element({ titre: '<script>x</script>' }),
      element({ titre: 'T'.repeat(301) }),
      element({ resume: '' }),
      element({ resume: 'R'.repeat(1001) }),
      element({ resume: 'ligne\nligne' }),
      element({ publieLe: 'hier' }),
      element({ inattendu: 1 }),
    ])
      expect(elementPublication('cnil').safeParse(mauvais).success).toBe(false);
  });
});

describe('veille réglementaire : filtre d’EUR-Lex', () => {
  it('forme comparée : accents, casse et ponctuation ignorés (mêmes cas que le test du script)', () => {
    for (const [brut, attendu] of [
      ['Données  Personnelles', 'donnees personnelles'],
      ['CYBERSÉCURITÉ', 'cybersecurite'],
      ['sécurité de l’information', 'securite de l information'],
      ['Règlement (UE) 2024/1689', 'reglement ue 2024 1689'],
      ['  ', ''],
    ] as const)
      expect(normaliserMotCle(brut), brut).toBe(attendu);
  });
  it('domaine du mot trouvé, mot entier, données personnelles l’emporte', () => {
    const l = [...MOTS_CLES_EURLEX_DEFAUT];
    expect(domaineSelonMotsCles('Regulation (EU) on the Cybersecurity of connected products', l)).toBe('securite');
    expect(domaineSelonMotsCles('Directive on PERSONAL DATA', l)).toBe('donnees-personnelles');
    expect(domaineSelonMotsCles('Personal data and network and information security', l)).toBe('donnees-personnelles');
    expect(domaineSelonMotsCles('Règlement relatif aux données de santé', l)).toBe('donnees-personnelles');
    expect(domaineSelonMotsCles('Decision on fisheries quotas', l)).toBeNull();
    expect(domaineSelonMotsCles('Regulation on personal database tools', l)).toBeNull();
  });
  it('liste par défaut : français et anglais, deux domaines, bornes respectées', () => {
    expect(MotsClesEurLexBody.safeParse({ motsCles: [...MOTS_CLES_EURLEX_DEFAUT] }).success).toBe(true);
    const mots = MOTS_CLES_EURLEX_DEFAUT.map((m) => m.mot);
    for (const m of ['personal data', 'données personnelles', 'cybersecurity', 'cybersécurité', 'medical devices'])
      expect(mots).toContain(m);
    expect(new Set(MOTS_CLES_EURLEX_DEFAUT.map((m) => m.domaine))).toEqual(
      new Set(['securite', 'donnees-personnelles']),
    );
  });
  it('réglage : 1 à 60 mots de 2 à 60 caractères, sans doublon normalisé ; null rétablit la liste par défaut', () => {
    expect(MotsClesEurLexBody.safeParse({ motsCles: null }).success).toBe(true);
    expect(MotsClesEurLexBody.safeParse({ motsCles: [] }).success).toBe(false);
    expect(MotsClesEurLexBody.safeParse({ motsCles: [{ mot: 'x', domaine: 'securite' }] }).success).toBe(false);
    expect(MotsClesEurLexBody.safeParse({ motsCles: [{ mot: '« »', domaine: 'securite' }] }).success).toBe(false);
    expect(MotsClesEurLexBody.safeParse({ motsCles: [{ mot: 'a'.repeat(61), domaine: 'securite' }] }).success).toBe(
      false,
    );
    expect(
      MotsClesEurLexBody.safeParse({
        motsCles: [
          { mot: 'Santé', domaine: 'securite' },
          { mot: 'sante', domaine: 'donnees-personnelles' },
        ],
      }).success,
    ).toBe(false);
    expect(
      MotsClesEurLexBody.safeParse({
        motsCles: Array.from({ length: 61 }, (_x, i) => ({ mot: `mot ${i}`, domaine: 'securite' })),
      }).success,
    ).toBe(false);
    expect(MotsClesEurLexBody.safeParse({ motsCles: [{ mot: 'privacy', domaine: 'autre' }] }).success).toBe(false);
  });
});

describe('veille réglementaire : API', () => {
  it('qualification : trois statuts, jamais « à qualifier »', () => {
    for (const statut of ['sans-objet', 'a-suivre', 'impactant'])
      expect(QualificationBody.safeParse({ statut }).success).toBe(true);
    expect(QualificationBody.safeParse({ statut: 'a-qualifier' }).success).toBe(false);
    expect(QualificationBody.safeParse({ statut: 'impactant', suites: [] }).success).toBe(false);
  });
  it('réglage d’une source et fréquences', () => {
    expect(ReglageSourceReglementaire.safeParse({}).success).toBe(false);
    expect(ReglageSourceReglementaire.safeParse({ activee: true }).success).toBe(true);
    expect(ReglageSourceReglementaire.safeParse({ frequenceHeures: 12, autre: 1 }).success).toBe(false);
    expect(FREQUENCE_VEILLE_REGLEMENTAIRE_DEFAUT).toBe(24);
    expect([1, 2, 4, 12, 24, 168].filter(frequenceReglementaireAdmise)).toEqual([4, 12, 24, 168]);
  });
  it('recherche : filtres en liste fermée, page bornée', () => {
    expect(RecherchePublications.parse({})).toEqual({ page: 1 });
    expect(
      RecherchePublications.parse({ statut: 'impactant', domaine: 'securite', source: 'ans', q: ' x ', page: '2' }),
    ).toEqual({ statut: 'impactant', domaine: 'securite', source: 'ans', q: 'x', page: 2 });
    expect(RecherchePublications.safeParse({ statut: 'autre' }).success).toBe(false);
    expect(RecherchePublications.safeParse({ page: '401' }).success).toBe(false);
    expect(RecherchePublications.safeParse({ tri: 'x' }).success).toBe(false);
  });
});
