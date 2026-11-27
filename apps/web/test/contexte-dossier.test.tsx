/* Périmètre et contexte en dossier (dessin validé par le RSSI le 27/11/2026) : complétude des cinq rubriques (blancs seuls
   = vide), aperçu des textes longs, choix de la fiche affichée, rendu accessible (anneau nommé, titres de rubriques en h3,
   boutons nommés), état vide, choix entre plusieurs fiches et lecture seule. Données fictives, rendu statique sans réseau
   ni base. */
import { MantineProvider } from '@mantine/core';
import type { GrcObject } from '@suivi/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { createElement, Fragment, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContexteDossier, type ProprietesDossier } from '../src/pilotage/ContexteDossier';
import {
  AIDES_RUBRIQUES,
  apercuTexte,
  arcCompletude,
  completudeContexte,
  dateMiseAJour,
  ficheAffichee,
  libelleCompletude,
  rubriquesContexte,
} from '../src/pilotage/contexte-dossier';
import { Fields } from '../src/pilotage/Fields';

const P = '11111111-1111-4111-8111-111111111111';
const lire = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = (n: ReactNode) => renderToStaticMarkup(createElement(MantineProvider, null, n));
const decode = (h: string) =>
  h
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, '’')
    .replace(/&quot;/g, '"');
const compter = (h: string, motif: RegExp) => h.match(new RegExp(motif, 'g'))?.length ?? 0;

const COMPLET = {
  organisation: 'Groupement fictif : trois sites.\nGouvernance par un comité de direction.',
  scope: 'Soins de court séjour, imagerie, biologie.',
  interfaces: 'Hébergeur fictif, éditeur fictif.',
  issues: 'Continuité des soins, réglementation.',
  exclusions: 'Restauration, confiée à un prestataire fictif.',
};

function fiche(id: string, name: string, data: Record<string, unknown>, extra: Partial<GrcObject> = {}): GrcObject {
  return {
    id,
    smsiId: P,
    kind: 'context',
    name,
    data,
    version: 1,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-12T10:00:00.000Z',
    ...extra,
  } as GrcObject;
}

function dossier(p: Partial<ProprietesDossier> & { fiches: GrcObject[] }) {
  return decode(
    html(
      createElement(ContexteDossier, {
        chargement: false,
        writable: true,
        smsi: P,
        responsable: () => 'Responsable SSI',
        etat: () => null,
        onOpen: () => undefined,
        onCreate: () => undefined,
        autresActions: (_o: GrcObject, cible: ReactElement, avant?: ReactNode) =>
          createElement(Fragment, null, cible, avant),
        ...p,
      }),
    ),
  );
}

