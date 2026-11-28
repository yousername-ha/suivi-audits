/* Import et rapports en style « Verre » (dessin DocImports validé par le RSSI le 28/11/2026) : trois étapes visibles,
   résultat de la simulation limité à ce que rend l'API (domaines, exigences, doublon, avertissement), motifs d'un refus,
   « Appliquer » actif seulement après une simulation sans erreur bloquante, cartes d'export, de rapport et de modèles.
   Les chiffres du dessin que l'API ne fournit pas (fiches lues, créées, mises à jour, rejetées, détail par feuille) ne
   sont jamais affichés. Données fictives, rendu statique sans réseau. */
import { MantineProvider } from '@mantine/core';
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api';
import { etapesImport, heureSimulation, motifsRefus, type SimulationImport } from '../src/grc/imports-verre';
import { ImportsVerre, type ImportsVerreProps } from '../src/grc/ImportsVerre';

const html = (n: ReactNode) =>
  renderToStaticMarkup(createElement(MantineProvider, null, n))
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
const texte = (h: string) =>
  h
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const rien = () => undefined;

const simulation = (p: Partial<SimulationImport> = {}): SimulationImport => ({
  previewId: 'f'.repeat(64),
  canImport: true,
  duplicate: false,
  requirements: 42,
  domains: 4,
  warning: null,
  definition: { name: 'Référentiel fictif', identifier: 'fictif-2026' },
  ...p,
});
const props = (p: Partial<ImportsVerreProps> = {}): ImportsVerreProps => ({
  peutImporter: true,
  peutExporter: true,
  peutExporterReferentiel: true,
  erreur: null,
  fichier: null,
  texte: '',
  onTexte: rien,
  onFichier: rien,
  simulation: null,
  simuleA: null,
  erreurSimulation: null,
  onSimuler: rien,
  onAppliquer: rien,
  confirmation: false,
  onConfirmer: rien,
  referentiels: [{ value: 'r1', label: 'Référentiel fictif' }],
  referentiel: null,
  onReferentiel: rien,
  onExporter: rien,
  onRapport: rien,
  onRapportJson: rien,
  onExempleJson: rien,
  onGabarit: rien,
  onGuide: rien,
  ...p,
});
/** Bouton « Appliquer l'importation » : true s'il est désactivé, false s'il est actif, null s'il est absent. */
const appliquerDesactive = (h: string) => {
  const balise = /<button([^>]*)>Appliquer l’importation<\/button>/.exec(h)?.[1];
  return balise === undefined ? null : balise.includes('disabled=""');
};

describe('étapes, motifs et heure', () => {
  it('étapes : choisir, simuler, appliquer, selon le contenu et la simulation', () => {
    const etats = (contenu: boolean, s: Pick<SimulationImport, 'canImport'> | null) =>
      etapesImport(contenu, s).map((e) => e.etat);
    expect(etapesImport(false, null).map((e) => e.libelle)).toEqual(['Choisir le fichier', 'Simuler', 'Appliquer']);
    expect(etats(false, null)).toEqual(['en-cours', 'a-venir', 'a-venir']);
    expect(etats(true, null)).toEqual(['fait', 'en-cours', 'a-venir']);
    expect(etats(true, { canImport: true })).toEqual(['fait', 'fait', 'en-cours']);
    expect(etats(true, { canImport: false })).toEqual(['fait', 'fait', 'bloque']);
  });

  it('motifs : message de validation du serveur découpé par anomalie, autre message tel quel', () => {
    expect(
      motifsRefus('Données invalides — identifier : champ obligatoire ; domains : type de valeur incorrect'),
    ).toEqual(['identifier : champ obligatoire', 'domains : type de valeur incorrect']);
    expect(motifsRefus('Référentiel déjà importé.')).toEqual(['Référentiel déjà importé.']);
    expect(motifsRefus('  ')).toEqual([]);
  });

  it('heure de la simulation : « 10 h 42 », minutes sur deux chiffres', () => {
    expect(heureSimulation(new Date(2026, 10, 28, 10, 42))).toBe('10 h 42');
    expect(heureSimulation(new Date(2026, 10, 28, 9, 5))).toBe('9 h 05');
  });
});

