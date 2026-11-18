/* Contacts de crise issus des comptes (ADR 0105), côté interface : bloc « Comptes de la plateforme » en lecture seule de la
   page des contacts de crise (liens tel: et mailto:, lien vers Plateforme > Utilisateurs seulement pour qui lit
   l'administration), section de la fiche d'un compte (administrateur) et carte de Mon compte (la personne ne saisit que ses
   téléphones et sa disponibilité). Rendu statique, données fictives. */
import { MantineProvider } from '@mantine/core';
import type { ContactCriseCompte, ContactCriseCompteAdminOut, ContactCriseCompteSoiOut } from '@suivi/shared';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FormulaireContactCriseAdmin, FormulaireContactCriseSoi } from '../src/components/ContactCriseCompte';
import { HELP_ARTICLES } from '../src/help';
import { ComptesPlateformeCrise } from '../src/incidents/Crise';

const rendre = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MantineProvider, null, n)));
const PERIMETRE = '11111111-1111-4111-8111-111111111111';
const CACHE = '22222222-2222-4222-8222-222222222222';
const compte: ContactCriseCompte = {
  userId: 'u-1',
  nom: 'Personne fictive',
  courriel: 'personne.fictive@exemple.invalid',
  role: 'Cellule de décision',
  phone: '01 99 00 00 01',
  phone2: '01 99 00 00 02',
  avail: 'Heures ouvrées',
  key: true,
};
const ficheAdmin = (f: Partial<ContactCriseCompteAdminOut> = {}): ContactCriseCompteAdminOut => ({
  actif: true,
  role: 'Cellule de décision',
  telephone: '01 99 00 00 01',
  telephone2: '',
  disponibilite: '',
  cle: false,
  tousPerimetres: true,
  perimetres: [],
  version: 1,
  ...f,
});
const rien = async () => {};

describe('page des contacts de crise : comptes de la plateforme', () => {
  it('liste les comptes en lecture seule, téléphones en tel: et courriel en mailto:', () => {
    const html = rendre(createElement(ComptesPlateformeCrise, { comptes: [compte], lienAdmin: true }));
    expect(html).toContain('Comptes de la plateforme');
    expect(html).toContain('href="tel:0199000001"');
    expect(html).toContain('href="tel:0199000002"');
    expect(html).toContain('href="mailto:personne.fictive@exemple.invalid"');
    expect(html).toContain('Personne fictive');
    expect(html).toContain('Heures ouvrées');
    expect(html).toContain('href="/plateforme/utilisateurs"');
    expect(html).toContain('Modifiable dans Plateforme &gt; Utilisateurs');
    expect(html).not.toMatch(/<input|<textarea/);
  });
  it('sans droit de lecture de l’administration : la mention reste, sans lien', () => {
    const html = rendre(createElement(ComptesPlateformeCrise, { comptes: [], lienAdmin: false }));
    expect(html).toContain('Modifiable dans Plateforme &gt; Utilisateurs');
    expect(html).not.toContain('/plateforme/utilisateurs');
    expect(html).toContain('Aucun compte de la plateforme n’est contact de crise pour ce périmètre.');
  });
});

describe('fiche d’un compte : section « Contact de crise »', () => {
  it('compte non marqué : la seule case « Contact de crise »', () => {
    const html = rendre(
      createElement(FormulaireContactCriseAdmin, {
        fiche: ficheAdmin({ actif: false, role: '', telephone: '', version: 0 }),
        perimetres: [],
        enregistrer: rien,
      }),
    );
    expect(html).toContain('Contact de crise');
    expect(html).not.toContain('Rôle de crise');
    expect(html).toContain('Enregistrer le contact de crise');
  });
  it('compte marqué : rôle, téléphones, disponibilité, contact clé, « Tous les périmètres » ou la liste choisie', () => {
    const tous = rendre(
      createElement(FormulaireContactCriseAdmin, { fiche: ficheAdmin(), perimetres: [], enregistrer: rien }),
    );
    for (const l of [
      'Rôle de crise',
      'Téléphone',
      'Téléphone 2',
      'Disponibilité',
      'Contact clé',
      'Tous les périmètres',
    ])
      expect(tous).toContain(l);
    expect(tous).not.toContain('>Périmètres<');
    const choisis = rendre(
      createElement(FormulaireContactCriseAdmin, {
        fiche: ficheAdmin({ tousPerimetres: false, perimetres: [PERIMETRE, CACHE] }),
        perimetres: [{ id: PERIMETRE, name: 'Périmètre fictif' }],
        enregistrer: rien,
      }),
    );
    expect(choisis).toContain('Périmètres');
    expect(choisis).toContain('Périmètre fictif');
    // Un périmètre que l'administrateur ne voit pas reste choisi, sans son nom.
    expect(choisis).toContain('Périmètre non visible');
  });
});

describe('Mon compte : carte « Contact de crise »', () => {
  const fiche: ContactCriseCompteSoiOut = {
    role: 'Cellule de décision',
    telephone: '01 99 00 00 01',
    telephone2: '',
    disponibilite: 'Heures ouvrées',
    cle: true,
    tousPerimetres: false,
    perimetres: [{ id: PERIMETRE, nom: 'Périmètre fictif' }],
    perimetresNonLisibles: 2,
    version: 3,
  };
  it('la personne voit son rôle et ses périmètres sans pouvoir les modifier ; seuls ses téléphones et sa disponibilité se saisissent', () => {
    const html = rendre(createElement(FormulaireContactCriseSoi, { fiche, enregistrer: rien }));
    expect(html).toContain('Rôle de crise : Cellule de décision');
    expect(html).toContain('Périmètres : Périmètre fictif, 2 périmètres que vous ne lisez pas');
    expect(html).toContain('Contact clé');
    expect((html.match(/<input/g) ?? []).length).toBe(3);
    for (const l of ['Téléphone', 'Téléphone 2', 'Disponibilité']) expect(html).toContain(`>${l}</label>`);
    expect(html).not.toMatch(/value="Cellule de décision"/);
  });
});

describe('aide embarquée', () => {
  it('décrit le contact de crise dans Mon compte et dans la fiche d’un compte', () => {
    const compteAide = HELP_ARTICLES.find((a) => a.id === 'compte')!;
    expect(compteAide.steps.join(' ')).toContain('contact de crise');
    const droits = HELP_ARTICLES.find((a) => a.id === 'droits')!;
    expect(droits.steps.join(' ')).toContain('Contact de crise');
  });
});
