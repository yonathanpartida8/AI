/* ============================================================
 * runtime/effectsRuntime.js — Efectos interactivos y de texto
 *
 * AUTOCONTENIDA (sin imports): el exportador la inyecta con
 * .toString() → editor y sitio exportado se comportan idéntico.
 *
 * Gestiona: máquina de escribir · contador de amor · carta
 * interactiva · botón de corazones · mensaje oculto · línea de
 * tiempo · emojis flotantes · letras animadas (data-fx) ·
 * tilt 3D (data-tilt) · parallax (data-parallax) · música de
 * fondo · scripts de componentes personalizados.
 *
 * opts = { editor: bool, runScripts: bool }
 * Devuelve dispose() para la vista previa del editor.
 * ============================================================ */

export function wbEffects(root, opts) {
  opts = opts || {};
  var timers = [], listeners = [], observers = [], rafs = [];
  function on(el, ev, fn, capture) { el.addEventListener(ev, fn, capture); listeners.push([el, ev, fn, capture]); }
  function every(fn, ms) { var id = setInterval(fn, ms); timers.push(id); return id; }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  var qa = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

  /* ── Máquina de escribir ── */
  qa('.wb-typewriter' + (opts.editor ? ', .wb-typewriter-static' : '')).forEach(function (el) {
    el.classList.add('wb-typewriter');
    var text = el.getAttribute('data-text') || el.textContent;
    var ms = +el.getAttribute('data-tspeed') || 90;
    var loop = el.getAttribute('data-tloop') === 'true';
    var i = 0;
    el.textContent = '';
    el.classList.add('typing');
    every(function () {
      i++;
      if (i > text.length + 12) { // pausa al final
        if (loop) i = 0; else { el.classList.remove('typing'); i = text.length; }
      }
      el.textContent = text.slice(0, Math.min(i, text.length));
    }, ms);
  });

  /* ── Contador de amor (desde una fecha / hasta una fecha) ── */
  qa('.wb-count').forEach(function (el) {
    var date = new Date(el.getAttribute('data-date') + 'T00:00:00');
    if (isNaN(date)) return;
    var mode = el.getAttribute('data-cmode') || 'desde';
    var nums = el.querySelectorAll('[data-u]');
    function tick() {
      var diff = mode === 'desde' ? Date.now() - date.getTime() : date.getTime() - Date.now();
      if (diff < 0) diff = 0;
      var vals = {
        d: Math.floor(diff / 86400000),
        h: Math.floor(diff / 3600000) % 24,
        m: Math.floor(diff / 60000) % 60,
        s: Math.floor(diff / 1000) % 60,
      };
      nums.forEach(function (n) { n.textContent = vals[n.getAttribute('data-u')]; });
    }
    tick();
    every(tick, 1000);
  });

  /* ── Carta interactiva: sonido + estallido al abrir ── */
  qa('.wb-letter').forEach(function (el) {
    on(el, 'click', function () {
      var opening = !el.classList.contains('open');
      el.classList.toggle('open');
      if (navigator.vibrate) navigator.vibrate(15);
      if (opening) {
        var sound = el.getAttribute('data-sound');
        if (sound) new Audio(sound).play().catch(function () {});
        var burstEmoji = el.getAttribute('data-burst');
        if (burstEmoji && root.wbBurst) root.wbBurst(el, burstEmoji, 16);
      }
    });
  });

  /* ── Reproductor: disco y ecualizador solo cuando suena ── */
  qa('.wb-player audio').forEach(function (audio) {
    var player = audio.closest('.wb-player');
    if (!player) return;
    on(audio, 'play', function () { player.classList.add('playing'); });
    on(audio, 'pause', function () { player.classList.remove('playing'); });
    on(audio, 'ended', function () { player.classList.remove('playing'); });
  });

  /* ── Mensaje oculto ── */
  qa('.wb-hiddenmsg').forEach(function (el) {
    on(el, 'click', function () {
      el.classList.add('revealed');
      if (navigator.vibrate) navigator.vibrate(20);
    });
  });

  /* ── Botón de corazones (estallido al tocar) ── */
  function burst(el, emoji, n) {
    var rect = el.getBoundingClientRect();
    for (var i = 0; i < (n || 12); i++) {
      var s = document.createElement('span');
      s.className = 'wb-burstheart';
      s.textContent = emoji || '❤️';
      s.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.6) + 'px';
      s.style.top = (rect.top + rect.height / 2) + 'px';
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 160) + 'px');
      s.style.setProperty('--rot', ((Math.random() - 0.5) * 90) + 'deg');
      s.style.fontSize = (14 + Math.random() * 22) + 'px';
      s.style.animationDuration = (900 + Math.random() * 900) + 'ms';
      document.body.appendChild(s);
      (function (sp) { later(function () { sp.remove(); }, 2000); })(s);
    }
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  }
  root.wbBurst = burst; // expuesto para el sistema de acciones
  qa('.wb-heartbtn').forEach(function (el) {
    on(el, 'click', function () { burst(el, el.getAttribute('data-emoji') || '❤️'); });
  });

  /* ── Línea de tiempo: revela sus hitos al aparecer ── */
  qa('.wb-timeline').forEach(function (el) {
    if (opts.editor) { el.classList.add('wb-play'); return; }
    var io = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { el.classList.add('wb-play'); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    observers.push(io);
  });

  /* ── Emojis flotantes ── */
  qa('.wb-floaties').forEach(function (el) {
    var emojis = (el.getAttribute('data-emojis') || '💖').split(',').map(function (e) { return e.trim(); }).filter(Boolean);
    var n = Math.min(+el.getAttribute('data-fcount') || 12, 60);
    var spd = +el.getAttribute('data-fspeed') || 1;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.textContent = emojis[i % emojis.length];
      s.style.left = (Math.random() * 92) + '%';
      s.style.fontSize = (14 + Math.random() * 26) + 'px';
      s.style.animationDuration = ((6 + Math.random() * 8) / spd) + 's';
      s.style.animationDelay = (-Math.random() * 10) + 's';
      el.appendChild(s);
    }
  });

  /* ── Letras animadas (olas, saltos, brillo, arcoíris) ── */
  qa('[data-fx]').forEach(function (el) {
    var fx = el.getAttribute('data-fx');
    if (!fx || fx === 'ninguno' || el.getAttribute('data-fx-done')) return;
    el.setAttribute('data-fx-done', '1');
    var target = el.querySelector('.wb-text') || el;
    var text = target.textContent;
    target.textContent = '';
    var idx = 0;
    text.split('').forEach(function (ch) {
      if (ch === '\n') { target.appendChild(document.createElement('br')); return; }
      var s = document.createElement('span');
      s.className = 'wb-fx wb-fx-' + fx;
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.setProperty('--i', idx++);
      target.appendChild(s);
    });
  });

  /* ── Efectos de presión (biblioteca data-press) ── */
  qa('[data-press]').forEach(function (el) {
    var kind = el.getAttribute('data-press');
    if (!kind || kind === 'ninguno') return;
    on(el, 'pointerdown', function () {
      el.classList.add('wb-pressing');
      if (kind === 'chispas' && root.wbBurst) root.wbBurst(el, '✨', 7);
      if (navigator.vibrate) navigator.vibrate(8);
    });
    var release = function () { later(function () { el.classList.remove('wb-pressing'); }, kind === 'rebote' || kind === 'latido' || kind === 'sacudida' ? 480 : 40); };
    on(el, 'pointerup', release);
    on(el, 'pointerleave', release);
    on(el, 'pointercancel', release);
  });

  /* ── Tilt 3D: el elemento sigue el dedo/cursor con profundidad ── */
  qa('[data-tilt]').forEach(function (el) {
    var target = el.firstElementChild || el;
    target.style.transition = 'transform .18s ease-out';
    target.style.willChange = 'transform';
    function move(e) {
      var r = el.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      var y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      target.style.transform = 'perspective(700px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 12) + 'deg) scale(1.03)';
    }
    on(el, 'pointermove', move);
    on(el, 'pointerleave', function () { target.style.transform = ''; });
  });

  /* ── Parallax al hacer scroll ── */
  if (!opts.editor) {
    var pxNodes = qa('[data-parallax]').map(function (el) {
      var target = el.firstElementChild || el;
      target.style.willChange = 'transform';
      return { el: el, target: target, f: parseFloat(el.getAttribute('data-parallax')) || 0 };
    });
    if (pxNodes.length) {
      var pxRaf = 0;
      var applyPx = function () {
        pxRaf = 0;
        var vh = window.innerHeight;
        pxNodes.forEach(function (p) {
          var r = p.el.getBoundingClientRect();
          var progress = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
          p.target.style.transform = 'translateY(' + (progress * p.f * -120) + 'px)';
        });
      };
      var onScroll = function () { if (!pxRaf) pxRaf = requestAnimationFrame(applyPx); };
      on(window, 'scroll', onScroll, { passive: true });
      applyPx();
    }
  }

  /* ── Música de fondo (autoplay compatible con móvil) ── */
  qa('audio[data-bgmusic]').forEach(function (audio) {
    audio.play().catch(function () {
      // Los móviles exigen un gesto: arranca en el primer toque
      var kick = function () { audio.play().catch(function () {}); document.removeEventListener('pointerdown', kick); };
      on(document, 'pointerdown', kick);
    });
  });

  /* ── Scripts de componentes personalizados (vista previa) ── */
  if (opts.runScripts) {
    qa('.wb-custom script[type="text/wb-js"]').forEach(function (sc) {
      try { new Function(sc.textContent)(); } catch (e) { console.warn('Script personalizado:', e); }
    });
  }

  return function dispose() {
    timers.forEach(clearInterval);
    observers.forEach(function (o) { o.disconnect(); });
    rafs.forEach(cancelAnimationFrame);
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    document.querySelectorAll('.wb-burstheart').forEach(function (s) { s.remove(); });
  };
}
