/* ============================================================
 * storage/templates.js — Plantillas y bloques prediseñados
 *
 * - starterProject(): proyecto inicial completo — una landing
 *   larga y cuidada (héroe con partículas, características,
 *   cita, galería, CTA y pie) para que el usuario NUNCA empiece
 *   ante un lienzo en blanco.
 * - buildBlock(key, y): secciones prediseñadas que se insertan
 *   al final de la página actual desde la paleta ("Bloques").
 * ============================================================ */

import { uid } from '../utils/helpers.js';
import { createNodeData } from '../components/registry.js';

const W = 1280;

function node(type, frame, { styles = {}, props = {}, animation = {}, name } = {}) {
  const data = createNodeData(type);
  data.id = uid('nd');
  Object.assign(data.base, frame);
  Object.assign(data.styles, styles);
  Object.assign(data.props, props);
  Object.assign(data.animation, animation);
  if (name) data.name = name;
  return data;
}

const scroll = (preset, delay = 0, extra = {}) => ({ preset, trigger: 'scroll', duration: 900, delay, ...extra });
const load = (preset, delay = 0, extra = {}) => ({ preset, trigger: 'load', duration: 900, delay, ...extra });

/* ── Bloques ─────────────────────────────────────────── */

function heroBlock(y) {
  const nodes = [
    node('section', { x: 0, y, w: W, h: 780 }, {
      name: 'Fondo héroe',
      styles: { background: 'linear-gradient(160deg,#0f0c29 0%,#1c1548 45%,#0b1020 100%)' },
    }),
    node('particles', { x: 0, y, w: W, h: 780 }, {
      name: 'Partículas héroe',
      styles: { background: 'transparent', radius: 0 },
      props: { count: 500, color: '#8b5cf6', speed: 0.8, size: 2.5, mode: 'nebulosa' },
    }),
    node('shape', { x: 92, y: y + 120, w: 120, h: 120, opacity: 0.55 }, {
      name: 'Esfera decorativa',
      styles: { background: 'radial-gradient(circle at 30% 30%,#f472b6,#7c3aed)', radius: 0 },
      props: { shape: 'círculo' },
      animation: load('float', 0, { loop: true, duration: 4200, easing: 'ease-in-out' }),
    }),
    node('shape', { x: 1070, y: y + 480, w: 95, h: 95, opacity: 0.5 }, {
      name: 'Rombo decorativo',
      styles: { background: 'linear-gradient(135deg,#38bdf8,#6366f1)', radius: 0 },
      props: { shape: 'rombo' },
      animation: load('float', 700, { loop: true, duration: 5000, easing: 'ease-in-out' }),
    }),
    node('text', { x: 190, y: y + 230, w: 900, h: 160 }, {
      name: 'Título héroe',
      props: { text: 'Diseños que enamoran\na primera vista', tag: 'h1' },
      styles: { fontSize: 58, fontWeight: '900', textAlign: 'center', color: '#f8fafc', letterSpacing: -1 },
      animation: load('fadeInUp'),
    }),
    node('text', { x: 320, y: y + 420, w: 640, h: 64 }, {
      name: 'Subtítulo héroe',
      props: { text: 'Crea sitios espectaculares arrastrando y soltando.\nSin escribir una sola línea de código.', tag: 'p' },
      styles: { fontSize: 19, fontWeight: '400', textAlign: 'center', color: '#c7d2fe' },
      animation: load('fadeInUp', 250),
    }),
    node('button', { x: 530, y: y + 540, w: 220, h: 58 }, {
      name: 'Botón héroe',
      props: { text: 'Empezar ahora' },
      styles: { fontSize: 17, fontWeight: '800', textAlign: 'center', color: '#ffffff', background: 'linear-gradient(90deg,#8b5cf6,#ec4899)', radius: 29, shadow: 'neón' },
      animation: load('zoomIn', 500),
    }),
  ];
  return { height: 780, nodes };
}

