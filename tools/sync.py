#!/usr/bin/env python3
"""量一支成片的「音畫對位」：畫面的變化有沒有落在音樂的拍子上、落得多準、多密。

    python3 sync.py 成片.mp4                         # 用片子自己的音軌
    python3 sync.py 成片.mp4 --audio 曲子.mp3         # 片子沒有音軌，或想用原曲
    python3 sync.py 成片.mp4 --analysis audio.json    # 已經有音樂分析（music.py 或 pdoom 的格式）
    python3 sync.py 成片.mp4 --analysis 原曲.json --estimate-offset   # 分析來自原曲，畫面可能差幾十毫秒
    python3 sync.py 成片.mp4 --json out.json --plot out.png

用途有兩個：拆解別人的片（它到底卡得多準、每拍放幾件事）；檢查自己的成片（我以為卡到了，量出來有沒有）。
`rhythm.py` 量的是畫面自己的節奏；這支量的是畫面和聲音的關係。

名詞：
  畫面事件：相鄰兩格的差異突然變大的那一格（切鏡、撞擊、閃光、字砸下來）
  切鏡：差異特別大的事件
  網格：下拍（每小節第一拍）、拍、半拍（八分音符）、四分之一拍（十六分音符）
  容許範圍：事件在拍點前半格到後一格半之內算對上（畫面只能在下一格才顯示出來，所以天生晚 0–1 格）
  碰巧命中率：事件隨機亂放時會對上的比例。**對位率要和它比才有意義。**

需要：ffmpeg、numpy、scipy、librosa（沒給 --analysis 時）
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np
from scipy.ndimage import median_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

W, H = 160, 90


def probe_fps(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True).stdout.strip()
    a, b = out.split('/')
    return float(a) / float(b)


def has_audio(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout.strip()
    return bool(out)


def frame_signal(path, fps):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={W}:{H}:flags=area,format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H * W).astype(np.float32)
    d = np.zeros(len(f), np.float32)
    d[1:] = np.abs(f[1:] - f[:-1]).mean(axis=1)
    return d, f.mean(axis=1)


def visual_events(d, fps):
    """畫面事件：差異是前後 1 秒中位數的好幾倍、而且是附近最大的那一格。"""
    floor = np.percentile(d, 5)
    x = np.maximum(d - floor, 0)
    med = median_filter(x, int(fps) | 1) + 0.15
    ev = []
    gap = max(2, int(round(fps * 0.1)))
    for i in range(2, len(x) - 2):
        if x[i] >= 2.5 * med[i] + 0.8 and x[i] == x[max(0, i - gap):i + gap + 1].max():
            ev.append((i / fps, float(x[i]), bool(x[i] > max(10.0, 7 * med[i]))))
    return ev, x


def align(times, grid, lo, hi):
    """每個事件到最近網格點的偏移（事件時間 − 網格時間），以及在 [lo, hi] 內的比例。"""
    if len(times) == 0 or len(grid) == 0:
        return np.array([]), 0.0
    g = np.asarray(grid)
    idx = np.clip(np.searchsorted(g, times), 1, len(g) - 1)
    off = np.where(np.abs(times - g[idx - 1]) <= np.abs(times - g[idx]), times - g[idx - 1], times - g[idx])
    return off, float(np.mean((off >= lo) & (off <= hi)))


def coverage(grid, times, lo, hi):
    """反過來：每個網格點（或每個鼓點）附近有沒有畫面事件。"""
    if len(grid) == 0:
        return None
    if len(times) == 0:
        return 0.0
    t = np.asarray(times)
    return float(np.mean([np.any((t - g >= lo) & (t - g <= hi)) for g in grid]))


def accents(A):
    """音樂的重音：響度在 50 毫秒內突然升高的時刻（不管有沒有固定速度都量得到）。回傳 [(時間, 升高多少)]，由強到弱。"""
    from scipy.signal import find_peaks
    if 'rms' not in A:
        return []
    r = np.asarray(A['rms'], float)
    f = A.get('fps', 100)
    lag = max(1, int(0.05 * f))
    rise = r - np.concatenate([np.full(lag, r[0]), r[:-lag]])
    pk, pr = find_peaks(rise, height=0.12, distance=int(0.15 * f))
    out = [((p - lag * 0.6) / f, float(h)) for p, h in zip(pk, pr['peak_heights'])]
    return sorted(out, key=lambda e: -e[1])


def fold(x, fps, grid, bins):
    """把畫面能量折疊到「一拍之內」或「一小節之內」的相位上（用實際的拍點內插，速度會變也成立）。"""
    g = np.asarray(grid)
    t = np.arange(len(x)) / fps
    ok = (t >= g[0]) & (t < g[-1])
    ph = np.interp(t[ok], g, np.arange(len(g))) % 1.0
    x = x[ok]
    b = np.minimum((ph * bins).astype(int), bins - 1)
    prof = np.array([x[b == i].mean() if np.any(b == i) else 0 for i in range(bins)])
    return prof / (prof.mean() + 1e-9)


def analyze(video, audio=None, analysis=None, offset=None, quiet=False, estimate_offset=False):
    fps = probe_fps(video)
    d, lum = frame_signal(video, fps)
    ev, x = visual_events(d, fps)
    dur = len(d) / fps
    if analysis:
        A = json.load(open(analysis))
    else:
        import music
        src = audio or video
        if not audio and not has_audio(video):
            raise SystemExit('這支影片沒有音軌，請用 --audio 指定曲子')
        A = music.analyze(src, quiet=True)
    P = A.get('beat_period') or 60 / A['bpm']
    beats = np.array(A['beats'])
    first = float(beats[0])
    down = np.array(A['downbeats'])
    kicks = np.array([t for t, _ in A['onsets'].get('kick', [])])
    snares = np.array([t for t, _ in A['onsets'].get('snare', [])])

    # 音軌和畫面可能差一個固定的時間（重新上傳、外接原曲）。找讓「大鼓附近的畫面變化」最大的位移。
    shift = 0.0
    if offset is not None:
        shift = offset
    else:
        tr = kicks if len(kicks) > 20 else beats
        # 片子自己的音軌也常和畫面差幾十毫秒（AAC 編碼會在開頭多出約 46 毫秒），所以一律估一次：
        # 自己的音軌只在 ±80 毫秒內找；外接原曲在 ±半拍內找（鼓點是週期性的，差一整拍分不出來，
        # 實際差超過半拍時用 --offset 手動給）。
        rng = P / 2 if (audio or estimate_offset) else 0.08
        best = (-1, 0.0)
        for s in np.arange(-rng, rng, 0.004):
            idx = np.round((tr + s) * fps).astype(int)
            idx = idx[(idx > 1) & (idx < len(x) - 2)]
            v = np.maximum(x[idx], x[idx + 1]).mean()
            if v > best[0]:
                best = (v, float(s))
        shift = best[1]
    ts = np.array([t for t, _, _ in ev]) - shift          # 畫面事件換算到音樂的時間軸
    cuts = np.array([t for t, _, c in ev if c]) - shift
    lo, hi = -0.5 / fps, 1.5 / fps
    win = hi - lo

    def subdivide(g, n):                    # 相鄰兩拍之間等分（速度分段變化時也成立）
        return np.sort(np.concatenate([g] + [g[:-1] + (g[1:] - g[:-1]) * k / n for k in range(1, n)]))
    grids = {'下拍': down, '拍': beats, '半拍': subdivide(beats, 2), '四分之一拍': subdivide(beats, 4)}
    span = max(1e-9, float(beats[-1] - beats[0]))
    spacing = {k: span / max(1, len(g) - 1) for k, g in grids.items()}
    rows = {}
    for name, g in grids.items():
        off_all, hit_all = align(ts, g, lo, hi)
        _, hit_cut = align(cuts, g, lo, hi)
        rows[name] = dict(events_on=round(hit_all, 3), cuts_on=round(hit_cut, 3), chance=round(min(1.0, win / spacing[name]), 3))
    off_beat, _ = align(ts, grids['半拍'], lo, hi)
    on = off_beat[(off_beat >= lo) & (off_beat <= hi)]

    sections = []
    for s in A.get('sections', []):
        a, b = s['start'], s['end']
        if b - a < 1.0:
            continue
        i, j = int(max(0, (a + shift) * fps)), int(min(len(x), (b + shift) * fps))
        if j <= i:
            continue
        nb = max(1e-9, (b - a) / P)
        e_in = ts[(ts >= a) & (ts < b)]
        k_in = kicks[(kicks >= a) & (kicks < b)]
        sections.append(dict(name=s['name'], start=round(a, 2), end=round(b, 2), audio_level=s.get('level'),
                             visual_energy=round(float(x[i:j].mean()), 2), events_per_beat=round(len(e_in) / nb, 2),
                             cuts=int(np.sum((cuts >= a) & (cuts < b))), kicks_per_beat=round(len(k_in) / nb, 2),
                             kick_coverage=None if len(k_in) < 4 else round(coverage(k_in, ts, lo, hi), 2)))
    # 每一拍的畫面能量 vs 音樂響度
    rms = np.array(A['rms']) if 'rms' in A else None
    corr = None
    if rms is not None:
        vb, ab = [], []
        for b0 in beats[:-1]:
            i, j = int((b0 + shift) * fps), int((b0 + P + shift) * fps)
            k, m = int(b0 * A.get('fps', 100)), int((b0 + P) * A.get('fps', 100))
            if 0 <= i < j <= len(x) and m <= len(rms) and m > k:
                vb.append(x[i:j].mean())
                ab.append(rms[k:m].mean())
        if len(vb) > 8:
            corr = round(float(np.corrcoef(vb, ab)[0, 1]), 2)

    acc = accents(A)
    acc_t = np.array(sorted(t for t, _ in acc))
    wa_lo, wa_hi = -1.0 / fps, 2.0 / fps                      # 重音的時間是估的，容許範圍放寬一點
    acc_stats = None
    if len(acc_t):
        dens = len(acc_t) / dur

        def near(times):
            return float(np.mean([np.any((t - acc_t >= wa_lo) & (t - acc_t <= wa_hi)) for t in times])) if len(times) else None
        top = lambda n: np.array([t for t, _ in acc[:n]])
        acc_stats = dict(
            accents=len(acc_t), per_minute=round(dens * 60, 1),
            cuts_on_accent=None if not len(cuts) else round(near(cuts), 3), events_on_accent=round(near(ts), 3),
            chance=round(min(1.0, dens * (wa_hi - wa_lo)), 3),
            top10_with_event=round(coverage(top(10), ts, wa_lo, wa_hi), 2), top10_with_cut=round(coverage(top(10), cuts, wa_lo, wa_hi), 2),
            top30_with_event=round(coverage(top(30), ts, wa_lo, wa_hi), 2), top30_with_cut=round(coverage(top(30), cuts, wa_lo, wa_hi), 2),
            all_with_event=round(coverage(acc_t, ts, wa_lo, wa_hi), 2),
        )
    sil = []
    for a, b in A.get('silences', []):
        i, j = int(max(0, (a + shift) * fps)), int(min(len(x), (b + shift) * fps))
        if j > i:
            sil.append(dict(start=a, end=b, visual_energy=round(float(x[i:j].mean()), 2), events=int(np.sum((ts >= a) & (ts < b)))))

    xs = np.roll(x, -int(round(shift * fps)))
    res = dict(
        video=os.path.basename(video), fps=round(fps, 3), duration=round(dur, 2), bpm=A['bpm'], beat_period=round(P, 4),
        audio_video_shift_s=round(shift, 3),
        visual_events=len(ts), cuts=len(cuts), events_per_beat=round(len(ts) / (dur / P), 2), events_per_minute=round(len(ts) / dur * 60, 1),
        tolerance_ms=[round(lo * 1000, 1), round(hi * 1000, 1)],
        on_grid=rows,
        offset_of_on_grid_events_ms=dict(median=round(float(np.median(on)) * 1000, 1) if len(on) else None, sd=round(float(np.std(on)) * 1000, 1) if len(on) else None),
        coverage=dict(downbeats=coverage(down, ts, lo, hi), beats=coverage(beats, ts, lo, hi), kicks=coverage(kicks, ts, lo, hi) if len(kicks) else None,
                      snares=coverage(snares, ts, lo, hi) if len(snares) else None, downbeat_cuts=coverage(down, cuts, lo, hi)),
        beat_profile=[round(float(v), 2) for v in fold(xs, fps, beats, 8)],
        bar_profile=[round(float(v), 2) for v in fold(xs, fps, down, 16)] if len(down) > 2 else None,
        energy_vs_loudness_corr=corr,
        accents=acc_stats, silences=sil, overall_visual_energy=round(float(x.mean()), 2),
        sections=sections,
    )
    res['coverage'] = {k: (None if v is None else round(v, 3)) for k, v in res['coverage'].items()}
    if not quiet:
        report(res)
    return res, dict(x=x, fps=fps, ts=ts, cuts=cuts, A=A, shift=shift)


def report(r):
    p = lambda *a: print(*a)
    p(f"{r['video']}　{r['duration']} 秒　{r['fps']} 格/秒　{r['bpm']} BPM（一拍 {r['beat_period']} 秒）")
    if r['audio_video_shift_s']:
        p(f"音軌和畫面差 {r['audio_video_shift_s']} 秒（已校正；自己的成片這個數字應該接近 0，不是的話先查編碼和合成）")
    p(f"畫面事件 {r['visual_events']} 個（其中切鏡 {r['cuts']}）　每拍 {r['events_per_beat']} 個　每分鐘 {r['events_per_minute']} 個")
    p(f"\n事件落在網格上的比例（容許 {r['tolerance_ms'][0]} 到 +{r['tolerance_ms'][1]} 毫秒；括號是亂放也會中的比例）")
    for k, v in r['on_grid'].items():
        p(f"  {k:<6}　全部事件 {v['events_on']*100:5.1f}%　切鏡 {v['cuts_on']*100:5.1f}%　（碰巧 {v['chance']*100:.1f}%）")
    o = r['offset_of_on_grid_events_ms']
    p(f"對上的事件，平均比拍點晚 {o['median']} 毫秒（±{o['sd']}）。一格是 {1000/r['fps']:.0f} 毫秒，晚 0 到一格是正常的")
    c = r['coverage']
    fmt = lambda v: '—' if v is None else f'{v*100:.0f}%'
    p(f"\n反過來看：下拍有畫面事件 {fmt(c['downbeats'])}（有切鏡 {fmt(c['downbeat_cuts'])}）　每一拍 {fmt(c['beats'])}　大鼓 {fmt(c['kicks'])}　小鼓 {fmt(c['snares'])}")
    p(f"一拍之內的畫面能量分布（8 等分，1.0 是平均）：{r['beat_profile']}")
    p(f"一小節之內（16 等分）：{r['bar_profile']}")
    p(f"每一拍的畫面能量和音樂響度的相關：{r['energy_vs_loudness_corr']}")
    a = r.get('accents')
    if a:
        p(f"\n不靠網格的量法：音樂的重音（響度突然升高）共 {a['accents']} 個，每分鐘 {a['per_minute']} 個")
        p(f"  切鏡落在重音上 {fmt(a['cuts_on_accent'])}　全部事件 {fmt(a['events_on_accent'])}　（碰巧 {a['chance']*100:.0f}%）")
        p(f"  最強的 10 個重音：有畫面事件 {fmt(a['top10_with_event'])}、有切鏡 {fmt(a['top10_with_cut'])}　最強的 30 個：{fmt(a['top30_with_event'])}、{fmt(a['top30_with_cut'])}　全部重音有畫面事件 {fmt(a['all_with_event'])}")
    if r.get('silences'):
        p(f"音樂安靜的區間，畫面在做什麼（全片平均畫面能量 {r['overall_visual_energy']}）：")
        for q in r['silences']:
            p(f"  {q['start']}–{q['end']} 秒　畫面能量 {q['visual_energy']}　事件 {q['events']} 個")
    p("\n段落　　　時間　　　　音樂響度　畫面能量　每拍事件　切鏡　每拍大鼓　大鼓有畫面事件")
    for s in r['sections']:
        kc = '—' if s['kick_coverage'] is None else f"{s['kick_coverage']*100:.0f}%"
        p(f"  {s['name']:<8} {s['start']:6.1f}–{s['end']:6.1f}　{str(s['audio_level']):>5}　{s['visual_energy']:7.2f}　{s['events_per_beat']:7.2f}　{s['cuts']:4d}　{s['kicks_per_beat']:7.2f}　{kc:>6}")


def plot(r, ctx, path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    A, x, fps, shift = ctx['A'], ctx['x'], ctx['fps'], ctx['shift']
    t = np.arange(len(x)) / fps - shift
    fig, ax = plt.subplots(2, 1, figsize=(26, 8), sharex=True)
    if 'rms' in A:
        ta = np.arange(len(A['rms'])) / A.get('fps', 100)
        ax[0].plot(ta, A['rms'], color='k', lw=0.6, label='音樂響度')
        if 'low' in A:
            ax[0].plot(ta, A['low'], color='tab:red', lw=0.5, label='低頻')
    ax[1].plot(t, x, color='tab:blue', lw=0.6)
    for c in ctx['cuts']:
        ax[1].axvline(c, color='tab:orange', lw=0.8, alpha=0.8)
    for d in A['downbeats']:
        for a in ax:
            a.axvline(d, color='gray', lw=0.3)
    for s in A.get('sections', []):
        for a in ax:
            a.axvline(s['start'], color='tab:red', lw=1.5)
        ax[0].text(s['start'] + 0.2, 1.03, s['name'], color='tab:red', fontsize=10)
    ax[1].set_ylim(0, np.percentile(x, 99.5) * 1.2)
    ax[1].set_xticks(np.arange(0, r['duration'], 5))
    fig.tight_layout()
    fig.savefig(path, dpi=70)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('--audio')
    ap.add_argument('--analysis')
    ap.add_argument('--offset', type=float, help='畫面比音樂晚幾秒')
    ap.add_argument('--estimate-offset', action='store_true', help='音樂分析來自另一個檔案（原曲）時，自動估畫面和音樂差多少（只在 ±半拍內找）')
    ap.add_argument('--json')
    ap.add_argument('--plot')
    a = ap.parse_args()
    res, ctx = analyze(a.video, a.audio, a.analysis, a.offset, estimate_offset=a.estimate_offset)
    if a.json:
        json.dump(res, open(a.json, 'w'), ensure_ascii=False, indent=1)
    if a.plot:
        plot(res, ctx, a.plot)
        print('圖：', a.plot)
