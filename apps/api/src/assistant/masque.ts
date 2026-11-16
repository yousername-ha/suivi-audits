/* Masque des machines (ADR 0100, V14 ; règle de confidentialité du branchement de l'assistant sur le module Vulnérabilités) :
   dernier contrôle avant l'envoi au fournisseur du modèle. Chaque demande (consigne, messages de la personne, réponses
   précédentes, résultats d'outils, arguments d'appels d'outils) est relue : tout nom de machine de l'inventaire (nom complet
   ou premier libellé du nom), toute adresse et tout identifiant de la source (UUID de Tenable) y est remplacé par le repère
   de la machine dans la conversation quand la personne peut la lire, sinon par « [machine] ». Les outils du module ne rendent
   déjà que des repères ; ce masque couvre le reste : texte saisi par une personne (question, description d'une action qui
   nomme les machines depuis la décision V30, document, contexte de l'organisation). Le masque ne connaît que l'inventaire :
   un nom de machine qui n'y figure pas n'est pas reconnu. Un nom qui contient un espace, une lettre accentuée, « $ » ou
   « \\ » est cherché tel quel, entre deux frontières de mot ; la partie « MACHINE » d'un nom « DOMAINE\\MACHINE » et le nom
   sans « $ » final désignent aussi la machine. Limite assumée : un nom de machine qui est aussi un mot courant
   est masqué partout dans ce qui part. */
import { REPERE_FORMAT } from '@suivi/shared';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from './modele.js';

/** Machine de l'inventaire, avec les chaînes qui la désignent. */
export interface MachineAMasquer {
  id: string;
  nom: string | null;
  adresse: string | null;
  /** Identifiants de la source (UUID de Tenable, identifiant composé « uuid:… » ou « ip:…|nom »). */
  identifiants: string[];
  /** La personne peut lire la machine : elle reçoit un repère ; sinon, « [machine] ». */
  lisible: boolean;
}

export const MACHINE_MASQUEE = '[machine]';
/** Premier libellé d'un nom retenu comme désignation de la machine à partir de cette longueur (évite « db », « ad »…). */
const LIBELLE_MIN = 3;
/** Jeton candidat : lettres, chiffres, points, tirets, tirets bas et deux-points, commençant et finissant par une lettre
    ou un chiffre. Le tiret bas est admis parce qu'un nom de machine Windows (NetBIOS) peut en porter : sans lui, un tel nom
    serait découpé et ne serait pas reconnu. */
const JETON = /[A-Za-z0-9](?:[A-Za-z0-9._:-]*[A-Za-z0-9])?/g;

/** Clé reconnaissable par le découpage en jetons : elle est elle-même un jeton entier. */
const JETON_SEUL = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]*[A-Za-z0-9])?$/;
/** Lettre ou chiffre, dans toute écriture : sert de frontière de mot pour les clés cherchées telles quelles. */
const estAlphanumerique = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}]/u.test(c);

export type Masquer = (texte: string) => Promise<string>;

/** Construit le masque. `attribuer` rend le repère de chaque machine lisible (table de la conversation) ; absent (ronde),
    toute machine devient « [machine] ». */
