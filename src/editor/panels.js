/* ============================================================
 * editor/panels.js — Panel izquierdo del editor
 *
 * Cuatro pestañas: Componentes · Assets · Páginas · Capas.
 * - Componentes: drag-and-drop HTML5 al lienzo + clic para
 *   insertar en el centro (soporte táctil).
 * - Assets: subida desde galería/disco (input file + drop),
 *   búsqueda, filtro por tipo, arrastre al lienzo.
 * - Páginas: crear, renombrar, duplicar, ordenar, transición.
 * - Capas: z-order, bloquear, ocultar, eliminar.
 * ============================================================ */

import { el, formatBytes, debounce, showSnack, poner } from '../utils/helpers.js';
import { confirmar, preguntar, avisar } from '../utils/dialogo.js';
import { makeSheetDismissable } from './bottomSheet.js';
import { ic, typeIcon, BLOCK_ICONS } from './icons.js';
import { Components, CATEGORIES } from '../components/registry.js';
import { BLOCKS, THEMES } from '../storage/templates.js';
import { DEVICES } from '../storage/projectStore.js';
import { ASSET_KINDS, ACCEPT_ATTR } from '../assets/assetManager.js';
import { MUSIC_TRACKS, trackURL } from '../config/musicLibrary.js';
import { MY_3D } from '../../contenido/3d/index.js';
import { MY_WIDGETS } from '../../contenido/widgets/index.js';

/**
 * Desliza una fila hacia la IZQUIERDA para eliminarla (táctil, estilo iOS):
 * a partir del 42 % del ancho la franja roja confirma; al soltar, la fila
 * sale animada y se llama a onDelete. El scroll vertical nunca se bloquea
 * (solo activamos el gesto cuando el movimiento es claramente horizontal).
 */
