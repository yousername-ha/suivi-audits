/* Clés de sécurité (ADR 0079) côté navigateur : appels à navigator.credentials via @simplewebauthn/browser (aucun script en
   ligne : le code est empaqueté par Vite, compatible avec la CSP stricte) et messages d'erreur en français. */
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { post } from './api';

export const navigateurCompatible = () => browserSupportsWebAuthn();

export const MESSAGE_NAVIGATEUR =
  'Ce navigateur ne prend pas en charge les clés de sécurité. Utilisez une version récente de Chrome, Edge, Firefox ou Safari, ou votre code de double authentification.';

/** Erreur du navigateur traduite pour la personne : annulation ou délai dépassé, clé déjà enregistrée, autre cas. */
export class ErreurCle extends Error {}

export function messageErreurCle(e: unknown): string {
  const err = e as { name?: string; code?: string; cause?: { name?: string }; message?: string };
  const nom = err?.cause?.name ?? err?.name;
  if (err?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || nom === 'InvalidStateError')
    return 'Cette clé est déjà enregistrée sur votre compte.';
  if (err?.code === 'ERROR_CEREMONY_ABORTED' || nom === 'NotAllowedError' || nom === 'AbortError')
    return 'Opération annulée ou délai dépassé. Recommencez et touchez votre clé quand elle clignote.';
  if (err?.code === 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT')
    return 'Cette clé ne permet pas de vérifier votre identité (code PIN ou biométrie) : utilisez une clé FIDO2 récente.';
  if (err?.code === 'ERROR_INVALID_DOMAIN' || err?.code === 'ERROR_INVALID_RP_ID' || nom === 'SecurityError')
    return 'Le navigateur refuse la clé pour cette adresse : ouvrez l’application par son adresse officielle (HTTPS).';
  if (nom === 'NotSupportedError') return MESSAGE_NAVIGATEUR;
  return 'La clé de sécurité n’a pas répondu. Réessayez, ou utilisez votre code de double authentification.';
}

async function navigateur<T>(fn: () => Promise<T>): Promise<T> {
  if (!navigateurCompatible()) throw new ErreurCle(MESSAGE_NAVIGATEUR);
  try {
    return await fn();
  } catch (e) {
    throw new ErreurCle(messageErreurCle(e));
  }
}

/** Réponse de la clé à une demande d'authentification (connexion ou ré-authentification). */
export const signerAvecCle = (optionsJSON: PublicKeyCredentialRequestOptionsJSON) =>
  navigateur<AuthenticationResponseJSON>(() => startAuthentication({ optionsJSON }));

/** Second facteur à la connexion : options (challenge de la session), puis vérification par le serveur. */
export async function connexionParCle() {
  const options = await post<PublicKeyCredentialRequestOptionsJSON>('/api/auth/webauthn/options', {});
  const response = await signerAvecCle(options);
  return post('/api/auth/webauthn', { response });
}

/** Enrôlement d'une clé (ré-authentification récente exigée par le serveur). */
export async function enrolerCle(label: string) {
  const options = await post<PublicKeyCredentialCreationOptionsJSON>('/api/account/webauthn/options', {});
  const response = await navigateur<RegistrationResponseJSON>(() => startRegistration({ optionsJSON: options }));
  return post<{ stage: string }>('/api/account/webauthn', { response, label });
}

/** Ré-authentification : mot de passe, puis code TOTP ou clé (si le compte en a une et que la personne la choisit). */
export async function reauthentifier(password: string, second: { code: string } | { cle: true } | null) {
  if (second && 'cle' in second) {
    const { options } = await post<{ options: PublicKeyCredentialRequestOptionsJSON | null }>(
      '/api/account/reauth/options',
      {},
    );
    if (!options) throw new ErreurCle('Aucune clé utilisable : saisissez votre code de double authentification.');
    const response = await signerAvecCle(options);
    return post<{ reauthJusqua: string }>('/api/account/reauth', { password, response });
  }
  return post<{ reauthJusqua: string }>('/api/account/reauth', { password, ...(second ? { code: second.code } : {}) });
}
