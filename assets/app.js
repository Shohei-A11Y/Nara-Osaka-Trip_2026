(() => {
  'use strict';
  const T = window.TRIP;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');

  /* ========== 保存（使えない環境でも動くように） ========== */
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても続行 */ } }
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* noop */ } }
  };

  /* ========== 時刻 ========== */
  const pad = s => (s.length === 4 ? '0' + s : s);
  const jst = (date, hm) => new Date(`${date}T${pad(hm)}:00+09:00`);
  /* 「いま」はすべて仮想の時計（sim.js）から。おためし中でなければ本物の時刻 */
  const Clock = window.Clock;
  const now = () => Clock.now();
  const fmtHM = d => d.toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  const ymd = d => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const dowOf = d => new Date(ymd(d) + 'T12:00:00+09:00').getDay();
  const yen = n => (n < 0 ? '−¥' : '¥') + Math.abs(n).toLocaleString('ja-JP');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gmap = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const tel = n => 'tel:' + n.replace(/[^0-9#+]/g, '');
  const dur = m => m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? m % 60 + '分' : ''}` : `${m}分`;
  const ext = (href, label, cls = 'btn quiet') => `<a class="${cls} ext" href="${href}" target="_blank" rel="noopener">${label}</a>`;
  /* 外部の地図・乗換案内（行程表の各区間の小さなリンク）。地点は T.places の正式名称＋住所、なければ駅名 */
  const enc = encodeURIComponent, p2 = n => String(n).padStart(2, '0');
  const placeQ = n => ((T.places || {})[n] || {}).q || n;
  const gdir = (o, d, mode, wp) => `https://www.google.com/maps/dir/?api=1&origin=${enc(o)}&destination=${enc(d)}${wp && wp.length ? '&waypoints=' + enc(wp.join('|')) : ''}&travelmode=${mode}`;
  /* Yahoo!乗換案内は、駅名だけだと別の会社の駅になることがある（「なんば」→南海線）。地下鉄の駅と分かる名前にする（2026-09-29に確認） */
  const YJ_NAME = { 'なんば': 'なんば(地下鉄)', '梅田': '梅田(地下鉄)' }, yjName = n => YJ_NAME[n] || n;
  const yjUrl = (from, to, date, hm) => { from = yjName(from); to = yjName(to); const [y, m, d] = date.split('-').map(Number), [hh, mm] = hm.split(':').map(Number); return `https://transit.yahoo.co.jp/search/result?from=${enc(from)}&to=${enc(to)}&y=${y}&m=${p2(m)}&d=${p2(d)}&hh=${p2(hh)}&m1=${Math.floor(mm / 10)}&m2=${mm % 10}&type=1`; };
  const driveUrl = dv => gdir(dv.o, dv.d, 'driving', dv.wp);

  /* ========== アイコン ========== */
  const P = {
    home: '<path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>',
    train: '<path d="M5 16.5c0-6 3-10.5 9-10.5h1.5c3 0 4.5 2 4.5 5.5v5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 16.5z"/><path d="M14 6v5h6M8 21l1.5-3M17 21l-1.5-3M5.5 13H10"/>',
    bowl: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M14 4 9.5 11M18 3.5 11.5 11"/>',
    spot: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M9 12.5 10 8l4 1 2 3 2.5 1M10 8l-3 2-1 3"/>',
    metro: '<rect x="5.5" y="3.5" width="13" height="13" rx="3"/><path d="M5.5 11h13M8.5 20.5l2-4M15.5 20.5l-2-4"/>',
    car: '<path d="M4.5 16v-4.5L6.5 7h11l2 4.5V16"/><path d="M3 16h18v2.5H3zM6.5 11.5h11"/>',
    road: '<path d="M8 3 5 21M16 3l3 18M12 4v3M12 10v4M12 17v3"/>',
    qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM17.5 17.5h3v3h-3zM14 20.5h1.5M20.5 14v1.5"/>',
    seat: '<path d="M7 3.5v8.5a2 2 0 0 0 2 2h7M7.5 14l-1 7M16.5 14v7M7 10h8a2 2 0 0 1 2 2v2"/>',
    sos: '<path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4M12 16.8v.2"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.5"/>',
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    more: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    bag: '<path d="M5 8.5h14l-1 11.5H6z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    yen: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 7.5 12 12l3.5-4.5M12 12v5M9 12.5h6M9 15h6"/>',
    pen: '<path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L9 18z"/><path d="M13.5 7.5l3 3M5 19h14"/>',
    stamp: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/>',
    text: '<path d="M4 18 8.5 6 13 18M5.8 14h5.4M15 18l2.5-7 2.5 7M15.8 16h3.4"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    add: '<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M12 9v6M9 12h6"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5M12 16.8v.2"/>',
    play: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 19.5 3.5M16 7l2.5 2.5M13.8 9.2l2 2"/>',
    save: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    cube: '<path d="M12 3.5 19.5 7.8v8.4L12 20.5l-7.5-4.3V7.8z"/><path d="M4.5 7.8 12 12l7.5-4.2M12 12v8.5"/>',
    out: '<path d="M13.5 4.5h6v6M19.5 4.5 11 13"/><path d="M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10"/>',
    wc: '<circle cx="7.5" cy="4.8" r="1.6"/><circle cx="16.5" cy="4.8" r="1.6"/><path d="M5.6 8.5h3.8l.6 5.5H9v6H6v-6H5zM14.6 8.5h3.8l1.6 7h-2v4.5h-3V15.5h-2z"/><path d="M12 3v18"/>',
    here: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    tip: '<path d="M9 17.5h6M9.8 20.5h4.4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.7.6 1.1 1.3 1.2 2.1h4.2c.1-.8.5-1.5 1.2-2.1A5.5 5.5 0 0 0 12 3.5z"/>',
    book: '<path d="M4.5 5.5c2.6-.8 5.1-.6 7.5.9v13c-2.4-1.5-4.9-1.7-7.5-.9zM19.5 5.5c-2.6-.8-5.1-.6-7.5.9v13c2.4-1.5 4.9-1.7 7.5-.9z"/>',
    rain: '<path d="M3.5 12a8.5 8.5 0 0 1 17 0z"/><path d="M12 12v6.5a2 2 0 0 1-4 0"/><path d="M12 3.5v-1"/>'
  };
  const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

  /* 挿絵（線画） */
  const ART = {
    station: '<path d="M6 40h36M9 40V22l15-10 15 10v18M15 40V28h6v12M27 28h6v6h-6zM20 20h8"/><circle cx="24" cy="20" r="0"/>',
    torii: '<path d="M6 12c6 2 30 2 36 0M9 18h30M14 12v28M34 12v28M24 18v-6M6 40h36"/>',
    deer: '<path d="M18 8l-3-5M18 8l-6-1M18 8l1-6M28 8l3-5M28 8l6-1M28 8l-1-6"/><path d="M17 11c0-2 3-3 6-3s6 1 6 3l-1.5 7c-.7 2.5-2.5 4-4.5 4s-3.8-1.5-4.5-4z"/><path d="M15 12l-4 1M31 12l4 1M22 22c-1.5 4-1.5 7 0 10h13c4 0 6-2.5 6-6v-2M25 32v10M36 32v10M40 29v13M28 32v10"/>',
    daibutsu: '<path d="M24 6c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5zM19 9c1-2 3-3 5-3s4 1 5 3"/><path d="M14 42c0-12 4-22 10-22s10 10 10 22z"/><path d="M19 30c2 2 4 3 5 3M29 30c-2 2-4 3-5 3M8 42h32"/>',
    loop: '<circle cx="24" cy="24" r="14"/><path d="M24 10v4M38 24h-4M24 38v-4M10 24h4"/><path d="M33 12l5-2-1 5"/>',
    river: '<path d="M6 16h36M6 16v6M42 16v6M12 16v-5h24v5"/><path d="M4 32c4-3 8-3 12 0s8 3 12 0 8-3 12 0M4 39c4-3 8-3 12 0s8 3 12 0 8-3 12 0"/>',
    castle: '<path d="M10 42h28M13 42V32h22v10M16 32l-3-5h22l-3 5M18 27v-6h12v6M15 21l9-7 9 7M20 14h8M24 8v6M21 42v-5h6v5"/>',
    tower: '<path d="M16 42V10l8-4 8 4v32M12 42h24M20 14h8M20 20h8M20 26h8M20 32h8M24 6V2"/>',
    food: '<path d="M8 22h32a16 16 0 0 1-32 0z"/><path d="M26 8l-6 14M33 7l-9 15M4 42h40"/>'
  };
  const art = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[k]}</svg>`;
  const SPOT_ART = { osakastation: 'station', sakurai: 'torii', todaiji: 'deer', loop: 'loop', dotonbori: 'river', osakajo: 'castle', wowus: 'tower' };
  const DAYC = n => `var(--day${n})`;

  /* ========== 旅の記録スタンプ ==========
     押した記録は {スタンプid: 押した日時（ISO）}。スポットの紹介ページの id と同じなので、後の「思い出モード」でもそのまま使える。
     この端末だけに残す（localStorage）。おためし中は sessionStorage に分けて置き、本当の記録を汚さない。
     前の版（id が違う・値が「10/18」）の記録は、読むときに今の形に直す */
  const Stamps = (() => {
    const fix = v => { const m = /^(\d{1,2})\/(\d{1,2})$/.exec(v || ''); return m ? `2026-${p0(m[1])}-${p0(m[2])}` : v; };
    function p0(n) { return String(n).padStart(2, '0'); }
    function get() {
      let raw;
      if (Clock.active()) { try { raw = JSON.parse(session.get('stamps-sim')) || {}; } catch { raw = {}; } }
      else raw = store.get('stamps', {}) || {};
      const out = {};
      Object.entries(raw).forEach(([k, v]) => { if (v) out[(T.stampOld || {})[k] || k] = fix(String(v)); });
      return out;
    }
    function set(v) { Clock.active() ? session.set('stamps-sim', JSON.stringify(v)) : store.set('stamps', v); }
    /* 押す・取り消す。戻り値：押したら true */
    function toggle(id) {
      const v = get();
      if (v[id]) delete v[id]; else v[id] = now().toISOString();
      set(v); return !!v[id];
    }
    const count = (v = get()) => T.stamps.filter(s => v[s.id]).length;
    /* 押した日時を短く（日付だけの古い記録は日付だけ） */
    const when = iso => { const d = new Date(iso); if (isNaN(d)) return ''; const md = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }); return /T/.test(iso) ? `${md} ${fmtHM(d)}` : md; };
    return { get, toggle, count, when };
  })();
  /* 印の形（64×64）。スタンプごとに形を変えて、字が読めなくても見分けられるようにする */
  const STAMP_SHAPE = (() => {
    const poly = (n, r, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + i * 2 * Math.PI / n; return `${(32 + r * Math.sin(a)).toFixed(1)},${(32 - r * Math.cos(a)).toFixed(1)}`; }).join(' ');
    /* 蓮の花びらのような、縁が波打つ丸 */
    const lotus = (() => { const n = 12, r = 25.5, pts = Array.from({ length: n + 1 }, (_, i) => { const a = i * 2 * Math.PI / n; return [32 + r * Math.sin(a), 32 - r * Math.cos(a)]; }); const rr = (2 * r * Math.sin(Math.PI / n) / 2 + .6).toFixed(1); return `M${pts[0].map(x => x.toFixed(1)).join(' ')}` + pts.slice(1).map(p => `A${rr} ${rr} 0 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + 'Z'; })();
    return {
      circle: '<circle cx="32" cy="32" r="28"/><circle class="thin" cx="32" cy="32" r="24.6"/>',
      double: '<circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="25.2"/>',
      square: '<rect x="5" y="5" width="54" height="54" rx="2.5"/><rect class="thin" x="8.6" y="8.6" width="46.8" height="46.8" rx="1"/>',
      rrect: '<rect x="3" y="9" width="58" height="46" rx="11"/><path class="thin" d="M9 20h46M9 45h46"/>',
      tall: '<rect x="12" y="2.5" width="40" height="59" rx="5"/><rect class="thin" x="15.4" y="5.9" width="33.2" height="52.2" rx="3"/>',
      oct: `<polygon points="${poly(8, 29.5, Math.PI / 8)}"/><polygon class="thin" points="${poly(8, 26, Math.PI / 8)}"/>`,
      hex: `<polygon points="${poly(6, 30, Math.PI / 6)}"/><polygon class="thin" points="${poly(6, 26.4, Math.PI / 6)}"/>`,
      lotus: `<path d="${lotus}"/><circle class="thin" cx="32" cy="32" r="21"/>`,
      wave: '<path d="M5 7h54v42c-4.5 0-6.75 4-13.5 4S36 49 32 49s-6.75 4-13.5 4S9.5 49 5 49z"/><path class="thin" d="M8.5 11h47"/>',
      roof: '<path d="M6 59V30c8-1 14-6 18-12l8-12 8 12c4 6 10 11 18 12v29z"/><path class="thin" d="M10 33h44"/>'
    };
  })();
  /* 字の位置：形ごとに少しずらす（城の屋根は上がせまいので下げる） */
  const STAMP_DY = { roof: 5, rrect: 0, wave: -2 };
  function stampSvg(s, at, cls = '') {
    const dy = STAMP_DY[s.shape] || 0, rot = ((s.id.length * 7) % 17) - 10;
    const date = at ? (d => isNaN(d) ? '' : d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }).replace('/', '.'))(new Date(at)) : '';
    return `<svg class="seal${at ? ' on' : ''}${cls ? ' ' + cls : ''}" viewBox="0 0 64 64" style="--rot:${rot}deg" aria-hidden="true"><g class="ink">
      <g class="edge">${STAMP_SHAPE[s.shape] || STAMP_SHAPE.circle}</g>
      ${date ? `<text class="sd" x="32" y="${17 + dy}">${date}</text>` : ''}
      <text class="sm" x="32" y="${39.5 + dy}">${esc(s.mark)}</text>
      <text class="sn" x="32" y="${50 + dy}"${s.name.length > 4 ? ' textLength="34" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(s.name)}</text></g></svg>`;
  }
  /* 紹介ページの「行った」。spot に結びついたスタンプを並べる */
  function visitBlock(spot) {
    const list = T.stamps.filter(s => s.spot === spot);
    if (!list.length) return '';
    const v = Stamps.get();
    return `<div class="visit">${list.map(s => `<div class="visit-row">${stampSvg(s, v[s.id], 'sc')}
      <div class="visit-t"><b>${esc(s.name)}</b><span class="small muted">${v[s.id] ? `${esc(Stamps.when(v[s.id]))} に押しました。もう一度押すと取り消せます。` : '着いたら、押してください。'}</span></div>
      <button class="visit-btn${v[s.id] ? ' on' : ''}" data-stamp="${s.id}" aria-pressed="${!!v[s.id]}">${v[s.id] ? '行った ✓' : '行った'}</button></div>`).join('')}
      <a class="visit-count" href="#/spot/stamps">スタンプ帳 <span class="num">${Stamps.count(v)} / ${T.stamps.length}</span></a></div>`;
  }
  /* 印にかすれを出すフィルター（ページに1つだけ置く） */
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="ink-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" result="d"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.25" result="m"/><feComposite in="d" in2="m" operator="in"/></filter></svg>');
  const COVER_DEER = `<svg class="cover-art" viewBox="0 0 120 110" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M38 20l-6-12M38 20l-12-3M38 20l2-13M56 20l6-12M56 20l12-3M56 20l-2-13"/><path d="M36 25c0-4 5-6 11-6s11 2 11 6l-3 13c-1.4 5-4.6 8-8 8s-6.6-3-8-8z"/><path d="M32 27l-7 2M62 27l7 2"/><circle cx="42" cy="31" r="1.3" fill="#fff"/><circle cx="52" cy="31" r="1.3" fill="#fff"/><path d="M44 46c-3 8-3 14 0 20h30c8 0 12-5 12-12v-4M50 66v24M70 66v24M80 60v30M58 66v24"/><path d="M4 96c20-4 40-4 60 0s40 4 56 0" stroke-opacity=".7"/><g fill="#fff" stroke="none"><circle cx="62" cy="56" r="1.8"/><circle cx="70" cy="54" r="1.8"/><circle cx="77" cy="58" r="1.8"/></g></svg>`;
  /* 表紙の影絵（たこ焼き・大阪城・通天閣）。表紙の横線の上に置く */
  const COVER_OSAKA = `<svg class="cover-osaka" viewBox="0 0 108 52" aria-hidden="true"><g fill="#fff">
    <path d="M3 45h26l-3.2 5H6.2z"/><circle cx="9.5" cy="40.5" r="5.2"/><circle cx="18" cy="39.5" r="5.2"/><circle cx="26.2" cy="40.8" r="4.6"/><path d="M22.5 36.5 29 27" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M36 51l4-10h30l4 10z"/><path d="M44 41v-7h22v7z"/><path d="M39.5 34.8Q55 30 70.5 34.8L67 31.5H43z"/><path d="M47 31.5v-5h16v5z"/><path d="M42.5 27.6Q55 23.4 67.5 27.6L64 25H46z"/><path d="M49.5 25v-4.4h11V25z"/><path d="M45.5 21.4Q55 16.4 64.5 21.4L60.5 18H49.5z"/><path d="M50.5 18.3l-1-2.3M59.5 18.3l1-2.3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M83 51l6.5-17h8l6.5 17h-3.6l-4.9-10.5h-4L86.6 51z"/><path d="M90 34.5V15h7v19.5z"/><path d="M87.5 16.5v-6h12v6z"/><path d="M90.5 10.5V7h6v3.5z"/><path d="M93.5 7V1" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></g>
    <g fill="none" stroke="#d6504c" stroke-width="1.1"><circle cx="9.5" cy="40.5" r="5.2"/><circle cx="18" cy="39.5" r="5.2"/><path d="M47 37.5h3M54 37.5h3M61 37.5h3M50 28.8h2.5M57.5 28.8h2.5M92 20h3M92 25h3M92 30h3M90 13.5h7"/></g></svg>`;
  /* 横から見た新幹線（最後尾＋中間車3両＋先頭車）。表紙がトップに見えているあいだ、ときどき横切る。
     nz：のぞみ風（白い車体に青い線）／km：かもめ風（白い車体で下が赤）。どちらも左から右へ走る。実在の会社のロゴや文字は入れない */
  const COVER_TRAIN = (() => {
    const mids = [62, 108, 154];
    const body = `<path d="M60 4.2h-24c-10 0-25 3.6-36.2 9.1-1 .5-.7 1.9.4 1.9H60z"/>${mids.map(x => `<rect x="${x}" y="4.2" width="44" height="11" rx="1.3"/>`).join('')}
      <path d="M200 4.2h24c10 0 25 3.6 36.2 9.1 1 .5.7 1.9-.4 1.9H200z"/>`;
    const wins = c => `<path d="M31 7.2h26${mids.map(x => `M${x + 3} 7.2h38`).join('')}M203 7.2h26" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 2.2"/>`;
    const nose = c => `<path d="M25 5.6c-5 .5-11 2.3-15 4.3M235 5.6c5 .5 11 2.3 15 4.3" stroke="${c}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    const nz = `<svg class="cover-train nz" viewBox="0 0 261 16" aria-hidden="true"><g fill="#fff">${body}</g>
      <path d="M4 10.6h56${mids.map(x => `M${x} 10.6h44`).join('')}M200 10.6h56" stroke="#2b5ea7" stroke-width="1.7"/>${wins('#9fb3c8')}${nose('#33445c')}</svg>`;
    const km = `<svg class="cover-train km" viewBox="0 0 261 16" aria-hidden="true"><defs><clipPath id="km-low"><rect x="0" y="10.4" width="261" height="6"/></clipPath></defs>
      <g fill="#fff">${body}</g><g fill="#a3252b" stroke="#fff" stroke-width=".7" clip-path="url(#km-low)">${body}</g><path d="M2 10.4h257" stroke="#fff" stroke-width=".6" opacity=".9"/>${wins('#a9b1ba')}${nose('#3a3f47')}</svg>`;
    return nz + km;
  })();
  /* 表紙の新幹線：のぞみ風とかもめ風が、それぞれ別々に左から右へ走る。のぞみ風は速く、かもめ風は今までの速さ。
     2台は同じ高さ（表紙の横線の上）を走る。追い抜きで重なるときは、のぞみ風が手前・かもめ風が後ろ。どちらも名所の影絵と鹿の後ろを通る。
     トップにいる時間は短いので、開いてすぐ（1〜2秒）にのぞみ風、数秒おいてかもめ風が走り、その後も間を空けすぎずに次々に走る。
     走り始めと、消えてから次に出るまでの間は、毎回、一定の幅の中で乱数で決める（決まった繰り返しに見えないように）。
     走るのは表紙が画面に見えていて、アプリが前にあるときだけ。「視差効果を減らす」がオンなら走らせない（CSS でも止めている）。
     鹿が跳ねるのは、のぞみ風が鹿の前を通るとき（3回に1回） */
  const CoverTrain = (() => {
    const RM = matchMedia('(prefers-reduced-motion: reduce)');
    /* speed：画面上の平均の速さ（px/秒）。first：最初に走り出すまで、gap：消えてから次まで（ミリ秒の幅） */
    const CARS = {
      nz: { speed: 220, first: [400, 1600], gap: [1200, 4500] },
      km: { speed: 145, first: [2600, 5200], gap: [1800, 6000] }
    };
    const st = { nz: { timer: 0, n: 0 }, km: { timer: 0, n: 0 } };
    const rnd = ([a, b]) => a + Math.random() * (b - a);
    let cover = null, io = null, seen = false;
    const ok = () => !!cover && cover.isConnected && seen && document.visibilityState === 'visible' && !RM.matches;
    /* 動きの緩急は cubic-bezier(.45,.05,.55,.95)。progAt：時間の割合 → 進んだ割合、timeAt：進んだ割合 → 時間の割合 */
    const bez = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    const solve = (f, v) => { let lo = 0, hi = 1; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; f(m) < v ? (lo = m) : (hi = m); } return (lo + hi) / 2; };
    const progAt = x => bez(.05, .95, solve(t => bez(.45, .55, t), x));
    const timeAt = p => solve(progAt, p);
    const trainEl = k => cover && $(`.cover-train.${k}`, cover);
    const running = k => { const tr = trainEl(k); return !!tr && tr.classList.contains('run'); };
    function run(k) {
      const s = st[k]; clearTimeout(s.timer); s.timer = 0;
      if (!cover || !cover.isConnected || RM.matches) return;
      const rail = $('.cover-rail', cover), tr = trainEl(k), deer = $('.cover-art', cover);
      if (!rail || !tr || running(k)) return;
      const rw = rail.clientWidth, tw = tr.getBoundingClientRect().width, dist = rw + tw, dur = dist / CARS[k].speed;
      tr.style.setProperty('--rw', rw + 'px');
      tr.style.setProperty('--dur', dur.toFixed(2) + 's');
      tr.classList.remove('run'); void tr.offsetWidth; tr.classList.add('run');
      if (k === 'nz' && s.n % 3 === 0) {
        /* 鼻先が鹿の前を通るころに跳ねる */
        const dx = deer ? deer.getBoundingClientRect().left + 38 - rail.getBoundingClientRect().left : rw * .8;
        cover.style.setProperty('--hop', (dur * timeAt(Math.min(1, Math.max(0, dx / dist)))).toFixed(2) + 's');
        cover.classList.remove('hop'); void cover.offsetWidth; cover.classList.add('hop');
      }
      s.n++;
    }
    const later = (k, ms) => { const s = st[k]; clearTimeout(s.timer); s.timer = ok() ? setTimeout(() => (ok() ? run(k) : (s.timer = 0)), ms) : 0; };
    const idle = k => cover && !running(k) && !st[k].timer;
    const wake = first => Object.keys(CARS).forEach(k => { if (idle(k)) later(k, rnd(first || !st[k].n ? CARS[k].first : CARS[k].gap)); });
    const stopAll = () => Object.values(st).forEach(s => { clearTimeout(s.timer); s.timer = 0; });
    function mount(el) {
      stopAll(); io && io.disconnect(); io = null;
      cover = el || null; seen = false;
      if (!cover) return;
      Object.keys(CARS).forEach(k => { st[k].n = 0; const tr = trainEl(k); tr && tr.addEventListener('animationend', () => { tr.classList.remove('run'); if (k === 'nz') cover && cover.classList.remove('hop'); later(k, rnd(CARS[k].gap)); }); });
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; if (seen) wake(); });
        io.observe($('.cover-rail', cover) || cover);
      } else { seen = true; wake(true); }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); else stopAll(); });
    RM.addEventListener && RM.addEventListener('change', () => { if (RM.matches) { stopAll(); cover && (cover.classList.remove('hop'), $$('.cover-train', cover).forEach(t => t.classList.remove('run'))); } else wake(); });
    /* 表紙を押したとき：止まっている列車を、のぞみ風から先にすぐ走らせる */
    const tap = () => { const k = !running('nz') ? 'nz' : !running('km') ? 'km' : null; k && run(k); };
    return { mount, run: tap };
  })();
  const PIN = `<svg class="trainpin" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="#d6504c"/><path d="M8 17c0-4.5 2.2-7.5 7.5-7.5h1c2.3 0 4 1.6 4 4.6V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" fill="#fff"/><path d="M15 9.5v4.2h5.5" stroke="#d6504c" stroke-width="1.3" fill="none"/></svg>`;

  /* ========== 家族 ========== */
  const fam = () => store.get('fam');
  const famName = () => (T.families[fam()] || {}).name;

  /* ========== 「いまここ」：予定からのずれ ==========
     行程表（または「今日の予定」）で、いまいる地点を押すと、そこを現在地とみなし、以降の予定をずれた分だけ動かした見込みで出す。
     覚えるのはこの端末だけ（localStorage。使えないときは開いている間だけ）。おためし中は sessionStorage に分けて置く。
     日付が変わったら、自動で元に戻す（date が今日でなければ無視して消す）。
     固定の時刻（新幹線・特急の発車）は動かさない。ずれは固定の時刻で吸収し、間に合わなさそうなら一言出す */
  let shiftMem = null;
  function getShift() {
    let v;
    if (Clock.active()) { try { v = JSON.parse(session.get('shift-sim')); } catch { v = null; } }
    else v = store.get('shift');
    if (v === null || v === undefined) v = shiftMem;
    if (!v || typeof v.min !== 'number') return null;
    if (v.date !== ymd(now())) { if (!Clock.active()) try { localStorage.removeItem('shift'); } catch { /* noop */ } return null; }
    return v;
  }
  function setShift(v) {
    shiftMem = v;
    if (Clock.active()) session.set('shift-sim', v ? JSON.stringify(v) : null);
    else if (v) store.set('shift', v);
    else try { localStorage.removeItem('shift'); } catch { /* noop */ }
  }
  /* 新幹線・特急に乗る地点（その発車時刻は動かさない） */
  const fixedTrain = (day, i) => { const n = day.items[i + 1]; return n && n.t === 'move' && n.train ? T.trains[n.train] : null; };
  /* 1日分の見込みの時刻。stop ごとに a（着）・d（発）・pa・pd（予定）を持つ。warn：間に合わなさそうな所 */
  function schedule(day) {
    const S = getShift(), an = S && S.date === day.date ? S : null;
    let s = 0;
    const warns = [];
    const rows = day.items.map((it, i) => {
      if (it.t !== 'stop') return { i, it };
      const pa = it.arr ? jst(day.date, it.arr) : null, pd = it.dep ? jst(day.date, it.dep) : null;
      const r = { i, it, pa, pd, a: pa, d: pd, est: false };
      if (!an || i < an.i) return r;
      const tr = fixedTrain(day, i);
      if (i === an.i) {
        s = an.min * 6e4;
        if (pd && !tr) r.d = new Date(+pd + s); else if (!pd) r.a = new Date(+pa + s);
        r.est = !!s && !tr; r.anchor = true;
        if (tr && s > 0 && new Date(+(pa || pd) + s) > pd) warns.push({ i, text: `${tr.name}（${it.dep}発）に間に合うよう、ここで調整を` });
        if (tr) s = 0;
      } else if (s) {
        if (pa) r.a = new Date(+pa + s);
        if (tr) {
          if (s > 0 && r.a && r.a > pd) warns.push({ i, text: `${tr.name}（${it.dep}発）に間に合うよう、ここで調整を` });
          s = 0;
        } else if (pd) r.d = new Date(+pd + s);
        r.est = true;
      }
      if (it.due && s > 0) {
        const due = jst(day.date, it.due), at = it.dueAt === 'dep' ? r.d : r.a;
        if (at && at > due) warns.push({ i, text: `${it.dueName}に間に合うよう、ここで調整を` });
      }
      return r;
    });
    return { rows, warns, shift: an };
  }
  function events(day) {
    if (!day.items) return [];
    const { rows } = schedule(day);
    return day.items.map((it, i) => {
      if (it.t === 'stop') { const r = rows[i]; return { i, start: r.a || r.d, end: r.d || r.a, it, day, est: r.est }; }
      const p = rows[i - 1], n = rows[i + 1];
      return { i, start: p.d || p.a, end: n.a || n.d, it, day, est: p.est || n.est };
    });
  }
  const allEvents = () => T.days.flatMap(events);
  const hm = d => fmtHM(d);
  const durTxt = m => (m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? m % 60 + '分' : ''}` : `${m}分`);
  /* ずれの一言（予定より約25分遅れ・13:27ごろ出発の見込み） */
  function shiftText(day) {
    const sc = schedule(day), S = sc.shift; if (!S) return null;
    const r = sc.rows[S.i], at = r.d || r.a, m = Math.abs(S.min);
    const go = at ? `${hm(at)}ごろ${r.pd || !r.pa ? '出発' : '到着'}の見込み` : '';
    const head = S.min > 0 ? `予定より約${durTxt(m)}遅れ` : S.min < 0 ? `予定より約${durTxt(m)}早く進んでいます` : 'ほぼ予定どおりです';
    return { text: S.min ? `${head}・${go}` : `${head}（${at ? hm(at) + (r.pd || !r.pa ? '発' : '着') + 'の予定' : ''}）`, warn: sc.warns[0] ? sc.warns[0].text : '', S };
  }
  /* 地点を「いまここ」にする */
  function setHere(date, i) {
    const day = T.days.find(d => d.date === date); if (!day) return;
    const it = day.items[i]; if (!it || it.t !== 'stop') return;
    const t = now(), pa = it.arr ? jst(date, it.arr) : null, pd = it.dep ? jst(date, it.dep) : null;
    let min = 0;
    if (pd && t > pd) min = Math.ceil((t - pd) / 6e4);
    else if (!pd && pa && t > pa) min = Math.ceil((t - pa) / 6e4);
    else if (pa && t < pa) min = -Math.round((pa - t) / 6e4);
    else if (!pa && pd && t < pd) min = 0;
    setShift({ date, i, min, at: +t });
    toast(min > 0 ? `この先の予定を${durTxt(min)}遅らせて表示しています` : min < 0 ? `この先の予定を${durTxt(-min)}早めて表示しています` : '予定どおりです。この先の時刻はそのままです', 3200);
    const y = scrollY; render(); scrollTo(0, y);
  }
  const shortName = it => it.type === 'hotel' ? 'ホテル' : it.type === 'car' ? 'レンタカーの店' : it.type === 'parking' ? '駐車場' : it.name.replace('・大阪城公園', '');
  function nowNext(t = now()) {
    const ev = allEvents();
    let cur = ev.find(e => e.start <= t && t < e.end) || null;
    const next = ev.find(e => e.start > t && e.it.t === 'stop') || null;
    return { cur, next };
  }
  const phase = () => { const t = now(); return t < new Date(T.start) ? 'before' : t >= new Date(T.end) ? 'after' : 'during'; };
  const todayDay = () => T.days.find(d => d.date === ymd(now()));
  const todayN = () => (todayDay() || T.days[0]).n;

  /* 駅の路線色 */
  const KYUSHU = ['新大村', '武雄温泉', '博多'];
  function lineOf(day, i) {
    const it = day.items[i];
    const mv = [day.items[i + 1], day.items[i - 1]].find(x => x && x.t === 'move' && x.mode !== 'walk');
    const l = mv ? mv.line : '';
    if (/御堂筋/.test(l)) return ['var(--midosuji)', 'Osaka Metro 御堂筋線'];
    if (/千日前/.test(l)) return ['var(--sennichimae)', 'Osaka Metro 千日前線'];
    if (/谷町/.test(l)) return ['var(--tanimachi)', 'Osaka Metro 谷町線'];
    if (KYUSHU.includes(it.name)) return ['var(--jrk)', 'JR九州'];
    return ['var(--jrw)', 'JR西日本'];
  }

  /* ========== 共通UI ========== */
  /* 下から出る画面。題と×（と opt.head）は上に固定し、スクロールしても消えない */
  function sheet(title, html, onMount, opt = {}) {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-top"><div class="sheet-h"><h3>${title}</h3><button class="close" aria-label="閉じる">×</button></div>${opt.head || ''}</div>${html}</div>`;
    let cleanup = null;
    const close = () => { typeof cleanup === 'function' && cleanup(); bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('.close') || e.target.closest('a[href^="#"]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
    if (onMount) cleanup = onMount(bg, close);
    applyRuby($('.sheet', bg));
    if (!opt.noFocus) $('.close', bg).focus({ preventScroll: true });
  }
  function toast(msg, ms = 1800) {
    $$('.toast').forEach(x => x.remove());
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg; document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('コピーしました'); } catch { toast(text); }
  }
  const copyBtn = t => `<button class="copy" data-copy="${esc(t)}">コピー</button>`;

  function pickFamily(first = false) {
    const cur = fam();
    let done; const p = new Promise(r => (done = r));
    sheet(first ? 'ようこそ' : '家族を切り替える', `<p class="small muted">選んだ家族の座席・お部屋・チェックインQR・費用を表示します。あとからいつでも変えられます。</p>
      <div class="pick">${Object.entries(T.families).map(([k, f]) => `<button data-f="${k}" class="${cur === k ? 'on' : ''}"><span><b>${f.name}</b><br><span class="small muted">${f.label}</span></span><span aria-hidden="true">${cur === k ? '✓' : '→'}</span></button>`).join('')}</div>`,
      (el, close) => { $$('[data-f]', el).forEach(b => b.addEventListener('click', () => { store.set('fam', b.dataset.f); close(); render(); })); return () => done(); });
    return p;
  }

  const roomsFor = f => Object.entries(T.hotel.rooms).filter(([, r]) => !f || r.family === f);

  /* ========== 予約番号とQRの鍵 ==========
     ホテルの予約番号とチェックインQRは、合言葉で暗号にした形（T.hotel.lock）だけを公開ファイルに置く。
     合言葉から PBKDF2（SHA-256）で鍵を作り、AES-GCM で開く。開けた鍵はこの端末（localStorage）に覚え、次からは合言葉なしで表示する */
  const Lock = (() => {
    const L = T.hotel.lock, KEY = 'hk';
    let data = null;
    const cs = () => (window.crypto && crypto.subtle) || null;
    const bin = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
    const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const norm = p => String(p).normalize('NFKC').replace(/\s+/g, '');
    const open = async key => JSON.parse(new TextDecoder().decode(await cs().decrypt({ name: 'AES-GCM', iv: bin(L.iv) }, key, bin(L.data))));
    async function unlock(pass) {
      const base = await cs().importKey('raw', new TextEncoder().encode(norm(pass)), 'PBKDF2', false, ['deriveKey']);
      const key = await cs().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bin(L.salt), iterations: L.iter }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      data = await open(key);   /* 合言葉が違うと、ここで失敗する */
      store.set(KEY, b64(await cs().exportKey('raw', key)));
      return data;
    }
    async function restore() {
      const raw = store.get(KEY);
      if (!raw || !L || !cs()) return null;
      try { data = await open(await cs().importKey('raw', bin(raw), 'AES-GCM', false, ['decrypt'])); } catch { data = null; }
      return data;
    }
    function forget() { data = null; try { localStorage.removeItem(KEY); } catch { /* noop */ } }
    return { ready: restore(), get: () => data, unlock, forget, saved: () => !!store.get(KEY), usable: () => !!(L && cs()) };
  })();
  const qrSrc = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  /* 合言葉を入れる画面 */
  function lockSheet(then) {
    if (!Lock.usable()) return sheet('チェックインQR', '<p class="a2-lead">この画面では、予約番号とQRを表示できません。しおりのアドレス（https://〜）を、Safari または Chrome で開き直してください。</p>');
    sheet('合言葉を入れてください', `<p class="lock-lead">予約番号とチェックインQRには、合言葉の鍵をかけています。一度入れると、この端末では次から入れずに表示します。</p>
      <form class="lock-form" id="lockform" autocomplete="off"><label for="lock-pass">合言葉</label>
        <input id="lock-pass" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" required>
        <p class="lock-err" role="alert" hidden></p>
        <button class="btn fill" type="submit">表示する</button></form>
      <p class="lock-note">${ic('key')}合言葉は、家族のLINEで確認してください。</p>`,
      (el, close) => {
        const f = $('#lockform', el), inp = $('#lock-pass', el), err = $('.lock-err', el), btn = $('button[type="submit"]', el);
        setTimeout(() => inp.focus(), 250);
        f.addEventListener('submit', async e => {
          e.preventDefault(); e.stopPropagation();
          if (!inp.value.trim()) return;
          btn.disabled = true; btn.textContent = '確かめています…'; err.hidden = true;
          try { await Lock.unlock(inp.value); close(); toast('合言葉を確かめました'); updateQrThumbs(); then && then(); }
          catch { err.textContent = '合言葉が違うようです。家族のLINEで、もう一度お確かめください。'; err.hidden = false; inp.select(); }
          finally { btn.disabled = false; btn.textContent = '表示する'; }
        });
      });
  }
  /* 予約番号とQRを1枚の画像（PNG）にする：控えとしてスマホに保存 */
  async function qrImage(k) {
    const r = T.hotel.rooms[k], d = Lock.get()[k];
    const W = 1080, H = 1500, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const img = new Image(); img.src = qrSrc(d.qr); await img.decode();
    const MIN = '"Shippori Mincho B1", "Hiragino Mincho ProN", serif', GOT = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
    x.fillStyle = '#fdfcf9'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#d6504c'; x.fillRect(0, 0, W, 16);
    x.textAlign = 'center'; x.fillStyle = '#2b2926';
    x.font = `700 40px ${GOT}`; x.fillText('自動チェックインQR（控え）', W / 2, 110);
    x.fillStyle = '#67625b'; x.font = `500 32px ${GOT}`; x.fillText(T.hotel.name, W / 2, 170);
    x.fillStyle = '#fff'; x.strokeStyle = '#e4dfd5'; x.lineWidth = 3; x.beginPath(); x.roundRect(170, 230, 740, 740, 24); x.fill(); x.stroke();
    x.imageSmoothingEnabled = false; x.drawImage(img, 210, 270, 660, 660);
    x.fillStyle = '#a39d94'; x.font = `500 28px ${GOT}`; x.fillText('予約番号', W / 2, 1050);
    x.fillStyle = '#2b2926'; x.font = '700 60px ui-monospace, Menlo, Consolas, monospace'; x.fillText(d.code, W / 2, 1125);
    x.font = `700 42px ${MIN}`; x.fillText(`${r.no} ${r.name}`, W / 2, 1230);
    x.fillStyle = '#67625b'; x.font = `500 32px ${GOT}`; x.fillText(`${r.who}・${r.nights}`, W / 2, 1290);
    x.fillText(`チェックイン ${T.hotel.checkin}・チェックアウト ${T.hotel.checkout}`, W / 2, 1340);
    x.fillStyle = '#a39d94'; x.font = `500 26px ${GOT}`; x.fillText('奈良・大阪 2026 家族旅行のしおり', W / 2, 1440);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
  async function saveQrImage(k) {
    const r = T.hotel.rooms[k];
    const name = `checkin-qr-${k}.png`;
    let blob;
    try { blob = await qrImage(k); } catch (e) { console.error(e); return toast('画像を作れませんでした'); }
    const file = new File([blob], name, { type: 'image/png' });
    /* iPhone は共有シートの「画像を保存」で写真に入る。ほかはダウンロード */
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `チェックインQR ${r.no}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('画像を保存しました');
  }
  /* ホテルのページの小さなQR：鍵を開けたあとで差し替える */
  function updateQrThumbs() {
    const d = Lock.get();
    $$('[data-qrthumb]').forEach(el => { const k = el.dataset.qrthumb; el.innerHTML = d && d[k] ? `<img src="${qrSrc(d[k].qr)}" alt="">` : ic('key'); });
  }
  Lock.ready.then(updateQrThumbs);

  async function showQR() {
    const f = fam();
    if (!f) return pickFamily(true);
    await Lock.ready;
    if (!Lock.get()) return lockSheet(showQR);
    const D = Lock.get();
    const today = ymd(now());
    const rooms = roomsFor(f);
    let idx = Math.max(0, rooms.findIndex(([, r]) => r.from <= today && today < r.to));
    const tabs = rooms.length > 1 ? `<div class="segs">${rooms.map(([, r], i) => `<button data-i="${i}" class="${i === idx ? 'on' : ''}">${r.nights}</button>`).join('')}</div>` : '';
    const body = i => { const [k, r] = rooms[i]; return `<div class="qrbox"><img src="${qrSrc(D[k].qr)}" alt="チェックイン用QRコード"><div class="cd">${esc(D[k].code)}</div></div>
      <p class="room-name">${r.no} ${esc(r.name)}</p><p class="small muted">${r.who}・${r.nights}・${r.size}</p>
      <div class="btns"><button class="btn quiet" data-qrsave="${k}">${ic('save')} 画像として保存</button></div>`; };
    sheet('自動チェックインQR', `<p class="small muted">${T.families[f].name}｜フロントの端末にかざします。画面を明るくすると読み取りやすくなります。</p>${tabs}<div class="qr-body">${body(idx)}</div>
      <p class="note">「画像として保存」で、予約番号とQRを1枚の画像にして端末に残せます。電波がないときの控えにどうぞ。</p>`,
      el => {
        $$('[data-i]', el).forEach(b => b.addEventListener('click', () => {
          $$('[data-i]', el).forEach(x => x.classList.toggle('on', x === b));
          $('.qr-body', el).innerHTML = body(+b.dataset.i);
        }));
        el.addEventListener('click', e => { const b = e.target.closest('[data-qrsave]'); if (b) saveQrImage(b.dataset.qrsave); });
      });
  }

  /* 目次：タブバーと同じ5つに分けたサイトマップ（三本線の目次は補助。どのページもタブのどれかからたどれる）。
     見出しの下に項目を一段下げて並べ、見出しごとに折りたためる（最初は全部開く）。いちばん上に、しおり内の検索 */
  const TOC = [
    ['きょう', [['きょう（いま・つぎ）', '#/', ''], ['チェックインQR', '#qr', '']]],
    ['日程', [['1日目　10/17（土）', '#/trip/1', ''], ['2日目　10/18（日）', '#/trip/2', ''], ['3日目　10/19（月）', '#/trip/3', ''], ['4日目　10/20（火）', '#/trip/4', '']]],
    ['のりもの', [['いまどのへん？（のぞみ）', '#/ride/live/nozomi28', ''], ['いまどのへん？（リレーかもめ）', '#/ride/live/relay92', '武雄温泉〜博多'], ['指定席券と座席表', '#/ride', ''], ['駅の乗り換え（3D）', '#/ride/transfer', '博多・新大阪'], ['駅の時刻表（大阪市内）', '#/ride/tt', '7駅'], ['車窓から見える城', '#/ride/castles', ''], ['博多駅の駅弁', '#/ride/ekiben', ''], ['鉄道トリビア', '#/ride/trivia', ''], ['レンタカー', '#/stay/car', '10/18']]],
    ['まっぷ', [['おでかけマップ', '#/map/outing', '1枚の地図で'], ['行く場所の地図', '#/map', ''], ['ドライブの道順', '#/map/drive', '10/18'], ['公式の案内図', '#/map/official', ''], ['おでかけ', '#/spot', '7か所'], ['ごはん', '#/food', ''], ['奈良公園近くの駐車場', '#/sos/parking', '10/18']]],
    ['その他', [['旅のワンポイント', '#/tips', '気温・服装・コツ'], ['トリビア', '#/trivia', '5つの分類'], ['持ち物チェック', '#/bag', ''], ['予算と割り勘メモ', '#/money', ''], ['ホテルとお部屋', '#/stay', ''], ['緊急連絡先・病院', '#/sos', ''], ['思い出メモ', '#/memo', ''], ['スタンプ帳', '#/spot/stamps', ''], ['おためしモード', '#sim', '旅行中の画面を先に体験'], ['使い方', '#/help', '機能ごとの説明書']]]
  ];
  const TOC_ACT = { '#qr': 'qr', '#sim': 'sim' };
  const tocLinks = list => list.map(([l, href, s]) => `<a href="${href}"${TOC_ACT[href] ? ` data-act="${TOC_ACT[href]}"` : ''}>${l}<span>${s}</span></a>`).join('');
  function showToc() {
    sheet('しおりの目次', `<div class="toc" id="toc">${TOC.map(([h, list]) => `<details class="toc-g" open><summary class="toc-h"><span>${h}</span><small>${list.length}</small></summary><div class="toc-items">${tocLinks(list)}</div></details>`).join('')}</div>
      <div class="srch-res" id="srch-res" hidden aria-live="polite"></div>`,
      (el, close) => {
        $$('#toc [data-act]', el).forEach(b => b.addEventListener('click', e => { e.preventDefault(); close(); }));
        const inp = $('#srch', el), res = $('#srch-res', el), toc = $('#toc', el), sh = $('.sheet', el);
        let found = [];
        const draw = () => {
          const q = inp.value.trim();
          toc.hidden = !!q; res.hidden = !q;
          if (!q) return;
          found = searchFor(q);
          res.innerHTML = found.length ? `<p class="srch-n">${found.length > 40 ? '40件以上' : found.length + '件'}見つかりました</p><ul>${found.slice(0, 40).map((r, k) => `<li><button type="button" data-hit="${k}"><b>${esc(r.t)}</b><small>${esc(r.s)}</small>${r.x ? `<span>${esc(snippet(r.x, q))}</span>` : ''}</button></li>`).join('')}</ul>`
            : `<p class="srch-none">「${esc(q)}」は見つかりませんでした。<br><span class="small muted">ひらがなや、短いことば（例：ちゅうしゃじょう、QR）でもお試しください。</span></p>`;
          applyRuby(res);
          sh.scrollTop = 0;
        };
        inp.addEventListener('input', draw);
        $('.srch-x', el).addEventListener('click', () => { inp.value = ''; draw(); inp.focus(); });
        res.addEventListener('click', e => { const b = e.target.closest('[data-hit]'); if (!b) return; const r = found[+b.dataset.hit]; close(); searchGo(r); });
      }, { head: `<div class="srch" role="search"><label class="srch-box">${ic('search')}<input type="search" id="srch" enterkeyhint="search" autocomplete="off" placeholder="ことばで探す（例：駐車場・QR）" aria-label="しおりの中を探す"></label><button type="button" class="srch-x" aria-label="検索のことばを消す">消す</button></div>` });
  }

  /* ========== 文字の大きさ（標準／大）。端末に保存 ========== */
  const FS = { m: '標準', l: '大' };
  const applyFs = v => { if (v === 'l') document.documentElement.dataset.fs = 'l'; else delete document.documentElement.dataset.fs; };
  function setFs(v) {
    store.set('fs', v); applyFs(v);
    /* 地図の高さなどを測り直す */
    dispatchEvent(new Event('resize'));
  }
  applyFs(store.get('fs'));

  /* ========== その他（下から出る一覧） ========== */
  const MORE = [
    ['旅のしたく', [['tip', '旅のワンポイント', '#/tips'], ['book', 'トリビア', '#/trivia'], ['bag', '持ち物チェック', '#/bag'], ['yen', '予算と割り勘メモ', '#/money']]],
    ['やど', [['bed', 'ホテルとお部屋', '#/stay'], ['qr', 'チェックインQR', '#qr']]],
    ['もしも', [['sos', '緊急連絡先・病院', '#/sos']]],
    ['旅の記録', [['pen', '思い出メモ', '#/memo'], ['stamp', 'スタンプ帳', '#/spot/stamps']]]
  ];
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function moreSheet() {
    const fs = store.get('fs') === 'l' ? 'l' : 'm';
    const dark = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    sheet('その他', `${MORE.map(([h, list]) => `<h4 class="more-h">${h}</h4><div class="more-tiles">${list.map(([i, l, href]) => `<a href="${href}"${TOC_ACT[href] ? ` data-act="${TOC_ACT[href]}"` : ''}>${ic(i)}<span>${l}</span></a>`).join('')}</div>`).join('')}
      <h4 class="more-h">おためしモード</h4>
      <button class="more-sim" data-act="sim">${ic('play')}<span><b>旅行中の画面を、先に試せます</b><small>時計を旅行中の日時に合わせて、その時刻の画面を体験します。新幹線の車内（いまどのへん？）の6場面もここから選べます。</small></span></button>
      <h4 class="more-h">設定</h4>
      <div class="more-rows">
        <div class="more-row">${ic('text')}<span>文字の大きさ</span><span class="more-seg" role="group" aria-label="文字の大きさ">${Object.entries(FS).map(([k, l]) => `<button data-fs="${k}" aria-pressed="${fs === k}">${l}</button>`).join('')}</span></div>
        <div class="more-row">${ic('moon')}<span>画面の明るさ</span><span class="more-seg" role="group" aria-label="画面の明るさ"><button data-theme-set="light" aria-pressed="${!dark}">明るい</button><button data-theme-set="dark" aria-pressed="${dark}">暗い</button></span></div>
        <button class="more-row" data-act="fam">${ic('user')}<span>家族を切り替える</span><small>${esc(famName() || '未選択')}</small></button>
        <button class="more-row" data-act="a2hs">${ic('add')}<span>ホーム画面に追加</span><small>${standalone() ? '追加ずみ' : ''}</small></button>
        <button class="more-row" data-act="lockforget">${ic('key')}<span>この端末の合言葉を消す</span><small>${Lock.saved() ? '' : '入力されていません'}</small></button>
      </div>
      <h4 class="more-h">使い方</h4>
      <div class="more-rows">
        <a class="more-row" href="#/help">${ic('help')}<span>使い方</span><small>機能ごとの説明書</small></a>
        <button class="more-row" data-act="toc">${ic('menu')}<span>しおりの目次</span><small>すべてのページ</small></button>
      </div>`,
      (el, close) => {
        $$('[data-act]', el).forEach(b => b.addEventListener('click', e => { e.preventDefault(); close(); }, true));
        $$('[data-fs]', el).forEach(b => b.addEventListener('click', () => { setFs(b.dataset.fs); $$('[data-fs]', el).forEach(x => x.setAttribute('aria-pressed', x === b)); }));
        $$('[data-theme-set]', el).forEach(b => b.addEventListener('click', () => { document.documentElement.dataset.theme = b.dataset.themeSet; store.set('theme', b.dataset.themeSet); $$('[data-theme-set]', el).forEach(x => x.setAttribute('aria-pressed', x === b)); }));
      });
  }
  /* ========== 使い方（#/help、#/help/項目） ==========
     1つの機能を1枚にまとめる：実際の画面の写真＋番号の吹き出し＋1〜2行の説明。
     写真と吹き出しの位置は tools/shoot-manual.js が撮って書き出す（assets/manual/*.webp と marks.json）。
     pts の m:1 が番号付き（写真の上の吹き出しと同じ順）、m の無いものは写真に写っていない補足 */
  const MANUAL = [
    { id: 'top', tab: 'トップ', where: 'しおりを開くと最初に出る〈トップ〉の、表紙とその下のカードの説明です。', ic: 'home', title: 'トップ', sub: '表紙と、出発までのカード', pts: [
      { m: 1, t: '家族を選ぶと、座席・お部屋・チェックインQR・費用がその家族の分になります。' },
      { m: 1, t: 'のぞみ風とかもめ風の列車が、ときどき左から右へ横切ります。表紙を押すと、すぐに走ります。' },
      { m: 1, t: '出発までの日数と、最初に乗る列車です。旅行中は「いまの予定・次の予定」に変わります。' }] },
    { id: 'today', tab: 'きょう', where: '下のタブの〈きょう〉を押したときの、旅行中の画面の説明です。', ic: 'today', title: 'きょう', sub: '旅行中に、まず開く所', pts: [
      { m: 1, t: '下の「きょう」を押すと、いつでもこの画面に戻ります。' },
      { m: 1, t: 'いまの予定と、次の予定です。日付と時刻から自動で選びます。' },
      { m: 1, t: '次に乗る列車と、発車までの時間です。「時刻表」で前後の便も見られます。' }] },
    { id: 'shift', tab: '日程', where: '〈日程〉の行程表で、いまいる地点の「いまここ」を押したときの画面の説明です。', ic: 'here', title: 'いまここ', sub: '予定からずれたとき', pts: [
      { m: 1, t: 'いまいる地点の「いまここ」を押すと、そこを現在地として、この先の予定をずれた分だけ動かした見込みで出します。' },
      { m: 1, t: 'ずれと、出発の見込みです。「予定どおりに戻す」で、いつでも元に戻せます。' },
      { m: 1, t: '見込みの時刻は朱色で「ごろ」と出します。新幹線・特急の発車時刻は動かさず、間に合わなさそうなときは一言でお知らせします。' },
      { t: 'トップの「今日の予定」からも、いまいる所を1回押すだけで合わせられます。' },
      { t: '合わせていないときは、時計だけで決めた「予定では、いまごろ」を出します。合わせた内容はこの端末だけに残り、日付が変わると元に戻ります。' }] },
    { id: 'ride', tab: 'のりもの', where: '下のタブの〈のりもの〉の、一覧の画面の説明です。', ic: 'train', title: 'のりもの', sub: '指定席券・座席表・時刻表', pts: [
      { m: 1, t: '新幹線の中では、ここから「いまどのへん？」を開きます。' },
      { m: 1, t: '見たい項目へ移ります。駅の乗り換え（3D）・時刻表・車窓の城などがあります。' },
      { m: 1, t: '往路と復路を切り替えます。' },
      { m: 1, t: '指定席券です。「座席表とメモ」を開くと、席の位置と進行方向が分かります。' }] },
    { id: 'xfer', tab: 'のりもの', where: '〈のりもの〉の「駅の乗り換え（3D）」から開く、3D乗換図の画面の説明です。', ic: 'walk', title: '駅の乗り換え（3D）', sub: '博多・新大阪での歩き方', pts: [
      { m: 1, t: 'しおりに戻ります。開く前に見ていた画面へ戻ります。' },
      { m: 1, t: '4つの場面（往路・復路の博多と新大阪）を切り替えます。' },
      { m: 1, t: '階段・エスカレーターか、エレベーター（ベビーカー）かを選びます。' },
      { m: 1, t: '「出発進行」で、歩く道順を順にたどります。図は1本指で回り、2本指で拡大できます。' }] },
    { id: 'live', tab: 'のりもの', where: '〈のりもの〉の「いまどのへん？」を開いたときの、地図の画面の説明です。', ic: 'map', title: 'いまどのへん？', sub: 'のぞみ・リレーかもめの車内で', pts: [
      { m: 1, t: '自分の列車です。鼻先が進む向きを向いています。' },
      { m: 1, t: '方位磁針。押すたびに「北が上」と「進行方向が上」が切り替わります。' },
      { m: 1, t: '立体（斜めから見下ろす地図）と、平面を切り替えます。山の盛り上がり（立体の地形）は、地図の種類が航空写真のときだけです。ほかの地図は文字が描き込まれていて、盛り上げると読みにくいため、立体でも平らです。' },
      { m: 1, t: '地図だけを大きく表示します。' },
      { m: 1, t: 'この説明書と、画面の上での案内を開きます。' },
      { m: 1, t: '次の停車駅と、到着までの時間です。' },
      { m: 1, t: '時速です。下の線は速さの目安で、時速300kmでいっぱいになります。全画面では、この札が画面の下に出ます。' },
      { t: '地図は1回押すと、指で動かせるようになります。動かしたあとは、操作ボタンの「列車へ」で列車の位置に戻ります。' },
      { t: '地図の右下の「自動ズーム：オン」のあいだは、停車駅に近づくと着く前から少しずつ拡大し、駅前の建物や道が分かるくらいまで寄ります。駅を出ると少しずつ戻ります。押すとオフになり、縮尺を自動では変えません。指で拡大・縮小しても自動は止まらず、その縮尺を「走行中の縮尺」として覚えます。「元の縮尺に戻す」で最初の縮尺に戻ります。' },
      { t: '乗車の時間帯（発車の30分前〜到着の2時間後）は、位置の情報を許可していれば、ボタンを押さなくてもGPSで遅れを測り、「約○分遅れ」と出して、次の駅まで・到着・降車のお知らせ・駅一覧の時刻をずらします。時間帯が終わると、自動で止まります。' },
      { t: '位置の情報の許可は、端末ごとに一度だけ必要です。旅行の前に、いまどのへん？を開くと出る案内の「許可する」を押しておいてください（当日まではGPSを使いません）。許可していない端末には、乗車の時間帯に画面の上に「使う」が出ます。' },
      { t: '「GPSを止める」を押すと、そのタブのあいだは自動で使いません。それ以外の時間は、「現在地を使う」を押したときだけ使います。運行の状況は、地図の下の「JR公式の運行情報」で確かめられます。' },
      { t: '地図の左上の「いま ○○県 ○○市」は、列車の位置から決めた、いまいる市区町村です（電波がなくても出ます）。地図の種類を「住所（市区町村）」（下は淡色の地図）か「住所（航空写真）」にすると、市区町村を色分けして、境界線と名前（ふりがな付き）を出します。色分けの濃さは、地図の種類のメニューと設定の「住所の地図の塗りの濃さ」のつまみで変えられ、いちばん左で塗りなし（境界線と名前だけ）になります。境界線は、設定か地図の種類のメニューで、どの地図にも重ねられます。' },
      { t: '立体のとき・航空写真・住所の地図では、市区町村の名前と、山（▲と標高）・川（線路が渡る所）・海や湾などの名前を、画面に向けて立てて出します。縮尺に合わせて数を絞り、見どころ・駅名と重なるときは省きます。設定の「地名」「自然地名」で消せます。' },
      { t: '止まらずに通る駅（通過駅）に近づくと、2分ほど前から「まもなく○○駅を通過」と、駅の読み・府県・ひとことが出ます。地図の駅のピンと、下の見どころ一覧からも紹介を開けます。' },
      { t: '写真はのぞみの画面です。リレーかもめ（武雄温泉〜博多）も同じ画面で、列車の印は黒い787系、時速の線は130kmでいっぱいになります。見出しの右上の「のぞみ（…）へ」「リレーかもめ（…）へ」で、もう一方の列車に移れます。' }] },
    { id: 'memories', tab: 'トップ', where: '旅行が終わったあと（10/20 の最後の到着のあと）に開いた〈トップ〉の説明です。写真は、おためしモードの「10/21 思い出モード」の画面です。', ic: 'stamp', title: '思い出モード', sub: '旅行のあとの表紙とまとめ', pts: [
      { m: 1, t: '旅行が終わると、表紙が「おかえりなさい」に変わります。' },
      { m: 1, t: '移動した距離です。予定の行程から計算した往復の合計と、乗り物ごとの内訳を出します。' },
      { m: 1, t: '行った場所です。スタンプを押した場所と日時を並べます（その端末で押したぶんだけ）。' },
      { m: 1, t: '「旅行中のしおりを見る」で、今までどおりの表紙に戻ります。日程・のりもの・まっぷなどは、思い出モードのあいだも今までどおり使えます。' },
      { t: '旅の数字（日数・乗った列車の本数・立ち寄った所）は、しおりの行程のデータから出しています。思い出メモを書いていれば、その入口も出ます。予算の決算が入っていれば「予算／実績を見る」も出ます。' },
      { t: '写真は扱いません。「旅行中のしおりを見る」はタブを閉じるまでで、開き直すと思い出モードに戻ります。' }] },
    { id: 'search', tab: 'すべての画面', where: '右上の「目次」か、〈その他〉のいちばん下の「しおりの目次」から開く、目次と検索の説明です。', ic: 'search', title: '目次と検索', sub: 'あの情報はどこ？', pts: [
      { m: 1, t: 'ことばを入れると、しおりの中から探します。ひらがなでも探せます。電波がなくても使えます。' },
      { m: 1, t: '見つかった所を押すと、その場所へ移って、短く光ります。' },
      { t: '何も入れないときは、タブと同じ5つに分けた目次です。見出しを押すと、たためます。' }] },
    { id: 'sim', tab: 'その他', where: '〈その他〉の「おためしモード」で場面を選んだあとの、画面の上の帯の説明です。', ic: 'play', title: 'おためしモード', sub: '旅行中の画面を、先に試す', pts: [
      { m: 1, t: 'おためし中は、画面の上に帯が出ます。時計は旅行中の日時になります。' },
      { m: 1, t: '再生・一時停止と、早送り（×1・×10・×60）です。' },
      { m: 1, t: '「終了」で本物の時刻に戻ります。' },
      { m: 1, t: '始めるときは「その他」→「おためしモード」から、場面を選びます。' }] },
    { id: 'qr', tab: 'トップ・日程', where: 'トップや日程の「チェックインQR」を押したときに出る、合言葉の画面の説明です。', ic: 'qr', title: '予約とQR', sub: '合言葉・画像として保存', pts: [
      { m: 1, t: '初めて表示するときに、合言葉を入れます。合言葉は家族のLINEでご確認ください。' },
      { m: 1, t: '一度入れると、この端末では次から入れずに表示します。' },
      { t: '表示した画面の「画像として保存」で、予約番号とQRを1枚の画像にして端末に残せます。' },
      { t: '端末を人に貸すときなどは、「その他」→「この端末の合言葉を消す」を押します。' }] },
    { id: 'a2hs', tab: 'その他', where: '〈その他〉の「ホーム画面に追加」を押したときの、案内の画面の説明です。', ic: 'add', title: 'ホーム画面に追加', sub: 'アプリのように開く', pts: [
      { m: 1, t: 'ホーム画面には「旅のしおり」の名前で並びます。' },
      { m: 1, t: 'Pixel は確認の画面で「追加」を押すと完了です。iPhone は手順の案内が出ます。' },
      { t: '「その他」→「ホーム画面に追加」から、いつでも追加できます。' }] },
    { id: 'fs', tab: 'その他', where: '〈その他〉の画面の下にある、表示の設定の説明です。', ic: 'text', title: '文字を大きく', sub: '標準と大', pts: [
      { m: 1, t: '「その他」の設定で、文字の大きさを「標準」「大」から選びます。選んだ大きさは、この端末に残ります。' },
      { m: 1, t: '画面の明るさ（明るい・暗い）も、ここで切り替えられます。' }] },
    { id: 'offline', tab: 'のりもの', where: '電波がないときに〈いまどのへん？〉を開いた、地図の画面の説明です。', ic: 'sos', title: '電波が無いとき', sub: '機内モードでも開けます', pts: [
      { m: 1, t: '列車の位置は時刻表から推定するので、電波がなくても動きます。' },
      { m: 1, t: '地図の下地は、一度表示した所だけ出ます。航空写真は保存しません。' },
      { t: 'しおりは端末に保存されます。電波がなくても、ホーム画面やブックマークから開けます。' },
      { t: '天気予報と、外部のサイトへのリンクは、電波が戻ってからご覧ください。' }] },
    { id: 'news', tab: 'トップ', where: 'トップの表紙の右上にある、ベルの印（お知らせ）の説明です。', ic: 'bell', title: 'お知らせ', sub: 'しおりが変わったとき', pts: [
      { m: 1, t: 'ベルを押すと、お知らせの一覧が開きます。まだ読んでいないお知らせがあると、件数が付きます。' },
      { m: 1, t: '一覧の行を押すと、詳しい説明が出ます。「その場所を見る」で、変わった画面へ移って、その場所が短く光ります。' },
      { t: 'お知らせは、しおりを直したときに足していきます。読んだかどうかは、この端末に覚えます。' }] },
    { id: 'intro', tab: 'トップ', where: '初めて開いたときに、画面の案内の前に出る「このしおりで、できること」のスライドの説明です。', ic: 'play', title: '機能紹介', sub: 'このしおりで、できること', pts: [
      { m: 1, t: '横にめくると、次の機能の紹介に進みます。動画は、そのスライドを開いたときに再生します。' },
      { m: 1, t: '下の点で、いま何枚目かが分かります。' },
      { m: 1, t: '「スキップ」を押すと、紹介を閉じて画面の案内へ進みます。' },
      { t: 'この使い方ページの目次の下にある「機能紹介をもう一度見る」から、いつでも見直せます。' }] },
    { id: 'xhelp', tab: 'のりもの', where: '3D乗換図を初めて開いたときに出る、ボタンの案内の説明です。', ic: 'walk', title: '3D乗換図の案内', sub: 'ボタンを1つずつ説明', pts: [
      { m: 1, t: '白い枠で囲んだボタンの役目を、1つずつ説明します。「次へ」で進みます。' },
      { m: 1, t: '「閉じる」で、いつでも案内を終えられます。' },
      { m: 1, t: '右上の「？」から、もう一度見られます。' }] }
  ];
  const MAN_V = 33;   // 使い方の写真と吹き出しの位置。sw.js の ?v= と同じ番号にする（電波がなくても、保存した写真を使えるように）
  let manMarks = null;
  const loadMarks = () => manMarks || (manMarks = fetch(`assets/manual/marks.json?v=${MAN_V}`).then(r => r.ok ? r.json() : {}).catch(() => { manMarks = null; return {}; }));
  function viewHelp(id) {
    const i = MANUAL.findIndex(x => x.id === id);
    if (i < 0) return `<div class="wrap">${topbar()}${phead('Guide', '使い方', '機能ごとに、1枚ずつまとめました。見たい項目を押してください。')}
      <div class="hp-tiles">${MANUAL.map((x, k) => `<a href="#/help/${x.id}"><span class="hp-n num">${k + 1}</span>${ic(x.ic)}<span><b>${x.title}</b><small>${x.sub}</small></span></a>`).join('')}</div>
      <section class="sec">${secH('画面の上の案内', 'Tour')}
        <div class="more-rows"><button class="more-row" data-act="guide-app">${ic('help')}<span>画面の案内をもう一度見る</span><small>下のタブの使い分け</small></button>
        <button class="more-row" data-act="guide-live">${ic('train')}<span>いまどのへん？の案内を見る</span><small>地図の見方と操作</small></button>
        <a class="more-row" href="transfer.html#s1-guide">${ic('walk')}<span>3D乗換図の案内を見る</span><small>ボタンを1つずつ説明</small></a>
        <button class="more-row" data-act="intro">${ic('play')}<span>機能紹介をもう一度見る</span><small>このしおりで、できること</small></button></div></section></div>`;
    const x = MANUAL[i], prev = MANUAL[i - 1], next = MANUAL[i + 1];
    let n = 0;
    const src = `assets/manual/${x.id}.webp?v=${MAN_V}`;
    return `<div class="wrap">${topbar()}<a class="hp-back" href="#/help">‹ 使い方の目次</a>
      <div class="phead hp-head"><div class="eyebrow num">${i + 1} / ${MANUAL.length}</div><h1>${x.title}</h1></div>
      ${x.where ? `<p class="hp-where"><span class="hp-tab">${esc(x.tab)}</span><span>${esc(x.where)}</span></p>` : ''}
      <figure class="hp-fig" id="hp-fig" data-id="${x.id}"><img src="${src}" alt="${esc(x.title)}の画面" decoding="async"><div class="hp-marks" aria-hidden="true"></div></figure>
      <ol class="hp-pts">${x.pts.map(p => `<li class="${p.m ? '' : 'plain'}">${p.m ? `<span class="hp-no num">${++n}</span>` : '<span class="hp-dot" aria-hidden="true"></span>'}<span>${esc(p.t)}</span></li>`).join('')}</ol>
      <nav class="hp-pager" aria-label="前後の項目">${prev ? `<a href="#/help/${prev.id}">‹ ${prev.title}</a>` : '<span></span>'}${next ? `<a href="#/help/${next.id}">${next.title} ›</a>` : '<a href="#/help">目次へ ›</a>'}</nav></div>`;
  }
  /* 写真の上に、番号の吹き出しと枠を置く（位置は写真に対する割合） */
  function drawMarks() {
    const fig = $('#hp-fig'); if (!fig) return;
    loadMarks().then(all => {
      const box = $('.hp-marks', fig), m = all[fig.dataset.id];
      if (!box || !m) return;
      box.innerHTML = m.marks.map((r, k) => r ? `<i class="hp-mk" style="left:${r[0]}%;top:${r[1]}%;width:${r[2]}%;height:${r[3]}%"></i><b class="hp-bub num" style="left:max(${r[0]}%, 11px);top:max(${r[1]}%, 11px)">${k + 1}</b>` : '').join('');
    });
  }
  /* 画面の上の案内（コーチマーク）の見直し */
  function replayGuide(which) {
    if (which === 'app') { if (location.hash !== '#/') location.hash = '#/'; setTimeout(() => appGuide(true), 500); return; }
    const k = liveDefault();
    if (!location.hash.startsWith('#/ride/live/' + k) || location.hash.endsWith('/full')) location.hash = '#/ride/live/' + k;
    setTimeout(() => window.LiveMap && LiveMap.guide ? LiveMap.guide() : null, 900);
  }

  /* ========== ホーム画面に追加（案内） ==========
     初めて開いたときに出す。「あとで」は次に開いたときにもう一度。「今後は表示しない」・ホーム画面から開いているときは出さない */
  let bip = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); bip = e; });
  addEventListener('appinstalled', () => { bip = null; store.set('a2hs', 'done'); });
  const UA = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(UA);
  const inApp = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|KAKAOTALK|YJApp|Twitter|TikTok|musical_ly/i.test(UA);
  const a2hsDue = () => !standalone() && store.get('a2hs') !== 'never' && store.get('a2hs') !== 'done' && !session.get('a2hsAsked') && (isIOS || isAndroid);
  const HOMEICON = '<img class="a2-icon" src="assets/icon.svg" alt="" width="52" height="52">';
  const SHARE = '<svg class="a2-sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v8A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 9H16M12 14V3.5M8.5 7 12 3.5 15.5 7"/></svg>';
  const ADDSQ = '<svg class="a2-sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
  /* auto：初回の自動表示（「あとで」「今後は表示しない」を出す） */
  function a2hsSheet(auto = false) {
    return new Promise(done => {
      if (auto) session.set('a2hsAsked', '1');
      const url = location.href.split('#')[0];
      let body;
      if (standalone()) body = `<p class="a2-lead">このしおりは、ホーム画面から開いています。追加の必要はありません。</p>`;
      else if (inApp) body = `<p class="a2-lead">LINE などのアプリの中の画面では、ホーム画面に追加できません。<b>${isIOS ? 'Safari' : 'Chrome'}</b>で開き直してから、もう一度お試しください。</p>
        <p class="small muted">${isIOS ? '右下（または右上）のメニューから「ブラウザで開く」「Safariで開く」を選ぶか、' : '右上のメニュー（︙）から「ブラウザで開く」を選ぶか、'}下のアドレスをコピーして貼り付けてください。</p>
        <div class="a2-url"><span class="num">${esc(url)}</span><button class="btn quiet" data-a2="copy">コピー</button></div>`;
      else body = `<p class="a2-lead">ホーム画面に置くと、アプリのように1回のタップで開けます。電波が弱い場所でも開きやすくなります。</p>`;
      const btns = standalone() || inApp ? (auto ? '<div class="a2-btns"><button class="btn quiet" data-a2="later">閉じる</button></div>' : '')
        : `<div class="a2-btns"><button class="btn fill" data-a2="yes">ホーム画面に追加する</button>${auto ? '<button class="btn quiet" data-a2="later">あとで</button>' : ''}</div>${auto ? '<button class="a2-never" data-a2="never">今後は表示しない</button>' : ''}`;
      sheet('ホーム画面に追加しますか？', `<div class="a2-top">${HOMEICON}<div><b>旅のしおり</b><small>奈良・大阪 2026</small></div></div>${body}<div class="a2-steps"></div>${btns}`, (el, close) => {
        el.addEventListener('click', async e => {
          const b = e.target.closest('[data-a2]'); if (!b) return;
          const k = b.dataset.a2;
          if (k === 'copy') return copy(url);
          if (k === 'later') return close();
          if (k === 'never') { store.set('a2hs', 'never'); toast('今後は表示しません。「その他」からいつでも追加できます'); return close(); }
          if (k === 'yes') {
            if (bip) {
              const ev = bip; bip = null;
              try { ev.prompt(); const r = await ev.userChoice; if (r && r.outcome === 'accepted') store.set('a2hs', 'done'); } catch { /* noop */ }
              return close();
            }
            /* iPhone は自動で追加できないので、手順を示す。Android で確認画面を出せないときも手順を示す */
            $('.a2-steps', el).innerHTML = isIOS ? `<ol class="a2-list">
                <li><span class="a2-n">1</span><span>画面の下の<b>共有ボタン</b>${SHARE}を押します<small>（□から↑が出ている形です）</small></span></li>
                <li><span class="a2-n">2</span><span>一覧を上へずらし、<b>「ホーム画面に追加」</b>${ADDSQ}を押します</span></li>
                <li><span class="a2-n">3</span><span>右上の<b>「追加」</b>を押すと完了です</span></li></ol>`
              : `<ol class="a2-list"><li><span class="a2-n">1</span><span>画面の右上のメニュー<b>（︙）</b>を押します</span></li>
                <li><span class="a2-n">2</span><span><b>「ホーム画面に追加」</b>または<b>「アプリをインストール」</b>を押します</span></li>
                <li><span class="a2-n">3</span><span>確認の画面で<b>「追加」</b>（または「インストール」）を押すと完了です</span></li></ol>`;
            b.closest('.a2-btns').innerHTML = '<button class="btn quiet" data-a2="later">閉じる</button>';
            const nv = $('.a2-never', el); nv && nv.remove();
            if (isIOS) { const ar = document.createElement('div'); ar.className = 'a2-arrow'; ar.setAttribute('aria-hidden', 'true'); ar.innerHTML = '<span>共有ボタンは、画面のいちばん下にあります</span><i>↓</i>'; $('.sheet', el).appendChild(ar); }
          }
        });
        return () => done();
      });
    });
  }

  /* ========== おためし（シミュレーション） ========== */
  const MD = date => date.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
  const DOW = '日月火水木金土';
  const dowJ = date => DOW[new Date(date + 'T12:00:00+09:00').getDay()];
  const SCENES = [
    ['駅の時刻表', [
      { id: 'tt-d1', title: '10/17（土）16:05　新大阪駅から梅田へ', text: '御堂筋線の時刻表と「次の3本」。16:13の便が乗る予定の便です。', t: '2026-10-17T16:05', go: '#/trip/1', tt: 'd1-shinosaka', pos: [34.7334, 135.5002, '新大阪駅'] },
      { id: 'tt-d3', title: '10/19（月）10:00　道頓堀から、なんば駅へ', text: '平日ダイヤの千日前線。10:25の便で谷町九丁目へ。', t: '2026-10-19T10:00', go: '#/trip/3', tt: 'd3-namba', pos: [34.6687, 135.5013, '道頓堀'] }
    ]],
    ['旅の場面', [
      { id: 'kamome', title: '10/17 10:30　かもめ92号に乗車中', t: '2026-10-17T10:30', go: '#/' },
      { id: 'hakata', title: '10/17 12:05　博多で乗り換え', t: '2026-10-17T12:05', go: '#/trip/1' },
      { id: 'nozomi28', title: '10/17 13:37　のぞみ28号・福山の手前', t: '2026-10-17T13:37', go: '#/ride/live/nozomi28', pos: { track: 'nozomi28' } },
      { id: 'nara', title: '10/18 14:40　奈良公園', t: '2026-10-18T14:40', go: '#/trip/2' },
      { id: 'loop', title: '10/18 17:12　環状線ドライブ', t: '2026-10-18T17:12', go: '#/trip/2' },
      { id: 'dotonbori', title: '10/19 9:50　道頓堀', t: '2026-10-19T09:50', go: '#/trip/3' },
      { id: 'nozomi17', title: '10/20 11:24　のぞみ17号・姫路の手前', t: '2026-10-20T11:24', go: '#/ride/live/nozomi17', pos: { track: 'nozomi17' } },
      { id: 'after', title: '10/20 18:00　旅行のあと', t: '2026-10-20T18:00', go: '#/' },
      /* 思い出モード：おためし中だけの仮のスタンプ（3か所）を置いて開く。本当の記録（localStorage の stamps）は使わない */
      { id: 'memories', title: '10/21 思い出モード', text: '表紙が「おかえりなさい」に変わり、旅のまとめ（移動した距離・旅の数字・行った場所）が出ます。スタンプは、おためし用に3か所押した状態です。', t: '2026-10-21T10:00', go: '#/',
        stamps: { deer: '2026-10-18T14:52:00+09:00', todaiji: '2026-10-18T15:20:00+09:00', dotonbori: '2026-10-19T09:58:00+09:00' } }
    ]],
    ['雨の日の表示（降水確率を仮に80%にする）', [
      { id: 'rain2', title: '10/18（日）8:00　雨の予報の日（奈良）', text: '日程の見出しの下に「雨の日はこちら」が出ます。押すと屋内の候補の一覧です。', t: '2026-10-18T08:00', go: '#/trip/2', rain: 80 },
      { id: 'rain3', title: '10/19（月）8:30　雨の予報の日（大阪）', t: '2026-10-19T08:30', go: '#/trip/3', rain: 80 }
    ]],
    ['いまどのへん？（のぞみの車内）', [
      { id: 'lm28', title: '10/17 12:13　のぞみ28号・博多を発車（往路）', text: '作り物のGPSが線路を進みます。上の帯の「×1」を押すと×10・×60に早送りできます。', t: '2026-10-17T12:13', go: '#/ride/live/nozomi28', pos: { track: 'nozomi28' } },
      { id: 'lm28-kanmon', title: '10/17 12:34　のぞみ28号・関門トンネルの手前', text: 'トンネルでGPSが途切れ、時刻表からの推定に切り替わります。', t: '2026-10-17T12:34', go: '#/ride/live/nozomi28', pos: { track: 'nozomi28' } },
      { id: 'lm28-late', title: '10/17 13:45　のぞみ28号・5分遅れ（福山の手前）', text: 'GPSから遅れを見つけて「約5分遅れ」と表示。到着時刻とアラームもずれます。', t: '2026-10-17T13:45', go: '#/ride/live/nozomi28', pos: { track: 'nozomi28', delay: 5 } },
      { id: 'lm28-late30', title: '10/17 12:10　のぞみ28号・30分遅れ（博多で発車待ち）', text: '博多に止まったまま遅れの分数が増え、30分遅れて発車します。次の駅まで・到着・降車のお知らせ・駅一覧の時刻が、遅れを足した時刻になります。トンネルでGPSが途切れても、遅れを使い続けます。', t: '2026-10-17T12:10', go: '#/ride/live/nozomi28', pos: { track: 'nozomi28', delay: 30 } },
      { id: 'lm28-arr', title: '10/17 14:36　のぞみ28号・新大阪の7分前', text: '降車アラーム（5分前・1分前）の確認に。', t: '2026-10-17T14:36', go: '#/ride/live/nozomi28', pos: { track: 'nozomi28' } },
      { id: 'lm17', title: '10/20 11:01　のぞみ17号・新大阪を発車（復路）', t: '2026-10-20T11:01', go: '#/ride/live/nozomi17', pos: { track: 'nozomi17' } },
      { id: 'lm17-arr', title: '10/20 13:20　のぞみ17号・博多の手前', text: '降車アラームと、リレーかもめへの乗り換えカウントダウン。', t: '2026-10-20T13:20', go: '#/ride/live/nozomi17', pos: { track: 'nozomi17' } }
    ]],
    ['いまどのへん？（リレーかもめの車内）', [
      { id: 'lmr92', title: '10/17 10:38　リレーかもめ92号・武雄温泉を発車（往路）', text: '作り物のGPSが線路を進みます。上の帯の「×1」を押すと×10・×60に早送りできます。', t: '2026-10-17T10:38', go: '#/ride/live/relay92', pos: { track: 'relay92' } },
      { id: 'lmr92-late10', title: '10/17 10:38　リレーかもめ92号・10分遅れ（武雄温泉で発車待ち）', text: '武雄温泉に止まったまま遅れの分数が増え、10分遅れて発車します。次の駅まで・到着・のぞみ28号への乗り換え・駅一覧の時刻が、遅れを足した時刻になります。', t: '2026-10-17T10:38', go: '#/ride/live/relay92', pos: { track: 'relay92', delay: 10 } },
      { id: 'lmr92-arr', title: '10/17 11:34　リレーかもめ92号・博多の8分前', text: '降車アラームと、のぞみ28号への乗り換えカウントダウン。', t: '2026-10-17T11:34', go: '#/ride/live/relay92', pos: { track: 'relay92' } },
      { id: 'lmr33', title: '10/20 13:52　リレーかもめ33号・博多を発車（復路）', t: '2026-10-20T13:52', go: '#/ride/live/relay33', pos: { track: 'relay33' } },
      { id: 'lmr33-arr', title: '10/20 14:46　リレーかもめ33号・武雄温泉の8分前', text: '降車アラームと、かもめ33号への乗り換えカウントダウン。', t: '2026-10-20T14:46', go: '#/ride/live/relay33', pos: { track: 'relay33' } }
    ]]
  ];
  const sceneById = id => SCENES.flatMap(([, l]) => l).find(s => s.id === id);
  function startScene(sc) {
    session.set('simRain', sc.rain ? String(sc.rain) : null);
    if (sc.stamps) session.set('stamps-sim', JSON.stringify(sc.stamps));   // おためし中だけの記録（Stamps は Clock.active() のあいだ sessionStorage を見る）
    session.set('memTrip', null);
    Clock.start(sc.t, { scenario: { id: sc.id, title: sc.title }, pos: sc.pos || null });
    if (sc.go && location.hash !== sc.go) location.hash = sc.go; else render();
    if (sc.tt) setTimeout(() => openTT({ leg: sc.tt, preview: false }), 350);
  }
  function simSheet() {
    const cur = Clock.state();
    const d = cur ? cur.now : new Date('2026-10-17T10:00:00+09:00');
    const local = new Date(d.getTime() + 9 * 36e5).toISOString().slice(0, 16);
    sheet('おためしモード', `<p class="small muted">時計を旅行中の日時に合わせて、その時刻の画面を先に体験できます。おためし中は画面の上に帯が出ます。「終了」を押すか、このタブを閉じると、本物の時刻に戻ります。</p>
      ${SCENES.map(([h, list]) => `<h4 class="sim-h">${h}</h4><div class="pick sim-pick">${list.map(sc => `<button data-scene="${sc.id}"><span><b>${esc(sc.title)}</b>${sc.text ? `<br><span class="small muted">${esc(sc.text)}</span>` : ''}</span><span aria-hidden="true">→</span></button>`).join('')}</div>`).join('')}
      <h4 class="sim-h">日時を指定</h4>
      <form class="sim-form" id="simform"><input type="datetime-local" id="sim-at" value="${local}" min="2026-09-01T00:00" max="2026-11-30T23:59" aria-label="おためしの日時"><button class="btn fill" type="submit">この日時で始める</button></form>
      ${cur ? `<h4 class="sim-h">雨の日の表示</h4><p class="small muted">降水確率を仮に80%にして、日程の「雨の日はこちら」（2日目・3日目）を確かめられます。おためしを終えると元に戻ります。</p><div class="btns"><button class="btn quiet" data-sim="rain">${simRain() ? '予報どおりの降水確率に戻す' : '降水確率を80%にする'}</button></div>` : ''}
      ${cur ? '<div class="btns"><button class="btn quiet" data-sim="stop">おためしを終了して、本物の時刻に戻す</button></div>' : ''}`,
      (el, close) => {
        $$('[data-scene]', el).forEach(b => b.addEventListener('click', () => { close(); startScene(sceneById(b.dataset.scene)); }));
        $('#simform', el).addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const v = $('#sim-at', el).value; if (!v) return; close(); Clock.start(v, { scenario: { title: '日時を指定' } }); render(); });
        $$('[data-sim]', el).forEach(b => b.addEventListener('click', () => close()));
      });
  }
  function seekSheet() {
    const st = Clock.state(); if (!st) return;
    const local = new Date(st.now.getTime() + 9 * 36e5).toISOString().slice(0, 16);
    const jumps = T.days.map(d => { const f = d.items && d.items[0]; return f ? [`${d.label}（${d.dow}）${f.dep || f.arr}`, `${d.date}T${pad(f.dep || f.arr)}`] : null; }).filter(Boolean);
    sheet('時刻を動かす', `<div class="seek-steps">${[['−1時間', -60], ['−10分', -10], ['+10分', 10], ['+1時間', 60]].map(([l, m]) => `<button class="btn quiet" data-shift="${m}">${l}</button>`).join('')}</div>
      <form class="sim-form" id="seekform"><input type="datetime-local" id="seek-at" value="${local}" aria-label="飛ぶ日時"><button class="btn fill" type="submit">この時刻へ</button></form>
      <h4 class="sim-h">各日の出発時刻へ</h4><div class="seek-steps">${jumps.map(([l, v]) => `<button class="btn quiet" data-jump="${v}">${l}</button>`).join('')}</div>`,
      (el, close) => {
        $$('[data-shift]', el).forEach(b => b.addEventListener('click', () => { Clock.shift(+b.dataset.shift * 6e4); close(); }));
        $$('[data-jump]', el).forEach(b => b.addEventListener('click', () => { Clock.seek(b.dataset.jump); close(); }));
        $('#seekform', el).addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); const v = $('#seek-at', el).value; if (v) { Clock.seek(v); close(); } });
      });
  }
  const simTime = d => `${d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })}（${DOW[dowOf(d)]}）<b>${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tokyo' })}</b>`;
  function simBar() {
    const st = Clock.state();
    let bar = $('.simbar');
    document.body.classList.toggle('sim-on', !!st);
    if (!st) { bar && bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.className = 'simbar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'おためし中の操作'); document.body.prepend(bar); }
    const html = `<div class="sb-l"><span class="sb-tag">おためし中<small>SIMULATION</small></span><span class="sb-time num" aria-live="off">${simTime(st.now)}</span></div>
      <div class="sb-r"><button data-sim="toggle" aria-label="${st.paused ? '再生' : '一時停止'}">${st.paused ? '▶' : '❚❚'}</button><button data-sim="speed" aria-label="再生速度">×${st.speed}</button><button data-sim="seek">時刻</button><button data-sim="stop" class="sb-stop">終了</button></div>`;
    if (bar.dataset.v !== html) { bar.innerHTML = html; bar.dataset.v = html; }
  }

  /* ========== 位置の情報の許可の案内 ==========
     いまどのへん？は、乗車の時間帯（発車の30分前〜到着の2時間後）に、許可が済んでいればGPSを自動で使う（livemap.js）。
     許可はブラウザの決まりで、端末ごとに一度は本人が「許可」を押す必要があるので、次のときだけ案内を出す：
       ・旅行前（10/16 まで）に、いまどのへん？を開いたとき（まだ聞かれていない端末に一度だけ。押すと許可の確認だけ出し、GPSはすぐやめる）
       ・乗車の時間帯に、どの画面でも（まだ聞かれていない端末は「使う」1つ。押すとすぐブラウザの確認が出る）
       ・拒否されている端末には、設定から許可し直す方法を短く
     ページから端末の設定を直接オンにすることはできない（ボタンを押してもらう形が限界）。おためし中は出さない（テストの差し替え ?perm= のときは出す） */
  const GEO_PRE_END = '2026-10-16';
  const geoNeed = st => st === 'prompt' || st === 'unknown';
  const GEO_STEPS = {
    android: ['Android の Chrome', ['アドレスバーの左の印（調整のつまみの形）を押す →「権限」→「位置情報」をオン。', '見つからないときは、Chrome の右上の︙ →「設定」→「サイトの設定」→「位置情報」→ このしおりを「許可」。']],
    pwa: ['ホーム画面の「旅のしおり」から開いているとき', ['ホーム画面の「旅のしおり」を長押し →「アプリ情報」→「権限」→「位置情報」→「アプリの使用中のみ許可」。', 'それでも出ないときは、上の Chrome の手順でも許可します。']],
    ios: ['iPhone の Safari', ['「設定」アプリ →「プライバシーとセキュリティ」→「位置情報サービス」がオンか確かめ、同じ画面の下の「Safari の Webサイト」→「使用中のみ（または次回確認）」。', 'Safari でしおりを開き、アドレスバーの「ぁあ」（または「AA」）→「Webサイトの設定」→「位置情報」→「許可」。ホーム画面から開いているときも同じです。']]
  };
  const GEO_OFF = {
    android: ['Android', ['画面の上から下へ2回なぞって、クイック設定の「位置情報」をオン。', 'または「設定」アプリ →「位置情報」→「位置情報を使用」をオン。']],
    ios: ['iPhone', ['「設定」アプリ →「プライバシーとセキュリティ」→「位置情報サービス」をオン。']]
  };
  const stepsHTML = ([h, l]) => `<div class="ga-steps"><h4>${h}</h4><ol>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
  function geoHelp(kind) {
    if (kind === 'off') {
      const order = isIOS ? ['ios', 'android'] : ['android', 'ios'];
      sheet('端末の位置情報をオンにする', `<p class="small">位置の情報は許可されましたが、端末そのものの位置情報がオフのようです。しおりから端末の設定をオンにすることはできないので、次の手順でオンにしてください。Android の Chrome では、許可のあとに「位置情報をオンにする」確認が出ることがあります。そのときは「OK」を押すだけです。</p>
        ${order.map(k => stepsHTML(GEO_OFF[k])).join('')}
        <p class="note">オンにしたら、いまどのへん？を開き直すと、遅れに合わせて動きます。</p>`);
      return;
    }
    const order = isIOS ? ['ios', 'android', 'pwa'] : standalone() ? ['pwa', 'android', 'ios'] : ['android', 'pwa', 'ios'];
    sheet('位置の情報を許可し直す', `<p class="small">この端末では、しおりの位置の情報が「拒否」になっています。しおりからは許可し直せないので、次の手順で許可してください。許可しなくても、いまどのへん？は時刻表どおりに動きます（遅れには合わせられません）。</p>
      ${order.map(k => stepsHTML(GEO_STEPS[k])).join('')}
      <p class="note">位置の情報は、いまどのへん？で列車の遅れを測るためだけに、この端末の中で使います。どこにも送りません。</p>`);
  }
  function geoAskRun(btn, pre) {
    btn.disabled = true;
    GeoPerm.request().then(r => {
      if (pre) store.set('geoPre', 'done');
      if (r === 'granted') toast(pre ? '許可しました。当日、乗車の時間帯に自動で使います（いまは使いません）' : '位置の情報を使います。遅れに合わせて動かします', 3200);
      else if (r === 'denied') geoHelp('denied');
      else if (r === 'off') geoHelp('off');
      geoAsk();
    });
  }
  function geoAsk() {
    let el = $('#geoask');
    const st = GeoPerm.state(), sim = Clock.active() && !GeoPerm.test();
    const rk = !sim && window.LiveMap && LiveMap.rideKey ? LiveMap.rideKey() : null;
    const isLive = /^#\/ride\/live\//.test(location.hash);
    let html = '', kind = '';
    if (rk && !session.get('geoAskX') && !$('.cover.mem', app)) {   // 思い出モードの表紙（旅行のあと）では出さない
      if (geoNeed(st)) { kind = 'ride'; html = `<p class="ga-t"><b>遅れに合わせて動かすため、位置の情報を使います</b><span>いまどのへん？の時刻（次の駅まで・到着・降車のお知らせ）を、列車の遅れに合わせます。位置はこの端末の中だけで使います。</span></p><button class="btn fill ga-go" data-ga="go">使う</button>`; }
      else if (st === 'denied') { kind = 'ride denied'; html = `<p class="ga-t"><b>位置の情報が「拒否」になっています</b><span>いまどのへん？は時刻表どおりに動き、遅れには合わせられません。設定で許可し直せます。</span></p><button class="btn quiet ga-go" data-ga="help">許可し直す方法</button>`; }
    } else if (isLive && !sim && ymd(now()) <= GEO_PRE_END && !store.get('geoPre')) {
      if (geoNeed(st)) { kind = 'pre'; html = `<p class="ga-t"><small>旅行の前に、一度だけ</small><b>当日、遅れに合わせて動かすため、位置の情報を許可してください</b><span>下のボタンを押すと、ブラウザの確認が出ます。「許可」を押してください。当日まではGPSを使いません（すぐやめます）。乗車の時間帯（発車の30分前〜到着の2時間後）に、自動で使います。</span></p><button class="btn fill ga-go" data-ga="pre">許可する</button>`; }
      else if (st === 'denied') { kind = 'pre denied'; html = `<p class="ga-t"><small>旅行の前に</small><b>位置の情報が「拒否」になっています</b><span>当日、遅れに合わせて動かすには、設定で許可し直してください。</span></p><button class="btn quiet ga-go" data-ga="help">許可し直す方法</button>`; }
    }
    if (!html) { el && el.remove(); return; }
    if (!el || !el.isConnected || !app.contains(el)) {
      el && el.remove();
      el = document.createElement('section'); el.id = 'geoask'; el.setAttribute('aria-label', '位置の情報の案内');
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-ga]'); if (!b) return;
        const k = b.dataset.ga;
        if (k === 'go') geoAskRun(b, false);
        if (k === 'pre') geoAskRun(b, true);
        if (k === 'help') geoHelp('denied');
        if (k === 'x') { if (el.dataset.kind.startsWith('pre')) store.set('geoPre', 'later'); else session.set('geoAskX', '1'); geoAsk(); }
      });
      /* いまどのへん？は地図の上（開くと地図の所まで自動でスクロールするため）。トップは「いまの予定」の最初の札の下（札は表紙に重なる作り）。ほかは上の帯の下 */
      const lm = $('#lm:not(.lm-full)', app), tt = $('#today-top', app), at = $('.topbar', app) || $('.cover', app);
      lm ? lm.prepend(el) : tt && tt.firstElementChild ? tt.firstElementChild.after(el) : at ? at.after(el) : app.prepend(el);
    }
    const full = `${html}<button class="ga-x" data-ga="x" aria-label="${kind.startsWith('pre') ? 'この案内を閉じる（もう出しません）' : 'この案内を閉じる（このタブを閉じるまで）'}">×</button>`;
    el.className = 'geoask ' + kind; el.dataset.kind = kind;
    if (el.dataset.v !== full) { el.innerHTML = full; el.dataset.v = full; }
  }
  GeoPerm.on(() => geoAsk());

  const topbar = () => `<header class="topbar"><a class="mark" href="#/"><i>し</i>しおり</a><div class="top-actions">
    <button class="tbtn" data-act="fam">${ic('user')}${esc(famName() || '家族を選ぶ')}</button><button class="tbtn" data-act="toc">${ic('menu')}目次</button></div></header>`;
  const phead = (eb, title, lead = '') => `<div class="phead"><div class="eyebrow">${eb}</div><h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;
  const secH = (title, eb = '', id = '') => `<div class="sec-h"${id ? ` id="${id}"` : ''}><h2>${title}</h2>${eb ? `<span class="eyebrow">${eb}</span>` : ''}</div>`;
  const infoList = rows => `<dl class="info">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

  /* ========== ホーム ========== */
  /* 表紙の下のカード（和紙色。大きな明朝体の数字と朱の飾りで目立たせる） */
  const TAPE = '<i class="dc-tape" aria-hidden="true"></i>';
  /* 予定の行を押したときの移り先（そのとき出ている予定ごとに決める）：
     のぞみ → いまどのへん？／ホテル・スポット・ごはんなど、ページのある地点 → そのページ／ほか（かもめ・リレーかもめ・地下鉄・駅など） → 行程表のその区間 */
  function evGo(day, i) {
    const it = day.items[i];
    if (it.t === 'move' && it.train && T.liveLine[it.train]) return ['#/ride/live/' + it.train, ''];
    if (it.t === 'stop' && it.to) return [it.to, ''];
    return ['#/trip/' + day.n, '#it-' + i];
  }
  const goRow = (day, i, inner, lab) => { const [g, m] = evGo(day, i); return `<button type="button" class="dc-go" data-go="${g}"${m ? ` data-mark="${m}"` : ''} aria-label="${esc(lab)}">${inner}<i class="dc-arr" aria-hidden="true">›</i></button>`; };
  function board() {
    const t = now(), ph = phase();
    if (ph === 'before') {
      const ms = new Date(T.start) - t;
      const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
      const legs = ['kamome92', 'relay92', 'nozomi28'].map(k => T.trains[k]);
      return `<section class="dc" aria-label="出発までのカウントダウン">${TAPE}
        <div class="dc-head"><span class="dc-k">${ic('train')}出発まで</span></div>
        <span class="dc-stamp" aria-hidden="true"><small>出発</small>10.17</span>
        <div class="dc-count"><b class="num" id="cd-d">${d}</b><span class="u">日</span><span class="hm num" id="cd-hm">${h}時間${String(m).padStart(2, '0')}分</span></div>
        <ol class="dc-legs">${legs.map((tr, i) => { const d1 = T.days[0], k = Object.keys(T.trains).find(x => T.trains[x] === tr), j = d1.items.findIndex(x => x.t === 'move' && x.train === k);
          const inner = `<b class="num">${tr.dep}</b><span>${tr.from}発　${tr.name}${i === legs.length - 1 ? `<small class="num">${tr.to} ${tr.arr}着</small>` : ''}</span>`;
          return `<li>${j >= 0 ? goRow(d1, j, inner, `${tr.name}（${T.liveLine[k] ? 'いまどのへん？' : '行程表'}へ）`) : inner}</li>`; }).join('')}</ol></section>`;
    }
    if (ph === 'after') {
      const tr = T.trains.kamome33;
      return `<section class="dc" aria-label="旅のおわり">${TAPE}
        <span class="dc-stamp" aria-hidden="true"><small>帰着</small>10.20</span>
        <div class="dc-bye">おかえりなさい</div>
        <p class="dc-sub num">${tr.name}　${tr.to} ${tr.arr}着。思い出メモとスタンプ帳は、いつでも見返せます。</p></section>`;
    }
    const { cur, next } = nowNext(t);
    const nm = e => e.it.t === 'stop' ? e.it.name : e.it.line;
    const tm = e => { const it = e.it; return it.t === 'stop' ? (it.dep && e.start <= t ? fmtHM(e.end) + '発' : fmtHM(e.start) + (it.arr ? '着' : '発')) : fmtHM(e.end) + '着'; };
    const mins = next ? Math.max(0, Math.round((next.start - t) / 6e4)) : 0;
    const dN = todayDay(), S = dN && getShift();
    /* 「いまここ」を押していないときは、時計だけで決めた「予定では、いまごろ」と言う */
    return `<section class="dc" aria-label="いまの予定">${TAPE}
      <div class="dc-head"><span class="dc-k">${ic('clock')}${dN ? `${dN.n}日目　${dN.label}（${dN.dow}）` : ''}</span><span class="dc-at num">${fmtHM(t)} 現在</span></div>
      <dl class="dc-rows"><div><dt>${S ? 'いま' : '予定では<br>いまごろ'}</dt><dd>${cur ? goRow(cur.day, cur.i, `<span>${esc(nm(cur))}<small class="num">${tm(cur)}${cur.est ? '（見込み）' : ''}</small></span>`, nm(cur)) : '自由時間'}</dd></div>${next ? `<div><dt>つぎ</dt><dd>${goRow(next.day, next.i, `<span>${esc(nm(next))}<small class="num">${tm(next)}${next.est ? '（見込み）' : ''}</small></span>`, nm(next))}</dd></div>` : ''}</dl>
      ${next ? `<div class="dc-count mini"><span class="pre">つぎまで</span><b class="num">${mins >= 60 ? Math.floor(mins / 60) : mins}</b><span class="u">${mins >= 60 ? '時間' : '分'}</span>${mins >= 60 ? `<span class="hm num">${mins % 60}分</span>` : ''}</div>` : '<div class="dc-bye mini">きょうの予定は、ここまでです</div>'}
      ${dN ? syncBox(dN, cur, next, t) : ''}</section>`;
  }
  /* 「今日の予定」のカードから、1回で「いまここ」：いちばん近い2つの地点を並べる */
  function syncBox(day, cur, next, t) {
    if (getShift()) return shiftBar(day);
    const ev = events(day), stops = ev.filter(e => e.it.t === 'stop' && e.it.type !== 'ramp');
    let cand = [];
    if (cur && cur.it.t === 'stop') cand = [cur, stops.find(e => e.i > cur.i)];
    else if (cur) cand = [[...stops].reverse().find(e => e.i < cur.i), stops.find(e => e.i > cur.i)];
    else cand = [[...stops].reverse().find(e => e.end <= t), stops.find(e => e.start > t)];
    cand = cand.filter(Boolean).filter((e, k, a) => a.indexOf(e) === k).slice(0, 2);
    if (!cand.length) return '';
    return `<div class="dc-sync"><p>予定からずれたら、いまいる所を押してください。この先の時刻を合わせます。</p>
      <div class="dc-here">${cand.map(e => `<button type="button" class="here-chip" data-here="${day.date}:${e.i}">${ic('here')}<span>${esc(shortName(e.it))}</span></button>`).join('')}<a class="more" href="#/trip/${day.n}">ほかの地点</a></div></div>`;
  }
  /* いま使いそうなもの（D-3）：時刻と行程から2〜3個だけ。つぎの列車のカードにあるもの（時刻表・指定席券・いまどのへん？）は出さない */
  function toolsNow(t = now()) {
    const day = todayDay(); if (!day) return '';
    const ev = events(day), soon = ms => ms >= -5 * 6e4 && ms <= 60 * 6e4;
    const out = [], add = (k, h) => { if (out.length < 3 && !out.some(x => x[0] === k)) out.push([k, h]); };
    ev.forEach(e => {
      const it = e.it, near = (e.start <= t && t < e.end) || soon(e.start - t);
      if (!near) return;
      if (it.qr) add('qr', `<button type="button" class="tool" data-act="qr">${ic('qr')}チェックインQR</button>`);
      if (it.t === 'move' && it.dr) add('drive', `<a class="tool" href="#/map/drive">${ic('road')}ドライブの道順</a>`);
      if (it.type === 'parking' && !it.minor) add('park', `<a class="tool" href="#/sos/parking">${ic('car')}駐車場の候補</a>`);
      const xf = it.t === 'stop' && XFER.find(x => x.date === day.date && x.st === it.name && x.arr === it.arr);
      if (xf) add('xf' + xf.s, `<a class="tool" href="${xferHref(xf.s)}">${ic('cube')}${xferLabel(xf)}</a>`);
      if (it.t === 'stop' && it.to && /^#\/(spot|food)\//.test(it.to)) add('to' + it.to, `<a class="tool" href="${it.to}">${ic(it.type === 'food' ? 'bowl' : 'spot')}${esc(shortName(it))}</a>`);
    });
    return out.length ? `<nav class="tools-now" aria-label="いま使いそうなもの"><span>いま使いそう</span>${out.map(x => x[1]).join('')}</nav>` : '';
  }
  function tickCountdown() {
    const d = $('#cd-d'); if (!d) return;
    const ms = new Date(T.start) - now(); if (ms <= 0) return render();
    d.textContent = Math.floor(ms / 864e5);
    $('#cd-hm').textContent = `${Math.floor(ms % 864e5 / 36e5)}時間${String(Math.floor(ms % 36e5 / 6e4)).padStart(2, '0')}分`;
  }

  const WX = c => c <= 1 ? ['晴', 'sun'] : c <= 3 ? ['曇', 'cloud'] : c <= 48 ? ['霧', 'cloud'] : c <= 67 || (c >= 80 && c <= 82) ? ['雨', 'rain'] : c <= 77 || (c >= 85 && c <= 86) ? ['雪', 'rain'] : ['雷', 'rain'];
  /* 例年の気温（気象庁の平年値。data.js の tips.temps）。2日目は奈良、ほかの日は大阪 */
  const normalTemp = d => { const t = ((T.tips && T.tips.temps) || []).find(x => x.name === (d.n === 2 ? '奈良' : '大阪')); return t ? `<div class="wn num">例年 最高${Math.round(t.hi)}°／最低${Math.round(t.lo)}°</div>` : ''; };
  const wxNormalGrid = () => `<div class="weather">${T.days.map(d => `<div><div class="wd">${d.label}（${d.dow}）</div><div class="wk wait">予報<br>まち</div>${normalTemp(d)}<div class="wp">${d.n === 2 ? '奈良' : '大阪'}</div></div>`).join('')}</div>`;
  /* 日の出・日の入り（国立天文台 暦計算室の値を、data.js に固定で入れてある。電波がなくても出る） */
  function sunBlock() {
    const S = T.sun; if (!S) return '';
    return `<div class="sun-box" id="sun-box"><h3 class="sub-h">日の出・日の入り<span class="eyebrow">Sunrise &amp; Sunset</span></h3>
      <table class="sun-t"><thead><tr><th scope="col">${S.date}</th><th scope="col">日の出</th><th scope="col">日の入り</th></tr></thead>
      <tbody>${S.rows.map(r => `<tr><th scope="row">${esc(r.name)}</th><td class="num">${r.rise}</td><td class="num">${r.set}</td></tr>`).join('')}</tbody></table>
      <p class="note">${S.date}の時刻です。旅行中は毎日1分ほどずれます。出典：${S.rows.map(r => `<a href="${r.url}" target="_blank" rel="noopener">国立天文台 暦計算室（${esc(r.name)}）</a>`).join('・')}</p></div>`;
  }
  /* 予報（Open-Meteo）は、ホームの天気と日程の「雨の日はこちら」で使う。開いている間は30分ずつ使い回す */
  let wxJob = null;
  function getForecast() {
    if (wxJob && Date.now() - wxJob.at < 30 * 6e4) return wxJob.p;
    const url = (lat, lon, end) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&start_date=2026-10-17&end_date=${end}`;
    /* 予報は、出発の日が近づくと少しずつ先まで取れる。取れる範囲を超えたと言われたら、取れる所までを使う */
    const get = async end => {
      const [osaka, nara] = await Promise.all([url(34.70, 135.50, end), url(34.685, 135.84, end)].map(u => fetch(u).then(async r => {
        if (r.ok) return r.json();
        const j = await r.json().catch(() => ({})), m = /to (\d{4}-\d{2}-\d{2})/.exec(j.reason || '');
        return Promise.reject(m ? { max: m[1] } : r.status);
      })));
      return { osaka, nara };
    };
    const p = get('2026-10-20').catch(e => { if (e && e.max && e.max >= '2026-10-17') return get(e.max); throw e; });
    wxJob = { at: Date.now(), p };
    p.catch(() => { if (wxJob && wxJob.p === p) wxJob = null; });
    return p;
  }
  /* その日の予報（2日目は奈良、ほかは大阪）。取れない日は null */
  const wxDay = (fc, d) => {
    const dd = fc && (d.n === 2 ? fc.nara : fc.osaka).daily, i = dd && dd.time ? dd.time.indexOf(d.date) : -1;
    if (i < 0 || !Number.isFinite(dd.temperature_2m_max[i]) || !Number.isFinite(dd.temperature_2m_min[i]) || !Number.isFinite(dd.weather_code[i])) return null;
    return { code: dd.weather_code[i], hi: dd.temperature_2m_max[i], lo: dd.temperature_2m_min[i], pp: Number.isFinite(dd.precipitation_probability_max[i]) ? dd.precipitation_probability_max[i] : null };
  };
  /* おためし中だけ、降水確率を仮に上げられる（雨の日の表示を確かめるため。おためしを終えると消える） */
  const simRain = () => (Clock.active() ? +session.get('simRain') || 0 : 0);
  const rainPP = (w) => simRain() || (w ? w.pp : null);
  async function loadWeather(el) {
    if (!el) return;
    /* 予報が取れるまでは、例年の気温を出しておく */
    el.innerHTML = wxNormalGrid();
    try {
      const fc = await getForecast();
      el.innerHTML = `<div class="weather">${T.days.map(d => {
        const w = wxDay(fc, d), place = d.n === 2 ? '奈良' : '大阪';
        if (!w) return `<div><div class="wd">${d.label}（${d.dow}）</div><div class="wk wait">予報<br>まち</div>${normalTemp(d)}<div class="wp">${place}${simRain() ? `<br>降水 ${simRain()}%（おためし）` : ''}</div></div>`;
        const [k, cls] = WX(w.code), pp = rainPP(w);
        return `<div><div class="wd">${d.label}（${d.dow}）</div><div class="wk ${cls}">${k}</div><div class="wt num"><span class="hi">${Math.round(w.hi)}°</span> / <span class="lo">${Math.round(w.lo)}°</span></div><div class="wp">降水 ${pp ?? '-'}%${simRain() ? '（おためし）' : ''}・${place}</div></div>`;
      }).join('')}</div><p class="note">予報：Open-Meteo。2日目は奈良、ほかの日は大阪の予報です。「例年」は気象庁の平年値（10月中旬）で、予報が出るまでの目安です。降水確率が50%以上の日は、日程に「雨の日はこちら」が出ます（2日目・3日目）。</p>`;
      window.__restoreScrollAgain && window.__restoreScrollAgain();
    } catch {
      el.innerHTML = `${wxNormalGrid()}
        <p class="note">出発のおよそ2週間前（10/2ごろ）から、大阪と奈良の天気予報が自動で表示されます。「例年」は気象庁の平年値（10月中旬）です。</p>`;
      window.__restoreScrollAgain && window.__restoreScrollAgain();
    }
  }
  /* 雨の日の候補：日程の見出しの下に「雨の日はこちら」を出す（その日の降水確率が50%以上の予報のときだけ。予報が取れない日は出さない） */
  async function loadRain(day) {
    const slot = $('#rain-slot'); if (!slot || !(T.rainPlans || {})[day.n]) return;
    let pp = simRain();
    if (!pp) { try { pp = rainPP(wxDay(await getForecast(), day)); } catch { pp = null; } }
    if (!Number.isFinite(pp) || pp < 50 || !slot.isConnected) return;
    slot.innerHTML = `<button type="button" class="rain-btn" data-rain="${day.n}">${ic('rain')}<span><b>雨の日はこちら</b><small>降水確率 ${pp}%${simRain() ? '（おためし）' : ''}・屋内の候補 ${T.rainPlans[day.n].length}か所</small></span><i aria-hidden="true">›</i></button>`;
    window.__restoreScrollAgain && window.__restoreScrollAgain();
  }
  function rainSheet(n) {
    const day = T.days.find(d => d.n === +n), list = (T.rainPlans || {})[n]; if (!day || !list) return;
    sheet(`雨の日の候補　${day.label}（${day.dow}）`, `<p class="small muted">予定の近くで、雨でも過ごしやすい所です。どれも予約はいりません。移動の時間は目安です。</p>
      <ol class="rain-list">${list.map(r => `<li><div class="rain-h"><b>${esc(r.name)}</b><span class="rain-kind">${esc(r.kind)}</span>${r.sure ? '' : '<span class="unsure">公式未確認</span>'}</div>
        ${infoList([['予定地から', esc(r.move)], ['営業時間', esc(r.hours)], ['料金', esc(r.fee)], ['確認', r.sure ? '公式ページで確認ずみ' : '検索結果による（公式ページは未確認）。行く前に公式でご確認ください']])}
        ${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ''}
        <p class="rain-links">${r.links.map(([l, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join('　')}</p></li>`).join('')}</ol>
      <p class="note">2026年10月2日に調べた内容です。臨時休館・貸切・料金の変更は、各施設の公式ページでご確認ください。</p>`);
  }

  /* ========== 旅先の最新情報（中身は assets/latest.js） ==========
     旅行当日までに変わったことを、「きょう」の上のほうに出す。関係するページ（spot）と日程の行にも、小さく出す。
     新しく載ったものがあるあいだ、下のタブの「きょう」に点を付ける。「きょう」を開くと消える（見たものはこの端末に覚える） */
  const latestAll = () => (Array.isArray(window.LATEST) ? window.LATEST : []).filter(x => x && x.id && x.title).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const latestSeen = () => { const r = store.get('latestSeen', []); return Array.isArray(r) ? r : []; };
  const latestUnseen = () => { const r = latestSeen(); return latestAll().filter(x => !r.includes(x.id)); };
  /* spot は、スポットのID か、しおりの画面（'#/…'）。route は '#/spot/ID' か '#/sos/parking' のような移り先 */
  const latestAt = route => latestAll().filter(x => x.spot && (x.spot === route || '#/spot/' + x.spot === route));
  const latestSrc = x => (x.src && x.src.length ? `<p class="lt-src small muted">出典：${x.src.map(([n, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join('・')}</p>` : '');
  const latestMd = x => `${+x.date.slice(5, 7)}/${+x.date.slice(8, 10)}`;
  let latestNew = [];
  function latestSection() {
    const all = latestAll(); if (!all.length) return '';
    const un = latestUnseen().map(x => x.id);
    if (un.length) { latestNew = [...new Set(latestNew.concat(un))]; store.set('latestSeen', [...new Set(latestSeen().concat(un))]); }
    return `<section class="sec" id="latest" aria-label="旅先の最新情報">${secH('旅先の最新情報', 'Latest')}
      ${all.map(x => `<article class="lt-card" id="lt-${esc(x.id)}"><p class="lt-h"><span class="lt-d num">${latestMd(x)}</span>${x.mark ? `<span class="lt-mark">${esc(x.mark)}</span>` : ''}${latestNew.includes(x.id) ? '<span class="lt-new">新着</span>' : ''}</p>
        <h3>${esc(x.title)}</h3>${x.text ? `<p class="lt-t">${esc(x.text).replace(/\n/g, '<br>')}</p>` : ''}${latestSrc(x)}
        ${x.spot ? `<div class="btns"><a class="more" href="${/^#/.test(x.spot) ? x.spot : '#/spot/' + x.spot}">関係するページを見る</a></div>` : ''}</article>`).join('')}</section>`;
  }
  /* 関係するページと日程の行に出す、小さな表示 */
  const latestMini = route => latestAt(route).map(x => `<div class="lt-mini" role="note"><p class="lt-h"><span class="lt-lab">最新情報${x.mark ? '・' + esc(x.mark) : ''}</span><span class="lt-d num">${latestMd(x)}</span></p><p class="lt-mt"><b>${esc(x.title)}</b></p>${x.text ? `<p class="lt-t small">${esc(x.text).replace(/\n/g, '<br>')}</p>` : ''}${latestSrc(x)}</div>`).join('');

  /* ========== ここに停めた・ここに集合 ==========
     位置は、押したときに一度だけ端末から取り、この端末の中（localStorage）か、自分で選んだ送り先（共有・コピー）にだけ使う。しおりからは、どこにも送らない。
     駐車の記録は {lat, lon, at}。あとで地図に「車」のピンとして出せる形 */
  const getPos = () => new Promise((res, rej) => {
    if (!navigator.geolocation) return rej({ code: 0 });
    navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6) }), e => rej(e), { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
  });
  const posMsg = e => e && e.code === 1 ? '位置情報が許可されていません。端末の設定で、このしおりに位置情報を許可してください。'
    : e && e.code === 3 ? '位置を調べるのに時間がかかりました。空の見える所で、もう一度お試しください。' : '位置情報を使えませんでした。電波や端末の設定をご確認ください。';
  const fmtAt = iso => new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  const hmAt = iso => new Date(iso).toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  const parked = () => { const v = store.get('parked'); return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) && v.at ? v : null; };
  const walkUrl = v => `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}&travelmode=walking`;
  const mapPin = v => `https://www.google.com/maps?q=${v.lat},${v.lon}`;
  /* 集合の時刻は5分きざみ。初めは、いまから30分あとを切り上げた時刻 */
  const meetDefault = () => { const j = new Date(now().getTime() + 9 * 36e5 + 30 * 6e4); const m = Math.ceil(j.getUTCMinutes() / 5) * 5; j.setUTCMinutes(m, 0, 0); return `${p2(j.getUTCHours())}:${p2(j.getUTCMinutes())}`; };
  let meetTime = null, meetPos = null, meetBusy = false;
  const meetText = () => { const [h, m] = (meetTime || meetDefault()).split(':').map(Number); return `集合：${h}時${p2(m)}分／ここ：${mapPin(meetPos)}`; };
  const parkHtml = () => {
    const v = parked();
    return `<div class="ht-card" id="park-box"><h3>${ic('car')}ここに停めた</h3>${v ? `
      <p class="ht-stat">記録しました（<span class="num">${esc(fmtAt(v.at))}</span>）</p>
      <div class="btns"><a class="btn fill ext" href="${walkUrl(v)}" target="_blank" rel="noopener">車までの道順</a><button class="btn quiet" type="button" data-park="save">いまの場所で記録しなおす</button><button class="btn quiet" type="button" data-park="clear">記録を消す</button></div>`
    : `<p class="small muted">車を停めたら押してください。いまの場所を、この端末にだけ記録します。</p>
      <div class="btns"><button class="btn fill" type="button" data-park="save">${ic('here')}ここに停めた</button></div>`}
      <p class="ht-msg small" id="park-msg" role="status"></p></div>`;
  };
  const meetHtml = () => `<div class="ht-card" id="meet-box"><h3>${ic('here')}ここに集合</h3>
      <p class="small muted">はぐれたときに、いまいる場所と集合の時刻を、LINEなどで送れます。</p>
      <label class="ht-time">集合の時刻<input type="time" step="300" id="meet-time" value="${meetTime || meetDefault()}" aria-label="集合の時刻"></label>
      <div class="btns"><button class="btn fill" type="button" data-meet="go">いまの場所を調べる</button></div>
      <div id="meet-out">${meetOutHtml()}</div></div>`;
  const meetOutHtml = () => meetBusy ? '<p class="small muted" role="status">いまの場所を調べています…</p>'
    : meetPos ? `<div class="ht-out"><p class="ht-text" id="meet-text">${esc(meetText())}</p>
      <div class="btns">${navigator.share ? '<button class="btn fill" type="button" data-meet="share">送る</button>' : ''}<button class="btn${navigator.share ? ' quiet' : ' fill'}" type="button" data-meet="copy">文をコピー</button></div></div>` : '<p class="ht-msg small" id="meet-msg" role="status"></p>';
  function hereTools() {
    const d = todayDay(); if (!d) return '';
    return `<section class="sec" id="here-tools">${secH('いま、ここで', 'Here')}${d.drives && d.drives.length ? parkHtml() : ''}${meetHtml()}</section>`;
  }
  const redrawPark = () => { const b = $('#park-box'); if (b) b.outerHTML = parkHtml(); };
  const redrawMeet = () => { const o = $('#meet-out'); if (o) o.innerHTML = meetOutHtml(); };
  async function parkSave() {
    const msg = $('#park-msg'); if (msg) msg.textContent = 'いまの場所を調べています…';
    try {
      const p = await getPos(); const v = { lat: p.lat, lon: p.lon, at: new Date().toISOString() };
      store.set('parked', v); redrawPark(); toast(`記録しました（${hmAt(v.at)}）`);
    } catch (e) { const m = $('#park-msg'); if (m) m.textContent = posMsg(e); }
  }
  async function meetGo() {
    meetBusy = true; meetPos = null; redrawMeet();
    try { meetPos = await getPos(); meetBusy = false; redrawMeet(); }
    catch (e) { meetBusy = false; redrawMeet(); const m = $('#meet-msg'); if (m) m.textContent = posMsg(e); }
  }
  async function meetShare() {
    if (!meetPos) return;
    try { await navigator.share({ text: meetText() }); }
    catch (e) { if (e && e.name !== 'AbortError') meetCopy(); }
  }
  async function meetCopy() {
    if (!meetPos) return;
    const t = meetText();
    try { await navigator.clipboard.writeText(t); toast('コピーしました。LINEなどに貼り付けてください'); }
    catch {
      sheet('集合の文', `<p class="small muted">下の文を選んで、コピーしてください。</p><textarea class="ht-ta" readonly rows="3" aria-label="集合の文">${esc(t)}</textarea>`, el => { const ta = $('textarea', el); ta.focus(); ta.select(); });
    }
  }

  /* ========== いまどのへん？（のぞみ・リレーかもめ）の小さな路線図 ==========
     駅の位置（LINES の stations）を線で結んだだけの略図。列車の印は時刻表から */
  const liveNowKey = (t = now()) => Object.keys(T.liveLine).find(k => { const tr = T.trains[k]; return t >= jst(tr.date, tr.dep) - 30 * 6e4 && t < jst(tr.date, tr.arr); }) || null;
  /* いまどのへん？を開くときの列車：乗車の時間帯の列車 → その日のまだ着いていない列車（乗る順）→ その日の最後の列車 → 日付で（10/20 からは のぞみ17号） */
  function liveDefault(t = now()) {
    const k = liveNowKey(t); if (k) return k;
    const d = ymd(t), ks = Object.keys(T.liveLine).filter(x => T.trains[x].date === d).sort((a, b) => jst(T.trains[a].date, T.trains[a].dep) - jst(T.trains[b].date, T.trains[b].dep));
    return ks.find(x => t < jst(T.trains[x].date, T.trains[x].arr)) || ks[ks.length - 1] || (d >= '2026-10-20' ? 'nozomi17' : 'nozomi28');
  }
  const lineOfKey = key => ((window.LINES || {})[(T.trains[key] || {}).line] || window.LINE);
  /* 略図の描き方（路線ごと）。山陽新幹線は今までどおり（瀬戸内海を下に）。ほかの路線は、駅の位置が枠に収まるように縮尺を決める */
  const MINI = {
    sanyo: { lab: { 博多: 'b', 小倉: 't', 広島: 'b', 岡山: 'b', 新神戸: 't', 新大阪: 'b' }, sea: ['瀬戸内海', 150, 52], aria: '山陽新幹線の略図' },
    relay: { lab: { 武雄温泉: 'b', 江北: 't', 佐賀: 'b', 鳥栖: 'b', 二日市: 't', 博多: 't' }, ends: ['武雄温泉', '博多'], demo: '佐賀', aria: 'リレーかもめ（武雄温泉〜博多）の略図' }
  };
  function routeMini(key, opt = {}) {
    const L = lineOfKey(key); if (!L || !T.liveLine[key]) return '';
    const lid = (T.trains[key] || {}).line || 'sanyo', M = MINI[lid] || {};
    const pos = {}; L.stations.forEach(([n, la, lo]) => (pos[n] = [la, lo]));
    let xy;
    if (lid === 'sanyo') {
      const k = Math.cos(34.2 * Math.PI / 180), sc = 52;
      xy = ([la, lo]) => [+((lo - 130.05) * k * sc).toFixed(1), +((34.98 - la) * sc).toFixed(1)];
    } else {
      const las = L.stations.map(x => x[1]), los = L.stations.map(x => x[2]);
      const la0 = Math.min(...las), la1 = Math.max(...las), lo0 = Math.min(...los), lo1 = Math.max(...los), k = Math.cos((la0 + la1) / 2 * Math.PI / 180);
      const sc = Math.min((244 - 70) / ((lo1 - lo0) * k), (92 - 34) / (la1 - la0)), ox = (244 - (lo1 - lo0) * k * sc) / 2, oy = 14;
      xy = ([la, lo]) => [+(ox + (lo - lo0) * k * sc).toFixed(1), +(oy + (la1 - la) * sc).toFixed(1)];
    }
    const s = liveState(key), names = s.st.map(x => x.name);
    const pts = names.map(n => xy(pos[n]));
    const path = p => p.map((q, i) => (i ? 'L' : 'M') + q.join(' ')).join('');
    let here = null, done = [];
    if (!opt.demo && s.mode !== 'before') {
      const i0 = Math.min(Math.floor(s.pos), pts.length - 1), f = s.pos - i0, a = pts[i0], b = pts[Math.min(i0 + 1, pts.length - 1)];
      here = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      done = pts.slice(0, i0 + 1).concat([here]);
    } else here = opt.demo ? pts[Math.max(0, names.indexOf(M.demo || '福山'))] : pts[0];
    const LB = M.lab || {}, west = (M.ends || ['博多', '新大阪'])[0], east = (M.ends || ['博多', '新大阪'])[1];
    const lab = n => { const [x, y] = xy(pos[n]); const w = LB[n]; const anc = n === west ? 'start' : n === east ? 'end' : 'middle'; return `<text x="${n === west ? x - 4 : n === east ? x + 4 : x}" y="${w === 't' ? y - 7 : y + 15}" text-anchor="${anc}">${n}</text>`; };
    return `<svg class="rmini" viewBox="0 -2 244 92"${opt.demo ? '' : ` data-rmini="${key}" data-p="${s.pos.toFixed(3)}"`} role="img" aria-label="${M.aria || '路線の略図'}${opt.demo ? '' : `（${esc(names[Math.round(s.pos)])}のあたり）`}">
      ${M.sea ? `<text class="rm-sea" x="${M.sea[1]}" y="${M.sea[2]}" text-anchor="middle">${M.sea[0]}</text>` : ''}
      <path class="rm-line" d="${path(pts)}"/>${done.length ? `<path class="rm-done" d="${path(done)}"/>` : ''}
      ${s.st.map((x, i) => x.stop ? `<circle class="rm-st" cx="${pts[i][0]}" cy="${pts[i][1]}" r="2.6"/>` : '').join('')}
      <g class="rm-lab">${Object.keys(LB).map(lab).join('')}</g>
      <g class="rm-train" transform="translate(${here[0].toFixed(1)} ${here[1].toFixed(1)})"><circle r="6.5"/><path d="M-3.2 1.6c0-2.6 1.3-4 3.6-4h.4c1.3 0 2.2.9 2.2 2.5v1.5a.6.6 0 0 1-.6.6h-5a.6.6 0 0 1-.6-.6z"/></g>
    </svg>`;
  }
  /* いまどのへん？の一言（次の駅・残り時間） */
  function liveLine(key, t = now()) {
    const tr = T.trains[key], s = liveState(key, t);
    const mins = d => Math.max(0, Math.round((d - t) / 6e4));
    const hm = m => `${m >= 60 ? Math.floor(m / 60) + '時間' : ''}${m % 60}分`;
    const next = s.st.slice(Math.floor(s.pos) + 1).find(x => x.stop);
    if (s.mode === 'before') return { k: '発車まで', main: 'あと' + hm(mins(s.st[0].dep)), sub: `${tr.from} ${tr.dep}発・${tr.car}号車` };
    if (s.mode === 'after') return { k: '到着', main: tr.to, sub: 'おつかれさまでした' };
    if (s.mode === 'stopped') return { k: '停車中', main: s.st[s.i].name, sub: `${fmtHM(s.st[s.i].dep)}に発車します` };
    return { k: 'つぎは', main: next ? next.name : tr.to, sub: next ? `${fmtHM(next.arr)}着・あと${hm(mins(next.arr))}` : '' };
  }
  /* 「きょう」の乗車中カード（乗車の30分前から到着まで、いちばん上に大きく） */
  function liveCard(key) {
    const tr = T.trains[key], L = liveLine(key);
    return `<section class="tl-card" id="today-live" aria-label="いまどのへん？">
      <a class="tl-main" href="#/ride/live/${key}/full">
        <span class="tl-h"><span class="tl-tag">いまどのへん？</span><span class="tl-tr">${tr.name}<small class="num">${tr.from} ${tr.dep} → ${tr.to} ${tr.arr}</small></span></span>
        ${routeMini(key)}
        <span class="tl-now"><span class="tl-k">${L.k}</span><b>${esc(L.main)}</b><span class="tl-s num">${esc(L.sub)}</span></span>
        <span class="tl-go">地図を大きく開く</span>
      </a>
      <div class="tl-sub"><a class="more" href="#/ride/live/${key}">駅の一覧・見どころ</a><a class="more" href="#/ride/${key}">指定席券</a></div>
    </section>`;
  }
  /* 「きょう」のつぎの列車（旅行中、きょう乗る列車・地下鉄のうち、まだ出ていないもの） */
  function nextTrainCard(t = now()) {
    const d = todayDay(); if (!d) return '';
    const e = events(d).find(x => x.it.t === 'move' && ['shinkansen', 'train', 'jr', 'metro'].includes(x.it.mode) && x.start > t);
    if (!e) return '';
    const from = d.items[e.i - 1], to = d.items[e.i + 1], it = e.it;
    const m = Math.max(0, Math.round((e.start - t) / 6e4));
    const leg = TT.legs.find(l => l.date === d.date && l.from === from.name && l.dep === from.dep);
    return `<section class="nt-card" aria-label="つぎの列車"><div class="nt-k">つぎの列車<span class="num">あと${m >= 60 ? Math.floor(m / 60) + '時間' : ''}${m % 60}分</span></div>
      <div class="nt-main"><b class="num">${e.est ? fmtHM(e.start) : esc(from.dep)}</b><span>${e.est ? '<small class="est">ごろ</small>' : ''}${esc(from.name)}発 → ${esc(to.name)} <span class="num">${e.est ? fmtHM(e.end) + 'ごろ' : esc(to.arr || '')}</span>着${e.est ? `<small class="nt-was num">（予定 ${esc(from.dep)}発）</small>` : ''}</span></div>
      <div class="nt-line">${ic(MODE[it.mode] || 'train')}<span>${esc(it.line)}</span></div>${it.train ? seatInline(it.train) : ''}
      ${leg || it.train ? `<div class="acts">${leg ? actB(`data-tt="${leg.id}"`, 'clock', '時刻表', 'pri') : ''}${it.train && T.liveLine[it.train] ? actA(`#/ride/live/${it.train}`, 'train', 'いまどのへん？', 'pri') : ''}${it.train ? actA(`#/ride/${it.train}`, 'seat', '指定席券') : ''}${it.mode === 'metro' || it.mode === 'jr' ? moveExt(d, e.i) : ''}</div>` : ''}</section>`;
  }
  /* 旅行前だけ：いまどのへん？とおためしモードの紹介（1枚にまとめる） */
  const TRY = [['nara', '奈良公園の午後', '10/18 14:40'], ['tt-d3', '道頓堀から地下鉄へ', '10/19 10:00']];
  function introCard() {
    return `<section class="intro" aria-label="いまどのへん？と、おためしモードのご紹介">
      <div class="intro-h"><span class="intro-k">新幹線の車内で</span><h2>いまどのへん？</h2></div>
      ${routeMini('nozomi28', { demo: true })}
      <p class="intro-t">新幹線の車内で、いまどこを走っているか、窓から何が見えるかが分かります。</p>
      <p class="intro-s num">10/17 リレーかもめ92号・のぞみ28号、10/20 のぞみ17号・リレーかもめ33号で使えます。</p>
      <div class="btns"><button class="btn fill" data-try="lm28">先にのぞいてみる</button></div>
      <div class="intro-sim"><p class="intro-sk">旅行中の画面を、先に試せます</p>
        <div class="intro-scenes">${TRY.map(([id, l, w]) => `<button data-try="${id}"><b>${l}</b><small class="num">${w}</small></button>`).join('')}</div>
        <p class="intro-n">おためし中は画面の上に帯が出ます。「終了」を押すと本物の時刻に戻ります。<button class="more" data-act="sim">ほかの場面</button></p></div>
    </section>`;
  }
  function todayTop() {
    const ph = phase();
    if (ph !== 'during') return board() + (ph === 'before' ? tvLine(tvPick(0), '今日のトリビア') + introCard() : '');
    const lk = liveNowKey();
    const nd = nudgeHtml(nudge()), tv = tvLine(tvPick(todayN()), '今日のトリビア');
    return lk ? liveCard(lk) + nd + board() + tv + toolsNow() : nd + board() + tv + toolsNow() + nextTrainCard();
  }

  /* ========== 思い出モード（旅行のあと） ==========
     旅行が終わったら（phase() が after。最後の到着 T.end のあと）、表紙を「おかえりなさい」にして、すぐ下に旅のまとめを1枚出す。
     「旅行中のしおりを見る」で、今までどおりの表紙に戻せる（このタブを閉じるまで。開き直すと思い出モード）。
     まとめに出すのは、しおりのデータから出せる数字だけ。写真・家族の名前・予約番号は扱わない */
  const memOn = () => phase() === 'after' && session.get('memTrip') !== '1';
  /* 移動した距離（予定の行程から計算）。
     新幹線（のぞみ）・リレーかもめ：いまどのへん？の線路のデータ（line-data.js）で、乗った駅から降りた駅までの線路の長さ
     かもめ（新大村〜武雄温泉）：線路の形のデータがないので、駅と駅の直線距離（新大村駅の位置は地理院地図の駅の注記。武雄温泉はリレーかもめの線路のデータ）
     レンタカー：行程表の区間ごとの距離（一般道・高速）の合計
     電車（地下鉄・JR）：乗った駅と降りた駅の直線距離（駅の位置は、おでかけマップの位置のデータ） */
  const MEM_STN = { 新大村: [32.93299, 129.95721] };   // 地理院地図（ベクトルタイル）の注記「新大村駅」の位置（2026-10-04 に確かめた）
  const kmOf = d => { const m = /([\d.]+)\s*(km|m)/.exec(d || ''); return m ? +m[1] / (m[2] === 'm' ? 1000 : 1) : 0; };
  const geoKm = (a, b) => { const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return Math.hypot(x, y) * 6371; };
  function stnLL(name) {
    if (MEM_STN[name]) return MEM_STN[name];
    for (const L of Object.values(window.LINES || {})) { const s = (L.stations || []).find(x => x[0] === name); if (s) return [s[1], s[2]]; }
    const g = (T.geo || {})[name]; return g ? [g[0], g[1]] : null;
  }
  function memStats() {
    const kinds = { nozomi: { name: '新幹線（のぞみ）', km: 0, n: 0, how: '線路の長さ' }, kamome: { name: '新幹線（かもめ）', km: 0, n: 0, how: '駅と駅の直線' }, relay: { name: '特急リレーかもめ', km: 0, n: 0, how: '線路の長さ' },
      car: { name: 'レンタカー', km: 0, n: 0, how: '行程表の道のり' }, rail: { name: '電車（地下鉄・JR）', km: 0, n: 0, how: '駅と駅の直線' } };
    let walk = 0, spots = new Set(), miss = 0;
    T.days.forEach(d => d.items.forEach((it, i) => {
      if (it.t === 'stop' && (it.type === 'spot' || it.type === 'food' || it.type === 'visit') && !it.minor) spots.add(it.to || it.name);
      if (it.t !== 'move') return;
      const from = (d.items[i - 1] || {}).name, to = (d.items[i + 1] || {}).name;
      const tr = it.train && T.trains[it.train];
      if (tr) {
        const L = tr.line && (window.LINES || {})[tr.line], k = tr.line === 'sanyo' ? 'nozomi' : tr.line === 'relay' ? 'relay' : 'kamome';
        let km = 0;
        if (L) { const a = L.stations.find(x => x[0] === tr.from), b = L.stations.find(x => x[0] === tr.to); km = a && b ? Math.abs(b[3] - a[3]) : 0; }
        else { const a = stnLL(tr.from), b = stnLL(tr.to); km = a && b ? geoKm(a, b) : 0; }
        km ? (kinds[k].km += km) : miss++; kinds[k].n++;
      } else if (it.mode === 'car' || it.mode === 'highway') { kinds.car.km += kmOf(it.dist); if (it.mode === 'car' && /レンタカー/.test(it.line) && i > 0 && d.items[i - 1].type === 'car') kinds.car.n++; }
      else if (it.mode === 'metro' || it.mode === 'jr') { const a = stnLL(from), b = stnLL(to); a && b ? (kinds.rail.km += geoKm(a, b)) : miss++; kinds.rail.n++; }
      else if (it.mode === 'walk') walk += kmOf(it.dist);
    }));
    const list = Object.values(kinds).filter(k => k.km > 0);
    return { list, total: list.reduce((a, k) => a + k.km, 0), walk, trains: kinds.nozomi.n + kinds.kamome.n + kinds.relay.n, local: kinds.rail.n, spots: spots.size, miss };
  }
  const kmTxt = v => (v >= 100 ? Math.round(v).toLocaleString('ja-JP') : v >= 10 ? v.toFixed(0) : v.toFixed(1));
  function memCover() {
    return `<header class="cover mem"><div class="cover-in"><div class="cover-frame"></div>
      <div class="cover-top"><span class="lat">Nara &amp; Osaka</span><span class="cover-acts">${bellBtn()}<button class="chip" data-act="fam">${ic('user')} ${esc(famName() || '家族を選ぶ')}</button></span></div>
      <h1 class="cover-title mem-title"><span>おかえりなさい</span></h1>
      <div class="cover-sub"><div class="kind">旅のおもいで</div><div class="place">奈良・大阪</div></div>
      <div class="cover-bottom"><div class="dates"><small>2026 ／ 3泊4日</small>10.17 — 10.20</div>${COVER_DEER}</div>
    </div></header>`;
  }
  function memSummary() {
    const M = memStats(), st = Stamps.get(), got = T.stamps.filter(s => st[s.id]).sort((a, b) => String(st[a.id]).localeCompare(String(st[b.id])));
    const memo = store.get('memo', {}), hasMemo = Object.values(memo || {}).some(v => String(v || '').trim());
    const V = Budget.view(), hasAct = !!(V && V.act && V.act.rows);
    const max = Math.max(1, ...M.list.map(k => k.km));
    const cols = ['var(--ai)', 'var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)'];
    return `<section class="dc mem-card" aria-label="旅のまとめ">${TAPE}
      <span class="dc-stamp" aria-hidden="true"><small>帰着</small>10.20</span>
      <p class="mem-k">旅のまとめ</p>
      <div class="mem-total"><span>移動した距離</span><span class="mem-v"><b class="num">約 ${kmTxt(M.total)}</b><span class="u">km</span></span></div>
      <div class="bars mem-bars">${M.list.map((k, i) => `<div class="bar" style="--c:${cols[i % cols.length]}"><span>${esc(k.name)}</span><i style="width:${(k.km / max * 100).toFixed(1)}%"></i><span class="v num">${kmTxt(k.km)}km</span></div>`).join('')}</div>
      <p class="mem-note small muted">予定の行程から計算した、往復の合計です。新幹線（のぞみ）とリレーかもめは線路の長さ、かもめと電車は駅と駅の直線、レンタカーは行程表の道のりです。${M.walk ? `歩いた道のり（行程表の徒歩の区間だけ）は、ほかに約${kmTxt(M.walk)}km。` : ''}</p>
      <dl class="mem-nums">
        <div><dt>日数</dt><dd><b class="num">${T.days.length}</b>日<small>${T.days.length - 1}泊</small></dd></div>
        <div><dt>新幹線・特急</dt><dd><b class="num">${M.trains}</b>本</dd></div>
        <div><dt>地下鉄・JR</dt><dd><b class="num">${M.local}</b>本</dd></div>
        <div><dt>立ち寄った所</dt><dd><b class="num">${M.spots}</b>か所<small>行程表から</small></dd></div>
      </dl>
      <div class="mem-visit"><p class="mem-sh">行った場所<span class="num">スタンプ ${got.length} / ${T.stamps.length}</span></p>
        ${got.length ? `<ol class="mem-stamps">${got.map(s => `<li>${stampSvg(s, st[s.id])}<span><b>${esc(s.name)}</b><small class="num">${Stamps.when(st[s.id])}</small></span></li>`).join('')}</ol>`
          : '<p class="small muted">この端末では、スタンプはまだ押されていません。スタンプ帳で、あとからでも押せます。</p>'}
        <p class="small muted">スタンプの記録は、この端末に押したぶんだけです。</p></div>
      <div class="btns mem-links">${hasMemo ? `<a class="btn" href="#/memo">${ic('pen')} 思い出メモを見る</a>` : `<a class="more" href="#/memo">思い出メモを書く</a>`}<a class="more" href="#/spot/stamps">スタンプ帳</a>${hasAct ? `<a class="more" href="#/money" data-bdgo="actual">予算／実績を見る</a>` : ''}</div>
      <button type="button" class="btn mem-trip" data-act="memtrip">旅行中のしおりを見る<small>日程・のりもの・まっぷは、今までどおり使えます</small></button>
    </section>`;
  }

  function viewHome() {
    const f = fam(), tn = todayDay(), ph = phase();
    if (memOn()) return `${memCover()}
    <div class="wrap">
      <div class="today-top" id="today-top">${memSummary()}</div>
      ${latestSection()}
      <section class="sec">${secH('4日間の旅', 'Itinerary')}
        <div>${T.days.map(d => `<a class="dayrow" href="#/trip/${d.n}" style="--c:${DAYC(d.n)}">
          <span class="dstamp"><small>DAY ${d.n}</small><b>${d.label.split('/')[1]}</b><em>${d.dow}</em></span>
          <span><span class="dt">${d.label}（${d.dow}）｜${d.theme}</span><br><span class="tt">${esc(d.title)}</span></span><span class="go">→</span></a>`).join('')}</div>
      </section>
      <p class="foot"><span class="lat">Thank you for the trip.</span>家族旅行のしおり・2026<br><button class="more" data-act="sim" style="margin-top:10px">おためしモードで、旅行中の画面を試す</button></p>
    </div>`;
    const got = Stamps.count();
    /* 旅行中は表紙を小さくして、いま必要な情報をすぐ下に出す。旅行前・後の表紙は、ときどき新幹線が横切る（CoverTrain。押すとすぐ走る） */
    const cover = ph === 'during' ? `<header class="cover slim"><div class="cover-in"><div class="cover-frame"></div>
      <div class="cover-top"><span class="lat">Nara &amp; Osaka</span><span class="cover-acts">${bellBtn()}<button class="chip" data-act="fam">${ic('user')} ${esc(famName() || '家族を選ぶ')}</button></span></div>
      <div class="slim-row"><h1 class="slim-title">しおり</h1>${tn ? `<p class="slim-day"><small>DAY ${tn.n}</small>${tn.label}（${tn.dow}）<span>${esc(tn.theme)}</span></p>` : ''}${COVER_DEER}</div>
    </div></header>` : `<header class="cover"><div class="cover-in"><div class="cover-frame"></div>
      <div class="cover-top"><span class="lat">Nara &amp; Osaka</span><span class="cover-acts">${bellBtn()}<button class="chip" data-act="fam">${ic('user')} ${esc(famName() || '家族を選ぶ')}</button></span></div>
      <h1 class="cover-title" aria-label="しおり"><span>し</span><span>お</span><span>り</span></h1>
      <div class="cover-sub"><div class="kind">家族旅行</div><div class="place">奈良・大阪</div></div>
      <div class="cover-bottom"><div class="cover-rail" aria-hidden="true">${COVER_TRAIN}${COVER_OSAKA}</div><div class="dates"><small>2026 ／ 3泊4日</small>10.17 — 10.20</div>${COVER_DEER}</div>
    </div></header>`;
    return `${cover}
    <div class="wrap">
      <div class="today-top" id="today-top">${todayTop()}</div>
      ${ph === 'after' ? '<p class="mem-back"><button type="button" class="btn" data-act="memback">‹ 思い出モード（旅のまとめ）にもどる</button></p>' : ''}
      ${latestSection()}
      <nav class="shortcuts" aria-label="よく使う">
        <button data-act="qr">${ic('qr')}チェックイン<br>QR</button>
        <a href="#/ride">${ic('seat')}わたしの<br>座席</a>
        <a href="#/trip/${todayN()}">${ic('route')}${tn ? '今日の' : '1日目の'}<br>旅程</a>
        <a href="#/sos">${ic('sos')}もしもの<br>とき</a>
      </nav>
      ${ph === 'during' ? hereTools() : ''}

      <section class="sec">${secH('4日間の旅', 'Itinerary')}
        <div>${T.days.map(d => `<a class="dayrow${tn && tn.n === d.n ? ' today' : ''}" href="#/trip/${d.n}" style="--c:${DAYC(d.n)}">
          <span class="dstamp"><small>DAY ${d.n}</small><b>${d.label.split('/')[1]}</b><em>${d.dow}</em></span>
          <span><span class="dt">${d.label}（${d.dow}）｜${d.theme}</span><br><span class="tt">${esc(d.title)}</span></span><span class="go">→</span></a>`).join('')}</div>
      </section>

      <section class="sec">${secH('旅先のお天気', 'Weather')}<div id="weather"><div class="small muted">読み込み中…</div></div>${sunBlock()}</section>

      <section class="sec">${secH(f ? `${T.families[f].name}のお部屋` : 'お部屋', 'Hotel')}
        <p class="small muted" style="margin-bottom:10px">${esc(T.hotel.name)}｜チェックイン ${T.hotel.checkin}・チェックアウト ${T.hotel.checkout}</p>
        ${roomsFor(f).map(([, r]) => `<div class="room-line"><span class="room-no">${r.no}</span><div><div class="small muted">${r.who}・${r.nights}</div><div class="room-name">${esc(r.name)}</div><div class="small muted">${r.size}・${esc(r.bed)}</div></div></div>`).join('')}
        <div class="btns"><button class="btn fill" data-act="qr">${ic('qr')} チェックインQR</button><a class="more" href="#/stay">ホテルの案内</a></div>
      </section>

      <section class="sec">${secH('スタンプ帳', 'Stamps')}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><p class="small muted">行った場所でスタンプを押していきます。いま <span class="stamp-count num">${got}</span> / ${T.stamps.length}</p><a class="more" href="#/spot/stamps">スタンプ帳へ</a></div>
      </section>
      <p class="foot"><span class="lat">Have a nice trip.</span>家族旅行のしおり・2026${ph === 'during' ? '' : '<br><button class="more" data-act="sim" style="margin-top:10px">おためしモードで、旅行中の画面を試す</button>'}</p>
    </div>`;
  }

  /* ========== まっぷ（行く場所を日ごとに） ========== */
  function viewMap() {
    const TYPE_IC = { hotel: 'bed', spot: 'spot', food: 'bowl', car: 'car', parking: 'car', visit: 'home' };
    const days = T.days.map(d => {
      const seen = new Set(), rows = [];
      d.items.forEach(it => {
        if (it.t !== 'stop' || it.minor || it.type === 'station' || it.type === 'ramp' || !(it.to || it.map)) return;
        const key = it.to || it.name; if (seen.has(key)) return; seen.add(key);
        rows.push({ ic: TYPE_IC[it.type] || 'spot', name: it.name, when: it.arr || it.dep, kind: TYPE_LABEL[it.type] || '', to: it.to, q: it.map || (it.type === 'hotel' ? T.hotel.name : it.name) });
      });
      T.spots.filter(sp => sp.day === d.n && !seen.has('#/spot/' + sp.id)).forEach(sp => rows.push({ ic: 'road', name: sp.name, when: '', kind: 'おでかけ', to: '#/spot/' + sp.id, q: sp.map }));
      /* 新幹線に乗る日は、いまどのへん？（車内の地図）も並べる */
      d.items.filter(it => it.t === 'move' && T.liveLine[it.train]).reverse().forEach(it => { const tr = T.trains[it.train]; rows.unshift({ ic: 'train', name: `${tr.name}は いまどのへん？`, when: tr.dep, kind: lineKey(it.train) === 'sanyo' ? '新幹線の車内' : '特急の車内', to: '#/ride/live/' + it.train, q: '' }); });
      return { d, rows };
    });
    return `<div class="wrap">${topbar()}${phead('Map', 'まっぷ', '行く場所を日ごとにまとめました。「地図」を押すと、地図のアプリで開きます。')}
      <a class="map-live" href="#/ride/live/${liveDefault()}">${routeMini(liveDefault(), { demo: !liveNowKey() })}<span><b>列車の中は「いまどのへん？」</b><small>走っている場所と、窓から見えるものを地図で</small></span></a>
      <a class="map-om" href="#/map/outing">${ic('map')}<span><b>おでかけマップ</b><small>4日間で訪れる場所を1枚の地図に。日にち・種類で切り替え</small></span><span aria-hidden="true">→</span></a>
      ${days.map(({ d, rows }) => `<section class="sec map-day" style="--c:${DAYC(d.n)}">${secH(`${d.n}日目　${d.label}（${d.dow}）`, d.theme)}
        <ul class="map-list">${rows.map(r => `<li><span class="map-ic">${ic(r.ic)}</span><span class="map-n">${r.kind ? `<small>${r.kind}${r.when ? '・' + r.when : ''}</small>` : ''}${r.to ? `<a href="${r.to}">${esc(r.name)}</a>` : esc(r.name)}</span>${r.q ? ext(gmap(r.q), '地図', 'btn quiet map-go') : ''}</li>`).join('')}</ul>
        ${d.drives ? driveBlock(d) : ''}</section>`).join('')}
      <section class="sec" id="official">${secH('公式の案内図', 'Official maps')}
        <p class="sec-lead">PDFしおりに載せていた、公式の地図・構内図です。外のサイトで開きます。</p>
        <ul class="omaps">${(T.officialMaps || []).map(m => `<li><a class="ext" href="${m.url}" target="_blank" rel="noopener"><b>${esc(m.name)}</b><small>${esc(m.by)}・${esc(m.when)}</small></a></li>`).join('')}
          <li><a href="#/spot/loop"><b>阪神高速 環状線の案内図</b><small>環状線ドライブのページにあります・10/18</small></a></li></ul></section>
      <section class="sec">${secH('ほかの一覧', 'More')}
        <div class="map-more"><a href="#/spot">${ic('spot')}<span><b>おでかけ</b><small>7か所の紹介と小ネタ</small></span></a><a href="#/food">${ic('bowl')}<span><b>ごはん</b><small>お昼と夕ごはん候補7店</small></span></a><a href="#/sos/parking">${ic('car')}<span><b>駐車場</b><small>奈良公園の近く（10/18）</small></span></a><a href="#/stay">${ic('bed')}<span><b>ホテル</b><small>${esc(T.hotel.name)}</small></span></a></div>
      </section></div>`;
  }

  /* ========== ドライブの道順（10/18） ==========
     案A：Googleマップの道順。経由地（最大9か所）を予定の順に入れて、ほぼ1本の道にする（運転中の案内はGoogleマップに任せる）
     案B：予定の道筋を、地図に1本の線で描く（確認用）。線は assets/drive-route.json（国土地理院の道路中心線から作成）。
          地図の下地は地理院タイルだけ。電波がなくても線は出る（下地は一度表示した所だけ） */
  function driveBlock(d) {
    return `<div class="drive" id="drive">
      <h3 class="sub">ドライブの道順</h3>
      <p class="sec-lead">PDFしおりの行程表と、環状線の略図の矢印のとおりに引いた、予定の道筋です。環状線は時計回りに一周します。</p>
      <div class="dm" id="dm"><div class="dm-map" id="dm-map" role="img" aria-label="10/18のドライブの予定の道筋"></div><p class="dm-err" hidden>地図を表示できません。下の道順とGoogleマップをご覧ください。</p></div>
      <ol class="dm-legs">${d.drives.map((v, k) => `<li data-drive="${v.id}"><span class="dm-n num">${k + 1}</span><div><b>${esc(v.label)}</b><small class="num">${esc(v.when)}</small><p>${esc(v.via)}</p>
        <div class="acts">${actX(driveUrl(v), 'out', 'Googleマップで開く', `Googleマップ：${v.label}（経由地入り）`).replace('ext-s', 'ext-s dm-go')}</div>${v.id === 'eve' ? '<p class="small muted dm-warn">Googleマップでは一般道に寄ることがあります。道順はしおりの赤線が正しいです（ナビアプリでは高速優先で）。</p>' : ''}</div></li>`).join('')}</ol>
      <p class="note">Googleマップには、経由地を予定の順に入れて、予定の道筋に近づけています。経由地の間で別の道が出ることや、スマホのアプリでは経由地の数が限られることがあります（Google側の都合です）。運転中の案内はGoogleマップにお任せください。この地図は、予定の確認用です。</p>
      <p class="note">地図の下地は、電波がないときは一度表示した所だけ出ます。道筋の線は、電波がなくても出ます。地図：地理院タイル（国土地理院）。道筋：国土地理院の道路中心線から作成。</p></div>`;
  }
  let dmMap = null;
  async function mountDriveMap() {
    const box = $('#dm-map'); if (!box) return;
    const fail = () => { const e = $('.dm-err'); if (e) e.hidden = false; box.classList.add('off'); };
    if (!$('link[data-maplibre]')) { const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'assets/vendor/maplibre-gl/maplibre-gl.css'; lk.dataset.maplibre = '1'; document.head.appendChild(lk); }
    let ml, geo;
    try { [ml, geo] = await Promise.all([import(new URL('assets/vendor/maplibre-gl/maplibre-gl.mjs', document.baseURI).href), fetch('assets/drive-route.json?v=34').then(r => r.json())]); } catch (e) { return fail(); }
    if (!box.isConnected || dmMap) return;
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim() || '#888';
    const lines = { type: 'FeatureCollection', features: geo.features.filter(f => f.geometry.type === 'LineString') };
    const pts = geo.features.filter(f => f.properties.name), arrows = geo.features.filter(f => 'arrow' in f.properties);
    let w = 180, s = 90, e = -180, n = -90; lines.features.forEach(f => f.geometry.coordinates.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }));
    const MAIN = ['ホテル', '親戚の家', 'まるかつ天理店', '奈良公園近くの駐車場'];
    let map;
    try {
      map = new ml.Map({
        container: box, bounds: [[w, s], [e, n]], fitBoundsOptions: { padding: { top: 28, bottom: 34, left: 24, right: 96 } }, maxZoom: 17, minZoom: 7, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0,
        cooperativeGestures: true, pixelRatio: Math.min(devicePixelRatio || 1, 2),
        locale: { 'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl キーを押しながらスクロールすると拡大・縮小できます', 'CooperativeGesturesHandler.MacHelpText': '⌘ キーを押しながらスクロールすると拡大・縮小できます', 'CooperativeGesturesHandler.MobileHelpText': '地図は2本指で動かせます' },
        style: { version: 8, sources: {
          pale: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 2, maxzoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>' },
          route: { type: 'geojson', data: lines }
        }, layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': col('--paper-2') } },
          { id: 'pale', type: 'raster', source: 'pale', paint: dark ? { 'raster-brightness-max': 0.42, 'raster-saturation': -0.4 } : { 'raster-saturation': -0.2 } },
          { id: 'case', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': dark ? '#1b1a18' : '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 13, 9, 16, 13] } },
          { id: 'line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': col('--shu'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.6, 13, 5, 16, 8] } }
        ] }
      });
    } catch (e) { return fail(); }
    dmMap = map;
    map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-left');
    map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
    pts.forEach(f => {
      const el = document.createElement('div'); el.className = 'dm-pt' + (MAIN.includes(f.properties.name) ? ' main' : '');
      el.innerHTML = `<i></i><span>${esc(f.properties.name)}</span>`;
      new ml.Marker({ element: el, anchor: 'left', offset: [-6, 0] }).setLngLat(f.geometry.coordinates).addTo(map);
    });
    arrows.forEach(f => {
      const el = document.createElement('div'); el.className = 'dm-arrow'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<svg viewBox="0 0 20 20"><path d="M10 3 16 15 10 12 4 15z"/></svg>';
      new ml.Marker({ element: el, rotation: f.properties.arrow, rotationAlignment: 'map' }).setLngLat(f.geometry.coordinates).addTo(map);
    });
    const zc = () => box.classList.toggle('zin', map.getZoom() >= 11.5);
    map.on('zoom', zc); zc();
    map.on('error', () => { /* 下地のタイルが取れないときも、線はそのまま */ });
  }

  /* ========== おでかけマップ（新大阪に着いてから、最終日に新大阪を出るまで） ==========
     地点は行程表（T.days）と夕ごはん候補（T.dinner）から拾い、位置は T.geo。位置のない地点は一覧だけに出す。
     地図は MapLibre ＋ 地理院タイル（ドライブの道順と同じ）。電波がないときは、地図の代わりに一覧を出す。
     現在地は、この端末の中で地図に出すだけで、どこにも送らない */
  const OM_CAT = [['stay', '宿', 'var(--day3)', 'bed'], ['see', '観光', 'var(--shu)', 'spot'], ['eat', 'グルメ', 'var(--yamabuki)', 'bowl'], ['move', '交通', 'var(--ai)', 'train'], ['rest', 'トイレ・休憩', 'var(--moegi)', 'wc', 1]];   // 5つ目の印（1）は、最初は出さない
  const OM_TYPE = { station: 'move', car: 'move', parking: 'move', spot: 'see', visit: 'see', food: 'eat', hotel: 'stay' };
  const omCatOf = k => OM_CAT.find(c => c[0] === k);
  const omDefault = () => OM_CAT.filter(c => !c[4]).map(c => c[0]);
  const omDay = () => { const v = session.get('omDay'); return v && (v === 'all' || T.days.some(d => String(d.n) === v)) ? v : 'all'; };
  const omCats = () => { try { const v = JSON.parse(session.get('omCats')); if (Array.isArray(v)) return v.filter(k => omCatOf(k)); } catch { /* noop */ } return omDefault(); };
  const omDir = q => `https://www.google.com/maps/dir/?api=1&destination=${enc(q)}`;
  let omItemsCache = null;
  function omItems() {
    if (omItemsCache) return omItemsCache;
    const geo = T.geo || {}, by = new Map(), out = [];
    const span = it => (it.arr && it.dep && it.arr !== it.dep ? `${it.arr}〜${it.dep}` : it.arr || it.dep || '');
    const introOf = to => { const m = /^#\/spot\/(\w+)/.exec(to || ''); return m ? { k: 'spot', id: m[1] } : { '#/food/marukatsu': { k: 'lunch' }, '#/stay': { k: 'hotel' }, '#/stay/car': { k: 'car' }, '#/sos/parking': { k: 'park' } }[to] || null; };
    T.days.forEach(d => d.items.forEach(it => {
      if (it.t !== 'stop' || it.type === 'ramp' || KYUSHU.includes(it.name)) return;
      let x = by.get(it.name);
      if (!x) {
        const g = geo[it.name];
        x = { id: 'p' + out.length, name: it.name, cat: OM_TYPE[it.type] || 'see', ll: g ? [g[0], g[1]] : null, sub: it.type === 'station' ? '駅' : TYPE_LABEL[it.type] || '', days: [], times: {}, intro: null, q: placeQ(it.name) !== it.name ? placeQ(it.name) : it.map || it.name };
        by.set(it.name, x); out.push(x);
      }
      if (!x.intro) x.intro = introOf(it.to);
      if (!x.days.includes(d.n)) x.days.push(d.n);
      const t = span(it); if (t) (x.times[d.n] = x.times[d.n] || []).push(t + (it.optional ? '（余裕があれば）' : ''));
    }));
    /* 夕ごはん候補（1〜3日目）。新大阪の4店は JR新大阪駅の中なので、駅の位置に出す。
       梅田の3店はどれも「新梅田食道街」の中なので、施設の位置（T.geo）に重ねて置く → 地図ではピン1つに店の数のバッジ、押すと3店の一覧 */
    const dinnerDays = T.days.filter(d => d.dinner).map(d => [d.n, new Date(d.date + 'T12:00:00+09:00').getDay()]);
    T.dinner.forEach(s => {
      const days = dinnerDays.filter(([, w]) => !(s.closedDays || []).includes(w)).map(([n]) => n);
      const site = s.area === 'umeda' ? '新梅田食道街' : '', g = s.area === 'shinosaka' ? geo['新大阪'] : site ? geo[site] : null;
      out.push({ id: 'd-' + s.id, name: s.name, cat: 'eat', ll: g ? [g[0], g[1]] : null, sub: `夕ごはん候補・${s.genre}・${s.place}`, days, times: {}, intro: { k: 'shop', id: s.id }, q: `${s.name} ${s.address}`, site });
    });
    (T.rest || []).forEach(r => out.push({ id: 'r-' + r.id, name: r.name, cat: 'rest', ll: r.ll, sub: r.near, days: r.days, times: {}, intro: null, q: `${r.ll[0]},${r.ll[1]}`, rest: r }));
    return (omItemsCache = out);
  }
  const omVisible = () => { const day = omDay(), cats = omCats(); return omItems().filter(x => cats.includes(x.cat) && (day === 'all' || x.days.includes(+day))); };
  const omWhen = (x, day) => {
    const ds = day === 'all' ? x.days : x.days.filter(n => n === +day);
    return ds.map(n => { const t = (x.times[n] || []).join('・'); const d = T.days[n - 1]; return day === 'all' ? `${d.label}（${d.dow}）${t ? ' ' + t : ''}` : t; }).filter(Boolean).join('／');
  };
  /* 地図の名前の優先度（宿・観光・お昼・交通・夕ごはん候補・トイレの順）と、短い呼び名（長い名前は省く。カードには全部出る） */
  const omPrio = x => (x.cat === 'eat' && x.id.startsWith('d-') ? 4.5 : ['stay', 'see', 'eat', 'move'].indexOf(x.cat) + 1 || 5);
  const OM_SHORT = { 'からくさホテルグランデ新大阪タワー': 'ホテル（からくさ）', '中之島エリアをおさんぽ': '中之島', '奈良公園近くの駐車場': '駐車場', '大阪城・大阪城公園': '大阪城', '大阪堂島浜タワー WowUs': 'WowUs', 'JO-TERRACE OSAKA': 'JO-TERRACE', 'ニッポンレンタカー 新大阪駅新幹線口': 'レンタカー営業所' };
  const omLabel = x => { const n = OM_SHORT[x.name] || (x.rest ? x.name.replace(/^Osaka Metro /, '').replace(/のトイレ$/, ' トイレ') : x.name); return n.length > 11 ? n.slice(0, 10) + '…' : n; };
  /* 同じ施設の中のお店をまとめたピン（新梅田食道街の夕ごはん候補）：施設の名前と店の数 */
  const omSite = xs => (xs.length > 1 && xs[0].site && xs.every(x => x.site === xs[0].site) ? xs[0].site : '');
  const omDot = cat => `<i class="om-dot" style="--c:${omCatOf(cat)[2]}" aria-hidden="true"></i>`;
  /* ピンのカード・一覧の1件 */
  function omEntry(x, day, opt = {}) {
    const C = omCatOf(x.cat), when = omWhen(x, day);
    return `<div class="om-e">
      <p class="om-k">${omDot(x.cat)}${C[1]}${x.sub ? '・' + esc(x.sub) : ''}${!x.ll ? '<span class="om-nomap">地図なし</span>' : ''}</p>
      <p class="om-n">${esc(x.name)}</p>${when ? `<p class="om-t num">${esc(when)}</p>` : ''}
      ${x.rest ? `<p class="om-r">${esc(x.rest.text)}</p><p class="om-src">出典：<a class="ext" href="${x.rest.url}" target="_blank" rel="noopener">${esc(x.rest.by)}</a></p>` : ''}
      <div class="om-acts"><a class="btn quiet ext om-go" href="${omDir(x.q)}" target="_blank" rel="noopener">Googleマップで道順</a>${x.intro ? `<button type="button" class="btn quiet" data-omintro="${x.id}">詳しく</button>` : ''}${opt.locate && x.ll ? `<button type="button" class="btn quiet" data-omlocate="${x.id}">地図で見る</button>` : ''}</div></div>`;
  }
  /* 「詳しく」：しおりの中の紹介を、地図の上のポップアップで出す（別のページには移らない。予約番号・QRは出さない） */
  function omIntroHtml(I) {
    if (I.k === 'spot') {
      const s = T.spots.find(p => p.id === I.id); if (!s) return '';
      return `<p class="small muted num">${s.day}日目・${esc(s.when)}</p><p class="spot-lead">${esc(s.lead)}</p>${latestMini('#/spot/' + s.id)}
        ${s.warn ? `<div class="warn"><span>${esc(s.warn)}</span></div>` : ''}
        ${s.walk ? `<h3 class="sub">おすすめの歩き方</h3><ol class="walk">${s.walk.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${s.walkNote ? `<p class="note">${esc(s.walkNote)}</p>` : ''}` : ''}
        ${s.info ? `<h3 class="sub">基本情報</h3>${infoList(s.info.map(([k, v]) => [k, k === '電話' ? `<a href="${tel(v)}">${esc(v)}</a>` : esc(v)]))}` : ''}
        ${s.fees ? `<h3 class="sub">拝観料</h3>${infoList(s.fees)}` : ''}
        <div class="btns">${s.url ? ext(s.url, '公式の情報') : ''}${(s.urls || []).map(([l, u]) => ext(u, `${esc(l)}（公式）`)).join('')}${(s.maps || []).map(([l, u]) => ext(u, esc(l))).join('')}</div>`;
    }
    if (I.k === 'lunch') {
      const L = T.lunch[0];
      return `<p class="small muted">${esc(L.when)}・${esc(L.sub)}</p><p class="spot-lead">${esc(L.lead)}</p>
        <ul class="picks">${L.menu.map(([n, p, d, hl]) => `<li class="${hl ? 'hl' : ''}"><div>${esc(n)}${d ? `<span>${esc(d)}</span>` : ''}</div><div class="pr num">${yen(p)}</div></li>`).join('')}</ul><p class="note">${esc(L.note)}</p>
        ${infoList([['住所', esc(L.address)], ['電話', `<a href="${tel(L.tel)}">${L.tel}</a>`], ['営業', esc(L.hours)], ['支払い', esc(L.pay)]])}<div class="btns">${ext(L.url, 'お店の情報')}</div>`;
    }
    if (I.k === 'shop') {
      const s = T.dinner.find(x => x.id === I.id); if (!s) return '';
      return `<p class="small muted">${esc(s.genre)}・${esc(s.place)}</p><div class="tags">${s.cash ? '<span class="tag red">現金のみ</span>' : '<span class="tag blue">カード可</span>'}${s.takeout ? '<span class="tag">持ち帰り</span>' : ''}${s.closed ? `<span class="tag${s.closedDays ? ' red' : ''}">${esc(s.closed)}</span>` : ''}</div>
        <ul class="picks">${s.picks.map(([n, p, d]) => `<li><div>${esc(n)}${d ? `<span>${esc(d)}</span>` : ''}</div><div class="pr num">${yen(p)}</div></li>`).join('')}</ul>
        ${infoList([['営業', esc(s.hours)], ['支払い', esc(s.pay)], ['住所', esc(s.address)], ['電話', `<a href="${tel(s.tel)}">${s.tel}</a>`]].concat(s.takeout ? [['持ち帰り', esc(s.takeout)]] : []))}<div class="btns">${ext(s.url, 'お店の情報')}</div>`;
    }
    if (I.k === 'hotel') {
      const H = T.hotel;
      return `${infoList([['住所', esc(H.address)], ['電話', `<a href="${tel(H.tel)}">${H.tel}</a>`], ['チェックイン', H.checkin], ['チェックアウト', H.checkout], ['行き方', H.access], ['朝ごはん', `${esc(H.breakfast.place)}・${esc(H.breakfast.time)}`], ['大浴場', `${esc(H.bath.place)}・${H.bath.time.join('／')}`]])}
        <p class="note">チェックインQRは「やど・くるま」のページにあります。</p><div class="btns">${ext(H.url, 'ホテルの公式サイト')}</div>`;
    }
    if (I.k === 'car') {
      const C = T.car;
      return `${infoList([['お店', esc(C.shop)], ['受け取り', C.outLabel], ['返却', `${C.backLabel}（予定は${C.plannedBack}）`], ['住所', esc(C.address)], ['電話', `<a href="${tel(C.tel)}">${C.tel}</a>`], ['行き方', C.access]])}<p class="note">予約番号は、予約メールをご確認ください。</p>`;
    }
    if (I.k === 'park') {
      const Pk = T.parking;
      return `${latestMini('#/sos/parking')}<p class="memo">${esc(Pk.rule)}</p>${Pk.list.map(p => `<div class="om-park"><p><b>${p.no} ${esc(p.name)}</b><small>${esc(p.spaces)}・${esc(p.open)}</small></p><p class="small">${esc(p.fee)}</p><p class="small muted">${esc(p.note)}</p></div>`).join('')}`;
    }
    return '';
  }
  function omIntro(x) { const h = x && x.intro && omIntroHtml(x.intro); if (h) sheet(esc(x.name), `<div class="om-intro">${h}</div>`); }
  const omListHtml = day => {
    const v = omVisible();
    return v.length ? `<ul class="om-list">${v.map(x => `<li>${omEntry(x, day, { locate: true })}</li>`).join('')}</ul>` : '<p class="empty">表示するものがありません。上のボタンで、日にちや種類を選んでください。</p>';
  };
  function viewOuting() {
    const day = omDay(), cats = omCats();
    return `<div class="wrap">${topbar()}${phead('Outing map', 'おでかけマップ', '新大阪に着いてから、最終日に新大阪を出るまでに訪れる場所を、1枚の地図にまとめました。ピンを押すと、時刻と道順が出ます。')}
      <div class="om-ctl">
        <div class="segs om-days" role="group" aria-label="日にち">${[['all', '全日程'], ...T.days.map(d => [String(d.n), d.label])].map(([k, l]) => `<button type="button" data-omday="${k}" aria-pressed="${day === k}" class="${day === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="om-cats" role="group" aria-label="地図に出すもの">${OM_CAT.map(([k, l, c]) => `<button type="button" class="om-cat" data-omcat="${k}" aria-pressed="${cats.includes(k)}" style="--c:${c}"><i aria-hidden="true"></i>${l}</button>`).join('')}</div>
      </div>
      <div class="dm om" id="om"><div class="dm-map" id="om-map" role="region" aria-label="おでかけマップ"></div>
        <button type="button" class="om-me" data-omme aria-label="現在地を表示">${ic('here')}<span>現在地</span></button>
        <div class="om-card" id="om-card" hidden></div></div>
      <p class="om-off" id="om-off" hidden></p>
      <section class="sec">${secH('一覧', 'List')}<p class="sec-lead">地図と同じ絞り込みで並べています。${omItems().some(x => !x.ll) ? '「地図なし」は、位置を確かめられなかったので、地図には出していない場所です。' : '梅田の夕ごはん候補3店は、どれも「新梅田食道街」の中なので、地図では1つのピン（数字は店の数）にまとめています。'}</p><div id="om-list">${omListHtml(day)}</div></section>
      <p class="note">現在地は、この端末の中で地図に出すだけで、どこにも送りません。地図の下地は、電波がないときは一度表示した所だけ出ます。地図：地理院タイル（国土地理院）。ピンの位置：しおりのデータと、地理院地図の注記から（新梅田食道街は、Overture Maps の施設データ〈© OpenStreetMap contributors ほか〉の店の位置と、地理院地図の線路〈高架〉で確かめました）。</p>
      <p class="note">「トイレ・休憩」は、行程で使う駅のトイレのうち、JR西日本・Osaka Metro の公式の駅の案内で確かめられたものだけを載せています（2026年10月2日に確認）。各カードに出典を添えています。公園の中のトイレは、公式の地図を確かめられなかったため、載せていません。</p></div>`;
  }
  let omMap = null, omCleanup = null;
  async function mountOutingMap() {
    const root = $('#om'), box = $('#om-map'); if (!box) return;
    const card = $('#om-card'), off = $('#om-off'), list = $('#om-list');
    let ml = null, map = null, markers = [], me = null, sel = null, failed = false, dead = false;
    const byId = id => omItems().find(x => x.id === id);
    const showMode = () => {
      const offline = failed || !navigator.onLine;
      root.hidden = offline; off.hidden = !offline;
      off.textContent = failed ? '地図を表示できません。下の一覧をご覧ください（日にち・種類の切り替えも効きます）。' : '電波がないため、地図の代わりに下の一覧を出しています（日にち・種類の切り替えも効きます）。';
      if (!offline && !map) init();
    };
    const closeCard = () => { card.hidden = true; card.innerHTML = ''; if (sel) sel.classList.remove('sel'); sel = null; };
    /* own：押したピンそのものの地点（先頭に並ぶ）。施設にまとめたピンなら、見出しに施設の名前と店の数を出し、近くの地点はそのあとに分けて出す */
    const openCard = (el, xs, own = xs) => {
      if (sel) sel.classList.remove('sel'); sel = el; el && el.classList.add('sel');
      const day = omDay(), site = omSite(own), rest = site ? xs.filter(x => !own.includes(x)) : [];
      card.innerHTML = `<button type="button" class="om-x" aria-label="閉じる">✕</button>${site
        ? `<p class="om-site">${omDot(own[0].cat)}<b>${esc(site)}</b>の夕ごはん候補<span class="num">${own.length}店</span></p>${own.map(x => omEntry(x, day)).join('')}${rest.length ? `<p class="om-near">近くの場所</p>${rest.map(x => omEntry(x, day)).join('')}` : ''}`
        : xs.map(x => omEntry(x, day)).join('')}`;
      card.hidden = false; card.scrollTop = 0;
    };
    const draw = fit => {
      if (!map) return;
      closeCard(); markers.forEach(m => m.remove()); markers = [];
      const groups = new Map();
      omVisible().filter(x => x.ll).forEach(x => { const k = x.ll.join(','); groups.has(k) ? groups.get(k).push(x) : groups.set(k, [x]); });
      const order = OM_CAT.map(c => c[0]);
      groups.forEach(xs => {
        xs.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
        const C = omCatOf(xs[0].cat), top = xs.slice().sort((a, b) => omPrio(a) - omPrio(b))[0], site = omSite(xs);
        /* ピン（押すとカード）と、その横の名前（いつも見える。重なるときは出さない） */
        const el = document.createElement('div'); el.className = 'om-mk';
        el.innerHTML = `<button type="button" class="om-pin" style="--c:${C[2]}" aria-label="${esc(site ? `${site}の夕ごはん候補 ${xs.length}店：${xs.map(x => x.name).join('・')}` : xs.map(x => x.name).join('・'))}">${ic(C[3])}${xs.length > 1 ? `<b class="num">${xs.length}</b>` : ''}</button><span class="om-lb" aria-hidden="true">${esc(site || omLabel(top))}</span>`;
        const mk = new ml.Marker({ element: el, anchor: 'center' }).setLngLat([xs[0].ll[1], xs[0].ll[0]]).addTo(map);
        mk.xs = xs; mk.prio = omPrio(top) * 100 + omItems().indexOf(top) / 100; mk.lb = $('.om-lb', el); markers.push(mk);
        /* 縮小していてピンが重なっているときは、押した所の近くのピンも、まとめてカードに出す */
        $('.om-pin', el).addEventListener('click', e => {
          e.stopPropagation();
          const c = map.project(mk.getLngLat()), near = markers.map(m => [m, Math.hypot(map.project(m.getLngLat()).x - c.x, map.project(m.getLngLat()).y - c.y)]).filter(([, d]) => d < 28).sort((a, b) => a[1] - b[1]);
          openCard(el, near.flatMap(([m]) => m.xs), mk.xs);
        });
      });
      if (fit && groups.size) {
        const pts = [...groups.values()].map(xs => xs[0].ll);
        let w = 180, s = 90, e = -180, n = -90; pts.forEach(([la, lo]) => { w = Math.min(w, lo); e = Math.max(e, lo); s = Math.min(s, la); n = Math.max(n, la); });
        map.fitBounds([[w, s], [e, n]], { padding: { top: 56, bottom: 40, left: 40, right: 56 }, maxZoom: 15, duration: 0 });
      }
      layout();
    };
    /* 名前の置き場所：優先度の高いピンから順に、右・左・下・上のうち、ほかのピンや名前と重ならない所へ。
       置けなければ出さない。縮小しているときは、出す数も減らす */
    let lay = 0;
    const layout = () => {
      if (!map) return;
      const W = box.clientWidth, H = box.clientHeight, z = map.getZoom(), cap = z < 10 ? 4 : z < 11.5 ? 8 : z < 13 ? 14 : 99;
      const ps = markers.map(m => ({ m, p: map.project(m.getLngLat()) }));
      const occ = ps.map(({ p }) => [p.x - 16, p.y - 16, p.x + 16, p.y + 16]);
      const bad = r => r[0] < 2 || r[1] < 2 || r[2] > W - 2 || r[3] > H - 2 || occ.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
      let n = 0;
      ps.sort((a, b) => a.m.prio - b.m.prio).forEach(({ m, p }) => {
        const w = m.lb.offsetWidth + 2, h = m.lb.offsetHeight + 2;
        let side = '';
        if (n < cap) for (const [k, r] of [['r', [p.x + 18, p.y - h / 2, p.x + 18 + w, p.y + h / 2]], ['l', [p.x - 18 - w, p.y - h / 2, p.x - 18, p.y + h / 2]], ['b', [p.x - w / 2, p.y + 18, p.x + w / 2, p.y + 18 + h]], ['t', [p.x - w / 2, p.y - 18 - h, p.x + w / 2, p.y - 18]]]) {
          if (!bad(r)) { side = k; occ.push(r); n++; break; }
        }
        m.getElement().dataset.lb = side;
      });
    };
    const relayout = () => { if (!lay) lay = requestAnimationFrame(() => { lay = 0; layout(); }); };
    async function init() {
      if (map || dead) return;
      if (!$('link[data-maplibre]')) { const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'assets/vendor/maplibre-gl/maplibre-gl.css'; lk.dataset.maplibre = '1'; document.head.appendChild(lk); }
      try { ml = await import(new URL('assets/vendor/maplibre-gl/maplibre-gl.mjs', document.baseURI).href); } catch (e) { failed = true; return showMode(); }
      if (dead || !box.isConnected || map) return;
      const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--paper-2').trim() || '#f4f2ec';
      try {
        map = new ml.Map({
          container: box, center: [135.6, 34.65], zoom: 9, maxZoom: 17, minZoom: 7, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0,
          cooperativeGestures: true, pixelRatio: Math.min(devicePixelRatio || 1, 2),
          locale: { 'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl キーを押しながらスクロールすると拡大・縮小できます', 'CooperativeGesturesHandler.MacHelpText': '⌘ キーを押しながらスクロールすると拡大・縮小できます', 'CooperativeGesturesHandler.MobileHelpText': '地図は2本指で動かせます' },
          style: { version: 8, sources: {
            pale: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 2, maxzoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>' }
          }, layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': bg } },
            { id: 'pale', type: 'raster', source: 'pale', paint: dark ? { 'raster-brightness-max': 0.42, 'raster-saturation': -0.4 } : { 'raster-saturation': -0.2 } }
          ] }
        });
      } catch (e) { map = null; failed = true; return showMode(); }
      omMap = map;
      map.addControl(new ml.AttributionControl({ compact: false }), 'bottom-left');
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      map.on('click', closeCard);
      map.on('move', relayout); map.on('resize', relayout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
      map.on('error', () => { /* 下地のタイルが取れないときも、ピンはそのまま */ });
      draw(true);
    }
    const locate = () => {
      if (!navigator.geolocation) return toast('この端末では、現在地を使えません');
      toast('現在地を調べています…', 2500);
      navigator.geolocation.getCurrentPosition(p => {
        if (dead || !map) return;
        const ll = [p.coords.longitude, p.coords.latitude];
        if (!me) { const el = document.createElement('div'); el.className = 'om-me-pt'; el.setAttribute('aria-hidden', 'true'); me = new ml.Marker({ element: el }).setLngLat(ll).addTo(map); } else me.setLngLat(ll);
        map.easeTo({ center: ll, zoom: Math.max(map.getZoom(), 14), duration: 600 });
        $$('.toast').forEach(x => x.remove());
      }, () => toast('現在地を取得できませんでした。位置情報の設定をご確認ください', 3000), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    };
    const refresh = fit => {
      const day = omDay(), cats = omCats();
      $$('[data-omday]').forEach(b => { const on = b.dataset.omday === day; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      $$('[data-omcat]').forEach(b => b.setAttribute('aria-pressed', cats.includes(b.dataset.omcat)));
      list.innerHTML = omListHtml(day); applyRuby(list);
      draw(fit);
    };
    const onClick = e => {
      const t = e.target.closest('[data-omday],[data-omcat],[data-omme],[data-omintro],[data-omlocate],.om-x'); if (!t) return;
      if (t.dataset.omday) { session.set('omDay', t.dataset.omday); refresh(true); }
      else if (t.dataset.omcat) { const c = omCats(), k = t.dataset.omcat, i = c.indexOf(k); i < 0 ? c.push(k) : c.splice(i, 1); session.set('omCats', JSON.stringify(c)); refresh(i < 0); }
      else if ('omme' in t.dataset) locate();
      else if (t.dataset.omintro) omIntro(byId(t.dataset.omintro));
      else if (t.dataset.omlocate) {
        const x = byId(t.dataset.omlocate); if (!x || !map) return;
        root.scrollIntoView({ behavior: 'smooth', block: 'center' });
        map.easeTo({ center: [x.ll[1], x.ll[0]], zoom: Math.max(map.getZoom(), 15), duration: 600 });
        const m = markers.find(mk => mk.xs.includes(x));
        m && openCard(m.getElement(), [x, ...m.xs.filter(y => y !== x)], [x, ...m.xs.filter(y => y !== x)]);
      } else if (t.classList.contains('om-x')) closeCard();
    };
    app.addEventListener('click', onClick);
    addEventListener('online', showMode); addEventListener('offline', showMode);
    omCleanup = () => {
      dead = true; app.removeEventListener('click', onClick); removeEventListener('online', showMode); removeEventListener('offline', showMode);
      if (map) { try { map.remove(); } catch { /* noop */ } } map = omMap = null;
    };
    showMode();
  }

  /* ========== 旅程 ========== */
  function seatInline(key) {
    const f = fam(), tr = T.trains[key];
    const s = f ? T.seats[key][f] : [...T.seats[key].yamaguchi, ...T.seats[key].iizuka];
    return `<span class="seat-inline">${f ? famName() : '6席'} ${tr.car}号車 <b>${s.join('・')}</b></span>`;
  }
  const MODE = { shinkansen: 'train', train: 'train', jr: 'train', metro: 'metro', walk: 'walk', car: 'car', highway: 'road' };
  const TYPE_LABEL = { hotel: 'ホテル', spot: 'おでかけ', food: 'ごはん', car: 'レンタカー', parking: '駐車場', visit: '訪問' };

  /* 行程表のボタンは3段階にそろえ、どの行も同じ並び（1段目→2段目→3段目）で本文の下に置く。同じ行き先のボタンは1つの行に1つだけ。
     1段目 pri：その地点・区間で使う主な機能（3D乗換・時刻表・いまどのへん？・チェックインQR）
     2段目：しおりの中のページ（指定席券・スポットのページなど）
     3段目 ext-s：外の地図・乗換案内（小さなアイコンと短い言葉。各区間に1つ） */
  const actA = (href, icon, label, tier = '', attrs = '') => `<a class="act${tier ? ' ' + tier : ''}" href="${href}"${attrs}>${ic(icon)}<span>${label}</span></a>`;
  const actB = (attrs, icon, label, tier = '') => `<button type="button" class="act${tier ? ' ' + tier : ''}" ${attrs}>${ic(icon)}<span>${label}</span></button>`;
  const actX = (href, icon, label, aria) => `<a class="act ext-s" href="${href}" target="_blank" rel="noopener" aria-label="${esc(aria)}" title="${esc(aria)}">${ic(icon)}<span>${label}</span></a>`;
  const TO_ACT = { spot: ['spot', 'くわしく'], visit: ['spot', 'くわしく'], hotel: ['bed', 'ホテルの案内'], car: ['car', 'レンタカー'], parking: ['car', '駐車場の候補'], food: ['bowl', 'お店のページ'] };
  const LINK_IC = { '#/ride/ekiben': 'bowl', '#/spot/loop': 'road' };
  const xferLabel = xf => `${xf.st === '博多' ? '乗り換え' : xf.s === 2 ? '駅の出方' : '駅での乗り方'}（3D）`;
  /* 区間の外部リンク：電車・地下鉄は Yahoo!乗換案内（日付と出発時刻入り）、徒歩・車は Googleマップの道順。新幹線・特急はしおりの中の案内に任せる */
  function moveExt(day, i) {
    const it = day.items[i], a = day.items[i - 1], b = day.items[i + 1];
    if (it.mode === 'metro' || it.mode === 'jr') return actX(yjUrl(a.name, b.name, day.date, a.dep || a.arr), 'out', '乗換案内', `Yahoo!乗換案内：${a.name}→${b.name}（${MD(day.date)} ${a.dep || a.arr}発）`);
    if (it.mode === 'walk') return actX(gdir(placeQ(a.name), placeQ(b.name), 'walking'), 'out', '徒歩ルート', `Googleマップ：${shortName(a)}→${shortName(b)}の徒歩ルート`);
    if (it.mode === 'car' || it.mode === 'highway') {
      const dv = it.dr && (day.drives || []).find(x => x.id === it.dr);
      return dv ? actX(driveUrl(dv), 'out', '車ルート', `Googleマップ：${dv.label}（予定の道筋の経由地入り）`)
        : actX(gdir(placeQ(a.name), placeQ(b.name), 'driving'), 'out', '車ルート', `Googleマップ：${shortName(a)}→${shortName(b)}の車ルート`);
    }
    return '';
  }
  /* 声かけ：大きな移動の出発の予定時刻が来たら、行程表と「今日の予定」の上に一度だけ小さく出す（1日4回まで。閉じたら次の節目まで出さない） */
  const NUDGE_MAX = 4;
  const bigMove = (day, i) => { const it = day.items[i], a = day.items[i - 1]; return it.t === 'move' && (['shinkansen', 'train', 'jr', 'metro'].includes(it.mode) || ((it.mode === 'car' || it.mode === 'highway') && it.dr && a && a.type !== 'ramp' && !a.minor)); };
  function nudge() {
    const day = todayDay(); if (!day || phase() !== 'during' && !Clock.active()) return null;
    const t = now(), sc = schedule(day), S = sc.shift;
    let st = store.get('nudge'); if (!st || st.date !== day.date) st = { date: day.date, seen: [], closed: [] };
    const m = day.items.map((it, i) => i).find(i => {
      if (!bigMove(day, i)) return false;
      const r = sc.rows[i - 1], at = r.d || r.a;
      return at && t >= at && t < +at + 15 * 6e4 && !(S && S.i >= i - 1);
    });
    if (m === undefined) return null;
    const id = `${day.date}:${m}`;
    if (st.closed.includes(id)) return null;
    if (!st.seen.includes(id)) { if (st.seen.length >= NUDGE_MAX) return null; st.seen.push(id); store.set('nudge', st); }
    return { id, day, text: `予定では、いまごろ${shortName(day.items[m - 1])}を出発です。ずれていたら、いまいる場所を押すと、この先の時刻を合わせられます。` };
  }
  const nudgeHtml = nd => nd ? `<div class="nudge" role="note"><p>${esc(nd.text)}</p><button type="button" class="nudge-x" data-nudge="${nd.id}" aria-label="この案内を閉じる">×</button></div>` : '';
  /* ずれの帯（行程表の上と「今日の予定」） */
  function shiftBar(day) {
    const x = shiftText(day); if (!x) return '';
    return `<div class="shift-bar" role="status"><p class="shb-main">${ic('here')}<span>${esc(x.text)}</span></p>${x.warn ? `<p class="shb-warn">${esc(x.warn)}</p>` : ''}
      <button type="button" class="act" data-unshift>予定どおりに戻す</button></div>`;
  }

  function viewTrip(n) {
    const day = T.days.find(d => d.n === n) || T.days[0];
    const t = now(), evs = events(day), sc = schedule(day);
    const curIdx = (evs.find(e => e.start <= t && t < e.end) || {}).i;
    const isToday = ymd(t) === day.date, S = sc.shift;
    const nowWord = S ? 'いま' : '予定ではいまごろ';
    const c = DAYC(day.n);
    const tabs = `<nav class="daytabs" aria-label="日付">${T.days.map(d => `<a href="#/trip/${d.n}" style="--c:${DAYC(d.n)}" class="${d.n === day.n ? 'on' : ''}">DAY ${d.n}<b>${d.label.split('/')[1]}</b>${d.dow}</a>`).join('')}</nav>`;
    const warnAt = i => (sc.warns.find(w => w.i === i) || {}).text;
    const lis = day.items.map((it, i) => {
      const e = evs[i];
      const st = i === curIdx ? 'now' : (e.end < t ? 'done' : '');
      const nowTag = st === 'now' ? `<span class="now-tag">${nowWord}</span>` : '';
      if (it.t === 'stop') {
        const r = sc.rows[i];
        const ta = r.a && r.pa && +r.a !== +r.pa, td = r.d && r.pd && +r.d !== +r.pd;
        const tm = (d, p, moved, u) => moved ? `<span class="est">${hm(d)}<small>${u}ごろ</small></span>` : `${hm(p)}<small>${u}</small>`;
        const time = (it.arr ? tm(r.a, r.pa, ta, '着') : '') + (it.dep ? tm(r.d, r.pd, td, '発') : '')
          + (ta || td ? `<small class="was">予定<br>${it.arr && ta ? it.arr + '着' : it.dep + '発'}</small>` : '');
        const leg = it.type === 'station' && TT.legs.find(l => l.date === day.date && l.from === it.name && l.dep === it.dep);
        const xf = it.type === 'station' && XFER.find(x => x.date === day.date && x.st === it.name && x.arr === it.arr);
        const to = it.to && (TO_ACT[it.type] || ['spot', 'くわしく']);
        const acts = [
          leg ? actB(`data-tt="${leg.id}"`, 'clock', '時刻表', 'pri') : '',
          xf ? actA(xferHref(xf.s), 'cube', xferLabel(xf), 'pri') : '',
          it.qr ? actB('data-act="qr"', 'qr', 'チェックインQR', 'pri') : '',
          to ? actA(it.to, to[0], to[1]) : '',
          it.link ? actA(it.link[1], LINK_IC[it.link[1]] || 'spot', esc(it.link[0])) : '',
          it.map ? actX(gmap(it.map), 'out', '地図', `${it.name}をGoogleマップで開く`) : ''
        ].filter(Boolean).join('');
        let head;
        if (it.type === 'station' && !it.minor) {
          const [col, co] = lineOf(day, i);
          head = `${nowTag}<div class="sign" style="--line:${col}"><div class="sign-main"><div class="sign-kanji">${esc(it.name)}</div><div class="sign-roma">${esc(it.roma)}</div></div><div class="sign-band"></div><div class="sign-foot"><span class="sign-co">${co}</span><span>${it.kind === 'start' ? 'ここから出発' : it.kind === 'goal' ? 'とうちゃく' : ''}</span></div></div>`;
        } else if (it.type === 'station') {
          const [col] = lineOf(day, i);
          head = `<div class="stop-name" style="--line:${col}">${nowTag}<span class="linechip"></span>${esc(it.name)}<span class="small muted" style="font-weight:500">　駅</span></div>`;
        } else {
          head = `${TYPE_LABEL[it.type] && !it.minor ? `<div class="stop-kind">${TYPE_LABEL[it.type]}${it.kind === 'goal' ? '・とうちゃく' : it.kind === 'start' ? '・出発' : ''}</div>` : ''}<div class="stop-name">${nowTag}${esc(it.name)}</div>`;
        }
        const here = isToday && it.type !== 'ramp' ? `<button type="button" class="here" data-here="${day.date}:${i}" aria-pressed="${!!(S && S.i === i)}" aria-label="${esc(shortName(it))}を、いまいる場所にする">いまここ</button>` : '';
        const w = warnAt(i);
        return `<li class="${st}${S && S.i === i ? ' anchor' : ''}" id="it-${i}"><div class="row ${it.minor ? 'minor' : ''} ${it.type === 'ramp' ? 'ramp' : ''}">
          <div class="time num">${time}${here}</div><div class="pin"></div>
          <div class="body">${head}${it.note ? `<p class="stop-note${it.optional ? ' opt' : ''}">${esc(it.note)}</p>` : ''}${it.to ? latestMini(it.to) : ''}${w ? `<p class="stop-warn">${esc(w)}</p>` : ''}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div></li>`;
      }
      const tr = it.train && T.trains[it.train];
      const extra = [
        tr ? `<div>${tr.kind}・${tr.vehicle}</div>` : '',
        it.detail ? `<div>${esc(it.detail)}</div>` : '',
        it.dist ? `<div>距離 ${it.dist}</div>` : '',
        it.note ? `<div>${esc(it.note)}</div>` : ''
      ].join('');
      const acts = [
        tr && T.liveLine[it.train] ? actA(`#/ride/live/${it.train}`, 'train', 'いまどのへん？', 'pri') : '',
        tr ? actA(`#/ride/${it.train}`, 'seat', '指定席券') : '',
        it.link ? actA(it.link[1], LINK_IC[it.link[1]] || 'spot', esc(it.link[0])) : ''
      ].filter(Boolean).join('');
      const openIt = tr || st === 'now' || it.note;
      /* 3段目（外の地図・乗換案内）は、区間の行の右端に1つ */
      return `<li class="${st}" id="it-${i}"><div class="row move-row"><div class="time num">${dur(it.min)}</div><div class="pin"></div>
        <div class="body"><div class="mv-head">${extra ? `<details${openIt ? ' open' : ''}><summary class="move-line">${ic(MODE[it.mode] || 'route')}<span>${nowTag}${esc(it.line)} <span class="tog">詳細</span></span></summary><div class="move-extra">${extra}</div></details>`
          : `<div class="move-line">${ic(MODE[it.mode] || 'route')}<span>${nowTag}${esc(it.line)}</span></div>`}${moveExt(day, i)}</div>${tr ? seatInline(it.train) : ''}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div></li>`;
    }).join('');
    const prevN = day.n > 1 ? day.n - 1 : null, nextN = day.n < 4 ? day.n + 1 : null;
    return `<div class="wrap" style="--c:${c}">${tabs}
      <header class="dayhead"><div class="eyebrow">Day ${day.n} — ${day.label} (${day.dow})・${day.theme}</div><h1>${esc(day.title)}</h1><p class="route">${esc(day.route)}｜${day.summary}</p>
      <div class="acts">${day.drives ? actA('#/map/drive', 'road', 'ドライブの道順（地図とGoogleマップ）') : ''}${T.tips && T.tips.items.some(x => x.day.includes(day.n)) ? actA(`#/tips/d${day.n}`, 'tip', 'この日のワンポイント') : ''}</div>
      ${tvLine(tvPick(day.n), 'この日のトリビア', `#/trivia/d${day.n}`)}</header>
      ${(T.rainPlans || {})[day.n] ? '<div class="rain-slot" id="rain-slot"></div>' : ''}
      ${isToday ? `<div class="trip-sync">${nudgeHtml(nudge())}${shiftBar(day) || `<p class="sync-hint">${ic('here')}<span>予定からずれたら、いまいる地点の「いまここ」を押すと、この先の時刻を合わせて表示します。</span></p>`}</div>` : ''}
      <ol class="tl">${lis}</ol>
      ${day.dinner ? `<div class="dinner-note"><p class="memo">${esc(day.dinner)}</p><div class="btns"><a class="btn" href="#/food/dinner">夕ごはん候補を見る</a></div></div>` : ''}
      <p class="note">移動時間は、子ども連れや荷物を考えた余裕を含む目安です。「乗換案内」「徒歩ルート」「車ルート」は、外のサイト（Yahoo!乗換案内・Googleマップ）で開きます。</p>
      <div class="btns" style="justify-content:space-between;margin-top:28px">${prevN ? `<a class="btn quiet" href="#/trip/${prevN}">← ${prevN}日目</a>` : '<span></span>'}${nextN ? `<a class="btn quiet" href="#/trip/${nextN}">${nextN}日目 →</a>` : ''}</div></div>`;
  }

  /* ========== 駅の時刻表 ========== */
  const TT = window.TT || { stations: [], legs: [], lines: {}, holidays: [] };
  const TD = () => (window.TT_DATA && window.TT_DATA.tables) || {};
  const DIA = { weekday: '平日', holiday: '土休日' };
  const isHoliday = date => { const w = new Date(date + 'T12:00:00+09:00').getDay(); return w === 0 || w === 6 || TT.holidays.includes(date); };
  const diaOf = date => (isHoliday(date) ? 'holiday' : 'weekday');
  const addDays = (date, n) => ymd(new Date(new Date(date + 'T12:00:00+09:00').getTime() + n * 864e5));
  const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const hm2 = m => `${Math.floor(m / 60) % 24}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  /* 運行日：0〜3時台は前の日のダイヤの続き。min はその日の0時からの分（24時以降も通し） */
  function svc(t) {
    const j = new Date(t.getTime() + 9 * 36e5);
    let date = j.toISOString().slice(0, 10), h = j.getUTCHours();
    if (h < 4) { date = addDays(date, -1); h += 24; }
    return { date, min: h * 60 + j.getUTCMinutes() + j.getUTCSeconds() / 60 };
  }
  const ttStation = id => TT.stations.find(s => s.id === id);
  const ttLineOf = (stn, table) => (stn.lines.find(l => l.dirs.includes(table)) || stn.lines[0]).line;
  const firstChar = s => [...s][0];

  function ttHTML(c) {
    const stn = c.stn, table = c.table, data = TD()[table], line = TT.lines[ttLineOf(stn, table)];
    const leg = c.leg;
    const live = svc(now());
    const ref = c.preview && leg ? { date: leg.date, min: toMin(leg.dep) - 10 } : live;
    const auto = diaOf(ref.date);
    /* JR の表は平日のみ収録：土休日を選んでも平日の表を出し、その旨を書く */
    const only = data && data.weekdayOnly && !data.holiday;
    const dia = only ? 'weekday' : c.dia || auto;
    const list = data && data[dia] ? data[dia].map(([t, dest, type, x, pl]) => ({ m: toMin(t), dest, type: type || '', skip: x === false, pl })) : [];
    const planM = leg && leg.table === table && diaOf(leg.date) === dia ? toMin(leg.dep) : null;
    const stnLegs = TT.legs.filter(l => l.station === stn.id);

    /* 行き先・種別の記号 */
    const cnt = {}; list.forEach(x => (cnt[x.dest] = (cnt[x.dest] || 0) + 1));
    const main = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const dA = (data && data.destAbbr) || {}, tA = (data && data.typeAbbr) || {};
    const dMark = {}; Object.keys(cnt).filter(d => d !== main).forEach(d => { let k = dA[d] || firstChar(d); if (!dA[d] && Object.values(dMark).includes(k)) k = [...d].slice(0, 2).join(''); dMark[d] = k; });
    const tMark = {}; list.forEach(x => { if (x.type && !/^(普通|各駅停車|各停)$/.test(x.type) && !tMark[x.type]) tMark[x.type] = tA[x.type] || (x.type.replace(/快速$/, '') ? firstChar(x.type) : '快'); });
    const mainTo = /運転$/.test(main || '') ? `<b>${esc(main)}</b>` : `<b>${esc(main)}</b>行き`;

    const segs = (items, attr, cur) => items.length > 1 ? `<div class="segs tt-segs">${items.map(([v, l]) => `<button ${attr}="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
    const dirName = id => (TD()[id] || {}).dir || (TT.dirNames || {})[id] || '';
    const lineTabs = segs(stn.lines.map(l => [l.dirs[0], TT.lines[l.line].name]), 'data-ttdir', stn.lines.find(l => l.dirs.includes(table)).dirs[0]);
    const dirs = stn.lines.find(l => l.dirs.includes(table)).dirs;
    const dirTabs = dirs.length > 1 ? segs(dirs.map(d => [d, dirName(d)]), 'data-ttdir', table) : `<p class="tt-dir1">${esc(dirName(table))}</p>`;

    const head = `<div class="tt-sign" style="--line:${line.color}"><span class="tt-code">${stn.code}</span><div><b>${esc(stn.name)}</b><small>${esc(stn.roma)}</small></div><span class="tt-co">${line.co}<br>${line.name}</span></div>`;
    const legRow = stnLegs.length ? `<div class="tt-legs"><span>旅程で乗る便</span>${stnLegs.map(l => `<button data-ttleg="${l.id}" class="${leg && leg.id === l.id ? 'on' : ''}">${MD(l.date)} ${l.dep}<small>→${esc(l.to)}</small></button>`).join('')}</div>` : '';
    const diaRow = `<div class="tt-dia"><span>${MD(ref.date)}（${dowJ(ref.date)}）は<b>${DIA[auto]}ダイヤ</b></span>${only ? '<span class="tt-only">平日のみ収録</span>' : `<span class="tt-diasw">${['weekday', 'holiday'].map(k => `<button data-ttdia="${k}" class="${k === dia ? 'on' : ''}">${DIA[k]}</button>`).join('')}</span>`}</div>
      ${only && auto === 'holiday' ? '<p class="tt-prev">この駅は平日の表だけを収録しています。土休日の時刻は、下の「公式の時刻表」で確認してください。</p>' : ''}`;

    const legRows = () => leg && leg.table === table ? [
      ['乗る便', `${leg.dep}発 → ${esc(leg.to)}（約${leg.min}分）`],
      ['ホーム・車両', `${leg.platform}・<b>${esc(leg.car)}</b>${leg.note ? `<br><small>${esc(leg.note)}</small>` : ''}`],
      ['降りたら', `<b>${esc(leg.exit)}</b>${leg.near ? `（${esc(leg.near)}に近い）` : ''}`],
      ['運賃の目安', esc(leg.fare)]
    ] : [];
    if (!data || !list.length) {
      return `${head}${lineTabs}${dirTabs}${legRow}<p class="tt-missing">この駅の時刻表は、しおりにはまだ入っていません。下の「公式の時刻表」（JRおでかけネット）で確認してください。</p>
        ${legRows().length ? infoList(legRows()) : ''}
        <div class="btns">${stn.official ? ext(stn.official, '公式の時刻表') : ''}${ext(line.info, `運行情報（${line.co}）`)}</div>`;
    }

    /* 次の3本 */
    const up = list.filter(x => !x.skip && x.m >= Math.floor(ref.min));
    const next3 = up.slice(0, 3);
    const rem = x => { const r = x.m - ref.min; return r < 1 ? 'まもなく' : `あと${Math.floor(r)}分`; };
    const K = ['先発', '次発', '次々発'];
    const tS = (data && data.typeShort) || {};
    const tm = x => `${x.type && tMark[x.type] ? `<i class="tt-type">${esc(tS[x.type] || x.type)}</i>` : ''}${esc(x.dest)}${x.pl ? `<small class="tt-pl">${x.pl}番</small>` : ''}`;
    const board = `<section class="board tt-board" aria-label="次の3本"><div class="board-head"><span>　</span><span>${line.name}　${esc(dirName(table))}</span><span>${c.preview ? `${MD(ref.date)} 予定` : fmtHM(now()) + ' 現在'}</span></div>
      ${next3.length ? next3.map((x, i) => `<div class="board-row tt-row${i ? ' sub' : ''}${x.m === planM ? ' plan' : ''}"><span class="k">${K[i]}</span><span class="n">${tm(x)}</span><span class="t num">${hm2(x.m)}</span><span class="r">${x.m === planM ? '乗る便' : c.preview ? '' : rem(x)}</span></div>`).join('')
        : `<div class="board-row"><span class="k">　</span><span class="n">本日の運転は終了しました</span><span class="t"></span></div>`}</section>
      ${c.preview ? `<p class="tt-prev">${MD(leg.date)}（${dowJ(leg.date)}）${leg.dep}発の予定に合わせて表示しています。当日は、いまの時刻から数えます。</p>` : ''}`;

    /* 時ごとの一覧 */
    const hours = []; list.forEach(x => { const h = Math.floor(x.m / 60); (hours[hours.length - 1] && hours[hours.length - 1].h === h ? hours[hours.length - 1].xs : (hours.push({ h, xs: [] }), hours[hours.length - 1].xs)).push(x); });
    const curH = Math.floor(ref.min / 60), nx = next3[0];
    const grid = `<div class="tt-grid" role="table" aria-label="${esc(stn.name)} ${line.name} ${esc(dirName(table))} ${DIA[dia]}">${hours.map(({ h, xs }) => `<div class="tt-hr${h === curH ? ' cur' : ''}" role="row"><b class="num" role="rowheader">${h % 24}</b><div class="tt-ms" role="cell">${xs.map(x => {
      const cls = [x.m < Math.floor(ref.min) ? 'past' : '', x.m === planM ? 'plan' : '', x === nx ? 'nx' : '', x.skip ? 'skip' : ''].filter(Boolean).join(' ');
      const marks = (tMark[x.type] ? `<i class="mt">${tMark[x.type]}</i>` : '') + (dMark[x.dest] ? `<i class="md">${dMark[x.dest]}</i>` : '');
      return `<span class="${cls}"${x.m === planM ? ' aria-label="乗る予定の便"' : ''}>${String(x.m % 60).padStart(2, '0')}${marks ? `<sup>${marks}</sup>` : ''}</span>`;
    }).join('')}</div></div>`).join('')}</div>
      <p class="tt-legend">無印は${mainTo}${Object.entries(dMark).map(([d, k]) => `・<i class="md">${k}</i>は${esc(d)}行き`).join('')}${Object.entries(tMark).map(([t, k]) => `・<i class="mt">${k}</i>は${esc(t)}`).join('')}${planM !== null ? '・<span class="lg-plan">囲み</span>は乗る予定の便' : ''}${list.some(x => x.skip) ? '・<s>取り消し線</s>は新大阪に止まらない列車' : ''}</p>`;

    const first = list.find(x => !x.skip), last = [...list].reverse().find(x => !x.skip);
    const rows = legRows();
    if (data.platform) rows.push(['のりば', esc(data.platform)]);
    rows.push(['始発・終電', `<span class="num">${hm2(first.m)}</span>発 ／ 終電 <b class="num">${hm2(last.m)}</b>発 ${esc(last.dest)}行き`]);
    const src = data.sources && (data.sources[dia] || data.sources.weekday);
    return `${head}${lineTabs}${dirTabs}${legRow}${diaRow}${board}${grid}${infoList(rows)}
      <div class="btns">${ext(line.info, `運行情報（${line.co}）`)}${src ? ext(src, '公式の時刻表') : ''}</div>
      <p class="note">${MD(data.checked)}時点の${line.co}公式時刻表より。${data.diaNote ? esc(data.diaNote) + '。' : ''}遅れや臨時列車は反映されません。</p>`;
  }
  const liveHooks = new Set();
  function openTT(opt = {}) {
    let leg = opt.leg ? TT.legs.find(l => l.id === opt.leg) : null;
    const stn = ttStation(leg ? leg.station : opt.station) || TT.stations[0];
    const today = svc(now()).date;
    if (!leg) leg = TT.legs.find(l => l.station === stn.id && l.date === today) || null;
    const c = { stn, leg, table: leg ? leg.table : stn.lines[0].dirs[0], dia: null, preview: !!(leg && leg.date !== today && opt.leg && opt.preview !== false) };
    sheet('駅の時刻表', '<div class="tt" id="tt-body"></div>', el => {
      const body = $('#tt-body', el), sh = $('.sheet', el);
      const draw = scroll => {
        const y = sh.scrollTop, gy = $('.tt-grid', body) ? $('.tt-grid', body).scrollTop : 0;
        body.innerHTML = ttHTML(c);
        applyRuby(body);
        /* 一覧だけを、いまの時（予定の表示では乗る便の時）までスクロール */
        const g = $('.tt-grid', body);
        if (g) {
          const r = c.preview && $('.tt-ms .plan', g) ? $('.tt-ms .plan', g).closest('.tt-hr') : $('.tt-hr.cur', g);
          if (scroll) { if (r) g.scrollTop = r.offsetTop - 8; } else g.scrollTop = gy;
        }
        sh.scrollTop = y;
      };
      draw(true);
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-ttdir],[data-ttdia],[data-ttleg]'); if (!b) return;
        const td = svc(now()).date;
        if (b.dataset.ttdir) { c.table = b.dataset.ttdir; c.leg = TT.legs.find(l => l.table === c.table && l.date === td) || null; c.preview = false; c.dia = null; }
        if (b.dataset.ttdia) c.dia = b.dataset.ttdia === diaOf(svc(now()).date) && !c.preview ? null : b.dataset.ttdia;
        if (b.dataset.ttleg) { c.leg = TT.legs.find(l => l.id === b.dataset.ttleg); c.table = c.leg.table; c.preview = c.leg.date !== td; c.dia = null; }
        draw(!b.dataset.ttdia);
      });
      const hook = () => draw(false);
      liveHooks.add(hook);
      return () => liveHooks.delete(hook);
    });
  }
  function ttSection() {
    return `<section class="sec">${secH('駅の時刻表（大阪市内）', 'Timetables', 'tt')}
      <p class="sec-lead">旅程で乗る地下鉄とJRの駅です。駅を押すと、その日のダイヤで「次の3本」と時刻の一覧が開きます。電波がなくても見られます。</p>
      <ul class="tt-list">${TT.stations.map(s => {
        const legs = TT.legs.filter(l => l.station === s.id);
        return `<li><button data-tts="${s.id}"><span class="tt-chips">${s.lines.map(l => `<i style="--line:${TT.lines[l.line].color}"></i>`).join('')}</span><span><b>${esc(s.name)}</b><small>${s.lines.map(l => TT.lines[l.line].name).join('・')}</small></span><span class="tt-when num">${legs.map(l => `${MD(l.date)} ${l.dep}`).join('<br>')}</span><span class="go" aria-hidden="true">→</span></button></li>`;
      }).join('')}</ul></section>`;
  }

  /* ========== のりもの ========== */
  /* 駅の乗り換え（3D）：transfer.html#s1〜s4。three.js はそのページを開いたときだけ読み込む */
  const XFER = [
    { s: 1, date: '2026-10-17', st: '博多', arr: '11:42', title: '博多の乗り換え', sub: 'リレーかもめ92号 → のぞみ28号', when: '10/17 11:42着 → 12:15発' },
    { s: 2, date: '2026-10-17', st: '新大阪', arr: '14:43', title: '新大阪での出方', sub: 'のぞみ28号 → 4番口・ホテルへ', when: '10/17 14:43着' },
    { s: 3, date: '2026-10-20', st: '新大阪', arr: '10:30', title: '新大阪での乗り方', sub: '4番口 → のぞみ17号', when: '10/20 11:02発' },
    { s: 4, date: '2026-10-20', st: '博多', arr: '13:30', title: '博多の乗り換え', sub: 'のぞみ17号 → リレーかもめ33号', when: '10/20 13:30着 → 13:54発' }
  ];
  const xferHref = n => `transfer.html#s${n}`;
  const xferLink = (n, label, cls = 'more') => `<a class="${cls} xfer-link" href="${xferHref(n)}">${label}</a>`;
  function xferSection(dir) {
    const list = dir === 'back' ? [...XFER.slice(2), ...XFER.slice(0, 2)] : XFER;
    return `<section class="sec">${secH('駅の乗り換え（3D）', 'Stations', 'transfer')}
      <p class="sec-lead">博多と新大阪の駅を立体の図にして、ホームから次の列車・出口までの道のりを示します。階段とエレベーターのルートを切り替えられ、歩く距離と時間の目安も出ます。図は目安です。当日は駅の案内表示を優先してください。</p>
      <div class="xfer-grid">${list.map(x => `<a class="xfer" href="${xferHref(x.s)}"><span class="xfer-n">${'①②③④'[x.s - 1]}</span><span><b>${x.title}</b><small>${x.sub}</small><small class="num">${x.when}</small></span></a>`).join('')}</div>
      <div class="btns">${ext('https://www.jr-odekake.net/eki/premises?id=0910127', '博多駅の構内図（公式）')}${ext('https://www.jr-odekake.net/eki/premises?id=0610155', '新大阪駅の構内図（公式）')}</div>
      <p class="note">初めて開くときは、図の部品を読み込むのに少し時間がかかります。一度開けば、電波がなくても見られます。構内図（公式）はJRおでかけネットで開きます。</p></section>`;
  }
  /* 座席表：真上から見た図。左から右へ列の番号順に並べ、進行方向の矢印を付ける。
     1列目は、のぞみは博多寄り（西）、リレーかもめ（787系）は武雄温泉寄り、かもめ（N700S）は長崎寄り。
     なので往路（東・博多・武雄温泉へ向かう）はどれも番号の大きい側＝右が前、復路は左が前。
     のぞみは E席が北側（山側）・A席が南側（海側）。図は上が北になる（車窓の城は北側＝往路は左・復路は右の窓） */
  function seatMap(key) {
    const tr = T.trains[key], f = fam();
    const mine = f ? T.seats[key][f] : [];
    const all = [...T.seats[key].yamaguchi, ...T.seats[key].iizuka];
    const [L, R] = tr.layout.split('|');
    const fwd = tr.dir === 'go';
    const sanyo = !!T.nozomiLine[key];
    const top = [...R].reverse(), bot = [...L].reverse();
    const winT = sanyo ? `北側（山側）の窓・${R.slice(-1)}席` : `窓側・${R.slice(-1)}席`;
    const winB = sanyo ? `南側（海側）の窓・${L[0]}席` : `窓側・${L[0]}席`;
    const cell = (r, c) => { const id = `${r}${c}`; const m = mine.includes(id); return `<span class="seat ${m ? 'mine' : all.includes(id) ? 'fam' : ''}" aria-label="${id}${m ? '（わたしの席）' : ''}">${c}</span>`; };
    const line = c => `<span class="sm-l">${c}</span>${tr.rows.map(r => cell(r, c)).join('')}`;
    const arrow = `<svg class="sm-arrow" viewBox="0 0 40 12" aria-hidden="true"><path d="M2 6h34M30 1.5 37 6l-7 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `<div class="smap" role="img" aria-label="${tr.car}号車の座席表。進行方向は図の${fwd ? '右' : '左'}。${sanyo ? `上が北側（山側）の窓の${R.slice(-1)}席、下が南側（海側）の窓の${L[0]}席` : ''}">
      <div class="sm-dir ${fwd ? 'r' : 'l'}"><span>進行方向<small>${esc(tr.to)}へ</small></span>${arrow}</div>
      <div class="sm-win">${winT}</div>
      <div class="sm-grid" style="--n:${tr.rows.length}">${top.map(line).join('')}<span class="sm-aisle">通路</span>${bot.map(line).join('')}
        <span class="sm-l"></span>${tr.rows.map(r => `<span class="sm-rn num">${r}</span>`).join('')}</div>
      <div class="sm-win">${winB}</div></div>
      ${sanyo ? `<p class="sm-note">${R.slice(-1)}席の窓が北側（山側）です。車窓の城は北側に見えます（${fwd ? '往路は進行方向の左' : '復路は進行方向の右'}）。</p>` : ''}
      <div class="seat-legend" style="margin-top:8px">${f ? `<span><i style="background:var(--shu)"></i>${famName()}</span><span><i style="background:var(--paper-3)"></i>${f === 'iizuka' ? '山口家' : '飯塚家'}</span>` : '<span><i style="background:var(--paper-3)"></i>予約した6席</span>'}<span class="num">数字は列の番号</span></div>`;
  }
  function ticket(key) {
    const tr = T.trains[key], f = fam();
    const mine = f ? T.seats[key][f] : [...T.seats[key].yamaguchi, ...T.seats[key].iizuka];
    const [m, d] = tr.date.slice(5).split('-').map(Number);
    return `<article class="ticket-wrap" id="${key}" style="margin-top:14px"><div class="ticket">
      <div class="t-head"><b>${tr.ticket}</b><span>${f ? famName() : '6名分'}</span></div>
      <div class="t-route"><span class="st">${tr.from}</span><span class="arr">→</span><span class="st">${tr.to}</span></div>
      <div class="t-time num"><span>${m}月${d}日（${tr.dep}発）</span><span>（${tr.arr}着）</span></div>
      <div class="t-seat"><span class="tn">${tr.name}</span><span class="car num">${tr.car}号車</span><span class="seats num">${mine.join('・')}</span></div>
      <div class="t-foot">${tr.kind}・${tr.vehicle}・${dur(tr.min)}</div></div>
      ${T.liveLine[key] ? `<div class="btns ticket-live"><a class="btn live-btn" href="#/ride/live/${key}">${ic('train')} いまどのへん？</a><a class="more" href="#/ride/live/${key}/full">全画面の地図</a>${key === 'nozomi28' ? xferLink(2, '新大阪での出方（3D）') : key === 'nozomi17' ? xferLink(3, '新大阪での乗り方（3D）') : ''}</div>` : ''}
      <details class="ticket-more"><summary>座席表とメモ</summary>${seatMap(key)}<p class="note">${esc(tr.carNote)}</p>
      <div class="btns">${ext(tr.timetable, '最新の時刻表')}</div></details></article>`;
  }

  function viewRide(sub, arg, opt) {
    if (sub === 'live') return viewLive(arg, opt === 'full');
    if (T.trains[sub]) session.set('dir', T.trains[sub].dir);
    const dir = session.get('dir') || (ymd(now()) >= '2026-10-20' ? 'back' : 'go');
    const keys = Object.keys(T.trains).filter(k => T.trains[k].dir === dir);
    const tf = T.transfers[dir];
    /* いまどのへん？の札：この向きで乗る列車（いまどのへん？があるもの）を、乗る順に */
    const lks = keys.filter(k => T.liveLine[k]);
    return `<div class="wrap">${topbar()}${phead('Trains', 'のりもの', '指定席券・乗り換え・車窓の楽しみを、この一枚に。')}
      ${lks.map(lk => { const ltr = T.trains[lk]; return `<a class="ride-live" href="#/ride/live/${lk}"><span class="rl-h"><span class="tl-tag">いまどのへん？</span><b>${ltr.name}</b><small class="num">${MD(ltr.date)} ${ltr.from} ${ltr.dep} → ${ltr.to} ${ltr.arr}</small></span>
        ${routeMini(lk, { demo: liveNowKey() !== lk })}<span class="rl-t">${lineKey(lk) === 'sanyo' ? '新幹線' : '特急'}の車内で、いまどこを走っているか、窓から何が見えるかが分かります。</span></a>`; }).join('')}
      <nav class="ride-idx" aria-label="のりものの一覧">${[['指定席券と座席表', '#/ride/' + keys[0]], ['駅の乗り換え（3D）', '#/ride/transfer'], ['駅の時刻表', '#/ride/tt'], ['車窓の城', '#/ride/castles'], ['駅弁', '#/ride/ekiben'], ['鉄道トリビア', '#/ride/trivia'], ['レンタカー', '#/stay/car']].map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</nav>
      <div class="segs" role="tablist"><button data-dir="go" class="${dir === 'go' ? 'on' : ''}">往路　10/17（土）</button><button data-dir="back" class="${dir === 'back' ? 'on' : ''}">復路　10/20（火）</button></div>
      ${!fam() ? `<p class="small">家族を選ぶと、自分の席だけが光ります。<button class="more" data-act="fam">家族を選ぶ</button></p>` : ''}
      ${keys.map((k, i) => ticket(k) + (tf[i] ? `<div class="transfer"><span class="w">乗り換え</span><div><b>${tf[i].at}駅</b><span class="small muted">　約${tf[i].wait}</span><p class="small">${esc(tf[i].text)}</p>${tf[i].at === '博多' ? `<div class="btns" style="margin-top:6px">${xferLink(dir === 'go' ? 1 : 4, '博多の乗り換えを立体の図で', 'btn quiet')}</div>` : ''}</div></div>` : '')).join('')}

      ${xferSection(dir)}

      ${ttSection()}

      <section class="sec">${secH('車窓から見える3つの城', 'Castles', 'castles')}
        <p class="sec-lead">福山城は停車中に、三原城跡と姫路城は通過中に見えます。${dir === 'go' ? '往路はどれも<b>進行方向の左</b>の窓。' : '復路はどれも<b>進行方向の右</b>の窓。'}時刻は目安です。</p>
        ${T.castles.map((c, j) => `<div class="castle" data-sid="castle-${j}">${art('castle', 'castle-icon')}<div><h3>${c.name}<span class="small muted" style="font-family:var(--f-got);font-weight:500">　${c.station}駅・${c.side}</span></h3>
          <p class="small">${esc(c.text)}</p><p class="when num"><b>${dir === 'go' ? '左' : '右'}の窓</b>・${dir === 'go' ? c.go : c.back}</p><div class="btns" style="margin-top:6px">${ext(c.url, 'くわしく', 'more')}</div></div></div>`).join('')}
        ${visitBlock('castles')}
      </section>

      <section class="sec">${secH('博多駅の駅弁', 'Ekiben', 'ekiben')}
        <p class="sec-lead">人気ランキング全11品。乗り換え中に買うなら、2F新幹線改札内のコンコース（おみやげ街道博多・野の葡萄など）が一番早いです。「食べたい」を押すと、この端末に印が残ります。</p>
        <ol class="bento">${T.ekiben.map(([n, p, d, chk], i) => `<li><span class="rk num">${i + 1}</span><div><div class="bn">${esc(n)}</div><div class="bd">${esc(d)}</div><button class="heart ${store.get('want', []).includes(n) ? 'on' : ''}" data-want="${esc(n)}">♡ 食べたい</button></div><div class="bp num">${yen(p)}${chk ? '<div class="small muted" style="font-weight:500">要確認</div>' : ''}</div></li>`).join('')}</ol>
        <div class="btns">${ext(T.ekibenUrl, '駅弁の最新情報（JR九州）')}${ext('https://www.jr-odekake.net/eki/premises?id=0910127', '博多駅の構内図（JRおでかけネット）')}</div>
      </section>

      <section class="sec">${secH('鉄道トリビア', 'Trivia', 'trivia')}
        <p class="sec-lead">カードをタップすると答えが開きます。<a class="more" href="#/trivia/rail">出典つきで、トリビアのページで読む →</a></p>
        ${T.railTrivia.map((g, gi) => `<h3 class="sub">${g.train}<span class="small muted" style="font-family:var(--f-got);font-weight:500">　${g.model}</span></h3>
          <div class="facts">${g.facts.map(([b, s]) => `<div><b class="num">${b}</b><span>${s}</span></div>`).join('')}</div>
          <div class="cards">${g.items.map(([q, a], j) => `<button class="flip" data-flip data-tv="rail-${gi}-${j}"><div class="fq">${esc(q)}</div><div class="fa">${esc(a)}</div><div class="fh">タップして読む</div></button>`).join('')}</div>`).join('')}
        ${window.LINE && LINE.passing ? `<h3 class="sub">${esc(LINE.passing.title)}<span class="small muted" style="font-family:var(--f-got);font-weight:500">　${esc(LINE.passing.sub)}</span></h3>
          <div class="cards">${LINE.passing.items.map(([q, a], j) => `<button class="flip" data-flip data-tv="pass-${j}"><div class="fq">${esc(q)}</div><div class="fa">${esc(a)}</div><div class="fh">タップして読む</div></button>`).join('')}</div>` : ''}
      </section></div>`;
  }

  function liveState(key, t = now()) {
    const tr = T.trains[key];
    const st = T.liveLine[key].map(([name, pref, a, d, stop]) => ({ name, pref, arr: jst(tr.date, a || d), dep: jst(tr.date, d || a), stop: !!stop }));
    if (t < st[0].dep) return { st, pos: 0, mode: 'before' };
    const last = st.length - 1;
    if (t >= st[last].arr) return { st, pos: last, mode: 'after' };
    for (let i = 0; i < st.length; i++) {
      if (t >= st[i].arr && t < st[i].dep) return { st, pos: i, mode: 'stopped', i };
      if (i < last && t >= st[i].dep && t < st[i + 1].arr) return { st, pos: i + (t - st[i].dep) / (st[i + 1].arr - st[i].dep), mode: 'running', i };
    }
    return { st, pos: 0, mode: 'before' };
  }
  /* 路線ごとの列車（往路→復路の順）。いまどのへん？の「往路／復路」の切り替えに使う */
  const lineKey = k => (T.trains[k] || {}).line || 'sanyo';
  const livePair = k => Object.keys(T.liveLine).filter(x => lineKey(x) === lineKey(k)).sort((a, b) => (T.trains[a].dir === 'go' ? 0 : 1) - (T.trains[b].dir === 'go' ? 0 : 1));
  function viewLive(key, full) {
    if (!T.liveLine[key]) key = 'nozomi28';
    const tr = T.trains[key], hasMap = window.LINE && window.LiveMap;
    /* 全画面：地図だけの専用画面（#/ride/live/のぞみ/full で直接開ける） */
    if (full && hasMap) return liveMapBlock(key, true);
    /* もう一方の路線（のぞみ ⇔ リレーかもめ）の、同じ向きの列車へ移るリンク */
    const other = Object.keys(T.liveLine).find(x => lineKey(x) !== lineKey(key) && T.trains[x].dir === tr.dir);
    const ot = other && T.trains[other];
    return `<div class="wrap">${topbar()}<div class="lm-phead"><div><div class="lm-ph-top">${ot ? `<a class="lm-other" href="#/ride/live/${other}">${esc(ot.short)}（${esc(ot.from)}〜${esc(ot.to)}）へ ›</a>` : ''}<span class="eyebrow">Live</span></div><h1>${tr.name}は いまどのへん？</h1><p class="small muted num">${tr.from} ${tr.dep}発 → ${tr.to} ${tr.arr}着・${tr.vehicle}</p></div></div>
      <div class="segs lm-segs">${livePair(key).map(k => `<button data-live="${k}" class="${key === k ? 'on' : ''}">${T.trains[k].dir === 'go' ? '往路' : '復路'} ${esc(T.trains[k].name)}</button>`).join('')}</div>
      ${hasMap ? liveMapBlock(key, false) : ''}
      <div id="live-board"></div>${hasMap ? '' : '<div id="live-alert"></div>'}<div id="live-tip"></div>
      <ol class="line" id="line">${T.liveLine[key].map(([n, p, a, d, s]) => `<li class="${s ? 'stp' : ''} ${T.castles.some(c => c.station === n) ? 'castle' : ''}"><span class="lt num">${s ? (a && d && a !== d ? `${a}<br>${d}` : a || d) : a + '頃'}</span><span class="ld"></span><span class="ln">${n}</span><span class="lp">${p}</span></li>`).join('')}
      <div class="fill" id="fill"></div>${PIN}</ol>
      <p class="note">大きい丸の停車駅は公式時刻表の時刻、小さい丸の通過駅は推定時刻（目安）です。実際の運行とはずれることがあります。</p>
      <div class="btns">${ext(tr.timetable, '公式の時刻表')}<a class="btn quiet" href="#/ride/${key}">指定席券へ</a></div>
      ${hasMap ? `<section class="sec">${secH('沿線の見どころ一覧', 'Along the line', 'spots')}
        <p class="sec-lead">通る順に並べています。通り過ぎたものは薄く、次に来るものには印がつきます。「窓から」は車窓から見えるもの、「通過駅」はこの列車が止まらずに通る駅（時刻は目安）、ほかは線路の近くにある名所・名物です。押すと紹介が開きます。</p>
        <div id="lm-list" class="lm-list"></div></section>` : ''}</div>`;
  }
  /* ライブ地図（地図・現在地・お知らせ）。中身は livemap.js が描く */
  const LMI = {
    compass: '<svg class="lm-needle" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 15.2 12H8.8z" fill="#d6504c"/><path d="M12 21.5 8.8 12h6.4z" fill="#b9b2a6"/><circle cx="12" cy="12" r="1.4" fill="#fff"/></svg>',
    base: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 9l-9 5-9-5z"/><path d="M3 13.5 12 18.5l9-5"/></svg>',
    here: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    tools: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M4.5 12h15M4.5 17h15"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/></svg>'
  };
  const liveMapBlock = (key, full) => `<section class="lm${full ? ' lm-full' : ''}" id="lm" aria-label="いまどのへん？の地図">
      <div class="lm-mapwrap"><div class="lm-map" id="lm-map"></div>
        ${full ? `<a class="lm-back" href="#/ride/live/${key}" aria-label="いまどのへん？のページに戻る">‹ 戻る</a>` : ''}
        <div class="lm-tools" role="toolbar" aria-label="地図の操作">
          <button type="button" class="lm-tool lm-tog" data-lm="tools" aria-expanded="false" aria-controls="lm-tl" aria-label="地図の操作ボタンを開く">${LMI.tools}<small>操作</small></button>
          <div class="lm-tl" id="lm-tl">
          <button type="button" class="lm-tool" data-lm="compass">${LMI.compass}<small>進行方向</small></button>
          <button type="button" class="lm-tool" data-lm="view"><small>立体</small></button>
          <button type="button" class="lm-tool" data-lm="base" aria-haspopup="true" aria-expanded="false" aria-label="地図の種類">${LMI.base}<small>地図</small></button>
          <button type="button" class="lm-tool" data-lm="recenter" aria-label="列車に戻る（追いかけを再開）">${LMI.here}<small>列車へ</small></button>
          <a class="lm-tool" data-lm="full" href="#/ride/live/${key}${full ? '' : '/full'}" aria-label="${full ? '全画面をやめる' : '全画面で見る'}">${full ? LMI.exit : LMI.full}<small>${full ? '戻す' : '全画面'}</small></a>
          <button type="button" class="lm-tool" data-lm="settings" aria-haspopup="dialog" aria-label="お知らせと画面の設定">${LMI.gear}<small>設定</small></button>
          <button type="button" class="lm-tool" data-lm="help" aria-label="使い方を見る"><b aria-hidden="true">？</b><small>使い方</small></button>
          </div>
        </div>
        ${full ? '' : '<button type="button" class="lm-endop" data-lm="endop" hidden>操作を終える</button>'}
        <div class="lm-basemenu" hidden></div>
        <div class="lm-legend"></div>
        <p class="lm-maperr" hidden>地図を読み込めませんでした。${full ? '' : '下の路線図と、'}文字の案内でご覧ください。</p>
        ${full ? '<div class="lm-ov"><div class="lm-notice" id="lm-notice" aria-live="polite"></div><div class="lm-sheet"><div class="lm-panel" id="lm-panel" aria-live="polite"></div><div class="lm-spd" id="lm-spd" hidden></div></div></div>' : ''}</div>
      ${full ? '' : `<div class="lm-panel" id="lm-panel" aria-live="polite"></div>
      <div class="lm-spd" id="lm-spd" hidden></div>
      <div class="lm-notice" id="lm-notice" aria-live="polite"></div>
      <div class="lm-ctrl" id="lm-ctrl"></div>
      <p class="note">位置情報は、このページを開いているあいだだけ使います。乗る列車の発車30分前〜到着2時間後は、位置の情報を許可していれば自動で使い、それ以外は「現在地を使う」を押したときだけ使います。どこにも送りません。GPSが届かないときは、最後に測った遅れと時刻表から推定します。</p>
      <p class="note">地図：地理院タイル（国土地理院）・OpenStreetMap。線路の形：© OpenStreetMap contributors（Overture Maps 経由）。市町村：国土数値情報（行政区域データ・国土交通省）を加工。地名・山の標高：地理院ベクトルタイル（国土地理院）を加工。川の線：© OpenStreetMap contributors（Overture Maps 経由）。見どころの紹介文は、このしおり用に書いたものです。</p>`}
    </section>`;
  function updateLive() {
    const line = $('#line'); if (!line) return;
    const k = T.liveLine[location.hash.split('/')[3]] ? location.hash.split('/')[3] : 'nozomi28';
    /* GPSで遅れを測っているときは、地図（livemap.js）と同じく遅れに合わせる：列車の印・次の駅・発車の時刻・まだ着いていない駅の時刻 */
    const t = now(), st0 = window.LiveMap && LiveMap.schedT ? LiveMap.schedT(k) : null;
    const dl = st0 != null && window.LiveMap ? LiveMap.delayMs() : 0, late = dl >= 2 * 6e4, gr = late ? 'ごろ' : '';
    const tr = T.trains[k], s = liveState(k, st0 != null ? new Date(st0) : t);
    const lis = $$('li', line);
    const center = i => lis[i].offsetTop + lis[i].offsetHeight / 2;
    const i0 = Math.floor(s.pos), fr = s.pos - i0;
    const y = i0 >= lis.length - 1 ? center(lis.length - 1) : center(i0) + (center(i0 + 1) - center(i0)) * fr;
    $('.trainpin', line).style.top = y + 'px';
    const fill = $('#fill'); fill.style.top = center(0) + 'px'; fill.style.height = Math.max(0, y - center(0)) + 'px';
    lis.forEach((li, i) => {
      const done = s.mode !== 'before' && i <= s.pos;
      li.classList.toggle('passed', done);
      /* 遅れているときは、まだ着いていない駅に、遅れを足した時刻を添える */
      const x = late && !done ? `${fmtHM(new Date(Math.round((+(i ? s.st[i].arr : s.st[i].dep) + dl) / 6e4) * 6e4))}ごろ` : '';
      if ((li.dataset.lx || '') !== x) {
        li.dataset.lx = x;
        const ln = $('.ln', li); let e = $('.lx', ln);
        if (!x) { e && e.remove(); } else { if (!e) { e = document.createElement('small'); e.className = 'lx num'; ln.appendChild(e); } e.textContent = '→' + x; }
      }
    });
    const next = s.st.slice(Math.floor(s.pos) + 1).find(x => x.stop);
    const mins = d => Math.max(0, Math.round((d - t) / 6e4));
    const hm = d => fmtHM(new Date(Math.round((+d + dl) / 6e4) * 6e4));
    const lateTxt = late ? `（約${Math.round(dl / 6e4)}分遅れ）` : '';
    let a, b;
    if (s.mode === 'before') { const m = mins(+s.st[0].dep + dl); a = ['まもなく', `${tr.name} ${tr.to}`, tr.dep]; b = late && m < 1 ? `遅れて発車を待っています${lateTxt}` : m < 1440 ? `発車まで あと${m >= 60 ? Math.floor(m / 60) + '時間' : ''}${m % 60}分${lateTxt}` : `${tr.date.slice(5).replace('-', '/')} に発車します`; }
    else if (s.mode === 'after') { a = ['到着', tr.to, late ? hm(s.st[s.st.length - 1].arr) : tr.arr]; b = 'おつかれさまでした'; }
    else if (s.mode === 'stopped') { a = ['停車中', s.st[s.i].name, hm(s.st[s.i].dep)]; b = `${hm(s.st[s.i].dep)}${gr}に発車します${lateTxt}`; }
    else { a = ['走行中', `${s.st[s.i].name} → ${s.st[s.i + 1].name}`, '']; b = next ? `つぎは ${next.name}　${hm(next.arr)}着${gr}・あと${mins(+next.arr + dl)}分` : ''; }
    $('#live-board').innerHTML = `<section class="board" style="margin-top:0"><div class="board-head"><span>　</span><span>${tr.name}</span><span>${fmtHM(t)}</span></div>
      <div class="board-row"><span class="k">${a[0]}</span><span class="n">${esc(a[1])}</span><span class="t num">${a[2]}</span></div>
      <div class="ticker" aria-live="polite"><span style="animation:none;padding-left:0">${esc(b)}</span></div></section>`;
    const alert = T.castles.map(c => { const st = s.st.find(x => x.name === c.station); if (!st) return ''; const d = (+st.arr + dl - t) / 6e4; return d <= 6 && d >= -2 && s.mode !== 'before' && s.mode !== 'after' ? `<div class="alert">まもなく${c.name}。${tr.dir === 'go' ? '左' : '右'}の窓（${c.side}）をチェック</div>` : ''; }).join('');
    const al = $('#live-alert'); if (al && al.dataset.v !== alert) { al.innerHTML = alert; al.dataset.v = alert; }
    const tl = T.liveTips[k] || [], tips = tl.filter(tp => s.st.findIndex(x => x.name === tp.after) <= Math.floor(s.pos));
    const tp = s.mode === 'before' ? tl[0] : tips[tips.length - 1];
    $('#live-tip').innerHTML = tp && s.mode !== 'after' ? `<div class="tip"><span class="tg">${tp.tag}</span><b>${tp.title}</b><p>${tp.text}</p></div>` : '';
  }

  /* ========== ごはん ========== */
  function shopCard(s) {
    const votes = store.get('votes', []);
    const tdow = dowOf(now());
    const closedToday = s.closedDays && s.closedDays.includes(tdow) && phase() === 'during';
    return `<article class="shop" id="${s.id}"><div class="shop-top"><span class="code">${s.code}</span><div>
      <div class="meta">${s.genre}・${s.place}</div><h3>${esc(s.name)}</h3>
      <div class="tags">${s.cash ? '<span class="tag red">現金のみ</span>' : '<span class="tag blue">カード可</span>'}${s.takeout ? '<span class="tag">持ち帰り</span>' : ''}${s.closed ? `<span class="tag${s.closedDays ? ' red' : ''}">${s.closed}</span>` : ''}${closedToday ? '<span class="tag red">今日は休み</span>' : ''}</div></div></div>
      <ul class="picks">${s.picks.map(([n, p, d]) => `<li><div>${esc(n)}${d ? `<span>${esc(d)}</span>` : ''}</div><div class="pr num">${yen(p)}</div></li>`).join('')}</ul>
      ${infoList([['営業', esc(s.hours)], ['支払い', esc(s.pay)], ['住所', esc(s.address)], ['電話', `<a href="${tel(s.tel)}">${s.tel}</a>`]].concat(s.takeout ? [['持ち帰り', esc(s.takeout)]] : []).concat(s.rule ? [['お作法', esc(s.rule)]] : []))}
      <div class="btns"><button class="vote ${votes.includes(s.id) ? 'on' : ''}" data-vote="${s.id}">${votes.includes(s.id) ? '♥ 行きたい' : '♡ 行きたい'}</button>${ext(gmap(s.name), '地図')}${ext(s.url, 'お店の情報')}</div></article>`;
  }
  function viewFood(sub) {
    const L = T.lunch[0];
    const filt = session.get('ffilt') || 'all';
    const fdays = { all: 'すべて', d17: '10/17（土）も営業', d18: '10/18（日）も営業', card: 'カードが使える' };
    const dayDow = { d17: 6, d18: 0 };
    const list = T.dinner.filter(s => filt === 'all' ? true : filt === 'card' ? !s.cash : !(s.closedDays || []).includes(dayDow[filt] ?? -1));
    const votes = store.get('votes', []);
    return `<div class="wrap">${topbar()}${phead('Food', 'ごはん', '決まっているお昼ごはんと、夕ごはんの候補7店。')}
      <section class="sec" style="margin-top:8px" id="marukatsu">${secH('10/18 お昼　まるかつ天理店', 'Lunch')}
        <p class="small muted">${L.when}・${L.sub}</p>
        <p class="spot-lead">${esc(L.lead)}</p>
        <ul class="picks">${L.menu.map(([n, p, d, hl]) => `<li class="${hl ? 'hl' : ''}"><div>${esc(n)}${d ? `<span>${esc(d)}</span>` : ''}</div><div class="pr num">${yen(p)}</div></li>`).join('')}</ul>
        <p class="note">${esc(L.note)}</p>
        ${infoList([['住所', esc(L.address)], ['電話', `<a href="${tel(L.tel)}">${L.tel}</a>`], ['営業', esc(L.hours)], ['支払い', esc(L.pay)]])}
        <div class="btns">${ext(gmap('まるかつ天理店'), '地図')}${ext(L.url, 'お店の情報')}</div>
        ${visitBlock('food')}
      </section>
      <section class="sec" id="joterrace">${secH('10/19 お昼　JO-TERRACE OSAKA', 'Lunch')}
        <p class="small">大阪城公園の中。お店は現地で決めます。</p><div class="btns">${ext('https://jo-terrace.jp/', 'JO-TERRACE OSAKA（公式）')}<a class="more" href="#/spot/osakajo">大阪城公園のページへ</a></div>
      </section>
      <section class="sec" id="dinner">${secH('夕ごはん候補', 'Dinner')}
        <p class="sec-lead">梅田3店と新大阪4店。気になるお店に「行きたい」を押しておくと、候補を絞るときの目安になります（印はこの端末だけに残ります）。${votes.length ? `<br>いま「行きたい」：<b>${votes.map(v => (T.dinner.find(s => s.id === v) || {}).name).filter(Boolean).join('、')}</b>` : ''}</p>
        <div class="filters" role="group" aria-label="絞り込み">${Object.entries(fdays).map(([k, l]) => `<button class="fchip ${filt === k ? 'on' : ''}" data-ffilt="${k}">${l}</button>`).join('')}</div>
        ${['umeda', 'shinosaka'].map(a => { const shops = list.filter(s => s.area === a); const A = T.dinnerAreas[a]; return `<div class="area-h"><h3>${A.name}</h3><span class="small muted">${A.sub}</span></div>${shops.length ? shops.map(shopCard).join('') : '<p class="empty">条件に合うお店はありません。</p>'}`; }).join('')}
      </section></div>`;
  }

  /* ========== おでかけ ========== */
  function triviaBlock(key) {
    const g = T.trivia[key];
    return `<h3 class="sub">${g.title}</h3>${g.big ? `<div class="bignum"><b class="num">${g.big[0]}</b><span>${g.big[1]}</span></div>` : ''}
      <div class="cards">${g.cards.map(([k, q, a], j) => `<button class="flip" data-flip data-tv="${key}-${j}"><div class="fk">${k}</div><div class="fq">${esc(q)}</div><div class="fa">${esc(a)}</div><div class="fh">タップして読む</div></button>`).join('')}</div>${g.note ? `<p class="note">${g.note}</p>` : ''}`;
  }
  function stampsBlock() {
    const st = Stamps.get(), got = Stamps.count(st), all = got === T.stamps.length;
    return `<p class="small muted" style="margin-bottom:14px">行った場所をタップしてスタンプを押します。スポットの紹介ページの「行った」でも押せます。もう一度タップすると消せます（この端末だけに残ります）。いま <span class="stamp-count num">${got}</span> / ${T.stamps.length}</p>
      <div class="stamps">${T.stamps.map(s => `<button class="stamp ${st[s.id] ? 'on' : ''}" data-stamp="${s.id}" aria-pressed="${!!st[s.id]}" aria-label="${esc(s.name)}${st[s.id] ? '（押した）' : ''}">${stampSvg(s, st[s.id], 'sc')}<span class="stn">${esc(s.name)}</span><span class="num" style="color:var(--sumi-3)">${st[s.id] ? esc(Stamps.when(st[s.id])) : `${s.day}日目`}</span></button>`).join('')}</div>
      ${all ? `<div class="stamp-done">${MANGAN}<div><b>満願</b><p class="small">${T.stamps.length}の印が、すべてそろいました。おつかれさまでした。</p></div></div>` : ''}`;
  }
  /* すべて集めたときの印（満願）。自作の図案 */
  const MANGAN = `<svg class="mangan" viewBox="0 0 96 96" aria-hidden="true"><g class="ink"><circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="48" cy="48" r="38.5" fill="none" stroke="currentColor" stroke-width="1"/>
    ${Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return `<circle cx="${(48 + 41.3 * Math.sin(a)).toFixed(1)}" cy="${(48 - 41.3 * Math.cos(a)).toFixed(1)}" r="1.1" fill="currentColor"/>`; }).join('')}
    <text x="48" y="45" class="mg1">満願</text><text x="48" y="62" class="mg2">奈良・大阪</text><text x="48" y="73" class="mg3">2026</text></g></svg>`;
  /* 最後の1つを押したときだけ、静かに知らせる */
  function stampComplete() {
    sheet('スタンプがそろいました', `<div class="mangan-sheet">${MANGAN}<p>4日間で、${T.stamps.length}の印がすべてそろいました。<br>おつかれさまでした。</p><p class="small muted">スタンプ帳は、旅のあとも見返せます。</p><div class="btns" style="justify-content:center"><a class="btn quiet" href="#/spot/stamps">スタンプ帳を見る</a></div></div>`);
  }
  function viewSpots(sub) {
    const s = T.spots.find(x => x.id === sub);
    if (s) return viewSpot(s);
    const st = Stamps.get();
    return `<div class="wrap">${topbar()}${phead('Places', 'おでかけ', '4日間で立ち寄る場所と、知ってから歩くと楽しい小ネタ。')}
      <a class="stamp-mini" href="#stamps">${ic('stamp')}旅の記録スタンプ<span class="num"><b>${Stamps.count(st)}</b> / ${T.stamps.length}</span></a>
      <div>${T.spots.map(p => `<a class="spotrow" href="#/spot/${p.id}" style="--c:${DAYC(p.day)}"><span class="spot-ill">${art(SPOT_ART[p.id])}${st[p.id] ? stampSvg(T.stamps.find(x => x.id === p.id), st[p.id], 'mini') : ''}</span><span><span class="sw">${p.day}日目・${p.when.split('）')[1] || ''}｜${p.area}</span><h3>${esc(p.name)}</h3><p>${esc(p.lead)}</p></span></a>`).join('')}</div>
      <section class="sec" id="stamps">${secH('スタンプ帳', 'Stamps')}${stampsBlock()}</section></div>`;
  }
  function viewSpot(s) {
    const c = DAYC(s.day);
    const i = T.spots.indexOf(s), prev = T.spots[i - 1], next = T.spots[i + 1];
    return `<div class="wrap" style="--c:${c}">${topbar()}
      <header class="spot-hero"><div><div class="kana">${esc(s.kana)}</div><h1>${esc(s.name)}</h1><div class="when num">${s.day}日目・${s.when}</div></div>${art(SPOT_ART[s.id])}</header>
      <p class="spot-lead">${esc(s.lead)}</p>
      ${visitBlock(s.id)}
      ${latestMini('#/spot/' + s.id)}
      ${s.warn ? `<div class="warn"><span>${esc(s.warn)}</span></div>` : ''}
      ${s.steps ? `<section class="sec">${secH('走るルート', 'Route')}<ol class="walk">${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>` : ''}
      ${s.walk ? `<section class="sec">${secH('おすすめの歩き方', 'Walk')}<ol class="walk">${s.walk.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="note">${esc(s.walkNote)}</p></section>` : ''}
      <section class="sec">${secH('基本情報', 'Info')}${infoList(s.info.map(([k, v]) => [k, k === '電話' ? `<a href="${tel(v)}">${esc(v)}</a>` : esc(v)]))}
        ${s.fees ? `<h3 class="sub">拝観料</h3>${infoList(s.fees)}` : ''}
        <div class="btns">${s.map ? ext(gmap(s.map), '地図') : ''}${s.url ? ext(s.url, '公式の情報') : ''}${(s.urls || []).map(([l, u]) => ext(u, `${esc(l)}（公式）`)).join('')}${(s.links || []).map(([l, u]) => ext(u, l)).join('')}${s.id === 'todaiji' ? '<a class="btn quiet" href="#/sos/parking">駐車場の候補</a>' : ''}</div>
        ${s.maps ? `<h3 class="sub">公式の案内図</h3><div class="btns omap-btns">${s.maps.map(([l, u]) => ext(u, esc(l))).join('')}</div>` : ''}</section>
      ${s.trivia ? `<section class="sec">${secH('知ってから歩くと、景色が変わる', 'Trivia')}${s.trivia.map(triviaBlock).join('')}<div class="btns"><a class="more" href="#/trivia/${['sakurai', 'todaiji'].includes(s.id) ? 'nara' : 'osaka'}">出典つきで、トリビアのページで読む →</a></div></section>`
        : `<section class="sec">${secH('トリビア', 'Trivia')}<div class="btns"><a class="more" href="#/trivia/${['sakurai', 'todaiji'].includes(s.id) ? 'nara' : 'osaka'}">${['sakurai', 'todaiji'].includes(s.id) ? '桜井・奈良' : '大阪'}のトリビアを読む →</a></div></section>`}
      <div class="btns" style="justify-content:space-between;margin-top:36px">${prev ? `<a class="btn quiet" href="#/spot/${prev.id}">← ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a class="btn quiet" href="#/spot/${next.id}">${esc(next.name)} →</a>` : ''}</div></div>`;
  }

  /* ========== やど・くるま ========== */
  function carMeter() {
    const t = now(), out = new Date(T.car.out), back = new Date(T.car.back);
    const planned = jst('2026-10-18', T.car.plannedBack);
    if (t < out) return `<div class="meter"><div class="small muted">受け取り</div><div class="big num">${T.car.outLabel}</div><div class="small">返却の予定は17:50（予約は20:00まで）</div></div>`;
    if (t >= back) return `<div class="meter"><div class="small muted">レンタカー</div><div class="big">返却ずみ</div></div>`;
    const m = Math.max(0, Math.round((planned - t) / 6e4)), mm = Math.max(0, Math.round((back - t) / 6e4));
    return `<div class="meter"><div class="small muted">返却の予定（17:50）まで</div><div class="big num">${Math.floor(m / 60)}時間${m % 60}分</div><div class="small">予約の終わり（20:00）まで ${Math.floor(mm / 60)}時間${mm % 60}分。ガソリンは満タンで返します。</div></div>`;
  }
  function viewStay() {
    const H = T.hotel, C = T.car, f = fam();
    return `<div class="wrap">${topbar()}${phead('Stay &amp; Drive', 'やど・くるま', `${H.name}に3泊。10/18はレンタカーで奈良へ。`)}
      <section class="sec" style="margin-top:4px">${secH('ホテル', 'Hotel')}
        <p class="room-name" style="font-size:18px">${esc(H.name)}</p>
        ${infoList([['住所', esc(H.address)], ['電話', `<a href="${tel(H.tel)}">${H.tel}</a>`], ['チェックイン', H.checkin], ['チェックアウト', H.checkout], ['行き方', H.access], ['支払い', esc(H.pay)]])}
        <p class="note">${esc(H.plan)}${esc(H.soine)}</p>
        <button class="qrmini" data-act="qr"><span><b>自動チェックインQR</b><br><span class="small muted">フロントの端末にかざすだけ。${f ? famName() + 'の分を表示します。' : ''}</span></span><span class="qrthumb" data-qrthumb="${f === 'iizuka' ? 'r1' : 'r3'}">${Lock.get() ? `<img src="${qrSrc(Lock.get()[f === 'iizuka' ? 'r1' : 'r3'].qr)}" alt="">` : ic('key')}</span></button>
        <div class="btns">${ext(gmap(H.name), '地図')}${ext(H.url, 'ホテルの公式サイト')}</div>
      </section>
      <section class="sec">${secH('お部屋', 'Rooms')}
        ${Object.entries(H.rooms).map(([, r]) => `<div class="roomcard${f && r.family === f ? ' mine' : ''}"><div style="display:flex;gap:10px;align-items:baseline"><span class="room-no">${r.no}</span><div><div class="small muted">${r.who}・${r.nights}</div><div class="room-name">${esc(r.name)}</div></div></div>
          ${infoList([['広さ', r.size], ['ベッド', esc(r.bed)], ['水まわり', r.bath], ['喫煙', '禁煙']].concat(r.amenity ? [['設備', esc(r.amenity)]] : []))}
          <div style="margin-top:10px"><div class="price-line"><span>客室料金</span><s class="num">${yen(r.list)}</s></div><div class="price-line"><span>10周年記念 30%オフ</span><span class="num">−${yen(r.off).slice(1)}</span></div><div class="price-line total"><span>お支払い</span><span class="num">${yen(r.price)}</span></div></div></div>`).join('')}
      </section>
      <section class="sec">${secH('館内のフロア', 'Floors')}
        <ul class="floors">${H.floors.map(([fl, d, hl]) => `<li class="${hl ? 'hl' : ''}"><b class="num">${fl}</b><span>${esc(d)}</span></li>`).join('')}</ul>
        <h3 class="sub">朝ごはん</h3>${infoList([['場所', H.breakfast.place], ['時間', H.breakfast.time]])}<p class="small" style="margin-top:8px">${H.breakfast.text}</p>
        <h3 class="sub">大浴場・サウナ</h3>${infoList([['場所', H.bath.place], ['時間', H.bath.time.join('／')]])}<p class="small" style="margin-top:8px">${H.bath.text}</p><div class="warn"><span>${H.bath.warn}</span></div>
        <h3 class="sub">滞在中に便利なこと</h3>${infoList(H.perks)}
      </section>
      <section class="sec" id="car">${secH('レンタカー　10/18（日）', 'Rent-a-car')}
        ${carMeter()}
        <p class="small muted" style="margin-top:14px">予約番号</p><p>予約メールをご確認ください</p>
        ${infoList([['お店', esc(C.shop)], ['クラス', `${esc(C.klass)}<br><span class="small muted">${esc(C.klassNote)}</span>`], ['受け取り', C.outLabel], ['返却', `${C.backLabel}（予定は17:50）`], ['住所', esc(C.address)], ['電話', `<a href="${tel(C.tel)}">${C.tel}</a>`], ['行き方', C.access]])}
        <h3 class="sub">料金</h3>${C.lines.map(([k, v]) => `<div class="price-line"><span>${k}</span><span class="num">${v === 0 ? '¥0' : yen(v)}</span></div>`).join('')}<div class="price-line total"><span>合計（税込）</span><span class="num">${yen(C.total)}</span></div>
        <div class="tags" style="margin-top:10px">${C.included.map(x => `<span class="tag">${x}</span>`).join('')}</div>
        <p class="note">${esc(C.pay)}</p>
        <h3 class="sub">覚えておくこと</h3>${infoList(C.notes)}
        <div class="btns">${ext(gmap(C.shop), '地図')}</div>
      </section></div>`;
  }

  /* ========== もしも ========== */
  function viewSos() {
    const S = T.sos, Pk = T.parking;
    return `<div class="wrap">${topbar()}${phead('Just in case', 'もしものとき', '迷ったら、次の一手だけ確認。番号をタップすると電話をかけられます。')}
      <div class="dial">${S.urgent.map(([n, l, d], k) => `<a href="tel:${n}" data-sid="sos-u${k}"><b class="num">${n}</b><span>${l}</span><small>${d}</small></a>`).join('')}</div>
      ${S.consult.map((g, gi) => `<section class="sec">${secH(g.label, g.short)}${g.rows.map(([a, n, t, h], ri) => `<div class="telrow" data-sid="sos-c${gi}-${ri}"><span class="area">${a}</span><span>${n}<br><span class="small muted">${h}</span></span><a href="${tel(t)}" class="num">${t}</a></div>`).join('')}<div class="btns"><a class="btn fill" href="tel:${g.short}">${g.short} に電話</a></div></section>`).join('')}
      <section class="sec">${secH('近くの病院', 'Hospitals')}
        ${S.hospitals.map((h, k) => `<div class="hosp" data-sid="hosp-${k}"><div class="small muted">${h.area}側</div><h3 class="room-name" style="font-size:17px">${esc(h.name)}</h3><span class="tag red">${h.badge}</span><p class="small" style="margin-top:6px">${esc(h.text)}</p>
          ${infoList([['住所', esc(h.address)], ['電話', `<a href="${tel(h.tel)}">${h.tel}</a>${h.tel2 ? `<br><span class="small muted">携帯から</span> <a href="${tel(h.tel2)}">${h.tel2}</a>` : ''}`]])}<div class="btns">${ext(gmap(h.name), '地図')}${ext(h.url, '公式サイト')}</div></div>`).join('')}
        <div class="btns">${ext(S.navi, 'いま診てもらえる病院を探す（医療情報ネット ナビイ）', 'btn')}</div>
        <h3 class="sub">受診のときにあると便利</h3><ul class="steps" style="counter-reset:none">${S.bring.map(x => `<li style="padding-left:0">・${esc(x)}</li>`).join('')}</ul>
      </section>
      <section class="sec" id="accident">${secH('交通事故のとき', 'Accident')}<ol class="steps">${S.accident.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <div class="btns"><a class="btn quiet" href="${tel(T.car.tel)}">レンタカー会社 ${T.car.tel}</a></div></section>
      <p class="note">${esc(S.note)}</p>
      <section class="sec" id="parking">${secH('奈良公園近くの駐車場　10/18', 'Parking')}${latestMini('#/sos/parking')}
        <p class="memo" style="margin-bottom:6px">${esc(Pk.rule)}</p>
        ${Pk.list.map((p, k) => `<div class="park${p.first ? ' first' : ''}" data-sid="park-${k}"><div class="park-top"><span class="no">${p.no}</span><h3>${esc(p.name)}</h3><span class="small muted">${p.spaces}・${p.open}</span></div>
          <p class="small" style="margin-top:4px"><b>${esc(p.fee)}</b></p><p class="small muted">${esc(p.note)}</p>${p.src ? `<p class="small muted">出典：<a class="ext" href="${p.src[1]}" target="_blank" rel="noopener">${esc(p.src[0])}</a></p>` : ''}
          <div class="btns">${ext(p.nav, 'ナビで行く', p.first ? 'btn fill' : 'btn quiet')}${p.live ? ext(p.live, '空き状況') : ''}</div></div>`).join('')}
        <p class="note">料金・営業時間は Times24・奈良県・興福寺の公式情報（2026年9月14日確認）。現地の表示を優先してください。</p>
      </section></div>`;
  }

  /* ========== お金 ========== */
  const SPLITS = { half: '2家族で折半', people: '人数で割る（4：2）', iizuka: '飯塚家だけ', yamaguchi: '山口家だけ' };
  function settle(list) {
    let bal = { iizuka: 0, yamaguchi: 0 };
    list.forEach(e => {
      const a = +e.amt || 0;
      const share = e.split === 'half' ? { iizuka: a / 2, yamaguchi: a / 2 } : e.split === 'people' ? { iizuka: a * 4 / 6, yamaguchi: a * 2 / 6 } : e.split === 'iizuka' ? { iizuka: a, yamaguchi: 0 } : { iizuka: 0, yamaguchi: a };
      bal[e.payer] += a; bal.iizuka -= share.iizuka; bal.yamaguchi -= share.yamaguchi;
    });
    return Math.round(bal.iizuka);
  }
  /* 予算は assets/budget.json から毎回計算する（Budget.view：assets/budget.js）。読み込めるまでは、その旨だけ出す */
  const BAR_COLORS = ['var(--ai)', 'var(--yamabuki)', 'var(--moegi)', 'var(--shu)', 'var(--day3)'];
  /* 決算と精算（実際に払った額を1件でも入れたら出す） */
  function settleHtml(V) {
    const A = V.act, S = V.settle, net = S.net;
    const msg = !S.rows ? '立て替えた家族を入れた項目がまだありません。' : net === 0 ? 'いまは精算なしで、ぴったりです。' : net > 0 ? `山口家 → 飯塚家へ <b class="num">${yen(net)}</b>` : `飯塚家 → 山口家へ <b class="num">${yen(-net)}</b>`;
    const diff = A.total - A.extra - A.budgetOfDone;
    return `<div class="bd-act">
        <dl class="bd-dl"><div><dt>実際に払った額の合計</dt><dd class="num">${yen(A.total)}</dd></div>
          <div><dt>予算との差<small>（決算を入れた${A.rows - A.extraRows}項目の予算 ${yen(A.budgetOfDone)} と比べて）</small></dt><dd class="num">${diff > 0 ? '+' + yen(diff) : yen(diff)}</dd></div>
          <div><dt>予定外の出費<small>（${A.extraRows}件）</small></dt><dd class="num">${yen(A.extra)}</dd></div>
          <div><dt>立て替えた額</dt><dd class="num">飯塚家 ${yen(S.paid.iizuka)}<br>山口家 ${yen(S.paid.yamaguchi)}</dd></div>
          <div><dt>負担する額</dt><dd class="num">飯塚家 ${yen(S.owe.iizuka)}<br>山口家 ${yen(S.owe.yamaguchi)}</dd></div></dl>
        <p class="settle">精算：${msg}</p>
        <p class="small muted">実際に払った額と立て替えた家族を入れた${S.rows}件で計算しています。${S.noPayer ? `立て替えた家族がまだの項目が${S.noPayer}件、` : ''}${A.todo ? `決算をまだ入れていない予算の項目が${A.todo}件あります。` : '予算の項目は、すべて決算を入れました。'}</p></div>`;
  }
  const bdMode = V => (V && V.act.rows && session.get('bdMode') === 'actual' ? 'actual' : 'budget');
  function budgetHtml(V, f) {
    if (!V) return `<p class="empty" id="bd-wait">予算を読み込んでいます…<br><span class="small muted">しばらくしても出ないときは、電波のある所で開き直してください。</span></p>`;
    const mine = k => (f === k ? ' mine' : '');
    const act = bdMode(V) === 'actual';
    /* 予算／実績で切り替える数字（実績：実際に払った額。予定外の出費も入れる） */
    const sum = g => (act ? g.asum : g.sum), famOf = g => (act ? g.afam : g.fam);
    const max = Math.max(1, ...V.groups.map(sum));
    const diffTxt = n => (n > 0 ? '+' + yen(n) : n < 0 ? yen(n) : '±¥0');
    const rowsOf = g => (act ? g.rows : g.rows.filter(r => !r.extra));
    const rowHtml = r => act
      ? `<tr><td>${esc(r.name)}<span class="sm">${r.extra ? `予定外の出費${r.text ? '・' + esc(r.text) : ''}` : esc(r.text)}</span><span class="sm">${r.has ? (r.extra ? '' : `予算 ${yen(r.amount)}・差 ${diffTxt(r.actual - r.amount)}`) : `予算 ${yen(r.amount)}・決算はまだ`}</span></td><td class="r num">${r.has ? yen(r.actual) : '<span class="muted">—</span>'}</td></tr>`
      : `<tr><td>${esc(r.name)}<span class="sm">${esc(r.text)}</span></td><td class="r num">${yen(r.amount)}</td></tr>`;
    return `${V.act.rows ? `<div class="segs bd-mode" role="group" aria-label="予算と実績の切り替え">${[['budget', '予算'], ['actual', '実績（決算）']].map(([k, l]) => `<button type="button" data-bdmode="${k}" aria-pressed="${(act ? 'actual' : 'budget') === k}" class="${(act ? 'actual' : 'budget') === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <div class="total"><span>${act ? '実際に払った額の合計' : '合計'}</span><b class="num">${yen(act ? V.act.total : V.total)}</b></div>
      ${act ? `<p class="small muted bd-note">決算を入れた${V.act.rows}件の合計です（予定外の出費${V.act.extraRows}件をふくむ）。決算をまだ入れていない予算の項目が${V.act.todo}件あります。</p>` : ''}
      <div class="bars">${V.groups.map((g, i) => `<div class="bar" style="--c:${BAR_COLORS[i % BAR_COLORS.length]}"><span>${esc(g.name)}</span><i style="width:${(sum(g) / max * 100).toFixed(1)}%"></i><span class="v num">${yen(sum(g))}</span></div>`).join('')}</div>
      <section class="sec">${secH(act ? '家族ごとの内訳（実績）' : '家族ごとの内訳', 'By family')}
        <div class="tbl"><table class="ledger"><thead><tr><th></th><th class="r${mine('iizuka')}">飯塚家</th><th class="r${mine('yamaguchi')}">山口家</th></tr></thead><tbody>
        ${V.groups.map(g => `<tr><td>${esc(g.name)}<span class="sm">${esc(g.famNote)}</span></td><td class="r num${mine('iizuka')}">${yen(famOf(g).iizuka)}</td><td class="r num${mine('yamaguchi')}">${yen(famOf(g).yamaguchi)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td>合計</td><td class="r num${mine('iizuka')}">${yen((act ? V.act.fam : V.fam).iizuka)}</td><td class="r num${mine('yamaguchi')}">${yen((act ? V.act.fam : V.fam).yamaguchi)}</td></tr></tfoot></table></div>
      </section>
      ${V.act.rows ? `<section class="sec" id="settle">${secH('決算と精算', 'Settlement')}${settleHtml(V)}</section>` : ''}
      <section class="sec">${secH(act ? '決算の明細' : '予算の明細', 'Details')}
        ${V.groups.map(g => `<div class="group-h"><b>${esc(g.name)}</b><span class="num" style="font-weight:700">${yen(sum(g))}</span></div>${g.note ? `<p class="small muted">${esc(g.note)}</p>` : ''}
          <table class="ledger"><tbody>${rowsOf(g).map(rowHtml).join('')}</tbody></table>`).join('')}
      </section>`;
  }
  function viewMoney() {
    const f = fam();
    const exp = store.get('expenses', []);
    const net = settle(exp);
    const msg = exp.length === 0 ? 'まだ記録はありません。' : net === 0 ? 'いまは精算なしで、ぴったりです。' : net > 0 ? `山口家 → 飯塚家へ <b class="num">${yen(net)}</b>` : `飯塚家 → 山口家へ <b class="num">${yen(-net)}</b>`;
    return `<div class="wrap">${topbar()}${phead('Budget', '予算と割り勘メモ', '3泊4日・飯塚家4名＋山口家2名の積算です。レンタカー代と宿泊費は確定予約の金額です。')}
      ${budgetHtml(Budget.view(), f)}
      ${Budget.admin.has() ? `<p class="kn-entry"><a class="btn quiet" href="#/kanri">予算を直す（管理ページ）</a><span class="small muted">この端末にはトークンが保存されています</span></p>` : ''}
      <section class="sec" id="split">${secH('割り勘メモ', 'Split')}
        <p class="sec-lead">旅行中に立て替えたお金を記録すると、最後にどちらがいくら払えばいいか計算します。記録はこの端末だけに残るので、記録係を1人決めておくと確実です。</p>
        <form class="form" id="expform" autocomplete="off">
          <label>内容<input id="ex-what" required placeholder="例：たこ焼き（はなだこ）"></label>
          <div class="two"><label>金額（円）<input id="ex-amt" type="number" inputmode="numeric" min="1" required placeholder="1200"></label>
          <label>払った家族<select id="ex-payer"><option value="iizuka"${f === 'iizuka' ? ' selected' : ''}>飯塚家</option><option value="yamaguchi"${f === 'yamaguchi' ? ' selected' : ''}>山口家</option></select></label></div>
          <label>分け方<select id="ex-split">${Object.entries(SPLITS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <button class="btn fill" type="submit">記録する</button>
        </form>
        <p class="settle">${msg}</p>
        ${exp.length ? `<table class="ledger"><tbody>${exp.map((e, i) => `<tr><td>${esc(e.what)}<span class="sm">${T.families[e.payer].name}が支払い・${SPLITS[e.split]}</span></td><td class="r num">${yen(+e.amt)}</td><td class="r"><button class="del" data-del="${i}" aria-label="${esc(e.what)}を消す">×</button></td></tr>`).join('')}</tbody></table>` : ''}
      </section></div>`;
  }

  /* ========== 予算の管理ページ（#/kanri） ==========
     メニュー・検索には出さない。GitHub のトークンを保存した端末だけ、予算のページの下に入口を出す（家族が迷い込まないように）。
     初めての端末は、URL の最後に #/kanri を付けて開き、トークンの作り方に沿って保存する。
     直した内容は Budget.admin.queue で端末に貯め、公開側の最新を読み直してから送る（assets/budget.js） */
  const KN_UNTIL = '2026-11-30';
  const KN_WHO = [['大人', '大人'], ['子ども', '子ども'], ['', '（人数を書かない）']];
  const KN_PER = ['', '日', '泊', '回', '個', '本', '枚', '台'];
  const knInt = v => Math.max(0, Math.round(Number(String(v ?? '').replace(/[,，\s円]/g, '')) || 0));
  const knHM = t => new Date(t).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit' });
  const knUpd = s => (s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)} ${s.slice(11, 16)}` : '');
  /* GitHub のトークン作成画面を、名前・説明・期限（11/30まで）・権限（Contents の読み書き）を入れた状態で開く（GitHub の公式の機能：URL で入力済みにできる） */
  function knTokenUrl() {
    const days = Math.round((Date.parse(KN_UNTIL + 'T00:00:00+09:00') - Date.parse(ymd(new Date()) + 'T00:00:00+09:00')) / 864e5);
    const q = new URLSearchParams({ name: '旅のしおり 予算の編集', description: '旅のしおりの予算（assets/budget.json）を管理ページから直すため。公開リポジトリ Nara-Osaka-Trip_2026 だけ・Contents の読み書きだけ。', target_name: 'Shohei-A11Y', expires_in: String(Math.max(1, Math.min(366, days))), contents: 'write' });
    return 'https://github.com/settings/personal-access-tokens/new?' + q.toString();
  }
  const KN_ERR = {
    offline: '圏外です。変更はこの端末に保存してあり、電波が戻ったら自動で送ります。',
    net: '通信できませんでした。変更はこの端末に保存してあります。電波の良い所で「今すぐ送る」を押してください（電波が戻ったときにも自動で送ります）。',
    auth: 'トークンが使えません（期限切れか、GitHub で消されています）。下の「この端末のトークンを消す」を押し、作り直して保存してください。未送信の変更は消えません。',
    perm: 'このトークンでは書き込めません。トークンの「Repository access」で Nara-Osaka-Trip_2026 を選んでいるか、「Contents」が「Read and write」になっているかを確かめてください。',
    notfound: '公開しているしおりに予算のファイル（assets/budget.json）が見つかりません。',
    conflict: '送ろうとするたびに、ほかの所で先に更新されたため、送れませんでした。少し待ってから「今すぐ送る」を押してください。'
  };
  const knErr = e => KN_ERR[e.kind] || `送れませんでした（${esc(e.msg || e.status || '')}）。少し待ってから「今すぐ送る」を押してください。`;
  function knSetup() {
    return `<div class="kn-note"><b>家族の端末では使いません。</b>トークン（GitHub の合鍵）は、この端末の中だけに保存します。しおりのファイルには入れず、使うのは GitHub に予算を送るときだけです。</div>
      <section class="sec">${secH('1. トークンを作る', 'Step 1')}
        <p class="sec-lead">最初に1回だけ。スマホのブラウザで、1画面ずつ進めます（5分ほど）。使えるのは、公開しているしおりのリポジトリ1つの「中身の読み書き」だけ、期限は11月30日までにします。</p>
        <ol class="kn-steps">
          <li><b>下のボタンで GitHub を開く。</b>ログインの画面が出たら、いつもの GitHub のアカウント（Shohei-A11Y）でログインします。<div class="btns"><a class="btn fill ext" href="${esc(knTokenUrl())}" target="_blank" rel="noopener">GitHub でトークンを作る</a></div></li>
          <li><b>「New fine-grained personal access token」の画面。</b>いちばん上の「Token name」に「旅のしおり 予算の編集」、「Expiration」に11月30日までの日数が入っていることを確かめます。入っていないときは、Token name に同じ名前を入れ、Expiration で「Custom」を選んで 2026年11月30日 を選びます。</li>
          <li><b>「Resource owner」を確かめる。</b>「Shohei-A11Y」になっていれば、そのままで大丈夫です。</li>
          <li><b>下へ進み、「Repository access」で「Only select repositories」を選ぶ。</b>出てきた「Select repositories」を押して「Nara-Osaka-Trip_2026」と入れ、「Shohei-A11Y/Nara-Osaka-Trip_2026」を選びます。名前の最後が「-dev」の方は選びません。</li>
          <li><b>「Permissions」で「Contents」が「Read and write」になっていることを確かめる。</b>「Metadata」の「Read-only」は自動で付きます（外しません）。「Contents」が無いときは「Add permissions」を押して「Contents」を選び、右の選択を「Read and write」にします。ほかの権限は足しません。</li>
          <li><b>いちばん下の「Generate token」を押す。</b>確かめの画面が出たら、もう一度「Generate token」を押します。</li>
          <li><b>「github_pat_」で始まる長い文字が出る。</b>この画面を閉じると二度と見られないので、横のコピーのボタンでコピーします。</li>
          <li><b>このページに戻り、下の「2. この端末に保存する」に貼り付けて「保存して確かめる」を押す。</b>「保存しました」と出れば完了です。</li>
        </ol>
        <p class="note">ボタンで開けないとき：GitHub の右上の自分のアイコン →「Settings」→ メニューのいちばん下の「Developer settings」→「Personal access tokens」→「Fine-grained tokens」→「Generate new token」で、同じ画面になります（2〜7は同じ）。</p>
      </section>
      <section class="sec">${secH('2. この端末に保存する', 'Step 2')}
        <form class="form" id="kn-tok" autocomplete="off">
          <label>トークン（github_pat_ で始まる文字）<input id="kn-tok-in" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required placeholder="github_pat_…"></label>
          <button class="btn fill" type="submit">保存して確かめる</button>
          <p class="small muted" id="kn-tok-msg" role="status"></p>
        </form>
        <p class="note">期限の11月30日を過ぎたら、同じ手順で作り直してください。この端末から消すときは、保存したあとのこのページの下にある「この端末のトークンを消す」を押します。</p>
      </section>`;
  }
  function knStatus() {
    const S = Budget.admin.status(), out = [];
    if (S.busy) out.push('<b>送信中…</b>（送る前に、公開側の最新を読み直しています）');
    if (S.n) out.push(`<b class="kn-pend">未送信 ${S.n}件</b>${S.online ? '' : '　圏外のため、この端末に保存しています。電波が戻ったら自動で送ります。'}`);
    else if (!S.busy) out.push('未送信の変更はありません。');
    if (S.err && (S.n || !['offline', 'net'].includes(S.err.kind)) && !S.busy) out.push(`<span class="kn-err">${knErr(S.err)}</span>`);
    if (S.sent && !S.n) out.push(`${knHM(S.sent.at)} に送りました（変更${S.sent.n}件・第${S.sent.rev}版）。家族のしおりには1〜2分で反映されます。${S.sent.reread ? '<br>送る前に読み直したところ、公開側が先に更新されていたので、その最新の上に今回の変更を重ねました。' : ''}`);
    if (S.remote) out.push(`<span class="small muted">公開側：第${S.remote.rev}版（${knUpd(S.remote.updated)} 更新）を ${knHM(S.remote.at)} に読みました</span>`);
    return `<div class="kn-st${S.n ? ' pend' : ''}" role="status">${out.map(x => `<p>${x}</p>`).join('')}
      <div class="btns"><button type="button" class="btn quiet" data-kn="reload"${S.busy ? ' disabled' : ''}>公開側の最新を読み直す</button>${S.n ? `<button type="button" class="btn fill" data-kn="send"${S.busy ? ' disabled' : ''}>今すぐ送る</button>` : ''}</div></div>`;
  }
  function knMain(V) {
    if (!V) return '<p class="empty">予算を読み込んでいます…</p>';
    return `<div class="kn-sum"><span>予算の合計</span><b class="num">${yen(V.total)}</b><small class="num">飯塚家 ${yen(V.fam.iizuka)}／山口家 ${yen(V.fam.yamaguchi)}</small></div>
      ${V.groups.map(g => `<section class="kn-g">
        <div class="kn-gh"><h3>${esc(g.name)}</h3><span class="num">${yen(g.sum)}</span></div>
        <p class="kn-gn">${g.note ? `注記：${esc(g.note)}` : '注記なし'}　家族ごとの説明：${esc(g.famNote) || 'なし'}</p>
        <ul class="kn-rows">${g.rows.map(r => `<li><button type="button" class="kn-row" data-kn="redit" data-r="${esc(r.id)}">
          <span class="kn-rn">${esc(r.name)}${r.extra ? '<i class="kn-tag">予定外</i>' : ''}</span><span class="kn-ra num">${r.extra ? '' : yen(r.amount)}</span>
          ${r.text ? `<span class="kn-rt">${esc(r.text)}</span>` : ''}
          ${r.extra ? '' : `<span class="kn-rs">${Budget.SPLITS[r.split] || ''}　飯塚家 ${yen(r.sh.iizuka)}／山口家 ${yen(r.sh.yamaguchi)}</span>`}
          <span class="kn-ac${r.has ? ' on' : ''}">${r.has ? `決算 ${yen(r.actual)}${r.extra ? `（${Budget.SPLITS[r.split] || ''}）` : `（予算との差 ${knDiff(r.actual - r.amount)}）`}・${r.payer ? `${T.families[r.payer].name}が立て替え` : '立て替えた家族は未入力'}` : '決算は未入力'}</span></button></li>`).join('')}</ul>
        <div class="btns kn-ga"><button type="button" class="btn quiet" data-kn="radd" data-g="${esc(g.id)}">＋ 項目を足す</button><button type="button" class="btn quiet" data-kn="gedit" data-g="${esc(g.id)}">分類を直す</button></div>
      </section>`).join('')}
      <div class="btns kn-add"><button type="button" class="btn quiet" data-kn="gadd">＋ 分類を足す</button><button type="button" class="btn quiet" data-kn="xadd">＋ 予定外の出費を足す</button></div>
      ${V.act.rows ? `<section class="sec">${secH('決算と精算', 'Settlement')}${settleHtml(V)}</section>` : ''}`;
  }
  function knEditor() {
    return `<div id="kn-status">${knStatus()}</div><div id="kn-main">${knMain(Budget.view())}</div>
      <section class="sec">${secH('この端末のトークン', 'Token')}
        <p class="small muted">トークンは、この端末の中だけに保存しています（期限は11月30日）。この端末で予算を直さなくなったら、消してください。GitHub の側でも、トークンの一覧から消せます。</p>
        <div class="btns"><button type="button" class="btn quiet" data-kn="logout">この端末のトークンを消す</button><a class="btn quiet ext" href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">GitHub のトークンの一覧</a></div>
      </section>`;
  }
  function viewKanri() {
    const has = Budget.admin.has();
    return `<div class="wrap">${topbar()}${phead('Budget admin', '予算の管理', has ? '項目を直すと、公開しているしおりの予算ファイルを書き換えます。家族全員のしおりには1〜2分で反映されます。' : 'このページは、予算を直す人の端末だけで使います。最初に1回、GitHub の「トークン」を作って、この端末に保存してください。')}
      ${has ? knEditor() : knSetup()}</div>`;
  }
  /* 予算が変わった・送信の状態が変わったときは、管理ページの中身だけ描き直す（開いている入力のシートはそのまま） */
  function knRefresh() {
    const st = $('#kn-status'), mn = $('#kn-main');
    if (st) st.innerHTML = knStatus();
    if (mn) { mn.innerHTML = knMain(Budget.view()); applyRuby(mn); }
  }
  const knFind = id => { for (const g of (Budget.data() || {}).groups || []) { const r = (g.rows || []).find(x => x.id === id); if (r) return [g, r]; } return [null, null]; };
  const knSaved = () => toast(navigator.onLine === false ? `圏外のため、この端末に保存しました（未送信 ${Budget.admin.pending().length}件）` : '保存しました。送信しています…', 2600);

  /* 項目の入力（分類・項目名・内訳・金額・分担ルール） */
  const knPart = p => `<div class="kf-part">
      <select data-pf="who" aria-label="区分">${KN_WHO.map(([v, l]) => `<option value="${v}"${(p.who || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="kf-in"><input data-pf="n" type="number" inputmode="numeric" min="0" step="1" value="${p.n ?? ''}" aria-label="人数">名</label>
      <label class="kf-in">@<input data-pf="unit" type="number" inputmode="numeric" min="0" step="1" value="${p.unit ?? ''}" aria-label="単価（円）">円</label>
      <label class="kf-in">×<input data-pf="times" type="number" inputmode="numeric" min="1" step="1" value="${p.times > 1 ? p.times : ''}" placeholder="1" aria-label="回数"></label>
      <select data-pf="per" aria-label="回数の単位">${KN_PER.map(v => `<option value="${v}"${(p.per || '') === v ? ' selected' : ''}>${v || '単位なし'}</option>`).join('')}</select>
      <button type="button" class="kf-x" data-kf="pdel" aria-label="この行を消す">×</button></div>`;
  const knDiff = n => (n > 0 ? '+' + yen(n) : n < 0 ? yen(n) : '±¥0');
  function knRowSheet(rowId, gid, extra = false) {
    const D = Budget.data(); if (!D) return;
    const [g0, r0] = rowId ? knFind(rowId) : [D.groups.find(g => g.id === gid) || D.groups[0], null];
    if (rowId && !r0) return toast('この項目は、ほかの所で消されたようです');
    const r = r0 ? JSON.parse(JSON.stringify(r0)) : extra ? { id: Budget.admin.newId('r'), name: '', memo: '', split: 'half', extra: true } : { id: Budget.admin.newId('r'), name: '', calc: { parts: [{ who: '大人', n: '', unit: '' }] }, split: 'half' };
    const ex = !!r.extra, has = r.actual !== undefined && r.actual !== null && r.actual !== '';
    const calc = r.calc || { parts: [{ who: '大人', n: '', unit: '' }] };
    const opt = (v, l, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(l)}</option>`;
    const rows = g0 ? (g0.rows || []) : [], at = rows.findIndex(x => x.id === r.id);
    sheet(r0 ? (ex ? '予定外の出費を直す' : '項目を直す') : ex ? '予定外の出費を足す' : '項目を足す', `<form class="form kn-form${ex ? ' kf-extra' : ''}" id="kn-rf" autocomplete="off">
        ${ex ? '<p class="kf-help">予定外の出費は、予算（合計・グラフ・家族ごとの内訳）には入れず、決算と精算だけに入れます。</p>' : ''}
        <label>分類<select id="kf-g">${D.groups.map(g => opt(g.id, g.name, g0 && g.id === g0.id)).join('')}${opt('__new', '＋ 新しい分類を作る', !g0)}</select></label>
        <label id="kf-gnew-l"${g0 ? ' hidden' : ''}>新しい分類の名前<input id="kf-gnew" placeholder="例：おみやげ"></label>
        <label>項目名<input id="kf-name" required value="${esc(r.name)}" placeholder="${ex ? '例：追加のたこ焼き' : '例：3日目 夕食'}"></label>
        <fieldset class="kf-mode"${ex ? ' hidden' : ''}><legend>内訳</legend>
          <label><input type="radio" name="kf-mode" value="calc"${r.calc ? ' checked' : ''}> 人数×単価で作る</label>
          <label><input type="radio" name="kf-mode" value="memo"${r.calc ? '' : ' checked'}> 自由に書く</label></fieldset>
        <div class="kf-calc"${r.calc ? '' : ' hidden'}>
          <label>前に付ける言葉（なくてもよい）<input id="kf-pre" value="${esc(calc.pre || '')}" placeholder="例：早得7・新幹線車内"></label>
          <div id="kf-parts">${(calc.parts || []).map(knPart).join('')}</div>
          <button type="button" class="btn quiet kf-padd" data-kf="padd">＋ 行を足す（例：子ども）</button>
          <label>後ろに付ける言葉（なくてもよい）<input id="kf-post" value="${esc(calc.post || '')}" placeholder="例：（子どもは無料）"></label>
          <p class="kf-help">区分を「（人数を書かない）」にすると、内訳の文に人数を書きません（例「@1,500×2日」）。金額には人数をかけます。</p>
        </div>
        <div class="kf-memo"${r.calc ? ' hidden' : ''}>
          <label>内訳（${ex ? 'メモ。なくてもよい' : '自由に'}）<input id="kf-memo" value="${esc(r.memo || '')}" placeholder="${ex ? '例：道頓堀で' : '例：朝食付・2部屋・3泊'}"></label>
          <label${ex ? ' hidden' : ''}>金額（円）<input id="kf-amt" type="number" inputmode="numeric" min="0" step="1" value="${r.calc ? '' : esc(r.amount ?? '')}"></label>
        </div>
        <div class="kf-prev" aria-live="polite"${ex ? ' hidden' : ''}><span id="kf-text"></span><b class="num" id="kf-sum"></b></div>
        <fieldset class="kf-split"><legend>分担ルール</legend>${Object.entries(Budget.SPLITS).map(([k, l]) => `<label><input type="radio" name="kf-split" value="${k}"${(r.split || 'half') === k ? ' checked' : ''}> ${l}</label>`).join('')}</fieldset>
        <p class="kf-share num" id="kf-share"></p>
        <p class="kf-help">人数で按分：内訳の「大人」の行は大人の人数（飯塚家2・山口家2）、「子ども」の行は子どもの人数（飯塚家2・山口家0）で分けます。人数を書かない行・自由に書いた内訳は、全員の人数（飯塚家4・山口家2）で分けます。</p>
        <fieldset class="kf-act"><legend>決算（払ったあとに入れる）</legend>
          <label class="kf-actual">実際に払った額（円）<input id="kf-actual" type="number" inputmode="numeric" min="0" step="1" value="${has ? esc(r.actual) : ''}" placeholder="${ex ? '例：1200' : 'まだなら空のまま'}"${ex ? ' required' : ''}></label>
          <div class="kf-payer"><span>立て替えた家族</span>${[['', 'まだ決めない'], ['iizuka', '飯塚家'], ['yamaguchi', '山口家']].map(([v, l]) => `<label><input type="radio" name="kf-payer" value="${v}"${(r.payer || '') === v ? ' checked' : ''}> ${l}</label>`).join('')}</div>
          <p class="kf-share num" id="kf-act"></p>
          <p class="kf-help">立て替えた家族：その項目のお金を、実際にまとめて払った家族。自分の家族の分だけを払った宿泊費なども、払った家族を選びます。精算は、払った額と立て替えた家族を入れた項目だけで計算します。</p>
        </fieldset>
        <button class="btn fill" type="submit">保存する</button>
        ${r0 ? `<div class="btns kf-more"><button type="button" class="btn quiet" data-kf="up"${at <= 0 ? ' disabled' : ''}>上へ</button><button type="button" class="btn quiet" data-kf="down"${at < 0 || at >= rows.length - 1 ? ' disabled' : ''}>下へ</button><button type="button" class="btn quiet kf-del" data-kf="del">この項目を消す</button></div>` : ''}
      </form>`, (el, close) => {
      const f = $('#kn-rf', el);
      const read = () => {
        const out = { id: r.id, name: $('#kf-name', el).value.trim(), split: ($('[name=kf-split]:checked', el) || {}).value || 'half' };
        if (($('[name=kf-mode]:checked', el) || {}).value === 'calc') {
          const parts = $$('.kf-part', el).map(pe => {
            const v = k => $(`[data-pf="${k}"]`, pe).value, p = { who: v('who'), n: knInt(v('n')), unit: knInt(v('unit')) }, t = knInt(v('times'));
            if (t > 1) { p.times = t; if (v('per')) p.per = v('per'); }
            return p;
          }).filter(p => p.n || p.unit);
          const pre = $('#kf-pre', el).value.trim(), post = $('#kf-post', el).value.trim();
          out.calc = { ...(pre ? { pre } : {}), parts, ...(post ? { post } : {}) };
        } else { out.memo = $('#kf-memo', el).value.trim(); if (!ex) out.amount = knInt($('#kf-amt', el).value); }
        if (ex) out.extra = true;
        const av = $('#kf-actual', el).value.trim(), pv = ($('[name=kf-payer]:checked', el) || {}).value || '';
        if (av !== '') out.actual = knInt(av);
        if (pv) out.payer = pv;
        return out;
      };
      const prev = () => {
        const x = read(), a = Budget.rowAmount(x), sh = Budget.shares(x, D.people || {});
        $('#kf-text', el).textContent = Budget.rowText(x) || '（内訳の文なし）';
        $('#kf-sum', el).textContent = yen(a);
        $('#kf-share', el).textContent = ex ? '' : `飯塚家 ${yen(sh.iizuka)}　山口家 ${yen(sh.yamaguchi)}`;
        if (x.actual === undefined) $('#kf-act', el).textContent = '';
        else { const as = Budget.actualShares(x, D.people || {}); $('#kf-act', el).textContent = `${ex ? '' : `予算との差 ${knDiff(x.actual - a)}　`}飯塚家 ${yen(as.iizuka)}　山口家 ${yen(as.yamaguchi)}`; }
      };
      f.addEventListener('input', prev); f.addEventListener('change', e => {
        if (e.target.name === 'kf-mode') { const c = e.target.value === 'calc'; $('.kf-calc', el).hidden = !c; $('.kf-memo', el).hidden = c; }
        if (e.target.id === 'kf-g') $('#kf-gnew-l', el).hidden = e.target.value !== '__new';
        prev();
      });
      f.addEventListener('click', e => {
        const b = e.target.closest('[data-kf]'); if (!b) return;
        const k = b.dataset.kf, ids = rows.map(x => x.id);
        if (k === 'padd') { $('#kf-parts', el).insertAdjacentHTML('beforeend', knPart({ who: '子ども', n: '', unit: '' })); prev(); }
        if (k === 'pdel') { b.closest('.kf-part').remove(); prev(); }
        if (k === 'up' || k === 'down') {
          const j = k === 'up' ? at - 1 : at + 1; [ids[at], ids[j]] = [ids[j], ids[at]];
          Budget.admin.queue({ t: 'rord', g: g0.id, ids }); close(); knSaved();
        }
        if (k === 'del' && confirm(`「${r.name}」を消しますか？`)) { Budget.admin.queue({ t: 'rdel', r: r.id }); close(); knSaved(); }
      });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const x = read(); if (!x.name) return $('#kf-name', el).focus();
        if (ex && x.actual === undefined) return $('#kf-actual', el).focus();
        let g = $('#kf-g', el).value, gname = '';
        if (g === '__new') {
          gname = $('#kf-gnew', el).value.trim(); if (!gname) return $('#kf-gnew', el).focus();
          g = Budget.admin.newId('g'); Budget.admin.queue({ t: 'g', g, v: { name: gname, note: '', famNote: '' } });
        } else gname = (D.groups.find(x2 => x2.id === g) || {}).name || '';
        Budget.admin.queue({ t: 'r', g, gname, v: x }); close(); knSaved();
      });
      prev();
    }, { noFocus: true });
  }
  /* 分類の入力（名前・明細の注記・家族ごとの内訳の説明・並び・削除） */
  function knGroupSheet(gid) {
    const D = Budget.data(); if (!D) return;
    const g = gid ? D.groups.find(x => x.id === gid) : null, at = g ? D.groups.indexOf(g) : -1;
    if (gid && !g) return toast('この分類は、ほかの所で消されたようです');
    sheet(g ? '分類を直す' : '分類を足す', `<form class="form kn-form" id="kn-gf" autocomplete="off">
        <label>分類の名前<input id="kg-name" required value="${esc(g ? g.name : '')}" placeholder="例：おみやげ"></label>
        <label>明細の注記（なくてもよい）<input id="kg-note" value="${esc(g ? g.note || '' : '')}" placeholder="例：子ども2名分は含めず"></label>
        <label>家族ごとの内訳の説明（なくてもよい）<input id="kg-fam" value="${esc(g ? g.famNote || '' : '')}" placeholder="例：2家族で折半"></label>
        <button class="btn fill" type="submit">保存する</button>
        ${g ? `<div class="btns kf-more"><button type="button" class="btn quiet" data-kf="up"${at <= 0 ? ' disabled' : ''}>上へ</button><button type="button" class="btn quiet" data-kf="down"${at >= D.groups.length - 1 ? ' disabled' : ''}>下へ</button><button type="button" class="btn quiet kf-del" data-kf="del">この分類を消す</button></div>` : ''}
      </form>`, (el, close) => {
      const f = $('#kn-gf', el);
      f.addEventListener('click', e => {
        const b = e.target.closest('[data-kf]'); if (!b) return;
        const k = b.dataset.kf, ids = D.groups.map(x => x.id);
        if (k === 'up' || k === 'down') { const j = k === 'up' ? at - 1 : at + 1; [ids[at], ids[j]] = [ids[j], ids[at]]; Budget.admin.queue({ t: 'gord', ids }); close(); knSaved(); }
        if (k === 'del') {
          const n = (g.rows || []).length;
          if (confirm(n ? `分類「${g.name}」と、その中の項目${n}件を消しますか？` : `分類「${g.name}」を消しますか？`)) { Budget.admin.queue({ t: 'gdel', g: g.id }); close(); knSaved(); }
        }
      });
      f.addEventListener('submit', e => {
        e.preventDefault();
        const name = $('#kg-name', el).value.trim(); if (!name) return $('#kg-name', el).focus();
        Budget.admin.queue({ t: 'g', g: g ? g.id : Budget.admin.newId('g'), v: { name, note: $('#kg-note', el).value.trim(), famNote: $('#kg-fam', el).value.trim() } });
        close(); knSaved();
      });
    }, { noFocus: true });
  }
  async function knAct(el) {
    const k = el.dataset.kn, A = Budget.admin;
    if (k === 'redit') knRowSheet(el.dataset.r);
    if (k === 'radd') knRowSheet(null, el.dataset.g);
    if (k === 'xadd') knRowSheet(null, (Budget.data().groups[0] || {}).id, true);
    if (k === 'gedit') knGroupSheet(el.dataset.g);
    if (k === 'gadd') knGroupSheet(null);
    if (k === 'send') A.flush();
    if (k === 'reload') { await A.refresh(); toast('公開側の最新を読み直しました'); }
    if (k === 'logout') {
      const n = A.pending().length;
      if (confirm(n ? `未送信の変更が${n}件あります。トークンを消すと、送れなくなります（変更は端末に残ります）。消しますか？` : 'この端末のトークンを消しますか？')) { A.clearToken(); render(); toast('この端末のトークンを消しました'); }
    }
  }
  async function knSaveToken(form) {
    const inp = $('#kn-tok-in', form), msg = $('#kn-tok-msg', form), btn = $('button[type=submit]', form), t = inp.value.trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { msg.textContent = '「github_pat_」で始まるトークンを、全部貼り付けてください。'; return; }
    btn.disabled = true; msg.textContent = '確かめています…';
    try { await Budget.admin.setToken(t); inp.value = ''; toast('保存しました'); render(); scrollTo(0, 0); }
    catch (e) { msg.textContent = e.kind === 'auth' ? 'このトークンは使えません。貼り付けた文字が全部そろっているか、期限が切れていないかを確かめてください。' : e.kind === 'net' ? '通信できませんでした。電波の良い所で、もう一度押してください。' : `確かめられませんでした（${e.message}）。`; }
    finally { btn.disabled = false; }
  }

  /* ========== トリビア（#/trivia、#/trivia/分類、#/trivia/d1〜d4 はその日の分類を開く） ==========
     のりもの・おでかけにあるトリビアと、このページで加えたものを、分類ごとにまとめる（T.triviaCats）。
     最初は、今日の行程に関係する分類だけを開く。旅行前と旅行のあとは、すべて閉じて分類名と件数だけを見せる。
     どの項目にも出典（公式サイト・自治体・博物館・鉄道会社など）のリンクを付ける。リンクの無いものは載せない */
  const TV_SPOT = { rail: [], kyushu: [], nara: ['sakurai1', 'sakurai2', 'nara1', 'nara2'], osaka: ['osaka'], line: [] };
  function triviaItems(cat) {
    const src = T.triviaSrc || {}, out = [];
    if (cat === 'rail') {
      T.railTrivia.forEach((g, gi) => g.items.forEach(([q, a], j) => out.push({ id: `rail-${gi}-${j}`, k: `${g.train}（${g.model}）`, q, a })));
      ((window.LINE && LINE.passing && LINE.passing.items) || []).forEach(([q, a], j) => out.push({ id: `pass-${j}`, k: 'すれ違い', q, a }));
    }
    (TV_SPOT[cat] || []).forEach(key => T.trivia[key].cards.forEach(([k, q, a], j) => out.push({ id: `${key}-${j}`, k, q, a })));
    ((T.triviaMore || {})[cat] || []).forEach(([k, q, a, sr], j) => out.push({ id: `${cat}-m${j}`, k, q, a, src: sr }));
    return out.map(x => ({ ...x, src: x.src || src[x.id] || null })).filter(x => x.src && x.src.some(([, u]) => u));
  }
  const triviaDays = n => (T.triviaCats || []).filter(c => c.days.includes(n)).map(c => c.id);
  /* 今日のトリビア（トップ）・この日のトリビア（行程表）：1件だけ題を出し、押すとトリビアのページのその項目へ。
     旅行中はその日の行程に関係する分類から、旅行前はすべての分類から、日付で日替わりに選ぶ（同じ日なら同じ1件） */
  function tvPick(n, t = now()) {
    const cats = n ? triviaDays(n) : (T.triviaCats || []).map(c => c.id);
    const pool = cats.flatMap(c => triviaItems(c).map(x => ({ ...x, cat: c })));
    if (!pool.length) return null;
    const dayNo = Math.floor((+t + 9 * 36e5) / 864e5);
    return pool[(dayNo * 7 + (n || 0) * 3) % pool.length];
  }
  const tvLine = (x, k, all = '') => x ? `<div class="tv-today"><button type="button" class="tv-today-b" data-go="#/trivia/${x.cat}" data-mark="#tv-${x.id}"><span class="tv-today-k">${ic('book')}${k}</span><span class="tv-today-q">${esc(x.q)}</span><i class="dc-arr" aria-hidden="true">›</i></button>${all ? `<a class="tv-today-all" href="${all}">ほかのトリビアも</a>` : ''}</div>` : '';
  function viewTrivia(sub) {
    const day = phase() === 'during' ? todayDay() : null;
    const want = sub && /^d\d$/.test(sub) ? triviaDays(+sub.slice(1)) : sub ? [sub] : [];
    const srcHtml = sr => `<p class="tv-src">出典：${sr.filter(([, u]) => u).map(([l, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join('／')}</p>`;
    return `<div class="wrap">${topbar()}${phead('Trivia', 'トリビア', '行き先の町と、乗る列車にまつわる話を、分類ごとにまとめました。分類の名前を押すと開きます。')}
      ${day ? `<p class="tv-lead">${day.n}日目（${day.label}）の行程に関係する分類を開いています。</p>` : ''}
      <div class="tv-list">${(T.triviaCats || []).map(c => {
        const items = triviaItems(c.id), open = want.includes(c.id) || (!want.length && day && c.days.includes(day.n));
        return `<details class="tv-g" id="tv-cat-${c.id}"${open ? ' open' : ''}><summary class="tv-h"><span><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></span><em class="num">${items.length}件</em></summary>
          <div class="tv-items">${items.map(x => `<article class="tv" id="tv-${x.id}"><p class="tv-k">${esc(x.k)}</p><h3>${esc(x.q)}</h3><p class="tv-a">${esc(x.a)}</p>${srcHtml(x.src)}</article>`).join('')}</div></details>`;
      }).join('')}</div>
      <p class="note">出典は、公式サイト・自治体・博物館・鉄道会社などのページです（2026年9月に確認）。数字や年は、その時点のものです。</p></div>`;
  }

  /* 服装のイラスト（旅のワンポイント）：手描き風のやさしい線画。和紙色・朱・藍で、人物は描かず、何を着る・持つかがひと目で分かる形に。
     インラインSVGなので電波がなくても出る。色は CSS（.wear-art）の変数から取るので、暗い画面でもなじむ */
  const WEAR_ART = (() => {
    const L = 'class="l"', F1 = 'class="l f1"', F2 = 'class="l f2"', A = 'class="l fa"';
    const shirt = (dx, cls) => `<g transform="translate(${dx} 0)"><path ${cls} d="M24 14.5 13.6 18c-3.2 1.2-4.6 3-5.1 6.2L3.8 55.2l7.6 1.6 5.4-26.6.6 32.7c9.6 1.8 20.4 1.8 30 0l.6-32.7 5.4 26.6 7.6-1.6-4.7-30.8c-.5-3.2-1.9-5-5.1-6.2L41 14.5c-2.4 3.6-14.6 3.6-17 0z"/><path ${L} d="M24 14.5c2.8 2.6 14.2 2.6 17 0M4.3 51.8l7.6 1.6M53.4 53.4l7.6-1.6"/></g>`;
    return {
      /* 日中：長袖のシャツ＋薄手の羽織りもの（前開き）。お日さま */
      '日中': `${shirt(0, F1)}
        <g transform="translate(55.5 0)"><path ${F2} d="M23 14.2 12.8 17.8c-3.2 1.2-4.6 3-5.1 6.2L3 55l7.6 1.6 5.4-26.6.6 32.9 13.6.2-.2-33.6L23 14.2zM42 14.2l10.2 3.6c3.2 1.2 4.6 3 5.1 6.2l4.7 30.8-7.6 1.6-5.4-26.6-.6 32.9-13.6.2.2-33.6L42 14.2z"/><path ${L} d="M23 14.2c4-1.6 15-1.6 19 0M17.4 40h9M38.6 40h9"/></g>
        <g ${L}><circle class="l fa" cx="61" cy="8" r="3.6"/><path d="M61 1.2v1.6M66.6 3.4l-1.1 1.1M55.4 3.4l1.1 1.1M68.4 8h-1.6M53.6 8h1.6"/></g>`,
      /* 朝晩：前を留めるカーディガン（Vネック・ボタン）。月と星 */
      '朝晩': `<g transform="translate(22 0)"><path ${F2} d="M24 14 13.6 17.6c-3.2 1.2-4.6 3-5.1 6.2L3.8 55.4l7.6 1.6 5.4-26.8.6 32.8c9.6 1.8 20.4 1.8 30 0l.6-32.8 5.4 26.8 7.6-1.6-4.7-31.6c-.5-3.2-1.9-5-5.1-6.2L41 14l-8.5 19.5L24 14z"/><path ${L} d="M32.5 33.5v29.6M4.4 52l7.6 1.6M53.2 53.6l7.6-1.6M19.5 52.5h8M37.5 52.5h8"/><g class="fa"><circle cx="32.5" cy="39" r="1.5"/><circle cx="32.5" cy="46" r="1.5"/><circle cx="32.5" cy="53" r="1.5"/></g></g>
        <path ${A} d="M98 9.5a9 9 0 1 0 9.6 12.4A7.4 7.4 0 0 1 98 9.5z"/><path ${L} d="M110 6.5v4M108 8.5h4M92 26v3M90.5 27.5h3"/>`,
      /* 新幹線・車の中：座席に置いた上着を、膝掛けがわりに。冷房の風 */
      '新幹線・車の中': `<path ${F1} d="M16 10.5c-3.4 0-5.4 2.4-5 5.8l4.4 34.2c.4 3 2.4 4.6 5.4 4.6h8.6"/><path ${F1} d="M22.4 47.5h36c3.6 0 5.8 2.2 5.8 5.4v2.8c0 1.6-1.2 2.8-2.8 2.8H22.4c-3.2 0-5.2-1.8-5.2-4.8v-1c0-3 2-5.2 5.2-5.2z"/><path ${L} d="M26 58.5 22.5 70M58 58.5l3.5 11.5M18 70h48"/>
        <path ${F2} d="M31 40.6c7.5-3.2 20.5-3.6 30.6-.6l4.6 16.4c-10.4 3.4-24.6 3.2-33.6.2z"/><path ${L} d="M34 45c8-2.2 18.8-2.4 27.6-.2M47 43.2l1.8 14.4"/>
        <g ${L}><path d="M80 12c3-2.4 6-2.4 9 0s6 2.4 9 0 6-2.4 9 0M80 20c3-2.4 6-2.4 9 0s6 2.4 9 0 6-2.4 9 0M80 28c3-2.4 6-2.4 9 0s6 2.4 9 0"/></g><g class="l" style="stroke:var(--ai)"><path d="M100 36v14M94 39.5l12 7M94 46.5l12-7M100 36l-2 2M100 36l2 2M100 50l-2-2M100 50l2-2"/></g>`,
      /* 足もと：履き慣れたスニーカー（手前と奥の2足） */
      '足もと': `<g transform="translate(46 -6)" opacity=".75"><path ${F2} d="M10 50c0-7 3.6-11 9.4-12.4l8.4-7.4c2.6-2.2 5.6-2 7.8.4l6.4 7c9.4 1 17.8 4.6 18 11v4.6c0 2.4-1.6 3.8-4 3.8H14c-2.6 0-4-1.6-4-4z"/><path ${L} d="M10.4 52.4h49.6"/></g>
        <path ${F1} d="M8 52c0-7.4 3.8-11.4 9.8-12.8l8.8-7.8c2.8-2.4 6-2.2 8.2.4l6.8 7.4c10 1 18.8 4.8 19 11.6v4.8c0 2.6-1.8 4-4.2 4H12.2C9.4 59.6 8 58 8 55.4z"/><path ${L} d="M8.4 54.8h52.2M29.2 35.6l4 3.2M26.4 38.4l4 3.2M23.6 41.2l4 3.2"/><path class="l" style="stroke:var(--shu)" d="M40 46.2c5 2 10.4 2.6 16.6 2.2"/>`,
      /* 雨の日：折りたたみ傘（たたんだ形と、開いた形） */
      '雨の日': `<g transform="rotate(-38 30 44)"><path ${F2} d="M16 40.4h28.4c2.4 0 3.6 1.6 3.6 3.6s-1.2 3.6-3.6 3.6H16z"/><path ${L} d="M16 40.4l-3.2 3.6 3.2 3.6M48 44h7.4M24 40.4l-1.4 7.2M33 40.4l-1.4 7.2"/><path ${L} d="M55.4 44c2.6 0 4 1.4 4 3.4"/></g>
        <path ${F1} d="M66 36c3-13 12-21 24.5-21S112 23 115 36c-2.6-2.4-5.4-2.4-8.2 0-2.6-2.4-5.6-2.4-8.2 0-2.6-2.4-5.6-2.4-8.2 0-2.6-2.4-5.6-2.4-8.2 0-2.6-2.4-5.6-2.4-8.2 0-2.6-2.4-5.6-2.4-8.2 0z"/><path ${L} d="M90.5 15v-4M90.5 36v22c0 3-1.8 4.6-4 4.6s-3.6-1.6-3.6-3.6M82.2 36c1.4-9 4.2-16 8.3-21M98.8 36c-1.4-9-4.2-16-8.3-21"/>
        <g class="l" style="stroke:var(--ai)"><path d="M66 50.5l-1.6 3.6M74 58l-1.6 3.6M108 48l-1.6 3.6M113 58l-1.6 3.6M58 8l-1.6 3.6"/></g>`
    };
  })();
  /* ========== 旅のワンポイント（#/tips、#/tips/d1〜d4 はその日の所へ） ==========
     気温（気象庁の平年値。10月中旬の値と出典リンク）・服装・行程に沿ったコツ。事実を書くものには公式の出典を付ける。電波がなくても見られる（出典のリンクだけは電波が要る） */
  function viewTips() {
    const P = T.tips, byDay = n => P.items.filter(x => x.day.includes(n));
    const tipCard = x => `<article class="tp" id="tip-${x.id}"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>
      ${x.go || x.src ? `<div class="tp-links">${(x.go || []).map(([l, h]) => `<a class="more" href="${h}">${esc(l)}</a>`).join('')}${(x.src || []).map(([l, u]) => `<a class="tp-src ext" href="${u}" target="_blank" rel="noopener">出典：${esc(l)}</a>`).join('')}</div>` : ''}</article>`;
    const deg = v => v != null ? `${v.toFixed(1)}<small>℃</small>` : '—';
    const temps = `<table class="tp-tt"><caption>${esc(P.tempsWhen || '')}の平年値</caption><thead><tr><th scope="col">地点</th><th scope="col" class="hi">最高</th><th scope="col" class="lo">最低</th></tr></thead><tbody>${P.temps.map(t => `<tr><th scope="row"><b>${esc(t.name)}</b><small>${esc(t.when)}</small></th><td class="hi num">${deg(t.hi)}</td><td class="lo num">${deg(t.lo)}</td></tr>`).join('')}</tbody></table>
      <p class="tp-tsrc">出典：気象庁 平年値（旬ごとの値）　${P.temps.map(t => `<a class="ext" href="${t.url}" target="_blank" rel="noopener">${esc(t.name.replace(/（.*/, ''))}</a>`).join('・')}</p>`;
    return `<div class="wrap">${topbar()}${phead('Travel tips', '旅のワンポイント', '10/17〜10/20の行程に合わせた、気温・服装と、知っておくと助かることをまとめました。')}
      <nav class="tp-days" aria-label="日ごとのワンポイント">${T.days.map(d => `<a href="#/tips/d${d.n}" style="--c:${DAYC(d.n)}">${d.n}日目<b>${d.label}</b></a>`).join('')}</nav>
      <section class="sec" id="tp-temp">${secH('例年の気温', 'Temperature')}
        <p class="sec-lead">旅の日程（10/17〜10/20）は、どの日も10月中旬。行程で長くいる地点の、気象庁の平年値（旬ごとの日最高・日最低気温）です。</p>
        ${temps}
        <p class="note">例年の値で、当日の予報ではありません。当日の天気は、出発の2週間前（10/2ごろ）からトップの「旅先のお天気」に出ます。${P.forecast.map(([l, u]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join('　')}</p></section>
      <section class="sec" id="tp-wear">${secH('服装', 'What to wear')}
        ${infoList(P.wear.map(([k, v]) => [k, `${esc(v)}${WEAR_ART[k] ? `<svg class="wear-art" viewBox="0 0 120 72" aria-hidden="true" focusable="false">${WEAR_ART[k]}</svg>` : ''}`]))}</section>
      <section class="sec">${secH('旅のワンポイント', 'Tips')}
        ${T.days.map(d => { const l = byDay(d.n); return l.length ? `<h3 class="sub tp-dh" id="d${d.n}" style="--c:${DAYC(d.n)}">${d.n}日目　${d.label}（${d.dow}）<small>${esc(d.theme)}</small></h3>${l.map(x => tipCard(x)).join('')}` : ''; }).join('')}
        <p class="note">同じワンポイントが2つの日に関係するときは、両方の日に載せています。時刻と料金は、確かめた時点のものです。現地の案内を優先してください。</p></section></div>`;
  }

  /* ========== 持ち物 ========== */
  function viewBag() {
    const done = store.get('bag', {}), extra = store.get('bagExtra', []);
    const all = T.bag.flatMap(g => g.items.map(i => i[0])).concat(extra);
    const cnt = all.filter(n => done[n]).length;
    const li = ([n, why], custom) => `<li class="${done[n] ? 'done' : ''}"><input type="checkbox" id="b-${esc(n)}" data-bag="${esc(n)}" ${done[n] ? 'checked' : ''}><label for="b-${esc(n)}">${esc(n)}${why ? `<span>${esc(why)}</span>` : ''}</label>${custom ? `<button class="del" data-bagdel="${esc(n)}" aria-label="${esc(n)}を消す">×</button>` : '<span></span>'}</li>`;
    return `<div class="wrap">${topbar()}${phead('Packing', '持ち物チェック', 'しおりの内容から、この旅で必要になるものを選びました。チェックはこの端末に残ります。')}
      <div class="progress-line"><i style="width:${all.length ? cnt / all.length * 100 : 0}%"></i></div><p class="small muted num">${cnt} / ${all.length} 準備できた</p>
      ${T.bag.map(g => `<section class="sec" style="margin-top:28px">${secH(g.cat)}<ul class="check">${g.items.map(i => li(i)).join('')}</ul></section>`).join('')}
      <section class="sec" style="margin-top:28px">${secH('じぶんで追加')}<ul class="check">${extra.map(n => li([n, ''], 1)).join('')}</ul>
        <form class="addrow" id="bagform"><input id="bag-new" placeholder="例：カメラ" aria-label="追加する持ち物"><button class="btn" type="submit">追加</button></form></section></div>`;
  }

  /* ========== 思い出メモ ========== */
  function viewMemo() {
    const memo = store.get('memo', {});
    return `<div class="wrap">${topbar()}${phead('Journal', '思い出メモ', 'その日にあったこと、おいしかったもの、子どもの一言。書いた内容はこの端末に残ります。')}
      ${T.days.map(d => `<section class="sec" style="margin-top:28px;--c:${DAYC(d.n)}">${secH(`${d.n}日目　${d.label}（${d.dow}）`, d.theme)}<textarea id="memo-${d.n}" data-memo="${d.n}" aria-label="${d.n}日目のメモ" placeholder="きょうのできごと">${esc(memo[d.n] || '')}</textarea></section>`).join('')}
      <section class="sec">${secH('スタンプ帳', 'Stamps')}${stampsBlock()}</section></div>`;
  }

  /* ========== ルーター ========== */
  /* 画面の下のタブバー：きょう／日程／のりもの／まっぷ／その他。どのページも、どれか1つのタブに属する */
  const NAV = [['today', 'きょう', 'today'], ['trip', '日程', 'route'], ['ride', 'のりもの', 'train'], ['map', 'まっぷ', 'map'], ['more', 'その他', 'more']];
  const tabOf = (r, sub) => r === 'home' ? 'today' : r === 'trip' ? 'trip' : r === 'ride' || (r === 'stay' && sub === 'car') ? 'ride'
    : r === 'map' || r === 'spot' && sub !== 'stamps' || r === 'food' || (r === 'sos' && sub === 'parking') ? 'map' : 'more';
  const navHref = k => ({ today: '#/', trip: '#/trip/' + todayN(), ride: '#/ride', map: '#/map' })[k];
  function drawNav(route, sub) {
    const on = tabOf(route, sub);
    $('#nav').innerHTML = `<ul>${NAV.map(([k, l, i]) => {
      const a = k === on ? ` class="on" aria-current="page"` : '';
      const dot = k === 'today' && latestUnseen().length;
      return `<li>${k === 'more' ? `<button type="button" data-tab="more" data-act="more" aria-haspopup="dialog"${k === on ? ' class="on"' : ''}>${ic(i)}<span>${l}</span></button>` : `<a href="${navHref(k)}" data-tab="${k}"${a}${dot ? ' aria-label="きょう（新しい情報があります）"' : ''}>${ic(i)}${dot ? '<i class="nav-dot" aria-hidden="true"></i>' : ''}<span>${l}</span></a>`}</li>`;
    }).join('')}</ul>`;
  }
  /* 時計が進んだときの画面の更新（本物は15秒ごと、おためし中は1秒ごと） */
  let liveKey = null;
  function liveState0() {
    const r = location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
    const ph = phase();
    const sh = JSON.stringify(getShift());
    if (r === 'trip') {
      const t = now(); const n = +location.hash.split('/')[2] || todayN(); const d = T.days.find(x => x.n === n) || T.days[0]; const ev = events(d); const e = ev.find(x => x.start <= t && t < x.end);
      const nd = ymd(t) === d.date ? (nudge() || {}).id : '';
      return `${ph}|trip|${e ? e.i : ''}|${ev.filter(x => x.end < t).length}|${sh}|${nd}|${ymd(t)}`;
    }
    /* きょう・のりもの・まっぷ：乗車中カードの出し入れと、日付が変わったときに描き直す */
    return ph + '|' + r + '|' + liveNowKey() + '|' + ymd(now()) + '|' + sh;
  }
  function refreshLive() {
    simBar();
    const r = location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
    const k = liveState0();
    if (k !== liveKey) { const y = scrollY; render(); if (r !== 'trip') scrollTo(0, y); return; }
    if (r === 'home') {
      if (phase() === 'before') tickCountdown();
      else if (!memOn()) { const b = $('#today-top'); if (b) { const html = todayTop(); if (b.dataset.h !== html) { b.innerHTML = html; b.dataset.h = html; applyRuby(b); } } }
    }
    geoAsk();   // 「いまの予定」の札を描き直したあとに（札の中に置くため）
    if ($('#line')) updateLive();
    /* のりもの・まっぷの略図の列車の印を進める */
    $$('svg[data-rmini]').forEach(el => { if (liveState(el.dataset.rmini).pos.toFixed(3) !== el.dataset.p) el.outerHTML = routeMini(el.dataset.rmini); });
    liveHooks.forEach(fn => fn());
  }
  setInterval(() => { const st = Clock.state(); if (!st) refreshLive(); }, 15e3);
  Clock.on(kind => {
    if (kind === 'stop' || kind === 'start') shiftMem = null;
    if (kind === 'stop') session.set('simRain', null);
    if (kind === 'tick') return refreshLive();
    if (kind === 'pos') return;
    simBar();
    if (kind === 'play' || kind === 'pause' || kind === 'speed') return;
    render(); liveHooks.forEach(fn => fn());
  });

  /* ========== 戻ったときの位置 ==========
     ページごとのスクロール位置を、履歴の1件ずつ（history.state の k）にひもづけて、この端末の中だけに覚える。
     端末の戻る操作でもしおりの「‹ 戻る」でも、前に見ていた位置へ戻す。下のタブや目次から新しく開いたときは、今までどおり上から。
     n は、しおりの中で何回ページを移ったか（0なら、しおりの外や共有リンクから直接開いた）。 */
  if ('scrollRestoration' in history) { try { history.scrollRestoration = 'manual'; } catch { /* noop */ } }
  let scrollMem = (() => { try { const v = JSON.parse(session.get('scrollMem') || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
  let curN = null, scrollHold = false, holdTimer = 0, restoreJob = null;
  const saveScrollMem = () => { const ks = Object.keys(scrollMem); if (ks.length > 80) ks.slice(0, ks.length - 80).forEach(k => delete scrollMem[k]); session.set('scrollMem', JSON.stringify(scrollMem)); };
  let saveTimer = 0;
  const holdScroll = ms => { scrollHold = true; clearTimeout(holdTimer); holdTimer = setTimeout(() => { scrollHold = false; }, ms); };
  const userMoved = () => { scrollHold = false; clearTimeout(holdTimer); restoreJob = null; };
  ['touchstart', 'wheel', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, userMoved, { passive: true }));
  addEventListener('scroll', () => {
    const k = history.state && history.state.k;
    if (!k || scrollHold) return;
    scrollMem[k] = Math.round(scrollY); clearTimeout(saveTimer); saveTimer = setTimeout(saveScrollMem, 200);
  }, { passive: true });
  addEventListener('pagehide', () => { clearTimeout(saveTimer); saveScrollMem(); });
  /* 履歴の1件に、見分けの印を付ける。戻る操作で来たとき（すでに印がある）は、前の位置を返す */
  function entryScroll() {
    const st = history.state;
    if (st && st.k) { curN = st.n || 0; return { back: true, y: scrollMem[st.k] }; }
    const k = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    curN = curN === null ? 0 : curN + 1;
    try { history.replaceState({ k, n: curN }, ''); } catch { /* noop */ }
    return { back: false };
  }
  /* 描いたあと、位置を戻す。中身が後から読み込まれて高さが変わっても、数回だけやり直す */
  function restoreScroll(y) {
    const job = restoreJob = { y, last: null };
    holdScroll(3500);
    const go = () => {
      if (restoreJob !== job) return;
      if (job.last !== null && Math.abs(scrollY - job.last) > 2) return userMoved();     // 自分で動かしたら、ここまで
      if (Math.abs(scrollY - y) > 2) scrollTo({ top: y, behavior: 'instant' });
      job.last = scrollY;
    };
    go(); requestAnimationFrame(go); [80, 250, 600, 1200, 2400].forEach(ms => setTimeout(go, ms));
    window.__restoreScrollAgain = go;     // 天気など、あとから高さが変わる所が読み込み終わったとき
  }
  /* しおりの中で奥のページ（下のタブのページではないところ）では、左上に「‹ 戻る」を出す */
  const isDeep = (route, sub) => !(route === 'home' || route === 'trip' || (route === 'map' && sub !== 'outing') || (route === 'ride' && !sub));
  function backTarget(route, sub) { return route === 'kanri' ? '#/money' : navHref(tabOf(route, sub)) || '#/'; }
  function goBack(route, sub) {
    const st = history.state;
    if (st && st.n > 0) history.back(); else location.hash = backTarget(route, sub);
  }

  let lastHash = null;
  function render() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'home';
    /* 同じページの描き直し（時計の操作など）か、新しく開いたか */
    const fresh = lastHash !== location.hash; lastHash = location.hash;
    const isLive = route === 'ride' && parts[1] === 'live', y0 = scrollY;
    const ent = fresh ? entryScroll() : { back: false };
    /* 戻る操作で来たときだけ、前の位置へ（のりもの「いまどのへん？」は、今までどおり） */
    const restoreY = ent.back && !isLive && Number.isFinite(ent.y) && ent.y > 0 ? ent.y : null;
    if (fresh) { restoreJob = null; holdScroll(700); }
    liveKey = null;
    window.LiveMap && window.LiveMap.unmount();
    const views = {
      home: viewHome, trip: () => viewTrip(+parts[1] || todayN()), ride: () => viewRide(parts[1], parts[2], parts[3]), food: () => viewFood(parts[1]),
      spot: () => viewSpots(parts[1]), stay: viewStay, sos: viewSos, money: viewMoney, bag: viewBag, memo: viewMemo, map: () => (parts[1] === 'outing' ? viewOuting() : viewMap()), help: () => viewHelp(parts[1]), tips: viewTips, trivia: () => viewTrivia(parts[1]), kanri: viewKanri
    };
    if (dmMap) { try { dmMap.remove(); } catch { /* noop */ } dmMap = null; }
    if (omCleanup) { omCleanup(); omCleanup = null; }
    app.innerHTML = (views[route] || viewHome)();
    applyRuby(app);
    if (views[route] && isDeep(route, parts[1])) { const tb = $('.topbar', app); if (tb) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tback'; b.dataset.back = route + '/' + (parts[1] || ''); b.textContent = '‹ 戻る'; tb.prepend(b); } }
    document.body.classList.toggle('lm-full-on', isLive && parts[3] === 'full' && !!$('#lm.lm-full'));
    drawNav(views[route] ? route : 'home', parts[1]);
    simBar();
    geoAsk();
    document.title = { home: '旅のしおり｜奈良・大阪 2026', map: 'まっぷ｜旅のしおり', trip: '旅程｜旅のしおり', ride: 'のりもの｜旅のしおり', food: 'ごはん｜旅のしおり', spot: 'おでかけ｜旅のしおり', stay: 'やど・くるま｜旅のしおり', sos: 'もしも｜旅のしおり', money: '予算｜旅のしおり', kanri: '予算の管理｜旅のしおり', help: '使い方｜旅のしおり', tips: '旅のワンポイント｜旅のしおり', trivia: 'トリビア｜旅のしおり', bag: '持ち物｜旅のしおり', memo: '思い出メモ｜旅のしおり' }[route] || '旅のしおり｜奈良・大阪 2026';
    if (route === 'map' && parts[1] === 'outing') document.title = 'おでかけマップ｜旅のしおり';
    CoverTrain.mount(route === 'home' || !views[route] ? $('.cover:not(.slim):not(.mem)') : null);
    if (route === 'home') loadWeather($('#weather'));
    if (route === 'trip') loadRain(T.days.find(d => d.n === (+parts[1] || todayN())) || T.days[0]);
    if (route === 'map') parts[1] === 'outing' ? mountOutingMap() : mountDriveMap();
    if (route === 'help') drawMarks();
    if ((route === 'money' || route === 'kanri') && fresh) Budget.load();
    if (route === 'kanri' && fresh && Budget.admin.has()) Budget.admin.refresh();
    if (route === 'ride' && parts[1] === 'live') {
      requestAnimationFrame(updateLive);
      if (!fresh) scrollTo(0, y0);
      if (window.LiveMap && $('#lm')) window.LiveMap.mount(T.liveLine[parts[2]] ? parts[2] : 'nozomi28', { esc, fmtHM, sheet, toast, gmap, ext, geoHelp, full: parts[3] === 'full', fresh });
    }
    liveKey = liveState0();
    // スクロール位置
    const anchor = parts[1] && document.getElementById(parts[1]);
    if (restoreY !== null) restoreScroll(restoreY);
    else if (route === 'trivia' && parts[1] && !/^d\d$/.test(parts[1])) { const g = $('#tv-cat-' + parts[1]); g && setTimeout(() => g.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); }
    else if (route === 'trip') { const n = $('.tl li.now'); n ? setTimeout(() => n.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200) : window.scrollTo(0, 0); }
    else if (anchor && route !== 'spot') { setTimeout(() => { anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }); const d = $('details', anchor); d && (d.open = true); }, 120); }
    else if (route === 'spot' && parts[1] === 'stamps') setTimeout(() => $('#stamps').scrollIntoView({ behavior: 'smooth' }), 120);
    else if (!(isLive && !fresh)) window.scrollTo(0, 0);
    Onboard.start();
  }

  /* ========== はじめの案内 ==========
     次の順に1つずつ出し、同時には出さない：①ホーム画面の案内 → （家族を選ぶ）→ ②画面の案内 → ③いまどのへん？の案内（livemap.js が Onboard.whenDone() を待つ） */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function appGuide(force) {
    if (!window.Guide) return Promise.resolve(false);
    const t = k => `#nav [data-tab="${k}"]`;
    return Guide.run('app', [
      { el: t('today'), title: 'きょう', text: 'しおりを開いたら、まずここ。日付と時刻から、次の列車や次の予定をいちばん上に出します。新幹線に乗る前後は「いまどのへん？」もここに出ます。' },
      { el: t('trip'), title: '日程', text: '4日間の予定を、時刻の順に見られます。いまの予定には「いま」の印が付きます。' },
      { el: t('ride'), title: 'のりもの', text: '指定席券と座席表、駅の時刻表など。新幹線の中では「いまどのへん？」で、走っている場所と窓から見えるものが分かります。' },
      { el: t('map'), title: 'まっぷ', text: '行く場所・お店・駐車場を、日ごとにまとめています。「地図」を押すと、地図のアプリで開きます。' },
      { el: t('more'), title: 'その他', text: '持ち物・予算・ホテル・もしものときの連絡先と、文字の大きさなどの設定です。旅行中の画面を先に試せる「おためしモード」もここにあります。' },
      { el: t('more'), title: '使い方の説明書もあります', text: '「その他」の「使い方」に、機能ごとの説明を写真つきでまとめています。この案内も、そこから見直せます。', link: { label: '使い方を開く', go: () => { location.hash = '#/help'; } } }
    ], { force });
  }
  /* ========== お知らせ（中身は assets/news.js） ==========
     トップ右上のベルに未読の件数。押すと一覧（新しい順・未読は色を変える）→ 詳しい説明 →「その場所を見る」で移動して短く光らせる。
     既読はこの端末に覚える（覚えられないときは、毎回未読でもよい） */
  const newsId = n => n.id || `${n.date} ${n.title}`;
  const newsAll = () => (Array.isArray(window.NEWS) ? window.NEWS : []).filter(n => n && n.date && n.title).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const newsRead = () => { const r = store.get('newsRead', []); return Array.isArray(r) ? r : []; };
  // 公開前のお知らせ（date <= NEWS_BASE）は、端末に関わらず最初から既読として扱う
  const isRead = (n, r) => (window.NEWS_BASE && n.date <= window.NEWS_BASE) || r.includes(newsId(n));
  const newsUnread = () => { const r = newsRead(); return newsAll().filter(n => !isRead(n, r)).length; };
  const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
  function bellBtn() {
    const u = newsUnread();
    return `<button class="bell" data-act="news" aria-label="お知らせ${u ? `（未読${u}件）` : ''}">${BELL}${u ? `<b class="bell-n num" aria-hidden="true">${u > 9 ? '9+' : u}</b>` : ''}</button>`;
  }
  const syncBell = () => $$('.bell').forEach(b => { b.outerHTML = bellBtn(); });
  const fmtNewsDate = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
  function newsSheet(openId) {
    sheet('お知らせ', '<div class="nw" id="nw"></div>', (el, close) => {
      const box = $('#nw', el);
      const list = () => {
        const all = newsAll(), r = newsRead();
        box.innerHTML = all.length ? `<ul class="nw-list">${all.map(n => `<li><button class="nw-row${isRead(n, r) ? '' : ' unread'}" data-nid="${esc(newsId(n))}"><span class="nw-d num">${fmtNewsDate(n.date)}</span><span class="nw-t">${esc(n.title)}</span>${r.includes(newsId(n)) ? '' : '<span class="nw-new">未読</span>'}<span class="go" aria-hidden="true">›</span></button></li>`).join('')}</ul>`
          : '<p class="nw-empty">お知らせはまだありません。<br><span class="small muted">しおりを直したときは、ここでお知らせします。</span></p>';
      };
      const detail = id => {
        const n = newsAll().find(x => newsId(x) === id); if (!n) return list();
        const r = newsRead(); if (!r.includes(id)) { store.set('newsRead', r.concat(id)); syncBell(); }
        box.innerHTML = `<button class="nw-back" data-nw="back">‹ お知らせの一覧</button>
          <p class="nw-date num">${n.date.replace(/-/g, '.')}</p><h4 class="nw-h">${esc(n.title)}</h4>
          ${n.text ? `<p class="nw-text">${esc(n.text).replace(/\n/g, '<br>')}</p>` : ''}
          ${n.go ? '<div class="btns"><button class="btn fill" data-nw="go">その場所を見る</button></div>' : ''}`;
        box.dataset.cur = id;
      };
      box.addEventListener('click', e => {
        const row = e.target.closest('[data-nid]'); if (row) { detail(row.dataset.nid); return; }
        const b = e.target.closest('[data-nw]'); if (!b) return;
        if (b.dataset.nw === 'back') list();
        if (b.dataset.nw === 'go') { const n = newsAll().find(x => newsId(x) === box.dataset.cur); close(); n && newsGo(n); }
      });
      openId ? detail(openId) : list();
    });
  }
  /* 移動して、変わった所・探した所を短く光らせる（視差効果を減らす設定では、光らせずに枠だけを少し出す） */
  function goFlash(go, mark) {
    if (!go) return;
    if (/^transfer\.html/.test(go)) { session.set('xferFrom', location.hash || '#/'); location.href = go; return; }
    const flash = () => {
      let el = mark && $(mark); if (!el) return;
      if (el.matches('input')) el = el.closest('li') || el;
      const d = el.closest('details'); if (d) d.open = true;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      el.classList.remove('nw-flash'); void el.offsetWidth; el.classList.add('nw-flash');
      setTimeout(() => el.classList.remove('nw-flash'), 2400);
    };
    if (location.hash === go || (!location.hash && go === '#/')) flash();
    else { location.hash = go; setTimeout(flash, /^#\/ride\/live/.test(go) ? 1300 : 550); }
  }
  const newsGo = n => goFlash(n.go, n.mark);

  /* ========== しおり内の検索（目次のいちばん上） ==========
     しおりの中身（行程・スポット・ごはん・駅・時刻表の駅名・トリビア・使い方・持ち物・緊急連絡先など）を、端末の中だけで探す（電波がなくても使える）。
     ひらがなでも見つかるように、カタカナはひらがなにそろえ、読みのデータ（T.yomi・T.ruby・スポットの kana）でも探す。
     予約番号・合言葉で守っている中身（QRの中身）は対象にしない */
  const k2h = s => s.replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const norm = s => k2h(String(s || '').normalize('NFKC').toLowerCase()).replace(/[\s・、。,.\-－ー―‐（）()「」『』【】〈〉/／:：|｜→←]/g, '');
  const cssq = s => String(s).replace(/["\\]/g, '\\$&');
  let SIDX = null;
  function searchIndex() {
    if (SIDX) return SIDX;
    const L = [], add = (t, s, x, go, mark, more = {}) => L.push({ t, s, x: x || '', go, mark, ...more });
    const J = a => a.filter(Boolean).join(' ');
    /* ページ：移った先では、その節（なければページの題）を光らせる */
    const pageMark = href => { const [r, sub] = href.replace(/^#\/?/, '').split('/'); return !r ? '#today-top' : r === 'trip' ? '.dayhead h1' : sub && !/^(live|nozomi|kamome|relay)/.test(sub) && r !== 'help' ? '#' + sub : r === 'ride' && sub === 'live' ? '.lm-phead h1' : 'h1'; };
    TOC.forEach(([h, list]) => list.forEach(([l, href, sub]) => add(l, `ページ・${h}`, sub, TOC_ACT[href] ? null : href, TOC_ACT[href] ? null : pageMark(href), TOC_ACT[href] ? { act: TOC_ACT[href] } : {})));
    T.days.forEach(d => {
      const dl = `${d.n}日目 ${d.label}（${d.dow}）`;
      d.items.forEach((it, i) => {
        if (it.t === 'stop') add(it.name, `行程・${dl} ${it.arr || it.dep}`, J([it.note, TYPE_LABEL[it.type], it.type === 'station' ? '駅' : '', it.map]), `#/trip/${d.n}`, `#it-${i}`);
        else add(it.line, `行程・${dl}・${dur(it.min)}の移動`, J([it.detail, it.dist ? '距離 ' + it.dist : '', it.note]), `#/trip/${d.n}`, `#it-${i}`);
      });
      (d.drives || []).forEach(v => add(`ドライブの道順：${v.label}`, `まっぷ・${dl} ${v.when}`, v.via, '#/map/drive', `[data-drive="${v.id}"]`, { k: '車 ルート レンタカー 高速道路 Googleマップ' }));
    });
    T.spots.forEach(sp => {
      add(sp.name, `おでかけ・${sp.day}日目`, J([sp.kana, sp.area, sp.lead, ...(sp.info || []).map(x => x.join(' ')), ...(sp.steps || []), ...(sp.walk || []), sp.walkNote, sp.warn, ...(sp.fees || []).map(x => x.join(' '))]), `#/spot/${sp.id}`, '.spot-hero');
    });
    const Lu = T.lunch[0];
    add(Lu.name, 'ごはん・10/18 お昼', J([Lu.sub, Lu.lead, Lu.address, ...Lu.menu.map(m => m[0])]), '#/food', '#marukatsu');
    add('JO-TERRACE OSAKA', 'ごはん・10/19 お昼', '大阪城公園の中 お昼ごはん お店は現地で決める', '#/food', '#joterrace');
    T.dinner.forEach(sh => add(sh.name, `ごはん・夕ごはん候補（${T.dinnerAreas[sh.area].name}）`, J([sh.genre, sh.place, sh.address, sh.hours, sh.closed, sh.pay, sh.takeout, sh.rule, ...sh.picks.map(p => p[0] + ' ' + (p[2] || ''))]), '#/food', `#${sh.id}`, { pre: () => session.set('ffilt', 'all') }));
    TT.stations.forEach(st => {
      const dirs = st.lines.flatMap(l => l.dirs), tb = TD();
      const dests = [...new Set(dirs.flatMap(id => { const t = tb[id]; return t ? [t.dir, ...['weekday', 'holiday'].flatMap(k => (t[k] || []).map(r => r[1]))] : []; }))];
      add(`${st.name}駅の時刻表`, `時刻表・${st.lines.map(l => TT.lines[l.line].name).join('・')}`, J([st.roma, '行き先：' + dests.filter(Boolean).join('・')]), null, null, { tt: st.id });
    });
    const n28 = T.nozomiLine.nozomi28, n17 = T.nozomiLine.nozomi17;
    n28.forEach(([nm, pref, a, d, stop], k) => { const b = n17.find(x => x[0] === nm) || []; add(`${nm}駅（${pref}${pref === '大阪' ? '府' : '県'}）`, `いまどのへん？・のぞみが${stop ? '止まる' : '通る'}駅`, J([`往路 ${a || d}${stop ? '' : 'ごろ通過'}　復路 ${b[2] || b[3] || ''}${b[4] ? '' : 'ごろ通過'}`, ...((LINE.stationInfo || {})[nm] || []).slice(0, 2)]), '#/ride/live/nozomi28', `#line > li:nth-child(${k + 1})`); });
    ((window.LINE && LINE.spots) || []).forEach(sp => add(sp.name, `沿線の見どころ・${sp.pref}`, J([sp.kana, sp.sum, sp.genre]), '#/ride/live/nozomi28', '#spots'));
    /* リレーかもめの駅と見どころ */
    const r92 = T.liveLine.relay92 || [], r33 = T.liveLine.relay33 || [], RL = (window.LINES || {}).relay;
    r92.forEach(([nm, pref, a, d, stop], k) => { const b = r33.find(x => x[0] === nm) || []; add(`${nm}駅（${pref}県）`, `いまどのへん？・リレーかもめが${stop && b[4] ? '止まる' : stop || b[4] ? '止まる（片道だけ）' : '通る'}駅`, J([`往路 ${a || d}${stop ? '' : 'ごろ通過'}　復路 ${b[2] || b[3] || ''}${b[4] ? '' : 'ごろ通過'}`, ...(((RL && RL.stationInfo) || {})[nm] || []).slice(0, 2)]), '#/ride/live/relay92', `#line > li:nth-child(${k + 1})`); });
    ((RL && RL.spots) || []).forEach(sp => add(sp.name, `沿線の見どころ・${sp.pref}`, J([sp.kana, sp.sum, sp.genre]), '#/ride/live/relay92', '#spots'));
    Object.entries(T.trains).forEach(([k, tr]) => add(tr.name, `のりもの・${MD(tr.date)} ${tr.from} ${tr.dep} → ${tr.to} ${tr.arr}`, J([tr.kind, tr.vehicle]), `#/ride/${k}`, `#${k}`, { k: tr.ticket + ' 指定席 座席表 座席 きっぷ' }));
    T.castles.forEach((c, j) => add(c.name, `車窓の城・${c.station}駅`, J([c.side, c.text]), '#/ride/castles', `[data-sid="castle-${j}"]`));
    T.ekiben.forEach(([n, p, d], j) => add(n, '博多駅の駅弁', d, '#/ride/ekiben', `.bento > li:nth-child(${j + 1})`, { k: '駅弁 弁当' }));
    (T.triviaCats || []).forEach(c => { add(`トリビア：${c.name}`, 'トリビア', c.sub, `#/trivia/${c.id}`, `#tv-cat-${c.id}`, { k: 'トリビア 雑学 豆知識' }); triviaItems(c.id).forEach(x => add(x.q, `トリビア・${c.name}`, J([x.k, x.a]), `#/trivia/${c.id}`, `#tv-${x.id}`, { k: 'トリビア' })); });
    XFER.forEach(x => add(`${x.title}（3D）`, `駅の乗り換え（3D）・${x.when}`, x.sub, xferHref(x.s), null, { k: '乗り換え 3D 立体 構内 エレベーター 階段' }));
    MANUAL.forEach(x => add(x.title, `使い方・${x.tab}`, J([x.sub, x.where, ...x.pts.map(p => p.t)]), `#/help/${x.id}`, '.hp-head'));
    T.bag.forEach(g => g.items.forEach(([n, why]) => add(n, `持ち物・${g.cat}`, why, '#/bag', `[data-bag="${cssq(n)}"]`)));
    const S = T.sos;
    S.urgent.forEach(([n, l, d], k) => add(`${n}　${l}`, '緊急連絡先', d, '#/sos', `[data-sid="sos-u${k}"]`));
    S.consult.forEach((g, gi) => g.rows.forEach(([a, n, tl, h], ri) => add(`${n}（${a}）`, `緊急連絡先・${g.short}`, J([g.label, tl, h]), '#/sos', `[data-sid="sos-c${gi}-${ri}"]`)));
    S.hospitals.forEach((h, k) => add(h.name, `病院・${h.area}`, J([h.badge, h.text, h.address, h.tel]), '#/sos', `[data-sid="hosp-${k}"]`));
    add('受診のときにあると便利なもの', '緊急連絡先', S.bring.join(' '), '#/sos');
    add('交通事故のとき', '緊急連絡先', S.accident.join(' '), '#/sos', '#accident');
    add('奈良公園近くの駐車場', '駐車場・10/18', T.parking.rule, '#/sos/parking', '#parking', { k: 'パーキング' });
    T.parking.list.forEach((p, k) => add(`${p.no} ${p.name}`, '駐車場・奈良公園の近く', J([p.fee, p.note, p.spaces, p.open]), '#/sos/parking', `[data-sid="park-${k}"]`, { k: '駐車場 パーキング' }));
    const H = T.hotel;
    add(H.name, 'ホテル', J([H.address, H.tel, H.access, 'チェックイン ' + H.checkin, 'チェックアウト ' + H.checkout, H.pay, H.plan, H.soine]), '#/stay');
    H.perks.forEach(([k, v]) => add(k, 'ホテル・滞在中に便利なこと', v, '#/stay'));
    H.floors.forEach(([fl, d]) => add(`${fl}　${d}`, 'ホテル・館内のフロア', '', '#/stay', '.floors'));
    add('朝ごはん（ホテル）', 'ホテル', J([H.breakfast.place, H.breakfast.time, H.breakfast.text]), '#/stay');
    add('大浴場・サウナ', 'ホテル', J([H.bath.place, H.bath.time.join(' '), H.bath.text, H.bath.warn]), '#/stay');
    Object.values(H.rooms).forEach(r => add(`${r.no} ${r.name}`, `お部屋・${r.who}`, J([r.nights, r.size, r.bed, r.bath, r.amenity]), '#/stay'));
    add('チェックインQR', 'ホテル・予約とQR', 'QRコード 自動チェックイン 予約番号 合言葉 画像として保存', null, null, { act: 'qr' });
    const C = T.car;
    add(C.shop, 'レンタカー・10/18', J([C.klass, C.klassNote, C.address, C.tel, C.access, C.pay, ...C.notes.map(x => x.join(' ')), ...C.included]), '#/stay/car', '#car');
    ((Budget.data() || {}).groups || []).forEach(g => add(g.name, '予算', (g.rows || []).map(r => r.name + ' ' + Budget.rowText(r)).join(' '), '#/money'));
    add('割り勘メモ', '予算', '立て替え 精算 割り勘', '#/money', '#split');
    T.stamps.forEach(st => add(`スタンプ：${st.name}`, `スタンプ帳・${st.day}日目`, '', '#/spot/stamps', `[data-stamp="${st.id}"]`));
    (T.officialMaps || []).forEach(m => add(m.name, `公式の案内図・${m.by}`, m.when, '#/map/official', '#official', { k: '地図 案内図 構内図' }));
    add('おでかけマップ', 'まっぷ', '地図 ピン 現在地 交通 観光 グルメ 宿 トイレ 休憩 多機能トイレ 日にち 一覧 道順 Googleマップ', '#/map/outing', null, { k: 'マップ 地図' });
    add('旅先のお天気', 'きょう', '天気 予報 雨 気温', '#/', '#weather');
    if (T.tips) {
      add('例年の気温', '旅のワンポイント', '気温 平年値 気象庁 大阪 奈良 福岡 大村 寒い 暑い', '#/tips', '#tp-temp');
      add('服装', '旅のワンポイント', T.tips.wear.map(w => w.join(' ')).join(' ') + ' 服 上着 靴 何を着る', '#/tips', '#tp-wear');
      T.tips.items.forEach(x => add(x.title, `旅のワンポイント・${x.day.map(n => n + '日目').join('・')}`, x.text, '#/tips', `#tip-${x.id}`));
    }
    add('文字の大きさ', 'その他・設定', '文字を大きく 標準 大 画面の明るさ 暗い', null, null, { act: 'more' });
    add('ホーム画面に追加', 'その他・設定', 'アプリのように開く アイコン', null, null, { act: 'a2hs' });
    add('家族を切り替える', 'その他・設定', '山口家 飯塚家', null, null, { act: 'fam' });
    add('機能紹介', '使い方', 'このしおりで、できること スライド', null, null, { act: 'intro' });
    newsAll().forEach(n => add(n.title, `お知らせ・${fmtNewsDate(n.date)}`, n.text, n.go, n.mark));
    /* 読み：漢字のことばに読みを添えておく */
    const Y = Object.entries({ ...(T.yomi || {}), ...Object.fromEntries(T.ruby || []) });
    L.forEach(r => {
      const all = `${r.t} ${r.s} ${r.x} ${r.k || ''}`;
      r.nt = norm(r.t); r.h = norm(all + ' ' + (r.k || '')) + '\n' + norm(Y.filter(([w]) => all.includes(w)).map(([, y]) => y).join(' '));
    });
    return (SIDX = L);
  }
  function searchFor(q) {
    const terms = q.split(/[\s\u3000]+/).map(norm).filter(Boolean);
    if (!terms.length) return [];
    return searchIndex().map((r, k) => {
      if (!terms.every(w => r.h.includes(w))) return null;
      let sc = 0; terms.forEach(w => { if (r.nt.includes(w)) sc += 4; if (r.nt.startsWith(w)) sc += 2; });
      return { r, sc, k };
    }).filter(Boolean).sort((a, b) => b.sc - a.sc || a.k - b.k).map(x => x.r);
  }
  function snippet(x, q) {
    const w = q.split(/[\s\u3000]+/).find(t => t && x.includes(t));
    if (!w) return x.length > 44 ? x.slice(0, 44) + '…' : x;
    const i = x.indexOf(w), a = Math.max(0, i - 16);
    return (a ? '…' : '') + x.slice(a, i + w.length + 26) + (i + w.length + 26 < x.length ? '…' : '');
  }
  function searchGo(r) {
    if (r.pre) r.pre();
    const ACT = { qr: showQR, sim: simSheet, more: moreSheet, a2hs: () => a2hsSheet(false), fam: () => pickFamily(), intro: () => introSlides(true) };
    if (r.act) return setTimeout(ACT[r.act], 50);
    if (r.tt) { if (!/^#\/ride/.test(location.hash)) location.hash = '#/ride/tt'; setTimeout(() => openTT({ station: r.tt }), 400); return; }
    goFlash(r.go, r.mark);
  }

  /* ========== ルビ（読みにくい地名・駅名。T.ruby） ==========
     画面ごとに、それぞれのことばの最初の1回だけに振る。時刻表の一覧・発車標・地図の中など、狭い所には振らない */
  const RUBY = (T.ruby || []).slice().sort((a, b) => b[0].length - a[0].length);
  const RUBY_Y = Object.fromEntries(RUBY);
  const RUBY_RE = RUBY.length ? new RegExp(RUBY.map(r => r[0]).join('|'), 'g') : null;
  const NO_RUBY = 'script,style,textarea,input,select,option,svg,ruby,.tt-grid,.board,.tt-legs,.lm-mapwrap,.dm-map,.simbar,.srch-box,.here,.sb-r,.nw-t';
  function applyRuby(root) {
    if (!RUBY_RE || !root) return;
    const seen = new Set($$('ruby[data-rb]').filter(r => !root.contains(r)).map(r => r.dataset.rb));
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(NO_RUBY) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(n => {
      const t = n.nodeValue; RUBY_RE.lastIndex = 0;
      if (!RUBY_RE.test(t)) return;
      RUBY_RE.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m, hit = false;
      while ((m = RUBY_RE.exec(t))) {
        const w = m[0]; if (seen.has(w)) continue;
        seen.add(w); hit = true;
        frag.append(t.slice(last, m.index));
        const rb = document.createElement('ruby'); rb.dataset.rb = w; rb.append(w); const rt = document.createElement('rt'); rt.textContent = RUBY_Y[w]; rb.append(rt); frag.append(rb);
        last = m.index + w.length;
      }
      if (!hit) return;
      frag.append(t.slice(last)); n.replaceWith(frag);
    });
  }

  /* ========== 機能紹介（初回ガイドの前に出すスライド） ==========
     「このしおりで何ができるか」を、横にめくるスライドで紹介する。一度見たら出さない（guide:intro）。使い方ページから見直せる。
     動画はスライドを開いたときに読み込む（トップの表示を重くしない）。視差効果を減らす設定では再生せず、止まった1コマを出す */
  /* 並びは「まず入口（トップ）→ そこから使う機能」 */
  const INTRO = [
    { img: 'today', name: '今日の予定機能', text: '旅行中は、いまの予定と次に乗る列車を、開いてすぐに確かめることができます。' },
    { v: 'live', name: 'いまどのへん？機能', text: '新幹線と特急リレーかもめの車内で、いまどこを走っているか、窓から何が見えるかを地図で確かめることができます。' },
    { v: 'xfer', name: '3D乗換機能', text: '博多と新大阪での乗り換えの道順を、立体の図を回しながらたどることができます。' },
    { img: 'shift', name: 'いまここ機能', text: '予定からずれたら、行程表で「いまここ」を押すと、この先の時刻を合わせて表示することができます。' },
    { img: 'qr', name: '予約・QR機能', text: 'ホテルの予約番号とチェックインQRを、合言葉を入れて表示することができます。' },
    { img: 'offline', name: 'オフライン機能', text: '一度開いておけば、電波のないトンネルや機内モードでも、しおりを見ることができます。' }
  ];
  const INTRO_V = 12;
  function introSlides(force) {
    if (!force && window.Guide && Guide.seen('intro')) return Promise.resolve(false);
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(done => {
      const ov = document.createElement('div');
      ov.className = 'in-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'このしおりで、できること');
      const media = (x, k) => x.v
        ? (RM ? `<img src="assets/intro/${x.v}.webp?v=${INTRO_V}" alt="" decoding="async">`
          : `<video muted playsinline loop preload="none" poster="assets/intro/${x.v}.webp?v=${INTRO_V}" data-src="assets/intro/${x.v}.mp4?v=${INTRO_V}" aria-hidden="true"></video>`)
        : `<img ${k ? 'data-' : ''}src="assets/manual/${x.img}.webp?v=${MAN_V}" alt="" decoding="async">`;
      ov.innerHTML = `<div class="in-top"><p class="in-h">このしおりで、できること</p><button type="button" class="in-skip">スキップ</button></div>
        <div class="in-track" tabindex="-1">${INTRO.map((x, k) => `<section class="in-slide" role="group" aria-roledescription="スライド" aria-label="${k + 1} / ${INTRO.length}">
          <div class="in-media${x.v ? ' mv' : ''}">${media(x, k)}</div>
          <p class="in-no lat num">Feature ${String(k + 1).padStart(2, '0')}</p>
          <p class="in-t"><b>${esc(x.name)}</b>：${esc(x.text)}</p></section>`).join('')}</div>
        <div class="in-dots" role="tablist" aria-label="スライドの位置">${INTRO.map((x, k) => `<button type="button" role="tab" data-k="${k}" aria-label="${k + 1}枚目：${esc(x.name)}"><i></i></button>`).join('')}</div>
        <div class="in-btns"><button type="button" class="in-prev">戻る</button><button type="button" class="in-next">次へ</button></div>`;
      const track = $('.in-track', ov), slides = $$('.in-slide', ov), dots = $$('.in-dots button', ov);
      let cur = -1, closed = false;
      const show = k => {
        if (k === cur) return; cur = k;
        dots.forEach((d, i) => d.setAttribute('aria-selected', String(i === k)));
        $('.in-prev', ov).disabled = k === 0;
        $('.in-next', ov).textContent = k === INTRO.length - 1 ? (force ? '閉じる' : '画面の案内へ') : '次へ';
        slides.forEach((sl, i) => {
          /* 画像は隣まで先に読む。動画は開いたスライドだけ読み込んで再生し、ほかは止める */
          $$('img[data-src]', sl).forEach(im => { if (Math.abs(i - k) <= 1) { im.src = im.dataset.src; im.removeAttribute('data-src'); } });
          const v = $('video', sl); if (!v) return;
          if (i === k) {
            if (!v.getAttribute('src')) { v.src = v.dataset.src; v.muted = true; v.playsInline = true; }
            const pr = v.play(); pr && pr.catch(() => {});
          } else if (!v.paused) v.pause();
        });
      };
      const go = k => { k = Math.max(0, Math.min(INTRO.length - 1, k)); track.scrollTo({ left: k * track.clientWidth, behavior: RM ? 'auto' : 'smooth' }); show(k); };
      const close = () => {
        if (closed) return; closed = true;
        $$('video', ov).forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
        try { localStorage.setItem('guide:intro', '1'); } catch { /* 覚えられなくても続行 */ }
        ov.remove(); document.removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
        done(true);
      };
      let st = 0;
      track.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => show(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), 60); }, { passive: true });
      const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); };
      const onResize = () => { track.scrollLeft = cur * track.clientWidth; };
      ov.addEventListener('click', e => {
        if (e.target.closest('.in-skip')) close();
        else if (e.target.closest('.in-next')) cur >= INTRO.length - 1 ? close() : go(cur + 1);
        else if (e.target.closest('.in-prev')) go(cur - 1);
        else { const d = e.target.closest('.in-dots button'); d && go(+d.dataset.k); }
      });
      document.addEventListener('keydown', onKey); addEventListener('resize', onResize);
      document.body.appendChild(ov);
      show(0);
      $('.in-next', ov).focus({ preventScroll: true });
    });
  }
  const Onboard = (() => {
    let started = false, finish;
    const done = new Promise(r => (finish = r));
    const full = () => document.body.classList.contains('lm-full-on');
    async function start() {
      if (started) return; started = true;
      try {
        await sleep(900);
        if (a2hsDue()) await a2hsSheet(true);
        if (!fam() && !session.get('askedFam')) { session.set('askedFam', '1'); await pickFamily(true); }
        if (window.Guide && !(Guide.seen('app') && Guide.seen('intro'))) {
          /* 全画面の地図ではタブバーが隠れているので、戻るまで待つ */
          while (full()) await new Promise(r => addEventListener('hashchange', r, { once: true }));
          await sleep(300);
          /* 機能紹介 → 画面の案内の順。前の版で画面の案内を見た人にも、機能紹介は一度だけ出す */
          if (!Guide.seen('intro')) { await introSlides(false); await sleep(250); }
          await appGuide(false);
        }
      } catch (e) { console.error(e); }
      finish();
    }
    return { start, whenDone: () => done };
  })();
  window.Onboard = Onboard;

  /* ========== 操作 ========== */
  document.addEventListener('click', e => {
    /* 駅の乗り換え（3D）を開く前の画面を覚えておく（図の左上の「しおりに戻る」で、ここへ戻る） */
    if (e.target.closest('a[href^="transfer.html"]')) session.set('xferFrom', location.hash || '#/');
    const pk = e.target.closest('[data-park]');
    if (pk) { e.preventDefault(); if (pk.dataset.park === 'save') parkSave(); else { store.set('parked', null); redrawPark(); toast('記録を消しました'); } return; }
    const mt = e.target.closest('[data-meet]');
    if (mt) { e.preventDefault(); ({ go: meetGo, share: meetShare, copy: meetCopy })[mt.dataset.meet](); return; }
    const bk = e.target.closest('[data-back]');
    if (bk) { e.preventDefault(); const [r, sub] = bk.dataset.back.split('/'); goBack(r, sub); return; }
    const a = e.target.closest('[data-act]');
    if (a) {
      e.preventDefault();
      const act = a.dataset.act;
      if (act === 'fam') pickFamily();
      if (act === 'qr') showQR();
      if (act === 'sim') simSheet();
      if (act === 'toc') showToc();
      if (act === 'more') moreSheet();
      if (act === 'a2hs') a2hsSheet(false);
      if (act === 'help') location.hash = '#/help';
      if (act === 'guide-app') replayGuide('app');
      if (act === 'guide-live') replayGuide('live');
      if (act === 'intro') introSlides(true);
      if (act === 'news') newsSheet();
      if (act === 'memtrip' || act === 'memback') { session.set('memTrip', act === 'memtrip' ? '1' : null); render(); scrollTo(0, 0); }
      if (act === 'lockforget') {
        if (!Lock.saved()) toast('この端末には、合言葉が入っていません');
        else { Lock.forget(); updateQrThumbs(); toast('この端末の合言葉を消しました。次に表示するときに、もう一度入れてください'); }
      }
      if (act === 'theme') {
        const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set('theme', nx);
      }
      return;
    }
    const q = s => e.target.closest(s);
    let el;
    if ((el = q('.cover:not(.slim):not(.mem)')) && !q('button, a')) { CoverTrain.run(); return; }
    if ((el = q('[data-sim]'))) {
      const k = el.dataset.sim;
      if (k === 'toggle') Clock.toggle();
      if (k === 'speed') Clock.cycleSpeed();
      if (k === 'seek') seekSheet();
      if (k === 'stop') { Clock.stop(); toast('本物の時刻に戻りました'); }
      if (k === 'rain') { session.set('simRain', simRain() ? null : '80'); render(); toast(simRain() ? '降水確率を80%にしました（おためし）' : '予報どおりの降水確率に戻しました'); }
      return;
    }
    if ((el = q('[data-rain]'))) return rainSheet(el.dataset.rain);
    if ((el = q('[data-here]'))) { const [d, i] = el.dataset.here.split(':'); setHere(d, +i); return; }
    if ((el = q('[data-unshift]'))) { setShift(null); toast('予定どおりの時刻に戻しました'); const y = scrollY; render(); scrollTo(0, y); return; }
    if ((el = q('[data-nudge]'))) {
      let st = store.get('nudge'); const id = el.dataset.nudge;
      if (!st || st.date !== id.split(':')[0]) st = { date: id.split(':')[0], seen: [id], closed: [] };
      st.closed.push(id); store.set('nudge', st); el.closest('.nudge').remove(); return;
    }
    if ((el = q('[data-try]'))) return startScene(sceneById(el.dataset.try));
    if ((el = q('.dc-go[data-go], .tv-today-b[data-go]'))) return goFlash(el.dataset.go, el.dataset.mark);
    if ((el = q('[data-tt]'))) return openTT({ leg: el.dataset.tt });
    if ((el = q('[data-tts]'))) return openTT({ station: el.dataset.tts });
    if ((el = q('[data-copy]'))) return copy(el.dataset.copy);
    if ((el = q('[data-dir]'))) { session.set('dir', el.dataset.dir); render(); return; }
    if ((el = q('[data-live]'))) { location.hash = '#/ride/live/' + el.dataset.live; return; }
    if ((el = q('[data-flip]'))) { el.classList.toggle('open'); return; }
    if ((el = q('[data-ffilt]'))) { session.set('ffilt', el.dataset.ffilt); const y = scrollY; render(); scrollTo(0, y); return; }
    if ((el = q('[data-want]'))) {
      const list = store.get('want', []), n = el.dataset.want, i = list.indexOf(n);
      i < 0 ? list.push(n) : list.splice(i, 1); store.set('want', list); el.classList.toggle('on', i < 0); return;
    }
    if ((el = q('[data-vote]'))) {
      const list = store.get('votes', []), n = el.dataset.vote, i = list.indexOf(n);
      i < 0 ? list.push(n) : list.splice(i, 1); store.set('votes', list); const y = scrollY; render(); scrollTo(0, y); return;
    }
    if ((el = q('[data-stamp]'))) {
      const id = el.dataset.stamp, before = Stamps.count(), on = Stamps.toggle(id);
      const y = scrollY; render(); scrollTo(0, y);
      if (on) {
        $$(`[data-stamp="${id}"]`).forEach(b => { const sc = $('.sc', b.closest('.visit-row') || b); sc && sc.classList.add('pop'); });
        if (before === T.stamps.length - 1 && Stamps.count() === T.stamps.length) setTimeout(stampComplete, 700);
      }
      return;
    }
    if ((el = q('[data-kn]'))) { knAct(el); return; }
    if ((el = q('[data-bdgo]'))) session.set('bdMode', el.dataset.bdgo);   // 思い出モードの「予算／実績を見る」：実績を開いた状態で（移動はリンクのまま）
    if ((el = q('[data-bdmode]'))) { session.set('bdMode', el.dataset.bdmode); const y = scrollY; render(); scrollTo(0, y); return; }
    if ((el = q('[data-del]'))) { const l = store.get('expenses', []); l.splice(+el.dataset.del, 1); store.set('expenses', l); const y = scrollY; render(); scrollTo(0, y); return; }
    if ((el = q('[data-bagdel]'))) { store.set('bagExtra', store.get('bagExtra', []).filter(x => x !== el.dataset.bagdel)); const y = scrollY; render(); scrollTo(0, y); }
  });
  document.addEventListener('change', e => {
    const b = e.target.closest('[data-bag]');
    if (b) { const d = store.get('bag', {}); b.checked ? (d[b.dataset.bag] = 1) : delete d[b.dataset.bag]; store.set('bag', d); const y = scrollY; render(); scrollTo(0, y); }
  });
  document.addEventListener('input', e => {
    const m = e.target.closest('[data-memo]');
    if (m) { const memo = store.get('memo', {}); memo[m.dataset.memo] = m.value; store.set('memo', memo); }
  });
  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'expform') {
      const l = store.get('expenses', []);
      l.push({ what: $('#ex-what').value.trim(), amt: +$('#ex-amt').value, payer: $('#ex-payer').value, split: $('#ex-split').value });
      store.set('expenses', l); render(); setTimeout(() => $('#split') && $('#split').scrollIntoView(), 50); toast('記録しました');
    }
    if (e.target.id === 'kn-tok') knSaveToken(e.target);
    if (e.target.id === 'bagform') {
      const v = $('#bag-new').value.trim(); if (!v) return;
      const l = store.get('bagExtra', []); if (!l.includes(v)) l.push(v); store.set('bagExtra', l); const y = scrollY; render(); scrollTo(0, y);
    }
  });

  const th = store.get('theme'); if (th) document.documentElement.dataset.theme = th;
  document.addEventListener('input', e => { if (e.target.id === 'meet-time') { meetTime = e.target.value || null; redrawMeet(); } });
  window.addEventListener('hashchange', render);
  /* 予算（budget.json）が届いた・変わったら、予算のページを開いているときだけ描き直す */
  Budget.on(() => {
    const r = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (r === 'money' || (r === '' && memOn())) { const y = scrollY; render(); scrollTo(0, y); }   // 思い出モードの表紙：決算が入っていれば「予算／実績」へのリンクを出す
    if (r === 'kanri') knRefresh();
  });
  Budget.load();
  window.addEventListener('resize', () => $('#line') && updateLive());
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
