/* Assistant RSSI et module Vulnérabilités (ADR 0100, décisions V14, V25, V28, V29 et V30 ; ADR 0086). Rien d'identifiant sur
   une machine ne part chez le fournisseur du modèle : chaque machine lui est remise sous la forme d'un repère (« M-001 »),
   attribué par la plateforme pour une conversation et gardé côté serveur. Le texte du modèle est gardé avec ses repères ; ils
   ne sont remplacés par les noms qu'à l'affichage, pour la personne qui regarde et selon ses droits, ou à la confirmation
   d'une proposition d'action (V29). Ce module porte le format des repères, le découpage d'un texte en segments pour
   l'affichage, la décision sur une proposition et le bloc « actifs touchés » d'une action (V30). Fonctions pures. */
import { z } from 'zod';
import type { NatureSuivi } from './suivi-vulnerabilites.js';

/* ------------------------------------------------------------------ Repères */
/** Repères au plus par conversation : au-delà, une machine n'a pas de repère et n'est que comptée. */
export const REPERES_MAX = 999;
/** Repère d'une machine : « M- » et trois chiffres. */
export const repereMachine = (numero: number): string => `M-${String(numero).padStart(3, '0')}`;
export const REPERE_FORMAT = /^M-\d{3}$/;
/** Numéro d'un repère bien formé (1 à 999), sinon null. */
export function numeroRepere(repere: string): number | null {
  if (!REPERE_FORMAT.test(repere)) return null;
  const n = Number(repere.slice(2));
  return n >= 1 && n <= REPERES_MAX ? n : null;
}
/** Repère d'un actif exposé sur Internet (domaine ou adresse vu par AlgoLightHouse, lot ALH2) : « E- » et trois chiffres. Même
    règle que les machines : attribué par la plateforme pour une conversation, jamais le domaine ni l'adresse. */
export const repereExterne = (numero: number): string => `E-${String(numero).padStart(3, '0')}`;
export const REPERE_EXTERNE_FORMAT = /^E-\d{3}$/;
/** Numéro d'un repère externe bien formé (1 à 999), sinon null. */
export function numeroRepereExterne(repere: string): number | null {
  if (!REPERE_EXTERNE_FORMAT.test(repere)) return null;
  const n = Number(repere.slice(2));
  return n >= 1 && n <= REPERES_MAX ? n : null;
}
/** Un repère de machine ou d'actif externe, mot entier (pour l'affichage). */
const TOUT_REPERE = /(?<![A-Za-z0-9_-])[ME]-\d{3}(?![A-Za-z0-9_-])/g;
const repereValide = (r: string) => (r.startsWith('E-') ? numeroRepereExterne(r) : numeroRepere(r)) !== null;

/** Repères de machines cités dans un texte, dans l'ordre et sans doublon. Un repère est un mot entier : « M-0012 » n'en
    est pas un. Les repères d'actifs externes (« E-001 ») n'en sont pas : une proposition d'action ne vise que des machines. */
export function reperesCites(texte: string): string[] {
  const vus = new Set<string>();
  for (const m of texte.matchAll(/(?<![A-Za-z0-9_-])M-\d{3}(?![A-Za-z0-9_-])/g)) vus.add(m[0]);
  return [...vus];
}

/** Morceau d'un texte affiché : texte simple, machine nommée (repère remplacé), repère d'une machine que la personne ne peut
    pas lire (laissé tel quel), repère inconnu de la conversation (laissé tel quel et signalé). */
export type SegmentTexte =
  { texte: string } | { repere: string; machine: string } | { repere: string; etat: 'non_lisible' | 'inconnu' };

export type ResolutionRepere = { machine: string } | 'non_lisible' | 'inconnu';

/** Découpe un texte autour des repères qu'il cite (machines « M-001 » et actifs externes « E-001 ») ; chaque repère est
    résolu par l'appelant (le champ `machine` porte alors le nom de la machine, ou le domaine ou l'adresse de l'actif). */
export function decouperReperes(texte: string, resoudre: (repere: string) => ResolutionRepere): SegmentTexte[] {
  const out: SegmentTexte[] = [];
  let debut = 0;
  for (const m of texte.matchAll(TOUT_REPERE)) {
    const i = m.index;
    if (i > debut) out.push({ texte: texte.slice(debut, i) });
    const r = repereValide(m[0]) ? resoudre(m[0]) : 'inconnu';
    out.push(typeof r === 'string' ? { repere: m[0], etat: r } : { repere: m[0], machine: r.machine });
    debut = i + m[0].length;
  }
  if (debut < texte.length) out.push({ texte: texte.slice(debut) });
  return out;
}
/** Texte affiché : nom à la place des repères résolus, repère laissé tel quel sinon. */
export const texteDesSegments = (segments: readonly SegmentTexte[]): string =>
  segments.map((s) => ('texte' in s ? s.texte : 'machine' in s ? s.machine : s.repere)).join('');
/** Le texte cite au moins un repère (machine ou actif externe). */
export const citeUnRepere = (texte: string): boolean => [...texte.matchAll(TOUT_REPERE)].length > 0;

