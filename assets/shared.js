/* 全員で共有する状態（assets/shared.json）：作る人（管理者）が1回入れたら、家族全員のしおりにも出す
   仕組みは予算（assets/budget.js）と同じ。管理者の端末に保存したトークンで、公開側の shared.json を書き換え、全員の端末が読む。
   トークンは予算の管理ページ（#/kanri）で保存したものを、そのまま使う（新しく作らない。リポジトリには入れない）。

   shared.json の形（どれも任意。無ければ項目なし。数KBに収める）
     { rev: 書き込むたびに1つ増える番号, updatedAt: 最後に書いた日時,
       shift:  { here: いまここ／時刻を直す（app.js の getShift と同じ {date, i, min, at, alt?}）,
                 alt:  { 列車: 別の便に乗った（sim.js の AltRide と同じ {name, dep, car, seat, at}） } },
       rain:   { 日付: 雨の日に選んだ候補の id },
       meals:  { '日付:dinner': { shop: 店の id, rsv: 予約した（true／false） } },
       notice: { text: 連絡の一言, at: 書いた日時 },
       stamps: { スタンプの id: 押した日時 } }
   名前・家族の情報は入れない（場所・列車・時刻・番号だけ）。予約番号・QR・合言葉も入れない。

   読む側（全員）：画面が見えているあいだ約60秒おき・画面に戻ったとき・電波が戻ったときに取りに行く（?v= は付けない。sw.js は予算と同じ扱い）。
     取れないときは、最後に取れた内容（この端末に保存）を使い続ける。rev が変わったときだけ知らせる。
   書く側（トークンのある端末だけ）：put で「変更」を貯め、1.5秒待ってまとめて送る（連打は1回に）。送るときは毎回、公開側の最新を読み直して、その上に重ねる。
     先を越された（409／422）ときは、読み直して1回だけやり直す。おためし中は書かない（作り物の場面は端末だけ）。
   その端末の自分の値（localStorage）があれば、そちらが優先（各画面の側で mix・same を使って重ねる）。 */
