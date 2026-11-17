/* Module Vulnérabilités (ADR 0100, lots ALH1 et ALH2) : surface externe lue dans AlgoLightHouse, présentation sans état ni
   appel réseau (testée à part). Le serveur reste seul juge des droits (périmètre relié, administration du module) ; les
   textes de l'éditeur (titres, défauts, résolutions) s'affichent tels quels, comme texte simple, jamais comme HTML.
   Lot ALH3 : actif exposé relié à la ou aux machines internes (colonne « Machine interne », fiche de l'actif, fiche d'une
   machine « exposée sur Internet par … »). */
import {
  type ExpositionMachineDto,
  FILTRE_LIAISON_ACTIF_LIBELLES,
  FILTRES_LIAISON_ACTIF,
  type FiltreLiaisonActif,
  type LiaisonMachineDto,
  MOTIF_LIAISON_MACHINE_LIBELLES,
  type ResumeLiaisonsActifDto,
  type AlerteAlhDto,
  CRITICITE_ALH_LIBELLES,
  type CriticiteAlh,
  type EtatSurfaceExterneDto,
  type ProduitRapprocheAlhDto,
  type SurfaceCveDto,
  type TechnologieRapprocheeDto,
  type TriSurface,
  STATUT_ACTIF_ALH_LIBELLES,
  STATUT_ALERTE_ALH_LIBELLES,
  STATUTS_ALERTE_ALH_OUVERTS,
  type StatutActifAlh,
  type StatutAlerteAlh,
  TYPE_ACTIF_ALH_LIBELLES,
  TYPE_ALERTE_ALH_LIBELLES,
  TYPE_CIBLE_ALH_LIBELLES,
  type TypeActifAlh,
  type TypeAlerteAlh,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export const LIEN_SURFACE = '/vulnerabilites/surface-externe';
const API = '/api/vulnerabilites/surface';

export interface FiltresAlertesAlh {
  q: string;
  type: TypeAlerteAlh | '';
  criticite: CriticiteAlh | '';
  /** Vide : alertes encore ouvertes chez l'éditeur. */
  statut: StatutAlerteAlh | 'toutes' | '';
  /** Vide : ordre par défaut (criticité de l'éditeur) ; `priorite` : priorité calculée par la plateforme (lot ALH2). */
  tri: TriSurface | '';
}
export const FILTRES_ALERTES_VIDES: FiltresAlertesAlh = { q: '', type: '', criticite: '', statut: '', tri: '' };

const adresse = (chemin: string, valeurs: Record<string, string>, page: number) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(valeurs)) if (v.trim()) p.set(k, v.trim());
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `${API}/${chemin}${s ? `?${s}` : ''}`;
};

export const urlAlertesAlh = (f: FiltresAlertesAlh, page = 1) =>
  adresse('alertes', { q: f.q, type: f.type, criticite: f.criticite, statut: f.statut, tri: f.tri }, page);
export const urlActifsAlh = (q: string, type: TypeActifAlh | '', page = 1, liaison: FiltreLiaisonActif | '' = '') =>
  adresse('actifs', { q, type, liaison }, page);
export const urlTechnologiesAlh = (q: string, exploitee: boolean, page = 1, tri: TriSurface | '' = '') =>
  adresse('technologies', { q, exploitee: exploitee ? 'oui' : '', tri }, page);
export const urlFicheAlerteAlh = (id: string) => `${API}/alertes/${encodeURIComponent(id)}`;
/** Carte « Lignes d'approche » (lot ALH4). */
export const URL_CARTE_SURFACE = `${API}/carte`;

/** Ordres proposés par les listes (lot ALH2). */
export const OPTIONS_TRI_ALERTES = [
  { value: 'criticite', label: 'Criticité de l’éditeur' },
  { value: 'priorite', label: 'Priorité calculée' },
];
export const OPTIONS_TRI_TECHNOLOGIES = [
  { value: 'exploitation', label: 'CVE exploitées, puis score' },
  { value: 'priorite', label: 'Priorité calculée' },
];
/** Valeur du sélecteur d'ordre -> paramètre de l'API (vide : ordre par défaut). */
export const triDepuis = (v: string | null): TriSurface | '' => (v === 'priorite' ? 'priorite' : '');

export const CRITICITE_ALH_ETAT: Record<CriticiteAlh, Etat> = {
  critical: 'erreur',
  major: 'attention',
  important: 'info',
  minor: 'neutre',
};
export const libelleCriticite = (c: CriticiteAlh | null) => (c ? CRITICITE_ALH_LIBELLES[c] : 'Non renseignée');
export const libelleTypeAlerte = (t: TypeAlerteAlh | null) => (t ? TYPE_ALERTE_ALH_LIBELLES[t] : 'Type non renseigné');
export const libelleStatutAlerte = (s: StatutAlerteAlh) => STATUT_ALERTE_ALH_LIBELLES[s];
export const alerteOuverte = (s: StatutAlerteAlh) => STATUTS_ALERTE_ALH_OUVERTS.includes(s);
export const libelleStatutActif = (s: StatutActifAlh | null) => (s ? STATUT_ACTIF_ALH_LIBELLES[s] : 'Non renseigné');
export const libelleTypeActif = (t: TypeActifAlh) => TYPE_ACTIF_ALH_LIBELLES[t];

