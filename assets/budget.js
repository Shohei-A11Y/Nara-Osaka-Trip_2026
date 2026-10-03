/* 予算（assets/budget.json）：読み込みと計算
   合計・グラフ・家族ごとの内訳・明細の小計は、budget.json の各項目から毎回計算する（手書きの合計は持たない）。

   budget.json の形
     { v: 1, rev: 更新のたびに1つ増える番号, updated: 最後に直した日時,
       people: { iizuka: { 大人: 2, 子ども: 2 }, yamaguchi: { 大人: 2, 子ども: 0 } },   // 「人数で按分」に使う人数
       groups: [ { id, name: 分類の名前, note: 明細の注記, famNote: 家族ごとの内訳の説明,
                   rows: [ 項目 ] } ] }
   項目
     { id, name: 項目名,
       calc: { pre: 前に付ける言葉, parts: [{ who: '大人'|'子ども'|''（人数を書かない）, n: 人数, unit: 単価, times: 回数, per: '日' など }], post: 後ろに付ける言葉 }
             → 内訳の文（例「早得7／大人4名@3,400・子ども2名@1,700」）と金額（人数×単価×回数の合計）を自動で作る
       または memo: 内訳の文（自由に書く）, amount: 金額,
       split: 'people'（人数で按分）| 'half'（2家族で折半）| 'iizuka'（飯塚家のみ）| 'yamaguchi'（山口家のみ）,
       actual: 実際に払った額（決算。未入力は書かない）, payer: 立て替えた家族（'iizuka'|'yamaguchi'）,
       extra: true なら予定外の出費（予算は0円。決算だけに出る） }

   人数で按分：内訳の「大人」の行は大人の人数（飯塚家2・山口家2）、「子ども」の行は子どもの人数（飯塚家2・山口家0）で分ける。
              人数を書かない行・自由に書いた内訳は、全員の人数（飯塚家4・山口家2）で分ける。
   家族ごとの額は項目ごとに円に丸め（飯塚家を四捨五入、山口家は残り）、それを足し上げる。
   決算の家族ごとの額は、その項目の予算の分け方の割合を、実際に払った額にかけて出す（予算が0円の項目は分担ルールの割合）。

   予約番号・QR・合言葉は扱わない */
