/* ============================================================
 * contenido/widgets/index.js — TUS WIDGETS
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Añade aquí widgets propios (HTML+CSS+JS) y aparecen en  ║
 * ║  la paleta ("Mis widgets") listos para arrastrar.        ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * CÓMO AÑADIR UNO NUEVO:
 *  1) Crea un archivo (ej: mi-widget.js) exportando
 *     { name, icon, width, height, html, css, js }.
 *  2) Impórtalo y añádelo a la lista.
 *  3) `npm run build`.
 * ============================================================ */

import ejemploTarjeta from './ejemplo-tarjeta.js';
import ejemploLatido from './ejemplo-latido.js';

export const MY_WIDGETS = [
  ejemploTarjeta,
  ejemploLatido,
  // ← añade los tuyos aquí
];
