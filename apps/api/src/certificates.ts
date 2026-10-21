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
      // Un certificat SAN-only (notamment Caddy) peut n'avoir aucun DN de sujet.
      subject: cert.subject ?? '',
      issuer: cert.issuer ?? '',
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

export interface ControleCertificat {
  id: 'format' | 'validite' | 'chaine' | 'hote' | 'cle';
  libelle: string;
  ok: boolean;
  detail: string;
}
/** Aperçu en lecture seule d'un certificat avant son installation : chaque contrôle est restitué avec son résultat, sans
    jamais lever d'erreur ni conserver la clé. Mêmes règles que `certificateInfo` (qui reste seule juge à l'installation). */
export function apercuCertificat(pem: string, hostname: string, privateKey?: string) {
  const controles: ControleCertificat[] = [];
  const ajoute = (id: ControleCertificat['id'], libelle: string, ok: boolean, detail: string) =>
    controles.push({ id, libelle, ok, detail });
  const blocs = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  const reste = pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, '').trim();
  let chaine: X509Certificate[] = [];
  try {
    if (!blocs.length || blocs.length > 8 || reste) throw new Error('format');
    chaine = blocs.map((b) => new X509Certificate(b));
    ajoute('format', 'Format PEM', true, `${chaine.length} certificat(s) dans le fichier.`);
  } catch {
    ajoute('format', 'Format PEM', false, 'Un à huit certificats PEM sont attendus, sans autre contenu.');
    return { controles, ok: false, certificat: null };
  }
  const cert = chaine[0]!;
  const maintenant = Date.now();
  const valides = chaine.every((c) => Date.parse(c.validFrom) <= maintenant && Date.parse(c.validTo) > maintenant);
  ajoute(
    'validite',
    'Période de validité',
    valides,
    valides
      ? `Valide jusqu'au ${new Date(cert.validTo).toISOString().slice(0, 10)}.`
      : 'Un certificat de la chaîne est expiré ou pas encore valide.',
  );
  const chaineOk = chaine.every((c, i) => !chaine[i + 1] || c.verify(chaine[i + 1]!.publicKey));
  ajoute(
    'chaine',
    'Chaîne de certification',
    chaineOk,
    chaineOk ? 'Chaque certificat est signé par le suivant.' : 'Un certificat n’est pas signé par le suivant.',
  );
  const hote = !!(isIP(hostname) ? cert.checkIP(hostname) : cert.checkHost(hostname, { subject: 'never' }));
  ajoute(
    'hote',
    'Nom de l’hôte',
    hote,
    hote ? `Couvre « ${hostname} ».` : `Ne couvre pas « ${hostname} » (noms alternatifs du certificat).`,
  );
  if (privateKey !== undefined) {
    try {
      const cle = createPrivateKey(privateKey);
      const accord = createPublicKey(cle)
        .export({ type: 'spki', format: 'der' })
        .equals(cert.publicKey.export({ type: 'spki', format: 'der' }));
      const type = cle.asymmetricKeyType ?? '';
      const typeOk = ['rsa', 'ec', 'ed25519', 'ed448'].includes(type);
      const taille = cle.asymmetricKeyType === 'rsa' ? (cle.asymmetricKeyDetails?.modulusLength ?? 0) : null;
      const assez = taille === null || taille >= 2048;
      ajoute(
        'cle',
        'Clé privée',
        accord && typeOk && assez,
        !accord
          ? 'La clé ne correspond pas au certificat.'
          : !typeOk
            ? 'Type de clé non accepté.'
            : !assez
              ? 'Clé RSA de moins de 2048 bits.'
              : 'La clé correspond au certificat.',
      );
    } catch {
      ajoute('cle', 'Clé privée', false, 'Clé illisible ou protégée par mot de passe (non acceptée).');
    }
  }
  return {
    controles,
    ok: controles.every((c) => c.ok),
    certificat: {
      subject: cert.subject ?? '',
      issuer: cert.issuer ?? '',
      validFrom: new Date(cert.validFrom).toISOString(),
      validTo: new Date(cert.validTo).toISOString(),
      fingerprint: cert.fingerprint256.replace(/:/g, '').toLowerCase(),
      alternatifs: (cert.subjectAltName ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20),
    },
  };
}
