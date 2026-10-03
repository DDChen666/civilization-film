#!/usr/bin/env node
// 逐格輸出：把合成頁（window.__seek(t)）一格一格畫出來，編成影片。
//
// 影片有兩種引擎（--engine auto 預設）：
//   fast：在頁面裡把子格疊成動態模糊，直接交給 Mac 的硬體編碼器（WebCodecs → VideoToolbox），
//         不截圖、不經過 JPEG。比 shot 快一個數量級以上。合成頁只有一張 <canvas> 時自動使用
//         （或頁面自己指定 window.__canvas）。
//   shot：舊做法，逐格截圖交給 ffmpeg。畫面裡有 HTML 元素（不是全畫在畫布上）時用這個。
//
//   node render.mjs sheet --times 0.5,2,4.1,6 [--cols 4] [--out out/sheet.png]   先看關鍵格（最常用）
//   node render.mjs sheet --every 0.5 [--from 0 --to 8]                          每 0.5 秒一格的總覽
//   node render.mjs strip --at 4.2 [--n 12]                                      某一刻前後的連續格（檢查快動作、疊字）
//   node render.mjs video [--out out/draft.mp4] [--fps 30] [--sub 4] [--workers 4] [--audio mix.wav]
//   node render.mjs video --final                                                4K60（?scale=2、60fps、sub 8），定稿後才跑
//   node render.mjs events [--out out/events.json]                               匯出 __events() 給聲音用
//
// 共用參數：--html stage.html（預設）、--from/--to 秒、--crf 16（shot）、--mbps 20（fast 的位元率，預設依解析度與影格率換算）
// --png：截圖用無損 PNG（草稿預設用 JPEG，快很多；--final 預設用 PNG）
// --grain 6：在編碼階段加底片顆粒（不要在頁面裡畫顆粒：每一格都會變得無法壓縮，也讓靜止格不再靜止）
// --sub N：每一格在快門開啟期間取 N 個子格平均，做出真正的動態模糊（--shutter 0.5 ＝ 180° 快門）。
// 需要：Node 18+、本機 Google Chrome、ffmpeg；npm i playwright-core
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const mode = argv[0] ?? 'sheet';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const ROOT = process.cwd();
const HTML = opt('html', 'stage.html');
const FINAL = flag('final');
const FPS = +opt('fps', FINAL ? 60 : 30);
const SUB = Math.max(1, +opt('sub', FINAL ? 8 : 4));
const SHUTTER = +opt('shutter', 0.5);
const SCALE = +opt('scale', FINAL ? 2 : 1);
const PNG = flag('png') || (FINAL && !flag('jpeg'));
const GRAIN = +opt('grain', 0);
const WORKERS = Math.max(1, +opt('workers', Math.min(6, Math.max(1, os.cpus().length - 2))));
const W = 1920, H = 1080;
const ENGINE = opt('engine', 'auto');                          // auto | fast | shot
const FAST_WORKERS = Math.max(1, +opt('workers', 3));          // fast 受 GPU 與硬體編碼器限制，開太多反而慢（M3 實測見 docs/fast-render.zh-TW.md）

