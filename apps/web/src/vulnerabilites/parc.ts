/* Module Vulnérabilités (ADR 0100, lot PC2) : écran « Machines », mode « Parc », côté interface. Fonctions pures : adresse
   de la route, nom accessible d'une tuile, libellés des marques, poids des zones en grand écran. La répartition par zone,
   la borne et le mode réduit sont dans le paquet partagé (parc-machines.ts). */
import {
  LIBELLE_EXPLOITATION_AVEREE,
  LIBELLE_ZERO_DAY,
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
  if (f.finSupport) p.set('finSupport', 'oui');
  const s = p.toString();
  return `/api/vulnerabilites/machines/parc${s ? `?${s}` : ''}`;
}

/** Libellés exacts des marques (infobulle, légende, nom accessible). Lot PRIO-1 (décision du RSSI du 20/11/2026) : le
    triangle dit « exploitation avérée » (une faille présente exploitée) ; le mot « zero-day » est réservé à une faille
    exploitée sans correctif connu (REGLE_ZERO_DAY du paquet partagé). */
export const MARQUE_ZERO_DAY = LIBELLE_ZERO_DAY;
export const MARQUE_EXPLOITATION_AVEREE = LIBELLE_EXPLOITATION_AVEREE;
export const MARQUE_EXPLOITABLE = 'Exploitable : code d’exploitation disponible, sans exploitation avérée';
export const LEGENDE_EXPLOITATION_AVEREE =
  'Exploitation avérée : une faille présente est exploitée (catalogue KEV, CERT-FR, CERT Santé, AlgoLightHouse ou logiciel malveillant selon Tenable)';
export const LEGENDE_ZERO_DAY =
  'Zero-day : une faille présente dont l’exploitation est avérée et pour laquelle aucun correctif n’est connu (le CERT Santé écrit « Un correctif existe : Non ») ; ni « récente », ni « critique »';
export const LEGENDE_EXPLOITABLE =
  'Exploitable : une faille présente pour laquelle un code d’exploitation existe (Tenable, kit d’exploitation, preuve de concept), sans exploitation avérée';

/** Lot S3, précisé par le lot PRIO-1 : mention écrite à côté du triangle quand une faille exploitée n'a aucun correctif
    connu (le seul cas « zero-day ») ; marque « Fin de support ». */
export const PRECISION_SANS_CORRECTIF = LIBELLE_ZERO_DAY;
export const MARQUE_FIN_SUPPORT = 'Fin de support : plus de correctif de sécurité de l’éditeur';
export const LEGENDE_FIN_SUPPORT =
  'Fin de support : un système ou un logiciel présent sur la machine ne reçoit plus de correctif de sécurité de l’éditeur (date de fin de support publiée par Tenable, passée)';
export const LEGENDE_SANS_CORRECTIF =
  'Zero-day : mention écrite à côté du triangle quand une source dit qu’aucun correctif n’existe (CERT Santé) ; un correctif non renseigné n’est pas un correctif absent, la faille reste dite « exploitation avérée »';

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

/** Nom accessible d'une tuile : « srv-… : rang 3 sur 150, front, 2 critiques, priorité P1, exploitation avérée,
    zero-day, sans correctif connu ». */
export function nomAccessibleMachine(m: MachineMarqueeDto): string {
  const parts = [
    `rang ${m.rang.position} sur ${m.rang.total}`,
    ZONE_PARC_LIBELLES[zoneParc(m.role)].toLowerCase(),
    libelleGravites(m.compteurs),
    m.marques.priorite ? `priorité ${m.marques.priorite}` : 'aucune priorité',
    ...(m.marques.exploitationAveree ? ['exploitation avérée'] : []),
    ...(m.marques.exploiteeSansCorrectif ? ['zero-day, sans correctif connu'] : []),
    ...(m.marques.exploitable ? ['exploitable, code d’exploitation disponible'] : []),
    ...(m.finDeSupport ? ['fin de support'] : []),
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
