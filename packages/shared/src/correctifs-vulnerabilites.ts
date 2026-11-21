/* Module Vulnérabilités (ADR 0100, lot S3 ; décision du RSSI du 18/11/2026) : regroupement par correctif, fin de support et
   état du correctif (« faille sans correctif connu »). Fonctions pures et déterministes, testées en table ; rien n'est
   inventé : chaque fait vient d'une source déjà lue et rangée, et l'on dit laquelle parle.

   - État du correctif d'une faille, à trois valeurs : « correctif disponible », « aucun correctif connu », « non renseigné ».
     Sources qui en parlent (inventaire du lot S3) :
       · Tenable : la date de publication du correctif du contrôle (`patchPubDate`, rangée `correctif_publie_le`) ; une date
         dit « disponible ». Son absence ne dit rien. Le texte de la solution (`solution`) n'est PAS lu comme une preuve : il
         peut décrire un contournement, une montée vers une version maintenue ou dire qu'aucune solution n'existe ;
       · CERT Santé : la mention « Un correctif existe : Oui / Non » de sa fiche (lot V4c), commune à toutes les fiches lues
         de la faille (sinon non renseignée) ; « Oui » dit « disponible », « Non » dit « aucun correctif connu ».
     Ne parlent pas de l'existence d'un correctif, et ne sont donc pas pris en compte : l'action exigée du catalogue KEV (une
     consigne : « appliquer les mesures de l'éditeur ou cesser d'utiliser le produit »), les versions touchées de NVD (une
     borne haute publiée suggère une version corrigée sans la prouver), les faits d'AlgoLightHouse.
     Règle des sources (V26, lot V4c) : une source suffit (« ou » logique) ; un correctif publié ne disparaît pas, donc
     « disponible » l'emporte sur « aucun » quand deux sources diffèrent ; les sources qui parlent sont rendues de la première
     à la dernière (la source en avance d'abord, date inconnue en dernier). « Non renseigné » ne vaut JAMAIS « aucun
     correctif » : il dit seulement qu'aucune source n'en parle.

   - Précision à côté de la marque « zero-day » (sans la renommer, décision à prendre par le RSSI) : une faille dont
     l'exploitation est avérée est « exploitée, correctif disponible », « exploitée, sans correctif connu » ou « exploitée,
     correctif non renseigné ».

   - Fin de support (plus de correctif de sécurité de l'éditeur), distincte de « version dépassée » :
       · Tenable : la date de fin de support du logiciel (`seolDate`, rangée `fin_support_le`) est passée. Une date à venir
         donne « fin de support annoncée », sans la marque. Aucune liste de noms codée en dur ;
       · AlgoLightHouse : `version_status = eol` d'un service exposé (lot ALH6). `outdated` dit « version dépassée », jamais
         « fin de support ».
     Aucune base de dates de fin de vie n'est embarquée ni téléchargée (ce serait une source de veille nouvelle).

   - Regroupement par correctif : une ligne par texte de solution de Tenable (anglais, tel quel, V19), espaces réduits, sans
     autre rapprochement : deux libellés différents pour la même mise à jour ne sont pas fusionnés. Les failles sans
     solution forment le groupe « Sans correctif indiqué par la source ». Tri par gain : priorité la plus haute, puis nombre
     de failles corrigées ; aucun nombre lié aux droits n'entre dans l'ordre (lot ALH5). */
import { z } from 'zod';
import type { NombreLisible } from './alertes-vulnerabilites.js';
import { type DelaiFailleDto, ETATS_DELAI, type EtatDelai } from './delais-vulnerabilites.js';
import { NIVEAUX_PRIORITE, type NiveauPriorite, type RoleMachine } from './failles-tenable.js';
import type { MentionCertSante } from './priorite-vulnerabilites.js';

/* ------------------------------------------------------------------ État du correctif */
export const ETATS_CORRECTIF = ['disponible', 'aucun_connu', 'non_renseigne'] as const;
export type EtatCorrectif = (typeof ETATS_CORRECTIF)[number];
export const ETAT_CORRECTIF_LIBELLES: Record<EtatCorrectif, string> = {
  disponible: 'Correctif disponible',
  aucun_connu: 'Aucun correctif connu',
  non_renseigne: 'Correctif non renseigné',
};

