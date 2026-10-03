// 火與田：岩壁前的營火，然後是田、水渠、村子。
// 兩塊東西：
//   「營地」：岩壁、營火、帳篷、人。它有自己的座標（岩壁在 y=0、面向南邊，地面在 z=-1.3），整塊放在世界的 CAMP 那個位置
//   「村子與田」：就在世界的原點周圍。之後巴比倫的塔廟會蓋在同一個地方、河也是同一條
// 全部是程式長出來的示意，不是任何一個真的遺址。
(function (root) {
  'use strict';
  const { add, sub, mul, clamp, lerp, sstep, rng, hash, fbm, mix } = E;
  const CAMP = [-205, -300, 1.3], G = -1.3, BONE = '#efe4cf';
  let S = null;
  const U = () => Wonders.util;

  function init() {
    const r = rng(40000);
    // ── 營地
    const FX = -4.6, FY = -5.6;
    const fires = [[FX, FY, 1.0, 0]];
    for (let i = 0; i < 46; i++) { const a = r() * Math.PI - Math.PI, rad = 8 + r() * 62; fires.push([Math.cos(a) * rad * 1.5 + 2, Math.min(-7, Math.sin(a) * rad - 7), 0.6 + r() * 0.5, clamp(0.12 + (rad / 70) * 0.5 + r() * 0.12)]); }
    for (let i = 0; i < 150; i++) { const a = r() * Math.PI - Math.PI, rad = 9 + Math.pow(r(), 0.8) * 420; fires.push([Math.cos(a) * rad * 1.3 + 4, Math.min(-6, Math.sin(a) * rad - 6), 0.6 + r() * 0.6, clamp(0.1 + (rad / 430) * 0.7 + r() * 0.15)]); }
    const tents = [];
    fires.forEach((f, i) => { const n = i === 0 ? 4 : i < 60 ? 1 + ((r() * 3) | 0) : 1; for (let k = 0; k < n; k++) { const a = (i === 0 ? 2.2 + k * 0.75 : r() * 6.28), rad = (i === 0 ? 5.2 : 3.2) + r() * 2.5; tents.push({ x: f[0] + Math.cos(a) * rad, y: Math.min(-3.4, f[1] + Math.sin(a) * rad), h: 2.1 + r() * 0.8, w: 1.5 + r() * 0.6, born: f[3], rot: r() * 6.28 }); } });
    const people = [];
    for (let k = 0; k < 7; k++) { const a = 0.5 + k * 0.82; people.push({ x: FX + Math.cos(a) * 1.75, y: FY + Math.sin(a) * 1.55, sit: k !== 2 && k !== 5, a, born: 0 }); }
    fires.slice(1, 70).forEach((f) => { const n = 2 + ((r() * 4) | 0); for (let k = 0; k < n; k++) { const a = r() * 6.28; people.push({ x: f[0] + Math.cos(a) * 1.6, y: f[1] + Math.sin(a) * 1.5, sit: r() < 0.7, a, born: f[3] }); } });
    // 岩壁的線稿：上緣、岩層、裂縫
    const top = []; for (let x = -60; x <= 60; x += 1.5) top.push([x, 0, 8.5 + (fbm(x * 0.09, 3, 3, 4) - 0.5) * 7 - Math.pow(Math.abs(x) / 60, 3) * 7]);
    const strata = []; for (let k = 0; k < 9; k++) { const pts = []; const z0 = G + 0.6 + k * 1.05, x0 = -60 + r() * 30, x1 = 60 - r() * 30; for (let x = x0; x <= x1; x += 2) pts.push([x, 0, z0 + (fbm(x * 0.07, k * 2.7, 3, 9) - 0.5) * 1.6]); strata.push(pts); }
    const cracks = []; for (let k = 0; k < 26; k++) { let x = -58 + r() * 116, z = 8; const pts = []; while (z > G) { pts.push([x, 0, Math.min(z, 12)]); x += (r() - 0.5) * 0.9; z -= 0.5 + r() * 0.8; } cracks.push(pts); }
    const campDots = []; for (let i = 0; i < 22000; i++) { const x = -520 + r() * 1040, y = -640 + r() * 639; campDots.push(x, y); }
    const trees = []; for (let i = 0; i < 220; i++) { const x = -220 + r() * 440, y = -330 + r() * 300; if (Math.hypot(x + 4.6, y + 5.6) < 18) continue; trees.push([x, y, 4 + r() * 6]); }
    // ── 村子與田（世界座標，原點周圍；河在 x≈-400，南北向）
    const parcels = [];
    for (let gx = -300; gx < 620; gx += 46) for (let gy = -620; gy < 640; gy += 70) {
      const x = gx + (r() - 0.5) * 8, y = gy + (r() - 0.5) * 10;
      if (Math.hypot(x, y) < 78 || r() < 0.2) continue;
      if (x < -150 && y < -230 && y > -380) continue;                           // 岩壁那一帶
      parcels.push({ x, y, w: 34 + r() * 8, d: 54 + r() * 10, rot: (r() - 0.5) * 0.12, n: 5 + ((r() * 5) | 0), born: clamp((x + 320) / 950 * 0.72 + r() * 0.16 + Math.abs(y) / 6000 - 0.06), gold: r() < 0.7 });
    }
    const canals = [];
    for (const y0 of [-470, -250, -40, 170, 390, 560]) { const pts = []; for (let x = -330; x < 640; x += 24) pts.push([x, y0 + (fbm(x * 0.006, y0 * 0.01, 2, 5) - 0.5) * 60, 0]); canals.push({ pts, born: clamp(0.08 + Math.abs(y0) / 1400) }); }
    const houses = [];
    for (let i = 0; i < 110; i++) { const a = r() * 6.28, rad = 16 + Math.pow(r(), 0.75) * 66; houses.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.9, w: 6 + r() * 4, d: 6 + r() * 4, h: 2.8 + r() * 2, rot: r() * 0.5, born: 0.22 + (rad / 82) * 0.6 + r() * 0.08, lit: r() < 0.6, seed: r() }); }
    const farV = []; for (let i = 0; i < 520; i++) { const a = r() * 6.28, rad = 700 + Math.pow(r(), 0.6) * 9000; farV.push([Math.cos(a) * rad, Math.sin(a) * rad, r(), 0.3 + r() * 0.7]); }
    const dots = []; for (let i = 0; i < 26000; i++) { const x = -1700 + r() * 3200, y = -1300 + r() * 3600; if (x > -470 && x < -330) continue; dots.push(x, y); }
    const sparks = []; for (let i = 0; i < 60; i++) sparks.push([r(), r(), r(), r()]);
    S = { fires, tents, people, top, strata, cracks, campDots: new Float32Array(campDots), trees, parcels, canals, houses, farV, dots: new Float32Array(dots), sparks };
  }

  /** 把鏡頭搬到營地的座標裡（等於把營地放在世界的 CAMP） */
  function campCam(cam) {
    const o = CAMP, sh = (p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    const eye = sh(cam.eye);
    const toCam = (p) => { const x = p[0] - eye[0], y = p[1] - eye[1], z = p[2] - eye[2]; return [x * cam.r[0] + y * cam.r[1] + z * cam.r[2], x * cam.u[0] + y * cam.u[1] + z * cam.u[2], x * cam.f[0] + y * cam.f[1] + z * cam.f[2]]; };
    const fromCam = cam.fromCam;
    return { ...cam, eye, toCam, proj: (p) => fromCam(toCam(p)), hidden: () => false };
  }

  /** st：{ d 鏡頭距離, fire 火這一段走到哪（0..1）, field 田這一段走到哪（0..1，還沒到就 0）, time, pulse, hands(i)→那個手印噴到哪 } */
  function draw(g, LY, cam, ctx, st) {
    const { backdrop, groundDots, glowAt, prism } = U(), WS = Wonders.S, CS = City.S;
    const d = st.d, time = st.time, fp = st.field || 0, pulse = st.pulse || 0;
    const cc = campCam(cam);
    const dusk = sstep(0.0, 0.5, fp);                                           // 田：天色從夜裡的營火變成黎明
    backdrop(g, cam, { sky: ['#04040a', '#0a0810', mixHex('#1c100e', '#33201a', dusk), mixHex('#5a2812', '#b06a30', dusk)], band: `rgba(255,${150 + 40 * dusk},${70 + 60 * dusk},${0.3 + 0.2 * dusk})`, ground: ['#120b08', '#0a0706', '#060505'], stars: 1.9 - 0.9 * dusk });
    // 近的時候：有質感的岩壁
    const wallA = 1 - sstep(5, 14, d), cliffA = sstep(1.2, 3, d) * (1 - sstep(260, 520, d));
    if (cliffA > 0.01) {
      const poly = S.top.map((p) => cc.proj(p)), b0 = cc.proj([60, 0, G]), b1 = cc.proj([-60, 0, G]);
      if (b0 && b1 && poly.every(Boolean)) { g.save(); g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.closePath(); const gr = g.createLinearGradient(0, Math.min(b0[1], b1[1]), 0, poly[40][1]); gr.addColorStop(0, '#221610'); gr.addColorStop(1, '#0d0908'); g.fillStyle = gr; g.globalAlpha = cliffA; g.fill(); g.restore(); }
    }
    if (cliffA > 0.01) for (const [x0, x1] of [[-62, -20], [-24, 24], [20, 62]]) Cave.drawCliff(g, cc, x0, G - 0.5, x1, G + 12.5, 0.75 * cliffA);
    if (wallA > 0.01) Cave.drawWall(g, cc, wallA, 1 - sstep(1.2, 4, d));
    const A = LY.A.g; LY.clear(LY.A);
    if (wallA > 0.01) Cave.drawHands(A, cc, { grow: st.hands || (() => 1), gain: wallA * (1 + 0.5 * pulse) });
    // ── 營地的線稿
    const campA = sstep(1.6, 5, d) * (1 - sstep(260, 520, d));
    if (campA > 0.01) {
      E.line(A, cc, S.top, { color: BONE, alpha: 0.65 * campA, width: 1.4 });
      E.line(A, cc, [[-60, 0, G], [60, 0, G]], { color: BONE, alpha: 0.4 * campA, width: 1.1 });
      for (const s2 of S.strata) E.line(A, cc, s2, { color: BONE, alpha: 0.16 * campA, width: 0.9 });
      for (const c of S.cracks) E.line(A, cc, c, { color: BONE, alpha: 0.14 * campA, width: 0.8 });
      // 地面
      A.fillStyle = '#cbb894'; A.beginPath();
      for (let i = 0; i < S.campDots.length; i += 2) { const p = cc.proj([S.campDots[i], S.campDots[i + 1], G]); if (!p || p[1] > cam.H + 2 || p[0] < 0 || p[0] > cam.W) continue; const s2 = clamp(160 / p[2], 0.5, 2.4); A.rect(p[0], p[1], s2, s2 * 0.6); }
      A.globalAlpha = 0.24 * campA; A.fill(); A.globalAlpha = 1;
      const objs = [];
      for (const tr of S.trees) objs.push({ d: Math.hypot(tr[0] - cc.eye[0], tr[1] - cc.eye[1]), k: 0, o: tr });
      const P = Mu.pulse, tF = st.tFire || ((b) => (st.fire >= b ? -1e9 : 1e9)), tL = st.tField || ((b) => (fp >= b ? -1e9 : 1e9));
      for (const tn of S.tents) if (time >= tF(tn.born)) objs.push({ d: Math.hypot(tn.x - cc.eye[0], tn.y - cc.eye[1]), k: 1, o: tn });
      for (const pp of S.people) if (time >= tF(pp.born)) objs.push({ d: Math.hypot(pp.x - cc.eye[0], pp.y - cc.eye[1]), k: 2, o: pp });
      objs.sort((a, b) => b.d - a.d);
      for (const ob of objs) {
        const fog = Math.exp(-ob.d / 260) * campA, o = ob.o;
        if (ob.k === 0) {
          const b = cc.proj([o[0], o[1], G]), tp = cc.proj([o[0], o[1], G + o[2]]); if (!b || !tp) continue;
          const w = (cam.foc / Math.max(1, ob.d)) * o[2] * 0.22;
          A.beginPath(); A.moveTo(b[0], b[1]); A.lineTo(tp[0], tp[1]);
          for (let k = 1; k <= 3; k++) { const y = lerp(tp[1], b[1], k / 4); A.moveTo(tp[0] - w * k / 3, y); A.lineTo(tp[0], lerp(tp[1], b[1], (k - 1) / 4)); A.lineTo(tp[0] + w * k / 3, y); }
          A.strokeStyle = '#9fb0a0'; A.globalAlpha = 0.3 * fog; A.lineWidth = 0.9; A.stroke(); A.globalAlpha = 1;
        } else if (ob.k === 1) {
          const grow = clamp((time - tF(o.born)) / 0.25);
          prism(A, cc, o.x, o.y, G, o.h * grow, o.w, 0.12, { n: 7, fill: (s2) => mixHex('#0d0907', '#3a2414', s2 * 0.8), stroke: BONE, alpha: 0.75 * fog, ribs: 0.3 * fog });
        } else {
          const h = o.sit ? 0.56 : 1.32, w = o.sit ? 0.3 : 0.2, b0 = cc.proj([o.x, o.y, G]); if (!b0) continue;
          const px = cam.foc / Math.max(0.5, b0[2]); if (px > 520) continue;                    // 離鏡頭太近的不畫
          const X = b0[0], Y = b0[1], W2 = w * px, H2 = h * px, nk = 0.07 * px, hr = Math.max(0.7, 0.115 * px);
          A.beginPath(); A.moveTo(X - W2, Y); A.quadraticCurveTo(X - W2 * 0.95, Y - H2 * 0.8, X - nk, Y - H2); A.lineTo(X + nk, Y - H2); A.quadraticCurveTo(X + W2 * 0.95, Y - H2 * 0.8, X + W2, Y); A.closePath();
          A.moveTo(X + hr, Y - H2 - hr * 0.9); A.arc(X, Y - H2 - hr * 0.9, hr, 0, 6.2832);
          A.fillStyle = '#0a0706'; A.globalAlpha = fog; A.fill(); A.strokeStyle = '#ffb884'; A.globalAlpha = 0.5 * fog; A.lineWidth = clamp(px * 0.012, 0.6, 1.6); A.stroke(); A.globalAlpha = 1;
        }
      }
      A.globalCompositeOperation = 'lighter';
      for (const f of S.fires) {
        const t0 = tF(f[3]); if (time < t0) continue;
        const burst = P(time, t0, 0.2), fl = 0.85 + 0.25 * Math.sin(time * 13 + f[0]) * Math.sin(time * 7.3 + f[1]), sz = f[2] * fl * (1 + 0.4 * pulse) * (1 + 2.6 * burst);
        glowAt(A, cc, [f[0], f[1], G + 0.35], CS.glowFire, 1.7 * sz, campA); glowAt(A, cc, [f[0], f[1], G + 0.5], CS.glowFire, 11 * sz, 0.4 * campA);
      }
      for (const sp of S.sparks) { const life = (sp[0] + time * (0.5 + sp[1] * 0.6)) % 1; glowAt(A, cc, [-4.6 + (sp[2] - 0.5) * 0.5 + Math.sin(life * 7 + sp[3] * 6) * 0.3 * life, -5.6 + (sp[3] - 0.5) * 0.5, G + 0.4 + life * 2.6], CS.glowFire, 0.09 * (1 - life) + 0.03, (1 - life) * campA); }
      A.globalCompositeOperation = 'source-over';
    }
    // ── 村子與田（鏡頭退到幾十公尺以上才看得到）
    const landA = sstep(30, 90, d);
    if (landA > 0.01) {
      groundDots(A, cam, S.dots, 0.2 * landA, '#cbb894', 2600);
      // 河
      for (let i = 0; i < 26; i++) {
        const u = (i + 0.5) / 26, x = lerp(-470, -330, u), pts = [];
        for (let y = -900; y <= 5200; y += 28) pts.push([x + Math.sin(y * 0.012 + i * 1.7 + time * 0.8) * 3.2 + fbm(y * 0.004, i, 2, 3) * 9, y, 0]);
        const edge = Math.min(u, 1 - u) < 0.06;
        E.line(A, cam, pts, { color: edge ? '#bfe0ff' : '#3f93e0', alpha: (edge ? 0.7 : 0.16 + 0.4 * hash(i, 7)) * landA * (0.45 + 0.55 * sstep(0, 0.3, fp)), width: edge ? 1.5 : 1.1, dash: edge ? null : [60 + hash(i, 1) * 140, 30 + hash(i, 2) * 90], dashOffset: -time * 60 - i * 37 });
      }
      const tL2 = st.tField || ((b) => (fp >= b ? -1e9 : 1e9));
      for (const c of S.canals) { const k = clamp((time - tL2(c.born)) / 1.6); if (k > 0) E.line(A, cam, E.partial(c.pts, k), { color: '#5aa9ee', alpha: 0.8 * landA, width: 1.5 }); }
      for (const p of S.parcels) {
        const tb = tL2(p.born), k = clamp((time - tb) / 0.3); if (k <= 0) continue;
        const c = Math.cos(p.rot), s2 = Math.sin(p.rot), P = (x, y) => cam.proj([p.x + x * c - y * s2, p.y + x * s2 + y * c, 0.1]);
        const a = P(-p.w / 2, -p.d / 2), b = P(p.w / 2, -p.d / 2), c2 = P(p.w / 2, p.d / 2), d2 = P(-p.w / 2, p.d / 2); if (!a || !b || !c2 || !d2) continue;
        const flash = Mu.pulse(time, tb, 0.16);
        A.beginPath(); A.moveTo(a[0], a[1]); A.lineTo(b[0], b[1]); A.lineTo(c2[0], c2[1]); A.lineTo(d2[0], d2[1]); A.closePath();
        A.fillStyle = p.gold ? '#f6bd62' : '#8fbf70'; A.globalAlpha = (0.06 + 0.5 * flash) * landA; A.fill();
        A.strokeStyle = BONE; A.globalAlpha = 0.4 * landA; A.lineWidth = 0.9; A.stroke();
        A.beginPath(); for (let j = 1; j <= p.n; j++) { const u = j / (p.n + 1), q0 = P(lerp(-p.w / 2, p.w / 2, u), -p.d / 2), q1 = P(lerp(-p.w / 2, p.w / 2, u), lerp(-p.d / 2, p.d / 2, k)); if (q0 && q1) { A.moveTo(q0[0], q0[1]); A.lineTo(q1[0], q1[1]); } }
        A.strokeStyle = p.gold ? '#f6bd62' : '#9fd080'; A.globalAlpha = (0.42 + 0.5 * flash) * landA; A.lineWidth = 1; A.stroke(); A.globalAlpha = 1;
      }
      A.globalCompositeOperation = 'lighter';
      for (const f of S.farV) if (time >= tL2(f[3] * 0.9)) glowAt(A, cam, [f[0], f[1], 2], CS.glowGold, 26 + f[2] * 40, 0.7 * landA);
      A.globalCompositeOperation = 'source-over';
      // 村子：由遠到近
      const objs = S.houses.filter((h) => time >= tL2(h.born)).map((h) => ({ d: Math.hypot(h.x - cam.eye[0], h.y - cam.eye[1]), h }));
      const shrine = sstep(0.55, 0.75, fp);
      if (shrine > 0) objs.push({ d: Math.hypot(cam.eye[0], cam.eye[1]), shrine: true });
      objs.sort((a, b) => b.d - a.d);
      const lights = [];
      for (const ob of objs) {
        if (ob.shrine) {      // 村子中間的土臺與神廟：之後塔廟就蓋在這裡
          for (const f of E.boxFaces(0, 0, 0, 30, 24, 3 * shrine, 0, 0.06)) E.face(A, cam, f, { fill: '#17110c', stroke: BONE, alpha: 0.9 * landA, width: 1.3 });
          for (const f of E.boxFaces(0, 0, 3 * shrine, 14, 10, 6 * shrine, 0)) E.face(A, cam, f, { fill: '#100c09', stroke: BONE, alpha: 0.9 * landA, width: 1.3 });
          lights.push([[0, 0, 9 * shrine + 1.5], 9 * shrine, 1, 1]);
          continue;
        }
        const h = ob.h, grow = clamp((time - tL2(h.born)) / 0.2);
        E.boxFaces(h.x, h.y, 0, h.w, h.d, h.h * grow, h.rot).forEach((f, k) => E.face(A, cam, f, { fill: k === 0 ? '#17120e' : k % 2 ? '#0b0908' : '#100c0a', stroke: BONE, alpha: 0.6 * landA, width: 1 }));
        if (h.lit) lights.push([[h.x, h.y, h.h + 0.5], (5 + h.seed * 4) * (1 + 2 * Mu.pulse(time, tL2(h.born), 0.2)), 0.8, 0]);
      }
      A.globalCompositeOperation = 'lighter';
      for (const [p, m, a, fire] of lights) glowAt(A, cam, p, fire ? CS.glowFire : CS.glowGold, m * (1 + 0.5 * pulse), a * landA);
      A.globalCompositeOperation = 'source-over';
    }
    LY.composite(g, LY.A, { glow: [[22, 0.42], [5, 0.36]] });
    if (wallA > 0.01) Cave.drawLight(g, cc, { fire: wallA * (1 - sstep(1.5, 6, d) * 0.7), flick: Math.sin(time * 9) * 0.5, vig: 1 - sstep(0.9, 2.6, d), grain: 0.42 * (1 - sstep(1.2, 4, d)) });
    ctx.grade(g, { vig: 0.45 });
  }
  const hx = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function mixHex(a, b, k) { const A2 = hx(a), B = hx(b); return '#' + A2.map((v, i) => Math.round(v + (B[i] - v) * clamp(k)).toString(16).padStart(2, '0')).join(''); }

  root.Land = { init, draw, CAMP, G };
})(typeof self !== 'undefined' ? self : this);
