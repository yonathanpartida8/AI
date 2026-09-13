/* ============================================================
 * editor/canvasView.js — Lienzo del editor (táctil)
 *
 * Estructura de capas (de abajo a arriba):
 *
 *   #viewport  (área visible, captura los gestos)
 *    └─ #world (transform: translate(pan) scale(zoom))
 *        ├─ #artboard   (la "página": nodos renderizados)
 *        ├─ #guides     (SVG: guías inteligentes de snap)
 *        ├─ #draw-layer (canvas de dibujo libre)
 *        └─ #overlay    (cajas de selección + tiradores)
 *
 * El zoom/pan es UNA transform CSS en #world → el navegador lo
 * compone en GPU; repintar nodos nunca es necesario al navegar.
 * ============================================================ */

import { clamp } from '../utils/helpers.js';

export class CanvasView {
  constructor(store) {
    this.store = store;
    this.viewport = document.getElementById('viewport');
    this.world = document.getElementById('world');
    this.artboard = document.getElementById('artboard');
    this.guides = document.getElementById('guides');
    this.drawLayer = document.getElementById('draw-layer');
    this.overlay = document.getElementById('overlay');

    store.on('view', () => this.apply());
    store.on('change', () => this.syncSize());
    store.on('device', () => this.fit());
    this.apply();
  }

  apply() {
    const { zoom, pan } = this.store;
    this.world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    // Los tiradores compensan el zoom para mantener tamaño constante en pantalla
    this.world.style.setProperty('--izoom', 1 / zoom);
  }

  syncSize() {
    const width = this.store.project.settings.breakpoints[this.store.device];
    const height = this.store.page.height;
    // Solo toca el DOM si las medidas cambiaron: se llama en cada commit
    // y reescribir estilos idénticos invalida estilo/layout sin motivo.
    if (this.lastW !== width || this.lastH !== height) {
      this.lastW = width; this.lastH = height;
      for (const layer of [this.guides, this.drawLayer, this.overlay]) {
        layer.style.width = `${width}px`;
        layer.style.height = `${height}px`;
      }
      this.guides.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
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
    // Un respiro a los lados: el lienzo nunca pega contra el borde,
    // y en tablet el margen crece un poco para que respire igual.
    const margin = vw < 560 ? 24 : 48;
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
}
