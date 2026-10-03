// music.js：讓畫面照著音樂的時間表演出。
//
// 核心觀念（學自 pdoom-video，MIT，Giacomo Magnanini；API 參考它的 engine/audio.ts 與 util.ts）：
//   畫面不是「聽」音樂的響度來動，而是照一張事先算好的時間表演出。
//   1. 音樂的資料（拍點、下拍、段落、鼓點事件）來自 scripts/music.py 的分析，或來自自己寫配樂時輸出的 JSON
//   2. 每一幕開頭把「第幾拍、哪個事件」換成有名字的時間（錨點）
//   3. 每個動作寫成「距離某個錨點過了多久」的純函式：Mu.pulse(t, 錨點, 半衰期)
//
// 用法：
//   const mu = Mu.load(audioJson);          // audioJson 是 music.py 或 scorekit 輸出的物件
//   const B = (i) => mu.timeOfBeat(i);      // 第 i 拍的時間
//   const hit = Mu.pulse(t, B(8), 0.08);    // 第 8 拍打下去，半衰期 80 毫秒
//   const breathe = mu.beatPulse(t, 0.12);  // 每一拍自動脈動
//   const k = mu.hit('kick', t, 0.12);      // 大鼓事件的衰減脈衝
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mu = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 衰減脈衝：t0 之前是 0，t0 那一刻是 1，之後每過 halfLife 秒減半。所有「打擊」都用它。 */
  function pulse(t, t0, halfLife) {
    const d = t - t0;
    return d < 0 ? 0 : Math.pow(0.5, d / halfLife);
  }

  /** 一串事件的脈衝取最大值（或加總）。times 要由小到大。weights 可省略。 */
  function pulses(t, times, halfLife, weights, sum) {
    let v = 0;
    for (let i = times.length - 1; i >= 0; i--) {
      const d = t - times[i];
      if (d < 0) continue;
      if (d > halfLife * 10) break;
      const p = (weights ? weights[i] : 1) * Math.pow(0.5, d / halfLife);
      v = sum ? v + p : Math.max(v, p);
    }
    return v;
  }

  /** 打擊的三個量級（單位：1920×1080 的像素與比例）。數字來自 pdoom 的原始碼統計，見 references/音畫同步.md。 */
  const HIT = {
    breath: { zoom: 0.01, shake: 2, flash: 0, hlZoom: 0.12, hlShake: 0.06 },        // 每拍的呼吸
    accent: { zoom: 0.025, shake: 7, flash: 0.02, hlZoom: 0.09, hlShake: 0.05 },    // 一個字、一個音節、一個物件落下
    slam: { zoom: 0.05, shake: 22, flash: 0.25, hlZoom: 0.1, hlShake: 0.08 },       // 段落的重擊，每一幕最多一到三次
  };

  function load(j) {
    const beats = j.beats.slice();
    const downbeats = (j.downbeats || []).slice();
    const fps = j.fps || 100;
    const onsets = j.onsets || j.events || {};
    const n = beats.length;
    const lastP = n > 1 ? beats[n - 1] - beats[n - 2] : 60 / (j.bpm || 120);
    const firstP = n > 1 ? beats[1] - beats[0] : lastP;

    function idx(arr, t) {          // arr 裡最後一個 <= t 的位置（-1 表示都比 t 大）
      let lo = 0, hi = arr.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; }
      return lo - 1;
    }
    /** 連續的拍數：第一拍是 0，拍和拍之間是小數。速度分段變化也成立。 */
    function beatAt(t) {
      if (n < 2) return (t - (beats[0] || 0)) / lastP;
      if (t <= beats[0]) return (t - beats[0]) / firstP;
      if (t >= beats[n - 1]) return n - 1 + (t - beats[n - 1]) / lastP;
      const i = idx(beats, t);
      return i + (t - beats[i]) / (beats[i + 1] - beats[i]);
    }
    /** 第 i 拍的時間，i 可以是小數（i=4.5 是第 4、5 拍的正中間）。 */
    function timeOfBeat(i) {
      if (i <= 0) return beats[0] + i * firstP;
      if (i >= n - 1) return beats[n - 1] + (i - (n - 1)) * lastP;
      const k = Math.floor(i);
      return beats[k] + (beats[k + 1] - beats[k]) * (i - k);
    }
    function barAt(t) {
      const d = downbeats;
      if (d.length < 2) return beatAt(t) / 4;
      if (t <= d[0]) return (t - d[0]) / (d[1] - d[0]);
      const m = d.length - 1;
      if (t >= d[m]) return m + (t - d[m]) / (d[m] - d[m - 1]);
      const i = idx(d, t);
      return i + (t - d[i]) / (d[i + 1] - d[i]);
    }
    const timeOfBar = (i) => {
      const d = downbeats, m = d.length - 1;
      if (m < 1) return timeOfBeat(i * 4);
      if (i <= 0) return d[0] + i * (d[1] - d[0]);
      if (i >= m) return d[m] + (i - m) * (d[m] - d[m - 1]);
      const k = Math.floor(i);
      return d[k] + (d[k + 1] - d[k]) * (i - k);
    };
    /** 把一個時間吸到網格上。div=1 拍、2 半拍、4 四分之一拍；mode: 'near' 最近、'floor' 往前、'ceil' 往後。 */
    function snap(t, div = 1, mode = 'near') {
      const b = beatAt(t) * div;
      const k = mode === 'floor' ? Math.floor(b + 1e-6) : mode === 'ceil' ? Math.ceil(b - 1e-6) : Math.round(b);
      return timeOfBeat(k / div);
    }
    /** 「上一拍」的脈衝：每一拍自動打一下。div=2 是每半拍。 */
    function beatPulse(t, halfLife = 0.12, div = 1) {
      const b = beatAt(t) * div;
      return pulse(t, timeOfBeat(Math.floor(b + 1e-9) / div), halfLife);
    }
    function barPulse(t, halfLife = 0.18) {
      return pulse(t, timeOfBar(Math.floor(barAt(t) + 1e-9)), halfLife);
    }
    /** 一拍一階的階梯：整數部分是第幾階，小數部分用 ease 補（ease 省略時是硬跳）。 */
    function stair(t, ease, div = 1) {
      const b = beatAt(t) * div, k = Math.floor(b);
      return k + (ease ? ease(b - k) : 0);
    }
    /** 某一類事件（'kick'、'snare'、'hat'、自訂名字）在 [t0, t1) 之間的清單：[[時間, 強度], ...] */
    function events(kind, t0 = -Infinity, t1 = Infinity) {
      return (onsets[kind] || []).filter((e) => e[0] >= t0 && e[0] < t1);
    }
    /** 某一類事件的衰減脈衝（取最近幾個裡最大的），已乘上事件強度。 */
    function hit(kind, t, halfLife = 0.11) {
      const list = onsets[kind];
      if (!list || !list.length) return 0;
      let lo = 0, hi = list.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] <= t) lo = m + 1; else hi = m; }
      let v = 0;
      for (let i = lo - 1; i >= 0 && i >= lo - 6; i--) {
        const dt = t - list[i][0];
        if (dt > halfLife * 8) break;
        v = Math.max(v, (list[i][1] ?? 1) * Math.pow(0.5, dt / halfLife));
      }
      return v;
    }
    /** 響度包絡（0..1）。pdoom 全片沒有用到它：同步靠事件，不靠響度。只在想讓背景跟著音樂緩慢起伏時用。 */
    function env(name, t) {
      const a = j[name] || (j.features && j.features[name]);
      if (!a || !a.length) return 0;
      const x = t * fps, i = Math.floor(x);
      if (i < 0) return a[0];
      if (i >= a.length - 1) return a[a.length - 1];
      return a[i] * (1 - (x - i)) + a[i + 1] * (x - i);
    }
    const section = (t) => (j.sections || []).find((s) => t >= s.start && t < s.end) || null;

    return {
      raw: j, duration: j.duration, bpm: j.bpm, beats, downbeats, sections: j.sections || [], tempoMap: j.tempo_map || [],
      beatAt, timeOfBeat, barAt, timeOfBar, snap, beatPulse, barPulse, stair, events, hit, env, section,
      beatPhase: (t) => { const b = beatAt(t); return b - Math.floor(b); },
      barPhase: (t) => { const b = barAt(t); return b - Math.floor(b); },
    };
  }

  return { load, pulse, pulses, HIT };
});
