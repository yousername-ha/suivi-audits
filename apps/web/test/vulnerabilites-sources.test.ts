/* Module Vulnérabilités (ADR 0100, décisions V23, V24, V26 et V27 ; lot V4c) : plusieurs sources. Présentation de ce que
   chaque source dit d'une faille (exploitation avérée et « exploitable » avec la première source et sa date, valeurs par
   source et celle retenue, mentions du CERT Santé telles quelles), état de la lecture des fiches du CERT Santé, bouton
   « Annuler la décision » réservé au droit de modifier. Données fictives. */
import { MantineProvider } from '@mantine/core';
import type { AvisVeilleDto, FailleVeilleDto, RapprochementDto, SourcesFailleDto } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RapprochementsProduit } from '../src/vulnerabilites/ProduitsSurveilles';
import { libelleAnnulation } from '../src/vulnerabilites/produits';
import {
  libelleMention,
  libellePreuve,
  lignesValeurs,
  marquesSources,
  mentionsFiche,
  resumeExploitable,
  resumeExploitation,
  resumeFichesCertSante,
  resumePublications,
} from '../src/vulnerabilites/sources';
import { MarquesSources, SourcesFaille } from '../src/vulnerabilites/SourcesFaille';
import { AvisTable, FaillesTable, FichesCertSante } from '../src/vulnerabilites/Veille';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const rien = () => undefined;