describe('rendu « Verre »', () => {
  it('avant toute simulation : trois étapes, invitation à choisir un fichier, « Appliquer » désactivé', () => {
    const h = html(<ImportsVerre {...props()} />);
    expect(h).toContain('aria-label="Étapes de l’importation"');
    expect([...h.matchAll(/data-etat="([^"]+)"/g)].map((m) => m[1])).toEqual(['en-cours', 'a-venir', 'a-venir']);
    expect(h).toMatch(/aria-current="step"/);
    expect(texte(h)).toContain('Choisissez un fichier JSON ou Excel (8 Mo au plus), ou collez son contenu.');
    expect(appliquerDesactive(h)).toBe(true);
    expect(texte(h)).not.toContain('Résultat de la simulation');
  });

  it('simulation acceptée : fichier, heure, domaines et exigences, « Appliquer » actif ; aucun chiffre que l’API ne rend pas', () => {
    const h = html(
      <ImportsVerre
        {...props({
          fichier: { nom: 'referentiel-fictif.xlsx', taille: 188416 },
          texte: '{}',
          simulation: simulation({ warning: 'Source non vérifiée : avertissement fictif.' }),
          simuleA: new Date(2026, 10, 28, 10, 42),
        })}
      />,
    );
    const t = texte(h);
    expect(t).toContain('referentiel-fictif.xlsx 184 Ko · simulé à 10 h 42');
    expect(t).toContain('Changer de fichier');
    expect(t).toContain('Résultat de la simulation · rien n’est encore enregistré');
    expect(t).toContain('Référentiel fictif · fictif-2026');
    expect(t).toContain('Domaines 4');
    expect(t).toContain('Exigences 42');
    expect(t).toContain('Source non vérifiée : avertissement fictif.');
    expect(appliquerDesactive(h)).toBe(false);
    for (const absent of ['Fiches lues', 'Créées', 'Mises à jour', 'Rejetées', 'Détail par feuille', 'Lignes rejetées'])
      expect(t).not.toContain(absent);
  });

  it('doublon : motif affiché, étape « Appliquer » bloquée, bouton désactivé', () => {
    const h = html(
      <ImportsVerre {...props({ texte: '{}', simulation: simulation({ duplicate: true, canImport: false }) })} />,
    );
    expect(texte(h)).toContain('Motifs du refus Identifiant de référentiel déjà présent : importation refusée.');
    expect([...h.matchAll(/data-etat="([^"]+)"/g)].map((m) => m[1])).toEqual(['fait', 'fait', 'bloque']);
    expect(appliquerDesactive(h)).toBe(true);
  });

  it('simulation refusée par le serveur : un motif par anomalie, « Appliquer » désactivé', () => {
    const e = new ApiError(
      422,
      'Données invalides — identifier : champ obligatoire ; source : champ obligatoire',
      null,
    );
    const h = html(<ImportsVerre {...props({ texte: '{}', erreurSimulation: e })} />);
    expect([...h.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1])).toEqual([
      'identifier : champ obligatoire',
      'source : champ obligatoire',
    ]);
    expect(appliquerDesactive(h)).toBe(true);
  });

  it('confirmation humaine après « Appliquer », comme le rendu classique', () => {
    const t = texte(html(<ImportsVerre {...props({ texte: '{}', simulation: simulation(), confirmation: true })} />));
    expect(t).toContain('Confirmez l’importation atomique dans le périmètre sélectionné. Confirmer l’importation');
  });

  it('cartes : export du référentiel, rapport, modèles fictifs (guide en texte)', () => {
    const t = texte(html(<ImportsVerre {...props()} />));
    expect(t).toContain('Exporter un référentiel');
    expect(t).toContain('Exporter en JSON Exporter en Excel');
    expect(t).toContain('Rapport de pilotage et d’audit');
    expect(t).toContain('Produire le rapport Données en JSON');
    expect(t).toContain('Gabarit et exemple Excel XLSX');
    expect(t).toContain('Exemple fictif JSON');
    expect(t).toContain('Guide d’importation TXT');
  });

  it('droits : sans droit de modifier, pas d’import ; sans droit d’exporter, ni boutons d’export ni rapport', () => {
    const h = html(<ImportsVerre {...props({ peutImporter: false, peutExporter: false })} />);
    const t = texte(h);
    expect(h).not.toContain('data-import');
    expect(t).not.toContain('Importer un fichier');
    expect(t).not.toContain('Exporter en JSON');
    expect(t).not.toContain('Produire le rapport');
    expect(t).toContain('Pour bien préparer un fichier');
    // Export de la conformité refusé : boutons visibles mais désactivés, comme le rendu classique.
    const sansConformite = html(<ImportsVerre {...props({ peutExporterReferentiel: false })} />);
    expect(sansConformite).toMatch(/disabled=""[^>]*>Exporter en JSON/);
  });
});

describe('branchement sur le style d’instance', () => {
  const source = readFileSync(new URL('../src/grc/Imports.tsx', import.meta.url), 'utf8');
  it('rendu Verre seulement pour le style « Verre », mêmes appels à l’API', () => {
    expect(source).toContain("verre = useMe().appearance.style === 'verre',");
    expect(source).toContain('if (verre)');
    expect(source).toContain("await api('POST', `/api/grc/${smsi}/import/preview`");
    expect(source).toContain("await api('POST', `/api/grc/${smsi}/import/commit`, {");
    expect(source).toContain("confirm: 'IMPORTER'");
  });
});
