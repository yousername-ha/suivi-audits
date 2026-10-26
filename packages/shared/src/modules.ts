/* Activation globale : complète le RBAC sans modifier ses attributions. */
import { z } from 'zod';
import { MODULES, MODULE_LABELS, Rights, type Module } from './permissions.js';

export interface ModuleDefinition {
  id: Module;
  label: string;
  protected: boolean;
  required: readonly Module[];
  optional: readonly Module[];
}
const optional: Partial<Record<Module, readonly Module[]>> = {
  audit: ['ecarts', 'documents'],
  ecarts: ['audit', 'pilotage', 'documents'],
  plan_audit: ['ecarts', 'documents'],
  pilotage: ['audit', 'ecarts', 'fournisseurs', 'documents'],
  fournisseurs: ['pilotage', 'documents'],
  conformite: ['audit', 'documents'],
  crrc: ['fournisseurs', 'documents'],
  investissements: ['fournisseurs', 'documents'],
  incidents: ['pilotage', 'documents'],
  cartographie: ['audit', 'ecarts', 'pilotage', 'fournisseurs', 'conformite', 'documents'],
  import_export: [...MODULES.filter((m) => m !== 'import_export' && m !== 'administration' && m !== 'parametres')],
};
export const MODULE_REGISTRY: readonly ModuleDefinition[] = MODULES.map((id) => ({
  id,
  label: MODULE_LABELS[id],
  protected: id === 'administration' || id === 'parametres',
  required: id === 'plan_audit' ? ['audit'] : [],
  optional: optional[id] ?? [],
}));
export const ModuleIntent = z
  .object({
    changes: z
      .array(z.object({ id: z.enum(MODULES), enabled: z.boolean() }).strict())
      .min(1)
      .max(MODULES.length),
    cascade: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.changes.map((c) => c.id)).size !== v.changes.length)
      ctx.addIssue({ code: 'custom', message: 'Un module ne peut apparaître qu’une fois.' });
  });
export type ModuleIntent = z.infer<typeof ModuleIntent>;
export interface ModuleState {
  version: number;
  disabled: Module[];
}
export interface ModulePlan {
  disabled: Module[];
  changes: { id: Module; enabled: boolean; automatic: boolean }[];
  blockers: string[];
  warnings: string[];
}
/** Calcul pur : aucun effet de bord ni désactivation implicite sans cascade explicite. */
export function planModules(current: readonly Module[], intent: ModuleIntent): ModulePlan {
  const off = new Set(current);
  const explicit = new Map(intent.changes.map((c) => [c.id, c.enabled]));
  const blockers = new Set<string>();
  for (const change of intent.changes) {
    const def = MODULE_REGISTRY.find((m) => m.id === change.id)!;
    if (def.protected && !change.enabled) blockers.add(`${def.label} appartient au socle protégé.`);
    else if (change.enabled) off.delete(change.id);
    else off.add(change.id);
  }
  // D'abord les dépendances des activations explicitement demandées.
  for (const change of intent.changes.filter((c) => c.enabled)) {
    for (const dependency of MODULE_REGISTRY.find((m) => m.id === change.id)!.required) {
      if (!off.has(dependency)) continue;
      if (intent.cascade && explicit.get(dependency) !== false) off.delete(dependency);
      else blockers.add(`${MODULE_LABELS[change.id]} nécessite ${MODULE_LABELS[dependency]}.`);
    }
  }
  // Fermeture transitive des désactivations : les descendants sont affichés dans la prévisualisation.
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of MODULE_REGISTRY) {
      if (off.has(def.id)) continue;
      const missing = def.required.filter((id) => off.has(id));
      if (!missing.length) continue;
      if (intent.cascade && !def.protected && explicit.get(def.id) !== true) {
        off.add(def.id);
        changed = true;
      } else blockers.add(`${def.label} nécessite ${missing.map((id) => MODULE_LABELS[id]).join(', ')}.`);
    }
  }
  const disabled = MODULES.filter((id) => off.has(id));
  const changes = MODULES.filter((id) => current.includes(id) !== off.has(id)).map((id) => ({
    id,
    enabled: !off.has(id),
    automatic: !explicit.has(id),
  }));
  const warnings = MODULE_REGISTRY.filter((m) => !off.has(m.id)).flatMap((m) =>
    m.optional
      .filter((id) => off.has(id) && !current.includes(id))
      .map((id) => `${m.label} : enrichissement ${MODULE_LABELS[id]} indisponible.`),
  );
  return { disabled, changes, blockers: [...blockers], warnings };
}
export function activeRights(rights: Rights, disabled: readonly Module[]): Rights {
  const off = new Set<string>(disabled);
  return new Rights(rights.list().filter((p) => !off.has(p.split(':')[0]!)));
}