export const SOURCES_CORRECTIF = ['tenable', 'cert-sante'] as const;
export type SourceCorrectif = (typeof SOURCES_CORRECTIF)[number];
export const SOURCE_CORRECTIF_LIBELLES: Record<SourceCorrectif, string> = {
  tenable: 'Tenable (date de publication du correctif)',
  'cert-sante': 'CERT Santé (mention « Un correctif existe »)',
};

/** Ce que les sources rangées disent de l'existence d'un correctif. */
export interface IndicesCorrectif {
  /** Date de publication du correctif selon Tenable (`patchPubDate`), ou null. */
  tenablePublieLe: string | null;
  /** Mention « Un correctif existe » du CERT Santé, commune à ses fiches lues, ou null (non renseignée). */
  certSante: MentionCertSante | null;
  /** Date de la fiche du CERT Santé, si connue (sinon la mention est rangée après les sources datées). */
  certSanteLe?: string | null;
}

export interface SourceCorrectifDto {
  source: SourceCorrectif;
  valeur: 'disponible' | 'aucun';
  le: string | null;
}

export interface EtatCorrectifDto {
  etat: EtatCorrectif;
  /** Sources qui disent l'état retenu, la première d'abord (vide pour « non renseigné »). */
  sources: SourceCorrectifDto[];
}

const CORRECTIF_NON_RENSEIGNE: EtatCorrectifDto = { etat: 'non_renseigne', sources: [] };

/** État du correctif d'une faille, d'après les sources rangées (règle ci-dessus). */
export function etatCorrectif(i: IndicesCorrectif): EtatCorrectifDto {
  const dites: SourceCorrectifDto[] = [];
  if (i.tenablePublieLe) dites.push({ source: 'tenable', valeur: 'disponible', le: i.tenablePublieLe });
  if (i.certSante === 'oui') dites.push({ source: 'cert-sante', valeur: 'disponible', le: i.certSanteLe ?? null });
  if (i.certSante === 'non') dites.push({ source: 'cert-sante', valeur: 'aucun', le: i.certSanteLe ?? null });
  const ranger = (l: SourceCorrectifDto[]) =>
    [...l].sort(
      (a, b) =>
        (a.le === null ? 1 : 0) - (b.le === null ? 1 : 0) ||
        (a.le && b.le ? Date.parse(a.le) - Date.parse(b.le) : 0) ||
        SOURCES_CORRECTIF.indexOf(a.source) - SOURCES_CORRECTIF.indexOf(b.source),
    );
  const disponibles = dites.filter((x) => x.valeur === 'disponible');
  if (disponibles.length) return { etat: 'disponible', sources: ranger(disponibles) };
  const aucun = dites.filter((x) => x.valeur === 'aucun');
  if (aucun.length) return { etat: 'aucun_connu', sources: ranger(aucun) };
  return { ...CORRECTIF_NON_RENSEIGNE, sources: [] };
}

/** Phrase de l'état, avec la source qui parle : « Correctif disponible selon Tenable (date de publication du correctif)
    le 02/11/2026 ». */
export function libelleEtatCorrectif(c: EtatCorrectifDto, date: (iso: string) => string = jourIso): string {
  if (c.etat === 'non_renseigne') return 'Correctif non renseigné : aucune source rangée ne dit s’il en existe un.';
  const sources = c.sources
    .map((s) => `${SOURCE_CORRECTIF_LIBELLES[s.source]}${s.le ? ` le ${date(s.le)}` : ''}`)
    .join(', puis ');
  return `${ETAT_CORRECTIF_LIBELLES[c.etat]} selon ${sources}.`;
}
const jourIso = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
};

/* ------------------------------------------------------------------ Exploitation et correctif */
export const SITUATIONS_EXPLOITATION = ['corrigible', 'sans_correctif', 'correctif_non_renseigne'] as const;
export type SituationExploitation = (typeof SITUATIONS_EXPLOITATION)[number];
export const SITUATION_EXPLOITATION_LIBELLES: Record<SituationExploitation, string> = {
  corrigible: 'Exploitée, correctif disponible',
  sans_correctif: 'Exploitée, sans correctif connu',
  correctif_non_renseigne: 'Exploitée, correctif non renseigné',
};

/** Précision d'une faille à exploitation avérée selon l'état de son correctif ; null si l'exploitation n'est pas avérée. */
export function situationExploitation(exploitee: boolean, correctif: EtatCorrectif): SituationExploitation | null {
  if (!exploitee) return null;
  return correctif === 'disponible'
    ? 'corrigible'
    : correctif === 'aucun_connu'
      ? 'sans_correctif'
      : 'correctif_non_renseigne';
}

