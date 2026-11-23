/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026, maquettes validées le même jour) :
   écran « Machines », côté interface. Présentation « Parc » par défaut et choix mémorisé respecté ; filtre « Groupe » (un
   groupe, « Sans groupe ») dans l'adresse de la liste et du parc ; menu « Groupe » (nombre de machines lues) ; mention
   « maintenu par <fournisseur> » (lien pour qui lit les fournisseurs, nom seul sinon, « fournisseur supprimé » sans lien) ;
   cases à cocher de la fenêtre d'un groupe (membres, ajouts, retraits, « Tout cocher (n trouvées) », lots de 500) ;
   « aussi dans « X » » ; bouton réservé au droit de modifier ; fenêtre sous la CSP (aucun style en ligne, lockScroll
   désactivé) ; aide. Données entièrement fictives. */
import { MantineProvider } from '@mantine/core';
import type { GroupeMachines, MachineGroupe } from '@suivi/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help';
import { FILTRES_MACHINES_VIDES, urlMachines } from '../src/vulnerabilites/failles';
import {
  AUCUN_CHANGEMENT,
  basculer,
  estCochee,
  libelleToutCocher,
  lotsMembres,
  mentionAutresGroupes,
  mentionFournisseur,
  optionsFiltreGroupe,
  PAGE_FOURNISSEURS,
  toutCocher,
  urlMachinesGroupe,
  vueMachines,
} from '../src/vulnerabilites/groupes';
import { MentionFournisseurGroupe } from '../src/vulnerabilites/GroupesMachines';
import { urlParc } from '../src/vulnerabilites/parc';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const source = (f: string) => readFileSync(path.join(ICI, '../src/vulnerabilites', f), 'utf8');
const rendu = (e: ReactElement) =>
  renderToStaticMarkup(
    createElement(
      MantineProvider,
      { withCssVariables: false, withGlobalClasses: false },
      createElement(MemoryRouter, null, e),
    ),
  );
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const groupe = (extra: Partial<GroupeMachines> = {}): GroupeMachines => ({
  id: uuid(1),
  nom: 'Applications fictives',
  description: '',
  fournisseur: { id: 'SUP-001', ref: 'legacy:suppliers:SUP-001', nom: 'Fournisseur fictif', etat: 'present' },
  machinesLues: 3,
  horsLecture: false,
  version: 1,
  createdBy: 'compte.fictif',
  createdAt: '2026-11-23T08:00:00.000Z',
  updatedBy: 'compte.fictif',
  updatedAt: '2026-11-23T08:00:00.000Z',
  ...extra,
});
const machine = (n: number, membre: boolean, autres: string[] = []): MachineGroupe => ({
  id: uuid(100 + n),
  nom: `srv-fictif-${n}.interne.invalid`,
  adresse: `192.0.2.${n}`,
  systeme: null,
  role: null,
  perimetreNom: null,
  membre,
  autresGroupes: autres.map((nom, i) => ({ id: uuid(200 + i), nom })),
});

describe('présentation de l’écran « Machines »', () => {
  it('« Parc » sans préférence mémorisée ; un choix mémorisé reste respecté', () => {
    expect(vueMachines(undefined)).toBe('parc');
    expect(vueMachines(null)).toBe('parc');
    expect(vueMachines('inconnue')).toBe('parc');
    expect(vueMachines('liste')).toBe('liste');
    expect(vueMachines('parc')).toBe('parc');
  });
  it('l’écran lit la présentation par cette règle (plus de « Liste » par défaut)', () => {
    const src = source('Machines.tsx');
    expect(src).toContain('const vue: VueMachines = vueMachines(affichage.vue);');
    expect(src).not.toMatch(/affichage\.vue \?\? 'liste'/);
  });
});

