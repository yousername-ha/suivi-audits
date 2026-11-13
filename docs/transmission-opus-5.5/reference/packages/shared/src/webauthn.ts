/* Clés de sécurité FIDO2 / WebAuthn (ADR 0079) : politique, échanges avec l'API et bornes des réponses du navigateur.
   La vérification cryptographique est faite par le serveur (@simplewebauthn/server) ; ces schémas ne font que borner les
   tailles et les types avant cette vérification. */
import { z } from 'zod';

/** Clés conseillées par compte : une clé de secours rangée à part évite de dépendre du seul TOTP en cas de perte. */
export const CLES_RECOMMANDEES = 2;
/** Clés enregistrables par compte (révoquées exclues). */
export const CLES_MAX = 10;
/** Durée de validité d'une ré-authentification (mot de passe et second facteur) pour enrôler ou révoquer une clé. */
export const REAUTH_MINUTES = 5;
/** Nombre de codes de récupération générés à la fois. */
export const CODES_RECUPERATION = 10;

const b64url = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^[A-Za-z0-9_-]*$/, 'Encodage base64url attendu.');
const Transports = z.array(z.enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])).max(8);

/** Réponse de navigator.credentials.create(), telle que la sérialise @simplewebauthn/browser. */
export const ReponseEnrolement = z.object({
  id: b64url(1366).min(16),
  rawId: b64url(1366).min(16),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: b64url(8192),
    attestationObject: b64url(65536),
    authenticatorData: b64url(65536).optional(),
    transports: Transports.optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: b64url(8192).optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
});
export type ReponseEnrolement = z.infer<typeof ReponseEnrolement>;

/** Réponse de navigator.credentials.get(). */
export const ReponseAuthentification = z.object({
  id: b64url(1366).min(16),
  rawId: b64url(1366).min(16),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: b64url(8192),
    authenticatorData: b64url(8192),
    signature: b64url(2048),
    userHandle: b64url(512).optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
});
export type ReponseAuthentification = z.infer<typeof ReponseAuthentification>;

/** Nom donné à une clé : texte court, sans caractère de contrôle. */
export const LibelleCle = z
  .string()
  .trim()
  .min(1, 'Donnez un nom à la clé.')
  .max(64, '64 caractères au plus.')
  .refine((v) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(v), 'Caractères de contrôle refusés.');

export const EnrolementBody = z.object({ response: ReponseEnrolement, label: LibelleCle });
export const AuthentificationBody = z.object({ response: ReponseAuthentification });
export const RenommerCleBody = z.object({ label: LibelleCle });

/** Ré-authentification : mot de passe, puis un code TOTP OU une réponse de clé. Le mot de passe seul n'est accepté (par le
    serveur) que pour un compte qui n'a encore aucun second facteur. */
export const ReauthBody = z
  .object({
    password: z.string().min(1).max(256),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Code à 6 chiffres attendu.')
      .optional(),
    response: ReponseAuthentification.optional(),
  })
  .refine((b) => !(b.code && b.response), {
    message: 'Code de double authentification ou clé de sécurité : l’un ou l’autre.',
  });

/** Code de récupération : 16 caractères base32 en quatre groupes (tirets et espaces ignorés, casse indifférente). */
export const CODE_RECUPERATION_RE = /^[A-Z2-7]{16}$/;
export const normaliserCodeRecuperation = (v: string) => v.replace(/[\s-]+/g, '').toUpperCase();
export const CodeRecuperationBody = z.object({
  code: z
    .string()
    .max(40)
    .transform(normaliserCodeRecuperation)
    .refine((v) => CODE_RECUPERATION_RE.test(v), 'Code de récupération invalide.'),
});

/** Motif d'une intervention d'administrateur sur les facteurs d'un compte : consigné au journal d'audit. */
export const MotifBody = z.object({ motif: z.string().trim().min(3, 'Motif obligatoire.').max(500) });

const Aaguid = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'AAGUID attendu (format UUID).');
const CertificatPem = z
  .string()
  .trim()
  .max(8000)
  .regex(/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/, 'Certificat PEM attendu.');

