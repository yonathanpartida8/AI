/* ============================================================
 * renderer/componentStyles.js — CSS compartido de componentes
 *
 * UNA SOLA FUENTE DE VERDAD: este CSS se inyecta en el editor
 * (main.js) y se escribe tal cual en el sitio exportado. Añadir
 * un estilo aquí lo hace funcionar en ambos mundos a la vez.
 * ============================================================ */

export const COMPONENT_CSS = `
/* ── Base de componentes ── */
.wb-node{position:absolute;display:block}
.wb-node .wb-text{width:100%;height:100%;font:inherit;color:inherit;text-align:inherit;line-height:inherit;text-shadow:inherit}
.wb-btn{width:100%;height:100%;font:inherit;color:inherit;background:none;border:none;cursor:pointer;border-radius:inherit;background:inherit;text-align:inherit;text-shadow:inherit}
.wb-icon{display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:inherit}
.wb-hidden{visibility:hidden!important}
.wb-slider{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit}
.wb-slide{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s,transform .6s}
.wb-slide.active{opacity:1}
.wb-slider[data-transition="slide"] .wb-slide{transform:translateX(100%)}
.wb-slider[data-transition="slide"] .wb-slide.active{transform:translateX(0)}
.wb-form{display:flex;flex-direction:column;gap:10px;width:100%;height:100%;padding:20px;border-radius:inherit;background:inherit;color:inherit;font-family:inherit}
.wb-form input,.wb-form textarea{padding:10px;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(148,163,184,.1);color:inherit;font:inherit}
.wb-form button{padding:12px;border:none;border-radius:8px;background:#6366f1;color:#fff;font-weight:700;cursor:pointer}
.wb-menu{display:flex;width:100%;height:100%;align-items:center;justify-content:space-between;padding:0 28px;border-radius:inherit;background:inherit}
.wb-menu-links{display:flex;gap:22px}
.wb-menu a{color:inherit;text-decoration:none;opacity:.85;cursor:pointer}
.wb-menu a:hover{opacity:1;text-decoration:underline}
/* ── Reproductor de música (limpio, sin controles nativos) ── */
.wb-mp{display:flex;gap:14px;align-items:center;width:100%;height:100%;padding:14px;border-radius:inherit;background:inherit;color:inherit;position:relative;overflow:hidden}
.wb-mp audio{display:none}
.wb-mp-cover{width:64px;height:64px;flex:none;border-radius:14px;object-fit:cover;box-shadow:0 6px 18px rgba(0,0,0,.35);transition:transform .5s}
.wb-mp.playing .wb-mp-cover{animation:wb-spin 9s linear infinite;border-radius:50%}
.wb-mp-cover-icon{display:grid;place-items:center;background:rgba(255,255,255,.14)}
@keyframes wb-spin{to{transform:rotate(360deg)}}
.wb-mp-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.wb-mp-meta{display:flex;flex-direction:column;min-width:0}
.wb-mp-meta strong{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-mp-meta span{opacity:.7;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-mp-empty{opacity:.6;font-size:12px}
.wb-mp-controls{display:flex;align-items:center;gap:10px}
.wb-mp-play{width:34px;height:34px;flex:none;border:none;border-radius:50%;background:rgba(255,255,255,.92);color:#111;display:grid;place-items:center;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.25,1);box-shadow:0 4px 14px rgba(0,0,0,.3)}
.wb-mp-play:active{transform:scale(.88)}
.wb-mp-track{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.22);cursor:pointer;position:relative}
.wb-mp-fill{position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:3px;background:#fff;transition:width .25s linear}
.wb-mp-time{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums;flex:none}
.wb-mp-mini{padding:8px 12px;gap:10px}
.wb-mp-mini .wb-mp-cover{width:40px;height:40px;border-radius:10px}
.wb-mp-mini .wb-mp-meta span,.wb-mp-mini .wb-eq{display:none}
.wb-mp-yt{padding:0}
.wb-eq{display:flex;align-items:flex-end;gap:3px;height:30px;flex:none}
.wb-eq i{width:4px;height:8px;border-radius:2px;background:rgba(255,255,255,.75);transition:height .3s}
.wb-mp.playing .wb-eq i{animation:wb-eqbar 1s ease-in-out infinite}
.wb-mp.playing .wb-eq i:nth-child(2){animation-delay:.18s}
.wb-mp.playing .wb-eq i:nth-child(3){animation-delay:.36s}
.wb-mp.playing .wb-eq i:nth-child(4){animation-delay:.54s}
@keyframes wb-eqbar{0%,100%{height:8px}50%{height:26px}}
.wb-3d,.wb-particles{width:100%;height:100%;border-radius:inherit;display:block}
.wb-3d canvas{border-radius:inherit}
.wb-gallery img{border-radius:6px}

/* ── Fondo de gradiente animado ── */
.wb-gradbg{width:100%;height:100%;border-radius:inherit;background-size:400% 400%!important;animation:wb-gradshift var(--gspeed,8s) ease-in-out infinite}
@keyframes wb-gradshift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

/* ── Carta interactiva ── */
.wb-letter{position:relative;width:100%;height:100%;cursor:pointer;perspective:900px}
.wb-letter-front{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:linear-gradient(160deg,#be123c,#881337);border-radius:14px;color:#fff;font-weight:700;font-size:17px;box-shadow:0 14px 40px rgba(190,18,60,.45);transition:opacity .5s .25s,transform .6s;z-index:2}
.wb-letter-front::before{content:'💌';font-size:44px;animation:wb-float 3s ease-in-out infinite}
.wb-letter-paper{position:absolute;inset:4%;background:#fff7ed;border-radius:10px;padding:7% 8%;color:#7c2d12;display:flex;flex-direction:column;justify-content:center;gap:12px;opacity:0;transform:rotateX(-70deg);transform-origin:top;transition:transform .8s .3s cubic-bezier(.2,.8,.25,1),opacity .5s .3s;box-shadow:0 12px 34px rgba(0,0,0,.3);overflow:auto}
.wb-letter-paper p{font-family:Georgia,serif;font-size:1.05em;line-height:1.7;white-space:pre-line}
.wb-letter-photo{width:62%;max-height:44%;object-fit:cover;align-self:center;border:5px solid #fff;border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.25);transform:rotate(-2deg);flex:none}
.wb-letter-paper span{align-self:flex-end;font-family:Georgia,serif;font-style:italic;opacity:.85}
.wb-letter.open .wb-letter-front{opacity:0;transform:translateY(-14%) scale(.92);pointer-events:none}
.wb-letter.open .wb-letter-paper{opacity:1;transform:rotateX(0)}
@keyframes wb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

/* ── Línea de tiempo de recuerdos ── */
.wb-timeline{position:relative;width:100%;height:100%;overflow:auto;padding:12px 6px 12px 34px;color:inherit}
.wb-timeline::before{content:'';position:absolute;left:14px;top:10px;bottom:10px;width:2px;background:linear-gradient(180deg,#f472b6,#8b5cf6)}
.wb-timeline li{position:relative;list-style:none;margin:0 0 22px;opacity:0;transform:translateY(22px);transition:opacity .6s,transform .6s;transition-delay:calc(var(--i)*180ms)}
.wb-timeline.wb-play li{opacity:1;transform:none}
.wb-timeline li::before{content:'♥';position:absolute;left:-27px;top:2px;color:#f472b6;font-size:13px;text-shadow:0 0 10px rgba(244,114,182,.8)}
.wb-tl-photo{width:100%;max-height:130px;object-fit:cover;border-radius:12px;margin-bottom:8px;box-shadow:0 8px 22px rgba(0,0,0,.35)}
.wb-timeline b{display:block;font-size:.8em;color:#f472b6;letter-spacing:.06em;text-transform:uppercase}
.wb-timeline strong{display:block;font-size:1.05em;margin:2px 0}
.wb-timeline p{opacity:.8;font-size:.92em;line-height:1.5}

/* ── Mensaje oculto ── */
.wb-hiddenmsg{position:relative;width:100%;height:100%;cursor:pointer;border-radius:inherit;overflow:hidden}
.wb-hiddenmsg .wb-hm-secret{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8%;text-align:center;filter:blur(14px);opacity:.4;transition:filter .9s,opacity .9s;white-space:pre-line}
.wb-hiddenmsg .wb-hm-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(10,8,28,.55);backdrop-filter:blur(2px);font-weight:600;transition:opacity .6s;border-radius:inherit}
.wb-hiddenmsg.revealed .wb-hm-secret{filter:blur(0);opacity:1}
.wb-hiddenmsg.revealed .wb-hm-cover{opacity:0;pointer-events:none}

/* ── Botón de corazones + estallido ── */
.wb-heartbtn{width:100%;height:100%;border:none;cursor:pointer;font:inherit;color:inherit;background:inherit;border-radius:inherit;text-shadow:inherit;transition:transform .15s}
.wb-heartbtn:active{transform:scale(.92)}
.wb-burstheart{position:fixed;z-index:9999;pointer-events:none;animation:wb-burst 1.2s ease-out forwards}
@keyframes wb-burst{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx,0),-160px) rotate(var(--rot,20deg));opacity:0}}

/* ── Máquina de escribir ── */
.wb-typewriter{display:inline-block;width:100%;height:100%;white-space:pre-wrap}
.wb-typewriter.typing::after{content:'▍';animation:wb-caret 1s steps(1) infinite;opacity:.85}
@keyframes wb-caret{50%{opacity:0}}

/* ── Contador de amor ── */
.wb-count{display:flex;gap:10px;width:100%;height:100%;align-items:center;justify-content:center}
.wb-count-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;height:100%;background:rgba(255,255,255,.07);border:1px solid rgba(244,114,182,.35);border-radius:14px;backdrop-filter:blur(4px)}
.wb-count-tile b{font-size:2em;font-weight:900;font-variant-numeric:tabular-nums}
.wb-count-tile small{opacity:.7;font-size:.72em;text-transform:uppercase;letter-spacing:.08em}
.wb-count-label{position:absolute;top:-26px;left:0;right:0;text-align:center;font-size:14px;opacity:.85}

/* ── Polaroid ── */
.wb-polaroid{width:100%;height:100%;background:#fdf6ec;padding:5% 5% 0;border-radius:4px;box-shadow:0 12px 30px rgba(0,0,0,.35);display:flex;flex-direction:column;transform:rotate(var(--prot,-2deg));transition:transform .3s}
.wb-polaroid:hover{transform:rotate(0) scale(1.03)}
.wb-polaroid img{width:100%;flex:1;object-fit:cover;min-height:0}
.wb-polaroid figcaption{padding:10px 4px;text-align:center;font-family:Georgia,serif;font-style:italic;color:#57534e;font-size:.95em}
.wb-polaroid .wb-placeholder{flex:1}

/* ── Emojis flotantes ── */
.wb-floaties{position:relative;width:100%;height:100%;overflow:hidden;pointer-events:none;border-radius:inherit}
.wb-floaties span{position:absolute;bottom:-40px;animation:wb-floatup linear infinite}
@keyframes wb-floatup{0%{transform:translateY(0) rotate(-8deg);opacity:0}10%{opacity:1}90%{opacity:.9}100%{transform:translateY(-110vh) rotate(10deg);opacity:0}}

/* ── Componente personalizado ── */
.wb-custom{width:100%;height:100%;border-radius:inherit;overflow:hidden}

/* ── Letras animadas ── */
.wb-fx{display:inline-block}
.wb-fx-olas{animation:wb-fxwave 1.8s ease-in-out infinite;animation-delay:calc(var(--i)*90ms)}
@keyframes wb-fxwave{0%,100%{transform:translateY(0)}50%{transform:translateY(-.35em)}}
.wb-fx-saltos{animation:wb-fxjump 1.4s cubic-bezier(.3,1.6,.4,1) infinite;animation-delay:calc(var(--i)*70ms)}
@keyframes wb-fxjump{0%,30%,100%{transform:translateY(0) scale(1)}15%{transform:translateY(-.5em) scale(1.15)}}
.wb-fx-brillo{animation:wb-fxglow 2.2s ease-in-out infinite;animation-delay:calc(var(--i)*110ms)}
@keyframes wb-fxglow{0%,100%{text-shadow:0 0 4px rgba(255,255,255,.1);opacity:.8}50%{text-shadow:0 0 16px rgba(255,220,255,.95),0 0 34px rgba(244,114,182,.7);opacity:1}}
.wb-fx-arcoiris{animation:wb-fxrainbow 3.2s linear infinite;animation-delay:calc(var(--i)*-140ms)}
@keyframes wb-fxrainbow{0%{color:#f472b6}20%{color:#fb923c}40%{color:#facc15}60%{color:#4ade80}80%{color:#38bdf8}100%{color:#f472b6}}

/* ── Micro-interacciones: todo responde al tacto ── */
.wb-btn,.wb-heartbtn,.wb-form button{transition:transform .18s cubic-bezier(.2,.8,.25,1),filter .18s}
.wb-btn:hover,.wb-form button:hover{transform:scale(1.035);filter:brightness(1.1)}
.wb-btn:active,.wb-form button:active{transform:scale(.94)}
.wb-node img{transition:transform .35s cubic-bezier(.2,.8,.25,1)}
.wb-gallery img:hover,.wb-slider:hover .wb-slide.active{transform:scale(1.04)}
.wb-menu a{transition:opacity .15s,transform .15s}
.wb-menu a:active{transform:scale(.93)}

/* ── Biblioteca de efectos de PRESIÓN (data-press) ── */
[data-press]{transition:transform .16s cubic-bezier(.2,.8,.25,1),filter .16s,box-shadow .16s}
[data-press="escala"].wb-pressing{transform:scale(.93)!important}
[data-press="rebote"].wb-pressing{animation:wb-pressbounce .45s cubic-bezier(.3,1.8,.4,1)!important}
@keyframes wb-pressbounce{0%{transform:scale(1)}35%{transform:scale(.85)}70%{transform:scale(1.06)}100%{transform:scale(1)}}
[data-press="brillo"].wb-pressing{filter:brightness(1.5) drop-shadow(0 0 14px rgba(255,155,184,.9))!important}
[data-press="latido"].wb-pressing{animation:wb-latido-fx .5s ease!important}
@keyframes wb-latido-fx{0%,100%{transform:scale(1)}30%{transform:scale(1.12)}60%{transform:scale(.96)}}
[data-press="sacudida"].wb-pressing{animation:wb-shake-fx .4s ease!important}
@keyframes wb-shake-fx{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
[data-press="hundir"].wb-pressing{transform:scale(.96) translateY(3px)!important;filter:brightness(.85)}

/* ── Efectos al pasar el cursor (data-hover) ── */
[data-hover]{transition:transform .25s cubic-bezier(.2,.8,.25,1),filter .25s,box-shadow .25s}
[data-hover="elevar"]:hover{transform:translateY(-6px);box-shadow:0 18px 44px rgba(0,0,0,.4)}
[data-hover="zoom"]:hover{transform:scale(1.05)}
[data-hover="brillo"]:hover{filter:brightness(1.25) drop-shadow(0 0 16px rgba(255,155,184,.7))}
[data-hover="flotar"]:hover{animation:wb-float 1.8s ease-in-out infinite}
[data-hover="girar"]:hover{transform:rotate(3deg) scale(1.03)}

/* ── Botón de navegación (variantes) ── */
.wb-nav{width:100%;height:100%;border:none;cursor:pointer;font:inherit;color:inherit;background:inherit;border-radius:inherit;display:flex;align-items:center;justify-content:center;gap:8px;text-shadow:inherit}
.wb-nav .wb-nav-arrow{font-size:1.25em;line-height:1;animation:wb-navnudge 1.6s ease-in-out infinite}
.wb-nav[data-dir="prev"] .wb-nav-arrow{animation-name:wb-navnudge-prev}
@keyframes wb-navnudge{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
@keyframes wb-navnudge-prev{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px)}}
.wb-nav-burbuja{border-radius:50%!important}

/* ── Mensaje flotante (acción showMessage) ── */
.wb-toast{position:fixed;left:50%;bottom:9%;transform:translateX(-50%) translateY(20px);z-index:9999;
  max-width:82vw;padding:14px 24px;border-radius:22px;background:rgba(28,28,30,.86);color:#fff;
  font:600 16px/1.4 -apple-system,system-ui,sans-serif;text-align:center;
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  box-shadow:0 12px 40px rgba(0,0,0,.45),0 0 0 .5px rgba(255,255,255,.12);
  animation:wb-toast-in .45s cubic-bezier(.2,.8,.25,1) both;pointer-events:none}
.wb-toast.out{animation:wb-toast-out .6s ease both}
@keyframes wb-toast-in{from{opacity:0;transform:translateX(-50%) translateY(26px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes wb-toast-out{to{opacity:0;transform:translateX(-50%) translateY(14px) scale(.94)}}

/* ── Placeholders (editor y export degradado) ── */
.wb-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;height:100%;border:2px dashed #334155;border-radius:inherit;color:#64748b;font-weight:600;text-align:center;padding:8px;font-size:14px}
.wb-placeholder small{font-weight:400;font-size:11px}

/* ── Transiciones de página ── */
@keyframes wb-page-fade{from{opacity:0}to{opacity:1}}
@keyframes wb-page-slide{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@keyframes wb-page-zoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes wb-page-blur{from{opacity:0;filter:blur(16px)}to{opacity:1;filter:blur(0)}}
@keyframes wb-page-circulo{from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(140% at 50% 50%)}}
@keyframes wb-page-cortina{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes wb-page-giro3d{from{opacity:0;transform:perspective(1100px) rotateY(-24deg) scale(.94)}to{opacity:1;transform:perspective(1100px) rotateY(0) scale(1)}}
@keyframes wb-page-ascenso{from{opacity:0;transform:translateY(70px)}to{opacity:1;transform:none}}
.wb-enter-fade{animation:wb-page-fade var(--tdur,.6s) ease-out both}
.wb-enter-slide{animation:wb-page-slide var(--tdur,.6s) ease-out both}
.wb-enter-zoom{animation:wb-page-zoom var(--tdur,.6s) ease-out both}
.wb-enter-blur{animation:wb-page-blur var(--tdur,.7s) ease-out both}
.wb-enter-circulo{animation:wb-page-circulo var(--tdur,.9s) ease-in-out both}
.wb-enter-cortina{animation:wb-page-cortina var(--tdur,.8s) cubic-bezier(.7,0,.2,1) both}
.wb-enter-giro3d{animation:wb-page-giro3d var(--tdur,.8s) cubic-bezier(.2,.8,.25,1) both}
.wb-enter-ascenso{animation:wb-page-ascenso var(--tdur,.7s) cubic-bezier(.2,.8,.25,1) both}
.wb-enter-corazones,.wb-enter-estrellas,.wb-enter-nieve{animation:wb-page-fade var(--tdur,.8s) ease-out both}
.wb-transition-overlay{position:fixed;inset:0;z-index:9998;pointer-events:none}
`;
