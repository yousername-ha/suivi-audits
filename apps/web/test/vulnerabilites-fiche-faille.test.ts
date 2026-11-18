/* Lot PC4 (ADR 0100, point 19) : fiche illustrée d'une faille. En-tête (priorité, marques, alerte ouverte, présence lue),
   recommandations par source et en texte, vecteur traduit (termes exacts, icône par métrique, phrase, vecteur brut et
   version, source qui parle), schéma SVG nommé avec son équivalent texte, cas « non communiqué » ; aucun style en ligne ;
   mise en page du schéma et coupe des libellés ; adresse de la route ; aide. Données entièrement fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import { decoderVecteurCvss, schemaVecteur } from '@suivi/shared';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { couperLignes, fmtJour, schemaEtroit, schemaLarge, urlFicheFaille } from '../src/vulnerabilites/fiche-faille';
import { FicheFailleIllustree } from '../src/vulnerabilites/FicheFaille';
import { ficheFaille } from './fiche-faille-fixture';

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/ui/src');
// Fournisseur réglé comme l'application sous la CSP (ADR 0006) : aucune balise <style> injectée.
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(MantineProvider, { withCssVariables: false, withGlobalClasses: false }, e),
    ),
  );
const fiche = (f: Parameters<typeof ficheFaille>[0] = {}) =>
  rendu(createElement(FicheFailleIllustree, { f: ficheFaille(f) }));
/** Balises propres à la fiche (classes ff-*) : aucune ne porte d'attribut style ; ni <style> ni <script>. */
const sansStyle = (html: string) => {
  const propres = (html.match(/<[^>]*class="ff[^"]*"[^>]*>/gi) ?? []).filter((b) => !/mantine-/i.test(b));
  expect(propres.length).toBeGreaterThan(0);
  expect(propres.filter((b) => /\sstyle=/i.test(b))).toEqual([]);
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/<script/i);
};
const V31 = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
const V40 = 'CVSS:4.0/AV:A/AC:L/AT:P/PR:L/UI:P/VC:H/VI:L/VA:N/SC:L/SI:N/SA:N';

describe('lot PC4 : en-tête de la fiche', () => {
  it('priorité et faits, marques zero-day et exploitable, alerte ouverte, présence lue', () => {
    const html = fiche({ alerte: { id: '00000000-0000-4000-8000-0000000000a1', niveau: 'critique', priorite: 'P1' } });
    for (const t of [
      'CVE-2026-90001 · Produit fictif 8.3',
      'Priorité 1 (P1)',
      'Exploitation avérée (catalogue KEV) · Détectée par Tenable',
      'Priorité et faits calculés par la plateforme, les mêmes pour tous.',
      'Zero-day : exploitation avérée',
      'Présence : 3 machines et 1 actif exposé que vous lisez.',
      'Alerte critique ouverte sur cette faille (P1)',
      'href="/vulnerabilites/alertes?alerte=00000000-0000-4000-8000-0000000000a1"',
    ])
      expect(html).toContain(t);
    expect(html).not.toContain('Exploitable : code d’exploitation disponible');
    const autre = fiche({
      marques: { zeroDay: false, exploitable: true },
      presence: { machines: 0, actifs: 0, horsLecture: true },
      priorite: null,
      cves: [],
      nombreCves: 0,
    });
    expect(autre).toContain('Exploitable : code d’exploitation disponible, sans exploitation avérée');
    expect(autre).not.toContain('Zero-day');
    expect(autre).toContain('Aucune priorité calculée : aucune CVE n’est citée.');
    expect(autre).toContain('Sans CVE');
    expect(autre).toContain('touche aussi des éléments que vous ne lisez pas');
    expect(autre).not.toContain('ouvrir l’alerte');
  });
});

