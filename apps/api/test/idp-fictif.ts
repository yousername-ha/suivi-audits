/* Fournisseur d'identité SAML fictif pour les tests (ADR 0114) : clé et certificat générés à la volée, réponses et métadonnées
   signées avec la bibliothèque de l'application (@node-saml/node-saml, xml-crypto). Hôtes et identifiants fictifs
   (example.org, locataire à zéros) ; aucune donnée réelle. */
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import xmlSaml from '@node-saml/node-saml/lib/xml.js';
import { certificatAutoSigne } from '../src/security/certificat-auto-signe.js';

const lib = xmlSaml as unknown as {
  signXml(
    xml: string,
    xpath: string,
    location: { reference: string; action: 'append' | 'prepend' | 'before' | 'after' },
    o: { privateKey: string; publicCert?: string; signatureAlgorithm?: string; digestAlgorithm?: string },
  ): string;
};

export interface IdpFictif {
  cle: string;
  certificat: string;
  base64: string;
}

/** Clé RSA 2048 et certificat auto-signé (`jours` de validité). */
export function nouvelIdp(jours = 365): IdpFictif {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const certificat = certificatAutoSigne(privateKey, { nomCommun: 'idp.example.org', jours });
  return {
    cle: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    certificat,
    base64: certificat.replace(/-----[^-]+-----|\s+/g, ''),
  };
}

export const ENTITE_ENTRA = 'https://sts.windows.net/00000000-0000-4000-8000-0000000000aa/';
export const ENTITE_KEYCLOAK = 'https://sso.example.org/realms/fictif';
export const SSO_URL = 'https://login.example.org/saml2';
export const AMR = 'http://schemas.microsoft.com/claims/authnmethodsreferences';
export const MFA_ENTRA = 'http://schemas.microsoft.com/claims/multipleauthn';
export const MOT_DE_PASSE_ENTRA = 'http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password';

const echapper = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function metadonnees(o: {
  entityId: string;
  idp: IdpFictif;
  ssoUrl?: string;
  signer?: IdpFictif | null;
  autresCertificats?: IdpFictif[];
}): string {
  const certs = [o.idp, ...(o.autresCertificats ?? [])]
    .map(
      (c) =>
        `<md:KeyDescriptor use="signing"><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${c.base64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>`,
    )
    .join('');
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" ` +
    `xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ID="_md${crypto.randomBytes(8).toString('hex')}" entityID="${echapper(o.entityId)}">` +
    `<md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">${certs}` +
    `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${echapper(o.ssoUrl ?? SSO_URL)}"/>` +
    `</md:IDPSSODescriptor></md:EntityDescriptor>`;
  if (!o.signer) return xml;
  return lib.signXml(
    xml,
    "/*[local-name(.)='EntityDescriptor']",
    { reference: "/*[local-name(.)='EntityDescriptor']/*[local-name(.)='IDPSSODescriptor']", action: 'before' },
    {
      privateKey: o.signer.cle,
      publicCert: o.signer.certificat,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    },
  );
}

/** Identifiant de la demande (AuthnRequest) d'une adresse HTTP-Redirect, et la demande elle-même. */
export function lireDemande(location: string): { id: string; xml: string; url: URL } {
  const url = new URL(location);
  const xml = zlib.inflateRawSync(Buffer.from(url.searchParams.get('SAMLRequest') ?? '', 'base64')).toString('utf8');
  const id = /\bID="([^"]+)"/.exec(xml)?.[1];
  if (!id) throw new Error('Demande SAML sans identifiant.');
  return { id, xml, url };
}

export interface OptionsReponse {
  idp: IdpFictif;
  issuer: string;
  acs: string;
  audience: string;
  inResponseTo: string | null;
  nameId?: string;
  attributs?: Record<string, string[]>;
  contexte?: string;
  signer?: 'assertion' | 'reponse' | 'aucune';
  algo?: 'sha256' | 'sha1';
  destination?: string | null;
  recipient?: string;
  /** Décalage de NotOnOrAfter par rapport à maintenant, en secondes (300 par défaut). */
  expireDans?: number;
  assertionId?: string;
  /** Contenu inséré tel quel avant la racine (DOCTYPE, entité…). */
  prologue?: string;
  /** Remplacement fait APRÈS la signature (altération). */
  alterer?: [string, string];
}

/** Réponse SAML (samlp:Response) signée comme demandé, en base64 prête à poster. */
export function reponse(o: OptionsReponse): string {
  const maintenant = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const fin = iso(maintenant + (o.expireDans ?? 300) * 1000);
  const debut = iso(maintenant - 60e3);
  const irt = o.inResponseTo ? ` InResponseTo="${echapper(o.inResponseTo)}"` : '';
  const attributs = Object.entries(o.attributs ?? {})
    .map(
      ([nom, valeurs]) =>
        `<saml:Attribute Name="${echapper(nom)}">${valeurs.map((v) => `<saml:AttributeValue>${echapper(v)}</saml:AttributeValue>`).join('')}</saml:Attribute>`,
    )
    .join('');
  const assertionId = o.assertionId ?? `_a${crypto.randomBytes(10).toString('hex')}`;
  const destination = o.destination === null ? '' : ` Destination="${echapper(o.destination ?? o.acs)}"`;
  let xml =
    `${o.prologue ?? ''}<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="_r${crypto.randomBytes(10).toString('hex')}" Version="2.0" IssueInstant="${iso(maintenant)}"${destination}${irt}>` +
    `<saml:Issuer>${echapper(o.issuer)}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="${assertionId}" Version="2.0" IssueInstant="${iso(maintenant)}">` +
    `<saml:Issuer>${echapper(o.issuer)}</saml:Issuer>` +
    `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${echapper(o.nameId ?? 'alice@example.org')}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData${irt} NotOnOrAfter="${fin}" Recipient="${echapper(o.recipient ?? o.acs)}"/></saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotBefore="${debut}" NotOnOrAfter="${fin}"><saml:AudienceRestriction><saml:Audience>${echapper(o.audience)}</saml:Audience></saml:AudienceRestriction></saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${iso(maintenant)}" SessionIndex="_s1"><saml:AuthnContext><saml:AuthnContextClassRef>${echapper(o.contexte ?? 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport')}</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>` +
    (attributs ? `<saml:AttributeStatement>${attributs}</saml:AttributeStatement>` : '') +
    `</saml:Assertion></samlp:Response>`;
  const options = {
    privateKey: o.idp.cle,
    publicCert: o.idp.certificat,
    signatureAlgorithm: o.algo ?? 'sha256',
    digestAlgorithm: o.algo ?? 'sha256',
  };
  const signer = o.signer ?? 'assertion';
  if (signer === 'assertion')
    xml = lib.signXml(
      xml,
      "//*[local-name(.)='Assertion']",
      { reference: "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']", action: 'after' },
      options,
    );
  if (signer === 'reponse')
    xml = lib.signXml(
      xml,
      "/*[local-name(.)='Response']",
      { reference: "/*[local-name(.)='Response']/*[local-name(.)='Issuer']", action: 'after' },
      options,
    );
  if (o.alterer) xml = xml.replace(o.alterer[0], o.alterer[1]);
  return Buffer.from(xml, 'utf8').toString('base64');
}