// 用本機的小型靜態伺服器開頁面：file:// 載不了字體和 JSON
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/favicon')) { res.writeHead(204); res.end(); return; }
  try {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside root');
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_BASE = `http://127.0.0.1:${server.address().port}/${HTML}${SCALE !== 1 ? `${HTML.includes('?') ? '&' : '?'}scale=${SCALE}` : ''}`;

async function openPage() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-color-profile=srgb', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(String(e)));
  await page.goto(URL_BASE);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__ready);
  const meta = await page.evaluate(() => window.__meta);
  return { browser, page, meta, logs };
}
const shot = async (page, t, png = true) => {
  await page.evaluate((x) => window.__seek(x), t);
  return page.screenshot(png ? { type: 'png', clip: { x: 0, y: 0, width: W, height: H } } : { type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: W, height: H } });
};
const ffmpeg = (args, stdin) => new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: [stdin ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exit ${c}`))));
  if (stdin) stdin(p.stdin);
});
const write = (s, buf) => new Promise((r) => (s.write(buf) ? r() : s.once('drain', r)));

async function tiled(times, cols, cell, out) {
  const { browser, page, logs } = await openPage();
  await mkdir(path.dirname(out), { recursive: true });
  const rows = Math.ceil(times.length / cols);
  await ffmpeg(['-f', 'image2pipe', '-framerate', '1', '-i', '-', '-vf', `scale=${cell}:-1,tile=${cols}x${rows}:padding=4:color=0x222222`, '-frames:v', '1', out], async (stdin) => {
    for (const t of times) await write(stdin, await shot(page, t));
    stdin.end();
  });
  await browser.close();
  console.log(out);
  console.log('時間（由左到右、由上到下）：' + times.map((t) => t.toFixed(2)).join(' '));
  if (logs.length) console.error('頁面錯誤：\n' + logs.slice(0, 20).join('\n'));
}

// ── fast 引擎 ────────────────────────────────────────────────────────────────
// 頁面裡：__seek → 疊進累積畫布（子格的連續平均）→ VideoFrame → VideoEncoder（H.264 Annex B）
// → 每累積幾 MB 用 base64 交回 Node 寫進分段檔。各段從關鍵格開始，最後直接接起來。
async function fastProbe(page) {
  return page.evaluate(async () => {
    if (typeof VideoEncoder === 'undefined') return { ok: false, why: '這個瀏覽器沒有 WebCodecs' };
    const cvs = [...document.querySelectorAll('canvas')];
    const src = window.__canvas || (cvs.length === 1 ? cvs[0] : null);
    if (!src) return { ok: false, why: cvs.length ? '頁面有多張畫布，請設定 window.__canvas' : '頁面沒有畫布' };
    // 畫布以外還有看得見的元素 → 那些元素不會被編進影片，改用 shot
    const extra = [...document.body.querySelectorAll('*')].filter((el) => el !== src && !['SCRIPT', 'STYLE', 'CANVAS'].includes(el.tagName) && (() => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })() && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0);
    if (extra.length && !window.__canvas) return { ok: false, why: `畫布以外有 ${extra.length} 個看得見的元素` };
    return { ok: true, w: src.width, h: src.height };
  });
}
function h264Codec(w, h, fps) {
  const mbps = (w * h * fps) / 1e6;                              // 每秒百萬像素，決定 H.264 的 level
  return mbps <= 62.9 ? 'avc1.640028' : mbps <= 133.7 ? 'avc1.64002a' : mbps <= 267.4 ? 'avc1.640033' : 'avc1.640034';
}
async function encodeRange(a, b, w, h, out, onFrames) {
  const { createWriteStream } = await import('node:fs');
  const ws = createWriteStream(out);
  const { browser, page, logs } = await openPage();
  await page.exposeFunction('__out', (b64) => new Promise((r) => (ws.write(Buffer.from(b64, 'base64')) ? r() : ws.once('drain', r))));
  await page.exposeFunction('__tick', (n) => onFrames(n));
  const bitrate = Math.round(+opt('mbps', Math.min(120, (20 * w * h * FPS) / (1920 * 1080 * 30))) * 1e6);
  const res = await page.evaluate(async ({ a, b, w, h, FPS, SUB, SHUTTER, codec, bitrate }) => {
    const cvs = document.querySelectorAll('canvas');
    const src = window.__canvas || cvs[0];
    const acc = new OffscreenCanvas(w, h), g = acc.getContext('2d', { alpha: false });
    let err = null, buf = [], bytes = 0;
    const send = async () => {
      if (!buf.length) return;
      const parts = buf, n = bytes; buf = []; bytes = 0;
      const all = new Uint8Array(n); let o = 0; for (const u of parts) { all.set(u, o); o += u.length; }
      let s = ''; for (let i = 0; i < n; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
      await window.__out(btoa(s));
    };
    const enc = new VideoEncoder({
      output: (c) => { const u = new Uint8Array(c.byteLength); c.copyTo(u); buf.push(u); bytes += u.length; },
      error: (e) => (err = String(e)),
    });
    const cfg = { codec, width: w, height: h, bitrate, framerate: FPS, hardwareAcceleration: 'prefer-hardware', latencyMode: 'quality', avc: { format: 'annexb' } };
    const sup = await VideoEncoder.isConfigSupported(cfg);
    if (!sup.supported) return { err: `編碼設定不支援：${codec} ${w}×${h}@${FPS}` };
    enc.configure(cfg);
    const gop = FPS * 2;
    for (let n = a; n < b; n++) {
      for (let j = 0; j < SUB; j++) {
        const u = SUB > 1 ? ((j + 0.5) / SUB - 0.5) * SHUTTER : 0;      // 快門以這一格的時間為中心
        window.__seek(Math.max(0, (n + u) / FPS));
        g.globalAlpha = 1 / (j + 1);                                      // 連續平均：第 j 張佔 1/(j+1)
        g.drawImage(src, 0, 0, w, h);
      }
      g.globalAlpha = 1;
      const f = new VideoFrame(acc, { timestamp: Math.round(((n - a) * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(f, { keyFrame: (n - a) % gop === 0 });
      f.close();
      while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 0));
      if (bytes > 4e6) await send();
      if ((n - a) % 10 === 9) window.__tick(10);
      if (err) break;
    }
    if (!err) { await enc.flush(); await send(); window.__tick((b - a) % 10); }
    enc.close();
    return { err };
  }, { a, b, w, h, FPS, SUB, SHUTTER, codec: h264Codec(w, h, FPS), bitrate });
  await browser.close();
  await new Promise((r) => ws.end(r));
  if (res.err) throw new Error(res.err + (logs.length ? '\n' + logs.slice(0, 10).join('\n') : ''));
  if (logs.length) console.error('\n頁面錯誤：\n' + logs.slice(0, 10).join('\n'));
}
async function videoFast(meta, probe) {
  const { createReadStream, createWriteStream } = await import('node:fs');
  const from = +opt('from', 0), to = +opt('to', meta.dur);
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS), total = n1 - n0;
  const out = path.resolve(opt('out', FINAL ? 'out/final.mp4' : 'out/draft.mp4'));
  const tmp = path.join(path.dirname(out), `.render_${Date.now()}`);
  await mkdir(tmp, { recursive: true });
  const nW = Math.min(FAST_WORKERS, Math.max(1, Math.floor(total / 60)));
  const per = Math.ceil(total / nW);
  let done = 0; const t0 = Date.now();
  const tick = (k) => { done += k; const el = (Date.now() - t0) / 1000; process.stdout.write(`\r${done}/${total} 格  ${(done / el).toFixed(1)} 格/秒  剩約 ${Math.round((total - done) / Math.max(0.1, done / el))} 秒   `); };
  console.log(`輸出 ${total} 格（${probe.w}×${probe.h}、${FPS}fps、每格 ${SUB} 個子格、${nW} 個瀏覽器、fast：硬體編碼 ${h264Codec(probe.w, probe.h, FPS)}）`);
  const parts = await Promise.all(Array.from({ length: nW }, async (_, k) => {
    const a = n0 + k * per, b = Math.min(n1, a + per);
    if (a >= b) return null;
    const part = path.join(tmp, `part_${String(k).padStart(2, '0')}.h264`);
    await encodeRange(a, b, probe.w, probe.h, part, tick);
    return part;
  }));
  // 每段都從關鍵格開始、帶著自己的參數集，Annex B 可以直接首尾相接
  const all = path.join(tmp, 'all.h264');
  const ws = createWriteStream(all);
  for (const p of parts.filter(Boolean)) await new Promise((r, j) => { const rs = createReadStream(p); rs.on('error', j); rs.on('end', r); rs.pipe(ws, { end: false }); });
  await new Promise((r) => ws.end(r));
  const audio = opt('audio');
  const args = ['-fflags', '+genpts', '-r', String(FPS), '-f', 'h264', '-i', all];
  if (audio && existsSync(audio)) args.push('-ss', String(from), '-t', String(to - from), '-i', audio);
  args.push('-map', '0:v');
  if (audio && existsSync(audio)) args.push('-map', '1:a');
  if (GRAIN > 0) args.push('-vf', `noise=alls=${GRAIN}:allf=t+u,scale=out_color_matrix=bt709`, '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('crf', '16'), '-tune', 'grain', '-pix_fmt', 'yuv420p');
  else args.push('-c:v', 'copy', '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0');
  // 一定要標 BT.709：不標的話 QuickTime 會把顏色洗白
  args.push('-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
  if (audio && existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
  args.push('-movflags', '+faststart', out);
  await ffmpeg(args);
  await rm(tmp, { recursive: true, force: true });
  console.log(`\n完成：${out}（${((Date.now() - t0) / 1000).toFixed(0)} 秒，平均 ${(total / ((Date.now() - t0) / 1000)).toFixed(1)} 格/秒）`);
  const pr = spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets:format=duration', '-of', 'csv=p=0', out]).stdout.toString().trim().split(/\s+/);
  console.log(`長度 ${pr[pr.length - 1]} 秒、${pr[0]} 格；預期 ${(to - from).toFixed(3)} 秒、${total} 格`);
}

try {
  if (mode === 'sheet') {
    const { browser, meta } = await openPage(); await browser.close();
    let times;
    if (opt('times')) times = opt('times').split(',').map(Number);
    else { const step = +opt('every', 0.5), a = +opt('from', 0), b = +opt('to', meta.dur); times = []; for (let t = a; t < b - 1e-6; t += step) times.push(t); }
    await tiled(times, +opt('cols', Math.min(6, times.length)), +opt('cell', 480), opt('out', 'out/sheet.png'));
  } else if (mode === 'strip') {
    const at = +opt('at', 0), n = +opt('n', 12), fps = +opt('fps', 30);
    await tiled(Array.from({ length: n }, (_, i) => at + (i - Math.floor(n / 3)) / fps), n > 8 ? Math.ceil(n / 2) : n, +opt('cell', 400), opt('out', 'out/strip.png'));
  } else if (mode === 'events') {
    const { browser, page } = await openPage();
    const ev = await page.evaluate(() => ({ meta: window.__meta, events: window.__events ? window.__events() : [] }));
    await browser.close();
    const out = opt('out', 'out/events.json');
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(ev, null, 1));
    console.log(out, `${ev.events.length} 個事件`);
  } else if (mode === 'video') {
    const probe = await openPage(); const meta = probe.meta;
    const fp = ENGINE === 'shot' ? { ok: false, why: '指定 --engine shot' } : await fastProbe(probe.page);
    await probe.browser.close();
    if (ENGINE === 'fast' && !fp.ok) throw new Error(`不能用 fast 引擎：${fp.why}`);
    if (fp.ok) { await videoFast(meta, fp); }
    else {
    if (ENGINE === 'auto') console.log(`用 shot 引擎（${fp.why}）`);
    const from = +opt('from', 0), to = +opt('to', meta.dur);
    const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS), total = n1 - n0;
    const out = path.resolve(opt('out', FINAL ? 'out/final.mp4' : 'out/draft.mp4'));
    const tmp = path.join(path.dirname(out), `.render_${Date.now()}`);
    await mkdir(tmp, { recursive: true });
    const nW = Math.min(WORKERS, Math.max(1, Math.floor(total / 30)));
    const per = Math.ceil(total / nW);
    let done = 0; const t0 = Date.now();
    console.log(`輸出 ${total} 格（${W * SCALE}×${H * SCALE}、${FPS}fps、每格 ${SUB} 個子格、${nW} 個瀏覽器、截圖 ${PNG ? 'PNG' : 'JPEG'}）`);
    const parts = await Promise.all(Array.from({ length: nW }, async (_, w) => {
      const a = n0 + w * per, b = Math.min(n1, a + per);
      if (a >= b) return null;
      const part = path.join(tmp, `part_${String(w).padStart(2, '0')}.mp4`);
      const { browser, page, logs } = await openPage();
      // 子格平均：tmix 取最近 SUB 張平均，select 只留每組最後一張
      const vf = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB` : 'null';
      await ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS * SUB), '-i', '-', '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', part], async (stdin) => {
        for (let n = a; n < b; n++) {
          for (let j = 0; j < SUB; j++) {
            const u = SUB > 1 ? ((j + 0.5) / SUB - 0.5) * SHUTTER : 0;   // 快門以這一格的時間為中心
            await write(stdin, await shot(page, Math.max(0, (n + u) / FPS), PNG));
          }
          if (++done % 30 === 0) { const el = (Date.now() - t0) / 1000; process.stdout.write(`\r${done}/${total} 格  ${(done / el).toFixed(1)} 格/秒  剩約 ${Math.round((total - done) / (done / el))} 秒   `); }
        }
        stdin.end();
      });
      await browser.close();
      if (logs.length) console.error(`\n頁面錯誤（工作 ${w}）：\n` + logs.slice(0, 10).join('\n'));
      return part;
    }));
    const list = path.join(tmp, 'list.txt');
    await writeFile(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
    const audio = opt('audio');
    const args = ['-f', 'concat', '-safe', '0', '-i', list];
    if (audio && existsSync(audio)) args.push('-ss', String(from), '-t', String(to - from), '-i', audio);
    // 一定要標 BT.709：不標的話 QuickTime 會把顏色洗白
    const grain = GRAIN > 0 ? `noise=alls=${GRAIN}:allf=t+u,` : '';
    args.push('-vf', `${grain}scale=out_color_matrix=bt709,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`, '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('crf', '16'), '-pix_fmt', 'yuv420p');
    if (GRAIN > 0) args.push('-tune', 'grain');
    if (audio && existsSync(audio)) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
    args.push('-movflags', '+faststart', out);
    await ffmpeg(args);
    await rm(tmp, { recursive: true, force: true });
    console.log(`\n完成：${out}（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
    const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).stdout.toString().trim();
    console.log(`長度 ${d} 秒，預期 ${(to - from).toFixed(3)} 秒`);
    }
  } else console.error(`不認得的模式：${mode}`);
} finally {
  server.close();
}
