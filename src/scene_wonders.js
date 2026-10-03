// 奇觀與科技：終段跟著拍子一個一個出現的東西。每一個都是真三維的線稿加燈火，和巴比倫那一幕同一種畫法。
// 尺寸盡量用真的（寫在各自的註解裡）；周圍的地景是程式長出來的。
(function (root) {
  'use strict';
  const { add, sub, mul, dot, cross, norm, len, mix, clamp, lerp, sstep, rng, hash, fbm } = E;
  let S = null;
  const BONE = '#efe4cf';

  function sprite(stops, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [k, col] of stops) gr.addColorStop(k, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }
  /** 一團光：p 是世界座標，m 是它在世界裡的直徑（公尺） */
  const glowAt = (g, cam, p, spr, m, a = 1) => { const s = cam.proj(p); if (!s) return null; const k = m * (cam.foc / s[2]); if (k < 0.5 || k > 4000) return s; g.globalAlpha = Math.min(1, a); g.drawImage(spr, s[0] - k / 2, s[1] - k / 2, k, k); g.globalAlpha = 1; return s; };
  const horizonY = (cam) => { const p = cam.proj([cam.eye[0] + cam.f[0] * 4e5, cam.eye[1] + cam.f[1] * 4e5, 0]); return p ? p[1] : -1e4; };
  /** 天空、地平線上的一道光、地面 */
  function backdrop(g, cam, { sky = ['#04040a', '#0a0810', '#2a1410', '#6a2c14'], band = 'rgba(255,160,80,0.34)', ground = ['#120b08', '#0a0706', '#060505'], stars = 1.5 } = {}) {
    const W = cam.W, H = cam.H, hy = clamp(horizonY(cam), -200, H + 200);
    if (hy > 0) {
      const sk = g.createLinearGradient(0, 0, 0, hy);
      sk.addColorStop(0, sky[0]); sk.addColorStop(0.55, sky[1]); sk.addColorStop(0.86, sky[2]); sk.addColorStop(1, sky[3]);
      g.fillStyle = sk; g.fillRect(0, 0, W, hy + 1);
      Globe.drawStars(g, cam, stars);
      const hz = g.createLinearGradient(0, hy - 110, 0, hy + 4);
      hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, band);
      g.fillStyle = hz; g.fillRect(0, hy - 110, W, 114);
    }
    const gd = g.createLinearGradient(0, hy, 0, Math.max(hy + 1, H));
    gd.addColorStop(0, ground[0]); gd.addColorStop(0.25, ground[1]); gd.addColorStop(1, ground[2]);
    g.fillStyle = gd; g.fillRect(0, hy, W, H - hy);
    return hy;
  }
  function groundDots(A, cam, arr, alpha = 0.22, color = '#cbb894', k = 2600) {
    A.fillStyle = color; A.beginPath();
    for (let i = 0; i < arr.length; i += 2) { const p = cam.proj([arr[i], arr[i + 1], 0]); if (!p || p[1] > cam.H + 2 || p[0] < 0 || p[0] > cam.W) continue; const s = clamp(k / p[2], 0.5, 2.2); A.rect(p[0], p[1], s, s * 0.6); }
    A.globalAlpha = alpha; A.fill(); A.globalAlpha = 1;
  }
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mixCol = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(k))).join(',')})`; };

  // ─────────────────────────── 吉薩的金字塔（約西元前 2560 年）
  // 古夫：底 230.3、高 146.6 公尺；卡夫拉：底 215.3、高 143.5；孟卡拉：底約 103、高 65.5。位置是大約的。
  const PYR = [[0, 0, 230.3, 146.6], [-330, -355, 215.3, 143.5], [-590, -775, 103, 65.5],
    [165, -60, 46, 30], [165, -115, 46, 30], [165, -170, 46, 29], [-560, -870, 36, 24], [-610, -870, 36, 24], [-660, -870, 36, 24]];
  function pyramid(A, cam, [cx, cy, base, h], light, fog = 1, lines = 46) {
    const a = base / 2, c = [[cx - a, cy - a, 0], [cx + a, cy - a, 0], [cx + a, cy + a, 0], [cx - a, cy + a, 0]], apex = [cx, cy, h];
    for (let i = 0; i < 4; i++) {
      const p0 = c[i], p1 = c[(i + 1) % 4], n = norm(cross(sub(p1, p0), sub(apex, p1))), lit = clamp(dot(n, light) * 0.9 + 0.25);
      if (!E.face(A, cam, [p0, p1, apex], { fill: mixCol('#0d0a08', '#5a4630', lit), stroke: BONE, alpha: 0.9 * fog, width: 1.5 })) continue;
      A.beginPath();
      for (let j = 1; j < lines; j++) { const u = j / lines, q0 = cam.proj(mix(p0, apex, u)), q1 = cam.proj(mix(p1, apex, u)); if (q0 && q1) { A.moveTo(q0[0], q0[1]); A.lineTo(q1[0], q1[1]); } }
      A.strokeStyle = BONE; A.globalAlpha = (0.12 + 0.22 * lit) * fog; A.lineWidth = 0.8; A.stroke(); A.globalAlpha = 1;
    }
    return apex;
  }
  function giza(g, LY, t, ctx, o = {}) {
    const u = o.u ?? 0, time = o.time ?? t, pulse = o.pulse ?? 0;
    const cam = E.makeCam(o.cam || { eye: [450 - u * 30, -640 + u * 26, 9 + u * 5], target: [-120, -150, 74], fov: 37, shift: [90, 170] });
    backdrop(g, cam, { sky: ['#03040a', '#080912', '#231a1c', '#7a4a22'], band: 'rgba(255,190,110,0.42)', ground: ['#1a120b', '#0c0806', '#060505'], stars: 2.6 });
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, S.sand, 0.26, '#d8c39a', 1500);
    for (const d of S.dunes) E.line(A, cam, d, { color: '#d8c39a', alpha: 0.13, width: 0.9 });
    // 堤道與神廟
    for (const [x0, y0, x1, y1] of S.cause) { E.line(A, cam, [[x0, y0, 0.5], [x1, y1, 0.5]], { color: BONE, alpha: 0.4, width: 1 }); }
    const light = norm([-0.75, -0.35, 0.56]);
    const order = PYR.map((p) => [Math.hypot(p[0] - cam.eye[0], p[1] - cam.eye[1]), p]).sort((a, b) => b[0] - a[0]);
    const tops = [];
    for (const [d, p] of order) tops.push([pyramid(A, cam, p, light, Math.exp(-d / 5200), Math.round(clamp(p[3] / 3.2, 9, 46))), p[3]]);
    A.globalCompositeOperation = 'lighter';
    for (const [x0, y0, x1, y1] of S.cause) for (let i = 0; i <= 26; i++) glowAt(A, cam, [lerp(x0, x1, i / 26), lerp(y0, y1, i / 26), 2], S.gold, 9 + 5 * pulse, 0.9);          // 堤道上的火把
    for (const c of S.camp) glowAt(A, cam, [c[0], c[1], 1.5], S.gold, 7 + c[2] * 6, 0.85);                                                                                  // 工人村的燈火
    for (const [ap, h] of tops) { glowAt(A, cam, ap, S.gold, h * (0.2 + 0.25 * pulse), 1); glowAt(A, cam, ap, S.gold, h * (0.9 + 0.8 * pulse), 0.35); }                       // 塔尖的金頂
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[24, 0.5], [6, 0.42]] });
    ctx.grade(g, { vig: 0.5 });
    if (o.readout !== false) ctx.readout(g, { glyph: '城', era: '吉薩　西元前 2560 年', ...ctx.niceScale(cam.foc / cam.dist, 200), ...(o.readout || {}) });
  }

  // ─────────────────────────── 現代的城（示意，不是任何一座真的城市）。鏡頭和巴比倫那一幕同一個構圖，放大四倍半
  const K = 4.5, TOWER = [[130, 130, 210], [100, 100, 150], [72, 72, 110], [48, 48, 80], [26, 26, 60]];
  function makeCity(r) {
    const B = [], river = [-470 * K, -330 * K];
    for (let bx = -3600; bx < 2800; bx += 110) for (let by = -2400; by < 5200; by += 268) for (let half = 0; half < 2; half++) {
      const x = bx + 43 + (r() - 0.5) * 4, y = by + 62 + half * 125 + (r() - 0.5) * 6;
      if (x > river[0] - 40 && x < river[1] + 40) continue;
      const d = Math.hypot(x, y); if (d < 210) continue;
      if (r() < 0.06) continue;
      const core = Math.pow(clamp(1 - d / 1900), 1.5), hub = Math.pow(clamp(1 - Math.hypot(x - 900, y - 2300) / 900), 1.5);
      const h = 14 + r() * r() * 55 + core * (50 + r() * r() * 420) + hub * r() * 260;
      const w = 60 + r() * 22, dp = 96 + r() * 22, tall = h > 150 && r() < 0.6;
      B.push({ x, y, w: tall ? w * 0.72 : w, d: tall ? dp * 0.55 : dp, h, seed: r(), warm: r() < 0.72 });
    }
    return { B, river };
  }
  function windows(buckets, P, cols, rows, seed, litP) {       // P：這一面四個角在螢幕上的位置（下左、下右、上右、上左）
    for (let j = 0; j < rows; j++) { const floor = hash(j, seed, 9); for (let i = 0; i < cols; i++) {
      const h = hash(i, j, seed) * (floor < 0.16 ? 0.3 : floor > 0.7 ? 2.2 : 1); if (h > litP) continue;
      const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
      const x = lerp(lerp(P[0][0], P[1][0], u), lerp(P[3][0], P[2][0], u), v), y = lerp(lerp(P[0][1], P[1][1], u), lerp(P[3][1], P[2][1], u), v);
      buckets[h < litP * 0.24 ? 1 : 0].push(x, y);
    } }
  }
  function skyline(g, LY, t, ctx, o = {}) {
    const u = o.u ?? 0, time = o.time ?? t, pulse = o.pulse ?? 0, wake = o.wake ?? 1;
    const cam = E.makeCam(o.cam || { eye: [(300 - u * 26) * K, (-330 + u * 30) * K, (150 - u * 12) * K], target: [-10 * K, 12 * K, 40 * K], fov: 36, shift: [40, 150] });
    backdrop(g, cam, { sky: ['#03050c', '#06101c', '#0f2636', '#2a5670'], band: 'rgba(140,205,255,0.3)', ground: ['#0a0f16', '#06080c', '#050506'], stars: 1.2 });
    const A = LY.A.g; LY.clear(LY.A);
    // 河
    for (let i = 0; i < 22; i++) {
      const uu = (i + 0.5) / 22, x = lerp(S.city.river[0], S.city.river[1], uu), pts = [];
      for (let y = -4000; y <= 22000; y += 130) pts.push([x + Math.sin(y * 0.003 + i * 1.7 + time * 0.8) * 12, y, 0]);
      const edge = Math.min(uu, 1 - uu) < 0.06;
      E.line(A, cam, pts, { color: edge ? '#bfe0ff' : '#3f93e0', alpha: edge ? 0.8 : 0.2 + 0.45 * hash(i, 7), width: edge ? 1.5 : 1.1, dash: edge ? null : [60 + hash(i, 1) * 140, 30 + hash(i, 2) * 90], dashOffset: -time * 60 - i * 37 });
    }
    for (const by of [-900, 1500, 3900]) {      // 橋
      E.line(A, cam, [[S.city.river[0] - 60, by, 14], [S.city.river[1] + 60, by, 14]], { color: BONE, alpha: 0.8, width: 1.4 });
      for (const tx of [S.city.river[0] + 150, S.city.river[1] - 150]) { E.line(A, cam, [[tx, by, 0], [tx, by, 70]], { color: BONE, alpha: 0.8, width: 1.3 }); E.line(A, cam, [[S.city.river[0] - 60, by, 14], [tx, by, 70], [(S.city.river[0] + S.city.river[1]) / 2, by, 20], [tx === S.city.river[0] + 150 ? S.city.river[1] - 150 : tx, by, 70]], { color: BONE, alpha: 0.35, width: 0.8 }); }
    }
    // 大道上的車燈
    A.globalCompositeOperation = 'lighter';
    for (const c of S.cars) { const along = ((c[1] + time * 0.02 * (c[3] ? 1 : -1)) % 1 + 1) % 1; const p = c[2] ? [c[0], -2400 + along * 7600, 1.5] : [-3600 + along * 6400, c[0], 1.5]; glowAt(A, cam, p, c[3] ? S.white : S.red, 16, 0.85); }
    for (const f of S.far) glowAt(A, cam, [f[0], f[1], 4], f[2] < 0.7 ? S.gold : S.white, 90 + f[2] * 120, 0.7);
    A.globalCompositeOperation = 'source-over';
    // 樓：由遠到近
    const objs = S.city.B.map((b) => ({ d: Math.hypot(b.x - cam.eye[0], b.y - cam.eye[1]), b }));
    objs.push({ d: Math.hypot(cam.eye[0], cam.eye[1]), tower: true });
    objs.sort((a, b) => b.d - a.d);
    const warm = [[], []], cool = [[], []], beacons = [];
    const lit = 0.3 * wake;
    for (const ob of objs) {
      const fog = Math.exp(-ob.d / 9000);
      if (ob.tower) {
        let z = 0;
        TOWER.forEach(([w, d, h], i) => {
          const F = E.boxFaces(0, 0, z, w, d, h, 0);
          F.forEach((f, k2) => {
            if (!E.face(A, cam, f, { fill: k2 === 0 ? '#141722' : k2 % 2 ? '#090b12' : '#0d1018', stroke: '#cfe6ff', alpha: 0.95, width: 1.5 })) return;
            if (k2 === 0) return;
            const P = f.map((p) => cam.proj(p)); if (P.some((p) => !p)) return;
            windows(cool, P, Math.round(w / 3.4), Math.round(h / 4), i * 31 + k2, 0.55 * wake);
          });
          z += h;
        });
        E.line(A, cam, [[0, 0, z], [0, 0, z + 130]], { color: '#cfe6ff', alpha: 0.95, width: 1.6 });
        beacons.push([[0, 0, z + 130], 34, 1]);
        continue;
      }
      const b = ob.b, c = cam.proj([b.x, b.y, b.h]); if (!c || c[0] < -300 || c[0] > cam.W + 300 || c[1] > cam.H + 500) continue;
      const F = E.boxFaces(b.x, b.y, 0, b.w, b.d, b.h, 0), near = ob.d < 2600;
      F.forEach((f, k2) => {
        if (!E.face(A, cam, f, { fill: k2 === 0 ? '#12141c' : k2 % 2 ? '#080a10' : '#0b0d14', stroke: BONE, alpha: (near ? 0.5 : 0.36) * fog, width: near ? 0.9 : 0.6 })) return;
        if (k2 === 0 || ob.d > 5200) return;
        const P = f.map((p) => cam.proj(p)); if (P.some((p) => !p)) return;
        const wdt = k2 % 2 ? b.w : b.d, step = ob.d < 1800 ? 1 : ob.d < 3200 ? 2 : 3;
        windows(b.warm ? warm : cool, P, Math.max(2, Math.round(wdt / (4.2 * step))), Math.max(2, Math.round(b.h / (4 * step))), Math.floor(b.seed * 9973) + k2, lit);
      });
      if (b.h > 170) beacons.push([[b.x, b.y, b.h + 3], 14, fog]);
    }
    const dots = (arr, col, a, s) => { A.fillStyle = col; A.globalAlpha = a; A.beginPath(); for (let i = 0; i < arr.length; i += 2) A.rect(arr[i] - s / 2, arr[i + 1] - s / 2, s, s * 1.25); A.fill(); };
    dots(warm[0], '#f6bd62', 0.8, 1.7); dots(warm[1], '#fff1cf', 0.95, 2.0); dots(cool[0], '#bfdcff', 0.8, 1.7); dots(cool[1], '#ffffff', 0.95, 2.0);
    A.globalAlpha = 1; A.globalCompositeOperation = 'lighter';
    for (const [p, m, a] of beacons) glowAt(A, cam, p, S.red, m * (1 + 0.8 * pulse), a);        // 樓頂的紅燈：全片的那一點紅
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[22, 0.5], [5, 0.4]] });
    ctx.grade(g, { vig: 0.5 });
    if (o.readout !== false) ctx.readout(g, { glyph: '城', era: '現在', ...ctx.niceScale(cam.foc / cam.dist, 200), ...(o.readout || {}) });
  }

  // ─────────────────────────── 農神五號（1969 年 7 月 16 日，載著阿波羅 11 號）。全高 110.6 公尺，下面兩節直徑 10.1 公尺；旁邊的發射塔約 120 公尺
  const STAGES = [   // [底的高度, 高, 下半徑, 上半徑, 是不是黑色的一段]
    [0, 4, 5.03, 5.03, 1], [4, 19, 5.03, 5.03, 0], [23, 6, 5.03, 5.03, 1], [29, 13.1, 5.03, 5.03, 0],       // 第一節 S-IC（42.1）
    [42.1, 3, 5.03, 5.03, 1], [45.1, 21.9, 5.03, 5.03, 0],                                                  // 第二節 S-II（24.9）
    [67, 5.8, 5.03, 3.3, 0], [72.8, 12.1, 3.3, 3.3, 0], [84.9, 2, 3.3, 3.3, 1],                              // 轉接段與第三節 S-IVB
    [86.9, 8.5, 3.3, 1.95, 0], [95.4, 4.2, 1.95, 1.95, 0], [99.6, 3.4, 1.95, 0.4, 0],                        // 登月艙外罩、服務艙、指揮艙
  ];
  /** sy：把圓壓成橢圓（y 方向的比例）；inside：畫內側（看得到的是背對圓心的那一半的反面，碗的內壁用） */
  function prism(A, cam, cx, cy, z0, h, r0, r1, { n = 22, fill, stroke = BONE, alpha = 0.9, ribs = 0.16, sy = 1, inside = false }) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.2832, a1 = ((i + 1) / n) * 6.2832;
      const b0 = [cx + r0 * Math.cos(a0), cy + r0 * sy * Math.sin(a0), z0], b1 = [cx + r0 * Math.cos(a1), cy + r0 * sy * Math.sin(a1), z0];
      const t1 = [cx + r1 * Math.cos(a1), cy + r1 * sy * Math.sin(a1), z0 + h], t0 = [cx + r1 * Math.cos(a0), cy + r1 * sy * Math.sin(a0), z0 + h];
      const io = inside ? -1 : 1, nx = Math.cos((a0 + a1) / 2) * sy * io, ny = Math.sin((a0 + a1) / 2) * io;
      if (nx * (cam.eye[0] - b0[0]) + ny * (cam.eye[1] - b0[1]) <= 0) continue;
      const P = [b0, b1, t1, t0].map((p) => cam.proj(p)); if (P.some((p) => !p)) continue;
      const side = clamp(0.5 + 0.5 * (nx * cam.r[0] + ny * cam.r[1]));                                    // 左邊暗、右邊亮一點：看得出是圓的
      A.beginPath(); A.moveTo(P[0][0], P[0][1]); for (let k = 1; k < 4; k++) A.lineTo(P[k][0], P[k][1]); A.closePath();
      A.fillStyle = typeof fill === 'function' ? fill(side) : fill; A.globalAlpha = 1; A.fill();
      A.strokeStyle = stroke; A.lineWidth = 0.7; A.globalAlpha = ribs; A.stroke();
      A.globalAlpha = alpha; A.lineWidth = 1.3; A.beginPath(); A.moveTo(P[0][0], P[0][1]); A.lineTo(P[1][0], P[1][1]); A.moveTo(P[3][0], P[3][1]); A.lineTo(P[2][0], P[2][1]); A.stroke();
    }
    A.globalAlpha = 1;
  }
  function saturn(g, LY, t, ctx, o = {}) {
    const u = o.u ?? 0, time = o.time ?? t;
    const lift = 3 + 52 * Math.pow(u, 1.7), z0 = 8 + lift;
    const cam = E.makeCam(o.cam || { eye: [118, -190, 4], target: [-6, 0, 60 + lift * 0.62], fov: 46, shift: [0, 60] });
    backdrop(g, cam, { sky: ['#03050c', '#070a14', '#1a1420', '#5a2c18'], band: 'rgba(255,150,70,0.5)', ground: ['#1c0f08', '#0c0705', '#060505'], stars: 1.4 });
    // 火光照亮整個場地
    const fp = cam.proj([0, 0, 6]);
    if (fp) { const gr = g.createRadialGradient(fp[0], fp[1], 0, fp[0], fp[1], 1300); gr.addColorStop(0, 'rgba(255,170,90,0.5)'); gr.addColorStop(0.35, 'rgba(230,90,40,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, cam.W, cam.H); g.restore(); }
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, S.pad, 0.3, '#ffb787', 700);
    for (const y of [-14, 14]) E.line(A, cam, [[-900, y - 300, 0], [0, y, 0]], { color: BONE, alpha: 0.3, width: 1 });                 // 履帶車的路
    // 探照燈的光柱
    for (const [x, y] of [[-260, -200], [240, 260], [-200, 300], [330, -90]]) { const pts = [[x, y, 0], [0, 0, z0 + 70]]; E.line(A, cam, pts, { color: '#9cc8ff', alpha: 0.07, width: 14 }); E.line(A, cam, pts, { color: '#cfe6ff', alpha: 0.16, width: 2.5 }); }
    // 發射台與發射塔（紅色的格子塔）
    for (const f of E.boxFaces(-8, 0, 0, 49, 41, 8, 0)) E.face(A, cam, f, { fill: '#140c08', stroke: BONE, alpha: 0.8, width: 1.2 });
    const tx = -24, ty = 0, tw = 6, RED = '#ff6a3c';
    const legs = [[tx - tw, ty - tw], [tx + tw, ty - tw], [tx + tw, ty + tw], [tx - tw, ty + tw]];
    for (const [x, y] of legs) E.line(A, cam, [[x, y, 8], [x, y, 128]], { color: RED, alpha: 0.95, width: 1.6 });
    for (let z = 8; z <= 128; z += 6) {
      E.line(A, cam, legs.map(([x, y]) => [x, y, z]), { color: RED, alpha: 0.7, width: 1, closed: true });
      if (z < 128) for (let k = 0; k < 4; k++) { const a = legs[k], b = legs[(k + 1) % 4]; E.line(A, cam, [[a[0], a[1], z], [b[0], b[1], z + 6]], { color: RED, alpha: 0.4, width: 0.8 }); }
    }
    E.line(A, cam, [[tx, ty, 128], [tx, ty, 142], [tx + 26, ty, 136]], { color: RED, alpha: 0.9, width: 1.4 });                        // 塔頂的吊臂
    for (let k = 0; k < 9; k++) { const z = 22 + k * 11.5, sw = 0.5 + 0.9 * clamp(u * 3 + 0.4); E.line(A, cam, [[tx + tw, ty, z], [tx + tw + 12 * Math.cos(sw), ty - 12 * Math.sin(sw), z]], { color: RED, alpha: 0.85, width: 1.5 }); }   // 擺開的臂
    // 火箭
    const hot = (z) => clamp(1 - (z - z0) / 60);
    for (const [zb, h, r0, r1, black] of STAGES) {
      const k = hot(z0 + zb);
      prism(A, cam, 0, 0, z0 + zb, h, r0, r1, { fill: (side) => (black ? mixCol('#090807', '#3a1a0c', k * 0.6) : mixCol(mixCol('#8a8474', '#ece2cc', side), '#ffb070', k * 0.5)), stroke: mixCol(BONE, '#ffc898', k), alpha: 0.9, ribs: 0.14 });
    }
    E.line(A, cam, [[0, 0, z0 + 103], [0, 0, z0 + 110.6]], { color: BONE, alpha: 0.95, width: 1.5 });                                  // 逃生塔
    for (let k = 0; k < 4; k++) { const a = k * 1.5708 + 0.785; E.line(A, cam, [[5.03 * Math.cos(a), 5.03 * Math.sin(a), z0 + 7], [9.2 * Math.cos(a), 9.2 * Math.sin(a), z0], [5.03 * Math.cos(a), 5.03 * Math.sin(a), z0]], { color: BONE, alpha: 0.9, width: 1.3, closed: true }); }   // 尾翼
    for (const [ex, ey] of [[0, 0], [3.2, 3.2], [-3.2, 3.2], [3.2, -3.2], [-3.2, -3.2]]) prism(A, cam, ex, ey, z0 - 5.6, 5.6, 1.9, 1.0, { n: 10, fill: '#2a1206', stroke: '#ffc898', alpha: 0.9, ribs: 0.2 });   // 五具 F-1
    // 火焰與煙
    A.globalCompositeOperation = 'lighter';
    const fl = 0.85 + 0.3 * Math.sin(time * 47) * Math.sin(time * 31);
    for (let i = 0; i < 16; i++) { const k = i / 15, z = z0 - 6 - k * (z0 - 2); glowAt(A, cam, [Math.sin(time * 40 + i) * 0.8, 0, z], i < 5 ? S.white : S.fire, (16 + k * 30) * fl, 0.95 - k * 0.3); }
    glowAt(A, cam, [0, 0, z0 - 8], S.white, 46 * fl, 1); glowAt(A, cam, [0, 0, z0 - 14], S.fire, 150 * fl, 0.55);
    for (const s of S.smoke) {
      const life = (s[0] + time * (0.12 + s[1] * 0.1)) % 1, dir = s[2] < 0.5 ? -1 : 1;
      const p = [dir * (10 + Math.pow(life, 0.7) * (150 + s[3] * 140)), (s[1] - 0.5) * (30 + life * 150), 5 + life * life * (40 + s[3] * 70)];
      glowAt(A, cam, p, life < 0.2 ? S.fire : S.smoke_, 26 + life * 150, (life < 0.2 ? 0.34 : 0.3) * (1 - life));
    }
    for (const s of S.sparks) { const life = (s[0] + time * (0.5 + s[1])) % 1, a = s[2] * 6.2832; glowAt(A, cam, [Math.cos(a) * life * (60 + s[3] * 120), Math.sin(a) * life * 90, 4 + Math.sin(life * 3.1) * (20 + s[1] * 40)], S.fire, 3.2 * (1 - life) + 0.8, (1 - life) * 0.9); }
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[30, 0.6], [7, 0.45]] });
    ctx.grade(g, { vig: 0.45 });
    if (o.readout !== false) ctx.readout(g, { glyph: '機', era: '農神五號　1969 年 7 月 16 日', ...ctx.niceScale(cam.foc / cam.dist, 200), ...(o.readout || {}) });
  }


  // ─────────────────────────── 共用：把一串 [底的高度, 高, 下半徑, 上半徑, 樣式] 疊成一個旋轉體（屋頂、圓頂、塔）
  function lathe(A, cam, cx, cy, segs, styles, n = 28) {
    for (const [z0, h, r0, r1, st] of segs) prism(A, cam, cx, cy, z0, h, r0, r1, { n, ...styles[st] });
  }
  const R4 = rng(1420), TREES_T = [], LAMPS_T = [];
  for (let i = 0; i < 260; i++) { const a = R4() * 6.2832, rad = 75 + R4() * 260; TREES_T.push([Math.cos(a) * rad, Math.sin(a) * rad, 7 + R4() * 7]); }
  for (let k = 0; k < 3; k++) { const r = [45.5, 40, 34][k], n = [44, 38, 32][k]; for (let i = 0; i < n; i++) LAMPS_T.push([Math.cos((i / n) * 6.2832) * r, Math.sin((i / n) * 6.2832) * r, 2 + k * 2 + 1]); }

  // ─────────────────────────── 天壇祈年殿（北京，1420 年）。殿高約 38 公尺，立在三層的圓形石臺上（最下層直徑約 91 公尺）。三重藍瓦圓頂、金頂
  function tiantan(g, LY, t, ctx, o = {}) {
    const u = o.u ?? 0, pulse = o.pulse ?? 0;
    const cam = E.makeCam(o.cam || { eye: [84 - u * 12, -132 + u * 7, 17 + u * 3], target: [0, 0, 24], fov: 38, shift: [0, 90] });
    backdrop(g, cam, { sky: ['#03040b', '#060b18', '#0f2038', '#2c4a6e'], band: 'rgba(130,180,255,0.3)', ground: ['#0c0e16', '#07080c', '#050506'], stars: 2.2 });
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, S.sand, 0.14, '#b9c2d8', 900);
    // 圍牆（方的）與四個方向的甬道
    const wq = 190; E.line(A, cam, [[-wq, -wq, 0], [wq, -wq, 0], [wq, wq, 0], [-wq, wq, 0]], { color: BONE, alpha: 0.4, width: 1.1, closed: true });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const s2 of [-5, 5]) E.line(A, cam, [[dx * 46 + dy * s2, dy * 46 + dx * s2, 0], [dx * wq + dy * s2, dy * wq + dx * s2, 0]], { color: BONE, alpha: 0.35, width: 1 });
    const far = TREES_T.map((p) => [Math.hypot(p[0] - cam.eye[0], p[1] - cam.eye[1]), p]).sort((a, b) => b[0] - a[0]);
    const tree = ([d, p]) => { const b = cam.proj([p[0], p[1], 0]), tp = cam.proj([p[0], p[1], p[2]]); if (!b || !tp) return; const w = (cam.foc / d) * 2.2; A.beginPath(); A.moveTo(b[0], b[1]); A.lineTo(tp[0], tp[1]); A.moveTo(tp[0], tp[1]); A.lineTo(b[0] - w, lerp(b[1], tp[1], 0.25)); A.moveTo(tp[0], tp[1]); A.lineTo(b[0] + w, lerp(b[1], tp[1], 0.25)); A.strokeStyle = '#9fb0a0'; A.globalAlpha = 0.22; A.lineWidth = 0.8; A.stroke(); A.globalAlpha = 1; };
    const dC = Math.hypot(cam.eye[0], cam.eye[1]);
    far.filter((f) => f[0] > dC + 40).forEach(tree);
    const ST = {
      stone: { fill: (s2) => mixCol('#1c1d22', '#5c5d66', s2), stroke: BONE, alpha: 0.9, ribs: 0.12 },
      red: { fill: (s2) => mixCol('#2a0d08', '#8a2c1a', s2), stroke: '#ff9a70', alpha: 0.9, ribs: 0.5 },
      blue: { fill: (s2) => mixCol('#071428', '#1f4f96', s2), stroke: '#8fc4ff', alpha: 0.95, ribs: 0.42 },
      gold: { fill: (s2) => mixCol('#3a2606', '#d89a2c', s2), stroke: '#ffe2a0', alpha: 1, ribs: 0.3 },
    };
    lathe(A, cam, 0, 0, [[0, 2, 45.5, 45.5, 'stone'], [2, 2, 40, 40, 'stone'], [4, 2, 34, 34, 'stone'],
      [6, 7, 15.5, 15.5, 'red'], [13, 2.2, 21.5, 17.5, 'blue'], [15.2, 2.3, 17.5, 14.2, 'blue'], [17.5, 0.6, 14.2, 14.2, 'gold'],
      [18.1, 2.9, 13, 13, 'red'], [21, 2.2, 18, 14.6, 'blue'], [23.2, 2.3, 14.6, 11.6, 'blue'], [25.5, 0.6, 11.6, 11.6, 'gold'],
      [26.1, 2.4, 10.4, 10.4, 'red'], [28.5, 3, 14.8, 11, 'blue'], [31.5, 5, 11, 5.6, 'blue'], [36.5, 4.5, 5.6, 1.3, 'blue'], [41, 3, 1.5, 0.5, 'gold']], ST, 40);
    A.globalCompositeOperation = 'lighter';
    for (const l of LAMPS_T) if (!((Math.atan2(l[1] - cam.eye[1], l[0] - cam.eye[0]) + 9) % 1 > 2)) glowAt(A, cam, l, S.gold, 2.2 + 1.2 * pulse, 0.9);          // 石臺欄杆上的燈
    glowAt(A, cam, [0, 0, 44.5], S.gold, 5 + 5 * pulse, 1); glowAt(A, cam, [0, 0, 44.5], S.gold, 34 + 30 * pulse, 0.35);                                           // 金頂
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; glowAt(A, cam, [Math.cos(a) * 15.8, Math.sin(a) * 15.8, 9], S.fire, 3.2, 0.8); }               // 殿門裡的燈火
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[24, 0.5], [6, 0.42]] });
    ctx.grade(g, { vig: 0.5 });
    if (o.readout !== false) ctx.readout(g, { glyph: '城', era: '北京　天壇', ...ctx.niceScale(cam.foc / cam.dist, 200), ...(o.readout || {}) });
  }

  // ─────────────────────────── 泰姬瑪哈陵（印度阿格拉，約 1653 年完工）。總高約 73 公尺；臺基約 95 公尺見方；四角的宣禮塔高約 40 公尺。尺寸憑記憶
  function taj(g, LY, t, ctx, o = {}) {
    const u = o.u ?? 0, pulse = o.pulse ?? 0, time = o.time ?? t;
    const cam = E.makeCam(o.cam || { eye: [10 - u * 8, -318 + u * 26, 13], target: [0, 0, 37], fov: 30, shift: [0, 90] });
    backdrop(g, cam, { sky: ['#04040c', '#0b0a1c', '#2c1c30', '#8a4a44'], band: 'rgba(255,170,150,0.4)', ground: ['#140d10', '#0a0708', '#060505'], stars: 1.6 });
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, S.sand, 0.16, '#e0c8c0', 1200);
    // 水池與花園的十字步道
    for (let i = 0; i < 9; i++) { const x = -3.5 + (i / 8) * 7, edge = i === 0 || i === 8; E.line(A, cam, [[x, -60, 0], [x, -300, 0]], { color: edge ? '#bfe0ff' : '#3f93e0', alpha: edge ? 0.8 : 0.35 + 0.3 * hash(i, 3), width: edge ? 1.4 : 1, dash: edge ? null : [40 + hash(i, 1) * 80, 20 + hash(i, 2) * 50], dashOffset: -time * 30 - i * 23 }); }
    for (const x of [-14, 14, -150, 150]) E.line(A, cam, [[x, -60, 0], [x, -300, 0]], { color: BONE, alpha: 0.3, width: 1 });
    for (const y of [-60, -180]) E.line(A, cam, [[-150, y, 0], [150, y, 0]], { color: BONE, alpha: 0.3, width: 1 });
    for (let i = 0; i < 24; i++) for (const sx of [-9, 9]) { const y = -70 - i * 10, b = cam.proj([sx, y, 0]), tp = cam.proj([sx, y, 9]); if (b && tp) { A.beginPath(); A.moveTo(b[0], b[1]); A.lineTo(tp[0], tp[1]); A.strokeStyle = '#a8b8a0'; A.globalAlpha = 0.45; A.lineWidth = clamp(260 / tp[2], 0.6, 2.2); A.stroke(); A.globalAlpha = 1; } }   // 兩排柏樹
    const M = { fill: (s2) => mixCol('#2a2428', '#b9aeb0', s2), stroke: '#fff0ea', alpha: 0.95, ribs: 0.16 };
    const boxM = (cx, cy, z0, w, d, h) => E.boxFaces(cx, cy, z0, w, d, h, 0).forEach((f, k) => E.face(A, cam, f, { fill: k === 0 ? '#5a5258' : k % 2 ? '#3a3438' : '#7a7074', stroke: '#fff0ea', alpha: 0.9, width: 1.3 }));
    boxM(0, 0, 0, 95, 95, 7);
    const mins = [[-47.5, 47.5], [47.5, 47.5], [-47.5, -47.5], [47.5, -47.5]];
    const minaret = ([x, y]) => lathe(A, cam, x, y, [[7, 13, 2.9, 2.7, 'm'], [20, 0.8, 3.6, 3.6, 'm'], [20.8, 12, 2.7, 2.5, 'm'], [32.8, 0.8, 3.4, 3.4, 'm'], [33.6, 9, 2.5, 2.3, 'm'], [42.6, 0.8, 3.3, 3.3, 'm'], [43.4, 2.6, 2.4, 2.4, 'm'], [46, 2.2, 2.6, 1.6, 'm'], [48.2, 2, 1.6, 0.2, 'm']], { m: M }, 14);
    mins.slice(0, 2).forEach(minaret);
    boxM(0, 0, 7, 57, 57, 33);
    // 正面的尖拱：中間一個大的，兩邊各兩層小的
    const arch = (cx, w, z0, h, a = 0.8) => { const pts = [[cx - w / 2, -28.6, z0], [cx - w / 2, -28.6, z0 + h * 0.6]]; for (let i = 1; i <= 8; i++) { const k = i / 8; pts.push([cx - (w / 2) * Math.cos(k * 1.5708), -28.6, z0 + h * 0.6 + h * 0.4 * Math.pow(Math.sin(k * 1.5708), 0.8)]); } const r2 = pts.slice(0, -1).reverse().map((p) => [2 * cx - p[0], p[1], p[2]]); E.line(A, cam, pts.concat(r2), { color: '#fff0ea', alpha: a, width: 1.3 }); };
    arch(0, 18, 7, 27); arch(0, 13, 7, 22, 0.45);
    for (const sx of [-1, 1]) for (const z of [9, 24]) arch(sx * 19.5, 8.5, z, 12, 0.65);
    E.line(A, cam, [[-11, -28.6, 7], [-11, -28.6, 40], [11, -28.6, 40], [11, -28.6, 7]], { color: '#fff0ea', alpha: 0.7, width: 1.2 });
    for (const [x, y] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) lathe(A, cam, x, y, [[40, 4.5, 4, 4, 'm'], [44.5, 1.2, 4.6, 4.9, 'm'], [45.7, 2.2, 4.9, 3.6, 'm'], [47.9, 2, 3.6, 0.3, 'm']], { m: M }, 16);          // 四個小圓頂
    lathe(A, cam, 0, 0, [[40, 7, 9.4, 9.4, 'm'], [47, 3.5, 9.6, 11.6, 'm'], [50.5, 5, 11.6, 11.9, 'm'], [55.5, 5, 11.9, 10.4, 'm'], [60.5, 4.5, 10.4, 7.4, 'm'], [65, 4, 7.4, 3.6, 'm'], [69, 3, 3.6, 0.8, 'm']], { m: M }, 36);       // 大圓頂（洋蔥形）
    E.line(A, cam, [[0, 0, 72], [0, 0, 80]], { color: '#ffe2a0', alpha: 1, width: 1.6 });
    mins.slice(2).forEach(minaret);
    A.globalCompositeOperation = 'lighter';
    glowAt(A, cam, [0, 0, 80], S.gold, 4 + 4 * pulse, 1); glowAt(A, cam, [0, 0, 60], S.white, 120 + 60 * pulse, 0.16);
    glowAt(A, cam, [0, -28.8, 14], S.gold, 9 + 5 * pulse, 0.9);
    for (const [x, y] of mins) glowAt(A, cam, [x, y, 45], S.gold, 3.4, 0.9);
    for (let i = 0; i < 24; i++) for (const sx of [-5.5, 5.5]) glowAt(A, cam, [sx, -66 - i * 10, 0.6], S.gold, 1.6 + 0.8 * pulse, 0.8);          // 水池邊的燈
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[24, 0.5], [6, 0.42]] });
    ctx.grade(g, { vig: 0.5 });
    if (o.readout !== false) ctx.readout(g, { glyph: '城', era: '印度　阿格拉', ...ctx.niceScale(cam.foc / cam.dist, 200), ...(o.readout || {}) });
  }

  function init() {
    const r = rng(2560);
    const sand = []; for (let i = 0; i < 30000; i++) sand.push(-2600 + r() * 4200, -1400 + r() * 5200);
    const dunes = [];
    for (let i = 0; i < 46; i++) { const y0 = -1300 + r() * 5000, pts = []; const x0 = -2600 + r() * 2500, L = 500 + r() * 1500; for (let x = x0; x < x0 + L; x += 40) pts.push([x, y0 + (fbm(x * 0.002, i * 3.1, 3, 7) - 0.5) * 260, 0]); dunes.push(pts); }
    const cause = [[115, 0, 640, 110], [-222, -355, 330, -470], [-538, -775, 60, -830]];
    const camp = []; for (let i = 0; i < 240; i++) { const a = r() * 6.2832, rad = Math.pow(r(), 0.6) * 230; camp.push([520 + Math.cos(a) * rad * 1.5, -330 + Math.sin(a) * rad, r()]); }
    const r2 = rng(1969), pad = []; for (let i = 0; i < 16000; i++) pad.push(-1100 + r2() * 2200, -300 + r2() * 2600);
    const smoke = []; for (let i = 0; i < 150; i++) smoke.push([r2(), r2(), r2(), r2()]);
    const sparks = []; for (let i = 0; i < 160; i++) sparks.push([r2(), r2(), r2(), r2()]);
    const r3 = rng(2026), city = makeCity(r3), cars = [], far = [];
    for (let i = 0; i < 1500; i++) { const ns = r3() < 0.5; cars.push([ns ? -3600 + Math.floor(r3() * 58) * 110 + 98 + (r3() < 0.5 ? 4 : -4) : -2400 + Math.floor(r3() * 28) * 268 + 4, r3(), ns, r3() < 0.5]); }
    for (let i = 0; i < 900; i++) { const a = r3() * 6.2832, rad = 7000 + Math.pow(r3(), 0.6) * 60000; far.push([Math.cos(a) * rad, Math.sin(a) * rad, r3()]); }
    S = { sand: new Float32Array(sand), dunes, cause, camp, pad: new Float32Array(pad), smoke, sparks, city, cars, far,
      gold: sprite([[0, 'rgba(255,238,196,1)'], [0.18, 'rgba(255,190,96,0.85)'], [0.5, 'rgba(244,140,52,0.2)'], [1, 'rgba(240,120,40,0)']]),
      fire: sprite([[0, 'rgba(255,244,214,1)'], [0.12, 'rgba(255,170,80,0.95)'], [0.4, 'rgba(232,80,42,0.35)'], [1, 'rgba(200,50,20,0)']]),
      white: sprite([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(225,238,255,0.75)'], [0.5, 'rgba(140,190,255,0.18)'], [1, 'rgba(90,150,255,0)']]),
      red: sprite([[0, 'rgba(255,220,200,1)'], [0.15, 'rgba(255,90,50,0.95)'], [0.45, 'rgba(232,60,30,0.3)'], [1, 'rgba(200,40,20,0)']]),
      smoke_: sprite([[0, 'rgba(230,120,70,0.34)'], [0.5, 'rgba(160,70,40,0.15)'], [1, 'rgba(110,45,28,0)']]) };
  }

  root.Wonders = { init, giza, skyline, saturn, tiantan, taj, util: { backdrop, groundDots, glowAt, prism, lathe, mixCol, sprite, horizonY }, get S() { return S; } };
})(typeof self !== 'undefined' ? self : this);