function featuresBlock(y) {
  const cards = [
    ['🎨', 'Diseño visual', 'Arrastra, suelta y personaliza cada detalle con libertad total.'],
    ['⚡', 'Animaciones', 'Efectos y transiciones fluidas a 60 fps con un solo clic.'],
    ['📱', 'Responsive', 'Tu sitio se ve perfecto en móvil, tablet y escritorio.'],
  ];
  const nodes = [
    node('text', { x: 340, y: y + 70, w: 600, h: 60 }, {
      name: 'Título características',
      props: { text: 'Todo lo que necesitas', tag: 'h2' },
      styles: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: '#f1f5f9' },
      animation: scroll('fadeInUp'),
    }),
  ];
  cards.forEach(([icon, title, text], i) => {
    const x = 70 + i * 400;
    nodes.push(
      node('container', { x, y: y + 190, w: 340, h: 330 }, {
        name: `Tarjeta ${title}`,
        styles: { background: 'rgba(139,92,246,.08)', radius: 22, borderWidth: 1, borderColor: 'rgba(139,92,246,.35)', shadow: 'suave' },
        animation: scroll('fadeInUp', i * 160),
      }),
      node('icon', { x: x + 130, y: y + 225, w: 80, h: 80 }, {
        name: `Icono ${title}`,
        props: { glyph: icon }, styles: { fontSize: 50 },
        animation: scroll('zoomIn', i * 160 + 120),
      }),
      node('text', { x: x + 20, y: y + 320, w: 300, h: 40 }, {
        name: `Título ${title}`,
        props: { text: title, tag: 'h3' },
        styles: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#e2e8f0' },
        animation: scroll('fadeInUp', i * 160 + 160),
      }),
      node('text', { x: x + 30, y: y + 370, w: 280, h: 110 }, {
        name: `Texto ${title}`,
        props: { text, tag: 'p' },
        styles: { fontSize: 15, fontWeight: '400', textAlign: 'center', color: '#94a3b8' },
        animation: scroll('fadeInUp', i * 160 + 200),
      }),
    );
  });
  return { height: 590, nodes };
}

function quoteBlock(y) {
  return {
    height: 360,
    nodes: [
      node('section', { x: 0, y, w: W, h: 360 }, {
        name: 'Fondo cita',
        styles: { background: 'linear-gradient(90deg,#0b1020,#1e1b4b,#0b1020)' },
      }),
      node('icon', { x: 600, y: y + 48, w: 80, h: 64 }, {
        name: 'Comillas', props: { glyph: '❝' }, styles: { fontSize: 52, color: '#8b5cf6' },
        animation: scroll('zoomIn'),
      }),
      node('text', { x: 240, y: y + 140, w: 800, h: 110 }, {
        name: 'Cita',
        props: { text: '“Una herramienta que convierte ideas\nen sitios reales en cuestión de minutos.”', tag: 'p' },
        styles: { fontSize: 28, fontWeight: '400', textAlign: 'center', color: '#e0e7ff', fontFamily: 'Georgia' },
        animation: scroll('blurIn', 150, { duration: 1200 }),
      }),
    ],
  };
}

function galleryBlock(y) {
  const gradients = [
    'linear-gradient(135deg,#7c3aed,#db2777)', 'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)', 'linear-gradient(135deg,#10b981,#0ea5e9)',
    'linear-gradient(135deg,#ec4899,#f97316)', 'linear-gradient(135deg,#6366f1,#a855f7)',
  ];
  const nodes = [
    node('text', { x: 340, y: y + 70, w: 600, h: 60 }, {
      name: 'Título galería',
      props: { text: 'Galería', tag: 'h2' },
      styles: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: '#f1f5f9' },
      animation: scroll('fadeInUp'),
    }),
    node('text', { x: 340, y: y + 135, w: 600, h: 34 }, {
      name: 'Subtítulo galería',
      props: { text: 'Sustituye estas piezas por tus fotos o GIFs desde la pestaña Assets', tag: 'p' },
      styles: { fontSize: 14, fontWeight: '400', textAlign: 'center', color: '#64748b' },
      animation: scroll('fadeIn', 150),
    }),
  ];
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    nodes.push(node('shape', { x: 85 + col * 380, y: y + 210 + row * 205, w: 350, h: 185 }, {
      name: `Pieza galería ${i + 1}`,
      styles: { background: gradients[i], radius: 16, shadow: 'media' },
      animation: scroll('zoomIn', i * 90),
    }));
  }
  return { height: 680, nodes };
}

