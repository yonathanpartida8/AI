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
import { ic } from './icons.js';
import { ProjectStore, DEVICES } from '../storage/projectStore.js';
import { AssetManager } from '../assets/assetManager.js';
import { renderPage } from '../renderer/renderer.js';
import { COMPONENT_CSS } from '../renderer/componentStyles.js';
import { MY_ANIMATIONS_CSS } from '../../contenido/animaciones/index.js';
import { playAnimation, playExitAnimation } from '../animations/engine.js';
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
  shared.textContent = COMPONENT_CSS + '\n' + MY_ANIMATIONS_CSS; // + tus @keyframes de contenido/animaciones
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
  const interactions = new Interactions(store, view);
  const panels = new Panels(store, assets, view);
  new PropertiesPanel(store, assets, view);
  new DrawTool(store, assets, view);
  const exporter = new Exporter(store, assets);

  /* ── Render reactivo INCREMENTAL ───────────────────── */
  const repaint = () => renderPage(view.artboard, store, assets, {
    mountEl: (el) => three.mountEl(el),
    unmountEl: (el) => three.disposeIn(el),
  });
  store.on('change', repaint);
  store.on('page', () => { three.disposeAll(); view.fit(); });

  buildTopbar(store, view, exporter, assets, repaint);
  buildMobileNav(store, panels, view);
  bindKeyboard(store, view);

  view.syncSize();
  repaint();
  view.fit();

  // API de consola para usuarios avanzados y pruebas automatizadas:
  // window.wb.store / .assets / .view permiten editar el proyecto por código.
  window.wb = { store, assets, view, exporter, interactions };
}

/* ── Barra superior ──────────────────────────────────── */

