/* ============================================================
 * contenido/animaciones/index.js — TUS ANIMACIONES CSS
 *
 * Escribe aquí @keyframes propios: quedan disponibles en el
 * editor Y en el sitio exportado. Úsalos desde el panel de
 * cualquier elemento → Animación → "Animación CSS propia",
 * por ejemplo:  vaiven 2s ease-in-out infinite
 * ============================================================ */

export const MY_ANIMATIONS_CSS = `
/* Vaivén suave */
@keyframes vaiven {
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(3deg); }
}

/* Aparecer escribiendo desde abajo con rebote */
@keyframes brinco {
  0%   { opacity: 0; transform: translateY(60px) scale(.8); }
  70%  { opacity: 1; transform: translateY(-10px) scale(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* Neón parpadeante */
@keyframes neon {
  0%, 100% { filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 14px #ff8fab); }
  50%      { filter: drop-shadow(0 0 1px #fff); }
}

/* ← añade los tuyos aquí */
`;
