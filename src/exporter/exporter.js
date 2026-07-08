/* ============================================================
 * exporter/exporter.js — Exportador profesional
 *
 * Compila el JSON del proyecto a un sitio web ESTÁTICO y REAL:
 *
 *   MiProyecto/
 *   ├── index.html            (primera página)
 *   ├── paginas/*.html        (resto de páginas)
 *   ├── css/style.css         (posiciones + estilos + @keyframes)
 *   ├── js/app.js             (runtime: escala responsive, eventos)
 *   ├── js/animations.js      (triggers scroll/click/hover, sliders)
 *   ├── js/webgl.js           (partículas WebGL2 + visor Three.js)
 *   ├── assets/{images,gifs,videos,audio,models,fonts}/
 *   └── project.json          (re-importable en el editor)
 *
 * Claves de diseño:
 *  - El MISMO contentHTML() del renderer genera el markup → el
 *    export es idéntico a lo que se ve en el editor.
 *  - Animaciones de carga = CSS puro (@keyframes); los triggers
 *    scroll/click/hover añaden una clase — cero framework.
 *  - Responsive: media queries generadas por breakpoint + escala
 *    proporcional del stage para cualquier viewport intermedio.
 *  - Empaquetado con Blob API + escritor ZIP propio (interfaz
 *    compatible con JSZip: .file(ruta, datos)).
 * ============================================================ */

import { ZipWriter } from '../utils/zip.js';
import { download, slugify, dataURLToBytes, esc } from '../utils/helpers.js';
import { contentHTML, styleCSS } from '../renderer/renderer.js';
import { PRESETS, presetToKeyframesCSS } from '../animations/engine.js';
import { ASSET_KINDS } from '../assets/assetManager.js';

const BP = { tablet: 860, mobile: 520 }; // media queries max-width

export class Exporter {
  constructor(store, assets) {
    this.store = store;
    this.assets = assets;
  }

  async export() {
    const project = this.store.project;
    const zip = new ZipWriter();

    /* 1. Recolecta assets usados y asigna nombres de archivo */
    const usedIds = new Set();
    for (const node of Object.values(project.nodes)) {
      if (node.props?.assetId) usedIds.add(node.props.assetId);
      for (const id of node.props?.assetIds || []) usedIds.add(id);
      for (const event of node.events || []) if (event.action === 'playSound' && event.target) usedIds.add(event.target);
    }
    const assetPath = new Map(); // id → assets/carpeta/archivo.ext
    for (const id of usedIds) {
      const asset = this.assets.get(id);
      if (!asset) continue;
      const dot = asset.name.lastIndexOf('.');
      const ext = dot > 0 ? asset.name.slice(dot + 1).toLowerCase() : 'bin';
      const base = slugify(dot > 0 ? asset.name.slice(0, dot) : asset.name);
      const path = `assets/${ASSET_KINDS[asset.kind].folder}/${base}-${id.slice(-4)}.${ext}`;
      assetPath.set(id, path);
      zip.file(path, dataURLToBytes(asset.data));
    }

    /* 2. Slugs de página (la primera siempre es index) */
    const slugs = new Map();
    project.pages.forEach((page, i) => {
      let slug = i === 0 ? 'index' : slugify(page.slug || page.name);
      while ([...slugs.values()].includes(slug)) slug += '-2';
      slugs.set(page.id, slug);
    });

    const has3D = Object.values(project.nodes).some((n) => ['model3d', 'particles'].includes(n.type));

    /* 3. Genera archivos */
    zip.file('css/style.css', this.#buildCSS(project));
    zip.file('js/app.js', buildAppJS());
    zip.file('js/animations.js', buildAnimationsJS());
    if (has3D) zip.file('js/webgl.js', buildWebglJS());

    for (const page of project.pages) {
      const slug = slugs.get(page.id);
      const isIndex = slug === 'index';
      const html = this.#buildPageHTML(page, { project, slugs, assetPath, depth: isIndex ? 0 : 1, has3D });
      zip.file(isIndex ? 'index.html' : `paginas/${slug}.html`, html);
    }

    zip.file('project.json', JSON.stringify(project, null, 2));
    zip.file('LEEME.txt',
      `Sitio generado con No-Code Website Builder\n` +
      `Proyecto: ${project.meta.name}\n\n` +
      `Abre index.html en un navegador o sube la carpeta completa a cualquier hosting estático\n` +
      `(Netlify, Vercel, GitHub Pages…). project.json puede re-importarse en el editor.\n`);

    download(`${slugify(project.meta.name)}.zip`, zip.toBlob());
  }

  /* ── HTML de página ────────────────────────────────── */

  #buildPageHTML(page, ctx) {
    const { project, slugs, assetPath, depth, has3D } = ctx;
    const prefix = depth ? '../' : '';
    const pageHref = (target) => {
      const slug = slugs.get(target.id);
      if (slug === 'index') return `${prefix}index.html`;
      return depth ? `${slug}.html` : `paginas/${slug}.html`;
    };
    const renderCtx = { editor: false, resolve: (id) => prefix + (assetPath.get(id) || ''), pages: project.pages, pageHref };

    const nodesHTML = page.nodes
      .map((id) => project.nodes[id])
      .filter((node) => node && !node.hidden)
      .map((node) => {
        const anim = node.animation;
        const hasAnim = anim && anim.preset !== 'ninguna' && PRESETS[anim.preset];
        const attrs = [
          `class="wb-node el-${node.id}${hasAnim && anim.trigger === 'load' ? ' wb-play' : ''}"`,
          hasAnim ? `data-trigger="${anim.trigger}"` : '',
          node.events?.length ? `data-events='${JSON.stringify(node.events).replaceAll("'", '&#39;')}'` : '',
        ].filter(Boolean).join(' ');
        return `      <div ${attrs}>${contentHTML(node, renderCtx)}</div>`;
      }).join('\n');

    const soundPaths = {};
    for (const node of page.nodes.map((id) => project.nodes[id])) {
      for (const event of node?.events || []) {
        if (event.action === 'playSound' && event.target) soundPaths[event.target] = prefix + (assetPath.get(event.target) || '');
      }
    }

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.name)} — ${esc(project.meta.name)}</title>
  <link rel="stylesheet" href="${prefix}css/style.css">
  <link rel="icon" href="data:,">