/** Lot PRIO-1 (décision du RSSI du 20/11/2026) : le mot « zero-day » est réservé à une faille à exploitation avérée SANS
    correctif connu (une source dit qu'aucun correctif n'existe : « Un correctif existe : Non » du CERT Santé, et aucune
    source ne dit le contraire). Une faille exploitée qui a un correctif, ou dont le correctif n'est pas renseigné, est dite
    « exploitation avérée ». Jamais synonyme de « récente » ni de « critique ». Ni la priorité ni les alertes n'en
    dépendent. */
export const REGLE_ZERO_DAY =
  'Le mot « zero-day » est réservé à une faille dont l’exploitation est avérée et pour laquelle aucun correctif n’est connu ; une faille exploitée qui a un correctif (ou dont le correctif n’est pas renseigné) est dite « exploitation avérée ». Il ne veut dire ni « récente », ni « critique ».';
export const LIBELLE_ZERO_DAY = 'Zero-day : exploitée, sans correctif connu';
export const LIBELLE_EXPLOITATION_AVEREE = 'Exploitation avérée';

/** Zero-day : exploitation avérée sans correctif connu (situation « sans_correctif »). */
export const estZeroDay = (s: SituationExploitation | null | undefined): boolean => s === 'sans_correctif';
/** Libellé de la marque d'une faille exploitée : « Zero-day : … » sans correctif connu, sinon « Exploitation avérée ». */
export const libelleMarqueExploitation = (s: SituationExploitation | null | undefined): string =>
  estZeroDay(s) ? LIBELLE_ZERO_DAY : LIBELLE_EXPLOITATION_AVEREE;

/* ------------------------------------------------------------------ Fin de support */
export const FIN_SUPPORT_LIBELLE = 'Fin de support';
export const FIN_SUPPORT_DEFINITION =
  'Fin de support : l’éditeur ne publie plus de correctif de sécurité pour ce système ou ce produit (distinct de « version dépassée », où une version plus récente existe encore et reçoit des correctifs).';
export const SOURCES_FIN_SUPPORT = ['tenable', 'alh'] as const;
export type SourceFinSupport = (typeof SOURCES_FIN_SUPPORT)[number];
export const SOURCE_FIN_SUPPORT_LIBELLES: Record<SourceFinSupport, string> = {
  tenable: 'Tenable : date de fin de support du logiciel (seolDate) passée',
  alh: 'AlgoLightHouse : version en fin de vie (version_status = eol)',
};

export type EtatFinSupport = 'atteinte' | 'annoncee';
/** Fin de support selon la date de Tenable (`seolDate`) : atteinte si la date est passée (ou du jour), annoncée si elle est
    à venir, null sans date. Une date illisible vaut null (rien n'est deviné). */
export function etatFinSupport(le: string | null, maintenant: Date): EtatFinSupport | null {
  if (!le) return null;
  const t = Date.parse(le);
  if (!Number.isFinite(t)) return null;
  return t <= maintenant.getTime() ? 'atteinte' : 'annoncee';
}
/** Un service exposé est en fin de support selon AlgoLightHouse : `version_status = eol` seulement. */
export const serviceEnFinDeSupport = (statut: 'eol' | 'outdated' | null | undefined) => statut === 'eol';

/* ------------------------------------------------------------------ Regroupement par correctif */
/** Texte de solution retenu pour le regroupement : espaces réduits ; vide ou absent : null (groupe « sans correctif »). */
export function texteCorrectif(t: string | null | undefined): string | null {
  if (typeof t !== 'string') return null;
  const s = t.replace(/\s+/g, ' ').trim();
  return s || null;
}
/** Clé du groupe « Sans correctif indiqué par la source ». */
export const CLE_SANS_CORRECTIF = 'aucun';
export const SANS_CORRECTIF_LIBELLE = 'Sans correctif indiqué par la source';
export const CleCorrectif = z.string().regex(/^(?:[0-9a-f]{16}|aucun)$/, 'Clé de correctif invalide.');

/** Une faille (constat de Tenable encore à traiter) réduite à ce qui sert au regroupement. Les machines sont celles que la
    personne lit ; `horsLecture` : la faille touche aussi des machines qu'elle ne lit pas. */
