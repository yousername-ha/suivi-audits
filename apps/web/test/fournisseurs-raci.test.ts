/* Matrice RACI d'un fournisseur (ADR 0113, maquette validée par le RSSI le 23/11/2026) : opérations de saisie (lignes,
   colonnes, ordre, une lettre par case), rendu accessible du tableau (en-têtes de lignes et de colonnes, liste nommée
   « <activité> – <acteur> » par case, colonne « Contrôle »), lecture seule, légende et résumé de la règle (role=status).
   Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { matriceRaciModele } from '@suivi/shared';
import { LegendeRaci, ResumeControleRaci, TableauRaci } from '../src/pilotage/MatriceRaci';
import {
  ajouterActeur,
  ajouterActivite,
  avecLettre,
  colonnesRaci,
  deplacerActivite,
  identifiantLibre,
  lettreRaci,
  libellesVides,
  nomCaseRaci,
  renommer,
  retirerActeur,
  retirerActivite,
  type ContenuRaci,
} from '../src/pilotage/raci';

const FOURNISSEUR = 'Hébergeur fictif';
const modele = (): ContenuRaci => matriceRaciModele();
/** Matrice fictive : « correctifs » conforme, « sauvegardes » avec deux A et sans R, le reste vide. */
const remplie = () => {
  let m = modele();
  m = avecLettre(m, 'correctifs', 'fournisseur', 'R');
  m = avecLettre(m, 'correctifs', 'rssi', 'A');
  m = avecLettre(m, 'sauvegardes', 'rssi', 'A');
  m = avecLettre(m, 'sauvegardes', 'dsi', 'A');
  return m;
};
const rendre = <P extends object>(el: (p: P) => ReactElement, props: P) =>
  renderToStaticMarkup(createElement(MantineProvider, null, createElement(el, props)));

describe('saisie de la matrice', () => {
  it('le fournisseur est la première colonne, libellée de son nom, puis RSSI, DSI et Référent métier', () => {
    expect(colonnesRaci(modele(), FOURNISSEUR).map((c) => [c.id, c.libelle, c.fournisseur])).toEqual([
      ['fournisseur', FOURNISSEUR, true],
      ['rssi', 'RSSI', false],
      ['dsi', 'DSI', false],
      ['referent-metier', 'Référent métier', false],
    ]);
  });
  it('une seule lettre par case ; « — » efface la case', () => {
    let m = avecLettre(modele(), 'acces', 'dsi', 'R');
    m = avecLettre(m, 'acces', 'dsi', 'C');
    expect(m.cases).toEqual([{ activite: 'acces', acteur: 'dsi', lettre: 'C' }]);
    expect(lettreRaci(m, 'acces', 'dsi')).toBe('C');
    expect(avecLettre(m, 'acces', 'dsi', null).cases).toEqual([]);
  });
  it('ajoute, renomme, réordonne et retire les activités (avec leurs cases)', () => {
    let m = ajouterActivite(remplie());
    expect(m.activites.at(-1)).toEqual({ id: 'activite-1', libelle: 'Nouvelle activité' });
    expect(identifiantLibre('activite', ['activite-1', 'activite-2'])).toBe('activite-3');
    m = renommer(m, 'activites', 'activite-1', 'Revue fictive');
    expect(m.activites.at(-1)!.libelle).toBe('Revue fictive');
    m = deplacerActivite(m, 'sauvegardes', -1);
    expect(m.activites.slice(0, 2).map((a) => a.id)).toEqual(['sauvegardes', 'correctifs']);
    expect(deplacerActivite(m, 'sauvegardes', -1)).toBe(m);
    m = retirerActivite(m, 'sauvegardes');
    expect(m.activites.some((a) => a.id === 'sauvegardes')).toBe(false);
    expect(m.cases.some((k) => k.activite === 'sauvegardes')).toBe(false);
  });
  it('ajoute et retire des acteurs, jamais la colonne du fournisseur', () => {
    let m = ajouterActeur(remplie());
    expect(m.acteurs.at(-1)).toEqual({ id: 'acteur-1', libelle: 'Nouvel acteur' });
    m = retirerActeur(m, 'rssi');
    expect(m.acteurs.map((a) => a.id)).toEqual(['dsi', 'referent-metier', 'acteur-1']);
    expect(m.cases.some((k) => k.acteur === 'rssi')).toBe(false);
    expect(retirerActeur(m, 'fournisseur')).toBe(m);
  });
  it('signale un nom vide avant l’enregistrement', () => {
    expect(libellesVides(modele())).toBe(false);
    expect(libellesVides(renommer(modele(), 'acteurs', 'dsi', '  '))).toBe(true);
  });
});

