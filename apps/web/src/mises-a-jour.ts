/* Mises à jour depuis l'interface : règles d'affichage de la vérification, sans dépendance à React (testées seules). */
import type { UpdateState } from '@suivi/shared';

/** Une version plus récente que celle installée est publiée. */
export function nouvelleVersion(s?: UpdateState): boolean {
  if (!s?.available || !/^\d+\.\d+\.\d+$/.test(s.installed)) return false;
  const a = s.installed.split('.').map(Number),
    b = s.available.split('.').map(Number);
  const i = a.findIndex((v, index) => v !== b[index]);
  return i >= 0 && a[i]! < b[i]!;
}

/** Échec de connexion à GitHub : le plus souvent le pare-feu de l'hôte ou du réseau, qui reste du ressort de l'équipe
    infrastructure même quand le flux « Mises à jour de la plateforme » est ouvert dans l'application (ADR 0097). */
export const ECHEC_GITHUB =
  'La vérification a échoué : le serveur n’a pas pu joindre GitHub. Vérifiez que le pare-feu de l’hôte et du réseau autorise les sorties du flux « Mises à jour de la plateforme » (Configuration système, Flux vers l’extérieur), puis réessayez.';
export const ECHEC_GITHUB_PERSISTANT =
  'Dernière vérification en échec : le serveur n’a pas pu joindre GitHub (pare-feu de l’hôte ou du réseau, ou GitHub indisponible). La dernière information connue est conservée.';

const TERMINAUX: readonly UpdateState['status'][] = ['success', 'failed', 'rolled_back', 'intervention'];

export type IssueVerification = { ton: 'info' | 'erreur'; texte: string };

/** Résultat de la vérification demandée, d'après l'état publié par l'exécutant ; null tant qu'elle n'est pas terminée.
    La demande est reconnue à son identifiant : son échec est annoncé dès qu'il est connu (R6-03), même si un exécutant
    antérieur laisse la phase « checking » publiée. Exécutant qui ne publierait pas l'identifiant : la date de vérification
    change. Un échec d'une vérification précédente (checkError resté vrai) n'est jamais pris pour le résultat. */
export function issueVerification(
  etat: UpdateState,
  demande: { id: string | null; checkedAt: string | null },
): IssueVerification | null {
  const reussite = (): IssueVerification =>
    nouvelleVersion(etat)
      ? { ton: 'info', texte: `Une nouvelle version est disponible : ${etat.available}.` }
      : { ton: 'info', texte: 'Vérification terminée : aucune nouvelle version.' };
  if (demande.id && etat.id === demande.id && TERMINAUX.includes(etat.status) && !etat.checking) {
    if (etat.status === 'success') return reussite();
    return {
      ton: 'erreur',
      texte: etat.checkError
        ? ECHEC_GITHUB
        : `La vérification n’a pas abouti${etat.message ? ` : ${etat.message}` : '.'}`,
    };
  }
  if (etat.checking || etat.phase === 'checking') return null;
  if (etat.checkedAt !== demande.checkedAt && !etat.checkError) return reussite();
  return null;
}
