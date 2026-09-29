/* 初回ガイド（コーチマーク）─ 使い回せる部品
   Guide.run(id, steps, { force }) → Promise（終わったら／スキップしたら解決）
     steps: [{ el, text, title?, before?, after? }]
       el     … セレクタ・要素・要素の配列・それらを返す関数。見つからない／見えないときはその項目を飛ばす（配列なら、それぞれを照らす）
       before … 項目を出す前に呼ぶ（スクロールなど。Promise を返してもよい）
       after  … 次の項目へ進む前・スキップしたときに呼ぶ
       link   … { label, go } 札にボタンを足す。押すと案内を終えて（見た記録を残して）go を呼ぶ
   一度最後まで見るかスキップしたら、端末に記録して次からは出さない（force で見直し）。
   opt.skip … 「スキップ」の代わりの文言（例：「閉じる」） */
(() => {
  'use strict';
  const KEY = id => 'guide:' + id;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* 記録できなくても続行 */ } }
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let running = null;

  const resolveEls = el => {
    const v = typeof el === 'function' ? el() : el;
    const arr = (Array.isArray(v) ? v : [v]).flatMap(x => typeof x === 'string' ? [document.querySelector(x)] : [x]);
    return arr.filter(x => x && x.isConnected && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
  };
  const rectOf = els => {
    const rs = els.map(e => e.getBoundingClientRect());
    const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return { left: l, top: t, width: r - l, height: b - t, right: r, bottom: b };
  };
  const inView = r => r.top >= 60 && r.bottom <= innerHeight - 70;

  async function waitIdle() {
    /* ほかのシート（家族を選ぶ など）が開いているあいだは待つ */
    for (let i = 0; i < 80 && document.querySelector('.sheet-bg'); i++) await sleep(250);
  }

  function run(id, steps, opt = {}) {
    if (!opt.force && ls.get(KEY(id))) return Promise.resolve(false);
    if (running) running.stop(false);
    return new Promise(async done => {
      await waitIdle();
      const root = document.createElement('div');
      root.className = 'gd'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '使い方の案内');
      root.innerHTML = '<svg class="gd-dim" aria-hidden="true"><path fill-rule="evenodd"/></svg><div class="gd-holes" aria-hidden="true"></div><div class="gd-tip" role="document"><p class="gd-count num"></p><p class="gd-title"></p><p class="gd-text"></p><button class="gd-link" type="button" hidden></button><div class="gd-btns"><button class="gd-skip" type="button"></button><button class="gd-next" type="button">次へ</button></div></div>';
      const dim = root.querySelector('.gd-dim path'), holes = root.querySelector('.gd-holes'), tip = root.querySelector('.gd-tip');
      root.querySelector('.gd-skip').textContent = opt.skip || 'スキップ';
      let i = -1, cur = null, stopped = false, els = [];
      const list = steps.slice();
      const place = () => {
        if (!els.length) return;
        const pad = 6, rs = els.map(e => e.getBoundingClientRect());
        /* 画面を暗くして、要素ごとに穴をあける（角丸の四角） */
        const rr = (x, y, w, h, k) => `M${x + k} ${y}h${w - 2 * k}a${k} ${k} 0 0 1 ${k} ${k}v${h - 2 * k}a${k} ${k} 0 0 1 ${-k} ${k}h${-(w - 2 * k)}a${k} ${k} 0 0 1 ${-k} ${-k}v${-(h - 2 * k)}a${k} ${k} 0 0 1 ${k} ${-k}z`;
        dim.setAttribute('d', `M0 0H${innerWidth}V${innerHeight}H0z` + rs.map(q => rr(q.left - pad, q.top - pad, q.width + pad * 2, q.height + pad * 2, Math.min(12, (q.height + pad * 2) / 2))).join(''));
        while (holes.children.length < rs.length) holes.appendChild(document.createElement('div')).className = 'gd-hole';
        [...holes.children].forEach((h, k) => { const q = rs[k]; h.hidden = !q; q && Object.assign(h.style, { left: q.left - pad + 'px', top: q.top - pad + 'px', width: q.width + pad * 2 + 'px', height: q.height + pad * 2 + 'px' }); });
        /* 説明の札は、照らした要素のどれにも重ならない場所へ（下 → 上 の順。まとまっていれば全体の下・上を先に試す） */
        const u = rectOf(els), tw = Math.min(320, innerWidth - 24);
        tip.style.width = tw + 'px';
        const th = tip.offsetHeight, P = pad + 12;
        const bases = (u.height <= 200 ? [u] : []).concat(rs);
        const hit = (x, y) => rs.some(q => x < q.right + pad && q.left - pad < x + tw && y < q.bottom + pad && q.top - pad < y + th);
        let best = null;
        for (const r of bases) {
          for (const y of [r.bottom + P, r.top - P - th]) {
            if (y < 8 || y + th > innerHeight - 8) continue;
            for (const x of [r.left + r.width / 2 - tw / 2, 12, innerWidth - tw - 12].map(v => Math.max(12, Math.min(innerWidth - tw - 12, v)))) {
              if (!hit(x, y)) { best = [x, y]; break; }
            }
            if (best) break;
          }
          if (best) break;
        }
        if (!best) { const r = bases[0]; best = [Math.max(12, Math.min(innerWidth - tw - 12, r.left + r.width / 2 - tw / 2)), Math.max(8, Math.min(innerHeight - th - 8, r.bottom + P <= innerHeight - th - 8 ? r.bottom + P : r.top - P - th))]; }
        Object.assign(tip.style, { left: best[0] + 'px', top: best[1] + 'px' });
      };
      const finish = async (all) => {
        if (stopped) return; stopped = true;
        try { cur && cur.after && await cur.after(); } catch { /* noop */ }
        ls.set(KEY(id), '1');
        root.remove(); removeEventListener('resize', place); removeEventListener('scroll', place, true); document.removeEventListener('keydown', onKey);
        running = null; done(all);
      };
      const next = async () => {
        try { cur && cur.after && await cur.after(); } catch { /* noop */ }
        cur = null;
        for (i++; i < list.length; i++) {
          const s = list[i];
          try { s.before && await s.before(); } catch { /* noop */ }
          if (stopped) return;
          els = resolveEls(s.el);
          if (!els.length) continue;
          cur = s;
          const r = rectOf(els);
          if (!inView(r)) {
            /* 全体が収まるならまとめて真ん中に、収まらなければ最初の要素を真ん中に */
            if (r.height < innerHeight - 140) scrollBy(0, r.top - (innerHeight - r.height) / 2);
            else els[0].scrollIntoView({ block: 'center', behavior: 'auto' });
            await sleep(80);
          }
          const rest = list.slice(i + 1).some(x => resolveEls(x.el).length || x.before);
          tip.querySelector('.gd-count').textContent = `${i + 1} / ${list.length}`;
          tip.querySelector('.gd-title').textContent = s.title || '';
          tip.querySelector('.gd-title').hidden = !s.title;
          tip.querySelector('.gd-text').textContent = s.text;
          tip.querySelector('.gd-next').textContent = rest ? '次へ' : 'はじめる';
          const lk = tip.querySelector('.gd-link'); lk.hidden = !s.link; lk.textContent = s.link ? s.link.label : '';
          place();
          tip.querySelector('.gd-next').focus({ preventScroll: true });
          return;
        }
        finish(true);
      };
      const onKey = e => { if (e.key === 'Escape') finish(false); };
      root.addEventListener('click', e => {
        if (e.target.closest('.gd-link')) { const go = cur && cur.link && cur.link.go; finish(true).then(() => go && go()); }
        else if (e.target.closest('.gd-skip')) finish(false);
        else if (e.target.closest('.gd-next')) next();
      });
      /* 案内中は、下の画面を触っても何も起きないようにする（スクロールはできる） */
      root.addEventListener('touchmove', e => { if (!e.target.closest('.gd-tip')) e.preventDefault(); }, { passive: false });
      document.addEventListener('keydown', onKey);
      addEventListener('resize', place); addEventListener('scroll', place, true);
      document.body.appendChild(root);
      running = { stop: finish };
      next();
    });
  }
  window.Guide = { run, seen: id => !!ls.get(KEY(id)), reset: id => { try { localStorage.removeItem(KEY(id)); } catch { /* noop */ } }, active: () => !!running, stop: () => running && running.stop(false) };
})();
