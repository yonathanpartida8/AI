/* ============================================================
 * storage/projectStore.js — FUENTE DE VERDAD del proyecto
 *
 * Arquitectura de datos unidireccional:
 *
 *   acción del usuario → Store (muta el JSON) → commit()
 *        → evento 'change' → Renderer repinta → UI sincronizada
 *
 * El proyecto entero es UN objeto JSON serializable:
 *  - pages[]  : orden de páginas; cada página lista sus nodos en z-order.
 *  - nodes{}  : mapa plano id→nodo (lookup O(1), sin árboles profundos).
 *  - assets[] : metadatos; los blobs viven en IndexedDB.
 *
 * Historial: snapshots inmutables del JSON (50 pasos). Undo/Redo
 * es trivial y a prueba de bugs porque el estado es un valor puro.
 * ============================================================ */

import { EventBus, uid, deepClone, debounce, clamp } from '../utils/helpers.js';
import { createNodeData, componentDef } from '../components/registry.js';
import { DB } from './db.js';

const LS_KEY = 'nocode-builder:project';
const HISTORY_LIMIT = 50;

export const DEVICES = {
  desktop: { label: 'Escritorio', width: 1280, icon: '🖥' },
  tablet: { label: 'Tablet', width: 768, icon: '📱' },
  mobile: { label: 'Móvil', width: 390, icon: '📲' },
};

export class ProjectStore extends EventBus {
  project = null;
  pageId = null;
  device = 'desktop';        // breakpoint activo del editor
  selection = [];            // ids seleccionados
  zoom = 1;
  pan = { x: 60, y: 40 };
  tool = 'select';           // 'select' | 'pan' | 'draw'
  clipboard = [];

  #history = [];
  #future = [];
  #autosave = debounce(() => this.persist(), 800);

  /* ── Ciclo de vida ─────────────────────────────────── */

