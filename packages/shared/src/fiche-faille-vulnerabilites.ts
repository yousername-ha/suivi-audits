/* Module Vulnérabilités (ADR 0100, point 19 et décision V10 ; lot PC4) : fiche d'une faille illustrée. Une seule présentation,
   commune aux quatre fiches existantes (constat de Tenable, faille déclarée, CVE de la veille, alerte d'AlgoLightHouse) :
   - en tête : priorité et faits (les mêmes pour tous, lot ALH5), marques « zero-day » et « exploitable » (lot PC2), alerte
     ouverte de la plateforme (lot V6) ;
   - vecteur d'attaque CVSS (v3.0, v3.1 ou v4.0) traduit par une table fixe, une icône par métrique, phrase en clair, vecteur
     brut et sa version ; aucun appel au modèle, aucune traduction devinée : un vecteur inconnu ou mal formé est « non
     communiqué » ;
   - schéma du vecteur (de l'origine de l'attaque à ce qu'elle atteint), composé à partir du vecteur décodé et des faits de
     présence lus par la personne (aucun total global, drapeau sans nombre pour le reste) ;
   - recommandations par source, sans mélange : correctif de Tenable (anglais, tel quel), action exigée du catalogue KEV,
     versions touchées selon NVD, mentions du CERT Santé, avis du CERT-FR et du CERT Santé, recommandations de l'éditeur
     d'AlgoLightHouse ; toujours du texte. Rien n'est écrit par l'assistant.
   Fonctions pures, testées en table (packages/shared/test/fiche-faille-vulnerabilites.test.ts). */
import { z } from 'zod';
import type { NiveauAlerte } from './alertes-vulnerabilites.js';
import type { NiveauPriorite } from './failles-tenable.js';
import type { MentionCertSante, Priorite, SourcesFailleDto } from './priorite-vulnerabilites.js';
import type { DefautAlh } from './surface-externe.js';
import { CVE_ID } from './veille-vulnerabilites.js';

/* ------------------------------------------------------------------ Décodage du vecteur */
export type VersionCvss = '3.0' | '3.1' | '3' | '4.0';
export const VERSION_CVSS_LIBELLES: Record<VersionCvss, string> = {
  '3.0': 'CVSS v3.0',
  '3.1': 'CVSS v3.1',
  '3': 'CVSS v3 (version mineure non précisée par la source)',
  '4.0': 'CVSS v4.0',
};

export type Impact = 'H' | 'L' | 'N';
export interface ImpactsCvss {
  c: Impact;
  i: Impact;
  a: Impact;
}

/** Métriques de base d'un vecteur CVSS, telles que publiées (lettres de la spécification de FIRST). */
export interface VecteurCvss {
  version: VersionCvss;
  /** Vecteur brut, tel que la source le publie. */
  brut: string;
  /** AV : N réseau, A réseau adjacent, L local, P physique. */
  acces: 'N' | 'A' | 'L' | 'P';
  /** AC : L faible, H élevée. */
  complexite: 'L' | 'H';
  /** AT (v4.0 seulement) : N aucune, P présentes. */
  conditions: 'N' | 'P' | null;
  /** PR : N aucun, L faibles, H élevés. */
  privileges: 'N' | 'L' | 'H';
  /** UI : N aucune ; v3 : R requise ; v4.0 : P passive, A active. */
  interaction: 'N' | 'R' | 'P' | 'A';
  /** S (v3 seulement) : U inchangée, C modifiée. */
  portee: 'U' | 'C' | null;
  /** C, I, A (v3) ou VC, VI, VA (v4.0) : système vulnérable. */
  impacts: ImpactsCvss;
  /** SC, SI, SA (v4.0 seulement) : systèmes en aval. */
  impactsAval: ImpactsCvss | null;
}

