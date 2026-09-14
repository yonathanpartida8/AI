/* ============================================================
 * editor/bottomSheet.js — Física del cajón inferior
 *
 * Un solo sitio para el comportamiento de TODAS las hojas del
 * editor: los dos paneles, el menú "Más" y la ficha de un recurso.
 * Antes vivía dentro de main.js y no se podía reutilizar.
 * ============================================================ */

/**
 * CAJÓN TÁCTIL DE VERDAD (bottom sheet).
 *
 * La hoja sigue al dedo desde CUALQUIER punto, no solo desde el asa.
 * Lo difícil no es arrastrarla: es no arrastrarla cuando lo que
 * quieres es recorrer la lista de dentro. La regla:
 *
 *   · el dedo va claramente de lado        → no es cosa nuestra
 *   · la lista NO está arriba del todo     → es scroll de la lista
 *   · la lista está arriba y bajas el dedo → arrastras el cajón
 *
 * La decisión se toma una sola vez, tras 8 px de recorrido, y ya no
 * cambia en todo el gesto: nada de cajones que empiezan a moverse a
 * mitad de un scroll. Y al soltar, el cajón solo se cierra si lo has
 * bajado de verdad (60 % de su altura) o si lo has lanzado hacia
 * abajo; si no, vuelve a su sitio con un muelle.
 */
export function makeSheetDismissable(sheet, close) {
  const UMBRAL = 8;          // px antes de decidir qué gesto es
  const CIERRA = 0.6;        // fracción de la altura que hay que bajar
  // 1,4 px/ms son unos 1400 px/s: un lanzamiento de verdad. Con menos
  // (0,9) un arrastre decidido a media altura ya cerraba, y lo que se
  // pide es justo lo contrario: bajarlo hasta abajo o no se cierra.
  const LANZA = 1.4;         // px/ms hacia abajo que cierra de un gesto
  const RESISTE = 4;         // cuánto cuesta tirar hacia arriba

  let puntero = null, y0 = 0, x0 = 0, avance = 0, modo = null, lista = null;
  let ultimaY = 0, ultimaT = 0, velocidad = 0;

  /** El contenedor con scroll bajo el dedo (o la hoja, si scrollea ella). */
  const listaBajo = (destino) => {
    let n = destino;
    while (n && n !== sheet.parentElement) {
      if (n.scrollHeight > n.clientHeight + 1) {
        const ov = getComputedStyle(n).overflowY;
        if (ov === 'auto' || ov === 'scroll') return n;
      }
      if (n === sheet) break;
      n = n.parentElement;
    }
    return null;
  };

  /** Controles que se manejan con su propio arrastre: no se tocan. */
  const esSuyo = (destino) => destino.closest(
    'input, textarea, select, canvas, .scale-track, .layer-grip, .swipeable, .cp-pop, [data-handle]',
  );

  const soltarPuntero = () => {
    if (puntero == null) return;
    try { sheet.releasePointerCapture(puntero); } catch { /* ya liberado */ }
    puntero = null;
  };

  sheet.addEventListener('pointerdown', (e) => {
    if (!sheet.classList.contains('open') || puntero != null) return;
    if (esSuyo(e.target)) return;
    puntero = e.pointerId;
    x0 = e.clientX; y0 = e.clientY;
    ultimaY = e.clientY; ultimaT = e.timeStamp;
    avance = 0; velocidad = 0; modo = null;
    lista = listaBajo(e.target);
  }, { passive: true });

  sheet.addEventListener('pointermove', (e) => {
    if (e.pointerId !== puntero) return;
    const dy = e.clientY - y0;
    const dx = e.clientX - x0;

    // ── Se decide UNA vez, y para todo el gesto ──
    if (!modo) {
      if (Math.abs(dy) < UMBRAL && Math.abs(dx) < UMBRAL) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) { modo = 'lado'; soltarPuntero(); return; }
      // Bajar con la lista ya arriba del todo = arrastrar el cajón.
      // En cualquier otro caso manda el scroll de dentro.
      const arriba = !lista || lista.scrollTop <= 0;
      if (dy > 0 && arriba) {
        modo = 'cajon';
        sheet.style.transition = 'none';
        try { sheet.setPointerCapture(e.pointerId); } catch { /* sintético */ }
      } else {
        modo = 'scroll';
        soltarPuntero();
        return;
      }
    }
    if (modo !== 'cajon') return;

    // Velocidad instantánea, para saber si lo ha lanzado
    const dt = e.timeStamp - ultimaT;
    if (dt > 0) velocidad = (e.clientY - ultimaY) / dt;
    ultimaY = e.clientY; ultimaT = e.timeStamp;

    // Hacia arriba el cajón se resiste (ya está en su tope)
    avance = dy >= 0 ? dy : dy / RESISTE;
    sheet.style.setProperty('--arrastre', `${avance}px`);
  }, { passive: true });

  const terminar = (e) => {
    if (e.pointerId !== puntero && puntero != null) return;
    const eraCajon = modo === 'cajon';
    soltarPuntero();
    modo = null; lista = null;
    if (!eraCajon) return;

    sheet.style.transition = '';
    const alto = sheet.offsetHeight || 400;
    /*
     * Manda la DISTANCIA: hay que bajarlo hasta el 60 % de su altura.
     * Lanzarlo hacia abajo no lo cierra por sí solo, solo rebaja lo
     * que hace falta recorrer (al 50 %). Así el gesto tiene inercia
     * sin que un arrastre a media altura cierre el cajón sin querer.
     */
    const necesario = alto * (velocidad > LANZA ? 0.5 : CIERRA);

    if (avance > necesario) {
      // Se cierra desde donde está: quitar .open lleva el transform
      // hasta abajo y --arrastre vuelve a 0 en el mismo movimiento.
      sheet.style.removeProperty('--arrastre');
      close();
      if (navigator.vibrate) navigator.vibrate(8);
    } else {
      // No ha llegado: vuelve con muelle
      sheet.style.transition = 'transform .34s cubic-bezier(.28,1.35,.5,1)';
      sheet.style.removeProperty('--arrastre');
      const limpiar = () => { sheet.style.transition = ''; sheet.removeEventListener('transitionend', limpiar); };
      sheet.addEventListener('transitionend', limpiar);
    }
    avance = 0;
  };
  sheet.addEventListener('pointerup', terminar);
  sheet.addEventListener('pointercancel', terminar);
}
