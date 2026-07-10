/* Ejemplo de 3D propio: lluvia de estrellas en 3D. */
export default {
  name: 'Galaxia de puntos',
  icon: '🌌',
  code: `// Nube de 1500 puntos girando como galaxia
const geo = new THREE.BufferGeometry();
const n = 1500, pos = new Float32Array(n * 3);
for (let i = 0; i < n; i++) {
  const r = Math.random() * 2.4, a = Math.random() * Math.PI * 2;
  pos[i*3] = Math.cos(a) * r;
  pos[i*3+1] = (Math.random() - .5) * .5;
  pos[i*3+2] = Math.sin(a) * r;
}
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#e9d5ff', size: 0.035, transparent: true, opacity: .9 }));
pivot.add(pts);
return (dt) => { pivot.rotation.y += dt * 0.25; };`,
};
