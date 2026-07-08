# ◆ Creador de Experiencias Románticas Digitales

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
26 presets (latido, tada, flip 3D, giro 3D, brillo, caída, respirar…) con
triggers al cargar / scroll / clic / hover. Letras animadas (olas, saltos,
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
corazones, **vibración móvil**, abrir URL y **ejecutar JavaScript propio**.

### 🧩 Extensión con tu propio código
- Componente **"Código personalizado"**: HTML + CSS + JS dentro de un elemento.
- **CSS/JS global** del proyecto y **por página** (nuevas animaciones, fondos,
  partículas, efectos Canvas/WebGL...).
- El export de 1 archivo **incrusta el proyecto** (`#wb-project`): puedes
  editar el HTML a mano añadiendo `<style class="custom">` o
  `<script class="custom">` y al **re-importarlo** el editor los detecta y
  los integra automáticamente.
- **Fuentes propias**: sube .ttf/.woff2 desde Assets y aparecen en el
  selector de fuentes (y en el sitio exportado).

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