const IMPACT = ['H', 'L', 'N'];
/** Valeurs admises de chaque métrique, CVSS v3.x (base, temporelles, environnementales). */
const METRIQUES_V3: Record<string, readonly string[]> = {
  AV: ['N', 'A', 'L', 'P'],
  AC: ['L', 'H'],
  PR: ['N', 'L', 'H'],
  UI: ['N', 'R'],
  S: ['U', 'C'],
  C: IMPACT,
  I: IMPACT,
  A: IMPACT,
  E: ['X', 'U', 'P', 'F', 'H'],
  RL: ['X', 'O', 'T', 'W', 'U'],
  RC: ['X', 'U', 'R', 'C'],
  CR: ['X', 'L', 'M', 'H'],
  IR: ['X', 'L', 'M', 'H'],
  AR: ['X', 'L', 'M', 'H'],
  MAV: ['X', 'N', 'A', 'L', 'P'],
  MAC: ['X', 'L', 'H'],
  MPR: ['X', 'N', 'L', 'H'],
  MUI: ['X', 'N', 'R'],
  MS: ['X', 'U', 'C'],
  MC: ['X', 'N', 'L', 'H'],
  MI: ['X', 'N', 'L', 'H'],
  MA: ['X', 'N', 'L', 'H'],
};
const BASE_V3 = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];
/** Valeurs admises de chaque métrique, CVSS v4.0 (base, menace, environnementales, supplémentaires). */
const METRIQUES_V4: Record<string, readonly string[]> = {
  AV: ['N', 'A', 'L', 'P'],
  AC: ['L', 'H'],
  AT: ['N', 'P'],
  PR: ['N', 'L', 'H'],
  UI: ['N', 'P', 'A'],
  VC: IMPACT,
  VI: IMPACT,
  VA: IMPACT,
  SC: IMPACT,
  SI: IMPACT,
  SA: IMPACT,
  E: ['X', 'A', 'P', 'U'],
  CR: ['X', 'H', 'M', 'L'],
  IR: ['X', 'H', 'M', 'L'],
  AR: ['X', 'H', 'M', 'L'],
  MAV: ['X', 'N', 'A', 'L', 'P'],
  MAC: ['X', 'L', 'H'],
  MAT: ['X', 'N', 'P'],
  MPR: ['X', 'N', 'L', 'H'],
  MUI: ['X', 'N', 'P', 'A'],
  MVC: ['X', 'H', 'L', 'N'],
  MVI: ['X', 'H', 'L', 'N'],
  MVA: ['X', 'H', 'L', 'N'],
  MSC: ['X', 'H', 'L', 'N'],
  MSI: ['X', 'S', 'H', 'L', 'N'],
  MSA: ['X', 'S', 'H', 'L', 'N'],
  S: ['X', 'N', 'P'],
  AU: ['X', 'N', 'Y'],
  R: ['X', 'A', 'U', 'I'],
  V: ['X', 'D', 'C'],
  RE: ['X', 'L', 'M', 'H'],
  U: ['X', 'Clear', 'Green', 'Amber', 'Red'],
};
const BASE_V4 = ['AV', 'AC', 'AT', 'PR', 'UI', 'VC', 'VI', 'VA', 'SC', 'SI', 'SA'];
/** Longueur la plus grande d'un vecteur lu (les colonnes rangées sont bornées à 400 caractères). */
export const VECTEUR_CVSS_MAX = 400;

/** Décode un vecteur CVSS publié. Préfixe « CVSS:3.0/ », « CVSS:3.1/ » ou « CVSS:4.0/ » ; sans préfixe (forme rendue par
    Tenable pour son champ CVSS v3), le vecteur est lu comme un vecteur v3 si ses métriques de base sont celles de la v3.
    Toute métrique inconnue, en double, de valeur inconnue, ou toute métrique de base absente rend le vecteur illisible :
    `null`, jamais une traduction devinée (« vecteur non communiqué »). */
export function decoderVecteurCvss(brut: string | null | undefined): VecteurCvss | null {
  if (typeof brut !== 'string' || !brut || brut.length > VECTEUR_CVSS_MAX || brut !== brut.trim()) return null;
  const prefixe = /^CVSS:(3\.0|3\.1|4\.0)\//.exec(brut);
  const version: VersionCvss = prefixe ? (prefixe[1] as VersionCvss) : '3';
  const corps = prefixe ? brut.slice(prefixe[0].length) : brut;
  if (!corps) return null;
  const table = version === '4.0' ? METRIQUES_V4 : METRIQUES_V3;
  const base = version === '4.0' ? BASE_V4 : BASE_V3;
  const m = new Map<string, string>();
  for (const partie of corps.split('/')) {
    const x = /^([A-Z]{1,3}):([A-Za-z]{1,5})$/.exec(partie);
    if (!x) return null;
    const [, cle, valeur] = x as unknown as [string, string, string];
    if (m.has(cle) || !Object.hasOwn(table, cle) || !table[cle]!.includes(valeur)) return null;
    m.set(cle, valeur);
  }
  if (!base.every((b) => m.has(b))) return null;
  const v = (k: string) => m.get(k)!;
  if (version === '4.0')
    return {
      version,
      brut,
      acces: v('AV') as VecteurCvss['acces'],
      complexite: v('AC') as VecteurCvss['complexite'],
      conditions: v('AT') as 'N' | 'P',
      privileges: v('PR') as VecteurCvss['privileges'],
      interaction: v('UI') as VecteurCvss['interaction'],
      portee: null,
      impacts: { c: v('VC') as Impact, i: v('VI') as Impact, a: v('VA') as Impact },
      impactsAval: { c: v('SC') as Impact, i: v('SI') as Impact, a: v('SA') as Impact },
    };
  return {
    version,
    brut,
    acces: v('AV') as VecteurCvss['acces'],
    complexite: v('AC') as VecteurCvss['complexite'],
    conditions: null,
    privileges: v('PR') as VecteurCvss['privileges'],
    interaction: v('UI') as VecteurCvss['interaction'],
    portee: v('S') as 'U' | 'C',
    impacts: { c: v('C') as Impact, i: v('I') as Impact, a: v('A') as Impact },
    impactsAval: null,
  };
}

