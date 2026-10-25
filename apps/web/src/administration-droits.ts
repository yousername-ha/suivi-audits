/* Droits d'accès aux cartes de l'Administration (pages « Plateforme » et « Configuration système »). Fichier léger,
   partagé par le menu et par les pages : une carte n'est visible que si la personne a le droit de lecture correspondant,
   et une entrée de menu disparaît si aucune de ses cartes n'est visible. */
import type { Action, Module } from '@suivi/shared';

export type Cote = 'plateforme' | 'systeme';
export type Peut = (m: Module, a: Action) => boolean;

const parametres = (can: Peut) => can('parametres', 'lire');
const administration = (can: Peut) => can('administration', 'lire');

export const DROITS_CARTES: readonly { id: string; cote: Cote; peut: (can: Peut) => boolean }[] = [
  { id: 'general', cote: 'plateforme', peut: parametres },
  { id: 'cycle', cote: 'plateforme', peut: (can) => parametres(can) && can('audit', 'lire') },
  { id: 'referentiels', cote: 'plateforme', peut: (can) => parametres(can) && can('conformite', 'lire') },
  { id: 'echelles', cote: 'plateforme', peut: parametres },
  { id: 'utilisateurs', cote: 'plateforme', peut: administration },
  { id: 'groupes', cote: 'plateforme', peut: administration },
  { id: 'fonctions', cote: 'plateforme', peut: administration },
  { id: 'roles', cote: 'plateforme', peut: administration },
  { id: 'types-processus', cote: 'plateforme', peut: administration },
  { id: 'calendriers', cote: 'plateforme', peut: administration },
  { id: 'apparence', cote: 'plateforme', peut: parametres },
  { id: 'notifications', cote: 'plateforme', peut: parametres },
  { id: 'murs', cote: 'plateforme', peut: administration },
  { id: 'import', cote: 'plateforme', peut: (can) => can('import_export', 'lire') },
  { id: 'sauvegardes', cote: 'systeme', peut: administration },
  { id: 'mises-a-jour', cote: 'systeme', peut: administration },
  { id: 'certificats', cote: 'systeme', peut: administration },
  { id: 'securite', cote: 'systeme', peut: parametres },
  { id: 'sessions', cote: 'systeme', peut: administration },
  { id: 'journal', cote: 'systeme', peut: administration },
  { id: 'journaux-techniques', cote: 'systeme', peut: administration },
  { id: 'modules', cote: 'systeme', peut: administration },
  { id: 'details', cote: 'systeme', peut: administration },
];

/** Identifiants des cartes visibles pour un côté. */
export const cartesVisibles = (can: Peut, cote: Cote): string[] =>
  DROITS_CARTES.filter((c) => c.cote === cote && c.peut(can)).map((c) => c.id);

/** Adresses historiques (/parametres/…, /admin/…) rattachées à chaque entrée du menu, pour la surbrillance. */
const COTE_PLATEFORME =
  /^\/(?:plateforme|admin$|admin\/(?:users|groups|fonctions|roles|murs|import)|parametres(?!\/(?:sauvegardes|securite)))/;
const COTE_SYSTEME =
  /^\/(?:systeme|admin\/(?!users|groups|fonctions|roles|murs|import)|parametres\/(?:sauvegardes|securite))/;
export const ALIAS_ADMINISTRATION: Record<string, RegExp> = {
  '/plateforme': COTE_PLATEFORME,
  '/systeme': COTE_SYSTEME,
};
