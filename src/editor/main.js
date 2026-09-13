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
  // Tema y paleta elegidos por el usuario (se recuerdan entre sesiones)
  const tema = localStorage.getItem('wb-theme');
  const paleta = localStorage.getItem('wb-palette');
  if (tema) document.body.dataset.theme = tema;
  if (paleta) document.body.dataset.palette = paleta;

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

  // Frecuencia de refresco configurable (30–240 Hz, 0 = auto/vsync):
  // los runtimes WebGL la leen de window.WB_FPS en cada frame.
  const syncFps = () => { window.WB_FPS = store.project.settings.fps || 0; };
  store.on('change', syncFps);
  syncFps();

  // Modo Pixel Art por página: nearest-neighbor en todo el lienzo
  const syncPixelArt = () => document.getElementById('artboard').classList.toggle('pixel-art', !!store.page.pixelArt);
  store.on('change', syncPixelArt);
  store.on('page', syncPixelArt);
  syncPixelArt();

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
  store.on('page', () => {
    three.disposeAll();
    view.fit();
    // Transición suave entre páginas: el lienzo entra con un fundido
    // ascendente (solo opacity/transform → composición GPU, sin repintados)
    view.artboard.animate(
      [{ opacity: 0.35, transform: 'translateY(12px) scale(.992)' }, { opacity: 1, transform: 'none' }],
      { duration: 280, easing: 'cubic-bezier(.2,.8,.25,1)' },
    );
  });

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

/**
 * BARRA SUPERIOR — arriba solo vive lo que se toca a cada minuto
 * (deshacer, rehacer, zoom y Vista previa). TODO lo demás está a un
 * toque en la hoja "Más", al alcance del pulgar. Una sola definición
 * de acciones, un solo destino: no hay variante de escritorio.
 */
