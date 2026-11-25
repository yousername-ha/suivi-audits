/* Connexion unique SAML 2.0 (ADR 0114) : fournisseurs d'identité (Microsoft Entra ID, Keycloak, SAML générique), preuve de la
   double authentification faite chez le fournisseur, comptes créés d'avance et rapprochés par un identifiant attendu,
   métadonnées lues automatiquement par l'exécutant d'exploitation (flux « sso-saml », fermé par défaut) ou importées.
   Les rôles, groupes et périmètres restent attribués dans l'application : le fournisseur ne fait que prouver l'identité. */
import { z } from 'zod';

/** Types de fournisseur : chacun a ses valeurs par défaut (preuve de double authentification, hôte des métadonnées). */
export const SSO_TYPES = ['entra', 'keycloak', 'saml'] as const;
export const SsoType = z.enum(SSO_TYPES);
export type SsoType = z.infer<typeof SsoType>;
export const LIBELLES_SSO_TYPES: Record<SsoType, string> = {
  entra: 'Microsoft Entra ID',
  keycloak: 'Keycloak',
  saml: 'SAML 2.0 générique',
};

/** Mode de connexion d'un compte : « local » (mot de passe et second facteur de l'application) ou « sso » (connexion unique
    seulement, ni mot de passe ni TOTP). */
export const MODES_CONNEXION = ['local', 'sso'] as const;
export const ModeConnexion = z.enum(MODES_CONNEXION);
export type ModeConnexion = z.infer<typeof ModeConnexion>;

/** Où lire la preuve de la double authentification dans l'assertion : un attribut nommé (Entra : claim
    authnmethodsreferences), ou la classe du contexte d'authentification (AuthnContextClassRef, Keycloak). */
export const SOURCES_MFA = ['attribut', 'authn_context'] as const;
export const SourceMfa = z.enum(SOURCES_MFA);
export type SourceMfa = z.infer<typeof SourceMfa>;

/** Rapprochement du compte : NameID de l'assertion (par défaut), ou valeur d'un attribut nommé. */
export const RAPPROCHEMENTS = ['nameid', 'attribut'] as const;
export const Rapprochement = z.enum(RAPPROCHEMENTS);
export type Rapprochement = z.infer<typeof Rapprochement>;

/** Hôte unique des métadonnées de Microsoft Entra ID (décision du RSSI du 25/11/2026, ADR 0114). */
export const HOTE_METADONNEES_ENTRA = 'login.microsoftonline.com';
/** Claim des méthodes d'authentification de Microsoft Entra ID, et valeur qui prouve la double authentification. */
export const ATTRIBUT_MFA_ENTRA = 'http://schemas.microsoft.com/claims/authnmethodsreferences';
export const VALEUR_MFA_ENTRA = 'http://schemas.microsoft.com/claims/multipleauthn';

/** Valeurs par défaut de la preuve de double authentification, par type. Keycloak : classe du contexte d'authentification,
    à aligner sur ce que le royaume renvoie (guide d'installation) ; générique : à régler. */
export const MFA_PAR_DEFAUT: Record<SsoType, { source: SourceMfa; attribut: string; valeurs: string[] }> = {
  entra: { source: 'attribut', attribut: ATTRIBUT_MFA_ENTRA, valeurs: [VALEUR_MFA_ENTRA] },
  keycloak: {
    source: 'authn_context',
    attribut: '',
    valeurs: ['https://refeds.org/profile/mfa', 'urn:oasis:names:tc:SAML:2.0:ac:classes:MobileTwoFactorContract'],
  },
  saml: { source: 'authn_context', attribut: '', valeurs: ['https://refeds.org/profile/mfa'] },
};

/** Bornes : taille des messages et des métadonnées, durées. */
export const SSO_BORNES = {
  /** Corps de la requête reçue sur l'adresse de retour (ACS), en octets. */
  corpsAcs: 256 * 1024,
  /** Métadonnées d'un fournisseur (lecture automatique ou import), en octets. */
  metadonnees: 1024 * 1024,
  /** Validité d'une demande de connexion (AuthnRequest), en minutes ; usage unique. */
  requeteMinutes: 5,
  /** Tolérance d'horloge sur NotBefore et NotOnOrAfter, en secondes. */
  toleranceHorlogeSecondes: 120,
  /** Période de relecture automatique des métadonnées, en heures. */
  relectureHeures: 6,
  /** Préavis de l'alerte d'expiration du certificat de signature du fournisseur, en jours. */
  preavisExpirationJours: 30,
  libelle: 120,
  valeur: 500,
  valeursMfa: 10,
  url: 2000,
  autorite: 20000,
} as const;

// eslint-disable-next-line no-control-regex
const SANS_CONTROLE = /^[^\u0000-\u001f\u007f]*$/;
const Texte = (max: number) => z.string().trim().max(max).regex(SANS_CONTROLE, 'Caractères de contrôle refusés.');

