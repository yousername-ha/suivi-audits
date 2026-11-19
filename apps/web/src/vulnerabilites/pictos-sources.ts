/* Pictogrammes de source (ADR 0100, lot L1) : présentation sans état ni appel réseau (testée à part). Une pastille par source
   de la veille (catalogue KEV de la CISA, NVD, EPSS, CERT-FR, CERT Santé) et par connecteur (Tenable, AlgoLightHouse),
   dessinée pour la charte : monogramme court, forme et teinte propres à chaque source. Aucun logo officiel ni image de marque.
   La distinction ne repose jamais sur la couleur seule : le monogramme se lit, la forme diffère, le nom complet est le nom
   accessible et l'info-bulle. */
import type {
  FicheFailleDto,
  SourceExploitable,
  SourceExploitation,
  SourceValeur,
  SourceVecteur,
  SourceVeille,
} from '@suivi/shared';

export const SOURCES_PICTO = ['cisa-kev', 'nvd', 'epss', 'cert-fr', 'cert-sante', 'tenable', 'algolighthouse'] as const;
export type SourcePicto = (typeof SOURCES_PICTO)[number];

/** Formes des pastilles (dessinées dans une boîte de 44 × 24). */
export type FormePicto = 'bouclier' | 'rectangle' | 'pilule' | 'fanion' | 'octogone' | 'parallelogramme' | 'hexagone';
/** Teintes de la charte (jetons --carte-*-accent et --carte-*-doux, clair et sombre). */
export type TeintePicto = 'rouge' | 'marine' | 'orange' | 'bleu' | 'vert' | 'violet' | 'gris';

export interface DefinitionPicto {
  /** Monogramme dessiné dans la pastille (trois ou quatre caractères au plus). */
  sigle: string;
  /** Nom court, affiché à côté de la pastille quand la place le permet. */
  court: string;
  /** Nom complet : nom accessible (« Source : … ») et info-bulle. */
  nom: string;
  forme: FormePicto;
  teinte: TeintePicto;
}

export const PICTOS_SOURCES: Record<SourcePicto, DefinitionPicto> = {
  'cisa-kev': {
    sigle: 'KEV',
    court: 'KEV (CISA)',
    nom: 'catalogue KEV de la CISA',
    forme: 'bouclier',
    teinte: 'rouge',
  },
  nvd: { sigle: 'NVD', court: 'NVD', nom: 'NVD (NIST)', forme: 'rectangle', teinte: 'marine' },
  epss: { sigle: 'EPSS', court: 'EPSS', nom: 'EPSS (FIRST)', forme: 'pilule', teinte: 'orange' },
  'cert-fr': { sigle: 'FR', court: 'CERT-FR', nom: 'CERT-FR (ANSSI)', forme: 'fanion', teinte: 'bleu' },
  'cert-sante': { sigle: 'CS', court: 'CERT Santé', nom: 'CERT Santé', forme: 'octogone', teinte: 'vert' },
  tenable: { sigle: 'TEN', court: 'Tenable', nom: 'Tenable', forme: 'parallelogramme', teinte: 'violet' },
  algolighthouse: {
    sigle: 'ALH',
    court: 'AlgoLightHouse',
    nom: 'AlgoLightHouse',
    forme: 'hexagone',
    teinte: 'gris',
  },
};

/** Tracés des formes, dans une boîte de 44 × 24 (marge d'un demi-trait). */
export const TRACES_FORMES: Record<FormePicto, string> = {
  bouclier: 'M2 1.5h40v9c0 6.5-9 11.5-20 12C11 22 2 17 2 10.5z',
  rectangle: 'M3 1.5h38a1.5 1.5 0 0 1 1.5 1.5v18a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 21V3A1.5 1.5 0 0 1 3 1.5z',
  pilule: 'M12 1.5h20a10.5 10.5 0 0 1 0 21H12a10.5 10.5 0 0 1 0-21z',
  fanion: 'M1.5 1.5h41l-6 10.5 6 10.5h-41z',
  octogone: 'M7.5 1.5h29l6 6v9l-6 6h-29l-6-6v-9z',
  parallelogramme: 'M8.5 1.5h34l-7 21h-34z',
  hexagone: 'M8 1.5h28l6.5 10.5L36 22.5H8L1.5 12z',
};