(() => {
  'use strict';
  const FAMS = ['iizuka', 'yamaguchi'];
  const SPLITS = { people: '人数で按分', half: '2家族で折半', iizuka: '飯塚家のみ', yamaguchi: '山口家のみ' };
  const num = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const fmt = n => Math.round(n).toLocaleString('ja-JP');
  const hasVal = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

  /* ---------- 内訳と金額 ---------- */
  const partAmount = p => num(p.n) * num(p.unit) * (num(p.times) > 1 ? num(p.times) : 1);
  const partText = p => `${p.who ? `${p.who}${num(p.n)}名` : ''}@${fmt(num(p.unit))}${num(p.times) > 1 ? `×${num(p.times)}${p.per || ''}` : ''}`;
  const calcText = c => [c.pre, (c.parts || []).map(partText).join('・')].filter(Boolean).join('／') + (c.post || '');
  const rowAmount = r => (r.extra ? 0 : r.calc ? (r.calc.parts || []).reduce((s, p) => s + partAmount(p), 0) : num(r.amount));
  const rowText = r => (r.calc ? calcText(r.calc) : r.memo || '');

  /* ---------- 家族ごとの分け方 ---------- */
  const headcount = (P, f, cat) => (cat ? num((P[f] || {})[cat]) : Object.values(P[f] || {}).reduce((a, b) => a + num(b), 0));
  function ratio(P, cat) {
    const t = FAMS.reduce((s, f) => s + headcount(P, f, cat), 0);
    if (!t) return cat ? ratio(P, '') : { iizuka: 0.5, yamaguchi: 0.5 };
    return { iizuka: headcount(P, 'iizuka', cat) / t, yamaguchi: headcount(P, 'yamaguchi', cat) / t };
  }
  /* 丸める前の家族ごとの額 */
  function exact(r, P, a = rowAmount(r)) {
    if (r.split === 'half') return { iizuka: a / 2, yamaguchi: a / 2 };
    if (r.split === 'iizuka') return { iizuka: a, yamaguchi: 0 };
    if (r.split === 'yamaguchi') return { iizuka: 0, yamaguchi: a };
    const parts = r.calc && !r.extra && (r.calc.parts || []).length ? r.calc.parts.map(p => [partAmount(p), p.who === '大人' || p.who === '子ども' ? p.who : '']) : [[a, '']];
    const out = { iizuka: 0, yamaguchi: 0 };
    parts.forEach(([pa, cat]) => { const q = ratio(P, cat); out.iizuka += pa * q.iizuka; out.yamaguchi += pa * q.yamaguchi; });
    return out;
  }
  const rounded = (iz, a) => { const i = Math.round(iz); return { iizuka: i, yamaguchi: a - i }; };
  const shares = (r, P) => { const a = rowAmount(r); return rounded(exact(r, P, a).iizuka, a); };
  function actualShares(r, P) {
    const a = rowAmount(r), x = Math.round(num(r.actual));
    const q = a > 0 ? exact(r, P, a).iizuka / a : exact({ split: r.split }, P, 1).iizuka;
    return rounded(x * q, x);
  }

  /* ---------- まとめて計算 ---------- */
  function compute(d) {
    const P = (d && d.people) || {};
    const z = () => ({ iizuka: 0, yamaguchi: 0 });
    const add = (o, s) => { o.iizuka += s.iizuka; o.yamaguchi += s.yamaguchi; };
    const R = { total: 0, fam: z(), groups: [], act: { total: 0, fam: z(), rows: 0, extra: 0, extraRows: 0, todo: 0, budgetOfDone: 0 }, settle: { paid: z(), owe: z(), rows: 0, noPayer: 0, net: 0 } };
    ((d && d.groups) || []).forEach(g => {
      const G = { id: g.id, name: g.name || '', note: g.note || '', famNote: g.famNote || '', sum: 0, fam: z(), asum: 0, afam: z(), rows: [] };
      (g.rows || []).forEach(r => {
        const amount = rowAmount(r), sh = r.extra ? z() : shares(r, P), has = hasVal(r.actual);
        const x = { ...r, amount, text: rowText(r), sh, has, actual: has ? Math.round(num(r.actual)) : null, ash: has ? actualShares(r, P) : null };
        G.rows.push(x);
        if (!r.extra) { G.sum += amount; add(G.fam, sh); }
        if (has) {
          G.asum += x.actual; add(G.afam, x.ash); R.act.rows++;
          if (r.extra) { R.act.extra += x.actual; R.act.extraRows++; } else R.act.budgetOfDone += amount;
          if (FAMS.includes(r.payer)) { R.settle.paid[r.payer] += x.actual; add(R.settle.owe, x.ash); R.settle.rows++; } else R.settle.noPayer++;
        } else if (!r.extra) R.act.todo++;
      });
      R.total += G.sum; add(R.fam, G.fam); R.act.total += G.asum; add(R.act.fam, G.afam);
      R.groups.push(G);
    });
    /* 精算：プラスなら山口家 → 飯塚家、マイナスなら飯塚家 → 山口家 */
    R.settle.net = Math.round(R.settle.paid.iizuka - R.settle.owe.iizuka);
    return R;
  }

  /* ---------- 読み込み ----------
     家族の端末：assets/budget.json（ネットワーク優先。圏外のときは、サービスワーカーかこの端末に残した最後の値）。 */
  const ls = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続行 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  };
  const FILE = 'assets/budget.json';
  let pages = ls.get('budget:last');      // { data, at }：公開しているファイルから最後に読めたもの
  let loading = null;
  const subs = new Set();
  const emit = what => subs.forEach(fn => { try { fn(what); } catch { /* noop */ } });
  const valid = d => d && typeof d === 'object' && Array.isArray(d.groups);
  function load() {
    if (loading) return loading;
    loading = fetch(FILE, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then(d => {
      if (!valid(d)) throw new Error('bad');
      const changed = !pages || JSON.stringify(pages.data) !== JSON.stringify(d);
      pages = { data: d, at: Date.now() }; ls.set('budget:last', pages);
      if (changed) emit('data');
      return d;
    }).catch(() => (pages ? pages.data : null)).finally(() => { loading = null; });
    return loading;
  }

  /* ---------- 管理ページ：公開リポジトリの budget.json を、GitHub のトークンで直す ----------
     トークン（公開リポジトリ1つ・Contents の読み書きだけ）は、管理する人の端末の localStorage にだけ置く。リポジトリには入れない。
     直した内容は「変更」（ops）として端末に貯め、送るときは毎回、公開側の最新を読み直してから、その上に変更を重ねて書き込む
     （ほかの端末が先に直していても、上書きで消さない）。圏外のあいだは貯めておき、つながったら送る。
     書き込みのあいだに先を越されたとき（GitHub が 409／422 を返す）は、もう一度読み直してやり直す */
  const REPO = 'Shohei-A11Y/Nara-Osaka-Trip_2026', BRANCH = 'main';
  const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const K = { token: 'kanri:token', ops: 'kanri:ops', remote: 'kanri:remote' };
  const token = () => ls.get(K.token) || '';
  const pending = () => { const o = ls.get(K.ops, []); return Array.isArray(o) ? o : []; };
  let remote = ls.get(K.remote);     // { data, sha, at }：GitHub から最後に読んだ（または書いた）もの
  let busy = null, lastErr = null, lastSent = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const order = (list, ids) => { const by = new Map(list.map(x => [x.id, x])), out = ids.filter(id => by.has(id)).map(id => by.get(id)); return out.concat(list.filter(x => !ids.includes(x.id))); };
  /* 変更を、ある時点の予算に重ねる。g：分類を足す・直す／gdel：分類を消す（中の項目も）／gord：分類の並び
     r：項目を足す・直す（v は項目まるごと。別の分類を指せば移す）／rdel：項目を消す／rord：分類の中の並び */
  function applyOps(d0, ops) {
    const d = clone(d0 || { v: 1, rev: 0, people: {}, groups: [] });
    d.groups = Array.isArray(d.groups) ? d.groups : [];
    const findRow = id => { for (const g of d.groups) { const i = (g.rows || []).findIndex(r => r.id === id); if (i >= 0) return [g, i]; } return [null, -1]; };
    const group = (id, name) => { let g = d.groups.find(x => x.id === id); if (!g && name !== undefined) { g = { id, name, note: '', famNote: '', rows: [] }; d.groups.push(g); } return g; };
    (ops || []).forEach(op => {
      if (op.t === 'g') { const g = group(op.g, (op.v && op.v.name) || ''); ['name', 'note', 'famNote'].forEach(k => { if (op.v && op.v[k] !== undefined) g[k] = String(op.v[k]); }); }
      else if (op.t === 'gdel') d.groups = d.groups.filter(x => x.id !== op.g);
      else if (op.t === 'gord') d.groups = order(d.groups, op.ids || []);
      else if (op.t === 'r' && op.v && op.v.id) {
        const tg = group(op.g, op.gname || '');      // 分類が先に消されていたら、同じ名前で作り直して入れる（項目を失わない）
        const [g, i] = findRow(op.v.id);
        if (g === tg) g.rows[i] = clone(op.v);
        else { if (g) g.rows.splice(i, 1); (tg.rows = tg.rows || []).push(clone(op.v)); }
      }
      else if (op.t === 'rdel') { const [g, i] = findRow(op.r); if (g) g.rows.splice(i, 1); }
      else if (op.t === 'rord') { const g = d.groups.find(x => x.id === op.g); if (g) g.rows = order(g.rows || [], op.ids || []); }
    });
    return d;
  }
  /* 見せる予算：家族の端末は公開しているファイル。管理する端末は、GitHub から直接読んだ方が新しければそちら（公開ページへの反映は1〜2分遅れる）に、まだ送っていない変更を重ねたもの */
  function base() {
    const p = pages, r = token() ? remote : null;
    if (!r || !valid(r.data)) return p ? p.data : null;
    if (!p) return r.data;
    return num(r.data.rev) > num(p.data.rev) || (num(r.data.rev) === num(p.data.rev) && r.at >= p.at) ? r.data : p.data;
  }
  const data = () => { const b = base(), o = token() ? pending() : []; return b && o.length ? applyOps(b, o) : b; };

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
  /* 公開側の budget.json を GitHub から直接読む（公開ページの反映待ちがない、いちばん新しいもの） */
  async function readRemote(tok = token()) {
    const j = await gh('GET', tok);
    let d = null; try { d = JSON.parse(unb64(j.content)); } catch { /* 下で */ }
    if (!valid(d)) throw Object.assign(new Error('公開側の budget.json を読めませんでした'), { kind: 'bad' });
    remote = { data: d, sha: j.sha, at: Date.now() }; ls.set(K.remote, remote);
    return remote;
  }
  function flush() {
    if (busy) return busy;
    const tok = token(), ops = pending();
    if (!tok || !ops.length) return Promise.resolve({ sent: 0 });
    if (navigator.onLine === false) { lastErr = { kind: 'offline' }; emit('status'); return Promise.resolve({ sent: 0, offline: true }); }
    const seen = remote ? num(remote.data.rev) : null;     // この端末が最後に見た公開側の版
    busy = (async () => {
      emit('status');
      for (let k = 0; k < 4; k++) {
        const cur = await readRemote(tok);                 // 送る前に、公開側の最新を読み直す
        const next = applyOps(cur.data, ops);
        next.rev = num(cur.data.rev) + 1; next.updated = stamp();
        try {
          const j = await gh('PUT', tok, { message: `予算を更新（しおりの管理ページから・変更${ops.length}件）`, content: b64(JSON.stringify(next, null, 2) + '\n'), sha: cur.sha, branch: BRANCH });
          ls.set(K.ops, pending().slice(ops.length));      // 送っているあいだに足された変更は残す
          remote = { data: next, sha: j && j.content ? j.content.sha : null, at: Date.now() }; ls.set(K.remote, remote);
          lastErr = null; lastSent = { at: Date.now(), n: ops.length, rev: next.rev, reread: seen !== null && num(cur.data.rev) > seen };
          return { sent: ops.length };
        } catch (e) { if (e.kind !== 'conflict') throw e; }   // 読み直してから書くまでに、先に更新された → もう一度
      }
      throw Object.assign(new Error('何度か続けて先に更新されたため、送れませんでした'), { kind: 'conflict' });
    })().catch(e => { lastErr = { kind: e.kind || 'http', msg: e.message, status: e.status }; return { sent: 0, error: lastErr }; })
      .finally(() => {
        busy = null; emit('data'); emit('status');
        if (!lastErr && token() && pending().length) setTimeout(flush, 0);     // 送っているあいだに足された変更も続けて送る
      });
    emit('status');
    return busy;
  }
  /* 変更を貯めて、少し待ってから送る（分類を作って項目を足す、のように続けて直したときは、1回にまとめて送る） */
  let soon = 0;
  function queue(op) {
    const ops = pending(); ops.push({ ...op, at: Date.now() }); ls.set(K.ops, ops);
    emit('data'); clearTimeout(soon); soon = setTimeout(flush, 400);
  }
  const newId = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  if (typeof addEventListener === 'function') {
    addEventListener('online', () => { if (token() && pending().length) flush(); });
    document.addEventListener && document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && token() && pending().length) flush(); });
  }

  window.Budget = {
    FAMS, SPLITS, compute, rowAmount, rowText, partText, partAmount, calcText, shares, actualShares, applyOps,
    data, load, ready: () => !!data(),
    view: () => (data() ? compute(data()) : null),
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    admin: {
      REPO, FILE,
      has: () => !!token(),
      async setToken(t) { t = String(t || '').trim(); await readRemote(t); ls.set(K.token, t); emit('data'); return true; },
      clearToken() { ls.del(K.token); ls.del(K.remote); remote = null; emit('data'); },
      pending, queue, flush, newId,
      async refresh() { try { await readRemote(); lastErr = null; } catch (e) { lastErr = { kind: e.kind || 'http', msg: e.message, status: e.status }; } emit('data'); emit('status'); },
      status: () => ({ busy: !!busy, err: lastErr, sent: lastSent, online: navigator.onLine !== false, remote: remote ? { rev: num(remote.data.rev), updated: remote.data.updated || '', at: remote.at } : null, n: pending().length })
    }
  };
  if (token() && pending().length) setTimeout(flush, 1500);     // 開いたときに、前に送れなかった変更があれば送る
})();
