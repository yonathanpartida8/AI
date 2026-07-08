/* ============================================================
 * storage/db.js — persistencia local con IndexedDB
 *
 * - Los BLOBS de assets (imágenes, GIFs, vídeos, modelos 3D…)
 *   viven en IndexedDB (soporta cientos de MB).
 * - El JSON del proyecto (ligero) vive en localStorage para
 *   autoguardado instantáneo, con copia también en IndexedDB.
 * ============================================================ */

const DB_NAME = 'nocode-builder';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_PROJECTS = 'projects';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const result = fn(store);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  }));
}

export const DB = {
  /** Guarda registro de asset { id, name, kind, mime, size, folder, tags, data(dataURL) } */
  putAsset: (asset) => tx(STORE_ASSETS, 'readwrite', (s) => s.put(asset)),
  deleteAsset: (id) => tx(STORE_ASSETS, 'readwrite', (s) => s.delete(id)),
  getAllAssets: () => tx(STORE_ASSETS, 'readonly', (s) => s.getAll()),

  putProject: (project) => tx(STORE_PROJECTS, 'readwrite', (s) => s.put(project)),
  getProject: (id) => tx(STORE_PROJECTS, 'readonly', (s) => s.get(id)),
};
