/* Périmètre et contexte en dossier (dessin validé par le RSSI le 27/11/2026) : calculs purs de la présentation. Les cinq
   rubriques sont les champs de la fiche de contexte (PILOTAGE_FIELDS.context), dans leur ordre ; une rubrique ne compte
   comme renseignée que si son texte contient autre chose que des blancs. Rien n'est réécrit : la fiche reste celle du
   registre, modifiée par sa fenêtre habituelle. */
import { PILOTAGE_FIELDS, jourParis, type GrcObject } from '@suivi/shared';
import { dateConnue } from './categories-contexte';
import type { VueFiche } from './RecordEditor';

/** Ce que l'on attend d'une rubrique encore vide (clauses 4.1 et 4.3 de l'ISO/IEC 27001). */
export const AIDES_RUBRIQUES: Record<string, string> = {
  organisation:
    'Décrivez l’organisation : sa structure, ses sites, sa gouvernance et qui porte la sécurité de l’information.',
  scope: 'Indiquez les activités, entités, sites et services couverts par le SMSI (clause 4.3).',
  interfaces:
    'Listez les échanges avec l’extérieur et les services dont vous dépendez : prestataires, hébergeurs, partenaires (clause 4.3).',
  issues:
    'Notez les enjeux internes et externes qui pèsent sur la sécurité de l’information : organisation, réglementation, menaces (clause 4.1).',
  exclusions:
    'Rien d’exclu pour l’instant. Indiquez les activités hors du périmètre et pourquoi : l’auditeur le demandera (clause 4.3).',
};

export interface RubriqueContexte {
  cle: string;
  libelle: string;
  /** Texte saisi, tel quel (lignes conservées). */
  texte: string;
  renseignee: boolean;
  aide: string;
  /** Rubrique vide seule sur la dernière ligne de la grille à deux colonnes : elle en prend toute la largeur. */
  etendue: boolean;
}

/** Les cinq rubriques d'une fiche de contexte, dans l'ordre du formulaire. */
export function rubriquesContexte(data: Record<string, unknown>): RubriqueContexte[] {
  const champs = PILOTAGE_FIELDS.context ?? [];
  return champs.map((champ, index) => {
    const valeur = data[champ.key];
    const texte = typeof valeur === 'string' ? valeur : '';
    const renseignee = texte.trim() !== '';
    const seuleSurSaLigne = index === champs.length - 1 && champs.length % 2 === 1;
    return {
      cle: champ.key,
      libelle: champ.label,
      texte,
      renseignee,
      aide: AIDES_RUBRIQUES[champ.key] ?? 'Rubrique à compléter.',
      etendue: seuleSurSaLigne && !renseignee,
    };
  });
}

/** Complétude de la fiche : rubriques renseignées sur le nombre de rubriques. */
export function completudeContexte(data: Record<string, unknown>) {
  const rubriques = rubriquesContexte(data);
  return { renseignees: rubriques.filter((r) => r.renseignee).length, total: rubriques.length };
}

/** Texte accessible de l'anneau : « 4 rubriques renseignées sur 5 ». */
export function libelleCompletude(renseignees: number, total: number) {
  return `${renseignees} rubrique${renseignees > 1 ? 's' : ''} renseignée${renseignees > 1 ? 's' : ''} sur ${total}`;
}

/** Longueur de l'arc de l'anneau (cercle de rayon `rayon`) et circonférence, pour stroke-dasharray. */
export function arcCompletude(renseignees: number, total: number, rayon: number) {
  const circonference = 2 * Math.PI * rayon;
  const part = total > 0 ? Math.min(Math.max(renseignees / total, 0), 1) : 0;
  return { arc: +(circonference * part).toFixed(1), circonference: +circonference.toFixed(1) };
}

export const APERCU_LIGNES = 6;
export const APERCU_CARACTERES = 420;

/** Aperçu d'un texte long dans sa case : au plus six lignes et 420 caractères, coupé à la fin d'un mot, suivi de « … ».
    Les retours à la ligne sont conservés. `tronque` indique qu'une partie du texte n'est pas montrée. */
export function apercuTexte(texte: string, lignes = APERCU_LIGNES, caracteres = APERCU_CARACTERES) {
  const propre = texte.replace(/\s+$/, '');
  const toutes = propre.split(/\r?\n/);
  let apercu = toutes.slice(0, lignes).join('\n');
  let tronque = toutes.length > lignes;
  if (apercu.length > caracteres) {
    const coupe = apercu.slice(0, caracteres);
    const espace = coupe.search(/\s\S*$/);
    apercu = espace > caracteres / 2 ? coupe.slice(0, espace) : coupe;
    tronque = true;
  }
  return { texte: tronque ? apercu.replace(/[\s,;:.–-]+$/, '') + '…' : propre, tronque };
}

/** Fiche affichée : celle choisie si elle est encore dans la liste, sinon la première. */
export function ficheAffichee(fiches: GrcObject[], choisie: string | null): GrcObject | undefined {
  return fiches.find((f) => f.id === choisie) ?? fiches[0];
}

/** « Mis à jour le JJ/MM/AAAA » (jour civil de Paris), ou null quand la date n'est pas connue (fiche reprise sans date). */
export function dateMiseAJour(updatedAt: string | null | undefined): string | null {
  const connue = dateConnue(updatedAt);
  return connue ? jourParis(new Date(connue)).split('-').reverse().join('/') : null;
}

/** Commandes de l'en-tête du dossier (décisions du RSSI du 28/11/2026) : « Historique de la fiche » ouvre la fiche sur
    son onglet Historique (versions) ; avec une seule fiche, « Ajouter une fiche de contexte » est rangé dans le menu « ⋯ »
    (Autres actions) ; avec plusieurs, il reste un bouton à côté du choix de la fiche ; sans fiche, « Décrire le
    contexte » reste visible. Sans le droit de modifier : aucun ajout, et le bouton principal devient « Afficher la
    fiche », qui ouvre la fiche sans édition (ouverture habituelle, présentation en lecture seule). */
export function commandesDossier(writable: boolean, nombreFiches: number) {
  const historique: VueFiche = { onglet: 'history' };
  return {
    historique,
    principal: writable ? 'Modifier la fiche' : 'Afficher la fiche',
    decrire: writable && nombreFiches === 0,
    ajoutDansMenu: writable && nombreFiches === 1,
    ajoutBouton: writable && nombreFiches > 1,
  };
}
