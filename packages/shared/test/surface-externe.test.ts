/* Module Vulnérabilités (ADR 0100, lot ALH1) : schémas de la surface externe lue dans AlgoLightHouse. Éléments rapportés par
   l'exécutant validés strictement (liste blanche : un champ de plus est refusé), textes externes nettoyés, bornes, bilan,
   recherches et liaison. Données fictives : domaines en .example, adresses de 192.0.2.0/24 et 198.51.100.0/24. */
import { describe, expect, it } from 'vitest';
import {
  ALH_BORNES,
  BilanSynchronisationAlh,
  CRITICITES_ALH,
  ElementSurfaceExterne,
  erreurAdresseAlh,
  LiaisonPerimetreAlh,
  memeVersionDetectee,
  rapprochementTechnologie,
  RechercheAlertesAlh,
  RechercheTechnologiesAlh,
  STATUTS_ALERTE_ALH,
  STATUTS_ALERTE_ALH_OUVERTS,
  TENABLE_BORNES,
  TYPES_ALERTE_ALH,
} from '../src/index.js';

const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const alerte = (extra: Record<string, unknown> = {}) => ({
  type: 'alerte',
  id: U(31),
  perimetre: U(1),
  typeAlerte: 'vulnerable_service',
  criticite: 'critical',
  statut: 'untreated',
  titre: 'Exposed RDP service (fictif)',
  verifiee: true,
  detail: true,
  cibleType: 'host',
  cibleValeur: '192.0.2.10',
  cibleHote: U(11),
  cibleDomaine: null,
  cves: ['CVE-2026-91001'],
  defauts: [],
  creeLe: '2026-11-10T10:00:00.000Z',
  majLe: null,
  termineeLe: null,
  ...extra,
});
const hote = (extra: Record<string, unknown> = {}) => ({
  type: 'hote',
  id: U(11),
  perimetre: null,
  statut: 'monitored',
  adresse: '198.51.100.20',
  fai: 'FAI fictif',
  asn: '64500',
  pays: 'FR',
  mutualise: null,
  cdn: false,
  joignable: true,
  joignableLe: null,
  importManuel: false,
  creeLe: null,
  majLe: null,
  ...extra,
});

describe('surface externe : valeurs de l’éditeur', () => {
  it('cinq types d’alerte, tous repris ; quatre criticités ; statuts ouverts parmi les statuts', () => {
    expect([...TYPES_ALERTE_ALH].sort()).toEqual([
      'config_defect',
      'data_leak',
      'exposed_service',
      'typosquatting',
      'vulnerable_service',
    ]);
    expect(CRITICITES_ALH).toEqual(['critical', 'major', 'important', 'minor']);
    for (const s of STATUTS_ALERTE_ALH_OUVERTS) expect(STATUTS_ALERTE_ALH).toContain(s);
    expect(STATUTS_ALERTE_ALH_OUVERTS).not.toContain('completed');
  });

  it('adresse : espace chez l’éditeur seulement', () => {
    expect(erreurAdresseAlh('https://espace-fictif.algolighthouse.fr/')).toBeNull();
    for (const a of [
      '',
      'https://algolighthouse.fr',
      'https://x.algolighthouse.fr:8443',
      'https://x.algolighthouse.fr.example',
    ])
      expect(erreurAdresseAlh(a), a).not.toBeNull();
  });
});

