/* Module Vulnérabilités (ADR 0100, lot SI1 ; décisions du RSSI du 19/11/2026) : import du rapport Silène de l'ANSSI (surface
   exposée sur Internet d'un bénéficiaire, export JSON) déposé dans la carte « Intégrations » (connecteur « silene-fichier » :
   ni adresse, ni clé, ni flux, ni exécutant). Le fichier est lu dans le navigateur ; seul un extrait en liste blanche part
   vers l'API, en JSON, en trois temps comme l'import Nessus (lot N1) : début (synthèse du rapport, périmètre déclaré,
   nombres annoncés, éléments écartés), lots d'hôtes et de constats, fin. L'API revalide ici chaque champ ; un champ en trop
   ou une forme inattendue fait refuser tout le lot. Un import est l'état complet de la surface vue par Silène à la date du
   rapport : ce qui n'y figure plus n'est plus présent ; les notes des imports successifs sont gardées (tendance).
   Jamais gardés ni envoyés : certificats et clés, en-têtes HTTP, sorties brutes des sondes, titres de pages, géolocalisation
   et système autonome, `db_name`, `filter`, le passage précédent (`_prev`), le nom du fichier.
   Forme relevée sur un export réel par un programme qui n'en a sorti que les noms de champs, les types et les nombres ;
   AUCUNE valeur réelle n'est connue. Non vérifié : sens des valeurs de `result_class`, échelle de `grade`, format exact des
   dates de 19 caractères (lues « AAAA-MM-JJ HH:MM:SS » ou « AAAA-MM-JJTHH:MM:SS », sans fuseau), sens de `networks` (non lu). */
import { z } from 'zod';
import { ADRESSE_IP } from './failles-tenable.js';
import { NESSUS_BORNES } from './import-nessus.js';
import { type ActifAlhDto, NOM_DOMAINE_ALH, type ServiceAlhDto } from './surface-externe.js';
import { texteExterneValide } from './veille-vulnerabilites.js';

/** Identifiant du type de connecteur (catalogue des intégrations). */
export const TYPE_SILENE_FICHIER = 'silene-fichier' as const;

/** Bornes de l'import, reprises par le navigateur (découpe en lots) et par l'API (revalidation). */
export const SILENE_BORNES = {
  /** Taille maximale du fichier lu dans le navigateur, en mégaoctets (Mo de 1 000 000 octets). */
  fichierMo: 50,
  hotesParImport: 20000,
  constatsParImport: 5000,
  hotesParLot: 500,
  constatsParLot: 200,
  /** Ports gardés par hôte : au-delà, les suivants sont écartés et comptés (le nombre annoncé par Silène reste). */
  portsParHote: 1000,
  nomsParHote: 200,
  produitsParHote: 200,
  controlesParHote: 100,
  /** Hôtes concernés par un constat. */
  hotesParConstat: 20000,
  /** Lignes du détail d'un constat (toutes adresses confondues) ; au-delà, écartées et comptées. */
  lignesParConstat: 5000,
  /** Lignes gardées pour un même hôte d'un constat. */
  lignesParHote: 100,
  /** Périmètre déclaré : noms de domaine et adresses ou plages. */
  perimetreDomaines: 5000,
  perimetrePlages: 5000,
  /** Textes courts (service, produit, tunnel, éditeur, version, type de ligne). */
  texte: 100,
  nomDomaine: 253,
  /** Taille visée d'un lot par le navigateur (JSON), et taille admise du corps par l'API. */
  octetsParLot: 3 * 1024 * 1024,
  corpsLot: 8 * 1024 * 1024,
  corpsDebut: 2 * 1024 * 1024,
  lotsParImport: 1000,
  /** Un import resté sans lot pendant ce délai (minutes) est clos comme interrompu. */
  inactiviteMinutes: 30,
  /** Même limite que l'import Nessus (lot N2) : fichiers commencés par heure et par personne, tous imports confondus. */
  importsParHeure: NESSUS_BORNES.importsParHeure,
  /** Notes passées rendues pour la tendance. */
  historique: 24,
} as const;

