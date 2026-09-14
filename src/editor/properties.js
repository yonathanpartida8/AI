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

import { el, getPath, setPath, debounce, showSnack, poner } from '../utils/helpers.js';
import { ic } from './icons.js';
import { openColorPicker } from './colorPicker.js';
import { componentDef, FONTS } from '../components/registry.js';
import { PRESET_NAMES, EXIT_PRESET_NAMES, TRIGGERS, EASINGS, playAnimation, playExitAnimation } from '../animations/engine.js';
import { makeSheetDismissable } from './bottomSheet.js';

/** Gradientes rápidos para cualquier campo de fondo. */
const GRADIENT_SWATCHES = [
  '#0b1020', '#ffffff', '#6366f1',
  'linear-gradient(135deg,#7c3aed,#db2777)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(160deg,#0f0c29,#302b63,#24243e)',
  'radial-gradient(circle at 30% 30%,#f472b6,#7c3aed)',
  /* Texturas */
  'repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 2px,transparent 2px 12px), #17121f',
  'radial-gradient(rgba(255,255,255,.14) 1px, transparent 1.4px) 0 0/16px 16px, #141019',
  'repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 24px), repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 24px), #100c16',
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
  setVar: { label: 'Definir variable', targetKind: 'none', valueLabel: 'toques = toques + 1' },
  ifVar: { label: 'Continuar solo si…', targetKind: 'none', valueLabel: 'toques >= 5' },
  openUrl: { label: 'Abrir URL', targetKind: 'none', valueLabel: 'https://…' },
  runJS: { label: 'Ejecutar JavaScript', targetKind: 'none', valueLabel: 'código JS (recibe `el`)' },
};

/* ══ PERFILES POR TIPO DE ELEMENTO ═══════════════════════
 *
 * El inspector enseñaba las MISMAS ocho secciones para todo: daba
 * igual que tuvieras una foto o un texto, salían filtros de imagen,
 * tipografía, animaciones de salida y lógica de eventos, todo junto.
 * Encontrar lo que buscabas era recorrer una lista.
 *
 * Ahora cada familia declara qué se ve arriba (`titulo` de su sección
 * propia) y qué acción rápida tiene sentido para ella. Lo que no es
 * de uso diario —animación, efectos, filtros, lógica— se va a «Más
 * opciones», un panel secundario que se abre cuando hace falta.
 */
const FAMILIAS = {
  imagen: {
    tipos: ['image', 'gif', 'polaroid', 'photo3d', 'gallery'],
    titulo: 'La imagen', icono: 'image',
    rapida: { icono: 'cambiar', texto: 'Cambiar', campo: 'props.assetId' },
  },
  texto: {
    tipos: ['text', 'typewriter', 'button', 'navButton'],
    titulo: 'El texto', icono: 'type',
    rapida: { icono: 'type', texto: 'Escribir', campo: 'props.text' },
  },
  forma: {
    tipos: ['shape', 'divider', 'icon', 'container', 'section'],
    titulo: 'La forma', icono: 'diamond',
    rapida: { icono: 'paleta', texto: 'Color', campo: 'styles.background' },
  },
  medios: {
    tipos: ['video', 'audio', 'musicPlayer'],
    titulo: 'La reproducción', icono: 'play',
    rapida: { icono: 'cambiar', texto: 'Cambiar', campo: 'props.assetId' },
  },
  fondo: {
    tipos: ['particles', 'gradientBg', 'floatingEmojis'],
    titulo: 'El fondo', icono: 'sparkles',
    rapida: { icono: 'paleta', texto: 'Color', campo: 'props.color' },
  },
  romantico: {
    tipos: ['loveLetter', 'timeline', 'hiddenMessage', 'heartButton', 'countdown', 'heart3d'],
    titulo: 'El detalle', icono: 'heart',
    rapida: null,
  },
};

