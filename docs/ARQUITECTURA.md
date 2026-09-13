# Arquitectura — Creador de Experiencias Románticas Digitales

> **Novedad clave (v3): runtimes compartidos.** Las funciones de
> `/src/runtime` (`wbParticles`, `wbEffects`, `wbActions`) son 100 %
> autocontenidas y corren tal cual en el editor; el exportador las inyecta
> en el sitio final con `Function.prototype.toString()`. El CSS de
> componentes (`componentStyles.js`) se comparte igual. Resultado: **cero
> divergencia** entre editor, vista previa y sitio exportado — multimedia,
> efectos, lógica y transiciones se comportan idéntico en los tres.
>
> **Sistema de lógica visual**: cualquier elemento acepta eventos
> (tocar/doble toque/mantener/hover/deslizar/aparecer) con CADENAS de
> acciones y retardos (`node.events[].actions[]`), ejecutadas por
> `wbActions` — incluyendo `runJS` para código propio.
>
> **Zonas de código personalizado**: `project.custom{css,js}` (global),
> `page.custom{css,js}` (por página) y el componente `customHTML`
> (por elemento). El export de 1 archivo incrusta el proyecto en
> `<script id="wb-project">`; al re-importar ese HTML se recuperan proyecto
> y assets, y se detectan bloques `<style class="custom">` /
> `<script class="custom">` añadidos a mano.

Documento técnico del sistema, organizado en las 10 fases del diseño.
Todo lo descrito aquí **está implementado y funcionando** en `/src`.

---

## FASE 1 — Arquitectura general del sistema

El sistema se divide en 6 subsistemas desacoplados que se comunican **exclusivamente
por eventos** (pub/sub) a través del `ProjectStore`. Ningún módulo importa a otro
módulo de UI directamente → cada pieza es sustituible y testeable.

```
┌────────────────────────────────────────────────────────────┐
│                      EDITOR VISUAL                          │
│  Topbar · Panels (paleta/assets/páginas/capas)              │
│  PropertiesPanel · Interactions · CanvasView · DrawTool     │
└──────────────┬─────────────────────────────────────────────┘
               │ acciones (addNode, setFrame, updateNode…)
               ▼
┌────────────────────────────────────────────────────────────┐
│            PROJECT STORE  (fuente de verdad JSON)           │
│  historial undo/redo · autosave · selección · breakpoints   │
└──────┬───────────────┬───────────────┬─────────────────────┘
       │ 'change'      │ 'change'      │ export()
       ▼               ▼               ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│  RENDERER   │ │ MOTOR WEBGL  │ │        EXPORTADOR         │
│ JSON → DOM  │ │ Three.js +   │ │ JSON → HTML/CSS/JS + ZIP  │
│             │ │ WebGL2 nativo│ │                           │
└─────────────┘ └──────────────┘ └──────────────────────────┘
       ▲
┌──────┴──────────────┐  ┌───────────────────────────────────┐
│ MOTOR DE ANIMACIONES │  │  ASSET MANAGER (IndexedDB)        │
│ presets → WAAPI/CSS  │  │  imágenes·GIF·vídeo·audio·GLB     │
└─────────────────────┘  └───────────────────────────────────┘
```

### Flujo de datos unidireccional

```
gesto del usuario → acción del Store → mutación del JSON → commit()
   → evento 'change' → Renderer repinta → paneles se sincronizan
```

Este patrón (el mismo de Figma/Redux) elimina toda una clase de bugs de
sincronización: **la UI nunca es la verdad; el JSON siempre lo es**. Undo/redo,
autosave, colaboración futura (CRDT) y el exportador operan sobre el mismo valor.

### Decisiones de escalabilidad

- **Mapa plano de nodos** (`nodes{id→nodo}` + `pages[].nodes[ids]`): lookup O(1),
  reordenar capas es mover un id en un array, duplicar páginas no copia estructuras
  profundas anidadas.
- **ES Modules nativos, cero build**: el proyecto corre abriéndolo con cualquier
  servidor estático. Migrar a Vite/TypeScript después es trivial porque los límites
  de módulo ya existen.
- **Renderer compartido**: `contentHTML()` genera el markup tanto en el editor como
  en el exportador → *lo que ves es literalmente lo que se exporta*.

---

## FASE 2 — Modelo JSON del proyecto

```jsonc
{
  "version": 1,
  "meta": { "name": "Mi Proyecto", "created": 0, "modified": 0 },
  "settings": {
    "breakpoints": { "desktop": 1280, "tablet": 768, "mobile": 390 },
    "grid": { "size": 8, "visible": true, "snap": true }
  },
  "pages": [
    {
      "id": "pg_x", "name": "Inicio", "slug": "index",
      "height": 800, "background": "#0b1020",
      "transition": "fade",            // fade | slide | zoom | blur
      "nodes": ["nd_a", "nd_b"]        // z-order: último = encima
    }
  ],
  "nodes": {
    "nd_a": {
      "id": "nd_a", "type": "text", "name": "Título",
      "base":   { "x": 100, "y": 80, "w": 300, "h": 60,
                  "rotation": 0, "scale": 1, "opacity": 1 },
      "responsive": {                  // overrides en cascada
        "tablet": { "x": 40, "w": 260 },
        "mobile": { "x": 12, "y": 40, "w": 200 }
      },
      "styles": { "fontSize": 32, "color": "#fff", "fontFamily": "system-ui" },
      "props":  { "text": "Hola", "tag": "h1" },   // por tipo de componente
      "animation": { "preset": "fadeInUp", "trigger": "scroll",
                     "duration": 800, "delay": 0, "loop": false,
                     "easing": "ease-out" },
      "events": [ { "on": "click", "action": "goToPage", "target": "pg_y" } ],
      "locked": false, "hidden": false
    }
  },
  "assets": [ /* metadatos; los blobs viven en IndexedDB */ ]
}
```

- **Cascada responsive**: el marco efectivo en móvil es
  `base ⊕ responsive.tablet ⊕ responsive.mobile` (igual que CSS). Solo se guardan
  las propiedades que cambian.