/** Nom accessible d'une pastille. */
export const nomPicto = (s: SourcePicto) => `Source : ${PICTOS_SOURCES[s].nom}`;

/** Source d'une exploitation avérée (catalogue KEV, alerte du CERT-FR, fiche du CERT Santé, AlgoLightHouse). */
export const PICTO_EXPLOITATION: Record<SourceExploitation, SourcePicto> = {
  kev: 'cisa-kev',
  'cert-fr': 'cert-fr',
  'cert-sante': 'cert-sante',
  alh: 'algolighthouse',
};
/** Source de « exploitable » (Tenable, CERT Santé, AlgoLightHouse). */
export const PICTO_EXPLOITABLE: Record<SourceExploitable, SourcePicto> = {
  tenable: 'tenable',
  'cert-sante': 'cert-sante',
  alh: 'algolighthouse',
};
/** Source d'une gravité ou d'un score (le score EPSS est publié par FIRST). */
export const PICTO_VALEUR: Record<SourceValeur, SourcePicto> = {
  nvd: 'nvd',
  tenable: 'tenable',
  'cert-sante': 'cert-sante',
  first: 'epss',
  alh: 'algolighthouse',
};
export const PICTO_VECTEUR: Record<SourceVecteur, SourcePicto> = { nvd: 'nvd', tenable: 'tenable' };
/** Les sources de la veille portent déjà l'identifiant de leur pastille. */
export const pictoVeille = (s: SourceVeille): SourcePicto => s;

/** Liste sans doublon, dans l'ordre fixe des pastilles (lecture stable d'une ligne à l'autre). */
export function sansDoublon(liste: readonly SourcePicto[]): SourcePicto[] {
  const vues = new Set(liste);
  return SOURCES_PICTO.filter((s) => vues.has(s));
}

/** Sources dont la fiche illustrée d'une faille reprend quelque chose : origine (constat de Tenable, alerte
    d'AlgoLightHouse), faits de la priorité, vecteurs publiés, correctif et recommandations. Rien n'est ajouté qui ne soit
    déjà dans la fiche. */
export function sourcesFiche(f: FicheFailleDto): SourcePicto[] {
  const s: SourcePicto[] = [];
  if (f.nature === 'constat') s.push('tenable');
  if (f.nature === 'alerte-alh') s.push('algolighthouse');
  for (const fait of f.priorite?.faits ?? []) {
    if (fait.fait === 'exploitation') s.push(...fait.sources.map((x) => PICTO_EXPLOITATION[x]));
    if (fait.fait === 'exploit_disponible') s.push(...fait.sources.map((x) => PICTO_EXPLOITABLE[x]));
    if (fait.fait === 'epss') s.push('epss');
  }
  s.push(...f.vecteurs.map((v) => PICTO_VECTEUR[v.source]));
  s.push(...f.correctif.sources.map((c) => c.source));
  const r = f.recommandations;
  if (r.tenable) s.push('tenable');
  if (r.kev.length) s.push('cisa-kev');
  if (r.versionsNvd.length) s.push('nvd');
  if (r.certSante) s.push('cert-sante');
  s.push(...r.avis.map((a) => a.source));
  if (r.alh.length) s.push('algolighthouse');
  return sansDoublon(s);
}

/** Sources d'une exploitation avérée, dans l'ordre des pastilles. */
export const pictosExploitation = (liste: readonly { source: SourceExploitation }[]): SourcePicto[] =>
  sansDoublon(liste.map((x) => PICTO_EXPLOITATION[x.source]));
