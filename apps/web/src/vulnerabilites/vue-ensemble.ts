/* Module Vulnérabilités (ADR 0100, lot PC1) : « Vue d'ensemble » (poste de commandement), présentation sans état ni appel
   réseau (testée à part) : adresse de la route, liens des tuiles, filtres du tableau « Cibles par priorité », fiche ouverte
   par un point, lignes du journal, état des capteurs. Le serveur reste seul juge des droits ; aucun nom de machine, de
   domaine, d'adresse ni de périmètre n'arrive ici. */
import {
  type CibleVueDto,
  type EntreeJournalVueDto,
  type EtatSurfaceExterneDto,
  type EtatSynchronisationDto,
  type NiveauAlerteGlobal,
  type NiveauPriorite,
  NIVEAUX_PRIORITE,
  SECTEUR_RADAR_LIBELLES,
  type SecteurRadar,
} from '@suivi/shared';
import { etatConnecteur as etatConnecteurCommun } from '../integrations/etat-integration';
import { libelleSource } from './veille-presentation';

export const CLE_VUE = ['vulnerabilites', 'vue-ensemble'] as const;
export const URL_VUE = '/api/vulnerabilites/vue-ensemble';
/** Adresse de l'écran (premier onglet du module). */
export const ADRESSE_VUE = '/vulnerabilites/vue';

/* ------------------------------------------------------------------ Liens des tuiles */
export const LIENS_TUILES = {
  /** Failles exploitées et présentes : alertes critiques en cours (une alerte critique = une faille présente en P1). */
  exploitees: '/vulnerabilites/alertes?niveau=critique',
  p1: '/vulnerabilites/failles?priorite=P1',
  p2: '/vulnerabilites/failles?priorite=P2',
  /** Produits à confirmer : registre des produits surveillés, où se décident les rapprochements proposés. */
  aConfirmer: '/vulnerabilites/produits',
  corrigees: '/vulnerabilites/failles?etat=corrigee',
  /** Lot S1 : failles en dépassement de leur délai de correction, la plus en retard d'abord. */
  depassement: '/vulnerabilites/failles?delai=en_depassement&tri=echeance',
  /** Lot S3 : constats en fin de support, et vue par correctif. */
  finSupport: '/vulnerabilites/failles?finSupport=oui',
  correctifs: '/vulnerabilites/failles?vue=correctifs',
  tout: '/vulnerabilites/failles',
} as const;

/** Teinte (classe) d'un niveau d'alerte et d'une priorité : le texte porte toujours le sens, la teinte le double. */
export const TEINTE_NIVEAU: Record<NiveauAlerteGlobal, 'vert' | 'bleu' | 'orange' | 'rouge'> = {
  1: 'vert',
  2: 'bleu',
  3: 'orange',
  4: 'rouge',
};
export const TEINTE_PRIORITE: Record<NiveauPriorite, 'rouge' | 'orange' | 'bleu' | 'gris'> = {
  P1: 'rouge',
  P2: 'orange',
  P3: 'bleu',
  P4: 'gris',
};
/** Deux chiffres au moins, comme sur la maquette (« 07 »). */
export const deuxChiffres = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ Tableau « Cibles par priorité » */
export const FILTRES_CIBLES = ['toutes', 'exploitees', 'detectees', 'a_confirmer'] as const;
export type FiltreCibles = (typeof FILTRES_CIBLES)[number];
export const FILTRE_CIBLES_LIBELLES: Record<FiltreCibles, string> = {
  toutes: 'Toutes',
  exploitees: 'Exploitées',
  detectees: 'Détectées',
  a_confirmer: 'À confirmer',
};
/** Case du radar choisie par une pastille (secteur et anneau). */
export interface CaseChoisie {
  secteur: SecteurRadar;
  niveau: NiveauPriorite;
}
export const CIBLES_PAR_PAGE = 10;

export function filtrerCibles(
  cibles: readonly CibleVueDto[],
  filtre: FiltreCibles,
  caseChoisie: CaseChoisie | null,
): CibleVueDto[] {
  return cibles.filter(
    (c) =>
      (!caseChoisie || (c.secteur === caseChoisie.secteur && c.priorite.niveau === caseChoisie.niveau)) &&
      (filtre === 'toutes' ||
        (filtre === 'exploitees' && c.exploitee) ||
        (filtre === 'detectees' && c.presences.includes('detectee')) ||
        (filtre === 'a_confirmer' && c.presences.includes('a_confirmer'))),
  );
}
export const libelleCase = (c: CaseChoisie) => `${c.niveau} · secteur ${SECTEUR_RADAR_LIBELLES[c.secteur]}`;

/** Ce qu'ouvre un point ou une ligne : la fiche existante d'un constat ou d'une faille déclarée que la personne lit ; à
    défaut, la veille cherchée sur la CVE ; sans CVE ni fiche lisible, rien. */
export type OuvertureCible =
  { type: 'fiche'; nature: 'constat' | 'declaree'; id: string } | { type: 'lien'; to: string } | null;
