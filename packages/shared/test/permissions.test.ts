import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  BUSINESS_MODULES,
  canReceive,
  ENTITIES,
  effectivePermissions,
  legacyKeyModule,
  Rights,
  SYSTEM_ROLE_DEFS,
  V2_ROLE_MAPPING,
} from '../src/index.js';
import { LEGACY_MODULES } from '../src/legacy/index.js';

describe('modèle de droits', () => {
  it('permissions = modules × actions (15 × 5)', () => {
    expect(ALL_PERMISSIONS).toHaveLength(75);
    expect(new Set(ALL_PERMISSIONS).size).toBe(75);
  });

  it('rôles prédéfinis conformes à la spécification', () => {
    const p = (r: keyof typeof SYSTEM_ROLE_DEFS) => new Set(SYSTEM_ROLE_DEFS[r].permissions);
    expect(p('administrateur').size).toBe(75);
    expect([...p('rssi')].some((x) => x.startsWith('administration:'))).toBe(false);
    expect(p('rssi').has('parametres:administrer')).toBe(true);
    expect(p('contributeur').has('ecarts:modifier')).toBe(true);
    expect(p('contributeur').has('ecarts:supprimer')).toBe(false);
    expect(p('contributeur').has('administration:lire')).toBe(false);
    // Lecteur : lecture seule, plus l'export des cartes (CARTO-01).
    expect([...p('lecteur')].every((x) => x.endsWith(':lire') || x === 'cartographie:exporter')).toBe(true);
    expect(p('lecteur').has('cartographie:modifier')).toBe(false);
    for (const r of ['contributeur', 'lecteur'] as const) expect(p(r).has('cartographie:exporter')).toBe(true);
    expect(p('contributeur').has('cartographie:modifier')).toBe(true);
    expect(p('contributeur').has('cartographie:supprimer')).toBe(false);
    expect(p('rssi').has('cartographie:administrer')).toBe(true);
    expect([...p('auditeur_externe')].filter((x) => x.startsWith('cartographie:'))).toEqual(['cartographie:lire']);
    expect(SYSTEM_ROLE_DEFS.auditeur_externe.scoped).toBe(true);
    expect(V2_ROLE_MAPPING).toEqual({ admin: 'administrateur', rw: 'contributeur', ro: 'lecteur' });
  });

  it('droits effectifs : union des rôles, portée par modules, origine conservée', () => {
    const eff = effectivePermissions([
      {
        roleId: 'lecteur',
        roleName: 'Lecteur',
        permissions: SYSTEM_ROLE_DEFS.lecteur.permissions,
        via: { kind: 'direct' },
      },
      {
        roleId: 'auditeur_externe',
        roleName: 'Auditeur externe',
        permissions: SYSTEM_ROLE_DEFS.auditeur_externe.permissions,
        modules: ['ecarts'],
        via: { kind: 'direct' },
      },
      {
        roleId: 'r_x',
        roleName: 'X',
        permissions: ['ecarts:modifier'],
        via: { kind: 'group', groupId: 'g', groupName: 'G' },
      },
    ]);
    expect(eff.get('ecarts:lire')!.map((o) => o.roleId)).toEqual(['lecteur', 'auditeur_externe']);
    expect(eff.get('audit:lire')!.map((o) => o.roleId)).toEqual(['lecteur']);
    expect(eff.get('ecarts:modifier')![0]!.via).toEqual({ kind: 'group', groupId: 'g', groupName: 'G' });
    expect(eff.has('ecarts:supprimer')).toBe(false);
  });

  it('chaque clé de l’outil historique est rattachée à un module de droits', () => {
    for (const m of LEGACY_MODULES) {
      const r = legacyKeyModule(m.key);
      if (m.phase === 0) expect(r).toBeNull();
      else expect(r).not.toBeNull();
    }
    expect(legacyKeyModule('cleInconnue')).toBe('parametres');
    expect(legacyKeyModule('__proto__')).toBe('parametres');
  });

  it('temps réel filtré par les droits', () => {
    const lecteur = new Rights(SYSTEM_ROLE_DEFS.lecteur.permissions);
    const admin = new Rights(ALL_PERMISSIONS);
    const rien = new Rights([]);
    expect(canReceive(lecteur, 'documents')).toBe(true);
    expect(canReceive(lecteur, 'users')).toBe(false);
    expect(canReceive(lecteur, 'legacy_state')).toBe(true);
    expect(canReceive(rien, 'legacy_state')).toBe(false);
    for (const e of ENTITIES) expect(canReceive(admin, e)).toBe(true);
    expect(BUSINESS_MODULES.every((m) => lecteur.can(m, 'lire'))).toBe(true);
  });
});
