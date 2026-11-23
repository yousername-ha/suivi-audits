/* Module Vulnérabilités (ADR 0100, lot CPE-1) : saisie assistée par le dictionnaire CPE de la NVD. Adresses (terme de deux
   caractères au moins, sans appel sinon), choix d'un produit (éditeur, produit, CPE construit), version choisie (le CPE
   suit), CPE collé (remplit les champs sans appel), menu des versions (toutes versions, NVD ou copie, veille à part),
   messages honnêtes, champ de la version toujours libre, état de la source et réglages dans la carte de la Plateforme
   (lot VEILLE-PLATEFORME), aide.
   Données fictives. */
import { MantineProvider } from '@mantine/core';
import {
  type EtatDictionnaireCpeDto,
  EXPLICATION_COPIE_COMPLETE,
  MESSAGE_ATTENTE_VERSIONS,
  SOURCE_DICTIONNAIRE_CPE,
  type VersionsCpeDto,
} from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { DictionnaireCpeSection } from '../src/vulnerabilites/DictionnaireCpe';
import {
  appliquerChoixCpe,
  appliquerCpeColle,
  appliquerVersionCpe,
  ATTENTE_MAX_VERSIONS_MS,
  DELAI_FRAPPE_CPE,
  etatDictionnaireCpe,
  identiteDepuisValeur,
  libelleProduitCpe,
  messageVersionsCpe,
  optionsVersionsCpe,
  urlProduitsCpe,
  urlVersionsCpe,
  valeurProduitCpe,
} from '../src/vulnerabilites/dictionnaire-cpe';
import { formulaireDepuis } from '../src/vulnerabilites/produits';
import { ChampVersionCpe } from '../src/vulnerabilites/SaisieCpe';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));
const vide = formulaireDepuis(null);
const glpi = { partie: 'a' as const, editeur: 'editeur-fictif', produit: 'produit_fictif' };
const versions = (v: Partial<VersionsCpeDto> = {}): VersionsCpeDto => ({
  etat: 'pret',
  versions: [
    { version: '10.0.2', source: 'nvd' },
    { version: '9.5.1', source: 'nvd' },
    { version: '8.0', source: 'veille' },
  ],
  tronque: false,
  obtenuLe: '2026-11-22T08:00:00.000Z',
  message: null,
  ...v,
});
const etat = (e: Partial<EtatDictionnaireCpeDto> = {}): EtatDictionnaireCpeDto => ({
  source: SOURCE_DICTIONNAIRE_CPE,
  activee: true,
  frequenceHeures: 24,
  flux: { ouvert: true, applique: null },
  executant: { disponible: true },
  etat: 'a_jour',
  chargement: null,
  produits: 151497,
  completLe: '2026-11-21T08:00:00.000Z',
  derniereMiseAJour: '2026-11-22T08:00:00.000Z',
  dernierEssai: '2026-11-22T08:00:00.000Z',
  erreur: null,
  prochaineMiseAJour: '2026-11-23T08:00:00.000Z',
  copie: { voulue: false, complete: false, completeLe: null, versions: 0 },
  version: 3,
  ...e,
});

describe('recherche dans la liste locale', () => {
  it('aucune recherche sous deux caractères utiles ; terme borné et encodé', () => {
    expect(DELAI_FRAPPE_CPE).toBe(250);
    expect(urlProduitsCpe('g')).toBeNull();
    expect(urlProduitsCpe('  -_ ')).toBeNull();
    expect(urlProduitsCpe('gl')).toBe('/api/vulnerabilites/cpe/produits?q=gl');
    expect(urlProduitsCpe('éd fictif&x')).toBe('/api/vulnerabilites/cpe/produits?q=%C3%A9d+fictif%26x');
    expect(decodeURIComponent(urlProduitsCpe('x'.repeat(300))!.split('=')[1]!)).toHaveLength(100);
  });

  it('valeur d’option sans ambiguïté et libellé lisible', () => {
    const i = { partie: 'o' as const, editeur: 'ed|"x"', produit: 'sys:1' };
    expect(identiteDepuisValeur(valeurProduitCpe(i))).toEqual(i);
    expect(identiteDepuisValeur('n’importe quoi')).toBeNull();
    expect(identiteDepuisValeur(JSON.stringify(['z', 'a', 'b']))).toBeNull();
    expect(libelleProduitCpe({ ...glpi, intitule: 'Editeur Fictif Produit' })).toBe(
      'Editeur Fictif Produit — editeur-fictif : produit_fictif (application)',
    );
    expect(libelleProduitCpe({ ...glpi, intitule: null })).toContain('produit_fictif — editeur-fictif');
    expect(urlVersionsCpe(glpi)).toBe(
      '/api/vulnerabilites/cpe/versions?partie=a&editeur=editeur-fictif&produit=produit_fictif',
    );
  });
});

