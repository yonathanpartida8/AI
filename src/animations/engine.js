/* ============================================================
 * animations/engine.js — Motor de Animaciones
 *
 * Los presets se definen como DATOS (keyframes puros). El mismo
 * preset se ejecuta por dos vías:
 *
 *  1. EDITOR / vista previa → Web Animations API (element.animate)
 *     con control total: play, pause, reverse, velocidad.
 *  2. EXPORTACIÓN → se compila a @keyframes CSS (cero JS para
 *     animaciones de carga; máximo rendimiento, GPU-friendly).
 *
 * Triggers soportados: load | scroll | click | hover
 * (scroll usa IntersectionObserver en el runtime exportado).
 * ============================================================ */

export const EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(.68,-0.55,.27,1.55)'];
export const TRIGGERS = { load: 'Al cargar', scroll: 'Al hacer scroll', click: 'Al hacer clic', hover: 'Al pasar el ratón' };

/**
 * Cada preset: lista de keyframes compatible con WAAPI.
 * Solo transform/opacity/filter → composición en GPU, 60-120 fps.
 */
export const PRESETS = {
  ninguna: null,
  fadeIn: [{ opacity: 0 }, { opacity: 1 }],
  fadeInUp: [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }],
  fadeInDown: [{ opacity: 0, transform: 'translateY(-40px)' }, { opacity: 1, transform: 'translateY(0)' }],
  slideInLeft: [{ opacity: 0, transform: 'translateX(-80px)' }, { opacity: 1, transform: 'translateX(0)' }],
  slideInRight: [{ opacity: 0, transform: 'translateX(80px)' }, { opacity: 1, transform: 'translateX(0)' }],
  zoomIn: [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }],
  zoomOut: [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }],
  rotateIn: [{ opacity: 0, transform: 'rotate(-180deg) scale(.4)' }, { opacity: 1, transform: 'rotate(0) scale(1)' }],
  blurIn: [{ opacity: 0, filter: 'blur(16px)' }, { opacity: 1, filter: 'blur(0)' }],
  bounce: [
    { transform: 'translateY(0)' }, { transform: 'translateY(-24px)', offset: 0.4 },
    { transform: 'translateY(0)', offset: 0.6 }, { transform: 'translateY(-10px)', offset: 0.8 },
    { transform: 'translateY(0)' },
  ],
  pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.5 }, { transform: 'scale(1)' }],
  float: [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: 0.5 }, { transform: 'translateY(0)' }],
  wiggle: [
    { transform: 'rotate(0)' }, { transform: 'rotate(-4deg)', offset: 0.25 },
    { transform: 'rotate(4deg)', offset: 0.75 }, { transform: 'rotate(0)' },
  ],
  spin: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }],
  /* ── Románticos y llamativos ── */
  latido: [
    { transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.14 },
    { transform: 'scale(1)', offset: 0.28 }, { transform: 'scale(1.14)', offset: 0.42 },
    { transform: 'scale(1)', offset: 0.7 }, { transform: 'scale(1)' },
  ],
  tada: [
    { transform: 'scale(1) rotate(0)' }, { transform: 'scale(.9) rotate(-3deg)', offset: 0.2 },
    { transform: 'scale(1.1) rotate(3deg)', offset: 0.5 }, { transform: 'scale(1.1) rotate(-3deg)', offset: 0.7 },
    { transform: 'scale(1) rotate(0)' },
  ],
  flipInX: [{ opacity: 0, transform: 'perspective(700px) rotateX(90deg)' }, { opacity: 1, transform: 'perspective(700px) rotateX(0)' }],
  flipInY: [{ opacity: 0, transform: 'perspective(700px) rotateY(90deg)' }, { opacity: 1, transform: 'perspective(700px) rotateY(0)' }],
  giro3d: [{ opacity: 0, transform: 'perspective(800px) rotateY(-70deg) scale(.7)' }, { opacity: 1, transform: 'perspective(800px) rotateY(0) scale(1)' }],
  swing: [
    { transform: 'rotate(0)' }, { transform: 'rotate(9deg)', offset: 0.25 },
    { transform: 'rotate(-7deg)', offset: 0.5 }, { transform: 'rotate(4deg)', offset: 0.75 }, { transform: 'rotate(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' }, { transform: 'translateX(-8px)', offset: 0.2 },
    { transform: 'translateX(8px)', offset: 0.4 }, { transform: 'translateX(-6px)', offset: 0.6 },
    { transform: 'translateX(6px)', offset: 0.8 }, { transform: 'translateX(0)' },
  ],
  brillo: [
    { filter: 'brightness(1) drop-shadow(0 0 0 rgba(244,114,182,0))' },
    { filter: 'brightness(1.35) drop-shadow(0 0 18px rgba(244,114,182,.9))', offset: 0.5 },
    { filter: 'brightness(1) drop-shadow(0 0 0 rgba(244,114,182,0))' },
  ],
  caida: [
    { opacity: 0, transform: 'translateY(-90px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.6 },
    { transform: 'translateY(-16px)', offset: 0.8 }, { transform: 'translateY(0)' },
  ],
  respirar: [{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(1.045)', opacity: 1, offset: 0.5 }, { transform: 'scale(1)', opacity: 0.9 }],
};

export const PRESET_NAMES = Object.keys(PRESETS);

/**
 * Ejecuta la animación de un nodo en el editor (WAAPI).
 * La rotación/escala base del nodo vive en el ELEMENTO CONTENEDOR,
 * y la animación en un wrapper interno, para no pelearse por
 * `transform`. En el editor animamos el propio elemento porque
 * las previews se disparan con el nodo sin rotar en la práctica;
 * el runtime exportado usa la misma técnica.
 */
export function playAnimation(elem, anim) {
  if (!anim || !PRESETS[anim.preset]) return null;
  return elem.animate(PRESETS[anim.preset], {
    duration: anim.duration || 800,
    delay: anim.delay || 0,
    iterations: anim.loop ? Infinity : 1,
    easing: anim.easing || 'ease-out',
    fill: 'both',
    composite: 'add', // suma sobre el transform base (rotación/escala del nodo)
  });
}

/* ── Compilación a CSS para el exportador ────────────── */

function kfToCSS(frame) {
  const rules = [];
  if (frame.opacity != null) rules.push(`opacity:${frame.opacity}`);
  if (frame.transform) rules.push(`transform:${frame.transform}`);
  if (frame.filter) rules.push(`filter:${frame.filter}`);
  return rules.join(';');
}

/** Genera el bloque @keyframes de un preset. */
export function presetToKeyframesCSS(name) {
  const frames = PRESETS[name];
  if (!frames) return '';
  const n = frames.length;
  const steps = frames.map((frame, i) => {
    const pct = frame.offset != null ? frame.offset * 100 : (i / (n - 1)) * 100;
    return `  ${Math.round(pct)}% { ${kfToCSS(frame)} }`;
  });
  return `@keyframes wb-${name} {\n${steps.join('\n')}\n}`;
}

/** Propiedad CSS `animation` de un nodo concreto. */
export function animationCSS(anim) {
  if (!anim || anim.preset === 'ninguna' || !PRESETS[anim.preset]) return '';
  const iter = anim.loop ? 'infinite' : '1';
  return `animation: wb-${anim.preset} ${anim.duration || 800}ms ${anim.easing || 'ease-out'} ${anim.delay || 0}ms ${iter} both;`;
}
