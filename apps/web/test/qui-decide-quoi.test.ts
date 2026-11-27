/* « Qui décide quoi » des rôles et responsabilités (ADR 0115 ; décision du RSSI du 27/11/2026) : passage entre le contrat
   de l'API et la grille commune, colonnes issues du registre (rôle retiré : lettres conservées, ignorées par le contrôle,
   effaçables), saisie des décisions, rendu accessible (en-têtes de lignes et de colonnes, une liste nommée par case,
   colonne « Contrôle »), lecture seule, légende courte, résumé (role=status) et emplacement sous le registre. Données
   fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RACI_DECISIONS_LETTRES_LIBELLES, type ColonneRoleRaci, type MatriceDecisions } from '@suivi/shared';
import { GrilleRaci, LegendeRaci, ResumeControleRaci } from '../src/pilotage/MatriceRaci';
import { MOTS_DECISIONS, NoteRolesRetires } from '../src/pilotage/QuiDecideQuoi';
import {
  ajouterDecision,
  colonnesDecisions,
  contenuDecisions,
  controleSaisieDecisions,
  corpsDecisions,
  decisionsSansNom,
  peutAjouterDecision,
  rolesRetiresAvecLettres,
} from '../src/pilotage/qui-decide-quoi';
import { avecLettre, renommer, retirerActeur, retirerActivite, type ContenuRaci } from '../src/pilotage/raci';

const DG = 'object:22222222-2222-4222-8222-222222222222';
const RSSI = 'object:11111111-1111-4111-8111-111111111111';
const ANCIEN = 'legacy:roles:ROL-9';
const ROLES: ColonneRoleRaci[] = [
  { ref: DG, libelle: 'Direction fictive', retire: false },
  { ref: RSSI, libelle: 'RSSI fictif', retire: false },
  { ref: ANCIEN, libelle: 'Rôle retiré', retire: true },
];
const MATRICE: Pick<MatriceDecisions, 'decisions' | 'cases'> = {
  decisions: [
    { id: 'budget', libelle: 'Valider le budget fictif' },
    { id: 'derogation', libelle: 'Accorder une dérogation fictive' },
  ],
  cases: [
    { decision: 'budget', role: RSSI, lettre: 'R' },
    { decision: 'budget', role: DG, lettre: 'A' },
    { decision: 'derogation', role: RSSI, lettre: 'R' },
    { decision: 'derogation', role: ANCIEN, lettre: 'A' },
  ],
};
const contenu = (): ContenuRaci => contenuDecisions(MATRICE, ROLES);
const rendre = <P extends object>(el: (p: P) => ReactElement | null, props: P) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(el as (p: P) => ReactElement, props)));
const grille = (c: ContenuRaci, modifiable: boolean) =>
  rendre(GrilleRaci, {
    label: 'Qui décide quoi : décisions et rôles',
    contenu: c,
    colonnes: colonnesDecisions(ROLES, c),
    controles: controleSaisieDecisions(c),
    modifiable,
    onChange: () => {},
    mots: MOTS_DECISIONS,
    taille: 'sm' as const,
    className: 'qui-decide-quoi__grille',
  });

describe('contrat et colonnes', () => {
  it('lignes = décisions ; colonnes = rôles du registre, puis le rôle retiré qui porte encore une lettre', () => {
    const c = contenu();
    expect(c.activites.map((a) => a.id)).toEqual(['budget', 'derogation']);
    expect(c.acteurs.map((a) => a.id)).toEqual([DG, RSSI]);
    expect(colonnesDecisions(ROLES, c).map((k) => [k.libelle, k.renommable, k.retirable, k.retiree])).toEqual([
      ['Direction fictive', false, false, false],
      ['RSSI fictif', false, false, false],
      ['Rôle retiré', false, true, true],
    ]);
    expect(rolesRetiresAvecLettres(ROLES, c).map((r) => r.ref)).toEqual([ANCIEN]);
  });
  it('rend le corps attendu par l’API, libellés nettoyés, sans perte de case', () => {
    const c = renommer(contenu(), 'activites', 'budget', '  Valider\tle budget  ');
    const corps = corpsDecisions(c);
    expect(corps.decisions[0]).toEqual({ id: 'budget', libelle: 'Valider le budget' });
    expect(corps.cases).toEqual(MATRICE.cases);
  });
  it('le contrôle ignore les lettres du rôle retiré, comme le serveur', () => {
    expect(controleSaisieDecisions(contenu()).map((x) => [x.activite, x.ecarts])).toEqual([
      ['budget', []],
      ['derogation', ['aucun_a']],
    ]);
  });
  it('effacer les lettres du rôle retiré fait disparaître sa colonne', () => {
    const c = retirerActeur(contenu(), ANCIEN);
    expect(c.cases.some((k) => k.acteur === ANCIEN)).toBe(false);
    expect(colonnesDecisions(ROLES, c).map((k) => k.libelle)).toEqual(['Direction fictive', 'RSSI fictif']);
    expect(rolesRetiresAvecLettres(ROLES, c)).toEqual([]);
  });
});

describe('saisie', () => {
  it('ajoute des décisions sous un identifiant libre, jusqu’à 60, et retire une décision avec ses cases', () => {
    const vide = contenuDecisions(null, ROLES);
    expect(vide.activites).toEqual([]);
    let c = ajouterDecision(ajouterDecision(vide));
    expect(c.activites).toEqual([
      { id: 'decision-1', libelle: 'Nouvelle décision' },
      { id: 'decision-2', libelle: 'Nouvelle décision' },
    ]);
    c = avecLettre(c, 'decision-1', RSSI, 'A');
    c = retirerActivite(c, 'decision-1');
    expect(c.cases).toEqual([]);
    let plein = vide;
    for (let i = 0; i < 61; i++) plein = ajouterDecision(plein);
    expect(plein.activites).toHaveLength(60);
    expect(peutAjouterDecision(plein)).toBe(false);
  });
  it('signale une décision sans nom avant l’enregistrement', () => {
    expect(decisionsSansNom(contenu())).toBe(false);
    expect(decisionsSansNom(renommer(contenu(), 'activites', 'budget', '   '))).toBe(true);
  });
});

describe('rendu', () => {
  it('tableau accessible : en-têtes, une liste nommée « décision – rôle » par case, colonne Contrôle', () => {
    const html = grille(contenu(), true);
    // Décision, trois colonnes de rôles et Contrôle ; une décision par en-tête de ligne.
    expect(html.match(/<th [^>]*scope="col"/g)).toHaveLength(5);
    expect(html.match(/<th [^>]*scope="row"/g)).toHaveLength(2);
    expect(html).toContain('>Décision</th>');
    expect(html).toContain('qui-decide-quoi__grille');
    expect(html.match(/<select/g)).toHaveLength(6);
    expect(html).toContain('aria-label="Valider le budget fictif – RSSI fictif"');
    expect(html).toContain('aria-label="Nom de la décision « Valider le budget fictif »"');
    expect(html).toContain('aria-label="Monter la décision « Accorder une dérogation fictive »"');
    expect(html).toContain('aria-label="Retirer la décision « Valider le budget fictif »"');
    // Les rôles se gèrent dans le registre : ni renommés ni retirés ici ; seul le rôle retiré s'efface.
    expect(html).not.toContain('Nom de le rôle');
    expect(html).not.toContain('Retirer le rôle « RSSI fictif »');
    expect(html).toContain('aria-label="Retirer le rôle « Rôle retiré » et ses lettres"');
    // Colonne retirée : seulement sa lettre actuelle et « — ».
    const retiree = html.split('aria-label="Accorder une dérogation fictive – Rôle retiré"')[1]!.split('</select>')[0]!;
    expect(retiree.match(/<option/g)).toHaveLength(2);
    expect(retiree).toContain('value="A"');
    const budgetRetiree = html.split('aria-label="Valider le budget fictif – Rôle retiré"')[1]!.split('</select>')[0]!;
    expect(budgetRetiree.match(/<option/g)).toHaveLength(1);
    expect(html).toContain('Conforme');
    expect(html).toContain('Aucun A');
  });
  it('lecture seule : lettres en texte, aucune liste ni aucun bouton', () => {
    const html = grille(contenu(), false);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
    expect(html).toContain('>Valider le budget fictif</th>');
    expect(html).toContain('>Rôle retiré</th>');
    expect(html).toContain('>R</td>');
    expect(html).toContain('>—</td>');
  });
  it('légende courte : R réalise · A approuve · C consulté · I informé', () => {
    const html = rendre(LegendeRaci, { libelles: RACI_DECISIONS_LETTRES_LIBELLES });
    for (const t of [
      '<strong>R</strong> réalise',
      '<strong>A</strong> approuve',
      '<strong>C</strong> consulté',
      '<strong>I</strong> informé',
    ])
      expect(html).toContain(t);
  });
  it('résume les décisions à revoir (role=status) et explique le rôle retiré', () => {
    const c = contenu();
    const html = rendre(ResumeControleRaci, {
      contenu: c,
      controles: controleSaisieDecisions(c),
      mots: MOTS_DECISIONS,
      children: createElement(NoteRolesRetires, { nombre: 1 }),
    });
    expect(html).toContain('role="status"');
    expect(html).toContain('1 décision à revoir');
    expect(html).toContain('« Accorder une dérogation fictive » (Aucun A)');
    expect(html).toContain('L’enregistrement reste possible.');
    expect(html).toContain('Un rôle a quitté le registre');
    expect(rendre(NoteRolesRetires, { nombre: 0 })).not.toContain('quitté le registre');
    const vide = contenuDecisions(null, ROLES);
    expect(rendre(ResumeControleRaci, { contenu: vide, controles: [], mots: MOTS_DECISIONS })).toContain(
      'Aucune décision : ajoutez-en une.',
    );
  });
  it('s’affiche sous la liste des fiches de « Rôles et responsabilités », titré « Qui décide quoi »', () => {
    const ici = path.dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(path.resolve(ici, '../src/pages/Pilotage.tsx'), 'utf8');
    expect(page).toMatch(
      /<BusinessRegistry[\s\S]*section === 'responsabilites' && <QuiDecideQuoi key=\{smsi\} smsi=\{smsi\} \/>/,
    );
    const section = readFileSync(path.resolve(ici, '../src/pilotage/QuiDecideQuoi.tsx'), 'utf8');
    expect(section).toContain('Qui décide quoi');
    expect(section).toContain("can('pilotage', 'modifier')");
    expect(section).toContain('/pilotage/responsabilites/raci');
  });
});