/* ------------------------------------------------------------------ Propositions d'action (conversation) */
export const PROPOSITION_VULN_TITRE_MAX = 200;
export const PROPOSITION_VULN_DESCRIPTION_MAX = 2000;
/** Machines citées au plus par une proposition. */
export const PROPOSITION_VULN_MACHINES_MAX = 30;
export const ETATS_PROPOSITION_VULN = ['en_attente', 'confirmee', 'rejetee', 'retiree'] as const;
export type EtatPropositionVuln = (typeof ETATS_PROPOSITION_VULN)[number];
export const ETAT_PROPOSITION_VULN_LIBELLES: Record<EtatPropositionVuln, string> = {
  en_attente: 'À examiner',
  confirmee: 'Confirmée',
  rejetee: 'Rejetée',
  retiree: 'Remplacée par une proposition plus récente',
};

const DateJour = z.iso.date();
/** Décision sur une proposition : la personne corrige au besoin l'intitulé, la description et l'échéance, choisit le
    périmètre de l'action (obligatoire pour confirmer), puis confirme ou rejette, avec une note facultative. */
export const DecisionPropositionVulnBody = z
  .object({
    decision: z.enum(['confirmer', 'rejeter']),
    perimetreId: z.uuid().optional(),
    titre: z.string().trim().min(1).max(PROPOSITION_VULN_TITRE_MAX).optional(),
    description: z.string().trim().max(PROPOSITION_VULN_DESCRIPTION_MAX).optional(),
    echeance: DateJour.nullable().optional(),
    note: z.string().trim().max(500).default(''),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.decision === 'confirmer' && !v.perimetreId)
      c.addIssue({ code: 'custom', path: ['perimetreId'], message: 'Choisissez le périmètre de l’action.' });
  });
export type DecisionPropositionVulnBody = z.infer<typeof DecisionPropositionVulnBody>;

/** Machine citée par une proposition, telle que la personne qui regarde peut la voir. */
export interface MachinePropositionDto {
  repere: string;
  /** Nom (ou adresse) de la machine, si la personne peut la lire ; sinon null et le repère reste affiché. */
  nom: string | null;
}

/** Proposition d'action de l'assistant sur une faille, affichée avec ses repères remplacés pour la personne qui regarde. */
export interface PropositionVulnerabiliteDto {
  id: string;
  conversationId: string;
  faille: { nature: NatureSuivi; id: string; libelle: string };
  /** Texte affiché (repères remplacés) et ses segments, pour marquer les machines. */
  titre: string;
  titreSegments: SegmentTexte[];
  description: string;
  descriptionSegments: SegmentTexte[];
  echeance: string | null;
  machines: MachinePropositionDto[];
  etat: EtatPropositionVuln;
  decidedBy: string;
  decidedAt: string | null;
  decisionNote: string;
  /** Action créée à la confirmation. */
  actionId: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ Contenu d'une action (V30) */
/** Machines nommées au plus dans une action ; au-delà, « et N autres » avec le renvoi à la faille. */
export const ACTIFS_MACHINES_MAX = 20;
export const ACTIFS_APPLICATIONS_MAX = 10;

/** Actifs touchés par une faille, pour la description d'une action créée depuis le module ou sur proposition de
    l'assistant (V30) : noms des machines que la personne peut lire, rangées par rang (les 20 premières), machines lisibles
    sans nom comptées, applications touchées (produit surveillé avec sa version, sinon nom du contrôle). */
export interface ActifsTouches {
  machines: string[];
  /** Machines lisibles touchées au-delà de la liste. */
  autres: number;
  /** Machines lisibles touchées sans nom connu (jamais d'adresse dans une action). */
  sansNom: number;
  applications: string[];
  /** Renvoi à la faille : « CVE-… » ou « contrôle n° … de Tenable Security Center ». */
  renvoi: string;
}

const coupe = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Bloc ajouté à la description de l'action (texte simple). Vide si rien n'est connu. */
export function blocActifsTouches(a: ActifsTouches): string {
  const lignes: string[] = [];
  const total = a.machines.length + a.autres + a.sansNom;
  if (total) {
    const suite = [
      ...(a.autres ? [`${a.autres} autre${a.autres > 1 ? 's' : ''}`] : []),
      ...(a.sansNom ? [`${a.sansNom} machine${a.sansNom > 1 ? 's' : ''} sans nom`] : []),
    ];
    const liste = a.machines.join(', ');
    lignes.push(
      `Machine${total > 1 ? 's' : ''} touchée${total > 1 ? 's' : ''} : ` +
        (liste ? liste + (suite.length ? ` et ${suite.join(' et ')}` : '') : suite.join(' et ')) +
        (a.autres || a.sansNom ? ` (liste complète dans le module Vulnérabilités : ${a.renvoi}).` : '.'),
    );
  }
  const apps = a.applications.slice(0, ACTIFS_APPLICATIONS_MAX);
  if (apps.length)
    lignes.push(
      `Application${apps.length > 1 ? 's' : ''} touchée${apps.length > 1 ? 's' : ''} : ${apps.join(', ')}` +
        (a.applications.length > apps.length ? ` et ${a.applications.length - apps.length} autre(s).` : '.'),
    );
  return lignes.length ? `Actifs touchés (selon vos droits de lecture) :\n${lignes.join('\n')}` : '';
}

/** Description finale d'une action : celle de la personne, puis le bloc des actifs touchés ; bornée à `max` caractères en
    raccourcissant la part de la personne, jamais le bloc. */
export function descriptionAvecActifs(description: string, bloc: string, max = 10000): string {
  const base = description.trim();
  if (!bloc) return coupe(base, max);
  const place = max - bloc.length - 2;
  if (place <= 0) return coupe(bloc, max);
  return base ? `${coupe(base, place)}\n\n${bloc}` : bloc;
}
