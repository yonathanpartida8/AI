/* ============================================================
 * webgl/threeManager.js — Motor 3D con Three.js
 *
 * Monta los embeds del editor:
 *  - .wb-particles          → runtime WebGL2 compartido
 *  - .wb-3d[data-kind]      → Three.js (carga perezosa desde CDN)
 *      · model : GLB/GLTF del usuario con sus animaciones
 *      · heart : corazón 3D extruido (geometría procedural)
 *      · photo : foto con profundidad (plano curvado + tilt)
 *
 * Three.js (~600 KB) solo se descarga si la página usa 3D.
 * DPR ≤ 2.5 y pausa fuera de pantalla: fluidez primero, sin
 * desperdiciar GPU en lo que no se ve.
 * ============================================================ */

import { wbParticles } from '../runtime/particlesRuntime.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';

let threePromise = null;

function loadThree() {
  threePromise ||= Promise.race([
    Promise.all([
      import(/* @vite-ignore */ THREE_URL),
      import(/* @vite-ignore */ GLTF_URL),
    ]).then(([THREE, { GLTFLoader }]) => ({ THREE, GLTFLoader })),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout CDN')), 12000)),
  ]);
  threePromise.catch(() => { threePromise = null; }); // permite reintentar
  return threePromise;
}

/** Geometría de corazón: curva clásica extruida con bisel. */
export function makeHeartGeometry(THREE) {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  shape.moveTo(x, y + 0.5);
  shape.bezierCurveTo(x, y + 0.9, x - 0.9, y + 0.9, x - 0.9, y + 0.3);
  shape.bezierCurveTo(x - 0.9, y - 0.3, x - 0.3, y - 0.7, x, y - 1.05);
  shape.bezierCurveTo(x + 0.3, y - 0.7, x + 0.9, y - 0.3, x + 0.9, y + 0.3);
  shape.bezierCurveTo(x + 0.9, y + 0.9, x, y + 0.9, x, y + 0.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 5, curveSegments: 24,
  });
  geo.center();
  return geo;
}

export class ThreeManager {
  #instances = new Map();

  constructor(assets) { this.assets = assets; }

  mountAll(root) {
    this.disposeAll();
    this.mountEl(root);
  }

