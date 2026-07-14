/* ============================================================
 * editor/interactions.js — Drag, resize, rotación, selección
 *
 * Todo se implementa con POINTER EVENTS → un solo código para
 * ratón, táctil y stylus. setPointerCapture garantiza que el
 * gesto no se pierde al salir del elemento.
 *
 * Gestos:
 *  - click / tap            → seleccionar (Shift = múltiple)
 *  - arrastrar nodo         → mover con snap a guías y rejilla
 *  - tiradores (8)          → redimensionar
 *  - tirador superior       → rotar (Shift = pasos de 15°)
 *  - arrastrar lienzo vacío → selección por marco (marquee)
 *  - rueda                  → pan · Ctrl+rueda → zoom al cursor
 *  - espacio / botón medio  → pan temporal
 *  - pinch (2 dedos)        → zoom táctil
 *  - doble clic en texto    → edición inline
 * ============================================================ */

import { clamp, throttleRAF, el } from '../utils/helpers.js';
import { syncNodeEl } from '../renderer/renderer.js';
import { ic } from './icons.js';

const SNAP_THRESHOLD = 6;

export class Interactions {
  constructor(store, view) {
    this.store = store;
    this.view = view;
    this.gesture = null;      // estado del gesto activo
    this.pointers = new Map(); // multi-touch (pinch)
    this.momentum = null;      // inercia del lienzo tras soltar un pan
    this.updateOverlay = throttleRAF(() => this.#renderOverlay());

    const vp = view.viewport;
    vp.addEventListener('pointerdown', (e) => this.#onDown(e));
    vp.addEventListener('pointermove', (e) => this.#onMove(e));
    vp.addEventListener('pointerup', (e) => this.#onUp(e));
    vp.addEventListener('pointercancel', (e) => this.#onUp(e));
    vp.addEventListener('wheel', (e) => this.#onWheel(e), { passive: false });
    vp.addEventListener('dblclick', (e) => this.#onDblClick(e));

    store.on('selection', () => this.updateOverlay());
    store.on('change', () => this.updateOverlay());
    // OJO: nada de redibujar la superposición en 'view'. Las cajas de
    // selección viven DENTRO de #world: el pan/zoom ya las mueve gratis
    // por transform; reconstruirlas por frame hacía parpadear la barra
    // rápida durante todo el gesto.
    store.on('page', () => this.#stopMomentum());
    store.on('device', () => this.#stopMomentum());

    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && !this.#isTyping(e)) { this.spaceDown = true; vp.classList.add('panning'); } });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') { this.spaceDown = false; vp.classList.remove('panning'); } });
  }

  #isTyping(e) { return /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable; }

  /* ── Inicio de gesto ───────────────────────────────── */

  #onDown(e) {
    const preview = document.body.classList.contains('preview');
    if (this.store.tool === 'draw') return; // lo gestiona DrawTool
    this.#stopMomentum(); // un dedo nuevo frena el deslizamiento en curso
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Dos dedos → zoom (pinch) + desplazamiento (pan) simultáneos,
    // también en vista previa: el gesto de scroll SIEMPRE disponible.
    if (this.pointers.size === 2) {
      try { this.view.viewport.setPointerCapture(e.pointerId); } catch { /* puntero sintético */ }
      const [a, b] = [...this.pointers.values()];
      this.gesture = {
        kind: 'pinch',
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startZoom: this.store.zoom,
        lastCx: (a.x + b.x) / 2, lastCy: (a.y + b.y) / 2,
      };
      return;
    }

    /*
     * VISTA PREVIA: la página es interactiva. Un dedo desliza para hacer
     * SCROLL (pan perezoso: solo captura el puntero tras superar un umbral
     * de movimiento, así los toques llegan intactos a los componentes).
     */
    if (preview) {
      this.gesture = {
        kind: 'pan', lazy: true, captured: false, pointerId: e.pointerId,
        startX: e.clientX, startY: e.clientY, startPan: { ...this.store.pan },
      };
      return;
    }

    try { this.view.viewport.setPointerCapture(e.pointerId); } catch { /* puntero sintético */ }

    // Pan: espacio, botón medio o herramienta mano
    if (this.spaceDown || e.button === 1 || this.store.tool === 'pan') {
      this.gesture = { kind: 'pan', startX: e.clientX, startY: e.clientY, startPan: { ...this.store.pan } };
      return;
    }
    if (e.button !== 0) return;

    const handle = e.target.closest('[data-handle]');
    if (handle) { this.#startHandle(e, handle.dataset.handle); return; }

    const nodeEl = e.target.closest('.wb-node');
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      const node = this.store.node(id);
      if (!this.store.selection.includes(id)) {
        this.store.select(id, e.shiftKey);
        if (e.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(8); // háptico al seleccionar
      }
      else if (e.shiftKey) { this.store.select(this.store.selection.filter((s) => s !== id)); return; }
      if (node.locked) return;
      this.#startMove(e);
      return;
    }

    // Lienzo vacío: con RATÓN → marquee; con DEDO/STYLUS → desplazar lienzo
    if (e.target.closest('#artboard') || e.target === this.view.viewport || e.target.closest('#world')) {
      if (!e.shiftKey) this.store.clearSelection();
      if (e.pointerType === 'touch') {
        this.gesture = { kind: 'pan', startX: e.clientX, startY: e.clientY, startPan: { ...this.store.pan } };
      } else {
        const point = this.view.toArtboard(e.clientX, e.clientY);
        this.gesture = { kind: 'marquee', x0: point.x, y0: point.y, additive: e.shiftKey };
      }
    }
  }

  #startMove(e) {
    this.store.snapshot('gesture');
    document.body.classList.add('wb-gesturing'); // pausa simulaciones WebGL
    const nodes = this.store.selectedNodes.filter((n) => !n.locked);
    this.gesture = {
      kind: 'move',
      start: this.view.toArtboard(e.clientX, e.clientY),
      frames: new Map(nodes.map((n) => [n.id, this.store.frame(n)])),
      moved: false,
    };
  }

  #startHandle(e, handle) {
    const node = this.store.selectedNodes[0];
    if (!node || node.locked) return;
    this.store.snapshot('gesture');
    const frame = this.store.frame(node);
    document.body.classList.add('wb-gesturing');
    if (handle === 'rotate') {
      const elem = this.#nodeEl(node.id);
      const rect = elem.getBoundingClientRect();
      this.gesture = {
        kind: 'rotate', node,
        cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2,
        startRotation: frame.rotation || 0,
        startAngle: Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)),
      };
    } else {
      this.gesture = { kind: 'resize', node, handle, start: this.view.toArtboard(e.clientX, e.clientY), frame };
    }
  }

  /* ── Movimiento ────────────────────────────────────── */

  #onMove(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;
    if (!g) return;

    if (g.kind === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      // Desplaza siguiendo el centro de los dos dedos…
      this.store.setView(null, { x: this.store.pan.x + cx - g.lastCx, y: this.store.pan.y + cy - g.lastCy });
      g.lastCx = cx; g.lastCy = cy;
      // …y hace zoom hacia/desde ese centro
      this.view.zoomAt(cx, cy, (g.startZoom * (dist / g.startDist)) / this.store.zoom);
      return;
    }

    if (g.kind === 'pan') {
      // Pan perezoso (vista previa): captura el puntero solo tras moverse
      // 8px — un toque limpio sigue llegando al componente de debajo.
      if (g.lazy && !g.captured) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 8) return;
        g.captured = true;
        try { this.view.viewport.setPointerCapture(g.pointerId); } catch { /* puntero sintético */ }
      }
      // Velocidad suavizada (px/ms) para la inercia al soltar
      if (g.lastT != null) {
        const dt = Math.max(1, e.timeStamp - g.lastT);
        const nvx = (e.clientX - g.lastX) / dt, nvy = (e.clientY - g.lastY) / dt;
        g.vx = g.vx == null ? nvx : g.vx * 0.7 + nvx * 0.3;
        g.vy = g.vy == null ? nvy : g.vy * 0.7 + nvy * 0.3;
      }
      g.lastX = e.clientX; g.lastY = e.clientY; g.lastT = e.timeStamp;

      let x = g.startPan.x + e.clientX - g.startX;
      let y = g.startPan.y + e.clientY - g.startY;
      // Vista previa: resistencia elástica al pasarse de los bordes de la página
      if (g.lazy) {
        const b = this.#panBounds();
        if (x < b.minX) x = b.minX + (x - b.minX) * 0.35;
        if (x > b.maxX) x = b.maxX + (x - b.maxX) * 0.35;
        if (y < b.minY) y = b.minY + (y - b.minY) * 0.35;
        if (y > b.maxY) y = b.maxY + (y - b.maxY) * 0.35;
      }
      this.store.setView(null, { x, y });
      return;
    }

    if (g.kind === 'marquee') {
      const point = this.view.toArtboard(e.clientX, e.clientY);
      g.x1 = point.x; g.y1 = point.y;
      this.#renderMarquee(g);
      return;
    }

    if (g.kind === 'move') {
      const point = this.view.toArtboard(e.clientX, e.clientY);
      let dx = point.x - g.start.x, dy = point.y - g.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) g.moved = true;

      // Snap del primer nodo; el delta corregido se aplica a todos
      const first = this.store.node([...g.frames.keys()][0]);
      if (first && !e.altKey) {
        const f0 = g.frames.get(first.id);
        const snapped = this.#snap(f0.x + dx, f0.y + dy, f0.w, f0.h, [...g.frames.keys()]);
        dx += snapped.dx; dy += snapped.dy;
        this.view.showGuides(snapped.lines);
      }
      for (const [id, f0] of g.frames) {
        const node = this.store.node(id);
        this.store.setFrame(node, { x: Math.round(f0.x + dx), y: Math.round(f0.y + dy) });
        const elem = this.#nodeEl(id);
        if (elem) syncNodeEl(elem, node, this.store);
      }
      this.updateOverlay();
      return;
    }

    if (g.kind === 'resize') {
      const point = this.view.toArtboard(e.clientX, e.clientY);
      const dx = point.x - g.start.x, dy = point.y - g.start.y;
      const f = { ...g.frame };
      const h = g.handle;
      if (h.includes('e')) f.w = Math.max(16, g.frame.w + dx);
      if (h.includes('s')) f.h = Math.max(16, g.frame.h + dy);
      if (h.includes('w')) { f.w = Math.max(16, g.frame.w - dx); f.x = g.frame.x + g.frame.w - f.w; }
      if (h.includes('n')) { f.h = Math.max(16, g.frame.h - dy); f.y = g.frame.y + g.frame.h - f.h; }
      if (e.shiftKey && g.frame.w && g.frame.h) { // proporción bloqueada
        const ratio = g.frame.w / g.frame.h;
        if (h.includes('e') || h.includes('w')) f.h = f.w / ratio; else f.w = f.h * ratio;
      }
      this.store.setFrame(g.node, { x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h) });
      const elem = this.#nodeEl(g.node.id);
      if (elem) syncNodeEl(elem, g.node, this.store);
      this.updateOverlay();
      return;
    }

    if (g.kind === 'rotate') {
      const angle = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      let deg = g.startRotation + ((angle - g.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      this.store.setFrame(g.node, { rotation: Math.round(deg) });
      const elem = this.#nodeEl(g.node.id);
      if (elem) syncNodeEl(elem, g.node, this.store);
      this.updateOverlay();
    }
  }

  /* ── Fin de gesto ──────────────────────────────────── */

  #onUp(e) {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch' && this.pointers.size > 0) return;
    this.gesture = null;
    document.body.classList.remove('wb-gesturing');
    this.view.clearGuides();
    document.getElementById('marquee')?.remove();

    if (g.kind === 'marquee' && g.x1 != null) {
      const [x0, x1] = [Math.min(g.x0, g.x1), Math.max(g.x0, g.x1)];
      const [y0, y1] = [Math.min(g.y0, g.y1), Math.max(g.y0, g.y1)];
      const hits = this.store.pageNodes().filter((n) => {
        const f = this.store.frame(n);
        return f.x < x1 && f.x + f.w > x0 && f.y < y1 && f.y + f.h > y0;
      }).map((n) => n.id);
      if (hits.length) this.store.select(hits, g.additive);
    }
    if ((g.kind === 'move' && g.moved) || g.kind === 'resize' || g.kind === 'rotate') {
      // La página crece automáticamente si un elemento se arrastra más abajo del borde
      const bottom = this.store.selectedNodes.reduce((max, n) => {
        const f = this.store.frame(n);
        return Math.max(max, f.y + f.h);
      }, 0);
      if (bottom > this.store.page.height) this.store.page.height = Math.ceil(bottom + 160);
      this.store.commit();
      if (e.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(12); // háptico al soltar
    }

    // Inercia: si el pan terminó con velocidad, el lienzo sigue deslizándose.
    // Un dedo quieto >120ms antes de soltar no lanza (evita vuelos fantasma;
    // margen holgado porque Android agrupa pointermoves en frames cargados).
    if (g.kind === 'pan' && g.vx != null && e.timeStamp - g.lastT < 120 && !(g.lazy && !g.captured)) {
      this.#startMomentum(g.vx, g.vy, !!g.lazy);
    }
  }

  /* ── Inercia del lienzo (fricción exponencial + rebote suave) ── */

  #stopMomentum() {
    if (this.momentum) { cancelAnimationFrame(this.momentum.raf); this.momentum = null; }
  }

  /** Límites del pan en vista previa: la página se comporta como un scroll. */
  #panBounds() {
    const zoom = this.store.zoom;
    const width = this.store.project.settings.breakpoints[this.store.device] * zoom;
    const height = this.store.page.height * zoom;
    const vw = this.view.viewport.clientWidth, vh = this.view.viewport.clientHeight;
    const cx = (vw - width) / 2;
    return {
      minX: width <= vw ? cx : vw - width - 24,
      maxX: width <= vw ? cx : 24,
      minY: Math.min(vh - height - 24, 24),
      maxY: 24,
    };
  }

