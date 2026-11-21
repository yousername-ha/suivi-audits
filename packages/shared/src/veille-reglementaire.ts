/* Veille réglementaire (ADR 0110, lot VR-1) : publications de sources officielles (RGPD, sécurité de l'information, santé)
   collectées par le même mécanisme que la veille des vulnérabilités (ADR 0100) : l'API ne joint aucune source (ADR 0014) ;
   elle inscrit des collectes que l'exécutant d'exploitation réclame par la CLI (`suivi veille-reglementaire-claim`, `-lot`,
   `-finish`) et confie au même script isolé (scripts/veille-vulnerabilites.py), dont la liste recopiée des hôtes et des
   chemins est comparée à celle-ci par apps/api/test/veille-reglementaire-architecture.test.ts.
   Les publications sont des données affichées en texte simple : balises retirées à la collecte, longueur bornée, lien gardé
   seulement en https sur l'hôte de sa source. ANSSI : titre, date et lien seulement, jamais de résumé (décision du RSSI du
   20/11/2026). CNIL (licence CC BY-ND) : le résumé du flux est repris tel quel ou pas du tout, jamais tronqué. ANS et
   Légifrance : valeurs prévues, sans collecteur (l'adresse indiquée pour l'ANS ne rend pas de flux, constat du 20/11/2026).
   EUR-Lex : le flux publie tous les actes du Journal officiel ; seuls ceux dont le titre contient un mot de la liste réglable
   (MOTS_CLES_EURLEX_DEFAUT) sont gardés, et le domaine se déduit du mot trouvé. */
import { z } from 'zod';
import type { FluxEtatApplique } from './flux-externes.js';
import type { Permission, SystemRole } from './permissions.js';
import { texteExterneValide, VEILLE_BORNES } from './veille-vulnerabilites.js';

/* ------------------------------------------------------------------ Sources (liste fermée) */
/** Identifiants stables (base, journal d'audit, CLI de l'exécutant) : ne jamais renommer. */
export const SOURCES_REGLEMENTAIRES = ['cnil', 'cepd', 'eur-lex', 'anssi', 'ans', 'legifrance'] as const;
export const SourceReglementaire = z.enum(SOURCES_REGLEMENTAIRES);
export type SourceReglementaire = z.infer<typeof SourceReglementaire>;
/** Sources dotées d'un collecteur. Légifrance (Journal officiel) et ANS : valeurs prévues, sans collecteur dans cette
    tranche (aucun flux public connu pour l'ANS). */
export const SOURCES_REGLEMENTAIRES_COLLECTEES = ['cnil', 'cepd', 'eur-lex', 'anssi'] as const;
export type SourceReglementaireCollectee = (typeof SOURCES_REGLEMENTAIRES_COLLECTEES)[number];
export const estSourceCollectee = (s: SourceReglementaire): s is SourceReglementaireCollectee =>
  (SOURCES_REGLEMENTAIRES_COLLECTEES as readonly string[]).includes(s);

export const DOMAINES_REGLEMENTAIRES = ['securite', 'donnees-personnelles'] as const;
export const DomaineReglementaire = z.enum(DOMAINES_REGLEMENTAIRES);
export type DomaineReglementaire = z.infer<typeof DomaineReglementaire>;
export const LIBELLES_DOMAINES: Record<DomaineReglementaire, string> = {
  securite: 'Sécurité de l’information',
  'donnees-personnelles': 'Données personnelles',
};

export interface SourceReglementaireDefinition {
  id: SourceReglementaire;
  libelle: string;
  organisme: string;
  /** Hôte joint (TCP 443), seul admis pour le flux et pour les liens des publications ; null : aucun collecteur. */
  hote: string | null;
  /** Chemin exact du flux (requête comprise) ; null : aucun collecteur. */
  chemin: string | null;
  /** Domaine de qualification des publications de la source (qui les qualifie : QUALIFICATION_SECURITE_ROLE, DROIT_DPO). EUR-Lex : domaine par
      défaut seulement, celui de chaque acte se déduit du mot-clé trouvé dans son titre. */
  domaine: DomaineReglementaire;
  /** Le résumé du flux est-il gardé ? Jamais pour l'ANSSI. */
  resume: boolean;
  langue: 'fr' | 'en';
  /** Conditions de reprise, affichées avec la source. */
  reprise: string;
}

