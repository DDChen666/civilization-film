#!/usr/bin/env python3
"""每一段的響度與頻段佔比：看「一層一層堆上去」有沒有真的發生。 python3 tools/sections.py audio/score.wav data/audio.json"""
import json, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt
sr, y = wavfile.read(sys.argv[1]); y = y.astype(np.float64).mean(axis=1) / 32768
doc = json.load(open(sys.argv[2]))
def band(x, lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=sr, output='sos') if lo and hi else butter(4, hi, btype='low', fs=sr, output='sos') if hi else butter(4, lo, btype='high', fs=sr, output='sos')
    return float(np.mean(sosfiltfilt(sos, x) ** 2))
print('段　　起–迄（秒）　　響度dB　峰均比　超低/低/中/中高/高 %')
for s in doc['sections']:
    x = y[int(s['start'] * sr):int(s['end'] * sr)]
    if len(x) < sr: continue
    b = [band(x, None, 60), band(x, 60, 250), band(x, 250, 2000), band(x, 2000, 6000), band(x, 6000, None)]; tot = sum(b) + 1e-18
    rms = np.sqrt(np.mean(x ** 2))
    print(f"{s['name']}　{s['start']:6.1f}–{s['end']:6.1f}　{20*np.log10(rms+1e-9):6.1f}　{20*np.log10(np.max(np.abs(x))/(rms+1e-9)):5.1f}　" + '/'.join(f'{100*v/tot:.0f}' for v in b))
