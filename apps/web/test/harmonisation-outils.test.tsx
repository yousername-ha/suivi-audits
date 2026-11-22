/* Contrats des barres harmonisées : les filtres restent contrôlés par leur page, le bouton garde la soumission et
   une commande métier ne devient pas un filtre. Données fictives ; aucun appel réseau. */
import { Button, Checkbox, SegmentedControl, Select, Text, TextInput } from '@mantine/core';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BarreFiltres, compterFiltres, NOM_BARRE_NEUTRE } from '../src/components/BarreFiltres';
import type { VueBoite } from '../src/components/BarreOutils';

type Element = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
const enfants = (n: ReactNode): Element[] => Children.toArray(n).filter(isValidElement) as Element[];

describe('contrats des outils de registre', () => {
  it('garde les dates comme critères et ne les transforme pas en recherche', () => {
    const boite = BarreFiltres({
      label: 'Rapport',
      children: (
        <>
          <TextInput label="Du" type="date" value="2026-11-01" />
          <TextInput label="Au" type="date" value="2026-11-21" />
        </>
      ),
    });
    expect(boite.props.champRecherche).toBeUndefined();
    expect(boite.props.filtres?.actifs).toBe(2);
  });
  it('ne donne jamais à la barre le nom de son champ de recherche (un seul élément par nom accessible)', () => {
    const memeNom = BarreFiltres({
      label: 'Rechercher dans le guide',
      children: <TextInput label="Rechercher dans le guide" value="" onChange={() => {}} />,
    });
    expect(memeNom.props.label).toBe(NOM_BARRE_NEUTRE);
    expect(NOM_BARRE_NEUTRE.toLowerCase()).not.toContain('recherch');
    const nomAria = BarreFiltres({
      label: 'Rechercher une dalle',
      children: <TextInput aria-label="rechercher une dalle" value="" onChange={() => {}} />,
    });
    expect(nomAria.props.label).toBe(NOM_BARRE_NEUTRE);
    const nomsDistincts = BarreFiltres({
      label: 'Journal d’audit',
      children: <TextInput label="Rechercher" value="" onChange={() => {}} />,
    });
    expect(nomsDistincts.props.label).toBe('Journal d’audit');
  });
  it('garde les contraintes et le callback du champ existant, sans soumettre au rendu', () => {
    const modifier = vi.fn();
    const champ = (
      <TextInput
        label="Rechercher"
        name="terme"
        form="recherche-archive"
        value="recette"
        required
        maxLength={40}
        onChange={modifier}
      />
    );
    const boite = BarreFiltres({ label: 'Archives', children: champ });
    expect(boite.props.champRecherche?.type).toBe(TextInput);
    expect(boite.props.champRecherche?.props).toMatchObject({
      name: 'terme',
      form: 'recherche-archive',
      value: 'recette',
      required: true,
      maxLength: 40,
      onChange: modifier,
    });
    expect(modifier).not.toHaveBeenCalled();
  });

  it('préserve type, rattachement de formulaire, état et action du bouton devenu pictogramme', () => {
    const action = vi.fn();
    const boite = BarreFiltres({
      label: 'Journal',
      children: (
        <Button type="submit" form="journal" disabled onClick={action}>
          Filtrer
        </Button>
      ),
    });
    const commande = enfants(boite.props.children)[0]!;
    expect(commande.props).toMatchObject({
      type: 'submit',
      form: 'journal',
      disabled: true,
      'aria-label': 'Filtrer',
      onClick: action,
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('laisse les filtres contrôlés et les commandes de réinitialisation dans le panneau', () => {
    const changer = vi.fn(),
      effacer = vi.fn();
    const filtre = (
      <Select
        label="Périmètre"
        value="recette"
        data={[{ value: 'recette', label: 'Périmètre fictif' }]}
        onChange={changer}
      />
    );
    const reset = <Button onClick={effacer}>Réinitialiser</Button>;
    const boite = BarreFiltres({
      label: 'Machines',
      children: (
        <>
          {filtre}
          {reset}
        </>
      ),
    });
    expect(boite.props.filtres?.actifs).toBe(1);
    const controles = enfants(boite.props.filtres?.contenu.props.children);
    expect(controles[0]?.props.onChange).toBe(changer);
    expect(controles[1]?.props.onClick).toBe(effacer);
    expect(changer).not.toHaveBeenCalled();
    expect(effacer).not.toHaveBeenCalled();
  });

  it('ne range pas une action métier ou un nombre de résultats parmi les filtres', () => {
    const agir = vi.fn();
    const boite = BarreFiltres({
      label: 'Registre',
      children: (
        <>
          <TextInput label="Recherche" />
          <Text role="status">6 résultats fictifs</Text>
          <Button onClick={agir}>Exporter</Button>
        </>
      ),
    });
    expect(boite.props.filtres).toBeUndefined();
    const annexes = enfants(boite.props.ajout.props.children);
    expect(annexes.map((e) => e.props.children)).toEqual(['6 résultats fictifs', 'Exporter']);
    expect(annexes[1]?.props.onClick).toBe(agir);
  });

  it('ne remplace par des icônes que les présentations, avec noms et état désactivé', () => {
    const changer = vi.fn();
    const boite = BarreFiltres({
      label: 'Machines',
      children: (
        <SegmentedControl
          aria-label="Présentation des machines"
          value="liste"
          onChange={changer}
          data={[
            { value: 'liste', label: 'Liste' },
            { value: 'parc', label: 'Parc', disabled: true },
          ]}
        />
      ),
    });
    expect(boite.props.vues?.map((v: VueBoite) => [v.value, v.label, v.disabled])).toEqual([
      ['liste', 'Liste', undefined],
      ['parc', 'Parc', true],
    ]);
    expect(boite.props.vue).toBe('liste');
    boite.props.onVue?.('parc');
    expect(changer).toHaveBeenCalledExactlyOnceWith('parc');
    const filtre = BarreFiltres({
      label: 'Incidents',
      children: <SegmentedControl aria-label="Filtre du registre" value="open" data={['open', 'all']} />,
    });
    expect(filtre.props.vues).toBeUndefined();
    expect(filtre.props.filtres).toBeDefined();
  });

  it('compte les critères renseignés, y compris dans un groupe, sans compter Tous ni les cases décochées', () => {
    const controles = [
      createElement(Select, { value: null }),
      createElement(Select, { value: 'all' }),
      createElement(Checkbox, { checked: false }),
      <div key="g">
        <Select value="recette" />
        <Checkbox checked />
      </div>,
    ];
    expect(compterFiltres(controles)).toBe(2);
  });
});