export const SOURCES_REGLEMENTAIRES_DEFINITIONS: readonly SourceReglementaireDefinition[] = [
  {
    id: 'cnil',
    libelle: 'Actualités de la CNIL',
    organisme: 'CNIL',
    hote: 'www.cnil.fr',
    chemin: '/fr/rss.xml',
    domaine: 'donnees-personnelles',
    resume: true,
    langue: 'fr',
    reprise:
      'Licence CC BY-ND : titre, date, lien et résumé du flux repris tels quels, source citée, sans modification du texte (un résumé trop long n’est pas gardé plutôt que tronqué).',
  },
  {
    id: 'cepd',
    libelle: 'Publications du CEPD',
    organisme: 'Comité européen de la protection des données (CEPD, EDPB)',
    hote: 'www.edpb.europa.eu',
    chemin: '/feed/publications_en',
    domaine: 'donnees-personnelles',
    resume: true,
    langue: 'en',
    reprise: 'Titre, date, lien et résumé du flux repris tels quels (anglais), source citée.',
  },
  {
    id: 'eur-lex',
    libelle: 'Flux EUR-Lex',
    organisme: 'Office des publications de l’Union européenne (EUR-Lex)',
    hote: 'eur-lex.europa.eu',
    chemin: '/EN/display-feed.rss?rssId=222',
    domaine: 'securite',
    resume: true,
    langue: 'en',
    reprise:
      'Tous les actes du Journal officiel (série L) : seuls ceux dont le titre contient un mot-clé de la liste réglable sont gardés ; titre, date, lien et résumé du flux repris tels quels (anglais), source citée.',
  },
  {
    id: 'anssi',
    libelle: 'Actualités de l’ANSSI',
    organisme: 'ANSSI',
    hote: 'cyber.gouv.fr',
    chemin: '/actualites/rss/',
    domaine: 'securite',
    resume: false,
    langue: 'fr',
    reprise: 'Titre, date et lien seulement : le résumé n’est jamais repris.',
  },
  {
    id: 'ans',
    libelle: 'Actualités de l’Agence du numérique en santé',
    organisme: 'Agence du numérique en santé (ANS)',
    hote: null,
    chemin: null,
    domaine: 'securite',
    resume: false,
    langue: 'fr',
    reprise: 'Non disponible : aucun flux public connu.',
  },
  {
    id: 'legifrance',
    libelle: 'Journal officiel (Légifrance)',
    organisme: 'DILA',
    hote: null,
    chemin: null,
    domaine: 'securite',
    resume: false,
    langue: 'fr',
    reprise: 'Pas encore collecté : aucun flux dans cette tranche.',
  },
];

export const sourceReglementaire = (id: SourceReglementaire): SourceReglementaireDefinition =>
  SOURCES_REGLEMENTAIRES_DEFINITIONS.find((s) => s.id === id)!;
/** Sources jointes par le flux « veille-reglementaire » (celles qui ont un collecteur). */
export const SOURCES_REGLEMENTAIRES_JOINTES = SOURCES_REGLEMENTAIRES_DEFINITIONS.filter(
  (s): s is SourceReglementaireDefinition & { hote: string; chemin: string } => s.hote !== null && s.chemin !== null,
);

/* ------------------------------------------------------------------ Qualification */
export const STATUTS_PUBLICATION = ['a-qualifier', 'sans-objet', 'a-suivre', 'impactant'] as const;
export const StatutPublication = z.enum(STATUTS_PUBLICATION);
export type StatutPublication = z.infer<typeof StatutPublication>;
export const STATUTS_QUALIFIES = ['sans-objet', 'a-suivre', 'impactant'] as const;
export type StatutQualifie = (typeof STATUTS_QUALIFIES)[number];
export const LIBELLES_STATUTS: Record<StatutPublication, string> = {
  'a-qualifier': 'À qualifier',
  'sans-objet': 'Sans objet',
  'a-suivre': 'À suivre',
  impactant: 'Impactant',
};

/** Qui qualifie chaque domaine (décisions du RSSI du 20/11/2026) : la sécurité, le rôle prédéfini RSSI (tenu directement ou
    par un groupe, sur le modèle de la prise en compte des alertes de vulnérabilité, ADR 0100, lot V6b) ; les données
    personnelles, le droit réservé « DPO » (`veille_reglementaire:dpo`), cumulable avec tout rôle et donné à aucun rôle
    prédéfini. Ni le rôle Administrateur ni `veille_reglementaire:administrer` ne qualifient. */
