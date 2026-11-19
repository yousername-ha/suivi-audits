/* Module Vulnérabilités (ADR 0100, lot S3) : vue « Correctifs », côté interface. Fonctions pures (adresses, libellés), testées
   sans navigateur. Le serveur regroupe, calcule et juge les droits ; l'interface ne fait que présenter. */
import {
  ETAT_CORRECTIF_LIBELLES,
  type EtatCorrectif,
  type EtatCorrectifDto,
  ETATS_CORRECTIF,
  type CorrectifDto,
  type NiveauPriorite,
  SOURCE_CORRECTIF_LIBELLES,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export const CLE_CORRECTIFS = ['vulnerabilites', 'correctifs'] as const;

/** Adresse de la liste des correctifs (recherche dans le texte de la solution, priorité). */
export function urlCorrectifs(f: { q: string; priorite: NiveauPriorite | '' }): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.priorite) p.set('priorite', f.priorite);
  const s = p.toString();
  return `/api/vulnerabilites/correctifs${s ? `?${s}` : ''}`;
}
export const urlCorrectif = (cle: string) => `/api/vulnerabilites/correctifs/${encodeURIComponent(cle)}`;

/** Puce de l'état du correctif : jamais la couleur seule (le libellé est toujours écrit). */
export const ETAT_CORRECTIF_PUCE: Record<EtatCorrectif, Etat> = {
  disponible: 'succes',
  aucun_connu: 'erreur',
  non_renseigne: 'neutre',
};

/** Répartition des failles d'un groupe par état du correctif, en clair : « Correctif disponible : 3 · Aucun correctif
    connu : 1 ». */
export function repartitionCorrectif(c: CorrectifDto['correctif']): string {
  return (
    ETATS_CORRECTIF.filter((e) => c[e] > 0)
      .map((e) => `${ETAT_CORRECTIF_LIBELLES[e]} : ${c[e]}`)
      .join(' · ') || '—'
  );
}

/** Sources qui ont parlé du correctif, en clair. */
export const sourcesCorrectif = (s: CorrectifDto['sourcesCorrectif']) =>
  s.length ? `Selon ${s.map((x) => SOURCE_CORRECTIF_LIBELLES[x]).join(' et ')}` : 'Aucune source n’en parle';

/** Première source de l'état d'une faille, en clair (« Tenable … le 02/11/2026 »), ou null. */
export function sourceEtatCorrectif(c: EtatCorrectifDto, date: (iso: string) => string): string | null {
  const s = c.sources[0];
  return s ? `${SOURCE_CORRECTIF_LIBELLES[s.source]}${s.le ? `, ${date(s.le)}` : ''}` : null;
}

/** Machines lues d'un groupe, en clair, avec la mention des autres (sans nombre). */
export function libelleMachinesLues(m: CorrectifDto['machines']): string {
  const n = `${m.lisibles} machine${m.lisibles > 1 ? 's' : ''} lue${m.lisibles > 1 ? 's' : ''}`;
  return m.horsLecture ? `${n}, et d’autres que vous ne lisez pas` : n;
}

/** Explication de la vue (aide et écran) : origine du regroupement, limites, failles qui n'y figurent pas. */
export const EXPLICATION_CORRECTIFS =
  'Une ligne par correctif : le texte de la solution indiqué par Tenable pour chaque faille détectée encore à traiter, en anglais, tel quel. Deux libellés différents pour la même mise à jour ne sont pas fusionnés. Les failles sans solution indiquée forment le groupe « Sans correctif indiqué par la source ». Tri par gain : priorité la plus haute, puis nombre de failles corrigées. La priorité et les nombres de failles sont les mêmes pour tout le monde ; vous ne voyez et ne comptez que les machines que vous lisez.';
export const HORS_VUE_CORRECTIFS =
  'Les failles déclarées (produits surveillés) et les CVE de la surface externe n’y figurent pas : aucune source rangée ne leur donne un correctif (NVD publie les versions touchées, pas la version qui corrige ; la dernière version connue d’AlgoLightHouse n’est pas lue).';
