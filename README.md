# ◆ Amor Builder — Creador de Experiencias Románticas

**Interfaz Liquid Glass** en blancos y negros con tipografía bold, y
**motor de render incremental**: edita proyectos con decenas de elementos,
HTML importado, 3D y partículas sin tirones — solo se reconstruye lo que
cambia, y los iframes/WebGL sobreviven intactos entre ediciones.

**Carpetas de contenido propias** (`contenido/`): suelta tus escenas 3D,
widgets HTML+CSS+JS, @keyframes y MP3 en sus carpetas y aparecen en el
editor listos para arrastrar — sin tocar el núcleo.

Un Website Builder visual avanzado enfocado en **experiencias románticas**:
páginas de amor, regalos virtuales, cartas interactivas, recuerdos y momentos
especiales — con movimiento, interacción y personalidad. Sin escribir código
(pero con libertad total para añadir el tuyo).

## Ejecutar — solo doble clic

**Abre `index.html` con doble clic. Ya está.** Sin servidor, sin instalar
nada. El editor arranca con una **experiencia romántica completa** lista para
personalizar: portada con corazones y estrellas, dedicatoria a máquina de
escribir, carta que se abre, línea de tiempo de recuerdos, contador de días
juntos, fotos polaroid con tilt 3D, mensaje secreto y vuestra canción.

### Para desarrolladores

```bash
npm install
npm run build     # regenera index.html desde /src y /css
npm run dev       # sirve dev.html (ES Modules) en localhost:8080
```

## Qué puedes crear

### 💘 Componentes románticos
Carta interactiva que se abre al tocarla · línea de tiempo de recuerdos ·
mensaje oculto que se revela · botón que estalla en corazones · texto máquina
de escribir · contador de amor (días/horas/min/seg juntos o cuenta atrás) ·
fotos polaroid · elementos flotantes (emojis) · **corazón 3D** (Three.js) ·
**foto con profundidad 3D** · gradientes animados · reproductor de música.

### ✨ Fondos dinámicos (WebGL2 nativo, shaders propios)
Corazones (con forma real por SDF) · nieve · estrellas titilantes ·
luciérnagas · aurora · ondas de agua · nebulosa · lluvia · órbita. Simulación
por tiempo real: idéntica velocidad y máxima fluidez a 60/90/120/144/165 Hz.

### 🎬 Animaciones y transiciones
26 presets de entrada (latido, tada, flip 3D, giro 3D, brillo, caída…) con
triggers al cargar / scroll / tocar / **mantener presionado** / hover, y
**8 animaciones de salida** (disolver, zoomOut, flipOut…) que se reproducen
automáticamente cuando una acción oculta el elemento. Letras animadas (olas, saltos,
brillo, arcoíris). Brillos de texto (neón, rosa, dorado, fuego, hielo).
Efectos por elemento: **parallax al scroll** y **tilt 3D** táctil.
Transiciones de página cinematográficas: círculo mágico, cortina, giro 3D,
ascenso, **lluvia de corazones**, polvo de estrellas, nevada — con duración
configurable.

### 🧠 Lógica visual (cualquier elemento es interactivo)
Cada elemento —imagen, texto, fondo, vídeo, 3D…— acepta eventos con
**cadenas de acciones** y retardos: *"al tocar este botón → aparece una foto,
cambia el fondo, suena una canción y estallan corazones"*. Disparadores:
tocar, doble toque, **mantener presionado**, pasar el cursor, **deslizar**,
aparecer en pantalla. Acciones: ir a página, mostrar/ocultar, animar,
reproducir/detener sonidos, cambiar texto/estilo/fondo, estallido de
corazones, **mensajes flotantes estilo iOS**, **vibración móvil**, abrir URL
y **ejecutar JavaScript propio**. Además, casi todo componente nace ya con
una animación de entrada y micro-interacciones al tocar.

Bloques con lógica precableada listos para usar: **La gran pregunta (Sí/No)**
con celebración de corazones, **Cupones de amor** canjeables manteniendo
presionado, y **Razones por las que te amo** con tarjetas 3D interactivas.

### 📱 Táctil sin complicaciones (interfaz estilo iOS)
Interfaz rediseñada con estética iPhone: cristal esmerilado, píldoras,
control segmentado y barra de pestañas iOS. **Un dedo** sobre el lienzo
vacío desplaza; sobre un elemento, lo mueve. **Dos dedos** siempre
desplazan y hacen zoom (pinch), también en vista previa — y los toques
llegan limpios a cartas, botones y secretos.

### 🧩 Extensión con tu propio código
- Componente **"3D personalizado"**: pega código Three.js (recibe `THREE`,
  `scene`, `camera`, `pivot`, `renderer`, `GLTFLoader`) y devuelve un
  `update(dt)` opcional — tu escena corre en el editor y en el export.
- Componente **"Código personalizado"**: HTML + CSS + JS dentro de un elemento.
- **CSS/JS global** del proyecto y **por página** (nuevas animaciones, fondos,
  partículas, efectos Canvas/WebGL...).