function ctaBlock(y) {
  return {
    height: 430,
    nodes: [
      node('container', { x: 100, y: y + 65, w: 1080, h: 300 }, {
        name: 'Panel CTA',
        styles: { background: 'linear-gradient(120deg,#4f46e5,#9333ea,#db2777)', radius: 30, shadow: 'fuerte' },
        animation: scroll('zoomIn'),
      }),
      node('text', { x: 240, y: y + 135, w: 800, h: 66 }, {
        name: 'Título CTA',
        props: { text: '¿Listo para crear algo increíble?', tag: 'h2' },
        styles: { fontSize: 34, fontWeight: '800', textAlign: 'center', color: '#ffffff' },
        animation: scroll('fadeInUp', 150),
      }),
      node('button', { x: 530, y: y + 235, w: 220, h: 54 }, {
        name: 'Botón CTA',
        props: { text: 'Comienza gratis' },
        styles: { fontSize: 16, fontWeight: '800', textAlign: 'center', color: '#4f46e5', background: '#ffffff', radius: 27, shadow: 'media' },
        animation: load('pulse', 0, { loop: true, duration: 1800, easing: 'ease-in-out' }),
      }),
    ],
  };
}

function footerBlock(y) {
  return {
    height: 300,
    nodes: [
      node('section', { x: 0, y, w: W, h: 300 }, { name: 'Fondo pie', styles: { background: '#080b14' } }),
      node('text', { x: 90, y: y + 66, w: 320, h: 44 }, {
        name: 'Marca pie', props: { text: '◆ Mi Sitio', tag: 'h3' },
        styles: { fontSize: 24, fontWeight: '800', textAlign: 'left', color: '#e2e8f0' },
      }),
      node('text', { x: 90, y: y + 118, w: 420, h: 30 }, {
        name: 'Lema pie', props: { text: 'Hecho con ◆ No-Code Builder', tag: 'p' },
        styles: { fontSize: 14, fontWeight: '400', textAlign: 'left', color: '#64748b' },
      }),
      node('text', { x: 830, y: y + 78, w: 360, h: 30 }, {
        name: 'Enlaces pie', props: { text: 'Inicio · Servicios · Galería · Contacto', tag: 'p' },
        styles: { fontSize: 15, fontWeight: '400', textAlign: 'right', color: '#94a3b8' },
      }),
      node('shape', { x: 90, y: y + 182, w: 1100, h: 2 }, {
        name: 'Separador pie', styles: { background: 'rgba(148,163,184,.15)', radius: 0 },
      }),
      node('text', { x: 340, y: y + 218, w: 600, h: 30 }, {
        name: 'Copyright', props: { text: '© 2026 — Todos los derechos reservados', tag: 'p' },
        styles: { fontSize: 13, fontWeight: '400', textAlign: 'center', color: '#475569' },
      }),
    ],
  };
}

/* ── Bloques ROMÁNTICOS ─────────────────────────────── */

function romanticHeroBlock(y) {
  return {
    height: 820,
    nodes: [
      node('section', { x: 0, y, w: W, h: 820 }, {
        name: 'Cielo romántico',
        styles: { background: 'linear-gradient(175deg,#1e0a2e 0%,#3b0f3f 45%,#180b2b 100%)' },
      }),
      node('particles', { x: 0, y, w: W, h: 820 }, {
        name: 'Corazones flotando',
        styles: { background: 'transparent', radius: 0 },
        props: { count: 90, color: '#f472b6', speed: 0.7, size: 3, mode: 'corazones' },
      }),
      node('particles', { x: 0, y, w: W, h: 820 }, {
        name: 'Estrellas titilando',
        styles: { background: 'transparent', radius: 0 },
        props: { count: 160, color: '#fbcfe8', speed: 0.6, size: 1.6, mode: 'estrellas' },
      }),
      node('text', { x: 240, y: y + 210, w: 800, h: 150 }, {
        name: 'Título romántico',
        props: { text: 'Para ti, mi amor', tag: 'h1', textFx: 'brillo' },
        styles: { fontSize: 64, fontWeight: '900', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia', textGlow: 'rosa' },
        animation: load('zoomIn', 200, { duration: 1400 }),
      }),
      node('typewriter', { x: 290, y: y + 390, w: 700, h: 60 }, {
        name: 'Dedicatoria',
        props: { text: 'Hice esta página solo para ti… cada rincón guarda algo nuestro 💌', speed: 70, loop: true },
        styles: { fontSize: 21, color: '#f9a8d4', textAlign: 'center', fontFamily: 'Georgia' },
      }),
      node('heartButton', { x: 520, y: y + 540, w: 240, h: 62 }, {
        name: 'Botón corazones héroe',
        props: { text: 'Tócame 💗', emoji: '💖' },
        animation: load('latido', 800, { loop: true, duration: 1600 }),
      }),
      node('text', { x: 490, y: y + 730, w: 300, h: 40 }, {
        name: 'Indicación scroll',
        props: { text: '↓ desliza para ver nuestra historia', tag: 'p' },
        styles: { fontSize: 14, color: 'rgba(249,168,212,.7)', textAlign: 'center' },
        animation: load('float', 0, { loop: true, duration: 2200 }),
      }),
    ],
  };
}

function letterBlock(y) {
  return {
    height: 560,
    nodes: [
      node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
        name: 'Título carta', props: { text: 'Tengo algo que decirte…', tag: 'h2' },
        styles: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp'),
      }),
      node('loveLetter', { x: 420, y: y + 160, w: 440, h: 340 }, {
        name: 'Carta de amor',
        animation: scroll('zoomIn', 200),
      }),
    ],
  };
}

