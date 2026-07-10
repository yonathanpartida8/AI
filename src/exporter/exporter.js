/* ============================================================
 * exporter/exporter.js — Exportador profesional
 *
 * PRINCIPIO CLAVE: el sitio exportado ejecuta LOS MISMOS runtimes
 * que el editor (wbParticles / wbEffects / wbActions se inyectan
 * con Function.toString()) y la MISMA hoja de componentes
 * (COMPONENT_CSS). Cero divergencia: lo que ves es lo que se
 * exporta, multimedia incluida.
 *
 * Formatos:
 *  1) export()       → ZIP: páginas con TODO incrustado (CSS, JS
 *     y multimedia como dataURL → funcionan aunque se abra un
 *     HTML suelto sin extraer) + carpeta assets/ organizada con
 *     los archivos reales + project.json re-importable.
 *  2) exportSingle() → UN archivo .html: todas las páginas con
 *     navegación interna, transiciones cinematográficas y el
 *     proyecto incrustado (#wb-project) para re-importarlo.
 * ============================================================ */

import { ZipWriter } from '../utils/zip.js';
import { download, slugify, dataURLToBytes, esc } from '../utils/helpers.js';
import { contentHTML, styleCSS } from '../renderer/renderer.js';
import { PRESETS, EXIT_PRESETS, presetToKeyframesCSS, exitToKeyframesCSS } from '../animations/engine.js';
import { COMPONENT_CSS } from '../renderer/componentStyles.js';
import { ASSET_KINDS } from '../assets/assetManager.js';
import { wbParticles } from '../runtime/particlesRuntime.js';
import { wbEffects } from '../runtime/effectsRuntime.js';
import { wbActions } from '../runtime/actionsRuntime.js';

const BP = { tablet: 860, mobile: 520 };

/** Transiciones que además disparan una lluvia de partículas. */
const OVERLAY_TRANSITIONS = { corazones: 'corazones', estrellas: 'estrellas', nieve: 'nieve' };

export class Exporter {
  constructor(store, assets) {
    this.store = store;
    this.assets = assets;
  }

  /* ── Utilidades ────────────────────────────────────── */

