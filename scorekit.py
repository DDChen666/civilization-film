"""scorekit：用程式寫配樂，同時輸出畫面要用的時間表。

配樂和畫面共用同一份時間：這裡排的每一個音、每一下重擊，時間都會寫進 audio.json，
畫面用 lib/music.js 讀同一份檔，所以卡點的誤差是 0，不需要事後分析。

    from scorekit import Score, midi
    sc = Score([(4, 100), (4, 120), (8, 140)])        # 速度地圖：4 小節 100 BPM、4 小節 120、8 小節 140（4/4 拍）
    sc.section('intro', 0, 4)
    sc.impact(sc.t(0), big=True)                       # 第 0 小節第一拍一個大重擊
    for b in range(4, 16):
        for k in range(4):
            sc.kick(sc.t(b, k))                        # 每拍一個大鼓
    sc.silence(sc.t(15, 3), sc.t(16))                  # 最後一拍全靜（連殘響一起切）
    sc.render('audio/score.wav', 'data/audio.json', lufs=-14)

學到的事（寫進這個工具裡的理由）：
  - 標竿（Prometheus II）的配樂：超低頻與低頻各佔四成、中頻一成六；每拍一個大鼓、二四拍小鼓、反拍鈸；
    速度分段加快；大重擊之前留一小段真正的靜默。
  - 我自己被說「有點差」的那一版：中頻只有 8%（旋律與和聲住的地方是空的），而且從頭到尾沒有「靜默之後的重擊」。
  - 所以這裡的樂器分成四層：鼓、低音、中頻（和弦、琶音、主旋律）、效果；母帶不挖中頻。
  - 做完用 scripts/soundprint.py 和標竿並排比，用 scripts/sync.py 量成片的卡點。我聽不到，交件時要明說。
需要：numpy、scipy、ffmpeg（量響度）
"""
import json
import os
import re
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
FPS = 100
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ───────── 基本零件
def _polyblep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    y[m] = x + x - x * x - 1
    m = t > 1 - dt
    x = (t[m] - 1) / dt[m]
    y[m] = x * x + x + x + 1
    return y


def saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    return 2 * ph - 1 - _polyblep(ph, dt)


def sine(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return np.sin(2 * np.pi * (phase0 + np.cumsum(f) / SR))


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x, axis=0)