/* ------------------------------------------------------------------ Formes contrôlées */
/** Nom d'un contrôle de Silène (clé de `$.modules`) : un identifiant ; un nom absent de la liste connue est accepté. */
export const CONTROLE_SILENE = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
/** Identifiant d'un constat (`id` d'un élément de `$.results`) : forme prudente, 64 caractères au plus. */
export const IDENTIFIANT_CONSTAT_SILENE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
/** Plage d'adresses du périmètre déclaré : adresse, ou adresse et longueur de préfixe. */
export const PLAGE_SILENE = /^[0-9a-f:.]{2,45}(?:\/(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-8]))?$/;
/** Horodatage du rapport, normalisé « AAAA-MM-JJTHH:MM:SS », sans fuseau (le rapport n'en donne pas). */
export const HORODATAGE_SILENE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
/** Plage valide : adresse IP admise et longueur de préfixe d'au plus 32 (IPv4) ou 128 (IPv6). */
export function plageSileneValide(v: string): boolean {
  if (v.length > 49 || !PLAGE_SILENE.test(v)) return false;
  const [adresse, prefixe] = v.split('/') as [string, string | undefined];
  if (!ADRESSE_IP.test(adresse)) return false;
  return prefixe === undefined || Number(prefixe) <= (adresse.includes(':') ? 128 : 32);
}
export const DATE_SILENE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/** Contrôles relevés dans un export (noms publics) ; un autre nom de forme admise est accepté tel quel. */
export const CONTROLES_SILENE_CONNUS = [
  'Authentication',
  'DICOM',
  'Databases',
  'DeprecatedIisServer',
  'DeprecatedOwa',
  'DeprecatedSharePoint',
  'DeprecatedSqlServer',
  'DeprecatedWindows',
  'DnsAuthoritative',
  'DnsAxfr',
  'DnsRecursion',
  'ExpiredCertificate',
  'FortiGateManagementInterface',
  'HighOpenPort',
  'Hostname',
  'HttpGit',
  'HttpInternalAuthentication',
  'HttpVersion',
  'Imprimantes',
  'IndustrialAssets',
  'InterfacesAdmin',
  'InterfacesAdminDeprecated',
  'InterfacesOutOfBand',
  'InternalServices',
  'InternalShare',
  'Kerberos',
  'NonRoutableName',
  'NonStandardHttpPorts',
  'NonStandardSshPorts',
  'OpenPort',
  'Owa',
  'PPTP',
  'PhoneServices',
  'QnapAdminName',
  'Relays',
  'RemoteAccess',
  'SMI',
  'Scanner',
  'SecretSharedFile',
  'SelfSignedCertificate',
  'SharePoint',
  'SharedFile',
  'SynAckHoneypot',
  'SynologyAdminName',
  'TACACS',
  'TFTP',
  'UnknownSshServer',
  'WeakKeyCertificate',
  'WindowsInternalAuthentication',
  'regreSSHionSshServer',
] as const;

/** Types de nom d'un hôte relevés dans l'export ; un autre type est écarté et compté. */
export const TYPES_NOM_SILENE = ['A', 'PTR', 'cert-san-dns', 'cert-subject-cn'] as const;
export const TypeNomSilene = z.enum(TYPES_NOM_SILENE);
export type TypeNomSilene = z.infer<typeof TypeNomSilene>;
export const TYPE_NOM_SILENE_LIBELLES: Record<TypeNomSilene, string> = {
  A: 'résolution directe (A)',
  PTR: 'résolution inverse (PTR)',
  'cert-san-dns': 'nom cité par un certificat (SAN)',
  'cert-subject-cn': 'nom du sujet d’un certificat (CN)',
};
/** Seuls les noms de résolution directe font d'un nom de domaine un actif de la liste commune (choix du lot SI1). */
export const TYPES_NOM_ACTIF: readonly TypeNomSilene[] = ['A'];

export const PROTOCOLES_SILENE = ['tcp', 'udp'] as const;
export const ProtocoleSilene = z.enum(PROTOCOLES_SILENE);
export type ProtocoleSilene = z.infer<typeof ProtocoleSilene>;

/** Partie d'un identifiant CPE : application, système, matériel. */
export const TYPES_CPE_SILENE = ['a', 'o', 'h'] as const;
export const TypeCpeSilene = z.enum(TYPES_CPE_SILENE);
export const TYPE_CPE_SILENE_LIBELLES: Record<(typeof TYPES_CPE_SILENE)[number], string> = {
  a: 'application',
  o: 'système',
  h: 'matériel',
};