  async init() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try { this.project = JSON.parse(saved); } catch { this.project = null; }
    }
    if (!this.project) this.project = ProjectStore.blankProject();
    this.pageId = this.project.pages[0].id;
  }

  static blankProject() {
    const pageId = uid('pg');
    return {
      version: 1,
      meta: { name: 'Mi Proyecto', created: Date.now(), modified: Date.now() },
      settings: {
        breakpoints: { desktop: 1280, tablet: 768, mobile: 390 },
        grid: { size: 8, visible: true, snap: true },
      },
      pages: [{ id: pageId, name: 'Inicio', slug: 'index', height: 800, background: '#0b1020', transition: 'fade', nodes: [] }],
      nodes: {},
      assets: [],
    };
  }

  persist() {
    this.project.meta.modified = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.project)); } catch (e) { console.warn('localStorage lleno; usando solo IndexedDB', e); }
    DB.putProject({ id: 'current', data: this.project }).catch(console.warn);
    this.emit('saved');
  }

  /* ── Historial ─────────────────────────────────────── */

  snapshot() {
    this.#history.push(deepClone(this.project));
    if (this.#history.length > HISTORY_LIMIT) this.#history.shift();
    this.#future = [];
  }

  commit() { this.emit('change'); this.#autosave(); }

  undo() {
    if (!this.#history.length) return;
    this.#future.push(deepClone(this.project));
    this.project = this.#history.pop();
    this.#afterTimeTravel();
  }

  redo() {
    if (!this.#future.length) return;
    this.#history.push(deepClone(this.project));
    this.project = this.#future.pop();
    this.#afterTimeTravel();
  }

  #afterTimeTravel() {
    if (!this.project.pages.some((p) => p.id === this.pageId)) this.pageId = this.project.pages[0].id;
    this.selection = this.selection.filter((id) => this.project.nodes[id]);
    this.emit('change'); this.emit('selection'); this.#autosave();
  }

  /* ── Acceso ────────────────────────────────────────── */

  get page() { return this.project.pages.find((p) => p.id === this.pageId); }
  node(id) { return this.project.nodes[id]; }
  pageNodes(pageId = this.pageId) {
    const page = this.project.pages.find((p) => p.id === pageId);
    return page ? page.nodes.map((id) => this.project.nodes[id]).filter(Boolean) : [];
  }
  get selectedNodes() { return this.selection.map((id) => this.node(id)).filter(Boolean); }

  /**
   * Marco EFECTIVO del nodo para el dispositivo activo:
   * base + overrides responsive (cascada desktop → tablet → mobile).
   */
  frame(node, device = this.device) {
    if (device === 'desktop') return { ...node.base };
    const tablet = node.responsive?.tablet || {};
    if (device === 'tablet') return { ...node.base, ...tablet };
    return { ...node.base, ...tablet, ...(node.responsive?.mobile || {}) };
  }

  /**
   * Escritura responsive-aware: en escritorio escribe en `base`;
   * en tablet/móvil escribe SOLO el override del breakpoint activo.
   */
  setFrame(node, patch) {
    if (this.device === 'desktop') Object.assign(node.base, patch);
    else {
      node.responsive ||= {};
      node.responsive[this.device] = { ...(node.responsive[this.device] || {}), ...patch };
    }
  }

  clearResponsiveOverride(node) {
    if (this.device === 'desktop' || !node.responsive) return;
    delete node.responsive[this.device];
  }

  /* ── Selección / vista ─────────────────────────────── */

  select(ids, additive = false) {
    const list = [].concat(ids).filter((id) => this.node(id));
    this.selection = additive ? [...new Set([...this.selection, ...list])] : list;
    this.emit('selection');
  }
  clearSelection() { this.selection = []; this.emit('selection'); }

  setDevice(device) { this.device = device; this.emit('device'); this.emit('change'); }
  setTool(tool) { this.tool = tool; this.emit('tool'); }
  setView(zoom, pan) {
    if (zoom != null) this.zoom = clamp(zoom, 0.1, 4);
    if (pan) this.pan = pan;
    this.emit('view');
  }

  /* ── Nodos ─────────────────────────────────────────── */

  addNode(type, at = {}, extra = {}) {
    this.snapshot();
    const def = componentDef(type);
    const id = uid('nd');
    const data = createNodeData(type, extra);
    data.id = id;
    data.base.x = Math.round(at.x ?? 80);
    data.base.y = Math.round(at.y ?? 80);
    if (at.w) data.base.w = at.w;
    if (at.h) data.base.h = at.h;
    // Numera copias: "Texto 2", "Texto 3"…
    const siblings = this.pageNodes().filter((n) => n.type === type).length;
    if (siblings) data.name = `${def.label} ${siblings + 1}`;
    this.project.nodes[id] = data;
    this.page.nodes.push(id);
    this.commit();
    this.select(id);
    return data;
  }

  updateNode(id, section, patch) {
    const node = this.node(id);
    if (!node) return;
    if (section === 'frame') this.setFrame(node, patch);
    else if (section === 'root') Object.assign(node, patch);
    else { node[section] ||= {}; Object.assign(node[section], patch); }
    this.commit();
  }

  removeNodes(ids = this.selection) {
    if (!ids.length) return;
    this.snapshot();
    for (const id of ids) {
      delete this.project.nodes[id];
      for (const page of this.project.pages) {
        const i = page.nodes.indexOf(id);
        if (i >= 0) page.nodes.splice(i, 1);
      }
    }
    this.selection = this.selection.filter((id) => !ids.includes(id));
    this.commit(); this.emit('selection');
  }

  duplicateNodes(ids = this.selection) {
    if (!ids.length) return;
    this.snapshot();
    const newIds = [];
    for (const id of ids) {
      const src = this.node(id);
      if (!src) continue;
      const copy = deepClone(src);
      copy.id = uid('nd');
      copy.name = `${src.name} copia`;
      copy.base.x += 24; copy.base.y += 24;
      this.project.nodes[copy.id] = copy;
      this.page.nodes.push(copy.id);
      newIds.push(copy.id);
    }
    this.commit(); this.select(newIds);
  }

  copy() { this.clipboard = this.selectedNodes.map(deepClone); }
  paste() {
    if (!this.clipboard.length) return;
    this.snapshot();
    const newIds = [];
    for (const src of this.clipboard) {
      const copy = deepClone(src);
      copy.id = uid('nd');
      copy.base.x += 32; copy.base.y += 32;
      this.project.nodes[copy.id] = copy;
      this.page.nodes.push(copy.id);
      newIds.push(copy.id);
    }
    this.commit(); this.select(newIds);
  }

  nudge(dx, dy) {
    if (!this.selection.length) return;
    this.snapshot();
    for (const node of this.selectedNodes) {
      if (node.locked) continue;
      const f = this.frame(node);
      this.setFrame(node, { x: f.x + dx, y: f.y + dy });
    }
    this.commit();
  }

  /** Reordena capa dentro de la página: dir = +1 (subir) / -1 (bajar) */
  moveLayer(id, dir) {
    const nodes = this.page.nodes;
    const i = nodes.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= nodes.length) return;
    this.snapshot();
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    this.commit();
  }

  toggleFlag(id, flag) {
    const node = this.node(id);
    if (!node) return;
    this.snapshot();
    node[flag] = !node[flag];
    this.commit();
  }

  alignSelection(mode) {
    const nodes = this.selectedNodes.filter((n) => !n.locked);
    if (!nodes.length) return;
    this.snapshot();
    const W = this.project.settings.breakpoints[this.device];
    for (const node of nodes) {
      const f = this.frame(node);
      const patch = {
        left: { x: 0 }, centerX: { x: Math.round((W - f.w) / 2) }, right: { x: W - f.w },
        top: { y: 0 }, centerY: { y: Math.round((this.page.height - f.h) / 2) },
      }[mode];
      if (patch) this.setFrame(node, patch);
    }
    this.commit();
  }

  /* ── Páginas ───────────────────────────────────────── */

  addPage(name = `Página ${this.project.pages.length + 1}`) {
    this.snapshot();
    const page = { id: uid('pg'), name, slug: '', height: 800, background: '#0b1020', transition: 'fade', nodes: [] };
    this.project.pages.push(page);
    this.commit();
    this.setPage(page.id);
    return page;
  }

  setPage(id) {
    if (!this.project.pages.some((p) => p.id === id)) return;
    this.pageId = id;
    this.clearSelection();
    this.emit('page'); this.emit('change');
  }

  renamePage(id, name) {
    const page = this.project.pages.find((p) => p.id === id);
    if (!page || !name) return;
    this.snapshot(); page.name = name; this.commit();
  }

  updatePage(id, patch) {
    const page = this.project.pages.find((p) => p.id === id);
    if (!page) return;
    this.snapshot(); Object.assign(page, patch); this.commit();
  }

  duplicatePage(id) {
    const src = this.project.pages.find((p) => p.id === id);
    if (!src) return;
    this.snapshot();
    const copy = deepClone(src);
    copy.id = uid('pg'); copy.name = `${src.name} copia`; copy.slug = '';
    copy.nodes = src.nodes.map((nid) => {
      const node = deepClone(this.project.nodes[nid]);
      node.id = uid('nd');
      this.project.nodes[node.id] = node;
      return node.id;
    });
    this.project.pages.push(copy);
    this.commit();
  }

  deletePage(id) {
    if (this.project.pages.length <= 1) return;
    this.snapshot();
    const i = this.project.pages.findIndex((p) => p.id === id);
    for (const nid of this.project.pages[i].nodes) delete this.project.nodes[nid];
    this.project.pages.splice(i, 1);
    if (this.pageId === id) this.pageId = this.project.pages[0].id;
    this.commit(); this.emit('page');
  }

  movePage(id, dir) {
    const pages = this.project.pages;
    const i = pages.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= pages.length) return;
    this.snapshot();
    [pages[i], pages[j]] = [pages[j], pages[i]];
    this.commit(); this.emit('page');
  }

  /* ── Import / export del proyecto ──────────────────── */

  exportJSON() { return deepClone(this.project); }

  importJSON(data) {
    if (!data?.pages || !data?.nodes) throw new Error('Proyecto inválido');
    this.snapshot();
    this.project = data;
    this.pageId = data.pages[0].id;
    this.clearSelection();
    this.commit(); this.emit('page');
  }

  reset() {
    this.snapshot();
    this.project = ProjectStore.blankProject();
    this.pageId = this.project.pages[0].id;
    this.clearSelection();
    this.commit(); this.emit('page');
  }
}
