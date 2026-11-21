/* Module Vulnérabilités (ADR 0100, point 15 et V11 ; lot R1, demande du RSSI du 19/11/2026) : barre de recherche globale du
   module. Une seule route (`GET /api/vulnerabilites/recherche?q=`), une réponse groupée et bornée :
   - CVE : veille locale (identifiant, éditeurs, produits, description, nom du catalogue KEV) et ce qui est détecté (contrôles
     de Tenable, alertes et technologies d'AlgoLightHouse). Chaque CVE dit son état : détectée sur N machines, déclarée sur N
     machines, exposée sur N actifs (ce que la personne lit seulement), présente hors de sa lecture (drapeau sans nombre, lot
     ALH5), ou non détectée sur le parc. Un identifiant CVE bien formé que rien ne cite donne `cveInconnue` : aucune
     consultation extérieure n'est faite (la consultation de NVD à la demande attend la décision du RSSI ; un lot suivant
     pourra ajouter une action à cet objet) ;
   - machines internes (nom partiel, adresse IP par préfixe ou exacte, système) ;
   - actifs exposés (nom de domaine, adresse IP), même règle que la liste « Actifs » de la surface externe ;
   - applications : produits surveillés, technologies vues par AlgoLightHouse, contrôles de Tenable par leur nom, avec les
     machines ou actifs lisibles qui les portent.
   Saisie de 2 à 200 caractères après rognage ; jokers de LIKE échappés. Fonctions pures, testées en table. */
import { z } from 'zod';
import { RoleMachine } from './failles-tenable.js';
import { TypeActifAlh } from './surface-externe.js';
import { GRAVITES_CVSS } from './veille-vulnerabilites.js';

export const RECHERCHE_GLOBALE_BORNES = {
  /** Longueur de la saisie, après rognage. */
  min: 2,
  max: 200,
  /** Résultats rendus par groupe (le nombre total est toujours rendu). */
  parGroupe: 8,
  /** Machines ou actifs nommés pour une application (les autres sont comptés). */
  porteurs: 3,
  /** Longueur du résumé d'une CVE. */
  resume: 200,
  /** Longueur de saisie admise par les listes existantes (`q` des listes) : au-delà, pas de lien « tout voir ». */
  listes: 100,
} as const;
const B = RECHERCHE_GLOBALE_BORNES;

/** Demande : `q`, rogné, de 2 à 200 caractères. */
export const RechercheGlobaleVulnerabilites = z.object({ q: z.string().trim().min(B.min).max(B.max) }).strict();
export type RechercheGlobaleVulnerabilites = z.infer<typeof RechercheGlobaleVulnerabilites>;