describe('filtre « Groupe » de la liste et du parc', () => {
  it('adresse : un groupe ou « Sans groupe », pour la liste comme pour le parc', () => {
    expect(urlMachines({ ...FILTRES_MACHINES_VIDES, groupe: uuid(1) })).toBe(
      `/api/vulnerabilites/machines?groupe=${uuid(1)}`,
    );
    expect(urlParc({ ...FILTRES_MACHINES_VIDES, groupe: 'aucun' })).toBe(
      '/api/vulnerabilites/machines/parc?groupe=aucun',
    );
    expect(urlMachines({ ...FILTRES_MACHINES_VIDES, groupe: '' })).toBe('/api/vulnerabilites/machines');
  });
  it('menu : chaque groupe avec son nombre de machines lues, puis « Sans groupe » ; « Tous les groupes » sans choix', () => {
    expect(optionsFiltreGroupe([groupe(), groupe({ id: uuid(2), nom: 'Bases fictives', machinesLues: 0 })])).toEqual([
      { value: uuid(1), label: 'Applications fictives (3)' },
      { value: uuid(2), label: 'Bases fictives (0)' },
      { value: 'aucun', label: 'Sans groupe' },
    ]);
    const src = source('Machines.tsx');
    expect(src).toContain('label="Groupe"');
    expect(src).toContain('placeholder={TOUS_LES_GROUPES}');
  });
  it('« maintenu par » : lien pour qui lit les fournisseurs, nom seul sinon ; « fournisseur supprimé » sans lien', () => {
    const f = groupe().fournisseur;
    expect(mentionFournisseur(f, true)).toEqual({
      texte: 'maintenu par',
      nom: 'Fournisseur fictif',
      lien: PAGE_FOURNISSEURS,
    });
    expect(mentionFournisseur(f, false)).toEqual({ texte: 'maintenu par', nom: 'Fournisseur fictif', lien: null });
    const supprime = { id: 'SUP-009', ref: 'legacy:suppliers:SUP-009', nom: null, etat: 'supprime' as const };
    expect(mentionFournisseur(supprime, true)).toEqual({ texte: 'fournisseur supprimé', nom: null, lien: null });
    expect(mentionFournisseur(null, true)).toBeNull();
    const avecLien = rendu(createElement(MentionFournisseurGroupe, { groupe: groupe(), lireFournisseurs: true }));
    expect(avecLien).toContain('maintenu par');
    expect(avecLien).toMatch(/<a[^>]*href="\/pilotage\/fournisseurs"[^>]*>Fournisseur fictif<\/a>/);
    const sansLien = rendu(createElement(MentionFournisseurGroupe, { groupe: groupe(), lireFournisseurs: false }));
    expect(sansLien).toContain('Fournisseur fictif');
    expect(sansLien).not.toContain('<a');
    const orphelin = rendu(
      createElement(MentionFournisseurGroupe, {
        groupe: groupe({ fournisseur: supprime, horsLecture: true }),
        lireFournisseurs: true,
      }),
    );
    expect(orphelin).toContain('fournisseur supprimé');
    expect(orphelin).toContain('et d’autres hors de votre lecture');
    expect(orphelin).not.toContain('<a');
  });
});

