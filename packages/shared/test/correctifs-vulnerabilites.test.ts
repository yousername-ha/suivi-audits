/* Lot S3 (ADR 0100) : état du correctif en table, précision de l'exploitation, fin de support, regroupement par correctif et
   tri par gain. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  CLE_SANS_CORRECTIF,
  comparerCorrectifs,
  type DelaiFailleDto,
  DELAIS_CORRECTION_DEFAUT,
  enteteCorrectifs,
  type EtatCorrectifDto,
  etatCorrectif,
  etatFinSupport,
  type FailleAGrouper,
  type IndicesCorrectif,
  libelleEtatCorrectif,
  marquesMachine,
  regrouperParCorrectif,
  serviceEnFinDeSupport,
  situationExploitation,
  texteCorrectif,
} from '../src/index.js';

describe('état du correctif : trois valeurs, règle des sources', () => {
  const T = '2026-10-02T00:00:00.000Z';
  const C = '2026-09-15T00:00:00.000Z';
  it.each<[string, IndicesCorrectif, EtatCorrectifDto]>([
    [
      'rien de rangé : non renseigné',
      { tenablePublieLe: null, certSante: null },
      { etat: 'non_renseigne', sources: [] },
    ],
    [
      'Tenable donne une date de correctif',
      { tenablePublieLe: T, certSante: null },
      { etat: 'disponible', sources: [{ source: 'tenable', valeur: 'disponible', le: T }] },
    ],
    [
      'CERT Santé « Oui »',
      { tenablePublieLe: null, certSante: 'oui' },
      { etat: 'disponible', sources: [{ source: 'cert-sante', valeur: 'disponible', le: null }] },
    ],
    [
      'CERT Santé « Non » seul : aucun correctif connu',
      { tenablePublieLe: null, certSante: 'non' },
      { etat: 'aucun_connu', sources: [{ source: 'cert-sante', valeur: 'aucun', le: null }] },
    ],
    [
      'désaccord : un correctif publié l’emporte sur « Non »',
      { tenablePublieLe: T, certSante: 'non' },
      { etat: 'disponible', sources: [{ source: 'tenable', valeur: 'disponible', le: T }] },
    ],
    [
      'deux sources d’accord : la première en date d’abord',
      { tenablePublieLe: T, certSante: 'oui', certSanteLe: C },
      {
        etat: 'disponible',
        sources: [
          { source: 'cert-sante', valeur: 'disponible', le: C },
          { source: 'tenable', valeur: 'disponible', le: T },
        ],
      },
    ],
    [
      'source sans date rangée après la source datée',
      { tenablePublieLe: T, certSante: 'oui' },
      {
        etat: 'disponible',
        sources: [
          { source: 'tenable', valeur: 'disponible', le: T },
          { source: 'cert-sante', valeur: 'disponible', le: null },
        ],
      },
    ],
  ])('%s', (_, indices, attendu) => {
    expect(etatCorrectif(indices)).toEqual(attendu);
  });

  it('« non renseigné » ne vaut jamais « aucun correctif »', () => {
    const e = etatCorrectif({ tenablePublieLe: null, certSante: null });
    expect(e.etat).not.toBe('aucun_connu');
    expect(situationExploitation(true, e.etat)).toBe('correctif_non_renseigne');
    expect(libelleEtatCorrectif(e)).toContain('aucune source rangée');
  });

  it('libellé : dit quelle source parle, et sa date', () => {
    expect(libelleEtatCorrectif(etatCorrectif({ tenablePublieLe: T, certSante: null }))).toBe(
      'Correctif disponible selon Tenable (date de publication du correctif) le 02/10/2026.',
    );
    expect(libelleEtatCorrectif(etatCorrectif({ tenablePublieLe: null, certSante: 'non' }))).toBe(
      'Aucun correctif connu selon CERT Santé (mention « Un correctif existe »).',
    );
  });

  it.each([
    [false, 'disponible', null],
    [false, 'aucun_connu', null],
    [true, 'disponible', 'corrigible'],
    [true, 'aucun_connu', 'sans_correctif'],
    [true, 'non_renseigne', 'correctif_non_renseigne'],
  ] as const)('exploitée %s, correctif %s : %s', (exploitee, etat, attendu) => {
    expect(situationExploitation(exploitee, etat)).toBe(attendu);
  });
});

describe('fin de support', () => {
  const maintenant = new Date('2026-11-18T10:00:00.000Z');
  it.each([
    [null, null],
    ['', null],
    ['pas une date', null],
    ['2025-10-14T00:00:00.000Z', 'atteinte'],
    ['2026-11-18T10:00:00.000Z', 'atteinte'],
    ['2027-06-30T00:00:00.000Z', 'annoncee'],
  ] as const)('date %s : %s', (le, attendu) => {
    expect(etatFinSupport(le, maintenant)).toBe(attendu);
  });
  it.each([
    ['eol', true],
    ['outdated', false],
    [null, false],
  ] as const)('service d’AlgoLightHouse %s : %s (version dépassée n’est pas une fin de support)', (statut, attendu) => {
    expect(serviceEnFinDeSupport(statut)).toBe(attendu);
  });
});

describe('marques d’une machine : précision « sans correctif connu »', () => {
  it.each([
    [[], false],
    [[{ niveau: 'P1', exploitee: true, exploitable: false }], false],
    [[{ niveau: 'P1', exploitee: true, exploitable: false, sansCorrectif: true }], true],
    // Une faille exploitable sans exploitation avérée ne donne jamais la précision.
    [[{ niveau: 'P2', exploitee: false, exploitable: true, sansCorrectif: true }], false],
  ] as const)('%j : %s', (failles, attendu) => {
    const m = marquesMachine(failles);
    expect(m.exploiteeSansCorrectif).toBe(attendu);
    // La marque zero-day n'est pas changée par la précision.
    expect(m.exploitationAveree).toBe(failles.some((f) => f.exploitee));
  });
});

describe('regroupement par correctif', () => {
  const delai = (etat: DelaiFailleDto['etat'], echeance: string | null = null): DelaiFailleDto => ({
    etat,
    priorite: 'P2',
    delai: DELAIS_CORRECTION_DEFAUT.P2,
    premiere: null,
    depuis: null,
    echeance,
  });
  const NR: EtatCorrectifDto = { etat: 'non_renseigne', sources: [] };
  const faille = (id: string, f: Partial<FailleAGrouper> = {}): FailleAGrouper => ({
    id,
    solution: 'Upgrade to Exemple 2.0 or later.',
    priorite: 'P3',
    exploitee: false,
    exploitable: false,
    correctif: NR,
    finDeSupport: false,
    delai: delai('dans_les_delais', '2026-12-01T00:00:00.000Z'),
    cves: [],
    machinesLisibles: [],
    horsLecture: false,
    ...f,
  });
  const cle = (t: string) => `k:${t}`;

  it('texte de solution : espaces réduits, vide ou absent = sans correctif', () => {
    expect(texteCorrectif('  Upgrade\n to   2.0 ')).toBe('Upgrade to 2.0');
    expect(texteCorrectif('   ')).toBeNull();
    expect(texteCorrectif(null)).toBeNull();
    expect(texteCorrectif(undefined)).toBeNull();
  });

  it('une ligne par texte, nombres, machines lues, priorité, marques, délai et correctif', () => {
    const g = regrouperParCorrectif(
      [
        faille('a', { cves: ['CVE-2026-0001', 'CVE-2026-0002'], machinesLisibles: ['m1', 'm2'], priorite: 'P2' }),
        faille('b', {
          solution: 'Upgrade  to Exemple 2.0 or later.',
          cves: ['CVE-2026-0002', 'CVE-2026-0003'],
          machinesLisibles: ['m2', 'm3'],
          exploitee: true,
          priorite: 'P1',
          correctif: { etat: 'aucun_connu', sources: [{ source: 'cert-sante', valeur: 'aucun', le: null }] },
          delai: delai('en_depassement', '2026-11-01T00:00:00.000Z'),
          finDeSupport: true,
        }),
        faille('c', {
          exploitable: true,
          horsLecture: true,
          correctif: { etat: 'disponible', sources: [{ source: 'tenable', valeur: 'disponible', le: null }] },
        }),
        faille('d', { solution: null, machinesLisibles: ['m9'] }),
        faille('e', { solution: 'Apply the vendor patch (fictif).', priorite: 'P4', delai: delai('sans_delai') }),
      ],
      cle,
    );
    expect(g.map((x) => x.cle)).toEqual([
      'k:Upgrade to Exemple 2.0 or later.',
      'k:Apply the vendor patch (fictif).',
      CLE_SANS_CORRECTIF,
    ]);
    expect(g[0]).toEqual({
      cle: 'k:Upgrade to Exemple 2.0 or later.',
      solution: 'Upgrade to Exemple 2.0 or later.',
      failles: 3,
      cves: 3,
      machines: { lisibles: 3, horsLecture: true },
      priorite: 'P1',
      exploitees: 1,
      exploiteesSansCorrectif: 1,
      exploitables: 1,
      finDeSupport: 1,
      delai: { etat: 'en_depassement', echeance: '2026-11-01T00:00:00.000Z', enDepassement: 1 },
      correctif: { disponible: 1, aucun_connu: 1, non_renseigne: 1 },
      sourcesCorrectif: ['tenable', 'cert-sante'],
    });
    expect(g[2]).toMatchObject({ solution: null, failles: 1, machines: { lisibles: 1, horsLecture: false } });
  });

  it('deux libellés différents pour la même mise à jour ne sont pas fusionnés', () => {
    const g = regrouperParCorrectif(
      [faille('a', { solution: 'Upgrade to 2.0.' }), faille('b', { solution: 'Upgrade to version 2.0.' })],
      cle,
    );
    expect(g).toHaveLength(2);
  });

  it('tri par gain : priorité, puis failles corrigées ; le groupe sans correctif toujours en dernier', () => {
    const liste = [
      faille('s1', { solution: null, priorite: 'P1' }),
      ...['1', '2', '3'].map((i) => faille(`x${i}`, { solution: 'Beaucoup (P3)', priorite: 'P3' })),
      faille('y', { solution: 'Une seule (P1)', priorite: 'P1' }),
      ...['1', '2'].map((i) => faille(`z${i}`, { solution: 'Deux (P1)', priorite: 'P1' })),
    ];
    const g = regrouperParCorrectif(liste, cle);
    expect(g.map((x) => x.solution)).toEqual(['Deux (P1)', 'Une seule (P1)', 'Beaucoup (P3)', null]);
    // Les machines lues ne changent pas l'ordre : il est le même pour tout le monde.
    const autre = regrouperParCorrectif(
      liste.map((f) => ({ ...f, machinesLisibles: f.id === 'y' ? ['m1', 'm2', 'm3'] : [] })),
      cle,
    );
    expect(autre.map((x) => x.cle)).toEqual(g.map((x) => x.cle));
  });

  it('comparerCorrectifs : départage stable par exploitées, CVE, texte, clé', () => {
    const base = { solution: 'A', priorite: 'P2' as const, failles: 2, exploitees: 0, cves: 1, cle: 'a' };
    expect(comparerCorrectifs(base, { ...base, exploitees: 1 })).toBeGreaterThan(0);
    expect(comparerCorrectifs(base, { ...base, cves: 3 })).toBeGreaterThan(0);
    expect(comparerCorrectifs(base, { ...base, solution: 'B' })).toBeLessThan(0);
    expect(comparerCorrectifs(base, { ...base, cle: 'b' })).toBeLessThan(0);
    expect(comparerCorrectifs(base, base)).toBe(0);
  });

  it('en-tête « n mises à jour à faire pour m failles »', () => {
    expect(enteteCorrectifs(12, 400)).toBe('12 mises à jour à faire pour 400 failles');
    expect(enteteCorrectifs(1, 1)).toBe('1 mise à jour à faire pour 1 faille');
  });
});
