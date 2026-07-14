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

const TEXT_GLOW_CSS = {
  ninguno: '',
  suave: '0 2px 12px rgba(0,0,0,.45)',
  'neón': '0 0 8px rgba(129,140,248,.9), 0 0 26px rgba(129,140,248,.6)',
  rosa: '0 0 10px rgba(244,114,182,.95), 0 0 30px rgba(236,72,153,.6)',
  dorado: '0 0 10px rgba(251,191,36,.95), 0 0 28px rgba(245,158,11,.55)',
  fuego: '0 0 6px rgba(251,146,60,.9), 0 0 20px rgba(239,68,68,.75), 0 0 44px rgba(220,38,38,.5)',
  hielo: '0 0 8px rgba(186,230,253,.95), 0 0 26px rgba(56,189,248,.6)',
};

/* Iconos SVG del reproductor (sin emojis, coherentes en export) */
const MUSIC_NOTE_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l12-7.5L7 4.5z"/></svg>';

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
  if (s.lineHeight) css['line-height'] = String(s.lineHeight);
  if (s.textGlow && TEXT_GLOW_CSS[s.textGlow]) css['text-shadow'] = TEXT_GLOW_CSS[s.textGlow];
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
  if (!src) return `<div class="wb-placeholder">${esc(node.name)}<small>Toca para poner aquí un recuerdo</small></div>`;
  const filter = IMG_FILTERS[node.props.filter || 'ninguno'](node.props.filterAmount ?? 100);
  return `<img src="${src}" alt="${esc(node.props.alt || node.name)}" draggable="false" loading="lazy" decoding="async"
    style="width:100%;height:100%;object-fit:${fit};filter:${filter};border-radius:inherit;pointer-events:none">`;
}