</head>
<body>
  <div class="wb-scale-wrap">
    <main class="wb-stage wb-enter-${page.transition || 'fade'}" id="stage" data-page="${slugs.get(page.id)}"
      style="background:${page.background || '#0b1020'}">
${nodesHTML}
    </main>
  </div>
  <script>window.WB_SOUNDS=${JSON.stringify(soundPaths)};</script>
  <script src="${prefix}js/app.js"></script>
  <script src="${prefix}js/animations.js"></script>
${has3D ? `  <script src="${prefix}js/webgl.js"></script>` : ''}
</body>
</html>`;
  }

  /* ── CSS del sitio ─────────────────────────────────── */

  #buildCSS(project) {
    const bps = project.settings.breakpoints;
    const usedPresets = new Set();
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
      if (anim && anim.preset !== 'ninguna' && PRESETS[anim.preset]) {
        usedPresets.add(anim.preset);
        const iter = anim.loop ? 'infinite' : '1';
        const selector = anim.trigger === 'hover' ? `.el-${node.id}:hover` : `.el-${node.id}.wb-play`;
        rules.push(`${selector}{animation:wb-${anim.preset} ${anim.duration || 800}ms ${anim.easing || 'ease-out'} ${anim.delay || 0}ms ${iter} both}`);
        // Estado inicial de entradas: primer keyframe hasta que se dispare
        const first = PRESETS[anim.preset][0];
        if (['scroll', 'click'].includes(anim.trigger) && first.opacity === 0) {
          rules.push(`.el-${node.id}:not(.wb-play){opacity:0}`);
        }
      }
    }

    // Ancho de diseño base + altura por página (hoja de estilos compartida)
    const pageHeights = [`.wb-stage{width:${bps.desktop}px}`];
    const perPage = project.pages.map((page, i) => {
      const slug = i === 0 ? 'index' : slugify(page.slug || page.name);
      return `.wb-stage[data-page="${slug}"]{height:${page.height}px}`;
    });

    const keyframes = [...usedPresets].map(presetToKeyframesCSS).join('\n');
    const transitions = `
