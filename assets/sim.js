/* おためし（シミュレーション）モードの土台
   - Clock：画面の「いま」はすべてここから取る。仮想の時計（開始時刻・速度・一時停止・シーク）
   - Geo：位置情報。本物のGPSと、作り物の位置を切り替える（ライブ地図で使う）
   状態は sessionStorage に置くので、タブを閉じれば必ず本物に戻る。 */
(() => {
  'use strict';
  const KEY = 'sim';
  const ss = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } },
    set(v) { try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch { /* 保存できなくても続行 */ } }
  };
  const parse = t => t instanceof Date ? t : new Date(/[zZ]|[+-]\d\d:\d\d$/.test(t) ? t : (t.length <= 16 ? t + ':00' : t) + '+09:00');

  let st = ss.get();          // { base, anchor, speed, paused, scenario, pos }
  const subs = new Set();
  const emit = kind => subs.forEach(fn => { try { fn(kind); } catch (e) { console.error(e); } });
  const save = kind => { ss.set(st); emit(kind); };
  const virt = () => st.paused ? st.base : st.base + (Date.now() - st.anchor) * st.speed;
  const rebase = () => { st.base = virt(); st.anchor = Date.now(); };

  const Clock = {
    SPEEDS: [1, 10, 60],
    now: () => new Date(st ? virt() : Date.now()),
    active: () => !!st,
    state: () => st && { ...st, now: new Date(virt()) },
    start(t, opt = {}) {
      st = { base: +parse(t), anchor: Date.now(), speed: opt.speed || 1, paused: !!opt.paused, scenario: opt.scenario || null, pos: opt.pos || null };
      save('start');
    },
    play() { if (!st || !st.paused) return; st.anchor = Date.now(); st.paused = false; save('play'); },
    pause() { if (!st || st.paused) return; rebase(); st.paused = true; save('pause'); },
    toggle() { st && (st.paused ? Clock.play() : Clock.pause()); },
    setSpeed(s) { if (!st) return; rebase(); st.speed = s; save('speed'); },
    cycleSpeed() { if (!st) return; const i = Clock.SPEEDS.indexOf(st.speed); Clock.setSpeed(Clock.SPEEDS[(i + 1) % Clock.SPEEDS.length]); },
    seek(t) { if (!st) return; st.base = +parse(t); st.anchor = Date.now(); save('seek'); },
    shift(ms) { if (!st) return; rebase(); st.base += ms; save('seek'); },
    stop() { st = null; ss.set(null); Geo._reset(); emit('stop'); },
    on(fn) { subs.add(fn); return () => subs.delete(fn); }
  };

  /* 仮想の時計が進むあいだ、1秒ごとに 'tick' を配る（×1 は画面側の更新間隔に任せる）
     線路を走る作り物のGPSは、tick の直前に位置を配る（画面の更新が、いつも届いたばかりの位置を使えるように） */
  setInterval(() => { if (st && !st.paused) { Geo._simTick(); emit('tick'); } }, 1000);

  /* ?t=2026-10-17T16:05（&speed=10&paused=1）で開いたら、おためしを始めてURLから消す */
  const q = new URLSearchParams(location.search);
  if (q.get('t')) {
    try {
      Clock.start(q.get('t'), { speed: +q.get('speed') || 1, paused: q.get('paused') === '1', scenario: { title: '日時を指定' } });
    } catch { /* 読めない日時は無視 */ }
    ['t', 'speed', 'paused'].forEach(k => q.delete(k));
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  /* ========== 位置情報 ==========
     位置は { lat, lon, acc(m), speed(m/s|null), heading(度|null), src:'gps'|'sim', at:Date } で配る
     おためしの位置（st.pos）は2種類
       [lat, lon, 名前]      … その場所に固定
       { track, delay }      … 列車に乗って線路を進む。位置は Geo.tracks[track](時刻, delay) が作る（livemap.js が登録）
                               トンネルの中などで null を返したら、その間は位置を配らない（本物のGPSが途切れるのと同じ） */
  let watchId = null, real = null, pace = 0, paceT = 0, paceOn = false;
  const geoSubs = new Set(), errSubs = new Set();
  const isTrack = () => !!(st && st.pos && !Array.isArray(st.pos) && st.pos.track);
  const trackFix = () => { const f = Geo.tracks[st.pos.track]; return f ? f(Clock.now(), st.pos.delay || 0) : null; };
  const gotReal = p => {
    const c = p.coords;
    real = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, speed: c.speed ?? null, heading: c.heading ?? null, src: 'gps', at: new Date(p.timestamp) };
    GeoPerm._ok();
    if (Geo.mode() === 'real') geoSubs.forEach(f => f(real));
  };
  const badReal = err => { if (err && err.code === 1) GeoPerm._denied(); errSubs.forEach(f => f(err)); };
  /* ふだんは位置を続けて受け取る（watchPosition）。pace（ミリ秒）を決めたときは、その間隔で1回ずつ取る（省電力。GPSを休ませる） */
  const startReal = () => {
    if (watchId !== null || paceOn || !('geolocation' in navigator)) return;
    if (pace) {
      paceOn = true;
      const once = () => {
        if (!paceOn) return;
        navigator.geolocation.getCurrentPosition(p => { gotReal(p); next(); }, err => { badReal(err); next(); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
      };
      const next = () => { clearTimeout(paceT); if (paceOn) paceT = setTimeout(once, pace); };
      once();
      return;
    }
    watchId = navigator.geolocation.watchPosition(gotReal, badReal, { enableHighAccuracy: true, maximumAge: 5000, timeout: 60000 });
  };
  const stopReal = () => {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    paceOn = false; clearTimeout(paceT);
  };
  const Geo = {
    /* 'sim'：おためしで決めた位置／'real'：端末のGPS */
    mode: () => (st && st.pos ? 'sim' : 'real'),
    tracks: {},
    current() {
      if (isTrack()) return trackFix();
      if (st && st.pos) return { lat: st.pos[0], lon: st.pos[1], acc: 10, speed: null, heading: null, label: st.pos[2] || '', src: 'sim', at: Clock.now() };
      return real;
    },
    setSim(lat, lon, label = '') { if (!st) return; st.pos = [lat, lon, label]; save('pos'); geoSubs.forEach(fn => fn(Geo.current())); },
    /* 本物のGPSは、ここを呼んだとき（＝画面のボタンを押したとき）に初めて許可を求める。おためし中は求めない */
    watch(fn, onErr) {
      geoSubs.add(fn); onErr && errSubs.add(onErr);
      if (Geo.mode() === 'sim') { const c = Geo.current(); c && fn(c); }
      else startReal();
      return () => { geoSubs.delete(fn); onErr && errSubs.delete(onErr); if (!geoSubs.size) stopReal(); };
    },
    /* 位置を取る間隔（ミリ秒）。0 は続けて受け取る。使っている途中で変えたら、取り直す */
    pace(ms) {
      ms = ms || 0; if (ms === pace) return;
      pace = ms;
      if (watchId !== null || paceOn) { stopReal(); startReal(); }
    },
    _simTick() { if (isTrack() && geoSubs.size) { const c = trackFix(); c && geoSubs.forEach(fn => fn(c)); } },
    /* おためし終了。本物のGPSはここでは始めない（許可を勝手に求めないため。画面が組み直されたときに必要なら頼み直す） */
    _reset() { geoSubs.forEach(fn => fn(real)); }
  };

  /* ========== 位置情報の許可の状態 ==========
     state()：'granted'（許可済み）／'prompt'（まだ聞かれていない）／'denied'（拒否）／'unknown'（調べられないブラウザ）
     Permissions API で調べ、変わったら on() で知らせる。調べられないブラウザでも、一度位置が取れたらこの端末に覚えて「許可済み」とみなす。
     request()：許可の確認を1回だけ出す（位置を1回だけ、精度を落として取って、すぐやめる。GPSは使い続けない）。
       結果は 'granted'／'denied'／'off'（許可はしたが、端末の位置情報がオフ） ／'unknown'
     テスト用：?perm=granted|prompt|denied|unknown|off で開くと、このタブのあいだ状態を差し替える（off は「まだ」で、許可すると端末の位置情報がオフ）。?perm=real で元に戻す */
  const GeoPerm = (() => {
    const TKEY = 'geo-perm', OK = 'geo-ok';
    const tget = () => { try { return sessionStorage.getItem(TKEY); } catch { return null; } };
    const tset = v => { try { v ? sessionStorage.setItem(TKEY, v) : sessionStorage.removeItem(TKEY); } catch { /* noop */ } };
    const lok = v => { try { if (v === undefined) return localStorage.getItem(OK) === '1'; v ? localStorage.setItem(OK, '1') : localStorage.removeItem(OK); } catch { return false; } };
    let api = null;          // Permissions API の結果（なければ null）
    let denied = false;      // 調べられないブラウザで、拒否されたと分かったとき
    const subs = new Set();
    const emit = () => subs.forEach(fn => { try { fn(P.state()); } catch (e) { console.error(e); } });
    const pq = new URLSearchParams(location.search).get('perm');
    if (pq) {
      tset(pq === 'real' ? null : pq);
      const q2 = new URLSearchParams(location.search); q2.delete('perm');
      const qs = q2.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
    try {
      navigator.permissions && navigator.permissions.query({ name: 'geolocation' }).then(ps => {
        api = ps.state; emit();
        ps.addEventListener ? ps.addEventListener('change', () => { api = ps.state; emit(); }) : (ps.onchange = () => { api = ps.state; emit(); });
      }).catch(() => {});
    } catch { /* 調べられないブラウザ */ }
    const P = {
      state() {
        const t = tget();
        if (t) return t === 'off' ? 'prompt' : t;
        if (api) return api;
        if (denied) return 'denied';
        return lok() ? 'granted' : 'unknown';
      },
      test: () => tget(),
      on(fn) { subs.add(fn); return () => subs.delete(fn); },
      request() {
        const t = tget();
        if (t) {
          const r = t === 'denied' ? 'denied' : t === 'off' ? 'off' : 'granted';
          if (r !== 'denied') tset('granted');
          return new Promise(res => setTimeout(() => { emit(); res(r); }, 300));
        }
        if (!('geolocation' in navigator)) return Promise.resolve('unknown');
        return new Promise(res => {
          navigator.geolocation.getCurrentPosition(() => { lok(true); denied = false; emit(); res('granted'); }, err => {
            if (err && err.code === 1) { denied = true; lok(false); emit(); res('denied'); return; }
            lok(true); denied = false; emit();
            res(err && err.code === 2 ? 'off' : 'granted');   // 時間切れ（3）は、許可はできている
          }, { enableHighAccuracy: false, maximumAge: Infinity, timeout: 15000 });
        });
      },
      _ok() { if (!lok()) lok(true); if (denied) { denied = false; emit(); } },
      _denied() { if (!api && !denied) { denied = true; lok(false); emit(); } }
    };
    return P;
  })();

  window.Clock = Clock;
  window.Geo = Geo;
  window.GeoPerm = GeoPerm;
})();