/* ------------------------------------------------------------------ Traduction, une icône par métrique */
/** Icônes de la fiche (dessinées par l'interface ; le texte porte toujours le sens). */
export type IconeMetrique =
  | 'reseau'
  | 'adjacent'
  | 'local'
  | 'physique'
  | 'simple'
  | 'complexe'
  | 'conditions'
  | 'sans-compte'
  | 'compte'
  | 'compte-admin'
  | 'sans-victime'
  | 'victime'
  | 'portee'
  | 'confidentialite'
  | 'integrite'
  | 'disponibilite'
  | 'composant';

/** Force d'une valeur pour l'attaquant : « fort » quand elle lui facilite la tâche ou que l'effet est élevé. Elle ne sert
    qu'à la teinte ; le texte dit toujours la valeur. */
export type ForceMetrique = 'fort' | 'moyen' | 'faible';

export interface MetriqueTraduite {
  /** Code de la métrique dans le vecteur (AV, AC, AT, PR, UI, S, C, I, A, VC…). */
  code: string;
  valeur: string;
  /** Terme technique exact, en français (nom de la métrique et de sa valeur dans la spécification de FIRST). */
  terme: string;
  /** Traduction en clair. */
  clair: string;
  icone: IconeMetrique;
  force: ForceMetrique;
}

const ACCES: Record<
  VecteurCvss['acces'],
  { terme: string; clair: string; icone: IconeMetrique; force: ForceMetrique }
> = {
  N: {
    terme: 'réseau',
    clair: 'Attaque possible à distance, par le réseau (Internet compris)',
    icone: 'reseau',
    force: 'fort',
  },
  A: {
    terme: 'réseau adjacent',
    clair: 'Attaque possible depuis un réseau adjacent (même réseau local ou même segment)',
    icone: 'adjacent',
    force: 'moyen',
  },
  L: {
    terme: 'local',
    clair: 'Accès local nécessaire (session ouverte sur la machine, ou fichier ouvert par une personne)',
    icone: 'local',
    force: 'faible',
  },
  P: {
    terme: 'physique',
    clair: 'Accès physique à la machine nécessaire',
    icone: 'physique',
    force: 'faible',
  },
};
const PRIVILEGES: Record<
  VecteurCvss['privileges'],
  { terme: string; clair: string; icone: IconeMetrique; force: ForceMetrique }
> = {
  N: { terme: 'aucun', clair: 'Aucun compte nécessaire', icone: 'sans-compte', force: 'fort' },
  L: { terme: 'faibles', clair: 'Compte ordinaire nécessaire', icone: 'compte', force: 'moyen' },
  H: {
    terme: 'élevés',
    clair: 'Compte à privilèges élevés nécessaire (administrateur)',
    icone: 'compte-admin',
    force: 'faible',
  },
};
const INTERACTION: Record<
  VecteurCvss['interaction'],
  { terme: string; clair: string; icone: IconeMetrique; force: ForceMetrique }
