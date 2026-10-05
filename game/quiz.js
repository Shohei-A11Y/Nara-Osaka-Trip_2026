/* 新幹線クイズ ─ しおりとは別の1ページ（game/）
   問題は quiz.json（章ごとに10問。章を足せば問題が増える）。
   記録はこの端末だけ（localStorage の 'quiz'。使えないときは開いている間だけ）：
     best[章]  ＝ 最高の正解数と、そのときの時間（正解数が同じなら速い方）
     prog[章]  ＝ 途中の続き（何問目まで・正誤・かかった時間）。1問ずつ保存するので、閉じても続きから
     wrong     ＝ 間違えた問題の id（復習で正解すると消える）
     clear[章] ＝ 最後まで解いた章。全章そろうとお祝い（控えめ。点滅・音なし）
   かかった時間は、問題の画面を開いているあいだだけ数える（画面を閉じている時間は数えない） */
(() => {
  'use strict';
  const V = 38;
  const KEY = 'quiz';
  const TYPE = { choice: '4択', fill: '穴埋め', order: '並べ替え', match: '組み合わせ', map: '地図当て' };
  const app = document.getElementById('app');

  /* ---------- 保存（使えないときは開いている間だけ） ---------- */
  let mem = null;
  const blank = () => ({ dir: 'go', best: {}, prog: {}, wrong: [], clear: {}, celeSeen: false });
  function load() {
    if (mem) return mem;
    try { mem = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { mem = blank(); }
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* 保存できなくても続ける */ } }

  /* ---------- 小さな道具 ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return m ? `${m}分${String(s % 60).padStart(2, '0')}秒` : `${s}秒`; };
  const CIRC = '①②③④⑤⑥⑦⑧⑨⑩';

  let DATA = null, QS = {};
  const chapters = () => DATA.chapters;
  const chById = id => chapters().find(c => c.id === id);
  /* 行きの順：①②③④⑤／帰りの順：④③②①⑤（⑤ 全国はいつも最後）。問題は同じ */
  function ordered(dir) {
    const local = chapters().filter(c => c.id !== 'k5'), rest = chapters().filter(c => c.id === 'k5');
    return [...(dir === 'back' ? local.slice().reverse() : local), ...rest];
  }

  /* ========== 章の一覧 ========== */
  function home() {
    stopClock();
    const s = load();
    const allClear = chapters().every(c => s.clear[c.id]);
    const firstCele = allClear && !s.celeSeen;
    if (firstCele) { s.celeSeen = true; save(); }
    const wrongN = s.wrong.filter(id => QS[id]).length;
    app.innerHTML = `
      <section class="hero"><h1><small>SHINKANSEN QUIZ</small>新幹線クイズ</h1>
        <p>乗っている区間ごとに、10問ずつ。選んで答える、ゆるいクイズです。時間の制限はありません。</p></section>
      ${allClear ? `<div class="cele" role="status"><span class="cele-seal" aria-hidden="true">祝</span><div><b>全章クリア、おめでとうございます</b><p>${chapters().length}章すべてを解き終えました。間違えた問題の復習も、どうぞ。</p></div></div>` : ''}
      <div class="seg" role="group" aria-label="章の並べ方">
        <button type="button" data-dir="go" aria-pressed="${s.dir !== 'back'}">行きの順</button>
        <button type="button" data-dir="back" aria-pressed="${s.dir === 'back'}">帰りの順</button>
      </div>
      <p class="seg-note">${s.dir === 'back' ? '新大阪 → 博多 → 武雄温泉の順に並べています。' : '武雄温泉 → 博多 → 新大阪の順に並べています。'}全国の新幹線の章は、いつも最後です。</p>
      <div class="chs">${ordered(s.dir).map(chCard).join('')}</div>
      <button type="button" class="review" data-review ${wrongN ? '' : 'disabled'}>間違えた問題だけ復習（${wrongN}問）</button>
      <p class="foot">答えのあとに、一言の解説と出典（2つ以上）を出します。問題の内容は ${esc(DATA.checked.replace(/-/g, '/'))} に確かめたものです（数字や記録は、変わることがあります）。<br>
        記録はこの端末だけに残ります。<br><a href="../">‹ しおりへ戻る</a></p>`;
    app.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => { s.dir = b.dataset.dir; save(); home(); }));
    app.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => start(b.dataset.ch, false)));
    app.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', () => start(b.dataset.restart, true)));
    const rv = app.querySelector('[data-review]');
    if (rv) rv.addEventListener('click', () => startReview());
    if (!firstCele) window.scrollTo(0, 0);
  }
  function chCard(c) {
    const s = load(), b = s.best[c.id], p = s.prog[c.id];
    const st = p && p.res.length < p.ids.length
      ? `<span class="go">続きから（${p.res.length + 1}問目）</span>`
      : b ? `最高 <b>${b.score}/${b.n}</b>・${fmtTime(b.time)}` : 'まだ解いていません';
    return `<div class="ch-wrap"><button type="button" class="ch${s.clear[c.id] ? ' done' : ''}" data-ch="${c.id}">
        <span class="ch-no" aria-hidden="true">${c.no}</span>
        <span><span class="ch-t">${esc(c.name)}</span><span class="ch-s">${esc(c.sub)}・${c.qs.length}問</span><span class="ch-st">${st}</span></span></button>
      ${p && p.res.length && p.res.length < p.ids.length ? `<button type="button" class="ch-restart" data-restart="${c.id}">はじめからやり直す</button>` : ''}</div>`;
  }

  /* ========== 解く ========== */
  let cur = null;          // { key, title, ids }
  let clockAt = 0;         // 問題の画面を開いた時刻（0＝止まっている）
  function tick() { if (!cur || !clockAt) return; const p = load().prog[cur.key]; if (p) { p.t += Date.now() - clockAt; save(); } clockAt = Date.now(); }
  function stopClock() { tick(); clockAt = 0; }
  function startClock() { clockAt = Date.now(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopClock(); else if (cur && app.querySelector('[data-answer]')) startClock(); });
  window.addEventListener('pagehide', stopClock);

  function start(chId, fresh) {
    const s = load(), c = chById(chId);
    if (fresh || !s.prog[chId] || s.prog[chId].res.length >= s.prog[chId].ids.length) s.prog[chId] = { ids: c.qs.map(q => q.id), res: [], t: 0 };
    save();
    cur = { key: chId, title: `${CIRC[c.no - 1] || c.no} ${c.name}` };
    question();
  }
  function startReview() {
    const s = load();
    if (!s.prog.review || s.prog.review.res.length >= s.prog.review.ids.length) {
      const ids = s.wrong.filter(id => QS[id]);
      if (!ids.length) return home();
      s.prog.review = { ids, res: [], t: 0 };
      save();
    }
    cur = { key: 'review', title: '間違えた問題の復習' };
    question();
  }

  function question() {
    const s = load(), p = s.prog[cur.key];
    if (!p || p.res.length >= p.ids.length) return result();
    const i = p.res.length, q = QS[p.ids[i]];
    if (!q) { p.res.push(null); save(); return question(); }
    const tags = [TYPE[q.type], q.tag].filter(Boolean);
    app.innerHTML = `
      <div class="qhead"><button type="button" class="qquit" data-quit>‹ 章の一覧</button><span class="qch">${esc(cur.title)}</span><span class="qnum">${i + 1}<small> / ${p.ids.length}</small></span></div>
      <div class="qbar" aria-hidden="true"><i style="width:${(i / p.ids.length) * 100}%"></i></div>
      <div class="qtags">${tags.map(t => `<span class="tag${t === '読み' ? ' t-yomi' : t === '車窓' ? ' t-mado' : ''}">${esc(t)}</span>`).join('')}</div>
      <p class="qtext">${q.type === 'fill' ? esc(q.q).replace('＿＿', '<span class="blank" data-blank>？</span>') : esc(q.q)}</p>
      <div data-body></div>
      <button type="button" class="go-btn" data-answer disabled>答える</button>
      <div data-fb></div>`;
    app.querySelector('[data-quit]').addEventListener('click', () => { stopClock(); cur = null; home(); });
    const body = app.querySelector('[data-body]'), btn = app.querySelector('[data-answer]');
    const ui = BUILD[q.type](q, body, ready => { btn.disabled = !ready; });
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      stopClock();
      const ok = ui.judge();
      record(q, ok);
      btn.remove();
      feedback(q, ok, ui);
    });
    window.scrollTo(0, 0);
    startClock();
  }

  function record(q, ok) {
    const s = load(), p = s.prog[cur.key];
    p.res.push(ok);
    if (ok) s.wrong = s.wrong.filter(id => id !== q.id);
    else if (!s.wrong.includes(q.id)) s.wrong.push(q.id);
    save();
  }

  function feedback(q, ok, ui) {
    const s = load(), p = s.prog[cur.key], last = p.res.length >= p.ids.length;
    const el = app.querySelector('[data-fb]');
    el.innerHTML = `<div class="fb ${ok ? 'ok' : 'ng'}" role="status">
        <p class="fb-h"><span class="fb-mark" aria-hidden="true">${ok ? '○' : '×'}</span>${ok ? '正解！' : 'ざんねん'}</p>
        ${ok ? '' : `<div class="fb-ans">${ui.answerHtml()}</div>`}
        <p class="fb-ex">${esc(q.ex)}</p>
        <ul class="fb-src">${q.src.map(([n, u]) => `<li>出典：<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul>
      </div>
      <button type="button" class="go-btn sub" data-next>${last ? '結果を見る' : '次の問題へ'}</button>`;
    el.querySelector('[data-next]').addEventListener('click', question);
    el.querySelector('.fb').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ========== 結果 ========== */
  function result() {
    stopClock();
    const s = load(), p = s.prog[cur.key];
    const score = p.res.filter(Boolean).length, n = p.ids.length;
    let best = false;
    if (cur.key !== 'review') {
      const b = s.best[cur.key];
      if (!b || score > b.score || (score === b.score && p.t < b.time)) { s.best[cur.key] = { score, n, time: p.t }; best = !!b; }
      s.clear[cur.key] = true;
    }
    delete s.prog[cur.key];
    save();
    const allClear = chapters().every(c => s.clear[c.id]);
    app.innerHTML = `
      <section class="res"><h2>${esc(cur.title)}</h2>
        <p class="res-score">${score}<small> / ${n} 問正解</small></p>
        <p class="res-time">かかった時間　${fmtTime(p.t)}</p>
        ${best ? '<p class="res-best">自己ベストを更新</p>' : ''}
      </section>
      <ol class="res-list">${p.ids.map((id, i) => QS[id] ? `<li><span class="${p.res[i] ? 'o' : 'x'}">${p.res[i] ? '○' : '×'}</span><span>${esc(QS[id].q.replace('＿＿', '（　）'))}</span></li>` : '').join('')}</ol>
      ${s.wrong.filter(id => QS[id]).length ? `<button type="button" class="review" data-review>間違えた問題だけ復習（${s.wrong.filter(id => QS[id]).length}問）</button>` : ''}
      <button type="button" class="go-btn sub" data-home>${allClear && !s.celeSeen ? '章の一覧へ（お知らせがあります）' : '章の一覧へ'}</button>`;
    const rv = app.querySelector('[data-review]');
    if (rv) rv.addEventListener('click', () => startReview());
    app.querySelector('[data-home]').addEventListener('click', () => { cur = null; home(); });
    window.scrollTo(0, 0);
  }

  /* ========== 問題の形ごとの画面 ==========
     BUILD[形](問題, 置き場所, 答えられるか(ready) を知らせる関数) → { judge(): 正解か, answerHtml(): 不正解のときに出す正しい答え } */
  const BUILD = {
    /* 4択：選んでから「答える」（揺れで押し間違えても選び直せる） */
    choice(q, el, ready) { return pick(q, el, ready, shuffle(q.opts.map((t, i) => ({ t, i }))), false); },
    /* 穴埋め：数字は小さい順のまま2列に */
    fill(q, el, ready) {
      const num = q.opts.every(o => /^[\d.]+$/.test(o));
      return pick(q, el, ready, num ? q.opts.map((t, i) => ({ t, i })) : shuffle(q.opts.map((t, i) => ({ t, i }))), num);
    },
    order(q, el, ready) {
      let list = shuffle(q.items);
      for (let k = 0; k < 9 && same(list, q.items); k++) list = shuffle(q.items);
      const draw = (moved = -1) => {
        el.innerHTML = `<p class="qhint">▲▼で動かして、上から順に並べます。</p>
          <ol class="ord">${list.map((t, i) => `<li${i === moved ? ' class="moved"' : ''}><span class="n">${i + 1}</span><span class="t">${esc(t)}</span>
            <button type="button" data-up="${i}" aria-label="${esc(t)}を上へ" ${i === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" data-dn="${i}" aria-label="${esc(t)}を下へ" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></li>`).join('')}</ol>`;
        el.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(i - 1); focusBtn('up', i - 1); }));
        el.querySelectorAll('[data-dn]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.dn; [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(i + 1); focusBtn('dn', i + 1); }));
      };
      const focusBtn = (k, i) => { const b = el.querySelector(`[data-${k}="${i}"]`) || el.querySelector(`[data-${k === 'up' ? 'dn' : 'up'}="${i}"]`); if (b && !b.disabled) b.focus({ preventScroll: true }); };
      draw();
      ready(true);
      return {
        judge() {
          el.querySelectorAll('.ord li').forEach((li, i) => { li.classList.add(list[i] === q.items[i] ? 'ok' : 'ng'); li.querySelectorAll('button').forEach(b => { b.disabled = true; }); });
          return same(list, q.items);
        },
        answerHtml: () => `正しい順：<ol>${q.items.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
      };
    },
    match(q, el, ready) {
      const left = q.pairs.map(p => p[0]), right = shuffle(q.pairs.map(p => p[1]));
      const sel = left.map(() => null);   // 左の行ごとに選んだ右の札（right の番号）
      let at = 0, done = false;
      const draw = () => {
        el.innerHTML = `<p class="qhint">左の行を選んでから、下の札を押します（選び直しもできます）。</p>
          <div class="mrows">${left.map((l, i) => `<button type="button" class="mrow" data-row="${i}" aria-current="${!done && i === at}">
            <span class="l">${esc(l)}</span><span class="r${sel[i] !== null ? ' filled' : ''}">${sel[i] !== null ? esc(right[sel[i]]) : 'ここに入る札を選ぶ'}</span></button>`).join('')}</div>
          <p class="mlabel">札</p>
          <div class="chips">${right.map((r, j) => { const u = sel.indexOf(j); return `<button type="button" class="chip${u >= 0 ? ' is-used' : ''}" data-chip="${j}">${u >= 0 ? `<span class="used" aria-label="${u + 1}行目に使用中">${u + 1}</span>` : ''}<span>${esc(r)}</span></button>`; }).join('')}</div>`;
        el.querySelectorAll('[data-row]').forEach(b => b.addEventListener('click', () => { if (done) return; at = +b.dataset.row; draw(); }));
        el.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => {
          if (done) return;
          const j = +b.dataset.chip, was = sel.indexOf(j);
          if (was >= 0) sel[was] = null;     // ほかの行で使っていた札は、そちらから外す
          sel[at] = j;
          const next = sel.findIndex(v => v === null);
          if (next >= 0) at = next;
          draw();
          ready(sel.every(v => v !== null));
        }));
      };
      draw();
      return {
        judge() {
          done = true;
          const oks = left.map((l, i) => right[sel[i]] === q.pairs[i][1]);
          draw();
          el.querySelectorAll('.mrow').forEach((r, i) => { r.classList.add(oks[i] ? 'ok' : 'ng'); r.setAttribute('aria-current', 'false'); r.disabled = true; });
          el.querySelectorAll('.chip').forEach(c => { c.disabled = true; });
          return oks.every(Boolean);
        },
        answerHtml: () => `正しい組み合わせ：<ul>${q.pairs.map(([l, r]) => `<li>${esc(l)} ─ ${esc(r)}</li>`).join('')}</ul>`
      };
    },
    map(q, el, ready) {
      el.innerHTML = `<div class="mapbox" data-map></div>`;
      drawMap(q, el.querySelector('[data-map]'));
      const box = document.createElement('div');
      el.appendChild(box);
      return pick(q, box, ready, shuffle(q.opts.map((t, i) => ({ t, i }))), false);
    }
  };

  /* 選択肢から1つ選ぶ（4択・穴埋め・地図当て） */
  function pick(q, el, ready, opts, num) {
    let chosen = null;
    el.insertAdjacentHTML('beforeend', `<div class="opts${num ? ' num' : ''}">${opts.map(o => `<button type="button" class="opt" data-o="${o.i}" aria-pressed="false">${esc(o.t)}</button>`).join('')}</div>`);
    const bs = [...el.querySelectorAll('[data-o]')];
    bs.forEach(b => b.addEventListener('click', () => {
      chosen = +b.dataset.o;
      bs.forEach(x => x.setAttribute('aria-pressed', x === b));
      const bl = app.querySelector('[data-blank]');
      if (bl) bl.textContent = q.opts[chosen];
      ready(true);
    }));
    return {
      judge() {
        bs.forEach(b => { const i = +b.dataset.o; b.disabled = true; if (i === q.a) b.classList.add('ok'); else if (i === chosen) b.classList.add('ng'); });
        const bl = app.querySelector('[data-blank]');
        if (bl) bl.textContent = q.opts[q.a];
        return chosen === q.a;
      },
      answerHtml: () => `正解は「${esc(q.opts[q.a])}」`
    };
  }

  /* ---------- 地図当ての図：同梱の線路（GeoJSON）と駅の位置から描く。地図のタイルは使わない ---------- */
  const lines = {};
  function loadLine(key) {
    if (!lines[key]) lines[key] = fetch(DATA.maps[key].url).then(r => r.json()).then(g => g.features[0].geometry.coordinates).catch(() => null);
    return lines[key];
  }
  function drawMap(q, box) {
    const m = DATA.maps[q.line], st = m.st;
    const names = Object.keys(st);
    // 見せる範囲：view の2駅のあいだ（ないときは全部）
    let shown = names;
    if (q.view) { const a = names.indexOf(q.view[0]), b = names.indexOf(q.view[1]); shown = names.slice(Math.min(a, b), Math.max(a, b) + 1); }
    const lat0 = shown.reduce((s, n) => s + st[n][0], 0) / shown.length, kx = Math.cos(lat0 * Math.PI / 180);
    const xs = shown.map(n => st[n][1] * kx), ys = shown.map(n => -st[n][0]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // 細長くなりすぎないように、短い方の辺をのばす（縦横比 0.5〜1.1）
    let w = x1 - x0, h = y1 - y0;
    const minH = w * 0.5, maxH = w * 1.1;
    if (h < minH) { y0 -= (minH - h) / 2; h = minH; }
    if (h > maxH) { const nw = h / 1.1; x0 -= (nw - w) / 2; w = nw; }
    const pad = Math.max(w, h) * 0.12;
    x0 -= pad; y0 -= pad; w += pad * 2; h += pad * 2;
    const W = 1000, H = Math.round(W * h / w), sx = W / w;
    const P = (lat, lon) => [((lon * kx - x0) * sx).toFixed(1), ((-lat - y0) * sx).toFixed(1)];
    const dots = shown.map(n => { const [x, y] = P(...st[n]); return n === q.mark
      ? `<circle class="mk1" cx="${x}" cy="${y}" r="30"/><circle class="mk2" cx="${x}" cy="${y}" r="13"/><text class="q" x="${x}" y="${(+y - 44).toFixed(1)}" text-anchor="middle">？</text>`
      : `<circle class="st" cx="${x}" cy="${y}" r="11"/>`; }).join('');
    // 駅名の文字は、となりの駅と反対の向きに置く（となりの駅の名前と見まちがえないように）
    const labels = (q.labels || []).map(n => {
      const [x, y] = P(...st[n]).map(Number), k = names.indexOf(n);
      const nb = names[k + 1] && shown.includes(names[k + 1]) ? names[k + 1] : names[k - 1];
      const [nx, ny] = P(...st[nb]).map(Number), len = Math.hypot(x - nx, y - ny) || 1;
      const ux = (x - nx) / len, uy = (y - ny) / len;
      const tx = x + ux * 42, ty = y + uy * 42 + 12;
      return `<text class="lb" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${ux > 0.4 ? 'start' : ux < -0.4 ? 'end' : 'middle'}">${esc(n)}</text>`;
    }).join('');
    const M = 130;   // 左右の余白（端の駅の名前が切れないように）
    const svg = path => `<svg viewBox="${-M} 0 ${W + M * 2} ${H}" role="img" aria-label="${esc(m.name)}の線路の図。◎の印が付いた駅を当てる">${path}${dots}${labels}<text class="north" x="${W + M - 24}" y="44" text-anchor="end">↑北</text></svg>
      <p class="mapnote">線路：© OpenStreetMap contributors</p>`;
    box.innerHTML = svg('');
    loadLine(q.line).then(co => {
      if (!co || !box.isConnected) return;
      const d = 'M' + co.map(([lon, lat]) => P(lat, lon).join(',')).join('L');
      box.innerHTML = svg(`<path class="ln" d="${d}"/>`);
    });
  }

  /* ---------- はじまり ---------- */
  fetch(`quiz.json?v=${V}`).then(r => r.json()).then(d => {
    DATA = d;
    chapters().forEach(c => c.qs.forEach(q => { QS[q.id] = q; }));
    home();
  }).catch(() => { app.innerHTML = '<p class="pad">問題を読み込めませんでした。電波のある所で、もう一度開いてください（一度開くと、次からは電波がなくても遊べます）。<br><a href="../">‹ しおりへ戻る</a></p>'; });

  /* 電波がなくても遊べるように、しおりと同じ保存の仕組み（sw.js）を使う。しおりかクイズを一度開けば保存される */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
})();
