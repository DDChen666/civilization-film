// 第一層：岩壁上的手印。
// 手印是「噴出來的」：手按在岩壁上，顏料往手上吹，手拿開後留下一圈顏料和一個手形的空白。
// 所以這裡沒有畫手，只有幾萬顆顏料的點，手是它們圍出來的。
(function (root) {
  'use strict';
  const { clamp, sstep, rng, fbm, lerp } = E;
  const smin = (a, b, k) => { const h = clamp(0.5 + (0.5 * (b - a)) / k); return b + (a - b) * h - k * h * (1 - h); };
  function cap(px, py, ax, ay, bx, by, ra, rb) {
    const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
    const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
    return Math.hypot(pax - bax * h, pay - bay * h) - (ra + (rb - ra) * h);
  }
  function rbox(px, py, cx, cy, hx, hy, r) {
    const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  }
  // 手的形狀（公分；手腕在下、手指朝上、拇指在左）：掌 + 四指 + 拇指兩節 + 前臂
  const FING = [[-2.75, 8.3, 7.0, 0.98, 0.8, -11], [-0.65, 8.9, 7.9, 1.02, 0.82, -2.5], [1.45, 8.6, 7.2, 0.96, 0.78, 6.5], [3.25, 7.5, 5.6, 0.84, 0.68, 17]];
  function handSDF(x, y) {
    let d = rbox(x, y, 0.2, 4.6, 4.2, 4.5, 2.4);
    for (const [bx, by, L, r0, r1, a] of FING) { const an = (a * Math.PI) / 180; d = smin(d, cap(x, y, bx, by - 1.0, bx + Math.sin(an) * L, by + Math.cos(an) * L, r0, r1), 0.9); }
    d = smin(d, cap(x, y, -2.6, 2.6, -5.6, 5.2, 1.55, 1.15), 1.4);
    d = smin(d, cap(x, y, -5.6, 5.2, -7.3, 8.0, 1.15, 0.9), 0.5);
    d = smin(d, cap(x, y, 0.25, 1.2, 0.5, -3.2, 2.75, 2.6), 1.5);
    d = smin(d, cap(x, y, 0.5, -3.2, 0.9, -13, 2.6, 3.1), 0.8);
    return d;
  }

  const BOX = { x0: -27, x1: 27, y0: -16, y1: 36 };   // 一個手印佔的範圍（公分）
  /** 做一個手印：回傳顏料點（依顏色分組）和一張柔和的底圖。 */
  function makeStencil(seed, { n = 150000, spread = 1 } = {}) {
    const r = rng(seed);
    const puffs = [];
    for (let i = 0; i < 11; i++) {       // 顏料是一口一口吹上去的：十來團，繞著手
      const a = r() * Math.PI * 2, rad = 3.0 + r() * 6;
      puffs.push([0.2 + Math.cos(a) * rad * 0.9, 8.5 + Math.sin(a) * rad * 1.2, (3.6 + r() * 2.6) * spread, 0.6 + r() * 0.6]);
    }
    const dens = (x, y) => {
      const d = handSDF(x, y);
      if (d < 0) return 0.004;
      let s = 0;
      for (const [px, py, sg, w] of puffs) s += w * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * sg * sg));
      return sstep(0.0, 0.16, d) * Math.min(1, s * 1.15) * (0.4 + 1.0 * fbm(x * 0.15 + seed, y * 0.15, 3, seed)) * Math.exp(-Math.pow(d / 7.5, 2)) * sstep(-15, -6, y);
    };
    const groups = [[], [], [], []];
    const w = BOX.x1 - BOX.x0, h = BOX.y1 - BOX.y0;
    for (let i = 0; i < n; i++) {
      const x = BOX.x0 + r() * w, y = BOX.y0 + r() * h, p = dens(x, y), u = r(), big = r();
      if (u > p) continue;
      const size = big > 0.985 ? 0.11 + r() * 0.12 : 0.028 + r() * r() * 0.07;     // 公分；偶爾一顆大的
      groups[(r() * 4) | 0].push(x, y, size, r());                                 // 最後一個數：這顆點第幾個被吹上去（0..1）
    }
    const S = 300, tex = document.createElement('canvas'); tex.width = tex.height = S;
    const tg = tex.getContext('2d'), im = tg.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = BOX.x0 + ((i + 0.5) / S) * w, y = BOX.y1 - ((j + 0.5) / S) * h, k = (j * S + i) * 4;
      const p = Math.pow(dens(x, y), 1.15);
      im.data[k] = 255; im.data[k + 1] = 255; im.data[k + 2] = 255; im.data[k + 3] = Math.min(255, p * 255);
    }
    tg.putImageData(im, 0, 0);
    return { groups: groups.map((a) => new Float32Array(a)), tex };
  }

  // 岩壁：兩張圖。一張大的（整面牆的明暗），一張細的（近看的顆粒與凹凸，重複鋪）。兩張都算了受光：火在左下方
  function bake(px, py, fn) {
    const c = document.createElement('canvas'); c.width = px; c.height = py;
    const g = c.getContext('2d'), im = g.createImageData(px, py);
    for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) { const [r, gg, b, a] = fn(i, j); const k = (j * px + i) * 4; im.data[k] = r; im.data[k + 1] = gg; im.data[k + 2] = b; im.data[k + 3] = a; }
    g.putImageData(im, 0, 0);
    return c;
  }
  function makeRock(Wm = 4.2, Hm = 2.4, px = 1680) {
    const py = Math.round((px * Hm) / Wm);
    const hgt = (x, y) => { const w = fbm(x * 1.3, y * 1.3, 3, 5) * 1.6; return fbm(x * 2.2 + w, y * 3.4 - w, 5, 11) * 1.0 - Math.abs(fbm(x * 6 + w * 2, y * 4.5, 4, 23) - 0.5) * 0.5; };
    const c = bake(px, py, (i, j) => {
      const x = (i / px) * Wm, y = (j / py) * Hm, e = 0.006;
      const h = hgt(x, y), lit = ((hgt(x - e, y + e) - h) / e) * 0.055;        // 光從左下來：往左下升高的坡面亮
      const v = clamp(0.3 + (h - 0.35) * 1.5 + lit * 1.5);
      const ex = Math.min(i, px - 1 - i) / (px * 0.16), ey = Math.min(j, py - 1 - j) / (py * 0.2), edge = sstep(0, 1, Math.min(ex, ey) + (fbm(x * 3, y * 3, 2, 91) - 0.5) * 0.5);
      return [13 + v * 62, 10 + v * 46, 9 + v * 38, 255 * edge];
    });
    const T = 768, Tm = 0.62;                                                  // 細節圖：0.62 公尺一塊
    const per = (x, y, f, oct, seed) => {                                      // 可以無縫重複的 fbm
      const u = x / Tm, v = y / Tm, a = fbm(x * f, y * f, oct, seed), b = fbm((x - Tm) * f, y * f, oct, seed), c2 = fbm(x * f, (y - Tm) * f, oct, seed), d = fbm((x - Tm) * f, (y - Tm) * f, oct, seed);
      return lerp(lerp(a, b, u), lerp(c2, d, u), v);
    };
    const dh = (x, y) => per(x, y, 34, 4, 31) * 0.6 + Math.pow(per(x, y, 90, 3, 47), 2) * 0.5;
    const detail = bake(T, T, (i, j) => {
      const x = (i / T) * Tm, y = (j / T) * Tm, e = Tm / T;
      const h = dh(x, y), lit = (dh((x - e + Tm) % Tm, (y + e) % Tm) - h) * 9;
      const sp = E.hash(i, j, 3) > 0.9965 ? 60 : 0;
      const v = clamp(0.5 + lit + (h - 0.45) * 0.5) * 255;
      return [v + sp, v * 0.97 + sp, v * 0.93 + sp, 255];
    });
    return { c, Wm, Hm, detail, Tm };
  }
  function makeCracks(seed, n = 9) {
    const r = rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      let x = -1.9 + r() * 3.8, z = -1.0 + r() * 2.0, a = r() * Math.PI * 2;
      const pts = [], steps = 30 + ((r() * 70) | 0);
      for (let s = 0; s < steps; s++) { pts.push([x, 0, z]); a += (fbm(x * 3, z * 3, 2, seed + i) - 0.5) * 1.5 + (r() - 0.5) * 0.5; x += Math.cos(a) * 0.022; z += Math.sin(a) * 0.022 * 0.7; }
      out.push({ pts, w: 0.6 + r() * 1.1, a: 0.05 + r() * 0.1 });
    }
    return out;
  }

  // 一張圖貼在岩壁（y=0 的平面）上：用三個角的投影算出仿射變換
  function drawOnWall(g, cam, img, x0, z0, x1, z1, alpha = 1, op = 'source-over') {
    const A = cam.proj([x0, 0, z1]), B = cam.proj([x1, 0, z1]), Cc = cam.proj([x0, 0, z0]);
    if (!A || !B || !Cc) return;
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = op;
    g.transform((B[0] - A[0]) / img.width, (B[1] - A[1]) / img.width, (Cc[0] - A[0]) / img.height, (Cc[1] - A[1]) / img.height, A[0], A[1]);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0); g.restore();
  }

  let ROCK, CRACKS, STENCILS, TINT = {};
  // 手印的位置（公尺，岩壁上）、角度、大小、顏色、多亮、是不是左手
  const HANDS = [
    { x: 0.075, z: -0.07, rot: -0.1, s: 1.0, col: 'ochre', a: 1.0, seed: 11, main: true },
    { x: -0.335, z: 0.075, rot: 0.42, s: 0.93, col: 'umber', a: 0.95, seed: 23, flip: true },
    { x: 0.5, z: 0.115, rot: -0.5, s: 0.9, col: 'umber', a: 0.7, seed: 37 },
    { x: -0.17, z: -0.13, rot: 0.12, s: 0.86, col: 'bone', a: 0.5, seed: 41 },
    { x: 0.33, z: -0.36, rot: -0.22, s: 0.95, col: 'ochre', a: 0.3, seed: 53, flip: true },
    { x: -0.62, z: -0.2, rot: 0.75, s: 0.9, col: 'bone', a: 0.26, seed: 67 },
    { x: 0.72, z: -0.12, rot: -0.8, s: 0.86, col: 'umber', a: 0.3, seed: 71, flip: true },
    { x: -0.52, z: 0.36, rot: 0.3, s: 0.84, col: 'ochre', a: 0.24, seed: 83 },
    { x: 0.14, z: 0.42, rot: -0.15, s: 0.8, col: 'umber', a: 0.26, seed: 97, flip: true },
    { x: 0.86, z: 0.3, rot: -0.35, s: 0.9, col: 'bone', a: 0.2, seed: 101 },
    { x: -0.92, z: 0.1, rot: 0.55, s: 0.92, col: 'ochre', a: 0.2, seed: 113, flip: true },
  ];
  const COLS = {
    ochre: ['#f0562c', '#d6411f', '#b8341a', '#ff7a45'],
    umber: ['#b4532e', '#96401f', '#c8643a', '#7c3018'],
    bone: ['#e9dcc4', '#cfc0a6', '#f6ecd8', '#b5a68c'],
  };
  function init() {
    ROCK = makeRock(); CRACKS = makeCracks(9);
    STENCILS = HANDS.map((h) => makeStencil(h.seed, { n: h.main ? 260000 : 90000, spread: h.main ? 1 : 0.9 }));
    for (const [name, cs] of Object.entries(COLS)) {     // 柔和底圖的顏色版本
      TINT[name] = (tex) => { const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height; const g = c.getContext('2d'); g.drawImage(tex, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = cs[1]; g.fillRect(0, 0, c.width, c.height); return c; };
    }
    HANDS.forEach((h, i) => { STENCILS[i].soft = TINT[h.col](STENCILS[i].tex); });
  }

  /** bg：畫在主畫布上（不發光的岩壁）。 */
  function drawWall(g, cam, alpha = 1, grainK = 1) {
    drawOnWall(g, cam, ROCK.c, -ROCK.Wm / 2, -ROCK.Hm / 2, ROCK.Wm / 2, ROCK.Hm / 2, alpha);
    if (grainK > 0.01) drawGrain(g, cam, 0.75 * grainK);
  }
  /** 顏料畫完之後再蓋：岩石的顆粒（顏料也跟著凹凸）、火光、暗角。 */
  function drawGrain(g, cam, amount = 1) {
    const pxPerM = cam.foc / cam.dist, da = clamp((pxPerM * ROCK.Tm) / 768 / 0.35, 0, 1) * amount;      // 細節圖縮得太小就不鋪
    if (da > 0.02) {
      const O = cam.proj([0, 0, 0]), X = cam.proj([ROCK.Tm, 0, 0]), Z = cam.proj([0, 0, -ROCK.Tm]);
      g.save(); g.globalAlpha = da; g.globalCompositeOperation = 'overlay';
      g.transform((X[0] - O[0]) / 768, (X[1] - O[1]) / 768, (Z[0] - O[0]) / 768, (Z[1] - O[1]) / 768, O[0], O[1]);
      g.fillStyle = ROCK.pat || (ROCK.pat = g.createPattern(ROCK.detail, 'repeat'));
      g.fillRect(-768 * 6, -768 * 6, 768 * 12, 768 * 12); g.restore();
    }
  }
  function drawLight(g, cam, { fire = 1, flick = 0, vig = 1, grain = 0.42 } = {}) {
    if (grain > 0.01) drawGrain(g, cam, grain);
    // 火光：從左下方照上來，會晃
    const W = cam.W, H = cam.H;
    const fx = W * (0.1 + flick * 0.02), fy = H * 1.12, gr = g.createRadialGradient(fx, fy, 0, fx, fy, W * 0.95);
    gr.addColorStop(0, `rgba(255,170,90,${0.62 * fire})`); gr.addColorStop(0.45, `rgba(225,96,40,${0.2 * fire})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    const sh = g.createRadialGradient(W * 0.5, H * 0.56, H * 0.18, W * 0.46, H * 0.6, W * 0.7);
    sh.addColorStop(0, `rgba(0,0,0,${0.12 * vig})`); sh.addColorStop(1, `rgba(3,2,3,${0.93 * vig})`);
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
  }
  /** 顏料：畫在發光的圖層上。grow(i) → 第 i 個手印吹到哪裡了（0..1）。 */
  function drawHands(g, cam, { grow = () => 1, gain = 1 } = {}) {
    const pxPerM = cam.foc / cam.dist;
    HANDS.forEach((h, i) => {
      const k = grow(i); if (k <= 0) return;
      const st = STENCILS[i], sc = 0.01 * h.s, c = Math.cos(h.rot), s = Math.sin(h.rot), fl = h.flip ? -1 : 1;
      const O = cam.proj([h.x, 0, h.z]), X = cam.proj([h.x + c * sc, 0, h.z + s * sc]), Y = cam.proj([h.x - s * sc, 0, h.z + c * sc]);
      if (!O || !X || !Y) return;
      g.save();
      g.transform((X[0] - O[0]) * fl, (X[1] - O[1]) * fl, Y[0] - O[0], Y[1] - O[1], O[0], O[1]);   // 之後用「公分」畫，y 向上
      g.globalAlpha = (h.main ? 0.5 : 0.34) * h.a * gain * Math.min(1, k * 1.4);
      g.imageSmoothingEnabled = true;
      g.save(); g.scale(1, -1); g.drawImage(st.soft, BOX.x0, -BOX.y1, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); g.restore();
      const cols = COLS[h.col], pxPerCm = pxPerM * sc, minS = 0.55 / pxPerCm;
      for (let q = 0; q < 4; q++) {
        const a = st.groups[q];
        g.fillStyle = cols[q]; g.globalAlpha = Math.min(1, (0.5 + q * 0.14) * h.a * gain * clamp(pxPerCm / 9, 0.25, 1));
        g.beginPath();
        for (let j = 0; j < a.length; j += 4) {
          if (a[j + 3] > k) continue;
          const sz = Math.max(a[j + 2], minS);
          if (sz * pxPerCm > 1.7) { g.moveTo(a[j] + sz / 2, a[j + 1]); g.arc(a[j], a[j + 1], sz / 2, 0, 6.2832); }
          else g.rect(a[j] - sz / 2, a[j + 1] - sz / 2, sz, sz);
        }
        g.fill();
      }
      g.restore();
    });
    g.globalAlpha = 1;
  }

  /** 把岩石的大圖拉大貼在一整面岩壁上（鏡頭退遠之後，岩壁還是一片石頭，不是浮在空中的一小塊） */
  function drawCliff(g, cam, x0, z0, x1, z1, alpha) { drawOnWall(g, cam, ROCK.c, x0, z0, x1, z1, alpha); }
  root.Cave = { init, drawWall, drawLight, drawHands, drawCliff, handSDF, HANDS };
})(typeof self !== 'undefined' ? self : this);
