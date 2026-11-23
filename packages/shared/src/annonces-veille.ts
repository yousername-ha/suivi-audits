/* Module Vulnérabilités (ADR 0100, lot CVE-INC ; décisions du RSSI du 22/11/2026) : deux sources facultatives de la veille,
   désactivées au départ, lues par la même mécanique que la veille (file propre, `suivi veille-annonces-claim | -lot |
   -finish`, script isolé scripts/veille-vulnerabilites.py, flux « veille-vulnerabilites »).
   - Préavis des CVE (Cloudflare Radar) : flux JSON Feed des CVE annoncées, lu toutes les quinze minutes par défaut. Seules
     sont gardées les CVE critiques (gravité CRITICAL) et celles dont le titre ou le résumé cite le nom d'un produit surveillé
     (correspondance de mots faite par l'API, en local : rien n'est envoyé ; signalée « à confirmer », jamais une détection).
     Marque « Annonce précoce », remplacée dès que la CVE est connue par NVD, cve.org ou un CERT. Aucune notification, aucune
     alerte. Les « briefings » de Cloudflare ne sont pas lus.
   - tldrcve : flux RSS 2.0, lu une ou deux fois par jour ; titre, CVE citées, résumé du flux, verdict, date, lien. Présenté
     dans des cartes construites par la plateforme (« Est-ce grave ? », « Êtes-vous concerné ? », « Que faire ? »). Aucun effet
     sur la priorité.
   La liste fermée (hôte, chemin, requête) est recopiée dans le script et comparée par apps/api/test/veille-architecture.test.ts. */
import { z } from 'zod';
import { normaliserNom } from './rapprochement-vulnerabilites.js';
import { CVE_ID, GRAVITES_CVSS, texteExterneValide } from './veille-vulnerabilites.js';

export const SOURCES_ANNONCES = ['cloudflare-radar', 'tldrcve'] as const;
export const SourceAnnonce = z.enum(SOURCES_ANNONCES);
export type SourceAnnonce = z.infer<typeof SourceAnnonce>;

export interface SourceAnnonceDefinition {
  id: SourceAnnonce;
  libelle: string;
  organisme: string;
  hote: string;
  chemins: readonly string[];
  /** Requête fixe ajoutée au chemin (aucune valeur reçue de l'application). */
  requete: string;
  format: string;
  langue: 'en';
  demande: string;
}

export const SOURCES_ANNONCES_DEFINITIONS: readonly SourceAnnonceDefinition[] = [
  {
    id: 'cloudflare-radar',
    libelle: 'Préavis des CVE (Cloudflare Radar)',
    organisme: 'Cloudflare',
    hote: 'radar.cloudflare.com',
    chemins: ['/zero-wire/cves/feed'],
    requete: 'format=json',
    format: 'JSON Feed des CVE annoncées',
    langue: 'en',
    demande: 'Le flux des CVE annoncées, en une lecture ; jamais les « briefings ».',
  },
  {
    id: 'tldrcve',
    libelle: 'Résumés des CVE (tldrcve)',
    organisme: 'tldrcve.com',
    hote: 'tldrcve.com',
    chemins: ['/feed.xml'],
    requete: '',
    format: 'Flux RSS 2.0',
    langue: 'en',
    demande: 'Le flux RSS, en une lecture.',
  },
];

export const sourceAnnonce = (id: SourceAnnonce): SourceAnnonceDefinition =>
  SOURCES_ANNONCES_DEFINITIONS.find((s) => s.id === id)!;

/** Fréquences admises, en minutes : Cloudflare toutes les 15 minutes par défaut ; tldrcve une ou deux fois par jour. */
export const FREQUENCES_ANNONCES: Readonly<Record<SourceAnnonce, readonly number[]>> = {
  'cloudflare-radar': [15, 30, 60, 120, 360, 1440],
  tldrcve: [720, 1440],
};
export const FREQUENCE_ANNONCES_DEFAUT: Readonly<Record<SourceAnnonce, number>> = {
  'cloudflare-radar': 15,
  tldrcve: 1440,
};
export const frequenceAnnonces = (s: SourceAnnonce, reglee: number | null | undefined) =>
  reglee ?? FREQUENCE_ANNONCES_DEFAUT[s];
export const frequenceAnnoncesAdmise = (s: SourceAnnonce, minutes: number) => FREQUENCES_ANNONCES[s].includes(minutes);

