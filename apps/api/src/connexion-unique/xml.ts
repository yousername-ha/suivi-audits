/* Analyse XML durcie de la connexion unique SAML (ADR 0114) : « aucun XML hors SAML » dans l'API. Tout document reçu
   (réponse du fournisseur sur l'adresse de retour, métadonnées lues ou importées) passe d'abord par xmlSur : taille bornée,
   UTF-8 strict, aucune déclaration de DTD, d'entité ou de notation (DOCTYPE, ENTITY, ATTLIST, ELEMENT, NOTATION), aucun
   caractère nul. L'analyse elle-même est celle de @node-saml/node-saml (xmldom, xpath, xml-crypto), jamais une autre. Les
   algorithmes de signature et de condensé sont limités à SHA-256 et au-delà : SHA-1 est refusé. */
import crypto from 'node:crypto';
import xmlSaml from '@node-saml/node-saml/lib/xml.js';

/** Nœud DOM minimal (xmldom), sans dépendre des types du navigateur. */
export interface NoeudXml {
  localName: string;
  namespaceURI: string | null;
  textContent: string | null;
  getAttribute(nom: string): string | null;
}

const lib = xmlSaml as unknown as {
  parseDomFromString(xml: string): Promise<{ documentElement: NoeudXml }>;
  xpath: { selectElements(n: unknown, x: string): NoeudXml[]; selectAttributes(n: unknown, x: string): NoeudXml[] };
  getVerifiedXml(xml: string, noeud: unknown, pems: string[]): string | null;
};

export type MotifXml = 'xml' | 'algorithme' | 'signature' | 'metadonnees';
export class RefusXml extends Error {
  constructor(
    readonly motif: MotifXml,
    message: string,
  ) {
    super(message);
  }
}

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Texte XML sûr à analyser, ou refus. */
export function xmlSur(octets: Buffer, max: number): string {
  if (octets.length === 0) throw new RefusXml('xml', 'Document XML vide.');
  if (octets.length > max) throw new RefusXml('xml', 'Document XML trop volumineux.');
  const corps = octets.subarray(0, 3).equals(BOM) ? octets.subarray(3) : octets;
  let texte: string;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(corps);
  } catch {
    throw new RefusXml('xml', 'Document XML illisible : UTF-8 attendu.');
  }
  if (texte.includes('\u0000')) throw new RefusXml('xml', 'Document XML illisible : caractère nul.');
  // Toute déclaration « <! » autre qu'un commentaire ou une section CDATA : DTD, entité, notation, liste d'attributs.
  if (/<!(?!--|\[CDATA\[)/.test(texte)) throw new RefusXml('xml', 'Document XML refusé : DTD ou entité déclarée.');
  const declaration = /^\s*<\?xml\b([^?]*)\?>/.exec(texte);
  const encodage = declaration && /\bencoding\s*=\s*["']([^"']*)["']/i.exec(declaration[1]!);
  if (encodage && !/^utf-?8$/i.test(encodage[1]!))
    throw new RefusXml('xml', 'Document XML refusé : seul l’encodage UTF-8 est accepté.');
  return texte;
}

const DSIG = 'http://www.w3.org/2000/09/xmldsig#';
/** Algorithmes admis (SHA-256 ou plus), parmi ceux que xml-crypto sait vérifier. */
export const SIGNATURES_ADMISES = new Set([
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1',
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
]);
export const CONDENSES_ADMIS = new Set([
  'http://www.w3.org/2001/04/xmlenc#sha256',
  'http://www.w3.org/2001/04/xmlenc#sha512',
]);

/** Analyse (après xmlSur) et contrôle des algorithmes de toutes les signatures du document. Rend le document. */
export async function analyser(texte: string): Promise<{ racine: NoeudXml; signatures: number }> {
  let doc: { documentElement: NoeudXml };
  try {
    doc = await lib.parseDomFromString(texte);
  } catch {
    throw new RefusXml('xml', 'Document XML mal formé.');
  }
  const racine = doc.documentElement;
  if (!racine) throw new RefusXml('xml', 'Document XML mal formé.');
  const methodes = lib.xpath.selectElements(doc, `//*[local-name()='SignatureMethod' and namespace-uri()='${DSIG}']`);
  const condenses = lib.xpath.selectElements(doc, `//*[local-name()='DigestMethod' and namespace-uri()='${DSIG}']`);
  for (const m of methodes)
    if (!SIGNATURES_ADMISES.has(m.getAttribute('Algorithm') ?? ''))
      throw new RefusXml('algorithme', 'Algorithme de signature refusé : SHA-256 ou plus exigé.');
  for (const d of condenses)
    if (!CONDENSES_ADMIS.has(d.getAttribute('Algorithm') ?? ''))
      throw new RefusXml('algorithme', 'Algorithme de condensé refusé : SHA-256 ou plus exigé.');
  return { racine, signatures: methodes.length };
}

export const selectionner = (n: unknown, x: string) => lib.xpath.selectElements(n, x);
export const attribut = (n: NoeudXml, nom: string) => n.getAttribute(nom);
export const contenuVerifie = (xml: string, n: unknown, pems: string[]) => lib.getVerifiedXml(xml, n, pems);

/** Certificat X.509 en PEM à partir du contenu base64 d'un élément X509Certificate. */
export function pemDepuisBase64(b64: string): string {
  const net = b64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(net))
    throw new RefusXml('metadonnees', 'Certificat illisible dans les métadonnées.');
  return `-----BEGIN CERTIFICATE-----\n${net.replace(/(.{64})/g, '$1\n').replace(/\n$/, '')}\n-----END CERTIFICATE-----\n`;
}

export interface CertificatLu {
  pem: string;
  empreinte: string;
  sujet: string;
  expireLe: string;
}

/** Lecture d'un certificat : empreinte SHA-256 (hexadécimal), sujet, fin de validité. */
export function lireCertificat(pem: string): CertificatLu {
  let x: crypto.X509Certificate;
  try {
    x = new crypto.X509Certificate(pem);
  } catch {
    throw new RefusXml('metadonnees', 'Certificat illisible dans les métadonnées.');
  }
  return {
    pem,
    empreinte: x.fingerprint256.replace(/:/g, '').toLowerCase(),
    sujet: x.subject.replace(/\s+/g, ' ').slice(0, 300),
    expireLe: new Date(x.validTo).toISOString(),
  };
}