> = {
  N: { terme: 'aucune', clair: 'Sans action de la victime', icone: 'sans-victime', force: 'fort' },
  R: {
    terme: 'requise',
    clair: 'Une personne doit agir (clic, ouverture d’un fichier)',
    icone: 'victime',
    force: 'moyen',
  },
  P: {
    terme: 'passive',
    clair: 'Une personne doit agir de façon limitée, sans le vouloir (consulter une page, un message)',
    icone: 'victime',
    force: 'moyen',
  },
  A: {
    terme: 'active',
    clair: 'Une personne doit agir délibérément (clic, installation, acceptation d’un avertissement)',
    icone: 'victime',
    force: 'faible',
  },
};
const IMPACT_TERME: Record<Impact, string> = { H: 'élevé', L: 'faible', N: 'aucun' };
const IMPACT_FORCE: Record<Impact, ForceMetrique> = { H: 'fort', L: 'moyen', N: 'faible' };
const EFFETS: Record<'c' | 'i' | 'a', Record<Impact, string>> = {
  c: { H: 'Lecture de toutes les données', L: 'Lecture d’une partie des données', N: 'Aucune donnée lue' },
  i: {
    H: 'Modification de toutes les données',
    L: 'Modification d’une partie des données',
    N: 'Aucune donnée modifiée',
  },
  a: { H: 'Arrêt complet du service', L: 'Service ralenti ou en partie interrompu', N: 'Aucun effet sur le service' },
};
export const DIMENSIONS_IMPACT = ['c', 'i', 'a'] as const;
export const DIMENSION_LIBELLES: Record<'c' | 'i' | 'a', string> = {
  c: 'Confidentialité',
  i: 'Intégrité',
  a: 'Disponibilité',
};
const DIMENSION_TERMES: Record<'c' | 'i' | 'a', string> = {
  c: 'la confidentialité',
  i: 'l’intégrité',
  a: 'la disponibilité',
};
const ICONE_DIMENSION: Record<'c' | 'i' | 'a', IconeMetrique> = {
  c: 'confidentialite',
  i: 'integrite',
  a: 'disponibilite',
};

/** Conditions de l'attaque, dans l'ordre de la fiche : vecteur d'accès, complexité, conditions préalables (v4.0),
    privilèges requis, interaction de l'utilisateur, portée (v3). */
export function conditionsTraduites(v: VecteurCvss): MetriqueTraduite[] {
  const a = ACCES[v.acces];
  const p = PRIVILEGES[v.privileges];
  const u = INTERACTION[v.interaction];
  const liste: MetriqueTraduite[] = [
    {
      code: 'AV',
      valeur: v.acces,
      terme: `Vecteur d’accès : ${a.terme}`,
      clair: a.clair,
      icone: a.icone,
      force: a.force,
    },
    v.complexite === 'L'
      ? {
          code: 'AC',
          valeur: 'L',
          terme: 'Complexité de l’attaque : faible',
          clair: 'Simple à réaliser',
          icone: 'simple',
          force: 'fort',
        }
      : {
          code: 'AC',
          valeur: 'H',
          terme: 'Complexité de l’attaque : élevée',
          clair: 'Difficile : dépend de conditions que l’attaquant ne maîtrise pas',
          icone: 'complexe',
          force: 'faible',
        },
  ];
  if (v.conditions)
    liste.push(
      v.conditions === 'N'
        ? {
            code: 'AT',
            valeur: 'N',
            terme: 'Conditions préalables de l’attaque : aucune',
            clair: 'Aucune condition préalable du déploiement',
            icone: 'conditions',
            force: 'fort',
          }
        : {
            code: 'AT',
            valeur: 'P',
            terme: 'Conditions préalables de l’attaque : présentes',
            clair: 'Dépend d’une configuration ou d’un état particulier de la cible',
            icone: 'conditions',
            force: 'faible',
          },
    );
  liste.push(
    {
      code: 'PR',
      valeur: v.privileges,
      terme: `Privilèges requis : ${p.terme}`,
      clair: p.clair,
      icone: p.icone,
      force: p.force,
    },
    {
      code: 'UI',
      valeur: v.interaction,
      terme: `Interaction de l’utilisateur : ${u.terme}`,
      clair: u.clair,
      icone: u.icone,
      force: u.force,
    },
  );
  if (v.portee)
    liste.push(
      v.portee === 'U'
        ? {
            code: 'S',
            valeur: 'U',
            terme: 'Portée : inchangée',
            clair: 'L’effet reste dans le composant vulnérable',
            icone: 'portee',
            force: 'faible',
          }
        : {
            code: 'S',
            valeur: 'C',
            terme: 'Portée : modifiée',
            clair: 'L’effet déborde sur d’autres composants que le composant vulnérable',
            icone: 'portee',
            force: 'fort',
          },
    );
  return liste;
}

