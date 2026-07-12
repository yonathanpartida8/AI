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

export const FONTS = ['system-ui', 'Georgia', 'Courier New', 'Arial Black', 'Trebuchet MS', 'Verdana', 'Brush Script MT', 'Palatino', 'Impact'];
export const TEXT_GLOWS = ['ninguno', 'suave', 'neón', 'rosa', 'dorado', 'fuego', 'hielo'];
export const TEXT_FX = ['ninguno', 'olas', 'saltos', 'brillo', 'arcoiris'];
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
  { key: 'styles.fontFamily', label: 'Fuente', type: 'font' },
  num('styles.fontSize', 'Tamaño de letra', 8, 200),
  select('styles.fontWeight', 'Peso', ['300', '400', '600', '700', '900']),
  color('styles.color', 'Color de texto'),
  select('styles.textAlign', 'Alineación', ['left', 'center', 'right']),
  num('styles.letterSpacing', 'Espaciado letras', -5, 30, 0.5),
  num('styles.lineHeight', 'Interlineado', 0.8, 3, 0.05),
  select('styles.textGlow', 'Brillo del texto', TEXT_GLOWS),
];

export const Components = {
  /* ── Elementos básicos ─────────────────────────────── */
  text: {
    label: 'Texto', icon: 'T', cat: 'Básicos', size: [320, 60],
    defaults: {
      props: { text: 'Doble clic para editar', tag: 'p', textFx: 'ninguno' },
      styles: { fontSize: 28, color: '#e2e8f0', fontWeight: '600', textAlign: 'left', fontFamily: 'system-ui' },
    },
    schema: [
      { key: 'props.text', label: 'Contenido', type: 'textarea' },
      select('props.tag', 'Etiqueta HTML', ['h1', 'h2', 'h3', 'p', 'span']),
      select('props.textFx', 'Letras animadas', TEXT_FX),
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
    defaults: { props: { assetId: null, srcUrl: '', autoplay: false, loop: false }, styles: { radius: 30, background: '#1e293b' } },
    schema: [asset('props.assetId', 'Archivo de audio', 'audio'), text('props.srcUrl', 'o URL externa'), check('props.autoplay', 'Autoplay'), check('props.loop', 'Loop')],
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
      props: { assetId: null, srcUrl: '', coverId: null, variant: 'tarjeta', title: 'Nuestra canción', artist: 'La que lo dice todo' },
      styles: { background: 'linear-gradient(135deg,#4c1d95,#be185d)', radius: 18, color: '#fff' },
    },
    schema: [
      asset('props.assetId', 'Pista de audio (asset)', 'audio'),
      text('props.srcUrl', 'o URL (GitHub / directa / YouTube)'),
      asset('props.coverId', 'Portada del álbum', 'image'),
      select('props.variant', 'Estilo', ['tarjeta', 'mini']),
      text('props.title', 'Título'), text('props.artist', 'Artista'),
      ...STYLE_COMMON,
    ],
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
      props: { count: 400, color: '#818cf8', speed: 1, size: 2, mode: 'nebulosa', opacity: 1, shape: 'auto', glow: true },
      styles: { background: '#020617', radius: 12 },
    },
    schema: [
      select('props.mode', 'Modo', ['nebulosa', 'corazones', 'pétalos', 'burbujas', 'nieve', 'estrellas', 'luciérnagas', 'aurora', 'ondas', 'lluvia', 'órbita']),
      num('props.count', 'Cantidad', 10, 5000, 10),
      color('props.color', 'Color'),
      num('props.speed', 'Velocidad', 0.1, 10, 0.1),
      num('props.size', 'Tamaño', 0.5, 20, 0.5),
      num('props.opacity', 'Opacidad de partículas', 0, 1, 0.05),
      select('props.shape', 'Forma', ['auto', 'disco', 'corazón', 'estrella', 'anillo']),
      check('props.glow', 'Brillo aditivo (resplandor)'),
      ...STYLE_COMMON,
    ],
  },

  drawing: {
    label: 'Dibujo', icon: '✎', cat: 'Avanzados', size: [320, 240], accepts: ['image'],
    defaults: { props: { assetId: null, fit: 'contain' }, styles: {} },
    schema: [asset('props.assetId', 'Trazo exportado', 'image'), ...STYLE_COMMON],
  },

  navButton: {
    label: 'Botón de navegación', icon: '⇢', cat: 'Básicos', size: [210, 58],
    defaults: {
      props: { text: 'Siguiente', target: '__next', variant: 'píldora', showArrow: true },
      styles: {
        fontSize: 16, fontWeight: '700', textAlign: 'center', color: '#fff',
        background: 'linear-gradient(90deg,#ff8fab,#b388eb)', radius: 29, shadow: 'suave',
      },
    },
    schema: [
      text('props.text', 'Texto'),
      { key: 'props.target', label: 'Destino', type: 'navTarget' },
      select('props.variant', 'Estilo', ['píldora', 'fantasma', 'neón', 'burbuja', 'flecha']),
      check('props.showArrow', 'Mostrar flecha animada'),
      ...TEXT_STYLE, ...STYLE_COMMON,
    ],
  },

  /* ── Componentes románticos ─────────────────────────── */
  loveLetter: {
    label: 'Carta interactiva', icon: '💌', cat: 'Románticos', size: [380, 300], accepts: ['image', 'audio'],
    defaults: {
      props: {
        cover: 'Toca para abrir',
        message: 'Cada día a tu lado es mi lugar favorito del mundo.\n\nGracias por existir.',
        signature: 'Con amor, para ti',
        photoId: null, soundId: null, burst: true,
        envelope: 'linear-gradient(160deg,#be123c,#881337)',
        paper: '#fff7ed',
      },
      styles: { fontSize: 16, fontFamily: 'system-ui', color: '#7c2d12' },
    },
    schema: [
      text('props.cover', 'Texto del sobre'),
      { key: 'props.message', label: 'Mensaje de la carta', type: 'textarea' },
      text('props.signature', 'Firma'),
      asset('props.photoId', 'Foto dentro de la carta', 'image'),
      asset('props.soundId', 'Sonido al abrir', 'audio'),
      check('props.burst', 'Estallido de corazones al abrir'),
      color('props.envelope', 'Sobre (color / gradiente)'),
      color('props.paper', 'Papel de la carta'),
      num('styles.fontSize', 'Tamaño de letra', 10, 40),
      color('styles.color', 'Color de la tinta'),
    ],
  },

  timeline: {
    label: 'Línea de tiempo', icon: '🕰', cat: 'Románticos', size: [420, 420],
    defaults: {
      props: {
        items: '14/02/2023 | Nos conocimos | El día que todo empezó ; 20/06/2023 | Primer viaje | Descubrimos el mundo juntos ; Hoy | Seguimos escribiendo | Nuestra historia continúa…',
      },
      styles: { color: '#e2e8f0', fontSize: 16, background: 'rgba(15,23,42,.55)', radius: 18 },
    },
    schema: [
      { key: 'props.items', label: 'Nuestros recuerdos', type: 'timelineItems' },
      ...TEXT_STYLE.slice(0, 4),
      ...STYLE_COMMON,
    ],
  },

  hiddenMessage: {
    label: 'Mensaje oculto', icon: '🔮', cat: 'Románticos', size: [380, 180],
    defaults: {
      props: { cover: '✨ Toca para revelar el secreto', message: 'Te amo más de lo que las palabras pueden decir 💗' },
      styles: { fontSize: 20, color: '#fdf2f8', background: 'rgba(88,28,135,.35)', radius: 18, fontFamily: 'Georgia' },
    },
    schema: [
      text('props.cover', 'Texto de la cubierta'),
      { key: 'props.message', label: 'Mensaje secreto', type: 'textarea' },
      ...TEXT_STYLE.slice(0, 4),
      ...STYLE_COMMON,
    ],
  },

  heartButton: {
    label: 'Botón de corazones', icon: '💗', cat: 'Románticos', size: [220, 60],
    defaults: {
      props: { text: 'Pulsa aquí 💗', emoji: '❤️' },
      styles: {
        fontSize: 17, fontWeight: '700', textAlign: 'center', color: '#fff',
        background: 'linear-gradient(90deg,#ec4899,#f43f5e)', radius: 30, shadow: 'neón',
      },
    },
    schema: [text('props.text', 'Texto'), text('props.emoji', 'Emoji del estallido'), ...TEXT_STYLE, ...STYLE_COMMON],
  },

  typewriter: {
    label: 'Máquina de escribir', icon: '⌨', cat: 'Románticos', size: [420, 70],
    defaults: {
      props: { text: 'Escribiendo nuestra historia…', speed: 90, loop: true },
      styles: { fontSize: 26, color: '#fbcfe8', fontWeight: '600', textAlign: 'left', fontFamily: 'Courier New' },
    },
    schema: [
      { key: 'props.text', label: 'Texto a escribir', type: 'textarea' },
      num('props.speed', 'Velocidad (ms por letra)', 20, 400, 10),
      check('props.loop', 'Repetir en bucle'),
      ...TEXT_STYLE,
    ],
  },

  countdown: {
    label: 'Contador de amor', icon: '⏳', cat: 'Románticos', size: [480, 110],
    defaults: {
      props: { date: '2023-02-14', mode: 'desde', label: 'Juntos desde hace' },
      styles: { color: '#fdf2f8', fontSize: 15, fontFamily: 'system-ui' },
    },
    schema: [
      text('props.date', 'Fecha (AAAA-MM-DD)'),
      select('props.mode', 'Modo', ['desde', 'hasta']),
      text('props.label', 'Etiqueta'),
      color('styles.color', 'Color'),
      num('styles.fontSize', 'Tamaño base', 10, 30),
    ],
  },

  polaroid: {
    label: 'Foto polaroid', icon: '📸', cat: 'Románticos', size: [260, 320], accepts: ['image', 'gif'],
    defaults: { props: { assetId: null, caption: 'Nuestro recuerdo', rotate: -3 }, styles: {} },
    schema: [
      asset('props.assetId', 'Foto', 'image'),
      text('props.caption', 'Pie de foto'),
      num('props.rotate', 'Inclinación °', -15, 15),
    ],
  },

  floatingEmojis: {
    label: 'Elementos flotantes', icon: '🎈', cat: 'Románticos', size: [640, 420],
    defaults: { props: { emojis: '💖, 🌹, ✨', count: 14, speed: 1 }, styles: {} },
    schema: [
      text('props.emojis', 'Emojis (separados por coma)'),
      num('props.count', 'Cantidad', 1, 60),
      num('props.speed', 'Velocidad', 0.2, 4, 0.1),
    ],
  },

  heart3d: {
    label: 'Corazón 3D', icon: '💎', cat: 'Románticos', size: [340, 320],
    defaults: {
      props: { color: '#e11d48', autoRotate: true, rotateSpeed: 1, metal: 0.35, cameraZ: 4 },
      styles: {},
    },
    schema: [
      color('props.color', 'Color del corazón'),
      check('props.autoRotate', 'Rotación automática'),
      num('props.rotateSpeed', 'Velocidad', 0, 10, 0.1),
      num('props.metal', 'Brillo metálico', 0, 1, 0.05),
      num('props.cameraZ', 'Distancia de cámara', 2, 12, 0.1),
    ],
  },

  photo3d: {
    label: 'Foto con profundidad 3D', icon: '🖼', cat: 'Románticos', size: [360, 280], accepts: ['image'],
    defaults: { props: { assetId: null, depth: 1 }, styles: {} },
    schema: [
      asset('props.assetId', 'Foto', 'image'),
      num('props.depth', 'Profundidad del efecto', 0.2, 3, 0.1),
    ],
  },

  gradientBg: {
    label: 'Gradiente animado', icon: '🌈', cat: 'Románticos', size: [640, 420],
    defaults: {
      props: { colors: '#ec4899, #8b5cf6, #38bdf8, #f43f5e', speed: 8 },
      styles: { radius: 0 },
    },
    schema: [
      text('props.colors', 'Colores (separados por coma)'),
      num('props.speed', 'Duración del ciclo (s)', 2, 30, 0.5),
      ...STYLE_COMMON,
    ],
  },

  /* ── Extensión con código propio ────────────────────── */
  htmlEmbed: {
    label: 'Página HTML importada', icon: '🌐', cat: 'Avanzados', size: [480, 360], accepts: ['html'],
    defaults: {
      props: { assetId: null, interactive: true, viewWidth: 1280, liveInEditor: false },
      styles: { radius: 14, shadow: 'suave' },
    },
    schema: [
      asset('props.assetId', 'Archivo HTML (sube uno en Assets)', 'html'),
      num('props.viewWidth', 'Ancho de diseño del HTML (px)', 320, 1920, 10),
      check('props.interactive', 'Interactivo en el sitio final'),
      check('props.liveInEditor', 'Activo también mientras editas (consume más)'),
      ...STYLE_COMMON,
    ],
  },

  custom3D: {
    label: '3D personalizado', icon: '🧊', cat: 'Avanzados', size: [420, 340],
    defaults: {
      props: {
        code: `// Escena Three.js lista: THREE, scene, camera, pivot, renderer, GLTFLoader.
// Añade objetos a "pivot" y devuelve una función update(dt) opcional.
const geo = new THREE.IcosahedronGeometry(1.1, 0);
const mat = new THREE.MeshStandardMaterial({ color: '#ff375f', metalness: .5, roughness: .2 });
const mesh = new THREE.Mesh(geo, mat);
pivot.add(mesh);
return (dt) => { mesh.rotation.x += dt * .6; mesh.rotation.y += dt * .4; };`,
        cameraZ: 4,
      },
      styles: {},
    },
    schema: [
      { key: 'props.code', label: 'Código Three.js', type: 'textarea' },
      num('props.cameraZ', 'Distancia de cámara', 1, 20, 0.1),
    ],
  },

  customHTML: {
    label: 'Código personalizado', icon: '</>', cat: 'Avanzados', size: [420, 300],
    defaults: {
      props: {
        html: '<div class="mi-efecto">Mi componente ✨</div>',
        css: '.mi-efecto{display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:22px;color:#f0abfc;background:radial-gradient(circle,#3b0764,#0b1020);border-radius:14px}',
        js: '// Se ejecuta en la vista previa y en el sitio exportado\n// document.querySelector(".mi-efecto").onclick = () => alert("¡Hola!");',
      },
      styles: {},
    },
    schema: [
      { key: 'props.html', label: 'HTML', type: 'textarea' },
      { key: 'props.css', label: 'CSS', type: 'textarea' },
      { key: 'props.js', label: 'JavaScript', type: 'textarea' },
    ],
  },
};

