/* Veille des vulnérabilités (ADR 0100, lots V2 et V3) : liste fermée des sources, formes contrôlées des identifiants et des
   adresses, éléments rapportés par l'exécutant validés strictement (texte non nettoyé, identifiant mal formé, adresse hors
   de l'hôte de la source refusés), lots et bilans bornés. Données fictives ou de forme publique. */
import { describe, expect, it } from 'vitest';
import {
  ADRESSE_CERTFR,
  ADRESSE_CERTSANTE,
  BilanCollecte,
  CERTFR_ID,
  CERTSANTE_ID,
  CVE_ID,
  CVSS31_VECTEUR,
  CVSS40_VECTEUR,
  DemandeCollecte,
  ELEMENT_VEILLE,
  ElementCertFr,
  ElementCertSante,
  ElementEpss,
  ElementKev,
  ElementNvd,
  VERSION_CPE,
  LotVeille,
  RapportCollecte,
  RechercheAvis,
  RechercheFailles,
  SLUG_CERTSANTE,
  SOURCES_VEILLE,
  SOURCES_VEILLE_DEFINITIONS,
  texteExterneValide,
  VEILLE_BORNES,
  sourceVeille,
} from '../src/index.js';

const kev = {
  cve: 'CVE-2026-0001',
  editeur: 'Éditeur fictif',
  produit: 'Produit fictif',
  nom: 'Fictional Vulnerability',
  description: 'Fictional description.',
  action: 'Apply mitigations per vendor instructions.',
  ajoutLe: '2026-11-13',
  echeance: '2026-12-04',
  rancongiciel: false,
};
const nvd = {
  cve: 'CVE-2026-0002',
  publieLe: '2026-06-26T15:16:40.587Z',
  modifieLe: '2026-11-14T19:16:50.940Z',
  description: 'Fictional description.',
  cvss31: { score: 9.3, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:L', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['produit_fictif'],
  produitsTouches: [
    {
      partie: 'a',
      editeur: 'editeur_fictif',
      produit: 'produit_fictif',
      version: null,
      debutInclus: '1.0',
      debutExclus: null,
      finInclus: null,
      finExclus: '1.4.2',
      vulnerable: true,
    },
  ],
  produitsTronques: false,
};
const certfr = {
  identifiant: 'CERTFR-2026-AVI-1500',
  nature: 'avis',
  titre: 'Multiples vulnérabilités dans un produit fictif',
  resume: 'Résumé fictif.',
  adresse: 'https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-1500/',
  publieLe: '2026-11-12T00:00:00.000Z',
  cves: ['CVE-2026-0003'],
  cvesLues: true,
};
const certsante = {
  identifiant: '10351',
  nature: 'alerte',
  titre: 'Produit fictif - CVE-2026-0004',
  resume: '',
  adresse: 'https://cyberveille.esante.gouv.fr/alertes/produit-fictif-cve-2026-0004-2026-11-13',
  publieLe: null,
  cves: ['CVE-2026-0004'],
  cvesLues: true,
  produit: 'Produit fictif',
  fiche: { exploitee: 'oui', correctif: 'oui', contournement: null, preuveConcept: 'indisponible', cvss31: 7.5 },
};

describe('liste fermée des sources', () => {
  it('fiches du CERT Santé : même hôte, chemin à motif strict, lectures bornées', () => {
    expect(sourceVeille('cert-sante').chemins).toEqual(['/alertes-et-vulnerabilites/rss.xml', '/alertes/{slug}']);
    expect(SLUG_CERTSANTE.test('openssh-cve-2026-123158-2026-11-06')).toBe(true);
    for (const ko of ['', '../rss.xml', 'a/b', 'A-B', 'x?y=1', 'x'.repeat(201), 'x%2f'])
      expect(SLUG_CERTSANTE.test(ko), ko).toBe(false);
    expect(VEILLE_BORNES.fichesCertSante).toBe(30);
    expect(sourceVeille('cert-sante').demande).toMatch(/30 au plus par collecte/);
  });
  it('cinq sources, dans l’ordre des identifiants stables, chacune avec son hôte et ses chemins', () => {
    expect(SOURCES_VEILLE).toEqual(['cisa-kev', 'nvd', 'epss', 'cert-fr', 'cert-sante']);
    expect(SOURCES_VEILLE_DEFINITIONS.map((s) => s.id)).toEqual([...SOURCES_VEILLE]);
    expect(SOURCES_VEILLE_DEFINITIONS.map((s) => s.hote)).toEqual([
      'www.cisa.gov',
      'services.nvd.nist.gov',
      'api.first.org',
      'cert.cyber.gouv.fr',
      'cyberveille.esante.gouv.fr',
    ]);
    for (const s of SOURCES_VEILLE_DEFINITIONS) {
      expect(s.chemins.length, s.id).toBeGreaterThan(0);
      for (const c of s.chemins) expect(c, s.id).toMatch(/^\/[A-Za-z0-9/._{}-]+$/);
      expect(s.demande, s.id).not.toBe('');
    }
    // NVD par fenêtre de dates, EPSS sur des failles déjà connues : jamais par produit.
    expect(sourceVeille('nvd').demande).toMatch(/fenêtre de dates, jamais par produit/);
    expect(sourceVeille('epss').demande).toMatch(/jamais une liste tirée du parc/);
    expect(sourceVeille('cert-fr').hote).not.toContain('ssi.gouv.fr');
  });
  it('un élément a un schéma par source', () => {
    expect(Object.keys(ELEMENT_VEILLE).sort()).toEqual([...SOURCES_VEILLE].sort());
  });
});

describe('formes contrôlées', () => {
  it('identifiants CVE, CERT-FR et CERT Santé', () => {
    for (const ok of ['CVE-2026-0001', 'CVE-2026-125742', 'CVE-1999-0001']) expect(CVE_ID.test(ok), ok).toBe(true);
    for (const ko of [
      'CVE-26-0001',
      'cve-2026-0001',
      'CVE-2026-001',
      'CVE-2026-0001 ',
      'CVE-2026-0001<x>',
      'XCVE-2026-0001',
      // Chiffres Unicode (pleine chasse, arabes-indiens) : refusés, ici comme dans les scripts (relecture de la PR #369).
      'CVE-２０２６-0001',
      'CVE-2026-٠٠٠١',
    ])
      expect(CVE_ID.test(ko), ko).toBe(false);
    for (const ok of ['CERTFR-2026-AVI-1500', 'CERTFR-2015-ALE-009', 'CERTFR-2026-ALE-015'])
      expect(CERTFR_ID.test(ok), ok).toBe(true);
    for (const ko of ['CERTFR-2026-XYZ-001', 'CERTA-2009-AVI-001', 'CERTFR-2026-AVI-15000', '../CERTFR-2026-AVI-1'])
      expect(CERTFR_ID.test(ko), ko).toBe(false);
    expect(CERTSANTE_ID.test('10351')).toBe(true);
    for (const ko of ['0', '012', 'abc', '1'.repeat(11)]) expect(CERTSANTE_ID.test(ko), ko).toBe(false);
  });
  it('adresses d’avis : https, sur l’hôte de la source, chemin d’avis seulement', () => {
    expect(ADRESSE_CERTFR.test('https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-015/')).toBe(true);
    for (const ko of [
      'http://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-1500/',
      'https://www.cert.ssi.gouv.fr/avis/CERTFR-2026-AVI-1500/',
      'https://cert.cyber.gouv.fr.exemple.test/avis/CERTFR-2026-AVI-1500/',
      'https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-1500/?x=1',
      'javascript:alert(1)',
    ])
      expect(ADRESSE_CERTFR.test(ko), ko).toBe(false);
    expect(ADRESSE_CERTSANTE.test(certsante.adresse)).toBe(true);
    for (const ko of [
      'https://cyberveille.esante.gouv.fr/autre/page',
      'https://cyberveille.esante.gouv.fr/alertes/x?redirect=https://ailleurs',
      'https://exemple.test/alertes/x',
    ])
      expect(ADRESSE_CERTSANTE.test(ko), ko).toBe(false);
  });
  it('vecteurs CVSS 3.1 et 4.0 publiés par NVD', () => {
    expect(CVSS31_VECTEUR.test(nvd.cvss31.vecteur)).toBe(true);
    expect(
      CVSS40_VECTEUR.test(
        'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N/E:X/CR:X/IR:X/AR:X/S:N/AU:Y/R:U/V:D/RE:M/U:Amber',
      ),
    ).toBe(true);
    expect(CVSS31_VECTEUR.test('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:L')).toBe(false);
    expect(CVSS31_VECTEUR.test('CVSS:3.1/AV:N<script>')).toBe(false);
  });
  it('texte externe : une ligne, sans contrôle, sans caractère invisible, sans balise', () => {
    expect(texteExterneValide('Texte simple, versions < 2.4 et > 2.0.')).toBe(true);
    for (const ko of ['a\nb', 'a\u0000b', 'a‮b', 'a​b', '<script>x</script>', 'a <img src=x>', ' bord'])
      expect(texteExterneValide(ko), JSON.stringify(ko)).toBe(false);
  });
});

describe('éléments rapportés par l’exécutant', () => {
  it('formes réelles acceptées', () => {
    expect(ElementKev.safeParse(kev).success).toBe(true);
    expect(ElementNvd.safeParse(nvd).success).toBe(true);
    expect(
      ElementEpss.safeParse({ cve: 'CVE-2026-0002', score: 0.00508, centile: 0.43875, date: '2026-11-15' }).success,
    ).toBe(true);
    expect(ElementCertFr.safeParse(certfr).success).toBe(true);
    expect(ElementCertSante.safeParse(certsante).success).toBe(true);
  });
  it('champ inattendu, identifiant mal formé, texte non nettoyé ou trop long refusés', () => {
    expect(ElementKev.safeParse({ ...kev, notes: 'x' }).success).toBe(false);
    expect(ElementKev.safeParse({ ...kev, cve: 'CVE-2026-1' }).success).toBe(false);
    expect(ElementKev.safeParse({ ...kev, action: '<b>Apply</b>' }).success).toBe(false);
    expect(ElementKev.safeParse({ ...kev, description: 'x'.repeat(VEILLE_BORNES.description + 1) }).success).toBe(
      false,
    );
    expect(ElementKev.safeParse({ ...kev, ajoutLe: '13/11/2026' }).success).toBe(false);
    expect(ElementNvd.safeParse({ ...nvd, editeurs: Array(VEILLE_BORNES.nomsCpe + 1).fill('x') }).success).toBe(false);
    expect(ElementNvd.safeParse({ ...nvd, produits: ['<x>'] }).success).toBe(false);
    expect(ElementNvd.safeParse({ ...nvd, cvss31: { ...nvd.cvss31, score: 11 } }).success).toBe(false);
    expect(ElementNvd.safeParse({ ...nvd, cvss31: { ...nvd.cvss31, gravite: 'SEVERE' } }).success).toBe(false);
  });
  it('produits touchés (lot V4a) : forme stricte, bornes cohérentes, nombre borné, drapeau de troncature exigé', () => {
    const t = nvd.produitsTouches[0]!;
    const avec = (x: Record<string, unknown>) => ElementNvd.safeParse({ ...nvd, produitsTouches: [{ ...t, ...x }] });
    expect(avec({ version: '2.0', debutInclus: null, finExclus: null }).success).toBe(true);
    expect(avec({ vulnerable: false }).success).toBe(true);
    expect(avec({ partie: 'x' }).success).toBe(false);
    expect(avec({ debutExclus: '1.0' }).success).toBe(false);
    expect(avec({ finInclus: '1.4' }).success).toBe(false);
    expect(avec({ finExclus: '1 .4' }).success).toBe(false);
    expect(avec({ finExclus: '<script>' }).success).toBe(false);
    expect(avec({ finExclus: '1'.repeat(61) }).success).toBe(false);
    expect(avec({ editeur: '*'.repeat(101) }).success).toBe(false);
    expect(avec({ cpe: 'x' }).success).toBe(false);
    expect(
      ElementNvd.safeParse({ ...nvd, produitsTouches: Array(VEILLE_BORNES.produitsTouches + 1).fill(t) }).success,
    ).toBe(false);
    const { produitsTronques: _, ...sansDrapeau } = nvd;
    expect(ElementNvd.safeParse(sansDrapeau).success).toBe(false);
    expect(VERSION_CPE.test('10.1.2')).toBe(true);
    expect(VERSION_CPE.test('2024-05-01_rc1')).toBe(true);
  });
  it('EPSS publie une probabilité entre 0 et 1 : un pourcentage est refusé', () => {
    expect(ElementEpss.safeParse({ cve: 'CVE-2026-0002', score: 50.8, centile: 0.4, date: '2026-11-15' }).success).toBe(
      false,
    );
  });
  it('avis : identifiant, nature et adresse cohérents avec la source', () => {
    expect(ElementCertFr.safeParse({ ...certfr, identifiant: 'CERTFR-2026-XYZ-1500' }).success).toBe(false);
    expect(ElementCertFr.safeParse({ ...certfr, nature: 'alerte' }).success).toBe(false);
    expect(ElementCertFr.safeParse({ ...certfr, adresse: 'https://exemple.test/avis/' }).success).toBe(false);
    expect(ElementCertFr.safeParse({ ...certfr, adresse: null }).success).toBe(true);
    expect(ElementCertFr.safeParse({ ...certfr, titre: '' }).success).toBe(false);
    expect(ElementCertFr.safeParse({ ...certfr, titre: 'Titre <script>alert(1)</script>' }).success).toBe(false);
    expect(ElementCertFr.safeParse({ ...certfr, cves: ['CVE-2026-0003', 'pas-une-cve'] }).success).toBe(false);
    expect(
      ElementCertFr.safeParse({ ...certfr, cves: Array(VEILLE_BORNES.cvesParAvis + 1).fill('CVE-2026-0003') }).success,
    ).toBe(false);
    expect(ElementCertSante.safeParse({ ...certsante, identifiant: 'CERTFR-2026-AVI-1500' }).success).toBe(false);
    expect(ElementCertSante.safeParse({ ...certsante, adresse: certfr.adresse }).success).toBe(false);
  });
  it('CERT Santé (V23) : produit cité et mentions de la fiche, forme stricte ; fiche non lue : null', () => {
    expect(ElementCertSante.safeParse({ ...certsante, produit: null, fiche: null }).success).toBe(true);
    const fiche = (x: Record<string, unknown>) =>
      ElementCertSante.safeParse({ ...certsante, fiche: { ...certsante.fiche, ...x } }).success;
    expect(fiche({ exploitee: null, correctif: null, contournement: 'non', preuveConcept: 'disponible' })).toBe(true);
    expect(fiche({ cvss31: null })).toBe(true);
    // Valeur hors liste (« Oui » brut, « exploitable », booléen), score hors échelle, champ inattendu : refusés.
    for (const x of [
      { exploitee: 'Oui' },
      { exploitee: true },
      { preuveConcept: 'oui' },
      { correctif: 'peut-être' },
      { cvss31: 10.5 },
      { cvss31: '7.5' },
      { texte: 'La faille est activement exploitée' },
    ])
      expect(fiche(x), JSON.stringify(x)).toBe(false);
    const { fiche: _f, ...sansFiche } = certsante;
    expect(ElementCertSante.safeParse(sansFiche).success).toBe(false);
    expect(ElementCertSante.safeParse({ ...certsante, produit: '<b>Produit</b>' }).success).toBe(false);
    // Le CERT-FR ne porte ni produit ni fiche.
    expect(ElementCertFr.safeParse({ ...certfr, fiche: null }).success).toBe(false);
  });
});

describe('protocole de l’exécutant', () => {
  it('lot borné, non vide, sans champ inattendu', () => {
    expect(LotVeille.safeParse({ elements: [kev] }).success).toBe(true);
    expect(LotVeille.safeParse({ elements: [] }).success).toBe(false);
    expect(LotVeille.safeParse({ elements: Array(VEILLE_BORNES.lot + 1).fill(kev) }).success).toBe(false);
    expect(LotVeille.safeParse({ elements: [kev], source: 'nvd' }).success).toBe(false);
  });
  it('rapport : succès avec bilan, échec avec erreur sur une ligne', () => {
    const bilan = { elements: 2, ecartes: 0, tronque: false, detailsEchoues: 0 };
    expect(RapportCollecte.safeParse({ ok: true, bilan, erreur: null }).success).toBe(true);
    expect(RapportCollecte.safeParse({ ok: false, bilan: null, erreur: 'Délai dépassé.' }).success).toBe(true);
    expect(RapportCollecte.safeParse({ ok: true, bilan: null, erreur: null }).success).toBe(false);
    expect(RapportCollecte.safeParse({ ok: false, bilan: null, erreur: 'ligne 1\nligne 2' }).success).toBe(false);
    expect(RapportCollecte.safeParse({ ok: true, bilan, erreur: null, elements: [] }).success).toBe(false);
    expect(BilanCollecte.safeParse({ ...bilan, elements: VEILLE_BORNES.lot * VEILLE_BORNES.lots + 1 }).success).toBe(
      false,
    );
  });
});

describe('routes', () => {
  it('collecte : une source connue, ou toutes', () => {
    expect(DemandeCollecte.safeParse({}).success).toBe(true);
    expect(DemandeCollecte.safeParse({ source: 'nvd' }).success).toBe(true);
    expect(DemandeCollecte.safeParse({ source: 'autre' }).success).toBe(false);
  });
  it('recherche : texte borné, page bornée, filtres fermés', () => {
    expect(RechercheAvis.parse({})).toEqual({ page: 1 });
    expect(RechercheAvis.parse({ q: ' CVE-2026 ', page: '2' })).toEqual({ q: 'CVE-2026', page: 2 });
    expect(RechercheAvis.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
    expect(RechercheAvis.safeParse({ source: 'nvd' }).success).toBe(false);
    expect(RechercheFailles.safeParse({ kev: 'oui' }).success).toBe(true);
    expect(RechercheFailles.safeParse({ kev: 'non' }).success).toBe(false);
    expect(RechercheFailles.safeParse({ page: '0' }).success).toBe(false);
  });
});
