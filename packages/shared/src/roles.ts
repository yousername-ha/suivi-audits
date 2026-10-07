/* Étapes d'accès. Les droits (rôles, groupes, permissions) sont dans permissions.ts. */

/** Étape d'accès : anonyme, code TOTP à saisir, enrôlement TOTP, changement de mot de passe imposé, ou accès complet. */
export type AccessStage = 'anon' | 'mfa' | 'enroll' | 'password' | 'ok';
