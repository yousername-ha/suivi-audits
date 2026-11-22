/* Module Vulnérabilités (ADR 0100, lot CPE-1 ; décisions du RSSI du 22/11/2026) : CPE 2.3 construit et lu sans appel
   (échappements de la chaîne formatée), tri des versions, recherche insensible à la casse et aux accents, intitulé sans
   version, schémas des routes et de la CLI de l'exécutant. Données fictives (éditeurs et produits inventés). */
import { describe, expect, it } from 'vitest';
import {
  analyserCpe23,
  comparerVersionsCpe,
  construireCpe23,
  CPE_23,
  CPE_BORNES,
  echapperComposanteCpe,
  ElementProduitCpe,
  frequenceDictionnaireCpe,
  frequenceDictionnaireCpeAdmise,
  IdentiteProduitCpe,
  identiteCpe,
  intituleSansVersion,
  LotDictionnaireCpe,
  normaliserRechercheCpe,
  RapportDictionnaireCpe,
  RapportVersionsCpe,
  RechercheProduitsCpe,
  ReglageDictionnaireCpe,
  SOURCE_DICTIONNAIRE_CPE,
  sourceVeille,
  trierVersionsCpe,
} from '../src/index.js';

describe('CPE 2.3 construit à partir du choix', () => {
  it('compose les 13 composantes, version en « * » quand elle manque', () => {
    expect(
      construireCpe23({ partie: 'a', editeur: 'editeur-fictif', produit: 'produit_fictif', version: '9.5.1' }),
    ).toBe('cpe:2.3:a:editeur-fictif:produit_fictif:9.5.1:*:*:*:*:*:*:*');
    for (const version of [undefined, null, '', '  ', '*'])
      expect(construireCpe23({ partie: 'o', editeur: 'ed', produit: 'sys', version })).toBe(
        'cpe:2.3:o:ed:sys:*:*:*:*:*:*:*:*',
      );
    expect(construireCpe23({ partie: 'h', editeur: 'ed', produit: 'boitier', version: '-' })).toBe(
      'cpe:2.3:h:ed:boitier:-:*:*:*:*:*:*:*',
    );
  });

  it('échappe tout caractère autre que lettre, chiffre, « _ », « - » et « . » (deux-points, barre, joker…)', () => {
    expect(echapperComposanteCpe('a:b')).toBe('a\\:b');
    expect(echapperComposanteCpe('a\\b')).toBe('a\\\\b');
    expect(echapperComposanteCpe('x!y/z*?+')).toBe('x\\!y\\/z\\*\\?\\+');
    expect(echapperComposanteCpe('plain_name-1.0')).toBe('plain_name-1.0');
    const cpe = construireCpe23({ partie: 'a', editeur: 'ed&co', produit: 'prod:pro', version: '1.0:beta!' })!;
    expect(cpe).toBe('cpe:2.3:a:ed\\&co:prod\\:pro:1.0\\:beta\\!:*:*:*:*:*:*:*');
    expect(CPE_23.test(cpe)).toBe(true);
    // Relu dans l'autre sens : mêmes valeurs, échappements retirés.
    expect(analyserCpe23(cpe)).toEqual({ partie: 'a', editeur: 'ed&co', produit: 'prod:pro', version: '1.0:beta!' });
    // Le rapprochement existant lit la même identité.
    expect(identiteCpe(cpe)).toEqual({ partie: 'a', editeur: 'ed&co', produit: 'prod:pro' });
  });

  it('refuse une partie, un éditeur, un produit ou une version de forme non admise', () => {
    expect(construireCpe23({ partie: 'x' as 'a', editeur: 'ed', produit: 'p' })).toBeNull();
    for (const nom of ['', '*', '-', 'avec espace', 'a<b', 'x'.repeat(101)]) {
      expect(construireCpe23({ partie: 'a', editeur: nom, produit: 'p' })).toBeNull();
      expect(construireCpe23({ partie: 'a', editeur: 'ed', produit: nom })).toBeNull();
    }
    for (const version of ['1 2', 'v<1>', 'x'.repeat(61), '\u0001'])
      expect(construireCpe23({ partie: 'a', editeur: 'ed', produit: 'p', version })).toBeNull();
  });
});