describe('formulaire : produit choisi, version, CPE collé', () => {
  it('le choix remplit l’éditeur, le nom et le CPE (version « * » tant qu’elle est vide)', () => {
    const f = appliquerChoixCpe(vide, glpi);
    expect(f).toMatchObject({
      editeur: 'editeur-fictif',
      nom: 'produit_fictif',
      cpe: 'cpe:2.3:a:editeur-fictif:produit_fictif:*:*:*:*:*:*:*:*',
    });
    const g = appliquerChoixCpe({ ...vide, versionProduit: '9.5.1' }, glpi);
    expect(g.cpe).toBe('cpe:2.3:a:editeur-fictif:produit_fictif:9.5.1:*:*:*:*:*:*:*');
  });

  it('la version choisie ou saisie fait suivre le CPE ; une version non admise garde « * »', () => {
    const f = appliquerChoixCpe(vide, glpi);
    expect(appliquerVersionCpe(f, glpi, '10.0.2').cpe).toBe(
      'cpe:2.3:a:editeur-fictif:produit_fictif:10.0.2:*:*:*:*:*:*:*',
    );
    expect(appliquerVersionCpe(f, glpi, '*').cpe).toBe('cpe:2.3:a:editeur-fictif:produit_fictif:*:*:*:*:*:*:*:*');
    expect(appliquerVersionCpe(f, glpi, '1 2').cpe).toBe('cpe:2.3:a:editeur-fictif:produit_fictif:*:*:*:*:*:*:*:*');
    // Échappements corrects : deux-points d'une version.
    expect(appliquerVersionCpe(f, glpi, '2.0:beta').cpe).toBe(
      'cpe:2.3:a:editeur-fictif:produit_fictif:2.0\\:beta:*:*:*:*:*:*:*',
    );
    // Sans produit choisi ni collé, seule la version change.
    expect(appliquerVersionCpe({ ...vide, cpe: 'à garder' }, null, '3.0')).toMatchObject({
      versionProduit: '3.0',
      cpe: 'à garder',
    });
  });

  it('un CPE 2.3 collé remplit l’éditeur, le produit et la version ; une saisie incomplète ne touche à rien d’autre', () => {
    const r = appliquerCpeColle(vide, ' cpe:2.3:a:ed\\:fictif:prod_x:4.2.1:*:*:*:*:*:*:* ');
    expect(r.identite).toEqual({ partie: 'a', editeur: 'ed:fictif', produit: 'prod_x' });
    expect(r.formulaire).toMatchObject({
      editeur: 'ed:fictif',
      nom: 'prod_x',
      versionProduit: '4.2.1',
      cpe: 'cpe:2.3:a:ed\\:fictif:prod_x:4.2.1:*:*:*:*:*:*:*',
    });
    // Version « * » : la version déjà saisie est gardée.
    const s = appliquerCpeColle({ ...vide, versionProduit: '7' }, 'cpe:2.3:o:ed:sys:*:*:*:*:*:*:*:*');
    expect(s.formulaire.versionProduit).toBe('7');
    const t = appliquerCpeColle({ ...vide, editeur: 'Éditeur saisi' }, 'cpe:2.3:a:ed');
    expect(t).toEqual({ formulaire: { ...vide, editeur: 'Éditeur saisi', cpe: 'cpe:2.3:a:ed' }, identite: null });
  });
});

