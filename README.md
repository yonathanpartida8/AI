# BuilderYNTHN_M-Beta — Creador de Experiencias Románticas

**Una app de móvil y tablet, no una web adaptada.** Aquí no hay versión
de escritorio ni modo oscuro: una sola piel clara y pastel, pensada
para el pulgar, que en tablet respira más en vez de convertirse en otra
cosa. Dos colores mandan a partes iguales — **🎀 rosa** para lo que
eliges y **🍃 verde** para lo que ya está bien.

**60 fps de verdad, también en un teléfono modesto.** Medido con la CPU
frenada a un cuarto: 16,7 ms por fotograma en reposo, desplazando el
lienzo, con una hoja abierta y arrastrando una pieza. Cero desenfoques
de fondo, cero nodos creados durante un arrastre y **motor de render
incremental**: solo se reconstruye lo que cambia, y los iframes/WebGL
sobreviven intactos entre ediciones.

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
Corazones (con forma real por SDF) · **pétalos que caen** · **burbujas** ·
nieve · estrellas titilantes · luciérnagas · aurora · ondas de agua ·
nebulosa · lluvia · órbita. Color, cantidad, tamaño, velocidad, opacidad,
forma (disco/corazón/estrella/**anillo**) y brillo configurables **en vivo**.
Simulación por tiempo real: idéntica velocidad y máxima fluidez a
60/90/120/144/165 Hz.

### 🎬 Animaciones y transiciones
33 presets de entrada (latido, tada, flip 3D, **elástico**, **resorte**,
**cristal**, **ondulación**, **revelar**, **expandir**, **morph**, brillo,
caída…) con triggers al cargar / scroll / tocar / **mantener presionado** /
hover, y **12 animaciones de salida** (disolver, colapsar, resorte,
revelar…) que se reproducen automáticamente cuando una acción oculta el
elemento. Letras animadas (olas, saltos,
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

### 📱 Solo móvil y tablet, hecha para el pulgar
Estética suave —crema, rosa y menta sobre tarjetas blancas— con sombras
cortas, esquinas generosas y animaciones que nunca pasan de un tercio
de segundo. Los tamaños están pensados para el dedo desde la base:
ningún botón baja de 44 px, y cuando algo no cabe **se desplaza, no se
encoge**. La barra superior deja a la vista solo lo de cada minuto
(deshacer, rehacer y **Previa**); el zoom flota sobre el lienzo y el
resto vive en la hoja **Más**. Los paneles son hojas inferiores que se
cierran deslizando, con el lienzo atenuado detrás.

En **tablet** es exactamente la misma app: las hojas se centran y se
ensanchan, las rejillas ganan columnas y todo respira. Nunca aparece
una barra lateral ni nada que pida un ratón.

Y el **teclado virtual** ya no tapa nada: cuando aparece, la barra
inferior se aparta, el cajón se apoya justo encima del teclado y el
campo que estás escribiendo se coloca a la vista.

### 🪟 Nada de ventanas del navegador
Ni un `alert`, ni un `confirm`, ni un `prompt`. Esos diálogos congelan
la página entera (animaciones y WebGL incluidos) y se ven como lo que
son. En su lugar hay diálogos propios: se cierran tocando fuera o con
Escape, y las preguntas con dos salidas se hacen **una sola vez** en
lugar de encadenar dos confirmaciones.

### ⏳ Siempre se sabe qué está pasando
Los botones de acciones largas se marcan como ocupados, exportar y
guardar avisan mientras trabajan y confirman al terminar, y subir
varias fotos dice por dónde va — si una falla, **las demás entran
igual** y te dice cuál no pudo.

### 🔖 Ficha de cada recurso
Mantén pulsado un asset y se abre su ficha: vista previa grande (el
vídeo se ve, el audio suena), tipo, peso, carpeta, en cuántas piezas se
usa, y su **nombre y etiquetas editables**. Las etiquetas luego sirven
para encontrarlo desde el buscador.

### 🗂️ Cajones que se manejan con el dedo
Los paneles son cajones de verdad. Siguen al dedo desde cualquier
punto, pero saben distinguir: si vas de lado no se mueven, si la lista
no está arriba del todo lo que se desplaza es la lista, y solo cuando
está arriba el mismo gesto arrastra el cajón. Para cerrarlo hay que
**bajarlo hasta el 60 % de su altura** — lanzarlo hacia abajo no lo
cierra por sí solo, solo rebaja lo que hay que recorrer. Si no llegas,
vuelve a su sitio con un muelle.
**Un dedo** desplaza el lienzo con inercia y rebote —pase por donde
pase—. **Dos dedos** hacen zoom. **Desliza una capa o página a la
izquierda** para borrarla (con «Deshacer» al instante) y **mantén
pulsada** una capa para selección múltiple.

### 🧰 Barra de edición grande, con nombre y todo
Al seleccionar una pieza aparece abajo una barra de verdad: ocho
acciones —**Editar · Duplicar · Copiar | Al frente · Al fondo |
Bloquear · Ocultar | Eliminar**— con **icono grande y etiqueta**,
agrupadas por función y con estado visible (se nota cuándo algo está
bloqueado u oculto). Si no caben todas, la fila se desplaza de lado y
el borde se difumina para que se vea que hay más; si caben, no se
difumina nada. Nunca queda recortada ni comprimida.

### 📐 Escala del contenido, en una barra
En el panel de edición hay un **deslizador vertical**: arrástralo hacia
arriba para agrandar y hacia abajo para reducir. No es un zoom — crece
todo a la vez y de verdad: la caja, el texto, los bordes, los radios y
los espaciados. Con varias piezas seleccionadas también escala la
distancia entre ellas, así que la composición no se desarma. Un solo
"deshacer" revierte el gesto entero.

### 👆 Deslizar ya no descoloca nada
Con el dedo, **el desplazamiento siempre gana**: si recorres la página
y pasas por encima de una pieza —esté seleccionada o no— la pieza no se
mueve ni un píxel. Mover algo es una decisión, no un accidente:

1. **tocas** la pieza → queda seleccionada, con su marco y sus controles;
2. arrastras desde el **asa redonda del centro** → se mueve al instante;
3. o **mantienes pulsado** un momento (vibra) y arrastras sin soltar;
4. tocas fuera → se deselecciona y el dedo vuelve a desplazar.

Los tiradores del marco redimensionan y giran al momento, y el giro se
imanta solo a 0/45/90°. Con ratón, el arrastre directo de siempre.

### 🎨 Color del editor
El editor es siempre claro. Lo que eliges es **cómo se reparten el rosa
y el verde**: *Rosa y menta* (a partes iguales), *Más rosa*, *Más verde*
o *Lavanda*. Cada opción se enseña con su bola de dos colores en
*Páginas → Color del editor*, y se recuerda entre sesiones.

### 🎀 Dos estilos de proyecto, de verdad
**Pixel Art** (bordes duros, colores planos, tipografía de máquina) y
**Baddie** (rosa eléctrico sobre negro, neón y mucha actitud). Un toque
cambia el fondo de la página y le añade su portada. Cada uno se enseña
con una **miniatura real** de su estética, no con un nombre en una
lista.

### 🌐 Online Assets
Pega la URL de una imagen, GIF, vídeo, audio, SVG o JSON y el recurso se
descarga una vez, se guarda en la carpeta **"online assets"** y se usa
igual que uno tuyo —también **sin conexión**—. Se puede actualizar
cuando el archivo remoto cambie y viaja dentro del sitio exportado.

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
Cada elemento elige su respuesta **al tocar** (**ondas ripple** —el
efecto por defecto de los botones—, escala, rebote, brillo, latido,
sacudida, hundir, elevar, chispas ✨ con háptico) y **al pasar el cursor**
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

### ⚡ Rendimiento medido, no prometido
El editor se perfila con la CPU frenada a un cuarto (gama media) en un
iPhone 12 emulado. Antes iba a 15 fps en reposo: los fondos de
partículas se dibujaban a 4,2 megapíxeles para enseñarse en 390 px,
porque medían su lienzo con el tamaño de maqueta y no con el real.
Corregido eso —y el mismo fallo en las escenas 3D—, y con el marco de
selección que ya no se reconstruye en cada fotograma de arrastre:

| escena | antes | ahora |
|---|---|---|
| editor en reposo | 50–67 ms/frame | **16,7 ms** |
| desplazar el lienzo | p95 66,7 ms | **p95 16,8 ms** |
| arrastrar una pieza | cientos de nodos/s | **0 nodos creados** |
| sitio exportado | 4,2 Mpx por fondo | **0,39 Mpx** |

Abrir cada panel también se midió, y se arregló: las listas largas se
montan por tandas y lo que no se ve no se maqueta.

| panel | antes | ahora |
|---|---|---|
| Capas (51 piezas) | 167 ms, con un parón de 112 ms | **9,7 ms, sin parones** |
| Piezas | 87 ms, parón de 57 ms | **13 ms, sin parones** |
| Páginas | 87 ms, parón de 60 ms | **11,5 ms, sin parones** |

Y un barrido de **once dispositivos** (iPhone SE/12/15 Pro Max, Galaxy
A14/S24+, Pixel 8, iPad mini/Pro y tres en horizontal), siete pantallas
cada uno: sin desbordes, sin elementos cortados, sin nada tocable por
debajo de 34 px y sin texto por debajo de 11 px.

Veinte ciclos de uso intenso seguidos: memoria plana, contextos WebGL
estables y cero errores. Las partículas y el 3D **aguantan el frame
mientras el dedo recorre el lienzo**, así que el gesto siempre manda.

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

## Si conectas un teclado

Todo se hace con el dedo, pero si enchufas un teclado a la tablet estos
atajos siguen ahí (nunca han hecho falta, y no estorban):

| | |
|---|---|
| Ctrl+Z / Ctrl+Y | deshacer / rehacer |
| Ctrl+C / V / D | copiar / pegar / duplicar |
| Ctrl+Shift+C / V | copiar / pegar estilo |
| Supr · Flechas | eliminar · mover (Shift ×10) |
| Doble toque en un texto | editarlo ahí mismo |