@keyframes wb-page-fade{from{opacity:0}to{opacity:1}}
@keyframes wb-page-slide{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@keyframes wb-page-zoom{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
@keyframes wb-page-blur{from{opacity:0;filter:blur(14px)}to{opacity:1;filter:blur(0)}}
.wb-enter-fade{animation:wb-page-fade .5s ease-out both}
.wb-enter-slide{animation:wb-page-slide .5s ease-out both}
.wb-enter-zoom{animation:wb-page-zoom .5s ease-out both}
.wb-enter-blur{animation:wb-page-blur .6s ease-out both}`;

    return `/* Generado por No-Code Website Builder */
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#000}
.wb-scale-wrap{width:100%;overflow:hidden}
.wb-stage{position:relative;margin:0 auto;overflow:hidden;transform-origin:top left;font-family:system-ui,sans-serif}
.wb-node{position:absolute;display:block}
.wb-node .wb-text{width:100%;height:100%;font:inherit;color:inherit;text-align:inherit}
.wb-btn{width:100%;height:100%;font:inherit;color:inherit;background:none;border:none;cursor:pointer;border-radius:inherit;background:inherit;text-align:inherit}
.wb-icon{display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:inherit}
.wb-hidden{visibility:hidden!important}
.wb-slider{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit}
.wb-slide{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s,transform .6s}
.wb-slide.active{opacity:1}
.wb-slider[data-transition="slide"] .wb-slide{transform:translateX(100%)}
.wb-slider[data-transition="slide"] .wb-slide.active{transform:translateX(0)}
.wb-form{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;padding:20px;border-radius:inherit;background:inherit;color:inherit;font-family:inherit}
.wb-form input,.wb-form textarea{padding:10px;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(148,163,184,.1);color:inherit;font:inherit}
.wb-form button{padding:12px;border:none;border-radius:8px;background:#6366f1;color:#fff;font-weight:700;cursor:pointer}
.wb-menu{display:flex;width:100%;height:100%;align-items:center;justify-content:space-between;padding:0 28px;border-radius:inherit;background:inherit}
.wb-menu-links{display:flex;gap:22px}
.wb-menu a{color:inherit;text-decoration:none;opacity:.85}
.wb-menu a:hover{opacity:1;text-decoration:underline}
.wb-player{display:flex;gap:14px;align-items:center;width:100%;height:100%;padding:14px;border-radius:inherit;background:inherit;color:inherit}
.wb-player-disc{display:flex;width:56px;height:56px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15);font-size:24px;animation:wb-spin 6s linear infinite}
@keyframes wb-spin{to{transform:rotate(360deg)}}
.wb-player-info{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.wb-player-info span{opacity:.75;font-size:13px}
.wb-3d,.wb-particles{width:100%;height:100%;border-radius:inherit;display:block}
.wb-gallery img{border-radius:6px}

${pageHeights.join('\n')}
${perPage.join('\n')}

/* ── Nodos ── */
${rules.join('\n')}

/* ── Breakpoint tablet (${bps.tablet}px de diseño) ── */
@media (max-width:${BP.tablet}px){
.wb-stage{width:${bps.tablet}px}
${tabletRules.join('\n')}
}

/* ── Breakpoint móvil (${bps.mobile}px de diseño) ── */
@media (max-width:${BP.mobile}px){
.wb-stage{width:${bps.mobile}px}
${mobileRules.join('\n')}
}

/* ── Animaciones ── */
${keyframes}
${transitions}

@media (prefers-reduced-motion:reduce){
  .wb-node,.wb-stage{animation:none!important}
}`;
  }
}

/* ════════════════════════════════════════════════════════
 * Runtimes generados (se escriben tal cual dentro del ZIP)
 * ════════════════════════════════════════════════════════ */

function buildAppJS() {
  return `/* Runtime base — generado por No-Code Website Builder */
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var wrap = document.querySelector('.wb-scale-wrap');

  /* Escala proporcional: el diseño mantiene sus coordenadas y se
     ajusta a CUALQUIER viewport sin reflow (transform GPU).
     Las media queries cambian el ancho de diseño (desktop/tablet/
     móvil) y esta función cubre los tamaños intermedios. */
  function fit() {
    stage.style.transform = 'none';
    var designW = stage.offsetWidth; // ancho de diseño según media query activa
    var scale = Math.min(1, window.innerWidth / designW);
    if (scale < 1) stage.style.transform = 'scale(' + scale + ')';
    wrap.style.height = (stage.offsetHeight * scale) + 'px';
  }
  var rafFit;
  window.addEventListener('resize', function () { cancelAnimationFrame(rafFit); rafFit = requestAnimationFrame(fit); });
  fit(); setTimeout(fit, 50);

  /* Eventos declarativos data-events */
  function runAction(ev) {
    if (ev.action === 'goToPage') {
      var link = document.querySelector('.wb-menu a[data-page="' + ev.target + '"]');
      if (link) location.href = link.getAttribute('href');
    } else if (ev.action === 'openUrl' && ev.target) {
      window.open(ev.target, '_blank', 'noopener');
    } else if (ev.action === 'toggleNode' && ev.target) {
      var node = document.querySelector('.el-' + ev.target);
      if (node) node.classList.toggle('wb-hidden');
    } else if (ev.action === 'playAnimation' && ev.target) {
      var target = document.querySelector('.el-' + ev.target);
      if (target) { target.classList.remove('wb-play'); void target.offsetWidth; target.classList.add('wb-play'); }
    } else if (ev.action === 'playSound' && ev.target && window.WB_SOUNDS[ev.target]) {
      new Audio(window.WB_SOUNDS[ev.target]).play().catch(function(){});
    }
  }
  document.querySelectorAll('[data-events]').forEach(function (elem) {
    var events;
    try { events = JSON.parse(elem.getAttribute('data-events')); } catch (e) { return; }
    events.forEach(function (ev) {
      elem.addEventListener(ev.on === 'hover' ? 'mouseenter' : 'click', function () { runAction(ev); });
    });
    elem.style.cursor = 'pointer';
  });

  /* Vídeos que se reproducen al entrar en pantalla */
  var vids = document.querySelectorAll('video[data-scrollplay]');
  if (vids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.play().catch(function(){});
        else entry.target.pause();
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { vio.observe(v); });
  }

  /* GIFs pausados: se congelan pintando el primer frame en un canvas */
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
})();
`;
}

function buildAnimationsJS() {
  return `/* Triggers de animación + sliders — generado por No-Code Website Builder */
