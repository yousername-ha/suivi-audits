import { fmtOctets } from './common';

/** Répartition de l'espace de la base : pièces, journaux, reste. « Non disponible » si le serveur ne la fournit pas. */
export function repartitionLignes(r: unknown): [string, unknown][] {
  const x = r as { totalOctets?: number; piecesOctets?: number; journauxOctets?: number; autresOctets?: number } | null;
  if (!x || typeof x.totalOctets !== 'number') return [['Répartition de la base', 'Non disponible']];
  const part = (o?: number) =>
    `${fmtOctets(o ?? 0)}${x.totalOctets ? ` (${Math.round(((o ?? 0) / x.totalOctets) * 100)} %)` : ''}`;
  return [
    ['Base : pièces (documents, versions)', part(x.piecesOctets)],
    ['Base : journaux (audit, historique)', part(x.journauxOctets)],
    ['Base : autres données', part(x.autresOctets)],
  ];
}
