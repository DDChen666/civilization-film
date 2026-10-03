// 第二批奇觀：巨石陣、帕德嫩神廟、長城、羅馬競技場、吳哥窟、艾菲爾鐵塔、國際太空站、晶片。
// 畫法同第一批（真三維的線稿加燈火）。尺寸憑記憶寫在各自的註解裡，公開前要查證；周圍的地景是示意。
(function (root) {
  'use strict';
  const { add, sub, mul, dot, cross, norm, len, mix, clamp, lerp, sstep, rng, hash, fbm } = E;
  const BONE = '#efe4cf', U = () => Wonders.util, WS = () => Wonders.S;
  const boxAll = (A, cam, cx, cy, z0, w, d, h, rot, st) => E.boxFaces(cx, cy, z0, w, d, h, rot, st.taper || 0).forEach((f, k) => E.face(A, cam, f, { fill: k === 0 ? st.top : k % 2 ? st.a : st.b, stroke: st.stroke || BONE, alpha: st.alpha ?? 0.9, width: st.width || 1.2 }));
  const STONE = { top: '#6a5440', a: '#1c1510', b: '#3a2a1c', stroke: '#ffe2c0', alpha: 0.95 }, MARBLE = { top: '#6a6258', a: '#2c2824', b: '#4a443c', stroke: '#fff3e2', alpha: 0.95 };
  const done = (g, LY, ctx, o, cam, glyph, era, glow) => { LY.composite(g, LY.A, { glow: glow || [[24, 0.5], [6, 0.42]] }); ctx.grade(g, { vig: 0.5 }); if (o.readout !== false) ctx.readout(g, { glyph, era, ...ctx.niceScale(cam.foc / cam.dist, 200), ...(o.readout || {}) }); };
  const R5 = rng(3000), DOTS = []; for (let i = 0; i < 26000; i++) DOTS.push(-1500 + R5() * 3000, -1200 + R5() * 3600);
  const DOT = new Float32Array(DOTS);

  // ─────────────────────────── 巨石陣（約西元前 3000–2500 年）。外圈直徑約 30 公尺、立石高約 4.1 公尺（三十塊），約西元前 2500 年立起；中間五組三石塔最高約 7.3 公尺（已查維基百科 Stonehenge）。畫的是完整的樣子，現在只剩一部分
  function stonehenge(g, LY, t, ctx, o = {}) {
    const { backdrop, groundDots, glowAt } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0;
    const cam = E.makeCam(o.cam || { eye: [-27 + u * 3, -23 + u * 2.5, 1.9], target: [0, 0, 3.6], fov: 46, shift: [60, 130] });
    backdrop(g, cam, { sky: ['#03040a', '#0a0a14', '#3a1c14', '#c0642a'], band: 'rgba(255,190,110,0.6)', ground: ['#1a100a', '#0b0806', '#060505'], stars: 1.6 });
    const sun = cam.proj([900, 760, 18]);                                         // 夏至的日出方向（東北）
    if (sun) { const gr = g.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], 520); gr.addColorStop(0, `rgba(255,220,160,${0.75 + 0.2 * pulse})`); gr.addColorStop(0.25, 'rgba(255,150,70,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, cam.W, cam.H); g.restore(); }
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, DOT, 0.3, '#ffcf9a', 260);
    for (const rr of [50, 55]) { const pts = []; for (let i = 0; i <= 90; i++) pts.push([Math.cos(i / 90 * 6.2832) * rr, Math.sin(i / 90 * 6.2832) * rr, 0.2]); E.line(A, cam, pts, { color: BONE, alpha: 0.3, width: 1 }); }
    const objs = [];
    for (let i = 0; i < 30; i++) { const a = (i / 30) * 6.2832; objs.push({ x: Math.cos(a) * 15.2, y: Math.sin(a) * 15.2, w: 2.0, d: 1.1, h: 4.1, rot: a + 1.5708, lint: [a, (i + 1) / 30 * 6.2832, 15.2, 4.1] }); }
    for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.2832; objs.push({ x: Math.cos(a) * 10.8, y: Math.sin(a) * 10.8, w: 0.9, d: 0.6, h: 1.8, rot: a + 1.5708 }); }
    for (let k = 0; k < 5; k++) { const a = 0.72 + 3.9 + (k - 2) * 0.62, hh = [6, 6.5, 7.3, 6.5, 6][k]; for (const s2 of [-1, 1]) objs.push({ x: Math.cos(a) * 7 + Math.cos(a + 1.5708) * 1.5 * s2, y: Math.sin(a) * 7 + Math.sin(a + 1.5708) * 1.5 * s2, w: 2.2, d: 1.2, h: hh, rot: a + 1.5708, tri: s2 === 1 ? [a, hh] : null }); }
    objs.forEach((ob) => { ob.dd = Math.hypot(ob.x - cam.eye[0], ob.y - cam.eye[1]); });
    objs.sort((a, b) => b.dd - a.dd);
    for (const ob of objs) {
      boxAll(A, cam, ob.x, ob.y, 0, ob.w, ob.d, ob.h, ob.rot, STONE);
      if (ob.lint) { const am = (ob.lint[0] + ob.lint[1]) / 2; boxAll(A, cam, Math.cos(am) * 15.2, Math.sin(am) * 15.2, 4.1, 3.25, 1.1, 0.8, am + 1.5708, STONE); }
      if (ob.tri) boxAll(A, cam, Math.cos(ob.tri[0]) * 7, Math.sin(ob.tri[0]) * 7, ob.tri[1], 5.4, 1.3, 1.0, ob.tri[0] + 1.5708, STONE);
    }
    A.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.2832; glowAt(A, cam, [Math.cos(a) * 24, Math.sin(a) * 24, 0.6], S.fire, 1.0 + 0.5 * pulse, 0.9); }
    A.globalCompositeOperation = 'source-over';
    done(g, LY, ctx, o, cam, '城', '英國　索爾茲伯里平原');
  }

  // ─────────────────────────── 帕德嫩神廟（雅典，西元前 432 年完工）。臺基約 69.5 × 30.9 公尺，外圈 8 × 17 根柱子，柱高約 10.4 公尺
  function parthenon(g, LY, t, ctx, o = {}) {
    const { backdrop, groundDots, glowAt, prism } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0;
    const cam = E.makeCam(o.cam || { eye: [64 - u * 6, -56 + u * 5, 7.5], target: [0, 0, 9.5], fov: 38, shift: [40, 110] });
    backdrop(g, cam, { sky: ['#03050c', '#070c1a', '#12233c', '#34587c'], band: 'rgba(150,200,255,0.34)', ground: ['#0c0e14', '#07080b', '#050506'], stars: 2.0 });
    const A = LY.A.g; LY.clear(LY.A);
    A.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 700; i++) { const a = hash(i, 1) * 6.2832, rad = 260 + hash(i, 2) * 2400; glowAt(A, cam, [Math.cos(a) * rad, Math.sin(a) * rad, -80], S.gold, 12 + hash(i, 3) * 14, 0.7); }      // 山下的雅典
    A.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 3; k++) boxAll(A, cam, 0, 0, -1.5 + k * 0.5, 72 - k * 1.2, 33.4 - k * 1.2, 0.5, 0, MARBLE);
    const cols = [];
    for (let i = 0; i < 17; i++) for (const y of [-14.2, 14.2]) cols.push([-33.4 + i * 4.175, y]);
    for (let j = 1; j < 7; j++) for (const x of [-33.4, 33.4]) cols.push([x, -14.2 + j * 4.06]);
    const cella = () => { boxAll(A, cam, 0, 0, 0, 48, 19, 10.4, 0, { top: '#2a2622', a: '#161310', b: '#211d19', stroke: '#fff3e2', alpha: 0.6 }); };
    const near = cols.filter((c) => Math.hypot(c[0] - cam.eye[0], c[1] - cam.eye[1]) < Math.hypot(cam.eye[0], cam.eye[1]));
    const col = (c) => prism(A, cam, c[0], c[1], 0, 10.4, 0.95, 0.76, { n: 10, fill: (s2) => U().mixCol('#2a2622', '#cfc4b0', s2), stroke: '#fff3e2', alpha: 0.9, ribs: 0.3 });
    cols.filter((c) => !near.includes(c)).sort((a, b) => Math.hypot(b[0] - cam.eye[0], b[1] - cam.eye[1]) - Math.hypot(a[0] - cam.eye[0], a[1] - cam.eye[1])).forEach(col);
    cella();
    A.globalCompositeOperation = 'lighter'; glowAt(A, cam, [0, 0, 5], S.gold, 30 + 14 * pulse, 0.6); glowAt(A, cam, [24.2, 0, 4], S.fire, 4 + 2 * pulse, 0.9); A.globalCompositeOperation = 'source-over';
    near.sort((a, b) => Math.hypot(b[0] - cam.eye[0], b[1] - cam.eye[1]) - Math.hypot(a[0] - cam.eye[0], a[1] - cam.eye[1])).forEach(col);
    boxAll(A, cam, 0, 0, 10.4, 69.5, 30.9, 3.3, 0, MARBLE);                         // 橫樑
    const zr = 13.7, hx = 34.75, hy = 15.45, peak = 4.2;                           // 屋頂：兩片斜面加兩端的三角楣
    E.face(A, cam, [[-hx, -hy, zr], [hx, -hy, zr], [hx, 0, zr + peak], [-hx, 0, zr + peak]], { fill: '#3a352e', stroke: '#fff3e2', alpha: 0.9, width: 1.2 });
    E.face(A, cam, [[hx, hy, zr], [-hx, hy, zr], [-hx, 0, zr + peak], [hx, 0, zr + peak]], { fill: '#2a2622', stroke: '#fff3e2', alpha: 0.9, width: 1.2 });
    E.face(A, cam, [[hx, -hy, zr], [hx, hy, zr], [hx, 0, zr + peak]], { fill: '#4a443c', stroke: '#fff3e2', alpha: 0.95, width: 1.4 });
    E.face(A, cam, [[-hx, hy, zr], [-hx, -hy, zr], [-hx, 0, zr + peak]], { fill: '#4a443c', stroke: '#fff3e2', alpha: 0.95, width: 1.4 });
    done(g, LY, ctx, o, cam, '城', '希臘　雅典');
  }

  // ─────────────────────────── 長城（西元前 214 年秦朝連接成一道；畫的是後來明代磚石長城的樣子）。城牆高約 7 公尺，沿著山脊走，每隔一段有一座敵樓
  const RIDGE = [];
  for (let k = 0; k < 7; k++) { const pts = []; const y = 300 + k * 520; for (let x = -4200; x <= 4200; x += 50) pts.push([x * (1 + k * 0.25), y, 160 + k * 55 + (fbm(x * 0.0011 + k * 3.3, k * 1.7, 4, 21) - 0.45) * (520 + k * 60)]); RIDGE.push(pts); }
  function greatwall(g, LY, t, ctx, o = {}) {
    const { backdrop, glowAt } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0, time = o.time ?? t;
    const cam = E.makeCam(o.cam || { eye: [-380 + u * 60, -560, 470 + u * 20], target: [120, 620, 300], fov: 40, shift: [0, 60] });
    backdrop(g, cam, { sky: ['#04040a', '#0b0914', '#2c1a20', '#a85a34'], band: 'rgba(255,170,100,0.5)', ground: ['#100b0a', '#0a0707', '#060505'], stars: 1.7 });
    const A = LY.A.g; LY.clear(LY.A);
    for (let k = RIDGE.length - 1; k >= 0; k--) {                                 // 一層一層的山：遠的先畫
      const vis = RIDGE[k].filter((p) => { const q = cam.proj(p); return q && q[0] > -1500 && q[0] < cam.W + 1500; }), P2 = vis.map((p) => cam.proj(p)); if (P2.length < 4) continue;
      const fog = Math.exp(-k * 0.34);
      A.beginPath(); P2.forEach((p, i) => (i ? A.lineTo(p[0], p[1]) : A.moveTo(p[0], p[1]))); A.lineTo(P2[P2.length - 1][0], cam.H + 50); A.lineTo(P2[0][0], cam.H + 50); A.closePath();
      A.fillStyle = U().mixCol('#0a0808', '#3a2420', (1 - fog) * 0.9); A.globalAlpha = 1; A.fill();
      A.beginPath(); P2.forEach((p, i) => (i ? A.lineTo(p[0], p[1]) : A.moveTo(p[0], p[1]))); A.strokeStyle = BONE; A.globalAlpha = 0.5 * fog + 0.12; A.lineWidth = 1.2; A.stroke(); A.globalAlpha = 1;
      if (k > 2) continue;                                                        // 城牆走在最近的三道山脊上
      const top = vis.map((p) => [p[0], p[1], p[2] + 9]);
      E.line(A, cam, top, { color: '#ffe9c4', alpha: 0.95 * fog, width: 1.8 });
      E.line(A, cam, vis.map((p) => [p[0], p[1], p[2] + 1.5]), { color: '#ffe9c4', alpha: 0.5 * fog, width: 1 });
      E.line(A, cam, top, { color: '#ffe9c4', alpha: 0.6 * fog, width: 5, dash: [1.5, 5], cap: 'butt' });                         // 垛口
      A.globalCompositeOperation = 'lighter';
      vis.forEach((p, i) => { if (i % 4 === 2) glowAt(A, cam, [p[0], p[1], p[2] + 10], S.gold, 9 + 4 * pulse, 0.9 * fog); });
      A.globalCompositeOperation = 'source-over';
      vis.forEach((p, i) => { if (i % 9 !== 4) return; boxAll(A, cam, p[0], p[1], p[2], 16, 16, 20, 0, { top: '#2a211a', a: '#120e0b', b: '#1c1611', stroke: '#ffe9c4', alpha: 0.95 * fog }); });
      A.globalCompositeOperation = 'lighter';
      vis.forEach((p, i) => { if (i % 9 === 4) { glowAt(A, cam, [p[0], p[1], p[2] + 24], S.fire, 16 * (1 + 0.6 * pulse) * (0.8 + 0.2 * Math.sin(time * 9 + i)), fog); glowAt(A, cam, [p[0], p[1], p[2] + 24], S.fire, 90, 0.3 * fog); } });   // 烽火
      A.globalCompositeOperation = 'source-over';
    }
    done(g, LY, ctx, o, cam, '路', '中國　長城');
  }

  // ─────────────────────────── 羅馬競技場（西元 80 年啟用）。橢圓形，長約 188、寬約 156、高約 48 公尺；外牆四層，下三層各 80 個拱
  function colosseum(g, LY, t, ctx, o = {}) {
    const { backdrop, groundDots, glowAt, prism } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0;
    const cam = E.makeCam(o.cam || { eye: [170 - u * 16, -230 + u * 14, 112], target: [0, 0, 20], fov: 38, shift: [40, 60] });
    backdrop(g, cam, { sky: ['#04040a', '#0a0912', '#2a1814', '#8a4a26'], band: 'rgba(255,170,90,0.4)', ground: ['#140d09', '#0a0706', '#060505'], stars: 1.4 });
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, DOT, 0.2, '#e0c8a0', 1400);
    A.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 900; i++) { const a = hash(i, 1) * 6.2832, rad = 190 + Math.pow(hash(i, 2), 0.6) * 2600; glowAt(A, cam, [Math.cos(a) * rad, Math.sin(a) * rad, 3], S.gold, 9 + hash(i, 3) * 10, 0.75); }      // 羅馬城
    A.globalCompositeOperation = 'source-over';
    const sy = 156 / 188, TR = { fill: (s2) => U().mixCol('#1a130d', '#6a5038', s2), stroke: '#ffe9c4', alpha: 0.9, ribs: 0.34, sy, n: 80 };
    // 內側：看臺一階一階降到場中（先畫，會被近的外牆擋住一部分）
    for (let k = 0; k < 6; k++) prism(A, cam, 0, 0, 44 - k * 8, 8, 94 - k * 9, 94 - k * 9 - 9, { ...TR, n: 60, inside: true, ribs: 0.14, fill: (s2) => U().mixCol('#0e0a08', '#3a2a1c', s2) });
    const ar = []; for (let i = 0; i <= 60; i++) ar.push([Math.cos(i / 60 * 6.2832) * 43, Math.sin(i / 60 * 6.2832) * 43 * (55 / 87), 0.3]);
    E.line(A, cam, ar, { color: '#ffe9c4', alpha: 0.8, width: 1.3 });
    // 外牆四層
    for (let lv = 0; lv < 4; lv++) prism(A, cam, 0, 0, lv * 12, 12, 94, 94, TR);
    // 拱裡的火光：下三層，每層 80 個
    A.globalCompositeOperation = 'lighter';
    for (let lv = 0; lv < 3; lv++) for (let i = 0; i < 80; i++) {
      const a = ((i + 0.5) / 80) * 6.2832, p = [Math.cos(a) * 94.5, Math.sin(a) * 94.5 * sy, lv * 12 + 5];
      if (Math.cos(a) * sy * (cam.eye[0] - p[0]) + Math.sin(a) * (cam.eye[1] - p[1]) <= 0) continue;
      glowAt(A, cam, p, S.gold, 5.5 * (1 + 0.5 * pulse), 0.95);
    }
    glowAt(A, cam, [0, 0, 2], S.fire, 60 + 30 * pulse, 0.5);
    A.globalCompositeOperation = 'source-over';
    done(g, LY, ctx, o, cam, '路', '義大利　羅馬');
  }

  // ─────────────────────────── 吳哥窟（柬埔寨，十二世紀上半）。五座蓮花塔，中央塔高約 65 公尺；外面一圈護城河；西邊一條長堤道
  function angkor(g, LY, t, ctx, o = {}) {
    const { backdrop, groundDots, glowAt, lathe } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0, time = o.time ?? t;
    const cam = E.makeCam(o.cam || { eye: [-330 + u * 26, -105 + u * 8, 10], target: [0, 0, 34], fov: 36, shift: [0, 130] });
    backdrop(g, cam, { sky: ['#04040a', '#0d0a14', '#3a1c1c', '#d0703a'], band: 'rgba(255,180,110,0.6)', ground: ['#160e0a', '#0a0706', '#060505'], stars: 1.3 });
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, DOT, 0.16, '#e0c8a0', 1300);
    // 水池與堤道
    for (const sy2 of [-1, 1]) for (let i = 0; i < 8; i++) { const y = sy2 * (40 + i * 16); E.line(A, cam, [[-470, y, 0], [-150, y, 0]], { color: i % 3 ? '#3f93e0' : '#bfe0ff', alpha: 0.25 + 0.3 * hash(i, 4), width: 1.1, dash: [40 + hash(i, 1) * 90, 20 + hash(i, 2) * 60], dashOffset: -time * 40 - i * 31 }); }
    for (const y of [-6, 6]) E.line(A, cam, [[-520, y, 1], [-110, y, 1]], { color: BONE, alpha: 0.7, width: 1.3 });
    const ST = { top: '#3a2c20', a: '#140f0b', b: '#20180f', stroke: '#ffd9a8', alpha: 0.9 };
    boxAll(A, cam, 0, 0, 0, 215, 187, 6, 0, ST); boxAll(A, cam, 0, 0, 6, 115, 100, 7, 0, ST); boxAll(A, cam, 0, 0, 13, 62, 62, 12, 0, ST);
    for (const [x0, y0, x1, y1] of [[-107, -93, -107, 93], [107, -93, 107, 93], [-107, -93, 107, -93], [-107, 93, 107, 93]]) boxAll(A, cam, (x0 + x1) / 2, (y0 + y1) / 2, 6, Math.abs(x1 - x0) + 6, Math.abs(y1 - y0) + 6, 5, 0, ST);    // 第一圈迴廊
    const tower = (x, y, z0, k) => lathe(A, cam, x, y, [[z0, 6 * k, 8.5 * k, 8 * k, 's'], [z0 + 6 * k, 7 * k, 8 * k, 7 * k, 's'], [z0 + 13 * k, 7 * k, 7 * k, 5.6 * k, 's'], [z0 + 20 * k, 6 * k, 5.6 * k, 3.8 * k, 's'], [z0 + 26 * k, 5 * k, 3.8 * k, 1.8 * k, 's'], [z0 + 31 * k, 4 * k, 1.8 * k, 0.3 * k, 's']],
      { s: { fill: (s2) => U().mixCol('#120d09', '#5a4028', s2), stroke: '#ffd9a8', alpha: 0.9, ribs: 0.34 } }, 14);
    const tw = [[24, 24, 25, 0.72], [24, -24, 25, 0.72], [0, 0, 25, 1.15], [-24, 24, 25, 0.72], [-24, -24, 25, 0.72]].map((q) => [Math.hypot(q[0] - cam.eye[0], q[1] - cam.eye[1]), q]).sort((a, b) => b[0] - a[0]);
    for (const [, q] of tw) tower(q[0], q[1], q[2], q[3]);
    A.globalCompositeOperation = 'lighter';
    for (const [, q] of tw) glowAt(A, cam, [q[0], q[1], q[2] + 36 * q[3]], S.gold, 4 + 3 * pulse, 0.9);
    for (let i = 0; i < 40; i++) for (const y of [-7.5, 7.5]) glowAt(A, cam, [-510 + i * 10, y, 1.2], S.gold, 2.2 + pulse, 0.85);
    for (let i = 0; i < 14; i++) glowAt(A, cam, [-108, -90 + i * 13.8, 8], S.fire, 3.4, 0.8);
    A.globalCompositeOperation = 'source-over';
    done(g, LY, ctx, o, cam, '路', '柬埔寨　吳哥');
  }

  // ─────────────────────────── 艾菲爾鐵塔（巴黎，1889 年）。高約 300 公尺（加天線 330）；底約 125 公尺見方；三層平臺約在 57、115、276 公尺
  const EW = [[0, 62.5], [20, 50], [57, 33], [80, 26], [115, 19], [150, 13.5], [200, 9], [276, 5], [300, 2.2]];
  const ew = (z) => { let i = 0; while (i < EW.length - 2 && z > EW[i + 1][0]) i++; const a = EW[i], b = EW[i + 1]; return lerp(a[1], b[1], clamp((z - a[0]) / (b[0] - a[0]))); };
  function eiffel(g, LY, t, ctx, o = {}) {
    const { backdrop, groundDots, glowAt } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0, time = o.time ?? t;
    const cam = E.makeCam(o.cam || { eye: [250 - u * 20, -340 + u * 24, 40], target: [0, 0, 150], fov: 44, shift: [0, 60] });
    backdrop(g, cam, { sky: ['#03050c', '#070b18', '#16203a', '#4a4a6a'], band: 'rgba(255,200,150,0.3)', ground: ['#0c0d12', '#07080b', '#050506'], stars: 1.6 });
    const A = LY.A.g; LY.clear(LY.A);
    groundDots(A, cam, DOT, 0.14, '#cbd2e6', 1400);
    A.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 1400; i++) { const x = -3000 + Math.floor(hash(i, 1) * 80) * 75 + hash(i, 4) * 30, y = 200 + hash(i, 2) * 5200; glowAt(A, cam, [x, y, 6], S.gold, 13 + hash(i, 3) * 12, 0.7); }       // 巴黎的燈
    A.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) { const pts = []; for (let x = -3000; x <= 3000; x += 120) pts.push([x, 420 + Math.sin(x * 0.0011) * 260 + i * 14, 0]); E.line(A, cam, pts, { color: i % 4 ? '#3f93e0' : '#bfe0ff', alpha: 0.3 + 0.3 * hash(i, 2), width: 1.2, dash: i % 4 ? [60, 40] : null, dashOffset: -time * 50 }); }   // 塞納河
    const C1 = '#ffd9a0';
    for (const [sx, sy2] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const edge = (k) => { const pts = []; for (let z = 0; z <= 300; z += 6) { const w = ew(z), inn = z < 115 ? Math.max(0, w - lerp(24, 12, z / 115)) : 0; pts.push([sx * (k ? inn : w), sy2 * (k ? inn : w), z]); } return pts; };
      E.line(A, cam, edge(0), { color: C1, alpha: 0.95, width: 1.8 });
      E.line(A, cam, edge(1).filter((p) => p[2] <= 115), { color: C1, alpha: 0.7, width: 1.2 });
    }
    for (let z = 0; z < 300; z += 9) {                                            // 每一層的橫樑與交叉的斜撐
      const w0 = ew(z), w1 = ew(Math.min(300, z + 9)), legs = z < 115;
      for (const [ax, ay, bx, by] of [[1, -1, -1, -1], [1, 1, 1, -1], [-1, 1, 1, 1], [-1, -1, -1, 1]]) {
        if ((ax + bx) * cam.eye[0] + (ay + by) * cam.eye[1] < 0 && z > 115) continue;      // 背面的不畫（上半段）
        if (legs) { const i0 = Math.max(0, w0 - lerp(24, 12, z / 115)), i1 = Math.max(0, w1 - lerp(24, 12, (z + 9) / 115));       // 四隻腳各自的格子
          for (const [cx, cy] of [[ax, ay], [bx, by]]) { const dx = (bx - ax) / 2, dy = (by - ay) / 2, s2 = cx === ax ? 1 : -1;
            const p0 = [cx * w0, cy * w0, z], q0 = [cx * w0 + dx * s2 * (w0 - i0), cy * w0 + dy * s2 * (w0 - i0), z], p1 = [cx * w1, cy * w1, z + 9], q1 = [cx * w1 + dx * s2 * (w1 - i1), cy * w1 + dy * s2 * (w1 - i1), z + 9];
            E.line(A, cam, [p0, q1], { color: C1, alpha: 0.4, width: 0.8 }); E.line(A, cam, [q0, p1], { color: C1, alpha: 0.4, width: 0.8 }); E.line(A, cam, [p0, q0], { color: C1, alpha: 0.5, width: 0.9 }); }
        } else { const p0 = [ax * w0, ay * w0, z], q0 = [bx * w0, by * w0, z], p1 = [ax * w1, ay * w1, z + 9], q1 = [bx * w1, by * w1, z + 9];
          E.line(A, cam, [p0, q1], { color: C1, alpha: 0.45, width: 0.8 }); E.line(A, cam, [q0, p1], { color: C1, alpha: 0.45, width: 0.8 }); E.line(A, cam, [p0, q0], { color: C1, alpha: 0.6, width: 0.9 }); }
      }
    }
    for (const [z, m] of [[57, 3], [115, 3], [276, 2.5]]) boxAll(A, cam, 0, 0, z, ew(z) * 2 + m * 2, ew(z) * 2 + m * 2, 5, 0, { top: '#3a2c1a', a: '#1a130b', b: '#261c10', stroke: C1, alpha: 0.95, width: 1.3 });
    for (const [ax, ay, bx, by] of [[1, -1, -1, -1], [1, 1, 1, -1]]) { const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20, w = 62.5 - 24; pts.push([lerp(ax * w, bx * w, k) + (ax === bx ? ax * 24 : 0), lerp(ay * w, by * w, k) + (ay === by ? ay * 24 : 0), 4 + Math.sin(k * 3.1416) * 44]); } E.line(A, cam, pts, { color: C1, alpha: 0.85, width: 1.4 }); }   // 底下的大拱
    E.line(A, cam, [[0, 0, 300], [0, 0, 330]], { color: C1, alpha: 1, width: 1.6 });
    A.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 300; i++) { const z = hash(i, 5) * 300, w = ew(z), side = (i % 4), sx = side < 2 ? 1 : -1, sy2 = side % 2 ? 1 : -1; if (hash(i, 7, Math.floor(time * 8)) > 0.45) glowAt(A, cam, [sx * w, sy2 * w * (hash(i, 9) * 2 - 1), z], S.white, 2.2, 0.9); }   // 閃爍的燈
    glowAt(A, cam, [0, 0, 330], S.white, 16 + 10 * pulse, 1); glowAt(A, cam, [0, 0, 150], S.gold, 300, 0.12 + 0.1 * pulse);
    A.globalCompositeOperation = 'source-over';
    done(g, LY, ctx, o, cam, '機', '法國　巴黎');
  }

  // ─────────────────────────── 國際太空站（1998 年 11 月第一個艙段升空）。全長約 109 公尺（桁架約 94 公尺）；軌道高度約 413–422 公里（已查維基百科）。背景是真的地球
  function iss(g, LY, t, ctx, o = {}) {
    const { glowAt } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0, GEO = Globe.GEO, D = Globe.D;
    const lon = 20 + u * 3.5, eye = GEO(lon, 34, 4.2e5), tgt = GEO(lon + 22, 30, 0), upv = norm(sub(eye, [0, 0, -E.R]));
    const cam = E.makeCam({ eye, target: tgt, up: upv, fov: 50, shift: [0, -120] });
    Globe.earth(g, LY, cam, { stars: 1.2, sea: ['#0d2238', '#07121f', '#03060b'], dotsR: 0.5, dotColor: '#d8c6a2', dotSize: 1.8, coast50: 0.5, rivers: 0.5, rim: 1.2, rimSun: -1.4, glow: [[26, 0.6], [6, 0.5]],
      draw: (A) => { A.globalCompositeOperation = 'lighter'; for (const c of D.cities) Globe.glow(A, cam, c.p, D.glowGold, 8 + Math.pow(c.pop / 3.5e7, 0.45) * 40, 0.95); A.globalCompositeOperation = 'source-over'; } });
    const A = LY.A.g; LY.clear(LY.A);
    const far = cam; cam2: { /* 太空站離鏡頭只有一百多公尺：換一顆近的鏡頭來畫（方向一樣） */ }
    const camN = E.makeCam({ eye, target: add(eye, mul(far.f, 300)), up: upv, fov: 50, shift: [0, -120] });
    const f = far.f, r = far.r, up = far.u, C0 = add(add(eye, mul(f, 150)), add(mul(up, -22), mul(r, 6 - u * 10)));
    const tr = norm(add(mul(r, 0.92), mul(f, 0.38))), fw = norm(cross(up, tr));      // 桁架的方向、艙段的方向
    const Pt = (a, b, c) => add(C0, add(mul(tr, a), add(mul(fw, b), mul(up, c))));
    const quad = (a0, b0, a1, b1, c, st) => E.face(A, camN, [Pt(a0, b0, c), Pt(a1, b0, c), Pt(a1, b1, c + (st.tilt || 0)), Pt(a0, b1, c + (st.tilt || 0))], { fill: st.fill, stroke: st.stroke, alpha: 0.95, width: 1.2, cull: false });
    const PAN = { fill: '#4a3208', stroke: '#ffd27a', tilt: 5 }, RAD = { fill: '#3a3a40', stroke: '#e8f0ff', tilt: 0 };
    for (const a of [-52, -38, 38, 52]) for (const sb of [-1, 1]) {                 // 八片太陽能板
      quad(a - 5.6, sb * 6, a + 5.6, sb * 40, 0, PAN);
      for (let k = 1; k < 9; k++) E.line(A, camN, [Pt(a - 5.6, sb * (6 + k * 3.8), k * 0.55), Pt(a + 5.6, sb * (6 + k * 3.8), k * 0.55)], { color: '#ffd27a', alpha: 0.5, width: 0.8 });
      E.line(A, camN, [Pt(a, sb * 6, 0), Pt(a, sb * 40, 5)], { color: '#ffd27a', alpha: 0.8, width: 1 });
    }
    for (const a of [-16, 16]) quad(a - 3, -2, a + 3, -20, -1, RAD);
    for (let k = -9; k < 9; k++) { const a0 = k * 6.05, a1 = a0 + 6.05; for (const [c0, c1] of [[-2, 2], [2, -2]]) E.line(A, camN, [Pt(a0, 0, c0), Pt(a1, 0, c1)], { color: BONE, alpha: 0.6, width: 0.9 }); E.line(A, camN, [Pt(a0, 0, -2), Pt(a0, 0, 2)], { color: BONE, alpha: 0.7, width: 0.9 }); }
    for (const c of [-2, 2]) E.line(A, camN, [Pt(-54.5, 0, c), Pt(54.5, 0, c)], { color: BONE, alpha: 0.95, width: 1.5 });
    const mod = (b0, b1, a, c, rad) => { for (let k = 0; k < 8; k++) { const an = (k / 8) * 6.2832, an2 = ((k + 1) / 8) * 6.2832; E.face(A, camN, [Pt(a + Math.cos(an) * rad, b0, c + Math.sin(an) * rad), Pt(a + Math.cos(an2) * rad, b0, c + Math.sin(an2) * rad), Pt(a + Math.cos(an2) * rad, b1, c + Math.sin(an2) * rad), Pt(a + Math.cos(an) * rad, b1, c + Math.sin(an) * rad)], { fill: k < 4 ? '#5a5a62' : '#26262c', stroke: '#e8f0ff', alpha: 0.85, width: 1, cull: false }); } };
    mod(-36, -22, 0, -4, 2.2); mod(-21, -8, 0, -4, 2.2); mod(-7, 6, 0, -4, 2.2); mod(7, 20, 0, -4, 2.2); mod(21, 30, 0, -4, 1.8);     // 一串艙段
    mod(-4, 4, -7, -4, 2.0); mod(-4, 4, 7, -4, 2.0);
    A.globalCompositeOperation = 'lighter';
    glowAt(A, camN, Pt(0, 6, -4), S.gold, 2.6 + pulse, 0.9); glowAt(A, camN, Pt(0, -22, -4), S.white, 2.2, 0.9); glowAt(A, camN, Pt(54, 0, 0), S.red, 2.4 + 1.5 * pulse, 1); glowAt(A, camN, Pt(-54, 0, 0), S.white, 2.4 + 1.5 * pulse, 1);
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[20, 0.45], [5, 0.4]] }); ctx.grade(g, { vig: 0.45 });
    if (o.readout !== false) ctx.readout(g, { glyph: '網', era: '離地 420 公里', len: (20 * cam.foc) / 150, label: '20 公尺', ...(o.readout || {}) });
  }

  // ─────────────────────────── 晶片（示意）。鏡頭和巴比倫、現代的城同一個構圖：晶片是另一座城
  const R6 = rng(2022), BLK = [], TRC = [];
  for (let gx = -30; gx < 30; gx += 2.4) for (let gy = -26; gy < 44; gy += 2.4) { if (Math.hypot(gx, gy) < 3.2 || R6() < 0.14) continue; const core = Math.pow(clamp(1 - Math.hypot(gx, gy) / 22), 1.4); BLK.push({ x: gx + 1.1, y: gy + 1.1, w: 1.4 + R6() * 0.7, d: 1.4 + R6() * 0.7, h: 0.12 + R6() * R6() * 0.5 + core * R6() * 2.6, seed: R6() }); }
  for (let i = 0; i < 260; i++) { let x = Math.round((R6() - 0.5) * 24) * 2.4, y = Math.round((R6() - 0.3) * 26) * 2.4; const pts = [[x, y, 0.02]]; for (let k = 0; k < 3 + (R6() * 5 | 0); k++) { if (k % 2) y += Math.round((R6() - 0.5) * 8) * 2.4; else x += Math.round((R6() - 0.5) * 8) * 2.4; pts.push([x, y, 0.02]); } TRC.push({ pts, seed: R6(), cool: R6() < 0.6 }); }
  function chip(g, LY, t, ctx, o = {}) {
    const { backdrop, glowAt } = U(), S = WS(), u = o.u ?? 0, pulse = o.pulse ?? 0, time = o.time ?? t, K = 0.045;
    const cam = E.makeCam(o.cam || { eye: [(300 - u * 26) * K, (-330 + u * 30) * K, (150 - u * 12) * K], target: [-10 * K, 12 * K, 40 * K * 0.5], fov: 36, shift: [40, 150] });
    backdrop(g, cam, { sky: ['#02040a', '#050a14', '#0a1c2c', '#14405a'], band: 'rgba(120,220,255,0.3)', ground: ['#060b10', '#04070a', '#040506'], stars: 0 });
    const A = LY.A.g; LY.clear(LY.A);
    for (const tr of TRC) E.line(A, cam, tr.pts, { color: tr.cool ? '#6fd0ff' : '#f6bd62', alpha: 0.45, width: 1 });
    const objs = BLK.map((b) => ({ d: Math.hypot(b.x - cam.eye[0], b.y - cam.eye[1]), b })); objs.push({ d: Math.hypot(cam.eye[0], cam.eye[1]), core: true });
    objs.sort((a, b) => b.d - a.d);
    for (const ob of objs) {
      if (ob.core) { let z = 0; for (const [w, h] of [[5.2, 1.4], [4.0, 1.2], [2.8, 1.0], [1.6, 0.9]]) { boxAll(A, cam, 0, 0, z, w, w, h, 0, { top: '#12303e', a: '#081820', b: '#0c222c', stroke: '#bff0ff', alpha: 0.95, width: 1.5 }); z += h; } continue; }
      const b = ob.b, c = cam.proj([b.x, b.y, b.h]); if (!c || c[0] < -200 || c[0] > cam.W + 200 || c[1] > cam.H + 300) continue;
      boxAll(A, cam, b.x, b.y, 0, b.w, b.d, b.h, 0, { top: '#0e1c26', a: '#060c12', b: '#0a141c', stroke: b.seed < 0.25 ? '#f6bd62' : '#8fd8ff', alpha: 0.55 * Math.exp(-ob.d / 90), width: 0.9 });
    }
    A.globalCompositeOperation = 'lighter';
    for (const tr of TRC) { const k = (time * (0.5 + tr.seed) * 0.6 + tr.seed * 7) % 1; glowAt(A, cam, Globe.bead(tr.pts, k), tr.cool ? S.white : S.gold, 0.5 + 0.3 * pulse, 0.95); }      // 沿著線路跑的訊號
    for (const ob of objs) if (!ob.core && ob.b.seed > 0.55) glowAt(A, cam, [ob.b.x, ob.b.y, ob.b.h + 0.05], ob.b.seed > 0.85 ? S.gold : S.white, 0.5 + 0.25 * pulse, 0.8 * Math.exp(-ob.d / 90));
    glowAt(A, cam, [0, 0, 4.7], S.white, 1.6 + 1.2 * pulse, 1); glowAt(A, cam, [0, 0, 3], S.white, 14 + 8 * pulse, 0.3);
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[22, 0.5], [5, 0.42]] }); ctx.grade(g, { vig: 0.5 });
    if (o.readout !== false) ctx.readout(g, { glyph: '網', era: '示意', ...ctx.niceScale((cam.foc / cam.dist) * 2000, 200), ...(o.readout || {}) });       // 畫面裡的一個單位當成半公釐
  }

  Object.assign(root.Wonders, { stonehenge, parthenon, greatwall, colosseum, angkor, eiffel, iss, chip });
})(typeof self !== 'undefined' ? self : this);
