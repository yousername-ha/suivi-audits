import { describe, expect, it } from 'vitest';
import { activeRights, ModuleIntent, MODULE_REGISTRY, planModules } from '../src/modules.js';
import { ALL_PERMISSIONS, MODULES, Rights } from '../src/permissions.js';

describe('activation des modules', () => {
  it('couvre exactement tous les modules du RBAC, sans changer les permissions', () => {
    expect(MODULE_REGISTRY.map((m) => m.id)).toEqual([...MODULES]);
    expect(new Set(MODULE_REGISTRY.map((m) => m.id)).size).toBe(MODULES.length);
    expect(ALL_PERMISSIONS).toHaveLength(75);
  });
  it('protège administration et paramètres', () => {
    for (const id of ['administration', 'parametres'] as const) {
      const p = planModules([], { changes: [{ id, enabled: false }], cascade: true });
      expect(p.blockers).toHaveLength(1);
      expect(p.disabled).not.toContain(id);
    }
  });
  it('refuse de rompre une dépendance obligatoire sans cascade', () => {
    const p = planModules([], { changes: [{ id: 'audit', enabled: false }], cascade: false });
    expect(p.blockers.length).toBeGreaterThan(0);
    expect(p.disabled).not.toContain('plan_audit');
  });
  it('prévisualise la désactivation des dépendants en cascade', () => {
    const p = planModules([], { changes: [{ id: 'audit', enabled: false }], cascade: true });
    expect(p.blockers).toEqual([]);
    expect(p.disabled).toEqual(['audit', 'plan_audit']);
    expect(p.changes).toContainEqual({ id: 'plan_audit', enabled: false, automatic: true });
  });
  it('réactive les prérequis seulement avec cascade explicitement demandée', () => {
    const intent = { changes: [{ id: 'plan_audit' as const, enabled: true }], cascade: false };
    expect(planModules(['audit', 'plan_audit'], intent).blockers.length).toBeGreaterThan(0);
    const p = planModules(['audit', 'plan_audit'], { ...intent, cascade: true });
    expect(p.disabled).toEqual([]);
    expect(p.changes).toContainEqual({ id: 'audit', enabled: true, automatic: true });
  });
  it('ne force pas une instruction contradictoire explicite', () => {
    const p = planModules([], {
      changes: [
        { id: 'audit', enabled: false },
        { id: 'plan_audit', enabled: true },
      ],
      cascade: true,
    });
    expect(p.blockers.length).toBeGreaterThan(0);
  });
  it('les dépendances facultatives ne désactivent pas les autres modules', () => {
    const p = planModules([], { changes: [{ id: 'documents', enabled: false }], cascade: true });
    expect(p.disabled).toEqual(['documents']);
    expect(p.blockers).toEqual([]);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it('la validation refuse inconnus, doublons et champs supplémentaires', () => {
    expect(ModuleIntent.safeParse({ changes: [{ id: 'inconnu', enabled: false }] }).success).toBe(false);
    expect(
      ModuleIntent.safeParse({
        changes: [
          { id: 'audit', enabled: false },
          { id: 'audit', enabled: true },
        ],
      }).success,
    ).toBe(false);
    expect(ModuleIntent.safeParse({ changes: [{ id: 'audit', enabled: false }], force: true }).success).toBe(false);
  });
  it('retire les permissions actives sans altérer les droits attribués', () => {
    const grants = new Rights(ALL_PERMISSIONS);
    const rights = activeRights(grants, ['documents']);
    expect(rights.can('documents', 'lire')).toBe(false);
    expect(rights.can('audit', 'lire')).toBe(true);
    expect(grants.list()).toHaveLength(75);
    expect(activeRights(grants, []).list()).toEqual(grants.list());
  });
});