- **Historial**: snapshots inmutables del JSON (50 pasos). Al ser un valor puro,
  undo/redo es `pop()` de una pila — imposible corromper estado.
- **Persistencia**: localStorage (autosave con debounce de 800 ms) + IndexedDB
  (copia + blobs de assets).

---

## FASE 3 — Sistema de componentes

`src/components/registry.js` define **18 componentes** de forma declarativa:
texto, botón, imagen, GIF, vídeo, audio, icono, forma, contenedor, sección,
galería, slider, formulario, menú, reproductor de música, modelo 3D, partículas
WebGL2 y dibujo.

Cada definición contiene `label/icon/cat` (paleta), `size` (tamaño inicial),
`defaults` (props/estilos del nodo) y **`schema`**: la lista de campos editables.
El panel de propiedades **se genera automáticamente desde el schema**
(tipos: text, textarea, number, color, select, checkbox, asset, assetList).

> Añadir un componente nuevo = 1 entrada en el registry + 1 caso en
> `contentHTML()` del renderer. Paleta, panel de propiedades, exportador,
> undo/redo y responsive lo soportan sin tocar nada más. Esa es la propiedad
> que hace el sistema escalable como producto.

---

## FASE 4 — Editor Drag-and-Drop

`src/editor/interactions.js` implementa todos los gestos con **Pointer Events**:
un solo código para ratón, táctil y stylus (`setPointerCapture` evita perder el
gesto al salir del elemento).

| Gesto | Resultado |
|---|---|
| click / tap (Shift) | seleccionar (múltiple) |
| arrastrar nodo | mover con guías inteligentes + snap a rejilla |
| 8 tiradores | redimensionar (Shift = proporción bloqueada) |
| tirador superior | rotar (Shift = pasos de 15°) |
| arrastrar lienzo vacío | selección por marco (marquee) |
| rueda / Ctrl+rueda | pan / zoom al cursor |
| espacio o botón medio | pan temporal |
| 2 dedos (pinch) | zoom táctil |
| doble clic en texto | edición inline (contenteditable) |

- **Guías inteligentes**: al mover, se comparan bordes y centros contra todos los
  demás nodos + centro/bordes del artboard; a < 6 px (ajustado por zoom) el
  elemento "imanta" y se dibuja la guía rosa en el SVG overlay.
- **Zoom/pan**: una única `transform` CSS en `#world` → lo compone la GPU, nunca
  hay reflow. Los tiradores compensan con `scale(var(--izoom))` para mantener
  tamaño constante en pantalla.
- **Reglas** dibujadas en `<canvas>` propios; se repintan solo cuando cambia la
  vista (render bajo demanda).
- Copiar/pegar/duplicar/bloquear/ocultar/nudge con flechas: en `projectStore.js`
  y atajos en `main.js`.

---

## FASE 5 — Gestor multimedia y GIFs

`src/assets/assetManager.js`:

- **Subida** vía `<input type="file" multiple accept="image/*,video/*,audio/*,.glb,…">`
  → funciona con la **galería del móvil**, cámara y disco. También drop directo
  de archivos del SO sobre el lienzo (crea el asset **y** el componente en el
  punto exacto del drop).
- Cada archivo se convierte a dataURL (`FileReader`) y se persiste en IndexedDB;
  metadatos (nombre, tipo, tamaño, carpeta, etiquetas) se reflejan en el JSON.
- Biblioteca con **vista previa, búsqueda, filtro por tipo y carpetas por clase**
  (images/gifs/videos/audio/models/fonts — la misma estructura que genera el ZIP).
- **Drag al lienzo** o clic: si hay un componente compatible seleccionado, el
  asset lo rellena; si no, crea el componente adecuado (GIF→gif, GLB→modelo 3D…).
- **GIFs**: loop infinito nativo; "pausar" congela el primer frame pintándolo en
  un canvas (técnica estándar, también en el runtime exportado).
- **Vídeos**: autoplay/loop/mute/controles y *reproducir al hacer scroll*
  (IntersectionObserver).

---

## FASE 6 — Integración DOM + Canvas + WebGL2 + Three.js

Regla de reparto por naturaleza del contenido:

| Tecnología | Se usa para | Por qué |
|---|---|---|
| **DOM** | texto, botones, formularios, menús, layout | accesibilidad, SEO, edición inline gratis |
| **Canvas 2D** | dibujo libre (DrawTool) | acceso por píxel, presión de stylus, exportar PNG |
| **WebGL2 nativo** | partículas (`src/webgl/particles.js`) | 5000 sprites < 1 ms/frame; shaders GLSL 300 es propios |
| **Three.js** | modelos GLB/GLTF | loader, iluminación, AnimationMixer ya resueltos |

Claves:

- **Carga perezosa de Three.js**: el import dinámico solo se ejecuta si la página
  contiene un componente 3D. Sin 3D, el editor no descarga ni un byte de Three.
- Cada instancia WebGL se **pausa fuera de pantalla** (IntersectionObserver) y
  limita `devicePixelRatio` a 2 → batería y móviles.
- Los canvas WebGL viven **dentro de nodos absolutamente posicionados**, así que
  se mueven/escalan/rotan/animan como cualquier otro componente.
- `dispose()` riguroso al cambiar de página (se libera contexto GL y RAF).

---

## FASE 7 — Motor de animaciones

`src/animations/engine.js` define 15 presets como **datos puros** (keyframes que
solo tocan `transform/opacity/filter` → composición GPU, 60–120 fps). El mismo
preset se ejecuta por dos vías:

1. **Editor/preview** → Web Animations API (`element.animate`, `composite:'add'`
   para sumarse a la rotación/escala base del nodo).
2. **Export** → se compila a `@keyframes` CSS: las animaciones de carga no
   necesitan JavaScript en el sitio final.

Parámetros por nodo: preset, trigger (`load | scroll | click | hover`), duración,
delay, loop, curva (incl. cubic-bezier "back"). Los triggers en el sitio
exportado: `scroll` = IntersectionObserver que añade `.wb-play`; `click` =
reinicio por reflow; `hover` = selector `:hover` puro.