  #startMomentum(vx, vy, bounded) {
    if (Math.hypot(vx, vy) < 0.08 && !bounded) return;
    this.#stopMomentum();
    let last = performance.now();
    const m = this.momentum = { vx, vy, raf: 0 };
    const step = (now) => {
      if (this.momentum !== m) return;
      const dt = Math.min(50, now - last); last = now;
      const friction = Math.exp(-dt / 300);
      m.vx *= friction; m.vy *= friction;
      let x = this.store.pan.x + m.vx * dt;
      let y = this.store.pan.y + m.vy * dt;
      let settled = Math.hypot(m.vx, m.vy) < 0.02;
      if (bounded) {
        // Muelle de vuelta a los límites (rebote iOS) amortiguando la velocidad
        const b = this.#panBounds();
        const pull = 1 - Math.exp(-dt / 110);
        const damp = Math.exp(-dt / 55);
        if (x < b.minX) { x += (b.minX - x) * pull; m.vx *= damp; settled = settled && b.minX - x < 0.5; }
        else if (x > b.maxX) { x += (b.maxX - x) * pull; m.vx *= damp; settled = settled && x - b.maxX < 0.5; }
        if (y < b.minY) { y += (b.minY - y) * pull; m.vy *= damp; settled = settled && b.minY - y < 0.5; }
        else if (y > b.maxY) { y += (b.maxY - y) * pull; m.vy *= damp; settled = settled && y - b.maxY < 0.5; }
      }
      this.store.setView(null, { x, y });
      if (settled) this.momentum = null;
      else m.raf = requestAnimationFrame(step);
    };
    m.raf = requestAnimationFrame(step);
  }

  #onWheel(e) {
    e.preventDefault();
    this.#stopMomentum();
    if (e.ctrlKey || e.metaKey) this.view.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
    else this.store.setView(null, { x: this.store.pan.x - e.deltaX, y: this.store.pan.y - e.deltaY });
  }

  /* ── Edición inline de texto ───────────────────────── */

  #onDblClick(e) {
    if (document.body.classList.contains('preview')) return;
    const nodeEl = e.target.closest('.wb-node');
    if (!nodeEl) {
      // Doble toque en lienzo vacío → reencuadra la página (como en mapas)
      if (e.target.closest('#artboard') || e.target === this.view.viewport || e.target.closest('#world')) {
        this.#stopMomentum();
        this.view.fit();
      }
      return;
    }
    const node = this.store.node(nodeEl.dataset.id);
    if (!node || node.locked || !['text', 'button'].includes(node.type)) return;
    const target = nodeEl.querySelector('.wb-text, .wb-btn') || nodeEl;
    target.contentEditable = 'plaintext-only';
    target.focus();
    document.getSelection()?.selectAllChildren(target);
    const finish = () => {
      target.contentEditable = 'false';
      this.store.snapshot();
      this.store.updateNode(node.id, 'props', { text: target.innerText.trim() });
    };
    target.addEventListener('blur', finish, { once: true });
    target.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') target.blur(); ev.stopPropagation(); });
  }

  /* ── Snap a guías y rejilla ────────────────────────── */

  #snap(x, y, w, h, excludeIds) {
    const lines = [];
    let dx = 0, dy = 0;
    const threshold = SNAP_THRESHOLD / this.store.zoom;
    const width = this.store.project.settings.breakpoints[this.store.device];
    const height = this.store.page.height;

    const candidatesV = [0, width / 2, width];
    const candidatesH = [0, height / 2, height];
    for (const other of this.store.pageNodes()) {
      if (excludeIds.includes(other.id) || other.hidden) continue;
      const f = this.store.frame(other);
      candidatesV.push(f.x, f.x + f.w / 2, f.x + f.w);
      candidatesH.push(f.y, f.y + f.h / 2, f.y + f.h);
    }
    const edgesV = [x, x + w / 2, x + w];
    const edgesH = [y, y + h / 2, y + h];

    outer_v:
    for (const candidate of candidatesV) {
      for (const edge of edgesV) {
        if (Math.abs(edge - candidate) < threshold) { dx = candidate - edge; lines.push({ axis: 'v', pos: candidate }); break outer_v; }
      }
    }
    outer_h:
    for (const candidate of candidatesH) {
      for (const edge of edgesH) {
        if (Math.abs(edge - candidate) < threshold) { dy = candidate - edge; lines.push({ axis: 'h', pos: candidate }); break outer_h; }
      }
    }

    // Snap a rejilla si no hubo guía
    const grid = this.store.project.settings.grid;
    if (grid.snap) {
      if (!dx) dx = Math.round((x + dx) / grid.size) * grid.size - x;
      if (!dy) dy = Math.round((y + dy) / grid.size) * grid.size - y;
    }
    return { dx, dy, lines };
  }

  /* ── Overlay de selección ──────────────────────────── */

  #nodeEl(id) { return this.view.artboard.querySelector(`[data-id="${id}"]`); }

  #renderMarquee(g) {
    let box = document.getElementById('marquee');
    if (!box) {
      box = document.createElement('div');
      box.id = 'marquee';
      this.view.overlay.append(box);
    }
    box.style.left = `${Math.min(g.x0, g.x1)}px`;
    box.style.top = `${Math.min(g.y0, g.y1)}px`;
    box.style.width = `${Math.abs(g.x1 - g.x0)}px`;
    box.style.height = `${Math.abs(g.y1 - g.y0)}px`;
  }

  #renderOverlay() {
    const overlay = this.view.overlay;
    const marquee = document.getElementById('marquee');
    overlay.innerHTML = '';
    if (marquee) overlay.append(marquee);
    const selected = this.store.selectedNodes;
    const single = selected.length === 1;

    // La animación de entrada solo se reproduce cuando CAMBIA la selección;
    // los refrescos por edición (sliders, nudges) no deben hacerla parpadear.
    const key = selected.map((n) => n.id).join(',');
    const isNewSelection = key !== this.lastOverlayKey;
    this.lastOverlayKey = key;

    for (const node of selected) {
      const f = this.store.frame(node);
      const box = document.createElement('div');
      box.className = `sel-box${node.locked ? ' locked' : ''}`;
      Object.assign(box.style, {
        left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px`,
        transform: `rotate(${f.rotation || 0}deg)`,
      });
      if (single && !node.locked) {
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const handle = document.createElement('div');
          handle.className = `handle h-${h}`;
          handle.dataset.handle = h;
          box.append(handle);
        }
        const rot = document.createElement('div');
        rot.className = 'handle h-rotate';
        rot.dataset.handle = 'rotate';
        box.append(rot);
      }
      overlay.append(box);

      // Etiqueta y barra rápida en un ANCLAJE SIN ROTAR: sobre un nodo
      // girado (las polaroids lo están) deben verse siempre derechas.
      if (single) {
        const affix = document.createElement('div');
        affix.className = 'sel-affix';
        Object.assign(affix.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
        if (!node.locked) {
          const label = document.createElement('div');
          label.className = 'sel-label';
          label.textContent = `${node.name} · ${Math.round(f.w)}×${Math.round(f.h)}`;
          affix.append(label);
        }
        const bar = this.#buildQuickbar(node);
        if (!isNewSelection) bar.classList.add('no-anim');
        affix.append(bar);
        overlay.append(affix);
      }
    }
  }

  /** Barra rápida contextual: acciones al alcance del pulgar. */
  #buildQuickbar(node) {
    const store = this.store;
    const btn = (icon, title, onclick, cls = '') => el('button', {
      class: cls, title, 'aria-label': title, html: ic(icon, 15),
      onpointerdown: (e) => e.stopPropagation(), // no inicia drag del nodo
      onclick,
    });
    const bar = el('div', { class: 'quickbar', style: { left: '0', bottom: '100%', marginBottom: '6px' } }, [
      btn('duplicate', 'Duplicar', () => store.duplicateNodes([node.id])),
      btn('copy', 'Copiar', () => { store.select([node.id]); store.copy(); }),
      btn(node.locked ? 'lock' : 'unlock', node.locked ? 'Desbloquear' : 'Bloquear', () => store.toggleFlag(node.id, 'locked')),
      btn(node.hidden ? 'eyeOff' : 'eye', node.hidden ? 'Mostrar' : 'Ocultar', () => store.toggleFlag(node.id, 'hidden')),
      btn('front', 'Traer al frente', () => store.bringToFront(node.id)),
      btn('back', 'Enviar al fondo', () => store.sendToBack(node.id)),
      btn('sliders', 'Diseño y lógica', () => document.dispatchEvent(new CustomEvent('wb:open-design'))),
      btn('trash', 'Eliminar', () => store.removeNodes([node.id]), 'danger'),
    ]);
    return bar;
  }
}
