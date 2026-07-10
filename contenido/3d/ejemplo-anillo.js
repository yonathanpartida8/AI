/* Ejemplo de 3D propio: anillo de compromiso girando.
 * Duplica este archivo para crear los tuyos. */
export default {
  name: 'Anillo brillante',
  icon: '💍',
  code: `// Anillo dorado con destello
const aro = new THREE.Mesh(
  new THREE.TorusGeometry(1, 0.14, 32, 96),
  new THREE.MeshStandardMaterial({ color: '#f6d365', metalness: .95, roughness: .15 })
);
const gema = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.3, 0),
  new THREE.MeshStandardMaterial({ color: '#e0f2fe', metalness: .3, roughness: 0, emissive: '#93c5fd', emissiveIntensity: .35 })
);
gema.position.y = 1.25;
pivot.add(aro, gema);
pivot.rotation.x = 0.5;
return (dt) => {
  pivot.rotation.y += dt * 0.8;
  gema.rotation.y -= dt * 2;
};`,
};
