/* Authentificateur FIDO2 logiciel, pour les tests seulement : produit des réponses WebAuthn signées (ES256) comme le ferait une
   clé, avec des défauts réglables (origine, RP ID, UV absent, compteur, attestation). Rien de ce fichier n'est utilisé par
   l'application : la vérification reste celle de @simplewebauthn/server. */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* ---------------------------------------------------------------- CBOR minimal (entiers, octets, texte, tableaux, maps) */
type Cbor = number | string | Uint8Array | Cbor[] | Map<Cbor, Cbor> | { [k: string]: Cbor };
function tete(majeur: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(majeur << 5) | n]);
  if (n < 256) return Buffer.from([(majeur << 5) | 24, n]);
  if (n < 65536) return Buffer.from([(majeur << 5) | 25, n >> 8, n & 255]);
  const b = Buffer.alloc(5);
  b[0] = (majeur << 5) | 26;
  b.writeUInt32BE(n, 1);
  return b;
}
export function cbor(v: Cbor): Buffer {
  if (typeof v === 'number') return v >= 0 ? tete(0, v) : tete(1, -1 - v);
  if (typeof v === 'string') {
    const b = Buffer.from(v, 'utf8');
    return Buffer.concat([tete(3, b.length), b]);
  }
  if (v instanceof Uint8Array) return Buffer.concat([tete(2, v.length), Buffer.from(v)]);
  if (Array.isArray(v)) return Buffer.concat([tete(4, v.length), ...v.map(cbor)]);
  const entrees = v instanceof Map ? [...v.entries()] : Object.entries(v);
  return Buffer.concat([tete(5, entrees.length), ...entrees.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest();

/** Clé publique ES256 au format COSE (EC2, P-256). */
function cose(pub: crypto.KeyObject): Buffer {
  const jwk = pub.export({ format: 'jwk' });
  return cbor(
    new Map<Cbor, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ]),
  );
}

const UP = 0x01,
  UV = 0x04,
  BE = 0x08,
  BS = 0x10,
  AT = 0x40;

export interface Attestation {
  /** Clé privée et chaîne (feuille d'abord, en DER) de l'attestation « packed » complète. */
  cle: crypto.KeyObject;
  x5c: Buffer[];
  racinePem: string;
  aaguid: string;
}

/** Chaîne d'attestation de test (racine et feuille FIDO) produite par openssl : la feuille porte l'extension AAGUID. */
export function chaineAttestation(aaguid: string): Attestation {
  const d = mkdtempSync(path.join(os.tmpdir(), 'attestation-'));
  const f = (n: string) => path.join(d, n);
  const ossl = (...a: string[]) => execFileSync('openssl', a, { stdio: 'pipe' });
  try {
    ossl(
      'req',
      '-x509',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:P-256',
      '-nodes',
      '-keyout',
      f('racine.key'),
      '-out',
      f('racine.pem'),
      '-subj',
      '/CN=Racine attestation de test',
      '-days',
      '30',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,keyCertSign,cRLSign',
    );
    ossl(
      'req',
      '-new',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:P-256',
      '-nodes',
      '-keyout',
      f('feuille.key'),
      '-out',
      f('feuille.csr'),
      '-subj',
      '/C=FR/O=Essai/OU=Authenticator Attestation/CN=Cle de test',
    );
    writeFileSync(
      f('ext.cnf'),
      `basicConstraints=CA:FALSE\n1.3.6.1.4.1.45724.1.1.4=DER:0410${aaguid.replace(/-/g, '')}\n`,
    );
    ossl(
      'x509',
      '-req',
      '-in',
      f('feuille.csr'),
      '-CA',
      f('racine.pem'),
      '-CAkey',
      f('racine.key'),
      '-CAcreateserial',
      '-out',
      f('feuille.pem'),
      '-days',
      '30',
      '-extfile',
      f('ext.cnf'),
    );
    const feuille = new crypto.X509Certificate(readFileSync(f('feuille.pem')));
    return {
      cle: crypto.createPrivateKey(readFileSync(f('feuille.key'))),
      x5c: [feuille.raw],
      racinePem: readFileSync(f('racine.pem'), 'utf8').trim(),
      aaguid,
    };
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

interface OptionsCreation {
  challenge: string;
  rp: { id?: string };
}
interface OptionsRequete {
  challenge: string;
  rpId?: string;
}

export class AuthentificateurLogiciel {
  readonly credentialId = crypto.randomBytes(32);
  readonly cles = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  compteur: number;

  constructor(
    readonly o: {
      origin: string;
      rpId: string;
      /** AAGUID annoncé (16 octets nuls par défaut, comme une attestation « none »). */
      aaguid?: string;
      /** Compteur de départ ; null : passkey synchronisée, compteur toujours à 0. */
      compteur?: number | null;
      synchronisee?: boolean;
    },
  ) {
    this.compteur = o.compteur ?? 0;
  }
  get id() {
    return b64u(this.credentialId);
  }

  private authData(o: { uv: boolean; rpId: string; compteur: number; attestee: boolean }) {
    const flags = UP | (o.uv ? UV : 0) | (this.o.synchronisee ? BE | BS : 0) | (o.attestee ? AT : 0);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(o.compteur);
    const parts: Uint8Array[] = [sha256(o.rpId), Buffer.from([flags]), c];
    if (o.attestee) {
      const len = Buffer.alloc(2);
      len.writeUInt16BE(this.credentialId.length);
      parts.push(
        Buffer.from((this.o.aaguid ?? '00000000-0000-0000-0000-000000000000').replace(/-/g, ''), 'hex'),
        len,
        this.credentialId,
        cose(this.cles.publicKey),
      );
    }
    return Buffer.concat(parts);
  }

  /** Réponse à navigator.credentials.create(). */
  enrolement(
    options: OptionsCreation,
    d: {
      origin?: string;
      rpId?: string;
      uv?: boolean;
      fmt?: 'none' | 'packed-self' | 'packed';
      attestation?: Attestation;
      challenge?: string;
    } = {},
  ) {
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: d.challenge ?? options.challenge,
        origin: d.origin ?? this.o.origin,
        crossOrigin: false,
      }),
    );
    const authData = this.authData({
      uv: d.uv ?? true,
      rpId: d.rpId ?? options.rp.id ?? this.o.rpId,
      compteur: this.compteur,
      attestee: true,
    });
    const aSigner = Buffer.concat([authData, sha256(clientDataJSON)]);
    const fmt = d.fmt ?? 'none';
    const attStmt: Cbor =
      fmt === 'none'
        ? {}
        : fmt === 'packed-self'
          ? { alg: -7, sig: crypto.sign('sha256', aSigner, this.cles.privateKey) }
          : { alg: -7, sig: crypto.sign('sha256', aSigner, d.attestation!.cle), x5c: d.attestation!.x5c };
    const attestationObject = cbor({ fmt: fmt === 'none' ? 'none' : 'packed', attStmt, authData });
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      response: {
        clientDataJSON: b64u(clientDataJSON),
        attestationObject: b64u(attestationObject),
        transports: ['usb' as const],
      },
      authenticatorAttachment: 'cross-platform' as const,
      clientExtensionResults: {},
    };
  }

  /** Réponse à navigator.credentials.get(). Le compteur progresse d'une unité (sauf passkey synchronisée : toujours 0). */
  authentification(
    options: OptionsRequete,
    d: { origin?: string; rpId?: string; uv?: boolean; compteur?: number; challenge?: string; type?: string } = {},
  ) {
    if (d.compteur === undefined && this.o.compteur !== null) this.compteur++;
    const compteur = d.compteur ?? (this.o.compteur === null ? 0 : this.compteur);
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: d.type ?? 'webauthn.get',
        challenge: d.challenge ?? options.challenge,
        origin: d.origin ?? this.o.origin,
        crossOrigin: false,
      }),
    );
    const authData = this.authData({
      uv: d.uv ?? true,
      rpId: d.rpId ?? options.rpId ?? this.o.rpId,
      compteur,
      attestee: false,
    });
    const signature = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), this.cles.privateKey);
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      response: {
        clientDataJSON: b64u(clientDataJSON),
        authenticatorData: b64u(authData),
        signature: b64u(signature),
      },
      authenticatorAttachment: 'cross-platform' as const,
      clientExtensionResults: {},
    };
  }
}
