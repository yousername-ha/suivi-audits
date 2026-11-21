/* Module Vulnérabilités (ADR 0100, point 17 et V12 ; lot PC3) : onglet « Périmètres », côté interface. Fonctions pures :
   adresses (route, page partageable `?perimetre=`, liste des machines filtrée), noms accessibles d'une carte, libellés de
   l'exposition d'une machine et du bandeau du détail. Agrégats, tri et présentation « au global » : paquet partagé
   (perimetres-vulnerabilites.ts). */
import {
  type CartePerimetreDto,
  type ExpositionTuileDto,
  type FaillesParGravite,
  type IdPerimetreVue,
  PERIMETRE_AUCUN,
  type PresentationPerimetre,
  PRESENTATIONS_PERIMETRE,
  ROLES_MACHINE,
  type ZoneParc,
} from '@suivi/shared';
import { libelleTypeActif } from './surface';

export const CLE_PERIMETRES = ['vulnerabilites', 'machines', 'perimetres'] as const;
export const URL_PERIMETRES = '/api/vulnerabilites/machines/perimetres';
export const urlDetailPerimetre = (id: IdPerimetreVue) => `${URL_PERIMETRES}/${encodeURIComponent(id)}`;
/** Page de l'onglet « Périmètres ». */
export const ADRESSE_PERIMETRES = '/vulnerabilites/perimetres';

/** Adresse partageable du détail d'un périmètre (`null` : carte « Sans périmètre »), avec sa présentation si elle n'est
    pas celle par défaut (« Par ligne »). */
export function parametresPerimetre(
  id: string | null,
  presentation: PresentationPerimetre = 'lignes',
): URLSearchParams {
  const p = new URLSearchParams({ perimetre: id ?? PERIMETRE_AUCUN });
  if (presentation !== 'lignes') p.set('presentation', presentation);
  return p;
}
export const adressePerimetre = (id: string | null, presentation: PresentationPerimetre = 'lignes') =>
  `${ADRESSE_PERIMETRES}?${parametresPerimetre(id, presentation).toString()}`;

/** Lecture de l'adresse : identifiant du périmètre ouvert (null : la liste) et présentation. Une valeur inconnue est
    ignorée (la route juge l'identifiant). */
export function lireAdresse(p: URLSearchParams): { perimetre: string | null; presentation: PresentationPerimetre } {
  const brut = p.get('presentation');
  const presentation = (PRESENTATIONS_PERIMETRE as readonly string[]).includes(brut ?? '')
    ? (brut as PresentationPerimetre)
    : 'lignes';
  const perimetre = p.get('perimetre')?.trim() || null;
  return { perimetre, presentation };
}

/** Liste des machines (écran « Machines ») filtrée sur un périmètre et, au besoin, sur une zone de rôle. */
export function adresseListeMachines(id: string | null, zone?: ZoneParc): string {
  const p = new URLSearchParams({ perimetre: id ?? PERIMETRE_AUCUN });
  if (zone) p.set('role', zone);
  return `/vulnerabilites/machines?${p.toString()}`;
}

/** Filtres initiaux de l'écran « Machines » lus dans son adresse (lien depuis l'onglet « Périmètres ») ; valeurs
    inconnues ignorées. */
export function filtresDepuisAdresse(p: URLSearchParams): {
  role: (typeof ROLES_MACHINE)[number] | 'aucun' | '';
  perimetre: string;
} {
  const role = p.get('role') ?? '';
  return {
    role: role === 'aucun' || (ROLES_MACHINE as readonly string[]).includes(role) ? (role as 'aucun') : '',
    perimetre: p.get('perimetre')?.trim() ?? '',
  };
}

export const nomPerimetre = (c: Pick<CartePerimetreDto, 'id' | 'nom'>) =>
  c.id === null ? 'Sans périmètre' : (c.nom ?? 'Périmètre');

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Failles présentes par gravité, en clair (toutes les gravités, zéro compris). */
export function libelleFaillesPerimetre(f: FaillesParGravite): string {
  return [
    pluriel(f.critique, 'critique', 'critiques'),
    pluriel(f.elevee, 'élevée', 'élevées'),
    pluriel(f.moyenne, 'moyenne', 'moyennes'),
    pluriel(f.faible, 'faible', 'faibles'),
  ].join(', ');
}

/** Nom accessible d'une carte : « Portail fictif : 5 machines lues, priorité P1, failles présentes : 1 critique, …, 2
    machines à exploitation avérée, 1 machine exploitable, 2 actifs exposés sur Internet ». */
export function nomAccessibleCarte(c: CartePerimetreDto): string {
  const parts = [
    pluriel(c.machines, 'machine lue', 'machines lues'),
    c.priorite ? `priorité ${c.priorite}` : 'aucune priorité',
    `failles présentes : ${libelleFaillesPerimetre(c.failles)}`,
    ...(c.machinesExploitationAveree
      ? [`${pluriel(c.machinesExploitationAveree, 'machine', 'machines')} à exploitation avérée`]
      : []),
    ...(c.machinesExploitables
      ? [pluriel(c.machinesExploitables, 'machine exploitable', 'machines exploitables')]
      : []),
    pluriel(c.actifsExposes, 'actif exposé sur Internet', 'actifs exposés sur Internet'),
  ];
  return `${nomPerimetre(c)} : ${parts.join(', ')}`;
}

/** Exposition d'une machine en une ligne : « exposée sur Internet par a.example (domaine), 198.51.100.1 (hôte) et 2
    autres ». Seuls des actifs lisibles y figurent. */
export function libelleExpositionTuile(e: ExpositionTuileDto): string {
  const actifs = e.actifs.map((a) => `${a.valeur} (${libelleTypeActif(a.type).toLowerCase()})`).join(', ');
  return `exposée sur Internet par ${actifs}${e.autres ? ` et ${pluriel(e.autres, 'autre actif', 'autres actifs')}` : ''}`;
}

/** Bandeau du détail : machines de première ligne (front) qui portent une faille à exploitation avérée. Aucun lien entre
    machines n'est affirmé. */
export function bandeauPremiereLigne(n: number): string | null {
  if (!n) return null;
  return n > 1
    ? `${n} machines de première ligne (front) portent une faille dont l’exploitation est avérée.`
    : 'Une machine de première ligne (front) porte une faille dont l’exploitation est avérée.';
}
