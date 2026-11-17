/* Failles détectées par Tenable et machines (ADR 0100, lot V5) : présentation sans état ni appel réseau (testée à part). Le
   serveur reste seul juge des droits (module, périmètre de chaque machine) ; les textes de Tenable s'affichent tels quels,
   en anglais (V19), comme texte simple. Un lien « voir aussi » n'est rendu que s'il a la forme contrôlée (https).
   Lot V4a : priorité calculée par la plateforme (niveau et faits), failles déclarées, rang des machines. Lot V4b : filtre
   de suivi (vide : failles encore à traiter ; un état ; « à clore » ; « tous »). Lot V4d : origine du périmètre d'une
   machine (hérité du dépôt Tenable ou indiqué à la main). */
import {
  type ConstatDto,
  type ConstatResumeDto,
  type FiltreSuivi,
  GRAVITE_TENABLE_LIBELLES,
  type GraviteTenable,
  libelleFaitPriorite,
  libelleFaitRang,
  type MachineDto,
  type NiveauPriorite,
  type Priorite,
  type RangMachineDto,
  ROLE_MACHINE_LIBELLES,
  type RoleMachine,
  VOIR_AUSSI,
} from '@suivi/shared';
import type { Etat } from '@suivi/ui';

export interface FiltresConstats {
  q: string;
  gravite: GraviteTenable | '';
  exploite: boolean;
  exploitable: boolean;
  nonMaintenu: boolean;
  priorite: NiveauPriorite | '';
  /** Suivi (lot V4b) : vide, les failles encore à traiter. */
  etat: FiltreSuivi | '';
}
export const FILTRES_CONSTATS_VIDES: FiltresConstats = {
  q: '',
  gravite: '',
  exploite: false,
  exploitable: false,
  nonMaintenu: false,
  priorite: '',
  etat: '',
};

/** Adresse de la liste des constats (recherche, filtres, page), lue par le serveur. */
export function urlConstats(f: FiltresConstats, page = 1): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.gravite) p.set('gravite', f.gravite);
  if (f.exploite) p.set('exploite', 'oui');
  if (f.exploitable) p.set('exploitable', 'oui');
  if (f.nonMaintenu) p.set('nonMaintenu', 'oui');
  if (f.priorite) p.set('priorite', f.priorite);
  if (f.etat) p.set('etat', f.etat);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/constats${s ? `?${s}` : ''}`;
}

/** Adresse des failles déclarées (CVE rattachées à un produit relié à des machines) : recherche, priorité, suivi, page. */
export function urlDeclarees(
  f: Pick<FiltresConstats, 'q' | 'priorite'> & { etat?: FiltreSuivi | '' },
  page = 1,
): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.priorite) p.set('priorite', f.priorite);
  if (f.etat) p.set('etat', f.etat);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/declarees${s ? `?${s}` : ''}`;
}

/** Sens de la puce de priorité (couleurs de la charte). */
export const ETAT_PRIORITE: Record<NiveauPriorite, Etat> = {
  P1: 'erreur',
  P2: 'attention',
  P3: 'info',
  P4: 'neutre',
};
/** Faits qui fondent une priorité, en clair. */
export const faitsPriorite = (p: Priorite) => p.faits.map(libelleFaitPriorite);
/** Faits qui fondent le rang d'une machine, en clair. */
export const faitsDuRang = (r: RangMachineDto) => r.faits.map(libelleFaitRang);

export interface FiltresMachines {
  q: string;
  role: RoleMachine | 'aucun' | '';
  perimetre: string;
}
export const FILTRES_MACHINES_VIDES: FiltresMachines = { q: '', role: '', perimetre: '' };

