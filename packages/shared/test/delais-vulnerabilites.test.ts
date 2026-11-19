/* Module Vulnérabilités (ADR 0100, lot S1) : délais de correction et exceptions à échéance. Calcul de l'échéance et de
   l'état en table (priorités, états de suivi, présence, reprise du délai, échéance proche), tri par échéance, âge, réglage
   des délais, bornes et statut d'une exception, état rendu à l'expiration, mesure des corrections (moyenne, médiane, part
   dans les délais), résumés notifiés sans nom. Fonctions pures, données fictives. */
import { describe, expect, it } from 'vitest';
import {
  calculerDelai,
  comparerEcheances,
  DELAIS_CORRECTION_DEFAUT,
  DelaiCorrection,
  DelaisCorrection,
  dureeDelaiMs,
  echeanceMaxException,
  type EntreeDelai,
  ETAT_DELAI_LIBELLES,
  ETATS_DELAI,
  etatApresExpiration,
  libelleAge,
  libelleDelai,
  libelleDuree,
  libelleTaux,
  mesurerCorrections,
  RechercheConstats,
  RechercheDeclarees,
  RechercheDelais,
  refusEcheanceException,
  STATUT_EXCEPTION_LIBELLES,
  STATUTS_EXCEPTION,
  statutException,
  titreResumeDepassements,
  titreResumeExceptions,
} from '../src/index.js';

const H = 3_600_000;
const T0 = '2026-11-01T08:00:00.000Z';
const apres = (heures: number) => new Date(Date.parse(T0) + heures * H);
const entree = (e: Partial<EntreeDelai> = {}): EntreeDelai => ({
  priorite: 'P2',
  etatSuivi: 'a_traiter',
  present: true,
  premiere: T0,
  repartLe: null,
  delais: DELAIS_CORRECTION_DEFAUT,
  maintenant: apres(24),
  ...e,
});

describe('réglage des délais', () => {
  it('valeurs par défaut à confirmer : P1 48 heures, P2 15 jours, P3 90 jours, P4 aucun délai', () => {
    expect(DELAIS_CORRECTION_DEFAUT).toEqual({
      P1: { duree: 48, unite: 'heures' },
      P2: { duree: 15, unite: 'jours' },
      P3: { duree: 90, unite: 'jours' },
      P4: null,
    });
    expect(DelaisCorrection.safeParse(DELAIS_CORRECTION_DEFAUT).success).toBe(true);
    expect(NIVEAUX.map((p) => libelleDelai(DELAIS_CORRECTION_DEFAUT[p]))).toEqual([
      '48 heures',
      '15 jours',
      '90 jours',
      'Aucun délai',
    ]);
    expect(dureeDelaiMs({ duree: 2, unite: 'jours' })).toBe(48 * H);
    expect(dureeDelaiMs(null)).toBeNull();
  });
  it.each([
    [{ duree: 1, unite: 'heures' }, true],
    [{ duree: 8760, unite: 'heures' }, true],
    [{ duree: 8761, unite: 'heures' }, false],
    [{ duree: 365, unite: 'jours' }, true],
    [{ duree: 366, unite: 'jours' }, false],
    [{ duree: 0, unite: 'jours' }, false],
    [{ duree: 1.5, unite: 'jours' }, false],
    [{ duree: 3, unite: 'semaines' }, false],
    [{ duree: 3, unite: 'jours', autre: 1 }, false],
    [null, true],
  ])('délai %j : admis %s', (d, ok) => {
    expect(DelaiCorrection.safeParse(d).success).toBe(ok);
  });
  it('les quatre priorités sont obligatoires', () => {
    expect(DelaisCorrection.safeParse({ P1: null, P2: null, P3: null }).success).toBe(false);
  });
});

const NIVEAUX = ['P1', 'P2', 'P3', 'P4'] as const;