export function creerMasque(
  machines: readonly MachineAMasquer[],
  attribuer?: (ids: string[]) => Promise<Map<string, string>>,
): Masquer {
  if (!machines.length) return async (t) => t;
  /** Clé en minuscules -> machine ; `null` : clé partagée par plusieurs machines (remplacée par « [machine] »). */
  const cles = new Map<string, MachineAMasquer | null>();
  const poser = (cle: string | null | undefined, m: MachineAMasquer) => {
    const k = cle?.trim().toLowerCase();
    if (!k) return;
    const deja = cles.get(k);
    cles.set(k, deja === undefined || deja?.id === m.id ? m : null);
  };
  /** Formes d'un nom : le nom entier ; la partie après « \ » d'un nom « DOMAINE\MACHINE » ; le nom sans « $ » final. */
  const poserNom = (nom: string | null, m: MachineAMasquer) => {
    if (!nom) return;
    poser(nom, m);
    const apres = nom.includes('\\') ? nom.slice(nom.lastIndexOf('\\') + 1) : nom;
    if (apres !== nom && apres.trim().length >= LIBELLE_MIN) poser(apres, m);
    for (const x of [nom, apres]) if (x.endsWith('$') && x.length - 1 >= LIBELLE_MIN) poser(x.slice(0, -1), m);
  };
  for (const m of machines) {
    poserNom(m.nom, m);
    poser(m.adresse, m);
    for (const x of m.identifiants) {
      poser(x, m);
      // Parties d'un identifiant composé « uuid:… » ou « ip:adresse|nom », sans son préfixe (une adresse IPv6 contient
      // elle-même des deux-points : elle n'est pas découpée).
      const parties = x.startsWith('uuid:') ? [x.slice(5)] : x.startsWith('ip:') ? x.slice(3).split('|') : [];
      for (const partie of parties) if (partie.length >= LIBELLE_MIN) poser(partie, m);
    }
    const libelle = m.nom?.split('.')[0];
    if (libelle && libelle !== m.nom && libelle.length >= LIBELLE_MIN && !/^\d+$/.test(libelle)) poser(libelle, m);
  }
  const reperes = new Map<string, string>();
  /* Clés que le découpage en jetons ne peut pas reconnaître (espace, lettre accentuée, « $ », « \ »…) : elles sont
     cherchées telles quelles dans le texte, entre deux frontières de mot. Les plus longues d'abord. */
  const exotiques = [...cles.keys()].filter((k) => !JETON_SEUL.test(k)).sort((a, b) => b.length - a.length);

  /** Machine désignée par un jeton : le jeton entier, une de ses parties (« : »), ou le premier libellé de l'une d'elles. */
  const designe = (jeton: string): MachineAMasquer | null | undefined => {
    const bas = jeton.toLowerCase();
    if (cles.has(bas)) return cles.get(bas);
    for (const partie of bas.split(':')) {
      if (!partie) continue;
      if (cles.has(partie)) return cles.get(partie);
      const premier = partie.split('.')[0]!;
      if (premier !== partie && premier.length >= LIBELLE_MIN && cles.has(premier)) return cles.get(premier);
    }
    return undefined;
  };

  return async (texte: string) => {
    const trouves: { debut: number; fin: number; m: MachineAMasquer | null }[] = [];
    // 1. Clés cherchées telles quelles. La mise en minuscules peut changer la longueur de rares caractères : les positions
    //    ne seraient plus celles du texte ; on cherche alors sans changer la casse.
    if (exotiques.length) {
      const bas = texte.toLowerCase();
      const ou = bas.length === texte.length ? bas : texte;
      const pris = (d: number, f: number) => trouves.some((x) => d < x.fin && f > x.debut);
      for (const k of exotiques) {
        for (let i = ou.indexOf(k); i !== -1; i = ou.indexOf(k, i + 1)) {
          const f = i + k.length;
          if (pris(i, f)) continue;
          if (estAlphanumerique(ou[i - 1]) || estAlphanumerique(ou[f])) continue;
          trouves.push({ debut: i, fin: f, m: cles.get(k) ?? null });
        }
      }
    }
    // 2. Jetons, hors de ce qui est déjà pris.
    const dejaPris = [...trouves];
    for (const j of texte.matchAll(JETON)) {
      if (REPERE_FORMAT.test(j[0])) continue;
      const d = j.index;
      const f = d + j[0].length;
      if (dejaPris.some((x) => d < x.fin && f > x.debut)) continue;
      const m = designe(j[0]);
      if (m !== undefined) trouves.push({ debut: d, fin: f, m });
    }
    if (!trouves.length) return texte;
    trouves.sort((a, b) => a.debut - b.debut);
    const aAttribuer = [...new Set(trouves.flatMap((x) => (x.m?.lisible && !reperes.has(x.m.id) ? [x.m.id] : [])))];
    if (aAttribuer.length && attribuer) for (const [id, r] of await attribuer(aAttribuer)) reperes.set(id, r);
    let out = '';
    let pos = 0;
    for (const x of trouves) {
      out += texte.slice(pos, x.debut) + ((x.m?.lisible && reperes.get(x.m.id)) || MACHINE_MASQUEE);
      pos = x.fin;
    }
    return out + texte.slice(pos);
  };
}

/** Transport qui masque toute demande avant de la remettre au transport réel. Les messages sont relus un par un, dans
    l'ordre (les repères s'attribuent dans l'ordre d'apparition). */
export function transportMasque(transport: TransportModele, masquer: Masquer): TransportModele {
  return {
    declare: () => transport.declare(),
    async completer(adresse: string, cle: string, demande: DemandeModele): Promise<ReponseModele> {
      const messages: MessageModele[] = [];
      for (const m of demande.messages) {
        const copie: MessageModele = { ...m, content: m.content === null ? null : await masquer(m.content) };
        if (m.tool_calls) {
          copie.tool_calls = [];
          for (const c of m.tool_calls)
            copie.tool_calls.push({
              ...c,
              function: { ...c.function, arguments: await masquer(c.function.arguments) },
            });
        }
        messages.push(copie);
      }
      return transport.completer(adresse, cle, { ...demande, messages });
    },
  };
}