/* ------------------------------------------------------------------ Classe d'un constat */
/** Familles comptées par la synthèse du rapport (`vulnreco_count`, `warning_count`, `info_count`, `ok_count`). */
export const FAMILLES_SILENE = ['vulnreco', 'warning', 'info', 'ok'] as const;
export type FamilleSilene = (typeof FAMILLES_SILENE)[number];
export const FAMILLE_SILENE_LIBELLES: Record<FamilleSilene, string> = {
  vulnreco: 'Vulnérabilités ou recommandations (vulnreco)',
  warning: 'Avertissements (warning)',
  info: 'Informations (info)',
  ok: 'Conformes (ok)',
};
export const CLASSE_SILENE_MIN = -1000;
export const CLASSE_SILENE_MAX = 1000;
/** Correspondance de la classe d'un constat (`result_class`, entier) vers sa famille. NON CONNUE à la date du lot SI1 :
    table vide, à compléter ici (et seulement ici) quand la correspondance sera confirmée sur un export réel ou par l'ANSSI.
    Tant qu'une classe n'y figure pas, l'interface affiche « classe N ». */
export const CLASSES_SILENE: Readonly<Partial<Record<number, FamilleSilene>>> = {};
export const familleClasseSilene = (classe: number): FamilleSilene | null => CLASSES_SILENE[classe] ?? null;
export function libelleClasseSilene(classe: number): string {
  const f = familleClasseSilene(classe);
  return f ? FAMILLE_SILENE_LIBELLES[f] : `classe ${classe}`;
}

/* ------------------------------------------------------------------ Champs de l'extrait */
const texte = (max: number) =>
  z.string().min(1).max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');
const adresse = z.string().max(45).regex(ADRESSE_IP, 'Adresse IP attendue.');
const domaine = z.string().max(SILENE_BORNES.nomDomaine).regex(NOM_DOMAINE_ALH, 'Nom de domaine attendu.');
const controle = z.string().regex(CONTROLE_SILENE, 'Nom de contrôle attendu.');
const horodatage = z.string().regex(HORODATAGE_SILENE, 'Horodatage attendu.').nullable();
const compte = (max: number) => z.number().int().min(0).max(max);
const COMPTE_MAX = 10_000_000;
/** Note ou points : nombre fini, quatre décimales au plus (échelle non connue : seulement bornée). */
export const NOTE_SILENE_MAX = 1_000_000;
const note = z
  .number()
  .finite()
  .min(-NOTE_SILENE_MAX)
  .max(NOTE_SILENE_MAX)
  .refine((v) => Math.round(v * 10000) / 10000 === v, 'Quatre décimales au plus.');

/** Synthèse du rapport (`$.summary` et `$.computation_date`) : note, sous-note réseau, nombres par famille, dates. */
export const RapportSilene = z
  .object({
    date: z.string().regex(DATE_SILENE).nullable(),
    debut: horodatage,
    fin: horodatage,
    note: note.nullable(),
    noteReseau: note.nullable(),
    vulnreco: compte(COMPTE_MAX).nullable(),
    warning: compte(COMPTE_MAX).nullable(),
    info: compte(COMPTE_MAX).nullable(),
    ok: compte(COMPTE_MAX).nullable(),
  })
  .strict();
export type RapportSilene = z.infer<typeof RapportSilene>;

/** Périmètre déclaré du bénéficiaire (`$.perimeter`) : noms de domaine et adresses ou plages. */
export const PerimetreDeclareSilene = z
  .object({
    domaines: z.array(domaine).max(SILENE_BORNES.perimetreDomaines),
    plages: z
      .array(z.string().max(49).refine(plageSileneValide, 'Adresse ou plage attendue.'))
      .max(SILENE_BORNES.perimetrePlages),
  })
  .strict()
  .refine((p) => new Set(p.domaines).size === p.domaines.length && new Set(p.plages).size === p.plages.length, {
    message: 'Valeur en double dans le périmètre déclaré.',
  });
export type PerimetreDeclareSilene = z.infer<typeof PerimetreDeclareSilene>;

export const NomHoteSilene = z.object({ nom: domaine, type: TypeNomSilene }).strict();
export type NomHoteSilene = z.infer<typeof NomHoteSilene>;

