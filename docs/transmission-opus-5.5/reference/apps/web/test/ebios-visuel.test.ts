/* Couche visuelle EBIOS RM : calculs purs (chemins, pictogrammes, synthèse) et rendu serveur des vues. Données fictives. */
import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Chemins } from '../src/grc/ebios-visuel/Chemins';
import { Synthese } from '../src/grc/ebios-visuel/Synthese';
import {
  alternatives,
  construireChemins,
  disposer,
  familleSource,
  filtrer,
  lignes,
  nonPlaces,
  pointsCercle,
  trace,
  type ObjetVisuel,
} from '../src/grc/ebios-visuel/modele';

const o = (id: string, kind: string, name: string, data: Record<string, unknown> = {}, calcul = {}): ObjetVisuel => ({
  id,
  kind,
  name,
  data,
  calcul,
});
const jeu: ObjetVisuel[] = [
  o('s1', 'risk_source', 'Groupe criminel', { category: 'Criminel organisé' }),
  o('s2', 'risk_source', 'Incendie du local', { category: 'Incendie / accident' }),
  o('c1', 'sr_ov', 'Couple A', { sourceRef: 'object:s1' }),
  o('c2', 'sr_ov', 'Couple B', { sourceRef: 'object:s2' }),
  o('p1', 'ecosystem_party', 'Prestataire infogérance'),
  o('e1', 'feared_event', 'Indisponibilité du dossier patient'),
  o('e2', 'feared_event', 'Fuite de données'),
  o('st1', 'strategic_scenario', 'Rançongiciel via prestataire', {
    srOvRef: 'object:c1',
    partyRefs: ['object:p1'],
    fearedEventRefs: ['object:e1', 'object:e2'],
    gravity: 4,
  }),
  o('st2', 'strategic_scenario', 'Intrusion directe', {
    srOvRef: 'object:c1',
    fearedEventRefs: ['object:e2'],
    gravity: 3,
  }),
  o('st3', 'strategic_scenario', 'Sans événement', { srOvRef: 'object:c2', gravity: 2 }),
  o('op1', 'operational_scenario', 'Chiffrement des serveurs', { strategicScenarioRef: 'object:st1', likelihood: 3 }),
  o('op2', 'operational_scenario', 'Exfiltration', { strategicScenarioRef: 'object:st2', likelihood: 2 }),
  o('op3', 'operational_scenario', 'Sans rang', { strategicScenarioRef: 'object:st1', likelihood: null }),
];

describe('pictogrammes (003-09)', () => {
  it('propose une famille indicative sans transformer un accident en attaquant', () => {
    expect(familleSource('Criminel organisé')).toBe('criminel');
    expect(familleSource('Incendie / accident')).toBe('accident');
    expect(familleSource('Inondation')).toBe('naturel');
    expect(familleSource('Acteur étatique')).toBe('etatique');
    expect(familleSource('Salarié négligent')).toBe('interne');
    expect(familleSource('Pirate informatique')).toBe('malveillant');
    expect(familleSource('Accident causé par un pirate')).toBe('accident');
    expect(familleSource('')).toBe('autre');
    expect(familleSource(42)).toBe('autre');
    expect(familleSource('Catégorie inconnue')).toBe('autre');
  });
});

describe('chemins (003-08)', () => {
  const m = construireChemins(jeu);
  it('relie source, parties prenantes dans l’ordre saisi, puis événements redoutés', () => {
    const c = m.chemins.find((x) => x.ref === 'object:st1')!;
    expect(c.source).toBe('object:s1');
    expect(c.parties).toEqual(['object:p1']);
    expect(c.evenements).toEqual(['object:e1', 'object:e2']);
    expect(c.manques).toEqual([]);
    const liens = m.aretes.map((a) => `${a.de}>${a.vers}`);
    expect(liens).toContain('object:s1>object:p1');
    expect(liens).toContain('object:p1>object:e1');
    expect(liens).toContain('object:s1>object:e2');
  });
  it('dit ce qui manque et ne dessine pas un chemin incomplet', () => {
    const c = m.chemins.find((x) => x.ref === 'object:st3')!;
    expect(c.manques).toEqual(['événement redouté absent']);
    expect(m.aretes.some((a) => a.chemins.includes('object:st3'))).toBe(false);
  });
  it('liste les alternatives vers le même événement ou depuis la même source', () => {
    const a = alternatives(
      m.chemins,
      m.chemins.find((x) => x.ref === 'object:st1')!,
    );
    expect(a.memeEvenement.map((c) => c.ref)).toEqual(['object:st2']);
    expect(a.memeSource.map((c) => c.ref)).toEqual(['object:st2']);
  });
  it('dispose les trois colonnes et trace des courbes de gauche à droite', () => {
    const { positions, largeur } = disposer(m.etapes);
    const s = positions.get('object:s1')!;
    const e = positions.get('object:e1')!;
    expect(e.x).toBeGreaterThan(s.x);
    expect(largeur).toBeGreaterThan(e.x);
    expect(trace(s, e)).toMatch(/^M\d+ \d+ C\d+ \d+ \d+ \d+ \d+ \d+$/);
  });
  it('un scénario sans couple est incomplet, sans planter', () => {
    const r = construireChemins([o('x', 'strategic_scenario', 'Orphelin', { fearedEventRefs: ['object:zz'] })]);
    expect(r.chemins[0]!.manques).toEqual(['couple source / objectif visé absent', 'événement redouté absent']);
  });
});

