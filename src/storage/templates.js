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

/* ── API pública ─────────────────────────────────────── */

export const BLOCKS = {
  hero: { label: 'Héroe con partículas', icon: '✨', build: heroBlock },
  features: { label: 'Características (3 tarjetas)', icon: '🃏', build: featuresBlock },
  quote: { label: 'Cita destacada', icon: '❝', build: quoteBlock },
  gallery: { label: 'Galería', icon: '⊞', build: galleryBlock },
  cta: { label: 'Llamada a la acción', icon: '📣', build: ctaBlock },
  footer: { label: 'Pie de página', icon: '⚓', build: footerBlock },
};

export function buildBlock(key, y) {
  return BLOCKS[key] ? BLOCKS[key].build(y) : null;
}

/** Proyecto inicial: landing completa, larga y lista para editar. */
export function starterProject() {
  const pageId = uid('pg');
  const allNodes = [];
  let y = 0;
  for (const key of ['hero', 'features', 'quote', 'gallery', 'cta', 'footer']) {
    const block = buildBlock(key, y);
    allNodes.push(...block.nodes);
    y += block.height;
  }
  // Menú fijo arriba, por encima del héroe
  allNodes.push(node('menu', { x: 0, y: 0, w: W, h: 64 }, {
    name: 'Menú principal',
    props: { brand: '◆ Mi Sitio' },
    styles: { background: 'rgba(10,14,26,.55)', color: '#e2e8f0', fontSize: 15, blur: 10 },
  }));

  const nodesMap = {};
  for (const n of allNodes) nodesMap[n.id] = n;

  return {
    version: 1,
    meta: { name: 'Mi Proyecto', created: Date.now(), modified: Date.now() },
    settings: {
      breakpoints: { desktop: 1280, tablet: 768, mobile: 390 },
      grid: { size: 8, visible: false, snap: true },
    },
    pages: [{
      id: pageId, name: 'Inicio', slug: 'index', height: y, background: '#0b1020',
      transition: 'fade', nodes: allNodes.map((n) => n.id),
    }],
    nodes: nodesMap,
    assets: [],
  };
}