  /** Monta los embeds contenidos en un elemento (render incremental). */
  mountEl(el) {
    const scan = (sel, fn) => {
      if (el.matches?.(sel)) fn(el);
      el.querySelectorAll(sel).forEach(fn);
    };
    scan('.wb-particles', (canvas) => {
      if (!this.#instances.has(canvas)) this.#instances.set(canvas, wbParticles(canvas));
    });
    scan('.wb-3d', (elem) => {
      if (!this.#instances.has(elem)) this.#mount3D(elem);
    });
  }

  /** Libera SOLO los embeds que viven dentro de un elemento. */
  disposeIn(el) {
    for (const [key, dispose] of this.#instances) {
      if (el === key || el.contains(key)) {
        try { dispose(); } catch { /* noop */ }
        this.#instances.delete(key);
      }
    }
  }

  disposeAll() {
    for (const dispose of this.#instances.values()) { try { dispose(); } catch { /* noop */ } }
    this.#instances.clear();
  }

  async #mount3D(elem) {
    this.#instances.set(elem, () => {}); // reserva: evita montajes dobles
    elem.innerHTML = '<div class="wb-3d-loading">Cargando motor 3D…</div>';
    let mod;
    try { mod = await loadThree(); }
    catch {
      elem.innerHTML = '<div class="wb-3d-loading">⬡<br><small>Three.js no disponible sin conexión.<br>Se verá en el sitio exportado.</small></div>';
      return;
    }
    if (!elem.isConnected) return;
    const { THREE, GLTFLoader } = mod;
    elem.innerHTML = '';

    const kind = elem.dataset.kind || 'model';
    const customCode = kind === 'custom' ? (elem.querySelector('script[type="text/wb-3d"]')?.textContent || '') : '';
    const w = elem.clientWidth || 300, h = elem.clientHeight || 240;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.setSize(w, h);
    elem.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.4, parseFloat(elem.dataset.cameraz) || 4);
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const light = new THREE.DirectionalLight(new THREE.Color(elem.dataset.lightcolor || '#ffffff'), parseFloat(elem.dataset.lightintensity) || 2);
    light.position.set(3, 5, 4);
    scene.add(light);
    const rim = new THREE.PointLight(0xf472b6, 1.4, 12);
    rim.position.set(-3, -1, 3);
    scene.add(rim);

    const pivot = new THREE.Group();
    scene.add(pivot);
    let mixer = null;
    let interactive = true;
    let userUpdate = null;

    if (kind === 'custom') {
      // Zona 3D extensible: el usuario pega código Three.js y punto.
      try {
        userUpdate = new Function('THREE', 'scene', 'camera', 'pivot', 'renderer', 'GLTFLoader', customCode)(
          THREE, scene, camera, pivot, renderer, GLTFLoader,
        );
      } catch (e) {
        console.warn('Código 3D personalizado:', e);
        elem.innerHTML = `<div class="wb-3d-loading">⚠<br><small>Error en tu código 3D:<br>${String(e.message).slice(0, 80)}</small></div>`;
        return;
      }
    } else if (kind === 'heart') {
      pivot.add(new THREE.Mesh(makeHeartGeometry(THREE), new THREE.MeshStandardMaterial({
        color: new THREE.Color(elem.dataset.color || '#e11d48'),
        metalness: parseFloat(elem.dataset.metal) || 0.35,
        roughness: 0.25,
      })));
    } else if (kind === 'photo') {
      interactive = false; // la foto sigue al puntero, no se arrastra
      const src = elem.dataset.src;
      const depth = parseFloat(elem.dataset.depth) || 1;
      const tex = src ? await new THREE.TextureLoader().loadAsync(src).catch(() => null) : null;
      const ratio = tex?.image ? tex.image.width / tex.image.height : 1.4;
      const geo = new THREE.PlaneGeometry(2.6, 2.6 / ratio, 24, 24);
      // Curvatura suave: los bordes se hunden → sensación de profundidad
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i) / 1.3, py = posAttr.getY(i) / (1.3 / ratio);
        posAttr.setZ(i, -(px * px + py * py) * 0.16 * depth);
      }
      geo.computeVertexNormals();
      pivot.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: tex || null, color: tex ? 0xffffff : 0x8b5cf6, roughness: 0.85,
      })));
      const onMove = (e) => {
        const r = elem.getBoundingClientRect();
        pivot.rotation.y = ((e.clientX - r.left) / r.width - 0.5) * 0.55 * depth;
        pivot.rotation.x = ((e.clientY - r.top) / r.height - 0.5) * -0.45 * depth;
      };
      elem.addEventListener('pointermove', onMove);
      camera.position.z = 2.6;
    } else {
      const src = elem.dataset.model;
      if (src) {
        try {
          const gltf = await new GLTFLoader().loadAsync(src);
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const scale = 2 / Math.max(size.x, size.y, size.z, 0.001);
          model.scale.setScalar(scale);
          box.getCenter(size);
          model.position.sub(size.multiplyScalar(scale));
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
    }

    const clock = new THREE.Clock();
    const autoRotate = elem.dataset.autorotate !== 'false' && kind !== 'photo';
    const rotSpeed = parseFloat(elem.dataset.speed) || 1;
    let visible = true, disposed = false, raf = 0;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(elem);

    let dragging = false, lastX = 0, lastY = 0;
    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        pivot.rotation.y += (e.clientX - lastX) * 0.01;
        pivot.rotation.x += (e.clientY - lastY) * 0.01;
        lastX = e.clientX; lastY = e.clientY;
      });
      window.addEventListener('pointerup', () => { dragging = false; });
    }

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = clock.getDelta();
      if (autoRotate && !dragging && kind !== 'custom') pivot.rotation.y += dt * 0.6 * rotSpeed;
      if (kind === 'heart') pivot.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.08; // latido flotante
      if (typeof userUpdate === 'function') { try { userUpdate(dt); } catch { /* código del usuario */ } }
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
