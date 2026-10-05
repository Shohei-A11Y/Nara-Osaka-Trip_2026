/* ライブ地図（のぞみ・リレーかもめの車内用）
   「路線の起点から何km地点か」という1つの数値で、列車の位置を管理する（山陽新幹線は新大阪から、リレーかもめは博多の少し北から）。
   - 時刻表からの推定：駅と駅の間は、時間に比例して進む（＝区間の平均速度で走る）とみなす
   - GPS：線路に吸着してkmに直し、時刻表とのずれ（遅れ）を記録。GPSが途切れたら「時刻表＋記録した遅れ」で進める
   路線（線路の形・駅・市町村・トンネル・見どころ・トリビア）は列車ごとに入れ替える：列車のデータ T.trains[key].line（なければ山陽新幹線）で、
   window.LINES の路線を選ぶ。時刻表は T.liveLine[key]（のぞみ・リレーかもめの駅一覧を合わせたもの）。
   地図（MapLibre GL JS）は後から読み込む。読み込めなくても、位置・パネル・お知らせ・一覧はそのまま動く。
   位置情報はこの端末の中だけで使い、どこにも送らない。 */
(() => {
  'use strict';
  const T = window.TRIP, LINES = window.LINES || (window.LINE ? { sanyo: window.LINE } : null), Clock = window.Clock, Geo = window.Geo, GeoPerm = window.GeoPerm;
  if (!T || !LINES || !LINES.sanyo || !Clock || !Geo || !GeoPerm) return;
  const TT_LIVE = T.liveLine || T.nozomiLine;   // いまどのへん？がある列車の駅一覧（[駅, 府県, 着/通過, 発, 停車]）
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MIN = 6e4;
  const MAPLIBRE = 'assets/vendor/maplibre-gl/maplibre-gl.mjs';
  const LINE_URLS = { sanyo: 'assets/line-sanyo.json?v=36', relay: 'assets/line-relay.json?v=36' };
  const GPS_MAX_OFF = 0.5, GPS_MAX_ACC = 1000, GPS_MAX_AGE = 30e3, V_MAX = 330;

  /* ========== 線路の形（km ⇔ 緯度経度） ========== */
  const R = 6371.0088, rad = d => d * Math.PI / 180;
  const hav = (a, b) => { const la1 = rad(a[1]), la2 = rad(b[1]); const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(rad(b[0] - a[0]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  function bearing(a, b) {
    const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1])), x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  /* 「岡山県 浅口市付近」：府県名を添え、郡部の町村は郡名を省く（浅口郡里庄町 → 里庄町）。長いときは府県名を小さく上に添える2段にする */
  const splitMuni = m => { const x = /^(.+?[都道府県])(.*)$/.exec(m) || [, '', m]; return { pref: x[1], city: x[2].replace(/^.+?郡(?=.+?[町村]$)/, '') }; };
  const whereHTML = m => {
    if (m === '関門海峡の海底') return '関門海峡の海底を走行中';
    const { pref, city } = splitMuni(m);
    return `<span class="lm-wh${city.length >= 7 ? ' stack' : ''}"><small class="lm-wh-p">${pref}</small><span class="lm-wh-c">${city}付近</span></span>`;
  };
  /* 路線ひとつ分の道具（線路の形・駅・市町村・トンネル）。路線を問わない作り。
     線路の形（GeoJSON）が読めるまでは、駅と駅を直線で結んだ線で代用する */
  function Line(id) {
    const L = LINES[id];
    const ln = { id, L, geom: null, lineGeo: null };
    const setGeom = coords => { const cum = [0]; for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + hav(coords[i - 1], coords[i])); ln.geom = { coords, cum }; };
    setGeom(L.stations.map(s => [s[2], s[1]]));
    ln.geom.fallback = true;
    ln.geom.cum = L.stations.map(s => s[3]);
    ln.ready = fetch(LINE_URLS[id]).then(r => r.json()).then(g => { ln.lineGeo = g; setGeom(g.features[0].geometry.coordinates); return g; }).catch(() => null);
    ln.pointAt = km => {
      const { coords: c, cum } = ln.geom;
      if (km <= cum[0]) return c[0];
      if (km >= cum[cum.length - 1]) return c[c.length - 1];
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; cum[m] <= km ? (lo = m) : (hi = m); }
      const t = (km - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
      return [c[lo][0] + (c[hi][0] - c[lo][0]) * t, c[lo][1] + (c[hi][1] - c[lo][1]) * t];
    };
    ln.snap = (lat, lon) => {
      const { coords: c, cum } = ln.geom, kx = Math.cos(rad(lat)) * 111.32, ky = 110.57;
      let best = { off: Infinity, km: 0 };
      for (let i = 0; i < c.length - 1; i++) {
        const ax = (c[i][0] - lon) * kx, ay = (c[i][1] - lat) * ky, bx = (c[i + 1][0] - lon) * kx, by = (c[i + 1][1] - lat) * ky;
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
        const d = Math.hypot(ax + t * dx, ay + t * dy);
        if (d < best.off) best = { off: d, km: cum[i] + t * (cum[i + 1] - cum[i]) };
      }
      return best;
    };
    ln.bearingAt = (km, dir) => bearing(ln.pointAt(km - 0.6 * dir), ln.pointAt(km + 0.6 * dir));
    ln.muniAt = km => { let n = L.munis[0][1]; for (const m of L.munis) { if (m[0] <= km) n = m[1]; else break; } return n; };
    ln.tunnelAt = km => L.tunnels.find(t => t[0] <= km && km <= t[1]) || null;
    ln.prefAt = km => splitMuni(ln.muniAt(km)).pref || null;   // 関門海峡の海底は null
    ln.stationKm = name => (L.stations.find(s => s[0] === name) || [])[3];
    /* 府県の並び：km の小さい方から通る順（山陽新幹線は新大阪から博多へ。リレーかもめは博多から武雄温泉へ） */
    ln.prefOrder = L.prefs || ['大阪府', '兵庫県', '岡山県', '広島県', '山口県', '福岡県'];
    /* km の範囲 [a, b] の線の座標 */
    ln.sliceLine = (a, b) => {
      if (a > b) [a, b] = [b, a];
      const { coords, cum } = ln.geom, out = [ln.pointAt(a)];
      for (let i = 0; i < cum.length; i++) if (cum[i] > a && cum[i] < b) out.push(coords[i]);
      out.push(ln.pointAt(b));
      return out;
    };
    return ln;
  }
  const LN = {};
  Object.keys(LINES).forEach(id => { if (LINE_URLS[id]) LN[id] = Line(id); });
  /* 列車 → 路線 */
  const lineOf = key => LN[(T.trains[key] || {}).line] || LN.sanyo;
  /* ここから下の画面の道具（地図・パネル・お知らせ・一覧）は、いま表示している路線（mount で切り替える）を使う。
     時刻表・GPS・おためしの位置・府県の知らせは、列車ごとの路線（sched(key).ln）を使う */
  let ln = LN.sanyo, L = ln.L;
  const useLine = x => { ln = x; L = x.L; };
  const pointAt = km => ln.pointAt(km);
  const muniAt = km => ln.muniAt(km);
  const tunnelAt = km => ln.tunnelAt(km);
  const stationKm = name => ln.stationKm(name);
  const sliceLine = (a, b) => ln.sliceLine(a, b);

  /* ========== 時刻表 ========== */
  const jst = (date, hm) => +new Date(`${date}T${hm.length === 4 ? '0' + hm : hm}:00+09:00`);
  const schedCache = {};
  function sched(key) {
    if (schedCache[key]) return schedCache[key];
    const tr = T.trains[key], sl = lineOf(key);
    const st = TT_LIVE[key].map(([name, , a, d, stop]) => ({ name, km: sl.stationKm(name), arr: jst(tr.date, a || d), dep: jst(tr.date, d || a), stop: !!stop }));
    const dir = Math.sign(st[st.length - 1].km - st[0].km);
    const S = { key, tr, st, dir, first: st[0], last: st[st.length - 1], ln: sl };
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
    /* 乗車の時間帯：発車の30分前〜到着の2時間後（GPSを受け付ける・自動で使う時間帯） */
    S.ride = t => t >= st[0].dep - RIDE_PRE && t <= st[st.length - 1].arr + RIDE_POST;
    return (schedCache[key] = S);
  }
  const RIDE_PRE = 30 * MIN, RIDE_POST = 120 * MIN;
  /* いま乗車の時間帯にある列車（いまどのへん？がある列車の中から。なければ null）。
     乗り継ぐ日は、前の列車の「到着の2時間後まで」と次の列車の時間帯が重なるので、走っている列車（発車30分前〜到着）を先に選ぶ */
  const rideKey = (t = +Clock.now()) => {
    const ks = Object.keys(TT_LIVE);
    return ks.find(k => { const S = sched(k); return t >= S.first.dep - RIDE_PRE && t <= S.last.arr; }) || ks.find(k => sched(k).ride(t)) || null;
  };
  const ECO_GPS = 60e3;   // 省電力中は、位置を60秒に1回だけ取る（遅れを測るのに足りる最低限）

  /* ========== おためし：線路を走る作り物のGPS ========== */
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  Object.keys(TT_LIVE).forEach(key => {
    Geo.tracks[key] = (now, delayMin) => {
      const S = sched(key), sl = S.ln, t = +now - delayMin * MIN, s = S.at(t);
      if (sl.tunnelAt(s.km) && s.mode === 'running') return null;   // トンネル内は電波が届かない
      const p = sl.pointAt(s.km), jm = 30;                              // 数十mの揺れ
      const lat = p[1] + gauss() * jm / 110570, lon = p[0] + gauss() * jm / (111320 * Math.cos(rad(p[1])));
      const v = s.mode === 'running' ? Math.max(0, s.v / 3.6 + gauss() * 1.5) : 0;
      return { lat, lon, acc: Math.round(15 + Math.random() * 30), speed: v, heading: s.mode === 'running' ? sl.bearingAt(s.km, S.dir) : null, src: 'sim', at: new Date(+now) };
    };
  });

  /* ========== 位置の推定（時刻表 × GPS） ==========
     遅れの合わせ方（停車駅を基準にする）
     - 停車駅に止まっているあいだ（hold）：定刻の発車を過ぎても止まっていれば、遅れは1秒ずつ増える（列車は駅に置いたまま）。
       遅れて着いたときは、着いた時刻＋最低の停車時間（最大1分）より前には発車しないとみなす。早く着いたときは、定刻の発車まで待つ。
     - 動き出したら：その時点の遅れ（base）で、以降の時刻をすべてずらす。駅と駅のあいだは、時刻表を区間の平均の速さで割り振った推定なので、
       加速・減速のぶん1〜2分ずれて見える。そのふらつきでは遅れを変えず、2分を超えてずれたとき（ゆっくり走った・駅の外で止まった）だけ測り直す。
       駅の外で止まっている（速さがほぼ0）あいだは、止まった位置に合わせて遅れを増やす。
     - 次の停車駅に着いたら、着いた時刻で遅れを更新。以降、停車駅ごとに同じ。終点では、着いた時刻の遅れのまま。
     - トンネルなどで位置が途切れても、最後の遅れを使い続ける（このタブでいまどのへん？を開き直しても、同じ乗車のあいだは覚えておく） */
  const HOLD_MAX = 90e3;      // 駅に止まっていた最後の位置から、この時間は駅に置いたままにする（省電力は60秒に1回なので、それより長く）
  const DELAY_TOL = 2 * MIN;  // 駅の間で、時刻表の割り振りとのずれをこれ以上なら測り直す
  function Tracker(key) {
    const S = sched(key);
    const tk = { S, fix: null, fixes: [], delay: 0, delayAt: null, v: null, reject: '', hold: null, base: null };
    const lastI = S.st.length - 1;
    /* 開き直したときは、同じ乗車のあいだに測った遅れから始める。
       終点に着いたあと（遅れを足した到着の時刻を過ぎてから）開き直したときは、着いたものとして、その遅れのままにする
       （乗り継ぐ日は、次の列車の乗車の時間帯に入ると画面が組み直される。着いたことを忘れると、組み直した時刻に着いたとみなして遅れが増える） */
    const mem = PrefWatch.getDelay(key), now0 = +Clock.now();
    if (mem && S.ride(now0)) {
      tk.delay = tk.base = mem.d; tk.delayAt = mem.at || now0;
      if (now0 >= S.last.arr + mem.d) tk.hold = { i: lastI, arrAt: S.last.arr + mem.d, at: now0, done: true };
    }
    /* 停車駅 i に止まっていて、時刻 t のときの遅れ（いつ発車するとみなすか） */
    const holdDelay = (h, t) => {
      const st = S.st[h.i];
      if (h.i === lastI) return h.arrAt != null ? h.arrAt - st.arr : tk.delay;
      const dwell = Math.min(st.dep - st.arr, MIN);
      return Math.max(st.dep, h.arrAt != null ? h.arrAt + dwell : -Infinity, t) - st.dep;
    };
    tk.onFix = pos => {
      if (!pos) return;
      const now = +Clock.now();
      let at = +pos.at;
      if (!isFinite(at) || Math.abs(now - at) > 6 * 36e5) at = now;   // 端末によっては時刻の基準がずれた値が来るので、受け取った時刻で代用
      if (pos.acc > GPS_MAX_ACC) { tk.reject = 'acc'; return; }
      if (now - at > GPS_MAX_AGE) { tk.reject = 'old'; return; }
      if (!S.ride(now)) { tk.reject = 'time'; return; }
      const sn = S.ln.snap(pos.lat, pos.lon);
      if (sn.off > GPS_MAX_OFF) { tk.reject = 'far'; return; }
      tk.reject = '';
      let km = sn.km;
      /* 速さ：GPSの値がなければ、直前の位置からの進み方で見る */
      const prev = tk.fixes[tk.fixes.length - 1];
      const speed = pos.speed != null ? pos.speed : prev && at - prev.at >= 5e3 ? Math.abs(km - prev.km) * 1e6 / (at - prev.at) : null;
      const slow = speed != null && speed < 1.5;
      /* 停車駅で止まっているときは、その駅に固定 */
      const stn = S.st.find(x => x.stop && Math.abs(x.km - km) < (slow ? 0.6 : 0.15));
      const atStn = stn && (slow || speed == null);
      if (atStn) {
        km = stn.km;
        const i = S.st.indexOf(stn);
        if (!tk.hold || tk.hold.i !== i) tk.hold = { i, arrAt: i === 0 ? null : at };   // 着いた（始発駅は、着いた時刻を使わない）
        tk.hold.at = at;
        /* 終点に着いたあとは、着いた時刻の遅れのまま（それより前に終点で測っていたら、それを使い続ける） */
        if (i === lastI && tk.hold.done) { /* そのまま */ }
        else { tk.delay = tk.base = holdDelay(tk.hold, at); tk.delayAt = at; if (i === lastI) tk.hold.done = true; }
      } else {
        tk.hold = null;
        const [t1, t2] = S.when(km), raw = at - Math.min(Math.max(at, t1), t2);
        /* 駅の外で止まっている・時刻表の割り振りから2分を超えてずれた・まだ測っていない → 測り直す。それ以外は、発車したときの遅れのまま */
        if (tk.base == null || slow || Math.abs(raw - tk.base) > DELAY_TOL) tk.base = raw;
        tk.delay = tk.base; tk.delayAt = at;
      }
      tk.fix = { km, at, speed: pos.speed, off: sn.off };
      tk.fixes.push({ km, at }); if (tk.fixes.length > 3) tk.fixes.shift();
    };
    tk.compute = () => {
      const now = +Clock.now();
      const fresh = !!(tk.fix && now - tk.fix.at <= GPS_MAX_AGE);
      let delay = tk.delay, t = now - delay;
      /* 停車駅に止まっているあいだは、駅に置いたまま（遅れはその場で増やす）。位置が途切れて HOLD_MAX を過ぎたら、最後に止まっていた時刻に発車したとみなす */
      const h = tk.hold;
      if (h && h.i !== lastI && now - h.at <= HOLD_MAX) {
        const st = S.st[h.i];
        delay = holdDelay(h, now);
        t = Math.min(Math.max(now - delay, st.arr), st.dep - 1);
      }
      const s = S.at(t);
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
      /* GPSで遅れを測ったことがあれば、途切れても（トンネル・画面を消していたあいだも）その遅れを使い続ける */
      const gpsDelay = tk.delayAt != null && S.ride(now);
      if (gpsDelay) PrefWatch.setDelay(S.key, delay, tk.delayAt);
      return { now, km, mode: s.mode, i: s.i, src: fresh ? 'gps' : 'est', speed: tk.v, approx, delay, gpsDelay, t };
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
    const setDelay = (key, d, at) => { if (mem && mem.key === key && Math.abs(mem.d - d) < 15e3 && (!at || at - (mem.at || 0) < 60e3)) return; mem = { key, d, at }; try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* noop */ } };
    const getDelay = key => (mem && mem.key === key && isFinite(mem.d) ? mem : null);
    const active = () => {
      const t = +Clock.now();
      for (const key of Object.keys(TT_LIVE)) {
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
      const km = a.S.at(a.t - a.d).km, pf = a.S.ln.prefAt(km), PO = a.S.ln.prefOrder;
      /* 早送り・時刻の移動などで大きく飛んだときは、起点を置き直すだけ */
      if (!base || base.key !== a.S.key || Math.abs(km - base.km) > 40) { base = { key: a.S.key, km, pf: pf || (base && base.key === a.S.key ? base.pf : null) }; return; }
      base.km = km;
      /* 進む向きに新しい府県へ入ったときだけ、1つの境に1回。GPSで遅れを測り直して少し戻ったときなどは出さない */
      const fwd = (PO.indexOf(pf) - PO.indexOf(base.pf)) * a.S.dir > 0;
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
    return { setDelay, getDelay, _tick: tick, _state: () => ({ base, pend, mem }) };
  })();

  /* ========== 表示のための小道具 ========== */
  let ui = null;   // app.js から借りる { esc, fmtHM, sheet, toast, gmap, ext, full, fresh }
  /* 見どころの種類：5色＋ピンの頭の小さな記号（色だけに頼らない） */
  const CATS = {
    castle: { name: '城', color: '#c8453f', sym: '<path d="M2 10.5h8M3 10.5V7.2h6v3.3M2.2 7.2 6 4.3l3.8 2.9M4.6 4.4 6 2.3l1.4 2.1"/>' },
    shrine: { name: '寺社・史跡', color: '#6e5c9a', sym: '<path d="M1.3 3.4c3.1.9 6.3.9 9.4 0M2.4 5.6h7.2M3.9 3.9v6.8M8.1 3.9v6.8"/>' },
    nature: { name: '山・自然・温泉', color: '#4f7a3a', sym: '<path d="M1 10.2 4.4 4.2l2.1 3.1 1.5-2 3 4.9z"/>' },
    water: { name: '川・海', color: '#2f6f93', sym: '<path d="M1.2 4.8c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0M1.2 8.4c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0"/>' },
    town: { name: '街・名所・味', color: '#a8770f', sym: '<path d="M2 10.6V4.8l3-1.8v7.6M5 10.6V6h5v4.6M1 10.6h10"/>' },
    stn: { name: '通過駅', color: '#56687c', sym: '<path d="M1.5 2.4h9v4.4h-9zM3.5 6.8v3.9M8.5 6.8v3.9M3.4 4.6h5.2"/>' }   // 駅名の札の形
  };
  const CAT_OF = { 城: 'castle', 寺社: 'shrine', 自然: 'nature', 温泉: 'nature', 川: 'water', 町並み: 'town', 名所: 'town', 食: 'town', 駅: 'stn' };
  const catOf = s => CATS[CAT_OF[s.genre] || 'town'];
  const symSvg = s => `<svg class="lm-sym" viewBox="0 0 12 12" aria-hidden="true">${catOf(s).sym}</svg>`;
  const prefOf = s => (s.pref.match(/^(.+?[都道府県])/) || [, s.pref])[1];
  const kmTxt = k => k >= 10 ? Math.round(k) : k >= 1 ? k.toFixed(1).replace(/\.0$/, '') : k.toFixed(1);
  const offTxt = s => s.off < 0.3 || !s.dir ? '線路のすぐそば' : `線路から${s.dir}へ約${kmTxt(s.off)}km`;
  /* 窓の左右。山陽新幹線はほぼ東西に走るので、北側（N）・南側（S）で書く（往路＝東へは北側が左。北側が D・E席）。
     リレーかもめは向きが変わる（博多〜鳥栖は南北）ので、北・南では書かず、線路の向きと見どころの位置から、進行方向の左右を求める（vis: 'Y'） */
  function winSide(s, dir) {
    const a = pointAt(s.km - 0.3 * dir), b = pointAt(s.km + 0.3 * dir), k = Math.cos(rad(a[1]));
    const cx = (b[0] - a[0]) * k, cy = b[1] - a[1], px = (s.lon - a[0]) * k, py = s.lat - a[1];
    return cx * py - cy * px > 0 ? 'L' : 'R';
  }
  const sideTxt = (s, go) => {
    if (s.vis === 'Y') { const d = cur ? cur.S.dir : 1; return `進行方向の${winSide(s, d) === 'L' ? '左' : '右'}の窓`; }
    return s.vis === 'N' ? `${go ? '左' : '右'}の窓（北側）＝ D・E席側` : s.vis === 'S' ? `${go ? '右' : '左'}の窓（南側）＝ 通路の反対側の窓` : '両側の窓から';
  };
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
    osm: { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: OSM_ATTR },
    /* 住所：淡色の地図（under）の上に、市区町村の色分け・境界線・名前を重ねる（assets/area.json） */
    addr: { name: '住所（市区町村）', under: 'pale' },
    /* 住所（航空写真）：航空写真（under）の上に、同じ色分け・境界線・名前を重ねる。立体の地形・省電力・電波が弱いときの扱いは、航空写真と同じ */
    addrp: { name: '住所（航空写真）', under: 'photo' }
  };
  const rasterOf = id => (BASES[id] && BASES[id].under) || id;
  const rasterNow = c => rasterOf(c.tmpBase || c.base);   // いま描いている下の地図（住所の地図なら、その下の淡色・航空写真）
  const PITCH_3D = 55;
  /* ---------- 3D地形（立体表示のときだけ） ----------
     標高は地理院の標高タイル（dem_png）。地理院独自の形式（x = R×2^16 + G×2^8 + B、x < 2^23 なら x×0.01 m、x > 2^23 なら (x − 2^24)×0.01 m、
     x = 2^23（128,0,0）は海などの無効値）なので、読み込むときに terrarium 形式（(R×256 + G + B/256) − 32768 m）へ直す。無効値は 0m。
     取れないタイル（海で無い・圏外）は、0mの平らなタイルにする（地形が平らに戻るだけで、地図は止めない）。
     誇張は1.5倍。地図の種類が航空写真で、立体表示のときだけ使う（setTerrain）。
     標準・淡色・OSM は地図に文字が描き込まれていて、地形で盛り上げると文字がボコボコして読みにくいので、立体（斜め）でも平らにする。省電力でも使わない */
  const DEM = 'https://cyberjapandata.gsi.go.jp/xyz/dem_png/', TERRAIN_X = 1.5;
  let demOn = false, demCv = null, demFlat = null;
  async function demPng(img) {
    if (!demCv) demCv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    const g = demCv.getContext('2d', { willReadFrequently: true });
    let px;
    if (img) { g.clearRect(0, 0, 256, 256); g.drawImage(img, 0, 0, 256, 256); px = g.getImageData(0, 0, 256, 256); }
    else px = g.createImageData(256, 256);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      let h = 0;
      if (img) { const x = d[i] * 65536 + d[i + 1] * 256 + d[i + 2]; h = x === 8388608 ? 0 : (x > 8388608 ? x - 16777216 : x) * 0.01; }
      const v = h + 32768, f = Math.floor(v);
      d[i] = f >> 8; d[i + 1] = f & 255; d[i + 2] = Math.floor((v - f) * 256); d[i + 3] = 255;
    }
    g.putImageData(px, 0, 0);
    const blob = demCv.convertToBlob ? await demCv.convertToBlob({ type: 'image/png' }) : await new Promise(r => demCv.toBlob(r, 'image/png'));
    return blob.arrayBuffer();
  }
  async function demLoad(params, ac) {
    const m = /^gsidem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    let img = null;
    try {
      const res = await fetch(`${DEM}${m[1]}/${m[2]}/${m[3]}.png`, { signal: ac && ac.signal });
      if (res.ok) img = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    } catch (e) { if (ac && ac.signal.aborted) throw e; }
    if (!img) return { data: (demFlat = demFlat || await demPng(null)).slice(0) };
    const data = await demPng(img); img.close && img.close();
    return { data };
  }
  /* 航空写真の立体表示（傾き5°以上）で、省電力でなければ地形を盛り上げる。それ以外は平ら（トンネルは tunnelMode で、地形の有無に合わせて描き分ける） */
  function syncTerrain(c, to3d) {
    const m = c && c.map; if (!m || !c.loaded || !m.getSource('dem')) return;
    const want = !c.eco && rasterNow(c) === 'photo' && (to3d ?? m.getPitch() >= 5), has = !!m.getTerrain();
    if (want === has) return;
    try { m.setTerrain(want ? { source: 'dem', exaggeration: TERRAIN_X } : null); } catch { /* 地形が使えなくても、平らなまま続ける */ }
    tunnelMode(c);
  }

  /* ---------- トンネル（路線を問わない作り。線路の形 pointAt(km) とトンネルの一覧を渡すだけで描ける） ----------
     トンネルの一覧は [入口km, 出口km, 名前, 入口の標高m, 出口の標高m]（標高は tools/make-tunnel-portals.js で求める。2km以上のみ）。
     - 地表に貼る赤い線は、トンネルの外だけ（tunnelSplit）。
     - 平面・省電力・地形がないとき：トンネルの中は、地図に貼った紺の点線（2Dのレイヤー tun-case・tun・tun-done）。
     - 立体の地形のとき：入口と出口の標高を直線で結んだ高さ（山の中）に、紺の点線を立体で描く（TunnelLayer。カスタムレイヤー）。
       奥行きの判定をしないので、山の手前でも裏でも、山を透かして見える。平面の位置は線路の形どおり（曲がったトンネルは曲がったまま）。
     - 通り過ぎた分は灰色（setKm）。 */
  const tunAlt = (tunnels, km) => { const t = tunnels.find(x => x[0] <= km && km <= x[1]); return t && t.length >= 5 ? t[3] + (t[4] - t[3]) * (km - t[0]) / ((t[1] - t[0]) || 1) : null; };
  /* km の範囲 [a, b] を、トンネルの外（open）と中（tun）の線に分ける。slice(a, b) はその範囲の線の座標 */
  function tunnelSplit(tunnels, slice, a, b) {
    if (a > b) [a, b] = [b, a];
    const open = [], tun = [];
    let k = a;
    for (const t of [...tunnels].sort((x, y) => x[0] - y[0])) {
      const s = Math.max(a, t[0]), e = Math.min(b, t[1]);
      if (e <= s) continue;
      if (s > k) open.push(slice(k, s));
      tun.push(slice(s, e)); k = e;
    }
    if (b > k) open.push(slice(k, b));
    return { open, tun };
  }
  const multiLine = lines => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } });
  const mercXYZ = (lon, lat, alt) => { const s = Math.sin(rad(lat)); return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI), alt / (2 * Math.PI * R * 1000 * Math.cos(rad(lat)))]; };
  /* 立体のトンネルの線（WebGL のカスタムレイヤー）。色は CSS の色（'#rrggbb'）。
     線の太さは画面の上の px で、頂点シェーダーで線の向きに直角に広げる（遠近があっても太さは同じ）。点線は線に沿った距離（m）で切る。
     座標は最初の点を原点にした差で持ち、行列の側で原点へずらす（スマホの精度でも揺れないように） */
  function TunnelLayer({ id, pointAt: at, tunnels, exag, color, caseColor, doneColor, onRender }) {
    const STEP = 0.2;   // 曲がりに沿わせるため、0.2kmごとに点を置く
    const vals = [], idx = [];
    let org = null, nv = 0;
    for (const t of tunnels) {
      if (t.length < 5) continue;
      const n = Math.max(1, Math.ceil((t[1] - t[0]) / STEP)), pts = [];
      for (let i = 0; i <= n; i++) { const km = t[0] + (t[1] - t[0]) * i / n, p = at(km); pts.push({ km, p, m: mercXYZ(p[0], p[1], (t[3] + (t[4] - t[3]) * i / n) * exag) }); }
      if (!org) org = pts[0].m;
      let d = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1], dl = hav(A.p, B.p) * 1000;
        for (const [side, end] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) vals.push(A.m[0] - org[0], A.m[1] - org[1], A.m[2] - org[2], B.m[0] - org[0], B.m[1] - org[1], B.m[2] - org[2], side, end, end ? d + dl : d, end ? B.km : A.km);
        idx.push(nv, nv + 1, nv + 2, nv + 1, nv + 3, nv + 2); nv += 4;
        d += dl;
      }
    }
    const rgba = (hex, a = 1) => { const h = hex.replace('#', ''), v = h.length === 3 ? h.split('').map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return [v[0] / 255 * a, v[1] / 255 * a, v[2] / 255 * a, a]; };   // 重ね方に合わせて、色は透明度を掛けておく
    const VS = `attribute vec3 a_a; attribute vec3 a_b; attribute vec4 a_i;
      uniform mat4 u_m; uniform vec2 u_vp; uniform float u_w; uniform float u_cap; varying float v_d; varying float v_km;
      void main() {
        vec4 ca = u_m * vec4(a_a, 1.0), cb = u_m * vec4(a_b, 1.0);
        if (ca.w <= 0.0 || cb.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec2 sa = ca.xy / ca.w * u_vp * 0.5, sb = cb.xy / cb.w * u_vp * 0.5, dir = sb - sa;
        float l = length(dir); dir = l > 1e-4 ? dir / l : vec2(1.0, 0.0);
        vec4 c = a_i.y > 0.5 ? cb : ca;
        vec2 off = (vec2(-dir.y, dir.x) * a_i.x + dir * (a_i.y > 0.5 ? 1.0 : -1.0) * u_cap) * u_w * 0.5;   // 縁は両端を少し延ばして継ぎ目を埋める（点線は延ばさない。延ばすと隙間がふさがる）
        c.xy += off / (u_vp * 0.5) * c.w;
        gl_Position = c; v_d = a_i.z; v_km = a_i.w;
      }`;
    const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform vec4 u_col; uniform vec4 u_col2; uniform float u_ppm; uniform float u_dash; uniform float u_km; uniform float u_dir;
      varying float v_d; varying float v_km;
      void main() {
        if (u_dash > 0.0 && fract(v_d * u_ppm / u_dash) > 0.55) discard;
        gl_FragColor = (v_km - u_km) * u_dir < 0.0 ? u_col2 : u_col;
      }`;
    let map = null, prog = null, buf = null, ibuf = null, vao = null, loc = null, M = null, km = 0, dir = 0;
    const attrs = gl => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      [['a_a', 3, 0], ['a_b', 3, 12], ['a_i', 4, 24]].forEach(([n, k, o]) => { gl.enableVertexAttribArray(loc[n]); gl.vertexAttribPointer(loc[n], k, gl.FLOAT, false, 40, o); });
    };
    const layer = {
      id, type: 'custom', renderingMode: '3d',
      onAdd(m, gl) {
        map = m;
        if (!nv) return;
        const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
        const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
        if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) return;   // 描けない端末は、立体のトンネルなしで続ける
        prog = pg;
        loc = {}; ['a_a', 'a_b', 'a_i'].forEach(n => { loc[n] = gl.getAttribLocation(pg, n); });
        ['u_m', 'u_vp', 'u_w', 'u_cap', 'u_col', 'u_col2', 'u_ppm', 'u_dash', 'u_km', 'u_dir'].forEach(n => { loc[n] = gl.getUniformLocation(pg, n); });
        buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vals), gl.STATIC_DRAW);
        ibuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
        if (gl.createVertexArray) { vao = gl.createVertexArray(); gl.bindVertexArray(vao); attrs(gl); gl.bindVertexArray(null); }
      },
      render(gl, args) {
        const P = args.defaultProjectionData && args.defaultProjectionData.mainMatrix;
        M = P || null;
        if (onRender) onRender();
        if (!prog || !P || !map.getTerrain()) return;   // 立体の地形のときだけ
        const m = new Float32Array(16);
        for (let i = 0; i < 16; i++) m[i] = P[i];
        for (let r = 0; r < 4; r++) m[12 + r] = P[r] * org[0] + P[4 + r] * org[1] + P[8 + r] * org[2] + P[12 + r];
        const cv = map.getCanvas(), z = map.getZoom(), lat = map.getCenter().lat;
        const lerp = (a, b, c) => z <= 12 ? a + (b - a) * Math.max(0, z - 6) / 6 : b + (c - b) * Math.min(1, (z - 12) / 4);
        gl.useProgram(prog);
        vao ? gl.bindVertexArray(vao) : attrs(gl);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniformMatrix4fv(loc.u_m, false, m);
        gl.uniform2f(loc.u_vp, cv.clientWidth, cv.clientHeight);
        gl.uniform1f(loc.u_ppm, 512 * 2 ** z / (2 * Math.PI * R * 1000 * Math.cos(rad(lat))));
        gl.uniform1f(loc.u_km, km); gl.uniform1f(loc.u_dir, dir);
        const core = lerp(2, 4, 7);
        /* 縁（つながった白）→ 点線（紺。通り過ぎた分は灰） */
        gl.uniform1f(loc.u_w, lerp(4, 8, 12)); gl.uniform1f(loc.u_dash, 0); gl.uniform1f(loc.u_cap, 1);
        gl.uniform4fv(loc.u_col, rgba(caseColor, 0.85)); gl.uniform4fv(loc.u_col2, rgba(caseColor, 0.6));
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
        gl.uniform1f(loc.u_w, core); gl.uniform1f(loc.u_dash, Math.max(8, core * 3.2)); gl.uniform1f(loc.u_cap, 0);
        gl.uniform4fv(loc.u_col, rgba(color)); gl.uniform4fv(loc.u_col2, rgba(doneColor));
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
        if (vao) gl.bindVertexArray(null);
      },
      onRemove(m, gl) { prog && gl.deleteProgram(prog); buf && gl.deleteBuffer(buf); ibuf && gl.deleteBuffer(ibuf); vao && gl.deleteVertexArray(vao); prog = null; }
    };
    return {
      layer,
      /* 列車の位置（km）と進む向き（+1／−1。発車前は 0）。後ろ側を灰色にする */
      setKm(k, d) { if (k !== km || d !== dir) { km = k; dir = d; map && map.getTerrain() && map.triggerRepaint(); } },
      /* 経緯度と高さ（m。誇張を掛けたもの）→ 画面の位置 [x, y]（いちばん新しく描いたときの行列で） */
      project(ll, alt) {
        if (!M || !map) return null;
        const v = mercXYZ(ll[0], ll[1], alt), x = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], w = M[3] * v[0] + M[7] * v[1] + M[11] * v[2] + M[15];
        if (!(w > 0)) return null;
        const cv = map.getCanvas();
        return [(x / w + 1) / 2 * cv.clientWidth, (1 - y / w) / 2 * cv.clientHeight];
      }
    };
  }
  /* 平面か立体かで、トンネルの描き方を切り替える（地形があるときは立体の線、ないときは地図に貼った点線） */
  function tunnelMode(c) {
    const m = c && c.map; if (!m || !c.loaded) return;
    const v = m.getTerrain() && c.tunLayer ? 'none' : 'visible';
    ['tun-case', 'tun', 'tun-done'].forEach(id => { try { m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== v && m.setLayoutProperty(id, 'visibility', v); } catch { /* noop */ } });
    trainTunnel(c);
  }
  /* トンネルの中の列車の印：半透明にし（出たら元の濃さ。CSS でなめらかに）、立体の地形のときはトンネルの線の高さ（山の中）に置く。
     印は地図の部品（Marker）で、地形の高さにしか置けないので、山の中の高さとの画面上の差を、印のずらし（offset）で足す */
  function trainTunnel(c) {
    if (!c || !c.train || c.disp == null) return;
    const inTun = !!(c.last && c.last.mode === 'running' && tunnelAt(c.disp));
    const op = inTun ? '0.5' : '1';
    if (c.trainOp !== op) { c.trainOp = op; c.train.setOpacity(op, op); c.trainEl.classList.toggle('in-tun', inTun); }
    let dx = 0, dy = 0;
    if (inTun && c.tunLayer && c.map.getTerrain()) {
      const ll = pointAt(c.disp), alt = tunAlt(L.tunnels, c.disp), e = c.map.queryTerrainElevation(ll);
      const a = alt != null && e != null && c.tunLayer.project(ll, alt * TERRAIN_X), b = a && c.tunLayer.project(ll, e);
      if (a && b) { dx = a[0] - b[0]; dy = a[1] - b[1]; }
    }
    if (Math.abs(dx - (c.tdx || 0)) > 0.3 || Math.abs(dy - (c.tdy || 0)) > 0.3) { c.tdx = dx; c.tdy = dy; c.train.setOffset([-TRAIN.w / 2 + dx, -TRAIN.oy + dy]); }
  }

  /* ---------- 通過駅の紹介（のぞみ・リレーかもめ） ----------
     この列車が止まらずに通る駅を、見どころと同じ形にして、ピン・お知らせ・一覧・紹介に出す。
     中身は路線のデータ stationInfo（読み・ひとこと・出典）。ひとことが確かめられなかった駅は、駅名・読み・府県だけ */
  const prefName = p => /[都道府県]$/.test(p) ? p : p + (p === '大阪' || p === '京都' ? '府' : p === '東京' ? '都' : '県');
  function passStations(key) {
    const S = sched(key), rows = TT_LIVE[key], info = L.stationInfo || {};
    return S.st.map((x, i) => ({ x, row: rows[i], i })).filter(({ x, i }) => !x.stop && i > 0 && i < S.st.length - 1).map(({ x, row }) => {
      const inf = info[x.name] || [];
      return { id: 'st:' + x.name, name: x.name + '駅', st: x.name, kana: inf[0] || '', pref: prefName(row[1]), genre: '駅', sum: inf[1] || '', text: inf[1] || '', src: inf[2] || null, km: x.km, off: 0, dir: '', tt: row[2], pass: true };
    });
  }
  /* 見どころ＋通過駅 */
  const spotsOf = c => (c && c.passSt ? L.spots.concat(c.passSt) : L.spots);
  /* 通過駅のお知らせ：新幹線は通過が数秒なので、2分前から出し、通ったあとも少し残す。1駅ずつ（通ったばかりの駅は15秒、次の駅が2分以内に来なければ40秒） */
  const PASS_PRE = 120e3, PASS_KEEP = 15e3, PASS_POST = 40e3;
  function passNow(r) {
    const c = cur; if (!c || r.mode !== 'running' || !c.passSt || !c.passSt.length) return null;
    const list = c.passSt.map(s => ({ s, t1: c.S.when(s.km)[0] + r.delay })).filter(x => isFinite(x.t1)).sort((a, b) => a.t1 - b.t1);
    const past = list.filter(x => x.t1 <= r.now).pop(), next = list.find(x => x.t1 > r.now);
    if (past && r.now - past.t1 <= PASS_KEEP) return past;
    if (next && next.t1 - r.now <= PASS_PRE) return next;
    if (past && r.now - past.t1 <= PASS_POST) return past;
    return null;
  }
  const srcHTML = src => (src || []).filter(x => x[1]).map(([l, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${ui.esc(l)}</a>`).join('／');

  function spotCard(s) {
    const { esc, sheet, ext } = ui, S = cur && cur.S, go = S ? S.tr.dir === 'go' : true;
    let when = '';
    if (S && cur.last) {
      const [t1] = S.when(s.km), t = t1 + cur.last.delay, m = minsTo(t, cur.last.now);
      if (isFinite(t) && cur.last.mode !== 'after') when = m > 0 ? `${ui.fmtHM(new Date(Math.round(t / MIN) * MIN))}ごろ通過（あと約${m}分）` : m > -3 ? 'いま通過中' : '通過しました';
    }
    const cat = catOf(s);
    if (s.pass) {
      sheet(esc(s.name), `<div class="lm-card"><p class="lm-card-kana">${esc(s.kana)}</p>
        <div class="tags"><span class="tag lm-gtag" style="--g:${cat.color}">${symSvg(s)}${esc(cat.name)}</span><span class="tag">${S ? esc(S.tr.name) : 'この列車'}は止まりません</span></div>
        ${s.text ? `<p class="lm-card-text">${esc(s.text)}</p>` : ''}
        <dl class="info"><div><dt>ところ</dt><dd>${esc(s.pref)}</dd></div>${when ? `<div><dt>通過</dt><dd>${when}</dd></div>` : ''}</dl>
        ${s.src ? `<p class="lm-card-src">出典：${srcHTML(s.src)}</p>` : ''}
        <div class="btns">${ext(ui.gmap(s.name + ' ' + s.pref), 'Googleマップで開く')}</div>
        <p class="note">通過の時刻は、前後の停車駅の時刻から割り出した目安です。</p></div>`);
      return;
    }
    sheet(esc(s.name), `<div class="lm-card"><p class="lm-card-kana">${esc(s.kana)}</p>
      <div class="tags"><span class="tag lm-gtag" style="--g:${cat.color}">${symSvg(s)}${esc(cat.name)}</span>${s.vis ? '<span class="tag red">窓から見える</span>' : '<span class="tag">この近くにある</span>'}</div>
      <p class="lm-card-sum">${esc(s.sum)}</p><p class="lm-card-text">${esc(s.text)}</p>
      <dl class="info"><div><dt>ところ</dt><dd>${esc(s.pref)}</dd></div><div><dt>方角と距離</dt><dd>${offTxt(s)}</dd></div>
      ${s.vis ? `<div><dt>見える窓</dt><dd>${sideTxt(s, go)}${s.vis !== 'B' ? `<br><span class="small muted">${s.vis === 'Y' ? `${S ? esc(S.tr.name) : ''}（${S ? esc(S.tr.to) : ''}へ）` : go ? '往路（東へ）' : '復路（西へ）'}の場合</span>` : ''}</dd></div>` : ''}
      ${when ? `<div><dt>通過</dt><dd>${when}</dd></div>` : ''}</dl>
      <div class="btns">${s.url ? ext(s.url, '公式サイト') : ''}${ext(ui.gmap(s.name + ' ' + s.pref.split('・')[0]), 'Googleマップで開く')}</div>
      ${s.tmp ? '<p class="note">位置は目安です。</p>' : ''}</div>`);
  }

  /* ---------- 住所の地図・境界線・地名（assets/area.json。作り方は tools/make-area.py） ----------
     市区町村の形は、隣どうしの境目を共有した線（arcs）と、形ごとに使う arc の番号で持つ（TopoJSON と同じ考え方。線は約5mの格子の差を polyline の書き方の文字にしたもの）。
     - 「住所」の地図：淡色の地図に、市区町村の薄い色分け・境界線・名前（ふりがな）を重ねる
     - 境界線（設定）：どの地図にも重ねる。府県境は太線、市区町村境は細線。隣と共有する線だけ描く（海岸は描かない）。座標から線として描くので、立体の地形の上でもくっきり
     - 地名・自然地名（設定）：画面に向かって立てた文字。placeLabels で見どころ・駅名のあとに置き、重なるものは出さない（市区町村名 → 自然地名の順）
     - 「いま ○○県○○市」：列車の位置が、どの市区町村の形に入るかで決める（電波は使わない） */
  const AREA_URL = 'assets/area.json?v=36';
  let AREA = null, areaReq = null;
  const perf = { decode: 0, place: [] };   // 重さの記録（_debug で見る）：形の組み立て（ms）・名前の配置（ms、最近20回）
  const loadArea = () => areaReq || (areaReq = fetch(AREA_URL).then(r => r.json()).then(d => { const t0 = performance.now(); AREA = decodeArea(d); perf.decode = performance.now() - t0; return AREA; }).catch(() => { areaReq = null; return null; }));
  function decodeArea(d) {
    const [sx, sy, tx, ty] = d.tf;
    const arcs = d.arcs.map(s => {
      const out = []; let i = 0, x = 0, y = 0;
      const num = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
      while (i < s.length) { x += num(); y += num(); out.push([x * sx + tx, y * sy + ty]); }
      return out;
    });
    const ring = ids => { const out = []; ids.forEach((a, k) => { const p = a < 0 ? arcs[~a].slice().reverse() : arcs[a]; out.push(...(k ? p.slice(1) : p)); }); return out; };
    const own = arcs.map(() => []);
    const geoms = d.m.map(([id, name, kana, p, col, polys], gi) => {
      polys.forEach(rs => rs.forEach(r => r.forEach(a => own[a < 0 ? ~a : a].push(gi))));
      const rings = polys.map(rs => rs.map(ring));
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
      rings.forEach(rs => rs[0].forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
      return { id, name, kana, pref: d.prefs[p], col, rings, bb: [x0, y0, x1, y1] };
    });
    /* 境界線：2つの形が共有する arc だけ（府県が違えば府県境）。1つの形だけが使う arc は海岸か、線路沿いに切り出した縁なので描かない */
    const pl = [], ml = [];
    own.forEach((o, i) => { if (o.length >= 2) (geoms[o[0]].pref !== geoms[o[1]].pref ? pl : ml).push(arcs[i]); });
    return {
      geoms, lab: d.lab, nat: d.nat,
      fill: { type: 'FeatureCollection', features: geoms.map(g => ({ type: 'Feature', properties: { c: g.col }, geometry: { type: 'MultiPolygon', coordinates: g.rings } })) },
      lines: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { t: 'p' }, geometry: { type: 'MultiLineString', coordinates: pl } }, { type: 'Feature', properties: { t: 'm' }, geometry: { type: 'MultiLineString', coordinates: ml } }] }
    };
  }
  /* 点（経度・緯度）が入る市区町村の形。どれにも入らなければ null（線路沿いの範囲の外・海の上） */
  function areaAt(lon, lat) {
    if (!AREA) return null;
    const inRing = r => { let k = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) k = !k; } return k; };
    return AREA.geoms.find(g => lon >= g.bb[0] && lon <= g.bb[2] && lat >= g.bb[1] && lat <= g.bb[3] && g.rings.some(rs => inRing(rs[0]) && !rs.slice(1).some(inRing))) || null;
  }
  /* 色分けの6色（隣どうしは別の色。淡色の地図の上で薄く塗る） */
  const AREA_COL = ['#efbe74', '#97cb7c', '#8db8e4', '#e79cba', '#bea8de', '#e3d36e'];
  const AREA_ATTR = '<a href="https://nlftp.mlit.go.jp/ksj/" target="_blank" rel="noopener">国土数値情報</a>';   // 行政区域データ（市区町村の形）
  const NAME_ATTR = '<a href="https://maps.gsi.go.jp/development/vt.html" target="_blank" rel="noopener">地理院ベクトルタイル</a>';   // 地名・山の標高
  /* 住所の地図の塗りの濃さ（0〜200。100＝初めの濃さ。0＝塗りなしで、境界線と名前だけ）。地図の種類のメニューと設定のスライダーで変え、端末に覚える */
  const FILL_MAX = 200;
  const fillK = () => { const v = +ls.get('lm-fill'); return ls.get('lm-fill') != null && isFinite(v) ? Math.max(0, Math.min(FILL_MAX, v)) : 100; };
  /* 縮尺で薄くしていく今の濃さ（淡色の上・暗い画面）に、スライダーの倍率をかける。航空写真の上は、写真に負けないよう少し濃いめから */
  const fillOp = (c, k) => {
    const f = k / 100, ph = rasterNow(c) === 'photo' ? 1.25 : 1, o = (l, d) => Math.min(0.95, (c.areaDark ? d : l) * f * ph);
    return ['interpolate', ['linear'], ['zoom'], 9, o(0.4, 0.2), 14, o(0.28, 0.14), 16, o(0.16, 0.08)];
  };
  function addAreaLayers(c) {
    const m = c.map; if (!m || !AREA || m.getSource('area')) return;
    const dark = c.areaDark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const W = (p, mm) => ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 't'], 'p', p[0], mm[0]], 11, ['match', ['get', 't'], 'p', p[1], mm[1]], 16, ['match', ['get', 't'], 'p', p[2], mm[2]]];
    try {
      m.addSource('area', { type: 'geojson', data: AREA.fill, attribution: AREA_ATTR, tolerance: 0.25 });
      m.addSource('bnd', { type: 'geojson', data: AREA.lines, attribution: AREA_ATTR, tolerance: 0.25 });
      m.addSource('plsrc', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: NAME_ATTR });   // 地名を出しているときだけ、出典に地理院ベクトルタイルを出すための空の層
      m.addLayer({ id: 'area-fill', type: 'fill', source: 'area', layout: { visibility: 'none' },
        paint: { 'fill-color': ['match', ['get', 'c'], ...AREA_COL.slice(1).flatMap((x, i) => [i + 1, x]), AREA_COL[0]], 'fill-opacity': fillOp(c, fillK()) } }, 'line-case');
      m.addLayer({ id: 'bnd-case', type: 'line', source: 'bnd', layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': dark ? '#1b1a18' : '#ffffff', 'line-opacity': dark ? 0.7 : 0.85, 'line-width': W([3.4, 5, 6.6], [2, 2.8, 4]) } }, 'line-case');
      m.addLayer({ id: 'bnd', type: 'line', source: 'bnd', layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['match', ['get', 't'], 'p', dark ? '#c39be6' : '#7a3fa8', dark ? '#a98cc4' : '#8f6db0'], 'line-width': W([1.4, 2.6, 3.6], [0.5, 1.1, 1.8]) } }, 'line-case');
      m.addLayer({ id: 'pl-attr', type: 'circle', source: 'plsrc', layout: { visibility: 'none' } });
    } catch { return; }
    syncArea(c);
  }
  /* 住所の地図・境界線・地名の出し方を、いまの地図の種類・角度・設定に合わせる */
  const isAddr = c => !!(BASES[c.tmpBase || c.base] || {}).under;
  /* 地名・自然地名は、地図の文字が寝る立体のとき・文字のない航空写真・住所の地図のときに出す（平面の標準・淡色・OSM は、地図に描かれた文字のまま） */
  const plOn = c => !!AREA && !!c.map && (isAddr(c) || rasterNow(c) === 'photo' || c.map.getPitch() >= 5);
  const showU = c => plOn(c) && (isAddr(c) || c.plU);
  const showY = c => plOn(c) && c.plY;
  function syncArea(c) {
    const m = c && c.map; if (!m || !m.getLayer('area-fill')) return;
    const set = (id, on) => { const v = on ? 'visible' : 'none'; try { m.getLayoutProperty(id, 'visibility') !== v && m.setLayoutProperty(id, 'visibility', v); } catch { /* noop */ } };
    set('area-fill', isAddr(c) && fillK() > 0);
    try { m.setPaintProperty('area-fill', 'fill-opacity', fillOp(c, fillK())); } catch { /* noop */ }
    set('bnd-case', isAddr(c) || c.bnd); set('bnd', isAddr(c) || c.bnd);
    set('pl-attr', showU(c) || showY(c));
    layoutLabels();
  }
  /* 塗りの濃さのスライダー（地図の種類のメニューと設定の2か所。値は描いたあとで入れる：設定は描き直しのたびに中身を比べるので、値を中に書くと動かしている途中で描き直されるため） */
  const fillCtl = (h = '住所の地図の塗りの濃さ') => `<div class="lm-fill"><p class="lm-fill-h"><span>${h}</span><output aria-hidden="true"></output></p><div class="lm-fill-r"><span>薄い</span><input type="range" min="0" max="${FILL_MAX}" step="10" data-lm="fill" aria-label="住所の地図の塗りの濃さ"><span>濃い</span></div></div>`;
  const fillTxt = k => (k === 0 ? '塗りなし' : k === 100 ? 'ふつう' : Math.round(k) + '%');
  function syncFillCtl(root, skip) {
    const k = fillK();
    $$('[data-lm="fill"]', root).forEach(x => {
      if (x !== skip && +x.value !== k) x.value = k;
      x.style.setProperty('--v', (k / FILL_MAX * 100) + '%'); x.setAttribute('aria-valuetext', fillTxt(k));
      const o = x.closest('.lm-fill') && $('output', x.closest('.lm-fill')); o && (o.textContent = fillTxt(k));
    });
  }
  function setFill(c, k, from) {
    ls.set('lm-fill', k === 100 ? null : String(k));
    syncArea(c);
    [c.root, c.setEl].forEach(r => r && syncFillCtl(r, from));
  }
  /* 地図の上の1行「いま ○○県 ○○市」：列車の位置（推定・GPS とも線路の上の km）から。形のどれにも入らないときは出さない */
  function drawWhere(r) {
    const c = cur, el = c && c.whereEl; if (!el) return;
    let html = '';
    if (r) {
      const p = pointAt(r.km), g = areaAt(p[0], p[1]);
      if (g) html = `<span class="lm-addr-k">いま</span><small>${g.pref}</small><b>${g.name}</b>`;
      else if (muniAt(r.km) === '関門海峡の海底') html = '<span class="lm-addr-k">いま</span><b>関門海峡の海底</b>';
    }
    c.whereOn = !!html;
    if (el.dataset.v !== html) { el.dataset.v = html; el.innerHTML = html; el.hidden = !html; c.wrap && c.wrap.classList.toggle('lm-has-addr', !!html); layoutLabels(); }
  }
  /* 地名・自然地名の文字（初めて出すときに作る。ふだんは地図から外しておき、出すものだけ地図に載せる） */
  const PL_Z = { u: [5, 8.8, 10.3], ua: [5, 8.2, 9.6], y: [7.4, 9.8, 11.3] };   // 種類ごとの、順位（0〜2）を出し始める縮尺。ua は住所の地図
  const plMax = (k, z) => k === 'u' ? (z < 9 ? 6 : z < 11 ? 10 : 14) : (z < 9 ? 4 : z < 11 ? 7 : 10);
  function plItems(c) {
    if (c.pl || !AREA) return c.pl;
    const { esc } = ui;
    /* 市区町村名：置き場所の候補は、地理院の注記の位置（先頭）と、形の中に数kmおきの点。見えている候補から1つだけ出す */
    const u = AREA.lab.map(([lon, lat, name, kana, rank, more]) => ({ k: 'u', pts: [[lon, lat]].concat(more || []), rank, name, html: `<ruby>${esc(name)}<rt>${esc(kana)}</rt></ruby>`, cls: 'lm-pl r' + rank, side: ['c'] }));
    const y = AREA.nat.map(([lon, lat, kind, name, kana, alt, rank]) => {
      const mt = kind === 'm', fmt = a => a >= 1000 ? `${Math.floor(a / 1000)},${String(a % 1000).padStart(3, '0')}` : String(a);
      return { k: 'y', pts: [[lon, lat]], rank, name, alt, kind,
        html: mt ? `<i aria-hidden="true">▲</i><span>${esc(name)}<small>${fmt(alt)}m</small></span>` : esc(name),
        cls: 'lm-nt k-' + kind, side: mt ? ['m'] : kind === 'w' ? ['r', 'l'] : ['c'] };   // 山は▲を山頂に。川は線路と交わる所の右か左
    });
    return (c.pl = u.concat(y));
  }
  /* 寸法は、初めて出すときに一度だけ測る（地図の外の見えない箱で） */
  function plSize(c, p) {
    if (p.w) return;
    let box = c.plMeasure;
    if (!box || !box.isConnected) { box = c.plMeasure = document.createElement('div'); box.className = 'lm-plm'; box.setAttribute('aria-hidden', 'true'); c.wrap.appendChild(box); }
    const el = p.el || (p.el = Object.assign(document.createElement('div'), { className: p.cls, innerHTML: p.html }));
    box.appendChild(el); p.w = el.offsetWidth || 40; p.h = el.offsetHeight || 16; el.remove();
  }
  function placePlaces(c, map, W, H, hit, blocked0, tb) {
    let blocked = blocked0;
    const items = plItems(c); if (!items) return;
    const z = map.getZoom(), addr = isAddr(c), su = showU(c), sy = showY(c);
    const ref = tb ? [(tb.l + tb.r) / 2, (tb.t + tb.b) / 2] : [W / 2, H / 2];
    const inside = q => q.l >= 2 && q.r <= W - 2 && q.t >= 2 && q.b <= H - 2;
    /* 置き方ごとの、点から文字の真ん中までのずれ：c＝点の上に真ん中、m＝▲（幅10px）の真ん中を点に、r／l＝点の右／左に12px空けて */
    const offOf = (p, sd) => sd === 'm' ? [p.w / 2 - 5, 0] : sd === 'r' ? [12 + p.w / 2, 0] : sd === 'l' ? [-12 - p.w / 2, 0] : [0, 0];
    const rectAt = (p, x, y, o) => ({ l: x + o[0] - p.w / 2, t: y + o[1] - p.h / 2, r: x + o[0] + p.w / 2, b: y + o[1] + p.h / 2 });
    const want = new Map();
    /* 線路（列車の前後40km。列車によって km の増える向きが逆なので両側）も、地名で隠さない */
    if ((su || sy) && c.disp != null) {
      blocked = blocked0.slice();
      for (let k = c.disp - 40; k <= c.disp + 40; k += 0.4) {
        const q = map.project(pointAt(k));
        if (q.x > -10 && q.x < W + 10 && q.y > -10 && q.y < H + 10) blocked.push({ l: q.x - 4, t: q.y - 4, r: q.x + 4, b: q.y + 4 });
      }
    }
    [['u', su], ['y', sy]].forEach(([k, on]) => {
      if (!on) return;
      const zs = PL_Z[k === 'u' && addr ? 'ua' : k];
      const cand = [];
      items.forEach(p => {
        if (p.k !== k || z < zs[p.rank]) return;
        /* 画面に入っている置き場所（地理院の注記の位置を先に、ほかは列車に近い順） */
        const vis = [];
        p.pts.forEach((pt, i) => {
          const q = map.project(pt);
          if (q.x < -40 || q.x > W + 40 || q.y < -20 || q.y > H + 20) return;
          vis.push({ pt, x: q.x, y: q.y, d: i === 0 ? -1 : Math.hypot(q.x - ref[0], q.y - ref[1]) });
        });
        if (!vis.length) return;
        vis.sort((a, b) => a.d - b.d);
        /* いま出している置き場所がまだ使えるなら、そこを先に試す（列車が進むたびに名前が跳ばないように） */
        const cu = p.onMap ? vis.findIndex(v => v.pt === p.at) : -1;
        if (cu > 0) vis.unshift(vis.splice(cu, 1)[0]);
        p.vis = vis.slice(0, 5); p.dr = Math.hypot(vis[0].x - ref[0], vis[0].y - ref[1]);
        cand.push(p);
      });
      /* 順位の高いもの → 列車（画面の中心）に近いものから */
      cand.sort((a, b) => a.rank - b.rank || a.dr - b.dr);
      let n = 0;
      const max = plMax(k, z);
      for (const p of cand) {
        if (n >= max) break;
        plSize(c, p);
        let ok = false;
        for (const v of p.vis) {
          for (const sd of p.side) {
            const o = offOf(p, sd), q = rectAt(p, v.x, v.y, o), m = { l: q.l - 6, t: q.t - 3, r: q.r + 6, b: q.b + 3 };   // 見どころの名前などと、少し間をあける
            if (!inside(q) || blocked.some(r => hit(r, m))) continue;
            blocked.push(q); want.set(p, [v.pt, o]); n++; ok = true;
            break;
          }
          if (ok) break;
        }
      }
    });
    items.forEach(p => {
      const [pt, o] = want.get(p) || [];
      if (pt && !p.mk) {
        if (!p.el) p.el = Object.assign(document.createElement('div'), { className: p.cls, innerHTML: p.html });
        p.mk = new c.ml.Marker({ element: p.el, anchor: 'center', offset: o, pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat(pt);
        p.at = pt; p.o = o;
      }
      if (pt && p.at !== pt) { p.mk.setLngLat(pt); p.at = pt; }
      if (pt && (p.o[0] !== o[0] || p.o[1] !== o[1])) { p.mk.setOffset(o); p.o = o; }
      if (pt && !p.onMap) { p.mk.addTo(map); p.onMap = true; }
      else if (!pt && p.onMap) { p.mk.remove(); p.onMap = false; }
    });
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
    fitTools();
    if (save) { ls.set('lm-tools', open ? '1' : null); layoutLabels(); }
  }
  /* 操作ボタン群の段数：右下の縮尺の札（なければ地図の下の端）より上に収まるだけ縦に並べ、残りは左へもう1列。
     地図の高さ・全画面の下の札の高さ・横向きで変わるので、大きさが変わるたびに計算し直す */
  function fitTools() {
    const c = cur; if (!c || !c.wrap) return;
    const box = $('.lm-tools', c.root); if (!box) return;
    const items = $$('.lm-tool', box).filter(x => x.offsetParent);
    const H = c.wrap.clientHeight; if (!items.length || !H) return;
    const bh = items[0].offsetHeight, gap = parseFloat(getComputedStyle(box).rowGap) || 6;
    const zm = $('.lm-zoom', c.wrap);
    const floor = zm && !zm.hidden && zm.offsetHeight ? zm.offsetTop - 8 : H - 26;
    const rows = Math.max(1, Math.min(items.length, Math.floor((floor - box.offsetTop + gap) / (bh + gap))));
    if (box.style.getPropertyValue('--tl-rows') !== String(rows)) box.style.setProperty('--tl-rows', rows);
    c.root.style.setProperty('--tl-w', box.offsetWidth + 'px');
  }
  const TOOLS_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M4.5 12h15M4.5 17h15"/></svg>';
  const TOOLS_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function mount(key, helpers) {
    unmount();
    const root = $('#lm'); if (!root) return;
    ui = helpers;
    useLine(lineOf(key));   // この列車の路線に入れ替える（線路の形・駅・見どころ・トリビア）
    const S = sched(key), tk = Tracker(key);
    const legacyPitch = ls.get('lm-view') === 'flat' ? 0 : PITCH_3D;
    const c = cur = {
      key, S, tk, root, wrap: $('.lm-mapwrap', root), full: !!helpers.full, act: !!helpers.full, map: null, ml: null, follow: true, last: null, gpsWant: false, unGeo: null, timer: null, unClock: null,
      alarms: {}, wake: null, wakeWant: ss.get('lm-wake') === '1', disp: null, tgt: null, anim: null, bgTimers: [],
      pitch: Math.max(0, Math.min(70, +(ls.get('lm-pitch') ?? legacyPitch) || 0)),
      orient: ls.get('lm-orient') === 'north' ? 'north' : 'head', free: false,
      base: BASES[ls.get('lm-base')] ? ls.get('lm-base') : 'pale', tmpBase: null,
      eco: ls.get('lm-eco') === '1', docVisible: document.visibilityState !== 'hidden', mapVisible: true, pins: [], camAt: 0, nearCur: null, nearSeen: new Set(),
      /* 縮尺：zAuto＝自動ズーム（停車駅の近くで寄る。初めはオン。端末に覚える）／zOff＝手で決めた走行中の縮尺（標準からの差。端末に覚える）／
         zHold＝駅の近く・到着モードで手で止めた縮尺（その駅のあいだだけ）／zd＝前後の停車駅までの距離／arr＝到着モード */
      zAuto: ls.get('lm-autozoom') !== '0', zOff: (z => (z && isFinite(+z) ? +z : null))(ls.get('lm-zoff2')), zHold: null, zd: null, zone: null, arr: false,
      /* 境界線（初めはオフ）・地名（市区町村。初めはオン）・自然地名（山・川・海。初めはオン）。どれも端末に覚える */
      bnd: ls.get('lm-bnd') === '1', plU: ls.get('lm-plu') !== '0', plY: ls.get('lm-ply') !== '0', pl: null, whereEl: null, whereOn: false
    };
    if (c.eco) { c.pitch = 0; c.wakeWant = false; if (rasterOf(c.base) === 'photo') c.base = c.base === 'addrp' ? 'addr' : 'pale'; }
    c.passSt = passStations(key);   // この列車の通過駅（紹介・ピン・お知らせ・一覧）
    /* 地図の左上の「いま ○○県 ○○市」 */
    if (c.wrap) { c.whereEl = $('.lm-addr', c.wrap) || c.wrap.appendChild(Object.assign(document.createElement('p'), { className: 'lm-addr', hidden: true })); c.whereEl.dataset.v = ''; }
    loadArea().then(() => { if (cur === c) { c.last && drawWhere(c.last); c.last && drawPanel(c.last); } });
    setTools(ls.get('lm-tools') === '1', false);

    /* --- GPS（本物はボタンを押したときだけ。画面を離れた・地図が画面外のあいだは止める） --- */
    const active = () => c.docVisible && (c.full || c.mapVisible);
    const syncGeo = () => {
      const want = c.gpsWant && active();
      Geo.pace(c.eco && !simTrack() ? ECO_GPS : 0);
      if (want && !c.unGeo) {
        c.unGeo = Geo.watch(p => { if (c.gpsErr && p) { c.gpsErr = null; drawCtrl(); } tk.onFix(p); if (!simTrack()) tick(); }, err => {
          if (err && err.code === 3 && tk.fix) return;   // 一時的に取れないだけ（トンネルなど）
          c.gpsErr = err && err.code === 1 ? 'denied' : err && err.code === 2 ? 'off' : 'err';
          if (err && err.code === 1) { c.gpsWant = false; c.gpsAuto = false; ss.set('lm-gps', null); syncGeo(); }
          drawCtrl(); tick();
        });
      } else if (!want && c.unGeo) { c.unGeo(); c.unGeo = null; }
    };
    c.syncGeo = syncGeo; c.active = active;
    /* 乗車の時間帯は、位置の許可が済んでいれば、ボタンを押さなくてもGPSを使う（時間帯が終わったら止める）。
       手で「GPSを止める」を押した人は、このタブのあいだは入れ直さない。おためし中は本物のGPSを使わない */
    const autoGeo = () => {
      if (cur !== c || Clock.active()) return;
      const on = S.ride(+Clock.now());
      if (on && !c.gpsWant && GeoPerm.state() === 'granted' && ss.get('lm-gps-off') !== '1') { c.gpsWant = true; c.gpsAuto = true; c.gpsErr = null; syncGeo(); drawCtrl(); }
      else if (!on && c.gpsWant && c.gpsAuto) { c.gpsWant = false; c.gpsAuto = false; syncGeo(); drawCtrl(); }
    };
    c.autoGeo = autoGeo;
    c.offPerm = GeoPerm.on(() => { autoGeo(); drawCtrl(); });

    /* --- 操作 --- */
    const onClick = e => {
      const sp = e.target.closest('[data-spot]');
      if (sp) { const s = spotsOf(c).find(x => x.id === sp.dataset.spot); s && spotCard(s); return; }
      const tv = e.target.closest('[data-tvid]');
      if (tv) { const open = cur && cur.tvCard && cur.tvCard.isConnected; open ? tvClose() : tvCard(tv.dataset.tvid); return; }
      const bb = e.target.closest('[data-base]');
      if (bb) { setBase(bb.dataset.base, true); toggleMenu(false); return; }
      if (e.target.closest('.lm-basemenu')) return;   // メニューの中のスイッチ（境界線）を押しても、メニューは閉じない
      if (e.target.closest('[data-arr]')) { arriveSheet(); return; }
      const b = e.target.closest('[data-lm]'); if (!b) { toggleMenu(false); return; }
      const k = b.dataset.lm;
      if (k !== 'base') toggleMenu(false);
      if (k === 'gps') {
        if (c.gpsWant) { c.gpsWant = false; c.gpsAuto = false; ss.set('lm-gps', null); ss.set('lm-gps-off', '1'); }
        else { c.gpsErr = null; c.gpsWant = true; ss.set('lm-gps', '1'); ss.set('lm-gps-off', null); }
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
      if (k === 'recenter') { if (b.getAttribute('aria-disabled') === 'true') ui.toast('いまは地図が列車を追いかけています。指で地図を動かすと押せます'); else recenter(); }
      if (k === 'zoom') toggleZoom(b);
      if (k === 'zreset') resetZoom();
      if (k === 'settings') openSettings();
      if (k === 'endop') setActive(false);
      if (k === 'compass') compass();
      if (k === 'tools') setTools(b.getAttribute('aria-expanded') !== 'true', true);
      if (k === 'base') toggleMenu();
      if (k === 'legend') { const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', open); const u = b.nextElementSibling; u && (u.hidden = !open); ls.set('lm-legend', open ? '1' : null); }
      if (k === 'help') helpChoice();
      if ((k === 'geohelp' || k === 'geooff') && ui.geoHelp) ui.geoHelp(k === 'geooff' ? 'off' : 'denied');
    };
    const onChange = e => {
      if (e.target.matches('[data-lm="wake"]')) { c.wakeWant = e.target.checked; ss.set('lm-wake', c.wakeWant ? '1' : null); wake(); }
      if (e.target.matches('[data-lm="eco"]')) { setEco(e.target.checked); ss.set('lm-eco-manual', e.target.checked ? 'on' : 'off'); }
      if (e.target.matches('[data-lm="autozoom"]')) setAutoZoom(e.target.checked);
      /* 境界線・地名・自然地名（地図の種類のメニューと設定の、どちらのスイッチでも） */
      const pk = e.target.matches('[data-lm="bnd"], [data-lm="plu"], [data-lm="ply"]') && e.target.dataset.lm;
      if (pk) {
        const on = e.target.checked, prop = { bnd: 'bnd', plu: 'plU', ply: 'plY' }[pk];
        c[prop] = on; ls.set('lm-' + pk, pk === 'bnd' ? (on ? '1' : null) : (on ? null : '0'));
        $$(`[data-lm="${pk}"]`).forEach(x => { x.checked = on; });
        syncArea(c); drawCtrl();
      }
    };
    /* 塗りの濃さ：動かしている間も、その場で地図に出す */
    const onInput = e => { if (e.target.matches('[data-lm="fill"]')) setFill(c, Math.max(0, Math.min(FILL_MAX, +e.target.value || 0)), e.target); };
    root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput);
    c.onClick = onClick; c.onChange = onChange; c.onInput = onInput;
    const list = $('#lm-list'); list && list.addEventListener('click', onClick);
    c.off = () => { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('input', onInput); list && list.removeEventListener('click', onClick); };

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
      autoGeo();
      const r = tk.compute(); c.last = r;
      drawWhere(r); drawPanel(r); drawSpeed(r); drawNotice(r); drawAlarm(r); drawList(r); drawPins(r); zoomTick(r); mapTick(r); drawTools();
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
    syncGeo(); autoGeo();
    fillStatic(); fitHeight();
    drawCtrl(); tick(); startLoop(); wake();
    c.onResize = () => { fitHeight(); syncPad(); fitTools(); };
    addEventListener('resize', c.onResize);
    /* 自動スクロールは、ページを開いた最初の1回だけ（自分でスクロールしたあとは動かさない） */
    if (helpers.fresh && !c.full) setTimeout(() => {
      if (cur !== c || scrollY > 40) return;
      const r = $('.lm-panel', root) || root, b = r.getBoundingClientRect().bottom, navH = ($('#nav') || {}).offsetHeight || 0;
      if (b > innerHeight - navH) root.scrollIntoView({ block: 'start' });
    }, 250);
    ln.ready.then(() => { if (cur === c) tick(); });
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
    c.io && c.io.disconnect(); c.ro && c.ro.disconnect(); c.roAt && c.roAt.disconnect(); c.offBat && c.offBat(); c.offPerm && c.offPerm(); cancelAnimationFrame(c.spdAnim);
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
    fitTools();
  }

  /* 凡例と地図の種類のメニュー（中身はここで作る） */
  function fillStatic() {
    const c = cur, { esc } = ui;
    const lg = $('.lm-legend', c.root);
    if (lg) {
      const open = ls.get('lm-legend') === '1';
      lg.innerHTML = `<button type="button" data-lm="legend" aria-expanded="${open}">凡例</button><ul${open ? '' : ' hidden'}>${Object.values(CATS).map(k => `<li><i style="--g:${k.color}"><svg class="lm-sym" viewBox="0 0 12 12" aria-hidden="true">${k.sym}</svg></i>${esc(k.name)}</li>`).join('')}<li><i class="vis" style="--g:#67625b"></i>白い縁＝窓から見える</li><li><i class="tun" aria-hidden="true"></i>トンネル（点線）</li><li><i class="bnd" aria-hidden="true"></i>境界（太い線＝府県）</li><li><i class="mt" aria-hidden="true">▲</i>山・<span class="lm-lg-w">川・海</span>の名前</li></ul>`;
    }
    const mn = $('.lm-basemenu', c.root);
    if (mn) mn.innerHTML = `<p class="lm-menu-h">地図の種類</p>${Object.entries(BASES).map(([id, b]) => `<button type="button" data-base="${id}">${esc(b.name)}</button>`).join('')}<label class="lm-sw lm-menu-sw"><input type="checkbox" role="switch" data-lm="bnd"${c.bnd ? ' checked' : ''}><span>境界線を重ねる</span></label>${fillCtl('住所の塗りの濃さ')}<p class="lm-menu-n">「住所」は市区町村を色分けし、境界線と名前を出します（塗りは上のつまみで薄く・濃く。いちばん左で塗りなし）。立体の地形（山の盛り上がり）は、航空写真のときだけです。航空写真は通信量が多めで、電波が弱いときは標準地図に戻します。</p>`;
    mn && syncFillCtl(mn);
  }
  function toggleMenu(open) {
    const c = cur; if (!c) return;
    const mn = $('.lm-basemenu', c.root), b = $('[data-lm="base"]', c.root); if (!mn) return;
    const v = open ?? mn.hidden;
    mn.hidden = !v; b && b.setAttribute('aria-expanded', v);
    if (v) $$('[data-base]', mn).forEach(x => { x.setAttribute('aria-pressed', x.dataset.base === (c.tmpBase || c.base)); x.disabled = c.eco && rasterOf(x.dataset.base) === 'photo'; });
    /* 住所の地図を見ているときは、塗りの濃さのつまみが見えるところまで送る（縦長の画面では、地図が低くてメニューが収まらないため） */
    if (v) { mn.scrollTop = 0; const f = $('.lm-fill', mn); if (f && isAddr(c)) mn.scrollTop = Math.max(0, f.offsetTop + f.offsetHeight + 6 - mn.clientHeight); }
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
      /* 遅れて、定刻を過ぎても駅にいるとき：遅れの分数は横の札に出す */
      where = late2 && m <= 0 ? `定刻${at(S.first.dep)}発・遅れて発車を待っています` : m < 24 * 60 ? `${at(S.first.dep)}発・あと${m >= 60 ? Math.floor(m / 60) + '時間' : ''}${m % 60}分` : `${S.tr.date.slice(5).replace('-', '/').replace(/^0/, '')} ${at(S.first.dep)}に発車します`;
    } else if (r.mode === 'after') {
      head = `<b>${S.last.name}</b>に到着しました`;
    } else {
      if (next) {
        const eta = next.arr + r.delay, m = minsTo(eta, r.now), d = Math.abs(next.km - r.km);
        head = `<span class="lm-k">つぎは</span><b>${next.name}</b><span class="lm-eta num">${m >= 1 ? `あと約<em>${m}</em>分` : 'まもなく'}・${at(eta)}着${late2 ? 'ごろ' : ''}<small>（${kmTxt(d)}km）</small></span>`;
      }
      if (r.mode === 'stopped') { const st = S.st[r.i]; where = `${st.name}駅に停車中・${at(st.dep + r.delay)}発${late2 ? 'ごろ' : ''}`; }
      else if (!c.whereOn || c.root.classList.contains('lm-nomap')) where = whereHTML(muniAt(r.km));   // ふだんは地図の左上の「いま ○○」に出すので、ここには出さない（地図がない・形の外のときだけ）
    }
    const late = late2 ? `<span class="lm-late">約${Math.round(r.delay / MIN)}分遅れ</span>` : '';
    const badge = `<span class="lm-badge ${r.src}">${r.src === 'gps' ? (simTrack() ? 'GPS（おためし）' : 'GPS') : '時刻表から推定'}</span>`;
    /* 遅れを反映していない（時刻表どおりの）ときは、そう分かる一言を小さく */
    const tt = !r.gpsDelay && r.mode !== 'after' && !gn
      ? `<p class="lm-ttnote">${Clock.active() && !simTrack() ? 'おためし中は、時刻表どおりの位置です。' : c.full ? '時刻表どおりの位置です（遅れは反映していません）。' : c.gpsWant ? '時刻表どおりの位置です。GPSの位置が届くと、遅れに合わせます。' : '時刻表どおりの位置です。「現在地を使う」を押すと、GPSで遅れに合わせます。'}</p>` : '';
    /* 走行中・停車中は「いまどこか（現在）→ 次はどこか」の順。発車前と到着後は、今までどおり見出しが先 */
    const moving = r.mode === 'running' || r.mode === 'stopped';
    const row = `<div class="lm-row${moving ? ' lm-now' : ''}">${moving && where ? '<span class="lm-now-k">現在</span>' : ''}${where ? `<span class="lm-where">${where}</span>` : ''}${late}${badge}${tun && !moving ? '<span class="lm-badge tun">トンネル内</span>' : ''}</div>`;   // 走行中のトンネルは、すぐ下のお知らせ（出口まで約○分）で分かるので札は出さない
    const hd = head ? `<div class="lm-head">${head}</div>` : '';
    const html = `${moving ? row + hd : hd + row}${gn ? `<p class="lm-gpsnote">${gn}</p>` : ''}${tt}`;
    if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
  }

  /* ---------- 時速（大きな数字と、画面の幅いっぱいの速度バー） ----------
     数字はなめらかに数え上がる・数え下がる。バーは路線の最高速度（新幹線300km・在来線130km）で満杯（左が緑、右へ行くほど赤）。
     「視差効果を減らす」がオンのときは、動かさずに値だけ変える。点滅はしない */
  const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
  function drawSpeed(r) {
    const el = $('#lm-spd'); if (!el) return;
    const c = cur, show = r.mode === 'running' || r.mode === 'stopped', V_FULL = L.vmax || 300;
    if (el.hidden === show) { el.hidden = !show; if (c.full) syncPad(); }
    if (!show) return;
    /* 最高速度（山陽新幹線は300km/h、リレーかもめの787系は130km/h。路線のデータ vmax）。時刻表からの推定（通過駅の時刻が推定のため）やGPSの揺れで超えて見えるので、表示はそこまでに抑える */
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
    const H = box.clientHeight, W = box.clientWidth, br = box.getBoundingClientRect(), or = ov.getBoundingClientRect(), ovTop = or.top - br.top;
    /* 横向きで札を左に並べているとき（style.css の @media）は、札の右側を地図の見える範囲にする */
    const side = or.width < W * 0.8;
    c.root.style.setProperty('--ov-h', side ? '0px' : Math.max(0, H - ovTop) + 'px');
    c.root.style.setProperty('--ov-w', side ? Math.round(or.right - br.left) + 'px' : '0px');
    fitTools();
    const bottom = side ? 0 : Math.max(0, Math.round(H - ovTop + 12));
    const y = side ? H * 0.68 : Math.min(ovTop - 76, H * 0.74);          // 列車の印を置く高さ（札の上端から少し余裕をとる）
    const top = Math.max(0, Math.round(2 * y - (H - bottom)));
    const pad = { top, bottom, left: side ? Math.round(or.right - br.left) : 0, right: 0 }, was = c.pad;
    if (was && was.top === pad.top && was.bottom === pad.bottom && was.left === pad.left) return;
    c.pad = pad;
    /* 札が増えて下の欄が高くなったときは、すぐに地図をずらす（ゆっくり動かすと、そのあいだ列車の印が札の下に隠れる） */
    if (!was || pad.bottom > was.bottom) { camEase(c, null, pad); if (!was) return; }
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
  const TVL = {};
  const tvList = () => TVL[ln.id] || (TVL[ln.id] = (L.trivia || []).map(([cat, k, a, b]) => {
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
        const head = s.vis === 'B' ? `${now ? 'いま' : 'まもなく'}${esc(s.name)}を${s.genre === '川' ? '渡ります' : '通ります'}` : `${now ? 'いま' : 'まもなく'}${esc(s.name)}`;   // 両側：川は「渡ります」、土塁などは「通ります」
        out.push(`<button class="lm-alert" data-spot="${s.id}"><span class="lm-alert-h">${head}${!now && m >= 1 ? `<small class="num">（約${m}分後）</small>` : ''}</span><span class="lm-alert-s">${sideTxt(s, go)}</span><span class="lm-alert-d">${esc(s.sum)}<i>くわしく →</i></span></button>`);
      }
      if (tun) {
        const exitKm = S.dir > 0 ? tun[1] : tun[0], [te] = tAt(exitKm), m = minsTo(te, r.now);
        out.push(`<div class="lm-tunnel"><b>${esc(tun[2] || 'トンネル')}内</b>（${m >= 1 ? `出口まで約${m}分` : 'まもなく出口'}）${c.unGeo ? '・GPSは一時的に届きません' : ''}</div>`);
      }
      /* 通過駅：「まもなく○○駅を通過」（2分前から。通ったあと少し残す） */
      const pas = passNow(r);
      if (pas) {
        const { s, t1 } = pas, sec = (t1 - r.now) / 1000, m = minsTo(t1, r.now);
        const k = sec > 20 ? 'soon' : sec > -10 ? 'now' : 'done';
        const sm = k === 'soon' ? `まもなく${m >= 1 ? `<span class="num">（約${m}分後）</span>` : ''}` : k === 'now' ? 'いま' : '';
        out.push(`<button class="lm-near lm-pass" data-spot="${s.id}" style="--g:${CATS.stn.color}"><span class="lm-dot" aria-hidden="true">${symSvg(s)}</span><span>${sm ? `<small>${sm}</small>` : ''}<b>${esc(s.name)}を${k === 'done' ? '通過しました' : '通過'}</b><span class="lm-near-s">${s.kana ? `${esc(s.kana)}・` : ''}${esc(s.pref)}</span>${s.text ? `<span class="lm-pass-d">${esc(s.text)}</span>` : ''}</span></button>`);
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
  const JR_INFO_DEF = [['山陽新幹線（JR西日本）', 'https://trafficinfo.westjr.co.jp/sanyo.html'], ['九州の列車（JR九州）', 'https://www.jrkyushu.co.jp/trains/info/']];
  const jrInfo = () => `<p class="lm-jrinfo"><span>JR公式の運行情報</span>${(L.info || JR_INFO_DEF).map(([t, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}</p>`;
  function drawCtrl() {
    const c = cur; if (!c) return;
    const el = $('#lm-ctrl');
    if (el) {
      const gps = simTrack() ? '<span class="lm-simnote">おためし中は、作り物のGPSで動きます</span>'
        : Clock.active() ? '<span class="lm-simnote">おためし中は本物のGPSを使いません（時刻表から推定）</span>'
        : `<button class="btn ${c.gpsWant ? 'fill' : 'quiet'}" data-lm="gps" aria-pressed="${c.gpsWant}">${c.gpsWant ? 'GPSを止める' : '現在地を使う'}</button>`;
      const auto = !Clock.active() && c.gpsWant && c.gpsAuto
        ? `<p class="lm-autonote">乗車の時間帯なので、GPSを自動で使って遅れに合わせています${c.eco ? '（省電力中は1分に1回）' : ''}。到着の2時間後に自動で止まります。</p>` : '';
      const html = `<button type="button" class="lm-sum" data-lm="settings" aria-haspopup="dialog" aria-label="お知らせと画面の設定を開く">
          <span class="lm-sum-i${alarm.on ? ' on' : ''}">お知らせ <b>${alarm.on ? 'ON' : 'OFF'}</b></span>
          ${hasWake() ? `<span class="lm-sum-i">画面 <b>${c.wakeWant ? '消さない' : '自動で消える'}</b></span>` : ''}
          <span class="lm-sum-i">省電力 <b>${c.eco ? 'ON' : 'OFF'}</b></span>
          <span class="lm-sum-go">設定</span></button>
        ${auto}<div class="lm-ctrl-row">${gps}<a class="btn quiet ext" data-lm-gm href="https://www.google.com/maps" target="_blank" rel="noopener">Googleマップで開く（現在地）</a></div>
        ${jrInfo()}
        ${c.gpsErr === 'denied' ? '<p class="lm-msg">位置情報が許可されませんでした。時刻表からの推定で表示します。<button type="button" class="lm-msgbtn" data-lm="geohelp">許可し直す方法</button></p>'
          : c.gpsErr === 'off' ? '<p class="lm-msg">位置が取れません。端末の位置情報がオフかもしれません。取れるまでは、最後に測った遅れと時刻表から推定します。<button type="button" class="lm-msgbtn" data-lm="geooff">位置情報をオンにする方法</button></p>'
          : c.gpsErr ? '<p class="lm-msg">位置がまだ取れません。取れるまでは、最後に測った遅れと時刻表から推定します。</p>' : ''}`;
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
        <label class="lm-sw"><input type="checkbox" role="switch" data-lm="autozoom"${c.zAuto ? ' checked' : ''}><span>自動ズーム（停車駅の近くで、地図を自動で拡大）</span></label>
        <p class="lm-desc">停車駅に近づくと、着く前から少しずつ拡大し、駅前の建物や道が分かるくらいまで寄ります。駅を出ると、走っているときの縮尺へ少しずつ戻ります。通過駅では寄りません。オフにすると、縮尺を自動では変えません。地図の右下の「自動ズーム：オン／オフ」でも切り替えられます。</p>
        <p class="lm-desc">指で拡大・縮小しても、自動ズームは止まりません。走っているときに変えた縮尺は「走行中の縮尺」として覚え、駅で寄ったあとはその縮尺に戻ります（停車駅の近くで変えたときは、その駅を離れるまでの間だけ）。右下の「元の縮尺に戻す」で、最初の縮尺に戻ります。</p>
        <p class="lm-desc">到着モード：終点（${ui.esc(c.S.tr.end || dest)}）が地図に10秒ほど続けて映ったら、終点を画面の上の方にして、そのときの縮尺のまま始め、近づくにつれて拡大します（途中で縮小はしません）。見下ろす角度は変えません（立体なら斜めのまま、平面なら真上から）。この設定にかかわらず働き、着いて止まると元の表示に戻ります。</p>
        <p class="lm-set-h">地図に重ねるもの</p>
        <label class="lm-sw"><input type="checkbox" role="switch" data-lm="bnd"${c.bnd ? ' checked' : ''}><span>境界線（府県・市区町村）</span></label>
        <p class="lm-desc">どの地図の種類にも、府県の境を太い線、市区町村の境を細い線で重ねます（地図の種類のメニューでも切り替えられます）。地図の種類を「住所（市区町村）」「住所（航空写真）」にすると、この設定にかかわらず、市区町村を色分けして、境界線と名前（ふりがな付き）を出します。</p>
        ${fillCtl()}
        <p class="lm-desc">住所の地図の色分けの濃さです。いちばん左にすると塗りなし（境界線と名前だけ）になります。地図の種類のメニューのつまみと同じ値で、この端末に覚えます。</p>
        <label class="lm-sw"><input type="checkbox" role="switch" data-lm="plu"${c.plU ? ' checked' : ''}><span>地名（市区町村の名前）</span></label>
        <label class="lm-sw"><input type="checkbox" role="switch" data-lm="ply"${c.plY ? ' checked' : ''}><span>自然地名（山・川・海など）</span></label>
        <p class="lm-desc">立体のとき・航空写真・住所の地図で、名前を画面に向けて立てて出します（平面の標準・淡色・OpenStreetMap は、地図に描かれた文字のままです）。山は▲と標高、川は線路が渡る所、海・湾・灘は青い文字です。縮尺に合わせて数を絞り、見どころ・駅名と重なるときは、市区町村名、自然地名の順に省きます。名前・位置・標高は、国土地理院の地図のデータで確かめたものです。</p>
        <p class="lm-desc lm-desc-sep">立体の地形：地図の種類が航空写真で、立体にしたときだけ、山を盛り上げて描きます（トンネルは山の中に点線）。標準・淡色・OpenStreetMap は文字が読みやすいよう、立体でも平らです（トンネルは地図の上の点線）。</p>
        <label class="lm-sw"><input type="checkbox" role="switch" data-lm="eco"${c.eco ? ' checked' : ''}><span>省電力</span></label>
        <p class="lm-desc">地図の更新を10秒に1回にし、平面・淡色の地図にします。航空写真と「画面を自動で消さない」は使いません。GPSは、遅れを測るのに足りる1分に1回だけ使います。${c.hasBattery ? '電池が20%以下になると、自動でオンになります。' : ''}</p>
        ${c.full ? jrInfo() : ''}`;
      if (c.setEl.dataset.v !== html) { c.setEl.innerHTML = html; c.setEl.dataset.v = html; syncFillCtl(c.setEl); }
    }
    drawTools();
  }
  function openSettings() {
    const c = cur; if (!c || c.setEl) return;
    ui.sheet('お知らせと画面の設定', '<div class="lm-set lm-ctrl"></div>', (bg, close) => {
      c.setEl = $('.lm-set', bg); c.setClose = close;
      bg.addEventListener('click', c.onClick); bg.addEventListener('change', c.onChange); bg.addEventListener('input', c.onInput);
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
    /* 「列車へ」：地図が列車を追いかけているあいだ（指で動かしていない・回していない）は、押しても何も起きないので、薄いグレーにして押せない見た目にする。
       指で動かして追いかけが外れた（または2本指で回した）ら、朱色にして押せるようにする。自動ズームのオン・オフとは関係なく、追いかけているかで決める */
    const rc = $('[data-lm="recenter"]', c.root);
    if (rc) {
      const can = !!c.map && (!c.follow || c.free), v = String(can);
      if (rc.dataset.can !== v) {
        rc.dataset.can = v;
        rc.classList.toggle('on', can); rc.classList.toggle('dim', !can);
        rc.setAttribute('aria-disabled', String(!can));
        rc.setAttribute('aria-label', can ? '列車に戻る（追いかけを再開）' : '列車へ（いまは地図が列車を追いかけています）');
      }
    }
    drawZoom();
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
    L.spots.concat(cur && cur.key === key && cur.passSt ? cur.passSt : passStations(key)).forEach(s => { const p = prefOf(s); (groups[p] = groups[p] || []).push(s); });
    const PO = S.ln.prefOrder, prefs = Object.keys(groups).sort((a, b) => ((PO.indexOf(a) + 1 || 99) - (PO.indexOf(b) + 1 || 99)) * S.dir);
    return prefs.map(p => {
      const sp = groups[p].sort((a, b) => (a.km - b.km) * S.dir);
      return `<details class="lm-pg" open data-pref="${esc(p)}"><summary class="lm-pref"><span>${esc(p)}</span><small class="num">${sp.length}件</small><em class="lm-pg-done">通過</em></summary><ol class="lm-spots">${sp.map(s =>
        s.pass ? `<li data-km="${s.km}" class="st"><button data-spot="${s.id}" style="--g:${catOf(s).color}"><span class="lm-dot" aria-hidden="true">${symSvg(s)}</span><span class="lm-sp"><b>${esc(s.name)}</b><em class="st">通過駅</em><small>${esc(s.text || [s.kana, s.pref].filter(Boolean).join('・'))}</small></span><span class="lm-sd num">${s.tt ? esc(s.tt) + 'ごろ' : ''}</span></button></li>` :
        `<li data-km="${s.km}"><button data-spot="${s.id}" style="--g:${catOf(s).color}"><span class="lm-dot" aria-hidden="true">${symSvg(s)}</span><span class="lm-sp"><b>${esc(s.name)}</b>${s.vis ? '<em>窓から</em>' : ''}<small>${esc(s.sum)}</small></span><span class="lm-sd">${s.vis ? (s.vis === 'N' ? '北側' : s.vis === 'S' ? '南側' : s.vis === 'Y' ? (winSide(s, S.dir) === 'L' ? '左の窓' : '右の窓') : '両側') : s.off < 0.3 ? 'すぐそば' : `${s.dir}${kmTxt(s.off)}km`}</span></button></li>`).join('')}</ol></details>`;
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
    await ln.ready;
    if (cur !== c) return;
    c.ml = ml;
    if (!demOn) { try { ml.addProtocol('gsidem', demLoad); demOn = true; } catch { /* 地形なしで続ける */ } }
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const cs = getComputedStyle(document.documentElement);
    const col = n => cs.getPropertyValue(n).trim() || '#888';
    const r = c.last || c.tk.compute();
    const p = pointAt(r.km);
    const split = tunnelSplit(L.tunnels, sliceLine, 0, ln.geom.cum[ln.geom.cum.length - 1]);   // 地表の線はトンネルの外だけ。トンネルの中は点線（平面）か立体の線
    /* 駅の点と名前は、線路の上の列車が止まる位置（pointAt(駅のkm)）に置く。駅の座標は線路から数十mずれることがあり、駅の近くで寄ると、止まった列車の横に離れて見えるため */
    const stnLL = s => (ln.geom.fallback && !ln.lineGeo ? [s[2], s[1]] : pointAt(s[3]));
    const stations = { type: 'FeatureCollection', features: L.stations.map(s => ({ type: 'Feature', properties: { stop: c.S.st.some(x => x.name === s[0] && x.stop) ? 1 : 0 }, geometry: { type: 'Point', coordinates: stnLL(s) } })) };
    /* 電波が弱い・通信を節約する設定なら、航空写真は使わない */
    const conn = navigator.connection;
    if (rasterOf(c.base) === 'photo' && conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) { c.tmpBase = c.base === 'addrp' ? 'addr' : 'std'; ui.toast(c.base === 'addrp' ? '電波が弱いため、住所の地図を淡色で表示します' : '電波が弱いため、標準地図で表示します'); }
    const baseNow = c.tmpBase || c.base;
    const rasterPaint = id => dark ? { 'raster-brightness-max': 0.42, 'raster-saturation': -0.4, 'raster-contrast': 0.1 } : id === 'photo' ? {} : { 'raster-saturation': -0.25 };
    const sources = {}, layers = [{ id: 'bg', type: 'background', paint: { 'background-color': col('--paper-2') } }];
    Object.entries(BASES).forEach(([id, b]) => {
      if (b.under) return;
      sources[id] = { type: 'raster', tiles: [b.url], tileSize: 256, minzoom: id === 'osm' ? 0 : 2, maxzoom: b.max, attribution: b.attr };
      layers.push({ id, type: 'raster', source: id, layout: { visibility: id === rasterOf(baseNow) ? 'visible' : 'none' }, paint: rasterPaint(id) });
    });
    let map;
    try {
      map = new ml.Map({
        container: box, center: p, zoom: (zoomTick(r), zoomTarget(c, c.pitch)), pitch: c.pitch, bearing: c.orient === 'north' ? 0 : headingAt(r.km),
        maxPitch: 70, minZoom: 5, maxZoom: maxZ(c), attributionControl: false, fadeDuration: 0,
        /* ふだんは1本指でページをスクロールし、地図は2本指の拡大・縮小だけ。地図を1回押すと「操作中」になり、1本指で動かせる（setActive）。
           全画面は最初から操作中。傾きは MapLibre の判定が甘いため、自前の判定（pitchGesture）で行う */
        dragPan: c.act, dragRotate: c.act, scrollZoom: c.act, doubleClickZoom: c.act, keyboard: c.act, boxZoom: false, touchPitch: false, touchZoomRotate: true, pitchWithRotate: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, c.eco ? 1 : 2),
        style: {
          version: 8,
          sources: {
            ...sources,
            line: { type: 'geojson', data: multiLine(split.open), attribution: OSM_ATTR },
            done: { type: 'geojson', data: emptyLine() },
            tun: { type: 'geojson', data: multiLine(split.tun) },
            'tun-done': { type: 'geojson', data: emptyLine() },
            stn: { type: 'geojson', data: stations },
            ...(demOn ? { dem: { type: 'raster-dem', tiles: ['gsidem://{z}/{x}/{y}'], tileSize: 256, minzoom: 1, maxzoom: 12, encoding: 'terrarium' } } : {})
          },
          layers: layers.concat([
            { id: 'line-case', type: 'line', source: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': dark ? '#1b1a18' : '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8, 16, 12] } },
            { id: 'line', type: 'line', source: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': col('--shu'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7] } },
            { id: 'done', type: 'line', source: 'done', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': col('--sumi-3'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7] } },
            { id: 'tun-case', type: 'line', source: 'tun', paint: { 'line-color': dark ? '#1b1a18' : '#ffffff', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8, 16, 12] } },
            { id: 'tun', type: 'line', source: 'tun', paint: { 'line-color': col('--ai'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7], 'line-dasharray': [1.4, 1.1] } },
            { id: 'tun-done', type: 'line', source: 'tun-done', paint: { 'line-color': col('--sumi-3'), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7], 'line-dasharray': [1.4, 1.1] } },
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
    const fingers = e => { c.fingers = e.touches.length; };
    ['touchstart', 'touchend', 'touchcancel'].forEach(t => box.addEventListener(t, fingers, { capture: true, passive: true }));
    /* ふだんの画面で地図を押したら「操作中」に */
    map.on('click', () => { if (!c.act) setActive(true); else poke(); });
    map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-left');
    /* 出典は、住所の地図や地名を出すと2行になることがある。その高さ（--at-h）だけ、右下の自動ズームのボタンと全画面の凡例を上げる */
    const atEl = $('.maplibregl-ctrl-attrib', box);
    if (atEl && 'ResizeObserver' in window) {
      c.roAt = new ResizeObserver(() => { if (cur !== c) return; const h = Math.round(atEl.offsetHeight) || 16; if (c.atH !== h) { c.atH = h; c.root.style.setProperty('--at-h', h + 'px'); fitTools(); layoutLabels(); } });
      c.roAt.observe(atEl);
    }
    /* タイルが取れないときの記録（航空写真が続けて取れなければ、標準地図に戻す） */
    const errs = [];
    map.on('error', e => {
      if (e && e.error && /webgl|context/i.test(String(e.error.message || ''))) return fail('WebGL');
      if (e && e.sourceId === 'photo' && rasterNow(c) === 'photo') {
        const t = Date.now(); errs.push(t); while (errs.length && t - errs[0] > 20e3) errs.shift();
        if (errs.length >= 6 && navigator.onLine !== false) { const ap = (c.tmpBase || c.base) === 'addrp'; c.tmpBase = ap ? 'addr' : 'std'; applyBase(); ui.toast(ap ? '電波が弱いため、住所の地図を淡色に戻しました' : '電波が弱いため、標準地図に戻しました'); }
      }
    });
    /* 指で地図を動かしたら追いかけるのをやめる（「現在地」で戻る）。回したらその向きで止める。傾き・拡大はそのまま追いかける */
    map.on('dragstart', e => { if (e.originalEvent && c.follow) { c.follow = false; drawTools(); } });
    map.on('rotatestart', e => { if (e.originalEvent && !c.free) { c.free = true; drawTools(); } });
    map.on('movestart', e => { if (e.originalEvent) c.gest = true; });
    map.on('moveend', () => { if (!c.pg) c.gest = false; layoutLabels(); });
    map.on('rotate', needle);
    map.on('pitchend', () => { const v = Math.round(map.getPitch()); c.pitch = v; ls.set('lm-pitch', String(v)); drawTools(); });
    /* 指で拡大・縮小したら、その縮尺を覚える（自動ズームは止めない。userZoom：走行中の縮尺／駅のあいだだけ／到着モードを止める。「元の縮尺に戻す」で戻る）。
       手の操作かどうかは、拡大・縮小が始まったときに決める：こちらで動かしたもの（camEase。自動ズーム・「元の縮尺に戻す」・到着など）は手の操作にしない。
       それ以外で、指の操作が付いている・2本指で触れている・ホイールかダブルタップのあと最初の拡大・縮小なら、手の操作とみなす
       （時間で区切らない。重い場面で拡大の始まりが遅れても取りこぼさない） */
    const zUser = () => { c.zPend = performance.now(); };
    map.on('wheel', zUser);
    map.on('dblclick', () => { if (c.act) zUser(); });
    map.on('touchstart', e => { const t = e.originalEvent && e.originalEvent.touches; c.touch2 = !!(t && t.length >= 2); });
    map.on('touchend', e => { const t = e.originalEvent && e.originalEvent.touches; if (!t || t.length < 2) c.touch2 = false; });
    map.on('touchcancel', () => { c.touch2 = false; });
    /* こちらで動かしている途中に指で拡大・縮小すると、始まりの知らせが来ないので、途中の知らせ（zoom）でも見る */
    const byUser = e => !c.prog && (!!e.originalEvent || !!c.touch2 || performance.now() - (c.zPend || -1e9) < 5000);
    map.on('zoomstart', e => { c.zByUser = byUser(e); });
    map.on('zoom', e => { if (!c.zByUser && byUser(e)) c.zByUser = true; });
    map.on('zoomend', () => { c.zPend = 0; if (c.zByUser) { c.zByUser = false; userZoom(map.getZoom()); } });
    /* 駅名（ふだんは駅の点の下。列車の印と重なるときは、上・右・左へずらす。placeLabels） */
    c.stns = L.stations.map(s => {
      const stop = c.S.st.some(x => x.name === s[0] && x.stop);
      const el = document.createElement('div'); el.className = 'lm-stn' + (stop ? ' stop' : ''); el.textContent = s[0];
      const mk = new ml.Marker({ element: el, anchor: 'top', offset: [0, 6], pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat(stnLL(s)).addTo(map);
      return { s, el, mk, stop, lp: 'b', ll: stnLL(s) };
    });
    /* 見どころ：ピンを立てて横に名前。地図を傾けても、画面に向かって立てる */
    /* 通過駅のピンは、線路の上の駅の位置（列車が通る所）に立てる */
    (c.passSt || []).forEach(s => { const q = pointAt(s.km); s.lon = q[0]; s.lat = q[1]; });
    c.pins = spotsOf(c).map(s => {
      const cat = catOf(s);
      const el = document.createElement('button'); el.type = 'button';
      el.className = 'lm-pin lv-far' + (s.vis ? ' vis' : '') + (s.pass ? ' st' : ''); el.style.setProperty('--g', cat.color); el.dataset.spot = s.id;
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
    const tel = document.createElement('div'); tel.className = 'lm-train'; tel.dataset.car = ln.id;   // 列車の絵は路線ごと（style.css）
    tel.setAttribute('role', 'img'); tel.setAttribute('aria-label', '自分の列車');
    c.train = new ml.Marker({ element: tel, anchor: 'top-left', offset: [-TRAIN.w / 2, -TRAIN.oy], rotationAlignment: 'viewport', pitchAlignment: 'viewport', opacityWhenCovered: 1 }).setLngLat(p).addTo(map);   // 山の陰でも薄くしない
    c.trainEl = tel; c.frame = -1;
    map.on('move', () => cur === c && c.disp != null && trainFace(c));
    c.disp = c.tgt = r.km; trainFace(c);
    map.on('pitchend', () => { syncTerrain(c); syncArea(c); });
    map.on('load', () => {
      if (cur !== c) return;
      c.loaded = true;
      try {
        c.tunLayer = TunnelLayer({ id: 'tun3d', pointAt, tunnels: L.tunnels, exag: TERRAIN_X, color: col('--ai'), caseColor: dark ? '#1b1a18' : '#ffffff', doneColor: col('--sumi-3'), onRender: () => cur === c && trainTunnel(c) });
        map.addLayer(c.tunLayer.layer, 'stn');
      } catch { c.tunLayer = null; }   // 立体のトンネルが描けなくても、平面の点線で続ける
      syncTerrain(c); tunnelMode(c); c.camAt = 0; drawPins(c.last || r); mapTick(c.last || r, true); layoutLabels();
      loadArea().then(() => { if (cur === c) addAreaLayers(c); });   // 住所の地図・境界線・地名
    });
    drawCtrl(); drawPins(r); layoutLabels();
  }
  const emptyLine = () => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
  /* 自分の列車の印：斜め上から見た立体の先頭車両（N700S風）。tools/train-sprite.html で36方向（10°ごと）を書き出した絵
     （assets/train-sprite.webp）から、画面の上での進行方向に一番近い1枚を選ぶ。印は地図に寝かせず、画面に向かって立てる。
     絵は仰角38°で描いてあるので、地図の回転・傾きから求めた画面上の向き σ を、絵の中の地面の向き a に直して選ぶ */
  const TRAIN = { w: 56, h: 52, cols: 6, n: 36, oy: 30.1, elev: 38 * Math.PI / 180 };   // oy：地面の中心の位置（絵の上から）
  /* 向きは、地図の向き（進行方向のとき）と同じ headingAt から決める：列車の位置から、その向きへ少し（40m）進んだ点を画面に写し、
     画面の上での向き σ を求める（前後の遠い点を写すと、斜めのときは手前の点ほど大きく写り、手前の線路の向きに引っぱられて、地図の向きとずれるため） */
  function trainFace(c) {
    const map = c.map, km = c.disp, ll = pointAt(km), h = rad(headingAt(km)), step = 0.04;
    const ll1 = [ll[0] + Math.sin(h) * step / (111.32 * Math.cos(rad(ll[1]))), ll[1] + Math.cos(h) * step / 110.57];
    const alt = c.tunLayer && map.getTerrain() ? tunAlt(L.tunnels, km) : null;   // トンネルの中は山の中の高さで
    const prj = x => { const q = alt != null && c.tunLayer.project(x, alt * TERRAIN_X); return q ? { x: q[0], y: q[1] } : map.project(x); };
    const p0 = prj(ll), p1 = prj(ll1);
    let sg = Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.5 ? Math.atan2(p1.x - p0.x, p0.y - p1.y) : rad(headingAt(km) - map.getBearing());
    const a = Math.atan2(Math.sin(TRAIN.elev) * Math.sin(sg), Math.cos(sg)) * 180 / Math.PI;
    const k = ((Math.round(a / 10) % TRAIN.n) + TRAIN.n) % TRAIN.n;
    if (k === c.frame) return;
    c.frame = k;
    c.trainEl.style.backgroundPosition = `${-(k % TRAIN.cols) * TRAIN.w}px ${-Math.floor(k / TRAIN.cols) * TRAIN.h}px`;
  }
  /* 進行方向（線路の向き）。地図の向き（「進行方向」のとき）と列車の印の向きは、どちらもこれで決める。
     前後0.3kmで見る：前後1.5kmで見ていたときは、カーブの手前から地図が回り始め、列車のまわりの線路の向きと、リレーかもめで中央5°・最大34°ずれていた
     （0.3kmなら中央0.3°・最大8°。線路の形の点と点のあいだも、0.6kmかけて少しずつ向きが変わるので、角で急に回らない） */
  const HEAD_W = 0.3;
  const headingAt = km => { const d = cur ? cur.S.dir : 1; return bearing(pointAt(km - HEAD_W * d), pointAt(km + HEAD_W * d)); };
  const angGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  /* ---------- 見どころのピンの濃さ ----------
     遠いものは薄く小さく、近づくと濃く大きく、通り過ぎたら薄く。窓から見えるもの・次に来るものは、はっきり */
  function drawPins(r) {
    const c = cur; if (!c || !c.pins.length) return;
    const { S } = c;
    const vis = visNow(r), visId = vis && vis.s.id;
    let nextId = null, best = Infinity;
    if (r.mode !== 'after') c.pins.forEach(p => { const a = S.ahead(r.km, p.s.km); if (!p.s.pass && a > -0.3 && a < best) { best = a; nextId = p.s.id; } });
    const pas = passNow(r), pasId = pas && pas.s.id;
    let changed = false;
    c.pins.forEach(p => {
      const a = S.ahead(r.km, p.s.km);
      let lv = r.mode === 'after' ? 'past' : a < -1 ? 'past' : a <= 8 ? 'near' : a <= 30 ? 'mid' : 'far';
      if (r.mode === 'before') lv = a <= 30 ? 'mid' : 'far';
      if (p.s.id === visId || (p.s.id === nextId && r.mode !== 'before')) lv = 'hot';
      if (p.s.pass) lv = p.s.id === pasId ? 'hot' : lv === 'hot' ? 'near' : lv;   // 通過駅は、お知らせを出している駅だけはっきり
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
    const t0 = performance.now();
    placeLabels0();
    perf.place.push(performance.now() - t0); if (perf.place.length > 20) perf.place.shift();
  }
  function placeLabels0() {
    const c = cur; if (!c || !c.map) return;
    const map = c.map, box = map.getContainer(), W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    const now = performance.now(), before = c.last && c.last.mode === 'before';
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    /* 名前を置けない場所：右上のボタン群・左上の凡例・左下の出典・列車の印・駅名 */
    const obst = [];
    const tools = $('.lm-tools', c.root);
    if (tools) obst.push({ l: W - (tools.offsetWidth + 16), t: 0, r: W, b: tools.offsetTop + tools.offsetHeight + 6 });
    obst.push({ l: 0, t: 0, r: 80, b: 46 }, { l: 0, t: H - 22, r: Math.min(W, 300), b: H });
    /* 出典（地図の種類によって1〜2行） */
    const at = $('.maplibregl-ctrl-attrib', box);
    if (at) { const r = at.getBoundingClientRect(), b0 = box.getBoundingClientRect(); r.width && obst.push({ l: r.left - b0.left, t: r.top - b0.top - 2, r: r.right - b0.left, b: H }); }
    /* 左上の「いま ○○県 ○○市」と凡例 */
    const br0 = box.getBoundingClientRect();
    [c.whereOn && c.whereEl, $('.lm-legend', c.root)].forEach(e => { if (!e) return; const r = e.getBoundingClientRect(); r.width && obst.push({ l: r.left - br0.left - 4, t: r.top - br0.top - 4, r: r.right - br0.left + 4, b: r.bottom - br0.top + 4 }); });
    /* 右下の自動ズームのボタンと、その左の札（見えているものだけ） */
    const zr = box.getBoundingClientRect();
    $$('.lm-zoom > :not([hidden])', c.wrap).forEach(e => { const r = e.getBoundingClientRect(); r.width && obst.push({ l: r.left - zr.left - 4, t: r.top - zr.top - 4, r: r.right - zr.left + 4, b: r.bottom - zr.top + 4 }); });
    const ov = c.full && $('.lm-ov', c.root);
    if (ov) { const br = box.getBoundingClientRect(), or = ov.getBoundingClientRect(); obst.push({ l: or.left - br.left - 4, t: or.top - br.top - 4, r: or.right - br.left + 4, b: H }); }
    let tb = null;
    if (c.train && c.disp != null) { const q = map.project(pointAt(c.disp)); q.x += c.tdx || 0; q.y += c.tdy || 0; tb = { l: q.x - 28, t: q.y - 30, r: q.x + 28, b: q.y + 22 }; obst.push(tb); }
    /* 駅名：列車の印と重ならない向きを選ぶ（下→上→右→左）。どこも重なるなら、名前を列車の印より上に出す */
    const stRects = [];
    (c.stns || []).forEach(st => {
      const q = map.project(st.ll);
      if (q.x < -150 || q.x > W + 150 || q.y < -60 || q.y > H + 60) return;
      if (!st.w) { st.w = st.el.offsetWidth || st.s[0].length * 13 + 8; st.h = st.el.offsetHeight || 18; }
      const { w, h } = st, OFF = { b: [0, 6], t: [0, -6 - h], r: [w / 2 + 9, -h / 2], l: [-(w / 2 + 9), -h / 2] };
      const rect = k => { const [ox, oy] = OFF[k]; return { l: q.x + ox - w / 2, t: q.y + oy, r: q.x + ox + w / 2, b: q.y + oy + h }; };
      const free = k => !tb || !hit(tb, { l: rect(k).l - 2, t: rect(k).t - 2, r: rect(k).r + 2, b: rect(k).b + 2 });
      const k = ['b', 't', 'r', 'l'].find(free) || 'b';
      if (st.lp !== k) { st.lp = k; st.mk.setOffset(OFF[k]); }
      st.el.classList.toggle('lm-over', !free(k));
      if (st.stop) obst.push(rect(k));
      stRects.push(rect(k));
    });
    /* ピンの位置と優先度 */
    const ps = c.pins.map(p => {
      const q = map.project([p.s.lon, p.s.lat]), sc = LV_SCALE[p.lv] || 1, a = p.ahead ?? 0;
      p.x = q.x; p.y = q.y; p.sc = sc;
      p.on = q.x > -12 && q.x < W + 12 && q.y > 0 && q.y < H + 30;
      p.head = { l: q.x - 10 * sc, t: q.y - 30 * sc, r: q.x + 10 * sc, b: q.y - 10 * sc };
      p.tier = p.lv === 'hot' ? 0 : p.lv === 'past' ? 9 : p.s.vis && a > -1 && a <= 40 ? 1 : Math.abs(a) <= 8 ? 2 : a > 0 ? 3 : 9;
      if (before) p.tier = p.lv === 'past' ? 9 : p.s.vis ? 1 : 3;
      if (p.s.pass) p.tier = 9;
      p.forced = p.tmp > now;
      return p;
    }).filter(p => { if (!p.on) p.el.classList.add('nolabel'); return p.on; });
    ps.sort((a, b) => (b.forced - a.forced) || a.tier - b.tier || Math.abs(a.ahead || 0) - Math.abs(b.ahead || 0));
    const heads = ps.map(p => p.head);
    const placed = [], max = labelMax(map.getZoom());
    let shown = 0;
    ps.forEach(p => {
      let pos = null, lab = null;
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
        lab = pos && cand[pos];
      }
      if (pos && !p.forced) shown++;
      p.el.classList.toggle('nolabel', !pos);
      /* 重なっても出す名前が列車の印にかかるときは、ピンごと列車の印より上に */
      p.el.classList.toggle('lm-over', !!(lab && tb && hit(tb, lab)));
      if (pos && p.el.dataset.lp !== pos) p.el.dataset.lp = pos;
    });
    /* 地名・自然地名：見どころの名前・ピン・駅名・ボタンなどに重ならない所にだけ（市区町村名 → 自然地名の順） */
    placePlaces(c, map, W, H, hit, obst.concat(placed, heads, stRects), tb);
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
    /* 傾けている途中で指の数が変わった・やめたときは、操作中の印（c.pg・c.gest）を必ず戻す（残るとカメラが止まったままになる） */
    const reset = () => { if (g && g.mode === 'pitch') { c.pg = c.gest = false; c.holdUntil = performance.now() + 300; } g = null; };
    el.addEventListener('touchstart', e => {
      if (!c.act || e.touches.length !== 2) { reset(); return; }
      const p = two(e);
      g = { p0: p, d0: dist(p), mode: null };
    }, { capture: true, passive: true });
    el.addEventListener('touchmove', e => {
      if (!g) return;
      if (e.touches.length !== 2) { reset(); return; }
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
    const end = e => { if (g && e.touches.length < 2) reset(); };
    el.addEventListener('touchend', end, { capture: true, passive: true });
    el.addEventListener('touchcancel', end, { capture: true, passive: true });
  }

  function setBase(id, save) {
    const c = cur; if (!c || !BASES[id]) return;
    if (c.eco && rasterOf(id) === 'photo') { ui.toast('省電力中は航空写真を使いません'); return; }
    c.base = id; c.tmpBase = null; save && ls.set('lm-base', id);
    applyBase();
  }
  function applyBase() {
    const c = cur; if (!c || !c.map) return;
    const b = c.tmpBase || c.base;
    try { Object.keys(BASES).forEach(id => BASES[id].under || c.map.setLayoutProperty(id, 'visibility', id === rasterOf(b) ? 'visible' : 'none')); } catch { /* 地図の準備前 */ }
    syncArea(c);   // 住所の地図：色分け・境界線・名前
    try { c.map.setMaxZoom(maxZ(c)); } catch { /* noop */ }   // 地図の種類ごとの、ぼやけない縮尺の上限
    syncTerrain(c);   // 立体の地形は航空写真のときだけ（切り替えたら、その場で地形とトンネルの描き方も切り替える）
    c.camAt = 0;
  }
  function setPitch(v) {
    const c = cur; if (!c) return;
    c.pitch = v; ls.set('lm-pitch', String(v));
    if (c.map) {
      const z = c.map.getZoom();
      c.holdUntil = performance.now() + 800;   // 角度を変えているあいだは、追いかけるカメラで止めない
      /* 立体・平面それぞれの自動の縮尺へ（走行中の縮尺は、手で決めた分を保ったまま立体で1段寄る）。手で止めていた駅の縮尺は、角度を変えたら自動に戻す。
         到着モードの縮尺は、角度を変えたあとに arrCamera が決める */
      if (c.zHold) c.zHold = null;
      if (c.arr) c.arrZ = null;   // 角度を変えたら、到着モードの縮尺はその角度で両方入る縮尺から決め直す（手の操作なので、引くこともある）
      const nz = c.arr ? z : zoomTarget(c, v);
      if (v >= 5) syncTerrain(c, true);   // 立体へは、傾け始めから地形を出す（平面へは傾け終わってから消す）
      camEase(c, { pitch: v, zoom: nz, duration: 700 });
    }
    drawTools();
  }
  /* 方位磁針：北が上 ⇔ 進行方向が上。2本指で回したあとは、押すと元の向きに戻す */
  function compass() {
    const c = cur; if (!c) return;
    if (c.free) c.free = false;
    else { c.orient = c.orient === 'north' ? 'head' : 'north'; ls.set('lm-orient', c.orient); }
    if (c.map) { c.holdUntil = performance.now() + 700; camEase(c, { bearing: c.orient === 'north' ? 0 : headingAt(c.tgt ?? c.last.km), duration: 600 }); }
    drawTools();
  }
  function setEco(on) {
    const c = cur; if (!c || c.eco === on) { drawCtrl(); return; }
    c.eco = on; ls.set('lm-eco', on ? '1' : null);
    if (on) {
      ls.set('lm-eco-prev', JSON.stringify({ pitch: c.map ? Math.round(c.map.getPitch()) : c.pitch, base: c.base }));
      if (c.base === 'addrp') { c.base = 'addr'; applyBase(); } else if (c.base === 'photo' || c.base === 'std' || c.base === 'osm') { c.base = 'pale'; applyBase(); }
      setPitch(0);
      c.wakeWant = false; ss.set('lm-wake', null); c.wakeFn && c.wakeFn();
    } else {
      let prev = null; try { prev = JSON.parse(ls.get('lm-eco-prev')); } catch { /* noop */ }
      if (prev) { BASES[prev.base] && (c.base = prev.base, applyBase()); typeof prev.pitch === 'number' && setPitch(prev.pitch); ls.set('lm-base', c.base); }
    }
    try { c.map && c.map.setPixelRatio(Math.min(window.devicePixelRatio || 1, on ? 1 : 2)); } catch { /* noop */ }
    syncTerrain(c);
    c.syncGeo && c.syncGeo();   // 省電力中は、位置を取る間隔を空ける
    c.camAt = 0; drawCtrl();
  }

  /* ---------- 地図の更新 ----------
     地図の描き直し（カメラの移動）は4秒に1回（省電力は10秒・おためしの早送りは1秒）。列車の印は、その合間になめらかに動かす */
  /* 寄っていて列車が画面の上で速く動くとき・縮尺が大きく変わるとき（c.fast。zoomTick が決める）は1秒に1回 */
  const camInterval = () => { const c = cur, st = Clock.state(); return c.eco ? 10e3 : (st && st.speed >= 10 && !st.paused) || c.fast ? 1e3 : 4e3; };
  function mapTick(r, force) {
    const c = cur; if (!c || !c.map || !c.train || !c.active()) return;
    const due = force || performance.now() - c.camAt >= camInterval() - 60;
    c.tgt = r.km;
    if (c.gest && !c.fingers && !c.map.isMoving()) c.gest = c.pg = false;   // 指が離れて止まっているのに残った印は消す（カメラが止まったままにならないように）
    if (!c.eco || due) animTrain(force || Math.abs(r.km - (c.disp ?? r.km)) > 60);
    arrCheck(r);   // 終点が画面に入っているかは毎秒見る（続けて入っている時間を数える）
    if (!due) return;
    c.camAt = performance.now();
    camera(false);
    if (c.loaded) {
      const sp = r.mode === 'before' ? { open: [], tun: [] } : tunnelSplit(L.tunnels, sliceLine, c.S.first.km, r.km);
      const src = c.map.getSource('done'), st = c.map.getSource('tun-done');
      src && src.setData(multiLine(sp.open)); st && st.setData(multiLine(sp.tun));
      c.tunLayer && c.tunLayer.setKm(r.km, r.mode === 'before' ? 0 : c.S.dir);
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
      c.train.setLngLat(pointAt(c.disp)); trainTunnel(c); trainFace(c);
      c.anim = f < 1 ? requestAnimationFrame(step) : null;
      if (f >= 1) layoutLabels();   // 列車の印が動いたので、名前の置き場所を選び直す
    };
    c.anim = requestAnimationFrame(step);
  }
  /* 「列車へ」：すぐ列車の位置に戻り、追いかけを再開する。2本指で回した向きも、元の向き（進行方向／北が上）に戻す。
     指の操作の途中の印（c.gest・c.pg）や、カメラを待たせる時間が残っていても、押したら必ず動かす */
  function recenter() {
    const c = cur; if (!c) return;
    c.follow = true; c.free = false; c.gest = c.pg = false; c.holdUntil = 0;
    if (c.map) { c.map.stop(); c.camAt = performance.now(); }
    drawCtrl(); camera(true);
  }
  /* こちらから動かすカメラ（手の操作と区別するため、動かしているあいだ c.prog を立てる。始まりの知らせはその場で届く） */
  function camEase(c, opt, pad) {
    c.prog = true;
    try { pad ? c.map.setPadding(pad) : c.map.easeTo(opt); } finally { c.prog = false; }
  }
  /* カメラ：追いかけるときは中心だけを動かす。傾きはそのまま。向きは「北が上」なら0、「進行方向」なら線路の向き、回したあとはそのまま。
     次のカメラの更新まで（I）の列車の動きを先取りして、中心と縮尺をそのころの位置に合わせ、I のあいだ一定の速さで動かす（途切れずに追い、縮尺も段にならずに変わる）。
     先取りは次の停車駅を越えない。縮尺の変わる速さには上限（Z_RATE）をつけ、時刻が大きく飛んだときもゆっくり変える */
  /* snap：縮尺を少しずつではなく、一度で自動の縮尺へ（自動ズームの切り替え・「元の縮尺に戻す」を押したとき） */
  const Z_RATE = 1.5;   // 縮尺の変わる速さの上限（時計の1秒に。早送りでも、列車の位置と縮尺の関係は同じ）
  function camera(ease, snap) {
    const c = cur; if (!c || !c.map || !c.follow || c.gest) return;
    if (performance.now() < (c.holdUntil || 0)) { c.camAt = 0; return; }
    const km = c.tgt ?? c.disp;
    if (c.arr && !c.zHold) return arrCamera(km, ease || snap);
    const I = camInterval(), r = c.last, st = Clock.state(), k = st ? (st.paused ? 0 : st.speed) : 1;   // k：時計の進む速さ（おためしの早送り）
    let lead = 0;
    if (!ease && !snap && r && r.mode === 'running') {
      lead = Math.max(0, (r.speed || 0) * I * k / 3.6e6);
      if (c.zd && isFinite(c.zd.dn)) lead = Math.min(lead, c.zd.dn);
    }
    const kc = km + c.S.dir * lead;
    const opt = { center: pointAt(kc) };
    if (c.full && c.pad) opt.padding = c.pad;
    /* 向きは、この動きが終わるころに列車の印がいる所の線路の向きにする（列車の印と同じ headingAt）。
       列車の印は、毎秒の更新で届いた位置（km）へ0.9秒かけて進むので、いまは1回分（1秒ぶん）手前にいる。先取り（lead）からその1秒ぶんを引く
       （引かないと、おためしの早送りでは地図の向きが列車より先のカーブの向きになり、印と最大20°ずれた） */
    const blead = lead && Math.max(0, lead - (r.speed || 0) * 1000 * k / 3.6e6);
    if (!c.free) opt.bearing = c.orient === 'north' ? 0 : headingAt(km + c.S.dir * blead);
    const z = c.map.getZoom(), dz = zoomTarget(c, c.map.getPitch(), lead) - z;
    let zooming = false;
    if (snap) opt.zoom = z + dz;
    else if (Math.abs(dz) > 0.01) { const lim = Z_RATE * (ease ? 0.8 : I / 1000) * Math.max(1, k); opt.zoom = z + Math.max(-lim, Math.min(lim, dz)); zooming = true; }
    if (ease) camEase(c, { ...opt, duration: 800 });
    else camEase(c, { ...opt, duration: zooming || c.fast ? I + 150 : Math.min(700, I * 0.5), easing: t => t });
  }

  /* ---------- 縮尺（停車駅への距離で先回りする自動ズーム） ----------
     速さの帯で段を決めるのはやめ、次（と、いま出た）停車駅までの線路沿いの距離から、縮尺を毎回なめらかに計算する（連続した値・待ち時間なし）。
       寄る縮尺 z(d) = 駅の縮尺 Zs − log2(d / dk)。dk は、縮尺 Zs のとき駅が列車から R px（地図の短い辺の 0.3）に見える距離。
       → 近づくあいだ、駅はいつも画面の同じくらいの所に見えたまま、少しずつ寄っていき、dk より内側（着く前）で寄りきる。出たあとは同じ形で引く。
     走っているときの縮尺（標準＋手で決めた分）より寄るときだけ使う。通過駅では寄らない（停車駅だけ）。時刻表から推定・GPS・おためしで同じ（どれも r.km で動く）。
     GPSの揺れでふらつかないよう、同じ区間のあいだは「次の駅までの距離は縮むだけ・出た駅からの距離は伸びるだけ」にする（大きく飛んだら測り直す）。
     列車の路線を問わない作り：使うのは時刻表の停車駅（c.S.st の stop と km）と線路の形（pointAt）だけ */
  /* 走っているときの標準の縮尺。路線ごとに決める（速さも駅の間隔も違うため）。立体は奥まで写るぶん、平面より寄せる。
     のぞみ・リレーかもめの走行中を、立体・平面・地図の種類（航空写真・淡色・標準）ごとに撮り比べ、「進む方向の数km先の線路と、近くの見どころ・駅が入る」縮尺にした。
     - リレーかもめ（最高130km/h・駅の間隔2〜5km）：立体12.5・平面11.7。前は立体11.3で、15km以上先まで写って景色と見比べにくかった。
       12.5で、立体は4〜5km先（二日市→天拝山・原田、吉野ヶ里→神埼・伊賀屋）までの線路と見どころ・駅が入り、田畑や町の様子も分かる。13では2km先までしか入らない。
     - のぞみ（最高300km/h・駅の間隔が長い）：立体12.0・平面11.2（前は11.3・10.3）。前は立体で40km先（福山の先から東広島まで）写っていた。
       12.0で、立体は1〜2分先（福山→新尾道・三原城跡、広島の手前→東広島）までの線路と見どころ・駅が入る。速いので、リレーかもめほどは寄せない */
  const RUN_Z = { sanyo: { d3: 12.0, flat: 11.2 }, relay: { d3: 12.5, flat: 11.7 } };
  const baseZoom = pitch => (RUN_Z[ln.id] || RUN_Z.sanyo)[pitch >= 5 ? 'd3' : 'flat'];
  /* 地図の縮尺の上限。MapLibre の縮尺 z では、256pxのタイルは z+1 の段を読む（地理院のタイルは18段まで → 縮尺17、OSM は19段まで → 縮尺18）。これより寄るとぼやける */
  const MAX_Z = { std: 17, pale: 17, photo: 17, osm: 18, addr: 17, addrp: 17 };
  const maxZ = c => MAX_Z[c.tmpBase || c.base] || 17;
  /* 駅の縮尺（駅前の建物の外観や道が見分けられるくらい）。新大阪・新神戸・岡山・広島・小倉・博多で、立体・平面・地図の種類ごとに撮り比べて決めた。
     15で、航空写真は屋根の形・色・影で建物が1棟ずつ分かり、地図は建物の輪郭とまわりの道・近くの見どころまで入る（車窓と見比べやすい）。
     16以上は画面が駅の建物だけになり、地理院の標準・淡色の18段（縮尺16.5以上）は線路の斜線と大きな文字でごちゃつく。14.5では建物が小さい。
     立体（斜め）は遠くまで写るぶん、少し控える */
  const STN_Z = { flat: { std: 15, pale: 15, photo: 15, osm: 15, addr: 15, addrp: 15 }, d3: { std: 14.8, pale: 14.8, photo: 14.8, osm: 14.8, addr: 14.8, addrp: 14.8 } };
  /* 航空写真の細かさが足りない駅（寄るとぼやける所）は、ここで控える。駅名 → 縮尺の上限。
     のぞみの停車駅（新大阪〜博多）は、どこも18段の写真に細かさがあり（引き伸ばしでない）、控える駅はない。
     リレーかもめの停車駅（武雄温泉・江北・佐賀・新鳥栖・鳥栖・二日市・博多）も、16〜18段の写真を取り寄せて見比べ、どれも車や駐車場の白線まで写っていて（引き伸ばしでない）、控える駅はない */
  const PHOTO_CAP = {};
  const ECO_Z = 14.5;   // 省電力（地図の更新が10秒に1回）では、列車が画面から外れないよう控えめに
  function stationZoom(c, pitch, name) {
    const b = c.tmpBase || c.base;
    let z = STN_Z[pitch >= 5 ? 'd3' : 'flat'][b] || 16;
    if (rasterOf(b) === 'photo' && PHOTO_CAP[name] != null) z = Math.min(z, PHOTO_CAP[name]);
    if (c.eco) z = Math.min(z, ECO_Z);
    return Math.min(z, maxZ(c));
  }
  /* 走っているときの縮尺：標準＋手で決めた分（zOff。端末に覚える）。立体・平面を切り替えても、手で決めた分はそのまま */
  const runZoom = (c, pitch) => Math.max(5, Math.min(maxZ(c), baseZoom(pitch) + (c.zOff || 0)));
  const mpp = (z, lat) => 40075016.686 * Math.cos(rad(lat)) / (512 * 2 ** z);   // 縮尺 z の1px が何m か
  /* 停車駅の前後の「寄る」縮尺。lead（km）だけ先へ進んだときの値も出せる（カメラは次の更新までの動きを先取りする） */
  function stationPull(c, pitch, lead = 0) {
    const zd = c.zd; if (!zd || !c.zAuto) return null;
    const box = c.map ? c.map.getContainer() : c.wrap;
    const pad = c.full && c.pad ? c.pad : { bottom: 0 };
    const W = (box && box.clientWidth) || 360, H = Math.max(160, ((box && box.clientHeight) || 400) - (pad.bottom || 0));
    const Rpx = 0.3 * Math.min(W, H) / (pitch >= 5 ? Math.max(0.45, Math.cos(rad(pitch))) : 1);   // 斜めのときは奥行きが縮んで見えるぶん遠くまで
    const one = (s, d) => {
      if (!s || !isFinite(d)) return null;
      const zs = stationZoom(c, pitch, s.name), dk = Rpx * mpp(zs, pointAt(s.km)[1]) / 1000;
      return { z: zs - Math.log2(Math.max(d, dk) / dk), zs, name: s.name, at: d <= dk };
    };
    const a = one(zd.next, Math.max(0, zd.dn - lead)), b = one(zd.prev, zd.dp + lead);
    const p = !a ? b : !b ? a : a.z >= b.z ? a : b;
    return p && { ...p, side: p === a ? 'next' : 'prev' };
  }
  /* いまの自動の縮尺。到着モード（手で止めていない）では arrCamera が決めるので、ここでは使わない */
  function zoomTarget(c, pitch, lead = 0) {
    if (c.zHold) return c.zHold.z;
    const zr = runZoom(c, pitch), p = stationPull(c, pitch, lead);
    return p && p.z > zr ? Math.min(p.z, p.zs) : zr;
  }
  const curPitch = c => (c.map ? c.map.getPitch() : c.pitch);
  /* 毎秒：前後の停車駅までの距離（揺れを抑えたもの）を求め、駅の手前で手で止めた縮尺を、駅を離れたら戻す */
  function zoomTick(r) {
    const c = cur; if (!c || !r) return;
    const S = c.S, stops = S.st.filter(x => x.stop);
    let pi = -1, ni = -1;
    for (let i = 0; i < stops.length; i++) { if (S.ahead(r.km, stops[i].km) > 0.0005) { ni = i; break; } pi = i; }
    let dn = ni >= 0 ? S.ahead(r.km, stops[ni].km) : Infinity, dp = pi >= 0 ? -S.ahead(r.km, stops[pi].km) : Infinity;
    const f = c.zd;
    if (f && f.pi === pi && f.ni === ni && Math.abs(r.km - f.km) < 3 && r.mode === 'running') { dn = Math.min(dn, f.dn); dp = Math.max(dp, f.dp); }   // 止まっているときは、そのままの距離（駅では0）
    c.zd = { pi, ni, prev: stops[pi] || null, next: stops[ni] || null, dn, dp, km: r.km };
    const pitch = curPitch(c), p = stationPull(c, pitch), zone = p && p.z > runZoom(c, pitch) ? p : null;
    /* 駅の近くで手で変えた縮尺は、その駅のあいだだけ。駅を離れたら（寄る範囲を出たら）走っているときの縮尺に戻す */
    if (c.zHold && !c.zHold.arr && (!zone || zone.name !== c.zHold.stn)) { c.zHold = null; c.camAt = 0; }
    c.zone = zone;
    /* 列車が画面の上で速く動く（寄っている）ときは、カメラを1秒ごとに動かして、なめらかに追う */
    const zNow = c.map ? c.map.getZoom() : runZoom(c, pitch), v = r.mode === 'running' ? r.speed || 0 : 0;
    /* カーブ（進行方向のとき、この先4秒で線路の向きが1.5°より大きく変わる）も1秒ごとにして、地図を列車の印と一緒に少しずつ回す
       （4秒ごとだと、地図の向きが列車より先に回ったり遅れたりして、印と地図の向きがずれる） */
    const turn = c.orient !== 'north' && !c.free && v > 0 && angGap(headingAt(r.km), headingAt(r.km + S.dir * v * 4 / 3600)) > 1.5;
    c.fast = v / 3.6 / mpp(zNow, pointAt(r.km)[1]) > 3 || Math.abs(zoomTarget(c, pitch) - zNow) > 0.25 || turn;
    drawZoom();
  }
  /* 指で拡大・縮小したとき：自動は止めない。
     ふだん（駅の近くでない）なら、その縮尺を「走っているときの縮尺」として覚える。
     停車駅の近く（寄っているあいだ）なら、その駅のあいだだけその縮尺にして、駅を離れたら走っているときの縮尺に戻す。
     到着モードのあいだなら、到着モードのカメラを止めてその縮尺で列車を追う（「元の縮尺に戻す」で到着モードに戻る） */
  function userZoom(z) {
    const c = cur; if (!c) return;
    const pitch = curPitch(c);
    z = Math.round(z * 100) / 100;
    if (c.arr) { c.zHold = { z, arr: true }; zoomMsg('いまの縮尺で列車を追います'); }
    else if (c.zone && c.zAuto) { c.zHold = { z, stn: c.zone.name }; zoomMsg(`${c.zone.name}を離れたら、走行中の縮尺に戻ります`); }
    else { c.zHold = null; setRunZoom(z - baseZoom(pitch)); zoomMsg('走行中の縮尺を変更しました'); }
    drawZoom();
  }
  function setRunZoom(off) {
    const c = cur; if (!c) return;
    c.zOff = off == null || Math.abs(off) < 0.05 ? null : Math.round(off * 100) / 100;
    /* 標準の縮尺を路線ごとに寄せたので（16d）、前に覚えた差（lm-zoff）は使わず、新しい名前で覚え直す（前の差のままだと、寄せた分と重なって寄りすぎる） */
    ls.set('lm-zoff2', c.zOff == null ? null : String(c.zOff)); ls.set('lm-zoff', null);
  }
  /* 縮尺のボタンの左に、短い知らせを数秒だけ出す（そのあとは「元の縮尺に戻す」） */
  function zoomMsg(t) { const c = cur; if (!c) return; c.zMsg = t; clearTimeout(c.zMsgT); c.zMsgT = setTimeout(() => { if (cur === c) { c.zMsg = null; drawZoom(); } }, 4000); drawZoom(); }
  /* 地図の右下の縮尺のボタン「自動ズーム：オン／オフ」と、その左の小さな札（知らせ・「元の縮尺に戻す」・いま寄っている理由）。
     ボタンは一度作ったら作り直さない（押しているあいだに差し替わって、押したのが消えないように）。文字と色だけ変える */
  function drawZoom() {
    const c = cur; if (!c || !c.map || !c.wrap) return;
    let el = $('.lm-zoom', c.wrap);
    if (!el) {
      el = document.createElement('div'); el.className = 'lm-zoom';
      el.innerHTML = '<span class="lm-znote" aria-live="polite" hidden></span><button type="button" class="lm-zreset" data-lm="zreset" hidden>元の縮尺に戻す</button><button type="button" class="lm-zbtn" data-lm="zoom"><span class="lm-zk">自動ズーム：</span><b></b></button>';
      c.wrap.appendChild(el);
    }
    const custom = c.zOff != null || !!c.zHold;
    const note = c.zMsg || (custom ? '' : c.arr ? `${c.S.tr.end || c.S.last.name}へ向けて拡大` : c.zAuto && c.zone ? (c.zone.side === 'next' && !c.zone.at ? `${c.zone.name}に近づくので拡大` : c.zone.side === 'prev' && !c.zone.at ? `${c.zone.name}を出たので縮小` : `${c.zone.name}のまわりを拡大`) : '');
    const v = `${c.zAuto}|${custom}|${note}`;
    if (el.dataset.v === v) return;
    el.dataset.v = v;
    const b = $('.lm-zbtn', el), n = $('.lm-znote', el), rs = $('.lm-zreset', el);
    b.classList.toggle('off', !c.zAuto);
    $('b', b).textContent = c.zAuto ? 'オン' : 'オフ';
    b.setAttribute('aria-pressed', String(c.zAuto));
    b.setAttribute('aria-label', c.zAuto ? '自動ズーム：オン。停車駅の近くで自動で拡大します。押すとオフ' : '自動ズーム：オフ。縮尺を変えません。押すとオン');
    n.textContent = note; n.hidden = !note;
    rs.hidden = !custom || !!c.zMsg;
    fitTools();
  }
  /* 「自動ズーム」のボタン：押すたびにオン・オフを切り替える（設定のスイッチと同じ。端末に覚える）。押した印（短く色が変わる）を出す */
  function setAutoZoom(on) {
    const c = cur; if (!c) return;
    c.zAuto = on; ls.set('lm-autozoom', on ? null : '0');
    if (c.zHold && !c.zHold.arr) c.zHold = null;
    if (c.map) { const r = c.last; r && zoomTick(r); c.follow = true; c.gest = c.pg = false; c.holdUntil = 0; c.camAt = performance.now(); camera(true, true); }
    drawCtrl(); drawZoom();
  }
  function toggleZoom(b) {
    const c = cur; if (!c) return;
    c.zPend = 0; c.zByUser = false;
    if (b) { b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap'); clearTimeout(c.tapT); c.tapT = setTimeout(() => b.classList.remove('tap'), 260); }
    setAutoZoom(!c.zAuto);
    ui.toast(c.zAuto ? '自動ズームをオンにしました（停車駅の近くで拡大）' : '自動ズームをオフにしました（縮尺はそのまま）');
  }
  /* 「元の縮尺に戻す」：手で決めた走行中の縮尺と、駅・到着モードで手で止めた縮尺を消して、すぐ自動の縮尺へ */
  function resetZoom() {
    const c = cur; if (!c) return;
    c.zPend = 0; c.zByUser = false;
    setRunZoom(null); c.zHold = null; c.zMsg = null; clearTimeout(c.zMsgT);
    if (c.map) { c.last && zoomTick(c.last); c.follow = true; c.gest = c.pg = false; c.holdUntil = 0; c.camAt = performance.now(); c.arr && (c.arrFirst = true); camera(true, true); }
    drawZoom();
    ui.toast('元の縮尺に戻しました');
  }

  /* ---------- 到着モード ----------
     いまどのへん？のすべての列車に共通の仕組み（列車ごとに分けない）。終点は便ごとのデータ T.trains[key].end、なければ時刻表の最後の駅。距離では決めない。
     終点が、時計で10秒（ARR_HOLD）続けて画面に（端ではなく内側に）入っていたら始める。カーブなどで一瞬入っただけでは始めない（途中で外れたら数え直す）。
     終点を画面の上の方に置き、列車を下に置いて、近づくにつれて拡大する（終点の方向を上に）。
     縮尺は引かない：始めたときの縮尺のまま始め（c.arrZ に覚える）、あとは「列車と終点が両方入る縮尺」がそれより寄ったときだけ、それに合わせて寄る（c.arrZ も上がるだけ）。
     見下ろす角度は変えない：立体（斜め）ならその角度のまま最後まで、平面なら真上から。
     入ったときは手動の縮尺も自動に戻す。途中で指で拡大・縮小したら手動になり、「元の縮尺に戻す」でまた到着駅へ向けた拡大に戻る。
     終点に着いて止まったら、ふだんの表示に戻す */
  const ARR_HOLD = 10e3;
  const endKm = c => { const k = stationKm(c.S.tr.end || c.S.last.name); return k == null ? c.S.last.km : k; };
  /* 終点が、いま地図の見える範囲（下の札に隠れる所を除く）に、安定して入っているか。
     端にかすっているだけ（上の端から見える範囲の2割まで・左右と下の端から16pxまで）は数えない：
     上の端ぎりぎりで始めると、そのあと下に札が出て見える範囲が狭くなったとき、縮尺を引かないので終点が画面の外に出てしまう */
  function endInView(c, ek) {
    const map = c.map, box = map.getContainer(), pad = c.full && c.pad ? c.pad : { bottom: 0, left: 0 }, W = box.clientWidth, H = box.clientHeight - pad.bottom;
    const q = map.project(pointAt(ek)), m = 16;
    return Number.isFinite(q.x) && Number.isFinite(q.y) && q.x >= (pad.left || 0) + m && q.x <= W - m && q.y >= 0.2 * H && q.y <= H - m;
  }
  function arrCheck(r) {
    const c = cur; if (!c || !c.map || !c.loaded) return;
    const ek = endKm(c);
    const done = r.mode === 'after' || (r.mode === 'stopped' && Math.abs(r.km - ek) < 0.3);
    if (c.arr) { if (done || r.mode === 'before') arrExit(); return; }
    if (done || r.mode === 'before' || !c.follow || c.gest || !endInView(c, ek)) { c.arrSeen = null; return; }
    const now = +Clock.now();
    if (c.arrSeen == null) c.arrSeen = now;
    if (now - c.arrSeen < ARR_HOLD) return;
    c.arr = true; c.arrFirst = true; c.camAt = 0; c.arrSeen = null;
    c.arrZ = c.map.getZoom();   // この縮尺より引かない
    c.zHold = null;   // 駅の近くで手で止めた縮尺のまま終点が映ったときも、ここから到着モード（到着駅に向けた拡大）にする
    drawZoom();
  }
  function arrExit() {
    const c = cur; if (!c || !c.arr) return;
    c.arr = false; c.arrZ = null; c.camAt = 0; drawZoom();
    if (c.map) {
      const opt = { pitch: c.pitch, duration: 1200 };
      if (c.zHold && c.zHold.arr) c.zHold = null;
      c.last && zoomTick(c.last);
      opt.zoom = zoomTarget(c, c.pitch);
      if (c.full && c.pad) opt.padding = c.pad;
      if (!c.free) opt.bearing = c.orient === 'north' ? 0 : headingAt(c.tgt ?? c.disp);
      c.holdUntil = performance.now() + 1300;
      camEase(c, opt);
    }
  }
  /* 列車を画面の yA、終点を yB に置く縮尺と中心。斜めのときは遠近（奥ほど小さく見える）を入れて求める：
     画面の中心から上へ u（px）に見える地面は、中心から奥へ s = u·D / (D·cos p − u·sin p)（D は中心までのカメラの距離、p は傾き）。
     平面（p = 0）では s = u になり、今までと同じ。
     縮尺は c.arrZ（始めたときの縮尺。上がるだけ）より引かない。両方入る縮尺よりまだ寄っているあいだは、列車を yA に置き、終点は画面の上の方（近づけば yB に来る）。
     両方入る縮尺に余裕があるあいだは、終点は yB より少し下に見える */
  function arrCamera(km, ease) {
    const c = cur, map = c.map, M = c.ml.MercatorCoordinate;
    const a = M.fromLngLat(pointAt(km)), b = M.fromLngLat(pointAt(endKm(c)));
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    /* 余白（遠近の中心）は、追いかけているときと同じにする（全画面は c.pad：中心が列車の高さ）。到着モードだけ違う余白にすると、
       追いかけているときに画面の上の方に見えていた終点が、同じ縮尺では画面の外に出てしまい、縮尺を引かないと入らなくなる */
    const box = map.getContainer(), H = box.clientHeight, pad = c.full && c.pad ? c.pad : { top: 0, bottom: 0, left: 0 }, Hv = H - pad.bottom;
    const yc = ((pad.top || 0) + Hv) / 2;                     // 遠近の中心（余白を除いた範囲の中心）
    const yB = 44, yA = Math.max(yB + 60, Hv - 72);           // 終点は上の端から44px（駅名が下に出る）、列車は下から72px
    const pitch = map.getPitch(), p = rad(pitch);
    const fov = rad((map.getVerticalFieldOfView && map.getVerticalFieldOfView()) || 36.87), D = H / 2 / Math.tan(fov / 2);
    const ground = u => u * D / Math.max(1e-3, D * Math.cos(p) - u * Math.sin(p));
    const uB = p > 0.01 ? Math.min(yc - yB, 0.8 * D / Math.tan(p)) : yc - yB;   // 地平線より上には置かない（傾きが大きいとき）
    const sA = ground(yc - yA), sB = ground(uB);              // 列車（中心より下＝負）と終点（中心より上＝正）
    /* 寄る縮尺は、下に札（「まもなく○○駅を通過」・見どころ・乗り換えの案内）が増えて見える範囲が狭くなっても終点が入るよう、
       終点を余裕 R だけ下に置いたつもりで決める（全画面だけ。縮尺は引かないので、札が出たあとで引いて合わせることはできないため）。
       札が出ると、遠近の中心（列車の高さ）も上へ移り、斜めのときは画面の上の端までに写る奥行きが大きく縮む（札で120px狭くなると約4割）。
       そのため余裕は、下の札の側ではなく、奥の終点の側で取る */
    const R = c.full ? Math.max(0, Math.min(0.2 * H, uB - 120)) : 0;
    const sR = ground(uB - R);
    const zEnd = stationZoom(c, pitch, c.S.tr.end || c.S.last.name);   // 着いたときは、ほかの停車駅と同じ駅の縮尺まで
    let z = dist > 0 ? Math.max(5, Math.min(zEnd, Math.log2((sR - sA) / (dist * 512)))) : zEnd;
    if (c.arrZ == null) c.arrZ = z;                            // 角度を変えたあとなどは、そのときの両方入る縮尺から
    z = Math.max(z, c.arrZ); c.arrZ = z;
    /* 縮尺を引かないために、両方入る縮尺より寄っているとき（下に「まもなく○○駅を通過」などの札が出て、見える範囲が狭くなったときなど）は、
       列車を見える範囲の下の方（下の端から24pxまで）へ、終点を上の端近く（8px）へ寄せて、両方をできるだけ画面に残す */
    let sT = sA;                                               // 列車を置く所（遠近の中心からの地面の長さ。下は負）
    const g = dist * 512 * 2 ** z;                             // 列車→終点の地面の長さ（px）
    if (g > sB - sA + 0.5) {
      const sTop = ground(p > 0.01 ? Math.min(yc - 8, 0.8 * D / Math.tan(p)) : yc - 8);
      sT = Math.max(ground(yc - (Hv - 24)), Math.min(sA, sTop - g));
    }
    const k = dist > 0 ? -sT / g : 0;                          // 画面の中心に来る点（列車から終点の方へ、列車→終点の何倍の所か）
    const center = new M(a.x + dx * k, a.y + dy * k).toLngLat();
    const brg = dist > 0 ? Math.atan2(dx, -dy) * 180 / Math.PI : map.getBearing();
    const opt = { center, zoom: z, bearing: brg, pitch, padding: { top: pad.top || 0, bottom: pad.bottom || 0, left: pad.left || 0, right: 0 } };
    if (ease || c.arrFirst) { c.arrFirst = false; camEase(c, { ...opt, duration: 1500 }); }
    else camEase(c, { ...opt, duration: Math.min(1500, camInterval() * 0.9), easing: t => t });
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
      { el: () => pinTarget() || $('#lm-map', root), title: '見どころのピン', text: '名前を押すと、紹介が下から開きます。ピンの色と記号は種類（城・寺社・自然・川・街・通過駅）を表します。通過駅に近づくと「まもなく○○駅を通過」と紹介が出ます。', before: toMap },
      { el: '#spots', title: '見どころの紹介と一覧', text: '紹介には、ところ・ひとこと・くわしい説明が載っています。地図の下へスクロールすると「沿線の見どころ一覧」を通る順に見られます。', before: async () => { const h = $('#spots'); if (h) { h.scrollIntoView({ block: 'start' }); await sleep(150); } }, after: toMap },
      { el: '#lm-map', title: c.full ? '地図の操作' : '押して地図を操作', text: c.full ? '1本指で地図を動かし、2本指で拡大・縮小や回転ができます。2本指をそろえて上下にずらすと傾きます。動かすと列車を追いかけるのを止めます。「列車へ」を押すと、列車の位置と元の向きに戻ります（追いかけているあいだは、「列車へ」は薄いグレーで押せません）。' : 'ふだんは1本指でページをスクロールします。地図を1回押すと枠が朱色になり、1本指で動かす・2本指で拡大・縮小や回転ができます。2本指をそろえて上下にずらすと傾きます。「操作を終える」を押すか、地図の外を押すと戻ります。' },
      { el: () => $('.lm-zbtn', root), title: '自動ズームのボタン', text: '「自動ズーム：オン」のあいだは、停車駅に近づくと着く前から少しずつ拡大し、駅を出ると少しずつ戻ります。押すとオフ（縮尺を自動では変えない）になります。指で拡大・縮小しても自動は止まらず、その縮尺を走行中の縮尺として覚えます。「元の縮尺に戻す」で最初の縮尺に戻ります。' },
      { el: () => $('[data-lm="tools"]', root), title: '地図の操作ボタン', text: '押すと開きます（もう一度押すと閉じます）。開くと、方位磁針（押すと北が上に、もう一度押すと進行方向が上。赤い側が北）・立体・地図の種類（標準・淡色・航空写真・OpenStreetMap）・列車へ・全画面・設定・使い方のボタンが並びます。山の盛り上がり（立体の地形）は、航空写真で立体にしたときだけです。' },
      { el: () => c.full ? $('[data-lm="tools"]', root) : $('.lm-sum', root), title: 'お知らせと画面の設定', text: `${c.full ? '「操作」を押して開き、⚙' : 'この1行か、「操作」を開いた中の ⚙'}を押すと設定が開きます。お知らせをONにすると、降りる駅の5分前と1分前にバイブと画面でお知らせします。画面を自動で消さない・省電力もここで切り替えます。`, after: toMap }
    ], { force });
  }

  window.LiveMap = {
    mount, unmount,
    guide: () => runGuide(true),
    /* 路線図（既存）と同じ時刻表で動かすための、GPSで分かった遅れ（ミリ秒）。分からなければ 0 */
    delayMs: () => (cur && cur.last && cur.last.gpsDelay ? cur.last.delay : 0),
    /* 駅一覧（app.js）を地図と同じ位置にするための、時刻表の上の「いま」（遅れを引いた時刻。停車駅に止まっているあいだは駅の時刻）。GPSで遅れを測っていなければ null */
    schedT: key => (cur && cur.key === key && cur.last && cur.last.gpsDelay ? cur.last.t : null),
    /* いま乗車の時間帯（発車の30分前〜到着の2時間後）にある列車。なければ null */
    rideKey,
    _internals: { sched, Tracker, snap: (lat, lon) => ln.snap(lat, lon), pointAt, PrefWatch, prefAt: km => ln.prefAt(km), splitMuni, lines: LN, lineOf },
    _debug: () => cur && {
      last: cur.last, disp: cur.disp, dir: cur.S.dir, fix: cur.tk.fix, reject: cur.tk.reject, follow: cur.follow, map: !!cur.map, loaded: !!cur.loaded, gpsOn: !!cur.unGeo, gpsWant: cur.gpsWant, gpsAuto: !!cur.gpsAuto, perm: GeoPerm.state(), geomFallback: !!ln.geom.fallback && !ln.lineGeo, line: ln.id,
      pitch: cur.map ? cur.map.getPitch() : cur.pitch, bearing: cur.map ? cur.map.getBearing() : null, orient: cur.orient, free: cur.free, base: cur.tmpBase || cur.base, eco: cur.eco,
      zoom: cur.map ? cur.map.getZoom() : null, zAuto: cur.zAuto, zOff: cur.zOff, zHold: cur.zHold, zone: cur.zone && { ...cur.zone }, zd: cur.zd && { dn: cur.zd.dn, dp: cur.zd.dp, next: cur.zd.next && cur.zd.next.name, prev: cur.zd.prev && cur.zd.prev.name }, fast: cur.fast, target: cur.map ? zoomTarget(cur, cur.map.getPitch()) : null, arr: cur.arr,
      perf: { decode: +perf.decode.toFixed(1), place: perf.place.length ? +(perf.place.reduce((a, b) => a + b, 0) / perf.place.length).toFixed(2) : null, placeMax: perf.place.length ? +Math.max(...perf.place).toFixed(2) : null },
      area: !!AREA, pl: cur.pl ? cur.pl.filter(p => p.onMap).map(p => p.name) : null, plU: showU(cur), plY: showY(cur), where: cur.whereEl && cur.whereEl.textContent,
      camInterval: camInterval(), mapVisible: cur.mapVisible, active: cur.active(), alarms: { ...cur.alarms }, pins: cur.pins.map(p => [p.s.id, p.lv, !p.el.classList.contains('nolabel')])
    },
    _map: () => cur && cur.map
  };
})();
