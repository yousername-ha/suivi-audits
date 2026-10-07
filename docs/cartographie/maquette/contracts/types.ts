export type MapViewType = 'context' | 'process';

export type ObjectType =
  | 'isms'
  | 'scope'
  | 'process'
  | 'subprocess'
  | 'stakeholder'
  | 'internal_issue'
  | 'external_issue'
  | 'application'
  | 'infrastructure'
  | 'site'
  | 'supplier'
  | 'requirement'
  | 'risk'
  | 'generic';

export type ScopeMembership = 'in' | 'out' | 'related' | 'unknown';

export interface BusinessObject {
  id: string;
  code?: string;
  type: ObjectType;
  category?: string;
  name: string;
  description?: string;
  ownerId?: string;
  scopeMembership?: ScopeMembership;
  standards?: string[];
  metadata?: Record<string, unknown>;
}

export interface BusinessRelation {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  type: string;
  directed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MapDefinition {
  id: string;
  name: string;
  viewType: MapViewType;
  organizationId?: string;
  scopeId?: string;
  currentVersion: number;
  settings: MapSettings;
}

export interface MapSettings {
  selectedStandards: string[];
  visibleObjectTypes: ObjectType[];
  showSecondaryRelations: boolean;
  layoutPreset: string;
}

export interface MapNodeInstance {
  id: string;
  mapId: string;
  objectRef: string;
  objectType: ObjectType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  hidden?: boolean;
  collapsed?: boolean;
  groupId?: string;
  presentationOverrides?: Record<string, unknown>;
}

export interface MapEdgeInstance {
  id: string;
  mapId: string;
  relationRef?: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  hidden?: boolean;
  presentationOverrides?: Record<string, unknown>;
}

export interface GenerationRequest {
  viewType: MapViewType;
  scopeId?: string;
  standards: string[];
  objectTypes: ObjectType[];
  relationshipDepth: number;
  includeSecondaryRelations: boolean;
  layoutPreset: string;
}
