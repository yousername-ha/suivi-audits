/* Masque des machines (ADR 0100, V14 ; règle de confidentialité du branchement de l'assistant sur le module Vulnérabilités) :
   dernier contrôle avant l'envoi au fournisseur du modèle. Chaque demande (consigne, messages de la personne, réponses
   précédentes, résultats d'outils, arguments d'appels d'outils) est relue : tout nom de machine de l'inventaire (nom complet
   ou premier libellé du nom), toute adresse et tout identifiant de la source (UUID de Tenable) y est remplacé par le repère
   de la machine dans la conversation quand la personne peut la lire, sinon par « [machine] ». Les outils du module ne rendent
   déjà que des repères ; ce masque couvre le reste : texte saisi par une personne (question, description d'une action qui
   nomme les machines depuis la décision V30, document, contexte de l'organisation). Le masque ne connaît que l'inventaire :
   un nom de machine qui n'y figure pas n'est pas reconnu. Limite assumée : un nom de machine qui est aussi un mot courant
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
/** Jeton candidat : lettres, chiffres, points, tirets et deux-points, commençant et finissant par une lettre ou un chiffre. */
const JETON = /[A-Za-z0-9](?:[A-Za-z0-9.:-]*[A-Za-z0-9])?/g;

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
    if (!cle) return;
    const k = cle.toLowerCase();
    const deja = cles.get(k);
    cles.set(k, deja === undefined || deja?.id === m.id ? m : null);
  };
  for (const m of machines) {
    poser(m.nom, m);
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
    for (const j of texte.matchAll(JETON)) {
      if (REPERE_FORMAT.test(j[0])) continue;
      const m = designe(j[0]);
      if (m !== undefined) trouves.push({ debut: j.index, fin: j.index + j[0].length, m });
    }
    if (!trouves.length) return texte;
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