/** Cible d'une alerte en une ligne : nature et valeur, ou « non renseignée » (détail pas encore lu). */
export function libelleCible(a: Pick<AlerteAlhDto, 'cible' | 'detail'>): string {
  if (!a.cible) return a.detail ? 'Sans cible' : 'Cible non lue (détail à venir)';
  const nature = a.cible.type ? TYPE_CIBLE_ALH_LIBELLES[a.cible.type] : 'Cible';
  return a.cible.valeur ? `${nature} : ${a.cible.valeur}` : nature;
}

/** Périmètre d'un élément : celui de la plateforme s'il est relié, sinon le périmètre de l'éditeur « non relié ». */
export function libellePerimetre(p: { perimetreNom: string | null; perimetreAlh: string | null }): string {
  if (p.perimetreNom) return p.perimetreNom;
  return p.perimetreAlh ? `${p.perimetreAlh} (non relié)` : 'Sans périmètre';
}

/** Score EPSS en pourcentage, comme dans les autres écrans du module. */
export const pourcentage = (v: number | null) => (v === null ? '—' : `${Math.round(v * 1000) / 10} %`);

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Bilan lisible d'une synchronisation d'AlgoLightHouse (nombres seulement). */
export function resumeBilanAlh(r: Record<string, unknown>): string {
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0);
  return [
    `Synchronisation reçue : ${pluriel(n('alertes'), 'alerte', 'alertes')} (${pluriel(n('details'), 'détail lu', 'détails lus')}), ${pluriel(n('hotes'), 'hôte', 'hôtes')}, ${pluriel(n('domaines'), 'domaine', 'domaines')}, ${pluriel(n('technologies'), 'technologie', 'technologies')}, ${pluriel(n('perimetres'), 'périmètre', 'périmètres')}.`,
    r.tronque === true
      ? 'Incomplète : une borne a été atteinte (nombre d’éléments, détails ou durée) ; rien n’est marqué disparu.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** État d'une instance : dernière synchronisation, dernière complète, périmètres non reliés (administration du module). */
export function resumeEtatAlh(e: EtatSurfaceExterneDto): { libelle: string; etat: Etat; detail: string } {
  const d = e.derniere;
  const nonRelies =
    e.perimetresNonRelies && e.perimetresNonRelies > 0
      ? ` ${pluriel(e.perimetresNonRelies, 'périmètre AlgoLightHouse n’est pas relié', 'périmètres AlgoLightHouse ne sont pas reliés')} : son contenu n’est visible que de l’administration du module.`
      : '';
  if (!e.actif) return { libelle: 'Connecteur inactif', etat: 'neutre', detail: nonRelies.trim() };
  if (!d) return { libelle: 'Jamais synchronisé', etat: 'neutre', detail: nonRelies.trim() };
  if (d.etat === 'en_file' || d.etat === 'en_cours')
    return { libelle: 'Synchronisation en cours', etat: 'info', detail: nonRelies.trim() };
  if (d.etat === 'echec' || d.etat === 'expire')
    return {
      libelle: 'Dernière synchronisation en échec',
      etat: 'erreur',
      detail: `${d.erreur ?? ''}${nonRelies}`.trim(),
    };
  return {
    libelle: d.bilan?.tronque ? 'Synchronisation incomplète' : 'À jour',
    etat: d.bilan?.tronque ? 'attention' : 'succes',
    detail: `${d.bilan ? resumeBilanAlh(d.bilan as unknown as Record<string, unknown>) : ''}${nonRelies}`.trim(),
  };
}

/** Vue d'une CVE sur la surface externe, pour la veille (lot ALH2). */
export function libelleSurfaceCve(s: SurfaceCveDto): string {
  const actifs = pluriel(s.actifs, 'actif exposé', 'actifs exposés');
  return s.alertes
    ? `Vue sur la surface externe : ${actifs}, ${pluriel(s.alertes, 'alerte ouverte', 'alertes ouvertes')}.`
    : `Vue sur la surface externe : ${actifs}.`;
}

/** Correspondance de version entre un produit déclaré et ce que la surface externe détecte. */
const versionRapprochee = (m: boolean | null) =>
  m === true ? 'même version' : m === false ? 'version différente : à vérifier' : 'version non comparable';

/** Produit surveillé rapproché d'une technologie (lot ALH2). */
export function libelleProduitRapproche(p: ProduitRapprocheAlhDto): string {
  return `${p.editeur} ${p.nom} ${p.versionProduit} (${p.par === 'cpe' ? 'par identifiant CPE' : 'par nom'}, ${versionRapprochee(p.memeVersion)})`;
}

/** Technologie de la surface externe rapprochée d'un produit (fiche du produit, lot ALH2). */
export function libelleTechnologieRapprochee(t: TechnologieRapprocheeDto): string {
  const versions = t.versions.filter(Boolean);
  return `${[t.editeur, t.nom].filter(Boolean).join(' ')}${versions.length ? ` ${versions.join(', ')}` : ' (version inconnue)'} sur ${pluriel(t.actifs, 'actif exposé', 'actifs exposés')} (${t.par === 'cpe' ? 'par identifiant CPE' : 'par nom'}, ${versionRapprochee(t.memeVersion)})`;
}

/* ------------------------------------------------------------------ Machines internes (lot ALH3) */
export const urlLiaisonsActif = (id: string) => `${API}/actifs/${encodeURIComponent(id)}/machines`;
export const urlDecisionLiaison = (id: string) => `${API}/liaisons/${encodeURIComponent(id)}/decision`;
export const urlDeliaison = (id: string) => `${API}/liaisons/${encodeURIComponent(id)}/deliaison`;
export const urlExpositionMachine = (id: string) => `/api/vulnerabilites/machines/${encodeURIComponent(id)}/surface`;
export const OPTIONS_LIAISON_ACTIF = FILTRES_LIAISON_ACTIF.map((f) => ({
  value: f,
  label: FILTRE_LIAISON_ACTIF_LIBELLES[f],
}));

const nomMachine = (m: { nom: string | null; adresse: string | null }) => m.nom ?? m.adresse ?? 'Machine sans nom';

/** Colonne « Machine interne » d'un actif : machines reliées lisibles, sinon propositions à décider, sinon « à relier » ;
    une liaison vers une machine que la personne ne lit pas est signalée sans nom ni nombre. */
export function resumeMachineInterne(r: ResumeLiaisonsActifDto): { libelle: string; etat: Etat; detail: string } {
  const autres = r.autresMachines ? 'Reliée aussi à une machine que vous ne pouvez pas lire.' : '';
  const propositions = r.propositions ? `${pluriel(r.propositions, 'proposition', 'propositions')} à décider.` : '';
  if (r.nombreReliees) {
    const noms = r.reliees.map(nomMachine).join(', ');
    const reste = r.nombreReliees - r.reliees.length;
    return {
      libelle: `Reliée : ${noms}${reste > 0 ? ` et ${pluriel(reste, 'autre', 'autres')}` : ''}`,
      etat: 'succes',
      detail: [propositions, autres].filter(Boolean).join(' '),
    };
  }
  if (r.propositions)
    return { libelle: 'Proposée, à décider', etat: 'info', detail: [propositions, autres].filter(Boolean).join(' ') };
  if (r.autresMachines)
    return { libelle: 'Reliée à une machine que vous ne pouvez pas lire', etat: 'neutre', detail: '' };
  return { libelle: 'À relier', etat: 'neutre', detail: '' };
}

/** Critère et origine d'une liaison, en une ligne. */
export function libelleLiaison(l: Pick<LiaisonMachineDto, 'statut' | 'motif' | 'origine' | 'decidePar'>): string {
  const critere = l.motif ? `critère : ${MOTIF_LIAISON_MACHINE_LIBELLES[l.motif]}` : 'sans critère de la plateforme';
  if (l.statut === 'proposee') return `Proposée par la plateforme (${critere})`;
  const par = l.decidePar ? ` par ${l.decidePar}` : '';
  if (l.statut === 'confirmee')
    return l.origine === 'manuelle'
      ? `Reliée à la main${par} (${critere})`
      : `Proposition confirmée${par} (${critere})`;
  if (l.statut === 'rejetee') return `Rejetée ou déliée${par} : pas reproposée tant que les données ne changent pas`;
  return 'Retirée : le critère ne tient plus';
}

/** Fiche d'une machine : « exposée sur Internet par … » (actifs lisibles seulement). */
export function libelleExposition(e: ExpositionMachineDto): string {
  const actifs = e.actifs.map((a) => `${a.valeur} (${libelleTypeActif(a.type).toLowerCase()})`);
  const autres = e.autresActifs ? 'un actif exposé que vous ne pouvez pas lire' : '';
  const tout = [...actifs, ...(autres ? [autres] : [])];
  return tout.length
    ? `Exposée sur Internet par ${tout.join(', ')}.`
    : 'Aucun actif exposé sur Internet relié à cette machine, parmi ceux que vous pouvez lire.';
}
