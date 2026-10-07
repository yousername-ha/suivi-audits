/* Rôles et droits. */

export const ROLES = ['admin', 'rw', 'ro'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  rw: 'Lecture et écriture',
  ro: 'Lecture seule',
};

/** Niveau d'accès requis par une route : session complète, écriture, ou administration. */
export type Need = 'any' | 'rw' | 'admin';

export function roleSatisfies(role: Role, need: Need): boolean {
  if (need === 'any') return true;
  if (need === 'rw') return role === 'rw' || role === 'admin';
  return role === 'admin';
}

/** Étape d'accès : anonyme, code TOTP à saisir, enrôlement TOTP, changement de mot de passe imposé, ou accès complet. */
export type AccessStage = 'anon' | 'mfa' | 'enroll' | 'password' | 'ok';
