/* ============================================================
 * editor/icons.js — Iconografía SVG del editor
 *
 * Cero emojis en la interfaz: un set consistente de iconos de
 * trazo (24×24, stroke currentColor) al estilo de las apps
 * premium. `ic(nombre, tamaño)` devuelve el SVG listo para
 * inyectar con innerHTML/html:.
 * ============================================================ */

const P = (d) => `<path d="${d}"/>`;
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const R = (x, y, w, h, rx = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

const ICONS = {
  undo: P('M9 14 4 9l5-5') + P('M4 9h10a6 6 0 0 1 0 12h-3'),
  redo: P('M15 14l5-5-5-5') + P('M20 9H10a6 6 0 0 0 0 12h3'),
  desktop: R(3, 4, 18, 12) + L(9, 20, 15, 20) + L(12, 16, 12, 20),
  tablet: R(5, 3, 14, 18, 2) + L(11, 18, 13, 18),
  mobile: R(7, 2.5, 10, 19, 2.5) + L(11, 18, 13, 18),
  minus: L(5, 12, 19, 12),
  plus: L(12, 5, 12, 19) + L(5, 12, 19, 12),
  fit: P('M9 3H4a1 1 0 0 0-1 1v5') + P('M15 3h5a1 1 0 0 1 1 1v5') + P('M9 21H4a1 1 0 0 1-1-1v-5') + P('M15 21h5a1 1 0 0 0 1-1v-5'),
  pen: P('M12 19l7-7a2.1 2.1 0 0 0-3-3l-7 7-1.5 4.5L12 19z') + L(4, 21, 8, 21),
  play: P('M7 4.5v15l12-7.5L7 4.5z'),
  stop: R(6, 6, 12, 12, 2),
  upload: P('M12 16V4') + P('m6 10 6-6 6 6') + P('M4 20h16'),
  download: P('M12 4v12') + P('m6 10 6 6 6-6') + P('M4 20h16'),
  file: P('M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4z') + P('M14 3v4h4'),
  archive: R(3, 4, 18, 5, 1.5) + P('M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9') + L(10, 13, 14, 13),
  trash: P('M4 7h16') + P('M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2') + P('M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13') + L(10, 11, 10, 17) + L(14, 11, 14, 17),
  grid: R(4, 4, 7, 7) + R(13, 4, 7, 7) + R(4, 13, 7, 7) + R(13, 13, 7, 7),
  image: R(3.5, 5, 17, 14, 2) + C(9, 10, 1.6) + P('m5 17 4.5-4.5a1 1 0 0 1 1.4 0L18 19'),
  music: P('M9 18V6l10-2v11') + C(6.5, 18, 2.5) + C(16.5, 15, 2.5),
  pages: P('M8 4h9a1 1 0 0 1 1 1v12') + R(5, 7, 11, 14, 2),
  layers: P('m12 3 9 5-9 5-9-5 9-5z') + P('m4.5 12.5 7.5 4.2 7.5-4.2') + P('m4.5 16.5 7.5 4.2 7.5-4.2'),
  sliders: L(5, 6, 19, 6) + C(9, 6, 2) + L(5, 12, 19, 12) + C(15, 12, 2) + L(5, 18, 19, 18) + C(11, 18, 2),
  lock: R(5.5, 11, 13, 9, 2) + P('M8 11V8a4 4 0 0 1 8 0v3'),
  unlock: R(5.5, 11, 13, 9, 2) + P('M8 11V8a4 4 0 0 1 7.5-2'),
  eye: P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + C(12, 12, 3),
  eyeOff: P('M4 4l16 16') + P('M9.9 5.1A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4M6.1 6.8A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4-.9'),
  copy: R(9, 9, 11, 11, 2) + P('M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'),
  duplicate: R(8, 8, 12, 12, 2) + P('M8 12H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3') + L(14, 11, 14, 17) + L(11, 14, 17, 14),
  front: P('m12 3 6 6h-4v6h-4V9H6l6-6z') + L(5, 21, 19, 21),
  back: P('m12 21-6-6h4V9h4v6h4l-6 6z') + L(5, 3, 19, 3),
  up: P('m6 14 6-6 6 6'),
  down: P('m6 10 6 6 6-6'),
  close: L(6, 6, 18, 18) + L(18, 6, 6, 18),
  search: C(11, 11, 6.5) + L(16, 16, 21, 21),
  heart: P('M12 20s-7.5-4.9-9.3-9.1C1.3 7.6 3.6 4.5 6.8 4.5c2 0 3.6 1.1 4.4 2.7l.8 1.6.8-1.6c.8-1.6 2.4-2.7 4.4-2.7 3.2 0 5.5 3.1 4.1 6.4C19.5 15.1 12 20 12 20z'),
  sparkles: P('M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4z') + P('M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z') + P('M5 15l.7 1.8L7.5 17.5l-1.8.7L5 20l-.7-1.8L2.5 17.5l1.8-.7L5 15z'),
  type: P('M5 6V4h14v2') + L(12, 4, 12, 20) + L(9, 20, 15, 20),
  square: R(4, 6, 16, 12, 3),
  film: R(4, 4, 16, 16, 2) + L(4, 9, 20, 9) + L(4, 15, 20, 15) + L(9, 4, 9, 20) + L(15, 4, 15, 20),
  video: R(3, 6, 13, 12, 2.5) + P('m16 10 5-3v10l-5-3'),
  star: P('m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.9L12 3.5z'),
  diamond: P('m12 3 8 9-8 9-8-9 8-9z'),
  box: R(4, 4, 16, 16, 3),
  rows: R(3.5, 5, 17, 5.5, 1.5) + R(3.5, 13.5, 17, 5.5, 1.5),
  arrowRight: P('M4 12h14') + P('m13 6 6 6-6 6'),
  columns: R(4, 5, 4.8, 14, 1.5) + R(9.6, 5, 4.8, 14, 1.5) + R(15.2, 5, 4.8, 14, 1.5),
  mail: R(3, 5.5, 18, 13, 2) + P('m4 7 8 6 8-6'),
  menu: L(4, 7, 20, 7) + L(4, 12, 20, 12) + L(4, 17, 20, 17),
  disc: C(12, 12, 8.5) + C(12, 12, 2.2),
  cube: P('M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z') + P('M12 12l8-4.5M12 12 4 7.5M12 12v9'),
  code: P('m9 8-4 4 4 4') + P('m15 8 4 4-4 4'),
  globe: C(12, 12, 8.5) + P('M3.5 12h17') + P('M12 3.5c-5.5 5.5-5.5 11.5 0 17 5.5-5.5 5.5-11.5 0-17z'),
  clock: C(12, 12, 8.5) + P('M12 7v5l3.5 2'),
  hourglass: P('M7 3h10v4l-4 5 4 5v4H7v-4l4-5-4-5V3z'),
  camera: R(3, 7, 18, 13, 2.5) + P('M9 7l1.2-2.4A1 1 0 0 1 11.1 4h1.8a1 1 0 0 1 .9.6L15 7') + C(12, 13, 3.4),
  droplet: P('M12 3.5S6 10 6 14.5a6 6 0 0 0 12 0C18 10 12 3.5 12 3.5z'),
  wand: P('m5 19 9-9') + P('m15 4 .9 2.1L18 7l-2.1.9L15 10l-.9-2.1L12 7l2.1-.9L15 4z') + P('M19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6L19 12z'),
  drag: C(9, 6, 1.4) + C(15, 6, 1.4) + C(9, 12, 1.4) + C(15, 12, 1.4) + C(9, 18, 1.4) + C(15, 18, 1.4),
  gift: R(4, 10, 16, 10, 2) + R(3, 7, 18, 3.5, 1.5) + L(12, 7, 12, 20) + P('M12 7s-1-4-4-4a2 2 0 0 0 0 4h4zm0 0s1-4 4-4a2 2 0 0 1 0 4h-4z'),
  calendar: R(3.5, 5, 17, 15.5, 2) + L(3.5, 9.5, 20.5, 9.5) + L(8, 3, 8, 6.5) + L(16, 3, 16, 6.5),
  gamepad: P('M7 9h10a5 5 0 0 1 5 5c0 2.8-2.2 4.5-4.5 4.5-1.6 0-2.8-.9-3.5-2h-4c-.7 1.1-1.9 2-3.5 2C4.2 18.5 2 16.8 2 14a5 5 0 0 1 5-5z') + L(7.5, 12, 7.5, 15.5) + L(5.75, 13.75, 9.25, 13.75) + C(16, 13, 0.9) + C(18.2, 15, 0.9),
  quote: P('M7 7c-2 1-3 2.7-3 5v5h5v-5H6c0-1.8.8-3 2.5-3.8L7 7z') + P('M17 7c-2 1-3 2.7-3 5v5h5v-5h-3c0-1.8.8-3 2.5-3.8L17 7z'),
  ring: C(12, 14, 6) + P('m9 5 3 3 3-3-1.5-2h-3L9 5z'),
  balloon: P('M12 3.5c3.3 0 6 2.7 6 6.2 0 3.8-2.7 6.8-6 6.8s-6-3-6-6.8c0-3.5 2.7-6.2 6-6.2z') + P('m11 16.5 1 2 1-2') + P('M12 18.5c0 2-1.5 2-1.5 3.5'),
  eyedrop: P('m4 20 1-4L15 6l3 3L8 19l-4 1z') + P('m13.5 4.5 2-2a2.1 2.1 0 0 1 3 3l-2 2'),
  check: P('m5 12.5 4.5 4.5L19 7.5'),
  more: C(5, 12, 1.6) + C(12, 12, 1.6) + C(19, 12, 1.6),
  home: P('m4 11 8-7 8 7') + P('M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9'),
  folder: P('M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17V7z'),
  divider: L(3, 12, 21, 12) + C(12, 12, 2),
};

/** Devuelve el SVG del icono (string, listo para html:). */
export function ic(name, size = 18) {
  const body = ICONS[name] || ICONS.sparkles;
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Icono por tipo de componente (paleta, capas). */
export const TYPE_ICONS = {
  text: 'type', button: 'square', navButton: 'arrowRight', image: 'image', gif: 'film',
  video: 'video', audio: 'music', icon: 'star', shape: 'diamond', container: 'box',
  section: 'rows', gallery: 'grid', slider: 'columns', form: 'mail', menu: 'menu',
  musicPlayer: 'disc', model3d: 'cube', particles: 'sparkles', drawing: 'pen',
  loveLetter: 'mail', timeline: 'clock', hiddenMessage: 'eyeOff', heartButton: 'heart',
  typewriter: 'type', countdown: 'hourglass', polaroid: 'camera', floatingEmojis: 'balloon',
  heart3d: 'heart', photo3d: 'camera', gradientBg: 'droplet', customHTML: 'code',
  custom3D: 'cube', htmlEmbed: 'globe', divider: 'divider',
};

export function typeIcon(type, size = 18) {
  return ic(TYPE_ICONS[type] || 'box', size);
}

/** Iconos de los bloques prediseñados. */
export const BLOCK_ICONS = {
  romanticHero: 'sparkles', letter: 'mail', timelineB: 'clock', countdownB: 'hourglass',
  polaroids: 'camera', secret: 'eyeOff', chapter: 'pages', music: 'music',
  reasons: 'heart', coupons: 'gift', question: 'ring', gift: 'gift', calendar: 'calendar',
  game: 'gamepad', quotes: 'quote', hero: 'sparkles', features: 'grid', quote: 'quote',
  gallery: 'grid', faq: 'menu', contact: 'mail', cta: 'arrowRight', footer: 'rows',
};
