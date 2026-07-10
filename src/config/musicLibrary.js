/* ============================================================
 * config/musicLibrary.js — TU BIBLIOTECA DE MÚSICA
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ★★★  CAMBIA AQUÍ TU MÚSICA — ES EL ÚNICO SITIO  ★★★     ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * 1) Sube tus MP3 a un repositorio de GitHub (carpeta /musica).
 * 2) Escribe abajo tu usuario y repositorio en MUSIC_REPO_BASE.
 * 3) Cambia los nombres de archivo en la lista MUSIC_TRACKS
 *    («file» debe coincidir EXACTAMENTE con el nombre del .mp3).
 * 4) Ejecuta `npm run build` para regenerar el editor.
 *
 * La pestaña «Música» del editor lee esta lista y te deja
 * escuchar cada pista y añadirla a la página con un toque.
 * ============================================================ */

// ── Base del repositorio (usuario / repo / rama / carpeta) ──
export const MUSIC_REPO_BASE =
  'https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/musica/';

// ── Tus canciones: cambia los nombres de archivo AQUÍ ──
export const MUSIC_TRACKS = [
  { file: 'musica1.mp3', title: 'Nuestra canción', artist: 'La que nos define' },
  { file: 'musica2.mp3', title: 'La del primer baile', artist: 'Inolvidable' },
  { file: 'musica3.mp3', title: 'Para dedicarte', artist: 'Con todo mi amor' },
];

/** URL completa de una pista. */
export function trackURL(track) {
  return MUSIC_REPO_BASE + encodeURIComponent(track.file);
}