function timelineBlock(y) {
  return {
    height: 620,
    nodes: [
      node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
        name: 'Título recuerdos', props: { text: 'Nuestra historia', tag: 'h2' },
        styles: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp'),
      }),
      node('timeline', { x: 340, y: y + 150, w: 600, h: 420 }, {
        name: 'Línea de recuerdos',
        animation: scroll('fadeIn', 150),
      }),
    ],
  };
}

function countdownBlock(y) {
  return {
    height: 320,
    nodes: [
      node('section', { x: 0, y, w: W, h: 320 }, {
        name: 'Fondo contador',
        styles: { background: 'linear-gradient(90deg,#180b2b,#4a1042,#180b2b)' },
      }),
      node('text', { x: 340, y: y + 55, w: 600, h: 50 }, {
        name: 'Título contador', props: { text: 'Cada segundo cuenta 💞', tag: 'h2' },
        styles: { fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp'),
      }),
      node('countdown', { x: 340, y: y + 160, w: 600, h: 110 }, {
        name: 'Contador de amor',
        animation: scroll('zoomIn', 150),
      }),
    ],
  };
}

function polaroidsBlock(y) {
  const captions = ['Nuestro primer día', 'Aquella tarde', 'Siempre así'];
  const nodes = [
    node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
      name: 'Título fotos', props: { text: 'Momentos que amo', tag: 'h2' },
      styles: { fontSize: 36, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
      animation: scroll('fadeInUp'),
    }),
  ];
  captions.forEach((caption, i) => {
    nodes.push(node('polaroid', { x: 155 + i * 340, y: y + 170, w: 300, h: 360, rotation: [-4, 2, -2][i] }, {
      name: `Polaroid ${i + 1}`,
      props: { assetId: null, caption, rotate: [-3, 2, -2][i] },
      animation: scroll('caida', i * 200),
      // Sustituye por tus fotos desde Assets; con tilt 3D se sienten vivas
    }));
    nodes[nodes.length - 1].effects = { parallax: 0, tilt: true };
  });
  return { height: 620, nodes };
}

function secretBlock(y) {
  return {
    height: 380,
    nodes: [
      node('floatingEmojis', { x: 0, y, w: W, h: 380 }, {
        name: 'Emojis flotantes secreto',
        props: { emojis: '✨, 💫', count: 10, speed: 0.7 },
      }),
      node('text', { x: 340, y: y + 60, w: 600, h: 50 }, {
        name: 'Título secreto', props: { text: 'Hay un secreto escondido aquí…', tag: 'h2' },
        styles: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#e9d5ff', fontFamily: 'Georgia' },
        animation: scroll('fadeIn'),
      }),
      node('hiddenMessage', { x: 390, y: y + 150, w: 500, h: 170 }, {
        name: 'Mensaje secreto',
        animation: scroll('zoomIn', 200),
      }),
    ],
  };
}