  #usedAssetIds() {
    const used = new Set();
    for (const node of Object.values(this.store.project.nodes)) {
      if (node.props?.assetId) used.add(node.props.assetId);
      for (const id of node.props?.assetIds || []) used.add(id);
      for (const event of node.events || []) {
        for (const a of event.actions || []) if (a.action === 'playSound' && a.target) used.add(a.target);
      }
    }
    for (const asset of this.assets.list({ kind: 'font' })) used.add(asset.id);
    return used;
  }

  #slugs() {
    const slugs = new Map();
    this.store.project.pages.forEach((page, i) => {
      let slug = i === 0 ? 'index' : slugify(page.slug || page.name);
      while ([...slugs.values()].includes(slug)) slug += '-2';
      slugs.set(page.id, slug);
    });
    return slugs;
  }

  #has3D() {
    return Object.values(this.store.project.nodes).some((n) => ['model3d', 'heart3d', 'photo3d', 'custom3D', 'particles'].includes(n.type));
  }

  #soundsMap() {
    const sounds = {};
    for (const asset of this.assets.list({ kind: 'audio' })) sounds[asset.id] = asset.data;
    return sounds;
  }

  #nodesHTML(page, renderCtx) {
    const project = this.store.project;
    return page.nodes
      .map((id) => project.nodes[id])
      .filter((node) => node && !node.hidden)
      .map((node) => {
        const anim = node.animation;
        const hasAnim = anim && (anim.custom || (anim.preset !== 'ninguna' && PRESETS[anim.preset]));
        const animOut = node.animationOut;
        const hasExit = animOut && animOut.preset !== 'ninguna' && EXIT_PRESETS[animOut.preset];
        const attrs = [
          `class="wb-node el-${node.id}${hasAnim && anim.trigger === 'load' ? ' wb-play' : ''}"`,
          hasAnim ? `data-trigger="${anim.trigger}"` : '',
          hasExit ? `data-outdur="${animOut.duration || 450}"` : '',
          node.effects?.tilt ? 'data-tilt="1"' : '',
          node.effects?.parallax ? `data-parallax="${node.effects.parallax}"` : '',
          node.effects?.press && node.effects.press !== 'ninguno' ? `data-press="${node.effects.press}"` : '',
          node.effects?.hoverFx && node.effects.hoverFx !== 'ninguno' ? `data-hover="${node.effects.hoverFx}"` : '',
          node.events?.length ? `data-events='${JSON.stringify(node.events).replaceAll("'", '&#39;')}'` : '',
        ].filter(Boolean).join(' ');
        return `      <div ${attrs}>${contentHTML(node, renderCtx)}</div>`;
      }).join('\n');
  }

  /* ══ 1) EXPORT ZIP ═════════════════════════════════════ */

  async export() {
    const project = this.store.project;
    const zip = new ZipWriter();

    // Carpeta assets/ con los archivos reales, organizados por tipo
    for (const id of this.#usedAssetIds()) {
      const asset = this.assets.get(id);
      if (!asset) continue;
      const dot = asset.name.lastIndexOf('.');
      const ext = dot > 0 ? asset.name.slice(dot + 1).toLowerCase() : 'bin';
      const base = slugify(dot > 0 ? asset.name.slice(0, dot) : asset.name);
      zip.file(`assets/${ASSET_KINDS[asset.kind].folder}/${base}-${id.slice(-4)}.${ext}`, dataURLToBytes(asset.data));
    }

    const slugs = this.#slugs();
    const has3D = this.#has3D();
    const cssText = this.#buildCSS(project, (page) => slugs.get(page.id));

    // Mapa de navegación entre páginas del ZIP
    const hrefFrom = (depth, targetSlug) => {
      if (targetSlug === 'index') return depth ? '../index.html' : 'index.html';
      return depth ? `${targetSlug}.html` : `paginas/${targetSlug}.html`;
    };

    for (const page of project.pages) {
      const slug = slugs.get(page.id);
      const isIndex = slug === 'index';
      const depth = isIndex ? 0 : 1;
      const pagesMap = {};
      for (const p2 of project.pages) pagesMap[p2.id] = hrefFrom(depth, slugs.get(p2.id));
      const renderCtx = {
        editor: false,
        // Multimedia INCRUSTADA → la página funciona aunque se abra suelta
        resolve: (id) => this.assets.url(id),
        pages: project.pages,
        pageHref: (target) => hrefFrom(depth, slugs.get(target.id)),
      };
      const html = this.#pageDocument({
        title: `${page.name} — ${project.meta.name}`,
        cssText,
        body: `  <div class="wb-scale-wrap">
    <main class="wb-stage ${page.transition && page.transition !== 'ninguna' ? `wb-enter-${OVERLAY_TRANSITIONS[page.transition] ? 'fade' : page.transition}` : ''}" id="stage"
      data-page="${slug}" data-overlay="${OVERLAY_TRANSITIONS[page.transition] || ''}"
      style="background:${page.background || '#0b1020'};--tdur:${page.transitionDuration || 700}ms">
${this.#nodesHTML(page, renderCtx)}
    </main>
  </div>`,
        boot: `window.WB_SOUNDS=${JSON.stringify(this.#soundsMap())};window.WB_PAGES=${JSON.stringify(pagesMap)};window.WB_CURRENT=${JSON.stringify(page.id)};window.WB_SINGLE=false;`,
        pwa: isIndex,
        runtime: this.#buildRuntime({ single: false, has3D }),
        pageJS: `${project.custom?.js || ''}\n${page.custom?.js || ''}`,
      });
      zip.file(isIndex ? 'index.html' : `paginas/${slug}.html`, html);
    }

    /* PWA: el sitio exportado es instalable y funciona sin conexión */
    const pageFiles = project.pages.map((p, i) => i === 0 ? './index.html' : `./paginas/${slugs.get(p.id)}.html`);
    zip.file('manifest.json', JSON.stringify({
      name: project.meta.name, short_name: project.meta.name.slice(0, 12),
      display: 'standalone', start_url: './index.html',
      background_color: '#150a24', theme_color: '#150a24',
      icons: [{ src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }, null, 2));
    zip.file('icon.svg', HEART_ICON_SVG);
    zip.file('sw.js', buildServiceWorker(pageFiles));
    zip.file('project.json', JSON.stringify({ ...project, assetsData: this.assets.exportData() }));
    zip.file('LEEME.txt',
      `Sitio generado con No-Code Website Builder\nProyecto: ${project.meta.name}\n\n` +
      `- Cada página lleva TODO incrustado (estilos, scripts y multimedia):\n` +
      `  funciona aunque abras un HTML suelto, sin extraer nada.\n` +
      `- La carpeta assets/ contiene además tus archivos organizados\n` +
      `  (gifs, imágenes, vídeos, audio, modelos, fuentes) por si quieres editarlos.\n` +
      `- Sube la carpeta completa a Netlify, Vercel o GitHub Pages para publicarla.\n` +
      `- project.json se re-importa en el editor con todos los assets.\n`);

    download(`${slugify(project.meta.name)}.zip`, zip.toBlob());
  }

  /* ══ 2) EXPORT DE UN SOLO ARCHIVO ══════════════════════ */

  async exportSingle() {
    const project = this.store.project;
    const has3D = this.#has3D();
    const cssText = this.#buildCSS(project, (page) => page.id);
    const renderCtx = {
      editor: false,
      resolve: (id) => this.assets.url(id),
      pages: project.pages,
      pageHref: () => '#',
    };

    const sections = project.pages.map((page, i) => `  <div class="wb-scale-wrap"${i ? ' style="display:none"' : ''} data-wrap="${page.id}">
    <main class="wb-stage ${page.transition && page.transition !== 'ninguna' ? `wb-enter-${OVERLAY_TRANSITIONS[page.transition] ? 'fade' : page.transition}` : ''}"
      data-page="${page.id}" data-enter="${page.transition && page.transition !== 'ninguna' ? `wb-enter-${OVERLAY_TRANSITIONS[page.transition] ? 'fade' : page.transition}` : ''}"
      data-overlay="${OVERLAY_TRANSITIONS[page.transition] || ''}"
      style="background:${page.background || '#0b1020'};--tdur:${page.transitionDuration || 700}ms">
${this.#nodesHTML(page, renderCtx)}
    </main>
  </div>`).join('\n');

    // Proyecto incrustado → el HTML es re-importable y editable a mano
    const projectJSON = JSON.stringify({ ...project, assetsData: this.assets.exportData() })
      .replaceAll('</', '<\\/');

    const pagesJS = project.pages.map((p) => p.custom?.js || '').join('\n');

    const html = this.#pageDocument({
      title: project.meta.name,
      cssText,
      body: sections,
      boot: `window.WB_SOUNDS=${JSON.stringify(this.#soundsMap())};window.WB_SINGLE=true;`,
      runtime: this.#buildRuntime({ single: true, has3D }),
      pageJS: `${project.custom?.js || ''}\n${pagesJS}`,
      extraHead: `<script type="application/json" id="wb-project">${projectJSON}</script>`,
    });

    download(`${slugify(project.meta.name)}.html`, new Blob([html], { type: 'text/html' }));
  }

  /* ── Documento HTML común ──────────────────────────── */

  #pageDocument({ title, cssText, body, boot, runtime, pageJS, extraHead = '', pwa = false }) {
    const custom = (pageJS || '').trim();
    const pwaHead = pwa ? `<link rel="manifest" href="manifest.json">\n  <meta name="theme-color" content="#150a24">` : '';
    const pwaReg = pwa ? `<script>if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){navigator.serviceWorker.register('./sw.js').catch(function(){})}</script>` : '';
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="icon" href="data:,">
  ${pwaHead}
  ${extraHead}
  <style>
