/* LINE などでURLを送ったときに出る画像（assets/og.jpg、1200×630）を書き出す。
   トップの表紙（旅行前の見た目）を撮り、和紙色の台紙の左に置いて、右に題を添える。
   家族の名前（右上の家族ボタン）・お知らせの数・予約番号・QR・合言葉は写さない（表紙の上の小さなボタンは隠して撮る）。
   使い方：リポジトリの一番上で  python3 -m http.server 8080  を動かしてから
     FONT_VIA_CURL=1 node tools/make-og.js
   （Playwright が必要。グローバルに入っていれば NODE_PATH=$(npm root -g) を付ける。
    FONT_VIA_CURL=1 は、ブラウザが外へ出られない作業環境で Google Fonts を curl で取り寄せる） */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = path.join(__dirname, '..', 'assets', 'og.jpg');

async function fontRoute(ctx) {
  const cache = new Map();
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const u = route.request().url();
    try {
      if (!cache.has(u)) cache.set(u, execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36', u], { maxBuffer: 64 << 20 }));
      await route.fulfill({ status: 200, body: cache.get(u), headers: { 'content-type': /googleapis/.test(u) ? 'text/css; charset=utf-8' : 'font/woff2', 'access-control-allow-origin': '*' } });
    } catch { await route.abort(); }
  });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  if (process.env.FONT_VIA_CURL) await fontRoute(ctx);
  await ctx.addInitScript(() => {
    ['a2hs', 'guide:app', 'guide:livemap', 'guide:intro', 'guide:xfer'].forEach(k => localStorage.setItem(k, k === 'a2hs' ? '"never"' : '1'));
    sessionStorage.setItem('askedFam', '1');
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error(e.message));
  await p.clock.setFixedTime(new Date('2026-10-10T10:00:00+09:00'));
  await p.goto(BASE + 'index.html#/');
  await p.waitForTimeout(2500);
  /* 右上のボタン（お知らせ・家族）は写さない。新幹線は、のぞみ風を表紙の中ほどに止める */
  await p.addStyleTag({ content: '.cover-acts{visibility:hidden!important} .toast,.sheet-bg{display:none!important}' });
  await p.evaluate(() => {
    const rw = document.querySelector('.cover-rail').clientWidth + 'px';
    document.querySelectorAll('.cover-train').forEach(t => { t.style.setProperty('--rw', rw); t.classList.remove('run'); void t.offsetWidth; t.classList.add('run'); });
    document.getAnimations().forEach(a => { if (a.animationName === 'cv-run') { a.pause(); a.currentTime = a.effect.getComputedTiming().duration * (a.effect.target.classList.contains('nz') ? 0.34 : 0.08); } if (a.animationName === 'ink') a.finish(); });
  });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const c = document.querySelector('.cover').getBoundingClientRect(); return { x: c.left, y: c.top, width: c.width, height: Math.min(c.height, document.querySelector('.cover-bottom').getBoundingClientRect().bottom + 6) }; });
  const shot = (await p.screenshot({ clip: r })).toString('base64');

  /* 台紙に組む */
  const card = await b.newPage({ viewport: { width: 1200, height: 630 } });
  if (process.env.FONT_VIA_CURL) await fontRoute(card.context());
  await card.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Shippori+Mincho+B1:wght@700;800&family=Zen+Kaku+Gothic+New:wght@500&display=swap" rel="stylesheet">
    <style>
      body { margin: 0; width: 1200px; height: 630px; background: #f4f2ec; display: flex; align-items: center; gap: 64px; padding: 0 70px 0 64px; box-sizing: border-box; font-family: 'Zen Kaku Gothic New', sans-serif; color: #2b2a28; }
      img { height: 560px; border-radius: 18px; box-shadow: 0 10px 34px rgba(60, 40, 20, .18); }
      .t { display: grid; gap: 18px; }
      .lat { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 38px; color: #b8433f; }
      h1 { margin: 0; font-family: 'Shippori Mincho B1', serif; font-weight: 800; font-size: 86px; letter-spacing: .12em; line-height: 1.1; }
      .sub { font-family: 'Shippori Mincho B1', serif; font-weight: 700; font-size: 44px; letter-spacing: .14em; }
      .d { font-size: 30px; letter-spacing: .06em; color: #67625b; border-top: 2px solid #d6504c; padding-top: 18px; width: fit-content; }
    </style></head><body>
    <img src="data:image/png;base64,${shot}" alt="">
    <div class="t"><div class="lat">Nara &amp; Osaka</div><h1>旅のしおり</h1><div class="sub">家族旅行　奈良・大阪</div><div class="d">2026.10.17 — 10.20　3泊4日</div></div>
    </body></html>`, { waitUntil: 'networkidle' });
  await card.evaluate(() => document.fonts.ready);
  fs.writeFileSync(OUT, await card.screenshot({ type: 'jpeg', quality: 86 }));
  console.log(`${OUT}  ${Math.round(fs.statSync(OUT).size / 1024)}KB`);
  await b.close();
})();