describe('surface externe : éléments rapportés par l’exécutant', () => {
  it('liste blanche : un champ de l’éditeur hors liste (note, pièces jointes, données sensibles) fait refuser l’élément', () => {
    expect(ElementSurfaceExterne.safeParse(alerte()).success).toBe(true);
    for (const champ of ['note', 'uploads', 'sensitive_data', 'has_sensitive_data', 'comments', 'data', 'defects'])
      expect(ElementSurfaceExterne.safeParse(alerte({ [champ]: 'x' })).success, champ).toBe(false);
    expect(ElementSurfaceExterne.safeParse(hote({ note: 'x' })).success).toBe(false);
  });

  it('cible et CVE ne viennent que du détail ; texte externe nettoyé ; identifiants en minuscules', () => {
    expect(ElementSurfaceExterne.safeParse(alerte({ detail: false })).success).toBe(false);
    expect(
      ElementSurfaceExterne.safeParse(
        alerte({ detail: false, cves: [], cibleType: null, cibleValeur: null, cibleHote: null }),
      ).success,
    ).toBe(true);
    for (const titre of ['<script>x</script>', 'ligne\nsuivante', ' espace', 'x'.repeat(ALH_BORNES.titre + 1)])
      expect(ElementSurfaceExterne.safeParse(alerte({ titre })).success, titre).toBe(false);
    expect(ElementSurfaceExterne.safeParse(alerte({ id: U(31).toUpperCase() })).success).toBe(false);
    expect(ElementSurfaceExterne.safeParse(alerte({ cves: ['CVE-2026-91001', 'CVE-2026-91001'] })).success).toBe(false);
    expect(ElementSurfaceExterne.safeParse(alerte({ typeAlerte: 'phishing' })).success).toBe(false);
  });

  it('hôte : une seule adresse IP ; domaine en minuscules ; technologie, liens et CVE bornés', () => {
    expect(ElementSurfaceExterne.safeParse(hote({ adresse: '192.0.2.1, 192.0.2.2' })).success).toBe(false);
    expect(ElementSurfaceExterne.safeParse(hote({ pays: 'fr' })).success).toBe(false);
    const domaine = {
      type: 'domaine',
      id: U(21),
      perimetre: U(1),
      statut: null,
      domaine: '*.exemple-fictif.example',
      niveau: 2,
      importManuel: null,
      adresse: null,
      parent: null,
      creeLe: null,
      majLe: null,
    };
    expect(ElementSurfaceExterne.safeParse(domaine).success).toBe(true);
    expect(ElementSurfaceExterne.safeParse({ ...domaine, domaine: 'Exemple.example' }).success).toBe(false);
    expect(ElementSurfaceExterne.safeParse({ ...domaine, domaine: 'exemple.example/chemin' }).success).toBe(false);
    const cve = {
      type: 'technologie_cve',
      technologie: 'f5|nginx|',
      version: '',
      cve: 'CVE-2026-92001',
      titre: null,
      cvss: 7.5,
      epss: 0.42,
      severite: 'high',
      preuve: true,
      exploitee: false,
      publieeLe: null,
    };
    expect(ElementSurfaceExterne.safeParse(cve).success).toBe(true);
    // EPSS entre 0 et 1, jamais en pourcentage.
    expect(ElementSurfaceExterne.safeParse({ ...cve, epss: 42 }).success).toBe(false);
    expect(ElementSurfaceExterne.safeParse({ ...cve, cvss: 11 }).success).toBe(false);
  });

  it('bilan : nombres seulement, bornés ; même lot et mêmes lots que Tenable', () => {
    const b = {
      elements: 10,
      perimetres: 1,
      hotes: 2,
      domaines: 2,
      alertes: 3,
      details: 3,
      technologies: 1,
      ecartes: 0,
      tronque: false,
    };
    expect(BilanSynchronisationAlh.safeParse(b).success).toBe(true);
    expect(BilanSynchronisationAlh.safeParse({ ...b, inventaire: { ok: true, erreur: null } }).success).toBe(false);
    expect(BilanSynchronisationAlh.safeParse({ ...b, details: ALH_BORNES.details + 1 }).success).toBe(false);
    expect([ALH_BORNES.lot, ALH_BORNES.lots]).toEqual([TENABLE_BORNES.lot, TENABLE_BORNES.lots]);
  });
});

describe('surface externe : défauts et résolutions de l’éditeur (lot ALH2)', () => {
  const defaut = {
    nom: 'Exposed port or service',
    description: 'Service accessible depuis Internet.',
    resolutions: [{ nom: 'Restrict access', description: null, facilite: 'Quick Win', gain: 'Strong' }],
  };
  it('liste blanche, texte simple, bornés ; seulement avec le détail', () => {
    expect(ElementSurfaceExterne.safeParse(alerte({ defauts: [defaut] })).success).toBe(true);
    expect(ElementSurfaceExterne.safeParse(alerte({ defauts: undefined })).success).toBe(false);
    expect(
      ElementSurfaceExterne.safeParse(
        alerte({ detail: false, cves: [], cibleType: null, cibleValeur: null, cibleHote: null, defauts: [defaut] }),
      ).success,
    ).toBe(false);
    for (const mauvais of [
      { ...defaut, description: '<p>balisé</p>' },
      { ...defaut, nom: '' },
      { ...defaut, category: 'x' },
      { ...defaut, description: 'x'.repeat(ALH_BORNES.descriptionDefaut + 1) },
      { ...defaut, resolutions: [{ ...defaut.resolutions[0], note: 'x' }] },
      { ...defaut, resolutions: Array(ALH_BORNES.resolutionsParDefaut + 1).fill(defaut.resolutions[0]) },
    ])
      expect(ElementSurfaceExterne.safeParse(alerte({ defauts: [mauvais] })).success).toBe(false);
    expect(
      ElementSurfaceExterne.safeParse(alerte({ defauts: Array(ALH_BORNES.defautsParAlerte + 1).fill(defaut) })).success,
    ).toBe(false);
  });
});

