/* いまどのへん？の列車の印（assets/train-sprite.webp）を書き出す。
   使い方：リポジトリの一番上で  python3 -m http.server 8080  を動かしてから
     node tools/make-train-sprite.js
   （Playwright が必要。グローバルに入っていれば NODE_PATH=$(npm root -g) を付ける） */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8080/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.error(e.message));
  await p.goto(BASE + 'tools/train-sprite.html');
  await p.waitForFunction(() => window.SPRITE, null, { timeout: 60000 });
  const s = await p.evaluate(() => window.SPRITE);
  const out = path.join(__dirname, '..', 'assets', 'train-sprite.webp');
  fs.writeFileSync(out, Buffer.from(s.data.split(',')[1], 'base64'));
  console.log(`${out}  ${fs.statSync(out).size} bytes  コマ ${s.fw}×${s.fh}・${s.n}枚・地面の中心 y=${s.originY.toFixed(1)}px`);
  if (process.argv.includes('--preview')) await p.screenshot({ path: path.join(__dirname, 'train-sprite-preview.png'), fullPage: true });
  await b.close();
})();
