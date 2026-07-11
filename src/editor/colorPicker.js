/* ============================================================
 * editor/colorPicker.js — Selector de color profesional
 *
 * Popover con:
 *  - Rueda circular de tono (Color Wheel en canvas).
 *  - Cuadro de saturación/valor.
 *  - Deslizador de transparencia (alfa) con damero.
 *  - Cuentagotas (EyeDropper API cuando el navegador lo soporta).
 *  - Colores favoritos persistentes (localStorage).
 *  - Entrada hex/rgba manual.
 *
 * Uso:  openColorPicker(anchorEl, valorActual, (css) => aplicar)
 * Emite en vivo (oninput) — los cambios se ven al instante.
 * ============================================================ */

import { el } from '../utils/helpers.js';
import { ic } from './icons.js';

const FAV_KEY = 'wb-fav-colors';

/* ── Conversión de color ─────────────────────────────── */

function hsvToRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255].map(Math.round);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

/** Parsea #hex / rgb() / rgba() → {r,g,b,a}. Devuelve null si no puede. */
export function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  let m = str.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
  }
  m = str.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] ?? 1 };
  }
  return null;
}

function toCss({ r, g, b, a }) {
  if (a >= 1) return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 100) / 100})`;
}

/* ── Favoritos ───────────────────────────────────────── */

function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; }
}
function saveFavs(list) {
  localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 18)));
}

/* ── Popover ─────────────────────────────────────────── */

let activePicker = null;

export function closeColorPicker() {
  activePicker?.remove();
  activePicker = null;
}

export function openColorPicker(anchor, initial, onChange) {
  closeColorPicker();

  const start = parseColor(initial) || { r: 255, g: 143, b: 171, a: 1 };
  let [h, s, v] = rgbToHsv(start.r, start.g, start.b);
  let a = start.a;

  const WHEEL = 168, RING = 14;
  const pop = el('div', { class: 'cp-pop', role: 'dialog' });

  /* Rueda de tono + cuadro SV superpuesto */
  const wheel = el('canvas', { class: 'cp-wheel', width: WHEEL * 2, height: WHEEL * 2, style: { width: `${WHEEL}px`, height: `${WHEEL}px` } });
  const wctx = wheel.getContext('2d');
  const svBox = el('canvas', { class: 'cp-sv', width: 200, height: 200 });
  const svCtx = svBox.getContext('2d');
  const svCursor = el('div', { class: 'cp-cursor' });
  const hueCursor = el('div', { class: 'cp-cursor cp-cursor-hue' });
  const wheelWrap = el('div', { class: 'cp-wheel-wrap' }, [wheel, svBox, svCursor, hueCursor]);

  function drawWheel() {
    const c = WHEEL, rOut = WHEEL - 2, rIn = WHEEL - 2 - RING * 2;
    wctx.clearRect(0, 0, WHEEL * 2, WHEEL * 2);
    for (let deg = 0; deg < 360; deg += 2) {
      const rad = (deg - 90) * Math.PI / 180;
      wctx.beginPath();
      wctx.strokeStyle = `hsl(${deg} 100% 50%)`;
      wctx.lineWidth = RING * 2;
      wctx.arc(c, c, (rOut + rIn) / 2, rad, rad + 0.06);
      wctx.stroke();
    }
  }

  function drawSV() {
    const size = 200;
    const grad1 = svCtx.createLinearGradient(0, 0, size, 0);
    grad1.addColorStop(0, '#fff');
    grad1.addColorStop(1, `hsl(${h} 100% 50%)`);
    svCtx.fillStyle = grad1;
    svCtx.fillRect(0, 0, size, size);
    const grad2 = svCtx.createLinearGradient(0, 0, 0, size);
    grad2.addColorStop(0, 'rgba(0,0,0,0)');
    grad2.addColorStop(1, '#000');
    svCtx.fillStyle = grad2;
    svCtx.fillRect(0, 0, size, size);
  }

  /* Alfa + entrada + acciones */
  const alphaInput = el('input', { class: 'cp-alpha', type: 'range', min: 0, max: 100, value: Math.round(a * 100) });
  const hexInput = el('input', { class: 'input cp-hex', spellcheck: 'false' });
  const preview = el('button', { class: 'cp-preview', title: 'Guardar en favoritos' });
  const favRow = el('div', { class: 'cp-favs' });

  function current() { const [r, g, b] = hsvToRgb(h, s, v); return { r, g, b, a }; }

  function positionCursors() {
    const svSize = 116; // lado del cuadro SV dentro de la rueda (CSS)
    const off = (WHEEL - svSize) / 2;
    svCursor.style.left = `${off + s * svSize}px`;
    svCursor.style.top = `${off + (1 - v) * svSize}px`;
    const rad = (h - 90) * Math.PI / 180;
    const rMid = WHEEL / 2 - 1 - RING / 2; // centro del anillo de tono
    hueCursor.style.left = `${WHEEL / 2 + Math.cos(rad) * rMid}px`;
    hueCursor.style.top = `${WHEEL / 2 + Math.sin(rad) * rMid}px`;
  }

  function apply(fireChange = true) {
    const css = toCss(current());
    preview.style.background = css;
    hexInput.value = css;
    alphaInput.style.setProperty('--cp-c', toCss({ ...current(), a: 1 }));
    positionCursors();
    if (fireChange) onChange(css);
  }

  function refreshFavs() {
    favRow.innerHTML = '';
    for (const fav of loadFavs()) {
      favRow.append(el('button', {
        class: 'cp-fav', title: `${fav} · mantén presionado para quitar`, style: { background: fav },
        onclick: () => {
          const parsed = parseColor(fav);
          if (parsed) { [h, s, v] = rgbToHsv(parsed.r, parsed.g, parsed.b); a = parsed.a; alphaInput.value = Math.round(a * 100); drawSV(); apply(); }
        },
        oncontextmenu: (e) => { e.preventDefault(); saveFavs(loadFavs().filter((c) => c !== fav)); refreshFavs(); },
      }));
    }
  }

  preview.addEventListener('click', () => {
    const css = toCss(current());
    const favs = loadFavs();
    if (!favs.includes(css)) { favs.unshift(css); saveFavs(favs); refreshFavs(); }
  });

  /* Interacción rueda / cuadro SV */
  function handleWheelPointer(e) {
    const rect = wheel.getBoundingClientRect();
    const x = e.clientX - rect.left - WHEEL / 2;
    const y = e.clientY - rect.top - WHEEL / 2;
    const dist = Math.hypot(x, y);
    const svHalf = 116 / 2;
    if (Math.abs(x) <= svHalf + 6 && Math.abs(y) <= svHalf + 6 && dist < WHEEL / 2 - RING - 4) {
      // dentro del cuadro SV
      s = Math.max(0, Math.min(1, (x + svHalf) / 116));
      v = Math.max(0, Math.min(1, 1 - (y + svHalf) / 116));
    } else {
      h = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
      drawSV();
    }
    apply();
  }
  let draggingWheel = false;
  wheelWrap.addEventListener('pointerdown', (e) => { draggingWheel = true; wheelWrap.setPointerCapture?.(e.pointerId); handleWheelPointer(e); });
  wheelWrap.addEventListener('pointermove', (e) => { if (draggingWheel) handleWheelPointer(e); });
  wheelWrap.addEventListener('pointerup', () => { draggingWheel = false; });

  alphaInput.addEventListener('input', () => { a = +alphaInput.value / 100; apply(); });
  hexInput.addEventListener('change', () => {
    const parsed = parseColor(hexInput.value);
    if (parsed) { [h, s, v] = rgbToHsv(parsed.r, parsed.g, parsed.b); a = parsed.a; alphaInput.value = Math.round(a * 100); drawSV(); apply(); }
  });

  const eyeBtn = el('button', {
    class: 'btn btn-ic', html: ic('eyedrop', 15),
    title: window.EyeDropper ? 'Cuentagotas: copia un color de la pantalla' : 'Cuentagotas no soportado en este navegador',
    onclick: async () => {
      if (!window.EyeDropper) return;
      try {
        const result = await new window.EyeDropper().open();
        const parsed = parseColor(result.sRGBHex);
        if (parsed) { [h, s, v] = rgbToHsv(parsed.r, parsed.g, parsed.b); drawSV(); apply(); }
      } catch { /* cancelado */ }
    },
  });

  pop.append(
    wheelWrap,
    el('div', { class: 'cp-row' }, [preview, hexInput, eyeBtn]),
    el('div', { class: 'cp-row' }, [el('span', { class: 'cp-label', text: 'Alfa' }), alphaInput]),
    favRow,
    el('button', { class: 'btn block', text: 'Listo', onclick: closeColorPicker }),
  );

  document.body.append(pop);
  activePicker = pop;

  // Posicionamiento junto al ancla, sin salirse de la pantalla
  const rect = anchor.getBoundingClientRect();
  const pw = 236, ph = 380;
  let left = Math.min(Math.max(8, rect.left), innerWidth - pw - 8);
  let top = rect.bottom + 8;
  if (top + ph > innerHeight) top = Math.max(8, rect.top - ph - 8);
  Object.assign(pop.style, { left: `${left}px`, top: `${top}px` });

  // Cierre al tocar fuera
  setTimeout(() => {
    const outside = (e) => {
      if (!pop.contains(e.target)) { closeColorPicker(); document.removeEventListener('pointerdown', outside, true); }
    };
    document.addEventListener('pointerdown', outside, true);
  }, 0);

  drawWheel();
  drawSV();
  refreshFavs();
  apply(false);
}
