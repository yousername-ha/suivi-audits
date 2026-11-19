/* Ergonomie, lot 2 (décisions du RSSI du 18/11/2026) : une fenêtre de carte de Plateforme ou de Configuration système ne
   répète pas son titre dans le cadre qu'elle contient (la section garde son nom accessible, sa description et son bouton
   Enregistrer ; la page Paramètres garde le titre) ; les champs des tableaux de saisie reçoivent leur classe de largeur
   minimale, définie dans la charte. Données fictives. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MantineProvider } from '@mantine/core';
import { SETTINGS_LABELS, type SettingsSection } from '@suivi/shared';
import { FormSection } from '@suivi/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReglagesAssistantPanel } from '../src/assistant/ReglagesAssistant';
import { ChampChoix, ChampTexte } from '../src/historique/champs';
import { DetailsTechniques } from '../src/pages/Admin';
import { cartesDuCote } from '../src/pages/Administration';
import { SectionLoader } from '../src/pages/Settings';

const rendu = (element: ReactElement) =>
  renderToStaticMarkup(
    createElement(MantineProvider, null, createElement(QueryClientProvider, { client: new QueryClient() }, element)),
  );

/** Éléments React d'un détail de carte, sans les rendre : les panneaux restent des éléments avec leurs propriétés. */
function elements(n: ReactNode): ReactElement[] {
  if (Array.isArray(n)) return n.flatMap(elements);
  if (!isValidElement(n)) return [];
  const { children } = n.props as { children?: ReactNode };
  return [n, ...elements(children)];
}
const tout = () => true;
const fenetres = (['plateforme', 'systeme'] as const).flatMap((cote) =>
  cartesDuCote(tout, cote).flatMap((c) =>
    c.detail ? elements(c.detail(() => {}, tout)).map((e) => ({ carte: c, e })) : [],
  ),
);

describe('fenêtres des cartes : pas de titre en double', () => {
  it('une section des paramètres masque son titre exactement quand il répète celui de la fenêtre', () => {
    const sections = fenetres
      .filter(({ e }) => e.type === SectionLoader)
      .map(({ carte, e }) => {
        const p = e.props as { section: SettingsSection; titreVisible?: boolean };
        expect(p.titreVisible !== false, `${carte.titre} / ${p.section}`).toBe(
          SETTINGS_LABELS[p.section] !== carte.titre,
        );
        return `${p.section}:${p.titreVisible === false ? 'masqué' : 'affiché'}`;
      })
      .sort();
    expect(sections).toEqual([
      'apparence:masqué',
      'conservation:masqué',
      'courriel:masqué',
      'cycle:affiché',
      'etablissement:masqué',
      'general:masqué',
      'import_export:masqué',
      'notifications:masqué',
      'referentiels:masqué',
      'sauvegardes:affiché',
      'securite:masqué',
    ]);
  });

  it('Détails techniques et Assistant RSSI ne répètent pas non plus le titre de leur fenêtre', () => {
    const titre = (type: unknown) =>
      fenetres
        .filter(({ e }) => e.type === type)
        .map(({ carte, e }) => [carte.titre, (e.props as { titreVisible?: boolean }).titreVisible]);
    expect(titre(DetailsTechniques)).toEqual([['Détails techniques', false]]);
    expect(titre(ReglagesAssistantPanel)).toEqual([['Assistant RSSI', false]]);
  });

  it('FormSection sans titre visible garde son nom accessible, sa description et son bouton Enregistrer', () => {
    const section = (titreVisible?: boolean) =>
      rendu(
        createElement(FormSection, {
          title: 'Général',
          titreVisible,
          description: 'Description fictive.',
          dirty: false,
          onSave: () => {},
          children: createElement('p', null, 'Champs fictifs'),
        }),
      );
    const avecTitre = section();
    expect(avecTitre).toMatch(/<h2[^>]*>Général<\/h2>/);
    const sansTitre = section(false);
    expect(sansTitre).not.toMatch(/<h2/);
    expect(sansTitre).toContain('aria-label="Général"');
    expect(sansTitre).toContain('Description fictive.');
    expect(sansTitre).toContain('Champs fictifs');
    expect(sansTitre).toMatch(/<button[^>]*>.*Enregistrer/);
  });

  it('Détails techniques garde son titre hors fenêtre et sa région nommée dans la fenêtre', () => {
    expect(rendu(createElement(DetailsTechniques, {}))).toMatch(/<h2[^>]*>Détails techniques<\/h2>/);
    const fenetre = rendu(createElement(DetailsTechniques, { titreVisible: false }));
    expect(fenetre).not.toMatch(/<h2/);
    expect(fenetre).toContain('aria-label="Détails techniques"');
  });
});

describe('champs des tableaux de saisie : largeur minimale', () => {
  it('ChampTexte et ChampChoix portent la classe demandée, ChampChoix garde « champ-choix »', () => {
    const texte = rendu(
      createElement(ChampTexte, {
        ariaLabel: 'Nom du contact 1',
        className: 'champ-tableau-m',
        value: 'Contact fictif',
        onCommit: () => {},
      }),
    );
    expect(texte).toMatch(/class="[^"]*\bchamp-tableau-m\b/);
    expect(texte).toContain('aria-label="Nom du contact 1"');
    const choix = rendu(
      createElement(ChampChoix, {
        ariaLabel: 'Phase de l’action 1',
        className: 'champ-tableau-m',
        value: 'Alerte',
        options: ['Alerte', 'Gestion'],
        onCommit: () => {},
      }),
    );
    expect(choix).toMatch(/class="[^"]*\bchamp-choix champ-tableau-m\b/);
  });

  it('chaque classe de largeur utilisée par les écrans est définie dans la charte', () => {
    const ici = path.dirname(fileURLToPath(import.meta.url));
    const lire = (f: string) => readFileSync(path.resolve(ici, f), 'utf8');
    const charte = lire('../../../packages/ui/src/neon-ergonomie.css');
    const ecrans = ['../src/incidents/Crise.tsx', '../src/audit/Organisation.tsx'].map(lire).join('\n');
    const utilisees = new Set(
      ecrans.match(
        /\b(champ-tableau-[a-z]+|contact-champ-[a-z]+|colonne-extensible|crise-scenario-detail|audit-plan-note)\b/g,
      ) ?? [],
    );
    expect([...utilisees].sort()).toEqual([
      'audit-plan-note',
      'champ-tableau-l',
      'champ-tableau-m',
      'colonne-extensible',
      'contact-champ-courriel',
      'contact-champ-telephone',
      'contact-champ-zone',
      'crise-scenario-detail',
    ]);
    for (const classe of utilisees) expect(charte, classe).toMatch(new RegExp(`\\.${classe}\\s*\\{`));
  });
});
