import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  AUDITOR_MODULES,
  BUSINESS_MODULES,
  canReceive,
  DROITS_HORS_ROLES_PREDEFINIS,
  ENTITIES,
  effectivePermissions,
  estPermissionReservee,
  isPermission,
  legacyKeyModule,
  libellePermission,
  MODULES,
  PERMISSIONS_RESERVEES,
  Rights,
  SYSTEM_ROLE_DEFS,
  V2_ROLE_MAPPING,
} from '../src/index.js';
import { LEGACY_MODULES } from '../src/legacy/index.js';

describe('modèle de droits', () => {
  it('permissions = modules × actions (17 × 5), plus les droits réservés (1)', () => {
    expect(ALL_PERMISSIONS).toHaveLength(86);
    expect(new Set(ALL_PERMISSIONS).size).toBe(86);
    // Un seul droit réservé (droit spécial cumulable « DPO », ADR 0110) : il est dans ALL_PERMISSIONS…
    expect(ALL_PERMISSIONS.filter((p) => estPermissionReservee(p))).toEqual([...PERMISSIONS_RESERVEES]);
    expect(PERMISSIONS_RESERVEES).toEqual(['veille_reglementaire:dpo']);
    expect(ALL_PERMISSIONS).toContain('veille_reglementaire:dpo');
    expect(isPermission('veille_reglementaire:dpo')).toBe(true);
    expect(isPermission('audit:dpo')).toBe(false);
    expect(libellePermission('veille_reglementaire:dpo')).toBe(
      'Veille réglementaire — DPO : lire la veille réglementaire et qualifier les publications « données personnelles »',
    );
    expect(libellePermission('vulnerabilites:lire')).toBe('Vulnérabilités — Lire');
    expect(libellePermission('tableau_de_bord:administrer')).toBe(
      'Tableau de bord de l’accueil (disposition et partage) — Publier pour tous',
    );
  });

  it('rôles prédéfinis conformes à la spécification', () => {
    const p = (r: keyof typeof SYSTEM_ROLE_DEFS) => new Set(SYSTEM_ROLE_DEFS[r].permissions);
    // … mais n'entre pas dans « tous les droits » des rôles prédéfinis : ni l'administrateur ni le RSSI ne l'ont d'office.
    expect(p('administrateur').size).toBe(85);
    expect(DROITS_HORS_ROLES_PREDEFINIS).toEqual(['veille_reglementaire:dpo']);
    for (const r of ['administrateur', 'rssi', 'contributeur', 'lecteur', 'auditeur_externe'] as const)
      expect(p(r).has('veille_reglementaire:dpo'), r).toBe(false);
    expect([...p('rssi')].some((x) => x.startsWith('administration:'))).toBe(false);
    expect(p('rssi').has('parametres:administrer')).toBe(true);
    expect(p('contributeur').has('ecarts:modifier')).toBe(true);
    expect(p('contributeur').has('ecarts:supprimer')).toBe(false);
    expect(p('contributeur').has('administration:lire')).toBe(false);
    // Tableau de bord de l'accueil (ADR 0078, lot 2b) : disposer et partager, réservé aux rôles qui modifient.
    for (const r of ['administrateur', 'rssi', 'contributeur'] as const)
      expect(p(r).has('tableau_de_bord:modifier')).toBe(true);
    for (const r of ['lecteur', 'auditeur_externe'] as const)
      expect([...p(r)].some((x) => x.startsWith('tableau_de_bord:'))).toBe(false);
    // Assistant RSSI (ADR 0086) : droit dédié, porté par les seuls rôles administrateur et RSSI.
    for (const r of ['administrateur', 'rssi'] as const) expect(p(r).has('assistant:lire')).toBe(true);
    for (const r of ['contributeur', 'lecteur', 'auditeur_externe'] as const)
      expect([...p(r)].some((x) => x.startsWith('assistant:'))).toBe(false);
    // Vulnérabilités (ADR 0100, lot V5 : failles et machines) : hors des modules métier, comme l'assistant. Tous les droits
    // à l'administrateur et au RSSI ; aucun par défaut au contributeur, au lecteur ni à l'auditeur externe (un rôle
    // personnalisé peut les accorder).
    for (const r of ['administrateur', 'rssi'] as const)
      for (const a of ['lire', 'modifier', 'supprimer', 'administrer'] as const)
        expect(p(r).has(`vulnerabilites:${a}`)).toBe(true);
    for (const r of ['contributeur', 'lecteur', 'auditeur_externe'] as const)
      expect([...p(r)].filter((x) => x.startsWith('vulnerabilites:'))).toEqual([]);
    expect(BUSINESS_MODULES).not.toContain('vulnerabilites');
    expect(MODULES).toContain('vulnerabilites');
    expect(AUDITOR_MODULES).not.toContain('vulnerabilites');
    // Un droit du module seul n'ouvre ni l'accueil ni les routes communes « métier ».
    expect(new Rights(['vulnerabilites:lire', 'vulnerabilites:administrer']).canReadAnyBusiness()).toBe(false);
    // Intégrations (ADR 0076) : module non métier, comme l'import et l'export ; RSSI et administrateur seuls par défaut.
    for (const r of ['administrateur', 'rssi'] as const)
      for (const a of ['lire', 'modifier', 'administrer'] as const) expect(p(r).has(`integrations:${a}`)).toBe(true);
    for (const r of ['contributeur', 'lecteur', 'auditeur_externe'] as const)
      expect([...p(r)].some((x) => x.startsWith('integrations:'))).toBe(false);
    // Veille réglementaire (ADR 0110) : hors des modules métier ; droits de la matrice à l'administrateur et au RSSI, jamais
    // le droit réservé « DPO » (vérifié plus haut) ; aucun rôle prédéfini « DPO » ; rien au contributeur, au lecteur ni à
    // l'auditeur externe.
    for (const r of ['administrateur', 'rssi'] as const)
      for (const a of ['lire', 'modifier', 'administrer'] as const)
        expect(p(r).has(`veille_reglementaire:${a}`)).toBe(true);
    expect(Object.keys(SYSTEM_ROLE_DEFS)).not.toContain('dpo');
    for (const r of ['contributeur', 'lecteur', 'auditeur_externe'] as const)
      expect([...p(r)].some((x) => x.startsWith('veille_reglementaire:'))).toBe(false);
    expect(BUSINESS_MODULES).not.toContain('veille_reglementaire');
    expect(AUDITOR_MODULES).not.toContain('veille_reglementaire');
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
