/* ============================================================
 * components/registry.js — Sistema de Componentes
 *
 * Cada componente se define de forma DECLARATIVA:
 *  - label / icon / cat  → cómo aparece en la paleta.
 *  - size                → tamaño inicial al soltarlo en el lienzo.
 *  - defaults            → props y estilos iniciales del nodo JSON.
 *  - schema              → campos editables; el panel de propiedades
 *                          se GENERA automáticamente desde aquí.
 *  - accepts             → tipos de asset que puede recibir por drag.
 *
 * Añadir un componente nuevo = añadir una entrada aquí + un caso
 * de render en renderer/renderer.js. Nada más.
 * ============================================================ */

const FONTS = ['system-ui', 'Georgia', 'Courier New', 'Arial Black', 'Trebuchet MS', 'Verdana'];
const num = (key, label, min = 0, max = 400, step = 1) => ({ key, label, type: 'number', min, max, step });
const color = (key, label) => ({ key, label, type: 'color' });
const select = (key, label, options) => ({ key, label, type: 'select', options });
const check = (key, label) => ({ key, label, type: 'checkbox' });
const text = (key, label) => ({ key, label, type: 'text' });
const asset = (key, label, kind) => ({ key, label, type: 'asset', kind });

const STYLE_COMMON = [
  color('styles.background', 'Fondo'),
  num('styles.radius', 'Radio de borde', 0, 200),
  num('styles.borderWidth', 'Grosor de borde', 0, 20),
  color('styles.borderColor', 'Color de borde'),
  select('styles.shadow', 'Sombra', ['ninguna', 'suave', 'media', 'fuerte', 'neón']),
  num('styles.blur', 'Desenfoque fondo', 0, 40),
];

const TEXT_STYLE = [
  select('styles.fontFamily', 'Fuente', FONTS),
  num('styles.fontSize', 'Tamaño de letra', 8, 200),
  select('styles.fontWeight', 'Peso', ['300', '400', '600', '700', '900']),
  color('styles.color', 'Color de texto'),
  select('styles.textAlign', 'Alineación', ['left', 'center', 'right']),
  num('styles.letterSpacing', 'Espaciado letras', -5, 30, 0.5),
  num('styles.lineHeight', 'Interlineado', 0.8, 3, 0.05),
];