function buildTopbar(store, view, exporter, assets, repaint) {
  const bar = document.getElementById('topbar');
  const savedDot = el('span', { class: 'saved-dot', title: 'Guardado automático activo', text: '●' });
  store.on('saved', () => {
    savedDot.classList.add('flash');
    setTimeout(() => savedDot.classList.remove('flash'), 600);
  });

  /* Tamaño del proyecto que se está creando: base, tablet o móvil. */
  const DEVICE_IC = { desktop: 'heart', tablet: 'tablet', mobile: 'mobile' };
  const deviceSeg = () => {
    const seg = el('div', { class: 'seg' }, Object.entries(DEVICES).map(([key, meta]) =>
      el('button', {
        class: `seg-btn${store.device === key ? ' active' : ''}`,
        html: `${ic(DEVICE_IC[key])}<span>${meta.label}</span>`,
        dataset: { device: key },
        title: `${meta.width}px`,
        onclick: () => store.setDevice(key),
      })));
    store.on('device', () => seg.querySelectorAll('.seg-btn').forEach((btn) =>
      btn.classList.toggle('active', btn.dataset.device === store.device)));
    return seg;
  };

  /* El zoom flota sobre el lienzo, no en la barra: arriba el ancho es
     oro y aquí se lee igual de bien. Tocarlo ajusta a pantalla. */
  const zoomLabel = el('button', {
    class: 'zoom-label', text: '100%', title: 'Ajustar a pantalla',
    onclick: () => view.fit(),
  });
  document.getElementById('stage-area').append(zoomLabel);
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

  /* Acciones de proyecto: mismas funciones, dos presentaciones */
  const guard = async (btn, run, verbo) => {
    btn.disabled = true;
    try { await run(); }
    catch (err) { alert(`Error al ${verbo}: ${err.message}`); console.error(err); }
    btn.disabled = false;
  };
  const PROJECT_ACTIONS = [
    {
      icon: 'pen', label: 'Dibujar', title: 'Libreta de dibujo a mano alzada',
      run: () => store.setTool(store.tool === 'draw' ? 'select' : 'draw'),
    },
    {
      icon: 'upload', label: 'Importar', title: 'Importar proyecto (.json/.html) o página externa',
      run: () => fileInput.click(),
    },
    {
      icon: 'download', label: 'Guardar', title: 'Descarga el proyecto COMPLETO (incluye tus GIFs, imágenes y vídeos)',
      run: () => {
        // El .json incluye los assets → el archivo es 100% autocontenido
        const data = { ...store.exportJSON(), assetsData: assets.exportData() };
        download(`${store.project.meta.name}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
      },
    },
    {
      icon: 'file', label: 'HTML (1 archivo)', cls: 'primary',
      title: 'Todo el sitio en un único archivo autocontenido: ábrelo directamente en el móvil',
      run: (btn) => guard(btn, () => exporter.exportSingle(), 'exportar'),
    },
    {
      icon: 'archive', label: 'Sitio (.zip)', cls: 'primary',
      title: 'Carpeta de proyecto completa para subir a un hosting',
      run: (btn) => guard(btn, () => exporter.export(), 'exportar'),
    },
    {
      icon: 'trash', label: 'Nuevo', cls: 'danger', title: 'Proyecto nuevo (borra el actual)',
      run: () => {
        if (!confirm('¿Empezar un proyecto nuevo? El actual se descartará.')) return;
        const template = confirm('¿Empezar con la plantilla de ejemplo?\n(Aceptar = plantilla · Cancelar = lienzo en blanco)');
        store.reset(!template);
      },
    },
  ];
  const actionButton = (a, withLabel) => el('button', {
    class: `btn${a.cls ? ` ${a.cls}` : ''}${withLabel ? ' block' : ''}`,
    html: `${ic(a.icon)}<span>${a.label}</span>`,
    title: a.title,
    onclick: (e) => {
      a.run(e.currentTarget);
      // Elegida la acción, el menú sobra: deja ver lo que acaba de pasar
      document.dispatchEvent(new CustomEvent('wb:close-sheets'));
    },
  });

  /* Menú "Más": hoja inferior con todo lo que no cabe en el teléfono */
  const menuSheet = el('aside', { id: 'menu-sheet', class: 'sheet' }, [
    el('h3', { class: 'sheet-title', text: 'Proyecto' }),
    el('div', { class: 'sheet-body' }, [
      el('h4', { class: 'panel-heading', text: 'Vista del lienzo' }),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', html: `${ic('minus')}<span>Alejar</span>`, title: 'Alejar',
          onclick: () => view.zoomAt(innerWidth / 2, innerHeight / 2, 0.85) }),
        el('button', { class: 'btn', html: `${ic('plus')}<span>Acercar</span>`, title: 'Acercar',
          onclick: () => view.zoomAt(innerWidth / 2, innerHeight / 2, 1.18) }),
        el('button', { class: 'btn', html: `${ic('fit')}<span>Ajustar</span>`, title: 'Ajustar a pantalla',
          onclick: () => view.fit() }),
      ]),
      el('h4', { class: 'panel-heading', text: 'Tamaño del proyecto' }),
      deviceSeg(),
      el('h4', { class: 'panel-heading', text: 'Herramientas' }),
      ...PROJECT_ACTIONS.map((a) => actionButton(a, true)),
    ]),
  ]);
  document.body.append(menuSheet);
  const closeMenu = () => { menuSheet.classList.remove('open'); document.body.classList.remove('sheet-open'); };
  makeSheetDismissable(menuSheet, closeMenu);
  document.addEventListener('wb:close-sheets', closeMenu);

  bar.append(
    el('div', { class: 'brand', html: ic('heart'), title: 'BuilderYNTHN_M-Beta' }),
    savedDot,
    el('button', { class: 'btn btn-ic', html: ic('undo'), title: 'Deshacer', onclick: () => store.undo() }),
    el('button', { class: 'btn btn-ic', html: ic('redo'), title: 'Rehacer', onclick: () => store.redo() }),
    fileInput,
    el('span', { class: 'spacer' }),
    el('button', {
      class: 'btn primary', title: 'Ver la página como la verá ella',
      html: `${ic('play')}<span class="lbl">Previa</span>`,
      onclick: () => togglePreview(store, view, repaint, assets),
    }),
    el('button', {
      class: 'btn btn-ic', html: ic('more'), title: 'Más opciones del proyecto',
      onclick: () => {
        const abierta = menuSheet.classList.contains('open');
        document.dispatchEvent(new CustomEvent('wb:close-sheets'));
        if (!abierta) {
          menuSheet.classList.add('open');
          document.body.classList.add('sheet-open');
          if (navigator.vibrate) navigator.vibrate(8);
        }
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
 * Los paneles son HOJAS DESLIZANTES (bottom sheets) gobernadas por
 * esta barra inferior: el lienzo se queda con toda la pantalla y cada
 * herramienta aparece cuando hace falta, al alcance del pulgar.
 */
function buildMobileNav(store, panels, view) {
  const left = document.getElementById('left-panel');
  const right = document.getElementById('right-panel');

  const closeAll = () => {
    left.classList.remove('open');
    right.classList.remove('open');
    nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    document.body.classList.remove('sheet-open');
  };
  // Cualquier hoja que se abra cierra las demás (una sola capa a la vez)
  document.addEventListener('wb:close-sheets', closeAll);
  const openSheet = (panel) => {
    document.dispatchEvent(new CustomEvent('wb:close-sheets'));
    panel.classList.add('open');
    document.body.classList.add('sheet-open');
  };

  const item = (icon, label, open) => el('button', {
    title: label, 'aria-label': label,
    onclick: (e) => {
      const btn = e.currentTarget;
      const wasActive = btn.classList.contains('active');
      closeAll();
      if (!wasActive) { open(); btn.classList.add('active'); if (navigator.vibrate) navigator.vibrate(6); }
    },
  }, [el('span', { class: 'mn-icon', html: ic(icon, 21) }), el('span', { class: 'mn-label', text: label })]);

  // FAB estilo One UI: añadir piezas con el pulgar, siempre a mano
  const fab = el('button', {
    id: 'fab-add', title: 'Añadir elemento',
    onclick: () => {
      const wasOpen = left.classList.contains('open');
      closeAll();
      if (!wasOpen) {
        panels.openTab('componentes');
        openSheet(left);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    },
  });
  fab.innerHTML = ic('plus', 26);
  document.body.append(fab);

  const nav = el('nav', { id: 'mobile-nav' }, [
    item('grid', 'Piezas', () => { panels.openTab('componentes'); openSheet(left); }),
    item('image', 'Assets', () => { panels.openTab('assets'); openSheet(left); }),
    item('music', 'Música', () => { panels.openTab('musica'); openSheet(left); }),
    item('pages', 'Páginas', () => { panels.openTab('paginas'); openSheet(left); }),
    item('layers', 'Capas', () => { panels.openTab('capas'); openSheet(left); }),
    item('sliders', 'Diseño', () => { openSheet(right); }),
  ]);
  document.body.append(nav);

  // Con algo seleccionado manda la barra contextual: el FAB se aparta
  store.on('selection', () => document.body.classList.toggle('has-selection', store.selection.length > 0));

  /* Cerrar significa CERRAR TODO — paneles y hoja "Más". Antes esto
     llamaba a closeAll(), que solo conoce los paneles: al entrar en la
     libreta desde "Más", la hoja se quedaba tapando el lienzo. */
  const cerrarTodo = () => document.dispatchEvent(new CustomEvent('wb:close-sheets'));
  // Tocar el lienzo cierra las hojas → edición sin estorbos
  view.viewport.addEventListener('pointerdown', cerrarTodo);
  // Entrar en la libreta de dibujo también las cierra (lienzo despejado)
  store.on('tool', () => { if (store.tool === 'draw') cerrarTodo(); });
  // La barra rápida del lienzo abre el panel de Diseño
  document.addEventListener('wb:open-design', () => {
    if (getComputedStyle(nav).display !== 'none') { openSheet(right); }
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
    // Solo el desplazamiento vertical. Escribir `transform` entero
    // borraba el centrado horizontal de la hoja en tablet y saltaba
    // media pantalla a la derecha en mitad del gesto.
    sheet.style.setProperty('--arrastre', `${delta}px`);
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.removeProperty('--arrastre');
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
  // Crossfade editor ↔ vista previa: sin cortes bruscos (solo opacity, GPU)
  const crossfade = () => document.getElementById('viewport')?.animate(
    [{ opacity: 0.45 }, { opacity: 1 }],
    { duration: 240, easing: 'ease-out' },
  );
  if (body.classList.contains('preview')) {
    body.classList.remove('preview');
    previewCleanup?.();
    previewCleanup = null;
    // Invalida la firma de los embeds → el render incremental los
    // reconstruye con su sandbox correcto (inerte o "activo al editar")
    document.querySelectorAll('#artboard .wb-node[data-type="htmlEmbed"]').forEach((el) => { el.dataset.sig = ''; });
    repaint();
    crossfade();
    return;
  }
  body.classList.add('preview');
  store.clearSelection();
  repaint();
  crossfade();

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
