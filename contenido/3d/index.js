/* ============================================================
 * contenido/3d/index.js — TUS ESCENAS 3D
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Añade aquí tus propios 3D y aparecen en la paleta       ║
 * ║  del editor (sección "Mis 3D") listos para arrastrar.    ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * CÓMO AÑADIR UNO NUEVO:
 *  1) Crea un archivo en esta carpeta (ej: mi-escena.js) que
 *     exporte { name, icon, code } — mira ejemplo-anillo.js.
 *  2) Impórtalo y añádelo a la lista de abajo.
 *  3) Ejecuta `npm run build`.
 *
 * El código recibe: THREE, scene, camera, pivot, renderer,
 * GLTFLoader — y puede devolver update(dt) para animar.
 * ============================================================ */

import ejemploAnillo from './ejemplo-anillo.js';
import ejemploEstrellas from './ejemplo-estrellas.js';

export const MY_3D = [
  ejemploAnillo,
  ejemploEstrellas,
  // ← añade los tuyos aquí
];
