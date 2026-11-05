/* =====================================================================
 *  shanhai-intro.js —— 山海經網站開場動畫「青綠山水」
 *
 *  用法：把 shanhai-intro.js 與 shanhai-bg.jpg 放在首頁同一資料夾，
 *  在 index.html 的 </body> 前加一行：
 *    <script src="shanhai-intro.js"><\/script>
 *
 *  · 畫作從宣紙上如墨跡暈染般顯現，鏡頭緩推，雲霧流動、金塵飄升
 *  · 只在訪客第一次來時播放；網址加 ?intro=1 可強制重播
 *  · 隨時可按「略過」或 Esc；看完按朱印「入山」進入
 *  · 進入時發出 window 事件 'shanhai:enter'
 *  · 「減少動態效果」的訪客直接看到最後畫面；WebGL 不可用時改用靜態圖
 * ===================================================================== */

(function () {
'use strict';
const HERE = (document.currentScript && document.currentScript.src)
  ? new URL('.', document.currentScript.src).href : new URL('.', location.href).href;
const IS_FILE = location.protocol === 'file:' && !String(window.SHANHAI_BG_URL || '').startsWith('data:');   // 本地打開且畫作是外部檔：瀏覽器禁止 WebGL 讀取，改用 CSS 版
const BG_URL = window.SHANHAI_BG_URL || HERE + 'shanhai-bg.jpg';
const STORAGE_KEY = 'shanhai-intro-seen';
const REVEAL_END = 3.6;    // 墨暈顯畫完成（秒）
const TITLE_AT = 3.0;      // 標題開始浮現
const BUTTON_AT = 6.8;     // 「入山」出現
const CAM_END = 10.0;      // 鏡頭緩推結束

const params = new URLSearchParams(location.search);
const forced = params.has('intro');
const freezeT = params.has('introT') ? +params.get('introT') : null;   // 截圖調試用
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let seen = false;
try { seen = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { /* 私密模式 */ }
window.SHANHAI_REPLAY = () => { if (!document.getElementById('shanhai-intro')) start(); };
if (!seen || forced) start();

// 固定種子亂數：每次打開都一樣
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------
// 介面
// ---------------------------------------------------------------------
function buildOverlay() {
  if (!document.querySelector('link[data-shanhai-font]')) {
    const f = document.createElement('link');
    f.rel = 'stylesheet';
    f.dataset.shanhaiFont = '';
    f.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;900&display=swap';
    document.head.appendChild(f);
  }
  const css = document.createElement('style');
  css.textContent = `
  #shanhai-intro{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#efe3c6;
    font-family:'Noto Serif TC',serif;transition:opacity 1.6s ease, filter 1.6s ease}
  #shanhai-intro canvas,#shanhai-intro .sh-static{position:absolute;inset:0;width:100%;height:100%;display:block;
    transition:transform 1.8s cubic-bezier(.5,0,.2,1)}
  #shanhai-intro .sh-static{object-fit:cover;object-position:56% 50%}
  @property --shr{syntax:'<percentage>';inherits:false;initial-value:0%}
  #shanhai-intro .sh-static.anim{transform-origin:56% 52%;
    -webkit-mask-image:radial-gradient(circle at 55% 48%,#000 var(--shr),transparent calc(var(--shr) + 18%));
            mask-image:radial-gradient(circle at 55% 48%,#000 var(--shr),transparent calc(var(--shr) + 18%));
    animation:shReveal 3.6s ease-in-out forwards, shZoom 10s cubic-bezier(.2,.6,.3,1) forwards}
  @keyframes shReveal{from{--shr:0%}to{--shr:120%}}
  @keyframes shZoom{from{transform:scale(1.16)}to{transform:scale(1.03)}}
  #shanhai-intro.leaving{opacity:0;filter:brightness(1.25) blur(2px)}
  #shanhai-intro.leaving canvas,#shanhai-intro.leaving .sh-static{transform:scale(1.1)}
  .sh-center{position:absolute;left:0;right:0;top:8vh;text-align:center;pointer-events:none}
  .sh-title{margin:0;font-weight:900;font-size:clamp(54px,11vw,132px);letter-spacing:.2em;padding-left:.2em;line-height:1.1;color:#24201b}
  .sh-title span{display:inline-block;opacity:0;transform:translateY(14px) scale(.97);filter:blur(12px);
    text-shadow:0 0 22px rgba(244,232,205,.95),0 0 8px rgba(244,232,205,.9);
    transition:opacity 1.6s ease, transform 1.8s cubic-bezier(.2,.7,.2,1), filter 1.6s ease}
  .sh-title span.on{opacity:1;transform:none;filter:blur(0)}
  .sh-sub{margin-top:1em;font-weight:500;font-size:clamp(14px,2vw,19px);letter-spacing:.55em;padding-left:.55em;
    color:#4a3f30;text-shadow:0 0 10px rgba(244,232,205,1),0 0 4px rgba(244,232,205,1);opacity:0;transition:opacity 2s ease}
  .sh-sub.on{opacity:.95}
  .sh-enter{position:absolute;left:50%;bottom:10vh;width:clamp(64px,9vw,82px);height:clamp(104px,15vw,136px);
    transform:translateX(-50%) rotate(-4deg) scale(1.25);border:0;border-radius:6px;cursor:pointer;
    background:#b3322a;color:#f7ead2;font:900 clamp(24px,3.4vw,32px)/1 'Noto Serif TC',serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25em;
    box-shadow:inset 0 0 0 4px #b3322a,inset 0 0 0 6px #f2dcc0,0 6px 18px rgba(80,20,10,.35);
    opacity:0;pointer-events:none;transition:opacity .5s ease, transform .5s cubic-bezier(.3,1.6,.5,1), box-shadow .3s ease}
  .sh-enter.on{opacity:.96;pointer-events:auto;transform:translateX(-50%) rotate(-4deg) scale(1)}
  .sh-enter:hover,.sh-enter:focus-visible{outline:none;
    box-shadow:inset 0 0 0 4px #b3322a,inset 0 0 0 6px #f2dcc0,0 0 0 6px rgba(179,50,42,.18),0 8px 26px rgba(80,20,10,.45)}
  .sh-skip{position:absolute;top:18px;right:20px;background:rgba(244,232,205,.55);border:1px solid rgba(36,32,27,.45);
    color:#24201b;font:500 14px/1 'Noto Serif TC',serif;letter-spacing:.3em;padding:9px 10px 9px 14px;border-radius:20px;
    cursor:pointer;opacity:.7;transition:opacity .3s;backdrop-filter:blur(2px)}
  .sh-skip:hover,.sh-skip:focus-visible{opacity:1;outline:none}
  `;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.id = 'shanhai-intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '山海經 開場');
  root.innerHTML = `
    <div class="sh-center">
      <h1 class="sh-title" aria-label="山海經"><span>山</span><span>海</span><span>經</span></h1>
      <div class="sh-sub">崑崙之虛　百神之所在</div>
    </div>
    <button class="sh-enter" type="button" aria-label="入山"><span>入</span><span>山</span></button>
    <button class="sh-skip" type="button">略過</button>`;
  document.body.appendChild(root);
  return root;
}

// ---------------------------------------------------------------------
// 主程式
// ---------------------------------------------------------------------
async function start() {
  const root = buildOverlay();
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  const letters = [...root.querySelectorAll('.sh-title span')];
  const sub = root.querySelector('.sh-sub');
  const enterBtn = root.querySelector('.sh-enter');
  const skipBtn = root.querySelector('.sh-skip');

  let stopRender = () => {};
  let leaving = false;
  const onKey = (e) => { if (e.key === 'Escape') finish(true); };
  function finish(animated) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* 忽略 */ }
    const done = () => {
      stopRender();
      removeEventListener('keydown', onKey);
      root.remove();
      document.documentElement.style.overflow = prevOverflow;
      window.dispatchEvent(new CustomEvent('shanhai:enter'));
    };
    if (animated) { root.classList.add('leaving'); setTimeout(done, 1700); } else done();
  }
  enterBtn.addEventListener('click', () => finish(true));
  skipBtn.addEventListener('click', () => finish(true));
  addEventListener('keydown', onKey);

  function updateUI(t) {
    letters.forEach((s, i) => s.classList.toggle('on', t >= TITLE_AT + i * 0.5));
    sub.classList.toggle('on', t >= TITLE_AT + 2.0);
    enterBtn.classList.toggle('on', t >= BUTTON_AT);
  }

  // CSS 版：暈染顯現 + 緩推（本地打開、離線、或 WebGL 不可用時）
  async function cssMode() {
    const img = document.createElement('img');
    img.className = 'sh-static'; img.alt = ''; img.src = BG_URL;
    try { await img.decode(); } catch (e) { /* 照常顯示 */ }
    if (!reduceMotion && freezeT === null) img.classList.add('anim');
    root.prepend(img);
    if (reduceMotion || freezeT !== null) { updateUI(freezeT ?? 99); window.__shanhaiReady = true; return; }
    let raf = 0, t0 = null;
    const loop = (now) => { if (t0 === null) t0 = now; updateUI((now - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    stopRender = () => cancelAnimationFrame(raf);
    window.__shanhaiReady = true;
  }
  const staticFallback = cssMode;

  // 本地直接打開：CSS 版（暈染顯現 + 緩推），時間軸照常
  if (IS_FILE) { await cssMode(); return; }

  // 先載入畫作，載好才開始計時（避免慢網速時動畫空跑）
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = BG_URL;
  try { await image.decode(); }
  catch (e) { console.warn('[shanhai-intro] 背景圖載入失敗', e); updateUI(99); window.__shanhaiReady = true; return; }

  let scene;
  try { scene = createScene(root, image); }
  catch (e) { console.warn('[shanhai-intro] WebGL 不可用，改用靜態畫面', e); staticFallback(); return; }

  if (freezeT !== null || reduceMotion) {
    const t = freezeT ?? CAM_END;
    scene.render(t); updateUI(t);
    stopRender = scene.dispose;
    window.__shanhaiReady = true;
    return;
  }

  let raf = 0, t0 = null;
  const loop = (now) => {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    scene.render(t);
    updateUI(t);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  stopRender = () => { cancelAnimationFrame(raf); scene.dispose(); };
  window.__shanhaiReady = true;
}

// ---------------------------------------------------------------------
// 畫面：畫作 + 墨暈顯現 + 緩推 + 流雲 + 金塵
// ---------------------------------------------------------------------
function createScene(root, image) {
  const rand = seeded(20261022);
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('no webgl');
  root.prepend(canvas);
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };

  // 畫作材質
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // 全畫面四邊形：畫作 + 墨暈 + 雲霧
  const pQuad = prog(`attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`,
    `precision highp float;\n` + `
      uniform sampler2D uTex; uniform float uT, uImgAspect; uniform vec2 uRes, uFocus; uniform vec3 uPaper;
      varying vec2 vUv;
      float h3(vec3 p){ p=fract(p*0.3183099+vec3(.71,.113,.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s/.96875; }
      float ease(float x){ x = clamp(x,0.0,1.0); return 1.0 - pow(1.0-x, 3.0); }

      void main(){
        float sa = uRes.x/uRes.y;
        float k = ease(uT/${CAM_END.toFixed(1)});

        // object-fit: cover，以焦點為中心緩推（1.14 → 1.0）
        vec2 hv = vec2(0.5);
        if (sa > uImgAspect) hv.y *= uImgAspect/sa; else hv.x *= sa/uImgAspect;
        float zoom = mix(1.16, 1.03, k);                          // 留 3% 邊給微晃，永不露出畫布邊緣
        hv /= zoom;
        vec2 c = mix(uFocus, vec2(uFocus.x, 0.5), k) + vec2(sin(uT*0.11)*0.004, cos(uT*0.09)*0.003);
        c = clamp(c, hv, 1.0 - hv);
        vec2 uv = c + (vUv - 0.5) * 2.0 * hv;

        vec3 col = texture2D(uTex, uv).rgb;

        // 雲霧流動：集中在畫面中下段的雲海
        float band = smoothstep(0.08, 0.42, uv.y) * smoothstep(0.82, 0.5, uv.y);
        float m1 = fbm(vec3(uv.x*3.2 - uT*0.035, uv.y*7.0, uT*0.05));
        float m2 = fbm(vec3(uv.x*6.0 + uT*0.05, uv.y*11.0, 3.0 + uT*0.04));
        float mist = smoothstep(0.5, 0.85, m1*0.65 + m2*0.35) * band;
        col = mix(col, vec3(0.985, 0.965, 0.92), mist*0.55);

        // 上方晨光：標題區更亮、更乾淨
        float top = smoothstep(0.55, 1.0, vUv.y);
        col = mix(col, uPaper*1.03, top*0.3);
        col += vec3(1.0, 0.86, 0.55) * pow(max(0.0, 1.0 - length((vUv - vec2(0.5, 1.05))*vec2(1.0, 1.6))), 3.0) * 0.16;

        // 墨暈顯現：由中心向外擴散，邊緣像墨在宣紙上滲開
        float d = length((vUv - vec2(0.55, 0.48))*vec2(sa, 1.0)) / max(sa, 1.0);
        float n = fbm(vec3(vUv*vec2(sa,1.0)*4.0, 1.7));
        float r = smoothstep(0.0, 1.0, uT/${REVEAL_END.toFixed(1)}) * 1.0;
        float edge = d + (n - 0.5)*0.35;
        float hide = smoothstep(r - 0.12, r - 0.02, edge);              // 1 = 仍是白紙
        float ring = 1.0 - smoothstep(0.0, 0.05, abs(edge - (r - 0.06)));
        vec3 paper = uPaper * (0.97 + 0.03*fbm(vec3(vUv*30.0, 0.0)));
        col = mix(col, paper, hide);
        col *= 1.0 - ring*0.1*(1.0 - step(${REVEAL_END.toFixed(1)}, uT - 0.4));

        // 宣紙暗角與抖色
        float vig = smoothstep(1.15, 0.45, length((vUv - 0.5)*vec2(1.0, 1.25)));
        col *= mix(0.88, 1.0, vig);
        col += (h3(vec3(gl_FragCoord.xy, 0.0)) - 0.5) / 255.0;

        gl_FragColor = vec4(col, 1.0);
        
      }`);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const qLoc = { aPos: gl.getAttribLocation(pQuad, 'aPos') };
  ['uTex','uT','uImgAspect','uRes','uFocus','uPaper'].forEach(n => qLoc[n] = gl.getUniformLocation(pQuad, n));
  const focus = [0.56, 0.52];

  // 金色光塵
  const N = 260, pdata = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pdata[i*3] = rand()*2-1; pdata[i*3+1] = rand()*2-1; pdata[i*3+2] = rand(); }
  const pMote = prog(`attribute vec2 aPos; attribute float seed; uniform float uT, uPx; varying float vA;
      void main(){ vec2 p = aPos;
        p.y = mod(p.y + 1.0 + uT*(0.015 + seed*0.03), 2.2) - 1.1;
        p.x += sin(uT*0.4 + seed*30.0)*0.02;
        float fade = smoothstep(-1.1, -0.6, p.y) * smoothstep(1.1, 0.4, p.y) * smoothstep(1.0, 4.0, uT);
        vA = fade * (0.35 + 0.35*sin(uT*1.7 + seed*50.0));
        gl_PointSize = uPx * (1.5 + seed*3.0);
        gl_Position = vec4(p, 0.0, 1.0); }`,
    `precision mediump float; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.86, 0.6)*a, a); }`);
  const mb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mb); gl.bufferData(gl.ARRAY_BUFFER, pdata, gl.STATIC_DRAW);
  const mLoc = { aPos: gl.getAttribLocation(pMote, 'aPos'), seed: gl.getAttribLocation(pMote, 'seed'),
    uT: gl.getUniformLocation(pMote, 'uT'), uPx: gl.getUniformLocation(pMote, 'uPx') };

  let W = 1, H = 1, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    W = w; H = h;
    focus[0] = w / h < 0.8 ? 0.6 : 0.56;   // 直式螢幕：焦點移向樓閣
  }
  resize();
  addEventListener('resize', resize);

  function render(t) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(pQuad);
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.enableVertexAttribArray(qLoc.aPos); gl.vertexAttribPointer(qLoc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(qLoc.uTex, 0); gl.uniform1f(qLoc.uT, t);
    gl.uniform1f(qLoc.uImgAspect, image.naturalWidth / image.naturalHeight);
    gl.uniform2f(qLoc.uRes, W, H); gl.uniform2f(qLoc.uFocus, focus[0], focus[1]);
    gl.uniform3f(qLoc.uPaper, 0xef/255, 0xe3/255, 0xc6/255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(qLoc.aPos);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pMote);
    gl.bindBuffer(gl.ARRAY_BUFFER, mb);
    gl.enableVertexAttribArray(mLoc.aPos); gl.vertexAttribPointer(mLoc.aPos, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(mLoc.seed); gl.vertexAttribPointer(mLoc.seed, 1, gl.FLOAT, false, 12, 8);
    gl.uniform1f(mLoc.uT, t); gl.uniform1f(mLoc.uPx, dpr);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(mLoc.aPos); gl.disableVertexAttribArray(mLoc.seed);
  }
  function dispose() {
    removeEventListener('resize', resize);
    gl.deleteTexture(tex); gl.deleteBuffer(qb); gl.deleteBuffer(mb); gl.deleteProgram(pQuad); gl.deleteProgram(pMote);
  }
  return { render, dispose };
}

})();
