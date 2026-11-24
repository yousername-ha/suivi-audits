/* Module Vulnérabilités (ADR 0100, lot GRP-MACHINES ; décision du RSSI du 23/11/2026) : groupes de machines faits à la
   main, « simples et souples ».
   - Un groupe : un nom (obligatoire, borné, unique à la casse près), une description (facultative, bornée), des machines
     choisies à la main ; une machine peut être dans plusieurs groupes. Un fournisseur au plus, par sa référence
     `legacy:suppliers:<id>` (contrôlée à l'écriture ; s'il disparaît ensuite, le groupe reste et dit « fournisseur
     supprimé »).
   - Lecture avec `vulnerabilites:lire` : une personne ne voit dans un groupe que les machines qu'elle lit (périmètre de la
     machine) ; le nombre rendu est celui qu'elle lit, avec un drapeau « d'autres machines hors de votre lecture », sans
     nombre. Écritures avec `vulnerabilites:modifier`, If-Match sur la version du groupe, journal d'audit ; rattacher ou
     changer le fournisseur exige en plus `fournisseurs:lire`.
   - Rien de ces groupes ne part chez l'assistant. */
import { z } from 'zod';
import { FAILLES_PAR_PAGE, RoleMachine } from './failles-tenable.js';

export const GROUPES_MACHINES_BORNES = {
  /** Longueur du nom d'un groupe. */
  nom: 120,
  /** Longueur de la description. */
  description: 1000,
  /** Machines ajoutées ou retirées en une requête, et identifiants rendus pour « Tout cocher ». */
  lot: 500,
  /** Longueur de l'identifiant d'un fournisseur (celle de la route des fournisseurs). */
  fournisseur: 60,
} as const;

/** Préfixe des références de fournisseurs (registre de l'organisation, état historique). */
export const PREFIXE_FOURNISSEUR = 'legacy:suppliers:';
const B = GROUPES_MACHINES_BORNES;
/** Une ligne de texte sans caractère de contrôle. */
const SANS_CONTROLE = /^[^\p{Cc}]*$/u;
/** Texte libre sur plusieurs lignes : seuls le saut de ligne, le retour chariot et la tabulation sont admis parmi les
    caractères de contrôle. */
const TEXTE_LIBRE = /^(?:[^\p{Cc}]|[\n\r\t])*$/u;

/** Identifiant d'un fournisseur du registre (`SUP-001`), sans espace ni caractère de contrôle. */
export const IdFournisseur = z
  .string()
  .trim()
  .min(1)
  .max(B.fournisseur)
  .regex(/^[^\s\p{Cc}]+$/u, 'Identifiant de fournisseur invalide.');
/** Référence d'un fournisseur : `legacy:suppliers:<id>`. */
export const RefFournisseur = z
  .string()
  .regex(
    new RegExp(`^${PREFIXE_FOURNISSEUR}[^\\s\\p{Cc}]{1,${B.fournisseur}}$`, 'u'),
    'Référence de fournisseur attendue : legacy:suppliers:<identifiant>.',
  );
export type RefFournisseur = z.infer<typeof RefFournisseur>;
export const refFournisseur = (id: string): string => `${PREFIXE_FOURNISSEUR}${id}`;
/** Identifiant tiré d'une référence (null si la référence n'est pas celle d'un fournisseur). */
export const idDeRefFournisseur = (ref: string): string | null =>
  ref.startsWith(PREFIXE_FOURNISSEUR) && ref.length > PREFIXE_FOURNISSEUR.length
    ? ref.slice(PREFIXE_FOURNISSEUR.length)
    : null;

const nom = z
  .string()
  .trim()
  .min(1, 'Le nom du groupe est obligatoire.')
  .max(B.nom)
  .regex(SANS_CONTROLE, 'Le nom tient sur une ligne.');
const description = z.string().trim().max(B.description).regex(TEXTE_LIBRE, 'Caractère non admis.');
const lotMachines = z.array(z.uuid()).max(B.lot);
const sansDoublon = (l: string[]) => new Set(l).size === l.length;

/* ------------------------------------------------------------------ Écritures */
/** Création d'un groupe (`POST /api/vulnerabilites/groupes`) ; machines facultatives (lues par la personne). */
export const GroupeMachinesBody = z
  .object({
    nom,
    description: description.default(''),
    fournisseurRef: RefFournisseur.nullable().default(null),
    machineIds: lotMachines.default([]).refine(sansDoublon, 'Machine en double.'),
  })
  .strict();
export type GroupeMachinesBody = z.infer<typeof GroupeMachinesBody>;

/** Modification (`PATCH /api/vulnerabilites/groupes/:id`, If-Match) : seuls les champs présents changent. */
export const GroupeMachinesPatch = z
  .object({
    nom: nom.optional(),
    description: description.optional(),
    fournisseurRef: RefFournisseur.nullable().optional(),
  })
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'Aucun champ à modifier.');
export type GroupeMachinesPatch = z.infer<typeof GroupeMachinesPatch>;

/** Ajout et retrait de machines en lot (`POST /api/vulnerabilites/groupes/:id/machines`, If-Match), tout ou rien. */
export const MembresGroupeBody = z
  .object({ ajouter: lotMachines.default([]), retirer: lotMachines.default([]) })
  .strict()
  .refine((b) => b.ajouter.length + b.retirer.length > 0, 'Aucune machine à ajouter ni à retirer.')
  .refine((b) => b.ajouter.length + b.retirer.length <= B.lot, `${B.lot} machines au plus par requête.`)
  .refine(
    (b) => sansDoublon([...b.ajouter, ...b.retirer]),
    'Une machine figure deux fois (ou à la fois à ajouter et à retirer).',
  );