/** Effets sur la cible (C, I, A ; VC, VI, VA en v4.0), puis sur les systèmes en aval (SC, SI, SA, v4.0). */
export function impactsTraduits(v: VecteurCvss): { cible: MetriqueTraduite[]; aval: MetriqueTraduite[] } {
  const v4 = v.version === '4.0';
  const ligne = (d: 'c' | 'i' | 'a', x: Impact, aval: boolean): MetriqueTraduite => ({
    code: v4 ? `${aval ? 'S' : 'V'}${d.toUpperCase()}` : d.toUpperCase(),
    valeur: x,
    terme: v4
      ? `Impact sur ${DIMENSION_TERMES[d]} ${aval ? 'des systèmes en aval' : 'du système vulnérable'} : ${IMPACT_TERME[x]}`
      : `Impact sur ${DIMENSION_TERMES[d]} : ${IMPACT_TERME[x]}`,
    clair: EFFETS[d][x],
    icone: ICONE_DIMENSION[d],
    force: IMPACT_FORCE[x],
  });
  return {
    cible: DIMENSIONS_IMPACT.map((d) => ligne(d, v.impacts[d], false)),
    aval: v.impactsAval ? DIMENSIONS_IMPACT.map((d) => ligne(d, v.impactsAval![d], true)) : [],
  };
}