/** Adresse de la liste des machines (recherche par nom, rôle, périmètre, page). */
export function urlMachines(f: FiltresMachines, page = 1): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.role) p.set('role', f.role);
  if (f.perimetre) p.set('perimetre', f.perimetre);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/machines${s ? `?${s}` : ''}`;
}

export const GRAVITE_TENABLE_ETAT: Record<GraviteTenable, Etat> = {
  critique: 'erreur',
  elevee: 'attention',
  moyenne: 'info',
  faible: 'neutre',
};
export const libelleGravite = (g: GraviteTenable) => GRAVITE_TENABLE_LIBELLES[g];
export const libelleRole = (r: RoleMachine | null) => (r ? ROLE_MACHINE_LIBELLES[r] : 'Rôle non renseigné');

/** Nom affiché d'une machine : son nom, à défaut son adresse. */
export const libelleMachine = (m: { nom: string | null; adresse: string | null }) =>
  m.nom ?? m.adresse ?? 'Machine sans nom';

/** Marques d'un constat, dans l'ordre d'affichage. */
export function marquesConstat(c: Pick<ConstatResumeDto, 'exploite' | 'exploitable' | 'nonMaintenu'>) {
  const out: { libelle: string; etat: Etat }[] = [];
  if (c.exploite) out.push({ libelle: 'Exploitée (KEV)', etat: 'erreur' });
  if (c.exploitable) out.push({ libelle: 'Exploitable', etat: 'attention' });
  if (c.nonMaintenu) out.push({ libelle: 'Non maintenu', etat: 'neutre' });
  return out;
}

/** CVE résumées : les premières, puis le reste en nombre ; « aucune CVE » pour un système qui n'est plus maintenu. */
export function resumeCves(c: Pick<ConstatResumeDto, 'cves' | 'nombreCves'>): string {
  if (!c.nombreCves) return 'Aucune CVE';
  const reste = c.nombreCves - c.cves.length;
  return reste > 0 ? `${c.cves.join(', ')} et ${reste} autre${reste > 1 ? 's' : ''}` : c.cves.join(', ');
}

/** Score EPSS (probabilité entre 0 et 1) en pourcentage. */
export const libelleEpssTenable = (e: number | null) =>
  e === null ? '—' : `${(e * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/** Lien « voir aussi » seulement s'il a la forme contrôlée (https). */
export const lienVoirAussi = (c: Pick<ConstatDto, 'voirAussi'>) =>
  c.voirAussi && VOIR_AUSSI.test(c.voirAussi) ? c.voirAussi : null;

/** Groupes de la fiche d'un constat, dans l'ordre : front, back, base de données, rôle non renseigné ; vides omis. */
export function groupesParRole(c: Pick<ConstatDto, 'parRole'>) {
  return (['front', 'back', 'bdd', 'aucun'] as const)
    .map((r) => ({
      role: r,
      libelle: r === 'aucun' ? 'Rôle non renseigné' : ROLE_MACHINE_LIBELLES[r],
      machines: c.parRole[r],
    }))
    .filter((g) => g.machines.length > 0);
}

/** Corps de l'affectation en masse : chaque machine avec sa version ; rôle ou périmètre (vide : inchangé, « aucun » :
    retiré ; pour le périmètre, la machine reprend alors celui de son dépôt, lot V4d). */
export function corpsAffectation(
  machines: Pick<MachineDto, 'id' | 'version'>[],
  role: RoleMachine | 'aucun' | '',
  perimetre: string,
) {
  return {
    machines: machines.map((m) => ({ id: m.id, version: m.version })),
    ...(role ? { role: role === 'aucun' ? null : role } : {}),
    ...(perimetre ? { perimetreId: perimetre === 'aucun' ? null : perimetre } : {}),
  };
}

/** Origine du périmètre d'une machine, en clair (lot V4d) ; `null` si elle n'a pas de périmètre. */
export function originePerimetre(m: Pick<MachineDto, 'perimetreOrigine' | 'depot'>): string | null {
  if (m.perimetreOrigine === 'depot') return m.depot ? `Hérité du dépôt « ${m.depot.nom} »` : 'Hérité du dépôt';
  if (m.perimetreOrigine === 'machine') return 'Indiqué à la main';
  return null;
}

export const totalCompteurs = (m: Pick<MachineDto, 'compteurs'>) =>
  m.compteurs.critique + m.compteurs.elevee + m.compteurs.moyenne + m.compteurs.faible;
