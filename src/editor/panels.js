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

import { el, esc, formatBytes } from '../utils/helpers.js';
import { Components, CATEGORIES } from '../components/registry.js';
import { BLOCKS } from '../storage/templates.js';
import { ASSET_KINDS, ACCEPT_ATTR } from '../assets/assetManager.js';

export class Panels {
  constructor(store, assets, view) {
    this.store = store;
    this.assets = assets;
    this.view = view;
    this.root = document.getElementById('left-panel');
    this.tab = 'componentes';
    this.assetFilter = { kind: null, query: '' };

    store.on('change', () => { if (this.tab === 'capas' || this.tab === 'paginas') this.render(); });
    store.on('page', () => this.render());
    store.on('selection', () => { if (this.tab === 'capas') this.render(); });
    assets.on('change', () => { if (this.tab === 'assets') this.render(); });

    this.#setupCanvasDrop();
    this.render();
  }

  render() {
    this.root.innerHTML = '';
    const tabs = el('div', { class: 'panel-tabs' }, ['componentes', 'assets', 'paginas', 'capas'].map((name) =>
      el('button', {
        class: `tab-btn${this.tab === name ? ' active' : ''}`,
        text: { componentes: 'Piezas', assets: 'Assets', paginas: 'Páginas', capas: 'Capas' }[name],
        onclick: () => { this.tab = name; this.render(); },
      })));
    this.root.append(tabs);
    const body = el('div', { class: 'panel-body' });
    this.root.append(body);
    ({
      componentes: () => this.#renderComponents(body),
      assets: () => this.#renderAssets(body),
      paginas: () => this.#renderPages(body),
      capas: () => this.#renderLayers(body),
    })[this.tab]();
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
      }, [el('span', { class: 'palette-icon', text: block.icon }), el('span', { text: block.label })]));
    }
    body.append(blockList);

    for (const cat of CATEGORIES) {
      body.append(el('h4', { class: 'panel-heading', text: cat }));
      const grid = el('div', { class: 'palette-grid' });
      for (const [type, def] of Object.entries(Components)) {
        if (def.cat !== cat) continue;
        const item = el('div', {
          class: 'palette-item', draggable: 'true', title: `Arrastra al lienzo o haz clic`,
          ondragstart: (e) => e.dataTransfer.setData('application/x-wb-component', type),
          onclick: () => this.#addAtCenter(type),
        }, [el('span', { class: 'palette-icon', text: def.icon }), el('span', { text: def.label })]);
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
      el('button', { class: 'btn primary block', text: '⬆ Subir desde galería / disco', onclick: () => input.click() }),
      el('input', {
        class: 'input block', type: 'search', placeholder: 'Buscar por nombre o etiqueta…',
        value: this.assetFilter.query,
        oninput: (e) => { this.assetFilter.query = e.target.value; this.#renderAssetGrid(); },
      }),
      el('div', { class: 'chip-row' }, [
        el('button', { class: `chip${!this.assetFilter.kind ? ' active' : ''}`, text: 'Todo', onclick: () => { this.assetFilter.kind = null; this.render(); } }),
        ...Object.entries(ASSET_KINDS).filter(([k]) => k !== 'svg').map(([kind, meta]) =>
          el('button', {
            class: `chip${this.assetFilter.kind === kind ? ' active' : ''}`, text: meta.icon,
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
          ? el('img', { src: asset.data, class: 'asset-thumb', draggable: 'false' })
          : el('div', { class: 'asset-thumb kind-icon', text: ASSET_KINDS[asset.kind].icon });
      const card = el('div', {
        class: 'asset-card', draggable: 'true',
        title: `${asset.name} · ${formatBytes(asset.size)} · carpeta: ${asset.folder}`,
        ondragstart: (e) => e.dataTransfer.setData('application/x-wb-asset', asset.id),
        onclick: () => this.#useAsset(asset),
      }, [
        preview,
        el('span', { class: 'asset-name', text: asset.name }),
        el('button', {
          class: 'asset-del', text: '×', title: 'Eliminar asset',
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
    body.append(el('button', { class: 'btn primary block', text: '+ Nueva página', onclick: () => this.store.addPage() }));
    const list = el('div', { class: 'page-list' });
    for (const page of this.store.project.pages) {
      const active = page.id === this.store.pageId;
      list.append(el('div', { class: `page-item${active ? ' active' : ''}`, onclick: () => this.store.setPage(page.id) }, [
        el('span', {
          class: 'page-name', text: page.name, title: 'Doble clic para renombrar',
          ondblclick: (e) => {
            e.stopPropagation();
            const name = prompt('Nombre de la página:', page.name);
            if (name) this.store.renamePage(page.id, name);
          },
        }),
        el('span', { class: 'page-actions' }, [
          el('button', { text: '↑', title: 'Subir', onclick: (e) => { e.stopPropagation(); this.store.movePage(page.id, -1); } }),
          el('button', { text: '↓', title: 'Bajar', onclick: (e) => { e.stopPropagation(); this.store.movePage(page.id, 1); } }),
          el('button', { text: '⧉', title: 'Duplicar', onclick: (e) => { e.stopPropagation(); this.store.duplicatePage(page.id); } }),
          el('button', { text: '×', title: 'Eliminar', onclick: (e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${page.name}"?`)) this.store.deletePage(page.id); } }),
        ]),
      ]));
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
      this.#field('Fondo', el('input', {
        class: 'input', type: 'text', value: page.background, placeholder: '#0b1020 o gradiente CSS',
        onchange: (e) => this.store.updatePage(page.id, { background: e.target.value }),
      })),
      this.#field('Transición de entrada', el('select', {
        class: 'input',
        onchange: (e) => this.store.updatePage(page.id, { transition: e.target.value }),
      }, ['fade', 'slide', 'zoom', 'blur', 'ninguna'].map((t) =>
        el('option', { value: t, text: t, selected: page.transition === t ? 'true' : null })))),
    );
  }

  /* ── Capas ─────────────────────────────────────────── */

  #renderLayers(body) {
    const nodes = this.store.pageNodes();
    if (!nodes.length) {
      body.append(el('p', { class: 'panel-hint', text: 'La página está vacía. Añade componentes desde la pestaña Piezas.' }));
      return;
    }
    const list = el('div', { class: 'layer-list' });
    // De arriba (último en pintar) a abajo
    for (const node of [...nodes].reverse()) {
      const selected = this.store.selection.includes(node.id);
      list.append(el('div', {
        class: `layer-item${selected ? ' active' : ''}`,
        onclick: (e) => this.store.select(node.id, e.shiftKey),
      }, [
        el('span', { class: 'layer-icon', text: Components[node.type]?.icon || '▢' }),
        el('span', { class: 'layer-name', text: node.name, title: node.name }),
        el('span', { class: 'layer-actions' }, [
          el('button', { text: '↑', title: 'Subir capa', onclick: (e) => { e.stopPropagation(); this.store.moveLayer(node.id, 1); } }),
          el('button', { text: '↓', title: 'Bajar capa', onclick: (e) => { e.stopPropagation(); this.store.moveLayer(node.id, -1); } }),
          el('button', { text: node.locked ? '🔒' : '🔓', title: 'Bloquear', onclick: (e) => { e.stopPropagation(); this.store.toggleFlag(node.id, 'locked'); } }),
          el('button', { text: node.hidden ? '🙈' : '👁', title: 'Ocultar', onclick: (e) => { e.stopPropagation(); this.store.toggleFlag(node.id, 'hidden'); } }),
          el('button', { text: '×', title: 'Eliminar', onclick: (e) => { e.stopPropagation(); this.store.removeNodes([node.id]); } }),
        ]),
      ]));
    }
    body.append(list);
  }

  #field(label, control) {
    return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
  }
}
