/* Veille réglementaire, style « Verre » (dessin Veille validé par le RSSI le 27/11/2026) : rail des sources, tuiles par
   statut (boutons de filtre), liste compacte, publication choisie (résumé, qualification réservée au rôle du domaine,
   lien contrôlé et sans référent). Les suites d'une publication ne sont pas servies par l'API : aucun bloc « Ce que ça
   change pour nous » ni bouton de création. Données fictives, rendu statique. */
import { MantineProvider } from '@mantine/core';
import type { PublicationReglementaireDto, SyntheseVeilleReglementaireDto } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DetailPublicationVerre,
  ListeTextesVerre,
  RailSources,
  RailStatut,
  TuilesVeilleVerre,
} from '../src/veille-reglementaire/VeilleVerre';

const html = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MantineProvider, null, n))
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
const rien = () => undefined;

const publication = (p: Partial<PublicationReglementaireDto> = {}): PublicationReglementaireDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  source: 'cnil',
  domaine: 'donnees-personnelles',
  titre: 'Publication fictive',
  resume: 'Résumé fictif.',
  lien: 'https://www.cnil.fr/fictif/1',
  publieLe: '2026-11-19T08:00:00.000Z',
  collecteLe: '2026-11-20T06:00:00.000Z',
  statut: 'a-qualifier',
  qualifieLe: null,
  qualifiePar: null,
  suites: { exigences: 0, actions: 0, documents: 0 },
  version: 1,
  ...p,
});
const synthese: SyntheseVeilleReglementaireDto = {
  aQualifier: 7,
  aSuivre: 12,
  impactant: 2,
  sansObjet: 31,
  parDomaine: {
    securite: { aQualifier: 5, aSuivre: 8, impactant: 2, sansObjet: 20 },
    donneesPersonnelles: { aQualifier: 2, aSuivre: 4, impactant: 0, sansObjet: 11 },
  },
  derniereCollecteLe: null,
  sourcesEnErreur: 0,
};

describe('en-tête et tuiles', () => {
  it('rail des sources : « Toutes » puis chaque source par son nom court, la source choisie enfoncée', () => {
    const h = html(<RailSources source="anssi" onSource={rien} />);
    expect(h).toContain('aria-label="Source"');
    expect([...h.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])).toEqual([
      'Toutes',
      'CNIL',
      'CEPD',
      'EUR-Lex',
      'ANSSI',
      'CERT Santé',
      'ANS',
      'Légifrance',
    ]);
    expect(h).toMatch(/aria-pressed="true">ANSSI</);
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('tuiles : une par statut, ordre du dessin, nombre et libellé, la tuile du filtre actif enfoncée', () => {
    const h = html(<TuilesVeilleVerre s={synthese} statut="a-suivre" onStatut={rien} />);
    expect(h).toContain('aria-label="Synthèse de la veille réglementaire, filtre par statut"');
    expect(
      [...h.matchAll(/data-statut="([^"]+)" aria-pressed="(true|false)">.*?>(\d+)<.*?>([^<]+)</g)].map((m) =>
        m.slice(1),
      ),
    ).toEqual([
      ['a-qualifier', 'false', '7', 'À qualifier'],
      ['a-suivre', 'true', '12', 'À suivre'],
      ['sans-objet', 'false', '31', 'Sans objet'],
      ['impactant', 'false', '2', 'Impactant'],
    ]);
  });

  it('rail d’état de la liste : « À qualifier » et « Tous », plus le statut choisi par une tuile', () => {
    expect(html(<RailStatut statut="" onStatut={rien} />)).toMatch(/>À qualifier<.*aria-pressed="true">Tous</);
    const h = html(<RailStatut statut="impactant" onStatut={rien} />);
    expect([...h.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])).toEqual([
      'À qualifier',
      'Impactant',
      'Tous',
    ]);
  });
});

describe('liste et publication choisie', () => {
  it('liste compacte : pastille, titre en texte simple, source et date, statut ; la publication choisie enfoncée', () => {
    const h = html(
      <ListeTextesVerre
        publications={[
          publication(),
          publication({ id: 'b', source: 'anssi', titre: '<b>Guide fictif</b>', statut: 'impactant' }),
        ]}
        choisie="b"
        onChoisir={rien}
      />,
    );
    expect(h).toContain('aria-label="Publications"');
    expect(h).toContain('&lt;b&gt;Guide fictif&lt;/b&gt;');
    expect(h).toMatch(/aria-pressed="true">.*Guide fictif.*ANSSI · <span class="horodatage">/);
    expect(h).toContain('data-statut="impactant">Impactant<');
    expect(html(<ListeTextesVerre publications={[]} choisie={null} onChoisir={rien} />)).toContain(
      'Aucune publication ne correspond.',
    );
  });

  it('publication choisie : titre, résumé, lien contrôlé sans référent, qualification pour le rôle du domaine', () => {
    const p = publication({ source: 'anssi', domaine: 'securite', lien: 'https://cyber.gouv.fr/fictif', resume: null });
    const avec = html(
      <DetailPublicationVerre
        p={p}
        droits={{ administrer: false, qualifier: { securite: true, donneesPersonnelles: false } }}
        onQualifier={rien}
      />,
    );
    expect(avec).toMatch(/<h2 id="vr-detail-[^"]+" class="vr-verre__detail-titre veille-texte">Publication fictive</);
    expect(avec).toContain('ANSSI · Agence nationale · publiée le');
    expect(avec).toContain('Aucun résumé repris pour cette publication.');
    expect(avec).toContain('href="https://cyber.gouv.fr/fictif"');
    expect(avec).toContain('rel="noopener noreferrer"');
    expect(avec).toContain('aria-label="Lire sur le site de la source (nouvel onglet)"');
    expect(avec).toContain('aria-label="Qualifier « Publication fictive »"');
    expect([...avec.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])).toEqual([
      'Sans objet',
      'À suivre',
      'Impactant',
    ]);
    expect(avec).toContain('Non qualifiée');
    // Ni « Ce que ça change pour nous » ni création : les suites ne sont pas servies par l'API.
    expect(avec).not.toMatch(/Ce que ça change|Créer/);

    const sans = html(
      <DetailPublicationVerre
        p={{ ...p, lien: 'https://ailleurs.example/x' }}
        droits={{ administrer: false, qualifier: { securite: false, donneesPersonnelles: true } }}
        onQualifier={rien}
      />,
    );
    expect(sans).not.toContain('<a ');
    expect(sans).toContain('Lien indisponible');
    expect(sans).toContain('Qualification réservée au rôle RSSI.');
    expect(sans).not.toContain('aria-label="Qualifier');
  });
});
