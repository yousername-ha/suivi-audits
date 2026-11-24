/* Failles détectées par Tenable et machines (ADR 0100, lot V5) : présentation sans état ni appel réseau (testée à part). Le
   serveur reste seul juge des droits (module, périmètre de chaque machine) ; les textes de Tenable s'affichent tels quels,
   en anglais (V19), comme texte simple. Un lien « voir aussi » n'est rendu que s'il a la forme contrôlée (https).
   Lot V4a : priorité calculée par la plateforme (niveau et faits), failles déclarées, rang des machines. Lot V4b : filtre
   de suivi (vide : failles encore à traiter ; un état ; « à clore » ; « tous »). Lot V4d : origine du périmètre d'une
   machine (hérité du dépôt Tenable ou indiqué à la main). Lot S1 : filtre par état de délai de correction et tri par
   échéance, repris de l'adresse (lien de la tuile « En dépassement » et de la notification de résumé). Lot S3 : marque
   et filtre « Fin de support » (constats et machines), repris de l'adresse (`finSupport=oui`). Lot N1 : source d'une
   machine ou d'un constat (instance Security Center ou import Nessus), marquée dans les listes. */
import {
  CATEGORIE_ACR_LIBELLES,
  CATEGORIE_AES_LIBELLES,
  categorieAcr,
  categorieAes,
  type EtatSynchronisationDto,
  FILTRE_ACR_LIBELLES,
  FILTRE_AES_LIBELLES,
  FILTRES_ACR,
  FILTRES_AES,
  type FiltreAcr,
  type FiltreAes,
  type ConstatDto,
  type ConstatResumeDto,
  FIN_SUPPORT_LIBELLE,
  FILTRES_SUIVI,
  type FiltreSuivi,
  GRAVITE_TENABLE_LIBELLES,
  SOURCE_EXPLOITATION_LIBELLES,
  SOURCE_EXPLOITATION_LIBELLES_COMPLETS,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type KitExploitation,
  libelleFaitPriorite,
  libelleFaitPrioriteComplet,
  libelleFaitRang,
  libelleKits,
  type SourcesFailleDto,
  type MachineDto,
  NIVEAUX_PRIORITE,
  type OrigineConnecteurDto,
  SOURCE_MACHINE_LIBELLES,
  type NiveauPriorite,
  type Priorite,
  type RangMachineDto,
  ETATS_DELAI,
  type EtatDelai,
  TRIS_FAILLES,
  type TriFailles,
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
  /** Lot S3 : fin de support selon Tenable. */
  finSupport: boolean;
  priorite: NiveauPriorite | '';
  /** Suivi (lot V4b) : vide, les failles encore à traiter. */
  etat: FiltreSuivi | '';
  /** Lot S1 : état du délai de correction (vide : tous) et tri (vide : par priorité). */
  delai: EtatDelai | '';
  tri: TriFailles | '';
}
export const FILTRES_CONSTATS_VIDES: FiltresConstats = {
  q: '',
  gravite: '',
  exploite: false,
  exploitable: false,
  nonMaintenu: false,
  finSupport: false,
  priorite: '',
  etat: '',
  delai: '',
  tri: '',
};

/** Filtres repris de l'adresse de l'écran (liens des tuiles de la Vue d'ensemble, lot PC1) : `q`, `priorite`, `etat`,
    `gravite`, `exploite=oui`, `exploitable=oui`, et (lot S1) `delai`, `tri` ; toute valeur inconnue est ignorée. */
