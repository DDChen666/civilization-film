#!/usr/bin/env python3
"""文明片的配樂（草稿一）。同時輸出畫面要用的時間表 data/audio.json。
    python3 score.py            → audio/score.wav、data/audio.json

想做到的感覺（用戶給的參考是 Immediate Music 的〈Tales of the Electric Romeo〉）：強烈、澎湃、一層一層堆上去。
做法：速度固定 140，C 小調四個和弦（Cm–Ab–Eb–Bb）一路不變，每八小節加一層樂器；
      安靜六小節；終段把同樣四個和弦換成從 Eb 開始（聽起來從暗轉亮），最後八小節再升一個全音。
我聽不到。頻段、響度、每一段的大小聲是量出來的。
"""
import numpy as np
from scipy import signal
import scorekit as K
from scorekit import Score, midi, saw, sine, lp, hp, bp, decay, SR

rng = np.random.default_rng(11)
BPM = 140
INTRO, LEVEL, N_LEVELS, QUIET, FINALE, OUTRO = 4, 8, 6, 6, 24, 2
sc = Score([(INTRO + LEVEL * N_LEVELS + QUIET + FINALE + OUTRO, BPM)], tail=5.0)
B_L = [INTRO + LEVEL * i for i in range(N_LEVELS)]        # 每一層的第一個小節
B_QUIET = INTRO + LEVEL * N_LEVELS
B_FIN = B_QUIET + QUIET
B_END = B_FIN + FINALE
NAMES = ['火', '田', '城', '路', '海', '機']

CH = {
    'Cm': dict(root=36, pad=[48, 55, 60, 63, 67], ost=[60, 67, 72, 75]),
    'Ab': dict(root=32, pad=[44, 51, 56, 60, 63], ost=[56, 63, 68, 72]),
    'Eb': dict(root=39, pad=[51, 58, 63, 67, 70], ost=[63, 70, 75, 79]),
    'Bb': dict(root=34, pad=[46, 53, 58, 62, 65], ost=[58, 65, 70, 74]),
}
PROG_MIN = ['Cm', 'Ab', 'Eb', 'Bb']
PROG_MAJ = ['Eb', 'Bb', 'Cm', 'Ab']
# 主題：（音高, 拍數）。小調版用在第一部，大調版用在終段。兩個版本的輪廓一樣：一句比一句高
THEME_MIN = [[(67, 1), (72, 1), (75, 2)], [(75, 1.5), (77, .5), (75, 1), (72, 1)], [(75, 1), (79, 1), (82, 2)], [(82, 1.5), (80, .5), (77, 1), (74, 1)],
             [(67, 1), (72, 1), (75, 1), (79, 1)], [(84, 2), (80, 1), (75, 1)], [(79, 1), (82, 1), (87, 2)], [(86, 3), (82, 1)]]
THEME_MAJ = [[(70, 1), (75, 1), (79, 2)], [(77, 1.5), (79, .5), (77, 1), (74, 1)], [(75, 1), (79, 1), (84, 2)], [(82, 1.5), (80, .5), (79, 1), (75, 1)],
             [(70, 1), (75, 1), (79, 1), (82, 1)], [(86, 2), (82, 1), (77, 1)], [(79, 1), (84, 1), (87, 2)], [(89, 2), (86, 1), (89, 1)]]