export const QUALIFICATION_SECURITE_ROLE: SystemRole = 'rssi';
export const DROIT_DPO = 'veille_reglementaire:dpo' as const satisfies Permission;
/** Droits qui ouvrent la lecture du module : celui de la matrice, ou le droit réservé « DPO » à lui seul. */
export const LECTURE_VEILLE_REGLEMENTAIRE = [
  'veille_reglementaire:lire',
  DROIT_DPO,
] as const satisfies readonly Permission[];

export const QualificationBody = z.object({ statut: z.enum(STATUTS_QUALIFIES) }).strict();
export type QualificationBody = z.infer<typeof QualificationBody>;

/* ------------------------------------------------------------------ Éléments rapportés par l'exécutant */
/** Bornes, recopiées par la migration 098 et par le script de l'exécutant. */
export const VEILLE_REGLEMENTAIRE_BORNES = {
  identifiant: 300,
  titre: 300,
  resume: 1000,
  lien: 500,
  /** Publications gardées au plus par collecte (éléments `<item>` du flux). */
  items: 200,
  /** Mots-clés du filtre d'EUR-Lex : nombre et longueur de chacun. */
  motsCles: 60,
  motCle: 60,
} as const;

/* ------------------------------------------------------------------ Filtre d'EUR-Lex par mots-clés (décision du 20/11/2026) */
/** Forme comparée d'un texte : sans accent, en minuscules, tout ce qui n'est ni lettre ni chiffre réduit à une espace. Recopiée
    dans le script de l'exécutant (normaliser) ; concordance vérifiée sur des cas communs par les deux tests. */
export const normaliserMotCle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const MotCleEurLex = z
  .object({
    mot: z
      .string()
      .trim()
      .min(2)
      .max(VEILLE_REGLEMENTAIRE_BORNES.motCle)
      .refine((m) => normaliserMotCle(m).length >= 2, 'Mot-clé vide une fois les accents et la ponctuation retirés.'),
    domaine: DomaineReglementaire,
  })
  .strict();
export type MotCleEurLex = z.infer<typeof MotCleEurLex>;

/** Liste réglée : 1 à 60 mots, sans doublon une fois normalisés. `null` rétablit la liste par défaut. */
export const MotsClesEurLexBody = z
  .object({
    motsCles: z
      .array(MotCleEurLex)
      .min(1)
      .max(VEILLE_REGLEMENTAIRE_BORNES.motsCles)
      .refine((l) => new Set(l.map((m) => normaliserMotCle(m.mot))).size === l.length, 'Mot-clé en double.')
      .nullable(),
  })
  .strict();
export type MotsClesEurLexBody = z.infer<typeof MotsClesEurLexBody>;

/** Liste par défaut, en français et en anglais (le flux est en anglais). Chaque mot porte son domaine. */
export const MOTS_CLES_EURLEX_DEFAUT: readonly MotCleEurLex[] = [
  { mot: 'données personnelles', domaine: 'donnees-personnelles' },
  { mot: 'personal data', domaine: 'donnees-personnelles' },
  { mot: 'protection des données', domaine: 'donnees-personnelles' },
  { mot: 'data protection', domaine: 'donnees-personnelles' },
  { mot: 'vie privée', domaine: 'donnees-personnelles' },
  { mot: 'privacy', domaine: 'donnees-personnelles' },
  { mot: 'données de santé', domaine: 'donnees-personnelles' },
  { mot: 'health data', domaine: 'donnees-personnelles' },
  { mot: 'cybersécurité', domaine: 'securite' },
  { mot: 'cybersecurity', domaine: 'securite' },
  { mot: 'sécurité des réseaux', domaine: 'securite' },
  { mot: 'network and information security', domaine: 'securite' },
  { mot: 'sécurité de l’information', domaine: 'securite' },
  { mot: 'information security', domaine: 'securite' },
  { mot: 'dispositifs médicaux', domaine: 'securite' },
  { mot: 'medical devices', domaine: 'securite' },
  { mot: 'intelligence artificielle', domaine: 'securite' },
  { mot: 'artificial intelligence', domaine: 'securite' },
  { mot: 'identité numérique', domaine: 'securite' },
  { mot: 'digital identity', domaine: 'securite' },
  { mot: 'identification électronique', domaine: 'securite' },
  { mot: 'electronic identification', domaine: 'securite' },
  { mot: 'services de confiance', domaine: 'securite' },
  { mot: 'trust services', domaine: 'securite' },
  // « résilience » et « resilience » ont la même forme comparée : un seul mot couvre les deux langues.
  { mot: 'resilience', domaine: 'securite' },
];

