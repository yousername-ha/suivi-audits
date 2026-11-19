/* Module Vulnérabilités (ADR 0100, lot N1) : import d'un scan Nessus déposé dans la carte « Intégrations » (connecteur
   « nessus-fichier », sans adresse, sans clé, sans flux, sans exécutant). Le fichier (.nessus, XML « NessusClientData_v2 »)
   est lu dans le navigateur ; seul un extrait en liste blanche part vers l'API, en JSON, par lots de machines entières (une
   machine n'est jamais coupée entre deux lots : la disparition d'une faille se juge machine par machine). L'API ne lit aucun
   XML et revalide ici chaque champ ; un champ en trop, une forme inattendue ou une gravité hors réglage fait refuser tout le
   lot. Les formes et les bornes sont celles de Tenable Security Center (failles-tenable.ts, migration 075) : un contrôle
   Nessus reste un contrôle de Tenable, rangé dans les mêmes tables. Format écrit d'après la connaissance du format
   « NessusClientData_v2 », non vérifié sur un export réel. */
import { z } from 'zod';
import {
  ADRESSE_IP,
  CLE_MACHINE,
  cleMachine,
  ElementConstatTenable,
  GraviteTenable,
  NOM_MACHINE,
  PLUGIN_ID,
  PROTOCOLE,
  TENABLE_BORNES,
} from './failles-tenable.js';
import { texteExterneValide } from './veille-vulnerabilites.js';

/** Identifiant du type de connecteur (catalogue des intégrations) et de la source d'une machine importée. */
export const TYPE_NESSUS_FICHIER = 'nessus-fichier' as const;

/** Bornes de l'import, reprises par le navigateur (découpe en lots) et par l'API (revalidation). */
export const NESSUS_BORNES = {
  /** Taille maximale du fichier lu dans le navigateur, en mégaoctets (Mo de 1 000 000 octets). */
  fichierMo: 100,
  /** Machines (ReportHost) au plus par import. */
  machinesParImport: 10000,
  /** Machines au plus par lot envoyé. */
  machinesParLot: 200,
  /** Détections (contrôle, port, protocole) au plus pour une machine : au-delà, la machine est écartée et comptée. */
  detectionsParMachine: 5000,
  /** Détections au plus par lot (une machine y tient toujours entière). */
  detectionsParLot: 10000,
  /** Contrôles décrits au plus par lot. */
  constatsParLot: 5000,
  /** Taille visée d'un lot par le navigateur (JSON), et taille admise du corps par l'API. */
  octetsParLot: 3 * 1024 * 1024,
  corpsLot: 8 * 1024 * 1024,
  /** Lots au plus par import. */
  lotsParImport: 1000,
  /** Un import resté sans lot pendant ce délai (minutes) est clos comme interrompu au prochain import de l'instance. */
  inactiviteMinutes: 30,
} as const;

const UUID_MINUSCULES = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const instant = z.iso.datetime().nullable();
const compte = (max: number) => z.number().int().min(0).max(max);
const COMPTE_MAX = 10_000_000;

/** Machine (ReportHost) : identifiant dans la source (même règle que Tenable : `uuid:` si un identifiant d'hôte est donné,
    sinon `ip:<adresse>|<nom>`), nom en minuscules, adresse, système, début et fin du scan de la machine. */
export const MachineImportNessus = z
  .object({
    cle: z.string().max(400).regex(CLE_MACHINE),
    uuid: z.string().regex(UUID_MINUSCULES, 'Identifiant UUID en minuscules attendu.').nullable(),
    nom: z.string().max(TENABLE_BORNES.nomMachine).regex(NOM_MACHINE).nullable(),
    adresse: z.string().max(45).regex(ADRESSE_IP).nullable(),
    systeme: z
      .string()
      .min(1)
      .max(TENABLE_BORNES.systeme)
      .refine(texteExterneValide, 'Texte externe non nettoyé : refusé.')
      .nullable(),
    debut: instant,
    fin: instant,
  })
  .strict()
  .refine((m) => m.cle === cleMachine(m.uuid, m.adresse, m.nom), { message: 'Identifiant de machine incohérent.' });
export type MachineImportNessus = z.infer<typeof MachineImportNessus>;

/** Détection d'un contrôle sur la machine : contrôle, port et protocole (en majuscules, comme Tenable). */
export const DetectionImportNessus = z
  .object({
    plugin: z.string().regex(PLUGIN_ID),
    port: z.number().int().min(0).max(65535),
    protocole: z.string().regex(PROTOCOLE),
  })
  .strict();
export type DetectionImportNessus = z.infer<typeof DetectionImportNessus>;

/** Contrôle (ReportItem) décrit une fois par lot : mêmes champs et mêmes bornes qu'un constat de Tenable Security Center,
    sans fin de support (Nessus n'en donne pas la date). */
export const ConstatImportNessus = ElementConstatTenable.omit({ type: true, finSupportLe: true }).strict();
export type ConstatImportNessus = z.infer<typeof ConstatImportNessus>;

const cleDetection = (d: DetectionImportNessus) => `${d.plugin}\u0000${d.port}\u0000${d.protocole}`;

/** Une machine du lot, entière : toutes ses détections retenues. */
export const MachineLotNessus = z
  .object({
    machine: MachineImportNessus,
    detections: z.array(DetectionImportNessus).max(NESSUS_BORNES.detectionsParMachine),
  })
  .strict()
  .refine((m) => new Set(m.detections.map(cleDetection)).size === m.detections.length, {
    message: 'Détection en double sur une machine.',
  });
export type MachineLotNessus = z.infer<typeof MachineLotNessus>;

