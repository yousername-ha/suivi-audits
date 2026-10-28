/* Règles du poivre des mots de passe (ADR 0072) : un cas refusé par critère, un cas accepté, génération et canonisation. */
import { describe, expect, it } from 'vitest';
import {
  PoivreAEnregistrer,
  canoniquePoivre,
  contientSuite,
  entropiePoivre,
  estPoivreGenere,
  finCorrespond,
  finPoivre,
  formaterPoivreGenere,
  genererPoivre,
  problemesPoivre,
} from '../src/poivre.js';

const BON = 'Vq7!mZ3#kP9$wX2@nR5%tL8&yB4*cD6^hF1(';
const saisi = (s: string, o: { interdits?: string[]; ancien?: string } = {}) =>
  problemesPoivre(s, { mode: 'saisi', ...o });

describe('poivre saisi', () => {
  it('accepte un poivre long, varié et sans motif', () => {
    expect(BON.length).toBeGreaterThanOrEqual(32);
    expect(saisi(BON)).toEqual([]);
  });
  it('accepte une phrase de passe d’au moins 6 mots et 40 caractères', () => {
    expect(saisi('cheval magnétique ouvre falaise doucement lanterne')).toEqual([]);
  });
  it('refuse un poivre trop court ou trop long', () => {
    expect(saisi('Vq7!mZ3#kP9$')).toContain('au moins 32 caractères');
    expect(saisi('Vq7!mZ3#kP9$wX2@nR5%tL8&yB4*cD6^hF1('.repeat(8))).toContain('256 caractères au maximum');
  });
  it('exige trois types de caractères, sauf phrase de passe', () => {
    const p = saisi('vqmzkpwxnrtlybcdhfjgsuoeiavqmzkpwxnrtl');
    expect(p.some((m) => m.startsWith('au moins 3 types'))).toBe(true);
    // Cinq mots seulement : la dérogation de la phrase de passe ne s'applique pas.
    expect(saisi('cheval magnétique ouvre falaise doucement').some((m) => m.startsWith('au moins 3 types'))).toBe(true);
  });
  it('exige une entropie estimée d’au moins 128 bits', () => {
    // 32 chiffres : 32 × log2(10) = 106 bits.
    const chiffres = '48390275618405927361840592736184';
    expect(entropiePoivre(chiffres)).toBeLessThan(128);
    expect(saisi(chiffres + 'aB').some((m) => m.startsWith('entropie estimée'))).toBe(false);
    expect(saisi(chiffres).some((m) => m.startsWith('entropie estimée'))).toBe(true);
    expect(entropiePoivre(BON)).toBeGreaterThanOrEqual(128);
  });
  it('refuse plus de trois caractères identiques à la suite', () => {
    expect(saisi(BON + 'aaaa')).toContain('pas plus de 3 caractères identiques à la suite');
    expect(saisi(BON + 'aaa').some((m) => m.includes('identiques'))).toBe(false);
  });
  it('refuse les suites de plus de quatre caractères consécutifs et les rangées de clavier', () => {
    for (const s of ['abcde', '12345', 'EDCBA', '98765', 'azerty', 'qwerty', 'AZERT', 'ytrewq', 'qsdfg', '67890'])
      expect(
        saisi(BON + s).some((m) => m.includes('suite')),
        s,
      ).toBe(true);
    for (const s of ['abcd', '1234', 'azer', 'qwer'])
      expect(
        saisi(BON + s).some((m) => m.includes('suite')),
        s,
      ).toBe(false);
    expect(contientSuite('Zr4!Kp')).toBe(false);
  });
  it('refuse le nom de l’application, de l’organisation et les identifiants de compte', () => {
    for (const interdit of ['Suivi des audits', 'Mon organisation', 'jdupont'])
      expect(
        saisi(`${BON}${interdit.toUpperCase()}`, { interdits: [interdit] }).some((m) =>
          m.startsWith('ne doit contenir'),
        ),
        interdit,
      ).toBe(true);
    expect(saisi(BON, { interdits: ['ab', ''] })).toEqual([]);
  });
  it('refuse un poivre identique à l’ancien', () => {
    expect(saisi(BON, { ancien: BON })).toContain('doit être différent de l’ancien poivre');
    expect(saisi(BON, { ancien: BON + 'x' })).toEqual([]);
  });
});

describe('poivre généré', () => {
  it('produit 52 caractères base32 acceptés par les règles, avec des tirages aléatoires variés', () => {
    const vus = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = genererPoivre();
      expect(p).toMatch(/^[A-Z2-7]{52}$/);
      expect(problemesPoivre(p, { mode: 'genere' })).toEqual([]);
      vus.add(p);
    }
    expect(vus.size).toBe(200);
  });
  it('écarte un tirage qui comporte une répétition ou une suite', () => {
    const tirages = [new Uint8Array(32), Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 255)];
    let n = 0;
    const p = genererPoivre(() => tirages[Math.min(n++, 1)]!);
    expect(n).toBe(2);
    expect(problemesPoivre(p, { mode: 'genere' })).toEqual([]);
  });
  it('refuse en mode généré un texte qui n’est pas un tirage de 52 caractères base32', () => {
    expect(problemesPoivre('ABC', { mode: 'genere' }).length).toBeGreaterThan(0);
    expect(problemesPoivre(BON, { mode: 'genere' }).length).toBeGreaterThan(0);
    expect(problemesPoivre('AB'.repeat(26), { mode: 'genere' }).length).toBeGreaterThan(0);
  });
  it('affiche par groupes de 4 et retrouve la forme canonique malgré séparateurs et minuscules', () => {
    const p = genererPoivre();
    const affiche = formaterPoivreGenere(p);
    expect(affiche.split('-')).toHaveLength(13);
    expect(canoniquePoivre(affiche)).toBe(p);
    expect(canoniquePoivre(affiche.replace(/-/g, ' ').toLowerCase())).toBe(p);
    expect(estPoivreGenere(canoniquePoivre(affiche))).toBe(true);
  });
});

describe('engagement de sauvegarde', () => {
  it('compare les 8 derniers caractères, sans tenir compte de la casse ni des séparateurs pour un poivre généré', () => {
    const p = genererPoivre();
    const fin = finPoivre(p);
    expect(fin).toHaveLength(8);
    expect(finCorrespond(p, fin)).toBe(true);
    expect(finCorrespond(p, fin.toLowerCase())).toBe(true);
    expect(finCorrespond(p, `${fin.slice(0, 4)}-${fin.slice(4)}`)).toBe(true);
    expect(finCorrespond(p, fin.slice(1) + (fin[0] === 'A' ? 'B' : 'A'))).toBe(false);
  });
  it('est sensible à la casse pour un poivre saisi', () => {
    expect(finCorrespond(BON, BON.slice(-8))).toBe(true);
    expect(finCorrespond(BON, BON.slice(-8).toLowerCase())).toBe(false);
  });
  it('exige la case cochée dans le schéma d’échange', () => {
    const base = { mode: 'saisi' as const, valeur: BON, engagement: { coffre: true as const, fin: BON.slice(-8) } };
    expect(PoivreAEnregistrer.safeParse(base).success).toBe(true);
    expect(PoivreAEnregistrer.safeParse({ ...base, engagement: { coffre: false, fin: 'x' } }).success).toBe(false);
  });
});
