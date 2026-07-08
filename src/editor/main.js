/* ============================================================
 * editor/main.js — Punto de entrada y orquestación del editor
 *
 * Composición de módulos (inyección de dependencias simple):
 *
 *   ProjectStore ─┬─ CanvasView ── Interactions
 *                 ├─ AssetManager ── Panels
 *                 ├─ PropertiesPanel
 *                 ├─ DrawTool
 *                 ├─ ThreeManager (lazy)
 *                 └─ Exporter
 *
 * Todos los módulos se comunican por eventos del Store; ninguno
 * conoce a otro directamente → sustituibles y testeables.
 * ============================================================ */

import { el, download } from '../utils/helpers.js';
import { ProjectStore, DEVICES } from '../storage/projectStore.js';
import { AssetManager } from '../assets/assetManager.js';
import { renderPage } from '../renderer/renderer.js';
import { playAnimation } from '../animations/engine.js';
import { CanvasView } from './canvasView.js';
import { Interactions } from './interactions.js';
import { Panels } from './panels.js';
import { PropertiesPanel } from './properties.js';
import { DrawTool } from './drawTool.js';
import { ThreeManager } from '../webgl/threeManager.js';
import { Exporter } from '../exporter/exporter.js';

async function boot() {
  const store = new ProjectStore();
  await store.init();

  const assets = new AssetManager(store);
  await assets.init();

  const view = new CanvasView(store);
  const three = new ThreeManager(assets);
  new Interactions(store, view);
  new Panels(store, assets, view);
  new PropertiesPanel(store, assets, view);
  new DrawTool(store, assets, view);
  const exporter = new Exporter(store, assets);

  /* ── Render reactivo ───────────────────────────────── */
  const repaint = () => renderPage(view.artboard, store, assets, { mountEmbeds: (root) => three.mountAll(root) });
  store.on('change', repaint);
  store.on('page', () => view.fit());

  buildTopbar(store, view, exporter, assets, repaint);
  bindKeyboard(store, view);

  view.syncSize();
  repaint();
  view.fit();
}

/* ── Barra superior ──────────────────────────────────── */

function buildTopbar(store, view, exporter, assets, repaint) {
  const bar = document.getElementById('topbar');
  const savedDot = el('span', { class: 'saved-dot', title: 'Guardado automático activo', text: '●' });
  store.on('saved', () => {
    savedDot.classList.add('flash');
    setTimeout(() => savedDot.classList.remove('flash'), 600);
  });

  const deviceButtons = el('div', { class: 'seg' }, Object.entries(DEVICES).map(([key, meta]) =>
    el('button', {
      class: `seg-btn${store.device === key ? ' active' : ''}`, text: `${meta.icon} ${meta.label}`,
      dataset: { device: key },
      title: `${meta.width}px`,
      onclick: () => store.setDevice(key),
    })));
  store.on('device', () => {
    deviceButtons.querySelectorAll('.seg-btn').forEach((btn) =>
      btn.classList.toggle('active', btn.dataset.device === store.device));
  });

  const zoomLabel = el('span', { class: 'zoom-label', text: '100%' });
  store.on('view', () => { zoomLabel.textContent = `${Math.round(store.zoom * 100)}%`; });

  const fileInput = el('input', {
    type: 'file', accept: '.json', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        // Restaura los assets incrustados (GIFs, imágenes, vídeos…)
        if (Array.isArray(data.assetsData)) {
          await assets.importData(data.assetsData);
          delete data.assetsData;
        }
        store.importJSON(data);
      } catch (err) { alert(`No se pudo importar: ${err.message}`); }
      e.target.value = '';
    },
  });

  bar.append(
    el('div', { class: 'brand', text: '◆ Builder' }),
    savedDot,
    el('div', { class: 'sep' }),
    el('button', { class: 'btn', text: '↶', title: 'Deshacer (Ctrl+Z)', onclick: () => store.undo() }),
    el('button', { class: 'btn', text: '↷', title: 'Rehacer (Ctrl+Y)', onclick: () => store.redo() }),
    el('div', { class: 'sep' }),
    deviceButtons,
    el('div', { class: 'sep' }),
    el('button', { class: 'btn', text: '−', title: 'Alejar', onclick: () => view.zoomAt(innerWidth / 2, innerHeight / 2, 0.85) }),
    zoomLabel,
    el('button', { class: 'btn', text: '+', title: 'Acercar', onclick: () => view.zoomAt(innerWidth / 2, innerHeight / 2, 1.18) }),
    el('button', { class: 'btn', text: '⤢', title: 'Ajustar a pantalla', onclick: () => view.fit() }),
    el('div', { class: 'sep' }),
    el('button', { class: 'btn', text: '✎ Dibujar', onclick: () => store.setTool(store.tool === 'draw' ? 'select' : 'draw') }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'btn', text: '▶ Vista previa', onclick: () => togglePreview(store, view, repaint) }),
    el('div', { class: 'sep' }),
    fileInput,
    el('button', { class: 'btn', text: '⭱ Importar', title: 'Importar proyecto .json', onclick: () => fileInput.click() }),
    el('button', {
      class: 'btn', text: '⭳ Guardar .json', title: 'Descarga el proyecto COMPLETO (incluye tus GIFs, imágenes y vídeos)',
      onclick: () => {
        // El .json incluye los assets → el archivo es 100% autocontenido
        const data = { ...store.exportJSON(), assetsData: assets.exportData() };
        download(`${store.project.meta.name}.json`,
          new Blob([JSON.stringify(data)], { type: 'application/json' }));
      },
    }),
    el('button', {
      class: 'btn primary', text: '⬇ Exportar sitio (.zip)',
      onclick: async (e) => {
        e.target.disabled = true; e.target.textContent = 'Empaquetando…';
        try { await exporter.export(); }
        catch (err) { alert(`Error al exportar: ${err.message}`); console.error(err); }
        e.target.disabled = false; e.target.textContent = '⬇ Exportar sitio (.zip)';
      },
    }),
    el('button', {
      class: 'btn danger', text: '🗑 Nuevo', title: 'Proyecto nuevo (borra el actual)',
      onclick: () => {
        if (!confirm('¿Empezar un proyecto nuevo? El actual se descartará.')) return;
        const template = confirm('¿Empezar con la plantilla de ejemplo?\n(Aceptar = plantilla · Cancelar = lienzo en blanco)');
        store.reset(!template);
      },
    }),
  );
}

