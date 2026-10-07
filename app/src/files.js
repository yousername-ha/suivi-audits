'use strict';
/* Contrôle des fichiers déposés : extension autorisée, signature (magic bytes), analyse antivirale ClamAV facultative. */
const net = require('node:net');
const cfg = require('./config');

// extension -> { mime, sig: 'pdf' | 'zip' | 'ole' | 'png' | 'jpg' | 'gif' | 'text' | 'any' }
const TYPES = {
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

function sigOk(kind, b) {
  const h = (s) => b.subarray(0, s.length).equals(Buffer.from(s, 'binary'));
  switch (kind) {
    case 'pdf': return h('%PDF-');
    case 'zip': return h('PK\x03\x04') || h('PK\x05\x06');
    case 'ole': return h('\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1');
    case 'png': return h('\x89PNG\r\n\x1A\n');
    case 'jpg': return h('\xFF\xD8\xFF');
    case 'gif': return h('GIF87a') || h('GIF89a');
    case 'text': return !b.subarray(0, 65536).includes(0);
    default: return false;
  }
}

function cleanFilename(name) {
  let n = String(name || '').normalize('NFC').replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  n = n.replace(/^\.+/, '');
  if (n.length > 180) { const m = n.match(/(\.[a-z0-9]{1,6})$/i); n = n.slice(0, 170) + (m ? m[1] : ''); }
  return n || 'fichier';
}

/** Valide le fichier ; renvoie { filename, ext, mime } ou lève une erreur explicite. */
function validate(filename, buf) {
  const name = cleanFilename(filename);
  if (MACRO_EXT.test(name)) throw new Error('Documents à macros refusés (docm, xlsm, pptm…). Enregistrez une version sans macro.');
  const m = name.match(/\.([a-z0-9]{1,6})$/i);
  const ext = m ? m[1].toLowerCase() : '';
  const t = TYPES[ext];
  if (!t) throw new Error(`Type de fichier non autorisé (.${ext || '?'}). Types acceptés : ${Object.keys(TYPES).join(', ')}.`);
  if (!buf.length) throw new Error('Fichier vide.');
  if (!sigOk(t.sig, buf)) throw new Error(`Le contenu ne correspond pas à un fichier .${ext}.`);
  return { filename: name, ext, mime: t.mime };
}

/** Analyse ClamAV (protocole clamd INSTREAM). Renvoie 'sain' | 'non_analysé' ; lève une erreur si infecté. */
function scan(buf) {
  if (!cfg.clamav) return Promise.resolve('non_analysé');
  return new Promise((resolve, reject) => {
    const s = net.connect(cfg.clamav.port, cfg.clamav.host);
    let out = '';
    const fail = (e) => { s.destroy(); cfg.clamav.required ? reject(new Error('Analyse antivirale indisponible : dépôt refusé.')) : resolve('non_analysé'); };
    s.setTimeout(60000, () => fail(new Error('timeout')));
    s.on('error', fail);
    s.on('data', (d) => { out += d.toString(); });
    s.on('end', () => {
      const r = out.replace(/\0/g, '').trim();
      if (/:\s*OK$/.test(r)) return resolve('sain');
      if (/FOUND$/.test(r)) { const e = new Error('Fichier refusé : menace détectée (' + r.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '') + ').'); e.infected = true; return reject(e); }
      fail(new Error(r || 'réponse vide'));
    });
    s.on('connect', () => {
      s.write('zINSTREAM\0');
      for (let i = 0; i < buf.length; i += 65536) {
        const chunk = buf.subarray(i, i + 65536);
        const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length);
        s.write(len); s.write(chunk);
      }
      s.write(Buffer.alloc(4));
    });
  });
}

module.exports = { validate, scan, cleanFilename, TYPES };