${cssText}
  </style>
</head>
<body>
${body}
  <script>${boot}</script>
  <script>
${runtime}
  </script>
${custom ? `  <script class="custom">\ntry{\n${custom.replaceAll('</script', '<\\/script')}\n}catch(e){console.warn('JS personalizado:',e)}\n  </script>` : ''}
  ${pwaReg}
</body>
</html>`;
  }

  /* ── CSS del sitio ─────────────────────────────────── */

  #buildCSS(project, keyFor) {
    const bps = project.settings.breakpoints;
    const usedPresets = new Set();
    const usedExits = new Set();
    const rules = [];
    const tabletRules = [];
    const mobileRules = [];

    const frameRule = (frame) =>
      `left:${frame.x}px;top:${frame.y}px;width:${frame.w}px;height:${frame.h}px;` +
      `transform:rotate(${frame.rotation || 0}deg) scale(${frame.scale ?? 1});opacity:${frame.opacity ?? 1};`;

    for (const node of Object.values(project.nodes)) {
      if (node.hidden) continue;
      const visual = Object.entries(styleCSS(node)).map(([k, v]) => `${k}:${v}`).join(';');
      rules.push(`.el-${node.id}{${frameRule(node.base)}${visual}}`);

      const tablet = node.responsive?.tablet;
      if (tablet && Object.keys(tablet).length) tabletRules.push(`.el-${node.id}{${frameRule({ ...node.base, ...tablet })}}`);
      const mobile = node.responsive?.mobile;
      if (mobile && Object.keys(mobile).length) mobileRules.push(`.el-${node.id}{${frameRule({ ...node.base, ...tablet, ...mobile })}}`);

      const anim = node.animation;
      if (anim?.custom) {
        // Animación CSS definida por el usuario (keyframes en su CSS global)
        const selector = anim.trigger === 'hover' ? `.el-${node.id}:hover` : `.el-${node.id}.wb-play`;
        rules.push(`${selector}{animation:${anim.custom}}`);
      } else if (anim && anim.preset !== 'ninguna' && PRESETS[anim.preset]) {
        usedPresets.add(anim.preset);
        const iter = anim.loop ? 'infinite' : '1';
        const selector = anim.trigger === 'hover' ? `.el-${node.id}:hover` : `.el-${node.id}.wb-play`;
        rules.push(`${selector}{animation:wb-${anim.preset} ${anim.duration || 800}ms ${anim.easing || 'ease-out'} ${anim.delay || 0}ms ${iter} both}`);
        const first = PRESETS[anim.preset][0];
        if (['scroll', 'click', 'hold'].includes(anim.trigger) && first.opacity === 0) {
          rules.push(`.el-${node.id}:not(.wb-play){opacity:0}`);
        }
      }

      const animOut = node.animationOut;
      if (animOut && animOut.preset !== 'ninguna' && EXIT_PRESETS[animOut.preset]) {
        usedExits.add(animOut.preset);
        rules.push(`.el-${node.id}.wb-out{animation:wb-out-${animOut.preset} ${animOut.duration || 450}ms ${animOut.easing || 'ease-in'} both!important}`);
      }
    }

    const perPage = project.pages.map((page) =>
      `.wb-stage[data-page="${keyFor(page)}"]{height:${page.height}px}`);

    const tabletBlock = tabletRules.length ? `
