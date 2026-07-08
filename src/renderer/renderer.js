/* ============================================================
 * renderer/renderer.js — Motor de Renderizado
 *
 * DECISIÓN CLAVE: el mismo módulo genera el contenido de los
 * nodos tanto para el EDITOR (dataURLs de IndexedDB) como para
 * el EXPORTADOR (rutas relativas assets/…). Así el resultado
 * exportado es idéntico píxel a píxel a lo que ve el usuario.
 *
 *   ctx = {
 *     resolve(assetId) → src utilizable,
 *     pages[]          → para menús de navegación,
 *     pageHref(page)   → href de cada página,
 *     editor: bool     → desactiva interacción interna en el editor
 *   }
 * ============================================================ */

import { esc } from '../utils/helpers.js';

const SHADOWS = {
  ninguna: 'none',
  suave: '0 4px 16px rgba(0,0,0,.25)',
  media: '0 10px 30px rgba(0,0,0,.4)',
  fuerte: '0 20px 60px rgba(0,0,0,.6)',
  neón: '0 0 24px rgba(129,140,248,.8), 0 0 60px rgba(129,140,248,.4)',
};

const CLIP_PATHS = {
  'círculo': 'circle(50% at 50% 50%)',
  'triángulo': 'polygon(50% 0%, 0% 100%, 100% 100%)',
  'rombo': 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  'estrella': 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  'hexágono': 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
};

const IMG_FILTERS = {
  ninguno: () => 'none',
  grises: (a) => `grayscale(${a}%)`,
  sepia: (a) => `sepia(${a}%)`,
  brillo: (a) => `brightness(${a}%)`,
  contraste: (a) => `contrast(${a}%)`,
  saturado: (a) => `saturate(${a}%)`,
  invertido: (a) => `invert(${Math.min(a, 100)}%)`,
};

/* ── Estilos ─────────────────────────────────────────── */

