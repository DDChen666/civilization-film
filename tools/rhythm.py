#!/usr/bin/env python3
"""把一支影片的「節奏」量成數字。參考片和自己的草稿都用它：先量再做，做完再量。

    python3 rhythm.py 影片.mp4 [--json out.json] [--cuts 1.6,3.0,...]

輸出：
  能量圖   每 1/12 秒一個字元（一列 4 秒）。空白＝完全靜止，@＝硬切。
  still    完全靜止的比例（看起來像投影片的片，通常低於 0.1；有呼吸的片 0.25–0.55）
  low      幾乎不動的比例
  cuts     硬切的時間
  shots    鏡頭長度（硬切之間；也可以用 --cuts 自己給段落邊界）與變異係數 CV
  bursts   1.5 秒內有 3 次以上大變化的時段（重拍連擊）
  quiet    最長的安靜時段

判讀（門檻來自公開的片與自己做過的片，是提醒不是定律）：
  CV < 0.25            → 節拍器：每個鏡頭一樣長，讀起來像投影片
  still < 0.15         → 畫面從不停下來，重點沒有落點
  沒有 ≥ 1 秒的安靜段    → 缺少「停一下」
  全片能量幾乎一樣高     → 沒有起伏
需要：ffmpeg、numpy
"""
import argparse
import json
import subprocess
import sys

import numpy as np

RATE = 12          # 每秒取樣數
W, H = 320, 180    # 縮小後再比較：只看大的變化
STILL, LOW, CUT = 0.5, 2.0, 28.0
RAMP = " .:-=+*#%@"


def frames(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={RATE},scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)


def analyse(path, given_cuts=None):
    f = frames(path)
    e = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))       # 相鄰兩格的平均差（0–255）
    e = np.concatenate([[0.0], e])
    t = np.arange(len(e)) / RATE
    dur = len(e) / RATE
    # 底片顆粒、壓縮雜訊會讓「完全靜止」量不到：先估雜訊底（第 5 百分位），再從它往上算
    floor = float(np.percentile(e[1:], 5)) if len(e) > 2 else 0.0
    e = np.maximum(e - floor, 0.0)
    # 起伏：每秒平均能量的變異係數。越高代表動與靜的對比越大
    sec = np.array([e[i:i + RATE].mean() for i in range(0, len(e) - RATE + 1, RATE)]) if len(e) >= RATE else e
    energy_cv = float(sec.std() / (sec.mean() + 1e-6))
    # 硬切：差異很大，而且前後都沒那麼大（漸變不算）
    cuts = [float(t[i]) for i in range(1, len(e) - 1) if e[i] > CUT and e[i] > 2.5 * max(e[i - 1], e[i + 1], 1.0)]
    bounds = sorted(given_cuts) if given_cuts else cuts
    edges = [0.0] + [c for c in bounds if 0 < c < dur] + [dur]
    shots = np.diff(edges)
    cv = float(shots.std() / shots.mean()) if len(shots) > 1 else 0.0
    # 連擊：1.5 秒內 ≥ 3 次大變化
    big = [float(t[i]) for i in range(len(e)) if e[i] > 12]
    bursts, i = [], 0
    while i < len(big):
        j = i
        while j + 1 < len(big) and big[j + 1] - big[i] <= 1.5:
            j += 1
        # 把連續的大變化合併成事件後再數
        ev = [big[i]]
        for k in range(i + 1, j + 1):
            if big[k] - ev[-1] > 0.2:
                ev.append(big[k])
        if len(ev) >= 3:
            bursts.append([round(ev[0], 2), round(ev[-1], 2)])
            i = j + 1
        else:
            i += 1
    # 最長安靜段
    best, cur, start, qs = 0, 0, 0.0, 0.0
    for i, v in enumerate(e):
        if v < LOW:
            if cur == 0:
                start = t[i]
            cur += 1
            if cur > best:
                best, qs = cur, start
        else:
            cur = 0
    rows = []
    per = RATE * 4
    for r in range(0, len(e), per):
        chunk = e[r:r + per]
        s = "".join(RAMP[min(len(RAMP) - 1, int(np.log2(v + 1) * 1.9))] if v >= STILL else " " for v in chunk)
        rows.append(f"{r / RATE:6.1f}s |{s.ljust(per)}|")
    res = {
        "duration": round(dur, 2),
        "still": round(float((e < STILL).mean()), 3),
        "low": round(float((e < LOW).mean()), 3),
        "mean_energy": round(float(e.mean()), 2),
        "energy_cv": round(energy_cv, 2),
        "noise_floor": round(floor, 2),
        "cuts_per_min": round(len(cuts) / dur * 60, 1),
        "bursts_per_min": round(len(bursts) / dur * 60, 1),
        "cuts": [round(c, 2) for c in cuts],
        "shots": [round(float(s), 2) for s in shots],
        "shot_cv": round(cv, 3),
        "bursts": bursts,
        "longest_quiet": {"start": round(float(qs), 2), "seconds": round(best / RATE, 2)},
        "map": rows,
    }
    notes = []
    if len(shots) >= 4 and cv < 0.25:
        notes.append(f"鏡頭長度幾乎一樣（CV {cv:.2f} < 0.25）：節拍器，容易讀成投影片")
    if energy_cv < 0.6:
        notes.append(f"能量起伏小（{energy_cv:.2f} < 0.6）：全片同一個速度，沒有動靜對比")
    if best / RATE < 1.0:
        notes.append("沒有 ≥ 1 秒的安靜段：缺少「停一下」")
    if res["still"] > 0.7:
        notes.append(f"大部分時間靜止（still {res['still']:.2f}）：可能沉悶")
    res["notes"] = notes
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--json")
    ap.add_argument("--cuts", help="自己給段落邊界（秒，逗號分隔），用來算鏡頭長度")
    a = ap.parse_args()
    given = [float(x) for x in a.cuts.split(",")] if a.cuts else None
    r = analyse(a.video, given)
    print("\n".join(r["map"]))
    print(f"\nstill: {r['still']}   low: {r['low']}   平均能量: {r['mean_energy']}   起伏: {r['energy_cv']}   雜訊底: {r['noise_floor']}   長度: {r['duration']}s")
    print(f"cuts({len(r['cuts'])}，每分鐘 {r['cuts_per_min']}): {' '.join(str(c) for c in r['cuts'])}")
    print(f"shots: {r['shots']}  CV={r['shot_cv']}")
    print(f"bursts: {len(r['bursts'])} 段（每分鐘 {r['bursts_per_min']}）   最長安靜段: {r['longest_quiet']['seconds']}s（從 {r['longest_quiet']['start']}s）")
    for n in r["notes"]:
        print("⚠ " + n)
    if a.json:
        json.dump(r, open(a.json, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.exit(main())
