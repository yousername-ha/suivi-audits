/* Module Vulnérabilités (ADR 0100, lot R1) : barre de recherche globale. Fonctions pures : adresse de la route, options
   rendues par groupe (titre, détail, page existante ouverte au choix), liens « tout voir » vers les listes existantes qui
   acceptent une recherche, et lecture des paramètres d'ouverture des pages (`?cve=`, `?machine=`, `?actif=`…). */
import {
  estIdentifiantCve,
  etatCveRecherche,
  type GroupeRechercheGlobale,
  type PorteurDto,
  RECHERCHE_GLOBALE_BORNES,
  type RechercheGlobaleDto,
  ROLE_MACHINE_LIBELLES,
  type ResultatCveDto,
} from '@suivi/shared';
import { GRAVITE_LIBELLES } from './veille-presentation';
import { sansDoublon, type SourcePicto } from './pictos-sources';

/** Délai de frappe avant l'appel (anti-rebond), en millisecondes. */
export const DELAI_FRAPPE = 300;
export const urlRecherche = (q: string) => `/api/vulnerabilites/recherche?q=${encodeURIComponent(q.trim())}`;
/** La saisie déclenche une recherche (2 à 200 caractères après rognage). */
export const rechercheValide = (q: string) =>
  q.trim().length >= RECHERCHE_GLOBALE_BORNES.min && q.trim().length <= RECHERCHE_GLOBALE_BORNES.max;

const avec = (chemin: string, p: Record<string, string>) => `${chemin}?${new URLSearchParams(p).toString()}`;
/* Pages existantes ouvertes par un résultat (paramètres lus par chaque page à chaque navigation). */
export const lienFicheCve = (cve: string) => avec('/vulnerabilites/veille', { q: cve, cve });
export const lienMachine = (id: string) => avec('/vulnerabilites/machines', { machine: id });
export const lienActif = (id: string, valeur: string) =>
  avec('/vulnerabilites/surface-externe', {
    onglet: 'actifs',
    q: valeur.slice(0, RECHERCHE_GLOBALE_BORNES.listes),
    actif: id,
  });
export const lienProduit = (id: string) => avec('/vulnerabilites/produits', { produit: id });
export const lienTechnologies = (q: string) =>
  avec('/vulnerabilites/surface-externe', { onglet: 'technologies', q: q.slice(0, RECHERCHE_GLOBALE_BORNES.listes) });
export const lienControle = (id: string) => avec('/vulnerabilites/failles', { constat: id });

/** « Tout voir » : la liste existante filtrée sur la saisie, quand elle accepte une recherche (et une saisie de sa longueur). */
export function lienToutVoir(groupe: GroupeRechercheGlobale, q: string): string | null {
  const t = q.trim();
  if (t.length > RECHERCHE_GLOBALE_BORNES.listes) return null;
  switch (groupe) {
    case 'cves':
      return avec('/vulnerabilites/veille', { q: t });
    case 'machines':
      return avec('/vulnerabilites/machines', { q: t });
    case 'actifs':
      return avec('/vulnerabilites/surface-externe', { onglet: 'actifs', q: t });
    case 'technologies':
      return lienTechnologies(t);
    case 'controles':
      return avec('/vulnerabilites/failles', { q: t });
    case 'produits':
      // Le registre des produits surveillés ne se filtre que par famille : pas de lien « tout voir ».
      return null;
  }
}

export const LIBELLES_GROUPES: Record<GroupeRechercheGlobale, string> = {
  cves: 'CVE',
  machines: 'Machines internes',
  actifs: 'Actifs exposés',
  produits: 'Applications : produits surveillés',
  technologies: 'Applications : technologies exposées (AlgoLightHouse)',
  controles: 'Applications : contrôles de Tenable',
};
/** Lot L1 : source d'un groupe tenu par un connecteur (pastille décorative du titre : le libellé la nomme). */
export const SOURCE_GROUPE: Partial<Record<GroupeRechercheGlobale, SourcePicto>> = {
  technologies: 'algolighthouse',
  controles: 'tenable',
};
export const ORDRE_GROUPES: readonly GroupeRechercheGlobale[] = [
  'cves',
  'machines',
  'actifs',
  'produits',
  'technologies',
  'controles',
];