/** CSS de posición/transform a partir del marco efectivo. */
export function frameCSS(frame) {
  return {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.w}px`,
    height: `${frame.h}px`,
    transform: `rotate(${frame.rotation || 0}deg) scale(${frame.scale ?? 1})`,
    opacity: String(frame.opacity ?? 1),
  };
}

/** CSS visual (colores, tipografía, bordes…) del nodo. */
export function styleCSS(node) {
  const s = node.styles || {};
  const css = {};
  if (s.background) css.background = s.background;
  if (s.color) css.color = s.color;
  if (s.fontFamily) css['font-family'] = s.fontFamily;
  if (s.fontSize) css['font-size'] = `${s.fontSize}px`;
  if (s.fontWeight) css['font-weight'] = s.fontWeight;
  if (s.textAlign) css['text-align'] = s.textAlign;
  if (s.letterSpacing) css['letter-spacing'] = `${s.letterSpacing}px`;
  if (s.radius) css['border-radius'] = `${s.radius}px`;
  if (s.borderWidth) css.border = `${s.borderWidth}px solid ${s.borderColor || '#94a3b8'}`;
  if (s.shadow && s.shadow !== 'ninguna') css['box-shadow'] = SHADOWS[s.shadow] || 'none';
  if (s.blur) css['backdrop-filter'] = `blur(${s.blur}px)`;
  if (node.type === 'shape' && node.props.shape !== 'rectángulo') {
    css['clip-path'] = CLIP_PATHS[node.props.shape] || 'none';
    css['border-radius'] = '0';
  }
  if (node.hidden) css.visibility = 'hidden';
  return css;
}

/* ── Contenido HTML por tipo de componente ───────────── */

function media(node, ctx) {
  const src = node.props.assetId ? ctx.resolve(node.props.assetId) : '';
  const fit = node.props.fit || 'cover';
  if (!src) return `<div class="wb-placeholder">${esc(node.name)}<small>Arrastra un asset aquí</small></div>`;
  const filter = IMG_FILTERS[node.props.filter || 'ninguno'](node.props.filterAmount ?? 100);
  return `<img src="${src}" alt="${esc(node.props.alt || node.name)}" draggable="false"
    style="width:100%;height:100%;object-fit:${fit};filter:${filter};border-radius:inherit;pointer-events:none">`;
}

export function contentHTML(node, ctx) {
  const p = node.props || {};
  switch (node.type) {
    case 'text': {
      const tag = ['h1', 'h2', 'h3', 'p', 'span'].includes(p.tag) ? p.tag : 'p';
      return `<${tag} class="wb-text">${esc(p.text).replaceAll('\n', '<br>')}</${tag}>`;
    }
    case 'button':
      return `<button class="wb-btn" type="button">${esc(p.text)}</button>`;

    case 'image':
    case 'drawing':
      return media(node, ctx);

    case 'gif': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      if (!src) return `<div class="wb-placeholder">GIF<small>Arrastra un GIF aquí</small></div>`;
      // Un GIF pausado se congela pintándolo en un canvas (lo hace el runtime).
      return `<img class="wb-gif" src="${src}" data-playing="${p.playing !== false}" draggable="false"
        style="width:100%;height:100%;object-fit:${p.fit || 'cover'};border-radius:inherit;pointer-events:none">`;
    }

    case 'video': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      if (!src) return `<div class="wb-placeholder">Vídeo<small>Arrastra un vídeo aquí</small></div>`;
      const attrs = [
        p.autoplay && !p.playOnScroll ? 'autoplay' : '', p.loop ? 'loop' : '', p.muted ? 'muted' : '',
        p.controls ? 'controls' : '', 'playsinline',
        p.playOnScroll ? 'data-scrollplay="1"' : '',
      ].filter(Boolean).join(' ');
      return `<video src="${src}" ${attrs} style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></video>`;
    }

    case 'audio': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      if (!src) return `<div class="wb-placeholder">Audio<small>Arrastra un audio aquí</small></div>`;
      return `<audio src="${src}" controls ${p.autoplay ? 'autoplay' : ''} ${p.loop ? 'loop' : ''} style="width:100%"></audio>`;
    }

    case 'icon':
      return `<span class="wb-icon">${esc(p.glyph || '★')}</span>`;

    case 'shape':
    case 'container':
    case 'section':
      return ctx.editor && node.type !== 'shape' ? `<span class="wb-tag-label">${esc(node.name)}</span>` : '';

    case 'gallery': {
      const ids = p.assetIds || [];
      if (!ids.length) return `<div class="wb-placeholder">Galería<small>Añade imágenes desde Assets</small></div>`;
      const cells = ids.map((id) => `<img src="${ctx.resolve(id)}" alt="" loading="lazy" draggable="false"
        style="width:100%;height:100%;object-fit:cover;border-radius:inherit;pointer-events:none">`).join('');
      return `<div class="wb-gallery" style="display:grid;grid-template-columns:repeat(${p.columns || 3},1fr);gap:${p.gap ?? 10}px;width:100%;height:100%">${cells}</div>`;
    }

    case 'slider': {
      const ids = p.assetIds || [];
      if (!ids.length) return `<div class="wb-placeholder">Slider<small>Añade imágenes desde Assets</small></div>`;
      const slides = ids.map((id, i) => `<img class="wb-slide${i === 0 ? ' active' : ''}" src="${ctx.resolve(id)}" alt="" draggable="false">`).join('');
      return `<div class="wb-slider" data-interval="${p.interval || 3000}" data-transition="${p.transition || 'fade'}">${slides}</div>`;
    }

    case 'form': {
      const fields = String(p.fields || 'Nombre,Email').split(',').map((f) => f.trim()).filter(Boolean);
      const inputs = fields.map((f) => /mensaje|comentario/i.test(f)
        ? `<textarea placeholder="${esc(f)}" rows="3"></textarea>`
        : `<input type="${/mail/i.test(f) ? 'email' : 'text'}" placeholder="${esc(f)}">`).join('');
      return `<form class="wb-form" onsubmit="return false">
        <h3>${esc(p.title || '')}</h3>${inputs}
        <button type="submit">${esc(p.buttonText || 'Enviar')}</button></form>`;
    }

    case 'menu': {
      const links = (ctx.pages || []).map((page) =>
        `<a href="${ctx.editor ? '#' : ctx.pageHref(page)}" data-page="${page.id}">${esc(page.name)}</a>`).join('');
      return `<nav class="wb-menu"><strong>${esc(p.brand || '')}</strong><div class="wb-menu-links">${links}</div></nav>`;
    }

    case 'musicPlayer': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      return `<div class="wb-player">
        <div class="wb-player-disc">♫</div>
        <div class="wb-player-info"><strong>${esc(p.title || '')}</strong><span>${esc(p.artist || '')}</span>
        ${src ? `<audio src="${src}" controls style="width:100%;height:28px"></audio>` : '<small>Sin pista de audio</small>'}</div></div>`;
    }

    case 'model3d':
      return `<div class="wb-3d" data-model="${p.assetId || ''}"
        data-autorotate="${p.autoRotate !== false}" data-speed="${p.rotateSpeed ?? 1}"
        data-cameraz="${p.cameraZ ?? 4}" data-lightcolor="${p.lightColor || '#ffffff'}"
        data-lightintensity="${p.lightIntensity ?? 2}" data-playanim="${p.playAnimations !== false}"></div>`;

    case 'particles':
      return `<canvas class="wb-particles" data-count="${p.count ?? 400}" data-color="${p.color || '#818cf8'}"
        data-speed="${p.speed ?? 1}" data-size="${p.size ?? 2}" data-mode="${p.mode || 'nebulosa'}"></canvas>`;

    default:
      return `<div class="wb-placeholder">${esc(node.type)}</div>`;
  }
}

/* ── Render del EDITOR ───────────────────────────────── */

/** Aplica marco + estilos visuales al elemento del editor. */
export function syncNodeEl(elem, node, store) {
  const frame = store.frame(node);
  Object.assign(elem.style, frameCSS(frame));
  // Limpia estilos visuales previos y aplica los actuales
  for (const prop of ['background', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign',
    'letterSpacing', 'borderRadius', 'border', 'boxShadow', 'backdropFilter', 'clipPath', 'visibility']) {
    elem.style[prop] = '';
  }
  for (const [k, v] of Object.entries(styleCSS(node))) elem.style.setProperty(k, v);
  elem.classList.toggle('locked', !!node.locked);
  elem.classList.toggle('hidden-node', !!node.hidden);
  // En el editor un nodo oculto se muestra semitransparente, no invisible
  if (node.hidden) { elem.style.visibility = ''; elem.style.opacity = '0.25'; }
}

export function buildNodeEl(node, store, ctx) {
  const elem = document.createElement('div');
  elem.className = 'wb-node';
  elem.dataset.id = node.id;
  elem.dataset.type = node.type;
  elem.innerHTML = contentHTML(node, ctx);
  syncNodeEl(elem, node, store);
  return elem;
}

/** Repinta la página activa completa dentro del artboard. */
export function renderPage(artboard, store, assets, { mountEmbeds } = {}) {
  const page = store.page;
  const ctx = {
    editor: true,
    resolve: (id) => assets.url(id),
    pages: store.project.pages,
    pageHref: () => '#',
  };
  artboard.innerHTML = '';
  artboard.style.background = page.background || '#0b1020';
  artboard.style.width = `${store.project.settings.breakpoints[store.device]}px`;
  artboard.style.height = `${page.height}px`;
  for (const node of store.pageNodes()) artboard.append(buildNodeEl(node, store, ctx));
  mountEmbeds?.(artboard); // monta WebGL/partículas tras insertar el DOM
}
