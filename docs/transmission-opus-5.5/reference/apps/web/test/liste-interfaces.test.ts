import { describe, expect, it } from 'vitest';
import { lignesInterfaces } from '../src/pilotage/liste-interfaces';

describe('présentation des interfaces en puces', () => {
  it('sépare une énumération en conservant les noms et les précisions', () => {
    expect(lignesInterfaces('Hébergeur fictif, éditeur (dossiers, imagerie); partenaire fictif.')).toEqual([
      'Hébergeur fictif',
      'éditeur (dossiers, imagerie)',
      'partenaire fictif.',
    ]);
  });
  it('respecte les lignes déjà structurées, même si elles contiennent des virgules', () => {
    expect(lignesInterfaces('Éditeur, intégrateur\r\nHébergeur\r\n')).toEqual(['Éditeur, intégrateur', 'Hébergeur']);
  });
  it('conserve les virgules des dénominations entre guillemets', () => {
    expect(lignesInterfaces('«Partenaire, SAS», "Service, A", hébergeur')).toEqual([
      '«Partenaire, SAS»',
      '"Service, A"',
      'hébergeur',
    ]);
  });
  it('ne coupe ni une apostrophe française ni un nombre décimal', () => {
    expect(lignesInterfaces("Service d'accueil, réseau 1,5 Gbit/s, partenaire")).toEqual([
      "Service d'accueil",
      'réseau 1,5 Gbit/s',
      'partenaire',
    ]);
  });
  it('garde une entrée seule et ne crée pas de puces vides', () => {
    expect(lignesInterfaces('Hébergeur et partenaires')).toEqual(['Hébergeur et partenaires']);
    expect(lignesInterfaces('  \n  ')).toEqual([]);
    expect(lignesInterfaces('Hébergeur; ;')).toEqual(['Hébergeur']);
  });
});