/** Libellé d'une fréquence en minutes. */
export function libelleFrequenceMinutes(minutes: number): string {
  if (minutes < 60) return `Toutes les ${minutes} minutes`;
  if (minutes === 60) return 'Toutes les heures';
  if (minutes === 1440) return 'Une fois par jour';
  if (minutes === 720) return 'Deux fois par jour';
  return `Toutes les ${minutes / 60} heures`;
}

/** Avertissement des fréquences élevées (comme pour un connecteur sous 24 heures) : ce n'est pas un refus. */
export const AVERTISSEMENT_ANNONCES_FREQUENTES =
  'En dessous d’une heure : une lecture de plus vers Cloudflare à chaque période ; la limite d’appels de Cloudflare n’est pas connue.';
export const avertissementAnnonces = (s: SourceAnnonce, minutes: number): string | null =>
  s === 'cloudflare-radar' && minutes < 60 ? AVERTISSEMENT_ANNONCES_FREQUENTES : null;

/** Bornes, reprises par la migration 103 et par le script. */
export const ANNONCES_BORNES = {
  identifiant: 300,
  titre: 300,
  resume: 1000,
  lien: 500,
  verdict: 200,
  cvesParAnnonce: 20,
  /** Éléments gardés par lecture d'un flux. */
  items: 500,
  /** Noms de produits surveillés cités gardés par préavis. */
  produitsCites: 10,
  /** Un nom de produit plus court n'est pas cherché dans les textes (trop de rencontres fortuites). */
  nomProduitMin: 3,
  /** Annonces purgées après ce nombre de jours sans être revues. */
  conservationJours: 90,
} as const;