export function contentHTML(node, ctx) {
  const p = node.props || {};
  switch (node.type) {
    case 'text': {
      const tag = ['h1', 'h2', 'h3', 'p', 'span'].includes(p.tag) ? p.tag : 'p';
      const fx = p.textFx && p.textFx !== 'ninguno' ? ` data-fx="${p.textFx}"` : '';
      return `<${tag} class="wb-text"${fx}>${esc(p.text).replaceAll('\n', '<br>')}</${tag}>`;
    }
    case 'button':
      return `<button class="wb-btn" type="button">${esc(p.text)}</button>`;

    case 'navButton': {
      const dir = p.target === '__prev' ? 'prev' : 'next';
      const arrow = p.showArrow !== false ? `<span class="wb-nav-arrow">${dir === 'prev' ? '←' : '→'}</span>` : '';
      const variantStyle = {
        'fantasma': 'background:transparent;border:2px solid currentColor;box-shadow:none;',
        'neón': 'box-shadow:0 0 18px rgba(255,143,171,.8),0 0 44px rgba(179,136,235,.5);',
        'flecha': 'background:transparent;box-shadow:none;font-size:2.2em;',
      }[p.variant] || '';
      const cls = p.variant === 'burbuja' ? ' wb-nav-burbuja' : '';
      const inner = p.variant === 'flecha' ? arrow || '→' : `${dir === 'prev' ? arrow : ''}<span>${esc(p.text)}</span>${dir === 'next' ? arrow : ''}`;
      return `<button class="wb-nav${cls}" type="button" data-dir="${dir}" data-navto="${esc(p.target || '__next')}" style="${variantStyle}">${inner}</button>`;
    }

    case 'image':
    case 'drawing':
      return media(node, ctx);

    case 'gif': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      if (!src) return `<div class="wb-placeholder">GIF<small>Un momento en movimiento va aquí</small></div>`;
      // Un GIF pausado se congela pintándolo en un canvas (lo hace el runtime).
      return `<img class="wb-gif" src="${src}" data-playing="${p.playing !== false}" draggable="false" decoding="async"
        style="width:100%;height:100%;object-fit:${p.fit || 'cover'};border-radius:inherit;pointer-events:none">`;
    }

    case 'video': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      if (!src) return `<div class="wb-placeholder">Vídeo<small>Ese vídeo que os hace sonreír</small></div>`;
      const attrs = [
        p.autoplay && !p.playOnScroll ? 'autoplay' : '', p.loop ? 'loop' : '', p.muted ? 'muted' : '',
        p.controls ? 'controls' : '', 'playsinline',
        // Sin autoplay solo se lee la cabecera del vídeo hasta que se toca
        p.autoplay || p.playOnScroll ? '' : 'preload="metadata"',
        p.playOnScroll ? 'data-scrollplay="1"' : '',
      ].filter(Boolean).join(' ');
      return `<video src="${src}" ${attrs} style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></video>`;
    }

    case 'audio': {
      const src = p.assetId ? ctx.resolve(p.assetId) : (p.srcUrl || '');
      if (!src) return `<div class="wb-placeholder">Audio<small>Una melodía para este rincón</small></div>`;
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
      if (!ids.length) return `<div class="wb-placeholder">Galería<small>Vuestras fotos favoritas, juntas</small></div>`;
      const cells = ids.map((id) => `<img src="${ctx.resolve(id)}" alt="" loading="lazy" draggable="false"
        style="width:100%;height:100%;object-fit:cover;border-radius:inherit;pointer-events:none">`).join('');
      return `<div class="wb-gallery" style="display:grid;grid-template-columns:repeat(${p.columns || 3},1fr);gap:${p.gap ?? 10}px;width:100%;height:100%">${cells}</div>`;
    }

    case 'slider': {
      const ids = p.assetIds || [];
      if (!ids.length) return `<div class="wb-placeholder">Slider<small>Recuerdos que pasan solos</small></div>`;
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
      // Fuentes admitidas: canción subida en Assets, carpeta contenido/musica
      // o una URL de audio directa. Cualquier otra cosa → estado vacío.
      let src = p.assetId ? ctx.resolve(p.assetId) : (p.srcUrl || '');
      if (/youtu/i.test(String(src))) src = '';
      const cover = p.coverId
        ? `<img class="wb-mp-cover" src="${ctx.resolve(p.coverId)}" alt="" draggable="false">`
        : `<div class="wb-mp-cover wb-mp-cover-icon">${MUSIC_NOTE_SVG}</div>`;
      const mini = p.variant === 'mini';
      return `<div class="wb-mp${mini ? ' wb-mp-mini' : ''}">
        ${cover}
        <div class="wb-mp-body">
          <div class="wb-mp-meta"><strong>${esc(p.title || '')}</strong><span>${esc(p.artist || '')}</span></div>
          ${src ? `
          <div class="wb-mp-controls">
            <button class="wb-mp-play" type="button" aria-label="Reproducir">${PLAY_SVG}</button>
            <div class="wb-mp-track"><div class="wb-mp-fill"></div></div>
            <span class="wb-mp-time">0:00</span>
          </div>` : '<small class="wb-mp-empty">Elige una canción para este momento</small>'}
        </div>
        <div class="wb-eq"><i></i><i></i><i></i><i></i></div>
        ${src ? `<audio src="${esc(src)}" preload="metadata"></audio>` : ''}
      </div>`;
    }

    case 'model3d':
      return `<div class="wb-3d" data-kind="model" data-model="${p.assetId ? ctx.resolve(p.assetId) : ''}"
        data-autorotate="${p.autoRotate !== false}" data-speed="${p.rotateSpeed ?? 1}"
        data-cameraz="${p.cameraZ ?? 4}" data-lightcolor="${p.lightColor || '#ffffff'}"
        data-lightintensity="${p.lightIntensity ?? 2}" data-playanim="${p.playAnimations !== false}"></div>`;

    case 'heart3d':
      return `<div class="wb-3d" data-kind="heart" data-color="${p.color || '#e11d48'}"
        data-autorotate="${p.autoRotate !== false}" data-speed="${p.rotateSpeed ?? 1}"
        data-metal="${p.metal ?? 0.35}" data-cameraz="${p.cameraZ ?? 4}"></div>`;

    case 'photo3d': {
      if (!p.assetId) return `<div class="wb-placeholder">Foto 3D<small>Una foto con profundidad — elígela en Diseño</small></div>`;
      return `<div class="wb-3d" data-kind="photo" data-src="${ctx.resolve(p.assetId)}" data-depth="${p.depth ?? 1}"></div>`;
    }

    case 'htmlEmbed': {
      if (!p.assetId) return `<div class="wb-placeholder">🌐 Página HTML<small>Sube un .html en Assets y elígelo en Diseño</small></div>`;
      /*
       * El HTML importado se renderiza en un VIEWPORT VIRTUAL del ancho
       * para el que fue diseñado (props.viewWidth, 1280 por defecto) y se
       * ESCALA proporcionalmente al tamaño del contenedor con transform
       * (GPU, sin deformación ni pérdida de calidad). El escalado exacto
       * lo aplican syncNodeEl (editor, en tiempo real) y el CSS exportado.
       *
       * srcdoc evita los límites/errores de los dataURL. En el editor va
       * inerte (sin scripts) salvo que actives «Activo mientras editas»;
       * en vista previa y en el sitio final corre completo: botones,
       * formularios, enlaces, scroll y eventos funcionan como en un
       * navegador independiente (sandbox ampliado).
       */
      const html = (ctx.htmlText ? ctx.htmlText(p.assetId) : '') || '';
      const doc = html.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      const FULL = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock';
      const inert = !ctx.editor && p.interactive === false ? 'pointer-events:none;' : '';
      if (ctx.editor) {
        const sandbox = p.liveInEditor ? FULL : 'allow-same-origin';
        return `<div class="wb-embed" style="width:100%;height:100%;border-radius:inherit;overflow:hidden;position:relative">
          <iframe srcdoc="${doc}" sandbox="${sandbox}" loading="lazy"></iframe></div>`;
      }
      // EXPORT: carga diferida — el documento viaja en data-doc y el runtime
      // lo monta al acercarse al viewport, ESCALONADO (uno por frame). Así
      // varios HTML pesados conviven sin picos de CPU ni caídas de FPS.
      return `<div class="wb-embed" style="width:100%;height:100%;border-radius:inherit;overflow:hidden;position:relative">
        <iframe data-doc="${doc}" sandbox="${FULL}" style="${inert}"></iframe></div>`;
    }

    case 'custom3D':
      // El código viaja en un <script> inerte; lo ejecuta el motor 3D
      return `<div class="wb-3d" data-kind="custom" data-cameraz="${p.cameraZ ?? 4}"><script type="text/wb-3d">${String(p.code || '').replaceAll('</script', '<\\/script')}</script></div>`;

    case 'gradientBg': {
      const colors = String(p.colors || '#ec4899,#8b5cf6').split(',').map((c) => c.trim()).filter(Boolean);
      const gradient = `linear-gradient(270deg, ${colors.join(', ')})`;
      return `<div class="wb-gradbg" style="background:${gradient};--gspeed:${p.speed || 8}s"></div>`;
    }

    case 'loveLetter': {
      const photo = p.photoId ? `<img class="wb-letter-photo" src="${ctx.resolve(p.photoId)}" alt="" draggable="false">` : '';
      const sound = p.soundId ? ` data-sound="${ctx.resolve(p.soundId)}"` : '';
      return `<div class="wb-letter"${sound}${p.burst !== false ? ' data-burst="💗"' : ''}>
        <div class="wb-letter-paper" style="background:${p.paper || '#fff7ed'}">${photo}<p>${esc(p.message)}</p><span>${esc(p.signature || '')}</span></div>
        <div class="wb-letter-front" style="background:${p.envelope || 'linear-gradient(160deg,#be123c,#881337)'}">${esc(p.cover || 'Toca para abrir')}</div></div>`;
    }

    case 'timeline': {
      // Formato por evento: fecha | título | texto | fotoId (opcional)
      const items = String(p.items || '').split(';').map((row) => row.trim()).filter(Boolean);
      const lis = items.map((row, i) => {
        const [date = '', title = '', body = '', photoId = ''] = row.split('|').map((s2) => s2.trim());
        const photo = photoId && ctx.resolve(photoId)
          ? `<img class="wb-tl-photo" src="${ctx.resolve(photoId)}" alt="" draggable="false">` : '';
        return `<li style="--i:${i}">${photo}<b>${esc(date)}</b><strong>${esc(title)}</strong><p>${esc(body)}</p></li>`;
      }).join('');
      return `<ul class="wb-timeline${ctx.editor ? ' wb-play' : ''}">${lis}</ul>`;
    }

    case 'hiddenMessage':
      return `<div class="wb-hiddenmsg">
        <div class="wb-hm-secret">${esc(p.message)}</div>
        <div class="wb-hm-cover">${esc(p.cover || 'Toca para revelar')}</div></div>`;

    case 'heartButton':
      return `<button type="button" class="wb-heartbtn" data-emoji="${esc(p.emoji || '❤️')}">${esc(p.text || '')}</button>`;

    case 'typewriter':
      // En el editor se ve el texto completo (estático); la vista previa
      // y el export lo animan mediante wbEffects.
      return ctx.editor
        ? `<span class="wb-typewriter-static wb-text" data-text="${esc(p.text)}" data-tspeed="${p.speed || 90}" data-tloop="${!!p.loop}">${esc(p.text)}</span>`
        : `<span class="wb-typewriter" data-text="${esc(p.text)}" data-tspeed="${p.speed || 90}" data-tloop="${!!p.loop}"></span>`;

    case 'countdown': {
      // Valores iniciales reales también en el editor (el runtime los actualiza)
      const date = new Date(`${p.date || ''}T00:00:00`);
      let diff = Number.isNaN(+date) ? 0 : (p.mode === 'hasta' ? +date - Date.now() : Date.now() - +date);
      if (diff < 0) diff = 0;
      const vals = {
        d: Math.floor(diff / 86400000), h: Math.floor(diff / 3600000) % 24,
        m: Math.floor(diff / 60000) % 60, s: Math.floor(diff / 1000) % 60,
      };
      const tiles = [['d', 'días'], ['h', 'horas'], ['m', 'min'], ['s', 'seg']].map(([u, label]) =>
        `<div class="wb-count-tile"><b data-u="${u}">${vals[u]}</b><small>${label}</small></div>`).join('');
      return `<div class="wb-count" data-date="${esc(p.date || '')}" data-cmode="${p.mode || 'desde'}">
        <div class="wb-count-label">${esc(p.label || '')}</div>${tiles}</div>`;
    }

    case 'polaroid': {
      const src = p.assetId ? ctx.resolve(p.assetId) : '';
      const img = src
        ? `<img src="${src}" alt="${esc(p.caption || '')}" draggable="false">`
        : `<div class="wb-placeholder"><small>Pulsa y elige esa foto especial</small></div>`;
      return `<figure class="wb-polaroid" style="--prot:${p.rotate ?? -3}deg">${img}<figcaption>${esc(p.caption || '')}</figcaption></figure>`;
    }

    case 'floatingEmojis':
      return `<div class="wb-floaties" data-emojis="${esc(p.emojis || '💖')}" data-fcount="${p.count ?? 12}" data-fspeed="${p.speed ?? 1}"></div>`;

    case 'customHTML': {
      // En el editor el JS se marca como inerte (lo ejecuta la vista previa);
      // en el export es un <script> normal que corre nativamente.
      const code = String(p.js || '').replaceAll('</script', '<\\/script');
      const js = ctx.editor ? `<script type="text/wb-js">${code}</script>` : `<script>${code}</script>`;
      return `<div class="wb-custom"><style>${p.css || ''}</style>${p.html || ''}${js}</div>`;
    }

    case 'particles':
      return `<canvas class="wb-particles" data-count="${p.count ?? 400}" data-color="${p.color || '#818cf8'}"
        data-speed="${p.speed ?? 1}" data-size="${p.size ?? 2}" data-mode="${p.mode || 'nebulosa'}"
        data-opacity="${p.opacity ?? 1}" data-shape="${p.shape || 'auto'}" data-glow="${p.glow !== false}"></canvas>`;

    default:
      return `<div class="wb-placeholder">${esc(node.type)}</div>`;
  }
}

