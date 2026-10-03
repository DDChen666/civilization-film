// 城：巴比倫，西元前六百年左右。中間是七層的塔廟（埃特曼安吉），尺寸照「埃薩吉拉泥板」的記載：
// 底 91.5 公尺見方，七層高 33、18、6、6、6、6、15，共約 90 公尺。城裡的房子、街道、棕櫚是程式長出來的，不是考古復原。
(function (root) {
  'use strict';
  const { add, sub, mul, dot, cross, norm, len, clamp, lerp, sstep, rng, hash, fbm } = E;
  const TIERS = [[91.5, 91.5, 33], [78, 78, 18], [60, 60, 6], [51, 51, 6], [42, 42, 6], [33, 33, 6], [24, 22.5, 15]];
  const PREC = 205;                 // 聖域的半寬
  const RIVER = [-470, -330];       // 幼發拉底河（x 的範圍，沿 y 方向流）
  const WAY = [262, 284];           // 遊行大道
  let S = null;

  function init() {
    const r = rng(600);
    const houses = [];
    const inRiver = (x) => x > RIVER[0] - 14 && x < RIVER[1] + 14;
    // 街區：歪斜的格子，每格一棟帶中庭的泥磚房
    for (let gx = -1000; gx < 900; gx += 19) for (let gy = -800; gy < 1400; gy += 19) {
      const blockx = Math.floor((gx + 2000) / 114), blocky = Math.floor((gy + 2000) / 95);
      if ((((gx + 2000) % 114) + 114) % 114 < 19 * 0.9 || (((gy + 2000) % 95) + 95) % 95 < 19 * 0.9) continue;      // 街道
      const x = gx + (r() - 0.5) * 5, y = gy + (r() - 0.5) * 5;
      if (Math.abs(x) < PREC + 16 && Math.abs(y) < PREC + 16) continue;
      if (inRiver(x) || (x > WAY[0] - 10 && x < WAY[1] + 10)) continue;
      if (hash(blockx, blocky, 5) < 0.1 || r() < 0.07) continue;                                               // 空地
      const w = 11 + r() * 7, d = 11 + r() * 7, h = 3.6 + r() * r() * 6.5;
      houses.push({ x, y, w, d, h, rot: (hash(blockx, blocky, 9) - 0.5) * 0.16 + (r() - 0.5) * 0.05, lit: r() < 0.42, seed: r(), court: r() < 0.7 });
    }
    // 聖域的牆與牆塔
    const walls = [];
    const wallRun = (x0, y0, x1, y1, th, h, towerEvery, towerH) => {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.round(L / towerEvery), rot = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n, cx = lerp(x0, x1, (a + b) / 2), cy = lerp(y0, y1, (a + b) / 2);
        walls.push({ x: cx, y: cy, w: L / n + 0.2, d: th, h, rot, tower: false });
        walls.push({ x: lerp(x0, x1, a), y: lerp(y0, y1, a), w: th * 1.5, d: th * 1.7, h: towerH, rot, tower: true });
      }
    };
    const P = PREC;
    wallRun(-P, -P, P, -P, 7, 11, 34, 15); wallRun(P, -P, P, P, 7, 11, 34, 15); wallRun(P, P, -P, P, 7, 11, 34, 15); wallRun(-P, P, -P, -P, 7, 11, 34, 15);
    // 河岸與遠處的城牆
    wallRun(RIVER[1] + 22, -820, RIVER[1] + 22, 1400, 6, 7, 60, 10);
    // 棕櫚：沿河、聖域裡、零星
    const palms = [];
    for (let i = 0; i < 520; i++) {
      const k = r();
      let x, y;
      if (k < 0.45) { x = (r() < 0.5 ? RIVER[1] + 6 + r() * 12 : RIVER[0] - 6 - r() * 12); y = -820 + r() * 2200; }
      else if (k < 0.53) { const a = r() * Math.PI * 2, rad = 105 + r() * 90; x = Math.cos(a) * rad; y = Math.sin(a) * rad; if (Math.abs(x) < 70 && y < -40) continue; }
      else { x = -1000 + r() * 1900; y = -800 + r() * 2200; if (inRiver(x) || (Math.abs(x) < PREC + 10 && Math.abs(y) < PREC + 10)) continue; }
      palms.push({ x, y, h: 8 + r() * 7, seed: r() });
    }
    // 地面的點（讓平面有存在感，鏡頭動的時候有東西滑過）
    const ground = [];
    for (let i = 0; i < 26000; i++) { const x = -1600 + r() * 3000, y = -1000 + r() * 3600; if (!inRiver(x)) ground.push(x, y); }
    // 遠處的燈火
    const far = [];
    for (let i = 0; i < 900; i++) { const a = r() * Math.PI * 2, rad = 1300 + Math.pow(r(), 0.6) * 16000; far.push([Math.cos(a) * rad, Math.sin(a) * rad, r()]); }
    // 遊行大道上的火把隊伍
    const march = [];
    for (let i = 0; i < 90; i++) march.push([lerp(WAY[0] + 5, WAY[1] - 5, r()), r(), r()]);
    const sparks = [];
    for (let i = 0; i < 110; i++) sparks.push([r(), r(), r(), r()]);
    S = { houses, walls, palms, ground: new Float32Array(ground), far, march, sparks,
      glowGold: sprite([[0, 'rgba(255,238,196,1)'], [0.18, 'rgba(255,190,96,0.85)'], [0.5, 'rgba(244,140,52,0.2)'], [1, 'rgba(240,120,40,0)']]),
      glowFire: sprite([[0, 'rgba(255,244,214,1)'], [0.12, 'rgba(255,170,80,0.95)'], [0.4, 'rgba(232,80,42,0.35)'], [1, 'rgba(200,50,20,0)']]),
      glowBlue: sprite([[0, 'rgba(220,240,255,1)'], [0.2, 'rgba(110,180,255,0.7)'], [0.55, 'rgba(63,147,224,0.16)'], [1, 'rgba(63,147,224,0)']]) };
  }
  function sprite(stops, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [k, col] of stops) gr.addColorStop(k, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }
  const glowAt = (g, cam, p, spr, px, a = 1) => { const s = cam.proj(p); if (!s) return; let k = px * (cam.foc / s[2]); if (k < 2.2) { a *= Math.max(0.35, k / 2.2); k = 2.2; } /* 遠到比一個點還小：還是留一個點，整座城才看得出是一片燈火 */ g.globalAlpha = a; g.drawImage(spr, s[0] - k / 2, s[1] - k / 2, k, k); g.globalAlpha = 1; return s; };

  // ── 塔廟
  function drawZiggurat(g, cam, C, { fog = 1, grow = 1 } = {}) {
    let z = 0;
    const visTiers = Math.ceil(clamp(grow) * TIERS.length);
    TIERS.forEach(([w, d, h], i) => {
      if (i >= visTiers) return;
      const top = i === TIERS.length - 1, col = top ? '#7fc0ff' : C.bone;
      const F = E.boxFaces(0, 0, z, w, d, h, 0, top ? 0 : 0.035);
      const fills = top ? ['#0d1f33', '#0a1727', '#0a1727', '#0a1727', '#0a1727'] : ['#19130e', '#0d0a08', '#120e0a', '#0d0a08', '#120e0a'];
      F.forEach((f, k) => {
        if (!E.face(g, cam, f, { fill: fills[k], stroke: col, alpha: 0.95 * fog, width: top ? 1.8 : 1.5 })) return;
        if (k === 0) return;
        // 牆面的壁柱：一條一條的直線；還有幾道磚層的橫線
        const a = f[0], b = f[1], t1 = f[2], t0 = f[3], L = len(sub(b, a)), n = Math.max(2, Math.round(L / (top ? 3 : 5.2)));
        g.beginPath();
        for (let j = 1; j < n; j++) { const u = j / n, p0 = cam.proj(E.mix(a, b, u)), p1 = cam.proj(E.mix(t0, t1, u)); if (p0 && p1) { g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); } }
        g.strokeStyle = col; g.globalAlpha = 0.26 * fog; g.lineWidth = 0.8; g.stroke();
        g.beginPath();
        const rows = Math.max(1, Math.round(h / 6));
        for (let j = 1; j < rows; j++) { const v = j / rows, p0 = cam.proj(E.mix(a, t0, v)), p1 = cam.proj(E.mix(b, t1, v)); if (p0 && p1) { g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); } }
        g.globalAlpha = 0.16 * fog; g.stroke(); g.globalAlpha = 1;
      });
      if (i === 0) {       // 三道大階梯：正中一道垂直於正面，兩側各一道貼著正面往中間爬
        const y0 = -d / 2, H1 = h, Wc = 9.5, run = 58;
        const ramp = (A0, A1, B1, B0, steps) => {            // A：下緣的兩個角；B：上緣的兩個角
          E.face(g, cam, [A0, A1, B1, B0], { fill: '#1d1610', stroke: C.bone, alpha: 0.9 * fog, width: 1.3, cull: false });
          g.beginPath();
          for (let j = 1; j < steps; j++) { const u = j / steps, p0 = cam.proj(E.mix(A0, B0, u)), p1 = cam.proj(E.mix(A1, B1, u)); if (p0 && p1) { g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); } }
          g.strokeStyle = C.bone; g.globalAlpha = 0.34 * fog; g.lineWidth = 0.8; g.stroke(); g.globalAlpha = 1;
        };
        const side = (sx) => {
          const x0 = sx * (w / 2 + 2), x1 = sx * (Wc / 2 + 1), ya = y0 - 9, yb = y0 - 1;
          E.face(g, cam, [[x0, ya, 0], [x1, ya, H1], [x1, ya, 0]], { fill: '#0d0a08', stroke: C.bone, alpha: 0.7 * fog, width: 1, cull: false });
          ramp([x0, ya, 0], [x0, yb, 0], [x1, yb, H1], [x1, ya, H1], 46);
        };
        side(-1); side(1);
        E.face(g, cam, [[Wc / 2, y0 - run, 0], [Wc / 2, y0, H1], [Wc / 2, y0, 0]], { fill: '#0d0a08', stroke: C.bone, alpha: 0.7 * fog, width: 1, cull: false });
        E.face(g, cam, [[-Wc / 2, y0 - run, 0], [-Wc / 2, y0, 0], [-Wc / 2, y0, H1]], { fill: '#0d0a08', stroke: C.bone, alpha: 0.7 * fog, width: 1, cull: false });
        ramp([-Wc / 2, y0 - run, 0], [Wc / 2, y0 - run, 0], [Wc / 2, y0, H1], [-Wc / 2, y0, H1], 60);
      }
      z += h;
    });
    return z;
  }

  function horizonY(cam) { const p = cam.proj([cam.eye[0] + cam.f[0] * 4e5, cam.eye[1] + cam.f[1] * 4e5, 0]); return p ? p[1] : 0; }

  /** o.cam：鏡頭（不給就用關鍵格的鏡頭）；o.time：動畫用的時間（河水、火星、隊伍）；o.fire：塔頂的火有多旺；o.readout：讀數的參數 */
  function frame(g, LY, t, ctx, o = {}) {
    const time = o.time ?? t, fireK = o.fire ?? 1, growK = o.grow ?? 1, zigK = o.zig ?? 1;
    const { C, readout, niceScale, grade } = ctx;
    const W = 1920, H = 1080, k = M.ease.cubicInOut(clamp(t));
    const cam = o.camObj || E.makeCam(o.cam || { eye: [300 + k * 22, -330 - k * 30, 150 + k * 14], target: [-10, 12, 40], fov: 36, shift: [40, 150] });
    // 天：地平線上一道暮色，上面是星
    const hy = horizonY(cam);
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#04040a'); sky.addColorStop(0.55, '#0a0810'); sky.addColorStop(0.86, '#2a1410'); sky.addColorStop(1, '#6a2c14');
    g.fillStyle = sky; g.fillRect(0, 0, W, hy + 1);
    Globe.drawStars(g, cam, 1.6);
    const hz = g.createLinearGradient(0, hy - 90, 0, hy + 4);
    hz.addColorStop(0, 'rgba(255,140,60,0)'); hz.addColorStop(1, 'rgba(255,160,80,0.36)');
    g.fillStyle = hz; g.fillRect(0, hy - 90, W, 94);
    const gd = g.createLinearGradient(0, hy, 0, H);
    gd.addColorStop(0, '#120b08'); gd.addColorStop(0.25, '#0a0706'); gd.addColorStop(1, '#060505');
    g.fillStyle = gd; g.fillRect(0, hy, W, H - hy);

    const A = LY.A.g; LY.clear(LY.A);
    const fogOf = (d) => Math.exp(-d / 2100);
    // 地面的點
    A.fillStyle = '#cbb894'; A.beginPath();
    const G = S.ground;
    for (let i = 0; i < G.length; i += 2) { const p = cam.proj([G[i], G[i + 1], 0]); if (!p || p[1] > H + 2 || p[0] < 0 || p[0] > W) continue; const s = clamp(2600 / p[2], 0.5, 2.2); A.rect(p[0], p[1], s, s * 0.6); }
    A.globalAlpha = 0.22; A.fill(); A.globalAlpha = 1;
    // 河：一道一道發亮的水紋
    for (let i = 0; i < 26; i++) {
      const u = (i + 0.5) / 26, x = lerp(RIVER[0], RIVER[1], u), pts = [];
      for (let y = -900; y <= 5200; y += 28) pts.push([x + Math.sin(y * 0.012 + i * 1.7 + time * 0.8) * 3.2 + fbm(y * 0.004, i, 2, 3) * 9, y, 0]);
      const edge = Math.min(u, 1 - u) < 0.06;
      E.line(A, cam, pts, { color: edge ? '#bfe0ff' : C.lapis, alpha: edge ? 0.85 : 0.2 + 0.5 * hash(i, 7), width: edge ? 1.6 : 1.1, dash: edge ? null : [60 + hash(i, 1) * 140, 30 + hash(i, 2) * 90], dashOffset: -time * 60 - i * 37 });
    }
    // 地平線上的一層薄霧：遠處的東西融進暮色
    const hzg = g.createLinearGradient(0, hy - 6, 0, hy + 70);
    hzg.addColorStop(0, 'rgba(120,56,26,0.55)'); hzg.addColorStop(1, 'rgba(120,56,26,0)');
    g.fillStyle = hzg; g.fillRect(0, hy - 6, W, 80);
    // 遠處平原上的燈火
    A.globalCompositeOperation = 'lighter';
    for (const f of S.far) glowAt(A, cam, [f[0], f[1], 2], S.glowGold, 30 + f[2] * 46, 0.75);
    A.globalCompositeOperation = 'source-over';
    // 遊行大道
    if (o.extra) o.extra(A, cam);                                              // 城外的水渠、村落（鏡頭升高之後才看得到）
    for (const x of WAY) E.line(A, cam, [[x, -820, 0], [x, 1400, 0]], { color: C.bone, alpha: 0.5, width: 1.1 });

    // 所有實心的東西：由遠到近畫
    const objs = [];
    for (const h of S.houses) { if (h.gr === undefined) h.gr = hash(h.x, h.y, 7) * 0.45 + Math.hypot(h.x, h.y) / 2400; if (h.gr <= growK) objs.push({ d: Math.hypot(h.x - cam.eye[0], h.y - cam.eye[1]), kind: 0, h }); }
    if (growK > 0.3) for (const w of S.walls) objs.push({ d: Math.hypot(w.x - cam.eye[0], w.y - cam.eye[1]) - (w.tower ? 4 : 0), kind: 1, h: w });
    for (const p of S.palms) objs.push({ d: Math.hypot(p.x - cam.eye[0], p.y - cam.eye[1]), kind: 2, h: p });
    objs.push({ d: Math.hypot(cam.eye[0], cam.eye[1] + 40), kind: 3 });
    objs.sort((a, b) => b.d - a.d);
    const lights = [];
    for (const o of objs) {
      const fog = fogOf(o.d), h = o.h;
      if (o.kind === 0) {
        const c = cam.proj([h.x, h.y, h.h]); if (!c || c[0] < -200 || c[0] > W + 200 || c[1] > H + 300) continue;
        const F = E.boxFaces(h.x, h.y, 0, h.w, h.d, h.h, h.rot), near = o.d < 900;
        E.face(A, cam, F[0], { fill: '#17120e', stroke: C.bone, alpha: 0.5 * fog, width: near ? 1.0 : 0.7 });
        for (let k2 = 1; k2 < 5; k2++) E.face(A, cam, F[k2], { fill: k2 % 2 ? '#0b0908' : '#100c0a', stroke: C.bone, alpha: 0.42 * fog, width: near ? 0.9 : 0.6 });
        if (h.court && near) { const q = E.boxFaces(h.x, h.y, h.h, h.w * 0.42, h.d * 0.42, 0.01, h.rot)[0]; E.face(A, cam, q, { fill: h.lit ? '#3a1d0c' : '#060505', stroke: C.bone, alpha: 0.4 * fog, width: 0.7, cull: false }); }
        if (h.lit) lights.push([[h.x, h.y, h.h + 0.5], 13 + h.seed * 12, 0.75 * fog + 0.1]);
      } else if (o.kind === 1) {
        const F = E.boxFaces(h.x, h.y, 0, h.w, h.d, h.h, h.rot);
        F.forEach((f, k2) => E.face(A, cam, f, { fill: k2 === 0 ? '#1b1510' : '#0e0b09', stroke: C.bone, alpha: (h.tower ? 0.85 : 0.7) * fog, width: 1.1 }));
        if (h.tower && hash(h.x, h.y) < 0.55) lights.push([[h.x, h.y, h.h + 1.5], 20, 0.9 * fog]);
      } else if (o.kind === 2) {
        const top = [h.x + (h.seed - 0.5) * 2, h.y, h.h], b = cam.proj([h.x, h.y, 0]), tp = cam.proj(top); if (!b || !tp) continue;
        A.strokeStyle = '#bfae8c'; A.globalAlpha = 0.42 * fog; A.lineWidth = clamp(330 / o.d, 0.5, 1.3);
        A.beginPath(); A.moveTo(b[0], b[1]); A.lineTo(tp[0], tp[1]);
        for (let j = 0; j < 9; j++) { const a = (j / 9) * Math.PI * 2 + h.seed * 6, fr = cam.proj([top[0] + Math.cos(a) * 3.0, top[1] + Math.sin(a) * 3.0, top[2] - 2.2 + Math.sin(j * 2.1) * 0.7]); if (fr) { A.moveTo(tp[0], tp[1]); A.quadraticCurveTo((tp[0] + fr[0]) / 2, Math.min(tp[1], fr[1]) - (cam.foc / o.d) * 1.2, fr[0], fr[1]); } }
        A.stroke(); A.globalAlpha = 1;
      } else {
        const topZ = drawZiggurat(A, cam, C, { fog: 1, grow: zigK });
        if (zigK >= 0.999) lights.push([[0, 0, topZ + 4], 46, 1, 'fire'], [[0, 0, topZ + 4], 210, 0.3, 'fire'], [[3, -11.4, topZ - 10], 26, 0.9, 'fire']);
        if (zigK > 0.15) for (let j = 0; j < 14; j++) lights.push([[0 + (j % 2 ? 4 : -4), -46 - 58 * (1 - j / 13) , 33 * (j / 13) + 1.5], 15, 0.95]);     // 中央階梯上的火把
      }
    }
    // 燈火與火把：用加法疊上去
    A.globalCompositeOperation = 'lighter';
    for (const [p, px, a, kind] of lights) glowAt(A, cam, p, kind === 'fire' ? S.glowFire : S.glowGold, kind === 'fire' ? px * fireK : px * (o.lights ?? 1), a);
    for (const m of S.march) { const y = -820 + ((m[1] + time * 0.012) % 1) * 2200; glowAt(A, cam, [m[0], y, 2], S.glowGold, 12 + m[2] * 7, 0.9); }
    // 塔頂的火星
    if (zigK >= 0.999) for (const sp of S.sparks) {
      const life = (sp[0] + time * (0.25 + sp[1] * 0.3)) % 1, x = (sp[2] - 0.5) * 8 + Math.sin(life * 7 + sp[3] * 6) * 9 * life + life * life * 26, zz = 95 + Math.pow(life, 0.8) * (22 + sp[1] * 34);
      glowAt(A, cam, [x, (sp[3] - 0.5) * 8 + Math.cos(life * 5 + sp[2] * 9) * 6 * life, zz], S.glowFire, 2.6 * (1 - life) + 0.9, Math.pow(1 - life, 1.5) * 0.85);
    }
    A.globalCompositeOperation = 'source-over';
    LY.composite(g, LY.A, { glow: [[24, 0.5], [6, 0.42]] });
    if (o.grade !== false) grade(g, { vig: 0.5 });
    const sc = niceScale(cam.foc / cam.dist, 200);
    if (o.readout !== false) readout(g, { glyph: '城', era: '巴比倫　西元前 600 年', ...sc, ...(o.readout || {}) });
  }

  root.City = { init, frame, drawZiggurat, TIERS, get S() { return S; } };
})(typeof self !== 'undefined' ? self : this);
