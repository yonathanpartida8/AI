/* ============================================================
 * webgl/threeManager.js — Motor 3D con Three.js
 *
 * - Carga PEREZOSA: Three.js (~600 KB) solo se descarga si el
 *   proyecto contiene al menos un componente 3D. El editor no
 *   paga ese coste nunca de forma anticipada.
 * - Un renderer WebGL por componente, con DPR limitado a 2 y
 *   pausa automática fuera de pantalla (batería / móviles).
 * - Modelos GLB/GLTF del Asset Manager (dataURL → GLTFLoader),
 *   con reproducción de las animaciones embebidas del modelo.
 * - Sin conexión / sin CDN → placeholder degradado elegante.
 *
 * Se importa por URL completa (+esm) → funciona igual servido,
 * empaquetado en un solo archivo o abierto con doble clic.
 * ============================================================ */

import { mountParticles } from './particles.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';

let threePromise = null;

function loadThree() {
  threePromise ||= Promise.all([
    import(/* @vite-ignore */ THREE_URL),
    import(/* @vite-ignore */ GLTF_URL),
  ]).then(([THREE, { GLTFLoader }]) => ({ THREE, GLTFLoader }));
  return threePromise;
}

export class ThreeManager {
  #instances = new Map(); // elemento → dispose()

  constructor(assets) { this.assets = assets; }

  /** Escanea un contenedor y monta todos los embeds 3D/partículas. */
  mountAll(root) {
    this.disposeAll();
    root.querySelectorAll('.wb-particles').forEach((canvas) => {
      this.#instances.set(canvas, mountParticles(canvas, canvas.dataset));
    });
    root.querySelectorAll('.wb-3d').forEach((elem) => this.#mountModel(elem));
  }

  disposeAll() {
    for (const dispose of this.#instances.values()) { try { dispose(); } catch { /* noop */ } }
    this.#instances.clear();
  }

  async #mountModel(elem) {
    elem.innerHTML = '<div class="wb-3d-loading">Cargando motor 3D…</div>';
    let mod;
    try { mod = await loadThree(); }
    catch {
      elem.innerHTML = '<div class="wb-3d-loading">⬡<br><small>Three.js no disponible sin conexión.<br>El modelo se mostrará en el sitio exportado.</small></div>';
      return;
    }
    if (!elem.isConnected) return;
    const { THREE, GLTFLoader } = mod;
    elem.innerHTML = '';

    const w = elem.clientWidth || 300, h = elem.clientHeight || 240;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    elem.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.6, parseFloat(elem.dataset.cameraz) || 4);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(
      new THREE.Color(elem.dataset.lightcolor || '#ffffff'),
      parseFloat(elem.dataset.lightintensity) || 2,
    );
    light.position.set(3, 5, 4);
    scene.add(light);

    const pivot = new THREE.Group();
    scene.add(pivot);
    let mixer = null;

    const assetId = elem.dataset.model;
    const assetData = assetId ? this.assets.url(assetId) : '';
    if (assetData) {
      try {
        const gltf = await new GLTFLoader().loadAsync(assetData);
        const model = gltf.scene;
        // Normaliza escala/centrado para que cualquier GLB encaje en cámara
        const box = new THREE.Box3().setFromObject(model);
        const sizeV = box.getSize(new THREE.Vector3());
        const scale = 2 / Math.max(sizeV.x, sizeV.y, sizeV.z, 0.001);
        model.scale.setScalar(scale);
        box.getCenter(sizeV);
        model.position.sub(sizeV.multiplyScalar(scale));
        pivot.add(model);
        if (elem.dataset.playanim !== 'false' && gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
        }
      } catch (e) {
        console.warn('GLB inválido', e);
        pivot.add(ThreeManager.#demoMesh(THREE));
      }
    } else {
      pivot.add(ThreeManager.#demoMesh(THREE));
    }

    const clock = new THREE.Clock();
    const autoRotate = elem.dataset.autorotate !== 'false';
    const rotSpeed = parseFloat(elem.dataset.speed) || 1;
    let visible = true, disposed = false, raf = 0;

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(elem);

    // Interacción: arrastrar para rotar manualmente
    let dragging = false, lastX = 0, lastY = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      pivot.rotation.y += (e.clientX - lastX) * 0.01;
      pivot.rotation.x += (e.clientY - lastY) * 0.01;
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = clock.getDelta();
      if (autoRotate && !dragging) pivot.rotation.y += dt * 0.6 * rotSpeed;
      mixer?.update(dt);
      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const nw = elem.clientWidth, nh = elem.clientHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(elem);

    this.#instances.set(elem, () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    });
  }

  static #demoMesh(THREE) {
    return new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.8, 0.28, 128, 24),
      new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.6, roughness: 0.25 }),
    );
  }
}