**Eventos** (independientes de la animación): `goToPage`, `openUrl`,
`toggleNode`, `playAnimation`, `playSound` — serializados en `data-events` y
ejecutados por el runtime `app.js`.

---

## FASE 8 — Sistema responsive

- Tres breakpoints editables en `settings.breakpoints` (desktop 1280 / tablet
  768 / móvil 390) + conmutador en la topbar que redimensiona el artboard.
- **Edición no destructiva**: en modo tablet/móvil, mover o redimensionar escribe
  solo el *override* de ese breakpoint (`node.responsive.tablet = {x, w}`), nunca
  la base. Botón "quitar override" para volver a heredar.
- En el export, la regla de oro es **no romper nunca el diseño**: si el
  usuario no creó overrides, NO se emiten media queries — el stage conserva
  el ancho de diseño y se **escala proporcionalmente**
  (`transform: scale(vw/designW)`) a cualquier pantalla y orientación, por lo
  que el sitio se ve idéntico a lo diseñado en todo dispositivo. Las media
  queries por breakpoint solo se generan cuando existen overrides reales.
- El **editor** también es móvil: bajo 820 px los paneles se convierten en
  hojas deslizantes inferiores controladas por una barra táctil
  (`#mobile-nav`), las reglas se ocultan, los tiradores crecen con
  `@media (pointer: coarse)` y el ajuste de zoom es "fit width".
- Breakpoints personalizados = editar dos números del JSON; la cascada y el
  generador de media queries ya los leen de ahí.

---

## FASE 9 — Exportador ZIP

`src/exporter/exporter.js` compila el JSON a un sitio estático real en dos
formatos:

**A) Un solo archivo HTML** (`exportSingle()`): todas las páginas como
secciones con navegación interna (SPA), estilos/scripts inline y multimedia
como dataURL. Autocontenido al 100 %: se abre directamente en un móvil y se
ve exactamente como el diseño original.

**B) ZIP de carpeta de proyecto** (`export()`), con CSS y JS **incrustados en
cada página** (un HTML suelto nunca aparece sin estilos) y la multimedia como
archivos reales:

```
MiProyecto/
├── index.html          ← primera página
├── paginas/*.html      ← resto (slugs desde el nombre)
├── css/style.css       ← posiciones, estilos, media queries, @keyframes
├── js/app.js           ← escala responsive, eventos, vídeo-scroll, GIF pause
├── js/animations.js    ← triggers scroll/click, sliders automáticos
├── js/webgl.js         ← partículas WebGL2 + visor Three.js (solo si hay 3D)
├── assets/{images,gifs,videos,audio,models,fonts}/
├── project.json        ← re-importable en el editor
└── LEEME.txt
```

- Empaquetado con **Blob API + escritor ZIP propio** (`src/utils/zip.js`,
  formato STORE con CRC32, cero dependencias). La interfaz `.file(ruta, datos)`
  es compatible con JSZip: si se quiere compresión DEFLATE basta cambiar el import.
- Solo se incluyen los **assets usados**; los dataURL se decodifican a bytes.
- Rutas relativas correctas a dos profundidades (`assets/…` vs `../assets/…`).
- Respeta `prefers-reduced-motion` y añade `loading="lazy"` en galerías.

---

## FASE 10 — Estructura de archivos

```
/index.html               editor AUTOCONTENIDO (generado; funciona con doble clic)
/dev.html                 entrada de desarrollo (ES Modules; requiere servidor)
/scripts/build.mjs        empaqueta /src + /css → index.html (esbuild)
/css/editor.css           UI del editor
/src
  /editor      main.js · canvasView.js · interactions.js ·
               panels.js · properties.js · drawTool.js
  /components  registry.js          (18 componentes declarativos)
  /renderer    renderer.js          (JSON → DOM, compartido con export)
  /webgl       particles.js (WebGL2 puro) · threeManager.js (Three.js lazy)
  /animations  engine.js            (presets → WAAPI y CSS)
  /assets      assetManager.js      (galería, File API, IndexedDB)
  /exporter    exporter.js          (JSON → sitio + ZIP)
  /storage     projectStore.js (estado+historial) · db.js (IndexedDB) ·
               templates.js (plantilla inicial + bloques prediseñados)
  /utils       helpers.js · zip.js
/docs/ARQUITECTURA.md
```

### Distribución en un solo archivo

`npm run build` empaqueta todos los módulos en un `index.html` autocontenido
(CSS + JS inline, ~170 KB). Motivo: los ES Modules no funcionan sobre
`file://`, así que un usuario que hace doble clic sobre el HTML veía una
página en blanco. El artefacto generado funciona con doble clic, sin
servidor y sin conexión; `dev.html` conserva la versión modular para
desarrollo. Los assets del usuario se incrustan en el `.json` del proyecto
(autocontenido) y se materializan como archivos reales en `assets/…` dentro
del ZIP exportado.

## Render incremental (v4)

`renderPage()` ya no reconstruye la página: calcula una **firma de
contenido** por nodo (`type+props+events+effects`) y solo reconstruye los
nodos cuya firma cambió; mover/estilizar toca únicamente
`left/top/transform`. Los embeds pesados (WebGL, Three.js, iframes de HTML
importado) **sobreviven intactos** entre ediciones — antes se recreaban en
cada commit, lo que causaba tirones y consumo excesivo. El ThreeManager
monta/libera por elemento (`mountEl`/`disposeIn`) y los iframes de HTML
importado van **inertes (sin scripts) durante la edición** y despiertan en
vista previa/export.

## Carpetas de contenido (extensión sin tocar el núcleo)

```
contenido/
  3d/          tus escenas Three.js  → paleta "Mis 3D"
  widgets/     tus widgets HTML+CSS+JS → paleta "Mis widgets"
  animaciones/ tus @keyframes CSS → editor + export
  musica/      tus MP3 locales (la pestaña ♫ apunta aquí por defecto)
  imagenes/    recursos que quieras versionar
```
Cada carpeta tiene un `index.js` con instrucciones: crear un archivo,
añadirlo a la lista y `npm run build`.

## Multi-HTML sin conflictos (v5)