describe('échéance et état du délai', () => {
  it.each<[string, Partial<EntreeDelai>, string, string | null]>([
    // [cas, entrée, état attendu, échéance attendue]
    [
      'P1 dans ses 48 heures, loin de l’échéance',
      { priorite: 'P1', maintenant: apres(10) },
      'dans_les_delais',
      apres(48).toISOString(),
    ],
    [
      'P1 à moins d’un quart du délai',
      { priorite: 'P1', maintenant: apres(37) },
      'echeance_proche',
      apres(48).toISOString(),
    ],
    [
      'P1 à l’échéance exacte : pas encore dépassée',
      { priorite: 'P1', maintenant: apres(48) },
      'echeance_proche',
      apres(48).toISOString(),
    ],
    ['P1 après 48 heures', { priorite: 'P1', maintenant: apres(49) }, 'en_depassement', apres(48).toISOString()],
    ['P2 après 16 jours', { maintenant: apres(16 * 24) }, 'en_depassement', apres(15 * 24).toISOString()],
    [
      'P3 après 16 jours',
      { priorite: 'P3', maintenant: apres(16 * 24) },
      'dans_les_delais',
      apres(90 * 24).toISOString(),
    ],
    ['P4 : aucun délai', { priorite: 'P4', maintenant: apres(1000 * 24) }, 'sans_delai', null],
    ['corrigée : close', { etatSuivi: 'corrigee', maintenant: apres(1000) }, 'close', apres(15 * 24).toISOString()],
    [
      'non concernée : close',
      { etatSuivi: 'non_concernee', maintenant: apres(1000) },
      'close',
      apres(15 * 24).toISOString(),
    ],
    [
      'risque accepté : sous exception',
      { etatSuivi: 'risque_accepte', maintenant: apres(1000) },
      'sous_exception',
      apres(15 * 24).toISOString(),
    ],
    [
      'plus rapportée par la source',
      { present: false, maintenant: apres(1000) },
      'non_rapportee',
      apres(15 * 24).toISOString(),
    ],
    [
      'nouvelle, en cours : le délai court',
      { etatSuivi: 'nouvelle', maintenant: apres(1000) },
      'en_depassement',
      apres(15 * 24).toISOString(),
    ],
    [
      'délai reparti (fin d’exception) : depuis la reprise',
      { repartLe: apres(500).toISOString(), maintenant: apres(510) },
      'dans_les_delais',
      apres(500 + 15 * 24).toISOString(),
    ],
    [
      'reprise plus ancienne que la première présence : ignorée',
      { repartLe: apres(-100).toISOString(), maintenant: apres(1000) },
      'en_depassement',
      apres(15 * 24).toISOString(),
    ],
  ])('%s', (_cas, e, etat, echeance) => {
    const d = calculerDelai(entree(e));
    expect(d.etat).toBe(etat);
    expect(d.echeance).toBe(echeance);
    expect(d.premiere).toBe(T0);
  });

  it('délai réglé autrement, ou sans première présence connue', () => {
    const delais = { ...DELAIS_CORRECTION_DEFAUT, P2: { duree: 3, unite: 'heures' as const } };
    expect(calculerDelai(entree({ delais, maintenant: apres(4) })).etat).toBe('en_depassement');
    expect(calculerDelai(entree({ delais: { ...delais, P2: null } })).etat).toBe('sans_delai');
    expect(calculerDelai(entree({ premiere: null })).etat).toBe('sans_delai');
  });

  it('états libellés ; tri par échéance : les délais qui courent d’abord, le reste à la fin', () => {
    expect(Object.keys(ETAT_DELAI_LIBELLES)).toEqual([...ETATS_DELAI]);
    expect(ETAT_DELAI_LIBELLES.en_depassement).toBe('En dépassement');
    const p1 = calculerDelai(entree({ priorite: 'P1' }));
    const p2 = calculerDelai(entree());
    const p4 = calculerDelai(entree({ priorite: 'P4' }));
    const close = calculerDelai(entree({ priorite: 'P1', etatSuivi: 'corrigee' }));
    expect([p4, close, p2, p1].sort(comparerEcheances)).toEqual([p1, p2, p4, close]);
  });

  it('âge en clair depuis la première présence', () => {
    expect(libelleAge(T0, apres(5))).toBe('5 h');
    expect(libelleAge(T0, apres(47))).toBe('47 h');
    expect(libelleAge(T0, apres(24 * 12 + 3))).toBe('12 j');
    expect(libelleAge(null, apres(1))).toBe('Inconnu');
    expect(libelleAge(T0, apres(-2))).toBe('0 h');
  });

  it('filtres des listes : état du délai et tri par échéance', () => {
    for (const R of [RechercheConstats, RechercheDeclarees]) {
      expect(R.parse({ delai: 'en_depassement', tri: 'echeance' })).toMatchObject({
        delai: 'en_depassement',
        tri: 'echeance',
      });
      expect(R.safeParse({ delai: 'inconnu' }).success).toBe(false);
      expect(R.safeParse({ tri: 'nom' }).success).toBe(false);
    }
  });
});

