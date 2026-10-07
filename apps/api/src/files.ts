/* Contrôle des fichiers déposés : extension autorisée, signature (magic bytes), refus des macros, analyse ClamAV facultative. */
import net from 'node:net';
import type { Config } from './config.js';

type Sig = 'pdf' | 'zip' | 'ole' | 'png' | 'jpg' | 'gif' | 'text';
export const FILE_TYPES: Record<string, { mime: string; sig: Sig }> = {
  pdf: { mime: 'application/pdf', sig: 'pdf' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sig: 'zip' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sig: 'zip' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sig: 'zip' },
  odt: { mime: 'application/vnd.oasis.opendocument.text', sig: 'zip' },
  ods: { mime: 'application/vnd.oasis.opendocument.spreadsheet', sig: 'zip' },
  odp: { mime: 'application/vnd.oasis.opendocument.presentation', sig: 'zip' },
  zip: { mime: 'application/zip', sig: 'zip' },
  doc: { mime: 'application/msword', sig: 'ole' },
  xls: { mime: 'application/vnd.ms-excel', sig: 'ole' },
  ppt: { mime: 'application/vnd.ms-powerpoint', sig: 'ole' },
  msg: { mime: 'application/vnd.ms-outlook', sig: 'ole' },
  png: { mime: 'image/png', sig: 'png' },
  jpg: { mime: 'image/jpeg', sig: 'jpg' },
  jpeg: { mime: 'image/jpeg', sig: 'jpg' },
  gif: { mime: 'image/gif', sig: 'gif' },
  txt: { mime: 'text/plain', sig: 'text' },
  csv: { mime: 'text/csv', sig: 'text' },
  md: { mime: 'text/markdown', sig: 'text' },
  json: { mime: 'application/json', sig: 'text' },
  xml: { mime: 'application/xml', sig: 'text' },
  eml: { mime: 'message/rfc822', sig: 'text' },
  log: { mime: 'text/plain', sig: 'text' },
};
const MACRO_EXT = /\.(docm|xlsm|pptm|dotm|xltm)$/i;

function sigOk(kind: Sig, b: Buffer): boolean {
  const h = (s: string) => b.subarray(0, s.length).equals(Buffer.from(s, 'binary'));
  switch (kind) {
    case 'pdf':
      return h('%PDF-');
    case 'zip':
      return h('PK\x03\x04') || h('PK\x05\x06');
    case 'ole':
      return h('\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1');
    case 'png':
      return h('\x89PNG\r\n\x1A\n');
    case 'jpg':
      return h('\xFF\xD8\xFF');
    case 'gif':
      return h('GIF87a') || h('GIF89a');
    case 'text':
      return !b.subarray(0, 65536).includes(0);
  }
}

export function cleanFilename(name: string): string {
  let n = String(name || '')
    .normalize('NFC')
    .replace(/[\\/]/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .trim();
  n = n.replace(/^\.+/, '');
  if (n.length > 180) {
    const m = n.match(/(\.[a-z0-9]{1,6})$/i);
    n = n.slice(0, 170) + (m ? m[1] : '');
  }
  return n || 'fichier';
}

export class FileRejected extends Error {
  constructor(
    message: string,
    readonly infected = false,
  ) {
    super(message);
  }
}

/** Valide le fichier ; renvoie { filename, ext, mime } ou lève une erreur explicite. */
export function validateFile(filename: string, buf: Buffer) {
  const name = cleanFilename(filename);
  if (MACRO_EXT.test(name)) throw new FileRejected('Documents à macros refusés (docm, xlsm, pptm…). Enregistrez une version sans macro.');
  const m = name.match(/\.([a-z0-9]{1,6})$/i);
  const ext = m ? (m[1] as string).toLowerCase() : '';
  const t = FILE_TYPES[ext];
  if (!t) throw new FileRejected(`Type de fichier non autorisé (.${ext || '?'}). Types acceptés : ${Object.keys(FILE_TYPES).join(', ')}.`);
  if (!buf.length) throw new FileRejected('Fichier vide.');
  if (!sigOk(t.sig, buf)) throw new FileRejected(`Le contenu ne correspond pas à un fichier .${ext}.`);
  return { filename: name, ext, mime: t.mime };
}

/** Analyse ClamAV (protocole clamd INSTREAM). Renvoie 'sain' | 'non_analysé' ; lève FileRejected si infecté ou si l'analyse est obligatoire et impossible. */
export function scanFile(cfg: Config, buf: Buffer): Promise<'sain' | 'non_analysé'> {
  const av = cfg.clamav;
  if (!av) return Promise.resolve('non_analysé');
  return new Promise((resolve, reject) => {
    const s = net.connect(av.port, av.host);
    let out = '';
    let settled = false;
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    const fail = () => {
      s.destroy();
      done(() => (av.required ? reject(new FileRejected('Analyse antivirale indisponible : dépôt refusé.')) : resolve('non_analysé')));
    };
    s.setTimeout(60000, fail);
    s.on('error', fail);
    s.on('data', (d) => (out += d.toString()));
    s.on('end', () => {
      const r = out.replace(/\0/g, '').trim();
      if (/:\s*OK$/.test(r)) return done(() => resolve('sain'));
      if (/FOUND$/.test(r)) {
        const what = r.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '');
        return done(() => reject(new FileRejected(`Fichier refusé : menace détectée (${what}).`, true)));
      }
      fail();
    });
    s.on('connect', () => {
      s.write('zINSTREAM\0');
      for (let i = 0; i < buf.length; i += 65536) {
        const chunk = buf.subarray(i, i + 65536);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        s.write(len);
        s.write(chunk);
      }
      s.write(Buffer.alloc(4));
    });
  });
}