function chapterBlock(y) {
  return {
    height: 520,
    nodes: [
      node('section', { x: 0, y, w: W, h: 520 }, {
        name: 'Fondo capítulo',
        styles: { background: 'linear-gradient(160deg,#0f0a1e,#2a0f35)' },
      }),
      node('text', { x: 440, y: y + 90, w: 400, h: 40 }, {
        name: 'Número capítulo', props: { text: '— Capítulo 1 —', tag: 'p' },
        styles: { fontSize: 15, color: '#c084fc', textAlign: 'center', letterSpacing: 4 },
        animation: scroll('fadeIn'),
      }),
      node('text', { x: 290, y: y + 150, w: 700, h: 70 }, {
        name: 'Título capítulo', props: { text: 'Donde todo comenzó', tag: 'h2' },
        styles: { fontSize: 40, fontWeight: '900', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp', 150),
      }),
      node('text', { x: 340, y: y + 250, w: 600, h: 120 }, {
        name: 'Texto capítulo',
        props: { text: 'Escribe aquí este capítulo de vuestra historia:\ncómo empezó, qué sentiste, qué recuerdas de ese día…', tag: 'p' },
        styles: { fontSize: 17, color: '#d8b4fe', textAlign: 'center', lineHeight: 1.8, fontFamily: 'Georgia' },
        animation: scroll('fadeIn', 300),
      }),
      node('button', { x: 540, y: y + 410, w: 200, h: 52 }, {
        name: 'Siguiente capítulo',
        props: { text: 'Continuar →' },
        styles: { fontSize: 15, fontWeight: '700', textAlign: 'center', color: '#fff', background: 'linear-gradient(90deg,#a855f7,#ec4899)', radius: 26, shadow: 'neón' },
        animation: scroll('fadeInUp', 450),
      }),
    ],
  };
}

function musicBlock(y) {
  return {
    height: 320,
    nodes: [
      node('text', { x: 340, y: y + 60, w: 600, h: 50 }, {
        name: 'Título música', props: { text: 'Nuestra canción 🎶', tag: 'h2' },
        styles: { fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp'),
      }),
      node('musicPlayer', { x: 400, y: y + 150, w: 480, h: 120 }, {
        name: 'Reproductor',
        props: { assetId: null, title: 'La canción que nos define', artist: 'Súbela desde Assets 💿' },
        styles: { background: 'linear-gradient(135deg,#701a75,#be185d)', radius: 20, color: '#fff' },
        animation: scroll('zoomIn', 150),
      }),
    ],
  };
}



function faqBlock(y) {
  const faqs = [
    ['¿Necesito saber programar?', 'No. Todo se hace de forma visual, arrastrando y soltando.'],
    ['¿Puedo usar mis propios GIFs y vídeos?', 'Sí: súbelos desde tu galería y quedan guardados con el proyecto.'],
    ['¿El sitio funciona en móviles?', 'Sí, el diseño se adapta automáticamente a cualquier pantalla.'],
  ];
  const nodes = [
    node('text', { x: 340, y: y + 70, w: 600, h: 60 }, {
      name: 'Título FAQ', props: { text: 'Preguntas frecuentes', tag: 'h2' },
      styles: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: '#f1f5f9' },
      animation: scroll('fadeInUp'),
    }),
  ];
  faqs.forEach(([q, a], i) => {
    const rowY = y + 180 + i * 130;
    nodes.push(
      node('container', { x: 190, y: rowY, w: 900, h: 110 }, {
        name: `FAQ ${i + 1}`,
        styles: { background: 'rgba(148,163,184,.06)', radius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,.2)' },
        animation: scroll('slideInLeft', i * 130),
      }),
      node('text', { x: 220, y: rowY + 18, w: 840, h: 34 }, {
        name: `Pregunta ${i + 1}`, props: { text: q, tag: 'h3' },
        styles: { fontSize: 18, fontWeight: '700', textAlign: 'left', color: '#c7d2fe' },
        animation: scroll('fadeIn', i * 130 + 120),
      }),
      node('text', { x: 220, y: rowY + 56, w: 840, h: 44 }, {
        name: `Respuesta ${i + 1}`, props: { text: a, tag: 'p' },
        styles: { fontSize: 15, fontWeight: '400', textAlign: 'left', color: '#94a3b8' },
        animation: scroll('fadeIn', i * 130 + 160),
      }),
    );
  });
  return { height: 620, nodes };
}

function contactBlock(y) {
  return {
    height: 620,
    nodes: [
      node('section', { x: 0, y, w: W, h: 620 }, {
        name: 'Fondo contacto',
        styles: { background: 'linear-gradient(180deg,#0b1020,#151233,#0b1020)' },
      }),
      node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
        name: 'Título contacto', props: { text: 'Hablemos', tag: 'h2' },
        styles: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: '#f1f5f9' },
        animation: scroll('fadeInUp'),
      }),
      node('text', { x: 390, y: y + 128, w: 500, h: 34 }, {
        name: 'Subtítulo contacto', props: { text: 'Cuéntanos tu proyecto y te respondemos hoy mismo', tag: 'p' },
        styles: { fontSize: 15, fontWeight: '400', textAlign: 'center', color: '#94a3b8' },
        animation: scroll('fadeIn', 150),
      }),
      node('form', { x: 380, y: y + 190, w: 520, h: 380 }, {
        name: 'Formulario contacto',
        props: { title: '', fields: 'Nombre,Email,Mensaje', buttonText: 'Enviar mensaje' },
        styles: { background: 'rgba(15,23,42,.85)', radius: 22, color: '#e2e8f0', borderWidth: 1, borderColor: 'rgba(139,92,246,.35)', shadow: 'media' },
        animation: scroll('zoomIn', 200),
      }),
    ],
  };
}