@media (max-width:${BP.tablet}px){
.wb-stage{width:${bps.tablet}px}
${tabletRules.join('\n')}
}` : '';
    const mobileBlock = mobileRules.length ? `
@media (max-width:${BP.mobile}px){
.wb-stage{width:${bps.mobile}px}
${mobileRules.join('\n')}
}` : '';

    const keyframes = [...usedPresets].map(presetToKeyframesCSS).join('\n') + '\n' +
      [...usedExits].map(exitToKeyframesCSS).join('\n');
    const fontFaces = this.assets.fontFaceCSS();
    const pagesCSS = project.pages.map((p) => p.custom?.css || '').join('\n');

    return `/* Generado por No-Code Website Builder */
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#000}
.wb-scale-wrap{width:100%;overflow:hidden}
.wb-stage{position:relative;margin:0 auto;overflow:hidden;transform-origin:top left;font-family:system-ui,sans-serif;width:${bps.desktop}px}
[data-trigger],[data-tilt],[data-parallax]{will-change:transform,opacity}
${fontFaces}
${COMPONENT_CSS}
${perPage.join('\n')}

/* ── Nodos ── */
${rules.join('\n')}
${tabletBlock}
${mobileBlock}

/* ── Animaciones ── */
${keyframes}

/* ── Código personalizado ── */
${project.custom?.css || ''}
${pagesCSS}

@media (prefers-reduced-motion:reduce){
  .wb-node,.wb-stage{animation:none!important}
}`;
  }

  /* ── Runtime del sitio (runtimes compartidos inyectados) ── */

  #buildRuntime({ single, has3D }) {
    return `/* Runtime — generado por No-Code Website Builder.
 * wbParticles / wbEffects / wbActions son EXACTAMENTE las mismas
 * funciones que ejecuta el editor (inyectadas con toString). */
'use strict';
var WB_PARTICLES = (${wbParticles.toString()});
var WB_EFFECTS = (${wbEffects.toString()});
var WB_ACTIONS = (${wbActions.toString()});

