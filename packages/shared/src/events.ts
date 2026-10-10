/* Événements temps réel (SSE /api/events), alimentés par LISTEN/NOTIFY de PostgreSQL. */
import { type Permission, type Rights } from './permissions.js';

/** Entités diffusées. Chaque événement ne contient que des métadonnées (jamais de contenu). */
export const ENTITIES = [
  'documents',
  'document_versions',
  'links',
  'users',
  'groups',
  'roles',
  'sessions',
  'settings',
  'legacy_state',
  'import_batches',
  'wall_screens',
  'maps',
  'module_activation',
  'environment_configuration',
] as const;
export type Entity = (typeof ENTITIES)[number];

/** Permission requise pour recevoir les événements d'une entité ; « métier » : au moins un module métier lisible. */
export const ENTITY_PERMISSION: Record<Entity, Permission | 'metier'> = {
  documents: 'documents:lire',
  document_versions: 'documents:lire',
  links: 'documents:lire',
  users: 'administration:lire',
  groups: 'administration:lire',
  roles: 'administration:lire',
  sessions: 'administration:lire',
  settings: 'parametres:lire',
  legacy_state: 'metier',
  import_batches: 'import_export:lire',
  wall_screens: 'administration:lire',
  maps: 'cartographie:lire',
  module_activation: 'administration:lire',
  environment_configuration: 'administration:lire',
};

export function canReceive(rights: Rights, entity: Entity): boolean {
  if (entity === 'module_activation') return true; // Métadonnées de configuration pour toute session authentifiée.
  const p = ENTITY_PERMISSION[entity];
  return p === 'metier' ? rights.canReadAnyBusiness() : rights.has(p);
}

export type ChangeOp = 'insert' | 'update' | 'delete';

export interface ChangeEvent {
  entity: Entity;
  id: string;
  version: number | null;
  op: ChangeOp;
  author: string;
  ts: string;
}

export type PresenceMode = 'view' | 'edit';

export interface PresenceEntry {
  /** Identifiant de connexion (onglet), pour distinguer deux onglets d'un même compte. */
  client: string;
  username: string;
  name: string;
  /** Ressource consultée, ex. « documents », « documents/<uuid> », « admin/users ». */
  resource: string;
  mode: PresenceMode;
  since: string;
}

/** Durée de validité d'une déclaration de présence (le client la renouvelle toutes les 20 s). */
export const PRESENCE_TTL_MS = 45_000;
export const PRESENCE_HEARTBEAT_MS = 20_000;
