// 開合成頁，印出頁面上的錯誤： node tools/pageerr.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = process.cwd();
const srv = createServer(async (req, res) => { try { const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const d = await readFile(p); res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'text/html' }); res.end(d); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.stack || String(e)));
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto(`http://127.0.0.1:${srv.address().port}/stage.html`);
await p.waitForTimeout(6000);
console.log(await p.evaluate(() => typeof City + ' ' + typeof Film + ' ' + typeof Land));
await b.close(); srv.close();
