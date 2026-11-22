/* Contrats de rendu du thème : les nouvelles proportions ne doivent masquer ni aide, ni erreur, ni valeur transmise. */
import { Button, MantineProvider, NativeSelect, NumberInput, Select, TextInput } from '@mantine/core';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@suivi/ui';

const rendu = (champ: ReactElement) =>
  renderToStaticMarkup(createElement(MantineProvider, { theme, withCssVariables: false }, champ));

describe('proportions des champs et ordre de lecture', () => {
  it('garde les commandes de formulaire en contour, sans changer leur soumission', () => {
    const html = rendu(createElement(Button<'button'>, { type: 'submit', form: 'fiche-recette' }, 'Enregistrer'));
    expect(html).toContain('commande-neon');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('form="fiche-recette"');
  });
  it('conserve la couleur explicite et la désactivation d’une commande sensible', () => {
    const html = rendu(createElement(Button<'button'>, { color: 'red', disabled: true }, 'Fermer l’écart'));
    expect(html).toContain('commande-metier');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('disabled=""');
  });
  it('place l’aide après la saisie sans perdre association accessible, erreur, nom ou contrainte', () => {
    const html = rendu(
      createElement(TextInput, {
        id: 'version-recette',
        label: 'Version',
        name: 'versionProduit',
        value: '10.1.2',
        required: true,
        description: 'Exemple de version fictive',
        error: 'Erreur fictive de validation',
      }),
    );
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('Exemple de version fictive'));
    expect(html.indexOf('Exemple de version fictive')).toBeLessThan(html.indexOf('Erreur fictive de validation'));
    const descriptions = html.match(/aria-describedby="([^"]+)"/)?.[1]?.split(/\s+/);
    expect(descriptions).toEqual(['version-recette-error', 'version-recette-description']);
    expect(html).toContain('name="versionProduit"');
    expect(html).toContain('value="10.1.2"');
    expect(html).toContain('required=""');
  });

  it('associe l’aide au champ sans supprimer le texte ni créer une soumission supplémentaire', () => {
    const html = rendu(
      createElement(TextInput, {
        id: 'aide-recette',
        label: 'Code',
        name: 'code',
        value: 'R01',
        description: 'Précision de recette conservée',
      }),
    );
    expect(html).toContain('class="champ-aide-bouton"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-controls="aide-recette-description"');
    expect(html).toContain('aria-describedby="aide-recette-label"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="aide-recette-description"');
    expect(html).toContain('Précision de recette conservée');
    expect(html).toContain('value="R01"');
    expect(html).not.toContain('hidden=""');
  });

  it('garde affichée une information indispensable : pas de bouton d’aide, même association accessible', () => {
    const html = rendu(
      createElement(TextInput, {
        id: 'motif-recette',
        label: 'Motif',
        description: '5 caractères au moins.',
        descriptionProps: { 'data-aide-permanente': true },
      }),
    );
    expect(html).not.toContain('champ-aide-bouton');
    expect(html).toMatch(/data-aide-permanente="(true)?"/);
    expect(html).toContain('id="motif-recette-description"');
    expect(html).toContain('aria-describedby="motif-recette-description"');
    expect(html).toContain('5 caractères au moins.');
  });

  it('respecte un ordre explicite quand un écran place une précision avant son champ', () => {
    const html = rendu(
      createElement(TextInput, {
        label: 'Champ spécifique',
        description: 'Précaution avant saisie',
        inputWrapperOrder: ['label', 'description', 'input', 'error'],
      }),
    );
    expect(html.indexOf('Précaution avant saisie')).toBeLessThan(html.indexOf('<input'));
  });

  it('garde les identifiants techniques longs et les noms dans la catégorie large', () => {
    for (const label of ['Identifiant CPE 2.3', 'Adresse du service', 'Nom du produit']) {
      const html = rendu(createElement(TextInput, { label, value: 'valeur technique fictive' }));
      expect(html).toMatch(/class="[^"]*champ-format-large/);
      expect(html).not.toContain('champ-format-code');
    }
  });

  it('préserve la sélection, la soumission et le callback des responsables avec des groupes et des noms longs', () => {
    const changement = vi.fn();
    const html = rendu(
      createElement(Select, {
        label: 'Responsable',
        name: 'ownerId',
        value: 'personne-recette',
        data: [{ group: 'Personnes', items: [{ value: 'personne-recette', label: 'Camille Exemple fictif' }] }],
        searchable: true,
        clearable: true,
        onChange: changement,
      }),
    );
    expect(html).toMatch(/class="[^"]*champ-format-personne/);
    expect(html).toContain('value="Camille Exemple fictif"');
    expect(html).toContain('name="ownerId"');
    expect(html).toContain('value="personne-recette"');
    expect(changement).not.toHaveBeenCalled();
  });

  it('garde les options natives et la valeur zéro des champs numériques', () => {
    const natif = rendu(
      createElement(NativeSelect, { label: 'État', data: ['À faire', 'Terminé'], value: 'Terminé', disabled: true }),
    );
    expect(natif).toContain('value="Terminé" selected=""');
    expect(natif).toContain('disabled=""');
    const nombre = rendu(createElement(NumberInput, { label: 'Valeur mesurée', value: 0, name: 'mesure' }));
    expect(nombre).toContain('champ-format-nombre');
    expect(nombre).toContain('value="0"');
  });
});
