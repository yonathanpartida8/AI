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

## Rendimiento (aplicado, no prometido)

- `requestAnimationFrame` + throttle en overlay de selección y reglas.
- Durante un drag solo se tocan `left/top/transform` del nodo (sin repintar la
  página); el repintado completo ocurre una vez, en el `commit()` del pointerup.
- Zoom/pan = una transform GPU; render bajo demanda en reglas y guías.
- WebGL: pausa por IntersectionObserver, DPR ≤ 2, `dispose()` de contextos.
- Autosave con debounce; historial acotado a 50 snapshots.
- Export: animaciones en CSS puro, `lazy loading` de imágenes, Three.js solo si
  se usa, `prefers-reduced-motion`.

## Hoja de ruta natural

1. **Colaboración**: el JSON puro encaja directo con Yjs/CRDT.
2. **Plantillas**: un proyecto JSON guardado *es* una plantilla (importar/exportar ya existe).
3. **Anidamiento real** de nodos (el modelo ya reserva `parent`).
4. **Timeline multi-keyframe**: los presets son arrays de keyframes; la UI de
   timeline solo tiene que editarlos.
5. **Backend**: `ProjectStore.persist()` es el único punto a tocar para guardar
   en un servidor (REST/WebSocket) en lugar de localStorage.
