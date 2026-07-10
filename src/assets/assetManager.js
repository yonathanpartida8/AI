/* ============================================================
 * assets/assetManager.js — Gestor de Assets Multimedia
 *
 * Sube archivos desde la galería del móvil, el disco o por
 * drag-and-drop directo sobre la app. Cada asset se guarda como:
 *
 *   { id, name, kind, mime, size, folder, tags[], data(dataURL), created }
 *
 * - kind: image | gif | video | audio | model | font | svg
 * - data (dataURL) se persiste en IndexedDB → sobrevive recargas
 *   y se decodifica a bytes en el exportador ZIP.
 * - En memoria mantenemos un Map id→asset para lookups síncronos
 *   del renderer.
 * ============================================================ */

import { EventBus, uid, fileToDataURL } from '../utils/helpers.js';
import { DB } from '../storage/db.js';

export const ASSET_KINDS = {
  image: { label: 'Imágenes', folder: 'images', icon: '🖼' },
  gif: { label: 'GIFs', folder: 'gifs', icon: '🎞' },
  video: { label: 'Vídeos', folder: 'videos', icon: '🎬' },
  audio: { label: 'Audio', folder: 'audio', icon: '🎧' },
  model: { label: 'Modelos 3D', folder: 'models', icon: '⬡' },
  font: { label: 'Fuentes', folder: 'fonts', icon: '🔤' },
  svg: { label: 'SVG', folder: 'images', icon: '✒' },
  html: { label: 'Páginas HTML', folder: 'html', icon: '🌐' },
};

export function kindOfFile(file) {
  const name = file.name.toLowerCase();
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'image/svg+xml' || name.endsWith('.svg')) return 'svg';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (/\.(glb|gltf)$/.test(name)) return 'model';
  if (/\.(woff2?|ttf|otf)$/.test(name)) return 'font';
  if (file.type === 'text/html' || /\.html?$/.test(name)) return 'html';
  return 'image';
}

export const ACCEPT_ATTR = [
  'image/*', 'video/*', 'audio/*',
  '.gif', '.svg', '.glb', '.gltf', '.woff', '.woff2', '.ttf', '.otf', '.html', '.htm',
].join(',');

export class AssetManager extends EventBus {
  #byId = new Map();
  #textCache = new Map();

  constructor(store) {
    super();
    this.store = store; // sincroniza metadatos en project.assets
  }

  async init() {
    const rows = await DB.getAllAssets().catch(() => []);
    for (const asset of rows || []) this.#byId.set(asset.id, asset);
    // Reconstruye metadatos en el proyecto si faltan
    this.store.project.assets = [...this.#byId.values()].map(({ data, ...meta }) => meta);
  }

  list({ kind = null, query = '', folder = null } = {}) {
    let all = [...this.#byId.values()];
    if (kind) all = all.filter((a) => a.kind === kind || (kind === 'image' && a.kind === 'svg'));
    if (folder) all = all.filter((a) => a.folder === folder);
    if (query) {
      const q = query.toLowerCase();
      all = all.filter((a) => a.name.toLowerCase().includes(q) || (a.tags || []).some((t) => t.includes(q)));
    }
    return all.sort((a, b) => b.created - a.created);
  }

  get(id) { return this.#byId.get(id) || null; }

  /** URL utilizable en src/href dentro del editor. */
  url(id) { return this.#byId.get(id)?.data || ''; }

  /** Contenido de texto de un asset (HTML importado), con caché. */
  text(id) {
    if (this.#textCache.has(id)) return this.#textCache.get(id);
    const asset = this.#byId.get(id);
    if (!asset?.data) return '';
    let out = '';
    try {
      const base64 = asset.data.slice(asset.data.indexOf(',') + 1);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      out = new TextDecoder('utf-8').decode(bytes);
    } catch { out = ''; }
    this.#textCache.set(id, out);
    return out;
  }

  folders() { return [...new Set([...this.#byId.values()].map((a) => a.folder))].sort(); }

  /** Importa una lista de File (input file / drop de la galería). */
  async importFiles(files, { folder } = {}) {
    const imported = [];
    for (const file of files) {
      const kind = kindOfFile(file);
      const asset = {
        id: uid('as'),
        name: file.name,
        kind,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        folder: folder || ASSET_KINDS[kind].folder,
        tags: [],
        created: Date.now(),
        data: await fileToDataURL(file),
      };
      this.#byId.set(asset.id, asset);
      await DB.putAsset(asset).catch(console.warn);
      imported.push(asset);
    }
    this.#syncProject();
    this.emit('change');
    return imported;
  }

  /** Crea un asset desde un dataURL ya generado (p.ej. Canvas Draw). */
  async addDataURL(name, dataURL, kind = 'image') {
    const asset = {
      id: uid('as'), name, kind, mime: dataURL.slice(5, dataURL.indexOf(';')),
      size: Math.round(dataURL.length * 0.75), folder: ASSET_KINDS[kind].folder,
      tags: ['dibujo'], created: Date.now(), data: dataURL,
    };
    this.#byId.set(asset.id, asset);
    await DB.putAsset(asset).catch(console.warn);
    this.#syncProject();
    this.emit('change');
    return asset;
  }

  async remove(id) {
    this.#byId.delete(id);
    await DB.deleteAsset(id).catch(console.warn);
    this.#syncProject();
    this.emit('change');
  }

  async setTags(id, tags) {
    const asset = this.#byId.get(id);
    if (!asset) return;
    asset.tags = tags;
    await DB.putAsset(asset).catch(console.warn);
    this.#syncProject();
    this.emit('change');
  }

  /** Todos los assets con sus datos, para incrustarlos en el .json del proyecto. */
  exportData() {
    return [...this.#byId.values()];
  }

  /** Restaura assets incrustados en un .json importado (GIFs, imágenes, etc.). */
  async importData(list = []) {
    for (const asset of list) {
      if (!asset?.id || !asset?.data) continue;
      this.#byId.set(asset.id, asset);
      await DB.putAsset(asset).catch(console.warn);
    }
    this.#syncProject();
    this.emit('change');
  }

  #syncProject() {
    this.store.project.assets = [...this.#byId.values()].map(({ data, ...meta }) => meta);
  }

  /** Nombre de familia tipográfica de un asset de fuente. */
  fontName(asset) {
    return asset.name.replace(/\.(woff2?|ttf|otf)$/i, '').replace(/[^\w\sáéíóúñ-]/gi, '').trim() || 'FuentePropia';
  }

  /** Reglas @font-face de todas las fuentes subidas (editor y export). */
  fontFaceCSS() {
    return this.list({ kind: 'font' }).map((asset) =>
      `@font-face{font-family:"${this.fontName(asset)}";src:url("${asset.data}");font-display:swap}`).join('\n');
  }

  /** Inyecta las fuentes del usuario en el documento del editor. */
  injectFonts() {
    let style = document.getElementById('wb-fonts');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wb-fonts';
      document.head.append(style);
    }
    style.textContent = this.fontFaceCSS();
  }

  /** Tipo de componente sugerido al soltar un asset en el lienzo. */
  componentForAsset(asset) {
    return { image: 'image', svg: 'image', gif: 'gif', video: 'video', audio: 'musicPlayer', model: 'model3d', font: null, html: 'htmlEmbed' }[asset.kind];
  }
}
