/* Processus, objectifs et indicateurs du périmètre affiché : un seul modèle, une fiche par périmètre (BUG-055). Une fiche
   sans périmètre relève du périmètre commun. */
export const SOCLE = '00000000-0000-4000-8000-000000000001';

export function etatDePerimetre(etat: Record<string, unknown>, smsi: string): Record<string, unknown> {
  const sortie = { ...etat };
  for (const cle of ['processes', 'objectives', 'indicators'])
    if (Array.isArray(etat[cle]))
      sortie[cle] = (etat[cle] as unknown[]).filter((l) => {
        const p = (l as { smsi?: unknown } | null)?.smsi;
        return (typeof p === 'string' && p ? p : SOCLE) === smsi;
      });
  return sortie;
}