/* ── Render del EDITOR ───────────────────────────────── */

/**
 * Escalado proporcional del HTML importado: el iframe se renderiza al
 * ancho de diseño y se escala al contenedor. Redimensionar el nodo
 * re-escala el contenido EN TIEMPO REAL sin deformarlo.
 */
export function scaleEmbed(elem, node, frame) {
  const iframe = elem.querySelector('.wb-embed iframe');
  if (!iframe) return;
  const viewWidth = node.props?.viewWidth || 1280;
  const scale = Math.max(frame.w, 16) / viewWidth;
  Object.assign(iframe.style, {
    position: 'absolute', left: '0', top: '0', border: '0',
    width: `${viewWidth}px`,
    height: `${Math.round(frame.h / scale)}px`,
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
  });
}

/** Aplica marco + estilos visuales al elemento del editor. */
export function syncNodeEl(elem, node, store) {
  const frame = store.frame(node);
  // Huella visual: si NADA cambió en este nodo, ni una sola escritura al
  // DOM. Sin esto, cada commit reescribía y re-parseaba los estilos de
  // TODOS los nodos de la página (un impuesto fijo que crecía con
  // fondos largos tipo data-URI y con el tamaño del proyecto).
  const fp = JSON.stringify([frame, node.styles, node.hidden, node.locked, node.props?.viewWidth]);
  if (elem.__wbFp === fp) return;
  elem.__wbFp = fp;

  Object.assign(elem.style, frameCSS(frame));
  if (node.type === 'htmlEmbed') scaleEmbed(elem, node, frame);
  // Limpia estilos visuales previos y aplica los actuales
  for (const prop of ['background', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign',
    'letterSpacing', 'lineHeight', 'borderRadius', 'border', 'boxShadow', 'backdropFilter', 'clipPath', 'visibility']) {
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
  elem.className = `wb-node el-${node.id}`;
  elem.dataset.id = node.id;
  elem.dataset.type = node.type;
  // Metadatos que consumen los runtimes compartidos (vista previa = export)
  if (node.effects?.tilt) elem.dataset.tilt = '1';
  if (node.effects?.parallax) elem.dataset.parallax = String(node.effects.parallax);
  if (node.effects?.press && node.effects.press !== 'ninguno') elem.dataset.press = node.effects.press;
  if (node.effects?.hoverFx && node.effects.hoverFx !== 'ninguno') elem.dataset.hover = node.effects.hoverFx;
  if (node.events?.length) elem.dataset.events = JSON.stringify(node.events);
  elem.innerHTML = contentHTML(node, ctx);
  syncNodeEl(elem, node, store);
  return elem;
}

/**
 * Firma de CONTENIDO de un nodo: si no cambia, el DOM interno se
 * conserva tal cual (posición/estilos se sincronizan aparte, baratos).
 */
function contentSignature(node) {
  return JSON.stringify([node.type, node.props, node.events, node.effects, node.hidden, node.locked]);
}

/**
 * RENDER INCREMENTAL de la página activa.
 *
 * Antes: cada cambio reconstruía TODO el DOM, recreaba todos los
 * contextos WebGL y recargaba todos los iframes → tirones y consumo
 * brutal con proyectos grandes o HTML importado.
 *
 * Ahora: se comparan firmas por nodo y solo se reconstruye lo que
 * cambió de verdad; mover/estilizar solo toca left/top/transform.
 * Los embeds (WebGL/3D/iframes) sobreviven intactos entre ediciones.
 */
export function renderPage(artboard, store, assets, { mountEl, unmountEl } = {}) {
  const page = store.page;
  const ctx = {
    editor: true,
    resolve: (id) => assets.url(id),
    htmlText: (id) => assets.text(id),
    pages: store.project.pages,
    pageHref: () => '#',
  };
  artboard.style.background = page.background || '#0b1020';
  artboard.style.width = `${store.project.settings.breakpoints[store.device]}px`;
  artboard.style.height = `${page.height}px`;

  const wanted = store.pageNodes();
  const wantedIds = new Set(wanted.map((n) => n.id));
  const existing = new Map();
  for (const child of [...artboard.children]) {
    if (!child.classList.contains('wb-node')) continue;
    if (wantedIds.has(child.dataset.id)) existing.set(child.dataset.id, child);
    else { unmountEl?.(child); child.remove(); } // nodo eliminado
  }

  let prev = null;
  for (const node of wanted) {
    let elem = existing.get(node.id);
    const sig = contentSignature(node);
    if (!elem) {
      elem = buildNodeEl(node, store, ctx);
      elem.dataset.sig = sig;
      artboard.insertBefore(elem, prev ? prev.nextSibling : artboard.firstChild);
      mountEl?.(elem);
    } else {
      if (elem.dataset.sig !== sig) {
        // Contenido cambiado → reconstrucción SOLO de este nodo
        unmountEl?.(elem);
        const fresh = buildNodeEl(node, store, ctx);
        fresh.dataset.sig = sig;
        elem.replaceWith(fresh);
        elem = fresh;
        mountEl?.(elem);
      } else {
        syncNodeEl(elem, node, store); // solo marco + estilos visuales
      }
      // Mantiene el z-order sin reconstruir
      const expectedPrev = prev;
      if ((expectedPrev && elem.previousElementSibling !== expectedPrev) || (!expectedPrev && artboard.firstElementChild !== elem)) {
        artboard.insertBefore(elem, expectedPrev ? expectedPrev.nextSibling : artboard.firstChild);
      }
    }
    prev = elem;
  }
}
