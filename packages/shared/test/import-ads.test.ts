/* Module Vulnérabilités (ADR 0100, lot AD-1) : schémas de l'import du rapport de l'Active Directory (liste blanche revalidée
   par l'API) et bornes. Données entièrement fictives (comptes « compte-fictif-NN », domaine exemple.invalid). */
import { describe, expect, it } from 'vitest';
import {
  ADS_BORNES,
  ecartsAdsVides,
  evolutionNoteAds,
  ImportAds,
  type ImportAdsDto,
  libelleTypeAds,
  nomObjetAdsValide,
  PointAds,
  pointsParNiveauEtType,
  RapportAds,
  variationAds,
} from '../src/index.js';

const point = (o: Record<string, unknown> = {}) => ({
  identifiant: 'vuln1_fictif_admins',
  reference: 'fictif_admins',
  type: 3,
  niveau: 1,
  titre: 'Point de contrôle fictif',
  objets: 2,
  noms: [
    { nom: 'compte-fictif-01', nature: 'utilisateur' },
    { nom: 'srv-fictif-01$', nature: 'ordinateur' },
  ],
  ...o,
});
const rapport = (o: Record<string, unknown> = {}) => ({
  date: '2026-11-20',
  note: 3,
  progression: [{ niveau: 1, conformes: 4, total: 5, pourcentage: null }],
  conformes: 40,
  ...o,
});

describe('import du rapport de l’Active Directory : schémas', () => {
  it('extrait nominal accepté', () => {
    expect(ImportAds.safeParse({ rapport: rapport(), points: [point()], ecartes: ecartsAdsVides() }).success).toBe(
      true,
    );
    // Aucun point non conforme : admis (tout est conforme).
    expect(ImportAds.safeParse({ rapport: rapport(), points: [], ecartes: ecartsAdsVides() }).success).toBe(true);
  });

  it('champ en trop refusé à chaque niveau (liste blanche stricte)', () => {
    const base = { rapport: rapport(), points: [point()], ecartes: ecartsAdsVides() };
    expect(ImportAds.safeParse({ ...base, domaine: 'exemple.invalid' }).success).toBe(false);
    expect(ImportAds.safeParse({ ...base, rapport: rapport({ fichier: 'x.json' }) }).success).toBe(false);
    expect(PointAds.safeParse(point({ sid: 'S-1-5-21-1-2-3-500' })).success).toBe(false);
    expect(
      PointAds.safeParse(
        point({ noms: [{ nom: 'compte-fictif-01', nature: 'utilisateur', motDePasse: 'x' }], objets: 1 }),
      ).success,
    ).toBe(false);
    expect(ImportAds.safeParse({ ...base, ecartes: { ...ecartsAdsVides(), autre: 1 } }).success).toBe(false);
  });

  it('nom d’objet : nom court seulement, ni SID, ni chemin LDAP, ni « domaine\\nom », borné', () => {
    expect(nomObjetAdsValide('compte-fictif-01')).toBe(true);
    expect(nomObjetAdsValide('Admins fictifs du domaine')).toBe(true);
    expect(nomObjetAdsValide('S-1-5-21-1000-2000-3000-1104')).toBe(false);
    expect(nomObjetAdsValide('CN=compte-fictif-01,OU=Comptes,DC=exemple,DC=invalid')).toBe(false);
    expect(nomObjetAdsValide('ou=Comptes')).toBe(false);
    expect(nomObjetAdsValide('EXEMPLE\\compte-fictif-01')).toBe(false);
    expect(nomObjetAdsValide('x'.repeat(ADS_BORNES.nom))).toBe(true);
    expect(nomObjetAdsValide('x'.repeat(ADS_BORNES.nom + 1))).toBe(false);
    expect(nomObjetAdsValide(' compte-fictif-01')).toBe(false);
    expect(nomObjetAdsValide('compte\u0007fictif')).toBe(false);
    expect(nomObjetAdsValide('')).toBe(false);
  });

  it('bornes : type, niveau, note, noms par point, points par import, plus de noms que d’objets, doublons', () => {
    expect(PointAds.safeParse(point({ type: 0 })).success).toBe(false);
    expect(PointAds.safeParse(point({ type: 4 })).success).toBe(false);
    expect(PointAds.safeParse(point({ type: '3' })).success).toBe(false);
    expect(PointAds.safeParse(point({ niveau: 6 })).success).toBe(false);
    expect(PointAds.safeParse(point({ objets: 1 })).success).toBe(false);
    expect(PointAds.safeParse(point({ nature: 'mot_de_passe' })).success).toBe(false);
    const doublon = { nom: 'compte-fictif-01', nature: 'utilisateur' };
    expect(PointAds.safeParse(point({ noms: [doublon, doublon] })).success).toBe(false);
    const noms = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ nom: `compte-fictif-${i}`, nature: 'utilisateur' }));
    expect(PointAds.safeParse(point({ noms: noms(ADS_BORNES.nomsParPoint), objets: 5000 })).success).toBe(true);
    expect(PointAds.safeParse(point({ noms: noms(ADS_BORNES.nomsParPoint + 1), objets: 5000 })).success).toBe(false);
    expect(PointAds.safeParse(point({ identifiant: 'vuln1 avec espace' })).success).toBe(false);
    expect(PointAds.safeParse(point({ titre: 'x'.repeat(ADS_BORNES.titre + 1) })).success).toBe(false);
    expect(RapportAds.safeParse(rapport({ note: 0 })).success).toBe(false);
    expect(RapportAds.safeParse(rapport({ note: 3.5 })).success).toBe(false);
    expect(RapportAds.safeParse(rapport({ date: '2026-11-20T10:00:00' })).success).toBe(false);
    expect(
      RapportAds.safeParse(rapport({ progression: [{ niveau: 1, conformes: 6, total: 5, pourcentage: null }] }))
        .success,
    ).toBe(false);
    expect(
      RapportAds.safeParse(rapport({ progression: [{ niveau: 1, conformes: null, total: null, pourcentage: 33.33 }] }))
        .success,
    ).toBe(false);
    const pts = Array.from({ length: ADS_BORNES.points + 1 }, (_, i) => point({ identifiant: `vuln1_p${i}` }));
    expect(ImportAds.safeParse({ rapport: rapport(), points: pts, ecartes: ecartsAdsVides() }).success).toBe(false);
    expect(
      ImportAds.safeParse({ rapport: rapport(), points: [point(), point()], ecartes: ecartsAdsVides() }).success,
    ).toBe(false);
  });

  it('le pire corps admis tient sous la borne du corps de la requête', () => {
    const nom = 'x'.repeat(ADS_BORNES.nom - 3);
    const p = (i: number) =>
      point({
        identifiant: `vuln1_${'r'.repeat(80)}${i}`,
        reference: 'r'.repeat(ADS_BORNES.reference),
        titre: 't'.repeat(ADS_BORNES.titre),
        objets: ADS_BORNES.objetsMax,
        noms: Array.from({ length: ADS_BORNES.nomsParPoint }, (_, j) => ({ nom: `${nom}${j}`, nature: 'approbation' })),
      });
    const corps = {
      rapport: rapport(),
      points: Array.from({ length: ADS_BORNES.points }, (_, i) => p(i)),
      ecartes: ecartsAdsVides(),
    };
    expect(ImportAds.safeParse(corps).success).toBe(true);
    expect(JSON.stringify(corps).length).toBeLessThan(ADS_BORNES.corps);
  });
});

