/* ============================================================
 * utils/helpers.js — utilidades generales del sistema
 * ============================================================ */

let _uidCounter = 0;

/** Genera un ID único legible: nd_k3x9a1_7 */
export function uid(prefix = 'id') {
  _uidCounter = (_uidCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${_uidCounter}`;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const deepClone = (obj) =>
  typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

export function debounce(fn, ms = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttleRAF(fn) {
  let scheduled = false, lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; fn(...lastArgs); });
  };
}

/** Escapa HTML para inyección segura de texto de usuario. */
export function esc(str = '') {
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Mini bus de eventos (patrón pub/sub) usado por Store, AssetManager, etc. */
export class EventBus {
  #listeners = new Map();
  on(event, cb) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(cb);
    return () => this.off(event, cb);
  }
  off(event, cb) { this.#listeners.get(event)?.delete(cb); }
  emit(event, payload) {
    this.#listeners.get(event)?.forEach((cb) => { try { cb(payload); } catch (e) { console.error(e); } });
  }
}

/** Constructor declarativo de DOM: el('div', {class:'x', onclick}, [hijos]) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

/**
 * Snackbar del editor: aviso breve con acción opcional ("Deshacer").
 * Reutiliza un único elemento (pool) — mostrarlo mil veces no crea nodos.
 */
let _snack = null, _snackTimer = 0;
export function showSnack(message, actionLabel, onAction) {
  if (!_snack) {
    _snack = el('div', { class: 'wb-snack', role: 'status' });
    document.body.append(_snack);
  }
  clearTimeout(_snackTimer);
  _snack.replaceChildren(
    el('span', { class: 'wb-snack-msg', text: message }),
    actionLabel ? el('button', {
      class: 'wb-snack-act', text: actionLabel,
      onclick: () => { _snack.classList.remove('show'); onAction?.(); },
    }) : null,
  );
  _snack.classList.remove('show');
  void _snack.offsetWidth;
  _snack.classList.add('show');
  _snackTimer = setTimeout(() => _snack.classList.remove('show'), 4200);
}

/** Descarga un Blob como archivo. */
export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Lee un File del usuario como dataURL (galería del móvil, disco, etc.). */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** dataURL → Uint8Array (para empaquetar assets en el ZIP). */
export function dataURLToBytes(dataURL) {
  const base64 = dataURL.slice(dataURL.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Lectura segura de rutas anidadas: getPath(obj, 'styles.fontSize') */
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys.at(-1)] = value;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

/** Nombre de archivo seguro para el exportador. */
export function slugify(str) {
  return String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pagina';
}
