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

import { el, esc, formatBytes, debounce, showSnack } from '../utils/helpers.js';
import { ic, typeIcon, BLOCK_ICONS } from './icons.js';
import { Components, CATEGORIES } from '../components/registry.js';
import { BLOCKS } from '../storage/templates.js';
import { ASSET_KINDS, ACCEPT_ATTR } from '../assets/assetManager.js';
import { MUSIC_TRACKS, MUSIC_REPO_BASE, trackURL } from '../config/musicLibrary.js';
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
        html: name === 'musica' ? ic('music', 15) : { componentes: 'Piezas', assets: 'Assets', paginas: 'Páginas', capas: 'Capas' }[name],
        title: name === 'musica' ? 'Música' : null,
        onclick: () => { this.tab = name; this.render(); },
      })));
    this.root.append(tabs);
    const body = el('div', { class: 'panel-body' });
    this.root.append(body);
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
    // Bloques prediseñados: secciones completas listas para usar
    body.append(el('h4', { class: 'panel-heading', text: 'Bloques prediseñados' }));
    const blockList = el('div', { class: 'block-list' });
    for (const [key, block] of Object.entries(BLOCKS)) {
      blockList.append(el('button', {
        class: 'block-item', title: 'Añade esta sección al final de la página',
        onclick: () => this.store.addBlock(key),
      }, [el('span', { class: 'palette-icon', html: ic(BLOCK_ICONS[key] || 'sparkles') }), el('span', { text: block.label })]));
    }
    body.append(blockList);

    /* Tus carpetas de contenido: 3D y widgets propios */
    if (MY_3D.length) {
      body.append(el('h4', { class: 'panel-heading', text: 'Mis 3D (contenido/3d)' }));
      const grid3d = el('div', { class: 'palette-grid' });
      for (const item of MY_3D) {
        grid3d.append(el('div', {
          class: 'palette-item', title: 'Escena 3D propia — arrastra o toca',
          onclick: () => this.store.addNode('custom3D', { x: 200, y: 160 }, {
            name: item.name, props: { code: item.code, cameraZ: 4 },
          }),
        }, [el('span', { class: 'palette-icon', html: ic('cube') }), el('span', { text: item.name })]));
      }
      body.append(grid3d);
    }
    if (MY_WIDGETS.length) {
      body.append(el('h4', { class: 'panel-heading', text: 'Mis widgets (contenido/widgets)' }));
      const gridw = el('div', { class: 'palette-grid' });
      for (const widget of MY_WIDGETS) {
        gridw.append(el('div', {
          class: 'palette-item', title: 'Widget propio — arrastra o toca',
          onclick: () => this.store.addNode('customHTML', {
            x: 160, y: 160, w: widget.width || 340, h: widget.height || 220,
          }, { name: widget.name, props: { html: widget.html || '', css: widget.css || '', js: widget.js || '' } }),
        }, [el('span', { class: 'palette-icon', html: ic('wand') }), el('span', { text: widget.name })]));
      }
      body.append(gridw);
    }

    for (const cat of CATEGORIES) {
      body.append(el('h4', { class: 'panel-heading', text: cat }));
      const grid = el('div', { class: 'palette-grid' });
      for (const [type, def] of Object.entries(Components)) {
        if (def.cat !== cat) continue;
        const item = el('div', {
          class: 'palette-item', draggable: 'true', title: `Arrastra al lienzo o haz clic`,
          ondragstart: (e) => e.dataTransfer.setData('application/x-wb-component', type),
          onclick: () => this.#addAtCenter(type),
        }, [el('span', { class: 'palette-icon', html: typeIcon(type) }), el('span', { text: def.label })]);
        grid.append(item);
      }
      body.append(grid);
    }
    body.append(el('p', { class: 'panel-hint', text: 'También puedes arrastrar archivos de tu galería directamente sobre el lienzo.' }));
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
      onchange: async (e) => { await this.assets.importFiles([...e.target.files]); e.target.value = ''; },
    });
    body.append(
      input,
      el('button', { class: 'btn primary block', html: `${ic('upload', 15)}<span>Subir desde galería / disco</span>`, onclick: () => input.click() }),
      el('input', {
        class: 'input block', type: 'search', placeholder: 'Buscar por nombre o etiqueta…',
        value: this.assetFilter.query,
        oninput: (e) => { this.assetFilter.query = e.target.value; this.#renderAssetGrid(); },
      }),
      el('div', { class: 'chip-row' }, [
        el('button', { class: `chip${!this.assetFilter.kind ? ' active' : ''}`, text: 'Todo', onclick: () => { this.assetFilter.kind = null; this.render(); } }),
        ...Object.entries(ASSET_KINDS).filter(([k]) => k !== 'svg').map(([kind, meta]) =>
          el('button', {
            class: `chip${this.assetFilter.kind === kind ? ' active' : ''}`,
            html: ic({ image: 'image', gif: 'film', video: 'video', audio: 'music', model: 'cube', font: 'type', html: 'globe' }[kind] || 'file', 14),
            title: meta.label,
            onclick: () => { this.assetFilter.kind = kind; this.render(); },
          })),
      ]),
    );
    this.assetGrid = el('div', { class: 'asset-grid' });
    body.append(this.assetGrid);
    this.#renderAssetGrid();
  }

  #renderAssetGrid() {
    const grid = this.assetGrid;
    grid.innerHTML = '';
    const list = this.assets.list(this.assetFilter);
    if (!list.length) {
      grid.append(el('p', { class: 'panel-hint', text: 'Sin assets todavía. Sube imágenes, GIFs, vídeos, audio o modelos GLB.' }));
      return;
    }
    for (const asset of list) {
      const preview = asset.kind === 'video'
        ? el('video', { src: asset.data, muted: 'true', class: 'asset-thumb' })
        : ['image', 'gif', 'svg'].includes(asset.kind)
          ? el('img', { src: asset.data, class: 'asset-thumb', draggable: 'false', loading: 'lazy', decoding: 'async' })
          : el('div', { class: 'asset-thumb kind-icon', html: ic({ audio: 'music', model: 'cube', font: 'type', html: 'globe' }[asset.kind] || 'file', 26) });
      const card = el('div', {
        class: 'asset-card', draggable: 'true',
        title: `${asset.name} · ${formatBytes(asset.size)} · carpeta: ${asset.folder}`,
        ondragstart: (e) => e.dataTransfer.setData('application/x-wb-asset', asset.id),
        onclick: () => this.#useAsset(asset),
      }, [
        preview,
        el('span', { class: 'asset-name', text: asset.name }),
        el('button', {
          class: 'asset-del', html: ic('close', 11), title: 'Eliminar asset',
          onclick: (e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${asset.name}"?`)) this.assets.remove(asset.id); },
        }),
      ]);
      grid.append(card);
    }
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

  #renderMusic(body) {
    body.append(
      el('h4', { class: 'panel-heading', text: '♫ Tu música desde GitHub' }),
      el('p', { class: 'panel-hint', html: 'Estas pistas se leen de <b>src/config/musicLibrary.js</b> — cambia ahí los nombres de archivo (musica1.mp3, musica2.mp3…) y tu repositorio.' }),
    );
    if (!this.previewAudio) {
      this.previewAudio = new Audio();
      // listener único (los re-render del panel no lo duplican)
      this.previewAudio.addEventListener('ended', () => {
        this.root.querySelectorAll('.music-play').forEach((b) => { b.innerHTML = ic('play', 15); });
      });
    }
    const list = el('div', { class: 'music-list' });
    MUSIC_TRACKS.forEach((track) => {
      const url = trackURL(track);
      const playBtn = el('button', {
        class: 'music-play', html: ic('play', 15),
        onclick: () => {
          if (this.previewAudio.src === url && !this.previewAudio.paused) {
            this.previewAudio.pause();
            playBtn.innerHTML = ic('play', 15);
          } else {
            this.previewAudio.src = url;
            this.previewAudio.play().catch(() => alert('No se pudo cargar la pista.\nRevisa tu repositorio en src/config/musicLibrary.js'));
            list.querySelectorAll('.music-play').forEach((b) => { b.innerHTML = ic('play', 15); });
            playBtn.innerHTML = ic('stop', 14);
          }
        },
      });
      list.append(el('div', { class: 'music-row' }, [
        playBtn,
        el('div', { class: 'music-meta' }, [
          el('strong', { text: track.title }),
          el('span', { text: track.artist }),
          el('small', { text: track.file }),
        ]),
        el('button', {
          class: 'btn primary btn-ic', html: ic('plus', 15), title: 'Añadir reproductor a la página',
          onclick: () => {
            const width = this.store.project.settings.breakpoints[this.store.device];
            this.store.addNode('musicPlayer', { x: Math.round(width / 2 - 180), y: 140 }, {
              props: { assetId: null, srcUrl: url, title: track.title, artist: track.artist },
            });
          },
        }),
      ]));
    });
    body.append(list);

    // Pega una URL de audio directa (mp3/ogg/m4a…)
    const urlInput = el('input', { class: 'input', placeholder: 'https://…/cancion.mp3' });
    body.append(
      el('h4', { class: 'panel-heading', text: 'O pega una URL de audio directa' }),
      urlInput,
      el('p', { class: 'panel-hint', text: 'Sirve cualquier enlace que termine en el archivo de audio (mp3, ogg, m4a…), por ejemplo desde tu repositorio de GitHub.' }),
      el('button', {
        class: 'btn block', html: `${ic('plus', 13)}<span>Añadir reproductor con esa URL</span>`,
        onclick: () => {
          if (!urlInput.value.trim()) return;
          this.store.addNode('musicPlayer', { x: 200, y: 140 }, {
            props: { assetId: null, srcUrl: urlInput.value.trim(), title: 'Mi canción', artist: '♡' },
          });
        },
      }),
    );
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

  #renderPages(body) {
    body.append(el('button', { class: 'btn primary block', html: `${ic('plus', 14)}<span>Nueva página</span>`, onclick: () => this.store.addPage() }));
    const list = el('div', { class: 'page-list' });
    const pq = (this.pageQuery || '').toLowerCase();
    for (const page of this.store.project.pages) {
      if (pq && !page.name.toLowerCase().includes(pq)) continue;
      const active = page.id === this.store.pageId;
      const canDelete = this.store.project.pages.length > 1;
      list.append(enableSwipeDelete(el('div', { class: `page-item${active ? ' active' : ''}`, onclick: () => this.store.setPage(page.id) }, [
        el('span', {
          class: 'page-name', text: page.name, title: 'Doble clic para renombrar',
          ondblclick: (e) => {
            e.stopPropagation();
            const name = prompt('Nombre de la página:', page.name);
            if (name) this.store.renamePage(page.id, name);
          },
        }),
        el('span', { class: 'page-actions' }, [
          el('button', { html: ic('up', 13), title: 'Subir', onclick: (e) => { e.stopPropagation(); this.store.movePage(page.id, -1); } }),
          el('button', { html: ic('down', 13), title: 'Bajar', onclick: (e) => { e.stopPropagation(); this.store.movePage(page.id, 1); } }),
          el('button', { html: ic('duplicate', 13), title: 'Duplicar', onclick: (e) => { e.stopPropagation(); this.store.duplicatePage(page.id); } }),
          el('button', { html: ic('trash', 13), title: 'Eliminar', onclick: (e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${page.name}"?`)) this.store.deletePage(page.id); } }),
        ]),
      ]), () => {
        if (canDelete && confirm(`¿Eliminar "${page.name}"?`)) this.store.deletePage(page.id);
        else this.render(); // restaura la fila si se canceló
      }));
    }
    body.append(list);

    // Ajustes de la página activa
    const page = this.store.page;
    body.append(
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

  /* ── Capas ─────────────────────────────────────────── */

  #renderLayers(body) {
    const nodes = this.store.pageNodes();
    if (!nodes.length) {
      body.append(el('p', { class: 'panel-hint', text: 'La página está vacía. Añade piezas y dale vida.' }));
      return;
    }
    // Búsqueda de capas (proyectos grandes)
    body.append(el('input', {
      class: 'input block', type: 'search', placeholder: 'Buscar capa…', value: this.layerQuery || '',
      oninput: (e) => { this.layerQuery = e.target.value; this.render(); },
    }));
    const q = (this.layerQuery || '').toLowerCase();
    const list = el('div', { class: 'layer-list' });
    // De arriba (último en pintar) a abajo — arrastra para reordenar
    for (const node of [...nodes].reverse()) {
      if (q && !node.name.toLowerCase().includes(q)) continue;
      const selected = this.store.selection.includes(node.id);
      list.append(enableSwipeDelete(el('div', {
        class: `layer-item${selected ? ' active' : ''}`,
        draggable: 'true',
        // Pulsación larga (táctil) = añadir a la selección múltiple
        oncontextmenu: (e) => {
          e.preventDefault();
          this.store.select(node.id, true);
          if (navigator.vibrate) navigator.vibrate(10);
        },
        ondragstart: (e) => { e.dataTransfer.setData('text/wb-layer', node.id); e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('drop-hint'); },
        ondragleave: (e) => e.currentTarget.classList.remove('drop-hint'),
        ondrop: (e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drop-hint');
          const dragId = e.dataTransfer.getData('text/wb-layer');
          if (!dragId || dragId === node.id) return;
          this.store.snapshot('layer');
          const arr = this.store.page.nodes;
          const from = arr.indexOf(dragId);
          arr.splice(from, 1);
          arr.splice(arr.indexOf(node.id), 0, dragId);
          this.store.commit();
        },
        onclick: (e) => this.store.select(node.id, e.shiftKey),
      }, [
        el('span', { class: 'layer-grip', html: ic('drag', 13), title: 'Arrastra para reordenar' }),
        el('span', { class: 'layer-icon', html: typeIcon(node.type, 15) }),
        el('span', { class: 'layer-name', text: node.name, title: node.name }),
        el('span', { class: 'layer-actions' }, [
          el('button', { html: ic('up', 13), title: 'Subir capa', onclick: (e) => { e.stopPropagation(); this.store.moveLayer(node.id, 1); } }),
          el('button', { html: ic('down', 13), title: 'Bajar capa', onclick: (e) => { e.stopPropagation(); this.store.moveLayer(node.id, -1); } }),
          el('button', { html: ic(node.locked ? 'lock' : 'unlock', 13), title: 'Bloquear', onclick: (e) => { e.stopPropagation(); this.store.toggleFlag(node.id, 'locked'); } }),
          el('button', { html: ic(node.hidden ? 'eyeOff' : 'eye', 13), title: 'Ocultar', onclick: (e) => { e.stopPropagation(); this.store.toggleFlag(node.id, 'hidden'); } }),
          el('button', { html: ic('trash', 13), title: 'Eliminar', onclick: (e) => { e.stopPropagation(); this.store.removeNodes([node.id]); } }),
        ]),
      ]), () => {
        this.store.removeNodes([node.id]);
        showSnack(`"${node.name}" eliminada`, 'Deshacer', () => this.store.undo());
      }));
    }
    body.append(list);
  }

  #field(label, control) {
    return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
  }
}
