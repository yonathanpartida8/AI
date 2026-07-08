/* ============================================================
 * runtime/actionsRuntime.js — Sistema de LÓGICA VISUAL
 *
 * AUTOCONTENIDA (sin imports): se inyecta con .toString() en el
 * export. CUALQUIER elemento (imagen, texto, fondo, vídeo, 3D…)
 * puede tener eventos con CADENAS de acciones y retardos:
 *
 *   data-events='[{"on":"click","actions":[
 *     {"action":"showNode","target":"nd_x","delay":0},
 *     {"action":"playSound","target":"as_y","delay":200},
 *     {"action":"changeBackground","value":"linear-gradient(...)","delay":400},
 *     {"action":"burstHearts","value":"💖","delay":0}
 *   ]}]'
 *
 * Disparadores: click/tap · hold (mantener) · hover · swipe ·
 *               appear (al aparecer en pantalla) · doubletap
 * Acciones: goToPage · openUrl · showNode/hideNode/toggleNode ·
 *   playAnimation · playSound · stopSounds · setText · setStyle ·
 *   changeBackground · burstHearts · vibrate · runJS
 *
 * ctx = { goToPage(id), sounds{id→url}, stage(), playAnim(id,el),
 *         editor }
 * ============================================================ */

export function wbActions(root, ctx) {
  ctx = ctx || {};
  var sounds = ctx.sounds || (typeof window !== 'undefined' && window.WB_SOUNDS) || {};
  var playing = [];
  var listeners = [], observers = [], timers = [];
  function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); listeners.push([el, ev, fn, o]); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function find(id) { return root.querySelector('.el-' + id) || root.querySelector('[data-id="' + id + '"]'); }

  function replayCSS(el) { el.classList.remove('wb-play'); void el.offsetWidth; el.classList.add('wb-play'); }

  function run(a, sourceEl) {
    var target = a.target ? find(a.target) : sourceEl;
    switch (a.action) {
      case 'goToPage':
        if (ctx.goToPage) ctx.goToPage(a.target);
        break;
      case 'openUrl':
        if (a.value || a.target) window.open(a.value || a.target, '_blank', 'noopener');
        break;
      case 'showNode': if (target) { target.classList.remove('wb-hidden'); target.style.visibility = ''; } break;
      case 'hideNode': if (target) target.classList.add('wb-hidden'); break;
      case 'toggleNode': if (target) target.classList.toggle('wb-hidden'); break;
      case 'playAnimation':
        if (ctx.playAnim) ctx.playAnim(a.target, target);
        else if (target) replayCSS(target);
        break;
      case 'playSound':
        if (a.target && sounds[a.target]) {
          var audio = new Audio(sounds[a.target]);
          playing.push(audio);
          audio.play().catch(function () {});
        }
        break;
      case 'stopSounds':
        playing.forEach(function (s) { s.pause(); });
        playing = [];
        root.querySelectorAll('audio').forEach(function (au) { au.pause(); });
        break;
      case 'setText':
        if (target) {
          var t = target.querySelector('.wb-text, .wb-btn') || target;
          t.textContent = a.value || '';
        }
        break;
      case 'setStyle':
        if (target && a.value) target.style.cssText += ';' + a.value;
        break;
      case 'changeBackground': {
        var stage = ctx.stage ? ctx.stage() : (root.querySelector('.wb-stage') || root.getElementById && root.getElementById('artboard'));
        if (stage && a.value) stage.style.background = a.value;
        break;
      }
      case 'burstHearts':
        if (root.wbBurst) root.wbBurst(target || sourceEl, a.value || '❤️');
        break;
      case 'vibrate':
        if (navigator.vibrate) navigator.vibrate(+a.value || 40);
        break;
      case 'runJS':
        try { new Function('el', a.value || '')(sourceEl); }
        catch (e) { console.warn('runJS:', e); }
        break;
    }
  }

  function runChain(ev, el) {
    var actions = ev.actions || (ev.action ? [ev] : []); // compatible con formato antiguo
    actions.forEach(function (a) {
      if (a.delay) later(function () { run(a, el); }, a.delay);
      else run(a, el);
    });
  }

  Array.prototype.slice.call(root.querySelectorAll('[data-events]')).forEach(function (el) {
    var events;
    try { events = JSON.parse(el.getAttribute('data-events')); } catch (e) { return; }
    if (!events || !events.length) return;
    el.style.cursor = 'pointer';
    el.style.pointerEvents = 'auto';

    events.forEach(function (ev) {
      var trigger = ev.on || 'click';
      if (trigger === 'click' || trigger === 'tap') {
        on(el, 'click', function () { runChain(ev, el); });
      } else if (trigger === 'doubletap') {
        on(el, 'dblclick', function () { runChain(ev, el); });
      } else if (trigger === 'hover') {
        on(el, 'mouseenter', function () { runChain(ev, el); });
      } else if (trigger === 'hold') {
        var holdTimer = null;
        on(el, 'pointerdown', function () {
          holdTimer = setTimeout(function () { runChain(ev, el); if (navigator.vibrate) navigator.vibrate(25); }, 550);
          timers.push(holdTimer);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (e2) {
          on(el, e2, function () { clearTimeout(holdTimer); });
        });
      } else if (trigger === 'swipe') {
        var sx = 0, sy = 0;
        on(el, 'pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
        on(el, 'pointerup', function (e) {
          if (Math.abs(e.clientX - sx) > 48 && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy)) runChain(ev, el);
        });
      } else if (trigger === 'appear' || trigger === 'scroll') {
        if (ctx.editor) { runChain(ev, el); return; }
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { runChain(ev, el); io.disconnect(); }
        }, { threshold: 0.3 });
        io.observe(el);
        observers.push(io);
      }
    });
  });

  return function dispose() {
    playing.forEach(function (s) { s.pause(); });
    timers.forEach(clearTimeout);
    observers.forEach(function (o) { o.disconnect(); });
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
  };
}
