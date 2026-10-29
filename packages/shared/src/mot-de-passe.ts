/* Règles de composition d'un mot de passe de compte (ADR 0075) : une seule écriture pour le serveur (autorité) et pour l'interface
   (affichage en direct). Les règles de répétition et de suite sont celles du poivre ([poivre.ts]) ; la longueur minimale est
   celle du réglage « Sécurité » (au moins 12). Le texte du mot de passe n'est jamais journalisé. */
import { contientSuite, plusLongueRepetition } from './poivre.js';

export const MOT_DE_PASSE_LONGUEUR_MAX = 256;

export interface ContexteMotDePasse {
  /** Longueur minimale (réglage « Sécurité »). */
  minLen: number;
  /** Identifiants du compte que le mot de passe ne doit pas contenir. */
  identifiants?: string[];
  /** Noms de l'application et de l'organisation, que le mot de passe ne doit pas contenir. */
  noms?: string[];
  /** Mot de passe actuel, pour refuser un mot de passe identique (changement). */
  ancien?: string;
}

const CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
const contient = (s: string, textes: readonly string[] | undefined) => {
  const bas = s.toLowerCase();
  return (textes ?? []).some((t) => {
    const m = t.normalize('NFKC').trim().toLowerCase();
    return m.length >= 3 && bas.includes(m);
  });
};

/** Problèmes d'un mot de passe, un message par critère (liste vide : accepté). */
export function problemesMotDePasse(motDePasse: unknown, ctx: ContexteMotDePasse): string[] {
  const s = typeof motDePasse === 'string' ? motDePasse : '';
  const p: string[] = [];
  if (s.length < ctx.minLen) p.push(`au moins ${ctx.minLen} caractères`);
  if (s.length > MOT_DE_PASSE_LONGUEUR_MAX) p.push(`${MOT_DE_PASSE_LONGUEUR_MAX} caractères au maximum`);
  if (CLASSES.filter((r) => r.test(s)).length < 3)
    p.push('au moins 3 types de caractères parmi minuscules, majuscules, chiffres, symboles');
  if (plusLongueRepetition(s) > 3) p.push('pas plus de 3 caractères identiques à la suite');
  if (contientSuite(s)) p.push('pas de suite de plus de 4 caractères consécutifs (abcde, 12345, azerty, qwerty…)');
  if (contient(s, ctx.identifiants)) p.push("ne pas contenir l'identifiant");
  if (contient(s, ctx.noms)) p.push("ne pas contenir le nom de l'application ou de l'organisation");
  if (ctx.ancien !== undefined && ctx.ancien !== '' && s === ctx.ancien)
    p.push("doit être différent de l'ancien mot de passe");
  return p;
}
