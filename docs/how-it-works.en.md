<p align="center"><b>English</b> ｜ <a href="how-it-works.zh-TW.md">繁體中文</a> ｜ <a href="how-it-works.zh-CN.md">简体中文</a></p>

# How it works

This document explains how the film's code is organized. It is for anyone who wants to read the code, or to make a film of their own the same way. (The code comments themselves are in Traditional Chinese.)

## 1. The render contract: a frame is a function of time

The whole film rests on one rule: **for any time t, draw exactly the same frame.**

`stage.html` exposes just four things:

| Interface | Purpose |
|---|---|
| `window.__ready` | A Promise that resolves once the fonts, geography and score timeline have loaded |
| `window.__meta` | `{ dur, fps }`: length and frame rate |
| `window.__seek(t)` | Draws the frame at time t |
| `window.__events()` | The times of cuts, for the measurement tools |

To keep this rule, the code uses **no** timers, no CSS animation and no `Math.random()`, and keeps no state from one frame to the next. Wherever randomness is needed, it comes from seeded hashes (`E.hash`, `E.rng`).

What the rule buys:

- **Parallel rendering**: six browsers each draw a segment, and the segments are joined at the end.
- **Real motion blur**: one frame is drawn several times while the virtual shutter is open, and the results are averaged.
- **Reproducibility**: the same code produces the same output every time.
- **Live playback**: `player.html` simply calls `__seek` with `audio.currentTime` on every frame.

## 2. The render pipeline (`render.mjs`)

```
local static server ─┬─ Chrome 1: frames 0–744    ─┐
                     ├─ Chrome 2: frames 745–1489 ─┤
                     ├─ …                          ├─ ffmpeg concat → tag BT.709 → mux score (AAC 256k) → mp4
                     └─ Chrome 6: …                ─┘
per frame: 4 sub-frames within a 180° shutter → ffmpeg tmix average → one motion-blurred frame
```

- Screenshots come from playwright-core driving the Google Chrome already installed on your machine. No extra browser is downloaded.
- The color space must be tagged BT.709, or QuickTime will wash out the colors.
- Modes: `sheet` (keyframe overview), `strip` (consecutive frames around a moment), `video`, and `events` (export cut times).

## 3. The world: real 3D at real scale

- **Coordinates**: the origin is Babylon (44.42° E, 32.54° N). x points east, y north and z up, in meters.
- **Distant geography sits on a sphere with the Earth's real radius** (`E.makeGeo`). When the camera pulls back far enough, the ground curves into a globe by itself, with no switch between two drawing methods.
- **Only three primitives** (`src/engine.js`):
  - `E.line`: lines, optionally hidden behind the Earth (`occlude`)
  - `E.face`: solid faces, back-face culled by their normals, painted in the background color so they hide the lines behind them
  - Points of light: pre-rendered glow sprites, composited additively
- **Glow**: each layer is drawn on a transparent canvas, then a blurred copy of itself is added on top (`E.makeLayers`).
- **The whole frame** is drawn on an offscreen canvas first and then copied to the screen, so zoom, shake and white flashes apply to everything at once.

## 4. One camera (`KEYS` and `camP1` in `src/film.js`)

The first 89 seconds are a single shot. The camera's path is a table. Each row reads "at bar N: distance, pitch, azimuth, frame offset, field of view, target":

```js
//  bar   dist(m)  pitch  azim  offX  offY  fov  target
  [0,     0.74,    0,     0,    0,    0,    36,  CP(0, 0, 0.005)],   // against the cave wall
  [12,    82,      30,   -27,   40,   130,  36,  CP(14, -30, -1.3)], // fields
  [24.5,  2.6e4,   52,   -30,   170,  70,   36,  [0, 0, 0]],         // above Babylon
  [52,    2.6e7,   89.5,  0,    300, -10,   25,  null],              // the whole Earth
```

- **Distance is interpolated logarithmically.** From 0.74 m to 26,000 km is 7.5 orders of magnitude. With logarithmic interpolation, the camera pulls back by the same *factor* in every bar.
- **The camera kicks back on every beat.** It moves back quickly on the beat and glides slowly between beats, so the camera itself keeps time.
- **When the target is `null`**, the camera looks at the center of the milestones from the last few beats (`track`). That is why the globe turns by itself toward wherever things are happening.
- As the pitch steepens, "up" on screen changes from the sky to north, so the camera never flips over the top.

## 5. Handing over between scales (LOD)

One camera, with a different scene responsible at each distance:

| Distance (approx.) | Scene |
|---|---|
| 0.7–500 m | `scene_land.js`: cave wall and hand stencils (borrowed from `scene_cave.js`), camp, fields and village |
| 0.5–22 km | `scene_city.js`: Babylon |
| 4 km and up | `scene_globe.js`: the Earth (`earthP1`). Between 4 and 22 km it crossfades with Babylon |