describe('complétude de la fiche de contexte', () => {
  it('de 0/5 à 5/5, dans l’ordre des rubriques', () => {
    const cles = ['organisation', 'scope', 'interfaces', 'issues', 'exclusions'] as const;
    expect(completudeContexte({})).toEqual({ renseignees: 0, total: 5 });
    for (let n = 1; n <= 5; n++) {
      const data = Object.fromEntries(cles.slice(0, n).map((c) => [c, COMPLET[c]]));
      expect(completudeContexte(data), String(n)).toEqual({ renseignees: n, total: 5 });
    }
    expect(rubriquesContexte({}).map((r) => r.cle)).toEqual([...cles]);
    expect(rubriquesContexte({}).map((r) => r.libelle)).toEqual([
      'Organisation',
      'Activités, entités et services concernés',
      'Interfaces et dépendances',
      'Enjeux internes et externes',
      'Exclusions et justification',
    ]);
  });

  it('un texte fait seulement de blancs, ou une valeur qui n’est pas un texte, compte comme vide', () => {
    expect(completudeContexte({ ...COMPLET, exclusions: '   \n\t ' })).toEqual({ renseignees: 4, total: 5 });
    expect(completudeContexte({ ...COMPLET, issues: 3, scope: null, interfaces: ['x'] })).toEqual({
      renseignees: 2,
      total: 5,
    });
  });

  it('texte accessible et arc de l’anneau', () => {
    expect(libelleCompletude(4, 5)).toBe('4 rubriques renseignées sur 5');
    expect(libelleCompletude(1, 5)).toBe('1 rubrique renseignée sur 5');
    expect(libelleCompletude(0, 5)).toBe('0 rubrique renseignée sur 5');
    expect(arcCompletude(0, 5, 26).arc).toBe(0);
    expect(arcCompletude(4, 5, 26)).toEqual({ arc: 130.7, circonference: 163.4 });
    expect(arcCompletude(5, 5, 26).arc).toBe(163.4);
  });

  it('la dernière case, seule sur sa ligne, prend les deux colonnes quand elle est vide', () => {
    expect(rubriquesContexte({ ...COMPLET, exclusions: '' }).map((r) => r.etendue)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(rubriquesContexte(COMPLET).some((r) => r.etendue)).toBe(false);
    expect(
      rubriquesContexte({ exclusions: '' })
        .filter((r) => r.etendue)
        .map((r) => r.cle),
    ).toEqual(['exclusions']);
  });

  it('aide des exclusions : la phrase du dessin', () => {
    expect(AIDES_RUBRIQUES.exclusions).toBe(
      'Rien d’exclu pour l’instant. Indiquez les activités hors du périmètre et pourquoi : l’auditeur le demandera (clause 4.3).',
    );
    for (const r of rubriquesContexte({})) expect(r.aide.length, r.cle).toBeGreaterThan(20);
  });
});

describe('aperçu des textes longs', () => {
  it('un texte court reste entier, retours à la ligne compris', () => {
    expect(apercuTexte('Ligne un\nLigne deux\n')).toEqual({ texte: 'Ligne un\nLigne deux', tronque: false });
  });

  it('au-delà de six lignes : les six premières, puis « … »', () => {
    const r = apercuTexte(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n'));
    expect(r.tronque).toBe(true);
    expect(r.texte).toBe('a\nb\nc\nd\ne\nf…');
  });

  it('au-delà de 420 caractères : coupé à la fin d’un mot, sans dépasser', () => {
    const long = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(' ');
    const r = apercuTexte(long);
    expect(r.tronque).toBe(true);
    expect(r.texte.endsWith('…')).toBe(true);
    expect(r.texte.length).toBeLessThanOrEqual(421);
    expect(long.startsWith(r.texte.slice(0, -1))).toBe(true);
    expect(long.charAt(r.texte.length - 1)).toBe(' ');
  });
});

describe('fiche affichée et date de mise à jour', () => {
  const a = fiche('a', 'Fiche A', {}),
    b = fiche('b', 'Fiche B', {});
  it('la fiche choisie si elle est encore là, sinon la première', () => {
    expect(ficheAffichee([a, b], null)).toBe(a);
    expect(ficheAffichee([a, b], 'b')).toBe(b);
    expect(ficheAffichee([a, b], 'archivee')).toBe(a);
    expect(ficheAffichee([], 'a')).toBeUndefined();
  });
  it('jour civil de Paris ; date inconnue (fiche reprise sans date) : null', () => {
    expect(dateMiseAJour('2026-03-12T10:00:00.000Z')).toBe('12/03/2026');
    expect(dateMiseAJour('2026-03-12T23:30:00.000Z')).toBe('13/03/2026');
    expect(dateMiseAJour('1970-01-01T00:00:00.000Z')).toBeNull();
    expect(dateMiseAJour(null)).toBeNull();
  });
});

describe('rendu du dossier', () => {
  const quatre = fiche('f1', 'Établissement fictif (démonstration)', { ...COMPLET, exclusions: '  ' });

  it('en tête : anneau nommé, nom en h2, responsable, date, historique, autres actions et « Modifier la fiche »', () => {
    const h = dossier({ fiches: [quatre] });
    expect(h).toMatch(/<svg[^>]*role="img"[^>]*aria-label="4 rubriques renseignées sur 5"/);
    expect(h).toMatch(/>4(<!-- -->)?\/(<!-- -->)?5<\/text>/);
    expect(h).toMatch(/<h2[^>]*>Établissement fictif \(démonstration\)<\/h2>/);
    expect(h).toContain('Responsable : Responsable SSI');
    expect(h).toContain('Mis à jour le 12/03/2026');
    expect(h).toContain('aria-label="Historique de la fiche"');
    expect(h).toContain('aria-label="Autres actions pour Établissement fictif (démonstration)"');
    expect(h).toContain('Modifier la fiche');
    // Pas de recherche ni de puces (moins de huit fiches), pas de choix de fiche pour une seule fiche.
    expect(h).not.toContain('type="search"');
    expect(h).not.toContain('Fiches de contexte du périmètre');
    expect(h).not.toContain('<table');
  });

  it('corps : une case par rubrique, titre en h3, état « Renseigné » ou « À compléter », lignes conservées', () => {
    const h = dossier({ fiches: [quatre] });
    expect(compter(h, /<h3 /)).toBe(5);
    expect(compter(h, />Renseigné</)).toBe(4);
    expect(compter(h, />À compléter</)).toBe(1);
    expect(h).toContain('Groupement fictif : trois sites.\nGouvernance par un comité de direction.');
    expect(h).toMatch(/data-rubrique="exclusions" data-etat="a-completer" data-etendue="true"/);
    expect(h).toContain(AIDES_RUBRIQUES.exclusions);
    expect(h).toContain('aria-label="Compléter : Exclusions et justification"');
    expect(compter(h, /aria-label="Compléter : /)).toBe(1);
    expect(h).not.toContain('Lire la suite');
  });

  it('texte très long : aperçu et « Lire la suite »', () => {
    const long = Array.from({ length: 10 }, (_, i) => `Ligne fictive ${i}`).join('\n');
    const h = dossier({ fiches: [fiche('f', 'Fiche longue', { ...COMPLET, issues: long })] });
    expect(h).toContain('aria-label="Lire la suite : Enjeux internes et externes"');
    expect(h).not.toContain('Ligne fictive 9');
  });

  it('fiche reprise de l’outil de suivi : pastille « Existant » ; sans responsable : « Non attribué »', () => {
    const h = dossier({
      fiches: [fiche('legacy:scope:1', 'Organisation fictive', COMPLET, { updatedAt: '1970-01-01T00:00:00.000Z' })],
      responsable: () => null,
    });
    expect(h).toMatch(/>Existant</);
    expect(h).toContain('Non attribué');
    expect(h).not.toContain('Responsable :');
    expect(h).toContain('Date de mise à jour non renseignée');
    expect(h).toContain('aria-label="5 rubriques renseignées sur 5"');
  });

  it('aucune fiche : les cinq rubriques à décrire et « Décrire le contexte »', () => {
    const h = dossier({ fiches: [] });
    for (const r of rubriquesContexte({})) expect(h).toContain(`</span>${r.libelle}</li>`);
    expect(h).toContain('Décrire le contexte');
    expect(h).not.toContain('Modifier la fiche');
    expect(dossier({ fiches: [], chargement: true })).toContain('Chargement du contexte…');
  });

  it('plusieurs fiches : une gélule par fiche, la première affichée, ajout accessible', () => {
    const h = dossier({ fiches: [quatre, fiche('f2', 'Seconde fiche fictive', COMPLET)] });
    expect(h).toContain('role="group" aria-label="Fiches de contexte du périmètre"');
    expect(h).toMatch(/aria-pressed="true"[^>]*>(<[^>]+>)*Établissement fictif \(démonstration\)/);
    expect(h).toMatch(/aria-pressed="false"[^>]*>(<[^>]+>)*Seconde fiche fictive/);
    expect(h).toMatch(/<h2[^>]*>Établissement fictif \(démonstration\)<\/h2>/);
    expect(h).toContain('Ajouter une fiche de contexte');
  });

  it('une seule fiche : l’ajout reste dans « Autres actions »', () => {
    const entree = createElement('span', null, 'Entrée ajout fictive');
    expect(dossier({ fiches: [quatre], entreeAjout: entree })).toContain('Entrée ajout fictive');
    expect(dossier({ fiches: [quatre], entreeAjout: entree, writable: false })).not.toContain('Entrée ajout fictive');
  });

  it('lecture seule : ni « Modifier », ni « Compléter », ni « Ajouter » ; la fiche reste consultable', () => {
    const une = dossier({ fiches: [quatre], writable: false });
    expect(une).not.toContain('Modifier la fiche');
    expect(une).not.toContain('Compléter :');
    expect(une).toContain('Afficher la fiche');
    expect(une).toContain('aria-label="Historique de la fiche"');
    const plusieurs = dossier({ fiches: [quatre, fiche('f2', 'Seconde fiche fictive', COMPLET)], writable: false });
    expect(plusieurs).not.toContain('Ajouter une fiche de contexte');
    expect(plusieurs).toContain('aria-label="Fiches de contexte du périmètre"');
    const vide = dossier({ fiches: [], writable: false });
    expect(vide).not.toContain('Décrire le contexte');
    expect(vide).toContain('Consultation seule');
  });
});

describe('branchements', () => {
  it('« Compléter » place le curseur dans le champ visé du formulaire (data-autofocus), jamais en lecture seule', () => {
    const rendu = (readonly: boolean) =>
      renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(
            MantineProvider,
            null,
            createElement(Fields, {
              kind: 'context',
              data: {},
              onChange: () => undefined,
              sources: [],
              readonly,
              champActif: 'exclusions',
            }),
          ),
        ),
      );
    const textareas = [...rendu(false).matchAll(/<textarea[^>]*>/g)].map((m) => m[0]);
    expect(textareas).toHaveLength(5);
    expect(textareas.filter((t) => t.includes('data-autofocus="true"'))).toHaveLength(1);
    expect(textareas[4]).toContain('data-autofocus="true"');
    expect(rendu(true)).not.toContain('data-autofocus');
  });

  it('le registre de kind « context » se présente en dossier, avec son menu, sa création et ses fenêtres', () => {
    const registre = lire('../src/pilotage/Registry.tsx');
    expect(registre).toMatch(/if \(kind === 'context'\)\s*return \(/);
    expect(registre).toContain('<ContexteDossier');
    expect(registre).toContain('autresActions={autresActions}');
    expect(registre).toContain('{fenetreDecisions}');
    // La présentation de la fiche s'ouvre sur l'onglet demandé ; le formulaire, sur le champ visé.
    const editeur = lire('../src/pilotage/RecordEditor.tsx');
    expect(editeur).toContain('setModification(!!vue?.champ)');
    // Fenêtre montée déjà ouverte (première ouverture d'une fiche) : le formulaire d'emblée quand un champ est visé.
    expect(editeur).toContain('useState(() => opened && !!vue?.champ)');
    expect(editeur).toContain('<ContextPresentation {...presentation} ongletInitial={vue?.onglet} />');
  });
});