export interface OptionRecherche {
  /** Clé stable dans la liste (identifiant d'élément du DOM). */
  cle: string;
  titre: string;
  detail: string;
  to: string;
  /** Lien « tout voir » d'un groupe. */
  toutVoir?: boolean;
  /** État d'une CVE (teinte du texte d'état). */
  etat?: ReturnType<typeof etatCveRecherche>['etat'];
  /** Lot L1 : sources de la réponse (NVD pour la gravité, catalogue KEV de la CISA), en pastilles décoratives. */
  sources?: SourcePicto[];
}
export interface GroupeOptions {
  groupe: GroupeRechercheGlobale;
  libelle: string;
  total: number;
  options: OptionRecherche[];
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const joindre = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

function porteurs(liste: PorteurDto[], total: number, un: string, plusieurs: string, aucun: string): string {
  if (!total) return aucun;
  const noms = liste.map((p) => p.libelle).join(', ');
  const autres = total - liste.length;
  return `${pluriel(total, un, plusieurs)} : ${noms}${autres > 0 ? ` et ${pluriel(autres, 'autre', 'autres')}` : ''}`;
}

export function detailCve(r: ResultatCveDto): string {
  return joindre([
    etatCveRecherche(r).libelle,
    r.gravite && `${GRAVITE_LIBELLES[r.gravite]}${r.score !== null ? ` ${r.score.toLocaleString('fr-FR')}` : ''}`,
    r.kev && 'Catalogue KEV',
    !r.veille && 'Non citée par la veille locale',
    r.produit,
    r.resume,
  ]);
}

/** Options de la réponse, groupe par groupe (groupes vides omis), avec « tout voir » quand le groupe est tronqué. */
export function optionsRecherche(r: RechercheGlobaleDto): GroupeOptions[] {
  const options: Record<GroupeRechercheGlobale, OptionRecherche[]> = {
    cves: r.cves.elements.map((c) => ({
      cle: `cve-${c.cve}`,
      titre: c.cve,
      detail: detailCve(c),
      to: c.fiche ? lienFicheCve(c.cve) : lienTechnologies(c.cve),
      etat: etatCveRecherche(c).etat,
      sources: sansDoublon([...(c.gravite ? (['nvd'] as const) : []), ...(c.kev ? (['cisa-kev'] as const) : [])]),
    })),
    machines: r.machines.elements.map((m) => ({
      cle: `machine-${m.id}`,
      titre: m.nom ?? m.adresse ?? 'Machine sans nom',
      detail: joindre([
        m.nom && m.adresse,
        m.systeme,
        m.role ? ROLE_MACHINE_LIBELLES[m.role] : 'Rôle non indiqué',
        m.perimetreNom ?? 'Sans périmètre',
      ]),
      to: lienMachine(m.id),
    })),
    actifs: r.actifs.elements.map((x) => ({
      cle: `actif-${x.id}`,
      titre: x.valeur,
      detail: joindre([
        x.type === 'hote' ? 'Hôte (adresse IP)' : 'Nom de domaine',
        x.type === 'domaine' && x.adresse,
        x.perimetreNom ?? 'Périmètre AlgoLightHouse non relié',
        x.alertesOuvertes ? pluriel(x.alertesOuvertes, 'alerte ouverte', 'alertes ouvertes') : null,
      ]),
      to: lienActif(x.id, x.valeur),
    })),
    produits: r.produits.elements.map((p) => ({
      cle: `produit-${p.id}`,
      titre: `${p.editeur} ${p.nom} ${p.versionProduit}`,
      detail: porteurs(
        p.porteurs,
        p.machines,
        'machine reliée',
        'machines reliées',
        'Aucune machine reliée parmi celles que vous lisez',
      ),
      to: lienProduit(p.id),
    })),
    technologies: r.technologies.elements.map((x) => ({
      cle: `technologie-${x.id}`,
      titre: x.nom,
      detail: joindre([
        [x.editeur, x.produit].filter(Boolean).join(' ') || null,
        porteurs(x.porteurs, x.actifs, 'actif exposé', 'actifs exposés', 'Aucun actif exposé que vous lisez'),
      ]),
      to: lienTechnologies(x.nom),
    })),
    controles: r.controles.elements.map((c) => ({
      cle: `controle-${c.id}`,
      titre: c.nom,
      detail: joindre([`Contrôle ${c.pluginId}`, `présent sur ${pluriel(c.machines, 'machine', 'machines')}`]),
      to: lienControle(c.id),
    })),
  };
  return ORDRE_GROUPES.flatMap((g): GroupeOptions[] => {
    const total = r[g].total;
    if (!total) return [];
    const liste = [...options[g]];
    const tout = lienToutVoir(g, r.q);
    if (tout && total > liste.length)
      liste.push({
        cle: `tout-${g}`,
        titre: `Tout voir (${total})`,
        detail: `${LIBELLES_GROUPES[g]} : la liste complète, filtrée sur « ${r.q} »`,
        to: tout,
        toutVoir: true,
      });
    return [{ groupe: g, libelle: LIBELLES_GROUPES[g], total, options: liste }];
  });
}

/** Annonce du nombre de résultats pour les lecteurs d'écran. */
export function annonceRecherche(r: RechercheGlobaleDto | undefined, enCours: boolean): string {
  if (enCours) return 'Recherche en cours…';
  if (!r) return '';
  const groupes = optionsRecherche(r);
  const n = groupes.reduce((s, g) => s + g.total, 0);
  if (!n)
    return r.cveInconnue
      ? `${r.cveInconnue.cve} : CVE inconnue de la veille locale.`
      : 'Aucun résultat dans le module.';
  return `${pluriel(n, 'résultat', 'résultats')} : ${groupes.map((g) => `${LIBELLES_GROUPES[g.groupe]} ${g.total}`).join(', ')}.`;
}

/* ------------------------------------------------------------------ Ouverture des pages par leur adresse */
const texteListe = (v: string | null) => (v === null ? null : v.trim().slice(0, RECHERCHE_GLOBALE_BORNES.listes));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null) => (v && UUID.test(v) ? v.toLowerCase() : null);

