/* Cartes de l'Administration : une carte n'apparaît qu'avec le droit de lecture correspondant, une entrée de menu disparaît
   sans carte visible, et chaque écran historique (onglet d'administration, section de paramètres) a sa carte. */
import type { Action, Module } from '@suivi/shared';
import { SETTINGS_SECTIONS } from '@suivi/shared';
import { describe, expect, it } from 'vitest';
import { ALIAS_ADMINISTRATION, cartesVisibles, DROITS_CARTES } from '../src/administration-droits';

const avec =
  (...droits: [Module, Action][]) =>
  (m: Module, a: Action) =>
    droits.some(([dm, da]) => dm === m && da === a);
const tout = () => true;
const rien = () => false;

describe('cartes de l’Administration : droits', () => {
  it('chaque carte a un identifiant unique et un côté', () => {
    const ids = DROITS_CARTES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DROITS_CARTES.every((c) => c.cote === 'plateforme' || c.cote === 'systeme')).toBe(true);
  });
  it('sans aucun droit, aucune carte ni entrée de menu', () => {
    expect(cartesVisibles(rien, 'plateforme')).toEqual([]);
    expect(cartesVisibles(rien, 'systeme')).toEqual([]);
  });
  it('l’administration seule ouvre comptes et exploitation, pas les réglages', () => {
    const peut = avec(['administration', 'lire']);
    expect(cartesVisibles(peut, 'plateforme')).toEqual(['utilisateurs', 'groupes', 'fonctions', 'roles', 'murs']);
    expect(cartesVisibles(peut, 'systeme')).toEqual([
      'sauvegardes',
      'mises-a-jour',
      'certificats',
      'sessions',
      'journal',
      'journaux-techniques',
      'modules',
      'environnement',
      'details',
    ]);
  });
  it('les réglages seuls ouvrent les sections de paramètres', () => {
    const peut = avec(['parametres', 'lire']);
    expect(cartesVisibles(peut, 'plateforme')).toEqual(['general', 'echelles', 'apparence', 'notifications']);
    expect(cartesVisibles(peut, 'systeme')).toEqual(['securite']);
  });
  it('les sections liées à un module exigent aussi ce module', () => {
    const base = avec(['parametres', 'lire']);
    expect(cartesVisibles(base, 'plateforme')).not.toContain('cycle');
    expect(cartesVisibles(avec(['parametres', 'lire'], ['audit', 'lire']), 'plateforme')).toContain('cycle');
    expect(cartesVisibles(avec(['parametres', 'lire'], ['conformite', 'lire']), 'plateforme')).toContain(
      'referentiels',
    );
    expect(cartesVisibles(avec(['import_export', 'lire']), 'plateforme')).toEqual(['import']);
  });
  it('chaque section de paramètres et chaque onglet d’administration a sa carte', () => {
    const ids = new Set(DROITS_CARTES.map((c) => c.id));
    const sections: Record<string, string> = {
      general: 'general',
      cycle: 'cycle',
      referentiels: 'referentiels',
      apparence: 'apparence',
      notifications: 'notifications',
      import_export: 'import',
      sauvegardes: 'sauvegardes',
      securite: 'securite',
    };
    for (const s of SETTINGS_SECTIONS) expect(ids.has(sections[s]!), s).toBe(true);
    for (const onglet of [
      'utilisateurs',
      'groupes',
      'fonctions',
      'roles',
      'sessions',
      'journal',
      'mises-a-jour',
      'murs',
      'import',
      'certificats',
      'modules',
      'environnement',
    ])
      expect(ids.has(onglet), onglet).toBe(true);
    expect(cartesVisibles(tout, 'plateforme').length + cartesVisibles(tout, 'systeme').length).toBe(
      DROITS_CARTES.length,
    );
  });
});

describe('entrées de menu : anciennes adresses', () => {
  const plateforme = ALIAS_ADMINISTRATION['/plateforme']!;
  const systeme = ALIAS_ADMINISTRATION['/systeme']!;
  it('rattache chaque ancienne adresse à une seule entrée', () => {
    for (const url of [
      '/plateforme',
      '/plateforme/utilisateurs',
      '/admin',
      '/admin/users',
      '/admin/roles',
      '/admin/import',
      '/parametres',
      '/parametres/general',
    ])
      expect([url, plateforme.test(url), systeme.test(url)]).toEqual([url, true, false]);
    for (const url of [
      '/systeme',
      '/systeme/journal',
      '/admin/system',
      '/admin/audit',
      '/admin/sessions',
      '/admin/environment',
      '/parametres/securite',
      '/parametres/sauvegardes',
    ])
      expect([url, plateforme.test(url), systeme.test(url)]).toEqual([url, false, true]);
  });
});