def decay(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


# ───────── 樂器（單聲道，回傳陣列）
def kick_sound(strength=1.0):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    body = sine(49 + 120 * np.exp(-t / 0.03), n) * decay(n, 0.2)
    click = hp(rng.standard_normal(n) * decay(n, 0.002), 1500) * 0.35
    return np.tanh((body + click) * 1.8) * 0.9 * strength


def snare_sound():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    e = np.zeros(n)
    for k, d in enumerate([0.0, 0.011, 0.022]):
        i = int(d * SR)
        e[i:] += np.exp(-(t[i:] - d) / (0.008 if k < 2 else 0.16))
    return (bp(rng.standard_normal(n), 900, 5200) * e * 0.9 + np.sin(2 * np.pi * 185 * t) * decay(n, 0.05) * 0.35) * 0.8


def hat_sound(open_=False):
    n = int((0.35 if open_ else 0.09) * SR)
    return hp(rng.standard_normal(n), 7000, 4) * decay(n, 0.12 if open_ else 0.022) * 0.4   # 用噪音，不用方波（方波的鈸會刺耳）


def impact_sound(big=True):
    """大重擊：下潛的超低頻 + 一聲悶響 + 噪音的爆裂。尾巴很長，配大殘響。"""
    n = int(3.6 * SR)
    t = np.arange(n) / SR
    boom = sine(52 * np.exp(-t / 1.2) + 30, n) * decay(n, 1.2 if big else 0.6)
    crack = lp(rng.standard_normal(n), 2600) * decay(n, 0.25) * 0.55
    mid = bp(rng.standard_normal(n), 300, 1800) * decay(n, 0.12) * 0.5        # 中頻的一擊，小喇叭上也聽得到
    x = np.tanh(boom * 1.6) * 0.9 + crack + mid
    th = kick_sound(1.2)
    x[:len(th)] += th * 0.8
    return x * (1.0 if big else 0.6)


def riser_sound(dur, f0=250, f1=9000):
    """往上掃的噪音，接在段落交界之前。"""
    n = int(dur * SR)
    noise, y, zi = rng.standard_normal(n), np.zeros(n), None
    for s in range(0, n, 512):
        fc = f0 * (f1 / f0) ** ((s / n) ** 1.6)
        sos = signal.butter(2, [fc * 0.7, min(fc * 1.4, SR * 0.45)], 'band', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[s:s + 512], zi = signal.sosfilt(sos, noise[s:s + 512], zi=zi)
    return y * (np.arange(n) / n) ** 2.2 * 1.4


def bass_sound(m, dur, cutoff=420):
    n = int(dur * SR)
    f = midi(m)
    x = lp(saw(f, n) * 0.6 + sine(f, n) * 0.7 + sine(f * 2, n) * 0.25, cutoff)   # 加二次諧波：極低的音在小喇叭上才聽得出音高
    e = np.minimum(1, np.arange(n) / (0.004 * SR)) * decay(n, dur * 0.9)
    return np.tanh(x * e * 1.5) * 0.55


def pluck_sound(m, dur=0.3, cutoff=2600):
    """中頻的短音：琶音、頑固音型。"""
    n = int(dur * SR)
    f = midi(m)
    x = lp(saw(f * 1.003, n, rng.random()) * 0.5 + saw(f * 0.997, n, rng.random()) * 0.5, cutoff)
    return x * decay(n, dur * 0.35) * 0.5


def bell_sound(m, dur=1.6):
    """鐘、鋼片琴一類的清楚音高（FM）：主旋律用。"""
    n = int(dur * SR)
    f = midi(m)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 3.5 * t) * decay(n, 0.25) * 2.2
    return np.sin(2 * np.pi * f * t + mod) * decay(n, dur * 0.3) * np.minimum(1, t / 0.003) * 0.45


def pad_sound(notes, dur, cutoff=1800, attack=0.5, release=1.2, voices=5, detune=0.12):
    """和弦墊底（立體聲）。cutoff 不要低於 1200，否則中頻會空。"""
    n = int((dur + release) * SR)
    L, R = np.zeros(n), np.zeros(n)
    for m in notes:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            x = saw(midi(m + d), n, rng.random())
            pan = (v / (voices - 1)) * 2 - 1
            L += x * (1 - pan) * 0.5
            R += x * (1 + pan) * 0.5
    st = lp(np.stack([L, R], axis=1) / (len(notes) * voices) * 2.2, cutoff, 2)
    t = np.arange(n) / SR
    return st * (np.minimum(1, t / attack) * np.clip((dur + release - t) / release, 0, 1))[:, None]


def make_ir(dur, tau, damp):
    n = int(dur * SR)
    ir = lp(rng.standard_normal((n, 2)) * np.exp(-np.arange(n) / SR / tau)[:, None], damp, 1)
    k = int(0.012 * SR)
    ir[:k] *= np.linspace(0, 1, k)[:, None]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


class Score:
    def __init__(self, tempo_map, beats_per_bar=4, tail=2.5):
        """tempo_map：[(小節數, BPM), ...]。tail：最後一小節之後留幾秒給殘響。"""
        self.bpb = beats_per_bar
        self.tempo_map = tempo_map
        self.beats, self.downbeats, self.segments = [], [], []
        t, bar = 0.0, 0
        for bars, bpm in tempo_map:
            p = 60.0 / bpm
            self.segments.append(dict(start=round(t, 4), bar=bar, bars=bars, bpm=bpm))
            for b in range(bars):
                self.downbeats.append(t)
                for k in range(beats_per_bar):
                    self.beats.append(t)
                    t += p
            bar += bars
            self.segments[-1]['end'] = round(t, 4)
        self.music_end = t
        self.n_bars = bar
        self.dur = t + tail
        self.N = int(self.dur * SR)
        self.bus = {k: np.zeros((self.N, 2)) for k in ('drums', 'bass', 'mid', 'fx', 'send_small', 'send_big')}
        self.events, self.sections, self.silences, self._duck = {}, [], [], []

    # ── 時間
    def t(self, bar, beat=0.0):
        """第 bar 小節、第 beat 拍（可以是小數）的時間。"""
        i = bar * self.bpb + beat
        k = int(np.floor(i))
        if k >= len(self.beats) - 1:
            p = self.beats[-1] - self.beats[-2]
            return self.beats[-1] + (i - (len(self.beats) - 1)) * p
        return self.beats[k] + (self.beats[k + 1] - self.beats[k]) * (i - k)

    def section(self, name, bar0, bar1):
        self.sections.append(dict(name=name, start=round(self.t(bar0), 4), end=round(self.t(bar1), 4)))

    def event(self, name, t, strength=1.0):
        """記一個畫面要用的事件（不一定有聲音）。"""
        self.events.setdefault(name, []).append([round(float(t), 4), round(float(strength), 3)])

    # ── 放聲音
    def add(self, bus, x, t0, gain=1.0, pan=0.0, small=0.0, big=0.0):
        i = int(round(t0 * SR))
        if i >= self.N:
            return
        if x.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            x = np.stack([x * l * 1.414, x * r * 1.414], axis=1)
        if i < 0:
            x, i = x[-i:], 0
        j = min(self.N, i + len(x))
        for name, g in ((bus, gain), ('send_small', small * gain), ('send_big', big * gain)):
            if g:
                self.bus[name][i:j] += x[:j - i] * g

    def kick(self, t, s=1.0):
        self.add('drums', kick_sound(s), t)
        self.event('kick', t, s)
        self._duck.append(t)

    def snare(self, t, s=1.0):
        self.add('drums', snare_sound(), t, 0.8 * s, small=0.25)
        self.event('snare', t, s)

    def hat(self, t, open_=False, s=1.0):
        self.add('drums', hat_sound(open_), t, 0.5 * s, pan=0.25)
        self.event('hat', t, s * (1.0 if open_ else 0.6))

    def impact(self, t, big=True):
        self.add('fx', impact_sound(big), t, 1.0, big=0.5)
        self.event('impact', t, 1.0 if big else 0.6)
        self._duck.append(t)

    def riser(self, t_end, dur):
        self.add('fx', riser_sound(dur), t_end - dur, 0.5, big=0.2)
        self.event('riser', t_end - dur, 1.0)

    def bass(self, t, m, dur, s=1.0):
        self.add('bass', bass_sound(m, dur), t, s)
        self.event('bass', t, s)

    def pluck(self, t, m, dur=0.3, s=1.0, pan=0.0, cutoff=2600):
        self.add('mid', pluck_sound(m, dur, cutoff), t, s, pan=pan, small=0.3)
        self.event('pluck', t, s)

    def bell(self, t, m, dur=1.6, s=1.0, pan=0.0):
        self.add('mid', bell_sound(m, dur), t, s, pan=pan, small=0.2, big=0.25)
        self.event('bell', t, s)

    def pad(self, t, notes, dur, s=1.0, cutoff=1800):
        self.add('mid', pad_sound(notes, dur, cutoff), t, s, big=0.35)
        self.event('pad', t, s)

    def silence(self, t0, t1):
        """真正的靜默：連殘響尾一起切掉。靜默之後的第一個聲音是全片最重要的聲音。"""
        self.silences.append([round(float(t0), 4), round(float(t1), 4)])

    # ── 輸出
    def render(self, wav_path, json_path, lufs=-14.0, true_peak=-1.5, fade_out=2.0, mid_gain=1.5, bass_gain=0.55, comp_thr=0.3):
        """mid_gain／bass_gain：中頻層與低音層的比例。做完用 soundprint.py 看頻段佔比，中頻（250–2k）目標 15% 上下。"""
        N, B = self.N, self.bus
        t_axis = np.arange(N) / SR
        duck = np.ones(N)                       # 大鼓和重擊打下來時，中頻與低音讓一下
        for tk in self._duck:
            i = int(tk * SR)
            j = min(N, i + int(0.4 * SR))
            duck[i:j] = np.minimum(duck[i:j], 1 - 0.5 * np.exp(-(t_axis[i:j] - tk) / 0.09))
        mid = B['mid'] * duck[:, None]
        bass = B['bass'] * (0.3 + 0.7 * duck)[:, None]
        rev = signal.fftconvolve(B['send_small'], make_ir(1.2, 0.25, 6000), axes=0)[:N] * 0.5 \
            + signal.fftconvolve(B['send_big'], make_ir(4.0, 0.9, 4200), axes=0)[:N] * 0.6
        mix = hp(B['drums'] + bass * bass_gain + mid * mid_gain + B['fx'] + rev, 28, 2)
        mix = mix + hp(mix, 7000, 1) * 0.25 - lp(mix, 55, 2) * 0.25          # 一點空氣感、收一點超低頻；不挖中頻
        lvl = np.sqrt(lp(np.mean(mix ** 2, axis=1), 8, 1).clip(1e-9))        # 輕微的整體壓縮
        thr = comp_thr
        mix *= np.where(lvl > thr, (thr + (lvl - thr) / 2) / lvl, 1.0)[:, None]
        gate = np.ones(N)                                                     # 靜默：5 毫秒淡出、2 毫秒淡入
        for a, b in self.silences:
            i, j = int(a * SR), min(N, int(b * SR))
            fo, fi = int(0.005 * SR), int(0.002 * SR)
            gate[max(0, i - fo):i] *= np.linspace(1, 0, min(fo, i))[-(i - max(0, i - fo)):] if i > 0 else 1
            gate[i:j] = 0
            gate[j:min(N, j + fi)] *= np.linspace(0, 1, fi)[:min(N, j + fi) - j]
        mix *= gate[:, None]
        mix *= np.clip((self.dur - t_axis) / fade_out, 0, 1)[:, None]
        mix *= 0.9 / (np.max(np.abs(mix)) + 1e-9)                              # 先把峰值正規化，再輕輕飽和：不要把動態壓扁
        mix = np.tanh(mix * 1.1) / 1.1

        from scipy.ndimage import minimum_filter1d, uniform_filter1d

        def write(g, lim):
            y = mix * g
            pk = np.max(np.abs(y), axis=1)
            gain = np.minimum(1.0, lim / np.maximum(pk, 1e-9))                # 每個取樣點需要壓多少才不超過上限
            L = int(0.006 * SR) | 1                                           # 往前看 6 毫秒，平滑地壓，不硬切
            gain = uniform_filter1d(minimum_filter1d(gain, L), L)
            y = y * gain[:, None]
            os.makedirs(os.path.dirname(os.path.abspath(wav_path)), exist_ok=True)
            wavfile.write(wav_path, SR, (np.clip(y, -1, 1) * 32767).astype(np.int16))
            err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav_path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
            tail = err[err.rfind('Summary:'):]
            return float(re.search(r'I:\s+(-?[\d.]+) LUFS', tail).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', tail).group(1))

        g = 0.5 / (np.max(np.abs(mix)) + 1e-9)
        lim = 10 ** ((true_peak - 0.6) / 20)                                  # 取樣峰值再低 0.6 dB，留給取樣點之間的過衝
        for _ in range(8):                                                    # 量響度與真峰值 → 調整，重複到兩個都達標
            I, P = write(g, lim)
            if P > true_peak + 0.05:
                lim *= 10 ** ((true_peak - P - 0.1) / 20)
            elif abs(I - lufs) < 0.25:
                break
            else:
                g *= 10 ** ((lufs - I) / 20)
        mono = None
        sr0, y = wavfile.read(wav_path)
        mono = y.astype(np.float64).mean(axis=1) / 32767

        def envelope(x):
            m = lp(np.abs(x), 12, 1)[::SR // FPS][:int(self.dur * FPS)]
            return (m / (np.max(m) + 1e-9)).round(3).tolist()
        for k in self.events:
            self.events[k].sort()
        doc = dict(
            duration=round(self.dur, 3), music_end=round(self.music_end, 3), bpm=self.tempo_map[0][1], time_signature=self.bpb,
            tempo_map=self.segments, beats=[round(b, 4) for b in self.beats], downbeats=[round(b, 4) for b in self.downbeats],
            sections=self.sections, fps=FPS,
            rms=envelope(mono), low=envelope(lp(mono, 200)), mid=envelope(bp(mono, 200, 3000)), high=envelope(hp(mono, 3000)),
            onsets=self.events, silences=self.silences,
            qa=dict(lufs=I, true_peak=P, note='事件時間直接來自樂譜，不是分析出來的'),
        )
        os.makedirs(os.path.dirname(os.path.abspath(json_path)), exist_ok=True)
        with open(json_path, 'w') as f:
            json.dump(doc, f, separators=(',', ':'))
        print(f"寫出 {wav_path}（{self.dur:.1f} 秒，{I} LUFS，真峰值 {P} dBFS）與 {json_path}；事件：" + '、'.join(f"{k} {len(v)}" for k, v in self.events.items()))
        return doc
