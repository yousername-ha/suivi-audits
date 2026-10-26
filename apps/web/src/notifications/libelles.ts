/* Libellés des réglages de notification (ADR 0058) : l'origine d'un résultat est toujours écrite en toutes lettres. */
import type { OrigineNotification, SourceNotification } from '@suivi/shared';

/** « groupe « Équipe » », « rôle « Lecteur » »… */
export const textSources = (sources: readonly SourceNotification[]) =>
  sources.map((s) => `${s.kind === 'groupe' ? 'groupe' : 'rôle'} « ${s.nom} »`).join(', ');

/** Origine d'un résultat, en toutes lettres. `sujet` : « votre » (Mon compte) ou « son » (fiche d'un autre compte). */
export function textOrigine(origine: OrigineNotification, sources: readonly SourceNotification[], sujet = 'son') {
  if (origine === 'utilisateur') return `${sujet} réglage personnel`;
  if (origine === 'defaut') return 'valeur par défaut';
  return textSources(sources);
}