/** Port ouvert d'un hôte : port, protocole, service, produit et tunnel annoncés par la sonde (jamais sa sortie brute). */
export const PortSilene = z
  .object({
    port: z.number().int().min(1).max(65535),
    protocole: ProtocoleSilene,
    service: texte(SILENE_BORNES.texte).nullable(),
    produit: texte(SILENE_BORNES.texte).nullable(),
    tunnel: texte(SILENE_BORNES.texte).nullable(),
  })
  .strict();
export type PortSilene = z.infer<typeof PortSilene>;

/** Produit vu sur l'hôte (CPE : type, éditeur, produit, version ; jamais ses origines). */
export const ProduitSilene = z
  .object({
    type: TypeCpeSilene,
    editeur: texte(SILENE_BORNES.texte),
    produit: texte(SILENE_BORNES.texte),
    version: texte(SILENE_BORNES.texte).nullable(),
  })
  .strict();
export type ProduitSilene = z.infer<typeof ProduitSilene>;

const clePort = (p: Pick<PortSilene, 'port' | 'protocole'>) => `${p.port}/${p.protocole}`;
const cleProduit = (p: ProduitSilene) => `${p.type}\u0000${p.editeur}\u0000${p.produit}\u0000${p.version ?? ''}`;

/** Hôte (`$.hosts`) : adresse, noms, ports ouverts, produits, contrôles qui le concernent (`categories`). */
export const HoteSilene = z
  .object({
    adresse,
    noms: z.array(NomHoteSilene).max(SILENE_BORNES.nomsParHote),
    ports: z.array(PortSilene).max(SILENE_BORNES.portsParHote),
    /** Nombre de ports ouverts annoncé par Silène (`openports.count`), qui peut dépasser les ports gardés. */
    portsOuverts: compte(131070).nullable(),
    produits: z.array(ProduitSilene).max(SILENE_BORNES.produitsParHote),
    controles: z.array(controle).max(SILENE_BORNES.controlesParHote),
  })
  .strict()
  .superRefine((h, ctx) => {
    if (new Set(h.noms.map((n) => `${n.type}\u0000${n.nom}`)).size !== h.noms.length)
      ctx.addIssue({ code: 'custom', message: 'Nom en double sur un hôte.' });
    if (new Set(h.ports.map(clePort)).size !== h.ports.length)
      ctx.addIssue({ code: 'custom', message: 'Port en double sur un hôte.' });
    if (new Set(h.produits.map(cleProduit)).size !== h.produits.length)
      ctx.addIssue({ code: 'custom', message: 'Produit en double sur un hôte.' });
    if (new Set(h.controles).size !== h.controles.length)
      ctx.addIssue({ code: 'custom', message: 'Contrôle en double sur un hôte.' });
  });
export type HoteSilene = z.infer<typeof HoteSilene>;

/** Ligne du détail d'un constat (`listing`) pour un hôte : port, protocole, service, produit, nom d'hôte, type, échéance.
    Jamais le sujet ni les noms d'un certificat (`subject`, `san`). */
export const LigneSilene = z
  .object({
    hote: adresse,
    port: z.number().int().min(1).max(65535).nullable(),
    protocole: ProtocoleSilene.nullable(),
    service: texte(SILENE_BORNES.texte).nullable(),
    produit: texte(SILENE_BORNES.texte).nullable(),
    nomHote: domaine.nullable(),
    type: texte(SILENE_BORNES.texte).nullable(),
    echeance: horodatage,
  })
  .strict();
export type LigneSilene = z.infer<typeof LigneSilene>;

/** Constat (`$.results`) : identifiant, contrôle (module qui le cite), classe, points, hôtes concernés et lignes. */
export const ConstatSilene = z
  .object({
    identifiant: z.string().regex(IDENTIFIANT_CONSTAT_SILENE),
    controle,
    classe: z.number().int().min(CLASSE_SILENE_MIN).max(CLASSE_SILENE_MAX),
    /** Points en jeu pour le réseau (`max_points.network`). */
    points: note.nullable(),
    /** Note du constat pour le réseau (`grades.network`), si le rapport la donne. */
    note: note.nullable(),
    hotes: z.array(adresse).max(SILENE_BORNES.hotesParConstat),
    lignes: z.array(LigneSilene).max(SILENE_BORNES.lignesParConstat),
  })
  .strict()
  .refine((c) => new Set(c.hotes).size === c.hotes.length, { message: 'Hôte en double dans un constat.' });