(function () {
  'use strict';

  /* Scroll: IntersectionObserver dispara la animación CSS una vez */
  var scrollNodes = document.querySelectorAll('[data-trigger="scroll"]');
  if (scrollNodes.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('wb-play'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.25 });
    scrollNodes.forEach(function (node) { io.observe(node); });
  }

  /* Click: reinicia y ejecuta la animación en cada clic */
  document.querySelectorAll('[data-trigger="click"]').forEach(function (node) {
    node.addEventListener('click', function () {
      node.classList.remove('wb-play'); void node.offsetWidth; node.classList.add('wb-play');
    });
  });

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
})();
`;
}

function buildWebglJS() {
  return `/* Motor WebGL — generado por No-Code Website Builder
 * Partículas: WebGL2 nativo. Modelos: Three.js (CDN, carga perezosa). */

/* ── Partículas WebGL2 ── */
function mountParticles(canvas) {
  var opts = canvas.dataset;
  var count = Math.min(+opts.count || 400, 8000);
  var speed = +opts.speed || 1, mode = opts.mode || 'nebulosa';
  var gl = canvas.getContext('webgl2', { alpha: true });
  if (!gl) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER,
    '#version 300 es\\nin vec2 aPos;in float aLife;uniform float uSize;uniform vec2 uRes;out float vLife;' +
    'void main(){vec2 c=(aPos/uRes)*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.,1.);gl_PointSize=uSize*(0.5+aLife);vLife=aLife;}'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER,
    '#version 300 es\\nprecision mediump float;uniform vec3 uColor;in float vLife;out vec4 o;' +
    'void main(){float d=length(gl_PointCoord-vec2(.5));float a=smoothstep(.5,0.,d)*(.35+vLife*.65);o=vec4(uColor*(.6+vLife*.6),a);}'));
  gl.linkProgram(pr); gl.useProgram(pr);
  var hex = parseInt((opts.color || '#818cf8').slice(1), 16);
  gl.uniform3f(gl.getUniformLocation(pr, 'uColor'), ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  gl.uniform1f(gl.getUniformLocation(pr, 'uSize'), (+opts.size || 2) * dpr * 2);
  var uRes = gl.getUniformLocation(pr, 'uRes');
  var pos = new Float32Array(count * 2), vel = new Float32Array(count * 2), life = new Float32Array(count), orb = new Float32Array(count * 2);
  var W = canvas.width, H = canvas.height;
  for (var i = 0; i < count; i++) {
    pos[i * 2] = Math.random() * W; pos[i * 2 + 1] = Math.random() * H;
    vel[i * 2] = (Math.random() - .5) * .6; vel[i * 2 + 1] = (Math.random() - .5) * .6;
    life[i] = Math.random(); orb[i * 2] = 40 + Math.random() * Math.min(W, H) / 2; orb[i * 2 + 1] = Math.random() * 6.283;
  }
  var pb = gl.createBuffer(), lb = gl.createBuffer();
  var aPos = gl.getAttribLocation(pr, 'aPos'), aLife = gl.getAttribLocation(pr, 'aLife');
  gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aLife);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  var visible = true, t = 0;
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(canvas);
  (function step() {
    requestAnimationFrame(step);
    if (!visible) return;
    t += .016 * speed;
    var cx = W / 2, cy = H / 2;
    for (var i = 0; i < count; i++) {
      if (mode === 'órbita') {
        orb[i * 2 + 1] += .004 * speed * (1 + (i % 5) * .15);
        pos[i * 2] = cx + Math.cos(orb[i * 2 + 1]) * orb[i * 2];
        pos[i * 2 + 1] = cy + Math.sin(orb[i * 2 + 1]) * orb[i * 2] * .6;
      } else if (mode === 'lluvia') {
        pos[i * 2 + 1] += (1.5 + life[i] * 2.5) * speed * dpr;
        if (pos[i * 2 + 1] > H) { pos[i * 2 + 1] = -4; pos[i * 2] = Math.random() * W; }
      } else {
        pos[i * 2] += vel[i * 2] * speed * dpr + Math.sin(t + i) * .1;
        pos[i * 2 + 1] += vel[i * 2 + 1] * speed * dpr + Math.cos(t * .7 + i) * .1;
        if (pos[i * 2] < 0) pos[i * 2] = W; else if (pos[i * 2] > W) pos[i * 2] = 0;
        if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] = H; else if (pos[i * 2 + 1] > H) pos[i * 2 + 1] = 0;
      }
      life[i] += .01; if (life[i] > 1) life[i] = 0;
    }
    gl.uniform2f(uRes, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, lb); gl.bufferData(gl.ARRAY_BUFFER, life, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aLife, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, count);
  })();
}
document.querySelectorAll('.wb-particles').forEach(mountParticles);

