/* A2 : validation locale avec les primitives Node, sans exécution shell. */
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import { isIP } from 'node:net';
import { HttpError } from './http/errors.js';

export function certificateInfo(pem: string, hostname: string, privateKey?: string) {
  try {
    const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
    if (
      !blocks.length ||
      blocks.length > 8 ||
      pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, '').trim()
    )
      throw new Error('format');
    const chain = blocks.map((b) => new X509Certificate(b));
    const cert = chain[0]!;
    const now = Date.now();
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i]!;
      if (privateKey && (Date.parse(c.validFrom) > now || Date.parse(c.validTo) <= now)) throw new Error('validité');
      if (chain[i + 1] && !c.verify(chain[i + 1]!.publicKey)) throw new Error('chaîne');
    }
    const hostMatches = !!(isIP(hostname) ? cert.checkIP(hostname) : cert.checkHost(hostname, { subject: 'never' }));
    let keyMatches: boolean | null = null;
    if (privateKey !== undefined) {
      const key = createPrivateKey(privateKey);
      keyMatches = createPublicKey(key)
        .export({ type: 'spki', format: 'der' })
        .equals(cert.publicKey.export({ type: 'spki', format: 'der' }));
      if (!keyMatches || !hostMatches || !['rsa', 'ec', 'ed25519', 'ed448'].includes(key.asymmetricKeyType ?? ''))
        throw new Error('cohérence');
      if (key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
        throw new Error('clé');
    }
    return {
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: new Date(cert.validFrom).toISOString(),
      validTo: new Date(cert.validTo).toISOString(),
      fingerprint: cert.fingerprint256.replace(/:/g, '').toLowerCase(),
      hostMatches,
      keyMatches,
    };
  } catch {
    throw new HttpError(422, 'Certificat ou clé invalide : vérifier format PEM, validité, chaîne, hôte et cohérence.');
  }
}
