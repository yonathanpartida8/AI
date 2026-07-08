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
import { COMPONENT_CSS } from '../renderer/componentStyles.js';
import { playAnimation } from '../animations/engine.js';
import { wbEffects } from '../runtime/effectsRuntime.js';
import { wbActions } from '../runtime/actionsRuntime.js';
import { CanvasView } from './canvasView.js';
import { Interactions } from './interactions.js';
import { Panels } from './panels.js';
import { PropertiesPanel } from './properties.js';
import { DrawTool } from './drawTool.js';
import { ThreeManager } from '../webgl/threeManager.js';
import { Exporter } from '../exporter/exporter.js';

async function boot() {
  // CSS compartido de componentes: la MISMA hoja que llevará el export
  const shared = document.createElement('style');
  shared.id = 'wb-component-css';
  shared.textContent = COMPONENT_CSS;
  document.head.append(shared);

  const store = new ProjectStore();
  await store.init();

  const assets = new AssetManager(store);
  await assets.init();
  assets.injectFonts();
  assets.on('change', () => assets.injectFonts());

  // CSS personalizado global del usuario, visible también en el editor
  const customStyle = document.createElement('style');
  customStyle.id = 'wb-custom-css';
  document.head.append(customStyle);
  const syncCustomCSS = () => { customStyle.textContent = store.project.custom?.css || ''; };
  store.on('change', syncCustomCSS);
  syncCustomCSS();

  const view = new CanvasView(store);
  const three = new ThreeManager(assets);
  new Interactions(store, view);
  const panels = new Panels(store, assets, view);
  new PropertiesPanel(store, assets, view);
  new DrawTool(store, assets, view);
  const exporter = new Exporter(store, assets);

  /* ── Render reactivo ───────────────────────────────── */
  const repaint = () => renderPage(view.artboard, store, assets, { mountEmbeds: (root) => three.mountAll(root) });
  store.on('change', repaint);
  store.on('page', () => view.fit());

  buildTopbar(store, view, exporter, assets, repaint);
  buildMobileNav(store, panels, view);
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
    type: 'file', accept: '.json,.html,.htm', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        let data;
        if (/\.html?$/i.test(file.name)) {
          // HTML todo-en-uno: recupera el proyecto incrustado y detecta
          // el código personalizado añadido a mano por el usuario.
          data = parseProjectFromHTML(text);
        } else {
          data = JSON.parse(text);
        }
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
    el('button', { class: 'btn', text: '▶ Vista previa', onclick: () => togglePreview(store, view, repaint, assets) }),
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
      class: 'btn primary', text: '📱 HTML (1 archivo)',
      title: 'Todo el sitio en un único archivo autocontenido: ábrelo directamente en el móvil',
      onclick: async (e) => {
        e.target.disabled = true;
        try { await exporter.exportSingle(); }
        catch (err) { alert(`Error al exportar: ${err.message}`); console.error(err); }
        e.target.disabled = false;
      },
    }),
    el('button', {
      class: 'btn primary', text: '⬇ Sitio (.zip)',
      title: 'Carpeta de proyecto completa para subir a un hosting',
      onclick: async (e) => {
        e.target.disabled = true; e.target.textContent = 'Empaquetando…';
        try { await exporter.export(); }
        catch (err) { alert(`Error al exportar: ${err.message}`); console.error(err); }
        e.target.disabled = false; e.target.textContent = '⬇ Sitio (.zip)';
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

/**
 * Recupera el proyecto de un HTML exportado "todo en uno" y detecta
 * bloques <style class="custom"> / <script class="custom"> que el
 * usuario haya añadido a mano — se integran como código personalizado
 * del proyecto sin tocar la estructura principal.
 */
function parseProjectFromHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const embedded = doc.getElementById('wb-project');
  if (!embedded) throw new Error('Este HTML no contiene un proyecto del builder (falta #wb-project)');
  const data = JSON.parse(embedded.textContent);
  data.custom ||= { css: '', js: '' };

  const extraCSS = [...doc.querySelectorAll('style.custom')].map((s) => s.textContent).join('\n');
  const extraJS = [...doc.querySelectorAll('script.custom')].map((s) => s.textContent).join('\n');
  if (extraCSS && !data.custom.css.includes(extraCSS)) data.custom.css += `\n/* detectado en el HTML importado */\n${extraCSS}`;
  if (extraJS && !data.custom.js.includes(extraJS)) data.custom.js += `\n/* detectado en el HTML importado */\n${extraJS}`;
  return data;
}

/* ── Barra de navegación móvil ───────────────────────── */

/**
 * En pantallas táctiles pequeñas los paneles laterales se convierten
 * en HOJAS DESLIZANTES (bottom sheets) controladas por esta barra
 * inferior — el lienzo ocupa toda la pantalla y el zoom es correcto.
 * En escritorio la barra queda oculta por CSS.
 */
function buildMobileNav(store, panels, view) {
  const left = document.getElementById('left-panel');
  const right = document.getElementById('right-panel');

  const closeAll = () => {
    left.classList.remove('open');
    right.classList.remove('open');
    nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
  };

  const item = (icon, label, open) => el('button', {
    onclick: (e) => {
      const btn = e.currentTarget;
      const wasActive = btn.classList.contains('active');
      closeAll();
      if (!wasActive) { open(); btn.classList.add('active'); }
    },
  }, [el('span', { class: 'mn-icon', text: icon }), el('span', { class: 'mn-label', text: label })]);

  const nav = el('nav', { id: 'mobile-nav' }, [
    item('▦', 'Piezas', () => { panels.openTab('componentes'); left.classList.add('open'); }),
    item('🖼', 'Assets', () => { panels.openTab('assets'); left.classList.add('open'); }),
    item('📄', 'Páginas', () => { panels.openTab('paginas'); left.classList.add('open'); }),
    item('≣', 'Capas', () => { panels.openTab('capas'); left.classList.add('open'); }),
    item('✦', 'Diseño', () => { right.classList.add('open'); }),
  ]);
  document.body.append(nav);

  // Tocar el lienzo cierra las hojas → edición sin estorbos
  view.viewport.addEventListener('pointerdown', closeAll);
}

/* ── Vista previa dentro del editor ──────────────────── */

let previewCleanup = null;

/**
 * Vista previa: ejecuta LOS MISMOS runtimes compartidos que llevará el
 * sitio exportado (wbEffects + wbActions) + las animaciones WAAPI.
 */
function togglePreview(store, view, repaint, assets) {
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

  const artboard = view.artboard;
  const animations = [];

  // Animaciones por trigger (WAAPI, igual comportamiento que el CSS exportado)
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
  }

  // Runtimes compartidos: efectos interactivos + sistema de acciones
  const sounds = {};
  for (const asset of assets?.list({ kind: 'audio' }) || []) sounds[asset.id] = asset.data;
  const disposeEffects = wbEffects(artboard, { editor: true, runScripts: true });
  const disposeActions = wbActions(artboard, {
    editor: true,
    sounds,
    stage: () => artboard,
    goToPage: (id) => store.setPage(id),
    playAnim: (id, targetEl) => {
      const targetNode = store.node(id);
      if (targetEl && targetNode) playAnimation(targetEl, targetNode.animation);
    },
  });

  // JavaScript personalizado (global + de la página) en un sandbox try/catch
  try {
    const code = `${store.project.custom?.js || ''}\n${store.page.custom?.js || ''}`;
    if (code.trim()) new Function(code)();
  } catch (e) { console.warn('JS personalizado:', e); }

  previewCleanup = () => {
    animations.forEach((a) => a?.cancel());
    disposeEffects();
    disposeActions();
  };
}

/* ── Atajos de teclado ───────────────────────────────── */

function bindKeyboard(store, view) {
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); store.copyStyle(); }
    else if (mod && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); store.pasteStyle(); }
    else if (mod && e.key === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
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