/** Lien gardé seulement en https sur l'hôte de la source. */
export const LIEN_CLOUDFLARE = /^https:\/\/radar\.cloudflare\.com\/[\x21-\x7e]{0,480}$/;
export const LIEN_TLDRCVE = /^https:\/\/tldrcve\.com\/[\x21-\x7e]{0,480}$/;
const lienSur = (motif: RegExp) =>
  z
    .string()
    .max(ANNONCES_BORNES.lien)
    .regex(motif, 'Lien refusé : https sur l’hôte de la source attendu.')
    .refine((s) => !/["'<>\\`]/.test(s), 'Lien refusé.');
const texte = (max: number) => z.string().max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');
const cve = z.string().regex(CVE_ID, 'Identifiant CVE attendu.');
/** Version CVSS annoncée par Cloudflare (« 3.1 », « 4.0 »). */
export const VERSION_CVSS = /^[234]\.[01]$/;

export const ElementPreavis = z
  .object({
    identifiant: texte(ANNONCES_BORNES.identifiant).refine((s) => s.length > 0, 'Identifiant vide.'),
    cve,
    titre: texte(ANNONCES_BORNES.titre).refine((s) => s.length > 0, 'Titre vide.'),
    resume: texte(ANNONCES_BORNES.resume),
    lien: lienSur(LIEN_CLOUDFLARE).nullable(),
    publieLe: z.iso.datetime().nullable(),
    gravite: z.enum(GRAVITES_CVSS).nullable(),
    score: z.number().min(0).max(10).nullable(),
    versionCvss: z.string().regex(VERSION_CVSS).nullable(),
    kev: z.boolean().nullable(),
  })
  .strict();
export type ElementPreavis = z.infer<typeof ElementPreavis>;

/** Verdicts de tldrcve, reconnus seulement dans la phrase « Verdict: … » du résumé. */
export const VERDICTS_TLDRCVE = ['patch-now', 'patch-now-if', 'next-cycle', 'watching'] as const;
export type VerdictTldrcve = (typeof VERDICTS_TLDRCVE)[number];
export const LIBELLES_VERDICT: Record<VerdictTldrcve, string> = {
  'patch-now': 'Corriger maintenant',
  'patch-now-if': 'Corriger maintenant, sous condition',
  'next-cycle': 'Au prochain cycle de correctifs',
  watching: 'À surveiller',
};

export const ElementTldrcve = z
  .object({
    identifiant: texte(ANNONCES_BORNES.identifiant).refine((s) => s.length > 0, 'Identifiant vide.'),
    titre: texte(ANNONCES_BORNES.titre).refine((s) => s.length > 0, 'Titre vide.'),
    nature: z.enum(['nouvelle', 'mise_a_jour']).nullable(),
    cves: z.array(cve).min(1).max(ANNONCES_BORNES.cvesParAnnonce),
    resume: texte(ANNONCES_BORNES.resume),
    verdict: z.enum(VERDICTS_TLDRCVE).nullable(),
    /** Phrase du verdict telle que le flux la publie (« Patch now if … »), bornée. */
    verdictTexte: texte(ANNONCES_BORNES.verdict).nullable(),
    lien: lienSur(LIEN_TLDRCVE),
    publieLe: z.iso.datetime().nullable(),
  })
  .strict()
  .refine((e) => (e.verdict === null) === (e.verdictTexte === null), { message: 'Verdict incohérent.' });
export type ElementTldrcve = z.infer<typeof ElementTldrcve>;

export const ELEMENT_ANNONCE: Record<SourceAnnonce, z.ZodType> = {
  'cloudflare-radar': ElementPreavis,
  tldrcve: ElementTldrcve,
};

/** Correspondance de mots entre un texte et le nom d'un produit surveillé : le nom (forme comparée, au moins trois
    caractères) apparaît en mots entiers. Indication « à confirmer », jamais une détection. */
export function produitCite(texteLibre: string, nomProduit: string): boolean {
  const nom = normaliserNom(nomProduit);
  if (nom.replace(/_/g, '').length < ANNONCES_BORNES.nomProduitMin) return false;
  return `_${normaliserNom(texteLibre)}_`.includes(`_${nom}_`);
}

/** Préavis gardé : CVE critique, ou nom d'un produit surveillé cité. Renvoie les noms cités (bornés) et le motif. */
export function retenirPreavis(
  e: Pick<ElementPreavis, 'titre' | 'resume' | 'gravite'>,
  nomsProduits: readonly string[],
): { garder: boolean; critique: boolean; produits: string[] } {
  const critique = e.gravite === 'CRITICAL';
  const texteLibre = `${e.titre} ${e.resume}`;
  const produits = [...new Set(nomsProduits.filter((n) => produitCite(texteLibre, n)))].slice(
    0,
    ANNONCES_BORNES.produitsCites,
  );
  return { garder: critique || produits.length > 0, critique, produits };
}

/* ------------------------------------------------------------------ API */
export const ReglageSourceAnnonce = z
  .object({
    activee: z.boolean().optional(),
    frequenceMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .strict()
  .refine((r) => r.activee !== undefined || r.frequenceMinutes !== undefined, { message: 'Aucun réglage.' });
export type ReglageSourceAnnonce = z.infer<typeof ReglageSourceAnnonce>;
export const SourceAnnonceParams = z.object({ source: SourceAnnonce }).strict();

export const ANNONCES_PAR_PAGE = 20;
export const RechercheAnnonces = z
  .object({
    source: SourceAnnonce,
    page: z.coerce.number().int().min(1).max(200).default(1),
  })
  .strict();
export type RechercheAnnonces = z.infer<typeof RechercheAnnonces>;

export interface EtatSourceAnnonceDto {
  source: SourceAnnonce;
  libelle: string;
  organisme: string;
  hote: string;
  activee: boolean;
  frequenceMinutes: number;
  frequences: number[];
  derniereReussite: string | null;
  dernierEssai: string | null;
  erreur: string | null;
  prochaineCollecte: string | null;
  version: number;
}

/** Faits de la plateforme sur une CVE citée (les mêmes pour tout le monde, sans nom ni nombre). */
export interface FaitsAnnonceCve {
  cve: string;
  /** Exploitation avérée selon une source de la veille (KEV, CERT, Tenable…). */
  exploitee: boolean;
  kev: boolean;
  epss: number | null;
  presente: boolean;
  exposee: boolean;
  /** Rapprochée d'un produit surveillé (proposée, rattachée ou confirmée). */
  produitSurveille: boolean;
}

export interface AnnonceDto {
  id: string;
  source: SourceAnnonce;
  titre: string;
  resume: string;
  lien: string | null;
  publieLe: string | null;
  vuLe: string;
  cves: string[];
  /** Cloudflare : gravité et score annoncés, catalogue KEV annoncé, motif de la retenue. */
  gravite: (typeof GRAVITES_CVSS)[number] | null;
  score: number | null;
  versionCvss: string | null;
  kevAnnonce: boolean | null;
  critique: boolean;
  /** Noms de produits surveillés cités par le texte (à confirmer). */
  produitsCites: string[];
  /** tldrcve : nouvelle ou mise à jour, verdict. */
  nature: 'nouvelle' | 'mise_a_jour' | null;
  verdict: VerdictTldrcve | null;
  verdictTexte: string | null;
  faits: FaitsAnnonceCve[];
}

export interface PageAnnoncesDto {
  total: number;
  page: number;
  parPage: number;
  elements: AnnonceDto[];
}