export type MembresGroupeBody = z.infer<typeof MembresGroupeBody>;

/* ------------------------------------------------------------------ Lectures */
/** Fournisseur rattaché à un groupe : nom lu dans le registre au moment de la lecture (décision du 23/11/2026 : le nom est
    donné même sans le droit de lire les fournisseurs) ; `supprime` : absent du registre, le groupe reste valide. */
export const FournisseurGroupe = z
  .object({
    id: z.string(),
    ref: z.string(),
    nom: z.string().nullable(),
    etat: z.enum(['present', 'supprime']),
  })
  .strict();
export type FournisseurGroupe = z.infer<typeof FournisseurGroupe>;

/** Un groupe tel que la personne le lit. `machinesLues` : machines du groupe qu'elle lit ; `horsLecture` : le groupe compte
    d'autres machines qu'elle ne lit pas (aucun nombre). */
export const GroupeMachines = z
  .object({
    id: z.uuid(),
    nom: z.string(),
    description: z.string(),
    fournisseur: FournisseurGroupe.nullable(),
    machinesLues: z.number().int().min(0),
    horsLecture: z.boolean(),
    version: z.number().int().min(1),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedBy: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type GroupeMachines = z.infer<typeof GroupeMachines>;

/** Liste des groupes (`GET /api/vulnerabilites/groupes`), par nom. */
export const ListeGroupesMachines = z.array(GroupeMachines);

/** Machines de la fenêtre d'un groupe (`GET /api/vulnerabilites/groupes/:id/machines`) : machines lues, membres ou non ;
    recherche par nom (partiel) ou adresse IP (début) ; `membres` : seulement celles du groupe (`oui`) ou hors du groupe
    (`non`). */
export const RechercheMachinesGroupe = z
  .object({
    q: z.string().trim().max(100).optional(),
    membres: z.enum(['oui', 'non']).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type RechercheMachinesGroupe = z.infer<typeof RechercheMachinesGroupe>;

/** Autre groupe d'une machine (« aussi dans « X » »). */
export const AutreGroupe = z.object({ id: z.uuid(), nom: z.string() }).strict();
export const MachineGroupe = z
  .object({
    id: z.uuid(),
    nom: z.string().nullable(),
    adresse: z.string().nullable(),
    systeme: z.string().nullable(),
    role: RoleMachine.nullable(),
    perimetreNom: z.string().nullable(),
    /** Dans ce groupe. */
    membre: z.boolean(),
    /** Autres groupes dont la machine fait partie, par nom. */
    autresGroupes: z.array(AutreGroupe),
  })
  .strict();
export type MachineGroupe = z.infer<typeof MachineGroupe>;

export const PageMachinesGroupe = z
  .object({
    groupe: GroupeMachines,
    /** Machines lues trouvées (« Tout cocher (n trouvées) »). */
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    parPage: z.number().int().min(1),
    elements: z.array(MachineGroupe),
    /** Identifiants de toutes les machines trouvées, dans l'ordre, au plus GROUPES_MACHINES_BORNES.lot (« Tout cocher »). */
    identifiants: z.array(z.uuid()).max(B.lot),
    /** Plus de machines trouvées que d'identifiants rendus : affiner la recherche avant de tout cocher. */
    identifiantsTronques: z.boolean(),
  })
  .strict();
export type PageMachinesGroupe = z.infer<typeof PageMachinesGroupe>;
export const MACHINES_GROUPE_PAR_PAGE = FAILLES_PAR_PAGE;

/** Bilan d'un ajout ou d'un retrait en lot : machines réellement ajoutées et retirées, et le groupe après l'opération. */
export const BilanMembresGroupe = z
  .object({ ajoutees: z.number().int().min(0), retirees: z.number().int().min(0), groupe: GroupeMachines })
  .strict();
export type BilanMembresGroupe = z.infer<typeof BilanMembresGroupe>;

/* ------------------------------------------------------------------ Fiche d'un fournisseur */
/** Paramètre de `GET /api/vulnerabilites/fournisseurs/:id/groupes` : identifiant du fournisseur (`SUP-001`). */
export const ParamsGroupesFournisseur = z.object({ id: IdFournisseur }).strict();

/** Un groupe rattaché au fournisseur, sans aucun détail de machine : nombre de machines lues, drapeau hors lecture, failles
    critiques ouvertes comptées sur les seules machines lues du groupe. */
export const GroupeDuFournisseur = z
  .object({
    id: z.uuid(),
    nom: z.string(),
    description: z.string(),
    machinesLues: z.number().int().min(0),
    horsLecture: z.boolean(),
    /** Failles détectées (Tenable, Nessus) de gravité critique, présentes sur au moins une machine lue du groupe et encore à
        traiter (ni corrigées, ni au risque accepté, ni non concernées) : même règle que le compteur « critique » des
        machines. */
    faillesCritiquesOuvertes: z.number().int().min(0),
  })
  .strict();
export type GroupeDuFournisseur = z.infer<typeof GroupeDuFournisseur>;

export const GroupesDuFournisseur = z
  .object({ fournisseurId: z.string(), groupes: z.array(GroupeDuFournisseur) })
  .strict();
export type GroupesDuFournisseur = z.infer<typeof GroupesDuFournisseur>;

/* ------------------------------------------------------------------ Filtre de la liste et du parc */
/** Filtre « Groupe » de la liste et du parc des machines : un groupe, ou `aucun` (machines lues qui ne sont dans aucun
    groupe) ; absent : tous. */
export const FILTRE_SANS_GROUPE = 'aucun';
export const LIBELLE_SANS_GROUPE = 'Sans groupe';
export const LIBELLE_FOURNISSEUR_SUPPRIME = 'fournisseur supprimé';
