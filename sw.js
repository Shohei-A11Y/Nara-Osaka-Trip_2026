/* 電波が弱い場所でも見られるように、しおり本体を端末に保存する */
const CACHE = 'shiori-v1';
const FILES = ['./', 'index.html', 'assets/style.css?v=1', 'assets/data.js?v=1', 'assets/app.js?v=1', 'assets/icon.svg', 'assets/qr/r1.svg', 'assets/qr/r2.svg', 'assets/qr/r3.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // 自分のファイル：まずネット、だめなら保存分
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
  } else if (url.host.includes('fonts.g')) {
    // フォント：保存分を優先
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })));
  }
});