describe('libellés et calculs', () => {
  it('type en numéro et libellé ; variation ; évolution de la note ; comptage par niveau et type', () => {
    expect(libelleTypeAds(1)).toBe('1 · information');
    expect(libelleTypeAds(2)).toBe('2 · avertissement');
    expect(libelleTypeAds(3)).toBe('3 · vulnérabilité');
    expect(variationAds({ objets: 5, objetsAvant: 3, apparu: false })).toBe('+2');
    expect(variationAds({ objets: 1, objetsAvant: 3, apparu: false })).toBe('−2');
    expect(variationAds({ objets: 3, objetsAvant: 3, apparu: false })).toBe('=');
    expect(variationAds({ objets: 3, objetsAvant: null, apparu: true })).toBe('apparu');
    expect(variationAds({ objets: 3, objetsAvant: null, apparu: false })).toBe('—');
    const imp = (note: number) => ({ note }) as ImportAdsDto;
    expect(evolutionNoteAds(imp(4), imp(3))).toBe(1);
    expect(evolutionNoteAds(imp(4), null)).toBeNull();
    const m = pointsParNiveauEtType([
      { niveau: 1, type: 3 },
      { niveau: 1, type: 3 },
      { niveau: 4, type: 2 },
    ]);
    expect(m[1]).toEqual({ 1: 0, 2: 0, 3: 2 });
    expect(m[4]).toEqual({ 1: 0, 2: 1, 3: 0 });
    expect(m[5]).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});
