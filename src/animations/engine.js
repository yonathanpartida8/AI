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
export const TRIGGERS = { load: 'Al cargar', scroll: 'Al hacer scroll', click: 'Al tocar / clic', hold: 'Al mantener presionado', hover: 'Al pasar el cursor' };

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
  /* ── Premium (v7): cristal, elástico, resorte, revelados… ── */
  cristal: [
    { opacity: 0, filter: 'blur(18px) saturate(.55)', transform: 'scale(1.06)' },
    { opacity: 1, filter: 'blur(0) saturate(1)', transform: 'scale(1)' },
  ],
  elastico: [
    { opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.16)', offset: 0.5 },
    { transform: 'scale(.94)', offset: 0.72 }, { transform: 'scale(1.04)', offset: 0.86 },
    { opacity: 1, transform: 'scale(1)' },
  ],
  resorte: [
    { opacity: 0, transform: 'translateY(70px)' }, { opacity: 1, transform: 'translateY(-16px)', offset: 0.55 },
    { transform: 'translateY(8px)', offset: 0.75 }, { transform: 'translateY(-4px)', offset: 0.88 },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  ondulacion: [
    { opacity: 0, transform: 'scale(.86)', boxShadow: '0 0 0 0 rgba(255,255,255,.35)' },
    { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 0 26px rgba(255,255,255,0)' },
  ],
  revelar: [{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }],
  expandir: [
    { clipPath: 'circle(0% at 50% 50%)', opacity: 0.5 },
    { clipPath: 'circle(75% at 50% 50%)', opacity: 1 },
  ],
  morph: [
    { opacity: 0, borderRadius: '62% 38% 56% 44% / 48% 62% 38% 52%', transform: 'scale(.6)' },
    { opacity: 1, borderRadius: '38% 62% 44% 56% / 60% 40% 58% 42%', transform: 'scale(1.06)', offset: 0.55 },
    { opacity: 1, transform: 'scale(1)' },
  ],
};

export const PRESET_NAMES = Object.keys(PRESETS);

/** Animaciones de SALIDA: se reproducen antes de ocultar un elemento. */
export const EXIT_PRESETS = {
  ninguna: null,
  fadeOut: [{ opacity: 1 }, { opacity: 0 }],
  fadeOutDown: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(40px)' }],
  fadeOutUp: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-40px)' }],
  zoomOut: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4)' }],
  slideOutLeft: [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(-90px)' }],
  slideOutRight: [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(90px)' }],
  flipOut: [{ opacity: 1, transform: 'perspective(700px) rotateY(0)' }, { opacity: 0, transform: 'perspective(700px) rotateY(90deg)' }],
  disolver: [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(14px)' }],
  colapsar: [
    { opacity: 1, clipPath: 'inset(0 0 0 0 round 12px)', transform: 'scale(1)' },
    { opacity: 0, clipPath: 'inset(50% 50% 50% 50% round 40px)', transform: 'scale(.9)' },
  ],
  elasticoOut: [
    { opacity: 1, transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.3 },
    { opacity: 0, transform: 'scale(.3)' },
  ],
  resorteOut: [
    { opacity: 1, transform: 'translateY(0)' }, { transform: 'translateY(-18px)', offset: 0.35 },
    { opacity: 0, transform: 'translateY(80px)' },
  ],
  revelarOut: [{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 100%)', opacity: 0.9 }],
};
export const EXIT_PRESET_NAMES = Object.keys(EXIT_PRESETS);

/** Reproduce la animación de salida (editor/vista previa, WAAPI). */
export function playExitAnimation(elem, animOut) {
  if (!animOut || !EXIT_PRESETS[animOut.preset]) return null;
  return elem.animate(EXIT_PRESETS[animOut.preset], {
    duration: animOut.duration || 450,
    easing: animOut.easing || 'ease-in',
    fill: 'both',
    composite: 'add',
  });
}

/** @keyframes CSS de un preset de salida (para el export). */
export function exitToKeyframesCSS(name) {
  return framesToKeyframesCSS(`wb-out-${name}`, EXIT_PRESETS[name]);
}

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
  if (frame.clipPath) rules.push(`clip-path:${frame.clipPath}`);
  if (frame.borderRadius) rules.push(`border-radius:${frame.borderRadius}`);
  if (frame.boxShadow) rules.push(`box-shadow:${frame.boxShadow}`);
  return rules.join(';');
}

/** Serializa una lista de keyframes WAAPI a un bloque @keyframes. */
function framesToKeyframesCSS(cssName, frames) {
  if (!frames) return '';
  const n = frames.length;
  const steps = frames.map((frame, i) => {
    const pct = frame.offset != null ? frame.offset * 100 : (i / (n - 1)) * 100;
    return `  ${Math.round(pct)}% { ${kfToCSS(frame)} }`;
  });
  return `@keyframes ${cssName} {\n${steps.join('\n')}\n}`;
}

/** Genera el bloque @keyframes de un preset. */
export function presetToKeyframesCSS(name) {
  return framesToKeyframesCSS(`wb-${name}`, PRESETS[name]);
}

/**
 * VALOR de la propiedad `animation` de un nodo (sin el nombre de la
 * propiedad): única fuente de verdad para el editor y el exportador.
 */
export function animationCSS(anim) {
  if (!anim || anim.preset === 'ninguna' || !PRESETS[anim.preset]) return '';
  const iter = anim.loop ? 'infinite' : '1';
  return `wb-${anim.preset} ${anim.duration || 800}ms ${anim.easing || 'ease-out'} ${anim.delay || 0}ms ${iter} both`;
}

/** Ídem para la animación de SALIDA. */
export function exitAnimationCSS(animOut) {
  if (!animOut || animOut.preset === 'ninguna' || !EXIT_PRESETS[animOut.preset]) return '';
  return `wb-out-${animOut.preset} ${animOut.duration || 450}ms ${animOut.easing || 'ease-in'} both`;
}
