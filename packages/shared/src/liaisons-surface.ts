/* Module Vulnérabilités (ADR 0100, lot ALH3 ; décision du RSSI du 17/11/2026) : un actif exposé sur Internet vu par
   AlgoLightHouse (hôte ou domaine) relié à la ou aux machines internes, lues dans Tenable, vers lesquelles va la connexion.
   Premier maillon de la chaîne domaine → sous-domaine → hôte → service → machine interne. AlgoLightHouse ne range pas les
   services comme des objets (ils ne sont connus que par la cible d'une alerte) : le niveau le plus fin rangé est l'actif,
   et c'est lui qui est relié (« un actif → une ou plusieurs machines internes »).

   Deux voies : relier à la main (et délier), ou confirmer une proposition de la plateforme. Une proposition naît quand
   (a) l'adresse de l'hôte, ou l'adresse vers laquelle résout le domaine, est celle de la machine, ou (b) le nom de la machine
   correspond au domaine : nom complet égal, ou première étiquette du domaine égale au nom court de la machine. Rien n'est
   relié sans une personne. Cycle de vie et transitions : ceux du rapprochement des failles (transitionRapprochement,
   rapprochement-vulnerabilites.ts), restreints à « proposée, confirmée, rejetée, retirée » ; un rejet n'est pas reproposé
   tant que les données de l'actif et de la machine n'ont pas changé. Fonctions pures, sans appel réseau. */
import { z } from 'zod';
import type { RoleMachine } from './failles-tenable.js';
import { DecisionRapprochement, transitionRapprochement } from './rapprochement-vulnerabilites.js';
import type { ActifAlhDto, TypeActifAlh } from './surface-externe.js';

/* ------------------------------------------------------------------ Critères */
export const MOTIFS_LIAISON_MACHINE = ['adresse', 'nom_complet', 'nom_court'] as const;
export type MotifLiaisonMachine = (typeof MOTIFS_LIAISON_MACHINE)[number];
export const MOTIF_LIAISON_MACHINE_LIBELLES: Record<MotifLiaisonMachine, string> = {
  adresse: 'même adresse IP',
  nom_complet: 'même nom complet',
  nom_court: 'nom court de la machine égal à la première étiquette du domaine',
};

/** Statuts d'une liaison : ceux du rapprochement des failles, sans « rattachée d'office » ni « écartée » (rien n'est relié
    sans une personne). */
export const STATUTS_LIAISON_MACHINE = ['proposee', 'confirmee', 'rejetee', 'retiree'] as const;
export type StatutLiaisonMachine = (typeof STATUTS_LIAISON_MACHINE)[number];
export const STATUT_LIAISON_MACHINE_LIBELLES: Record<StatutLiaisonMachine, string> = {
  proposee: 'Proposée, à décider',
  confirmee: 'Reliée',
  rejetee: 'Rejetée',
  retiree: 'Retirée',
};
/** Origine d'une liaison : proposition de la plateforme, choix d'une personne (relier à la main), ou liaison en masse par
    motif à joker, sur un aperçu validé par une personne (lot ALH5, migration 084). */
export const ORIGINES_LIAISON_MACHINE = ['proposition', 'manuelle', 'masse'] as const;
export type OrigineLiaisonMachine = (typeof ORIGINES_LIAISON_MACHINE)[number];

/** Liaison multiple bornée : un actif mène au plus à ce nombre de machines reliées (répartiteur de charge). */
export const LIAISONS_MACHINES_PAR_ACTIF_MAX = 20;
/** Propositions calculées au plus par actif (les plus sûres d'abord : adresse, nom complet, nom court). */
export const PROPOSITIONS_MACHINES_PAR_ACTIF_MAX = 20;

/** Adresse IP sous une forme comparable : IPv4 en quatre nombres décimaux sans zéro de tête ; IPv6 développée (huit groupes
    de quatre chiffres hexadécimaux, minuscules) ; IPv6 qui porte une IPv4 (« ::ffff:192.0.2.1 ») ramenée à l'IPv4. Toute
    autre forme : null (jamais comparée). */
