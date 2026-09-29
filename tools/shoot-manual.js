/* 使い方ページ（#/help）の写真を撮る。画面を直したら、これで撮り直す。
   使い方：リポジトリの一番上で  python3 -m http.server 8080  を動かしてから
     node tools/shoot-manual.js            … 全部
     node tools/shoot-manual.js live qr    … 指定した項目だけ
   （Playwright が必要。グローバルに入っていれば NODE_PATH=$(npm root -g) を付ける）
   書き出すもの：assets/manual/<項目>.webp と assets/manual/marks.json（番号の吹き出しの位置。写真に対する %）。
   marks の順番は、app.js の MANUAL の pts のうち m:1 の付いたものと同じ順。
   予約番号とQRは撮らない：「予約とQR」は合言葉を入れる前の画面だけを撮る（合言葉は使わない）。
   地図の下地（地理院タイル）が取れない環境では、地図は無地で写る。「いまどのへん？」は列車が地上を走っている時刻で撮る（タイルの読み込みを25秒待つ）。
   FONT_VIA_CURL=1 を付けると、Google Fonts を curl で取り寄せる（ブラウザが外へ出られない作業環境向け）
   TILE_VIA_CURL=1 を付けると、地図タイルも curl で取り寄せる（端末に保存する係＝sw.js からタイルを取れない作業環境向け。
   PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 と一緒に使う） */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = path.join(__dirname, '..', 'assets', 'manual');
