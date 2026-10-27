import { describe, expect, it } from 'vitest';
import { repartitionLignes } from '../src/components/repartition';

describe('répartition de la base', () => {
  it('affiche les trois parts avec leur pourcentage', () => {
    const l = repartitionLignes({ totalOctets: 1000, piecesOctets: 500, journauxOctets: 250, autresOctets: 250 });
    expect(l.map(([k]) => k)).toEqual([
      'Base : pièces (documents, versions)',
      'Base : journaux (audit, historique)',
      'Base : autres données',
    ]);
    expect(String(l[0]![1])).toContain('50 %');
    expect(String(l[1]![1])).toContain('25 %');
  });
  it('dit « Non disponible » quand le serveur ne fournit pas la répartition, sans inventer de valeur', () => {
    expect(repartitionLignes(undefined)).toEqual([['Répartition de la base', 'Non disponible']]);
    expect(repartitionLignes({})).toEqual([['Répartition de la base', 'Non disponible']]);
  });
  it('ne divise pas par zéro quand la taille totale est nulle', () => {
    const l = repartitionLignes({ totalOctets: 0, piecesOctets: 0, journauxOctets: 0, autresOctets: 0 });
    expect(String(l[0]![1])).not.toContain('%');
  });
});
