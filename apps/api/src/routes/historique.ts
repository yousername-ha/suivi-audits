import { modulesAnnexesRoutes } from './historique/modules-annexes.js';
import { auditRoutes } from './historique/audit.js';
import { crrcRoutes } from './historique/crrc.js';
import { incidentsRoutes } from './historique/incidents.js';
import { criseRoutes } from './historique/crise.js';

export const historiqueRoutes = [
  ...modulesAnnexesRoutes,
  ...auditRoutes,
  ...crrcRoutes,
  ...incidentsRoutes,
  ...criseRoutes,
];
