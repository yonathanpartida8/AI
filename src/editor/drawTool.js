/* ============================================================
 * editor/drawTool.js — Canvas Draw: dibujo libre sobre el lienzo
 *
 * - Pinceles con tamaño, color, opacidad y borrador.
 * - Suavizado por interpolación quadratic-curve entre puntos.
 * - Presión de stylus (PointerEvent.pressure) modula el grosor.
 * - Capas: cada trazo se apila; deshacer de trazos independiente.
 * - "Convertir en componente": recorta el bounding box del dibujo,
 *   lo exporta a PNG (dataURL), lo registra como ASSET y crea un
 *   nodo `drawing` totalmente editable (mover, escalar, animar…).
 * ============================================================ */

import { el } from '../utils/helpers.js';

export class DrawTool {
  constructor(store, assets, view) {
    this.store = store;
    this.assets = assets;
    this.view = view;
    this.canvas = view.drawLayer;
    this.ctx = this.canvas.getContext('2d');
    this.brush = { size: 8, color: '#f472b6', opacity: 1, eraser: false };
    this.strokes = []; // snapshots de ImageData → undo de trazos
    this.drawing = false;

    this.toolbar = this.#buildToolbar();
    document.getElementById('draw-toolbar-slot').append(this.toolbar);

    store.on('tool', () => this.#onToolChange());
    store.on('change', () => this.#resize());

    this.canvas.addEventListener('pointerdown', (e) => this.#start(e));
    this.canvas.addEventListener('pointermove', (e) => this.#move(e));
    this.canvas.addEventListener('pointerup', () => this.#end());
    this.canvas.addEventListener('pointerleave', () => this.#end());
  }

  #onToolChange() {
    const active = this.store.tool === 'draw';
    this.canvas.classList.toggle('active', active);
    this.toolbar.style.display = active ? 'flex' : 'none';
    if (active) this.#resize();
  }

  #resize() {
    const width = this.store.project.settings.breakpoints[this.store.device];
    const height = this.store.page.height;
    if (this.canvas.width === width && this.canvas.height === height) return;
    // Conserva el dibujo existente al redimensionar
    const prev = this.canvas.width ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height) : null;
    this.canvas.width = width;
    this.canvas.height = height;
    if (prev) this.ctx.putImageData(prev, 0, 0);
  }

  #point(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * this.canvas.height,
      pressure: e.pressure || 0.5,
    };
  }

  #start(e) {
    if (this.store.tool !== 'draw') return;
    this.canvas.setPointerCapture(e.pointerId);
    this.strokes.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    if (this.strokes.length > 20) this.strokes.shift();
    this.drawing = true;
    this.last = this.#point(e);
    this.#segment(this.last, this.last);
  }

  #move(e) {
    if (!this.drawing) return;
    // getCoalescedEvents: máxima fidelidad con stylus a 120 Hz+
    const events = e.getCoalescedEvents?.() || [e];
    for (const ev of events) {
      const point = this.#point(ev);
      this.#segment(this.last, point);
      this.last = point;
    }
  }

  #segment(a, b) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = this.brush.opacity;
    ctx.globalCompositeOperation = this.brush.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = this.brush.color;
    ctx.lineWidth = this.brush.size * (0.5 + ((a.pressure + b.pressure) / 2));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  #end() { this.drawing = false; }

  undoStroke() {
    const prev = this.strokes.pop();
    if (prev) this.ctx.putImageData(prev, 0, 0);
  }

  clear() {
    this.strokes.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Recorta el dibujo, lo guarda como asset PNG y crea un nodo. */
  async toComponent() {
    const { width, height } = this.canvas;
    const data = this.ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) { alert('El lienzo de dibujo está vacío.'); return; }
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad); maxY = Math.min(height, maxY + pad);
    const w = maxX - minX, h = maxY - minY;

    const crop = document.createElement('canvas');
    crop.width = w; crop.height = h;
    crop.getContext('2d').drawImage(this.canvas, minX, minY, w, h, 0, 0, w, h);

    const asset = await this.assets.addDataURL(`dibujo-${Date.now().toString(36)}.png`, crop.toDataURL('image/png'));
    this.ctx.clearRect(0, 0, width, height);
    this.store.addNode('drawing', { x: minX, y: minY, w, h }, { props: { assetId: asset.id, fit: 'contain' } });
    this.store.setTool('select');
  }

  #buildToolbar() {
    const bar = el('div', { class: 'draw-toolbar', style: { display: 'none' } }, [
      el('span', { text: '✎ Dibujo:' }),
      el('input', { type: 'color', value: this.brush.color, title: 'Color', oninput: (e) => { this.brush.color = e.target.value; this.brush.eraser = false; } }),
      el('label', {}, ['Tamaño ', el('input', { type: 'range', min: 1, max: 80, value: this.brush.size, oninput: (e) => { this.brush.size = +e.target.value; } })]),
      el('label', {}, ['Opacidad ', el('input', { type: 'range', min: 5, max: 100, value: 100, oninput: (e) => { this.brush.opacity = +e.target.value / 100; } })]),
      el('button', { class: 'btn', text: '◫ Borrador', onclick: (e) => { this.brush.eraser = !this.brush.eraser; e.target.classList.toggle('active', this.brush.eraser); } }),
      el('button', { class: 'btn', text: '↶ Trazo', title: 'Deshacer último trazo', onclick: () => this.undoStroke() }),
      el('button', { class: 'btn', text: '🗑 Limpiar', onclick: () => this.clear() }),
      el('button', { class: 'btn primary', text: '✓ Convertir en componente', onclick: () => this.toComponent() }),
      el('button', { class: 'btn', text: '× Salir', onclick: () => this.store.setTool('select') }),
    ]);
    return bar;
  }
}
