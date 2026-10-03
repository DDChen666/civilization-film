<p align="center"><b>English</b> ｜ <a href="making-of.zh-TW.md">繁體中文</a> ｜ <a href="making-of.zh-CN.md">简体中文</a></p>

# Making of

This document is for anyone who wants to know how one person and Claude Code made this film in a single evening.

The director's words are quoted from the original messages, translated from Chinese. Claude's decisions, the decisions that were overturned and the measurements at each checkpoint come from the notes kept during production.

## The whole story on one page

October 1, 2026, Taiwan time:

| Time | What happened |
|---|---|
| 17:19 | The director describes the film, with a reference track and a reference film on the same subject |
| 17:35 | The director adds two points: the film will be published, so the music must be original; and the visuals should use whatever art form Claude does best |
| 18:02 | **Checkpoint 1**: five keyframes and a draft of the score, shown to the director as a web page |
| 18:15 | Director: "I watched it. Incredibly uplifting!" |
| 18:50 | **Checkpoint 2, v1**: the hardest 34 seconds (1:15–1:49) are built first |
| 18:56 | Director: "the density is a bit too low", plus a request to give East and West equal weight |
| 19:12 | **Checkpoint 2, v2**: the milestone system is added |
| 19:16 | Director: "Yes!!!" |
| 20:35 | **Full film, v1**, 2 min 29 s |
| 20:46 | Director: "I watched it and was deeply moved." Asks for Simplified Chinese and English versions, and names the final milestone |
| 21:17–21:49 | About 60 facts are checked, the fonts are switched to open-source ones, and then the Traditional Chinese, Simplified Chinese and English versions are rendered |

About four and a half hours in all. The tools for rendering video, measuring audio-visual sync and checking the finished film were built for earlier practice films and reused here.

---

## 0. The starting point: what the director provided

The first message:

> I'd like you to create a civilization film that is intensely uplifting, with outstanding motion — more astonishing and more powerful than the work of nearly all of the world's top animators. One of the Bilibili links I just sent you is on a similar subject. I want ours to be different from it, and even more astonishing and powerful. So I'd like to discuss with you: what changes do you think we should make?

The second, sixteen minutes later:

> This film will be published, so for the music I'd also like you to make it yourself... The track I provided is mainly meant to convey the feeling I'm after: intense, surging, building layer upon layer. As for the visuals, I think you should use the art form you're best at.

The director provided two references:

- **A trailer music track** (by Immediate Music). It was used only to analyze how the music builds layer by layer: 141 BPM, with a new layer every eight bars. **The track is not used in the film and is not included in this project.**
- **A film on the same subject on Bilibili.** Its visual grammar was taken apart so that this film could deliberately do something different.

Claude did not start writing code right away. It acted as a consultant first: it analyzed the reference track, took apart the reference film, proposed a direction that would set this film apart, listed the risks, and then delivered one decision with its reasons. The whole collaboration worked this way: **Claude makes the call, the director watches the result and says what is wrong.**

## 1. The concept: one camera, from a hand to the Earth

The one-sentence concept, as it was settled:

> One world and one camera that keeps pulling back, from a hand stencil on a cave wall to the whole Earth. The human world grows ring by ring, and everything that has been drawn stays.