/* ── Escala proporcional a cualquier pantalla ── */
function wbActiveWrap() {
  var wraps = document.querySelectorAll('.wb-scale-wrap');
  for (var i = 0; i < wraps.length; i++) if (wraps[i].style.display !== 'none') return wraps[i];
  return wraps[0];
}
function wbFit() {
  var wrap = wbActiveWrap();
  if (!wrap) return;
  var stage = wrap.querySelector('.wb-stage');
  stage.style.transform = 'none';
  var scale = Math.min(1, window.innerWidth / stage.offsetWidth);
  if (scale < 1) stage.style.transform = 'scale(' + scale + ')';
  wrap.style.height = (stage.offsetHeight * scale) + 'px';
}
var wbFitRaf;
window.addEventListener('resize', function () { cancelAnimationFrame(wbFitRaf); wbFitRaf = requestAnimationFrame(wbFit); });

/* ── Transiciones con lluvia de partículas ── */
function wbOverlay(mode, ms) {
  var colors = { corazones: '#f472b6', estrellas: '#facc15', nieve: '#e0f2fe' };
  var canvas = document.createElement('canvas');
  canvas.className = 'wb-transition-overlay wb-particles';
  canvas.dataset.mode = mode;
  canvas.dataset.color = colors[mode] || '#f472b6';
  canvas.dataset.count = mode === 'nieve' ? 260 : 140;
  canvas.dataset.speed = 1.6;
  canvas.dataset.size = mode === 'corazones' ? 3.4 : 2.4;
  document.body.appendChild(canvas);
  var dispose = WB_PARTICLES(canvas);
  setTimeout(function () {
    canvas.style.transition = 'opacity .6s';
    canvas.style.opacity = '0';
    setTimeout(function () { dispose(); canvas.remove(); }, 650);
  }, ms || 1400);
}

/* ── Navegación entre páginas ── */
function wbGoToPage(pageId) {
  if (window.WB_SINGLE) {
    document.querySelectorAll('.wb-scale-wrap').forEach(function (wrap) {
      wrap.style.display = wrap.getAttribute('data-wrap') === pageId ? '' : 'none';
    });
    var stage = document.querySelector('.wb-stage[data-page="' + pageId + '"]');
    if (stage) {
      var cls = stage.getAttribute('data-enter');
      if (cls) { stage.classList.remove(cls); void stage.offsetWidth; stage.classList.add(cls); }
      var overlay = stage.getAttribute('data-overlay');
      if (overlay) wbOverlay(overlay, parseFloat(stage.style.getPropertyValue('--tdur')) * 2 || 1400);
    }
    window.scrollTo(0, 0);
    wbFit();
  } else if (window.WB_PAGES && window.WB_PAGES[pageId]) {
    location.href = window.WB_PAGES[pageId];
  }
}
document.querySelectorAll('.wb-menu a[data-page]').forEach(function (link) {
  if (window.WB_SINGLE) {
    link.addEventListener('click', function (e) { e.preventDefault(); wbGoToPage(link.getAttribute('data-page')); });
  }
});

/* ── Arranque ── */
document.querySelectorAll('.wb-particles:not(.wb-transition-overlay)').forEach(function (c) { WB_PARTICLES(c); });
WB_EFFECTS(document, {});
WB_ACTIONS(document, {
  goToPage: wbGoToPage,
  sounds: window.WB_SOUNDS || {},
  stage: function () { return wbActiveWrap().querySelector('.wb-stage'); },
  pageOrder: function () {
    if (window.WB_SINGLE) {
      return Array.prototype.map.call(document.querySelectorAll('.wb-scale-wrap'), function (w) { return w.getAttribute('data-wrap'); });
    }
    return Object.keys(window.WB_PAGES || {});
  },
  currentPage: function () {
    if (window.WB_SINGLE) return wbActiveWrap().getAttribute('data-wrap');
    return window.WB_CURRENT;
  },
});

