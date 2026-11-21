/* Module Vulnérabilités (ADR 0100, lot AD-1) : lecture du rapport de l'Active Directory dans le navigateur (lireRapportAds)
   sur un rapport fictif écrit à la main (tests/fixtures/ads), refus « forme non reconnue », réduction des noms (chemin LDAP,
   « domaine\nom », SID), champs interdits jamais envoyés ; page « Active Directory » (noms sur clic, consultation annoncée comme tracée ; administration) ; menu
   et aide. AUCUN rapport réel : la forme supposée est celle de CLES_RAPPORT_ADS. Données entièrement fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import { type AnnuaireAdsDto, ImportAds, type ImportAdsDto, type NomsPointAdsDto } from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import {
  CLES_RAPPORT_ADS,
  corpsImportAds,
  ErreurRapportAds,
  erreurTailleAds,
  libelleEcartsAds,
  lireJsonAds,
  lireRapportAds,
  natureObjetAds,
  nomCourtAds,
  resumeExtraitAds,
} from '../src/vulnerabilites/ads';
import { AnnuaireAdContenu, NomsPointAds, texteEvolutionNote } from '../src/vulnerabilites/AnnuaireAd';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../tests/fixtures/ads/rapport-ads-fictif.json',
);
const rapportFictif = () => lireJsonAds(readFileSync(FIXTURE, 'utf8'));
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(
    createElement(QueryClientProvider, { client: new QueryClient() }, createElement(MantineProvider, null, e)),
  );

describe('lecture du rapport fictif dans le navigateur', () => {
  it('extrait la note, la progression, les points et les noms courts ; l’API l’accepte tel quel', () => {
    const e = lireRapportAds(rapportFictif());
    expect(e.rapport).toEqual({
      date: '2026-11-18',
      note: 2,
      progression: [
        { niveau: 1, conformes: 18, total: 20, pourcentage: null },
        { niveau: 2, conformes: 10, total: 16, pourcentage: null },
        { niveau: 3, conformes: 4, total: 12, pourcentage: null },
        { niveau: 4, conformes: null, total: null, pourcentage: 25 },
        { niveau: 5, conformes: null, total: null, pourcentage: 0 },
      ],
      conformes: 32,
    });
    expect(e.points.map((p) => [p.identifiant, p.type, p.niveau, p.reference, p.objets])).toEqual([
      ['vuln1_fictif_privileged_members', 3, 1, 'fictif_privileged_members', 3],
      ['warn3_fictif_inactive_accounts', 2, 3, 'fictif_inactive_accounts', 1250],
      ['info2_fictif_dc_settings', 1, 2, 'fictif_dc_settings', 1],
      // Sans identifiant : forme publique supposée, construite du type, du niveau et de la référence.
      ['warn4_fictif_gpo_rights', 2, 4, 'fictif_gpo_rights', 1],
      // Sans type ni niveau : lus dans l'identifiant public supposé.
      ['vuln2_fictif_trusts', 3, 2, 'fictif_trusts', 1],
    ]);
    expect(e.points[0]!.noms).toEqual([
      { nom: 'compte-fictif-01', nature: 'utilisateur' },
      { nom: 'svc-fictif-01', nature: 'service' },
    ]);
    expect(e.points[1]!.noms).toEqual([
      { nom: 'compte-fictif-02', nature: 'utilisateur' },
      { nom: 'compte-fictif-03', nature: 'utilisateur' },
      { nom: 'poste-fictif-01', nature: 'ordinateur' },
    ]);
    expect(e.points[2]!.noms).toEqual([{ nom: 'dc-fictif-01', nature: 'controleur' }]);
    expect(e.points[3]!.noms).toEqual([{ nom: 'gpo-fictive-01', nature: 'gpo' }]);
    expect(e.points[4]!.noms).toEqual([{ nom: 'partenaire-fictif', nature: 'approbation' }]);
    expect(e.ecartes).toMatchObject({ nomsIllisibles: 1, nomsEnDouble: 1, nomsAuDela: 0 });
    expect(e).toMatchObject({ objets: 1256, noms: 8 });
    expect(ImportAds.safeParse(corpsImportAds(e)).success).toBe(true);
    expect(resumeExtraitAds(e)).toBe(
      `Note globale 2 sur 5 (rapport du 18/11/2026), 5 points de contrôle non conformes, ${(1256).toLocaleString('fr-FR')} objets concernés dont 8 noms conservés.`,
    );
    expect(libelleEcartsAds(e.ecartes)).toContain('1 objets sans nom lisible');
  });

  it('rien d’interdit ne part : ni mot de passe, empreinte, SID, chemin LDAP, domaine, ni champ hors liste', () => {
    const texte = JSON.stringify(corpsImportAds(lireRapportAds(rapportFictif())));
    for (const interdit of [
      'INTERDIT',
      'S-1-5-',
      'CN=',
      'DC=',
      'exemple.invalid',
      'EXEMPLE\\',
      'pwd',
      'Pwd',
      'Hash',
      'servicePrincipalName',
    ])
      expect(texte.includes(interdit), interdit).toBe(false);
    // Les nombres d'aperçu restent sur le poste.
    expect(Object.keys(corpsImportAds(lireRapportAds(rapportFictif())))).toEqual(['rapport', 'points', 'ecartes']);
  });

  it('autres formes tolérées : enveloppe, tableaux, objet indexé, borne de noms par point', () => {
    const noms = Array.from({ length: 250 }, (_, i) => `compte-fictif-${i}`);
    const e = lireRapportAds({
      report: {
        level: '4',
        levels: [{ percent: 100 }, { percent: 87.55 }, 40, 10, 0],
        checks: { vuln3_fictif_borne: { title: 'Trop de comptes fictifs', objects: noms } },
      },
    });
    expect(e.rapport.note).toBe(4);
    expect(e.rapport.progression.map((p) => p.pourcentage)).toEqual([100, 87.6, 40, 10, 0]);
    expect(e.points[0]).toMatchObject({ identifiant: 'vuln3_fictif_borne', type: 3, niveau: 3, objets: 250 });
    expect(e.points[0]!.noms).toHaveLength(200);
    expect(e.ecartes.nomsAuDela).toBe(50);
    expect(ImportAds.safeParse(corpsImportAds(e)).success).toBe(true);
  });
});

describe('forme non reconnue : refus en entier, avec la clé en cause', () => {
  const refuse = (json: unknown, motif: RegExp) => {
    expect(() => lireRapportAds(json)).toThrow(ErreurRapportAds);
    expect(() => lireRapportAds(json)).toThrow(motif);
    expect(() => lireRapportAds(json)).toThrow(/Forme non reconnue.*Rien n’a été importé/);
  };
  const base = () => rapportFictif() as Record<string, unknown>;
  it('note, progression ou liste des points absentes', () => {
    refuse([], /n’est pas un objet JSON/);
    refuse({ ...base(), score: 9 }, /note globale/);
    const sansNote = base();
    delete sansNote.score;
    refuse(sansNote, /note globale.*score, note, level/);
    const sansProgression = base();
    delete sansProgression.levels;
    refuse(sansProgression, /progression par niveau/);
    const sansPoints = base();
    delete sansPoints.rules;
    refuse(sansPoints, /liste des points/);
  });
  it('point sans type, sans titre, ou en double ; progression illisible', () => {
    refuse({ ...base(), rules: [{ id: 'fictif_sans_type', level: 1, title: 'x', objects: [] }] }, /point n° 1 : type/);
    refuse({ ...base(), rules: [{ id: 'vuln1_fictif', objects: [] }] }, /point n° 1 : titre/);
    refuse(
      {
        ...base(),
        rules: [
          { id: 'vuln1_fictif', title: 'x', objects: [] },
          { id: 'vuln1_fictif', title: 'y', objects: [] },
        ],
      },
      /point n° 2 : identifiant en double/,
    );
    refuse({ ...base(), rules: [{ id: 'vuln1_fictif', title: 'x' }] }, /objets concernés introuvables/);
    refuse({ ...base(), levels: { 1: { passed: 'beaucoup' } } }, /progression du niveau 1/);
  });
  it('fichier non JSON ou trop gros : refus avant tout envoi', () => {
    expect(() => lireJsonAds('{ pas du json')).toThrow('ce n’est pas un fichier JSON valide');
    expect(erreurTailleAds(0)).toBe('Fichier vide.');
    expect(erreurTailleAds(60_000_000)).toMatch(/Fichier trop volumineux/);
    expect(erreurTailleAds(1000)).toBeNull();
  });
  it('les clés supposées sont regroupées en un seul endroit', () => {
    expect(Object.keys(CLES_RAPPORT_ADS)).toContain('points');
    expect(CLES_RAPPORT_ADS.note[0]).toBe('score');
  });
});

describe('noms courts et nature', () => {
  it('chemin LDAP réduit, « domaine\\nom » et « nom@domaine » réduits, SID jamais gardé, borne', () => {
    expect(nomCourtAds('CN=compte-fictif-01,OU=Comptes,DC=exemple,DC=invalid')).toEqual({
      nom: 'compte-fictif-01',
      raccourci: false,
    });
    expect(nomCourtAds('CN=Admins\\, fictifs,DC=exemple,DC=invalid')).toEqual({
      nom: 'Admins, fictifs',
      raccourci: false,
    });
    expect(nomCourtAds('EXEMPLE\\compte-fictif-01')).toEqual({ nom: 'compte-fictif-01', raccourci: false });
    expect(nomCourtAds('compte-fictif-01@exemple.invalid')).toEqual({ nom: 'compte-fictif-01', raccourci: false });
    expect(nomCourtAds('S-1-5-21-1-2-3-500')).toEqual({ sid: true });
    expect(nomCourtAds(42)).toBeNull();
    const long = nomCourtAds('x'.repeat(100));
    expect(long).toEqual({ nom: `${'x'.repeat(63)}…`, raccourci: true });
  });
  it('nature lue de la classe, du plus précis au plus général', () => {
    expect(natureObjetAds(['top', 'person', 'organizationalPerson', 'user', 'computer'])).toBe('ordinateur');
    expect(natureObjetAds('msDS-GroupManagedServiceAccount')).toBe('service');
    expect(natureObjetAds('groupPolicyContainer')).toBe('gpo');
    expect(natureObjetAds('group')).toBe('groupe');
    expect(natureObjetAds('DC')).toBe('controleur');
    expect(natureObjetAds('trustedDomain')).toBe('approbation');
    expect(natureObjetAds(undefined, 'srv-fictif-01$')).toBe('ordinateur');
    expect(natureObjetAds(undefined, 'inconnu')).toBe('autre');
  });
});

/* ------------------------------------------------------------------ Page */
const imp = (o: Partial<ImportAdsDto>): ImportAdsDto => ({
  id: '0190a000-0000-7000-8000-0000000000a1',
  numero: 2,
  version: 1,
  dateRapport: '2026-11-18',
  note: 3,
  progression: [{ niveau: 1, conformes: 18, total: 20, pourcentage: null }],
  conformes: 32,
  points: 2,
  objets: 6,
  nomsConserves: true,
  importePar: 'rssi-fictif',
  importeLe: '2026-11-18T08:00:00.000Z',
  ...o,
});
const donnees = (): AnnuaireAdsDto => ({
  courant: imp({}),
  precedent: imp({ id: '0190a000-0000-7000-8000-0000000000a0', numero: 1, note: 2, dateRapport: '2026-11-01' }),
  historique: [
    imp({}),
    imp({ id: '0190a000-0000-7000-8000-0000000000a0', numero: 1, note: 2, dateRapport: '2026-11-01' }),
  ],
  points: [
    {
      identifiant: 'vuln1_fictif_admins',
      reference: 'fictif_admins',
      type: 3,
      niveau: 1,
      titre: 'Comptes fictifs trop privilégiés',
      objets: 5,
      objetsAvant: 3,
      apparu: false,
    },
    {
      identifiant: 'info2_fictif',
      reference: 'fictif',
      type: 1,
      niveau: 2,
      titre: 'Information fictive',
      objets: 1,
      objetsAvant: null,
      apparu: true,
    },
  ],
  corriges: [
    { identifiant: 'warn3_fictif', reference: 'fictif', type: 2, niveau: 3, titre: 'Avertissement fictif', objets: 4 },
  ],
});

