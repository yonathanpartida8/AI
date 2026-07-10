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
import { componentDef, FONTS } from '../components/registry.js';
import { PRESET_NAMES, EXIT_PRESET_NAMES, TRIGGERS, EASINGS, playAnimation, playExitAnimation } from '../animations/engine.js';

/** Gradientes rápidos para cualquier campo de fondo. */
const GRADIENT_SWATCHES = [
  '#0b1020', '#ffffff', '#6366f1',
  'linear-gradient(135deg,#7c3aed,#db2777)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(160deg,#0f0c29,#302b63,#24243e)',
  'radial-gradient(circle at 30% 30%,#f472b6,#7c3aed)',
];

/** Disparadores del sistema de lógica visual. */
const EVENT_TRIGGERS = {
  click: 'Al tocar / clic',
  doubletap: 'Doble toque',
  hold: 'Mantener presionado',
  hover: 'Al pasar el cursor',
  swipe: 'Al deslizar',
  appear: 'Al aparecer en pantalla',
};

/** Acciones encadenables. targetKind decide el selector de destino. */
const EVENT_ACTIONS = {
  goToPage: { label: 'Ir a página', targetKind: 'page' },
  showNode: { label: 'Mostrar elemento', targetKind: 'node' },
  hideNode: { label: 'Ocultar elemento', targetKind: 'node' },
  toggleNode: { label: 'Mostrar/ocultar elemento', targetKind: 'node' },
  playAnimation: { label: 'Ejecutar animación de…', targetKind: 'node' },
  playSound: { label: 'Reproducir sonido', targetKind: 'audio' },
  stopSounds: { label: 'Detener sonidos', targetKind: 'none' },
  setText: { label: 'Cambiar texto de…', targetKind: 'node', valueLabel: 'Nuevo texto' },
  setStyle: { label: 'Cambiar estilo de…', targetKind: 'node', valueLabel: 'CSS (ej: background:#f43f5e;opacity:.5)' },
  changeBackground: { label: 'Cambiar fondo de página', targetKind: 'none', valueLabel: 'Color o gradiente CSS' },
  burstHearts: { label: 'Estallido de corazones', targetKind: 'none', valueLabel: 'Emoji (ej: 💖)' },
  showMessage: { label: 'Mostrar mensaje flotante', targetKind: 'none', valueLabel: 'Texto del mensaje 💌' },
  vibrate: { label: 'Vibrar (móvil)', targetKind: 'none', valueLabel: 'Milisegundos' },
  openUrl: { label: 'Abrir URL', targetKind: 'none', valueLabel: 'https://…' },
  runJS: { label: 'Ejecutar JavaScript', targetKind: 'none', valueLabel: 'código JS (recibe `el`)' },
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
      this.#section('Código personalizado global', [
        el('p', { class: 'panel-hint', text: 'CSS y JavaScript propios que se aplican a TODO el sitio (editor, vista previa y export). Aquí puedes crear tus propias animaciones, fondos, partículas y efectos Canvas/WebGL.' }),
        this.#field('CSS global', el('textarea', {
          class: 'input code', rows: 5, text: this.store.project.custom?.css || '',
          placeholder: '@keyframes miAnim { … }\n.mi-clase { … }',
          onchange: (e) => {
            this.store.snapshot();
            this.store.project.custom.css = e.target.value;
            this.store.commit();
          },
        })),
        this.#field('JavaScript global (corre en vista previa y export)', el('textarea', {
          class: 'input code', rows: 5, text: this.store.project.custom?.js || '',
          placeholder: '// tu código…',
          onchange: (e) => {
            this.store.snapshot();
            this.store.project.custom.js = e.target.value;
            this.store.commit();
          },
        })),
      ]),
      el('p', { class: 'panel-hint', html: 'Selecciona un elemento del lienzo para editar sus propiedades.<br><br><b>Atajos:</b><br>Ctrl+Z / Ctrl+Y — deshacer/rehacer<br>Ctrl+C/V/D — copiar/pegar/duplicar<br>Ctrl+Shift+C/V — copiar/pegar estilo<br>Supr — eliminar · Flechas — mover<br>Espacio+arrastrar — pan · Ctrl+rueda — zoom<br>Doble clic en texto — editar' }),
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
      this.#field('Animación CSS propia (sobrescribe el preset)', el('input', {
        class: 'input code', value: anim.custom || '', placeholder: 'miAnim 2s ease infinite',
        title: 'Define @keyframes miAnim {...} en el CSS global y úsala aquí',
        onchange: (e) => this.#updateAnim(node, { custom: e.target.value.trim() }),
      })),
      el('button', {
        class: 'btn block', text: '▶ Previsualizar animación',
        onclick: () => {
          const elem = this.view.artboard.querySelector(`[data-id="${node.id}"]`);
          if (elem) playAnimation(elem, { ...node.animation, loop: false });
        },
      }),
    ]));

    /* Animación de SALIDA (al ocultarse mediante acciones) */
    const animOut = node.animationOut || { preset: 'fadeOut', duration: 450, easing: 'ease-in' };
    this.root.append(this.#section('Animación de salida', [
      el('p', { class: 'panel-hint', text: 'Se reproduce cuando otra acción oculta este elemento.' }),
      this.#field('Preset', this.#select(EXIT_PRESET_NAMES, animOut.preset, (v) => this.store.updateNode(node.id, 'animationOut', { preset: v }))),
      this.#field('Duración (ms)', el('input', {
        class: 'input', type: 'number', value: animOut.duration, min: 100, step: 50,
        onchange: (e) => this.store.updateNode(node.id, 'animationOut', { duration: +e.target.value }),
      })),
      el('button', {
        class: 'btn block', text: '▶ Previsualizar salida',
        onclick: () => {
          const elem = this.view.artboard.querySelector(`[data-id="${node.id}"]`);
          if (elem) {
            const anim = playExitAnimation(elem, node.animationOut);
            anim?.finished.then(() => anim.cancel()).catch(() => {});
          }
        },
      }),
    ]));

    /* Efectos de interacción: presión, hover, parallax, tilt 3D */
    this.root.append(this.#section('Efectos de interacción', [
      this.#field('Al tocar / presionar', this.#select(
        ['ninguno', 'escala', 'rebote', 'brillo', 'latido', 'sacudida', 'hundir', 'chispas'],
        node.effects?.press || 'ninguno',
        (v) => this.store.updateNode(node.id, 'effects', { press: v }),
      )),
      this.#field('Al pasar el cursor', this.#select(
        ['ninguno', 'elevar', 'zoom', 'brillo', 'flotar', 'girar'],
        node.effects?.hoverFx || 'ninguno',
        (v) => this.store.updateNode(node.id, 'effects', { hoverFx: v }),
      )),
      this.#field('Parallax al hacer scroll (-1 a 1)', el('input', {
        class: 'input', type: 'number', min: -1, max: 1, step: 0.05, value: node.effects?.parallax ?? 0,
        onchange: (e) => this.store.updateNode(node.id, 'effects', { parallax: +e.target.value }),
      })),
      this.#check('Tilt 3D (sigue el dedo/cursor con profundidad)', !!node.effects?.tilt,
        (v) => this.store.updateNode(node.id, 'effects', { tilt: v })),
      el('p', { class: 'panel-hint', text: 'Se ven en Vista previa y en el sitio exportado.' }),
    ]));

    /* Lógica visual: eventos con cadenas de acciones */
    const eventRows = (node.events || []).map((event, i) => this.#renderEventRow(node, event, i));
    this.root.append(this.#section('Lógica e interacción', [
      el('p', { class: 'panel-hint', text: 'Conecta este elemento con otros: un toque puede mostrar una foto, cambiar el fondo, sonar una canción y lanzar corazones — todo en cadena.' }),
      ...eventRows,
      el('button', {
        class: 'btn block', text: '+ Añadir evento',
        onclick: () => {
          this.store.snapshot();
          node.events ||= [];
          node.events.push({ on: 'click', actions: [{ action: 'burstHearts', target: '', value: '💖', delay: 0 }] });
          this.store.commit();
        },
      }),
    ]));

    /* Herramientas rápidas */
    this.root.append(this.#section('Herramientas', [
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: '⇤', title: 'Alinear a la izquierda de la página', onclick: () => this.store.alignSelection('left') }),
        el('button', { class: 'btn', text: '⇹', title: 'Centrar horizontalmente', onclick: () => this.store.alignSelection('centerX') }),
        el('button', { class: 'btn', text: '⇥', title: 'Alinear a la derecha', onclick: () => this.store.alignSelection('right') }),
        el('button', { class: 'btn', text: '⤒', title: 'Alinear arriba', onclick: () => this.store.alignSelection('top') }),
        el('button', { class: 'btn', text: '⇕', title: 'Centrar verticalmente', onclick: () => this.store.alignSelection('centerY') }),
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: '⬆ Al frente', title: 'Traer encima de todo', onclick: () => this.store.bringToFront(node.id) }),
        el('button', { class: 'btn', text: '⬇ Al fondo', title: 'Enviar detrás de todo', onclick: () => this.store.sendToBack(node.id) }),
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', text: '⎘ Copiar estilo', title: 'Ctrl+Shift+C', onclick: () => this.store.copyStyle() }),
        el('button', { class: 'btn', text: '⎗ Pegar estilo', title: 'Ctrl+Shift+V', onclick: () => this.store.pasteStyle() }),
      ]),
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
        const controls = [el('div', { class: 'color-field' }, [
          el('input', { type: 'color', value: isHex ? value : '#6366f1', oninput: (e) => commit(e.target.value) }),
          el('input', { class: 'input', value: value ?? '', placeholder: 'color / gradiente CSS', onchange: (e) => commit(e.target.value) }),
        ])];
        // Gradientes de un toque para los campos de fondo
        if (/background/i.test(field.key)) {
          controls.push(el('div', { class: 'swatch-row' }, GRADIENT_SWATCHES.map((g) =>
            el('button', { class: 'swatch', title: g, style: { background: g }, onclick: () => commit(g) }))));
        }
        return this.#field(field.label, el('div', {}, controls));
      }
      case 'select':
        return this.#field(field.label, this.#select(field.options, value, commit));
      case 'navTarget': {
        const opts = ['__next', '__prev', ...this.store.project.pages.map((p) => p.id)];
        return this.#field(field.label, this.#select(opts, value || '__next', commit,
          (id) => id === '__next' ? '→ Página siguiente' : id === '__prev' ? '← Página anterior'
            : (this.store.project.pages.find((p) => p.id === id)?.name || id)));
      }
      case 'font': {
        // Fuentes del sistema + fuentes subidas por el usuario (assets)
        const customFonts = this.assets.list({ kind: 'font' }).map((a) => this.assets.fontName(a));
        return this.#field(field.label, this.#select([...FONTS, ...customFonts], value || 'system-ui', commit));
      }
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
    const commit = () => { this.store.commit(); };
    const snap = () => { this.store.snapshot(); };

    const actionRow = (action, ai) => {
      const def = EVENT_ACTIONS[action.action] || EVENT_ACTIONS.burstHearts;
      const controls = [
        this.#select(Object.keys(EVENT_ACTIONS), action.action,
          (v) => { snap(); action.action = v; action.target = ''; action.value = ''; commit(); },
          (k) => EVENT_ACTIONS[k].label),
      ];
      if (def.targetKind === 'page') {
        const pageOpts = ['__next', '__prev', ...this.store.project.pages.map((p) => p.id)];
        controls.push(this.#select(pageOpts, action.target,
          (v) => { snap(); action.target = v; commit(); },
          (id) => id === '__next' ? '→ Página siguiente' : id === '__prev' ? '← Página anterior'
            : '→ ' + (this.store.project.pages.find((p) => p.id === id)?.name || id)));
      } else if (def.targetKind === 'node') {
        const nodes = this.store.pageNodes().filter((n) => n.id !== node.id);
        controls.push(this.#select(['', ...nodes.map((n) => n.id)], action.target,
          (v) => { snap(); action.target = v; commit(); },
          (id) => id ? '→ ' + (this.store.node(id)?.name || id) : '→ este elemento'));
      } else if (def.targetKind === 'audio') {
        const sounds = this.assets.list({ kind: 'audio' });
        controls.push(this.#select(sounds.map((a) => a.id), action.target,
          (v) => { snap(); action.target = v; commit(); },
          (id) => '♫ ' + (this.assets.get(id)?.name || id)));
      }
      if (def.valueLabel) {
        controls.push(el(action.action === 'runJS' ? 'textarea' : 'input', {
          class: 'input', rows: 3, placeholder: def.valueLabel,
          value: action.action === 'runJS' ? null : (action.value || ''),
          text: action.action === 'runJS' ? (action.value || '') : null,
          onchange: (e) => { snap(); action.value = e.target.value; commit(); },
        }));
      }
      controls.push(el('div', { class: 'action-foot' }, [
        el('label', {}, ['retardo ms ', el('input', {
          class: 'input mini', type: 'number', min: 0, step: 100, value: action.delay || 0,
          onchange: (e) => { snap(); action.delay = +e.target.value; commit(); },
        })]),
        el('button', {
          class: 'btn danger', text: '×', title: 'Quitar acción',
          onclick: () => { snap(); event.actions.splice(ai, 1); commit(); },
        }),
      ]));
      return el('div', { class: 'action-row' }, controls);
    };

    return el('div', { class: 'event-block' }, [
      el('div', { class: 'event-head' }, [
        this.#select(Object.keys(EVENT_TRIGGERS), event.on,
          (v) => { snap(); event.on = v; commit(); }, (k) => EVENT_TRIGGERS[k]),
        el('button', {
          class: 'btn danger', text: '× Evento',
          onclick: () => { snap(); node.events.splice(index, 1); commit(); },
        }),
      ]),
      ...(event.actions || []).map(actionRow),
      el('button', {
        class: 'btn block', text: '+ Encadenar acción',
        onclick: () => { snap(); event.actions.push({ action: 'playSound', target: '', value: '', delay: 200 }); commit(); },
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