**The look** (Claude's choice):

- Thin glowing lines and points of light on a dark ground, in real 3D. As the camera pulls back, near things move fast and far things move slowly. Once the camera is far enough away, the ground curves into a globe by itself, because distant geography sits on a sphere with the Earth's real radius.
- The whole film is made of three things: lines, solid faces that hide what is behind them, and points of light.
- Colors unlock one at a time as history advances: bone white and ochre (hand, fire) → gold (lamplight) → lapis blue (water, sea) → ice blue and white (electricity, network).
- Coastlines, rivers and city locations come from real data (Natural Earth).

**The structure**: 140 BPM, eight bars per section, each section named by a single Chinese character. The score also adds one layer per section.

| Section | Time | Picture | Camera distance |
|---|---|---|---|
| Hand | 0:00 | The cave wall, where sprayed pigment leaves a hand stencil | 0.7 m |
| Fire | 0:07 | Campfires, seated figures, tents | a few meters |
| Field | 0:21 | Fields, canals, a village | a few hundred meters |
| City | 0:34 | Babylon, with the ziggurat growing one tier per beat | a few kilometers |
| Road | 0:48 | Trade routes linking the cities of the Old World | 1,000 km |
| Sea | 1:02 | The voyages of Zheng He, da Gama, Columbus and Magellan | 10,000 km |
| Machine | 1:15 | Railways, cables and electric light wrap the planet | the whole Earth |
| Home | 1:29 | The whole Earth, with all music removed | 29,400 km |
| Network | 1:39 | The Earth lights up, then a montage of wonders and a replay of all history | back and forth |
| End | 2:21 | The Earth shrinks to a point, and one line of text | — |

The biggest risk listed at the time was this: **can 82 seconds with no cuts, carried by a single camera pulling back, hold the rhythm?** That is why checkpoint 2 started with the hardest section.

## 2. The score: original, and written first

The score was finished before the picture. The picture has to lock to the time grid of the sound, so it cannot be scored after the fact.

`score.py` synthesizes every sound from math. There are no samples.

- 140 BPM in C minor. The four chords Cm–Ab–Eb–Bb never change.
- A new layer every eight bars: kick drum (in a 3+3+2 pattern) and frame drum → short low-string strokes → full drums, low brass and chord hits → fast high-string figures and bells playing the theme → choir and sustained strings → brass playing the theme at full strength.
- Four true silences, each followed by a heavy hit. The final section restarts the chords from Eb, turning from dark to bright, and the last eight bars rise a whole step.
- Along with `audio/score.wav`, the script writes `data/audio.json`, which records the time of every beat, drum hit, theme note and section. **The picture reads only this file.**

Claude cannot hear audio, so it judged the score by measurement. Loudness rises section by section, from −21.7 LUFS in "Fire" to −14.0 in "Network", with a deliberate drop back to −22.2 in "Home".

<img src="images/score_spectrogram.jpg" alt="Spectrogram of the full score: it fills up toward the right, and the Home section in the middle is almost empty">

The director: "The music is excellent."

## 3. Checkpoint 1: five keyframes

No animation yet. Claude drew just five keyframes (Hand, City, Road, Home, Network) and put them on a web page together with the draft score.

<img src="images/gate1_keyframes.jpg" alt="The five keyframes from checkpoint 1">

The director: "I watched it. Incredibly uplifting!"

## 4. Checkpoint 2: the hardest 34 seconds first, then overturned

Checkpoint 2 covered 1:15–1:49: Machine → silence → Home → the first hit of the finale. The biggest emotional turns in the film all happen here.

While this was being built, the director asked:

> Will this film show the brilliance of human civilization and technology?

Claude judged that it would not, not yet. That version leaned toward "maps and lights", and Babylon was its only concrete achievement. So the finale became a montage of wonders and technology, with each wonder built as a 3D line drawing at real scale.

After v1 was delivered, the director wrote:

> The music is excellent. But if I had to say something, it's that the density is a bit too low. What I mean is that the whole film has almost no great inventions, great constructions or great events — you could say there's almost no text at all, and that's not good... I expected that, with the beat, each road opening would match one invention after another, one technological advance or construction milestone after another... because human history is a journey that keeps accelerating.

> I'd also hope it isn't limited to the West. The whole world, and especially the civilizations of both East and West, is valuable and important. This is a hymn to human history, human civilization, human transportation and human technology.

**An overturned decision.** To stand apart from the reference film, Claude had put "lists of years and names" on its list of things not to do. The director's feedback showed that this was the wrong call: a list with names and years, one item after another and getting denser, was exactly what the director wanted. Claude rebuilt the film around it:

- **The milestone system.** Each row of data holds a year, a name, a longitude and latitude, whether it gets a big caption, and a category. A list on the left scrolls upward, adding a row every beat, half beat or quarter beat. The newest row has a line to its place on the globe, where a ring of light goes out and a lamp stays behind.
- **Acceleration through density.** The tempo stays fixed while each beat carries more milestones: Hand 1 → Fire 4 → Field 8 → City 16 → Road 29 → Sea 27 → Machine 51 → Network 40. At the end, all 176 are replayed.
- **The camera follows history.** It aims at the center of the last few beats' milestones, so the globe turns by itself to face wherever things are happening.
- **East and West given equal weight.** The list and the wonders now include East Asia, South Asia, the Islamic world, Africa and the Americas: paper, movable type, the compass, gunpowder, Dujiangyan, the Grand Canal, Zhang Heng's seismoscope, Zheng He, zero and the decimal system, algebra, the House of Wisdom, Angkor, Machu Picchu, Timbuktu, Great Zimbabwe and Polynesian navigation, among others.
- **A new definition of "different".** Every event is pinned to the place where it happened, East and West get equal weight, past achievements stay on the Earth as lamps, and buildings are real 3D.

<img src="images/gate2_before_after.jpg" alt="Checkpoint 2 at the same moments: v1 on the left with no text, v2 on the right with milestones">

<sub>The same moments compared: v1 on the left, v2 on the right.</sub>

| Measured (`tools/sync.py`) | v1 | v2 |
|---|---|---|
| Cuts on the beat | 100% | 100% |
| Visual events per beat in "Machine" | 0.50 | 0.62 |
| Visual events per beat in "Network" | 0.42 | 0.54 |

The director: "Yes!!!"

## 5. The full film

Part one (0:00–1:29) is a single shot with no cuts. The camera follows one path through world coordinates, from 0.74 m out to 26,000 km. On each beat it kicks backward, then keeps drifting back until the next beat. The picture hands over as the distance grows: camp and fields → Babylon → the Earth. Each handover is hidden under the white flash of a heavy hit, or done as a crossfade between the two layers.

The finale (1:39–2:20) cuts on every beat: fifteen wonders in historical order → 32 events from 1983 to 2023, one per half beat → four shots on transportation (the Silk Road, the age of sail, railways, air routes and networks) → a key change and a replay of all 176 milestones → a rapid recap of the wonders → the final hit.

Before handing the film over, Claude reviewed frames from the rendered video in two rounds. Some of the problems it fixed:

| Problem seen | Fix |
|---|---|
| At 10 km and at 300–2,000 km the frame was empty, and the camera drifted over blank ground | Added canals and villages outside the city, plus settlements and roads across Mesopotamia; the camera holds its target at the origin longer |
| "Fire" had only 0.06 visual events per beat | Campfires now ignite on kick drums, fields and houses land on half beats, and the camera kicks harder. Raised to 0.28 |
| The Great Wall vanished completely | One failed point projection used to discard the whole layer. Now only the visible points are drawn |
| The International Space Station disappeared | The camera's near plane scales with target distance and was clipping it. It is now drawn with a separate close-range camera |
| Distant cities shrank below one pixel and vanished | Points of light are kept at 2.2 px minimum |
| The first 34 seconds of music were all low end | Added frame drum, raised the midrange layers, and set gain per section |

The director: "I watched it and was deeply moved. If you think the film has no remaining issues, please render a Simplified Chinese version and an English version."

## 6. Before release: fact-checking, open fonts, three languages

Claude's judgment at that point was **not yet**. Two things had to be done first:

1. **Facts.** The milestone years were all from memory. About 60 facts were checked online (54 milestones plus the dimensions of the wonders), and 7 were corrected:

| Was | Now | Basis |
|---|---|---|
| Dogs domesticated, c. 15,000 years ago | c. 23,000 years ago (Siberia) | Still debated |
| Horses domesticated, 3500 BC | 2200 BC | The early Botai evidence is disputed; the current consensus is c. 2200 BC |
| Iron, 1200 BC | Renamed "The Iron Age" | Iron smelting itself is older |
| Stonehenge, 3000 BC | 2500 BC, with the circle's diameter corrected from 33 m to 30 m | The stone circle dates to c. 2600–2400 BC |
| Gunpowder, 850 | 808 | Earliest known written record |
| "The academies of Timbuktu" | Djinguereber Mosque, Timbuktu | What was built in 1327 was the mosque |
| Trans-Siberian Railway, 1916 | 1904 | Opened to traffic in 1904 |

2. **Fonts.** The draft used fonts bundled with the operating system, which cannot be redistributed with the film. They were replaced with open-source Noto Serif (Traditional and Simplified Chinese) and EB Garamond.

**Three languages.** A URL parameter, `?lang=tc|sc|en`, switches the language. The Simplified Chinese version is not a machine conversion: it uses mainland China's standard names and terms. In English, each section's single character became a single word: HAND, FIRE, FIELD, CITY, ROAD, SEA, MACHINE, HOME, NETWORK.

**The final milestone.** At this point the director added:

> At the end of the film, I'd like the last milestone to be: "Claude Opus 5.5 (me) released." Your own arrival is a milestone too.

It became the last row of the list and the last item of the full-history replay. At the very end it sits just above a blinking cursor, with one line below:

> The next line is ours to write.

## 7. How the collaboration worked: what helped

1. **Consult first, build second.** Understand the brief, take the references apart, propose one decision with reasons, list the risks, and only then write code.
2. **Move forward through checkpoints**: keyframes → the hardest section → the full film. At every checkpoint the director saw the actual result (a web page, a video), not a description of it.
3. **The director gives feelings; Claude turns them into structure.** "Intense, surging, building layer upon layer" became "add one layer every eight bars". "Human history is a journey that keeps accelerating" became "a fixed tempo, with more milestones on every beat".
4. **Claude delivers decisions, not menus.** The director never had to choose between A, B and C. The director only had to say what was wrong.
5. **Measurement instead of impressions.** Claude cannot see motion or hear sound, so the measurement tools are its eyes and ears: `sync.py` for audio-visual sync, `rhythm.py` for pacing, and `check.sh` for frames sampled from the finished film. Every number is measured from the **rendered video**, not from browser screenshots.
6. **When overturned, change completely.** The single note "the density is too low" turned the film from maps and lights into a film driven by milestones.
7. **Honesty.** What was not fact-checked, what is illustrative, and what Claude could not verify are all written down.

## 8. Tools

- **Claude Opus 5.5**, running in **Claude Code**
- **Picture**: plain Canvas 2D with a hand-written 3D projection (`src/engine.js`). No WebGL and no frameworks
- **Rendering**: Node.js and playwright-core drive Google Chrome; ffmpeg muxes. During production every frame was a screenshot (15.5 minutes for the film); after release it switched to hardware encoding (1 minute 41 seconds), see [Fast rendering](fast-render.en.md)
- **Score**: Python, numpy and scipy
- **Maps**: Natural Earth (public domain)

For known limitations, see the [README](../README.md#known-limitations).
