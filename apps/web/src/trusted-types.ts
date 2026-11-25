/* Trusted Types (ADR 0006, addendum du 24/11/2026). Les frontaux servent, en observation, l'en-tête
   « Content-Security-Policy-Report-Only: require-trusted-types-for 'script'; trusted-types suivi-xml » : une chaîne passée
   à un point d'injection du DOM (innerHTML, DOMParser…) sans politique déclarée est signalée dans la console du
   navigateur, sans être bloquée, et aucun rapport ne part vers un point de collecte.
   Seule politique de l'interface : « suivi-xml », réservée à l'analyse d'un fichier XML choisi par la personne (rapport
   Nessus, parties d'un classeur .xlsx) dans un document inerte (DOMParser, type application/xml : aucun script exécuté,
   rien n'est inséré dans la page). L'objet de la politique reste privé à ce module : il ne sert qu'à `analyserXml`.
   Une nouvelle politique se déclare dans POLITIQUES_TRUSTED_TYPES et dans les Caddyfile (test trusted-types.test.ts). */

export const POLITIQUE_XML = 'suivi-xml';
/** Politiques que l'interface peut créer : liste reprise mot pour mot par la directive trusted-types des frontaux. */
export const POLITIQUES_TRUSTED_TYPES: readonly string[] = [POLITIQUE_XML];

/** Partie de l'API Trusted Types utilisée ici (les types du DOM de TypeScript ne la décrivent pas). */
export interface FabriqueTrustedTypes {
  createPolicy(nom: string, regles: { createHTML(texte: string): string }): { createHTML(texte: string): unknown };
}

/** Refus repris par la politique : une déclaration de type de document ou d'entité n'est jamais analysée (aucune
    expansion d'entité, aucune ressource externe). Les appelants refusent déjà ces textes avec leur propre message. */
const DECLARATION = /<!DOCTYPE|<!ENTITY/i;

function verifierXml(texte: string): string {
  if (DECLARATION.test(texte)) throw new TypeError('XML refusé : déclaration de type de document ou d’entité.');
  return texte;
}

/** Fonction de conversion du texte XML. Avec l'API Trusted Types, la politique « suivi-xml » est créée ; sans elle
    (navigateur ancien, tests), le même contrôle s'applique et le texte passe tel quel. */
export function creerPolitiqueXml(fabrique: FabriqueTrustedTypes | undefined): (texte: string) => unknown {
  if (!fabrique) return verifierXml;
  const politique = fabrique.createPolicy(POLITIQUE_XML, { createHTML: verifierXml });
  return (texte) => politique.createHTML(texte);
}

let convertir: ((texte: string) => unknown) | undefined;

/** Analyse un texte XML par le DOMParser du navigateur, à travers la politique « suivi-xml ». Elle est créée une seule
    fois par page : un second createPolicy sous le même nom serait lui aussi signalé. */
export function analyserXml(texte: string, analyseur: Pick<DOMParser, 'parseFromString'> = new DOMParser()): Document {
  convertir ??= creerPolitiqueXml((globalThis as { trustedTypes?: FabriqueTrustedTypes }).trustedTypes);
  // Le DOMParser accepte un TrustedHTML ; les types du DOM de TypeScript n'y voient qu'une chaîne.
  return analyseur.parseFromString(convertir(texte) as string, 'application/xml');
}