/* ── Modelos 3D con Three.js ── */
var holders = document.querySelectorAll('.wb-3d');
if (holders.length) {
  Promise.all([
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'),
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm'),
  ]).then(function (mods) {
    var THREE = mods[0], GLTFLoader = mods[1].GLTFLoader;
    holders.forEach(function (elem) { mountModel(elem, THREE, GLTFLoader); });
  }).catch(function (e) { console.warn('Three.js no disponible', e); });
}

function mountModel(elem, THREE, GLTFLoader) {
  var w = elem.clientWidth || 300, h = elem.clientHeight || 240;
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  elem.appendChild(renderer.domElement);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, w / h, .1, 100);
  camera.position.set(0, .6, parseFloat(elem.dataset.cameraz) || 4);
  scene.add(new THREE.AmbientLight(0xffffff, .6));
  var light = new THREE.DirectionalLight(new THREE.Color(elem.dataset.lightcolor || '#fff'), parseFloat(elem.dataset.lightintensity) || 2);
  light.position.set(3, 5, 4); scene.add(light);
  var pivot = new THREE.Group(); scene.add(pivot);
  var mixer = null, clock = new THREE.Clock();

  function addDemo() {
    pivot.add(new THREE.Mesh(new THREE.TorusKnotGeometry(.8, .28, 128, 24),
      new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: .6, roughness: .25 })));
  }
  var src = elem.dataset.model;
  if (src) {
    new GLTFLoader().load(src, function (gltf) {
      var model = gltf.scene;
      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var scale = 2 / Math.max(size.x, size.y, size.z, .001);
      model.scale.setScalar(scale);
      box.getCenter(size); model.position.sub(size.multiplyScalar(scale));
      pivot.add(model);
      if (elem.dataset.playanim !== 'false' && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(function (clip) { mixer.clipAction(clip).play(); });
      }
    }, undefined, addDemo);
  } else addDemo();

  var dragging = false, lastX = 0, lastY = 0;
  renderer.domElement.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    pivot.rotation.y += (e.clientX - lastX) * .01; pivot.rotation.x += (e.clientY - lastY) * .01;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointerup', function () { dragging = false; });

  var visible = true;
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(elem);
  var autoRotate = elem.dataset.autorotate !== 'false';
  var rotSpeed = parseFloat(elem.dataset.speed) || 1;
  (function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    var dt = clock.getDelta();
    if (autoRotate && !dragging) pivot.rotation.y += dt * .6 * rotSpeed;
    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
  })();
}
`;
}
