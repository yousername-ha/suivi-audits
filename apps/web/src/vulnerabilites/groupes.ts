/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026, maquettes validées le même jour) :
   groupes de machines, côté interface. Fonctions pures : adresses des routes, options du menu « Groupe » (tous, chaque
   groupe avec son nombre de machines lues, « Sans groupe »), mention du fournisseur (« maintenu par … »), état des cases à
   cocher de la fenêtre d'un groupe (membres d'origine, ajouts et retraits en cours), lots d'enregistrement bornés, et
   présentation par défaut de l'écran « Machines » (« Parc »). Le serveur reste seul juge des droits et des machines lues. */
import {
  FILTRE_SANS_GROUPE,
  type FournisseurGroupe,
  type GroupeMachines,
  GROUPES_MACHINES_BORNES,
  LIBELLE_FOURNISSEUR_SUPPRIME,
  LIBELLE_SANS_GROUPE,
  type MachineGroupe,
  VUE_MACHINES_DEFAUT,
  VUES_MACHINES,
  type VueMachines,
} from '@suivi/shared';

/** Clé de la liste des groupes (`GET /api/vulnerabilites/groupes`) ; les lectures d'un groupe la prolongent. */
export const CLE_GROUPES = ['vulnerabilites', 'groupes'] as const;
export const URL_GROUPES = '/api/vulnerabilites/groupes';
/** Page des fournisseurs (Pilotage) ; `?fiche=<id>` y ouvre la fiche d'un fournisseur (adresse directe ajoutée par la
    session Coeur ; ignorée tant qu'elle n'est pas en place, le lien mène alors au registre). */
export const PAGE_FOURNISSEURS = '/pilotage/fournisseurs';
export const lienFicheFournisseur = (id: string) => `${PAGE_FOURNISSEURS}?fiche=${encodeURIComponent(id)}`;

/** Présentation de l'écran « Machines » : la préférence mémorisée si elle est connue, sinon « Parc ». */
export const vueMachines = (memorisee: unknown): VueMachines =>
  (VUES_MACHINES as readonly unknown[]).includes(memorisee) ? (memorisee as VueMachines) : VUE_MACHINES_DEFAUT;

export const urlGroupe = (id: string) => `${URL_GROUPES}/${encodeURIComponent(id)}`;
export function urlMachinesGroupe(id: string, f: { q?: string; membres?: 'oui' | 'non' | '' }, page = 1): string {
  const p = new URLSearchParams();
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.membres) p.set('membres', f.membres);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `${urlGroupe(id)}/machines${s ? `?${s}` : ''}`;
}

/** Nombre de machines lues, en clair. */
export const nombreMachines = (n: number) => `${n} machine${n > 1 ? 's' : ''}`;

/** Options du menu « Groupe » : chaque groupe avec son nombre de machines lues, puis « Sans groupe ». « Tous les groupes »
    est l'absence de choix (texte indicatif du menu, valeur effaçable). */
export const TOUS_LES_GROUPES = 'Tous les groupes';
export function optionsFiltreGroupe(groupes: GroupeMachines[]): { value: string; label: string }[] {
  return [
    ...groupes.map((g) => ({ value: g.id, label: `${g.nom} (${g.machinesLues})` })),
    { value: FILTRE_SANS_GROUPE, label: LIBELLE_SANS_GROUPE },
  ];
}

/** Mention du fournisseur d'un groupe : « maintenu par <nom> », avec un lien vers les fournisseurs pour qui les lit ;
    « fournisseur supprimé », sans lien. */
export function mentionFournisseur(
  f: FournisseurGroupe | null,
  lireFournisseurs: boolean,
): { texte: string; nom: string | null; lien: string | null } | null {
  if (!f) return null;
  if (f.etat === 'supprime' || f.nom === null) return { texte: LIBELLE_FOURNISSEUR_SUPPRIME, nom: null, lien: null };
  return { texte: 'maintenu par', nom: f.nom, lien: lireFournisseurs ? lienFicheFournisseur(f.id) : null };
}

/** « aussi dans « X » » (ou « aussi dans « X » et « Y » ») ; rien si la machine n'est dans aucun autre groupe. */
export function mentionAutresGroupes(m: Pick<MachineGroupe, 'autresGroupes'>): string | null {
  const noms = m.autresGroupes.map((g) => `« ${g.nom} »`);
  if (!noms.length) return null;
  return `aussi dans ${noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`}`;
}

/* ------------------------------------------------------------------ Cases à cocher de la fenêtre d'un groupe */
/** Changements en cours : machines à ajouter et à retirer, par rapport aux membres enregistrés. */
export interface ChangementsMembres {
  ajouter: ReadonlySet<string>;
  retirer: ReadonlySet<string>;
}
export const AUCUN_CHANGEMENT: ChangementsMembres = { ajouter: new Set(), retirer: new Set() };

/** Case cochée : membre enregistré non retiré, ou machine ajoutée. */
export const estCochee = (m: Pick<MachineGroupe, 'id' | 'membre'>, c: ChangementsMembres) =>
  c.ajouter.has(m.id) || (m.membre && !c.retirer.has(m.id));

/** Cocher ou décocher une machine affichée (son état enregistré est connu). */
export function basculer(m: Pick<MachineGroupe, 'id' | 'membre'>, cochee: boolean, c: ChangementsMembres) {
  const ajouter = new Set(c.ajouter);
  const retirer = new Set(c.retirer);
  ajouter.delete(m.id);
  retirer.delete(m.id);
  if (cochee && !m.membre) ajouter.add(m.id);
  if (!cochee && m.membre) retirer.add(m.id);
  return { ajouter, retirer };
}

/** « Tout cocher (n trouvées) » : toutes les machines trouvées par la recherche, au-delà de la page affichée. Une machine
    déjà membre ajoutée de nouveau ne change rien côté serveur. */
export function toutCocher(identifiants: readonly string[], c: ChangementsMembres): ChangementsMembres {
  const ajouter = new Set(c.ajouter);
  const retirer = new Set(c.retirer);
  for (const id of identifiants) {
    retirer.delete(id);
    ajouter.add(id);
  }
  return { ajouter, retirer };
}

export const aDesChangements = (c: ChangementsMembres) => c.ajouter.size + c.retirer.size > 0;

/** Lots d'enregistrement, GROUPES_MACHINES_BORNES.lot machines au plus chacun (retraits d'abord, puis ajouts). */
export function lotsMembres(c: ChangementsMembres): { ajouter: string[]; retirer: string[] }[] {
  const tout: { id: string; ajout: boolean }[] = [
    ...[...c.retirer].map((id) => ({ id, ajout: false })),
    ...[...c.ajouter].map((id) => ({ id, ajout: true })),
  ];
  const lots: { ajouter: string[]; retirer: string[] }[] = [];
  for (let i = 0; i < tout.length; i += GROUPES_MACHINES_BORNES.lot) {
    const tranche = tout.slice(i, i + GROUPES_MACHINES_BORNES.lot);
    lots.push({
      ajouter: tranche.filter((x) => x.ajout).map((x) => x.id),
      retirer: tranche.filter((x) => !x.ajout).map((x) => x.id),
    });
  }
  return lots;
}

/** Libellé de « Tout cocher » : « Tout cocher (n trouvées) ». */
export const libelleToutCocher = (n: number) => `Tout cocher (${n} trouvée${n > 1 ? 's' : ''})`;
