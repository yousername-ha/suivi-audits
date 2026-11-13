/* Poivre des mots de passe (ADR 0072) : logique pure de l'écran de saisie, testée sans navigateur. Les règles viennent du paquet
   partagé, les mêmes que celles du serveur ; l'interface ne fait que les afficher en direct. */
import {
  entropiePoivre,
  finCorrespond,
  problemesPoivre,
  type ContextePoivre,
  type PoivreAEnregistrer,
} from '@suivi/shared';

export interface SaisiePoivre {
  mode: 'genere' | 'saisi';
  /** Poivre généré (forme affichée) ou saisi. */
  valeur: string;
  /** Case « J'ai enregistré ce poivre dans le coffre-fort de l'organisation ». */
  coffre: boolean;
  /** Nouvelle saisie des 8 derniers caractères. */
  fin: string;
}

export interface BilanPoivre {
  /** Un message par critère non respecté (poivre saisi). */
  problemes: string[];
  entropie: number;
  finOk: boolean;
  /** Corps à envoyer, ou null tant que tout n'est pas satisfait. */
  pret: PoivreAEnregistrer | null;
}

export function bilanPoivre(s: SaisiePoivre, ctx: Omit<ContextePoivre, 'mode'> = {}): BilanPoivre {
  const problemes = s.valeur ? problemesPoivre(s.valeur, { ...ctx, mode: s.mode }) : [];
  const finOk = s.valeur !== '' && finCorrespond(s.valeur, s.fin);
  const pret =
    s.valeur !== '' && problemes.length === 0 && s.coffre && finOk
      ? { mode: s.mode, valeur: s.valeur, engagement: { coffre: true as const, fin: s.fin } }
      : null;
  return { problemes, entropie: s.valeur ? Math.round(entropiePoivre(s.valeur)) : 0, finOk, pret };
}
