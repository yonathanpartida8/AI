/* ============================================================
 * editor/properties.js — Panel de propiedades (derecha)
 *
 * El panel NO conoce los componentes: se GENERA desde el schema
 * declarado en components/registry.js. Añadir un campo nuevo a
 * un componente = una línea en su schema.
 *
 * Secciones: Posición y tamaño · Propiedades del componente ·
 * Animación · Eventos · Responsive.
 * ============================================================ */

import { el, getPath, setPath } from '../utils/helpers.js';
import { componentDef } from '../components/registry.js';
import { PRESET_NAMES, TRIGGERS, EASINGS, playAnimation } from '../animations/engine.js';

const EVENT_ACTIONS = {
  goToPage: 'Ir a página',
  openUrl: 'Abrir URL',
  toggleNode: 'Mostrar/ocultar elemento',
  playAnimation: 'Ejecutar animación',
  playSound: 'Reproducir sonido',
};

export class PropertiesPanel {
  constructor(store, assets, view) {
    this.store = store;
    this.assets = assets;
    this.view = view;
    this.root = document.getElementById('right-panel');
    store.on('selection', () => this.render());
    store.on('change', () => this.render());
    store.on('device', () => this.render());
    this.render();
  }

  render() {
    this.root.innerHTML = '';
    const nodes = this.store.selectedNodes;
    if (!nodes.length) { this.#renderEmpty(); return; }
    if (nodes.length > 1) { this.#renderMulti(nodes); return; }
    this.#renderNode(nodes[0]);
  }

  #renderEmpty() {
    this.root.append(
      el('h3', { class: 'props-title', text: 'Proyecto' }),
      this.#field('Nombre del proyecto', el('input', {
        class: 'input', value: this.store.project.meta.name,
        onchange: (e) => { this.store.snapshot(); this.store.project.meta.name = e.target.value; this.store.commit(); },
      })),
      el('h4', { class: 'panel-heading', text: 'Rejilla y ajuste' }),
      this.#check('Mostrar cuadrícula', this.store.project.settings.grid.visible, (v) => {
        this.store.project.settings.grid.visible = v; this.store.commit();
      }),
      this.#check('Snap a cuadrícula', this.store.project.settings.grid.snap, (v) => {
        this.store.project.settings.grid.snap = v; this.store.commit();
      }),
      el('p', { class: 'panel-hint', html: 'Selecciona un elemento del lienzo para editar sus propiedades.<br><br><b>Atajos:</b><br>Ctrl+Z / Ctrl+Y — deshacer/rehacer<br>Ctrl+C/V/D — copiar/pegar/duplicar<br>Supr — eliminar · Flechas — mover<br>Espacio+arrastrar — pan · Ctrl+rueda — zoom<br>Doble clic en texto — editar' }),
    );
  }

  #renderMulti(nodes) {
    this.root.append(
      el('h3', { class: 'props-title', text: `${nodes.length} elementos` }),
      el('div', { class: 'btn-row' }, [
        ['left', '⇤'], ['centerX', '⇹'], ['right', '⇥'], ['top', '⤒'], ['centerY', '⇕'],
      ].map(([mode, label]) => el('button', { class: 'btn', text: label, title: `Alinear ${mode}`, onclick: () => this.store.alignSelection(mode) }))),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: '⧉ Duplicar', onclick: () => this.store.duplicateNodes() }),
        el('button', { class: 'btn danger', text: '× Eliminar', onclick: () => this.store.removeNodes() }),
      ]),
    );
  }

  #renderNode(node) {
    const frame = this.store.frame(node);
    const def = componentDef(node.type);

    this.root.append(
      el('h3', { class: 'props-title' }, [
        el('input', {
          class: 'input name-input', value: node.name,
          onchange: (e) => this.store.updateNode(node.id, 'root', { name: e.target.value }),
        }),
      ]),
      el('p', { class: 'device-note', text: this.store.device === 'desktop' ? 'Editando estilos base (Escritorio)' : `Override para ${this.store.device === 'tablet' ? 'Tablet' : 'Móvil'}` }),
    );

    /* Posición y tamaño */
    const grid = el('div', { class: 'frame-grid' });
    for (const [key, label] of [['x', 'X'], ['y', 'Y'], ['w', 'Ancho'], ['h', 'Alto'], ['rotation', 'Giro °'], ['scale', 'Escala'], ['opacity', 'Opacidad']]) {
      grid.append(this.#field(label, el('input', {
        class: 'input', type: 'number', value: Math.round((frame[key] ?? 0) * 100) / 100,
        step: key === 'scale' || key === 'opacity' ? 0.05 : 1,
        onchange: (e) => {
          this.store.snapshot();
          this.store.updateNode(node.id, 'frame', { [key]: +e.target.value });
        },
      })));
    }
    this.root.append(this.#section('Posición y tamaño', [grid,
      this.store.device !== 'desktop'
        ? el('button', {
            class: 'btn block', text: '↺ Quitar override de este dispositivo',
            onclick: () => { this.store.snapshot(); this.store.clearResponsiveOverride(node); this.store.commit(); },
          })
        : null,
    ]));

    /* Propiedades del componente (desde el schema) */
    const fields = def.schema.map((field) => this.#renderSchemaField(node, field)).filter(Boolean);
    this.root.append(this.#section(def.label, fields));

    /* Animación */
    const anim = node.animation;
    this.root.append(this.#section('Animación', [
      this.#field('Preset', this.#select(PRESET_NAMES, anim.preset, (v) => this.#updateAnim(node, { preset: v }))),
      this.#field('Disparador', this.#select(Object.keys(TRIGGERS), anim.trigger, (v) => this.#updateAnim(node, { trigger: v }), (k) => TRIGGERS[k])),
      this.#field('Duración (ms)', el('input', { class: 'input', type: 'number', value: anim.duration, min: 50, step: 50, onchange: (e) => this.#updateAnim(node, { duration: +e.target.value }) })),
      this.#field('Delay (ms)', el('input', { class: 'input', type: 'number', value: anim.delay, min: 0, step: 50, onchange: (e) => this.#updateAnim(node, { delay: +e.target.value }) })),
      this.#field('Curva', this.#select(EASINGS, anim.easing, (v) => this.#updateAnim(node, { easing: v }))),
      this.#check('Repetir en bucle', anim.loop, (v) => this.#updateAnim(node, { loop: v })),
      el('button', {
        class: 'btn block', text: '▶ Previsualizar animación',
        onclick: () => {
          const elem = this.view.artboard.querySelector(`[data-id="${node.id}"]`);
          if (elem) playAnimation(elem, { ...node.animation, loop: false });
        },
      }),
    ]));

    /* Eventos */
    const eventRows = (node.events || []).map((event, i) => this.#renderEventRow(node, event, i));
    this.root.append(this.#section('Eventos', [
      ...eventRows,
      el('button', {
        class: 'btn block', text: '+ Añadir evento',
        onclick: () => {
          this.store.snapshot();
          node.events ||= [];
          node.events.push({ on: 'click', action: 'goToPage', target: this.store.project.pages[0].id });
          this.store.commit();
        },
      }),
    ]));

    /* Acciones */
    this.root.append(el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn', text: '⧉ Duplicar', onclick: () => this.store.duplicateNodes([node.id]) }),
      el('button', { class: 'btn', text: node.locked ? '🔒' : '🔓', onclick: () => this.store.toggleFlag(node.id, 'locked') }),
      el('button', { class: 'btn danger', text: '× Eliminar', onclick: () => this.store.removeNodes([node.id]) }),
    ]));
  }

  #updateAnim(node, patch) { this.store.updateNode(node.id, 'animation', patch); }

  /* ── Campos generados desde el schema ──────────────── */

  #renderSchemaField(node, field) {
    const value = getPath(node, field.key);
    const commit = (v) => {
      this.store.snapshot();
      const [section, ...rest] = field.key.split('.');
      const patch = {};
      if (rest.length === 1) patch[rest[0]] = v;
      else setPath(patch, rest.join('.'), v);
      this.store.updateNode(node.id, section, patch);
    };

    switch (field.type) {
      case 'text':
        return this.#field(field.label, el('input', { class: 'input', value: value ?? '', onchange: (e) => commit(e.target.value) }));
      case 'textarea':
        return this.#field(field.label, el('textarea', { class: 'input', rows: 3, text: value ?? '', onchange: (e) => commit(e.target.value) }));
      case 'number':
        return this.#field(field.label, el('input', {
          class: 'input', type: 'number', value: value ?? 0, min: field.min, max: field.max, step: field.step ?? 1,
          onchange: (e) => commit(+e.target.value),
        }));
      case 'color': {
        const isHex = /^#[0-9a-f]{3,8}$/i.test(value || '');
        return this.#field(field.label, el('div', { class: 'color-field' }, [
          el('input', { type: 'color', value: isHex ? value : '#6366f1', oninput: (e) => commit(e.target.value) }),
          el('input', { class: 'input', value: value ?? '', placeholder: 'color / gradiente CSS', onchange: (e) => commit(e.target.value) }),
        ]));
      }
      case 'select':
        return this.#field(field.label, this.#select(field.options, value, commit));
      case 'checkbox':
        return this.#check(field.label, !!value, commit);
      case 'asset': {
        const list = this.assets.list({ kind: field.kind });
        const options = [{ id: '', name: '— ninguno —' }, ...list];
        return this.#field(field.label, el('select', {
          class: 'input',
          onchange: (e) => commit(e.target.value || null),
        }, options.map((a) => el('option', { value: a.id, text: a.name, selected: (value || '') === a.id ? 'true' : null }))));
      }
      case 'assetList': {
        const ids = value || [];
        const list = this.assets.list({ kind: field.kind });
        return this.#field(field.label, el('div', {}, [
          el('div', { class: 'mini-list' }, ids.map((id, i) => el('span', { class: 'mini-chip' }, [
            this.assets.get(id)?.name || '?',
            el('button', { text: '×', onclick: () => commit(ids.filter((_, j) => j !== i)) }),
          ]))),
          el('select', {
            class: 'input',
            onchange: (e) => { if (e.target.value) commit([...ids, e.target.value]); e.target.value = ''; },
          }, [el('option', { value: '', text: '+ añadir imagen…' }), ...list.map((a) => el('option', { value: a.id, text: a.name }))]),
        ]));
      }
      default:
        return null;
    }
  }

  #renderEventRow(node, event, index) {
    const update = (patch) => {
      this.store.snapshot();
      Object.assign(node.events[index], patch);
      this.store.commit();
    };
    const targetControl = () => {
      if (event.action === 'goToPage') {
        return this.#select(this.store.project.pages.map((p) => p.id), event.target, (v) => update({ target: v }),
          (id) => this.store.project.pages.find((p) => p.id === id)?.name || id);
      }
      if (event.action === 'openUrl') {
        return el('input', { class: 'input', value: event.target || '', placeholder: 'https://…', onchange: (e) => update({ target: e.target.value }) });
      }
      if (event.action === 'toggleNode' || event.action === 'playAnimation') {
        const nodes = this.store.pageNodes();
        return this.#select(nodes.map((n) => n.id), event.target, (v) => update({ target: v }), (id) => this.store.node(id)?.name || id);
      }
      if (event.action === 'playSound') {
        const sounds = this.assets.list({ kind: 'audio' });
        return this.#select(sounds.map((a) => a.id), event.target, (v) => update({ target: v }), (id) => this.assets.get(id)?.name || id);
      }
      return el('span');
    };
    return el('div', { class: 'event-row' }, [
      this.#select(['click', 'hover'], event.on, (v) => update({ on: v })),
      this.#select(Object.keys(EVENT_ACTIONS), event.action, (v) => update({ action: v, target: '' }), (k) => EVENT_ACTIONS[k]),
      targetControl(),
      el('button', {
        class: 'btn danger', text: '×',
        onclick: () => { this.store.snapshot(); node.events.splice(index, 1); this.store.commit(); },
      }),
    ]);
  }

  /* ── Helpers de UI ─────────────────────────────────── */

  #section(title, children) {
    return el('details', { class: 'props-section', open: 'true' }, [
      el('summary', { text: title }),
      el('div', { class: 'props-section-body' }, children),
    ]);
  }
  #field(label, control) {
    return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
  }
  #check(label, checked, onchange) {
    return el('label', { class: 'field check' }, [
      el('input', { type: 'checkbox', ...(checked ? { checked: 'true' } : {}), onchange: (e) => onchange(e.target.checked) }),
      el('span', { class: 'field-label', text: label }),
    ]);
  }
  #select(options, value, onchange, labelFor = (v) => v) {
    return el('select', { class: 'input', onchange: (e) => onchange(e.target.value) },
      options.map((opt) => el('option', { value: opt, text: labelFor(opt), selected: value === opt ? 'true' : null })));
  }
}
