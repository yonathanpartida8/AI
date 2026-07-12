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
      name: 'Pulsa para cambiar este recuerdo :>',
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
      props: { text: 'Bajo este cielo\nempezó todo', tag: 'h1' },
      styles: { fontSize: 58, fontWeight: '900', textAlign: 'center', color: '#f8fafc', letterSpacing: -1 },
      animation: load('fadeInUp'),
    }),
    node('text', { x: 320, y: y + 420, w: 640, h: 64 }, {
      name: 'Subtítulo héroe',
      props: { text: 'Un pequeño universo armado pieza a pieza\npara contarte lo que siento.', tag: 'p' },
      styles: { fontSize: 19, fontWeight: '400', textAlign: 'center', color: '#c7d2fe' },
      animation: load('fadeInUp', 250),
    }),
    node('button', { x: 530, y: y + 540, w: 220, h: 58 }, {
      name: 'Botón héroe',
      props: { text: 'Ven a verlo' },
      styles: { fontSize: 17, fontWeight: '800', textAlign: 'center', color: '#ffffff', background: 'linear-gradient(90deg,#8b5cf6,#ec4899)', radius: 29, shadow: 'neón' },
      animation: load('zoomIn', 500),
    }),
  ];
  return { height: 780, nodes };
}

function featuresBlock(y) {
  const cards = [
    ['💌', 'Detalles', 'Cada rincón de esta página esconde algo pensado solo para ti.'],
    ['✨', 'Momentos', 'Sorpresas que cobran vida cuando las tocas, como nosotros.'],
    ['💞', 'Nosotros', 'Una historia que se ve bonita en cualquier pantalla y a cualquier hora.'],
  ];
  const nodes = [
    node('text', { x: 340, y: y + 70, w: 600, h: 60 }, {
      name: 'Título características',
      props: { text: 'Hecho de pequeños detalles', tag: 'h2' },
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
        name: 'Un pensamiento bonito',
        styles: { background: 'linear-gradient(90deg,#0b1020,#1e1b4b,#0b1020)' },
      }),
      node('icon', { x: 600, y: y + 48, w: 80, h: 64 }, {
        name: 'Comillas', props: { glyph: '❝' }, styles: { fontSize: 52, color: '#8b5cf6' },
        animation: scroll('zoomIn'),
      }),
      node('text', { x: 240, y: y + 140, w: 800, h: 110 }, {
        name: 'Cita',
        props: { text: '“De todos mis lugares favoritos,\nel mejor sigue siendo a tu lado.”', tag: 'p' },
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
        name: 'Panel invitación',
        styles: { background: 'linear-gradient(120deg,#4f46e5,#9333ea,#db2777)', radius: 30, shadow: 'fuerte' },
        animation: scroll('zoomIn'),
      }),
      node('text', { x: 240, y: y + 135, w: 800, h: 66 }, {
        name: 'Título invitación',
        props: { text: '¿Seguimos escribiendo esta historia?', tag: 'h2' },
        styles: { fontSize: 34, fontWeight: '800', textAlign: 'center', color: '#ffffff' },
        animation: scroll('fadeInUp', 150),
      }),
      node('button', { x: 530, y: y + 235, w: 220, h: 54 }, {
        name: 'Botón invitación',
        props: { text: 'Sí, contigo' },
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
      node('section', { x: 0, y, w: W, h: 300 }, { name: 'El cierre con cariño', styles: { background: '#080b14' } }),
      node('text', { x: 90, y: y + 66, w: 380, h: 44 }, {
        name: 'Firma del pie', props: { text: 'Para ti, con amor', tag: 'h3' },
        styles: { fontSize: 24, fontWeight: '800', textAlign: 'left', color: '#e2e8f0', fontFamily: 'Georgia' },
      }),
      node('text', { x: 90, y: y + 118, w: 420, h: 30 }, {
        name: 'Lema pie', props: { text: 'Hecho a mano, de principio a fin', tag: 'p' },
        styles: { fontSize: 14, fontWeight: '400', textAlign: 'left', color: '#64748b' },
      }),
      node('text', { x: 830, y: y + 78, w: 360, h: 30 }, {
        name: 'Enlaces pie', props: { text: 'Nuestra historia · Recuerdos · Canciones', tag: 'p' },
        styles: { fontSize: 15, fontWeight: '400', textAlign: 'right', color: '#94a3b8' },
      }),
      node('shape', { x: 90, y: y + 182, w: 1100, h: 2 }, {
        name: 'Separador pie', styles: { background: 'rgba(148,163,184,.15)', radius: 0 },
      }),
      node('text', { x: 340, y: y + 218, w: 600, h: 30 }, {
        name: 'Copyright', props: { text: '© Nosotros — todos mis latidos reservados', tag: 'p' },
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
        name: 'Pulsa para cambiar este cielo :>',
        styles: { background: 'linear-gradient(175deg,#1e0a2e 0%,#3b0f3f 45%,#180b2b 100%)' },
      }),
      node('particles', { x: 0, y, w: W, h: 820 }, {
        name: 'Corazones que flotan por ti',
        styles: { background: 'transparent', radius: 0 },
        props: { count: 90, color: '#f472b6', speed: 0.7, size: 3, mode: 'corazones' },
      }),
      node('particles', { x: 0, y, w: W, h: 820 }, {
        name: 'Estrellitas de nuestras noches',
        styles: { background: 'transparent', radius: 0 },
        props: { count: 160, color: '#fbcfe8', speed: 0.6, size: 1.6, mode: 'estrellas' },
      }),
      node('text', { x: 240, y: y + 210, w: 800, h: 150 }, {
        name: 'Estas palabras son para ti',
        props: { text: 'Para ti, mi amor', tag: 'h1', textFx: 'brillo' },
        styles: { fontSize: 64, fontWeight: '900', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia', textGlow: 'rosa' },
        animation: load('zoomIn', 200, { duration: 1400 }),
      }),
      node('typewriter', { x: 290, y: y + 390, w: 700, h: 60 }, {
        name: 'Lo que quiero decirte',
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
        name: 'El tiempo que llevamos brillando',
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
      animation: scroll('resorte', i * 200, { duration: 1000 }),
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
        animation: scroll('expandir', 200, { duration: 1100 }),
      }),
    ],
  };
}

function chapterBlock(y) {
  return {
    height: 520,
    nodes: [
      node('section', { x: 0, y, w: W, h: 520 }, {
        name: 'El fondo de este capítulo',
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
    ['¿Desde cuándo lo supe?', 'Desde la primera vez que me hiciste reír sin siquiera intentarlo.'],
    ['¿Qué es lo que más me gusta?', 'Tu voz cuando me cuentas cómo estuvo tu día.'],
    ['¿Hasta cuándo?', 'Hasta que se acaben los atardeceres… y un día más.'],
  ];
  const nodes = [
    node('text', { x: 340, y: y + 70, w: 600, h: 60 }, {
      name: 'Título preguntas', props: { text: 'Cosas que me preguntas', tag: 'h2' },
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
        name: 'Donde me encuentras',
        styles: { background: 'linear-gradient(180deg,#0b1020,#151233,#0b1020)' },
      }),
      node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
        name: 'Título contacto', props: { text: 'Déjame un mensajito', tag: 'h2' },
        styles: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: '#f1f5f9' },
        animation: scroll('fadeInUp'),
      }),
      node('text', { x: 390, y: y + 128, w: 500, h: 34 }, {
        name: 'Subtítulo contacto', props: { text: 'Escríbeme algo bonito y me llegará directo al corazón', tag: 'p' },
        styles: { fontSize: 15, fontWeight: '400', textAlign: 'center', color: '#94a3b8' },
        animation: scroll('fadeIn', 150),
      }),
      node('form', { x: 380, y: y + 190, w: 520, h: 380 }, {
        name: 'Formulario del corazón',
        props: { title: '', fields: 'Nombre,Email,Mensaje', buttonText: 'Enviar con cariño' },
        styles: { background: 'rgba(15,23,42,.85)', radius: 22, color: '#e2e8f0', borderWidth: 1, borderColor: 'rgba(139,92,246,.35)', shadow: 'media' },
        animation: scroll('zoomIn', 200),
      }),
    ],
  };
}

function reasonsBlock(y) {
  const reasons = [
    ['😊', 'Tu sonrisa'], ['🎧', 'Nuestras canciones'], ['🌙', 'Cómo me cuidas'],
    ['😂', 'Tus locuras'], ['🫶', 'Tu forma de amar'], ['∞', 'Todo lo que viene'],
  ];
  const nodes = [
    node('text', { x: 290, y: y + 60, w: 700, h: 60 }, {
      name: 'Título razones', props: { text: 'Razones por las que te amo', tag: 'h2' },
      styles: { fontSize: 34, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
      animation: scroll('fadeInUp'),
    }),
  ];
  reasons.forEach(([emoji, reason], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const card = node('container', { x: 130 + col * 360, y: y + 160 + row * 175, w: 320, h: 145 }, {
      name: `Razón ${i + 1}`,
      styles: { background: 'rgba(244,114,182,.09)', radius: 20, borderWidth: 1, borderColor: 'rgba(244,114,182,.3)' },
      animation: scroll('flipInY', i * 120),
    });
    card.effects = { parallax: 0, tilt: true };
    card.events = [{ on: 'click', actions: [{ action: 'burstHearts', target: '', value: emoji, delay: 0 }] }];
    nodes.push(
      card,
      node('icon', { x: 130 + col * 360 + 125, y: y + 175 + row * 175, w: 70, h: 60 }, {
        name: `Emoji razón ${i + 1}`, props: { glyph: emoji }, styles: { fontSize: 38 },
        animation: scroll('zoomIn', i * 120 + 100),
      }),
      node('text', { x: 130 + col * 360 + 15, y: y + 240 + row * 175, w: 290, h: 44 }, {
        name: `Texto razón ${i + 1}`, props: { text: reason, tag: 'p' },
        styles: { fontSize: 17, fontWeight: '600', textAlign: 'center', color: '#fbcfe8' },
        animation: scroll('fadeIn', i * 120 + 150),
      }),
    );
  });
  return { height: 560, nodes };
}

function couponsBlock(y) {
  const coupons = [
    ['🎬', 'Vale por una noche de pelis', 'sin mirar el móvil'],
    ['🍕', 'Vale por tu cena favorita', 'donde tú elijas'],
    ['🤗', 'Vale por un abrazo infinito', 'canjeable a cualquier hora'],
  ];
  const nodes = [
    node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
      name: 'Título cupones', props: { text: 'Cupones de amor', tag: 'h2' },
      styles: { fontSize: 34, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
      animation: scroll('fadeInUp'),
    }),
    node('text', { x: 390, y: y + 125, w: 500, h: 30 }, {
      name: 'Subtítulo cupones', props: { text: 'Mantén presionado un cupón para canjearlo', tag: 'p' },
      styles: { fontSize: 14, color: 'rgba(249,168,212,.75)', textAlign: 'center' },
      animation: scroll('fadeIn', 120),
    }),
  ];
  coupons.forEach(([emoji, title, small], i) => {
    const card = node('container', { x: 105 + i * 370, y: y + 185, w: 340, h: 170 }, {
      name: `Cupón ${i + 1}`,
      styles: { background: 'linear-gradient(135deg,rgba(255,55,95,.16),rgba(175,82,222,.12))', radius: 18, borderWidth: 2, borderColor: 'rgba(255,55,95,.45)' },
      animation: scroll('slideInLeft', i * 150),
    });
    card.events = [{
      on: 'hold',
      actions: [
        { action: 'burstHearts', target: '', value: emoji, delay: 0 },
        { action: 'showMessage', target: '', value: `¡Cupón canjeado! ${emoji} ${title}`, delay: 200 },
        { action: 'vibrate', target: '', value: '80', delay: 0 },
      ],
    }];
    nodes.push(
      card,
      node('icon', { x: 105 + i * 370 + 135, y: y + 205, w: 70, h: 56 }, {
        name: `Emoji cupón ${i + 1}`, props: { glyph: emoji }, styles: { fontSize: 36 },
        animation: scroll('tada', i * 150 + 200),
      }),
      node('text', { x: 105 + i * 370 + 20, y: y + 268, w: 300, h: 46 }, {
        name: `Título cupón ${i + 1}`, props: { text: title, tag: 'h3' },
        styles: { fontSize: 17, fontWeight: '700', textAlign: 'center', color: '#fecdd3' },
        animation: scroll('fadeIn', i * 150 + 250),
      }),
      node('text', { x: 105 + i * 370 + 20, y: y + 316, w: 300, h: 26 }, {
        name: `Nota cupón ${i + 1}`, props: { text: small, tag: 'p' },
        styles: { fontSize: 12, color: 'rgba(253,242,248,.6)', textAlign: 'center' },
        animation: scroll('fadeIn', i * 150 + 300),
      }),
    );
  });
  return { height: 430, nodes };
}

function questionBlock(y) {
  const yesBtn = node('heartButton', { x: 430, y: y + 260, w: 200, h: 60 }, {
    name: 'Botón Sí',
    props: { text: '¡Sí! 💖', emoji: '💖' },
    styles: {
      fontSize: 19, fontWeight: '800', textAlign: 'center', color: '#fff',
      background: 'linear-gradient(90deg,#ff375f,#af52de)', radius: 30, shadow: 'neón',
    },
    animation: scroll('latido', 300, { loop: true, duration: 1500 }),
  });
  const noBtn = node('button', { x: 660, y: y + 260, w: 190, h: 60 }, {
    name: 'Botón Piénsalo',
    props: { text: 'Déjame pensarlo…' },
    styles: { fontSize: 15, fontWeight: '600', textAlign: 'center', color: '#d8b4fe', background: 'rgba(148,163,184,.12)', radius: 30 },
    animation: scroll('fadeIn', 400),
  });
  yesBtn.events = [{
    on: 'click',
    actions: [
      { action: 'burstHearts', target: '', value: '💖', delay: 0 },
      { action: 'burstHearts', target: '', value: '🎉', delay: 250 },
      { action: 'showMessage', target: '', value: '¡Sabía que dirías que sí! Te amo 💘', delay: 300 },
      { action: 'vibrate', target: '', value: '120', delay: 0 },
      { action: 'hideNode', target: noBtn.id, value: '', delay: 400 },
    ],
  }];
  noBtn.events = [{
    on: 'click',
    actions: [
      { action: 'playAnimation', target: yesBtn.id, value: '', delay: 0 },
      { action: 'showMessage', target: '', value: 'El otro botón te está esperando 😏', delay: 100 },
    ],
  }];
  return {
    height: 420,
    nodes: [
      node('particles', { x: 0, y, w: W, h: 420 }, {
        name: 'Luciérnagas pregunta',
        styles: { background: 'transparent', radius: 0 },
        props: { count: 60, color: '#f9a8d4', speed: 0.6, size: 2.4, mode: 'luciérnagas' },
      }),
      node('text', { x: 240, y: y + 90, w: 800, h: 110 }, {
        name: 'La gran pregunta',
        props: { text: '¿Quieres seguir escribiendo\nesta historia conmigo?', tag: 'h2' },
        styles: { fontSize: 40, fontWeight: '900', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia', textGlow: 'rosa' },
        animation: scroll('blurIn', 0, { duration: 1200 }),
      }),
      yesBtn,
      noBtn,
    ],
  };
}

function giftBlock(y) {
  const gifts = [['Un deseo', 'Pide lo que quieras'], ['Una promesa', 'Te la debo'], ['Una sorpresa', 'Muy pronto…']];
  const nodes = [
    node('text', { x: 340, y: y + 60, w: 600, h: 60 }, {
      name: 'Regalos para ti', props: { text: 'Tienes regalos por abrir', tag: 'h2' },
      styles: { fontSize: 34, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
      animation: scroll('fadeInUp'),
    }),
  ];
  gifts.forEach(([title, sub], i) => {
    const box = node('container', { x: 150 + i * 350, y: y + 170, w: 290, h: 200 }, {
      name: `Regalo ${i + 1}`,
      styles: { background: 'linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.04))', radius: 22, borderWidth: 1, borderColor: 'rgba(255,143,171,.4)', shadow: 'media' },
      animation: scroll('caida', i * 160),
    });
    box.effects = { parallax: 0, tilt: true, press: 'rebote', hoverFx: 'elevar' };
    box.events = [{
      on: 'click',
      actions: [
        { action: 'burstHearts', target: '', value: '🎁', delay: 0 },
        { action: 'showMessage', target: '', value: `${title}: ${sub}`, delay: 250 },
        { action: 'vibrate', target: '', value: '60', delay: 0 },
      ],
    }];
    nodes.push(box,
      node('text', { x: 150 + i * 350 + 20, y: y + 230, w: 250, h: 40 }, {
        name: `Título regalo ${i + 1}`, props: { text: title, tag: 'h3' },
        styles: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#fecdd3' },
        animation: scroll('fadeIn', i * 160 + 120),
      }),
      node('text', { x: 150 + i * 350 + 20, y: y + 280, w: 250, h: 30 }, {
        name: `Pista regalo ${i + 1}`, props: { text: 'Toca para abrirlo', tag: 'p' },
        styles: { fontSize: 12, color: 'rgba(253,242,248,.55)', textAlign: 'center' },
      }),
    );
  });
  return { height: 440, nodes };
}

function calendarBlock(y) {
  return {
    height: 400,
    nodes: [
      node('text', { x: 340, y: y + 55, w: 600, h: 55 }, {
        name: 'Fecha para recordar', props: { text: 'Una fecha para no olvidar', tag: 'h2' },
        styles: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp'),
      }),
      node('container', { x: 460, y: y + 135, w: 360, h: 210 }, {
        name: 'Hoja de calendario',
        styles: { background: '#fdf6ec', radius: 22, shadow: 'fuerte' },
        animation: scroll('giro3d', 150),
      }),
      node('shape', { x: 460, y: y + 135, w: 360, h: 54 }, {
        name: 'Cabecera calendario',
        styles: { background: 'linear-gradient(90deg,#f43f5e,#ec4899)', radius: 0 },
        animation: scroll('fadeIn', 200),
      }),
      node('text', { x: 470, y: y + 147, w: 340, h: 32 }, {
        name: 'Mes especial', props: { text: 'FEBRERO', tag: 'p' },
        styles: { fontSize: 17, fontWeight: '800', textAlign: 'center', color: '#fff', letterSpacing: 6 },
        animation: scroll('fadeIn', 250),
      }),
      node('text', { x: 470, y: y + 195, w: 340, h: 100 }, {
        name: 'El día', props: { text: '14', tag: 'h2' },
        styles: { fontSize: 84, fontWeight: '900', textAlign: 'center', color: '#1c1024' },
        animation: scroll('zoomIn', 320),
      }),
      node('text', { x: 470, y: y + 300, w: 340, h: 30 }, {
        name: 'Por qué importa', props: { text: 'El día que empezó todo', tag: 'p' },
        styles: { fontSize: 14, textAlign: 'center', color: '#8b5f6b', fontFamily: 'Georgia' },
        animation: scroll('fadeIn', 400),
      }),
    ],
  };
}

function gameBlock(y) {
  const game = node('customHTML', { x: 240, y: y + 150, w: 800, h: 380 }, {
    name: 'Atrapa mi corazón (juego)',
    props: {
      html: '<div class="cazacorazon"><div class="cc-marcador">Atrapa mi corazón · <b>0</b>/5</div><button class="cc-heart" aria-label="corazón"><svg viewBox="0 0 24 24" width="34" height="34" fill="#ff5f8f"><path d="M12 20s-7.5-4.9-9.3-9.1C1.3 7.6 3.6 4.5 6.8 4.5c2 0 3.6 1.1 4.4 2.7l.8 1.6.8-1.6c.8-1.6 2.4-2.7 4.4-2.7 3.2 0 5.5 3.1 4.1 6.4C19.5 15.1 12 20 12 20z"/></svg></button><div class="cc-final">¡Me atrapaste! Ya era tuyo desde el principio.</div></div>',
      css: '.cazacorazon{position:relative;width:100%;height:100%;border-radius:22px;background:linear-gradient(160deg,#1c1024,#2a1535);overflow:hidden;font-family:system-ui;color:#fff}.cc-marcador{position:absolute;top:14px;left:0;right:0;text-align:center;opacity:.85;font-size:14px;letter-spacing:.06em}.cc-heart{position:absolute;left:45%;top:45%;background:none;border:none;cursor:pointer;transition:left .25s cubic-bezier(.2,.9,.3,1.4),top .25s cubic-bezier(.2,.9,.3,1.4),transform .15s;filter:drop-shadow(0 6px 16px rgba(255,95,143,.5))}.cc-heart:active{transform:scale(.8)}.cc-final{position:absolute;inset:0;display:grid;place-items:center;font:700 22px Georgia,serif;text-align:center;padding:20px;background:rgba(28,16,36,.9);opacity:0;pointer-events:none;transition:opacity .6s}.cazacorazon.fin .cc-final{opacity:1}',
      js: "const caja=document.currentScript.closest('.wb-custom').querySelector('.cazacorazon');const h=caja.querySelector('.cc-heart');const m=caja.querySelector('.cc-marcador b');let n=0;function huye(){h.style.left=(8+Math.random()*78)+'%';h.style.top=(18+Math.random()*66)+'%';}h.addEventListener('pointerenter',()=>{if(n<4)huye();});h.addEventListener('click',()=>{n++;m.textContent=n;if(navigator.vibrate)navigator.vibrate(25);if(n>=5){caja.classList.add('fin');}else huye();});",
    },
  });
  return {
    height: 600,
    nodes: [
      node('text', { x: 340, y: y + 55, w: 600, h: 55 }, {
        name: 'Título del juego', props: { text: '¿Podrás atraparlo?', tag: 'h2' },
        styles: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: '#fdf2f8', fontFamily: 'Georgia' },
        animation: scroll('fadeInUp'),
      }),
      game,
    ],
  };
}

/* ── API pública ─────────────────────────────────────── */

export const BLOCKS = {
  romanticHero: { label: 'Portada romántica', icon: '💘', build: romanticHeroBlock },
  letter: { label: 'Carta de amor', icon: '💌', build: letterBlock },
  timelineB: { label: 'Nuestra historia (línea de tiempo)', icon: '🕰', build: timelineBlock },
  countdownB: { label: 'Contador de amor', icon: '⏳', build: countdownBlock },
  polaroids: { label: 'Fotos polaroid', icon: '📸', build: polaroidsBlock },
  secret: { label: 'Mensaje secreto', icon: '🔮', build: secretBlock },
  chapter: { label: 'Capítulo de historia', icon: '📖', build: chapterBlock },
  music: { label: 'Nuestra canción', icon: '🎶', build: musicBlock },
  reasons: { label: 'Razones por las que te amo', icon: '💝', build: reasonsBlock },
  coupons: { label: 'Cupones de amor', icon: '🎟', build: couponsBlock },
  question: { label: 'La gran pregunta (Sí/No)', icon: '💍', build: questionBlock },
  gift: { label: 'Regalos por abrir', icon: '🎁', build: giftBlock },
  calendar: { label: 'Fecha para recordar', icon: '📅', build: calendarBlock },
  game: { label: 'Juego: atrapa mi corazón', icon: '🕹', build: gameBlock },
  hero: { label: 'Portada estrellada', icon: '✨', build: heroBlock },
  features: { label: 'Tres detalles (tarjetas)', icon: '🃏', build: featuresBlock },
  quote: { label: 'Frase para enmarcar', icon: '❝', build: quoteBlock },
  gallery: { label: 'Galería', icon: '⊞', build: galleryBlock },
  faq: { label: 'Cosas que me preguntas', icon: '❓', build: faqBlock },
  contact: { label: 'Mensajito para mí', icon: '✉', build: contactBlock },
  cta: { label: 'Invitación especial', icon: '📣', build: ctaBlock },
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
  for (const key of ['romanticHero', 'letter', 'timelineB', 'countdownB', 'polaroids', 'reasons', 'secret', 'question', 'music', 'footer']) {
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
