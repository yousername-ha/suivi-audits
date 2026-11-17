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
   est masqué partout dans ce qui part.
   Liste de mots à ne pas masquer (V31, tenue avec le droit d'administrer le module Vulnérabilités) : le masque strict reste la
   règle ; un mot de la liste qui apparaît seul (mot entier, sans lettre ni chiffre collé, sans « \\ » devant ni « $ »
   derrière, sans point, tiret, tiret bas ou deux-points qui le relie à un autre mot) n'est plus masqué, quelle que soit la
   raison pour laquelle il désignait une machine (y compris un nom entier qui est exactement ce mot, « web »). Le nom complet,
   l'adresse et les identifiants d'une machine restent masqués, comme tout jeton plus long qui commence par le mot (« dpi.exemple.invalid », « dpi:8443 ») ; un mot qui a la forme d'une
   adresse, d'un identifiant ou d'un repère, ou qui est l'adresse ou l'identifiant d'une machine, est ignoré. */
import { cleMotNonMasque, motNonMasqueAdmis, REPERE_FORMAT } from '@suivi/shared';
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

/** Formes d'un nom de machine qui la désignent, en minuscules : le nom entier ; la partie après « \ » d'un nom
    « DOMAINE\MACHINE » ; le nom sans « $ » final ; le premier libellé (avant le premier point, 3 caractères au moins, pas
    seulement des chiffres). Sert au masque et au décompte des machines qu'un mot de la liste laisse sortir. */
export function formesDuNom(nom: string | null | undefined): string[] {
  if (!nom) return [];
  const formes: string[] = [nom];
  const apres = nom.includes('\\') ? nom.slice(nom.lastIndexOf('\\') + 1) : nom;
  if (apres !== nom && apres.trim().length >= LIBELLE_MIN) formes.push(apres);
  for (const x of [nom, apres]) if (x.endsWith('$') && x.length - 1 >= LIBELLE_MIN) formes.push(x.slice(0, -1));
  const libelle = nom.split('.')[0];
  if (libelle && libelle !== nom && libelle.length >= LIBELLE_MIN && !/^\d+$/.test(libelle)) formes.push(libelle);
  return [...new Set(formes.map((f) => f.trim().toLowerCase()).filter(Boolean))];
}

/** Caractères qui relient un mot à un autre dans un nom de machine ou une adresse (« dpi.exemple », « dpi:8443 »). */
const JOINTURES = '._:-';

/** L'occurrence [debut, fin) est un mot seul : ni lettre ni chiffre collé, ni « \ » devant (« DOMAINE\DPI »), ni « $ »
    derrière (« DPI$ »), ni point, tiret, tiret bas ou deux-points qui le relie à une lettre ou un chiffre. */
function motSeul(texte: string, debut: number, fin: number): boolean {
  const avant = texte[debut - 1];
  const apres = texte[fin];
  if (estAlphanumerique(avant) || estAlphanumerique(apres)) return false;
  if (avant === '\\' || apres === '$') return false;
  if (avant && JOINTURES.includes(avant) && estAlphanumerique(texte[debut - 2])) return false;
  if (apres && JOINTURES.includes(apres) && estAlphanumerique(texte[fin + 1])) return false;
  return true;
}

/** Construit le masque. `attribuer` rend le repère de chaque machine lisible (table de la conversation) ; absent (ronde),
    toute machine devient « [machine] ». `nonMasques` : liste de mots à ne pas masquer quand ils apparaissent seuls (V31) ;
    vide, le masque est strict. */
export function creerMasque(
  machines: readonly MachineAMasquer[],
  attribuer?: (ids: string[]) => Promise<Map<string, string>>,
  nonMasques: readonly string[] = [],
): Masquer {
  if (!machines.length) return async (t) => t;
  /** Clé en minuscules -> machine ; `null` : clé partagée par plusieurs machines (remplacée par « [machine] »). */
  const cles = new Map<string, MachineAMasquer | null>();
  /** Adresses et identifiants (et leurs parties autres que le nom) : jamais démasqués, même par un mot de la liste. */
  const proteges = new Set<string>();
  const poser = (cle: string | null | undefined, m: MachineAMasquer, protege = false) => {
    const k = cle?.trim().toLowerCase();
    if (!k) return;
    if (protege) proteges.add(k);
    const deja = cles.get(k);
    cles.set(k, deja === undefined || deja?.id === m.id ? m : null);
  };
  for (const m of machines) {
    for (const f of formesDuNom(m.nom)) poser(f, m);
    poser(m.adresse, m, true);
    for (const x of m.identifiants) {
      poser(x, m, true);
      // Parties d'un identifiant composé « uuid:… » ou « ip:adresse|nom », sans son préfixe (une adresse IPv6 contient
      // elle-même des deux-points : elle n'est pas découpée). La partie « nom » est le nom de la machine.
      const parties = x.startsWith('uuid:') ? [x.slice(5)] : x.startsWith('ip:') ? x.slice(3).split('|') : [];
      parties.forEach((partie, i) => {
        if (partie.length >= LIBELLE_MIN) poser(partie, m, !(x.startsWith('ip:') && i > 0));
      });
    }
  }
  /** Mots de la liste retenus : forme admise, et ni adresse ni identifiant d'une machine. */
  const libres = new Set(
    nonMasques
      .map((x) => x.trim())
      .filter(motNonMasqueAdmis)
      .map(cleMotNonMasque)
      .filter((k) => !proteges.has(k)),
  );
  const laisse = (texte: string, debut: number, fin: number) =>
    libres.size > 0 && libres.has(cleMotNonMasque(texte.slice(debut, fin))) && motSeul(texte, debut, fin);
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
          if (laisse(texte, i, f)) continue;
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
      if (laisse(texte, d, f)) continue;
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
