/* Flux vers l'extérieur (ADR 0097) : règles d'affichage de la page d'administration (sens, état appliqué comparé au voulu,
   case de validation obligatoire pour ouvrir, pare-feu à faire autoriser), carte et article d'aide réservés à l'administration. */
import { FLUX_EXTERNES, FLUX_MODULES, fluxExterne } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { cartesVisibles } from '../src/administration-droits';
import { etatApplique, libelleSens, LIEN_FLUX_EXTERNES, pareFeuAOuvrir, peutConfirmer } from '../src/flux-externes';
import { HELP_ARTICLES } from '../src/help';

const avec = (droits: string[]) => (m: string, a: string) => droits.includes(`${m}:${a}`);

describe('flux vers l’extérieur : affichage', () => {
  it('nomme le sens de chaque module', () => {
    expect(libelleSens(fluxExterne('assistant'))).toBe('Sortant');
    expect(libelleSens(fluxExterne('acme'))).toBe('Sortant et entrant');
    expect(libelleSens({ destinations: [{ sens: 'entrant', hote: 'x', ports: 'TCP 80' }] })).toBe('Entrant');
  });
  it('compare l’état appliqué à l’état voulu', () => {
    expect(etatApplique({ ouvert: false, applique: null })).toEqual({ libelle: 'Non rapporté', ton: 'gris' });
    expect(etatApplique({ ouvert: true, applique: null })).toEqual({
      libelle: 'En attente de l’exécutant',
      ton: 'orange',
    });
    expect(etatApplique({ ouvert: true, applique: 'ferme' })).toEqual({
      libelle: 'Ouverture en attente',
      ton: 'orange',
    });
    expect(etatApplique({ ouvert: false, applique: 'ouvert' })).toEqual({
      libelle: 'Fermeture en attente',
      ton: 'orange',
    });
    expect(etatApplique({ ouvert: true, applique: 'ouvert' })).toEqual({ libelle: 'Ouvert', ton: 'vert' });
    expect(etatApplique({ ouvert: false, applique: 'ferme' })).toEqual({ libelle: 'Fermé', ton: 'gris' });
    expect(etatApplique({ ouvert: true, applique: 'erreur' })).toEqual({ libelle: 'Erreur', ton: 'rouge' });
  });
  it('ouvrir exige la case de validation ; fermer se confirme sans case ; rien pendant un envoi', () => {
    expect(peutConfirmer(true, false, false)).toBe(false);
    expect(peutConfirmer(true, true, false)).toBe(true);
    expect(peutConfirmer(true, true, true)).toBe(false);
    expect(peutConfirmer(false, false, false)).toBe(true);
    expect(peutConfirmer(false, false, true)).toBe(false);
  });
  it('indique le pare-feu à faire autoriser pour les seuls modules voulus ouverts', () => {
    const etats = FLUX_MODULES.map((module) => ({ module, ouvert: module === 'acme' }));
    const p = pareFeuAOuvrir(FLUX_EXTERNES, etats);
    expect(p.map((x) => x.libelle)).toEqual([fluxExterne('acme').libelle]);
    expect(p[0]!.regles.join(' ')).toMatch(/Entrée TCP 80 et 443/);
    expect(
      pareFeuAOuvrir(
        FLUX_EXTERNES,
        FLUX_MODULES.map((module) => ({ module, ouvert: false })),
      ),
    ).toEqual([]);
  });
});

describe('flux vers l’extérieur : carte et aide', () => {
  it('la carte est dans la Configuration système, visible avec la lecture de l’administration seulement', () => {
    expect(LIEN_FLUX_EXTERNES).toBe('/systeme/flux-externes');
    expect(cartesVisibles(avec(['administration:lire']), 'systeme')).toContain('flux-externes');
    for (const droits of [['parametres:lire'], ['assistant:administrer'], []])
      expect(cartesVisibles(avec(droits), 'systeme')).not.toContain('flux-externes');
  });
  it('l’article d’aide décrit la validation explicite et la limite du pare-feu', () => {
    const a = HELP_ARTICLES.find((x) => x.id === 'flux-externes');
    expect(a?.permission).toBe('administration:lire');
    expect(a?.link).toBe(LIEN_FLUX_EXTERNES);
    const texte = a!.steps.join(' ');
    expect(texte).toContain('case de validation');
    expect(texte).toContain('sans étape séparée');
    expect(texte).toContain('On y ferme un flux ; on ne l’y ouvre pas.');
    expect(texte).toContain('journal d’audit');
    expect(texte).toContain('pare-feu');
  });
});