export interface FailleAGrouper {
  id: string;
  solution: string | null;
  priorite: NiveauPriorite;
  exploitee: boolean;
  exploitable: boolean;
  correctif: EtatCorrectifDto;
  finDeSupport: boolean;
  delai: DelaiFailleDto;
  cves: readonly string[];
  machinesLisibles: readonly string[];
  horsLecture: boolean;
}

export interface CorrectifDto {
  cle: string;
  /** Texte de la solution de Tenable (anglais, tel quel), ou null pour le groupe « Sans correctif indiqué par la source ». */
  solution: string | null;
  /** Failles (constats de Tenable) que ce correctif corrige : le même nombre pour tout le monde. */
  failles: number;
  /** CVE distinctes citées par ces failles : le même nombre pour tout le monde. */
  cves: number;
  /** Machines concernées que la personne lit ; drapeau sans nombre pour les autres. */
  machines: NombreLisible;
  /** Priorité la plus haute de ses failles (la même pour tout le monde). */
  priorite: NiveauPriorite;
  /** Failles à exploitation avérée, dont celles sans correctif connu ; failles exploitables (sans exploitation avérée). */
  exploitees: number;
  exploiteesSansCorrectif: number;
  exploitables: number;
  /** Failles en fin de support (selon Tenable). */
  finDeSupport: number;
  /** État de délai le plus défavorable (lot S1), échéance la plus proche, nombre de failles en dépassement. */
  delai: { etat: EtatDelai; echeance: string | null; enDepassement: number };
  /** Failles par état du correctif, et sources qui ont parlé. */
  correctif: Record<EtatCorrectif, number>;
  sourcesCorrectif: SourceCorrectif[];
}

/** Ordre de gravité des états de délai : le premier est le plus défavorable. */
const RANG_DELAI = (e: EtatDelai) => ETATS_DELAI.indexOf(e);

/** Regroupe les failles par texte de solution. `cle` : clé stable d'un texte (empreinte calculée par l'API) ; le groupe
    sans solution a la clé CLE_SANS_CORRECTIF. Groupes rendus dans l'ordre de comparerCorrectifs. */
export function regrouperParCorrectif(
  failles: readonly FailleAGrouper[],
  cle: (texte: string) => string,
): CorrectifDto[] {
  const groupes = new Map<
    string,
    { dto: CorrectifDto; cves: Set<string>; machines: Set<string>; echeances: (string | null)[] }
  >();
  for (const f of failles) {
    const texte = texteCorrectif(f.solution);
    const k = texte === null ? CLE_SANS_CORRECTIF : cle(texte);
    let g = groupes.get(k);
    if (!g) {
      g = {
        dto: {
          cle: k,
          solution: texte,
          failles: 0,
          cves: 0,
          machines: { lisibles: 0, horsLecture: false },
          priorite: 'P4',
          exploitees: 0,
          exploiteesSansCorrectif: 0,
          exploitables: 0,
          finDeSupport: 0,
          delai: { etat: 'close', echeance: null, enDepassement: 0 },
          correctif: { disponible: 0, aucun_connu: 0, non_renseigne: 0 },
          sourcesCorrectif: [],
        },
        cves: new Set(),
        machines: new Set(),
        echeances: [],
      };
      groupes.set(k, g);
    }
    const d = g.dto;
    d.failles++;
    for (const c of f.cves) g.cves.add(c);
    for (const m of f.machinesLisibles) g.machines.add(m);
    if (f.horsLecture) d.machines.horsLecture = true;
    if (NIVEAUX_PRIORITE.indexOf(f.priorite) < NIVEAUX_PRIORITE.indexOf(d.priorite)) d.priorite = f.priorite;
    if (f.exploitee) {
      d.exploitees++;
      if (f.correctif.etat === 'aucun_connu') d.exploiteesSansCorrectif++;
    } else if (f.exploitable) d.exploitables++;
    if (f.finDeSupport) d.finDeSupport++;
    if (RANG_DELAI(f.delai.etat) < RANG_DELAI(d.delai.etat)) d.delai.etat = f.delai.etat;
    if (f.delai.etat === 'en_depassement') d.delai.enDepassement++;
    if (
      f.delai.echeance &&
      (f.delai.etat === 'en_depassement' || f.delai.etat === 'echeance_proche' || f.delai.etat === 'dans_les_delais')
    )
      if (!d.delai.echeance || Date.parse(f.delai.echeance) < Date.parse(d.delai.echeance))
        d.delai.echeance = f.delai.echeance;
    d.correctif[f.correctif.etat]++;
    for (const s of f.correctif.sources) if (!d.sourcesCorrectif.includes(s.source)) d.sourcesCorrectif.push(s.source);
  }
  const out = [...groupes.values()].map((g) => {
    g.dto.cves = g.cves.size;
    g.dto.machines.lisibles = g.machines.size;
    g.dto.sourcesCorrectif = SOURCES_CORRECTIF.filter((s) => g.dto.sourcesCorrectif.includes(s));
    return g.dto;
  });
  return out.sort(comparerCorrectifs);
}