/* Animaciones por scroll y clic */
(function () {
  var scrollNodes = document.querySelectorAll('[data-trigger="scroll"]');
  if (scrollNodes.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('wb-play'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.25 });
    scrollNodes.forEach(function (node) { io.observe(node); });
  }
  document.querySelectorAll('[data-trigger="click"]').forEach(function (node) {
    node.addEventListener('click', function () {
      node.classList.remove('wb-play'); void node.offsetWidth; node.classList.add('wb-play');
    });
  });
  document.querySelectorAll('[data-trigger="hold"]').forEach(function (node) {
    var holdTimer = null;
    node.addEventListener('pointerdown', function () {
      holdTimer = setTimeout(function () {
        node.classList.remove('wb-play'); void node.offsetWidth; node.classList.add('wb-play');
        if (navigator.vibrate) navigator.vibrate(25);
      }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      node.addEventListener(ev, function () { clearTimeout(holdTimer); });
    });
  });
})();

/* Sliders automáticos */
document.querySelectorAll('.wb-slider').forEach(function (slider) {
  var slides = slider.querySelectorAll('.wb-slide');
  if (slides.length < 2) return;
  var index = 0;
  setInterval(function () {
    slides[index].classList.remove('active');
    index = (index + 1) % slides.length;
    slides[index].classList.add('active');
  }, parseInt(slider.getAttribute('data-interval'), 10) || 3000);
});

/* Vídeos con reproducción al hacer scroll */
(function () {
  var vids = document.querySelectorAll('video[data-scrollplay]');
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.play().catch(function () {});
        else entry.target.pause();
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { vio.observe(v); });
  }
})();

/* GIFs pausados → primer frame congelado */
document.querySelectorAll('.wb-gif[data-playing="false"]').forEach(function (img) {
  function freeze() {
    var canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.style.cssText = img.style.cssText; canvas.className = img.className;
    img.replaceWith(canvas);
  }
  if (img.complete) freeze(); else img.addEventListener('load', freeze);
});

/* Transición de entrada con partículas de la primera página */
(function () {
  var stage = wbActiveWrap() && wbActiveWrap().querySelector('.wb-stage');
  if (stage && stage.getAttribute('data-overlay')) {
    wbOverlay(stage.getAttribute('data-overlay'), parseFloat(stage.style.getPropertyValue('--tdur')) * 2 || 1400);
  }
})();

wbFit(); setTimeout(wbFit, 60);
${has3D ? build3DJS() : ''}`;
  }
}

/* ── PWA del sitio exportado ───────────────────────────── */

export const HEART_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#ff8fab"/><stop offset="1" stop-color="#b388eb"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="#1c1024"/>
<path d="M50 78 C20 58 14 38 27 28 C36 21 46 25 50 33 C54 25 64 21 73 28 C86 38 80 58 50 78Z" fill="url(#g)"/>
</svg>`;

function buildServiceWorker(pageFiles) {
  return `/* Service worker — generado por No-Code Website Builder.
 * Cachea el sitio completo: funciona sin conexión y es instalable. */
var CACHE = 'amor-v1';
var CORE = ${JSON.stringify(['./', ...pageFiles, './manifest.json', './icon.svg'])};
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res.ok && e.request.url.indexOf(self.location.origin) === 0) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    });
  }));
});
`;
}

/* ── Motor Three.js del sitio exportado ────────────────── */

