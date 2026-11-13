/* État du RETEX d'un incident, affiché dans le registre (chip et filtre) et dans l'onglet RETEX de la fiche. */
import { syntheseCollecte, type Incident } from '@suivi/shared';

export type CleEtatRetex = 'aucun' | 'saisie' | 'ouverte' | 'close';
export type TonEtatRetex = 'neutre' | 'attention' | 'succes';
export interface EtatRetexIncident {
  cle: CleEtatRetex;
  libelle: string;
  ton: TonEtatRetex;
  /** Propositions de contributeurs en attente de décision du pilote. */
  enAttente: number;
}
export const FILTRES_RETEX: { value: 'tous' | CleEtatRetex; label: string }[] = [
  { value: 'tous', label: 'Tous les RETEX' },
  { value: 'aucun', label: 'Pas de RETEX' },
  { value: 'saisie', label: 'Saisie seule' },
  { value: 'ouverte', label: 'Collecte ouverte' },
  { value: 'close', label: 'Collecte close' },
];

/** Pas de RETEX (ni chronologie ni collecte), saisie seule (chronologie sans collecte), collecte ouverte ou close. */
export function etatRetexIncident(i: Pick<Incident, 'collecte' | 'timeline'>): EtatRetexIncident {
  const c = i.collecte;
  const enAttente = syntheseCollecte(c).enAttente;
  if (!c)
    return i.timeline.length
      ? { cle: 'saisie', libelle: 'Saisie seule', ton: 'neutre', enAttente }
      : { cle: 'aucun', libelle: 'Pas de RETEX', ton: 'neutre', enAttente };
  if (c.statut === 'cloturee')
    return { cle: 'close', libelle: c.diffusee ? 'Close · diffusée' : 'Collecte close', ton: 'succes', enAttente };
  return { cle: 'ouverte', libelle: 'Collecte ouverte', ton: 'attention', enAttente };
}
