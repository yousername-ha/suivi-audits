/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : écran « Veille ». Menu conditionné par le droit du module, adresses de
   recherche, état affiché des sources, liens d'avis contrôlés (https, hôte de la source, nouvel onglet sans référent),
   textes des sources rendus comme texte simple, activation réservée à l'administrateur. Lot VEILLE-PLATEFORME : le tableau
   des sources (fréquences) et l'activation sont dans la carte « Veille des vulnérabilités » de la Plateforme
   (ConfigurationVeille.tsx) ; leurs rendus sont vérifiés ici sans changement. Données fictives. */
import { MantineProvider } from '@mantine/core';
import type { Action, AvisVeilleDto, EtatSourceVeilleDto, EtatVeilleDto, FailleVeilleDto, Module } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { famillesVisibles, localiser } from '../src/navigation';
import { ListeAvis } from '../src/vulnerabilites/AvisVeille';
import { ActivationVeille, SourcesTable } from '../src/vulnerabilites/ConfigurationVeille';
import { KevTable, ListeFailles } from '../src/vulnerabilites/Veille';
import {
  adresseAvis,
  dateCourte,
  echeanceDepassee,
  etatSource,
  identifiantAvis,
  libelleEpss,
  nombrePages,
  urlAvis,
  urlFailles,
} from '../src/vulnerabilites/veille-presentation';

const rendu = (e: ReactElement) => renderToStaticMarkup(createElement(MantineProvider, null, e));