describe('rendu de la section', () => {
  it('tableau accessible : en-têtes de colonnes et de lignes, une liste nommée par case, colonne Contrôle', () => {
    const html = rendre(TableauRaci, {
      contenu: remplie(),
      nomFournisseur: FOURNISSEUR,
      modifiable: true,
      onChange: () => {},
    });
    // Activité, quatre acteurs et Contrôle en en-têtes de colonnes ; une activité par en-tête de ligne.
    expect(html.match(/<th [^>]*scope="col"/g)).toHaveLength(6);
    expect(html.match(/<th [^>]*scope="row"/g)).toHaveLength(7);
    expect(html).toContain('>Contrôle</th>');
    expect(html).toContain(`>${FOURNISSEUR}</th>`);
    // 7 activités × 4 colonnes : une liste R / A / C / I / — par case, nommée « activité – acteur ».
    expect(html.match(/<select/g)).toHaveLength(28);
    expect(html).toContain(`aria-label="${nomCaseRaci('Application des correctifs de sécurité', FOURNISSEUR)}"`);
    expect(html).toContain('aria-label="Sauvegardes et restauration – DSI"');
    for (const o of ['""', '"R"', '"A"', '"C"', '"I"']) expect(html).toContain(`<option value=${o}`);
    expect(html).toContain('<option value="">—</option>');
    expect(html).toContain('aria-label="Nom de l’acteur « RSSI »"');
    expect(html).toContain('aria-label="Retirer l’acteur « DSI »"');
    expect(html).not.toContain(`Retirer l’acteur « ${FOURNISSEUR} »`);
    expect(html).toContain('aria-label="Monter l’activité « Sauvegardes et restauration »"');
    // Contrôle en texte, pas seulement en couleur.
    expect(html).toContain('Conforme');
    expect(html).toContain('Plusieurs A, Aucun R');
    expect(html).toContain('Aucun A, Aucun R');
  });
  it('lecture seule sans le droit de modifier : lettres en texte, aucune liste ni aucun bouton', () => {
    const html = rendre(TableauRaci, {
      contenu: remplie(),
      nomFournisseur: FOURNISSEUR,
      modifiable: false,
      onChange: () => {},
    });
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
    expect(html).toContain('>Application des correctifs de sécurité</th>');
    expect(html).toContain('>R</td>');
    expect(html).toContain('>—</td>');
    expect(html).toContain('Plusieurs A, Aucun R');
  });
  it('résume les activités à revoir dans une zone role=status, sans bloquer', () => {
    const html = rendre(ResumeControleRaci, { contenu: remplie() });
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('6 activités à revoir');
    expect(html).toContain('« Sauvegardes et restauration » (Plusieurs A, Aucun R)');
    expect(html).toContain('L’enregistrement reste possible.');
    let conforme: ContenuRaci = { ...modele(), activites: modele().activites.slice(0, 1) };
    conforme = avecLettre(avecLettre(conforme, 'correctifs', 'fournisseur', 'R'), 'correctifs', 'rssi', 'A');
    expect(rendre(ResumeControleRaci, { contenu: conforme })).toContain(
      'Toutes les activités ont exactement un A et au moins un R.',
    );
  });
  it('donne la légende R, A, C, I et —', () => {
    const html = rendre(LegendeRaci, {});
    for (const t of [
      '<strong>R</strong> Réalise',
      '<strong>A</strong> Approuve, rend des comptes (un seul par activité)',
      '<strong>C</strong> Consulté avant',
      '<strong>I</strong> Informé après',
      '<strong>—</strong> non concerné',
    ])
      expect(html).toContain(t);
  });
  it('la fiche du fournisseur range la matrice dans l’onglet « Machines et responsabilités »', () => {
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/pilotage/Fournisseurs.tsx'),
      'utf8',
    );
    expect(src).toContain('<Tabs.Tab value="responsabilites">Machines et responsabilités</Tabs.Tab>');
    expect(src).toMatch(/<Tabs\.Panel value="responsabilites"[\s\S]*<MatriceRaciFournisseur/);
    const section = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/pilotage/MatriceRaci.tsx'),
      'utf8',
    );
    expect(section).toContain('data-fiche-section="Matrice RACI"');
    expect(section).toContain('Créer la matrice RACI');
  });
});