describe('menu et messages des versions', () => {
  it('toutes versions d’abord, puis la NVD (ou la copie), puis la veille à part', () => {
    expect(optionsVersionsCpe(null)).toEqual([{ group: 'Toutes versions', items: ['*'] }]);
    expect(optionsVersionsCpe(versions())).toEqual([
      { group: 'Toutes versions', items: ['*'] },
      { group: 'Dictionnaire de la NVD', items: ['10.0.2', '9.5.1'] },
      { group: 'Vues dans une CVE de la veille', items: ['8.0'] },
    ]);
    expect(optionsVersionsCpe(versions({ versions: [{ version: '1.0', source: 'copie' }] }))[1]!.group).toBe(
      'Copie complète du dictionnaire',
    );
  });

  it('attente honnête, sans durée promise ; au-delà d’une minute, la saisie à la main', () => {
    const attente = versions({ etat: 'en_attente', versions: [] });
    expect(messageVersionsCpe(attente, 1000)).toBe(MESSAGE_ATTENTE_VERSIONS);
    expect(MESSAGE_ATTENTE_VERSIONS).toContain('Recherche des versions à la NVD…');
    expect(MESSAGE_ATTENTE_VERSIONS).toContain('jusqu’à une vingtaine de secondes');
    expect(messageVersionsCpe(attente, ATTENTE_MAX_VERSIONS_MS)).toContain('saisissez la version vous-même');
    expect(messageVersionsCpe(versions({ etat: 'indisponible', message: 'Source désactivée.' }), 0)).toBe(
      'Source désactivée.',
    );
    expect(messageVersionsCpe(versions({ tronque: true }), 0)?.replace(/\s/g, ' ')).toContain(
      '2 000 versions les plus récentes',
    );
    expect(messageVersionsCpe(versions(), 0)).toBeNull();
    expect(messageVersionsCpe(null, 0)).toBeNull();
  });

  it('le champ de la version reste un champ libre, avec le message d’attente sous lui', () => {
    const html = rendu(
      createElement(ChampVersionCpe, {
        valeur: '9.5',
        onChange: () => {},
        versions: versions({ etat: 'en_attente', versions: [] }),
        message: MESSAGE_ATTENTE_VERSIONS,
      }),
    );
    expect(html).toContain('value="9.5"');
    expect(html).not.toContain('readonly');
    expect(html).not.toContain('disabled');
    expect(html).toContain('role="status"');
    expect(html).toContain('Recherche des versions à la NVD');
  });
});

describe('carte « Veille des vulnérabilités » de la Plateforme : source « Dictionnaire des produits (CPE) »', () => {
  const section = (e: EtatDictionnaireCpeDto, peutRegler: boolean) =>
    rendu(
      createElement(DictionnaireCpeSection, {
        etat: e,
        peutRegler,
        envoi: false,
        onReglage: () => {},
        onCopier: () => {},
        onSupprimerCopie: () => {},
      }),
    );

  it('état : désactivée, veille inactive, chargement n / N, en erreur, à jour', () => {
    expect(etatDictionnaireCpe(etat({ activee: false, etat: 'inactif' })).libelle).toBe('Désactivée');
    expect(etatDictionnaireCpe(etat({ flux: { ouvert: false, applique: null } })).libelle).toContain('Veille inactive');
    const c = etatDictionnaireCpe(
      etat({ etat: 'chargement', chargement: { mode: 'complet', lues: 30000, total: 1880953 } }),
    );
    expect(c).toEqual({ libelle: expect.stringContaining('Chargement en cours'), etat: 'info' });
    expect(c.libelle.replace(/\s/g, ' ')).toContain('30 000 / 1 880 953 entrées');
    expect(etatDictionnaireCpe(etat({ etat: 'erreur', erreur: 'x' })).etat).toBe('erreur');
    expect(etatDictionnaireCpe(etat())).toEqual({ libelle: 'À jour', etat: 'succes' });
  });

  it('explications de place, réglages et copie complète pour qui administre ; lecture seule sinon', () => {
    const admin = section(etat(), true);
    expect(admin).toContain('Dictionnaire des produits (CPE)');
    expect(admin).toContain(EXPLICATION_COPIE_COMPLETE);
    expect(admin).toContain('environ 40 Mo dans la base');
    expect(admin).toContain('Désactiver la source');
    expect(admin).toContain('Lecture des nouveautés');
    expect(admin).toContain('Copier le dictionnaire complet');
    expect(admin).toContain('services.nvd.nist.gov');
    const lecteur = section(etat(), false);
    expect(lecteur).not.toContain('Copier le dictionnaire complet');
    expect(lecteur).not.toContain('Désactiver la source');
    expect(lecteur).toContain('Seule une personne qui administre le module la règle');
    const copie = section(etat({ copie: { voulue: true, complete: true, completeLe: null, versions: 1880953 } }), true);
    expect(copie).toContain('Supprimer la copie complète');
    expect(copie).toContain('les versions viennent de la base locale');
    expect(section(etat({ activee: false, etat: 'inactif' }), true)).toContain('Activer la source');
  });

  it('aide en ligne : saisie assistée, collage d’un CPE et source du dictionnaire décrits', () => {
    const texte = HELP_ARTICLES.map((h) => h.steps.join(' ')).join(' ');
    expect(texte).toContain('Rechercher dans le dictionnaire CPE (NVD)');
    expect(texte).toContain('Coller un identifiant CPE 2.3');
    expect(texte).toContain('Copier le dictionnaire complet');
  });
});