/** Veille : `q` (recherche) et `cve` (fiche de la CVE ouverte ; identifiant bien formé seulement). */
export function ouvertureVeille(p: URLSearchParams): { q: string | null; cve: string | null } {
  const cve = p.get('cve')?.trim() ?? '';
  return { q: texteListe(p.get('q')), cve: estIdentifiantCve(cve) ? cve.toUpperCase() : null };
}
/** Machines : `q` (recherche) et `machine` (fiche ouverte). */
export function ouvertureMachines(p: URLSearchParams): { q: string | null; machine: string | null } {
  return { q: texteListe(p.get('q')), machine: uuid(p.get('machine')) };
}
export const ONGLETS_SURFACE = ['carte', 'alertes', 'actifs', 'technologies', 'constats-silene', 'perimetres'] as const;
export type OngletSurface = (typeof ONGLETS_SURFACE)[number];
/** Surface externe : `onglet`, `q` (recherche de l'onglet « Actifs » ou « Technologies ») et `actif` (actif ouvert, s'il
    figure dans la liste filtrée). */
export function ouvertureSurface(p: URLSearchParams): {
  onglet: OngletSurface | null;
  q: string | null;
  actif: string | null;
} {
  const o = p.get('onglet') ?? '';
  return {
    onglet: (ONGLETS_SURFACE as readonly string[]).includes(o) ? (o as OngletSurface) : null,
    q: texteListe(p.get('q')),
    actif: uuid(p.get('actif')),
  };
}
/** Produits surveillés : `produit` (fiche ouverte). Failles détectées : `constat` (fiche ouverte). */
export const ouvertureProduit = (p: URLSearchParams) => uuid(p.get('produit'));
export const ouvertureConstat = (p: URLSearchParams) => uuid(p.get('constat'));