function build3DJS() {
  return `
/* ── Three.js: modelos GLB, corazón 3D y fotos con profundidad ── */
(function () {
  var holders = document.querySelectorAll('.wb-3d');
  if (!holders.length) return;
  Promise.all([
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'),
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm'),
  ]).then(function (mods) {
    var THREE = mods[0], GLTFLoader = mods[1].GLTFLoader;
    holders.forEach(function (elem) { mount(elem, THREE, GLTFLoader); });
  }).catch(function (e) { console.warn('Three.js no disponible', e); });

  function heartGeometry(THREE) {
    var shape = new THREE.Shape();
    shape.moveTo(0, 0.5);
    shape.bezierCurveTo(0, 0.9, -0.9, 0.9, -0.9, 0.3);
    shape.bezierCurveTo(-0.9, -0.3, -0.3, -0.7, 0, -1.05);
    shape.bezierCurveTo(0.3, -0.7, 0.9, -0.3, 0.9, 0.3);
    shape.bezierCurveTo(0.9, 0.9, 0, 0.9, 0, 0.5);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 5, curveSegments: 24 });
    geo.center();
    return geo;
  }

  function mount(elem, THREE, GLTFLoader) {
    var kind = elem.getAttribute('data-kind') || 'model';
    var w = elem.clientWidth || 300, h = elem.clientHeight || 240;
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.setSize(w, h);
    elem.appendChild(renderer.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.4, parseFloat(elem.getAttribute('data-cameraz')) || 4);
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    var light = new THREE.DirectionalLight(new THREE.Color(elem.getAttribute('data-lightcolor') || '#ffffff'), parseFloat(elem.getAttribute('data-lightintensity')) || 2);
    light.position.set(3, 5, 4); scene.add(light);
    var rim = new THREE.PointLight(0xf472b6, 1.4, 12);
    rim.position.set(-3, -1, 3); scene.add(rim);
    var pivot = new THREE.Group(); scene.add(pivot);
    var mixer = null, clock = new THREE.Clock();
    var interactive = kind !== 'photo';
    var userUpdate = null;

    if (kind === 'custom') {
      var codeEl = elem.querySelector('script[type="text/wb-3d"]');
      try {
        userUpdate = new Function('THREE', 'scene', 'camera', 'pivot', 'renderer', 'GLTFLoader', codeEl ? codeEl.textContent : '')(
          THREE, scene, camera, pivot, renderer, GLTFLoader);
      } catch (e) { console.warn('Código 3D personalizado:', e); }
    } else if (kind === 'heart') {
      pivot.add(new THREE.Mesh(heartGeometry(THREE), new THREE.MeshStandardMaterial({
        color: new THREE.Color(elem.getAttribute('data-color') || '#e11d48'),
        metalness: parseFloat(elem.getAttribute('data-metal')) || 0.35, roughness: 0.25,
      })));
    } else if (kind === 'photo') {
      var depth = parseFloat(elem.getAttribute('data-depth')) || 1;
      new THREE.TextureLoader().load(elem.getAttribute('data-src') || '', function (tex) {
        var ratio = tex.image ? tex.image.width / tex.image.height : 1.4;
        var geo = new THREE.PlaneGeometry(2.6, 2.6 / ratio, 24, 24);
        var pa = geo.attributes.position;
        for (var i = 0; i < pa.count; i++) {
          var px = pa.getX(i) / 1.3, py = pa.getY(i) / (1.3 / ratio);
          pa.setZ(i, -(px * px + py * py) * 0.16 * depth);
        }
        geo.computeVertexNormals();
        pivot.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })));
      });
      elem.addEventListener('pointermove', function (e) {
        var r = elem.getBoundingClientRect();
        pivot.rotation.y = ((e.clientX - r.left) / r.width - 0.5) * 0.55 * depth;
        pivot.rotation.x = ((e.clientY - r.top) / r.height - 0.5) * -0.45 * depth;
      });
      camera.position.z = 2.6;
    } else {
      var src = elem.getAttribute('data-model');
      var demo = function () {
        pivot.add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.28, 128, 24),
          new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.6, roughness: 0.25 })));
      };
      if (src) {
        new GLTFLoader().load(src, function (gltf) {
          var model = gltf.scene;
          var box = new THREE.Box3().setFromObject(model);
          var size = box.getSize(new THREE.Vector3());
          var scale = 2 / Math.max(size.x, size.y, size.z, 0.001);
          model.scale.setScalar(scale);
          box.getCenter(size); model.position.sub(size.multiplyScalar(scale));
          pivot.add(model);
          if (elem.getAttribute('data-playanim') !== 'false' && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(function (clip) { mixer.clipAction(clip).play(); });
          }
        }, undefined, demo);
      } else demo();
    }

    var dragging = false, lastX = 0, lastY = 0;
    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
      window.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        pivot.rotation.y += (e.clientX - lastX) * 0.01;
        pivot.rotation.x += (e.clientY - lastY) * 0.01;
        lastX = e.clientX; lastY = e.clientY;
      });
      window.addEventListener('pointerup', function () { dragging = false; });
    }

    var visible = true;
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(elem);
    var autoRotate = elem.getAttribute('data-autorotate') !== 'false' && kind !== 'photo';
    var rotSpeed = parseFloat(elem.getAttribute('data-speed')) || 1;
    (function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      var dt = clock.getDelta();
      if (autoRotate && !dragging && kind !== 'custom') pivot.rotation.y += dt * 0.6 * rotSpeed;
      if (kind === 'heart') pivot.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.08;
      if (typeof userUpdate === 'function') { try { userUpdate(dt); } catch (e) {} }
      if (mixer) mixer.update(dt);
      renderer.render(scene, camera);
    })();
  }
})();`;
}