describe('synthèse (003-07)', () => {
  const l = lignes(jeu);
  it('rattache chaque scénario opérationnel à la gravité de son scénario stratégique', () => {
    const op1 = l.find((x) => x.id === 'op1')!;
    expect([op1.gravite, op1.vraisemblance, op1.strategique]).toEqual([4, 3, 'Rançongiciel via prestataire']);
    expect(op1.graviteTexte).toBe('G4 — Critique');
  });
  it('liste à part les scénarios sans rang et filtre sans rien déduire', () => {
    expect(nonPlaces(l).map((x) => x.id)).toEqual(['op3']);
    expect(
      filtrer(l, { gravite: 4, vraisemblance: null })
        .map((x) => x.id)
        .sort(),
    ).toEqual(['op1', 'op3']);
    expect(filtrer(l, { gravite: 4, vraisemblance: 3 }).map((x) => x.id)).toEqual(['op1']);
    expect(filtrer(l, { gravite: null, vraisemblance: null })).toHaveLength(3);
  });
  it('répartit les points régulièrement sur le cercle, en commençant en haut', () => {
    const p = pointsCercle(4, 100, 150, 150);
    expect(p[0]).toEqual({ x: 150, y: 50 });
    expect(p[1]).toEqual({ x: 250, y: 150 });
    expect(pointsCercle(0, 100, 0, 0)).toEqual([]);
  });
});

const rendu = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MantineProvider, null, el));
/** Nos graphiques n'écrivent aucun style en ligne (CSP) ; seuls les composants Mantine posent leurs variables. */
const svgs = (html: string) => (html.match(/<svg viewBox[\s\S]*?<\/svg>/g) ?? []).join('');
describe('rendu', () => {
  it('le chemin choisi a son flux, les autres restent tracés', () => {
    const html = rendu(
      createElement(Chemins, { objets: jeu, choisi: 'object:st1', onChoisir() {}, onOuvrir() {}, onVoirSynthese() {} }),
    );
    expect(html).toContain('ebios-lien--choisi');
    expect(html).toContain('ebios-flux');
    expect(html).toContain('Chemins incomplets');
    expect(html).toContain('Comparer avec Intrusion directe');
    expect(svgs(html)).not.toBe('');
    expect(svgs(html)).not.toContain('style=');
  });
  it('sans sélection : aucun flux ni contour épais', () => {
    const html = rendu(
      createElement(Chemins, { objets: jeu, choisi: null, onChoisir() {}, onOuvrir() {}, onVoirSynthese() {} }),
    );
    expect(html).not.toContain('ebios-flux');
    expect(html).not.toContain('ebios-lien--choisi');
    expect(html).toContain('data-anime="non"');
  });
  it('la synthèse écrit les valeurs, signale les non placés et marque la sélection partout', () => {
    const html = rendu(
      createElement(Synthese, { objets: jeu, choisi: 'object:op1', onChoisir() {}, onOuvrir() {}, onVoirChemin() {} }),
    );
    expect(html).toContain('G4 — Critique');
    expect(html).toContain('Non placés dans la matrice');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('ebios-ligne--choisie');
    expect(html).toContain('Voir son chemin');
    expect(svgs(html)).not.toBe('');
    expect(svgs(html)).not.toContain('style=');
  });
  it('données absentes dites explicitement', () => {
    expect(
      rendu(createElement(Synthese, { objets: [], choisi: null, onChoisir() {}, onOuvrir() {}, onVoirChemin() {} })),
    ).toContain('La synthèse apparaît');
    expect(
      rendu(createElement(Chemins, { objets: [], choisi: null, onChoisir() {}, onOuvrir() {}, onVoirSynthese() {} })),
    ).toContain('Aucun scénario stratégique');
  });
});