export type ConstatSilene = z.infer<typeof ConstatSilene>;

/** Lot : des hôtes et des constats (l'un ou l'autre peut manquer, pas les deux). */
export const LotImportSilene = z
  .object({
    hotes: z.array(HoteSilene).max(SILENE_BORNES.hotesParLot),
    constats: z.array(ConstatSilene).max(SILENE_BORNES.constatsParLot),
  })
  .strict()
  .superRefine((l, ctx) => {
    if (!l.hotes.length && !l.constats.length) ctx.addIssue({ code: 'custom', message: 'Lot vide.' });
    if (new Set(l.hotes.map((h) => h.adresse)).size !== l.hotes.length)
      ctx.addIssue({ code: 'custom', message: 'Hôte en double dans le lot.' });
    if (new Set(l.constats.map((c) => c.identifiant)).size !== l.constats.length)
      ctx.addIssue({ code: 'custom', message: 'Constat en double dans le lot.' });
  });
export type LotImportSilene = z.infer<typeof LotImportSilene>;

/** Éléments écartés par le navigateur, comptés (jamais tronqués en silence) : nombres seulement. */
export const ECARTS_SILENE = [
  'hotesInvalides',
  'hotesAuDela',
  'nomsInvalides',
  'portsInvalides',
  'portsAuDela',
  'produitsInvalides',
  'controlesInvalides',
  'constatsInvalides',
  'constatsSansControle',
  'constatsAuDela',
  'lignesInvalides',
  'lignesAuDela',
  'perimetreInvalide',
  'valeursInvalides',
  'textesRaccourcis',
] as const;
export type EcartSilene = (typeof ECARTS_SILENE)[number];
export const ECART_SILENE_LIBELLES: Record<EcartSilene, string> = {
  hotesInvalides: 'hôtes sans adresse IP lisible',
  hotesAuDela: 'hôtes au-delà de la borne de l’import',
  nomsInvalides: 'noms d’hôte illisibles ou de type inconnu',
  portsInvalides: 'ports illisibles (numéro, protocole ou état)',
  portsAuDela: 'ports au-delà de la borne par hôte',
  produitsInvalides: 'produits (CPE) illisibles',
  controlesInvalides: 'noms de contrôle hors forme',
  constatsInvalides: 'constats illisibles (identifiant ou classe)',
  constatsSansControle: 'constats qu’aucun contrôle ne cite',
  constatsAuDela: 'constats au-delà de la borne de l’import',
  lignesInvalides: 'lignes de détail illisibles',
  lignesAuDela: 'lignes de détail au-delà de la borne',
  perimetreInvalide: 'valeurs du périmètre déclaré illisibles',
  valeursInvalides: 'valeurs hors norme (note, nombre, date)',
  textesRaccourcis: 'textes raccourcis à leur borne (marqués « … »)',
};
export const EcartsImportSilene = z
  .object(Object.fromEntries(ECARTS_SILENE.map((e) => [e, compte(COMPTE_MAX)])) as Record<EcartSilene, z.ZodNumber>)
  .strict();
export type EcartsImportSilene = z.infer<typeof EcartsImportSilene>;
export const ecartsSileneVides = (): EcartsImportSilene =>
  Object.fromEntries(ECARTS_SILENE.map((e) => [e, 0])) as EcartsImportSilene;

/** Début d'un import : synthèse et périmètre déclaré du rapport, nombres annoncés, éléments écartés. */
export const DebutImportSilene = z
  .object({
    rapport: RapportSilene,
    perimetre: PerimetreDeclareSilene,
    hotes: compte(SILENE_BORNES.hotesParImport),
    constats: compte(SILENE_BORNES.constatsParImport),
    ecartes: EcartsImportSilene,
  })
  .strict();
export type DebutImportSilene = z.infer<typeof DebutImportSilene>;

export interface DebutImportSileneDto {
  /** Exécution de l'import (« Exécutions » de l'instance). */
  id: string;
}

export interface ResultatLotSileneDto {
  lots: number;
  hotes: number;
  constats: number;
}

export const FinImportSilene = z.object({}).strict();

