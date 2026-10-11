/* Pièces locales IndexedDB ; sauvegarde/restauration ZIP indépendante du serveur. */
(function () {
  'use strict';
  const C = window.LegacyDF;
  const MAX_FILE = 20 * 1024 * 1024, MAX_ARCHIVE = 100 * 1024 * 1024;
  let opening;
  function database() {
    if (!window.indexedDB) return Promise.reject(new Error('Le stockage local est indisponible. Utilisez un navigateur récent hors navigation privée.'));
    return opening || (opening = new Promise((resolve, reject) => {
      const req = indexedDB.open('suivi-audits-legacy-df', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('files'); req.result.createObjectStore('state'); };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = null; }; resolve(req.result); };
      req.onerror = () => { opening = null; reject(new Error('Impossible d’ouvrir le stockage local.')); };
    }));
  }
  async function transact(store, mode, callback) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), os = tx.objectStore(store);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(new Error('Échec du stockage local : espace disponible ou permissions du navigateur à vérifier.'));
      const req = callback(os);
      if (req) req.onsuccess = () => { result = req.result; };
    });
  }
  const get = key => transact('files', 'readonly', os => os.get(key));
  const put = (key, blob) => transact('files', 'readwrite', os => os.put(blob, key));
  const remove = key => transact('files', 'readwrite', os => os.delete(key));
  const saveState = state => transact('state', 'readwrite', os => os.put(C.clone(state), 'current'));
  const loadState = () => transact('state', 'readonly', os => os.get('current'));
  async function hash(data) {
    if (!crypto.subtle) throw new Error('Le contrôle SHA-256 exige localhost ou l’ouverture locale du fichier.');
    const buf = data instanceof Blob ? await data.arrayBuffer() : typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  async function deposit(state, evidenceId, file) {
    if (!file || !file.size || file.size > MAX_FILE) throw new Error('Choisissez une pièce non vide de 20 Mo maximum.');
    if (!state.evidences.some(p => p.id === evidenceId)) throw new Error('Preuve introuvable.');
    const key = C.id('FILE'), digest = await hash(file);
    await put(key, file);
    try { return C.addProofVersion(state, evidenceId, { fileKey: key, name: file.name, size: file.size, mime: file.type, sha256: digest }); }
    catch (e) { await remove(key); throw e; }
  }
  async function checkedBlob(version) {
    const b = await get(version.fileKey);
    if (!b || b.size !== version.size || await hash(b) !== version.sha256) throw new Error('Pièce locale absente ou altérée : ' + version.name + '. Restaurez une sauvegarde complète.');
    return b;
  }
  function fileName(name) { return String(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 180) || 'piece'; }
  async function zipFiles(zip, evidences) {
    const records = [];
    const versions = evidences.flatMap(p => p.dfVersions || p.versions || []);
    if (versions.length > 3000 || versions.reduce((n, v) => n + v.size, 0) > MAX_ARCHIVE - 5 * 1024 * 1024) throw new Error('Les pièces dépassent la capacité d’une archive locale (95 Mo, 3 000 versions maximum).');
    for (const p of evidences) for (const v of p.dfVersions || p.versions || []) {
      const b = await checkedBlob(v), path = 'pieces/' + p.id.replace(/[^A-Za-z0-9_-]/g, '_') + '/' + v.id.replace(/[^A-Za-z0-9_-]/g, '_') + '/' + fileName(v.name);
      zip.file(path, await b.arrayBuffer());
      records.push({ fileKey: v.fileKey, path, sha256: v.sha256, size: v.size, mime: v.mime });
      v.exportPath = path;
    }
    return records;
  }
  async function backup(state) {
    const zip = new JSZip(), copy = C.clone(state);
    C.initialise(copy);
    const files = await zipFiles(zip, copy.evidences);
    const text = JSON.stringify(copy, null, 2);
    if (text.length > 40 * 1024 * 1024) throw new Error('Les données JSON dépassent 40 Mo. La sauvegarde complète locale doit être fractionnée hors navigateur.');
    if (files.reduce((n, f) => n + f.size, 0) + new TextEncoder().encode(text).length > MAX_ARCHIVE) throw new Error('Données et pièces dépassant 100 Mo : archive locale trop volumineuse.');
    zip.file('data/state.json', text);
    zip.file('manifest.json', JSON.stringify({ format: 'legacy-df-backup', version: 1, createdAt: C.now(), stateSha256: await hash(text), files }, null, 2));
    zip.file('LIRE-MOI.txt', 'Sauvegarde complète locale : données et toutes les versions physiques de preuves. Importer depuis CaRE ou HAS > Sources et sauvegarde. Ce ZIP peut contenir des données confidentielles : conserver sur un support protégé.\n');
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }
  async function inspectBackup(file) {
    if (file.size > MAX_ARCHIVE) throw new Error('Archive de plus de 100 Mo.');
    const z = await JSZip.loadAsync(file);
    if (Object.keys(z.files).length > 5000) throw new Error('Trop de fichiers dans l’archive.');
    for (const n of Object.keys(z.files)) {
      const original = z.files[n].unsafeOriginalName || n;
      if (n.startsWith('/') || n.includes('\\') || n.split('/').includes('..') || original.startsWith('/') || original.includes('\\') || original.split('/').includes('..')) throw new Error('Chemin d’archive invalide.');
      const f = z.files[n];
      if (f._data && f._data.uncompressedSize > MAX_ARCHIVE) throw new Error('Fichier décompressé trop volumineux.');
    }
    const mf = z.file('manifest.json'), sf = z.file('data/state.json');
    if (!mf || !sf) throw new Error('Sauvegarde complète non reconnue.');
    const m = C.safeJson(await mf.async('string'));
    if (m.format !== 'legacy-df-backup' || m.version !== 1 || !Array.isArray(m.files) || m.files.length > 3000) throw new Error('Manifeste de sauvegarde invalide.');
    const text = await sf.async('string');
    if (await hash(text) !== m.stateSha256) throw new Error('L’empreinte des données ne correspond pas au manifeste.');
    const state = C.validateState(C.safeJson(text)), blobs = [], seen = new Set();
    let total = text.length;
    const needed = state.evidences.flatMap(p => p.dfVersions || []);
    for (const f of m.files) {
      if (typeof f.fileKey !== 'string' || seen.has(f.fileKey) || !Number.isSafeInteger(f.size) || f.size < 1 || f.size > MAX_FILE || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Référence de pièce invalide.');
      const v = needed.find(v => v.fileKey === f.fileKey && v.size === f.size && v.sha256 === f.sha256);
      if (!v || !z.file(f.path)) throw new Error('Pièce non référencée ou absente du ZIP.');
      total += f.size; if (total > MAX_ARCHIVE) throw new Error('Les données décompressées dépassent 100 Mo.');
      const b = new Blob([await z.file(f.path).async('arraybuffer')], { type: f.mime || 'application/octet-stream' });
      if (b.size !== f.size || await hash(b) !== f.sha256) throw new Error('Pièce altérée : ' + f.path);
      seen.add(f.fileKey); blobs.push({ key: f.fileKey, blob: b });
    }
    if (needed.some(v => !seen.has(v.fileKey))) throw new Error('Une version de preuve manque dans la sauvegarde.');
    return { state, blobs };
  }
  async function restore(prepared) {
    const db = await database();
    // Données et pièces validées avant écriture ; une transaction atomique pour les deux magasins.
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['files', 'state'], 'readwrite');
      for (const { key, blob } of prepared.blobs) tx.objectStore('files').put(blob, key);
      tx.objectStore('state').put(C.clone(prepared.state), 'current');
      tx.oncomplete = () => resolve(prepared.state);
      tx.onerror = tx.onabort = () => reject(new Error('Restauration annulée : stockage insuffisant ou indisponible.'));
    });
  }
  function download(name, data) {
    const b = data instanceof Blob ? data : new Blob([data], { type: /\.json$/i.test(name) ? 'application/json;charset=utf-8' : 'application/octet-stream' });
    const u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = fileName(name); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  window.LegacyDFStore = { MAX_FILE, MAX_ARCHIVE, get, put, saveState, loadState, hash, deposit, checkedBlob, fileName, zipFiles, backup, inspectBackup, restore, download };
})();