const sources: SourcesFailleDto = {
  exploitation: [
    { source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' },
    { source: 'kev', le: '2026-11-13T00:00:00.000Z' },
  ],
  exploitable: [{ source: 'tenable', le: null }],
  valeurs: {
    gravites: [
      { source: 'nvd', gravite: 'elevee' },
      { source: 'cert-sante', gravite: 'critique' },
    ],
    cvss: [
      { source: 'nvd', score: 7.5 },
      { source: 'cert-sante', score: 9.8 },
    ],
    epss: [{ source: 'first', score: 0.123 }],
  },
  certSante: { correctif: 'oui', contournement: null },
};
const VIDES: SourcesFailleDto = {
  exploitation: [],
  exploitable: [],
  valeurs: { gravites: [], cvss: [], epss: [] },
  certSante: null,
};

describe('présentation des sources', () => {
  it('exploitation et « exploitable » : sources de la première à la dernière, avec leur date', () => {
    expect(resumeExploitation(sources)).toBe('fiche du CERT Santé (le 10/11/2026), catalogue KEV (le 13/11/2026)');
    expect(resumeExploitable(sources)).toBe('Tenable');
    expect(resumeExploitation(VIDES)).toBeNull();
    expect(marquesSources(sources)).toEqual([
      {
        libelle: 'Exploitation avérée (2 sources)',
        detail: 'd’abord fiche du CERT Santé (le 10/11/2026)',
        etat: 'erreur',
      },
      { libelle: 'Exploitable', detail: 'd’abord Tenable', etat: 'attention' },
    ]);
    expect(marquesSources(VIDES)).toEqual([]);
  });

  it('valeurs par source, chacune gardée ; la plus sévère marquée « retenue »', () => {
    expect(lignesValeurs(sources)).toEqual([
      { fait: 'Gravité', source: 'NVD', valeur: 'Élevée', retenue: false },
      { fait: 'Gravité', source: 'CERT Santé', valeur: 'Critique', retenue: true },
      { fait: 'Score CVSS', source: 'NVD', valeur: '7,5', retenue: false },
      { fait: 'Score CVSS', source: 'CERT Santé', valeur: '9,8', retenue: true },
      { fait: 'Score EPSS', source: 'FIRST (veille)', valeur: '12,3 %', retenue: true },
    ]);
  });

  it('mentions du CERT Santé telles quelles ; non renseignée n’est jamais « Non »', () => {
    expect([libelleMention('oui'), libelleMention('non'), libelleMention(null)]).toEqual([
      'Oui',
      'Non',
      'Non renseignée',
    ]);
    expect([libellePreuve('disponible'), libellePreuve('indisponible'), libellePreuve(null)]).toEqual([
      'Disponible',
      'Aucune en sources ouvertes',
      'Non renseignée',
    ]);
    expect(
      mentionsFiche({
        exploitee: 'oui',
        correctif: null,
        contournement: 'non',
        preuveConcept: null,
        cvss31: 8.8,
        lueLe: '2026-11-16T05:00:00.000Z',
        exploiteeLe: '2026-11-10T02:28:01.000Z',
        preuveLe: null,
      }).map((m) => `${m.libelle} : ${m.valeur}`),
    ).toEqual([
      'Activement exploitée : Oui',
      'Un correctif existe : Non renseignée',
      'Une mesure de contournement existe : Non',
      'Preuve de concept : Non renseignée',
      'Score CVSS v3.1 : 8,8',
    ]);
  });

  it('publications et lecture des fiches', () => {
    expect(
      resumePublications([
        { source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' },
        { source: 'nvd', le: '2026-11-15T10:00:00.000Z' },
      ]),
    ).toBe('CERT Santé (le 10/11/2026), NVD (le 15/11/2026)');
    expect(resumePublications([])).toBe('Aucune publication rangée');
    expect(resumeFichesCertSante({ lues: 1, aLire: 0, relectureJours: 7 })).toBe('1 fiche lue, aucune à lire.');
    expect(resumeFichesCertSante({ lues: 12, aLire: 3, relectureJours: 7 })).toBe(
      '12 fiches lues, 3 à lire (nouvelles, modifiées ou lues il y a plus de 7 jours).',
    );
  });
});

describe('rendu', () => {
  it('fiche : sources de l’exploitation, valeurs par source, mentions du CERT Santé', () => {
    const html = rendu(createElement(SourcesFaille, { s: sources }));
    expect(html).toContain('Ce que disent les sources');
    expect(html).toContain('Exploitation avérée : fiche du CERT Santé (le 10/11/2026), catalogue KEV (le 13/11/2026).');
    expect(html).toContain('La plus sévère, retenue');
    expect(html).toContain('un correctif existe : Oui');
    expect(html).toContain('une mesure de contournement existe : Non renseignée');
    const vide = rendu(createElement(SourcesFaille, { s: VIDES }));
    expect(vide).toContain('aucune source ne la signale');
    expect(vide).toContain('Aucune gravité ni aucun score publié par les sources.');
    expect(rendu(createElement(MarquesSources, { s: VIDES }))).not.toContain('Exploitation');
  });

  it('veille : fiches du CERT Santé, produit cité et mentions d’une publication, publications d’une faille', () => {
    expect(
      rendu(
        createElement(FichesCertSante, {
          f: { lues: 2, aLire: 1, derniereLecture: '2026-11-16T05:00:00.000Z', relectureJours: 7 },
        }),
      ),
    ).toContain('2 fiches lues, 1 à lire');
    expect(
      rendu(createElement(FichesCertSante, { f: { lues: 0, aLire: 0, derniereLecture: null, relectureJours: 7 } })),
    ).toContain('Dernière lecture : jamais');
    const avis: AvisVeilleDto = {
      id: '00000000-0000-4000-8000-000000000a01',
      source: 'cert-sante',
      identifiant: '10351',
      nature: 'alerte',
      titre: 'Produit fictif - CVE-2026-0004',
      resume: '',
      adresse: 'https://cyberveille.esante.gouv.fr/alertes/produit-fictif-cve-2026-0004',
      publieLe: '2026-11-10T02:28:01.000Z',
      cves: ['CVE-2026-0004'],
      vuLe: '2026-11-16T05:00:00.000Z',
      produit: 'Produit <b>fictif</b>',
      fiche: {
        exploitee: 'oui',
        correctif: 'oui',
        contournement: null,
        preuveConcept: 'indisponible',
        cvss31: 7.5,
        lueLe: '2026-11-16T05:00:00.000Z',
        exploiteeLe: '2026-11-10T02:28:01.000Z',
        preuveLe: null,
      },
    };
    const html = rendu(createElement(AvisTable, { avis: [avis] }));
    expect(html).toContain('Produit cité : Produit &lt;b&gt;fictif&lt;/b&gt;');
    expect(html).toContain('Activement exploitée : Oui');
    expect(html).toContain('Une mesure de contournement existe : Non renseignée');
    const faille: FailleVeilleDto = {
      cve: 'CVE-2026-0004',
      description: null,
      publieLe: null,
      modifieLe: null,
      cvss31: null,
      cvss40: null,
      editeurs: [],
      produits: [],
      epss: null,
      kev: null,
      publications: [{ source: 'cert-sante', le: '2026-11-10T02:28:01.000Z' }],
      produitsCites: ['Produit fictif'],
      sources,
      surfaceExterne: null,
    };
    const f = rendu(createElement(FaillesTable, { failles: [faille] }));
    expect(f).toContain('Publiée par : CERT Santé (le 10/11/2026)');
    expect(f).toContain('Exploitation avérée (2 sources)');
    expect(f).toContain('Produit fictif');
  });

  it('fiche d’un produit : « Annuler la décision » sur une confirmation ou un rejet, avec le droit ; annulation affichée', () => {
    const base: Omit<RapprochementDto, 'statut'> = {
      id: '00000000-0000-4000-8000-0000000000b1',
      cve: 'CVE-2026-91001',
      motif: 'avis_seulement',
      versionDansPlage: 'inconnu',
      parIdentifiant: false,
      plages: [],
      tronque: false,
      description: null,
      gravite: null,
      cvssScore: null,
      epss: null,
      kev: false,
      alerteCertFr: false,
      sources: VIDES,
      annulation: null,
      decidePar: 'utilisateur.fictif',
      decideLe: '2026-11-16T10:00:00.000Z',
      note: '',
      versionDecidee: '2.0',
      calculeLe: '2026-11-16T10:00:00.000Z',
      version: 2,
      priorite: { niveau: 'P4', faits: [] },
    };
    const confirmee: RapprochementDto = { ...base, statut: 'confirmee' };
    const proposee: RapprochementDto = {
      ...base,
      id: '00000000-0000-4000-8000-0000000000b2',
      cve: 'CVE-2026-91002',
      statut: 'proposee',
      decidePar: null,
      decideLe: null,
      versionDecidee: null,
      annulation: {
        decision: 'rejetee',
        par: 'utilisateur.fictif',
        le: '2026-11-16T11:00:00.000Z',
        note: 'Rejet hâtif.',
      },
    };
    const avec = rendu(
      createElement(RapprochementsProduit, {
        rapprochements: [confirmee, proposee],
        peutDecider: true,
        onDecider: rien,
        onAnnuler: rien,
      }),
    );
    expect(avec.match(/>Annuler la décision</g)).toHaveLength(1);
    expect(avec).toContain('aria-label="Annuler la décision sur CVE-2026-91001"');
    expect(avec).toContain('Publiée par le CERT Santé, pas encore par NVD');
    expect(avec).toContain('Rejet annulé par utilisateur.fictif le');
    expect(avec).toContain('Rejet hâtif.');
    const sans = rendu(
      createElement(RapprochementsProduit, {
        rapprochements: [confirmee],
        peutDecider: false,
        onDecider: rien,
        onAnnuler: rien,
      }),
    );
    expect(sans).not.toContain('Annuler la décision');
    expect(libelleAnnulation({ decision: 'confirmee', par: 'x', le: '', note: '' })).toBe(
      'Confirmation annulée par x le',
    );
  });
});
