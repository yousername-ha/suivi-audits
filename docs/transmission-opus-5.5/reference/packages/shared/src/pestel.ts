/* PESTEL (ISO 9001:2015, 4.1) : présentation facultative des enjeux EXTERNES. La norme ne cite pas le PESTEL ; sa note 2
   donne comme aide l'environnement juridique, technologique, concurrentiel, commercial, culturel, social et économique.
   Les facteurs « politique » et « environnemental » vont donc au-delà de cette note. Les facteurs forment une nomenclature
   de l'organisme (politique métier, `catalogues.pestelFactors`) ; ceux-ci sont proposés tant qu'elle n'en définit pas. */
export const PESTEL_PAR_DEFAUT = [
  { id: 'politique', label: 'Politique' },
  { id: 'economique', label: 'Économique' },
  { id: 'social', label: 'Social' },
  { id: 'technologique', label: 'Technologique' },
  { id: 'environnemental', label: 'Environnemental' },
  { id: 'legal', label: 'Légal' },
] as const;
export interface FacteurPestel {
  id: string;
  label: string;
}
export interface EnjeuPestel {
  ref: string;
  label: string;
  /** Nature de l'enjeu (déduite ou corrigée sur la carte de contexte). Seuls les enjeux externes se classent. */
  nature: 'ext' | 'int';
  description: string;
  processus: string[];
  facteur: string | null;
}
export interface VuePestel {
  facteurs: FacteurPestel[];
  /** Enjeux externes par facteur (dans l'ordre des facteurs). */
  parFacteur: { facteur: FacteurPestel; enjeux: EnjeuPestel[] }[];
  nonClasses: EnjeuPestel[];
  /** Enjeux internes : hors PESTEL (note 3 de 4.1 : valeurs, culture, connaissances, performance). */
  internes: EnjeuPestel[];
}

/** Regroupe les enjeux par facteur. Un enjeu dont le facteur n'existe plus dans la nomenclature redevient non classé. */
export function regrouperPestel(enjeux: EnjeuPestel[], facteurs: readonly FacteurPestel[]): VuePestel {
  const ids = new Set(facteurs.map((f) => f.id));
  const externes = enjeux.filter((e) => e.nature === 'ext');
  const classe = (e: EnjeuPestel) => (e.facteur && ids.has(e.facteur) ? e.facteur : null);
  return {
    facteurs: [...facteurs],
    parFacteur: facteurs.map((f) => ({ facteur: f, enjeux: externes.filter((e) => classe(e) === f.id) })),
    nonClasses: externes.filter((e) => !classe(e)),
    internes: enjeux.filter((e) => e.nature === 'int'),
  };
}

/** Séries récurrentes proposées par le cadrage 9001 (§ 4.7) : tirées du texte de la norme, jamais planifiées d'office et
    sans fréquence (la norme fixe des « intervalles planifiés » sans en donner la valeur). */
export interface SerieProposee {
  id: string;
  titre: string;
  article: string;
  description: string;
}
export const SERIES_PROPOSEES: readonly SerieProposee[] = [
  {
    id: 'audits',
    titre: 'Programme d’audits internes',
    article: '9.2.1',
    description: 'Auditer le système de management à des intervalles planifiés.',
  },
  {
    id: 'revue-direction',
    titre: 'Revue de direction',
    article: '9.3.1',
    description: 'Revoir le système de management à des intervalles planifiés.',
  },
  {
    id: 'contexte',
    titre: 'Revue des enjeux et des parties intéressées',
    article: '4.1, 4.2',
    description: 'Surveiller et revoir les enjeux externes et internes et les exigences des parties intéressées.',
  },
  {
    id: 'indicateurs',
    titre: 'Surveillance, mesure et analyse des indicateurs',
    article: '9.1.1',
    description: 'Mesurer les indicateurs et analyser les résultats aux moments déterminés.',
  },
  {
    id: 'prestataires',
    titre: 'Réévaluation des prestataires externes',
    article: '8.4.1',
    description: 'Réévaluer les prestataires externes selon les critères déterminés.',
  },
  {
    id: 'etalonnage',
    titre: 'Étalonnage ou vérification des équipements de mesure',
    article: '7.1.5.2',
    description: 'Étalonner ou vérifier les équipements de mesure à intervalles spécifiés.',
  },
  {
    id: 'risques',
    titre: 'Revue des risques et des opportunités',
    article: '6.1',
    description: 'Revoir les risques et opportunités et l’efficacité des actions menées.',
  },
  {
    id: 'efficacite',
    titre: 'Vérification de l’efficacité des actions correctives',
    article: '10.2.1',
    description: 'Vérifier l’efficacité des actions correctives mises en œuvre.',
  },
];

/** Chiffres clés des parties intéressées (ISO 9001:2015, 4.2 ; vue « Parties intéressées » de l'outil de suivi). */
export function syntheseParties(
  parties: { addressed?: unknown; reviewed?: unknown }[],
  aujourdhui: string,
): { total: number; traitees: number; partielles: number; nonRevues: number } {
  const limite = new Date(new Date(aujourdhui + 'T00:00:00Z').getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const revue = (p: { reviewed?: unknown }) => (typeof p.reviewed === 'string' ? p.reviewed.slice(0, 10) : '');
  return {
    total: parties.length,
    traitees: parties.filter((p) => p.addressed === 'Oui').length,
    partielles: parties.filter((p) => p.addressed === 'Partiel' || p.addressed === 'Non').length,
    nonRevues: parties.filter((p) => !revue(p) || revue(p) < limite).length,
  };
}
