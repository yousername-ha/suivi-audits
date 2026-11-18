/* Module Vulnérabilités (ADR 0100, lot V6) : mise à l'écart « pour cette session » de la fenêtre d'alerte critique, en
   mémoire de l'onglet (sessionStorage), effacée à la fermeture de la session (logout.ts). Sans dépendance : logout.ts
   l'importe sans cycle. */
/* ---------------------------------------------------------------- Mise à l'écart pour la session */
/** Préfixe des clés de l'onglet : une par compte ; effacées à la fermeture de la session (logout.ts). */
export const PREFIXE_ECARTEES = 'suivi-alertes-critiques-ecartees:';
/** Une alerte est écartée pour un passage au niveau critique donné : une montée ultérieure la remontre. */
export const marqueAlerte = (a: { id: string; critiqueLe: string | null }) => `${a.id}@${a.critiqueLe ?? ''}`;

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;
const stockage = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};
export function ecartees(utilisateur: string, s: Stockage | null = stockage()): Set<string> {
  try {
    const v = JSON.parse(s?.getItem(PREFIXE_ECARTEES + utilisateur) ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
export function ecarter(utilisateur: string, marques: readonly string[], s: Stockage | null = stockage()): void {
  const tout = [...new Set([...ecartees(utilisateur, s), ...marques])].slice(-200);
  try {
    s?.setItem(PREFIXE_ECARTEES + utilisateur, JSON.stringify(tout));
  } catch {
    // Stockage plein ou refusé : la fenêtre reste simplement affichée.
  }
}
/** Efface toutes les mises à l'écart (fermeture de la session : la fenêtre réapparaît à la connexion suivante). */
export function oublierEcartees(s: Pick<Storage, 'length' | 'key' | 'removeItem'> | null = stockage()): void {
  if (!s) return;
  try {
    const cles: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIXE_ECARTEES)) cles.push(k);
    }
    for (const k of cles) s.removeItem(k);
  } catch {
    // rien
  }
}