describe('CPE 2.3 collé : lecture sans appel', () => {
  it('rend la partie, l’éditeur, le produit et la version', () => {
    expect(analyserCpe23('  cpe:2.3:a:editeur-fictif:produit_fictif:10.0.17:*:*:*:*:*:*:*  ')).toEqual({
      partie: 'a',
      editeur: 'editeur-fictif',
      produit: 'produit_fictif',
      version: '10.0.17',
    });
    expect(analyserCpe23('cpe:2.3:o:ed:sys:*:*:*:*:*:*:*:*')?.version).toBeNull();
    expect(analyserCpe23('cpe:2.3:o:ed:sys:-:*:*:*:*:*:*:*')?.version).toBeNull();
    // Deux-points échappé dans le produit, barre oblique échappée dans la version.
    expect(analyserCpe23('cpe:2.3:a:ed:pro\\:duit:2\\/3:*:*:*:*:*:*:*')).toEqual({
      partie: 'a',
      editeur: 'ed',
      produit: 'pro:duit',
      version: '2/3',
    });
  });

  it('refuse ce qui n’est pas un CPE 2.3 formaté complet', () => {
    for (const s of [
      '',
      'glpi',
      'cpe:/a:ed:prod:1.0',
      'cpe:2.3:a:ed:prod:1.0',
      'cpe:2.3:a:ed:prod:1.0:*:*:*:*:*:*:*:*',
      'cpe:2.3:x:ed:prod:1.0:*:*:*:*:*:*:*',
      'cpe:2.3:*:ed:prod:1.0:*:*:*:*:*:*:*',
      'cpe:2.3:a:*:prod:1.0:*:*:*:*:*:*:*',
      'cpe:2.3:a:ed:-:1.0:*:*:*:*:*:*:*',
      'cpe:2.3:a:ed:pr od:1.0:*:*:*:*:*:*:*',
      `cpe:2.3:a:ed:prod:${'9'.repeat(600)}:*:*:*:*:*:*:*`,
    ])
      expect(analyserCpe23(s), s).toBeNull();
  });
});

describe('tri des versions', () => {
  it('range de la plus récente à la plus ancienne, nombres comparés comme des nombres', () => {
    expect(trierVersionsCpe(['9.5.1', '10.0.2', '10.0.10', '9.5', '1.0'])).toEqual([
      '10.0.10',
      '10.0.2',
      '9.5.1',
      '9.5',
      '1.0',
    ]);
  });

  it('une préversion passe avant la version finale, un correctif après', () => {
    expect(trierVersionsCpe(['1.0', '1.0-rc1', '1.0.1', '1.0beta', '0.9'])).toEqual([
      '1.0.1',
      '1.0',
      '1.0-rc1',
      '1.0beta',
      '0.9',
    ]);
    expect(comparerVersionsCpe('1.0.1', '1.0.rc1')).toBeGreaterThan(0);
    expect(comparerVersionsCpe('2024-05-01', '2023-12-31')).toBeGreaterThan(0);
  });

  it('écarte les doublons et les valeurs vides, borne la liste, reste stable', () => {
    expect(trierVersionsCpe(['1.0', '1.0', '*', '-', '', '2.0'])).toEqual(['2.0', '1.0']);
    const beaucoup = Array.from({ length: 3000 }, (_, i) => `1.${i}`);
    const tries = trierVersionsCpe(beaucoup);
    expect(tries).toHaveLength(CPE_BORNES.versions);
    expect(tries[0]).toBe('1.2999');
    expect(trierVersionsCpe(['b', 'a', 'B'])).toEqual(trierVersionsCpe(['B', 'a', 'b']));
  });
});

describe('recherche et intitulé', () => {
  it('normalise sans casse ni accent ; « _ », « - » et espaces se valent', () => {
    expect(normaliserRechercheCpe('Éditeur_Fictif-Produit')).toBe('editeur fictif produit');
    expect(normaliserRechercheCpe('  INTERNET   explorer ')).toBe('internet explorer');
  });

  it('retire la version de l’intitulé seulement en mot entier', () => {
    expect(intituleSansVersion('Editeur Fictif Produit 9.5.1', '9.5.1')).toBe('Editeur Fictif Produit');
    expect(intituleSansVersion('Produit Fictif 2.4.1 Beta', '2.4.1')).toBe('Produit Fictif');
    expect(intituleSansVersion('Produit Fictif 2.4.10', '2.4.1')).toBe('Produit Fictif 2.4.10');
    expect(intituleSansVersion('Produit Fictif', '*')).toBe('Produit Fictif');
    expect(intituleSansVersion('9.5.1', '9.5.1')).toBe('9.5.1');
  });
});