const VW = 390, VH = 844, DPR = 2, OUT_W = 600;           // 390×844 で撮り、幅600pxの webp にする
const jst = s => new Date(s + '+09:00');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 項目ごとの撮り方。at：時計（固定）、url：開くページ、prep：開いたあとの操作、marks：吹き出しを付ける要素、clip：切り抜き */
const SHOTS = {
  top: { at: '2026-10-10T10:00:00', url: '#/', wait: 1500,
    prep: async p => { await p.evaluate(() => { const rw = document.querySelector('.cover-rail').clientWidth + 'px'; document.querySelectorAll('.cover-train').forEach(t => { t.style.setProperty('--rw', rw); t.classList.remove('run'); void t.offsetWidth; t.classList.add('run'); }); }); await sleep(100);
      /* 2台の新幹線が表紙を走っているところ（手前ののぞみ風が奥のかもめ風を追い抜く前）で止める */
      await p.evaluate(() => document.getAnimations().forEach(a => { if (a.animationName === 'cv-run') { a.pause(); a.currentTime = a.effect.getComputedTiming().duration * (a.effect.target.classList.contains('nz') ? 0.3 : 0.62); } })); },
    marks: ['.cover .chip', '.cover-rail', '#today-top > .dc'], clip: { y: 0, h: 760 } },
  today: { at: '2026-10-19T09:40:00', url: '#/', wait: 1500,
    marks: ['#nav [data-tab="today"]', '#today-top > :first-child', '.nt-card'] },
  shift: { at: '2026-10-19T09:37:00', url: '#/trip/3', wait: 1500,
    prep: async p => { await p.evaluate(() => { localStorage.removeItem('shift'); document.querySelector('#it-2 .here').click(); }); await sleep(900);
      await p.evaluate(() => { const b = document.querySelector('.trip-sync'); scrollTo(0, b.getBoundingClientRect().top + scrollY - 76); }); await sleep(500); },
    marks: ['#it-2 .here', '.shift-bar', '#it-4 .est'] },
  search: { at: '2026-10-10T10:00:00', url: '#/map', wait: 1500,
    prep: async p => { await p.click('.topbar [data-act="toc"]'); await sleep(600); await p.fill('#srch', '駐車場'); await sleep(500); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(200); },
    marks: ['.srch-box', '.srch-res li:first-child'], clip: { from: '.sheet', pad: 16 } },
  ride: { at: '2026-10-10T10:00:00', url: '#/ride', wait: 1200,
    marks: ['.ride-live', '.ride-idx', '.segs', '.ticket-wrap'] },
  xfer: { at: '2026-10-10T10:00:00', url: 'transfer.html#s1', wait: 4000, page: true,
    marks: ['#back', '#scenes', '.route', '#play'] },
  live: { at: '2026-10-17T13:51:00', url: '#/ride/live/nozomi28', wait: 25000,
    prep: async p => { await p.evaluate(() => { const e = document.querySelector('#lm'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 8); }); await sleep(1500); },
    marks: ['.lm-train', '[data-lm="compass"]', '[data-lm="view"]', '[data-lm="full"]', '[data-lm="help"]', '#lm-panel', '#lm-spd'] },
  sim: { at: '2026-10-10T10:00:00', url: '#/', wait: 1500,
    prep: async p => { await p.evaluate(() => { document.querySelector('[data-try="nara"]').click(); }); await sleep(2500); await p.evaluate(() => scrollTo(0, 0)); await sleep(300); },
    marks: ['.sb-tag', ['[data-sim="toggle"]', '[data-sim="speed"]'], '.sb-stop', '#nav [data-tab="more"]'] },
  qr: { at: '2026-10-10T10:00:00', url: '#/', wait: 1500,
    prep: async p => { await p.evaluate(() => document.querySelector('[data-act="qr"]').click()); await sleep(900); await p.evaluate(() => document.activeElement && document.activeElement.blur()); },
    marks: ['#lock-pass', '#lockform button[type="submit"]'], clip: { from: '.sheet', pad: 16 } },
  a2hs: { at: '2026-10-10T10:00:00', url: '#/', wait: 1500,
    prep: async p => { await p.click('#nav [data-tab="more"]'); await sleep(500); await p.click('.sheet [data-act="a2hs"]'); await sleep(900); },
    marks: ['.a2-top', '[data-a2="yes"]'], clip: { from: '.sheet', pad: 16 } },
  fs: { at: '2026-10-10T10:00:00', url: '#/', wait: 1500,
    prep: async p => { await p.click('#nav [data-tab="more"]'); await sleep(500); await p.click('.sheet [data-fs="l"]'); await sleep(400);
      await p.evaluate(() => { const r = document.querySelector('.sheet [data-fs]').closest('.more-row'); r.scrollIntoView({ block: 'center' }); }); await sleep(400); },
    marks: ['.sheet .more-seg[aria-label="文字の大きさ"]', '.sheet .more-seg[aria-label="画面の明るさ"]'], clip: { around: '.sheet .more-rows', pad: 70 } },
  offline: { at: '2026-10-17T13:36:00', url: '#/ride/live/nozomi28', wait: 25000, offline: true,
    prep: async p => { await p.evaluate(() => { const e = document.querySelector('#lm-panel'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 330); }); await sleep(1500); },
    marks: ['.lm-badge', '#lm-map'] },
  news: { at: '2026-10-10T10:00:00', url: '#/', wait: 1500,
    prep: async p => { await p.click('.cover .bell'); await sleep(700); },
    marks: ['.cover .bell', '.sheet .nw'] },
  intro: { at: '2026-10-10T10:00:00', url: '#/help', wait: 1500,
    prep: async p => { await p.click('[data-act="intro"]'); await sleep(2500); await p.evaluate(() => { const v = document.querySelector('.in-slide video'); if (v) { v.pause(); v.currentTime = 1.5; } }); await sleep(800); },
    marks: ['.in-media', '.in-dots', '.in-skip'] },
  xhelp: { at: '2026-10-10T10:00:00', url: 'transfer.html#s1-guide', wait: 5000, page: true,
    marks: ['.gd-hole', '.gd-skip', '#xhelp'] }
};

