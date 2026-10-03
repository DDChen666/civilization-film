// 大尺度的幾層：路與海（幾千公里）、整顆地球。
// 海岸線、河流、城市位置是真的（Natural Earth，公有領域）。陸地用均勻撒在球面上的點來畫。
(function (root) {
  'use strict';
  const { R, add, sub, mul, dot, cross, norm, len, clamp, lerp, sstep, rng } = E;
  const ORIGIN = [44.42, 32.54];           // 世界的原點：巴比倫
  const GEO = E.makeGeo(ORIGIN[0], ORIGIN[1]);
  const Cc = [0, 0, -R];
  let D = null;

  function unpack(b64) {
    const bin = atob(b64), n = bin.length / 4, out = new Float64Array(n * 3), dv = new DataView(new ArrayBuffer(4));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) dv.setUint8(k, bin.charCodeAt(i * 4 + k));
      const p = GEO(dv.getInt16(0, true) / 100, dv.getInt16(2, true) / 100);
      out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2];
    }
    return out;
  }
  const ring = (r) => r.map((p) => GEO(p[0], p[1]));

  // 古代的城（經度、緯度、中文名、大小 1–3、要不要標名字）
  const OLD = {
    Babylon: [44.42, 32.54, '巴比倫', 3, 1], Uruk: [45.64, 31.32, '烏魯克', 2, 0], Memphis: [31.25, 29.85, '孟菲斯', 3, 1], Thebes: [32.64, 25.7, '底比斯', 2, 0],
    Alexandria: [29.92, 31.2, '亞歷山卓', 3, 1], Jerusalem: [35.22, 31.78, '耶路撒冷', 1, 0], Tyre: [35.2, 33.27, '推羅', 2, 0], Damascus: [36.29, 33.51, '大馬士革', 2, 0],
    Antioch: [36.16, 36.2, '安條克', 2, 1], Palmyra: [38.27, 34.55, '巴邁拉', 1, 0], Ctesiphon: [44.58, 33.09, '泰西封', 2, 0], Susa: [48.26, 32.19, '蘇薩', 2, 0],
    Persepolis: [52.89, 29.93, '波斯波利斯', 3, 1], Ecbatana: [48.52, 34.8, '埃克巴坦那', 1, 0], Nineveh: [43.15, 36.36, '尼尼微', 1, 0], Merv: [62.19, 37.66, '木鹿', 2, 0],
    Samarkand: [66.97, 39.65, '撒馬爾罕', 2, 1], Bactra: [66.9, 36.76, '巴克特拉', 1, 0], Kashgar: [75.99, 39.47, '喀什', 1, 0], Dunhuang: [94.66, 40.14, '敦煌', 1, 0],
    Changan: [108.94, 34.27, '長安', 3, 1], Luoyang: [112.45, 34.62, '洛陽', 2, 0], Taxila: [72.8, 33.75, '塔克西拉', 1, 0], Pataliputra: [85.14, 25.61, '華氏城', 3, 1],
    Mohenjo: [68.14, 27.33, '摩亨佐達羅', 1, 0], Muziris: [76.2, 10.2, '穆齊里斯', 2, 0], Barygaza: [72.99, 21.71, '婆盧羯車', 1, 0], Athens: [23.73, 37.98, '雅典', 3, 1],
    Byzantium: [28.98, 41.01, '拜占庭', 2, 0], Ephesus: [27.34, 37.94, '以弗所', 1, 0], Sardis: [28.04, 38.49, '薩第斯', 1, 0], Knossos: [25.16, 35.3, '克諾索斯', 1, 0],
    Rome: [12.5, 41.9, '羅馬', 3, 1], Carthage: [10.32, 36.85, '迦太基', 3, 1], Syracuse: [15.29, 37.08, '敘拉古', 1, 0], Massalia: [5.37, 43.3, '馬薩利亞', 1, 0],
    Gades: [-6.29, 36.53, '加的斯', 1, 0], Petra: [35.44, 30.33, '佩特拉', 1, 0], Meroe: [33.75, 16.94, '麥羅埃', 2, 0], Aksum: [38.72, 14.13, '阿克蘇姆', 2, 0],
    Marib: [45.33, 15.42, '馬里卜', 1, 0], Berenice: [35.47, 23.91, '貝勒尼基', 1, 0], Aden: [45.03, 12.78, '亞丁', 1, 0], Panyu: [113.26, 23.13, '番禺', 2, 0],
    Chengdu: [104.07, 30.66, '成都', 1, 0], Linzi: [118.3, 36.8, '臨淄', 1, 0],
  };
  const W_ = (lon, lat) => [lon, lat];
  const LAND_ROUTES = [
    ['Changan', 'Dunhuang', 'Kashgar', 'Samarkand', 'Merv', 'Ecbatana', 'Ctesiphon', 'Palmyra', 'Antioch'],
    ['Changan', 'Luoyang', 'Linzi'], ['Changan', 'Chengdu'],
    ['Kashgar', 'Bactra', 'Merv'], ['Bactra', 'Taxila', 'Pataliputra'], ['Taxila', 'Mohenjo', 'Barygaza'],
    ['Persepolis', 'Susa', 'Babylon', 'Nineveh', 'Sardis', 'Ephesus'], ['Babylon', 'Uruk'], ['Ctesiphon', 'Babylon'],
    ['Marib', 'Petra', 'Damascus', 'Antioch'], ['Petra', 'Jerusalem', 'Tyre'], ['Alexandria', 'Memphis', 'Thebes', 'Meroe', 'Aksum'],
    ['Byzantium', 'Sardis'], ['Persepolis', 'Ecbatana'],
  ];
  const SEA_ROUTES = [
    ['Alexandria', W_(24.5, 34.0), W_(18, 36.2), 'Syracuse', W_(15.7, 38.3), 'Rome'], ['Alexandria', W_(27, 33.5), 'Knossos', 'Athens', W_(25.5, 39.6), 'Byzantium'],
    ['Tyre', W_(30, 33.6), W_(24, 34.2), W_(15.5, 35.8), 'Carthage', W_(3, 37.3), W_(-2, 36.2), W_(-5.4, 35.95), 'Gades'], ['Rome', W_(11, 39.5), 'Carthage'], ['Rome', W_(9.6, 42.6), 'Massalia'],
    ['Berenice', W_(38.5, 19), W_(42.2, 14), W_(43.4, 12.5), 'Aden', W_(55, 13), 'Muziris'], ['Aden', W_(58, 17), 'Barygaza'],
    ['Muziris', W_(77.6, 7.6), W_(81, 5.6), W_(94, 6), W_(98.5, 4.5), W_(103.6, 1.1), W_(106.5, 5), W_(110.5, 12), W_(113.4, 21.5), 'Panyu'],
    ['Barygaza', W_(66, 24.3), W_(59.5, 24.8), W_(56.6, 26.4), W_(52, 27), W_(49.2, 29.6), 'Uruk'],
    ['Athens', W_(22.8, 36.2), W_(18.5, 37.5), 'Syracuse'],
  ];
  const routePts = (names, liftK) => {
    const pts = names.map((n) => (typeof n === 'string' ? OLD[n] : n));
    let out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const seg = E.arc(GEO, a, b, Math.max(6, Math.round(dist * 2.2)), dist * liftK, 2500);
      out = out.concat(i ? seg.slice(1) : seg);
    }
    return out;
  };

  function sprite(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [k, col] of stops) gr.addColorStop(k, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  function init(geo) {
    const r = rng(2026), stars = [];
    for (let i = 0; i < 1500; i++) {
      const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z), m = r();
      stars.push([s * Math.cos(a), s * Math.sin(a), z, m * m * m, r()]);
    }
    D = {
      dotsG: unpack(geo.dots_global), dotsR: unpack(geo.dots_region),
      coast110: geo.coast110.map(ring), coast50: geo.coast50.map(ring), lakes: geo.lakes50.map(ring),
      rivers: geo.rivers.map((v) => ({ name: v.name, rank: v.rank, pts: ring(v.pts) })),
      cities: geo.cities.map((c) => ({ p: GEO(c[0], c[1]), lon: c[0], lat: c[1], pop: c[2], name: c[3] })),
      stars,
      land: LAND_ROUTES.map((n) => routePts(n, 2500)), sea: SEA_ROUTES.map((n) => routePts(n, 1200)),
      old: Object.values(OLD).map((o) => ({ p: GEO(o[0], o[1]), name: o[2], size: o[3], label: o[4] })),
      glowGold: sprite(64, [[0, 'rgba(255,236,190,1)'], [0.16, 'rgba(255,196,104,0.85)'], [0.45, 'rgba(246,150,60,0.22)'], [1, 'rgba(240,120,40,0)']]),
      glowWhite: sprite(64, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(210,232,255,0.7)'], [0.5, 'rgba(120,180,255,0.16)'], [1, 'rgba(90,150,255,0)']]),
    };
    // 現代城市之間的連線（終段用）：每個大城連到最近的兩個，偶爾連一條跨洲的
    const big = D.cities.slice(0, 80), links = [], rr = rng(77), seen = new Set();
    const gd = (a, b) => { const d2 = Math.PI / 180, x = Math.sin(a.lat * d2) * Math.sin(b.lat * d2) + Math.cos(a.lat * d2) * Math.cos(b.lat * d2) * Math.cos((a.lon - b.lon) * d2); return Math.acos(clamp(x, -1, 1)) / d2; };
    for (let i = 0; i < big.length; i++) {
      const cand = [];
      for (let j = 0; j < big.length; j++) if (i !== j) { const d = gd(big[i], big[j]); if (d > 5) cand.push([d, j]); }
      cand.sort((a, b) => a[0] - b[0]);
      const pick = [cand[0], cand[1]];
      if (rr() < 0.55) { const far = cand.filter((c) => c[0] > 35 && c[0] < 120); pick.push(far[(rr() * far.length) | 0]); }
      for (const c of pick) { if (!c) continue; const key = Math.min(i, c[1]) + '_' + Math.max(i, c[1]); if (seen.has(key)) continue; seen.add(key); links.push([i, c[1], c[0]]); }
    }
    D.links = links.map(([i, j, d]) => ({ pts: E.arc(GEO, [big[i].lon, big[i].lat], [big[j].lon, big[j].lat], Math.max(16, Math.round(d * 1.2)), Math.min(8e5, d * 9000), 4000), d, seed: i * 97 + j }));
    // 衛星的軌道：繞著地心的幾個圓
    D.orbits = [[0.9, 0.2, 1.3e6], [-0.5, 1.0, 2.6e6], [1.2, 0.9, 4.4e6]].map(([tx, ty, h], k) => {
      const n = norm([Math.sin(tx) * Math.cos(ty), Math.sin(tx) * Math.sin(ty), Math.cos(tx)]), a = norm(cross(n, [0.3, 0.1, 1])), b = cross(n, a), pts = [];
      for (let i = 0; i <= 220; i++) { const t = (i / 220) * Math.PI * 2; pts.push(add(Cc, add(mul(a, Math.cos(t) * (R + h)), mul(b, Math.sin(t) * (R + h))))); }
      return { pts, h, k };
    });
  }

  // ── 鏡頭：從某個經緯度的上空，看向地表的某一點
  function camGeo({ at, alt, look, fov = 38, shift, roll = 0, northUp = false }) {
    const eye = GEO(at[0], at[1], alt), target = GEO(look[0], look[1], 0);
    const up = northUp ? norm(sub(GEO(look[0], look[1] + 1, 0), target)) : norm(sub(target, Cc));
    return E.makeCam({ eye, target, up, fov, shift, roll });
  }
  /** 地球的輪廓（從鏡頭看出去的邊緣），回傳螢幕上的一圈點 */
  function limb(cam, n = 240, Rr = R) {
    const EC = sub(cam.eye, Cc), d = len(EC), u = mul(EC, 1 / d);
    const c0 = add(Cc, mul(u, (Rr * Rr) / d)), rad = Rr * Math.sqrt(Math.max(0, 1 - (Rr * Rr) / (d * d)));
    const a = norm(cross(u, Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), b = cross(u, a), out = [];
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const p = cam.proj(add(c0, add(mul(a, Math.cos(t) * rad), mul(b, Math.sin(t) * rad)))); if (p) out.push(p); }
    return out;
  }
  function pathOf(g, pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); }

  function drawStars(g, cam, alpha = 1) {
    g.fillStyle = '#f4efe6';
    for (const s of D.stars) {
      const z = s[0] * cam.f[0] + s[1] * cam.f[1] + s[2] * cam.f[2]; if (z < 0.2) continue;
      const x = cam.cx + ((s[0] * cam.r[0] + s[1] * cam.r[1] + s[2] * cam.r[2]) / z) * cam.foc, y = cam.cy - ((s[0] * cam.u[0] + s[1] * cam.u[1] + s[2] * cam.u[2]) / z) * cam.foc;
      if (x < 0 || x > cam.W || y < 0 || y > cam.H) continue;
      const sz = 0.7 + s[3] * 2.0; g.globalAlpha = alpha * (0.16 + s[3] * 0.8); g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }
  /** 地球的底：海是很深的藍黑，邊緣一圈大氣的光。sun：太陽在螢幕上的方向（弧度），沒有就不畫受光的弧 */
  function drawBody(g, cam, { sea = ['#0b1a2a', '#070d16', '#04070c'], rim = '#7fb6ff', rimAlpha = 0.6, sun = null, haze = 0.5 } = {}) {
    const L = limb(cam); if (L.length < 8) return L;
    let cx = 0, cy = 0; for (const p of L) { cx += p[0]; cy += p[1]; } cx /= L.length; cy /= L.length;
    const rad = Math.hypot(L[0][0] - cx, L[0][1] - cy);
    pathOf(g, L);
    const gr = g.createRadialGradient(cx - rad * 0.15, cy - rad * 0.2, rad * 0.05, cx, cy, rad * 1.02);
    gr.addColorStop(0, sea[0]); gr.addColorStop(0.7, sea[1]); gr.addColorStop(1, sea[2]);
    g.fillStyle = gr; g.fill();
    return Object.assign(L, { cx, cy, rad });
  }
  function drawRim(g, cam, L, { rim = '#8fc0ff', alpha = 0.6, width = 1.6, sun = null } = {}) {
    if (L.length < 8) return;
    g.lineCap = 'round';
    if (sun == null) { pathOf(g, L); g.strokeStyle = rim; g.globalAlpha = alpha; g.lineWidth = width; g.stroke(); g.globalAlpha = 1; return; }
    for (let i = 0; i < L.length; i++) {      // 受光的那一側亮、背光的那一側幾乎看不見
      const a = L[i], b = L[(i + 1) % L.length], ang = Math.atan2(a[1] - L.cy, a[0] - L.cx);
      const k = Math.pow(clamp(0.5 + 0.5 * Math.cos(ang - sun)), 2.6);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.strokeStyle = rim; g.globalAlpha = alpha * (0.07 + 0.93 * k); g.lineWidth = width * (0.6 + 1.6 * k); g.stroke();
    }
    g.globalAlpha = 1;
  }
  /** 陸地的點。sun：太陽的方向（世界座標的單位向量），有給就有明暗；step：每幾個點畫一個。 */
  function drawDots(g, cam, arr, { color = '#efe4cf', alpha = 0.5, size = 1.4, step = 1, sun = null, dark = 0.3 } = {}) {
    const ex = cam.eye[0], ey = cam.eye[1], ez = cam.eye[2] + R, R2 = R * R, NB = 5, buckets = Array.from({ length: NB }, () => []);
    for (let i = 0; i < arr.length; i += 3 * step) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2] + R;
      const dd = x * ex + y * ey + z * ez; if (dd < R2 * 1.0005) continue;
      const p = cam.proj([x, y, arr[i + 2]]); if (!p || p[0] < -4 || p[0] > cam.W + 4 || p[1] < -4 || p[1] > cam.H + 4) continue;
      const vx = ex - x, vy = ey - y, vz = ez - z, mu = (vx * x + vy * y + vz * z) / (Math.hypot(vx, vy, vz) * R);     // 這個點的地面有多正對鏡頭
      let f = 0.35 + 0.65 * clamp(mu * 1.6);
      if (sun) f *= dark + (1 - dark) * sstep(-0.15, 0.55, (x * sun[0] + y * sun[1] + z * sun[2]) / R);
      buckets[Math.min(NB - 1, (f * NB) | 0)].push(p[0], p[1]);
    }
    g.fillStyle = color;
    buckets.forEach((a, b) => {
      const k = (b + 0.7) / NB, s = size * (0.7 + 0.3 * k);
      g.globalAlpha = alpha * k; g.beginPath();
      for (let i = 0; i < a.length; i += 2) g.rect(a[i] - s / 2, a[i + 1] - s / 2, s, s);
      g.fill();
    });
    g.globalAlpha = 1;
  }
  function drawLines(g, cam, list, o) { for (const pts of list) E.line(g, cam, pts, { occlude: true, ...o }); }
  function glow(g, cam, p, spr, sizePx, alpha = 1) {
    if (cam.hidden(p)) return null;
    const s = cam.proj(p); if (!s) return null;
    g.globalAlpha = alpha; g.drawImage(spr, s[0] - sizePx / 2, s[1] - sizePx / 2, sizePx, sizePx); g.globalAlpha = 1;
    return s;
  }
  /** 沿著一條線跑的光點：k 是位置（0..1） */
  function bead(pts, k) { const f = clamp(k) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return E.mix(pts[i], pts[i + 1], f - i); }

  // ════════ 關鍵格：路與海
  function frameRegion(g, LY, t, ctx) {
    const { C, readout, niceScale, grade } = ctx;
    const k = M.ease.cubicInOut(clamp(t));
    const cam = camGeo({ at: [52 + k * 1.5, 19 - k * 1.2], alt: 5.2e6 * (1 + k * 0.12), look: [39, 33], fov: 38, shift: [-60, 130] });
    drawStars(g, cam, 0.9);
    const L = drawBody(g, cam, { sea: ['#0a1826', '#060d17', '#03060b'] });
    const A = LY.A.g; LY.clear(LY.A);
    drawDots(A, cam, D.dotsR, { color: '#cdbb98', alpha: 0.4, size: 1.5 });
    drawLines(A, cam, D.coast50, { color: C.bone, alpha: 0.5, width: 1.1 });
    for (const rv of D.rivers) if (rv.rank <= 6) E.line(A, cam, rv.pts, { occlude: true, color: C.lapis, alpha: rv.rank <= 3 ? 0.95 : 0.6, width: rv.rank <= 3 ? 1.7 : 1.0 });
    drawLines(A, cam, D.sea, { color: '#8cc8ff', alpha: 0.95, width: 1.7, dash: [3, 8] });
    drawLines(A, cam, D.land, { color: C.gold, alpha: 0.9, width: 1.6 });
    A.globalCompositeOperation = 'lighter';
    D.sea.forEach((pts, i) => { for (let j = 0; j < 3; j++) glow(A, cam, bead(pts, (t * 0.25 + j / 3 + i * 0.37) % 1), D.glowWhite, 20, 0.95); });
    D.land.forEach((pts, i) => { for (let j = 0; j < 2; j++) glow(A, cam, bead(pts, (t * 0.2 + j / 2 + i * 0.29) % 1), D.glowGold, 18, 0.9); });
    const labels = [];
    for (const o of D.old) { const s = glow(A, cam, o.p, D.glowGold, 20 + o.size * 15, 1); if (s && o.label && Math.hypot(s[0] - L.cx, s[1] - L.cy) < L.rad * 0.95) labels.push([s, o]); }
    A.globalCompositeOperation = 'source-over';
    drawRim(A, cam, L, { rim: '#9cc6ff', alpha: 0.75, width: 1.6, sun: -2.1 });
    LY.composite(g, LY.A, { glow: [[20, 0.5], [5, 0.45]] });
    g.font = `400 22px "Songti TC", serif`; g.fillStyle = C.bone; g.letterSpacing = '3px';
    const placed = [];
    for (const [s, o] of labels.sort((a, b) => b[1].size - a[1].size)) {
      const w = o.name.length * 25, bx = s[0] + 16, by = s[1] - 12;
      if (bx + w > 1900 || by < 30 || placed.some((q) => Math.abs(q[0] - bx) < (q[2] + w) / 2 + 30 && Math.abs(q[1] - by) < 44)) continue;
      placed.push([bx, by, w]); g.globalAlpha = 0.86; g.fillText(o.name, bx, by);
    }
    g.globalAlpha = 1; g.letterSpacing = '0px';
    grade(g, { vig: 0.45 });
    const sc = niceScale(cam.foc / cam.dist, 190);
    readout(g, { glyph: '路', era: '西元前 200 年', ...sc });
  }

  // ════════ 關鍵格：安靜的十二秒（整顆地球）
  function frameQuiet(g, LY, t, ctx) {
    const { C, readout, niceScale, grade } = ctx;
    const cam = camGeo({ at: [38, 6], alt: 2.94e7, look: [38, 6], fov: 22.5, northUp: true, shift: [190, -6] });
    const sun = norm(add(add(mul(cam.r, -0.75), mul(cam.u, 0.6)), mul(cam.f, -0.45)));
    drawStars(g, cam, 0.55);
    const L = drawBody(g, cam, { sea: ['#0a1a2c', '#060e19', '#03060b'] });
    const A = LY.A.g; LY.clear(LY.A);
    drawDots(A, cam, D.dotsG, { color: '#eadcbd', alpha: 0.78, size: 1.5, sun, dark: 0.22 });
    drawLines(A, cam, D.coast110, { color: C.bone, alpha: 0.3, width: 1.0 });
    drawRim(A, cam, L, { rim: '#a9ceff', alpha: 1, width: 1.9, sun: -2.45 });
    LY.composite(g, LY.A, { glow: [[30, 0.6], [6, 0.35]] });
    grade(g, { vig: 0.4 });
    readout(g, { glyph: '家', era: '1972 年 12 月 7 日', len: (5e6 * cam.foc) / (cam.dist + 0), label: '5,000 公里' });
  }

  // ════════ 關鍵格：終段（地球亮起來）
  function frameFinale(g, LY, t, ctx) {
    const { C, readout, niceScale, grade } = ctx;
    const cam = camGeo({ at: [74 + t * 5, 20], alt: 1.3e7, look: [70 + t * 5, 30], fov: 36, northUp: true, shift: [150, 110] });
    drawStars(g, cam, 0.9);
    const L = drawBody(g, cam, { sea: ['#0b1c30', '#06101c', '#03060b'] });
    const A = LY.A.g; LY.clear(LY.A);
    for (const o of D.orbits) E.line(A, cam, o.pts, { occlude: true, color: '#cfe6ff', alpha: 0.2, width: 0.8 });
    drawDots(A, cam, D.dotsG, { color: '#b9ab8e', alpha: 0.42, size: 1.5 });
    drawLines(A, cam, D.coast110, { color: C.bone, alpha: 0.26, width: 0.9 });
    const cols = ['#8fd0ff', '#8fd0ff', '#8fd0ff', '#f6bd62', '#ffffff'];
    D.links.forEach((l) => E.line(A, cam, l.pts, { occlude: true, color: cols[l.seed % cols.length], alpha: 0.34, width: 0.9 }));
    A.globalCompositeOperation = 'lighter';
    D.links.forEach((l) => { const k = (t * 0.6 + E.hash(l.seed, 1)) % 1; glow(A, cam, bead(l.pts, k), D.glowWhite, 13, 0.9); });
    for (const c of D.cities) { const s = 6 + Math.pow(c.pop / 3.5e7, 0.45) * 40; glow(A, cam, c.p, D.glowGold, s, 0.92); }
    D.orbits.forEach((o) => { for (let j = 0; j < 5; j++) glow(A, cam, bead(o.pts, (t * 0.05 + j / 5 + o.k * 0.13) % 1), D.glowWhite, 12, 1); });
    A.globalCompositeOperation = 'source-over';
    drawRim(A, cam, L, { rim: '#9cc6ff', alpha: 0.95, width: 1.9, sun: -2.2 });
    LY.composite(g, LY.A, { glow: [[26, 0.6], [6, 0.5]] });
    grade(g, { vig: 0.42 });
    readout(g, { glyph: '網', era: '現在', len: (2e6 * cam.foc) / cam.dist, label: '2,000 公里' });
  }

  // ════════ 通用的「畫地球」：正片用。o 裡每一項是那一層有多亮（0 就不畫）；o.draw(A, L) 讓外面在發光圖層上加東西
  function earth(g, LY, cam, o = {}) {
    if ((o.stars ?? 0.8) > 0.01) drawStars(g, cam, o.stars ?? 0.8);
    const L = o.noBody ? [] : drawBody(g, cam, { sea: o.sea || ['#0b1c30', '#06101c', '#03060b'] });
    const A = LY.A.g; LY.clear(LY.A);
    const dc = o.dotColor || '#b9ab8e';
    if ((o.dotsR ?? 0) > 0.01) drawDots(A, cam, D.dotsR, { color: dc, alpha: o.dotsR, size: o.dotSize ?? 1.5, sun: o.sun, dark: o.dark ?? 0.25 });
    if ((o.dotsG ?? 0) > 0.01) drawDots(A, cam, D.dotsG, { color: dc, alpha: o.dotsG, size: o.dotSize ?? 1.5, sun: o.sun, dark: o.dark ?? 0.25 });
    if ((o.coast50 ?? 0) > 0.01) drawLines(A, cam, D.coast50, { color: '#efe4cf', alpha: o.coast50, width: 1.1 });
    if ((o.coast110 ?? 0) > 0.01) drawLines(A, cam, D.coast110, { color: '#efe4cf', alpha: o.coast110, width: 1.0 });
    if ((o.rivers ?? 0) > 0.01) for (const rv of D.rivers) if (rv.rank <= 5) E.line(A, cam, rv.pts, { occlude: true, color: '#3f93e0', alpha: o.rivers * (rv.rank <= 3 ? 1 : 0.6), width: rv.rank <= 3 ? 1.6 : 1.0 });
    if ((o.oldRoutes ?? 0) > 0.01) {
      drawLines(A, cam, D.sea, { color: '#8cc8ff', alpha: 0.9 * o.oldRoutes, width: 1.6, dash: [3, 8] });
      drawLines(A, cam, D.land, { color: '#f6bd62', alpha: 0.9 * o.oldRoutes, width: 1.5 });
      A.globalCompositeOperation = 'lighter';
      const tt = o.time ?? 0;
      D.land.forEach((pts, i) => { for (let j = 0; j < 2; j++) glow(A, cam, bead(pts, (tt * 0.2 + j / 2 + i * 0.29) % 1), D.glowGold, 16, 0.9 * o.oldRoutes); });
      for (const c of D.old) glow(A, cam, c.p, D.glowGold, (14 + c.size * 9) * (o.oldSize ?? 1), o.oldRoutes);
      A.globalCompositeOperation = 'source-over';
    }
    if (o.draw) o.draw(A, L);
    drawRim(A, cam, L, { rim: o.rimColor || '#9cc6ff', alpha: o.rim ?? 0.9, width: 1.8, sun: o.rimSun ?? -2.3 });
    LY.composite(g, LY.A, { glow: o.glow || [[26, 0.6], [6, 0.5]] });
    return L;
  }

  root.Globe = { init, earth, frameRegion, frameQuiet, frameFinale, GEO, camGeo, get D() { return D; }, drawStars, drawBody, drawRim, drawDots, drawLines, glow, bead, limb, OLD };
})(typeof self !== 'undefined' ? self : this);