describe('source et schémas', () => {
  it('même hôte que la veille NVD : aucune destination nouvelle', () => {
    expect(SOURCE_DICTIONNAIRE_CPE.hote).toBe(sourceVeille('nvd').hote);
    expect(SOURCE_DICTIONNAIRE_CPE.chemins).toEqual(['/rest/json/cpes/2.0']);
  });

  it('borne le terme de recherche (2 à 100 caractères) et refuse tout champ en plus', () => {
    expect(RechercheProduitsCpe.safeParse({ q: 'g' }).success).toBe(false);
    expect(RechercheProduitsCpe.safeParse({ q: '  gl  ' }).data).toEqual({ q: 'gl' });
    expect(RechercheProduitsCpe.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
    expect(RechercheProduitsCpe.safeParse({ q: 'gl', limite: 500 }).success).toBe(false);
  });

  it('identité : partie fermée, éditeur et produit précis', () => {
    expect(IdentiteProduitCpe.safeParse({ partie: 'a', editeur: 'ed', produit: 'p' }).success).toBe(true);
    expect(IdentiteProduitCpe.safeParse({ partie: 'a', editeur: '*', produit: 'p' }).success).toBe(false);
    expect(IdentiteProduitCpe.safeParse({ partie: 'z', editeur: 'ed', produit: 'p' }).success).toBe(false);
    expect(IdentiteProduitCpe.safeParse({ partie: 'a', editeur: 'ed', produit: 'p', x: 1 }).success).toBe(false);
  });

  it('lots et rapports de l’exécutant : bornés, stricts, cohérents', () => {
    const produit = { partie: 'a', editeur: 'ed', produit: 'p', intitule: 'Editeur Produit' };
    expect(ElementProduitCpe.safeParse(produit).success).toBe(true);
    expect(ElementProduitCpe.safeParse({ ...produit, intitule: 'a\nb' }).success).toBe(false);
    expect(ElementProduitCpe.safeParse({ ...produit, intitule: 'x'.repeat(301) }).success).toBe(false);
    expect(LotDictionnaireCpe.safeParse({ produits: [produit], versions: [] }).success).toBe(true);
    expect(
      LotDictionnaireCpe.safeParse({ produits: Array(CPE_BORNES.lot + 1).fill(produit), versions: [] }).success,
    ).toBe(false);
    expect(LotDictionnaireCpe.safeParse({ produits: [], versions: [{ ...produit, version: '*' }] }).success).toBe(
      false,
    );
    const bilan = { total: 10, suivant: 10, entrees: 10, obsoletes: 0, ecartes: 0 };
    expect(RapportDictionnaireCpe.safeParse({ ok: true, erreur: null, bilan }).success).toBe(true);
    expect(RapportDictionnaireCpe.safeParse({ ok: true, erreur: 'x', bilan }).success).toBe(false);
    expect(RapportDictionnaireCpe.safeParse({ ok: false, erreur: 'Délai dépassé.', bilan: null }).success).toBe(true);
    expect(RapportDictionnaireCpe.safeParse({ ok: false, erreur: null, bilan: null }).success).toBe(false);
    expect(RapportVersionsCpe.safeParse({ ok: true, erreur: null, versions: ['1.0'], tronque: false }).success).toBe(
      true,
    );
    expect(
      RapportVersionsCpe.safeParse({
        ok: true,
        erreur: null,
        versions: Array.from({ length: 2001 }, (_, i) => `${i}`),
        tronque: true,
      }).success,
    ).toBe(false);
    expect(RapportVersionsCpe.safeParse({ ok: false, erreur: 'x', versions: ['1'], tronque: false }).success).toBe(
      false,
    );
  });

  it('réglage : au moins un champ ; fréquence quotidienne par défaut, ou hebdomadaire', () => {
    expect(ReglageDictionnaireCpe.safeParse({}).success).toBe(false);
    expect(ReglageDictionnaireCpe.safeParse({ activee: true }).success).toBe(true);
    expect(frequenceDictionnaireCpe(null)).toBe(24);
    expect(frequenceDictionnaireCpeAdmise(168)).toBe(true);
    expect(frequenceDictionnaireCpeAdmise(2)).toBe(false);
  });
});
