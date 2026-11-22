/* Module Vulnérabilités (ADR 0100, lot CPE-1) : saisie assistée d'un produit surveillé par le dictionnaire CPE de la NVD.
   Fonctions pures, sans état ni appel réseau (testées à part) : adresses, choix d'un produit de la liste locale, version
   choisie, CPE collé, menu des versions, messages honnêtes, état de la source dans l'écran de la veille. Le serveur reste
   seul juge des droits et des bornes. */
import {
  analyserCpe23,
  construireCpe23,
  CPE_BORNES,
  type EtatDictionnaireCpeDto,
  type IdentiteProduitCpe,
  MESSAGE_ATTENTE_VERSIONS,
  normaliserRechercheCpe,
  type PartieCpe,
  type ProduitCpeDto,
  type VersionsCpeDto,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import type { FormulaireProduit } from './produits';

/** Temporisation de la frappe avant de chercher dans la liste locale. */
export const DELAI_FRAPPE_CPE = 250;
/** Interrogation de la réponse à une demande de versions, et durée au-delà de laquelle l'interface cesse d'attendre. */
export const INTERVALLE_VERSIONS_MS = 2000;
export const ATTENTE_MAX_VERSIONS_MS = 60_000;
/** La saisie en cours est renouvelée au plus une fois par minute pendant la frappe (fenêtre de deux minutes côté API). */
export const RECHAUFFE_MS = 60_000;

export const URL_SAISIE_CPE = '/api/vulnerabilites/cpe/saisie';
export const URL_VERSIONS_CPE = '/api/vulnerabilites/cpe/versions';
export const URL_DICTIONNAIRE_CPE = '/api/vulnerabilites/cpe/dictionnaire';
export const URL_COPIE_CPE = '/api/vulnerabilites/cpe/dictionnaire/copie';

export const PARTIE_CPE_LIBELLES: Record<PartieCpe, string> = {
  a: 'application',
  o: 'système d’exploitation',
  h: 'matériel',
};

/** Adresse de la recherche dans la liste locale ; null si le terme (sans casse, accent ni ponctuation) fait moins de deux
    caractères. */
export function urlProduitsCpe(terme: string): string | null {
  const t = terme.trim().slice(0, CPE_BORNES.termeMax);
  if (normaliserRechercheCpe(t).length < CPE_BORNES.termeMin) return null;
  return `/api/vulnerabilites/cpe/produits?${new URLSearchParams({ q: t }).toString()}`;
}

/** Adresse de l'état des versions d'un produit (interrogation, sans nouvelle demande). */
export const urlVersionsCpe = (i: IdentiteProduitCpe) =>
  `${URL_VERSIONS_CPE}?${new URLSearchParams({ partie: i.partie, editeur: i.editeur, produit: i.produit }).toString()}`;

/** Valeur d'une option de la liste (identité sans ambiguïté, même avec des caractères spéciaux dans les noms). */
export const valeurProduitCpe = (i: IdentiteProduitCpe) => JSON.stringify([i.partie, i.editeur, i.produit]);
export function identiteDepuisValeur(v: string | null): IdentiteProduitCpe | null {
  if (!v) return null;
  try {
    const [partie, editeur, produit] = JSON.parse(v) as [PartieCpe, string, string];
    return typeof editeur === 'string' && typeof produit === 'string' && ['a', 'o', 'h'].includes(partie)
      ? { partie, editeur, produit }
      : null;
  } catch {
    return null;
  }
}

/** Libellé d'un produit de la liste : intitulé de la NVD (texte simple), puis éditeur, produit et partie. */
export const libelleProduitCpe = (p: ProduitCpeDto) =>
  `${p.intitule ?? p.produit} — ${p.editeur} : ${p.produit} (${PARTIE_CPE_LIBELLES[p.partie]})`;

/** Choix d'un produit de la liste : éditeur et produit tels que la NVD les écrit, CPE construit avec la version déjà
    saisie (« * » si elle est vide). */
export function appliquerChoixCpe(f: FormulaireProduit, i: IdentiteProduitCpe): FormulaireProduit {
  return {
    ...f,
    editeur: i.editeur,
    nom: i.produit,
    cpe: construireCpe23({ ...i, version: f.versionProduit }) ?? construireCpe23(i) ?? f.cpe,
  };
}

/** Version choisie ou saisie : le CPE suit, si un produit a été choisi ou collé. */
export function appliquerVersionCpe(
  f: FormulaireProduit,
  i: IdentiteProduitCpe | null,
  version: string,
): FormulaireProduit {
  if (!i) return { ...f, versionProduit: version };
  return { ...f, versionProduit: version, cpe: construireCpe23({ ...i, version }) ?? construireCpe23(i) ?? f.cpe };
}

/** CPE 2.3 collé dans le champ : s'il est valide, il remplit l'éditeur, le produit et la version (si elle est précise),
    sans aucun appel ; sinon seul le champ change. */
export function appliquerCpeColle(
  f: FormulaireProduit,
  texte: string,
): { formulaire: FormulaireProduit; identite: IdentiteProduitCpe | null } {
  const c = analyserCpe23(texte);
  if (!c) return { formulaire: { ...f, cpe: texte }, identite: null };
  return {
    formulaire: {
      ...f,
      cpe: texte.trim(),
      editeur: c.editeur,
      nom: c.produit,
      versionProduit: c.version ?? f.versionProduit,
    },
    identite: { partie: c.partie, editeur: c.editeur, produit: c.produit },
  };
}

/** Menu des versions (champ libre avec propositions) : « toutes versions » (*), puis celles de la NVD ou de la copie
    complète, puis celles vues seulement dans les CVE de la veille, chacune dans son groupe. */
export function optionsVersionsCpe(v: VersionsCpeDto | null | undefined): { group: string; items: string[] }[] {
  const groupes = [{ group: 'Toutes versions', items: ['*'] }];
  if (!v) return groupes;
  const principales = v.versions.filter((x) => x.source !== 'veille').map((x) => x.version);
  const veille = v.versions.filter((x) => x.source === 'veille').map((x) => x.version);
  const source = v.versions.find((x) => x.source !== 'veille')?.source;
  if (principales.length)
    groupes.push({
      group: source === 'copie' ? 'Copie complète du dictionnaire' : 'Dictionnaire de la NVD',
      items: principales,
    });
  if (veille.length) groupes.push({ group: 'Vues dans une CVE de la veille', items: veille });
  return groupes;
}

/** Message affiché sous le champ de la version (null : rien à dire). */
export function messageVersionsCpe(v: VersionsCpeDto | null | undefined, attenteMs: number): string | null {
  if (!v) return null;
  if (v.etat === 'en_attente')
    return attenteMs < ATTENTE_MAX_VERSIONS_MS
      ? MESSAGE_ATTENTE_VERSIONS
      : 'La NVD n’a pas encore répondu : saisissez la version vous-même (la liste sera prête à la prochaine ouverture).';
  if (v.etat === 'indisponible') return v.message;
  if (v.tronque)
    return `Seules les ${CPE_BORNES.versions.toLocaleString('fr-FR')} versions les plus récentes sont proposées.`;
  return v.message;
}

/** État de la source dans l'écran de la veille : libellé et sens de la puce. */
export function etatDictionnaireCpe(e: EtatDictionnaireCpeDto): { libelle: string; etat: Etat } {
  if (e.etat === 'inactif') return { libelle: 'Désactivée', etat: 'neutre' };
  if (!e.flux.ouvert) return { libelle: 'Veille inactive : rien n’est chargé', etat: 'neutre' };
  if (e.etat === 'erreur') return { libelle: 'En erreur', etat: 'erreur' };
  if (e.etat === 'chargement' && e.chargement) {
    const nb = (x: number) => x.toLocaleString('fr-FR');
    const mode = e.chargement.mode === 'complet' ? 'Chargement en cours' : 'Nouveautés en cours de lecture';
    return {
      libelle: `${mode} : ${nb(e.chargement.lues)}${e.chargement.total !== null ? ` / ${nb(e.chargement.total)}` : ''} entrées`,
      etat: 'info',
    };
  }
  if (e.etat === 'en_attente') return { libelle: 'Premier chargement au prochain passage', etat: 'info' };
  return { libelle: 'À jour', etat: 'succes' };
}