/* ── Vista previa dentro del editor ──────────────────── */

let previewCleanup = null;

function togglePreview(store, view, repaint) {
  const body = document.body;
  if (body.classList.contains('preview')) {
    body.classList.remove('preview');
    previewCleanup?.();
    previewCleanup = null;
    repaint();
    return;
  }
  body.classList.add('preview');
  store.clearSelection();
  repaint();

  // Ejecuta animaciones según su trigger, como en el sitio exportado
  const animations = [];
  const artboard = view.artboard;
  for (const node of store.pageNodes()) {
    const elem = artboard.querySelector(`[data-id="${node.id}"]`);
    if (!elem) continue;
    const anim = node.animation;
    if (anim?.preset && anim.preset !== 'ninguna') {
      if (anim.trigger === 'load') animations.push(playAnimation(elem, anim));
      else if (anim.trigger === 'click') elem.addEventListener('click', () => playAnimation(elem, anim));
      else if (anim.trigger === 'hover') elem.addEventListener('mouseenter', () => playAnimation(elem, anim));
      else if (anim.trigger === 'scroll') {
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { playAnimation(elem, anim); io.disconnect(); }
        }, { threshold: 0.25 });
        io.observe(elem);
      }
    }
    // Eventos: navegación entre páginas y toggles funcionan en preview
    for (const event of node.events || []) {
      const handler = () => {
        if (event.action === 'goToPage') store.setPage(event.target);
        else if (event.action === 'openUrl' && event.target) window.open(event.target, '_blank', 'noopener');
        else if (event.action === 'toggleNode') {
          const target = artboard.querySelector(`[data-id="${event.target}"]`);
          if (target) target.style.visibility = target.style.visibility === 'hidden' ? '' : 'hidden';
        } else if (event.action === 'playAnimation') {
          const target = artboard.querySelector(`[data-id="${event.target}"]`);
          const targetNode = store.node(event.target);
          if (target && targetNode) playAnimation(target, targetNode.animation);
        }
      };
      elem.addEventListener(event.on === 'hover' ? 'mouseenter' : 'click', handler);
      elem.style.cursor = 'pointer';
    }
  }
  previewCleanup = () => animations.forEach((a) => a?.cancel());
}

/* ── Atajos de teclado ───────────────────────────────── */

function bindKeyboard(store, view) {
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
    else if (mod && e.key === 'y') { e.preventDefault(); store.redo(); }
    else if (mod && e.key === 'c') { store.copy(); }
    else if (mod && e.key === 'v') { store.paste(); }
    else if (mod && e.key === 'd') { e.preventDefault(); store.duplicateNodes(); }
    else if (mod && e.key === 's') { e.preventDefault(); store.persist(); }
    else if (mod && e.key === 'a') { e.preventDefault(); store.select(store.pageNodes().map((n) => n.id)); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { store.removeNodes(); }
    else if (e.key === 'Escape') { store.clearSelection(); store.setTool('select'); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      store.nudge(dx, dy);
    }
    else if (e.key === '0' && mod) { e.preventDefault(); view.fit(); }
  });
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f87171;padding:40px">Error al iniciar el editor:\n${err.stack}</pre>`;
});