describe('page « Active Directory »', () => {
  it('lecteur du module : nombres, variation, corrigés ; noms sur clic seulement (aucun nom dans les données de la page)', () => {
    const html = rendu(createElement(AnnuaireAdContenu, { data: donnees(), administrer: false, onChange: () => {} }));
    expect(html).toContain('Note globale : 3 sur 5');
    expect(html).toContain('+1 depuis l’import du 01/11/2026 (2 sur 5).');
    expect(html).toContain('3 · vulnérabilité');
    expect(html).toContain('1 · information');
    expect(html).toContain('+2');
    expect(html).toContain('apparu');
    expect(html).toContain('Corrigés depuis l’import du 01/11/2026');
    expect(html).toContain('Avertissement fictif');
    expect(html).toContain('18 sur 20');
    // Les données de la page ne portent aucun nom : seuls les boutons « Voir les noms » les demandent, point par point.
    expect(html.match(/>Voir les noms</g)).toHaveLength(3);
    expect(html).toContain('inscrite au journal d’audit');
    expect(html).not.toContain('compte-fictif');
    // Ni import ni suppression sans le droit d'administrer.
    expect(html).not.toContain('Importer un rapport');
    expect(html).not.toContain('Supprimer');
  });

  it('administration du module : import et suppression', () => {
    const html = rendu(createElement(AnnuaireAdContenu, { data: donnees(), administrer: true, onChange: () => {} }));
    expect(html.match(/>Voir les noms</g)).toHaveLength(3);
    expect(html).toContain('inscrite au journal d’audit');
    expect(html).toContain('Importer un rapport');
    expect(html).toContain('Supprimer');
    expect(html).toContain('Rapport de l’Active Directory (JSON)');
  });

  it('noms d’un point : objets, surplus, apparus et corrigés depuis l’import précédent', () => {
    const n: NomsPointAdsDto = {
      identifiant: 'vuln1_fictif_admins',
      titre: 'Comptes fictifs trop privilégiés',
      numero: 2,
      noms: [
        { nom: 'compte-fictif-01', nature: 'utilisateur' },
        { nom: 'compte-fictif-04', nature: 'utilisateur' },
      ],
      sansNom: 3,
      comparaison: {
        numero: 1,
        apparus: [{ nom: 'compte-fictif-04', nature: 'utilisateur' }],
        corriges: [{ nom: 'grp-fictif-01', nature: 'groupe' }],
        complete: false,
      },
    };
    const html = rendu(createElement(NomsPointAds, { data: n }));
    expect(html).toContain('compte-fictif-01 (compte d’utilisateur)');
    expect(html).toContain('Et 3 autres objets');
    expect(html).toContain('Apparus depuis l’import n° 1');
    expect(html).toContain('grp-fictif-01 (groupe)');
    expect(html).toContain('Comparaison partielle');
    expect(rendu(createElement(NomsPointAds, { data: { ...n, comparaison: null } }))).toContain(
      'Pas d’import précédent',
    );
  });

  it('évolution de la note et premier import', () => {
    expect(texteEvolutionNote(imp({}), null)).toBe('Premier import : pas encore d’évolution.');
    expect(texteEvolutionNote(imp({ note: 2 }), imp({ note: 2 }))).toMatch(/^Inchangée/);
    expect(texteEvolutionNote(imp({ note: 1 }), imp({ note: 3 }))).toMatch(/^−2 depuis/);
    const vide = rendu(
      createElement(AnnuaireAdContenu, {
        data: { courant: null, precedent: null, historique: [], points: [], corriges: [] },
        administrer: false,
        onChange: () => {},
      }),
    );
    expect(vide).toContain('Aucun rapport importé');
  });

  it('aide de la page', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-annuaire');
    expect(a?.link).toBe('/vulnerabilites/annuaire');
    expect(a?.permission).toBe('vulnerabilites:lire');
    expect(a?.steps.join(' ')).toContain('ne quittent jamais la plateforme');
  });
});