Cada HTML importado vive en un **iframe con srcdoc**: CSS, JavaScript,
variables globales y eventos totalmente aislados entre sí y del editor
(verificado con documentos en conflicto deliberado: cada uno conserva su
propio `window` y estado). En el sitio exportado el documento viaja en
`data-doc` y el runtime lo monta con **carga diferida escalonada**: al
acercarse al viewport (margen 160%) y UN documento por frame — varios HTML
pesados conviven sin picos de CPU ni caídas de FPS.

## Optimizaciones v5

- **Historial coalescido**: las ráfagas de una misma operación (flechas,
  arrastres) comparten un solo snapshot → sin clones del proyecto por
  pulsación y un único deshacer por gesto.
- **Pausa en gesto**: mientras arrastras/redimensionas, todas las
  simulaciones WebGL se pausan (`body.wb-gesturing`) → el gesto tiene el
  frame entero para sí.
- Panel de propiedades/capas con reconstrucción diferida (100 ms tras el
  último cambio): 13 ms/commit en ráfagas con HTML pesado + WebGL.
- Fugas corregidas: listeners de ventana del motor 3D retirados en
  dispose + geometrías/materiales liberados; `setPointerCapture` blindado.

## Rendimiento (aplicado, no prometido)

- `requestAnimationFrame` + throttle en overlay de selección y reglas.
- Durante un drag solo se tocan `left/top/transform` del nodo (sin repintar la
  página); el repintado completo ocurre una vez, en el `commit()` del pointerup.
- Zoom/pan = una transform GPU; render bajo demanda en reglas y guías.
- WebGL: pausa por IntersectionObserver, DPR ≤ 2, `dispose()` de contextos.
- Autosave con debounce; historial acotado a 50 snapshots.
- Export: animaciones en CSS puro, `lazy loading` de imágenes, Three.js solo si
  se usa, `prefers-reduced-motion`.

## Auditoría v7 (táctil premium + cero fugas)

- **Inercia del lienzo**: al soltar un pan con velocidad, fricción
  exponencial (`e^(-dt/300)`) y, en vista previa, rebote elástico contra
  los bordes de la página (muelle + amortiguación, tacto iOS). Se frena
  con un toque, la rueda o al cambiar de página/dispositivo.
- **Deslizar para eliminar** en capas y páginas (táctil): la fila sigue el
  dedo, franja roja de confirmación al 42 % y salida animada; el scroll
  vertical nunca se bloquea (el gesto exige movimiento claramente
  horizontal). Con snackbar «Deshacer» (elemento único reutilizado).
- **Pulsación larga en una capa** = añadirla a la selección múltiple.
- **Doble toque en lienzo vacío** = reencuadrar la página.
- **Ripple «ondas»** como efecto de presión por defecto en botones: un
  único `span` por elemento (pool) reposicionado en cada toque — cero
  nodos nuevos por pulsación. Nuevos presets de animación (`cristal`,
  `elastico`, `resorte`, `ondulacion`, `revelar`, `expandir`, `morph` y
  salidas `colapsar`/`elasticoOut`/`resorteOut`/`revelarOut`) compilables
  a CSS (incluye `clip-path`/`border-radius`/`box-shadow`).
- **Partículas**: modos nuevos `pétalos` y `burbujas` + forma `anillo`
  (SDF en el shader), configurables en vivo como el resto.
- **Fugas eliminadas**: los triggers de animación de la vista previa
  (click/hover/hold/scroll-IO) se registran y se retiran al salir — antes
  cada entrada/salida los duplicaba. Al navegar de página DENTRO de la
  vista previa se revincula todo (efectos, acciones, animaciones, JS de
  página); antes la página destino quedaba muerta.
- **Micro-rendimiento**: tilt 3D acotado a una lectura de layout por
  frame; typewriter libera su intervalo al terminar; `syncSize` solo toca
  el DOM si cambió; filas de listas y tarjetas de assets con
  `content-visibility: auto` (virtualización nativa); miniaturas con
  `loading="lazy"` + `decoding="async"`; vídeo sin autoplay con
  `preload="metadata"`.
