/* Étapes d'accès. Les droits (rôles, groupes, permissions) sont dans permissions.ts. */

/** Étape d'accès : anonyme, second facteur à présenter (code TOTP, clé de sécurité ou code de récupération), enrôlement TOTP,
    enrôlement d'une clé de sécurité imposé (ADR 0079), changement de mot de passe imposé, ou accès complet. */
export type AccessStage = 'anon' | 'mfa' | 'enroll' | 'enroll_key' | 'password' | 'ok';