There are two ways to hand over: a hard switch hidden under the white flash of a heavy hit, or a crossfade with both layers drawn. Ground points also change density with distance (`groundLOD`), so the pull-back never reveals "the edge of the map". The canals and villages outside the city (`drawLocal`) are drawn by both the Babylon scene and the Earth scene, so the handover lines up.

## 6. The milestone system (`src/milestones.js`, `src/film.js`)

One row of data:

```js
// [year, Traditional Chinese name, longitude, latitude, big caption, category, Simplified Chinese name, English name]
[1088, '指南針', 119.45, 32.2, 0, 'i', '指南针', 'The compass'],
```

- **Year**: negative numbers are BC. Anything older than 10,000 BC is written `BP(years before present)`.
- **The category sets the color**: invention (gold), science (ice blue), construction (bone white), exploration and creation (ochre).
- **Scheduling**: each section places its milestones on beats. Early sections get one every beat or every few beats; later ones get one every half or quarter beat. The tempo never changes. Only the density accelerates.
- **Drawing**:
  - `ticker`: the list scrolling up on the left, with a line from the newest row to its place on the globe
  - `drawMarks`: a ring of light at the place, then a lamp that stays. The lamps accumulate, so by the end the whole Earth is lit
  - `caption`: the big text in the wonder shots (one line for the year, one for the name)
- **The full-history replay** (`REROLL`): all 176 items scroll by again over 28 beats, and each one lights up on the globe once more.

## 7. Score and sync

```
score.py ──→ audio/score.wav
         └─→ data/audio.json ──→ src/film.js (picture)
                              └─→ tools/sync.py (measurement)
```

What `data/audio.json` contains:

| Field | Contents |
|---|---|
| `bpm`, `beats`, `downbeats` | 140, 336 beats, 84 downbeats |
| `sections` | Names and start/end times of the 10 sections |
| `onsets` | Hit times for 16 instruments: `kick`, `snare`, `taiko`, `theme`, `bell`, `impact`, `heart`… |
| `silences` | The 4 silences |
| `rms`, `low`, `mid`, `high` | Loudness and band energy every 10 ms |

The picture reads it through `lib/music.js`:

```js
const mu = Mu.load(audio);
mu.hit('kick', t)          // decaying pulse (0–1) since the last kick; drives light, shake and camera
mu.events('theme')         // times of theme notes; milestone captions land on these
mu.beatAt(t), mu.snap(t)   // which beat; snap to the nearest beat
```

The section hits (`SLAMS`) set the zoom, shake and flash strength at the start of each section. **There is not a single hand-typed second in the code.** Every time comes from `audio.json`, so if the score's rhythm changes, the picture follows automatically.

## 8. Three languages (`src/i18n.js`)

- The URL parameter is `?lang=tc|sc|en`. The default is Traditional Chinese.
- The code is written with Traditional Chinese strings, and `TR()` looks up the Simplified Chinese or English. The three names of each milestone are stored in the data itself.
- Fonts are loaded with `FontFace`: one open-source font per language (SIL OFL).
- Layout uses measured text widths. The English section label is a word (46 px); the Chinese one is a single character (76 px).

## 9. Measurement tools (`tools/`)

| Tool | What it measures |
|---|---|
| `sync.py film.mp4 --analysis data/audio.json` | Share of visual events and cuts that land on the beat, events per beat, whether the strongest accents get a visual response, and A/V offset |
| `rhythm.py film.mp4` | The picture's own rhythm: share of still frames, hard cuts, variation in shot length, bursts |
| `check.sh film.mp4` | Contact sheet and phone-size sheet from the finished film, plus loudness, rhythm and sync figures |
| `sections.py audio/score.wav data/audio.json` | Loudness and frequency balance per section, to check that the layers really build up |

Measured on the released film:

| Metric | Value | Expected by chance |
|---|---|---|
| Cuts on the beat | 95% | 16% |
| Visual events on the beat | 78% | 16% |
| Visual events on the half beat | 99% | 31% |
| Top 10 accents with a visual response | 9 | — |
| Mean offset of on-beat events | 4.7 ms (SD 8.9) | — |
| Visual events per beat | 0.43 | — |

## 10. Making your own film this way

1. Write the music first (or get word-level timings for the narration), and export a timeline.
2. Have the composition page read only the timeline, and keep the rule that a frame is a function of time.
3. Look at keyframes with `node render.mjs sheet --every 0.5` before rendering any video.
4. After rendering, measure with `tools/`. Don't go by feel.
5. Decide the palette, camera language and transitions fresh for every film. What carries over is the engine and the tools.