# ───────── 這支片自己的樂器
def env_adsr(n, a, r, hold=1.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.clip((n / SR - t) / r, 0, 1) * hold

_cache = {}
def cached(key, fn):
    if key not in _cache:
        _cache[key] = fn()
    return _cache[key]

def taiko_sound(size=1.0):
    """大鼓：低的鼓身 + 鼓皮的悶響 + 鼓棒的一下。size 越大越低越長。"""
    n = int(1.4 * SR); t = np.arange(n) / SR
    f0 = 62 / size
    body = sine(f0 + 70 * np.exp(-t / 0.035), n) * decay(n, 0.34 * size)
    skin = bp(rng.standard_normal(n), 120, 1400) * decay(n, 0.075) * 1.5 + sine(f0 * 2.9, n) * decay(n, 0.09) * 0.35
    stick = bp(rng.standard_normal(n) * decay(n, 0.006), 1500, 5000) * 0.7
    room = bp(rng.standard_normal(n), 200, 1600) * decay(n, 0.28) * 0.3
    return np.tanh((body * 0.95 + skin + stick + room) * 1.5) * 0.8

def rim_sound():
    """敲鼓框的「喀」：短、亮，小喇叭上也聽得到節奏。"""
    n = int(0.12 * SR)
    x = bp(rng.standard_normal(n), 900, 4200) * decay(n, 0.012) + sine(1150, n) * decay(n, 0.018) * 0.5 + sine(2470, n) * decay(n, 0.01) * 0.3
    return x * 0.5

def chug_sound(m, dur=0.16, bright=1.0):
    """低音弦的短弓：幾把鋸齒波疊在一起，很快地收掉。"""
    n = int((dur + 0.12) * SR); f = midi(m)
    x = sum(saw(f * (1 + d), n, rng.random()) for d in (-0.006, 0.0, 0.007)) / 3 + saw(f * 2.002, n, rng.random()) * 0.5
    e = np.minimum(1, np.arange(n) / (0.006 * SR)) * decay(n, dur * 0.55)
    return (lp(x, 900 * bright, 2) * 0.9 + bp(x, 900, 2600) * 0.35 * bright) * e * 0.6

def ost_sound(m, dur=0.11):
    """高音弦的快速音型（跳弓）。"""
    n = int((dur + 0.1) * SR); f = midi(m)
    x = sum(saw(f * (1 + d), n, rng.random()) for d in (-0.004, 0.003, 0.009)) / 3
    e = np.minimum(1, np.arange(n) / (0.004 * SR)) * decay(n, dur * 0.5)
    return bp(x, 350, 5200, 2) * e * 0.55

def brass_sound(m, dur, power=1.0):
    """銅管：鋸齒波疊起來，濾波器跟著音量打開（吹得越用力越亮），尾段加一點抖音。"""
    n = int((dur + 0.25) * SR); t = np.arange(n) / SR; f = midi(m)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.3 * t) * np.clip((t - 0.22) / 0.3, 0, 1)
    x = sum(saw(f * (1 + d) * vib, n, rng.random()) for d in (-0.005, -0.002, 0.0, 0.003, 0.006)) / 5
    x = x + saw(f * 0.5 * vib, n, rng.random()) * 0.45                       # 低八度的法國號
    e = np.minimum(1, t / 0.05) ** 0.7 * np.clip((dur + 0.25 - t) / 0.22, 0, 1) * (0.82 + 0.18 * np.exp(-t / 0.25))
    dark, mid_, bright = lp(x, 520, 2), lp(x, 1500, 2), lp(x, 3600 * power, 2)
    k = e * power
    y = dark * (1 - k) * 0.9 + mid_ * 0.9 + bright * k * 0.75
    return np.tanh(y * e * 1.6) * 0.55

def choir_sound(notes, dur, attack=0.28, release=0.9):
    """合唱的「啊」：鋸齒波過三個共振峰。立體聲。"""
    n = int((dur + release) * SR); t = np.arange(n) / SR
    L, R = np.zeros(n), np.zeros(n)
    for m in notes:
        for v in range(5):
            vib = 1 + 0.006 * np.sin(2 * np.pi * (4.6 + rng.random() * 1.2) * t + rng.random() * 6.28)
            x = saw(midi(m + (v - 2) * 0.07) * vib, n, rng.random())
            pan = v / 4
            L += x * (1 - pan); R += x * pan
    st = np.stack([L, R], axis=1) / (len(notes) * 2.5)
    st = st + rng.standard_normal((n, 2)) * 0.02                           # 一點氣聲
    y = bp(st, 560, 880, 2) * 1.0 + bp(st, 1000, 1350, 2) * 0.55 + bp(st, 2400, 3200, 2) * 0.22 + lp(st, 420, 2) * 0.25
    return y * (np.minimum(1, t / attack) * np.clip((dur + release - t) / release, 0, 1))[:, None] * 1.5

