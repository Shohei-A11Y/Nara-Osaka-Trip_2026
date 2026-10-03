/* 電波が弱い場所でも見られるように、しおり本体を端末に保存する */
const CACHE = 'shiori-v32';
const TILES = 'shiori-tiles';     // 地図タイル：見た分だけ保存（地図の種類は分けず、全体でおよそ300枚まで。古いものから消す。航空写真は保存しない）
const TILE_MAX = 300;
const ML = 'assets/vendor/maplibre-gl/';
const TH = 'assets/vendor/three/';      // 駅の乗り換え（3D）だけで使う。ページを開いたときだけ読み込むが、電波がなくても開けるように保存しておく
const MAN = 'assets/manual/';          // 使い方ページの写真（電波がなくても見られるように保存）
const INTRO = 'assets/intro/';         // 機能紹介の動画と、止まった1コマ（電波がなくても再生できるように保存）
const BUDGET = 'assets/budget.json';     // 予算：管理ページから公開側を直接直すので、?v= を付けずにいつも最新を取りに行く
const FILES = ['./', 'index.html', 'assets/style.css?v=32', 'assets/sim.js?v=32', 'assets/data.js?v=32', 'assets/timetable.js?v=32', 'assets/timetable-data.js?v=32', 'assets/line-data.js?v=32', 'assets/guide.js?v=32', 'assets/news.js?v=32', 'assets/latest.js?v=32', 'assets/budget.js?v=32', 'assets/livemap.js?v=32', 'assets/app.js?v=32', 'assets/line-sanyo.json?v=32', 'assets/line-relay.json?v=32', 'assets/area.json?v=32', 'assets/drive-route.json?v=32', BUDGET,
  ML + 'maplibre-gl.mjs', ML + 'maplibre-gl-shared.mjs', ML + 'maplibre-gl-worker.mjs', ML + 'maplibre-gl.css',
  'transfer.html', TH + 'three.module.min.js?v=32', TH + 'addons/controls/OrbitControls.js', TH + 'addons/renderers/CSS2DRenderer.js', TH + 'addons/utils/BufferGeometryUtils.js',
  TH + 'addons/lines/Line2.js', TH + 'addons/lines/LineMaterial.js', TH + 'addons/lines/LineGeometry.js', TH + 'addons/lines/LineSegments2.js', TH + 'addons/lines/LineSegmentsGeometry.js',
  'assets/train-sprite.webp?v=32', 'assets/train-787.webp?v=32',   // いまどのへん？の列車の印（36方向。のぞみ・リレーかもめ）
  MAN + 'marks.json?v=32', ...['top', 'today', 'shift', 'search', 'ride', 'xfer', 'live', 'sim', 'qr', 'a2hs', 'fs', 'offline', 'news', 'intro', 'xhelp'].map(k => MAN + k + '.webp?v=32'),
  ...['live', 'xfer'].flatMap(k => [INTRO + k + '.mp4?v=32', INTRO + k + '.webp?v=32']),
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
let puts = 0;
const trimTiles = c => c.keys().then(ks => Promise.all(ks.slice(0, Math.max(0, ks.length - TILE_MAX)).map(k => c.delete(k))));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.endsWith('.mp4')) {
    // 動画：保存分を優先。iPhone の Safari は一部分ずつ（Range）読むので、保存した全体から切り出して返す
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreVary: true }).then(hit => hit || fetch(e.request.url).then(res => {
      if (res.ok && res.status === 200) { const cp = res.clone(); e.waitUntil(c.put(e.request.url, cp)); }
      return res;
    })).then(res => ranged(e.request, res))));
  } else if (url.origin === location.origin && url.pathname.endsWith('/' + BUDGET)) {
    // 予算：ネット優先（ブラウザの保存も使わずに最新を取りに行く）。取れたら保存し、圏外のときは最後に取れた値
    e.respondWith(fetch(e.request.url, { cache: 'no-store' }).then(r => { if (r.ok) { const cp = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(BUDGET, cp))); } return r; })
      .catch(() => caches.open(CACHE).then(c => c.match(BUDGET, { ignoreSearch: true })).then(r => r || Response.error())));
  } else if (url.origin === location.origin) {
    // 自分のファイル：まずネット、だめなら保存分
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match(e.request, { ignoreSearch: true })).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
  } else if (url.host === 'cyberjapandata.gsi.go.jp' && /\/(seamlessphoto|dem_png)\//.test(url.pathname)) {
    // 航空写真と標高（立体表示の地形）：保存しない（ネットから取るだけ）。地図タイルの保存枠を使わないように。圏外では地形が平らになるだけ
    return;
  } else if (url.host === 'cyberjapandata.gsi.go.jp' || url.host === 'tile.openstreetmap.org') {
    // 地図タイル：保存分を優先。新しく取れたものは保存し、多すぎたら古いものから消す
    e.respondWith(caches.open(TILES).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const cp = res.clone(); e.waitUntil(c.put(e.request, cp).then(() => (++puts % 20 === 0 ? trimTiles(c) : null))); }
      return res;
    }))));
  } else if (url.host.includes('fonts.g')) {
    // フォント：保存分を優先
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })));
  }
});
/* Range の付いた読み込みには、206（一部分）で返す */
async function ranged(req, res) {
  const range = req.headers.get('range');
  if (!range || !res || res.status !== 200) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? +m[1] : Math.max(0, size - +(m[2] || size)), end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': res.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
/* 降車のお知らせの通知を押したら、ライブ地図を開く */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.split('#')[0] === url.split('#')[0]);
    if (c) return c.focus().then(w => (w || c).navigate ? (w || c).navigate(url) : null).catch(() => null);
    return self.clients.openWindow(url);
  }));
});