/** Qué familia es un tipo de componente (con reserva genérica). */
function familiaDe(tipo) {
  for (const [nombre, f] of Object.entries(FAMILIAS)) {
    if (f.tipos.includes(tipo)) return { nombre, ...f };
  }
  return { nombre: 'otros', titulo: 'Ajustes', icono: 'sliders', rapida: null };
}

export class PropertiesPanel {
  constructor(store, assets, view) {
    this.store = store;
    this.assets = assets;
    this.view = view;
    this.root = document.getElementById('right-panel');
    // Reconstruir el panel es caro: en ráfagas de edición (arrastres,
    // flechas) se difiere — el lienzo mantiene sus FPS y el panel se
    // pone al día 100 ms después del último cambio.
    this.scheduleRender = debounce(() => this.render(), 100);
    store.on('selection', () => this.render());
    store.on('change', () => this.scheduleRender());
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
    poner(this.root, 
      el('h3', { class: 'props-title', text: 'Proyecto' }),
      // Todo en tarjetas, igual que cuando hay algo seleccionado: el
      // panel mantiene el mismo ritmo tenga o no selección.
      this.#section('Nombre y lienzo', [
        this.#field('Nombre del proyecto', el('input', {
          class: 'input', value: this.store.project.meta.name,
          onchange: (e) => { this.store.snapshot(); this.store.project.meta.name = e.target.value; this.store.commit(); },
        })),
        this.#check('Mostrar cuadrícula', this.store.project.settings.grid.visible, (v) => {
          this.store.project.settings.grid.visible = v; this.store.commit();
        }),
        this.#check('Ajustar a la cuadrícula', this.store.project.settings.grid.snap, (v) => {
          this.store.project.settings.grid.snap = v; this.store.commit();
        }),
      ]),
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

  /**
   * SELECCIÓN MÚLTIPLE.
   *
   * Con varias piezas cambian las herramientas: ya no interesa el
   * ancho de ninguna en concreto, interesa cómo se colocan ENTRE
   * ELLAS. Antes esto eran cinco flechas de teclado (⇤ ⇹ ⇥ ⤒ ⇕)
   * haciendo de botones y nada más.
   */
  #renderMulti(nodes) {
    const agrupadas = nodes.filter((n) => n.groupId).length;
    const todasJuntas = agrupadas === nodes.length && nodes.length > 1
      && new Set(nodes.map((n) => n.groupId)).size === 1;

    const alinear = (modo, icono, texto) => el('button', {
      class: 'btn btn-ic', html: ic(icono), title: texto, 'aria-label': texto,
      onclick: () => this.store.alignSelection(modo),
    });
    const repartir = (eje, icono, texto) => el('button', {
      class: `btn btn-ic${nodes.length < 3 ? ' apagado' : ''}`,
      html: ic(icono), title: nodes.length < 3 ? `${texto} — hacen falta 3 o más` : texto,
      disabled: nodes.length < 3 ? 'true' : null,
      onclick: () => this.store.distributeSelection(eje),
    });

    poner(this.root, 
      el('div', { class: 'props-cabecera' }, [
        el('span', { class: 'props-tipo fam-multi', html: ic('agrupar') }),
        el('h3', { class: 'props-title', text: `${nodes.length} piezas` }),
      ]),
      todasJuntas ? el('div', { class: 'props-estados' }, [
        el('span', { class: 'estado junta', html: `${ic('agrupar')}<span>Agrupadas</span>` }),
      ]) : null,

      el('div', { class: 'acciones-rapidas' }, [
        todasJuntas
          ? this.#accion('desagrupar', 'Separar', () => this.store.ungroupSelection(), true)
          : this.#accion('agrupar', 'Agrupar', () => {
            this.store.groupSelection();
            showSnack('Ahora se mueven juntas');
          }),
        this.#accion('duplicate', 'Duplicar', () => this.store.duplicateNodes()),
        this.#accion('front', 'Al frente', () => nodes.forEach((n) => this.store.bringToFront(n.id))),
        this.#accion('back', 'Al fondo', () => [...nodes].reverse().forEach((n) => this.store.sendToBack(n.id))),
        this.#accion('trash', 'Eliminar', () => this.store.removeNodes(), false, true),
      ]),

      this.#section('Colocarlas', [
        el('p', { class: 'panel-hint', text: 'Se alinean entre ellas, respecto a la caja que las envuelve.' }),
        el('div', { class: 'btn-row' }, [
          alinear('left', 'alinIzq', 'Pegar a la izquierda'),
          alinear('centerX', 'alinCentroX', 'Centrar en horizontal'),
          alinear('right', 'alinDer', 'Pegar a la derecha'),
          repartir('x', 'repartirX', 'Repartir en horizontal'),
        ]),
        el('div', { class: 'btn-row' }, [
          alinear('top', 'alinArriba', 'Pegar arriba'),
          alinear('centerY', 'alinCentroY', 'Centrar en vertical'),
          alinear('bottom', 'alinAbajo', 'Pegar abajo'),
          repartir('y', 'repartirY', 'Repartir en vertical'),
        ]),
      ]),

      this.#section('Tamaño del conjunto', [
        el('p', { class: 'panel-hint', text: 'Crecen todas a la vez y la distancia entre ellas también: la composición no se desarma.' }),
        this.#scaleSlider(nodes[0]),
      ]),
    );
  }

  /**
   * INSPECTOR CONTEXTUAL.
   *
   * Antes esto pintaba las MISMAS ocho secciones para todo: daba
   * igual que hubieras tocado una foto o un texto, salían filtros de
   * imagen, tipografía, animación de salida y lógica de eventos, uno
   * detrás de otro. Encontrar lo tuyo era recorrer la lista entera.
   *
   * Ahora arriba va SOLO lo propio del elemento y su tamaño; lo que
   * no se toca todos los días vive en «Más opciones». Nada se ha
   * perdido: ha cambiado de sitio.
   */
  #renderNode(node) {
    const def = componentDef(node.type);
    const familia = familiaDe(node.type);

    /* ── Identidad y estado ─────────────────────────────── */
    const estados = [];
    if (node.locked) estados.push(['fija', 'lock', 'Bloqueada']);
    if (node.hidden) estados.push(['oculta', 'eyeOff', 'Oculta']);
    if (this.store.device !== 'desktop') {
      estados.push(['aparte', 'mobile', `Solo en ${this.store.device === 'tablet' ? 'Tablet' : 'Móvil'}`]);
    }

    poner(this.root, 
      el('div', { class: 'props-cabecera' }, [
        el('span', { class: `props-tipo fam-${familia.nombre}`, html: ic(familia.icono), title: def.label }),
        el('input', {
          class: 'input name-input', value: node.name, 'aria-label': 'Nombre del elemento',
          onchange: (e) => this.store.updateNode(node.id, 'root', { name: e.target.value }),
        }),
      ]),
      estados.length
        ? el('div', { class: 'props-estados' }, estados.map(([cls, icono, texto]) =>
          el('span', { class: `estado ${cls}`, html: `${ic(icono)}<span>${texto}</span>` })))
        : null,
    );

    /* ── Acciones rápidas: lo de siempre, siempre a mano ── */
    poner(this.root, el('div', { class: 'acciones-rapidas' }, [
      this.#accion('duplicate', 'Duplicar', () => this.store.duplicateNodes([node.id])),
      this.#accion('front', 'Al frente', () => this.store.bringToFront(node.id)),
      this.#accion('back', 'Al fondo', () => this.store.sendToBack(node.id)),
      this.#accion(node.locked ? 'lock' : 'unlock', node.locked ? 'Soltar' : 'Fijar',
        () => this.store.toggleFlag(node.id, 'locked'), node.locked),
      this.#accion('trash', 'Eliminar', () => this.store.removeNodes([node.id]), false, true),
    ]));

    /* ── 1. Lo propio del elemento, primero y abierto ───── */
    const fields = def.schema.map((field) => this.#renderSchemaField(node, field)).filter(Boolean);
    if (fields.length) poner(this.root, this.#section(familia.titulo, fields));

    /* ── 2. Tamaño y posición ───────────────────────────── */
    const frame = this.store.frame(node);
    const grid = el('div', { class: 'frame-grid' });
    for (const [key, label] of [['x', 'X'], ['y', 'Y'], ['w', 'Ancho'], ['h', 'Alto'], ['rotation', 'Giro °'], ['scale', 'Escala'], ['opacity', 'Opacidad']]) {
      poner(grid, this.#field(label, el('input', {
        class: 'input', type: 'number', value: Math.round((frame[key] ?? 0) * 100) / 100,
        step: key === 'scale' || key === 'opacity' ? 0.05 : 1,
        onchange: (e) => {
          this.store.snapshot();
          this.store.updateNode(node.id, 'frame', { [key]: +e.target.value });
        },
      })));
    }
    poner(this.root, this.#section('Tamaño y posición', [
      this.#scaleSlider(node),
      grid,
      this.store.device !== 'desktop'
        ? el('button', {
            class: 'btn block', html: `${ic('undo')}<span>Quitar el ajuste de este tamaño</span>`,
            onclick: () => { this.store.snapshot(); this.store.clearResponsiveOverride(node); this.store.commit(); },
          })
        : null,
    ]));

    /* ── 3. Todo lo demás, a un toque ───────────────────── */
    poner(this.root, el('button', {
      class: 'btn block mas-opciones',
      html: `${ic('sliders')}<span>Más opciones</span>${ic('down')}`,
      title: 'Animación, efectos, filtros, lógica y alineación',
      onclick: () => this.#abrirMasOpciones(node),
    }));
  }

  /** Botón de acción rápida: icono grande arriba, nombre debajo. */
  #accion(icono, texto, alPulsar, activa = false, peligro = false) {
    return el('button', {
      class: `accion${activa ? ' activa' : ''}${peligro ? ' peligro' : ''}`,
      title: texto,
      onclick: alPulsar,
    }, [
      el('span', { class: 'accion-ic', html: ic(icono) }),
      el('span', { class: 'accion-lbl', text: texto }),
    ]);
  }

  /**
   * PANEL SECUNDARIO — lo que no es de uso diario.
   *
   * Animación, salida, efectos, filtros avanzados, lógica de eventos
   * y alineación. Se abre como hoja para no llenar el inspector de
   * cosas que la mayoría de las veces sobran.
   */
  #abrirMasOpciones(node) {
    document.querySelector('#mas-sheet')?.remove();
    const cerrar = () => {
      hoja.classList.remove('open');
      document.body.classList.remove('sheet-open');
      setTimeout(() => hoja.remove(), 340);
    };
    const hoja = el('aside', { id: 'mas-sheet', class: 'sheet' }, [
      el('h3', { class: 'sheet-title', text: `Más opciones · ${node.name}` }),
      el('div', { class: 'sheet-body' }, [
        this.#secAnimacion(node),
        this.#secSalida(node),
        this.#secEfectos(node),
        this.#secAvanzado(node),
        this.#secLogica(node),
        this.#secHerramientas(node),
      ]),
    ]);
    document.body.append(hoja);
    makeSheetDismissable(hoja, cerrar);
    // Primero se avisa a las demás hojas, DESPUÉS se escucha el aviso:
    // al revés, esta se cerraría a sí misma al nacer.
    document.dispatchEvent(new CustomEvent('wb:close-sheets'));
    document.addEventListener('wb:close-sheets', cerrar, { once: true });
    requestAnimationFrame(() => {
      hoja.classList.add('open');
      document.body.classList.add('sheet-open');
    });
  }

  /** Cómo entra el elemento en escena. */
  #secAnimacion(node) {
      /* Animación */
      const anim = node.animation;
      return this.#section('Cómo entra', [
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
          class: 'btn block', html: `${ic('play')}<span>Ver cómo entra</span>`,
          onclick: () => {
            const elem = this.view.artboard.querySelector(`[data-id="${node.id}"]`);
            if (elem) playAnimation(elem, { ...node.animation, loop: false });
          },
        }),
      ]);
  }

  /** Cómo se va cuando una acción lo oculta. */
  #secSalida(node) {
      /* Animación de SALIDA (al ocultarse mediante acciones) */
      const animOut = node.animationOut || { preset: 'fadeOut', duration: 450, easing: 'ease-in' };
      return this.#section('Cómo se va', [
        el('p', { class: 'panel-hint', text: 'Se reproduce cuando otra acción oculta este elemento.' }),
        this.#field('Preset', this.#select(EXIT_PRESET_NAMES, animOut.preset, (v) => this.store.updateNode(node.id, 'animationOut', { preset: v }))),
        this.#field('Duración (ms)', el('input', {
          class: 'input', type: 'number', value: animOut.duration, min: 100, step: 50,
          onchange: (e) => this.store.updateNode(node.id, 'animationOut', { duration: +e.target.value }),
        })),
        el('button', {
          class: 'btn block', html: `${ic('play')}<span>Ver cómo se va</span>`,
          onclick: () => {
            const elem = this.view.artboard.querySelector(`[data-id="${node.id}"]`);
            if (elem) {
              const anim = playExitAnimation(elem, node.animationOut);
              anim?.finished.then(() => anim.cancel()).catch(() => {});
            }
          },
        }),
      ]);
  }

  /** Respuesta al tocarlo, al pasar por encima y al hacer scroll. */
  #secEfectos(node) {
      /* Efectos de interacción: presión, hover, parallax, tilt 3D */
      return this.#section('Respuesta al tacto', [
        this.#field('Al tocar / presionar', this.#select(
          ['ninguno', 'ondas', 'escala', 'rebote', 'brillo', 'latido', 'sacudida', 'hundir', 'elevar', 'chispas'],
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
      ]);
  }

  /** Mezcla, filtros, deformación, sombra propia y capa. */
  #secAvanzado(node) {
      /* Avanzado (v10): mezcla, filtros, deformación, sombra propia, capa */
      const st = (key, v) => this.store.updateNode(node.id, 'styles', { [key]: v });
      const advNum = (label, key, min, max, step = 1, def = 0) => this.#field(label, el('input', {
        class: 'input', type: 'number', min, max, step, value: node.styles?.[key] ?? def,
        onchange: (e) => st(key, e.target.value === '' ? undefined : +e.target.value),
      }));
      return this.#section('Avanzado', [
        this.#field('Mezcla con el fondo', this.#select(
          ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'difference', 'exclusion', 'luminosity'],
          node.styles?.blendMode || 'normal', (v) => st('blendMode', v),
        )),
        advNum('Desenfoque del elemento (px)', 'fxBlur', 0, 40),
        advNum('Brillo (%)', 'fxBrightness', 0, 300, 5, 100),
        advNum('Contraste (%)', 'fxContrast', 0, 300, 5, 100),
        advNum('Saturación (%)', 'fxSaturate', 0, 300, 5, 100),
        advNum('Tono (girar °)', 'fxHue', 0, 360, 5),
        advNum('Escala de grises (%)', 'fxGrayscale', 0, 100, 5),
        advNum('Sepia (%)', 'fxSepia', 0, 100, 5),
        advNum('Inclinación X (°)', 'skewX', -45, 45),
        advNum('Inclinación Y (°)', 'skewY', -45, 45),
        this.#field('Sombra propia (CSS box-shadow)', el('input', {
          class: 'input', type: 'text', value: node.styles?.shadowCustom || '',
          placeholder: '0 12px 30px rgba(0,0,0,.4)',
          onchange: (e) => st('shadowCustom', e.target.value || undefined),
        })),
        this.#field('Transformar texto', this.#select(
          ['ninguna', 'uppercase', 'lowercase', 'capitalize'],
          node.styles?.textTransform || 'ninguna', (v) => st('textTransform', v),
        )),
        this.#field('Desbordamiento', this.#select(
          ['', 'hidden', 'visible'], node.styles?.overflow || '', (v) => st('overflow', v || undefined),
        )),
        advNum('Capa (z-index)', 'zIndex', -50, 200),
      ], true);
  }

  /** Eventos encadenados: qué pasa cuando lo tocan. */
  #secLogica(node) {
      /* Lógica visual: eventos con cadenas de acciones */
      const eventRows = (node.events || []).map((event, i) => this.#renderEventRow(node, event, i));
      return this.#section('Qué pasa al tocarlo', [
        el('p', { class: 'panel-hint', text: 'Conecta este elemento con otros: un toque puede mostrar una foto, cambiar el fondo, sonar una canción y lanzar corazones — todo en cadena.' }),
        ...eventRows,
        el('button', {
          class: 'btn block', html: `${ic('plus')}<span>Añadir un evento</span>`,
          onclick: () => {
            this.store.snapshot();
            node.events ||= [];
            node.events.push({ on: 'click', actions: [{ action: 'burstHearts', target: '', value: '💖', delay: 0 }] });
            this.store.commit();
          },
        }),
      ]);
  }

  /**
   * Alinear, repartir, ordenar en profundidad y copiar estilo.
   *
   * Aquí había flechas de teclado (⇤ ⇹ ⇥) y textos como
   * «Distribuir ↔» haciendo de botones: se veían como lo que eran,
   * caracteres sueltos. Ahora cada acción tiene su icono, dibujado
   * con la guía y las cajas que se pegan a ella.
   */
  #secHerramientas(node) {
    const alinear = (modo, icono, texto) => el('button', {
      class: 'btn btn-ic', html: ic(icono), title: texto, 'aria-label': texto,
      onclick: () => this.store.alignSelection(modo),
    });
    const repartir = (eje, icono, texto) => el('button', {
      class: 'btn btn-ic', html: ic(icono), title: texto, 'aria-label': texto,
      onclick: () => this.store.distributeSelection(eje),
    });
    return this.#section('Alinear y ordenar', [
      el('p', { class: 'panel-hint', text: 'Con una sola pieza, alinea respecto a la página.' }),
      el('div', { class: 'btn-row' }, [
        alinear('left', 'alinIzq', 'Pegar a la izquierda'),
        alinear('centerX', 'alinCentroX', 'Centrar en horizontal'),
        alinear('right', 'alinDer', 'Pegar a la derecha'),
        repartir('x', 'repartirX', 'Repartir en horizontal (3 o más)'),
      ]),
      el('div', { class: 'btn-row' }, [
        alinear('top', 'alinArriba', 'Pegar arriba'),
        alinear('centerY', 'alinCentroY', 'Centrar en vertical'),
        alinear('bottom', 'alinAbajo', 'Pegar abajo'),
        repartir('y', 'repartirY', 'Repartir en vertical (3 o más)'),
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', html: `${ic('front')}<span>Al frente</span>`, onclick: () => this.store.bringToFront(node.id) }),
        el('button', { class: 'btn', html: `${ic('back')}<span>Al fondo</span>`, onclick: () => this.store.sendToBack(node.id) }),
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn', html: `${ic('copy')}<span>Copiar estilo</span>`, title: 'Ctrl+Shift+C', onclick: () => this.store.copyStyle() }),
        el('button', { class: 'btn', html: `${ic('check')}<span>Pegar estilo</span>`, title: 'Ctrl+Shift+V', onclick: () => this.store.pasteStyle() }),
      ]),
    ]);
  }

  /**
   * CONTROL DE ESCALA (barra vertical).
   *
   * Desliza hacia ARRIBA para agrandar y hacia ABAJO para reducir. No
   * es un zoom: reescribe los valores reales del elemento —caja,
   * tipografía, radios, bordes y espaciados— y, con varios elementos
   * seleccionados, también las distancias entre ellos.
   *
   * El deslizador vuelve al centro al soltar: así se puede seguir
   * agrandando sin llegar nunca a un tope.
   */
  #scaleSlider(node) {
    const MAX = 60;                       // recorrido útil en píxeles
    const paso = (dy) => 1 + (-dy / MAX) * 0.5;   // arriba = crecer
    const pill = el('div', { class: 'scale-thumb' });
    const via = el('div', { class: 'scale-track' }, [
      el('span', { class: 'scale-mark plus', html: ic('plus') }),
      pill,
      el('span', { class: 'scale-mark minus', html: ic('minus') }),
    ]);
    const lectura = el('span', { class: 'scale-read', text: '100%' });

    let arrastrando = false, y0 = 0, aplicado = 1, pid = null;
    const fijar = (dy) => {
      const objetivo = Math.min(1.6, Math.max(0.55, paso(dy)));
      // Solo se aplica el DELTA respecto a lo ya aplicado en este gesto
      const delta = objetivo / aplicado;
      if (Math.abs(delta - 1) > 0.002) {
        this.store.snapshot('escala');           // se coalesce en un paso
        this.store.scaleSelection(delta);
        aplicado = objetivo;
      }
      pill.style.transform = `translateY(${Math.max(-MAX, Math.min(MAX, dy))}px)`;
      lectura.textContent = `${Math.round(objetivo * 100)}%`;
    };
    via.addEventListener('pointerdown', (e) => {
      arrastrando = true; y0 = e.clientY; aplicado = 1; pid = e.pointerId;
      via.classList.add('dragging');
      try { via.setPointerCapture(pid); } catch { /* puntero sintético */ }
      e.preventDefault();
    });
    via.addEventListener('pointermove', (e) => {
      if (!arrastrando || e.pointerId !== pid) return;
      fijar(e.clientY - y0);
      e.preventDefault();
    });
    const soltar = () => {
      if (!arrastrando) return;
      arrastrando = false; pid = null;
      via.classList.remove('dragging');
      pill.style.transform = '';                 // el mando vuelve al centro
      lectura.textContent = '100%';
      if (navigator.vibrate) navigator.vibrate(8);
    };
    via.addEventListener('pointerup', soltar);
    via.addEventListener('pointercancel', soltar);

    // Botones para ajustes finos exactos (y accesibles con teclado)
    const boton = (etiqueta, factor, titulo) => el('button', {
      class: 'btn scale-step', text: etiqueta, title: titulo,
      onclick: () => { this.store.snapshot('escala'); this.store.scaleSelection(factor); },
    });
    const varios = this.store.selection.length > 1;
    return el('div', { class: 'scale-box' }, [
      via,
      el('div', { class: 'scale-side' }, [
        el('span', { class: 'field-label', text: varios ? `Escala del grupo (${this.store.selection.length})` : 'Escala del contenido' }),
        lectura,
        el('p', { class: 'panel-hint', text: 'Desliza la barra hacia arriba o abajo: todo lo de dentro crece o mengua a la vez.' }),
        el('div', { class: 'btn-row' }, [
          boton('−10%', 0.9, 'Reducir un 10 %'),
          boton('+10%', 1.1, 'Agrandar un 10 %'),
        ]),
      ]),
    ]);
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
        // Selector profesional: rueda de tono, alfa, cuentagotas y favoritos
        const textInput = el('input', { class: 'input', value: value ?? '', placeholder: 'color / gradiente CSS', onchange: (e) => commit(e.target.value) });
        const swatchBtn = el('button', {
          class: 'cp-open', title: 'Abrir selector de color',
          style: { background: value || 'transparent' },
          onclick: (e) => openColorPicker(e.currentTarget, value, (css) => {
            swatchBtn.style.background = css;
            textInput.value = css;
            commit(css);
          }),
        });
        const controls = [el('div', { class: 'color-field' }, [swatchBtn, textInput])];
        // Gradientes de un toque para los campos de fondo
        if (/background/i.test(field.key)) {
          controls.push(el('div', { class: 'swatch-row' }, GRADIENT_SWATCHES.map((g) =>
            el('button', { class: 'swatch', title: g, style: { background: g }, onclick: () => commit(g) }))));
        }
        return this.#field(field.label, el('div', {}, controls));
      }
      case 'select':
        return this.#field(field.label, this.#select(field.options, value, commit));
      case 'timelineItems': {
        // Editor visual de la línea de tiempo: eventos con fecha, título,
        // texto y foto, reordenables — sin tocar texto plano.
        const rows = String(value || '').split(';').map((r2) => r2.trim()).filter(Boolean)
          .map((r2) => { const [d = '', t = '', b2 = '', ph = ''] = r2.split('|').map((x) => x.trim()); return { d, t, b: b2, ph }; });
        const serialize = () => commit(rows.map((r2) => [r2.d, r2.t, r2.b, r2.ph].join(' | ')).join(' ; '));
        const photos = this.assets.list({ kind: 'image' });
        const wrap = el('div', { class: 'tl-editor' }, [
          ...rows.map((row, i) => el('div', { class: 'tl-row' }, [
            el('div', { class: 'tl-row-head' }, [
              el('input', { class: 'input', value: row.d, placeholder: 'Fecha', onchange: (e) => { row.d = e.target.value; serialize(); } }),
              el('button', { class: 'btn btn-ic', html: ic('up'), title: 'Subir', onclick: () => { if (i > 0) { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; serialize(); } } }),
              el('button', { class: 'btn btn-ic', html: ic('down'), title: 'Bajar', onclick: () => { if (i < rows.length - 1) { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; serialize(); } } }),
              el('button', { class: 'btn btn-ic danger', html: ic('close'), title: 'Quitar', onclick: () => { rows.splice(i, 1); serialize(); } }),
            ]),
            el('input', { class: 'input', value: row.t, placeholder: 'Título del recuerdo', onchange: (e) => { row.t = e.target.value; serialize(); } }),
            el('input', { class: 'input', value: row.b, placeholder: 'Qué pasó ese día…', onchange: (e) => { row.b = e.target.value; serialize(); } }),
            el('select', { class: 'input', onchange: (e) => { row.ph = e.target.value; serialize(); } }, [
              el('option', { value: '', text: 'Sin foto', selected: !row.ph ? 'true' : null }),
              ...photos.map((a2) => el('option', { value: a2.id, text: a2.name, selected: row.ph === a2.id ? 'true' : null })),
            ]),
          ])),
          el('button', {
            class: 'btn block', html: `${ic('plus')}<span>Añadir recuerdo</span>`,
            onclick: () => { rows.push({ d: 'Hoy', t: 'Un momento nuevo', b: '', ph: '' }); serialize(); },
          }),
        ]);
        return this.#field(field.label, wrap);
      }
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
          }, [el('option', { value: '', text: field.kind === 'audio' ? 'Añadir una pista…' : 'Añadir una imagen…' }), ...list.map((a) => el('option', { value: a.id, text: a.name }))]),
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
          class: 'btn danger btn-ic', html: ic('close'), title: 'Quitar acción',
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
          class: 'btn danger', html: `${ic('trash')}<span>Evento</span>`,
          onclick: () => { snap(); node.events.splice(index, 1); commit(); },
        }),
      ]),
      ...(event.actions || []).map(actionRow),
      el('button', {
        class: 'btn block', html: `${ic('plus')}<span>Encadenar otra acción</span>`,
        onclick: () => { snap(); event.actions.push({ action: 'playSound', target: '', value: '', delay: 200 }); commit(); },
      }),
    ]);
  }

  /* ── Helpers de UI ─────────────────────────────────── */

  #section(title, children, collapsed = false) {
    return el('details', { class: 'props-section', ...(collapsed ? {} : { open: 'true' }) }, [
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
