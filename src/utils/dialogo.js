/* ============================================================
 * utils/dialogo.js — Diálogos propios del editor
 *
 * Sustituyen a alert(), confirm() y prompt(). No es capricho: los
 * diálogos del navegador BLOQUEAN el hilo (se congela todo, también
 * las animaciones y el WebGL), en el móvil salen con la tipografía
 * del sistema y el nombre del archivo encima, y no hay manera de que
 * se parezcan al resto de la interfaz.
 *
 * Estos devuelven una promesa, se cierran tocando fuera o con Escape,
 * devuelven el foco a donde estaba y se animan como el resto.
 *
 *   await confirmar({ titulo, texto, aceptar, peligro })  → boolean
 *   await preguntar({ titulo, etiqueta, valor })          → string | null
 *   await avisar({ titulo, texto })                       → void
 *   await elegir({ titulo, texto, opciones })             → valor | null
 * ============================================================ */

import { el } from './helpers.js';

let abierto = null;

/**
 * Base de todos: monta el velo y la tarjeta, y resuelve con lo que
 * devuelva el botón que se pulse (o `cancelar` si se descarta).
 */
function montar({ titulo, texto, cuerpo = [], acciones, cancelar = null, alAbrir = null }) {
  // Solo un diálogo a la vez: el anterior se descarta
  abierto?.cerrar(cancelar);

  return new Promise((resolver) => {
    const antes = document.activeElement;
    let vivo = true;

    const cerrar = (valor) => {
      if (!vivo) return;
      vivo = false;
      abierto = null;
      document.removeEventListener('keydown', teclas, true);
      velo.classList.remove('abierto');
      // Se retira al terminar el fundido, no de golpe
      setTimeout(() => velo.remove(), 200);
      if (antes && antes.isConnected) antes.focus?.();
      resolver(valor);
    };

    const teclas = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(cancelar); return; }
      if (e.key !== 'Tab') return;
      // Trampa de foco: el tabulador no se escapa del diálogo
      const focos = [...tarjeta.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')]
        .filter((n) => !n.disabled && n.offsetParent !== null);
      if (!focos.length) return;
      const primero = focos[0], último = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); último.focus(); }
      else if (!e.shiftKey && document.activeElement === último) { e.preventDefault(); primero.focus(); }
    };

    const tarjeta = el('div', {
      class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo,
      onpointerdown: (e) => e.stopPropagation(),   // tocar dentro no cierra
    }, [
      el('h3', { class: 'dlg-titulo', text: titulo }),
      texto ? el('p', { class: 'dlg-texto', text: texto }) : null,
      ...cuerpo,
      el('div', { class: 'dlg-acciones' }, acciones.map((a) => el('button', {
        class: `btn${a.cls ? ` ${a.cls}` : ''}`,
        text: a.texto,
        onclick: () => cerrar(typeof a.valor === 'function' ? a.valor() : a.valor),
      }))),
    ].filter(Boolean));

    const velo = el('div', {
      class: 'dlg-velo',
      onpointerdown: () => cerrar(cancelar),
    }, [tarjeta]);

    document.body.append(velo);
    abierto = { cerrar };
    // Un frame para que la animación de entrada arranque de verdad
    requestAnimationFrame(() => velo.classList.add('abierto'));
    alAbrir?.(tarjeta);
    document.addEventListener('keydown', teclas, true);
  });
}

/** ¿Seguro? → true / false */
export function confirmar({ titulo, texto = '', aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }) {
  return montar({
    titulo,
    texto,
    cancelar: false,
    acciones: [
      { texto: cancelar, valor: false },
      { texto: aceptar, valor: true, cls: peligro ? 'danger' : 'primary' },
    ],
    alAbrir: (t) => t.querySelector('.dlg-acciones button:last-child')?.focus(),
  });
}

/** Pide un texto → el texto, o null si se cancela */
export function preguntar({ titulo, etiqueta = '', valor = '', aceptar = 'Guardar', placeholder = '' }) {
  const campo = el('input', { class: 'input', value: valor, placeholder });
  return montar({
    titulo,
    cancelar: null,
    cuerpo: [
      etiqueta ? el('label', { class: 'field' }, [
        el('span', { class: 'field-label', text: etiqueta }),
        campo,
      ]) : campo,
    ],
    acciones: [
      { texto: 'Cancelar', valor: null },
      { texto: aceptar, valor: () => campo.value.trim() || null, cls: 'primary' },
    ],
    alAbrir: () => { campo.focus(); campo.select(); },
  });
}

/** Aviso de una sola salida */
export function avisar({ titulo, texto = '', aceptar = 'Entendido' }) {
  return montar({
    titulo,
    texto,
    cancelar: undefined,
    acciones: [{ texto: aceptar, valor: undefined, cls: 'primary' }],
    alAbrir: (t) => t.querySelector('.dlg-acciones button')?.focus(),
  });
}

/** Varias salidas → el valor de la elegida, o null */
export function elegir({ titulo, texto = '', opciones }) {
  return montar({
    titulo,
    texto,
    cancelar: null,
    acciones: [
      ...opciones.map((o) => ({ texto: o.texto, valor: o.valor, cls: o.cls })),
      { texto: 'Cancelar', valor: null },
    ],
    alAbrir: (t) => t.querySelector('.dlg-acciones button')?.focus(),
  });
}
