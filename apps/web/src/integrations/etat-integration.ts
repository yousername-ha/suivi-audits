/* État en lecture seule d'un connecteur, vu depuis un outil qui l'exploite (ADR 0076, addendum du 19/11/2026) : les outils
   ne montrent que la dernière synchronisation, son erreur éventuelle et un lien vers la carte de la Plateforme. Sans état ni
   appel réseau (testé à part). */
import { type Action, libelleFrequence, type Module } from '@suivi/shared';
import type { Etat } from '@suivi/ui';

/** Ce que l'outil lit d'un connecteur : forme commune aux états de Tenable et d'AlgoLightHouse (routes du module qui
    l'exploite, droits de ce module). */
export interface ConnecteurLu {
  integrationId: string;
  nom: string;
  actif: boolean;
  derniere: {
    etat: 'en_file' | 'en_cours' | 'recu' | 'echec' | 'expire';
    demandeLe: string;
    termineLe: string | null;
    erreur: string | null;
  } | null;
  /** Dernière synchronisation complète (sans borne atteinte). */
  derniereCompleteLe: string | null;
  /** Lot F1 : fréquence de la synchronisation automatique (heures) et prochaine prévue (null : instance non prête). */
  frequenceHeures?: number;
  prochaineSynchronisation?: string | null;
}

/** État d'un connecteur et date de la dernière synchronisation réussie. */
export function etatConnecteur(c: ConnecteurLu): { libelle: string; etat: Etat; reussie: string | null } {
  const d = c.derniere;
  const reussie = d?.etat === 'recu' ? d.termineLe : c.derniereCompleteLe;
  if (!c.actif) return { libelle: 'Désactivé', etat: 'neutre', reussie };
  if (!d) return { libelle: 'Jamais synchronisé', etat: 'attention', reussie };
  if (d.etat === 'en_file' || d.etat === 'en_cours')
    return {
      libelle: d.etat === 'en_file' ? 'Synchronisation demandée' : 'Synchronisation en cours',
      etat: 'info',
      reussie,
    };
  if (d.etat === 'recu') return { libelle: 'Synchronisé', etat: 'succes', reussie };
  return { libelle: 'En échec', etat: 'erreur', reussie };
}

/** Lot N1 : état d'un connecteur alimenté par import de fichier (mêmes règles, libellés de l'import). */
export function etatImport(c: ConnecteurLu): { libelle: string; etat: Etat; reussie: string | null } {
  const d = c.derniere;
  const reussie = d?.etat === 'recu' ? d.termineLe : c.derniereCompleteLe;
  if (!c.actif) return { libelle: 'Désactivé', etat: 'neutre', reussie };
  if (!d) return { libelle: 'Aucun import', etat: 'attention', reussie };
  if (d.etat === 'en_file' || d.etat === 'en_cours') return { libelle: 'Import en cours', etat: 'info', reussie };
  if (d.etat === 'recu') return { libelle: 'Importé', etat: 'succes', reussie };
  return { libelle: 'En échec', etat: 'erreur', reussie };
}

/** Date de la dernière synchronisation (fin, sinon demande), ou null si aucune. */
export const dateDerniereSynchronisation = (c: ConnecteurLu): string | null =>
  c.derniere ? (c.derniere.termineLe ?? c.derniere.demandeLe) : null;

/** Erreur de la dernière synchronisation, en lecture : seulement si elle a échoué ou expiré. */
export function erreurSynchronisation(c: ConnecteurLu): string | null {
  const d = c.derniere;
  if (!d || (d.etat !== 'echec' && d.etat !== 'expire')) return null;
  return d.erreur ?? 'Échec sans détail.';
}

/** Lot F1 : fréquence en lecture (« Synchronisation automatique : une fois par jour »). */
export const texteFrequence = (heures: number) =>
  `Synchronisation automatique : ${libelleFrequence(heures).toLowerCase()}`;

/** Lot F1 : début du texte de la prochaine synchronisation ; la date suit quand elle est connue. */
export const texteProchaine = (prochaine: string | null) =>
  prochaine ? 'prochaine prévue : ' : 'aucune prévue (connecteur inactif, clé manquante ou flux fermé)';

/** Droit qui montre le lien « Configurer l'intégration » dans un outil : administrer les intégrations (décision du RSSI du
    19/11/2026, lot F1) ; lire seulement la carte ne suffit plus. Affichage seulement : le serveur reste seul juge. */
export const peutConfigurerIntegration = (can: (m: Module, a: Action) => boolean) => can('integrations', 'administrer');