function buildTopbar(store, view, exporter, assets, repaint) {
  const bar = document.getElementById('topbar');
  const savedDot = el('span', { class: 'saved-dot', title: 'Guardado automático activo', text: '●' });
  store.on('saved', () => {
    savedDot.classList.add('flash');
    setTimeout(() => savedDot.classList.remove('flash'), 600);
  });

  const DEVICE_IC = { desktop: 'desktop', tablet: 'tablet', mobile: 'mobile' };
  const deviceButtons = el('div', { class: 'seg' }, Object.entries(DEVICES).map(([key, meta]) =>
    el('button', {
      class: `seg-btn${store.device === key ? ' active' : ''}`, html: `${ic(DEVICE_IC[key], 15)}<span>${meta.label}</span>`,
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
          if (text.includes('id="wb-project"')) {
            // HTML todo-en-uno del builder: recupera proyecto + código a mano
            data = parseProjectFromHTML(text);
          } else {
            // HTML externo cualquiera → se importa como OBJETO del lienzo
            const [asset] = await assets.importFiles([file]);
            store.addNode('htmlEmbed', { x: 120, y: 120 }, { props: { assetId: asset.id, interactive: true } });
            e.target.value = '';
            return;
          }
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
    el('div', { class: 'brand', html: `${ic('heart', 15)}<span>BuilderYNTHN<small>_M-Beta</small></span>` }),
    savedDot,
    el('div', { class: 'sep' }),
    el('button', { class: 'btn btn-ic', html: ic('undo'), title: 'Deshacer (Ctrl+Z)', onclick: () => store.undo() }),
    el('button', { class: 'btn btn-ic', html: ic('redo'), title: 'Rehacer (Ctrl+Y)', onclick: () => store.redo() }),
    el('div', { class: 'sep' }),
    deviceButtons,
    el('div', { class: 'sep' }),
    el('button', { class: 'btn btn-ic', html: ic('minus'), title: 'Alejar', onclick: () => view.zoomAt(innerWidth / 2, innerHeight / 2, 0.85) }),
    zoomLabel,
    el('button', { class: 'btn btn-ic', html: ic('plus'), title: 'Acercar', onclick: () => view.zoomAt(innerWidth / 2, innerHeight / 2, 1.18) }),
    el('button', { class: 'btn btn-ic', html: ic('fit'), title: 'Ajustar a pantalla', onclick: () => view.fit() }),
    el('div', { class: 'sep' }),
    el('button', { class: 'btn', html: `${ic('pen')}<span>Dibujar</span>`, onclick: () => store.setTool(store.tool === 'draw' ? 'select' : 'draw') }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'btn', html: `${ic('play')}<span>Vista previa</span>`, onclick: () => togglePreview(store, view, repaint, assets) }),
    el('div', { class: 'sep' }),
    fileInput,
    el('button', { class: 'btn', html: `${ic('upload')}<span>Importar</span>`, title: 'Importar proyecto (.json/.html) o página externa', onclick: () => fileInput.click() }),
    el('button', {
      class: 'btn', html: `${ic('download')}<span>Guardar</span>`, title: 'Descarga el proyecto COMPLETO (incluye tus GIFs, imágenes y vídeos)',
      onclick: () => {
        // El .json incluye los assets → el archivo es 100% autocontenido
        const data = { ...store.exportJSON(), assetsData: assets.exportData() };
        download(`${store.project.meta.name}.json`,
          new Blob([JSON.stringify(data)], { type: 'application/json' }));
      },
    }),
    el('button', {
      class: 'btn primary', html: `${ic('file')}<span>HTML (1 archivo)</span>`,
      title: 'Todo el sitio en un único archivo autocontenido: ábrelo directamente en el móvil',
      onclick: async (e) => {
        e.target.disabled = true;
        try { await exporter.exportSingle(); }
        catch (err) { alert(`Error al exportar: ${err.message}`); console.error(err); }
        e.target.disabled = false;
      },
    }),
    el('button', {
      class: 'btn primary', html: `${ic('archive')}<span>Sitio (.zip)</span>`,
      title: 'Carpeta de proyecto completa para subir a un hosting',
      onclick: async (e) => {
        e.target.disabled = true;
        try { await exporter.export(); }
        catch (err) { alert(`Error al exportar: ${err.message}`); console.error(err); }
        e.target.disabled = false;
      },
    }),
    el('button', {
      class: 'btn danger', html: `${ic('trash')}<span>Nuevo</span>`, title: 'Proyecto nuevo (borra el actual)',
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
  }, [el('span', { class: 'mn-icon', html: ic(icon, 20) }), el('span', { class: 'mn-label', text: label })]);

  // FAB estilo One UI: añadir piezas con el pulgar, siempre a mano
  const fab = el('button', {
    id: 'fab-add', title: 'Añadir elemento',
    onclick: () => {
      const wasOpen = left.classList.contains('open');
      closeAll();
      if (!wasOpen) {
        panels.openTab('componentes');
        left.classList.add('open');
        if (navigator.vibrate) navigator.vibrate(10);
      }
    },
  });
  fab.innerHTML = ic('plus', 26);
  document.body.append(fab);

  const nav = el('nav', { id: 'mobile-nav' }, [
    item('grid', 'Piezas', () => { panels.openTab('componentes'); left.classList.add('open'); }),
    item('image', 'Assets', () => { panels.openTab('assets'); left.classList.add('open'); }),
    item('music', 'Música', () => { panels.openTab('musica'); left.classList.add('open'); }),
    item('pages', 'Páginas', () => { panels.openTab('paginas'); left.classList.add('open'); }),
    item('layers', 'Capas', () => { panels.openTab('capas'); left.classList.add('open'); }),
    item('sliders', 'Diseño', () => { right.classList.add('open'); }),
  ]);
  document.body.append(nav);

  // Tocar el lienzo cierra las hojas → edición sin estorbos
  view.viewport.addEventListener('pointerdown', closeAll);
  // Entrar en la libreta de dibujo también las cierra (lienzo despejado)
  store.on('tool', () => { if (store.tool === 'draw') closeAll(); });
  // La barra rápida del lienzo abre el panel de Diseño
  document.addEventListener('wb:open-design', () => {
    if (getComputedStyle(nav).display !== 'none') { closeAll(); right.classList.add('open'); }
  });
  // Deslizar hacia abajo cierra cualquier hoja (gesto natural)
  makeSheetDismissable(left, closeAll);
  makeSheetDismissable(right, closeAll);
}

/**
 * Gesto de descarte: arrastra la hoja hacia abajo desde su parte
 * superior (asa/pestañas) y suéltala para cerrarla — con la hoja
 * siguiendo el dedo y animación de retorno si no llega al umbral.
 */
function makeSheetDismissable(sheet, close) {
  let startY = 0, delta = 0, dragging = false;
  sheet.addEventListener('pointerdown', (e) => {
    if (!sheet.classList.contains('open')) return;
    // Solo desde el tercio superior de la hoja (asa, pestañas, títulos)
    const rect = sheet.getBoundingClientRect();
    if (e.clientY - rect.top > 90) return;
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    dragging = true; startY = e.clientY; delta = 0;
    sheet.style.transition = 'none';
    try { sheet.setPointerCapture(e.pointerId); } catch { /* sintético */ }
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    delta = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${delta}px)`;
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (delta > 110) { close(); if (navigator.vibrate) navigator.vibrate(8); }
  };
  sheet.addEventListener('pointerup', finish);
  sheet.addEventListener('pointercancel', finish);
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
    // Invalida la firma de los embeds → el render incremental los
    // reconstruye con su sandbox correcto (inerte o "activo al editar")
    document.querySelectorAll('#artboard .wb-node[data-type="htmlEmbed"]').forEach((el) => { el.dataset.sig = ''; });
    repaint();
    return;
  }
  body.classList.add('preview');
  store.clearSelection();
  repaint();

  // JavaScript personalizado GLOBAL: una sola vez por sesión de vista previa
  try {
    const globalJS = store.project.custom?.js || '';
    if (globalJS.trim()) new Function(globalJS)();
  } catch (e) { console.warn('JS personalizado:', e); }

  // La página activa se vincula (efectos+acciones+animaciones) y se
  // REVINCULA al navegar entre páginas dentro de la vista previa —
  // sin esto, la página destino quedaba sin interactividad.
  let disposeBind = null;
  const bind = () => { disposeBind?.(); disposeBind = bindPreviewPage(store, view, assets); };
  bind();
  const offPage = store.on('page', () => requestAnimationFrame(bind));

  previewCleanup = () => {
    offPage();
    disposeBind?.();
    disposeBind = null;
  };
}

/**
 * Da vida a la PÁGINA ACTUAL de la vista previa: despierta los HTML
 * importados, dispara animaciones por trigger y monta los runtimes
 * compartidos. Devuelve dispose() que lo retira TODO (cero fugas y
 * cero listeners duplicados al entrar/salir/navegar).
 */
function bindPreviewPage(store, view, assets) {
  const artboard = view.artboard;
  const animations = [];

  // Los HTML importados despiertan sus scripts en vista previa.
  // Se REEMPLAZA el iframe (clon con sandbox completo): el navegador lo
  // parsea de cero con los permisos nuevos — recarga garantizada.
  artboard.querySelectorAll('.wb-embed iframe').forEach((frame) => {
    if (frame.getAttribute('sandbox')?.includes('allow-scripts')) return;
    const live = frame.cloneNode();
    live.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock');
    frame.replaceWith(live);
  });

  // Animaciones por trigger (WAAPI, igual comportamiento que el CSS exportado).
  // TODOS los listeners y observers se registran para retirarse al salir:
  // los elementos sobreviven a la vista previa (render incremental) y sin
  // esta limpieza cada entrada/salida DUPLICABA los eventos.
  const bound = [];   // [elemento, evento, manejador]
  const scrollIOs = [];
  const listen = (target, ev, fn) => { target.addEventListener(ev, fn); bound.push([target, ev, fn]); };
  for (const node of store.pageNodes()) {
    const elem = artboard.querySelector(`[data-id="${node.id}"]`);
    if (!elem) continue;
    const anim = node.animation;
    // Dispara el preset (WAAPI) o la animación CSS propia del usuario
    const fire = () => {
      if (anim.custom) {
        elem.style.animation = 'none'; void elem.offsetWidth;
        elem.style.animation = anim.custom;
      } else {
        animations.push(playAnimation(elem, anim));
      }
    };
    if (anim && (anim.custom || (anim.preset && anim.preset !== 'ninguna'))) {
      if (anim.trigger === 'load') fire();
      else if (anim.trigger === 'click') listen(elem, 'click', fire);
      else if (anim.trigger === 'hover') listen(elem, 'mouseenter', fire);
      else if (anim.trigger === 'hold') {
        let holdTimer = null;
        listen(elem, 'pointerdown', () => { holdTimer = setTimeout(fire, 550); });
        ['pointerup', 'pointerleave'].forEach((ev) => listen(elem, ev, () => clearTimeout(holdTimer)));
      }
      else if (anim.trigger === 'scroll') {
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { fire(); io.disconnect(); }
        }, { threshold: 0.25 });
        io.observe(elem);
        scrollIOs.push(io);
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
    pageOrder: () => store.project.pages.map((p) => p.id),
    currentPage: () => store.pageId,
    playAnim: (id, targetEl) => {
      const targetNode = store.node(id);
      if (targetEl && targetNode) playAnimation(targetEl, targetNode.animation);
    },
    // Salida animada en vista previa (WAAPI, mismos presets que el export)
    playExit: (targetEl, done) => {
      const targetNode = store.node(targetEl.dataset.id);
      const anim = targetNode && playExitAnimation(targetEl, targetNode.animationOut);
      if (!anim) return false;
      anim.finished.then(() => { done(); anim.cancel(); }).catch(done);
      return true;
    },
  });

  // JavaScript personalizado DE ESTA PÁGINA en un sandbox try/catch
  try {
    const pageJS = store.page.custom?.js || '';
    if (pageJS.trim()) new Function(pageJS)();
  } catch (e) { console.warn('JS de la página:', e); }

  return () => {
    animations.forEach((a) => a?.cancel());
    bound.forEach(([target, ev, fn]) => target.removeEventListener(ev, fn));
    scrollIOs.forEach((io) => io.disconnect());
    disposeEffects();
    disposeActions();
    // Estilos de animación CSS propia que quedaron aplicados en línea
    artboard.querySelectorAll('.wb-node[style*="animation"]').forEach((n) => { n.style.animation = ''; });
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
