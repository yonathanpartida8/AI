/* Ejemplo de widget: corazón que late al ritmo de tus toques. */
export default {
  name: 'Corazón que late contigo',
  icon: '🫀',
  width: 240, height: 240,
  html: `<div class="beatbox"><div class="beatheart">❤️</div><small>tócame</small></div>`,
  css: `.beatbox{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%}
.beatbox .beatheart{font-size:84px;transition:transform .18s cubic-bezier(.2,.8,.25,1);cursor:pointer;filter:drop-shadow(0 8px 22px rgba(244,63,94,.45))}
.beatbox small{color:rgba(255,255,255,.55);font-family:system-ui;letter-spacing:.2em;text-transform:uppercase;font-size:10px}`,
  js: `const heart = document.currentScript.closest('.wb-custom').querySelector('.beatheart');
let s = 1;
heart.addEventListener('pointerdown', () => {
  s = Math.min(s + 0.18, 2.2);
  heart.style.transform = 'scale(' + s + ')';
  if (navigator.vibrate) navigator.vibrate(20);
});
setInterval(() => { s = Math.max(1, s - 0.06); heart.style.transform = 'scale(' + s + ')'; }, 220);`,
};