- El export de 1 archivo **incrusta el proyecto** (`#wb-project`): puedes
  editar el HTML a mano añadiendo `<style class="custom">` o
  `<script class="custom">` y al **re-importarlo** el editor los detecta y
  los integra automáticamente.
- **Fuentes propias**: sube .ttf/.woff2 desde Assets y aparecen en el
  selector de fuentes (y en el sitio exportado).

### 🎵 Pestaña de Música (tu repositorio de GitHub)
Sube tus MP3 a GitHub y edita **un solo archivo** para conectarlos:
`src/config/musicLibrary.js` — ahí cambias `MUSIC_REPO_BASE` (tu
usuario/repo) y los nombres (`musica1.mp3`, `musica2.mp3`…). La pestaña ♫
te deja escucharlas y añadirlas con un toque. El reproductor tiene disco
giratorio y **ecualizador animado** que solo se mueven mientras suena.

### 👆 Efectos de interacción (biblioteca)
Cada elemento elige su respuesta **al tocar** (escala, rebote, brillo,
latido, sacudida, hundir, chispas ✨ con háptico) y **al pasar el cursor**
(elevar con sombra, zoom, brillo, flotar, girar) — sin programar, desde
el panel de Efectos.

### ⇢ Botones de navegación personalizables
Componente propio con destino **página siguiente / anterior** (circular) o
una página concreta, 5 estilos (píldora, fantasma, neón, burbuja, flecha),
flecha animada opcional y todos los estilos/animaciones/acciones de
cualquier elemento. `__next` y `__prev` también están disponibles en la
acción "Ir a página" de cualquier objeto.

### 🌐 Importar HTML completo como objeto
Sube cualquier página `.html` (pestaña Assets o botón Importar) y se
convierte en un **objeto del lienzo**: se renderiza en un **viewport
virtual** del ancho para el que fue diseñada (configurable) y se **escala
proporcionalmente en tiempo real** al redimensionarla — sin deformarse ni
perder calidad. Botones, formularios, enlaces, scroll y scripts funcionan
**exactamente como en un navegador independiente** (en vista previa y en el
sitio exportado; mientras editas va inerte para no consumir recursos, con
opción "activo al editar"). Los iframes sobreviven a las ediciones sin
recargarse jamás.

### 📓 Libreta digital romántica (módulo de dibujo)
Dibuja con el dedo **viendo el trazo en tiempo real** (corregido el retraso
de Android): 5 pinceles (pluma, lápiz, marcador, **neón**, **corazones** que
estampan 💗), 8 texturas de papel, **deshacer y rehacer** por trazo, inserta
**fotografías de tu galería** dentro del dibujo, descarga la hoja en PNG o
conviértela en un componente reutilizable.

### 💌 Cartas personalizadas
La carta interactiva ahora acepta **foto dentro**, **sonido al abrirse**,
estallido de corazones, color del sobre (gradientes), papel y tinta — con
su animación 3D de apertura.

### 📲 PWA instalable
El editor y el **sitio exportado en ZIP** incluyen manifest + service
worker: se instalan como app en el móvil y funcionan sin conexión una vez
publicados (GitHub Pages, Netlify…).

### 📤 Exportación (multimedia garantizada)
- **📱 HTML (1 archivo)**: todo el sitio —páginas, GIFs, vídeos, audio,
  fuentes, efectos— en un único archivo autocontenido con navegación interna.
  Se abre en cualquier móvil y se ve EXACTO al editor.
- **⬇ Sitio (.zip)**: cada página lleva CSS/JS/multimedia incrustados (nunca
  se ve rota, ni abriendo un HTML suelto) + carpeta `assets/` organizada
  (gifs, imágenes, vídeos, audio, modelos, fuentes) + `project.json`
  re-importable. Lista para Netlify/Vercel/GitHub Pages.

El sitio exportado ejecuta **los mismos runtimes que el editor** (se inyectan
con `Function.toString()`): cero divergencia entre lo que diseñas y lo que
compartes.

## Arquitectura

Documentación técnica en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

```
Editor visual → ProjectStore (JSON) → Renderer compartido
     ├─ /runtime  wbParticles · wbEffects · wbActions  ← LOS MISMOS
     │            corren en el editor y se inyectan en el export
     ├─ Animaciones (WAAPI ↔ @keyframes CSS)
     ├─ Three.js lazy (GLB, corazón 3D, foto con profundidad)
     ├─ Asset Manager (IndexedDB, fuentes, galería del móvil)
     └─ Exportador (ZIP con carpeta assets/ · HTML de 1 archivo)
```

## Atajos

| | |
|---|---|
| Ctrl+Z / Ctrl+Y | deshacer / rehacer |
| Ctrl+C / V / D | copiar / pegar / duplicar |
| Ctrl+Shift+C / V | copiar / pegar estilo |
| Supr · Flechas | eliminar · mover (Shift ×10) |
| Ctrl+rueda · Espacio+arrastrar | zoom · pan |
| Doble clic en texto | editar inline |