(() => {
  'use strict';
  const FILE = 'assets/shared.json';
  const REPO = 'Shohei-A11Y/Nara-Osaka-Trip_2026', BRANCH = 'main';
  const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const TOKEN = 'kanri:token';     // 予算の管理ページで保存したトークン（budget.js と同じ置き場所）
  const K = { last: 'share:last', remote: 'share:remote', ops: 'share:ops' };
  const POLL = 60e3, WAIT = 1500;
  const ls = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続行 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  };
  const num = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const valid = d => d && typeof d === 'object' && !Array.isArray(d) && Number.isFinite(Number(d.rev));
  const clone = o => JSON.parse(JSON.stringify(o));
  const token = () => String(ls.get(TOKEN) || '');
  const sim = () => !!(window.Clock && Clock.active());
  const subs = new Set();
  const emit = what => subs.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });

  /* ---------- 読む ---------- */
  let pages = ls.get(K.last);      // { data, at }：公開しているファイルから最後に取れたもの（at は最後に取れた時刻）
  let remote = ls.get(K.remote);   // { data, sha, at }：管理者の端末が GitHub から最後に読んだ（書いた）もの。公開ページへの反映は1〜2分遅れるので、こちらが新しいことがある
  if (pages && !valid(pages.data)) pages = null;
  if (remote && !valid(remote.data)) remote = null;
  /* いま使う共有の内容：公開ページのものと、管理者の端末が書いたもののうち、rev の大きい方 */
  function data() {
    const p = pages && pages.data, r = token() && remote ? remote.data : null;
    if (!r) return p || null;
    if (!p) return r;
    return num(r.rev) >= num(p.rev) ? r : p;
  }
  let loading = null;
  function load() {
    if (loading) return loading;
    const before = data();
    loading = fetch(FILE, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then(d => {
      if (!valid(d)) throw new Error('bad');
      pages = { data: d, at: Date.now() }; ls.set(K.last, pages);
      const after = data();
      if (!before || num(before.rev) !== num(after.rev) || before.updatedAt !== after.updatedAt) emit('data');
      else emit('status');
      return d;
    }).catch(() => data()).finally(() => { loading = null; });
    return loading;
  }
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  setInterval(() => { if (visible() && navigator.onLine !== false) load(); }, POLL);
  document.addEventListener('visibilitychange', () => { if (visible()) { load(); retry(); } });
  addEventListener('online', () => { load(); retry(); });

  /* 共有の値を1つ取り出す（path は ['shift', 'alt', 'nozomi28'] のような道順） */
  function get(path) {
    let v = data();
    for (const k of path) { if (!v || typeof v !== 'object') return undefined; v = v[k]; }
    return v === undefined ? undefined : clone(v);
  }

  /* ---------- 重ねる（各画面で使う小道具） ----------
     mix：共有の値（地図）に、その端末の自分の値を重ねる。自分の値が null なら「この端末では無し」として消す
     same：同じ内容か（並び順は問わない） */
  function mix(shared, local) {
    const out = Object.assign({}, shared || {});
    Object.entries(local || {}).forEach(([k, v]) => { if (v === null || v === false) delete out[k]; else out[k] = v; });
    return out;
  }
  const norm = v => (v && typeof v === 'object' ? Array.isArray(v) ? v.map(norm) : Object.keys(v).sort().reduce((o, k) => (v[k] === undefined ? o : (o[k] = norm(v[k]), o)), {}) : v ?? null);
  const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

  /* ---------- 書く（管理者の端末だけ） ---------- */
  const pending = () => { const o = ls.get(K.ops, []); return Array.isArray(o) ? o : []; };
  /* 変更を、ある時点の共有の内容に重ねる。{ p: 道順, v: 値（null で消す） } か { reset: true }（初期化） */
  function applyOps(d0, ops) {
    let d = clone(valid(d0) ? d0 : { rev: 0, updatedAt: null });
    (ops || []).forEach(op => {
      if (op.reset) { d = { rev: num(d.rev), updatedAt: d.updatedAt || null }; return; }
      const p = Array.isArray(op.p) ? op.p : []; if (!p.length) return;
      const chain = [d];
      for (let i = 0; i < p.length - 1; i++) { const o = chain[i]; if (!o[p[i]] || typeof o[p[i]] !== 'object') o[p[i]] = {}; chain.push(o[p[i]]); }
      const last = chain[chain.length - 1], k = p[p.length - 1];
      if (op.v === null || op.v === undefined) delete last[k]; else last[k] = clone(op.v);
      /* 空になった入れ物は残さない（容量を小さく保つ） */
      for (let i = chain.length - 1; i > 0; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][p[i - 1]];
    });
    return d;
  }
  const b64 = s => { const u = new TextEncoder().encode(s); let t = ''; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(t); };
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0)));
  const stamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T') + '+09:00';
  async function gh(method, tok, body) {
    let res;
    try {
      res = await fetch(API + (method === 'GET' ? `?ref=${BRANCH}` : ''), { method, cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch { throw Object.assign(new Error('通信できませんでした'), { kind: 'net' }); }
    let j = null; try { j = await res.json(); } catch { /* 本文なし */ }
    if (!res.ok) {
      const s = res.status, kind = s === 401 ? 'auth' : s === 403 ? 'perm' : s === 404 ? 'notfound' : s === 409 || s === 422 ? 'conflict' : 'http';
      throw Object.assign(new Error((j && j.message) || String(s)), { kind, status: s });
    }
    return j;
  }
  /* 公開側の shared.json を GitHub から直接読む（まだ無ければ、最初の形から作る） */
  async function readRemote(tok = token()) {
    let j;
    try { j = await gh('GET', tok); }
    catch (e) { if (e.kind === 'notfound') return { data: { rev: 0, updatedAt: null }, sha: null }; throw e; }
    let d = null; try { d = JSON.parse(unb64(j.content)); } catch { /* 下で */ }
    if (!valid(d)) d = { rev: 0, updatedAt: null };
    remote = { data: d, sha: j.sha, at: Date.now() }; ls.set(K.remote, remote);
    return remote;
  }
  let busy = null, lastErr = null, lastSent = null, soon = 0;
  function flush() {
    if (busy) return busy;
    const tok = token(), ops = pending();
    if (!tok || !ops.length) return Promise.resolve({ sent: 0 });
    if (navigator.onLine === false) { lastErr = { kind: 'offline' }; note(false); emit('status'); return Promise.resolve({ sent: 0, offline: true }); }
    busy = (async () => {
      emit('status');
      for (let k = 0; k < 2; k++) {                       // 先を越されたら、読み直して1回だけやり直す
        const cur = await readRemote(tok);
        const next = applyOps(cur.data, ops);
        next.rev = num(cur.data.rev) + 1; next.updatedAt = stamp();
        try {
          const j = await gh('PUT', tok, { message: `共有の状態を更新（しおりから・変更${ops.length}件）`, content: b64(JSON.stringify(next, null, 1) + '\n'), ...(cur.sha ? { sha: cur.sha } : {}), branch: BRANCH });
          ls.set(K.ops, pending().slice(ops.length));        // 送っているあいだに足された変更は残す
          remote = { data: next, sha: j && j.content ? j.content.sha : null, at: Date.now() }; ls.set(K.remote, remote);
          lastErr = null; lastSent = { at: Date.now(), n: ops.length, rev: next.rev };
          return { sent: ops.length };
        } catch (e) { if (e.kind !== 'conflict' || k) throw e; }
      }
      return { sent: 0 };
    })().then(r => { note(true); return r; }, e => { lastErr = { kind: e.kind || 'http', msg: e.message, status: e.status }; note(false); return { sent: 0, error: lastErr }; })
      .finally(() => {
        busy = null; emit('data'); emit('status');
        if (!lastErr && token() && pending().length) setTimeout(flush, 0);
      });
    emit('status');
    return busy;
  }
  /* 電波が戻った・画面に戻ったとき：通信の失敗で送れなかった変更だけ、もう一度送る（トークンの不具合は、管理ページで直してから） */
  const retry = () => { if (token() && pending().length && (!lastErr || ['net', 'offline', 'http', 'conflict'].includes(lastErr.kind))) flush(); };
  /* 書けた・書けなかったの一言（画面の下に小さく。既存の操作の知らせとは別に出す） */
  function note(ok) {
    emit(ok ? 'sent' : 'failed');
    if (typeof document === 'undefined' || !document.body) return;
    document.querySelectorAll('.snote').forEach(x => x.remove());
    const el = document.createElement('div');
    el.className = 'snote' + (ok ? '' : ' ng'); el.setAttribute('role', 'status');
    el.textContent = ok ? '全員に共有しました' : '端末だけに保存しました（電波・トークンを確かめて）';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ok ? 2600 : 4200);
  }
  /* 共有にも書く。書く端末（トークンあり・おためし中でない）なら true（呼んだ側は、その端末の値もいつもどおり保存する） */
  function put(path, v) {
    if (sim() || !token()) return false;
    const ops = pending(); ops.push({ p: path, v: v === undefined ? null : v, at: Date.now() }); ls.set(K.ops, ops);
    clearTimeout(soon); soon = setTimeout(flush, WAIT);
    return true;
  }
  /* 全員の値を消す（初期化）：shared.json を最初の形に戻す。貯めていた変更も捨てる */
  function reset() {
    if (sim() || !token()) return false;
    ls.set(K.ops, [{ reset: true, at: Date.now() }]);
    clearTimeout(soon); flush();
    return true;
  }

  window.Shared = {
    FILE,
    data, get, load, mix, same, applyOps,
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    /* 書ける端末か（共有に書く入口は、この端末にだけ出す） */
    writer: () => !!token() && !sim(),
    put, reset, flush,
    status: () => ({ busy: !!busy, err: lastErr, sent: lastSent, n: pending().length, online: navigator.onLine !== false, fetchedAt: pages ? pages.at : null })
  };
  load();
  if (token() && pending().length) setTimeout(flush, 1500);     // 開いたときに、前に送れなかった変更があれば送る
})();
