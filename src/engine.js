// engine.js：這支片的畫面引擎。
//
// 世界是真的三維：原點在地表上的一個點（兩河流域），x 向東、y 向北、z 向上，單位是公尺。
// 遠處的地理（海岸線、河流、城市）放在真實半徑的球面上，所以鏡頭一路往後退，地面會自己彎成地球，不用特效。
// 畫法只有三種東西：線、實心的面（用來擋住後面的線）、光點。全部先畫到一張透明的圖層上，再疊模糊過的自己當成光暈。
// 規矩同其他片：draw(t) 是純函式，不留跨格的狀態。
(function (root) {
  'use strict';
  const R = 6371000;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

  // ── 決定論的亂數
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const hash = (x, y = 0, z = 0) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 4, seed = 0) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); a *= 0.5; f *= 2.03; }
    return s;
  }

  // ── 地理座標 → 世界座標
  function makeGeo(lon0, lat0) {
    const d = Math.PI / 180;
    const sl = Math.sin(lat0 * d), cl = Math.cos(lat0 * d), so = Math.sin(lon0 * d), co = Math.cos(lon0 * d);
    const E = [-so, co, 0], N = [-sl * co, -sl * so, cl], U = [cl * co, cl * so, sl];
    const f = (lon, lat, h = 0) => {
      const la = lat * d, lo = lon * d, c = Math.cos(la);
      const p = [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)], r = R + h;
      return [r * dot(p, E), r * dot(p, N), r * dot(p, U) - R];
    };
    f.center = [0, 0, -R];
    return f;
  }
  /** 球面上兩點之間的大圓弧，中間拱起 lift 公尺。回傳世界座標的折線。 */
  function arc(geo, a, b, n = 48, lift = 0, h0 = 0) {
    const d = Math.PI / 180;
    const u = (p) => { const c = Math.cos(p[1] * d); return [c * Math.cos(p[0] * d), c * Math.sin(p[0] * d), Math.sin(p[1] * d)]; };
    const A = u(a), B = u(b), w = Math.acos(clamp(dot(A, B), -1, 1)), out = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, s = Math.sin(w) || 1e-9;
      const p = add(mul(A, Math.sin((1 - k) * w) / s), mul(B, Math.sin(k * w) / s));
      const lat = Math.asin(clamp(p[2], -1, 1)) / d, lon = Math.atan2(p[1], p[0]) / d;
      out.push(geo(lon, lat, h0 + lift * Math.sin(Math.PI * k)));
    }
    return out;
  }

  // ── 鏡頭
  function makeCam({ eye, target, up = [0, 0, 1], fov = 38, W = 1920, H = 1080, roll = 0, shift = [0, 0] }) {
    const f = norm(sub(target, eye));
    let r = norm(cross(f, up)), u = cross(r, f);
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const r2 = add(mul(r, c), mul(u, s)); u = add(mul(u, c), mul(r, -s)); r = r2; }
    const foc = (H / 2) / Math.tan((fov * Math.PI) / 360);
    const dist = len(sub(target, eye)), near = dist * 2e-4;
    const cx = W / 2 + shift[0], cy = H / 2 + shift[1];
    const toCam = (p) => { const x = p[0] - eye[0], y = p[1] - eye[1], z = p[2] - eye[2]; return [x * r[0] + y * r[1] + z * r[2], x * u[0] + y * u[1] + z * u[2], x * f[0] + y * f[1] + z * f[2]]; };
    const fromCam = (c) => (c[2] > near ? [cx + (c[0] * foc) / c[2], cy - (c[1] * foc) / c[2], c[2]] : null);
    const proj = (p) => fromCam(toCam(p));
    /** 地球有沒有擋住這個點（h：這個點離地多高，用來避免地表的點被自己擋住） */
    const C = [0, 0, -R], EC = sub(eye, C), ec2 = dot(EC, EC);
    const hidden = (p, Rocc = R * 0.9992) => {
      const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
      const a = dx * dx + dy * dy + dz * dz, b = 2 * (dx * EC[0] + dy * EC[1] + dz * EC[2]), c = ec2 - Rocc * Rocc;
      const disc = b * b - 4 * a * c;
      if (disc <= 0) return false;
      const s = (-b - Math.sqrt(disc)) / (2 * a);
      return s > 0 && s < 1;
    };
    return { eye, f, r, u, foc, near, dist, W, H, cx, cy, toCam, fromCam, proj, hidden, alt: len(EC) - R };
  }

  // ── 畫線：投影、近平面裁切、（可選）被地球擋住的部分斷開
  function trace(g, cam, pts, { closed = false, occlude = false } = {}) {
    let prev = null, prevVis = false, pen = false, n = 0;
    const N = pts.length + (closed ? 1 : 0);
    for (let i = 0; i < N; i++) {
      const p = pts[i % pts.length];
      const c = cam.toCam(p);
      const vis = !(occlude && cam.hidden(p));
      if (prev && (prevVis || vis)) {
        let a = prev, b = c;
        if (prevVis && vis && (a[2] > cam.near || b[2] > cam.near)) {
          if (a[2] <= cam.near) { const k = (cam.near - a[2]) / (b[2] - a[2]); a = mix(a, b, k + 1e-6); pen = false; }
          if (b[2] <= cam.near) { const k = (cam.near - a[2]) / (b[2] - a[2]); b = mix(a, b, k - 1e-6); }
          const A = cam.fromCam(a), B = cam.fromCam(b);
          if (A && B) {
            if (!pen) g.moveTo(A[0], A[1]);
            g.lineTo(B[0], B[1]); pen = c[2] > cam.near; n++;
          } else pen = false;
        } else pen = false;
      }
      prev = c; prevVis = vis;
    }
    return n;
  }
  function line(g, cam, pts, o = {}) {
    g.beginPath();
    if (!trace(g, cam, pts, o)) return;
    g.strokeStyle = o.color || '#fff'; g.globalAlpha = o.alpha ?? 1; g.lineWidth = o.width || 1;
    g.lineCap = o.cap || 'round'; g.lineJoin = 'round';
    if (o.dash) g.setLineDash(o.dash); if (o.dashOffset) g.lineDashOffset = o.dashOffset;
    g.stroke();
    if (o.dash) g.setLineDash([]);
    g.globalAlpha = 1;
  }
  /** 折線只畫前面 k（0..1）這一段：東西「被畫出來」的動作用它。 */
  function partial(pts, k) {
    if (k >= 1) return pts; if (k <= 0) return pts.slice(0, 1);
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1])));
    const want = L[L.length - 1] * k, out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (L[i] <= want) out.push(pts[i]);
      else { out.push(mix(pts[i - 1], pts[i], (want - L[i - 1]) / (L[i] - L[i - 1] || 1))); break; }
    }
    return out;
  }

  // ── 實心的面：凸多邊形，朝向鏡頭才畫；填底色用來擋住後面的線
  function face(g, cam, pts, { fill = '#0a0806', stroke = '#fff', alpha = 1, width = 1, fillAlpha = 1, cull = true } = {}) {
    if (cull) {       // 頂點從外面看是逆時針：法線朝外。背對鏡頭的面不畫
      const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[1]));
      if (dot(n, sub(cam.eye, pts[0])) <= 0) return false;
    }
    const P = [];
    for (const p of pts) { const s = cam.proj(p); if (!s) return false; P.push(s); }
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]);
    g.closePath();
    if (fill) { g.globalAlpha = fillAlpha; g.fillStyle = fill; g.fill(); }
    if (stroke) { g.globalAlpha = alpha; g.strokeStyle = stroke; g.lineWidth = width; g.lineJoin = 'round'; g.stroke(); }
    g.globalAlpha = 1;
    return true;
  }
  /** 長方體（中心 cx,cy、底 z0、寬 w（x 向）、深 d（y 向）、高 h、繞 z 軸轉 rot）。回傳六個面（頂點逆時針朝外）。 */
  function boxFaces(cx, cy, z0, w, d, h, rot = 0, taper = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (x, y, z, k = 1) => [cx + (x * c - y * s) * k, cy + (x * s + y * c) * k, z];
    const a = w / 2, b = d / 2, k = 1 - taper, z1 = z0 + h;
    const B0 = P(-a, -b, z0), B1 = P(a, -b, z0), B2 = P(a, b, z0), B3 = P(-a, b, z0);
    const T0 = [cx + (-a * c + b * s) * k, cy + (-a * s - b * c) * k, z1], T1 = [cx + (a * c + b * s) * k, cy + (a * s - b * c) * k, z1];
    const T2 = [cx + (a * c - b * s) * k, cy + (a * s + b * c) * k, z1], T3 = [cx + (-a * c - b * s) * k, cy + (-a * s + b * c) * k, z1];
    return [[T0, T1, T2, T3], [B0, B1, T1, T0], [B1, B2, T2, T1], [B2, B3, T3, T2], [B3, B0, T0, T3]];
  }

  // ── 圖層與光暈
  function makeLayers(W, H, scale = 1) {
    const mk = () => { const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; const g = c.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0); return { c, g }; };
    const A = mk(), B = mk();
    const clear = (L) => { L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.clearRect(0, 0, L.c.width, L.c.height); L.g.setTransform(scale, 0, 0, scale, 0, 0); L.g.globalAlpha = 1; L.g.globalCompositeOperation = 'source-over'; };
    /** 把圖層疊到主畫布：先疊幾層模糊的自己（光暈），再疊清楚的。 */
    function composite(dst, L, { glow = [[18, 0.55], [5, 0.5]], sharp = 1 } = {}) {
      dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0);
      dst.globalCompositeOperation = 'lighter';
      for (const [r, a] of glow) { dst.filter = `blur(${r * scale}px)`; dst.globalAlpha = a; dst.drawImage(L.c, 0, 0); }
      dst.filter = 'none'; dst.globalCompositeOperation = 'source-over'; dst.globalAlpha = sharp; dst.drawImage(L.c, 0, 0);
      dst.restore();
    }
    return { A, B, clear, composite };
  }

  root.E = { R, add, sub, mul, dot, cross, len, norm, mix, clamp, lerp, sstep, rng, hash, vnoise, fbm, makeGeo, arc, makeCam, trace, line, partial, face, boxFaces, makeLayers };
})(typeof self !== 'undefined' ? self : this);