/** Bilan d'un import (résultat de son exécution) : nombres seulement, ni adresse, ni nom, ni nom de fichier. */
export const BilanImportSilene = z
  .object({
    hotesAnnonces: compte(SILENE_BORNES.hotesParImport),
    hotes: compte(SILENE_BORNES.hotesParImport),
    constatsAnnonces: compte(SILENE_BORNES.constatsParImport),
    constats: compte(SILENE_BORNES.constatsParImport),
    lots: compte(SILENE_BORNES.lotsParImport),
    /** Hôtes et constats présents avant l'import et absents du rapport (plus présents : import complet seulement). */
    hotesDisparus: compte(COMPTE_MAX),
    constatsDisparus: compte(COMPTE_MAX),
    ecartes: EcartsImportSilene,
  })
  .strict();
export type BilanImportSilene = z.infer<typeof BilanImportSilene>;

/* ------------------------------------------------------------------ Lecture (écran « Surface externe ») */
/** Note d'un import complet : synthèse du rapport et date de l'import. */
export interface NoteImportSileneDto extends RapportSilene {
  importeLe: string;
}

/** Note Silène d'une instance lisible, en tête de l'écran « Surface externe ». */
export interface NoteSileneDto {
  integrationId: string;
  nom: string;
  actif: boolean;
  perimetreNom: string | null;
  /** Dernier import complet (rapport qui fait foi), et celui d'avant (évolution) ; null s'il n'y en a pas. */
  courante: NoteImportSileneDto | null;
  precedente: NoteImportSileneDto | null;
  /** Notes des imports complets, de la plus récente à la plus ancienne (SILENE_BORNES.historique au plus). */
  historique: NoteImportSileneDto[];
  /** Hôtes et constats présents (vus par le dernier import complet). */
  hotes: number;
  constats: number;
  /** Périmètre déclaré du dernier import complet : nombres seulement. */
  perimetre: { domaines: number; plages: number };
  derniere: {
    id: string;
    etat: 'en_file' | 'en_cours' | 'recu' | 'echec' | 'expire';
    demandeLe: string;
    termineLe: string | null;
    erreur: string | null;
    bilan: BilanImportSilene | null;
  } | null;
}

/** Évolution d'une valeur d'un import complet au précédent (null si l'une des deux manque). */
export function evolutionSilene(courante: number | null, precedente: number | null): number | null {
  if (courante === null || precedente === null) return null;
  return Math.round((courante - precedente) * 10000) / 10000;
}

export type PortSileneDto = PortSilene;
export type ProduitSileneDto = ProduitSilene;

/** Ce que Silène dit d'un actif de la liste commune (hôte : son adresse ; nom de domaine : les hôtes qui le portent par
    résolution directe). Ports et produits sont ceux des hôtes. */
export interface ActifSileneDto {
  instances: { id: string; nom: string }[];
  perimetreNom: string | null;
  /** Hôte : son adresse ; nom de domaine : les adresses des hôtes qui le portent. */
  adresses: string[];
  noms: NomHoteSilene[];
  /** Ports ouverts (les premiers dans la liste, tous dans la fiche) et leur nombre gardé. */
  ports: PortSileneDto[];
  nombrePorts: number;
  /** Nombre annoncé par Silène (peut dépasser les ports gardés). */
  portsOuverts: number | null;
  produits: ProduitSileneDto[];
  controles: string[];
  /** Constats présents qui concernent ces hôtes. */
  constats: number;
}

export interface LigneSileneDto extends Omit<LigneSilene, 'hote'> {
  rang: number;
}

export interface ConstatSileneDto {
  id: string;
  identifiant: string;
  controle: string;
  classe: number;
  points: number | null;
  note: number | null;
  /** Hôtes concernés (tous lisibles : un constat appartient à une instance, lisible entière). */
  hotes: number;
  lignes: number;
  integration: { id: string; nom: string };
  perimetreNom: string | null;
}

export interface FicheConstatSileneDto extends ConstatSileneDto {
  /** Détail par hôte : adresse, lignes (les hôtes concernés sans ligne de détail y figurent aussi, sans ligne). */
  parHote: { hote: string; lignes: LigneSileneDto[] }[];
}

/** Fiche Silène d'un actif (fenêtre de l'onglet « Actifs ») : tout ce que Silène en dit, et ses constats. */
export interface FicheActifSileneDto extends ActifSileneDto {
  listeConstats: Pick<ConstatSileneDto, 'id' | 'identifiant' | 'controle' | 'classe'>[];
}

