/* Module Vulnérabilités (ADR 0100, lot PC2) : écran « Machines », mode « Parc », côté interface. Fonctions pures : adresse
   de la route, nom accessible d'une tuile, libellés des marques, poids des zones en grand écran. La répartition par zone,
   la borne et le mode réduit sont dans le paquet partagé (parc-machines.ts). */
import {
  type MachineMarqueeDto,
  type NiveauPriorite,
  type ParcMachinesDto,
  ROLES_MACHINE,
  ZONE_PARC_LIBELLES,
  type ZoneParc,
  zoneParc,
} from '@suivi/shared';
import { type FiltresMachines, libelleMachine } from './failles';

export const CLE_PARC = ['vulnerabilites', 'machines', 'parc'] as const;

/** Adresse du parc (mêmes filtres que la liste, sans page). */
export function urlParc(f: FiltresMachines): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.role) p.set('role', f.role);
  if (f.perimetre) p.set('perimetre', f.perimetre);
  const s = p.toString();
  return `/api/vulnerabilites/machines/parc${s ? `?${s}` : ''}`;
}

/** Libellés exacts des marques (infobulle, légende, nom accessible). La marque « zero-day » suit la définition du lot V6 :
    une faille présente dont l'exploitation est avérée. */
export const MARQUE_ZERO_DAY = 'Zero-day : exploitation avérée';
export const MARQUE_EXPLOITABLE = 'Exploitable : code d’exploitation disponible, sans exploitation avérée';
export const LEGENDE_ZERO_DAY =
  'Zero-day : une faille présente dont l’exploitation est avérée (catalogue KEV, CERT-FR, CERT Santé ou AlgoLightHouse)';
export const LEGENDE_EXPLOITABLE =
  'Exploitable : une faille présente pour laquelle un code d’exploitation existe (Tenable, preuve de concept), sans exploitation avérée';

export const libellePrioriteMachine = (p: NiveauPriorite | null) => (p ? p : 'Aucune');

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Failles présentes par gravité, en clair ; seules les gravités non nulles. */
export function libelleGravites(c: MachineMarqueeDto['compteurs']): string {
  const parts = [
    c.critique ? pluriel(c.critique, 'critique', 'critiques') : '',
    c.elevee ? pluriel(c.elevee, 'élevée', 'élevées') : '',
    c.moyenne ? pluriel(c.moyenne, 'moyenne', 'moyennes') : '',
    c.faible ? pluriel(c.faible, 'faible', 'faibles') : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'aucune faille présente';
}

/** Nom accessible d'une tuile : « srv-… : rang 3 sur 150, front, 2 critiques, priorité P1, zero-day, exploitation avérée ». */
export function nomAccessibleMachine(m: MachineMarqueeDto): string {
  const parts = [
    `rang ${m.rang.position} sur ${m.rang.total}`,
    ZONE_PARC_LIBELLES[zoneParc(m.role)].toLowerCase(),
    libelleGravites(m.compteurs),
    m.marques.priorite ? `priorité ${m.marques.priorite}` : 'aucune priorité',
    ...(m.marques.exploitationAveree ? ['zero-day, exploitation avérée'] : []),
    ...(m.marques.exploitable ? ['exploitable, code d’exploitation disponible'] : []),
  ];
  return `${libelleMachine(m)} : ${parts.join(', ')}`;
}

/** Poids de chaque zone de rôle en grand écran (1 à 4), selon le nombre de tuiles montrées : la zone la plus peuplée prend
    plus de largeur, sans style en ligne (une classe par poids). */
export function poidsZones(montrees: Record<(typeof ROLES_MACHINE)[number], number>): Record<string, number> {
  const max = Math.max(1, ...ROLES_MACHINE.map((r) => montrees[r]));
  return Object.fromEntries(
    ROLES_MACHINE.map((r) => [r, Math.min(4, Math.max(1, Math.ceil((4 * montrees[r]) / max)))]),
  ) as Record<string, number>;
}

/** Zone d'un parc reçu. */
export const zoneDe = (p: ParcMachinesDto, z: ZoneParc) => p.zones.find((x) => x.zone === z);