/* ── API pública ─────────────────────────────────────── */

export const BLOCKS = {
  romanticHero: { label: 'Portada romántica 💘', icon: '💘', build: romanticHeroBlock },
  letter: { label: 'Carta de amor', icon: '💌', build: letterBlock },
  timelineB: { label: 'Nuestra historia (línea de tiempo)', icon: '🕰', build: timelineBlock },
  countdownB: { label: 'Contador de amor', icon: '⏳', build: countdownBlock },
  polaroids: { label: 'Fotos polaroid', icon: '📸', build: polaroidsBlock },
  secret: { label: 'Mensaje secreto', icon: '🔮', build: secretBlock },
  chapter: { label: 'Capítulo de historia', icon: '📖', build: chapterBlock },
  music: { label: 'Nuestra canción', icon: '🎶', build: musicBlock },
  hero: { label: 'Héroe con partículas', icon: '✨', build: heroBlock },
  features: { label: 'Características (3 tarjetas)', icon: '🃏', build: featuresBlock },
  quote: { label: 'Cita destacada', icon: '❝', build: quoteBlock },
  gallery: { label: 'Galería', icon: '⊞', build: galleryBlock },
  faq: { label: 'Preguntas frecuentes', icon: '❓', build: faqBlock },
  contact: { label: 'Contacto con formulario', icon: '✉', build: contactBlock },
  cta: { label: 'Llamada a la acción', icon: '📣', build: ctaBlock },
  footer: { label: 'Pie de página', icon: '⚓', build: footerBlock },
};

export function buildBlock(key, y) {
  return BLOCKS[key] ? BLOCKS[key].build(y) : null;
}

/**
 * Proyecto inicial: EXPERIENCIA ROMÁNTICA completa y lista para
 * personalizar — portada con corazones, carta, historia, contador,
 * fotos, mensaje secreto y canción.
 */
export function starterProject() {
  const pageId = uid('pg');
  const allNodes = [];
  let y = 0;
  for (const key of ['romanticHero', 'letter', 'timelineB', 'countdownB', 'polaroids', 'secret', 'music', 'footer']) {
    const block = buildBlock(key, y);
    allNodes.push(...block.nodes);
    y += block.height;
  }

  const nodesMap = {};
  for (const n of allNodes) nodesMap[n.id] = n;

  return {
    version: 1,
    meta: { name: 'Para Ti', created: Date.now(), modified: Date.now() },
    settings: {
      breakpoints: { desktop: 1280, tablet: 768, mobile: 390 },
      grid: { size: 8, visible: false, snap: true },
    },
    custom: { css: '', js: '' },
    pages: [{
      id: pageId, name: 'Inicio', slug: 'index', height: y, background: '#150a24',
      transition: 'corazones', transitionDuration: 900, custom: { css: '', js: '' },
      nodes: allNodes.map((n) => n.id),
    }],
    nodes: nodesMap,
    assets: [],
  };
}