/** Politique des clés de sécurité (Administration, Sécurité). La connexion sans mot de passe (phase 2) reste désactivée. */
export const WebauthnPolitique = z
  .object({
    /** Clé obligatoire pour les comptes qui détiennent « administration:administrer ». */
    obligatoireAdmins: z.boolean(),
    /** Délai laissé pour enrôler une clé après l'activation de l'obligation (ou la création du compte). */
    graceJours: z.number().int().min(0).max(90),
    /** N'accepter que des clés matérielles dont l'attestation est vérifiée et l'AAGUID autorisé. */
    materielUniquement: z.boolean(),
    aaguidAutorises: z.array(Aaguid).max(50),
    /** Autorités racines d'attestation ajoutées à celles de Yubico, livrées avec l'application. */
    racinesSupplementaires: z.array(CertificatPem).max(10),
    passwordless: z.literal(false),
  })
  .refine((p) => !p.materielUniquement || p.aaguidAutorises.length > 0, {
    message: 'Indiquez au moins un AAGUID autorisé pour n’accepter que des clés matérielles.',
    path: ['aaguidAutorises'],
  });
export type WebauthnPolitique = z.infer<typeof WebauthnPolitique>;

export const WEBAUTHN_POLITIQUE_DEFAUT: WebauthnPolitique = {
  obligatoireAdmins: false,
  graceJours: 14,
  materielUniquement: false,
  aaguidAutorises: [],
  racinesSupplementaires: [],
  passwordless: false,
};

/** YubiKey 5 courantes (modèles standards, USB et NFC), proposées dans l'interface. Source : FIDO Metadata Service (MDS3),
    blob n° 292 consulté le 30/10/2026, entrées « FIDO_CERTIFIED » ; libellés repris de la description publiée. */
export const AAGUID_CONNUS: { aaguid: string; nom: string }[] = [
  { aaguid: 'cb69481e-8ff7-4039-93ec-0a2729a154a8', nom: 'YubiKey 5 Series' },
  { aaguid: 'ee882879-721c-4913-9775-3dfcce97072a', nom: 'YubiKey 5 Series' },
  { aaguid: '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b', nom: 'YubiKey 5 Series' },
  { aaguid: 'ff4dac45-ede8-4ec2-aced-cf66103f4335', nom: 'YubiKey 5 Series' },
  { aaguid: 'fa2b99dc-9e39-4257-8f92-4a30d23c4118', nom: 'YubiKey 5 Series with NFC' },
  { aaguid: '2fc0579f-8113-47ea-b116-bb5a8db9202a', nom: 'YubiKey 5 Series with NFC' },
  { aaguid: 'a25342c0-3cdc-4414-8e46-f4807fca511c', nom: 'YubiKey 5 Series with NFC' },
  { aaguid: 'd7781e5d-e353-46aa-afe2-3ca49f13332a', nom: 'YubiKey 5 Series with NFC' },
];

export const WebauthnPolitiqueOut = z.object({
  politique: WebauthnPolitique,
  version: z.number(),
  /** Date d'activation de l'obligation (point de départ de la période de grâce), null si inactive. */
  activeeLe: z.string().nullable(),
  /** Configuration du serveur (RP_ID, RP_ORIGINS) : les clés ne sont proposées que si elle est utilisable. */
  serveur: z.object({
    disponible: z.boolean(),
    raison: z.string().nullable(),
    rpId: z.string().nullable(),
    rpName: z.string(),
    origines: z.array(z.string()),
    source: z.enum(['env', 'adresse_site', 'aucune']),
  }),
});
export type WebauthnPolitiqueOut = z.infer<typeof WebauthnPolitiqueOut>;

export const CleOut = z.object({
  id: z.string(),
  label: z.string(),
  deviceType: z.enum(['singleDevice', 'multiDevice']),
  backedUp: z.boolean(),
  aaguid: z.string(),
  transports: z.array(z.string()),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  suspect: z.boolean(),
  revokedAt: z.string().nullable(),
});
export type CleOut = z.infer<typeof CleOut>;

/** Facteurs d'un compte : page « Sécurité du compte » et fiche d'administration. */
export const FacteursOut = z.object({
  disponible: z.boolean(),
  totpEnabled: z.boolean(),
  cles: z.array(CleOut),
  codesRestants: z.number(),
  /** Une clé est exigée pour ce compte (politique des administrateurs, ou ré-enrôlement imposé). */
  obligatoire: z.boolean(),
  /** Fin de la période de grâce, quand l'obligation s'applique mais n'est pas encore échue. */
  echeance: z.string().nullable(),
  reenrolement: z.boolean(),
  /** Fin de la ré-authentification en cours (enrôlement et révocation possibles jusque-là). */
  reauthJusqua: z.string().nullable(),
});
export type FacteursOut = z.infer<typeof FacteursOut>;

export const CodesRecuperationOut = z.object({ codes: z.array(z.string()) });
