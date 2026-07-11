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

import { el, download, fileToDataURL } from '../utils/helpers.js';

/** Texturas de papel de la libreta (fondo visual del lienzo de dibujo). */
const PAPERS = {
  transparente: { label: 'Transparente', css: 'transparent' },
  blanco: { label: 'Papel blanco', css: '#fdfbf7' },
  rosa: { label: 'Papel rosa', css: 'linear-gradient(180deg,#fff1f5,#ffe4ee)' },
  rayado: { label: 'Rayado', css: 'repeating-linear-gradient(180deg,#fdfbf7 0 27px,#f3c6d3 27px 28px)' },
  cuadriculado: { label: 'Cuadriculado', css: 'repeating-linear-gradient(0deg,transparent 0 23px,#e8d5f2 23px 24px), repeating-linear-gradient(90deg,#fdfbf7 0 23px,#e8d5f2 23px 24px)' },
  puntos: { label: 'Puntos', css: 'radial-gradient(circle, #d8b4c8 1.2px, transparent 1.4px) 0 0/22px 22px, #fdfbf7' },
  pergamino: { label: 'Pergamino', css: 'radial-gradient(ellipse at 30% 20%, #f6e7c8, #ecd9ae 70%, #dfc48f)' },
  noche: { label: 'Cielo nocturno', css: 'linear-gradient(180deg,#1e1035,#0d0620)' },
};

/** Estilos de pincel de la libreta. */
const BRUSHES = {
  pluma: 'Pluma',
  lapiz: 'Lápiz',
  marcador: 'Marcador',
  neon: 'Neón ✨',
  corazones: 'Corazones 💗',
};

