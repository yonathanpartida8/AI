/* ============================================================
 * scripts/build.mjs — Genera el index.html AUTOCONTENIDO
 *
 * Empaqueta todos los módulos de /src en un único archivo IIFE
 * (esbuild) y lo inserta, junto con el CSS, dentro de un solo
 * index.html. Resultado: el editor funciona con DOBLE CLIC,
 * sin servidor, sin instalación, incluso sin conexión
 * (Three.js sigue cargándose por CDN solo si se usan modelos 3D).
 *
 *   npm run build   →  regenera index.html desde /src y /css
 * ============================================================ */

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/editor/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  write: false,
  legalComments: 'none',
  // Los imports dinámicos de CDN (Three.js) quedan como import() nativo
  external: ['https://*'],
});

// `</script>` dentro de strings del exportador rompería el HTML inline
const js = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const css = readFileSync('css/editor.css', 'utf8');

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>No-Code Website Builder</title>
  <link rel="icon" href="data:,">
  <!-- ═══════════════════════════════════════════════════════════
       ARCHIVO GENERADO — no editar a mano.
       Código fuente en /src y /css. Regenerar con: npm run build
       Este archivo es autocontenido: ábrelo con doble clic.
       ═══════════════════════════════════════════════════════════ -->
  <style>
${css}
  </style>
</head>
<body>
  <header id="topbar"></header>
  <div id="draw-toolbar-slot"></div>

  <div id="workspace">
    <aside id="left-panel"></aside>

    <main id="stage-area">
      <div id="ruler-corner"></div>
      <div id="ruler-h-wrap"><canvas id="ruler-h"></canvas></div>
      <div id="ruler-v-wrap"><canvas id="ruler-v"></canvas></div>
      <div id="viewport">
        <div id="world">
          <div id="artboard"></div>
          <svg id="guides"></svg>
          <canvas id="draw-layer"></canvas>
          <div id="overlay"></div>
        </div>
      </div>
    </main>

    <aside id="right-panel"></aside>
  </div>

  <script>
${js}
  </script>
</body>
</html>
`;

writeFileSync('index.html', html);
console.log(`index.html generado (${(html.length / 1024).toFixed(0)} KB) — funciona con doble clic.`);
