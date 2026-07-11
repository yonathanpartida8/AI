/* ============================================================
 * editor/canvasView.js — Lienzo infinito del editor
 *
 * Estructura de capas (de abajo a arriba):
 *
 *   #viewport  (área visible, captura wheel/pointer)
 *    └─ #world (transform: translate(pan) scale(zoom))
 *        ├─ #artboard   (la "página": nodos renderizados)
 *        ├─ #guides     (SVG: guías inteligentes de snap)
 *        ├─ #draw-layer (canvas de dibujo libre)
 *        └─ #overlay    (cajas de selección + tiradores)
 *
 * El zoom/pan es UNA transform CSS en #world → el navegador lo
 * compone en GPU; repintar nodos nunca es necesario al navegar.
 * Las reglas se dibujan en <canvas> propios y solo se repintan
 * cuando cambia la vista (render bajo demanda).
 * ============================================================ */

import { clamp, throttleRAF } from '../utils/helpers.js';

export class CanvasView {
  constructor(store) {
    this.store = store;
    this.viewport = document.getElementById('viewport');
    this.world = document.getElementById('world');
    this.artboard = document.getElementById('artboard');
    this.guides = document.getElementById('guides');
    this.drawLayer = document.getElementById('draw-layer');
    this.overlay = document.getElementById('overlay');
    this.rulerH = document.getElementById('ruler-h');
    this.rulerV = document.getElementById('ruler-v');

    // Las reglas se repintan como mucho una vez por frame (zoom/pan fluidos)
    this.drawRulers = throttleRAF(this.drawRulers.bind(this));
    store.on('view', () => this.apply());
    store.on('change', () => this.syncSize());
    store.on('device', () => this.fit());
    window.addEventListener('resize', () => this.drawRulers());
    this.apply();
  }

  apply() {
    const { zoom, pan } = this.store;
    this.world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    // Los tiradores compensan el zoom para mantener tamaño constante en pantalla
    this.world.style.setProperty('--izoom', 1 / zoom);
    this.drawRulers();
  }

  syncSize() {
    const width = this.store.project.settings.breakpoints[this.store.device];
    const height = this.store.page.height;
    for (const layer of [this.guides, this.drawLayer, this.overlay]) {
      layer.style.width = `${width}px`;
      layer.style.height = `${height}px`;
    }
    this.guides.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const grid = this.store.project.settings.grid;
    this.artboard.classList.toggle('show-grid', !!grid.visible);
    this.artboard.style.setProperty('--grid-size', `${grid.size}px`);
  }

  /** Coordenadas de pantalla → coordenadas del artboard. */
  toArtboard(clientX, clientY) {
    const rect = this.artboard.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.store.zoom,
      y: (clientY - rect.top) / this.store.zoom,
    };
  }

  zoomAt(clientX, clientY, factor) {
    const { zoom, pan } = this.store;
    const next = clamp(zoom * factor, 0.1, 4);
    const rect = this.viewport.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    // Mantiene el punto bajo el cursor fijo durante el zoom
    this.store.setView(next, {
      x: px - ((px - pan.x) / zoom) * next,
      y: py - ((py - pan.y) / zoom) * next,
    });
  }

  /**
   * Ajusta al ANCHO de la página (como Figma): en páginas largas se
   * navega con scroll/pan, nunca se encoge todo a un sello de correos.
   */
  fit() {
    const width = this.store.project.settings.breakpoints[this.store.device];
    const vw = this.viewport.clientWidth || window.innerWidth;
    const margin = vw < 700 ? 24 : 120;
    const zoom = clamp((vw - margin) / width, 0.1, 1.5);
    this.store.setView(zoom, { x: (vw - width * zoom) / 2, y: 24 });
    this.syncSize();
  }

  /* ── Guías inteligentes ────────────────────────────── */

  showGuides(lines) {
    const width = this.store.project.settings.breakpoints[this.store.device];
    const height = this.store.page.height;
    this.guides.innerHTML = lines.map((line) => line.axis === 'v'
      ? `<line x1="${line.pos}" y1="0" x2="${line.pos}" y2="${height}" />`
      : `<line x1="0" y1="${line.pos}" x2="${width}" y2="${line.pos}" />`).join('');
  }

  clearGuides() { this.guides.innerHTML = ''; }

  /* ── Reglas ────────────────────────────────────────── */

  drawRulers() {
    const { zoom, pan } = this.store;
    for (const [canvas, horizontal] of [[this.rulerH, true], [this.rulerV, false]]) {
      if (!canvas) continue;
      const length = horizontal ? canvas.parentElement.clientWidth : canvas.parentElement.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = (horizontal ? length : 24) * dpr;
      canvas.height = (horizontal ? 24 : length) * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#0d1220';
      ctx.fillRect(0, 0, horizontal ? length : 24, horizontal ? 24 : length);
      ctx.fillStyle = '#5b6478';
      ctx.strokeStyle = '#2a3244';
      ctx.font = '9px system-ui';
      const step = zoom > 1.5 ? 50 : zoom > 0.6 ? 100 : 250;
      const offset = horizontal ? pan.x : pan.y;
      const start = Math.floor(-offset / zoom / step) * step;
      const end = start + length / zoom + step;
      ctx.beginPath();
      for (let value = start; value < end; value += step) {
        const px = value * zoom + offset;
        if (horizontal) { ctx.moveTo(px, 14); ctx.lineTo(px, 24); ctx.fillText(String(value), px + 3, 11); }
        else { ctx.moveTo(14, px); ctx.lineTo(24, px); ctx.save(); ctx.translate(11, px + 3); ctx.rotate(-Math.PI / 2); ctx.fillText(String(value), 0, 0); ctx.restore(); }
      }
      ctx.stroke();
    }
  }
}