def strings_sound(notes, dur, attack=0.18, release=0.5, cutoff=3200):
    return K.pad_sound(notes, dur, cutoff=cutoff, attack=attack, release=release, voices=7, detune=0.14)

def crash_sound(dur=2.6):
    n = int(dur * SR)
    x = hp(rng.standard_normal(n), 3200, 2) * decay(n, dur * 0.28) + bp(rng.standard_normal(n), 5000, 9000) * decay(n, dur * 0.4) * 0.5
    return x * np.minimum(1, np.arange(n) / (0.002 * SR)) * 0.3

def braam_sound(m, dur=2.6):
    """預告片的低音銅管長音：很低、很粗、慢慢收。"""
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(m)
    x = sum(saw(f * k * (1 + d), n, rng.random()) for k in (1, 2) for d in (-0.008, 0.0, 0.009)) / 6 + sine(f * 0.5, n) * 0.5
    e = np.minimum(1, t / 0.03) * decay(n, dur * 0.42)
    y = lp(x, 300 + 1700 * e, 2) if False else (lp(x, 420, 2) * (1 - e) + lp(x, 1900, 2) * e)
    return np.tanh(y * e * 3.2) * 0.6

def roll(t0, t1, n_start=4, n_end=8, s0=0.25, s1=1.0):
    """小鼓滾奏：從 t0 到 t1 越來越密、越來越大聲。"""
    t = t0
    while t < t1 - 1e-4:
        k = (t - t0) / (t1 - t0)
        sc.add('drums', K.snare_sound(), t, 0.8 * (s0 + (s1 - s0) * k ** 1.5), small=0.3)
        sc.event('roll', t, s0 + (s1 - s0) * k)
        t += (60 / BPM) / (n_start + (n_end - n_start) * k)

def taiko(t, s=1.0, size=1.0, pan=0.0, ev=True):
    x = cached(('taiko', size), lambda: taiko_sound(size))
    sc.add('drums', x, t, 0.78 * s, pan=pan, small=0.2, big=0.22)
    sc.add('drums', x, t + 0.011, 0.4 * s, pan=-pan * 0.8 + 0.2, big=0.2)       # 第二個鼓手慢一點點
    if ev: sc.event('taiko', t, s)

def rim(t, s=1.0, pan=0.0):
    sc.add('drums', cached('rim', rim_sound), t + rng.normal(0, 0.002), 1.8 * s * (0.8 + rng.random() * 0.4), pan=pan, small=0.3, big=0.08)
    sc.event('rim', t, s)

def chug(t, m, s=1.0, bright=1.0):
    j = rng.normal(0, 0.003)
    sc.add('bass', cached(('chug', m, round(bright, 1)), lambda: chug_sound(m, bright=bright)), t + j, 1.5 * s * (0.9 + rng.random() * 0.2), small=0.15)
    sc.add('mid', cached(('chug8', m + 12), lambda: chug_sound(m + 12, bright=1.5)), t + j, 1.25 * s, pan=-0.4, small=0.25)
    sc.add('mid', cached(('chug8', m + 24), lambda: chug_sound(m + 24, bright=1.6)), t + j + 0.004, 0.7 * s, pan=0.4, small=0.25)
    sc.event('chug', t, s)

def ost(t, m, s=1.0, pan=0.3):
    sc.add('mid', cached(('ost', m), lambda: ost_sound(m)), t + rng.normal(0, 0.003), s * (0.85 + rng.random() * 0.3), pan=pan, small=0.3, big=0.1)

def brass(t, m, beats, s=1.0, power=1.0, ev=True):
    dur = beats * 60 / BPM * 0.94
    sc.add('mid', cached(('brass', m, round(dur, 3), round(power, 1)), lambda: brass_sound(m, dur, power)), t, s, small=0.1, big=0.35)
    if ev: sc.event('theme', t, s)