export const Components = {
  /* ── Elementos básicos ─────────────────────────────── */
  text: {
    label: 'Texto', icon: 'T', cat: 'Básicos', size: [320, 60],
    defaults: {
      props: { text: 'Doble clic para editar', tag: 'p' },
      styles: { fontSize: 28, color: '#e2e8f0', fontWeight: '600', textAlign: 'left', fontFamily: 'system-ui' },
    },
    schema: [
      { key: 'props.text', label: 'Contenido', type: 'textarea' },
      select('props.tag', 'Etiqueta HTML', ['h1', 'h2', 'h3', 'p', 'span']),
      ...TEXT_STYLE,
    ],
  },

  button: {
    label: 'Botón', icon: '▭', cat: 'Básicos', size: [180, 52],
    defaults: {
      props: { text: 'Haz clic' },
      styles: {
        fontSize: 16, color: '#ffffff', fontWeight: '700', textAlign: 'center', fontFamily: 'system-ui',
        background: '#6366f1', radius: 10, shadow: 'suave',
      },
    },
    schema: [text('props.text', 'Texto del botón'), ...TEXT_STYLE, ...STYLE_COMMON],
  },

  image: {
    label: 'Imagen', icon: '🖼', cat: 'Básicos', size: [320, 220], accepts: ['image'],
    defaults: {
      props: { assetId: null, fit: 'cover', alt: 'Imagen', filter: 'ninguno', filterAmount: 100 },
      styles: { radius: 8 },
    },
    schema: [
      asset('props.assetId', 'Imagen', 'image'),
      select('props.fit', 'Ajuste', ['cover', 'contain', 'fill']),
      select('props.filter', 'Filtro', ['ninguno', 'grises', 'sepia', 'brillo', 'contraste', 'saturado', 'invertido']),
      num('props.filterAmount', 'Intensidad filtro %', 0, 200),
      text('props.alt', 'Texto alternativo'),
      ...STYLE_COMMON,
    ],
  },

  gif: {
    label: 'GIF', icon: '🎞', cat: 'Básicos', size: [280, 210], accepts: ['gif'],
    defaults: {
      props: { assetId: null, playing: true, speed: 1, fit: 'cover' },
      styles: { radius: 8 },
    },
    schema: [
      asset('props.assetId', 'GIF animado', 'gif'),
      check('props.playing', 'Reproduciendo (loop infinito)'),
      select('props.fit', 'Ajuste', ['cover', 'contain', 'fill']),
      ...STYLE_COMMON,
    ],
  },

  video: {
    label: 'Vídeo', icon: '▶', cat: 'Básicos', size: [420, 240], accepts: ['video'],
    defaults: {
      props: { assetId: null, autoplay: true, loop: true, muted: true, controls: false, playOnScroll: false },
      styles: { radius: 10 },
    },
    schema: [
      asset('props.assetId', 'Vídeo MP4/WebM', 'video'),
      check('props.autoplay', 'Autoplay'),
      check('props.loop', 'Loop'),
      check('props.muted', 'Silenciado'),
      check('props.controls', 'Mostrar controles'),
      check('props.playOnScroll', 'Reproducir al entrar en pantalla'),
      ...STYLE_COMMON,
    ],
  },

  audio: {
    label: 'Audio', icon: '♫', cat: 'Básicos', size: [320, 60], accepts: ['audio'],
    defaults: { props: { assetId: null, autoplay: false, loop: false }, styles: { radius: 30, background: '#1e293b' } },
    schema: [asset('props.assetId', 'Archivo de audio', 'audio'), check('props.autoplay', 'Autoplay'), check('props.loop', 'Loop')],
  },

  icon: {
    label: 'Icono', icon: '★', cat: 'Básicos', size: [64, 64],
    defaults: { props: { glyph: '★' }, styles: { fontSize: 48, color: '#fbbf24', textAlign: 'center' } },
    schema: [text('props.glyph', 'Emoji / carácter'), num('styles.fontSize', 'Tamaño', 12, 300), color('styles.color', 'Color')],
  },

  shape: {
    label: 'Forma', icon: '◆', cat: 'Básicos', size: [180, 180],
    defaults: { props: { shape: 'rectángulo' }, styles: { background: '#8b5cf6', radius: 12 } },
    schema: [
      select('props.shape', 'Forma', ['rectángulo', 'círculo', 'triángulo', 'rombo', 'estrella', 'hexágono']),
      ...STYLE_COMMON,
    ],
  },

  container: {
    label: 'Contenedor', icon: '▢', cat: 'Básicos', size: [480, 300],
    defaults: { props: {}, styles: { background: 'rgba(148,163,184,.08)', radius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,.25)' } },
    schema: [...STYLE_COMMON],
  },

  section: {
    label: 'Sección', icon: '☰', cat: 'Básicos', size: [1280, 420],
    defaults: { props: {}, styles: { background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' } },
    schema: [text('styles.background', 'Fondo (color o gradiente CSS)'), ...STYLE_COMMON.slice(1)],
  },

  /* ── Elementos avanzados ───────────────────────────── */
  gallery: {
    label: 'Galería', icon: '⊞', cat: 'Avanzados', size: [560, 380], accepts: ['image', 'gif'],
    defaults: { props: { assetIds: [], columns: 3, gap: 10 }, styles: { radius: 8 } },
    schema: [
      { key: 'props.assetIds', label: 'Imágenes', type: 'assetList', kind: 'image' },
      num('props.columns', 'Columnas', 1, 6),
      num('props.gap', 'Separación', 0, 60),
      ...STYLE_COMMON,
    ],
  },

  slider: {
    label: 'Slider', icon: '⇄', cat: 'Avanzados', size: [560, 320], accepts: ['image', 'gif'],
    defaults: { props: { assetIds: [], interval: 3000, transition: 'fade' }, styles: { radius: 12 } },
    schema: [
      { key: 'props.assetIds', label: 'Diapositivas', type: 'assetList', kind: 'image' },
      num('props.interval', 'Intervalo (ms)', 500, 20000, 100),
      select('props.transition', 'Transición', ['fade', 'slide']),
      ...STYLE_COMMON,
    ],
  },

  form: {
    label: 'Formulario', icon: '✉', cat: 'Avanzados', size: [400, 380],
    defaults: {
      props: { title: 'Contacto', buttonText: 'Enviar', fields: 'Nombre,Email,Mensaje' },
      styles: { background: '#0f172a', radius: 16, color: '#e2e8f0', fontFamily: 'system-ui' },
    },
    schema: [
      text('props.title', 'Título'),
      text('props.fields', 'Campos (separados por coma)'),
      text('props.buttonText', 'Texto del botón'),
      ...STYLE_COMMON,
    ],
  },

  menu: {
    label: 'Menú', icon: '≡', cat: 'Avanzados', size: [1280, 64],
    defaults: {
      props: { brand: 'Mi Sitio' },
      styles: { background: 'rgba(15,23,42,.85)', color: '#e2e8f0', fontFamily: 'system-ui', fontSize: 15 },
    },
    schema: [text('props.brand', 'Nombre / logo'), ...TEXT_STYLE, ...STYLE_COMMON],
  },

  musicPlayer: {
    label: 'Reproductor', icon: '🎵', cat: 'Avanzados', size: [360, 110], accepts: ['audio'],
    defaults: {
      props: { assetId: null, title: 'Mi canción', artist: 'Artista' },
      styles: { background: 'linear-gradient(135deg,#312e81,#6d28d9)', radius: 18, color: '#fff' },
    },
    schema: [asset('props.assetId', 'Pista de audio', 'audio'), text('props.title', 'Título'), text('props.artist', 'Artista'), ...STYLE_COMMON],
  },

  model3d: {
    label: 'Modelo 3D', icon: '⬡', cat: 'Avanzados', size: [420, 360], accepts: ['model'],
    defaults: {
      props: {
        assetId: null, autoRotate: true, rotateSpeed: 1, cameraZ: 4,
        lightColor: '#ffffff', lightIntensity: 2, background: 'transparente', playAnimations: true,
      },
      styles: { radius: 12 },
    },
    schema: [
      asset('props.assetId', 'Modelo GLB/GLTF', 'model'),
      check('props.autoRotate', 'Rotación automática'),
      num('props.rotateSpeed', 'Velocidad rotación', 0, 10, 0.1),
      num('props.cameraZ', 'Distancia de cámara', 1, 20, 0.1),
      color('props.lightColor', 'Color de luz'),
      num('props.lightIntensity', 'Intensidad de luz', 0, 10, 0.1),
      check('props.playAnimations', 'Reproducir animaciones del modelo'),
      ...STYLE_COMMON,
    ],
  },

  particles: {
    label: 'Partículas', icon: '✦', cat: 'Avanzados', size: [640, 400],
    defaults: {
      props: { count: 400, color: '#818cf8', speed: 1, size: 2, mode: 'nebulosa' },
      styles: { background: '#020617', radius: 12 },
    },
    schema: [
      num('props.count', 'Cantidad', 10, 5000, 10),
      color('props.color', 'Color'),
      num('props.speed', 'Velocidad', 0.1, 10, 0.1),
      num('props.size', 'Tamaño', 0.5, 20, 0.5),
      select('props.mode', 'Modo', ['nebulosa', 'lluvia', 'órbita']),
      ...STYLE_COMMON,
    ],
  },

  drawing: {
    label: 'Dibujo', icon: '✎', cat: 'Avanzados', size: [320, 240], accepts: ['image'],
    defaults: { props: { assetId: null, fit: 'contain' }, styles: {} },
    schema: [asset('props.assetId', 'Trazo exportado', 'image'), ...STYLE_COMMON],
  },
};

export const CATEGORIES = ['Básicos', 'Avanzados'];

export function componentDef(type) { return Components[type] || Components.shape; }

/** Nodo JSON nuevo a partir de la definición del componente. */
export function createNodeData(type, overrides = {}) {
  const def = componentDef(type);
  return {
    type,
    name: def.label,
    base: { x: 60, y: 60, w: def.size[0], h: def.size[1], rotation: 0, scale: 1, opacity: 1 },
    responsive: {},              // { tablet:{x,y,w,h…}, mobile:{…} }
    styles: { ...(def.defaults.styles || {}) },
    props: JSON.parse(JSON.stringify(def.defaults.props || {})),
    animation: { preset: 'ninguna', trigger: 'load', duration: 800, delay: 0, loop: false, easing: 'ease-out' },
    events: [],                  // [{ on:'click', action:'goToPage', target:'pg_…' }]
    locked: false,
    hidden: false,
    ...overrides,
  };
}