describe('surface externe : rapprochement avec les produits surveillés (lot ALH2)', () => {
  it('par CPE si le produit en porte un, sinon par noms normalisés ; sans éditeur ou produit : rien', () => {
    const t = { editeur: 'Apache', produit: 'HTTP_Server' };
    expect(rapprochementTechnologie(t, { editeur: 'Apache', nom: 'HTTP Server', cpe: null })).toBe('nom');
    expect(
      rapprochementTechnologie(t, {
        editeur: 'Fondation fictive',
        nom: 'Serveur web',
        cpe: 'cpe:2.3:a:apache:http_server:*:*:*:*:*:*:*:*',
      }),
    ).toBe('cpe');
    // Un CPE qui ne correspond pas l'emporte sur le nom : pas de rapprochement.
    expect(
      rapprochementTechnologie(t, {
        editeur: 'Apache',
        nom: 'HTTP Server',
        cpe: 'cpe:2.3:a:apache:tomcat:*:*:*:*:*:*:*:*',
      }),
    ).toBeNull();
    expect(
      rapprochementTechnologie({ editeur: null, produit: 'nginx' }, { editeur: 'F5', nom: 'nginx', cpe: null }),
    ).toBeNull();
    expect(
      rapprochementTechnologie({ editeur: 'F5', produit: 'nginx' }, { editeur: 'F5', nom: 'nginx plus', cpe: null }),
    ).toBeNull();
  });
  it('version déclarée parmi les versions détectées : vrai, faux, ou non comparable', () => {
    expect(memeVersionDetectee(['1.18.0', '1.20'], '1.18')).toBe(true);
    expect(memeVersionDetectee(['1.18.0'], '1.19')).toBe(false);
    expect(memeVersionDetectee(['1.18.0-rc1'], '1.19')).toBeNull();
    expect(memeVersionDetectee([''], '1.19')).toBeNull();
    expect(memeVersionDetectee([], '1.19')).toBeNull();
  });
});

describe('surface externe : lecture et liaison', () => {
  it('recherches strictes ; liaison : un périmètre ou null', () => {
    expect(RechercheAlertesAlh.parse({})).toEqual({ page: 1 });
    expect(RechercheAlertesAlh.parse({ statut: 'toutes', page: '2' })).toEqual({ statut: 'toutes', page: 2 });
    expect(RechercheAlertesAlh.safeParse({ statut: 'fermee' }).success).toBe(false);
    expect(RechercheAlertesAlh.safeParse({ autre: 'x' }).success).toBe(false);
    expect(RechercheTechnologiesAlh.safeParse({ exploitee: 'non' }).success).toBe(false);
    expect(RechercheAlertesAlh.parse({ tri: 'priorite' })).toEqual({ tri: 'priorite', page: 1 });
    expect(RechercheTechnologiesAlh.parse({ tri: 'priorite' })).toEqual({ tri: 'priorite', page: 1 });
    expect(RechercheAlertesAlh.safeParse({ tri: 'criticite' }).success).toBe(false);
    expect(LiaisonPerimetreAlh.safeParse({ perimetreId: null }).success).toBe(true);
    expect(LiaisonPerimetreAlh.safeParse({ perimetreId: U(1) }).success).toBe(true);
    expect(LiaisonPerimetreAlh.safeParse({ perimetreId: 'aucun' }).success).toBe(false);
    expect(LiaisonPerimetreAlh.safeParse({}).success).toBe(false);
  });
});