def crash(t, s=1.0):
    sc.add('fx', cached('crash', crash_sound), t, s, pan=0.15, big=0.3); sc.event('crash', t, s)

def braam(t, m, s=1.0):
    sc.add('bass', cached(('braam', m), lambda: braam_sound(m)), t, s, big=0.35); sc.event('braam', t, s)

def bar_drums(b, level, tr=0, fill=False, kick4=False, hats=0):
    """一個小節的鼓。level 決定有哪些層。"""
    T = lambda beat: sc.t(b, beat)
    cell = [0, 1.5, 3] if not fill else [0, 1.5, 3, 3.5]            # 3+3+2 的大鼓型
    for i, beat in enumerate(cell):
        taiko(T(beat), s=(1.0 if beat == 0 else 0.72) * min(1, 0.55 + level * 0.12), size=1.25 if beat == 0 else 1.0, pan=(-0.45 if i % 2 else 0.45))
    for i in range(8):                                                # 鼓框：沒有大鼓的那幾個八分音符
        if i / 2 not in cell: rim(T(i / 2), s=0.5 + 0.06 * min(level, 5), pan=0.5 if i % 2 else -0.5)
    if level >= 1:
        for i in range(8): rim(T(i / 2 + 0.25), s=0.22 + 0.03 * min(level, 5), pan=-0.3 if i % 2 else 0.3)
    if level >= 2:
        for beat in ([0, 1, 2, 3] if kick4 else [0, 2]):
            sc.kick(T(beat), 0.85)
        sc.snare(T(1), 0.8); sc.snare(T(3), 0.9)
    if hats:
        for i in range(4 * hats):
            sc.hat(T(i / hats), open_=(hats == 2 and i % 2 == 1 and level >= 4), s=0.7 if i % hats else 1.0)

def bar_harmony(b, chord, level, tr=0, o16=False):
    T = lambda beat: sc.t(b, beat)
    c = CH[chord]
    if level >= 1:                                                   # 低音弦：八分音符，3+3+2 的重音
        acc = [1, .55, .6, .9, .55, .6, .9, .6]
        for i in range(8):
            chug(T(i / 2), c['root'] + tr, s=acc[i] * (0.75 + 0.07 * level), bright=0.8 + 0.12 * level)
        sc.bass(T(0), c['root'] + tr - 12 if c['root'] + tr - 12 >= 26 else c['root'] + tr, 60 / BPM * 3.6, 0.7)
    if level >= 2:                                                   # 中音弦的和弦重音：跟著大鼓的 3+3+2
        for beat in (0, 1.5, 3):
            for k_, m in enumerate(c['pad'][2:]):
                sc.add('mid', cached(('stab', m + tr), lambda: chug_sound(m + tr, dur=0.22, bright=1.7)), T(beat) + rng.normal(0, 0.003), 0.5 + 0.05 * level, pan=(-0.5, 0.0, 0.5)[k_], small=0.3, big=0.1)
    if level >= 3:                                                   # 高音弦：十六分音符的分解和弦
        pat = [0, 1, 2, 1, 3, 1, 2, 1]
        for i in range(16):
            ost(T(i / 4), c['ost'][pat[i % 8]] + tr, s=(0.8 if i % 4 else 1.0) * (0.7 + 0.1 * level), pan=0.6 if i % 2 else -0.5)
    if level >= 4:                                                   # 合唱與弦樂的長音
        sc.add('mid', choir_sound([m + tr for m in c['pad'][1:]], 60 / BPM * 4, release=0.5), T(0), 0.5 + 0.06 * level, big=0.5)
        sc.add('mid', strings_sound([m + tr + 12 for m in c['pad'][2:]], 60 / BPM * 4), T(0), 0.32, big=0.35)

def play_theme(b0, theme, tr=0, s=1.0, power=1.0, octave=False):
    for i, bar in enumerate(theme):
        beat = 0
        for m, d in bar:
            brass(sc.t(b0 + i, beat), m + tr, d, s=s, power=power)
            if octave: brass(sc.t(b0 + i, beat), m + tr - 12, d, s=s * 0.6, power=power, ev=False)
            beat += d