export function ouvertureCible(c: Pick<CibleVueDto, 'fiche' | 'cve'>): OuvertureCible {
  if (c.fiche) return { type: 'fiche', nature: c.fiche.nature, id: c.fiche.id };
  if (c.cve) return { type: 'lien', to: `/vulnerabilites/veille?q=${encodeURIComponent(c.cve)}` };
  return null;
}

/** Puces « Faits » d'une cible : texte et teinte (le texte porte le sens). */
export function faitsCible(
  c: CibleVueDto,
): { libelle: string; teinte: 'rouge' | 'orange' | 'violet' | 'bleu' | 'gris' }[] {
  const out: { libelle: string; teinte: 'rouge' | 'orange' | 'violet' | 'bleu' | 'gris' }[] = [];
  if (c.exploitee) out.push({ libelle: 'Exploitation avérée', teinte: 'rouge' });
  else if (c.exploitable) out.push({ libelle: 'Exploitable', teinte: 'orange' });
  if (c.presences.includes('detectee')) out.push({ libelle: 'Détectée par Tenable', teinte: 'violet' });
  if (c.presences.includes('declaree')) out.push({ libelle: 'Déclarée', teinte: 'violet' });
  if (c.presences.includes('exposee')) out.push({ libelle: 'Exposée sur Internet', teinte: 'rouge' });
  if (c.presences.includes('a_confirmer')) out.push({ libelle: 'Produit à confirmer', teinte: 'bleu' });
  if (c.gravite)
    out.push({
      libelle: `Gravité ${{ critique: 'critique', elevee: 'élevée', moyenne: 'moyenne', faible: 'faible' }[c.gravite]}`,
      teinte: c.gravite === 'critique' ? 'rouge' : c.gravite === 'elevee' ? 'orange' : 'gris',
    });
  return out;
}

/* ------------------------------------------------------------------ Journal */
const heure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const nombre = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const ISSUE: Record<'recu' | 'echec' | 'expire', string> = { recu: 'reçue', echec: 'en échec', expire: 'expirée' };

/** Ligne du journal : heure, étiquette (source, connecteur, alerte), texte et teinte. */
export function ligneJournal(e: EntreeJournalVueDto): {
  heure: string;
  etiquette: string;
  texte: string;
  teinte: 'rouge' | 'orange' | 'bleu' | 'violet' | 'vert';
} {
  switch (e.nature) {
    case 'collecte':
      return {
        heure: heure(e.le),
        etiquette: libelleSource(e.source),
        texte:
          e.etat === 'recu'
            ? `collecte reçue : ${nombre(e.elements, 'élément', 'éléments')}`
            : `collecte ${ISSUE[e.etat]}`,
        teinte: e.etat === 'recu' ? 'bleu' : 'orange',
      };
    case 'synchronisation':
      return {
        heure: heure(e.le),
        etiquette: e.connecteur === 'tenable' ? 'Tenable' : 'AlgoLightHouse',
        texte:
          e.etat === 'recu'
            ? `« ${e.nom} » synchronisé${e.elements !== null ? ` : ${nombre(e.elements, 'élément reçu', 'éléments reçus')}` : ''}${e.complete === false ? ' (incomplète)' : ''}`
            : `« ${e.nom} » : synchronisation ${ISSUE[e.etat]}`,
        teinte: e.etat === 'recu' ? 'violet' : 'orange',
      };
    case 'alerte_ouverte':
      return {
        heure: heure(e.le),
        etiquette: e.niveau === 'critique' ? 'Alerte critique' : 'Alerte',
        texte: `${e.cve ?? 'constat de Tenable sans CVE'} : alerte ouverte`,
        teinte: e.niveau === 'critique' ? 'rouge' : 'orange',
      };
    case 'alerte_close':
      return {
        heure: heure(e.le),
        etiquette: 'Alerte close',
        texte: `${e.cve ?? 'constat de Tenable sans CVE'} : alerte ${e.niveau === 'critique' ? 'critique ' : ''}close`,
        teinte: 'vert',
      };
  }
}

/* ------------------------------------------------------------------ Capteurs : connecteurs */
/** État d'un connecteur (Tenable, AlgoLightHouse) et heure de la dernière synchronisation réussie : règle commune aux outils
    qui exploitent une intégration (integrations/etat-integration.ts). */
export const etatConnecteur = (c: EtatSynchronisationDto | EtatSurfaceExterneDto) => etatConnecteurCommun(c);

/** Totaux par secteur, dans l'ordre du radar. */
export function totauxSecteurs(
  cases: readonly { secteur: SecteurRadar; priorite: NiveauPriorite; total: number }[],
  secteurs: readonly SecteurRadar[],
) {
  return secteurs.map((s) => ({
    secteur: s,
    libelle: SECTEUR_RADAR_LIBELLES[s],
    total: cases.filter((c) => c.secteur === s).reduce((n, c) => n + c.total, 0),
    parPriorite: NIVEAUX_PRIORITE.map((p) => cases.find((c) => c.secteur === s && c.priorite === p)?.total ?? 0),
  }));
}
