/* ライブ地図（のぞみ車内用）
   「新大阪から何km地点か」という1つの数値で、列車の位置を管理する。
   - 時刻表からの推定：駅と駅の間は、時間に比例して進む（＝区間の平均速度で走る）とみなす
   - GPS：線路に吸着してkmに直し、時刻表とのずれ（遅れ）を記録。GPSが途切れたら「時刻表＋記録した遅れ」で進める
   地図（MapLibre GL JS）は後から読み込む。読み込めなくても、位置・パネル・お知らせ・一覧はそのまま動く。
   位置情報はこの端末の中だけで使い、どこにも送らない。 */
(() => {
  'use strict';
  const T = window.TRIP, L = window.LINE, Clock = window.Clock, Geo = window.Geo;
  if (!T || !L || !Clock || !Geo) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MIN = 6e4;
  const MAPLIBRE = 'assets/vendor/maplibre-gl/maplibre-gl.mjs';
  const LINE_URL = 'assets/line-sanyo.json?v=21';
  const GPS_MAX_OFF = 0.5, GPS_MAX_ACC = 1000, GPS_MAX_AGE = 30e3, V_MAX = 330;

  /* ========== 線路の形（km ⇔ 緯度経度） ========== */
  const R = 6371.0088, rad = d => d * Math.PI / 180;
  const hav = (a, b) => { const la1 = rad(a[1]), la2 = rad(b[1]); const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(rad(b[0] - a[0]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  let geom = null;
  const setGeom = coords => { const cum = [0]; for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + hav(coords[i - 1], coords[i])); geom = { coords, cum }; };
  /* 線路の形が読めるまでは、駅と駅を直線で結んだ線で代用する */
  setGeom(L.stations.map(s => [s[2], s[1]]));
  geom.fallback = true;
  { const cum = L.stations.map(s => s[3]); geom.cum = cum; }
  let lineGeo = null;
  const lineReady = fetch(LINE_URL).then(r => r.json()).then(g => { lineGeo = g; setGeom(g.features[0].geometry.coordinates); return g; }).catch(() => null);

  function pointAt(km) {
    const { coords: c, cum } = geom;
    if (km <= cum[0]) return c[0];
    if (km >= cum[cum.length - 1]) return c[c.length - 1];
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; cum[m] <= km ? (lo = m) : (hi = m); }
    const t = (km - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    return [c[lo][0] + (c[hi][0] - c[lo][0]) * t, c[lo][1] + (c[hi][1] - c[lo][1]) * t];
  }
  function snap(lat, lon) {
    const { coords: c, cum } = geom, kx = Math.cos(rad(lat)) * 111.32, ky = 110.57;
    let best = { off: Infinity, km: 0 };
    for (let i = 0; i < c.length - 1; i++) {
      const ax = (c[i][0] - lon) * kx, ay = (c[i][1] - lat) * ky, bx = (c[i + 1][0] - lon) * kx, by = (c[i + 1][1] - lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best.off) best = { off: d, km: cum[i] + t * (cum[i + 1] - cum[i]) };
    }
    return best;
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1])), x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const bearingAt = (km, dir) => bearing(pointAt(km - 0.6 * dir), pointAt(km + 0.6 * dir));
  const muniAt = km => { let n = L.munis[0][1]; for (const m of L.munis) { if (m[0] <= km) n = m[1]; else break; } return n; };
  const tunnelAt = km => L.tunnels.find(t => t[0] <= km && km <= t[1]) || null;
  /* 「岡山県 浅口市付近」：府県名を添え、郡部の町村は郡名を省く（浅口郡里庄町 → 里庄町）。長いときは府県名を小さく上に添える2段にする */
  const splitMuni = m => { const x = /^(.+?[都道府県])(.*)$/.exec(m) || [, '', m]; return { pref: x[1], city: x[2].replace(/^.+?郡(?=.+?[町村]$)/, '') }; };
  const prefAt = km => splitMuni(muniAt(km)).pref || null;   // 関門海峡の海底は null
  const whereHTML = m => {
    if (m === '関門海峡の海底') return '関門海峡の海底を走行中';
    const { pref, city } = splitMuni(m);
    return `<span class="lm-wh${city.length >= 7 ? ' stack' : ''}"><small class="lm-wh-p">${pref}</small><span class="lm-wh-c">${city}付近</span></span>`;
  };
  const PREF_ORDER = ['大阪府', '兵庫県', '岡山県', '広島県', '山口県', '福岡県'];   // 新大阪から博多へ、通る順
  const stationKm = name => (L.stations.find(s => s[0] === name) || [])[3];

  /* ========== 時刻表 ========== */
  const jst = (date, hm) => +new Date(`${date}T${hm.length === 4 ? '0' + hm : hm}:00+09:00`);
  const schedCache = {};
  function sched(key) {
    if (schedCache[key]) return schedCache[key];
    const tr = T.trains[key];
    const st = T.nozomiLine[key].map(([name, , a, d, stop]) => ({ name, km: stationKm(name), arr: jst(tr.date, a || d), dep: jst(tr.date, d || a), stop: !!stop }));
    const dir = Math.sign(st[st.length - 1].km - st[0].km);
    const S = { key, tr, st, dir, first: st[0], last: st[st.length - 1] };
    /* 時刻 → km と、そのときの状態 */
    S.at = t => {
      if (t < st[0].dep) return { km: st[0].km, mode: 'before', i: 0 };
      const n = st.length - 1;
      if (t >= st[n].arr) return { km: st[n].km, mode: 'after', i: n };
      for (let i = 0; i < n; i++) {
        const a = st[i], b = st[i + 1];
        if (t >= a.arr && t < a.dep) return { km: a.km, mode: 'stopped', i };
        if (t >= a.dep && t < b.arr) {
          const f = (t - a.dep) / (b.arr - a.dep);
          return { km: a.km + (b.km - a.km) * f, mode: 'running', i, v: Math.abs(b.km - a.km) / ((b.arr - a.dep) / 36e5) };
        }
        if (t >= b.arr && t < b.dep) return { km: b.km, mode: 'stopped', i: i + 1 };
      }
      return { km: st[n].km, mode: 'after', i: n };
    };
    /* km → その地点にいる予定の時刻の幅 [t1, t2]（停車中は幅がある） */
    S.when = km => {
      const p = x => (x - st[0].km) * dir, q = p(km);
      if (q <= 0) return [-Infinity, st[0].dep];
      for (let i = 0; i < st.length - 1; i++) {
        const a = st[i], b = st[i + 1];
        if (Math.abs(q - p(a.km)) < 1e-6) return [i ? a.arr : -Infinity, a.dep];
        if (q > p(a.km) && q < p(b.km)) return Array(2).fill(a.dep + (q - p(a.km)) / (p(b.km) - p(a.km)) * (b.arr - a.dep));
      }
      return [st[st.length - 1].arr, Infinity];
    };
    S.ahead = (km, x) => (x - km) * dir;   // 進行方向に見て、x が km より先なら正
    return (schedCache[key] = S);
  }

  /* ========== おためし：線路を走る作り物のGPS ========== */
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  Object.keys(T.nozomiLine).forEach(key => {
    Geo.tracks[key] = (now, delayMin) => {
      const S = sched(key), t = +now - delayMin * MIN, s = S.at(t);
      if (tunnelAt(s.km) && s.mode === 'running') return null;   // トンネル内は電波が届かない
      const p = pointAt(s.km), jm = 30;                              // 数十mの揺れ
      const lat = p[1] + gauss() * jm / 110570, lon = p[0] + gauss() * jm / (111320 * Math.cos(rad(p[1])));
      const v = s.mode === 'running' ? Math.max(0, s.v / 3.6 + gauss() * 1.5) : 0;
      return { lat, lon, acc: Math.round(15 + Math.random() * 30), speed: v, heading: s.mode === 'running' ? bearingAt(s.km, S.dir) : null, src: 'sim', at: new Date(+now) };
    };
  });

  /* ========== 位置の推定（時刻表 × GPS） ========== */
  function Tracker(key) {
    const S = sched(key);
    const tk = { S, fix: null, fixes: [], delay: 0, delayAt: null, v: null, reject: '' };
    tk.onFix = pos => {
      if (!pos) return;
      const now = +Clock.now();
      let at = +pos.at;
      if (!isFinite(at) || Math.abs(now - at) > 6 * 36e5) at = now;   // 端末によっては時刻の基準がずれた値が来るので、受け取った時刻で代用
      if (pos.acc > GPS_MAX_ACC) { tk.reject = 'acc'; return; }
      if (now - at > GPS_MAX_AGE) { tk.reject = 'old'; return; }
      if (now < S.first.dep - 30 * MIN || now > S.last.arr + 120 * MIN) { tk.reject = 'time'; return; }
      const sn = snap(pos.lat, pos.lon);
      if (sn.off > GPS_MAX_OFF) { tk.reject = 'far'; return; }
      tk.reject = '';
      let km = sn.km;
      const slow = pos.speed != null && pos.speed < 1.5;
      /* 停車駅で止まっているときは、その駅に固定 */
      const stn = S.st.find(x => x.stop && Math.abs(x.km - km) < (slow ? 0.6 : 0.15));
      if (stn && (slow || pos.speed == null)) km = stn.km;
      /* 終点に着いたあとは、位置から遅れが分からないので、それまでの値を使い続ける */
      if (!(tk.delayAt != null && Math.abs(km - S.last.km) < 0.3)) {
        const [t1, t2] = S.when(km);
        tk.delay = at - Math.min(Math.max(at, t1), t2);
        tk.delayAt = at;
      }
      tk.fix = { km, at, speed: pos.speed, off: sn.off };
      tk.fixes.push({ km, at }); if (tk.fixes.length > 3) tk.fixes.shift();
    };
    tk.compute = () => {
      const now = +Clock.now();
      const fresh = !!(tk.fix && now - tk.fix.at <= GPS_MAX_AGE);
      const s = S.at(now - tk.delay);
      const km = s.km;
      /* 速度：GPSの値 → 直近の点から計算 → 時刻表の区間平均 */
      let v = null, approx = false;
      if (s.mode === 'stopped' || s.mode === 'before' || s.mode === 'after') v = 0;
      else if (fresh && tk.fix.speed != null) v = tk.fix.speed * 3.6;
      else if (fresh && tk.fixes.length >= 2) {
        const a = tk.fixes[0], b = tk.fixes[tk.fixes.length - 1];
        if (b.at - a.at >= 2e3 && b.at - a.at <= 120e3) v = Math.abs(b.km - a.km) / ((b.at - a.at) / 36e5);
      }
      if (v != null && v > V_MAX) v = null;                // 列車は300km/hまで。跳ねた値は捨てる
      if (v == null) { v = s.v || 0; approx = true; }
      tk.v = v === 0 ? 0 : tk.v == null || tk.v === 0 ? v : tk.v + (v - tk.v) * 0.35;
      const gpsDelay = tk.delayAt != null && now - tk.delayAt < 15 * MIN;
      if (gpsDelay) PrefWatch.setDelay(S.key, tk.delay);
      return { now, km, mode: s.mode, i: s.i, src: fresh ? 'gps' : 'est', speed: tk.v, approx, delay: tk.delay, gpsDelay };
    };
    return tk;
  }


  /* ========== 府県をまたいだときの知らせ ==========
     いまどのへん？と同じ推定（時刻表＋GPSで分かった遅れ）で、のぞみが府県の境を越えたら「岡山県に入りました」を数秒だけ出す。
     しおりのどの画面を見ていても上に重ねる。ただし合言葉の入力中・予約とQRの画面を出しているあいだは待って、閉じてから出す（降車のお知らせの大きい札が出ているときは、下半分に出す）。
     しおりを閉じている・画面が消えているあいだに越えた境は、あとからまとめて出さない（戻った時点を新しい起点にする）。音と振動は使わない */
  const PrefWatch = (() => {
    const KEY = 'lm-delay';
    let mem = null; try { mem = JSON.parse(sessionStorage.getItem(KEY)); } catch { mem = null; }
    let base = null, pend = null, el = null, hideT = 0;
    const fired = new Set();
    const RM = matchMedia('(prefers-reduced-motion: reduce)');
    const setDelay = (key, d) => { if (mem && mem.key === key && Math.abs(mem.d - d) < 1e3) return; mem = { key, d }; try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* noop */ } };
    const active = () => {
      const t = +Clock.now();
      for (const key of Object.keys(T.nozomiLine)) {
        const S = sched(key), d = mem && mem.key === key ? mem.d : 0;
        if (t >= S.first.dep + d && t < S.last.arr + d) return { S, d, t };
      }
      return null;
    };
    const blocked = () => !!document.querySelector('#lockform, .qrbox, .in-ov, .gd');
    function show(n) {
      hide(true);
      el = document.createElement('div');
      /* 降車のお知らせの大きい札（画面の上半分）が出ているときは、下半分に出す */
      el.className = 'pf-note' + (RM.matches ? ' still' : '') + (document.querySelector('.lm-arr.big') ? ' low' : '');
      el.setAttribute('role', 'status');
      el.innerHTML = `<button type="button" class="pf-card" aria-label="${n.to}に入りました（押すと閉じます）">${n.sub ? `<span class="pf-sub">${n.sub}</span>` : '<span class="pf-k">県境をこえて</span>'}<b class="pf-name">${n.to}</b><span class="pf-t">に入りました</span></button>`;
      el.addEventListener('click', () => hide());
      document.body.appendChild(el);
      requestAnimationFrame(() => el && el.classList.add('on'));
      hideT = setTimeout(hide, 3600);
    }
    function hide(now) {
      clearTimeout(hideT);
      const e = el; el = null; if (!e) return;
      if (now || RM.matches) { e.remove(); return; }
      e.classList.remove('on'); setTimeout(() => e.remove(), 400);
    }
    function tick() {
      if (document.visibilityState === 'hidden') { base = null; return; }
      const a = active();
      if (!a) { base = null; pend = null; return; }
      const km = a.S.at(a.t - a.d).km, pf = prefAt(km);
      /* 早送り・時刻の移動などで大きく飛んだときは、起点を置き直すだけ */
      if (!base || base.key !== a.S.key || Math.abs(km - base.km) > 40) { base = { key: a.S.key, km, pf: pf || (base && base.key === a.S.key ? base.pf : null) }; return; }
      base.km = km;
      /* 進む向きに新しい府県へ入ったときだけ、1つの境に1回。GPSで遅れを測り直して少し戻ったときなどは出さない */
      const fwd = (PREF_ORDER.indexOf(pf) - PREF_ORDER.indexOf(base.pf)) * a.S.dir > 0;
      if (pf && base.pf && pf !== base.pf && fwd && !fired.has(a.S.key + pf)) {
        fired.add(a.S.key + pf);
        const k = [base.pf, pf].sort().join();
        pend = { to: pf, sub: k === '山口県,福岡県' ? (pf === '福岡県' ? '本州から九州へ' : '九州から本州へ') : '', at: Date.now() };
      }
      if (pf) base.pf = pf;
      if (pend) {
        if (Date.now() - pend.at > 120e3) pend = null;
        else if (!blocked()) { show(pend); pend = null; }
      }
    }
    setInterval(tick, 1000);
    Clock.on(kind => { if (kind === 'tick') tick(); else if (kind === 'start' || kind === 'seek' || kind === 'stop') { base = null; pend = null; fired.clear(); if (kind !== 'seek') { mem = null; try { sessionStorage.removeItem(KEY); } catch { /* noop */ } } } });
    document.addEventListener('visibilitychange', () => { base = null; pend = null; if (document.visibilityState === 'hidden') hide(true); });
    return { setDelay, _tick: tick, _state: () => ({ base, pend, mem }) };
  })();

  /* ========== 表示のための小道具 ========== */
  let ui = null;   // app.js から借りる { esc, fmtHM, sheet, toast, gmap, ext, full, fresh }
  /* 見どころの種類：5色＋ピンの頭の小さな記号（色だけに頼らない） */
  const CATS = {
    castle: { name: '城', color: '#c8453f', sym: '<path d="M2 10.5h8M3 10.5V7.2h6v3.3M2.2 7.2 6 4.3l3.8 2.9M4.6 4.4 6 2.3l1.4 2.1"/>' },
    shrine: { name: '寺社・史跡', color: '#6e5c9a', sym: '<path d="M1.3 3.4c3.1.9 6.3.9 9.4 0M2.4 5.6h7.2M3.9 3.9v6.8M8.1 3.9v6.8"/>' },
    nature: { name: '山・自然・温泉', color: '#4f7a3a', sym: '<path d="M1 10.2 4.4 4.2l2.1 3.1 1.5-2 3 4.9z"/>' },
    water: { name: '川・海', color: '#2f6f93', sym: '<path d="M1.2 4.8c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0M1.2 8.4c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0"/>' },
    town: { name: '街・名所・味', color: '#a8770f', sym: '<path d="M2 10.6V4.8l3-1.8v7.6M5 10.6V6h5v4.6M1 10.6h10"/>' }
  };
  const CAT_OF = { 城: 'castle', 寺社: 'shrine', 自然: 'nature', 温泉: 'nature', 川: 'water', 町並み: 'town', 名所: 'town', 食: 'town' };
  const catOf = s => CATS[CAT_OF[s.genre] || 'town'];
  const symSvg = s => `<svg class="lm-sym" viewBox="0 0 12 12" aria-hidden="true">${catOf(s).sym}</svg>`;
  const prefOf = s => (s.pref.match(/^(.+?[都道府県])/) || [, s.pref])[1];
  const kmTxt = k => k >= 10 ? Math.round(k) : k >= 1 ? k.toFixed(1).replace(/\.0$/, '') : k.toFixed(1);
  const offTxt = s => s.off < 0.3 || !s.dir ? '線路のすぐそば' : `線路から${s.dir}へ約${kmTxt(s.off)}km`;
  const sideTxt = (s, go) => s.vis === 'N' ? `${go ? '左' : '右'}の窓（北側）＝ D・E席側` : s.vis === 'S' ? `${go ? '右' : '左'}の窓（南側）＝ 通路の反対側の窓` : '両側の窓から';
  const minsTo = (t, now) => Math.round((t - now) / MIN);
  const gmapAt = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* 地図の種類（Google・Yahoo の地図画像は規約上使わない） */
  const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';
  const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  const GSI = 'https://cyberjapandata.gsi.go.jp/xyz/';
  const BASES = {
    std: { name: '地理院 標準', url: GSI + 'std/{z}/{x}/{y}.png', max: 18, attr: GSI_ATTR },
    pale: { name: '地理院 淡色', url: GSI + 'pale/{z}/{x}/{y}.png', max: 18, attr: GSI_ATTR },
    photo: { name: '地理院 航空写真', url: GSI + 'seamlessphoto/{z}/{x}/{y}.jpg', max: 18, attr: GSI_ATTR },
    osm: { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: OSM_ATTR }
  };
  const PITCH_3D = 55;

  function spotCard(s) {
    const { esc, sheet, ext } = ui, S = cur && cur.S, go = S ? S.tr.dir === 'go' : true;
    let when = '';
    if (S && cur.last) {
      const [t1] = S.when(s.km), t = t1 + cur.last.delay, m = minsTo(t, cur.last.now);
      if (isFinite(t) && cur.last.mode !== 'after') when = m > 0 ? `${ui.fmtHM(new Date(Math.round(t / MIN) * MIN))}ごろ通過（あと約${m}分）` : m > -3 ? 'いま通過中' : '通過しました';
    }
    const cat = catOf(s);
    sheet(esc(s.name), `<div class="lm-card"><p class="lm-card-kana">${esc(s.kana)}</p>
      <div class="tags"><span class="tag lm-gtag" style="--g:${cat.color}">${symSvg(s)}${esc(cat.name)}</span>${s.vis ? '<span class="tag red">窓から見える</span>' : '<span class="tag">この近くにある</span>'}</div>
      <p class="lm-card-sum">${esc(s.sum)}</p><p class="lm-card-text">${esc(s.text)}</p>
      <dl class="info"><div><dt>ところ</dt><dd>${esc(s.pref)}</dd></div><div><dt>方角と距離</dt><dd>${offTxt(s)}</dd></div>
      ${s.vis ? `<div><dt>見える窓</dt><dd>${sideTxt(s, go)}${s.vis !== 'B' ? `<br><span class="small muted">${go ? '往路（東へ）' : '復路（西へ）'}の場合</span>` : ''}</dd></div>` : ''}
      ${when ? `<div><dt>通過</dt><dd>${when}</dd></div>` : ''}</dl>
      <div class="btns">${s.url ? ext(s.url, '公式サイト') : ''}${ext(ui.gmap(s.name + ' ' + s.pref.split('・')[0]), 'Googleマップで開く')}</div>
      ${s.tmp ? '<p class="note">位置は目安です。</p>' : ''}</div>`);
  }

  /* ========== 画面 ========== */
  let cur = null;          // 表示中のライブ地図
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* noop */ } }
  };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* noop */ } }
  };
  const simTrack = () => { const st = Clock.state(); return !!(st && st.pos && !Array.isArray(st.pos) && st.pos.track); };

  /* --- 降車のお知らせ：初めは音なし（バイブ＋画面）。音ありは短い1音・控えめ --- */
  const alarm = { on: ls.get('lm-alarm') === '1', sound: ls.get('lm-sound') === '1' };
  let audio = null;
  const ensureAudio = () => {
    if (audio) { audio.state === 'suspended' && audio.resume && audio.resume().catch(() => {}); return audio; }
    try { const AC = window.AudioContext || window.webkitAudioContext; audio = AC ? new AC() : null; audio && audio.resume && audio.resume().catch(() => {}); } catch { audio = null; }
    return audio;
  };
  const beep = () => {
    if (!alarm.sound || !ensureAudio()) return;
    try {
      const t0 = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = 784;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + 0.37);
    } catch { /* 鳴らせなくても続行 */ }
  };
  /* 音ありのときは、最初に画面に触れた時点で音の準備をしておく（ブラウザの決まりで、触る前は鳴らせない） */
  document.addEventListener('pointerdown', () => { alarm.sound && ensureAudio(); }, { passive: true });
  const canVibrate = () => typeof navigator.vibrate === 'function';
  const vibrate = p => { try { canVibrate() && navigator.vibrate(p); } catch { /* 振動できない端末 */ } };
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const canNotify = () => 'Notification' in window && (!isIOS || standalone());
  function notify(key, title, body) {
    if (!alarm.on || !canNotify() || Notification.permission !== 'granted') return;
    const url = location.href.split('#')[0] + '#/ride/live/' + key;
    /* 画面を見ているときは、ページ側でバイブと音を出すので通知は静かに。画面を消しているときは、スマホの通知の設定どおりに鳴らす。
       Chrome は silent と vibrate を同時に指定すると例外を投げて通知を出さないため、vibrate は静かでないときだけ付ける */
    const quiet = document.visibilityState === 'visible';
    const opt = { body, tag: 'lm-arrive', renotify: true, icon: 'assets/icon-192.png', silent: quiet, data: { url } };
    if (!quiet) opt.vibrate = [600, 200, 600, 200, 600];
    const close = get => setTimeout(() => get().then(ns => ns.forEach(n => n.close())).catch(() => {}), 100e3);
    try {
      const sw = navigator.serviceWorker;
      (sw ? sw.getRegistration() : Promise.resolve(null)).then(reg => {
        if (reg) return reg.showNotification(title, opt).then(() => close(() => reg.getNotifications({ tag: 'lm-arrive' })));
        const n = new Notification(title, opt); close(() => Promise.resolve([n]));
      }).catch(() => {});
    } catch { /* 通知を出せない端末は、画面のお知らせだけ */ }
  }

  /* 右上の操作ボタン群は、開閉ボタン1つにまとめる（初めは閉じる。開閉はこの端末に覚える）。
     閉じるときは、地図の種類のメニューも閉じる。大きさが変わるので、名前の置き場所（placeLabels）も計算し直す */
  function setTools(open, save) {
    const c = cur; if (!c) return;
    const box = $('.lm-tools', c.root), b = $('[data-lm="tools"]', c.root); if (!box || !b) return;
    box.classList.toggle('open', open);
    b.setAttribute('aria-expanded', open);
    b.setAttribute('aria-label', open ? '地図の操作ボタンを閉じる' : '地図の操作ボタンを開く');
    b.innerHTML = `${open ? TOOLS_X : TOOLS_MENU}<small>${open ? 'とじる' : '操作'}</small>`;
    if (!open) toggleMenu(false);
    if (save) { ls.set('lm-tools', open ? '1' : null); layoutLabels(); }
  }
  const TOOLS_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M4.5 12h15M4.5 17h15"/></svg>';
  const TOOLS_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function mount(key, helpers) {
    unmount();
    const root = $('#lm'); if (!root) return;
    ui = helpers;
    const S = sched(key), tk = Tracker(key);
    const legacyPitch = ls.get('lm-view') === 'flat' ? 0 : PITCH_3D;
    const c = cur = {
      key, S, tk, root, wrap: $('.lm-mapwrap', root), full: !!helpers.full, act: !!helpers.full, map: null, ml: null, follow: true, last: null, gpsWant: false, unGeo: null, timer: null, unClock: null,
      alarms: {}, wake: null, wakeWant: ss.get('lm-wake') === '1', disp: null, tgt: null, anim: null, bgTimers: [],
      pitch: Math.max(0, Math.min(70, +(ls.get('lm-pitch') ?? legacyPitch) || 0)),
      orient: ls.get('lm-orient') === 'north' ? 'north' : 'head', free: false,
      base: BASES[ls.get('lm-base')] ? ls.get('lm-base') : 'pale', tmpBase: null,
      eco: ls.get('lm-eco') === '1', docVisible: document.visibilityState !== 'hidden', mapVisible: true, pins: [], camAt: 0, nearCur: null, nearSeen: new Set()
    };
    if (c.eco) { c.pitch = 0; c.wakeWant = false; if (c.base === 'photo') c.base = 'pale'; }
    setTools(ls.get('lm-tools') === '1', false);

    /* --- GPS（本物はボタンを押したときだけ。画面を離れた・地図が画面外のあいだは止める） --- */
    const active = () => c.docVisible && (c.full || c.mapVisible);
    const syncGeo = () => {
      const want = c.gpsWant && active();
      if (want && !c.unGeo) {
        c.unGeo = Geo.watch(p => { if (c.gpsErr && p) { c.gpsErr = null; drawCtrl(); } tk.onFix(p); if (!simTrack()) tick(); }, err => {
          if (err && err.code === 3 && tk.fix) return;   // 一時的に取れないだけ（トンネルなど）
          c.gpsErr = err && err.code === 1 ? 'denied' : 'err';
          if (err && err.code === 1) { c.gpsWant = false; ss.set('lm-gps', null); syncGeo(); }
          drawCtrl(); tick();
        });
      } else if (!want && c.unGeo) { c.unGeo(); c.unGeo = null; }
    };
    c.syncGeo = syncGeo; c.active = active;

    /* --- 操作 --- */
    const onClick = e => {
      const sp = e.target.closest('[data-spot]');
      if (sp) { const s = L.spots.find(x => x.id === sp.dataset.spot); s && spotCard(s); return; }
      const tv = e.target.closest('[data-tvid]');
      if (tv) { const open = cur && cur.tvCard && cur.tvCard.isConnected; open ? tvClose() : tvCard(tv.dataset.tvid); return; }
      const bb = e.target.closest('[data-base]');
      if (bb) { setBase(bb.dataset.base, true); toggleMenu(false); return; }
      if (e.target.closest('[data-arr]')) { arriveSheet(); return; }
      const b = e.target.closest('[data-lm]'); if (!b) { toggleMenu(false); return; }
      const k = b.dataset.lm;
      if (k !== 'base') toggleMenu(false);
      if (k === 'gps') {
        if (c.gpsWant) { c.gpsWant = false; ss.set('lm-gps', null); }
        else { c.gpsErr = null; c.gpsWant = true; ss.set('lm-gps', '1'); }
        syncGeo(); drawCtrl(); tick();
      }
      if (k === 'alarm') {
        alarm.on = !alarm.on; ls.set('lm-alarm', alarm.on ? '1' : null);
        if (alarm.on) {
          vibrate(60); alarm.sound && (ensureAudio(), beep());
          /* 通知の許可は、このボタンを押したときに初めて求める */
          try { canNotify() && Notification.permission === 'default' && Notification.requestPermission().catch(() => {}); } catch { /* noop */ }
        }
        drawCtrl();
        ui.toast(alarm.on ? `${S.last.name}の5分前と1分前にお知らせします` : 'お知らせを止めました');
      }
      if (k === 'sound0' || k === 'sound1') {
        alarm.sound = k === 'sound1'; ls.set('lm-sound', alarm.sound ? '1' : null);
        if (alarm.sound) { ensureAudio(); beep(); }
        drawCtrl();
      }
      if (k === 'view') setPitch(c.map ? (c.map.getPitch() >= 5 ? 0 : PITCH_3D) : (c.pitch >= 5 ? 0 : PITCH_3D));
      if (k === 'recenter') { c.follow = true; drawCtrl(); camera(true); }
      if (k === 'settings') openSettings();
      if (k === 'endop') setActive(false);
      if (k === 'compass') compass();
      if (k === 'tools') setTools(b.getAttribute('aria-expanded') !== 'true', true);
      if (k === 'base') toggleMenu();
      if (k === 'legend') { const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', open); const u = b.nextElementSibling; u && (u.hidden = !open); ls.set('lm-legend', open ? '1' : null); }
      if (k === 'help') helpChoice();
    };
    const onChange = e => {
      if (e.target.matches('[data-lm="wake"]')) { c.wakeWant = e.target.checked; ss.set('lm-wake', c.wakeWant ? '1' : null); wake(); }
      if (e.target.matches('[data-lm="eco"]')) { setEco(e.target.checked); ss.set('lm-eco-manual', e.target.checked ? 'on' : 'off'); }
    };
    root.addEventListener('click', onClick); root.addEventListener('change', onChange);
    c.onClick = onClick; c.onChange = onChange;
    const list = $('#lm-list'); list && list.addEventListener('click', onClick);
    c.off = () => { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); list && list.removeEventListener('click', onClick); };

    /* --- 画面を自動で消さない --- */
    const wake = async () => {
      if (!('wakeLock' in navigator)) return;
      try {
        if (c.wakeWant && !c.wake && document.visibilityState === 'visible') { const w = await navigator.wakeLock.request('screen'); if (cur !== c || !c.wakeWant) { w.release().catch(() => {}); return; } c.wake = w; w.addEventListener('release', () => { if (c.wake === w) c.wake = null; }); }
        if (!c.wakeWant && c.wake) { const w = c.wake; c.wake = null; await w.release(); }
      } catch { c.wakeWant = false; ss.set('lm-wake', null); drawCtrl(); }
    };
    c.wakeFn = wake;

    /* --- 画面を離れた・アプリを閉じた・画面が消えたら止め、戻ったらすぐ再開 --- */
    const onVis = () => {
      c.docVisible = document.visibilityState !== 'hidden';
      if (!c.docVisible) { c.hiddenAt = +Clock.now(); stopLoop(); bgAlarms(); }
      else { clearBg(); startLoop(); wake(); catchUp(); tick(); }
      syncGeo();
    };
    document.addEventListener('visibilitychange', onVis);
    c.offVis = () => document.removeEventListener('visibilitychange', onVis);
    /* 地図が画面の外へスクロールされたら、地図の更新とGPSを止める */
    const box = $('.lm-mapwrap', root);
    if ('IntersectionObserver' in window && box && !c.full) {
      c.io = new IntersectionObserver(ents => {
        const v = ents[ents.length - 1].isIntersecting;
        if (v === c.mapVisible) return;
        c.mapVisible = v; syncGeo();
        if (v) { c.camAt = 0; tick(); } else { c.anim && cancelAnimationFrame(c.anim); c.anim = null; }
      });
      c.io.observe(box);
    }

    /* --- 地図の操作中：地図を1回押すと、1本指で動かせる。地図の外を押す・ページをスクロールする・10秒触らないで終える --- */
    if (!c.full) {
      const onDown = e => { if (c.act && !e.target.closest('.lm-mapwrap')) setActive(false); };
      const onScroll = () => { if (c.act && Math.abs(scrollY - c.actY) > 30) setActive(false); };
      const onTouch = e => { if (c.act) poke(); else if (e.type === 'pointerdown' && e.target.closest('.lm-map') && !e.target.closest('.lm-pin')) tapHint(); };
      document.addEventListener('pointerdown', onDown, true);
      addEventListener('scroll', onScroll, { passive: true });
      c.wrap && ['pointerdown', 'touchstart', 'wheel'].forEach(t => c.wrap.addEventListener(t, onTouch, { passive: true }));
      c.offAct = () => { document.removeEventListener('pointerdown', onDown, true); removeEventListener('scroll', onScroll); c.wrap && ['pointerdown', 'touchstart', 'wheel'].forEach(t => c.wrap.removeEventListener(t, onTouch)); };
    }

    /* --- 毎秒の更新（おためし中は仮想時計の tick に合わせる） --- */
    const startLoop = () => {
      stopLoop();
      c.unClock = Clock.on(kind => { if (kind === 'tick' && simTrack()) tick(); });
      c.timer = setInterval(() => { if (!(Clock.active() && simTrack())) tick(); }, 1000);
    };
    const stopLoop = () => { c.timer && clearInterval(c.timer); c.timer = null; c.unClock && c.unClock(); c.unClock = null; };
    c.stopLoop = stopLoop;

    function tick() {
      if (cur !== c) return;
      const r = tk.compute(); c.last = r;
      drawPanel(r); drawSpeed(r); drawNotice(r); drawAlarm(r); drawList(r); drawPins(r); mapTick(r); drawTools();
    }
    c.tick = tick;

    /* 電池が少ないとき（Battery API がある端末＝主に Android）は、自動で省電力に */
    if (typeof navigator.getBattery === 'function') {
      navigator.getBattery().then(bt => {
        if (cur !== c) return;
        const chk = () => { if (cur === c && !c.eco && !bt.charging && bt.level <= 0.2 && ss.get('lm-eco-manual') !== 'off') { setEco(true); ui.toast('電池が少ないため、省電力にしました'); } };
        bt.addEventListener('levelchange', chk); bt.addEventListener('chargingchange', chk);
        c.offBat = () => { bt.removeEventListener('levelchange', chk); bt.removeEventListener('chargingchange', chk); };
        c.hasBattery = true; drawCtrl(); chk();
      }).catch(() => {});
    }

    /* おためしで線路を走っているときは、作り物のGPSを自動で使う。本物のGPSは、ボタンを押したときだけ */
    if (simTrack()) c.gpsWant = true;
    else if (ss.get('lm-gps') === '1' && !Clock.active()) c.gpsWant = true;
    syncGeo();
    fillStatic(); fitHeight();
    drawCtrl(); tick(); startLoop(); wake();
    c.onResize = () => { fitHeight(); syncPad(); };
    addEventListener('resize', c.onResize);
    /* 自動スクロールは、ページを開いた最初の1回だけ（自分でスクロールしたあとは動かさない） */
    if (helpers.fresh && !c.full) setTimeout(() => {
      if (cur !== c || scrollY > 40) return;
      const r = $('.lm-panel', root) || root, b = r.getBoundingClientRect().bottom, navH = ($('#nav') || {}).offsetHeight || 0;
      if (b > innerHeight - navH) root.scrollIntoView({ block: 'start' });
    }, 250);
    lineReady.then(() => { if (cur === c) tick(); });
    loadMap(c);
    /* このページ専用の初回ガイド */
    /* ホーム画面の案内・全体の案内が済んでから出す（同時には出さない） */
    c.guideT = setTimeout(() => {
      const go = () => { if (cur === c && !(window.Guide && (Guide.seen('livemap') || Guide.active()))) runGuide(false); };
      window.Onboard ? Onboard.whenDone().then(() => { if (cur === c) c.guideT = setTimeout(go, 600); }) : go();
    }, 1500);
  }

  function unmount() {
    const c = cur; if (!c) return;
    cur = null;
    c.stopLoop(); c.off(); c.offVis(); clearBg();
    clearTimeout(c.guideT); clearTimeout(c.actT); clearTimeout(c.hintT); c.offAct && c.offAct();
    c.setClose && c.setClose();
    window.Guide && Guide.active() && Guide.stop();
    c.io && c.io.disconnect(); c.ro && c.ro.disconnect(); c.offBat && c.offBat(); cancelAnimationFrame(c.spdAnim);
    removeEventListener('resize', c.onResize);
    c.unGeo && c.unGeo();
    c.wake && c.wake.release().catch(() => {});
    c.anim && cancelAnimationFrame(c.anim);
    try { c.map && c.map.remove(); } catch { /* noop */ }
    const a = $('.lm-arr'); a && a.remove();
    const tc = $('.lm-tvcard'); tc && tc.remove();
  }

  /* 地図の高さ：最初の1画面に、地図・次の停車駅・速さ・窓側の見どころが収まるように、画面の高さから決める */
  function fitHeight() {
    const c = cur; if (!c || c.full) return;
    const top = c.root.getBoundingClientRect().top + scrollY;
    const navH = ($('#nav') || {}).offsetHeight || 0;
    const reserve = 236;   // 次の停車駅（約60px）＋時速と速度バー（約76px）＋窓側の見どころ（約100px）
    const h = Math.round(Math.max(300, Math.min(600, innerHeight - top - navH - reserve)));
    c.root.style.setProperty('--lm-h', h + 'px');
    c.root.classList.toggle('lm-short', h < 420);
    c.map && c.map.resize();
  }

  /* 凡例と地図の種類のメニュー（中身はここで作る） */
  function fillStatic() {
    const c = cur, { esc } = ui;
    const lg = $('.lm-legend', c.root);
    if (lg) {
      const open = ls.get('lm-legend') === '1';
      lg.innerHTML = `<button type="button" data-lm="legend" aria-expanded="${open}">凡例</button><ul${open ? '' : ' hidden'}>${Object.values(CATS).map(k => `<li><i style="--g:${k.color}"><svg class="lm-sym" viewBox="0 0 12 12" aria-hidden="true">${k.sym}</svg></i>${esc(k.name)}</li>`).join('')}<li><i class="vis" style="--g:#67625b"></i>白い縁＝窓から見える</li></ul>`;
    }
    const mn = $('.lm-basemenu', c.root);
    if (mn) mn.innerHTML = `<p class="lm-menu-h">地図の種類</p>${Object.entries(BASES).map(([id, b]) => `<button type="button" data-base="${id}">${esc(b.name)}</button>`).join('')}<p class="lm-menu-n">航空写真は通信量が多めです。電波が弱いときは標準地図に戻します。</p>`;
  }
  function toggleMenu(open) {
    const c = cur; if (!c) return;
    const mn = $('.lm-basemenu', c.root), b = $('[data-lm="base"]', c.root); if (!mn) return;
    const v = open ?? mn.hidden;
    mn.hidden = !v; b && b.setAttribute('aria-expanded', v);
    if (v) $$('[data-base]', mn).forEach(x => { x.setAttribute('aria-pressed', x.dataset.base === (c.tmpBase || c.base)); x.disabled = c.eco && x.dataset.base === 'photo'; });
  }

  /* ---------- パネル（次の停車駅と残り時間・速さを先に） ---------- */
  function drawPanel(r) {
    const el = $('#lm-panel'); if (!el) return;
    const c = cur, { S } = c, { esc, fmtHM } = ui;
    const at = x => fmtHM(new Date(Math.round(x / MIN) * MIN));
    const late2 = r.gpsDelay && r.delay >= 2 * MIN;
    const tun = r.mode === 'running' && tunnelAt(r.km);
    const gn = c.gpsWant && !simTrack() && r.src !== 'gps' ? { far: 'GPSの位置が線路から離れているため、時刻表から推定しています。', time: '列車の運行時間ではないため、GPSの位置は使っていません。', acc: 'GPSの精度が低いため、時刻表から推定しています。', old: 'GPSの位置が古いため、時刻表から推定しています。' }[c.tk.reject] || '' : '';
    let head, where = '';
    const next = r.mode === 'after' ? null : S.st.find(x => x.stop && S.ahead(r.km, x.km) > 0.05);
    if (r.mode === 'before') {
      const m = minsTo(S.first.dep + r.delay, r.now);
      head = `<b>${S.first.name}</b>駅で発車を待っています`;
      where = m < 24 * 60 ? `${at(S.first.dep)}発・あと${m >= 60 ? Math.floor(m / 60) + '時間' : ''}${m % 60}分` : `${S.tr.date.slice(5).replace('-', '/').replace(/^0/, '')} ${at(S.first.dep)}に発車します`;
    } else if (r.mode === 'after') {
      head = `<b>${S.last.name}</b>に到着しました`;
    } else {
      if (next) {
        const eta = next.arr + r.delay, m = minsTo(eta, r.now), d = Math.abs(next.km - r.km);
        head = `<span class="lm-k">つぎは</span><b>${next.name}</b><span class="lm-eta num">${m >= 1 ? `あと約<em>${m}</em>分` : 'まもなく'}・${at(eta)}着${late2 ? 'ごろ' : ''}<small>（${kmTxt(d)}km）</small></span>`;
      }
      if (r.mode === 'stopped') { const st = S.st[r.i]; where = `${st.name}駅に停車中・${at(st.dep + r.delay)}発${late2 ? 'ごろ' : ''}`; }
      else where = whereHTML(muniAt(r.km));
    }
    const late = late2 ? `<span class="lm-late">約${Math.round(r.delay / MIN)}分遅れ</span>` : '';
    const badge = `<span class="lm-badge ${r.src}">${r.src === 'gps' ? (simTrack() ? 'GPS（おためし）' : 'GPS') : '時刻表から推定'}</span>`;
    /* 遅れを反映していない（時刻表どおりの）ときは、そう分かる一言を小さく */
    const tt = !r.gpsDelay && r.mode !== 'after' && !gn
      ? `<p class="lm-ttnote">${Clock.active() && !simTrack() ? 'おためし中は、時刻表どおりの位置です。' : c.full ? '時刻表どおりの位置です（遅れは反映していません）。' : '時刻表どおりの位置です。遅れているときは「現在地を使う」で合わせられます。'}</p>` : '';
    /* 走行中・停車中は「いまどこか（現在）→ 次はどこか」の順。発車前と到着後は、今までどおり見出しが先 */
    const moving = r.mode === 'running' || r.mode === 'stopped';
    const row = `<div class="lm-row${moving ? ' lm-now' : ''}">${moving && where ? '<span class="lm-now-k">現在</span>' : ''}${where ? `<span class="lm-where">${where}</span>` : ''}${late}${badge}${tun && !moving ? '<span class="lm-badge tun">トンネル内</span>' : ''}</div>`;   // 走行中のトンネルは、すぐ下のお知らせ（出口まで約○分）で分かるので札は出さない
    const hd = head ? `<div class="lm-head">${head}</div>` : '';
    const html = `${moving ? row + hd : hd + row}${gn ? `<p class="lm-gpsnote">${gn}</p>` : ''}${tt}`;
    if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
  }

  /* ---------- 時速（大きな数字と、画面の幅いっぱいの速度バー） ----------
     数字はなめらかに数え上がる・数え下がる。バーは時速300kmで満杯（左が緑、右へ行くほど赤）。
     「視差効果を減らす」がオンのときは、動かさずに値だけ変える。点滅はしない */
  const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const V_FULL = 300;
  function drawSpeed(r) {
    const el = $('#lm-spd'); if (!el) return;
    const c = cur, show = r.mode === 'running' || r.mode === 'stopped';
    if (el.hidden === show) { el.hidden = !show; if (c.full) syncPad(); }
    if (!show) return;
    /* 山陽新幹線の最高速度は300km/h。時刻表からの推定（通過駅の時刻が推定のため）やGPSの揺れで超えて見えるので、表示は300までに抑える */
    const approx = r.approx && r.speed > 0;
    const v = Math.max(0, Math.min(V_FULL, approx ? Math.round(r.speed / 10) * 10 : Math.round(r.speed || 0)));
    if (!el.firstChild) {
      el.innerHTML = '<div class="lm-spd-v"><span class="lm-spd-k">時速</span><span class="lm-spd-a"></span><b class="num">0</b><span class="lm-spd-u">km/h</span></div><div class="lm-spd-bar" aria-hidden="true"><i></i></div>';
      c.spdShown = 0;
    }
    el.setAttribute('aria-label', `時速${approx ? '約' : ''}${v}キロ`);
    $('.lm-spd-a', el).textContent = approx ? '約' : '';
    $('.lm-spd-bar i', el).style.transform = `scaleX(${(1 - v / V_FULL).toFixed(4)})`;
    if (c.spdTo === v) return;
    c.spdTo = v;
    const num = $('.lm-spd-v b', el);
    cancelAnimationFrame(c.spdAnim);
    if (RMQ.matches || document.visibilityState === 'hidden') { c.spdShown = v; num.textContent = v; return; }
    const from = c.spdShown || 0, t0 = performance.now(), D = 800;
    const step = ts => {
      if (cur !== c) return;
      const f = Math.min(1, (ts - t0) / D), e = 1 - (1 - f) ** 3;
      c.spdShown = from + (v - from) * e;
      num.textContent = Math.round(c.spdShown);
      if (f < 1) c.spdAnim = requestAnimationFrame(step);
    };
    c.spdAnim = requestAnimationFrame(step);
  }

  /* 全画面：情報の札は画面の下（列車の印の下・通り過ぎた側）にまとめる。
     地図の表示位置もずらし、列車の印が札のすぐ上（画面のやや下）に来るようにして、進む先を広く見せる */
  function syncPad() {
    const c = cur; if (!c || !c.full || !c.map) return;
    const ov = $('.lm-ov', c.root), box = c.map.getContainer(); if (!ov) return;
    const H = box.clientHeight, bt = box.getBoundingClientRect().top, ovTop = ov.getBoundingClientRect().top - bt;
    c.root.style.setProperty('--ov-h', Math.max(0, H - ovTop) + 'px');
    const bottom = Math.max(0, Math.round(H - ovTop + 12));
    const y = Math.min(ovTop - 76, H * 0.74);          // 列車の印を置く高さ（札の上端から少し余裕をとる）
    const top = Math.max(0, Math.round(2 * y - (H - bottom)));
    const pad = { top, bottom, left: 0, right: 0 }, was = c.pad;
    if (was && was.top === pad.top && was.bottom === pad.bottom) return;
    c.pad = pad;
    /* 札が増えて下の欄が高くなったときは、すぐに地図をずらす（ゆっくり動かすと、そのあいだ列車の印が札の下に隠れる） */
    if (!was || pad.bottom > was.bottom) { c.map.setPadding(pad); if (!was) return; }
    c.camAt = 0; camera(true);
  }

  /* ---------- お知らせ（同時に出すのは多くても3つ） ---------- */
  /* 窓から見えるもの：到達の約5分前から（川は2分前から）、通過して30秒まで。トンネルの中では出さず、出てから出す */
  function visNow(r) {
    const c = cur, { S } = c;
    if (!(r.mode === 'running' || r.mode === 'stopped')) return null;
    if (r.mode === 'running' && tunnelAt(r.km)) return null;
    const tAt = km => S.when(km).map(x => x + r.delay);
    return L.spots.filter(s => s.vis).map(s => { const [t1, t2] = tAt(s.km); return { s, t1, t2 }; })
      .filter(x => x.t2 + 30e3 >= r.now && x.t1 - (x.s.vis === 'B' ? 2 : 5) * MIN <= r.now).sort((a, b) => a.t1 - b.t1)[0] || null;
  }
  /* ---------- ご当地トリビア ----------
     LINE.trivia の範囲に列車が入ったら、「いま近くには」の欄と場所を分け合って、題を小さな札で出す（押すと、地図を開いたまま中身が読める）。
     「まもなく」のお知らせとトンネルの2つで欄がふさがっているとき、府県境の知らせが出ているとき、降車の約7分前からは出さずに待つ。
     待てるのは約5分、範囲から12kmまで（その場所を離れすぎたら出さない）。
     1件は約90秒（早送りでも2.5秒）出し、次の札までは約4分（早送りでも2秒）空ける。同じトリビアは1回の乗車で1回だけ */
  let TVL = null;
  const tvList = () => TVL || (TVL = (L.trivia || []).map(([cat, k, a, b]) => {
    const list = (T.triviaMore || {})[cat] || [], j = list.findIndex(x => x[0] === k);
    if (j < 0) return null;
    const [kk, q, ans, src] = list[j];
    return (src || []).some(x => x[1]) ? { id: `${cat}-m${j}`, cat, k: kk, q, a: ans, src, lo: Math.min(a, b), hi: Math.max(a, b) } : null;
  }).filter(Boolean));
  const TV_HOLD = 90e3, TV_HOLD_RT = 2.5e3, TV_GAP = 4 * MIN, TV_GAP_RT = 2e3, TV_WAIT = 5 * MIN, TV_FAR = 12;
  function tvTick(r, busy) {
    const c = cur, { S } = c, key = `lm-tv:${S.key}:${S.tr.date}`;
    const st = c.tv || (c.tv = { seen: new Set((ss.get(key) || '').split(',').filter(Boolean)), pend: [], show: null, endAt: -Infinity, endRt: -Infinity });
    const save = () => ss.set(key, [...st.seen].join(',') || null);
    if (r.mode === 'before') { if (st.seen.size || st.show) { st.seen.clear(); st.pend = []; st.show = null; save(); } return null; }
    if (!(r.mode === 'running' || r.mode === 'stopped')) { st.show = null; return null; }
    tvList().forEach(x => { if (!st.seen.has(x.id) && !st.pend.some(p => p.x === x) && x.lo <= r.km && r.km <= x.hi) st.pend.push({ x, at: r.now }); });
    st.pend = st.pend.filter(p => r.now - p.at <= TV_WAIT && !(p.at > r.now + MIN) && Math.max(p.x.lo - r.km, r.km - p.x.hi) <= TV_FAR);    // 時刻を戻したとき・離れすぎたときは捨てる
    const rt = performance.now(), toArr = S.last.arr + r.delay - r.now;
    const quiet = !busy && toArr > 7 * MIN && !document.querySelector('.pf-note');
    if (st.show) {
      const done = r.now - st.show.at >= TV_HOLD && rt - st.show.rt >= TV_HOLD_RT;
      /* 出してすぐに見どころの「まもなく」などが始まったときは、いったん引っ込めて、あとで出し直す */
      if (busy && !done && rt - st.show.rt < TV_HOLD_RT) { st.seen.delete(st.show.x.id); st.pend.unshift({ x: st.show.x, at: r.now }); save(); st.show = null; }
      else if (done || busy || toArr <= 7 * MIN || r.now < st.show.at) { st.show = null; st.endAt = r.now; st.endRt = rt; }
    }
    if (!st.show && quiet && st.pend.length && r.now - st.endAt >= TV_GAP && rt - st.endRt >= TV_GAP_RT) {
      const p = st.pend.shift();
      st.show = { x: p.x, at: r.now, rt }; st.seen.add(p.x.id); save();
    }
    return st.show && st.show.x;
  }
  function tvCard(id) {
    const c = cur; if (!c) return;
    const x = tvList().find(t => t.id === id); if (!x) return;
    const { esc } = ui;
    tvClose();
    const el = document.createElement('div');
    el.className = 'lm-tvcard' + (RMQ.matches ? ' still' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `トリビア：${x.q}`);
    el.innerHTML = `<div class="lm-tvcard-h"><span class="lm-tvcard-k">トリビア｜${esc(x.k)}</span><button type="button" class="close" data-tvclose aria-label="閉じる">×</button></div>
      <h3>${esc(x.q)}</h3><p>${esc(x.a)}</p>
      <p class="lm-tvcard-src">出典：${x.src.filter(s => s[1]).map(([l, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join('／')}</p>`;
    el.addEventListener('click', e => { if (e.target.closest('[data-tvclose]')) tvClose(); });
    document.body.appendChild(el);
    c.tvCard = el;
    /* 列車の印と、その周りの地図にかからない位置に置く（下からの小さな画面。印にかかるときは上に） */
    const place = () => {
      if (!el.isConnected) return;
      const tr = $('.lm-train', c.root), r = el.getBoundingClientRect();
      const m = tr && tr.getBoundingClientRect();
      el.classList.toggle('top', !!m && m.width > 0 && m.bottom + 36 > r.top && m.top - 36 < r.bottom && !el.classList.contains('top'));
    };
    requestAnimationFrame(() => { place(); el.classList.add('on'); });
  }
  function tvClose() { const c = cur, el = (c && c.tvCard) || $('.lm-tvcard'); if (el) el.remove(); if (c) c.tvCard = null; }

  function drawNotice(r) {
    const el = $('#lm-notice'); if (!el) return;
    const c = cur, { S } = c, { esc } = ui, go = S.tr.dir === 'go';
    const out = [];
    const tAt = km => S.when(km).map(x => x + r.delay);
    if (r.mode === 'running' || r.mode === 'stopped') {
      const vis = visNow(r);
      const tun = r.mode === 'running' && tunnelAt(r.km);
      if (vis) {
        const { s, t1 } = vis, m = minsTo(t1, r.now), now = t1 <= r.now;
        const head = s.vis === 'B' ? `${now ? 'いま' : 'まもなく'}${esc(s.name)}を渡ります` : `${now ? 'いま' : 'まもなく'}${esc(s.name)}`;
        out.push(`<button class="lm-alert" data-spot="${s.id}"><span class="lm-alert-h">${head}${!now && m >= 1 ? `<small class="num">（約${m}分後）</small>` : ''}</span><span class="lm-alert-s">${sideTxt(s, go)}</span><span class="lm-alert-d">${esc(s.sum)}<i>くわしく →</i></span></button>`);
      }
      if (tun) {
        const exitKm = S.dir > 0 ? tun[1] : tun[0], [te] = tAt(exitKm), m = minsTo(te, r.now);
        out.push(`<div class="lm-tunnel"><b>${esc(tun[2] || 'トンネル')}内</b>（${m >= 1 ? `出口まで約${m}分` : 'まもなく出口'}）${c.unGeo ? '・GPSは一時的に届きません' : ''}</div>`);
      }
      /* この近くにあるもの：最寄りの地点を通るころ、1件ずつ控えめに。
         見どころが近くに固まっている所（神戸・岡山・広島・下関など）で次々に入れ替わらないよう、1件は少なくとも約75秒（早送りでも6秒）出してから次へ。
         出しているあいだに通り過ぎたものは飛ばす（一覧と地図のピンには出ている） */
      /* ご当地トリビアの札：出ているあいだは「いま近くには」の欄をゆずってもらう */
      /* 到着の20分前からは乗り換え・チェックインの案内が1つ加わるので、その分も欄が埋まっているものとして数える（ひと画面に収めるため） */
      const xfer = S.last.arr + r.delay - r.now <= 20 * MIN ? 1 : 0;
      const tvx = tvTick(r, out.length + xfer >= 2);
      if (tvx) out.push(`<button class="lm-tvchip" data-tvid="${tvx.id}"><span class="lm-tvchip-k">トリビア</span><b>${esc(tvx.k)}｜${esc(tvx.q)}</b><i aria-hidden="true">›</i></button>`);
      const inWin = x => x.t - 60e3 <= r.now && r.now <= x.t + 150e3;
      const cands = L.spots.filter(s => !s.vis).map(s => ({ s, t: tAt(s.km)[0] })).filter(inWin).sort((a, b) => b.t - a.t);
      const nc = c.nearCur, rt = performance.now();
      const held = nc && ((rt - nc.rt < 6e3) || (r.now - nc.at < 75e3 && cands.some(x => x.s === nc.s)));
      if (tvx) c.nearCur = null;
      else if (!held) {
        const nx = cands.find(x => !c.nearSeen.has(x.s.id));
        c.nearCur = nx ? { s: nx.s, at: r.now, rt } : null;
        nx && c.nearSeen.add(nx.s.id);
      }
      const near = !tvx && out.length + xfer < 2 && c.nearCur;
      if (near) {
        const s = near.s;
        out.push(`<button class="lm-near" data-spot="${s.id}" style="--g:${catOf(s).color}"><span class="lm-dot" aria-hidden="true">${symSvg(s)}</span><span><small>いま近くには…</small><b>${esc(s.name)}</b><span class="lm-near-s">${esc(s.pref)}・${offTxt(s).replace('線路から', '')}</span></span></button>`);
      }
    }
    /* 乗り換え・到着後の案内 */
    const eta = S.last.arr + r.delay, toArr = eta - r.now;
    if (r.mode !== 'before' && toArr <= 20 * MIN) {
      const nextTr = nextTrain();
      if (nextTr) {
        const dep = jst(nextTr.date, nextTr.dep), m = minsTo(dep, r.now), w = Math.round((dep - S.last.arr) / MIN), wr = Math.round((dep - eta) / MIN);
        if (m >= 0) out.push(`<div class="lm-transfer num"><b>${esc(nextTr.name)} ${nextTr.dep}発</b>まで あと${m}分（乗り換え${w}分${r.gpsDelay && r.delay >= 2 * MIN ? `→遅れのため約${Math.max(0, wr)}分` : ''}）</div>`);
      } else if (go && S.last.name === '新大阪' && T.hotel && T.hotel.checkin) out.push(`<div class="lm-transfer">ホテルのチェックインは${esc(T.hotel.checkin.replace('〜', ''))}から</div>`);
    }
    const html = out.join('');
    if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
  }
  const nextTrain = () => { const S = cur.S; return Object.values(T.trains).find(x => x.dir === S.tr.dir && x.date === S.tr.date && x.from === S.last.name && x.dep > S.tr.arr); };

  /* ---------- 降車のお知らせ ----------
     5分前・1分前：画面の上半分に朱色の大きな札（縁がゆっくり光る）→ 約15秒で画面の端の小さな印に縮み、残り時間を数え続ける。
     ONのときだけ、バイブ（5分前は短く2回・1分前は長めに3回）・音・スマホの通知。到着したら消える。 */
  const BIG_MS = 15e3, LATE_MS = 3 * MIN;
  function drawAlarm(r) {
    const c = cur, { S } = c, dest = S.last;
    const eta = dest.arr + r.delay, left = eta - r.now;
    let el = $('.lm-arr');
    if (r.mode === 'before' || r.mode === 'after' || left > 5 * MIN) { el && el.remove(); return; }
    const lvl = left <= MIN ? 2 : 1;
    if (!c.alarms[lvl]) {
      c.alarms[lvl] = true; if (lvl === 2) c.alarms[1] = true;
      /* 知らせる時刻を3分以上過ぎていたら（ページを遅れて開いたなど）、札は小さい印だけにして、バイブは鳴らさない */
      if ((lvl === 2 ? MIN : 5 * MIN) - left <= LATE_MS) { c.bigUntil = performance.now() + BIG_MS; fireAlarm(lvl, eta, left); }
    }
    const big = performance.now() < c.bigUntil;
    const m = Math.ceil(left / MIN);
    const cnt = left < 30e3 ? 'まもなく' : `あと${m}分`;
    if (!el) {
      el = document.createElement('div'); el.className = 'lm-arr'; el.setAttribute('role', 'alert');
      el.addEventListener('click', e => { if (e.target.closest('.lm-arr-x')) { cur && (cur.bigUntil = 0); cur && cur.tick(); return; } arriveSheet(); });
      document.body.appendChild(el);
    }
    el.classList.toggle('big', big); el.classList.toggle('mini', !big); el.classList.toggle('lvl2', lvl === 2);
    const html = big
      ? `<div class="lm-arr-card" data-arr><span class="lm-arr-k">降車のお知らせ</span><b>まもなく${dest.name}</b><span class="lm-arr-n num">${cnt}</span><span class="lm-arr-s num">${ui.fmtHM(new Date(Math.round(eta / MIN) * MIN))}着${r.gpsDelay && r.delay >= 2 * MIN ? 'ごろ' : ''}・荷物・上着・切符を忘れずに</span><span class="lm-arr-more">押すと くわしく</span></div><button class="lm-arr-x" aria-label="小さくする">×</button>`
      : `<button class="lm-arr-chip num" data-arr aria-label="${dest.name}まで${cnt}。押すとくわしく">${dest.name}<b>${left < 30e3 ? 'まもなく' : m + '分'}</b></button>`;
    if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
  }
  function fireAlarm(lvl, eta, left, back) {
    const c = cur, dest = c.S.last;
    if (!alarm.on) return;
    vibrate(lvl === 2 ? [600, 200, 600, 200, 600] : [180, 120, 180]);
    beep();
    if (back) return;   // 画面に戻ったときの知らせは、札とバイブだけ（通知は出さない）
    const m = Math.max(1, Math.round(left / MIN));
    notify(c.key, `まもなく${dest.name}　あと${m}分`, `${ui.fmtHM(new Date(Math.round(eta / MIN) * MIN))}着。降りる準備を（荷物・上着・切符）`);
  }
  /* 画面が消えているあいだも、5分前・1分前の通知だけは出せるように、タイマーを仕掛けておく */
  function bgAlarms() {
    const c = cur; if (!c || !c.last || !alarm.on) return;
    clearBg();
    const st = Clock.state(), speed = st ? (st.paused ? 0 : st.speed) : 1; if (!speed) return;
    const eta = c.S.last.arr + c.last.delay;
    [[1, 5], [2, 1]].forEach(([lvl, min]) => {
      if (c.alarms[lvl]) return;
      const wait = (eta - min * MIN - +Clock.now()) / speed;
      if (wait < 0 || wait > 6 * 36e5) return;
      c.bgTimers.push(setTimeout(() => { if (cur === c && document.visibilityState === 'hidden' && !c.alarms[lvl]) { c.alarms[lvl] = true; if (lvl === 2) c.alarms[1] = true; c.bigUntil = performance.now() + BIG_MS; fireAlarm(lvl, eta, min * MIN); } }, wait));
    });
  }
  /* 画面を消しているあいだに知らせる時刻を過ぎていたら、戻った時点ですぐ札とバイブで知らせる（到着前・過ぎて3分以内のもの） */
  function catchUp() {
    const c = cur; if (!c || !c.hiddenAt) return;
    const since = c.hiddenAt; c.hiddenAt = 0;
    const r = c.tk.compute(); c.last = r;
    if (r.mode === 'before' || r.mode === 'after') return;
    const eta = c.S.last.arr + r.delay, now = r.now;
    if (now >= eta) return;
    for (const [lvl, min] of [[2, 1], [1, 5]]) {
      const t = eta - min * MIN;
      if (t > now) continue;
      if (now - t <= LATE_MS && (t >= since || !c.alarms[lvl])) {
        c.alarms[lvl] = true; if (lvl === 2) c.alarms[1] = true;
        c.bigUntil = performance.now() + BIG_MS;
        fireAlarm(lvl, eta, eta - now, true);
      }
      return;
    }
  }
  function clearBg() { const c = cur; if (!c) return; c.bgTimers.forEach(clearTimeout); c.bgTimers = []; }
  function arriveSheet() {
    const c = cur; if (!c || !c.last) return;
    const { S } = c, dest = S.last, r = c.last, { esc } = ui;
    const eta = dest.arr + r.delay, m = minsTo(eta, r.now);
    let tr = '';
    const nt = nextTrain();
    if (nt) tr = `${esc(nt.name)} ${nt.dep}発（乗り換え約${Math.round((jst(nt.date, nt.dep) - dest.arr) / MIN)}分）`;
    else if (window.TT) {
      const leg = TT.legs.find(l => l.date === S.tr.date && l.from === dest.name);
      if (leg) { const st = TT.stations.find(x => x.id === leg.station), ln = st && TT.lines[st.lines[0].line]; tr = `${ln ? esc(ln.name) + ' ' : ''}${leg.dep}発・${esc(leg.to)}方面（${esc(leg.platform)}）`; }
    }
    ui.sheet(`${esc(dest.name)}で降ります`, `<dl class="info">
      <div><dt>到着</dt><dd class="num">${ui.fmtHM(new Date(Math.round(eta / MIN) * MIN))}着${r.gpsDelay && r.delay >= 2 * MIN ? 'ごろ' : ''}（${m >= 1 ? `あと約${m}分` : 'まもなく'}）</dd></div>
      <div><dt>降りる側のドア</dt><dd>着くホームで変わります。車内の放送とドアの上の表示で確かめてください。</dd></div>
      ${tr ? `<div><dt>乗り換え</dt><dd>${tr}</dd></div>` : ''}</dl>
      ${S.tr.to !== dest.name || S.key === 'nozomi28' ? `<p class="note">この列車は${esc(dest.name)}が終点ではありません。乗り過ごさないよう、早めに準備を。</p>` : ''}
      <p class="note">荷物・上着・切符を忘れずに。</p>`);
  }

  /* ---------- お知らせと画面の設定 ----------
     地図の下には1行の要約だけを置き、スイッチは下から出るシートにまとめる（全画面では ⚙ から開く） */
  const hasWake = () => 'wakeLock' in navigator;
  /* JR公式の運行情報（遅れの情報は自動で読み込まない。公式のページを開くだけ） */
  const JR_INFO = `<p class="lm-jrinfo"><span>JR公式の運行情報</span><a class="ext" href="https://trafficinfo.westjr.co.jp/sanyo.html" target="_blank" rel="noopener">山陽新幹線（JR西日本）</a><a class="ext" href="https://www.jrkyushu.co.jp/trains/info/" target="_blank" rel="noopener">九州の列車（JR九州）</a></p>`;
  function drawCtrl() {
    const c = cur; if (!c) return;
    const el = $('#lm-ctrl');
    if (el) {
      const gps = simTrack() ? '<span class="lm-simnote">おためし中は、作り物のGPSで動きます</span>'
        : Clock.active() ? '<span class="lm-simnote">おためし中は本物のGPSを使いません（時刻表から推定）</span>'
        : `<button class="btn ${c.gpsWant ? 'fill' : 'quiet'}" data-lm="gps" aria-pressed="${c.gpsWant}">${c.gpsWant ? 'GPSを止める' : '現在地を使う'}</button>`;
      const html = `<button type="button" class="lm-sum" data-lm="settings" aria-haspopup="dialog" aria-label="お知らせと画面の設定を開く">
          <span class="lm-sum-i${alarm.on ? ' on' : ''}">お知らせ <b>${alarm.on ? 'ON' : 'OFF'}</b></span>
          ${hasWake() ? `<span class="lm-sum-i">画面 <b>${c.wakeWant ? '消さない' : '自動で消える'}</b></span>` : ''}
          <span class="lm-sum-i">省電力 <b>${c.eco ? 'ON' : 'OFF'}</b></span>
          <span class="lm-sum-go">設定</span></button>
        <div class="lm-ctrl-row">${gps}<a class="btn quiet ext" data-lm-gm href="https://www.google.com/maps" target="_blank" rel="noopener">Googleマップで開く（現在地）</a></div>
        ${JR_INFO}
        ${c.gpsErr === 'denied' ? '<p class="lm-msg">位置情報が許可されませんでした。時刻表からの推定で表示します。</p>' : c.gpsErr ? '<p class="lm-msg">位置がまだ取れません。取れるまでは時刻表からの推定で表示します。</p>' : ''}`;
      if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
    }
    if (c.setEl) {
      const dest = c.S.last.name;
      const html = `<div class="lm-alarm">
          <button class="btn ${alarm.on ? 'fill' : 'quiet'}" data-lm="alarm" aria-pressed="${alarm.on}">${alarm.on ? 'アラーム／バイブ：ON' : 'アラーム／バイブをONにする'}</button>
          <div class="lm-seg" role="group" aria-label="音"><span>音：</span><button type="button" data-lm="sound0" aria-pressed="${!alarm.sound}">なし</button><button type="button" data-lm="sound1" aria-pressed="${alarm.sound}">あり</button></div>
          <p class="lm-desc">${dest}の5分前と1分前にお知らせします。初めは音を出さず、バイブと画面で知らせます（iPhoneは画面のみ）。</p>
          <p class="lm-desc lm-warn">${hasWake() ? '画面を消すと、お知らせが届かないことがあります。確実にするには「画面を自動で消さない」をオンにして、画面を点けたままにしてください。' : '画面を消すと、お知らせが届かないことがあります。確実にするには、画面を点けたままにしてください。'}</p></div>
        ${hasWake() ? `<label class="lm-sw"><input type="checkbox" role="switch" data-lm="wake"${c.wakeWant ? ' checked' : ''}${c.eco ? ' disabled' : ''}><span>画面を自動で消さない</span></label>
          <p class="lm-desc">スマホは、しばらく触らないと暗くなって消えます。オンにすると、このページを開いている間は消えなくなります。そのぶん電池を多く使います。${c.eco ? '省電力中は使えません。' : ''}</p>` : ''}
        <label class="lm-sw"><input type="checkbox" role="switch" data-lm="eco"${c.eco ? ' checked' : ''}><span>省電力</span></label>
        <p class="lm-desc">地図の更新を10秒に1回にし、平面・淡色の地図にします。航空写真と「画面を自動で消さない」は使いません。${c.hasBattery ? '電池が20%以下になると、自動でオンになります。' : ''}</p>
        ${c.full ? JR_INFO : ''}`;
      if (c.setEl.dataset.v !== html) { c.setEl.innerHTML = html; c.setEl.dataset.v = html; }
    }
    drawTools();
  }
  function openSettings() {
    const c = cur; if (!c || c.setEl) return;
    ui.sheet('お知らせと画面の設定', '<div class="lm-set lm-ctrl"></div>', (bg, close) => {
      c.setEl = $('.lm-set', bg); c.setClose = close;
      bg.addEventListener('click', c.onClick); bg.addEventListener('change', c.onChange);
      drawCtrl();
      return () => { c.setEl = null; c.setClose = null; };
    });
  }
  function drawTools() {
    const c = cur; if (!c) return;
    const pitch = c.map ? c.map.getPitch() : c.pitch;
    const vb = $('[data-lm="view"]', c.root);
    if (vb) { const is3d = pitch >= 5, h = `${is3d ? IC.flat : IC.cube}<small>${is3d ? '平面' : '立体'}</small>`; if (vb.dataset.v !== h) { vb.innerHTML = h; vb.dataset.v = h; vb.setAttribute('aria-label', is3d ? '平面にする' : '立体にする'); } }
    const cb = $('[data-lm="compass"]', c.root);
    if (cb) {
      const t = c.free ? '自由' : c.orient === 'north' ? '北が上' : '進行方向';
      const sm = $('small', cb); sm && sm.textContent !== t && (sm.textContent = t);
      cb.setAttribute('aria-label', `方位磁針（いまは${c.free ? '回した向き' : t === '北が上' ? '北が上' : '進行方向が上'}）。押すと${c.free ? (c.orient === 'north' ? '北が上' : '進行方向が上') : c.orient === 'north' ? '進行方向が上' : '北が上'}`);
      needle();
    }
    const rc = $('[data-lm="recenter"]', c.root); rc && rc.classList.toggle('on', !c.follow && !!c.map);
    const gm = $('[data-lm-gm]', c.root); if (gm && c.last) { const p = pointAt(c.last.km); gm.href = gmapAt(p[1], p[0]); }
  }
  function needle() { const c = cur; const n = c && $('.lm-needle', c.root); if (n && c.map) n.style.transform = `rotate(${-c.map.getBearing()}deg)`; }
  const IC = {
    cube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
    flat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7 21 12l-9 5-9-5z"/></svg>'
  };

  /* ---------- 見どころ一覧 ----------
     府県ごとにまとめ、見出しを押すと折りたためる。最初は全部開き、通り過ぎた府県は自動で折りたたむ（一度だけ。開き直したら閉じない）。
     府県の並びは通る順（往路と復路で逆）。府県の中は通る順 */
  function listHTML(key) {
    const S = sched(key), esc = ui.esc;
    const groups = {};
    L.spots.forEach(s => { const p = prefOf(s); (groups[p] = groups[p] || []).push(s); });
    const prefs = Object.keys(groups).sort((a, b) => ((PREF_ORDER.indexOf(a) + 1 || 99) - (PREF_ORDER.indexOf(b) + 1 || 99)) * S.dir);
    return prefs.map(p => {
      const sp = groups[p].sort((a, b) => (a.km - b.km) * S.dir);
      return `<details class="lm-pg" open data-pref="${esc(p)}"><summary class="lm-pref"><span>${esc(p)}</span><small class="num">${sp.length}件</small><em class="lm-pg-done">通過</em></summary><ol class="lm-spots">${sp.map(s =>
        `<li data-km="${s.km}"><button data-spot="${s.id}" style="--g:${catOf(s).color}"><span class="lm-dot" aria-hidden="true">${symSvg(s)}</span><span class="lm-sp"><b>${esc(s.name)}</b>${s.vis ? '<em>窓から</em>' : ''}<small>${esc(s.sum)}</small></span><span class="lm-sd">${s.vis ? (s.vis === 'N' ? '北側' : s.vis === 'S' ? '南側' : '両側') : s.off < 0.3 ? 'すぐそば' : `${s.dir}${kmTxt(s.off)}km`}</span></button></li>`).join('')}</ol></details>`;
    }).join('');
  }
  function drawList(r) {
    const el = $('#lm-list'); if (!el || !cur) return;
    if (el.dataset.k !== cur.key) { el.innerHTML = listHTML(cur.key); el.dataset.k = cur.key; }
    const S = cur.S, gone = r.mode === 'after';
    const lis = $$('li[data-km]', el).sort((a, b) => (+a.dataset.km - +b.dataset.km) * S.dir);
    let marked = false;
    lis.forEach(li => {
      const passed = gone || (r.mode !== 'before' && S.ahead(r.km, +li.dataset.km) < -0.2);
      li.classList.toggle('passed', passed);
      const nx = !passed && !marked && r.mode !== 'before'; if (nx) marked = true;
      li.classList.toggle('next', nx);
    });
    /* 府県の中の見どころを全部通り過ぎたら、その府県を閉じる。時計を戻したとき（おためし）は開き直す */
    $$('details.lm-pg', el).forEach(g => {
      const done = $$('li', g).every(li => li.classList.contains('passed'));
      g.classList.toggle('done', done);
      if (done && !g.dataset.auto) { g.dataset.auto = '1'; g.open = false; }
      else if (!done && g.dataset.auto) { delete g.dataset.auto; g.open = true; }
    });
  }

  /* ========== 地図 ========== */
  async function loadMap(c) {
    const box = $('#lm-map', c.root); if (!box) return;
    const fail = why => {
      if (cur !== c) return;
      c.root.classList.add('lm-nomap');
      const e = $('.lm-maperr', c.root); if (e) e.hidden = false;
      console.info('ライブ地図：地図を表示できません（' + why + '）。路線図と文字の案内で続けます');
    };
    if (!$('link[data-maplibre]')) { const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = MAPLIBRE.replace('.mjs', '.css'); lk.dataset.maplibre = '1'; document.head.appendChild(lk); }
    let ml;
    try { ml = await import(new URL(MAPLIBRE, document.baseURI).href); } catch (e) { return fail('ライブラリを読み込めません'); }
    await lineReady;
    if (cur !== c) return;
    c.ml = ml;
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const cs = getComputedStyle(document.documentElement);
    const col = n => cs.getPropertyValue(n).trim() || '#888';
    const r = c.last || c.tk.compute();
    const p = pointAt(r.km);
    const tunnels = { type: 'FeatureCollection', features: L.tunnels.map(t => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: sliceLine(t[0], t[1]) } })) };
    const stations = { type: 'FeatureCollection', features: L.stations.map(s => ({ type: 'Feature', properties: { stop: c.S.st.some(x => x.name === s[0] && x.stop) ? 1 : 0 }, geometry: { type: 'Point', coordinates: [s[2], s[1]] } })) };
    /* 電波が弱い・通信を節約する設定なら、航空写真は使わない */
    const conn = navigator.connection;
    if (c.base === 'photo' && conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) { c.tmpBase = 'std'; ui.toast('電波が弱いため、標準地図で表示します'); }
    const baseNow = c.tmpBase || c.base;
    const rasterPaint = id => dark ? { 'raster-brightness-max': 0.42, 'raster-saturation': -0.4, 'raster-contrast': 0.1 } : id === 'photo' ? {} : { 'raster-saturation': -0.25 };
    const sources = {}, layers = [{ id: 'bg', type: 'background', paint: { 'background-color': col('--paper-2') } }];
    Object.entries(BASES).forEach(([id, b]) => {
      sources[id] = { type: 'raster', tiles: [b.url], tileSize: 256, minzoom: id === 'osm' ? 0 : 2, maxzoom: b.max, attribution: b.attr };
      layers.push({ id, type: 'raster', source: id, layout: { visibility: id === baseNow ? 'visible' : 'none' }, paint: rasterPaint(id) });
    });
    let map;
    try {
      map = new ml.Map({
        container: box, center: p, zoom: c.pitch >= 5 ? 11.3 : 10.3, pitch: c.pitch, bearing: c.orient === 'north' ? 0 : headingAt(r.km),
        maxPitch: 70, minZoom: 5, maxZoom: 16, attributionControl: false, fadeDuration: 0,
        /* ふだんは1本指でページをスクロールし、地図は2本指の拡大・縮小だけ。地図を1回押すと「操作中」になり、1本指で動かせる（setActive）。
           全画面は最初から操作中。傾きは MapLibre の判定が甘いため、自前の判定（pitchGesture）で行う */
        dragPan: c.act, dragRotate: c.act, scrollZoom: c.act, doubleClickZoom: c.act, keyboard: c.act, boxZoom: false, touchPitch: false, touchZoomRotate: true, pitchWithRotate: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, c.eco ? 1 : 2),
        style: {
          version: 8,
          sources: {
            ...sources,
            line: { type: 'geojson', data: lineGeo || { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom.coords } }, attribution: OSM_ATTR },
            done: { type: 'geojson', data: emptyLine() },
            tun: { type: 'geojson', data: tunnels },
            stn: { type: 'geojson', data: stations }
          },
          layers: layers.concat([
            { id: 'line-case', type: 'line', source: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': dark ? '#1b1a18' : '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8, 16, 12] } },
            { id: 'line', type: 'line', source: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': col('--shu'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7] } },
            { id: 'done', type: 'line', source: 'done', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': col('--sumi-3'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7] } },
            { id: 'tun', type: 'line', source: 'tun', paint: { 'line-color': dark ? '#1b1a18' : '#ffffff', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2, 16, 3], 'line-dasharray': [1.2, 1.6] } },
            { id: 'stn', type: 'circle', source: 'stn', paint: { 'circle-radius': ['case', ['==', ['get', 'stop'], 1], 6, 4], 'circle-color': dark ? '#1b1a18' : '#ffffff', 'circle-stroke-color': col('--ai'), 'circle-stroke-width': ['case', ['==', ['get', 'stop'], 1], 3, 2] } }
          ])
        }
      });
    } catch (e) { return fail('WebGLが使えません'); }
    c.map = map;
    if (c.full) {
      syncPad();
      const ov = $('.lm-ov', c.root);
      if (ov && 'ResizeObserver' in window) { c.ro = new ResizeObserver(() => cur === c && syncPad()); c.ro.observe(ov); }
    }
    if (!c.act) map.touchZoomRotate.disableRotation();
    pitchGesture(c, map);
    /* ふだんの画面で地図を押したら「操作中」に */
    map.on('click', () => { if (!c.act) setActive(true); else poke(); });
    map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-left');
    /* タイルが取れないときの記録（航空写真が続けて取れなければ、標準地図に戻す） */
    const errs = [];
    map.on('error', e => {
      if (e && e.error && /webgl|context/i.test(String(e.error.message || ''))) return fail('WebGL');
      if (e && e.sourceId === 'photo' && (c.tmpBase || c.base) === 'photo') {
        const t = Date.now(); errs.push(t); while (errs.length && t - errs[0] > 20e3) errs.shift();
        if (errs.length >= 6 && navigator.onLine !== false) { c.tmpBase = 'std'; applyBase(); ui.toast('電波が弱いため、標準地図に戻しました'); }
      }
    });
    /* 指で地図を動かしたら追いかけるのをやめる（「現在地」で戻る）。回したらその向きで止める。傾き・拡大はそのまま追いかける */
    map.on('dragstart', e => { if (e.originalEvent && c.follow) { c.follow = false; drawTools(); } });
    map.on('rotatestart', e => { if (e.originalEvent && !c.free) { c.free = true; drawTools(); } });
    map.on('movestart', e => { if (e.originalEvent) c.gest = true; });
    map.on('moveend', () => { if (!c.pg) c.gest = false; layoutLabels(); });
    map.on('rotate', needle);
    map.on('pitchend', () => { const v = Math.round(map.getPitch()); c.pitch = v; ls.set('lm-pitch', String(v)); drawTools(); });
    /* 駅名 */
    L.stations.forEach(s => {
      const stop = c.S.st.some(x => x.name === s[0] && x.stop);
      const el = document.createElement('div'); el.className = 'lm-stn' + (stop ? ' stop' : ''); el.textContent = s[0];
      new ml.Marker({ element: el, anchor: 'top', offset: [0, 6], pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([s[2], s[1]]).addTo(map);
    });
    /* 見どころ：ピンを立てて横に名前。地図を傾けても、画面に向かって立てる */
    c.pins = L.spots.map(s => {
      const cat = catOf(s);
      const el = document.createElement('button'); el.type = 'button';
      el.className = 'lm-pin lv-far' + (s.vis ? ' vis' : ''); el.style.setProperty('--g', cat.color); el.dataset.spot = s.id;
      el.setAttribute('aria-label', `${s.name}（${cat.name}${s.vis ? '・窓から見える' : ''}）`);
      el.innerHTML = `<span class="lm-pin-in"><span class="lm-pin-h">${symSvg(s)}</span><span class="lm-pin-n">${ui.esc(s.name)}</span></span>`;
      const pin = { s, el, lv: 'far', label: el.querySelector('.lm-pin-n'), w: textW(s.name), tmp: 0 };
      /* 名前の出ていないピンを押したら、名前をしばらく出してから紹介を開く */
      el.addEventListener('click', e => {
        e.stopPropagation(); c.act && poke();
        pin.tmp = performance.now() + 8e3; layoutLabels(); clearTimeout(pin.tmpT); pin.tmpT = setTimeout(layoutLabels, 8100);
        spotCard(s);
      });
      pin.mk = new ml.Marker({ element: el, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([s.lon, s.lat]).addTo(map);
      return pin;
    });
    /* 自分の列車（絵の選び方は trainFace） */
    const tel = document.createElement('div'); tel.className = 'lm-train';
    tel.setAttribute('role', 'img'); tel.setAttribute('aria-label', '自分の列車');
    c.train = new ml.Marker({ element: tel, anchor: 'top-left', offset: [-TRAIN.w / 2, -TRAIN.oy], rotationAlignment: 'viewport', pitchAlignment: 'viewport' }).setLngLat(p).addTo(map);
    c.trainEl = tel; c.frame = -1;
    map.on('move', () => cur === c && c.disp != null && trainFace(c));
    c.disp = c.tgt = r.km; trainFace(c);
    map.on('load', () => { if (cur === c) { c.loaded = true; c.camAt = 0; drawPins(c.last || r); mapTick(c.last || r, true); layoutLabels(); } });
    drawCtrl(); drawPins(r); layoutLabels();
  }
  const emptyLine = () => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
  function sliceLine(a, b) {
    if (a > b) [a, b] = [b, a];
    const { coords, cum } = geom, out = [pointAt(a)];
    for (let i = 0; i < cum.length; i++) if (cum[i] > a && cum[i] < b) out.push(coords[i]);
    out.push(pointAt(b));
    return out;
  }
  /* 自分の列車の印：斜め上から見た立体の先頭車両（N700S風）。tools/train-sprite.html で36方向（10°ごと）を書き出した絵
     （assets/train-sprite.webp）から、画面の上での進行方向に一番近い1枚を選ぶ。印は地図に寝かせず、画面に向かって立てる。
     絵は仰角38°で描いてあるので、地図の回転・傾きから求めた画面上の向き σ を、絵の中の地面の向き a に直して選ぶ */
  const TRAIN = { w: 56, h: 52, cols: 6, n: 36, oy: 30.1, elev: 38 * Math.PI / 180 };   // oy：地面の中心の位置（絵の上から）
  function trainFace(c) {
    const map = c.map, d = c.S.dir;
    const p0 = map.project(pointAt(c.disp - 1.5 * d)), p1 = map.project(pointAt(c.disp + 1.5 * d));
    let sg = Math.hypot(p1.x - p0.x, p1.y - p0.y) > 4 ? Math.atan2(p1.x - p0.x, p0.y - p1.y) : (headingAt(c.disp) - map.getBearing()) * Math.PI / 180;
    const a = Math.atan2(Math.sin(TRAIN.elev) * Math.sin(sg), Math.cos(sg)) * 180 / Math.PI;
    const k = ((Math.round(a / 10) % TRAIN.n) + TRAIN.n) % TRAIN.n;
    if (k === c.frame) return;
    c.frame = k;
    c.trainEl.style.backgroundPosition = `${-(k % TRAIN.cols) * TRAIN.w}px ${-Math.floor(k / TRAIN.cols) * TRAIN.h}px`;
  }
  /* 進行方向（線路の向き。細かい揺れを拾わないよう、前後1.5kmで見る） */
  const headingAt = km => { const d = cur ? cur.S.dir : 1; return bearing(pointAt(km - 1.5 * d), pointAt(km + 1.5 * d)); };

  /* ---------- 見どころのピンの濃さ ----------
     遠いものは薄く小さく、近づくと濃く大きく、通り過ぎたら薄く。窓から見えるもの・次に来るものは、はっきり */
  function drawPins(r) {
    const c = cur; if (!c || !c.pins.length) return;
    const { S } = c;
    const vis = visNow(r), visId = vis && vis.s.id;
    let nextId = null, best = Infinity;
    if (r.mode !== 'after') c.pins.forEach(p => { const a = S.ahead(r.km, p.s.km); if (a > -0.3 && a < best) { best = a; nextId = p.s.id; } });
    let changed = false;
    c.pins.forEach(p => {
      const a = S.ahead(r.km, p.s.km);
      let lv = r.mode === 'after' ? 'past' : a < -1 ? 'past' : a <= 8 ? 'near' : a <= 30 ? 'mid' : 'far';
      if (r.mode === 'before') lv = a <= 30 ? 'mid' : 'far';
      if (p.s.id === visId || (p.s.id === nextId && r.mode !== 'before')) lv = 'hot';
      p.ahead = a;
      if (p.lv !== lv) { p.el.classList.replace('lv-' + p.lv, 'lv-' + lv); p.lv = lv; p.el.style.zIndex = { hot: 5, near: 4, mid: 3, far: 2, past: 1 }[lv]; changed = true; }
    });
    if (changed) layoutLabels();
  }
  /* ---------- 見どころの名前の出し方 ----------
     名前は優先度の高いものから、縮尺に応じて最大2〜5件まで（窓から見える → 近い → これから近づく の順）。ほかはピンだけ。
     置き場所は右→左→上→下の順に試し、どこでもほかの名前・ピン・ボタンに重なるなら出さない。
     計算は地図を描き直したとき（moveend・ピンの濃さが変わったとき）だけ。画面の位置は map.project で求め、DOM の寸法は読まない */
  const textW = t => [...t].reduce((w, ch) => w + (/[\x20-\x7e]/.test(ch) ? 0.62 : 1), 0);   // 文字幅（em）の見積もり
  const LV_SCALE = { hot: 1.12, near: 1, mid: 0.9, far: 0.78, past: 0.72 };
  const labelMax = z => z >= 11.8 ? 5 : z >= 10.6 ? 4 : z >= 9.6 ? 3 : 2;
  let layoutReq = 0;
  function layoutLabels() {
    if (layoutReq) return;
    layoutReq = requestAnimationFrame(() => { layoutReq = 0; placeLabels(); });
  }
  function placeLabels() {
    const c = cur; if (!c || !c.map || !c.pins.length) return;
    const map = c.map, box = map.getContainer(), W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    const now = performance.now(), before = c.last && c.last.mode === 'before';
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    /* 名前を置けない場所：右上のボタン群・左上の凡例・左下の出典・列車の印・駅名 */
    const obst = [];
    const tools = $('.lm-tools', c.root);
    if (tools) obst.push({ l: W - (tools.offsetWidth + 16), t: 0, r: W, b: tools.offsetTop + tools.offsetHeight + 6 });
    obst.push({ l: 0, t: 0, r: 80, b: 46 }, { l: 0, t: H - 22, r: Math.min(W, 300), b: H });
    const ov = c.full && $('.lm-ov', c.root);
    if (ov) { const bt = box.getBoundingClientRect().top; obst.push({ l: 0, t: ov.getBoundingClientRect().top - bt - 4, r: W, b: H }); }
    if (c.train && c.disp != null) { const q = map.project(pointAt(c.disp)); obst.push({ l: q.x - 28, t: q.y - 30, r: q.x + 28, b: q.y + 22 }); }
    L.stations.forEach(st => {
      const stop = c.S.st.some(x => x.name === st[0] && x.stop); if (!stop) return;
      const q = map.project([st[2], st[1]]), w = st[0].length * 13 + 8;
      obst.push({ l: q.x - w / 2, t: q.y + 4, r: q.x + w / 2, b: q.y + 24 });
    });
    /* ピンの位置と優先度 */
    const ps = c.pins.map(p => {
      const q = map.project([p.s.lon, p.s.lat]), sc = LV_SCALE[p.lv] || 1, a = p.ahead ?? 0;
      p.x = q.x; p.y = q.y; p.sc = sc;
      p.on = q.x > -12 && q.x < W + 12 && q.y > 0 && q.y < H + 30;
      p.head = { l: q.x - 10 * sc, t: q.y - 30 * sc, r: q.x + 10 * sc, b: q.y - 10 * sc };
      p.tier = p.lv === 'hot' ? 0 : p.lv === 'past' ? 9 : p.s.vis && a > -1 && a <= 40 ? 1 : Math.abs(a) <= 8 ? 2 : a > 0 ? 3 : 9;
      if (before) p.tier = p.lv === 'past' ? 9 : p.s.vis ? 1 : 3;
      p.forced = p.tmp > now;
      return p;
    }).filter(p => { if (!p.on) p.el.classList.add('nolabel'); return p.on; });
    ps.sort((a, b) => (b.forced - a.forced) || a.tier - b.tier || Math.abs(a.ahead || 0) - Math.abs(b.ahead || 0));
    const heads = ps.map(p => p.head);
    const placed = [], max = labelMax(map.getZoom());
    let shown = 0;
    ps.forEach(p => {
      let pos = null;
      if (p.forced || (p.tier < 9 && shown < max)) {
        const sc = p.sc, fs = (p.lv === 'hot' ? 13.5 : 12) * sc, w = p.w * fs + 6, h = 18 * sc, { x, y } = p;
        const cand = {
          r: { l: x + 14 * sc, t: y - 29 * sc, r: x + 14 * sc + w, b: y - 29 * sc + h },
          l: { l: x - 14 * sc - w, t: y - 29 * sc, r: x - 14 * sc, b: y - 29 * sc + h },
          t: { l: x - w / 2, t: y - 32 * sc - h, r: x + w / 2, b: y - 32 * sc },
          b: { l: x - w / 2, t: y + 3, r: x + w / 2, b: y + 3 + h }
        };
        const inside = q => q.l >= 2 && q.r <= W - 2 && q.t >= 2 && q.b <= H - 2;
        for (const k of ['r', 'l', 't', 'b']) {
          const q = cand[k], m = { l: q.l - 4, t: q.t - 2, r: q.r + 4, b: q.b + 2 };   // 少し余白をとって判定
          if (inside(q) && !placed.some(o => hit(o, m)) && !obst.some(o => hit(o, m)) && !heads.some(o => o !== p.head && hit(o, m))) { pos = k; placed.push(q); break; }
        }
        /* いちばん大事な名前と、押したピンの名前は、重なっても出す */
        if (!pos && (p.forced || p.tier === 0)) { pos = 'r'; placed.push(cand.r); }
      }
      if (pos && !p.forced) shown++;
      p.el.classList.toggle('nolabel', !pos);
      if (pos && p.el.dataset.lp !== pos) p.el.dataset.lp = pos;
    });
  }

  /* ---------- 地図の操作中（ふだんの画面） ---------- */
  function setActive(on) {
    const c = cur; if (!c || c.full || !c.map) return;
    if (c.act === on) { on && poke(); return; }
    c.act = on;
    const m = c.map;
    ['dragPan', 'dragRotate', 'scrollZoom', 'doubleClickZoom', 'keyboard'].forEach(k => { try { on ? m[k].enable() : m[k].disable(); } catch { /* noop */ } });
    try { on ? m.touchZoomRotate.enableRotation() : m.touchZoomRotate.disableRotation(); } catch { /* noop */ }
    c.wrap && c.wrap.classList.toggle('lm-act', on);
    const eb = $('[data-lm="endop"]', c.root); eb && (eb.hidden = !on);
    if (on) { c.actY = scrollY; poke(); hideHint(); ls.set('lm-taphint', '1'); }
    else clearTimeout(c.actT);
  }
  function poke() {
    const c = cur; if (!c || !c.act || c.full) return;
    clearTimeout(c.actT);
    c.actT = setTimeout(() => { if (cur === c) setActive(false); }, 10e3);
  }
  /* 「押すと地図を動かせます」は、ふだんの画面で初めて地図に触れたときに1回だけ */
  function tapHint() {
    const c = cur; if (!c || c.full || ls.get('lm-taphint') || c.hintT) return;
    c.hintT = setTimeout(() => {
      if (cur !== c || c.act) return;
      ls.set('lm-taphint', '1');
      const h = document.createElement('p'); h.className = 'lm-hint'; h.setAttribute('role', 'status'); h.textContent = '押すと地図を動かせます';
      c.wrap.appendChild(h);
      c.hintT = setTimeout(hideHint, 2600);
    }, 350);
  }
  function hideHint() { const c = cur; const h = c && $('.lm-hint', c.wrap); h && h.remove(); }

  /* 2本指の傾き：2本指が横に並び、そろって上下に動いたときだけ。横の動きや指の間隔の変化が大きいとき・迷うときは、拡大縮小・移動を優先する。
     判定がつくまで（約12px）は地図に動きを渡さない */
  function pitchGesture(c, map) {
    const el = map.getContainer();
    let g = null;
    const two = e => [0, 1].map(i => [e.touches[i].clientX, e.touches[i].clientY]);
    const dist = p => Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
    el.addEventListener('touchstart', e => {
      if (!c.act || e.touches.length !== 2) { g = null; return; }
      const p = two(e);
      g = { p0: p, d0: dist(p), mode: null };
    }, { capture: true, passive: true });
    el.addEventListener('touchmove', e => {
      if (!g) return;
      if (e.touches.length !== 2) { g = null; return; }
      const p = two(e);
      const dx = [p[0][0] - g.p0[0][0], p[1][0] - g.p0[1][0]], dy = [p[0][1] - g.p0[0][1], p[1][1] - g.p0[1][1]];
      if (!g.mode) {
        if (Math.max(Math.hypot(dx[0], dy[0]), Math.hypot(dx[1], dy[1])) < 12) { e.stopPropagation(); return; }
        const [a0, b0] = g.p0;
        const side = Math.abs(a0[0] - b0[0]) >= Math.abs(a0[1] - b0[1]);                          // 指が横に並んでいる
        const vert = dy[0] * dy[1] > 0 && Math.min(Math.abs(dy[0]), Math.abs(dy[1])) >= 9
          && Math.abs(dx[0]) <= Math.abs(dy[0]) * 0.4 && Math.abs(dx[1]) <= Math.abs(dy[1]) * 0.4;  // そろって上下に
        const same = Math.abs(dy[0] - dy[1]) <= Math.max(8, Math.abs(dy[0] + dy[1]) / 2 * 0.35);
        const steady = Math.abs(dist(p) - g.d0) <= Math.max(8, g.d0 * 0.08);                       // 指の間隔がほぼ変わらない
        g.mode = side && vert && same && steady ? 'pitch' : 'map';
        if (g.mode === 'pitch') { g.y0 = (p[0][1] + p[1][1]) / 2; g.pitch0 = map.getPitch(); c.gest = c.pg = true; }
      }
      if (g.mode === 'pitch') {
        e.stopPropagation(); e.cancelable && e.preventDefault();
        const y = (p[0][1] + p[1][1]) / 2;
        map.setPitch(Math.max(0, Math.min(70, g.pitch0 - (y - g.y0) * 0.5)));
        poke();
      }
    }, { capture: true, passive: false });
    const end = e => {
      if (!g || e.touches.length >= 2) return;
      if (g.mode === 'pitch') { c.pg = c.gest = false; c.holdUntil = performance.now() + 300; }
      g = null;
    };
    el.addEventListener('touchend', end, { capture: true, passive: true });
    el.addEventListener('touchcancel', end, { capture: true, passive: true });
  }

  function setBase(id, save) {
    const c = cur; if (!c || !BASES[id]) return;
    if (c.eco && id === 'photo') { ui.toast('省電力中は航空写真を使いません'); return; }
    c.base = id; c.tmpBase = null; save && ls.set('lm-base', id);
    applyBase();
  }
  function applyBase() {
    const c = cur; if (!c || !c.map) return;
    const b = c.tmpBase || c.base;
    try { Object.keys(BASES).forEach(id => c.map.setLayoutProperty(id, 'visibility', id === b ? 'visible' : 'none')); } catch { /* 地図の準備前 */ }
  }
  function setPitch(v) {
    const c = cur; if (!c) return;
    c.pitch = v; ls.set('lm-pitch', String(v));
    if (c.map) {
      const z = c.map.getZoom();
      c.holdUntil = performance.now() + 800;   // 角度を変えているあいだは、追いかけるカメラで止めない
      c.map.easeTo({ pitch: v, zoom: v >= 5 && z < 10.8 ? 11.3 : v < 5 && z > 11 ? 10.3 : z, duration: 700 });
    }
    drawTools();
  }
  /* 方位磁針：北が上 ⇔ 進行方向が上。2本指で回したあとは、押すと元の向きに戻す */
  function compass() {
    const c = cur; if (!c) return;
    if (c.free) c.free = false;
    else { c.orient = c.orient === 'north' ? 'head' : 'north'; ls.set('lm-orient', c.orient); }
    if (c.map) { c.holdUntil = performance.now() + 700; c.map.easeTo({ bearing: c.orient === 'north' ? 0 : headingAt(c.tgt ?? c.last.km), duration: 600 }); }
    drawTools();
  }
  function setEco(on) {
    const c = cur; if (!c || c.eco === on) { drawCtrl(); return; }
    c.eco = on; ls.set('lm-eco', on ? '1' : null);
    if (on) {
      ls.set('lm-eco-prev', JSON.stringify({ pitch: c.map ? Math.round(c.map.getPitch()) : c.pitch, base: c.base }));
      if (c.base === 'photo' || c.base === 'std' || c.base === 'osm') { c.base = 'pale'; applyBase(); }
      setPitch(0);
      c.wakeWant = false; ss.set('lm-wake', null); c.wakeFn && c.wakeFn();
    } else {
      let prev = null; try { prev = JSON.parse(ls.get('lm-eco-prev')); } catch { /* noop */ }
      if (prev) { BASES[prev.base] && (c.base = prev.base, applyBase()); typeof prev.pitch === 'number' && setPitch(prev.pitch); ls.set('lm-base', c.base); }
    }
    try { c.map && c.map.setPixelRatio(Math.min(window.devicePixelRatio || 1, on ? 1 : 2)); } catch { /* noop */ }
    c.camAt = 0; drawCtrl();
  }

  /* ---------- 地図の更新 ----------
     地図の描き直し（カメラの移動）は4秒に1回（省電力は10秒・おためしの早送りは1秒）。列車の印は、その合間になめらかに動かす */
  const camInterval = () => { const c = cur, st = Clock.state(); return c.eco ? 10e3 : st && st.speed >= 10 && !st.paused ? 1e3 : 4e3; };
  function mapTick(r, force) {
    const c = cur; if (!c || !c.map || !c.train || !c.active()) return;
    const due = force || performance.now() - c.camAt >= camInterval() - 60;
    c.tgt = r.km;
    if (!c.eco || due) animTrain(force || Math.abs(r.km - (c.disp ?? r.km)) > 60);
    if (!due) return;
    c.camAt = performance.now();
    camera(false);
    if (c.loaded) {
      const src = c.map.getSource('done');
      src && src.setData(r.mode === 'before' ? emptyLine() : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: sliceLine(c.S.first.km, r.km) } });
    }
  }
  function animTrain(jump) {
    const c = cur;
    const from = c.disp ?? c.tgt, to = c.tgt, t0 = performance.now(), D = 900;
    c.anim && cancelAnimationFrame(c.anim);
    let last = 0;
    const step = ts => {
      if (cur !== c) return;
      const f = jump ? 1 : Math.min(1, (ts - t0) / D);
      if (f < 1 && ts - last < 66) { c.anim = requestAnimationFrame(step); return; }   // 1秒に15回まで
      last = ts;
      c.disp = from + (to - from) * f;
      c.train.setLngLat(pointAt(c.disp)); trainFace(c);
      c.anim = f < 1 ? requestAnimationFrame(step) : null;
    };
    c.anim = requestAnimationFrame(step);
  }
  /* カメラ：追いかけるときは中心だけを動かす。傾きはそのまま。向きは「北が上」なら0、「進行方向」なら線路の向き、回したあとはそのまま */
  function camera(ease) {
    const c = cur; if (!c || !c.map || !c.follow || c.gest) return;
    if (performance.now() < (c.holdUntil || 0)) { c.camAt = 0; return; }
    const km = c.tgt ?? c.disp;
    const opt = { center: pointAt(km) };
    if (c.full && c.pad) opt.padding = c.pad;
    if (!c.free) opt.bearing = c.orient === 'north' ? 0 : headingAt(km);
    if (ease) c.map.easeTo({ ...opt, duration: 800 });
    else c.map.easeTo({ ...opt, duration: Math.min(700, camInterval() * 0.5), easing: t => t });
  }

  /* ---------- このページ専用の初回ガイド ---------- */
  /* 「？」：写真つきの説明書（使い方ページの「いまどのへん？」）か、この画面の上での案内かを選ぶ */
  function helpChoice() {
    ui.sheet('いまどのへん？の使い方', `<div class="pick lm-help">
      <a href="#/help/live"><span><b>説明書を開く</b><br><span class="small muted">画面の写真に番号を付けて、ボタンの役目をまとめています。</span></span><span aria-hidden="true">→</span></a>
      <button type="button" data-g="1"><span><b>この画面の上で案内を見る</b><br><span class="small muted">見どころのピン・地図の操作・方位磁針などを、順に照らして案内します。</span></span><span aria-hidden="true">→</span></button></div>`,
      (bg, close) => { $('[data-g]', bg).addEventListener('click', () => { close(); setTimeout(() => runGuide(true), 250); }); });
  }
  function runGuide(force) {
    const c = cur; if (!c || !window.Guide) return;
    const root = c.root;
    const pinTarget = () => {
      if (!c.map) return null;
      const box = $('#lm-map', root).getBoundingClientRect();
      const inBox = el => { const r = el.getBoundingClientRect(); return r.left > box.left + 4 && r.right < box.right - 60 && r.top > box.top + 4 && r.bottom < box.bottom - 20; };
      const p = c.pins.filter(x => x.lv === 'hot' || x.lv === 'near').find(x => inBox(x.el)) || c.pins.find(x => !x.el.classList.contains('nolabel') && inBox(x.el));
      return p ? p.el.querySelector('.lm-pin-in') : null;
    };
    const toMap = async () => { if (!c.full) { c.root.scrollIntoView({ block: 'start' }); await sleep(120); } };
    Guide.run('livemap', [
      { el: () => pinTarget() || $('#lm-map', root), title: '見どころのピン', text: '名前を押すと、紹介が下から開きます。ピンの色と記号は種類（城・寺社・自然・川・街）を表します。', before: toMap },
      { el: '#spots', title: '見どころの紹介と一覧', text: '紹介には、ところ・ひとこと・くわしい説明が載っています。地図の下へスクロールすると「沿線の見どころ一覧」を通る順に見られます。', before: async () => { const h = $('#spots'); if (h) { h.scrollIntoView({ block: 'start' }); await sleep(150); } }, after: toMap },
      { el: '#lm-map', title: c.full ? '地図の操作' : '押して地図を操作', text: c.full ? '1本指で地図を動かし、2本指で拡大・縮小や回転ができます。2本指をそろえて上下にずらすと傾きます。動かすと列車を追いかけるのを止めます。「列車へ」で戻ります。' : 'ふだんは1本指でページをスクロールします。地図を1回押すと枠が朱色になり、1本指で動かす・2本指で拡大・縮小や回転ができます。2本指をそろえて上下にずらすと傾きます。「操作を終える」を押すか、地図の外を押すと戻ります。' },
      { el: () => $('[data-lm="tools"]', root), title: '地図の操作ボタン', text: '押すと開きます（もう一度押すと閉じます）。開くと、方位磁針（押すと北が上に、もう一度押すと進行方向が上。赤い側が北）・立体・地図の種類（標準・淡色・航空写真・OpenStreetMap）・列車へ・全画面・設定・使い方のボタンが並びます。' },
      { el: () => c.full ? $('[data-lm="tools"]', root) : $('.lm-sum', root), title: 'お知らせと画面の設定', text: `${c.full ? '「操作」を押して開き、⚙' : 'この1行か、「操作」を開いた中の ⚙'}を押すと設定が開きます。お知らせをONにすると、降りる駅の5分前と1分前にバイブと画面でお知らせします。画面を自動で消さない・省電力もここで切り替えます。`, after: toMap }
    ], { force });
  }

  window.LiveMap = {
    mount, unmount,
    guide: () => runGuide(true),
    /* 路線図（既存）と同じ時刻表で動かすための、GPSで分かった遅れ（ミリ秒）。分からなければ 0 */
    delayMs: () => (cur && cur.last && cur.last.gpsDelay ? cur.last.delay : 0),
    _internals: { sched, Tracker, snap, pointAt, PrefWatch, prefAt, splitMuni },
    _debug: () => cur && {
      last: cur.last, fix: cur.tk.fix, reject: cur.tk.reject, follow: cur.follow, map: !!cur.map, loaded: !!cur.loaded, gpsOn: !!cur.unGeo, gpsWant: cur.gpsWant, geomFallback: !!geom.fallback && !lineGeo,
      pitch: cur.map ? cur.map.getPitch() : cur.pitch, bearing: cur.map ? cur.map.getBearing() : null, orient: cur.orient, free: cur.free, base: cur.tmpBase || cur.base, eco: cur.eco,
      camInterval: camInterval(), mapVisible: cur.mapVisible, active: cur.active(), alarms: { ...cur.alarms }, pins: cur.pins.map(p => [p.s.id, p.lv, !p.el.classList.contains('nolabel')])
    },
    _map: () => cur && cur.map
  };
})();