# ═════════ 引子（手）：一個長音、心跳
sc.section('手', 0, INTRO)
sc.add('mid', strings_sound([36, 48, 55, 60], sc.t(INTRO) - 0.2, attack=3.0, release=0.3, cutoff=2000), 0.0, 0.55, big=0.5)
for b in range(INTRO):
    for beat, s in ((0, 0.5), (0.5, 0.32)):
        taiko(sc.t(b, beat), s=s * (0.7 + 0.12 * b), size=1.5, ev=False); sc.event('heart', sc.t(b, beat), s)
sc.riser(sc.t(INTRO, -0.5), 60 / BPM * 5)
sc.silence(sc.t(INTRO, -0.5), sc.t(INTRO))

# ═════════ 第一部：六層，每層八小節，每層多一樣東西
for L, b0 in enumerate(B_L):
    sc.section(NAMES[L], b0, b0 + LEVEL)
    sc.event('level', sc.t(b0), 1.0)
    sc.impact(sc.t(b0), big=L in (0, 2, 4))
    if L >= 2: crash(sc.t(b0), 0.8)
    if L in (2, 4): braam(sc.t(b0), 24, 0.9)
    for i in range(LEVEL):
        b = b0 + i
        chord = PROG_MIN[i % 4]
        bar_drums(b, L, fill=(i % 4 == 3), kick4=(L >= 5), hats=(0 if L < 2 else 2 if L < 4 else 4))
        bar_harmony(b, chord, L)
        if L == 0:                                                   # 只有鼓的那一層：底下留著長音
            sc.add('mid', strings_sound([36, 43, 48, 55], 60 / BPM * 4, attack=0.4, cutoff=2200), sc.t(b), 0.5, big=0.4)
        if L >= 2:                                                   # 低音銅管的根音
            brass(sc.t(b), CH[chord]['root'] + 12, 4, s=0.34 + 0.04 * L, power=0.8, ev=False)
            brass(sc.t(b), CH[chord]['root'] + 19, 4, s=0.2 + 0.03 * L, power=0.7, ev=False)
    if L == 3:                                                       # 路：主題第一次出現，只有鐘聲、只有前半
        for rep in range(2):
            for i, bar in enumerate(THEME_MIN[:4]):
                beat = 0
                for m, d in bar:
                    sc.bell(sc.t(b0 + rep * 4 + i, beat), m + 12, 1.4, 0.5, pan=-0.3); sc.event('theme', sc.t(b0 + rep * 4 + i, beat), 0.5); beat += d
    if L == 4: play_theme(b0, THEME_MIN, s=0.55, power=0.7)
    if L == 5: play_theme(b0, THEME_MIN, s=0.85, power=1.0, octave=True); crash(sc.t(b0 + 4), 0.7)
    if L < N_LEVELS - 1: sc.riser(sc.t(b0 + LEVEL), 60 / BPM * 4)
# 進安靜段之前：滾奏、半拍真靜默
roll(sc.t(B_QUIET - 1, 0), sc.t(B_QUIET, -0.5), 4, 8)
sc.riser(sc.t(B_QUIET, -0.5), 60 / BPM * 7)
sc.silence(sc.t(B_QUIET, -0.5), sc.t(B_QUIET))

# ═════════ 安靜（家）：一下重擊之後全部拿掉，只剩長音與鐘聲
sc.section('家', B_QUIET, B_FIN)
sc.event('level', sc.t(B_QUIET), 1.0)
sc.impact(sc.t(B_QUIET), big=True)
for i, chord in enumerate(['Ab', 'Ab', 'Eb', 'Eb', 'Bb', 'Bb']):
    c = CH[chord]
    sc.add('mid', strings_sound([m + 12 for m in c['pad'][1:]], 60 / BPM * 4, attack=0.9, release=1.2, cutoff=2200), sc.t(B_QUIET + i), 0.3, big=0.6)