/** Lot envoyé à l'API : des machines entières et les contrôles qu'elles portent (chacun décrit une fois, aucun contrôle
    orphelin, aucune détection d'un contrôle absent du lot). */
export const LotImportNessus = z
  .object({
    machines: z.array(MachineLotNessus).min(1).max(NESSUS_BORNES.machinesParLot),
    constats: z.array(ConstatImportNessus).max(NESSUS_BORNES.constatsParLot),
  })
  .strict()
  .superRefine((l, ctx) => {
    if (new Set(l.machines.map((m) => m.machine.cle)).size !== l.machines.length)
      ctx.addIssue({ code: 'custom', message: 'Machine en double dans le lot.' });
    const plugins = new Set(l.constats.map((c) => c.plugin));
    if (plugins.size !== l.constats.length)
      ctx.addIssue({ code: 'custom', message: 'Contrôle en double dans le lot.' });
    const detections = l.machines.flatMap((m) => m.detections);
    if (detections.length > NESSUS_BORNES.detectionsParLot)
      ctx.addIssue({ code: 'custom', message: 'Trop de détections dans le lot.' });
    const utilises = new Set(detections.map((d) => d.plugin));
    if ([...utilises].some((p) => !plugins.has(p)))
      ctx.addIssue({ code: 'custom', message: 'Détection d’un contrôle absent du lot.' });
    if ([...plugins].some((p) => !utilises.has(p)))
      ctx.addIssue({ code: 'custom', message: 'Contrôle sans détection dans le lot.' });
  });
export type LotImportNessus = z.infer<typeof LotImportNessus>;

/** Éléments écartés par le navigateur, comptés (jamais tronqués en silence) : nombres seulement. */
export const ECARTS_IMPORT = [
  'machinesSansIdentite',
  'machinesTropVolumineuses',
  'controlesInvalides',
  'controlesInformatifs',
  'controlesHorsGravite',
  'cvesInvalides',
  'liensRefuses',
  'valeursInvalides',
  'textesRaccourcis',
] as const;
export type EcartImport = (typeof ECARTS_IMPORT)[number];
export const ECART_IMPORT_LIBELLES: Record<EcartImport, string> = {
  machinesSansIdentite: 'machines sans adresse ni identifiant',
  machinesTropVolumineuses: 'machines au-delà de la borne de détections',
  controlesInvalides: 'contrôles illisibles (numéro, nom ou gravité)',
  controlesInformatifs: 'contrôles informatifs (jamais rangés)',
  controlesHorsGravite: 'contrôles hors des gravités retenues',
  cvesInvalides: 'identifiants CVE mal formés',
  liensRefuses: 'liens « voir aussi » refusés (https seulement)',
  valeursInvalides: 'valeurs hors norme (score, vecteur, date, nom, adresse, système)',
  textesRaccourcis: 'textes raccourcis à leur borne (marqués « … »)',
};
export const EcartsImportNessus = z
  .object(Object.fromEntries(ECARTS_IMPORT.map((e) => [e, compte(COMPTE_MAX)])) as Record<EcartImport, z.ZodNumber>)
  .strict();
export type EcartsImportNessus = z.infer<typeof EcartsImportNessus>;

/** Début d'un import : machines et détections que le navigateur va envoyer, éléments écartés. Le serveur fixe les gravités
    retenues d'après la configuration de l'instance, au début, pour tout l'import. */
export const DebutImportNessus = z
  .object({
    machines: z.number().int().min(1).max(NESSUS_BORNES.machinesParImport),
    detections: compte(NESSUS_BORNES.machinesParImport * NESSUS_BORNES.detectionsParMachine),
    ecartes: EcartsImportNessus,
  })
  .strict();
export type DebutImportNessus = z.infer<typeof DebutImportNessus>;

export interface DebutImportDto {
  /** Exécution de l'import (« Exécutions » de l'instance). */
  id: string;
  gravites: GraviteTenable[];
}

export interface ResultatLotImportDto {
  lots: number;
  machines: number;
  detections: number;
}

/** Fin d'un import : rien à transmettre, le serveur compte ce qu'il a reçu. */
export const FinImportNessus = z.object({}).strict();

/** Bilan d'un import (résultat de son exécution) : nombres et gravités seulement, ni nom ni adresse ni nom de fichier. */
export const BilanImportNessus = z
  .object({
    machinesAnnoncees: compte(NESSUS_BORNES.machinesParImport),
    machines: compte(NESSUS_BORNES.machinesParImport),
    constats: compte(COMPTE_MAX),
    detections: compte(COMPTE_MAX),
    /** Détections qui ont disparu sur les machines scannées (présentes avant l'import, absentes du fichier). */
    disparues: compte(COMPTE_MAX),
    lots: compte(NESSUS_BORNES.lotsParImport),
    ecartes: EcartsImportNessus,
    gravites: z.array(GraviteTenable).min(1).max(4),
  })
  .strict();
export type BilanImportNessus = z.infer<typeof BilanImportNessus>;

/** État d'une instance d'import, lu par les écrans du module (lecture seule, comme l'état d'une synchronisation). */
export interface EtatImportNessusDto {
  integrationId: string;
  nom: string;
  actif: boolean;
  gravites: GraviteTenable[];
  derniere: {
    id: string;
    etat: 'en_file' | 'en_cours' | 'recu' | 'echec' | 'expire';
    demandeLe: string;
    termineLe: string | null;
    erreur: string | null;
    bilan: BilanImportNessus | null;
  } | null;
  /** Dernier lot rangé (chaque lot est un passage complet pour ses machines). */
  derniereCompleteLe: string | null;
}
