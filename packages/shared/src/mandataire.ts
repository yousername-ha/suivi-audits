/* Mandataire sortant (proxy) de l'établissement (ADR 0101, lot P1) : un réglage unique de la configuration système, inactif
   par défaut. Adresse `http://hôte:port` (nom ou adresse IP, IPv6 entre crochets, adresses privées admises, port
   obligatoire), sans identifiant dans l'adresse, sans chemin, paramètre ni fragment ; identifiant facultatif ; mot de passe
   facultatif, scellé à part et jamais relu ; autorité de certification de l'établissement facultative (PEM), ajoutée aux
   autorités du système pour les seuls flux qui passent par le mandataire. Authentification simple seulement (Basic) : NTLM
   et Kerberos ne sont pas pris en charge. Lot P1 : la veille des vulnérabilités l'emprunte ; lot ALH1 : le connecteur
   AlgoLightHouse aussi (service sur Internet). */
import { z } from 'zod';
import { AutoriteCertificationPem } from './integrations.js';
import { FLUX_EXTERNES, type FluxExterneDefinition, type FluxModule } from './flux-externes.js';

/* ------------------------------------------------------------------ Adresse */
const LABEL_DNS = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const OCTET = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** Adresse IPv4 en notation pointée stricte (quatre nombres de 0 à 255, sans zéro de tête). */
export function estIpv4(s: string): boolean {
  const p = s.split('.');
  return p.length === 4 && p.every((x) => OCTET.test(x));
}

/** Adresse IPv6 (forme complète ou abrégée par « :: », IPv4 finale admise), sans zone ni crochets. */
export function estIpv6(s: string): boolean {
  if (!/^[0-9A-Fa-f:.]{2,45}$/.test(s)) return false;
  const doubles = s.split('::');
  if (doubles.length > 2) return false;
  const groupes = (t: string) => (t === '' ? [] : t.split(':'));
  const tete = groupes(doubles[0]!);
  const queue = doubles.length === 2 ? groupes(doubles[1]!) : [];
  const tous = [...tete, ...queue];
  let n = 0;
  for (let i = 0; i < tous.length; i++) {
    const g = tous[i]!;
    if (i === tous.length - 1 && g.includes('.')) {
      if (!estIpv4(g)) return false;
      n += 2;
    } else if (/^[0-9A-Fa-f]{1,4}$/.test(g)) n += 1;
    else return false;
  }
  return doubles.length === 2 ? n <= 7 : n === 8;
}

/** Nom d'hôte DNS (lettres, chiffres, tirets ; 253 caractères au plus). Un nom fait seulement de chiffres et de points
    n'est pas un nom : il doit être une adresse IPv4 valide. */
export function estNomHote(s: string): boolean {
  if (s.length < 1 || s.length > 253 || /^[0-9.]+$/.test(s)) return false;
  return s.split('.').every((l) => LABEL_DNS.test(l));
}

export interface AdresseMandataireAnalysee {
  /** Hôte tel que l'exécutant le joint : nom, IPv4, ou IPv6 sans crochets. */
  hote: string;
  port: number;
}

