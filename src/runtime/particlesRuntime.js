/* ============================================================
 * runtime/particlesRuntime.js — Motor de fondos WebGL2
 *
 * UNA SOLA FUENTE DE VERDAD: esta función es 100 % autocontenida
 * (sin imports ni referencias externas) para que el exportador la
 * inyecte literalmente en el sitio final con .toString(). Lo que
 * ves en el editor es EXACTAMENTE lo que corre en la página.
 *
 * Modos: nebulosa · lluvia · órbita · corazones · nieve ·
 *        estrellas · luciérnagas · aurora · ondas
 *
 * - corazones/nieve/estrellas/luciérnagas: point-sprites con
 *   forma por SDF en el fragment shader (corazón real, no emoji).
 * - aurora/ondas: quad a pantalla completa con shader procedural.
 * - Simulación por TIEMPO REAL (dt) → misma velocidad y máxima
 *   fluidez a 60/90/120/144/165 Hz.
 * ============================================================ */

export function wbParticles(canvas) {
  var d = canvas.dataset;
  var mode = d.mode || 'nebulosa';
  var count = Math.min(+d.count || 400, 8000);
  var speed = +d.speed || 1;
  var baseSize = +d.size || 2;
  var globalAlpha = d.opacity !== undefined && d.opacity !== '' ? Math.max(0, Math.min(1, +d.opacity)) : 1;
  var shapeOverride = d.shape || 'auto'; // auto | disco | corazón | estrella
  var glow = d.glow !== 'false'; // brillo aditivo configurable
  var gl = canvas.getContext('webgl2', { alpha: true, powerPreference: 'high-performance' });
  if (!gl) return function () {};
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  function resize() {
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 200;
    canvas.width = w * dpr; canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();

  function hexRGB(c) {
    var v = parseInt(String(c || '#818cf8').replace('#', ''), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }
  var rgb = hexRGB(d.color);

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); gl.useProgram(p);
    return p;
  }

  var disposed = false, visible = true, raf = 0, last = 0, t = 0;
  var io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; });
  io.observe(canvas);
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);

  var isQuad = mode === 'aurora' || mode === 'ondas';

  if (isQuad) {
    /* ── Fondos procedurales a pantalla completa ── */
    var qp = program(
      '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}',
      '#version 300 es\nprecision highp float;uniform vec2 uRes;uniform float uTime;uniform vec3 uColor;uniform int uKind;uniform float uA;out vec4 o;\n' +
      'void main(){vec2 uv=gl_FragCoord.xy/uRes;uv.y=1.-uv.y;vec3 col=vec3(0.);float alpha=0.;\n' +
      'if(uKind==0){\n' + // aurora: bandas de luz onduladas
      ' for(int i=0;i<3;i++){float fi=float(i);\n' +
      '  float w=sin(uv.x*(4.0+fi*2.0)+uTime*(0.35+fi*0.22)+fi*2.1)*0.16;\n' +
      '  float band=smoothstep(0.30,0.0,abs(uv.y-(0.30+fi*0.18)-w));\n' +
      '  vec3 tint=mix(uColor,vec3(uColor.g,uColor.b,uColor.r),fi*0.45);\n' +
      '  col+=tint*band*(0.65-fi*0.12);alpha=max(alpha,band*0.85);}\n' +
      '}else{\n' + // ondas: agua en la parte baja
      ' for(int i=0;i<3;i++){float fi=float(i);\n' +
      '  float lvl=0.55+fi*0.14;\n' +
      '  float w=sin(uv.x*(7.0+fi*4.0)-uTime*(1.1+fi*0.5)+fi)*0.035;\n' +
      '  float line=smoothstep(0.012,0.0,abs(uv.y-lvl-w));\n' +
      '  float fill=smoothstep(0.0,0.45,uv.y-lvl-w)*0.28;\n' +
      '  col+=uColor*(line*0.9+fill);alpha=max(alpha,line*0.9+fill);}\n' +
      '}\no=vec4(col,alpha);}');
    var qbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var qa = gl.getAttribLocation(qp, 'aPos');
    gl.enableVertexAttribArray(qa);
    gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(gl.getUniformLocation(qp, 'uColor'), rgb);
    gl.uniform1i(gl.getUniformLocation(qp, 'uKind'), mode === 'aurora' ? 0 : 1);
    gl.uniform1f(gl.getUniformLocation(qp, 'uA'), globalAlpha);
    var quRes = gl.getUniformLocation(qp, 'uRes');
    var quTime = gl.getUniformLocation(qp, 'uTime');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var stepQ = function (now) {
      if (disposed) return;
      raf = requestAnimationFrame(stepQ);
      if (!visible || document.body.classList.contains('wb-gesturing')) { last = now; return; }
      var dt = Math.min((now - last) / 1000 || 0.016, 0.05);
      last = now; t += dt * speed;
      gl.uniform2f(quRes, canvas.width, canvas.height);
      gl.uniform1f(quTime, t);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(stepQ);
  } else {
    /* ── Point sprites (formas por SDF: disco, corazón, estrella) ── */
    var isHeart = mode === 'corazones';
    var shapeId = shapeOverride === 'corazón' ? 1 : shapeOverride === 'estrella' ? 2
      : shapeOverride === 'disco' ? 0 : (isHeart ? 1 : 0);
    var soft = !glow || mode === 'nieve' || shapeId === 1; // blending normal
    var pp = program(
      '#version 300 es\nin vec2 aPos;in float aLife;uniform float uSize;uniform vec2 uRes;out float vLife;\n' +
      'void main(){vec2 c=(aPos/uRes)*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.,1.);\n' +
      'gl_PointSize=uSize*(0.45+aLife*0.9);vLife=aLife;}',
      '#version 300 es\nprecision mediump float;uniform vec3 uColor;uniform int uShape;uniform float uAlpha;in float vLife;out vec4 o;\n' +
      'float sdStar(vec2 p){const float an=0.6283;const float en=1.0472;\n' +
      ' vec2 acs=vec2(cos(an),sin(an));vec2 ecs=vec2(cos(en),sin(en));\n' +
      ' float bn=mod(atan(p.x,p.y),2.0*an)-an;p=length(p)*vec2(cos(bn),abs(sin(bn)));\n' +
      ' p-=acs*0.5;p+=ecs*clamp(-dot(p,ecs),0.0,0.5*acs.y);return length(p)*sign(p.x);}\n' +
      'void main(){float alpha;vec3 col=uColor;\n' +
      'if(uShape==1){vec2 p=(gl_PointCoord-vec2(0.5,0.42))*2.6;p.y=-p.y;\n' +
      ' float a=p.x*p.x+p.y*p.y-0.55;float f=a*a*a-p.x*p.x*p.y*p.y*p.y;\n' +
      ' alpha=smoothstep(0.03,-0.05,f)*(0.35+vLife*0.65);col=mix(uColor,vec3(1.),vLife*0.35);}\n' +
      'else if(uShape==2){vec2 p=(gl_PointCoord-vec2(0.5))*2.3;\n' +
      ' alpha=smoothstep(0.06,-0.04,sdStar(p))*(0.35+vLife*0.65);col=mix(uColor,vec3(1.),vLife*0.3);}\n' +
      'else{float dd=length(gl_PointCoord-vec2(0.5));alpha=smoothstep(0.5,0.0,dd)*(0.30+vLife*0.70);col=uColor*(0.6+vLife*0.6);}\n' +
      'o=vec4(col,alpha*uAlpha);}');
    gl.uniform3fv(gl.getUniformLocation(pp, 'uColor'), rgb);
    gl.uniform1i(gl.getUniformLocation(pp, 'uShape'), shapeId);
    gl.uniform1f(gl.getUniformLocation(pp, 'uAlpha'), globalAlpha);
    gl.uniform1f(gl.getUniformLocation(pp, 'uSize'), baseSize * dpr * (shapeId > 0 ? 7 : 2.2));
    var puRes = gl.getUniformLocation(pp, 'uRes');
    var W = function () { return canvas.width; }, H = function () { return canvas.height; };
    var pos = new Float32Array(count * 2), vel = new Float32Array(count * 2);
    var life = new Float32Array(count), seed = new Float32Array(count), orb = new Float32Array(count * 2);
    for (var i = 0; i < count; i++) {
      pos[i * 2] = Math.random() * W(); pos[i * 2 + 1] = Math.random() * H();
      vel[i * 2] = (Math.random() - 0.5) * 0.6; vel[i * 2 + 1] = (Math.random() - 0.5) * 0.6;
      life[i] = Math.random(); seed[i] = Math.random();
      orb[i * 2] = 40 + Math.random() * Math.min(W(), H()) / 2;
      orb[i * 2 + 1] = Math.random() * 6.283;
    }
    var pb = gl.createBuffer(), lb = gl.createBuffer();
    var aPos = gl.getAttribLocation(pp, 'aPos'), aLife = gl.getAttribLocation(pp, 'aLife');
    gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aLife);
    gl.enable(gl.BLEND);
    if (soft) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // aditivo: brillo mágico

    var stepP = function (now) {
      if (disposed) return;
      raf = requestAnimationFrame(stepP);
      if (!visible || document.body.classList.contains('wb-gesturing')) { last = now; return; }
      var dt = Math.min((now - last) / 1000 || 0.016, 0.05);
      last = now;
      var k = dt * 60 * speed;
      t += dt * speed;
      var cx = W() / 2, cy = H() / 2, i;
      for (i = 0; i < count; i++) {
        var s = seed[i];
        if (mode === 'corazones') { // suben flotando con vaivén
          pos[i * 2 + 1] -= (0.5 + s * 1.3) * k * dpr;
          pos[i * 2] += Math.sin(t * (0.8 + s) + i) * 0.5 * k;
          life[i] = 0.5 + 0.5 * Math.sin(t * (1 + s) + i);
          if (pos[i * 2 + 1] < -20) { pos[i * 2 + 1] = H() + 20; pos[i * 2] = Math.random() * W(); }
        } else if (mode === 'nieve') { // caen con viento suave
          pos[i * 2 + 1] += (0.6 + s * 1.6) * k * dpr;
          pos[i * 2] += Math.sin(t * (0.6 + s) + i) * 0.4 * k;
          if (pos[i * 2 + 1] > H() + 8) { pos[i * 2 + 1] = -8; pos[i * 2] = Math.random() * W(); }
          life[i] = 0.4 + s * 0.6;
        } else if (mode === 'estrellas') { // fijas, titilan
          life[i] = 0.5 + 0.5 * Math.sin(t * (0.8 + s * 2.5) + i * 1.7);
        } else if (mode === 'luciérnagas') { // vagan lentas y pulsan
          pos[i * 2] += vel[i * 2] * 0.35 * k * dpr + Math.sin(t * 0.5 + i) * 0.15 * k;
          pos[i * 2 + 1] += vel[i * 2 + 1] * 0.35 * k * dpr + Math.cos(t * 0.4 + i * 2.0) * 0.15 * k;
          life[i] = Math.max(0, Math.sin(t * (0.7 + s) + i * 2.3));
          if (pos[i * 2] < 0) pos[i * 2] = W(); else if (pos[i * 2] > W()) pos[i * 2] = 0;
          if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] = H(); else if (pos[i * 2 + 1] > H()) pos[i * 2 + 1] = 0;
        } else if (mode === 'órbita') {
          orb[i * 2 + 1] += 0.24 * dt * speed * (1 + (i % 5) * 0.15);
          pos[i * 2] = cx + Math.cos(orb[i * 2 + 1]) * orb[i * 2];
          pos[i * 2 + 1] = cy + Math.sin(orb[i * 2 + 1]) * orb[i * 2] * 0.6;
          life[i] += 0.01 * k; if (life[i] > 1) life[i] = 0;
        } else if (mode === 'lluvia') {
          pos[i * 2 + 1] += (1.5 + life[i] * 2.5) * k * dpr;
          if (pos[i * 2 + 1] > H()) { pos[i * 2 + 1] = -4; pos[i * 2] = Math.random() * W(); }
          life[i] += 0.01 * k; if (life[i] > 1) life[i] = 0;
        } else { // nebulosa
          pos[i * 2] += vel[i * 2] * k * dpr + Math.sin(t + i) * 0.1 * k;
          pos[i * 2 + 1] += vel[i * 2 + 1] * k * dpr + Math.cos(t * 0.7 + i) * 0.1 * k;
          if (pos[i * 2] < 0) pos[i * 2] = W(); else if (pos[i * 2] > W()) pos[i * 2] = 0;
          if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] = H(); else if (pos[i * 2 + 1] > H()) pos[i * 2 + 1] = 0;
          life[i] += 0.01 * k; if (life[i] > 1) life[i] = 0;
        }
      }
      gl.uniform2f(puRes, W(), H());
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, pb);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, lb);
      gl.bufferData(gl.ARRAY_BUFFER, life, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(aLife, 1, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, count);
    };
    raf = requestAnimationFrame(stepP);
  }

  return function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    if (ro) ro.disconnect();
    var ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  };
}
