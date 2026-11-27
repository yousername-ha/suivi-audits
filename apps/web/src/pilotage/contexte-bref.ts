/* « Le contexte en bref » (Périmètre et contexte, décision du RSSI du 27/11/2026) : trois chiffres calculés à partir des
   API existantes, jamais inventés. Parties intéressées : fiches du registre (natives et existantes) et, parmi elles,
   celles dont la dernière revue est absente ou date de plus de 365 jours (même repère que le filtre « Dernière revue » de
   l'onglet Parties intéressées). SWOT par processus : analyses du registre, et processus du périmètre (cartes des
   processus) sans aucune analyse rattachée. PESTEL : enjeux externes (classés ou non) et, parmi eux, ceux du facteur
   « legal » de la nomenclature (réglementaires). Une tuile reste vide (null) tant qu'une de ses données manque. */
import type { CarteProcessus, GrcObject, VuePestel } from '@suivi/shared';
import { revuePartie } from './PartiesInteresseesStudio';

/** Identifiant du facteur PESTEL des enjeux légaux et réglementaires (nomenclature par défaut, PESTEL_PAR_DEFAUT). */
export const FACTEUR_REGLEMENTAIRE = 'legal';

export interface ChiffresContexte {
  parties: { total: number; aRevoir: number } | null;
  swot: { analyses: number; processus: number; processusSansAnalyse: number } | null;
  /** `reglementaires` : null quand la nomenclature du périmètre n'a pas de facteur « legal ». */
  pestel: { enjeux: number; reglementaires: number | null; libelleReglementaire: string; nonClasses: number } | null;
}

export function chiffresContexte(e: {
  /** Toutes les fiches de parties intéressées lisibles (toutes les pages, natives puis existantes). */
  parties?: readonly GrcObject[];
  aujourdhui: string;
  /** Nombre d'analyses SWOT du registre (totaux des listes natives et existantes). */
  analysesSwot?: number;
  processus?: readonly CarteProcessus[];
  pestel?: VuePestel;
}): ChiffresContexte {
  const facteurLegal = e.pestel?.parFacteur.find((g) => g.facteur.id === FACTEUR_REGLEMENTAIRE);
  return {
    parties: e.parties
      ? { total: e.parties.length, aRevoir: e.parties.filter((p) => revuePartie(p, e.aujourdhui)).length }
      : null,
    swot:
      e.analysesSwot !== undefined && e.processus
        ? {
            analyses: e.analysesSwot,
            processus: e.processus.length,
            // `null` : nature non lisible, jamais comptée comme une absence d'analyse.
            processusSansAnalyse: e.processus.filter((p) => p.rattaches.swots?.length === 0).length,
          }
        : null,
    pestel: e.pestel
      ? {
          enjeux: e.pestel.parFacteur.reduce((n, g) => n + g.enjeux.length, 0) + e.pestel.nonClasses.length,
          reglementaires: facteurLegal ? facteurLegal.enjeux.length : null,
          libelleReglementaire: facteurLegal?.facteur.label ?? '',
          nonClasses: e.pestel.nonClasses.length,
        }
      : null,
  };
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Ligne de détail de chaque tuile, en clair. */
export function detailsContexte(c: ChiffresContexte) {
  return {
    parties: !c.parties
      ? 'Chiffre indisponible'
      : c.parties.total === 0
        ? 'Aucune partie enregistrée'
        : c.parties.aRevoir === 0
          ? 'Toutes revues depuis moins d’un an'
          : `${c.parties.aRevoir} à revoir (revue absente ou de plus d’un an)`,
    swot: !c.swot
      ? 'Chiffre indisponible'
      : c.swot.processus === 0
        ? 'Aucun processus dans ce périmètre'
        : c.swot.processusSansAnalyse === 0
          ? 'Chaque processus a son analyse'
          : `${c.swot.processusSansAnalyse} processus sans analyse`,
    pestel: !c.pestel
      ? 'Chiffre indisponible'
      : c.pestel.reglementaires === null
        ? pluriel(c.pestel.nonClasses, 'non classé', 'non classés')
        : c.pestel.reglementaires === 0
          ? `dont aucun réglementaire (${c.pestel.libelleReglementaire})`
          : `dont ${pluriel(c.pestel.reglementaires, 'réglementaire', 'réglementaires')} (${c.pestel.libelleReglementaire})`,
  };
}
