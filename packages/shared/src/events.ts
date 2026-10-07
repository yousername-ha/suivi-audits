/* Événements temps réel (SSE /api/events), alimentés par LISTEN/NOTIFY de PostgreSQL. */
import { roleSatisfies, type Need, type Role } from './roles.js';

/** Entités diffusées. Chaque événement ne contient que des métadonnées (jamais de contenu). */
export const ENTITIES = [
  'documents',
  'document_versions',
  'links',
  'users',
  'sessions',
  'settings',
  'legacy_state',
  'import_batches',
] as const;
export type Entity = (typeof ENTITIES)[number];

/** Rôle minimal pour recevoir les événements d'une entité. */
export const ENTITY_NEED: Record<Entity, Need> = {
  documents: 'any',
  document_versions: 'any',
  links: 'any',
  users: 'admin',
  sessions: 'admin',
  settings: 'admin',
  legacy_state: 'any',
  import_batches: 'admin',
};

export function canReceive(role: Role, entity: Entity): boolean {
  return roleSatisfies(role, ENTITY_NEED[entity]);
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
