/* Module Vulnérabilités (ADR 0100, lot SI1) : présentation de la surface externe importée de Silène (ANSSI), sans état ni
   appel réseau (testée à part) : adresses des lectures, note et évolution, libellés des ports, produits, constats et lignes.
   La classe d'un constat s'affiche « classe N » tant que sa famille n'est pas confirmée (table CLASSES_SILENE du paquet
   partagé, vide à ce jour). Aucune priorité P1-P4 : un constat Silène n'a pas de CVE. */
import {
  FAMILLE_SILENE_LIBELLES,
  FAMILLES_SILENE,
  type FamilleSilene,
  type LigneSileneDto,
  libelleClasseSilene,
  type NoteImportSileneDto,
  type NoteSileneDto,
  type PortActifDto,
  type PortSileneDto,
  type ProduitSileneDto,
  type SourceSurface,
  TYPE_CPE_SILENE_LIBELLES,
  type TypeActifAlh,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';
import type { SourcePicto } from './pictos-sources';

const API = '/api/vulnerabilites/surface/silene';
export const URL_NOTES_SILENE = API;
export const URL_PERIMETRES_SILENE = `${API}/perimetres`;
export const urlLierSilene = (id: string) => `${API}/perimetres/${encodeURIComponent(id)}`;
export function urlConstatsSilene(q: string, page = 1): string {
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `${API}/constats${s ? `?${s}` : ''}`;
}
export const urlFicheConstatSilene = (id: string) => `${API}/constats/${encodeURIComponent(id)}`;
export const urlFicheActifSilene = (type: TypeActifAlh, valeur: string) =>
  `${API}/actif?${new URLSearchParams({ type, valeur }).toString()}`;

/** Pastille de chaque source de la surface externe. */
export const PICTO_SURFACE: Record<SourceSurface, SourcePicto> = { alh: 'algolighthouse', silene: 'silene' };
export const pictosSurface = (sources: readonly SourceSurface[]): SourcePicto[] => sources.map((s) => PICTO_SURFACE[s]);

/** Nombre décimal à la française (quatre décimales au plus) ; « — » s'il manque. */
export const nombreSilene = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 4 });

/** « 2026-11-15 » → « 15/11/2026 ». */
export const dateRapport = (d: string | null) => (d ? d.split('-').reverse().join('/') : 'date non donnée');

/** « 2026-11-15T06:00:00 » → « 15/11/2026 06:00 » (heure du rapport, fuseau non précisé). */
export function horodatageRapport(h: string | null): string {
  if (!h) return '—';
  const [d, t] = h.split('T') as [string, string];
  return `${dateRapport(d)} ${t.slice(0, 5)}`;
}

/** Évolution de la note depuis l'import complet précédent. */
export function texteEvolution(courante: NoteImportSileneDto, precedente: NoteImportSileneDto | null): string {
  if (!precedente) return 'Premier rapport importé : pas encore d’évolution.';
  const depuis = `depuis le rapport du ${dateRapport(precedente.date)}`;
  if (courante.note === null || precedente.note === null) return `Évolution non calculable ${depuis} (note absente).`;
  const ecart = Math.round((courante.note - precedente.note) * 10000) / 10000;
  if (ecart === 0) return `Note inchangée ${depuis}.`;
  return `${ecart > 0 ? '+' : '−'}${nombreSilene(Math.abs(ecart))} ${depuis} (${nombreSilene(precedente.note)} auparavant).`;
}

/** Nombres par famille de la synthèse du rapport. */
export const famillesNote = (n: NoteImportSileneDto): { famille: FamilleSilene; libelle: string; valeur: string }[] =>
  FAMILLES_SILENE.map((f) => ({ famille: f, libelle: FAMILLE_SILENE_LIBELLES[f], valeur: nombreSilene(n[f]) }));

/** État du dernier import d'une instance (pastille et texte). */
export function etatDernierImport(n: Pick<NoteSileneDto, 'derniere' | 'actif'>): { libelle: string; etat: Etat } {
  if (!n.derniere) return { libelle: n.actif ? 'Aucun import' : 'Inactive', etat: 'neutre' };
  if (n.derniere.etat === 'recu') return { libelle: 'Rapport importé', etat: 'succes' };
  if (n.derniere.etat === 'en_cours' || n.derniere.etat === 'en_file')
    return { libelle: 'Import en cours', etat: 'info' };
  return { libelle: 'Dernier import en échec', etat: 'erreur' };
}

/** « 443/tcp · HTTPS » (comme les services d'AlgoLightHouse). */
export const libellePortSilene = (p: Pick<PortSileneDto, 'port' | 'protocole' | 'service'>) =>
  `${p.port}/${p.protocole}${p.service ? ` · ${p.service.toUpperCase()}` : ''}`;
/** « Fictional httpd, tunnel ssl » (null : rien de connu). */
export const produitPortSilene = (p: Pick<PortSileneDto, 'produit' | 'tunnel'>) =>
  [p.produit, p.tunnel ? `tunnel ${p.tunnel}` : null].filter(Boolean).join(', ') || null;

/** Libellé d'un port réuni des deux sources : port/protocole, puis le nom du service connu (Silène d'abord). */
export function libellePortActif(p: PortActifDto): string {
  const service = p.silene?.service ?? p.alh?.nom ?? null;
  const port = p.protocole ? `${p.port}/${p.protocole}` : String(p.port);
  return service ? `${port} · ${service.toUpperCase()}` : port;
}

/** Ce que chaque source dit d'un port réuni, en clair et nommé (« Silène : Fictional httpd, tunnel ssl »). */
export function detailsPortActif(p: PortActifDto): { source: SourceSurface; texte: string }[] {
  const out: { source: SourceSurface; texte: string }[] = [];
  if (p.silene) out.push({ source: 'silene', texte: `Silène : ${produitPortSilene(p.silene) ?? 'port ouvert'}` });
  if (p.alh)
    out.push({
      source: 'alh',
      texte: `AlgoLightHouse : ${[p.alh.produit, p.alh.version].filter(Boolean).join(' ') || 'service porté par une alerte'}`,
    });
  return out;
}

/** « application fictional httpd 9.9 ». */
export const libelleProduitSilene = (p: ProduitSileneDto) =>
  `${TYPE_CPE_SILENE_LIBELLES[p.type]} ${[p.editeur, p.produit, p.version].filter(Boolean).join(' ')}`;

export const libelleClasse = libelleClasseSilene;

/** Une ligne du détail d'un constat, en clair. */
export function libelleLigneSilene(l: LigneSileneDto): string {
  return (
    [
      l.port !== null ? `${l.port}${l.protocole ? `/${l.protocole}` : ''}` : null,
      l.service,
      l.produit,
      l.nomHote,
      l.type,
      l.echeance ? `échéance ${horodatageRapport(l.echeance)}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Sans détail'
  );
}

/** Ports d'un actif dans la liste : nombre gardé et nombre annoncé par Silène. */
export function resumePortsSilene(a: { nombrePorts: number; portsOuverts: number | null }): string {
  const gardes = `${a.nombrePorts} port${a.nombrePorts > 1 ? 's' : ''} ouvert${a.nombrePorts > 1 ? 's' : ''} selon Silène`;
  return a.portsOuverts !== null && a.portsOuverts > a.nombrePorts ? `${gardes} (${a.portsOuverts} annoncés)` : gardes;
}
