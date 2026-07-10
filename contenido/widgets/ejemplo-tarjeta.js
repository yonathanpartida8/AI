/* Ejemplo de widget: tarjeta de vidrio con brillo que sigue al dedo. */
export default {
  name: 'Tarjeta de cristal',
  icon: '🪟',
  width: 340, height: 210,
  html: `<div class="glasscard"><h3>Para ti</h3><p>Toca y mueve el dedo sobre la tarjeta ✨</p><span class="shine"></span></div>`,
  css: `.glasscard{position:relative;width:100%;height:100%;padding:26px;border-radius:22px;overflow:hidden;
  background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.05));
  border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(14px);color:#fff;font-family:system-ui}
.glasscard h3{font-size:24px;font-weight:800;margin-bottom:8px}
.glasscard p{opacity:.75;font-size:14px}
.glasscard .shine{position:absolute;width:160px;height:160px;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(255,255,255,.35),transparent 70%);transform:translate(-50%,-50%);left:30%;top:30%}`,
  js: `const card = document.currentScript.closest('.wb-custom').querySelector('.glasscard');
const shine = card.querySelector('.shine');
card.addEventListener('pointermove', (e) => {
  const r = card.getBoundingClientRect();
  shine.style.left = (e.clientX - r.left) + 'px';
  shine.style.top = (e.clientY - r.top) + 'px';
});`,
};