async function fontRoute(ctx) {
  const cache = new Map();
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const u = route.request().url();
    try {
      if (!cache.has(u)) cache.set(u, execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36', u], { maxBuffer: 64 << 20 }));
      const ct = /googleapis/.test(u) ? 'text/css; charset=utf-8' : 'font/woff2';
      await route.fulfill({ status: 200, body: cache.get(u), headers: { 'content-type': ct, 'access-control-allow-origin': '*' } });
    } catch { await route.abort(); }
  });
}
async function tileRoute(ctx) {
  const cache = new Map();
  await ctx.route(/^https:\/\/(cyberjapandata\.gsi\.go\.jp|tile\.openstreetmap\.org)\//, async route => {
    const u = route.request().url();
    try {
      if (!cache.has(u)) cache.set(u, execFileSync('curl', ['-sSf', '--max-time', '20', '-A', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36', u], { maxBuffer: 16 << 20 }));
      await route.fulfill({ status: 200, body: cache.get(u), headers: { 'content-type': u.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 'access-control-allow-origin': '*' } });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
}
const rectOf = (p, sel) => p.evaluate(sel => {
  const one = s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const rs = (Array.isArray(sel) ? sel : [sel]).map(one).filter(Boolean);
  if (!rs.length) return null;
  return [Math.min(...rs.map(r => r[0])), Math.min(...rs.map(r => r[1])), Math.max(...rs.map(r => r[2])), Math.max(...rs.map(r => r[3]))];
}, sel);

(async () => {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const mfile = path.join(OUT, 'marks.json');
  const marks = fs.existsSync(mfile) ? JSON.parse(fs.readFileSync(mfile, 'utf8')) : {};
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const conv = await b.newPage();
  for (const [id, S] of Object.entries(SHOTS)) {
    if (only.length && !only.includes(id)) continue;
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' });
    if (process.env.FONT_VIA_CURL) await fontRoute(ctx);
    if (process.env.TILE_VIA_CURL) await tileRoute(ctx);
    await ctx.addInitScript(() => {
      const set = (k, v) => localStorage.getItem(k) === null && localStorage.setItem(k, v);
      set('a2hs', '"never"'); set('fam', '"yamaguchi"'); set('guide:app', '1'); set('guide:livemap', '1'); set('guide:intro', '1'); set('guide:xfer', '1');
      sessionStorage.setItem('askedFam', '1');
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.error(id, e.message));
    await p.clock.setFixedTime(jst(S.at));
    if (S.offline) {
      /* 一度開いて端末に保存させてから、電波を切って開き直す */
      await p.goto(BASE + 'index.html' + S.url); await sleep(S.wait);
      await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
      await p.reload(); await sleep(2000);
      await ctx.setOffline(true);
      await p.reload(); await sleep(S.wait);
    } else {
      await p.goto(BASE + (S.page ? S.url : 'index.html' + S.url)); await sleep(S.wait);
    }
    await p.addStyleTag({ content: '*{caret-color:transparent!important} .toast{display:none!important}' });
    if (S.prep) await S.prep(p);
    /* 切り抜き */
    let clip = { x: 0, y: 0, width: VW, height: VH };
    if (S.clip && S.clip.h) clip.height = S.clip.h;
    if (S.clip && S.clip.from) { const r = await rectOf(p, S.clip.from); clip.y = Math.max(0, r[1] - S.clip.pad); clip.height = VH - clip.y; }
    if (S.clip && S.clip.around) { const r = await rectOf(p, S.clip.around); clip.y = Math.max(0, r[1] - S.clip.pad); clip.height = Math.min(VH - clip.y, r[3] - r[1] + S.clip.pad * 2); }
    const png = await p.screenshot({ clip });
    const ms = [];
    for (const sel of S.marks) {
      const r = await rectOf(p, sel);
      if (!r) { console.warn(`${id}: 見つからない ${sel}`); ms.push(null); continue; }
      const pad = 3, x0 = Math.max(6, r[0] - pad), y0 = Math.max(clip.y, r[1] - pad), x1 = Math.min(VW - 2, r[2] + pad), y1 = Math.min(clip.y + clip.height, r[3] + pad);
      const pc = v => Math.round(v * 1000) / 10;
      ms.push([pc(x0 / VW), pc((y0 - clip.y) / clip.height), pc((x1 - x0) / VW), pc((y1 - y0) / clip.height)]);
    }
    /* PNG → 幅600pxの webp */
    const webp = await conv.evaluate(async ({ b64, w }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const h = Math.round(img.height * w / img.width), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
      return [c.toDataURL('image/webp', 0.8), h];
    }, { b64: png.toString('base64'), w: OUT_W });
    const file = path.join(OUT, id + '.webp');
    fs.writeFileSync(file, Buffer.from(webp[0].split(',')[1], 'base64'));
    marks[id] = { w: OUT_W, h: webp[1], marks: ms };
    console.log(`${id}.webp  ${OUT_W}×${webp[1]}  ${Math.round(fs.statSync(file).size / 1024)}KB  吹き出し ${ms.filter(Boolean).length}/${ms.length}`);
    await ctx.close();
  }
  fs.writeFileSync(mfile, JSON.stringify(marks, null, 1) + '\n');
  await b.close();
  const total = fs.readdirSync(OUT).filter(f => f.endsWith('.webp')).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`合計 ${Math.round(total / 1024)}KB`);
})();