export function normaliserAdresseIp(brute: string | null | undefined): string | null {
  if (!brute) return null;
  const s = brute.trim().toLowerCase();
  const v4 = (x: string): string | null => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(x);
    if (!m) return null;
    const n = m.slice(1).map(Number);
    return n.every((o) => o <= 255) ? n.join('.') : null;
  };
  if (!s.includes(':')) return v4(s);
  let texte = s;
  const finV4 = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(texte);
  if (finV4) {
    const ip = v4(finV4[2]!);
    if (!ip) return null;
    const [a, b, c, d] = ip.split('.').map(Number) as [number, number, number, number];
    texte = `${finV4[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const parts = texte.split('::');
  if (parts.length > 2) return null;
  const groupes = (x: string) => (x ? x.split(':') : []);
  const tete = groupes(parts[0]!);
  const queue = parts.length === 2 ? groupes(parts[1]!) : [];
  const manque = 8 - tete.length - queue.length;
  if (parts.length === 2 ? manque < 1 : manque !== 0) return null;
  const tous = [...tete, ...Array<string>(parts.length === 2 ? manque : 0).fill('0'), ...queue];
  if (tous.length !== 8 || !tous.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  const developpee = tous.map((g) => g.padStart(4, '0'));
  // IPv4 portée par une IPv6 (::ffff:a.b.c.d) : comparée comme l'IPv4.
  if (developpee.slice(0, 5).every((g) => g === '0000') && developpee[5] === 'ffff') {
    const h = parseInt(developpee[6]!, 16);
    const l = parseInt(developpee[7]!, 16);
    return [h >> 8, h & 255, l >> 8, l & 255].join('.');
  }
  return developpee.join(':');
}

/** Nom DNS comparable : minuscules, espaces et point final retirés ; lettres, chiffres, « - », « _ » et « . » seulement,
    étiquettes non vides. Sinon null (un joker « * » n'est jamais comparé). */
export function normaliserNomDns(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const s = brut.trim().toLowerCase().replace(/\.$/, '');
  if (!s || !/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(s)) return null;
  return s;
}

/** Nom court : première étiquette d'un nom DNS comparable (« srv-web » pour « srv-web.interne.example »). */
export function nomCourt(brut: string | null | undefined): string | null {
  const n = normaliserNomDns(brut);
  return n ? n.split('.')[0]! : null;
}

/** Adresses d'un actif à comparer : la sienne pour un hôte, celle vers laquelle il résout pour un domaine. */
export function adressesActif(a: { type: TypeActifAlh; valeur: string; adresse: string | null }): string[] {
  const brutes = a.type === 'hote' ? [a.valeur, a.adresse] : [a.adresse];
  return [...new Set(brutes.map(normaliserAdresseIp).filter((x): x is string => !!x))];
}

/** Critère qui fonde une proposition entre un actif et une machine, du plus sûr au moins sûr ; null : aucune proposition.
    Le nom ne vaut que pour un domaine (un hôte n'a pas de nom chez l'éditeur). */
export function critereLiaisonMachine(
  actif: { type: TypeActifAlh; valeur: string; adresse: string | null },
  machine: { nom: string | null; adresse: string | null },
): MotifLiaisonMachine | null {
  const ip = normaliserAdresseIp(machine.adresse);
  if (ip && adressesActif(actif).includes(ip)) return 'adresse';
  if (actif.type !== 'domaine') return null;
  const domaine = normaliserNomDns(actif.valeur);
  const nom = normaliserNomDns(machine.nom);
  if (!domaine || !nom) return null;
  if (domaine === nom) return 'nom_complet';
  return nomCourt(domaine) === nomCourt(nom) ? 'nom_court' : null;
}

/** Rang d'un motif (0 : le plus sûr), pour choisir les propositions gardées sous la borne. */
export const rangMotifLiaison = (m: MotifLiaisonMachine) => MOTIFS_LIAISON_MACHINE.indexOf(m);

/* ------------------------------------------------------------------ Transitions */
export interface EtatLiaisonMachine {
  statut: StatutLiaisonMachine;
  /** Empreintes des données de l'actif (nature, valeur, adresse) et de la machine (nom, adresse) au dernier calcul. */
  empreinteActif: string;
  empreinteMachine: string;
}

/** Statut suivant d'une liaison au recalcul, par la règle du rapprochement des failles (transitionRapprochement) :
    - aucune ligne : proposée si un critère tient, sinon rien ;
    - confirmée (reliée) : reste, quelles que soient les données (seule une personne délie) ;
    - rejetée : reste tant que les données de l'actif et de la machine sont les mêmes ; sinon proposée de nouveau si un
      critère tient encore, retirée sinon ;
    - proposée ou retirée : proposée si un critère tient, retirée sinon.
    `garderDecision` : l'auteur, la date et la note de la décision sont gardés. */
export function transitionLiaisonMachine(
  courant: EtatLiaisonMachine | null,
  motif: MotifLiaisonMachine | null,
  actuel: { empreinteActif: string; empreinteMachine: string },
): { statut: StatutLiaisonMachine; garderDecision: boolean } | null {
  const t = transitionRapprochement(
    courant
      ? {
          statut: courant.statut,
          empreinteProduit: courant.empreinteActif,
          empreinteCve: courant.empreinteMachine,
          // Une liaison confirmée ne dépend d'aucune version : elle tient toujours.
          versionDecidee: '',
        }
      : null,
    motif ? { calcul: 'proposee', motif: 'nom_seulement', versionDansPlage: 'inconnu' } : null,
    { empreinteProduit: actuel.empreinteActif, empreinteCve: actuel.empreinteMachine, versionProduit: '' },
  );
  if (!t) return null;
  if (!(STATUTS_LIAISON_MACHINE as readonly string[]).includes(t.statut))
    throw new Error(`Statut de liaison inattendu : ${t.statut}`);
  return { statut: t.statut as StatutLiaisonMachine, garderDecision: t.garderDecision };
}

/* ------------------------------------------------------------------ Liaison en masse par motif (lot ALH5, décision C) */
/** Seul joker admis : « * », zéro caractère ou plus. Aucun autre métacaractère, aucune expression régulière : un motif est
    comparé par découpage sur « * » et recherche de texte littéral (jamais traduit en LIKE ni en RegExp). */
export const JOKER = '*';
/** Paires au plus par opération (aperçu et application) ; au-delà, l'aperçu est refusé avec le nombre trouvé. */
export const LIAISONS_MASSE_MAX = 200;
/** Lignes au plus rendues par liste de l'aperçu (sans correspondance, correspondances multiples) ; les nombres sont exacts. */
export const LIGNES_APERCU_MASSE_MAX = 200;

/** Motif : lettres, chiffres, « . », « - », « _ », « : » (adresse IPv6) et le joker ; au moins un caractère qui n'est pas un
    joker ; insensible à la casse. */
export const MotifJoker = z
  .string()
  .trim()
  .min(1, 'Motif vide.')
  .max(253, 'Motif trop long (253 caractères au plus).')
  .regex(/^[A-Za-z0-9._:*-]+$/, 'Motif : lettres, chiffres, « . », « - », « _ », « : » et le joker « * » seulement.')
  .refine((s) => /[^*]/.test(s), 'Un motif ne peut pas être fait que de jokers.');
export type MotifJoker = z.infer<typeof MotifJoker>;

export const nombreJokers = (motif: string): number => motif.split(JOKER).length - 1;

/** Valeur qui correspond au motif (insensible à la casse) : parties couvertes par chaque joker, de gauche à droite (en
    minuscules), ou null. Le texte entre deux jokers est cherché au plus tôt, le dernier morceau est ancré à la fin : une
    correspondance est trouvée dès qu'il en existe une, en temps linéaire (aucun retour arrière). */
export function correspondanceJoker(motif: string, valeur: string): string[] | null {
  const morceaux = motif.toLowerCase().split(JOKER);
  const v = valeur.toLowerCase();
  if (morceaux.length === 1) return v === morceaux[0] ? [] : null;
  const tete = morceaux[0]!;
  const queue = morceaux[morceaux.length - 1]!;
  if (!v.startsWith(tete) || v.length < tete.length + queue.length || !v.endsWith(queue)) return null;
  const fin = v.length - queue.length;
  let pos = tete.length;
  const parts: string[] = [];
  for (const m of morceaux.slice(1, -1)) {
    const i = m ? v.indexOf(m, pos) : pos;
    if (i < 0 || i + m.length > fin) return null;
    parts.push(v.slice(pos, i));
    pos = i + m.length;
  }
  parts.push(v.slice(pos, fin));
  return parts;
}

/** Modes : « un pour un » (l'actif est relié à la machine dont la partie couverte par les jokers est identique à la sienne)
    ou « tous vers une machine » (tous les actifs du motif vers la machine choisie). */
export const MODES_LIAISON_MASSE = ['un_pour_un', 'tous_vers_une'] as const;
export type ModeLiaisonMasse = (typeof MODES_LIAISON_MASSE)[number];
export const MODE_LIAISON_MASSE_LIBELLES: Record<ModeLiaisonMasse, string> = {
  un_pour_un: 'Un pour un (même partie couverte par le joker)',
  tous_vers_une: 'Tous vers une machine',
};

/** Demande d'aperçu (`vulnerabilites:modifier`) : motif des actifs (domaine ou adresse) et, selon le mode, motif des machines
    internes (nom ; autant de jokers, au moins un) ou machine choisie. */
export const DemandeLiaisonMasse = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('un_pour_un'), motifActifs: MotifJoker, motifMachines: MotifJoker }).strict(),
    z.object({ mode: z.literal('tous_vers_une'), motifActifs: MotifJoker, machineId: z.uuid() }).strict(),
  ])
  .superRefine((d, ctx) => {
    if (d.mode !== 'un_pour_un') return;
    const a = nombreJokers(d.motifActifs);
    if (a < 1 || a !== nombreJokers(d.motifMachines))
      ctx.addIssue({
        code: 'custom',
        path: ['motifMachines'],
        message: 'Un pour un : les deux motifs doivent porter le même nombre de jokers « * », au moins un.',
      });
  });
export type DemandeLiaisonMasse = z.infer<typeof DemandeLiaisonMasse>;

/** Paire validée par la personne : identifiants et version des liaisons de l'actif lue à l'aperçu. */
export const PaireLiaisonMasse = z
  .object({ actifId: z.uuid(), machineId: z.uuid(), versionLiaisons: z.number().int().positive() })
  .strict();
export type PaireLiaisonMasse = z.infer<typeof PaireLiaisonMasse>;

/** Application d'un aperçu validé : la demande, les paires de l'aperçu et son empreinte. Le serveur relie seulement ces
    paires, après les avoir vérifiées une à une ; il ne relie jamais une paire qu'il calculerait de nouveau. */
export const ApplicationLiaisonMasse = z
  .object({
    demande: DemandeLiaisonMasse,
    empreinte: z.string().regex(/^[0-9a-f]{64}$/, 'Empreinte d’aperçu invalide.'),
    paires: z.array(PaireLiaisonMasse).min(1).max(LIAISONS_MASSE_MAX),
  })
  .strict();
export type ApplicationLiaisonMasse = z.infer<typeof ApplicationLiaisonMasse>;

export interface ActifMasseDto {
  id: string;
  type: TypeActifAlh;
  valeur: string;
}
export interface MachineMasseDto {
  id: string;
  nom: string | null;
  adresse: string | null;
}

/** Aperçu, limité à ce que la personne lit : aucun actif ni machine illisible n'y paraît ni n'y est compté. */
export interface ApercuLiaisonMasseDto {
  demande: DemandeLiaisonMasse;
  /** Machine choisie (mode « tous vers une machine »). */
  machine: MachineMasseDto | null;
  paires: (Omit<PaireLiaisonMasse, 'actifId' | 'machineId'> & { actif: ActifMasseDto; machine: MachineMasseDto })[];
  /** Actifs lisibles et présents qui correspondent au motif. */
  actifs: number;
  sansCorrespondance: ActifMasseDto[];
  nombreSansCorrespondance: number;
  /** Un pour un : plusieurs machines lisibles correspondent ; l'actif est écarté. */
  multiples: { actif: ActifMasseDto; machines: number }[];
  nombreMultiples: number;
  /** Paires déjà reliées (rien à faire). */
  dejaReliees: number;
  /** Actifs déjà reliés au nombre maximal de machines. */
  plafond: number;
  /** Paires écartées faute de droit d'écriture sur le périmètre de l'actif ou sur celui de la machine. */
  nonModifiables: number;
  empreinte: string;
  max: number;
}

/** Bilan de l'application : paires reliées, et paires écartées parce que l'actif, la machine, la liaison ou les droits ont
    changé depuis l'aperçu. */
export interface ResultatLiaisonMasseDto {
  reliees: number;
  ecartees: number;
}

/* ------------------------------------------------------------------ API */
const note = z
  .string()
  .trim()
  .max(1000)
  .refine((s) => !/\p{Cc}/u.test(s), 'Caractère de contrôle refusé.')
  .default('');

/** Décision sur une proposition (`vulnerabilites:modifier`, If-Match : version des liaisons de l'actif) : même forme que
    la décision sur un rapprochement de faille. */
export const DecisionLiaisonMachine = DecisionRapprochement;
export type DecisionLiaisonMachine = DecisionRapprochement;

/** Relier à la main un actif à une machine lisible (`vulnerabilites:modifier`, If-Match : version des liaisons de
    l'actif), note facultative. */
export const CorpsLiaisonMachine = z.object({ machineId: z.uuid(), note }).strict();
export type CorpsLiaisonMachine = z.infer<typeof CorpsLiaisonMachine>;

/** Délier une machine reliée (`vulnerabilites:modifier`, If-Match : version des liaisons de l'actif), note facultative :
    la liaison devient « rejetée » et n'est pas reproposée à données égales. */
export const CorpsDeliaisonMachine = z.object({ note }).strict();
export type CorpsDeliaisonMachine = z.infer<typeof CorpsDeliaisonMachine>;

/** Filtre « Machine interne » de la liste des actifs : reliée à une machine lisible, avec une proposition lisible à
    décider, ou ni l'un ni l'autre (« à relier »). */
export const FILTRES_LIAISON_ACTIF = ['reliee', 'proposee', 'a_relier'] as const;
export const FiltreLiaisonActif = z.enum(FILTRES_LIAISON_ACTIF);
export type FiltreLiaisonActif = z.infer<typeof FiltreLiaisonActif>;
export const FILTRE_LIAISON_ACTIF_LIBELLES: Record<FiltreLiaisonActif, string> = {
  reliee: 'Reliée',
  proposee: 'Proposée, à décider',
  a_relier: 'À relier',
};

/** Liste des propositions (ou des liaisons d'un statut) lisibles : actif et machine lisibles tous deux. */
export const RechercheLiaisonsMachines = z
  .object({
    statut: z.enum(['proposee', 'confirmee', 'rejetee']).default('proposee'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type RechercheLiaisonsMachines = z.infer<typeof RechercheLiaisonsMachines>;

/** Machine désignée par une liaison (lisible par la personne). */
export interface MachineLieeDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: RoleMachine | null;
  perimetreNom: string | null;
}

export interface LiaisonMachineDto {
  id: string;
  statut: StatutLiaisonMachine;
  /** Critère de la proposition (null : reliée à la main sans critère). */
  motif: MotifLiaisonMachine | null;
  origine: OrigineLiaisonMachine;
  machine: MachineLieeDto;
  decidePar: string | null;
  decideLe: string | null;
  note: string;
  calculeLe: string;
}

/** Résumé des liaisons d'un actif dans la liste (colonne « Machine interne »), limité aux machines lisibles. */
export interface ResumeLiaisonsActifDto {
  /** Machines reliées lisibles (les trois premières par nom). */
  reliees: { id: string; nom: string | null; adresse: string | null }[];
  nombreReliees: number;
  /** Propositions à décider dont la machine est lisible. */
  propositions: number;
  /** L'actif est aussi relié à au moins une machine que la personne ne peut pas lire (ni nommée ni comptée). */
  autresMachines: boolean;
}

/** Fiche des liaisons d'un actif lisible. `versionLiaisons` : If-Match de toute décision, liaison ou déliaison. */
export interface FicheLiaisonsActifDto {
  actifId: string;
  versionLiaisons: number;
  reliees: LiaisonMachineDto[];
  propositions: LiaisonMachineDto[];
  rejetees: LiaisonMachineDto[];
  autresMachines: boolean;
  max: number;
}

/** Proposition (ou liaison) de la liste, avec son actif. */
export interface PropositionLiaisonDto extends LiaisonMachineDto {
  actif: Pick<ActifAlhDto, 'id' | 'type' | 'valeur' | 'adresse' | 'perimetreAlh' | 'perimetreNom'>;
  versionLiaisons: number;
}

/** Fiche d'une machine (écran « Machines ») : actifs exposés lisibles reliés à elle (« exposée sur Internet par … »). */
export interface ExpositionMachineDto {
  actifs: (Pick<ActifAlhDto, 'id' | 'type' | 'valeur' | 'adresse' | 'perimetreAlh' | 'perimetreNom'> & {
    liaisonId: string;
    origine: OrigineLiaisonMachine;
    motif: MotifLiaisonMachine | null;
  })[];
  /** La machine est aussi reliée à au moins un actif exposé que la personne ne peut pas lire (ni nommé ni compté). */
  autresActifs: boolean;
}
