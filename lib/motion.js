// motion.js — 動效函式庫。每個函式都是「時間 t 的純函式」，回傳數字，由你寫進 canvas 或 DOM。
// 用法：<script src="lib/motion.js"></script> → window.M；Node：require('./lib/motion.js')
// 原則：不要自己另外手寫 ease／spring。全片共用這一份，動態才會有一致的「質量感」。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.M = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  /** t 在 [t0, t1] 之間的進度 0..1（夾住）。 */
  const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

  // ── 曲線。t80＝走完 80% 路程所需的時間比例：越小越「脆」。選曲線看 t80，不要全片同一條。
  const ease = {
    linear: (k) => k,
    sineInOut: (k) => 0.5 - 0.5 * Math.cos(Math.PI * k),             // t80 .70 跟隨、漂移
    cubicOut: (k) => 1 - Math.pow(1 - k, 3),                          // t80 .42 一般進場
    cubicInOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2), // t80 .68
    quintInOut: (k) => (k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2),   // t80 .64 大運鏡
    expoOut: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),          // t80 .23 「啪」一下到位
    expoInOut: (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2), // 甩鏡
    backOut: (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2), // 帶一點過衝
    inCubic: (k) => k * k * k,                                        // 離場、落下
  };
  /** 在 [t0, t0+dur] 之間套曲線的進度。 */
  const prog = (t, t0, dur, fn = ease.cubicOut) => fn(clamp((t - t0) / dur));

  // ── 彈簧（閉式解）：0 → 1。任何一格都能直接算，不需要從第 0 格模擬過來。
  // k＝剛性、d＝阻尼。常用：UI 脆 (320, 30)；預設 (170, 26)；重物、大字 (120, 24)；俏皮、看得到回彈 (200, 14)。
  function spring(t, k = 170, d = 26) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k), z = d / (2 * w0);
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t); // 臨界阻尼
  }
  /** 蘋果 SwiftUI 式：duration（秒）＋ bounce（0＝平順、.15＝俐落、.3＝彈）。 */
  function swiftSpring(t, duration = 0.5, bounce = 0) {
    const w = TAU / duration, z = 1 - bounce;
    return spring(t, w * w, 2 * z * w);
  }
  /**
   * 一個值多次換目標（游標、容器寬度）：每次改變各加一條彈簧，動作連續，而且仍然只由時間決定。
   * keys: [[時間, 值], …]（依時間排序）。
   */
  function track(t, keys, k = 170, d = 26) {
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], k, d);
    return v;
  }
  /** 會被拉長的指示條：前緣彈簧硬、後緣軟，移動時自然伸長。stops: [[時間, x], …] */
  function stretch(t, stops, width) {
    const lead = track(t, stops, 320, 30), trail = track(t, stops, 140, 22);
    return { left: Math.min(lead, trail), right: Math.max(lead, trail) + width };
  }
  /** 變形容器裡的文字：變形開始後才進、下一次變形前先走，新舊字才不會疊在一起。 */
  const swapAlpha = (t, tIn, tOut) => Math.min(clamp((t - tIn - 0.08) / 0.12), clamp((tOut - 0.1 - t) / 0.1));
  /** 衰減脈衝：重拍、撞擊。t0 時為 1，之後每 halfLife 秒減半。 */
  const pulse = (t, t0, halfLife = 0.1) => (t < t0 ? 0 : Math.pow(0.5, (t - t0) / halfLife));

  // ── 決定論的亂數與雜訊（輸出時每一格必須可重現：不能用 Math.random()）
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(...xs) {
    let h = 2166136261 >>> 0;
    for (const x of xs) { h ^= Math.floor(x * 1000003) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; }
    return (h >>> 0) / 4294967296;
  }
  /** 平滑的一維雜訊，-1..1。用在手持感、呼吸、漂浮。 */
  function noise(x, seed = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * f * (f * (f * 6 - 15) + 10);
    return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
  }

  // ── 進場
  /** 字「落地」：彈簧上升＋微縮放，透明度領先彈簧，所以不會讀成淡入。回傳 {op, y, s}。 */
  function wordRise(t, t0, { dist = 46, s0 = 0.94, k = 220, d = 22 } = {}) {
    const p = spring(t - t0, k, d);
    return { op: clamp((t - t0) / 0.09), y: (1 - p) * dist, s: lerp(s0, 1, p) };
  }
  /** 打字：穩定速率，回傳目前顯示的字串與游標是否亮。cps＝每秒字數（英文約 38，中文約 14）。 */
  function typeOn(t, t0, text, cps = 14) {
    const chars = Array.from(text), n = clamp(Math.floor((t - t0) * cps), 0, chars.length);
    const done = n >= chars.length;
    return { n, str: chars.slice(0, n).join(''), done, caret: !done || Math.floor((t - t0) * 2) % 2 === 0 };
  }
  /** 依序出場的延遲：第 i 個比前一個晚 gap 秒。 */
  const stagger = (i, gap = 0.06) => i * gap;

  // ── 承接（讓下一幕「長」自這一幕，而不是取代它）
  /** 容器變形：一個矩形變成另一個（按鈕 → 視窗、卡片 → 頁面）。A/B: {x, y, w, h, r} */
  function morphRect(t, t0, t1, A, B, fn = ease.cubicInOut) {
    const k = fn(seg(t, t0, t1));
    return { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), w: lerp(A.w, B.w, k), h: lerp(A.h, B.h, k), r: lerp(A.r || 0, B.r || 0, k), k };
  }
  /** 兩個矩形依 k 混合（k 可以超過 1：直接餵彈簧值就會有回彈）。 */
  const mixRect = (A, B, k) => ({ x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), w: lerp(A.w, B.w, k), h: lerp(A.h, B.h, k), r: lerp(A.r || 0, B.r || 0, k) });
  /** 圓形開場：從 (cx, cy) 打開到蓋滿畫面。 */
  function iris(t, t0, t1, cx, cy, W = 1920, H = 1080, fn = ease.cubicInOut) {
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
    return { r: far * fn(seg(t, t0, t1)) };
  }
  /** 弧線跳躍：從 from 到 to，中間拱起 height。落地請配 impact。 */
  function hop(t, t0, t1, from, to, height = 120) {
    const k = seg(t, t0, t1);
    return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) - height * 4 * k * (1 - k) };
  }
  /** 落地擠壓：撞擊瞬間壓扁，之後彈回。回傳 {sx, sy}。 */
  function impact(t, tHit, { amount = 0.22, k = 300, d = 14 } = {}) {
    if (t < tHit) return { sx: 1, sy: 1 };
    const r = 1 - spring(t - tHit, k, d); // 1 → 0，帶回彈
    return { sx: 1 + amount * r, sy: 1 - amount * r };
  }

  // ── 鏡頭
  /** 關鍵幀鏡頭：keys [{t, x, y, zoom, rot, curve}]。zoom 在對數空間內插，推拉才會均勻。 */
  function camera(t, keys) {
    if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, zoom: keys[0].zoom || 1, rot: keys[0].rot || 0 };
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i];
      if (t <= b.t) {
        const a = keys[i - 1], k = (b.curve || ease.cubicInOut)((t - a.t) / (b.t - a.t));
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), zoom: Math.exp(lerp(Math.log(a.zoom || 1), Math.log(b.zoom || 1), k)), rot: lerp(a.rot || 0, b.rot || 0, k) };
      }
    }
    const z = keys[keys.length - 1];
    return { x: z.x, y: z.y, zoom: z.zoom || 1, rot: z.rot || 0 };
  }
  /**
   * 鏡頭矩陣 [a, b, c, d, e, f]：把世界座標（鏡頭看向 cam.x, cam.y）畫到 W×H 畫面。
   * depth：0＝焦平面，正值＝較遠（移動較慢，做出視差）。canvas: g.setTransform(...M.view(cam))
   */
  function view(cam, { W = 1920, H = 1080, depth = 0 } = {}) {
    const z = cam.zoom / (1 + depth), c = Math.cos(cam.rot || 0) * z, s = Math.sin(cam.rot || 0) * z;
    return [c, s, -s, c, W / 2 - (c * cam.x - s * cam.y), H / 2 - (s * cam.x + c * cam.y)];
  }
  const project = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  /** 手持感：兩個慢正弦疊加。env 在靜止段要是 0（靜止段必須完全不動）。 */
  function handheld(t, amp = 4, env = 1) {
    return { x: amp * env * (Math.sin(1.7 * t) + 0.6 * Math.sin(2.9 * t + 1)), y: amp * env * (Math.sin(1.3 * t + 2) + 0.5 * Math.sin(3.3 * t)) };
  }
  /** 撞擊震動：決定論、撞擊前為 0、指數衰減。 */
  function shake(t, tHit, { amp = 8, decay = 9, freq = 28, seed = 1 } = {}) {
    if (t < tHit) return { x: 0, y: 0, rot: 0 };
    const dt = t - tHit, e = amp * Math.exp(-decay * dt);
    return { x: e * noise(dt * freq, seed), y: e * noise(dt * freq, seed + 7), rot: (e / amp) * 0.004 * noise(dt * freq, seed + 13) };
  }

  // ── 節拍
  /** 節拍網格：bpm 與第一拍的時間（秒）。at(i)＝第 i 拍的時間；bar(n)＝第 n 小節起點；phase(t)＝拍內相位 0..1。 */
  function beats(bpm, offset = 0, perBar = 4) {
    const b = 60 / bpm;
    return { beat: b, bar: b * perBar, at: (i) => offset + i * b, barAt: (n) => offset + n * b * perBar, index: (t) => (t - offset) / b, phase: (t) => (((t - offset) / b) % 1 + 1) % 1 };
  }

  return { TAU, clamp, lerp, seg, sstep, ease, prog, spring, swiftSpring, track, stretch, swapAlpha, pulse, rng, hash, noise, wordRise, typeOn, stagger, morphRect, mixRect, iris, hop, impact, camera, view, project, handheld, shake, beats };
});