export function filtresDepuisAdresse(p: URLSearchParams): FiltresConstats {
  const dans = <T extends string>(liste: readonly T[], v: string | null): T | '' =>
    v !== null && (liste as readonly string[]).includes(v) ? (v as T) : '';
  return {
    ...FILTRES_CONSTATS_VIDES,
    q: (p.get('q') ?? '').trim().slice(0, 100),
    priorite: dans(NIVEAUX_PRIORITE, p.get('priorite')),
    etat: dans(FILTRES_SUIVI, p.get('etat')),
    gravite: dans(GRAVITES_TENABLE, p.get('gravite')),
    exploite: p.get('exploite') === 'oui',
    exploitable: p.get('exploitable') === 'oui',
    finSupport: p.get('finSupport') === 'oui',
    delai: dans(ETATS_DELAI, p.get('delai')),
    tri: dans(TRIS_FAILLES, p.get('tri')),
  };
}

/** Adresse de la liste des constats (recherche, filtres, page), lue par le serveur. */
export function urlConstats(f: FiltresConstats, page = 1): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.gravite) p.set('gravite', f.gravite);
  if (f.exploite) p.set('exploite', 'oui');
  if (f.exploitable) p.set('exploitable', 'oui');
  if (f.nonMaintenu) p.set('nonMaintenu', 'oui');
  if (f.finSupport) p.set('finSupport', 'oui');
  if (f.priorite) p.set('priorite', f.priorite);
  if (f.etat) p.set('etat', f.etat);
  if (f.delai) p.set('delai', f.delai);
  if (f.tri) p.set('tri', f.tri);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/constats${s ? `?${s}` : ''}`;
}

/** Adresse des failles déclarées (CVE rattachées à un produit relié à des machines) : recherche, priorité, suivi, page. */
export function urlDeclarees(
  f: Pick<FiltresConstats, 'q' | 'priorite'> & {
    etat?: FiltreSuivi | '';
    delai?: EtatDelai | '';
    tri?: TriFailles | '';
  },
  page = 1,
): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.priorite) p.set('priorite', f.priorite);
  if (f.etat) p.set('etat', f.etat);
  if (f.delai) p.set('delai', f.delai);
  if (f.tri) p.set('tri', f.tri);
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
/** Faits qui fondent une priorité, en clair (libellés courts des listes). */
export const faitsPriorite = (p: Priorite) => p.faits.map(libelleFaitPriorite);
/** Lot PRIO-1 : faits d'une priorité pour la fiche d'une faille (terme officiel de Tenable, « Exploited by malware »). */
export const faitsPrioriteComplets = (p: Priorite) => p.faits.map(libelleFaitPrioriteComplet);
/** Faits qui fondent le rang d'une machine, en clair. */
export const faitsDuRang = (r: RangMachineDto) => r.faits.map(libelleFaitRang);

export interface FiltresMachines {
  q: string;
  role: RoleMachine | 'aucun' | '';
  perimetre: string;
  /** Lot S3 : machines en fin de support seulement (facultatif). */
  finSupport?: boolean;
  /** Lot TEN-SCORES : catégorie minimale de criticité (ACR) et d'exposition (AES) selon Tenable (facultatif ; vide : tous). */
  acr?: FiltreAcr | '';
  aes?: FiltreAes | '';
  /** Lot GRP-MACHINES : un groupe, ou `aucun` (sans groupe) ; vide : tous les groupes. */
  groupe?: string;
}
export const FILTRES_MACHINES_VIDES: FiltresMachines = { q: '', role: '', perimetre: '' };

/** Paramètres communs de la liste et du parc des machines. */
export function parametresMachines(f: FiltresMachines): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.role) p.set('role', f.role);
  if (f.perimetre) p.set('perimetre', f.perimetre);
  if (f.finSupport) p.set('finSupport', 'oui');
  if (f.acr) p.set('acr', f.acr);
  if (f.aes) p.set('aes', f.aes);
  if (f.groupe) p.set('groupe', f.groupe);
  return p;
}

/** Adresse de la liste des machines (recherche par nom, rôle, périmètre, fin de support, ACR, AES, groupe, page). */
export function urlMachines(f: FiltresMachines, page = 1): string {
  const p = parametresMachines(f);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `/api/vulnerabilites/machines${s ? `?${s}` : ''}`;
}

/* ------------------------------------------------------------------ Lot TEN-SCORES : ACR et AES selon Tenable */
/** Clé de l'état des synchronisations de Tenable (`/api/vulnerabilites/synchronisation`), la même que celle des écrans
    « Failles détectées » et « Vue d'ensemble » (même réponse, même forme). */
export const CLE_ETAT_TENABLE = ['vulnerabilites', 'failles', 'etat'] as const;
export const URL_ETAT_TENABLE = '/api/vulnerabilites/synchronisation';
/** Une intégration Tenable Security Center existe (au moins une instance de type `tenable`, active ou non ; un connecteur
    d'import Nessus ne compte pas) : l'ACR et l'AES, leurs colonnes et leurs filtres ne sont montrés qu'à cette condition.
    Réponse absente (chargement, erreur) : non. */
export const tenableConfigure = (etats: readonly EtatSynchronisationDto[] | undefined) => !!etats?.length;
/** Filtres réellement envoyés : sans intégration Tenable, ceux de l'ACR et de l'AES (masqués) ne s'appliquent pas. */
export const filtresAvecScores = (f: FiltresMachines, tenable: boolean): FiltresMachines =>
  tenable ? f : { ...f, acr: '', aes: '' };

/** Valeur seule, en chiffres français sans séparateur de milliers, comme Tenable (« 1000 » ; ACR décimale possible :
    « 8,5 »). */
const chiffre = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1, useGrouping: false });
/** Texte affiché quand Tenable ne fournit pas la valeur (jamais 0). */
export const SCORE_ABSENT = '—';
export const SCORE_ABSENT_EXPLICATION = 'Non fournie par Tenable';
/** ACR en clair : « 9 · Critique » ; valeur absente : « — ». */
export function libelleAcr(v: number | null): string {
  const c = categorieAcr(v);
  return v === null || !c ? SCORE_ABSENT : `${chiffre(v)} · ${CATEGORIE_ACR_LIBELLES[c]}`;
}
/** AES en clair : « 700 · Élevée » ; valeur absente : « — ». */
export function libelleAes(v: number | null): string {
  const c = categorieAes(v);
  return v === null || !c ? SCORE_ABSENT : `${chiffre(v)} · ${CATEGORIE_AES_LIBELLES[c]}`;
}
/** Choix des filtres (catégorie minimale). */
export const OPTIONS_FILTRE_ACR = FILTRES_ACR.map((v) => ({ value: v, label: FILTRE_ACR_LIBELLES[v] }));
export const OPTIONS_FILTRE_AES = FILTRES_AES.map((v) => ({ value: v, label: FILTRE_AES_LIBELLES[v] }));

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

/** Marques d'un constat, dans l'ordre d'affichage. Lot S3 : « Fin de support » (date de fin de support de Tenable passée),
    distincte de « Non maintenu » (constat sans CVE, V18). Lot N2 : exploitation avérée propre au contrôle (import Nessus),
    libellé court « Logiciel malveillant (Tenable) » dans les listes (lot PRIO-1). Lot PRIO-1 : « Rançongiciels (KEV) »,
    « Kit d'exploitation : … (Tenable) » et « Sur une machine en fin de support » (un cran de priorité de plus). */
export function marquesConstat(
  c: Pick<ConstatResumeDto, 'exploite' | 'exploiteMalware' | 'exploitable' | 'nonMaintenu'> & {
    finDeSupport?: boolean;
    kitsExploitation?: readonly KitExploitation[];
    surMachineFinSupport?: boolean;
    sources?: Pick<SourcesFailleDto, 'rancongiciel'>;
  },
  /** Fiche d'une faille : libellés complets, termes officiels de Tenable (« Exploited by malware », « Exploitable with »). */
  complet = false,
) {
  const out: { libelle: string; etat: Etat }[] = [];
  if (c.exploite) out.push({ libelle: 'Exploitée (KEV)', etat: 'erreur' });
  if (c.sources?.rancongiciel) out.push({ libelle: MARQUE_RANCONGICIEL, etat: 'erreur' });
  if (c.exploiteMalware)
    out.push({
      libelle: (complet ? SOURCE_EXPLOITATION_LIBELLES_COMPLETS : SOURCE_EXPLOITATION_LIBELLES).tenable,
      etat: 'erreur',
    });
  if (c.exploitable) out.push({ libelle: 'Exploitable', etat: 'attention' });
  if (c.kitsExploitation?.length)
    out.push({
      libelle: complet ? marqueKitsComplete(c.kitsExploitation) : marqueKits(c.kitsExploitation),
      etat: 'attention',
    });
  if (c.finDeSupport) out.push({ libelle: FIN_SUPPORT_LIBELLE, etat: 'attention' });
  else if (c.surMachineFinSupport) out.push({ libelle: MARQUE_MACHINE_FIN_SUPPORT, etat: 'attention' });
  if (c.nonMaintenu) out.push({ libelle: 'Non maintenu', etat: 'neutre' });
  return out;
}

/** Ligne allégée de « Failles détectées » (choix du RSSI du 22/11/2026) : faits d'une faille, sans doublon ni détail de
    source (la fiche les donne, section « Ce que disent les sources ») : exploitation avérée (quelle qu'en soit la source),
    rançongiciels, exploitable (kits compris), fin de support, non maintenu. */
export function faitsListe(
  c: Pick<
    ConstatResumeDto,
    | 'exploite'
    | 'exploiteMalware'
    | 'exploitable'
    | 'kitsExploitation'
    | 'finDeSupport'
    | 'surMachineFinSupport'
    | 'nonMaintenu'
    | 'sources'
  >,
): { libelle: string; etat: Etat }[] {
  const out: { libelle: string; etat: Etat }[] = [];
  if (c.exploite || c.exploiteMalware || c.sources.exploitation.length)
    out.push({ libelle: 'Exploitation avérée', etat: 'erreur' });
  if (c.sources.rancongiciel) out.push({ libelle: MARQUE_RANCONGICIEL, etat: 'erreur' });
  if (c.exploitable || c.kitsExploitation.length || c.sources.exploitable.length)
    out.push({ libelle: 'Exploitable', etat: 'attention' });
  if (c.finDeSupport) out.push({ libelle: FIN_SUPPORT_LIBELLE, etat: 'attention' });
  else if (c.surMachineFinSupport) out.push({ libelle: MARQUE_MACHINE_FIN_SUPPORT, etat: 'attention' });
  if (c.nonMaintenu) out.push({ libelle: 'Non maintenu', etat: 'neutre' });
  return out;
}

/** Raison courte d'une priorité dans la liste : premier fait, sans sa précision entre parenthèses (la fiche la donne). */
export const raisonPriorite = (p: Priorite) => (faitsPriorite(p)[0] ?? '').replace(/\s*\(.*$/, '');

/** Lot PRIO-1 : marques courtes des listes. */
export const MARQUE_RANCONGICIEL = 'Rançongiciels (KEV)';
export const MARQUE_MACHINE_FIN_SUPPORT = 'Sur une machine en fin de support';
export const marqueKits = (kits: readonly KitExploitation[]) => `Kit d’exploitation : ${libelleKits(kits)} (Tenable)`;
export const marqueKitsComplete = (kits: readonly KitExploitation[]) =>
  `Kit d’exploitation disponible selon Tenable (« Exploitable with ») : ${libelleKits(kits)}`;

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

/** Lot N1 : source d'une machine ou d'un constat, en clair (« Source : Nessus fictif (Nessus, import de fichier) »). Un
    contrôle Nessus reste un contrôle de Tenable ; la source est l'instance qui l'a rapporté. */
export const texteSource = (o: OrigineConnecteurDto) => `Source : ${o.nom} (${SOURCE_MACHINE_LIBELLES[o.type]})`;