describe('lot PC4 : vecteur d’attaque traduit et schéma', () => {
  it('v3.1 réseau sans privilège : termes exacts, traduction, vecteur brut et version, phrase, source qui parle', () => {
    const html = fiche();
    for (const t of [
      'Vecteur d’attaque, en clair',
      V31,
      'CVSS v3.1',
      'Attaque possible à distance, par le réseau (Internet compris)',
      'Vecteur d’accès : réseau',
      'AV:N',
      'Simple à réaliser',
      'Complexité de l’attaque : faible',
      'Aucun compte nécessaire',
      'Privilèges requis : aucun',
      'Sans action de la victime',
      'Interaction de l’utilisateur : aucune',
      'Portée : inchangée',
      'Confidentialité',
      'Intégrité',
      'Disponibilité',
      'Lecture de toutes les données',
      'Arrêt complet du service',
      'En clair : ',
      'Un attaquant peut agir à distance, par le réseau (Internet compris), sans compte et sans action d’un utilisateur, par une attaque simple.',
      'Phrase composée par la plateforme à partir du vecteur publié',
      'Vecteur retenu : NVD (CVE-2026-90001), CVSS v3.1, score 9,8 : seul vecteur publié.',
    ])
      expect(html).toContain(t);
    // Une icône par métrique, décorative (le texte porte le sens).
    expect((html.match(/class="ff-icone"/g) ?? []).length).toBe(5 + 3);
    expect(html).toMatch(/<svg class="ff-icone"[^>]*aria-hidden="true"/);
    sansStyle(html);
  });

  it('schéma : SVG nommé en une phrase (large et étroit), libellés sur chaque étape, équivalent texte', () => {
    const f = ficheFaille({ presence: { machines: 3, actifs: 1, horsLecture: true } });
    const html = rendu(createElement(FicheFailleIllustree, { f }));
    const nom = schemaVecteur(decoderVecteurCvss(V31)!, f.composant, f.presence).nom;
    expect((html.match(/<svg class="ff-schema__svg[^"]*"[^>]*role="img"/g) ?? []).length).toBe(2);
    expect(html.split(`aria-label="${nom}"`).length - 1).toBe(2);
    for (const t of [
      'D’OÙ VIENT L’ATTAQUE',
      'CE QU’IL FAUT À L’ATTAQUANT',
      'COMPOSANT TOUCHÉ',
      'CE QUI EST ATTEINT',
      'Internet ou tout réseau',
      'Aucun compte',
      'Sans action d’une personne',
      'Attaque simple',
      'Produit fictif 8.3',
      'ÉLEVÉ',
      'PR:N',
      'Schéma composé par la plateforme à partir du vecteur et de ce que vous lisez',
      'D’où vient l’attaque : Internet ou tout réseau (AV:N).',
      'Ce qu’il faut à l’attaquant : Aucun compte (PR:N), Sans action d’une personne (UI:N), Attaque simple (AC:L).',
      'Composant touché : Produit fictif 8.3 — 3 machines et 1 actif exposé que vous lisez ; touche aussi des éléments que vous ne lisez pas.',
      'Ce qui est atteint : Confidentialité élevé (C:H), Intégrité élevé (I:H), Disponibilité élevé (A:H).',
    ])
      expect(html).toContain(t);
    expect(html).toMatch(/<figure class="ff-schema" aria-labelledby="[^"]+"/);
    sansStyle(html);
  });

  it('vecteur local avec privilèges élevés (Tenable, sans préfixe) et règle des sources', () => {
    const html = fiche({
      vecteurs: [
        { source: 'nvd', cve: 'CVE-2026-90002', brut: 'CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H', score: 6.7 },
        { source: 'tenable', cve: null, brut: 'AV:L/AC:H/PR:H/UI:R/S:C/C:H/I:N/A:N', score: 7.1 },
      ],
    });
    for (const t of [
      'Vecteur d’accès : local',
      'Accès local nécessaire',
      'Privilèges requis : élevés',
      'Compte à privilèges élevés nécessaire (administrateur)',
      'Interaction de l’utilisateur : requise',
      'Portée : modifiée',
      'CVSS v3 (version mineure non précisée par la source)',
      'Vecteur retenu : Tenable, CVSS v3 (version mineure non précisée par la source), score 7,1 : le plus sévère des vecteurs publiés (règle des sources).',
      'Autres vecteurs publiés',
      'NVD (CVE-2026-90002), CVSS v3.1, score 6,7',
      'CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H',
      'Accès local',
    ])
      expect(html).toContain(t);
  });

  it('CVSS v4.0 : conditions préalables, interaction passive, systèmes en aval', () => {
    const html = fiche({ vecteurs: [{ source: 'nvd', cve: 'CVE-2026-90003', brut: V40, score: 5.9 }] });
    for (const t of [
      'CVSS v4.0',
      V40,
      'Vecteur d’accès : réseau adjacent',
      'Conditions préalables de l’attaque : présentes',
      'Interaction de l’utilisateur : passive',
      'Effet sur les systèmes en aval',
      'Impact sur la confidentialité des systèmes en aval : faible',
      'Impact sur la confidentialité du système vulnérable : élevé',
      'AT:P',
      'Sur les systèmes en aval, il peut lire une partie des données.',
    ])
      expect(html).toContain(t);
  });

  it('vecteur absent ou mal formé : « non communiqué », sans traduction ni schéma', () => {
    for (const vecteurs of [
      [],
      [{ source: 'tenable' as const, cve: null, brut: 'AV:N/AC:L/Au:N/C:P/I:P/A:P', score: 10 }],
    ]) {
      const html = fiche({ vecteurs });
      expect(html).toContain('Vecteur non communiqué');
      expect(html).toContain('La plateforme ne traduit rien et ne trace aucun schéma.');
      expect(html).not.toContain('ff-schema');
      expect(html).not.toContain('En clair : ');
      expect(html).not.toContain('Vecteur d’accès');
    }
    expect(
      fiche({ vecteurs: [{ source: 'tenable', cve: null, brut: 'AV:N/AC:L/Au:N/C:P/I:P/A:P', score: 10 }] }),
    ).toContain('Un vecteur publié n’a pas pu être lu');
  });
});

describe('lot PC4 : recommandations par source', () => {
  it('chaque source à part, textes tels quels et en texte, lien d’avis sans référent', () => {
    const html = fiche({
      recommandations: {
        kev: [
          {
            cve: 'CVE-2026-90001',
            action: 'Apply <b>mitigations</b> per vendor instructions.',
            echeance: '2026-12-03',
          },
        ],
        tenable: {
          correctif: 'Upgrade to <img src=x onerror=alert(1)> 8.3.29 or later.',
          publieLe: '2026-11-02T00:00:00.000Z',
        },
        versionsNvd: [
          {
            cve: 'CVE-2026-90001',
            editeur: 'editeur_fictif',
            produit: 'produit_fictif',
            version: null,
            debutInclus: '8.3.0',
            debutExclus: null,
            finInclus: null,
            finExclus: '8.3.29',
          },
        ],
        certSante: { correctif: 'oui', contournement: 'non' },
        avis: [
          {
            source: 'cert-fr',
            identifiant: 'CERTFR-2026-ALE-900',
            nature: 'alerte',
            titre: 'Vulnérabilité fictive <script>alert(1)</script>',
            adresse: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-900/',
            le: '2026-11-12T08:00:00.000Z',
          },
        ],
        alh: [
          {
            alerteId: '00000000-0000-4000-8000-000000000031',
            titre: 'Alerte fictive 31',
            defauts: [
              {
                nom: 'Outdated component',
                description: null,
                resolutions: [
                  { nom: 'Update the component', description: null, facilite: 'Quick Win', gain: 'Strong' },
                ],
              },
            ],
          },
        ],
      },
    });
    for (const t of [
      'Recommandations des sources',
      'rien n’est rédigé par la plateforme ni par l’assistant',
      'Catalogue KEV de la CISA · échéance 03/12/2026',
      'Apply &lt;b&gt;mitigations&lt;/b&gt; per vendor instructions.',
      'Tenable · correctif du contrôle',
      'Upgrade to &lt;img src=x onerror=alert(1)&gt; 8.3.29 or later.',
      'Texte de Tenable en anglais, tel quel ; correctif publié le 02/11/2026.',
      'NVD · versions touchées',
      'editeur_fictif produit_fictif : versions touchées à partir de 8.3.0, avant 8.3.29 (8.3.29 n’est plus citée comme touchée)',
      'la plateforme n’en tire aucun conseil',
      'CERT Santé · fiche',
      'Un correctif existe : Oui · une mesure de contournement existe : Non.',
      'CERT-FR · alerte',
      'Vulnérabilité fictive &lt;script&gt;alert(1)&lt;/script&gt;',
      'CERTFR-2026-ALE-900',
      'lire l’avis (source externe)',
      'AlgoLightHouse · Recommandations de l’éditeur',
      'Alerte : Alerte fictive 31',
      'Update the component',
      'facilité : Quick Win · gain : Strong',
    ])
      expect(html).toContain(t);
    expect(html).toMatch(/<p[^>]*lang="en"[^>]*>Apply &lt;b&gt;/i);
    expect(html).toMatch(
      /href="https:\/\/cert\.cyber\.gouv\.fr\/alerte\/CERTFR-2026-ALE-900\/"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*href="https:\/\/cert\.cyber\.gouv\.fr/i,
    );
    expect(html).not.toMatch(/<img|<script|<b>mitigations/i);
    expect(html).not.toContain('Aucune recommandation connue');
    sansStyle(html);
  });

  it('rien de connu : dit tel quel, sans conseil inventé', () => {
    const html = fiche();
    expect(html).toContain(
      'Aucune recommandation connue : aucune source rangée n’en publie pour cette faille. La plateforme n’en invente aucune.',
    );
    expect(html).not.toContain('ff-reco__source');
    expect(fiche({ recommandations: { tenable: { correctif: null, publieLe: null } } })).toContain(
      'Aucun correctif indiqué par Tenable.',
    );
  });
});

describe('lot PC4 : fonctions pures, feuille de style et aide', () => {
  it('adresse de la route, dates des sources, coupe des libellés', () => {
    expect(urlFicheFaille('cve', 'CVE-2026-90001')).toBe('/api/vulnerabilites/fiches/cve/CVE-2026-90001');
    expect(urlFicheFaille('alerte-alh', 'a b')).toBe('/api/vulnerabilites/fiches/alerte-alh/a%20b');
    expect(fmtJour('2026-12-03')).toBe('03/12/2026');
    expect(fmtJour('2026-11-02T00:00:00.000Z')).toBe('02/11/2026');
    expect(fmtJour(null)).toBe('');
    expect(couperLignes('Produit fictif : contrôle fictif 940004', 18, 2)).toEqual([
      'Produit fictif :',
      'contrôle fictif…',
    ]);
    expect(couperLignes('court', 18, 2)).toEqual(['court']);
    expect(couperLignes('motextrêmementlongsansespace', 10, 2)).toEqual(['motextrêm…']);
  });

  it('mise en page : boîtes sans chevauchement, flèches entre les boîtes, schéma étroit empilé', () => {
    for (const brut of [V31, V40]) {
      const s = schemaVecteur(decoderVecteurCvss(brut)!, 'Composant fictif au nom assez long pour être coupé', {
        machines: 12,
        actifs: 3,
        horsLecture: true,
      });
      const large = schemaLarge(s);
      for (let i = 1; i < large.boites.length; i++)
        expect(large.boites[i]!.x).toBeGreaterThan(large.boites[i - 1]!.x + large.boites[i - 1]!.l);
      expect(Math.max(...large.boites.map((b) => b.x + b.l))).toBeLessThanOrEqual(large.largeur);
      for (const b of large.boites) expect(b.y + b.h).toBeLessThanOrEqual(large.hauteur);
      expect(large.fleches).toHaveLength(3);
      const etroit = schemaEtroit(s);
      for (let i = 1; i < etroit.boites.length; i++)
        expect(etroit.boites[i]!.y).toBeGreaterThan(etroit.boites[i - 1]!.y + etroit.boites[i - 1]!.h);
      expect(etroit.boites.every((b) => b.lignes.every((l) => l.length <= 32))).toBe(true);
    }
  });

  it('feuille de style : ni px ni rem, schéma étroit sous la largeur du conteneur', () => {
    const css = readFileSync(path.join(UI, 'neon-fiche.css'), 'utf8');
    expect(css.split('\n').filter((l) => !l.trim().startsWith('@') && /(?<![\w-])\d*\.?\d+(px|rem)\b/.test(l))).toEqual(
      [],
    );
    expect(css).toMatch(/@container ff \(max-width: 46em\) \{[^@]*\.ff-schema__large \{\s*display: none;/);
  });

  it('aide : fiche illustrée, vecteur traduit, schéma, recommandations par source', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-failles')!.steps.join(' ');
    for (const t of ['Vecteur d’attaque, en clair', 'vecteur non communiqué', 'Recommandations des sources', 'schéma'])
      expect(a).toContain(t);
  });
});