/** Analyse d'une adresse `http://hôte:port` ; renvoie le motif du refus, en clair, sinon l'hôte et le port. */
export function analyserAdresseMandataire(brut: string): AdresseMandataireAnalysee | { erreur: string } {
  const s = brut.trim();
  if (/^https:\/\//i.test(s))
    return { erreur: 'Mandataire en https:// non pris en charge : indiquez son adresse en http://hôte:port.' };
  if (!s.startsWith('http://')) return { erreur: 'Adresse attendue sous la forme http://hôte:port.' };
  const reste = s.slice('http://'.length);
  if (reste.includes('@'))
    return { erreur: 'Pas d’identifiant dans l’adresse : renseignez-le dans le champ Identifiant.' };
  if (/[/?#]/.test(reste))
    return { erreur: 'Adresse sans chemin, paramètre ni fragment : http://hôte:port seulement.' };
  let hote: string, port: string;
  if (reste.startsWith('[')) {
    const fin = reste.indexOf(']');
    if (fin < 0) return { erreur: 'Adresse IPv6 attendue entre crochets : http://[2001:db8::1]:3128.' };
    hote = reste.slice(1, fin);
    if (!estIpv6(hote)) return { erreur: 'Adresse IPv6 invalide.' };
    if (reste[fin + 1] !== ':') return { erreur: 'Port obligatoire : http://hôte:port.' };
    port = reste.slice(fin + 2);
  } else {
    const i = reste.lastIndexOf(':');
    if (i < 0) return { erreur: 'Port obligatoire : http://hôte:port.' };
    hote = reste.slice(0, i);
    port = reste.slice(i + 1);
    if (hote.includes(':')) return { erreur: 'Adresse IPv6 attendue entre crochets : http://[2001:db8::1]:3128.' };
    if (/^[0-9.]+$/.test(hote) ? !estIpv4(hote) : !estNomHote(hote))
      return { erreur: 'Nom d’hôte ou adresse IP invalide.' };
  }
  if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535) return { erreur: 'Port obligatoire, de 1 à 65535.' };
  return { hote, port: Number(port) };
}

/** Adresse du mandataire : vide (aucun mandataire réglé) ou `http://hôte:port` valide. */
export const AdresseMandataire = z
  .string()
  .trim()
  .max(300)
  .superRefine((v, ctx) => {
    if (v === '') return;
    const a = analyserAdresseMandataire(v);
    if ('erreur' in a) ctx.addIssue({ code: 'custom', message: a.erreur });
  });

/** Identifiant de l'authentification simple : pas de deux-points (séparateur de Basic) ni de caractère de contrôle. */
export const IdentifiantMandataire = z
  .string()
  .trim()
  .max(255)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^:\u0000-\u001f\u007f]*$/, 'Identifiant sans deux-points ni caractère de contrôle.');

export const ReglageMandataire = z
  .object({
    actif: z.boolean(),
    adresse: AdresseMandataire,
    identifiant: IdentifiantMandataire,
    autoriteCertification: AutoriteCertificationPem,
  })
  .strict()
  .refine((v) => !v.actif || v.adresse !== '', {
    message: 'Renseignez l’adresse du mandataire avant de l’activer.',
    path: ['adresse'],
  });
export type ReglageMandataire = z.infer<typeof ReglageMandataire>;

export const REGLAGE_MANDATAIRE_DEFAUT: ReglageMandataire = {
  actif: false,
  adresse: '',
  identifiant: '',
  autoriteCertification: '',
};

/** Mot de passe en écriture seule : jamais relu, jamais renvoyé ; ni caractère de contrôle ni retour à la ligne. */
export const MandataireMotDePasseBody = z
  .object({
    password: z
      .string()
      .min(1)
      .max(500)
      // eslint-disable-next-line no-control-regex
      .regex(/^[^\u0000-\u001f\u007f]+$/, 'Mot de passe sans caractère de contrôle.'),
  })
  .strict();
export type MandataireMotDePasseBody = z.infer<typeof MandataireMotDePasseBody>;

/* ------------------------------------------------------------------ Flux et mandataire */
/** Ce que fait chaque flux du registre quand le mandataire est actif (lot P1). « utilise » : il passe par le mandataire ;
    « direct » : accès direct par construction (réseau interne, ou protocole non HTTP) ; « non_pris_en_charge » : il sort
    encore directement, le passage par le mandataire n'est pas réalisé (lots P2 et P3). */
