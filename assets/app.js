(() => {
  'use strict';
  const T = window.TRIP;
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');

  /* ---------- 保存（使えない環境でも動くように） ---------- */
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続行 */ } }
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* noop */ } }
  };

  /* ---------- 時刻 ---------- */
  const jst = (date, hm) => new Date(`${date}T${hm}:00+09:00`);
  const demoParam = new URLSearchParams(location.search).get('t');
  if (demoParam) session.set('demoT', demoParam);
  const now = () => { const d = session.get('demoT'); return d ? new Date(d.length <= 16 ? d + ':00+09:00' : d) : new Date(); };
  const fmtHM = d => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  const ymd = d => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const yen = n => '¥' + n.toLocaleString('ja-JP');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gmap = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  /* ---------- アイコン ---------- */
  const I = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8"/>',
    train: '<path d="M4 15.5C4 9 7 5 14 5h2c3 0 4.5 2 4.5 5.5V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-1.5z"/><path d="M14 5v5h6.3M4.3 12H10M7 21l2-4M17 21l-2-4"/>',
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6 3 3v3M9 12l1-4 4 1 2 3 3 1M10 8l-3 2-1 3"/>',
    metro: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".8"/><circle cx="15" cy="14" r=".8"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v2H3zM7 11h10"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
    seat: '<path d="M7 3v9a2 2 0 0 0 2 2h7M7 14l-1 7M17 14v7M7 10h8a2 2 0 0 1 2 2v2"/>',
    sos: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    bento: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M12 11v8M8 3.5h8"/>'
  };
  const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  /* 挿絵（手描き風） */
  const DEER = `<svg class="deer" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 14l-4-8M30 14l-8-2M30 14l2-9M44 14l4-8M44 14l8-2M44 14l-2-9"/><path d="M28 18c0-3 4-5 9-5s9 2 9 5l-2 12c-1 4-4 6-7 6s-6-2-7-6z" fill="#e8a37a"/><path d="M26 20l-6 2M48 20l6 2"/><circle cx="33" cy="24" r="1.2" fill="#3d3a36" stroke="none"/><circle cx="41" cy="24" r="1.2" fill="#3d3a36" stroke="none"/><path d="M35 36c-2 6-2 10 0 14h20c6 0 9-4 9-9v-3" fill="#e8a37a"/><path d="M38 50v14M52 50v14M60 46v18M42 50v14"/></g><g fill="#fff"><circle cx="46" cy="42" r="1.6"/><circle cx="53" cy="41" r="1.6"/><circle cx="58" cy="44" r="1.6"/></g></svg>`;
  const TRAIN_ART = `<svg class="train" viewBox="0 0 140 50" aria-hidden="true"><path d="M4 38h118c8 0 14-5 14-10 0-6-10-12-26-14L70 10H10a6 6 0 0 0-6 6z" fill="#fff"/><path d="M4 30h128" stroke="#2f6f8f" stroke-width="3"/><path d="M96 14l14 2c4 1 6 3 6 5H96z" fill="#2f6f8f"/><g fill="#9cc3d5"><rect x="16" y="17" width="10" height="7" rx="2"/><rect x="32" y="17" width="10" height="7" rx="2"/><rect x="48" y="17" width="10" height="7" rx="2"/><rect x="64" y="17" width="10" height="7" rx="2"/></g><path d="M0 44h140" stroke="#fff" stroke-width="2" stroke-dasharray="6 5"/></svg>`;
  const PIN = `<svg class="trainpin" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#e0605e"/><path d="M7 16c0-4 2-7 7-7h1c2 0 4 1.5 4 4.5V16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" fill="#fff"/><path d="M14 9v4h5" stroke="#e0605e" stroke-width="1.4" fill="none"/></svg>`;

  /* ---------- 家族 ---------- */
  const fam = () => store.get('fam');
  const famName = () => (T.families[fam()] || {}).name || '家族を選ぶ';

  /* ---------- 旅程のイベント化 ---------- */
  function events(day) {
    const out = [];
    if (!day.items) return out;
    day.items.forEach((it, i) => {
      if (it.t === 'stop') {
        const a = it.arr || it.dep, b = it.dep || it.arr;
        out.push({ i, start: jst(day.date, a), end: jst(day.date, b === a && it.kind !== 'goal' ? b : b), it, day });
      } else {
        const prev = day.items[i - 1], next = day.items[i + 1];
        out.push({ i, start: jst(day.date, prev.dep || prev.arr), end: jst(day.date, next.arr || next.dep), it, day });
      }
    });
    return out;
  }
  function allEvents() { return T.days.flatMap(events); }
  function currentEvent(t = now()) {
    const ev = allEvents();
    let cur = null, next = null;
    for (const e of ev) {
      if (e.start <= t && t < e.end) cur = e;
      if (!next && e.start > t && e.it.t === 'stop') next = e;
    }
    if (!cur) { // 停車の瞬間（到着時刻＝出発時刻）も拾う
      cur = ev.find(e => e.it.t === 'stop' && +e.start === +t) || null;
    }
    return { cur, next };
  }
  const phase = () => { const t = now(); return t < new Date(T.start) ? 'before' : t > new Date(T.end) ? 'after' : 'during'; };

  /* ---------- 共通UI ---------- */
  function sheet(html, onMount) {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="close" aria-label="閉じる">×</button>${html}</div>`;
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('.close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
    onMount && onMount(bg, close);
    return close;
  }

  function pickFamily(first = false) {
    const cur = fam();
    sheet(`<h3>${first ? 'ようこそ！' : '家族を切り替える'}</h3>
      <p class="muted small">選んだ家族の座席・お部屋・チェックインQRを表示します。あとからいつでも変えられます。</p>
      <div class="fam-pick">${Object.entries(T.families).map(([k, f]) =>
        `<button data-f="${k}" class="${cur === k ? 'on' : ''}"><span><b>${f.name}</b><br><span class="muted small">${f.label}</span></span><span aria-hidden="true">${cur === k ? '✓' : '›'}</span></button>`).join('')}</div>`,
      (el, close) => el.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { store.set('fam', b.dataset.f); close(); render(); })));
  }

  function roomsFor(f) { return Object.entries(T.hotel.rooms).filter(([, r]) => r.family === f); }
  function showQR() {
    const f = fam();
    if (!f) return pickFamily(true);
    const today = ymd(now());
    const rooms = roomsFor(f);
    let idx = rooms.findIndex(([, r]) => r.from <= today && today < r.to);
    if (idx < 0) idx = 0;
    const tabs = rooms.length > 1 ? `<div class="segtabs">${rooms.map(([, r], i) => `<button data-i="${i}" class="${i === idx ? 'on' : ''}">${r.nights}</button>`).join('')}</div>` : '';
    const body = i => { const [k, r] = rooms[i]; return `<div class="qrbox"><img src="assets/qr/${k}.svg" alt="チェックイン用QRコード"><div class="code">${r.code}</div></div>
      <p style="margin:0"><b>${r.no} ${esc(r.name)}</b></p><p class="muted small" style="margin:2px 0 0">${r.nights}・${r.size}・${esc(r.bed)}</p>`; };
    sheet(`<h3>自動チェックインQR</h3><p class="muted small" style="margin:0">${T.families[f].name}｜フロント端末にかざしてください。画面を明るくすると読み取りやすくなります。</p>${tabs}<div class="qr-body">${body(idx)}</div>`,
      el => el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
        el.querySelectorAll('[data-i]').forEach(x => x.classList.toggle('on', x === b));
        el.querySelector('.qr-body').innerHTML = body(+b.dataset.i);
      })));
  }

  function demoSheet() {
    const presets = [
      ['いまの時刻に戻す', ''],
      ['10/17 10:30 かもめ乗車中', '2026-10-17T10:30'],
      ['10/17 12:05 博多で乗り換え', '2026-10-17T12:05'],
      ['10/17 13:37 のぞみ・福山の手前', '2026-10-17T13:37'],
      ['10/17 16:45 大阪駅でおさんぽ', '2026-10-17T16:45'],
      ['10/20 11:25 のぞみ・姫路の手前', '2026-10-20T11:25'],
      ['10/20 18:00 旅行のあと', '2026-10-20T18:00']
    ];
    sheet(`<h3>時間旅行（お試し）</h3><p class="muted small">時刻を変えて、旅行中の画面を先に体験できます。この設定は、このタブを閉じると元に戻ります。</p>
      <div class="fam-pick">${presets.map(([l, v]) => `<button data-t="${v}"><span>${l}</span><span>›</span></button>`).join('')}</div>`,
      (el, close) => el.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { session.set('demoT', b.dataset.t || null); close(); render(); })));
  }

  function demoBar() {
    const d = session.get('demoT');
    const old = $('.demo-bar'); old && old.remove();
    if (!d) return;
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = `時間旅行中：${now().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })} <button>戻す</button>`;
    bar.querySelector('button').onclick = () => { session.set('demoT', null); render(); };
    document.body.appendChild(bar);
  }

  /* ---------- ホーム ---------- */
  function statusCard() {
    const t = now(), ph = phase();
    if (ph === 'before') {
      const ms = new Date(T.start) - t;
      const days = Math.floor(ms / 864e5), hrs = Math.floor(ms % 864e5 / 36e5), mins = Math.floor(ms % 36e5 / 6e4);
      const prepStart = new Date('2026-09-17T00:00:00+09:00');
      const pct = Math.max(4, Math.min(100, (t - prepStart) / (new Date(T.start) - prepStart) * 100));
      return `<section class="card status lift reveal">
        <div class="label hand">出発まで、あと</div>
        <div class="count"><span class="big num" id="cd-d">${days}</span><span class="unit">日</span></div>
        <div class="count-sub num"><span><b id="cd-h">${hrs}</b> 時間</span><span><b id="cd-m">${mins}</b> 分</span></div>
        <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <div class="small muted">10/17（土）10:22 新大村駅から出発！</div></section>`;
    }
    if (ph === 'after') {
      return `<section class="card status lift reveal"><div class="hand" style="font-size:26px">おかえりなさい</div>
        <p class="muted small" style="margin:6px 0 0">楽しい旅になりましたか？ 旅程や思い出はいつでも見返せます。</p></section>`;
    }
    const { cur, next } = currentEvent(t);
    const row = (badge, e, cls = '') => {
      if (!e) return '';
      const it = e.it;
      const title = it.t === 'stop' ? it.name : `${it.line} で移動中`;
      const time = it.t === 'stop' ? [it.arr && `${it.arr}着`, it.dep && `${it.dep}発`].filter(Boolean).join('・') : `${fmtHM(e.start)} → ${fmtHM(e.end)}（${it.min}分）`;
      return `<div class="now-row"><span class="now-badge ${cls}">${badge}</span><div><div class="now-title">${esc(title)}</div><div class="now-meta">${time}</div></div></div>`;
    };
    const dayN = T.days.find(d => d.date === ymd(t));
    const live = cur && cur.it.train && cur.it.train.startsWith('nozomi') ? `<div class="btn-row"><a class="btn primary sm" href="#/ride/live/${cur.it.train}">${ic('train')} のぞみはいまどのへん？</a></div>` : '';
    return `<section class="card now-card lift reveal">
      <div class="small muted" style="margin-bottom:8px"><span class="pulse"></span>&nbsp; ${dayN ? `${dayN.n}日目・${dayN.label}（${dayN.dow}）` : ''} ${fmtHM(t)} 現在</div>
      ${cur ? row('いま', cur) : '<div class="now-row"><span class="now-badge">いま</span><div><div class="now-title">自由時間</div><div class="now-meta">詳しい予定は旅程タブで</div></div></div>'}
      <hr class="dots">${next ? row('つぎ', next, 'next') : '<div class="small muted">今日の予定はここまで。おつかれさまでした！</div>'}
      ${live}
      <div class="btn-row"><a class="btn sm" href="#/trip/${dayN ? dayN.n : 1}">${ic('route')} 今日の旅程を見る</a></div></section>`;
  }

  const WMO = c => c === 0 ? ['☀️', '晴れ'] : c <= 2 ? ['🌤️', '晴れ時々くもり'] : c === 3 ? ['☁️', 'くもり'] : c <= 48 ? ['🌫️', '霧'] : c <= 67 ? ['🌧️', '雨'] : c <= 77 ? ['🌨️', '雪'] : c <= 82 ? ['🌦️', 'にわか雨'] : ['⛈️', '雷雨'];
  async function loadWeather(el) {
    const place = { 1: ['大阪', 34.73, 135.50], 2: ['奈良', 34.685, 135.84], 3: ['大阪', 34.69, 135.50], 4: ['大阪', 34.73, 135.50] };
    try {
      const res = await Promise.all(['osaka', 'nara'].map(k => {
        const [lat, lon] = k === 'nara' ? [34.685, 135.84] : [34.70, 135.50];
        return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&start_date=2026-10-17&end_date=2026-10-20`).then(r => r.ok ? r.json() : Promise.reject(r.status));
      }));
      const [osaka, nara] = res;
      el.innerHTML = `<div class="weather">${T.days.map((d, i) => {
        const src = d.n === 2 ? nara : osaka; const dd = src.daily;
        const [e, label] = WMO(dd.weather_code[i]);
        return `<div class="w"><div>${d.label}（${d.dow}）</div><div class="e" title="${label}">${e}</div><b><span class="hi">${Math.round(dd.temperature_2m_max[i])}°</span>/<span class="lo">${Math.round(dd.temperature_2m_min[i])}°</span></b><div class="muted">☂${dd.precipitation_probability_max[i] ?? '-'}%・${place[d.n][0]}</div></div>`;
      }).join('')}</div><p class="small muted" style="margin:8px 0 0">予報：Open-Meteo（2日目は奈良、それ以外は大阪）</p>`;
    } catch {
      el.innerHTML = `<div class="weather">${T.days.map(d => `<div class="w"><div>${d.label}（${d.dow}）</div><div class="e">🍁</div><div class="muted">予報まち</div></div>`).join('')}</div>
        <p class="small muted" style="margin:8px 0 0">出発の約2週間前（10/2ごろ）から、大阪・奈良の天気予報が自動で表示されます。</p>`;
    }
  }

  function viewHome() {
    const f = fam();
    return `
    <header class="cover cover-open">
      <button class="chip family-chip" data-act="fam">${ic('seat')} ${esc(famName())} ▾</button>
      <div class="hand" style="font-size:14px;letter-spacing:.2em;opacity:.9">家族旅行</div>
      <h1>しおり</h1>
      <div class="en">Nara / Osaka</div><div class="rule"></div>
      <div class="dates num">2026　10.17（土）〜 10.20（火）</div>
      ${DEER}${TRAIN_ART}
    </header>
    <div class="wrap">
      ${statusCard()}
      <nav class="quick reveal" aria-label="よく使う">
        <button data-act="qr"><span class="qi" style="background:var(--shu-soft);color:var(--shu)">${ic('qr')}</span>チェックイン<br>QR</button>
        <a href="#/ride"><span class="qi" style="background:var(--ai-soft);color:var(--ai)">${ic('seat')}</span>わたしの<br>座席</a>
        <a href="#/trip/${todayDayN()}"><span class="qi" style="background:var(--karashi-soft);color:var(--karashi)">${ic('route')}</span>今日の<br>旅程</a>
        <a href="#/more"><span class="qi" style="background:var(--wakakusa-soft);color:var(--wakakusa)">${ic('sos')}</span>もしもの<br>とき</a>
      </nav>
      <h2 class="tape shu">4日間の旅</h2>
      <p class="sec-lead">日付をタップすると、その日の旅程が開きます。</p>
      <div class="days" style="margin-top:12px">${T.days.map(d => `
        <a class="day-card reveal" href="#/trip/${d.n}"><div class="dn bg-${d.color}"><div><small>${d.n}日目</small><span>${d.label.split('/')[1]}</span></div></div>
        <div style="min-width:0"><div class="dt">${d.label}（${d.dow}）・${d.theme}</div><div class="tt">${esc(d.title)}</div>
        <div class="tags">${d.highlights.map(h => `<span>${esc(h)}</span>`).join('')}</div></div></a>`).join('')}
      </div>
      <h2 class="tape ai">旅先のお天気</h2>
      <div class="card reveal" id="weather"><div class="muted small">読み込み中…</div></div>
      <h2 class="tape green">${f ? T.families[f].name + 'のお部屋' : 'お部屋'}</h2>
      <div class="card reveal">
        <div style="font-weight:700">${esc(T.hotel.name)}</div>
        <div class="small muted">チェックイン ${T.hotel.checkin}／チェックアウト ${T.hotel.checkout}</div>
        ${(f ? roomsFor(f) : Object.entries(T.hotel.rooms)).map(([, r]) => `<hr class="dots"><div><span class="pill">${r.nights}</span> <b>${r.no} ${esc(r.name)}</b><div class="small muted">${r.size}・${esc(r.bed)}</div></div>`).join('')}
        <div class="btn-row"><button class="btn primary sm" data-act="qr">${ic('qr')} チェックインQR</button><a class="btn sm" href="${gmap(T.hotel.name)}" target="_blank" rel="noopener">${ic('map')} 地図</a><a class="btn sm" href="tel:${T.hotel.tel}">${ic('phone')} 電話</a></div>
      </div>
      <p class="foot">試作版です。ごはん・観光・もしも などのページはこれから作ります。<br><button class="btn sm" data-act="demo" style="margin-top:8px">${ic('gear')} 時間旅行で旅行中の画面を試す</button></p>
    </div>`;
  }
  function todayDayN() { const d = T.days.find(x => x.date === ymd(now())); return d ? d.n : 1; }

  function tickCountdown() {
    const el = $('#cd-d'); if (!el) return;
    const ms = new Date(T.start) - now(); if (ms <= 0) return render();
    el.textContent = Math.floor(ms / 864e5); $('#cd-h').textContent = Math.floor(ms % 864e5 / 36e5); $('#cd-m').textContent = Math.floor(ms % 36e5 / 6e4);
  }

  /* ---------- 旅程 ---------- */
  function seatText(trainKey) {
    const f = fam(); const tr = T.trains[trainKey];
    if (!tr) return '';
    const s = f ? T.seats[trainKey][f] : [...T.seats[trainKey].yamaguchi, ...T.seats[trainKey].iizuka];
    return `<span class="seatline">${ic('seat')} ${f ? 'わたしの席' : '6人の席'}：${tr.car}号車 ${s.join('・')}</span>`;
  }
  const modeIcon = m => ({ shinkansen: 'train', train: 'train', metro: 'metro', walk: 'walk', car: 'car' }[m] || 'route');

  function viewTrip(n) {
    const day = T.days.find(d => d.n === n) || T.days[0];
    const t = now();
    const evs = events(day);
    const curIdx = (evs.find(e => e.start <= t && t < e.end) || {}).i;
    const tabs = `<nav class="daytabs" aria-label="日付">${T.days.map(d => `<a href="#/trip/${d.n}" class="${d.color} ${d.n === day.n ? 'on' : ''}">${d.n}日目<b>${d.label}</b></a>`).join('')}</nav>`;
    const head = `<div class="dayhead bg-${day.color}"><span class="th">${day.n}日目・${day.label}（${day.dow}）・${day.theme}</span><h3>${esc(day.title)}</h3><p>${esc(day.route)}</p></div>`;
    if (!day.items) {
      return `<div class="wrap"><div class="phead"><div class="kicker">ITINERARY</div><h2>旅程</h2></div>${tabs}${head}
        <div class="card soon">${DEER.replace('class="deer"', 'style="width:88px;background:var(--day2);border-radius:50%;padding:10px"')}<p><b>この日の旅程は、試作のあとで作ります。</b><br><span class="small">まずは1日目と4日目で、見た目と使い心地を確かめてください。</span></p><a class="btn" href="#/trip/1">1日目を見る</a></div></div>`;
    }
    const color = `var(--${day.color})`;
    const lis = day.items.map((it, i) => {
      const e = evs[i];
      const state = i === curIdx ? 'now' : (e.end <= t && +e.end !== +e.start ? 'done' : '');
      if (it.t === 'stop') {
        const big = !it.minor;
        const time = it.arr && it.dep ? `${it.arr}<small>着</small>${it.dep}<small>発</small>` : it.dep ? `${it.dep}<small>発</small>` : `${it.arr}<small>着</small>`;
        const acts = [
          it.qr ? `<button class="btn primary sm" data-act="qr">${ic('qr')} チェックインQR</button>` : '',
          it.link ? `<a class="btn sm" href="${it.link[1]}">${esc(it.link[0])}</a>` : '',
          it.map ? `<a class="btn sm" href="${gmap(it.map)}" target="_blank" rel="noopener">${ic('map')} 地図</a>` : '',
          it.url ? `<a class="btn sm" href="${it.url}" target="_blank" rel="noopener">${ic('ext')} 公式</a>` : ''
        ].join('');
        return `<li class="${state}" id="it-${i}">${state === 'now' ? '<span class="now-flag">いま</span>' : ''}<div class="stop ${big ? 'big' : 'minor'}" style="--c:${color}">
          <div class="time num">${time}</div><div class="dot"></div>
          <div class="box"><div class="name">${esc(it.name)}</div>${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div></li>`;
      }
      const tr = it.train && T.trains[it.train];
      const extra = [
        tr ? `<div>${tr.kind}・${tr.vehicle}</div>` : '',
        it.detail ? `<div>${esc(it.detail)}</div>` : '',
        it.dist ? `<div>距離 ${it.dist}</div>` : '',
        tr ? `<div class="btn-row" style="margin-top:6px"><a class="btn sm" href="#/ride">座席表を見る</a>${it.link ? `<a class="btn sm primary" href="${it.link[1]}">${esc(it.link[0])}</a>` : ''}<a class="btn sm" href="${tr.timetable}" target="_blank" rel="noopener">${ic('ext')} 最新時刻</a></div>` : ''
      ].join('');
      return `<li class="${state}" id="it-${i}">${state === 'now' ? '<span class="now-flag">いま</span>' : ''}<div class="move">
        <div class="dur num">${it.min >= 60 ? Math.floor(it.min / 60) + '時間' + (it.min % 60 ? (it.min % 60) + '分' : '') : it.min + '分'}</div><div class="mi">${ic(modeIcon(it.mode))}</div>
        <details${tr || state === 'now' ? ' open' : ''}><summary><span>${esc(it.line)}</span>${tr ? seatText(it.train) : ''}</summary><div class="extra">${extra}</div></details></div></li>`;
    }).join('');
    return `<div class="wrap"><div class="phead"><div class="kicker">ITINERARY</div><h2>旅程</h2></div>${tabs}${head}
      <ol class="tl">${lis}</ol>
      <p class="small muted">※移動時間は、子ども連れ・荷物を考えた余裕を含む目安です。</p></div>`;
  }

  /* ---------- のりもの ---------- */
  function seatMap(key) {
    const tr = T.trains[key], f = fam();
    const mine = f ? T.seats[key][f] : [];
    const all = [...T.seats[key].yamaguchi, ...T.seats[key].iizuka];
    const [left, right] = tr.layout.split('|');
    const cell = (r, c) => { const id = `${r}${c}`; return `<span class="seat ${mine.includes(id) ? 'mine' : all.includes(id) ? 'fam' : ''}" aria-label="${id}${mine.includes(id) ? '（わたしの席）' : ''}">${c}</span>`; };
    const winL = left.length === 3 ? 'A 窓側' : 'A 窓側', winR = right.length === 2 ? '窓側 D/E' : '窓側';
    return `<div class="seatmap" role="img" aria-label="${tr.car}号車の座席表">${tr.rows.map(r => `<div class="row"><span class="rn">${r}</span>${[...left].map(c => cell(r, c)).join('')}<span class="aisle"></span>${[...right].map(c => cell(r, c)).join('')}</div>`).join('')}
      <div class="window"><span>◀ ${winL}</span><span>通路</span><span>${tr.layout.endsWith('DE') ? 'E 窓側' : 'D 窓側'} ▶</span></div></div>
      <div class="legend"><span><i style="background:var(--shu)"></i>${f ? T.families[f].name : ''}の席</span><span><i style="background:var(--other)"></i>${f ? 'もう一方の家族' : '予約した席'}</span></div>`;
  }
  function trainCard(key) {
    const tr = T.trains[key], f = fam();
    const mine = f ? T.seats[key][f] : [...T.seats[key].yamaguchi, ...T.seats[key].iizuka];
    return `<article class="card train-card reveal"><div class="thead"><div><div class="tkind">${tr.kind}・${tr.vehicle}</div><div class="tname">${tr.name}</div>
      <div class="ttime num">${tr.from} <b>${tr.dep}</b> → ${tr.to} <b>${tr.arr}</b>（${tr.min >= 60 ? Math.floor(tr.min / 60) + '時間' + (tr.min % 60 ? tr.min % 60 + '分' : '') : tr.min + '分'}）</div></div></div>
      <div class="myseat"><div><div class="car">${f ? 'わたしの席' : '予約した席（6席）'}</div><div class="seats num">${tr.car}号車 ${mine.join('・')}</div></div>${ic('seat', 'ic')}</div>
      ${seatMap(key)}
      <div class="btn-row">${key.startsWith('nozomi') ? `<a class="btn primary sm" href="#/ride/live/${key}">${ic('train')} いまどのへん？</a>` : ''}<a class="btn sm" href="${tr.timetable}" target="_blank" rel="noopener">${ic('ext')} 最新の時刻表</a></div></article>`;
  }

  function viewRide(sub, arg) {
    if (sub === 'live') return viewLive(arg);
    const dir = session.get('dir') || (ymd(now()) >= '2026-10-20' ? 'back' : 'go');
    const keys = Object.keys(T.trains).filter(k => T.trains[k].dir === dir);
    const tf = T.transfers;
    const castles = T.castles.map(c => `<div class="card reveal" style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b>🏯 ${c.name}</b><span class="pill">${c.station}駅</span></div>
      <p class="small" style="margin:4px 0">${esc(c.text)}</p><div class="small"><b style="color:var(--shu)">${dir === 'go' ? c.goSide : c.backSide}の窓</b>（${c.side}）・${dir === 'go' ? c.go : c.back}</div>
      <div class="btn-row"><a class="btn sm" href="${c.url}" target="_blank" rel="noopener">${ic('ext')} 詳しく</a></div></div>`).join('');
    return `<div class="wrap"><div class="phead"><div class="kicker">TRAINS</div><h2>のりもの</h2></div>
      <div class="segtabs" role="tablist"><button data-dir="go" class="${dir === 'go' ? 'on' : ''}">往路 10/17</button><button data-dir="back" class="${dir === 'back' ? 'on' : ''}">復路 10/20</button></div>
      ${!fam() ? `<div class="card small"><b>家族を選ぶと、自分の席だけが光ります。</b><div class="btn-row"><button class="btn primary sm" data-act="fam">家族を選ぶ</button></div></div>` : ''}
      ${keys.map((k, i) => trainCard(k) + (i < 2 ? `<div class="tip"><span class="tg">乗り換え</span><b>${tf[dir === 'go' ? i : 1 - i].at}駅（約${tf[dir === 'go' ? i : 1 - i][dir]}）</b><p>${esc(tf[dir === 'go' ? i : 1 - i].text)}</p></div>` : '')).join('')}
      <h2 class="tape ai">車窓から見える3つの城</h2><p class="sec-lead">福山城は停車中に、三原城跡・姫路城は通過中に見えます（時刻は目安）。</p>${castles}
      <h2 class="tape shu" id="ekiben">博多駅の駅弁ランキング</h2>
      <p class="sec-lead">買うなら2F新幹線改札内コンコース（乗り換え中はここが一番早い）。「食べたい」を押すと、この端末に印が残ります。</p>
      <div class="bento" style="margin-top:14px">${T.ekiben.map(([n, p, d, chk], i) => `<div class="b reveal"><span class="rk">${i + 1}</span><div class="bn">${esc(n)}</div><div class="bp num">${yen(p)}${chk ? ' <span class="small muted">※要確認</span>' : ''}</div><div class="bd">${esc(d)}</div><button class="want ${(store.get('want', [])).includes(n) ? 'on' : ''}" data-want="${esc(n)}">♡ 食べたい</button></div>`).join('')}</div>
      <div class="btn-row"><a class="btn sm" href="${T.ekibenUrl}" target="_blank" rel="noopener">${ic('ext')} 駅弁の最新情報（JR九州）</a></div>
      <p class="small muted">駅の構内図は「JRおでかけネット」の公式ページで確認できます。</p>
      <div class="btn-row"><a class="btn sm" href="https://www.google.com/search?q=%E5%8D%9A%E5%A4%9A%E9%A7%85+%E6%A7%8B%E5%86%85%E5%9B%B3+JR%E3%81%8A%E3%81%A7%E3%81%8B%E3%81%91%E3%83%8D%E3%83%83%E3%83%88" target="_blank" rel="noopener">${ic('ext')} 博多駅 構内図</a><a class="btn sm" href="https://www.google.com/search?q=%E6%96%B0%E5%A4%A7%E9%98%AA%E9%A7%85+%E6%A7%8B%E5%86%85%E5%9B%B3+JR%E3%81%8A%E3%81%A7%E3%81%8B%E3%81%91%E3%83%8D%E3%83%83%E3%83%88" target="_blank" rel="noopener">${ic('ext')} 新大阪駅 構内図</a></div>
    </div>`;
  }

  /* のぞみライブ */
  function liveState(key, t = now()) {
    const tr = T.trains[key]; const date = tr.day === 1 ? '2026-10-17' : '2026-10-20';
    const st = T.nozomiLine[key].map(([name, pref, a, d, stop]) => {
      const arr = jst(date, a || d), dep = jst(date, d || a);
      return { name, pref, arr, dep, stop: !!stop, a, d };
    });
    if (t < st[0].dep) return { st, pos: 0, mode: 'before' };
    const last = st[st.length - 1];
    if (t >= last.arr) return { st, pos: st.length - 1, mode: 'after' };
    for (let i = 0; i < st.length; i++) {
      if (t >= st[i].arr && t < st[i].dep) return { st, pos: i, mode: 'stopped', i };
      if (i < st.length - 1 && t >= st[i].dep && t < st[i + 1].arr) {
        const frac = (t - st[i].dep) / (st[i + 1].arr - st[i].dep);
        return { st, pos: i + frac, mode: 'running', i };
      }
    }
    return { st, pos: 0, mode: 'before' };
  }
  function viewLive(key) {
    if (!T.nozomiLine[key]) key = 'nozomi28';
    const tr = T.trains[key];
    return `<div class="wrap"><div class="phead"><div class="kicker">LIVE</div><h2>${tr.name}はいまどのへん？</h2></div>
      <div class="segtabs"><button data-live="nozomi28" class="${key === 'nozomi28' ? 'on' : ''}">往路 のぞみ28号</button><button data-live="nozomi17" class="${key === 'nozomi17' ? 'on' : ''}">復路 のぞみ17号</button></div>
      <div class="card"><div class="live-head"><div><div class="small muted">${tr.from} ${tr.dep}発 → ${tr.to} ${tr.arr}着</div><b>${seatText(key)}</b></div></div>
      <div id="live-state"></div><div id="live-alert"></div><div id="live-tip"></div>
      <ol class="line" id="line">${T.nozomiLine[key].map(([n, p, a, d, s]) => `<li class="${s ? 'stp' : ''} ${T.castles.some(c => c.station === n) ? 'castle' : ''}"><span class="lt num">${s ? (a && d && a !== d ? `${a}<br>${d}` : a || d) : a + '頃'}</span><span class="ld"></span><span class="ln">${n}</span><span class="lp">${p}</span></li>`).join('')}
      <div class="fill" id="fill"></div>${PIN}</ol>
      <p class="small muted">● 停車駅は公式時刻表の時刻、○ 通過駅は推定時刻（目安）です。実際の運行とはずれることがあります。</p>
      <div class="btn-row"><a class="btn sm" href="${tr.timetable}" target="_blank" rel="noopener">${ic('ext')} 公式の時刻表</a><a class="btn sm" href="#/ride">座席表へ</a></div></div></div>`;
  }
  function updateLive() {
    const line = $('#line'); if (!line) return;
    const key = location.hash.split('/')[3] || 'nozomi28';
    const k = T.nozomiLine[key] ? key : 'nozomi28';
    const tr = T.trains[k];
    const s = liveState(k);
    const lis = [...line.querySelectorAll('li')];
    const center = i => lis[i].offsetTop + lis[i].offsetHeight / 2;
    const i0 = Math.floor(s.pos), fr = s.pos - i0;
    const y = i0 >= lis.length - 1 ? center(lis.length - 1) : center(i0) + (center(i0 + 1) - center(i0)) * fr;
    const pin = line.querySelector('.trainpin'); pin.style.top = y + 'px';
    const fill = $('#fill'); fill.style.top = center(0) + 'px'; fill.style.height = Math.max(0, y - center(0)) + 'px';
    lis.forEach((li, i) => li.classList.toggle('passed', i < s.pos && s.mode !== 'before'));
    const t = now();
    const next = s.st.slice(Math.ceil(s.pos + 1e-6)).find(x => x.stop);
    const mins = d => Math.max(0, Math.round((d - t) / 6e4));
    let big, sub;
    if (s.mode === 'before') { const m = mins(s.st[0].dep); big = `まだ出発前です`; sub = `${tr.from} ${tr.dep}発${m < 24 * 60 ? `（あと${m >= 60 ? Math.floor(m / 60) + '時間' : ''}${m % 60}分）` : ''}`; }
    else if (s.mode === 'after') { big = `${tr.to}に到着しました`; sub = 'おつかれさまでした！'; }
    else if (s.mode === 'stopped') { big = `${s.st[s.i].name}に停車中`; sub = `${fmtHM(s.st[s.i].dep)}に発車します`; }
    else { big = `${s.st[s.i].name} → ${s.st[s.i + 1].name}を走行中`; sub = next ? `次の停車駅は <b>${next.name}</b>（${fmtHM(next.arr)}着・あと${mins(next.arr)}分）` : ''; }
    $('#live-state').innerHTML = `<div class="live-state"><div class="big">${big}</div><div class="sub">${sub}</div></div>`;
    // 城のお知らせ
    const dir = tr.dir;
    const alert = T.castles.map(c => { const st = s.st.find(x => x.name === c.station); if (!st) return ''; const d = (st.arr - t) / 6e4; return d <= 6 && d >= -2 && s.mode !== 'before' && s.mode !== 'after' ? `<div class="castle-alert">🏯 まもなく${c.name}！ ${dir === 'go' ? c.goSide : c.backSide}の窓（${c.side}）をチェック</div>` : ''; }).join('');
    if ($('#live-alert').dataset.v !== alert) { $('#live-alert').innerHTML = alert; $('#live-alert').dataset.v = alert; }
    // 読みもの
    const idx = Math.floor(s.pos);
    const tips = T.nozomiTips[k].filter(tp => s.st.findIndex(x => x.name === tp.after) <= idx);
    const tp = s.mode === 'before' ? T.nozomiTips[k][0] : tips[tips.length - 1];
    $('#live-tip').innerHTML = tp && s.mode !== 'after' ? `<div class="tip"><span class="tg">${tp.tag}</span><b>${tp.title}</b><p>${tp.text}</p></div>` : '';
  }

  /* ---------- 準備中 ---------- */
  function viewSoon(title, kicker, items) {
    return `<div class="wrap"><div class="phead"><div class="kicker">${kicker}</div><h2>${title}</h2></div>
      <div class="card soon">${DEER.replace('class="deer"', 'style="width:88px;background:var(--shu);border-radius:50%;padding:10px"')}<p><b>このページは試作のあとで作ります。</b></p>
      <ul style="text-align:left;display:inline-block;margin:0;padding-left:1.2em" class="small">${items.map(i => `<li>${i}</li>`).join('')}</ul></div>
      <div class="card"><b>いま使えるもの</b><div class="btn-row"><button class="btn primary sm" data-act="qr">${ic('qr')} チェックインQR</button><button class="btn sm" data-act="fam">家族を切り替え</button><button class="btn sm" data-act="demo">${ic('gear')} 時間旅行</button><button class="btn sm" data-act="theme">🌙 明るさ切り替え</button></div></div></div>`;
  }

  /* ---------- ルーター ---------- */
  const NAV = [['home', 'ホーム', 'home', '#/'], ['trip', '旅程', 'route', '#/trip/' + 1], ['ride', 'のりもの', 'train', '#/ride'], ['food', 'ごはん', 'bowl', '#/food'], ['more', 'もっと', 'more', '#/more']];
  let timer = null;
  function render() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'home';
    clearInterval(timer);
    let html;
    if (route === 'trip') html = viewTrip(+parts[1] || todayDayN());
    else if (route === 'ride') html = viewRide(parts[1], parts[2]);
    else if (route === 'food') html = viewSoon('ごはん', 'FOOD', ['まるかつ天理店（10/18 昼）', '夕食候補7店の比べ表と「行きたい」投票', '現金のみ／カード可で絞り込み']);
    else if (route === 'more') html = viewSoon('もっと', 'MORE', ['やど・レンタカー（部屋、返却カウントダウン）', 'おでかけ（東大寺・道頓堀・大阪城・WowUs、豆知識カード、鹿スタンプラリー）', 'もしも（緊急連絡先を1タップで発信、病院、駐車場）', '予算と割り勘メモ']);
    else html = viewHome();
    app.innerHTML = html;
    const navRoute = route === 'home' ? 'home' : route;
    $('#nav').innerHTML = `<ul>${NAV.map(([k, l, i, h]) => `<li><a href="${k === 'trip' ? '#/trip/' + todayDayN() : h}" class="${k === navRoute ? 'on' : ''}" ${k === navRoute ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a></li>`).join('')}</ul>`;
    demoBar();
    if (route === 'home' || !route) { loadWeather($('#weather')); timer = setInterval(tickCountdown, 30e3); }
    if (route === 'ride' && parts[1] === 'live') { requestAnimationFrame(updateLive); timer = setInterval(updateLive, 20e3); }
    if (route === 'trip') { const n = $('.tl li.now'); if (n) setTimeout(() => n.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); else window.scrollTo(0, 0); }
    else if (route === 'ride' && parts[1] === 'ekiben') setTimeout(() => $('#ekiben') && $('#ekiben').scrollIntoView({ behavior: 'smooth' }), 150);
    else window.scrollTo(0, 0);
    observe();
    if (!fam() && !session.get('askedFam')) { session.set('askedFam', '1'); setTimeout(() => pickFamily(true), 900); }
  }

  function observe() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  /* ---------- 操作 ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'fam') pickFamily();
      if (act === 'qr') showQR();
      if (act === 'demo') demoSheet();
      if (act === 'theme') {
        const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set('theme', nx);
      }
      return;
    }
    const d = e.target.closest('[data-dir]');
    if (d) { session.set('dir', d.dataset.dir); render(); return; }
    const l = e.target.closest('[data-live]');
    if (l) { location.hash = '#/ride/live/' + l.dataset.live; return; }
    const w = e.target.closest('[data-want]');
    if (w) {
      const list = store.get('want', []); const n = w.dataset.want;
      const i = list.indexOf(n); i < 0 ? list.push(n) : list.splice(i, 1);
      store.set('want', list); w.classList.toggle('on', i < 0);
    }
  });

  const th = store.get('theme'); if (th) document.documentElement.dataset.theme = th;
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', () => $('#line') && updateLive());
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