function enableSwipeDelete(row, onDelete) {
  let sx = 0, sy = 0, dx = 0, active = false, pid = null, justSwiped = false;
  row.classList.add('swipeable');
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    sx = e.clientX; sy = e.clientY; dx = 0; active = false; pid = e.pointerId;
  });
  row.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!active) {
      if (Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.4) {
        active = true;
        row.classList.add('swiping');
        try { row.setPointerCapture(pid); } catch { /* puntero sintético */ }
      } else if (Math.abs(my) > 12) { pid = null; return; } // el scroll vertical gana
      else return;
    }
    dx = Math.min(0, mx); // solo hacia la izquierda
    row.style.transform = `translateX(${dx}px)`;
    row.classList.toggle('will-delete', -dx > row.offsetWidth * 0.42);
    e.preventDefault();
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (!active) return;
    active = false;
    justSwiped = true;
    setTimeout(() => { justSwiped = false; }, 350);
    row.classList.remove('swiping');
    if (-dx > row.offsetWidth * 0.42) {
      row.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
      row.style.transform = 'translateX(-105%)';
      row.style.opacity = '0';
      if (navigator.vibrate) navigator.vibrate(18);
      setTimeout(onDelete, 170);
    } else {
      row.style.transition = 'transform .28s cubic-bezier(.2,.8,.25,1)';
      row.style.transform = '';
      row.classList.remove('will-delete');
      setTimeout(() => { row.style.transition = ''; }, 300);
    }
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
  // Un deslizamiento no debe disparar el clic de la fila al soltar
  row.addEventListener('click', (e) => {
    if (justSwiped) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  return row;
}

/** Nombre presentable de cada carpeta de la biblioteca. */
const NOMBRE_CARPETA = {
  images: 'Imágenes', gifs: 'GIFs', videos: 'Vídeos', audio: 'Audio',
  models: 'Modelos 3D', fonts: 'Fuentes', html: 'Páginas HTML',
  'online assets': 'Traídos de internet',
};

export class Panels {
  constructor(store, assets, view) {
    this.store = store;
    this.assets = assets;
    this.view = view;
    this.root = document.getElementById('left-panel');
    this.tab = 'componentes';
    this.assetFilter = { kind: null, query: '' };

    this.scheduleRender = debounce(() => this.render(), 120);
    store.on('change', () => { if (this.tab === 'capas' || this.tab === 'paginas') this.scheduleRender(); });
    store.on('page', () => this.render());
    store.on('selection', () => { if (this.tab === 'capas') this.render(); });
    assets.on('change', () => { if (this.tab === 'assets') this.render(); });

    this.#setupCanvasDrop();
    this.render();
  }

  /** Abre una pestaña concreta (usado por la barra móvil). */
  openTab(name) {
    this.tab = name;
    this.render();
  }

  render() {
    this.root.innerHTML = '';
    const tabs = el('div', { class: 'panel-tabs' }, ['componentes', 'assets', 'musica', 'paginas', 'capas'].map((name) =>
      el('button', {
        class: `tab-btn${this.tab === name ? ' active' : ''}`,
        text: { componentes: 'Piezas', assets: 'Assets', musica: 'Música', paginas: 'Páginas', capas: 'Capas' }[name],
        title: { componentes: 'Piezas y bloques', assets: 'Biblioteca de recursos', musica: 'Música del proyecto', paginas: 'Páginas y ajustes', capas: 'Capas de la página' }[name],
        onclick: () => { this.tab = name; this.render(); },
      })));
    poner(this.root, tabs);
    const body = el('div', { class: 'panel-body' });
    poner(this.root, body);
    ({
      componentes: () => this.#renderComponents(body),
      assets: () => this.#renderAssets(body),
      musica: () => this.#renderMusic(body),
      paginas: () => this.#renderPages(body),
      capas: () => this.#renderLayers(body),
    })[this.tab]();
    // Entrada suave SOLO al cambiar de pestaña (no en cada refresco,
    // que parpadearía): fundido ascendente compuesto en GPU.
    if (this.lastTab !== this.tab) {
      this.lastTab = this.tab;
      body.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 200, easing: 'cubic-bezier(.2,.8,.25,1)' },
      );
    }
  }

  /* ── Paleta de componentes ─────────────────────────── */

  #renderComponents(body) {
    // Buscador de piezas: filtra bloques, estilos y componentes al escribir
    const pq = (this.pieceQuery || '').toLowerCase();
    poner(body, el('input', {
      class: 'input block', type: 'search', placeholder: 'Buscar pieza, bloque o estilo…', value: this.pieceQuery || '',
      oninput: (e) => { this.pieceQuery = e.target.value; this.render(); },
    }));
    const match = (label) => !pq || label.toLowerCase().includes(pq);

    /* ── Estilos de proyecto ───────────────────────────────
       Dos, y cada uno se enseña como lo que es: una miniatura con
       sus colores, su tipografía y su forma de botón. Se elige
       mirando la estética, no leyendo un nombre. */
    const themeEntries = Object.entries(THEMES).filter(([, t]) => match(t.label));
    if (themeEntries.length) {
      poner(body, el('h4', { class: 'panel-heading', text: 'Estilos de proyecto' }));
      const rejilla = el('div', { class: 'estilo-grid' });
      for (const [key, theme] of themeEntries) {
        const v = theme.vista || {};
        rejilla.append(el('button', {
          class: `estilo-card estilo-${key}`,
          title: `${theme.label}: ${theme.nota || ''}`.trim(),
          onclick: () => this.#applyTheme(key),
        }, [
          // Miniatura: el estilo dibujado en pequeño, con sus colores
          el('span', { class: 'estilo-vista', style: { background: v.fondo || '#222' } }, [
            el('span', {
              class: 'estilo-tarjeta',
              style: {
                background: v.tarjeta || 'rgba(255,255,255,.1)',
                borderColor: v.borde || 'transparent',
                borderRadius: `${v.radio ?? 12}px`,
              },
            }, [
              el('span', { class: 'estilo-titulo', style: { background: v.titulo, fontFamily: v.tipo } }),
              el('span', { class: 'estilo-texto', style: { background: v.texto } }),
              el('span', { class: 'estilo-boton', style: { background: v.boton, borderRadius: `${Math.min(v.radio ?? 12, 10)}px` } }),
            ]),
          ]),
          el('span', { class: 'estilo-pie' }, [
            el('strong', { class: 'estilo-nombre', text: theme.label }),
            el('span', { class: 'estilo-nota', text: theme.nota || '' }),
          ]),
        ]));
      }
      poner(body, rejilla);
    }

    // Bloques prediseñados: secciones completas listas para usar
    const blockEntries = Object.entries(BLOCKS).filter(([, b]) => match(b.label));
    if (blockEntries.length) {
      poner(body, el('h4', { class: 'panel-heading', text: 'Bloques prediseñados' }));
      // En dos columnas: una fila por bloque dejaba media hoja vacía
      // y obligaba a recorrer una lista larguísima.
      const blockList = el('div', { class: 'block-grid' });
      for (const [key, block] of blockEntries) {
        blockList.append(el('button', {
          class: 'block-item', title: 'Añade esta sección al final de la página',
          onclick: () => this.store.addBlock(key),
        }, [
          el('span', { class: 'palette-icon', html: ic(BLOCK_ICONS[key] || 'sparkles') }),
          el('span', { class: 'block-lbl', text: block.label }),
        ]));
      }
      poner(body, blockList);
    }

    /* Tus carpetas de contenido: 3D y widgets propios */
    if (MY_3D.length) {
      poner(body, el('h4', { class: 'panel-heading', text: 'Mis 3D (contenido/3d)' }));
      const grid3d = el('div', { class: 'palette-grid' });
      for (const item of MY_3D) {
        grid3d.append(el('div', {
          class: 'palette-item', title: 'Escena 3D propia — arrastra o toca',
          onclick: () => this.store.addNode('custom3D', { x: 200, y: 160 }, {
            name: item.name, props: { code: item.code, cameraZ: 4 },
          }),
        }, [el('span', { class: 'palette-icon', html: ic('cube') }), el('span', { text: item.name })]));
      }
      poner(body, grid3d);
    }
    if (MY_WIDGETS.length) {
      poner(body, el('h4', { class: 'panel-heading', text: 'Mis widgets (contenido/widgets)' }));
      const gridw = el('div', { class: 'palette-grid' });
      for (const widget of MY_WIDGETS) {
        gridw.append(el('div', {
          class: 'palette-item', title: 'Widget propio — arrastra o toca',
          onclick: () => this.store.addNode('customHTML', {
            x: 160, y: 160, w: widget.width || 340, h: widget.height || 220,
          }, { name: widget.name, props: { html: widget.html || '', css: widget.css || '', js: widget.js || '' } }),
        }, [el('span', { class: 'palette-icon', html: ic('wand') }), el('span', { text: widget.name })]));
      }
      poner(body, gridw);
    }

    for (const cat of CATEGORIES) {
      const entries = Object.entries(Components).filter(([, def]) => def.cat === cat && match(def.label));
      if (!entries.length) continue;
      poner(body, el('h4', { class: 'panel-heading', text: cat }));
      const grid = el('div', { class: 'palette-grid' });
      for (const [type, def] of entries) {
        const item = el('div', {
          class: 'palette-item', draggable: 'true', title: `Arrastra al lienzo o haz clic`,
          ondragstart: (e) => e.dataTransfer.setData('application/x-wb-component', type),
          onclick: () => this.#addAtCenter(type),
        }, [el('span', { class: 'palette-icon', html: typeIcon(type) }), el('span', { text: def.label })]);
        poner(grid, item);
      }
      poner(body, grid);
    }
    poner(body, el('p', { class: 'panel-hint', text: 'También puedes arrastrar archivos de tu galería directamente sobre el lienzo.' }));
  }

  /** Aplica un ESTILO DE PROYECTO: fondo de página + portada temática. */
  #applyTheme(key) {
    const theme = THEMES[key];
    if (!theme) return;
    this.store.snapshot('theme');
    const page = this.store.page;
    page.background = theme.pageBg;
    if (theme.pixelArt != null) page.pixelArt = theme.pixelArt;
    // La portada del estilo se añade al final (o al inicio si está vacía)
    const startY = page.nodes.length ? page.height : 0;
    const block = theme.build(startY);
    for (const n of block.nodes) {
      this.store.project.nodes[n.id] = n;
      page.nodes.push(n.id);
    }
    page.height = startY + block.height;
    this.store.commit();
  }

  #addAtCenter(type) {
    const width = this.store.project.settings.breakpoints[this.store.device];
    const def = Components[type];
    // Cascada: cada inserción se desplaza para no apilarse sobre la anterior
    const cascade = (this.store.pageNodes().length % 8) * 28;
    this.store.addNode(type, {
      x: Math.max(20, Math.round((width - def.size[0]) / 2) + cascade),
      y: Math.max(20, Math.round(this.store.page.height / 3) + cascade),
    });
  }

  /* ── Biblioteca de assets ──────────────────────────── */

  #renderAssets(body) {
    const input = el('input', {
      type: 'file', multiple: 'true', accept: ACCEPT_ATTR, style: { display: 'none' },
      onchange: async (e) => {
        const archivos = [...e.target.files];
        e.target.value = '';
        if (!archivos.length) return;
        // Subir varias fotos grandes tarda: se dice por dónde va y,
        // si alguna falla, se cuenta cuál en vez de callar.
        const aviso = showSnack(`Subiendo 0 de ${archivos.length}…`, null, null, 0);
        const hechos = await this.assets.importFiles(archivos, {
          alProgreso: (n, total) => aviso?.actualizar(`Subiendo ${n} de ${total}…`),
        });
        aviso?.cerrar();
        const fallos = hechos.fallos || [];
        if (fallos.length) {
          showSnack(`${hechos.length} subido(s) · no se pudo con ${fallos.length}`, 'Ver', () => avisar({
            titulo: 'Archivos que no entraron',
            texto: fallos.join('\n'),
          }));
        } else if (hechos.length) {
          showSnack(`${hechos.length} recurso${hechos.length === 1 ? '' : 's'} en la biblioteca`);
        }
      },
    });

    /* ── Online assets: recursos por URL, cacheados como locales ──
       Va PLEGADO al final: es una acción puntual, no debe empujar la
       biblioteca (lo importante) fuera de la primera pantalla. */
    const urlInput = el('input', {
      class: 'input', type: 'url', placeholder: 'https://…/foto.png, .gif, .mp3, .mp4, .svg',
    });
    const estado = el('p', { class: 'panel-hint', text: 'Se descargan una vez y quedan en la carpeta "online assets": se usan igual que los tuyos y funcionan sin conexión.' });
    const traer = async (btn) => {
      const url = urlInput.value.trim();
      if (!url) return;
      btn.disabled = true;
      estado.textContent = 'Descargando…';
      try {
        const asset = await this.assets.addRemote(url);
        urlInput.value = '';
        estado.textContent = `Listo: ${asset.name} (${formatBytes(asset.size)})`;
      } catch (err) { estado.textContent = err.message; }
      btn.disabled = false;
    };
    const onlineBlock = el('details', { class: 'props-section online-block' }, [
      el('summary', { text: 'Añadir desde una URL (online)' }),
      el('div', { class: 'props-section-body' }, [
        urlInput,
        el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn primary', html: `${ic('globe')}<span>Traer</span>`, onclick: (e) => traer(e.currentTarget) }),
          el('button', {
            class: 'btn', html: `${ic('redo')}<span>Actualizar</span>`,
            title: 'Vuelve a descargar los recursos online por si cambiaron',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              estado.textContent = 'Actualizando…';
              const { total, fallos } = await this.assets.refreshRemotes();
              estado.textContent = total === 0 ? 'Todavía no hay recursos online.'
                : fallos.length ? `Actualizados ${total - fallos.length}/${total}. ${fallos[0]}`
                  : `${total} recurso(s) al día.`;
              e.currentTarget.disabled = false;
            },
          }),
        ]),
        estado,
      ]),
    ]);

    const total = this.assets.list({}).length;
    poner(body, 
      input,
      el('div', { class: 'btn-row' }, [
        el('button', {
          class: 'btn primary', html: `${ic('upload')}<span>Subir</span>`,
          title: 'Fotos, GIFs, vídeos, audio, modelos o fuentes desde tu galería',
          onclick: () => input.click(),
        }),
        el('button', {
          class: 'btn', html: `${ic('globe')}<span>Desde URL</span>`,
          title: 'Traer un recurso de internet',
          onclick: () => { onlineBlock.open = true; onlineBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); urlInput.focus(); },
        }),
      ]),
      el('input', {
        class: 'input block', type: 'search', placeholder: 'Buscar por nombre o etiqueta…',
        value: this.assetFilter.query,
        oninput: (e) => { this.assetFilter.query = e.target.value; this.#renderAssetGrid(); },
      }),
      // Filtros en UNA fila deslizable: tres filas de chips empujaban la
      // biblioteca fuera de la pantalla.
      el('div', { class: 'chip-row scroll-x' }, [
        el('button', { class: `chip${!this.assetFilter.kind ? ' active' : ''}`, text: 'Todo', onclick: () => { this.assetFilter.kind = null; this.render(); } }),
        ...Object.entries(ASSET_KINDS).filter(([k]) => k !== 'svg').map(([kind, meta]) =>
          el('button', {
            class: `chip${this.assetFilter.kind === kind ? ' active' : ''}`,
            html: `${ic({ image: 'image', gif: 'film', video: 'video', audio: 'music', model: 'cube', font: 'type', html: 'globe' }[kind] || 'file', 14)}<span>${meta.label}</span>`,
            title: meta.label,
            onclick: () => { this.assetFilter.kind = kind; this.render(); },
          })),
      ]),
    );

    // La biblioteca, lo primero que se ve
    this.assetGrid = el('div', { class: 'asset-grid' });
    poner(body, this.assetGrid);
    this.#renderAssetGrid();
    poner(body, 
      total ? el('p', { class: 'panel-hint', text: `${total} recurso${total === 1 ? '' : 's'} en el proyecto. Toca uno para usarlo; arrástralo para colocarlo donde quieras.` })
        : el('p', { class: 'panel-hint', text: 'Arrastra archivos de tu galería directamente sobre el lienzo, o usa los botones de arriba.' }),
      onlineBlock,
    );
  }

  /** Los assets que YA se usan en la página abierta. */
  #assetsEnUso() {
    const usados = new Set();
    for (const n of this.store.pageNodes()) {
      const p = n.props || {};
      if (p.assetId) usados.add(p.assetId);
      if (Array.isArray(p.assetIds)) p.assetIds.forEach((id) => usados.add(id));
    }
    return usados;
  }

  /**
   * Rejilla de la biblioteca, agrupada por carpeta.
   *
   * En un móvil no hay `hover`, así que el atributo `title` no lo lee
   * nadie: el tipo, el peso y si el recurso ya está puesto en la
   * página van IMPRESOS en la tarjeta.
   */
  #renderAssetGrid() {
    const grid = this.assetGrid;
    grid.innerHTML = '';
    const list = this.assets.list(this.assetFilter);
    if (!list.length) {
      poner(grid, el('p', {
        class: 'panel-hint',
        text: this.assetFilter.query || this.assetFilter.kind
          ? 'Nada con ese filtro. Prueba con "Todo".'
          : 'Sin assets todavía. Sube imágenes, GIFs, vídeos, audio o modelos GLB.',
      }));
      return;
    }
    const usados = this.#assetsEnUso();
    const ICONO_TIPO = { audio: 'music', model: 'cube', font: 'type', html: 'globe', video: 'video', gif: 'film' };

    // Agrupado por carpeta: "online assets" y lo que tú organices
    const carpetas = new Map();
    for (const asset of list) {
      const clave = asset.folder || 'otros';
      if (!carpetas.has(clave)) carpetas.set(clave, []);
      carpetas.get(clave).push(asset);
    }

    for (const [carpeta, recursos] of carpetas) {
      if (carpetas.size > 1) {
        const nombre = NOMBRE_CARPETA[carpeta] || carpeta;
        poner(grid, el('h5', { class: 'asset-carpeta', text: `${nombre} · ${recursos.length}` }));
      }
      for (const asset of recursos) {
        const kind = asset.kind;
        // Si el archivo está roto, la tarjeta lo DICE en vez de dejar
        // un hueco blanco que parece un fallo del editor.
        const roto = (e) => {
          const t = e.currentTarget;
          t.replaceWith(el('div', { class: 'asset-thumb kind-icon roto', html: ic('close'), title: 'No se pudo leer este archivo' }));
        };
        const preview = kind === 'video'
          ? el('video', { src: asset.data, muted: 'true', class: 'asset-thumb', onerror: roto })
          : ['image', 'gif', 'svg'].includes(kind)
            ? el('img', { src: asset.data, class: 'asset-thumb', draggable: 'false', loading: 'lazy', decoding: 'async', onerror: roto })
            : el('div', { class: 'asset-thumb kind-icon', html: ic(ICONO_TIPO[kind] || 'file') });

        poner(grid, el('div', {
          class: `asset-card${asset.remote ? ' remote' : ''}${usados.has(asset.id) ? ' en-uso' : ''}`,
          draggable: 'true',
          ondragstart: (e) => e.dataTransfer.setData('application/x-wb-asset', asset.id),
          // Mantener pulsado abre la ficha; un toque normal lo usa
          onpointerdown: (e) => this.#armarFicha(e, asset),
          oncontextmenu: (e) => { e.preventDefault(); this.#abrirFichaAsset(asset); },
          onclick: () => {
            // Tras abrir la ficha el navegador suele lanzar un clic de
            // propina. Se descarta por TIEMPO, no con un testigo: un
            // testigo que nadie consuma se queda pegado y se come el
            // siguiente toque de verdad.
            if (performance.now() - (this.fichaDesde || 0) < 600) return;
            this.#useAsset(asset);
            if (navigator.vibrate) navigator.vibrate(8);
          },
        }, [
          el('span', { class: 'asset-marco' }, [
            preview,
            // Una imagen ya se ve que es una imagen: la etiqueta solo
            // aparece cuando la miniatura no cuenta la historia entera.
            ['image', 'svg'].includes(kind)
              ? null
              : el('span', { class: 'asset-tipo', text: (ASSET_KINDS[kind]?.label || kind).toUpperCase() }),
            usados.has(asset.id) ? el('span', { class: 'asset-usado', html: ic('check'), title: 'Ya está en esta página' }) : null,
          ].filter(Boolean)),
          el('span', { class: 'asset-pie' }, [
            el('span', { class: 'asset-name', text: asset.name }),
            el('span', { class: 'asset-peso', text: formatBytes(asset.size) }),
          ]),
          el('button', {
            class: 'asset-del', html: ic('close'), title: 'Eliminar asset',
            onclick: async (e) => {
              e.stopPropagation();
              const fuera = await confirmar({
                titulo: `¿Eliminar "${asset.name}"?`,
                texto: 'Las piezas que lo estén usando se quedarán sin él.',
                aceptar: 'Eliminar', peligro: true,
              });
              if (fuera) this.assets.remove(asset.id);
            },
          }),
        ]));
      }
    }
  }

  /** Pulsación larga (450 ms sin moverse) sobre una tarjeta → ficha. */
  #armarFicha(e, asset) {
    if (e.pointerType === 'mouse') return;          // con ratón, clic derecho
    const x0 = e.clientX, y0 = e.clientY;
    const tarjeta = e.currentTarget;
    let temporizador = setTimeout(() => {
      temporizador = null;
      this.fichaDesde = performance.now();          // el clic de propina se ignora
      if (navigator.vibrate) navigator.vibrate(12);
      this.#abrirFichaAsset(asset);
    }, 450);
    const cancelar = (ev) => {
      if (ev.type === 'pointermove' && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) return;
      clearTimeout(temporizador);
      tarjeta.removeEventListener('pointermove', cancelar);
      tarjeta.removeEventListener('pointerup', cancelar);
      tarjeta.removeEventListener('pointercancel', cancelar);
    };
    tarjeta.addEventListener('pointermove', cancelar);
    tarjeta.addEventListener('pointerup', cancelar);
    tarjeta.addEventListener('pointercancel', cancelar);
  }

  /**
   * FICHA DEL RECURSO — lo que un `title` nunca podrá contar.
   *
   * Vista previa grande de verdad (el vídeo se ve, el audio suena),
   * nombre y etiquetas editables —las etiquetas ya se podían buscar
   * pero no había forma de ponerlas—, dónde se usa y las acciones.
   * Se abre manteniendo pulsada la tarjeta.
   */
  #abrirFichaAsset(asset) {
    document.querySelector('#asset-sheet')?.remove();

    const usos = this.store.pageNodes().filter((n) => {
      const p = n.props || {};
      return p.assetId === asset.id || (Array.isArray(p.assetIds) && p.assetIds.includes(asset.id));
    });

    const vista = asset.kind === 'video'
      ? el('video', { class: 'ficha-vista', src: asset.data, controls: 'true', playsinline: 'true' })
      : asset.kind === 'audio'
        ? el('audio', { class: 'ficha-audio', src: asset.data, controls: 'true' })
        : ['image', 'gif', 'svg'].includes(asset.kind)
          ? el('img', { class: 'ficha-vista', src: asset.data, alt: asset.name })
          : el('div', { class: 'ficha-vista ficha-icono', html: ic({ model: 'cube', font: 'type', html: 'globe' }[asset.kind] || 'file') });

    const nombre = el('input', { class: 'input', value: asset.name });
    const etiquetas = el('input', {
      class: 'input', value: (asset.tags || []).join(', '),
      placeholder: 'romántico, fondo, ella…',
    });

    const cerrar = () => {
      hoja.classList.remove('open');
      document.body.classList.remove('sheet-open');
      setTimeout(() => hoja.remove(), 340);
    };
    const guardar = async () => {
      await this.assets.rename(asset.id, nombre.value);
      await this.assets.setTags(asset.id, etiquetas.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean));
      showSnack('Guardado');
      cerrar();
    };

    const hoja = el('aside', { id: 'asset-sheet', class: 'sheet' }, [
      el('h3', { class: 'sheet-title', text: asset.name, title: asset.name }),
      el('div', { class: 'sheet-body' }, [
        el('div', { class: 'ficha-marco' }, [vista]),
        el('dl', { class: 'ficha-datos' }, [
          el('div', {}, [el('dt', { text: 'Tipo' }), el('dd', { text: ASSET_KINDS[asset.kind]?.label || asset.kind })]),
          el('div', {}, [el('dt', { text: 'Peso' }), el('dd', { text: formatBytes(asset.size) })]),
          el('div', {}, [el('dt', { text: 'Carpeta' }), el('dd', { text: NOMBRE_CARPETA[asset.folder] || asset.folder || '—' })]),
          el('div', {}, [el('dt', { text: 'En esta página' }), el('dd', {
            class: usos.length ? 'si' : '',
            text: usos.length ? `${usos.length} ${usos.length === 1 ? 'pieza' : 'piezas'}` : 'sin usar',
          })]),
        ]),
        this.#field('Nombre', nombre),
        this.#field('Etiquetas (separadas por comas)', etiquetas),
        el('p', { class: 'panel-hint', text: 'Las etiquetas sirven para encontrarlo desde el buscador.' }),
        el('div', { class: 'btn-row' }, [
          el('button', {
            class: 'btn primary', html: `${ic('plus')}<span>Usar</span>`,
            onclick: () => { this.#useAsset(asset); cerrar(); },
          }),
          el('button', { class: 'btn', html: `${ic('check')}<span>Guardar</span>`, onclick: guardar }),
        ]),
        el('button', {
          class: 'btn danger block', html: `${ic('trash')}<span>Eliminar recurso</span>`,
          onclick: async () => {
            const fuera = await confirmar({
              titulo: `¿Eliminar "${asset.name}"?`,
              texto: usos.length
                ? `Lo están usando ${usos.length} ${usos.length === 1 ? 'pieza' : 'piezas'} de esta página.`
                : 'No lo está usando nada ahora mismo.',
              aceptar: 'Eliminar', peligro: true,
            });
            if (!fuera) return;
            await this.assets.remove(asset.id);
            cerrar();
          },
        }),
      ]),
    ]);
    document.body.append(hoja);
    makeSheetDismissable(hoja, cerrar);
    // Primero se cierran las demás hojas y DESPUÉS se escucha el
    // aviso: al revés, la ficha se cerraba a sí misma al nacer.
    document.dispatchEvent(new CustomEvent('wb:close-sheets'));
    document.addEventListener('wb:close-sheets', cerrar, { once: true });
    requestAnimationFrame(() => {
      hoja.classList.add('open');
      document.body.classList.add('sheet-open');
    });
  }

  #useAsset(asset, at = null) {
    const sel = this.store.selectedNodes[0];
    const def = sel && Components[sel.type];
    // Si hay un componente compatible seleccionado, el asset lo rellena
    if (!at && sel && def?.accepts?.includes(asset.kind === 'svg' ? 'image' : asset.kind)) {
      if (def.schema.some((f) => f.key === 'props.assetIds')) {
        this.store.updateNode(sel.id, 'props', { assetIds: [...(sel.props.assetIds || []), asset.id] });
      } else {
        this.store.updateNode(sel.id, 'props', { assetId: asset.id });
      }
      return;
    }
    const type = this.assets.componentForAsset(asset);
    if (!type) return;
    const width = this.store.project.settings.breakpoints[this.store.device];
    this.store.addNode(type, at || { x: Math.round(width / 2 - 160), y: 120 }, { props: { ...Components[type].defaults.props, assetId: asset.id } });
  }

  /* ── Pestaña de Música (repositorio de GitHub) ─────── */

  /* ── Música ────────────────────────────────────────────
   * La pista que suena se ve: fila resaltada, botón en pausa y un
   * ecualizador de tres barras que SOLO se anima mientras suena. */

  #renderMusic(body) {
    // El contenido primero; la explicación, al final y en corto.
    poner(body, el('h4', { class: 'panel-heading', text: 'Tus canciones' }));
    if (!this.previewAudio) {
      this.previewAudio = new Audio();
      // listener único (los re-render del panel no lo duplican)
      this.previewAudio.addEventListener('ended', () => this.#pintarPista(null));
    }
    const list = el('div', { class: 'music-list' });

    MUSIC_TRACKS.forEach((track) => {
      const url = trackURL(track);
      const sonando = () => this.previewAudio.src === url && !this.previewAudio.paused;
      const fila = el('div', { class: 'music-row', dataset: { url } }, [
        el('button', {
          class: 'music-play', title: 'Escuchar',
          html: ic('play'),
          onclick: () => {
            if (sonando()) { this.previewAudio.pause(); this.#pintarPista(null); return; }
            this.previewAudio.src = url;
            this.previewAudio.play()
              .then(() => this.#pintarPista(url))
              .catch(() => showSnack('No se pudo cargar la pista. Revisa src/config/musicLibrary.js'));
          },
        }),
        el('div', { class: 'music-meta' }, [
          el('strong', { text: track.title }),
          el('span', { text: track.artist }),
        ]),
        el('span', { class: 'music-eq', html: '<i></i><i></i><i></i>', 'aria-hidden': 'true' }),
        el('button', {
          class: 'music-add', html: ic('plus'), title: 'Añadir reproductor a la página',
          onclick: () => {
            const width = this.store.project.settings.breakpoints[this.store.device];
            this.store.addNode('musicPlayer', { x: Math.round(width / 2 - 180), y: 140 }, {
              props: { assetId: null, srcUrl: url, title: track.title, artist: track.artist },
            });
            showSnack(`"${track.title}" añadida a la página`);
          },
        }),
      ]);
      poner(list, fila);
    });
    poner(body, list);
    this.#pintarPista(this.previewAudio.paused ? null : this.previewAudio.src);
    poner(body, el('p', { class: 'panel-hint', html: 'Cambia tus pistas en <b>src/config/musicLibrary.js</b>.' }));

    // Pega una URL de audio directa (mp3/ogg/m4a…)
    const urlInput = el('input', { class: 'input', placeholder: 'https://…/cancion.mp3' });
    poner(body, 
      el('h4', { class: 'panel-heading', text: 'O pega una URL de audio' }),
      urlInput,
      el('p', { class: 'panel-hint', text: 'Sirve cualquier enlace que termine en el archivo de audio (mp3, ogg, m4a…), por ejemplo desde tu repositorio de GitHub.' }),
      el('button', {
        class: 'btn block', html: `${ic('plus')}<span>Añadir reproductor con esa URL</span>`,
        onclick: () => {
          if (!urlInput.value.trim()) return;
          this.store.addNode('musicPlayer', { x: 200, y: 140 }, {
            props: { assetId: null, srcUrl: urlInput.value.trim(), title: 'Mi canción', artist: '♡' },
          });
          showSnack('Reproductor añadido');
        },
      }),
    );
  }

  /** Marca qué pista suena (o ninguna) sin volver a pintar el panel. */
  #pintarPista(url) {
    this.root.querySelectorAll('.music-row').forEach((fila) => {
      const activa = !!url && fila.dataset.url === url;
      fila.classList.toggle('sonando', activa);
      const btn = fila.querySelector('.music-play');
      if (btn) {
        btn.innerHTML = ic(activa ? 'pause' : 'play');
        btn.title = activa ? 'Pausar' : 'Escuchar';
      }
    });
  }

  /* ── Drop sobre el lienzo (componentes, assets, archivos del SO) ── */

  #setupCanvasDrop() {
    const vp = this.view.viewport;
    vp.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    vp.addEventListener('drop', async (e) => {
      e.preventDefault();
      const at = this.view.toArtboard(e.clientX, e.clientY);
      const type = e.dataTransfer.getData('application/x-wb-component');
      if (type) {
        const def = Components[type];
        this.store.addNode(type, { x: Math.round(at.x - def.size[0] / 2), y: Math.round(at.y - def.size[1] / 2) });
        return;
      }
      const assetId = e.dataTransfer.getData('application/x-wb-asset');
      if (assetId) {
        const asset = this.assets.get(assetId);
        if (asset) this.#useAsset(asset, { x: Math.round(at.x - 140), y: Math.round(at.y - 100) });
        return;
      }
      // Archivos soltados directamente desde el SO / galería
      if (e.dataTransfer.files?.length) {
        const imported = await this.assets.importFiles([...e.dataTransfer.files]);
        let offset = 0;
        for (const asset of imported) {
          this.#useAsset(asset, { x: Math.round(at.x - 140 + offset), y: Math.round(at.y - 100 + offset) });
          offset += 28;
        }
      }
    });
  }

  /* ── Páginas ───────────────────────────────────────── */

  /* ── Páginas ───────────────────────────────────────────
   * Cada página se enseña con una MINIATURA de verdad: un mapa de
   * su contenido dibujado con las cajas reales de sus piezas. No es
   * una captura (cara de generar y de mantener), es el plano —
   * y basta para reconocer la página de un vistazo. */

  /** Mini mapa SVG de una página: el fondo y la silueta de sus piezas. */
  #pageThumb(page) {
    const w = this.store.project.settings.breakpoints.desktop || 1280;
    const h = Math.max(page.height || 800, 200);
    const cajas = (page.nodes || []).slice(0, 26).map((id) => {
      const n = this.store.project.nodes[id];
      if (!n || n.hidden) return '';
      const f = n.base || {};
      const x = ((f.x || 0) / w) * 100;
      const y = ((f.y || 0) / h) * 100;
      const bw = Math.max(1.5, ((f.w || 40) / w) * 100);
      const bh = Math.max(1.2, ((f.h || 40) / h) * 100);
      if (x > 100 || y > 100) return '';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.4"/>`;
    }).join('');
    const fondo = typeof page.background === 'string' && page.background.startsWith('#') ? page.background : '#efe7ec';
    return el('span', {
      class: 'page-thumb', style: { background: fondo },
      html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${cajas}</svg>`,
    });
  }

  #renderPages(body) {
    const paginas = this.store.project.pages;
    poner(body, el('button', {
      class: 'btn primary block', html: `${ic('plus')}<span>Nueva página</span>`,
      onclick: () => this.store.addPage(),
    }));
    const list = el('div', { class: 'page-list' });
    const pq = (this.pageQuery || '').toLowerCase();
    paginas.forEach((page, i) => {
      if (pq && !page.name.toLowerCase().includes(pq)) return;
      const active = page.id === this.store.pageId;
      const canDelete = paginas.length > 1;
      const piezas = (page.nodes || []).length;
      poner(list, enableSwipeDelete(el('div', {
        class: `page-item${active ? ' active' : ''}`,
        onclick: () => this.store.setPage(page.id),
      }, [
        el('span', { class: 'page-num', text: String(i + 1) }),
        this.#pageThumb(page),
        el('span', { class: 'page-body' }, [
          el('span', {
            class: 'page-name', text: page.name, title: 'Toca dos veces para renombrar',
            ondblclick: async (e) => {
              e.stopPropagation();
              const name = await preguntar({
                titulo: 'Nombre de la página',
                etiqueta: 'Cómo se llama',
                valor: page.name,
              });
              if (name) this.store.renamePage(page.id, name);
            },
          }),
          el('span', { class: 'page-meta', text: `${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}${active ? ' · abierta' : ''}` }),
        ]),
        el('span', { class: 'page-actions' }, [
          el('button', { html: ic('up'), title: 'Subir', onclick: (e) => { e.stopPropagation(); this.store.movePage(page.id, -1); } }),
          el('button', { html: ic('down'), title: 'Bajar', onclick: (e) => { e.stopPropagation(); this.store.movePage(page.id, 1); } }),
          el('button', { html: ic('duplicate'), title: 'Duplicar', onclick: (e) => { e.stopPropagation(); this.store.duplicatePage(page.id); } }),
        ]),
      ]), async () => {
        const fuera = canDelete && await confirmar({
          titulo: `¿Eliminar "${page.name}"?`,
          texto: 'Se borra la página con todo lo que tenga dentro.',
          aceptar: 'Eliminar', peligro: true,
        });
        if (fuera) this.store.deletePage(page.id);
        else this.render(); // restaura la fila si se canceló
      }));
    });
    poner(body, list);
    poner(body, el('p', { class: 'panel-hint', text: 'Desliza una página a la izquierda para eliminarla.' }));

    /* ── Color del editor ──────────────────────────────────
       El editor es SIEMPRE claro y pastel: aquí solo se decide qué
       manda entre el rosa y el verde. Cada opción se enseña con sus
       dos colores, no con un nombre a secas. */
    const PALETAS = [
      ['', 'Rosa y menta', '#f4b3cb', '#8fd3b6'],
      ['rosa', 'Más rosa', '#f0a8c4', '#f7cfdd'],
      ['menta', 'Más verde', '#8ed1b4', '#c8ead9'],
      ['lavanda', 'Lavanda', '#c3aee6', '#a9dcc6'],
    ];
    const paletaActiva = localStorage.getItem('wb-palette') || '';
    const aplicarPaleta = (valor) => {
      if (valor) { localStorage.setItem('wb-palette', valor); document.body.dataset.palette = valor; }
      else { localStorage.removeItem('wb-palette'); delete document.body.dataset.palette; }
      this.render();
    };
    poner(body, 
      el('h4', { class: 'panel-heading', text: 'Color del editor' }),
      el('div', { class: 'tinte-row' }, PALETAS.map(([v, label, c1, c2]) => el('button', {
        class: `tinte${paletaActiva === v ? ' active' : ''}`,
        title: label,
        onclick: () => aplicarPaleta(v),
      }, [
        el('span', { class: 'tinte-bola', style: { background: `linear-gradient(135deg, ${c1} 0 50%, ${c2} 50% 100%)` } }),
        el('span', { class: 'tinte-lbl', text: label }),
      ]))),
    );

    // ── Proyecto y pantalla: Hz, resoluciones y orientación ──
    const settings = this.store.project.settings;
    const bps = settings.breakpoints;
    // Solo tamaños de móvil y tablet: es para lo que se diseña aquí.
    const RES_PRESETS = [
      ['', 'Tamaños rápidos…'],
      ['360', 'Teléfono pequeño · 360'], ['390', 'Teléfono · 390'], ['430', 'Teléfono grande · 430'],
      ['844', 'Teléfono horizontal · 844'],
      ['768', 'Tablet · 768'], ['834', 'Tablet grande · 834'], ['1024', 'Tablet horizontal · 1024'],
      ['1280', 'Tablet XL horizontal · 1280'],
    ];
    // Pares retrato ↔ paisaje para el giro de orientación
    const FLIP = { 360: 780, 780: 360, 390: 844, 844: 390, 430: 932, 932: 430, 768: 1024, 1024: 768, 834: 1194, 1194: 834, 1280: 800, 800: 1280 };
    const applyWidth = (width) => {
      if (!width || width < 120) return;
      this.store.snapshot();
      bps[this.store.device] = Math.round(width);
      this.store.commit();
      this.view.fit();
    };
    poner(body, 
      el('h4', { class: 'panel-heading', text: 'Proyecto y pantalla' }),
      this.#field(`Ancho del lienzo · ${DEVICES[this.store.device]?.label || 'Base'} (px)`, el('input', {
        class: 'input', type: 'number', min: 120, max: 3840, value: bps[this.store.device],
        onchange: (e) => applyWidth(+e.target.value),
      })),
      el('select', {
        class: 'input block',
        onchange: (e) => { applyWidth(+e.target.value); e.target.value = ''; },
      }, RES_PRESETS.map(([v, label]) => el('option', { value: v, text: label }))),
      el('button', {
        class: 'btn block', html: `${ic('tablet')}<span>Girar orientación (vertical ↔ horizontal)</span>`,
        onclick: () => applyWidth(FLIP[bps[this.store.device]] || Math.round(bps[this.store.device] * (bps[this.store.device] > 700 ? 0.6 : 1.7))),
      }),
      this.#field('Frecuencia de refresco (WebGL)', el('select', {
        class: 'input',
        onchange: (e) => { this.store.snapshot(); settings.fps = +e.target.value; this.store.commit(); },
      }, [[0, 'Automática (vsync del dispositivo)'], [30, '30 Hz (ahorro)'], [60, '60 Hz'], [90, '90 Hz'], [120, '120 Hz'], [144, '144 Hz'], [165, '165 Hz'], [240, '240 Hz']]
        .map(([v, label]) => el('option', { value: v, text: label, selected: (settings.fps || 0) === v ? 'true' : null })))),
    );

    // Ajustes de la página activa
    const page = this.store.page;
    poner(body, 
      el('h4', { class: 'panel-heading', text: 'Página activa' }),
      this.#field('Altura (px)', el('input', {
        class: 'input', type: 'number', value: page.height, min: 200,
        onchange: (e) => this.store.updatePage(page.id, { height: Math.max(200, +e.target.value || 800) }),
      })),
      this.#field('Fondo de la hoja', el('input', {
        class: 'input', type: 'text', value: page.background, placeholder: '#0b1020 o gradiente CSS',
        onchange: (e) => this.store.updatePage(page.id, { background: e.target.value }),
      })),
      el('div', { class: 'swatch-row' }, [
        '#0b1020', '#150a24', '#fdf2f8', '#ffffff', '#060607',
        'linear-gradient(175deg,#1e0a2e,#3b0f3f)', 'linear-gradient(135deg,#fdf2f8,#fbcfe8)',
        'linear-gradient(160deg,#0f0c29,#302b63)', 'linear-gradient(180deg,#fff7ed,#ffedd5)',
        'radial-gradient(circle at 30% 20%,#312e81,#0b1020)',
      ].map((g) => el('button', {
        class: 'swatch', title: g, style: { background: g },
        onclick: () => this.store.updatePage(page.id, { background: g }),
      }))),
      this.#field('Transición de entrada', el('select', {
        class: 'input',
        onchange: (e) => this.store.updatePage(page.id, { transition: e.target.value }),
      }, [
        ['fade', 'Fundido'], ['slide', 'Deslizar'], ['zoom', 'Zoom'], ['blur', 'Desenfoque'],
        ['circulo', 'Círculo mágico'], ['cortina', 'Cortina'], ['giro3d', 'Giro 3D'], ['ascenso', 'Ascenso'],
        ['corazones', 'Lluvia de corazones'], ['estrellas', 'Polvo de estrellas'], ['nieve', 'Nevada'],
        ['ninguna', 'Sin transición'],
      ].map(([t, label]) =>
        el('option', { value: t, text: label, selected: page.transition === t ? 'true' : null })))),
      this.#field('Duración de la transición (ms)', el('input', {
        class: 'input', type: 'number', min: 100, max: 5000, step: 100, value: page.transitionDuration || 700,
        onchange: (e) => this.store.updatePage(page.id, { transitionDuration: +e.target.value || 700 }),
      })),
      el('label', { class: 'field check' }, [
        el('input', {
          type: 'checkbox', ...(page.pixelArt ? { checked: 'true' } : {}),
          onchange: (e) => this.store.updatePage(page.id, { pixelArt: e.target.checked }),
        }),
        el('span', { text: 'Modo Pixel Art (reescalado sin suavizado)' }),
      ]),
      el('h4', { class: 'panel-heading', text: 'Código de esta página' }),
      this.#field('CSS propio', el('textarea', {
        class: 'input code', rows: 3, text: page.custom?.css || '', placeholder: '.mi-estilo { … }',
        onchange: (e) => this.store.updatePage(page.id, { custom: { ...(page.custom || {}), css: e.target.value } }),
      })),
      this.#field('JavaScript propio', el('textarea', {
        class: 'input code', rows: 3, text: page.custom?.js || '', placeholder: '// corre al cargar esta página',
        onchange: (e) => this.store.updatePage(page.id, { custom: { ...(page.custom || {}), js: e.target.value } }),
      })),
    );
  }

  /**
   * Construye una lista larga POR TANDAS.
   *
   * Montar 51 capas de una vez era una tarea de 95 ms: el dedo se
   * quedaba pegado mientras subía el cajón. Se pintan las primeras
   * (las que caben en pantalla) y el resto entra en tandas, un frame
   * cada una, así que ninguna tarea bloquea.
   *
   * El testigo `tandaId` cancela lo pendiente si se vuelve a pintar
   * el panel: nunca se mezclan dos listas.
   */
  #porTandas(elementos, construir, destino, primeras = 10, tanda = 6) {
    const mío = (this.tandaId = (this.tandaId || 0) + 1);
    const hasta = Math.min(primeras, elementos.length);
    for (let i = 0; i < hasta; i++) destino.append(construir(elementos[i], i));
    if (hasta >= elementos.length) return;

    let desde = hasta;
    // Tandas pequeñas y en los huecos libres: mientras el cajón sube,
    // el navegador tiene otras cosas que hacer y esto puede esperar.
    const cuandoSePueda = window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 200 })
      : (fn) => requestAnimationFrame(fn);
    const seguir = () => {
      if (mío !== this.tandaId || !destino.isConnected) return;   // se repintó
      const fin = Math.min(desde + tanda, elementos.length);
      const trozo = document.createDocumentFragment();
      for (let i = desde; i < fin; i++) trozo.append(construir(elementos[i], i));
      destino.append(trozo);
      desde = fin;
      if (desde < elementos.length) cuandoSePueda(seguir);
    };
    cuandoSePueda(seguir);
  }

  /* ── Capas ─────────────────────────────────────────────
   * Cada fila dice de un vistazo qué es, si se ve y si está fija.
   * El orden se cambia arrastrando el asa: antes esto usaba el
   * drag-and-drop de HTML5, que en un móvil NO existe — el asa se
   * veía pero no hacía nada. Ahora va por eventos de puntero. */

  #renderLayers(body) {
    const nodes = this.store.pageNodes();
    if (!nodes.length) {
      poner(body, el('p', { class: 'panel-hint', text: 'La página está vacía. Añade piezas y dale vida.' }));
      return;
    }
    poner(body, el('input', {
      class: 'input block', type: 'search', placeholder: 'Buscar capa…', value: this.layerQuery || '',
      oninput: (e) => { this.layerQuery = e.target.value; this.render(); },
    }));
    const q = (this.layerQuery || '').toLowerCase();
    const list = el('div', { class: 'layer-list' });

    // De arriba (lo último en pintarse) hacia abajo
    const visibles = [...nodes].reverse().filter((n) => !q || n.name.toLowerCase().includes(q));
    poner(body, el('p', {
      class: 'panel-hint',
      text: visibles.length === nodes.length
        ? `${nodes.length} capas · la de arriba es la que tapa a las demás`
        : `${visibles.length} de ${nodes.length} capas`,
    }));

    const filaDeCapa = (node) => {
      const selected = this.store.selection.includes(node.id);
      const fila = el('div', {
        class: `layer-item${selected ? ' active' : ''}${node.hidden ? ' oculta' : ''}${node.locked ? ' fija' : ''}`,
        dataset: { id: node.id },
        // Pulsación larga = añadir a la selección múltiple
        oncontextmenu: (e) => {
          e.preventDefault();
          this.store.select(node.id, true);
          if (navigator.vibrate) navigator.vibrate(10);
        },
        onclick: (e) => this.store.select(node.id, e.shiftKey),
      }, [
        el('span', {
          class: 'layer-grip', html: ic('drag'), title: 'Arrastra para cambiar el orden',
          onpointerdown: (e) => this.#empezarReordenCapa(e, node.id, list),
        }),
        el('span', { class: 'layer-icon', html: typeIcon(node.type) }),
        el('span', { class: 'layer-body' }, [
          el('span', { class: 'layer-name', text: node.name, title: node.name }),
          el('span', { class: 'layer-tipo', text: node.locked ? 'fija' : node.hidden ? 'oculta' : (Components[node.type]?.label || node.type) }),
        ]),
        el('button', {
          class: `layer-tog${node.hidden ? '' : ' si'}`,
          html: ic(node.hidden ? 'eyeOff' : 'eye'),
          title: node.hidden ? 'Mostrar en la página' : 'Ocultar en la página',
          onclick: (e) => { e.stopPropagation(); this.store.toggleFlag(node.id, 'hidden'); },
        }),
        el('button', {
          class: `layer-tog${node.locked ? ' fijada' : ''}`,
          html: ic(node.locked ? 'lock' : 'unlock'),
          title: node.locked ? 'Desbloquear para poder moverla' : 'Fijar para no moverla sin querer',
          onclick: (e) => { e.stopPropagation(); this.store.toggleFlag(node.id, 'locked'); },
        }),
      ]);
      return enableSwipeDelete(fila, () => {
        this.store.removeNodes([node.id]);
        showSnack(`"${node.name}" eliminada`, 'Deshacer', () => this.store.undo());
      });
    };
    poner(body, list);
    this.#porTandas(visibles, filaDeCapa, list);
  }

  /**
   * Reordenar capas con el dedo.
   *
   * Se arrastra la fila y las demás se apartan; al soltar, el orden
   * real del proyecto se reescribe de una vez. Nada de HTML5 drag,
   * que en táctil no se dispara jamás.
   */
  #empezarReordenCapa(e, id, list) {
    e.preventDefault();
    e.stopPropagation();
    const fila = list.querySelector(`.layer-item[data-id="${id}"]`);
    if (!fila) return;
    const filas = [...list.querySelectorAll('.layer-item')];
    const alto = fila.offsetHeight + 8;            // fila + hueco
    const desde = filas.indexOf(fila);
    let salto = 0;
    const y0 = e.clientY;

    fila.classList.add('moviendo');
    if (navigator.vibrate) navigator.vibrate(10);
    try { fila.setPointerCapture(e.pointerId); } catch { /* sintético */ }

    const mover = (ev) => {
      const dy = ev.clientY - y0;
      fila.style.transform = `translateY(${dy}px)`;
      const nuevo = Math.max(-desde, Math.min(filas.length - 1 - desde, Math.round(dy / alto)));
      if (nuevo === salto) return;
      salto = nuevo;
      // Las demás filas se apartan para dejar el hueco
      filas.forEach((f, i) => {
        if (f === fila) return;
        let d = 0;
        if (salto > 0 && i > desde && i <= desde + salto) d = -alto;
        if (salto < 0 && i < desde && i >= desde + salto) d = alto;
        f.style.transform = d ? `translateY(${d}px)` : '';
      });
    };
    const soltar = () => {
      fila.removeEventListener('pointermove', mover);
      fila.removeEventListener('pointerup', soltar);
      fila.removeEventListener('pointercancel', soltar);
      fila.classList.remove('moviendo');
      filas.forEach((f) => { f.style.transform = ''; });
      if (!salto) return;
      // La lista se enseña al revés: bajar en pantalla es bajar de capa
      this.store.snapshot('layer');
      const arr = this.store.page.nodes;
      const pos = arr.indexOf(id);
      if (pos >= 0) {
        arr.splice(pos, 1);
        arr.splice(Math.max(0, Math.min(arr.length, pos - salto)), 0, id);
      }
      this.store.commit();
      if (navigator.vibrate) navigator.vibrate(8);
    };
    fila.addEventListener('pointermove', mover);
    fila.addEventListener('pointerup', soltar);
    fila.addEventListener('pointercancel', soltar);
  }

  #field(label, control) {
    return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
  }
}