export const CATEGORIES = ['Románticos', 'Básicos', 'Avanzados'];

export function componentDef(type) { return Components[type] || Components.shape; }

/** Componentes de fondo/ambiente: sin animación de entrada por defecto. */
const NO_DEFAULT_ANIM = new Set(['section', 'container', 'particles', 'gradientBg', 'floatingEmojis', 'menu', 'customHTML', 'custom3D']);

/** Entradas por defecto según el tipo (todo nace con vida). */
const DEFAULT_PRESET = {
  image: 'zoomIn', gif: 'zoomIn', video: 'zoomIn', polaroid: 'caida', photo3d: 'zoomIn',
  heart3d: 'zoomIn', model3d: 'zoomIn', icon: 'tada', shape: 'zoomIn',
  heartButton: 'latido', button: 'fadeInUp', loveLetter: 'zoomIn',
};

/** Nodo JSON nuevo a partir de la definición del componente. */
export function createNodeData(type, overrides = {}) {
  const def = componentDef(type);
  const preset = NO_DEFAULT_ANIM.has(type) ? 'ninguna' : (DEFAULT_PRESET[type] || 'fadeInUp');
  return {
    type,
    name: def.label,
    base: { x: 60, y: 60, w: def.size[0], h: def.size[1], rotation: 0, scale: 1, opacity: 1 },
    responsive: {},              // { tablet:{x,y,w,h…}, mobile:{…} }
    styles: { ...(def.defaults.styles || {}) },
    props: JSON.parse(JSON.stringify(def.defaults.props || {})),
    animation: {
      preset, trigger: 'scroll', duration: 900, delay: 0,
      loop: type === 'heartButton', easing: 'ease-out',
    },
    // Salida elegante al ocultarse mediante acciones
    animationOut: { preset: 'fadeOut', duration: 450, easing: 'ease-in' },
    // Efectos de interacción: presión al tocar, hover y scroll
    effects: { parallax: 0, tilt: false, press: type === 'button' || type === 'heartButton' ? 'ondas' : 'ninguno', hoverFx: 'ninguno' },
    events: [],                  // [{ on:'click', actions:[{action,target,value,delay}] }]
    locked: false,
    hidden: false,
    ...overrides,
  };
}
