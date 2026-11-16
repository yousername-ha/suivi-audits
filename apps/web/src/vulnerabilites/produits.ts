/* Produits surveillés (ADR 0100, lot V1) : présentation et formulaire, sans état ni appel réseau (testés à part). Le serveur
   reste seul juge des droits, des doublons et des versions. Lot V4a : version obligatoire, suggestion d'identifiant CPE,
   rapprochements de la fiche regroupés par statut, motifs et plages en clair. */
import {
  CRITICITE_PRODUIT_LIBELLES,
  MOTIF_PROPOSITION_LIBELLES,
  type PlageVersions,
  type RapprochementDto,
  type StatutRapprochement,
  VERSION_DANS_PLAGE_LIBELLES,
  FAMILLE_PRODUIT_LIBELLES,
  FAMILLES_PRODUIT,
  ORIGINE_PRODUIT_LIBELLES,
  type CriticiteProduit,
  type FamilleProduit,
  type ProduitSurveilleBody,
  type ProduitSurveilleDto,
  type ProduitSurveillePatch,
  type ResponsableRef,
  type ResponsablesProposables,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export const TOUTES_FAMILLES = 'toutes';
export type FiltreFamille = FamilleProduit | typeof TOUTES_FAMILLES;

/** Choix du filtre : toutes les familles, puis chaque famille dans l'ordre de la liste fermée. */
export const OPTIONS_FILTRE_FAMILLE = [
  { value: TOUTES_FAMILLES, label: 'Toutes les familles' },
  ...FAMILLES_PRODUIT.map((f) => ({ value: f, label: FAMILLE_PRODUIT_LIBELLES[f] })),
];

/** Adresse de la liste, avec le filtre par famille appliqué par le serveur. */
export const urlProduits = (filtre: FiltreFamille) =>
  filtre === TOUTES_FAMILLES ? '/api/vulnerabilites/produits' : `/api/vulnerabilites/produits?famille=${filtre}`;

/** Sens de la puce de criticité (couleurs de la charte). */
export const ETAT_CRITICITE: Record<CriticiteProduit, Etat> = {
  faible: 'neutre',
  moyenne: 'attention',
  elevee: 'erreur',
};

export const libelleFamille = (f: FamilleProduit) => FAMILLE_PRODUIT_LIBELLES[f];
export const libelleCriticite = (c: CriticiteProduit) => CRITICITE_PRODUIT_LIBELLES[c];
export const libelleOrigine = (p: Pick<ProduitSurveilleDto, 'origine'>) => ORIGINE_PRODUIT_LIBELLES[p.origine];

/** Responsable affiché : libellé, sinon mention de la cible disparue, sinon « Sans responsable ». */
export const libelleResponsable = (p: Pick<ProduitSurveilleDto, 'responsable' | 'responsableLibelle'>) =>
  p.responsable ? (p.responsableLibelle ?? 'Responsable introuvable') : 'Sans responsable';

/** Valeur d'une liste de choix pour un responsable (« type:identifiant »). */
export const valeurResponsable = (r: ResponsableRef | null) => (r ? `${r.type}:${r.id}` : null);
export function responsableDepuisValeur(v: string | null): ResponsableRef | null {
  if (!v) return null;
  const i = v.indexOf(':');
  const type = v.slice(0, i);
  if (type !== 'utilisateur' && type !== 'groupe' && type !== 'fonction') return null;
  return { type, id: v.slice(i + 1) };
}

/** Annuaire présenté en trois groupes (personnes, groupes, fonctions) ; les groupes vides sont omis. */
export function optionsResponsables(a: ResponsablesProposables | undefined) {
  if (!a) return [];
  const groupes = [
    {
      group: 'Personnes',
      items: a.utilisateurs.map((u) => ({
        value: `utilisateur:${u.id}`,
        label: u.displayName ? `${u.displayName} (${u.username})` : u.username,
      })),
    },
    { group: 'Groupes', items: a.groupes.map((g) => ({ value: `groupe:${g.id}`, label: g.name })) },
    { group: 'Fonctions', items: a.fonctions.map((f) => ({ value: `fonction:${f.id}`, label: f.name })) },
  ];
  return groupes.filter((g) => g.items.length > 0);
}

/** Formulaire : textes bruts, listes en valeurs de choix (`null` : rien de choisi). */
export interface FormulaireProduit {
  fournisseurId: string | null;
  editeur: string;
  nom: string;
  versionProduit: string;
  cpe: string;
  famille: FamilleProduit | null;
  criticite: CriticiteProduit | null;
  responsable: string | null;
}

export const formulaireDepuis = (p: ProduitSurveilleDto | null): FormulaireProduit => ({
  fournisseurId: p?.fournisseurId ?? null,
  editeur: p?.editeur ?? '',
  nom: p?.nom ?? '',
  versionProduit: p?.versionProduit ?? '',
  cpe: p?.cpe ?? '',
  famille: p?.famille ?? null,
  criticite: p?.criticite ?? null,
  responsable: valeurResponsable(p?.responsable ?? null),
});

/** Champs manquants qui empêchent l'envoi (le serveur contrôle aussi). */
export function champsManquants(f: FormulaireProduit): string[] {
  const manque: string[] = [];
  if (!f.editeur.trim()) manque.push('éditeur');
  if (!f.nom.trim()) manque.push('nom du produit');
  if (!f.versionProduit.trim()) manque.push('version');
  if (!f.famille) manque.push('famille');
  if (!f.criticite) manque.push('criticité');
  return manque;
}

/** Corps de création. À n'appeler qu'une fois `champsManquants` vide. */
export function corpsCreation(f: FormulaireProduit): ProduitSurveilleBody {
  return {
    fournisseurId: f.fournisseurId,
    editeur: f.editeur.trim(),
    nom: f.nom.trim(),
    versionProduit: f.versionProduit.trim(),
    cpe: f.cpe.trim() || null,
    famille: f.famille!,
    criticite: f.criticite!,
    responsable: responsableDepuisValeur(f.responsable),
  };
}

/** Modification : seuls les champs changés sont envoyés (vide : rien à enregistrer). */
export function corpsModification(avant: ProduitSurveilleDto, f: FormulaireProduit): ProduitSurveillePatch {
  const apres = corpsCreation(f);
  const patch: Record<string, unknown> = {};
  if (apres.fournisseurId !== avant.fournisseurId) patch.fournisseurId = apres.fournisseurId;
  if (apres.editeur !== avant.editeur) patch.editeur = apres.editeur;
  if (apres.nom !== avant.nom) patch.nom = apres.nom;
  if (apres.versionProduit !== avant.versionProduit) patch.versionProduit = apres.versionProduit;
  if (apres.cpe !== avant.cpe) patch.cpe = apres.cpe;
  if (apres.famille !== avant.famille) patch.famille = apres.famille;
  if (apres.criticite !== avant.criticite) patch.criticite = apres.criticite;
  if (valeurResponsable(apres.responsable) !== valeurResponsable(avant.responsable))
    patch.responsable = apres.responsable;
  return patch as ProduitSurveillePatch;
}

/** Adresse des suggestions d'identifiant CPE (couples connus de la veille) ; null si le nom est trop court. */
export function urlSuggestionsCpe(f: Pick<FormulaireProduit, 'editeur' | 'nom'>): string | null {
  const nom = f.nom.trim();
  if (nom.length < 2) return null;
  const p = new URLSearchParams({ nom });
  if (f.editeur.trim()) p.set('editeur', f.editeur.trim());
  return `/api/vulnerabilites/identites-cpe?${p.toString()}`;
}

/** Groupes de la fiche, dans l'ordre : à décider, rattachées (d'office ou confirmées), écartées, rejetées ; vides omis. */
export const GROUPES_RAPPROCHEMENT: { titre: string; statuts: StatutRapprochement[] }[] = [
  { titre: 'Propositions à décider', statuts: ['proposee'] },
  { titre: 'CVE rattachées (d’office ou confirmées)', statuts: ['rattachee', 'confirmee'] },
  { titre: 'CVE écartées (version hors de la plage publiée)', statuts: ['ecartee'] },
  { titre: 'Propositions rejetées', statuts: ['rejetee'] },
];
export function groupesRapprochements(rs: RapprochementDto[]) {
  return GROUPES_RAPPROCHEMENT.map((g) => ({
    ...g,
    rapprochements: rs.filter((r) => g.statuts.includes(r.statut)),
  })).filter((g) => g.rapprochements.length > 0);
}

/** Plage publiée en clair. */
export function libellePlage(p: PlageVersions): string {
  if (p.version) return `version ${p.version}`;
  const bornes = [
    p.debutInclus && `à partir de ${p.debutInclus} (incluse)`,
    p.debutExclus && `après ${p.debutExclus} (exclue)`,
    p.finInclus && `jusqu’à ${p.finInclus} (incluse)`,
    p.finExclus && `avant ${p.finExclus} (exclue)`,
  ].filter(Boolean);
  return bornes.length ? bornes.join(', ') : 'aucune plage publiée';
}

/** Pourquoi une CVE est proposée, et si la version semble dans la plage. */
export function explicationProposition(r: Pick<RapprochementDto, 'motif' | 'versionDansPlage'>): string {
  const motif = r.motif ? MOTIF_PROPOSITION_LIBELLES[r.motif] : 'Rapprochement';
  return r.versionDansPlage ? `${motif} · ${VERSION_DANS_PLAGE_LIBELLES[r.versionDansPlage]}` : motif;
}