- **Decisiones**: `OffscreenCanvas` se evaluó y se descartó para el módulo
  de dibujo (el feedback síncrono en pantalla manda; un worker añade
  latencia sin quitar trabajo real al hilo principal en este caso).
  La división de código en chunks se descartó: el producto ES un único
  `index.html` que funciona con doble clic (file://), y el arranque ya
  difiere el trabajo pesado (lazy de embeds, IO en partículas).
- Accesibilidad: `aria-label` en botones de icono, `prefers-reduced-motion`
  respetado en la interfaz (el contenido del usuario no se toca).

## v8 — Producción móvil (Android / iPhone)

- **PWA a pantalla completa**: `display: fullscreen` (con `display_override`
  a `standalone`), `viewport-fit=cover` y metas de app nativa iOS/Android.
  Sin zoom por gesto ni doble toque (`user-scalable=no` +
  `touch-action: manipulation`), sin pull-to-refresh
  (`overscroll-behavior`), y toda la interfaz respeta las zonas seguras
  (notch / isla dinámica / barra de gestos) con `env(safe-area-inset-*)`.
  Los sitios exportados reciben el mismo tratamiento.
- **Bundle minificado** (esbuild JS+CSS): 372 KB → 251 KB; los runtimes
  compartidos siguen inyectándose con `.toString()` (verificado en la
  batería: los exports funcionan idénticos minificados).
- **Presupuesto de GPU en móvil**: el desenfoque de cristal baja de 28px a
  14px en pantallas táctiles (mitad de coste por frame, misma lectura
  visual a DPI de móvil); `#world` fija su capa con `will-change` para que
  el pan/zoom componga sin repintar.
- **Sensación nativa**: transición del lienzo al cambiar de página
  (fundido ascendente GPU), crossfade editor ↔ vista previa, entrada
  animada del contenido al cambiar de pestaña, rebote del icono activo en
  la barra inferior y objetivos táctiles a ≈44pt en toda la interfaz.
- **YouTube eliminado**: el reproductor acepta canciones subidas,
  `contenido/musica` y URLs de audio directas; los enlaces antiguos de
  vídeo guardados en proyectos se sanean a estado vacío (sin iframes de
  terceros en los sitios exportados).

## v9 — Caza de glitches y del jank real (verificado A/B)

Auditoría dirigida a lo que se SIENTE en un teléfono de verdad, con
comparativa intercalada contra la versión anterior en el mismo entorno:

- **Huella visual por nodo en `syncNodeEl`**: cada commit reescribía y
  re-parseaba los estilos en línea de TODOS los nodos de la página
  (impuesto fijo que crecía con el proyecto). Ahora, si la huella
  (frame+styles+flags) no cambió, no se toca el DOM. Medido intercalado:
  **de 16–24 ms/commit a 11–12 ms/commit** con 3 HTML + WebGL vivos.
- **Fondo del editor estático**: la "luz líquida" en movimiento perpetuo
  obligaba a topbar/hojas/barra inferior (con backdrop-filter) a
  re-desenfocar cada frame para siempre → GPU ocupada, calor y tirones
  en reposo. Fuera la animación; mismos degradados.
- **`will-change` retirado de `#world`**: fijaba TODA la página en una
  textura GPU gigante y dejaba el texto borroso tras el zoom.
- **`content-visibility` retirado de filas/tarjetas**: en Chrome Android
  hacía parpadear y saltar las listas dentro de hojas con blur.
- **Quickbar sin parpadeo**: ya no se reconstruye en cada tick de
  pan/zoom (las cajas viven dentro de #world y se mueven gratis por
  transform) y su animación de entrada solo se reproduce cuando CAMBIA
  la selección, no en cada refresco de edición.
- **Etiqueta y quickbar siempre derechas**: sobre nodos rotados (las
  polaroids lo están) se renderizaban inclinadas; ahora viven en un
  anclaje sin rotación separado de la caja con tiradores.
- **Brillo por letra componible**: `wb-fx-brillo` animaba `text-shadow`
  por letra (repintado continuo del titular); ahora la sombra es
  estática y pulsa la opacidad (composición GPU, mismo look).
- **Topes táctiles en partículas**: máx. 320 por sistema y DPR 1.25 en
  aurora/ondas (shader por píxel) en móvil — visualmente indistinguible.
- **Plantilla**: el cielo de estrellitas pasa de un 2º sistema WebGL a un
  tile SVG cacheado (un blit al pintar, cero coste por frame); quedan
  2 sistemas de partículas en la página inicial, nunca simultáneos en
  pantalla gracias al IntersectionObserver.
- Reglas del lienzo: no se dibujan cuando están ocultas (móvil); scroll
  de hojas con inercia nativa y `overscroll-behavior: contain`.

## v10 — Editor de nivel comercial

- **Escalado inteligente**: redimensionar desde una ESQUINA escala el
  contenido interior (tipografía, radio, borde) con factor geométrico
  `√(áreaNueva/áreaVieja)`; los tiradores laterales hacen reflow puro y
  Alt desactiva el acompañamiento. Deshacer restaura tamaño y estilos.
- **Música robusta**: volumen por pista, loop, fade in/out (rampa por
  rAF con clamp — los timestamps de rAF pueden preceder a
  `performance.now()` y producían volúmenes negativos), lista de
  reproducción con anterior/siguiente y auto-avance, autoplay con
  desbloqueo en el primer gesto (política móvil), reintento único al
  fallar la carga y estado de error visible en el propio reproductor.
- **Panel Avanzado** en todos los elementos: mezcla con el fondo
  (mix-blend-mode), desenfoque/brillo/contraste/saturación/tono/grises/
  sepia (filter), inclinación X/Y (skew en el transform, también en los
  breakpoints del export), sombra CSS propia, transformar texto,
  desbordamiento y z-index. Mismo CSS compartido editor/export.
- **Pantalla y resolución**: ancho de lienzo editable por dispositivo,
  presets rápidos (teléfono/tablet/portátil/TV, vertical y horizontal)
  y botón de giro de orientación con pares retrato↔paisaje.
- **Frecuencia configurable** (auto/30/60/90/120/144/165/240 Hz):
  `window.WB_FPS` limita el DIBUJO de los WebGL (la simulación sigue en
  dt → misma velocidad); se exporta con el proyecto.
- **Modo Pixel Art por página**: `image-rendering: pixelated` en lienzo
  y export (clase `wb-pixel` en el stage).
- **Estilos de proyecto**: 8 estéticas de un toque (Pixel Art,
  Minimalista, Glassmorphism, Neomorphism, iOS, Material, Cyberpunk,
  Terminal) que fijan el fondo de página y añaden una portada coherente.
- **Distribución automática** (3+ seleccionados, espaciado uniforme),
  historial a 200 pasos (coalescido), buscador en la paleta de Piezas
  (bloques, estilos y componentes) e icono PWA nuevo.

## v11 — Interfaz reconstruida (pastel, móvil primero)

Reconstrucción completa de la **capa visual** sin tocar el modelo de
datos ni el comportamiento: todo proyecto guardado sigue abriéndose
igual y ninguna función desapareció (hay una suite que lo verifica).

- **Sistema de diseño por tokens**: una sola paleta en `:root` (crema,
  rosa y menta sobre superficies blancas, sombras muy ligeras, esquinas
  generosas). Los temas *Claro · Oscuro · Baddie · Pixel Art* y las ocho
  paletas pastel solo redefinen variables — cero reglas duplicadas.
  El tema Pixel Art va en serio: esquinas rectas, sombras duras
  desplazadas, bordes de 2 px, monoespaciada y `steps()` en las curvas.
- **Shell de una mano**: la barra superior guarda solo lo que se usa a
  cada minuto (deshacer, rehacer, zoom, Vista previa) y el resto vive en
  la hoja **"Más"** (dispositivo, dibujar, importar, guardar, HTML, ZIP,
  nuevo). Las acciones se declaran UNA vez y se pintan en los dos sitios
  según el ancho, así que no hay lógica duplicada.
- **Barra rápida fuera del lienzo**: antes vivía dentro de `#world` y
  heredaba el zoom (al 30 % se salía de la pantalla y el navegador la
  recortaba). Ahora se monta en un host fijo: en el teléfono es una
  barra inferior siempre completa; en pantalla ancha flota junto al
  elemento, acotada al viewport.
- **Una sola capa a la vez**: cualquier hoja que se abre cierra las
  demás (`wb:close-sheets`), y el FAB se aparta cuando hay una hoja
  abierta o un elemento seleccionado (manda la barra contextual).
- **Online Assets**: recursos remotos por URL que se descargan una vez,
  se cachean en IndexedDB como cualquier recurso local (funcionan sin
  conexión), se pueden actualizar y se exportan en `assets/online assets/`.
- **Rotación con imán**: cerca de 0/45/90/135° engancha sola (±3°) —
  con el dedo es casi imposible clavar un ángulo recto a pulso.
- **Limpieza**: imports muertos fuera, `animationCSS`/`exitAnimationCSS`
  como única fuente de la propiedad `animation` (el exportador la
  duplicaba línea a línea) y CSS sin reglas huérfanas.

### Biblioteca de assets: tamaño cómodo + scroll honrado

El panel de Assets enterraba lo importante: para ver una sola miniatura
había que pasar por el botón de subir, el buscador, **ocho filtros en
tres filas** y el bloque entero de Online Assets. Las miniaturas medían
84 px de alto y se recortaban con `cover`.

- **El contenido manda**: la biblioteca sube justo debajo de una fila de
  acciones compacta; *Online assets* baja a un bloque plegable al final.
- **Filtros en una sola fila** que se desplaza con el dedo
  (`overscroll-behavior-x: contain`, sin barra visible).
- **Miniaturas grandes en 4:3 con `object-fit: contain`**: una foto
  vertical, cuadrada o panorámica se ve ENTERA — ni recorte ni
  deformación. 164–183 px en teléfono, 220 px en tablet (3 columnas),
  147 px en el panel de escritorio (ensanchado a 300/320 px, y a
  340/360 px por encima de 1400 px).
- **La hoja pasa de 60 vh a 78 vh**: se aprovecha la pantalla en vez de
  encoger las piezas para que "quepa todo".
- **Scroll honrado**: `touch-action: pan-y` (un arrastre casi vertical
  nunca se desvía), `overscroll-behavior: contain` (no arrastra el
  lienzo al llegar al tope), `scrollbar-gutter: stable` (sin saltos de
  layout) y espacio inferior para que la última fila no quede pegada a
  la barra.
- La paleta de piezas pasa de 4 columnas apretadas a 3 cómodas
  (celdas de 104 px mínimo, 94 px de alto) y los bloques a 58 px.

### Escala del contenido y gestos táctiles (v12)

**Control de escala (barra vertical).** En *Posición y tamaño* hay un
deslizador vertical: arriba agranda, abajo reduce. No es un zoom
visual — `store.scaleSelection(factor)` reescribe los valores REALES
del proyecto, así que lo exportado sale idéntico:

- marco (x, y, ancho, alto) y, con varios elementos seleccionados,
  también **la separación entre ellos** respecto al centro del grupo:
  la composición no se desarma;
- el interior mediante `scaleInnerStyles()`: tipografía, interlineado,
  espaciado entre letras, radios, bordes, relleno, separación y las
  longitudes en píxeles de una sombra CSS propia.

El mando vuelve al centro al soltar (se puede seguir escalando sin
topar con un extremo) y todo el gesto se coalesce en **un solo paso de
deshacer**. Botones de ±10 % para ajustes exactos y con teclado.

**Escala de la interfaz por tokens.** `--fs-*`, `--ctrl*`, `--ic*` y
`--gap` mandan sobre tipografía, altura de controles e iconos: subir la
escala es tocar `:root`, no cien reglas sueltas. Los iconos heredan su
tamaño del token (`ic()` sin argumento) y llevan trazo de 2,2 px con
esquinas generosas.

**Gestos separados por intención (primera versión).** Antes, un dedo
sobre un elemento empezaba a moverlo de inmediato: al recorrer la
página se arrastraba sin querer todo lo que rozaba. La v12 lo resolvió
para los elementos **no** seleccionados, pero el que ya estaba
seleccionado seguía escapándose. La regla definitiva está en v13.

**Compacto por ancho O por alto.** El layout de hojas ya no depende
solo de `max-width: 820px`: un teléfono tumbado es ancho pero bajo, así
que la condición es `(max-width: 820px), (max-height: 540px)` — la
misma que usa `#placeQuickbar` en JS. En horizontal las barras
adelgazan y la miniatura pasa a 16:10. Verificado en iPhone SE/12/15
Pro Max, Galaxy A14/S24+, Pixel 8, iPad mini y ambas orientaciones.

## v13 — Página de edición reconstruida

La v12 ya era pastel y táctil, pero seguía siendo **una interfaz de
escritorio encogida**: la barra de acciones era una fila de iconos de
20 px sin nombre, y al recorrer la página con el dedo las piezas ya
seleccionadas se escapaban. La v13 rehace la página de edición desde
la base: tamaños pensados para el pulgar, no reducidos para que quepan.

### El desplazamiento SIEMPRE gana

La regla es una sola y no tiene excepciones táctiles: **el dedo que se
mueve desplaza la página, nunca la pieza** — da igual si la pieza está
seleccionada o no. Sobre un elemento, `#onDown` no inicia un arrastre:
abre un gesto `pan` con un temporizador de intención.

| Gesto (dedo) | Resultado |
|---|---|
| deslizar sobre cualquier pieza | desplazar la página; la pieza no se mueve ni un píxel |
| levantar sin recorrido | seleccionar |
| mantener quieto 380 ms (160 ms si ya está seleccionada) | modo mover + háptico |
| arrastrar desde el **asa de mover** | mover desde el primer píxel |
| tirador del marco | redimensionar o rotar al instante |

El temporizador se cancela en cuanto el dedo recorre 6 px, así que
recorrer la página nunca acaba en modo mover. El umbral de movimiento
(7 px con el dedo, 2 px con ratón) sigue absorbiendo el temblor de la
mano. Con **ratón** se conserva el arrastre directo de toda la vida:
ahí no hay ambigüedad que resolver.

Para que la vía inmediata exista sin reintroducir el problema, el marco
de selección estrena un **asa de mover** central de 52 px (`.handle
.h-move`): tocarla es una intención inequívoca, así que arrastra sin
esperas. Necesita doble clase en el CSS para ganarle a la regla de
`@media (pointer: coarse)` que encoge los tiradores.

### Barra de edición: una barra de app, no una fila de iconos

`#buildQuickbar` se reescribió sobre un constructor `boton({icon,
label, title, onclick, cls, activo})` y separadores. Ocho acciones
—Editar · Duplicar · Copiar | Al frente · Al fondo | Bloquear ·
Ocultar | Eliminar— con **icono de 26 px Y etiqueta**, 76 × 72 px por
botón y estados visibles: `principal` (degradado) para Editar,
`activo` para bloqueado/oculto, `peligro` para Eliminar.

En el teléfono es una barra inferior fija y completa; en pantalla ancha
flota junto al elemento. Cuando las ocho no caben, la fila se desplaza
lateralmente con `scroll-snap` y el borde por el que queda algo más se
**difumina** (`.mas-izq` / `.mas-der`, alternadas por un listener
pasivo): se ve que hay más herramientas sin ocupar sitio con flechas.
Si caben todas, no se difumina nada — la pista nunca miente.

### Tamaños desde la base, no por zoom

Los tokens de `:root` subieron de golpe y con ellos toda la interfaz,
porque nada mide en píxeles sueltos:

```css
--fs: 16px;  --fs-lg: 21px;          /* texto */
--ctrl: 54px; --ctrl-lg: 60px;       /* alto de control */
--ic: 24px;  --ic-lg: 27px;          /* iconos */
--topbar-h: 66px; --nav-h: 74px;     /* barras */
```

Medido en iPhone 12: botón de la barra de edición 72 px, icono 26 px,
asa de mover 52 px, botón de navegación 73 px, botón superior 54 px.
Ningún destino táctil baja de 44 px.

Cuando algo no cabe, **se desplaza; no se encoge**: la biblioteca crece
hacia abajo con tarjetas de 164–183 px, la barra de edición se desplaza
en horizontal y el inspector es una hoja con scroll propio. En
escritorio los paneles laterales son anchos a propósito (324 px / 344 px,
364 px / 400 px en monitores grandes) para que las tarjetas de assets
mantengan el mismo tamaño cómodo que en el móvil.

### Jerarquía visual

El orden de peso es literal y se lee sin pensar: contenido → pieza
seleccionada (marco rosa + asa) → controles de la pieza (barra inferior
con etiquetas) → herramientas de edición (hoja de Diseño) → opciones
secundarias (secciones plegadas, hoja «Más»). Un solo elemento lleva
degradado por pantalla, y es siempre la acción principal.

## v14 — Solo móvil y tablet, y a 60 fps de verdad

La v13 ya era táctil, pero seguía arrastrando una capa de escritorio
entera (rejilla de tres columnas, reglas, ramas `only-wide`) y, sobre
todo, un fallo de rendimiento que se comía la mitad de los fotogramas.

### El fallo que costaba 45 fps

Los fondos de partículas dimensionaban su lienzo con `clientWidth`,
que es el tamaño de MAQUETA e ignora las transformaciones. Un fondo de
1280 px dentro del editor al 29 % de zoom se ve a 390 px reales... y se
dibujaba a **2560 x 1640 = 4,2 megapíxeles**. Doce veces más de lo que
la pantalla podía enseñar, sesenta veces por segundo y con mezcla
aditiva. Medido con la CPU frenada x4 (gama media), el editor en
reposo iba a **15 fps**.

`getBoundingClientRect()` sí incluye las transformaciones: da el tamaño
REAL en pantalla, tanto en el editor (zoom del lienzo) como en el sitio
exportado (escalado de `wbFit`). Con eso, un techo de megapíxeles y una
revisión del rectángulo dos veces por segundo (el zoom es una
transformación: no dispara `ResizeObserver`), el mismo editor pasa a
**16,7 ms por fotograma — 60 fps clavados — incluso con la CPU a x4**.

Dos consecuencias que hubo que corregir a la vez:

- El **tamaño y la velocidad** de las partículas iban atados al `dpr`.
  Al bajar la resolución se quedaban del mismo tamaño en píxeles y
  salían gigantes y disparadas. Ahora se miden en `densidad` =
  píxeles de lienzo por píxel de DISEÑO: un corazón mide lo que mide
  dentro de la página, no dentro de la pantalla de quien mira.
- Un cambio grande de tamaño deja partículas fuera del lienzo. Las que
  dan la vuelta vuelven solas; las fijas (estrellas) no volverían
  jamás, así que se **resiembran** cuando el cambio es de verdad.

Las escenas de Three.js tenían exactamente el mismo problema
(`setPixelRatio` sobre el tamaño de maqueta) y el mismo arreglo.

### El marco de selección ya no se reconstruye por frame

Arrastrar, escalar o girar dispara un `change` por fotograma, y el
marco se rehacía entero: doce divs (uno con SVG dentro) más la barra
de edición completa, creados y tirados sesenta veces por segundo.

Ahora hay dos vías. Si la selección cambió, se construye. Si es la
misma, solo se **mueve** lo que ya está puesto —y ni eso cuando las
medidas no han cambiado—. Medido: **0 nodos creados** durante un
arrastre de sesenta pasos, frente a los cientos de antes.

### Fuera el escritorio

- La rejilla de tres columnas, los paneles laterales fijos y las reglas
  (con sus dos `<canvas>` y su repintado por frame) ya no existen.
- Las ramas `only-wide` / `only-narrow` desaparecen: una sola barra
  superior con lo de cada minuto —deshacer, rehacer, Previa y «Más»—
  y el zoom como píldora flotante sobre el lienzo.
- La barra de edición es SIEMPRE una barra inferior fija: la coloca el
  CSS. Ya no hay variante flotante que recolocar por JS en cada gesto,
  ni un `getBoundingClientRect` por frame al hacer zoom.
- El selector de tamaños del proyecto pasa a **Base · Tablet · Móvil**
  (la clave interna `desktop` se conserva por compatibilidad con los
  proyectos ya guardados: es donde viven los estilos base), y los
  tamaños rápidos son solo de teléfono y tablet.
- **Tablet no es otra interfaz**: la misma, con más aire. Las hojas se
  centran y se ensanchan, las rejillas ganan columnas y los bloques
  pasan a dos columnas. Nunca aparece una barra lateral.

### Cero desenfoques de fondo

`backdrop-filter` cuesta un pase de GPU por fotograma y en un teléfono
se nota. Se ha eliminado de toda la interfaz: las superficies son casi
opacas y se ven mejor. En los componentes del sitio se quitaron los dos
que eran invisibles a simple vista pero permanentes (las fichas del
contador y la tapa del mensaje oculto); el mensaje flotante estilo iOS
lo conserva porque ahí SÍ se ve y dura un segundo.

La transición de página «desenfoque» animaba `filter: blur(16px)` a
pantalla completa. Ahora son 12 px con un pelín de escala: se lee igual
de bien (o mejor, parece que la página enfoca) por bastante menos.

### Tres niveles de superficie

El rediseño se apoya en una regla que no admite excepciones:

| nivel | qué es | color |
|---|---|---|
| 0 | la hoja | `--surface-2` (tinte suave) |
| 1 | tarjetas, secciones, campos | `--surface` (blanco) |
| 2 | lo que vive dentro de una tarjeta | `--surface-2` otra vez |

Campos y botones alternan con el nivel en que caen. Verificado por
prueba automática: **cero controles del mismo color que su fondo**, en
los cuatro temas y las ocho paletas.

### Bugs de verdad que salieron a la luz

- **La libreta de dibujo no recibía un solo trazo.** `#draw-layer` era
  `pointer-events: none` y la clase `.active` que le pone el JS no
  tenía ninguna regla CSS detrás. Se dibujaba en el vacío. (Las pruebas
  con `dispatchEvent` no lo detectaban porque los eventos sintéticos no
  hacen hit-testing: hizo falta entrada real.)
- **Arrastrar una hoja para cerrarla la descolocaba en tablet.** El
  gesto escribía `transform` entero y borraba el centrado horizontal.
  Ahora el arrastre va en su propia variable, `--arrastre`.
- **El selector de color se abría fuera de la pantalla.** Su tamaño
  estaba escrito a mano (236x380) y había dejado de coincidir con el
  CSS; encima se medía con `getBoundingClientRect` durante la animación
  de entrada, así que medía el fotograma y no la caja. Ahora usa
  `offsetWidth/Height` y un recorte final al viewport.
- **«Dibujar» dejaba la hoja «Más» tapando el lienzo**, porque cerraba
  solo los paneles. Cerrar significa cerrar TODO.
- **La pieza «Texto» pedía un icono `'T'` que no existe** y caía en el
  comodín: salía una estrellita genérica en la paleta.
- Las **estrellas desaparecían** al girar el teléfono (partículas fijas
  fuera del nuevo lienzo, sin resembrado).

### Lo que se midió

Con la CPU frenada x4 (gama media) en un iPhone 12 emulado:

| escena | antes | después |
|---|---|---|
| editor en reposo | 50–67 ms/frame | 16,7 ms |
| desplazar el lienzo | p95 66,7 ms | p95 16,8 ms |
| arrastrar una pieza | cientos de nodos/s | 0 nodos creados |
| sitio exportado | 4,2 Mpx por fondo | 0,39 Mpx |

Veinte ciclos de uso intenso (añadir, escalar, duplicar, borrar,
cambiar de página, abrir y cerrar hojas, deshacer y rehacer): heap
plano, contextos WebGL estables, cero errores de consola.

### Trampas aprendidas (para no repetirlas)

- `overflow: hidden` en un hijo flexible **desactiva** la protección
  `min-height: auto`: las secciones del inspector se aplastaban y
  recortaban su contenido. Se arregla con `flex: none` en los hijos.
- Un `position: fixed` heredado de un ancestro transformado NO se ancla
  al viewport: por eso la barra rápida tenía que salir de `#world`.
- Un campo con el mismo relleno que su tarjeta es un campo invisible:
  dentro de superficies suaves los `.input` se visten de blanco.
- Una regla de `@media (pointer: coarse)` sobre `.handle` gana a
  `.h-move` por orden de cascada: el asa de mover necesita **doble
  clase** (`.handle.h-move`) para conservar sus 52 px en el móvil,
  justo donde más falta hacen.
- Un imán angular de ±3° es demasiado fino para un asa grande movida a
  pulso; con ±5° los ángulos rectos se clavan solos sin impedir los
  intermedios.
- `clientWidth` es el tamaño de MAQUETA: ignora las transformaciones.
  Para saber cuántos píxeles hacen falta de verdad —lienzos WebGL,
  Three.js, cualquier cosa que se dibuje— el bueno es
  `getBoundingClientRect()`.
- Un `dispatchEvent` sintético NO hace hit-testing: atraviesa
  `pointer-events: none` como si nada. Una prueba así puede dar verde
  sobre un control que en el móvil no responde.
- `getBoundingClientRect()` incluye las transformaciones, y eso muerde
  al medir algo que está entrando con una animación de escala: devuelve
  el fotograma, no la caja. Para maquetar, `offsetWidth/offsetHeight`.
- Escribir `transform` entero desde JS borra lo que el CSS había puesto
  ahí. Si una capa combina centrado y gesto, cada cosa en su variable.

## Hoja de ruta natural

1. **Colaboración**: el JSON puro encaja directo con Yjs/CRDT.
2. **Plantillas**: un proyecto JSON guardado *es* una plantilla (importar/exportar ya existe).
3. **Anidamiento real** de nodos (el modelo ya reserva `parent`).
4. **Timeline multi-keyframe**: los presets son arrays de keyframes; la UI de
   timeline solo tiene que editarlos.
5. **Backend**: `ProjectStore.persist()` es el único punto a tocar para guardar
   en un servidor (REST/WebSocket) en lugar de localStorage.