const ORIGINE_PHRASE: Record<VecteurCvss['acces'], string> = {
  N: 'à distance, par le réseau (Internet compris)',
  A: 'depuis un réseau adjacent',
  L: 'avec un accès local à la machine',
  P: 'avec un accès physique à la machine',
};
const COMPTE_PHRASE: Record<VecteurCvss['privileges'], string> = {
  N: 'sans compte',
  L: 'avec un compte ordinaire',
  H: 'avec un compte à privilèges élevés',
};
const VICTIME_PHRASE: Record<VecteurCvss['interaction'], string> = {
  N: 'sans action d’un utilisateur',
  R: 'si un utilisateur agit',
  P: 'si un utilisateur agit, même sans le vouloir',
  A: 'si un utilisateur agit délibérément',
};
const VERBES: Record<'c' | 'i' | 'a', Record<'H' | 'L', string>> = {
  c: { H: 'lire toutes les données', L: 'lire une partie des données' },
  i: { H: 'modifier toutes les données', L: 'modifier une partie des données' },
  a: { H: 'arrêter le service', L: 'ralentir ou interrompre en partie le service' },
};
const enumerer = (l: string[]) =>
  l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]!}`;
const effetsPhrase = (x: ImpactsCvss) =>
  DIMENSIONS_IMPACT.flatMap((d) => (x[d] === 'N' ? [] : [VERBES[d][x[d] as 'H' | 'L']]));

/** Phrase en clair composée par la plateforme à partir du vecteur (table fixe, jamais par le modèle). */
export function phraseVecteur(v: VecteurCvss): string {
  const difficulte = v.complexite === 'L' ? 'par une attaque simple' : 'par une attaque difficile à réaliser';
  const conditions = v.conditions === 'P' ? ', sous des conditions préalables propres à la cible' : '';
  const premiere = `Un attaquant peut agir ${ORIGINE_PHRASE[v.acces]}, ${COMPTE_PHRASE[v.privileges]} et ${VICTIME_PHRASE[v.interaction]}, ${difficulte}${conditions}.`;
  const cible = effetsPhrase(v.impacts);
  const sujet = v.version === '4.0' ? 'le système vulnérable' : 'le composant vulnérable';
  let effets = cible.length
    ? ` Sur ${sujet}, il peut ${enumerer(cible)}`
    : ` Aucun effet publié sur la confidentialité, l’intégrité ni la disponibilité du ${sujet.slice(3)}`;
  if (v.portee === 'C') effets += ', et l’effet déborde sur d’autres composants';
  effets += '.';
  if (v.impactsAval) {
    const aval = effetsPhrase(v.impactsAval);
    effets += aval.length
      ? ` Sur les systèmes en aval, il peut ${enumerer(aval)}.`
      : ' Aucun effet publié sur les systèmes en aval.';
  }
  return premiere + effets;
}

/* ------------------------------------------------------------------ Vecteurs publiés et règle des sources */
export const SOURCES_VECTEUR = ['nvd', 'tenable'] as const;
export type SourceVecteur = (typeof SOURCES_VECTEUR)[number];
export const SOURCE_VECTEUR_LIBELLES: Record<SourceVecteur, string> = { nvd: 'NVD', tenable: 'Tenable' };

/** Vecteur publié par une source pour la faille : NVD (par CVE, v3.1 et v4.0) ou Tenable (vecteur v3 du contrôle). */
export interface VecteurPublieDto {
  source: SourceVecteur;
  /** CVE du vecteur (NVD) ; null pour le vecteur du contrôle de Tenable. */
  cve: string | null;
  brut: string;
  /** Score de base publié avec ce vecteur (sur 10), s'il l'est. */
  score: number | null;
}

export interface VecteurRetenu {
  publie: VecteurPublieDto;
  decode: VecteurCvss;
}

/** Règle des sources (lot V4c, V27) appliquée au vecteur : parmi les vecteurs lisibles, celui dont le score est le plus
    sévère parle ; à score égal (ou sans score), NVD avant Tenable et, chez NVD, la v4.0 avant la v3.1. Les autres vecteurs
    lisibles sont rendus à part ; un vecteur illisible n'est jamais traduit et est seulement compté. */
export function vecteurRetenu(publies: readonly VecteurPublieDto[]): {
  retenu: VecteurRetenu | null;
  autres: VecteurRetenu[];
  illisibles: number;
} {
  const lisibles: VecteurRetenu[] = [];
  let illisibles = 0;
  for (const p of publies) {
    const d = decoderVecteurCvss(p.brut);
    if (d) lisibles.push({ publie: p, decode: d });
    else illisibles += 1;
  }
  const ordre = (x: VecteurRetenu) =>
    SOURCES_VECTEUR.indexOf(x.publie.source) * 10 + (x.decode.version === '4.0' ? 0 : 1);
  const score = (x: VecteurRetenu) =>
    x.publie.score !== null && Number.isFinite(x.publie.score) ? x.publie.score : -1;
  lisibles.sort(
    (a, b) =>
      score(b) - score(a) ||
      ordre(a) - ordre(b) ||
      (a.publie.cve ?? '').localeCompare(b.publie.cve ?? '') ||
      a.publie.brut.localeCompare(b.publie.brut),
  );
  return { retenu: lisibles[0] ?? null, autres: lisibles.slice(1), illisibles };
}

/** « Qui parle » : la source du vecteur retenu, sa version et la raison du choix. */
export function libelleSourceVecteur(r: VecteurRetenu, nombreLisibles: number): string {
  const qui = `${SOURCE_VECTEUR_LIBELLES[r.publie.source]}${r.publie.cve ? ` (${r.publie.cve})` : ''}, ${VERSION_CVSS_LIBELLES[r.decode.version]}`;
  const score = r.publie.score !== null ? `, score ${r.publie.score.toLocaleString('fr-FR')}` : '';
  const raison =
    nombreLisibles > 1 ? ' : le plus sévère des vecteurs publiés (règle des sources)' : ' : seul vecteur publié';
  return `Vecteur retenu : ${qui}${score}${raison}.`;
}

/* ------------------------------------------------------------------ Présence et schéma */
/** Faits de présence lus par la personne : machines et actifs exposés qu'elle lit ; `horsLecture` : la faille touche aussi
    des éléments qu'elle ne lit pas (drapeau sans nombre, lot ALH5). `machines` null : sans objet (alerte d'AlgoLightHouse). */
export interface PresenceFicheDto {
  machines: number | null;
  actifs: number;
  horsLecture: boolean;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Présence en clair, nombres lus seulement. */
export function libellePresence(p: PresenceFicheDto): string {
  const parts: string[] = [];
  if (p.machines !== null && p.machines > 0) parts.push(pluriel(p.machines, 'machine', 'machines'));
  if (p.actifs > 0) parts.push(pluriel(p.actifs, 'actif exposé', 'actifs exposés'));
  let t = parts.length ? `${parts.join(' et ')} que vous lisez` : 'Aucune machine ni aucun actif exposé que vous lisez';
  if (p.horsLecture) t += ' ; touche aussi des éléments que vous ne lisez pas';
  return t;
}

export interface EtapeSchema {
  /** Titre de l'étape (« D'où vient l'attaque »…). */
  titre: string;
  /** Libellé principal, toujours écrit sur le schéma. */
  libelle: string;
  /** Détail (codes du vecteur, nombres lus). */
  detail: string;
  force: ForceMetrique;
  icone: IconeMetrique;
}

export interface SchemaVecteur {
  origine: EtapeSchema;
  prerequis: EtapeSchema[];
  composant: EtapeSchema;
  effets: EtapeSchema[];
  /** Nom accessible du SVG : la même chose, en une phrase. */
  nom: string;
}

const ORIGINE_COURTE: Record<VecteurCvss['acces'], string> = {
  N: 'Internet ou tout réseau',
  A: 'Réseau adjacent',
  L: 'Accès local',
  P: 'Accès physique',
};
const PREREQUIS_COURT = {
  PR: { N: 'Aucun compte', L: 'Compte ordinaire', H: 'Compte à privilèges élevés' },
  UI: { N: 'Sans action d’une personne', R: 'Action d’une personne', P: 'Action passive', A: 'Action délibérée' },
  AC: { L: 'Attaque simple', H: 'Attaque difficile' },
  AT: { N: 'Sans condition préalable', P: 'Conditions préalables' },
} as const;

/** Schéma composé à partir du vecteur décodé et de la présence : origine → ce qu'il faut à l'attaquant → composant touché →
    ce qui est atteint. Libellé texte sur chaque étape. */
export function schemaVecteur(v: VecteurCvss, composant: string | null, p: PresenceFicheDto): SchemaVecteur {
  const conditions = conditionsTraduites(v);
  const force = (code: string) => conditions.find((c) => c.code === code)!.force;
  const icone = (code: string) => conditions.find((c) => c.code === code)!.icone;
  const prerequis: EtapeSchema[] = [
    {
      titre: 'Compte',
      libelle: PREREQUIS_COURT.PR[v.privileges],
      detail: `PR:${v.privileges}`,
      force: force('PR'),
      icone: icone('PR'),
    },
    {
      titre: 'Action d’une personne',
      libelle: PREREQUIS_COURT.UI[v.interaction],
      detail: `UI:${v.interaction}`,
      force: force('UI'),
      icone: icone('UI'),
    },
    {
      titre: 'Difficulté',
      libelle: PREREQUIS_COURT.AC[v.complexite],
      detail: `AC:${v.complexite}`,
      force: force('AC'),
      icone: icone('AC'),
    },
  ];
  if (v.conditions)
    prerequis.push({
      titre: 'Conditions',
      libelle: PREREQUIS_COURT.AT[v.conditions],
      detail: `AT:${v.conditions}`,
      force: force('AT'),
      icone: icone('AT'),
    });
  const { cible } = impactsTraduits(v);
  const effets = cible.map((m, i) => ({
    titre: DIMENSION_LIBELLES[DIMENSIONS_IMPACT[i]!],
    libelle: IMPACT_TERME[m.valeur as Impact],
    detail: `${m.code}:${m.valeur}`,
    force: m.force,
    icone: m.icone,
  }));
  const nomComposant = composant ?? 'Composant touché';
  const presence = libellePresence(p);
  const origine: EtapeSchema = {
    titre: 'D’où vient l’attaque',
    libelle: ORIGINE_COURTE[v.acces],
    detail: `AV:${v.acces}`,
    force: force('AV'),
    icone: icone('AV'),
  };
  const composantEtape: EtapeSchema = {
    titre: 'Composant touché',
    libelle: nomComposant,
    detail: presence,
    force: 'moyen',
    icone: 'composant',
  };
  const nom = `Schéma du vecteur d’attaque : attaque depuis ${ORIGINE_COURTE[v.acces].toLowerCase()} ; il faut à l’attaquant : ${prerequis
    .map((x) => x.libelle.toLowerCase())
    .join(
      ', ',
    )} ; composant touché : ${nomComposant} (${presence.charAt(0).toLowerCase()}${presence.slice(1)}) ; effet : ${effets
    .map((e) => `${e.titre.toLowerCase()} ${e.libelle}`)
    .join(', ')}.`;
  return { origine, prerequis, composant: composantEtape, effets, nom };
}

/* ------------------------------------------------------------------ Marques et en-tête */
/** Marques de la faille (définitions du lot PC2) : « zero-day » quand elle est présente et que son exploitation est avérée
    selon une source ; « exploitable » quand elle est présente, qu'une source dit qu'un code d'exploitation existe et
    qu'aucune exploitation n'est avérée. */
export function marquesFaille(
  s: Pick<SourcesFailleDto, 'exploitation' | 'exploitable'>,
  presente: boolean,
): { zeroDay: boolean; exploitable: boolean } {
  const zeroDay = presente && s.exploitation.length > 0;
  return { zeroDay, exploitable: presente && !zeroDay && s.exploitable.length > 0 };
}

/* ------------------------------------------------------------------ Recommandations par source */
/** Versions touchées selon NVD (configuration publiée) : bornes telles que publiées, jamais complétées. */
export interface VersionsNvdDto {
  cve: string;
  editeur: string;
  produit: string;
  version: string | null;
  debutInclus: string | null;
  debutExclus: string | null;
  finInclus: string | null;
  finExclus: string | null;
}

/** Plage de versions touchées en clair (texte, bornes de NVD). */
export function libelleVersionsNvd(v: VersionsNvdDto): string {
  const debut = v.debutInclus ? `à partir de ${v.debutInclus}` : v.debutExclus ? `après ${v.debutExclus}` : null;
  const fin = v.finExclus
    ? `avant ${v.finExclus} (${v.finExclus} n’est plus citée comme touchée)`
    : v.finInclus
      ? `jusqu’à ${v.finInclus} incluse`
      : null;
  const plage = [debut, fin].filter(Boolean).join(', ');
  return `${v.editeur} ${v.produit} : versions touchées ${plage || (v.version ? `: ${v.version}` : 'non précisées')}`;
}

export interface AvisFicheDto {
  source: 'cert-fr' | 'cert-sante';
  identifiant: string;
  nature: 'alerte' | 'avis';
  titre: string;
  adresse: string | null;
  le: string;
}

export interface RecommandationsFicheDto {
  /** Correctif indiqué par le contrôle de Tenable (anglais, tel quel) ; null hors d'un constat. */
  tenable: { correctif: string | null; publieLe: string | null } | null;
  /** Action exigée par le catalogue KEV de la CISA, par CVE (anglais, telle quelle). */
  kev: { cve: string; action: string; echeance: string | null }[];
  kevTronque: boolean;
  /** Versions touchées selon NVD (bornes publiées). */
  versionsNvd: VersionsNvdDto[];
  versionsNvdTronquees: boolean;
  /** Mentions de la fiche du CERT Santé (« un correctif existe », « une mesure de contournement existe »). */
  certSante: { correctif: MentionCertSante | null; contournement: MentionCertSante | null } | null;
  /** Alertes et avis du CERT-FR et du CERT Santé qui citent la faille : renvoi vers la source. */
  avis: AvisFicheDto[];
  avisTronques: boolean;
  /** Recommandations de l'éditeur d'AlgoLightHouse (défauts et résolutions) des alertes lisibles qui citent la faille. */
  alh: { alerteId: string; titre: string; defauts: DefautAlh[] }[];
  alhTronquees: boolean;
}

/** Bornes de la fiche (lectures fixes, aucune par élément). */
export const FICHE_FAILLE_BORNES = {
  cves: 200,
  vecteurs: 6,
  kev: 5,
  versionsNvd: 8,
  avis: 6,
  alertesAlh: 3,
  cvesAffichees: 5,
} as const;

/** La fiche commune d'une faille (route `GET /api/vulnerabilites/fiches/{nature}/{id}`). */
export interface FicheFailleDto {
  nature: NatureFicheFaille;
  /** Premières CVE de la faille et leur nombre. */
  cves: string[];
  nombreCves: number;
  /** Composant touché (produit du catalogue KEV, sinon de NVD, sinon nom du contrôle de Tenable ou du produit déclaré). */
  composant: string | null;
  /** Priorité calculée par la plateforme et faits qui la fondent, la même pour tous ; null pour une alerte d'AlgoLightHouse
      sans CVE. */
  priorite: Priorite | null;
  marques: { zeroDay: boolean; exploitable: boolean };
  /** Alerte ouverte de la plateforme (lot V6) sur cette faille, s'il y en a une. */
  alerte: { id: string; niveau: NiveauAlerte; priorite: NiveauPriorite } | null;
  presence: PresenceFicheDto;
  vecteurs: VecteurPublieDto[];
  recommandations: RecommandationsFicheDto;
}

export const NATURES_FICHE_FAILLE = ['constat', 'declaree', 'cve', 'alerte-alh'] as const;
export const NatureFicheFaille = z.enum(NATURES_FICHE_FAILLE);
export type NatureFicheFaille = z.infer<typeof NatureFicheFaille>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Paramètres de la route : identifiant interne (constat, faille déclarée, alerte) ou identifiant CVE (veille). */
export const ParamsFicheFaille = z
  .object({ nature: NatureFicheFaille, id: z.string().min(1).max(40) })
  .strict()
  .refine((p) => (p.nature === 'cve' ? CVE_ID.test(p.id) : UUID.test(p.id)), {
    message: 'Identifiant attendu : un identifiant CVE pour la veille, sinon un identifiant interne.',
    path: ['id'],
  });
export type ParamsFicheFaille = z.infer<typeof ParamsFicheFaille>;
