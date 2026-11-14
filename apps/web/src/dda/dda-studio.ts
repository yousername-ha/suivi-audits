/* Présentation « Studio » de la déclaration d'applicabilité (refonte Neon, lot 4, ADR 0093) : teintes, filtres comptés et
   géométrie des graphiques, calculés à partir des statistiques partagées existantes (statsDda), sans nouveau calcul
   métier ni score de certification. */
import { NIVEAUX_DDA, type FiltreDda, type StatsDda } from '@suivi/shared';

export type TonDda = 'total' | 'partiel' | 'insuffisant' | 'inconnu';

/** Teinte d'un niveau de mise en œuvre : vert, orange, rouge, neutre si non renseigné ou inconnu. */
export function tonNiveau(niveau: string): TonDda {
  return niveau === 'Total'
    ? 'total'
    : niveau === 'Partiel'
      ? 'partiel'
      : niveau === 'Insuffisant'
        ? 'insuffisant'
        : 'inconnu';
}

/** Teinte de l'applicabilité : Oui vert, Non rouge, à déterminer neutre. */
export function tonApplicable(app: string): TonDda {
  return app === 'oui' ? 'total' : app === 'non' ? 'insuffisant' : 'inconnu';
}

/** Libellé de l'applicabilité dans les repères de la fiche. */
export function libelleApplicable(app: string, obligatoire: boolean): string {
  if (obligatoire) return 'Obligatoire';
  return app === 'oui' ? 'Oui' : app === 'non' ? 'Non' : 'À déterminer';
}

export interface FiltreCompte {
  value: FiltreDda;
  label: string;
  nombre: number;
}
/** Filtres du registre, dans l'ordre et avec les libellés existants, chacun avec son nombre de mesures. */
export function filtresDda(st: StatsDda, incoherentes: number): FiltreCompte[] {
  return [
    { value: 'all', label: 'Toutes', nombre: st.total },
    ...NIVEAUX_DDA.map((n) => ({ value: n, label: n, nombre: st.c[n] })),
    { value: 'none', label: 'Non renseignées', nombre: st.c[''] },
    { value: 'na', label: 'Exclues', nombre: st.na },
    { value: 'inc', label: 'Total avec écart ouvert', nombre: incoherentes },
  ];
}

export interface NiveauSynthese {
  label: string;
  valeur: number;
  ton: TonDda;
}
/** Répartition des mesures applicables par niveau (mêmes comptes que la barre de répartition existante). */
export function niveauxSynthese(st: StatsDda): NiveauSynthese[] {
  return [
    { label: 'Total', valeur: st.c.Total, ton: 'total' },
    { label: 'Partiel', valeur: st.c.Partiel, ton: 'partiel' },
    { label: 'Insuffisant', valeur: st.c.Insuffisant, ton: 'insuffisant' },
    { label: 'Non renseigné', valeur: st.c[''], ton: 'inconnu' },
  ];
}

/** Arcs de l'anneau (longueur de tracé normalisée à 100) : part et décalage de chaque niveau ; rien à tracer sans mesure
    applicable (pas d'anneau plein trompeur). */
export function arcsAnneau(niveaux: readonly NiveauSynthese[], applicables: number) {
  let cumul = 0;
  return niveaux.map((n) => {
    const part = applicables > 0 ? (n.valeur / applicables) * 100 : 0;
    const arc = { ton: n.ton, part, decalage: -cumul };
    cumul += part;
    return arc;
  });
}

/** Largeur d'une barre horizontale (0 à 100), relative au plus grand effectif ; 0 pour un effectif nul. */
export function largeurBarre(valeur: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(100, (valeur / maximum) * 100)) : 0;
}