/** Identifiant CVE bien formé (même forme que la contrainte de la table de la veille). */
export const estIdentifiantCve = (q: string): boolean => /^CVE-[12][0-9]{3}-[0-9]{4,9}$/i.test(q.trim());
/** Début d'identifiant CVE (« CVE-2026 », « cve-2026-94 ») : la recherche se fait par préfixe d'identifiant. */
export const ressembleACve = (q: string): boolean => /^cve-\d/i.test(q.trim());
/** Motif LIKE littéral : `\`, `%` et `_` saisis sont échappés (caractère d'échappement par défaut de PostgreSQL). */
export const motifLitteral = (q: string): string => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Une machine correspond à la saisie : nom partiel ou système partiel (casse ignorée), adresse IP par préfixe (une adresse
    exacte est un préfixe d'elle-même). Règle commune à la barre de recherche et à la liste « Machines ». */
export function machineCorrespond(
  m: { nom: string | null; adresse: string | null; systeme: string | null },
  saisie: string,
): boolean {
  const t = saisie.trim().toLowerCase();
  if (!t) return true;
  return (
    (m.nom ?? '').toLowerCase().includes(t) ||
    (m.adresse ?? '').toLowerCase().startsWith(t) ||
    (m.systeme ?? '').toLowerCase().includes(t)
  );
}

/* ------------------------------------------------------------------ Réponse */
const groupe = <T extends z.ZodType>(element: T) =>
  z.object({ elements: z.array(element).max(B.parGroupe), total: z.number().int().min(0) }).strict();

export const ResultatCve = z
  .object({
    cve: z.string(),
    /** Connue de la veille locale (NVD, catalogue KEV, CERT-FR, CERT Santé, EPSS). */
    veille: z.boolean(),
    /** Nom au catalogue KEV, sinon début de la description de NVD. */
    resume: z.string().nullable(),
    /** Produit touché selon le catalogue KEV, sinon NVD. */
    produit: z.string().nullable(),
    gravite: z.enum(GRAVITES_CVSS).nullable(),
    score: z.number().nullable(),
    kev: z.boolean(),
    /** Machines lisibles où Tenable la détecte (détection présente). */
    machines: z.number().int().min(0),
    /** Machines lisibles reliées à un produit surveillé rattaché à la CVE (« déclarée », V20). */
    machinesDeclarees: z.number().int().min(0),
    /** Actifs exposés lisibles qui la portent (AlgoLightHouse). */
    actifs: z.number().int().min(0),
    /** Présente aussi sur des machines ou des actifs que la personne ne lit pas : drapeau sans nombre ni nom (lot ALH5). */
    horsLecture: z.boolean(),
    /** La fiche illustrée de la CVE (lot PC4) peut s'ouvrir. */
    fiche: z.boolean(),
  })
  .strict();
export type ResultatCveDto = z.infer<typeof ResultatCve>;

export const ResultatMachine = z
  .object({
    id: z.uuid(),
    nom: z.string().nullable(),
    adresse: z.string().nullable(),
    systeme: z.string().nullable(),
    role: RoleMachine.nullable(),
    perimetreNom: z.string().nullable(),
  })
  .strict();
export type ResultatMachineDto = z.infer<typeof ResultatMachine>;

export const ResultatActif = z
  .object({
    id: z.uuid(),
    type: TypeActifAlh,
    /** Adresse IP (hôte) ou nom de domaine. */
    valeur: z.string(),
    adresse: z.string().nullable(),
    perimetreNom: z.string().nullable(),
    alertesOuvertes: z.number().int().min(0),
  })
  .strict();
export type ResultatActifDto = z.infer<typeof ResultatActif>;

/** Machine ou actif exposé qui porte une application (lisible par la personne). */
export const Porteur = z
  .object({ type: z.enum(['machine', ...TypeActifAlh.options]), id: z.string().nullable(), libelle: z.string() })
  .strict();
export type PorteurDto = z.infer<typeof Porteur>;

export const ResultatProduit = z
  .object({
    id: z.uuid(),
    editeur: z.string(),
    nom: z.string(),
    versionProduit: z.string(),
    /** Machines lisibles reliées au produit (V20). */
    machines: z.number().int().min(0),
    porteurs: z.array(Porteur).max(B.porteurs),
  })
  .strict();
export type ResultatProduitDto = z.infer<typeof ResultatProduit>;

export const ResultatTechnologie = z
  .object({
    id: z.uuid(),
    nom: z.string(),
    editeur: z.string().nullable(),
    produit: z.string().nullable(),
    /** Actifs exposés lisibles où une version est encore détectée. */
    actifs: z.number().int().min(0),
    porteurs: z.array(Porteur).max(B.porteurs),
  })
  .strict();
export type ResultatTechnologieDto = z.infer<typeof ResultatTechnologie>;

export const ResultatControle = z
  .object({
    id: z.uuid(),
    pluginId: z.number().int(),
    nom: z.string(),
    /** Machines lisibles où le contrôle est présent. */
    machines: z.number().int().min(0),
  })
  .strict();
export type ResultatControleDto = z.infer<typeof ResultatControle>;

export const RechercheGlobaleReponse = z
  .object({
    q: z.string(),
    cves: groupe(ResultatCve),
    machines: groupe(ResultatMachine),
    actifs: groupe(ResultatActif),
    produits: groupe(ResultatProduit),
    technologies: groupe(ResultatTechnologie),
    controles: groupe(ResultatControle),
    /** Identifiant CVE bien formé que ni la veille locale ni aucune détection ne cite. Aucun appel sortant n'est fait ; un
        lot suivant pourra y ajouter une action (consultation de NVD à la demande, décision du RSSI en attente). */
    cveInconnue: z.object({ cve: z.string() }).strict().nullable(),
  })
  .strict();
export type RechercheGlobaleDto = z.infer<typeof RechercheGlobaleReponse>;

export type GroupeRechercheGlobale = Exclude<keyof RechercheGlobaleDto, 'q' | 'cveInconnue'>;

/* ------------------------------------------------------------------ Libellés */
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

export type EtatCveRecherche = 'presente' | 'hors_lecture' | 'non_detectee';

/** État d'une CVE trouvée, en clair : où elle est présente parmi ce que la personne lit ; sinon, présente hors de sa lecture
    (sans nombre) ; sinon « Non détectée sur le parc ». */
export function etatCveRecherche(
  r: Pick<ResultatCveDto, 'machines' | 'machinesDeclarees' | 'actifs' | 'horsLecture'>,
): {
  etat: EtatCveRecherche;
  libelle: string;
} {
  const parts: string[] = [];
  if (r.machines) parts.push(`détectée sur ${pluriel(r.machines, 'machine', 'machines')}`);
  if (r.machinesDeclarees)
    parts.push(`déclarée sur ${pluriel(r.machinesDeclarees, 'machine', 'machines')} (produit relié)`);
  if (r.actifs) parts.push(`exposée sur ${pluriel(r.actifs, 'actif exposé', 'actifs exposés')}`);
  if (parts.length) {
    const texte = parts.join(', ');
    return {
      etat: 'presente',
      libelle: `${texte.charAt(0).toUpperCase()}${texte.slice(1)}${r.horsLecture ? ', et hors de vos périmètres' : ''}`,
    };
  }
  if (r.horsLecture) return { etat: 'hors_lecture', libelle: 'Présente hors des périmètres que vous lisez' };
  return { etat: 'non_detectee', libelle: 'Non détectée sur le parc' };
}

/** Nombre total de résultats de la réponse (tous groupes). */
export const totalRechercheGlobale = (r: RechercheGlobaleDto): number =>
  r.cves.total + r.machines.total + r.actifs.total + r.produits.total + r.technologies.total + r.controles.total;