export type UsageMandataire = 'utilise' | 'direct' | 'non_pris_en_charge';
export const USAGE_MANDATAIRE: Record<FluxModule, UsageMandataire> = {
  'veille-vulnerabilites': 'utilise',
  algolighthouse: 'utilise',
  tenable: 'direct',
  courriel: 'direct',
  assistant: 'non_pris_en_charge',
  'mises-a-jour': 'non_pris_en_charge',
  antivirus: 'non_pris_en_charge',
  acme: 'non_pris_en_charge',
  // Veille réglementaire (ADR 0110) : même script et même tunnel que la veille des vulnérabilités.
  'veille-reglementaire': 'utilise',
};
export const LIBELLES_USAGE_MANDATAIRE: Record<UsageMandataire, string> = {
  utilise: 'Utilise le mandataire',
  direct: 'Accès direct, par construction',
  non_pris_en_charge: 'Pas encore pris en charge',
};
/** Pourquoi : une phrase par flux, affichée dans l'écran du réglage. */
export const MOTIFS_USAGE_MANDATAIRE: Record<FluxModule, string> = {
  'veille-vulnerabilites':
    'Les demandes vers les sources publiques passent par un tunnel à travers le mandataire ; le certificat de chaque source reste vérifié.',
  algolighthouse:
    'Les demandes vers l’espace AlgoLightHouse passent par un tunnel à travers le mandataire ; le certificat de l’éditeur reste vérifié.',
  tenable: 'Tenable Security Center est interne : il est joint directement, jamais par le mandataire.',
  courriel: 'Le courriel parle SMTP, pas HTTP : il est envoyé directement au serveur de messagerie réglé.',
  assistant: 'Sort encore directement : le passage par le mandataire n’est pas réalisé (lot à venir).',
  'mises-a-jour': 'Sort encore directement : le passage par le mandataire n’est pas réalisé (lot à venir).',
  antivirus: 'Sort encore directement : le passage par le mandataire n’est pas réalisé (lot à venir).',
  acme: 'Sort encore directement : le passage par le mandataire n’est pas réalisé (lot à venir).',
  'veille-reglementaire':
    'Les demandes vers les flux des sources réglementaires passent par un tunnel à travers le mandataire ; le certificat de chaque source reste vérifié.',
};

/** Ligne de pare-feu d'un flux qui passe par le mandataire : la sortie va au mandataire, pas aux destinations. */
export const PARE_FEU_MANDATAIRE = 'Sortie TCP du serveur vers le mandataire de l’établissement, sur le port réglé.';
export const PRECISION_MANDATAIRE =
  'Les demandes passent par le mandataire réglé (tunnel chiffré de bout en bout) ; la destination finale est inchangée.';

/** Définition d'un flux telle qu'elle s'affiche quand le mandataire est actif : pour un flux qui l'utilise, la ligne de
    pare-feu devient la sortie vers le mandataire ; les destinations finales sont inchangées. Les autres flux sont rendus
    tels quels. */
export function fluxSelonMandataire(f: FluxExterneDefinition, mandataireActif: boolean): FluxExterneDefinition {
  if (!mandataireActif || USAGE_MANDATAIRE[f.id] !== 'utilise') return f;
  return { ...f, pareFeu: [PARE_FEU_MANDATAIRE] };
}

/** Le flux passe-t-il par le mandataire avec ce réglage ? */
export const passeParMandataire = (module: FluxModule, mandataireActif: boolean): boolean =>
  mandataireActif && USAGE_MANDATAIRE[module] === 'utilise';

/** Flux du registre, groupés par usage du mandataire, dans l'ordre du registre. */
export function fluxParUsageMandataire(): Record<UsageMandataire, FluxExterneDefinition[]> {
  const r: Record<UsageMandataire, FluxExterneDefinition[]> = { utilise: [], direct: [], non_pris_en_charge: [] };
  for (const f of FLUX_EXTERNES) r[USAGE_MANDATAIRE[f.id]].push(f);
  return r;
}

/* ------------------------------------------------------------------ Lecture */
/** Réglage tel que l'administrateur le lit : jamais le mot de passe, seulement s'il est défini. */
export const MandataireOut = z.object({
  values: ReglageMandataire,
  version: z.number().int(),
  motDePasseDefini: z.boolean(),
});
export type MandataireOut = z.infer<typeof MandataireOut>;