/** Tri par gain, le même pour tout le monde : le groupe sans correctif en dernier ; puis priorité la plus haute, nombre de
    failles corrigées (décroissant), failles exploitées, CVE corrigées, texte de la solution, clé. */
export function comparerCorrectifs(
  a: Pick<CorrectifDto, 'solution' | 'priorite' | 'failles' | 'exploitees' | 'cves' | 'cle'>,
  b: Pick<CorrectifDto, 'solution' | 'priorite' | 'failles' | 'exploitees' | 'cves' | 'cle'>,
): number {
  const texte = (x: string | null) => x ?? '';
  return (
    Number(a.solution === null) - Number(b.solution === null) ||
    NIVEAUX_PRIORITE.indexOf(a.priorite) - NIVEAUX_PRIORITE.indexOf(b.priorite) ||
    b.failles - a.failles ||
    b.exploitees - a.exploitees ||
    b.cves - a.cves ||
    (texte(a.solution) < texte(b.solution) ? -1 : texte(a.solution) > texte(b.solution) ? 1 : 0) ||
    (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0)
  );
}

/** En-tête de la vue : « 12 mises à jour à faire pour 400 failles ». */
export function enteteCorrectifs(miseAJour: number, failles: number): string {
  const m = `${miseAJour.toLocaleString('fr-FR')} mise${miseAJour > 1 ? 's' : ''} à jour à faire`;
  return `${m} pour ${failles.toLocaleString('fr-FR')} faille${failles > 1 ? 's' : ''}`;
}

/* ------------------------------------------------------------------ Routes */
/** Bornes : groupes rendus, failles et machines listées dans le détail d'un groupe ; les totaux sont toujours rendus. */
export const CORRECTIFS_BORNES = { groupes: 500, failles: 500, machines: 250 } as const;

export const RechercheCorrectifs = z
  .object({
    q: z.string().trim().max(100).optional(),
    priorite: z.enum(NIVEAUX_PRIORITE).optional(),
  })
  .strict();
export type RechercheCorrectifs = z.infer<typeof RechercheCorrectifs>;

export interface CorrectifsDto {
  /** Mises à jour (groupes qui ont une solution) et failles qu'elles corrigent : les mêmes nombres pour tout le monde. */
  misesAJour: number;
  failles: number;
  /** Groupe « Sans correctif indiqué par la source » : nombre de failles. */
  sansCorrectif: number;
  /** Groupes, dans l'ordre du gain (bornés à CORRECTIFS_BORNES.groupes ; `total` toujours rendu). */
  groupes: CorrectifDto[];
  total: number;
  tronquee: boolean;
  calculeLe: string;
}

/** Une faille du groupe, dans le détail : sans nom de machine. `lisible` : la personne lit au moins une de ses machines
    (la fiche existante s'ouvre alors) ; sinon, seul son contrôle est montré, comme dans la vue d'ensemble. */
export interface FailleCorrectifDto {
  id: string;
  plugin: string;
  nom: string;
  priorite: NiveauPriorite;
  exploitee: boolean;
  exploitable: boolean;
  correctif: EtatCorrectifDto;
  situation: SituationExploitation | null;
  finSupportLe: string | null;
  finDeSupport: boolean;
  delai: DelaiFailleDto;
  cves: number;
  lisible: boolean;
}

export interface MachineCorrectifDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: RoleMachine | null;
  perimetreNom: string | null;
  finDeSupport: boolean;
}

export interface CorrectifDetailDto {
  groupe: CorrectifDto;
  failles: FailleCorrectifDto[];
  faillesTronquees: boolean;
  /** Machines concernées que la personne lit (bornées), dans l'ordre du nom. */
  machines: MachineCorrectifDto[];
  machinesTronquees: boolean;
}
