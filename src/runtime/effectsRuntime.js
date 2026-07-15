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
    var twId = every(function () {
      i++;
      if (i > text.length + 12) { // pausa al final
        if (loop) i = 0;
        else { // terminado: libera el intervalo (no gira para siempre)
          el.classList.remove('typing');
          el.textContent = text;
          clearInterval(twId);
          return;
        }
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

  /* ── Reproductor propio: play/pausa, progreso, seek, ecualizador ── */
  var PAUSE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>';
  var PLAY_SVG2 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l12-7.5L7 4.5z"/></svg>';
  function fmtTime(sec) {
    if (!isFinite(sec)) return '0:00';
    var m = Math.floor(sec / 60), s2 = Math.floor(sec % 60);
    return m + ':' + (s2 < 10 ? '0' : '') + s2;
  }
  qa('.wb-mp').forEach(function (player) {
    var audio = player.querySelector('audio');
    var playBtn = player.querySelector('.wb-mp-play');
    if (!audio || !playBtn) return;
    var fill = player.querySelector('.wb-mp-fill');
    var time = player.querySelector('.wb-mp-time');
    var track = player.querySelector('.wb-mp-track');
    var titleEl = player.querySelector('.wb-mp-title');

    /* Configuración del reproductor (volumen, loop, fades, lista) */
    var baseVol = Math.max(0, Math.min(1, (+player.getAttribute('data-volume') || 100) / 100));
    var loop = player.getAttribute('data-loop') === '1';
    var fadeInMs = +player.getAttribute('data-fadein') || 0;
    var fadeOutMs = +player.getAttribute('data-fadeout') || 0;
    var playlist = [];
    try { playlist = JSON.parse(player.getAttribute('data-playlist') || '[]'); } catch (e) { /* sin lista */ }
    var trackIdx = 0;
    audio.volume = baseVol;
    if (loop && !fadeOutMs && !playlist.length) audio.loop = true;

    /* Fundidos: rampa de volumen por rAF (suave a cualquier Hz) */
    var fadeRaf = 0;
    function fadeTo(target, ms, done) {
      cancelAnimationFrame(fadeRaf);
      if (!ms) { audio.volume = target; if (done) done(); return; }
      var from = audio.volume, t0 = performance.now();
      (function stepFade(now) {
        // OJO: el timestamp de rAF es el inicio del frame y puede ser
        // ANTERIOR a t0 (capturado a mitad de frame) → clamp inferior.
        var k = Math.max(0, Math.min(1, (now - t0) / ms));
        audio.volume = from + (target - from) * k;
        if (k < 1) fadeRaf = requestAnimationFrame(stepFade);
        else { fadeRaf = 0; if (done) done(); }
      })(performance.now());
    }

    /* Reproducción BLINDADA: precarga al intentar, errores visibles,
       desbloqueo con el primer toque si el móvil bloquea el autoplay. */
    var meta = player.querySelector('.wb-mp-meta span');
    function showError() {
      if (meta) meta.textContent = 'No se pudo cargar el audio';
      player.classList.add('wb-mp-error');
    }
    function tryPlay(viaGesture) {
      audio.preload = 'auto';
      if (fadeInMs) audio.volume = 0;
      var p = audio.play();
      if (p && p.catch) p.catch(function (err) {
        if (err && err.name === 'NotAllowedError' && !viaGesture) {
          // Autoplay bloqueado: arranca con el primer gesto del usuario
          var kick = function () { tryPlay(true); document.removeEventListener('pointerdown', kick); };
          on(document, 'pointerdown', kick);
        } else if (err && err.name !== 'AbortError') {
          // Reintento único tras recargar la fuente (redes/decoder caprichosos)
          audio.load();
          var p2 = audio.play();
          if (p2 && p2.catch) p2.catch(function () { showError(); });
        }
      });
    }
    function setTrack(i) {
      trackIdx = (i + playlist.length) % playlist.length;
      audio.src = playlist[trackIdx].url;
      if (titleEl && playlist[trackIdx].name) titleEl.textContent = playlist[trackIdx].name.replace(/\.[a-z0-9]+$/i, '');
      player.classList.remove('wb-mp-error');
      audio.load();
      tryPlay(true);
    }

    on(playBtn, 'click', function () {
      if (audio.paused) tryPlay(true);
      else if (fadeOutMs) fadeTo(0, Math.min(fadeOutMs, 600), function () { audio.pause(); });
      else audio.pause();
    });
    var prevBtn = player.querySelector('.wb-mp-prev');
    var nextBtn = player.querySelector('.wb-mp-next');
    if (prevBtn) on(prevBtn, 'click', function () { setTrack(trackIdx - 1); });
    if (nextBtn) on(nextBtn, 'click', function () { setTrack(trackIdx + 1); });

    on(audio, 'play', function () {
      player.classList.add('playing'); playBtn.innerHTML = PAUSE_SVG;
      if (fadeInMs) fadeTo(baseVol, fadeInMs);
    });
    on(audio, 'pause', function () {
      player.classList.remove('playing'); playBtn.innerHTML = PLAY_SVG2;
      cancelAnimationFrame(fadeRaf); audio.volume = baseVol;
    });
    on(audio, 'ended', function () {
      if (playlist.length > 1) { setTrack(trackIdx + 1); return; }
      if (loop && !audio.loop) { audio.currentTime = 0; tryPlay(true); return; }
      player.classList.remove('playing'); playBtn.innerHTML = PLAY_SVG2;
    });
    on(audio, 'error', showError);
    on(audio, 'timeupdate', function () {
      if (fill && audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
      if (time) time.textContent = fmtTime(audio.currentTime);
      // Fade out natural al acercarse el final de la pista
      if (fadeOutMs && audio.duration && !audio.paused) {
        var left = (audio.duration - audio.currentTime) * 1000;
        if (left <= fadeOutMs) audio.volume = baseVol * Math.max(0, left / fadeOutMs);
        else if (audio.volume < baseVol && !fadeRaf) audio.volume = baseVol;
      }
    });
    if (track) on(track, 'pointerdown', function (e) {
      var r = track.getBoundingClientRect();
      if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });

    /* Autoplay declarado en el componente */
    if (player.getAttribute('data-autoplay') === '1' && !opts.editor) tryPlay(false);
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
    if (kind === 'ondas') (el.firstElementChild || el).classList.add('wb-ripple-clip');
    on(el, 'pointerdown', function (e) {
      el.classList.add('wb-pressing');
      if (kind === 'chispas' && root.wbBurst) root.wbBurst(el, '✨', 7);
      if (kind === 'ondas') {
        // Ripple estilo material: un único span por elemento (pool) que se
        // reposiciona en cada toque — cero nodos nuevos por pulsación.
        var host = el.firstElementChild || el;
        var rip = host.__wbRipple;
        if (!rip) {
          rip = document.createElement('span');
          rip.className = 'wb-ripple';
          host.appendChild(rip);
          host.__wbRipple = rip;
        }
        var r = el.getBoundingClientRect();
        var d = Math.max(host.offsetWidth, host.offsetHeight) * 2.2;
        rip.style.width = rip.style.height = d + 'px';
        rip.style.left = ((e.clientX - r.left) * (host.offsetWidth / (r.width || 1)) - d / 2) + 'px';
        rip.style.top = ((e.clientY - r.top) * (host.offsetHeight / (r.height || 1)) - d / 2) + 'px';
        rip.classList.remove('on'); void rip.offsetWidth; rip.classList.add('on');
      }
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
    // Acotado a 1 lectura de layout por frame: pointermove puede llegar
    // a >120 Hz en móviles y cada getBoundingClientRect fuerza layout.
    var tiltPending = false, tiltEv = null;
    function move(e) {
      tiltEv = e;
      if (tiltPending) return;
      tiltPending = true;
      requestAnimationFrame(function () {
        if (!tiltPending) return; // se soltó / se desmontó antes del frame
        tiltPending = false;
        var r = el.getBoundingClientRect();
        var x = ((tiltEv.clientX - r.left) / r.width - 0.5) * 2;
        var y = ((tiltEv.clientY - r.top) / r.height - 0.5) * 2;
        target.style.transform = 'perspective(700px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 12) + 'deg) scale(1.03)';
      });
    }
    on(el, 'pointermove', move);
    on(el, 'pointerleave', function () { tiltPending = false; target.style.transform = ''; });
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

  /* ── HTML importados: montaje diferido y ESCALONADO ── */
  (function () {
    var pending = qa('.wb-embed iframe[data-doc]');
    if (!pending.length) return;
    var queue = [], loading = false;
    function pump() {
      if (loading || !queue.length) return;
      loading = true;
      var frame = queue.shift();
      requestAnimationFrame(function () { // un documento por frame: sin picos
        frame.srcdoc = frame.getAttribute('data-doc');
        frame.removeAttribute('data-doc');
        frame.addEventListener('load', function () { loading = false; pump(); }, { once: true });
        later(function () { loading = false; pump(); }, 1500); // red de seguridad
      });
    }
    var lio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.target.hasAttribute('data-doc')) {
          lio.unobserve(entry.target);
          queue.push(entry.target);
          pump();
        }
      });
    }, { rootMargin: '160% 0px' }); // se monta antes de llegar a pantalla
    pending.forEach(function (frame) { lio.observe(frame); });
    observers.push(lio);
  })();

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