const source = (s: Partial<EtatSourceVeilleDto> = {}): EtatSourceVeilleDto => ({
  source: 'cisa-kev',
  libelle: 'Catalogue des failles exploitées (KEV)',
  organisme: 'CISA (États-Unis)',
  hote: 'www.cisa.gov',
  format: 'Fichier JSON unique',
  langue: 'en',
  demande: 'Le catalogue entier, en une lecture.',
  derniereReussite: '2026-11-16T05:00:00.000Z',
  dernierEssai: '2026-11-16T05:00:00.000Z',
  erreur: null,
  enRetard: false,
  derniereCollecte: null,
  frequenceHeures: 2,
  prochaineCollecte: '2026-11-16T07:00:00.000Z',
  version: 1,
  ...s,
});
const avis = (a: Partial<AvisVeilleDto> = {}): AvisVeilleDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  parc: { presentes: [], exposees: [] },
  source: 'cert-fr',
  identifiant: 'CERTFR-2026-AVI-0001',
  nature: 'avis',
  titre: 'Multiples vulnérabilités dans un produit fictif',
  resume: 'Résumé fictif.',
  adresse: 'https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-0001/',
  publieLe: '2026-11-12T00:00:00.000Z',
  cves: ['CVE-2026-0001'],
  vuLe: '2026-11-16T05:00:00.000Z',
  produit: null,
  fiche: null,
  ...a,
});
const faille = (f: Partial<FailleVeilleDto> = {}): FailleVeilleDto => ({
  cve: 'CVE-2026-0001',
  description: 'Fictional description.',
  publieLe: null,
  modifieLe: null,
  cvss31: { score: 9.8, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: ['editeur_fictif'],
  produits: ['produit_fictif'],
  epss: { score: 0.0051, centile: 0.4388, date: '2026-11-15' },
  kev: {
    editeur: 'Éditeur fictif',
    produit: 'Produit fictif',
    nom: 'Fictional Vulnerability',
    description: 'Fictional description.',
    action: 'Apply mitigations per vendor instructions.',
    ajoutLe: '2026-11-13',
    echeance: '2026-11-15',
    rancongiciel: true,
  },
  publications: [{ source: 'cisa-kev', le: '2026-11-13T00:00:00.000Z' }],
  produitsCites: [],
  sources: {
    exploitation: [{ source: 'kev', le: '2026-11-13T00:00:00.000Z' }],
    exploitable: [],
    valeurs: { gravites: [], cvss: [], epss: [] },
    certSante: null,
  },
  surfaceExterne: null,
  ...f,
});
const etat = (ouvert: boolean, disponible = true, mandataire = false): EtatVeilleDto => ({
  flux: { ouvert, applique: ouvert ? 'ouvert' : null },
  executant: { disponible },
  mandataire: { actif: mandataire },
  sources: [source()],
  fichesCertSante: { lues: 0, aLire: 0, derniereLecture: null, relectureJours: 7 },
});

describe('menu', () => {
  const seulement = (droits: string[]) => (m: Module, a: Action) => droits.includes(`${m}:${a}`);
  it('l’entrée « Veille » suit « Produits surveillés », avec la lecture du module seulement', () => {
    const risques = famillesVisibles(seulement(['vulnerabilites:lire'])).find((f) => f.famille.id === 'risques')!;
    const vuln = risques.destinations.find((d) => d.id === 'vulnerabilites')!;
    expect(vuln.rubriques.map((p) => [p.id, p.to])).toEqual([
      ['vulnerabilites-vue', '/vulnerabilites/vue'],
      ['vulnerabilites-produits', '/vulnerabilites/produits'],
      ['vulnerabilites-veille', '/vulnerabilites/veille'],
      ['vulnerabilites-failles', '/vulnerabilites/failles'],
      ['vulnerabilites-machines', '/vulnerabilites/machines'],
      ['vulnerabilites-perimetres', '/vulnerabilites/perimetres'],
      ['vulnerabilites-surface', '/vulnerabilites/surface-externe'],
      ['vulnerabilites-annuaire', '/vulnerabilites/annuaire'],
      ['vulnerabilites-alertes', '/vulnerabilites/alertes'],
      ['vulnerabilites-delais', '/vulnerabilites/delais'],
      ['vulnerabilites-tendances', '/vulnerabilites/tendances'],
      ['vulnerabilites-rapport', '/vulnerabilites/rapport'],
      ['vulnerabilites-priorite', '/vulnerabilites/priorite'],
    ]);
    expect(localiser('/vulnerabilites/veille')?.destination.id).toBe('vulnerabilites');
    expect(
      famillesVisibles(seulement(['pilotage:lire']))
        .find((f) => f.famille.id === 'risques')
        ?.destinations.map((d) => d.id),
    ).toEqual(['risques']);
  });
});

describe('présentation', () => {
  it('adresses de recherche encodées, page et filtre KEV', () => {
    expect(urlAvis('')).toBe('/api/vulnerabilites/veille/avis');
    expect(urlAvis(' CVE-2026-0001 ', 2)).toBe('/api/vulnerabilites/veille/avis?q=CVE-2026-0001&page=2');
    expect(urlFailles('100% & co', true)).toBe('/api/vulnerabilites/veille/failles?q=100%25+%26+co&kev=oui');
    expect(urlFailles('', false, 3)).toBe('/api/vulnerabilites/veille/failles?page=3');
  });
  it('état d’une source : collecte en cours, inactive, erreur, retard, jamais, à jour', () => {
    const collecte = {
      id: 'x',
      source: 'cisa-kev',
      origine: 'manuel',
      demandePar: 't',
      demandeLe: '',
      termineLe: null,
      elements: 0,
      tronque: false,
      erreur: null,
    } as const;
    expect(etatSource(source({ derniereCollecte: { ...collecte, etat: 'en_cours' } }), true).libelle).toBe(
      'Collecte en cours',
    );
    expect(etatSource(source(), false)).toEqual({ libelle: 'Veille inactive', etat: 'neutre' });
    expect(etatSource(source({ erreur: 'Délai dépassé.' }), true).etat).toBe('erreur');
    expect(etatSource(source({ enRetard: true }), true)).toEqual({ libelle: 'En retard', etat: 'attention' });
    expect(etatSource(source({ enRetard: true, derniereReussite: null }), true).libelle).toBe('Jamais collectée');
    expect(etatSource(source(), true)).toEqual({ libelle: 'À jour', etat: 'succes' });
  });
  it('lien d’avis seulement en https sur l’hôte de sa source', () => {
    expect(adresseAvis(avis())).toBe('https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-0001/');
    expect(adresseAvis(avis({ adresse: 'javascript:alert(1)' }))).toBeNull();
    expect(adresseAvis(avis({ adresse: 'https://ailleurs.exemple.test/avis/' }))).toBeNull();
    expect(
      adresseAvis(avis({ source: 'cert-sante', adresse: 'https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-0001/' })),
    ).toBeNull();
    expect(adresseAvis(avis({ adresse: null }))).toBeNull();
    expect(identifiantAvis(avis({ source: 'cert-sante', identifiant: '10351' }))).toBe('CERT Santé n° 10351');
  });
  it('dates, échéance, score EPSS et pages', () => {
    expect(dateCourte('2026-11-13')).toBe('13/11/2026');
    expect(dateCourte(null)).toBe('—');
    expect(echeanceDepassee('2026-11-15', '2026-11-16')).toBe(true);
    expect(echeanceDepassee('2026-11-16', '2026-11-16')).toBe(false);
    expect(echeanceDepassee(null, '2026-11-16')).toBe(false);
    expect(libelleEpss({ score: 0.0051, centile: 0.4388 })).toMatch(/^0,51\s?% \(centile 43,88\s?%\)$/);
    expect([nombrePages(0, 25), nombrePages(25, 25), nombrePages(26, 25)]).toEqual([1, 1, 2]);
  });
});

describe('rendu', () => {
  it('sources : hôte, langue, dernière collecte réussie, erreur affichée en texte', () => {
    const html = rendu(
      createElement(SourcesTable, {
        sources: [
          source(),
          source({
            source: 'nvd',
            hote: 'services.nvd.nist.gov',
            derniereReussite: null,
            enRetard: true,
            erreur: 'Délai dépassé : la source ne répond pas.',
          }),
        ],
        fluxOuvert: true,
      }),
    );
    expect(html).toContain('www.cisa.gov');
    expect(html).toContain('Anglais (texte d’origine)');
    expect(html).toContain('Jamais');
    expect(html).toContain('En erreur');
    expect(html).toContain('Délai dépassé : la source ne répond pas.');
  });
  it('fréquence (lot F1) : liste déroulante pour qui administre, texte sinon ; EPSS fixe ; avertissement NVD relié au champ', () => {
    const sources = [
      source(),
      source({ source: 'nvd', libelle: 'Base nationale des vulnérabilités (NVD)', frequenceHeures: 4 }),
      source({ source: 'epss', libelle: 'Probabilité d’exploitation (EPSS)', frequenceHeures: 24 }),
    ];
    const admin = rendu(
      createElement(SourcesTable, { sources, fluxOuvert: true, peutRegler: true, onFrequence: () => undefined }),
    );
    // Deux listes (KEV, NVD), aucune pour EPSS.
    const selects = [...admin.matchAll(/<select[^>]*>/g)].map((m) => m[0]);
    expect(selects).toHaveLength(2);
    expect(selects[0]).toContain('aria-label="Fréquence de la source Catalogue des failles exploitées (KEV)"');
    expect(selects[0]).not.toContain('aria-describedby');
    // NVD : choix 2, 4, 12, 24 h seulement (jamais 1 h), avertissement relié par aria-describedby.
    const nvd = admin.slice(admin.indexOf('Fréquence de la source Base nationale'));
    const liste = nvd.slice(0, nvd.indexOf('</select>'));
    expect([...liste.matchAll(/<option[^>]*value="(\d+)"/g)].map((m) => m[1])).toEqual(['2', '4', '12', '24']);
    const decrit = /aria-describedby="([^"]+)"/.exec(selects[1]!)![1]!;
    expect(admin).toContain(`id="${decrit}"`);
    expect(admin).toMatch(/Attention :<\/strong> NVD demande de ne pas être lu automatiquement plus d’une fois toutes/);
    expect(admin).toContain('Une fois par jour (fixe)');
    expect(admin).toContain('Les scores EPSS ne sont publiés qu’une fois par jour');
    expect(admin).toContain('Prochaine collecte');
    // Sans le droit : du texte, aucune liste.
    const lecture = rendu(createElement(SourcesTable, { sources, fluxOuvert: true }));
    expect(lecture).not.toContain('<select');
    expect(lecture).toContain('Toutes les 2 heures');
    expect(lecture).toContain('Toutes les 4 heures');
    // Veille fermée : aucune échéance.
    expect(
      rendu(createElement(SourcesTable, { sources: [source({ prochaineCollecte: null })], fluxOuvert: false })),
    ).toContain('aucune (veille désactivée)');
  });
  it('avis : texte simple (balisage échappé), lien en nouvel onglet sans référent, ou aucun lien', () => {
    const html = rendu(
      createElement(ListeAvis, {
        avis: [
          avis({ titre: '<img src=x onerror=alert(1)> Titre piégé' }),
          avis({ id: '2', identifiant: 'CERTFR-2026-AVI-0002', adresse: 'https://ailleurs.exemple.test/' }),
        ],
      }),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; Titre piégé');
    const liens = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(liens).toHaveLength(1);
    expect(liens[0]).toContain('href="https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-0001/"');
    expect(liens[0]).toContain('target="_blank"');
    expect(liens[0]).toContain('rel="noopener noreferrer"');
    expect(liens[0]).toMatch(/referrerPolicy="no-referrer"|referrerpolicy="no-referrer"/i);
    expect(html).toContain('CERTFR-2026-AVI-0002');
    expect(rendu(createElement(ListeAvis, { avis: [] }))).toContain('Aucune alerte ni aucun avis');
  });
  it('KEV : action exigée et échéance (dépassée signalée), textes anglais tels quels', () => {
    const html = rendu(createElement(KevTable, { failles: [faille()], aujourdhui: '2026-11-16' }));
    expect(html).toContain('Apply mitigations per vendor instructions.');
    expect(html).toContain('15/11/2026');
    expect(html).toContain('lang="en"');
    expect(html).toContain('utilisée par un rançongiciel');
  });
  it('failles connues : gravité, vecteur, EPSS, éditeurs et produits', () => {
    const html = rendu(
      createElement(ListeFailles, {
        failles: [faille(), faille({ cve: 'CVE-2026-0002', cvss31: null, kev: null, epss: null })],
      }),
    );
    expect(html).toContain('Critique');
    expect(html).toContain('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
    expect(html).toContain('Exploitée (KEV)');
    expect(html).toContain('Non publiée');
    expect(html).toContain('editeur_fictif');
    expect(html).not.toContain('surface externe');
  });
  it('lot PC4 : la CVE ouvre sa fiche illustrée (bouton) quand l’écran le propose ; sinon texte simple', () => {
    const rien = () => undefined;
    for (const html of [
      rendu(createElement(ListeFailles, { failles: [faille()], onOuvrir: rien })),
      rendu(createElement(KevTable, { failles: [faille()], aujourdhui: '2026-11-16', onOuvrir: rien })),
    ])
      expect(html).toMatch(/<button[^>]*type="button"[^>]*>CVE-2026-0001<\/button>/i);
    expect(rendu(createElement(ListeFailles, { failles: [faille()] }))).not.toMatch(/<button[^>]*>CVE-2026-0001/i);
  });
  it('faille vue sur la surface externe (lot ALH2) : actifs exposés lisibles, lien vers l’écran', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          MantineProvider,
          null,
          createElement(ListeFailles, {
            failles: [faille({ surfaceExterne: { actifs: 2, alertes: 1, horsLecture: false } })],
          }),
        ),
      ),
    );
    expect(html).toContain('Exposée sur Internet');
    expect(html).toContain('Vue sur la surface externe : 2 actifs exposés, 1 alerte ouverte.');
    expect(html).toContain('href="/vulnerabilites/surface-externe"');
  });
  it('activation : destinations et ce qui sort ; bouton réservé à l’administrateur ; exécutant absent signalé', () => {
    const rien = () => {};
    const ferme = rendu(
      createElement(ActivationVeille, {
        etat: etat(false),
        peutActiver: true,
        envoi: false,
        onActiver: rien,
        onDesactiver: rien,
      }),
    );
    expect(ferme).toContain('Activer la veille');
    expect(ferme).toContain('cyberveille.esante.gouv.fr');
    expect(ferme).toContain('Aucune donnée métier');
    const sansDroit = rendu(
      createElement(ActivationVeille, {
        etat: etat(false),
        peutActiver: false,
        envoi: false,
        onActiver: rien,
        onDesactiver: rien,
      }),
    );
    expect(sansDroit).not.toContain('Activer la veille</');
    expect(sansDroit).toContain('Seul un administrateur peut activer la veille.');
    const ouvert = rendu(
      createElement(ActivationVeille, {
        etat: etat(true, false),
        peutActiver: true,
        envoi: false,
        onActiver: rien,
        onDesactiver: rien,
      }),
    );
    expect(ouvert).toContain('Désactiver la veille');
    expect(ouvert).toContain('Exécutant d’exploitation non vu');
    expect(ouvert).not.toContain('Par le mandataire');
  });
  it('mandataire de l’établissement actif : l’écran dit que les demandes passent par lui, destinations inchangées', () => {
    const html = rendu(
      createElement(ActivationVeille, {
        etat: etat(true, true, true),
        peutActiver: true,
        envoi: false,
        onActiver: () => {},
        onDesactiver: () => {},
      }),
    );
    expect(html).toContain('Par le mandataire de l’établissement');
    expect(html).toContain('la destination finale est inchangée');
    expect(html).toContain('sortie du serveur vers le mandataire, sur le port réglé');
    expect(html).toContain('www.cisa.gov');
    expect(html).toContain('cyberveille.esante.gouv.fr');
  });
});
