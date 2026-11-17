/* Module Vulnérabilités (ADR 0100, lot ALH1) : surface externe lue dans AlgoLightHouse, présentation sans état ni appel
   réseau (testée à part). Le serveur reste seul juge des droits (périmètre relié, administration du module) ; les textes de
   l'éditeur s'affichent tels quels, comme texte simple. */
import {
  type AlerteAlhDto,
  CRITICITE_ALH_LIBELLES,
  type CriticiteAlh,
  type EtatSurfaceExterneDto,
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
}
export const FILTRES_ALERTES_VIDES: FiltresAlertesAlh = { q: '', type: '', criticite: '', statut: '' };

const adresse = (chemin: string, valeurs: Record<string, string>, page: number) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(valeurs)) if (v.trim()) p.set(k, v.trim());
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `${API}/${chemin}${s ? `?${s}` : ''}`;
};

export const urlAlertesAlh = (f: FiltresAlertesAlh, page = 1) =>
  adresse('alertes', { q: f.q, type: f.type, criticite: f.criticite, statut: f.statut }, page);
export const urlActifsAlh = (q: string, type: TypeActifAlh | '', page = 1) => adresse('actifs', { q, type }, page);
export const urlTechnologiesAlh = (q: string, exploitee: boolean, page = 1) =>
  adresse('technologies', { q, exploitee: exploitee ? 'oui' : '' }, page);

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