export const RechercheConstatsSilene = z
  .object({
    q: z.string().trim().max(100).optional(),
    controle: z.string().regex(CONTROLE_SILENE).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export type RechercheConstatsSilene = z.infer<typeof RechercheConstatsSilene>;

export const FicheActifSileneRequete = z
  .object({
    type: z.enum(['hote', 'domaine']),
    valeur: z.string().min(1).max(SILENE_BORNES.nomDomaine),
  })
  .strict();
export type FicheActifSileneRequete = z.infer<typeof FicheActifSileneRequete>;

/** Instance Silène et son périmètre de la plateforme (onglet « Périmètres », administration du module). */
export interface PerimetreSileneDto {
  integrationId: string;
  nom: string;
  perimetreId: string | null;
  perimetreNom: string | null;
  hotes: number;
  constats: number;
  /** Version de la liaison (0 : jamais reliée) ; If-Match de la modification. */
  version: number;
  majPar: string | null;
  majLe: string | null;
}

/** Ce que la suppression d'une instance « Silène, import de fichier » fait disparaître (nombres seulement). */
export interface SuppressionSileneDto {
  hotes: number;
  constats: number;
  imports: number;
}

/* ------------------------------------------------------------------ Ports d'un actif, deux sources */
export const SOURCES_SURFACE = ['alh', 'silene'] as const;
export type SourceSurface = (typeof SOURCES_SURFACE)[number];

/** Un port d'un actif, réuni des deux sources sans doublon port/protocole : ce que chacune en dit reste à part. */
export interface PortActifDto {
  port: number;
  protocole: ProtocoleSilene | null;
  alh: ServiceAlhDto | null;
  silene: PortSileneDto | null;
}

/** Réunit les services d'AlgoLightHouse (portés par ses alertes) et les ports ouverts vus par Silène : un même port et
    protocole n'apparaît qu'une fois ; un service d'AlgoLightHouse sans protocole rejoint le seul port de même numéro vu
    par Silène (s'il y en a deux, tcp et udp, il reste à part, comme fusionnerServices). Trié par port, puis protocole. */
export function fusionnerPortsActif(alh: readonly ServiceAlhDto[], silene: readonly PortSileneDto[]): PortActifDto[] {
  const out: PortActifDto[] = silene.map((s) => ({ port: s.port, protocole: s.protocole, alh: null, silene: s }));
  for (const a of [...alh].sort((x, y) => Number(x.protocole === null) - Number(y.protocole === null))) {
    let i = out.findIndex((x) => x.port === a.port && x.protocole === a.protocole && x.alh === null);
    if (i < 0 && a.protocole === null) {
      const memes = out.flatMap((x, j) => (x.port === a.port && x.alh === null && x.silene ? [j] : []));
      if (memes.length === 1) i = memes[0]!;
    }
    if (i < 0) out.push({ port: a.port, protocole: a.protocole, alh: a, silene: null });
    else out[i] = { ...out[i]!, alh: a };
  }
  const rang = (p: ProtocoleSilene | null) => (p ? PROTOCOLES_SILENE.indexOf(p) : PROTOCOLES_SILENE.length);
  return out.sort((a, b) => a.port - b.port || rang(a.protocole) - rang(b.protocole));
}

/** Sources d'un port réuni, dans l'ordre fixe. */
export const sourcesPort = (p: PortActifDto): SourceSurface[] => [
  ...(p.alh ? (['alh'] as const) : []),
  ...(p.silene ? (['silene'] as const) : []),
];

/** Actif de la liste commune de l'onglet « Actifs » (lot SI1) : identifié par son adresse IP (hôte) ou son nom de domaine.
    Vu par AlgoLightHouse, il garde tous ses champs (une ligne par actif d'AlgoLightHouse, comme avant) et reçoit ce que
    Silène dit de la même valeur ; vu par Silène seul, les champs propres à AlgoLightHouse sont vides et `id` est
    l'identifiant interne de l'hôte ou du nom chez Silène. */
export interface ActifSurfaceDto extends ActifAlhDto {
  sources: SourceSurface[];
  /** Actif d'AlgoLightHouse (fiche, machines internes) ; null : vu par Silène seul. */
  alhId: string | null;
  silene: ActifSileneDto | null;
}
