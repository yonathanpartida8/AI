# ◆ No-Code Website Builder

Constructor visual de sitios web profesional: diseña páginas completas con
drag-and-drop, personaliza cada elemento, anima, dibuja, integra 3D y **exporta
un sitio HTML/CSS/JS real en un ZIP** — sin escribir código.

## Ejecutar — solo doble clic

**Abre `index.html` con doble clic. Ya está.** No necesitas servidor, ni
instalar nada, ni conexión a internet (Three.js se descarga de CDN solo si
usas modelos 3D).

El editor arranca con una **plantilla completa**: una landing larga con héroe
de partículas, características, cita, galería, llamada a la acción y pie de
página — lista para que la edites, no un lienzo en blanco.

### Para desarrolladores

El código fuente vive en `/src` (ES Modules) y se prueba con `dev.html`
servido en local; `index.html` es el archivo autocontenido generado:

```bash
npm install
npm run build     # regenera index.html desde /src y /css
npm run dev       # sirve dev.html en http://localhost:8080
```

## Qué puedes hacer

- **Bloques prediseñados**: inserta secciones completas (héroe, tarjetas,
  galería, CTA, pie…) con un clic — la página crece sola y queda bonita.
- **Diseñar**: arrastra 18 tipos de componentes (texto, botones, imágenes, GIFs,
  vídeos, galerías, sliders, formularios, menús, reproductores, formas,
  modelos 3D, partículas WebGL2…). Mueve, redimensiona, rota, alinea con guías
  inteligentes, snap, rejilla, reglas, zoom y pan.
- **Tu galería**: sube imágenes/GIFs/vídeos/audio/modelos GLB desde el móvil o
  el PC (botón *Subir* o soltando archivos directamente sobre el lienzo).
- **Multipágina**: páginas ilimitadas, duplicar, ordenar, transiciones de
  entrada (fade/slide/zoom/blur) y menú de navegación automático.
- **Responsive**: modos Escritorio/Tablet/Móvil con overrides por dispositivo.
- **Animar**: 15 presets (fadeInUp, zoomIn, bounce, float…) con duración, delay,
  loop, curvas y triggers (cargar / scroll / clic / hover) + eventos
  (ir a página, abrir URL, mostrar/ocultar, reproducir sonido…).
- **Dibujar**: pincel con presión de stylus, opacidad, borrador — y convierte el
  trazo en un componente editable.
- **Exportar**: botón *Exportar sitio (.zip)* genera `index.html`, `paginas/`,
  `css/`, `js/`, `assets/` — listo para Netlify, Vercel o GitHub Pages.

Todo se **autoguarda** en tu navegador (localStorage + IndexedDB). Además:

- **Guardar .json** descarga el proyecto **con tus GIFs, imágenes y vídeos
  incrustados dentro** — un solo archivo autocontenido que puedes mover de
  equipo y re-importar sin perder nada.
- Al **Exportar sitio (.zip)**, tus GIFs quedan guardados como archivos
  reales dentro de la carpeta del proyecto: `assets/gifs/`, las imágenes en
  `assets/images/`, los vídeos en `assets/videos/`, etc.

## Atajos

| | |
|---|---|
| Ctrl+Z / Ctrl+Y | deshacer / rehacer |
| Ctrl+C / V / D | copiar / pegar / duplicar |
| Supr | eliminar · Flechas: mover (Shift ×10) |
| Ctrl+rueda | zoom al cursor · rueda: pan |
| Espacio + arrastrar | pan · doble clic en texto: editar |
| Shift al rotar/escalar | pasos de 15° / proporción fija |

## Arquitectura

Documentación técnica completa (modelo JSON, motores, decisiones de
escalabilidad y rendimiento) en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

```
Editor visual → ProjectStore (JSON = fuente de verdad) → Renderer
                     ├─ Motor de animaciones (WAAPI ↔ CSS)
                     ├─ Motor WebGL (WebGL2 nativo + Three.js lazy)
                     ├─ Asset Manager (IndexedDB)
                     └─ Exportador (JSON → sitio estático + ZIP)
```