export class DrawTool {
  constructor(store, assets, view) {
    this.store = store;
    this.assets = assets;
    this.view = view;
    this.canvas = view.drawLayer;
    // NOTA: sin `desynchronized` — en Chrome/Android retrasa la presentación
    // del trazo dentro de ancestros con transform (el dibujo "aparecía al
    // soltar"). Con el contexto estándar el trazo se ve EN TIEMPO REAL.
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.brush = { size: 8, color: '#f472b6', opacity: 1, eraser: false, type: 'pluma' };
    this.paper = 'transparente';
    this.stampDist = 0; // acumulador para el pincel de corazones
    this.strokes = []; // snapshots de ImageData → deshacer trazos
    this.redoStack = []; // → rehacer trazos
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
    // El papel solo se ve mientras la libreta está abierta
    this.canvas.style.background = active ? (PAPERS[this.paper]?.css || 'transparent') : 'transparent';
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
    e.preventDefault(); // ni scroll ni gestos del navegador: solo tinta
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* puntero sintético */ }
    this.strokes.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    if (this.strokes.length > 24) this.strokes.shift();
    this.redoStack = []; // un trazo nuevo invalida los rehacer
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
    const type = this.brush.eraser ? 'borrador' : this.brush.type;
    ctx.save();
    ctx.globalAlpha = this.brush.opacity;
    ctx.globalCompositeOperation = this.brush.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = this.brush.color;
    ctx.lineWidth = this.brush.size * (0.5 + ((a.pressure + b.pressure) / 2));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'lapiz') {
      // Trazo granulado: varias pasadas finas con jitter
      ctx.globalAlpha = this.brush.opacity * 0.35;
      ctx.lineWidth = Math.max(1, this.brush.size * 0.35);
      for (let pass = 0; pass < 3; pass++) {
        const jx = (Math.random() - 0.5) * 2, jy = (Math.random() - 0.5) * 2;
        ctx.beginPath();
        ctx.moveTo(a.x + jx, a.y + jy);
        ctx.lineTo(b.x + jx, b.y + jy);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (type === 'marcador') {
      ctx.globalAlpha = this.brush.opacity * 0.35;
      ctx.lineWidth = this.brush.size * 2.2;
      ctx.lineCap = 'square';
    } else if (type === 'neon') {
      ctx.shadowColor = this.brush.color;
      ctx.shadowBlur = this.brush.size * 1.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, this.brush.size * 0.55);
      // Halo de color debajo del núcleo blanco
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.save(); ctx.strokeStyle = this.brush.color; ctx.lineWidth = this.brush.size * 1.3; ctx.stroke(); ctx.restore();
    } else if (type === 'corazones') {
      // Estampa corazones a lo largo del trazo
      this.stampDist += Math.hypot(b.x - a.x, b.y - a.y);
      const gap = this.brush.size * 2.2;
      if (this.stampDist >= gap) {
        this.stampDist = 0;
        ctx.font = `${this.brush.size * 2.4}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.translate(b.x, b.y);
        ctx.rotate((Math.random() - 0.5) * 0.7);
        ctx.fillText(['💗', '💖', '💘', '🩷'][Math.floor(Math.random() * 4)], 0, 0);
      }
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  /** Cambia la textura de papel (fondo visual de la hoja). */
  setPaper(key) {
    this.paper = key;
    this.canvas.style.background = PAPERS[key]?.css || 'transparent';
  }

  /** Inserta una fotografía dentro del dibujo (galería del móvil). */
  async addPhoto(file) {
    const dataURL = await fileToDataURL(file);
    const img = new Image();
    await new Promise((resolve) => { img.onload = resolve; img.src = dataURL; });
    this.strokes.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    // Centrada, ocupando como mucho el 70% de la hoja
    const scale = Math.min((this.canvas.width * 0.7) / img.width, (this.canvas.height * 0.7) / img.height, 1);
    const w = img.width * scale, h = img.height * scale;
    this.ctx.drawImage(img, (this.canvas.width - w) / 2, (this.canvas.height - h) / 2, w, h);
  }

  /** Descarga la hoja como PNG (con el papel de fondo si lo hay). */
  downloadPNG() {
    const out = document.createElement('canvas');
    out.width = this.canvas.width; out.height = this.canvas.height;
    const octx = out.getContext('2d');
    if (this.paper !== 'transparente') {
      // Pinta el papel como color plano aproximado
      octx.fillStyle = this.paper === 'noche' ? '#150a26' : this.paper === 'pergamino' ? '#efdcb4' : this.paper === 'rosa' ? '#ffe9f1' : '#fdfbf7';
      octx.fillRect(0, 0, out.width, out.height);
    }
    octx.drawImage(this.canvas, 0, 0);
    out.toBlob((blob) => download(`libreta-${Date.now().toString(36)}.png`, blob));
  }

  #end() { this.drawing = false; }

  undoStroke() {
    const prev = this.strokes.pop();
    if (!prev) return;
    this.redoStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    if (this.redoStack.length > 24) this.redoStack.shift();
    this.ctx.putImageData(prev, 0, 0);
  }

  redoStroke() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.strokes.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    this.ctx.putImageData(next, 0, 0);
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
    const photoInput = el('input', {
      type: 'file', accept: 'image/*', style: { display: 'none' },
      onchange: async (e) => { if (e.target.files[0]) await this.addPhoto(e.target.files[0]); e.target.value = ''; },
    });
    const bar = el('div', { class: 'draw-toolbar', style: { display: 'none' } }, [
      el('span', { text: '📓 Libreta:' }),
      el('select', {
        class: 'input mini-select', title: 'Estilo de pincel',
        onchange: (e) => { this.brush.type = e.target.value; this.brush.eraser = false; },
      }, Object.entries(BRUSHES).map(([key, label]) => el('option', { value: key, text: label }))),
      el('select', {
        class: 'input mini-select', title: 'Textura de papel',
        onchange: (e) => this.setPaper(e.target.value),
      }, Object.entries(PAPERS).map(([key, paper]) => el('option', { value: key, text: `Papel: ${paper.label}` }))),
      el('input', { type: 'color', value: this.brush.color, title: 'Color', oninput: (e) => { this.brush.color = e.target.value; this.brush.eraser = false; } }),
      el('label', {}, ['Tamaño ', el('input', { type: 'range', min: 1, max: 80, value: this.brush.size, oninput: (e) => { this.brush.size = +e.target.value; } })]),
      el('label', {}, ['Opacidad ', el('input', { type: 'range', min: 5, max: 100, value: 100, oninput: (e) => { this.brush.opacity = +e.target.value / 100; } })]),
      el('button', { class: 'btn', text: '◫ Borrador', onclick: (e) => { this.brush.eraser = !this.brush.eraser; e.target.classList.toggle('active', this.brush.eraser); } }),
      photoInput,
      el('button', { class: 'btn', text: '🖼 Foto', title: 'Añade una fotografía de tu galería al dibujo', onclick: () => photoInput.click() }),
      el('button', { class: 'btn', text: '↶', title: 'Deshacer trazo', onclick: () => this.undoStroke() }),
      el('button', { class: 'btn', text: '↷', title: 'Rehacer trazo', onclick: () => this.redoStroke() }),
      el('button', { class: 'btn', text: '🗑 Limpiar', onclick: () => this.clear() }),
      el('button', { class: 'btn', text: '⬇ PNG', title: 'Descargar la hoja', onclick: () => this.downloadPNG() }),
      el('button', { class: 'btn primary', text: '✓ Convertir en componente', onclick: () => this.toComponent() }),
      el('button', { class: 'btn', text: '× Salir', onclick: () => this.store.setTool('select') }),
    ]);
    return bar;
  }
}