/** Adresse HTTPS sans identifiant, sans fragment, d'un hôte nommé (ou d'une adresse IP). Raison du refus, ou null. Le http
    clair et une adresse qui porte un identifiant ou un mot de passe sont refusés (décision du RSSI du 25/11/2026). */
export function refusUrlMetadonnees(url: string, type: SsoType): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'Adresse illisible.';
  }
  if (u.protocol !== 'https:') return 'Seule une adresse en https:// est acceptée.';
  if (u.username || u.password) return 'L’adresse ne doit porter ni identifiant ni mot de passe.';
  if (u.hash) return 'L’adresse ne doit pas porter de fragment (#).';
  if (!u.hostname) return 'Hôte manquant.';
  if (url.length > SSO_BORNES.url) return 'Adresse trop longue.';
  if (type === 'entra' && (u.hostname !== HOTE_METADONNEES_ENTRA || u.port !== ''))
    return `Pour Microsoft Entra ID, les métadonnées se lisent sur https://${HOTE_METADONNEES_ENTRA}/ seulement.`;
  return null;
}

/** Hôte (et port s'il n'est pas 443) joint par la lecture automatique, montré à la validation du flux. */
export function destinationMetadonnees(url: string): string | null {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return null;
  }
}

const UrlMetadonnees = z.string().trim().min(1).max(SSO_BORNES.url);

/** Création ou modification d'un fournisseur. `fluxConfirme` : validation explicite de l'ouverture du flux « sso-saml »
    vers l'hôte de l'adresse des métadonnées, exigée dès que cette adresse est nouvelle ou change. */
export const FournisseurSsoBody = z
  .object({
    type: SsoType,
    libelle: Texte(SSO_BORNES.libelle).min(1, 'Nom affiché obligatoire.'),
    actif: z.boolean(),
    /** Identifiant (entityID) attendu du fournisseur : les métadonnées et les assertions doivent le porter. */
    entityId: Texte(SSO_BORNES.url).min(1, 'Identifiant du fournisseur (entityID) obligatoire.'),
    urlMetadonnees: UrlMetadonnees.nullable(),
    /** Autorité de certification (PEM) d'un fournisseur interne, ajoutée aux autorités reconnues pour sa seule lecture. */
    autoriteTls: z.string().max(SSO_BORNES.autorite).nullable(),
    mfaSource: SourceMfa,
    mfaAttribut: Texte(SSO_BORNES.valeur),
    mfaValeurs: z
      .array(Texte(SSO_BORNES.valeur).min(1))
      .min(1, 'Au moins une valeur qui prouve la double authentification.')
      .max(SSO_BORNES.valeursMfa),
    rapprochement: Rapprochement,
    rapprochementAttribut: Texte(SSO_BORNES.valeur),
    fluxConfirme: z.literal(true).optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (b.mfaSource === 'attribut' && !b.mfaAttribut)
      ctx.addIssue({
        code: 'custom',
        path: ['mfaAttribut'],
        message: 'Nom de l’attribut de la double authentification.',
      });
    if (b.rapprochement === 'attribut' && !b.rapprochementAttribut)
      ctx.addIssue({
        code: 'custom',
        path: ['rapprochementAttribut'],
        message: 'Nom de l’attribut qui porte l’identifiant attendu.',
      });
    if (b.urlMetadonnees) {
      const refus = refusUrlMetadonnees(b.urlMetadonnees, b.type);
      if (refus) ctx.addIssue({ code: 'custom', path: ['urlMetadonnees'], message: refus });
    }
    if (b.autoriteTls && !/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(b.autoriteTls.trim()))
      ctx.addIssue({ code: 'custom', path: ['autoriteTls'], message: 'Certificat PEM attendu.' });
  });
export type FournisseurSsoBody = z.infer<typeof FournisseurSsoBody>;

/** Import manuel des métadonnées (secours, flux fermé) : le fichier XML du fournisseur. */
export const ImportMetadonneesBody = z.object({ xml: z.string().min(1).max(SSO_BORNES.metadonnees) }).strict();

export const CertificatSso = z.object({
  empreinte: z.string(),
  sujet: z.string(),
  expireLe: z.string(),
});
export type CertificatSso = z.infer<typeof CertificatSso>;

export const FournisseurSsoOut = z.object({
  id: z.string(),
  type: SsoType,
  libelle: z.string(),
  actif: z.boolean(),
  entityId: z.string(),
  urlMetadonnees: z.string().nullable(),
  autoriteTls: z.string().nullable(),
  mfaSource: SourceMfa,
  mfaAttribut: z.string(),
  mfaValeurs: z.array(z.string()),
  rapprochement: Rapprochement,
  rapprochementAttribut: z.string(),
  /** Adresse de connexion du fournisseur (HTTP-Redirect), lue dans ses métadonnées. */
  ssoUrl: z.string().nullable(),
  certificats: z.array(CertificatSso),
  /** Expiration la plus lointaine des certificats de signature (null sans certificat). */
  certificatExpireLe: z.string().nullable(),
  metadonnees: z.object({
    source: z.enum(['url', 'import']).nullable(),
    lueLe: z.string().nullable(),
    signees: z.boolean(),
    erreur: z.string().nullable(),
    erreurLe: z.string().nullable(),
    relectureDemandee: z.boolean(),
  }),
  /** Prêt : métadonnées lues (adresse de connexion et certificat). Un fournisseur actif et prêt est proposé à la connexion. */
  pret: z.boolean(),
  comptes: z.number(),
  /** Adresses propres à ce fournisseur, à déclarer chez lui. */
  sp: z.object({ acsUrl: z.string() }),
  version: z.number(),
});
export type FournisseurSsoOut = z.infer<typeof FournisseurSsoOut>;

