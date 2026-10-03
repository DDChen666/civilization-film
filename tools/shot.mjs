// 截一張整頁的圖來檢查版面： node tools/shot.mjs <html> <out.png> [寬]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
const [html, out, w = '1280'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: +w, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(pathToFileURL(html).href); await p.waitForTimeout(600);
await p.screenshot({ path: out, fullPage: true });
console.log(out, errs.length ? '錯誤：' + errs.join(' | ') : '沒有錯誤');
await b.close();
