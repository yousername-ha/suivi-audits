/* Métadonnées d'un fournisseur d'identité SAML 2.0 (ADR 0114) : un seul EntityDescriptor, entityID égal à celui attendu,
   un IDPSSODescriptor SAML 2.0, l'adresse de connexion HTTP-Redirect (HTTPS, sans identifiant) et les certificats de
   signature. Métadonnées signées : la signature est vérifiée (algorithmes SHA-256 ou plus), et seules les données couvertes
   par la signature sont lues. À la relecture automatique, la signature doit venir d'un certificat déjà connu du
   fournisseur ; au premier chargement et à l'import manuel (l'administrateur est alors la source de confiance), d'un des
   certificats que le document déclare. */
import crypto from 'node:crypto';
import { SSO_BORNES } from '@suivi/shared';
import {
  analyser,
  contenuVerifie,
  lireCertificat,
  pemDepuisBase64,
  RefusXml,
  selectionner,
  xmlSur,
  type CertificatLu,
  type NoeudXml,
} from './xml.js';

const MD = 'urn:oasis:names:tc:SAML:2.0:metadata';
const DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const PROTOCOLE = 'urn:oasis:names:tc:SAML:2.0:protocol';
const REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
const CERTIFICATS_MAX = 10;

export interface MetadonneesLues {
  entityId: string;
  ssoUrl: string;
  certificats: CertificatLu[];
  signees: boolean;
  /** SHA-256 du document reçu (hexadécimal). */
  empreinte: string;
}

const refus = (message: string): never => {
  throw new RefusXml('metadonnees', message);
};

function certificatsDeclares(racine: NoeudXml): CertificatLu[] {
  const idp = selectionner(racine, `./*[local-name()='IDPSSODescriptor' and namespace-uri()='${MD}']`);
  const lus = new Map<string, CertificatLu>();
  for (const d of idp) {
    for (const k of selectionner(d, `./*[local-name()='KeyDescriptor' and namespace-uri()='${MD}']`)) {
      const usage = k.getAttribute('use');
      if (usage && usage !== 'signing') continue;
      for (const x of selectionner(
        k,
        `./*[local-name()='KeyInfo' and namespace-uri()='${DSIG}']/*[local-name()='X509Data' and namespace-uri()='${DSIG}']/*[local-name()='X509Certificate' and namespace-uri()='${DSIG}']`,
      )) {
        const c = lireCertificat(pemDepuisBase64(x.textContent ?? ''));
        lus.set(c.empreinte, c);
      }
    }
  }
  return [...lus.values()].slice(0, CERTIFICATS_MAX);
}

/** Lecture et contrôle. `certificatsConnus` : PEM des certificats déjà reconnus (relecture automatique) ; vide au premier
    chargement et à l'import. */
export async function lireMetadonnees(
  octets: Buffer,
  o: { entityIdAttendu: string; certificatsConnus: string[] },
): Promise<MetadonneesLues> {
  const texte = xmlSur(octets, SSO_BORNES.metadonnees);
  let { racine } = await analyser(texte);
  if (racine.localName !== 'EntityDescriptor' || racine.namespaceURI !== MD)
    refus('Métadonnées refusées : un seul fournisseur (EntityDescriptor) est attendu par document.');
  let signees = false;
  if (selectionner(racine, `./*[local-name()='Signature' and namespace-uri()='${DSIG}']`).length) {
    const candidats = o.certificatsConnus.length ? o.certificatsConnus : certificatsDeclares(racine).map((c) => c.pem);
    let verifie: string | null;
    try {
      verifie = candidats.length ? contenuVerifie(texte, racine, candidats) : null;
    } catch {
      verifie = null;
    }
    if (!verifie)
      throw new RefusXml(
        'signature',
        o.certificatsConnus.length
          ? 'Signature des métadonnées invalide, ou faite par un certificat inconnu du fournisseur : configuration conservée.'
          : 'Signature des métadonnées invalide.',
      );
    // Seul le contenu couvert par la signature est lu.
    racine = (await analyser(verifie)).racine;
    signees = true;
  }
  const entityId = racine.getAttribute('entityID') ?? '';
  if (entityId !== o.entityIdAttendu)
    refus('Métadonnées refusées : leur identifiant (entityID) n’est pas celui attendu pour ce fournisseur.');
  const idp = selectionner(racine, `./*[local-name()='IDPSSODescriptor' and namespace-uri()='${MD}']`);
  if (idp.length !== 1)
    refus('Métadonnées refusées : un descripteur de fournisseur d’identité (IDPSSODescriptor) attendu.');
  if (!(idp[0]!.getAttribute('protocolSupportEnumeration') ?? '').split(/\s+/).includes(PROTOCOLE))
    refus('Métadonnées refusées : le fournisseur ne déclare pas SAML 2.0.');
  const sso = selectionner(
    idp[0]!,
    `./*[local-name()='SingleSignOnService' and namespace-uri()='${MD}' and @Binding='${REDIRECT}']`,
  )[0];
  const ssoUrl = sso?.getAttribute('Location') ?? '';
  let u: URL | null;
  try {
    u = new URL(ssoUrl);
  } catch {
    u = null;
  }
  if (!u || u.protocol !== 'https:' || u.username || u.password || ssoUrl.length > SSO_BORNES.url)
    refus('Métadonnées refusées : adresse de connexion HTTP-Redirect en https:// attendue.');
  const certificats = certificatsDeclares(racine);
  if (!certificats.length) refus('Métadonnées refusées : aucun certificat de signature.');
  return {
    entityId,
    ssoUrl,
    certificats,
    signees,
    empreinte: crypto.createHash('sha256').update(octets).digest('hex'),
  };
}