describe('fenêtre d’un groupe : cases à cocher', () => {
  it('membres d’origine, ajouts et retraits ; revenir à l’état enregistré efface le changement', () => {
    const dans = machine(1, true);
    const hors = machine(2, false);
    expect(estCochee(dans, AUCUN_CHANGEMENT)).toBe(true);
    expect(estCochee(hors, AUCUN_CHANGEMENT)).toBe(false);
    let c = basculer(hors, true, AUCUN_CHANGEMENT);
    c = basculer(dans, false, c);
    expect([...c.ajouter]).toEqual([hors.id]);
    expect([...c.retirer]).toEqual([dans.id]);
    expect(estCochee(hors, c)).toBe(true);
    expect(estCochee(dans, c)).toBe(false);
    c = basculer(dans, true, basculer(hors, false, c));
    expect(c.ajouter.size + c.retirer.size).toBe(0);
  });
  it('« Tout cocher (n trouvées) » : toutes les machines trouvées, au-delà de la page ; lots de 500 au plus', () => {
    expect(libelleToutCocher(1)).toBe('Tout cocher (1 trouvée)');
    expect(libelleToutCocher(12)).toBe('Tout cocher (12 trouvées)');
    const ids = Array.from({ length: 501 }, (_, i) => uuid(1000 + i));
    const c = toutCocher(ids, { ajouter: new Set(), retirer: new Set([ids[0]!, uuid(9)]) });
    expect(c.ajouter.size).toBe(501);
    expect([...c.retirer]).toEqual([uuid(9)]);
    const lots = lotsMembres(c);
    expect(lots.map((l) => l.ajouter.length + l.retirer.length)).toEqual([500, 2]);
    expect(lots[0]!.retirer).toEqual([uuid(9)]);
  });
  it('« aussi dans « X » »', () => {
    expect(mentionAutresGroupes(machine(1, true))).toBeNull();
    expect(mentionAutresGroupes(machine(1, true, ['Bases fictives']))).toBe('aussi dans « Bases fictives »');
    expect(mentionAutresGroupes(machine(1, true, ['A', 'B', 'C']))).toBe('aussi dans « A », « B » et « C »');
  });
  it('adresse de la fenêtre : recherche, membres, page', () => {
    expect(urlMachinesGroupe(uuid(1), { q: ' 192.0.2 ', membres: 'oui' }, 2)).toBe(
      `/api/vulnerabilites/groupes/${uuid(1)}/machines?q=192.0.2&membres=oui&page=2`,
    );
    expect(urlMachinesGroupe(uuid(1), {})).toBe(`/api/vulnerabilites/groupes/${uuid(1)}/machines`);
  });
});

describe('bouton, fenêtre et CSP', () => {
  it('« Groupes de machines… » à droite du titre, réservé au droit de modifier les machines', () => {
    const src = source('Machines.tsx');
    expect(src).toMatch(
      /actions=\{\s*modifier && \(\s*<Button variant="default" onClick=\{\(\) => setGroupesOuverts\(true\)\}>\s*Groupes de machines…/,
    );
    expect(src).toContain('{modifier && <FenetreGroupes');
  });
  it('fenêtre : composants de la charte, aucun style en ligne, lockScroll désactivé, pagination nommée', () => {
    const src = source('GroupesMachines.tsx');
    expect(src).not.toMatch(/\sstyle=\{/);
    expect(src).not.toMatch(/lockScroll=\{true\}/);
    expect(src.match(/<Modal\b/g)?.length).toBe(src.match(/^\s+lockScroll=\{false\}/gm)?.length);
    expect(src.match(/<Modal\b/g)?.length).toBe(src.match(/^\s+closeButtonProps=\{\{ 'aria-label'/gm)?.length);
    expect(src.match(/<Pagination\b/g)?.length).toBe(src.match(/\{\.\.\.NOMS_PAGINATION\}/g)?.length);
    expect(src).toContain('libelleToutCocher(page_.total)');
    expect(src).toContain('mentionAutresGroupes(m)');
    expect(src).toContain('ConfirmButton');
    // Menu des fournisseurs : liste de la route du module Fournisseurs, seulement avec le droit de les lire.
    expect(src).toContain("get<FournisseurLu[]>('/api/suppliers')");
    expect(src).toMatch(/lireFournisseurs \? \(\s*<ChoixFournisseur/);
  });
});

describe('aide', () => {
  it('présentation « Parc » par défaut, groupes de machines, filtre et fournisseur', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'vulnerabilites-failles')!.steps.join(' ');
    for (const t of [
      '« Parc » par défaut',
      'Groupes de machines…',
      '« Sans groupe »',
      'Tout cocher',
      'aussi dans',
      'maintenu par',
      'fournisseur supprimé',
      'hors de votre lecture',
    ])
      expect(a).toContain(t);
  });
});