/** Ce que l'administrateur recopie chez le fournisseur : identifiant du service (entityID), certificat des demandes signées. */
export const SpSsoOut = z.object({
  disponible: z.boolean(),
  raison: z.string().nullable(),
  entityId: z.string().nullable(),
  /** Certificat (PEM) qui signe les demandes de connexion ; null si la clé du service n'est pas générée. */
  certificat: z.string().nullable(),
  certificatExpireLe: z.string().nullable(),
  signeRequetes: z.boolean(),
});
export type SpSsoOut = z.infer<typeof SpSsoOut>;

export const ConnexionUniqueOut = z.object({ sp: SpSsoOut, fournisseurs: z.array(FournisseurSsoOut) });
export type ConnexionUniqueOut = z.infer<typeof ConnexionUniqueOut>;

/** Boutons de la page de connexion : fournisseurs actifs et prêts. */
export const OptionsConnexionSsoOut = z.array(z.object({ id: z.string(), libelle: z.string(), type: SsoType }));
export type OptionsConnexionSsoOut = z.infer<typeof OptionsConnexionSsoOut>;

/** Ré-authentification par la connexion unique : adresse vers laquelle naviguer (fournisseur, ForceAuthn). */
export const ReauthSsoBody = z.object({ retour: z.string().max(500).optional() }).strict();
export const ReauthSsoOut = z.object({ url: z.string() });

/** Champs de connexion d'un compte (administration). */
export const CompteSsoChamps = z.object({
  modeConnexion: ModeConnexion,
  fournisseurId: z.uuid().nullable(),
  identifiantExterne: Texte(SSO_BORNES.valeur).nullable(),
});

/** Motifs des refus, au journal d'audit (événements `auth.sso_refus`) ; codes stables. */
export const MOTIFS_REFUS_SSO = [
  'xml',
  'signature',
  'algorithme',
  'audience',
  'destination',
  'expiration',
  'rejeu',
  'requete_inconnue',
  'idp_initie',
  'mfa_absente',
  'compte_inconnu',
  'compte_local',
  'compte_desactive',
  'reauth_autre_compte',
  'fournisseur',
  'statut',
  'invalide',
] as const;
export type MotifRefusSso = (typeof MOTIFS_REFUS_SSO)[number];

/** Code montré sur la page de connexion après un refus (paramètre « sso ») : jamais le motif exact, qui reste au journal. */
export const CODES_ECHEC_SSO = ['refus', 'mfa', 'compte', 'expire', 'indisponible'] as const;
export type CodeEchecSso = (typeof CODES_ECHEC_SSO)[number];
export const MESSAGES_ECHEC_SSO: Record<CodeEchecSso, string> = {
  refus: 'La connexion unique a été refusée. Réessayez ; si le refus persiste, contactez un administrateur.',
  mfa: 'Connexion refusée : la double authentification doit être faite auprès de votre fournisseur d’identité. Réessayez en la validant.',
  compte:
    'Aucun compte actif de cette application n’est associé à votre identité. Un administrateur doit créer votre compte « connexion unique ».',
  expire: 'La demande de connexion a expiré ou a déjà servi. Recommencez depuis cette page.',
  indisponible: 'Ce fournisseur d’identité n’est pas disponible pour le moment.',
};
export const codeEchecSso = (m: MotifRefusSso): CodeEchecSso =>
  m === 'mfa_absente'
    ? 'mfa'
    : m === 'compte_inconnu' || m === 'compte_local' || m === 'compte_desactive'
      ? 'compte'
      : m === 'requete_inconnue' || m === 'expiration' || m === 'rejeu'
        ? 'expire'
        : m === 'fournisseur'
          ? 'indisponible'
          : 'refus';

/** Rapport de l'exécutant pour une lecture des métadonnées (`suivi sso-metadonnees-finish`) : contenu en base64, ou erreur
    sur une ligne. */
export const RapportMetadonneesSso = z.union([
  z.object({ ok: z.literal(true), contenu: z.base64().max(Math.ceil((SSO_BORNES.metadonnees * 4) / 3) + 8) }).strict(),
  z
    .object({
      ok: z.literal(false),
      erreur: z.string().min(1).max(300).regex(SANS_CONTROLE),
    })
    .strict(),
]);
export type RapportMetadonneesSso = z.infer<typeof RapportMetadonneesSso>;