describe('exceptions', () => {
  it.each([
    ['2026-11-18', '2027-11-18'],
    ['2026-02-28', '2027-02-28'],
    ['2027-02-28', '2028-02-28'],
    ['2028-02-29', '2029-02-28'],
    ['2026-12-31', '2027-12-31'],
  ])('échéance la plus lointaine depuis le %s : %s (douze mois)', (jour, max) => {
    expect(echeanceMaxException(jour)).toBe(max);
  });

  it.each<[string | null, string | null]>([
    [null, 'Une date d’échéance est obligatoire pour accepter un risque.'],
    ['2026-11-17', 'L’échéance de l’exception ne peut pas être passée.'],
    ['2026-11-18', null],
    ['2027-11-18', null],
    ['2027-11-19', 'L’échéance d’une exception est de 12 mois au plus (le 2027-11-18 au plus tard).'],
  ])('échéance %s le 2026-11-18 : %s', (echeance, motif) => {
    expect(refusEcheanceException(echeance, '2026-11-18')).toBe(motif);
  });

  it.each<[string | null, string]>([
    [null, 'sans_echeance'],
    ['2026-11-17', 'echue'],
    ['2026-11-18', 'bientot_echue'],
    ['2026-12-02', 'bientot_echue'],
    ['2026-12-03', 'en_cours'],
  ])('statut d’une exception d’échéance %s le 2026-11-18 : %s', (echeance, statut) => {
    expect(statutException(echeance, '2026-11-18')).toBe(statut);
  });

  it('libellés des statuts ; état rendu à l’expiration', () => {
    expect(Object.keys(STATUT_EXCEPTION_LIBELLES)).toEqual([...STATUTS_EXCEPTION]);
    expect(STATUT_EXCEPTION_LIBELLES.sans_echeance).toBe('Sans échéance, à compléter');
    expect(etatApresExpiration('en_cours')).toBe('en_cours');
    expect(etatApresExpiration('a_traiter')).toBe('a_traiter');
    for (const avant of ['nouvelle', 'corrigee', 'non_concernee', 'risque_accepte', null] as const)
      expect(etatApresExpiration(avant)).toBe('a_traiter');
  });
});

describe('mesure des corrections', () => {
  const c = (priorite: 'P1' | 'P2' | 'P3' | 'P4', heures: number, delaiHeures: number | null) => ({
    priorite,
    depuis: T0,
    fin: apres(heures).toISOString(),
    echeance: delaiHeures === null ? null : apres(delaiHeures).toISOString(),
  });

  it('moyenne, médiane et part dans les délais, par priorité et en tout', () => {
    const m = mesurerCorrections([
      c('P1', 10, 48),
      c('P1', 30, 48),
      c('P1', 60, 48),
      c('P2', 100, 360),
      c('P4', 5, null),
    ]);
    expect(m.parPriorite.find((x) => x.priorite === 'P1')).toEqual({
      priorite: 'P1',
      nombre: 3,
      moyenneHeures: 33.3,
      medianeHeures: 30,
      avecDelai: 3,
      dansLesDelais: 2,
      taux: 2 / 3,
    });
    expect(m.parPriorite.find((x) => x.priorite === 'P3')).toEqual({
      priorite: 'P3',
      nombre: 0,
      moyenneHeures: null,
      medianeHeures: null,
      avecDelai: 0,
      dansLesDelais: 0,
      taux: null,
    });
    // P4 sans délai : comptée, jamais dans le taux.
    expect(m.parPriorite.find((x) => x.priorite === 'P4')).toMatchObject({ nombre: 1, avecDelai: 0, taux: null });
    expect(m.total).toEqual({
      nombre: 5,
      moyenneHeures: 41,
      medianeHeures: 30,
      avecDelai: 4,
      dansLesDelais: 3,
      taux: 0.75,
    });
  });

  it('médiane d’un nombre pair ; correction à l’échéance exacte comptée dans les délais ; durée négative ramenée à 0', () => {
    expect(mesurerCorrections([c('P2', 10, 48), c('P2', 20, 48)]).total.medianeHeures).toBe(15);
    expect(mesurerCorrections([c('P1', 48, 48)]).total.dansLesDelais).toBe(1);
    expect(mesurerCorrections([c('P1', -5, 48)]).total.moyenneHeures).toBe(0);
    expect(mesurerCorrections([]).total).toEqual({
      nombre: 0,
      moyenneHeures: null,
      medianeHeures: null,
      avecDelai: 0,
      dansLesDelais: 0,
      taux: null,
    });
  });

  it('libellés de durée et de taux ; période', () => {
    expect(libelleDuree(null)).toBe('—');
    expect(libelleDuree(36)).toBe('36 h');
    expect(libelleDuree(72)).toBe('3 j');
    expect(libelleTaux(null)).toBe('—');
    expect(libelleTaux(0.75)).toBe('75 %');
    expect(RechercheDelais.parse({})).toEqual({ periode: 90 });
    expect(RechercheDelais.parse({ periode: '365' })).toEqual({ periode: 365 });
    expect(RechercheDelais.safeParse({ periode: '12' }).success).toBe(false);
  });
});

describe('résumés notifiés', () => {
  it('leur nombre seulement : ni CVE ni nom', () => {
    expect(titreResumeDepassements(1)).toBe('Vulnérabilités : 1 faille en dépassement de délai');
    expect(titreResumeDepassements(12)).toBe('Vulnérabilités : 12 failles en dépassement de délai');
    expect(titreResumeExceptions(2, 0)).toBe('Vulnérabilités : 2 exceptions échues');
    expect(titreResumeExceptions(0, 1)).toBe('Vulnérabilités : 1 exception à échéance sous 14 jours');
    expect(titreResumeExceptions(1, 3)).toBe(
      'Vulnérabilités : 1 exception échue, 3 exceptions à échéance sous 14 jours',
    );
  });
});