for (bar, beat, m) in [(1, 0, 79), (1, 2, 84), (2, 0, 87), (3, 0, 86), (3, 2, 82), (4, 0, 86)]:
    sc.bell(sc.t(B_QUIET + bar, beat), m, 2.4, 0.5, pan=0.2); sc.event('theme', sc.t(B_QUIET + bar, beat), 0.4)
for b in range(B_QUIET + 3, B_FIN):
    for beat, s in ((0, 0.45), (0.5, 0.3)):
        taiko(sc.t(b, beat), s=s, size=1.5, ev=False); sc.event('heart', sc.t(b, beat), s)
sc.riser(sc.t(B_FIN, -1), 60 / BPM * 7)
roll(sc.t(B_FIN - 1, 2), sc.t(B_FIN, -1), 4, 8, 0.2, 0.9)
sc.silence(sc.t(B_FIN, -1), sc.t(B_FIN))

# ═════════ 終段（網）：全部一起，大調；最後八小節升一個全音
sc.section('網', B_FIN, B_END)
for rep in range(3):
    b0 = B_FIN + rep * 8
    tr = 2 if rep == 2 else 0
    sc.event('level', sc.t(b0), 1.0)
    sc.impact(sc.t(b0), big=True); crash(sc.t(b0), 1.0); braam(sc.t(b0), 27 + tr, 1.0)
    for i in range(8):
        b = b0 + i
        chord = PROG_MAJ[i % 4]
        bar_drums(b, 6, fill=(i % 2 == 1), kick4=True, hats=4)
        bar_harmony(b, chord, 5 + rep * 0.5, tr=tr)
        brass(sc.t(b), CH[chord]['root'] + 12 + tr, 4, s=0.5, power=0.6, ev=False)
        if i % 2 == 0 and rep > 0: crash(sc.t(b), 0.6)
    play_theme(b0, THEME_MAJ, tr=tr, s=0.95 + 0.05 * rep, power=1.0 + 0.1 * rep, octave=True)
    if rep < 2: sc.riser(sc.t(b0 + 8), 60 / BPM * 4)
roll(sc.t(B_END - 1, 0), sc.t(B_END, -0.5), 4, 8, 0.4, 1.0)
sc.silence(sc.t(B_END, -0.5), sc.t(B_END))

# ═════════ 最後一擊：主和弦（F 大調）長音
sc.section('終', B_END, B_END + OUTRO)
sc.event('level', sc.t(B_END), 1.0)
sc.impact(sc.t(B_END), big=True); crash(sc.t(B_END), 1.0); braam(sc.t(B_END), 29, 1.0)
taiko(sc.t(B_END), 1.0, 1.5)
sc.add('mid', choir_sound([53, 60, 65, 69, 72], 60 / BPM * 7, release=2.5), sc.t(B_END), 0.8, big=0.6)
sc.add('mid', strings_sound([65, 72, 77, 81], 60 / BPM * 7, release=2.5), sc.t(B_END), 0.4, big=0.5)
for m in (65, 77, 84): brass(sc.t(B_END), m, 7, s=0.6, power=1.0, ev=False)

GAIN = {'手': 1.2, '火': 1.15, '田': 1.4, '城': 0.86, '路': 0.9, '海': 0.9, '機': 0.88, '家': 1.0, '網': 1.0, '終': 1.0}
def apply_section_gains():
    env = np.ones(sc.N)
    for s_ in sc.sections:
        env[int(s_['start'] * SR):int(s_['end'] * SR)] = GAIN[s_['name']]
    k = int(0.03 * SR)
    env = np.convolve(np.pad(env, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid')[:sc.N]
    for name in sc.bus:
        sc.bus[name] *= env[:, None]

if __name__ == '__main__':
    apply_section_gains()
    doc = sc.render('audio/score.wav', 'data/audio.json', lufs=-14.0, true_peak=-2.3, fade_out=4.0, mid_gain=1.45, bass_gain=0.55, comp_thr=0.6)
    print('段落：' + '、'.join(f"{s['name']} {s['start']:.1f}–{s['end']:.1f}" for s in doc['sections']))
