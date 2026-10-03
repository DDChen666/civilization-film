// film.js：正片的時間軸。所有時間都從 data/audio.json（配樂的樂譜）來，沒有手寫的秒數。
//
// 第一部（手 → 火 → 田 → 城 → 路 → 海 → 機）：一個鏡頭一路往後退，不剪接。鏡頭在世界座標裡走一條路（KEYS），
//   畫面依距離換手：岩壁與營地、田與村子（scene_land）→ 巴比倫（scene_city）→ 地球（scene_globe）。
// 家：整顆地球，安靜。　網：終段，奇觀與里程碑的連擊。
// 里程碑（src/milestones.js）隨拍子進左邊的清單，釘在地球上它發生的地方。
(function (root) {
  'use strict';
  const { clamp, lerp, sstep, norm, add, sub, mul, cross, dot, mix, hash, vnoise, R } = E;
  const P = Mu.pulse, outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
  let mu, T, D, GEO, LINES = [], CITY, SLAMS, CUTS, SHOTS, beat, bar, HEROES = [], SPECIAL = {}, ROUTES = [], VOY = [], TOWNS = [], OLDT = [], LEVELS = [], REROLL = [], ROADS = [], FIREHITS = [], RHERO = [], LOCAL = { vill: [], canals: [] }, tmp, tg;
  const KIND = { i: '#f6bd62', s: '#9fd4ff', b: '#efe4cf', e: '#ff8a5c' };       // 年份的顏色：發明金、科學冰藍、建設骨白、探索赭紅
  const CAP = { hand: ['約四萬年前', '手印'], giza: ['西元前 2560 年', '金字塔'], stonehenge: ['西元前 2500 年', '巨石陣'], city: ['西元前 600 年', '巴比倫'], parthenon: ['西元前 432 年', '帕德嫩神廟'], greatwall: ['西元前 214 年', '長城'], colosseum: ['西元 80 年', '羅馬競技場'],
    angkor: ['1150 年', '吳哥窟'], tiantan: ['1420 年', '天壇'], taj: ['1653 年', '泰姬瑪哈陵'], eiffel: ['1889 年', '艾菲爾鐵塔'], saturn: ['1969 年', '登月火箭'], home: ['1972 年', '地球'], iss: ['1998 年', '國際太空站'], skyline: ['現在', '城市'], chip: ['現在', '晶片'],
    t_silk: ['西元前 130 年起', '絲綢之路'], t_sea: ['1405 年起', '大航海'], t_rail: ['1830 年起', '鐵路'], t_air: ['現在', '航線與網路'] };
  const LON0 = 44.42, LAT0 = 32.54, DEG = Math.PI / 180;
  const AXIS = [0, Math.cos(LAT0 * DEG), Math.sin(LAT0 * DEG)], CEN = [0, 0, -R];        // 地軸的方向、地心（世界座標）

  // ── 鐵路（暖白）與海底電纜（冰藍）。城市的座標憑記憶寫的，路線是示意。
  const RAIL = {
    uk: [[-2.98, 53.41], [-2.24, 53.48], [-1.9, 52.48], [-0.12, 51.5]],
    fr: [[2.35, 48.86], [4.83, 45.76], [5.37, 43.3]],
    eu: [[2.35, 48.86], [4.35, 50.85], [6.96, 50.94], [13.4, 52.52], [21.01, 52.23], [27.56, 53.9], [37.62, 55.75]],
    orient: [[2.35, 48.86], [7.75, 48.58], [11.58, 48.14], [16.37, 48.21], [19.04, 47.5], [20.46, 44.79], [23.32, 42.7], [28.98, 41.01]],
    it: [[11.58, 48.14], [9.19, 45.46], [12.5, 41.9], [14.27, 40.85]],
    ib: [[2.35, 48.86], [-0.58, 44.84], [-3.7, 40.42], [-9.14, 38.72]],
    nord: [[13.4, 52.52], [9.99, 53.55], [12.57, 55.68], [18.07, 59.33]],
    pet: [[37.62, 55.75], [30.32, 59.94]],
    sib: [[37.62, 55.75], [44.0, 56.33], [56.23, 58.01], [60.6, 56.84], [73.37, 54.99], [82.92, 55.03], [92.87, 56.01], [104.28, 52.29], [113.5, 52.03], [126.64, 45.75], [131.89, 43.12]],
    bagh: [[28.98, 41.01], [32.86, 39.93], [32.48, 37.87], [35.32, 37.0], [37.16, 36.2], [43.13, 36.34], [44.37, 33.31], [47.78, 30.51]],
    hejaz: [[37.16, 36.2], [36.29, 33.51], [35.93, 31.95], [39.61, 24.47]],
    nile: [[29.92, 31.2], [31.24, 30.04], [32.64, 25.69], [32.9, 24.09], [31.35, 21.8], [32.56, 15.5]],
    in1: [[72.88, 19.08], [79.09, 21.15], [88.36, 22.57]],
    in2: [[72.88, 19.08], [77.21, 28.61], [74.34, 31.55], [71.58, 34.01]],
    in3: [[77.21, 28.61], [81.85, 25.44], [88.36, 22.57]],
    in4: [[72.88, 19.08], [77.6, 15.0], [80.27, 13.08]],
    casp: [[52.97, 40.0], [58.38, 37.95], [61.83, 37.6], [64.42, 39.77], [66.97, 39.65], [69.24, 41.3]],
    saf: [[18.42, -33.92], [24.77, -28.73], [28.05, -26.2], [28.58, -20.15], [25.85, -17.93]],
    eaf: [[39.67, -4.04], [36.82, -1.29], [34.77, -0.09]],
    cn1: [[116.4, 39.9], [117.2, 39.13], [123.43, 41.8], [126.64, 45.75]],
    cn2: [[116.4, 39.9], [114.3, 30.59], [113.26, 23.13]],
    cn3: [[121.47, 31.23], [118.78, 32.06], [114.3, 30.59]],
    us1: [[-74.0, 40.71], [-75.16, 39.95], [-80.0, 40.44], [-87.63, 41.88]],
    us2: [[-87.63, 41.88], [-95.94, 41.26], [-104.8, 41.14], [-112.55, 41.62], [-121.49, 38.58]],
    us3: [[-74.0, 40.71], [-71.06, 42.36]],
    us4: [[-87.63, 41.88], [-90.2, 38.63], [-90.07, 29.95]],
    ca: [[-73.57, 45.5], [-79.38, 43.65], [-97.14, 49.9], [-114.07, 51.05], [-123.12, 49.28]],
    sa: [[-58.38, -34.6], [-64.18, -31.42], [-68.84, -32.89], [-70.67, -33.45]],
    jz: [[116.4, 39.9], [115.97, 40.36], [114.88, 40.77]],
    shink: [[139.77, 35.68], [136.9, 35.17], [135.5, 34.7]],
  };
  const CABLE = {
    india: [[-5.65, 50.04], [-9.6, 44.5], [-9.6, 38.6], [-6.4, 36.2], [-5.35, 35.95], [3, 37.5], [11.5, 37.4], [14.5, 35.9], [22, 34.5], [29.9, 31.25], [32.55, 29.97], [35, 26], [38.5, 19], [42.5, 14], [43.4, 12.5], [45.0, 12.75], [58, 16.5], [72.8, 18.95]],
    atl: [[-10.3, 51.9], [-30, 52], [-53.4, 47.9]],
    aus: [[80.3, 13.1], [88, 8.5], [95, 6], [100.3, 5.4], [103.85, 1.25], [106.8, -6.1], [115, -9.5], [130.85, -12.45]],
    china: [[103.85, 1.25], [108, 6], [111, 14], [114.17, 22.3], [120, 25.5], [122.2, 31.0], [129.87, 32.75]],
    wafr: [[-9.6, 38.6], [-16.9, 32.65], [-25, 16.9], [-18, 5], [-6, 2], [5, -8], [11, -20], [17.6, -33.6]],
    eafr: [[45.0, 12.75], [51.8, 11.5], [44, -2], [39.3, -6.16], [41, -15], [34, -26], [31.03, -29.86]],
  };
  const ORDER = [['uk'], ['fr'], ['eu'], ['us3', 'us1'], ['orient'], ['it'], ['ib'], ['us2'], ['nord', 'pet'], ['bagh'], ['nile'], ['in1'], ['in2', 'in3'], ['casp'], ['hejaz', 'in4'],
    ['c:india'], ['us4', 'ca'], ['saf'], ['c:aus'], ['cn1'], ['c:china'], ['eaf', 'sa'], ['c:wafr'], ['c:eafr'], ['cn2'], ['cn3'], ['sib'], ['c:atl'], ['jz'], ['shink']];
  const LINE_OF = { '跨大西洋電纜': 'c:atl', '西伯利亞鐵路': 'sib', '京張鐵路': 'jz', '新幹線': 'shink' };      // 這幾條線跟它自己的里程碑走
  // ── 大航海的幾條航線（示意）。第一格是它跟著哪一個里程碑出發
  const VOYAGES = [
    ['鄭和下西洋', [[118.8, 32.1], [122.5, 30.5], [120, 23], [113, 18], [109.5, 11], [105, 5], [103.8, 1.3], [98.5, 5.2], [95, 6], [85, 6], [80.3, 6], [76, 9.5], [75.78, 11.26], [66, 16], [59, 22], [56.3, 27.1]]],
    ['鄭和下西洋', [[76, 9.5], [60, 5], [50, 2], [40.1, -3.2]]],
    ['橫渡大西洋', [[-6.9, 37.2], [-15.5, 28], [-40, 25], [-74.5, 24]]],
    ['海路通往印度', [[-9.14, 38.7], [-17, 28], [-23, 15], [-25, 0], [-20, -20], [0, -34], [18, -35.5], [26, -35], [35, -26], [40.1, -3.2], [60, 5], [75.78, 11.26]]],
    ['環球航行', [[-6.35, 36.78], [-16, 28], [-28, 5], [-38, -13], [-43, -23], [-58, -38], [-68, -52.5], [-75, -52.8], [-90, -35], [-130, -15], [-170, 0], [144.8, 13.4], [124, 10.3], [127.4, 0.8], [120, -12], [80, -30], [30, -38], [18, -36], [-10, -15], [-22, 10], [-20, 28], [-6.35, 36.78]]],
    ['日心說', [[121, 14.6], [140, 30], [180, 38], [-140, 38], [-118, 30], [-99.9, 16.85]]],      // 馬尼拉大帆船（1565 年起）：借最近的時間點出發
    ['望遠鏡', [[4.9, 52.4], [-10, 44], [-20, 20], [-15, -10], [10, -36], [40, -38], [80, -30], [100, -12], [106.8, -6.1]]],   // 歐洲到巴達維亞的航線（十七世紀初）
  ];
  const gc = (a, b) => { const x = Math.sin(a[1] * DEG) * Math.sin(b[1] * DEG) + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.cos((a[0] - b[0]) * DEG); return Math.acos(clamp(x, -1, 1)) / DEG; };
  const poly = (way, h0) => { let pts = [], deg = 0; for (let k = 0; k < way.length - 1; k++) { const d = gc(way[k], way[k + 1]); deg += d; const seg = E.arc(GEO, way[k], way[k + 1], Math.max(3, Math.round(d * 1.6)), 0, h0); pts = pts.concat(k ? seg.slice(1) : seg); } return { pts, deg }; };

  function init(audio) {
    mu = Mu.load(audio); D = Globe.D; GEO = Globe.GEO;
    beat = mu.timeOfBeat(1) - mu.timeOfBeat(0); bar = beat * 4;
    const B = (b, k = 0) => mu.timeOfBeat(b * 4 + k);
    const sec = (name) => mu.sections.find((s) => s.name === name);
    T = { hand: 0, fire: sec('火').start, field: sec('田').start, city: sec('城').start, road: sec('路').start, sea: sec('海').start, mach: sec('機').start, quiet: sec('家').start, fin: sec('網').start, end: sec('終').start, B };
    T.dur = audio.duration;
    T.sils = mu.raw.silences;
    T.sil1 = T.sils.find((s) => Math.abs(s[1] - T.quiet) < 0.01); T.sil2 = T.sils.find((s) => Math.abs(s[1] - T.fin) < 0.01); T.sil0 = T.sils.find((s) => Math.abs(s[1] - T.fire) < 0.01); T.sil3 = T.sils.find((s) => Math.abs(s[1] - T.end) < 0.01);
    LEVELS = [['手', 0], ['火', T.fire], ['田', T.field], ['城', T.city], ['路', T.road], ['海', T.sea], ['機', T.mach]];
    tmp = document.createElement('canvas'); tg = null;

    // ── 里程碑落在哪一拍：越後面越密
    const put = (list, t0, slot, div) => list.forEach((it, i) => { it.t = t0 + (slot(i) * beat) / div; it.p = GEO(it.lon, it.lat, 12000); });
    put(MS.HAND, B(2), () => 0, 1);
    put(MS.FIRE, T.fire, (i) => 4 + i * 8, 1);                                              // 兩小節一件
    put(MS.FIELD, T.field, (i) => Math.round((i * 28) / (MS.FIELD.length - 1)), 1);         // 大約一小節一件
    put(MS.CITY, T.city, (i) => i * 2, 1);                                                  // 兩拍一件
    put(MS.ROAD, T.road, (i) => Math.round((i * 60) / (MS.ROAD.length - 1)), 2);            // 一拍一件上下
    put(MS.SEA, T.sea, (i) => Math.round((i * 60) / (MS.SEA.length - 1)), 2);
    const M = MS.MACH, nM = M.length - 1;
    put(M, T.mach, (i) => (i < nM ? Math.round((i * 60) / (nM - 1)) : 62), 2);              // 半拍一件；最後一件（登月）落在靜默之前的那一拍
    put(MS.NET_A, T.fin, (i) => i, 2);
    put(MS.NET_B, T.fin + 32 * beat, (i) => i, 2);                                          // 半拍一件，十六拍
    // 最後的重播：全部的里程碑從頭再捲一次（二十八拍）
    REROLL = MS.ALL.map((it, i) => ({ ...it, t: T.fin + 64 * beat + (Math.round((i * 27.5 * 8) / (MS.ALL.length - 1)) * beat) / 8 }));
    for (const it of MS.PART1) SPECIAL[it.name] = it;
    SPECIAL.arc = E.arc(GEO, [-73.8, 40.7], [2.35, 48.86], 60, 4.5e5, 8000);                 // 1927 年那一趟飛行
    HEROES = MS.ALL.filter((it) => it.hero).map((it) => it.t);

    // ── 機：鐵路與電纜跟著主旋律長
    const notes = mu.events('theme', T.mach - 0.01, T.quiet - 0.6).map((e) => e[0]);
    ORDER.forEach((names, i) => {
      const t0 = notes[Math.min(i, notes.length - 1)];
      names.forEach((nm, j) => {
        const cable = nm.startsWith('c:');
        let way = cable ? CABLE[nm.slice(2)] : RAIL[nm];
        if (!cable) {                                                          // 鐵路不是直線：每一段中間加一點彎
          const w2 = [way[0]];
          for (let k = 0; k < way.length - 1; k++) { const a = way[k], b = way[k + 1], d = gc(a, b), n = Math.max(1, Math.round(d / 1.3)), nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
            for (let m = 1; m <= n; m++) { const u = m / n, off = (vnoise(u * n * 0.7 + i * 3.1, k * 5.3 + j, 4) - 0.5) * Math.min(1.1, d * 0.16) * Math.sin(Math.PI * u); w2.push([lerp(a[0], b[0], u) + nx * off, lerp(a[1], b[1], u) + ny * off]); } }
          way = w2;
        }
        const { pts, deg } = poly(way, cable ? 2500 : 5000);
        LINES.push({ key: nm, pts, cable, deg, t0: t0 + j * beat * 0.5, dur: clamp(deg / 15, 0.6, 3.0), seed: i * 7 + j });
      });
    });
    for (const it of M) { const k = LINE_OF[it.name]; if (k) LINES.filter((l) => l.key === k).forEach((l) => { l.t0 = it.t; }); }
    // ── 路：商路跟著鐘聲的主題長；絲綢之路跟它的里程碑
    const rn = mu.events('theme', T.road - 0.01, T.sea - 1).map((e) => e[0]);
    D.land.concat(D.sea).forEach((pts, i) => { const sea = i >= D.land.length, k = sea ? (i - D.land.length) * 2 + 1 : i * 2; ROUTES.push({ pts, sea, deg: pts.length / 2.2, t0: rn[Math.min(rn.length - 1, Math.round((k / 48) * rn.length))], dur: clamp(pts.length / 30, 0.8, 3.2), seed: i }); });
    ROUTES[0].t0 = SPECIAL['絲綢之路'].t; ROUTES[0].dur = 3.4;
    // ── 海：航線跟著它的里程碑出發
    VOY = VOYAGES.map(([key, way], i) => { const { pts, deg } = poly(way, 4000); return { pts, deg, t0: SPECIAL[key].t + (i === 1 ? beat * 2 : 0), dur: clamp(deg / 28, 1.2, 5.5), seed: i }; });
    // ── 兩河流域沿河的聚落（示意）與古城亮起來的時間
    const r = E.rng(3300);
    for (const rv of D.rivers) { if (rv.name !== 'Euphrates' && rv.name !== 'Tigris') continue; for (const p of rv.pts) for (let k = 0; k < 5; k++) { const x = p[0] + (r() - 0.5) * 60000, y = p[1] + (r() - 0.5) * 60000; TOWNS.push({ p: [x, y, Math.sqrt(R * R - x * x - y * y) - R + 300], born: r(), size: 0.5 + r() }); } }
    for (let k = 0; k < 500; k++) { const a = r() * 6.2832, rad = Math.pow(r(), 0.5) * 240000, x = Math.cos(a) * rad - 40000, y = Math.sin(a) * rad; TOWNS.push({ p: [x, y, Math.sqrt(R * R - x * x - y * y) - R + 300], born: r(), size: 0.4 + r() * 0.8 }); }
    OLDT = D.old.map((o, i) => T.city + bar * 4.2 + (i / D.old.length) * bar * 5);
    // 聚落之間的路：每個聚落連到最近的鄰居（只取一部分，畫成一張細網）
    for (let i = 0; i < TOWNS.length; i += 3) { let best = -1, bd = 1e18; for (let j = 0; j < TOWNS.length; j += 2) { if (j === i) continue; const dx = TOWNS[i].p[0] - TOWNS[j].p[0], dy = TOWNS[i].p[1] - TOWNS[j].p[1], dd = dx * dx + dy * dy; if (dd < bd && dd > 4e6) { bd = dd; best = j; } } if (best >= 0 && bd < 9e8) ROADS.push([TOWNS[i].p, TOWNS[best].p, Math.max(TOWNS[i].born, TOWNS[best].born)]); }
    FIREHITS = mu.events('taiko', T.fire + beat * 4, T.field - beat * 2).map((e) => e[0]);
    // 巴比倫城外：從河引出來的水渠、渠邊的村落（示意）。鏡頭升到幾公里高的時候看得到
    for (let k = 0; k < 46; k++) { const y0 = -30000 + r() * 60000, dir = r() < 0.6 ? 1 : -1, L = 6000 + r() * 22000, pts = []; let y = y0; for (let x = 0; x <= L; x += 700) { y += (r() - 0.5) * 520; pts.push([-400 + dir * x, y, 0]); } LOCAL.canals.push({ pts, born: r() });
      for (let j = 2; j < pts.length; j += 2 + ((r() * 3) | 0)) LOCAL.vill.push({ p: [pts[j][0] + (r() - 0.5) * 900, pts[j][1] + (r() - 0.5) * 900, 3], born: r(), size: 0.5 + r() }); }
    for (let k = 0; k < 260; k++) { const a = r() * 6.2832, rad = 1500 + Math.pow(r(), 0.7) * 30000; LOCAL.vill.push({ p: [Math.cos(a) * rad, Math.sin(a) * rad, 3], born: r(), size: 0.4 + r() * 0.8 }); }
    RHERO = REROLL.filter((it) => it.hero).map((it) => it.t);
    // ── 城市：什麼時候點上燈火、什麼時候通電、離世界的原點多遠
    const hits = mu.events('taiko', T.mach, T.quiet - 0.3).map((e) => e[0]), n = D.cities.length;
    const rank = D.cities.map((c, i) => [Math.min(gc([c.lon, c.lat], [-0.12, 51.5]), gc([c.lon, c.lat], [-74, 40.7]) + 6, gc([c.lon, c.lat], [139.7, 35.7]) + 22) / 180 + hash(i, 3) * 0.16, i]).sort((a, b) => a[0] - b[0]);
    const oldW = (c) => c.lon > -12 && c.lon < 142 && c.lat > 5 && c.lat < 52;                        // 舊大陸的文明帶：地中海、中東、印度、中國、日本
    const taps = mu.events('taiko', T.road, T.mach).map((e) => e[0]);
    CITY = D.cities.map((c, i) => { const u = oldW(c) ? hash(i, 8) * 0.55 : 0.5 + hash(i, 8) * 0.5; return { dO: gc([c.lon, c.lat], [LON0, LAT0]), tLit: Infinity, tGold: taps[Math.min(taps.length - 1, Math.floor(u * taps.length))] + hash(i, 4) * 0.04, size: 5 + Math.pow(c.pop / 3.5e7, 0.45) * 38 }; });
    rank.forEach(([, i], k) => { const need = (k + 1) / n; const h = hits.findIndex((_, q) => Math.pow((q + 1) / hits.length, 1.9) * 0.93 >= need); if (h >= 0) CITY[i].tLit = hits[h] + hash(i, 5) * 0.05; });
    // ── 後製用的：段落的重擊
    SLAMS = [[T.fire, 0.045, 16, 0.3], [T.field, 0.03, 9, 0.1], [T.city, 0.045, 18, 0.22], [T.road, 0.03, 10, 0.1], [T.sea, 0.045, 16, 0.2], [T.mach, 0.045, 18, 0.2], [T.quiet, 0.05, 20, 0.3], [T.fin, 0.06, 28, 0.6]];
    for (let b = 45; b < 52; b++) SLAMS.push(b === 48 ? [B(b), 0.035, 12, 0.12] : [B(b), 0.02, 6, 0.025]);
    for (const b of [24, 32, 40]) SLAMS.push([B(b), 0.028, 9, 0.08]);                        // 城、路、海的後半段開頭
    // 終段的鏡頭（單位：拍，從終段第一拍起算）
    SHOTS = [[0, 4, 'globe'],
      [4, 6, 'hand'], [6, 8, 'giza'], [8, 10, 'stonehenge'], [10, 12, 'city'], [12, 13, 'parthenon'], [13, 14, 'greatwall'], [14, 15, 'colosseum'], [15, 16, 'angkor'],       // 奇觀：照年代走一遍
      [16, 18, 'tiantan'], [18, 20, 'taj'], [20, 22, 'eiffel'], [22, 24, 'saturn'], [24, 26, 'iss'], [26, 28, 'skyline'], [28, 30, 'chip'], [30, 32, 'home'],
      [32, 48, 'wide'],                                                                    // 1983 之後的連發
      [48, 52, 't_silk'], [52, 56, 't_sea'], [56, 60, 't_rail'], [60, 64, 't_air'],        // 交通：路、海、鐵路、航線
      [64, 92, 'reroll'],                                                                  // 全部重播一次
      [92, 92.5, 'giza'], [92.5, 93, 'greatwall'], [93, 93.5, 'taj'], [93.5, 94, 'eiffel'], [94, 94.5, 'saturn'], [94.5, 95, 'iss'], [95, 96, 'skyline']];   // 最後一小節：回顧連擊
    CUTS = SHOTS.slice(1).map((s) => T.fin + s[0] * beat);
    SLAMS.push([T.fin + 32 * beat, 0.05, 20, 0.3], [T.fin + 64 * beat, 0.055, 24, 0.4], [T.end, 0.06, 26, 0.5]);
  }

  // ════════════════════════════════════════════ 共用的零件
  /** 鏡頭要看哪裡：最近這幾拍的里程碑的「重心」。地球會自己轉過去面對正在發生事情的地方 */
  function track(items, t, sigma) {
    let x = 0, y = 0, z = 0;
    for (const it of items) { const w = Math.exp(-0.5 * Math.pow((t - it.t) / sigma, 2)) + 1e-6, c = Math.cos(it.lat * DEG); x += w * c * Math.cos(it.lon * DEG); y += w * c * Math.sin(it.lon * DEG); z += w * Math.sin(it.lat * DEG); }
    const n = Math.hypot(x, y, z) || 1;
    return [Math.atan2(y, x) / DEG, clamp(Math.asin(z / n) / DEG, -8, 56)];
  }
  /** 里程碑留在地球上的光，和它出現那一下的一圈 */
  function drawMarks(A, cam, t, items, alt) {
    const sz = clamp(Math.sqrt(1.3e7 / alt), 0.7, 1.6);
    A.globalCompositeOperation = 'lighter';
    for (const it of items) {
      if (t < it.t || cam.hidden(it.p)) continue;
      const born = P(t, it.t, 0.14), spr = it.kind === 's' ? D.glowWhite : it.kind === 'e' ? City.S.glowFire : D.glowGold;
      Globe.glow(A, cam, it.p, spr, (it.hero ? 26 : 17) * sz * (1 + 2.2 * born), 1);
    }
    A.globalCompositeOperation = 'source-over';
    for (const it of items) {
      const a = (t - it.t) / (it.hero ? 0.9 : 0.6); if (a <= 0 || a >= 1 || cam.hidden(it.p)) continue;
      const s0 = cam.proj(it.p); if (!s0) continue;
      A.beginPath(); A.arc(s0[0], s0[1], 6 + (it.hero ? 190 : 90) * outCubic(a), 0, 6.2832);
      A.strokeStyle = KIND[it.kind]; A.globalAlpha = 0.95 * Math.pow(1 - a, 1.5); A.lineWidth = (it.hero ? 3.4 : 2.2) * (1 - a) + 0.6; A.stroke(); A.globalAlpha = 1;
    }
  }
  /** 左邊往上捲的清單：新的一行從下面進來，舊的往上推、變淡。最新的那一行有一條線連到它在地球上的位置（看得到的話） */
  function ticker(g, cam, t, items, { x = 104, y0 = 806, rise = 590, link = true, push = 0.07 } = {}) {
    let n = 0; while (n < items.length && items[n].t <= t) n++;
    if (!n) return null;
    const FS = EN ? [22, 35, 28, 58] : [21, 32, 27, 62];                     // 年份、名稱的字級（一般、大字）
    const bk = g.createLinearGradient(0, 0, 860, 0); bk.addColorStop(0, 'rgba(5,4,6,0.78)'); bk.addColorStop(0.55, 'rgba(5,4,6,0.45)'); bk.addColorStop(1, 'rgba(5,4,6,0)');
    const fadeIn = clamp((t - items[0].t) / 0.3);
    g.save(); g.globalAlpha = fadeIn; g.fillStyle = bk; g.fillRect(0, 0, 860, 1080); g.globalAlpha = 1;
    g.textBaseline = 'alphabetic';
    let offs = 0;
    for (let i = n - 1; i >= 0 && offs < rise; i--) {
      const it = items[i], age = t - it.t, h = it.hero ? 84 : 46, y = y0 - offs;
      const a = Math.pow(clamp(1 - offs / rise), 1.25) * clamp(age / 0.04) * (age < beat * 1.5 ? 1 : 0.82);
      const pop = 1 + 0.3 * P(t, it.t, 0.07);
      g.save(); g.translate(x, y); g.scale(pop, pop); g.globalAlpha = a;
      g.font = `400 ${it.hero ? FS[2] : FS[0]}px ${FONTF}`; g.letterSpacing = '1px'; g.fillStyle = KIND[it.kind]; g.textAlign = 'right';
      g.fillText(it.year, 122, it.hero ? (EN ? -6 : -8) : 0);
      g.textAlign = 'left'; g.fillStyle = '#efe4cf'; let fz = it.hero ? FS[3] : FS[1]; g.letterSpacing = EN ? '0.5px' : it.hero ? '5px' : '3px';
      g.font = `500 ${fz}px ${FONTF}`; let wdt = g.measureText(it.label).width;
      if (wdt > 610) { fz *= 610 / wdt; g.font = `500 ${fz}px ${FONTF}`; wdt = g.measureText(it.label).width; }      // 太長的名字縮小到放得下
      g.fillText(it.label, 146, 0); g.restore();
      if (link && cam && age < beat * 1.3 && !cam.hidden(it.p)) {                       // 連到地球上的那一點
        const s0 = cam.proj(it.p);
        if (s0 && s0[0] > -200 && s0[0] < 2120 && s0[1] > -200 && s0[1] < 1280) { const k = outCubic(age / 0.12), x0 = x + 146 + wdt + 18, yy = y - (it.hero ? 22 : 11); g.globalAlpha = 0.6 * (1 - age / (beat * 1.3)); g.strokeStyle = KIND[it.kind]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, yy); g.lineTo(lerp(x0, s0[0], k), lerp(yy, s0[1], k)); g.stroke(); }
      }
      offs += h * outCubic(age / push);
    }
    g.restore();
    return items[n - 1];
  }
  /** 奇觀那幾個鏡頭的大字：年份一行、名字一行 */
  function caption(g, [year, name], slam) {
    year = TR(year); name = TR(name);
    g.save();
    g.save(); g.translate(360, 210); g.scale(1, 0.42); const bk = g.createRadialGradient(0, 0, 0, 0, 0, 620); bk.addColorStop(0, 'rgba(5,4,6,0.6)'); bk.addColorStop(1, 'rgba(5,4,6,0)'); g.fillStyle = bk; g.fillRect(-620, -620, 1240, 1240); g.restore();
    g.textBaseline = 'alphabetic'; g.fillStyle = '#f6bd62'; g.font = `400 ${EN ? 32 : 30}px ${FONTF}`; g.letterSpacing = EN ? '3px' : '6px'; g.fillText(year, 108, 150);
    let fz = EN ? 100 : 104; g.letterSpacing = EN ? '2px' : '10px'; g.font = `500 ${fz}px ${FONTF}`; const w = g.measureText(name).width; if (w > 1150) { fz *= 1150 / w; g.font = `500 ${fz}px ${FONTF}`; }
    g.translate(104, 262); g.scale(1 + 0.22 * slam, 1 + 0.22 * slam); g.fillStyle = '#efe4cf'; g.fillText(name, 0, 0);
    g.restore();
  }
  function drawCities(A, cam, bright, alt, spr) {
    const sz = clamp(Math.sqrt(1.3e7 / alt), 0.55, 1.7);
    A.globalCompositeOperation = 'lighter';
    for (let i = 0; i < CITY.length; i++) { const b = bright(CITY[i], i); if (b > 0.01) Globe.glow(A, cam, D.cities[i].p, typeof spr === 'function' ? spr(CITY[i]) : spr || D.glowGold, CITY[i].size * sz * (0.7 + 0.3 * Math.min(b, 3)), Math.min(1, b)); }
    A.globalCompositeOperation = 'source-over';
  }
  /** 一條會長出來的線，加上沿線跑的光點 */
  function growLine(A, cam, l, t, { color, width = 1.4, alpha = 0.85, dash = null, head = D.glowGold, headPx = 30, beads = 0, beadPx = 12, speed = 9 }) {
    const k = outCubic((t - l.t0) / l.dur); if (k <= 0 || alpha < 0.02) return 0;
    E.line(A, cam, E.partial(l.pts, k), { occlude: true, color, alpha, width: width + P(t, l.t0, 0.25) * 1.2, dash });
    A.globalCompositeOperation = 'lighter';
    if (k < 1) Globe.glow(A, cam, Globe.bead(l.pts, k), head, headPx, 1);
    for (let j = 0; j < beads; j++) { const u = (((t - l.t0) * speed) / Math.max(8, l.deg || 30) + j / beads + hash(l.seed, j) * 0.3) % 1; if (u < k) Globe.glow(A, cam, Globe.bead(l.pts, u), head, beadPx, 0.9 * alpha); }
    A.globalCompositeOperation = 'source-over';
    return k;
  }

  // ════════════════════════════════════════════ 第一部的鏡頭：一條一路往後退的路
  // [小節, 距離（公尺）, 俯角（度；0 是平視、90 是垂直往下）, 方位（度；0 是朝北看）, 畫面中心往右移, 往下移, 視角, 看哪裡]
  const CP = (x, y, z) => [Land.CAMP[0] + x, Land.CAMP[1] + y, Land.CAMP[2] + z];
  const KEYS = [
    [0, 0.74, 0, 0, 0, 0, 36, CP(0, 0, 0.005)],
    [4, 0.88, 0, 0, 0, 0, 36, CP(0, 0, 0)],
    [5, 1.9, 4, -2, 0, 14, 36, CP(0.15, 0, -0.15)],
    [6, 4.6, 13, -7, 10, 46, 36, CP(0.6, -1.0, -0.6)],
    [8, 16, 24, -14, 30, 96, 36, CP(-2.4, -4.8, -1.0)],
    [10, 38, 28, -20, 40, 120, 36, CP(-1, -15, -1.3)],
    [12, 82, 30, -27, 40, 130, 36, CP(14, -30, -1.3)],
    [14, 190, 29, -33, 40, 140, 36, [-100, -150, 0]],
    [17, 330, 24, -39, 40, 150, 36, [-30, -30, 4]],
    [20, 474, 13.4, -42.2, 40, 150, 36, [-10, 12, 40]],
    [21.75, 640, 15, -42, 40, 150, 36, [-10, 12, 40]],
    [23, 2800, 28, -40, 90, 130, 36, [0, 0, 20]],
    [24.5, 2.6e4, 52, -30, 170, 70, 36, [0, 0, 0]],
    [26, 2.6e5, 75, -14, 230, 20, 36, [0, 0, 0]],
    [28, 2.4e6, 84, 0, 250, 0, 36, [0, 0, 0]],
    [30, 9e6, 88, 0, 260, 0, 36, null],
    [36, 1.25e7, 89, 0, 270, 0, 36, null],
    [44, 1.7e7, 89, 0, 280, 0, 34, null],
    [52, 2.6e7, 89.5, 0, 300, -10, 25, null],
  ];
  function camP1(t) {
    let xb = t / bar;                                                        // 第幾小節（小數）
    if (t >= T.fire) {                                                       // 火之後：每一拍往後踢一下，拍與拍之間慢慢退
      const bf = (t + 0.02) / beat, kb = Math.floor(bf), f = bf - kb, hard = t >= T.city ? 0.74 : 0.66;
      xb = (kb + hard * (1 - Math.pow(2, -f / 0.11)) + (1 - hard) * f) / 4;
    }
    let i = 0; while (i < KEYS.length - 2 && xb >= KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], u = clamp((xb - a[0]) / (b[0] - a[0])), us = u * u * (3 - 2 * u);
    const d = Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), u));
    const pitch = lerp(a[2], b[2], us) * DEG, az = lerp(a[3], b[3], us) * DEG, shift = [lerp(a[4], b[4], us), lerp(a[5], b[5], us)], fov = lerp(a[6], b[6], us);
    let tgt;
    if (a[7] && b[7]) tgt = mix(a[7], b[7], us);
    else {
      const items = t >= T.mach ? MS.MACH : t >= T.sea - bar ? MS.SEA.concat(MS.MACH.slice(0, 3)) : MS.ROAD.concat(MS.SEA.slice(0, 2));
      const tr = track(items, t, beat * (t >= T.mach ? 3.4 : 5.5)), far = GEO(tr[0], tr[1], 0);
      tgt = a[7] ? mix(a[7], far, us) : far;
    }
    const up = norm(sub(tgt, CEN)), nn = norm(sub(AXIS, mul(up, dot(AXIS, up)))), ee = cross(nn, up);
    const vh = add(mul(nn, Math.cos(az)), mul(ee, Math.sin(az))), view = sub(mul(vh, Math.cos(pitch)), mul(up, Math.sin(pitch)));
    const eye = sub(tgt, mul(view, d));
    const cam = E.makeCam({ eye, target: tgt, up: norm(mix(up, nn, sstep(50, 82, pitch / DEG))), fov, shift });
    return { cam, d, pitch: pitch / DEG, tgt };
  }

  /** 巴比倫城外的水渠與村落：城的鏡頭與地球的鏡頭都畫它，換手的時候才接得上 */
  function drawLocal(A, cam, t, d) {
    const a = sstep(1100, 3500, d) * (1 - sstep(1.2e5, 4e5, d)); if (a < 0.01) return;
    const tp = clamp((t - (T.city + bar * 1.2)) / (bar * 2.6)), px = clamp(9000 / d, 0.35, 1.4);
    for (const c of LOCAL.canals) { const k = clamp((tp - c.born * 0.7) / 0.3); if (k > 0) E.line(A, cam, E.partial(c.pts, k), { color: '#5aa9ee', alpha: 0.55 * a, width: 1.1 }); }
    A.globalCompositeOperation = 'lighter';
    for (const v of LOCAL.vill) { if (v.born > tp) continue; const s0 = cam.proj(v.p); if (s0) { const k = (5 + 9 * px) * v.size; A.globalAlpha = 0.85 * a; A.drawImage(D.glowGold, s0[0] - k / 2, s0[1] - k / 2, k, k); } }
    A.globalAlpha = 1; A.globalCompositeOperation = 'source-over';
  }

  /** 無限縮放用的地面點：依鏡頭距離選兩層疏密，交接時互相淡入淡出 */
  function groundLOD(A, cam, d, tgt, alpha) {
    const Lv = Math.log(d / 13) / Math.log(4), L0 = Math.floor(Lv), f = Lv - L0, ext = d * 1.25;
    A.fillStyle = '#cbb894';
    for (const [lv, a] of [[L0, 1 - f], [L0 + 1, 1]]) {
      const s = Math.pow(4, lv), i0 = Math.floor((tgt[0] - ext) / s), i1 = Math.ceil((tgt[0] + ext) / s), j0 = Math.floor((tgt[1] - ext) / s), j1 = Math.ceil((tgt[1] + ext) / s);
      A.beginPath();
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = (i + hash(i, j, lv)) * s, y = (j + hash(j, i, lv + 7)) * s, r2 = x * x + y * y; if (r2 > R * R * 0.2) continue;
        const p = cam.proj([x, y, Math.sqrt(R * R - r2) - R]); if (!p || p[0] < 0 || p[0] > cam.W || p[1] < 0 || p[1] > cam.H) continue;
        A.rect(p[0], p[1], 1.5, 1.5);
      }
      A.globalAlpha = alpha * a * 0.5; A.fill();
    }
    A.globalAlpha = 1;
  }

  // ── 機：鐵路、電纜的狀態
  function drawLinesState(A, cam, t, alt, gain = 1) {
    const sz = clamp(Math.sqrt(9e6 / alt), 0.7, 1.5);
    for (const l of LINES) {
      const k = outCubic((t - l.t0) / l.dur); if (k <= 0) continue;
      const pts = E.partial(l.pts, k), born = P(t, l.t0, 0.25);
      E.line(A, cam, pts, { occlude: true, color: l.cable ? '#8fd0ff' : '#ffe9c4', alpha: (l.cable ? 0.8 : 0.85) * gain, width: ((l.cable ? 1.2 : 1.5) + born * 1.2) * (0.6 + 0.4 * gain), dash: l.cable ? [5, 4] : null });
      if (!l.cable && sz > 0.85) E.line(A, cam, pts, { occlude: true, color: '#ffe9c4', alpha: 0.5 * gain * clamp((sz - 0.85) * 3), width: 5.5, dash: [1.3, 7.5], cap: 'butt' });      // 枕木：地圖上鐵路的畫法
    }
    for (const l of LINES) {                                                   // 新的一條線出發時，起點放出一圈光
      const a = (t - l.t0) / 0.7; if (a <= 0 || a >= 1 || cam.hidden(l.pts[0])) continue;
      const s0 = cam.proj(l.pts[0]); if (!s0) continue;
      A.beginPath(); A.arc(s0[0], s0[1], 8 + 120 * outCubic(a), 0, 6.2832);
      A.strokeStyle = l.cable ? '#8fd0ff' : '#ffe9c4'; A.globalAlpha = 0.9 * Math.pow(1 - a, 1.6); A.lineWidth = 2.6 * (1 - a) + 0.6; A.stroke(); A.globalAlpha = 1;
    }
    A.globalCompositeOperation = 'lighter';
    for (const l of LINES) {
      const k = outCubic((t - l.t0) / l.dur); if (k <= 0) continue;
      if (k < 1) Globe.glow(A, cam, Globe.bead(l.pts, k), l.cable ? D.glowWhite : D.glowGold, 44 * sz, 1);                               // 正在往前長的那個頭
      const nb = Math.max(1, Math.round(l.deg / 22)), sp = (l.cable ? 26 : 9) / l.deg;
      for (let j = 0; j < nb; j++) { const u = ((t - l.t0) * sp + j / nb + hash(l.seed, j) * 0.3) % 1; if (u < k) Globe.glow(A, cam, Globe.bead(l.pts, u), l.cable ? D.glowWhite : D.glowGold, (l.cable ? 11 : 13) * sz, 0.9 * gain); }
    }
    A.globalCompositeOperation = 'source-over';
  }

  /** 地球（第一部從幾十公里高一路到整顆地球都用它）。畫過的東西都留著：聚落、古城、商路、航線、城市的燈火、鐵路與電纜、里程碑的光 */
  function earthP1(g, LY, cam, t, d, tgt) {
    const low = d < 1.3e6, kick = mu.hit('kick', t, 0.1), mach = t >= T.mach;
    const flick = mach ? (1 + 0.5 * mu.hit('roll', t, 0.03)) * (1 + 0.9 * kick) : 1 + 0.45 * kick;
    if (low) { g.fillStyle = '#070b12'; g.fillRect(0, 0, 1920, 1080); }
    const wR = sstep(2.5e5, 1e6, d) * (1 - sstep(4e6, 9e6, d)), wG = sstep(3.5e6, 8e6, d), near = 1 - sstep(5e6, 1.5e7, d) * 0.6;
    Globe.earth(g, LY, cam, {
      noBody: low, stars: 0.85 * sstep(1.3e6, 3.5e6, d), dotSize: clamp(1.6 * Math.sqrt(6e6 / d), 1.6, 2.6), dotColor: mach ? '#c4b596' : '#d8c6a2',
      dotsR: 0.6 * wR * (1 + 0.3 * kick), dotsG: (mach ? 0.46 : 0.56) * wG * (1 + 0.3 * kick), coast50: 0.5 * sstep(1e5, 6e5, d) * (1 - sstep(4e6, 9e6, d)), coast110: 0.36 * wG, sea: ['#0c2036', '#07121f', '#03060b'],
      rivers: 0.85 * (1 - sstep(3e6, 8e6, d)), rim: 0.75 + 0.5 * kick, rimSun: -2.2, glow: [[24, 0.55], [6, 0.48]],
      draw: (A) => {
        const lodA = 1 - sstep(3e5, 1.4e6, d); if (lodA > 0.01) groundLOD(A, cam, d, tgt, lodA);
        drawLocal(A, cam, t, d);
        // 聚落與古城的燈火
        const townA = (1 - sstep(2.5e6, 7e6, d)) * sstep(2e3, 2e4, d), tp = clamp((t - (T.city + bar * 2.0)) / (bar * 3.5));
        A.globalCompositeOperation = 'lighter';
        if (townA > 0.01) { A.globalCompositeOperation = 'source-over'; A.beginPath(); for (const [a, b, born] of ROADS) { if (born > tp) continue; const pa = cam.proj(a), pb = cam.proj(b); if (pa && pb) { A.moveTo(pa[0], pa[1]); A.lineTo(pb[0], pb[1]); } } A.strokeStyle = '#f6bd62'; A.globalAlpha = 0.34 * townA * (1 - sstep(8e5, 2.5e6, d)); A.lineWidth = 0.9; A.stroke(); A.globalAlpha = 1; A.globalCompositeOperation = 'lighter'; }
        if (townA > 0.01) for (const tw of TOWNS) if (tw.born < tp) Globe.glow(A, cam, tw.p, D.glowGold, clamp(4e5 / d, 0.75, 2.2) * 10 * tw.size, 0.85 * townA);
        D.old.forEach((o, i) => { if (t >= OLDT[i]) Globe.glow(A, cam, o.p, D.glowGold, (12 + o.size * 8) * (1 + 1.8 * P(t, OLDT[i], 0.15)) * clamp(Math.sqrt(4e6 / d), 0.6, 1.5), near); });
        Globe.glow(A, cam, [0, 0, 100], City.S.glowFire, 26 * clamp(Math.sqrt(1e6 / d), 0.5, 2.2), near);                            // 巴比倫：塔頂的那把火
        A.globalCompositeOperation = 'source-over';
        // 商路與航線
        const dim = mach ? 0.45 : 1;
        for (const rt of ROUTES) growLine(A, cam, rt, t, rt.sea ? { color: '#8cc8ff', width: 1.5, alpha: 0.9 * near * dim, dash: [3, 8], head: D.glowWhite, headPx: 26, beads: mach ? 0 : 2, beadPx: 13, speed: 2.6 } : { color: '#f6bd62', width: 1.5, alpha: 0.9 * near * dim, head: D.glowGold, headPx: 26, beads: mach ? 0 : 2, beadPx: 13, speed: 2.2 });
        for (const v of VOY) growLine(A, cam, v, t, { color: '#9fd8ff', width: 1.4, alpha: 0.8 * dim, dash: [7, 5], head: D.glowWhite, headPx: 34, beads: mach ? 1 : 2, beadPx: 15, speed: 6 });
        // 城市：先是燈火（金），通電之後變白
        if (t >= T.road) drawCities(A, cam, (c) => (mach && t >= c.tLit ? (0.75 + 2.2 * P(t, c.tLit, 0.12)) * flick : t >= c.tGold ? (0.62 + 2.0 * P(t, c.tGold, 0.16)) * (1 + 0.35 * kick) : 0), d, (c) => (mach && t >= c.tLit ? D.glowWhite : D.glowGold));
        if (mach) {
          drawLinesState(A, cam, t, d, flick);
          const fl = SPECIAL['飛越大西洋'], s1 = SPECIAL['人造衛星'], s2 = SPECIAL['人類進入太空'], mn = SPECIAL['登月'];
          if (t >= fl.t) { const k = outCubic((t - fl.t) / (beat * 1.6)); E.line(A, cam, E.partial(SPECIAL.arc, k), { occlude: true, color: '#fff1cf', alpha: 0.9, width: 1.6 }); A.globalCompositeOperation = 'lighter'; Globe.glow(A, cam, Globe.bead(SPECIAL.arc, k), D.glowWhite, 30, k < 1 ? 1 : 0.5); A.globalCompositeOperation = 'source-over'; }
          [[s1, 0], [s2, 1]].forEach(([it, k]) => { if (t < it.t) return; const o = D.orbits[k], u = clamp((t - it.t) / (beat * 2.5)); E.line(A, cam, E.partial(o.pts, u), { occlude: true, color: '#cfe6ff', alpha: 0.6, width: 1.1 }); A.globalCompositeOperation = 'lighter'; Globe.glow(A, cam, Globe.bead(o.pts, ((t - it.t) * 0.22) % 1), D.glowWhite, 20, 1); A.globalCompositeOperation = 'source-over'; });
          if (t >= mn.t) { const k = outCubic((t - mn.t) / 0.5), far = GEO(mn.lon, mn.lat, 5.5e7 * k); E.line(A, cam, [mn.p, far], { color: '#fff4e2', alpha: 0.95, width: 2.2 }); A.globalCompositeOperation = 'lighter'; Globe.glow(A, cam, far, D.glowWhite, 46, 1); A.globalCompositeOperation = 'source-over'; }   // 離開地球的那一道光
        }
        drawMarks(A, cam, t, MS.PART1, Math.max(d, 2e6));
      },
    });
  }

  /** 開場的手印：跟著心跳一口一口噴上去 */
  function handGrow(t) {
    const hearts = mu.events('heart', 0, T.fire).map((e) => e[0]);
    let k = 0; for (const h of hearts) k += outCubic((t - h) / 0.3) / hearts.length;
    return (i) => (i === 0 ? clamp(k * 1.02) : 1);
  }

  // ════════════════════════════════════════════ 第一部：手 → 機
  function scenePart1(g, LY, t, ctx) {
    const { cam, d, tgt } = camP1(t), pulse = t >= T.city ? mu.hit('kick', t, 0.1) : mu.hit('taiko', t, 0.12) * 0.8;
    const lv = LEVELS.filter((l) => t >= l[1]).pop();
    if (t < T.city) {
      Land.draw(g, LY, cam, ctx, { d, fire: clamp((t - T.fire) / (T.field - T.fire)), field: clamp((t - T.field) / (T.city - T.field)), time: t, pulse, hands: t < T.fire ? handGrow(t) : null,
        tFire: (b) => (b <= 0 ? -1e9 : FIREHITS[Math.min(FIREHITS.length - 1, Math.floor(b * FIREHITS.length))]),                 // 每一堆火在某一下大鼓點著
        tField: (b) => T.field + (Math.floor(clamp(b) * 58) * beat) / 2 });                                                     // 每一塊田、每一棟房子落在半拍上
      if (t < 1.4) { g.fillStyle = `rgba(5,4,6,${1 - sstep(0, 1.4, t)})`; g.fillRect(0, 0, 1920, 1080); }       // 開頭從黑裡亮起來
    } else {
      const wE = sstep(4e3, 2.2e4, d), zig = clamp(Math.floor((t - T.city) / beat + 1) / 7), grow = clamp(0.3 + ((t - T.city) / (bar * 3.0)) * 0.95);                // 村子原本的房子留著，城從它長出去
      if (wE < 1) City.frame(g, LY, 0, ctx, { camObj: cam, time: t * 2, fire: 1 + 0.9 * pulse, lights: 1 + 0.25 * pulse, grow, zig, readout: false, grade: false, extra: (A2, c2) => drawLocal(A2, c2, t, d) });
      if (wE > 0) {
        if (wE < 1) {                                                           // 城 → 地球：兩張疊著換手
          const sc = g.canvas.width / 1920; if (tmp.width !== g.canvas.width) { tmp.width = g.canvas.width; tmp.height = g.canvas.height; tg = tmp.getContext('2d'); }
          tg.setTransform(sc, 0, 0, sc, 0, 0); tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over'; tg.fillStyle = '#050406'; tg.fillRect(0, 0, 1920, 1080);
          earthP1(tg, LY, cam, t, d, tgt);
          g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = wE; g.drawImage(tmp, 0, 0); g.restore();
        } else earthP1(g, LY, cam, t, d, tgt);
      }
      ctx.grade(g, { vig: 0.45 });
    }
    const list = t < T.fire ? MS.HAND : MS.PART1, cur = ticker(g, cam, t, list, { link: t >= T.city + bar * 5 });
    ctx.readout(g, { glyph: lv[0], era: cur ? cur.era : '約 4 萬年前', ...ctx.niceScale(cam.foc / d, 200), slam: P(t, lv[1], 0.1), alpha: t < 1.4 ? sstep(0.6, 1.4, t) : 1 });
  }

  // ════════════════════════════════════════════ 家：整顆地球，安靜
  const camHome = (t) => Globe.camGeo({ at: [38 - (t - T.quiet) * 0.14, 6], alt: 2.94e7, look: [38 - (t - T.quiet) * 0.14, 6], fov: 22.5, northUp: true, shift: [190, -6] });
  const sunOf = (cam) => norm(add(add(mul(cam.r, -0.75), mul(cam.u, 0.6)), mul(cam.f, -0.45)));
  function sceneHome(g, LY, t, ctx, o = {}) {
    const cam = camHome(o.still ?? t), sun = sunOf(cam);
    const origin = GEO(LON0, LAT0, 20000);
    const bells = mu.events('bell', T.quiet, T.fin).map((e) => e[0]);
    const rolls = mu.events('roll', T.quiet, T.fin).map((e) => e[0]), nRoll = rolls.filter((r) => r <= t).length;
    Globe.earth(g, LY, cam, {
      stars: 0.55, sea: ['#0a1a2c', '#060e19', '#03060b'], dotsG: 0.78, dotColor: '#eadcbd', sun, dark: 0.22, coast110: 0.3, rimColor: '#a9ceff', rim: 1, rimSun: -2.45, glow: [[30, 0.6], [6, 0.35]],
      draw: (A) => {
        A.globalCompositeOperation = 'lighter';
        if (!o.plain) {
          const heart = mu.hit('heart', t, 0.16), on = sstep(bells[2] - 0.1, bells[2] + 1.2, t);                 // 原點的那一點紅：跟著心跳
          if (on > 0) { Globe.glow(A, cam, origin, City.S.glowFire, 16 + 30 * heart, on); Globe.glow(A, cam, origin, City.S.glowFire, 60 + 70 * heart, 0.25 * on); }
          if (nRoll) drawCities(A, cam, (c) => (c.dO < nRoll * 4.2 ? 0.9 * P(t, rolls[Math.max(0, Math.ceil(c.dO / 4.2) - 1)], 0.5) + 0.35 : 0), 2.94e7);
        }
        A.globalCompositeOperation = 'source-over';
      },
    });
    ctx.grade(g, { vig: 0.4 });
    if (o.readout === false) return cam;
    ctx.readout(g, { glyph: '家', era: '1972 年 12 月 7 日', len: (5e6 * cam.foc) / cam.dist, label: '5,000 公里', slam: P(t, o.slamAt ?? T.quiet, 0.1),
      eraAlpha: o.plain ? 1 : sstep(bells[0] - 0.05, bells[0] + 0.5, t), scaleAlpha: o.plain ? 1 : sstep(bells[1] - 0.05, bells[1] + 0.5, t) });
    return cam;
  }

  // ════════════════════════════════════════════ 終段：地球亮起來，然後奇觀與里程碑的連擊
  function globeLit(g, LY, t, ctx, { cam, alt, wave = false, glyphAt, items }) {
    const b = (t - T.fin) / beat;
    Globe.earth(g, LY, cam, {
      stars: 0.9, dotsG: 0.42, coast110: 0.26,
      draw: (A) => {
        const cols = ['#8fd0ff', '#8fd0ff', '#8fd0ff', '#f6bd62', '#ffffff'];
        for (const o of D.orbits) E.line(A, cam, E.partial(o.pts, wave ? clamp((b - 0.8 - o.k * 0.5) / 2.2) : 1), { occlude: true, color: '#cfe6ff', alpha: 0.22, width: 0.8 });
        D.links.forEach((l) => { const k = wave ? outCubic((b - 0.9 - hash(l.seed, 2) * 1.9) / 1.1) : 1; if (k > 0) E.line(A, cam, E.partial(l.pts, k), { occlude: true, color: cols[l.seed % cols.length], alpha: 0.36, width: 0.9 }); });
        A.globalCompositeOperation = 'lighter';
        D.links.forEach((l) => { const k = wave ? outCubic((b - 0.9 - hash(l.seed, 2) * 1.9) / 1.1) : 1; const u = (t * 0.6 + hash(l.seed, 1)) % 1; if (u < k) Globe.glow(A, cam, Globe.bead(l.pts, u), D.glowWhite, 13, 0.9); });
        A.globalCompositeOperation = 'source-over';
        const dur = beat * 2.2, kp = 1 + 1.1 * mu.hit('kick', t, 0.09);
        drawCities(A, cam, (c) => { if (!wave) return kp; const tI = T.fin + (1 - Math.pow(1 - clamp(c.dO / 185), 1 / 3)) * dur; return t >= tI ? 1 + 2.2 * P(t, tI, 0.09) : 0; }, alt);
        A.globalCompositeOperation = 'lighter';
        D.orbits.forEach((o) => { for (let j = 0; j < 5; j++) { const u = (t * 0.05 + j / 5 + o.k * 0.13) % 1; if (!wave || u < clamp((b - 0.8 - o.k * 0.5) / 2.2)) Globe.glow(A, cam, Globe.bead(o.pts, u), D.glowWhite, 12, 1); } });
        A.globalCompositeOperation = 'source-over';
        if (items) drawMarks(A, cam, t, items, alt);
      },
    });
    ctx.grade(g, { vig: 0.42 });
    const cur = items ? ticker(g, cam, t, items) : null;
    ctx.readout(g, { glyph: '網', era: cur ? cur.era : '現在', len: (2e6 * cam.foc) / cam.dist, label: '2,000 公里', slam: P(t, glyphAt, 0.1) });
  }
  function sceneHand(g, LY, t, ctx, u, t0) {
    const cam = E.makeCam({ eye: [0.0, -0.8 + 0.08 * u, -0.01], target: [0.0, 0, 0.005], fov: 36 });
    Cave.drawWall(g, cam);
    LY.clear(LY.A);
    Cave.drawHands(LY.A.g, cam, { gain: 1 + 0.5 * P(t, t0, 0.15) });
    LY.composite(g, LY.A, { glow: [[22, 0.22 + 0.5 * P(t, t0, 0.12)], [3, 0.2]], sharp: 1 });
    Cave.drawLight(g, cam, { flick: Math.sin(t * 9) * 0.5 });
    ctx.grade(g, { vig: 0.35 });
    ctx.readout(g, { glyph: '手', era: '約 4 萬年前', ...ctx.niceScale(cam.foc / cam.dist, 200), slam: P(t, t0, 0.1) });
  }
  function sceneFinale(g, LY, t, ctx) {
    const b = (t - T.fin) / beat, sh = SHOTS.find((s) => b >= s[0] && b < s[1]) || SHOTS[SHOTS.length - 1];
    const t0 = T.fin + sh[0] * beat, u = clamp((b - sh[0]) / (sh[1] - sh[0])), kick = mu.hit('kick', t, 0.1);
    const cap = CAP[sh[2]], slam = P(t, t0, 0.1), ro = (era) => ({ era, slam });
    const W = Wonders;
    if (sh[2] === 'globe') { const alt = 1.3e7 * (1 + 0.04 * u); globeLit(g, LY, t, ctx, { cam: Globe.camGeo({ at: [72 + u * 3, 20], alt, look: [68 + u * 3, 30], fov: 36, northUp: true, shift: [230, 110] }), alt, wave: true, glyphAt: T.fin, items: MS.NET_A }); }
    else if (sh[2] === 'wide') {                 // 1983 之後的連發：地球轉過去面對每一件事，每一拍往後退一階
      const bb = b - sh[0], kb = Math.floor(bb), us = clamp((kb + 0.8 * (1 - Math.pow(2, -(bb - kb) / 0.1)) + 0.2 * (bb - kb)) / (sh[1] - sh[0])), alt = 1.4e7 * Math.pow(1.5, us), at = track(MS.NET_B, t, beat * 1.6);
      globeLit(g, LY, t, ctx, { cam: Globe.camGeo({ at, alt, look: [at[0], at[1] + 4], fov: 36, northUp: true, shift: [300, 30] }), alt, glyphAt: t0, items: MS.NET_B });
    }
    else if (sh[2] === 'reroll') sceneReroll(g, LY, t, ctx, sh, b);
    else if (sh[2] === 't_silk' || sh[2] === 't_sea' || sh[2] === 't_rail') {     // 交通的三個鏡頭：回到第一部那顆地球，在那個年代的樣子
      const cfg = { t_silk: [T.sea - 7, [72, 30], 6.2e6, '路'], t_sea: [T.mach - 6, [62, 4], 1.45e7, '海'], t_rail: [T.quiet - 5, [12, 49], 3.4e6, '機'] }[sh[2]];
      const alt = cfg[2] * (1 - 0.07 * u), at = [cfg[1][0] + u * 3, cfg[1][1]], cam = Globe.camGeo({ at, alt, look: [at[0], at[1] + (sh[2] === 't_rail' ? 3 : 1.5)], fov: 36, northUp: true, shift: [120, 40] });
      earthP1(g, LY, cam, cfg[0] + (t - t0), alt, GEO(at[0], at[1], 0)); ctx.grade(g, { vig: 0.45 });
      ctx.readout(g, { glyph: cfg[3], era: cap[0], ...ctx.niceScale(cam.foc / alt, 200), slam });
    }
    else if (sh[2] === 't_air') { const alt = 1.15e7 * (1 - 0.06 * u); globeLit(g, LY, t, ctx, { cam: Globe.camGeo({ at: [118 + u * 4, 26], alt, look: [118 + u * 4, 30], fov: 36, northUp: true, shift: [120, 40] }), alt, glyphAt: t0 }); }
    else if (sh[2] === 'city') City.frame(g, LY, 0, ctx, { time: t * 4, fire: 1 + 0.9 * kick, lights: 1 + 0.25 * kick, cam: { eye: [300 - u * 26, -330 + u * 30, 150 - u * 12], target: [-10, 12, 40], fov: 36, shift: [40, 150] }, readout: ro('美索不達米亞') });
    else if (sh[2] === 'skyline') W.skyline(g, LY, t, ctx, { u, time: t * 4, pulse: kick, wake: 0.3 + 0.7 * sstep(0, 0.4, u), readout: ro('示意，不是真的城市') });
    else if (sh[2] === 'giza') W.giza(g, LY, t, ctx, { u, time: t, pulse: kick, readout: ro('埃及　吉薩') });
    else if (sh[2] === 'tiantan') W.tiantan(g, LY, t, ctx, { u, pulse: kick, readout: ro('中國　北京') });
    else if (sh[2] === 'taj') W.taj(g, LY, t, ctx, { u, time: t * 3, pulse: kick, readout: ro('印度　阿格拉') });
    else if (sh[2] === 'saturn') W.saturn(g, LY, t, ctx, { u, time: t, readout: ro('美國　甘迺迪角') });
    else if (sh[2] === 'hand') sceneHand(g, LY, t, ctx, u, t0);
    else if (sh[2] === 'home') sceneHome(g, LY, t, ctx, { plain: true, still: T.quiet + 4, slamAt: t0 });
    else if (W[sh[2]]) W[sh[2]](g, LY, t, ctx, { u, time: t, pulse: kick, readout: { slam } });
    if (b >= 92) return;                                                          // 最後的回顧連擊太快，不放大字
    if (cap) caption(g, cap, slam);
  }

  /** 全部重播一次：四萬年在十二秒裡再走一遍，每一件事在地球上亮起來 */
  function sceneReroll(g, LY, t, ctx, sh, b) {
    const bb = b - sh[0], kb = Math.floor(bb), us = clamp((kb + 0.8 * (1 - Math.pow(2, -(bb - kb) / 0.1)) + 0.2 * (bb - kb)) / (sh[1] - sh[0]));
    const alt = 1.5e7 * Math.pow(2.1, us), at = track(REROLL, t, beat * 2.4), cam = Globe.camGeo({ at, alt, look: [at[0], at[1] + 3], fov: 36, northUp: true, shift: [300, 20] });
    const tv = T.quiet + 40 + (t - (T.fin + sh[0] * beat)), kick = mu.hit('kick', t, 0.1);
    Globe.earth(g, LY, cam, {
      stars: 0.9, dotsG: 0.5 * (1 + 0.3 * kick), dotColor: '#cdbd9c', coast110: 0.32, rim: 0.85 + 0.5 * kick,
      draw: (A) => {
        for (const rt of ROUTES) growLine(A, cam, rt, tv, rt.sea ? { color: '#8cc8ff', width: 1.2, alpha: 0.5, dash: [3, 8], beads: 1, head: D.glowWhite, speed: 2.6 } : { color: '#f6bd62', width: 1.2, alpha: 0.55, beads: 1, speed: 2.2 });
        for (const v of VOY) growLine(A, cam, v, tv, { color: '#9fd8ff', width: 1.2, alpha: 0.5, dash: [7, 5], head: D.glowWhite, beads: 2, speed: 6 });
        for (const l of LINES) growLine(A, cam, l, tv, { color: l.cable ? '#8fd0ff' : '#ffe9c4', width: 1.1, alpha: 0.5, dash: l.cable ? [5, 4] : null, head: l.cable ? D.glowWhite : D.glowGold, beads: 1, speed: l.cable ? 26 : 9 });
        D.links.forEach((l) => E.line(A, cam, l.pts, { occlude: true, color: '#8fd0ff', alpha: 0.2 * us + 0.06, width: 0.8 }));
        drawCities(A, cam, () => 0.55 + 0.5 * us + 0.5 * kick, alt);
        drawMarks(A, cam, t, REROLL, alt);
      },
    });
    ctx.grade(g, { vig: 0.42 });
    const cur = ticker(g, cam, t, REROLL, { push: 0.03 });
    ctx.readout(g, { glyph: cur ? cur.level : '手', era: cur ? cur.era : '', ...ctx.niceScale(cam.foc / alt, 200), slam: 0 });
  }
  /** 結尾：退到地球只剩一個小球；清單的下一行是空的 */
  function sceneEnd(g, LY, t, ctx) {
    const u = clamp((t - T.end) / (T.dur - T.end)), age = t - T.end;
    const alt = 1.1e8 * (1 + 0.6 * u), cam = Globe.camGeo({ at: [60 - age * 0.5, 18], alt, look: [60 - age * 0.5, 18], fov: 25, northUp: true, shift: [330, -30] }), sun = sunOf(cam);
    Globe.earth(g, LY, cam, { stars: 0.8, sea: ['#10294a', '#0a1a30', '#050c18'], dotsG: 0.55, dotSize: 1.1, dotColor: '#eadcbd', sun, dark: 0.15, rimColor: '#a9ceff', rim: 1.1, rimSun: -2.45, glow: [[24, 0.5], [6, 0.3]],
      draw: (A) => { const p = GEO(-80.6, 28.57, 6e6 + age * 9e6); A.globalCompositeOperation = 'lighter'; Globe.glow(A, cam, p, D.glowWhite, 9, 0.9); A.globalCompositeOperation = 'source-over'; } });
    ctx.grade(g, { vig: 0.4 });
    // 清單的最後一行，和下面那一行空白
    const x = 104, y0 = 470, last = MS.NET_B[MS.NET_B.length - 1], a0 = sstep(0.15, 0.9, age);
    g.save(); g.textBaseline = 'alphabetic';
    g.globalAlpha = 0.9 * a0; g.textAlign = 'right'; g.font = `400 26px ${FONTF}`; g.letterSpacing = '1px'; g.fillStyle = KIND[last.kind]; g.fillText(last.year, x + 122, y0 - 4);
    g.textAlign = 'left'; g.fillStyle = '#efe4cf'; g.letterSpacing = EN ? '0.5px' : '3px'; g.font = `500 44px ${FONTF}`; g.fillText(last.label, x + 146, y0);
    const blink = 0.5 + 0.5 * Math.cos(age * Math.PI * 2 * (140 / 60 / 2));        // 游標：兩拍閃一次
    g.globalAlpha = a0 * (0.25 + 0.75 * blink); g.fillStyle = '#f6bd62'; g.fillRect(x + 146, y0 + 30, 3, 46);
    const a1 = sstep(beat * 3, beat * 3 + 1.2, age);
    g.globalAlpha = a1; g.fillStyle = '#fff4e2'; g.font = `500 ${EN ? 64 : 66}px ${FONTF}`; g.letterSpacing = EN ? '1px' : '9px'; g.fillText(TR('下一行，由我們來寫。'), x + 40, y0 + 200);
    g.restore();
    const out = sstep(T.dur - 3.2, T.dur - 0.4, t); if (out > 0) { g.fillStyle = `rgba(5,4,6,${out})`; g.fillRect(0, 0, 1920, 1080); }
  }

  /** 畫 t 這一刻。回傳後製要用的數字：{ zoom, dx, dy, flash } */
  function draw(g, LY, t, ctx) {
    const fx = { zoom: 0, dx: 0, dy: 0, flash: 0 };
    const inSil = (s) => s && t >= s[0] && t < s[1];
    if (inSil(T.sil0) || inSil(T.sil1) || inSil(T.sil3)) return fx;                              // 重擊之前：全黑
    if (inSil(T.sil2)) {                                                        // 終段之前：全黑，只留原點的那一點紅
      const cam = camHome(T.sil2[0]), p = cam.proj(GEO(LON0, LAT0, 20000));
      g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(City.S.glowFire, p[0] - 22, p[1] - 22, 44, 44); g.restore();
      return fx;
    }
    if (t < T.quiet) scenePart1(g, LY, t, ctx); else if (t < T.fin) sceneHome(g, LY, t, ctx); else if (t < T.end) sceneFinale(g, LY, t, ctx); else sceneEnd(g, LY, t, ctx);
    // 後製：重擊、每拍的呼吸、切鏡的一下
    let sh = 0;
    for (const [tt, z, s, f] of SLAMS) { fx.zoom += z * P(t, tt, 0.11); sh += s * P(t, tt, 0.08); fx.flash += f * P(t, tt, 0.05); }
    const quiet = (t >= T.quiet && t < T.fin) || t >= T.end;
    if (t < T.fire) fx.zoom += 0.004 * mu.hit('heart', t, 0.14);
    else if (t < T.city) { const tk = mu.hit('taiko', t, 0.11); fx.zoom += 0.014 * tk; sh += 2.6 * mu.hit('taiko', t, 0.05); fx.flash += 0.03 * mu.hit('taiko', t, 0.04); }
    else if (!quiet) { fx.zoom += 0.012 * mu.hit('kick', t, 0.11); sh += 2.4 * mu.hit('kick', t, 0.05); const r = mu.hit('roll', t, 0.03); sh += 3 * r; fx.flash += 0.07 * r * mu.hit('roll', t, 0.02); }
    else fx.zoom += 0.004 * mu.hit('heart', t, 0.14);
    if (t >= T.fin && t < T.end) for (const tc of CUTS) { fx.zoom += 0.022 * P(t, tc, 0.09); sh += 6 * P(t, tc, 0.05); }
    if (t >= T.fin + 64 * beat && t < T.end) for (const th of RHERO) { const k = P(t, th, 0.08); if (k > 0.01) { fx.zoom += 0.012 * k; sh += 3 * P(t, th, 0.05); fx.flash += 0.02 * P(t, th, 0.04); } }
    if (!quiet && t >= T.fire) for (const th of HEROES) { const k = P(t, th, 0.09); if (k > 0.01) { fx.zoom += 0.016 * k; sh += 5 * P(t, th, 0.05); fx.flash += 0.035 * P(t, th, 0.04); } }      // 大字的那幾件事：多一下
    const rk = SHOTS.find((x) => x[2] === 'saturn'); if (rk && t >= T.fin + rk[0] * beat && t < T.fin + rk[1] * beat) sh += 5;      // 火箭升空：整段都在震
    fx.dx = sh * (vnoise(t * 34, 1.3, 1) - 0.5) * 2; fx.dy = sh * (vnoise(t * 31, 7.7, 2) - 0.5) * 2;
    fx.zoom = Math.max(fx.zoom, sh / 420);
    return fx;
  }

  root.Film = { init, draw, camP1, get T() { return T; }, get mu() { return mu; }, get CUTS() { return CUTS; } };
})(typeof self !== 'undefined' ? self : this);
