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
import { starterProject, buildBlock } from './templates.js';
import { DB } from './db.js';

const LS_KEY = 'nocode-builder:project';
// Historial profundo: los snapshots se COALESCEN por gesto (no por tecla),
// así que 200 pasos cubren sesiones largas sin presión de memoria.
const HISTORY_LIMIT = 200;

/*
 * Los tres tamaños del PROYECTO que se está creando. La clave
 * `desktop` se conserva por compatibilidad con los proyectos ya
 * guardados (es donde viven los estilos BASE), pero se presenta como
 * "Base": aquí no hay escritorio, solo el lienzo de partida y sus dos
 * ajustes para tablet y teléfono.
 */
export const DEVICES = {
  desktop: { label: 'Base', width: 1280, icon: '🎀' },
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
  #lastSnapAt = 0;
  #lastSnapLabel = '';

  /* ── Ciclo de vida ─────────────────────────────────── */

  async init() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try { this.project = JSON.parse(saved); } catch { this.project = null; }
    }
    // Sin proyecto guardado (o guardado vacío) → plantilla inicial completa,
    // nunca un lienzo en blanco.
    if (!this.project || !Object.keys(this.project.nodes || {}).length) {
      this.project = starterProject();
    }
    this.migrate(this.project);
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

  /** Migra proyectos de versiones anteriores al modelo actual. */
  migrate(project) {
    project.custom ||= { css: '', js: '' };
    project.settings.fps ||= 0; // 0 = automático (vsync del dispositivo)
    for (const page of project.pages) {
      page.transitionDuration ||= 700;
      page.custom ||= { css: '', js: '' };
      page.pixelArt ||= false;
    }
    for (const node of Object.values(project.nodes)) {
      node.effects ||= { parallax: 0, tilt: false };
      node.effects.press ||= 'ninguno';
      node.effects.hoverFx ||= 'ninguno';
      node.animationOut ||= { preset: 'fadeOut', duration: 450, easing: 'ease-in' };
      node.animation.custom ||= '';
      // Formato antiguo de eventos {on, action, target} → cadenas de acciones
      node.events = (node.events || []).map((ev) =>
        ev.actions ? ev : { on: ev.on || 'click', actions: [{ action: ev.action, target: ev.target || '', value: '', delay: 0 }] });
    }
  }

  persist() {
    this.project.meta.modified = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.project)); } catch (e) { console.warn('localStorage lleno; usando solo IndexedDB', e); }
    DB.putProject({ id: 'current', data: this.project }).catch(console.warn);
    this.emit('saved');
  }

  /* ── Historial ─────────────────────────────────────── */

  /**
   * Guarda un punto de deshacer. Las ráfagas de la MISMA operación
   * (flechas, arrastres de sliders…) se COALESCEN: clonar el proyecto
   * entero en cada pulsación era el mayor coste oculto de la edición,
   * y además llenaba el historial de micro-pasos inútiles.
   */
  snapshot(label = 'op') {
    const now = Date.now();
    if (label === this.#lastSnapLabel && now - this.#lastSnapAt < 450) {
      this.#lastSnapAt = now; // misma ráfaga: reutiliza el snapshot previo
      return;
    }
    this.#lastSnapAt = now;
    this.#lastSnapLabel = label;
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
    this.snapshot('add');
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
    this.snapshot('remove');
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
    this.snapshot('dup');
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
    this.snapshot('nudge');
    for (const node of this.selectedNodes) {
      if (node.locked) continue;
      const f = this.frame(node);
      this.setFrame(node, { x: f.x + dx, y: f.y + dy });
    }
    this.commit();
  }

  /** Inserta un bloque prediseñado al final de la página y la agranda. */
  addBlock(key) {
    const bottom = this.pageNodes().reduce((max, n) => Math.max(max, n.base.y + n.base.h), 0);
    const y = bottom ? bottom + 60 : 0;
    const block = buildBlock(key, y);
    if (!block) return;
    this.snapshot();
    const ids = [];
    for (const node of block.nodes) {
      this.project.nodes[node.id] = node;
      this.page.nodes.push(node.id);
      ids.push(node.id);
    }
    this.page.height = Math.max(this.page.height, y + block.height + 40);
    this.commit();
    this.select(ids);
    return ids;
  }

  /** Lleva el nodo al frente (encima de todo) o al fondo. */
  bringToFront(id) {
    const nodes = this.page.nodes;
    const i = nodes.indexOf(id);
    if (i < 0 || i === nodes.length - 1) return;
    this.snapshot();
    nodes.splice(i, 1); nodes.push(id);
    this.commit();
  }

  sendToBack(id) {
    const nodes = this.page.nodes;
    const i = nodes.indexOf(id);
    if (i <= 0) return;
    this.snapshot();
    nodes.splice(i, 1); nodes.unshift(id);
    this.commit();
  }

  /** Copia estilos + animación de un nodo y los aplica a otros. */
  copyStyle() {
    const node = this.selectedNodes[0];
    if (!node) return;
    this.styleClipboard = deepClone({ styles: node.styles, animation: node.animation });
  }

  pasteStyle() {
    if (!this.styleClipboard || !this.selection.length) return;
    this.snapshot();
    for (const node of this.selectedNodes) {
      Object.assign(node.styles, deepClone(this.styleClipboard.styles));
      node.animation = deepClone(this.styleClipboard.animation);
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

  /**
   * ESCALADO PROPORCIONAL de la selección.
   *
   * No es un zoom visual: reescribe los valores REALES del proyecto, así
   * que lo exportado sale idéntico a lo que se ve. Escala el marco, el
   * interior (tipografía, radios, bordes, grosores) y —cuando hay varios
   * elementos— también las distancias entre ellos respecto al centro del
   * grupo, conservando su composición.
   *
   * @param {number} factor  1 = igual, 1.2 = un 20 % más grande
   * @param {object} anchor  punto fijo; por defecto el centro del grupo
   */
  scaleSelection(factor, anchor = null) {
    const nodes = this.selectedNodes.filter((n) => !n.locked);
    if (!nodes.length || !(factor > 0) || factor === 1) return;

    const frames = nodes.map((n) => this.frame(n));
    const minX = Math.min(...frames.map((f) => f.x));
    const minY = Math.min(...frames.map((f) => f.y));
    const maxX = Math.max(...frames.map((f) => f.x + f.w));
    const maxY = Math.max(...frames.map((f) => f.y + f.h));
    const cx = anchor?.x ?? (minX + maxX) / 2;
    const cy = anchor?.y ?? (minY + maxY) / 2;

    nodes.forEach((node, i) => {
      const f = frames[i];
      // Posición relativa al ancla: así el grupo no se desarma
      this.setFrame(node, {
        x: Math.round(cx + (f.x - cx) * factor),
        y: Math.round(cy + (f.y - cy) * factor),
        w: Math.max(8, Math.round(f.w * factor)),
        h: Math.max(8, Math.round(f.h * factor)),
      });
      scaleInnerStyles(node.styles, factor);
    });
    this.commit();
  }

  /** Distribuye 3+ elementos seleccionados con espacio uniforme. */
  distributeSelection(axis) {
    const nodes = this.selectedNodes.filter((n) => !n.locked);
    if (nodes.length < 3) return;
    this.snapshot();
    const key = axis === 'x' ? 'x' : 'y';
    const size = axis === 'x' ? 'w' : 'h';
    const sorted = [...nodes].sort((a, b) => this.frame(a)[key] - this.frame(b)[key]);
    const first = this.frame(sorted[0]);
    const last = this.frame(sorted[sorted.length - 1]);
    const span = (last[key] + last[size]) - first[key];
    const total = sorted.reduce((sum, n) => sum + this.frame(n)[size], 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = first[key];
    for (const node of sorted) {
      this.setFrame(node, { [key]: Math.round(cursor) });
      cursor += this.frame(node)[size] + gap;
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
    this.migrate(data);
    this.project = data;
    this.pageId = data.pages[0].id;
    this.clearSelection();
    this.commit(); this.emit('page');
  }

  /** Proyecto nuevo: plantilla completa o lienzo en blanco. */
  reset(blank = false) {
    this.snapshot();
    this.project = blank ? ProjectStore.blankProject() : starterProject();
    this.migrate(this.project);
    this.pageId = this.project.pages[0].id;
    this.clearSelection();
    this.commit(); this.emit('page');
  }
}

/**
 * Escala el CONTENIDO de un elemento junto con su caja: tipografía,
 * interlineado, espaciado entre letras, radios, bordes y sombras
 * propias. Sin esto, agrandar una tarjeta dejaba el texto diminuto.
 */
function scaleInnerStyles(styles, factor) {
  if (!styles) return;
  const num = (v, min, max, dec = 0) => {
    const r = Math.min(max, Math.max(min, v * factor));
    return dec ? Math.round(r * 10 ** dec) / 10 ** dec : Math.round(r);
  };
  if (styles.fontSize) styles.fontSize = num(styles.fontSize, 6, 400);
  if (styles.radius) styles.radius = num(styles.radius, 0, 999);
  if (styles.borderWidth) styles.borderWidth = num(styles.borderWidth, 0, 60, 1);
  if (styles.letterSpacing) styles.letterSpacing = num(styles.letterSpacing, -20, 80, 1);
  if (styles.padding) styles.padding = num(styles.padding, 0, 400);
  if (styles.gap) styles.gap = num(styles.gap, 0, 400);
  if (styles.blur) styles.blur = num(styles.blur, 0, 80);
  // Sombra propia en CSS: se reescalan sus longitudes en píxeles
  if (typeof styles.shadowCustom === 'string' && styles.shadowCustom.trim()) {
    styles.shadowCustom = styles.shadowCustom.replace(
      /(-?\d*\.?\d+)px/g,
      (_, n) => `${Math.round(parseFloat(n) * factor * 10) / 10}px`,
    );
  }
}
