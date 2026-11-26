/* Certificat X.509 auto-signé (RSA, SHA-256), sans dépendance : il porte la clé publique du service de la connexion unique
   (ADR 0114), que l'administrateur recopie chez le fournisseur d'identité pour qu'il vérifie les demandes signées. Le
   certificat ne sert pas de chaîne de confiance : seul compte sa clé publique. Encodage DER minimal (RFC 5280) : version 3,
   numéro de série aléatoire, émetteur et sujet réduits au nom commun, sans extension. Les tests s'en servent aussi pour
   fabriquer le certificat d'un fournisseur fictif. */
import crypto from 'node:crypto';

const longueur = (n: number): Buffer => {
  if (n < 0x80) return Buffer.from([n]);
  const octets: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) octets.unshift(v & 0xff);
  return Buffer.from([0x80 | octets.length, ...octets]);
};
const tlv = (tag: number, contenu: Buffer) => Buffer.concat([Buffer.from([tag]), longueur(contenu.length), contenu]);
const sequence = (...x: Buffer[]) => tlv(0x30, Buffer.concat(x));
const ensemble = (...x: Buffer[]) => tlv(0x31, Buffer.concat(x));
const entier = (b: Buffer) => tlv(0x02, b[0]! & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b);
const NUL = Buffer.from([0x05, 0x00]);

function oid(texte: string): Buffer {
  const p = texte.split('.').map(Number);
  const octets = [40 * p[0]! + p[1]!];
  for (const v of p.slice(2)) {
    const groupe: number[] = [v & 0x7f];
    for (let x = Math.floor(v / 128); x > 0; x = Math.floor(x / 128)) groupe.unshift(0x80 | (x & 0x7f));
    octets.push(...groupe);
  }
  return tlv(0x06, Buffer.from(octets));
}

/** UTCTime jusqu'en 2049, GeneralizedTime ensuite (RFC 5280, 4.1.2.5). */
function temps(d: Date): Buffer {
  const iso = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const chiffres = iso.replace(/[-:T]/g, '');
  return d.getUTCFullYear() < 2050
    ? tlv(0x17, Buffer.from(chiffres.slice(2), 'ascii'))
    : tlv(0x18, Buffer.from(chiffres, 'ascii'));
}

const SHA256_RSA = sequence(oid('1.2.840.113549.1.1.11'), NUL);

/** Certificat PEM auto-signé pour la clé privée RSA donnée. */
export function certificatAutoSigne(
  clePrivee: crypto.KeyObject | string,
  o: { nomCommun: string; jours: number; debut?: Date },
): string {
  const cle = typeof clePrivee === 'string' ? crypto.createPrivateKey(clePrivee) : clePrivee;
  const spki = crypto.createPublicKey(cle).export({ type: 'spki', format: 'der' });
  const nom = sequence(ensemble(sequence(oid('2.5.4.3'), tlv(0x0c, Buffer.from(o.nomCommun, 'utf8')))));
  const serie = crypto.randomBytes(16);
  serie[0] = (serie[0]! & 0x7f) | 0x01;
  // Une minute de marge en arrière : une horloge du fournisseur un peu en retard n'écarte pas le certificat.
  const debut = o.debut ?? new Date(Date.now() - 60e3);
  const fin = new Date(debut.getTime() + o.jours * 86400e3);
  const tbs = sequence(
    tlv(0xa0, entier(Buffer.from([2]))),
    entier(serie),
    SHA256_RSA,
    nom,
    sequence(temps(debut), temps(fin)),
    nom,
    spki,
  );
  const signature = crypto.sign('sha256', tbs, cle);
  const der = sequence(tbs, SHA256_RSA, tlv(0x03, Buffer.concat([Buffer.from([0]), signature])));
  const b64 = der.toString('base64').replace(/(.{64})/g, '$1\n');
  return `-----BEGIN CERTIFICATE-----\n${b64.replace(/\n$/, '')}\n-----END CERTIFICATE-----\n`;
}

/** Clé RSA 3072 bits et son certificat auto-signé (dix ans), en PEM. */
export function genererCleEtCertificat(nomCommun: string): { cle: string; certificat: string } {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  return {
    cle: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    certificat: certificatAutoSigne(privateKey, { nomCommun, jours: 3650 }),
  };
}