/** Domaine d'un acte d'après son titre : celui du mot-clé trouvé (mot entier, sans tenir compte de la casse ni des accents) ;
    si des mots des deux domaines sont trouvés, « données personnelles » l'emporte (choix de réalisation, ADR 0110) ; null si
    aucun mot n'est trouvé (l'acte n'est pas gardé). */
export function domaineSelonMotsCles(titre: string, motsCles: readonly MotCleEurLex[]): DomaineReglementaire | null {
  const t = ` ${normaliserMotCle(titre)} `;
  const trouves = new Set(motsCles.filter((m) => t.includes(` ${normaliserMotCle(m.mot)} `)).map((m) => m.domaine));
  if (trouves.has('donnees-personnelles')) return 'donnees-personnelles';
  return trouves.has('securite') ? 'securite' : null;
}

/** Lien d'une publication : https, sur l'hôte exact de sa source, sans espace, guillemet ni chevron. */
export function lienPublicationValide(source: SourceReglementaire, lien: string): boolean {
  const hote = sourceReglementaire(source).hote;
  if (!hote || lien.length > VEILLE_REGLEMENTAIRE_BORNES.lien) return false;
  const prefixe = `https://${hote}/`;
  return lien.startsWith(prefixe) && !/[\s"'<>\\`]/.test(lien) && /^[\x21-\x7e]+$/.test(lien);
}

const texteExterne = (max: number) =>
  z.string().max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');

const ElementPublicationBase = z
  .object({
    /** Identifiant de la publication dans le flux (guid, sinon lien), pour ranger sans doublon. */
    identifiant: texteExterne(VEILLE_REGLEMENTAIRE_BORNES.identifiant).refine((s) => s.length > 0, 'Identifiant vide.'),
    titre: texteExterne(VEILLE_REGLEMENTAIRE_BORNES.titre).refine((s) => s.length > 0, 'Titre vide.'),
    resume: texteExterne(VEILLE_REGLEMENTAIRE_BORNES.resume)
      .refine((s) => s.length > 0, 'Résumé vide : null attendu.')
      .nullable(),
    lien: z.string().max(VEILLE_REGLEMENTAIRE_BORNES.lien),
    publieLe: z.iso.datetime(),
  })
  .strict();
export type ElementPublication = z.infer<typeof ElementPublicationBase>;

/** Schéma d'un élément selon la source de la collecte : résumé interdit si la source n'en garde pas, lien sur son hôte. */
export const elementPublication = (source: SourceReglementaireCollectee) =>
  ElementPublicationBase.refine((e) => sourceReglementaire(source).resume || e.resume === null, {
    message: 'Résumé refusé pour cette source.',
  }).refine((e) => lienPublicationValide(source, e.lien), { message: 'Lien refusé : https sur l’hôte de la source.' });

/* ------------------------------------------------------------------ Fréquences (lot F1 de l'ADR 0100, même règle) */
/** Fréquences admises, en heures, pour toutes les sources : les publications réglementaires changent peu. */
export const FREQUENCES_VEILLE_REGLEMENTAIRE = [4, 12, 24, 168] as const;
export const FREQUENCE_VEILLE_REGLEMENTAIRE_DEFAUT = 24;
export const frequenceReglementaireAdmise = (h: number) =>
  (FREQUENCES_VEILLE_REGLEMENTAIRE as readonly number[]).includes(h);

/** Réglage d'une source (activation, fréquence) ; If-Match sur la version de la source. */
export const ReglageSourceReglementaire = z
  .object({ activee: z.boolean().optional(), frequenceHeures: z.number().int().min(1).max(168).optional() })
  .strict()
  .refine((v) => v.activee !== undefined || v.frequenceHeures !== undefined, { message: 'Aucun réglage.' });
export type ReglageSourceReglementaire = z.infer<typeof ReglageSourceReglementaire>;

/** « Collecter maintenant » : une source, ou toutes les sources activées. */
export const DemandeCollecteReglementaire = z.object({ source: SourceReglementaire.optional() }).strict();
export type DemandeCollecteReglementaire = z.infer<typeof DemandeCollecteReglementaire>;

/* ------------------------------------------------------------------ API (lecture) */
export const VEILLE_REGLEMENTAIRE_PAR_PAGE = 25;

export const RecherchePublications = z
  .object({
    statut: StatutPublication.optional(),
    domaine: DomaineReglementaire.optional(),
    source: SourceReglementaire.optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(400).default(1),
  })
  .strict();
export type RecherchePublications = z.infer<typeof RecherchePublications>;

/** Suites données à une publication « impactant » : hors de cette tranche, toujours à zéro (contrat à convenir). */
export interface SuitesPublicationDto {
  exigences: number;
  actions: number;
  documents: number;
}

export interface PublicationReglementaireDto {
  id: string;
  source: SourceReglementaire;
  domaine: DomaineReglementaire;
  titre: string;
  resume: string | null;
  lien: string;
  publieLe: string;
  collecteLe: string;
  statut: StatutPublication;
  qualifieLe: string | null;
  qualifiePar: { id: string; nom: string } | null;
  suites: SuitesPublicationDto;
  version: number;
}

export interface PagePublicationsDto {
  elements: PublicationReglementaireDto[];
  total: number;
  page: number;
  parPage: number;
}

export interface CompteursQualificationDto {
  aQualifier: number;
  aSuivre: number;
  impactant: number;
  sansObjet: number;
}

export interface SyntheseVeilleReglementaireDto extends CompteursQualificationDto {
  parDomaine: { securite: CompteursQualificationDto; donneesPersonnelles: CompteursQualificationDto };
  /** Dernière collecte réussie, toutes sources confondues. */
  derniereCollecteLe: string | null;
  /** Sources activées dont la dernière collecte a échoué. */
  sourcesEnErreur: number;
}

export type EtatCollecteReglementaire = 'en_file' | 'en_cours' | 'recu' | 'echec' | 'expire';

export interface CollecteReglementaireDto {
  id: string;
  source: SourceReglementaireCollectee;
  origine: 'manuel' | 'planifie';
  etat: EtatCollecteReglementaire;
  demandeLe: string;
  termineLe: string | null;
  elements: number;
  tronque: boolean;
  erreur: string | null;
}

export interface EtatSourceReglementaireDto {
  source: SourceReglementaire;
  libelle: string;
  organisme: string;
  hote: string | null;
  domaine: DomaineReglementaire;
  langue: 'fr' | 'en';
  reprise: string;
  /** La source a-t-elle un collecteur (Légifrance : non) ? */
  collecteur: boolean;
  activee: boolean;
  frequenceHeures: number;
  derniereReussite: string | null;
  dernierEssai: string | null;
  erreur: string | null;
  /** Activée et dernière collecte en échec. */
  enErreur: boolean;
  /** Activée, flux ouvert, sans réussite depuis trois périodes. */
  enRetard: boolean;
  /** EUR-Lex : mots-clés en vigueur (réglés, sinon ceux par défaut) ; null pour les autres sources. */
  motsCles: { liste: MotCleEurLex[]; parDefaut: boolean } | null;
  derniereCollecte: CollecteReglementaireDto | null;
  /** Prochaine collecte automatique ; null si la source n'est pas activée ou le flux fermé. */
  prochaineCollecte: string | null;
  version: number;
}

export interface EtatVeilleReglementaireDto {
  flux: { ouvert: boolean; applique: FluxEtatApplique | null };
  executant: { disponible: boolean };
  mandataire: { actif: boolean };
  sources: EtatSourceReglementaireDto[];
}

/** Ce que la personne peut faire (affichage seulement : le serveur reste seul juge). */
export interface DroitsVeilleReglementaireDto {
  administrer: boolean;
  qualifier: { securite: boolean; donneesPersonnelles: boolean };
}

/** Borne réutilisée de la veille des vulnérabilités : éléments par lot rapporté par l'exécutant. */
export const VEILLE_REGLEMENTAIRE_LOT = VEILLE_BORNES.lot;
