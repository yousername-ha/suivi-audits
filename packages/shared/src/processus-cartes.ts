/* Page « Processus » en cartes (Organisation) : un processus, ce qui lui est rattaché (objectifs, indicateurs, SWOT, risques,
   fournisseurs) et les éléments qu'on peut encore lui rattacher. Lecture agrégée côté serveur : les rattachements vivent
   dans les données d'origine (objectifs de l'outil de suivi, liens transverses), jamais dans une copie. */
import type { TypeProcessusDto } from './types-processus.js';

export const NATURES_RATTACHEMENT = ['objectifs', 'indicateurs', 'swots', 'risques', 'fournisseurs'] as const;
export type NatureRattachement = (typeof NATURES_RATTACHEMENT)[number];
export const LIBELLES_RATTACHEMENT: Record<NatureRattachement, string> = {
  objectifs: 'Objectifs',
  indicateurs: 'Indicateurs',
  swots: 'SWOT',
  risques: 'Risques',
  fournisseurs: 'Fournisseurs',
};
/** Relation transverse (catalogue des liens) utilisée pour rattacher chaque nature à un processus. */
export const RELATION_RATTACHEMENT: Record<Exclude<NatureRattachement, 'objectifs'>, string> = {
  indicateurs: 'demonstrates',
  swots: 'impacts',
  risques: 'impacts',
  fournisseurs: 'supports',
};

export interface Rattache {
  ref: string;
  id: string;
  name: string;
  /** Origine du rattachement : lien transverse (retirable), champ de la fiche d'origine ou objectif du processus. */
  via: 'lien' | 'fiche' | 'objectif';
  /** Identifiant du lien à supprimer pour détacher (absent : se détache dans la fiche d'origine). */
  lienId: string | null;
}
export interface Candidat {
  ref: string;
  id: string;
  name: string;
}
export interface CarteProcessus {
  id: string;
  ref: string;
  name: string;
  owner: string;
  /** Code du type du registre (peut désigner un type archivé ou inconnu). */
  family: string;
  /** Identifiant du processus parent (vide : processus de premier niveau). */
  parent: string;
  purpose: string;
  rattaches: Record<NatureRattachement, Rattache[] | null>;
}
export interface ProcessusCartes {
  types: TypeProcessusDto[];
  processus: CarteProcessus[];
  /** Éléments rattachables par nature ; null : pas le droit de lire ce module. */
  candidats: Record<NatureRattachement, Candidat[] | null>;
}
